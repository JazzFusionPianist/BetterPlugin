'use client'

import { useMemo, useRef, useState } from 'react'
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
import OrbHome from './OrbHome'
import CanvasLayer from './CanvasLayer'
import DrawingBoard from './DrawingBoard'
import SchedulePrompt from './SchedulePrompt'
import CalendarView from './CalendarView'
import ProfileSheet from './ProfileSheet'
import FriendWall from './FriendWall'
import ChatThread, { type ThreadTarget } from './ChatThread'
import ConversationsList from './ConversationsList'
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

  // The wall keeps ONE drawing layer — pencil marks on the page itself.
  const myDrawing = canvasItems.find((i) => i.kind === 'drawing') ?? null
  const saveDrawing = async (strokes: { c: string; w: number; p: number[] }[]) => {
    try {
      if (myDrawing) {
        if (strokes.length === 0) await deleteCanvasItem(myDrawing.id)
        else await updateCanvasItem(myDrawing.id, { strokes })
      } else if (strokes.length > 0) {
        await addCanvasItem({ kind: 'drawing', strokes, x: 0.5, y: 0.5, z: 0 })
      }
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

      <main className="webapp-main">
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
          {events.length > 0 && <span className="webapp-cal-count">{events.length}</span>}
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
            <button className="addmenu-item" onClick={() => { setAddOpen(false); photoInputRef.current?.click() }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 15l5-4 4 3 4-5 5 6" /><circle cx="9" cy="9" r="1.4" /></svg>
              photo
            </button>
            <button className="addmenu-item" onClick={() => { setAddOpen(false); setDrawOpen(true) }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" /></svg>
              draw
            </button>
          </div>
        )}
        <input ref={photoInputRef} type="file" accept="image/*" hidden onChange={onPickPhoto} />

        {drawOpen && (
          <DrawingBoard
            initial={myDrawing?.strokes ?? []}
            onSave={saveDrawing}
            onClose={() => setDrawOpen(false)}
          />
        )}

        <CanvasLayer
          items={canvasItems}
          isMine
          onUpdate={(id, patch) => { updateCanvasItem(id, patch).catch(() => {}) }}
          onDelete={(id) => { deleteCanvasItem(id).catch(() => {}) }}
        />

        <OrbHome
          me={me}
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
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <UpcomingList events={events} onOpen={() => setCalOpen(true)} />

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
          onClose={() => setThread(null)}
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
