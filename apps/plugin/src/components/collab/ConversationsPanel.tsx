import { useMemo } from 'react'
import type { Profile } from '../../types/collab'
import type { Conversation, GroupConversation } from '../../hooks/useConversations'
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
  groupConversations: GroupConversation[]
  profiles: Profile[]
  favorites: Set<string>
  currentUserId: string
  onOpenChat: (id: string) => void
  onOpenGroupChat: (convId: string) => void
  /** Open the "new group" creation flow. */
  onNewGroup: () => void
}

/** Discriminated row used inside the unified, time-sorted list. */
type Row =
  | { kind: 'dm';    conv: Conversation }
  | { kind: 'group'; conv: GroupConversation }

export default function ConversationsPanel({
  conversations,
  groupConversations,
  profiles,
  favorites,
  currentUserId,
  onOpenChat,
  onOpenGroupChat,
  onNewGroup,
}: Props) {
  const { t } = useT()

  // Merge DMs + groups into one list sorted by most-recent activity.
  // Groups without messages fall back to their createdAt — keeps fresh
  // groups visible right after creation.
  const rows: Row[] = useMemo(() => {
    const dmRows: Row[]    = conversations.map(c       => ({ kind: 'dm',    conv: c } as Row))
    const groupRows: Row[] = groupConversations.map(c  => ({ kind: 'group', conv: c } as Row))
    const all = [...dmRows, ...groupRows]
    const tsOf = (r: Row): number => r.kind === 'dm'
      ? new Date(r.conv.lastMessage.created_at).getTime()
      : new Date(r.conv.lastMessage?.created_at ?? r.conv.createdAt).getTime()
    return all.sort((a, b) => tsOf(b) - tsOf(a))
  }, [conversations, groupConversations])

  return (
    <>
      <FloatingOrbs count={28} />

      <div className="conv-list">
        {rows.length === 0 && (
          <div className="collab-loading" style={{ flex: 'unset', marginTop: 40 }}>
            {t('conv.emptyAll')}
          </div>
        )}
        {rows.map(row => {
          if (row.kind === 'dm') {
            const c = row.conv
            const profile = profiles.find(p => p.id === c.partnerId)
            if (!profile) return null
            const msg = c.lastMessage
            const isMine = msg.sender_id === currentUserId
            const preview = msg.attachment_type
              ? msg.attachment_type === 'image' ? (isMine ? t('conv.youSentPhoto') : t('conv.sentPhoto'))
                : msg.attachment_type === 'video' ? (isMine ? t('conv.youSentVideo') : t('conv.sentVideo'))
                : msg.attachment_type === 'game_invite' ? (isMine ? t('conv.youSentGameInvite') : t('conv.sentGameInvite'))
                : (isMine ? t('conv.youSentAudio') : t('conv.sentAudio'))
              : isMine ? t('conv.youPrefix', { content: msg.content }) : msg.content
            return (
              <div key={`dm:${c.partnerId}`} className="conv-row" onClick={() => onOpenChat(c.partnerId)}>
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
          }

          // Group row
          const gc = row.conv
          const msg = gc.lastMessage
          let preview: string
          if (!msg) {
            preview = `${gc.memberIds.length} members`
          } else {
            const isMine = msg.sender_id === currentUserId
            // Sender name for group previews — falls back to "someone"
            // when the profile hasn't loaded yet (rare, self-heals).
            const senderName = isMine
              ? 'You'
              : profiles.find(p => p.id === msg.sender_id)?.display_name ?? 'someone'
            const body = msg.attachment_type
              ? msg.attachment_type === 'image' ? '📷 Photo'
                : msg.attachment_type === 'video' ? '🎬 Video'
                : msg.attachment_type === 'game_invite' ? '🎮 Game invite'
                : '🎵 Audio'
              : msg.content
            preview = `${senderName}: ${body}`
          }
          const timeIso = msg?.created_at ?? gc.createdAt
          return (
            <div
              key={`grp:${gc.conversationId}`}
              className="conv-row"
              onClick={() => onOpenGroupChat(gc.conversationId)}
            >
              <div className="conv-av conv-av-group">
                {/* Constellation glyph — same shape as the orb cluster. */}
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="6"  cy="9"  r="2.2" fill="#fff" stroke="none" />
                  <circle cx="18" cy="9"  r="2.2" fill="#fff" stroke="none" />
                  <circle cx="12" cy="17" r="2.2" fill="#fff" stroke="none" />
                  <path d="M6 9 L18 9 M6 9 L12 17 M18 9 L12 17" opacity="0.55" />
                </svg>
              </div>
              <div className="conv-info">
                <div className="conv-name-row">
                  <span className="conv-name">{gc.title}</span>
                  <span className="conv-time">{formatConvTime(timeIso)}</span>
                </div>
                <div className="conv-preview">{preview}</div>
              </div>
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
