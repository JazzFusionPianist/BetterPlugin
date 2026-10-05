// Opt-in integration test. Only touches the selection of this synthetic QA session.
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { connectProTools, inspectSession } from '../src/ptsl.mjs'
import { inspectProToolsTracks, exportProToolsTracks } from '../src/proToolsTracks.mjs'
import { timelineExportRequest } from '../src/proToolsTimeline.mjs'
import { readRegionArchive } from '../src/archive.mjs'

const client = connectProTools(process.env.ORB_PTSL_SDK)
let original, sessionId
async function checked(command, body) {
  if ((await client.call('GetSessionName')).session_name !== 'Slur Chat Region Transfer Test 2026-09-22'
    || (sessionId && (await client.call('GetSessionIDs')).instance_id !== sessionId)) throw new Error('Not the approved synthetic test session.')
  return client.call(command, body)
}
try {
  await client.register()
  const before = await inspectSession(checked); sessionId = before.instanceId
  assert.equal(before.sampleRate, 48000)
  const source = before.tracks.find(t => t.name === 'Slur Chat drag test')
  assert.ok(source)
  original = await checked('GetTimelineSelection', { location_type: 'TLType_Samples' })
  const timeline = await checked('ExportSessionInfoAsText', timelineExportRequest)
  const directory = await mkdtemp(join(tmpdir(), 'slur-track-live-'))
  const receipts = []
  for (const mode of ['entire', 'selection']) {
    if (mode === 'selection') await checked('SetTimelineSelection', { location_type: 'TLType_Samples', in_time: '24000', out_time: '72000' })
    const snapshot = await inspectProToolsTracks(checked), range = snapshot.ranges[mode]
    const output = join(directory, mode)
    await exportProToolsTracks({ call: checked, sessionId, options: { trackIds: [source.id],
      sampleRate: 48000, range: mode, ...range }, directory: output })
    const { bundle } = readRegionArchive(await readFile(join(output, 'selection.orb-regions.zip')))
    assert.equal(bundle.tracks[0].name, source.name)
    assert.deepEqual(bundle.regions[0].start, { samples: range.start, sampleRate: 48000 })
    assert.equal(bundle.assets[0].frames, range.end - range.start)
    receipts.push({ mode, range, frames: bundle.assets[0].frames, sourceTrackId: source.id })
  }
  assert.deepEqual(await inspectSession(checked), before)
  assert.deepEqual(await checked('ExportSessionInfoAsText', timelineExportRequest), timeline)
  await writeFile(join(directory, 'verification.json'), JSON.stringify({ receipts, originalTimelinePreserved: true }, null, 2))
  console.log(JSON.stringify({ directory, receipts, originalTimelinePreserved: true }))
} finally {
  try { if (original) await checked('SetTimelineSelection', { location_type: 'TLType_Samples', in_time: original.in_time,
    out_time: original.out_time, play_start_marker_time: original.play_start_marker_time }) }
  finally { client.close() }
}
