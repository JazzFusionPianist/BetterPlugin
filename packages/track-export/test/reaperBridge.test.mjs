import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync, renameSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { unpackRegionArchive } from '../../core/lib/regionArchive.ts'

// Synthetic 16-bit PCM WAV whose sample value encodes its frame index.
function indexWave(frames, rate = 44100, channels = 1) {
  const b = Buffer.alloc(44 + frames * channels * 2)
  b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20); b.writeUInt16LE(channels, 22); b.writeUInt32LE(rate, 24)
  b.writeUInt32LE(rate * channels * 2, 28); b.writeUInt16LE(channels * 2, 32); b.writeUInt16LE(16, 34)
  b.write('data', 36); b.writeUInt32LE(frames * channels * 2, 40)
  for (let i = 0; i < frames; i++) for (let c = 0; c < channels; c++) b.writeInt16LE((i % 30000) - 15000, 44 + (i * channels + c) * 2)
  return b
}

// Answers request-*.json like "Slur REAPER Bridge.lua" (same file protocol).
function fakeBridge(root, handlers) {
  mkdirSync(root, { recursive: true })
  const beat = () => writeFileSync(join(root, 'status.json'), JSON.stringify({ version: 1, heartbeatMs: Date.now() }))
  beat()
  const timer = setInterval(() => {
    beat()
    for (const name of readdirSync(root)) {
      const m = /^request-([\w-]+)\.json$/.exec(name)
      if (!m) continue
      const req = JSON.parse(readFileSync(join(root, name), 'utf8')); rmSync(join(root, name))
      let body
      try { body = { ok: true, ...handlers[req.command](req) } } catch (e) { body = { ok: false, error: e.message } }
      writeFileSync(join(root, `.r-${m[1]}`), JSON.stringify(body)); renameSync(join(root, `.r-${m[1]}`), join(root, `response-${m[1]}.json`))
    }
  }, 10)
  return () => clearInterval(timer)
}

const project = { path: '/P/Song.rpp', name: 'Song', sampleRate: 44100, revision: 42, length: 10, selection: [1, 3] }
const tracks = [{ id: '{T1}', index: 0, name: 'Kick', channels: 2, folder: false, selected: true },
  { id: '{T2}', index: 1, name: 'Bass', channels: 2, folder: false, selected: false }]

test('REAPER bridge: renders exact selection stems and maps files by track GUID', async () => {
  const root = mkdtempSync(join(tmpdir(), 'slur-reaper-')), job = mkdtempSync(join(tmpdir(), 'slur-job-'))
  process.env.SLUR_REAPER_ROOT = root
  const stop = fakeBridge(root, {
    tracks: () => ({ project, tracks }),
    render: req => {
      assert.deepEqual([req.start, req.finish], [1, 3])
      const files = req.trackIds.map((id, i) => {
        const path = join(req.dir, `slur-${tracks.findIndex(t => t.id === id) + 1}.wav`)
        writeFileSync(path, indexWave(88200, 44100, 2)); return { trackId: id, path }
      })
      return { files }
    },
  })
  try {
    const { inspectReaperTracks, exportReaperTracks } = await import('../src/reaperBridge.mjs')
    const snap = await inspectReaperTracks()
    assert.deepEqual(snap.ranges.selection, { start: 44100, end: 132300 })
    await exportReaperTracks({ sessionId: snap.sessionId, directory: job,
      options: { trackIds: ['{T2}', '{T1}'], range: 'selection', start: 44100, end: 132300, sampleRate: 44100 } })
    const { bundle } = unpackRegionArchive(readFileSync(join(job, 'selection.orb-regions.zip')))
    assert.deepEqual(bundle.tracks.map(t => t.name), ['Bass', 'Kick'])
    assert.ok(bundle.regions.every(r => r.start.samples === 44100 && r.lengthFrames === 88200))
    await assert.rejects(exportReaperTracks({ sessionId: snap.sessionId, directory: job,
      options: { trackIds: ['{T1}'], range: 'entire', start: 0, end: 1, sampleRate: 44100 } }), /range changed/)
  } finally { stop(); rmSync(root, { recursive: true, force: true }); rmSync(job, { recursive: true, force: true }); delete process.env.SLUR_REAPER_ROOT }
})

test('REAPER regions: split kick shares one cropped asset; each hit keeps its own position', async () => {
  const root = mkdtempSync(join(tmpdir(), 'slur-reaper-')), job = mkdtempSync(join(tmpdir(), 'slur-job-'))
  const audio = join(root, 'kick take.wav')
  writeFileSync(audio, indexWave(441000))   // 10 s, mono, 44.1 kHz
  process.env.SLUR_REAPER_ROOT = join(root, 'ipc')
  const item = (id, position, offset, length, extra = {}) => ({ id, trackId: '{T1}', position, offset, length, file: audio,
    sourceType: 'WAVE', playrate: 1, pitch: 0, volume: 1, takeVolume: 1, fadeIn: 0.01, fadeOut: 0.01, envelopes: 0, mute: false, name: id, ...extra })
  const items = [item('hit1', 1.0, 2.0, 0.25), item('hit2', 1.5, 2.5, 0.25), item('hit3', 2.0, 4.0, 0.5, { volume: 0.5 }),
    item('stretched', 4, 0, 1, { playrate: 1.25 }), item('midi', 5, 0, 1, { midi: true, sourceType: 'MIDI' })]
  const stop = fakeBridge(join(root, 'ipc'), { items: () => ({ project, tracks, items }) })
  try {
    const { inspectReaperRegions, exportReaperRegions } = await import('../src/reaperBridge.mjs')
    const snap = await inspectReaperRegions()
    const byId = Object.fromEntries(snap.regions.map(r => [r.id, r]))
    assert.equal(byId.hit3.notes[0], 'gain'); assert.match(byId.stretched.disabledReason, /Rate-changed/); assert.match(byId.midi.disabledReason, /MIDI/)
    await exportReaperRegions({ directory: job, options: { regionIds: ['hit1', 'hit2', 'hit3'], revision: snap.revision } })
    const { bundle, assets } = unpackRegionArchive(readFileSync(join(job, 'selection.orb-regions.zip')))
    assert.equal(bundle.assets.length, 1, 'one asset for all hits from one take')
    const asset = bundle.assets[0]
    assert.equal(asset.frames, Math.round(4.5 * 44100) - 2 * 44100, 'union span 2.0 s … 4.5 s')
    const r = Object.fromEntries(bundle.regions.map(x => [x.id, x]))
    assert.deepEqual([r.hit1.start.samples, r.hit1.offsetFrames, r.hit1.lengthFrames], [44100, 0, 11025])
    assert.deepEqual([r.hit2.start.samples, r.hit2.offsetFrames], [66150, 22050])
    assert.deepEqual([r.hit3.start.samples, r.hit3.offsetFrames, r.hit3.lengthFrames], [88200, 88200, 22050])
    // Samples are the original PCM: first frame of the asset is source frame 88200.
    const wav = Buffer.from(assets.get(asset.id).bytes)
    assert.equal(wav.readInt16LE(44), (88200 % 30000) - 15000)
    // Editing in REAPER between inspect and send is refused.
    project.revision++
    await assert.rejects(exportReaperRegions({ directory: job, options: { regionIds: ['hit1'], revision: snap.revision } }), /Refresh/)
  } finally { stop(); rmSync(root, { recursive: true, force: true }); rmSync(job, { recursive: true, force: true }); delete process.env.SLUR_REAPER_ROOT }
})
