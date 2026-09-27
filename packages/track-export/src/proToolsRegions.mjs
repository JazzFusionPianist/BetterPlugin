import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { dirname, join, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import { inspectSession } from './ptsl.mjs'
import { probeWave } from './proToolsTracks.mjs'
import { timelineExportRequest, verifyProToolsTimeline } from './proToolsTimeline.mjs'
import { prepareArchivedRegionBundle } from '../../core/lib/regionArchive.ts'
import { planRegionImport, rescaleSamples } from '../../core/lib/regionBundle.ts'
import { cropVstWave } from '../../core/lib/regionVstXml.ts'

const LIMIT = 298 * 1024 * 1024
async function destination(call, expected) {
  const s = await inspectSession(call)
  if (expected && s.instanceId !== expected) throw new Error('Pro Tools session changed. Choose the destination again.')
  if (!(await call('GetTransportState')).current_setting?.endsWith('TransportStopped'))
    throw new Error('Stop Pro Tools playback and recording first.')
  const name = (await call('GetSessionName')).session_name
  const path = (await call('GetSessionPath')).session_path?.path
  if (!name || !path) throw new Error('Save and open a Pro Tools session first.')
  const start = (await call('GetSessionStartTime')).session_start_time
  const origin = (await call('GetTimeAsType', {
    location: { location: start, time_type: 'TLType_TimeCode' }, time_type: 'TLType_Samples',
  })).converted_location?.location
  if (!/^-?\d+$/.test(origin ?? '') || !Number.isSafeInteger(Number(origin))) throw new Error('Unknown session time origin.')
  if ((await call('GetSessionIDs')).instance_id !== s.instanceId) throw new Error('Pro Tools session changed.')
  return { ...s, sessionId: s.instanceId, name, path, origin: Number(origin) }
}
export async function inspectProToolsDestination(call) {
  const s = await destination(call)
  return { sessionId: s.sessionId, name: s.name, sampleRate: s.sampleRate }
}
async function clipNames(call, ids) {
  const found = new Map()
  for (let offset = 0; offset <= 100000; offset += 1000) {
    const list = (await call('GetClipList', { pagination_request: { limit: 1000, offset } })).clips ?? []
    for (const clip of list) if (ids.includes(clip.clip_id)) found.set(clip.clip_id, clip.clip_full_name)
    if (found.size === ids.length) return ids.map(id => {
      const name = found.get(id)
      if (!name || /[\r\n\t]/.test(name)) throw new Error('Unsupported imported clip name.')
      return name
    })
    if (list.length < 1000) break
  }
  throw new Error('Pro Tools did not expose all imported clip IDs.')
}

/** New sample-based tracks only; never uses the user's selection, Undo or tempo map. */
export async function importProToolsRegions({ call, sessionId, archive, directory }) {
  const s = await destination(call, sessionId)
  const sessionPath = await realpath(s.path)
  const root = (await stat(sessionPath)).isDirectory() ? sessionPath : dirname(sessionPath)
  if (!(archive instanceof Uint8Array) || archive.length > LIMIT) throw new Error('Region archive exceeds 300 MB.')
  const p = await prepareArchivedRegionBundle(new File([archive], 'regions.slur-regions.zip'))
  const plan = planRegionImport(p.bundle, s.sampleRate)
  for (const a of p.bundle.assets) {
    const wave = probeWave(Buffer.from(await p.filesByAsset.get(a.id).arrayBuffer()))
    if (wave.sampleRate !== a.sampleRate || wave.channels !== a.channels || wave.frames !== a.frames)
      throw new Error('Received WAV metadata mismatch.')
  }
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const ready = [], suffix = randomUUID().slice(0, 8)
  for (const [index, t] of plan.entries()) {
    if (![1, 2].includes(t.channels)) throw new Error('Only mono/stereo tracks can be restored.')
    let end = -1
    for (const r of [...t.regions].sort((a, b) => a.startSamples - b.startSamples)) {
      const duration = rescaleSamples(r.sourceLengthFrames, r.sourceSampleRate, s.sampleRate)
      if (r.startSamples < 0 || r.startSamples < end || duration < 1) throw new Error('Overlapping or negative regions cannot be restored.')
      end = r.startSamples + duration
      if (!Number.isSafeInteger(end + s.origin)) throw new Error('Region exceeds the destination timeline.')
      if (p.bundle.assets.find(a => a.id === r.assetId).channels !== t.channels) throw new Error('Track channel mapping mismatch.')
      const name = r.name.replace(/[\x00-\x1f/\\:]/g, '_').slice(0, 80)
      const file = await cropVstWave(p.filesByAsset.get(r.assetId), { format: 'vst-xml', version: 1,
        captureId: 'ptsl-import', sourceApp: 'Slur', channelId: null, name,
        offsetFrames: r.sourceOffsetFrames, lengthFrames: r.sourceLengthFrames, positionSeconds: null })
      const path = join(directory, `${name}-${ready.length}-${suffix}.wav`)
      await writeFile(path, new Uint8Array(await file.arrayBuffer()), { mode: 0o600 })
      ready.push({ track: t, trackName: `${t.name.replace(/[\x00-\x1f]/g, ' ').slice(0, 60)} · Slur ${index + 1}-${suffix}`,
        region: r, path, start: r.startSamples + s.origin, duration })
    }
  }
  const receipt = { sessionId, bundleId: p.bundle.id, status: 'started', tracks: [], regions: [] }
  const journal = () => writeFile(join(directory, 'region-import.json'), JSON.stringify(receipt), { mode: 0o600 })
  const check = async () => {
    const current = await destination(call, sessionId)
    if (current.sampleRate !== s.sampleRate || current.origin !== s.origin || current.path !== s.path)
      throw new Error('Destination timing or path changed.')
    return current
  }
  await journal()
  let mutated = false
  const tracks = new Map()
  try {
    for (const item of ready) {
      await check()
      mutated = true // A timeout may happen AFTER the host changed its session.
      const imported = await call('ImportAudioToClipList', { file_list: [item.path],
        audio_operations: item.region.sourceSampleRate === s.sampleRate ? 'AOperations_CopyAudio' : 'AOperations_ConvertAudio' })
      if (imported.failure_list?.length || imported.file_list?.length !== 1
        || imported.file_list[0].original_input_path !== item.path) throw new Error('Pro Tools did not confirm the audio import.')
      const files = imported.file_list[0].destination_file_list
      if (!files?.length) throw new Error('Missing imported media.')
      const ids = files.flatMap(f => f.clip_id_list ?? [])
      if (ids.length !== item.track.channels || new Set(ids).size !== ids.length || ids.some(id => !id))
        throw new Error('Unsupported imported clip channel layout.')
      let channels = 0
      for (const f of files) {
        const actual = await realpath(f.file_path)
        if (!actual.startsWith(root + sep)) throw new Error('Imported audio is not copied into the session.')
        const w = probeWave(await readFile(actual))
        if (w.sampleRate !== s.sampleRate || w.frames !== item.duration) throw new Error('Imported audio rate or length differs.')
        channels += w.channels
      }
      if (channels !== item.track.channels) throw new Error('Imported audio channels differ.')
      const names = await clipNames(call, ids)
      await check()
      if (!tracks.has(item.track.sourceTrackId)) {
        const created = await call('CreateNewTracks', { number_of_tracks: 1, track_name: item.trackName,
          track_format: item.track.channels === 1 ? 'TFormat_Mono' : 'TFormat_Stereo', track_type: 'TType_Audio',
          track_timebase: 'TTimebase_Samples', insertion_point_position: 'TIPoint_Last' })
        if (created.created_track_ids?.length !== 1 || created.created_track_names?.length !== 1
          || s.tracks.some(t => t.id === created.created_track_ids[0])) throw new Error('Could not identify the new track.')
        const target = { id: created.created_track_ids[0], name: created.created_track_names[0], channels: item.track.channels, clips: [] }
        tracks.set(item.track.sourceTrackId, target); receipt.tracks.push(target); await journal()
      }
      const target = tracks.get(item.track.sourceTrackId), current = await check()
      if (!current.tracks.some(t => t.id === target.id && t.name === target.name)) throw new Error('Destination track changed.')
      await call('SpotClipsByID', { src_clips: ids, dst_track_id: target.id, dst_track_name: target.name,
        dst_location_data: { location_type: 'SLType_Start', location: { location: String(item.start), time_type: 'TLType_Samples' } } })
      names.forEach((name, i) => target.clips.push({ channel: i + 1, name, start: item.start, duration: item.duration }))
      receipt.regions.push(item.region.id); await journal()
    }
    const current = await check()
    verifyProToolsTimeline((await call('ExportSessionInfoAsText', timelineExportRequest)).session_info,
      [...tracks.values()], current.tracks, s.sampleRate)
    await check()
    receipt.status = 'complete'; await journal()
    return { importedTracks: tracks.size, importedRegions: receipt.regions.length }
  } catch (e) {
    receipt.status = 'incomplete'; receipt.error = e.message; await journal()
    const error = new Error(`Pro Tools placement stopped: ${e.message}${mutated ? ' New items may remain. Inspect the session and transfer journal before retrying.' : ''}`)
    error.cleanupUncertain = mutated
    throw error
  }
}
