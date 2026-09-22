import { unzipSync } from 'fflate'
import { BUNDLE_MAX_BYTES, parseRegionBundle, sha256 } from './regionBundle.ts'

export const BUNDLE_MAX_ARCHIVE_BYTES = BUNDLE_MAX_BYTES + 2 * 1024 * 1024
export const isRegionArchive = (file: { name: string }) => /\.orb-regions\.zip$/i.test(file.name)

/** Bounded extraction shared by the browser and local DAW helper. No filesystem paths are trusted. */
export function unpackRegionArchive(bytes: Uint8Array) {
  if (bytes.byteLength > BUNDLE_MAX_ARCHIVE_BYTES) throw new Error('Region archive is too large.')
  let manifests = 0
  const first = unzipSync(bytes, { filter: file => {
    if (file.name !== 'orb-regions.json') return false
    if (++manifests !== 1 || file.originalSize > 1024 * 1024) throw new Error('Invalid bundle manifest.')
    return true
  } })
  if (manifests !== 1) throw new Error('Missing bundle manifest.')
  const raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(first['orb-regions.json']))
  const bundle = parseRegionBundle(raw)
  if (!bundle || !raw.assetPaths || typeof raw.assetPaths !== 'object' || Array.isArray(raw.assetPaths))
    throw new Error('Invalid bundle manifest.')
  const expected = new Map<string, (typeof bundle.assets)[number]>()
  for (const asset of bundle.assets) {
    const path = Object.prototype.hasOwnProperty.call(raw.assetPaths, asset.id) ? raw.assetPaths[asset.id] : undefined
    if (typeof path !== 'string' || !new RegExp(`^audio/${asset.sha256}\\.[a-z0-9]{1,8}$`).test(path)
      || expected.has(path)) throw new Error('Invalid audio path.')
    expected.set(path, asset)
  }
  if (Object.keys(raw.assetPaths).length !== bundle.assets.length) throw new Error('Unexpected audio path.')
  const seen = new Set<string>()
  const files = unzipSync(bytes, { filter: file => {
    if (file.name === 'orb-regions.json') return false
    const asset = expected.get(file.name)
    if (!asset || seen.has(file.name) || file.originalSize !== asset.bytes) throw new Error('Unexpected audio entry.')
    seen.add(file.name)
    return true
  } })
  if (seen.size !== expected.size) throw new Error('Missing audio entry.')
  const assets = new Map<string, { path: string; bytes: Uint8Array }>()
  for (const [path, asset] of expected) {
    if (files[path].byteLength !== asset.bytes) throw new Error(`Damaged audio: ${asset.name}`)
    assets.set(asset.id, { path, bytes: files[path] })
  }
  return { bundle, assets }
}

/** Reattach a downloaded bundle without rebuilding (and losing) its source layout. */
export async function prepareArchivedRegionBundle(file: File) {
  if (!isRegionArchive(file)) throw new Error('Choose an Orb region bundle.')
  if (file.size > BUNDLE_MAX_ARCHIVE_BYTES) throw new Error('Region archive is too large.')
  const { bundle, assets } = unpackRegionArchive(new Uint8Array(await file.arrayBuffer()))
  const filesByAsset = new Map<string, File>()
  for (const asset of bundle.assets) {
    const bytes = Uint8Array.from(assets.get(asset.id)!.bytes)
    if (await sha256(bytes.buffer) !== asset.sha256) throw new Error(`Damaged audio: ${asset.name}`)
    filesByAsset.set(asset.id, new File([bytes], asset.name))
  }
  // Re-sharing is a new transfer; the source capture and region identities stay intact.
  return { bundle: { ...bundle, id: crypto.randomUUID() }, filesByAsset }
}
