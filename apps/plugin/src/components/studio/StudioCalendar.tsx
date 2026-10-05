/**
 * The studio calendar (draft A, approved 2026-09-19). The month grid is
 * the page: event titles sit IN the day cells behind a 2px category bar
 * ("+n more" only when a day outgrows its cell), today is an ink disc, the chosen day
 * a green wash. The right column is that day's programme — time, bar,
 * title, room / place — with a prompt at its foot that adds to THAT day.
 * Views are words: month / week / list. One family, no icons.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CalendarEvent } from '../../hooks/useCalendarEvents'
import type { EventCategory } from '../../hooks/useEventCategories'
import { EventPage, type EventPatch } from '../collab/CalendarPanel'
import { NoteGlyph } from './StudioHomeSchedule'

interface Props {
  currentUserId: string
  events: CalendarEvent[]
  categories: EventCategory[]
  groupTitleById: Map<string, string>
  onDelete: (id: string) => void
  onUpdate: (id: string, patch: EventPatch) => void
  /** Free text for the chosen day → parse → persist. */
  onAdd: (text: string, dayKey: string) => Promise<CalendarEvent[]>
}

type View = 'month' | 'week' | 'list'

const DEFAULT_COLOR = '#7C7C86'
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const MON3 = MONTHS.map(m => m.slice(0, 3))
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const WEEKDAYS_LONG = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

const pad = (n: number) => String(n).padStart(2, '0')
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const dateOf = (k: string) => new Date(k + 'T00:00:00')
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
/** Monday of the week holding `d`. */
const weekStart = (d: Date) => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7))
const timeOf = (e: CalendarEvent) => {
  if (e.all_day) return 'all day'
  const d = new Date(e.starts_at)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** The week's time frame: an hour is this tall, and the frame opens on the working day. */
const HOUR_PX = 40
const minsOf = (iso: string) => { const d = new Date(iso); return d.getHours() * 60 + d.getMinutes() }
/** The month's pills carry the hour small: 7p, 11a, 4:30p. */
const shortTime = (iso: string) => { const d = new Date(iso), h = d.getHours(), m = d.getMinutes(); return `${((h + 11) % 12) + 1}${m ? ':' + pad(m) : ''}${h >= 12 ? 'p' : 'a'}` }
const hhmm = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
interface Placed { e: CalendarEvent; start: number; end: number; lane: number; lanes: number }
/** A day's timed events as blocks: start and end in minutes (an hour when no end is set, and never
 *  past midnight), and — where they overlap — side by side in lanes. */
function placeDay (evs: CalendarEvent[]): Placed[] {
  const items = evs.filter(e => !e.all_day).map(e => {
    const start = minsOf(e.starts_at)
    const sameDay = e.ends_at && keyOf(new Date(e.ends_at)) === keyOf(new Date(e.starts_at))
    const end = e.ends_at ? (sameDay ? minsOf(e.ends_at) : 24 * 60) : start + 60
    return { e, start, end: Math.min(24 * 60, Math.max(end, start + 30)), lane: 0, lanes: 1 }
  }).sort((x, y) => x.start - y.start || y.end - x.end)
  // a cluster is a run of events each touching the one before; inside it, each takes the first free lane
  let cluster: Placed[] = [], clusterEnd = -1
  const close = () => { const n = Math.max(0, ...cluster.map(c => c.lane)) + 1; cluster.forEach(c => { c.lanes = n }); cluster = [] }
  for (const it of items) {
    if (cluster.length && it.start >= clusterEnd) close()
    const taken = new Set(cluster.filter(c => c.end > it.start).map(c => c.lane))
    let lane = 0; while (taken.has(lane)) lane++
    it.lane = lane; cluster.push(it); clusterEnd = Math.max(clusterEnd, it.end)
  }
  if (cluster.length) close()
  return items
}

export default function StudioCalendar({
  currentUserId, events, categories, groupTitleById, onDelete, onUpdate, onAdd,
}: Props) {
  const todayKey = keyOf(new Date())
  const [view, setView] = useState<View>('month')
  const [selected, setSelected] = useState(todayKey)
  /** First of the month on the month page. */
  const [cursor, setCursor] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) })
  const [filter, setFilter] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [sureId, setSureId] = useState<string | null>(null)
  useEffect(() => {
    if (!sureId) return
    const t = window.setTimeout(() => setSureId(null), 2600)
    return () => window.clearTimeout(t)
  }, [sureId])

  const visible = useMemo(
    () => (filter ? events.filter(e => e.category === filter) : events),
    [events, filter],
  )
  const byDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>()
    for (const e of visible) {
      const k = keyOf(new Date(e.starts_at))
      const arr = m.get(k) ?? []
      arr.push(e)
      m.set(k, arr)
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => Number(b.all_day) - Number(a.all_day) || a.starts_at.localeCompare(b.starts_at))
    }
    return m
  }, [visible])

  // ── the pages ───────────────────────────────────────────────────────
  const monthWeeks = useMemo(() => {
    const start = weekStart(cursor)
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
    const weeks: Date[][] = []
    for (let w = start; w <= last; w = addDays(w, 7)) weeks.push(Array.from({ length: 7 }, (_, i) => addDays(w, i)))
    return weeks
  }, [cursor])
  const weekDays = useMemo(() => {
    const s = weekStart(dateOf(selected))
    return Array.from({ length: 7 }, (_, i) => addDays(s, i))
  }, [selected])
  const listDays = useMemo(() => {
    const keys = [...byDay.keys()].filter(k => k >= todayKey).sort()
    return keys.slice(0, 40)
  }, [byDay, todayKey])

  // How many rows a month cell holds: as many pills as its height allows
  // (a pill is 17px and 2px of gap, under a 20px number and 12px of
  // padding), so a tall window shows a busy day whole instead of "+n more".
  const weeksRef = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(4)
  useEffect(() => {
    const el = weeksRef.current; if (!el) return
    const measure = () => {
      const cell = el.clientHeight / Math.max(1, monthWeeks.length)
      setFit(Math.max(2, Math.min(9, Math.floor((cell - 12 - 20) / 19))))
    }
    measure()
    const ro = new ResizeObserver(measure); ro.observe(el)
    return () => ro.disconnect()
  }, [monthWeeks.length, view])

  // The week's frame is the whole day, scrolled to where the week's first
  // event is (never later than 08:00); a minute hand marks now.
  const frameRef = useRef<HTMLDivElement>(null)
  const weekKey = keyOf(weekDays[0]!)
  useEffect(() => {
    if (view !== 'week' || !frameRef.current) return
    const firsts = weekDays.flatMap(d => (byDay.get(keyOf(d)) ?? []).filter(e => !e.all_day).map(e => minsOf(e.starts_at)))
    const from = Math.min(8 * 60, ...(firsts.length ? [Math.min(...firsts) - 30] : []))
    frameRef.current.scrollTop = Math.max(0, Math.max(0, from) / 60 * HOUR_PX - 12)   // a little air above the first hour's label
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, weekKey])
  const [nowMin, setNowMin] = useState(() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes() })
  useEffect(() => {
    if (view !== 'week') return
    const t = window.setInterval(() => { const n = new Date(); setNowMin(n.getHours() * 60 + n.getMinutes()) }, 30000)
    return () => window.clearInterval(t)
  }, [view])

  const pick = (k: string) => { setSelected(k); setDetailId(null) }
  const open = (k: string, id: string) => { setSelected(k); setDetailId(id) }
  const step = (dir: 1 | -1) => {
    if (view === 'week') {
      const d = addDays(dateOf(selected), dir * 7)
      pick(keyOf(d)); setCursor(new Date(d.getFullYear(), d.getMonth(), 1))
    } else {
      setCursor(c => new Date(c.getFullYear(), c.getMonth() + dir, 1))
    }
  }
  const goToday = () => { const n = new Date(); setCursor(new Date(n.getFullYear(), n.getMonth(), 1)); pick(todayKey) }

  const title = view === 'list'
    ? <>upcoming</>
    : view === 'week'
      ? <>{MON3[weekDays[0]!.getMonth()]} {weekDays[0]!.getDate()} <span>to {weekDays[6]!.getMonth() !== weekDays[0]!.getMonth() ? `${MON3[weekDays[6]!.getMonth()]} ` : ''}{weekDays[6]!.getDate()}</span></>
      : <>{MONTHS[cursor.getMonth()]} <span>{cursor.getFullYear()}</span></>

  // ── the chosen day ──────────────────────────────────────────────────
  const selDate = dateOf(selected)
  const selEvents = byDay.get(selected) ?? []
  const detail = detailId ? events.find(e => e.id === detailId) ?? null : null

  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const [addErr, setAddErr] = useState<string | null>(null)
  const submit = async () => {
    const text = draft.trim()
    if (!text || adding) return
    setAdding(true); setAddErr(null)
    try {
      const made = await onAdd(text, selected)
      if (made.length === 0) setAddErr('couldn’t read that — try “7pm rehearsal at studio b”')
      else setDraft('')
    } catch {
      setAddErr('couldn’t add that — try again')
    } finally {
      setAdding(false)
    }
  }

  /** A month cell's event: a wash of its category's colour with a bar down the edge and the hour small; an all-day one is the fuller pill. */
  const pill = (e: CalendarEvent) => (
    <span key={e.id} className={`sc-ev${e.all_day ? ' all' : ''}`} title={e.title} style={{ '--c': e.category_color || DEFAULT_COLOR } as React.CSSProperties}>
      {!e.all_day && <em>{shortTime(e.starts_at)}</em>}
      <b>{e.title}</b>
    </span>
  )
  const chip = (e: CalendarEvent, withTime: boolean) => (
    <span key={e.id} className="sc-chip" title={e.title}>
      <NoteGlyph size={10} color={e.category_color || DEFAULT_COLOR} />
      {withTime && <em>{timeOf(e)}</em>}
      <b>{e.title}</b>
    </span>
  )

  return (
    <div className="sc">
      <div className="sc-head">
        <div className="sc-title-row">
          <h2 className="sc-title">{title}</h2>
          <span className="sc-views">
            {(['month', 'week', 'list'] as View[]).map(v => (
              <button key={v} className={`sc-view${view === v ? ' on' : ''}`} onClick={() => setView(v)}>{v}</button>
            ))}
          </span>
          <span className="sc-nav">
            <button className="sc-navw" onClick={goToday}>today</button>
            {view !== 'list' && <>
              <button className="sc-chev" onClick={() => step(-1)} aria-label="previous">‹</button>
              <button className="sc-chev" onClick={() => step(1)} aria-label="next">›</button>
            </>}
          </span>
        </div>
        {categories.length > 0 && (
          <div className="sc-filters">
            <button className={`sc-filter${filter === null ? ' on' : ''}`} onClick={() => setFilter(null)}>
              <NoteGlyph size={12} color="#1A1917" hollow={filter !== null} />all
            </button>
            {categories.map(c => (
              <button key={c.id} className={`sc-filter${filter === c.name ? ' on' : ''}`}
                onClick={() => setFilter(f => (f === c.name ? null : c.name))}>
                <NoteGlyph size={12} color={c.color} hollow={filter !== c.name} />{c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="sc-body">
        <div className="sc-page">
          {view === 'month' && (
            <>
              <div className="sc-weekdays">{WEEKDAYS.map(d => <span key={d}>{d}</span>)}</div>
              <div className="sc-weeks" ref={weeksRef}>
                {monthWeeks.map((week, wi) => (
                  <div key={wi} className="sc-week">
                    {week.map((d, di) => {
                      const k = keyOf(d)
                      const out = d.getMonth() !== cursor.getMonth()
                      const evs = byDay.get(k) ?? []
                      return (
                        <button key={k}
                          className={`sc-cell${out ? ' out' : ''}${k === selected ? ' sel' : ''}${di >= 5 ? ' wkend' : ''}`}
                          onClick={() => pick(k)}>
                          <span className={`sc-num${k === todayKey ? ' today' : ''}`}>{d.getDate()}</span>
                          {/* all of them when they fit; otherwise one row is the "+n more" */}
                          {(evs.length <= fit ? evs : evs.slice(0, fit - 1)).map(pill)}
                          {evs.length > fit && <span className="sc-more">+{evs.length - (fit - 1)} more</span>}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            </>
          )}

          {view === 'week' && (
            <div className="sc-wt">
              <div className="sc-wt-head">
                <span />
                {weekDays.map((d, di) => {
                  const k = keyOf(d)
                  return (
                    <button key={k} className={`sc-wt-day${k === selected ? ' sel' : ''}${di >= 5 ? ' wkend' : ''}`} onClick={() => pick(k)}>
                      <span>{WEEKDAYS[di]}</span>
                      <span className={`sc-num${k === todayKey ? ' today' : ''}`}>{d.getDate()}</span>
                    </button>
                  )
                })}
              </div>
              <div className="sc-wt-all">
                <span className="sc-wt-lab">all day</span>
                {weekDays.map(d => {
                  const k = keyOf(d)
                  return (
                    <div key={k} className={`sc-wt-allcell${k === selected ? ' sel' : ''}`} onClick={() => pick(k)}>
                      {(byDay.get(k) ?? []).filter(e => e.all_day).map(e => (
                        <button key={e.id} className="sc-wt-pill" title={e.title} style={{ '--c': e.category_color || DEFAULT_COLOR } as React.CSSProperties}
                          onClick={ev => { ev.stopPropagation(); open(k, e.id) }}><b>{e.title}</b></button>
                      ))}
                    </div>
                  )
                })}
              </div>
              <div className="sc-wt-frame" ref={frameRef}>
                <div className="sc-wt-grid" style={{ height: 24 * HOUR_PX }}>
                  <div className="sc-wt-hours">
                    {Array.from({ length: 23 }, (_, h) => <span key={h} style={{ top: (h + 1) * HOUR_PX }}>{pad(h + 1)}:00</span>)}
                  </div>
                  {weekDays.map(d => {
                    const k = keyOf(d)
                    return (
                      <div key={k} className={`sc-wt-col${k === selected ? ' sel' : ''}`} onClick={() => pick(k)}>
                        {placeDay(byDay.get(k) ?? []).map(({ e, start, end, lane, lanes }) => {
                          const h = (end - start) / 60 * HOUR_PX - 2
                          return (
                            <button key={e.id} className={`sc-wt-ev${h < 34 ? ' short' : ''}${lanes >= 3 ? ' slim' : ''}`} title={`${hhmm(start)} ${e.title}`}
                              style={{ top: start / 60 * HOUR_PX + 1, height: h, left: `calc(${lane / lanes * 100}% + 3px)`, width: `calc(${100 / lanes}% - ${lanes > 1 ? 4 : 6}px)`, '--c': e.category_color || DEFAULT_COLOR } as React.CSSProperties}
                              onClick={ev => { ev.stopPropagation(); open(k, e.id) }}>
                              <em>{hhmm(start)}</em><b>{e.title}</b>
                            </button>
                          )
                        })}
                        {k === todayKey && <i className="sc-wt-now" style={{ top: nowMin / 60 * HOUR_PX }} />}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {view === 'list' && (
            <div className="sc-list">
              {listDays.length === 0 && <div className="sc-none">nothing scheduled — enjoy the quiet</div>}
              {listDays.map(k => {
                const d = dateOf(k)
                return (
                  <div key={k} className={`sc-lday${k === selected ? ' sel' : ''}`} onClick={() => pick(k)}>
                    <span className={`sc-ldate${k === todayKey ? ' today' : ''}`}>
                      {k === todayKey ? 'today' : `${WEEKDAYS_LONG[d.getDay()]!.slice(0, 3)} ${d.getDate()} ${MON3[d.getMonth()]}`}
                    </span>
                    <span className="sc-lrows">{(byDay.get(k) ?? []).map(e => chip(e, true))}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── the chosen day's programme ─────────────────────────── */}
        <div className="sc-day">
          {detail ? (
            <div className="sc-detail">
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
          ) : (
            <>
              <div className="sc-day-title">{WEEKDAYS_LONG[selDate.getDay()]} <span>{selDate.getDate()}</span></div>
              <div className="sc-day-sub">
                {selected === todayKey && <span>today</span>}
                {selDate.getMonth() !== cursor.getMonth() && <span>{MONTHS[selDate.getMonth()]}</span>}
                <span>{selEvents.length === 0 ? 'nothing scheduled' : `${selEvents.length} ${selEvents.length === 1 ? 'event' : 'events'}`}</span>
              </div>
              <div className="sc-rows">
                {selEvents.map(e => {
                  const room = e.conversation_id ? groupTitleById.get(e.conversation_id) : null
                  const meta = [room, e.category, e.location].filter(Boolean) as string[]
                  const own = e.user_id === currentUserId
                  return (
                    <div key={e.id} className="sc-row" onClick={() => setDetailId(e.id)} role="button">
                      <span className="sc-row-time">{timeOf(e)}</span>
                      <NoteGlyph size={12} color={e.category_color || DEFAULT_COLOR} className="sc-row-note" />
                      <span className="sc-row-main">
                        <b>{e.title}</b>
                        {meta.length > 0 && <span className="sc-row-meta">{meta.map((m, i) => <span key={i}>{m}</span>)}</span>}
                      </span>
                      {own && (
                        <button className={`wd-word sm${sureId === e.id ? ' sure' : ' dim'}`}
                          onClick={ev => { ev.stopPropagation(); if (sureId === e.id) { setSureId(null); onDelete(e.id) } else setSureId(e.id) }}>
                          {sureId === e.id ? 'sure?' : 'remove'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="sc-add">
                {addErr && <div className="sc-add-err">{addErr}</div>}
                <div className="sc-add-bar">
                  <input value={draft} disabled={adding}
                    placeholder={`add to ${WEEKDAYS_LONG[selDate.getDay()]} ${selDate.getDate()}…`}
                    onChange={e => { setDraft(e.target.value); setAddErr(null) }}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); void submit() } }} />
                  <button disabled={!draft.trim() || adding} onClick={() => void submit()} aria-label="add">
                    <NoteGlyph size={28} color={draft.trim() && !adding ? '#3FB872' : '#C0BCB3'} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
