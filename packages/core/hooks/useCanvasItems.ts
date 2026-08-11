/**
 * Canvas items — the photos (and later videos / drawings) a user pins to
 * their home page like polaroids on a wall. Owner-writable; readable by
 * the owner and, for `friends`-visible items, their mutual-follow friends
 * (enforced by RLS). Positions are stored as fractions of the canvas so
 * they hold across screen sizes.
 */

import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

export type CanvasKind = 'photo' | 'video' | 'drawing'
export type CanvasVisibility = 'friends' | 'private'

/** One coloured-pencil stroke. `p` is a flat list of 0..1 canvas
 *  fractions: [x0, y0, x1, y1, …]. `w` is the pencil width in px.
 *  `o` is opacity (default 0.9 for old strokes); `r` set means raw —
 *  render straight segments with no smoothing (shapes). */
export interface Stroke {
  c: string
  w: number
  p: number[]
  o?: number
  r?: 1
}

export interface CanvasItem {
  id: string
  user_id: string
  kind: CanvasKind
  media_url: string | null
  poster_url: string | null
  title: string | null
  caption: string | null
  taken_at: string | null
  strokes: Stroke[] | null
  x: number
  y: number
  rotation: number
  /** Pinch-resize factor, 1 = as pinned. */
  scale: number
  /** Landscape-page slots (desktop / iPad landscape). Null = not
   *  arranged there yet; clients fall back to the portrait values. */
  lx: number | null
  ly: number | null
  lscale: number | null
  z: number
  visibility: CanvasVisibility
  created_at: string
}

export interface NewCanvasItem {
  kind?: CanvasKind
  media_url?: string | null
  poster_url?: string | null
  title?: string | null
  caption?: string | null
  taken_at?: string | null
  strokes?: Stroke[] | null
  x?: number
  y?: number
  rotation?: number
  scale?: number
  lx?: number | null
  ly?: number | null
  lscale?: number | null
  z?: number
  visibility?: CanvasVisibility
}

export type CanvasPatch = Partial<Pick<CanvasItem,
  'title' | 'caption' | 'x' | 'y' | 'rotation' | 'scale' | 'lx' | 'ly' | 'lscale' | 'z' | 'visibility' | 'taken_at' | 'strokes'>>

/**
 * @param ownerId whose canvas to load. Defaults to the current user;
 *   pass a friend's id to peek at their wall (RLS returns only their
 *   friends-visible items).
 */
export function useCanvasItems(
  supabase: SupabaseClient,
  currentUserId: string,
  ownerId?: string,
) {
  const owner = ownerId ?? currentUserId
  const isMine = owner === currentUserId
  const [items, setItems] = useState<CanvasItem[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!owner) return
    const { data, error } = await supabase
      .from('canvas_items')
      .select('*')
      .eq('user_id', owner)
      .order('z', { ascending: true })
    if (!error && data) setItems(data as CanvasItem[])
    setLoading(false)
  }, [supabase, owner])

  useEffect(() => {
    setLoading(true)
    refetch()
    if (!owner) return
    const channel = supabase
      .channel(`canvas:${owner}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'canvas_items', filter: `user_id=eq.${owner}` },
        () => refetch())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, owner, refetch])

  const addItem = useCallback(
    async (item: NewCanvasItem): Promise<CanvasItem | null> => {
      if (!isMine) return null
      const topZ = items.reduce((m, i) => Math.max(m, i.z), 0)
      const row = {
        user_id: currentUserId,
        kind: item.kind ?? 'photo',
        media_url: item.media_url ?? null,
        poster_url: item.poster_url ?? null,
        title: item.title ?? null,
        caption: item.caption ?? null,
        taken_at: item.taken_at ?? null,
        strokes: item.strokes ?? null,
        x: item.x ?? 0.5,
        y: item.y ?? 0.32,
        rotation: item.rotation ?? 0,
        scale: item.scale ?? 1,
        lx: item.lx ?? null,
        ly: item.ly ?? null,
        lscale: item.lscale ?? null,
        z: item.z ?? topZ + 1,
        visibility: item.visibility ?? 'friends',
      }
      const { data, error } = await supabase.from('canvas_items').insert(row).select('*').single()
      if (error) throw error
      const created = data as CanvasItem
      setItems((prev) => [...prev, created])
      return created
    },
    [supabase, currentUserId, isMine, items],
  )

  const updateItem = useCallback(
    async (id: string, patch: CanvasPatch) => {
      if (!isMine) return
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
      const { error } = await supabase.from('canvas_items').update(patch).eq('id', id)
      if (error) refetch()
    },
    [supabase, isMine, refetch],
  )

  const deleteItem = useCallback(
    async (id: string) => {
      if (!isMine) return
      setItems((prev) => prev.filter((i) => i.id !== id))
      const { error } = await supabase.from('canvas_items').delete().eq('id', id)
      if (error) refetch()
    },
    [supabase, isMine, refetch],
  )

  return { items, loading, isMine, addItem, updateItem, deleteItem, refetch }
}
