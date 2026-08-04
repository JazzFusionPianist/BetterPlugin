import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getInitials } from '../types/collab'

/** The slice of a profile the alert card needs — kept local so the hook
 *  stays self-contained (it resolves actors itself; the caller's loaded
 *  profile pool may not include a brand-new follower yet). */
export interface FollowAlertActor {
  id: string
  display_name: string
  initials: string
  avatar_color: string
  avatar_url: string | null
  username: string | null
}

export interface FollowAlert {
  /** notifications row id — stable key + what dismiss() marks read. */
  id: string
  actorId: string
  /** null while the profile row is missing (deleted account etc.). */
  actor: FollowAlertActor | null
}

/**
 * Unread "someone followed you" alerts, backed by the notifications
 * table (useFollows.follow() has always written a type='follow' row for
 * the target — this hook is the first consumer). Because the rows
 * persist with a `read` flag, follows that happen while you're offline
 * greet you on the next launch; realtime keeps the stack live while
 * you're in the app.
 *
 * dismiss(id) marks the row read (optimistically local-first). Follow
 * back is the caller's job via useFollows.follow() — after it succeeds,
 * dismiss the alert.
 */
export function useFollowAlerts(supabase: SupabaseClient, currentUserId: string) {
  const [alerts, setAlerts] = useState<FollowAlert[]>([])
  // Optimistically-dismissed ids — a refetch racing the read=true write
  // must not resurrect the card.
  const dismissedRef = useRef<Set<string>>(new Set())

  const refetch = useCallback(async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, actor_id')
      .eq('user_id', currentUserId)
      .eq('type', 'follow')
      .eq('read', false)
      .limit(20)
    if (error || !data) return
    const rows = (data as { id: string; actor_id: string }[])
      .filter((r) => r.actor_id && !dismissedRef.current.has(r.id))
    const actorIds = [...new Set(rows.map((r) => r.actor_id))]
    const profileById = new Map<string, FollowAlertActor>()
    if (actorIds.length > 0) {
      // NOTE: `initials` is NOT a profiles column — it's always derived
      // client-side (see useProfiles). Selecting it made PostgREST reject
      // the whole query, so every actor came back null → "?" cards.
      const { data: profs, error: profErr } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_color, avatar_url, username')
        .in('id', actorIds)
      if (profErr) console.error('[useFollowAlerts] profiles fetch:', profErr)
      for (const p of (profs ?? []) as Omit<FollowAlertActor, 'initials'>[]) {
        profileById.set(p.id, { ...p, initials: getInitials(p.display_name || '?') })
      }
    }
    setAlerts(rows.map((r) => ({ id: r.id, actorId: r.actor_id, actor: profileById.get(r.actor_id) ?? null })))
  }, [supabase, currentUserId])

  useEffect(() => {
    refetch()
    // Two triggers on purpose: the notifications INSERT is the real
    // signal; the follows INSERT is a belt-and-suspenders fallback in
    // case notifications is missing from the realtime publication.
    // follow() writes the follows row BEFORE the notification, so the
    // fallback refetches twice — immediately and after the notification
    // has had time to land.
    let retry: ReturnType<typeof setTimeout> | null = null
    const ch = supabase
      .channel(`follow_alerts:${currentUserId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUserId}` }, refetch)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'follows', filter: `following_id=eq.${currentUserId}` }, () => {
        refetch()
        if (retry) clearTimeout(retry)
        retry = setTimeout(refetch, 1500)
      })
      .subscribe()
    return () => {
      if (retry) clearTimeout(retry)
      supabase.removeChannel(ch)
    }
  }, [supabase, currentUserId, refetch])

  const dismiss = useCallback(async (id: string) => {
    dismissedRef.current.add(id)
    setAlerts((prev) => prev.filter((a) => a.id !== id))
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('user_id', currentUserId)
  }, [supabase, currentUserId])

  return { alerts, dismiss, refetch }
}
