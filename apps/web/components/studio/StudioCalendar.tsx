'use client'

/**
 * The studio calendar (draft A, approved 2026-09-19). The month grid is
 * the page: event titles sit IN the day cells behind a 2px category bar
 * ("+2 more" when a day overflows), today is an ink disc, the chosen day
 * a green wash. The right column is that day's programme — time, bar,
 * title, room / place — with a prompt at its foot that adds to THAT day.
 * Views are words: month / week / list. One family, no icons.
 */

import { useEffect, useMemo, useState } from 'react'
import type { CalendarEvent, EventCategory } from '@orb/core'
import { EventPage, type EventPatch } from '../app/CalendarView'
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

  const pick = (k: string) => { setSelected(k); setDetailId(null) }
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
              <div className="sc-weeks">
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
                          {evs.slice(0, 3).map(e => chip(e, false))}
                          {evs.length > 3 && <span className="sc-more">+{evs.length - 3} more</span>}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            </>
          )}

          {view === 'week' && (
            <div className="sc-wk">
              {weekDays.map((d, di) => {
                const k = keyOf(d)
                const evs = byDay.get(k) ?? []
                return (
                  <button key={k} className={`sc-wkcol${k === selected ? ' sel' : ''}`} onClick={() => pick(k)}>
                    <span className="sc-wkhead">
                      <span>{WEEKDAYS[di]}</span>
                      <span className={`sc-num${k === todayKey ? ' today' : ''}`}>{d.getDate()}</span>
                    </span>
                    {evs.map(e => chip(e, true))}
                  </button>
                )
              })}
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
                onClose={() => setDetailId(null)}
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
