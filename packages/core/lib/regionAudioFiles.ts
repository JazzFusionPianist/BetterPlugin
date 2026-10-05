import { parseRegionBundle, sha256, type BundleAsset, type BundleRegion } from './regionBundle.ts'
import { cropWaveRegion } from './regionVstXml.ts'

export interface AudioFileTrack {
  url: string; name: string; assetId?: string; regionId?: string; regionBundle?: unknown
}
export interface AudioFileTransfer {
  url: string; name: string; key: string; asset?: BundleAsset; region?: BundleRegion
}

/** One dragged file per occurrence, not per deduplicated source asset. */
export function audioFileTransfers(tracks: AudioFileTrack[]): AudioFileTransfer[] {
  const files: AudioFileTransfer[] = [], seen = new Set<string>()
  const shared = tracks.find(t => t.regionBundle)?.regionBundle
  for (const track of tracks) {
    const value = track.regionBundle ?? shared
    if (!value) { files.push({ url: track.url, name: track.name, key: track.url }); continue }
    const bundle = parseRegionBundle(value)
    if (!bundle) throw new Error('Invalid region bundle.')
    const regions = bundle.regions.filter(r => track.regionId ? r.id === track.regionId : r.assetId === track.assetId)
    if (!regions.length) throw new Error('Missing region audio.')
    for (const region of regions) {
      const identity = `${bundle.id}:${region.id}`
      if (seen.has(identity)) continue
      seen.add(identity)
      const asset = bundle.assets.find(a => a.id === region.assetId)!
      if (track.assetId !== asset.id) throw new Error('Region audio does not match its asset.')
      const extension = asset.name.match(/\.[a-z0-9]{1,8}$/i)?.[0] ?? ''
      const name = region.name.replace(/[/\\]/g, '_').replace(/\.(wav|wave|aif|aiff|caf|mp3|m4a|flac|ogg|opus|aac)$/i, '')
      files.push({ url: track.url, name: name + extension,
        key: `region-audio:${JSON.stringify([track.url, asset.sha256, region.offsetFrames, region.lengthFrames])}`,
        asset, region })
    }
  }
  return files
}

/** Preserve full files byte-for-byte; trim known WAV regions without silence padding. */
export async function renderRegionAudio(transfer: AudioFileTransfer, bytes: Uint8Array<ArrayBuffer>): Promise<File> {
  const { asset, region } = transfer
  const file = new File([bytes], transfer.name)
  if (!asset || !region) return file
  if (bytes.length !== asset.bytes || await sha256(bytes.buffer) !== asset.sha256)
    throw new Error('Region audio failed integrity verification.')
  if (region.offsetFrames === 0 && region.lengthFrames === asset.frames) return file
  if (region.offsetFrames === null || region.lengthFrames === null) throw new Error('Region trim is unknown.')
  return cropWaveRegion(file, { name: transfer.name, offsetFrames: region.offsetFrames, lengthFrames: region.lengthFrames })
}
