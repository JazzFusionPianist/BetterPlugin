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

/**
 * Stamp a WAV with a BWF bext TimeReference (samples since SMPTE midnight), replacing any
 * existing bext. Samples are unchanged. Receivers "spot"/"move to recorded position" with it.
 */
export function withBroadcastTimeReference(bytes: Uint8Array, timeReference: number): Uint8Array<ArrayBuffer> {
  if (!Number.isSafeInteger(timeReference) || timeReference < 0) throw new Error('Invalid time reference.')
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const tag = (p: number) => String.fromCharCode(...bytes.subarray(p, p + 4))
  if (bytes.length < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('Not a WAV file.')
  const chunks: Uint8Array[] = []
  for (let p = 12; p + 8 <= bytes.length;) {
    const size = v.getUint32(p + 4, true), end = Math.min(bytes.length, p + 8 + size + (size % 2))
    if (tag(p) !== 'bext') chunks.push(bytes.subarray(p, end))
    p = end
  }
  const bext = new Uint8Array(8 + 602), bv = new DataView(bext.buffer)
  bext.set(new TextEncoder().encode('bext'), 0); bv.setUint32(4, 602, true)
  const put = (text: string, at: number, max: number) => bext.set(new TextEncoder().encode(text).subarray(0, max), 8 + at)
  put('Slur region', 0, 256); put('Slur', 256, 32)
  bv.setUint32(8 + 338, timeReference % 2 ** 32, true)
  bv.setUint32(8 + 342, Math.floor(timeReference / 2 ** 32), true)
  bv.setUint16(8 + 346, 1, true)   // BWF version 1
  // bext goes right after fmt, ahead of the (large) data chunk, where hosts look first.
  const fmtIndex = chunks.findIndex(c => String.fromCharCode(...c.subarray(0, 4)) === 'fmt ')
  chunks.splice(fmtIndex + 1, 0, bext)
  const total = 12 + chunks.reduce((n, c) => n + c.length, 0)
  const out = new Uint8Array(total), ov = new DataView(out.buffer)
  out.set(bytes.subarray(0, 12)); ov.setUint32(4, total - 8, true)
  let at = 12
  for (const c of chunks) { out.set(c, at); at += c.length }
  return out
}

/** Preserve full files byte-for-byte; trim known WAV regions without silence padding.
 * With `timeOffsetSeconds` (the receiving DAW's SMPTE at song zero, e.g. 3600 for
 * Logic's default 01:00:00:00), WAV regions with an exact start carry it as BWF. */
export async function renderRegionAudio(transfer: AudioFileTransfer, bytes: Uint8Array<ArrayBuffer>,
  options: { timeOffsetSeconds?: number } = {}): Promise<File> {
  const { asset, region } = transfer
  const file = new File([bytes], transfer.name)
  if (!asset || !region) return file
  if (bytes.length !== asset.bytes || await sha256(bytes.buffer) !== asset.sha256)
    throw new Error('Region audio failed integrity verification.')
  if (region.offsetFrames === null || region.lengthFrames === null) throw new Error('Region trim is unknown.')
  const whole = region.offsetFrames === 0 && region.lengthFrames === asset.frames
  const audio = whole ? file : await cropWaveRegion(file, { name: transfer.name, offsetFrames: region.offsetFrames, lengthFrames: region.lengthFrames })
  if (options.timeOffsetSeconds === undefined || !region.start || !asset.sampleRate || !/\.wave?$/i.test(audio.name)) return audio
  // Start in the file's own rate; song zero sits at the receiver's SMPTE offset.
  const start = Math.round(region.start.samples * asset.sampleRate / region.start.sampleRate)
  if (start < 0) return audio
  const stamped = withBroadcastTimeReference(new Uint8Array(await audio.arrayBuffer()),
    Math.round(options.timeOffsetSeconds * asset.sampleRate) + start)
  return new File([stamped], audio.name, { type: 'audio/wav' })
}
