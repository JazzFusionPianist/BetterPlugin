import React, { Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { ARTS, MODES, VARIANTS, WALL_TINTS, VARIANT_TINTS, wallColor, BLUE as BLUE_INK, strokeFor, fmtDecay, DIV_LABELS, KEY_NAMES, StrokeLevel, TREM_PRESETS, STUTTER_LABELS, fmtSwell, fmtRing, fmtGate } from './FxPanel'
import { hasJuceBridge, hasJuceNativeFunction } from '../../lib/juceBridge'
import FxScope from './FxScope'
import { GaugeRow, ChoiceRow, SwitchRow, useTypeIn, parseLead, clamp } from './StudyControls'
import { Cells } from '../../assets/parts/parts'
import {
  getGraph, setGraph, hasGraphBridge, hasFxBridge, setScopeInput,
  listPresets, savePreset, loadPreset, deletePreset, hasPresetDialogs, savePresetDialog, openPresetDialog,
  FX_MIX_TYPE, FX_SPLIT_LR, FX_SPLIT_MS, FX_PORT_IN, FX_PORT_OUT, FX_MAX_NODES, isUtilityType, isSplitterType,
  type FxGraph, type FxGraphNode, type FxGraphEdge, type FxMode,
} from '../../lib/fxBridge'

/*  The patchable wall — Orb Sounds' room.

    The prints ARE the nodes: drag one off the shelf onto the wall, wire
    it from the previous print's right port to its left port, drag on
    the print for the amount (the caption under it is the handle that
    moves it). `in` and `out` live on the wall's edges. A `mix` print
    takes any number of wires; the number riding each wire is its send
    level, and the mix decides whether the numbers blend (sum to 100) or
    simply add (a bus). Feedback is refused by the engine.               */

const NODE = 132
const STUDY_W = 380          // the study: a column on the right where the chosen print is drawn big
const STUDY_PRINT = 240
const R = NODE / 2
const SHELF_PRINT = 48
const SHELF_H = 112
/** One row of prints that scrolls sideways (the wheel's up and down
 *  walks it); the page needs its height to size the wall. */
/** The shelf's families: one row of prints at a time. */
const FAMILIES: Array<[string, string[]]> = [
  ['tone', ['cut', 'amp', 'tone', 'tape', 'glue', 'air']],
  ['grit', ['crush', 'radio', 'ring']],
  ['space', ['delay', 'space', 'shimmer', 'doubler', 'stereo']],
  ['motion', ['mod', 'tremolo', 'swell', 'stutter', 'gate', 'wow']],
  ['pitch', ['pitch', 'formant', 'harmony', 'arp', 'grain']],
  ['utility', ['gain', 'mix', 'L/R', 'M/S']],
]
const FAM_W = 46 * FAMILIES.length   // six tabs; the longest family (six prints) fits the 760px window
export function shelfLayout (): { print: number; gap: number; height: number } {
  return { print: SHELF_PRINT, gap: 14, height: SHELF_H }
}
const PORT_INSET = 64          // in/out ports sit this far from the wall's edges
const SNAP_WIRE = 26           // drop a print this close to a wire to splice it in
const WET_TYPES = new Set<number>([2, 10, 9, 6, 15, 18, 21])   // space, delay, doubler, mod, harmony, grain, shimmer

type Pt = { x: number; y: number }
type Drag =
  | { kind: 'amount'; id: number; y0: number; a0: number }
  | { kind: 'move'; id: number; dx: number; dy: number }
  | { kind: 'wire'; from: number; port: number; at: Pt }
  | { kind: 'share'; edge: number; y0: number; g0: number }
  | { kind: 'hand'; id: number; hand: 'decay' | 'div' | 'fb' | 'aux0' | 'aux1' | 'aux2' | 'aux3' | 'aux5'; y0: number; v0: number }
  | { kind: 'shelf'; type: number; at: Pt }
  | { kind: 'pan'; x0: number; y0: number; px: number; py: number }

const uid = () => Math.random().toString(36).slice(2, 8)
void uid

/** The lanes' colours: what a split wire carries. */
const LANE_RGB: Array<[number, number, number]> = [[246, 243, 234], [92, 128, 255], [248, 156, 56], [246, 243, 234], [92, 200, 132]]   // stereo, l, r, m, s
const SPLIT_FAN = 22   // degrees between a splitter's two output ports
function tintOf (type: number, variant = 0): [number, number, number] {
  if (isUtilityType(type)) return [246, 243, 234]
  return VARIANT_TINTS[type]?.[variant] ?? WALL_TINTS[type] ?? [246, 243, 234]
}
/** Wheel → amount: proportional to the delta, capped so one mouse notch is 0.02 (half a semitone on pitch) and a trackpad brush is a hair. */
const wheelStep = (dy: number) => Math.max(-0.02, Math.min(0.02, dy * 0.0004))
const neutralOf = (type: number) => (type === 0 || type === 3 || type === 16 || type === 17 ? 0.5 : type === 5 ? 0.75 : 0)   // tone, stereo, pitch, formant rest in the middle
const nameOf = (type: number) => (type === FX_MIX_TYPE ? 'mix' : type === FX_SPLIT_LR ? 'L/R' : type === FX_SPLIT_MS ? 'M/S' : MODES.find(m => m.id === type)?.name ?? '')   // the splitters are the one word in capitals: they name the channels

function fmtValue (type: number, a: number, variant = 0): string {
  if (type === 13) return `${Math.round(a * 24)}st`
  if (type === 16 || type === 17) { const st = Math.round((a - 0.5) * 24); return `${st > 0 ? '+' : ''}${st} st` }
  if (type === 0 || type === 3) { const t = Math.round((a - 0.5) * 200); return t === 0 ? '0' : t > 0 ? `+${t}` : `${t}` }
  if (type === 22) return fmtSwell(a)
  if (type === 23) return STUTTER_LABELS[Math.min(4, Math.floor(a * 5))]
  if (type === 25) return fmtRing(a)
  if (type === 26) return fmtGate(a)
  if (type === 5) { const db = a < 0.75 ? (a / 0.75 - 1) * 60 : (a - 0.75) * 48; return `${db > 0 ? '+' : db < 0 ? '−' : ''}${Math.abs(db).toFixed(1)}` }
  if (type === 7) {
    if (variant === 2) return `${(0.3 + (1 - a) * 9).toFixed(1)}oct`
    const hz = variant === 0 ? 20 * Math.pow(2, a * 8) : 20000 * Math.pow(2, -a * 8.3)
    return hz >= 1000 ? `${(hz / 1000).toFixed(1)}k` : `${Math.round(hz)}`
  }
  return `${Math.round(a * 100)}`
}

/** What was typed for the main hand, back to 0..1 — fmtValue's mirror. */
function parseAmount (type: number, s: string, variant = 0): number | null {
  const t = s.trim().toLowerCase()
  if (type === 23) { const i = STUTTER_LABELS.indexOf(t); if (i >= 0) return i / 5 + 0.1 }
  const v = parseLead(t); if (v === null) return null
  if (type === 13) return clamp(v / 24, 0, 1)
  if (type === 16 || type === 17) return clamp(v / 24 + 0.5, 0, 1)
  if (type === 0 || type === 3) return clamp(v / 200 + 0.5, 0, 1)
  if (type === 22) { const T = /s\s*$/.test(t) && !/ms\s*$/.test(t) ? v : v / 1000; return clamp(Math.log(Math.max(1e-6, T) / 0.02) / Math.log(75), 0, 1) }
  if (type === 23) return clamp(v, 0, 1)
  if (type === 25) return clamp(Math.log2(Math.max(1, v) / 20) / 8, 0, 1)
  if (type === 26) return clamp((v + 60) / 60, 0, 1)
  if (type === 5) return clamp(v < 0 ? (v / 60 + 1) * 0.75 : v / 48 + 0.75, 0, 1)
  if (type === 7) {
    if (variant === 2) return clamp(1 - (v - 0.3) / 9, 0, 1)
    const hz = Math.max(1, v)
    return clamp(variant === 0 ? Math.log2(hz / 20) / 8 : -Math.log2(hz / 20000) / 8.3, 0, 1)
  }
  return clamp(v / 100, 0, 1)
}
/** A decay in seconds (as fmtDecay prints it), back to the 0..1 hand. */
function parseDecay (variant: number, s: string): number | null {
  const t = parseLead(s); if (t === null || t <= 0) return null
  const g = Math.pow(10, -0.096 / t)
  const rs = (g - 0.7) / 0.28
  const d = variant === 0 ? (rs - 0.769) / 0.191 : variant === 1 ? (rs - 0.16) / 0.44 + 0.5 : (rs - 0.5) / 0.7 + 0.5
  return clamp(d, 0, 1)
}

/** A demo patch for the plain browser (no engine) and for an empty wall. */
function demoGraph (w: number, h: number): FxGraph {
  const my = h / 2
  const nodes: FxGraphNode[] = [
    { id: 0, type: 0, amount: 0.62, variant: 0, decay: [0.5, 0.5, 0.5], delayDiv: 2, delayFb: 0.35, wet: false, aux: [0, 0, 0], x: w * 0.2, y: my },
    { id: 2, type: 2, amount: 0.45, variant: 0, decay: [0.5, 0.5, 0.5], delayDiv: 2, delayFb: 0.35, wet: false, aux: [0, 0, 0], x: w * 0.4, y: my - 124 },
    { id: 10, type: 10, amount: 0.38, variant: 2, decay: [0.5, 0.5, 0.5], delayDiv: 2, delayFb: 0.35, wet: false, aux: [0, 0, 0], x: w * 0.4, y: my + 124 },
    { id: 11, type: FX_MIX_TYPE, amount: 0, variant: 0, decay: [0.5, 0.5, 0.5], delayDiv: 2, delayFb: 0.35, wet: false, aux: [0, 0, 0], x: w * 0.59, y: my },
    { id: 6, type: 6, amount: 0.3, variant: 0, decay: [0.5, 0.5, 0.5], delayDiv: 2, delayFb: 0.35, wet: false, aux: [0, 0, 0], x: w * 0.775, y: my },
  ]
  const edges: FxGraphEdge[] = [
    { from: FX_PORT_IN, to: 0, gain: 1 }, { from: 0, to: 2, gain: 1 }, { from: 0, to: 10, gain: 1 },
    { from: 2, to: 11, gain: 0.62 }, { from: 10, to: 11, gain: 0.38 }, { from: 11, to: 6, gain: 1 }, { from: 6, to: FX_PORT_OUT, gain: 1 },
  ]
  return { nodes, edges }
}

/** Nodes the engine placed at 0,0 (the legacy single print) get a spot. */
function settle (g: FxGraph, w: number, h: number): FxGraph {
  const nodes = g.nodes.map((n, i) => ({ ...n, aux: (() => { const a = [...(n.aux ?? [])]; while (a.length < 8) a.push(0); return a })(), ...((n.x === 0 && n.y === 0) ? { x: w * (0.3 + 0.2 * i), y: h / 2 } : {}) }))
  const edges = g.edges.length ? g.edges : [{ from: FX_PORT_IN, to: FX_PORT_OUT, gain: 1 }]
  return { nodes, edges }
}

const MIX_FAN = 26   // degrees between a mix print's input ports

/** One 256px tile of static grain, made once. */
let _grain: HTMLCanvasElement | null = null
function grainTile (): HTMLCanvasElement | null {
  if (_grain) return _grain
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas'); c.width = 256; c.height = 256
  const ctx = c.getContext('2d'); if (!ctx) return null
  const img = ctx.createImageData(256, 256)
  let seed = 1234567
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    const v = 114 + (seed % 28)   // around mid-grey: neutral under 'overlay'
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  _grain = c
  return c
}

/** The mix print: one ring cut into its inputs' shares, radial hairlines
 *  at the cuts, the first share in the second ink. */
function MixArt ({ shares }: { shares: number[] }) {
  const RR = 86, C = 110
  const lvl = useContext(StrokeLevel) ?? 0
  const PAPER = strokeFor(lvl)
  const BLUE = lvl > 0.62 ? strokeFor(lvl) : BLUE_INK
  const total = shares.reduce((s, x) => s + x, 0) || 1
  let ang = -Math.PI / 2
  const arcs = shares.map((s, i) => {
    const frac = s / total
    const a0 = ang + 0.06, a1 = ang + frac * Math.PI * 2 - 0.06
    const p0 = [C + RR * Math.cos(a0), C + RR * Math.sin(a0)]
    const p1 = [C + RR * Math.cos(a1), C + RR * Math.sin(a1)]
    const el = (
      <Fragment key={i}>
        {frac > 0.02 && <path d={`M ${p0[0]} ${p0[1]} A ${RR} ${RR} 0 ${frac > 0.5 ? 1 : 0} 1 ${p1[0]} ${p1[1]}`}
          stroke={i === 0 ? BLUE : PAPER} strokeWidth={i === 0 ? 3 : 1.5} fill="none" strokeLinecap="round" />}
        <line x1={C} y1={C} x2={C + RR * Math.cos(ang)} y2={C + RR * Math.sin(ang)} stroke={PAPER} strokeWidth={0.8} opacity={0.7} />
      </Fragment>
    )
    ang += frac * Math.PI * 2
    return el
  })
  if (shares.length === 0) arcs.push(<circle key="e" cx={C} cy={C} r={RR} stroke={PAPER} strokeWidth={1} fill="none" opacity={0.5} />)
  return (
    <g>
      {[22, 40, 58].map(rr => <circle key={rr} cx={C} cy={C} r={rr} stroke={PAPER} strokeWidth={0.8} fill="none" opacity={0.35} />)}
      {arcs}
    </g>
  )
}

/** The splitters' prints: one line in, two out — the fork. */
function SplitArt ({ ms }: { ms: boolean }) {
  const lvl = useContext(StrokeLevel) ?? 0
  const P = strokeFor(lvl)
  const [L, R, M, S] = [LANE_RGB[1], LANE_RGB[2], LANE_RGB[3], LANE_RGB[4]].map(c => `rgb(${c[0]}, ${c[1]}, ${c[2]})`)
  return ms ? (
    <g>
      <path d="M28 110 H92" stroke={P} strokeWidth={1.5} strokeLinecap="round" fill="none" />
      <path d="M92 110 H188" stroke={P} strokeWidth={1.5} strokeLinecap="round" fill="none" />
      <path d="M92 110 C122 110 122 66 152 66 H188" stroke={P} strokeOpacity={0.5} strokeWidth={1} strokeLinecap="round" fill="none" />
      <path d="M92 110 C122 110 122 154 152 154 H188" stroke={P} strokeOpacity={0.5} strokeWidth={1} strokeLinecap="round" fill="none" />
      <circle cx={92} cy={110} r={2.2} fill={P} />
      <circle cx={192} cy={110} r={3} fill={M} /><circle cx={192} cy={66} r={2.4} fill={S} /><circle cx={192} cy={154} r={2.4} fill={S} />
    </g>
  ) : (
    <g>
      <path d="M28 110 H92" stroke={P} strokeWidth={1.5} strokeLinecap="round" fill="none" />
      <path d="M92 110 C122 110 122 74 152 74 H188" stroke={P} strokeWidth={1.5} strokeLinecap="round" fill="none" />
      <path d="M92 110 C122 110 122 146 152 146 H188" stroke={P} strokeWidth={1.5} strokeLinecap="round" fill="none" />
      <circle cx={92} cy={110} r={2.2} fill={P} />
      <circle cx={192} cy={74} r={3} fill={L} /><circle cx={192} cy={146} r={3} fill={R} />
      <path d="M40 100 V120 M46 100 V120" stroke={P} strokeOpacity={0.45} strokeWidth={0.8} />
    </g>
  )
}

function Print ({ node, size, dim, onDecay, onDiv, onFb, onFlip, shares }: {
  node: Pick<FxGraphNode, 'type' | 'amount' | 'variant' | 'decay' | 'delayDiv' | 'delayFb' | 'aux'> & { curve?: number[] }
  size: number
  dim?: boolean
  shares?: number[]
  onDecay?: (v: number, force?: boolean) => void
  onDiv?: (v: number) => void
  onFb?: (v: number, force?: boolean) => void
  onFlip?: (bit: number) => void
}) {
  const { type, amount: a, variant } = node
  const t = tintOf(type, variant)
  // no filter halo: the lamps are the light, and a filter draws its own box
  void t; void a; void dim
  const glow = 'none'
  const Art = ARTS[type]
  return (
    <svg viewBox="0 0 220 220" width={size} height={size} style={{ filter: glow, overflow: 'visible', display: 'block' }}>
      {type === FX_MIX_TYPE ? <MixArt shares={shares ?? []} />
        : isSplitterType(type) ? <SplitArt ms={type === FX_SPLIT_MS} />
        : type === 2 ? <Art a={a} variant={variant} decay={node.decay[variant] ?? 0.5} onDecay={onDecay} />
        : type === 10 ? <Art a={a} div={node.delayDiv} fb={node.delayFb} onDiv={onDiv} onFb={onFb} />
        : type === 7 ? <Art a={a} variant={variant} />
        : type === 5 ? <Art a={a} pol={variant} onFlip={onFlip} />
        : type === 12 ? <Art a={a} variant={variant} curve={node.curve} />
        : type === 22 ? <Art a={a} variant={variant} depth={(node.aux[1] === 1 ? node.aux[0] : 100) / 100} />
        : type === 18 ? <Art a={a} variant={variant} />
        : type === 19 ? <Art a={a} variant={variant} />
        : type === 13 ? <Art a={a} variant={variant} interval={node.aux[0] || 12} />
        : type === 15 ? <Art a={a} degrees={node.aux[2]} keyRoot={node.aux[0]} scale={node.aux[1]} chromatic={variant === 1} />
        : <Art a={a} />}
    </svg>
  )
}

/** The study's big number: the print's hand, dragged here or typed into. */
function StudyValue ({ text, parse, commit, reset, onPointerDown, onWheelDelta }: {
  text: string
  parse: (s: string) => number | null
  commit: (v: number) => void
  reset: () => void
  onPointerDown: (e: RPointerEvent) => void
  onWheelDelta: (dy: number) => void
}) {
  const typing = useTypeIn({ text, parse, commit, reset, className: 'big' })
  const ref = useRef<HTMLSpanElement>(null)
  const wheelRef = useRef(onWheelDelta); wheelRef.current = onWheelDelta
  useEffect(() => {
    const el = ref.current; if (!el) return
    const onWheel = (e: WheelEvent) => { e.preventDefault(); e.stopPropagation(); wheelRef.current(e.deltaY) }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])
  return (
    <span ref={ref} className={`sg-val${typing.editing ? ' typing' : ''}`}
      onPointerDown={(e) => { if (typing.editing) return; if (e.altKey) { e.stopPropagation(); reset(); return } onPointerDown(e) }}
      onDoubleClick={(e) => { e.stopPropagation(); if (!typing.editing) typing.begin() }}>
      {typing.input ?? text}
    </span>
  )
}

function wirePath (p0: Pt, p1: Pt): string {
  const dx = Math.max(40, (p1.x - p0.x) * 0.5)
  return `M ${p0.x} ${p0.y} C ${p0.x + dx} ${p0.y}, ${p1.x - dx} ${p1.y}, ${p1.x} ${p1.y}`
}
/** A point on the cubic above at t. */
function wireAt (p0: Pt, p1: Pt, t: number): Pt {
  const dx = Math.max(40, (p1.x - p0.x) * 0.5)
  const c0 = { x: p0.x + dx, y: p0.y }, c1 = { x: p1.x - dx, y: p1.y }
  const u = 1 - t
  return {
    x: u * u * u * p0.x + 3 * u * u * t * c0.x + 3 * u * t * t * c1.x + t * t * t * p1.x,
    y: u * u * u * p0.y + 3 * u * u * t * c0.y + 3 * u * t * t * c1.y + t * t * t * p1.y,
  }
}
function distToWire (p0: Pt, p1: Pt, q: Pt): number {
  let best = Infinity
  for (let i = 0; i <= 24; i++) {
    const p = wireAt(p0, p1, i / 24)
    best = Math.min(best, Math.hypot(p.x - q.x, p.y - q.y))
  }
  return best
}

interface Props { size: { w: number; h: number } }

export default function FxWall ({ size: frame }: Props) {
  const wallRef = useRef<HTMLDivElement>(null)
  const shelfRef = useRef<HTMLDivElement>(null)
  // the shelf is one long row: a vertical wheel walks it sideways
  useEffect(() => {
    const el = shelfRef.current; if (!el) return
    const onWheel = (e: WheelEvent) => {
      const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX
      if (d === 0) return
      e.preventDefault()
      el.scrollLeft += d
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])
  const bridge = useMemo(() => hasGraphBridge(), [])
  const oldEngine = useMemo(() => !hasGraphBridge() && hasFxBridge(), [])
  const [graph, setGraphState] = useState<FxGraph>(() => demoGraph(frame.w, frame.h))
  const [loaded, setLoaded] = useState(!bridge)
  const [sel, setSel] = useState<{ node?: number; edge?: number } | null>(null)
  // the study opens over the wall's right side; the window never grows
  // (a wall that outgrows a MacBook was the problem), so the wall keeps
  // its full width underneath
  const studyOpen = sel?.node !== undefined
  const size = { w: frame.w, h: frame.h }
  const [confirm, setConfirm] = useState<string | null>(null)   // 'node:3' | 'edge:2' awaiting the second tap
  // the shelf is a drawer: its handle sinks it below the floor and the
  // wall grows into the room; remembered
  const [shelfOpen, setShelfOpen] = useState(() => { try { return localStorage.getItem('orb_wall_shelf') !== '0' } catch { return true } })
  const toggleShelf = () => setShelfOpen(v => { try { localStorage.setItem('orb_wall_shelf', v ? '0' : '1') } catch { /* fine */ } return !v })
  // more prints past the right edge? the edge fades to say so
  const [shelfMore, setShelfMore] = useState(false)
  // the shelf shows one family at a time
  const [shelfFam, setShelfFam] = useState(() => { try { return Math.min(FAMILIES.length - 1, Math.max(0, Number(localStorage.getItem('orb_wall_fam') ?? 0))) } catch { return 0 } })
  const [famHover, setFamHover] = useState(-1)
  const pickFam = (i: number) => { setShelfFam(i); try { localStorage.setItem('orb_wall_fam', String(i)) } catch { /* fine */ } }
  const shelfTypes = useMemo(() => {
    const byName = new Map<string, number>([...MODES.map(m => [m.name, m.id as number] as [string, number]), ['mix', FX_MIX_TYPE], ['L/R', FX_SPLIT_LR], ['M/S', FX_SPLIT_MS]])
    return FAMILIES[shelfFam][1].map(n => byName.get(n)).filter((t): t is number => t !== undefined)
  }, [shelfFam])
  useEffect(() => {
    const el = shelfRef.current; if (!el) return
    const check = () => setShelfMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
    check()
    el.addEventListener('scroll', check, { passive: true })
    const ro = new ResizeObserver(check); ro.observe(el)
    return () => { el.removeEventListener('scroll', check); ro.disconnect() }
  }, [])
  const [drag, setDrag] = useState<Drag | null>(null)
  const [error, setError] = useState<string | null>(null)
  const graphRef = useRef(graph); graphRef.current = graph

  // ── zoom: the signal flow scales about the wall's centre; in and out
  //    stay put on the edges, so the outer wires stretch to meet it ─────
  const [zoom, setZoom] = useState(() => {
    try { const z = Number(localStorage.getItem('orb_wall_zoom')); return z >= 0.35 && z <= 1.8 ? z : 1 } catch { return 1 }
  })
  // pan: drag the empty wall to carry the whole flow — a camera move,
  // not a node move. in and out stay on the edges. Remembered too.
  const [pan, setPan] = useState<Pt>(() => {
    try { const v = JSON.parse(localStorage.getItem('orb_wall_pan') || 'null'); return v && isFinite(v.x) && isFinite(v.y) ? v : { x: 0, y: 0 } } catch { return { x: 0, y: 0 } }
  })
  const cx = size.w / 2, cy = size.h / 2
  const Rz = R * zoom, NODEz = NODE * zoom
  // captions shrink slower than the prints and never below ~8px — the
  // words must stay legible when the flow is zoomed far out
  const capScale = Math.max(0.72, Math.sqrt(zoom))
  const toScreen = (p: Pt): Pt => ({ x: cx + (p.x - cx) * zoom + pan.x, y: cy + (p.y - cy) * zoom + pan.y })
  const toGraph = (p: Pt): Pt => ({ x: cx + (p.x - pan.x - cx) / zoom, y: cy + (p.y - pan.y - cy) / zoom })

  // ── engine sync ────────────────────────────────────────────────────
  useEffect(() => {
    if (!bridge) return
    void getGraph().then(g => {
      if (g) setGraphState(settle(g, size.w, size.h))
      setLoaded(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge])

  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const push = useCallback((g: FxGraph, immediate = false) => {
    if (!bridge) return
    const send = () => { void setGraph(g).then(r => setError(r.ok ? null : (r.error ?? 'refused'))) }
    if (pushTimer.current) clearTimeout(pushTimer.current)
    if (immediate) send()
    else pushTimer.current = setTimeout(send, 33)
  }, [bridge])

  /** Apply a change: local state now, engine soon (structure = now). */
  const commit = useCallback((next: FxGraph, immediate = false) => {
    setGraphState(next)
    push(next, immediate)
  }, [push])

  const updateNode = useCallback((id: number, patch: Partial<FxGraphNode>, immediate = false) => {
    const g = graphRef.current
    commit({ ...g, nodes: g.nodes.map(n => n.id === id ? { ...n, ...patch } : n) }, immediate)
  }, [commit])
  const updateNodeRef = useRef(updateNode); updateNodeRef.current = updateNode

  // Native, non-passive: React's onWheel is passive, and the wall must
  // swallow the scroll. Numbers keep their own wheel (amount, share).
  useEffect(() => {
    const el = wallRef.current; if (!el) return
    const onWheel = (e: WheelEvent) => {
      const t = e.target as Element
      if (t.closest('.sg-val, .sg-share, .fx-hot')) return
      // over a print: the wheel turns its amount, as in the single room
      const nodeEl = t.closest('.sg-node') as HTMLElement | null
      if (nodeEl && t.closest('.sg-print')) {
        e.preventDefault()
        const id = Number(nodeEl.dataset.id)
        const n = graphRef.current.nodes.find(x => x.id === id)
        if (!n || isUtilityType(n.type)) return
        updateNodeRef.current(id, { amount: Math.min(1, Math.max(0, n.amount - wheelStep(e.deltaY))) }, true)
        return
      }
      e.preventDefault()
      setZoom(z => {
        const next = Math.min(1.8, Math.max(0.35, z * Math.exp(-e.deltaY * 0.0015)))
        try { localStorage.setItem('orb_wall_zoom', String(next)) } catch { /* fine */ }
        return next
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // ── geometry ───────────────────────────────────────────────────────
  const inPort: Pt = { x: PORT_INSET, y: size.h / 2 }
  const outPort: Pt = { x: size.w - PORT_INSET, y: size.h / 2 }
  const nodeById = (id: number) => graph.nodes.find(n => n.id === id)
  const inputsOf = (id: number) => graph.edges.map((e, i) => ({ e, i })).filter(x => x.e.to === id)

  /** Where a wire meets a node: mix inputs fan on the left edge. */
  const inPortOf = (id: number, edgeIndex: number): Pt => {
    if (id === FX_PORT_OUT) return { x: outPort.x - 6, y: outPort.y }
    const n = nodeById(id); if (!n) return outPort
    const c = toScreen(n)
    if (n.type !== FX_MIX_TYPE) return { x: c.x - Rz, y: c.y }
    const ins = inputsOf(id)
    const k = ins.findIndex(x => x.i === edgeIndex)
    const count = ins.length
    const ang = ((k < 0 ? count : k) - (count - 1) / 2) * MIX_FAN * Math.PI / 180
    return { x: c.x - Rz * Math.cos(ang), y: c.y + Rz * Math.sin(ang) }
  }
  /** Where a wire leaves a node; a splitter's two ports sit either side of its middle. */
  const outPortOf = (id: number, port = 0): Pt => {
    if (id === FX_PORT_IN) return { x: inPort.x + 6, y: inPort.y }
    const n = nodeById(id); if (!n) return inPort
    const c = toScreen(n)
    if (!isSplitterType(n.type)) return { x: c.x + Rz, y: c.y }
    const ang = (port === 0 ? -1 : 1) * SPLIT_FAN * Math.PI / 180
    return { x: c.x + Rz * Math.cos(ang), y: c.y + Rz * Math.sin(ang) }
  }
  /** What a wire carries: the lane of the port it leaves. A node passes
   *  its one lane on; where lanes differ they have joined into a pair. */
  const laneOfEdge = useMemo(() => {
    const outLane = new Map<number, number>()
    const lanes = graph.edges.map(() => 0)
    for (let pass = 0; pass < FX_MAX_NODES + 2; pass++) {
      let changed = false
      graph.edges.forEach((e, i) => {
        let l = 0
        if (e.from !== FX_PORT_IN) {
          const n = nodeById(e.from)
          if (n && isSplitterType(n.type)) l = n.type === FX_SPLIT_LR ? (e.port ? 2 : 1) : (e.port ? 4 : 3)
          else l = outLane.get(e.from) ?? 0
        }
        if (lanes[i] !== l) { lanes[i] = l; changed = true }
      })
      for (const n of graph.nodes) {
        if (isSplitterType(n.type)) continue
        const ins = graph.edges.map((e, i) => (e.to === n.id ? lanes[i] : -1)).filter(l => l >= 0)
        const l = ins.length > 0 && ins.every(x => x === ins[0]) ? ins[0] : 0
        if (outLane.get(n.id) !== l) { outLane.set(n.id, l); changed = true }
      }
      if (!changed) break
    }
    return lanes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph])

  const wallPt = (e: { clientX: number; clientY: number }): Pt => {
    const r = wallRef.current?.getBoundingClientRect()
    return r ? { x: e.clientX - r.left, y: e.clientY - r.top } : { x: e.clientX, y: e.clientY }
  }

  // A print the signal never reaches (or that never reaches out) hangs
  // dimmed — the engine ignores it, the wall says so.
  const live = useMemo(() => {
    const fwd = new Set<number>(), bwd = new Set<number>()
    let grew = true
    while (grew) {
      grew = false
      for (const e of graph.edges) {
        if ((e.from === FX_PORT_IN || fwd.has(e.from)) && e.to !== FX_PORT_OUT && !fwd.has(e.to)) { fwd.add(e.to); grew = true }
        if ((e.to === FX_PORT_OUT || bwd.has(e.to)) && e.from !== FX_PORT_IN && !bwd.has(e.from)) { bwd.add(e.from); grew = true }
      }
    }
    return new Set(graph.nodes.filter(n => fwd.has(n.id) && bwd.has(n.id)).map(n => n.id))
  }, [graph])

  // ── the room's light: every live print is a lamp ─────────────────────
  // The wall itself stays near-black; each print the signal passes
  // through lights its own patch of wall in its own tint, as far and as
  // bright as its hand — pools of light that add where they overlap.
  // (Painted on the canvas each frame; see backdropRef.)
  const intensityOf = (n: FxGraphNode) =>
    (n.type === 0 || n.type === 16 || n.type === 17) ? Math.abs(n.amount - 0.5) * 2
    : n.type === 5 ? (n.amount < 0.75 ? (0.75 - n.amount) / 0.75 : (n.amount - 0.75) / 0.25)
    : n.amount
  const litLevel = 0   // the ink reads the base wall: paper everywhere
  const inkVars = useMemo(() => {
    const m = /rgb\((\d+), (\d+), (\d+)\)/.exec(strokeFor(litLevel))
    const [r, g, b] = m ? [m[1], m[2], m[3]] : ['246', '243', '234']
    const vars: Record<string, string> = { '--sg-ink': `rgb(${r}, ${g}, ${b})` }
    for (const a of [85, 70, 60, 55, 50, 42, 30, 22, 14]) vars[`--sg-ink-${a}`] = `rgba(${r}, ${g}, ${b}, 0.${a})`
    return vars as React.CSSProperties
  }, [litLevel])
  useEffect(() => {
    const el = document.querySelector('.plugin') as HTMLElement | null
    if (!el) return
    el.style.setProperty('--fx-wall', 'rgb(22, 20, 16)')
    // the grain lives on the room's surface, bars and study included
    const tile = grainTile()
    if (tile) el.style.setProperty('--sg-grain-img', `url(${tile.toDataURL()})`)
    return () => { el.style.removeProperty('--fx-wall'); el.style.removeProperty('--sg-grain-img') }
  }, [])

  // ── structure edits ────────────────────────────────────────────────
  const freeId = () => { for (let i = 0; i < FX_MAX_NODES; i++) if (!graph.nodes.some(n => n.id === i)) return i; return -1 }

  const addNode = (type: number, at: Pt) => {
    const id = freeId(); if (id < 0) return
    const gp = toGraph(at)
    const aux = type === 13 ? [12, 0, 0] : type === 15 ? [0, 0, 2] : type === 18 ? [120, 300, 7, 0, 0, 50, 0, 0] : [0, 0, 0]   // arp: octave steps; harmony: C major, a third; grain: 120 ms, 300 ms spray, 7 st in C major, pan 50
    const node: FxGraphNode = { id, type, amount: neutralOf(type), variant: 0, decay: [0.5, 0.5, 0.5], delayDiv: 2, delayFb: 0.35, wet: false, aux, x: gp.x, y: gp.y }
    let edges = graph.edges
    // dropped onto a wire? splice in
    let best = -1, bestD = SNAP_WIRE
    graph.edges.forEach((e, i) => {
      const d = distToWire(outPortOf(e.from, e.port ?? 0), inPortOf(e.to, i), at)
      if (d < bestD * Math.max(0.6, zoom)) { bestD = d; best = i }
    })
    if (best >= 0) {
      const e = graph.edges[best]
      edges = [...edges.slice(0, best), { from: e.from, to: id, gain: e.gain, port: e.port ?? 0 }, { from: id, to: e.to, gain: 1 }, ...edges.slice(best + 1)]
    }
    commit({ nodes: [...graph.nodes, node], edges }, true)
    setSel({ node: id })
  }

  const removeNode = (id: number) => {
    // heal the wire: what fed the print now feeds whatever it fed
    const ins = graph.edges.filter(e => e.to === id)
    const outs = graph.edges.filter(e => e.from === id)
    let edges = graph.edges.filter(e => e.from !== id && e.to !== id)
    if (ins.length === 1) {
      const from = ins[0].from
      for (const o of outs) {
        if (o.to === from) continue
        if (edges.some(e => e.from === from && e.to === o.to)) continue
        edges = [...edges, { from, to: o.to, gain: o.gain }]
      }
    }
    commit({ nodes: graph.nodes.filter(n => n.id !== id), edges }, true)
    setSel(null); setConfirm(null)
  }
  const removeEdge = (i: number) => {
    commit({ ...graph, edges: graph.edges.filter((_, k) => k !== i) }, true)
    setSel(null); setConfirm(null)
  }

  const connect = (from: number, to: number, port = 0) => {
    if (from === to) return
    if (to === FX_PORT_IN || from === FX_PORT_OUT) return
    if (graph.edges.some(e => e.from === from && e.to === to && (e.port ?? 0) === port)) return
    const target = to === FX_PORT_OUT ? null : nodeById(to)
    // any point takes any number of wires: they sum at the point
    // a mix in blend mode shares 100 across its wires
    let gain = 1
    if (target && target.type === FX_MIX_TYPE && target.variant === 0) {
      const ins = graph.edges.filter(e => e.to === to)
      gain = 1 / (ins.length + 1)
      const rescale = ins.length / (ins.length + 1)
      const edges = graph.edges.map(e => e.to === to ? { ...e, gain: e.gain * rescale } : e)
      commit({ ...graph, edges: [...edges, { from, to, gain, port }] }, true)
      return
    }
    commit({ ...graph, edges: [...graph.edges, { from, to, gain, port }] }, true)
  }

  /** Drag a share number: blend keeps the mix's wires summing to 100. */
  const setShare = (edgeIndex: number, gain: number, immediate = false) => {
    const e = graph.edges[edgeIndex]; if (!e) return
    const target = nodeById(e.to)
    const g = Math.min(1, Math.max(0, gain))   // a wire never sends more than everything
    if (target && target.type === FX_MIX_TYPE && target.variant === 0) {
      const others = graph.edges.map((x, i) => ({ x, i })).filter(o => o.x.to === e.to && o.i !== edgeIndex)
      const rest = Math.max(0, 1 - Math.min(1, g))
      const othersTotal = others.reduce((s, o) => s + o.x.gain, 0)
      const edges = graph.edges.map((x, i) => {
        if (i === edgeIndex) return { ...x, gain: Math.min(1, g) }
        if (x.to !== e.to) return x
        return { ...x, gain: othersTotal > 0 ? x.gain / othersTotal * rest : rest / Math.max(1, others.length) }
      })
      commit({ ...graph, edges }, immediate)
      return
    }
    commit({ ...graph, edges: graph.edges.map((x, i) => i === edgeIndex ? { ...x, gain: g } : x) }, immediate)
  }

  // ── pointer choreography ───────────────────────────────────────────
  const onWallMove = (e: RPointerEvent) => {
    if (!drag) return
    const p = wallPt(e)
    if (drag.kind === 'move') { const gp = toGraph(p); updateNode(drag.id, { x: gp.x - drag.dx, y: gp.y - drag.dy }) }
    else if (drag.kind === 'amount') {
      const n = nodeById(drag.id); if (!n) return
      updateNode(drag.id, { amount: Math.min(1, Math.max(0, drag.a0 + (drag.y0 - e.clientY) / 190)) })
    }
    else if (drag.kind === 'share') setShare(drag.edge, drag.g0 + (drag.y0 - e.clientY) / 160)
    else if (drag.kind === 'hand') {
      const n = nodeById(drag.id); if (!n) return
      const dy = drag.y0 - e.clientY
      if (drag.hand === 'decay') { const d = [...n.decay]; d[n.variant] = Math.min(1, Math.max(0, drag.v0 + dy / 160)); updateNode(drag.id, { decay: d }) }
      else if (drag.hand === 'fb') updateNode(drag.id, { delayFb: Math.min(1, Math.max(0, drag.v0 + dy / 160)) })
      else if (drag.hand === 'div') updateNode(drag.id, { delayDiv: Math.min(6, Math.max(0, Math.round(drag.v0 + dy / 18))) }, true)
      else {
        // aux hands: arp interval 1..12 · harmony key (wraps) / degrees
        const k = drag.hand === 'aux0' ? 0 : drag.hand === 'aux1' ? 1 : drag.hand === 'aux3' ? 3 : drag.hand === 'aux5' ? 5 : 2
        let v = Math.round(drag.v0 + dy / 18)
        if (n.type === 13) v = Math.min(12, Math.max(1, v))
        else if (n.type === 15 && k === 0) v = ((v % 12) + 12) % 12
        else if (n.type === 15 && k === 2) v = n.variant === 1 ? Math.min(12, Math.max(-12, v)) : Math.min(7, Math.max(-7, v))
        else if (n.type === 16) v = Math.min(100, Math.max(-100, Math.round(drag.v0 + dy / 3)))            // cents
        else if (n.type === 18 && k === 0) v = Math.min(600, Math.max(10, Math.round(drag.v0 + dy * 2)))   // ms
        else if (n.type === 18 && k === 1) v = Math.min(1500, Math.max(0, Math.round(drag.v0 + dy * 5)))   // ms
        else if (n.type === 18 && k === 2) v = Math.min(24, Math.max(0, v))                                  // semitones
        else if (n.type === 18 && k === 3) v = ((v % 12) + 12) % 12                                            // key root
        else if (n.type === 18 && k === 5) v = Math.min(100, Math.max(0, Math.round(drag.v0 + dy / 2)))       // pan %
        else if (n.type === 22) v = Math.min(100, Math.max(0, Math.round(drag.v0 + dy / 2)))                  // swell depth %
        const aux = [...n.aux]; while (aux.length < 8) aux.push(0); aux[k] = v
        if (n.type === 22) aux[1] = 1   // depth has been set (0 is a real value)
        updateNode(drag.id, { aux }, true)
      }
    }
    else if (drag.kind === 'wire' || drag.kind === 'shelf') setDrag({ ...drag, at: p })
    else if (drag.kind === 'pan') setPan({ x: drag.px + (e.clientX - drag.x0), y: drag.py + (e.clientY - drag.y0) })
  }
  const onWallUp = (e: RPointerEvent) => {
    if (!drag) return
    const p = wallPt(e)
    if (drag.kind === 'wire') {
      // landed on a node (its input) or the out port?
      const hit = graph.nodes.find(n => { const c = toScreen(n); return Math.hypot(c.x - p.x, c.y - p.y) <= Rz + 10 })
      if (hit) connect(drag.from, hit.id, drag.port)
      else if (Math.hypot(outPort.x - p.x, outPort.y - p.y) <= 28) connect(drag.from, FX_PORT_OUT, drag.port)
    }
    else if (drag.kind === 'shelf') {
      if (p.x > 0 && p.y > 0 && p.x < size.w && p.y < size.h) addNode(drag.type, p)
    }
    else if (drag.kind === 'amount' || drag.kind === 'share' || drag.kind === 'move' || drag.kind === 'hand') push(graphRef.current, true)
    else if (drag.kind === 'pan') { try { localStorage.setItem('orb_wall_pan', JSON.stringify(pan)) } catch { /* fine */ } }
    setDrag(null)
  }

  const startMove = (n: FxGraphNode) => (e: RPointerEvent) => {
    if ((e.target as Element).closest('.fx-hot, .sg-val, .sg-word, .sg-dot')) return
    e.stopPropagation(); setSel({ node: n.id }); setConfirm(null)
    const gp = toGraph(wallPt(e))
    setDrag({ kind: 'move', id: n.id, dx: gp.x - n.x, dy: gp.y - n.y })
  }

  const startWire = (from: number, port = 0) => (e: RPointerEvent) => {
    e.stopPropagation()
    setDrag({ kind: 'wire', from, port, at: wallPt(e) })
  }

  // ── render ─────────────────────────────────────────────────────────
  const sharesOf = (id: number) => inputsOf(id).map(x => x.e.gain)
  const full = graph.nodes.length >= FX_MAX_NODES
  const shelf = shelfLayout()
  const shelfPrint = shelf.print


  // ── a print's second hands and its words — the same ones under the
  //    print on the wall and, larger, in the study ───────────────────
  const grab = (e: React.PointerEvent) => { try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* fine */ } }
  const hands = (n: FxGraphNode, inStudy = false) => {
    const isMix = n.type === FX_MIX_TYPE && !inStudy   // the study lists a mix's wires itself
    const ins = inputsOf(n.id)
    void isMix; void ins
    return (
      <>
                  {/* the second hands, out here where they stay legible at any zoom */}
                  {n.type === 2 && (
                    <span className="sg-val hand"
                      onPointerDown={(e) => { e.stopPropagation(); grab(e); setSel({ node: n.id }); setDrag({ kind: 'hand', id: n.id, hand: 'decay', y0: e.clientY, v0: n.decay[n.variant] ?? 0.5 }) }}
                      onDoubleClick={(e) => { e.stopPropagation(); const d = [...n.decay]; d[n.variant] = 0.5; updateNode(n.id, { decay: d }, true) }}>
                      {' '}{fmtDecay(n.variant, n.decay[n.variant] ?? 0.5)}
                    </span>
                  )}
                  {n.type === 10 && (
                    <>
                      <span className="sg-val hand"
                        onPointerDown={(e) => { e.stopPropagation(); grab(e); setSel({ node: n.id }); setDrag({ kind: 'hand', id: n.id, hand: 'div', y0: e.clientY, v0: n.delayDiv }) }}
                        onDoubleClick={(e) => { e.stopPropagation(); updateNode(n.id, { delayDiv: 2 }, true) }}>
                        {' '}{DIV_LABELS[n.delayDiv] ?? '1/8'}
                      </span>
                      <span className="sg-val hand"
                        onPointerDown={(e) => { e.stopPropagation(); grab(e); setSel({ node: n.id }); setDrag({ kind: 'hand', id: n.id, hand: 'fb', y0: e.clientY, v0: n.delayFb }) }}
                        onDoubleClick={(e) => { e.stopPropagation(); updateNode(n.id, { delayFb: 0.35, }, true) }}>
                        {' fb '}{Math.round(n.delayFb * 100)}
                      </span>
                    </>
                  )}
                  {(n.type === 12 || n.type === 13) && (
                    <span className="sg-val hand"
                      onPointerDown={(e) => { e.stopPropagation(); grab(e); setSel({ node: n.id }); setDrag({ kind: 'hand', id: n.id, hand: 'div', y0: e.clientY, v0: n.delayDiv }) }}
                      onDoubleClick={(e) => { e.stopPropagation(); updateNode(n.id, { delayDiv: 2 }, true) }}>
                      {' '}{DIV_LABELS[n.delayDiv] ?? '1/8'}
                    </span>
                  )}
                  {n.type === 13 && (
                    <span className="sg-val hand"
                      onPointerDown={(e) => { e.stopPropagation(); grab(e); setSel({ node: n.id }); setDrag({ kind: 'hand', id: n.id, hand: 'aux0', y0: e.clientY, v0: n.aux[0] || 12 }) }}
                      onDoubleClick={(e) => { e.stopPropagation(); const aux = [...n.aux]; aux[0] = 12; updateNode(n.id, { aux }, true) }}>
                      {' step '}{n.aux[0] || 12}
                    </span>
                  )}
                  {n.type === 15 && n.variant !== 1 && (
                    <span className="sg-val hand"
                      onPointerDown={(e) => { e.stopPropagation(); grab(e); setSel({ node: n.id }); setDrag({ kind: 'hand', id: n.id, hand: 'aux0', y0: e.clientY, v0: n.aux[0] }) }}>
                      {' '}{KEY_NAMES[((n.aux[0] % 12) + 12) % 12]} {n.aux[1] === 1 ? 'minor' : 'major'}
                    </span>
                  )}
                  {n.type === 22 && (
                    <span className="sg-val hand"
                      onPointerDown={(e) => { e.stopPropagation(); grab(e); setSel({ node: n.id }); setDrag({ kind: 'hand', id: n.id, hand: 'aux0', y0: e.clientY, v0: n.aux[1] === 1 ? n.aux[0] : 100 }) }}
                      onDoubleClick={(e) => { e.stopPropagation(); const aux = [...n.aux]; aux[0] = 100; aux[1] = 1; updateNode(n.id, { aux }, true) }}>
                      {' depth '}{n.aux[1] === 1 ? n.aux[0] : 100}
                    </span>
                  )}
                  {n.type === 16 && (
                    <span className="sg-val hand"
                      onPointerDown={(e) => { e.stopPropagation(); grab(e); setSel({ node: n.id }); setDrag({ kind: 'hand', id: n.id, hand: 'aux0', y0: e.clientY, v0: n.aux[0] }) }}
                      onDoubleClick={(e) => { e.stopPropagation(); const aux = [...n.aux]; aux[0] = 0; updateNode(n.id, { aux }, true) }}>
                      {' '}{n.aux[0] > 0 ? '+' : ''}{n.aux[0]}c
                    </span>
                  )}
                  {n.type === 18 && (
                    <>
                      <span className="sg-val hand"
                        onPointerDown={(e) => { e.stopPropagation(); grab(e); setSel({ node: n.id }); setDrag({ kind: 'hand', id: n.id, hand: 'aux0', y0: e.clientY, v0: n.aux[0] || 120 }) }}
                        onDoubleClick={(e) => { e.stopPropagation(); const aux = [...n.aux]; aux[0] = 120; updateNode(n.id, { aux }, true) }}>
                        {' '}{n.aux[0] || 120}ms
                      </span>
                      <span className="sg-val hand"
                        onPointerDown={(e) => { e.stopPropagation(); grab(e); setSel({ node: n.id }); setDrag({ kind: 'hand', id: n.id, hand: 'aux1', y0: e.clientY, v0: n.aux[1] }) }}
                        onDoubleClick={(e) => { e.stopPropagation(); const aux = [...n.aux]; aux[1] = 300; updateNode(n.id, { aux }, true) }}>
                        {' spray '}{n.aux[1]}
                      </span>
                      <span className="sg-val hand"
                        onPointerDown={(e) => { e.stopPropagation(); grab(e); setSel({ node: n.id }); setDrag({ kind: 'hand', id: n.id, hand: 'aux2', y0: e.clientY, v0: n.aux[2] }) }}
                        onDoubleClick={(e) => { e.stopPropagation(); const aux = [...n.aux]; aux[2] = 0; updateNode(n.id, { aux }, true) }}>
                        {' scatter '}{n.aux[2]}
                      </span>
                      {(n.aux[6] || 0) === 0 && (
                        <span className="sg-val hand"
                          onPointerDown={(e) => { e.stopPropagation(); grab(e); setSel({ node: n.id }); setDrag({ kind: 'hand', id: n.id, hand: 'aux3', y0: e.clientY, v0: n.aux[3] || 0 }) }}>
                          {' '}{KEY_NAMES[(((n.aux[3] || 0) % 12) + 12) % 12]} {(n.aux[4] || 0) === 1 ? 'minor' : 'major'}
                        </span>
                      )}
                      <span className="sg-val hand"
                        onPointerDown={(e) => { e.stopPropagation(); grab(e); setSel({ node: n.id }); setDrag({ kind: 'hand', id: n.id, hand: 'aux5', y0: e.clientY, v0: n.aux[5] ?? 50 }) }}
                        onDoubleClick={(e) => { e.stopPropagation(); const aux = [...n.aux]; aux[5] = 50; updateNode(n.id, { aux }, true) }}>
                        {' pan '}{n.aux[5] ?? 50}
                      </span>
                      {n.variant === 1 && (
                        <span className="sg-val hand"
                          onPointerDown={(e) => { e.stopPropagation(); grab(e); setSel({ node: n.id }); setDrag({ kind: 'hand', id: n.id, hand: 'div', y0: e.clientY, v0: n.delayDiv }) }}
                          onDoubleClick={(e) => { e.stopPropagation(); updateNode(n.id, { delayDiv: 2 }, true) }}>
                          {' '}{DIV_LABELS[n.delayDiv] ?? '1/8'}
                        </span>
                      )}
                    </>
                  )}
                  {n.type === 15 && (
                    <span className="sg-val hand"
                      onPointerDown={(e) => { e.stopPropagation(); grab(e); setSel({ node: n.id }); setDrag({ kind: 'hand', id: n.id, hand: 'aux2', y0: e.clientY, v0: n.aux[2] }) }}
                      onDoubleClick={(e) => { e.stopPropagation(); const aux = [...n.aux]; aux[2] = n.variant === 1 ? 7 : 2; updateNode(n.id, { aux }, true) }}>
                      {' '}{n.aux[2] > 0 ? '+' : ''}{n.aux[2]}{n.variant === 1 ? ' st' : n.aux[2] === 0 ? ' unison' : ''}
                    </span>
                  )}
                  {isMix && (
                    <span className="sg-val quiet">
                      {ins.length === 0 ? ' —' : ins.map(x => ` ${x.e.from === FX_PORT_IN ? 'in' : nameOf(nodeById(x.e.from)?.type ?? -1)} ${Math.round(x.e.gain * 100)}`).join('')}
                    </span>
                  )}
      </>
    )
  }
  // ── the study's rows: every hand and word of the chosen print, one
  //    per line, as the controls in StudyControls ────────────────────
  const VARIANT_LABEL: Record<number, string> = { 1: 'drive', 2: 'room', 6: 'kind', 7: 'pass', 8: 'stage', 9: 'spread', 10: 'type', 13: 'order', 14: 'band', 15: 'mode', 16: 'mode', 18: 'mode', 20: 'target', 21: 'interval', 22: 'floor', 23: 'grid', 24: 'mode', 25: 'mode', 26: 'release', 27: 'motion' }
  const studyRows = (n: FxGraphNode) => {
    const isMix = n.type === FX_MIX_TYPE
    const setAux = (k: number, v: number, extra?: (aux: number[]) => void) => {
      const aux = [...n.aux]; while (aux.length < 8) aux.push(0); aux[k] = v; extra?.(aux)
      updateNode(n.id, { aux }, true)
    }
    const rows: React.ReactNode[] = []
    const flavours = isMix ? ['blend', 'sum'] : VARIANTS[n.type] ?? []
    if (n.type === 12) {
      const cur = Math.min(TREM_PRESETS.length - 1, n.aux[2] || 0)
      rows.push(<ChoiceRow key="shape" label="shape" options={TREM_PRESETS.map(p => p.name)} value={cur}
        onPick={(pi) => { const aux = [...n.aux]; while (aux.length < 8) aux.push(0); aux[2] = pi; updateNode(n.id, { aux, curve: TREM_PRESETS[pi].curve(), variant: Math.min(4, pi) }, true) }} />)
      rows.push(<ChoiceRow key="target" label="moves" options={['volume', 'pan']} value={n.aux[0] || 0} onPick={(k) => setAux(0, k)} />)
      rows.push(<ChoiceRow key="rate" label="rate" options={DIV_LABELS} value={n.delayDiv} fill onPick={(v) => updateNode(n.id, { delayDiv: v }, true)} />)
    } else if (n.type !== 5 && flavours.length > 0) {
      rows.push(<ChoiceRow key="variant" label={isMix ? 'mode' : (VARIANT_LABEL[n.type] ?? 'mode')} options={flavours} value={n.variant} onPick={(vi) => updateNode(n.id, { variant: vi }, true)} />)
    }
    if (n.type === 2) {
      rows.push(<GaugeRow key="decay" label="decay" value={n.decay[n.variant] ?? 0.5} min={0} max={1} step={0.005} defaultValue={0.5}
        format={(d) => fmtDecay(n.variant, d)} parse={(s) => parseDecay(n.variant, s)}
        onChange={(v, final) => { const d = [...n.decay]; d[n.variant] = v; updateNode(n.id, { decay: d }, final) }} />)
    }
    if (n.type === 10) {
      rows.push(<ChoiceRow key="time" label="time" options={DIV_LABELS} value={n.delayDiv} fill onPick={(v) => updateNode(n.id, { delayDiv: v }, true)} />)
      rows.push(<GaugeRow key="fb" label="feedback" value={Math.round(n.delayFb * 100)} min={0} max={100} unit="%" defaultValue={35}
        onChange={(v, final) => updateNode(n.id, { delayFb: v / 100 }, final)} />)
    }
    if (n.type === 13) {
      rows.push(<ChoiceRow key="rate" label="rate" options={DIV_LABELS} value={n.delayDiv} fill onPick={(v) => updateNode(n.id, { delayDiv: v }, true)} />)
      rows.push(<GaugeRow key="step" label="step" value={n.aux[0] || 12} min={1} max={12} unit="st" defaultValue={12} fine={120} onChange={(v) => setAux(0, v)} />)
    }
    if (n.type === 15) {
      if (n.variant !== 1) {
        rows.push(<ChoiceRow key="key" label="key" options={KEY_NAMES} value={((n.aux[0] % 12) + 12) % 12} fill onPick={(k) => setAux(0, k)} />)
        rows.push(<ChoiceRow key="scale" label="scale" options={['major', 'minor']} value={n.aux[1] === 1 ? 1 : 0} onPick={(k) => setAux(1, k)} />)
      }
      const chroma = n.variant === 1
      rows.push(<GaugeRow key="int" label={chroma ? 'interval' : 'degrees'} value={n.aux[2] || 0} min={chroma ? -12 : -7} max={chroma ? 12 : 7} bipolar defaultValue={chroma ? 7 : 2} fine={140}
        format={(v) => `${v > 0 ? '+' : ''}${v}${chroma ? ' st' : v === 0 ? ' unison' : ''}`} onChange={(v) => setAux(2, v)} />)
    }
    if (n.type === 16) {
      rows.push(<GaugeRow key="cents" label="cents" value={n.aux[0] || 0} min={-100} max={100} bipolar defaultValue={0} format={(v) => `${v > 0 ? '+' : ''}${v} c`} onChange={(v) => setAux(0, v)} />)
      rows.push(<ChoiceRow key="engine" label="engine" options={['fine', 'live']} value={n.aux[1] || 0} onPick={(k) => setAux(1, k)} />)
    }
    if (n.type === 17) rows.push(<ChoiceRow key="engine" label="engine" options={['fine', 'live']} value={n.aux[0] || 0} onPick={(k) => setAux(0, k)} />)
    if (n.type === 18) {
      rows.push(<GaugeRow key="size" label="size" value={n.aux[0] || 120} min={10} max={600} unit="ms" defaultValue={120} onChange={(v) => setAux(0, v)} />)
      rows.push(<GaugeRow key="spray" label="spray" value={n.aux[1] || 0} min={0} max={1500} unit="ms" defaultValue={300} onChange={(v) => setAux(1, v)} />)
      rows.push(<GaugeRow key="scatter" label="scatter" value={n.aux[2] || 0} min={0} max={24} unit="st" defaultValue={0} fine={140} onChange={(v) => setAux(2, v)} />)
      rows.push(<ChoiceRow key="pmode" label="pitch" options={['key', 'intervals', 'cents', 'free']} value={n.aux[6] || 0} onPick={(k) => setAux(6, k)} />)
      if ((n.aux[6] || 0) === 0) {
        rows.push(<ChoiceRow key="key" label="key" options={KEY_NAMES} value={(((n.aux[3] || 0) % 12) + 12) % 12} fill onPick={(k) => setAux(3, k)} />)
        rows.push(<ChoiceRow key="scale" label="scale" options={['major', 'minor']} value={(n.aux[4] || 0) === 1 ? 1 : 0} onPick={(k) => setAux(4, k)} />)
      }
      if (n.variant === 1) rows.push(<ChoiceRow key="rate" label="rate" options={DIV_LABELS} value={n.delayDiv} fill onPick={(v) => updateNode(n.id, { delayDiv: v }, true)} />)
      rows.push(<GaugeRow key="pan" label="pan" value={n.aux[5] ?? 50} min={0} max={100} unit="%" defaultValue={50} onChange={(v) => setAux(5, v)} />)
    }
    if (n.type === 22) {
      rows.push(<GaugeRow key="depth" label="depth" value={n.aux[1] === 1 ? n.aux[0] : 100} min={0} max={100} unit="%" defaultValue={100}
        onChange={(v) => setAux(0, v, (aux) => { aux[1] = 1 })} />)
    }
    if (isMix) {
      const ins = inputsOf(n.id)
      ins.forEach(x => rows.push(
        <GaugeRow key={`in${x.i}`} label={x.e.from === FX_PORT_IN ? 'in' : nameOf(nodeById(x.e.from)?.type ?? -1)} value={Math.round(x.e.gain * 100)} min={0} max={100} unit="%"
          defaultValue={Math.round(100 / Math.max(1, ins.length))} onChange={(v, final) => setShare(x.i, v / 100, final)} />,
      ))
    }
    const switches: Array<{ label: string; on: boolean; set: (on: boolean) => void; quiet?: boolean }> = []
    if (n.type === 5) {
      switches.push({ label: 'ø left', on: (n.variant & 1) !== 0, set: () => updateNode(n.id, { variant: n.variant ^ 1 }, true) })
      switches.push({ label: 'ø right', on: (n.variant & 2) !== 0, set: () => updateNode(n.id, { variant: n.variant ^ 2 }, true) })
    }
    if (n.type === 18) switches.push({ label: 'freeze', on: !!n.aux[7], set: (on) => setAux(7, on ? 1 : 0) })
    if (WET_TYPES.has(n.type)) switches.push({ label: 'wet only', on: !!n.wet, set: (on) => updateNode(n.id, { wet: on }, true) })
    if (!isUtilityType(n.type)) switches.push({ label: 'bypass', on: !!n.bypass, set: (on) => updateNode(n.id, { bypass: on }, true), quiet: true })
    rows.push(<SwitchRow key="sw" items={switches} />)
    // the hands take their colours in order: blue, green, white, orange, then again; the switches are orange
    return rows.map((r, i) => React.isValidElement(r) ? React.cloneElement(r as React.ReactElement<{ colour?: number }>, { colour: r.key === 'sw' ? 4 : (i % 4) + 1 }) : r)
  }

  const studyLive = studyOpen ? nodeById(sel!.node!) : undefined
  // the study lingers a beat after its print is let go, sliding out
  const [studyGone, setStudyGone] = useState<FxGraphNode | null>(null)
  const lastStudy = useRef<FxGraphNode | undefined>(undefined)
  useEffect(() => {
    if (studyLive) { lastStudy.current = studyLive; setStudyGone(null); return }
    if (!lastStudy.current) return
    setStudyGone(lastStudy.current); lastStudy.current = undefined
    const t = setTimeout(() => setStudyGone(null), 300)
    return () => clearTimeout(t)
  }, [studyLive])
  const studyNode = studyLive ?? studyGone ?? undefined
  const studyOut = !studyLive && !!studyGone

  // ── the canvas draws the wall's wires and the discs under its prints,
  //    every frame, in the wall's colour as it is RIGHT NOW (mid-fade
  //    included) — the DOM above only holds hits, ports, texts ─────────
  const overlayRef = useRef<(ctx: CanvasRenderingContext2D) => void>(() => {})
  overlayRef.current = (ctx) => {
    const plugin = document.querySelector('.plugin') as HTMLElement | null
    const wallNow = plugin ? getComputedStyle(plugin).backgroundColor : 'rgb(22, 20, 16)'
    const m = /rgb\((\d+), (\d+), (\d+)\)/.exec(inkRgb)
    const paper: [number, number, number] = m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [246, 243, 234]
    const rgba = (t: [number, number, number], a: number) => `rgba(${t[0]}, ${t[1]}, ${t[2]}, ${a})`
    const lampOf = (id: number): { t: [number, number, number]; k: number } => {
      if (id === FX_PORT_IN || id === FX_PORT_OUT) return { t: paper, k: 0.3 }
      const n = nodeById(id)
      if (!n || isUtilityType(n.type)) return { t: paper, k: 0 }
      return { t: tintOf(n.type, n.variant), k: lamps.current.get(id)?.k ?? 0 }
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    // wires: paper, tinted by the lamp at each end; a split lane in its own colour
    graph.edges.forEach((e, i) => {
      const p0 = outPortOf(e.from, e.port ?? 0), p1 = inPortOf(e.to, i)
      const path = new Path2D(wirePath(p0, p1))
      const lane = laneOfEdge[i] ?? 0
      const selAlpha = sel?.edge === i ? 1 : 0.42
      if (lane > 0) {
        ctx.strokeStyle = rgba(LANE_RGB[lane], sel?.edge === i ? 0.95 : 0.55)
      } else {
        const a = lampOf(e.from), b = lampOf(e.to)
        const mix = (l: { t: [number, number, number]; k: number }): [number, number, number] =>
          [paper[0] + (l.t[0] - paper[0]) * l.k, paper[1] + (l.t[1] - paper[1]) * l.k, paper[2] + (l.t[2] - paper[2]) * l.k]
        const g = ctx.createLinearGradient(p0.x, p0.y, p1.x, p1.y)
        g.addColorStop(0, rgba(mix(a), selAlpha)); g.addColorStop(1, rgba(mix(b), selAlpha))
        ctx.strokeStyle = g
      }
      ctx.lineWidth = sel?.edge === i ? 1.2 : 1; ctx.stroke(path)
    })
    // on a split lane one short glowing line runs down the wire, in the lane's colour
    {
      const t0 = performance.now() / 1000
      graph.edges.forEach((e, i) => {
        const lane = laneOfEdge[i] ?? 0
        if (lane === 0) return
        const p0 = outPortOf(e.from, e.port ?? 0), p1 = inPortOf(e.to, i)
        const c = LANE_RGB[lane]
        const head = ((t0 / 2.2) + i * 0.29) % 1
        const len = 0.16
        const a = Math.max(0, head - len)
        const pts: Pt[] = []
        for (let k = 0; k <= 10; k++) pts.push(wireAt(p0, p1, a + (head - a) * k / 10))
        const g = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[10].x, pts[10].y)
        g.addColorStop(0, rgba(c, 0)); g.addColorStop(1, rgba(c, 1))
        // the glow: a wide soft stroke under a thin bright one
        ctx.save()
        ctx.shadowColor = rgba(c, 0.9); ctx.shadowBlur = 10 * Math.max(0.8, zoom)
        ctx.strokeStyle = g; ctx.lineWidth = 1.6 * Math.max(0.8, zoom)
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y)
        for (let k = 1; k <= 10; k++) ctx.lineTo(pts[k].x, pts[k].y)
        ctx.stroke()
        ctx.restore()
      })
    }
    // plates: a soft shadow below, then the disc lit from above
    for (const n of graph.nodes) {
      const c = toScreen(n)
      const alive = !isUtilityType(n.type) && live.has(n.id) && !n.bypass
      const k = alive ? (lamps.current.get(n.id)?.k ?? 0) : 0
      ctx.save()
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'; ctx.shadowBlur = 14 * zoom; ctx.shadowOffsetY = 6 * zoom
      ctx.beginPath(); ctx.arc(c.x, c.y, Rz + 2, 0, Math.PI * 2); ctx.fillStyle = wallNow; ctx.fill()
      ctx.restore()
      // the plate sits IN the light, not brighter than it
      const own = alive ? wallColor(n.type as FxMode, n.variant, k * 0.5) : 'rgb(16, 15, 12)'
      const top = alive ? wallColor(n.type as FxMode, n.variant, Math.min(1, k * 0.68)) : 'rgb(20, 19, 16)'
      const dg = ctx.createLinearGradient(c.x, c.y - Rz, c.x, c.y + Rz)
      dg.addColorStop(0, top); dg.addColorStop(1, own)
      ctx.beginPath(); ctx.arc(c.x, c.y, Rz + 2, 0, Math.PI * 2); ctx.fillStyle = dg; ctx.fill()
    }
  }
  const overlayFn = useCallback((ctx: CanvasRenderingContext2D) => overlayRef.current(ctx), [])
  // per-slot signal peaks from the plugin (or a slow breath in a browser)
  const peaks = useRef<Float32Array>(new Float32Array(FX_MAX_NODES))
  const envs = useRef<Float32Array>(new Float32Array(FX_MAX_NODES))   // eased
  useEffect(() => {
    if (!hasJuceBridge) return
    const onAudio = (e: Event) => {
      const d = (e as CustomEvent).detail as { peaks?: number[] }
      if (Array.isArray(d.peaks)) for (let i = 0; i < FX_MAX_NODES; i++) peaks.current[i] = Math.min(1.4, Number(d.peaks[i]) || 0)
    }
    window.addEventListener('__juceDawAudio', onAudio)
    return () => window.removeEventListener('__juceDawAudio', onAudio)
  }, [])
  // each lamp's brightness and reach ease toward their targets: a knob
  // turn never pops the light, a new print's lamp fades up
  const lamps = useRef<Map<number, { k: number; reach: number }>>(new Map())
  const lastFrame = useRef(performance.now())

  /** One lamp's pool of light, as the wall paints it. */
  const paintPool = (ctx: CanvasRenderingContext2D, lx: number, ly: number, t: [number, number, number], a: number, reach: number) => {
    const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, reach)
    g.addColorStop(0,    `rgba(${t[0]}, ${t[1]}, ${t[2]}, ${Math.min(1, 1.0 * a).toFixed(3)})`)
    g.addColorStop(0.22, `rgba(${t[0]}, ${t[1]}, ${t[2]}, ${(0.66 * a).toFixed(3)})`)
    g.addColorStop(0.42, `rgba(${t[0]}, ${t[1]}, ${t[2]}, ${(0.32 * a).toFixed(3)})`)
    g.addColorStop(0.7,  `rgba(${t[0]}, ${t[1]}, ${t[2]}, ${(0.1 * a).toFixed(3)})`)
    g.addColorStop(1,    `rgba(${t[0]}, ${t[1]}, ${t[2]}, 0)`)
    ctx.fillStyle = g
    ctx.fillRect(lx - reach, ly - reach, reach * 2, reach * 2)
  }
  // the study's own lamp: the chosen print lit exactly as on the wall,
  // breathing with the same signal — painted as a CSS gradient on the
  // pane itself (a canvas there mis-sized inside one host's WebView)
  const studyRef = useRef<HTMLElement>(null)
  // the study's column scrolls when its rows outgrow the window — but the
  // wheel over the print (or its number) turns the hand, never the page
  // (React's own wheel handlers are passive, so this one is native)
  useEffect(() => {
    if (!studyOpen) return
    const el = studyRef.current; if (!el) return
    const onWheel = (e: WheelEvent) => { if ((e.target as Element).closest('.sg-study-print, .sg-study-value')) e.preventDefault() }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [studyOpen])
  useEffect(() => {
    if (!studyOpen) return
    let raf = 0
    const tick = () => {
      const el = studyRef.current
      const id = sel?.node
      if (el && id !== undefined) {
        const n = graphRef.current.nodes.find(x => x.id === id)
        const st = n && !isUtilityType(n.type) ? lamps.current.get(n.id) : undefined
        if (n && st && st.k > 0.005) {
          const p = el.querySelector('.sg-study-print') as HTMLElement | null
          const er = el.getBoundingClientRect(), pr = p?.getBoundingClientRect()
          const cx = pr ? pr.left - er.left + pr.width / 2 : er.width / 2
          const cy = pr ? pr.top - er.top + pr.height * 0.42 : er.height / 2
          const t = tintOf(n.type, n.variant)
          const a = st.k
          const reach = (STUDY_PRINT / 2) * (2.4 + Math.min(1, intensityOf(n)) * 3.6)
          const c = (k: number) => `rgba(${t[0]}, ${t[1]}, ${t[2]}, ${(k * a).toFixed(3)})`
          el.style.background = `radial-gradient(${Math.round(reach)}px circle at ${Math.round(cx)}px ${Math.round(cy)}px, ${c(1)} 0%, ${c(0.66)} 22%, ${c(0.32)} 42%, ${c(0.1)} 70%, rgba(${t[0]}, ${t[1]}, ${t[2]}, 0) 100%), var(--fx-wall, #161410)`
        } else {
          el.style.background = ''
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)   // the last lamp stays painted while the study slides out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyOpen, sel?.node])

  const backdropRef = useRef<(ctx: CanvasRenderingContext2D) => void>(() => {})
  backdropRef.current = (ctx) => {
    const now = performance.now()
    const dt = Math.min(0.1, (now - lastFrame.current) / 1000); lastFrame.current = now
    const ease = 1 - Math.exp(-dt / 0.28)
    const W = size.w, H = size.h

    void W; void H

    // the lamps
    ctx.globalCompositeOperation = 'screen'
    const seen = new Set<number>()
    for (const n of graph.nodes) {
      if (isUtilityType(n.type)) continue
      const alive = live.has(n.id) && !n.bypass
      const kTarget = alive ? Math.min(1, intensityOf(n)) : 0
      const st = lamps.current.get(n.id) ?? { k: 0, reach: 0 }
      // signal breath: fast up, slow down
      const pk = hasJuceBridge ? peaks.current[n.id] : 0.5 + 0.5 * Math.sin(now / 1000 * 2 * Math.PI * 0.45 + n.id)
      const env = envs.current[n.id]
      envs.current[n.id] = pk > env ? env + (pk - env) * Math.min(1, dt * 30) : env + (pk - env) * Math.min(1, dt * 3)
      const breath = alive ? envs.current[n.id] : 0
      const kNow = kTarget * (0.85 + 0.35 * Math.min(1, breath))
      st.k += (kNow - st.k) * ease
      const reachTarget = Rz * (1.9 + kTarget * 4.6)
      st.reach += (reachTarget - st.reach) * ease
      lamps.current.set(n.id, st); seen.add(n.id)
      if (st.k < 0.005) continue
      const c = toScreen(n)
      const t = tintOf(n.type, n.variant)
      // the lamp hangs above the print: the pool leans up
      // a hot core and a long tail — light, not a disc
      paintPool(ctx, c.x, c.y - Rz * 0.35, t, st.k, st.reach)
    }
    for (const id of [...lamps.current.keys()]) if (!seen.has(id)) lamps.current.delete(id)
    // in and out: two small paper lamps, so the ends of the wall are never dead
    for (const pt of [inPort, outPort]) {
      const g = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 90)
      g.addColorStop(0, 'rgba(246, 243, 234, 0.16)'); g.addColorStop(0.4, 'rgba(246, 243, 234, 0.05)'); g.addColorStop(1, 'rgba(246, 243, 234, 0)')
      ctx.fillStyle = g; ctx.fillRect(pt.x - 90, pt.y - 90, 180, 180)
    }
    ctx.globalCompositeOperation = 'source-over'

  }
  const backdropFn = useCallback((ctx: CanvasRenderingContext2D) => backdropRef.current(ctx), [])
  // the lamps as the scope sees them: where, what colour, how bright
  const paletteRef = useRef<() => Array<{ x: number; rgb: [number, number, number]; k: number }>>(() => [])
  paletteRef.current = () => graph.nodes
    .filter(n => !isUtilityType(n.type) && live.has(n.id))
    .map(n => ({ x: toScreen(n).x, rgb: tintOf(n.type, n.variant), k: lamps.current.get(n.id)?.k ?? 0 }))
  const paletteFn = useCallback(() => paletteRef.current(), [])

  // ── presets: the wall's patches as files, FabFilter-style bar ──────
  const [presets, setPresets] = useState<string[]>([])
  const [preset, setPreset] = useState<string | null>(null)      // the loaded one
  const [savedJson, setSavedJson] = useState<string>('')           // to know when the wall drifted
  const [listOpen, setListOpen] = useState(false)
  const [naming, setNaming] = useState(false)
  const refreshPresets = useCallback(() => { void listPresets().then(setPresets) }, [])
  useEffect(() => { refreshPresets() }, [refreshPresets])
  const graphKey = (g: FxGraph) => JSON.stringify({ n: g.nodes.map(n => ({ ...n, x: 0, y: 0 })), e: g.edges })
  const dirty = preset !== null && savedJson !== '' && graphKey(graph) !== savedJson
  const doSave = async (name: string) => {
    const clean = name.trim().toLowerCase().replace(/[\\/:*?"<>|]/g, '').slice(0, 48)
    if (!clean) return
    const g = JSON.parse(JSON.stringify(graphRef.current)) as FxGraph
    if (await savePreset(clean, g)) { setPreset(clean); setSavedJson(graphKey(g)); refreshPresets() }
    setNaming(false); setListOpen(false)
  }
  const doLoad = async (name: string) => {
    const g = await loadPreset(name); if (!g) return
    const placed = settle(g, size.w, size.h)
    commit(placed, true); setPreset(name); setSavedJson(graphKey(placed)); setSel(null); setConfirm(null); setListOpen(false)
  }
  const doDelete = async (name: string) => {
    if (await deletePreset(name)) { if (preset === name) { setPreset(null); setSavedJson('') } refreshPresets() }
    setConfirm(null)
  }
  // "save as…" and "open…" as the OS panels when the plugin can show them
  const doSaveAs = async () => {
    if (!hasPresetDialogs()) { setNaming(true); return }
    setListOpen(false)
    const g = JSON.parse(JSON.stringify(graphRef.current)) as FxGraph
    const name = await savePresetDialog(g, preset && !isFactory(preset) ? preset : 'untitled')
    if (name) { setPreset(name); setSavedJson(graphKey(g)); refreshPresets() }
  }
  const doOpen = async () => {
    setListOpen(false)
    const r = await openPresetDialog(); if (!r) return
    const placed = settle(r.graph, size.w, size.h)
    commit(placed, true); setPreset(r.name); setSavedJson(graphKey(placed)); setSel(null); setConfirm(null); refreshPresets()
  }
  // built in, everywhere, cannot be removed: the empty wall
  const FACTORY: Array<{ name: string; graph: () => FxGraph }> = [
    { name: 'initial', graph: () => ({ nodes: [], edges: [{ from: FX_PORT_IN, to: FX_PORT_OUT, gain: 1 }] }) },
  ]
  const isFactory = (name: string) => FACTORY.some(f => f.name === name)
  const loadFactory = (name: string) => {
    const f = FACTORY.find(x => x.name === name); if (!f) return
    const g = f.graph()
    commit(g, true); setPreset(name); setSavedJson(graphKey(g)); setSel(null); setConfirm(null); setListOpen(false)
  }
  const allNames = [...FACTORY.map(f => f.name), ...presets.filter(n => !isFactory(n))]
  const stepPreset = (dir: 1 | -1) => {
    if (allNames.length === 0) return
    const i = preset ? allNames.indexOf(preset) : -1
    const next = allNames[(i + dir + allNames.length) % allNames.length]
    if (isFactory(next)) loadFactory(next); else void doLoad(next)
  }
  const topBar = typeof document !== 'undefined' ? document.querySelector('.plugin.sounds > .top-bar') : null

  // ── the scope: input / output traces in the wall's corner ─────────
  const [scope, setScope] = useState<{ input: boolean; output: boolean; gain: number; windowS: number }>(() => {
    const d = { input: false, output: false, gain: 1, windowS: 0.16 }
    try { const v = JSON.parse(localStorage.getItem('orb_wall_scope') || 'null'); return v ? { ...d, input: !!v.input, output: !!v.output, gain: Number(v.gain) || 1, windowS: Number(v.windowS) || 0.16 } : d } catch { return d }
  })
  const scopeHand = useRef<{ which: 'gain' | 'window'; y0: number; v0: number } | null>(null)
  const onScopeHandMove = (e: React.PointerEvent) => {
    const h = scopeHand.current; if (!h) return
    const f = Math.exp((h.y0 - e.clientY) / 90)
    if (h.which === 'gain') setScope(v => ({ ...v, gain: Math.min(16, Math.max(0.25, h.v0 * f)) }))
    else setScope(v => ({ ...v, windowS: Math.min(2, Math.max(0.02, h.v0 / f)) }))
  }
  const fmtWindow = (w: number) => (w >= 1 ? `${w.toFixed(1)}s` : `${Math.round(w * 1000)}ms`)
  useEffect(() => {
    setScopeInput(scope.input)
    try { localStorage.setItem('orb_wall_scope', JSON.stringify(scope)) } catch { /* fine */ }
  }, [scope])
  useEffect(() => () => setScopeInput(false), [])
  const inkRgb = strokeFor(litLevel)

  const patchBar = topBar && createPortal(
    <div className="sg-presetbar" style={inkVars} onPointerDown={(e) => e.stopPropagation()}>
      <span className="sg-preset-arrow" onPointerDown={() => stepPreset(-1)} aria-label="previous preset">‹</span>
      <div className={`sg-preset-box${listOpen ? ' open' : ''}`} onPointerDown={() => { setListOpen(v => !v); setNaming(false); setConfirm(null) }}>
        <span className="sg-preset-name">{preset ?? 'untitled'}{dirty ? ' *' : ''}</span>
        <span className="sg-preset-caret">▾</span>
      </div>
      <span className="sg-preset-arrow" onPointerDown={() => stepPreset(1)} aria-label="next preset">›</span>
      {listOpen && (
        <div className="sg-preset-list" onPointerDown={(e) => e.stopPropagation()}>
          {FACTORY.map(f => (
            <div key={f.name} className={`sg-preset-row factory${preset === f.name ? ' on' : ''}`}>
              <span className="sg-preset-row-name" onPointerDown={() => loadFactory(f.name)}>{f.name}</span>
            </div>
          ))}
          <div className="sg-preset-rule" />
          {presets.length === 0 && !naming && <div className="sg-preset-empty">no presets yet</div>}
          {presets.filter(n => !isFactory(n)).map(name => (
            <div key={name} className={`sg-preset-row${preset === name ? ' on' : ''}`}>
              <span className="sg-preset-row-name" onPointerDown={() => void doLoad(name)}>{name}</span>
              <span className="sg-word quiet" onPointerDown={() => { if (confirm === `preset:${name}`) void doDelete(name); else setConfirm(`preset:${name}`) }}>
                {confirm === `preset:${name}` ? 'sure?' : 'remove'}
              </span>
            </div>
          ))}
          <div className="sg-preset-actions">
            {preset && !isFactory(preset) && <span className="sg-word" onPointerDown={() => void doSave(preset)}>save</span>}
            {naming
              ? <input className="sg-preset-input" autoFocus placeholder="name" defaultValue={preset ?? ''}
                  onKeyDown={(e) => { if (e.key === 'Enter') void doSave((e.currentTarget as HTMLInputElement).value); if (e.key === 'Escape') setNaming(false) }}
                  onBlur={(e) => { if (e.currentTarget.value.trim()) void doSave(e.currentTarget.value); else setNaming(false) }} />
              : <span className="sg-word" onPointerDown={() => void doSaveAs()}>save as…</span>}
            {hasPresetDialogs() && <span className="sg-word" onPointerDown={() => void doOpen()}>open…</span>}
          </div>
        </div>
      )}
    </div>,
    topBar,
  )

  return (
    <StrokeLevel.Provider value={null}>
    {patchBar}
    <div className="sg-frame" style={inkVars}>
    <div className="sg-left">
      <div
        ref={wallRef}
        className={`sg-wall${drag ? ` dragging ${drag.kind}` : ''}`}
        onPointerMove={onWallMove}
        onPointerUp={onWallUp}
        onPointerDown={(e) => {
          // a wire under the pointer? (the wires are painted, not DOM)
          const p = wallPt(e)
          let hit = -1, best = 9
          graph.edges.forEach((ed, i) => { const d = distToWire(outPortOf(ed.from, ed.port ?? 0), inPortOf(ed.to, i), p); if (d < best) { best = d; hit = i } })
          setConfirm(null); setListOpen(false)
          if (hit >= 0) { setSel({ edge: hit }); return }
          setSel(null)
          setDrag({ kind: 'pan', x0: e.clientX, y0: e.clientY, px: pan.x, py: pan.y })
        }}
        onDoubleClick={(e) => {
          // home: an empty-wall double-tap brings the flow back to 1× centred
          if ((e.target as Element).closest('.sg-node, .sg-wire, .sg-port, .sg-share, .sg-word')) return
          setPan({ x: 0, y: 0 }); setZoom(1)
          try { localStorage.setItem('orb_wall_pan', '{"x":0,"y":0}'); localStorage.setItem('orb_wall_zoom', '1') } catch { /* fine */ }
        }}
      >
        {/* the wall's backdrop: the signal itself, moving, under the prints */}
        <div className="sg-scope-bg">
          <FxScope input={scope.input} output={scope.output} width={size.w} height={size.h} ink={inkRgb} accent={BLUE_INK} gain={scope.gain} windowS={scope.windowS} overlay={overlayFn} backdrop={backdropFn} palette={paletteFn} />
        </div>
        <svg className="sg-wires" viewBox={`0 0 ${size.w} ${size.h}`} width={size.w} height={size.h}>
          {graph.edges.map((e, i) => {
            const p0 = outPortOf(e.from, e.port ?? 0), p1 = inPortOf(e.to, i)
            const isSel = sel?.edge === i
            const target = nodeById(e.to)
            const mixIn = target?.type === FX_MIX_TYPE
            const label = mixIn || Math.abs(e.gain - 1) > 0.005
            const lp = wireAt(p0, p1, mixIn ? 0.86 : 0.5)
            return (
              <g key={i} className={`sg-wire${isSel ? ' sel' : ''}`}>
                {label && (
                  <text className="sg-share" x={lp.x} y={lp.y - 7} textAnchor="middle"
                    onPointerDown={(ev) => { ev.stopPropagation(); setSel({ edge: i }); setDrag({ kind: 'share', edge: i, y0: ev.clientY, g0: e.gain }) }}
                    onDoubleClick={(ev) => { ev.stopPropagation(); setShare(i, mixIn ? 1 / Math.max(1, inputsOf(e.to).length) : 1, true) }}>
                    {mixIn && <tspan className="sg-share-who">{e.from === FX_PORT_IN ? 'in' : nameOf(nodeById(e.from)?.type ?? -1)} </tspan>}
                    {Math.round(e.gain * 100)}
                  </text>
                )}
                {isSel && (
                  <text className="sg-word" x={lp.x} y={lp.y + 16} textAnchor="middle"
                    onPointerDown={(ev) => { ev.stopPropagation(); if (confirm === `edge:${i}`) removeEdge(i); else setConfirm(`edge:${i}`) }}>
                    {confirm === `edge:${i}` ? 'sure?' : 'remove'}
                  </text>
                )}
              </g>
            )
          })}
          {drag?.kind === 'wire' && <path className="sg-wire-line ghost" d={wirePath(outPortOf(drag.from, drag.port), drag.at)} />}
          <circle cx={inPort.x} cy={inPort.y} r={4} className="sg-port" onPointerDown={startWire(FX_PORT_IN)} />
          {/* a wide, invisible grab area around the in port — the dot stays small */}
          <circle cx={inPort.x} cy={inPort.y} r={16} fill="transparent" stroke="none" style={{ cursor: 'crosshair', pointerEvents: 'all' }} onPointerDown={startWire(FX_PORT_IN)} />
          <circle cx={outPort.x} cy={outPort.y} r={4} className="sg-port" />
          <text x={inPort.x} y={inPort.y + 22} textAnchor="middle" className="sg-io">in</text>
          <text x={outPort.x} y={outPort.y + 22} textAnchor="middle" className="sg-io">out</text>
        </svg>

        {graph.nodes.map(n => {
          const isSel = sel?.node === n.id
          const isMix = n.type === FX_MIX_TYPE
          const isUtil = isUtilityType(n.type)
          const flavours = isMix ? ['blend', 'sum'] : VARIANTS[n.type] ?? []
          const ins = inputsOf(n.id)
          const c = toScreen(n)
          return (
            <div key={n.id} data-id={n.id} className={`sg-node${isSel ? ' sel' : ''}${live.has(n.id) ? '' : ' off'}${n.bypass ? ' bypassed' : ''}`}
              style={{ left: c.x - Rz, top: c.y - Rz, width: NODEz, height: NODEz }}
              onPointerDown={startMove(n)}>
              {/* the print: drag it anywhere on the wall; its number is the hand */}
              <div className="sg-print"
                onClick={(e) => { if ((e.metaKey || e.ctrlKey) && !isUtil) { e.stopPropagation(); updateNode(n.id, { bypass: !n.bypass }, true) } }}
                onDoubleClick={() => { if (!isUtil) updateNode(n.id, { amount: neutralOf(n.type) }, true) }}>
                <Print node={n} size={NODEz} shares={sharesOf(n.id)}
                  onDecay={(v, force) => { const d = [...n.decay]; d[n.variant] = Math.min(1, Math.max(0, v)); updateNode(n.id, { decay: d }, !!force) }}
                  onDiv={(v) => updateNode(n.id, { delayDiv: v }, true)}
                  onFb={(v, force) => updateNode(n.id, { delayFb: Math.min(1, Math.max(0, v)) }, !!force)}
                  onFlip={(bit) => updateNode(n.id, { variant: n.variant ^ bit }, true)} />
              </div>
              {/* bypass: ⌘-click the print (the study's switch does it too); no ring on the print */}
              {/* ports */}
              {isMix
                ? [...ins.map(x => x.i), -1].map((edgeIndex, k) => {
                    const p = inPortOf(n.id, edgeIndex)
                    return <span key={k} className={`sg-dot${edgeIndex < 0 ? ' spare' : ''}`} style={{ left: p.x - (c.x - Rz) - 2.5, top: p.y - (c.y - Rz) - 2.5 }} />
                  })
                : <span className="sg-dot l" />}
              {isSplitterType(n.type)
                ? [0, 1].map(port => {
                    const p = outPortOf(n.id, port)
                    return <span key={port} className="sg-dot r" style={{ right: 'auto', left: p.x - (c.x - Rz) - 2.5, top: p.y - (c.y - Rz) - 2.5 }} onPointerDown={startWire(n.id, port)} />
                  })
                : <span className="sg-dot r" onPointerDown={startWire(n.id)} />}
              {/* under the print, scaled with it: caption, then the chosen print's words */}
              <div className="sg-under" style={{ transform: `translateX(-50%) scale(${capScale})` }}>
                <div className="sg-label">
                  <span className="sg-name">{nameOf(n.type)}</span>
                  {!isSel && flavours.length > 0 && <span className="sg-flav"> {n.type === 12 ? (TREM_PRESETS[n.aux[2] || 0]?.name ?? 'sine') : flavours[n.type === 5 ? 0 : n.variant] ?? ''}</span>}
                  {!isUtil && (
                    <span className="sg-val"
                      onPointerDown={(e) => { e.stopPropagation(); setSel({ node: n.id }); setConfirm(null); setDrag({ kind: 'amount', id: n.id, y0: e.clientY, a0: n.amount }) }}
                      onDoubleClick={(e) => { e.stopPropagation(); updateNode(n.id, { amount: neutralOf(n.type) }, true) }}
                      onWheel={(e) => { e.stopPropagation(); e.preventDefault(); updateNode(n.id, { amount: Math.min(1, Math.max(0, n.amount - wheelStep(e.deltaY))) }, true) }}>
                      {' '}{fmtValue(n.type, n.amount, n.variant)}
                    </span>
                  )}
                  {hands(n)}
                </div>
              </div>
            </div>
          )
        })}

        {drag?.kind === 'shelf' && (
          <div className="sg-ghost" style={{ left: drag.at.x - Rz, top: drag.at.y - Rz, width: NODEz, height: NODEz }}>
            <Print node={{ type: drag.type, amount: neutralOf(drag.type), variant: 0, decay: [0.5, 0.5, 0.5], delayDiv: 2, delayFb: 0.35, aux: [0, 0, 2] }} size={NODEz} dim />
          </div>
        )}

        {/* the scope's two words, bottom right (the traces fill the wall behind everything) */}
        <div className="sg-scope-corner" onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={onScopeHandMove} onPointerUp={() => { scopeHand.current = null }}>
          <div className="sg-scope-words">
            {(scope.input || scope.output) && (
              <>
                <span className="sg-val hand" title="vertical zoom"
                  onPointerDown={(e) => { scopeHand.current = { which: 'gain', y0: e.clientY, v0: scope.gain }; try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* fine */ } }}
                  onDoubleClick={() => setScope(v => ({ ...v, gain: 1 }))}
                  onWheel={(e) => { e.stopPropagation(); e.preventDefault(); setScope(v => ({ ...v, gain: Math.min(16, Math.max(0.25, v.gain * (e.deltaY < 0 ? 1.12 : 1 / 1.12))) })) }}>
                  ×{scope.gain >= 10 ? scope.gain.toFixed(0) : scope.gain.toFixed(1)}
                </span>
                <span className="sg-val hand" title="horizontal zoom"
                  onPointerDown={(e) => { scopeHand.current = { which: 'window', y0: e.clientY, v0: scope.windowS }; try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* fine */ } }}
                  onDoubleClick={() => setScope(v => ({ ...v, windowS: 0.16 }))}
                  onWheel={(e) => { e.stopPropagation(); e.preventDefault(); setScope(v => ({ ...v, windowS: Math.min(2, Math.max(0.02, v.windowS * (e.deltaY < 0 ? 1 / 1.15 : 1.15))) })) }}>
                  {fmtWindow(scope.windowS)}
                </span>
              </>
            )}
            <span className={`sg-word${scope.input ? ' on' : ''}`} onPointerDown={() => setScope(v => ({ ...v, input: !v.input }))}>input</span>
            <span className={`sg-word${scope.output ? ' on' : ''}`} onPointerDown={() => setScope(v => ({ ...v, output: !v.output }))}>output</span>
          </div>
        </div>

        {!loaded && <p className="fx-note sg-note">reading the wall…</p>}
        {error && <p className="fx-note sg-note">{error}</p>}
        {!bridge && !oldEngine && <p className="fx-note sg-note">browser mode — the audio itself runs inside the daw.</p>}
        {oldEngine && <p className="fx-note sg-note">this room grew a wall — rebuild the plugin to patch it.</p>}
        {scope.input && hasFxBridge() && !hasJuceNativeFunction('setScopeInput') && <p className="fx-note sg-note">the input trace needs the newer plugin — restart the daw.</p>}
      </div>

      {/* the shelf's handle: a tab on its rule; it rides down with the drawer */}
      <button type="button" className={`sg-shelf-tab${shelfOpen ? '' : ' closed'}`} style={{ bottom: shelfOpen ? shelf.height - 13 : 10 }}
        title={shelfOpen ? 'put the shelf away' : 'bring the shelf out'} aria-label={shelfOpen ? 'put the shelf away' : 'bring the shelf out'}
        onPointerDown={(e) => e.stopPropagation()} onClick={toggleShelf}>
        <svg viewBox="0 0 12 12" width="12" height="12"><path d="M2.5 4.5 L6 8 L9.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <div ref={shelfRef} className={`sg-shelf${full ? ' full' : ''}${shelfOpen ? '' : ' closed'}${shelfMore ? ' more' : ''}`} style={{ gap: shelf.gap, height: shelfOpen ? shelf.height : 0 }}>
        <span className="sg-shelf-fam" onPointerDown={(e) => e.stopPropagation()} onPointerLeave={() => setFamHover(-1)}
          onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setFamHover(Math.min(FAMILIES.length - 1, Math.max(0, Math.floor((e.clientX - r.left) / r.width * FAMILIES.length)))) }}>
          <Cells options={FAMILIES.map(f => f[0])} value={shelfFam} hue={3} hover={famHover} width={FAM_W} onCell={(i, e) => { e.stopPropagation(); pickFam(i) }} />
        </span>
        {shelfTypes.map(type => (
          <div key={type} className="sg-shelf-item"
            onPointerDown={(e) => { if (full) return; e.preventDefault(); setDrag({ kind: 'shelf', type, at: wallPt(e) }) }}>
            <Print node={{ type, amount: type === 0 || type === 16 || type === 17 ? 0.5 : type === 5 ? 0.75 : 0.3, variant: 0, decay: [0.5, 0.5, 0.5], delayDiv: 2, delayFb: 0.35, aux: [12, 0, 2] }} size={shelfPrint} dim shares={[0.5, 0.5]} />
            <span>{nameOf(type)}</span>
          </div>
        ))}
      </div>
    </div>
    {studyNode && topBar?.parentElement && createPortal(
      <aside ref={studyRef} className={`sg-study${studyOut ? ' out' : ''}`} style={{ ...inkVars, '--sg-tint': tintOf(studyNode.type, studyNode.variant).join(', '), width: STUDY_W } as React.CSSProperties} onPointerDown={(e) => e.stopPropagation()} onPointerMove={onWallMove} onPointerUp={onWallUp}>
        <div className="sg-study-head">
          <span className="sg-study-title">{nameOf(studyNode.type)}{studyNode.bypass ? <span className="sg-study-off"> off</span> : null}</span>
          <button type="button" className="sg-close" aria-label="close the study" title="close" onPointerDown={(e) => e.stopPropagation()} onClick={() => { setSel(null); setConfirm(null) }}>
            <svg viewBox="0 0 12 12" width="11" height="11"><path d="M2.5 2.5 L9.5 9.5 M9.5 2.5 L2.5 9.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="sg-study-body">
        <div className="sg-study-print"
          onPointerDown={(e) => {
            if ((e.target as Element).closest('.fx-hot')) return
            if (isUtilityType(studyNode.type)) return
            e.stopPropagation()
            try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* fine */ }
            setDrag({ kind: 'amount', id: studyNode.id, y0: e.clientY, a0: studyNode.amount })
          }}
          onPointerMove={(e) => {
            if (drag?.kind !== 'amount' || drag.id !== studyNode.id) return
            updateNode(drag.id, { amount: Math.min(1, Math.max(0, drag.a0 + (drag.y0 - e.clientY) / 190)) })
          }}
          onPointerUp={() => { if (drag?.kind === 'amount') { push(graphRef.current, true); setDrag(null) } }}
          onClick={(e) => { if ((e.metaKey || e.ctrlKey) && !isUtilityType(studyNode.type)) { e.stopPropagation(); updateNode(studyNode.id, { bypass: !studyNode.bypass }, true) } }}
          onDoubleClick={() => { if (!isUtilityType(studyNode.type)) updateNode(studyNode.id, { amount: neutralOf(studyNode.type) }, true) }}
          onWheel={(e) => { if (isUtilityType(studyNode.type)) return; e.stopPropagation(); e.preventDefault(); updateNode(studyNode.id, { amount: Math.min(1, Math.max(0, studyNode.amount - wheelStep(e.deltaY))) }, true) }}>
          <Print node={studyNode} size={STUDY_PRINT} shares={sharesOf(studyNode.id)}
            onDecay={(v, force) => { const d = [...studyNode.decay]; d[studyNode.variant] = Math.min(1, Math.max(0, v)); updateNode(studyNode.id, { decay: d }, !!force) }}
            onDiv={(v) => updateNode(studyNode.id, { delayDiv: v }, true)}
            onFb={(v, force) => updateNode(studyNode.id, { delayFb: Math.min(1, Math.max(0, v)) }, !!force)}
            onFlip={(bit) => updateNode(studyNode.id, { variant: studyNode.variant ^ bit }, true)} />
        </div>
        <div className="sg-study-value">
          {isSplitterType(studyNode.type) ? null : studyNode.type !== FX_MIX_TYPE
            ? <StudyValue text={fmtValue(studyNode.type, studyNode.amount, studyNode.variant)}
                parse={(s) => parseAmount(studyNode.type, s, studyNode.variant)}
                commit={(a) => updateNode(studyNode.id, { amount: a }, true)}
                reset={() => updateNode(studyNode.id, { amount: neutralOf(studyNode.type) }, true)}
                onPointerDown={(e) => { e.stopPropagation(); grab(e); setDrag({ kind: 'amount', id: studyNode.id, y0: e.clientY, a0: studyNode.amount }) }}
                onWheelDelta={(dy) => updateNode(studyNode.id, { amount: Math.min(1, Math.max(0, studyNode.amount - wheelStep(dy))) }, true)} />
            : <span className="sg-study-mixnote">{inputsOf(studyNode.id).length === 0 ? 'nothing wired in yet' : studyNode.variant === 0 ? 'the shares blend to 100' : 'the shares add up'}</span>}
        </div>
        <div className="sg-study-rows">{studyRows(studyNode)}</div>
        <div className="sg-study-foot">
          <button type="button" className={`sg-key${confirm === `node:${studyNode.id}` ? ' armed' : ''}`}
            onPointerDown={(e) => { e.stopPropagation(); if (confirm === `node:${studyNode.id}`) removeNode(studyNode.id); else setConfirm(`node:${studyNode.id}`) }}>
            {confirm === `node:${studyNode.id}` ? 'sure?' : 'remove'}
          </button>
        </div>
        </div>
      </aside>,
      topBar.parentElement,
    )}
    </div>
    </StrokeLevel.Provider>
  )
}
