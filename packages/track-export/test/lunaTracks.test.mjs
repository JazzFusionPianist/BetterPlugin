import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inspectLunaTracks, exportLunaTracks, cropLunaWave } from '../src/lunaTracks.mjs'
import { probeWave } from '../src/proToolsTracks.mjs'
import { unpackRegionArchive } from '../../core/lib/regionArchive.ts'

const sessionId = 'a'.repeat(32), a = 'b'.repeat(32), b = 'c'.repeat(32), click = 'd'.repeat(32)
const directory = () => mkdtemp(join(tmpdir(), 'slur-luna-test-'))
const props = values => ({ data: { properties: Object.fromEntries(Object.entries(values).map(([k,v]) => [k, { value: v }])) } })
function wav(frames) {
  const bytes = Buffer.alloc(44 + frames * 8)
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8); bytes.writeUInt32LE(16, 16)
  bytes.writeUInt16LE(3, 20); bytes.writeUInt16LE(2, 22); bytes.writeUInt32LE(48000, 24); bytes.writeUInt32LE(384000, 28)
  bytes.writeUInt16LE(8, 32); bytes.writeUInt16LE(32, 34); bytes.write('data', 36); bytes.writeUInt32LE(frames * 8, 40)
  return bytes
}
function fixture({ playing = false, offline = true, frames = 96000, terminal = 'completed', cleanupFails = false, rate = 48000 } = {}) {
  const calls = []
  let render, state = 'created', revision = 1
  const call = async (path, body) => {
    calls.push({ path, body })
    if (path === '/sessions') return props({ focused_session: sessionId })
    if (path === '/sample_rate') return { data: { value: rate } }
    if (path === '/sessions/' + sessionId) {
      const response = props({ loaded: true, name: 'LUNA QA', playing, record_enabled: false, render_uid: null, change_count: revision })
      response.data.properties.max_tick = { value: 384000000000, min_sec: { minutes: 0, seconds: 2 } }
      return response
    }
    if (path.endsWith('/contexts/main')) return props({ selection_tracks: [a] })
    if (path.endsWith('/tracks')) return { data: { children: [a,b,click].map(path => ({ path })) } }
    if (path.includes('/tracks/')) return props({ name: path.endsWith(click) ? 'CLICK' : 'Voice', enabled: true,
      track_type: path.endsWith(click) ? 'click' : 'audio', stem_format: 'mono', order: path.endsWith(a) ? 0 : 1 })
    if (path === '/renders/new') {
      assert.equal(body.add_to_session, false); assert.equal(body.real_time, false)
      assert.deepEqual(Object.keys(body.tracks).sort(), [a,b]); assert.deepEqual(body.buses, {})
      render = body
      return { data: { uid: body.uid } }
    }
    if (path === '/renders/start') {
      state = terminal; revision++
      for (const path of Object.values(render.output_paths)) await writeFile(path, wav(frames))
      return { data: null }
    }
    if (path === '/renders/abort') { if (cleanupFails) throw new Error('disconnected'); state = 'aborted'; return { data: null } }
    if (path === '/renders/delete') return { data: null }
    if (path.startsWith('/renders/')) return props({ state, render_is_offline: offline, error: state === 'error' ? 'test render error' : null })
    throw new Error('Unexpected LUNA operation: ' + path)
  }
  return { call, calls }
}
const options = { trackIds: [a,b], range: 'entire', start: 0, end: 96000, sampleRate: 48000 }
test('LUNA discovery keeps duplicate track IDs, excludes internal click, and exposes only verified ranges', async () => {
  const s = await inspectLunaTracks(fixture().call)
  assert.deepEqual(s.tracks.map(t=>t.id), [a,b]); assert.equal(s.tracks[0].selected, true)
  assert.deepEqual(s.ranges, { entire: { start: 0, end: 96000 }, selection: null })
})
test('LUNA offline export preserves duplicate names, actual format and positions without adding tracks', async () => {
  const f = fixture(), dir = await directory()
  assert.equal((await exportLunaTracks({ ...f, sessionId, options, directory: dir })).tracks, 2)
  const archive = await unpackRegionArchive(new Uint8Array(await readFile(join(dir, 'selection.orb-regions.zip'))))
  assert.equal(archive.bundle.source.daw, 'LUNA'); assert.equal(archive.bundle.tracks.length, 2)
  assert.ok(archive.bundle.regions.every(r=>r.start.samples === 0 && r.lengthFrames === 96000))
  assert.ok(f.calls.some(c=>c.path === '/renders/delete'))
})
test('LUNA rejects changed session/range, duplicate IDs and unsupported selection before render creation', async () => {
  for (const patch of [{ sessionId: 'wrong' }, { options: { ...options, end: 1 } }, { options: { ...options, trackIds: [a,a] } }, { options: { ...options, range: 'selection' } }]) {
    const f = fixture()
    await assert.rejects(exportLunaTracks({ ...f, sessionId, options, directory: await directory(), ...patch }))
    assert.ok(!f.calls.some(c=>c.path === '/renders/new'))
  }
})
test('LUNA does not start playback or real-time render', async () => {
  for (const setting of [{ playing: true }, { offline: false }]) {
    const f = fixture(setting)
    await assert.rejects(exportLunaTracks({ ...f, sessionId, options, directory: await directory() }))
    assert.ok(!f.calls.some(c=>c.path === '/renders/start'))
  }
})
test('short or missing LUNA render never becomes an attachment', async () => {
  const f = fixture({ frames: 50 }), dir = await directory()
  await assert.rejects(exportLunaTracks({ ...f, sessionId, options, directory: dir }), /duration/)
  await assert.rejects(readFile(join(dir, 'selection.orb-regions.zip')), /ENOENT/)
})
test('uncertain abort retains lock via cleanupUncertain signal', async () => {
  const f = fixture({ terminal: 'running', cleanupFails: true })
  await assert.rejects(exportLunaTracks({ ...f, sessionId, options, directory: await directory(), maxPolls: 1, poll: async()=>{} }),
    e => e.cleanupUncertain === true)
})
test('invalid LUNA sample rates are never guessed', async () => {
  await assert.rejects(inspectLunaTracks(fixture({ rate: null }).call), /sample rate/)
})
test('render tail blocks are cropped to the visible range without shifting audio', () => {
  const original = wav(96000 + 8192)
  original.writeFloatLE(0.5, 44 + 5000 * 8)
  const cropped = cropLunaWave(original, 96000)
  assert.equal(probeWave(cropped).frames, 96000)
  const start = cropped.indexOf(Buffer.from('data')) + 8
  assert.equal(cropped.readFloatLE(start + 5000 * 8), 0.5)
  assert.throws(() => cropLunaWave(wav(10), 96000), /shorter/)
})
