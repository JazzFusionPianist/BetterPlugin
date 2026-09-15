'use client'

/**
 * The studio — the web app's desktop (≥821px) workspace, the Orb Chat
 * plug-in's layout brought home: a project-first rail on the left, one
 * main pane on the right (home / a room with chat · calendar · notes
 * tabs / a person's page / settings / the games wall).
 *
 * Reuse map: rail ← useConversations + useConversationNotifications;
 * chat ← ChatThread (embedded mode); calendar ← CalendarView (set into
 * the pane); games ← GamesPanel (set into the pane, stays mounted);
 * notes ← StudioBits (conversation_notes, ported from the plug-in);
 * profile / settings ← the studio pages ported from the plug-in.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import dynamic from 'next/dynamic'
import { supabase as defaultClient } from '@/lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  useProfiles, useFollows, usePresence, useConversations,
  useConversationNotifications, useCalendarEvents, useEventCategories, useFollowAlerts,
  type Profile, type CalendarEvent, type Message,
} from '@orb/core'
import { parseSchedule } from '@/lib/parseSchedule'
import { LanguageProvider, useT } from '@/lib/games/i18n'
import type { GameScreen } from '../games/GamesPanel'
import type { JoinResult, GameType } from '@/lib/games/gameRooms'
import ChatThread, { type ThreadTarget } from '../app/ChatThread'
import CalendarView from '../app/CalendarView'
import SchedulePrompt from '../app/SchedulePrompt'
import FollowAlerts from '../app/FollowAlerts'
import NewGroupSheet from '../app/NewGroupSheet'
import ProfilePage from './ProfilePage'
import SettingsPage, { APP_VERSION } from './SettingsPage'
import { UpcomingRows, useConversationNotes, StudioNotes } from './StudioBits'
import '../../app/studio.css'

const GamesPanel = dynamic(() => import('../games/GamesPanel'), { ssr: false })

type Sel =
  | { kind: 'dm'; userId: string }
  | { kind: 'group'; conversationId: string }
  | { kind: 'me' }
  | { kind: 'profile'; userId: string }
  | { kind: 'settings' }

type Tab = 'chat' | 'calendar' | 'notes'

/* ── small marks ──────────────────────────────────────────────────── */

function Avatar({ color, label, group, avatarUrl, dot }: {
  color: string; label: string; group?: boolean; avatarUrl?: string | null; dot?: 'on'
}) {
  return (
    <span className={`wd-av${group ? ' grp' : ''}`} style={{ background: color }}>
      {avatarUrl ? <img src={avatarUrl} alt="" /> : label}
      {dot && <span className="wd-dot" />}
    </span>
  )
}

function BrandMark() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <rect x="0.75" y="0.75" width="10.5" height="10.5" rx="3.2" stroke="#1A1917" strokeWidth="1" />
      <circle cx="6" cy="6" r="2" fill="var(--acc)" />
    </svg>
  )
}

function DiceGlyph({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <circle cx="3.5" cy="3.5" r="1.45" /><circle cx="8.5" cy="3.5" r="1.45" />
      <circle cx="3.5" cy="8.5" r="1.45" /><circle cx="8.5" cy="8.5" r="1.45" />
    </svg>
  )
}

function SearchGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="6.8" cy="6.8" r="4.3" />
      <path d="M10.2 10.2L14 14" strokeLinecap="round" />
    </svg>
  )
}

function GearGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <circle cx="8" cy="8" r="2.6" />
      <path d="M8 1.5v2.2M8 12.3v2.2M1.5 8h2.2M12.3 8h2.2M3.4 3.4l1.6 1.6M11 11l1.6 1.6M3.4 12.6L5 11M11 5l1.6-1.6" strokeLinecap="round" />
    </svg>
  )
}

/** Rail snippet for a conversation's last message. */
function snippet(m: Message | null | undefined, senderName?: string): string {
  if (!m) return ''
  const who = senderName ? `${senderName}: ` : ''
  if (m.attachment_type === 'game_invite') return `${who}game invite`
  if (m.attachment_type === 'image') return `${who}photo`
  if (m.attachment_type === 'video') return `${who}video`
  if (m.attachment_type === 'audio') return `${who}audio`
  if (m.attachment_type === 'multi-audio') return `${who}tracks`
  return `${who}${m.content}`
}

const GAME_NAME_KEY = {
  chess: 'game.chess', falling_blocks: 'game.fallingBlocks', poker: 'game.poker',
  ear_training: 'game.earTraining', yacht: 'game.yacht', pinball: 'game.pinball', orb_merge: 'game.orbMerge',
} as const
function useGameName(): (id: string) => string {
  const { t } = useT()
  return useCallback((id: string) => {
    const key = (GAME_NAME_KEY as Record<string, string>)[id]
    return key ? t(key as 'game.chess') : id.replace(/_/g, ' ')
  }, [t])
}

/* ── the shell ────────────────────────────────────────────────────── */

export default function StudioShell({ user, client }: { user: User; client?: SupabaseClient }) {
  return (
    <LanguageProvider>
      <StudioShellInner user={user} supabase={client ?? defaultClient} />
    </LanguageProvider>
  )
}

function StudioShellInner({ user, supabase }: { user: User; supabase: SupabaseClient }) {
  const { profiles, me, loading: profilesLoading, refetch: refetchProfiles, updateMe } = useProfiles(supabase, user.id)
  const { followingIds, followerIds, mutualIds, follow, unfollow } = useFollows(supabase, user.id)
  const onlineIds = usePresence(supabase, user.id)
  const { conversations, groupConversations } = useConversations(supabase, user.id)
  const { unread: convUnread, lastMessages: convLastMessages, markSeen } = useConversationNotifications(supabase, user.id)
  const { events: allCalEvents, addEvents, deleteEvent, updateEvent, refetch: refetchEvents } = useCalendarEvents(supabase, user.id)
  const { categories, ensureCategory, renameCategory, deleteCategory } = useEventCategories(supabase, user.id)
  const { alerts: followAlerts, dismiss: dismissFollowAlert } = useFollowAlerts(supabase, user.id)
  const gameName = useGameName()

  const [sel, setSel] = useState<Sel | null>(null)
  const [tab, setTab] = useState<Tab>('chat')
  const [nowTick, setNowTick] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  // games — the wall sets into the main pane; a live room stays mounted
  const [gameScreen, setGameScreen] = useState<GameScreen | null>(null)
  const [gameShown, setGameShown] = useState(false)
  const [peopleQuery, setPeopleQuery] = useState<string | null>(null)
  const [newGroupOpen, setNewGroupOpen] = useState(false)
  const [chatSettingsSignal, setChatSettingsSignal] = useState(0)

  // ── people ──────────────────────────────────────────────────────────
  const profilesWithStatus = useMemo(
    () => profiles.map((p: Profile) => ({ ...p, isOnline: onlineIds.has(p.id) })),
    [profiles, onlineIds],
  )
  const profileById = useMemo(() => {
    const m = new Map<string, Profile & { isOnline?: boolean }>()
    for (const p of profilesWithStatus) m.set(p.id, p)
    if (me) m.set(me.id, { ...me, isOnline: true })
    return m
  }, [profilesWithStatus, me])
  const friendProfiles = useMemo(() => {
    const list = profilesWithStatus.filter(p => mutualIds.has(p.id))
    return list.sort((a, b) => Number(b.isOnline) - Number(a.isOnline) || a.display_name.localeCompare(b.display_name))
  }, [profilesWithStatus, mutualIds])
  const dmConvByPartner = useMemo(() => {
    const m = new Map<string, { conversationId: string; lastMessage: Message }>()
    for (const c of conversations) m.set(c.partnerId, { conversationId: c.conversationId, lastMessage: c.lastMessage })
    return m
  }, [conversations])
  const groupColorByConv = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of groupConversations) {
      const colors = g.memberIds.map(id => profileById.get(id)?.avatar_color).filter((c): c is string => !!c)
      m.set(g.conversationId, mixHexColors(colors))
    }
    return m
  }, [groupConversations, profileById])
  const groupTitleById = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of groupConversations) m.set(g.conversationId, g.title || 'group')
    return m
  }, [groupConversations])
  const myName = me?.display_name ?? user.email?.split('@')[0] ?? 'me'
  const nameOf = useCallback((id: string | null): string => {
    if (!id) return '—'
    if (id === user.id) return myName
    return profileById.get(id)?.display_name ?? '—'
  }, [user.id, myName, profileById])

  // ── selection ───────────────────────────────────────────────────────
  const selectedGroup = sel?.kind === 'group' ? groupConversations.find(g => g.conversationId === sel.conversationId) ?? null : null
  const selectedProfile = sel?.kind === 'dm' ? profileById.get(sel.userId) ?? null : null
  const activeConvId: string | null = selectedGroup
    ? selectedGroup.conversationId
    : selectedProfile ? (dmConvByPartner.get(selectedProfile.id)?.conversationId ?? null) : null
  const headerTitle = selectedGroup?.title ?? selectedProfile?.display_name ?? ''
  const headerSub = useMemo(() => {
    if (selectedGroup) {
      const n = selectedGroup.memberIds.length
      const online = selectedGroup.memberIds.filter(id => id === user.id || onlineIds.has(id)).length
      return `${n} members / ${online} online`
    }
    if (selectedProfile) return selectedProfile.isOnline ? 'online' : 'offline'
    return ''
  }, [selectedGroup, selectedProfile, onlineIds, user.id])

  const threadTarget: ThreadTarget | null = useMemo(() => {
    if (selectedGroup) {
      return { kind: 'group', conversationId: selectedGroup.conversationId, title: selectedGroup.title || 'group',
        memberCount: selectedGroup.memberIds.length, avatarUrl: selectedGroup.avatarUrl ?? undefined }
    }
    if (selectedProfile) {
      return { kind: 'dm', friend: selectedProfile, conversationId: dmConvByPartner.get(selectedProfile.id)?.conversationId }
    }
    return null
  }, [selectedGroup, selectedProfile, dmConvByPartner])

  const openSel = useCallback((next: Sel) => {
    setSel(next)
    setTab('chat')
    setGameShown(false)
  }, [])
  const isSel = (s: Sel) => !!sel && (
    (sel.kind === 'dm' && s.kind === 'dm' && sel.userId === s.userId)
    || (sel.kind === 'group' && s.kind === 'group' && sel.conversationId === s.conversationId)
    || (sel.kind === 'me' && s.kind === 'me')
    || (sel.kind === 'profile' && s.kind === 'profile' && sel.userId === s.userId)
    || (sel.kind === 'settings' && s.kind === 'settings')
  )

  // ── games ───────────────────────────────────────────────────────────
  const openGames = useCallback(() => {
    setGameScreen(prev => prev ?? 'list')
    setGameShown(true)
  }, [])
  const closeGames = useCallback(() => { setGameShown(false); setGameScreen('list') }, [])
  const joinGameFromChat = useCallback(async (gameType: string, roomId: string): Promise<JoinResult> => {
    const type = gameType as GameType
    const { joinGameRoom } = await import('@/lib/games/gameRooms')
    const result = await joinGameRoom(supabase, type, roomId, user.id, { onlineIds })
    if (result === 'joined' || result === 'already-in') {
      sessionStorage.setItem('join_room_id', roomId)
      setGameScreen(type)
      setGameShown(true)
    }
    return result
  }, [user.id, onlineIds])

  // ── calendar ────────────────────────────────────────────────────────
  const convCalEvents = useMemo(
    () => allCalEvents.filter(e => e.conversation_id != null && e.conversation_id === activeConvId),
    [allCalEvents, activeConvId],
  )
  const convUpcomingCount = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    return convCalEvents.filter(e => new Date(e.starts_at) >= today).length
  }, [convCalEvents])
  const targets = useMemo(
    () => [{ id: null as string | null, label: 'personal' },
      ...groupConversations.map(g => ({ id: g.conversationId, label: g.title || 'group' }))],
    [groupConversations],
  )
  const handleSchedule = async (text: string, conversationId: string | null): Promise<CalendarEvent[]> => {
    const parsed = await parseSchedule(supabase, text)
    const withMeta = await Promise.all(parsed.map(async e => ({
      ...e, category_color: await ensureCategory(e.category), conversation_id: conversationId,
    })))
    return addEvents(withMeta)
  }
  const calendarProps = {
    currentUserId: user.id,
    categories,
    groupTitleById,
    onDelete: (id: string) => { deleteEvent(id).catch(() => {}) },
    onSetCategory: async (id: string, name: string) => {
      const color = await ensureCategory(name)
      updateEvent(id, { category: name || null, category_color: color }).catch(() => {})
    },
    onUpdate: (id: string, patch: Parameters<typeof updateEvent>[1]) => { updateEvent(id, patch).catch(() => {}) },
    onAddCategory: (name: string) => { ensureCategory(name).catch(() => {}) },
    onRenameCategory: async (id: string, name: string) => { await renameCategory(id, name).catch(() => {}); refetchEvents() },
    onDeleteCategory: async (id: string) => { await deleteCategory(id).catch(() => {}); refetchEvents() },
  }

  // ── notes ───────────────────────────────────────────────────────────
  const { notes, loaded: notesLoaded, refresh: refreshNotes } = useConversationNotes(supabase, activeConvId)

  // ── search ──────────────────────────────────────────────────────────
  const searchResults = useMemo(() => {
    const q = (peopleQuery ?? '').trim().toLowerCase().replace(/^@/, '')
    if (!q) return []
    return profilesWithStatus
      .filter(p => (p.username ?? '').includes(q) || p.display_name.toLowerCase().includes(q))
      .sort((a, b) => {
        const au = (a.username ?? '').startsWith(q) ? 0 : 1
        const bu = (b.username ?? '').startsWith(q) ? 0 : 1
        return au - bu || a.display_name.localeCompare(b.display_name)
      })
      .slice(0, 12)
  }, [peopleQuery, profilesWithStatus])

  const greeting = useMemo(() => {
    const h = new Date(nowTick).getHours()
    return h < 5 ? 'working late' : h < 12 ? 'good morning' : h < 18 ? 'good afternoon' : 'good evening'
  }, [nowTick])

  const goHome = () => { setSel(null); setGameShown(false) }

  return (
    <div className="wd-stage web">
      <div className="wd">

        {/* ── rail ─────────────────────────────────────────────── */}
        <div className="wd-rail">
          <div className="wd-brand" onClick={goHome} role="button" tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter') goHome() }}>
            <BrandMark />orb
          </div>
          <div className="wd-rail-scroll">
            <div className={`wd-row${gameShown ? ' on' : ''}`} onClick={openGames}>
              <span className="wd-av tile"><DiceGlyph /></span>
              <span className="wd-rname">
                <b>games</b>
                {gameScreen && gameScreen !== 'list' && !gameShown && (
                  <span className="play">{gameName(gameScreen)} in play</span>
                )}
              </span>
            </div>
            <div className="wd-sec row">
              <span>projects</span>
              <button className="wd-sec-plus" onClick={() => setNewGroupOpen(true)}>+ new</button>
            </div>
            {groupConversations.map(g => {
              const s: Sel = { kind: 'group', conversationId: g.conversationId }
              const unread = convUnread.get(g.conversationId) ?? 0
              const last = convLastMessages.get(g.conversationId) ?? g.lastMessage
              const senderName = last && last.sender_id !== user.id
                ? profileById.get(last.sender_id)?.display_name
                : (last ? myName : undefined)
              return (
                <div key={g.conversationId} className={`wd-row${isSel(s) ? ' on' : ''}`} onClick={() => openSel(s)}>
                  <Avatar group color={groupColorByConv.get(g.conversationId) ?? '#4A8FE7'} label={(g.title || 'G').slice(0, 1)}
                    avatarUrl={g.avatarUrl} />
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

            {peopleQuery === null ? (
              <div className="wd-sec people">
                <span>people</span>
                <button className="wd-sec-search" onClick={() => setPeopleQuery('')} aria-label="find people" title="find people">
                  <SearchGlyph />
                </button>
              </div>
            ) : (
              <div className="wd-search">
                <span className="wd-search-at">@</span>
                <input className="wd-search-in" value={peopleQuery} autoFocus spellCheck={false} placeholder="username"
                  onChange={e => setPeopleQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') setPeopleQuery(null) }} />
                <button className="wd-search-x" onClick={() => setPeopleQuery(null)} aria-label="close search">✕</button>
              </div>
            )}
            {peopleQuery !== null && (
              peopleQuery.trim() === ''
                ? <div className="wd-search-none">type a username</div>
                : searchResults.length === 0
                  ? <div className="wd-search-none">no one by that name</div>
                  : searchResults.map(p => {
                    const s: Sel = { kind: 'profile', userId: p.id }
                    return (
                      <div key={p.id} className={`wd-row${isSel(s) ? ' on' : ''}`} onClick={() => openSel(s)}>
                        <Avatar color={p.avatar_color} label={p.initials.slice(0, 1)} avatarUrl={p.avatar_url} dot={p.isOnline ? 'on' : undefined} />
                        <span className="wd-rname">
                          <b>{p.display_name}</b>
                          <span className="handle">
                            {p.username ? `@${p.username}` : ''}
                            {mutualIds.has(p.id) ? '  friends' : followerIds.has(p.id) ? '  follows you' : followingIds.has(p.id) ? '  following' : ''}
                          </span>
                        </span>
                      </div>
                    )
                  })
            )}
            {peopleQuery === null && friendProfiles.map(p => {
              const s: Sel = { kind: 'dm', userId: p.id }
              const conv = dmConvByPartner.get(p.id)
              const unread = conv ? (convUnread.get(conv.conversationId) ?? 0) : 0
              const last = conv ? (convLastMessages.get(conv.conversationId) ?? conv.lastMessage) : null
              return (
                <div key={p.id} className={`wd-row${isSel(s) ? ' on' : ''}`} onClick={() => openSel(s)}>
                  <Avatar color={p.avatar_color} label={p.initials.slice(0, 1)} avatarUrl={p.avatar_url} dot={p.isOnline ? 'on' : undefined} />
                  <span className="wd-rname">
                    <b>{p.display_name}</b>
                    <span>{last ? snippet(last, last.sender_id === user.id ? 'you' : undefined) : (p.isOnline ? 'online' : 'offline')}</span>
                  </span>
                  {unread > 0 && <span className="wd-badge">{unread}</span>}
                </div>
              )
            })}
            {peopleQuery === null && friendProfiles.length === 0 && !profilesLoading && (
              <div className="wd-row" style={{ cursor: 'default' }}>
                <span className="wd-rname"><span>follow someone to start</span></span>
              </div>
            )}
          </div>
          <div className={`wd-rail-foot${sel?.kind === 'profile' && sel.userId === user.id ? ' on' : ''}`}>
            <span className="wd-foot-me" onClick={() => openSel({ kind: 'profile', userId: user.id })} role="button" tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter') openSel({ kind: 'profile', userId: user.id }) }}>
              <Avatar color={me?.avatar_color ?? '#1A1917'} label={(me?.initials ?? myName).slice(0, 1)} avatarUrl={me?.avatar_url} dot="on" />
              <span>{myName}</span>
            </span>
            <button className={`wd-foot-gear${sel?.kind === 'settings' ? ' on' : ''}`}
              onClick={() => openSel({ kind: 'settings' })} aria-label="settings" title="settings">
              <GearGlyph />
            </button>
          </div>
        </div>

        {/* ── main ─────────────────────────────────────────────── */}
        <div className="wd-main">
          {gameScreen !== null && me && (
            <div className="wd-games-host" hidden={!gameShown}>
              <GamesPanel
                supabase={supabase}
                me={me}
                friends={friendProfiles}
                screen={gameScreen}
                onScreenChange={setGameScreen}
                onClose={closeGames}
              />
            </div>
          )}

          {sel?.kind === 'settings' ? (
            <>
              <div className="wd-head plain">
                <div className="wd-title">settings</div>
                <div className="wd-sub">orb {APP_VERSION}</div>
              </div>
              <SettingsPage supabase={supabase} user={user} />
            </>
          ) : sel?.kind === 'profile' ? (
            (() => {
              const isMine = sel.userId === user.id
              const p = isMine ? (me ? { ...me, isOnline: true } : null) : (profileById.get(sel.userId) ?? null)
              if (!p) return <div className="wd-quiet">…</div>
              return (
                <ProfilePage
                  key={p.id}
                  supabase={supabase}
                  user={user}
                  profile={p}
                  isMine={isMine}
                  following={followingIds.has(p.id)}
                  follower={followerIds.has(p.id)}
                  onFollow={() => follow(p.id)}
                  onUnfollow={() => unfollow(p.id)}
                  onMessage={() => openSel({ kind: 'dm', userId: p.id })}
                  onUpdated={() => { void refetchProfiles() }}
                  updateMe={isMine ? updateMe : undefined}
                />
              )
            })()
          ) : sel?.kind === 'me' ? (
            <>
              <div className="wd-head plain">
                <div className="wd-title">{myName}</div>
                <div className="wd-sub">my calendar</div>
              </div>
              <div className="wd-pane wd-calhost">
                <CalendarView open events={allCalEvents} onClose={goHome} {...calendarProps} />
              </div>
            </>
          ) : sel && threadTarget ? (
            <>
              <div className="wd-head">
                <div className="wd-head-row">
                  {selectedGroup ? (
                    <span className="wd-hav grp" style={{ background: groupColorByConv.get(selectedGroup.conversationId) ?? '#4A8FE7' }}>
                      {selectedGroup.avatarUrl ? <img src={selectedGroup.avatarUrl} alt="" /> : (selectedGroup.title || 'G').slice(0, 1)}
                    </span>
                  ) : selectedProfile ? (
                    <span className="wd-hav click" style={{ background: selectedProfile.avatar_color }}
                      onClick={() => openSel({ kind: 'profile', userId: selectedProfile.id })} role="button" title="profile">
                      {selectedProfile.avatar_url ? <img src={selectedProfile.avatar_url} alt="" /> : selectedProfile.initials.slice(0, 1)}
                    </span>
                  ) : null}
                  <div className="wd-head-col">
                    <div className="wd-htitle">{headerTitle}</div>
                    <div className="wd-hsub">{headerSub}</div>
                  </div>
                  {activeConvId && (
                    <button className="wd-word sm" onClick={() => setChatSettingsSignal(n => n + 1)}>
                      {selectedGroup ? 'members' : 'chat settings'}
                    </button>
                  )}
                </div>
                <div className="wd-tabs">
                  <span className={`wd-tab${tab === 'chat' ? ' on' : ''}`} onClick={() => setTab('chat')}>chat</span>
                  <span className={`wd-tab${tab === 'calendar' ? ' on' : ''}${activeConvId ? '' : ' off'}`} onClick={() => activeConvId && setTab('calendar')}>
                    calendar{convUpcomingCount > 0 && <i>{convUpcomingCount}</i>}
                  </span>
                  <span className={`wd-tab${tab === 'notes' ? ' on' : ''}${activeConvId ? '' : ' off'}`} onClick={() => activeConvId && setTab('notes')}>
                    notes{notes.length > 0 && <i>{notes.length}</i>}
                  </span>
                </div>
              </div>

              {tab === 'chat' && (
                <div className="wd-pane">
                  <ChatThread
                    key={threadTarget.kind === 'group' ? threadTarget.conversationId : threadTarget.friend.id}
                    supabase={supabase}
                    currentUserId={user.id}
                    target={threadTarget}
                    profileById={profileById}
                    onSeen={markSeen}
                    onJoinGame={joinGameFromChat}
                    friends={friendProfiles}
                    onClose={goHome}
                    embedded
                    settingsSignal={chatSettingsSignal}
                  />
                </div>
              )}
              {tab === 'calendar' && activeConvId && (
                <div className="wd-pane wd-calhost">
                  <CalendarView open events={convCalEvents} onClose={() => setTab('chat')} {...calendarProps} />
                </div>
              )}
              {tab === 'notes' && activeConvId && (
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
              )}
            </>
          ) : (
            <div className="wd-home">
              <div className="wd-home-greet">{greeting}, {myName}</div>
              <div className="wd-home-date">
                {new Date(nowTick).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toLowerCase()}
              </div>
              <div className="wd-home-prompt">
                <SchedulePrompt
                  onSubmit={handleSchedule}
                  onOpenCalendar={() => openSel({ kind: 'me' })}
                  targets={targets}
                  categories={categories}
                  onUpdate={(id, patch) => { updateEvent(id, patch).catch(() => {}) }}
                  onSetCategory={async (id, name) => {
                    const color = name ? await ensureCategory(name) : null
                    updateEvent(id, { category: name || null, category_color: color }).catch(() => {})
                    return color
                  }}
                />
              </div>
              <UpcomingRows events={allCalEvents} groupTitleById={groupTitleById} limit={8} nowTick={nowTick} />
              <button className="wd-word sm wd-home-more" onClick={() => openSel({ kind: 'me' })}>my calendar</button>
            </div>
          )}
        </div>
      </div>

      <FollowAlerts alerts={followAlerts} followingIds={followingIds} onFollowBack={follow} onDismiss={dismissFollowAlert} />

      <NewGroupSheet
        open={newGroupOpen}
        supabase={supabase}
        currentUserId={user.id}
        friends={friendProfiles}
        onCreated={(conversationId) => { setNewGroupOpen(false); openSel({ kind: 'group', conversationId }) }}
        onClose={() => setNewGroupOpen(false)}
      />
    </div>
  )
}

/** Average a set of #RRGGBB strings into one hex (group tint). */
function mixHexColors(hexes: string[]): string {
  if (hexes.length === 0) return '#4A8FE7'
  let r = 0, g = 0, b = 0
  for (const h of hexes) {
    const m = /^#?([0-9a-f]{6})$/i.exec(h.trim())
    if (!m) continue
    const v = parseInt(m[1]!, 16)
    r += (v >> 16) & 0xff; g += (v >> 8) & 0xff; b += v & 0xff
  }
  const n = hexes.length
  const to2 = (x: number) => Math.round(x / n).toString(16).padStart(2, '0')
  return `#${to2(r)}${to2(g)}${to2(b)}`
}
