/**
 * Personal calendar events for the signed-in user. Loads the user's rows,
 * exposes add/delete helpers, and stays live via a realtime subscription
 * (RLS gates everything to the owner).
 */

import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface CalendarEvent {
  id: string
  user_id: string
  title: string
  starts_at: string          // ISO timestamptz
  ends_at: string | null
  all_day: boolean
  location: string | null
  notes: string | null
  source: string
  created_at: string
}

/** Shape inserted into the DB — id/created_at are server-assigned. */
export interface NewCalendarEvent {
  title: string
  starts_at: string
  ends_at?: string | null
  all_day?: boolean
  location?: string | null
  notes?: string | null
  source?: string
}

export function useCalendarEvents(supabase: SupabaseClient, userId: string) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId)
      .order('starts_at', { ascending: true })
    if (!error && data) setEvents(data as CalendarEvent[])
    setLoading(false)
  }, [supabase, userId])

  useEffect(() => {
    refetch()
    if (!userId) return
    const channel = supabase
      .channel(`calendar:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_events', filter: `user_id=eq.${userId}` },
        () => refetch(),
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, userId, refetch])

  /** Insert one or more events. Returns the inserted rows. */
  const addEvents = useCallback(
    async (items: NewCalendarEvent[]): Promise<CalendarEvent[]> => {
      if (!userId || items.length === 0) return []
      const rows = items.map((e) => ({
        user_id: userId,
        title: e.title,
        starts_at: e.starts_at,
        ends_at: e.ends_at ?? null,
        all_day: e.all_day ?? false,
        location: e.location ?? null,
        notes: e.notes ?? null,
        source: e.source ?? 'manual',
      }))
      const { data, error } = await supabase.from('calendar_events').insert(rows).select('*')
      if (error) throw error
      const inserted = (data ?? []) as CalendarEvent[]
      // Optimistic: realtime will reconcile, but update now for snappiness.
      setEvents((prev) =>
        [...prev, ...inserted].sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
      )
      return inserted
    },
    [supabase, userId],
  )

  const deleteEvent = useCallback(
    async (id: string) => {
      setEvents((prev) => prev.filter((e) => e.id !== id))
      const { error } = await supabase.from('calendar_events').delete().eq('id', id)
      if (error) { refetch(); throw error }
    },
    [supabase, refetch],
  )

  return { events, loading, addEvents, deleteEvent, refetch }
}
