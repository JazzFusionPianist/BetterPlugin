import { useContext, useRef, useState } from 'react'
import { StrokeLevel, strokeFor } from './FxPanel'

/*  The bands' editor — a ruler of frequency, 20 Hz to 20 kHz, cut into
    bands. Double-click a band to split it there; drag a cut to move it;
    double-click a cut to take it away. Up to five cuts, six bands, each
    band in its lane's colour (the same colour its wire carries).

    Crossovers live in aux 0..4 (Hz, ascending), aux 5 says how many.    */

export const BAND_RGB: Array<[number, number, number]> = [[232, 92, 74], [240, 156, 56], [236, 214, 84], [96, 208, 128], [72, 168, 255], [176, 120, 255]]   // low → high
export const MAX_CROSS = 5
const F0 = 20, F1 = 20000
export const fx = (hz: number) => Math.log(Math.max(F0, Math.min(F1, hz)) / F0) / Math.log(F1 / F0)   // 0..1 along the ruler
export const xf = (t: number) => F0 * Math.pow(F1 / F0, Math.max(0, Math.min(1, t)))
export const crossovers = (aux: number[]) => { const n = Math.max(1, Math.min(MAX_CROSS, aux[5] || 1)); return Array.from({ length: n }, (_, k) => aux[k] || 250).sort((a, b) => a - b) }
export const fmtHz = (hz: number) => (hz >= 1000 ? `${(hz / 1000).toFixed(hz >= 10000 ? 1 : 2)}k` : `${Math.round(hz)}`)

/** The picture alone (the wall's print, the shelf): bands as blocks of colour along the ruler. */
export function BandsArt ({ aux }: { aux: number[] }) {
  const ink = strokeFor(useContext(StrokeLevel) ?? 0)
  const xs = crossovers(aux)
  const edges = [0, ...xs.map(fx), 1]
  const x0 = 30, W = 160, y0 = 86, H = 48
  return (
    <g>
      {edges.slice(0, -1).map((a, k) => { const c = BAND_RGB[k]; return <rect key={k} x={x0 + a * W} y={y0} width={Math.max(1, (edges[k + 1] - a) * W)} height={H} fill={`rgb(${c[0]}, ${c[1]}, ${c[2]})`} fillOpacity={0.55} /> })}
      {xs.map((hz, k) => <path key={k} d={`M${(x0 + fx(hz) * W).toFixed(1)} ${y0 - 6} V${y0 + H + 6}`} stroke={ink} strokeWidth={1.2} />)}
      <path d={`M${x0} ${y0 + H + 14} H${x0 + W}`} stroke={ink} strokeOpacity={0.3} strokeWidth={0.8} />
      {[100, 1000, 10000].map(f => <path key={f} d={`M${(x0 + fx(f) * W).toFixed(1)} ${y0 + H + 11} V${y0 + H + 17}`} stroke={ink} strokeOpacity={0.5} strokeWidth={0.8} />)}
    </g>
  )
}

export function BandsEditor ({ aux, size, ink, onChange }: {
  aux: number[]
  size: number
  ink: (a: number) => string
  onChange: (aux: number[], final: boolean) => void
}) {
  const ref = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<number | null>(null)
  const xs = crossovers(aux)
  const pad = 8, W = size - pad * 2, y0 = size * 0.3, H = size * 0.34
  const sx = (t: number) => pad + t * W
  const tAt = (e: React.PointerEvent | React.MouseEvent) => { const r = ref.current!.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left - pad) / W)) }
  const put = (next: number[], final: boolean) => {
    const sorted = [...next].sort((a, b) => a - b)
    const out = [...aux]; while (out.length < 8) out.push(0)
    for (let k = 0; k < MAX_CROSS; k++) out[k] = sorted[k] ?? 0
    out[5] = sorted.length
    onChange(out, final)
  }
  const edges = [0, ...xs.map(fx), 1]
  return (
    <svg ref={ref} className="sg-bands" width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', overflow: 'visible', touchAction: 'none', cursor: 'crosshair' }}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        // a band, double-clicked: split it here
        e.stopPropagation()
        if ((e.target as Element).closest('[data-cut]')) return
        if (xs.length >= MAX_CROSS) return
        put([...xs, Math.round(xf(tAt(e)))], true)
      }}
      onPointerMove={(e) => {
        if (drag === null) return
        const lo = drag > 0 ? xs[drag - 1] * 1.05 : F0, hi = drag < xs.length - 1 ? xs[drag + 1] / 1.05 : F1
        const next = [...xs]; next[drag] = Math.round(Math.max(lo, Math.min(hi, xf(tAt(e)))))
        put(next, false)
      }}
      onPointerUp={() => { if (drag !== null) { setDrag(null); put(xs, true) } }}>
      {/* the bands */}
      {edges.slice(0, -1).map((a, k) => { const c = BAND_RGB[k]; return <rect key={k} x={sx(a)} y={y0} width={Math.max(1, (edges[k + 1] - a) * W)} height={H} fill={`rgb(${c[0]}, ${c[1]}, ${c[2]})`} fillOpacity={0.5} /> })}
      {/* the ruler */}
      <path d={`M${sx(0)} ${y0 + H + 18} H${sx(1)}`} stroke={ink(0.35)} strokeWidth={1} />
      {[20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].map(f => (
        <g key={f}>
          <path d={`M${sx(fx(f)).toFixed(1)} ${y0 + H + 14} V${y0 + H + 22}`} stroke={ink(f === 100 || f === 1000 || f === 10000 ? 0.7 : 0.35)} strokeWidth={1} />
          {(f === 100 || f === 1000 || f === 10000) && <text x={sx(fx(f))} y={y0 + H + 36} textAnchor="middle" fontSize="10" fill={ink(0.55)} style={{ fontFamily: "'Space Mono', monospace" }}>{fmtHz(f)}</text>}
        </g>
      ))}
      {/* the cuts: drag to move, double-click to take away */}
      {xs.map((hz, k) => (
        <g key={k} data-cut={k} style={{ cursor: 'ew-resize' }}
          onPointerDown={(e) => { e.stopPropagation(); try { (e.currentTarget as Element).setPointerCapture(e.pointerId) } catch { /* fine */ } setDrag(k) }}
          onDoubleClick={(e) => { e.stopPropagation(); if (xs.length > 1) put(xs.filter((_, i) => i !== k), true) }}>
          <rect x={sx(fx(hz)) - 6} y={y0 - 12} width={12} height={H + 24} fill="transparent" />
          <path d={`M${sx(fx(hz)).toFixed(1)} ${y0 - 10} V${y0 + H + 10}`} stroke={ink(drag === k ? 1 : 0.9)} strokeWidth={drag === k ? 2 : 1.4} />
          <text x={sx(fx(hz))} y={y0 - 16} textAnchor="middle" fontSize="11" fill={ink(0.9)} style={{ fontFamily: "'Space Mono', monospace" }}>{fmtHz(hz)}</text>
        </g>
      ))}
    </svg>
  )
}
