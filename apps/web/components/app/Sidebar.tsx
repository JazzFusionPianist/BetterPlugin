'use client'

import { useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile, Message, Conversation, GroupConversation } from '@orb/core'
import type { ThreadTarget } from './ChatThread'

interface Props {
  conversations: Conversation[]
  groupConversations: GroupConversation[]
  profileById: Map<string, Profile & { isOnline?: boolean }>
  currentUserId: string
  unread: Map<string, number>
  onOpen: (target: ThreadTarget) => void
}

/** One-line preview for the last message (attachments get a label). */
function preview(m: Message | null, mine: boolean): string {
  if (!m) return 'New group'
  if (m.content) return mine ? `You: ${m.content}` : m.content
  switch (m.attachment_type) {
    case 'audio': return '🎵 Audio'
    case 'multi-audio': return '🎵 Tracks'
    case 'image': return '🖼️ Photo'
    case 'video': return '🎬 Video'
    case 'game_invite': return '🎮 Game invite'
    default: return 'Attachment'
  }
}

function fmtWhen(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const days = (now.getTime() - d.getTime()) / 86400000
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: 'short' })
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

interface Row {
  key: string
  at: number
  unread: number
  title: string
  previewText: string
  when: string | null
  target: ThreadTarget
  avatar:
    | { kind: 'profile'; p: Profile & { isOnline?: boolean } }
    | { kind: 'group' }
}

/** Desktop conversations rail — the same catalogue index as the mobile
 *  sheet (DMs and groups, newest first, numbered), always on screen. */
export default function Sidebar({
  conversations, groupConversations, profileById, currentUserId, unread, onOpen,
}: Props) {
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    for (const c of conversations) {
      const p = profileById.get(c.partnerId)
      if (!p) continue
      out.push({
        key: c.conversationId,
        at: new Date(c.lastMessage.created_at).getTime(),
        unread: unread.get(c.conversationId) ?? 0,
        title: p.display_name,
        previewText: preview(c.lastMessage, c.lastMessage.sender_id === currentUserId),
        when: fmtWhen(c.lastMessage.created_at),
        target: { kind: 'dm', friend: p },
        avatar: { kind: 'profile', p },
      })
    }
    for (const g of groupConversations) {
      out.push({
        key: g.conversationId,
        at: g.lastMessage ? new Date(g.lastMessage.created_at).getTime() : new Date(g.createdAt).getTime(),
        unread: unread.get(g.conversationId) ?? 0,
        title: g.title || 'Group',
        previewText: preview(g.lastMessage, g.lastMessage?.sender_id === currentUserId),
        when: g.lastMessage ? fmtWhen(g.lastMessage.created_at) : null,
        target: { kind: 'group', conversationId: g.conversationId, title: g.title || 'Group', memberCount: g.memberIds.length },
        avatar: { kind: 'group' },
      })
    }
    return out.sort((a, b) => b.at - a.at)
  }, [conversations, groupConversations, profileById, unread, currentUserId])

  return (
    <aside className="webapp-sidebar">
      <div className="rail-head">
        <span className="word"><span className="mark" />Orb</span>
      </div>

      <div className="rail-section-label">Conversations</div>
      <div className="rail-list">
        {rows.length === 0 && (
          <div className="rail-empty">No conversations yet</div>
        )}
        {rows.map((r) => (
          <button key={r.key} className="rail-row" onClick={() => onOpen(r.target)}>
            {r.avatar.kind === 'group' ? (
              <div className="rail-av rail-av-group">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.4" /><path d="M3.5 19c0-3 2.6-4.6 5.5-4.6s5.5 1.6 5.5 4.6M15 18.6c0-1.8.9-3 2.6-3.2" /></svg>
              </div>
            ) : (
              <div className="rail-av" style={{ background: r.avatar.p.avatar_color }}>
                {r.avatar.p.avatar_url ? <img src={r.avatar.p.avatar_url} alt="" /> : <span>{r.avatar.p.initials}</span>}
                {r.avatar.p.isOnline && <span className="rail-dot" />}
              </div>
            )}
            <div className="rail-info">
              <div className="rail-name-row">
                <span className="rail-name">{r.title}</span>
                {r.when && <span className="rail-time">{r.when}</span>}
              </div>
              <div className="rail-preview">{r.previewText}</div>
            </div>
            {r.unread > 0 && <span className="rail-badge">{r.unread > 9 ? '9+' : r.unread}</span>}
          </button>
        ))}
      </div>

      <button className="rail-signout" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </aside>
  )
}
