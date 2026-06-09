import { useEffect, useState, useMemo } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '../../types/collab'
import {
  renameGroupConversation,
  addGroupMembers,
  removeGroupMember,
} from '../../lib/conversations'

/**
 * Settings sheet for an open group chat. Lets the user:
 *   • see the title + member roster
 *   • rename the group           (host only — RLS enforces)
 *   • invite more people         (host only — RLS enforces)
 *   • remove a member            (host only — RLS enforces)
 *   • leave the group            (anyone — self-delete)
 *
 * Mounts on top of ChatView when the user taps the chat header. Closes
 * via the ✕ in the corner or by clicking the dim backdrop.
 */

interface Member {
  userId: string
  role: 'admin' | 'member'
  profile: Profile
}

interface Props {
  supabase: SupabaseClient
  currentUserId: string
  conversationId: string
  initialTitle: string
  /** Member count known up-front from the chat header. Lets us paint
   *  the right number of skeleton rows during the initial fetch so
   *  the panel height doesn't jump when the real roster lands. */
  initialMemberCount: number
  /** Pool to draw new invitees from — typically the user's mutual
   *  friends. Members already in the group are filtered out
   *  client-side. */
  friendProfiles: Profile[]
  /** Used to display profile info for current members. */
  profileLookup: (id: string) => Profile | null
  onClose: () => void
  /** Called after the current user successfully leaves the group so
   *  CollabPage can navigate back to the chat list. */
  onLeft: () => void
}

export default function ChatSettingsPanel({
  supabase,
  currentUserId,
  conversationId,
  initialTitle,
  initialMemberCount,
  friendProfiles,
  profileLookup,
  onClose,
  onLeft,
}: Props) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState(initialTitle)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(initialTitle)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'view' | 'add'>('view')
  const [addQuery, setAddQuery] = useState('')
  const [addSelected, setAddSelected] = useState<Set<string>>(new Set())

  const meIsAdmin = useMemo(
    () => members.some(m => m.userId === currentUserId && m.role === 'admin'),
    [members, currentUserId],
  )

  const refetchMembers = async () => {
    const { data, error: err } = await supabase
      .from('conversation_members')
      .select('user_id, role')
      .eq('conversation_id', conversationId)
    if (err) { console.error('[ChatSettings] members fetch', err); return }
    type Row = { user_id: string; role: 'admin' | 'member' }
    const rows = (data ?? []) as Row[]
    const next: Member[] = []
    for (const r of rows) {
      const p = profileLookup(r.user_id)
      if (p) next.push({ userId: r.user_id, role: r.role, profile: p })
    }
    // Sort: admin(s) first, then alphabetical
    next.sort((a, b) => {
      if (a.role !== b.role) return a.role === 'admin' ? -1 : 1
      return a.profile.display_name.localeCompare(b.profile.display_name)
    })
    setMembers(next)
  }

  useEffect(() => {
    let alive = true
    setLoading(true)
    refetchMembers().finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

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
      setError('Failed to rename. Are you the host?')
    } finally { setBusy(false) }
  }

  const handleKick = async (userId: string) => {
    if (!confirm('Remove this member from the group?')) return
    setBusy(true); setError(null)
    try {
      await removeGroupMember(supabase, conversationId, userId)
      await refetchMembers()
    } catch (err) {
      console.error('[ChatSettings] kick', err)
      setError('Failed to remove member.')
    } finally { setBusy(false) }
  }

  const handleLeave = async () => {
    if (!confirm('Leave this group?')) return
    setBusy(true); setError(null)
    try {
      await removeGroupMember(supabase, conversationId, currentUserId)
      onLeft()
    } catch (err) {
      console.error('[ChatSettings] leave', err)
      setError('Failed to leave.')
      setBusy(false)
    }
  }

  const handleConfirmAdd = async () => {
    if (addSelected.size === 0) { setMode('view'); return }
    setBusy(true); setError(null)
    try {
      await addGroupMembers(supabase, conversationId, Array.from(addSelected))
      setAddSelected(new Set())
      setAddQuery('')
      setMode('view')
      await refetchMembers()
    } catch (err) {
      console.error('[ChatSettings] addMembers', err)
      setError('Failed to add members. Are you the host?')
    } finally { setBusy(false) }
  }

  // Invite pool — friends not yet in the group.
  const memberIdSet = useMemo(() => new Set(members.map(m => m.userId)), [members])
  const invitePool = useMemo(() => {
    const q = addQuery.trim().toLowerCase()
    return friendProfiles
      .filter(p => !memberIdSet.has(p.id))
      .filter(p => !q || p.display_name.toLowerCase().includes(q))
  }, [friendProfiles, memberIdSet, addQuery])

  const toggleInvite = (id: string) => {
    setAddSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // Cap-aware: 16 total members max.
  const remainingSlots = Math.max(0, 16 - members.length - addSelected.size)

  return (
    <div className="chat-settings" role="dialog" aria-modal="true">
      <div className="chat-settings-backdrop" onClick={onClose} />
      <div className="chat-settings-sheet">
        <div className="chat-settings-header">
          {mode === 'add' ? (
            <button className="chat-settings-back" onClick={() => { setMode('view'); setAddSelected(new Set()); setAddQuery('') }}>
              ‹
            </button>
          ) : <span />}
          <div className="chat-settings-heading">
            {mode === 'view' ? 'Group info' : 'Add members'}
          </div>
          <button className="chat-settings-close" onClick={onClose} aria-label="Close">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M2 2l8 8M10 2l-8 8" />
            </svg>
          </button>
        </div>

        {error && <div className="chat-settings-error">{error}</div>}

        {mode === 'view' && (
          <>
            {/* Title block */}
            <div className="chat-settings-section">
              <div className="chat-settings-label">Group name</div>
              {editingTitle ? (
                <div className="chat-settings-title-edit">
                  <input
                    className="chat-settings-input"
                    value={titleDraft}
                    onChange={e => setTitleDraft(e.target.value)}
                    maxLength={40}
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') handleRename() }}
                  />
                  <button
                    className="chat-settings-action"
                    onClick={handleRename}
                    disabled={busy || !titleDraft.trim()}
                  >Save</button>
                  <button
                    className="chat-settings-action chat-settings-action-ghost"
                    onClick={() => { setEditingTitle(false); setTitleDraft(title) }}
                  >Cancel</button>
                </div>
              ) : (
                <div
                  className={`chat-settings-title-view${meIsAdmin ? ' editable' : ''}`}
                  onClick={meIsAdmin ? () => setEditingTitle(true) : undefined}
                  title={meIsAdmin ? 'Tap to rename' : 'Only the host can rename the group'}
                >
                  <span>{title}</span>
                  {meIsAdmin && (
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2l2 2-8 8H4v-2l8-8z" />
                    </svg>
                  )}
                </div>
              )}
            </div>

            {/* Member roster */}
            <div className="chat-settings-section">
              <div className="chat-settings-section-row">
                <div className="chat-settings-label">Members · {members.length}</div>
                {meIsAdmin && members.length < 16 && (
                  <button
                    className="chat-settings-link"
                    onClick={() => setMode('add')}
                  >+ Add</button>
                )}
              </div>
              {loading ? (
                // Ghost rows shaped like real member rows so the panel
                // height matches what's about to appear — prevents the
                // jump that happens when "Loading…" gets replaced with
                // a roster of a different height.
                Array.from({ length: Math.max(1, initialMemberCount) }).map((_, i) => (
                  <div key={`skel-${i}`} className="chat-settings-member-row chat-settings-skeleton">
                    <div className="chat-settings-member-av chat-settings-skel-block" />
                    <div className="chat-settings-member-info">
                      <div className="chat-settings-skel-bar" style={{ width: '50%' }} />
                    </div>
                  </div>
                ))
              ) : members.map(m => (
                <div key={m.userId} className="chat-settings-member-row">
                  <div className="chat-settings-member-av" style={{ background: m.profile.avatar_color }}>
                    {m.profile.avatar_url
                      ? <img src={m.profile.avatar_url} alt="" />
                      : <span>{m.profile.initials}</span>}
                  </div>
                  <div className="chat-settings-member-info">
                    <div className="chat-settings-member-name">
                      {m.profile.display_name}
                      {m.userId === currentUserId && <span className="chat-settings-you"> · you</span>}
                      {m.role === 'admin' && (
                        <span className="chat-settings-host-tag">host</span>
                      )}
                    </div>
                  </div>
                  {meIsAdmin && m.userId !== currentUserId && (
                    <button
                      className="chat-settings-kick"
                      onClick={() => handleKick(m.userId)}
                      disabled={busy}
                      aria-label={`Remove ${m.profile.display_name}`}
                      title="Remove from group"
                    >
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                        <path d="M2 2l8 8M10 2l-8 8" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Leave */}
            <button
              className="chat-settings-leave"
              onClick={handleLeave}
              disabled={busy}
            >
              Leave group
            </button>
          </>
        )}

        {mode === 'add' && (
          <>
            <div className="chat-settings-section">
              <input
                className="chat-settings-input chat-settings-search"
                placeholder="Search friends…"
                value={addQuery}
                onChange={e => setAddQuery(e.target.value)}
                autoFocus
              />
              <div className="chat-settings-cap">
                {addSelected.size} selected · {remainingSlots} slot{remainingSlots === 1 ? '' : 's'} left
              </div>
              {invitePool.length === 0 && (
                <div className="chat-settings-empty">
                  {addQuery.trim() ? 'No matches' : 'No more friends to add'}
                </div>
              )}
              {invitePool.map(p => {
                const isOn = addSelected.has(p.id)
                const dimmed = !isOn && remainingSlots === 0
                return (
                  <div
                    key={p.id}
                    className={`chat-settings-pick${isOn ? ' on' : ''}${dimmed ? ' dim' : ''}`}
                    onClick={() => !dimmed && toggleInvite(p.id)}
                  >
                    <div className="chat-settings-member-av" style={{ background: p.avatar_color }}>
                      {p.avatar_url ? <img src={p.avatar_url} alt="" /> : <span>{p.initials}</span>}
                    </div>
                    <span className="chat-settings-member-name">{p.display_name}</span>
                    <div className={`chat-settings-check${isOn ? ' on' : ''}`}>
                      {isOn && (
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2.5 6.5l2.5 2.5L9.5 3" />
                        </svg>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <button
              className="chat-settings-cta"
              onClick={handleConfirmAdd}
              disabled={busy || addSelected.size === 0}
            >
              {busy ? 'Adding…' : addSelected.size === 0 ? 'Select people to add' : `Add ${addSelected.size}`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
