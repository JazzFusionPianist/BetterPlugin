'use client'

import { useEffect, useRef, useState } from 'react'
import type { CalendarEvent } from '@orb/core'

interface Props {
  /** Parse + persist the text; resolves with the events that were added. */
  onSubmit: (text: string) => Promise<CalendarEvent[]>
  onOpenCalendar: () => void
}

function fmtWhen(e: CalendarEvent): string {
  const d = new Date(e.starts_at)
  const day = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  if (e.all_day) return `${day} · all day`
  const t = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${day} · ${t}`
}

export default function SchedulePrompt({ onSubmit, onOpenCalendar }: Props) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState<CalendarEvent[] | null>(null)
  const [kbInset, setKbInset] = useState(0)
  const taRef = useRef<HTMLTextAreaElement>(null)

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
      const events = await onSubmit(value)
      setAdded(events)
      setText('')
      if (taRef.current) taRef.current.style.height = 'auto'
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
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
              Noted{added.length > 1 ? <em> · {added.length}</em> : ''}
            </span>
            <button className="sconfirm-dismiss" onClick={() => setAdded(null)} aria-label="Dismiss">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" /></svg>
            </button>
          </div>
          <ul className="sconfirm-list">
            {added.slice(0, 5).map((e) => (
              <li key={e.id} className="sconfirm-item">
                <span className="sconfirm-rail" />
                <div className="sconfirm-text">
                  <div className="sconfirm-t">{e.title}</div>
                  <div className="sconfirm-w">{fmtWhen(e)}{e.location ? ` · ${e.location}` : ''}</div>
                </div>
              </li>
            ))}
            {added.length > 5 && <li className="sconfirm-more">+{added.length - 5} more</li>}
          </ul>
          <button className="sconfirm-open" onClick={onOpenCalendar}>View in calendar →</button>
        </div>
      )}

      {error && <div className="sprompt-error">{error}</div>}

      <div className={`sprompt-bar${busy ? ' busy' : ''}`}>
        <textarea
          ref={taRef}
          rows={1}
          value={text}
          placeholder="Add to your schedule — e.g. lunch with Min on Saturday, studio at 7pm tomorrow"
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
    </div>
  )
}
