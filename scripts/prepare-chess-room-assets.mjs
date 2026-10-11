import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const { default: sharp } = await import(process.env.SHARP_MODULE || 'sharp')
const root = new URL('../packages/core/assets/chess-room3d/', import.meta.url)
await mkdir(root, { recursive: true })
const assets = { walnut: 'smoked_walnut_veneer', leather: 'brown_leather', plaster: 'plastered_wall_03', parquet: 'herringbone_parquet' }
const records = []
async function download(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${response.status}: ${url}`)
  return Buffer.from(await response.arrayBuffer())
}
for (const [name, id] of Object.entries(assets)) {
  const metadata = JSON.parse((await download(`https://api.polyhaven.com/files/${id}`)).toString())
  for (const [map, key] of Object.entries({ color: 'Diffuse', normal: 'nor_gl', roughness: 'Rough' })) {
    const source = metadata[key]['1k'].jpg
    const bytes = await download(source.url)
    if (createHash('md5').update(bytes).digest('hex') !== source.md5) throw new Error(`Integrity failure: ${id}/${key}`)
    const file = `${name}-${map}.webp`
    await sharp(bytes).webp({ quality: map === 'normal' ? 95 : 90 }).toFile(new URL(file, root).pathname)
    records.push({ file, source: source.url, asset: `https://polyhaven.com/a/${id}`, license: 'CC0-1.0' })
  }
}
await writeFile(new URL('sources.json', root), `${JSON.stringify(records, null, 2)}\n`)
console.log(`Prepared ${records.length} bundled room assets; no runtime third-party requests.`)
