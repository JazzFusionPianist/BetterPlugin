import test from 'node:test'
import assert from 'node:assert/strict'
import { zipSync, strToU8 } from 'fflate'
import { prepareRegionBundle, parseRegionBundle, hasCompleteLayout, uploadRegionBundle,
  readBundleAttachment, planRegionImport, rescaleSamples } from '../../core/lib/regionBundle.ts'
import { readRegionArchive } from '../src/archive.mjs'
import { prepareArchivedRegionBundle, unpackRegionArchive } from '../../core/lib/regionArchive.ts'
import { fixture } from './fixtures.mjs'

test('downloaded archive can be re-shared without losing track/trim/position metadata', async () => {
  const { bundle, bytes, hash } = fixture()
  const path = `audio/${hash}.wav`
  const archive = zipSync({ 'orb-regions.json': strToU8(JSON.stringify({ ...bundle, assetPaths: { [hash]: path } })), [path]: bytes })
  const prepared = await prepareArchivedRegionBundle(new File([archive], 'Session.orb-regions.zip'))
  assert.notEqual(prepared.bundle.id, bundle.id)
  assert.deepEqual({ ...prepared.bundle, id: bundle.id }, bundle)
  assert.deepEqual(new Uint8Array(await prepared.filesByAsset.get(hash).arrayBuffer()), bytes)
  const sent = await uploadRegionBundle(prepared, async f => ({ name: f.name, url: 'https://media.example/take.wav' }))
  assert.deepEqual(planRegionImport(readBundleAttachment(sent).bundle, 48000), planRegionImport(bundle, 48000))
})

test('browser archive upload checks every hash before allowing an upload', async () => {
  const { bundle, hash } = fixture()
  const path = `audio/${hash}.wav`
  const archive = zipSync({ 'orb-regions.json': strToU8(JSON.stringify({ ...bundle, assetPaths: { [hash]: path } })),
    [path]: new Uint8Array([9, 9, 9, 9]) })
  await assert.rejects(prepareArchivedRegionBundle(new File([archive], 'Session.orb-regions.zip')), /Damaged audio/)
})

test('extra manifest paths are rejected by both browser and helper', () => {
  const { bundle, bytes, hash } = fixture()
  const path = `audio/${hash}.wav`
  const archive = zipSync({ 'orb-regions.json': strToU8(JSON.stringify({ ...bundle,
    assetPaths: { [hash]: path, extra: 'file:///private' } })), [path]: bytes })
  assert.throws(() => unpackRegionArchive(archive), /Unexpected audio path/)
  assert.throws(() => readRegionArchive(archive), /Unexpected audio path/)
})

test('ordinary drops retain occurrences and never guess source tracks or positions', async () => {
  const file = new File(['sound'], 'Vocal.wav')
  const { bundle, filesByAsset } = await prepareRegionBundle([file, file])
  assert.equal(bundle.assets.length, 1)
  assert.equal(bundle.regions.length, 2)
  assert.equal(filesByAsset.size, 1)
  assert.equal(bundle.source, null)
  assert.deepEqual(bundle.tracks, [])
  assert.ok(bundle.regions.every(r => r.trackId === null && r.start === null))
  assert.equal(hasCompleteLayout(bundle), false)
  assert.throws(() => planRegionImport(bundle, 48000), /complete track layout/)
})

test('equal filenames with different bytes remain separate assets', async () => {
  const { bundle } = await prepareRegionBundle([new File(['a'], 'take.wav'), new File(['b'], 'take.wav')])
  assert.equal(bundle.assets.length, 2)
})

test('invalid probe metadata and empty files fail before uploading', async () => {
  await assert.rejects(prepareRegionBundle([new File(['a'], 'x')], async () => ({ sampleRate: NaN })))
  await assert.rejects(prepareRegionBundle([new File([], 'x')]))
})

test('one failed asset rejects the entire upload', async () => {
  const prepared = await prepareRegionBundle([new File(['a'], 'a.wav'), new File(['b'], 'b.wav')])
  let uploads = 0
  await assert.rejects(uploadRegionBundle(prepared, async () => ++uploads === 2 ? null : { url: 'https://media.example/a', name: 'a' }), /not sent/)
  assert.equal(uploads, 2)
})

test('attachment round trip keeps all original asset URLs and full manifest', async () => {
  const prepared = await prepareRegionBundle([new File(['a'], 'a.wav'), new File(['b'], 'b.wav')])
  const entries = await uploadRegionBundle(prepared, async f => ({ url: `https://media.example/${f.name}`, name: f.name }))
  const parsed = readBundleAttachment(JSON.parse(JSON.stringify(entries)))
  assert.deepEqual(parsed.bundle, prepared.bundle)
  assert.deepEqual(parsed.entries.map(e => e.url), ['https://media.example/a.wav', 'https://media.example/b.wav'])
  assert.equal(readBundleAttachment(entries.slice(1)), null)
  assert.equal(readBundleAttachment([{ ...entries[0], url: 'file:///etc/passwd' }, entries[1]]), null)
  for (const url of ['https://127.0.0.1/private', 'https://localhost/private', 'https://host.local/private', 'https://user:pass@media.example/a'])
    assert.equal(readBundleAttachment([{ ...entries[0], url }, entries[1]]), null)
})

test('track order, gaps, overlaps and source trims survive the import plan', () => {
  const plan = planRegionImport(fixture().bundle, 44100)
  assert.deepEqual(plan.map(t => t.name), ['Voice', 'Guitar'])
  assert.equal(plan[1].regions.length, 2)
  assert.equal(plan[1].regions[0].startSamples, 88200)
  assert.equal(plan[1].regions[0].sourceOffsetFrames, 12000)
  assert.equal(plan[1].regions[0].sourceLengthFrames, 24000)
  assert.equal(plan[1].regions[1].startSamples, 91875)
})

test('sample conversion handles negative values and refuses unsafe integers', () => {
  assert.equal(rescaleSamples(-96000, 48000, 44100), -88200)
  assert.equal(rescaleSamples(1, 2, 1), 1)
  assert.equal(rescaleSamples(-1, 2, 1), -1)
  assert.throws(() => rescaleSamples(Number.MAX_SAFE_INTEGER, 1, 48000))
})

for (const [name, mutate] of Object.entries({
  version: b => { b.version = 99 },
  danglingTrack: b => { b.regions[0].trackId = 'missing' },
  danglingAsset: b => { b.regions[0].assetId = 'missing' },
  duplicateRegion: b => { b.regions[1].id = b.regions[0].id },
  infiniteTime: b => { b.regions[0].start.samples = Infinity },
  overrun: b => { b.regions[0].lengthFrames = 96000 },
  emptyRegion: b => { b.regions[0].lengthFrames = 0 },
  unsafeSize: b => { b.assets[0].bytes = Number.MAX_SAFE_INTEGER },
  excessiveRate: b => { b.assets[0].sampleRate = 999999 },
})) test(`validator rejects ${name}`, () => {
  const { bundle } = fixture(); mutate(bundle)
  assert.equal(parseRegionBundle(bundle), null)
})

test('validator handles malformed top-level inputs without throwing', () => {
  for (const input of [undefined, null, [], {}, 1, 'hello', { format: 'orb-region-bundle', version: 1 }])
    assert.equal(parseRegionBundle(input), null)
})

test('archive verifies contents and ignores untrusted original filenames for paths', () => {
  const { bundle, bytes, hash } = fixture()
  bundle.assets[0].name = '../../Take.wav'
  const path = `audio/${hash}.wav`
  const archive = zipSync({ 'orb-regions.json': strToU8(JSON.stringify({ ...bundle, assetPaths: { [hash]: path } })), [path]: bytes })
  const result = readRegionArchive(archive)
  assert.deepEqual(result.bundle, bundle)
  assert.deepEqual(result.assets.get(hash).bytes, bytes)
})

test('archive rejects path traversal, missing, altered and unexpected audio', () => {
  const { bundle, bytes, hash } = fixture()
  const path = `audio/${hash}.wav`
  const manifest = assetPath => strToU8(JSON.stringify({ ...bundle, assetPaths: { [hash]: assetPath } }))
  assert.throws(() => readRegionArchive(zipSync({ 'orb-regions.json': manifest('../outside.wav'), '../outside.wav': bytes })))
  assert.throws(() => readRegionArchive(zipSync({ 'orb-regions.json': manifest(path) })))
  assert.throws(() => readRegionArchive(zipSync({ 'orb-regions.json': manifest(path), [path]: new Uint8Array([4, 3, 2, 1]) })), /Damaged/)
  assert.throws(() => readRegionArchive(zipSync({ 'orb-regions.json': manifest(path), [path]: bytes, extra: bytes })), /Unexpected/)
})
