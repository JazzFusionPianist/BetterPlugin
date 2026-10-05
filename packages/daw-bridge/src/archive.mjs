import { createHash } from 'node:crypto'
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BUNDLE_MAX_ARCHIVE_BYTES, unpackRegionArchive } from '../../core/lib/regionArchive.ts'

const digest = bytes => createHash('sha256').update(bytes).digest('hex')

export function readRegionArchive(bytes) {
  const { bundle, assets } = unpackRegionArchive(bytes)
  for (const asset of bundle.assets)
    if (digest(assets.get(asset.id).bytes) !== asset.sha256) throw new Error(`Damaged audio: ${asset.name}`)
  return { bundle, assets, archiveHash: digest(bytes) }
}

/** Extract only validated, hash-named audio. The cache survives partial host failures. */
export async function stageArchive(path, cacheRoot) {
  if ((await stat(path)).size > BUNDLE_MAX_ARCHIVE_BYTES) throw new Error('Region archive is too large.')
  const parsed = readRegionArchive(await readFile(path))
  const directory = join(cacheRoot, parsed.archiveHash)
  await mkdir(join(directory, 'audio'), { recursive: true, mode: 0o700 })
  const paths = new Map()
  for (const [id, asset] of parsed.assets) {
    const destination = join(directory, asset.path)
    try { await writeFile(destination, asset.bytes, { flag: 'wx', mode: 0o600 }) }
    catch (error) {
      if (error.code !== 'EEXIST' || digest(await readFile(destination)) !== digest(asset.bytes)) throw error
    }
    paths.set(id, destination)
  }
  return { bundle: parsed.bundle, paths, directory }
}
