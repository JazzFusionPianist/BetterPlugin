import React, { Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { ARTS, MODES, VARIANTS, WALL_TINTS, VARIANT_TINTS, wallColor, BLUE as BLUE_INK, strokeFor, fmtDecay, DIV_LABELS, baseShape, CURVE_LEN, KEY_NAMES, StrokeLevel } from './FxPanel'
import { hasJuceBridge } from '../../lib/juceBridge'
import { setPluginSize, suspendSharedWindowSize } from '../../lib/pluginWindow'
import FxScope from './FxScope'
import {
  getGraph, setGraph, hasGraphBridge, hasFxBridge, setScopeInput,
  FX_MIX_TYPE, FX_PORT_IN, FX_PORT_OUT, FX_MAX_NODES,
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
const STUDY_PRINT = 300
const R = NODE / 2
const SHELF_PRINT = 48
const PORT_INSET = 64          // in/out ports sit this far from the wall's edges
const SNAP_WIRE = 26           // drop a print this close to a wire to splice it in
const WET_TYPES = new Set<number>([2, 10, 9, 6, 15])   // space, delay, doubler, mod, harmony

type Pt = { x: number; y: number }
type Drag =
  | { kind: 'amount'; id: number; y0: number; a0: number }
  | { kind: 'move'; id: number; dx: number; dy: number }
  | { kind: 'wire'; from: number; at: Pt }
  | { kind: 'share'; edge: number; y0: number; g0: number }
  | { kind: 'hand'; id: number; hand: 'decay' | 'div' | 'fb' | 'aux0' | 'aux1' | 'aux2'; y0: number; v0: number }
  | { kind: 'shelf'; type: number; at: Pt }
  | { kind: 'pan'; x0: number; y0: number; px: number; py: number }

const uid = () => Math.random().toString(36).slice(2, 8)
void uid

function tintOf (type: number, variant = 0): [number, number, number] {
  if (type === FX_MIX_TYPE) return [246, 243, 234]
  return VARIANT_TINTS[type]?.[variant] ?? WALL_TINTS[type] ?? [246, 243, 234]
}
const neutralOf = (type: number) => (type === 0 ? 0.5 : type === 5 ? 0.75 : 0)
const nameOf = (type: number) => (type === FX_MIX_TYPE ? 'mix' : MODES.find(m => m.id === type)?.name ?? '')

function fmtValue (type: number, a: number, variant = 0): string {
  if (type === 13) return `${Math.round(a * 24)}st`
  if (type === 0) { const t = Math.round((a - 0.5) * 200); return t === 0 ? '0' : t > 0 ? `+${t}` : `${t}` }
  if (type === 5) { const db = a < 0.75 ? (a / 0.75 - 1) * 60 : (a - 0.75) * 48; return `${db > 0 ? '+' : db < 0 ? '−' : ''}${Math.abs(db).toFixed(1)}` }
  if (type === 7) {
    if (variant === 2) return `${(0.3 + (1 - a) * 9).toFixed(1)}oct`
    const hz = variant === 0 ? 20 * Math.pow(2, a * 8) : 20000 * Math.pow(2, -a * 8.3)
    return hz >= 1000 ? `${(hz / 1000).toFixed(1)}k` : `${Math.round(hz)}`
  }
  return `${Math.round(a * 100)}`
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
  const nodes = g.nodes.map((n, i) => ({ ...n, aux: n.aux ?? [0, 0, 0], ...((n.x === 0 && n.y === 0) ? { x: w * (0.3 + 0.2 * i), y: h / 2 } : {}) }))
  const edges = g.edges.length ? g.edges : [{ from: FX_PORT_IN, to: FX_PORT_OUT, gain: 1 }]
  return { nodes, edges }
}

const MIX_FAN = 26   // degrees between a mix print's input ports

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

function Print ({ node, size, dim, onDecay, onDiv, onFb, onFlip, onDraw, shares }: {
  node: Pick<FxGraphNode, 'type' | 'amount' | 'variant' | 'decay' | 'delayDiv' | 'delayFb' | 'aux'> & { curve?: number[] }
  size: number
  dim?: boolean
  shares?: number[]
  onDecay?: (v: number, force?: boolean) => void
  onDiv?: (v: number) => void
  onFb?: (v: number, force?: boolean) => void
  onFlip?: (bit: number) => void
  onDraw?: (index: number, value: number, done?: boolean) => void
}) {
  const { type, amount: a, variant } = node
  const t = tintOf(type, variant)
  const glow = dim || type === FX_MIX_TYPE ? 'none'
    : `drop-shadow(0 0 ${6 + a * 22}px rgba(${t[0]}, ${t[1]}, ${t[2]}, ${(0.25 + a * 0.5).toFixed(2)}))`
  const Art = ARTS[type]
  return (
    <svg viewBox="0 0 220 220" width={size} height={size} style={{ filter: glow, overflow: 'visible', display: 'block' }}>
      {type === FX_MIX_TYPE ? <MixArt shares={shares ?? []} />
        : type === 2 ? <Art a={a} variant={variant} decay={node.decay[variant] ?? 0.5} onDecay={onDecay} />
        : type === 10 ? <Art a={a} div={node.delayDiv} fb={node.delayFb} onDiv={onDiv} onFb={onFb} />
        : type === 7 ? <Art a={a} variant={variant} />
        : type === 5 ? <Art a={a} pol={variant} onFlip={onFlip} />
        : type === 12 ? <Art a={a} variant={variant} curve={node.curve} onDraw={onDraw} />
        : type === 13 ? <Art a={a} variant={variant} interval={node.aux[0] || 12} />
        : type === 15 ? <Art a={a} degrees={node.aux[2]} keyRoot={node.aux[0]} scale={node.aux[1]} chromatic={variant === 1} />
        : <Art a={a} />}
    </svg>
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
  const bridge = useMemo(() => hasGraphBridge(), [])
  const oldEngine = useMemo(() => !hasGraphBridge() && hasFxBridge(), [])
  const [graph, setGraphState] = useState<FxGraph>(() => demoGraph(frame.w, frame.h))
  const [loaded, setLoaded] = useState(!bridge)
  const [sel, setSel] = useState<{ node?: number; edge?: number } | null>(null)
  // the study opens with a chosen print; the wall keeps its width by
  // growing the host window (restored on close), or gives up room in a
  // plain browser
  const studyOpen = sel?.node !== undefined
  const size = { w: frame.w - (studyOpen ? STUDY_W : 0), h: frame.h }
  const grown = useRef<{ w: number; h: number } | null>(null)
  useEffect(() => {
    if (!hasJuceBridge) return
    if (studyOpen && !grown.current) {
      grown.current = { w: window.innerWidth, h: window.innerHeight }
      suspendSharedWindowSize(true)
      try { localStorage.setItem('orb_wall_grown', JSON.stringify({ base: grown.current, w: grown.current.w + STUDY_W })) } catch { /* fine */ }
      void setPluginSize(grown.current.w + STUDY_W, grown.current.h)
    } else if (!studyOpen && grown.current) {
      const base = grown.current; grown.current = null
      void setPluginSize(base.w, base.h).then(() => suspendSharedWindowSize(false))
      try { localStorage.removeItem('orb_wall_grown') } catch { /* fine */ }
    }
  }, [studyOpen])
  // reopened while grown last time (the study was open when the window
  // closed)? come back to the base size first
  useEffect(() => {
    if (!hasJuceBridge) return
    try {
      const raw = localStorage.getItem('orb_wall_grown'); if (!raw) return
      const g = JSON.parse(raw) as { base: { w: number; h: number }; w: number }
      if (g?.base && Math.abs(window.innerWidth - g.w) < 4) void setPluginSize(g.base.w, g.base.h)
      localStorage.removeItem('orb_wall_grown')
    } catch { /* fine */ }
  }, [])
  useEffect(() => () => { if (grown.current) { const b = grown.current; void setPluginSize(b.w, b.h); suspendSharedWindowSize(false) } }, [])
  const [confirm, setConfirm] = useState<string | null>(null)   // 'node:3' | 'edge:2' awaiting the second tap
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
        if (!n || n.type === FX_MIX_TYPE) return
        updateNodeRef.current(id, { amount: Math.min(1, Math.max(0, n.amount - Math.sign(e.deltaY) * 0.02)) }, true)
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
  const outPortOf = (id: number): Pt => {
    if (id === FX_PORT_IN) return { x: inPort.x + 6, y: inPort.y }
    const n = nodeById(id); if (!n) return inPort
    const c = toScreen(n); return { x: c.x + Rz, y: c.y }
  }

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

  // ── wall colour: the loudest hand on the wall lights the room ───────
  // Not a blend (four tints average to mud) and not the selection: the
  // live print whose hand is furthest from rest paints the wall in its
  // own tint, as bright as that hand. Every other print keeps its glow.
  const intensityOf = (n: FxGraphNode) =>
    n.type === 0 ? Math.abs(n.amount - 0.5) * 2
    : n.type === 5 ? (n.amount < 0.75 ? (0.75 - n.amount) / 0.75 : (n.amount - 0.75) / 0.25)
    : n.amount
  const lit = graph.nodes
    .filter(n => n.type !== FX_MIX_TYPE && live.has(n.id))
    .reduce<FxGraphNode | null>((best, n) => (!best || intensityOf(n) > intensityOf(best)) ? n : best, null)
  const litLevel = lit ? Math.min(1, intensityOf(lit)) : 0
  // the wall's ink at every alpha the stylesheet uses — plain rgba, no
  // color-mix (older WebKit inside the DAW)
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
    el.style.setProperty('--fx-wall', lit ? wallColor(lit.type as FxMode, lit.variant, litLevel) : 'rgb(22, 20, 16)')
    return () => { el.style.removeProperty('--fx-wall') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lit?.type, lit?.variant, litLevel])

  // ── structure edits ────────────────────────────────────────────────
  const freeId = () => { for (let i = 0; i < FX_MAX_NODES; i++) if (!graph.nodes.some(n => n.id === i)) return i; return -1 }

  const addNode = (type: number, at: Pt) => {
    const id = freeId(); if (id < 0) return
    const gp = toGraph(at)
    const aux = type === 13 ? [12, 0, 0] : type === 15 ? [0, 0, 2] : [0, 0, 0]   // arp: octave steps; harmony: C major, a third
    const node: FxGraphNode = { id, type, amount: neutralOf(type), variant: 0, decay: [0.5, 0.5, 0.5], delayDiv: 2, delayFb: 0.35, wet: false, aux, x: gp.x, y: gp.y }
    let edges = graph.edges
    // dropped onto a wire? splice in
    let best = -1, bestD = SNAP_WIRE
    graph.edges.forEach((e, i) => {
      const d = distToWire(outPortOf(e.from), inPortOf(e.to, i), at)
      if (d < bestD * Math.max(0.6, zoom)) { bestD = d; best = i }
    })
    if (best >= 0) {
      const e = graph.edges[best]
      edges = [...edges.slice(0, best), { from: e.from, to: id, gain: e.gain }, { from: id, to: e.to, gain: 1 }, ...edges.slice(best + 1)]
    }
    commit({ nodes: [...graph.nodes, node], edges }, true)
    setSel({ node: id })
  }

  const removeNode = (id: number) => {
    commit({ nodes: graph.nodes.filter(n => n.id !== id), edges: graph.edges.filter(e => e.from !== id && e.to !== id) }, true)
    setSel(null); setConfirm(null)
  }
  const removeEdge = (i: number) => {
    commit({ ...graph, edges: graph.edges.filter((_, k) => k !== i) }, true)
    setSel(null); setConfirm(null)
  }

  const connect = (from: number, to: number) => {
    if (from === to) return
    if (to === FX_PORT_IN || from === FX_PORT_OUT) return
    if (graph.edges.some(e => e.from === from && e.to === to)) return
    const target = to === FX_PORT_OUT ? null : nodeById(to)
    // one wire per plain input; out takes one
    if (to === FX_PORT_OUT ? graph.edges.some(e => e.to === FX_PORT_OUT) : target && target.type !== FX_MIX_TYPE && graph.edges.some(e => e.to === to)) {
      setError('that input already has a wire'); setTimeout(() => setError(null), 1600); return
    }
    // a mix in blend mode shares 100 across its wires
    let gain = 1
    if (target && target.type === FX_MIX_TYPE && target.variant === 0) {
      const ins = graph.edges.filter(e => e.to === to)
      gain = 1 / (ins.length + 1)
      const rescale = ins.length / (ins.length + 1)
      const edges = graph.edges.map(e => e.to === to ? { ...e, gain: e.gain * rescale } : e)
      commit({ ...graph, edges: [...edges, { from, to, gain }] }, true)
      return
    }
    commit({ ...graph, edges: [...graph.edges, { from, to, gain }] }, true)
  }

  /** Drag a share number: blend keeps the mix's wires summing to 100. */
  const setShare = (edgeIndex: number, gain: number, immediate = false) => {
    const e = graph.edges[edgeIndex]; if (!e) return
    const target = nodeById(e.to)
    const g = Math.min(2, Math.max(0, gain))
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
        const k = drag.hand === 'aux0' ? 0 : drag.hand === 'aux1' ? 1 : 2
        let v = Math.round(drag.v0 + dy / 18)
        if (n.type === 13) v = Math.min(12, Math.max(1, v))
        else if (n.type === 15 && k === 0) v = ((v % 12) + 12) % 12
        else if (n.type === 15 && k === 2) v = n.variant === 1 ? Math.min(12, Math.max(-12, v)) : Math.min(7, Math.max(-7, v))
        const aux = [...n.aux]; aux[k] = v
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
      if (hit) connect(drag.from, hit.id)
      else if (Math.hypot(outPort.x - p.x, outPort.y - p.y) <= 28) connect(drag.from, FX_PORT_OUT)
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

  const startWire = (from: number) => (e: RPointerEvent) => {
    e.stopPropagation()
    setDrag({ kind: 'wire', from, at: wallPt(e) })
  }

  // ── render ─────────────────────────────────────────────────────────
  const sharesOf = (id: number) => inputsOf(id).map(x => x.e.gain)
  const full = graph.nodes.length >= FX_MAX_NODES
  // the shelf fits sixteen prints in whatever width the wall has left
  const shelfPrint = Math.max(30, Math.min(SHELF_PRINT, Math.floor((size.w - 48) / 16) - 12))


  const studyNode = studyOpen ? nodeById(sel!.node!) : undefined

  // ── the scope: input / output traces in the wall's corner ─────────
  const [scope, setScope] = useState<{ input: boolean; output: boolean }>(() => {
    try { const v = JSON.parse(localStorage.getItem('orb_wall_scope') || 'null'); return v ? { input: !!v.input, output: !!v.output } : { input: false, output: false } } catch { return { input: false, output: false } }
  })
  useEffect(() => {
    setScopeInput(scope.input)
    try { localStorage.setItem('orb_wall_scope', JSON.stringify(scope)) } catch { /* fine */ }
  }, [scope])
  useEffect(() => () => setScopeInput(false), [])
  const inkRgb = strokeFor(litLevel)

  return (
    <StrokeLevel.Provider value={litLevel}>
    <div className="sg-frame" style={inkVars}>
    <div className="sg-left">
      <div
        ref={wallRef}
        className={`sg-wall${drag ? ` dragging ${drag.kind}` : ''}`}
        onPointerMove={onWallMove}
        onPointerUp={onWallUp}
        onPointerDown={(e) => { setSel(null); setConfirm(null); setDrag({ kind: 'pan', x0: e.clientX, y0: e.clientY, px: pan.x, py: pan.y }) }}
        onDoubleClick={(e) => {
          // home: an empty-wall double-tap brings the flow back to 1× centred
          if ((e.target as Element).closest('.sg-node, .sg-wire, .sg-port, .sg-share, .sg-word')) return
          setPan({ x: 0, y: 0 }); setZoom(1)
          try { localStorage.setItem('orb_wall_pan', '{"x":0,"y":0}'); localStorage.setItem('orb_wall_zoom', '1') } catch { /* fine */ }
        }}
      >
        <svg className="sg-wires" viewBox={`0 0 ${size.w} ${size.h}`} width={size.w} height={size.h}>
          {graph.edges.map((e, i) => {
            const p0 = outPortOf(e.from), p1 = inPortOf(e.to, i)
            const isSel = sel?.edge === i
            const target = nodeById(e.to)
            const mixIn = target?.type === FX_MIX_TYPE
            const label = mixIn || Math.abs(e.gain - 1) > 0.005
            const lp = wireAt(p0, p1, mixIn ? 0.86 : 0.5)
            return (
              <g key={i} className={`sg-wire${isSel ? ' sel' : ''}`}>
                <path className="sg-wire-hit" d={wirePath(p0, p1)}
                  onPointerDown={(ev) => { ev.stopPropagation(); setSel({ edge: i }); setConfirm(null) }} />
                <path className="sg-wire-line" d={wirePath(p0, p1)} />
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
          {drag?.kind === 'wire' && <path className="sg-wire-line ghost" d={wirePath(outPortOf(drag.from), drag.at)} />}
          <circle cx={inPort.x} cy={inPort.y} r={4} className="sg-port" onPointerDown={startWire(FX_PORT_IN)} />
          <circle cx={outPort.x} cy={outPort.y} r={4} className="sg-port" />
          <text x={inPort.x} y={inPort.y + 22} textAnchor="middle" className="sg-io">in</text>
          <text x={outPort.x} y={outPort.y + 22} textAnchor="middle" className="sg-io">out</text>
        </svg>

        {graph.nodes.map(n => {
          const isSel = sel?.node === n.id
          const isMix = n.type === FX_MIX_TYPE
          const flavours = isMix ? ['blend', 'sum'] : VARIANTS[n.type] ?? []
          const ins = inputsOf(n.id)
          const c = toScreen(n)
          return (
            <div key={n.id} data-id={n.id} className={`sg-node${isSel ? ' sel' : ''}${live.has(n.id) ? '' : ' off'}`}
              style={{ left: c.x - Rz, top: c.y - Rz, width: NODEz, height: NODEz }}
              onPointerDown={startMove(n)}>
              {/* the print: drag it anywhere on the wall; its number is the hand */}
              <div className="sg-print"
                onDoubleClick={() => { if (!isMix) updateNode(n.id, { amount: neutralOf(n.type) }, true) }}>
                <Print node={n} size={NODEz} shares={sharesOf(n.id)}
                  onDecay={(v, force) => { const d = [...n.decay]; d[n.variant] = Math.min(1, Math.max(0, v)); updateNode(n.id, { decay: d }, !!force) }}
                  onDiv={(v) => updateNode(n.id, { delayDiv: v }, true)}
                  onFb={(v, force) => updateNode(n.id, { delayFb: Math.min(1, Math.max(0, v)) }, !!force)}
                  onFlip={(bit) => updateNode(n.id, { variant: n.variant ^ bit }, true)}
                  onDraw={(i, v) => {
                    if (i === -2) { updateNode(n.id, { curve: undefined }, true); return }
                    if (i === -1) { push(graphRef.current, true); return }
                    const cur = graphRef.current.nodes.find(x => x.id === n.id)
                    const base = cur?.curve && cur.curve.length === CURVE_LEN ? [...cur.curve]
                      : Array.from({ length: CURVE_LEN }, (_, k) => baseShape(n.variant, k / CURVE_LEN))
                    base[i] = v
                    updateNode(n.id, { curve: base })
                  }} />
              </div>
              {/* ports */}
              {isMix
                ? [...ins.map(x => x.i), -1].map((edgeIndex, k) => {
                    const p = inPortOf(n.id, edgeIndex)
                    return <span key={k} className={`sg-dot${edgeIndex < 0 ? ' spare' : ''}`} style={{ left: p.x - (c.x - Rz) - 2.5, top: p.y - (c.y - Rz) - 2.5 }} />
                  })
                : <span className="sg-dot l" />}
              <span className="sg-dot r" onPointerDown={startWire(n.id)} />
              {/* under the print, scaled with it: caption, then the chosen print's words */}
              <div className="sg-under" style={{ transform: `translateX(-50%) scale(${capScale})` }}>
                <div className="sg-label">
                  <span className="sg-name">{nameOf(n.type)}</span>
                  {!isSel && flavours.length > 0 && <span className="sg-flav"> · {flavours[n.type === 5 ? 0 : n.variant] ?? ''}</span>}
                  {!isMix && (
                    <span className="sg-val"
                      onPointerDown={(e) => { e.stopPropagation(); setSel({ node: n.id }); setConfirm(null); setDrag({ kind: 'amount', id: n.id, y0: e.clientY, a0: n.amount }) }}
                      onDoubleClick={(e) => { e.stopPropagation(); updateNode(n.id, { amount: neutralOf(n.type) }, true) }}
                      onWheel={(e) => { e.stopPropagation(); e.preventDefault(); updateNode(n.id, { amount: Math.min(1, Math.max(0, n.amount - Math.sign(e.deltaY) * 0.02)) }, true) }}>
                      {' '}{fmtValue(n.type, n.amount, n.variant)}
                    </span>
                  )}
                  {/* the second hands, out here where they stay legible at any zoom */}
                  {n.type === 2 && (
                    <span className="sg-val hand"
                      onPointerDown={(e) => { e.stopPropagation(); setSel({ node: n.id }); setDrag({ kind: 'hand', id: n.id, hand: 'decay', y0: e.clientY, v0: n.decay[n.variant] ?? 0.5 }) }}
                      onDoubleClick={(e) => { e.stopPropagation(); const d = [...n.decay]; d[n.variant] = 0.5; updateNode(n.id, { decay: d }, true) }}>
                      {' · '}{fmtDecay(n.variant, n.decay[n.variant] ?? 0.5)}
                    </span>
                  )}
                  {n.type === 10 && (
                    <>
                      <span className="sg-val hand"
                        onPointerDown={(e) => { e.stopPropagation(); setSel({ node: n.id }); setDrag({ kind: 'hand', id: n.id, hand: 'div', y0: e.clientY, v0: n.delayDiv }) }}
                        onDoubleClick={(e) => { e.stopPropagation(); updateNode(n.id, { delayDiv: 2 }, true) }}>
                        {' · '}{DIV_LABELS[n.delayDiv] ?? '1/8'}
                      </span>
                      <span className="sg-val hand"
                        onPointerDown={(e) => { e.stopPropagation(); setSel({ node: n.id }); setDrag({ kind: 'hand', id: n.id, hand: 'fb', y0: e.clientY, v0: n.delayFb }) }}
                        onDoubleClick={(e) => { e.stopPropagation(); updateNode(n.id, { delayFb: 0.35, }, true) }}>
                        {' · fb '}{Math.round(n.delayFb * 100)}
                      </span>
                    </>
                  )}
                  {(n.type === 12 || n.type === 13) && (
                    <span className="sg-val hand"
                      onPointerDown={(e) => { e.stopPropagation(); setSel({ node: n.id }); setDrag({ kind: 'hand', id: n.id, hand: 'div', y0: e.clientY, v0: n.delayDiv }) }}
                      onDoubleClick={(e) => { e.stopPropagation(); updateNode(n.id, { delayDiv: 2 }, true) }}>
                      {' · '}{DIV_LABELS[n.delayDiv] ?? '1/8'}
                    </span>
                  )}
                  {n.type === 13 && (
                    <span className="sg-val hand"
                      onPointerDown={(e) => { e.stopPropagation(); setSel({ node: n.id }); setDrag({ kind: 'hand', id: n.id, hand: 'aux0', y0: e.clientY, v0: n.aux[0] || 12 }) }}
                      onDoubleClick={(e) => { e.stopPropagation(); const aux = [...n.aux]; aux[0] = 12; updateNode(n.id, { aux }, true) }}>
                      {' · step '}{n.aux[0] || 12}
                    </span>
                  )}
                  {n.type === 15 && n.variant !== 1 && (
                    <span className="sg-val hand"
                      onPointerDown={(e) => { e.stopPropagation(); setSel({ node: n.id }); setDrag({ kind: 'hand', id: n.id, hand: 'aux0', y0: e.clientY, v0: n.aux[0] }) }}>
                      {' · '}{KEY_NAMES[((n.aux[0] % 12) + 12) % 12]} {n.aux[1] === 1 ? 'minor' : 'major'}
                    </span>
                  )}
                  {n.type === 15 && (
                    <span className="sg-val hand"
                      onPointerDown={(e) => { e.stopPropagation(); setSel({ node: n.id }); setDrag({ kind: 'hand', id: n.id, hand: 'aux2', y0: e.clientY, v0: n.aux[2] }) }}
                      onDoubleClick={(e) => { e.stopPropagation(); const aux = [...n.aux]; aux[2] = n.variant === 1 ? 7 : 2; updateNode(n.id, { aux }, true) }}>
                      {' · '}{n.aux[2] > 0 ? '+' : ''}{n.aux[2]}{n.variant === 1 ? ' st' : n.aux[2] === 0 ? ' unison' : ''}
                    </span>
                  )}
                  {isMix && (
                    <span className="sg-val quiet">
                      {ins.length === 0 ? ' —' : ins.map(x => ` · ${x.e.from === FX_PORT_IN ? 'in' : nameOf(nodeById(x.e.from)?.type ?? -1)} ${Math.round(x.e.gain * 100)}`).join('')}
                    </span>
                  )}
                </div>
                {isSel && (
                  <div className="sg-words" onPointerDown={(e) => e.stopPropagation()}>
                    {n.type !== 5 && flavours.map((f, vi) => (
                      <span key={f} className={`sg-word${n.variant === vi ? ' on' : ''}`}
                        onPointerDown={() => updateNode(n.id, { variant: vi }, true)}>{f}</span>
                    ))}
                    {n.type === 12 && ['vol', 'pan'].map((w, k) => (
                      <span key={w} className={`sg-word${(n.aux[0] || 0) === k ? ' on' : ''}`}
                        onPointerDown={() => { const aux = [...n.aux]; aux[0] = k; updateNode(n.id, { aux }, true) }}>{w}</span>
                    ))}
                    {n.type === 15 && n.variant !== 1 && ['major', 'minor'].map((w, k) => (
                      <span key={w} className={`sg-word${(n.aux[1] || 0) === k ? ' on' : ''}`}
                        onPointerDown={() => { const aux = [...n.aux]; aux[1] = k; updateNode(n.id, { aux }, true) }}>{w}</span>
                    ))}
                    {WET_TYPES.has(n.type) && (
                      <span className={`sg-word${n.wet ? ' on' : ''}`} onPointerDown={() => updateNode(n.id, { wet: !n.wet }, true)}>wet</span>
                    )}
                    <span className="sg-word quiet"
                      onPointerDown={() => { if (confirm === `node:${n.id}`) removeNode(n.id); else setConfirm(`node:${n.id}`) }}>
                      {confirm === `node:${n.id}` ? 'sure?' : 'remove'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {drag?.kind === 'shelf' && (
          <div className="sg-ghost" style={{ left: drag.at.x - Rz, top: drag.at.y - Rz, width: NODEz, height: NODEz }}>
            <Print node={{ type: drag.type, amount: neutralOf(drag.type), variant: 0, decay: [0.5, 0.5, 0.5], delayDiv: 2, delayFb: 0.35, aux: [0, 0, 2] }} size={NODEz} dim />
          </div>
        )}

        {/* the scope and its two words, bottom right */}
        <div className="sg-scope-corner" onPointerDown={(e) => e.stopPropagation()}>
          {(scope.input || scope.output) && (
            <FxScope input={scope.input} output={scope.output} width={Math.min(360, Math.max(200, size.w * 0.32))} height={64} ink={inkRgb} accent={BLUE_INK} />
          )}
          <div className="sg-scope-words">
            <span className={`sg-word${scope.input ? ' on' : ''}`} onPointerDown={() => setScope(v => ({ ...v, input: !v.input }))}>input</span>
            <span className={`sg-word${scope.output ? ' on' : ''}`} onPointerDown={() => setScope(v => ({ ...v, output: !v.output }))}>output</span>
          </div>
        </div>

        {!loaded && <p className="fx-note sg-note">reading the wall…</p>}
        {error && <p className="fx-note sg-note">{error}</p>}
        {!bridge && !oldEngine && <p className="fx-note sg-note">browser mode — the audio itself runs inside the daw.</p>}
        {oldEngine && <p className="fx-note sg-note">this room grew a wall — rebuild the plugin to patch it.</p>}
      </div>

      <div className={`sg-shelf${full ? ' full' : ''}`} style={{ gap: shelfPrint < SHELF_PRINT ? 10 : 18 }}>
        {[...MODES.map(m => m.id as number), FX_MIX_TYPE].map(type => (
          <div key={type} className="sg-shelf-item"
            onPointerDown={(e) => { if (full) return; e.preventDefault(); setDrag({ kind: 'shelf', type, at: wallPt(e) }) }}>
            <Print node={{ type, amount: type === 0 ? 0.5 : type === 5 ? 0.75 : 0.3, variant: 0, decay: [0.5, 0.5, 0.5], delayDiv: 2, delayFb: 0.35, aux: [12, 0, 2] }} size={shelfPrint} dim shares={[0.5, 0.5]} />
            <span>{nameOf(type)}</span>
          </div>
        ))}
      </div>
    </div>
    {studyNode && (
      <aside className="sg-study" onPointerDown={(e) => e.stopPropagation()}>
        <div className="sg-study-head">
          <span className="sg-study-title">{nameOf(studyNode.type)}</span>
          <span className="sg-word quiet" onPointerDown={() => { setSel(null); setConfirm(null) }}>close</span>
        </div>
        <div className="sg-study-print"
          onPointerDown={(e) => {
            if ((e.target as Element).closest('.fx-hot')) return
            if (studyNode.type === FX_MIX_TYPE) return
            e.stopPropagation()
            try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* fine */ }
            setDrag({ kind: 'amount', id: studyNode.id, y0: e.clientY, a0: studyNode.amount })
          }}
          onPointerMove={(e) => {
            if (drag?.kind !== 'amount' || drag.id !== studyNode.id) return
            updateNode(drag.id, { amount: Math.min(1, Math.max(0, drag.a0 + (drag.y0 - e.clientY) / 190)) })
          }}
          onPointerUp={() => { if (drag?.kind === 'amount') { push(graphRef.current, true); setDrag(null) } }}
          onDoubleClick={() => { if (studyNode.type !== FX_MIX_TYPE) updateNode(studyNode.id, { amount: neutralOf(studyNode.type) }, true) }}
          onWheel={(e) => { if (studyNode.type === FX_MIX_TYPE) return; e.stopPropagation(); e.preventDefault(); updateNode(studyNode.id, { amount: Math.min(1, Math.max(0, studyNode.amount - Math.sign(e.deltaY) * 0.02)) }, true) }}>
          <Print node={studyNode} size={STUDY_PRINT} shares={sharesOf(studyNode.id)}
            onDecay={(v, force) => { const d = [...studyNode.decay]; d[studyNode.variant] = Math.min(1, Math.max(0, v)); updateNode(studyNode.id, { decay: d }, !!force) }}
            onDiv={(v) => updateNode(studyNode.id, { delayDiv: v }, true)}
            onFb={(v, force) => updateNode(studyNode.id, { delayFb: Math.min(1, Math.max(0, v)) }, !!force)}
            onFlip={(bit) => updateNode(studyNode.id, { variant: studyNode.variant ^ bit }, true)}
            onDraw={(i, v) => {
              if (i === -2) { updateNode(studyNode.id, { curve: undefined }, true); return }
              if (i === -1) { push(graphRef.current, true); return }
              const cur = graphRef.current.nodes.find(x => x.id === studyNode.id)
              const base = cur?.curve && cur.curve.length === CURVE_LEN ? [...cur.curve]
                : Array.from({ length: CURVE_LEN }, (_, k) => baseShape(studyNode.variant, k / CURVE_LEN))
              base[i] = v
              updateNode(studyNode.id, { curve: base })
            }} />
        </div>
        <div className="sg-study-value">
          {studyNode.type !== FX_MIX_TYPE
            ? <span className="sg-val" onWheel={(e) => { e.stopPropagation(); e.preventDefault(); updateNode(studyNode.id, { amount: Math.min(1, Math.max(0, studyNode.amount - Math.sign(e.deltaY) * 0.02)) }, true) }}>{fmtValue(studyNode.type, studyNode.amount, studyNode.variant)}</span>
            : <span className="sg-val quiet">{inputsOf(studyNode.id).map(x => `${x.e.from === FX_PORT_IN ? 'in' : nameOf(nodeById(x.e.from)?.type ?? -1)} ${Math.round(x.e.gain * 100)}`).join(' · ') || '—'}</span>}
        </div>
        <p className="sg-study-hint">drag the print for its amount · the hands and words live under it on the wall</p>
      </aside>
    )}
    </div>
    </StrokeLevel.Provider>
  )
}
