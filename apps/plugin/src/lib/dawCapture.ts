/**
 * Bar-range capture from the host DAW.
 *
 * The native plugin streams the audio flowing through its track as
 * `__juceDawAudio` CustomEvents — each carries a batch of interleaved
 * Float32 samples plus a playhead snapshot (ppq position, tempo, time
 * signature, transport state). This module turns that stream into:
 *
 *   1. a live playhead readout (current bar/beat) for the UI, and
 *   2. a "capture bars X..Y" recorder that accumulates exactly the
 *      batches whose musical position falls inside the range, then
 *      encodes them to a 16-bit WAV blob.
 *
 * Why bars-from-ppq and not the DAW's loop/cycle points: ppqPosition is
 * reported by virtually every DAW, whereas loop boundaries are not
 * (Ableton Live, notably, never exposes them). Gating on ppq keeps this
 * cross-DAW. Precision is one audio batch (~20–30 ms) at the range
 * edges — a small fraction of a beat — which is plenty for sharing a
 * section.
 */

export interface PlayheadState {
  ppq: number       // quarter-notes from project start
  bpm: number
  tnum: number      // time-signature numerator
  tden: number      // time-signature denominator
  playing: boolean
  bar: number       // 1-indexed current bar (derived)
  beat: number      // 1-indexed beat within the bar (derived)
}

interface JuceDawAudioDetail {
  samples: string   // base64 interleaved Float32
  sr: number
  ch: number
  ppq?: number
  bpm?: number
  tnum?: number
  tden?: number
  playing?: boolean
}

// ── Bar math ──────────────────────────────────────────────────────────────
// Bar length in quarter notes: numerator beats, each (4/denominator) quarters.
function barLenQuarters(tnum: number, tden: number): number {
  const n = tnum > 0 ? tnum : 4
  const d = tden > 0 ? tden : 4
  return n * (4 / d)
}
/** 1-indexed bar containing ppq (DAW bar 1 == ppq 0, the near-universal case). */
function ppqToBar(ppq: number, tnum: number, tden: number): number {
  return Math.floor(ppq / barLenQuarters(tnum, tden)) + 1
}
function ppqToBeat(ppq: number, tnum: number, tden: number): number {
  const bl = barLenQuarters(tnum, tden)
  const intoBar = ppq - Math.floor(ppq / bl) * bl
  const beatLen = 4 / (tden > 0 ? tden : 4)
  return Math.floor(intoBar / beatLen) + 1
}

// ── base64 → Float32 ────────────────────────────────────────────────────────
function decodeFloats(b64: string): Float32Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  // Native sends frames*ch*4 bytes, so the length is always 4-aligned.
  return new Float32Array(bytes.buffer, 0, Math.floor(bytes.length / 4))
}

// ── WAV encode (interleaved Float32 → 16-bit PCM) ──────────────────────────
function encodeWav(samples: Float32Array, sampleRate: number, channels: number): Blob {
  const dataSize = samples.length * 2
  const buf = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buf)
  const wstr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)) }
  const blockAlign = channels * 2
  wstr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  wstr(8, 'WAVE')
  wstr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)               // PCM
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)              // bits/sample
  wstr(36, 'data')
  view.setUint32(40, dataSize, true)
  let off = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!))
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    off += 2
  }
  return new Blob([buf], { type: 'audio/wav' })
}

// ── Single shared event listener, fanned out to subscribers ────────────────
type PlayheadCb = (s: PlayheadState) => void
const playheadSubs = new Set<PlayheadCb>()

interface ActiveCapture {
  startPpq: number
  endPpq: number
  started: boolean
  chunks: Float32Array[]
  total: number
  sr: number
  ch: number
  onProgress?: (currentBar: number) => void
  onDone: (wav: Blob | null, meta: { sr: number; ch: number; frames: number }) => void
  finished: boolean
}
let active: ActiveCapture | null = null
let listenerAttached = false

function onJuceAudio(e: Event) {
  const d = (e as CustomEvent<JuceDawAudioDetail>).detail
  if (!d) return
  const tnum = d.tnum ?? 4
  const tden = d.tden ?? 4
  const ppq  = d.ppq ?? 0
  const state: PlayheadState = {
    ppq, bpm: d.bpm ?? 120, tnum, tden,
    playing: d.playing ?? false,
    bar: ppqToBar(ppq, tnum, tden),
    beat: ppqToBeat(ppq, tnum, tden),
  }
  for (const cb of playheadSubs) { try { cb(state) } catch { /* ignore */ } }

  // Feed an in-flight capture.
  if (active && !active.finished) {
    const a = active
    const inRange = ppq >= a.startPpq && ppq < a.endPpq
    if (inRange) {
      const floats = decodeFloats(d.samples)
      if (floats.length > 0) {
        a.chunks.push(floats)
        a.total += floats.length
        a.sr = d.sr
        a.ch = d.ch
        a.started = true
        a.onProgress?.(ppqToBar(ppq, tnum, tden))
      }
    } else if (a.started && ppq >= a.endPpq) {
      // Passed the end of the range — finalize one forward pass.
      finalizeCapture()
    }
  }
}

function ensureListener() {
  if (listenerAttached || typeof window === 'undefined') return
  window.addEventListener('__juceDawAudio', onJuceAudio as EventListener)
  listenerAttached = true
}

function finalizeCapture() {
  const a = active
  if (!a || a.finished) return
  a.finished = true
  active = null
  if (a.total === 0 || a.ch <= 0 || a.sr <= 0) { a.onDone(null, { sr: a.sr, ch: a.ch, frames: 0 }); return }
  const merged = new Float32Array(a.total)
  let off = 0
  for (const c of a.chunks) { merged.set(c, off); off += c.length }
  const wav = encodeWav(merged, a.sr, a.ch)
  a.onDone(wav, { sr: a.sr, ch: a.ch, frames: a.total / a.ch })
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Live playhead readout. Returns an unsubscribe fn. Only updates while the
 *  DAW transport is rolling (no audio flows when stopped). */
export function subscribePlayhead(cb: PlayheadCb): () => void {
  ensureListener()
  playheadSubs.add(cb)
  return () => playheadSubs.delete(cb)
}

export interface CaptureHandle {
  /** Finalize whatever's been captured so far (early stop). */
  stop(): void
  /** Abort with no result. */
  cancel(): void
}

/**
 * Capture bars [startBar..endBar] inclusive. The user must play the DAW
 * through that range; we accumulate the batches whose ppq lands inside it
 * and finalize one forward pass past the end (or on stop()).
 */
export function captureBarRange(
  startBar: number,
  endBar: number,
  opts: {
    tnum: number
    tden: number
    onProgress?: (currentBar: number) => void
    onDone: (wav: Blob | null, meta: { sr: number; ch: number; frames: number }) => void
  },
): CaptureHandle {
  ensureListener()
  const bl = barLenQuarters(opts.tnum, opts.tden)
  active = {
    startPpq: (startBar - 1) * bl,
    endPpq:   endBar * bl,           // end of bar endBar == start of endBar+1
    started: false,
    chunks: [],
    total: 0,
    sr: 0,
    ch: 0,
    onProgress: opts.onProgress,
    onDone: opts.onDone,
    finished: false,
  }
  return {
    stop()   { finalizeCapture() },
    cancel() { if (active) { active.finished = true; active = null } },
  }
}
