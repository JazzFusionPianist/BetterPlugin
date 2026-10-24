'use client'

import { useEffect, useRef, useState } from 'react'
import SlurMark from './SlurMark'
import RoomPicture from './RoomPicture'
import PatchDiagram from './PatchDiagram'
import { C, FAMILIES, hz, play } from './marks'

/* The first screen: an exhibition wall. One work hangs at a time — Patch on
   Slur drawn as a diagram, the room, the song in Slur Studio, the families —
   its number painted large behind it, its label beside it, a shape of the
   wall's own (a red square, a yellow triangle, a blue circle, a black arch)
   moving in as the work changes. The work leans toward the pointer; a click
   turns to the next; the shapes at the corner go to any. */

type Shape = 'sq' | 'tri' | 'ci' | 'ar'
interface Work { name: string; what: string; medium: string; shape: Shape; ar: number; night?: boolean; step: number; body: React.ReactNode }

const BAUHAUS = { red: '#D52B1E', blue: '#1D4E9E', yellow: '#F2C230', ink: '#151412' }
const WORKS: Work[] = [
  { name: 'patch on slur', what: 'night drive, fourteen prints wired', medium: 'au vst3, 2026', shape: 'sq', ar: 1120 / 610, night: true, step: 5, body: <PatchDiagram /> },
  { name: 'slur', what: 'the room: chat, stems, dates, who is in', medium: 'au vst3 aax and the browser, 2026', shape: 'tri', ar: 82 / 51, step: 3, body: <RoomPicture /> },
  { name: 'slur studio', what: 'the song: eight tracks, the chorus in the cycle', medium: 'mac app, 2026', shape: 'ci', ar: 1.6, step: 1, body: <img src="/slur/studio/room-bauhaus.jpg" alt="Slur Studio with a song open" /> },
  {
    name: 'patch on slur', what: 'eight families, told apart by shape', medium: 'au vst3, 2026', shape: 'ar', ar: 1120 / 610, night: true, step: 6,
    body: (
      <svg viewBox="0 0 1120 610" aria-hidden="true">
        {FAMILIES.map((f, i) => {
          const x = 200 + (i % 4) * 240, y = 200 + Math.floor(i / 4) * 210
          return (
            <g key={f.name}>
              <path d={f.shape} fill={f.c} fillRule="evenodd" transform={`translate(${x} ${y}) scale(2.2)`} />
              <text x={x} y={y + 82} fill="rgba(251,250,247,.6)" fontSize={18} textAnchor="middle" fontFamily="Jost, sans-serif">{f.name}</text>
            </g>
          )
        })}
      </svg>
    ),
  },
]
const DWELL = 4600
const pad = (n: number) => String(n).padStart(2, '0')

/* the index of the wall's shapes: the one on the wall filled, the others drawn */
function Glyph ({ shape, on, s = 18 }: { shape: Shape; on: boolean; s?: number }) {
  const fill = on ? (shape === 'sq' ? BAUHAUS.red : shape === 'tri' ? BAUHAUS.yellow : shape === 'ci' ? BAUHAUS.blue : BAUHAUS.ink) : 'none'
  const p = { fill, stroke: BAUHAUS.ink, strokeWidth: 2 }
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true">
      {shape === 'sq' && <rect x={1} y={1} width={s - 2} height={s - 2} {...p} />}
      {shape === 'tri' && <path d={`M ${s / 2} 1 L ${s - 1} ${s - 1} L 1 ${s - 1} Z`} {...p} />}
      {shape === 'ci' && <circle cx={s / 2} cy={s / 2} r={s / 2 - 1} {...p} />}
      {shape === 'ar' && <path d={`M 1 ${s - 1} V ${s / 2} A ${s / 2 - 1} ${s / 2 - 1} 0 0 1 ${s - 1} ${s / 2} V ${s - 1} Z`} {...p} />}
    </svg>
  )
}

export default function Cover ({ nav }: { nav: React.ReactNode }) {
  const [at, setAt] = useState(0)
  const [lean, setLean] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // the next work after a while; a click turns it now and restarts the wait
  const schedule = (first = false) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { setAt(a => (a + 1) % WORKS.length); schedule() }, first ? DWELL + 1800 : DWELL)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { schedule(true); return () => { if (timer.current) clearTimeout(timer.current) } }, [])
  const go = (i: number) => { setAt(i); schedule() }

  // the work leans toward the pointer (mouse only: a phone keeps it flat)
  useEffect(() => {
    if (!window.matchMedia('(hover: hover)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const onMove = (e: PointerEvent) => {
      const rx = (e.clientY / innerHeight - .5) * -6, ry = (e.clientX / innerWidth - .5) * 8
      setLean(`perspective(1600px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`)
    }
    addEventListener('pointermove', onMove)
    return () => removeEventListener('pointermove', onMove)
  }, [])

  const w = WORKS[at]
  return (
    <section className="sl-ex">
      <svg className={`sl-ex-shape tri${w.shape === 'tri' ? ' on' : ''}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M 100 0 L 100 100 L 0 100 Z" fill={BAUHAUS.yellow} /></svg>
      {(['sq', 'ci', 'ar'] as Shape[]).map(s => <div key={s} className={`sl-ex-shape ${s}${w.shape === s ? ' on' : ''}`} aria-hidden="true" />)}
      <div className="sl-ex-num sl-num" key={`n${at}`} aria-hidden="true">{pad(at + 1)}</div>
      <header className="sl-ex-top">
        <a className="sl-logo" href="/" aria-label="slur studio"><SlurMark height={40} ink={C.ink} /><span>studio</span></a>
        {nav}
      </header>
      <div className="sl-ex-hang" key={`w${at}`} style={{ '--ar': w.ar } as React.CSSProperties}>
        <button className={`sl-work${w.night ? ' night' : ''}`} style={{ transform: lean }} onClick={() => go((at + 1) % WORKS.length)} aria-label={`${w.name}, ${w.what}. next`}>
          {w.body}
        </button>
        <div className="sl-label" aria-live="polite"><b>{w.name}</b><span>{w.what}</span><span>{w.medium}</span></div>
      </div>
      <nav className="sl-ex-index" aria-label="the works">
        {WORKS.map((x, i) => (
          <button key={i} onClick={() => { play(hz(x.step), 0, 1.4); go(i) }} aria-label={`${pad(i + 1)} ${x.name}`} aria-current={i === at || undefined}>
            <Glyph shape={x.shape} on={i === at} />
          </button>
        ))}
      </nav>
    </section>
  )
}
