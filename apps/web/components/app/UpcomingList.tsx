'use client'

import { useMemo } from 'react'
import type { CalendarEvent } from '@orb/core'

interface Props {
  events: CalendarEvent[]
  onOpen: () => void
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

/** The programme margin, top-left of the home page — split at a glance
 *  into TODAY (times only, full ink) and NEXT (the following few days).
 *  Tapping any line opens the calendar. */
export default function UpcomingList({ events, onOpen }: Props) {
  const { todayRows, nextRows } = useMemo(() => {
    const now = new Date()
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayStart.getDate() + 1)
    const coming = events
      .filter((e) => new Date(e.starts_at) >= (e.all_day ? dayStart : now))
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    return {
      todayRows: coming.filter((e) => new Date(e.starts_at) < dayEnd).slice(0, 4),
      nextRows: coming.filter((e) => new Date(e.starts_at) >= dayEnd).slice(0, 4),
    }
  }, [events])

  if (todayRows.length === 0 && nextRows.length === 0) return null

  const today = new Date()
  const label = (iso: string): string => {
    const d = new Date(iso)
    const days = Math.floor(
      (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
        new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000,
    )
    if (days === 1) return 'tomorrow'
    if (days < 7) return d.toLocaleDateString('en-GB', { weekday: 'short' }).toLowerCase()
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toLowerCase()
  }

  return (
    <div className="uplist">
      <div className="uplist-head"><span>today</span></div>
      {todayRows.length === 0 ? (
        <div className="uplist-none">nothing today</div>
      ) : (
        <ul className="uplist-today">
          {todayRows.map((e) => (
            <li key={e.id}>
              <button className="uplist-row" onClick={onOpen}>
                <span className="uplist-date">{e.all_day ? 'all day' : fmtTime(e.starts_at)}</span>
                <span className="uplist-time" />
                <span className="uplist-dot" style={{ background: e.category_color || 'var(--blue)' }} />
                <span className="uplist-title">{e.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {nextRows.length > 0 && (
        <>
          <div className="uplist-head uplist-head-next"><span>next</span></div>
          <ul>
            {nextRows.map((e) => (
              <li key={e.id}>
                <button className="uplist-row" onClick={onOpen}>
                  <span className="uplist-date">{label(e.starts_at)}</span>
                  <span className="uplist-time">{e.all_day ? '' : fmtTime(e.starts_at)}</span>
                  <span className="uplist-dot" style={{ background: e.category_color || 'var(--blue)' }} />
                  <span className="uplist-title">{e.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
