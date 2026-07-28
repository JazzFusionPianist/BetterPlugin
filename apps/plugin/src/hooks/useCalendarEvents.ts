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
  category: string | null
  category_color: string | null
  conversation_id: string | null   // set => shared with that group
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
  category?: string | null
  category_color?: string | null
  conversation_id?: string | null
}

export function useCalendarEvents(supabase: SupabaseClient, userId: string) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!userId) return
    // No user_id filter — RLS returns my events AND shared group events from
    // conversations I belong to.
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .order('starts_at', { ascending: true })
    if (!error && data) setEvents(data as CalendarEvent[])
    setLoading(false)
  }, [supabase, userId])

  useEffect(() => {
    refetch()
    if (!userId) return
    // Listen to every calendar_events change (no filter) and refetch — RLS
    // gates the refetch, so group events authored by others land too.
    const channel = supabase
      .channel(`calendar:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_events' },
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
        category: e.category ?? null,
        category_color: e.category_color ?? null,
        conversation_id: e.conversation_id ?? null,
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

  /** Patch fields on one event (re-categorize, rename, reschedule, notes…).
   *  Author-only via RLS. */
  const updateEvent = useCallback(
    async (id: string, patch: Partial<Pick<CalendarEvent,
      'category' | 'category_color' | 'title' | 'location' | 'notes' | 'starts_at' | 'ends_at' | 'all_day'>>) => {
      setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))
      const { error } = await supabase.from('calendar_events').update(patch).eq('id', id)
      if (error) { refetch(); throw error }
    },
    [supabase, refetch],
  )

  return { events, loading, addEvents, deleteEvent, updateEvent, refetch }
}
