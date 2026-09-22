/** Portable, non-destructive region layout. File timestamps are not clip positions. */
export interface SampleTime { samples: number; sampleRate: number }
export interface BundleTrack { id: string; name: string; order: number; channels: number }
export interface BundleAsset {
  id: string
  sha256: string
  name: string
  bytes: number
  sampleRate: number | null
  channels: number | null
  frames: number | null
}
export interface BundleRegion {
  id: string
  assetId: string
  trackId: string | null
  name: string
  start: SampleTime | null
  offsetFrames: number | null
  lengthFrames: number | null
}
export interface RegionBundle {
  format: 'orb-region-bundle'
  version: 1
  id: string
  source: { daw: string; projectId: string; captureId: string } | null
  // All starts are relative to song zero, not SMPTE midnight or the playhead.
  timebase: 'song-samples'
  tracks: BundleTrack[]
  regions: BundleRegion[]
  assets: BundleAsset[]
}
export interface BundleAudioEntry {
  url: string
  name: string
  assetId: string
  // The first entry carries the layout. Older clients still see an audio array.
  regionBundle?: RegionBundle
}
export interface AssetProbe { sampleRate?: number; channels?: number; frames?: number }
export const BUNDLE_MAX_REGIONS = 512
export const BUNDLE_MAX_BYTES = 500 * 1024 * 1024

function record(v: unknown): v is Record<string, unknown> { return !!v && typeof v === 'object' && !Array.isArray(v) }
function text(v: unknown, max = 512): v is string { return typeof v === 'string' && v.length > 0 && v.length <= max }
function int(v: unknown, min = 0): v is number { return Number.isSafeInteger(v) && (v as number) >= min }
function optionalInt(v: unknown, min = 0): boolean { return v === null || int(v, min) }
function time(v: unknown): v is SampleTime {
  return record(v) && Number.isSafeInteger(v.samples) && int(v.sampleRate, 1) && v.sampleRate <= 768000
}
function uniqueIds(items: unknown[], max: number): boolean {
  return items.length <= max && items.every(v => record(v) && text(v.id, 128))
    && new Set(items.map(v => (v as { id: string }).id)).size === items.length
}

function remoteAudioUrl(value: string): boolean {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase().replace(/\.$/, '')
    return url.protocol === 'https:' && !url.username && !url.password
      && host.includes('.') && !host.endsWith('.localhost') && !host.endsWith('.local')
      && !host.endsWith('.internal') && !host.includes(':') && !/^\d+(\.\d+){3}$/.test(host)
  } catch { return false }
}

/** Validate remote JSON before rendering, downloading or requesting host edits. */
export function parseRegionBundle(value: unknown): RegionBundle | null {
  if (!record(value) || value.format !== 'orb-region-bundle' || value.version !== 1
    || !text(value.id, 128) || value.timebase !== 'song-samples'
    || !Array.isArray(value.tracks) || !Array.isArray(value.regions) || !Array.isArray(value.assets)
    || !uniqueIds(value.tracks, BUNDLE_MAX_REGIONS) || !uniqueIds(value.regions, BUNDLE_MAX_REGIONS)
    || !uniqueIds(value.assets, BUNDLE_MAX_REGIONS) || !value.regions.length || !value.assets.length) return null
  if (value.source !== null && (!record(value.source) || !text(value.source.daw)
    || !text(value.source.projectId, 128) || !text(value.source.captureId, 128))) return null
  for (const t of value.tracks) {
    if (!record(t) || !text(t.name) || !int(t.order) || !int(t.channels, 1) || t.channels > 64) return null
  }
  for (const a of value.assets) {
    if (!record(a) || !text(a.name) || typeof a.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(a.sha256)
      || !int(a.bytes, 1) || a.bytes > BUNDLE_MAX_BYTES || !optionalInt(a.sampleRate, 1)
      || !optionalInt(a.channels, 1) || !optionalInt(a.frames, 1)
      || (typeof a.channels === 'number' && a.channels > 64)
      || (typeof a.sampleRate === 'number' && a.sampleRate > 768000)) return null
  }
  const assets = new Map(value.assets.map(a => [a.id, a]))
  if (new Set(value.assets.map(a => a.sha256)).size !== value.assets.length) return null
  const tracks = new Set(value.tracks.map(t => t.id))
  let total = 0
  for (const a of value.assets) total += a.bytes
  if (total > BUNDLE_MAX_BYTES) return null
  for (const r of value.regions) {
    if (!record(r) || !text(r.name) || !assets.has(r.assetId) || (r.trackId !== null && !tracks.has(r.trackId))
      || (r.start !== null && !time(r.start)) || !optionalInt(r.offsetFrames)
      || !optionalInt(r.lengthFrames, 1)) return null
    const a = assets.get(r.assetId)!
    if (a.frames !== null && typeof r.offsetFrames === 'number' && typeof r.lengthFrames === 'number'
      && r.offsetFrames + r.lengthFrames > a.frames) return null
  }
  const regions = value.regions as BundleRegion[]
  if (value.assets.some(a => !regions.some(r => r.assetId === a.id))
    || value.tracks.some(t => !regions.some(r => r.trackId === t.id))) return null
  // Strip unknown keys; never forward unvalidated fields to a host adapter.
  return {
    format: 'orb-region-bundle', version: 1, id: value.id, timebase: 'song-samples',
    source: value.source === null ? null : {
      daw: value.source.daw as string, projectId: value.source.projectId as string, captureId: value.source.captureId as string,
    },
    tracks: value.tracks.map(t => ({ id: t.id, name: t.name, order: t.order, channels: t.channels })),
    assets: value.assets.map(a => ({ id: a.id, sha256: a.sha256, name: a.name, bytes: a.bytes,
      sampleRate: a.sampleRate, channels: a.channels, frames: a.frames })),
    regions: value.regions.map(r => ({ id: r.id, assetId: r.assetId, trackId: r.trackId, name: r.name,
      start: r.start === null ? null : { samples: r.start.samples, sampleRate: r.start.sampleRate },
      offsetFrames: r.offsetFrames, lengthFrames: r.lengthFrames })),
  }
}

export function hasCompleteLayout(b: RegionBundle): boolean {
  return b.source !== null && b.tracks.length > 0 && b.regions.every(r =>
    r.trackId !== null && r.start !== null && r.offsetFrames !== null && r.lengthFrames !== null
    && b.assets.find(a => a.id === r.assetId)?.sampleRate != null)
}

export async function sha256(data: ArrayBuffer): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), x => x.toString(16).padStart(2, '0')).join('')
}

/** Retain every region occurrence, even when identical audio can share one asset. */
export async function prepareRegionBundle(
  files: File[], inspect: (file: File) => Promise<AssetProbe> = async () => ({}),
): Promise<{ bundle: RegionBundle; filesByAsset: Map<string, File> }> {
  if (!files.length || files.length > BUNDLE_MAX_REGIONS) throw new Error('Choose between 1 and 512 regions.')
  if (files.some(f => !f.size) || files.reduce((s, f) => s + f.size, 0) > BUNDLE_MAX_BYTES)
    throw new Error('A region bundle must contain audio and be smaller than 500 MB.')
  const bundle: RegionBundle = { format: 'orb-region-bundle', version: 1, id: crypto.randomUUID(),
    source: null, timebase: 'song-samples', tracks: [], regions: [], assets: [] }
  const filesByAsset = new Map<string, File>()
  for (const file of files) {
    const hash = await sha256(await file.arrayBuffer())
    const assetId = hash
    let asset = bundle.assets.find(a => a.id === assetId)
    if (!asset) {
      const probe = await inspect(file)
      asset = { id: assetId, sha256: hash, name: file.name, bytes: file.size,
        sampleRate: probe.sampleRate ?? null, channels: probe.channels ?? null, frames: probe.frames ?? null }
      bundle.assets.push(asset)
      filesByAsset.set(assetId, file)
    }
    bundle.regions.push({ id: crypto.randomUUID(), assetId, name: file.name, trackId: null,
      start: null, offsetFrames: 0, lengthFrames: asset.frames })
  }
  if (!parseRegionBundle(bundle)) throw new Error('Unsupported audio metadata in region bundle.')
  return { bundle, filesByAsset }
}

/** No message is published when any upload fails. Successful orphan uploads can be retried. */
export async function uploadRegionBundle(
  prepared: Awaited<ReturnType<typeof prepareRegionBundle>>,
  upload: (file: File) => Promise<{ url: string; name: string } | null>,
): Promise<BundleAudioEntry[]> {
  const bundle = parseRegionBundle(prepared.bundle)
  if (!bundle) throw new Error('Invalid region bundle.')
  const entries: BundleAudioEntry[] = []
  for (const asset of bundle.assets) {
    const file = prepared.filesByAsset.get(asset.id)
    if (!file) throw new Error(`Missing audio: ${asset.name}`)
    const result = await upload(file)
    if (!result) throw new Error(`Could not upload ${asset.name}. The bundle was not sent.`)
    if (!remoteAudioUrl(result.url)) throw new Error('The upload returned an invalid audio URL.')
    entries.push({ url: result.url, name: asset.name, assetId: asset.id })
  }
  entries[0]!.regionBundle = bundle
  return entries
}

export function readBundleAttachment(value: unknown): { bundle: RegionBundle; entries: BundleAudioEntry[] } | null {
  if (!Array.isArray(value) || !value.length || value.length > BUNDLE_MAX_REGIONS) return null
  const bundle = parseRegionBundle(value[0]?.regionBundle)
  if (!bundle || value.length !== bundle.assets.length) return null
  const seen = new Set<string>()
  const entries: BundleAudioEntry[] = []
  for (const entry of value) {
    if (!record(entry) || !text(entry.url, 8192) || !text(entry.name) || !text(entry.assetId, 128)
      || seen.has(entry.assetId) || !bundle.assets.some(a => a.id === entry.assetId)) return null
    // Remote attachments cannot address local files or services.
    if (!remoteAudioUrl(entry.url)) return null
    seen.add(entry.assetId)
    entries.push({ url: entry.url, name: entry.name, assetId: entry.assetId })
  }
  entries[0]!.regionBundle = bundle
  return { bundle, entries }
}

/** Exact integer conversion, rounded once at the destination sample rate. */
export function rescaleSamples(samples: number, sourceRate: number, destinationRate: number): number {
  if (!Number.isSafeInteger(samples) || !int(sourceRate, 1) || !int(destinationRate, 1)) throw new Error('Invalid sample time.')
  const n = BigInt(samples) * BigInt(destinationRate)
  const d = BigInt(sourceRate)
  const rounded = n >= 0n ? (n + d / 2n) / d : -((-n + d / 2n) / d)
  const result = Number(rounded)
  if (!Number.isSafeInteger(result)) throw new Error('Sample time is out of range.')
  return result
}

/** Plan only: executing this requires a verified, project-bound DAW adapter. */
export function planRegionImport(value: unknown, destinationRate: number) {
  const bundle = parseRegionBundle(value)
  if (!bundle || !hasCompleteLayout(bundle)) throw new Error('The DAW did not supply a complete track layout.')
  if (!int(destinationRate, 1) || destinationRate > 768000) throw new Error('Invalid destination sample rate.')
  return bundle.tracks.slice().sort((a, b) => a.order - b.order).map(track => ({
    sourceTrackId: track.id, name: track.name, channels: track.channels,
    regions: bundle.regions.filter(r => r.trackId === track.id).map(r => ({
      sourceRegionId: r.id, assetId: r.assetId, name: r.name,
      startSamples: rescaleSamples(r.start!.samples, r.start!.sampleRate, destinationRate),
      // Offsets/lengths address the original asset, never a resampled buffer.
      sourceOffsetFrames: r.offsetFrames!, sourceLengthFrames: r.lengthFrames!,
      sourceSampleRate: bundle.assets.find(a => a.id === r.assetId)!.sampleRate!,
    })),
  }))
}
