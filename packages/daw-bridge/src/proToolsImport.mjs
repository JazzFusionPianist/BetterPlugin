import { parseRegionBundle, planRegionImport, rescaleSamples } from '../../core/lib/regionBundle.ts'
import { inspectSession } from './ptsl.mjs'
import { timelineExportRequest, verifyProToolsTimeline } from './proToolsTimeline.mjs'

// PTSL's command JSON parser requires int64 positions as JSON numbers, not protobuf-JSON strings.
const mediaTime = samples => ({ position: samples, time_type: 'BTType_Samples' })
const sampleRateOf = value => Number(String(value).replace(/^(SRate_|SR_)/, ''))

/** Host edits are opt-in. The caller must verify archive bytes and persist an attempt journal. */
export async function importToProTools({ bundle: input, paths, expectedSessionId, call, journal }) {
  const bundle = parseRegionBundle(input)
  if (!bundle) throw new Error('Invalid region bundle.')
  const session = await inspectSession(call)
  if (!expectedSessionId || expectedSessionId !== session.instanceId) throw new Error('Destination session changed.')
  const plan = planRegionImport(bundle, session.sampleRate)
  if (plan.some(t => /[\t\r\n]/.test(t.name) || t.name !== t.name.trim()
    || t.regions.some(r => /[\t\r\n]/.test(r.name) || r.name !== r.name.trim())))
    throw new Error('Track and region names must be unambiguous in the Pro Tools timeline report.')
  for (const track of plan) {
    let previousEnd = -Infinity
    for (const r of track.regions.slice().sort((a, b) => a.startSamples - b.startSamples)) {
      if (r.startSamples < previousEnd) throw new Error('Overlapping regions require a qualified Pro Tools layering adapter.')
      previousEnd = r.startSamples + rescaleSamples(r.sourceLengthFrames, r.sourceSampleRate, session.sampleRate)
    }
  }
  // Multichannel channel-order mappings need separate host qualification.
  if (bundle.assets.some(a => ![1, 2].includes(a.channels) || !a.frames || !paths.has(a.id))
    || plan.some(t => ![1, 2].includes(t.channels) || t.regions.some(r => r.startSamples < 0
      || bundle.assets.find(a => a.id === r.assetId).channels !== t.channels)))
    throw new Error('Only complete mono/stereo layouts at nonnegative positions are supported.')
  if (!journal?.begin || !journal?.record) throw new Error('An import journal is required.')
  async function requireStopped() {
    const state = (await call('GetTransportState')).current_setting
    if (!['TState_TransportStopped', 'TS_TransportStopped'].includes(state))
      throw new Error('Stop Pro Tools playback/recording before importing a region bundle.')
  }
  await requireStopped()
  const receipt = { bundleId: bundle.id, sessionId: session.instanceId, status: 'started', tracks: [], placedRegions: [] }
  // Exclusive begin prevents double-clicks and unsafe retries after a lost RPC response.
  await journal.begin(receipt)
  async function checked(command, body) {
    const current = await call('GetSessionIDs')
    const rate = await call('GetSessionSampleRate')
    if (current.instance_id !== session.instanceId || sampleRateOf(rate.sample_rate) !== session.sampleRate)
      throw new Error('Destination session or sample rate changed. Import stopped.')
    await requireStopped()
    return call(command, body)
  }
  try {
    const imported = new Map()
    for (const asset of bundle.assets) {
      const path = paths.get(asset.id)
      const result = await checked('ImportAudioToClipList', { file_list: [path],
        audio_operations: asset.sampleRate === session.sampleRate ? 'AOperations_CopyAudio' : 'AOperations_ConvertAudio' })
      const item = result.file_list?.find(f => f.original_input_path === path)
      if (result.failure_list?.length || result.file_list?.length !== 1 || !item?.destination_file_list?.length)
        throw new Error(`Pro Tools could not import ${asset.name}.`)
      const files = []
      for (const file of item.destination_file_list) {
        if (!file.file_id || !file.file_path || file.file_path === path) throw new Error('Pro Tools did not copy the audio into the session.')
        const info = (await checked('GetMediaFileInfo', { file_id: file.file_id })).audio_file_info
        const rate = sampleRateOf(info?.sample_rate)
        if (!info || ![asset.sampleRate, session.sampleRate].includes(rate)
          || info.length?.time_type !== 'BTType_Samples' || !Number.isSafeInteger(Number(info.length.length)))
          throw new Error('Unsupported imported audio format.')
        if (Math.abs(Number(info.length.length) - rescaleSamples(asset.frames, asset.sampleRate, rate)) > 1)
          throw new Error('Imported audio length differs from the bundle.')
        files.push({ ...file, rate, channels: info.num_channels, frames: Number(info.length.length) })
      }
      // Interleaved mono/stereo only; don't guess channel order of split-mono responses.
      if (files.length !== 1 || files[0].channels !== asset.channels) throw new Error('Unexpected channel mapping after import.')
      imported.set(asset.id, files[0])
    }
    const existingIds = new Set(session.tracks.map(t => t.id))
    const expected = []
    for (const track of plan) {
      const result = await checked('CreateNewTracks', { number_of_tracks: 1, track_name: track.name,
        track_format: track.channels === 1 ? 'TFormat_Mono' : 'TFormat_Stereo',
        track_type: 'TType_Audio', track_timebase: 'TTimebase_Samples', insertion_point_position: 'TIPoint_Last' })
      const id = result.created_track_ids?.[0]
      if (!id || result.created_track_ids.length !== 1 || existingIds.has(id)) throw new Error('Could not identify the new track.')
      existingIds.add(id)
      receipt.tracks.push({ sourceId: track.sourceTrackId, id, name: result.created_track_names?.[0] })
      const target = { id, name: result.created_track_names?.[0], channels: track.channels, clips: [] }
      if (!target.name) throw new Error('Pro Tools did not return the new track name.')
      expected.push(target)
      await journal.record(receipt)
      for (const region of track.regions) {
        const asset = imported.get(region.assetId)
        const offset = rescaleSamples(region.sourceOffsetFrames, region.sourceSampleRate, asset.rate)
        const end = rescaleSamples(region.sourceOffsetFrames + region.sourceLengthFrames, region.sourceSampleRate, asset.rate)
        if (end <= offset || end > asset.frames) throw new Error('Invalid trim after sample-rate conversion.')
        const channels = track.channels === 1 ? ['SChannel_Mono'] : ['SChannel_Left', 'SChannel_Right']
        const clips = await checked('CreateAudioClips', { clip_list: [{ name: region.name,
          channel_format: track.channels === 1 ? 'SFormat_Mono' : 'SFormat_Stereo',
          clip_info: channels.map(name => ({ file_id: asset.file_id, src_channel: { name }, dst_channel: { name },
            src_start_point: mediaTime(offset), src_end_point: mediaTime(end) })),
        }] })
        const clipIds = clips.clip_list?.[0]?.clip_ids
        if (clips.clip_list?.length !== 1 || clipIds?.length !== track.channels || clipIds.some(id => !id))
          throw new Error('Pro Tools did not create all region channels.')
        // Store returned clip definitions, including host-added stereo suffixes, for readback.
        const created = []
        for (let offset = 0; ;) {
          const page = await checked('GetClipList', { pagination_request: { offset, limit: 100 } })
          // 2026.04 hosts return clip_list; the published proto still calls it clips.
          const list = page.clip_list ?? page.clips ?? []
          created.push(...list.filter(c => clipIds.includes(c.clip_id)))
          offset += list.length
          // Some 2026.04 hosts report this page's count as "total", not the full list.
          if (created.length === clipIds.length || list.length < 100) break
          if (offset > 100000) throw new Error('Pro Tools returned too many clips.')
        }
        if (created.length !== clipIds.length) throw new Error('Could not read back the created clip definitions.')
        if (created.some(c => c.file_id !== asset.file_id || !c.clip_full_name
          || c.src_start_point?.time_type !== 'BTType_Samples' || Number(c.src_start_point.position) !== offset
          || c.src_end_point?.time_type !== 'BTType_Samples' || Number(c.src_end_point.position) !== end))
          throw new Error('Created clip source or trim differs from the bundle.')
        await checked('SpotClipsByID', { src_clips: clipIds, dst_track_id: id,
          dst_location_data: { location_type: 'SLType_Start', location: {
            location: String(region.startSamples), time_type: 'TLType_Samples',
          } } })
        receipt.placedRegions.push(region.sourceRegionId)
        for (const [channel, clipId] of clipIds.entries()) {
          const clip = created.find(c => c.clip_id === clipId)
          target.clips.push({ channel: channel + 1, name: clip.clip_full_name,
            start: region.startSamples, duration: rescaleSamples(end - offset, asset.rate, session.sampleRate) })
        }
        await journal.record(receipt)
      }
    }
    const after = await inspectSession(call)
    if (after.instanceId !== session.instanceId || after.sampleRate !== session.sampleRate)
      throw new Error('Destination changed before timeline verification.')
    const report = await checked('ExportSessionInfoAsText', timelineExportRequest)
    receipt.verification = verifyProToolsTimeline(report.session_info, expected, after.tracks, session.sampleRate)
    const finalIds = await call('GetSessionIDs')
    if (finalIds.instance_id !== session.instanceId) throw new Error('Destination changed during timeline verification.')
    receipt.status = 'complete'
    await journal.record(receipt)
    return receipt
  } catch (error) {
    receipt.status = 'incomplete'
    receipt.error = error.message
    await journal.record(receipt)
    // Never issue a blind global Undo: it could undo the user's concurrent edits.
    throw new Error(`Import stopped: ${error.message} Check the import journal before retrying; some new items may remain.`)
  }
}
