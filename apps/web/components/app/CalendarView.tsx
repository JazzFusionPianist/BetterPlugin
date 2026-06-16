'use client'

import { useMemo, useState } from 'react'
import type { CalendarEvent, EventCategory } from '@orb/core'

interface Props {
  open: boolean
  events: CalendarEvent[]
  currentUserId: string
  categories: EventCategory[]
  groupTitleById: Map<string, string>
  onClose: () => void
  onDelete: (id: string) => void
  onSetCategory: (id: string, name: string) => void
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const DEFAULT_COLOR = '#7C7C86'

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function CalendarView({
  open, events, currentUserId, categories, groupTitleById, onClose, onDelete, onSetCategory,
}: Props) {
  const today = new Date()
  const todayKey = dayKey(today)
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const [selected, setSelected] = useState(todayKey)
  const [filter, setFilter] = useState<string | null>(null)   // category name
  const [editing, setEditing] = useState<string | null>(null) // event id

  const shown = useMemo(
    () => (filter ? events.filter((e) => e.category === filter) : events),
    [events, filter],
  )

  // day -> events, and day -> distinct category colors (for the dots)
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of shown) {
      const k = dayKey(new Date(e.starts_at))
      const arr = map.get(k) ?? []
      arr.push(e)
      map.set(k, arr)
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.all_day === b.all_day ? 0 : a.all_day ? -1 : 1) || a.starts_at.localeCompare(b.starts_at))
    }
    return map
  }, [shown])

  const dotColors = (k: string): string[] => {
    const arr = byDay.get(k)
    if (!arr) return []
    const seen: string[] = []
    for (const e of arr) {
      const c = e.category_color || DEFAULT_COLOR
      if (!seen.includes(c)) seen.push(c)
      if (seen.length === 3) break
    }
    return seen
  }

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
              <button className="cal-today" onClick={() => { setView({ y: today.getFullYear(), m: today.getMonth() }); setSelected(todayKey) }}>Today</button>
            )}
            <button className="cal-chev" onClick={() => step(-1)} aria-label="Previous month">‹</button>
            <button className="cal-chev" onClick={() => step(1)} aria-label="Next month">›</button>
            <button className="cal-close" onClick={onClose} aria-label="Close calendar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
            </button>
          </div>
        </header>

        {categories.length > 0 && (
          <div className="cal-filters">
            {categories.map((c) => (
              <button
                key={c.id}
                className={`cal-filter${filter === c.name ? ' on' : ''}`}
                onClick={() => setFilter((f) => (f === c.name ? null : c.name))}
                style={filter === c.name ? { color: c.color } : undefined}
              >
                <span className="cal-filter-dot" style={{ background: c.color }} />
                {c.name}
              </button>
            ))}
          </div>
        )}

        <div className="cal-week">{WEEKDAYS.map((d, i) => <span key={i}>{d}</span>)}</div>

        <div className="cal-grid">
          {cells.map((day, i) => {
            if (day === null) return <span key={`b${i}`} className="cal-pad" />
            const k = `${view.y}-${String(view.m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const dots = dotColors(k)
            const isToday = k === todayKey
            const isSel = k === selected
            return (
              <button key={k} className={`cal-day${isSel ? ' sel' : ''}${isToday ? ' today' : ''}`} onClick={() => setSelected(k)}>
                <span className="cal-num">{day}</span>
                {dots.length > 0 && (
                  <span className="cal-dots">
                    {dots.map((c, j) => <span key={j} className="cal-dot" style={{ background: c }} />)}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="cal-agenda">
          <div className="cal-agenda-date">
            {new Date(selected + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          {selectedEvents.length === 0 ? (
            <div className="cal-agenda-empty">Nothing scheduled{filter ? ` · ${filter}` : ''}</div>
          ) : (
            <ul className="cal-agenda-list">
              {selectedEvents.map((e) => {
                const color = e.category_color || DEFAULT_COLOR
                const group = e.conversation_id ? groupTitleById.get(e.conversation_id) : null
                const own = e.user_id === currentUserId
                return (
                  <li key={e.id} className="cal-ev">
                    <span className="cal-ev-time">
                      {e.all_day ? 'all day' : new Date(e.starts_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                    </span>
                    <span className="cal-ev-bar" style={{ background: color }} />
                    <div className="cal-ev-main">
                      <div className="cal-ev-title">{e.title}</div>
                      <div className="cal-ev-meta">
                        {e.category && <span className="cal-ev-cat">{e.category}</span>}
                        {group && (
                          <span className="cal-ev-group">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.4" /><path d="M3.5 19c0-3 2.6-4.6 5.5-4.6s5.5 1.6 5.5 4.6M15 18.6c0-1.8.9-3 2.6-3.2" /></svg>
                            {group}
                          </span>
                        )}
                        {e.location && <span className="cal-ev-loc">{e.location}</span>}
                      </div>
                      {editing === e.id && (
                        <div className="cal-catpick">
                          {categories.map((c) => (
                            <button key={c.id} className="cal-catpick-chip" onClick={() => { onSetCategory(e.id, c.name); setEditing(null) }}>
                              <span className="cal-filter-dot" style={{ background: c.color }} />{c.name}
                            </button>
                          ))}
                          <input
                            className="cal-catpick-new"
                            placeholder="New category…"
                            onKeyDown={(ev) => {
                              if (ev.key === 'Enter') {
                                const v = (ev.target as HTMLInputElement).value.trim()
                                if (v) { onSetCategory(e.id, v); setEditing(null) }
                              }
                            }}
                          />
                        </div>
                      )}
                    </div>
                    {own && (
                      <div className="cal-ev-actions">
                        <button className="cal-ev-act" onClick={() => setEditing((id) => (id === e.id ? null : e.id))} aria-label="Categorize">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20.4 14.5L16 10 4 22M14 6l4 4M3 17l4 4" /><path d="M12.5 3.5l8 8" /></svg>
                        </button>
                        <button className="cal-ev-act del" onClick={() => onDelete(e.id)} aria-label="Delete event">
                          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2.5 2.5l9 9M11.5 2.5l-9 9" /></svg>
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
