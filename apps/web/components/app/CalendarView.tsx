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
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const [selected, setSelected] = useState(dayKey(today))

  // Group events by local day.
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

  const step = (dir: number) => {
    setView((v) => {
      const m = v.m + dir
      if (m < 0) return { y: v.y - 1, m: 11 }
      if (m > 11) return { y: v.y + 1, m: 0 }
      return { y: v.y, m }
    })
  }

  const selectedEvents = byDay.get(selected) ?? []
  const todayKey = dayKey(today)

  return (
    <div className={`calview${open ? ' open' : ''}`} aria-hidden={!open}>
      <header className="calview-head">
        <div className="calview-title">{MONTHS[view.m]} {view.y}</div>
        <div className="calview-nav">
          <button onClick={() => step(-1)} aria-label="Previous month">‹</button>
          <button onClick={() => { setView({ y: today.getFullYear(), m: today.getMonth() }); setSelected(todayKey) }}>Today</button>
          <button onClick={() => step(1)} aria-label="Next month">›</button>
          <button className="calview-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
      </header>

      <div className="calview-grid">
        {WEEKDAYS.map((d, i) => <div key={`wd${i}`} className="calview-wd">{d}</div>)}
        {cells.map((day, i) => {
          if (day === null) return <div key={`b${i}`} className="calview-cell empty" />
          const k = `${view.y}-${String(view.m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const has = byDay.has(k)
          return (
            <button
              key={k}
              className={`calview-cell${k === selected ? ' selected' : ''}${k === todayKey ? ' today' : ''}`}
              onClick={() => setSelected(k)}
            >
              <span className="calview-daynum">{day}</span>
              {has && <span className="calview-evdot" />}
            </button>
          )
        })}
      </div>

      <div className="calview-day">
        <div className="calview-day-label">
          {new Date(selected + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
        {selectedEvents.length === 0 ? (
          <div className="calview-empty">No events</div>
        ) : (
          <ul className="calview-events">
            {selectedEvents.map((e) => (
              <li key={e.id} className="calview-event">
                <span className="calview-event-time">
                  {e.all_day
                    ? 'All day'
                    : new Date(e.starts_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                </span>
                <div className="calview-event-body">
                  <div className="calview-event-title">{e.title}</div>
                  {e.location && <div className="calview-event-loc">{e.location}</div>}
                </div>
                <button className="calview-event-del" onClick={() => onDelete(e.id)} aria-label="Delete event">✕</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
