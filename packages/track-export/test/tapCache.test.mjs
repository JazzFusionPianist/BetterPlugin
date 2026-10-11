import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { unpackRegionArchive } from '../../core/lib/regionArchive.ts'
import { probeWave } from '../src/proToolsTracks.mjs'

// Writer: the real C++ TapCache (Plugin/Tests/TapCacheTest.cpp). Skipped when not built:
//   cmake --build Plugin/build --config Debug --target TapCacheTest
const here = dirname(fileURLToPath(import.meta.url))
const binary = join(here, '../../../Plugin/build/TapCacheTest_artefacts/Debug/TapCacheTest')
const TAP = '11111111-2222-3333-4444-555555555555'

test('Slur Tap: C++ writer and JS reader agree on pages, spans and overwrites', { skip: !existsSync(binary) && 'TapCacheTest not built' }, async () => {
  const root = mkdtempSync(join(tmpdir(), 'slur-tap-'))
  process.env.SLUR_TAP_ROOT = root
  try {
    const generation = execFileSync(binary, { env: { ...process.env, SLUR_TAP_ROOT: root } }).toString().trim()
    // Fresh module instance per env: import after SLUR_TAP_ROOT is set.
    const { listTaps, coverageOf, exportTapTracks, inspectTapTracks, detectRegions } = await import('../src/tapCache.mjs?' + Date.now())
    const reg = JSON.parse(readFileSync(join(root, 'taps', TAP + '.json'), 'utf8'))
    assert.equal(reg.generation, generation); assert.equal(reg.track, 'Kick In'); assert.equal(reg.host, 'Logic Pro')
    // The second tap (rate change + clear) deleted its own old generation only.
    assert.equal(readdirSync(join(root, 'cache', '99999999-2222-3333-4444-555555555555')).length, 1)

    const taps = await listTaps({ host: 'Logic Pro', hostKey: 'nope', now: reg.heartbeatMs + 1000 })
    const tap = taps.find(t => t.id === TAP)
    assert.deepEqual(tap.spans.map(([s, e]) => [s, e]), [[0, 700], [1000, 201000], [500000, 510000]])
    assert.equal((await listTaps({ host: 'Ableton Live', hostKey: 'nope', now: reg.heartbeatMs + 1000 })).length, 0)
    assert.equal((await listTaps({ host: 'Logic Pro', hostKey: 'nope', now: reg.heartbeatMs + 60000 })).length, 0, 'stale taps hidden')
    assert.deepEqual(coverageOf(tap.spans, 0, 2000).gaps, [[700, 1000]])

    const RealNow = Date.now
    Date.now = () => reg.heartbeatMs + 1000
    try {
      const snap = await inspectTapTracks({ host: 'Logic Pro', hostKey: reg.hostKey })
      assert.deepEqual(snap.ranges.entire, { start: 0, end: 510000 })
      const dir = mkdtempSync(join(tmpdir(), 'slur-tap-out-'))
      await assert.rejects(exportTapTracks({ host: 'Logic Pro', hostKey: reg.hostKey, directory: dir,
        options: { trackIds: [TAP], start: 0, end: 2000, sampleRate: 48000 } }), /Not captured yet: Kick In/)
      await exportTapTracks({ host: 'Logic Pro', hostKey: reg.hostKey, directory: dir,
        options: { trackIds: [TAP], start: 131000, end: 140000, sampleRate: 48000 } })
      const { bundle, assets } = unpackRegionArchive(readFileSync(join(dir, 'selection.orb-regions.zip')))
      assert.equal(bundle.regions[0].start.samples, 131000)
      const wav = Buffer.from(assets.get(bundle.assets[0].id).bytes)
      const w = probeWave(wav)
      assert.deepEqual([w.channels, w.sampleRate, w.frames, w.bits], [2, 48000, 9000, 32])
      // Frame 131072 crosses a page boundary; samples must be exact.
      const at = f => [wav.readFloatLE(wav.length - (9000 - (f - 131000)) * 8), wav.readFloatLE(wav.length - (9000 - (f - 131000)) * 8 + 4)]
      for (const f of [131000, 131071, 131072, 139999]) {
        const [l, r] = at(f)
        assert.ok(Math.abs(l - Math.fround(f * 1e-6)) < 1e-9 && Math.abs(r + l) < 1e-12, `frame ${f}`)
      }
      // Overwritten range holds the second write (×2).
      await exportTapTracks({ host: 'Logic Pro', hostKey: reg.hostKey, directory: dir, options: { trackIds: [TAP], start: 500000, end: 500010, sampleRate: 48000 } })
      const second = unpackRegionArchive(readFileSync(join(dir, 'selection.orb-regions.zip')))
      const b = Buffer.from(second.assets.get(second.bundle.assets[0].id).bytes)
      assert.ok(Math.abs(b.readFloatLE(b.length - 80) - Math.fround(500000 * 1e-6 * 2)) < 1e-6)
      const regions = await detectRegions(tap)
      assert.equal(regions.length, 3)
    } finally { Date.now = RealNow }
  } finally { rmSync(root, { recursive: true, force: true }); delete process.env.SLUR_TAP_ROOT }
})
