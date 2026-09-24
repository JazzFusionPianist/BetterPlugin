/**
 * The home's schedule, in the pages' language: the prompt is a note
 * line (a whole note sends it; the targets are whole notes in each
 * room's colour), and "this week" is a mint arch holding seven days as
 * columns — today an ink disc, events as white pills with a whole note
 * in their category colour. The home never scrolls: a column shows two
 * and says "n more", which opens the calendar.
 */

import { useState } from 'react'
import { C, houseColor } from '../../slur/marks'
import type { CalendarEvent } from '../../hooks/useCalendarEvents'

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

/** This week — the mint arch. */
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
  const CAP = 2
  return (
    <div className="wd-week">
      <div className="wd-week-head">
        <h2>this week</h2>
        <button className="wd-week-cal" onClick={onOpenCalendar}>my calendar</button>
      </div>
      <div className="wd-week-days">
        {days.map((d, i) => {
          const k = keyOf(d)
          const evs = byDay.get(k) ?? []
          const shown = evs.slice(0, CAP)
          return (
            <div key={k} className="wd-week-day">
              <div className="wd-week-dh">
                <span>{WD[d.getDay()]}</span>
                {i === 0 ? <em>{d.getDate()}</em> : <b>{d.getDate()}</b>}
              </div>
              {shown.map(e => {
                const color = e.category_color || (e.conversation_id ? houseColor(e.conversation_id) : C.ink)
                const t = new Date(e.starts_at)
                const room = e.conversation_id ? groupTitleById.get(e.conversation_id) : null
                return (
                  <button key={e.id} className="wd-week-ev" onClick={() => onOpenEvent ? onOpenEvent(e.id) : onOpenCalendar()} title={e.title}>
                    <NoteGlyph size={12} color={color} />
                    <span>
                      <b>{e.title}</b>
                      <small>{e.all_day ? 'all day' : `${pad(t.getHours())}:${pad(t.getMinutes())}`}{room ? `  ${room}` : ''}</small>
                    </span>
                  </button>
                )
              })}
              {evs.length > CAP && (
                <button className="wd-week-more" onClick={onOpenCalendar}>{evs.length - CAP} more</button>
              )}
              {evs.length === 0 && <span className="wd-week-ln" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
