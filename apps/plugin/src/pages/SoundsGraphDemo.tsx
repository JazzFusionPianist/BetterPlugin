import { Fragment, type ReactNode } from 'react'
import { ARTS, MODES, VARIANTS, WALL_TINTS, VARIANT_TINTS, wallColor, PAPER, BLUE } from '../components/collab/FxPanel'
import type { FxMode } from '../lib/fxBridge'
import './collab.css'

/** MOCKUP — Orb Sounds as a patchable wall (?soundsdemo). Static: the
 *  prints are the real plates, wired in → tone → (space ‖ delay) → mix →
 *  mod → out. Sizes and the shelf are what's being judged here. */

const NODE = 132            // print diameter on the wall
const SHELF_PRINT = 54      // print diameter on the shelf
const IN_X = 64, OUT_X = 1056, MID_Y = 300

type Node = { id: string; mode: FxMode; x: number; y: number; a: number; variant?: number; selected?: boolean }
const NODES: Node[] = [
  { id: 'tone',  mode: 0,  x: 226, y: MID_Y, a: 0.62 },
  { id: 'space', mode: 2,  x: 452, y: 176,   a: 0.45, variant: 0, selected: true },
  { id: 'delay', mode: 10, x: 452, y: 424,   a: 0.38, variant: 2 },
  { id: 'mod',   mode: 6,  x: 866, y: MID_Y, a: 0.3,  variant: 0 },
]
const MIX = { id: 'mix', x: 660, y: MID_Y, shares: [0.62, 0.38] }
/* a mix print has one input port per wire, fanned on its left edge */
const MIX_IN_ANGLES = [-26, 26]
const mixIn = (i: number) => {
  const t = MIX_IN_ANGLES[i] * Math.PI / 180
  return { x: MIX.x - (NODE / 2) * Math.cos(t), y: MIX.y + (NODE / 2) * Math.sin(t) }
}

/* wires: [from x,y] → [to x,y], plus an optional share label at the end */
type Wire = { x1: number; y1: number; x2: number; y2: number; share?: number }
const r = NODE / 2
const WIRES: Wire[] = [
  { x1: IN_X + 6,        y1: MID_Y, x2: 226 - r,       y2: MID_Y },
  { x1: 226 + r,         y1: MID_Y, x2: 452 - r,       y2: 176 },
  { x1: 226 + r,         y1: MID_Y, x2: 452 - r,       y2: 424 },
  { x1: 452 + r,         y1: 176,   x2: mixIn(0).x,    y2: mixIn(0).y, share: MIX.shares[0] },
  { x1: 452 + r,         y1: 424,   x2: mixIn(1).x,    y2: mixIn(1).y, share: MIX.shares[1] },
  { x1: MIX.x + r,       y1: MID_Y, x2: 866 - r,       y2: MID_Y },
  { x1: 866 + r,         y1: MID_Y, x2: OUT_X - 6,     y2: MID_Y },
]

function tintOf (mode: FxMode, variant = 0): [number, number, number] {
  return VARIANT_TINTS[mode]?.[variant] ?? WALL_TINTS[mode]
}

function wirePath (w: Wire): string {
  const dx = Math.max(40, (w.x2 - w.x1) * 0.5)
  return `M ${w.x1} ${w.y1} C ${w.x1 + dx} ${w.y1}, ${w.x2 - dx} ${w.y2}, ${w.x2} ${w.y2}`
}

/** The mix print: one ring cut into the inputs' shares, radial hairlines
 *  at the cuts, the first share in the second ink. */
function MixArt ({ shares }: { shares: number[] }) {
  const R = 86, C = 110
  let ang = -Math.PI / 2
  const arcs: ReactNode[] = []
  shares.forEach((s, i) => {
    const a0 = ang + 0.06, a1 = ang + s * Math.PI * 2 - 0.06
    const p0 = [C + R * Math.cos(a0), C + R * Math.sin(a0)]
    const p1 = [C + R * Math.cos(a1), C + R * Math.sin(a1)]
    const large = s > 0.5 ? 1 : 0
    arcs.push(
      <Fragment key={i}>
        <path d={`M ${p0[0]} ${p0[1]} A ${R} ${R} 0 ${large} 1 ${p1[0]} ${p1[1]}`}
              stroke={i === 0 ? BLUE : PAPER} strokeWidth={i === 0 ? 3 : 1.5} fill="none" strokeLinecap="round" />
        <line x1={C} y1={C} x2={C + R * Math.cos(ang)} y2={C + R * Math.sin(ang)} stroke={PAPER} strokeWidth={0.8} opacity={0.7} />
      </Fragment>,
    )
    ang += s * Math.PI * 2
  })
  // inner rings: the sum, quietly
  const inner = [22, 40, 58].map(rr => <circle key={rr} cx={C} cy={C} r={rr} stroke={PAPER} strokeWidth={0.8} fill="none" opacity={0.35} />)
  return <g>{inner}{arcs}</g>
}

function Print ({ mode, a, variant = 0, size, dim }: { mode: FxMode; a: number; variant?: number; size: number; dim?: boolean }) {
  const Art = ARTS[mode]
  const t = tintOf(mode, variant)
  const glow = dim ? 'none' : `drop-shadow(0 0 ${6 + a * 22}px rgba(${t[0]}, ${t[1]}, ${t[2]}, ${(0.25 + a * 0.5).toFixed(2)}))`
  return (
    <svg viewBox="0 0 220 220" width={size} height={size} style={{ filter: glow, overflow: 'visible' }}>
      {mode === 2 ? <Art a={a} variant={variant} decay={0.5} />
        : mode === 10 ? <Art a={a} div={2} fb={0.35} />
        : mode === 7 ? <Art a={a} variant={variant} />
        : <Art a={a} />}
    </svg>
  )
}

export default function SoundsGraphDemo () {
  const sel = NODES.find(n => n.selected)!
  const wall = wallColor(sel.mode, sel.variant ?? 0, 0.16)
  const nameOf = (m: FxMode) => MODES.find(x => x.id === m)?.name ?? ''
  const flavour = (n: Node) => VARIANTS[n.mode][n.variant ?? 0]

  return (
    <div className="plugin sounds fx-open screen-wide sg" style={{ width: 1120, height: 720, background: wall }}>
      <div className="top-bar"><span className="sounds-mark">orb sounds</span></div>

      <div className="sg-wall">
        <svg className="sg-wires" viewBox="0 0 1120 560">
          {WIRES.map((w, i) => <path key={i} d={wirePath(w)} />)}
          {/* the share rides the wire just before it lands on the mix */}
          {WIRES.filter(w => w.share !== undefined).map((w, i) => (
            <text key={i} x={w.x2 - 12} y={w.y2 + (i === 0 ? -7 : 14)} textAnchor="end" className="sg-share">
              {Math.round((w.share ?? 0) * 100)}
            </text>
          ))}
          {/* in / out live on the wall itself */}
          <circle cx={IN_X} cy={MID_Y} r={4} className="sg-port" />
          <circle cx={OUT_X} cy={MID_Y} r={4} className="sg-port" />
          <text x={IN_X} y={MID_Y + 22} textAnchor="middle" className="sg-io">in</text>
          <text x={OUT_X} y={MID_Y + 22} textAnchor="middle" className="sg-io">out</text>
        </svg>

        {NODES.map(n => (
          <div key={n.id} className={`sg-node${n.selected ? ' sel' : ''}`} style={{ left: n.x - r, top: n.y - r, width: NODE, height: NODE }}>
            <Print mode={n.mode} a={n.a} variant={n.variant} size={NODE} />
            <span className="sg-dot l" /><span className="sg-dot r" />
            <div className="sg-label">
              <span className="sg-name">{nameOf(n.mode)}</span>
              {flavour(n) && <span className="sg-flav"> · {flavour(n)}</span>}
              <span className="sg-val"> {Math.round(n.a * 100)}</span>
            </div>
          </div>
        ))}

        <div className="sg-node" style={{ left: MIX.x - r, top: MIX.y - r, width: NODE, height: NODE }}>
          <svg viewBox="0 0 220 220" width={NODE} height={NODE} style={{ overflow: 'visible' }}><MixArt shares={MIX.shares} /></svg>
          {MIX_IN_ANGLES.map((_, i) => (
            <span key={i} className="sg-dot" style={{ left: mixIn(i).x - (MIX.x - r) - 2.5, top: mixIn(i).y - (MIX.y - r) - 2.5, marginTop: 0 }} />
          ))}
          <span className="sg-dot r" />
          <div className="sg-label"><span className="sg-name">mix</span><span className="sg-val"> {MIX.shares.map(s => Math.round(s * 100)).join(' / ')}</span></div>
        </div>
      </div>

      <div className="sg-shelf">
        {MODES.map(m => (
          <div key={m.id} className="sg-shelf-item">
            <Print mode={m.id} a={m.id === 0 ? 0.5 : m.id === 5 ? 0.75 : 0.3} size={SHELF_PRINT} dim />
            <span>{m.name}</span>
          </div>
        ))}
        <div className="sg-shelf-item">
          <svg viewBox="0 0 220 220" width={SHELF_PRINT} height={SHELF_PRINT}><MixArt shares={[0.5, 0.5]} /></svg>
          <span>mix</span>
        </div>
      </div>
    </div>
  )
}
