import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getFx, setFx, hasFxBridge, FX_DEFAULTS, type FxMode } from '../../lib/fxBridge'

/** The seven one-knob effects, in processor order. Each is drawn as a
 *  print on a darkened room wall — the print itself is the control,
 *  and the wall warms toward each effect's own colour as you turn it. */
const MODES: Array<{ id: FxMode; name: string }> = [
  { id: 0, name: 'tone' },
  { id: 1, name: 'tape' },
  { id: 2, name: 'space' },
  { id: 3, name: 'stereo' },
  { id: 4, name: 'glue' },
  { id: 5, name: 'gain' },
  { id: 6, name: 'mod' },
]

/** Sub-flavours, shown under the mode slot. Gain's row is special-cased
 *  in the render: two independent polarity toggles, not a radio. */
const VARIANTS: string[][] = [
  [],
  ['hard', 'clean'],
  ['hall', 'room', 'plate'],
  [],
  [],
  [],
  ['chorus', 'flanger', 'phaser'],
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
  [255, 108, 36],   // tape/hard — hot orange
  [36, 64, 255],    // space/hall — pure klein
  [150, 84, 255],   // stereo — electric violet
  [52, 199, 118],   // glue — signal green
  [255, 56, 84],    // gain — scarlet meter
  [255, 84, 200],   // mod/chorus — rose neon
]

/** Flavours get their own light: [mode][variant] overrides. */
const VARIANT_TINTS: Record<number, Array<[number, number, number]>> = {
  1: [
    [255, 108, 36],   // hard — hot orange
    [86, 190, 255],   // clean — cool sky
  ],
  2: [
    [36, 64, 255],    // hall — pure klein
    [40, 158, 190],   // room — close teal
    [168, 206, 255],  // plate — bright ice
  ],
  6: [
    [255, 84, 200],   // chorus — rose neon
    [70, 215, 205],   // flanger — jet turquoise
    [178, 232, 66],   // phaser — acid lime
  ],
}

/** Glow colour (as an "r, g, b" triple): the flavour tint pushed most
 *  of the way to white — hot light in the flavour's hue, equally bright
 *  on a dark wall and a fully lit one, independent of the knob. Alpha
 *  is composed per-frame so the release fades out instead of snapping
 *  off at the threshold. */
function glowRgb (mode: FxMode, variant: number): string {
  const t = VARIANT_TINTS[mode]?.[variant] ?? WALL_TINTS[mode]
  const m = (x: number) => Math.round(x + (255 - x) * 0.85)
  return `${m(t[0])}, ${m(t[1])}, ${m(t[2])}`
}

/** Sparse plates emit less light per hit (space is a few thin rings vs
 *  tone's dense hatching) — even the score with a per-plate boost. */
const GLOW_BOOST = [1, 1, 1.9, 1.6, 1.35, 1.55, 1.15]

function wallColor (mode: FxMode, variant: number, a: number): string {
  const t = VARIANT_TINTS[mode]?.[variant] ?? WALL_TINTS[mode]
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

/** The reverb's real ring time, mirrored from the processor: the decay
 *  hand trims roomSize around each flavour's centre, roomSize sets the
 *  Freeverb comb feedback (0.7 + 0.28·rs), and −60 dB through the
 *  ~32 ms comb loop gives the seconds. Display only. */
function fmtDecay (variant: number, d: number): string {
  const rs = variant === 0 ? Math.min(1, Math.max(0, 0.769 + d * 0.191))
    : variant === 1 ? Math.min(1, Math.max(0.02, 0.16 + (d - 0.5) * 0.44))
    : Math.min(1, Math.max(0, 0.50 + (d - 0.5) * 0.70))
  const g = 0.7 + 0.28 * rs
  const t = 0.096 / -Math.log10(g)
  return `${t >= 10 ? t.toFixed(1) : t.toFixed(2)}s`
}

/* ── space: echoes ringing out from a blue source; an echo ladder under
      the plate is the decay control — drag it east-west ────────────────── */
function SpaceArt ({ a, decay = 0.5, variant = 0, onDecay }: {
  a: number
  decay?: number
  variant?: number
  onDecay?: (next: number, force?: boolean) => void
}) {
  const s = strokeFor(a), acc = accentFor(a)
  const drag = useRef<{ y: number; d: number; last: number } | null>(null)
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
  // the ladder IS the decay curve: each rung an echo, fading at the
  // rate the hand sets — long tails keep every rung alight
  const rungs = []
  const fade = 0.5 + decay * 0.48
  for (let i = 0; i < 13; i++) {
    rungs.push(
      <line key={i} x1={C - 60 + i * 8} y1={204} x2={C - 60 + i * 8} y2={214 - i * 0.25}
        stroke={i === 0 ? acc : s} strokeWidth={1.3}
        opacity={Math.max(0.04, Math.pow(fade, i))} />,
    )
  }
  return (
    <g>
      <circle cx={C} cy={C} r={5.5} fill={acc} />
      {rings}
      <g
        className="fx-hot"
        style={{ cursor: 'ew-resize' }}
        onPointerDown={(e) => {
          e.stopPropagation()
          drag.current = { y: e.clientX, d: decay, last: decay }
          try { (e.currentTarget as Element).setPointerCapture(e.pointerId) } catch { /* fine */ }
        }}
        onPointerMove={(e) => {
          if (!drag.current) return
          const next = drag.current.d + (e.clientX - drag.current.y) / 150
          drag.current.last = Math.min(1, Math.max(0, next))
          onDecay?.(next)
        }}
        onPointerUp={() => {
          if (drag.current) onDecay?.(drag.current.last, true)
          drag.current = null
        }}
        onDoubleClick={(e) => { e.stopPropagation(); onDecay?.(0.5, true) }}
        onWheel={(e) => { e.stopPropagation(); e.preventDefault(); onDecay?.(decay + Math.sign(e.deltaY) * 0.03, true) }}
      >
        <rect x={C - 68} y={197} width={150} height={23} fill="transparent" stroke="none" />
        {rungs}
        <text x={C + 52} y={212.5} fontSize="9" letterSpacing="0.5"
          fill={s} opacity={0.85}>{fmtDecay(variant, decay)}</text>
      </g>
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

/* ── gain: a tick ladder lit up to the fader's blue crossbar; the ø
      polarity marks are printed beside the rail, one per channel ──────── */
function GainArt ({ a, pol = 0, onFlip }: {
  a: number
  pol?: number
  onFlip?: (bit: number) => void
}) {
  const s = strokeFor(a), acc = accentFor(a)
  const top = C - R + 10, bot = C + R - 10
  const y = bot + (top - bot) * a
  const ticks = []
  for (let i = 0; i <= 24; i++) {
    const ty = top + (i / 24) * (bot - top)
    const below = ty >= y - 1
    const half = i % 4 === 0 ? 27 : 15
    ticks.push(
      <line key={i} x1={C - half} y1={ty} x2={C + half} y2={ty}
        stroke={s} strokeWidth={below ? 1.5 : 0.55} opacity={below ? 0.95 : 0.5} />,
    )
  }
  return (
    <g>
      <line x1={C} y1={top - 5} x2={C} y2={bot + 5} stroke={s} strokeWidth={1.1} />
      {ticks}
      <line x1={C - 45} y1={y} x2={C + 45} y2={y} stroke={acc} strokeWidth={3.2} />
      {[0, 1].map((bi) => {
        const x = bi === 0 ? C - 68 : C + 68
        const on = (pol & (1 << bi)) !== 0
        const ink = on ? acc : s
        return (
          <g key={bi} className="fx-hot" style={{ cursor: 'pointer' }}
            onPointerDown={(e) => { e.stopPropagation(); e.preventDefault() }}
            onClick={() => onFlip?.(1 << bi)}
          >
            <rect x={x - 15} y={C - 24} width={30} height={48} fill="transparent" stroke="none" />
            <circle cx={x} cy={C - 5} r={8} fill="none"
              stroke={ink} strokeWidth={on ? 1.9 : 1.1} opacity={on ? 1 : 0.5} />
            <line x1={x - 9.5} y1={C + 4.5} x2={x + 9.5} y2={C - 14.5}
              stroke={ink} strokeWidth={on ? 1.9 : 1.1} opacity={on ? 1 : 0.5} />
            <text x={x} y={C + 19} textAnchor="middle" fontSize="8" letterSpacing="1.5"
              fill={s} opacity={on ? 0.9 : 0.55}>{bi === 0 ? 'L' : 'R'}</text>
          </g>
        )
      })}
    </g>
  )
}

/* ── mod: stacked waves drifting out of phase into shimmer ───────────── */
function ModArt ({ a }: { a: number }) {
  const s = strokeFor(a), acc = accentFor(a)
  const rows = []
  for (let k = 0; k < 9; k++) {
    const y0 = C - 64 + k * 16
    const half = Math.sqrt(Math.max(0, R * R - (y0 - C) * (y0 - C))) - 5
    if (half < 14) continue
    const amp = 2 + a * 9
    const pts: string[] = []
    for (let i = 0; i <= 48; i++) {
      const x = C - half + (i / 48) * half * 2
      const ph = x / 17 + k * (0.7 + a * 1.6)
      pts.push(`${(x).toFixed(1)} ${(y0 + Math.sin(ph) * amp).toFixed(1)}`)
    }
    rows.push(
      <path key={k} d={`M ${pts.join(' L ')}`} fill="none"
        stroke={k === 4 ? acc : s} strokeWidth={k === 4 ? 1.7 : 1.1} />,
    )
  }
  return <g>{rows}</g>
}

const ARTS = [ToneArt, TapeArt, SpaceArt, StereoArt, GlueArt, GainArt, ModArt]

function fmtValue (mode: FxMode, a: number): string {
  if (mode === 0) {
    const db = (a - 0.5) * 12
    return `${db > 0 ? '+' : db < 0 ? '−' : ''}${Math.abs(db).toFixed(1)}`
  }
  if (mode === 5) {
    const db = a < 0.75 ? (a / 0.75 - 1) * 60 : (a - 0.75) * 48
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
  const [variants, setVariants] = useState<number[]>([...FX_DEFAULTS.variants])
  const [decays, setDecays] = useState<number[]>([...FX_DEFAULTS.decays])
  const [bridge] = useState(() => hasFxBridge())
  const [showValue, setShowValue] = useState(false)
  const [lit, setLit] = useState(false)          // false = still paper; true = the room is dark
  const [slide, setSlide] = useState<'l' | 'r' | null>(null)
  const [live, setLive] = useState(false)        // dragging → snappier wall
  const dragging = useRef(false)
  const dragStart = useRef({ y: 0, a: 0 })
  const lastSent = useRef(0)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const artRef = useRef<HTMLDivElement>(null)
  const haloRef = useRef<HTMLDivElement>(null)
  const glowEnv = useRef(0)
  const glowTint = useRef('255, 178, 44')
  const glowBoost = useRef(1)
  // glue's gain-reduction plumb line: target dB from the audio events,
  // displayed dB eased toward it every frame (fast down, slower up)
  const grLineRef = useRef<HTMLDivElement>(null)
  const grValRef = useRef<HTMLSpanElement>(null)
  const grTarget = useRef(0)
  const grDisp = useRef(0)
  const grStamp = useRef(0)

  useEffect(() => {
    if (!isOpen) { setLit(false); return }
    // Nothing in the room may hold keyboard focus — space and every other
    // key must fall through the responder chain to the DAW transport.
    (document.activeElement as HTMLElement | null)?.blur?.()
    void getFx().then((s) => { setMode(s.mode); setAmounts(s.amounts); setVariants(s.variants); setDecays(s.decays) })
    // let the paper render once, then dim the room slowly
    const t = setTimeout(() => setLit(true), 40)
    return () => clearTimeout(t)
  }, [isOpen])

  const a = amounts[mode] ?? 0
  const neutral = mode === 0 ? 0.5 : mode === 5 ? 0.75 : 0
  const Art = ARTS[mode]

  // The print glows with the programme — instant attack on every hit,
  // long lantern-like release, in the flavour's own light (bx_boom trick).
  useEffect(() => {
    if (!isOpen) return
    const onAudio = (e: Event) => {
      const d = (e as CustomEvent).detail as { samples?: string; gr?: number }
      const gr = Number(d?.gr)
      if (isFinite(gr)) { grTarget.current = gr; grStamp.current = performance.now() }
      if (!d?.samples) return
      try {
        const bin = atob(d.samples)
        const bytes = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
        const f = new Float32Array(bytes.buffer)
        let pk = 0
        for (let i = 0; i < f.length; i += 4) {
          const v = Math.abs(f[i])
          if (v > pk) pk = v
        }
        if (pk > glowEnv.current) glowEnv.current = Math.min(1.4, pk)
      } catch { /* skip bad chunk */ }
    }
    window.addEventListener('__juceDawAudio', onAudio)

    let raf = 0
    let lastT = performance.now()
    const tick = (t: number) => {
      const dt = Math.max(0, (t - lastT) / 1000)
      lastT = t
      glowEnv.current *= Math.exp(-dt / 0.5)
      const g = Math.min(1, Math.pow(Math.min(1, glowEnv.current), 1.2) * 1.35 * glowBoost.current)
      const el = haloRef.current
      if (el) {
        // tight and hot: one modest halo plus a doubled bright core.
        // Opacity rides the tail too, so the light dies to nothing
        // instead of snapping off at a threshold.
        const c = `rgba(${glowTint.current}, ${Math.min(1, g * 3).toFixed(3)})`
        const core = `drop-shadow(0 0 ${1 + g * 8}px ${c})`
        el.style.filter = g > 0.004
          ? `drop-shadow(0 0 ${2 + g * 22}px ${c}) ${core} ${core} ${core}`
          : 'none'
      }
      // the plumb line: falls fast with the clamp, climbs back slower
      if (t - grStamp.current > 300) grTarget.current = 0
      const gk = grTarget.current > grDisp.current ? Math.min(1, dt * 26) : Math.min(1, dt * 9)
      grDisp.current += (grTarget.current - grDisp.current) * gk
      const line = grLineRef.current
      const val = grValRef.current
      if (line && val) {
        const gr = grDisp.current
        const px = Math.min(270, gr * 15)
        const show = gr > 0.06
        line.style.height = `${px.toFixed(1)}px`
        line.style.opacity = show ? '1' : '0'
        val.textContent = `−${gr.toFixed(1)}`
        val.style.top = `${px.toFixed(1)}px`
        val.style.opacity = show ? '1' : '0'
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('__juceDawAudio', onAudio)
      cancelAnimationFrame(raf)
      glowEnv.current = 0
      if (haloRef.current) haloRef.current.style.filter = 'none'
    }
  }, [isOpen])

  // The whole screen is the room: paint the wall colour onto the plugin
  // root so the toolbar dims and lights with the panel.
  const variant = variants[mode] ?? 0
  glowTint.current = glowRgb(mode, variant)
  glowBoost.current = GLOW_BOOST[mode]
  useEffect(() => {
    const el = document.querySelector('.plugin') as HTMLElement | null
    if (!el) return
    if (isOpen && lit) el.style.setProperty('--fx-wall', wallColor(mode, variant, a))
    else el.style.removeProperty('--fx-wall')
  }, [isOpen, lit, mode, variant, a])
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

  const pickVariant = (v: number) => {
    setVariants((prev) => prev.map((x, i) => (i === mode ? v : x)))
    setFx({ mode, variant: v })
  }

  const lastDecaySent = useRef(0)
  const applyDecay = (next: number, force = false) => {
    const clamped = Math.min(1, Math.max(0, next))
    setDecays((prev) => prev.map((v, i) => (i === variant ? clamped : v)))
    const now = performance.now()
    if (force || now - lastDecaySent.current > 33) {
      lastDecaySent.current = now
      setFx({ decay: clamped })
    }
  }

  const step = (dir: 1 | -1) => {
    const next = MODES[(mode + dir + MODES.length) % MODES.length].id
    setMode(next)
    setShowValue(false)
    setSlide(dir === 1 ? 'r' : 'l')
    setFx({ mode: next })
    grTarget.current = 0
    grDisp.current = 0
  }

  const pluginEl = document.querySelector('.plugin')

  return (
    <div className={`s-body fx-body${live ? ' live' : ''}`}>
      <div className="fx-stage">
        <div
          ref={artRef}
          className="fx-art"
          role="slider"
          aria-label={`${MODES[mode].name} amount`}
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(a * 100)}
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
        >
          <div ref={haloRef} className="fx-art-halo" aria-hidden="true">
            <svg viewBox="0 0 220 220">
              {mode === 2
                ? <SpaceArt a={a} decay={decays[variant] ?? 0.5} variant={variant} onDecay={applyDecay} />
                : mode === 5
                  ? <GainArt a={a} pol={variant} onFlip={(bit) => pickVariant(variant ^ bit)} />
                  : <Art a={a} />}
            </svg>
          </div>
          <span className={`fx-art-value${showValue ? ' show' : ''}`} style={{ color: strokeFor(a) }}>{fmtValue(mode, a)}</span>
        </div>
      </div>

      <div className="fx-pager">
        <button className="fx-arrow" onMouseDown={(e) => e.preventDefault()} onClick={() => step(-1)} aria-label="Previous effect">‹</button>
        <div className="fx-chip">
          <span key={mode} className={`fx-chip-label${slide ? ` from-${slide}` : ''}`}>
            {MODES[mode].name}
          </span>
        </div>
        <button className="fx-arrow" onMouseDown={(e) => e.preventDefault()} onClick={() => step(1)} aria-label="Next effect">›</button>
      </div>
      <div className="fx-variants">
        {VARIANTS[mode].map((name, vi) => (
          <button
            key={name}
            className={`fx-variant${(variants[mode] ?? 0) === vi ? ' on' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pickVariant(vi)}
          >
            {name}
          </button>
        ))}
      </div>

      {!bridge && (
        <p className="fx-note">browser mode — the audio itself runs inside the daw.</p>
      )}

      {mode === 4 && pluginEl && createPortal(
        // A red plumb line dropped from the very top of the room — toolbar
        // included — reaching down exactly as far as the glue is clamping,
        // its reading riding the tip.
        <div className="fx-gr" aria-hidden="true">
          <div ref={grLineRef} className="fx-gr-line" />
          <span ref={grValRef} className="fx-gr-val" />
        </div>,
        pluginEl,
      )}
    </div>
  )
}
