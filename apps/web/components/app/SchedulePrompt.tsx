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
  const day = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  if (e.all_day) return day
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
        <div className="sprompt-result">
          <div className="sprompt-result-head">
            <span>✓ Added {added.length} {added.length === 1 ? 'event' : 'events'}</span>
            <button onClick={onOpenCalendar}>View calendar</button>
          </div>
          <div className="sprompt-chips">
            {added.slice(0, 4).map((e) => (
              <span key={e.id} className="sprompt-chip">
                <b>{e.title}</b> {fmtWhen(e)}
              </span>
            ))}
            {added.length > 4 && <span className="sprompt-chip more">+{added.length - 4}</span>}
          </div>
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
