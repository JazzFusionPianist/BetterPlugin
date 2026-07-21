'use client'

import { useRef, useState } from 'react'
import type { Stroke } from '@orb/core'

interface Props {
  /** The wall's existing pencil marks — editing continues on top. */
  initial: Stroke[]
  onSave: (strokes: Stroke[]) => void
  onClose: () => void
}

/** The pencil case — riso-adjacent colours that sit well on the paper. */
const PENCILS = ['#1A1917', '#2440FF', '#E5432D', '#1E9E63', '#E9A400', '#C64BB2']

/**
 * Full-screen colored-pencil mode for the home canvas. Strokes are
 * captured as 0..1 canvas fractions and saved as vector data — a few KB,
 * re-editable, no file upload. Undo pops the last stroke; clear wipes
 * the page.
 */
export default function DrawingBoard({ initial, onSave, onClose }: Props) {
  const surfaceRef = useRef<SVGSVGElement>(null)
  const [strokes, setStrokes] = useState<Stroke[]>(initial)
  const [live, setLive] = useState<Stroke | null>(null)
  // Mirror of `live` — state updaters must stay pure (StrictMode runs
  // them twice), so the commit on pointer-up reads from here instead.
  const liveRef = useRef<Stroke | null>(null)
  const [color, setColor] = useState(PENCILS[0]!)
  const drawing = useRef(false)

  const toFrac = (e: React.PointerEvent): [number, number] | null => {
    const rect = surfaceRef.current?.getBoundingClientRect()
    if (!rect) return null
    return [
      Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    ]
  }

  const onDown = (e: React.PointerEvent) => {
    const pt = toFrac(e)
    if (!pt) return
    drawing.current = true
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId) } catch { /* ignore */ }
    const s = { c: color, w: 3, p: [...pt] }
    liveRef.current = s
    setLive(s)
  }
  const onMove = (e: React.PointerEvent) => {
    if (!drawing.current || !liveRef.current) return
    const pt = toFrac(e)
    if (!pt) return
    const s = { ...liveRef.current, p: [...liveRef.current.p, ...pt] }
    liveRef.current = s
    setLive(s)
  }
  const onUp = () => {
    if (!drawing.current) return
    drawing.current = false
    const s = liveRef.current
    liveRef.current = null
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
          <polyline
            key={i}
            points={pointsOf(s.p)}
            fill="none"
            stroke={s.c}
            strokeWidth={s.w}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            opacity={0.9}
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
          <button
            className="drawboard-act"
            disabled={strokes.length === 0}
            onClick={() => setStrokes([])}
          >
            clear
          </button>
          <button className="drawboard-done" onClick={() => { onSave(strokes); onClose() }}>
            done
          </button>
        </div>
      </div>
    </div>
  )
}

const pointsOf = (p: number[]) => {
  let out = ''
  for (let i = 0; i + 1 < p.length; i += 2) out += `${p[i]},${p[i + 1]} `
  return out.trim()
}
