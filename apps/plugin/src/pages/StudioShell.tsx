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
 *   notes tab      → conversation_notes (shared notepad, realtime)
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
import StemPanel from '../components/collab/StemPanel'
import ChatCalendar from '../components/collab/ChatCalendar'
import SchedulePrompt from '../components/collab/SchedulePrompt'
import { AudioAttachment } from '../components/collab/ChatView'
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

/** Shared per-conversation notepad. One serif page per conversation,
 *  autosaved (800ms debounce) and kept live over realtime. Degrades to a
 *  quiet line if the conversation_notes table hasn't been deployed yet. */
function StudioNotes({ supabase, conversationId, userId, nameOf }: {
  supabase: SupabaseClient; conversationId: string; userId: string
  nameOf: (id: string | null) => string
}) {
  const [content, setContent] = useState('')
  const [meta, setMeta] = useState<{ by: string | null; at: string | null }>({ by: null, at: null })
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestRef = useRef('')

  const persist = useCallback(async (text: string) => {
    const { error } = await supabase.from('conversation_notes').upsert({
      conversation_id: conversationId,
      content: text,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'conversation_id' })
    if (error) console.error('[StudioNotes] save failed', error)
    else setMeta({ by: userId, at: new Date().toISOString() })
  }, [supabase, conversationId, userId])

  useEffect(() => {
    let alive = true
    setState('loading'); setContent(''); latestRef.current = ''
    setMeta({ by: null, at: null })
    supabase
      .from('conversation_notes')
      .select('content, updated_by, updated_at')
      .eq('conversation_id', conversationId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return
        if (error) { setState('missing'); return }  // table not deployed yet
        setContent(data?.content ?? '')
        latestRef.current = data?.content ?? ''
        setMeta({ by: data?.updated_by ?? null, at: data?.updated_at ?? null })
        setState('ready')
      })

    const ch = supabase
      .channel(`studio-notes:${conversationId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_notes',
          filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as { content?: string; updated_by?: string | null; updated_at?: string } | null
          if (!row || typeof row.content !== 'string') return
          setMeta({ by: row.updated_by ?? null, at: row.updated_at ?? null })
          // Only adopt remote text when someone ELSE wrote it — otherwise
          // the echo of our own save would clobber in-flight typing.
          if (row.updated_by !== userId) {
            setContent(row.content)
            latestRef.current = row.content
          }
        })
      .subscribe()

    return () => {
      alive = false
      if (saveTimer.current) clearTimeout(saveTimer.current)
      supabase.removeChannel(ch)
    }
  }, [supabase, conversationId, userId])

  const onChange = (text: string) => {
    setContent(text)
    latestRef.current = text
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { void persist(latestRef.current) }, 800)
  }

  if (state === 'loading') return <div className="wd-quiet">…</div>
  if (state === 'missing') return <div className="wd-quiet">notes arrive after the next deploy</div>

  return (
    <div className="wd-notes">
      <textarea
        value={content}
        placeholder="a shared page for this room — lyrics, credits, todo…"
        onChange={e => onChange(e.target.value)}
        spellCheck={false}
      />
      <div className="wd-notes-meta">
        {meta.at
          ? `edited by ${nameOf(meta.by)} · ${dayLabel(meta.at)} ${fmtTime(meta.at)}`
          : 'nothing written yet'}
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

  // Auto-scroll chat to the newest message.
  const chatEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (tab === 'chat') chatEndRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, tab, sel])

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
      // Read receipt under my latest-read message — "read ✓" for DMs,
      // tiny avatar stack for groups.
      const readers = m.sender_id === user.id ? readersByMsgId.get(m.id) : undefined
      if (readers && readers.length > 0) {
        rows.push(
          <div key={`r-${m.id}`} className="wd-read">
            {selectedGroup ? (
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
          </div>,
        )
      }
    }
    return rows
  }, [messages, user.id, me, profileById, readersByMsgId, selectedGroup])

  const myName = me?.display_name ?? user.email?.split('@')[0] ?? 'me'
  const nameOf = useCallback((id: string | null): string => {
    if (!id) return 'someone'
    if (id === user.id) return myName
    return profileById.get(id)?.display_name ?? 'someone'
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
                  <span className={`wd-tab${tab === 'notes' ? ' on' : ''}`} onClick={() => activeConvId && setTab('notes')}>notes</span>
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
                  ? <StudioNotes supabase={supabase} conversationId={activeConvId} userId={user.id} nameOf={nameOf} />
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
