'use client'

import { useState } from 'react'
import { C, hz, play, slurPath, wholeNotePath } from './marks'

export interface BarNote { x: number; step: number; color: string; hollow?: boolean }

/** A bar of music: five hairlines, the notes, one engraved slur over all of
    them. The slur draws in from the left; touching a note sounds it,
    touching the slur plays the phrase. */
export default function Bar ({ w, h, y0, gap, s, notes, line = 'rgba(26,25,23,.28)', tie = C.ink, className, onNote }: {
  w: number; h: number; y0: number; gap: number; s: number
  notes: BarNote[]
  line?: string
  tie?: string
  className?: string
  /** A note was touched (after it rings). */
  onNote?: (index: number) => void
}) {
  const [ringing, setRinging] = useState<Record<number, number>>({})
  const yOf = (step: number) => y0 + 4 * gap - step * gap / 2
  const pts = notes.map(n => ({ ...n, y: yOf(n.step) }))
  const first = pts[0], last = pts[pts.length - 1]
  const hi = Math.min(...pts.map(p => p.y))
  const lift = (Math.max(first.y, last.y) - hi) + s * 1.1
  const tieD = slurPath(first.x - s * .2, first.y - s * 1.05, last.x + s * .2, last.y - s * 1.05, lift, s * .22)

  const ring = (i: number, step: number) => {
    play(hz(step))
    setRinging(r => ({ ...r, [i]: (r[i] ?? 0) + 1 }))   // a new key restarts the ring animation
  }

  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {[0, 1, 2, 3, 4].map(i => <line key={i} x1={0} x2={w} y1={y0 + i * gap} y2={y0 + i * gap} stroke={line} strokeWidth={1} />)}
      <path className="sl-tie" d={tieD} fill={tie} style={{ cursor: 'pointer' }}
        onClick={() => pts.forEach((p, i) => play(hz(p.step), i * .16, 1.4))} />
      {pts.map((p, i) => (
        <g key={`${i}-${ringing[i] ?? 0}`} className={`sl-note${ringing[i] ? ' ring' : ' in'}`}
          style={{ animationDelay: ringing[i] ? '0s' : `${.15 + i * .12}s` }} onClick={() => { ring(i, p.step); onNote?.(i) }}>
          <path d={wholeNotePath(p.x, p.y, s, p.hollow !== false)} fill={p.color} fillRule="evenodd" />
        </g>
      ))}
    </svg>
  )
}
