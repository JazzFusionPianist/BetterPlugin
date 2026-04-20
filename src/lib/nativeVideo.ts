/**
 * Receives JPEG frames from the JUCE plugin (native ScreenCaptureKit capture)
 * and exposes them as a MediaStreamTrack via an offscreen canvas
 * captureStream(). Replaces getDisplayMedia's system picker for DAW Window
 * / Entire Screen sources inside the plugin — the UX matches OBS: click
 * Go Live and streaming starts immediately.
 */

import { callJuceNative, hasJuceBridge, hasJuceNativeFunction } from './juceBridge'

interface JuceVideoFrameDetail { jpeg: string; w: number; h: number }

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
}

export function initNativeVideo () { attachListener() }

/**
 * Start plugin-side capture and return a MediaStreamTrack backed by the
 * decoded frames. The native-side completion callback (SCK async) fires
 * with 'ok' or 'error:<message>' — so we know success/failure before
 * returning, no event-race.
 *
 * Returns null (with lastError populated) in a regular browser, on an
 * older plugin build, or when SCK fails (permission denial, etc.).
 */
export async function startNativeVideo (kind: 'window' | 'screen'): Promise<MediaStreamTrack | null> {
  attachListener()
  lastError = ''

  if (!hasJuceBridge || !hasJuceNativeFunction('startVideoCapture')) {
    lastError = 'plugin-native-capture-unavailable'
    return null
  }

  const startBefore = frameCount
  const result = await callJuceNative('startVideoCapture', [kind], 8000)
  if (!result.startsWith('ok')) {
    lastError = result
    return null
  }

  // Wait briefly for the first frame so we hand back a track that's
  // already producing real content (not a black canvas).
  const deadline = performance.now() + 2000
  while (frameCount === startBefore && performance.now() < deadline) {
    await new Promise((r) => setTimeout(r, 50))
  }
  if (frameCount === startBefore) {
    lastError = 'no-frames'
    await stopNativeVideo()
    return null
  }

  if (!stream && canvas) stream = canvas.captureStream(15)
  return stream?.getVideoTracks()[0] ?? null
}

export async function stopNativeVideo () {
  if (!hasJuceBridge || !hasJuceNativeFunction('stopVideoCapture')) return
  try { await callJuceNative('stopVideoCapture', [], 3000) } catch { /* ignore */ }
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

/** Last reported error — "error:<msg>" from the plugin or a local reason. */
export function getNativeVideoLastError () { return lastError }
