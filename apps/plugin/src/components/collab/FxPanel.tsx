import { useEffect, useRef, useState } from 'react'
import { getFx, setFx, hasFxBridge, FX_DEFAULTS, type FxMode } from '../../lib/fxBridge'

/** The five one-knob effects, in processor order. */
const MODES: Array<{ id: FxMode; name: string; blurb: string }> = [
  { id: 0, name: 'tone', blurb: 'tilt — darker on the left, brighter on the right' },
  { id: 1, name: 'tape', blurb: 'a little warmth and saturation' },
  { id: 2, name: 'space', blurb: 'a small room around the sound' },
  { id: 3, name: 'stereo', blurb: 'width from phase — folds back to mono untouched' },
  { id: 4, name: 'glue', blurb: 'gentle 4:1 compression with makeup' },
]

const KNOB_START = -135
const KNOB_END = 135

function fmtValue (mode: FxMode, a: number): string {
  if (mode === 0) {
    const db = (a - 0.5) * 12
    if (Math.abs(db) < 0.05) return 'flat'
    return `${db > 0 ? '+' : '−'}${Math.abs(db).toFixed(1)} db`
  }
  return `${Math.round(a * 100)}%`
}

function polar (cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg - 90) * Math.PI / 180
  return [cx + Math.cos(rad) * r, cy + Math.sin(rad) * r]
}

function arcPath (cx: number, cy: number, r: number, a1: number, a2: number): string {
  const [x1, y1] = polar(cx, cy, r, a1)
  const [x2, y2] = polar(cx, cy, r, a2)
  return `M ${x1} ${y1} A ${r} ${r} 0 ${Math.abs(a2 - a1) > 180 ? 1 : 0} ${a2 > a1 ? 1 : 0} ${x2} ${y2}`
}

interface Props {
  isOpen: boolean
}

export default function FxPanel ({ isOpen }: Props) {
  const [mode, setMode] = useState<FxMode>(0)
  const [amounts, setAmounts] = useState<number[]>([...FX_DEFAULTS.amounts])
  const [bridge] = useState(() => hasFxBridge())
  const dragging = useRef(false)
  const dragStart = useRef({ y: 0, a: 0 })
  const lastSent = useRef(0)

  useEffect(() => {
    if (!isOpen) return
    void getFx().then((s) => { setMode(s.mode); setAmounts(s.amounts) })
  }, [isOpen])

  const a = amounts[mode] ?? 0
  const neutral = mode === 0 ? 0.5 : 0

  const apply = (next: number, force = false) => {
    const clamped = Math.min(1, Math.max(0, next))
    setAmounts((prev) => prev.map((v, i) => (i === mode ? clamped : v)))
    const now = performance.now()
    if (force || now - lastSent.current > 33) {
      lastSent.current = now
      setFx({ mode, amount: clamped })
    }
  }

  const pick = (m: FxMode) => {
    setMode(m)
    setFx({ mode: m })
  }

  const angle = KNOB_START + a * (KNOB_END - KNOB_START)
  const [px, py] = polar(70, 70, 44, angle)

  return (
    <div className="s-body fx-body">
      <div className="fx-modes" role="tablist">
        {MODES.map((m) => (
          <button
            key={m.id}
            role="tab"
            aria-selected={mode === m.id}
            className={`fx-mode${mode === m.id ? ' on' : ''}`}
            onClick={() => pick(m.id)}
          >
            {m.name}
          </button>
        ))}
      </div>

      <div className="fx-stage">
        <div
          className="fx-knob"
          role="slider"
          aria-label={`${MODES[mode].name} amount`}
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(a * 100)}
          tabIndex={0}
          onPointerDown={(e) => {
            dragging.current = true
            dragStart.current = { y: e.clientY, a }
            // setPointerCapture throws on synthetic events and some SVG
            // targets — capture is a nicety, never let it kill the drag.
            try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* fine */ }
          }}
          onPointerMove={(e) => {
            if (!dragging.current) return
            apply(dragStart.current.a + (dragStart.current.y - e.clientY) / 150)
          }}
          onPointerUp={() => { dragging.current = false; apply(amounts[mode] ?? 0, true) }}
          onDoubleClick={() => apply(neutral, true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowRight') apply(a + 0.02, true)
            if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') apply(a - 0.02, true)
          }}
        >
          <svg viewBox="0 0 140 140" aria-hidden="true">
            {/* travel track + progress in the second ink */}
            <path d={arcPath(70, 70, 54, KNOB_START, KNOB_END)} className="fx-knob-track" />
            {mode === 0 ? (
              Math.abs(a - 0.5) > 0.004 && (
                <path d={arcPath(70, 70, 54, 0, angle)} className="fx-knob-arc" />
              )
            ) : (
              a > 0.004 && <path d={arcPath(70, 70, 54, KNOB_START, angle)} className="fx-knob-arc" />
            )}
            {/* end ticks + centre detent for tone */}
            {[KNOB_START, KNOB_END].map((deg) => {
              const [x1, y1] = polar(70, 70, 58, deg)
              const [x2, y2] = polar(70, 70, 63, deg)
              return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} className="fx-knob-tick" />
            })}
            {mode === 0 && (() => {
              const [x1, y1] = polar(70, 70, 58, 0)
              const [x2, y2] = polar(70, 70, 63, 0)
              return <line x1={x1} y1={y1} x2={x2} y2={y2} className="fx-knob-tick" />
            })()}
            {/* the knob face */}
            <circle cx="70" cy="70" r="46" className="fx-knob-face" />
            <line x1={70 + (px - 70) * 0.35} y1={70 + (py - 70) * 0.35} x2={px} y2={py} className="fx-knob-pointer" />
          </svg>
        </div>

        <div className="fx-value">{fmtValue(mode, a)}</div>
        <div className="fx-blurb">{MODES[mode].blurb}</div>
      </div>

      {!bridge && (
        <p className="fx-note">browser mode — the audio itself runs inside the daw.</p>
      )}
    </div>
  )
}
