import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const source = await readFile('/tmp/slur-chess-set.gltf')
const binary = await readFile('/tmp/slur-chess-set.bin')
for (const [bytes, expected] of [[source, 'ceac1016348f797f3db112e3e70a96a4'], [binary, '815ae6d5becbcdd836b29b0d644bba95']]) {
  if (createHash('md5').update(bytes).digest('hex') !== expected) throw new Error('Poly Haven source checksum mismatch')
}
const original = JSON.parse(source)
const gltf = { asset: { version: '2.0', extras: { source: 'https://polyhaven.com/a/chess_set', author: 'Riley Queen', license: 'CC0-1.0' } }, scene: 0, scenes: [{ nodes: [0, 1, 2, 3, 4, 5] }], nodes: [], meshes: [], accessors: [], bufferViews: [], buffers: [] }
const chunks = [], copied = new Map()
let offset = 0
function accessor(index) {
  if (copied.has(index)) return copied.get(index)
  const info = original.accessors[index], view = original.bufferViews[info.bufferView]
  const bytes = binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength)
  const padding = (4 - bytes.length % 4) % 4
  gltf.bufferViews.push({ ...view, buffer: 0, byteOffset: offset })
  gltf.accessors.push({ ...info, bufferView: gltf.bufferViews.length - 1 })
  chunks.push(bytes, Buffer.alloc(padding)); offset += bytes.length + padding
  copied.set(index, gltf.accessors.length - 1)
  return gltf.accessors.length - 1
}
for (const [index, name] of ['R', 'P', 'B', 'Q', 'K', 'N'].entries()) {
  gltf.nodes.push({ name, mesh: index })
  gltf.meshes.push({ name, primitives: original.meshes[index].primitives.map(p => ({
    attributes: Object.fromEntries(Object.entries(p.attributes).map(([key, value]) => [key, accessor(value)])),
    indices: accessor(p.indices), mode: p.mode ?? 4,
  })) })
}
gltf.buffers.push({ byteLength: offset })
const json = Buffer.from(JSON.stringify(gltf))
const padded = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)])
const header = Buffer.alloc(12), jsonHeader = Buffer.alloc(8), binHeader = Buffer.alloc(8)
header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + padded.length + offset, 8)
jsonHeader.writeUInt32LE(padded.length); jsonHeader.writeUInt32LE(0x4e4f534a, 4)
binHeader.writeUInt32LE(offset); binHeader.writeUInt32LE(0x004e4942, 4)
const output = Buffer.concat([header, jsonHeader, padded, binHeader, ...chunks])
await writeFile(new URL('../packages/core/assets/chess-pieces.glb', import.meta.url), output)
console.log(`Six CC0 piece meshes, ${output.length} bytes; board, duplicate pieces and textures omitted.`)
