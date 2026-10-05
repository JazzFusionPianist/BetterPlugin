'use client'

/**
 * The home's picture — the landing's bar, with your people as the
 * notes: one whole note per friend in their colour, filled when they
 * are in the studio or online, hollow when away, all tied by one slur.
 * Touch a note and it rings and opens that person's room.
 *
 * It is drawn in real pixels at the pane's own width: the staff, the
 * notes and the names keep their size and only the space between notes
 * stretches, so nothing is cropped at any width. People who are here
 * come first; when there are more than the pane holds, the strip is
 * longer than the pane and slides.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { C, houseColor, hz, play, slurPath, wholeNotePath } from '../slur/marks'
import type { Profile } from '@orb/core'

const H = 206          // the bar's height
const Y0 = 62          // the staff's top line
const GAP = 20         // between staff lines
const S = 17           // a note's half-width
const MIN = 96         // notes are never closer than this
const TIE = 4.2        // the slur's thickness
const STEPS = [1, 4, 7, 2, 6, 3, 5, 4]
const yOf = (step: number) => Y0 + 4 * GAP - (step * GAP) / 2

export default function StudioHomeBar({ friends, onlineIds, studioIds, onOpen }: {
  friends: Profile[]
  onlineIds: Set<string>
  studioIds?: Set<string>
  onOpen: (userId: string) => void
}) {
  // the pane's width, live
  const box = useRef<HTMLDivElement>(null)
  const strip = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = box.current; if (!el) return
    const measure = () => setW(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure); ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // who is here comes first: in the studio, then online, then away (each group as the list gave them)
  const list = useMemo(() => {
    const rank = (p: Profile) => (studioIds?.has(p.id) ? 0 : onlineIds.has(p.id) ? 1 : 2)
    return friends.map((p, i) => ({ p, i, r: rank(p) })).sort((a, b) => a.r - b.r || a.i - b.i).map(x => ({ p: x.p, state: x.r === 0 ? 'studio' : x.r === 1 ? 'on' : 'off' }))
  }, [friends, onlineIds, studioIds])

  // a quiet bar when there is no one yet — three house notes
  const quiet = list.length === 0
  const n = quiet ? 3 : list.length
  const pad = Math.min(160, Math.max(64, w * 0.09))
  const gap = n === 1 ? 0 : Math.max(MIN, (w - 2 * pad) / (n - 1))
  const full = Math.max(w, n === 1 ? w : 2 * pad + (n - 1) * gap)      // the strip's whole length
  const pts = Array.from({ length: n }, (_, i) => ({ x: n === 1 ? w / 2 : pad + i * gap, step: quiet ? [2, 5, 4][i]! : STEPS[i % STEPS.length]! }))
    .map(q => ({ ...q, y: yOf(q.step) }))
  const first = pts[0]!, last = pts[n - 1]!
  // the slur starts over the first note and lands over the last, and is lifted — its crown first, then
  // its ends — until its underside clears every note in between
  const x0 = first.x - S * 0.2, x1 = last.x + S * 0.2
  let top = Math.max(7, Math.min(...pts.map(q => q.y)) - S * 1.15 - 26)
  let ya = first.y - S * 1.15, yb = last.y - S * 1.15
  const under = (x: number) => {
    const u = Math.min(1, Math.max(0, (x - x0) / (x1 - x0 || 1)))
    let a = 0, b = 1
    for (let k = 0; k < 18; k++) { const t = (a + b) / 2, m = 1 - t; if (3 * m * m * t * 0.22 + 3 * m * t * t * 0.78 + t * t * t < u) a = t; else b = t }
    const t = (a + b) / 2, m = 1 - t
    return m * m * m * ya + 3 * m * t * (top + TIE * 1.35) + t * t * t * yb
  }
  for (let k = 0; k < 60 && n > 2; k++) {
    let worst = -1, by = 0
    pts.forEach((q, i) => {
      if (i === 0 || i === n - 1) return
      const over = Math.max(under(q.x - S), under(q.x), under(q.x + S)) - (q.y - S * 0.7 - 8)
      if (over > by) { by = over; worst = i }
    })
    if (worst < 0) break
    if (top > 7) top = Math.max(7, top - 4)
    else if (pts[worst]!.x - x0 < x1 - pts[worst]!.x) { if (ya <= top + 10) break; ya -= 4 }
    else { if (yb <= top + 10) break; yb -= 4 }
  }
  const tie = slurPath(x0, ya, x1, yb, Math.min(ya, yb) - top, TIE)

  // how far the strip has slid, for the arrows and the count of people still off the edge
  const [left, setLeft] = useState(0)
  const max = Math.max(0, full - w)
  useEffect(() => { if (strip.current && strip.current.scrollLeft > max) strip.current.scrollLeft = max }, [max])
  const slide = (dir: 1 | -1) => strip.current?.scrollBy({ left: dir * Math.max(MIN * 2, w * 0.6), behavior: 'smooth' })
  const beyond = pts.filter(q => q.x > left + w - 60).length

  const [rung, setRung] = useState<Record<number, number>>({})
  const touch = (i: number) => {
    play(hz(pts[i]!.step))
    setRung(r => ({ ...r, [i]: (r[i] ?? 0) + 1 }))
    const who = list[i]; if (who) onOpen(who.p.id)
  }
  const quietColors = [C.ink, C.orange, C.blue]

  return (
    <div className="wd-bar" ref={box}>
      <div className="wd-bar-strip" ref={strip} onScroll={e => setLeft((e.target as HTMLDivElement).scrollLeft)}>
        {w > 0 && (
          <div className="wd-bar-sheet" style={{ width: full }}>
            <svg width={full} height={H} viewBox={`0 0 ${full} ${H}`} aria-hidden="true">
              {[0, 1, 2, 3, 4].map(i => <line key={i} x1={0} x2={full} y1={Y0 + i * GAP} y2={Y0 + i * GAP} stroke="rgba(26,25,23,.18)" strokeWidth={1} />)}
              {n > 1 && <path className="sl-tie" d={tie} fill={C.ink} onClick={() => pts.forEach((q, i) => play(hz(q.step), i * 0.14, 1.4))} />}
              {pts.map((q, i) => {
                const who = list[i]
                return (
                  <g key={`${who?.p.id ?? i}-${rung[i] ?? 0}`} className={`sl-note${rung[i] ? ' ring' : ' in'}`}
                    style={{ animationDelay: rung[i] ? '0s' : `${0.1 + Math.min(i, 10) * 0.08}s` }} onClick={() => touch(i)}>
                    <path d={wholeNotePath(q.x, q.y, S, quiet ? i === 1 : who!.state === 'off')} fill={quiet ? quietColors[i]! : houseColor(who!.p.id) || C.blue} fillRule="evenodd" />
                  </g>
                )
              })}
            </svg>
            {list.map((who, i) => (
              <button key={who.p.id} className={`wd-bar-name ${who.state}`} style={{ left: pts[i]!.x, top: Y0 + 4 * GAP + 20 }} onClick={() => onOpen(who.p.id)} title={who.p.display_name}>
                <span>{who.p.display_name}</span>
                {who.state === 'studio' && <small>in the studio</small>}
              </button>
            ))}
          </div>
        )}
      </div>
      {left > 4 && (
        <>
          <div className="wd-bar-fade back" />
          <button className="wd-bar-go back" onClick={() => slide(-1)} aria-label="earlier people"><i>‹</i></button>
        </>
      )}
      {left < max - 4 && (
        <>
          <div className="wd-bar-fade" />
          <button className="wd-bar-go" onClick={() => slide(1)} aria-label={`${beyond} more people`}><i>›</i>{beyond > 0 && <span>{beyond} more</span>}</button>
        </>
      )}
    </div>
  )
}
