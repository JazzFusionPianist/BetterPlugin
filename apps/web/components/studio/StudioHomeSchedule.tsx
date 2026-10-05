'use client'

/**
 * The home's schedule, in the pages' language: the prompt is a note
 * line (a whole note sends it; the targets are whole notes in each
 * room's colour), and the week is a mint arch: today first, as a list
 * you can read from across the room, then the six days after as
 * columns of white pills with a whole note in their category colour.
 * The home never scrolls: the list and the columns show as many as
 * their height holds, and only past that say "n more", which opens the
 * calendar.
 */

import { useEffect, useRef, useState } from 'react'
import { C, houseColor } from '../slur/marks'
import type { CalendarEvent } from '@orb/core'

/** A clock time as the app writes it: 7 pm, 7:30 pm, 12 am. */
const clock = (d: Date) => { const h = d.getHours(), m = d.getMinutes(); return `${((h + 11) % 12) + 1}${m ? ':' + String(m).padStart(2, '0') : ''} ${h >= 12 ? 'pm' : 'am'}` }

const pad = (n: number) => String(n).padStart(2, '0')
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const WD = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function ellipsePath(cx: number, cy: number, rx: number, ry: number, deg: number) {
  const t = deg * Math.PI / 180, dx = rx * Math.cos(t), dy = rx * Math.sin(t)
  return `M ${cx - dx} ${cy - dy} A ${rx} ${ry} ${deg} 1 0 ${cx + dx} ${cy + dy} A ${rx} ${ry} ${deg} 1 0 ${cx - dx} ${cy - dy} Z`
}
/** A whole note as an inline glyph. */
export function NoteGlyph({ size = 13, color, hollow = false, className }: { size?: number; color: string; hollow?: boolean; className?: string }) {
  const d = ellipsePath(20, 20, 17, 11.9, -22) + (hollow ? ' ' + ellipsePath(20, 20, 7.1, 8.8, 38) : '')
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <path d={d} fill={color} fillRule="evenodd" />
    </svg>
  )
}

export interface HomeTarget { id: string | null; label: string; color: string }

/** The note line — one pill, a whole note to send, targets as notes. */
export function StudioHomePrompt({ targets, onSubmit }: {
  targets: HomeTarget[]
  onSubmit: (text: string, conversationId: string | null) => Promise<string | null>
}) {
  const [text, setText] = useState('')
  const [target, setTarget] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ text: string; err?: boolean } | null>(null)
  const go = async () => {
    const t = text.trim()
    if (!t || busy) return
    setBusy(true); setNote(null)
    try {
      const err = await onSubmit(t, target)
      if (err) setNote({ text: err, err: true })
      else { setText(''); setNote({ text: 'added' }) ; window.setTimeout(() => setNote(null), 2400) }
    } finally { setBusy(false) }
  }
  return (
    <div className="wd-noteline">
      <div className={`wd-noteline-bar${busy ? ' busy' : ''}`}>
        <input value={text} placeholder="a rehearsal, a show, a deadline…" disabled={busy}
          onChange={e => { setText(e.target.value); setNote(null) }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); void go() } }} />
        <button className="wd-noteline-send" onClick={() => void go()} disabled={!text.trim() || busy} aria-label="add">
          <NoteGlyph size={30} color={text.trim() ? C.green : '#C0BCB3'} />
        </button>
      </div>
      <div className="wd-noteline-targets">
        {targets.map(t => (
          <button key={t.id ?? 'me'} className={`wd-noteline-target${target === t.id ? ' on' : ''}`} onClick={() => setTarget(t.id)}>
            <NoteGlyph size={13} color={t.color} hollow={target !== t.id} />{t.label}
          </button>
        ))}
        {note && <span className={`wd-noteline-note${note.err ? ' err' : ''}`}>{note.text}</span>}
      </div>
    </div>
  )
}

/** Today, then the six days after — the mint arch. */
export function StudioWeek({ events, groupTitleById, nowTick, onOpenCalendar, onOpenEvent }: {
  events: CalendarEvent[]
  groupTitleById: Map<string, string>
  nowTick: number
  onOpenCalendar: () => void
  onOpenEvent?: (id: string) => void
}) {
  const today = new Date(nowTick); today.setHours(0, 0, 0, 0)
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(today); d.setDate(today.getDate() + i); return d })
  const byDay = new Map<string, CalendarEvent[]>()
  for (const e of events) {
    const k = keyOf(new Date(e.starts_at))
    const arr = byDay.get(k) ?? []; arr.push(e); byDay.set(k, arr)
  }
  for (const arr of byDay.values()) arr.sort((a, b) => Number(b.all_day) - Number(a.all_day) || a.starts_at.localeCompare(b.starts_at))

  // how many rows today's list holds and how many pills a day's column holds, measured live
  const rowsRef = useRef<HTMLDivElement>(null)
  const daysRef = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState({ rows: 4, pills: 2 })
  useEffect(() => {
    const rows = rowsRef.current, cols = daysRef.current; if (!rows || !cols) return
    const measure = () => {
      const row = rows.querySelector<HTMLElement>('.wd-week-row')?.offsetHeight ?? 51
      const head = cols.querySelector<HTMLElement>('.wd-week-dh')?.offsetHeight ?? 24
      const pill = cols.querySelector<HTMLElement>('.wd-week-ev')?.offsetHeight ?? 47
      setFit({ rows: Math.max(1, Math.floor(rows.clientHeight / row)), pills: Math.max(1, Math.floor((cols.clientHeight - 10 - head) / (pill + 6))) })
    }
    measure()
    const ro = new ResizeObserver(measure); ro.observe(rows); ro.observe(cols)
    return () => ro.disconnect()
  }, [events.length])

  const colorOf = (e: CalendarEvent) => e.category_color || (e.conversation_id ? houseColor(e.conversation_id) : C.ink)
  const roomOf = (e: CalendarEvent) => (e.conversation_id ? groupTitleById.get(e.conversation_id) : null)
  const open = (e: CalendarEvent) => (onOpenEvent ? onOpenEvent(e.id) : onOpenCalendar())

  // today: what is over is dimmed, what comes next is marked; when the list is longer than its
  // height, what is over leaves first
  const over = (e: CalendarEvent) => !e.all_day && (e.ends_at ? new Date(e.ends_at).getTime() : new Date(e.starts_at).getTime() + 3600_000) < nowTick
  const mine = byDay.get(keyOf(today)) ?? []
  const next = mine.find(e => !e.all_day && !over(e))
  let rows = mine
  if (mine.length > fit.rows) {
    const keep = Math.max(1, fit.rows - 1)
    let drop = mine.length - keep
    rows = mine.filter(e => { if (drop > 0 && over(e)) { drop--; return false } return true }).slice(0, keep)
  }

  return (
    <div className="wd-week">
      <div className="wd-week-now">
        <div className="wd-week-head">
          <h2>today</h2>
          <span>{WD[today.getDay()]} {today.getDate()}</span>
        </div>
        <div className="wd-week-rows" ref={rowsRef}>
          {rows.map(e => {
            const room = roomOf(e)
            return (
              <button key={e.id} className={`wd-week-row${over(e) ? ' past' : ''}${e === next ? ' next' : ''}`} onClick={() => open(e)} title={e.title}>
                <time>{e.all_day ? 'all day' : clock(new Date(e.starts_at))}</time>
                <NoteGlyph size={15} color={colorOf(e)} />
                <b>{e.title}</b>
                {room && <small>{room}</small>}
              </button>
            )
          })}
          {mine.length > rows.length && <button className="wd-week-more" onClick={onOpenCalendar}>{mine.length - rows.length} more</button>}
          {mine.length === 0 && <p className="wd-week-none">nothing today</p>}
        </div>
      </div>
      <div className="wd-week-rest">
        <div className="wd-week-head">
          <h2>this week</h2>
          <button className="wd-week-cal" onClick={onOpenCalendar}>my calendar</button>
        </div>
        <div className="wd-week-days" ref={daysRef}>
          {days.slice(1).map(d => {
            const k = keyOf(d)
            const evs = byDay.get(k) ?? []
            const shown = evs.length <= fit.pills ? evs : evs.slice(0, Math.max(1, fit.pills - 1))   // the last row goes to "n more"
            return (
              <div key={k} className="wd-week-day">
                <div className="wd-week-dh">
                  <span>{WD[d.getDay()]}</span>
                  <b>{d.getDate()}</b>
                </div>
                {shown.map(e => {
                  const room = roomOf(e)
                  return (
                    <button key={e.id} className="wd-week-ev" onClick={() => open(e)} title={e.title}>
                      <NoteGlyph size={12} color={colorOf(e)} />
                      <span>
                        <b>{e.title}</b>
                        <small>{e.all_day ? 'all day' : clock(new Date(e.starts_at))}{room ? `  ${room}` : ''}</small>
                      </span>
                    </button>
                  )
                })}
                {evs.length > shown.length && (
                  <button className="wd-week-more" onClick={onOpenCalendar}>{evs.length - shown.length} more</button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
