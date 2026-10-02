import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const built = await build({ entryPoints: [fileURLToPath(new URL('../../../apps/plugin/src/lib/regionSharing.ts', import.meta.url))],
  bundle: true, platform: 'node', format: 'esm', write: false })
const { prepareSharedRegions, uploadSharedRegions } = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'))

function audio(timestamp) {
  const b = Buffer.alloc(timestamp === undefined ? 48 : 658)
  b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(48000, 24); b.writeUInt32LE(96000, 28)
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(4, 40)
  if (timestamp !== undefined) { b.write('bext', 48); b.writeUInt32LE(602, 52); b.writeUInt32LE(timestamp, 56 + 338) }
  return new File([b], 'region.wav', { type: 'audio/wav' })
}

test('real BWF drop retains its raw clock but never invents edited position or track', async () => {
  const p = await prepareSharedRegions([audio(172800000), audio(172848000)])
  assert.deepEqual(p.bundle.regions.map(r => r.recordingTimestamp.samples), [172800000, 172848000])
  assert.ok(p.bundle.regions.every(r => r.start === null && r.trackId === null && r.lengthFrames === 2))
  const entries = await uploadSharedRegions(p, async file => ({ name: file.name, url: 'https://example.com/file.wav' }))
  assert.ok(entries.every(e => e.metadata.position.meaning === 'recording_timestamp' && e.metadata.position.basis === 'unknown'))
})

test('unstamped audio remains unknown and repeated occurrences survive deduplication', async () => {
  const file = audio()
  const p = await prepareSharedRegions([file, file])
  let calls = 0
  const entries = await uploadSharedRegions(p, async file => { calls++; return { name: file.name, url: 'https://example.com/file.wav' } })
  assert.equal(calls, 1)
  assert.equal(entries[0].metadata, undefined)
  assert.equal(entries[0].regionBundle.regions.length, 2)
  assert.ok(entries[0].regionBundle.regions.every(r => r.start === null && !r.recordingTimestamp))
})
