/**
 * Receives JPEG frames from the JUCE plugin (native ScreenCaptureKit capture)
 * and exposes them as a MediaStreamTrack via an offscreen canvas
 * captureStream(). This replaces getDisplayMedia's system picker for DAW
 * Window / Entire Screen sources inside the plugin — the UX matches OBS:
 * click Go Live and streaming starts immediately.
 */

import { callJuceNative, hasJuceBridge, hasJuceNativeFunction } from './juceBridge'

interface JuceVideoFrameDetail { jpeg: string; w: number; h: number }
interface JuceVideoErrorDetail { message: string }

let canvas:      HTMLCanvasElement | null = null
let ctx:         CanvasRenderingContext2D | null = null
let stream:      MediaStream | null = null
let imgDecoder:  HTMLImageElement | null = null
let frameCount   = 0
let lastFrameAt  = 0
let lastError    = ''
let listenerAttached = false

function ensureCanvas (w: number, h: number) {
  if (!canvas) {
    canvas = document.createElement('canvas')
    canvas.width  = w
    canvas.height = h
    ctx = canvas.getContext('2d', { alpha: false })
  } else if (canvas.width !== w || canvas.height !== h) {
    canvas.width  = w
    canvas.height = h
  }
}

function attachListener () {
  if (listenerAttached) return
  listenerAttached = true

  imgDecoder = new Image()

  window.addEventListener('__juceVideoFrame', (ev: Event) => {
    const e = ev as CustomEvent<JuceVideoFrameDetail>
    const { jpeg, w, h } = e.detail
    if (!jpeg || !w || !h) return
    ensureCanvas(w, h)
    const img = imgDecoder!
    img.onload = () => {
      if (ctx) ctx.drawImage(img, 0, 0, w, h)
      frameCount++
      lastFrameAt = performance.now()
    }
    img.onerror = () => { /* drop bad frame */ }
    img.src = 'data:image/jpeg;base64,' + jpeg
  })

  window.addEventListener('__juceVideoError', (ev: Event) => {
    const e = ev as CustomEvent<JuceVideoErrorDetail>
    lastError = e.detail?.message ?? 'unknown video error'
    console.warn('[nativeVideo]', lastError)
  })
}

export function initNativeVideo () { attachListener() }

/**
 * Start plugin-side capture and return a MediaStreamTrack backed by the
 * decoded frames. Resolves when the first frame arrives OR after a short
 * timeout — if no frame lands within ~3s the caller can treat it as failed
 * (typically Screen Recording permission hasn't been granted to the DAW).
 *
 * Returns null in a regular browser or if the plugin build doesn't register
 * the native function.
 */
export async function startNativeVideo (kind: 'window' | 'screen'): Promise<MediaStreamTrack | null> {
  attachListener()
  if (!hasJuceBridge || !hasJuceNativeFunction('startVideoCapture')) return null

  lastError = ''
  const startBefore = frameCount

  const result = await callJuceNative('startVideoCapture', [kind])
  if (!result.startsWith('ok')) {
    console.warn('startVideoCapture →', result)
    return null
  }

  // Wait for the first frame to arrive (or give up). Without the wait, the
  // canvas-backed stream would start as a black frame and peers might see
  // that for a beat before real content lands.
  const deadline = performance.now() + 3000
  while (frameCount === startBefore && performance.now() < deadline && !lastError) {
    await new Promise((r) => setTimeout(r, 50))
  }

  if (frameCount === startBefore) {
    // No frames. Either permission denied or something upstream failed.
    await stopNativeVideo()
    return null
  }

  // Build the track from the canvas once; subsequent calls reuse it so
  // replaceTrack on existing peers is seamless across source switches.
  if (!stream && canvas) stream = canvas.captureStream(15)
  return stream?.getVideoTracks()[0] ?? null
}

export async function stopNativeVideo () {
  if (!hasJuceBridge || !hasJuceNativeFunction('stopVideoCapture')) return
  try { await callJuceNative('stopVideoCapture', []) } catch { /* ignore */ }
}

export function getNativeVideoDebug () {
  return {
    frameCount,
    msSinceLastFrame: lastFrameAt ? Math.round(performance.now() - lastFrameAt) : null,
    hasCanvas: !!canvas,
    hasStream: !!stream,
    w: canvas?.width ?? 0,
    h: canvas?.height ?? 0,
    lastError,
  }
}

/** Last reported error (permission denial, missing window, etc.). */
export function getNativeVideoLastError () { return lastError }
