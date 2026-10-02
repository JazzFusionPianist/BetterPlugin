'use client'

import { useEffect, useRef, useState } from 'react'
import SlurMark from './SlurMark'
import RoomPicture from './RoomPicture'
import PatchDiagram from './PatchDiagram'
import { FAMILIES } from './marks'

/* The first screen: one landscape print on an empty ground, turning its
   pages with hard cuts — Patch on Slur drawn as a diagram, the room, the
   families, the shelf. It leans toward the pointer; a click turns the
   page. The caption rides the top left, the name travels along the floor. */

interface Page { name: string; what: string; tone: string; body: React.ReactNode }

const PAGES: Page[] = [
  { name: 'patch on slur', what: 'night drive, fourteen prints wired', tone: 'night', body: <PatchDiagram /> },
  { name: 'slur', what: 'the room: chat, stems, dates, who is in', tone: 'mint', body: <RoomPicture /> },
  {
    name: 'patch on slur', what: 'eight families, told apart by shape', tone: 'night',
    body: (
      <svg viewBox="0 0 1120 610" aria-hidden="true">
        {FAMILIES.map((f, i) => {
          const x = 200 + (i % 4) * 240, y = 200 + Math.floor(i / 4) * 210
          return (
            <g key={f.name}>
              <path d={f.shape} fill={f.c} fillRule="evenodd" transform={`translate(${x} ${y}) scale(2.2)`} />
              <text x={x} y={y + 82} fill="rgba(251,250,247,.6)" fontSize={18} textAnchor="middle">{f.name}</text>
            </g>
          )
        })}
      </svg>
    ),
  },
  { name: 'downloads', what: 'one arch per plug-in', tone: 'paper', body: <img src="/slur/shelf.jpg" alt="The downloads shelf" /> },
]
const DWELL = 3200
const pad = (n: number) => String(n).padStart(2, '0')

export default function Cover ({ nav }: { nav: React.ReactNode }) {
  const [at, setAt] = useState(0)
  const [lean, setLean] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // turn the page every few seconds; a click turns it now and restarts the wait
  const schedule = (first = false) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { setAt(a => (a + 1) % PAGES.length); schedule() }, first ? DWELL + 2000 : DWELL)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { schedule(true); return () => { if (timer.current) clearTimeout(timer.current) } }, [])
  const next = () => { setAt(a => (a + 1) % PAGES.length); schedule() }

  // the print leans toward the pointer (mouse only: a phone keeps it flat)
  useEffect(() => {
    if (!window.matchMedia('(hover: hover)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const onMove = (e: PointerEvent) => {
      const rx = (e.clientY / innerHeight - .5) * -7, ry = (e.clientX / innerWidth - .5) * 9
      setLean(`rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`)
    }
    addEventListener('pointermove', onMove)
    return () => removeEventListener('pointermove', onMove)
  }, [])

  const p = PAGES[at]
  return (
    <section className="sl-cover">
      <header className="sl-cover-top">
        <span className="sl-cover-cap" aria-live="polite"><b>{pad(at + 1)} / {pad(PAGES.length)}</b><span>{p.name}</span><i>{p.what}</i></span>
        {nav}
      </header>
      <div className="sl-cover-stage">
        <button className="sl-print" style={{ transform: lean }} onClick={next} aria-label={`${p.name}, ${p.what}. next`}>
          {PAGES.map((pg, i) => <div key={i} className={`sl-print-page ${pg.tone}${i === at ? ' on' : ''}`} aria-hidden={i !== at}>{pg.body}</div>)}
        </button>
      </div>
      <div className="sl-floor" aria-hidden="true">
        <div className="sl-floor-in"><div><SlurMark height={56} /></div><div><SlurMark height={56} /></div></div>
      </div>
    </section>
  )
}
