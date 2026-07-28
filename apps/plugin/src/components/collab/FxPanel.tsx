import { useEffect, useRef, useState } from 'react'
import { getFx, setFx, hasFxBridge, FX_DEFAULTS, type FxMode } from '../../lib/fxBridge'

/** The five one-knob effects, in processor order. Each is drawn as a
 *  print on a darkened room wall — the print itself is the control,
 *  and the wall warms toward each effect's own colour as you turn it. */
const MODES: Array<{ id: FxMode; name: string }> = [
  { id: 0, name: 'tone' },
  { id: 1, name: 'tape' },
  { id: 2, name: 'space' },
  { id: 3, name: 'stereo' },
  { id: 4, name: 'glue' },
]

/* strokes read as paper on the dark wall; blue stays the second ink */
const PAPER = '#F6F3EA'
const BLUE = '#5A6BFF'
const C = 110
const R = 86

/* the wall: near-black at zero, each mode's own light — full and loud
   — at the top of the knob */
const WALL_DARK: [number, number, number] = [22, 20, 16]
const WALL_TINTS: Array<[number, number, number]> = [
  [255, 178, 44],   // tone — noon amber
  [255, 108, 36],   // tape — hot orange
  [36, 64, 255],    // space — pure klein
  [150, 84, 255],   // stereo — electric violet
  [52, 199, 118],   // glue — signal green
]

function wallColor (mode: FxMode, a: number): string {
  const t = WALL_TINTS[mode]
  const c = WALL_DARK.map((d, i) => Math.round(d + (t[i] - d) * a))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}

/* strokes ride from paper to ink as the wall brightens, so the print
   stays crisp at both ends of the throw */
const INK = '#1A1917'
function mixHex (h1: string, h2: string, t: number): string {
  const p = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
  const [a1, b1, c1] = p(h1); const [a2, b2, c2] = p(h2)
  const m = (x: number, y: number) => Math.round(x + (y - x) * t)
  return `rgb(${m(a1, a2)}, ${m(b1, b2)}, ${m(c1, c2)})`
}
const strokeFor = (a: number) => mixHex(PAPER, INK, Math.min(1, Math.max(0, (a - 0.5) * 1.7)))
const accentFor = (a: number) => mixHex(BLUE, INK, Math.min(1, Math.max(0, (a - 0.62) * 2.4)))

/* ── tone: a field of horizontal hairlines whose weight tilts ────────── */
function ToneArt ({ a }: { a: number }) {
  const s = strokeFor(a), acc = accentFor(a)
  const tilt = (a - 0.5) * 2
  const lines = []
  for (let y = -R + 4; y <= R - 4; y += 6) {
    const half = Math.sqrt(R * R - y * y)
    const w = Math.max(0.35, 1.4 + tilt * (-y / R) * 2.6)
    lines.push(
      <line key={y} x1={C - half} y1={C + y} x2={C + half} y2={C + y}
        stroke={y === 0 ? acc : s} strokeWidth={y === 0 ? 1.6 : w} />,
    )
  }
  return <g>{lines}</g>
}

/* ── tape: concentric pressings that warp and thicken with drive ─────── */
function TapeArt ({ a }: { a: number }) {
  const s = strokeFor(a), acc = accentFor(a)
  const rings = []
  for (let ri = 0; ri < 10; ri++) {
    const r = 12 + ri * 8.2
    const amp = a * (r / R) * 7
    const pts: string[] = []
    for (let i = 0; i <= 72; i++) {
      const th = (i / 72) * Math.PI * 2
      const rr = r + amp * Math.sin(6 * th + ri * 1.7)
      pts.push(`${C + Math.cos(th) * rr} ${C + Math.sin(th) * rr}`)
    }
    rings.push(
      <path key={ri} d={`M ${pts.join(' L ')} Z`} fill="none"
        stroke={ri === 0 ? acc : s}
        strokeWidth={0.9 + a * 2.1} />,
    )
  }
  return <g>{rings}</g>
}

/* ── space: echoes ringing out from a blue source ────────────────────── */
function SpaceArt ({ a }: { a: number }) {
  const s = strokeFor(a), acc = accentFor(a)
  const count = Math.round(a * 7)
  const rings = []
  for (let i = 0; i < count; i++) {
    const r = 13 + (i + 1) * (9 + a * 11)
    if (r > R) break
    rings.push(
      <circle key={i} cx={C} cy={C} r={r} fill="none" stroke={s}
        strokeWidth={1.1} opacity={0.9 * (1 - i / (count + 1))} />,
    )
  }
  return (
    <g>
      <circle cx={C} cy={C} r={5.5} fill={acc} />
      {rings}
    </g>
  )
}

/* ── stereo: one circle becomes two; the shared lens turns blue ──────── */
function StereoArt ({ a }: { a: number }) {
  const s = strokeFor(a), acc = accentFor(a)
  const r = 60
  const d = a * 30
  const h = Math.sqrt(Math.max(0, r * r - d * d))
  return (
    <g>
      {d > 1 && h > 1 && (
        <path
          d={`M ${C} ${C - h} A ${r} ${r} 0 0 1 ${C} ${C + h} A ${r} ${r} 0 0 1 ${C} ${C - h} Z`}
          fill={acc} opacity={0.22 + a * 0.12} stroke={acc} strokeWidth={1} strokeOpacity={0.6}
        />
      )}
      <circle cx={C - d} cy={C} r={r} fill="none" stroke={s} strokeWidth={1.5} />
      <circle cx={C + d} cy={C} r={r} fill="none" stroke={s} strokeWidth={1.5} />
    </g>
  )
}

/* ── glue: a scattered field pulled into a sunflower cluster ─────────── */
const GOLDEN = Math.PI * (3 - Math.sqrt(5))
function GlueArt ({ a }: { a: number }) {
  const s = strokeFor(a), acc = accentFor(a)
  const dots = []
  for (let i = 0; i < 46; i++) {
    const th = i * GOLDEN
    const loose = R * 0.98 * Math.sqrt((i + 0.5) / 46)
    const jitter = Math.sin(i * 12.9898) * 8 * (1 - a)
    const tight = 34 * Math.sqrt((i + 0.5) / 46)
    const r = loose + (tight - loose) * a + jitter
    dots.push(
      <circle key={i}
        cx={C + Math.cos(th) * r} cy={C + Math.sin(th) * r}
        r={2 + a * 0.9} fill={s} />,
    )
  }
  return (
    <g>
      {dots}
      <circle cx={C} cy={C} r={3.2} fill={acc} />
    </g>
  )
}

const ARTS = [ToneArt, TapeArt, SpaceArt, StereoArt, GlueArt]

function fmtValue (mode: FxMode, a: number): string {
  if (mode === 0) {
    const db = (a - 0.5) * 12
    return `${db > 0 ? '+' : db < 0 ? '−' : ''}${Math.abs(db).toFixed(1)}`
  }
  return `${Math.round(a * 100)}`
}

interface Props {
  isOpen: boolean
}

export default function FxPanel ({ isOpen }: Props) {
  const [mode, setMode] = useState<FxMode>(0)
  const [amounts, setAmounts] = useState<number[]>([...FX_DEFAULTS.amounts])
  const [bridge] = useState(() => hasFxBridge())
  const [showValue, setShowValue] = useState(false)
  const [lit, setLit] = useState(false)          // false = still paper; true = the room is dark
  const [slide, setSlide] = useState<'l' | 'r' | null>(null)
  const [live, setLive] = useState(false)        // dragging → snappier wall
  const dragging = useRef(false)
  const dragStart = useRef({ y: 0, a: 0 })
  const lastSent = useRef(0)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isOpen) { setLit(false); return }
    void getFx().then((s) => { setMode(s.mode); setAmounts(s.amounts) })
    // let the paper render once, then dim the room slowly
    const t = setTimeout(() => setLit(true), 40)
    return () => clearTimeout(t)
  }, [isOpen])

  const a = amounts[mode] ?? 0
  const neutral = mode === 0 ? 0.5 : 0
  const Art = ARTS[mode]

  // The whole screen is the room: paint the wall colour onto the plugin
  // root so the toolbar dims and lights with the panel.
  useEffect(() => {
    const el = document.querySelector('.plugin') as HTMLElement | null
    if (!el) return
    if (isOpen && lit) el.style.setProperty('--fx-wall', wallColor(mode, a))
    else el.style.removeProperty('--fx-wall')
  }, [isOpen, lit, mode, a])
  useEffect(() => () => {
    (document.querySelector('.plugin') as HTMLElement | null)?.style.removeProperty('--fx-wall')
  }, [])
  useEffect(() => {
    const el = document.querySelector('.plugin') as HTMLElement | null
    el?.classList.toggle('fx-live', live)
    return () => el?.classList.remove('fx-live')
  }, [live])

  const flashValue = () => {
    setShowValue(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setShowValue(false), 750)
  }

  const apply = (next: number, force = false) => {
    const clamped = Math.min(1, Math.max(0, next))
    setAmounts((prev) => prev.map((v, i) => (i === mode ? clamped : v)))
    flashValue()
    const now = performance.now()
    if (force || now - lastSent.current > 33) {
      lastSent.current = now
      setFx({ mode, amount: clamped })
    }
  }

  const step = (dir: 1 | -1) => {
    const next = MODES[(mode + dir + MODES.length) % MODES.length].id
    setMode(next)
    setShowValue(false)
    setSlide(dir === 1 ? 'r' : 'l')
    setFx({ mode: next })
  }

  return (
    <div className={`s-body fx-body${live ? ' live' : ''}`}>
      <div className="fx-stage">
        <div
          className="fx-art"
          role="slider"
          aria-label={`${MODES[mode].name} amount`}
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(a * 100)}
          tabIndex={0}
          onPointerDown={(e) => {
            dragging.current = true
            setLive(true)
            dragStart.current = { y: e.clientY, a }
            try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* fine */ }
          }}
          onPointerMove={(e) => {
            if (!dragging.current) return
            apply(dragStart.current.a + (dragStart.current.y - e.clientY) / 190)
          }}
          onPointerUp={() => { dragging.current = false; setLive(false); apply(amounts[mode] ?? 0, true) }}
          onDoubleClick={() => apply(neutral, true)}
          onWheel={(e) => { e.preventDefault(); apply(a - Math.sign(e.deltaY) * 0.02, true) }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowRight') apply(a + 0.02, true)
            if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') apply(a - 0.02, true)
          }}
        >
          <svg viewBox="0 0 220 220" aria-hidden="true">
            <Art a={a} />
          </svg>
          <span className={`fx-art-value${showValue ? ' show' : ''}`} style={{ color: strokeFor(a) }}>{fmtValue(mode, a)}</span>
        </div>
      </div>

      <div className="fx-pager">
        <button className="fx-arrow" onClick={() => step(-1)} aria-label="Previous effect">‹</button>
        <div className="fx-chip">
          <span key={mode} className={`fx-chip-label${slide ? ` from-${slide}` : ''}`}>
            {MODES[mode].name}
          </span>
        </div>
        <button className="fx-arrow" onClick={() => step(1)} aria-label="Next effect">›</button>
      </div>

      {!bridge && (
        <p className="fx-note">browser mode — the audio itself runs inside the daw.</p>
      )}
    </div>
  )
}
