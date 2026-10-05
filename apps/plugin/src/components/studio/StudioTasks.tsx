/**
 * tasks — one line per thing the room has to do. "하로 2절 보컬 다시
 * 금요일까지": the person and the day are read from the sentence (a
 * member's name or @handle, the date through the schedule parser), the
 * rest is the title. A hollow whole note is an open task; it fills green
 * when it's done — and the room's chat gets a line saying who finished
 * what. Open ones first, by day; done ones dimmed below.
 */

import { useEffect, useState } from 'react'
import type { Profile } from '../../types/collab'
import type { RoomTask, NewTask } from '../../hooks/useRoomTasks'
import { NoteGlyph } from './StudioHomeSchedule'
import { houseColor } from '../../slur/marks'

const pad = (n: number) => String(n).padStart(2, '0')
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const WD = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/** "today" / "fri 10" / "mon 13 oct" (another month) — the line's day. */
export function dueWord(due: string | null, now = new Date()): { text: string; tone: 'today' | 'late' | '' } {
  if (!due) return { text: '', tone: '' }
  const t = todayKey()
  if (due === t) return { text: 'today', tone: 'today' }
  const d = new Date(due + 'T00:00:00')
  const late = due < t
  const sameMonth = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  return { text: `${WD[d.getDay()]} ${d.getDate()}${sameMonth ? '' : ` ${MON[d.getMonth()]}`}`, tone: late ? 'late' : '' }
}

/** Who the line names — a member's display name or @handle, anywhere in it. */
export function findAssignee(text: string, members: Profile[]): { id: string; rest: string } | null {
  const lower = text.toLowerCase()
  const hits = members.flatMap(m => {
    const names = [m.display_name, m.username ? '@' + m.username : '', m.username ?? ''].filter(n => n && n.length >= 2)
    return names.map(n => ({ m, n, at: lower.indexOf(n.toLowerCase()) })).filter(h => h.at >= 0)
  }).sort((a, b) => b.n.length - a.n.length || a.at - b.at)
  const h = hits[0]
  if (!h) return null
  // strip the name (and a trailing particle / comma) from the title
  const rest = (text.slice(0, h.at) + text.slice(h.at + h.n.length))
    .replace(/^\s*[,—-]\s*/, '').replace(/\s*(님|이|가|은|는|한테|에게)?\s*[,:—-]?\s+/, ' ').replace(/\s{2,}/g, ' ').trim()
  return { id: h.m.id, rest: rest || text.trim() }
}

interface Props {
  tasks: RoomTask[]
  loaded: boolean
  userId: string
  members: Profile[]
  nameOf: (id: string | null) => string
  onAdd: (t: NewTask) => Promise<string | null>
  onDone: (task: RoomTask, done: boolean) => Promise<string | null>
  onRemove: (id: string) => Promise<string | null>
  /** The sentence → a day (ISO yyyy-mm-dd) and a title with the day's words taken out. */
  parseDay: (text: string) => Promise<{ due: string | null; title: string }>
}

export default function StudioTasks({ tasks, loaded, userId, members, nameOf, onAdd, onDone, onRemove, parseDay }: Props) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [sureId, setSureId] = useState<string | null>(null)
  useEffect(() => {
    if (!sureId) return
    const t = window.setTimeout(() => setSureId(null), 2600)
    return () => window.clearTimeout(t)
  }, [sureId])

  const go = async () => {
    const raw = text.trim()
    if (!raw || busy) return
    setBusy(true); setNote(null)
    try {
      const who = findAssignee(raw, members)
      const parsed = await parseDay(who ? who.rest : raw)
      const err = await onAdd({ title: parsed.title || (who ? who.rest : raw), assignee_id: who?.id ?? null, due_on: parsed.due })
      if (err) setNote('couldn’t add that — try again')
      else setText('')
    } finally { setBusy(false) }
  }

  const open = tasks.filter(t => !t.done_at)
  const done = tasks.filter(t => !!t.done_at)
  const row = (t: RoomTask) => {
    const d = dueWord(t.due_on)
    const isDone = !!t.done_at
    return (
      <div key={t.id} className={`wd-task${isDone ? ' done' : ''}`}>
        <button className="wd-task-check" onClick={() => void onDone(t, !isDone)} aria-label={isDone ? 'reopen' : 'done'}>
          <NoteGlyph size={18} color={isDone ? '#3FB872' : '#1A1917'} hollow={!isDone} />
        </button>
        <span className="wd-task-main">
          <b>{t.title}</b>
          {t.note && <small>{t.note}</small>}
        </span>
        {t.assignee_id && (
          <span className="wd-task-who">
            <i style={{ background: houseColor(t.assignee_id) }}>{nameOf(t.assignee_id).slice(0, 1)}</i>
            {nameOf(t.assignee_id)}
          </span>
        )}
        <span className={`wd-task-due ${isDone ? '' : d.tone}`}>
          {isDone ? `done  ${dueWord(t.done_at!.slice(0, 10)).text}` : d.text}
        </span>
        {(t.created_by === userId || isDone) && (
          <button className={`wd-word sm wd-task-x${sureId === t.id ? ' sure' : ''}`}
            onClick={() => { if (sureId === t.id) { setSureId(null); void onRemove(t.id) } else setSureId(t.id) }}>
            {sureId === t.id ? 'sure?' : 'remove'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="wd-tasks">
      <div className="wd-noteline">
        <div className={`wd-noteline-bar${busy ? ' busy' : ''}`}>
          <input value={text} placeholder="a task for the room — who, by when" disabled={busy}
            onChange={e => { setText(e.target.value); setNote(null) }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); void go() } }} />
          <button className="wd-noteline-send" onClick={() => void go()} disabled={!text.trim() || busy} aria-label="add">
            <NoteGlyph size={30} color={text.trim() ? '#3FB872' : '#C0BCB3'} />
          </button>
        </div>
        <div className="wd-tasks-hint">{note ?? '“하로 2절 보컬 다시 금요일까지” — the name and the day are read from the line'}</div>
      </div>
      <div className="wd-tasks-scroll">
        {loaded && tasks.length === 0 && <div className="wd-prof-none">nothing to do yet</div>}
        {open.length > 0 && <div className="wd-tasks-sec">open  {open.length}</div>}
        {open.map(row)}
        {done.length > 0 && <div className="wd-tasks-sec">done</div>}
        {done.map(row)}
      </div>
    </div>
  )
}
