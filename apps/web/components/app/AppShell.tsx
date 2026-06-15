'use client'

import { useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import {
  useProfiles, useFollows, usePresence, useConversations,
  useConversationNotifications,
  type Profile,
} from '@orb/core'
import Sidebar from './Sidebar'
import OrbHome from './OrbHome'

/**
 * Hybrid desktop layout: a persistent conversations rail on the left +
 * the immersive orb-profile home as the main stage. On narrow screens
 * the rail collapses behind a toggle (the future mobile layout).
 */
export default function AppShell({ user }: { user: User }) {
  const { profiles, me } = useProfiles(supabase, user.id)
  const { mutualIds } = useFollows(supabase, user.id)
  const online = usePresence(supabase, user.id)
  const { conversations } = useConversations(supabase, user.id)
  const { unread } = useConversationNotifications(supabase, user.id)

  const [railOpen, setRailOpen] = useState(false)

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
    <div className={`webapp${railOpen ? ' rail-open' : ''}`}>
      <Sidebar
        conversations={conversations}
        profiles={profilesWithStatus}
        currentUserId={user.id}
        unreadByFriend={unreadByFriend}
        onClose={() => setRailOpen(false)}
      />
      <div className="webapp-scrim" onClick={() => setRailOpen(false)} />

      <main className="webapp-main">
        <button className="webapp-rail-toggle" onClick={() => setRailOpen(true)} aria-label="Conversations">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <OrbHome me={me} friends={friends} unreadByFriend={unreadByFriend} />
      </main>
    </div>
  )
}
