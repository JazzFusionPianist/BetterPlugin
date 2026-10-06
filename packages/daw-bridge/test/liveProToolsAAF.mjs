// Export only a named Orb QA track; probe whether AAF obeys a partial edit selection.
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { connectProTools, inspectSession } from '../src/ptsl.mjs'
const directory = process.argv[2]
if (!directory) throw new Error('Pass a successful Orb live-test artifact directory.')
const receipt = JSON.parse(await readFile(join(directory, 'receipt.json'), 'utf8'))
if (receipt.status !== 'complete') throw new Error('Use a completed test.')
const target = receipt.tracks[0]
if (!target.name.startsWith('Orb QA ')) throw new Error('Not a synthetic test track.')
const output = process.argv[3] || join(directory, 'aaf-selection-probe')
await mkdir(output, { recursive: true })
const client = connectProTools(process.env.ORB_PTSL_SDK)
let original, selected
async function checked(command, body) {
  if ((await client.call('GetSessionIDs')).instance_id !== receipt.sessionId
    || (await client.call('GetSessionName')).session_name !== 'new test') throw new Error('Test session changed.')
  return client.call(command, body)
}
try {
  await client.register()
  const session = await inspectSession(client.call)
  if (!session.tracks.some(t => t.id === target.id && t.name === target.name)) throw new Error('QA track is missing.')
  selected = session.tracks.filter(t => t.track_attributes?.is_selected === 'TAState_SetExplicitly').map(t => t.name)
  original = await checked('GetTimelineSelection', { location_type: 'TLType_Samples' })
  await checked('SelectTracksByName', { track_names: [target.name], selection_mode: 'SMode_Replace' })
  await checked('SetTimelineSelection', { location_type: 'TLType_Samples', in_time: '48137', out_time: '64137' })
  const edit = await checked('GetEditSelection', { location_type: 'TLType_Samples' })
  if (edit.in_time !== '48137' || edit.out_time !== '64137') throw new Error('The test edit selection was not applied.')
  await writeFile(join(output, 'selection.json'), JSON.stringify({ target, edit }, null, 2))
  const result = await checked('ExportSelectedTracksAsAAFOMF', {
    file_type: 'EAAFFType_WAV', bit_depth: 'AAFFBDepth_Bit16', copy_option: 'COption_CopyFromSourceMedia',
    enforce_media_composer_compatibility: false, quantize_edits_to_frame_boundaries: false,
    export_stereo_as_multichannel: true, container_file_name: 'Orb-selection',
    container_file_location: output + '/', asset_file_location: output + '/', sequence_name: 'Orb selection qualification',
  })
  console.log(JSON.stringify({ output, result }, null, 2))
} finally {
  try {
    if (original && selected) {
      await checked('SelectTracksByName', { track_names: selected, selection_mode: 'SMode_Replace' })
      await checked('SetTimelineSelection', { location_type: 'TLType_Samples',
        in_time: original.in_time, out_time: original.out_time, play_start_marker_time: original.play_start_marker_time })
    }
  } finally { client.close() }
}
