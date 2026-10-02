// Opt-in: synthetic QA tracks only, in the user-designated "new test" session.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
import { connectProTools, inspectSession } from '../src/ptsl.mjs'
import { parseProToolsTimeline, timelineExportRequest } from '../src/proToolsTimeline.mjs'
import { stageArchive } from '../src/archive.mjs'

const source = process.argv[2]
if (!source) throw new Error('Pass the completed 48 kHz synthetic QA directory.')
const receipt = JSON.parse(await readFile(join(source, 'receipt.json'), 'utf8'))
const fixture = JSON.parse(await readFile(join(source, 'bundle.json'), 'utf8'))
if (receipt.status !== 'complete' || fixture.regions.length !== 4
  || fixture.assets.some(a => a.sampleRate !== 48000) || receipt.tracks.some(t => !t.name.startsWith('Orb QA ')))
  throw new Error('Only a completed 48 kHz synthetic QA fixture is accepted.')
const runtime = join(homedir(), 'Library', 'Application Support', 'Orb', 'DawBridge')
const output = join(homedir(), '.cache', 'orb', 'native-tests', randomUUID())
await mkdir(output, { recursive: true, mode: 0o700 })
const run = promisify(execFile), client = connectProTools(process.env.ORB_PTSL_SDK)
let before, original, selected, gap
async function checked(command, body) {
  if ((await client.call('GetSessionName')).session_name !== 'new test'
    || (await client.call('GetSessionIDs')).instance_id !== receipt.sessionId
    || !(await client.call('GetTransportState')).current_setting.endsWith('TransportStopped'))
    throw new Error('The user-approved test session changed.')
  return client.call(command, body)
}
async function native(operation, extra = {}) {
  const directory = join(output, operation + '-' + randomUUID())
  await mkdir(directory, { mode: 0o700 })
  await writeFile(join(directory, 'request.json'), JSON.stringify({ operation, ...extra }), { mode: 0o600 })
  if (operation === 'import') await writeFile(join(directory, 'input.orb-regions.zip'),
    await readFile(join(output, 'selection.orb-regions.zip')), { mode: 0o600 })
  try { await run(join(runtime, 'node'), [join(runtime, 'src', 'native.cjs'), directory], { timeout: 240000 }) }
  catch (error) {
    if (error.killed || error.code === 'ENOENT') throw error
    try { await readFile(join(directory, 'response.json')) }
    catch { throw new Error(`Native runtime failed: ${error.stderr || error.message}`) }
  }
  const response = JSON.parse(await readFile(join(directory, 'response.json'), 'utf8'))
  return { response, directory }
}
try {
  await client.register()
  before = await inspectSession(checked)
  selected = before.tracks.filter(t => t.track_attributes?.is_selected !== 'TAState_None'
    && t.track_attributes?.is_selected).map(t => t.name)
  original = await checked('GetTimelineSelection', { location_type: 'TLType_Samples' })
  if (process.argv.includes('--gap')) {
    const result = await checked('CreateNewTracks', { number_of_tracks: 1,
      track_name: `Orb QA Gap ${randomUUID().slice(0, 8)}`, track_format: 'TFormat_Stereo',
      track_type: 'TType_Audio', track_timebase: 'TTimebase_Samples',
      insertion_point_position: 'TIPoint_Before', insertion_point_track_name: receipt.tracks[1].name })
    assert.equal(result.created_track_ids?.length, 1)
    gap = { id: result.created_track_ids[0], name: result.created_track_names[0] }
  }
  for (const track of receipt.tracks) assert.ok(before.tracks.some(t => t.id === track.id && t.name === track.name))
  const baseline = parseProToolsTimeline((await checked('ExportSessionInfoAsText', timelineExportRequest)).session_info)
  const inspected = await native('inspect')
  assert.equal(inspected.response.ok, true, inspected.response.error)
  assert.equal(inspected.response.sessionId, receipt.sessionId)
  await checked('SelectTracksByName', { track_names: receipt.tracks.map(t => t.name), selection_mode: 'SMode_Replace' })
  await checked('SetTimelineSelection', { location_type: 'TLType_Samples', in_time: '48137', out_time: '112274' })
  const capture = await native('capture', { sessionId: receipt.sessionId })
  assert.equal(capture.response.ok, true, capture.response.error)
  await writeFile(join(output, 'selection.orb-regions.zip'),
    await readFile(join(capture.directory, 'selection.orb-regions.zip')), { mode: 0o600 })
  const { bundle } = await stageArchive(join(output, 'selection.orb-regions.zip'), join(output, 'cache'))
  assert.equal(bundle.regions.length, 4)
  assert.equal(bundle.tracks.length, 2)
  for (const track of bundle.tracks) {
    const priorTrack = fixture.tracks.find(t => t.name === track.name)
    assert.ok(priorTrack)
    for (const region of bundle.regions.filter(r => r.trackId === track.id)) {
      const prior = fixture.regions.find(r => r.trackId === priorTrack.id && r.name === region.name)
      assert.ok(prior)
      for (const key of ['start', 'offsetFrames', 'lengthFrames']) assert.deepEqual(region[key], prior[key])
    }
  }
  assert.deepEqual(parseProToolsTimeline((await checked('ExportSessionInfoAsText', timelineExportRequest)).session_info), baseline)
  const imported = await native('import', { sessionId: receipt.sessionId })
  assert.equal(imported.response.ok, true, imported.response.error)
  assert.equal(imported.response.status, 'complete')
  const after = await inspectSession(checked)
  assert.ok(before.tracks.every(t => after.tracks.some(a => a.id === t.id && a.name === t.name)))
  const added = new Set(imported.response.tracks.map(t => {
    const host = after.tracks.find(a => a.id === t.id)
    return host.name + (host.format === 'TFormat_Stereo' ? ' (Stereo)' : '')
  }))
  const timeline = parseProToolsTimeline((await checked('ExportSessionInfoAsText', timelineExportRequest)).session_info)
  assert.deepEqual(timeline.tracks.filter(t => !added.has(t.name)), baseline.tracks)
  const duplicate = await native('import', { sessionId: receipt.sessionId })
  assert.equal(duplicate.response.ok, false)
  assert.match(duplicate.response.error, /already imported or attempted/)
  await writeFile(join(output, 'result.json'), JSON.stringify({ capture: capture.response, import: imported.response,
    duplicate: duplicate.response, existingTimelinePreserved: true }), { mode: 0o600 })
  console.log(JSON.stringify({ output, verified: true, regions: 4, tracks: 2, duplicateBlocked: true }))
} finally {
  try {
    if (gap) {
      const current = await inspectSession(checked)
      assert.ok(current.tracks.some(t => t.id === gap.id && t.name === gap.name))
      const deleted = await checked('DeleteTracks', { track_ids: [gap.id] })
      assert.equal(deleted.success_count, 1)
    }
    if (original && selected) {
      await checked('SelectTracksByName', { track_names: selected, selection_mode: 'SMode_Replace' })
      await checked('SetTimelineSelection', { location_type: 'TLType_Samples', in_time: original.in_time,
        out_time: original.out_time, play_start_marker_time: original.play_start_marker_time })
    }
  } finally { client.close() }
}
