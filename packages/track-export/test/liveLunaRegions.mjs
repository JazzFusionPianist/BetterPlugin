// Deliberate host edits ONLY in the named synthetic QA session. Never uploads.
import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { dawprojectFixture } from './dawprojectFixture.mjs'
import { createRegionArchive, prepareArchivedRegionBundle } from '../../core/lib/regionArchive.ts'
import { cropVstWave } from '../../core/lib/regionVstXml.ts'
import { inspectLunaDestination, importLunaRegions, inspectLunaRegions, captureLunaRegions } from '../src/lunaRegions.mjs'
const s = await inspectLunaDestination()
assert.equal(s.name, 'Slur Region QA 2026-09-27', 'Open only the synthetic QA session.')
const before = await inspectLunaRegions(), p = await dawprojectFixture()
const archive = await createRegionArchive(p), directory = await mkdtemp(join(tmpdir(), 'slur-luna-region-roundtrip-'))
const result = await importLunaRegions({ sessionId: s.sessionId, archive: new Uint8Array(await archive.arrayBuffer()), directory })
assert.equal(result.importedRegions, 3); assert.equal(result.importedTracks, 2)
const snapshot = await inspectLunaRegions()
const added = snapshot.regions.filter(r => !before.regions.some(b => b.id === r.id))
assert.equal(added.length, 3); assert.ok(added.every(r => !r.disabledReason))
await captureLunaRegions({ sessionId: s.sessionId, options: { regionIds: added.map(r => r.id), revision: snapshot.revision }, directory })
const captured = await prepareArchivedRegionBundle(new File([await readFile(join(directory, 'selection.orb-regions.zip'))], 'roundtrip.slur-regions.zip'))
for (const expected of p.bundle.regions) {
  const r = captured.bundle.regions.find(r => r.name === expected.name)
  assert.ok(r); assert.deepEqual(r.start, expected.start); assert.equal(r.lengthFrames, expected.lengthFrames)
  const crop = await cropVstWave(p.filesByAsset.get(expected.assetId), { format: 'vst-xml', version: 1, captureId: 'test',
    sourceApp: 'test', channelId: null, name: expected.name, offsetFrames: expected.offsetFrames, lengthFrames: expected.lengthFrames, positionSeconds: null })
  assert.deepEqual(new Uint8Array(await captured.filesByAsset.get(r.assetId).arrayBuffer()), new Uint8Array(await crop.arrayBuffer()))
}
console.log(JSON.stringify({ ...result, capturedRegions: captured.bundle.regions.length, exactAudio: true, directory }))
