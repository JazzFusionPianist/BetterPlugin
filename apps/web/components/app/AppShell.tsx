'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import {
  useProfiles, useFollows, usePresence, useConversations,
  useConversationNotifications, useCalendarEvents, useEventCategories,
  useCanvasItems,
  type Profile, type CalendarEvent,
} from '@orb/core'
import { parseSchedule } from '@/lib/parseSchedule'
import { uploadAttachment, compressImage } from '@/lib/upload'
import Sidebar from './Sidebar'
import UpcomingList from './UpcomingList'
import OrbHome, { OrbHomeCenter } from './OrbHome'
import CanvasLayer from './CanvasLayer'
import DrawingBoard from './DrawingBoard'
import SchedulePrompt from './SchedulePrompt'
import CalendarView from './CalendarView'
import ProfileSheet from './ProfileSheet'
import FriendWall from './FriendWall'
import ChatThread, { type ThreadTarget } from './ChatThread'
import ConversationsList from './ConversationsList'
import dynamic from 'next/dynamic'
import type { GameScreen } from '../games/GamesPanel'
import type { JoinResult, GameType } from '@/lib/games/gameRooms'

// The whole game suite (4 games + rooms) only loads when someone opens it.
const GamesPanel = dynamic(() => import('../games/GamesPanel'), { ssr: false })
import SettingsSheet from './SettingsSheet'
import AddFriendsSheet from './AddFriendsSheet'
import NewGroupSheet from './NewGroupSheet'

/**
 * Hybrid desktop layout: a persistent conversations rail on the left +
 * the immersive orb-profile home as the main stage. On narrow screens
 * the rail collapses behind a toggle (the future mobile layout).
 */
export default function AppShell({ user }: { user: User }) {
  const { profiles, me, updateMyAvatar, updateMe } = useProfiles(supabase, user.id)
  const { followingIds, followerIds, mutualIds, follow, unfollow } = useFollows(supabase, user.id)
  const online = usePresence(supabase, user.id)
  const { conversations, groupConversations } = useConversations(supabase, user.id)
  const { unread, markSeen } = useConversationNotifications(supabase, user.id)
  const { events, addEvents, deleteEvent, updateEvent, refetch: refetchEvents } = useCalendarEvents(supabase, user.id)
  const { categories, ensureCategory, renameCategory, deleteCategory } = useEventCategories(supabase, user.id)
  const { items: canvasItems, addItem: addCanvasItem, updateItem: updateCanvasItem, deleteItem: deleteCanvasItem } = useCanvasItems(supabase, user.id)

  const photoInputRef = useRef<HTMLInputElement>(null)
  const [pinning, setPinning] = useState(false)
  const [addOpen, setAddOpen] = useState(false)    // the + menu (photo / draw)
  const [drawOpen, setDrawOpen] = useState(false)  // colored-pencil mode

  // On phones the home is a two-page booklet spread — people / wall —
  // swiped horizontally. Desktop flattens both pages back onto one
  // canvas via display:contents, so this ref only matters under 820px.
  const bookRef = useRef<HTMLDivElement>(null)
  const [bookPage, setBookPage] = useState(0)
  const goPage = (i: number) => {
    const el = bookRef.current
    if (el && el.clientWidth > 0) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  // ── Home zoom ───────────────────────────────────────────────────────
  // One view transform shared by the orb field and the wall (the chrome
  // — buttons, programme, prompt — stays put). Pinch on empty canvas,
  // trackpad pinch (ctrl+wheel), or the −/+ control; plain scroll pans
  // once zoomed in. Two fingers ON one wall item resize that item
  // instead (handled in CanvasLayer; we skip those here).
  const ZMIN = 0.5, ZMAX = 2.5
  const [view, setView] = useState({ z: 1, tx: 0, ty: 0 })
  const viewRef = useRef(view)
  viewRef.current = view
  const mainRef = useRef<HTMLElement | null>(null)
  const zoomPts = useRef<Map<number, { x: number; y: number; onItem: boolean }>>(new Map())
  const zoomPinch = useRef<{ d0: number; z0: number; cx0: number; cy0: number; tx0: number; ty0: number } | null>(null)

  const clampView = (z: number, tx: number, ty: number) => {
    const el = mainRef.current
    const w = el?.clientWidth ?? 0, h = el?.clientHeight ?? 0
    const zc = Math.min(ZMAX, Math.max(ZMIN, z))
    const mx = Math.max(0, ((zc - 1) * w) / 2), my = Math.max(0, ((zc - 1) * h) / 2)
    return { z: zc, tx: Math.min(mx, Math.max(-mx, tx)), ty: Math.min(my, Math.max(-my, ty)) }
  }
  /** Zoom to `z` keeping the client point (fx,fy) visually fixed. */
  const zoomAt = (z: number, fx: number, fy: number) => {
    const el = mainRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const v = viewRef.current
    const zc = Math.min(ZMAX, Math.max(ZMIN, z))
    const Fx = fx - (r.left + r.width / 2), Fy = fy - (r.top + r.height / 2)
    const k = zc / v.z
    setView(clampView(zc, Fx - (Fx - v.tx) * k, Fy - (Fy - v.ty) * k))
  }
  const zoomStep = (k: number) => {
    const v = viewRef.current
    const zc = Math.min(ZMAX, Math.max(ZMIN, v.z * k))
    setView(clampView(zc, v.tx * (zc / v.z), v.ty * (zc / v.z)))
  }

  // Trackpad pinch arrives as ctrl+wheel; needs a non-passive listener.
  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        zoomAt(viewRef.current.z * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY)
      } else if (viewRef.current.z > 1) {
        e.preventDefault()
        const v = viewRef.current
        setView(clampView(v.z, v.tx - e.deltaX, v.ty - e.deltaY))
      }
    }
    // Two-finger touches are ours (zoom), never the booklet's scroll.
    const onTouchStart = (e: TouchEvent) => { if (e.touches.length >= 2) e.preventDefault() }
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('touchstart', onTouchStart, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('touchstart', onTouchStart)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ZOOM_IGNORE = '.polad, .doodle, .drawboard, .sprompt, .addmenu, button, input, textarea'
  const zoomDown = (e: React.PointerEvent) => {
    const onItem = !!(e.target as Element).closest?.(ZOOM_IGNORE)
    zoomPts.current.set(e.pointerId, { x: e.clientX, y: e.clientY, onItem })
    const pts = [...zoomPts.current.values()]
    if (pts.length === 2 && pts.every((p) => !p.onItem)) {
      const v = viewRef.current
      zoomPinch.current = {
        d0: Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y),
        z0: v.z,
        cx0: (pts[0]!.x + pts[1]!.x) / 2, cy0: (pts[0]!.y + pts[1]!.y) / 2,
        tx0: v.tx, ty0: v.ty,
      }
    }
  }
  const zoomMove = (e: React.PointerEvent) => {
    const rec = zoomPts.current.get(e.pointerId)
    if (!rec) return
    zoomPts.current.set(e.pointerId, { ...rec, x: e.clientX, y: e.clientY })
    const g = zoomPinch.current
    const el = mainRef.current
    if (!g || !el || zoomPts.current.size < 2 || g.d0 <= 0) return
    const pts = [...zoomPts.current.values()]
    const d = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y)
    const cx = (pts[0]!.x + pts[1]!.x) / 2, cy = (pts[0]!.y + pts[1]!.y) / 2
    const r = el.getBoundingClientRect()
    const z = Math.min(ZMAX, Math.max(ZMIN, g.z0 * (d / g.d0)))
    const Fx = g.cx0 - (r.left + r.width / 2), Fy = g.cy0 - (r.top + r.height / 2)
    const k = z / g.z0
    setView(clampView(z, Fx - (Fx - g.tx0) * k + (cx - g.cx0), Fy - (Fy - g.ty0) * k + (cy - g.cy0)))
  }
  const zoomUp = (e: React.PointerEvent) => {
    zoomPts.current.delete(e.pointerId)
    if (zoomPts.current.size < 2) zoomPinch.current = null
  }

  const zoomStyle = { transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.z})` }

  // Every drawing session lands as its own movable doodle object,
  // anchored where it was drawn. Drawn on a wide screen → the landscape
  // slots get the exact spot and the portrait slots take the same
  // fractions as a sensible starting point (and vice versa).
  const saveDrawing = async (strokes: { c: string; w: number; p: number[] }[], cx: number, cy: number, land: boolean) => {
    if (strokes.length === 0) return
    try {
      await addCanvasItem({
        kind: 'drawing', strokes,
        x: cx, y: cy,
        ...(land ? { lx: cx, ly: cy } : {}),
      })
    } catch (err) {
      console.error('[canvas] drawing save failed', err)
    }
  }

  // Pin a photo to the home wall: compress → R2 → canvas_items, dropped at
  // a tilted spot in the upper canvas (clear of the centre avatar).
  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPinning(true)
    try {
      const compressed = await compressImage(file)
      const { url } = await uploadAttachment(compressed, user.id)
      const x = 0.14 + Math.random() * 0.72
      const y = 0.15 + Math.random() * 0.26
      const rotation = (Math.random() - 0.5) * 11
      await addCanvasItem({ kind: 'photo', media_url: url, x, y, rotation, taken_at: new Date(file.lastModified).toISOString() })
    } catch (err) {
      console.error('[canvas] pin failed', err)
    } finally {
      setPinning(false)
    }
  }

  const [calOpen, setCalOpen] = useState(false)
  const [gamesOpen, setGamesOpen] = useState(false)                      // games overlay
  const [gamesScreen, setGamesScreen] = useState<GameScreen>('list')     // list | chess | …
  const [convsOpen, setConvsOpen] = useState(false)                      // conversations list
  const [settingsOpen, setSettingsOpen] = useState(false)                // profile / about / sign out
  const [findOpen, setFindOpen] = useState(false)                        // find people
  const [newGroupOpen, setNewGroupOpen] = useState(false)                // create a group
  const [sheetFriend, setSheetFriend] = useState<Profile | null>(null)   // profile bottom sheet
  const [wallFriend, setWallFriend] = useState<(Profile & { isOnline?: boolean }) | null>(null) // friend's wall
  const [thread, setThread] = useState<ThreadTarget | null>(null)        // open conversation

  // Where new events go: personal, or shared with one of my groups.
  const targets = useMemo(
    () => [
      { id: null as string | null, label: 'Personal' },
      ...groupConversations.map((g) => ({ id: g.conversationId, label: g.title || 'Group' })),
    ],
    [groupConversations],
  )
  const groupTitleById = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of groupConversations) m.set(g.conversationId, g.title || 'Group')
    return m
  }, [groupConversations])

  // Parse free text → events, assign category colors, persist to the chosen
  // target (null = personal). Returns what was added (for the confirmation).
  const handleSchedule = async (text: string, conversationId: string | null): Promise<CalendarEvent[]> => {
    const parsed = await parseSchedule(supabase, text)
    const withMeta = await Promise.all(parsed.map(async (e) => ({
      ...e,
      category_color: await ensureCategory(e.category),
      conversation_id: conversationId,
    })))
    return addEvents(withMeta)
  }

  const profilesWithStatus = useMemo(
    () => profiles.map((p: Profile) => ({ ...p, isOnline: online.has(p.id) })),
    [profiles, online],
  )
  const friends = useMemo(
    () => profilesWithStatus.filter((p: Profile) => mutualIds.has(p.id)),
    [profilesWithStatus, mutualIds],
  )

  // Map conversation-keyed unread → friend-keyed for the rail badges.
  const unreadByFriend = useMemo(() => {
    const out = new Map<string, number>()
    for (const c of conversations) {
      const n = unread.get(c.conversationId) ?? 0
      if (n > 0) out.set(c.partnerId, n)
    }
    return out
  }, [conversations, unread])

  // Sender-id → profile (group sender names, conversation rows). Includes me.
  const profileById = useMemo(() => {
    const m = new Map<string, Profile & { isOnline?: boolean }>()
    for (const p of profilesWithStatus) m.set(p.id, p)
    if (me) m.set(me.id, { ...me, isOnline: true })
    return m
  }, [profilesWithStatus, me])

  // Join a game room from a chat invite bubble: claim the seat, stash
  // the room id for the game view to pick up, and open the games page.
  const joinGameFromChat = async (gameType: string, roomId: string): Promise<JoinResult> => {
    const type = gameType as GameType
    const { joinGameRoom } = await import('@/lib/games/gameRooms')
    const onlineIds = new Set(friends.filter((f) => f.isOnline).map((f) => f.id))
    const result = await joinGameRoom(supabase, type, roomId, user.id, { onlineIds })
    if (result === 'joined' || result === 'already-in') {
      sessionStorage.setItem('join_room_id', roomId)
      setGamesScreen(type)
      setGamesOpen(true)
    }
    return result
  }

  // Remaining events this calendar week (today through Sunday) — the
  // blue chip beside the calendar button.
  const weekCount = useMemo(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const dow = (start.getDay() + 6) % 7 // 0 = Monday
    const end = new Date(start)
    end.setDate(start.getDate() + (7 - dow))
    return events.filter((e) => {
      const t = new Date(e.starts_at)
      return t >= start && t < end
    }).length
  }, [events])

  const totalUnread = useMemo(
    () => Array.from(unread.values()).reduce((a, b) => a + b, 0),
    [unread],
  )

  return (
    <div className="webapp">
      {/* Desktop shows the conversations rail as a persistent column
          (numbered like the mobile sheet; rows open the thread). On
          mobile it's hidden — the chats button opens the sheet instead. */}
      <Sidebar
        conversations={conversations}
        groupConversations={groupConversations}
        profileById={profileById}
        currentUserId={user.id}
        unread={unread}
        onOpen={(t) => setThread(t)}
      />

      <main
        className="webapp-main"
        ref={mainRef}
        onPointerDown={zoomDown}
        onPointerMove={zoomMove}
        onPointerUp={zoomUp}
        onPointerCancel={zoomUp}
      >
        <button
          className="webapp-chats-btn"
          onClick={() => setConvsOpen(true)}
          aria-label="Open chats"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.4 8.4 0 0 1-11.7 7.7L3 21l1.9-6.3A8.4 8.4 0 1 1 21 11.5Z" />
          </svg>
          {totalUnread > 0 && <span className="webapp-cal-count">{totalUnread > 9 ? '9+' : totalUnread}</span>}
        </button>

        <button
          className="webapp-cal-btn"
          onClick={() => setCalOpen(true)}
          aria-label="Open calendar"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
            <path d="M3 9h18M8 2.5v4M16 2.5v4" />
          </svg>
        </button>
        {weekCount > 0 && (
          <button className="webapp-week-chip" onClick={() => setCalOpen(true)}>
            {weekCount} {weekCount === 1 ? 'event' : 'events'} this week
          </button>
        )}

        <button
          className="webapp-game-btn"
          onClick={() => setGamesOpen(true)}
          aria-label="Open games"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 11h4M8 9v4" />
            <circle cx="15.5" cy="10.5" r="0.6" fill="currentColor" stroke="none" />
            <circle cx="17.8" cy="12.8" r="0.6" fill="currentColor" stroke="none" />
            <path d="M17.32 5H6.68a4 4 0 0 0-3.98 3.6L2 15.3a2.6 2.6 0 0 0 4.53 2l1.9-2.3h7.14l1.9 2.3a2.6 2.6 0 0 0 4.53-2l-.7-6.7A4 4 0 0 0 17.32 5Z" />
          </svg>
        </button>

        <button
          className={`webapp-add-btn${pinning ? ' busy' : ''}${addOpen ? ' open' : ''}`}
          onClick={() => !pinning && setAddOpen((o) => !o)}
          aria-label="Add to your wall"
        >
          {pinning ? (
            <span className="webapp-add-spin" />
          ) : (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          )}
        </button>
        {addOpen && (
          <div className="addmenu">
            <button className="addmenu-item" onClick={() => { setAddOpen(false); goPage(1); photoInputRef.current?.click() }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 15l5-4 4 3 4-5 5 6" /><circle cx="9" cy="9" r="1.4" /></svg>
              photo
            </button>
            <button className="addmenu-item" onClick={() => { setAddOpen(false); goPage(1); setView({ z: 1, tx: 0, ty: 0 }); setDrawOpen(true) }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" /></svg>
              draw
            </button>
          </div>
        )}
        <input ref={photoInputRef} type="file" accept="image/*" hidden onChange={onPickPhoto} />

        {/* The booklet spread. Page 1 = people (orbs + programme), page 2
            = the wall (polaroids + doodles). Phones swipe between them;
            desktop flattens both pages onto the one canvas (CSS
            display:contents), identical to before. */}
        <div
          className="home-book"
          ref={bookRef}
          onScroll={(e) => {
            const el = e.currentTarget
            if (el.clientWidth > 0) setBookPage(Math.round(el.scrollLeft / el.clientWidth))
          }}
        >
          <section className="home-page">
            <div className="home-zoom" style={zoomStyle}>
            <OrbHome
              friends={friends}
              groups={groupConversations.map((g) => ({
                conversationId: g.conversationId,
                title: g.title || 'Group',
                memberCount: g.memberIds.length,
                members: g.memberIds
                  .map((id) => (id === user.id ? me : profileById.get(id)))
                  .filter((p): p is Profile => !!p)
                  .slice(0, 5)
                  .map((p) => ({ color: p.avatar_color, initials: p.initials, avatarUrl: p.avatar_url ?? null })),
              }))}
              unreadByFriend={unreadByFriend}
              unreadByGroup={unread}
              onSelect={setSheetFriend}
              onSelectGroup={(g) => setThread({ kind: 'group', conversationId: g.conversationId, title: g.title, memberCount: g.memberCount })}
            />
            </div>

            <UpcomingList events={events} onOpen={() => setCalOpen(true)} />
          </section>

          <section className="home-page">
            <div className="home-zoom" style={zoomStyle}>
            <CanvasLayer
              items={canvasItems}
              isMine
              onUpdate={(id, patch) => { updateCanvasItem(id, patch).catch(() => {}) }}
              onDelete={(id) => { deleteCanvasItem(id).catch(() => {}) }}
            />
            </div>

            {canvasItems.length === 0 && (
              <div className="home-wall-hint">your wall — tap + to pin a photo or draw</div>
            )}

            {/* Outside the zoom: drawing always happens at 1:1 (the draw
                action resets the view first), so captured fractions and
                the rendered wall agree. */}
            {drawOpen && (
              <DrawingBoard
                onSave={saveDrawing}
                onClose={() => setDrawOpen(false)}
              />
            )}
          </section>
        </div>

        {/* You — fixed chrome: outside the zoom, above both pages, so
            your face and name hold still while the canvas moves. */}
        <OrbHomeCenter
          me={me}
          friendCount={friends.length}
          groupCount={groupConversations.length}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        {/* Zoom control — hairline chip, bottom-right. */}
        <div className="home-zoomctl">
          <button onClick={() => zoomStep(1 / 1.25)} aria-label="Zoom out">−</button>
          <button className="home-zoomctl-val" onClick={() => setView({ z: 1, tx: 0, ty: 0 })} aria-label="Reset zoom">
            {Math.round(view.z * 100)}%
          </button>
          <button onClick={() => zoomStep(1.25)} aria-label="Zoom in">+</button>
        </div>

        {/* Page marks — phones only. */}
        <div className="home-dots">
          <button className={`home-dot${bookPage === 0 ? ' on' : ''}`} onClick={() => goPage(0)} aria-label="People" />
          <button className={`home-dot${bookPage === 1 ? ' on' : ''}`} onClick={() => goPage(1)} aria-label="Wall" />
        </div>

        <SchedulePrompt onSubmit={handleSchedule} onOpenCalendar={() => setCalOpen(true)} targets={targets} />
      </main>

      <ProfileSheet
        friend={sheetFriend}
        unread={sheetFriend ? (unreadByFriend.get(sheetFriend.id) ?? 0) : 0}
        onClose={() => setSheetFriend(null)}
        onMessage={(f) => { setSheetFriend(null); setThread({ kind: 'dm', friend: f }) }}
        onVisitWall={(f) => { setSheetFriend(null); setWallFriend(f as Profile & { isOnline?: boolean }) }}
      />

      {wallFriend && (
        <FriendWall
          supabase={supabase}
          currentUserId={user.id}
          friend={wallFriend}
          onClose={() => setWallFriend(null)}
        />
      )}

      <ConversationsList
        open={convsOpen}
        conversations={conversations}
        groupConversations={groupConversations}
        profileById={profileById}
        unread={unread}
        onOpen={(t) => { setConvsOpen(false); setThread(t) }}
        onNewGroup={() => { setConvsOpen(false); setNewGroupOpen(true) }}
        onClose={() => setConvsOpen(false)}
      />

      <SettingsSheet
        open={settingsOpen}
        supabase={supabase}
        user={user}
        me={me}
        onAvatarUpdated={updateMyAvatar}
        onMeUpdated={updateMe}
        onFindPeople={() => { setSettingsOpen(false); setFindOpen(true) }}
        onClose={() => setSettingsOpen(false)}
      />

      <AddFriendsSheet
        open={findOpen}
        profiles={profilesWithStatus}
        followingIds={followingIds}
        followerIds={followerIds}
        mutualIds={mutualIds}
        onFollow={follow}
        onUnfollow={unfollow}
        onClose={() => setFindOpen(false)}
      />

      <NewGroupSheet
        open={newGroupOpen}
        supabase={supabase}
        currentUserId={user.id}
        friends={friends}
        onCreated={(conversationId, title, memberCount) => {
          setNewGroupOpen(false)
          setThread({ kind: 'group', conversationId, title, memberCount })
        }}
        onClose={() => setNewGroupOpen(false)}
      />

      {thread && (
        <ChatThread
          supabase={supabase}
          currentUserId={user.id}
          target={thread}
          profileById={profileById}
          onSeen={markSeen}
          onJoinGame={joinGameFromChat}
          onClose={() => setThread(null)}
        />
      )}

      {gamesOpen && me && (
        <GamesPanel
          supabase={supabase}
          me={me}
          friends={friends}
          screen={gamesScreen}
          onScreenChange={setGamesScreen}
          onClose={() => { setGamesOpen(false); setGamesScreen('list') }}
        />
      )}

      <CalendarView
        open={calOpen}
        events={events}
        currentUserId={user.id}
        categories={categories}
        groupTitleById={groupTitleById}
        onClose={() => setCalOpen(false)}
        onDelete={(id) => { deleteEvent(id).catch(() => {}) }}
        onSetCategory={async (id, name) => {
          const color = await ensureCategory(name)
          updateEvent(id, { category: name || null, category_color: color }).catch(() => {})
        }}
        onUpdate={(id, patch) => { updateEvent(id, patch).catch(() => {}) }}
        onAddCategory={(name) => { ensureCategory(name).catch(() => {}) }}
        onRenameCategory={async (id, name) => {
          await renameCategory(id, name).catch(() => {})
          refetchEvents()
        }}
        onDeleteCategory={async (id) => {
          await deleteCategory(id).catch(() => {})
          refetchEvents()
        }}
      />
    </div>
  )
}
