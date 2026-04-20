/**
 * Receives JPEG frames from the JUCE plugin (native ScreenCapture via
 * CGWindowListCreateImage / CGDisplayCreateImage) and exposes them as a
 * MediaStreamTrack via an offscreen canvas `captureStream()`.
 *
 * This lets us stream the DAW window or entire screen without the
 * getDisplayMedia system picker, which is a poor UX inside a plugin
 * WebView.
 */

interface JuceVideoFrameDetail {
  jpeg: string   // base64 standard
  w: number
  h: number
}

let canvas:      HTMLCanvasElement | null = null
let ctx:         CanvasRenderingContext2D | null = null
let stream:      MediaStream | null = null
let imgDecoder:  HTMLImageElement | null = null
let frameCount   = 0
let lastFrameAt  = 0
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

  // Single reusable Image for decoding — avoids allocating one per frame
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

import { callJuceNative, hasJuceBridge } from './juceBridge'

/** Attach listener if needed. Safe to call repeatedly. */
export function initNativeVideo () { attachListener() }

/**
 * Start native DAW-window or entire-screen capture in the plugin, and
 * return a MediaStreamTrack carrying the resulting video. Resolves
 * immediately — frames start flowing shortly after.
 *
 * Returns null if not running in the plugin (no juce bridge available).
 */
export async function startNativeVideo (kind: 'window' | 'screen'): Promise<MediaStreamTrack | null> {
  attachListener()
  if (!hasJuceBridge) return null

  const result = await callJuceNative('startVideoCapture', [kind])
  if (!result.startsWith('ok')) {
    console.warn('startVideoCapture native returned', result)
    return null
  }

  // Ensure canvas exists before the first frame so captureStream() has
  // something to pull from (black frame until first paint).
  ensureCanvas(1280, 720)
  if (!stream && canvas) stream = canvas.captureStream(15)
  return stream?.getVideoTracks()[0] ?? null
}

/** Stop native capture. Idempotent. */
export async function stopNativeVideo () {
  if (!hasJuceBridge) return
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
  }
}
