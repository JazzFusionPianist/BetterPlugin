'use client'

import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createGroupConversation, type Profile } from '@orb/core'

interface Props {
  open: boolean
  supabase: SupabaseClient
  currentUserId: string
  /** Mutual friends — the people you can pull into a group. */
  friends: (Profile & { isOnline?: boolean })[]
  onCreated: (conversationId: string, title: string, memberCount: number) => void
  onClose: () => void
}

const MAX_MEMBERS = 16   // matches the DB member cap

/** Name a group, pick friends, create — then jump straight into the chat. */
export default function NewGroupSheet({ open, supabase, currentUserId, friends, onCreated, onClose }: Props) {
  const [title, setTitle] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (open) { setTitle(''); setPicked(new Set()); setErr(null) }
  }, [open])

  const toggle = (id: string) =>
    setPicked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size + 1 < MAX_MEMBERS) next.add(id)   // +me
      return next
    })

  const create = async () => {
    const t = title.trim()
    if (!t || picked.size === 0 || busy) return
    setBusy(true); setErr(null)
    try {
      const convId = await createGroupConversation(supabase, currentUserId, t, Array.from(picked))
      onCreated(convId, t, picked.size + 1)
    } catch (e) {
      console.error('[newGroup]', e)
      setErr('couldn’t create the group — try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`ngr${open ? ' open' : ''}`} aria-hidden={!open}>
      <div className="ngr-sheet">
        <header className="afr-head">
          <h2>new group</h2>
          <button className="convs-close" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
          </button>
        </header>

        <input
          className="ngr-title"
          value={title}
          maxLength={40}
          placeholder="group name"
          onChange={(e) => setTitle(e.target.value)}
        />

        <div className="ngr-label">
          add friends <em>{picked.size > 0 ? `· ${picked.size} selected` : ''}</em>
        </div>
        <div className="afr-list">
          {friends.length === 0 && (
            <div className="convs-empty">no friends yet — find people first, then start a group.</div>
          )}
          {friends.map((p) => {
            const on = picked.has(p.id)
            return (
              <button key={p.id} className={`afr-row ngr-row${on ? ' on' : ''}`} onClick={() => toggle(p.id)}>
                <div className="convs-av" style={{ background: p.avatar_color }}>
                  {p.avatar_url ? <img src={p.avatar_url} alt="" /> : <span>{p.initials}</span>}
                  {p.isOnline && <span className="convs-dot" />}
                </div>
                <div className="afr-info"><span className="convs-name">{p.display_name}</span></div>
                <span className={`ngr-check${on ? ' on' : ''}`}>
                  {on && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
                </span>
              </button>
            )
          })}
        </div>

        {err && <div className="sprompt-error">{err}</div>}

        <button className="ngr-create" onClick={create} disabled={busy || !title.trim() || picked.size === 0}>
          {busy ? 'creating…' : `create group${picked.size > 0 ? ` (${picked.size + 1})` : ''}`}
        </button>
      </div>
    </div>
  )
}
