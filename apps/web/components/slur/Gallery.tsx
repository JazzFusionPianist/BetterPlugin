'use client'

import { useEffect, useRef, useState } from 'react'
import SlurMark from './SlurMark'
import RoomPicture from './RoomPicture'
import { C, FAMILIES } from './marks'

/* The first screen: full plates you page through — by the arrows, by a
   swipe or a trackpad, or by the keyboard — with a counter and a caption
   under them. teenage engineering's grammar, in Slur's voice. */

interface Plate { name: string; what: string; href?: string; body: React.ReactNode; tone: string }

const PLATES: Plate[] = [
  {
    name: 'patch on slur', what: 'night drive, fourteen prints wired', href: '/downloads#patch-on-slur', tone: 'night',
    body: <img src="/slur/night-drive.jpg" alt="Patch on Slur: a patch of fourteen prints on the wall" />,
  },
  { name: 'slur', what: 'the room: chat, stems, dates, who is in', href: '/downloads#slur', tone: 'mint', body: <RoomPicture /> },
  {
    name: 'patch on slur', what: 'eight families, told apart by shape', href: '/downloads#patch-on-slur', tone: 'night',
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
  { name: 'slur studio', what: 'the mark, one breath', tone: 'blue', body: <SlurMark className="sl-plate-mark" height={300} ink={C.white} arm={C.orange} /> },
  {
    name: 'downloads', what: 'one arch per plug-in', href: '/downloads', tone: 'paper',
    body: <img src="/slur/shelf.jpg" alt="The downloads shelf" />,
  },
]

const pad = (n: number) => String(n).padStart(2, '0')
/** One plate and the gap after it, as the track lays them out. */
const step = (el: HTMLElement) => ((el.firstElementChild as HTMLElement | null)?.offsetWidth ?? 1) + (parseFloat(getComputedStyle(el).columnGap) || 0)

export default function Gallery () {
  const track = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState(0)

  // the plate in view drives the counter and the caption
  useEffect(() => {
    const el = track.current; if (!el) return
    const onScroll = () => setAt(Math.max(0, Math.min(PLATES.length - 1, Math.round(el.scrollLeft / step(el)))))
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const go = (i: number) => {
    const el = track.current; if (!el) return
    const next = (i + PLATES.length) % PLATES.length   // past the last plate, back to the first
    el.scrollTo({ left: next * step(el), behavior: 'smooth' })
  }

  const p = PLATES[at]
  return (
    <section className="sl-gallery" aria-roledescription="gallery"
      onKeyDown={(e) => { if (e.key === 'ArrowRight') go(at + 1); if (e.key === 'ArrowLeft') go(at - 1) }}>
      <div className="sl-track" ref={track} tabIndex={0}>
        {PLATES.map((pl, i) => {
          const inner = <div className={`sl-plate ${pl.tone}`}>{pl.body}</div>
          return pl.href
            ? <a key={i} className="sl-plate-link" href={pl.href} aria-label={`${pl.name}, ${pl.what}`}>{inner}</a>
            : <div key={i} className="sl-plate-link">{inner}</div>
        })}
      </div>
      <div className="sl-under">
        <span className="n">{pad(at + 1)} / {pad(PLATES.length)}</span>
        <span className="nm">{p.name}</span>
        <span className="what">{p.what}</span>
        <span className="prog">{PLATES.map((_, i) => <i key={i} className={i === at ? 'on' : ''} onClick={() => go(i)} />)}</span>
        <span className="arrows">
          <button onClick={() => go(at - 1)} aria-label="previous"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M10 3 L5 8 L10 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
          <button onClick={() => go(at + 1)} aria-label="next"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M6 3 L11 8 L6 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
        </span>
      </div>
    </section>
  )
}
