'use client'

import { useMemo, useState } from 'react'
import type { CalendarEvent } from '@orb/core'

interface Props {
  open: boolean
  events: CalendarEvent[]
  onClose: () => void
  onDelete: (id: string) => void
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function CalendarView({ open, events, onClose, onDelete }: Props) {
  const today = new Date()
  const todayKey = dayKey(today)
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const [selected, setSelected] = useState(todayKey)

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      const k = dayKey(new Date(e.starts_at))
      const arr = map.get(k) ?? []
      arr.push(e)
      map.set(k, arr)
    }
    for (const arr of map.values()) {
      arr.sort((a, b) =>
        (a.all_day === b.all_day ? 0 : a.all_day ? -1 : 1) || a.starts_at.localeCompare(b.starts_at))
    }
    return map
  }, [events])

  const firstWeekday = new Date(view.y, view.m, 1).getDay()
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const step = (dir: number) =>
    setView((v) => {
      const m = v.m + dir
      if (m < 0) return { y: v.y - 1, m: 11 }
      if (m > 11) return { y: v.y + 1, m: 0 }
      return { y: v.y, m }
    })

  const onCurrentMonth = view.y === today.getFullYear() && view.m === today.getMonth()
  const selectedEvents = byDay.get(selected) ?? []

  return (
    <div className={`cal${open ? ' open' : ''}`} aria-hidden={!open}>
      <div className="cal-sheet">
        <header className="cal-top">
          <h2 className="cal-month">{MONTHS[view.m]} <span>{view.y}</span></h2>
          <div className="cal-tools">
            {!onCurrentMonth && (
              <button className="cal-today" onClick={() => { setView({ y: today.getFullYear(), m: today.getMonth() }); setSelected(todayKey) }}>
                Today
              </button>
            )}
            <button className="cal-chev" onClick={() => step(-1)} aria-label="Previous month">‹</button>
            <button className="cal-chev" onClick={() => step(1)} aria-label="Next month">›</button>
            <button className="cal-close" onClick={onClose} aria-label="Close calendar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
            </button>
          </div>
        </header>

        <div className="cal-week">
          {WEEKDAYS.map((d, i) => <span key={i}>{d}</span>)}
        </div>

        <div className="cal-grid">
          {cells.map((day, i) => {
            if (day === null) return <span key={`b${i}`} className="cal-pad" />
            const k = `${view.y}-${String(view.m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const has = byDay.has(k)
            const isToday = k === todayKey
            const isSel = k === selected
            return (
              <button
                key={k}
                className={`cal-day${isSel ? ' sel' : ''}${isToday ? ' today' : ''}`}
                onClick={() => setSelected(k)}
              >
                <span className="cal-num">{day}</span>
                {has && <span className="cal-dot" />}
              </button>
            )
          })}
        </div>

        <div className="cal-agenda">
          <div className="cal-agenda-date">
            {new Date(selected + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          {selectedEvents.length === 0 ? (
            <div className="cal-agenda-empty">Nothing scheduled</div>
          ) : (
            <ul className="cal-agenda-list">
              {selectedEvents.map((e) => (
                <li key={e.id} className="cal-ev">
                  <span className="cal-ev-time">
                    {e.all_day
                      ? 'all day'
                      : new Date(e.starts_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                  </span>
                  <div className="cal-ev-main">
                    <div className="cal-ev-title">{e.title}</div>
                    {e.location && <div className="cal-ev-loc">{e.location}</div>}
                  </div>
                  <button className="cal-ev-del" onClick={() => onDelete(e.id)} aria-label="Delete event">
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2.5 2.5l9 9M11.5 2.5l-9 9" /></svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
