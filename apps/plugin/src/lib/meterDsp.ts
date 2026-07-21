/**
 * Metering engine for the monitor panel. Subscribes to the same
 * `__juceDawAudio` CustomEvents the live-streaming path uses (interleaved
 * Float32 chunks, ~20-30ms cadence) and derives:
 *
 *  - per-channel peak + VU-ballistic level (0 VU = -18 dBFS)
 *  - LUFS momentary / short-term / integrated (ITU-R BS.1770-4:
 *    K-weighting, 400ms blocks @ 75% overlap, -70 absolute and
 *    -10 relative gating)
 *  - stereo correlation (last ~0.5s)
 *  - a goniometer sample ring for the vectorscope
 *
 * Everything runs on the main thread — at 48kHz stereo this is ~0.3% CPU,
 * far below what the canvas drawing costs.
 */

export interface MeterFrame {
  active: boolean
  peakL: number; peakR: number          // dBFS instantaneous chunk peak
  holdL: number; holdR: number          // dBFS peak-hold (1s hold, then decay)
  rmsL: number; rmsR: number            // dBFS fast RMS (~100ms)
  vuL: number; vuR: number              // VU (dB re -18 dBFS)
  clipL: boolean; clipR: boolean        // sticky until resetClip()
  lufsM: number; lufsS: number; lufsI: number
  corr: number                          // -1..1
}

const VU_REF_DB = -18                   // 0 VU == -18 dBFS
const VU_TAU = 0.3                      // 300ms ballistics
const CORR_WINDOW_S = 0.5
const GONIO_POINTS = 1024

// ── K-weighting (RBJ biquads, parameters from ITU-R BS.1770 / pyloudnorm) ──
interface Biquad { b0: number; b1: number; b2: number; a1: number; a2: number; z1: number; z2: number }

function highShelf (fs: number): Biquad {
  const G = 3.999843853973347, f0 = 1681.974450955533, Q = 0.7071752369554196
  const K = Math.tan(Math.PI * f0 / fs), Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416)
  const a0 = 1 + K / Q + K * K
  return {
    b0: (Vh + Vb * K / Q + K * K) / a0,
    b1: 2 * (K * K - Vh) / a0,
    b2: (Vh - Vb * K / Q + K * K) / a0,
    a1: 2 * (K * K - 1) / a0,
    a2: (1 - K / Q + K * K) / a0,
    z1: 0, z2: 0,
  }
}

function highPass (fs: number): Biquad {
  const f0 = 38.13547087602444, Q = 0.5003270373238773
  const K = Math.tan(Math.PI * f0 / fs)
  const a0 = 1 + K / Q + K * K
  return {
    b0: 1 / a0, b1: -2 / a0, b2: 1 / a0,
    a1: 2 * (K * K - 1) / a0,
    a2: (1 - K / Q + K * K) / a0,
    z1: 0, z2: 0,
  }
}

function runBiquad (bq: Biquad, x: number): number {
  const y = bq.b0 * x + bq.z1
  bq.z1 = bq.b1 * x - bq.a1 * y + bq.z2
  bq.z2 = bq.b2 * x - bq.a2 * y
  return y
}

// ── Engine state ──────────────────────────────────────────────────────────
let listener: ((e: Event) => void) | null = null
let sampleRate = 48000
let lastChunkAt = 0

let vuL = 0, vuR = 0                    // linear rectified average
let peakL = 0, peakR = 0
let rmsL = 0, rmsR = 0                  // linear smoothed RMS
let holdLin = [0, 0]                    // linear peak-hold per channel
let holdAt = [0, 0]                     // performance.now() of last hold bump
let clipL = false, clipR = false

let kL: Biquad[] = [], kR: Biquad[] = []
let ksqBuf: Float32Array = new Float32Array(0)   // per-sample (zL²+zR²) ring for M/S windows
let ksqPos = 0

let corrBuf: Float32Array = new Float32Array(0)  // interleaved l,r ring
let corrPos = 0

const gonio = new Float32Array(GONIO_POINTS * 2)
let gonioPos = 0

// Integrated loudness: 100ms hops of K-weighted mean square, gated at read.
let hopAccum = 0, hopCount = 0, hopSamples = 4800
const hopPowers: number[] = []          // per-100ms mean square
const MAX_HOPS = 72000                  // ~2h; beyond that the oldest fall off

function ensureBuffers (sr: number) {
  if (sr === sampleRate && ksqBuf.length > 0) return
  sampleRate = sr
  hopSamples = Math.round(sr / 10)
  kL = [highPass(sr), highShelf(sr)]
  kR = [highPass(sr), highShelf(sr)]
  ksqBuf = new Float32Array(3 * sr)     // 3s short-term window
  corrBuf = new Float32Array(Math.round(CORR_WINDOW_S * sr) * 2)
  ksqPos = 0; corrPos = 0
}

function decodeChunk (b64: string): Float32Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Float32Array(bytes.buffer)
}

function processChunk (samples: Float32Array, sr: number, ch: number) {
  ensureBuffers(sr)
  lastChunkAt = performance.now()
  lastCh = ch

  const frames = Math.floor(samples.length / ch)
  if (frames === 0) return

  const alpha = 1 - Math.exp(-frames / (VU_TAU * sr))
  let sumL = 0, sumR = 0, pkL = 0, pkR = 0

  const gonioStride = Math.max(1, Math.floor(frames / 64))

  for (let i = 0; i < frames; i++) {
    const l = samples[i * ch]
    const r = ch > 1 ? samples[i * ch + 1] : l
    const al = Math.abs(l), ar = Math.abs(r)
    sumL += al; sumR += ar
    if (al > pkL) pkL = al
    if (ar > pkR) pkR = ar

    // K-weighted power for LUFS
    const zl = runBiquad(kL[1], runBiquad(kL[0], l))
    const zr = runBiquad(kR[1], runBiquad(kR[0], r))
    const p = zl * zl + zr * zr
    ksqBuf[ksqPos] = p
    ksqPos = (ksqPos + 1) % ksqBuf.length
    hopAccum += p
    if (++hopCount >= hopSamples) {
      hopPowers.push(hopAccum / hopCount)
      if (hopPowers.length > MAX_HOPS) hopPowers.shift()
      hopAccum = 0; hopCount = 0
    }

    // correlation ring
    corrBuf[corrPos] = l; corrBuf[corrPos + 1] = r
    corrPos = (corrPos + 2) % corrBuf.length

    // goniometer ring (downsampled)
    if (i % gonioStride === 0) {
      gonio[gonioPos] = l; gonio[gonioPos + 1] = r
      gonioPos = (gonioPos + 2) % gonio.length
    }
  }

  vuL += (sumL / frames - vuL) * alpha
  vuR += (sumR / frames - vuR) * alpha
  peakL = pkL; peakR = pkR
  if (pkL >= 0.999) clipL = true
  if (pkR >= 0.999) clipR = true

  // fast RMS for the bar meters (~100ms smoothing)
  const alphaRms = 1 - Math.exp(-frames / (0.1 * sr))
  let sqL = 0, sqR = 0
  for (let i = 0; i < frames; i++) {
    const l = samples[i * ch], r = ch > 1 ? samples[i * ch + 1] : l
    sqL += l * l; sqR += r * r
  }
  rmsL += (Math.sqrt(sqL / frames) - rmsL) * alphaRms
  rmsR += (Math.sqrt(sqR / frames) - rmsR) * alphaRms

  // peak hold: bump immediately, hold 1s, then fall (handled at read time)
  const now = performance.now()
  if (pkL >= holdLin[0]) { holdLin[0] = pkL; holdAt[0] = now }
  if (pkR >= holdLin[1]) { holdLin[1] = pkR; holdAt[1] = now }
}

function meanSquareOver (seconds: number): number {
  const n = Math.min(ksqBuf.length, Math.round(seconds * sampleRate))
  if (n === 0) return 0
  let sum = 0
  let idx = ksqPos - 1
  for (let i = 0; i < n; i++) {
    if (idx < 0) idx += ksqBuf.length
    sum += ksqBuf[idx--]
  }
  return sum / n
}

const toLufs = (ms: number) => ms > 0 ? -0.691 + 10 * Math.log10(ms) : -Infinity
const toDb = (lin: number) => lin > 0 ? 20 * Math.log10(lin) : -Infinity

function integratedLufs (): number {
  // 400ms blocks = 4 consecutive hops, 75% overlap = every hop.
  if (hopPowers.length < 4) return -Infinity
  const blocks: number[] = []
  for (let i = 3; i < hopPowers.length; i++)
    blocks.push((hopPowers[i - 3] + hopPowers[i - 2] + hopPowers[i - 1] + hopPowers[i]) / 4)

  const abs = blocks.filter(p => toLufs(p) > -70)
  if (abs.length === 0) return -Infinity
  const absMean = abs.reduce((a, b) => a + b, 0) / abs.length
  const gate = toLufs(absMean) - 10
  const rel = abs.filter(p => toLufs(p) > gate)
  if (rel.length === 0) return -Infinity
  return toLufs(rel.reduce((a, b) => a + b, 0) / rel.length)
}

function correlation (): number {
  let sLR = 0, sLL = 0, sRR = 0
  for (let i = 0; i < corrBuf.length; i += 2) {
    const l = corrBuf[i], r = corrBuf[i + 1]
    sLR += l * r; sLL += l * l; sRR += r * r
  }
  const denom = Math.sqrt(sLL * sRR)
  return denom > 1e-9 ? sLR / denom : 0
}

// ── Short-term history (for the loudness graph) ───────────────────────────
const ST_POINTS = 120                    // 60s at 500ms
const stHist = new Float32Array(ST_POINTS).fill(-Infinity)
let stHistPos = 0
let lastStAt = 0
let lastCh = 2

/** Ring of short-term LUFS values, one every 500ms (60s span). */
export function getStHistory (): { data: Float32Array; pos: number } {
  return { data: stHist, pos: stHistPos }
}

/** Sample rate + channel count of the incoming stream (for the screen's
 *  status readout). */
export function getStreamInfo (): { sr: number; ch: number } {
  return { sr: sampleRate, ch: lastCh }
}

// ── Public API ────────────────────────────────────────────────────────────
export function startMetering () {
  if (listener) return
  listener = (e: Event) => {
    const d = (e as CustomEvent).detail as { samples: string; sr: number; ch: number }
    if (!d?.samples) return
    try { processChunk(decodeChunk(d.samples), d.sr, d.ch || 2) } catch { /* skip bad chunk */ }
  }
  window.addEventListener('__juceDawAudio', listener)
}

export function stopMetering () {
  if (listener) { window.removeEventListener('__juceDawAudio', listener); listener = null }
}

export function resetClip () { clipL = false; clipR = false }

export function resetIntegrated () { hopPowers.length = 0; hopAccum = 0; hopCount = 0 }

export function getGonio (): { data: Float32Array; pos: number } {
  return { data: gonio, pos: gonioPos }
}

export function readMeters (): MeterFrame {
  const now = performance.now()
  const active = now - lastChunkAt < 600
  if (!active) { vuL *= 0.9; vuR *= 0.9; rmsL *= 0.9; rmsR *= 0.9 }

  // peak-hold ballistics: 1s hold, then ~15 dB/s fall
  for (let c = 0; c < 2; c++) {
    const held = now - holdAt[c]
    if (held > 1000 && holdLin[c] > 0)
      holdLin[c] *= Math.pow(10, -15 * 0.016 / 20)   // per ~frame decay
  }

  const lufsSNow = toLufs(meanSquareOver(3))
  if (now - lastStAt > 500) {
    lastStAt = now
    stHist[stHistPos] = active ? lufsSNow : -Infinity
    stHistPos = (stHistPos + 1) % ST_POINTS
  }

  return {
    active,
    peakL: toDb(peakL), peakR: toDb(peakR),
    holdL: toDb(holdLin[0]), holdR: toDb(holdLin[1]),
    rmsL: toDb(rmsL), rmsR: toDb(rmsR),
    // VU reads average level; +3dB sine correction keeps 0VU==-18dBFS tones honest.
    vuL: toDb(vuL) + 3.01 - VU_REF_DB,
    vuR: toDb(vuR) + 3.01 - VU_REF_DB,
    clipL, clipR,
    lufsM: toLufs(meanSquareOver(0.4)),
    lufsS: lufsSNow,
    lufsI: integratedLufs(),
    corr: correlation(),
  }
}

// ── Dev-only demo signal (browser, no JUCE bridge) ────────────────────────
let demoTimer: ReturnType<typeof setInterval> | null = null

/** Synthesizes chunks through the same CustomEvent path so the whole
 *  pipeline can be exercised in a regular browser. */
export function startDemoSignal () {
  if (demoTimer) return
  const sr = 48000, chunk = Math.round(sr * 0.03)
  let phase = 0, lfo = 0
  demoTimer = setInterval(() => {
    const buf = new Float32Array(chunk * 2)
    for (let i = 0; i < chunk; i++) {
      lfo += 1 / sr
      const amp = 0.22 * (0.75 + 0.25 * Math.sin(2 * Math.PI * 0.4 * lfo))
      const width = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.07 * lfo)
      const m = Math.sin(2 * Math.PI * 220 * (phase / sr)) * amp
        + (Math.random() * 2 - 1) * 0.015
      const s = Math.sin(2 * Math.PI * 330 * (phase / sr)) * amp * 0.6 * width
      buf[i * 2] = m + s
      buf[i * 2 + 1] = m - s
      phase++
    }
    const bytes = new Uint8Array(buf.buffer)
    let bin = ''
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    window.dispatchEvent(new CustomEvent('__juceDawAudio', {
      detail: { samples: btoa(bin), sr, ch: 2 },
    }))
  }, 30)
}

export function stopDemoSignal () {
  if (demoTimer) { clearInterval(demoTimer); demoTimer = null }
}
