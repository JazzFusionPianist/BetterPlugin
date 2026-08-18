'use client'

import { useEffect, useRef, useState } from 'react'
import type { CalendarEvent, EventCategory } from '@orb/core'

interface Target { id: string | null; label: string }

type ConfirmPatch = Partial<Pick<CalendarEvent, 'title' | 'starts_at' | 'ends_at' | 'all_day'>>

interface Props {
  /** Parse + persist the text to the chosen target; resolves with the added events. */
  onSubmit: (text: string, conversationId: string | null) => Promise<CalendarEvent[]>
  onOpenCalendar: () => void
  /** Destinations for new events: Personal (id null) + my groups. */
  targets: Target[]
  /** The user's categories — the confirmation card's inline fix-up
   *  picker (AI mishears; the fix should be one tap away). */
  categories?: EventCategory[]
  /** Patch a just-added event (title / date / time / all-day). */
  onUpdate?: (id: string, patch: ConfirmPatch) => void
  /** Re-categorize a just-added event; resolves with the category's
   *  colour so the card's rail can repaint. */
  onSetCategory?: (id: string, name: string) => Promise<string | null>
}

function fmtWhen(e: CalendarEvent): string {
  const d = new Date(e.starts_at)
  const day = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).toLowerCase()
  if (e.all_day) return `${day} · all day`
  const t = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${day} · ${t}`
}

export default function SchedulePrompt({ onSubmit, onOpenCalendar, targets, categories, onUpdate, onSetCategory }: Props) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState<CalendarEvent[] | null>(null)
  const [kbInset, setKbInset] = useState(0)
  const [target, setTarget] = useState<string | null>(null)
  // Which confirmation row is unfolded into its fix-up editor.
  const [editId, setEditId] = useState<string | null>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  // ── Inline fix-up ─────────────────────────────────────────────────────
  // The card holds its own copies of the just-added events, so edits
  // patch BOTH the DB (via onUpdate) and the local copy — the row
  // repaints instantly without waiting for the realtime round-trip.
  const patchLocal = (id: string, patch: Partial<CalendarEvent>) =>
    setAdded((prev) => prev?.map((e) => (e.id === id ? { ...e, ...patch } : e)) ?? prev)
  const applyPatch = (id: string, patch: ConfirmPatch) => {
    onUpdate?.(id, patch)
    patchLocal(id, patch)
  }
  /** Reschedule, preserving duration when the event has an end. */
  const applyStart = (e: CalendarEvent, next: Date) => {
    const patch: ConfirmPatch = { starts_at: next.toISOString() }
    if (e.ends_at) {
      const delta = next.getTime() - new Date(e.starts_at).getTime()
      patch.ends_at = new Date(new Date(e.ends_at).getTime() + delta).toISOString()
    }
    applyPatch(e.id, patch)
  }
  const setCat = async (e: CalendarEvent, name: string) => {
    if (!onSetCategory) return
    const color = await onSetCategory(e.id, name)
    patchLocal(e.id, { category: name || null, category_color: name ? color : null })
  }

  // Keep the bar above the on-screen keyboard. visualViewport shrinks when
  // the iOS keyboard opens; lift the bar by the overlapped amount.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const onResize = () => {
      const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setKbInset(overlap)
    }
    vv.addEventListener('resize', onResize)
    vv.addEventListener('scroll', onResize)
    onResize()
    return () => {
      vv.removeEventListener('resize', onResize)
      vv.removeEventListener('scroll', onResize)
    }
  }, [])

  const grow = () => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 132) + 'px'
  }

  const submit = async () => {
    const value = text.trim()
    if (!value || busy) return
    setBusy(true); setError(null); setAdded(null)
    try {
      const events = await onSubmit(value, target)
      setAdded(events)
      setText('')
      if (taRef.current) taRef.current.style.height = 'auto'
    } catch (e) {
      setError(e instanceof Error ? e.message : 'couldn’t read that — try rewording.')
    } finally {
      setBusy(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  return (
    <div className="sprompt" style={{ '--kb': `${kbInset}px` } as React.CSSProperties}>
      {added && added.length > 0 && (
        <div className="sconfirm">
          <div className="sconfirm-head">
            <span className="sconfirm-kicker">
              noted{added.length > 1 ? <em> · {added.length}</em> : ''}
            </span>
            <button className="sconfirm-dismiss" onClick={() => setAdded(null)} aria-label="Dismiss">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" /></svg>
            </button>
          </div>
          <ul className="sconfirm-list">
            {added.slice(0, 5).map((e) => {
              const editing = editId === e.id
              const start = new Date(e.starts_at)
              const isPm = start.getHours() >= 12
              const h12 = ((start.getHours() + 11) % 12) + 1
              const mm2 = String(start.getMinutes()).padStart(2, '0')
              const setHour24 = (h24: number) => {
                const next = new Date(e.starts_at)
                next.setHours(h24)
                applyStart(e, next)
              }
              return (
                <li key={e.id} className={`sconfirm-item${editing ? ' editing' : ''}`}>
                  <span className="sconfirm-rail" style={e.category_color ? { background: e.category_color } : undefined} />
                  <div className="sconfirm-body">
                    {/* Collapsed row — tap to unfold the fix-up editor.
                        The AI mishears sometimes; the fix is one tap. */}
                    <div
                      className="sconfirm-text"
                      role={onUpdate ? 'button' : undefined}
                      onClick={onUpdate ? () => setEditId(editing ? null : e.id) : undefined}
                    >
                      <div className="sconfirm-t">{e.title}</div>
                      <div className="sconfirm-w">
                        {fmtWhen(e)}
                        {e.category ? ` · ${e.category}` : ''}
                        {e.location ? ` · ${e.location}` : ''}
                      </div>
                    </div>

                    {editing && (
                      <div className="sconfirm-edit">
                        <input
                          className="evsheet-title sconfirm-edit-title"
                          defaultValue={e.title}
                          onKeyDown={(ev) => { if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur() }}
                          onBlur={(ev) => {
                            const v = ev.target.value.trim()
                            if (v && v !== e.title) applyPatch(e.id, { title: v })
                          }}
                        />
                        <div className="evsheet-daterow">
                          <span className="evsheet-date">
                            {start.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).toLowerCase()}
                          </span>
                          <button className="evsheet-dstep" onClick={() => { const n = new Date(e.starts_at); n.setDate(n.getDate() - 1); applyStart(e, n) }} aria-label="Previous day">‹</button>
                          <button className="evsheet-dstep" onClick={() => { const n = new Date(e.starts_at); n.setDate(n.getDate() + 1); applyStart(e, n) }} aria-label="Next day">›</button>
                          <button
                            className={`evsheet-allday${e.all_day ? ' on' : ''}`}
                            onClick={() => applyPatch(e.id, { all_day: !e.all_day })}
                          >
                            all day
                          </button>
                        </div>
                        {!e.all_day && (
                          <div className="evsheet-timerow" key={e.starts_at}>
                            <input
                              className="evsheet-tinput"
                              inputMode="numeric"
                              maxLength={2}
                              defaultValue={h12}
                              onFocus={(ev) => ev.target.select()}
                              onKeyDown={(ev) => { if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur() }}
                              onBlur={(ev) => {
                                const v = parseInt(ev.target.value, 10)
                                if (!isFinite(v) || v < 1 || v > 12) { ev.target.value = String(h12); return }
                                if (v !== h12) setHour24((v % 12) + (isPm ? 12 : 0))
                              }}
                              aria-label="Hour"
                            />
                            <span className="evsheet-tcolon">:</span>
                            <input
                              className="evsheet-tinput"
                              inputMode="numeric"
                              maxLength={2}
                              defaultValue={mm2}
                              onFocus={(ev) => ev.target.select()}
                              onKeyDown={(ev) => { if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur() }}
                              onBlur={(ev) => {
                                const v = parseInt(ev.target.value, 10)
                                if (!isFinite(v) || v < 0 || v > 59) { ev.target.value = mm2; return }
                                if (String(v).padStart(2, '0') !== mm2) {
                                  const next = new Date(e.starts_at)
                                  next.setMinutes(v)
                                  applyStart(e, next)
                                }
                              }}
                              aria-label="Minutes"
                            />
                            <div className="evsheet-ampm">
                              <button className={isPm ? '' : 'on'} onClick={() => { if (isPm) setHour24(start.getHours() - 12) }}>am</button>
                              <button className={isPm ? 'on' : ''} onClick={() => { if (!isPm) setHour24(start.getHours() + 12) }}>pm</button>
                            </div>
                          </div>
                        )}
                        {onSetCategory && categories && categories.length > 0 && (
                          <div className="cal-catpick sconfirm-catpick">
                            {categories.map((c) => (
                              <button
                                key={c.id}
                                className={`cal-catpick-chip${e.category === c.name ? ' on' : ''}`}
                                onClick={() => setCat(e, e.category === c.name ? '' : c.name)}
                              >
                                <span className="cal-filter-dot" style={{ background: c.color }} />
                                {c.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
            {added.length > 5 && <li className="sconfirm-more">+{added.length - 5} more</li>}
          </ul>
          <button className="sconfirm-open" onClick={onOpenCalendar}>view in calendar →</button>
        </div>
      )}

      {error && <div className="sprompt-error">{error}</div>}

      {targets.length > 1 && (
        <div className="sprompt-targets">
          {targets.map((t) => (
            <button
              key={t.id ?? 'personal'}
              className={`sprompt-target${(target ?? null) === t.id ? ' on' : ''}`}
              onClick={() => setTarget(t.id)}
            >
              {t.id === null ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2" /><circle cx="17" cy="9" r="2.6" /><path d="M3 20c0-3.2 3-5 6-5s6 1.8 6 5M15.5 20c0-2 1-3.4 3-3.6" /></svg>
              )}
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className={`sprompt-bar${busy ? ' busy' : ''}`}>
        <textarea
          ref={taRef}
          rows={1}
          value={text}
          placeholder="add to your schedule — e.g. lunch with min on saturday, studio at 7pm tomorrow"
          onChange={(e) => { setText(e.target.value); setError(null); grow() }}
          onKeyDown={onKeyDown}
          disabled={busy}
        />
        <button className="sprompt-send" onClick={submit} disabled={busy || !text.trim()} aria-label="Add to calendar">
          {busy ? (
            <span className="sprompt-spinner" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          )}
        </button>
      </div>
      {/* AI 기본법 §31 — generative-AI disclosure */}
      <div className="sprompt-ainote">schedule parsing uses generative ai — check before saving</div>
    </div>
  )
}
