'use client'

import { useState } from 'react'
import { hz, play } from './marks'

/* The door's slab: red, its free side a half circle, and on it a score of
   points and lines — a phrase as kandinsky would draw one: a big point with
   a held line after it, a blue point higher up, a yellow triangle low, small
   points between, and the engraved slur over the phrase. A point touched
   sounds its note; the slur plays the phrase. */

const PAPER = '#F1ECDF', INK = '#151412', RED = '#D52B1E', BLUE = '#1D4E9E', YELLOW = '#F2C230'
interface Pt { step: number; draw: (cls: string, onClick: () => void) => React.ReactNode }
const PTS: Pt[] = [
  { step: 0, draw: (c, on) => <circle className={c} onClick={on} cx={72} cy={405} r={9} fill={INK} /> },
  { step: 2, draw: (c, on) => <g className={c} onClick={on}><circle cx={180} cy={480} r={62} fill={INK} /><circle cx={180} cy={480} r={22} fill={RED} /></g> },
  { step: 4, draw: (c, on) => <circle className={c} onClick={on} cx={295} cy={525} r={7} fill={INK} /> },
  { step: 6, draw: (c, on) => <circle className={c} onClick={on} cx={390} cy={420} r={38} fill={BLUE} /> },
  { step: 3, draw: (c, on) => <path className={c} onClick={on} d="M 540 470 L 620 560 L 460 560 Z" fill={YELLOW} /> },
  { step: 7, draw: (c, on) => <circle className={c} onClick={on} cx={665} cy={435} r={11} fill={INK} /> },
]

export default function DoorScore () {
  const [ringing, setRinging] = useState<Record<number, number>>({})
  const ring = (i: number) => { play(hz(PTS[i].step)); setRinging(r => ({ ...r, [i]: (r[i] ?? 0) + 1 })) }
  return (
    <svg className="sl-score" viewBox="0 0 720 900" preserveAspectRatio="xMinYMid slice" aria-hidden="true">
      <path d="M 0 0 H 260 A 450 450 0 0 1 260 900 H 0 Z" fill={RED} />
      {[0, 1, 2, 3, 4].map(i => <rect key={i} x={0} y={390 + i * 30} width={712} height={2} fill={PAPER} opacity={.55} />)}
      <rect x={235} y={465} width={120} height={8} fill={INK} />
      <path className="tie" d="M 130 380 C 240 230, 500 230, 620 400 C 500 252, 240 252, 130 380 Z" fill={INK}
        onClick={() => PTS.forEach((p, i) => play(hz(p.step), i * .16, 1.4))} />
      {PTS.map((p, i) => (
        <g key={`${i}-${ringing[i] ?? 0}`} className={ringing[i] ? '' : 'in'} style={{ animationDelay: `${.15 + i * .1}s` }}>
          {p.draw(`pt${ringing[i] ? ' ring' : ''}`, () => ring(i))}
        </g>
      ))}
    </svg>
  )
}
