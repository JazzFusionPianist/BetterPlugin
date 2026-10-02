import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { dawprojectFixture } from './dawprojectFixture.mjs'
import { createRegionArchive } from '../../core/lib/regionArchive.ts'
import { probeWave } from '../src/proToolsTracks.mjs'
import { importProToolsRegions } from '../src/proToolsRegions.mjs'
import { unzipSync, zipSync } from 'fflate'

async function setup({ origin = 0, playing = false, failSpot = false, badReadback = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'slur-pt-place-')), directory = join(root, 'job')
  const writes = [], tracks = [], clips = [], events = []
  const call = async (command, body = {}) => {
    if (command === 'GetSessionIDs') return { instance_id: 'qa-session' }
    if (command === 'GetSessionSampleRate') return { sample_rate: 'SRate_48000' }
    if (command === 'GetTrackList') return { track_list: tracks }
    if (command === 'GetTransportState') return { current_setting: playing ? 'TS_TransportPlaying' : 'TS_TransportStopped' }
    if (command === 'GetSessionName') return { session_name: 'Slur Synthetic QA' }
    if (command === 'GetSessionPath') return { session_path: { path: root } }
    if (command === 'GetSessionStartTime') return { session_start_time: '01:00:00:00' }
    if (command === 'GetTimeAsType') return { converted_location: { location: String(origin) } }
    if (command === 'GetClipList') return { clips }
    if (command === 'ExportSessionInfoAsText') return { session_info: 'SAMPLE RATE:\t48000\n' + tracks.map(t =>
      `TRACK NAME:\t${t.name}${t.channels === 2 ? ' (Stereo)' : ''}\nCHANNEL\tEVENT\tCLIP NAME\tSTART TIME\tEND TIME\tDURATION\tSTATE\n` +
      events.filter(e => e.track === t.id).map((e, i) => `${e.channel}\t${i + 1}\t${e.name}\t${e.start + (badReadback ? 1 : 0)}\t${e.start + (badReadback ? 1 : 0) + e.duration}\t${e.duration}\tUnmuted\n`).join('')).join('\n') }
    writes.push({ command, body })
    if (command === 'ImportAudioToClipList') {
      const input = body.file_list[0], b = await readFile(input), w = probeWave(b)
      assert.equal(body.audio_operations, w.sampleRate === 48000 ? 'AOperations_CopyAudio' : 'AOperations_ConvertAudio')
      const frames = Math.round(w.frames * 48000 / w.sampleRate)
      // Mock SRC output shape only; the live-host test is responsible for audio quality.
      const out = Buffer.alloc(44 + frames * w.channels * 2)
      b.copy(out, 0, 0, 44); out.writeUInt32LE(out.length - 8, 4); out.writeUInt32LE(48000, 24)
      out.writeUInt32LE(48000 * w.channels * 2, 28); out.writeUInt32LE(out.length - 44, 40)
      const path = join(root, basename(input)); await writeFile(path, out)
      const ids = Array.from({ length: w.channels }, (_, c) => {
        const clip_id = `clip-${clips.length}`, clip_full_name = basename(input, '.wav') + (w.channels === 2 ? (c ? '.R' : '.L') : '')
        clips.push({ clip_id, clip_full_name, duration: frames }); return clip_id
      })
      return { file_list: [{ original_input_path: input, destination_file_list: [{ file_id: path, file_path: path, clip_id_list: ids }] }] }
    }
    if (command === 'CreateNewTracks') {
      assert.equal(body.track_timebase, 'TTimebase_Samples'); assert.equal(body.insertion_point_position, 'TIPoint_Last')
      const id = `track-${tracks.length}`; tracks.push({ id, name: body.track_name, channels: body.track_format === 'TFormat_Mono' ? 1 : 2 })
      return { created_track_ids: [id], created_track_names: [body.track_name] }
    }
    if (command === 'SpotClipsByID') {
      if (failSpot) throw new Error('lost host response')
      body.src_clips.forEach((id, c) => { const clip = clips.find(v => v.clip_id === id)
        events.push({ track: body.dst_track_id, channel: c + 1, name: clip.clip_full_name,
          start: Number(body.dst_location_data.location.location), duration: clip.duration }) })
      return {}
    }
    throw new Error(`Unexpected command ${command}`)
  }
  const p = await dawprojectFixture()
  const archive = new Uint8Array(await (await createRegionArchive(p)).arrayBuffer())
  return { call, directory, sessionId: 'qa-session', archive, writes, events, p }
}
test('restores repeated trimmed regions on two NEW sample-based tracks, including SRC and time origin', async () => {
  for (const origin of [0, 172800000]) {
    const m = await setup({ origin })
    assert.deepEqual(await importProToolsRegions(m), { importedTracks: 2, importedRegions: 3 })
    assert.deepEqual(m.events.map(e => e.start), [120000, 384001, 72000, 72000].map(n => n + origin))
    assert.deepEqual(m.events.map(e => e.duration), [36000, 36000, 48000, 48000])
    const receipt = JSON.parse(await readFile(join(m.directory, 'region-import.json'), 'utf8'))
    assert.equal(receipt.status, 'complete')
    assert.ok(m.writes.every(w => !/Delete|Undo|Selection|Tempo/.test(w.command)))
  }
})
test('wrong session and playback fail without host writes', async () => {
  const m = await setup(); await assert.rejects(importProToolsRegions({ ...m, sessionId: 'other' }), /session changed/)
  const playing = await setup({ playing: true }); await assert.rejects(importProToolsRegions(playing), /Stop Pro Tools/)
  assert.equal(m.writes.length, 0); assert.equal(playing.writes.length, 0)
})
test('bad hash and overlapping regions fail before importing files', async () => {
  const m = await setup(), entries = unzipSync(m.archive), name = Object.keys(entries).find(k => k.startsWith('audio/'))
  entries[name][entries[name].length - 1] ^= 1
  await assert.rejects(importProToolsRegions({ ...m, archive: zipSync(entries) }), /Damaged audio/)
  m.p.bundle.regions[1].start = m.p.bundle.regions[0].start
  await assert.rejects(importProToolsRegions({ ...m, archive: new Uint8Array(await (await createRegionArchive(m.p)).arrayBuffer()) }), /Overlapping/)
  assert.equal(m.writes.length, 0)
})
test('lost response and mismatched timeline retain an incomplete journal; never Undo', async () => {
  for (const options of [{ failSpot: true }, { badReadback: true }]) {
    const m = await setup(options)
    await assert.rejects(importProToolsRegions(m), e => e.cleanupUncertain === true)
    assert.equal(JSON.parse(await readFile(join(m.directory, 'region-import.json'), 'utf8')).status, 'incomplete')
    assert.ok(m.writes.every(w => !/Delete|Undo/.test(w.command)))
  }
})
