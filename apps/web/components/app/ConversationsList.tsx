'use client'

import { useMemo } from 'react'
import type { Profile, Message, Conversation, GroupConversation } from '@orb/core'
import type { ThreadTarget } from './ChatThread'

interface Props {
  open: boolean
  conversations: Conversation[]
  groupConversations: GroupConversation[]
  profileById: Map<string, Profile & { isOnline?: boolean }>
  unread: Map<string, number>
  onOpen: (target: ThreadTarget) => void
  onNewGroup: () => void
  onClose: () => void
}

/** One-line preview for the last message (attachments get a label). */
function preview(m: Message | null): string {
  if (!m) return 'New group'
  if (m.content) return m.content
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

/** Slide-up sheet listing every conversation — DMs and groups together,
 *  newest activity first. The mobile "chats" home. */
export default function ConversationsList({
  open, conversations, groupConversations, profileById, unread, onOpen, onNewGroup, onClose,
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
        previewText: preview(c.lastMessage),
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
        previewText: preview(g.lastMessage),
        when: g.lastMessage ? fmtWhen(g.lastMessage.created_at) : null,
        target: { kind: 'group', conversationId: g.conversationId, title: g.title || 'Group', memberCount: g.memberIds.length },
        avatar: { kind: 'group' },
      })
    }
    return out.sort((a, b) => b.at - a.at)
  }, [conversations, groupConversations, profileById, unread])

  return (
    <div className={`convs${open ? ' open' : ''}`} aria-hidden={!open}>
      <div className="convs-sheet">
        <header className="convs-head">
          <h2>Chats</h2>
          <button className="convs-newgroup" onClick={onNewGroup} aria-label="New group">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.4" /><path d="M2.8 20c0-3.4 2.8-5.2 6.2-5.2 1.4 0 2.7.3 3.7.9M18 13v7M14.5 16.5h7" /></svg>
          </button>
          <button className="convs-close" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
          </button>
        </header>

        <div className="convs-list">
          {rows.length === 0 && (
            <div className="convs-empty">No conversations yet — tap a friend orb to start one.</div>
          )}
          {rows.map((r) => (
            <button key={r.key} className="convs-row" onClick={() => onOpen(r.target)}>
              {r.avatar.kind === 'profile' ? (
                <div className="convs-av" style={{ background: r.avatar.p.avatar_color }}>
                  {r.avatar.p.avatar_url ? <img src={r.avatar.p.avatar_url} alt="" /> : <span>{r.avatar.p.initials}</span>}
                  {r.avatar.p.isOnline && <span className="convs-dot" />}
                </div>
              ) : (
                <div className="convs-av convs-av-group">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.4" /><path d="M3.5 19c0-3 2.6-4.6 5.5-4.6s5.5 1.6 5.5 4.6M15 18.6c0-1.8.9-3 2.6-3.2" /></svg>
                </div>
              )}
              <div className="convs-info">
                <div className="convs-toprow">
                  <span className="convs-name">{r.title}</span>
                  {r.when && <span className="convs-when">{r.when}</span>}
                </div>
                <div className="convs-botrow">
                  <span className="convs-preview">{r.previewText}</span>
                  {r.unread > 0 && <span className="convs-badge">{r.unread > 9 ? '9+' : r.unread}</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
