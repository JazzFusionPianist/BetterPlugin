'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import type { Stroke } from '@orb/core'
import { strokePathScaled } from '@/lib/strokes'

interface Props {
  /** Called with the finished doodle's strokes (non-empty). */
  onSave: (strokes: Stroke[]) => void
  onClose: () => void
}

/** The pencil case — riso-adjacent colours that sit well on the paper. */
const PENCILS = ['#1A1917', '#2440FF', '#E5432D', '#1E9E63', '#E9A400', '#C64BB2']

/**
 * Colored-pencil mode, drawn over a translucent wash of your actual wall
 * so the doodle lands in context. Each session produces ONE new movable
 * doodle object.
 *
 * Capture is Notes-style smoothed (distance thinning + exponential
 * easing + quadratic rendering) and, for latency, the in-progress stroke
 * bypasses React entirely: points append into a ref and the live <path>
 * is mutated directly, so nothing re-renders until the stroke commits.
 * Apple Pencil's high-rate coalesced samples are consumed when offered.
 */
export default function DrawingBoard({ onSave, onClose }: Props) {
  const surfaceRef = useRef<SVGSVGElement>(null)
  const livePathRef = useRef<SVGPathElement>(null)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const liveRef = useRef<Stroke | null>(null)
  const lastPx = useRef<[number, number] | null>(null)
  const rectRef = useRef<DOMRect | null>(null)
  const [color, setColor] = useState(PENCILS[0]!)
  const drawing = useRef(false)

  // Pixel size of the surface. Strokes are STORED as 0..1 fractions but
  // RENDERED in raw pixels — Safari's vector-effect:non-scaling-stroke
  // breaks on degenerate paths under non-uniform viewBox scaling (a
  // tapped dot painted as a screen-sized blob), so we don't use it.
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)
  const dimsRef = useRef(dims)
  useLayoutEffect(() => {
    const measure = () => {
      const r = surfaceRef.current?.getBoundingClientRect()
      if (r && r.width > 0) {
        const d = { w: r.width, h: r.height }
        dimsRef.current = d
        setDims(d)
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const toFrac = (x: number, y: number): [number, number] => {
    const r = rectRef.current!
    return [
      Math.min(1, Math.max(0, (x - r.left) / r.width)),
      Math.min(1, Math.max(0, (y - r.top) / r.height)),
    ]
  }

  const paintLive = () => {
    const el = livePathRef.current
    const s = liveRef.current
    const d = dimsRef.current
    if (el && s && d) el.setAttribute('d', strokePathScaled(s.p, d.w, d.h))
  }

  const onDown = (e: React.PointerEvent) => {
    if (!e.isPrimary || !surfaceRef.current) return
    drawing.current = true
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId) } catch { /* ignore */ }
    rectRef.current = surfaceRef.current.getBoundingClientRect()
    lastPx.current = [e.clientX, e.clientY]
    liveRef.current = { c: color, w: 3, p: [...toFrac(e.clientX, e.clientY)] }
    livePathRef.current?.setAttribute('stroke', color)
    paintLive()
  }

  const onMove = (e: React.PointerEvent) => {
    if (!e.isPrimary || !drawing.current || !liveRef.current || !lastPx.current) return
    // Apple Pencil / high-rate screens batch several samples per event.
    const native = e.nativeEvent as PointerEvent
    const samples: { clientX: number; clientY: number }[] =
      typeof native.getCoalescedEvents === 'function' && native.getCoalescedEvents().length > 0
        ? native.getCoalescedEvents()
        : [native]
    let appended = false
    for (const ev of samples) {
      const last: [number, number] = lastPx.current
      const lx: number = last[0], ly: number = last[1]
      // Thin: ignore movements under ~2.5px — kills sensor jitter.
      if (Math.hypot(ev.clientX - lx, ev.clientY - ly) < 2.5) continue
      // Ease toward the pen — the ink trails slightly, like Notes.
      const sx: number = lx + (ev.clientX - lx) * 0.55
      const sy: number = ly + (ev.clientY - ly) * 0.55
      lastPx.current = [sx, sy]
      liveRef.current.p.push(...toFrac(sx, sy))
      appended = true
    }
    if (appended) paintLive()
  }

  const onUp = () => {
    if (!drawing.current) return
    drawing.current = false
    const s = liveRef.current
    liveRef.current = null
    lastPx.current = null
    livePathRef.current?.setAttribute('d', '')
    // A single point is a dot — round caps make it a real mark.
    if (s && s.p.length >= 2) setStrokes((prev) => [...prev, s])
  }

  return (
    <div className="drawboard">
      {/* No viewBox: svg user units ARE css pixels, stroke widths honest. */}
      <svg
        ref={surfaceRef}
        className="drawboard-surface"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {dims && strokes.map((s, i) => (
          <path
            key={i}
            d={strokePathScaled(s.p, dims.w, dims.h)}
            fill="none"
            stroke={s.c}
            strokeWidth={s.w}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.9}
            /* Painted strokes must never become touch targets — on iOS
               they'd hijack touches near existing ink into scroll. */
            pointerEvents="none"
          />
        ))}
        {/* The in-progress stroke — mutated directly, outside React. */}
        <path
          ref={livePathRef}
          fill="none"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.9}
          pointerEvents="none"
        />
      </svg>

      <div className="drawboard-bar">
        <div className="drawboard-pencils">
          {PENCILS.map((c) => (
            <button
              key={c}
              className={`drawboard-pencil${color === c ? ' on' : ''}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
              aria-label={`Pencil ${c}`}
            />
          ))}
        </div>
        <div className="drawboard-actions">
          <button
            className="drawboard-act"
            disabled={strokes.length === 0}
            onClick={() => setStrokes((p) => p.slice(0, -1))}
          >
            undo
          </button>
          <button className="drawboard-act" onClick={onClose}>
            cancel
          </button>
          <button
            className="drawboard-done"
            disabled={strokes.length === 0}
            onClick={() => { onSave(strokes); onClose() }}
          >
            done
          </button>
        </div>
      </div>
    </div>
  )
}
