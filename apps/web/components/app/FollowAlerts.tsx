'use client'

import { useState } from 'react'
import type { FollowAlert } from '@orb/core'

interface Props {
  alerts: FollowAlert[]
  followingIds: Set<string>
  onFollowBack: (id: string) => Promise<void>
  onDismiss: (id: string) => void
}

const VISIBLE = 3

/**
 * "{name} follows you" cards — a quiet catalogue stack pinned top-centre.
 * Follow back in one tap; already-mutual alerts read as a caption
 * instead of a button. Backed by unread notifications, so the stack
 * also greets you with anything that happened while you were away.
 */
export default function FollowAlerts({ alerts, followingIds, onFollowBack, onDismiss }: Props) {
  const [busy, setBusy] = useState<Set<string>>(new Set())
  if (alerts.length === 0) return null

  const followBack = async (alert: FollowAlert) => {
    if (busy.has(alert.id)) return
    setBusy((prev) => new Set([...prev, alert.id]))
    try {
      await onFollowBack(alert.actorId)
      onDismiss(alert.id)
    } catch (err) {
      console.error('[followBack]', err)
    } finally {
      setBusy((prev) => { const n = new Set(prev); n.delete(alert.id); return n })
    }
  }

  return (
    <div className="fnotif-stack">
      {alerts.slice(0, VISIBLE).map((a) => {
        const name = a.actor?.display_name || 'someone'
        const mutual = followingIds.has(a.actorId)
        return (
          <div className="fnotif" key={a.id}>
            <span className="fnotif-orb" style={{ background: a.actor?.avatar_color || 'var(--blue)' }}>
              {a.actor?.avatar_url
                ? <img src={a.actor.avatar_url} alt="" />
                : (a.actor?.initials || '?')}
            </span>
            <span className="fnotif-text">
              <span className="fnotif-name">{name}</span> follows you
            </span>
            {mutual ? (
              <span className="fnotif-mutual">you follow each other</span>
            ) : (
              <button
                className="fnotif-back"
                disabled={busy.has(a.id)}
                onClick={() => followBack(a)}
              >
                follow back
              </button>
            )}
            <button className="fnotif-x" onClick={() => onDismiss(a.id)} aria-label="Dismiss">
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M1 1l8 8M9 1L1 9" /></svg>
            </button>
          </div>
        )
      })}
      {alerts.length > VISIBLE && (
        <div className="fnotif-more">+{alerts.length - VISIBLE} more</div>
      )}
    </div>
  )
}
