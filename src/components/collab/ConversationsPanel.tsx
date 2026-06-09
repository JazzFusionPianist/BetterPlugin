import { useState } from 'react'
import type { Profile } from '../../types/collab'
import type { Conversation } from '../../hooks/useConversations'
import FloatingOrbs from '../FloatingOrbs'
import { useT } from '../../i18n/LanguageContext'

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
  /** Open the "new group" creation flow. */
  onNewGroup: () => void
}

export default function ConversationsPanel({ conversations, profiles, favorites, currentUserId, onOpenChat, onNewGroup }: Props) {
  const { t } = useT()
  const [tab, setTab] = useState<'all' | 'favorites'>('all')

  const filtered = tab === 'favorites'
    ? conversations.filter(c => favorites.has(c.partnerId))
    : conversations

  return (
    <>
      <FloatingOrbs count={28} />
      <div className="conv-tabs" style={{ marginTop: 12 }}>
        <button className={`conv-tab${tab === 'all' ? ' active' : ''}`} onClick={() => setTab('all')}>{t('conv.tabAll')}</button>
        <button className={`conv-tab${tab === 'favorites' ? ' active' : ''}`} onClick={() => setTab('favorites')}>{t('conv.tabFavorites')}</button>
      </div>

      <div className="conv-list">
        {filtered.length === 0 && (
          <div className="collab-loading" style={{ flex: 'unset', marginTop: 40 }}>
            {tab === 'favorites' ? t('conv.emptyFavorites') : t('conv.emptyAll')}
          </div>
        )}
        {filtered.map(c => {
          const profile = profiles.find(p => p.id === c.partnerId)
          if (!profile) return null
          const msg = c.lastMessage
          const isMine = msg.sender_id === currentUserId
          const preview = msg.attachment_type
            ? msg.attachment_type === 'image' ? (isMine ? t('conv.youSentPhoto') : t('conv.sentPhoto'))
              : msg.attachment_type === 'video' ? (isMine ? t('conv.youSentVideo') : t('conv.sentVideo'))
              : (isMine ? t('conv.youSentAudio') : t('conv.sentAudio'))
            : isMine ? t('conv.youPrefix', { content: msg.content }) : msg.content
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

      {/* Floating + button — opens the new-group flow. Sits bottom-right
          of the chat list so it's reachable without occluding any row. */}
      <button
        className="conv-new-group"
        onClick={onNewGroup}
        aria-label="New group"
        title="New group"
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M10 4v12M4 10h12" />
        </svg>
      </button>
    </>
  )
}
