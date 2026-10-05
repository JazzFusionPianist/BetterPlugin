import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CalendarEvent } from '../../hooks/useCalendarEvents'
import type { EventCategory } from '../../hooks/useEventCategories'

/** Fields the detail page / inline editors may patch. */
export type EventPatch = Partial<Pick<CalendarEvent,
  'title' | 'starts_at' | 'ends_at' | 'all_day' | 'location' | 'notes'>>

interface Props {
  events: CalendarEvent[]
  categories: EventCategory[]
  currentUserId: string
  groupTitleById: Map<string, string>
  onDelete: (id: string) => void
  onSetCategory: (id: string, name: string) => void
  onUpdate: (id: string, patch: EventPatch) => void
  onAddCategory: (name: string) => void
  onRenameCategory: (id: string, name: string) => void
  onDeleteCategory: (id: string) => void
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const DEFAULT_COLOR = '#7C7C86'

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function CalendarPanel({
  events, categories, currentUserId, groupTitleById, onDelete, onSetCategory,
  onUpdate, onAddCategory, onRenameCategory, onDeleteCategory,
}: Props) {
  const today = new Date()
  const todayKey = dayKey(today)
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const [selected, setSelected] = useState(todayKey)
  const [filter, setFilter] = useState<string | null>(null)   // category name
  const [editing, setEditing] = useState<string | null>(null) // event id (category picker)
  const [renaming, setRenaming] = useState<string | null>(null) // event id (title edit)
  const [manageOpen, setManageOpen] = useState(false)           // category manager drawer
  const [catEditing, setCatEditing] = useState<string | null>(null) // category id being renamed
  const [armedDelete, setArmedDelete] = useState<string | null>(null) // category id, two-tap delete
  const [detailId, setDetailId] = useState<string | null>(null)     // event id (detail page)

  const shown = useMemo(
    () => (filter ? events.filter((e) => e.category === filter) : events),
    [events, filter],
  )

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

  // Tapping an agenda row turns the panel itself to the event page —
  // no bottom sheet, the calendar reads like a booklet.
  const detail = detailId ? events.find((ev) => ev.id === detailId) ?? null : null

  if (detail) {
    return (
      <div className="cal-panel">
        <EventPage
          key={detail.id}
          event={detail}
          own={detail.user_id === currentUserId}
          groupTitle={detail.conversation_id ? groupTitleById.get(detail.conversation_id) ?? null : null}
          onUpdate={onUpdate}
          onBack={() => setDetailId(null)}
          onDelete={onDelete}
        />
      </div>
    )
  }

  return (
    <div className="cal-panel">
      <div className="cal-panel-head">
        <h2 className="cal-month">{MONTHS[view.m]} <span>{view.y}</span></h2>
        <div className="cal-tools">
          {!onCurrentMonth && (
            <button className="cal-today" onClick={() => { setView({ y: today.getFullYear(), m: today.getMonth() }); setSelected(todayKey) }}>Today</button>
          )}
          <button className="cal-chev" onClick={() => step(-1)} aria-label="Previous month">‹</button>
          <button className="cal-chev" onClick={() => step(1)} aria-label="Next month">›</button>
        </div>
      </div>

      <div className="cal-body">
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
          <button
            className={`cal-filter cal-filters-edit${manageOpen ? ' on' : ''}`}
            onClick={() => { setManageOpen((o) => !o); setCatEditing(null); setArmedDelete(null) }}
            aria-label="Edit categories"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
            {categories.length === 0 ? 'categories' : null}
          </button>
        </div>

        {manageOpen && (
          <div className="cal-catmgr">
            {categories.map((c) => (
              <div key={c.id} className="cal-catmgr-row">
                <span className="cal-filter-dot" style={{ background: c.color }} />
                {catEditing === c.id ? (
                  <input
                    className="cal-catmgr-input"
                    defaultValue={c.name}
                    autoFocus
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter') {
                        const v = (ev.target as HTMLInputElement).value.trim()
                        if (v && v !== c.name) { onRenameCategory(c.id, v); if (filter === c.name) setFilter(v) }
                        setCatEditing(null)
                      }
                      if (ev.key === 'Escape') setCatEditing(null)
                    }}
                    onBlur={(ev) => {
                      const v = ev.target.value.trim()
                      if (v && v !== c.name) { onRenameCategory(c.id, v); if (filter === c.name) setFilter(v) }
                      setCatEditing(null)
                    }}
                  />
                ) : (
                  <button className="cal-catmgr-name" onClick={() => { setCatEditing(c.id); setArmedDelete(null) }}>
                    {c.name}
                  </button>
                )}
                <button
                  className={`cal-catmgr-del${armedDelete === c.id ? ' armed' : ''}`}
                  onClick={() => {
                    if (armedDelete === c.id) {
                      onDeleteCategory(c.id)
                      setArmedDelete(null)
                      if (filter === c.name) setFilter(null)
                    } else {
                      setArmedDelete(c.id)
                    }
                  }}
                  aria-label={armedDelete === c.id ? 'Confirm delete' : `Delete ${c.name}`}
                >
                  {armedDelete === c.id
                    ? 'sure?'
                    : <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2.5 2.5l9 9M11.5 2.5l-9 9" /></svg>}
                </button>
              </div>
            ))}
            <input
              className="cal-catmgr-new"
              placeholder="new category…"
              onKeyDown={(ev) => {
                if (ev.key === 'Enter') {
                  const el = ev.target as HTMLInputElement
                  const v = el.value.trim()
                  if (v) { onAddCategory(v); el.value = '' }
                }
              }}
            />
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
            // A day with an all-day event is circled in its colour — a
            // whole day claimed is worth marking on the month page.
            const allday = byDay.get(k)?.find((e) => e.all_day)
            const adColor = allday ? (allday.category_color || '#2440FF') : null
            return (
              <button key={k} className={`cal-day${isSel ? ' sel' : ''}${isToday ? ' today' : ''}`} onClick={() => setSelected(k)}>
                <span
                  className="cal-num"
                  style={!isSel && adColor ? { borderColor: adColor, borderWidth: 1.5, background: `${adColor}4D` } : undefined}
                >{day}</span>
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
                    <div
                      className="cal-ev-main"
                      role="button"
                      onClick={() => {
                        if (renaming === e.id || editing === e.id) return
                        setDetailId(e.id)
                      }}
                    >
                      {renaming === e.id ? (
                        <input
                          className="cal-ev-title-input"
                          defaultValue={e.title}
                          autoFocus
                          onKeyDown={(ev) => {
                            if (ev.key === 'Enter') {
                              const v = (ev.target as HTMLInputElement).value.trim()
                              if (v && v !== e.title) onUpdate(e.id, { title: v })
                              setRenaming(null)
                            }
                            if (ev.key === 'Escape') setRenaming(null)
                          }}
                          onBlur={(ev) => {
                            const v = ev.target.value.trim()
                            if (v && v !== e.title) onUpdate(e.id, { title: v })
                            setRenaming(null)
                          }}
                        />
                      ) : (
                        <div className="cal-ev-title">{e.title}</div>
                      )}
                      <div className="cal-ev-meta">
                        {e.category && <span className="cal-ev-cat">{e.category}</span>}
                        {group && (
                          <span className="cal-ev-group">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.4" /><path d="M3.5 19c0-3 2.6-4.6 5.5-4.6s5.5 1.6 5.5 4.6M15 18.6c0-1.8.9-3 2.6-3.2" /></svg>
                            {group}
                          </span>
                        )}
                        {e.location && <span className="cal-ev-loc">{e.location}</span>}
                        {e.notes && <span className="cal-ev-hasnotes">notes</span>}
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
                            placeholder="new category…"
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
                        <button className="cal-ev-act" onClick={() => { setRenaming((id) => (id === e.id ? null : e.id)); setEditing(null) }} aria-label="Rename event">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
                        </button>
                        <button className="cal-ev-act" onClick={() => { setEditing((id) => (id === e.id ? null : e.id)); setRenaming(null) }} aria-label="Categorize">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.83z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
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

/* ── Event page — the panel turns to this like a booklet page ───────────
   The title with its note, when it starts and when it ends (am/pm one tap
   away — the fast way to fix an am/pm the AI misheard — and the length as
   pills), the day as a ruler with the event on it, place, notes.
   Everything saves as you go. */

const fmtSheetDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).toLowerCase()
const pad2 = (n: number) => String(n).padStart(2, '0')
/** As the calendar's own day heading reads ("thursday 8"), whatever the browser's language. */
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const LENGTHS: [string, number][] = [['30m', 30], ['1h', 60], ['2h', 120], ['3h', 180], ['4h', 240]]
const lengthText = (m: number) => {
  const h = Math.floor(m / 60), r = m % 60
  return h === 0 ? `${r} min` : r === 0 ? `${h} ${h === 1 ? 'hour' : 'hours'}` : `${h} h ${r} min`
}
/** A category's colour as a wash (hex colours only; anything else stays whole). */
const wash = (c: string) => (/^#[0-9a-f]{6}$/i.test(c) ? `${c}3D` : c)

/** One clock time, typed in place: hour, minutes, and am/pm as a key that flips. */
function TimeField ({ at, onSet, end, label }: { at: Date; onSet: (h24: number, m: number) => void; end?: boolean; label: string }) {
  const pm = at.getHours() >= 12
  const h12 = ((at.getHours() + 11) % 12) + 1
  const mm = pad2(at.getMinutes())
  const blurOnEnter = (ev: React.KeyboardEvent<HTMLInputElement>) => { if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur() }
  return (
    <span className={`evp-time${end ? ' end' : ''}`} key={at.toISOString()}>
      <input className="evp-num" inputMode="numeric" maxLength={2} defaultValue={h12} style={{ width: `${String(h12).length}ch` }}
        onFocus={(ev) => ev.target.select()} onKeyDown={blurOnEnter} aria-label={`${label} hour`}
        onBlur={(ev) => {
          const v = parseInt(ev.target.value, 10)
          if (!isFinite(v) || v < 1 || v > 12) { ev.target.value = String(h12); return }
          if (v !== h12) onSet((v % 12) + (pm ? 12 : 0), at.getMinutes())
        }} />
      <i>:</i>
      <input className="evp-num" inputMode="numeric" maxLength={2} defaultValue={mm} style={{ width: '2ch' }}
        onFocus={(ev) => ev.target.select()} onKeyDown={blurOnEnter} aria-label={`${label} minutes`}
        onBlur={(ev) => {
          const v = parseInt(ev.target.value, 10)
          if (!isFinite(v) || v < 0 || v > 59) { ev.target.value = mm; return }
          if (pad2(v) !== mm) onSet(at.getHours(), v)
        }} />
      <button className="evp-ampm" onClick={() => onSet((at.getHours() + 12) % 24, at.getMinutes())} aria-label={`${label} ${pm ? 'pm' : 'am'}, switch`}>{pm ? 'pm' : 'am'}</button>
    </span>
  )
}

export function EventPage({ event, own, groupTitle, onUpdate, onBack, onClose, onDelete }: {
  event: CalendarEvent
  own: boolean
  groupTitle: string | null
  onUpdate: (id: string, patch: EventPatch) => void
  onBack: () => void
  /** The phone's sheet closes the whole calendar from here. */
  onClose?: () => void
  onDelete?: (id: string) => void
}) {
  // Commit any un-blurred notes when the sheet closes, so nothing typed
  // is lost even if the textarea never lost focus. Layout effect: its
  // cleanup runs before React detaches the ref on unmount.
  const notesRef = useRef<HTMLTextAreaElement>(null)
  const latest = useRef({ event, onUpdate })
  latest.current = { event, onUpdate }
  useLayoutEffect(() => () => {
    const el = notesRef.current
    const { event: e, onUpdate: update } = latest.current
    if (!el) return
    const v = el.value.replace(/\s+$/, '')
    if ((e.notes ?? '') !== v) update(e.id, { notes: v || null })
  }, [])

  // Lift the sheet above the on-screen keyboard (notes live at the bottom).
  const [kbInset, setKbInset] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const onResize = () => setKbInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    vv.addEventListener('resize', onResize)
    vv.addEventListener('scroll', onResize)
    onResize()
    return () => { vv.removeEventListener('resize', onResize); vv.removeEventListener('scroll', onResize) }
  }, [])

  const start = new Date(event.starts_at)
  const end = event.ends_at ? new Date(event.ends_at) : null
  const mins = end ? Math.round((end.getTime() - start.getTime()) / 60000) : null

  /** Reschedule, preserving the event's duration if it has an end. */
  const applyStart = (next: Date) => {
    const patch: EventPatch = { starts_at: next.toISOString() }
    if (event.ends_at) {
      const delta = next.getTime() - start.getTime()
      patch.ends_at = new Date(new Date(event.ends_at).getTime() + delta).toISOString()
    }
    onUpdate(event.id, patch)
  }
  const stepDay = (delta: number) => { const next = new Date(start); next.setDate(next.getDate() + delta); applyStart(next) }
  const setStart = (h24: number, m: number) => { const next = new Date(start); next.setHours(h24, m, 0, 0); applyStart(next) }
  /** The end is a clock time on the start's day — or the next day's, when it is not after the start (a set that runs past midnight). */
  const setEnd = (h24: number, m: number) => {
    const next = new Date(start); next.setHours(h24, m, 0, 0)
    if (next.getTime() <= start.getTime()) next.setDate(next.getDate() + 1)
    onUpdate(event.id, { ends_at: next.toISOString() })
  }
  /** A length pill sets the end; the one that is on takes it away again. */
  const setLength = (m: number) => onUpdate(event.id, {
    all_day: false,
    ends_at: !event.all_day && mins === m ? null : new Date(start.getTime() + m * 60000).toISOString(),
  })

  // the day as a ruler: 06:00 to midnight, or the whole day for an early start
  const sH = start.getHours() + start.getMinutes() / 60
  const eH = end ? (end.toDateString() === start.toDateString() ? end.getHours() + end.getMinutes() / 60 : 24) : Math.min(24, sH + 1)
  const from = sH < 6 ? 0 : 6
  const at = (h: number) => `${((h - from) / (24 - from) * 100).toFixed(2)}%`
  const color = event.category_color || '#7C7C86'

  const [sure, setSure] = useState(false)
  useEffect(() => {
    if (!sure) return
    const t = window.setTimeout(() => setSure(false), 2600)
    return () => window.clearTimeout(t)
  }, [sure])

  return (
    <div className="cal-evpage evp" style={{ paddingBottom: `calc(8px + ${kbInset}px)` }}>
      <div className="evp-head">
        <button className="evp-back" onClick={onBack} aria-label="Back to the day">
          <i>‹</i>{DAY_NAMES[start.getDay()]} {start.getDate()}
        </button>
        {onClose && (
          <button className="evp-x" onClick={onClose} aria-label="Close calendar">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        )}
      </div>

      <div className="evp-title">
        <span className="evp-note" style={{ background: color }} />
        {own ? (
          <input
            defaultValue={event.title}
            aria-label="Title"
            onKeyDown={(ev) => { if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur() }}
            onBlur={(ev) => {
              const v = ev.target.value.trim()
              if (v && v !== event.title) onUpdate(event.id, { title: v })
            }}
          />
        ) : <b>{event.title}</b>}
      </div>
      {(event.category || groupTitle || !own) && (
        <div className="evp-pills">
          {event.category && <span style={{ background: wash(color) }}>{event.category}</span>}
          {groupTitle && <span>{groupTitle}</span>}
          {!own && <span>shared</span>}
        </div>
      )}

      <div className="evp-rule" />
      <div className="evp-date">
        <span>{fmtSheetDate(event.starts_at)}</span>
        {own && (
          <span className="evp-steps">
            <button onClick={() => stepDay(-1)} aria-label="Previous day">‹</button>
            <button onClick={() => stepDay(1)} aria-label="Next day">›</button>
          </span>
        )}
      </div>

      <div className="evp-times">
        {event.all_day ? <b className="evp-allday">all day</b> : own ? (
          <>
            <TimeField at={start} onSet={setStart} label="Start" />
            <small>to</small>
            {end
              ? <TimeField at={end} onSet={setEnd} end label="End" />
              : <button className="evp-noend" onClick={() => setLength(60)} aria-label="Set an end time">––:––</button>}
          </>
        ) : (
          <b className="evp-ro">
            {start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).toLowerCase()}
            {end && <> <small>to</small> {end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).toLowerCase()}</>}
          </b>
        )}
      </div>
      {!event.all_day && mins !== null && mins > 0 && <div className="evp-long">{lengthText(mins)}</div>}

      <div className="evp-ruler">
        <i style={event.all_day ? { left: 0, right: 0, background: color, opacity: .7 } : { left: at(Math.max(from, sH)), width: `calc(${at(Math.max(eH, sH + .25))} - ${at(Math.max(from, sH))})`, background: color, opacity: end ? 1 : .45 }} />
      </div>
      <div className="evp-ticks">
        {(from === 0 ? [0, 6, 12, 18, 24] : [6, 12, 18, 24]).map(h => <span key={h} style={{ left: at(h) }}>{pad2(h)}</span>)}
      </div>

      {own && (
        <div className="evp-lengths">
          {LENGTHS.map(([name, m]) => (
            <button key={name} className={!event.all_day && mins === m ? 'on' : ''} onClick={() => setLength(m)}>{name}</button>
          ))}
          <button className={`all${event.all_day ? ' on' : ''}`} onClick={() => onUpdate(event.id, { all_day: !event.all_day })}>all day</button>
        </div>
      )}

      <div className="evp-rule" />
      <div className="evp-row">
        <label>where</label>
        {own ? (
          <input
            placeholder="add a place"
            defaultValue={event.location ?? ''}
            onKeyDown={(ev) => { if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur() }}
            onBlur={(ev) => {
              const v = ev.target.value.trim()
              if ((event.location ?? '') !== v) onUpdate(event.id, { location: v || null })
            }}
          />
        ) : <span>{event.location ?? '—'}</span>}
      </div>
      <div className="evp-rule" />
      <div className="evp-row notes">
        <label>notes</label>
        {own ? (
          <textarea
            ref={notesRef}
            placeholder="setlist, gear, who brings what"
            defaultValue={event.notes ?? ''}
            rows={4}
            onBlur={(ev) => {
              const v = ev.target.value.replace(/\s+$/, '')
              if ((event.notes ?? '') !== v) onUpdate(event.id, { notes: v || null })
            }}
          />
        ) : <span>{event.notes ?? '—'}</span>}
      </div>

      {own && onDelete && (
        <button className={`evp-remove${sure ? ' sure' : ''}`}
          onClick={() => { if (sure) { onDelete(event.id); onBack() } else setSure(true) }}>
          {sure ? 'sure?' : 'remove'}
        </button>
      )}
    </div>
  )
}
