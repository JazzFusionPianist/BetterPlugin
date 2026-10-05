import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { inspectSession } from './ptsl.mjs'
import { parseProToolsTimeline, timelineExportRequest } from './proToolsTimeline.mjs'

/** Copy retains the host's actual selection; never filter its outer range to guess selected clips. */
export async function captureProToolsSelection({ call, expectedSessionId, directory, journal }) {
  const session = await inspectSession(call)
  if (!expectedSessionId || session.instanceId !== expectedSessionId) throw new Error('Source session changed.')
  const active = state => ['TAState_SetExplicitly', 'TAState_SetImplicitly',
    'TAState_SetExplicitlyAndImplicitly'].includes(state)
  const sources = session.tracks.filter(t => active(t.track_attributes?.has_edit_selection))
    .sort((a, b) => a.index - b.index)
  if (!sources.length || sources.length > 128 || sources.some(t => t.type !== 'TType_Audio'
    || !['TFormat_Mono', 'TFormat_Stereo'].includes(t.format)))
    throw new Error('Select regions on mono/stereo audio tracks in Pro Tools first.')
  if (sources.some(t => !Number.isSafeInteger(t.index)) || new Set(sources.map(t => t.index)).size !== sources.length)
    throw new Error('Could not identify the source track order.')
  if (!journal?.record) throw new Error('A persistent capture journal is required.')
  const receipt = { sessionId: session.instanceId, sampleRate: session.sampleRate,
    status: 'started', temporary: [], sourceTracks: sources }
  const selected = session.tracks.filter(t => active(t.track_attributes?.is_selected)).map(t => t.name)
  async function checked(command, body) {
    const current = await inspectSession(call)
    if (current.instanceId !== session.instanceId || current.sampleRate !== session.sampleRate)
      throw new Error('Source session or sample rate changed during capture.')
    const state = (await call('GetTransportState')).current_setting
    if (!['TState_TransportStopped', 'TS_TransportStopped'].includes(state))
      throw new Error('Stop Pro Tools playback/recording before capturing regions.')
    return call(command, body)
  }
  const original = await checked('GetTimelineSelection', { location_type: 'TLType_Samples' })
  const edit = await checked('GetEditSelection', { location_type: 'TLType_Samples' })
  if (!/^\d+$/.test(edit.in_time ?? '') || !/^\d+$/.test(edit.out_time ?? '')
    || !Number.isSafeInteger(Number(edit.out_time)) || Number(edit.out_time) <= Number(edit.in_time))
    throw new Error('Select at least one region with a nonempty edit selection.')
  const baseline = parseProToolsTimeline((await checked('ExportSessionInfoAsText', timelineExportRequest)).session_info)
  const existing = new Map(session.tracks.map(t => [t.id, t]))
  await mkdir(directory, { recursive: true, mode: 0o700 })
  await journal.record(receipt)
  let failure, cleanupFailure, copyAttempted = false
  try {
    copyAttempted = true
    await checked('Copy')
    // Pro Tools maps copied tracks to selected destinations in order, without gap tracks.
    for (const source of sources) {
      const result = await checked('CreateNewTracks', { number_of_tracks: 1,
        track_name: `Orb Capture ${randomUUID().slice(0, 12)}`, track_format: source.format,
        track_type: 'TType_Audio', track_timebase: 'TTimebase_Samples', insertion_point_position: 'TIPoint_Last' })
      const ids = result.created_track_ids, names = result.created_track_names
      if (!Array.isArray(ids) || ids.length !== 1 || !names?.[0] || !ids[0] || existing.has(ids[0])
        || receipt.temporary.some(t => t.id === ids[0])) throw new Error('Could not identify the temporary capture track.')
      receipt.temporary.push({ id: ids[0], name: names[0], source: { id: source.id, name: source.name, index: source.index },
        channels: source.format === 'TFormat_Mono' ? 1 : 2 })
      await journal.record(receipt)
    }
    await checked('SelectTracksByName', { track_names: receipt.temporary.map(t => t.name), selection_mode: 'SMode_Replace' })
    await checked('SetTimelineSelection', { location_type: 'TLType_Samples', in_time: edit.in_time, out_time: edit.in_time })
    await checked('Paste')
    const timeline = parseProToolsTimeline((await checked('ExportSessionInfoAsText', timelineExportRequest)).session_info)
    await checked('SetTimelineSelection', { location_type: 'TLType_Samples', in_time: edit.in_time, out_time: edit.out_time })
    const media = { file_locations: [], pagination_response: { total: 0 } }
    for (;;) {
      const page = await checked('GetFileLocation', { file_filters: ['FLTFilter_SelectedClipsTimeline'],
        pagination_request: { offset: media.file_locations.length, limit: 100 } })
      const files = page.file_locations ?? []
      media.file_locations.push(...files)
      media.pagination_response.total = media.file_locations.length
      if (files.length < 100) break
      if (!files.length || media.file_locations.length > 10000) throw new Error('Incomplete selected-media list.')
    }
    if (!media.file_locations.length || media.file_locations.some(f => !f.info?.is_online || !f.file_id))
      throw new Error('Selected source media is offline or missing.')
    await writeFile(join(directory, 'selection.json'), JSON.stringify({ ...receipt, edit, media }))
    await writeFile(join(directory, 'timeline.json'), JSON.stringify(timeline))
    await checked('ExportSelectedTracksAsAAFOMF', { file_type: 'EAAFFType_WAV', bit_depth: 'AAFFBDepth_Bit24',
      copy_option: 'COption_LinkFromSourceMedia', enforce_media_composer_compatibility: false,
      quantize_edits_to_frame_boundaries: false, export_stereo_as_multichannel: true,
      container_file_name: 'Orb-selection', container_file_location: directory + '/',
      asset_file_location: directory + '/', sequence_name: 'Orb region transfer' })
  } catch (error) { failure = error }
  finally {
    try {
      if (receipt.temporary.length) {
        const current = await inspectSession(call)
        if (current.instanceId !== session.instanceId || receipt.temporary.some(t =>
          !current.tracks.some(c => c.id === t.id && c.name === t.name)))
          throw new Error('Temporary track identity changed; inspect the capture journal before cleanup.')
        const deleted = await checked('DeleteTracks', { track_ids: receipt.temporary.map(t => t.id) })
        if (deleted.success_count !== receipt.temporary.length) throw new Error('Temporary capture tracks were not all removed.')
      }
      if (copyAttempted) {
        await checked('SelectTracksByName', { track_names: selected, selection_mode: 'SMode_Replace' })
        await checked('SetTimelineSelection', { location_type: 'TLType_Samples', in_time: original.in_time,
          out_time: original.out_time, play_start_marker_time: original.play_start_marker_time })
      }
      const current = await inspectSession(call)
      if (current.instanceId !== session.instanceId || current.tracks.length !== existing.size
        || current.tracks.some(t => !existing.has(t.id) || existing.get(t.id).name !== t.name))
        throw new Error('Original track identities changed during capture.')
      const after = parseProToolsTimeline((await checked('ExportSessionInfoAsText', timelineExportRequest)).session_info)
      if (JSON.stringify(after) !== JSON.stringify(baseline)) throw new Error('Original timeline changed during capture.')
    } catch (error) { cleanupFailure = error }
    receipt.status = failure || cleanupFailure ? 'incomplete' : 'captured'
    receipt.error = [failure?.message, cleanupFailure?.message].filter(Boolean).join('; ')
    await journal.record(receipt)
  }
  if (failure || cleanupFailure) throw new Error(`${receipt.error} Capture journal: ${directory}`)
  return { aaf: join(directory, 'Orb-selection.aaf'), capture: join(directory, 'selection.json'),
    timeline: join(directory, 'timeline.json'), receipt }
}
