'use client'

import { useEffect, useState } from 'react'
import type { Profile } from '@orb/core'

interface Props {
  /** The tapped friend, or null when closed. */
  friend: (Profile & { isOnline?: boolean }) | null
  unread: number
  onClose: () => void
  onMessage: (friend: Profile) => void
  onVisitPortfolio: (friend: Profile) => void
}

/**
 * Bottom sheet that appears when a friend orb is tapped — the mobile
 * equivalent of the plugin's hover popup. Shows the friend and a way to
 * jump into a conversation.
 */
export default function ProfileSheet({ friend, unread, onClose, onMessage, onVisitPortfolio }: Props) {
  // Retain the last friend through the close animation so the content
  // doesn't blank out as the sheet slides away.
  const [shown, setShown] = useState(friend)
  useEffect(() => { if (friend) setShown(friend) }, [friend])
  const f = shown

  return (
    <div
      className={`psheet-overlay${friend ? ' open' : ''}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="psheet">
        <span className="psheet-grab" />
        {f && (
          <>
            <div className="psheet-av" style={{ background: f.avatar_color }}>
              {f.avatar_url ? <img src={f.avatar_url} alt="" /> : <span>{f.initials}</span>}
              {f.isOnline && <span className="psheet-dot" />}
            </div>
            <div className="psheet-name">{f.display_name}</div>
            {f.username
              ? <div className="psheet-user">@{f.username}</div>
              : <div className="psheet-status">{f.isOnline ? 'Online now' : 'Offline'}</div>}

            <button className="psheet-msg" onClick={() => onMessage(f)}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.4 8.4 0 0 1-11.7 7.7L3 21l1.9-6.3A8.4 8.4 0 1 1 21 11.5Z" />
              </svg>
              Message
              {unread > 0 && <span className="psheet-msg-badge">{unread > 9 ? '9+' : unread}</span>}
            </button>
            <button className="psheet-wall" onClick={() => onVisitPortfolio(f)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2.6" />
              </svg>
              Portfolio
            </button>
          </>
        )}
      </div>
    </div>
  )
}
