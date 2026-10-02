import test from 'node:test'
import assert from 'node:assert/strict'
import { selectedRegionBundle } from '../src/lib/regionPlacement.ts'
import { dawprojectFixture } from '../../../packages/track-export/test/dawprojectFixture.mjs'
test('individual placement restores one occurrence, not other regions using the same audio', async () => {
  const { bundle } = await dawprojectFixture(), region = bundle.regions[1]
  const selected = selectedRegionBundle(bundle, [{ assetId: region.assetId, regionId: region.id }])
  assert.equal(selected.regions.length, 1); assert.equal(selected.regions[0].id, region.id)
  assert.equal(selected.tracks.length, 1); assert.equal(selected.assets.length, 1)
  assert.deepEqual(selected.regions[0].start, region.start)
})
test('group placement preserves all track identities; invalid selections fail closed', async () => {
  const { bundle } = await dawprojectFixture()
  const selected = selectedRegionBundle(bundle, bundle.regions.map(r => ({ regionId: r.id })))
  assert.equal(selected.regions.length, 3); assert.equal(selected.tracks.length, 2)
  assert.equal(selectedRegionBundle(bundle, [{ regionId: 'unknown' }]), null)
  assert.equal(selectedRegionBundle(null, []), null)
})
