/**
 * Merge several dragged DAW regions into a single audio file.
 *
 * When the user selects multiple regions on ONE track and drags them in,
 * the host delivers them as separate region files. This puts them back
 * together into one WAV so they arrive as a single clip — the common
 * "comp'd take / split region" workflow.
 *
 * Two strategies, chosen per drop:
 *
 *  • PLACED — every region carries a BWF/iXML timestamp (Logic, Pro Tools
 *    and Cubase all stamp their region exports). Each region is laid at
 *    its original sample position, the gaps between them are silence
 *    (in the explicit "placed" mode, overlapping regions are summed —
 *    mixed in place, with no gain change — rather than refused),
 *    and the merged file gets its own `bext` chunk whose TimeReference is
 *    the earliest region's — so the receiving DAW can "move to original
 *    position" the clip and it lands exactly where the sender had it.
 *
 *  • BACK-TO-BACK — no timestamps. Regions are joined in filename order
 *    (numeric-aware so "take 2" sorts before "take 10"). Gaps are lost,
 *    which is why this one only runs when the user explicitly asks.
 *
 * `resolveDawDrop` is the default policy for a multi-region drop: merge
 * silently when the timestamps prove the regions sit side by side on one
 * timeline, send separately when they overlap (that is two tracks, not
 * one), and leave the decision to the user when nothing can be proven.
 */
import { extractAudioTimeline } from './audioTimeline'
import { MERGED_OUTPUT_LIMIT } from './limits'
import type { AttachmentTimelineMetadata } from '../types/collab'

export interface DroppedRegion { name: string; data: string }  // data = base64 audio

/** Two comp regions may kiss by a crossfade; beyond this they are two tracks. */
const OVERLAP_TOLERANCE_SEC = 0.02

const REGION_MIME: Record<string, string> = {
  wav: 'audio/wav', aif: 'audio/aiff', aiff: 'audio/aiff', mp3: 'audio/mpeg',
  m4a: 'audio/mp4', caf: 'audio/x-caf', ogg: 'audio/ogg', flac: 'audio/flac',
}

/** Native-bridge base64 payload ({name,data} from __juceFileDrop) → File. */
export function regionToFile(name: string, data: string): File {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return new File([bytes], name, { type: REGION_MIME[ext] ?? 'audio/wav' })
}

function byName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
}

// ── Region analysis (header reads only, no decoding) ──────────────────────

export interface RegionInfo {
  file: File
  /** Embedded timeline the region carries (exact) or null. */
  timeline: AttachmentTimelineMetadata | null
  /** Original start, in samples at `sampleRate`. Present iff the stamp is exact. */
  start?: number
  sampleRate?: number
  bitDepth?: number
  channels?: number
  /** PCM frame count read from the WAV header (undefined for non-WAV). */
  frames?: number
}

function fourCC(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset]!, bytes[offset + 1]!, bytes[offset + 2]!, bytes[offset + 3]!)
}

interface WavFormat { frames: number; sampleRate?: number; bitDepth?: number; channels?: number }

/** PCM frame count + format of a WAV from its fmt/data chunk headers. */
async function wavFormat(file: File): Promise<WavFormat | undefined> {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  if (head.length < 12 || fourCC(head, 0) !== 'RIFF' || fourCC(head, 8) !== 'WAVE') return undefined
  let blockAlign: number | undefined
  let sampleRate: number | undefined
  let bitDepth: number | undefined
  let channels: number | undefined
  let dataSize: number | undefined
  for (let offset = 12; offset + 8 <= file.size;) {
    const header = new Uint8Array(await file.slice(offset, offset + 8).arrayBuffer())
    if (header.length < 8) break
    const id = fourCC(header, 0)
    const size = new DataView(header.buffer, header.byteOffset, 8).getUint32(4, true)
    const dataOffset = offset + 8
    if (id === 'fmt ' && size >= 16) {
      const fmt = new DataView(await file.slice(dataOffset, dataOffset + 16).arrayBuffer())
      if (fmt.byteLength >= 16) {
        channels = fmt.getUint16(2, true)
        sampleRate = fmt.getUint32(4, true)
        blockAlign = fmt.getUint16(12, true)
        bitDepth = fmt.getUint16(14, true)
      }
    }
    if (id === 'data') {
      // A streaming writer may leave the size unset; trust the file length then.
      dataSize = size === 0 || size === 0xFFFFFFFF ? file.size - dataOffset : Math.min(size, file.size - dataOffset)
      break
    }
    offset = dataOffset + size + (size & 1)
  }
  if (!blockAlign || dataSize == null) return undefined
  return { frames: Math.floor(dataSize / blockAlign), sampleRate, bitDepth, channels }
}

export async function analyzeRegion(file: File): Promise<RegionInfo> {
  const timeline = await extractAudioTimeline(file, null)
  const exact = timeline?.position.confidence === 'exact'
    && timeline.position.source_samples != null
    && !!timeline.position.sample_rate
  const format = await wavFormat(file)
  return {
    file,
    timeline,
    start: exact ? timeline.position.source_samples : undefined,
    sampleRate: timeline?.position.sample_rate ?? format?.sampleRate,
    bitDepth: timeline?.position.bit_depth ?? format?.bitDepth,
    channels: format?.channels,
    frames: format?.frames,
  }
}

// ── Placement (pure) ──────────────────────────────────────────────────────

export interface PlacedRegion { index: number; offset: number; frames: number }
export interface Placement {
  /** Output sample rate (the regions' own rate). */
  sampleRate: number
  /** Earliest region start, in output samples — becomes the bext TimeReference. */
  timeReference: number
  regions: PlacedRegion[]
  totalFrames: number
}

/**
 * Lay regions at their original positions. Returns the reason instead of
 * a plan when the regions can't be proven to share one timeline.
 *
 * `allowOverlap` skips the overlap refusal: regions that overlap in time
 * are planned anyway and the renderer mixes them (an explicit "keep
 * timing" merge treats overlaps as intentional). The default refusal
 * remains the policy check for auto-merging, where overlap means "two
 * tracks, not one".
 */
export function planPlacement(
  regions: { start?: number; sampleRate?: number; frames?: number }[],
  opts?: { allowOverlap?: boolean },
): { plan: Placement } | { reason: 'no-timing' | 'overlap' | 'mixed-rate' } {
  if (regions.some(r => r.start == null || !r.sampleRate || r.frames == null)) return { reason: 'no-timing' }
  const sampleRate = regions[0]!.sampleRate!
  if (regions.some(r => r.sampleRate !== sampleRate)) return { reason: 'mixed-rate' }

  const order = regions.map((r, index) => ({ index, start: r.start!, frames: r.frames! }))
    .sort((a, b) => a.start - b.start)
  if (!opts?.allowOverlap) {
    const tolerance = Math.round(OVERLAP_TOLERANCE_SEC * sampleRate)
    for (let i = 1; i < order.length; i++) {
      const previous = order[i - 1]!
      if (order[i]!.start < previous.start + previous.frames - tolerance) return { reason: 'overlap' }
    }
  }

  const timeReference = order[0]!.start
  const placed = order.map(r => ({ index: r.index, offset: r.start - timeReference, frames: r.frames }))
  const totalFrames = Math.max(...placed.map(r => r.offset + r.frames))
  return { plan: { sampleRate, timeReference, regions: placed, totalFrames } }
}

// ── WAV writer with a Broadcast Wave `bext` chunk ─────────────────────────

export interface WavOptions {
  sampleRate: number
  channels: number
  /** 16/24 write integer PCM; 32 writes IEEE float (format tag 3), which
   *  carries samples past ±1.0 losslessly instead of clipping them. */
  bitDepth: 16 | 24 | 32
  /** Original position in samples (BWF TimeReference). Omit for no bext chunk. */
  timeReference?: number
  description?: string
}

const BEXT_SIZE = 602  // EBU 3285 v1: fixed fields, no coding history

function writeAscii(view: DataView, offset: number, length: number, text: string) {
  for (let i = 0; i < length && i < text.length; i++) {
    const code = text.charCodeAt(i)
    view.setUint8(offset + i, code < 128 ? code : 63)
  }
}

/** Interleaved Float32 → WAV: integer PCM (16/24-bit) or IEEE float
 *  (32-bit, samples past ±1.0 kept as-is), optionally BWF-stamped. */
export function encodeWav(samples: Float32Array, opts: WavOptions): Blob {
  const { sampleRate, channels, bitDepth } = opts
  const float = bitDepth === 32
  const bytesPerSample = bitDepth / 8
  const blockAlign = channels * bytesPerSample
  const dataSize = samples.length * bytesPerSample
  const withBext = opts.timeReference != null
  const factChunk = float ? 12 : 0  // non-PCM formats carry a `fact` chunk
  const bextChunk = withBext ? 8 + BEXT_SIZE : 0
  const buf = new ArrayBuffer(12 + 24 + factChunk + bextChunk + 8 + dataSize)
  const view = new DataView(buf)
  const wstr = (off: number, s: string) => writeAscii(view, off, s.length, s)

  wstr(0, 'RIFF'); view.setUint32(4, buf.byteLength - 8, true); wstr(8, 'WAVE')
  wstr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, float ? 3 : 1, true)
  view.setUint16(22, channels, true); view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true); view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)

  let off = 36
  if (float) {
    wstr(off, 'fact'); view.setUint32(off + 4, 4, true)
    view.setUint32(off + 8, samples.length / channels, true)  // frames per channel
    off += 12
  }
  if (withBext) {
    wstr(off, 'bext'); view.setUint32(off + 4, BEXT_SIZE, true)
    const b = off + 8
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    writeAscii(view, b, 256, opts.description ?? '')
    writeAscii(view, b + 256, 32, 'Orb')
    writeAscii(view, b + 320, 10, `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`)
    writeAscii(view, b + 330, 8, `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`)
    const reference = Math.max(0, Math.round(opts.timeReference!))
    view.setUint32(b + 338, reference % 0x1_0000_0000, true)
    view.setUint32(b + 342, Math.floor(reference / 0x1_0000_0000), true)
    view.setUint16(b + 346, 1, true)  // version 1 (UMID field present, zeroed)
    off = b + BEXT_SIZE
  }

  wstr(off, 'data'); view.setUint32(off + 4, dataSize, true)
  off += 8
  if (float) {
    for (let i = 0; i < samples.length; i++) {
      view.setFloat32(off, samples[i]!, true)
      off += 4
    }
  } else if (bitDepth === 16) {
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]!))
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      off += 2
    }
  } else {
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]!))
      let v = Math.round(s < 0 ? s * 0x800000 : s * 0x7fffff)
      if (v < 0) v += 0x1000000
      view.setUint8(off, v & 0xff)
      view.setUint8(off + 1, (v >> 8) & 0xff)
      view.setUint8(off + 2, (v >> 16) & 0xff)
      off += 3
    }
  }
  return new Blob([buf], { type: 'audio/wav' })
}

// ── Decoding + mixing ─────────────────────────────────────────────────────
//
// Regions are decoded ONE AT A TIME. A decoded region is float32 (×1.33
// of 24-bit, ×2 of 16-bit), so holding ten of them at once is what
// blows the WebView's memory on a multi-track drop. Sequential decoding
// keeps the peak at "the output buffer + one input" regardless of N.

async function decodeAt(file: File, sampleRate: number): Promise<AudioBuffer | null> {
  try {
    // An offline context pinned to the regions' own rate decodes without
    // resampling — the merged clip keeps the project's sample rate.
    const ctx = new OfflineAudioContext(1, 1, sampleRate)
    return await ctx.decodeAudioData(await file.arrayBuffer())
  } catch (e) {
    console.error('[audioMerge] decode failed:', file.name, e)
    return null
  }
}

function outputBitDepth(regions: RegionInfo[]): 16 | 24 {
  return regions.some(r => (r.bitDepth ?? 0) >= 24) ? 24 : 16
}

/** Output channel count: stereo if any region is, mono only if all are. */
function outputChannels(regions: RegionInfo[]): number {
  return Math.min(2, Math.max(1, ...regions.map(r => r.channels ?? 2)))
}

function outputBytes(totalFrames: number, regions: RegionInfo[]): number {
  return totalFrames * outputChannels(regions) * (outputBitDepth(regions) / 8)
}

function mergedName(regions: RegionInfo[]): string {
  const base = byName(regions.map(r => r.file))[0]!.name.replace(/\.[^.]+$/, '') || 'merged'
  return `${base} (merged).wav`
}

/** Add one decoded region into the interleaved output at a frame offset. */
function mixInto(out: Float32Array, channels: number, b: AudioBuffer, offset: number, totalFrames: number) {
  const frames = Math.min(b.length, totalFrames - offset)
  for (let ch = 0; ch < channels; ch++) {
    const src = b.getChannelData(ch < b.numberOfChannels ? ch : 0)
    for (let i = 0; i < frames; i++) out[(offset + i) * channels + ch] += src[i]!
  }
}

async function renderPlaced(regions: RegionInfo[], plan: Placement): Promise<File | null> {
  const channels = outputChannels(regions)
  const out = new Float32Array(plan.totalFrames * channels)
  for (const placed of plan.regions) {
    const b = await decodeAt(regions[placed.index]!.file, plan.sampleRate)
    if (!b) return null
    mixInto(out, channels, b, placed.offset, plan.totalFrames)
    // `b` goes out of scope here — the next region decodes into fresh memory.
  }
  // Overlapping regions were SUMMED above, so the mix can peak past full
  // scale. No gain is ever applied — the summed levels leave untouched.
  // A peak over 1.0 escalates the output to 32-bit float WAV, which
  // carries over-0dBFS samples losslessly (the receiving DAW just pulls
  // the fader down); otherwise the integer format stands as before.
  let peak = 0
  for (let i = 0; i < out.length; i++) {
    const v = Math.abs(out[i]!)
    if (v > peak) peak = v
  }
  const wav = encodeWav(out, {
    sampleRate: plan.sampleRate, channels,
    bitDepth: peak > 1.0 ? 32 : outputBitDepth(regions),
    timeReference: plan.timeReference,
    description: `Orb: ${regions.length} regions merged at their original positions`,
  })
  return new File([wav], mergedName(regions), { type: 'audio/wav' })
}

async function renderBackToBack(regions: RegionInfo[]): Promise<File | null> {
  const sorted = byName(regions.map(r => ({ name: r.file.name, region: r }))).map(x => x.region)
  const sampleRate = sorted[0]!.sampleRate ?? 48000
  const channels = outputChannels(regions)
  // Frame counts from the headers let the output be allocated once;
  // a batch with a non-WAV file (no header count) collects chunks instead.
  const known = sorted.every(r => r.frames != null && r.sampleRate === sampleRate)
  let out: Float32Array
  if (known) {
    const totalFrames = sorted.reduce((s, r) => s + r.frames!, 0)
    out = new Float32Array(totalFrames * channels)
    let frameOff = 0
    for (const r of sorted) {
      const b = await decodeAt(r.file, sampleRate)
      if (!b) continue
      mixInto(out, channels, b, frameOff, totalFrames)
      frameOff += b.length
    }
    if (frameOff === 0) return null
    if (frameOff < totalFrames) out = out.subarray(0, frameOff * channels)
  } else {
    const chunks: Float32Array[] = []
    for (const r of sorted) {
      const b = await decodeAt(r.file, sampleRate)
      if (!b) continue
      const chunk = new Float32Array(b.length * channels)
      mixInto(chunk, channels, b, 0, b.length)
      chunks.push(chunk)
    }
    if (chunks.length === 0) return null
    out = new Float32Array(chunks.reduce((s, c) => s + c.length, 0))
    let pos = 0
    for (const c of chunks) { out.set(c, pos); pos += c.length }
  }
  // The first region's own stamp still places the clip's head correctly.
  const first = sorted[0]!
  const wav = encodeWav(out, {
    sampleRate, channels, bitDepth: outputBitDepth(regions),
    timeReference: first.start != null && first.sampleRate === sampleRate ? first.start : undefined,
    description: `Orb: ${regions.length} regions joined back to back`,
  })
  return new File([wav], mergedName(regions), { type: 'audio/wav' })
}

export type MergeResult =
  | { ok: true; file: File }
  | { ok: false; reason: 'empty' | 'too-large' | 'decode' | 'no-timing' | 'mixed-rate' | 'overlap' }

/** Why a merge was refused, in the user's words. */
export function mergeFailureText(reason: Extract<MergeResult, { ok: false }>['reason']): string {
  switch (reason) {
    case 'too-large': return 'the merged clip would be over 500 MB'
    case 'decode': return 'these files can\'t be decoded'
    case 'no-timing': return 'no timing info in these files'
    case 'mixed-rate': return 'these files use different sample rates'
    case 'overlap': return 'these regions overlap in time'
    default: return 'these files can\'t be merged'
  }
}

/** How a merge should treat the regions' embedded timestamps. */
export type MergeMode =
  /** Placed when provable, back-to-back otherwise (the historical default). */
  | 'auto'
  /** Timestamp-placed only — refused when the stamps are missing or the
   *  rates are mixed. Overlapping stamps are taken as intentional here
   *  and the overlap is mixed, not refused. */
  | 'placed'
  /** Butt-joined in filename order, stamps ignored (comped/moved regions). */
  | 'joined'

/** Back to back, behind the size guard: the output is the sum of the
 *  inputs (headers when known, file sizes as a ceiling otherwise). */
async function joinBackToBack(regions: RegionInfo[]): Promise<MergeResult> {
  const totalFrames = regions.reduce((s, r) => s + (r.frames ?? Math.ceil(r.file.size / 3)), 0)
  if (outputBytes(totalFrames, regions) > MERGED_OUTPUT_LIMIT) return { ok: false, reason: 'too-large' }
  const file = await renderBackToBack(regions)
  return file ? { ok: true, file } : { ok: false, reason: 'decode' }
}

/**
 * Merge regions into one WAV. Refuses (with a reason) rather than
 * rendering something the WebView can't hold.
 *
 *  • 'auto'   — placed at original positions when every region is
 *    timestamped and they don't overlap; joined back to back otherwise.
 *  • 'placed' — placement only. The user asked for original timing, so
 *    when the stamps can't provide it (missing/inexact stamps, mixed
 *    rates — or a placed render past the size cap) this refuses with
 *    the reason rather than silently butt-joining. Overlapping stamps
 *    are honored, not refused: the overlap is summed in place (a
 *    mini-bounce), escalating to float WAV if the sum passes 0dBFS.
 *  • 'joined' — back-to-back in filename order, stamps ignored. The one
 *    to reach for when comped/moved regions still carry their original
 *    record-time BWF stamps and "placed" would scatter them.
 */
export async function mergeDroppedRegions(
  batch: (DroppedRegion | File)[],
  mode: MergeMode = 'auto',
): Promise<MergeResult> {
  if (batch.length === 0) return { ok: false, reason: 'empty' }
  const files = batch.map(b => b instanceof File ? b : regionToFile(b.name, b.data))
  const regions = await Promise.all(files.map(analyzeRegion))
  if (mode === 'joined') return joinBackToBack(regions)
  // In explicit 'placed' mode overlapping stamps are intentional and get
  // mixed; 'auto' keeps the refusal so overlap still falls back to a
  // back-to-back join (and resolveDawDrop still sends overlaps separately).
  const placement = planPlacement(regions, { allowOverlap: mode === 'placed' })
  if ('plan' in placement) {
    if (outputBytes(placement.plan.totalFrames, regions) > MERGED_OUTPUT_LIMIT) return { ok: false, reason: 'too-large' }
    const file = await renderPlaced(regions, placement.plan)
    return file ? { ok: true, file } : { ok: false, reason: 'decode' }
  }
  if (mode === 'placed') return { ok: false, reason: placement.reason }
  return joinBackToBack(regions)
}

// ── Default policy for a multi-region DAW drop ────────────────────────────

export type DawDropResolution =
  | { kind: 'merged'; file: File; regionCount: number }
  | { kind: 'separate'; files: File[]; reason: 'single' | 'no-timing' | 'overlap' | 'mixed-rate' | 'too-large' | 'decode' }

/**
 * Decide what a dropped batch becomes. Merges only when the embedded
 * timestamps prove one timeline (side by side, no overlap); overlapping
 * regions are different tracks and stay separate; unstamped files can't
 * be judged and stay separate too — the caller may still offer a manual
 * merge for those.
 */
export async function resolveDawDrop(files: File[]): Promise<DawDropResolution> {
  if (files.length < 2) return { kind: 'separate', files, reason: 'single' }
  const regions = await Promise.all(files.map(analyzeRegion))
  const placement = planPlacement(regions)
  if ('reason' in placement) return { kind: 'separate', files, reason: placement.reason }
  if (outputBytes(placement.plan.totalFrames, regions) > MERGED_OUTPUT_LIMIT) return { kind: 'separate', files, reason: 'too-large' }
  const file = await renderPlaced(regions, placement.plan)
  if (!file) return { kind: 'separate', files, reason: 'decode' }
  return { kind: 'merged', file, regionCount: files.length }
}
