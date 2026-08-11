'use client'

import { useState } from 'react'
import { parseTaskDate, fmtTaskDate } from '@/lib/taskDate'

export interface NewTask {
  title: string
  caption: string | null
  /** ISO datetime (local midnight) or null — the due date is optional. */
  due: string | null
}

/**
 * The small card behind + → task: name, a typed due date (parsed live —
 * the reading prints beside the field so a misread is visible before
 * saving), and what needs doing. IME-safe enter handling.
 */
export default function TaskComposer({ onCreate, onClose }: {
  onCreate: (task: NewTask) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [when, setWhen] = useState('')
  const [desc, setDesc] = useState('')

  const parsed = parseTaskDate(when)
  const missed = when.trim() !== '' && !parsed

  const submit = () => {
    const t = title.trim()
    if (!t) return
    onCreate({
      title: t,
      caption: desc.trim() || null,
      due: parsed ? parsed.toISOString() : null,
    })
  }

  return (
    <div className="polad-sheet-overlay" onClick={onClose}>
      <div className="taskc" onClick={(e) => e.stopPropagation()}>
        <input
          className="taskc-name"
          placeholder="task name…"
          value={title}
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); submit() }
          }}
        />
        <div className="taskc-whenrow">
          <input
            className="taskc-when"
            placeholder="when — 내일 · friday · 8/15"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); submit() }
            }}
          />
          {parsed && <span className="taskc-whenread">→ {fmtTaskDate(parsed.toISOString())}</span>}
          {missed && <span className="taskc-whenread missed">?</span>}
        </div>
        <textarea
          className="taskc-desc"
          placeholder="what needs doing…"
          value={desc}
          rows={3}
          onChange={(e) => setDesc(e.target.value)}
        />
        <div className="taskc-foot">
          <button className="taskc-cancel" onClick={onClose}>cancel</button>
          <button className="taskc-add" disabled={!title.trim()} onClick={submit}>add</button>
        </div>
      </div>
    </div>
  )
}
