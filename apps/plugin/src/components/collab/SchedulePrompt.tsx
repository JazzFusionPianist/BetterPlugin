import { useRef, useState } from 'react'
import type { CalendarEvent } from '../../hooks/useCalendarEvents'

interface Target { id: string | null; label: string }
interface Props {
  /** Parse + persist the text to the chosen target; resolves with what was added. */
  onSubmit: (text: string, conversationId: string | null) => Promise<CalendarEvent[]>
  targets: Target[]
}

const fmtWhen = (e: CalendarEvent) => {
  const d = new Date(e.starts_at)
  const day = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  if (e.all_day) return `${day} · all day`
  return `${day} · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
}

export default function SchedulePrompt({ onSubmit, targets }: Props) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState<CalendarEvent[] | null>(null)
  const [target, setTarget] = useState<string | null>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const grow = () => { const ta = taRef.current; if (!ta) return; ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 80) + 'px' }

  const submit = async () => {
    const value = text.trim()
    if (!value || busy) return
    setBusy(true); setError(null); setAdded(null)
    try {
      const ins = await onSubmit(value, target)
      setAdded(ins); setText(''); if (taRef.current) taRef.current.style.height = 'auto'
    } catch (e) {
      setError('couldn\'t save that. try again.')
    } finally { setBusy(false) }
  }

  return (
    <div className="sprompt-wrap">
      {added && added.length > 0 && (
        <div className="sconfirm">
          <div className="sconfirm-head">
            <span className="sconfirm-kicker">Noted{added.length > 1 ? <em> · {added.length}</em> : ''}</span>
            <button className="sconfirm-dismiss" onClick={() => setAdded(null)} aria-label="Dismiss"><svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" /></svg></button>
          </div>
          <ul className="sconfirm-list">
            {added.slice(0, 3).map((e) => (
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
        <textarea ref={taRef} rows={1} value={text} placeholder="add to your schedule…" disabled={busy}
          onChange={(e) => { setText(e.target.value); setError(null); grow() }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }} />
        <button className="sprompt-send" onClick={submit} disabled={busy || !text.trim()} aria-label="Add to calendar">
          {busy ? <span className="sprompt-spinner" /> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>}
        </button>
      </div>
      {/* AI 기본법 §31 — generative-AI disclosure */}
      <div className="sprompt-ainote">schedule parsing uses generative ai — check before saving</div>
    </div>
  )
}
