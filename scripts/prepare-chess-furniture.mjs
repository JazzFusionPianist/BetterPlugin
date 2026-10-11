import { writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const models = { sofa_03: 'sofa', GreenChair_01: 'chair', round_wooden_table_02: 'side-table', industrial_pipe_lamp: 'table-lamp', industrial_wall_sconce: 'wall-lamp', brass_candleholders: 'candles' }
const id = process.argv[2] || 'sofa_03'
if (!models[id]) throw new Error('Unknown furniture asset')
const info = await (await fetch(`https://api.polyhaven.com/info/${id}`)).json()
const author = Object.keys(info.authors).join(', ')
const record = await (await fetch(`https://api.polyhaven.com/files/${id}`)).json()
const file = record.gltf['1k'].gltf
const sources = []
async function download(info) {
  const response = await fetch(info.url)
  if (!response.ok) throw new Error(`Download failed: ${response.status}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (createHash('md5').update(bytes).digest('hex') !== info.md5) throw new Error('Furniture checksum mismatch')
  sources.push({ url: info.url, md5: info.md5 })
  return bytes
}
const gltf = JSON.parse(await download(file))
if (id === 'brass_candleholders') {
  const node = gltf.nodes.find(node => node.name === 'brass_candleholder_01')
  gltf.meshes = [gltf.meshes[node.mesh]]
  gltf.nodes = [{ ...node, mesh: 0, translation: [0, 0, 0] }]
  gltf.scenes = [{ nodes: [0] }]
  const used = [...new Set(gltf.meshes[0].primitives.map(part => part.material))]
  for (const part of gltf.meshes[0].primitives) part.material = used.indexOf(part.material)
  gltf.materials = used.map(index => gltf.materials[index])
  const textureIds = []
  const visit = (object, remap) => {
    for (const [key, value] of Object.entries(object)) {
      if (!value || typeof value !== 'object') continue
      if (key.endsWith('Texture') && typeof value.index === 'number') {
        if (remap) value.index = textureIds.indexOf(value.index)
        else if (!textureIds.includes(value.index)) textureIds.push(value.index)
      } else visit(value, remap)
    }
  }
  visit(gltf.materials, false); visit(gltf.materials, true)
  gltf.textures = textureIds.map(index => gltf.textures[index])
  const imageIds = [...new Set(gltf.textures.map(texture => texture.source))]
  for (const texture of gltf.textures) texture.source = imageIds.indexOf(texture.source)
  gltf.images = imageIds.map(index => gltf.images[index])
}
const chunks = []
let offset = 0
async function append(info) {
  const bytes = await download(info), padding = (4 - bytes.length % 4) % 4
  const at = offset
  chunks.push(bytes, Buffer.alloc(padding)); offset += bytes.length + padding
  return { buffer: 0, byteOffset: at, byteLength: bytes.length }
}
const body = await append(file.include[gltf.buffers[0].uri])
for (const view of gltf.bufferViews) view.byteOffset = (view.byteOffset || 0) + body.byteOffset
for (const image of gltf.images || []) {
  const uri = image.uri
  gltf.bufferViews.push(await append(file.include[image.uri]))
  image.mimeType = uri.endsWith('.png') ? 'image/png' : 'image/jpeg'
  image.bufferView = gltf.bufferViews.length - 1
  delete image.uri
}
gltf.buffers = [{ byteLength: offset }]
gltf.asset.extras = { source: `https://polyhaven.com/a/${id}`, author, license: 'CC0-1.0' }
const json = Buffer.from(JSON.stringify(gltf)), padded = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)])
const header = Buffer.alloc(12), jsonHeader = Buffer.alloc(8), binHeader = Buffer.alloc(8)
header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + padded.length + offset, 8)
jsonHeader.writeUInt32LE(padded.length); jsonHeader.writeUInt32LE(0x4e4f534a, 4)
binHeader.writeUInt32LE(offset); binHeader.writeUInt32LE(0x004e4942, 4)
await writeFile(new URL(`../packages/core/assets/chess-${models[id]}.glb`, import.meta.url), Buffer.concat([header, jsonHeader, padded, binHeader, ...chunks]))
const modifications = id === 'brass_candleholders' ? 'Selected brass_candleholder_01 with its 1K materials; removed other candleholder nodes and unused textures. Packaged in a self-contained GLB; placement and turn-driven lighting supplied by Slur.' : 'Original 1K geometry/materials packaged in a self-contained GLB; placement and lighting supplied by Slur.'
await writeFile(new URL(`../packages/core/assets/chess-${models[id]}-source.json`, import.meta.url), JSON.stringify({ asset: `https://polyhaven.com/a/${id}`, author, license: 'CC0-1.0', licenseUrl: 'https://polyhaven.com/license', modifications, sources }, null, 2) + '\n')
console.log(`Bundled ${id}: ${offset} bytes`)
