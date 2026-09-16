/*  The study's parts — the artwork.

    Everything here is a drawing: a function of what it shows, with no
    state of its own. The numbers are the parts sheet's (drawn at 1×,
    approved at 2×). The wrappers in StudyControls place these and
    change their state; nothing in this file knows about the graph.

    The grammar: one 1px frame in the ink, cut into equal cells by 1px
    dividers; a cell at rest is empty, the chosen cell fills in the
    hand's colour and its word goes dark. Four colours, one per hand.  */

import type { ReactNode } from 'react'
import './parts.css'

export type Hue = 1 | 2 | 3 | 4     // blue, green, white, orange — the print's own tint is `t`
export type Tone = Hue | 't'

export const WALL = '#161410'
export const ink = (a = 1) => `rgba(246,243,234,${a})`
export const hue = (c: Tone, a = 1) => (c === 't' ? `rgba(var(--sg-tint),${a})` : `rgba(var(--sg-c${c}),${a})`)

let clipN = 0
const nextClip = () => `sg-clip-${++clipN}`

/* ── the cells: a frame cut into equal cells, one word each ─────────── */
export function Cells ({ options, value, hue: c, hover = -1, down = -1, width, onCell }: {
  options: string[]; value: number; hue: Tone; hover?: number; down?: number; width: number
  onCell?: (i: number, e: React.PointerEvent) => void
}) {
  const h = 18, fs = 10, n = options.length, cell = width / n
  const clip = nextClip()
  return (
    <svg className="sg-part" width={width} height={h} viewBox={`0 0 ${width} ${h}`}>
      <defs><clipPath id={clip}><rect x="0" y="0" width={width} height={h} rx="2" /></clipPath></defs>
      <g clipPath={`url(#${clip})`}>
        {options.map((_, i) => {
          const on = i === value, hv = i === hover, dn = i === down
          if (!on && !hv && !dn) return null
          return <rect key={i} x={i * cell} y="0" width={cell} height={h} fill={on ? hue(c) : dn ? ink(0.18) : ink(0.08)} />
        })}
      </g>
      <rect x="0.5" y="0.5" width={width - 1} height={h - 1} rx="2" fill="none" stroke={ink(0.3)} strokeWidth="1" />
      {options.map((opt, i) => {
        const x = i * cell, on = i === value, hv = i === hover, dn = i === down
        return (
          <g key={opt} className="sg-cell" onPointerDown={(e) => onCell?.(i, e)}>
            <rect x={x} y="0" width={cell} height={h} fill="transparent" />
            {i > 0 && !on && i - 1 !== value && <path d={`M${x + 0.5} 3 V${h - 3}`} stroke={ink(0.2)} strokeWidth="1" />}
            <text x={x + cell / 2} y={h / 2 + fs * 0.36} textAnchor="middle" fontSize={fs} fontWeight={on ? 500 : 400}
              fill={on ? WALL : hv || dn ? ink(1) : ink(0.62)}>{opt}</text>
          </g>
        )
      })}
    </svg>
  )
}

/* ── the keyboard: one frame, seven naturals, the sharps as tabs on the top edge ── */
const NAT = [0, 2, 4, 5, 7, 9, 11]
const SHARPS: Array<[number, number]> = [[1, 0], [3, 1], [6, 3], [8, 4], [10, 5]]   // [note, natural to its left]
export function Keyboard ({ names, value, hue: c, hover = -1, width, onKey }: {
  names: string[]; value: number; hue: Tone; hover?: number; width: number
  onKey?: (i: number, e: React.PointerEvent) => void
}) {
  const kh = 26, sw = 16, sh = 13, cell = width / 7
  const clip = nextClip()
  return (
    <svg className="sg-part" width={width} height={kh} viewBox={`0 0 ${width} ${kh}`}>
      <defs><clipPath id={clip}><rect x="0" y="0" width={width} height={kh} rx="2" /></clipPath></defs>
      <g clipPath={`url(#${clip})`}>
        {NAT.map((n, i) => (n === value || n === hover)
          ? <rect key={n} x={i * cell} y="0" width={cell} height={kh} fill={n === value ? hue(c) : ink(0.08)} />
          : null)}
      </g>
      <rect x="0.5" y="0.5" width={width - 1} height={kh - 1} rx="2" fill="none" stroke={ink(0.3)} strokeWidth="1" />
      {NAT.map((n, i) => {
        const x = i * cell, on = n === value, hv = n === hover
        return (
          <g key={n} className="sg-cell" onPointerDown={(e) => onKey?.(n, e)}>
            <rect x={x} y="0" width={cell} height={kh} fill="transparent" />
            {i > 0 && <path d={`M${x + 0.5} ${sh + 2} V${kh - 3}`} stroke={ink(0.2)} strokeWidth="1" />}
            <text x={x + cell / 2} y={kh - 6} textAnchor="middle" fontSize="9" fontWeight={on ? 500 : 400}
              fill={on ? WALL : hv ? ink(1) : ink(0.62)}>{names[n]}</text>
          </g>
        )
      })}
      {SHARPS.map(([n, left]) => {
        const x = (left + 1) * cell - sw / 2, on = n === value, hv = n === hover
        return (
          <g key={n} className="sg-cell" onPointerDown={(e) => { e.stopPropagation(); onKey?.(n, e) }}>
            <rect x={x} y="0" width={sw} height={sh} fill={WALL} />
            <rect x={x + 0.5} y="0.5" width={sw - 1} height={sh - 1} rx="1.5" fill={on ? hue(c) : hv ? ink(0.3) : ink(0.16)} />
            <text x={x + sw / 2} y={sh - 3.5} textAnchor="middle" fontSize="7.5" fill={on ? WALL : ink(0.8)}>{names[n]}</text>
          </g>
        )
      })}
    </svg>
  )
}

/* ── the steps: the frame cut into blank cells; the chosen one fills (its name is shown beside) ── */
export function Steps ({ count, value, hue: c, hover = -1, width, onStep }: {
  count: number; value: number; hue: Tone; hover?: number; width: number
  onStep?: (i: number, e: React.PointerEvent) => void
}) {
  const h = 10, cell = width / count
  const clip = nextClip()
  const idx = Array.from({ length: count }, (_, i) => i)
  return (
    <svg className="sg-part" width={width} height={h} viewBox={`0 0 ${width} ${h}`}>
      <defs><clipPath id={clip}><rect x="0" y="0" width={width} height={h} rx="1.5" /></clipPath></defs>
      <g clipPath={`url(#${clip})`}>
        {idx.map(i => (i === value || i === hover)
          ? <rect key={i} x={i * cell} y="0" width={cell} height={h} fill={i === value ? hue(c) : ink(0.1)} />
          : null)}
      </g>
      <rect x="0.5" y="0.5" width={width - 1} height={h - 1} rx="1.5" fill="none" stroke={ink(0.3)} strokeWidth="1" />
      {idx.map(i => (
        <g key={i} className="sg-cell" onPointerDown={(e) => onStep?.(i, e)}>
          <rect x={i * cell} y="0" width={cell} height={h} fill="transparent" />
          {i > 0 && i !== value && i - 1 !== value && <path d={`M${i * cell + 0.5} 2 V${h - 2}`} stroke={ink(0.2)} strokeWidth="1" />}
        </g>
      ))}
    </svg>
  )
}

/* ── the bar: a thin track, the value filled in the colour, a square ink handle at the value ── */
export function Bar ({ f, zero = 0, hue: c, live, hover, width }: {
  f: number; zero?: number; hue: Tone; live?: boolean; hover?: boolean; width: number
}) {
  const H = 12, y = H / 2, h = live ? 4 : 3
  const x0 = width * Math.min(zero, f), x1 = width * Math.max(zero, f)
  const hx = width * f, hw = live ? 3 : 2
  return (
    <svg className="sg-part" width={width} height={H} viewBox={`0 0 ${width} ${H}`}>
      <rect x="0" y={y - h / 2} width={width} height={h} fill={ink(hover || live ? 0.18 : 0.12)} />
      {zero > 0 && <rect x={width * zero - 0.5} y={y - 5} width="1" height="10" fill={ink(0.42)} />}
      {x1 - x0 > 0.5 && <rect x={x0} y={y - h / 2} width={x1 - x0} height={h} fill={hue(c)} />}
      <rect x={hx - hw / 2} y={y - 5} width={hw} height="10" fill={ink(1)} />
    </svg>
  )
}

/* ── the lamp: a small square beside a word; on, it fills in the colour ── */
export function Lamp ({ on, hover, hue: c }: { on: boolean; hover?: boolean; hue: Tone }) {
  return (
    <svg className="sg-part" width="8" height="8" viewBox="0 0 8 8">
      {on
        ? <rect x="0.5" y="0.5" width="7" height="7" fill={hue(c)} />
        : <rect x="1" y="1" width="6" height="6" fill={hover ? ink(0.12) : 'none'} stroke={ink(hover ? 0.7 : 0.35)} strokeWidth="1" />}
    </svg>
  )
}

/* ── the list's drawer: the options stacked in one frame, opened above the key ── */
export function Drawer ({ options, value, hue: c, hover = -1, width, onRow }: {
  options: string[]; value: number; hue: Tone; hover?: number; width: number
  onRow?: (i: number, e: React.PointerEvent) => void
}) {
  const rowH = 16, bh = options.length * rowH + 4
  return (
    <svg className="sg-part" width={width} height={bh} viewBox={`0 0 ${width} ${bh}`}>
      <rect x="0.5" y="0.5" width={width - 1} height={bh - 1} rx="2" fill={WALL} stroke={ink(0.3)} strokeWidth="1" />
      {options.map((t, i) => {
        const y = 2 + i * rowH, on = i === value, hv = i === hover
        return (
          <g key={t} className="sg-cell" onPointerDown={(e) => onRow?.(i, e)}>
            <rect x="2" y={y} width={width - 4} height={rowH} fill={on ? hue(c) : hv ? ink(0.08) : 'transparent'} />
            <text x="10" y={y + rowH / 2 + 3.5} fontSize="10" fontWeight={on ? 500 : 400} fill={on ? WALL : hv ? ink(1) : ink(0.62)}>{t}</text>
          </g>
        )
      })}
    </svg>
  )
}

/* ── the chevron that sits in the list's key ── */
export function Chevron ({ up }: { up?: boolean }): ReactNode {
  return (
    <svg className="sg-part" width="8" height="5" viewBox="0 0 8 5">
      <path d={up ? 'M0.5 4.5 L4 1 L7.5 4.5' : 'M0.5 0.5 L4 4 L7.5 0.5'} fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
