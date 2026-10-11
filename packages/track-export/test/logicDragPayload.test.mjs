import test from 'node:test'
import assert from 'node:assert/strict'
import { logicClockToPpq, ppqToMusical, logicRegionsFromDrag, applyLogicLayout } from '../../core/lib/logicRegionDrop.ts'
import { prepareRegionBundle } from '../../core/lib/regionBundle.ts'

// startClock values recorded from a real Logic Pro 12 drag (QA project, 120 BPM, 4/4, 48 kHz)
// and the positions Logic's own UI reported for the same regions.
const real = [
  { kind: 'logic-region', startClock: 173220154179584, trackId: 'DA5920CA-B26D-11F1-BB5D-53E27768D048', fileName: 'Orb-a85d59c1-2-0.wav', index: 0, count: 4 },
  { kind: 'logic-region', startClock: 173220154179584, trackId: 'AE2846E8-B26D-11F1-A580-BA5A07A24CC2', fileName: 'Orb-a85d59c1-2-0.wav', index: 1, count: 4 },
  { kind: 'logic-region', startClock: 181442954985472, trackId: 'AE27D4C4-B26D-11F1-836A-1D4280005EA2', fileName: 'Orb-a85d59c1-1-1.wav', index: 2, count: 4 },
  { kind: 'logic-region', startClock: 181466491387904, trackId: 'DA5920CA-B26D-11F1-BB5D-53E27768D048', fileName: 'Orb-a85d59c1-2-1.wav', index: 3, count: 4 },
]
const timeline = { ppq: 0, projectSamples: 0, bpm: 120, sr: 48000, tnum: 4, tden: 4 }

test('Logic startClock → the same bar/beat/tick Logic displays', () => {
  // UI: "2 bars 11 ticks", "2 bars 6 ticks", and two beats earlier for the -2-0 regions.
  assert.deepEqual(ppqToMusical(logicClockToPpq(real[3].startClock), 4, 4), { bar: 2, beat: 1, division: 1, tick: 11, divisionDenominator: 16, resolution: 'logic-tick' })
  assert.deepEqual(ppqToMusical(logicClockToPpq(real[2].startClock), 4, 4).tick, 6)
  const p = ppqToMusical(logicClockToPpq(real[0].startClock), 4, 4)
  assert.deepEqual([p.bar, p.beat, p.division, p.tick], [1, 3, 1, 11])
})

test('regions sharing one source keep separate tracks and positions (no name matching)', () => {
  const regions = logicRegionsFromDrag(real, timeline)
  assert.equal(regions.length, 4)
  // Same file name and start, different tracks → two distinct occurrences.
  assert.equal(regions[0].name, regions[1].name)
  assert.notEqual(regions[0].trackId, regions[1].trackId)
  assert.equal(regions[0].trackId, regions[3].trackId)
  // 120 BPM: ppq 4.0114… → 2.0057 s → 96274 samples.
  assert.equal(regions[3].startSamples, Math.round(logicClockToPpq(real[3].startClock) * 0.5 * 48000))
  assert.ok(regions.every(r => r.sampleRate === 48000))
  assert.throws(() => logicRegionsFromDrag([real[0], real[0]], timeline))
  assert.throws(() => logicRegionsFromDrag([{ ...real[0], count: 1 }, real[1]], timeline))
})

test('bundle carries exact sample starts and musical positions per file', async () => {
  const files = real.map((m, i) => new File([new Uint8Array([1, 2, 3, i])], m.fileName))
  const prepared = await prepareRegionBundle(files, async () => ({ sampleRate: 48000, channels: 1, frames: 1 }))
  const regions = logicRegionsFromDrag(real, timeline)
  const bundle = applyLogicLayout(prepared.bundle, regions.map(region => ({ captureId: 'c', projectId: 'p', region })))
  assert.equal(bundle.tracks.length, 3)
  assert.deepEqual(bundle.regions.map(r => r.start.samples), regions.map(r => r.startSamples))
  assert.equal(bundle.regions[3].musicalStart.tick, 11)
})
