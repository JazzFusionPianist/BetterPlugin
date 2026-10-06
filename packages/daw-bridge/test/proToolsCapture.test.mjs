import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { captureProToolsSelection } from '../src/proToolsCapture.mjs'

function host() {
  const tracks = [0, 1].map(index => ({ id: `source-${index}`, name: `Source ${index}`, index,
    type: 'TType_Audio', format: index ? 'TFormat_Stereo' : 'TFormat_Mono',
    track_attributes: { has_edit_selection: 'TAState_SetExplicitlyAndImplicitly', is_selected: 'TAState_SetExplicitly' } }))
  const calls = [], receipts = []
  let session = 'approved', playing = false, failExport = false, deleted = true
  const call = async (command, body) => {
    calls.push({ command, body })
    switch (command) {
      case 'GetSessionIDs': return { instance_id: session }
      case 'GetSessionSampleRate': return { sample_rate: 'SRate_48000' }
      case 'GetTrackList': return { track_list: tracks, pagination_response: { total: tracks.length } }
      case 'GetTransportState': return { current_setting: playing ? 'TState_TransportRecording' : 'TState_TransportStopped' }
      case 'GetTimelineSelection': return { in_time: '137', out_time: '96137', play_start_marker_time: '137' }
      case 'GetEditSelection': return { in_time: '137', out_time: '96137' }
      case 'ExportSessionInfoAsText': return { session_info: 'SAMPLE RATE:\t48000\n' + tracks.map(t =>
        `TRACK NAME:\t${t.name}${t.format === 'TFormat_Stereo' ? ' (Stereo)' : ''}\nCHANNEL\tEVENT\tCLIP NAME\tSTART TIME\tEND TIME\tDURATION\tSTATE\n`).join('') }
      case 'CreateNewTracks': {
        const id = `temporary-${tracks.length}`
        tracks.push({ id, name: body.track_name, format: body.track_format })
        return { created_track_ids: [id], created_track_names: [body.track_name] }
      }
      case 'GetFileLocation': return { file_locations: [{ file_id: 'original', info: { is_online: true } }],
        pagination_response: { total: 1 } }
      case 'ExportSelectedTracksAsAAFOMF': if (failExport) throw new Error('export failed'); return {}
      case 'DeleteTracks': {
        if (deleted) for (let i = tracks.length - 1; i >= 0; i--)
          if (body.track_ids.includes(tracks[i].id)) tracks.splice(i, 1)
        return { success_count: deleted ? body.track_ids.length : 0 }
      }
      case 'Copy': case 'Paste': case 'SelectTracksByName': case 'SetTimelineSelection': return {}
      default: throw new Error(`Unexpected ${command}`)
    }
  }
  return { call, tracks, calls, receipts, journal: { async record(r) { receipts.push(structuredClone(r)) } },
    changeSession: () => { session = 'other' }, record: () => { playing = true },
    failExport: () => { failExport = true }, failDelete: () => { deleted = false } }
}

async function run(h, override = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'orb-capture-test-'))
  try { return await captureProToolsSelection({ call: h.call, expectedSessionId: 'approved',
    journal: h.journal, directory, ...override }) }
  finally { await rm(directory, { recursive: true, force: true }) }
}

test('capture copies actual selection before any selection change and removes only recorded temporary IDs', async () => {
  const h = host(), result = await run(h)
  assert.equal(result.receipt.status, 'captured')
  const copy = h.calls.findIndex(c => c.command === 'Copy')
  assert.ok(copy >= 0)
  assert.ok(h.calls.slice(0, copy).every(c => c.command.startsWith('Get') || c.command === 'ExportSessionInfoAsText'))
  assert.deepEqual(h.calls.find(c => c.command === 'DeleteTracks').body.track_ids, ['temporary-2', 'temporary-3'])
  assert.deepEqual(h.tracks.map(t => t.id), ['source-0', 'source-1'])
  assert.deepEqual(h.calls.filter(c => c.command === 'SelectTracksByName').at(-1).body.track_names, ['Source 0', 'Source 1'])
  const exportCall = h.calls.find(c => c.command === 'ExportSelectedTracksAsAAFOMF')
  assert.equal(exportCall.body.copy_option, 'COption_LinkFromSourceMedia')
  assert.equal(exportCall.body.quantize_edits_to_frame_boundaries, false)
})

test('recording and source session mismatch refuse capture without any edit', async () => {
  for (const mode of ['record', 'changeSession']) {
    const h = host(); h[mode]()
    await assert.rejects(run(h), /Stop Pro Tools|Source session changed/)
    assert.equal(h.receipts.length, 0)
    assert.ok(!h.calls.some(c => ['Copy', 'CreateNewTracks', 'Paste'].includes(c.command)))
  }
})

test('nonadjacent capture maps only selected sources, in original order, without exporting gap tracks', async () => {
  const h = host(); h.tracks[1].index = 2
  h.tracks.splice(1, 0, { id: 'gap', name: 'Unselected', index: 1, type: 'TType_Aux', format: 'TFormat_Stereo' })
  const result = await run(h)
  assert.equal(result.receipt.status, 'captured')
  assert.deepEqual(result.receipt.temporary.map(t => t.source.id), ['source-0', 'source-1'])
  assert.deepEqual(result.receipt.temporary.map(t => t.source.index), [0, 2])
  const selections = h.calls.filter(c => c.command === 'SelectTracksByName')
  assert.equal(selections[0].body.track_names.length, 2)
  assert.equal(h.calls.filter(c => c.command === 'CreateNewTracks').length, 2)
  assert.equal(h.tracks.length, 3)
})

test('export failure cleans up the recorded tracks and persists incomplete status', async () => {
  const h = host(); h.failExport()
  await assert.rejects(run(h), /export failed/)
  assert.equal(h.receipts.at(-1).status, 'incomplete')
  assert.equal(h.tracks.length, 2)
  assert.ok(h.calls.some(c => c.command === 'DeleteTracks'))
})

test('cleanup failure is never presented as a successful capture', async () => {
  const h = host(); h.failDelete()
  await assert.rejects(run(h), /not all removed/)
  assert.equal(h.receipts.at(-1).status, 'incomplete')
})

test('session change after the journal stops before Copy and forbids deleting in another session', async () => {
  const h = host()
  await assert.rejects(run(h, { journal: { async record(r) {
    await h.journal.record(r)
    if (r.status === 'started') h.changeSession()
  } } }), /session or sample rate changed/)
  assert.ok(!h.calls.some(c => ['Copy', 'CreateNewTracks', 'DeleteTracks'].includes(c.command)))
})
