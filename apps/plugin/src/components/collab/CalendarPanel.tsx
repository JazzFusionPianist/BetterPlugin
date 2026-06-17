import { useMemo, useRef, useState } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { useCalendarEvents, type CalendarEvent } from '../../hooks/useCalendarEvents'
import { useEventCategories } from '../../hooks/useEventCategories'
import { parseSchedule } from '../../lib/parseSchedule'

interface GroupTarget { conversationId: string; title: string }
interface Props {
  supabase: SupabaseClient
  user: User
  groups: GroupTarget[]
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const DEFAULT_COLOR = '#7C7C86'

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const fmtWhen = (e: CalendarEvent) => {
  const d = new Date(e.starts_at)
  const day = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  if (e.all_day) return `${day} · all day`
  return `${day} · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
}

export default function CalendarPanel({ supabase, user, groups }: Props) {
  const { events, addEvents, deleteEvent, updateEvent } = useCalendarEvents(supabase, user.id)
  const { categories, ensureCategory } = useEventCategories(supabase, user.id)

  const today = new Date()
  const todayKey = dayKey(today)
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const [selected, setSelected] = useState(todayKey)
  const [filter, setFilter] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)

  // Prompt state
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState<CalendarEvent[] | null>(null)
  const [target, setTarget] = useState<string | null>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const targets = useMemo(
    () => [{ id: null as string | null, label: 'Personal' }, ...groups.map((g) => ({ id: g.conversationId, label: g.title || 'Group' }))],
    [groups],
  )
  const groupTitleById = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of groups) m.set(g.conversationId, g.title || 'Group')
    return m
  }, [groups])

  const shown = useMemo(() => (filter ? events.filter((e) => e.category === filter) : events), [events, filter])
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of shown) {
      const k = dayKey(new Date(e.starts_at))
      const arr = map.get(k) ?? []
      arr.push(e); map.set(k, arr)
    }
    for (const arr of map.values())
      arr.sort((a, b) => (a.all_day === b.all_day ? 0 : a.all_day ? -1 : 1) || a.starts_at.localeCompare(b.starts_at))
    return map
  }, [shown])

  const dotColors = (k: string): string[] => {
    const arr = byDay.get(k); if (!arr) return []
    const seen: string[] = []
    for (const e of arr) { const c = e.category_color || DEFAULT_COLOR; if (!seen.includes(c)) seen.push(c); if (seen.length === 3) break }
    return seen
  }

  const firstWeekday = new Date(view.y, view.m, 1).getDay()
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const step = (dir: number) => setView((v) => {
    const m = v.m + dir
    if (m < 0) return { y: v.y - 1, m: 11 }
    if (m > 11) return { y: v.y + 1, m: 0 }
    return { y: v.y, m }
  })
  const onCurrentMonth = view.y === today.getFullYear() && view.m === today.getMonth()
  const selectedEvents = byDay.get(selected) ?? []

  const grow = () => { const ta = taRef.current; if (!ta) return; ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 110) + 'px' }
  const submit = async () => {
    const value = text.trim()
    if (!value || busy) return
    setBusy(true); setError(null); setAdded(null)
    try {
      const parsed = await parseSchedule(supabase, value)
      const withMeta = await Promise.all(parsed.map(async (e) => ({ ...e, category_color: await ensureCategory(e.category), conversation_id: target })))
      const ins = await addEvents(withMeta)
      setAdded(ins); setText(''); if (taRef.current) taRef.current.style.height = 'auto'
      if (ins[0]) { const d = new Date(ins[0].starts_at); setView({ y: d.getFullYear(), m: d.getMonth() }); setSelected(dayKey(d)) }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally { setBusy(false) }
  }

  return (
    <div className="cal-panel">
      <div className="cal-panel-head">
        <h2 className="cal-month">{MONTHS[view.m]} <span>{view.y}</span></h2>
        <div className="cal-tools">
          {!onCurrentMonth && <button className="cal-today" onClick={() => { setView({ y: today.getFullYear(), m: today.getMonth() }); setSelected(todayKey) }}>Today</button>}
          <button className="cal-chev" onClick={() => step(-1)} aria-label="Previous month">‹</button>
          <button className="cal-chev" onClick={() => step(1)} aria-label="Next month">›</button>
        </div>
      </div>

      <div className="cal-body">
        {categories.length > 0 && (
          <div className="cal-filters">
            {categories.map((c) => (
              <button key={c.id} className={`cal-filter${filter === c.name ? ' on' : ''}`} onClick={() => setFilter((f) => (f === c.name ? null : c.name))} style={filter === c.name ? { color: c.color } : undefined}>
                <span className="cal-filter-dot" style={{ background: c.color }} />{c.name}
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
            return (
              <button key={k} className={`cal-day${k === selected ? ' sel' : ''}${k === todayKey ? ' today' : ''}`} onClick={() => setSelected(k)}>
                <span className="cal-num">{day}</span>
                {dots.length > 0 && <span className="cal-dots">{dots.map((c, j) => <span key={j} className="cal-dot" style={{ background: c }} />)}</span>}
              </button>
            )
          })}
        </div>

        <div className="cal-agenda">
          <div className="cal-agenda-date">{new Date(selected + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          {selectedEvents.length === 0 ? (
            <div className="cal-agenda-empty">Nothing scheduled{filter ? ` · ${filter}` : ''}</div>
          ) : (
            <ul className="cal-agenda-list">
            {selectedEvents.map((e) => {
              const color = e.category_color || DEFAULT_COLOR
              const group = e.conversation_id ? groupTitleById.get(e.conversation_id) : null
              const own = e.user_id === user.id
              return (
                <li key={e.id} className="cal-ev">
                  <span className="cal-ev-time">{e.all_day ? 'all day' : new Date(e.starts_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
                  <span className="cal-ev-bar" style={{ background: color }} />
                  <div className="cal-ev-main">
                    <div className="cal-ev-title">{e.title}</div>
                    <div className="cal-ev-meta">
                      {e.category && <span className="cal-ev-cat">{e.category}</span>}
                      {group && <span className="cal-ev-group"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.4" /><path d="M3.5 19c0-3 2.6-4.6 5.5-4.6s5.5 1.6 5.5 4.6M15 18.6c0-1.8.9-3 2.6-3.2" /></svg>{group}</span>}
                      {e.location && <span className="cal-ev-loc">{e.location}</span>}
                    </div>
                    {editing === e.id && (
                      <div className="cal-catpick">
                        {categories.map((c) => (
                          <button key={c.id} className="cal-catpick-chip" onClick={async () => { const col = await ensureCategory(c.name); updateEvent(e.id, { category: c.name, category_color: col }).catch(() => {}); setEditing(null) }}>
                            <span className="cal-filter-dot" style={{ background: c.color }} />{c.name}
                          </button>
                        ))}
                        <input className="cal-catpick-new" placeholder="New category…" onKeyDown={async (ev) => { if (ev.key === 'Enter') { const v = (ev.target as HTMLInputElement).value.trim(); if (v) { const col = await ensureCategory(v); updateEvent(e.id, { category: v, category_color: col }).catch(() => {}); setEditing(null) } } }} />
                      </div>
                    )}
                  </div>
                  {own && (
                    <div className="cal-ev-actions">
                      <button className="cal-ev-act" onClick={() => setEditing((id) => (id === e.id ? null : e.id))} aria-label="Categorize">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20.4 14.5L16 10 4 22M14 6l4 4M3 17l4 4" /></svg>
                      </button>
                      <button className="cal-ev-act del" onClick={() => deleteEvent(e.id).catch(() => {})} aria-label="Delete event">
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

      {/* Add bar */}
      <div className="cal-add">
        {added && added.length > 0 && (
          <div className="sconfirm">
            <div className="sconfirm-head">
              <span className="sconfirm-kicker">Noted{added.length > 1 ? <em> · {added.length}</em> : ''}</span>
              <button className="sconfirm-dismiss" onClick={() => setAdded(null)} aria-label="Dismiss"><svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" /></svg></button>
            </div>
            <ul className="sconfirm-list">
              {added.slice(0, 4).map((e) => (
                <li key={e.id} className="sconfirm-item"><span className="sconfirm-rail" /><div className="sconfirm-text"><div className="sconfirm-t">{e.title}</div><div className="sconfirm-w">{fmtWhen(e)}{e.location ? ` · ${e.location}` : ''}</div></div></li>
              ))}
            </ul>
          </div>
        )}
        {error && <div className="sprompt-error">{error}</div>}
        {targets.length > 1 && (
          <div className="sprompt-targets">
            {targets.map((t) => (
              <button key={t.id ?? 'personal'} className={`sprompt-target${(target ?? null) === t.id ? ' on' : ''}`} onClick={() => setTarget(t.id)}>
                {t.id === null
                  ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
                  : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2" /><circle cx="17" cy="9" r="2.6" /><path d="M3 20c0-3.2 3-5 6-5s6 1.8 6 5M15.5 20c0-2 1-3.4 3-3.6" /></svg>}
                {t.label}
              </button>
            ))}
          </div>
        )}
        <div className={`sprompt-bar${busy ? ' busy' : ''}`}>
          <textarea ref={taRef} rows={1} value={text} placeholder="Add to your schedule…" disabled={busy}
            onChange={(e) => { setText(e.target.value); setError(null); grow() }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }} />
          <button className="sprompt-send" onClick={submit} disabled={busy || !text.trim()} aria-label="Add to calendar">
            {busy ? <span className="sprompt-spinner" /> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>}
          </button>
        </div>
      </div>
    </div>
  )
}
