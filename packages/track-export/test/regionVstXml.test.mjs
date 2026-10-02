import test from 'node:test'
import assert from 'node:assert/strict'
import { prepareRegionBundle, hasCompleteLayout } from '../../core/lib/regionBundle.ts'
import { applyVstLayout, cropVstWave, parseVstEvidence, planVstRegionDrag } from '../../core/lib/regionVstXml.ts'
import { dawprojectFixture, wave } from './dawprojectFixture.mjs'

const evidence = (changes = {}) => ({ format: 'vst-xml', version: 1, captureId: 'capture', sourceApp: 'Cubase',
  name: 'Selected clip', channelId: 'channel1', offsetFrames: 24000, lengthFrames: 36000, positionSeconds: 2.5, ...changes })
async function prepare(items) {
  const cropped = await Promise.all(items.map(e => cropVstWave(wave(), e)))
  const result = await prepareRegionBundle(cropped, async f => ({ sampleRate: 48000, channels: 1, frames: (f.size - 44) / 2 }))
  result.bundle = applyVstLayout(result.bundle, items)
  return result
}
test('selection-only crop preserves PCM bytes, removes unselected source audio', async () => {
  const original = wave(), e = evidence(), cropped = await cropVstWave(original, e)
  const raw = new Uint8Array(await original.arrayBuffer()), out = new Uint8Array(await cropped.arrayBuffer())
  assert.equal(out.length, 44 + e.lengthFrames * 2)
  assert.deepEqual(out.subarray(44), raw.subarray(44 + e.offsetFrames * 2, 44 + (e.offsetFrames + e.lengthFrames) * 2))
})
test('one track with repeated clips retains edited starts, not BWF or source offsets', async () => {
  const p = await prepare([evidence(), evidence({ positionSeconds: 8 + 1 / 48000 })])
  assert.equal(p.bundle.assets.length, 1)
  assert.equal(p.bundle.tracks.length, 1)
  assert.equal(hasCompleteLayout(p.bundle), true)
  assert.deepEqual(p.bundle.regions.map(r => r.start), [{ samples: 120000, sampleRate: 48000 }, { samples: 384001, sampleRate: 48000 }])
  assert.deepEqual(p.bundle.regions.map(r => [r.offsetFrames, r.lengthFrames]), [[0, 36000], [0, 36000]])
})
test('missing position/channel stays unknown and never unlocks restore', async () => {
  for (const e of [evidence({ positionSeconds: null }), evidence({ channelId: null }), evidence({ positionSeconds: Math.PI })]) {
    const p = await prepare([e]); assert.equal(hasCompleteLayout(p.bundle), false)
    assert.throws(() => planVstRegionDrag(p.bundle, new Map()))
  }
})
test('reject mixed drops, invalid trims, corrupt WAV and invalid metadata', async () => {
  for (const e of [evidence({ offsetFrames: -1 }), evidence({ lengthFrames: 0 }), evidence({ offsetFrames: 999999 }), evidence({ positionSeconds: Infinity })])
    await assert.rejects(cropVstWave(wave(), e))
  await assert.rejects(cropVstWave(new File(['not wav'], 'test.wav'), evidence()))
  await assert.rejects(prepare([evidence(), evidence({ captureId: 'other-drop' })]), /Mixed/)
  assert.equal(parseVstEvidence({ ...evidence(), channelId: 1 }), null)
})
test('VST drag uses only cache tokens and preserves starts, trims and grouping', async () => {
  const p = await dawprojectFixture(), tokens = new Map(p.bundle.assets.map(a => [a.id, crypto.randomUUID()]))
  const regions = planVstRegionDrag(p.bundle, tokens)
  assert.equal(regions[0].channel, regions[1].channel)
  assert.notEqual(regions[0].channel, regions[2].channel)
  assert.deepEqual(regions.map(r => Math.round(r.seconds * 48000)), [120000, 384001, 72000])
  assert.deepEqual(regions.map(r => [r.offset, r.end]), [[24000, 60000], [24000, 60000], [11025, 55125]])
  tokens.set(p.bundle.assets[0].id, '../../private.wav')
  assert.throws(() => planVstRegionDrag(p.bundle, tokens), /cached/)
})
