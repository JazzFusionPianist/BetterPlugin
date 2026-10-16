import { useEffect, useRef, useState } from 'react'
import { getLfoClock } from '../../lib/liveHands'
import { LFO_SHAPES, LFO_RANDOM, LFO_STEPS, stepsToPts, ptsToSteps, SINE_PTS, shapeAt, sampleShape, randomStep, lfoAddPoint, lfoMovePoint, lfoBend, lfoRemovePoint, lfoSetStep, lfoLine } from './printCatalog'

/*  The lfo's shape — drawn on an eight-by-eight grid.

    A shape is a row of points; between two points the line is straight
    until the hollow point in the middle is dragged, which bends that
    stretch. Click the empty grid to add a point, drag a point to move
    it, double-click a point to take it away. The two ends stay at the
    edges and only move up and down; when they are level they move as
    one, so the loop has no step at its seam (alt moves one alone). A point can be pushed right up
    against its neighbour: two points on one x are a cliff, and the hand
    the lfo plays jumps there (no glide).

    The stock shapes are made of the same points and bends, so any of
    them can be taken as a start and reworked. `random` is the one that
    is not drawn: a new value every step, held.

    Over the grid a small mark shows where the lfo is in its shape right
    now — locked to the song while it plays (the left edge is bar 1).

    Stored flat as [x, y, bend, x, y, bend, …] with x and y in 0..1 (y up)
    and bend in -1..1 for the stretch that follows the point.              */

/* the shapes and their arithmetic live with the prints' data (printCatalog), where Slur Studio reads them too */
export { LFO_SHAPES, LFO_RANDOM, LFO_STEPS, stepsToPts, ptsToSteps, SINE_PTS, shapeAt, sampleShape, randomStep }

export function LfoEditor ({ pts, size, onChange, ink, slot, random = 0, steps = 0 }: {
  steps?: number           // > 0: a step sequencer — drag a column to set that step's height
  pts: number[]
  size: number
  onChange: (pts: number[], final: boolean) => void
  ink: (a: number) => string
  slot?: number            // whose clock the mark follows
  random?: number          // > 0: the shape is random, this many steps a turn (nothing to draw by hand)
}) {
  const ref = useRef<SVGSVGElement>(null)
  const mark = useRef<SVGPathElement>(null)
  const [drag, setDrag] = useState<{ kind: 'point' | 'bend' | 'step'; i: number } | null>(null)
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
    return lfoLine(pts).map(([x, y], k) => `${k === 0 ? 'M' : 'L'}${sx(x).toFixed(1)} ${sy(y).toFixed(1)} `).join('')
  })()

  return (
    <svg ref={ref} className="sg-lfo" width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', overflow: 'visible', touchAction: 'none' }}
      onPointerDown={(e) => {
        if (steps > 0) {
          // a step sequencer: press anywhere in a column and that step takes the height of the finger
          e.stopPropagation(); grab(e)
          const p = toShape(e), k = Math.min(steps - 1, Math.floor(p.x * steps))
          set(lfoSetStep(pts, steps, p), false); setDrag({ kind: 'step', i: k })
          return
        }
        // the empty grid: a new point, then drag it
        if (random > 0) return
        if ((e.target as Element).closest('[data-pt], [data-bend]')) return
        e.stopPropagation()
        const added = lfoAddPoint(pts, toShape(e))
        set(added.pts, false)
        grab(e); setDrag({ kind: 'point', i: added.i })
      }}
      onPointerMove={(e) => {
        if (!drag) return
        const p = toShape(e)
        if (drag.kind === 'step') {
          // the finger sweeps across columns: every column it passes takes its height
          set(lfoSetStep(pts, steps, p), false)
          return
        }
        if (drag.kind === 'point') set(lfoMovePoint(pts, drag.i, p, e.altKey), false)
        else set(lfoBend(pts, drag.i, p.y), false)
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
      {random === 0 && steps === 0 && Array.from({ length: Math.max(0, n - 1) }, (_, i) => {
        if (pts[(i + 1) * 3] - pts[i * 3] < 1e-6) return null
        const xm = (pts[i * 3] + pts[(i + 1) * 3]) / 2
        return (
          <circle key={`b${i}`} data-bend={i} cx={sx(xm)} cy={sy(shapeAt(pts, xm))} r={3.5} fill="#161410" stroke={ink(0.7)} strokeWidth={1} style={{ cursor: 'ns-resize' }}
            onPointerDown={(e) => { e.stopPropagation(); grab(e); setDrag({ kind: 'bend', i }) }}
            onDoubleClick={(e) => { e.stopPropagation(); const next = [...pts]; next[i * 3 + 2] = 0; set(next, true) }} />
        )
      })}
      {/* the points */}
      {random === 0 && steps === 0 && Array.from({ length: n }, (_, i) => (
        <circle key={`p${i}`} data-pt={i} cx={sx(pts[i * 3])} cy={sy(pts[i * 3 + 1])} r={4} fill={ink(1)} style={{ cursor: 'move' }}
          onPointerDown={(e) => { e.stopPropagation(); grab(e); setDrag({ kind: 'point', i }) }}
          onDoubleClick={(e) => {
            e.stopPropagation()
            if (i === 0 || i === n - 1) return
            set(lfoRemovePoint(pts, i), true)
          }} />
      ))}
    </svg>
  )
}
