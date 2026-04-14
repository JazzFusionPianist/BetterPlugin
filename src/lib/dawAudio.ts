/**
 * Receives interleaved Float32 audio chunks from the native JUCE plugin via
 * `__juceDawAudio` CustomEvents and exposes them as a live MediaStreamTrack
 * via an AudioWorklet → MediaStreamAudioDestinationNode pipeline.
 *
 * When running in a regular browser (not inside the plugin), no events fire,
 * so `getDawAudioTrack()` returns null and the caller can gracefully fall
 * back to mic-only or silent audio.
 */

interface JuceDawAudioDetail {
  samples: string  // base64-encoded interleaved Float32
  sr: number       // sample rate
  ch: number       // channel count (1 or 2)
}

let audioCtx:   AudioContext | null = null
let workletNode: AudioWorkletNode | null = null
let destination: MediaStreamAudioDestinationNode | null = null
let currentSR   = 0
let currentCh   = 0
let listenerAttached = false
let lastAudioAt = 0    // for "are we receiving audio?" detection

// Inline worklet — ring buffer fed via postMessage, read by `process()`
const workletSource = `
  class DawAudio extends AudioWorkletProcessor {
    constructor() {
      super()
      this.cap = sampleRate * 2   // ~2s of interleaved stereo headroom
      this.ring = new Float32Array(this.cap)
      this.r = 0
      this.w = 0
      this.avail = 0
      this.ch = 2
      this.port.onmessage = (e) => {
        const { floats, ch } = e.data
        this.ch = ch
        // Drop oldest if buffer is full (keeps latency bounded)
        if (this.avail + floats.length > this.cap) {
          const drop = this.avail + floats.length - this.cap
          this.r = (this.r + drop) % this.cap
          this.avail -= drop
        }
        for (let i = 0; i < floats.length; i++) {
          this.ring[this.w] = floats[i]
          this.w = (this.w + 1) % this.cap
        }
        this.avail += floats.length
      }
    }
    process(_inputs, outputs) {
      const out = outputs[0]
      const frames = out[0].length
      const outCh = out.length
      for (let i = 0; i < frames; i++) {
        if (this.avail >= this.ch) {
          // Read one interleaved frame from ring, distribute to outputs
          for (let c = 0; c < outCh; c++) {
            const src = Math.min(c, this.ch - 1)
            out[c][i] = this.ring[(this.r + src) % this.cap]
          }
          this.r = (this.r + this.ch) % this.cap
          this.avail -= this.ch
        } else {
          for (let c = 0; c < outCh; c++) out[c][i] = 0
        }
      }
      return true
    }
  }
  registerProcessor('daw-audio', DawAudio)
`

async function ensureAudio(sr: number, ch: number): Promise<void> {
  if (audioCtx && currentSR === sr && currentCh === ch) return

  // Tear down existing
  if (workletNode) { workletNode.disconnect(); workletNode = null }
  if (destination) { destination.disconnect(); destination = null }
  if (audioCtx) { await audioCtx.close().catch(() => {}); audioCtx = null }

  // AudioContext sample rate must match to avoid resampling artifacts.
  // Some browsers/WebKit ignore the rate hint and use device default;
  // in that case the worklet's output is resampled transparently.
  try {
    audioCtx = new AudioContext({ sampleRate: sr })
  } catch {
    audioCtx = new AudioContext()
  }

  const blob = new Blob([workletSource], { type: 'application/javascript' })
  const url = URL.createObjectURL(blob)
  await audioCtx.audioWorklet.addModule(url)
  URL.revokeObjectURL(url)

  workletNode = new AudioWorkletNode(audioCtx, 'daw-audio', {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [Math.max(1, Math.min(ch, 2))],
  })
  destination = audioCtx.createMediaStreamDestination()
  workletNode.connect(destination)

  currentSR = sr
  currentCh = ch
}

function attachListener() {
  if (listenerAttached) return
  listenerAttached = true

  window.addEventListener('__juceDawAudio', async (ev: Event) => {
    const e = ev as CustomEvent<JuceDawAudioDetail>
    const { samples, sr, ch } = e.detail
    if (!samples || !sr || !ch) return

    await ensureAudio(sr, ch)
    if (!workletNode) return

    // Decode base64 → Float32Array
    const bin = atob(samples)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    const floats = new Float32Array(bytes.buffer)

    workletNode.port.postMessage({ floats, ch }, [floats.buffer])
    lastAudioAt = performance.now()
  })
}

/**
 * Returns a MediaStreamTrack that carries DAW audio, or null if the plugin
 * hasn't produced any audio yet (e.g. running in a browser, or the DAW isn't
 * playing). Call after attachListener(), ideally right before Go Live.
 */
export function getDawAudioTrack(): MediaStreamTrack | null {
  return destination?.stream.getAudioTracks()[0] ?? null
}

/** True if we've received an audio chunk from the plugin within the last 500 ms. */
export function isDawAudioActive(): boolean {
  return performance.now() - lastAudioAt < 500
}

/** Initialise listener. Safe to call multiple times. */
export function initDawAudio() {
  attachListener()
}
