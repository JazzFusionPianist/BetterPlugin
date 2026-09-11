/**
 * greenroom — the workspace surface for the Orb Chat plugin build
 * (?surface=chat). Layout and print styling replicate the approved
 * WorkspaceDemo mockup (.wd-* classes, see studio.css): a project-first
 * rail on the left, a tabbed main pane (chat · stems · calendar · notes)
 * on the right.
 *
 * Data wiring reuses CollabPage's exact hook patterns:
 *   rail projects  → useConversations().groupConversations
 *   rail people    → useProfiles + useFollows mutualIds (+ usePresence)
 *   unread badges  → useConversationNotifications
 *   chat           → useMessages (dm / group ChatTarget, same shape)
 *   read receipts  → useConversationReads (ChatView's iMessage anchoring)
 *   uploads        → ChatView's presign → XHR PUT flow, verbatim
 *   stems tab      → StemPanel (existing component, collab.css styles)
 *   calendar tab   → ChatCalendar, events filtered to this conversation
 *   notes tab      → conversation_notes (document list per room, realtime)
 *   presence       → 'studio-presence' realtime channel (client-only)
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { useProfiles } from '../hooks/useProfiles'
import { usePresence } from '../hooks/usePresence'
import { useFollows } from '../hooks/useFollows'
import { useConversations } from '../hooks/useConversations'
import { useConversationNotifications } from '../hooks/useConversationNotifications'
import { useConversationReads } from '../hooks/useConversationReads'
import { useMessages } from '../hooks/useMessages'
import { useCalendarEvents, type NewCalendarEvent, type CalendarEvent } from '../hooks/useCalendarEvents'
import { useEventCategories } from '../hooks/useEventCategories'
import { parseSchedule } from '../lib/parseSchedule'
import { linkify, firstUrl, openExternalUrl } from '../lib/linkify'
import StemPanel from '../components/collab/StemPanel'
import ChatCalendar from '../components/collab/ChatCalendar'
import SchedulePrompt from '../components/collab/SchedulePrompt'
import LinkPreviewCard from '../components/collab/LinkPreviewCard'
import { AudioAttachment, ScheduleChip, looksLikeSchedule } from '../components/collab/ChatView'
import { LanguageProvider } from '../i18n/LanguageContext'
import type { ChatTarget, Message, Profile } from '../types/collab'
import './studio.css'

interface Props { supabase: SupabaseClient; user: User }

type Sel =
  | { kind: 'dm'; userId: string }
  | { kind: 'group'; conversationId: string }
  | { kind: 'me' }

type Tab = 'chat' | 'stems' | 'calendar' | 'notes'

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

/** Same-sender messages closer than this form one bubble burst. */
const BURST_MS = 4 * 60 * 1000

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
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toLowerCase()
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

/** " · 2h" elapsed-in-the-studio suffix; empty under a minute. */
function studioFor(since: number, now: number): string {
  const min = Math.floor((now - since) / 60000)
  if (min < 1) return ''
  if (min < 60) return ` · ${min}m`
  return ` · ${Math.floor(min / 60)}h`
}

/** "in the studio" presence — a client-only realtime presence channel.
 *  Everyone with the plugin open joins; the map is user_id → joined-at ms
 *  (earliest, if they hold several connections). */
function useStudioPresence(supabase: SupabaseClient, userId: string): Map<string, number> {
  const [present, setPresent] = useState<Map<string, number>>(new Map())
  useEffect(() => {
    const ch = supabase.channel('studio-presence')
    ch
      .on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState<{ user_id: string; at: number }>()
        const next = new Map<string, number>()
        for (const metas of Object.values(state)) {
          for (const m of metas) {
            if (!m.user_id) continue
            const prev = next.get(m.user_id)
            if (prev === undefined || m.at < prev) next.set(m.user_id, m.at)
          }
        }
        setPresent(next)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await ch.track({ user_id: userId, at: Date.now() })
      })
    return () => { supabase.removeChannel(ch) }
  }, [supabase, userId])
  return present
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

/** The greenroom mark — a small room (rounded-square outline, hairline
 *  ink) with the green presence dot inside. Quiet on purpose. */
function BrandMark() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <rect x="0.75" y="0.75" width="10.5" height="10.5" rx="3.2" stroke="#1A1917" strokeWidth="1" />
      <circle cx="6" cy="6" r="2" fill="var(--acc)" />
    </svg>
  )
}

/** Programme-margin upcoming list — date column · time · title, hairline
 *  separators, today in the accent. Shared by the home pane and the
 *  "my calendar" view (mirrors the web app's UpcomingList split). */
function UpcomingRows({ events, groupTitleById, limit, nowTick }: {
  events: CalendarEvent[]; groupTitleById: Map<string, string>; limit: number; nowTick: number
}) {
  const rows = useMemo(() => {
    const now = new Date(nowTick)
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return events
      .filter(e => new Date(e.starts_at) >= (e.all_day ? dayStart : now))
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .slice(0, limit)
  }, [events, limit, nowTick])

  if (rows.length === 0) {
    return <div className="wd-up"><div className="wd-up-head">upcoming</div>
      <div className="wd-up-none">nothing scheduled — enjoy the quiet</div></div>
  }

  const now = new Date(nowTick)
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const label = (iso: string): { text: string; today: boolean } => {
    const d = new Date(iso)
    const days = Math.floor(
      (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - dayStart.getTime()) / 86400000)
    if (days <= 0) return { text: 'today', today: true }
    if (days === 1) return { text: 'tomorrow', today: false }
    if (days < 7) return { text: d.toLocaleDateString('en-GB', { weekday: 'short' }).toLowerCase(), today: false }
    return { text: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toLowerCase(), today: false }
  }

  return (
    <div className="wd-up">
      <div className="wd-up-head">upcoming</div>
      {rows.map(e => {
        const l = label(e.starts_at)
        return (
          <div key={e.id} className="wd-up-row">
            <span className={`wd-up-date${l.today ? ' today' : ''}`}>{l.text}</span>
            <span className="wd-up-time">{e.all_day ? 'all day' : fmtTime(e.starts_at)}</span>
            <span className="wd-up-title">{e.title}</span>
            {e.conversation_id && (
              <span className="wd-up-from">{groupTitleById.get(e.conversation_id) ?? ''}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** ── notes — one document per show ──────────────────────────────────
 *  A band's room accumulates a note per show/broadcast/flight sheet
 *  (일정 · 타임테이블 · 셋리스트 · 예약번호), each opened and edited on
 *  its own. conversation_notes is the v2 document table (uuid rows). */

interface NoteRow {
  id: string
  conversation_id: string
  title: string
  content: string
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

/** "just now" → "4m ago" → "2h ago" → "yesterday" → "12 aug". */
function relTime(iso: string, now: number): string {
  const min = Math.floor((now - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  if (min < 24 * 60) return `${Math.floor(min / 60)}h ago`
  const d = new Date(iso)
  const dayStart = (t: Date) => new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()
  const days = Math.floor((dayStart(new Date(now)) - dayStart(d)) / 86400000)
  if (days <= 1) return 'yesterday'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toLowerCase()
}

/** Note documents for the open conversation — list + realtime refresh.
 *  Lives at the shell level so the notes tab can badge its count the
 *  way calendar does. Any INSERT/UPDATE/DELETE on this conversation's
 *  rows re-pulls the ordered list. */
function useConversationNotes(supabase: SupabaseClient, conversationId: string | null) {
  const [notes, setNotes] = useState<NoteRow[]>([])
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    if (!conversationId) return
    const { data, error } = await supabase
      .from('conversation_notes')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('updated_at', { ascending: false })
    if (error) { console.error('[StudioNotes] load failed', error); setLoaded(true); return }
    setNotes((data ?? []) as NoteRow[])
    setLoaded(true)
  }, [supabase, conversationId])

  useEffect(() => {
    setNotes([]); setLoaded(false)
    if (!conversationId) return
    void refresh()
    const ch = supabase
      .channel(`studio-notes:${conversationId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_notes',
          filter: `conversation_id=eq.${conversationId}` },
        () => { void refresh() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [supabase, conversationId, refresh])

  return { notes, loaded, refresh }
}

/** The notes tab — a document list (default) and a per-note editor. */
function StudioNotes({ supabase, conversationId, userId, nameOf, notes, loaded, refresh, nowTick }: {
  supabase: SupabaseClient; conversationId: string; userId: string
  nameOf: (id: string | null) => string
  notes: NoteRow[]; loaded: boolean; refresh: () => Promise<void>; nowTick: number
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [focusNew, setFocusNew] = useState(false)
  const creatingRef = useRef(false)

  // Conversation switched under the tab — back to that room's list.
  useEffect(() => { setOpenId(null); setFocusNew(false) }, [conversationId])

  const openNote = openId ? notes.find(n => n.id === openId) ?? null : null

  // The open note deleted elsewhere (another member, another device) —
  // fall back to the list quietly.
  useEffect(() => {
    if (openId && loaded && !notes.some(n => n.id === openId)) {
      setOpenId(null); setFocusNew(false)
    }
  }, [openId, loaded, notes])

  const createNote = useCallback(async () => {
    if (creatingRef.current) return
    creatingRef.current = true
    const { data, error } = await supabase
      .from('conversation_notes')
      .insert({ conversation_id: conversationId, created_by: userId, updated_by: userId })
      .select()
      .single()
    creatingRef.current = false
    if (error || !data) { console.error('[StudioNotes] create failed', error); return }
    await refresh()
    setFocusNew(true)
    setOpenId((data as NoteRow).id)
  }, [supabase, conversationId, userId, refresh])

  const deleteNote = useCallback(async (id: string) => {
    const { error } = await supabase.from('conversation_notes').delete().eq('id', id)
    if (error) { console.error('[StudioNotes] delete failed', error); return }
    setOpenId(null); setFocusNew(false)
    void refresh()
  }, [supabase, refresh])

  if (openNote) {
    return (
      <NoteEditor
        key={openNote.id}
        supabase={supabase}
        note={openNote}
        userId={userId}
        nameOf={nameOf}
        nowTick={nowTick}
        autoFocusTitle={focusNew}
        onBack={() => { setOpenId(null); setFocusNew(false) }}
        onDelete={() => { void deleteNote(openNote.id) }}
      />
    )
  }

  return (
    <div className="wd-notes">
      <div className="wd-notes-bar">
        <button className="wd-notes-new" onClick={() => void createNote()}>+ new note</button>
      </div>
      <div className="wd-notes-list">
        {!loaded
          ? <div className="wd-quiet">…</div>
          : notes.length === 0
            ? <div className="wd-quiet">no notes yet — keep setlists, schedules, anything the band needs</div>
            : notes.map(n => {
              const title = n.title.trim()
              const snip = n.content.replace(/\s+/g, ' ').trim()
              return (
                <div key={n.id} className="wd-note-row" onClick={() => { setFocusNew(false); setOpenId(n.id) }}>
                  <div className={`wd-note-title${title ? '' : ' untitled'}`}>{title || 'untitled'}</div>
                  {snip && <div className="wd-note-snip">{snip}</div>}
                  <div className="wd-note-meta">
                    {`edited by ${n.updated_by ? nameOf(n.updated_by) : '—'} · ${relTime(n.updated_at, nowTick)}`}
                  </div>
                </div>
              )
            })}
      </div>
    </div>
  )
}

/** One note opened — borderless serif title + quiet paper body, both
 *  autosaved (800ms debounce). Remote realtime edits arrive as new
 *  `note` props and are adopted ONLY while the local editor is clean —
 *  mid-typing or mid-save, local text wins (v1's typing guard). */
function NoteEditor({ supabase, note, userId, nameOf, nowTick, autoFocusTitle, onBack, onDelete }: {
  supabase: SupabaseClient; note: NoteRow; userId: string
  nameOf: (id: string | null) => string; nowTick: number
  autoFocusTitle: boolean; onBack: () => void; onDelete: () => void
}) {
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [delSure, setDelSure] = useState(false)

  const titleRef = useRef(note.title)
  const contentRef = useRef(note.content)
  const dirtyRef = useRef(false)
  const inFlightRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  // A fresh note opens with the title ready to type.
  useEffect(() => {
    if (autoFocusTitle) titleInputRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const persist = useCallback(async () => {
    const snapTitle = titleRef.current
    const snapContent = contentRef.current
    inFlightRef.current = true
    const { error } = await supabase
      .from('conversation_notes')
      .update({
        title: snapTitle,
        content: snapContent,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', note.id)
    inFlightRef.current = false
    if (error) { console.error('[StudioNotes] save failed', error); return }
    // Still dirty only if more typing landed while the save flew.
    if (titleRef.current === snapTitle && contentRef.current === snapContent) dirtyRef.current = false
    setSavedAt(Date.now())
  }, [supabase, note.id, userId])

  const queueSave = useCallback(() => {
    dirtyRef.current = true
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => { void persist() }, 800)
  }, [persist])

  // Closing the editor (back, tab switch, unmount) flushes a pending edit.
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (dirtyRef.current) void persist()
  }, [persist])

  // Remote realtime edits arrive as new note props — adopt them only
  // while the local editor is clean, protecting in-flight typing.
  useEffect(() => {
    if (dirtyRef.current || inFlightRef.current) return
    setTitle(note.title); titleRef.current = note.title
    setContent(note.content); contentRef.current = note.content
  }, [note.title, note.content, note.updated_at])

  const fine = savedAt !== null && note.updated_by === userId
    ? `saved · ${relTime(new Date(savedAt).toISOString(), Math.max(nowTick, savedAt))}`
    : `edited by ${note.updated_by ? nameOf(note.updated_by) : '—'} · ${relTime(note.updated_at, nowTick)}`

  return (
    <div className="wd-note-ed">
      <div className="wd-note-ed-head">
        <button className="wd-note-back" onClick={onBack} aria-label="back to notes">‹</button>
        <input
          ref={titleInputRef}
          className="wd-note-ed-title"
          value={title}
          placeholder="title…"
          spellCheck={false}
          onChange={e => { setTitle(e.target.value); titleRef.current = e.target.value; queueSave() }}
        />
        <span className="wd-note-ed-fine">{fine}</span>
      </div>
      <textarea
        className="wd-note-ed-body"
        value={content}
        placeholder="setlists, timetables, flight numbers — anything worth keeping"
        spellCheck={false}
        onChange={e => { setContent(e.target.value); contentRef.current = e.target.value; queueSave() }}
      />
      <div className="wd-note-ed-foot">
        <button
          className={`wd-note-del${delSure ? ' sure' : ''}`}
          onClick={() => {
            if (!delSure) { setDelSure(true); return }
            // A dying row shouldn't get a farewell autosave.
            if (timerRef.current) clearTimeout(timerRef.current)
            dirtyRef.current = false
            onDelete()
          }}
        >
          {delSure ? 'sure?' : 'delete note'}
        </button>
      </div>
    </div>
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

  // Minute tick — re-splits the upcoming lists and advances the
  // "in the studio · 2h" elapsed labels while the plugin sits open.
  const [nowTick, setNowTick] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  const { profiles, me, loading: profilesLoading, refetch: refetchProfiles } = useProfiles(supabase, user.id)
  const onlineIds = usePresence(supabase, user.id)
  const studioAt = useStudioPresence(supabase, user.id)
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
    if (!sel || sel.kind === 'me') return null
    return sel.kind === 'dm'
      ? { kind: 'dm', otherUserId: sel.userId }
      : { kind: 'group', conversationId: sel.conversationId }
  }, [sel])
  const { messages, loading: messagesLoading, send, conversationId: activeConvId } = useMessages(supabase, user.id, chatTarget)
  const reads = useConversationReads(supabase, activeConvId ?? null, user.id)

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
      const n = selectedGroup.memberIds.length
      const inStudio = selectedGroup.memberIds.filter(id => studioAt.has(id)).length
      if (inStudio > 0) return `${n} members · ${inStudio} in the studio now`
      const online = selectedGroup.memberIds.filter(id => id === user.id || onlineIds.has(id)).length
      return `${n} members · ${online} online`
    }
    if (selectedProfile) {
      if (studioAt.has(selectedProfile.id)) return 'in the studio'
      return selectedProfile.isOnline ? 'online' : 'offline'
    }
    return ''
  }, [selectedGroup, selectedProfile, studioAt, onlineIds, user.id])

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

  // ── calendar wiring ─────────────────────────────────────────────────
  const { events: allCalEvents, addEvents: calAddEvents, deleteEvent: calDeleteEvent, updateEvent: calUpdateEvent } = useCalendarEvents(supabase, user.id)
  const { categories: calCategories, ensureCategory: calEnsureCategory, renameCategory: calRenameCategory, deleteCategory: calDeleteCategory } = useEventCategories(supabase, user.id)

  // The calendar TAB shows only this conversation's events; MY schedule
  // (everything RLS lets me see) lives on the home pane + "my calendar".
  const convCalEvents = useMemo(
    () => allCalEvents.filter(e => e.conversation_id != null && e.conversation_id === activeConvId),
    [allCalEvents, activeConvId],
  )
  const convUpcomingCount = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    return convCalEvents.filter(e => new Date(e.starts_at) >= today).length
  }, [convCalEvents])

  // ── notes wiring — list lives up here so the tab can badge count ────
  const { notes, loaded: notesLoaded, refresh: refreshNotes } = useConversationNotes(supabase, activeConvId ?? null)

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

  // Unscoped prompt for the "my calendar" view — personal events only.
  const saveMyEvents = useCallback(async (text: string): Promise<CalendarEvent[]> => {
    const parsed = await parseSchedule(supabase, text)
    const withMeta = await Promise.all(parsed.map(async e => ({
      ...e,
      category_color: await calEnsureCategory(e.category),
      conversation_id: null,
    })))
    return calAddEvents(withMeta)
  }, [supabase, calEnsureCategory, calAddEvents])

  // ── input bar + uploads ─────────────────────────────────────────────
  const [draft, setDraft] = useState('')
  const taRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploads, setUploads] = useState<{ id: string; name: string; progress: number }[]>([])

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

  // ChatView's R2 upload flow: presign → XHR PUT (for onprogress) → send.
  const MAX_SIZE = 1000 * 1024 * 1024
  const uploadFile = useCallback(async (file: File, type: 'audio' | 'image'):
    Promise<{ url: string; type: 'audio' | 'image'; name: string } | null> => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const contentType = file.type || 'application/octet-stream'
    const pid = `up-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setUploads(prev => [...prev, { id: pid, name: file.name, progress: 0 }])
    const drop = () => setUploads(prev => prev.filter(u => u.id !== pid))
    try {
      const presignRes = await fetch('/api/r2-upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // scope temp = 7-day expiring key; chat attachments only
        body: JSON.stringify({ ext, contentType, userId: user.id, scope: 'temp' }),
      })
      if (!presignRes.ok) {
        console.error('[studio upload] presign failed:', presignRes.status, await presignRes.text())
        drop(); return null
      }
      const { uploadUrl, publicUrl } = await presignRes.json() as { uploadUrl: string; publicUrl: string }
      const ok = await new Promise<boolean>((resolve) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', contentType)
        let lastUpdate = 0   // throttle to ~10fps for older WebKits
        xhr.upload.onprogress = e => {
          if (!e.lengthComputable) return
          const now = performance.now()
          if (now - lastUpdate < 100 && e.loaded < e.total) return
          lastUpdate = now
          const progress = Math.min(0.99, e.loaded / e.total)
          setUploads(prev => prev.map(u => u.id === pid ? { ...u, progress } : u))
        }
        xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300)
        xhr.onerror = () => { console.error('[studio upload] R2 PUT network error'); resolve(false) }
        xhr.send(file)
      })
      drop()
      return ok ? { url: publicUrl, type, name: file.name } : null
    } catch (e) {
      console.error('[studio upload] error:', e)
      drop(); return null
    }
  }, [user.id])

  const onFilesPicked = useCallback(async (list: FileList | null) => {
    if (!list || list.length === 0) return
    const AUDIO_EXTS = new Set(['mp3', 'wav', 'aif', 'aiff', 'm4a', 'ogg', 'flac', 'caf', 'opus', 'aac'])
    const typed = Array.from(list)
      .map(f => {
        const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
        const type = f.type.startsWith('image/') ? 'image' as const
          : (f.type.startsWith('audio/') || AUDIO_EXTS.has(ext)) ? 'audio' as const
          : null
        return { f, type }
      })
      .filter((x): x is { f: File; type: 'audio' | 'image' } => x.type !== null && x.f.size <= MAX_SIZE)
    if (typed.length === 0) return

    // Several audio files at once → one multi-track message (ChatView parity).
    const audios = typed.filter(t => t.type === 'audio')
    if (audios.length > 1 && audios.length === typed.length) {
      const uploaded: { url: string; name: string }[] = []
      for (const t of audios) {
        const a = await uploadFile(t.f, 'audio')
        if (a) uploaded.push({ url: a.url, name: a.name })
      }
      if (uploaded.length === 1) await send('', { url: uploaded[0].url, type: 'audio', name: uploaded[0].name })
      else if (uploaded.length > 1) await send('', { url: JSON.stringify(uploaded), type: 'multi-audio', name: `${uploaded.length} Tracks` })
      return
    }
    for (const t of typed) {
      const a = await uploadFile(t.f, t.type)
      if (a) await send('', a)
    }
  }, [uploadFile, send, MAX_SIZE])

  // Chat scroll — jump to the bottom whenever a conversation (re)opens;
  // after that, new messages re-pin the view only while the reader is
  // already near the bottom (<120px). Scrolled up = reading history —
  // leave them exactly where they are.
  const NEAR_BOTTOM_PX = 120
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef(true)          // near-bottom as of the last scroll event
  const chatKeyRef = useRef('')          // which conversation the pane last showed
  useEffect(() => {
    const el = chatScrollRef.current
    if (tab !== 'chat' || !el) { chatKeyRef.current = ''; return }
    const key = JSON.stringify(sel)
    const opened = chatKeyRef.current !== key
    chatKeyRef.current = key
    if (opened || stickRef.current) {
      el.scrollTop = el.scrollHeight
      stickRef.current = true
    }
  }, [messages, messagesLoading, tab, sel])
  // Track the reader's position, and keep the view pinned while
  // late-loading content (images, link-preview cards) grows the list —
  // but only when they were already at the bottom.
  useEffect(() => {
    const el = chatScrollRef.current
    if (tab !== 'chat' || !el) return
    const onScroll = () => {
      stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(() => {
      if (stickRef.current) el.scrollTop = el.scrollHeight
    })
    ro.observe(el)
    for (const child of Array.from(el.children)) ro.observe(child)
    return () => { el.removeEventListener('scroll', onScroll); ro.disconnect() }
  }, [messages, messagesLoading, tab, sel])

  const openSel = useCallback((next: Sel) => {
    setSel(next)
    setTab('chat')
    if (next.kind === 'me') return
    const cid = next.kind === 'group'
      ? next.conversationId
      : dmConvByPartner.get(next.userId)?.conversationId
    if (cid) markSeen(cid)
  }, [dmConvByPartner, markSeen])

  const isSel = (s: Sel) => !!sel && (
    (sel.kind === 'dm' && s.kind === 'dm' && sel.userId === s.userId)
    || (sel.kind === 'group' && s.kind === 'group' && sel.conversationId === s.conversationId)
    || (sel.kind === 'me' && s.kind === 'me')
  )

  // Read receipts, iMessage-style (ported from ChatView): each reader is
  // anchored to the LATEST of my messages their last_seen_at covers.
  const readersByMsgId = useMemo(() => {
    const map = new Map<string, Profile[]>()
    if (reads.size === 0) return map
    const candidates: Profile[] = selectedGroup
      ? selectedGroup.memberIds
          .filter(id => id !== user.id)
          .map(id => profileById.get(id))
          .filter((p): p is Profile & { isOnline: boolean } => !!p)
      : selectedProfile ? [selectedProfile] : []
    const mine = messages.filter(m => m.sender_id === user.id)
    for (const reader of candidates) {
      const readerTs = reads.get(reader.id) ?? 0
      if (readerTs <= 0) continue
      let lastReadId: string | null = null
      for (const m of mine) {
        if (new Date(m.created_at).getTime() <= readerTs) lastReadId = m.id
        else break
      }
      if (lastReadId) {
        const arr = map.get(lastReadId) ?? []
        arr.push(reader)
        map.set(lastReadId, arr)
      }
    }
    return map
  }, [reads, messages, selectedGroup, selectedProfile, profileById, user.id])

  // ── messenger rows (kakao/imessage grammar) ─────────────────────────
  // Calendar-chip verdicts survive reloads (ChatView parity) — a message
  // already saved (or waved off) doesn't re-offer its chip forever.
  const [chipDone, setChipDone] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('orb_cal_chip_done') ?? '[]') as string[]) }
    catch { return new Set() }
  })
  const markChipDone = useCallback((msgId: string) => {
    setChipDone(prev => {
      const next = new Set(prev)
      next.add(msgId)
      try { localStorage.setItem('orb_cal_chip_done', JSON.stringify([...next].slice(-200))) } catch { /* full/blocked */ }
      return next
    })
  }, [])

  const chatRows = useMemo(() => {
    const rows: ReactNode[] = []
    const isGroup = !!selectedGroup
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i]!
      const prev = i > 0 ? messages[i - 1]! : null
      const next = i < messages.length - 1 ? messages[i + 1]! : null
      const t = new Date(m.created_at).getTime()
      const dk = dayKey(m.created_at)
      const newDay = !prev || dayKey(prev.created_at) !== dk
      // Burst = consecutive same-sender messages under 4 minutes apart.
      const first = newDay || prev!.sender_id !== m.sender_id
        || t - new Date(prev!.created_at).getTime() > BURST_MS
      const lastInBurst = !next || dayKey(next.created_at) !== dk
        || next.sender_id !== m.sender_id
        || new Date(next.created_at).getTime() - t > BURST_MS
      const isMine = m.sender_id === user.id
      const senderP = isMine ? undefined : profileById.get(m.sender_id)

      if (newDay) {
        rows.push(<div key={`day-${dk}`} className="wd-day">{dayLabel(m.created_at)}</div>)
      }

      // Bubble-like pieces, attachment first then text (ChatView's paint
      // order). The tail notch sits on the burst's first piece; the
      // outside timestamp rides the burst's last piece.
      const pieces: ReactNode[] = []
      const tailCls = () => (first && pieces.length === 0 ? ' tail' : '')
      if (m.attachment_type === 'game_invite') {
        pieces.push(
          <div key="att" className="wd-file">
            <i>◳</i><span>game invite</span><small>{m.attachment_name ?? ''}</small>
          </div>,
        )
      } else if (m.attachment_type) {
        if (m.attachment_expired) {
          pieces.push(<div key="att" className="wd-expired">file expired (7 days)</div>)
        } else if (m.attachment_url) {
          const url = m.attachment_url
          const name = m.attachment_name ?? 'file'
          if (m.attachment_type === 'image') {
            pieces.push(
              <img key="att" className={`wd-img${tailCls()}`} src={url} alt={name}
                onClick={() => { void openExternalUrl(url) }} />,
            )
          } else if (m.attachment_type === 'video') {
            pieces.push(
              <video key="att" className={`wd-vid${tailCls()}`} src={url} controls preload="metadata" />,
            )
          } else if (m.attachment_type === 'audio') {
            pieces.push(
              <div key="att" className="wd-att-audio">
                <AudioAttachment url={url} name={name} metadata={m.attachment_metadata ?? undefined} />
              </div>,
            )
          } else if (m.attachment_type === 'multi-audio') {
            let tracks: { url: string; name: string }[] = []
            try { tracks = JSON.parse(url) } catch { /* fall through to chip */ }
            pieces.push(tracks.length > 0
              ? (
                <div key="att" className="wd-att-audio">
                  {tracks.map(tr => <AudioAttachment key={tr.url} url={tr.url} name={tr.name} />)}
                </div>
              )
              : <div key="att" className="wd-file"><i>♪</i><span>{name}</span></div>)
          } else {
            pieces.push(<div key="att" className="wd-file"><i>▤</i><span>{name}</span></div>)
          }
        }
      }
      if (m.content) {
        pieces.push(
          <div key="txt" className={`wd-bub${tailCls()}`}>{linkify(m.content)}</div>,
        )
      }
      if (pieces.length === 0) continue

      const previewUrl = m.content ? firstUrl(m.content) : null
      const readers = isMine ? readersByMsgId.get(m.id) : undefined
      const time = fmtTime(m.created_at)

      rows.push(
        <div key={m.id} className={`wd-mrow${isMine ? ' mine' : ' theirs'}${first ? ' first' : ''}`}>
          {!isMine && (
            <div className="wd-mav">
              {first && (
                <span style={{ background: senderP?.avatar_color ?? '#C0BCB3' }}>
                  {senderP?.avatar_url
                    ? <img src={senderP.avatar_url} alt="" />
                    : (senderP?.initials ?? '·').slice(0, 1)}
                </span>
              )}
            </div>
          )}
          <div className="wd-mcol">
            {!isMine && first && isGroup && (
              <div className="wd-mname">{senderP?.display_name ?? '…'}</div>
            )}
            {pieces.map((p, idx) => {
              const withTime = lastInBurst && idx === pieces.length - 1
              return (
                <div key={idx} className="wd-mline">
                  {isMine && withTime && <span className="wd-mtime">{time}</span>}
                  {p}
                  {!isMine && withTime && <span className="wd-mtime">{time}</span>}
                </div>
              )
            })}
            {previewUrl && <div className="wd-linkcard"><LinkPreviewCard url={previewUrl} /></div>}
            {m.content && activeConvId && !chipDone.has(m.id) && looksLikeSchedule(m.content) && (
              <div className="wd-chip">
                <ScheduleChip
                  text={m.content}
                  onParse={(text) => parseSchedule(supabase, text)}
                  onSave={async evs => { await saveChatEvents(evs) }}
                  onDone={() => markChipDone(m.id)}
                />
              </div>
            )}
            {readers && readers.length > 0 && (
              <div className="wd-read">
                {isGroup ? (
                  <span className="wd-read-avs">
                    {readers.slice(0, 4).map(r => (
                      <span key={r.id} style={{ background: r.avatar_color }}>
                        {r.avatar_url ? <img src={r.avatar_url} alt="" /> : r.initials.slice(0, 1)}
                      </span>
                    ))}
                  </span>
                ) : (
                  <>
                    <span>read</span>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12.5l5 5L20 6.5" />
                    </svg>
                  </>
                )}
              </div>
            )}
          </div>
        </div>,
      )
    }
    return rows
  }, [messages, user.id, profileById, readersByMsgId, selectedGroup, chipDone,
    activeConvId, supabase, saveChatEvents, markChipDone])

  const myName = me?.display_name ?? user.email?.split('@')[0] ?? 'me'
  const nameOf = useCallback((id: string | null): string => {
    if (!id) return '—'
    if (id === user.id) return myName
    return profileById.get(id)?.display_name ?? '—'
  }, [user.id, myName, profileById])

  const greeting = useMemo(() => {
    const h = new Date(nowTick).getHours()
    return h < 5 ? 'working late' : h < 12 ? 'good morning' : h < 18 ? 'good afternoon' : 'good evening'
  }, [nowTick])

  return (
    <div className="wd-stage">
      <div className="wd">

        {/* ── rail ─────────────────────────────────────────────── */}
        <div className="wd-rail">
          <div className="wd-brand"><BrandMark />orb</div>
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
              const since = studioAt.get(p.id)
              return (
                <div key={p.id} className={`wd-row${isSel(s) ? ' on' : ''}`} onClick={() => openSel(s)}>
                  <Avatar color={p.avatar_color} label={p.initials.slice(0, 1)} avatarUrl={p.avatar_url}
                    dot={since !== undefined ? 'studio' : p.isOnline ? 'on' : undefined} />
                  <span className="wd-rname">
                    <b>{p.display_name}</b>
                    {since !== undefined
                      ? <span className="studio">{`in the studio${studioFor(since, nowTick)}`}</span>
                      : <span>{last ? snippet(last, last.sender_id === user.id ? 'you' : undefined) : (p.isOnline ? 'online' : 'offline')}</span>}
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
          <div className={`wd-rail-foot${sel?.kind === 'me' ? ' on' : ''}`} onClick={() => openSel({ kind: 'me' })}>
            <Avatar color={me?.avatar_color ?? '#1A1917'} label={(me?.initials ?? myName).slice(0, 1)}
              avatarUrl={me?.avatar_url} dot="studio" />
            <span>{myName}</span>
          </div>
        </div>

        {/* ── main ─────────────────────────────────────────────── */}
        <div className="wd-main">
          {sel?.kind === 'me' ? (
            /* my calendar — the personal programme, fuller, with the
               unscoped schedule prompt. */
            <>
              <div className="wd-head plain">
                <div className="wd-title">{myName}</div>
                <div className="wd-sub">my calendar</div>
              </div>
              <div className="wd-me">
                <div className="wd-me-scroll">
                  <UpcomingRows events={allCalEvents} groupTitleById={groupTitleById} limit={30} nowTick={nowTick} />
                </div>
                <div className="wd-sprompt">
                  <SchedulePrompt targets={[]} onSubmit={(text) => saveMyEvents(text)} />
                </div>
              </div>
            </>
          ) : sel ? (
            <>
              <div className="wd-head">
                <div className="wd-title">{headerTitle}</div>
                <div className="wd-sub">{headerSub}</div>
                <div className="wd-tabs">
                  <span className={`wd-tab${tab === 'chat' ? ' on' : ''}`} onClick={() => setTab('chat')}>chat</span>
                  <span className={`wd-tab${tab === 'stems' ? ' on' : ''}`} onClick={() => activeConvId && setTab('stems')}>stems</span>
                  <span className={`wd-tab${tab === 'calendar' ? ' on' : ''}`} onClick={() => activeConvId && setTab('calendar')}>
                    calendar{convUpcomingCount > 0 && <i>{convUpcomingCount}</i>}
                  </span>
                  <span className={`wd-tab${tab === 'notes' ? ' on' : ''}`} onClick={() => activeConvId && setTab('notes')}>
                    notes{notes.length > 0 && <i>{notes.length}</i>}
                  </span>
                </div>
              </div>

              {tab === 'chat' && (
                <>
                  <div className="wd-chat" ref={chatScrollRef}>
                    {messagesLoading
                      ? <div className="wd-quiet">…</div>
                      : chatRows.length > 0
                        ? <div className="wd-chat-col">{chatRows}</div>
                        : <div className="wd-quiet">no messages yet — say hi</div>}
                  </div>
                  {uploads.length > 0 && (
                    <div className="wd-uploading">
                      {uploads.map(u => (
                        <span key={u.id}>uploading {u.name} · {Math.round(u.progress * 100)}%</span>
                      ))}
                    </div>
                  )}
                  <div className="wd-input">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="audio/*,image/*,.wav,.aif,.aiff,.m4a,.ogg,.flac,.caf,.opus,.aac,.mp3"
                      multiple
                      style={{ display: 'none' }}
                      onChange={e => { void onFilesPicked(e.target.files); if (e.target) e.target.value = '' }}
                    />
                    <button className="wd-attach" onClick={() => fileRef.current?.click()} aria-label="attach a file">+</button>
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
                      events={convCalEvents}
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

              {tab === 'notes' && (
                activeConvId
                  ? (
                    <StudioNotes
                      supabase={supabase}
                      conversationId={activeConvId}
                      userId={user.id}
                      nameOf={nameOf}
                      notes={notes}
                      loaded={notesLoaded}
                      refresh={refreshNotes}
                      nowTick={nowTick}
                    />
                  )
                  : <div className="wd-quiet">loading…</div>
              )}
            </>
          ) : (
            /* home — a quiet page: serif greeting + my programme. */
            <div className="wd-home">
              <div className="wd-home-greet">{greeting}, {myName}</div>
              <div className="wd-home-date">
                {new Date(nowTick).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toLowerCase()}
              </div>
              <UpcomingRows events={allCalEvents} groupTitleById={groupTitleById} limit={8} nowTick={nowTick} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
