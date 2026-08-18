'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Message, Profile } from '@orb/core'
import {
  renameGroupConversation,
  addGroupMembers,
  removeGroupMember,
} from '@/lib/games/conversations'

/**
 * Per-thread settings sheet — opened from the chat header.
 *
 *   Both kinds:  shared attachments (photos / audio / files), with
 *                expired items kept in the list by name.
 *   Groups:      photo, rename (host), roster, invite (host), kick
 *                (host), leave (anyone).
 *   DMs:         the two members + "delete chat" (self-removal).
 */

interface Member {
  userId: string
  role: 'admin' | 'member'
  profile: Profile
}

type MediaTab = 'photos' | 'audio' | 'files'

interface SharedItem {
  key: string
  url: string | null            // null once expired
  name: string
  type: string
  expired: boolean
  at: string
}

interface Props {
  supabase: SupabaseClient
  currentUserId: string
  conversationId: string
  chatKind: 'dm' | 'group'
  title: string
  avatarUrl?: string | null
  /** Invite pool — the user's friends; members filtered client-side. */
  friends: Profile[]
  profileById: Map<string, Profile>
  onClose: () => void
  /** After leaving / deleting the chat — parent closes the thread. */
  onLeft: () => void
}

const MEMBER_CAP = 16

export default function ChatSettingsSheet({
  supabase, currentUserId, conversationId, chatKind, title: initialTitle,
  avatarUrl: initialAvatarUrl, friends, profileById, onClose, onLeft,
}: Props) {
  const isGroup = chatKind === 'group'
  const [members, setMembers] = useState<Member[]>([])
  const [title, setTitle] = useState(initialTitle)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(initialTitle)
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialAvatarUrl ?? null)
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [addSelected, setAddSelected] = useState<Set<string>>(new Set())
  const [shared, setShared] = useState<SharedItem[]>([])
  const [tab, setTab] = useState<MediaTab>('photos')
  const fileRef = useRef<HTMLInputElement>(null)

  const meIsAdmin = useMemo(
    () => members.some((m) => m.userId === currentUserId && m.role === 'admin'),
    [members, currentUserId],
  )

  const refetchMembers = async () => {
    const { data, error: err } = await supabase
      .from('conversation_members')
      .select('user_id, role')
      .eq('conversation_id', conversationId)
    if (err) { console.error('[ChatSettings] members', err); return }
    const next: Member[] = []
    for (const r of (data ?? []) as { user_id: string; role: 'admin' | 'member' }[]) {
      const p = profileById.get(r.user_id)
      if (p) next.push({ userId: r.user_id, role: r.role, profile: p })
    }
    next.sort((a, b) => {
      if (a.role !== b.role) return a.role === 'admin' ? -1 : 1
      return a.profile.display_name.localeCompare(b.profile.display_name)
    })
    setMembers(next)
  }

  const refetchShared = async () => {
    const { data, error: err } = await supabase
      .from('messages')
      .select('id, attachment_url, attachment_type, attachment_name, attachment_expired, created_at')
      .eq('conversation_id', conversationId)
      .not('attachment_type', 'is', null)
      .neq('attachment_type', 'game_invite')
      .order('created_at', { ascending: false })
      .limit(300)
    if (err) { console.error('[ChatSettings] shared', err); return }
    const items: SharedItem[] = []
    for (const m of (data ?? []) as Message[]) {
      const expired = !!m.attachment_expired
      if (m.attachment_type === 'multi-audio' && !expired && m.attachment_url) {
        // A bundle message: unpack each track into its own row.
        try {
          const tracks = JSON.parse(m.attachment_url) as { url: string; name: string }[]
          tracks.forEach((t, i) => items.push({
            key: `${m.id}:${i}`, url: t.url, name: t.name || `track ${i + 1}`,
            type: 'audio', expired: false, at: m.created_at,
          }))
          continue
        } catch { /* fall through to a single row */ }
      }
      items.push({
        key: m.id,
        url: expired ? null : (m.attachment_url ?? null),
        name: m.attachment_name ?? 'attachment',
        type: m.attachment_type === 'multi-audio' ? 'audio' : (m.attachment_type ?? 'file'),
        expired,
        at: m.created_at,
      })
    }
    setShared(items)
  }

  useEffect(() => {
    refetchMembers()
    refetchShared()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  const photos = shared.filter((s) => s.type === 'image' || s.type === 'video')
  const audio = shared.filter((s) => s.type === 'audio')
  const files = shared.filter((s) => s.type !== 'image' && s.type !== 'video' && s.type !== 'audio')
  const tabItems = tab === 'photos' ? photos : tab === 'audio' ? audio : files

  const handleRename = async () => {
    const t = titleDraft.trim()
    if (!t || t === title) { setEditingTitle(false); setTitleDraft(title); return }
    setBusy(true); setError(null)
    try {
      await renameGroupConversation(supabase, conversationId, t)
      setTitle(t)
      setEditingTitle(false)
    } catch (err) {
      console.error('[ChatSettings] rename', err)
      setError('couldn’t rename — only the host can.')
    } finally { setBusy(false) }
  }

  const onPhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('over 5mb — choose a smaller image'); return }
    setUploading(true); setError(null)
    try {
      const ext = file.name.split('.').pop() || 'png'
      const path = `groups/${conversationId}/photo-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('avatars').upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) { setError('upload failed — try again'); return }
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
      const { error: dbErr } = await supabase
        .from('conversations').update({ avatar_url: pub.publicUrl }).eq('id', conversationId)
      if (dbErr) { setError('couldn’t save — try again'); return }
      setPhotoUrl(pub.publicUrl)
    } finally { setUploading(false) }
  }

  const handleKick = async (userId: string) => {
    if (!confirm('remove them from the group?')) return
    setBusy(true); setError(null)
    try {
      await removeGroupMember(supabase, conversationId, userId)
      await refetchMembers()
    } catch (err) {
      console.error('[ChatSettings] kick', err)
      setError('couldn’t remove them — try again.')
    } finally { setBusy(false) }
  }

  const handleLeave = async () => {
    if (!confirm(isGroup ? 'leave this group?' : 'delete this chat?')) return
    setBusy(true); setError(null)
    try {
      await removeGroupMember(supabase, conversationId, currentUserId)
      onLeft()
    } catch (err) {
      console.error('[ChatSettings] leave', err)
      setError(isGroup ? 'couldn’t leave — try again.' : 'couldn’t delete — try again.')
      setBusy(false)
    }
  }

  const memberIdSet = useMemo(() => new Set(members.map((m) => m.userId)), [members])
  const invitePool = useMemo(
    () => friends.filter((p) => !memberIdSet.has(p.id)),
    [friends, memberIdSet],
  )
  const remainingSlots = Math.max(0, MEMBER_CAP - members.length - addSelected.size)

  const handleConfirmAdd = async () => {
    if (addSelected.size === 0) { setAdding(false); return }
    setBusy(true); setError(null)
    try {
      await addGroupMembers(supabase, conversationId, Array.from(addSelected))
      setAddSelected(new Set())
      setAdding(false)
      await refetchMembers()
    } catch (err) {
      console.error('[ChatSettings] add', err)
      setError('couldn’t add them — try again.')
    } finally { setBusy(false) }
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toLowerCase()

  return (
    <div className="sset-overlay open chset-center" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sset chset">
        <span className="psheet-grab" />

        {/* ── Identity ── */}
        {isGroup ? (
          <div className="chset-id">
            <button
              className="chset-photo"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              aria-label="Change group photo"
              title="Change group photo"
            >
              {photoUrl ? (
                <img src={photoUrl} alt="" />
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.4" /><path d="M3.5 19c0-3 2.6-4.6 5.5-4.6s5.5 1.6 5.5 4.6M15 18.6c0-1.8.9-3 2.6-3.2" /></svg>
              )}
              <span className="chset-photo-edit">
                {uploading
                  ? <span className="sprompt-spinner" />
                  : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>}
              </span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhotoFile} />
            {editingTitle ? (
              <div className="chset-rename">
                <input
                  className="chset-rename-input"
                  value={titleDraft}
                  maxLength={40}
                  autoFocus
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRename() }}
                />
                <button className="chset-rename-save" onClick={handleRename} disabled={busy}>save</button>
              </div>
            ) : (
              <button
                className="chset-title"
                onClick={meIsAdmin ? () => { setTitleDraft(title); setEditingTitle(true) } : undefined}
                title={meIsAdmin ? 'Rename group' : undefined}
              >
                {title}
              </button>
            )}
            <div className="chset-sub">{members.length} members</div>
          </div>
        ) : (
          <div className="chset-id">
            <div className="chset-title as-text">{title}</div>
            <div className="chset-sub">direct message</div>
          </div>
        )}

        {error && <div className="chset-error">{error}</div>}

        {/* ── Shared attachments ── */}
        <div className="chset-label">shared</div>
        <div className="chset-tabs">
          {(['photos', 'audio', 'files'] as MediaTab[]).map((k) => (
            <button
              key={k}
              className={`chset-tab${tab === k ? ' on' : ''}`}
              onClick={() => setTab(k)}
            >
              {k} · {k === 'photos' ? photos.length : k === 'audio' ? audio.length : files.length}
            </button>
          ))}
        </div>
        {tabItems.length === 0 ? (
          <div className="chset-empty">nothing shared yet</div>
        ) : tab === 'photos' ? (
          <div className="chset-grid">
            {tabItems.map((s) => s.expired || !s.url ? (
              <div key={s.key} className="chset-thumb expired" title={`${s.name} — expired`}>
                <span>{s.name}</span>
              </div>
            ) : s.type === 'video' ? (
              <video key={s.key} className="chset-thumb" src={s.url} preload="metadata" onClick={() => window.open(s.url!, '_blank')} />
            ) : (
              <img key={s.key} className="chset-thumb" src={s.url} alt={s.name} onClick={() => window.open(s.url!, '_blank')} />
            ))}
          </div>
        ) : (
          <div className="chset-rows">
            {tabItems.map((s) => (
              <button
                key={s.key}
                className={`chset-filerow${s.expired ? ' expired' : ''}`}
                onClick={() => { if (s.url) window.open(s.url, '_blank') }}
                disabled={!s.url}
              >
                <span aria-hidden="true">{s.type === 'audio' ? 'audio' : 'file'}</span>
                <span className="chset-filename">{s.name}</span>
                <span className="chset-filemeta">{s.expired ? 'expired' : fmtDate(s.at)}</span>
              </button>
            ))}
          </div>
        )}

        {/* ── Members ── */}
        <div className="chset-label-row">
          <div className="chset-label">members · {members.length}</div>
          {isGroup && meIsAdmin && members.length < MEMBER_CAP && !adding && (
            <button className="chset-link" onClick={() => setAdding(true)}>+ add</button>
          )}
        </div>
        {adding && (
          <div className="chset-addbox">
            {invitePool.length === 0 ? (
              <div className="chset-empty">no more friends to add</div>
            ) : invitePool.map((p) => {
              const on = addSelected.has(p.id)
              const dim = !on && remainingSlots === 0
              return (
                <button
                  key={p.id}
                  className={`chset-member${on ? ' picked' : ''}${dim ? ' dim' : ''}`}
                  onClick={() => {
                    if (dim) return
                    setAddSelected((prev) => {
                      const next = new Set(prev)
                      if (next.has(p.id)) next.delete(p.id); else next.add(p.id)
                      return next
                    })
                  }}
                >
                  <span className="chset-member-av" style={{ background: p.avatar_color }}>
                    {p.avatar_url ? <img src={p.avatar_url} alt="" /> : <span>{p.initials}</span>}
                  </span>
                  <span className="chset-member-name">{p.display_name}</span>
                  <span className={`chset-check${on ? ' on' : ''}`} />
                </button>
              )
            })}
            <div className="chset-addrow">
              <button className="chset-link" onClick={() => { setAdding(false); setAddSelected(new Set()) }}>cancel</button>
              <button className="chset-rename-save" onClick={handleConfirmAdd} disabled={busy || addSelected.size === 0}>
                {addSelected.size === 0 ? 'select people' : `add ${addSelected.size}`}
              </button>
            </div>
          </div>
        )}
        <div className="chset-rows">
          {members.map((m) => (
            <div key={m.userId} className="chset-member">
              <span className="chset-member-av" style={{ background: m.profile.avatar_color }}>
                {m.profile.avatar_url ? <img src={m.profile.avatar_url} alt="" /> : <span>{m.profile.initials}</span>}
              </span>
              <span className="chset-member-name">
                {m.profile.display_name}
                {m.userId === currentUserId && <em> · you</em>}
              </span>
              {m.role === 'admin' && <span className="chset-host">host</span>}
              {isGroup && meIsAdmin && m.userId !== currentUserId && (
                <button className="chset-kick" onClick={() => handleKick(m.userId)} disabled={busy} title="Remove from group">
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M2 2l8 8M10 2l-8 8" /></svg>
                </button>
              )}
            </div>
          ))}
        </div>

        <button className="chset-leave" onClick={handleLeave} disabled={busy}>
          {isGroup ? 'leave group' : 'delete chat'}
        </button>
      </div>
    </div>
  )
}
