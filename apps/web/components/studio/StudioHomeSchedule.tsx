'use client'

/**
 * The home's schedule, in the pages' language: the prompt is a note
 * line (a whole note sends it; the targets are whole notes in each
 * room's colour, "my calendar" at the line's far end), and the week
 * is seven arches standing on the floor, one per day, today's in mint:
 * the date in the crown, the day's events under it as a whole note in
 * their category colour, a title and a time. The home never scrolls:
 * an arch shows as many as its height holds, and only past that says
 * "n more", which opens the calendar.
 */

import { useEffect, useRef, useState } from 'react'
import { C, houseColor } from '../slur/marks'
import type { CalendarEvent } from '@orb/core'

/** A clock time as the app writes it: 7 pm, 7:30 pm, 12 am. */
const clock = (d: Date) => { const h = d.getHours(), m = d.getMinutes(); return `${((h + 11) % 12) + 1}${m ? ':' + String(m).padStart(2, '0') : ''} ${h >= 12 ? 'pm' : 'am'}` }

const pad = (n: number) => String(n).padStart(2, '0')
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const WD = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const ARCH_GAP = 13   // between an arch's events

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
export function StudioHomePrompt({ targets, onSubmit, onOpenCalendar }: {
  targets: HomeTarget[]
  onSubmit: (text: string, conversationId: string | null) => Promise<string | null>
  onOpenCalendar?: () => void
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
      <div className="wd-noteline-row">
        <div className={`wd-noteline-bar${busy ? ' busy' : ''}`}>
          <input value={text} placeholder="a rehearsal, a show, a deadline…" disabled={busy}
            onChange={e => { setText(e.target.value); setNote(null) }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); void go() } }} />
          <button className="wd-noteline-send" onClick={() => void go()} disabled={!text.trim() || busy} aria-label="add">
            <NoteGlyph size={30} color={text.trim() ? C.green : '#C0BCB3'} />
          </button>
        </div>
        {onOpenCalendar && <button className="wd-noteline-cal" onClick={onOpenCalendar}>my calendar</button>}
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

/** The week — seven arches, one per day, today's in mint. */
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

  // how many events an arch's height holds, measured live
  const box = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(4)
  useEffect(() => {
    const el = box.current; if (!el) return
    const measure = () => {
      const head = el.querySelector<HTMLElement>('.wd-arch header')
      const row = el.querySelector<HTMLElement>('.wd-arch-ev')?.offsetHeight ?? 34
      const from = head ? head.getBoundingClientRect().bottom - el.getBoundingClientRect().top + 8 + ARCH_GAP : 110   // 8: the crown's own margin
      setFit(Math.max(1, Math.floor((el.clientHeight - from - 10 + ARCH_GAP) / (row + ARCH_GAP))))
    }
    measure()
    const ro = new ResizeObserver(measure); ro.observe(el)
    return () => ro.disconnect()
  }, [events.length])

  // today, what is over is dimmed — and leaves first when the arch is too short for the day
  const over = (e: CalendarEvent) => !e.all_day && (e.ends_at ? new Date(e.ends_at).getTime() : new Date(e.starts_at).getTime() + 3600_000) < nowTick

  return (
    <div className="wd-week" ref={box}>
      {days.map((d, i) => {
        const k = keyOf(d)
        const evs = byDay.get(k) ?? []
        let shown = evs
        if (evs.length > fit) {
          const keep = Math.max(1, fit - 1)   // the last row goes to "n more"
          let drop = i === 0 ? evs.length - keep : 0
          shown = evs.filter(e => { if (drop > 0 && over(e)) { drop--; return false } return true }).slice(0, keep)
        }
        return (
          <div key={k} className={`wd-arch${i === 0 ? ' today' : ''}`}>
            <header>
              <span>{WD[d.getDay()]}</span>
              <b>{d.getDate()}</b>
            </header>
            {shown.map(e => {
              const color = e.category_color || (e.conversation_id ? houseColor(e.conversation_id) : C.ink)
              const room = e.conversation_id ? groupTitleById.get(e.conversation_id) : null
              return (
                <button key={e.id} className={`wd-arch-ev${i === 0 && over(e) ? ' past' : ''}`} onClick={() => onOpenEvent ? onOpenEvent(e.id) : onOpenCalendar()} title={e.title}>
                  <NoteGlyph size={12} color={color} />
                  <span>
                    <b>{e.title}</b>
                    <small>{e.all_day ? 'all day' : clock(new Date(e.starts_at))}{room ? `  ${room}` : ''}</small>
                  </span>
                </button>
              )
            })}
            {evs.length > shown.length && (
              <button className="wd-arch-more" onClick={onOpenCalendar}>{evs.length - shown.length} more</button>
            )}
          </div>
        )
      })}
    </div>
  )
}
