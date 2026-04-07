import { useState } from 'react'
import type { Profile } from '../../types/collab'
import type { Conversation } from '../../hooks/useConversations'

function formatConvTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

interface Props {
  conversations: Conversation[]
  profiles: Profile[]
  favorites: Set<string>
  currentUserId: string
  onOpenChat: (id: string) => void
}

export default function ConversationsPanel({ conversations, profiles, favorites, currentUserId, onOpenChat }: Props) {
  const [tab, setTab] = useState<'all' | 'favorites'>('all')

  const filtered = tab === 'favorites'
    ? conversations.filter(c => favorites.has(c.partnerId))
    : conversations

  return (
    <>
      <div className="conv-tabs" style={{ marginTop: 12 }}>
        <button className={`conv-tab${tab === 'all' ? ' active' : ''}`} onClick={() => setTab('all')}>All</button>
        <button className={`conv-tab${tab === 'favorites' ? ' active' : ''}`} onClick={() => setTab('favorites')}>Favorites</button>
      </div>

      <div className="conv-list">
        {filtered.length === 0 && (
          <div className="collab-loading" style={{ flex: 'unset', marginTop: 40 }}>
            {tab === 'favorites' ? 'No favorite conversations' : 'No conversations yet'}
          </div>
        )}
        {filtered.map(c => {
          const profile = profiles.find(p => p.id === c.partnerId)
          if (!profile) return null
          const msg = c.lastMessage
          const isMine = msg.sender_id === currentUserId
          const preview = msg.attachment_type
            ? msg.attachment_type === 'image' ? (isMine ? 'You sent a photo' : 'Sent a photo')
              : msg.attachment_type === 'video' ? (isMine ? 'You sent a video' : 'Sent a video')
              : (isMine ? 'You sent an audio' : 'Sent an audio')
            : isMine ? `You: ${msg.content}` : msg.content
          return (
            <div key={c.partnerId} className="conv-row" onClick={() => onOpenChat(c.partnerId)}>
              <div className="conv-av" style={{ background: profile.avatar_color }}>
                {profile.avatar_url
                  ? <img src={profile.avatar_url} alt="" />
                  : profile.initials}
                <div className={`chdr-dot ${profile.isOnline ? 'don' : 'doff'}`} />
              </div>
              <div className="conv-info">
                <div className="conv-name-row">
                  <span className="conv-name">{profile.display_name}</span>
                  <span className="conv-time">{formatConvTime(msg.created_at)}</span>
                </div>
                <div className="conv-preview">{preview}</div>
              </div>
              {favorites.has(c.partnerId) && <span className="conv-fav-star">★</span>}
            </div>
          )
        })}
      </div>
    </>
  )
}
