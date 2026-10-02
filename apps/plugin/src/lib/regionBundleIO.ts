import { prepareSharedRegions } from './regionSharing'
import { buildZip, type ZipEntry } from './zipStore'
import { resolveUrl } from './r2Access'
import { uploadRegionBundle, readBundleAttachment, sha256, type BundleAudioEntry } from './regionBundle'
import { isRegionArchive, prepareArchivedRegionBundle } from '@orb/core/lib/regionArchive.ts'
export { isRegionArchive } from '@orb/core/lib/regionArchive.ts'

export async function prepareRegionTransfer(files: File[]) {
  if (files.some(isRegionArchive)) {
    if (files.length !== 1) throw new Error('Send one region bundle at a time, without additional files.')
    return prepareArchivedRegionBundle(files[0])
  }
  return prepareSharedRegions(files)
}

export async function createRegionBundleAttachment(
  files: File[], upload: (file: File) => Promise<{ url: string; name: string } | null>,
) {
  const prepared = await prepareRegionTransfer(files)
  const entries = await uploadRegionBundle(prepared, upload)
  return { url: JSON.stringify(entries), type: 'multi-audio' as const,
    name: `${prepared.bundle.regions.length} regions` }
}

/** A portable archive, not a claim that a DAW accepts ZIP as a timeline import. */
export async function downloadRegionBundle(entries: BundleAudioEntry[], signal: AbortSignal): Promise<Blob> {
  const parsed = readBundleAttachment(entries)
  if (!parsed) throw new Error('Invalid region bundle.')
  const files: ZipEntry[] = []
  const paths: Record<string, string> = {}
  for (const asset of parsed.bundle.assets) {
    const entry = parsed.entries.find(e => e.assetId === asset.id)!
    const response = await fetch(await resolveUrl(entry.url), { signal, credentials: 'omit', redirect: 'error' })
    if (!response.ok || !response.body) throw new Error(`Could not download ${asset.name}.`)
    const reader = response.body.getReader()
    const chunks: Uint8Array<ArrayBuffer>[] = []
    let size = 0
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > asset.bytes) throw new Error(`Size mismatch: ${asset.name}`)
        chunks.push(value)
      }
    } finally { await reader.cancel() }
    if (size !== asset.bytes) throw new Error(`Incomplete download: ${asset.name}`)
    const bytes = await new Blob(chunks).arrayBuffer()
    if (await sha256(bytes) !== asset.sha256) throw new Error(`Checksum mismatch: ${asset.name}`)
    const extension = asset.name.split('.').pop()?.toLowerCase() ?? ''
    const path = `audio/${asset.sha256}.${/^[a-z0-9]{1,8}$/.test(extension) ? extension : 'bin'}`
    paths[asset.id] = path
    files.push({ name: path, data: bytes })
  }
  files.unshift({ name: 'orb-regions.json', data: new TextEncoder().encode(JSON.stringify({
    ...parsed.bundle, assetPaths: paths,
  }, null, 2)) })
  signal.throwIfAborted()
  return buildZip(files)
}
