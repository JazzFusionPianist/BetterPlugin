import { useEffect, useRef, useState } from 'react'
import { getLfoClock } from '../../lib/liveHands'

/*  The lfo's shape — drawn on an eight-by-eight grid.

    A shape is a row of points; between two points the line is straight
    until the hollow point in the middle is dragged, which bends that
    stretch. Click the empty grid to add a point, drag a point to move
    it, double-click a point to take it away. The two ends stay at the
    edges and only move up and down. A point can be pushed right up
    against its neighbour: two points on one x are a cliff, and the hand
    the lfo plays jumps there (no glide).

    The stock shapes are made of the same points and bends, so any of
    them can be taken as a start and reworked. `random` is the one that
    is not drawn: a new value every step, held.

    Over the grid a small mark shows where the lfo is in its shape right
    now — locked to the song while it plays (the left edge is bar 1).

    Stored flat as [x, y, bend, x, y, bend, …] with x and y in 0..1 (y up)
    and bend in -1..1 for the stretch that follows the point.              */

const B = 0.2071   // the bend that makes a quarter of a sine out of a straight stretch
export const LFO_SHAPES: Array<{ name: string; pts: number[] | null }> = [
  { name: 'sine',     pts: [0, 0.5, B, 0.25, 1, B, 0.5, 0.5, -B, 0.75, 0, -B, 1, 0.5, 0] },
  { name: 'triangle', pts: [0, 0.5, 0, 0.25, 1, 0, 0.75, 0, 0, 1, 0.5, 0] },
  { name: 'saw up',   pts: [0, 0, 0, 1, 1, 0] },
  { name: 'saw down', pts: [0, 1, 0, 1, 0, 0] },
  { name: 'square',   pts: [0, 1, 0, 0.5, 1, 0, 0.5, 0, 0, 1, 0, 0] },
  { name: 'pulse',    pts: [0, 1, 0, 0.25, 1, 0, 0.25, 0, 0, 1, 0, 0] },
  { name: 'stairs',   pts: [0, 0, 0, 0.25, 0, 0, 0.25, 1 / 3, 0, 0.5, 1 / 3, 0, 0.5, 2 / 3, 0, 0.75, 2 / 3, 0, 0.75, 1, 0, 1, 1, 0] },
  { name: 'random',   pts: null },
]
export const LFO_RANDOM = LFO_SHAPES.length - 1
export const SINE_PTS: number[] = LFO_SHAPES[0].pts!

/** y at x along the shape: straight stretches, each bowed by its bend. At a cliff (two points on one x) the value is the one after it. The engine reads the shape the same way. */
export function shapeAt (pts: number[], x: number): number {
  const n = pts.length / 3
  if (n === 0) return 0.5
  if (n === 1) return pts[1]
  for (let i = 0; i < n - 1; i++) {
    const x0 = pts[i * 3], y0 = pts[i * 3 + 1], b = pts[i * 3 + 2], x1 = pts[(i + 1) * 3], y1 = pts[(i + 1) * 3 + 1]
    if (x < x0) return y0
    if (x < x1 || i === n - 2) {
      const t = x1 > x0 ? Math.min(1, Math.max(0, (x - x0) / (x1 - x0))) : 1
      // the bow: the middle follows the finger, the ends stay put
      return Math.min(1, Math.max(0, y0 + (y1 - y0) * t + b * 0.5 * 4 * t * (1 - t)))
    }
  }
  return pts[(n - 1) * 3 + 1]
}

/** The shape as a table (the wall's small pictures use it; the engine makes its own, finer, from the points). */
export function sampleShape (pts: number[], count = 64): number[] {
  return Array.from({ length: count }, (_, i) => shapeAt(pts, i / count))
}

/** random: the value of one step — the engine's own arithmetic, so what is drawn is what is played. */
export function randomStep (slot: number, cycle: number, steps: number, k: number): number {
  const step = cycle * steps + k
  let h = (Math.imul(step | 0, 2654435761 | 0) ^ ((slot * 40503 + 12345) >>> 0)) >>> 0
  h ^= h >>> 15; h = Math.imul(h, 2246822519 | 0) >>> 0; h ^= h >>> 13; h = Math.imul(h, 3266489917 | 0) >>> 0; h ^= h >>> 16
  return ((h >>> 0) & 0xffffff) / 0xffffff
}

export function LfoEditor ({ pts, size, onChange, ink, slot, random = 0 }: {
  pts: number[]
  size: number
  onChange: (pts: number[], final: boolean) => void
  ink: (a: number) => string
  slot?: number            // whose clock the mark follows
  random?: number          // > 0: the shape is random, this many steps a turn (nothing to draw by hand)
}) {
  const ref = useRef<SVGSVGElement>(null)
  const mark = useRef<SVGPathElement>(null)
  const [drag, setDrag] = useState<{ kind: 'point' | 'bend'; i: number } | null>(null)
  const [cycle, setCycle] = useState(0)
  const n = pts.length / 3
  const pad = 6, W = size - pad * 2
  const sx = (x: number) => pad + x * W, sy = (y: number) => pad + (1 - y) * W
  const toShape = (e: React.PointerEvent): { x: number; y: number } => {
    const r = ref.current!.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left - pad) / W)), y: Math.min(1, Math.max(0, 1 - (e.clientY - r.top - pad) / W)) }
  }
  const set = (next: number[], final: boolean) => onChange(next, final)
  const grab = (e: React.PointerEvent) => { try { (e.currentTarget as Element).setPointerCapture(e.pointerId) } catch { /* fine */ } }

  // the mark: where the lfo is now (moved without re-rendering); a random shape is redrawn when a new turn begins
  useEffect(() => {
    if (slot === undefined) return
    let raf = 0, last = -1
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const c = getLfoClock(slot)
      if (mark.current) mark.current.setAttribute('transform', `translate(${(pad + c.phase * W).toFixed(1)} 0)`)
      if (random > 0 && c.cycle !== last) { last = c.cycle; setCycle(c.cycle) }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [slot, random, W])

  // the curve as a path: each stretch sampled, a cliff drawn as the vertical it is
  const path = (() => {
    if (random > 0) {
      let d = ''
      for (let k = 0; k < random; k++) { const y = sy(randomStep(slot ?? 0, cycle, random, k)); d += `${k === 0 ? 'M' : 'L'}${sx(k / random).toFixed(1)} ${y.toFixed(1)} L${sx((k + 1) / random).toFixed(1)} ${y.toFixed(1)} ` }
      return d
    }
    let d = `M${sx(pts[0]).toFixed(1)} ${sy(pts[1]).toFixed(1)} `
    for (let i = 0; i < n - 1; i++) {
      const x0 = pts[i * 3], x1 = pts[(i + 1) * 3]
      if (x1 - x0 < 1e-6) { d += `L${sx(x1).toFixed(1)} ${sy(pts[(i + 1) * 3 + 1]).toFixed(1)} `; continue }
      for (let k = 1; k <= 24; k++) {
        const t = k / 24, y0 = pts[i * 3 + 1], y1 = pts[(i + 1) * 3 + 1], b = pts[i * 3 + 2]
        d += `L${sx(x0 + (x1 - x0) * t).toFixed(1)} ${sy(Math.min(1, Math.max(0, y0 + (y1 - y0) * t + b * 2 * t * (1 - t)))).toFixed(1)} `
      }
    }
    return d
  })()

  return (
    <svg ref={ref} className="sg-lfo" width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', overflow: 'visible', touchAction: 'none' }}
      onPointerDown={(e) => {
        // the empty grid: a new point, then drag it
        if (random > 0) return
        if ((e.target as Element).closest('[data-pt], [data-bend]')) return
        e.stopPropagation()
        const p = toShape(e)
        const next = [...pts]
        let at = n
        for (let i = 0; i < n; i++) if (pts[i * 3] > p.x) { at = i; break }
        next.splice(at * 3, 0, p.x, p.y, 0)
        set(next, false)
        grab(e); setDrag({ kind: 'point', i: at })
      }}
      onPointerMove={(e) => {
        if (!drag) return
        const p = toShape(e)
        const next = [...pts]
        if (drag.kind === 'point') {
          const i = drag.i
          // a point goes as far as its neighbours, and onto them: two points on one x are a cliff
          const lo = i === 0 ? 0 : pts[(i - 1) * 3], hi = i === n - 1 ? 1 : pts[(i + 1) * 3]
          let x = i === 0 ? 0 : i === n - 1 ? 1 : Math.min(hi, Math.max(lo, p.x))
          // close to a neighbour it takes that neighbour's x exactly (a true vertical, not a steep slope)
          if (i > 0 && i < n - 1) { if (x - lo < 0.012) x = lo; else if (hi - x < 0.012) x = hi }
          next[i * 3] = x
          next[i * 3 + 1] = p.y
        } else {
          const i = drag.i
          const y0 = pts[i * 3 + 1], y1 = pts[(i + 1) * 3 + 1]
          next[i * 3 + 2] = Math.min(1, Math.max(-1, (p.y - (y0 + y1) / 2) / 0.5))
        }
        set(next, false)
      }}
      onPointerUp={() => { if (drag) { setDrag(null); set(pts, true) } }}>
      {/* the grid: eight by eight, the middle line a hair stronger */}
      {Array.from({ length: 9 }, (_, k) => (
        <g key={k}>
          <path d={`M${sx(k / 8)} ${sy(0)} V${sy(1)}`} stroke={ink(k === 4 ? 0.22 : 0.12)} strokeWidth={1} />
          <path d={`M${sx(0)} ${sy(k / 8)} H${sx(1)}`} stroke={ink(k === 4 ? 0.22 : 0.12)} strokeWidth={1} />
        </g>
      ))}
      <path d={path} fill="none" stroke={ink(1)} strokeWidth={1.5} strokeLinejoin="round" />
      {/* where the lfo is now: a small mark over the grid, and its hairline down the shape */}
      {slot !== undefined && (
        <path ref={mark} d={`M-5 ${pad - 11} H5 L0 ${pad - 3} Z M0 ${pad} V${pad + W}`} fill={ink(0.9)} stroke={ink(0.28)} strokeWidth={1} style={{ pointerEvents: 'none' }} />
      )}
      {/* the bends: a hollow point in the middle of every stretch (a cliff has none) */}
      {random === 0 && Array.from({ length: Math.max(0, n - 1) }, (_, i) => {
        if (pts[(i + 1) * 3] - pts[i * 3] < 1e-6) return null
        const xm = (pts[i * 3] + pts[(i + 1) * 3]) / 2
        return (
          <circle key={`b${i}`} data-bend={i} cx={sx(xm)} cy={sy(shapeAt(pts, xm))} r={3.5} fill="#161410" stroke={ink(0.7)} strokeWidth={1} style={{ cursor: 'ns-resize' }}
            onPointerDown={(e) => { e.stopPropagation(); grab(e); setDrag({ kind: 'bend', i }) }}
            onDoubleClick={(e) => { e.stopPropagation(); const next = [...pts]; next[i * 3 + 2] = 0; set(next, true) }} />
        )
      })}
      {/* the points */}
      {random === 0 && Array.from({ length: n }, (_, i) => (
        <circle key={`p${i}`} data-pt={i} cx={sx(pts[i * 3])} cy={sy(pts[i * 3 + 1])} r={4} fill={ink(1)} style={{ cursor: 'move' }}
          onPointerDown={(e) => { e.stopPropagation(); grab(e); setDrag({ kind: 'point', i }) }}
          onDoubleClick={(e) => {
            e.stopPropagation()
            if (i === 0 || i === n - 1) return
            const next = [...pts]; next.splice(i * 3, 3); set(next, true)
          }} />
      ))}
    </svg>
  )
}
