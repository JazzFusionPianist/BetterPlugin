/**
 * Orb Studio — the workspace surface for the Orb Chat plugin build
 * (?surface=chat). Layout and print styling replicate the approved
 * WorkspaceDemo mockup (.wd-* classes, see studio.css): a project-first
 * rail on the left, a tabbed main pane (chat · stems · calendar) on
 * the right.
 *
 * Data wiring reuses CollabPage's exact hook patterns:
 *   rail projects  → useConversations().groupConversations
 *   rail people    → useProfiles + useFollows mutualIds (+ usePresence)
 *   unread badges  → useConversationNotifications
 *   chat           → useMessages (dm / group ChatTarget, same shape)
 *   stems tab      → StemPanel (existing component, collab.css styles)
 *   calendar tab   → ChatCalendar wired like ChatView does
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { useProfiles } from '../hooks/useProfiles'
import { usePresence } from '../hooks/usePresence'
import { useFollows } from '../hooks/useFollows'
import { useConversations } from '../hooks/useConversations'
import { useConversationNotifications } from '../hooks/useConversationNotifications'
import { useMessages } from '../hooks/useMessages'
import { useCalendarEvents, type NewCalendarEvent, type CalendarEvent } from '../hooks/useCalendarEvents'
import { useEventCategories } from '../hooks/useEventCategories'
import { parseSchedule } from '../lib/parseSchedule'
import StemPanel from '../components/collab/StemPanel'
import ChatCalendar from '../components/collab/ChatCalendar'
import { AudioAttachment } from '../components/collab/ChatView'
import { LanguageProvider } from '../i18n/LanguageContext'
import type { ChatTarget, Message, Profile } from '../types/collab'
import './studio.css'

interface Props { supabase: SupabaseClient; user: User }

type Sel =
  | { kind: 'dm'; userId: string }
  | { kind: 'group'; conversationId: string }

type Tab = 'chat' | 'stems' | 'calendar'

/** Average a set of #RRGGBB strings into one hex — same helper CollabPage
 *  uses for group tint (visually unifies a member set). */
function mixHexColors(hexes: string[]): string {
  if (hexes.length === 0) return '#4A8FE7'
  let r = 0, g = 0, b = 0
  for (const h of hexes) {
    const m = /^#?([0-9a-f]{6})$/i.exec(h.trim())
    if (!m) continue
    const v = parseInt(m[1]!, 16)
    r += (v >> 16) & 0xff
    g += (v >> 8) & 0xff
    b += v & 0xff
  }
  const n = hexes.length
  const to2 = (x: number) => Math.round(x / n).toString(16).padStart(2, '0')
  return `#${to2(r)}${to2(g)}${to2(b)}`
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yest = new Date(); yest.setDate(today.getDate() - 1)
  if (dayKey(iso) === dayKey(today.toISOString())) return 'today'
  if (dayKey(iso) === dayKey(yest.toISOString())) return 'yesterday'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** One-line preview of a message for the rail rows. */
function snippet(m: Message | null | undefined, senderName?: string): string {
  if (!m) return ''
  const body = m.attachment_type === 'audio' || m.attachment_type === 'multi-audio'
    ? `♪ ${m.attachment_name ?? 'audio'}`
    : m.attachment_type === 'image' ? 'image'
    : m.attachment_type === 'video' ? 'video'
    : m.attachment_type === 'game_invite' ? 'game invite'
    : m.content
  return senderName ? `${senderName}: ${body}` : body
}

function Avatar({ color, label, group, avatarUrl, dot }: {
  color: string; label: string; group?: boolean; avatarUrl?: string | null; dot?: 'on' | 'studio'
}) {
  return (
    <span className={`wd-av${group ? ' grp' : ''}`} style={{ background: color }}>
      {avatarUrl ? <img src={avatarUrl} alt="" /> : label}
      {dot && <span className={`wd-dot${dot === 'studio' ? ' studio' : ''}`} />}
    </span>
  )
}

export default function StudioShell({ supabase, user }: Props) {
  return (
    <LanguageProvider>
      <StudioShellInner supabase={supabase} user={user} />
    </LanguageProvider>
  )
}

function StudioShellInner({ supabase, user }: Props) {
  const [sel, setSel] = useState<Sel | null>(null)
  const [tab, setTab] = useState<Tab>('chat')

  const { profiles, me, loading: profilesLoading, refetch: refetchProfiles } = useProfiles(supabase, user.id)
  const onlineIds = usePresence(supabase, user.id)
  const { mutualIds } = useFollows(supabase, user.id)
  const { conversations, groupConversations } = useConversations(supabase, user.id)
  const { unread: convUnread, lastMessages: convLastMessages, markSeen } = useConversationNotifications(supabase, user.id)

  // Ensure a profile row exists (same guard as CollabPage).
  useEffect(() => {
    if (!profilesLoading && !me) {
      supabase.from('profiles').upsert(
        { id: user.id, display_name: user.email?.split('@')[0] ?? 'User' },
        { onConflict: 'id', ignoreDuplicates: true },
      ).then(() => refetchProfiles())
    }
  }, [profilesLoading, me, supabase, user.id, user.email, refetchProfiles])

  const profilesWithStatus = useMemo(
    () => profiles.map(p => ({ ...p, isOnline: onlineIds.has(p.id) })),
    [profiles, onlineIds],
  )
  const profileById = useMemo(() => {
    const m = new Map(profilesWithStatus.map(p => [p.id, p]))
    if (me) m.set(me.id, { ...me, isOnline: true })
    return m
  }, [profilesWithStatus, me])

  // Rail "people" — DM-able friends: the mutual-follow set, exactly as
  // CollabPage builds friendProfiles. Sorted online-first, then by name.
  const friendProfiles = useMemo(() => {
    const list = profilesWithStatus.filter(p => mutualIds.has(p.id))
    return list.sort((a, b) =>
      Number(b.isOnline) - Number(a.isOnline) || a.display_name.localeCompare(b.display_name))
  }, [profilesWithStatus, mutualIds])

  // DM conversation summaries keyed by partner id (for rail snippets + badges).
  const dmConvByPartner = useMemo(() => {
    const m = new Map<string, { conversationId: string; lastMessage: Message }>()
    for (const c of conversations) m.set(c.partnerId, { conversationId: c.conversationId, lastMessage: c.lastMessage })
    return m
  }, [conversations])

  // Group tint = averaged member colors (CollabPage's groupColorByConv).
  const groupColorByConv = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of groupConversations) {
      const colors = g.memberIds
        .map(id => profileById.get(id)?.avatar_color)
        .filter((c): c is string => !!c)
      m.set(g.conversationId, mixHexColors(colors))
    }
    return m
  }, [groupConversations, profileById])

  // ── active chat ─────────────────────────────────────────────────────
  const chatTarget: ChatTarget | null = useMemo(() => {
    if (!sel) return null
    return sel.kind === 'dm'
      ? { kind: 'dm', otherUserId: sel.userId }
      : { kind: 'group', conversationId: sel.conversationId }
  }, [sel])
  const { messages, loading: messagesLoading, send, conversationId: activeConvId } = useMessages(supabase, user.id, chatTarget)

  // Clear the unread badge for whatever is open — on open (once the DM
  // conversation resolves) and again when new messages land while open.
  useEffect(() => {
    if (activeConvId && (convUnread.get(activeConvId) ?? 0) > 0) markSeen(activeConvId)
  }, [activeConvId, convUnread, markSeen])
  useEffect(() => {
    if (activeConvId) markSeen(activeConvId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConvId])

  const selectedGroup = sel?.kind === 'group'
    ? groupConversations.find(g => g.conversationId === sel.conversationId) ?? null
    : null
  const selectedProfile = sel?.kind === 'dm'
    ? profileById.get(sel.userId) ?? null
    : null

  const headerTitle = selectedGroup?.title ?? selectedProfile?.display_name ?? ''
  const headerSub = useMemo(() => {
    if (selectedGroup) {
      const online = selectedGroup.memberIds.filter(id => id === user.id || onlineIds.has(id)).length
      return `${selectedGroup.memberIds.length} members · ${online} online`
    }
    if (selectedProfile) return selectedProfile.isOnline ? 'online' : 'offline'
    return ''
  }, [selectedGroup, selectedProfile, onlineIds, user.id])

  // Stems participants — me + the other side, same as CollabPage.
  const stemParticipants = useMemo(() => {
    const members: Profile[] = []
    if (me) members.push({ ...me, isOnline: true })
    if (selectedGroup) {
      for (const id of selectedGroup.memberIds) {
        if (id === user.id) continue
        const p = profileById.get(id)
        if (p) members.push(p)
      }
    } else if (selectedProfile) members.push(selectedProfile)
    return Array.from(new Map(members.map(m => [m.id, m])).values())
  }, [me, selectedGroup, selectedProfile, profileById, user.id])

  // ── calendar wiring (mirrors ChatView's in-chat calendar) ───────────
  const { events: allCalEvents, addEvents: calAddEvents, deleteEvent: calDeleteEvent, updateEvent: calUpdateEvent } = useCalendarEvents(supabase, user.id)
  const { categories: calCategories, ensureCategory: calEnsureCategory, renameCategory: calRenameCategory, deleteCategory: calDeleteCategory } = useEventCategories(supabase, user.id)
  const upcomingCount = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    return allCalEvents.filter(e => new Date(e.starts_at) >= today).length
  }, [allCalEvents])
  const groupTitleById = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of groupConversations) m.set(g.conversationId, g.title || 'Group')
    if (activeConvId && headerTitle && !m.has(activeConvId)) m.set(activeConvId, headerTitle)
    return m
  }, [groupConversations, activeConvId, headerTitle])
  const saveChatEvents = useCallback(async (list: NewCalendarEvent[]): Promise<CalendarEvent[]> => {
    const withMeta = await Promise.all(list.map(async e => ({
      ...e,
      category_color: await calEnsureCategory(e.category),
      conversation_id: activeConvId ?? null,
    })))
    return calAddEvents(withMeta)
  }, [calEnsureCategory, calAddEvents, activeConvId])

  // ── input bar ───────────────────────────────────────────────────────
  const [draft, setDraft] = useState('')
  const taRef = useRef<HTMLTextAreaElement>(null)
  const growTa = useCallback(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 90)}px`
  }, [])
  const handleSend = useCallback(async () => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    requestAnimationFrame(growTa)
    await send(text)
  }, [draft, send, growTa])

  // Auto-scroll chat to the newest message.
  const chatEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (tab === 'chat') chatEndRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, tab, sel])

  const openSel = useCallback((next: Sel) => {
    setSel(next)
    setTab('chat')
    const cid = next.kind === 'group'
      ? next.conversationId
      : dmConvByPartner.get(next.userId)?.conversationId
    if (cid) markSeen(cid)
  }, [dmConvByPartner, markSeen])

  const isSel = (s: Sel) => !!sel && (
    (sel.kind === 'dm' && s.kind === 'dm' && sel.userId === s.userId)
    || (sel.kind === 'group' && s.kind === 'group' && sel.conversationId === s.conversationId)
  )

  // ── slack-style message rows ────────────────────────────────────────
  const chatRows = useMemo(() => {
    const rows: ReactNode[] = []
    let prevSender: string | null = null
    let prevTime = 0
    let prevDay = ''
    for (const m of messages) {
      const t = new Date(m.created_at).getTime()
      const dk = dayKey(m.created_at)
      if (dk !== prevDay) {
        rows.push(<div key={`day-${dk}-${m.id}`} className="wd-day">{dayLabel(m.created_at)}</div>)
        prevDay = dk
        prevSender = null
      }
      if (m.sender_id !== prevSender || t - prevTime > 5 * 60 * 1000) {
        const name = m.sender_id === user.id
          ? (me?.display_name ?? 'me')
          : (profileById.get(m.sender_id)?.display_name ?? '…')
        rows.push(
          <div key={`meta-${m.id}`} className="wd-meta">
            <b>{name}</b><span>{fmtTime(m.created_at)}</span>
          </div>,
        )
      }
      prevSender = m.sender_id
      prevTime = t
      if (m.content) rows.push(<div key={`c-${m.id}`} className="wd-msg">{m.content}</div>)
      if (m.attachment_url && m.attachment_type && !m.attachment_expired) {
        const { attachment_url: url, attachment_type: type } = m
        const name = m.attachment_name ?? 'file'
        if (type === 'audio') {
          rows.push(
            <div key={`a-${m.id}`} className="wd-att-audio">
              <AudioAttachment url={url} name={name} metadata={m.attachment_metadata ?? undefined} />
            </div>,
          )
        } else if (type === 'multi-audio') {
          let tracks: { url: string; name: string }[] = []
          try { tracks = JSON.parse(url) } catch { /* fall through to card */ }
          if (tracks.length > 0) {
            rows.push(
              <div key={`a-${m.id}`} className="wd-att-audio">
                {tracks.map(tr => <AudioAttachment key={tr.url} url={tr.url} name={tr.name} />)}
              </div>,
            )
          } else {
            rows.push(<div key={`a-${m.id}`} className="wd-file"><i>♪</i><span>{name}</span></div>)
          }
        } else if (type === 'image') {
          rows.push(
            <img key={`a-${m.id}`} className="wd-img" src={url} alt={name}
              onClick={() => window.open(url, '_blank')} />,
          )
        } else if (type === 'game_invite') {
          rows.push(<div key={`a-${m.id}`} className="wd-file"><i>◳</i><span>game invite</span><small>{name}</small></div>)
        } else {
          rows.push(<div key={`a-${m.id}`} className="wd-file"><i>▤</i><span>{name}</span></div>)
        }
      }
    }
    return rows
  }, [messages, user.id, me, profileById])

  const myName = me?.display_name ?? user.email?.split('@')[0] ?? 'me'

  return (
    <div className="wd-stage">
      <div className="wd">

        {/* ── rail ─────────────────────────────────────────────── */}
        <div className="wd-rail">
          <div className="wd-brand"><i />orb studio</div>
          <div className="wd-rail-scroll">
            <div className="wd-sec">projects</div>
            {groupConversations.map(g => {
              const s: Sel = { kind: 'group', conversationId: g.conversationId }
              const unread = convUnread.get(g.conversationId) ?? 0
              const last = convLastMessages.get(g.conversationId) ?? g.lastMessage
              const senderName = last && last.sender_id !== user.id
                ? profileById.get(last.sender_id)?.display_name
                : (last ? myName : undefined)
              return (
                <div key={g.conversationId} className={`wd-row${isSel(s) ? ' on' : ''}`} onClick={() => openSel(s)}>
                  <Avatar group color={groupColorByConv.get(g.conversationId) ?? '#4A8FE7'} label={(g.title || 'G').slice(0, 1)} />
                  <span className="wd-rname">
                    <b>{g.title || 'Unnamed group'}</b>
                    <span>{last ? snippet(last, senderName) : `${g.memberIds.length} members`}</span>
                  </span>
                  {unread > 0 && <span className="wd-badge">{unread}</span>}
                </div>
              )
            })}
            {groupConversations.length === 0 && (
              <div className="wd-row" style={{ cursor: 'default' }}>
                <span className="wd-rname"><span>no projects yet</span></span>
              </div>
            )}
            <div className="wd-sec">people</div>
            {friendProfiles.map(p => {
              const s: Sel = { kind: 'dm', userId: p.id }
              const conv = dmConvByPartner.get(p.id)
              const unread = conv ? (convUnread.get(conv.conversationId) ?? 0) : 0
              const last = conv ? (convLastMessages.get(conv.conversationId) ?? conv.lastMessage) : null
              return (
                <div key={p.id} className={`wd-row${isSel(s) ? ' on' : ''}`} onClick={() => openSel(s)}>
                  <Avatar color={p.avatar_color} label={p.initials.slice(0, 1)} avatarUrl={p.avatar_url}
                    dot={p.isOnline ? 'on' : undefined} />
                  <span className="wd-rname">
                    <b>{p.display_name}</b>
                    <span>{last ? snippet(last, last.sender_id === user.id ? 'you' : undefined) : (p.isOnline ? 'online' : 'offline')}</span>
                  </span>
                  {unread > 0 && <span className="wd-badge">{unread}</span>}
                </div>
              )
            })}
            {friendProfiles.length === 0 && !profilesLoading && (
              <div className="wd-row" style={{ cursor: 'default' }}>
                <span className="wd-rname"><span>follow someone to start</span></span>
              </div>
            )}
          </div>
          <div className="wd-rail-foot">
            <Avatar color={me?.avatar_color ?? '#1A1917'} label={(me?.initials ?? myName).slice(0, 1)}
              avatarUrl={me?.avatar_url} dot="studio" />
            <span>{myName} · in the studio</span>
          </div>
        </div>

        {/* ── main ─────────────────────────────────────────────── */}
        <div className="wd-main">
          {sel ? (
            <>
              <div className="wd-head">
                <div className="wd-title">{headerTitle}</div>
                <div className="wd-sub">{headerSub}</div>
                <div className="wd-tabs">
                  <span className={`wd-tab${tab === 'chat' ? ' on' : ''}`} onClick={() => setTab('chat')}>chat</span>
                  <span className={`wd-tab${tab === 'stems' ? ' on' : ''}`} onClick={() => activeConvId && setTab('stems')}>stems</span>
                  <span className={`wd-tab${tab === 'calendar' ? ' on' : ''}`} onClick={() => activeConvId && setTab('calendar')}>
                    calendar{upcomingCount > 0 && <i>{upcomingCount}</i>}
                  </span>
                  <span className="wd-tab off" title="coming soon">notes<i>soon</i></span>
                </div>
              </div>

              {tab === 'chat' && (
                <>
                  <div className="wd-chat">
                    {messagesLoading
                      ? <div className="wd-quiet">…</div>
                      : chatRows.length > 0
                        ? <>{chatRows}<div ref={chatEndRef} /></>
                        : <div className="wd-quiet">no messages yet — say hi</div>}
                  </div>
                  <div className="wd-input">
                    <textarea
                      ref={taRef}
                      rows={1}
                      value={draft}
                      placeholder={`message ${headerTitle}…`}
                      onChange={e => { setDraft(e.target.value); growTa() }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                          e.preventDefault()
                          void handleSend()
                        }
                      }}
                    />
                    <button className="wd-send" disabled={!draft.trim()} onClick={() => void handleSend()}>→</button>
                  </div>
                </>
              )}

              {tab === 'stems' && (
                <div className="wd-pane">
                  {activeConvId ? (
                    <StemPanel
                      supabase={supabase}
                      conversationId={activeConvId}
                      currentUserId={user.id}
                      participants={stemParticipants}
                      pendingDrop={null}
                      onDropConsumed={() => {}}
                    />
                  ) : <div className="wd-quiet">loading…</div>}
                </div>
              )}

              {tab === 'calendar' && (
                <div className="wd-pane">
                  {activeConvId ? (
                    <ChatCalendar
                      currentUserId={user.id}
                      events={allCalEvents}
                      categories={calCategories}
                      groupTitleById={groupTitleById}
                      onDelete={(id) => { calDeleteEvent(id).catch(() => {}) }}
                      onSetCategory={async (id, name) => {
                        const color = await calEnsureCategory(name)
                        calUpdateEvent(id, { category: name || null, category_color: color }).catch(() => {})
                      }}
                      onUpdate={(id, patch) => { calUpdateEvent(id, patch).catch(() => {}) }}
                      onAddCategory={(name) => { calEnsureCategory(name).catch(() => {}) }}
                      onRenameCategory={(id, name) => { calRenameCategory(id, name).catch(() => {}) }}
                      onDeleteCategory={(id) => { calDeleteCategory(id).catch(() => {}) }}
                      onSubmitPrompt={async (text) => {
                        const parsed = await parseSchedule(supabase, text)
                        return saveChatEvents(parsed)
                      }}
                    />
                  ) : <div className="wd-quiet">loading…</div>}
                </div>
              )}
            </>
          ) : (
            <div className="wd-quiet">select a project or a person to begin</div>
          )}
        </div>
      </div>
    </div>
  )
}
