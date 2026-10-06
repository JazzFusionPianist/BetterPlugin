// Opt-in qualification only: Copy changes the Pro Tools edit clipboard.
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { connectProTools, inspectSession } from '../src/ptsl.mjs'
import { timelineExportRequest, parseProToolsTimeline } from '../src/proToolsTimeline.mjs'

const directory = process.argv[2]
const output = process.argv[3]
if (!directory || !output) throw new Error('Pass a completed live-test directory and a new visible export directory.')
const receipt = JSON.parse(await readFile(join(directory, 'receipt.json'), 'utf8'))
if (receipt.status !== 'complete') throw new Error('Use a completed synthetic test.')
const fixture = JSON.parse(await readFile(join(directory, 'bundle.json'), 'utf8'))
if (fixture.assets.some(a => a.sampleRate !== 48000) || fixture.regions.length !== 4)
  throw new Error('This selection probe requires the 48 kHz, four-region synthetic fixture.')
const target = receipt.tracks[0]
if (!target.name.startsWith('Orb QA ')) throw new Error('Not a synthetic test track.')
const targets = process.argv[4] === '--multi' ? receipt.tracks : [target]
if (targets.some(t => !t.name.startsWith('Orb QA '))) throw new Error('Not synthetic test tracks.')
const end = targets.length > 1 ? '112274' : '64137'
await mkdir(output, { recursive: false, mode: 0o700 })
const client = connectProTools(process.env.ORB_PTSL_SDK)
const trace = [], created = []
let original, selected, baseline
async function checked(command, body) {
  if ((await client.call('GetSessionIDs')).instance_id !== receipt.sessionId
    || (await client.call('GetSessionName')).session_name !== 'new test'
    || !(await client.call('GetTransportState')).current_setting.endsWith('TransportStopped'))
    throw new Error('Approved test session must remain open and stopped.')
  const result = await client.call(command, body)
  trace.push({ command, body, result })
  return result
}
try {
  await client.register()
  const session = await inspectSession(client.call)
  if (!session.tracks.some(t => t.id === target.id && t.name === target.name)) throw new Error('QA track is missing.')
  baseline = parseProToolsTimeline((await checked('ExportSessionInfoAsText', timelineExportRequest)).session_info)
  selected = session.tracks.filter(t => t.track_attributes?.is_selected === 'TAState_SetExplicitly').map(t => t.name)
  original = await checked('GetTimelineSelection', { location_type: 'TLType_Samples' })
  await checked('SelectTracksByName', { track_names: targets.map(t => t.name), selection_mode: 'SMode_Replace' })
  await checked('SetTimelineSelection', { location_type: 'TLType_Samples', in_time: '48137', out_time: end })
  const edit = await checked('GetEditSelection', { location_type: 'TLType_Samples' })
  if (edit.in_time !== '48137' || edit.out_time !== end) throw new Error('Edit selection was not applied.')
  await checked('Copy')
  for (const source of targets) {
    const sourceTrack = session.tracks.find(t => t.id === source.id && t.name === source.name)
    if (!sourceTrack || !['TFormat_Mono', 'TFormat_Stereo'].includes(sourceTrack.format))
      throw new Error('QA mono/stereo source track is missing.')
    const result = await checked('CreateNewTracks', { number_of_tracks: 1,
      track_name: `Orb Capture QA ${randomUUID().slice(0, 8)}`, track_format: sourceTrack.format,
      track_type: 'TType_Audio', track_timebase: 'TTimebase_Samples', insertion_point_position: 'TIPoint_Last' })
    for (const [i, id] of (result.created_track_ids || []).entries()) {
      if (session.tracks.some(t => t.id === id)) throw new Error('Host returned an existing track ID.')
      created.push({ id, name: result.created_track_names[i], source,
        channels: sourceTrack.format === 'TFormat_Mono' ? 1 : 2 })
    }
  }
  if (created.length !== targets.length) throw new Error('Temporary track count mismatch.')
  await checked('SelectTracksByName', { track_names: created.map(t => t.name), selection_mode: 'SMode_Replace' })
  await checked('SetTimelineSelection', { location_type: 'TLType_Samples', in_time: edit.in_time, out_time: edit.in_time })
  await checked('Paste')
  const media = await checked('GetFileLocation', { file_filters: ['FLTFilter_SelectedClipsTimeline'],
    pagination_request: { offset: 0, limit: 100 } })
  const report = await checked('ExportSessionInfoAsText', timelineExportRequest)
  await writeFile(join(output, 'pasted-timeline.json'), JSON.stringify(parseProToolsTimeline(report.session_info), null, 2))
  await writeFile(join(output, 'selection.json'), JSON.stringify({ sessionId: receipt.sessionId, target, temporary: created, edit, media }, null, 2))
  await checked('ExportSelectedTracksAsAAFOMF', {
    file_type: 'EAAFFType_WAV', bit_depth: 'AAFFBDepth_Bit16', copy_option: 'COption_LinkFromSourceMedia',
    enforce_media_composer_compatibility: false, quantize_edits_to_frame_boundaries: false,
    export_stereo_as_multichannel: true, container_file_name: 'Orb-copied-selection',
    container_file_location: output + '/', asset_file_location: output + '/', sequence_name: 'Orb copied selection qualification',
  })
  console.log(JSON.stringify({ output, created }, null, 2))
} finally {
  try {
    if (created.length) {
      const current = await inspectSession(client.call)
      if (current.instanceId !== receipt.sessionId || created.some(t => !current.tracks.some(c => c.id === t.id && c.name === t.name)))
        throw new Error('Temporary track identity changed; cleanup requires inspection.')
      await checked('DeleteTracks', { track_ids: created.map(t => t.id) })
    }
    if (original && selected) {
      await checked('SelectTracksByName', { track_names: selected, selection_mode: 'SMode_Replace' })
      await checked('SetTimelineSelection', { location_type: 'TLType_Samples',
        in_time: original.in_time, out_time: original.out_time, play_start_marker_time: original.play_start_marker_time })
    }
    if (baseline) {
      const after = parseProToolsTimeline((await checked('ExportSessionInfoAsText', timelineExportRequest)).session_info)
      if (JSON.stringify(after) !== JSON.stringify(baseline)) throw new Error('Original timeline changed during capture qualification.')
    }
  } finally {
    await writeFile(join(output, 'trace.json'), JSON.stringify(trace, null, 2))
    client.close()
  }
}
