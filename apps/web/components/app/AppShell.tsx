'use client'

import { useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import {
  useProfiles, useFollows, usePresence, useConversations,
  useConversationNotifications, useCalendarEvents, useEventCategories,
  type Profile, type CalendarEvent,
} from '@orb/core'
import { parseSchedule } from '@/lib/parseSchedule'
import Sidebar from './Sidebar'
import OrbHome from './OrbHome'
import SchedulePrompt from './SchedulePrompt'
import CalendarView from './CalendarView'

/**
 * Hybrid desktop layout: a persistent conversations rail on the left +
 * the immersive orb-profile home as the main stage. On narrow screens
 * the rail collapses behind a toggle (the future mobile layout).
 */
export default function AppShell({ user }: { user: User }) {
  const { profiles, me } = useProfiles(supabase, user.id)
  const { mutualIds } = useFollows(supabase, user.id)
  const online = usePresence(supabase, user.id)
  const { conversations, groupConversations } = useConversations(supabase, user.id)
  const { unread } = useConversationNotifications(supabase, user.id)
  const { events, addEvents, deleteEvent, updateEvent } = useCalendarEvents(supabase, user.id)
  const { categories, ensureCategory } = useEventCategories(supabase, user.id)

  const [calOpen, setCalOpen] = useState(false)

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

  return (
    <div className="webapp">
      {/* Desktop shows the conversations rail as a persistent column. On
          mobile it's hidden — proper mobile conversation nav lands with
          the chat view (orbs/rows aren't wired to open chats yet). */}
      <Sidebar
        conversations={conversations}
        profiles={profilesWithStatus}
        currentUserId={user.id}
        unreadByFriend={unreadByFriend}
        onClose={() => {}}
      />

      <main className="webapp-main">
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

        <OrbHome me={me} friends={friends} unreadByFriend={unreadByFriend} />

        <SchedulePrompt onSubmit={handleSchedule} onOpenCalendar={() => setCalOpen(true)} targets={targets} />
      </main>

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
      />
    </div>
  )
}
