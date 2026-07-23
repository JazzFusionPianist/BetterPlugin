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
const PENCILS = [
  '#1A1917', '#8D8A83', '#2440FF', '#56A8E8', '#1E9E63', '#E9A400',
  '#E8622C', '#E5432D', '#F27FA5', '#C64BB2', '#6C4AE0', '#8A5A3B',
]

type ToolId = 'pen' | 'pencil' | 'marker' | 'high' | 'eraser' | 'line' | 'rect' | 'ellipse'

/** Freehand nibs: width in px, ink opacity. */
const NIBS: Record<'pen' | 'pencil' | 'marker' | 'high', { w: number; o: number }> = {
  pen: { w: 3, o: 0.9 },
  pencil: { w: 1.8, o: 0.6 },
  marker: { w: 6.5, o: 0.95 },
  high: { w: 15, o: 0.3 },
}
const SHAPES: ToolId[] = ['line', 'rect', 'ellipse']

/** Point-to-segment distance, for the eraser's hit test. */
function distSeg(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(px - x1, py - y1)
  const t = Math.min(1, Math.max(0, ((px - x1) * dx + (py - y1) * dy) / len2))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

/** Shape outlines as fraction-space point lists (rendered raw). */
function buildShape(tool: ToolId, a: [number, number], b: [number, number]): number[] {
  if (tool === 'line') return [a[0], a[1], b[0], b[1]]
  if (tool === 'rect') return [a[0], a[1], b[0], a[1], b[0], b[1], a[0], b[1], a[0], a[1]]
  // ellipse inscribed in the drag box
  const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2
  const rx = Math.abs(b[0] - a[0]) / 2, ry = Math.abs(b[1] - a[1]) / 2
  const pts: number[] = []
  for (let i = 0; i <= 48; i++) {
    const t = (i / 48) * Math.PI * 2
    pts.push(cx + Math.cos(t) * rx, cy + Math.sin(t) * ry)
  }
  return pts
}

/**
 * Colored-pencil mode, drawn over a translucent wash of your actual wall
 * so the doodle lands in context. Each session produces ONE new movable
 * doodle object.
 *
 * Tools: four freehand nibs (pen / pencil / marker / highlighter), a
 * stroke eraser, and drag-to-size shapes (line / rect / ellipse, stored
 * as raw polyline strokes so they stay plain data). Undo is a history
 * stack of stroke arrays, so erasing is undoable too.
 *
 * Freehand capture is Notes-style smoothed (distance thinning +
 * exponential easing + quadratic rendering) and, for latency, the
 * in-progress stroke bypasses React entirely: points append into a ref
 * and the live <path> is mutated directly. Apple Pencil's high-rate
 * coalesced samples are consumed when offered.
 */
export default function DrawingBoard({ onSave, onClose }: Props) {
  const surfaceRef = useRef<SVGSVGElement>(null)
  const livePathRef = useRef<SVGPathElement>(null)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const strokesRef = useRef<Stroke[]>([])
  const histRef = useRef<Stroke[][]>([])
  const [histLen, setHistLen] = useState(0)
  const liveRef = useRef<Stroke | null>(null)
  const lastPx = useRef<[number, number] | null>(null)
  const rectRef = useRef<DOMRect | null>(null)
  const shapeStart = useRef<[number, number] | null>(null)
  const eraseTouched = useRef(false)
  const eraseSnapshot = useRef<Stroke[]>([])
  const [color, setColor] = useState(PENCILS[0]!)
  const [tool, setTool] = useState<ToolId>('pen')
  const drawing = useRef(false)

  /** Every mutation goes through here so undo sees it. */
  const commit = (next: Stroke[], snapshot?: Stroke[]) => {
    histRef.current.push(snapshot ?? strokesRef.current)
    strokesRef.current = next
    setStrokes(next)
    setHistLen(histRef.current.length)
  }
  const undo = () => {
    const prev = histRef.current.pop()
    if (!prev) return
    strokesRef.current = prev
    setStrokes(prev)
    setHistLen(histRef.current.length)
  }

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
    if (el && s && d) el.setAttribute('d', strokePathScaled(s.p, d.w, d.h, 0, 0, s.r === 1))
  }
  const armLive = (s: Stroke) => {
    const el = livePathRef.current
    if (!el) return
    el.setAttribute('stroke', s.c)
    el.setAttribute('stroke-width', String(s.w))
    el.setAttribute('opacity', String(s.o ?? 0.9))
  }

  /** Remove any stroke the eraser touches at this client point. */
  const eraseAt = (cx: number, cy: number) => {
    const r = rectRef.current
    const d = dimsRef.current
    if (!r || !d) return
    const x = cx - r.left, y = cy - r.top
    const next = strokesRef.current.filter((s) => {
      const R = Math.max(11, s.w * 0.75 + 8)
      const p = s.p
      if (p.length === 2) return Math.hypot(p[0]! * d.w - x, p[1]! * d.h - y) >= R
      for (let i = 0; i + 3 < p.length; i += 2) {
        if (distSeg(x, y, p[i]! * d.w, p[i + 1]! * d.h, p[i + 2]! * d.w, p[i + 3]! * d.h) < R) return false
      }
      return true
    })
    if (next.length !== strokesRef.current.length) {
      if (!eraseTouched.current) {
        eraseTouched.current = true
        commit(next, eraseSnapshot.current)
      } else {
        strokesRef.current = next
        setStrokes(next)
      }
    }
  }

  const onDown = (e: React.PointerEvent) => {
    if (!e.isPrimary || !surfaceRef.current) return
    drawing.current = true
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId) } catch { /* ignore */ }
    rectRef.current = surfaceRef.current.getBoundingClientRect()

    if (tool === 'eraser') {
      eraseTouched.current = false
      eraseSnapshot.current = strokesRef.current
      eraseAt(e.clientX, e.clientY)
      return
    }
    if (SHAPES.includes(tool)) {
      shapeStart.current = toFrac(e.clientX, e.clientY)
      liveRef.current = { c: color, w: 3, p: [...shapeStart.current, ...shapeStart.current], r: 1 }
      armLive(liveRef.current)
      paintLive()
      return
    }
    const nib = NIBS[tool as keyof typeof NIBS]
    lastPx.current = [e.clientX, e.clientY]
    liveRef.current = { c: color, w: nib.w, o: nib.o, p: [...toFrac(e.clientX, e.clientY)] }
    armLive(liveRef.current)
    paintLive()
  }

  const onMove = (e: React.PointerEvent) => {
    if (!e.isPrimary || !drawing.current) return
    if (tool === 'eraser') { eraseAt(e.clientX, e.clientY); return }
    if (!liveRef.current) return
    if (SHAPES.includes(tool)) {
      const a = shapeStart.current
      if (!a) return
      liveRef.current.p = buildShape(tool, a, toFrac(e.clientX, e.clientY))
      paintLive()
      return
    }
    if (!lastPx.current) return
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
    if (tool === 'eraser') return
    const s = liveRef.current
    liveRef.current = null
    lastPx.current = null
    shapeStart.current = null
    livePathRef.current?.setAttribute('d', '')
    if (!s) return
    if (SHAPES.includes(tool)) {
      // A shape with no drag area is an accident, not a mark.
      const xs = s.p.filter((_, i) => i % 2 === 0), ys = s.p.filter((_, i) => i % 2 === 1)
      if (Math.max(...xs) - Math.min(...xs) < 0.01 && Math.max(...ys) - Math.min(...ys) < 0.01) return
      commit([...strokesRef.current, s])
      return
    }
    // A single point is a dot — round caps make it a real mark.
    if (s.p.length >= 2) commit([...strokesRef.current, s])
  }

  /** A nib button shows its own stroke: honest width and opacity. */
  const NibIcon = ({ id }: { id: 'pen' | 'pencil' | 'marker' | 'high' }) => (
    <svg width="26" height="18" viewBox="0 0 26 18">
      <path d="M 3 12 C 9 5, 17 13, 23 6" fill="none" stroke="currentColor"
        strokeWidth={Math.min(NIBS[id].w, 9)} strokeLinecap="round" opacity={Math.max(0.35, NIBS[id].o)} />
    </svg>
  )

  return (
    <div className="drawboard">
      {/* No viewBox: svg user units ARE css pixels, stroke widths honest. */}
      <svg
        ref={surfaceRef}
        className={`drawboard-surface${tool === 'eraser' ? ' erasing' : ''}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {dims && strokes.map((s, i) => (
          <path
            key={i}
            d={strokePathScaled(s.p, dims.w, dims.h, 0, 0, s.r === 1)}
            fill="none"
            stroke={s.c}
            strokeWidth={s.w}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={s.o ?? 0.9}
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
        <div className="drawboard-tools">
          {(['pen', 'pencil', 'marker', 'high'] as const).map((id) => (
            <button
              key={id}
              className={`drawboard-tool${tool === id ? ' on' : ''}`}
              onClick={() => setTool(id)}
              aria-label={id}
            >
              <NibIcon id={id} />
            </button>
          ))}
          <span className="drawboard-sep" />
          <button
            className={`drawboard-tool${tool === 'eraser' ? ' on' : ''}`}
            onClick={() => setTool('eraser')}
            aria-label="Eraser"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 20H8.5l-5-5a2 2 0 0 1 0-2.8l8.7-8.7a2 2 0 0 1 2.8 0l5 5a2 2 0 0 1 0 2.8L13.5 18" />
              <path d="M7.5 10.5l6 6" />
            </svg>
          </button>
          <span className="drawboard-sep" />
          <button className={`drawboard-tool${tool === 'line' ? ' on' : ''}`} onClick={() => setTool('line')} aria-label="Line">
            <svg width="16" height="16" viewBox="0 0 16 16"><path d="M2.5 13.5l11-11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
          <button className={`drawboard-tool${tool === 'rect' ? ' on' : ''}`} onClick={() => setTool('rect')} aria-label="Rectangle">
            <svg width="16" height="16" viewBox="0 0 16 16"><rect x="2.5" y="3.5" width="11" height="9" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
          </button>
          <button className={`drawboard-tool${tool === 'ellipse' ? ' on' : ''}`} onClick={() => setTool('ellipse')} aria-label="Ellipse">
            <svg width="16" height="16" viewBox="0 0 16 16"><ellipse cx="8" cy="8" rx="5.5" ry="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
          </button>
        </div>

        <div className="drawboard-row">
          <div className="drawboard-pencils">
            {PENCILS.map((c) => (
              <button
                key={c}
                className={`drawboard-pencil${color === c ? ' on' : ''}`}
                style={{ background: c }}
                onClick={() => { setColor(c); if (tool === 'eraser') setTool('pen') }}
                aria-label={`Pencil ${c}`}
              />
            ))}
          </div>
          <div className="drawboard-actions">
            <button className="drawboard-act" disabled={histLen === 0} onClick={undo}>
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
    </div>
  )
}
