import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readLunaClip, lunaNanoseconds, importLunaRegions, captureLunaRegions } from '../src/lunaRegions.mjs'
import { createRegionArchive } from '../../core/lib/regionArchive.ts'
import { dawprojectFixture } from './dawprojectFixture.mjs'
import { unzipSync, zipSync } from 'fflate'
const sessionId = 'a'.repeat(32), clipId = 'b'.repeat(32), track = { id: 'c'.repeat(32), name: 'Track', channels: 1 }
function info() {
  return { track_uid: track.id, clip_type: 'audio', name: 'Clip', sample_rate: 48000, start: 10, stop: 20,
    compiled_clips: [{ clip_uid: clipId, compiled_start: 10, compiled_stop: 20, full_start: 10, full_stop: 20,
      full_start_sample: 120000, full_length_samples: 36000, source_start: 500000000, source_stop: 1250000000,
      has_tce: false, has_rendering: false, has_fade_in: false, has_fade_out: false, ara_is_modified: false,
      looping: false, mute: false, gain: 0, pitch: 1,
      source_info: { stem_format: 'mono', sample_rate: 48000, format: 'wav', length_samples: 96000, size: 192044, path: '/synthetic.wav' } }] }
}
test('LUNA uses edited sample positions and source trims, never the transport', () => {
  const r = readLunaClip(info(), clipId, track)
  assert.equal(r.start, 120000); assert.equal(r.offsetFrames, 24000); assert.equal(r.lengthFrames, 36000)
  for (const key of ['has_tce', 'has_fade_in', 'has_fade_out', 'ara_is_modified', 'looping', 'mute']) {
    const i = info(); i.compiled_clips[0][key] = true; assert.throws(() => readLunaClip(i, clipId, track))
  }
  for (const [key, value] of [['gain', 1], ['pitch', 2], ['compiled_stop', 19], ['source_stop', 10000000000]]) {
    const i = info(); i.compiled_clips[0][key] = value; assert.throws(() => readLunaClip(i, clipId, track))
  }
  assert.throws(() => readLunaClip(info(), clipId, { ...track, id: 'd'.repeat(32) }))
})
test('nanosecond conversion keeps sample precision and rejects unsafe times', () => {
  for (const rate of [44100, 48000, 96000, 192000]) for (const frames of [0, 1, 384001, 200000001])
    assert.equal(Math.round(lunaNanoseconds(frames, rate) * rate / 1e9), frames)
  for (const n of [-1, NaN, Infinity, 1.1, Number.MAX_SAFE_INTEGER]) assert.throws(() => lunaNanoseconds(n, 48000))
})
test('derived sample-rate cache is distinct from gain/stretch rendering', () => {
  const i = info(), c = i.compiled_clips[0]
  c.has_rendering = true
  assert.throws(() => readLunaClip(i, clipId, track))
  c.source_info.sample_rate = 44100; c.source_info.length_samples = 88200
  c.render_source_info = { sample_rate: 48000, stem_format: 'mono', length_samples: 96000 }
  c.flattened_warps = [{ tce_ratio: 1 }]
  assert.equal(readLunaClip(i, clipId, track).offsetFrames, 22050)
  c.flattened_warps[0].tce_ratio = 2
  assert.throws(() => readLunaClip(i, clipId, track))
})
function mockSession({ mutate, playing = false } = {}) {
  const writes = []
  const call = async (path, body) => {
    if (path === '/sessions') return { data: { properties: { focused_session: { value: sessionId } } } }
    if (path === '/sample_rate') return { data: { value: 48000 } }
    if (path === '/sessions/' + sessionId) return { data: { properties: Object.fromEntries(Object.entries({
      loaded: true, playing, record_enabled: false, session_package_uid: 'e'.repeat(32), session_package_path: '/synthetic', name: 'test', change_count: 1,
    }).map(([key, value]) => [key, { value }])) } }
    if (path.endsWith('/tracks')) return { data: { children: [] } }
    if (body !== undefined) { writes.push({ path, body }); if (mutate) return mutate(path, body) }
    throw new Error('Unexpected command: ' + path)
  }
  return { call, writes }
}
test('changed session, playback and stale capture revision fail before mutations', async () => {
  const p = await dawprojectFixture(), archive = new Uint8Array(await (await createRegionArchive(p)).arrayBuffer())
  const directory = await mkdtemp(join(tmpdir(), 'slur-luna-safety-')), m = mockSession()
  await assert.rejects(importLunaRegions({ ...m, sessionId: 'f'.repeat(32), archive, directory }), /session changed/)
  const playing = mockSession({ playing: true })
  await assert.rejects(importLunaRegions({ ...playing, sessionId, archive, directory }), /stop playback/)
  await assert.rejects(captureLunaRegions({ ...m, sessionId, options: { regionIds: [clipId], revision: 'stale' }, directory }), /changed/)
  assert.equal(m.writes.length, 0); assert.equal(playing.writes.length, 0)
})
test('damaged media and overlapping regions are rejected before host writes', async () => {
  const p = await dawprojectFixture(), m = mockSession(), directory = await mkdtemp(join(tmpdir(), 'slur-luna-preflight-'))
  p.bundle.regions[1].start = p.bundle.regions[0].start
  const archive = new Uint8Array(await (await createRegionArchive(p)).arrayBuffer())
  await assert.rejects(importLunaRegions({ ...m, sessionId, archive, directory }), /Overlapping/)
  const entries = unzipSync(archive), audio = Object.keys(entries).find(k => k.startsWith('audio/'))
  entries[audio][entries[audio].length - 1] ^= 1
  await assert.rejects(importLunaRegions({ ...m, sessionId, archive: zipSync(entries), directory }), /Damaged audio/)
  assert.equal(m.writes.length, 0)
})
test('uncertain host edit records a journal and never blindly undoes user edits', async () => {
  const p = await dawprojectFixture(), archive = new Uint8Array(await (await createRegionArchive(p)).arrayBuffer())
  const directory = await mkdtemp(join(tmpdir(), 'slur-luna-interrupted-'))
  const m = mockSession({ mutate: path => {
    if (path === '/workspace/import_file') return { data: { uid: 'f'.repeat(32) } }
    throw new Error('lost response')
  } })
  await assert.rejects(importLunaRegions({ ...m, sessionId, archive, directory }), e => e.cleanupUncertain === true)
  const journal = JSON.parse(await readFile(join(directory, 'region-import.json'), 'utf8'))
  assert.equal(journal.status, 'incomplete'); assert.equal(journal.tracks.length, 1)
  assert.ok(m.writes.every(c => !/undo|delete|abort/.test(c.path)))
})
