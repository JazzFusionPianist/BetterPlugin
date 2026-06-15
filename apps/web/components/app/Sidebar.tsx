'use client'

import { supabase } from '@/lib/supabase'
import type { Profile, Conversation } from '@orb/core'

interface Props {
  conversations: Conversation[]
  profiles: Profile[]
  currentUserId: string
  unreadByFriend: Map<string, number>
  onClose: () => void
}

function timeLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (days < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function Sidebar({ conversations, profiles, currentUserId, unreadByFriend, onClose }: Props) {
  return (
    <aside className="webapp-sidebar">
      <div className="rail-head">
        <span className="word"><span className="mark" />Orb</span>
        <button className="rail-x" onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 2l10 10M12 2L2 12" /></svg>
        </button>
      </div>

      <div className="rail-section-label">Conversations</div>
      <div className="rail-list">
        {conversations.length === 0 && (
          <div className="rail-empty">No conversations yet</div>
        )}
        {conversations.map(c => {
          const p = profiles.find(x => x.id === c.partnerId)
          if (!p) return null
          const m = c.lastMessage
          const isMine = m.sender_id === currentUserId
          const preview = m.attachment_type
            ? (isMine ? 'You sent an attachment' : 'Sent an attachment')
            : (isMine ? `You: ${m.content}` : m.content)
          const unread = unreadByFriend.get(c.partnerId) ?? 0
          return (
            <button key={c.conversationId} className="rail-row">
              <div className="rail-av" style={{ background: p.avatar_color }}>
                {p.avatar_url ? <img src={p.avatar_url} alt="" /> : <span>{p.initials}</span>}
                {p.isOnline && <span className="rail-dot" />}
              </div>
              <div className="rail-info">
                <div className="rail-name-row">
                  <span className="rail-name">{p.display_name}</span>
                  <span className="rail-time">{timeLabel(m.created_at)}</span>
                </div>
                <div className="rail-preview">{preview}</div>
              </div>
              {unread > 0 && <span className="rail-badge">{unread > 9 ? '9+' : unread}</span>}
            </button>
          )
        })}
      </div>

      <button className="rail-signout" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </aside>
  )
}
