import test from 'node:test'
import assert from 'node:assert/strict'
import { unzipSync, strFromU8 } from 'fflate'
import { createRegionDawproject } from '../../core/lib/regionDawproject.ts'
import { sha256 } from '../../core/lib/regionBundle.ts'
import { dawprojectFixture } from './dawprojectFixture.mjs'

test('DAWproject preserves tracks, gaps, repeated occurrences, trims and mixed sample rates', async () => {
  const p = await dawprojectFixture(), f = await createRegionDawproject(p)
  assert.equal(f.name, 'Slur Regions.dawproject')
  const files = unzipSync(new Uint8Array(await f.arrayBuffer())), xml = strFromU8(files['project.xml'])
  assert.equal(Object.keys(files).filter(k => k.startsWith('audio/')).length, 2)
  assert.equal((xml.match(/<Clip name=/g) || []).length, 3)
  assert.ok(xml.includes('name="Drums &amp; One"') && xml.includes('name="Keys &lt;Two&gt;"'))
  assert.ok(xml.includes('time="2.5" duration="0.75" contentTimeUnit="seconds" playStart="0.5" playStop="1.25"'))
  const starts = [...xml.matchAll(/<Clip name=[^>]*time="([^"]+)"/g)].map(m => Math.round(Number(m[1]) * 48000))
  assert.deepEqual(starts, [120000, 384001, 72000])
  assert.ok(xml.includes('time="1.5" duration="1" contentTimeUnit="seconds" playStart="0.25" playStop="1.25"'))
  assert.ok(xml.includes('sampleRate="44100" channels="2"'))
  assert.ok(!xml.includes('<Transport>'), 'do not invent or overwrite a tempo map')
  assert.ok(!xml.includes('loopStart='), 'trimmed regions must not become loops')
  for (const a of p.bundle.assets) assert.equal(await sha256(files[`audio/${a.sha256}.wav`].buffer), a.sha256)
})

test('unknown positions remain unavailable even with BWF timestamps', async () => {
  const p = await dawprojectFixture()
  p.bundle.regions[0].start = null
  p.bundle.regions[0].recordingTimestamp = { samples: 48000, sampleRate: 48000, source: 'bwf' }
  await assert.rejects(createRegionDawproject(p), /Exact region positions/)
})

test('invalid, negative, missing and out-of-bounds layouts fail closed', async () => {
  for (const change of [
    p => { p.bundle.regions[0].start.samples = -1 },
    p => { p.bundle.regions[0].lengthFrames = 48000 * 100 },
    p => { p.bundle.assets[0].frames = null },
    p => { p.filesByAsset.clear() },
    p => { p.bundle.tracks[0].channels = 2 },
    p => { p.bundle.tracks[0].name = 'bad\u0000name' },
  ]) {
    const p = await dawprojectFixture(); change(p)
    await assert.rejects(createRegionDawproject(p))
  }
})

test('untrusted manifest media claims and tampered bytes are rejected', async () => {
  const p = await dawprojectFixture()
  p.bundle.assets[0].sampleRate = 44100
  await assert.rejects(createRegionDawproject(p), /metadata does not match/)
  p.bundle.assets[0].sampleRate = 48000
  const a = p.bundle.assets[0]
  p.filesByAsset.set(a.id, new File([new Uint8Array(a.bytes)], a.name))
  await assert.rejects(createRegionDawproject(p), /Changed audio/)
})

test('IDs and filenames never become XML IDs or external paths', async () => {
  const p = await dawprojectFixture()
  p.bundle.tracks[0].id = '../../bad "id'
  p.bundle.regions.filter(r => r.trackId === 'mono').forEach(r => { r.trackId = p.bundle.tracks[0].id })
  p.bundle.assets[0].name = '../../foreign.wav'
  const entries = unzipSync(new Uint8Array(await (await createRegionDawproject(p)).arrayBuffer()))
  const xml = strFromU8(entries['project.xml'])
  assert.ok(!xml.includes('../'))
  assert.ok(Object.keys(entries).every(k => /^(project\.xml|metadata\.xml|audio\/[a-f0-9]{64}\.wav)$/.test(k)))
})
