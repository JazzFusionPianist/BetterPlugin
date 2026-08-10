import { useRef } from 'react'
import { hasJuceBridge } from '../../lib/juceBridge'
import { setPluginSize } from '../../lib/pluginWindow'

/**
 * The corner resize grip, drawn in the WEB layer. JUCE's own corner
 * resizer can't work here: the WKWebView is a native NSView that always
 * sits above JUCE-drawn components, so its grip never sees the mouse.
 * Instead this handle rides the webview and drives the window through
 * the existing setPluginSize bridge, throttled to animation frames.
 */

const MIN_W = 300; const MIN_H = 500
const MAX_W = 1600; const MAX_H = 1200

export default function ResizeGrip() {
  const drag = useRef<{ sx: number; sy: number; w: number; h: number } | null>(null)
  const raf = useRef(0)
  const pending = useRef<{ w: number; h: number } | null>(null)

  if (!hasJuceBridge) return null

  const flush = () => {
    raf.current = 0
    const p = pending.current
    pending.current = null
    if (p) void setPluginSize(p.w, p.h)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { sx: e.screenX, sy: e.screenY, w: window.innerWidth, h: window.innerHeight }
    e.preventDefault()
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    // screen coords, not client — the window is growing under the pointer.
    const w = Math.round(Math.min(MAX_W, Math.max(MIN_W, d.w + (e.screenX - d.sx))))
    const h = Math.round(Math.min(MAX_H, Math.max(MIN_H, d.h + (e.screenY - d.sy))))
    pending.current = { w, h }
    if (!raf.current) raf.current = requestAnimationFrame(flush)
  }
  const onPointerUp = () => {
    drag.current = null
    if (pending.current) flush()
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="separator"
      aria-label="Resize window"
      style={{
        position: 'fixed', right: 0, bottom: 0, zIndex: 200,
        width: 20, height: 20,
        cursor: 'nwse-resize', touchAction: 'none',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
        padding: '0 3px 3px 0',
      }}
    >
      <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden="true" style={{ opacity: 0.45 }}>
        <path d="M8 1L1 8M8 4.5L4.5 8M8 8h0" stroke="var(--t2, #888)" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </div>
  )
}
