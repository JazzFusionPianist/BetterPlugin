import { useEffect, useState, useMemo } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '../../types/collab'
import {
  renameGroupConversation,
  addGroupMembers,
  removeGroupMember,
} from '../../lib/conversations'

/**
 * Settings sheet that mounts over either chat kind when the user taps
 * the chat header.
 *
 *   Group mode (kind='group'):
 *     • roster + host badge
 *     • rename / invite / kick (all host-only, RLS enforces)
 *     • leave group (anyone — self-delete)
 *
 *   DM mode (kind='dm'):
 *     • the two members
 *     • "Delete chat" — self-removes from the conversation, mirroring
 *       a familiar Slack/iMessage "delete conversation" affordance
 *     • "Add people" — promotes the DM into a brand-new group:
 *       creates a `kind='group'` conversation with the original
 *       partner + the picked friends and routes the user there.
 *       The original DM is left untouched.
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
  /** DM or group. Drives all the kind-specific affordances below. */
  chatKind: 'dm' | 'group'
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
  /** DM-only: invoked when the user converts the DM into a group via
   *  "Add people". CollabPage creates the new conversation and routes
   *  to it; returns the new convId on success, null on failure. */
  onPromoteToGroup?: (title: string, extraMemberIds: string[]) => Promise<string | null>
  onClose: () => void
  /** Called after the current user successfully leaves / deletes the
   *  chat so CollabPage can navigate back to the chat list. */
  onLeft: () => void
}

export default function ChatSettingsPanel({
  supabase,
  currentUserId,
  conversationId,
  chatKind,
  initialTitle,
  initialMemberCount,
  friendProfiles,
  profileLookup,
  onPromoteToGroup,
  onClose,
  onLeft,
}: Props) {
  const isGroup = chatKind === 'group'
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState(initialTitle)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(initialTitle)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 'view'  = roster + actions
  // 'add'   = group-mode "invite more people" sub-view
  // 'promote' = DM-mode "convert to group" sub-view (pick people + name)
  const [mode, setMode] = useState<'view' | 'add' | 'promote'>('view')
  const [addQuery, setAddQuery] = useState('')
  const [addSelected, setAddSelected] = useState<Set<string>>(new Set())
  const [promoteTitle, setPromoteTitle] = useState('')

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
    const msg = isGroup ? 'Leave this group?' : 'Delete this chat?'
    if (!confirm(msg)) return
    setBusy(true); setError(null)
    try {
      await removeGroupMember(supabase, conversationId, currentUserId)
      onLeft()
    } catch (err) {
      console.error('[ChatSettings] leave/delete', err)
      setError(isGroup ? 'Failed to leave.' : 'Failed to delete.')
      setBusy(false)
    }
  }

  const handlePromote = async () => {
    if (!onPromoteToGroup) return
    const t = promoteTitle.trim()
    if (!t || addSelected.size === 0) return
    setBusy(true); setError(null)
    try {
      const newConvId = await onPromoteToGroup(t, Array.from(addSelected))
      if (!newConvId) {
        setError('Failed to create group. Try again?')
        return
      }
      // CollabPage navigates on success — close ourselves.
      onClose()
    } catch (err) {
      console.error('[ChatSettings] promote', err)
      setError('Failed to create group.')
    } finally { setBusy(false) }
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
          {mode !== 'view' ? (
            <button
              className="chat-settings-back"
              onClick={() => {
                setMode('view')
                setAddSelected(new Set())
                setAddQuery('')
                setPromoteTitle('')
              }}
            >
              ‹
            </button>
          ) : <span />}
          <div className="chat-settings-heading">
            {mode === 'view'
              ? (isGroup ? 'Group info' : 'Chat info')
              : mode === 'add'
                ? 'Add members'
                : 'Add people'}
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
            {/* Title block — only meaningful for groups. DMs have no
                editable title (the header just shows the partner). */}
            {isGroup && (
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
            )}

            {/* Member roster */}
            <div className="chat-settings-section">
              <div className="chat-settings-section-row">
                <div className="chat-settings-label">Members · {members.length}</div>
                {/* Group host: invite straight into this conversation.
                    DM: tapping Add promotes the chat into a brand-new
                    group via the 'promote' sub-mode. */}
                {isGroup && meIsAdmin && members.length < 16 && (
                  <button
                    className="chat-settings-link"
                    onClick={() => setMode('add')}
                  >+ Add</button>
                )}
                {!isGroup && onPromoteToGroup && (
                  <button
                    className="chat-settings-link"
                    onClick={() => setMode('promote')}
                    title="Add people — converts this DM into a new group"
                  >+ Add people</button>
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

            {/* Leave / delete — same self-removal, different copy. */}
            <button
              className="chat-settings-leave"
              onClick={handleLeave}
              disabled={busy}
            >
              {isGroup ? 'Leave group' : 'Delete chat'}
            </button>
          </>
        )}

        {mode === 'promote' && (
          <>
            <div className="chat-settings-section">
              <div className="chat-settings-label">New group name</div>
              <input
                className="chat-settings-input"
                placeholder="Name your new group…"
                value={promoteTitle}
                onChange={e => setPromoteTitle(e.target.value)}
                maxLength={40}
                autoFocus
              />
            </div>
            <div className="chat-settings-section">
              <div className="chat-settings-label">Add people</div>
              <input
                className="chat-settings-input chat-settings-search"
                placeholder="Search friends…"
                value={addQuery}
                onChange={e => setAddQuery(e.target.value)}
              />
              {/* Selected count — DM partner + me are auto-included so
                  the effective group size is `addSelected.size + 2`. */}
              <div className="chat-settings-cap">
                {addSelected.size + 2} of 16 members
              </div>
              {invitePool.length === 0 && (
                <div className="chat-settings-empty">
                  {addQuery.trim() ? 'No matches' : 'No friends to add'}
                </div>
              )}
              {invitePool.map(p => {
                const isOn = addSelected.has(p.id)
                // Cap = 16 total. We auto-add me + DM partner, so the
                // selectable limit is 14 more.
                const remaining = 14 - addSelected.size
                const dimmed = !isOn && remaining <= 0
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
              onClick={handlePromote}
              disabled={busy || !promoteTitle.trim() || addSelected.size === 0}
            >
              {busy
                ? 'Creating…'
                : !promoteTitle.trim()
                  ? 'Name the group first'
                  : addSelected.size === 0
                    ? 'Pick people to add'
                    : `Create group with ${addSelected.size + 2} people`}
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
