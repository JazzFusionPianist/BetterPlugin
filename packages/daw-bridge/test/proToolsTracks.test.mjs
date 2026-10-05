import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inspectProToolsTracks, exportProToolsTracks, probeWave } from '../src/proToolsTracks.mjs'
import { unpackRegionArchive } from '../../core/lib/regionArchive.ts'

function wav(frames = 96000) {
  const b = Buffer.alloc(44 + frames * 4)
  b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22); b.writeUInt32LE(48000, 24); b.writeUInt32LE(192000, 28)
  b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(frames * 4, 40)
  return b
}
function fixture({ midi = false, state = 'TransportStopped', duration = 96000 } = {}) {
  const calls = []
  const tracks = [{ id: 'a', name: 'Voice', type: 'TType_Audio', format: 'TFormat_Mono',
    track_attributes: { is_selected: 'TAState_SetExplicitly' } },
  { id: 'b', name: 'Voice', type: 'TType_Audio', format: 'TFormat_Mono' },
  ...(midi ? [{ id: 'm', name: 'Piano', type: 'TType_Instrument', format: 'TFormat_Stereo', track_attributes: { contains_clips: true } }] : [])]
  const call = async (command, body) => {
    calls.push({ command, body })
    switch (command) {
      case 'GetSessionIDs': return { instance_id: 'session' }
      case 'GetSessionSampleRate': return { sample_rate: 'SR_48000' }
      case 'GetTrackList': return { track_list: tracks }
      case 'GetTimelineSelection': return { in_time: '0', out_time: '96000' }
      case 'GetSessionStartTime': return { session_start_time: '01:00:00:00' }
      case 'GetTimeAsType': return { converted_location: { location: '0' } }
      case 'GetSessionName': return { session_name: 'Test' }
      case 'GetTransportState': return { current_setting: 'TState_' + state }
      case 'ExportSessionInfoAsText': return { session_info: 'SAMPLE RATE:\t48000\nTRACK NAME:\tVoice\nCHANNEL\tEVENT\tCLIP NAME\tSTART TIME\tEND TIME\tDURATION\tSTATE\n1\t1\tVoice\t0\t96000\t96000\tUnmuted\n' }
      case 'BounceTrack': {
        assert.equal(body.offline_bounce, 'TBool_True')
        assert.equal(body.location_info.import_after_bounce, 'TBool_False')
        assert.equal(body.in_location.location, '0'); assert.equal(body.out_location.location, '96000')
        const path = join(body.location_info.directory, 'audio.wav')
        await writeFile(path, wav(duration)); return { file_paths: [path] }
      }
      default: throw new Error('Unexpected mutation: ' + command)
    }
  }
  return { call, calls }
}
const options = { trackIds: ['a', 'b'], sampleRate: 48000, range: 'entire', start: 0, end: 96000 }
const directory = () => mkdtemp(join(tmpdir(), 'slur-track-test-'))

test('track inspection uses clip end, not the default 24-hour session length', async () => {
  const { call, calls } = fixture()
  const result = await inspectProToolsTracks(call)
  assert.deepEqual(result.ranges.entire, { start: 0, end: 96000 })
  assert.equal(result.tracks[0].selected, true)
  assert.ok(!calls.some(c => c.command === 'GetSessionLength'))
})
test('MIDI content requires an explicit timeline range rather than a guessed song end', async () => {
  const result = await inspectProToolsTracks(fixture({ midi: true }).call)
  assert.equal(result.ranges.entire, null)
  assert.match(result.entireError, /MIDI/)
  assert.ok(result.ranges.selection)
})
test('multiple tracks with duplicate names retain IDs, positions and equal lengths without session edits', async () => {
  const { call, calls } = fixture(), dir = await directory()
  await exportProToolsTracks({ call, sessionId: 'session', options, directory: dir })
  const { bundle } = unpackRegionArchive(await readFile(join(dir, 'selection.orb-regions.zip')))
  assert.deepEqual(bundle.tracks.map(t => t.id), ['a', 'b'])
  assert.equal(bundle.regions.length, 2)
  assert.equal(bundle.assets.length, 1) // identical renders safely share bytes, not track identity
  for (const region of bundle.regions) {
    assert.deepEqual(region.start, { samples: 0, sampleRate: 48000 }); assert.equal(region.lengthFrames, 96000)
  }
  assert.equal(calls.filter(c => c.command === 'BounceTrack').length, 2)
  assert.ok(!calls.some(c => /^(Set|Select|Create|Delete|Copy|Paste)/.test(c.command)))
})
test('changed session, range, missing IDs and duplicate selections fail before bouncing', async () => {
  for (const patch of [{ sessionId: 'other' }, { options: { ...options, end: 5 } },
    { options: { ...options, trackIds: ['missing'] } }, { options: { ...options, trackIds: ['a', 'a'] } }]) {
    const { call, calls } = fixture()
    await assert.rejects(exportProToolsTracks({ call, sessionId: 'session', options, directory: await directory(), ...patch }))
    assert.ok(!calls.some(c => c.command === 'BounceTrack'))
  }
})
test('playback and recording block export', async () => {
  for (const state of ['TransportPlaying', 'TransportRecording']) {
    const { call, calls } = fixture({ state })
    await assert.rejects(exportProToolsTracks({ call, sessionId: 'session', options, directory: await directory() }), /Stop playback/)
    assert.ok(!calls.some(c => c.command === 'BounceTrack'))
  }
})
test('wrong bounce duration is journaled and never attached', async () => {
  const dir = await directory()
  await assert.rejects(exportProToolsTracks({ call: fixture({ duration: 48000 }).call, sessionId: 'session', options, directory: dir }), /duration/)
  assert.equal(JSON.parse(await readFile(join(dir, 'export.json'))).status, 'failed')
  await assert.rejects(readFile(join(dir, 'selection.orb-regions.zip')), /ENOENT/)
})
test('WAV validation rejects truncated files and reads the actual render format', () => {
  assert.equal(probeWave(wav()).frames, 96000)
  assert.equal(probeWave(wav()).bits, 16)
  assert.throws(() => probeWave(wav().subarray(0, 50)), /Truncated/)
})
