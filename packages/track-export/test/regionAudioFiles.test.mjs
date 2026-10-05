import test from 'node:test'
import assert from 'node:assert/strict'
import { audioFileTransfers, renderRegionAudio } from '../../core/lib/regionAudioFiles.ts'
import { hasCompleteLayout, planRegionImport, uploadRegionBundle, readBundleAttachment } from '../../core/lib/regionBundle.ts'
import { encryptFile, decryptFile } from '../../core/lib/fileCrypto.ts'
import { createRegionArchive, prepareArchivedRegionBundle } from '../../core/lib/regionArchive.ts'
import { dawprojectFixture, wave } from './dawprojectFixture.mjs'

function entries(bundle) {
  return bundle.assets.map((a, i) => ({ url: `https://example.com/${a.id}`, name: a.name,
    assetId: a.id, ...(i === 0 ? { regionBundle: bundle } : {}) }))
}

test('encrypted private bundles preserve layout and yield plain trimmed audio for DAW drag', async () => {
  const prepared = await dawprojectFixture()
  const storage = new Map()
  const uploaded = await uploadRegionBundle(prepared, async file => {
    const encrypted = await encryptFile(file)
    const ref = `orb-file:private/user/${storage.size}.bin`
    storage.set(ref, encrypted.blob)
    return { url: `${ref}#e2ee=${encrypted.key}`, name: file.name }
  })
  const received = readBundleAttachment(JSON.parse(JSON.stringify(uploaded)))
  assert.deepEqual(received.bundle, prepared.bundle)
  const transfers = audioFileTransfers(received.entries)
  assert.equal(transfers.length, prepared.bundle.regions.length)
  for (const transfer of transfers) {
    const [ref, fragment] = transfer.url.split('#')
    const decrypted = await decryptFile(storage.get(ref), new URLSearchParams(fragment).get('e2ee'))
    const output = await renderRegionAudio(transfer, new Uint8Array(await decrypted.arrayBuffer()))
    const source = new Uint8Array(await prepared.filesByAsset.get(transfer.asset.id).arrayBuffer())
    const { offsetFrames, lengthFrames } = transfer.region
    const block = transfer.asset.channels * 2
    assert.deepEqual(new Uint8Array(await output.arrayBuffer()).slice(44),
      source.slice(44 + offsetFrames * block, 44 + (offsetFrames + lengthFrames) * block))
  }
})

test('ordinary file drags stay ordinary and do not need a host adapter', async () => {
  const [t] = audioFileTransfers([{ url: 'https://example.com/a.wav', name: 'a.wav' }])
  assert.equal(t.key, t.url)
  const bytes = new Uint8Array(await wave().arrayBuffer())
  assert.deepEqual(new Uint8Array(await (await renderRegionAudio(t, bytes)).arrayBuffer()), bytes)
})

test('bundle drag emits every occurrence including repeated assets with exact PCM trims', async () => {
  const p = await dawprojectFixture(), before = structuredClone(p.bundle)
  const transfers = audioFileTransfers(entries(p.bundle))
  assert.equal(transfers.length, 3)
  assert.equal(transfers[0].url, transfers[1].url)
  for (const [i, t] of transfers.entries()) {
    const source = new Uint8Array(await p.filesByAsset.get(t.asset.id).arrayBuffer())
    const rendered = await renderRegionAudio(t, source), out = new Uint8Array(await rendered.arrayBuffer())
    const r = p.bundle.regions[i], block = t.asset.channels * 2
    assert.equal(out.length, 44 + r.lengthFrames * block)
    assert.deepEqual(out.slice(44), source.slice(44 + r.offsetFrames * block, 44 + (r.offsetFrames + r.lengthFrames) * block))
    assert.ok(rendered.name.endsWith('.wav'))
  }
  assert.deepEqual(p.bundle, before)
  const roundTrip = await prepareArchivedRegionBundle(await createRegionArchive(p))
  assert.equal(hasCompleteLayout(roundTrip.bundle), true)
  assert.deepEqual(planRegionImport(roundTrip.bundle, 48000), planRegionImport(before, 48000))
})

test('a row drags only that occurrence; distinct trims cannot share cached bytes', async () => {
  const p = await dawprojectFixture(), b = p.bundle
  b.regions[1].offsetFrames++
  const rows = b.regions.map(r => ({ ...entries(b).find(e => e.assetId === r.assetId), regionBundle: b, regionId: r.id }))
  assert.equal(audioFileTransfers([rows[1]]).length, 1)
  const files = audioFileTransfers(rows)
  assert.equal(files.length, 3)
  assert.notEqual(files[0].key, files[1].key)
  assert.equal(audioFileTransfers([...rows, rows[1]]).length, 3)
})

test('full-file exports preserve embedded metadata and unknown positions remain unknown', async () => {
  const p = await dawprojectFixture(), b = p.bundle
  b.source = null; b.tracks = []
  b.regions.forEach(r => {
    r.trackId = null; r.start = null; r.offsetFrames = 0
    r.lengthFrames = b.assets.find(a => a.id === r.assetId).frames
    r.recordingTimestamp = { samples: 172800000, sampleRate: 48000, source: 'bwf' }
  })
  const t = audioFileTransfers(entries(b))[0], bytes = new Uint8Array(await p.filesByAsset.get(t.asset.id).arrayBuffer())
  assert.deepEqual(new Uint8Array(await (await renderRegionAudio(t, bytes)).arrayBuffer()), bytes)
  assert.equal(hasCompleteLayout(b), false)
  assert.throws(() => planRegionImport(b, 48000), /complete track layout/)
})

test('corrupt media, missing occurrences and mismatched assets fail instead of dragging wrong audio', async () => {
  const p = await dawprojectFixture(), b = p.bundle, tracks = entries(b)
  const t = audioFileTransfers(tracks)[0], bytes = new Uint8Array(await p.filesByAsset.get(t.asset.id).arrayBuffer())
  bytes[44] ^= 1
  await assert.rejects(renderRegionAudio(t, bytes), /integrity/)
  assert.throws(() => audioFileTransfers([{ ...tracks[0], regionId: 'missing' }]), /Missing/)
  assert.throws(() => audioFileTransfers([{ ...tracks[0], regionId: b.regions[2].id }]), /match/)
})
