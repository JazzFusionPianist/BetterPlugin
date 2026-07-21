'use client'

import { useMemo } from 'react'
import type { CalendarEvent } from '@orb/core'

interface Props {
  events: CalendarEvent[]
  onOpen: () => void
}

/** The next ten things on the calendar, printed quietly in the top-left
 *  of the home page like a programme margin — category dot, date, title.
 *  Tapping any line opens the calendar. */
export default function UpcomingList({ events, onOpen }: Props) {
  const rows = useMemo(() => {
    const now = new Date()
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return events
      .filter((e) => new Date(e.starts_at) >= (e.all_day ? dayStart : now))
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .slice(0, 10)
  }, [events])

  if (rows.length === 0) return null

  const today = new Date()
  const label = (iso: string): { text: string; isToday: boolean } => {
    const d = new Date(iso)
    const days = Math.floor(
      (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
        new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000,
    )
    if (days === 0) return { text: 'today', isToday: true }
    if (days === 1) return { text: 'tomorrow', isToday: false }
    return { text: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), isToday: false }
  }

  const dayOf = (iso: string) => new Date(iso).toDateString()

  return (
    <div className="uplist">
      <div className="uplist-head">upcoming</div>
      <ul>
        {rows.map((e, i) => {
          const l = label(e.starts_at)
          const newDay = i > 0 && dayOf(e.starts_at) !== dayOf(rows[i - 1]!.starts_at)
          return (
            <li key={e.id} className={newDay ? 'uplist-newday' : undefined}>
              <button className="uplist-row" onClick={onOpen}>
                <span className={`uplist-date${l.isToday ? ' today' : ''}`}>
                  {l.text}
                  {!e.all_day && (
                    <span className="uplist-time">
                      {new Date(e.starts_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  )}
                </span>
                <span className="uplist-dot" style={{ background: e.category_color || 'var(--blue)' }} />
                <span className="uplist-title">{e.title}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
