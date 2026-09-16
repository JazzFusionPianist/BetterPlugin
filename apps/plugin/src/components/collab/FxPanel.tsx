import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { getFx, setFx, hasFxBridge, FX_DEFAULTS, type FxMode } from '../../lib/fxBridge'

/** The eleven one-knob effects. Each is drawn as a print on a darkened
 *  room wall — the print itself is the control, and the wall warms toward
 *  each effect's own colour as you turn it. Any subset can be IN THE
 *  CHAIN at once; display order here = the processor's chain order, so
 *  paging left-to-right reads like the signal path. */
const MODES: Array<{ id: FxMode; name: string }> = [
  { id: 7, name: 'cut' },
  { id: 8, name: 'amp' },
  { id: 0, name: 'tone' },
  { id: 1, name: 'tape' },
  { id: 6, name: 'mod' },
  { id: 9, name: 'doubler' },
  { id: 10, name: 'delay' },
  { id: 2, name: 'space' },
  { id: 3, name: 'stereo' },
  { id: 4, name: 'glue' },
  { id: 5, name: 'gain' },
  { id: 12, name: 'tremolo' },
  { id: 13, name: 'arp' },
  { id: 14, name: 'radio' },
  { id: 15, name: 'harmony' },
  { id: 16, name: 'pitch' },
  { id: 17, name: 'formant' },
  { id: 18, name: 'grain' },
  { id: 20, name: 'crush' },
  { id: 21, name: 'shimmer' },
  { id: 22, name: 'swell' },
  { id: 23, name: 'stutter' },
  { id: 24, name: 'air' },
  { id: 25, name: 'ring' },
  { id: 26, name: 'gate' },
  { id: 27, name: 'wow' },
]

/** Sub-flavours, shown under the mode slot (indexed by FxMode id). Gain's
 *  row is special-cased in the render: two polarity toggles, not a radio. */
const VARIANTS: string[][] = [
  [],                              // tone
  ['hard', 'clean'],               // tape
  ['hall', 'room', 'plate'],       // space
  [],                              // stereo
  [],                              // glue
  [],                              // gain
  ['chorus', 'flanger', 'phaser'], // mod
  ['low', 'high', 'band'],         // cut
  ['clean', 'crunch', 'lead', 'fuzz'], // amp
  ['tight', 'wide'],               // doubler
  ['clean', 'tape', 'pingpong'],   // delay
  [],                              // (mix slot)
  ['sine', 'triangle', 'square', 'pulse', 'saw'], // tremolo
  ['up', 'down', 'up-down', 'random'],            // arp
  ['am', 'phone'],                 // radio
  ['key', 'chromatic'],            // harmony
  ['raw', 'natural'],              // pitch
  [],                              // formant
  ['cloud', 'stutter', 'reverse'], // grain
  ['female', 'male', 'child', 'giant'], // voice
  ['both', 'bits', 'rate'],        // crush
  ['octave', 'fifth', 'down'],     // shimmer
  ['soft', 'hard'],                // swell
  ['beat', 'bar'],                 // stutter
  ['silk', 'bright'],              // air
  ['ring', 'am'],                  // ring
  ['tight', 'loose'],              // gate
  ['wow', 'flutter', 'both'],      // wow
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
  [140, 190, 255],  // cut/low — surgical ice
  [236, 62, 34],    // amp/crunch — ember
  [64, 220, 200],   // doubler — twin aqua
  [255, 204, 64],   // delay/clean — echo gold
  [22, 20, 16],     // (mix slot)
  [255, 96, 160],   // tremolo — pulse pink
  [90, 230, 170],   // arp — ladder mint
  [255, 190, 90],   // radio — dial tungsten
  [170, 130, 255],  // harmony — twin violet
  [120, 200, 255],  // pitch — glass blue
  [255, 150, 200],  // formant — vowel pink
  [200, 220, 120],  // grain — pollen
  [255, 120, 90],   // voice — throat coral
  [120, 255, 160],  // crush — phosphor green
  [190, 215, 255],  // shimmer — halo silver
  [255, 214, 140],  // swell — dawn
  [255, 72, 128],   // stutter — strobe magenta
  [225, 240, 255],  // air — white light
  [255, 170, 40],   // ring — brass
  [110, 130, 255],  // gate — club indigo
  [214, 150, 84],   // wow — tape brown
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
  7: [
    [140, 190, 255],  // low — surgical ice
    [255, 150, 110],  // high — warm dusk
    [186, 120, 255],  // band — radio violet
  ],
  8: [
    [255, 202, 120],  // clean — warm tungsten
    [236, 92, 40],    // crunch — ember
    [255, 48, 96],    // lead — stage red
    [186, 255, 60],   // fuzz — acid
  ],
  10: [
    [255, 204, 64],   // clean — echo gold
    [255, 140, 50],   // tape — worn amber
    [120, 214, 255],  // pingpong — table-tennis sky
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
const GLOW_BOOST = [1, 1, 1.9, 1.6, 1.35, 1.55, 1.15, 1.3, 1, 1.35, 1.5, 1, 1.3, 1.4, 1.2, 1.4, 1.3, 1.3, 1.4, 1.3, 1.3]

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
/* On the wall many prints share one room: the ink must follow how
   bright the WALL is, not each print's own hand — a low print on a
   bright wall would otherwise draw paper on paper. The wall provides
   its level here; the single room leaves it unset and each print
   reads its own hand as before. */
const StrokeLevel = createContext<number | null>(null)
function useInks (a: number): { s: string; acc: string } {
  const lvl = useContext(StrokeLevel)
  const x = lvl ?? a
  return { s: strokeFor(x), acc: accentFor(x) }
}

/* ── tone: a field of horizontal hairlines whose weight tilts ────────── */
function ToneArt ({ a }: { a: number }) {
  const { s, acc } = useInks(a)
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
  const { s, acc } = useInks(a)
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
  const { s, acc } = useInks(a)
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
  const { s, acc } = useInks(a)
  const r = 60
  const d = a * 30            // −100 (one circle, mono) … +100 (two, wide); the middle is untouched
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
  const { s, acc } = useInks(a)
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
  const { s, acc } = useInks(a)
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
  const { s, acc } = useInks(a)
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

/* ── cut: a forest of spectrum hairlines; the cut side erodes away and a
      blue boundary marks the knife ────────────────────────────────────── */
function CutArt ({ a, variant = 0 }: { a: number; variant?: number }) {
  const { s, acc } = useInks(a)
  const bars = []
  const N = 27
  let lo = 0, hi = 1
  if (variant === 0) lo = a * 0.78
  else if (variant === 1) hi = 1 - a * 0.78
  else { const w = 1 - a * 0.86; lo = 0.5 - w / 2; hi = 0.5 + w / 2 }
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1)
    const x = C - R + 8 + t * (2 * R - 16)
    const half = Math.sqrt(Math.max(0, R * R - (x - C) * (x - C))) * 0.82
    const kept = t >= lo && t <= hi
    bars.push(
      <line key={i} x1={x} y1={C - half} x2={x} y2={C + half}
        stroke={s} strokeWidth={kept ? 1.5 : 0.6} opacity={kept ? 0.95 : 0.16} />,
    )
  }
  const edges: ReactNode[] = []
  const edge = (t: number, k: string) => {
    const x = C - R + 8 + t * (2 * R - 16)
    const half = Math.sqrt(Math.max(0, R * R - (x - C) * (x - C))) * 0.92
    edges.push(<line key={k} x1={x} y1={C - half} x2={x} y2={C + half} stroke={acc} strokeWidth={1.8} />)
  }
  if (variant !== 1 && lo > 0.01) edge(lo, 'lo')
  if (variant !== 0 && hi < 0.99) edge(hi, 'hi')
  return <g>{bars}{edges}</g>
}

/* ── amp: rows of sine pressed into the ceiling — flat-tops grow with the
      drive until the wave is a wall ───────────────────────────────────── */
function AmpArt ({ a }: { a: number }) {
  const { s, acc } = useInks(a)
  const rows = []
  for (let k = 0; k < 7; k++) {
    const y0 = C - 57 + k * 19
    const half = Math.sqrt(Math.max(0, R * R - (y0 - C) * (y0 - C))) - 8
    if (half < 16) continue
    const pts: string[] = []
    for (let i = 0; i <= 60; i++) {
      const x = -half + (i / 60) * half * 2
      let v = Math.sin(x / 9 + k * 0.9) * (1 + a * 6)
      v = Math.max(-1, Math.min(1, v))
      pts.push(`${(C + x).toFixed(1)} ${(y0 - v * 7.4).toFixed(1)}`)
    }
    rows.push(
      <path key={k} d={`M ${pts.join(' L ')}`} fill="none"
        stroke={k === 3 ? acc : s} strokeWidth={k === 3 ? 1.7 : 1.1 + a * 0.7} />,
    )
  }
  return <g>{rows}</g>
}

/* ── doubler: the same print registered twice — the ghost pass drifts off
      the master as the second take gets louder ──────────────────────────── */
function DoublerArt ({ a }: { a: number }) {
  const { s, acc } = useInks(a)
  const dx = 3 + a * 22
  const dy = 2 + a * 7
  const ghost = []
  const master = []
  for (let y = -R + 16; y <= R - 16; y += 11) {
    const half = Math.sqrt(Math.max(0, R * R - y * y)) * 0.62
    ghost.push(
      <line key={'g' + y} x1={C - half + dx} y1={C + y + dy} x2={C + half + dx} y2={C + y + dy}
        stroke={acc} strokeWidth={2.1} opacity={0.25 + a * 0.5} />,
    )
    master.push(
      <line key={'m' + y} x1={C - half} y1={C + y} x2={C + half} y2={C + y}
        stroke={s} strokeWidth={2.1} />,
    )
  }
  return <g>{ghost}{master}</g>
}

/* ── delay: one strike and its echoes — spacing is the division, fade is
      the feedback. Both hands live in the print: the division reads at the
      top (drag east-west, snaps per step), the feedback ladder sits under
      the plate like space's decay ────────────────────────────────────────── */
const DIV_LABELS = ['1/16', '1/8t', '1/8', '1/8.', '1/4', '1/4.', '1/2']
const DIV_BEATS = [0.25, 1 / 3, 0.5, 0.75, 1, 1.5, 2]
function DelayArt ({ a, div = 2, fb = 0.35, onDiv, onFb }: {
  a: number
  div?: number
  fb?: number
  onDiv?: (next: number) => void
  onFb?: (next: number, force?: boolean) => void
}) {
  const { s, acc } = useInks(a)
  const dragDiv = useRef<{ x: number; d: number } | null>(null)
  const dragFb = useRef<{ x: number; f: number; last: number } | null>(null)
  const sp = 10 + DIV_BEATS[div] * 26
  const gain = 0.25 + fb * 0.72
  const marks = []
  let x = C - R + 18
  let op = 1
  let i = 0
  while (x <= C + R - 10 && op > 0.045) {
    const half = (i === 0 ? 46 : 40) * (0.55 + 0.45 * op)
    marks.push(
      <line key={i} x1={x} y1={C - half} x2={x} y2={C + half}
        stroke={i === 0 ? acc : s} strokeWidth={i === 0 ? 4 : 2.4} opacity={i === 0 ? 1 : op} />,
    )
    x += sp
    op *= gain
    i++
  }
  const fbRungs = []
  for (let k = 0; k < 13; k++) {
    fbRungs.push(
      <line key={k} x1={C - 60 + k * 8} y1={204} x2={C - 60 + k * 8} y2={214}
        stroke={k === 0 ? acc : s} strokeWidth={1.3}
        opacity={Math.max(0.04, Math.pow(0.3 + fb * 0.68, k))} />,
    )
  }
  return (
    <g>
      {marks}
      <g
        className="fx-hot"
        style={{ cursor: 'ew-resize' }}
        onPointerDown={(e) => {
          e.stopPropagation()
          dragDiv.current = { x: e.clientX, d: div }
          try { (e.currentTarget as Element).setPointerCapture(e.pointerId) } catch { /* fine */ }
        }}
        onPointerMove={(e) => {
          if (!dragDiv.current) return
          const steps = Math.round((e.clientX - dragDiv.current.x) / 34)
          onDiv?.(Math.min(6, Math.max(0, dragDiv.current.d + steps)))
        }}
        onPointerUp={() => { dragDiv.current = null }}
        onDoubleClick={(e) => { e.stopPropagation(); onDiv?.(2) }}
        onWheel={(e) => { e.stopPropagation(); e.preventDefault(); onDiv?.(Math.min(6, Math.max(0, div + Math.sign(e.deltaY)))) }}
      >
        <rect x={C - 44} y={4} width={88} height={28} fill="transparent" stroke="none" />
        <text x={C} y={23} textAnchor="middle" fontSize="13" letterSpacing="1"
          fill={acc} fontStyle="italic">{DIV_LABELS[div]}</text>
      </g>
      <g
        className="fx-hot"
        style={{ cursor: 'ew-resize' }}
        onPointerDown={(e) => {
          e.stopPropagation()
          dragFb.current = { x: e.clientX, f: fb, last: fb }
          try { (e.currentTarget as Element).setPointerCapture(e.pointerId) } catch { /* fine */ }
        }}
        onPointerMove={(e) => {
          if (!dragFb.current) return
          const next = dragFb.current.f + (e.clientX - dragFb.current.x) / 150
          dragFb.current.last = Math.min(1, Math.max(0, next))
          onFb?.(next)
        }}
        onPointerUp={() => {
          if (dragFb.current) onFb?.(dragFb.current.last, true)
          dragFb.current = null
        }}
        onDoubleClick={(e) => { e.stopPropagation(); onFb?.(0.35, true) }}
        onWheel={(e) => { e.stopPropagation(); e.preventDefault(); onFb?.(fb + Math.sign(e.deltaY) * 0.03, true) }}
      >
        <rect x={C - 68} y={197} width={150} height={23} fill="transparent" stroke="none" />
        {fbRungs}
        <text x={C + 52} y={212.5} fontSize="9" letterSpacing="0.5"
          fill={s} opacity={0.85}>{Math.round(fb * 100)}</text>
      </g>
    </g>
  )
}


/* ── tremolo: the cycle itself, drawn across the plate ─────────────── */
export const CURVE_LEN = 32
function baseShape (variant: number, ph: number): number {
  switch (variant) {
    case 1: return 1 - 2 * Math.abs(ph - 0.5)
    case 2: return ph < 0.5 ? 0 : 1        // square: the dip comes first
    case 3: return ph < 0.25 ? 0 : 1       // pulse: a short dip
    case 4: return ph                      // saw: rises, drops
    default: return 0.5 + 0.5 * Math.cos(2 * Math.PI * ph)
  }
}
/** Shape presets (after Tremolator's rhythm library): each is one cycle
 *  as 32 points, 1 = loud. A preset writes the node's curve. */
export const TREM_PRESETS: Array<{ name: string; curve: () => number[] }> = (() => {
  const pts = (f: (ph: number) => number) => Array.from({ length: CURVE_LEN }, (_, i) => Math.min(1, Math.max(0, f(i / CURVE_LEN))))
  const steps = (pattern: number[]) => pts(ph => pattern[Math.floor(ph * pattern.length)] ?? 0)
  const gate = (pattern: number[], width = 0.6) => pts(ph => { const k = ph * pattern.length; const i = Math.floor(k); return pattern[i] && (k - i) < width ? 1 : 0 })
  return [
    { name: 'sine', curve: () => pts(ph => baseShape(0, ph)) },
    { name: 'triangle', curve: () => pts(ph => baseShape(1, ph)) },
    { name: 'square', curve: () => pts(ph => baseShape(2, ph)) },
    { name: 'pulse', curve: () => pts(ph => baseShape(3, ph)) },
    { name: 'saw', curve: () => pts(ph => baseShape(4, ph)) },
    { name: 'eighths', curve: () => gate([1, 1, 1, 1, 1, 1, 1, 1], 0.55) },
    { name: 'sixteenths', curve: () => gate(new Array(16).fill(1), 0.5) },
    { name: '3-3-2', curve: () => gate([1, 0, 0, 1, 0, 0, 1, 0], 0.9) },
    { name: 'gallop', curve: () => gate([1, 0, 1, 1, 1, 0, 1, 1], 0.7) },
    { name: 'swing', curve: () => pts(ph => { const k = ph * 4; const i = Math.floor(k); const f = k - i; return f < (i % 2 ? 0.45 : 0.65) ? 1 : 0.15 }) },
    { name: 'offbeat', curve: () => gate([0, 1, 0, 1, 0, 1, 0, 1], 0.6) },
    { name: 'breath', curve: () => pts(ph => Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * ph), 2.2)) },
    { name: 'stairs', curve: () => steps([1, 0.75, 0.5, 0.25, 1, 0.75, 0.5, 0.25]) },
    { name: 'random', curve: () => { let s = 7; return steps(Array.from({ length: 8 }, () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return 0.2 + (s % 1000) / 1250 })) } },
  ]
})()
function TremoloArt ({ a, variant = 0, curve }: { a: number; variant?: number; curve?: number[] }) {
  const s = strokeFor(a), acc = accentFor(a)
  const X0 = C - 72, W = 144, Y0 = C - 52, H = 104
  const pts: string[] = []
  for (let i = 0; i <= 96; i++) {
    const ph = i / 96
    let v: number
    if (curve && curve.length === CURVE_LEN) {
      const x = ph * CURVE_LEN, i0 = Math.floor(x) % CURVE_LEN, i1 = (i0 + 1) % CURVE_LEN, fr = x - Math.floor(x)
      v = curve[i0] * (1 - fr) + curve[i1] * fr
    } else v = baseShape(variant, ph)
    pts.push(`${(X0 + ph * W).toFixed(1)},${(Y0 + H - v * H).toFixed(1)}`)
  }
  const floorY = Y0 + H - (1 - a) * H
  return (
    <g>
      <line x1={X0} y1={floorY} x2={X0 + W} y2={floorY} stroke={s} strokeWidth={0.8} opacity={0.35} strokeDasharray="2 3" />
      <line x1={X0} y1={Y0 + H} x2={X0 + W} y2={Y0 + H} stroke={s} strokeWidth={0.8} opacity={0.25} />
      <polyline points={pts.join(' ')} fill="none" stroke={curve ? acc : s} strokeWidth={1.6} strokeLinejoin="round" />
    </g>
  )
}

/* ── arp: the ladder the pitch climbs, one rung per step ────────────── */
function ArpArt ({ a, variant = 0, interval = 12 }: { a: number; variant?: number; interval?: number }) {
  const { s, acc } = useInks(a)
  const range = a * 24
  const count = Math.max(1, Math.floor(range / Math.max(1, interval) + 1e-4) + 1)
  const order: number[] = []
  const per = Math.max(1, 2 * count - 2)
  for (let i = 0; i < 8; i++) {
    if (variant === 1) order.push((count - 1) - (i % count))
    else if (variant === 2) { const m = i % per; order.push(m < count ? m : per - m) }
    else if (variant === 3) { let h = (i + 1) * 2654435761 >>> 0; h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0; h ^= h >>> 15; order.push(h % count) }
    else order.push(i % count)
  }
  const rungs = order.map((k, i) => {
    const x = C - 70 + i * 20
    const semis = k * interval
    const y = C + 60 - (semis / 24) * 120
    return <line key={i} x1={x} y1={y} x2={x + 14} y2={y} stroke={i === 0 ? acc : s} strokeWidth={i === 0 ? 2.2 : 1.4} opacity={0.9} />
  })
  return (
    <g>
      <line x1={C - 72} y1={C + 60} x2={C + 72} y2={C + 60} stroke={s} strokeWidth={0.8} opacity={0.3} />
      {rungs}
    </g>
  )
}

/* ── radio: a dial; the needle swings up the band as the knob goes ─── */
function RadioArt ({ a }: { a: number }) {
  const { s, acc } = useInks(a)
  const ticks = []
  for (let i = 0; i <= 24; i++) {
    const ang = Math.PI + (i / 24) * Math.PI
    const r1 = 78, r2 = i % 6 === 0 ? 66 : 72
    ticks.push(<line key={i} x1={C + r1 * Math.cos(ang)} y1={C + 20 + r1 * Math.sin(ang)} x2={C + r2 * Math.cos(ang)} y2={C + 20 + r2 * Math.sin(ang)} stroke={s} strokeWidth={0.9} opacity={0.8} />)
  }
  const na = Math.PI + a * Math.PI
  // the static: a field of dots thickening with the knob
  const dots = []
  let seed = 7
  const count = Math.round(a * 90)
  for (let i = 0; i < count; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    const rx = (seed % 1000) / 1000; seed = (seed * 1103515245 + 12345) & 0x7fffffff
    const ry = (seed % 1000) / 1000
    dots.push(<circle key={i} cx={C - 60 + rx * 120} cy={C + 34 + ry * 40} r={0.9} fill={s} opacity={0.5} />)
  }
  return (
    <g>
      {ticks}
      <line x1={C} y1={C + 20} x2={C + 60 * Math.cos(na)} y2={C + 20 + 60 * Math.sin(na)} stroke={acc} strokeWidth={1.8} strokeLinecap="round" />
      <circle cx={C} cy={C + 20} r={3} fill={acc} />
      {dots}
    </g>
  )
}

/* ── harmony: the voice and its shadow a few steps away ────────────── */
export const KEY_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
function HarmonyArt ({ a, degrees = 2, keyRoot = 0, scale = 0, chromatic = false }: {
  a: number; degrees?: number; keyRoot?: number; scale?: number; chromatic?: boolean
}) {
  const { s, acc } = useInks(a)
  const line = (dy: number) => {
    const pts: string[] = []
    for (let i = 0; i <= 40; i++) {
      const x = C - 72 + i * 3.6
      const y = C + 8 + Math.sin(i * 0.55) * 14 + Math.sin(i * 0.21) * 9 - dy
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
    }
    return pts.join(' ')
  }
  const off = Math.max(-60, Math.min(60, degrees * (chromatic ? 3.5 : 7)))
  return (
    <g>
      <polyline points={line(0)} fill="none" stroke={s} strokeWidth={1.3} />
      <polyline points={line(off)} fill="none" stroke={acc} strokeWidth={1.3} opacity={0.25 + a * 0.75} />
      <text x={C} y={C + 74} fontSize="10" textAnchor="middle" letterSpacing="0.5" fill={s} opacity={0.85}>
        {chromatic ? `${degrees > 0 ? '+' : ''}${degrees} st` : `${KEY_NAMES[((keyRoot % 12) + 12) % 12]} ${scale === 1 ? 'minor' : 'major'}`}
      </text>
    </g>
  )
}

/* ── pitch: a fret of semitones, the blue rung is where the note lands ─ */
function PitchArt ({ a }: { a: number }) {
  const s = strokeFor(a), acc = accentFor(a)
  const semis = Math.round((a - 0.5) * 24)
  const rungs = []
  for (let k = -12; k <= 12; k++) {
    const y = C - k * 6.2
    const w = k % 12 === 0 ? 96 : k % 7 === 0 || k % 5 === 0 ? 70 : 52
    rungs.push(<line key={k} x1={C - w / 2} y1={y} x2={C + w / 2} y2={y} stroke={k === semis ? acc : s} strokeWidth={k === semis ? 2.4 : k === 0 ? 1.3 : 0.9} opacity={k === semis ? 1 : k === 0 ? 0.9 : 0.55} />)
  }
  return <g>{rungs}</g>
}

/* ── formant: two vowel peaks that slide along the spectrum ────────── */
function FormantArt ({ a }: { a: number }) {
  const s = strokeFor(a), acc = accentFor(a)
  const shift = (a - 0.5) * 60
  const bump = (cx: number, w: number, h: number, stroke: string, sw: number) => {
    const pts: string[] = []
    for (let i = 0; i <= 40; i++) {
      const x = C - 80 + i * 4
      const y = C + 40 - h * Math.exp(-Math.pow((x - cx) / w, 2))
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
    }
    return <polyline points={pts.join(' ')} fill="none" stroke={stroke} strokeWidth={sw} />
  }
  return (
    <g>
      <line x1={C - 80} y1={C + 40} x2={C + 80} y2={C + 40} stroke={s} strokeWidth={0.8} opacity={0.3} />
      {bump(C - 30, 14, 60, s, 1)}
      {bump(C + 30, 18, 42, s, 1)}
      {bump(C - 30 + shift, 14, 60, acc, 1.5)}
      {bump(C + 30 + shift, 18, 42, acc, 1.5)}
    </g>
  )
}

/* ── grain: a cloud of short dashes, denser as the knob rises ──────── */
function GrainArt ({ a, variant = 0 }: { a: number; variant?: number }) {
  const s = strokeFor(a), acc = accentFor(a)
  const dashes = []
  let seed = 11
  const count = 12 + Math.round(a * 70)
  for (let i = 0; i < count; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff; const rx = (seed % 1000) / 1000
    seed = (seed * 1103515245 + 12345) & 0x7fffffff; const ry = (seed % 1000) / 1000
    seed = (seed * 1103515245 + 12345) & 0x7fffffff; const rl = 4 + (seed % 1000) / 1000 * 18
    const ang = Math.PI * 2 * rx
    const r = 20 + ry * 64
    const x = C + r * Math.cos(ang), y = C + r * Math.sin(ang)
    const dx = variant === 2 ? -rl : rl
    dashes.push(<line key={i} x1={x} y1={y} x2={x + dx} y2={y} stroke={i % 9 === 0 ? acc : s} strokeWidth={1.1} opacity={0.4 + 0.6 * (1 - ry)} />)
  }
  return <g>{dashes}</g>
}

/* ── voice: a throat's profile that the knob re-proportions ────────── */
function VoiceArt ({ a, variant = 0 }: { a: number; variant?: number }) {
  const s = strokeFor(a), acc = accentFor(a)
  const dir = variant === 1 || variant === 3 ? -1 : 1
  const k = a * dir
  const wave = (scale: number, stroke: string, sw: number) => {
    const pts: string[] = []
    for (let i = 0; i <= 60; i++) {
      const x = C - 78 + i * 2.6
      const t = i / 60
      const y = C + Math.sin(t * Math.PI * 2 * 3 * scale) * 22 * (0.6 + 0.4 * Math.sin(t * Math.PI)) + Math.sin(t * Math.PI * 2 * 11 * scale) * 6
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
    }
    return <polyline points={pts.join(' ')} fill="none" stroke={stroke} strokeWidth={sw} />
  }
  return (
    <g>
      {wave(1, s, 1)}
      {wave(1 + k * 0.6, acc, 1.3)}
    </g>
  )
}

/* ── crush: a wave drawn in ever coarser steps ─────────────────────── */
function CrushArt ({ a }: { a: number }) {
  const s = strokeFor(a), acc = accentFor(a)
  const stepsX = Math.max(4, Math.round(64 - a * 56))
  const levels = Math.max(2, Math.round(24 - a * 21))
  const pts: string[] = []
  for (let i = 0; i <= stepsX; i++) {
    const t0 = i / stepsX
    const y0 = Math.sin(t0 * Math.PI * 2 * 1.5) * 0.9
    const q = Math.round(y0 * levels / 2) / (levels / 2)
    const x = C - 72 + t0 * 144
    const y = C - q * 48
    if (i > 0) { const prev = pts[pts.length - 1].split(',')[1]; pts.push(`${x.toFixed(1)},${prev}`) }
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return (
    <g>
      <line x1={C - 72} y1={C} x2={C + 72} y2={C} stroke={s} strokeWidth={0.8} opacity={0.3} />
      <polyline points={pts.join(' ')} fill="none" stroke={a > 0.5 ? acc : s} strokeWidth={1.4} strokeLinejoin="miter" />
    </g>
  )
}

const STUTTER_LABELS = ['1/4', '1/8', '1/16', '1/32', '1/64']
function fmtSwell (a: number): string { const T = 0.02 * Math.pow(75, a); return T < 1 ? `${Math.round(T * 1000)}ms` : `${T.toFixed(2)}s` }
function fmtGate (a: number): string { const t = Math.round(-60 + a * 60); return t === 0 ? '0 dB' : `−${-t} dB` }
function fmtRing (a: number): string { const hz = 20 * Math.pow(2, a * 8); return hz >= 1000 ? `${(hz / 1000).toFixed(2)}k` : `${Math.round(hz)}` }

/* ── shimmer: echoes that climb — each ring a little higher, a little smaller ── */
function ShimmerArt ({ a, variant = 0 }: { a: number; variant?: number }) {
  const { s, acc } = useInks(a)
  const count = 3 + Math.round(a * 5)
  const dir = variant === 2 ? 1 : -1
  const rings = []
  for (let i = 0; i < count; i++) {
    const t = i / Math.max(1, count - 1)
    const r = 58 - t * 44
    const cy = C + 14 + dir * t * (34 + a * 26)
    rings.push(<circle key={i} cx={C} cy={cy} r={r} fill="none" stroke={i === 0 ? s : acc} strokeWidth={i === 0 ? 1.6 : 1.1} opacity={i === 0 ? 1 : 0.85 - t * 0.45} />)
  }
  return <g>{rings}</g>
}

/* ── swell: the envelope a plucked note learns from a bow ─────────────── */
function SwellArt ({ a, variant = 0, depth = 1 }: { a: number; variant?: number; depth?: number }) {
  const { s, acc } = useInks(a)
  const X0 = C - 72, W = 144, Y0 = C - 50, H = 100
  const attack = 0.06 + a * 0.8
  const floor = 1 - depth * (variant === 1 ? 1 : 0.75)
  const pts: string[] = []
  for (let i = 0; i <= 96; i++) {
    const t = i / 96
    const v = t < attack ? floor + (1 - floor) * Math.pow(t / attack, 1.8) : 1 - (t - attack) / (1 - attack) * 0.35
    pts.push(`${(X0 + t * W).toFixed(1)},${(Y0 + H - v * H).toFixed(1)}`)
  }
  return (
    <g>
      <line x1={X0} y1={Y0 + H} x2={X0 + W} y2={Y0 + H} stroke={s} strokeWidth={0.8} opacity={0.25} />
      <line x1={X0 + attack * W} y1={Y0 + 6} x2={X0 + attack * W} y2={Y0 + H} stroke={acc} strokeWidth={0.8} opacity={0.5} strokeDasharray="2 3" />
      <polyline points={pts.join(' ')} fill="none" stroke={s} strokeWidth={1.6} strokeLinejoin="round" />
    </g>
  )
}

/* ── stutter: one slice of wave, cut and laid down again and again ───── */
function StutterArt ({ a }: { a: number }) {
  const { s, acc } = useInks(a)
  const zone = Math.min(4, Math.floor(a * 5))
  const reps = [1, 2, 4, 8, 16][zone]
  const X0 = C - 72, W = 144
  const slice = W / reps
  const gap = reps > 1 ? Math.min(4, slice * 0.12) : 0
  const cells = []
  for (let k = 0; k < reps; k++) {
    const x0 = X0 + k * slice
    const pts: string[] = []
    const n = Math.max(6, Math.round(48 / reps))
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const y = Math.sin(t * Math.PI * 2 * 1.5) * 0.7 + Math.sin(t * Math.PI * 2 * 4.2) * 0.25
      pts.push(`${(x0 + gap / 2 + t * (slice - gap)).toFixed(1)},${(C - y * 40).toFixed(1)}`)
    }
    cells.push(<polyline key={k} points={pts.join(' ')} fill="none" stroke={k === 0 ? acc : s} strokeWidth={k === 0 ? 1.8 : 1.2} opacity={k === 0 ? 1 : 0.8} />)
    if (k > 0) cells.push(<line key={`c${k}`} x1={x0} y1={C - 52} x2={x0} y2={C + 52} stroke={s} strokeWidth={0.6} opacity={0.35} />)
  }
  return <g>{cells}</g>
}

/* ── air: sparks above the horizon, more and higher with the knob ────── */
function AirArt ({ a, variant = 0 }: { a: number; variant?: number }) {
  const { s, acc } = useInks(a)
  const sparks = []
  let seed = variant === 1 ? 23 : 5
  const count = 6 + Math.round(a * 40)
  for (let i = 0; i < count; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff; const rx = (seed % 1000) / 1000
    seed = (seed * 1103515245 + 12345) & 0x7fffffff; const ry = (seed % 1000) / 1000
    seed = (seed * 1103515245 + 12345) & 0x7fffffff; const rl = (seed % 1000) / 1000
    const x = C - 70 + rx * 140
    const y = C + 30 - ry * (40 + a * 60)
    const len = 2 + rl * (variant === 1 ? 7 : 4)
    sparks.push(variant === 1
      ? <line key={i} x1={x - len / 2} y1={y} x2={x + len / 2} y2={y} stroke={i % 3 === 0 ? acc : s} strokeWidth={1} opacity={0.5 + ry * 0.5} />
      : <circle key={i} cx={x} cy={y} r={0.6 + rl * 1.2} fill={i % 3 === 0 ? acc : s} opacity={0.4 + ry * 0.6} />)
  }
  return (
    <g>
      <line x1={C - 72} y1={C + 34} x2={C + 72} y2={C + 34} stroke={s} strokeWidth={1.2} />
      {sparks}
    </g>
  )
}

/* ── ring: a slow wave multiplied by a fast one ───────────────────────── */
function RingArt ({ a, variant = 0 }: { a: number; variant?: number }) {
  const { s, acc } = useInks(a)
  const X0 = C - 72, W = 144
  const f = 2 + a * 22
  const pts: string[] = []
  const env: string[] = []
  for (let i = 0; i <= 160; i++) {
    const t = i / 160
    const slow = Math.sin(t * Math.PI * 2 * 1.5)
    const carrier = Math.sin(t * Math.PI * 2 * f)
    const k = variant === 1 ? 0.5 + 0.5 * carrier : carrier
    pts.push(`${(X0 + t * W).toFixed(1)},${(C - slow * k * 46).toFixed(1)}`)
    env.push(`${(X0 + t * W).toFixed(1)},${(C - slow * 46).toFixed(1)}`)
  }
  return (
    <g>
      <polyline points={env.join(' ')} fill="none" stroke={s} strokeWidth={0.8} opacity={0.3} strokeDasharray="2 3" />
      <polyline points={pts.join(' ')} fill="none" stroke={a > 0.02 ? acc : s} strokeWidth={1.3} strokeLinejoin="round" />
    </g>
  )
}

/* ── gate: bursts of sound; those under the threshold line are cut ────── */
function GateArt ({ a }: { a: number }) {
  const { s, acc } = useInks(a)
  const X0 = C - 74, W = 148
  const amps = [0.9, 0.3, 0.62, 0.18, 0.78, 0.42]
  const thr = a * 0.98
  const thrY = C - thr * 46
  const bursts = amps.map((amp, k) => {
    const x0 = X0 + (k / amps.length) * W, bw = W / amps.length
    const pts: string[] = []
    const n = 22
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const env = Math.sin(t * Math.PI)
      const y = Math.sin(t * Math.PI * 2 * 3.5) * env * amp
      pts.push(`${(x0 + 2 + t * (bw - 4)).toFixed(1)},${(C - y * 46).toFixed(1)}`)
    }
    const passes = amp >= thr
    return <polyline key={k} points={pts.join(' ')} fill="none" stroke={passes ? s : acc} strokeWidth={passes ? 1.4 : 0.9} opacity={passes ? 1 : 0.28} strokeLinejoin="round" />
  })
  return (
    <g>
      {bursts}
      <line x1={X0 - 4} y1={thrY} x2={X0 + W + 4} y2={thrY} stroke={acc} strokeWidth={1} strokeDasharray="3 3" opacity={0.9} />
      <line x1={X0 - 4} y1={C + thr * 46} x2={X0 + W + 4} y2={C + thr * 46} stroke={acc} strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
    </g>
  )
}

/* ── wow: a tape path that will not run straight ──────────────────────── */
function WowArt ({ a, variant = 0 }: { a: number; variant?: number }) {
  const { s, acc } = useInks(a)
  const X0 = C - 72, W = 144
  const lines = []
  for (let row = -1; row <= 1; row++) {
    const pts: string[] = []
    for (let i = 0; i <= 160; i++) {
      const t = i / 160
      const slow = variant !== 1 ? Math.sin(t * Math.PI * 2 * 1.2 + row) * 14 * a : 0
      const fast = variant !== 0 ? Math.sin(t * Math.PI * 2 * 14 + row * 2) * 3.5 * a : 0
      pts.push(`${(X0 + t * W).toFixed(1)},${(C + row * 26 + slow + fast).toFixed(1)}`)
    }
    lines.push(<polyline key={row} points={pts.join(' ')} fill="none" stroke={row === 0 ? acc : s} strokeWidth={row === 0 ? 1.6 : 1.1} opacity={row === 0 ? 1 : 0.7} />)
  }
  return (
    <g>
      {lines}
      <circle cx={C - 78} cy={C} r={5} fill="none" stroke={s} strokeWidth={1.2} />
      <circle cx={C + 78} cy={C} r={5} fill="none" stroke={s} strokeWidth={1.2} />
    </g>
  )
}

function EmptyArt ({ a }: { a: number }) { void a; return <g /> }

const ARTS = [ToneArt, TapeArt, SpaceArt, StereoArt, GlueArt, GainArt, ModArt, CutArt, AmpArt, DoublerArt, DelayArt, EmptyArt, TremoloArt, ArpArt, RadioArt, HarmonyArt, PitchArt, FormantArt, GrainArt, VoiceArt, CrushArt, ShimmerArt, SwellArt, StutterArt, AirArt, RingArt, GateArt, WowArt]

function fmtValue (mode: FxMode, a: number, variant = 0): string {
  if (mode === 3) { const t = Math.round((a - 0.5) * 200); return t === 0 ? '0' : t > 0 ? `+${t}` : `${t}` }
  if (mode === 22) return fmtSwell(a)
  if (mode === 23) return STUTTER_LABELS[Math.min(4, Math.floor(a * 5))]
  if (mode === 25) return fmtRing(a)
  if (mode === 26) return fmtGate(a)
  if (mode === 0) {
    const db = (a - 0.5) * 12
    return `${db > 0 ? '+' : db < 0 ? '−' : ''}${Math.abs(db).toFixed(1)}`
  }
  if (mode === 5) {
    const db = a < 0.75 ? (a / 0.75 - 1) * 60 : (a - 0.75) * 48
    return `${db > 0 ? '+' : db < 0 ? '−' : ''}${Math.abs(db).toFixed(1)}`
  }
  if (mode === 13) return `${Math.round(a * 24)}st`
  if (mode === 16 || mode === 17) { const st = Math.round((a - 0.5) * 24); return `${st > 0 ? '+' : ''}${st} st` }
  if (mode === 7) {
    if (variant === 2) return `${(0.3 + (1 - a) * 9).toFixed(1)}oct`
    const hz = variant === 0 ? 20 * Math.pow(2, a * 8) : 20000 * Math.pow(2, -a * 8.3)
    return hz >= 1000 ? `${(hz / 1000).toFixed(1)}k` : `${Math.round(hz)}`
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
  const [delayDiv, setDelayDiv] = useState<number>(FX_DEFAULTS.delayDiv)
  const [delayFb, setDelayFb] = useState<number>(FX_DEFAULTS.delayFb)
  const [stale, setStale] = useState(false)
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
    void getFx().then((s) => {
      setMode(s.mode); setAmounts(s.amounts); setVariants(s.variants); setDecays(s.decays)
      setDelayDiv(s.delayDiv); setDelayFb(s.delayFb); setStale(s.stale)
    })
    // let the paper render once, then dim the room slowly
    const t = setTimeout(() => setLit(true), 40)
    return () => clearTimeout(t)
  }, [isOpen])

  const a = amounts[mode] ?? 0
  const neutral = mode === 0 || mode === 3 ? 0.5 : mode === 5 ? 0.75 : 0
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

  const applyDiv = (d: number) => {
    const c = Math.min(6, Math.max(0, Math.round(d)))
    if (c === delayDiv) return
    setDelayDiv(c)
    setFx({ delayDiv: c })
  }

  const lastFbSent = useRef(0)
  const applyFb = (next: number, force = false) => {
    const clamped = Math.min(1, Math.max(0, next))
    setDelayFb(clamped)
    const now = performance.now()
    if (force || now - lastFbSent.current > 33) {
      lastFbSent.current = now
      setFx({ delayFb: clamped })
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
    const di = MODES.findIndex((mm) => mm.id === mode)
    const next = MODES[(di + dir + MODES.length) % MODES.length].id
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
          aria-label={`${MODES.find((mm) => mm.id === mode)?.name ?? ''} amount`}
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
                  : mode === 7
                    ? <CutArt a={a} variant={variant} />
                    : mode === 10
                      ? <DelayArt a={a} div={delayDiv} fb={delayFb} onDiv={applyDiv} onFb={applyFb} />
                      : <Art a={a} />}
            </svg>
          </div>
          <span className={`fx-art-value${showValue ? ' show' : ''}`} style={{ color: strokeFor(a) }}>{fmtValue(mode, a, variant)}</span>
        </div>
      </div>

      <div className="fx-pager">
        <button className="fx-arrow" onMouseDown={(e) => e.preventDefault()} onClick={() => step(-1)} aria-label="Previous effect">‹</button>
        <div className="fx-chip">
          <span key={mode} className={`fx-chip-label${slide ? ` from-${slide}` : ''}`}>
            {MODES.find((mm) => mm.id === mode)?.name}
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
      {bridge && stale && (
        <p className="fx-note">this room grew new prints — rebuild the plugin to hear them.</p>
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

/* The prints and their inks, for the graph mockup (SoundsGraphDemo). */
export { ARTS, MODES, VARIANTS, WALL_TINTS, VARIANT_TINTS, wallColor, strokeFor, PAPER, BLUE, fmtDecay, DIV_LABELS, fmtValue, baseShape, StrokeLevel, STUTTER_LABELS, fmtSwell, fmtRing, fmtGate }
