'use client'

import { useRef, useState } from 'react'
import type { Stroke } from '@orb/core'
import { strokePath } from '@/lib/strokes'

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
 * doodle object. Capture is Notes-style smoothed: points are thinned by
 * distance, eased toward the pen (exponential smoothing), and rendered
 * as quadratic curves through midpoints.
 */
export default function DrawingBoard({ onSave, onClose }: Props) {
  const surfaceRef = useRef<SVGSVGElement>(null)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [live, setLive] = useState<Stroke | null>(null)
  // Mirror of `live` — state updaters must stay pure (StrictMode runs
  // them twice), so drawing mutates here and commits from here.
  const liveRef = useRef<Stroke | null>(null)
  const lastPx = useRef<[number, number] | null>(null)
  const [color, setColor] = useState(PENCILS[0]!)
  const drawing = useRef(false)

  const toFrac = (x: number, y: number): [number, number] => {
    const rect = surfaceRef.current!.getBoundingClientRect()
    return [
      Math.min(1, Math.max(0, (x - rect.left) / rect.width)),
      Math.min(1, Math.max(0, (y - rect.top) / rect.height)),
    ]
  }

  const onDown = (e: React.PointerEvent) => {
    if (!e.isPrimary || !surfaceRef.current) return
    drawing.current = true
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId) } catch { /* ignore */ }
    lastPx.current = [e.clientX, e.clientY]
    const s = { c: color, w: 3, p: [...toFrac(e.clientX, e.clientY)] }
    liveRef.current = s
    setLive(s)
  }

  const onMove = (e: React.PointerEvent) => {
    if (!e.isPrimary || !drawing.current || !liveRef.current || !lastPx.current) return
    // Thin: ignore movements under ~2.5px — kills sensor jitter.
    const [lx, ly] = lastPx.current
    if (Math.hypot(e.clientX - lx, e.clientY - ly) < 2.5) return
    // Ease toward the pen — the ink trails slightly, like Notes.
    const sx = lx + (e.clientX - lx) * 0.55
    const sy = ly + (e.clientY - ly) * 0.55
    lastPx.current = [sx, sy]
    const s = { ...liveRef.current, p: [...liveRef.current.p, ...toFrac(sx, sy)] }
    liveRef.current = s
    setLive(s)
  }

  const onUp = () => {
    if (!drawing.current) return
    drawing.current = false
    const s = liveRef.current
    liveRef.current = null
    lastPx.current = null
    setLive(null)
    if (s && s.p.length >= 4) setStrokes((prev) => [...prev, s])
  }

  const all = live ? [...strokes, live] : strokes

  return (
    <div className="drawboard">
      <svg
        ref={surfaceRef}
        className="drawboard-surface"
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {all.map((s, i) => (
          <path
            key={i}
            d={strokePath(s.p)}
            fill="none"
            stroke={s.c}
            strokeWidth={s.w}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            opacity={0.9}
            /* Painted strokes must never become touch targets — on iOS
               they'd hijack touches near existing ink into scroll. */
            pointerEvents="none"
          />
        ))}
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
