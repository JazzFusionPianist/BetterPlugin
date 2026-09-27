import { hasCompleteLayout, parseRegionBundle, type RegionBundle } from './regionBundle.ts'

export function planVstRegionDrag(value: unknown, tokens: Map<string, string>) {
  const b = parseRegionBundle(value)
  if (!b || !hasCompleteLayout(b)) throw new Error('Exact positions and tracks are required.')
  const trackIds = new Map(b.tracks.map(t => [t.id, `{${crypto.randomUUID().toUpperCase()}}`]))
  return b.regions.map(r => {
    const token = tokens.get(r.assetId)
    if (!token || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(token)) throw new Error('Missing cached region audio.')
    const seconds = r.start!.samples / r.start!.sampleRate
    if (seconds < 0 || !Number.isFinite(seconds) || Math.round(seconds * r.start!.sampleRate) !== r.start!.samples)
      throw new Error('Region time is not representable.')
    return { token, channel: trackIds.get(r.trackId!)!, name: r.name, seconds,
      offset: r.offsetFrames!, end: r.offsetFrames! + r.lengthFrames! }
  })
}

export interface VstRegionEvidence {
  format: 'vst-xml'; version: 1; captureId: string; sourceApp: string
  channelId: string | null; name: string; offsetFrames: number; lengthFrames: number
  positionSeconds: number | null
}
export function parseVstEvidence(value: unknown): VstRegionEvidence | null {
  if (!value || typeof value !== 'object') return null
  const v = value as VstRegionEvidence
  const text = (s: unknown, max: number) => typeof s === 'string' && s.length > 0 && s.length <= max
  if (v.format !== 'vst-xml' || v.version !== 1 || !text(v.captureId, 128) || !text(v.sourceApp, 512)
    || !text(v.name, 512) || !(v.channelId === null || text(v.channelId, 128))
    || !Number.isSafeInteger(v.offsetFrames) || v.offsetFrames < 0
    || !Number.isSafeInteger(v.lengthFrames) || v.lengthFrames < 1
    || !(v.positionSeconds === null || (Number.isFinite(v.positionSeconds) && v.positionSeconds >= 0))) return null
  return { format: 'vst-xml', version: 1, captureId: v.captureId, sourceApp: v.sourceApp,
    name: v.name, channelId: v.channelId, offsetFrames: v.offsetFrames,
    lengthFrames: v.lengthFrames, positionSeconds: v.positionSeconds }
}

/** Do not silently round a source time onto a different source sample grid. */
function sampleTime(seconds: number, rate: number) {
  for (const r of new Set([rate, 44100, 48000, 88200, 96000, 176400, 192000, 384000, 768000])) {
    const samples = Math.round(seconds * r)
    if (Number.isSafeInteger(samples) && Math.abs(samples - seconds * r) < 0.000001)
      return { samples, sampleRate: r }
  }
  return null
}

/** Only cropped, byte-preserving audio enters the upload bundle. */
export function applyVstLayout(bundle: RegionBundle, evidence: VstRegionEvidence[]): RegionBundle {
  if (evidence.length !== bundle.regions.length || evidence.some(e => !parseVstEvidence(e)
    || e.captureId !== evidence[0]?.captureId || e.sourceApp !== evidence[0]?.sourceApp))
    throw new Error('Mixed or incomplete DAW region drop. Nothing was sent.')
  const b = structuredClone(bundle)
  b.source = { daw: evidence[0]!.sourceApp, projectId: `drop:${evidence[0]!.captureId}`, captureId: evidence[0]!.captureId }
  b.tracks = []
  b.regions.forEach((region, i) => {
    const e = evidence[i]!, asset = b.assets.find(a => a.id === region.assetId)!
    if (!asset.sampleRate || !asset.channels || asset.frames !== e.lengthFrames)
      throw new Error('DAW region crop does not match its audio.')
    region.name = e.name
    region.offsetFrames = 0
    region.lengthFrames = e.lengthFrames
    region.start = e.positionSeconds === null ? null : sampleTime(e.positionSeconds, asset.sampleRate)
    region.trackId = e.channelId
    if (e.channelId && !b.tracks.some(t => t.id === e.channelId))
      b.tracks.push({ id: e.channelId, name: `Shared track ${b.tracks.length + 1}`, order: b.tracks.length, channels: asset.channels })
    if (e.channelId && b.tracks.find(t => t.id === e.channelId)!.channels !== asset.channels)
      throw new Error('Mixed channel formats on one shared track are not supported.')
  })
  const checked = parseRegionBundle(b)
  if (!checked) throw new Error('Invalid DAW region layout.')
  return checked
}

/** Lossless PCM crop. Deliberately excludes unselected source audio and private metadata. */
export async function cropVstWave(file: File, evidence: VstRegionEvidence): Promise<File> {
  if (!parseVstEvidence(evidence)) throw new Error('Invalid DAW region metadata.')
  const bytes = new Uint8Array(await file.arrayBuffer()), v = new DataView(bytes.buffer)
  const tag = (p: number) => String.fromCharCode(...bytes.subarray(p, p + 4))
  if (bytes.length < 44 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE' || v.getUint32(4, true) + 8 !== bytes.length)
    throw new Error('This region transfer requires PCM or float WAV audio.')
  let fmt: Uint8Array | undefined, data: Uint8Array | undefined, block = 0, codec = 0
  for (let p = 12; p + 8 <= bytes.length;) {
    const size = v.getUint32(p + 4, true), at = p + 8
    if (at + size > bytes.length) throw new Error('Invalid WAV chunk.')
    if (tag(p) === 'fmt ') {
      if (fmt || size < 16) throw new Error('Invalid WAV format.')
      codec = v.getUint16(at, true)
      const channels = v.getUint16(at + 2, true), rate = v.getUint32(at + 4, true), bits = v.getUint16(at + 14, true)
      block = v.getUint16(at + 12, true)
      if (!((codec === 1 && [16, 24, 32].includes(bits)) || (codec === 3 && [32, 64].includes(bits)))
        || channels < 1 || channels > 2 || rate < 1 || rate > 768000 || block !== channels * bits / 8
        || v.getUint32(at + 8, true) !== rate * block) throw new Error('Unsupported WAV encoding.')
      fmt = bytes.slice(at, at + 16)
    }
    if (tag(p) === 'data') { if (data) throw new Error('Multiple audio chunks.'); data = bytes.subarray(at, at + size) }
    p = at + size + size % 2
  }
  if (!fmt || !data || data.length % block || evidence.offsetFrames + evidence.lengthFrames > data.length / block)
    throw new Error('DAW region trim lies outside the audio file.')
  const pcm = data.subarray(evidence.offsetFrames * block, (evidence.offsetFrames + evidence.lengthFrames) * block)
  const extra = codec === 3 ? 12 : 0, out = new Uint8Array(44 + extra + pcm.length + pcm.length % 2), view = new DataView(out.buffer)
  const put = (s: string, p: number) => out.set(new TextEncoder().encode(s), p)
  put('RIFF', 0); view.setUint32(4, out.length - 8, true); put('WAVEfmt ', 8); view.setUint32(16, 16, true); out.set(fmt, 20)
  if (extra) { put('fact', 36); view.setUint32(40, 4, true); view.setUint32(44, evidence.lengthFrames, true) }
  put('data', 36 + extra); view.setUint32(40 + extra, pcm.length, true); out.set(pcm, 44 + extra)
  return new File([out], `${evidence.name.replace(/[/\\]/g, '_').replace(/\.(wav|wave)$/i, '')}.wav`, { type: 'audio/wav' })
}
