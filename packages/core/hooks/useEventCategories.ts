/**
 * Per-user event category registry. Colors are deterministic from the name
 * (so the same category always gets the same color, and shared events agree),
 * but a user can override a category's color in the registry.
 */

import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface EventCategory {
  id: string
  user_id: string
  name: string
  color: string
  created_at: string
}

// A calm, distinct palette that reads well on the dark UI.
export const CATEGORY_PALETTE = [
  '#5B8DEF', '#E07A5F', '#52B788', '#C77DFF', '#E9B949',
  '#48BFE3', '#F072A1', '#9B8AFB', '#3FC79A', '#FF8A65',
]

/** Stable color for a category name (used when no override exists). */
export function colorForCategory(name: string): string {
  let h = 0
  for (const ch of name.toLowerCase().trim()) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return CATEGORY_PALETTE[h % CATEGORY_PALETTE.length]
}

export function useEventCategories(supabase: SupabaseClient, userId: string) {
  const [categories, setCategories] = useState<EventCategory[]>([])

  const refetch = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('event_categories')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    if (data) setCategories(data as EventCategory[])
  }, [supabase, userId])

  useEffect(() => {
    refetch()
    if (!userId) return
    const channel = supabase
      .channel(`categories:${userId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'event_categories', filter: `user_id=eq.${userId}` },
        () => refetch())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, userId, refetch])

  /** Resolve a category name → color, creating a registry row if new. */
  const ensureCategory = useCallback(
    async (rawName: string | null | undefined): Promise<string | null> => {
      const name = (rawName ?? '').trim()
      if (!name) return null
      const existing = categories.find((c) => c.name.toLowerCase() === name.toLowerCase())
      if (existing) return existing.color
      const color = colorForCategory(name)
      // Best-effort create; ignore unique-violation races (color is stable).
      const { error } = await supabase
        .from('event_categories')
        .insert({ user_id: userId, name, color })
      if (!error) setCategories((prev) =>
        prev.some((c) => c.name.toLowerCase() === name.toLowerCase())
          ? prev
          : [...prev, { id: `tmp-${name}`, user_id: userId, name, color, created_at: new Date(0).toISOString() }])
      return color
    },
    [supabase, userId, categories],
  )

  /** Recolor an existing category (registry + caller updates its events). */
  const recolor = useCallback(
    async (id: string, color: string) => {
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, color } : c)))
      await supabase.from('event_categories').update({ color }).eq('id', id)
    },
    [supabase],
  )

  /** Rename a category everywhere: the registry row, then this user's
   *  events that carry the old name (author-only via RLS). Refuses empty
   *  names and collisions with another existing category. */
  const renameCategory = useCallback(
    async (id: string, rawName: string): Promise<boolean> => {
      const name = rawName.trim()
      const cat = categories.find((c) => c.id === id)
      if (!cat || !name || name === cat.name) return false
      if (categories.some((c) => c.id !== id && c.name.toLowerCase() === name.toLowerCase())) return false
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)))
      const { error } = await supabase.from('event_categories').update({ name }).eq('id', id)
      if (error) { refetch(); return false }
      await supabase
        .from('calendar_events')
        .update({ category: name })
        .eq('user_id', userId)
        .eq('category', cat.name)
      return true
    },
    [supabase, userId, categories, refetch],
  )

  /** Delete a category; its events survive but lose the tag. */
  const deleteCategory = useCallback(
    async (id: string) => {
      const cat = categories.find((c) => c.id === id)
      if (!cat) return
      setCategories((prev) => prev.filter((c) => c.id !== id))
      const { error } = await supabase.from('event_categories').delete().eq('id', id)
      if (error) { refetch(); return }
      await supabase
        .from('calendar_events')
        .update({ category: null, category_color: null })
        .eq('user_id', userId)
        .eq('category', cat.name)
    },
    [supabase, userId, categories, refetch],
  )

  return { categories, ensureCategory, recolor, renameCategory, deleteCategory, refetch }
}
