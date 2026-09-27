import test from 'node:test'
import assert from 'node:assert/strict'
import { prepareRegionBundle, parseRegionBundle, hasCompleteLayout, planRegionImport, uploadRegionBundle } from '../../core/lib/regionBundle.ts'
import { createRegionArchive, prepareArchivedRegionBundle, isRegionArchive } from '../../core/lib/regionArchive.ts'
import { supportsTrackExport, supportsTrackExportOperation } from '../../core/lib/trackExportPolicy.ts'

const fixture = async () => {
  const file = new File([new Uint8Array([1, 2, 3, 4])], 'Same name.wav')
  return prepareRegionBundle([file, file], async () => ({ sampleRate: 48000, channels: 1, frames: 2 }))
}

test('track export allows Pro Tools only, plus its standalone client', () => {
  assert.equal(supportsTrackExport('Pro Tools'), true)
  assert.equal(supportsTrackExport('Standalone'), true)
  for (const host of ['', 'Logic Pro', 'LUNA', 'Cubase', 'Fender Studio Pro']) assert.equal(supportsTrackExport(host), false)
  for (const operation of ['inspectLogicTracks', 'exportLogicTracks', 'inspectLunaTracks', 'exportLunaTracks', 'unknown'])
    assert.equal(supportsTrackExportOperation(operation), false)
  assert.equal(supportsTrackExportOperation('exportTracks'), true)
  assert.equal(supportsTrackExportOperation('inspectTracks'), true)
})

test('recording timestamps survive archive round trip, without implying placement', async () => {
  const prepared = await fixture()
  prepared.bundle.regions[0].recordingTimestamp = { samples: 3600 * 48000, sampleRate: 48000, source: 'bwf' }
  const archive = await createRegionArchive(prepared)
  assert.equal(isRegionArchive(archive), true)
  const result = await prepareArchivedRegionBundle(archive)
  assert.equal(result.bundle.assets.length, 1)
  assert.equal(result.bundle.regions.length, 2)
  assert.deepEqual(result.bundle.regions, prepared.bundle.regions)
  assert.notEqual(result.bundle.id, prepared.bundle.id)
  assert.equal(hasCompleteLayout(result.bundle), false)
  assert.throws(() => planRegionImport(result.bundle, 44100), /complete track layout/)
})

test('verified cross-rate layout preserves gaps, track IDs, repeats and trims', async () => {
  const prepared = await fixture(), b = prepared.bundle
  b.source = { daw: 'Pro Tools', projectId: 'test', captureId: 'test' }
  b.tracks = [{ id: 't', name: 'Track', order: 0, channels: 1 }]
  b.regions.forEach((r, i) => { r.trackId = 't'; r.start = { samples: i * 96000, sampleRate: 48000 }; r.offsetFrames = 1; r.lengthFrames = 1 })
  const roundTrip = await prepareArchivedRegionBundle(await createRegionArchive(prepared))
  const regions = planRegionImport(roundTrip.bundle, 44100)[0].regions
  assert.deepEqual(regions.map(r => r.startSamples), [0, 88200])
  assert.ok(regions.every(r => r.sourceOffsetFrames === 1 && r.sourceLengthFrames === 1))
  assert.deepEqual(roundTrip.bundle.source, b.source)
})

test('timestamp evidence rejects negative, unsafe, malformed and unsupported clocks', async () => {
  for (const stamp of [
    { samples: -1, sampleRate: 48000, source: 'bwf' },
    { samples: 2 ** 53, sampleRate: 48000, source: 'bwf' },
    { samples: 1, sampleRate: 0, source: 'bwf' },
    { samples: 1, sampleRate: 48000, source: 'playhead' },
  ]) {
    const p = await fixture(); p.bundle.regions[0].recordingTimestamp = stamp
    assert.equal(parseRegionBundle(p.bundle), null)
  }
})

test('asset mutation cannot silently enter an archive', async () => {
  const p = await fixture(), asset = p.bundle.assets[0]
  p.filesByAsset.set(asset.id, new File([new Uint8Array([9, 9, 9, 9])], asset.name))
  await assert.rejects(createRegionArchive(p), /Changed audio/)
})

test('a failed upload rejects the entire bundle; repeated audio uploads once', async () => {
  const p = await fixture()
  await assert.rejects(uploadRegionBundle(p, async () => null), /not sent/)
  let count = 0
  const entries = await uploadRegionBundle(p, async file => { count++; return { name: file.name, url: 'https://example.com/audio.wav' } })
  assert.equal(count, 1)
  assert.equal(entries[0].regionBundle.regions.length, 2)
})

test('old Orb archive names remain readable', async () => {
  const archive = await createRegionArchive(await fixture())
  const legacy = new File([archive], 'test.orb-regions.zip')
  assert.equal((await prepareArchivedRegionBundle(legacy)).bundle.regions.length, 2)
})
