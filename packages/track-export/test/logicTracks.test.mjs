import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { exportLogicTracks } from '../src/logicTracks.mjs'
import { unpackRegionArchive } from '../../core/lib/regionArchive.ts'
const revision = 'a'.repeat(64), sessionId = 'b'.repeat(64)
const ids = [revision + ':0', revision + ':1']
const options = { range: 'entire', trackIds: ids, revision }
const directory = () => mkdtemp(join(tmpdir(), 'slur-logic-test-'))
function wav(frames = 4800) {
  const b = Buffer.alloc(44 + frames * 6)
  b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22); b.writeUInt32LE(48000, 24); b.writeUInt32LE(288000, 28)
  b.writeUInt16LE(6, 32); b.writeUInt16LE(24, 34); b.write('data', 36); b.writeUInt32LE(frames * 6, 40)
  return b
}
function fixture(patch = {}, frames = [4800, 4800]) {
  return async (request, dir) => {
    assert.equal(request.operation, 'export')
    const files = []
    for (const [i, id] of ids.entries()) {
      const path = i + '.wav'
      await writeFile(join(dir, path), wav(frames[i]))
      files.push({ id, name: 'Duplicate name', path })
    }
    return { sessionId, revision, restored: true, files, ...patch }
  }
}
test('Logic bundles duplicate names separately with equal lengths and actual format', async () => {
  const dir = await directory()
  await exportLogicTracks({ directory: dir, sessionId, options, execute: fixture() })
  const { bundle } = unpackRegionArchive(await readFile(join(dir, 'selection.orb-regions.zip')))
  assert.deepEqual(bundle.tracks.map(t => t.id), ids)
  assert.equal(bundle.assets.length, 1)
  assert.equal(bundle.source.daw, 'Logic Pro')
  assert.ok(bundle.regions.every(r => r.start.samples === 0 && r.lengthFrames === 4800))
})
test('Logic rejects unsupported range, duplicate or stale snapshot IDs before host mutation', async () => {
  for (const patch of [{ range: 'selection' }, { revision: 'bad' }, { trackIds: [ids[0], ids[0]] }, { trackIds: ['stale'] }]) {
    await assert.rejects(exportLogicTracks({ directory: await directory(), sessionId, options: { ...options, ...patch },
      execute: () => { assert.fail('must not operate Logic') } }))
  }
})
test('Logic refuses different durations, missing tracks and unconfirmed restoration', async () => {
  for (const execute of [fixture({}, [4800, 2400]), fixture({ restored: false }), fixture({ files: [] }), fixture({ sessionId: 'other' })]) {
    const dir = await directory()
    await assert.rejects(exportLogicTracks({ directory: dir, sessionId, options, execute }))
    await assert.rejects(readFile(join(dir, 'selection.orb-regions.zip')), /ENOENT/)
    assert.equal(JSON.parse(await readFile(join(dir, 'export.json'))).status, 'failed')
  }
})
test('Logic rejects output symlinks escaping its job directory', async () => {
  const outside = await directory(), dir = await directory()
  await writeFile(join(outside, 'out.wav'), wav())
  await symlink(join(outside, 'out.wav'), join(dir, 'escape.wav'))
  await assert.rejects(exportLogicTracks({ directory: dir, sessionId, options, execute: async () => ({
    sessionId, revision, restored: true, files: ids.map(id => ({ id, name: 'Track', path: 'escape.wav' })),
  }) }), /output path/)
})
