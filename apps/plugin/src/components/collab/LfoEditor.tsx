import { useRef, useState } from 'react'

/*  The lfo's shape — drawn on an eight-by-eight grid.

    A shape is a row of points; between two points the line is straight
    until the hollow point in the middle is dragged, which bends that
    stretch. Click the empty grid to add a point, drag a point to move
    it, double-click a point to take it away. The two ends stay at the
    edges and only move up and down.

    Stored flat as [x, y, bend, x, y, bend, …] with x and y in 0..1 (y up)
    and bend in -1..1 for the stretch that follows the point.              */

export const SINE_PTS: number[] = (() => {
  const out: number[] = []
  for (let i = 0; i <= 8; i++) { const x = i / 8; out.push(x, 0.5 + 0.5 * Math.sin(x * Math.PI * 2), 0) }
  return out
})()

/** y at x along the shape: straight stretches, each bowed by its bend. */
export function shapeAt (pts: number[], x: number): number {
  const n = pts.length / 3
  if (n === 0) return 0.5
  if (n === 1) return pts[1]
  for (let i = 0; i < n - 1; i++) {
    const x0 = pts[i * 3], y0 = pts[i * 3 + 1], b = pts[i * 3 + 2], x1 = pts[(i + 1) * 3], y1 = pts[(i + 1) * 3 + 1]
    if (x < x0) return y0
    if (x <= x1 || i === n - 2) {
      const t = x1 > x0 ? Math.min(1, Math.max(0, (x - x0) / (x1 - x0))) : 0
      // the bow: the middle follows the finger, the ends stay put
      return Math.min(1, Math.max(0, y0 + (y1 - y0) * t + b * 0.5 * 4 * t * (1 - t)))
    }
  }
  return pts[(n - 1) * 3 + 1]
}

/** The shape as a table the engine can read. */
export function sampleShape (pts: number[], count = 64): number[] {
  return Array.from({ length: count }, (_, i) => shapeAt(pts, i / count))
}

export function LfoEditor ({ pts, size, onChange, ink }: {
  pts: number[]
  size: number
  onChange: (pts: number[], final: boolean) => void
  ink: (a: number) => string
}) {
  const ref = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<{ kind: 'point' | 'bend'; i: number } | null>(null)
  const n = pts.length / 3
  const pad = 6, W = size - pad * 2
  const sx = (x: number) => pad + x * W, sy = (y: number) => pad + (1 - y) * W
  const toShape = (e: React.PointerEvent): { x: number; y: number } => {
    const r = ref.current!.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left - pad) / W)), y: Math.min(1, Math.max(0, 1 - (e.clientY - r.top - pad) / W)) }
  }
  const set = (next: number[], final: boolean) => onChange(next, final)
  const grab = (e: React.PointerEvent) => { try { (e.currentTarget as Element).setPointerCapture(e.pointerId) } catch { /* fine */ } }

  // the curve as a path, sampled finely
  const path = (() => {
    let d = ''
    for (let k = 0; k <= 128; k++) { const x = k / 128; d += `${k === 0 ? 'M' : 'L'}${sx(x).toFixed(1)} ${sy(shapeAt(pts, x)).toFixed(1)} ` }
    return d
  })()

  return (
    <svg ref={ref} className="sg-lfo" width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', overflow: 'visible', touchAction: 'none' }}
      onPointerDown={(e) => {
        // the empty grid: a new point, then drag it
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
          const lo = i === 0 ? 0 : pts[(i - 1) * 3] + 0.005, hi = i === n - 1 ? 1 : pts[(i + 1) * 3] - 0.005
          next[i * 3] = i === 0 ? 0 : i === n - 1 ? 1 : Math.min(hi, Math.max(lo, p.x))
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
      {/* the bends: a hollow point in the middle of every stretch */}
      {Array.from({ length: Math.max(0, n - 1) }, (_, i) => {
        const xm = (pts[i * 3] + pts[(i + 1) * 3]) / 2
        return (
          <circle key={`b${i}`} data-bend={i} cx={sx(xm)} cy={sy(shapeAt(pts, xm))} r={3.5} fill="#161410" stroke={ink(0.7)} strokeWidth={1} style={{ cursor: 'ns-resize' }}
            onPointerDown={(e) => { e.stopPropagation(); grab(e); setDrag({ kind: 'bend', i }) }}
            onDoubleClick={(e) => { e.stopPropagation(); const next = [...pts]; next[i * 3 + 2] = 0; set(next, true) }} />
        )
      })}
      {/* the points */}
      {Array.from({ length: n }, (_, i) => (
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
