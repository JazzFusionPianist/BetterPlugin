/**
 * Receives interleaved Float32 audio chunks from the native JUCE plugin via
 * `__juceDawAudio` CustomEvents and exposes them as a live MediaStreamTrack
 * via an AudioWorklet → MediaStreamAudioDestinationNode pipeline.
 *
 * When running in a regular browser (not inside the plugin), no events fire,
 * so the destination emits silence and the returned track carries an
 * inaudible stream (which is still fine to publish to peers).
 */

interface JuceDawAudioDetail {
  samples: string  // base64-encoded interleaved Float32
  sr: number       // sample rate
  ch: number       // channel count (1 or 2)
}

let audioCtx:   AudioContext | null = null
let workletNode: AudioWorkletNode | null = null
let destination: MediaStreamAudioDestinationNode | null = null
let listenerAttached = false
let lastAudioAt = 0
let eventCount  = 0   // total __juceDawAudio events received
let postCount   = 0   // how many made it to the worklet via postMessage
let lastError   = ''  // last setupPipeline/postMessage error

export interface DawAudioDebug {
  eventCount: number
  postCount: number
  msSinceLastAudio: number | null
  hasContext: boolean
  hasWorklet: boolean
  ctxState: AudioContextState | null
  sampleRate: number | null
  trackCount: number
  trackMuted: boolean | null
  trackEnabled: boolean | null
  trackReadyState: MediaStreamTrackState | null
  lastError: string
}

export function getDawAudioDebug(): DawAudioDebug {
  const track = destination?.stream.getAudioTracks()[0]
  return {
    eventCount,
    postCount,
    msSinceLastAudio: lastAudioAt ? Math.round(performance.now() - lastAudioAt) : null,
    hasContext: !!audioCtx,
    hasWorklet: !!workletNode,
    ctxState: audioCtx?.state ?? null,
    sampleRate: audioCtx?.sampleRate ?? null,
    trackCount: destination?.stream.getAudioTracks().length ?? 0,
    trackMuted: track?.muted ?? null,
    trackEnabled: track?.enabled ?? null,
    trackReadyState: track?.readyState ?? null,
    lastError,
  }
}

// Also expose on window for DevTools access (when available)
if (typeof window !== 'undefined') {
  (window as unknown as { __dawAudioDebug?: () => unknown }).__dawAudioDebug = getDawAudioDebug
}

// Inline worklet — ring buffer fed via postMessage, read by `process()`
// The `sampleRate` global inside a worklet equals the AudioContext's rate.
const workletSource = `
  class DawAudio extends AudioWorkletProcessor {
    constructor() {
      super()
      this.cap = sampleRate * 2
      this.ring = new Float32Array(this.cap)
      this.r = 0
      this.w = 0
      this.avail = 0
      this.ch = 2
      this.port.onmessage = (e) => {
        const { floats, ch } = e.data
        this.ch = ch
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

let setupInFlight: Promise<void> | null = null
async function setupPipeline(sr: number): Promise<void> {
  if (audioCtx && workletNode) return
  if (setupInFlight) return setupInFlight
  setupInFlight = (async () => {
    try {
      if (!audioCtx) {
        try { audioCtx = new AudioContext({ sampleRate: sr }) }
        catch { audioCtx = new AudioContext() }
      }
      const blob = new Blob([workletSource], { type: 'application/javascript' })
      const url = URL.createObjectURL(blob)
      await audioCtx.audioWorklet.addModule(url)
      URL.revokeObjectURL(url)

      workletNode = new AudioWorkletNode(audioCtx, 'daw-audio', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      })
      destination = audioCtx.createMediaStreamDestination()
      workletNode.connect(destination)
    } catch (e) {
      lastError = `setup: ${e instanceof Error ? e.message : String(e)}`
      throw e
    }
  })()
  try { await setupInFlight }
  finally { setupInFlight = null }
}

function attachListener() {
  if (listenerAttached) return
  listenerAttached = true

  window.addEventListener('__juceDawAudio', async (ev: Event) => {
    const e = ev as CustomEvent<JuceDawAudioDetail>
    const { samples, sr, ch } = e.detail
    if (!samples || !sr || !ch) return

    eventCount++

    // Create pipeline on first event if it wasn't pre-initialised. Using the
    // event's sample rate avoids pitch drift when the pipeline is built lazily.
    if (!audioCtx || !workletNode) {
      try { await setupPipeline(sr) }
      catch { return }
    }
    if (!workletNode) return

    try {
      const bin = atob(samples)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const floats = new Float32Array(bytes.buffer)

      workletNode.port.postMessage({ floats, ch }, [floats.buffer])
      postCount++
      lastAudioAt = performance.now()
    } catch (e) {
      lastError = `post: ${e instanceof Error ? e.message : String(e)}`
    }
  })
}

/**
 * Must be called from a user-gesture context (e.g. the Go Live click).
 * Guarantees the pipeline exists and the AudioContext is running — so the
 * returned MediaStreamTrack is valid even if the DAW hasn't played a sample yet.
 */
export async function ensureDawAudioActive(): Promise<MediaStreamTrack | null> {
  if (!audioCtx) {
    // Default to 48kHz (macOS default; matches most DAW outputs). If a
    // __juceDawAudio event later arrives at a different rate, the worklet
    // will play it at the wrong pitch — but this is rare on macOS. We
    // accept that trade-off rather than invalidating the live track mid-session.
    try { await setupPipeline(48000) }
    catch (e) { console.warn('DAW audio setup failed', e); return null }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    try { await audioCtx.resume() } catch (e) { console.warn('resume failed', e) }
  }
  return destination?.stream.getAudioTracks()[0] ?? null
}

/**
 * Non-async variant — returns the track if the pipeline already exists,
 * or null otherwise. Prefer `ensureDawAudioActive()` from user gestures.
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
