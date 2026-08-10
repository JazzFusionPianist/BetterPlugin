'use client'

/**
 * Artist portfolio data — releases (with ordered tracks) and the photo
 * gallery. Owner-writable; mutual friends read (RLS). Fetched on open,
 * no realtime — a portfolio changes at the pace of a discography.
 */

import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface ReleaseTrack {
  id: string
  release_id: string
  idx: number
  title: string
  media_url: string
}

export interface Release {
  id: string
  user_id: string
  title: string
  cover_url: string | null
  artist: string | null
  description: string | null
  released_on: string | null
  shelf_id: string | null
  position: number
  created_at: string
  tracks: ReleaseTrack[]
}

export interface Shelf {
  id: string
  user_id: string
  title: string
  position: number
  created_at: string
}

export interface GalleryPhoto {
  id: string
  user_id: string
  media_url: string
  caption: string | null
  created_at: string
}

/** A shelf group — the unnamed default shelf carries shelf null. */
export interface ShelfGroup {
  shelf: Shelf | null
  releases: Release[]
}

export function groupByShelf(releases: Release[], shelves: Shelf[]): ShelfGroup[] {
  const groups: ShelfGroup[] = []
  const defaultReleases = releases.filter((r) => !r.shelf_id)
  if (defaultReleases.length > 0 || shelves.length === 0) {
    groups.push({ shelf: null, releases: defaultReleases })
  }
  for (const s of shelves) {
    groups.push({ shelf: s, releases: releases.filter((r) => r.shelf_id === s.id) })
  }
  return groups
}

/** Spine tint when a release has no cover — deterministic per title. */
const SPINE_TINTS = ['#1A1917', '#2440FF', '#B8552F', '#4C5B3F', '#8B7355', '#5B4C6E']
export const spineTint = (title: string) =>
  SPINE_TINTS[[...title].reduce((a, c) => a + c.charCodeAt(0), 0) % SPINE_TINTS.length]!

export function usePortfolio(supabase: SupabaseClient, ownerId: string) {
  const [releases, setReleases] = useState<Release[]>([])
  const [shelves, setShelves] = useState<Shelf[]>([])
  const [photos, setPhotos] = useState<GalleryPhoto[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    const [rel, tr, ph, sh] = await Promise.all([
      supabase.from('releases').select('*').eq('user_id', ownerId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: false }),
      supabase.from('release_tracks')
        .select('*, releases!inner(user_id)')
        .eq('releases.user_id', ownerId)
        .order('idx', { ascending: true }),
      supabase.from('gallery_photos').select('*').eq('user_id', ownerId)
        .order('created_at', { ascending: false }),
      supabase.from('shelves').select('*').eq('user_id', ownerId)
        .order('position', { ascending: true }),
    ])
    if (!rel.error && rel.data) {
      const tracksByRelease = new Map<string, ReleaseTrack[]>()
      for (const t of ((tr.data ?? []) as unknown as ReleaseTrack[])) {
        const arr = tracksByRelease.get(t.release_id) ?? []
        arr.push(t)
        tracksByRelease.set(t.release_id, arr)
      }
      setReleases((rel.data as Omit<Release, 'tracks'>[]).map((r) => ({
        ...r,
        tracks: tracksByRelease.get(r.id) ?? [],
      })))
    }
    if (!ph.error && ph.data) setPhotos(ph.data as GalleryPhoto[])
    if (!sh.error && sh.data) setShelves(sh.data as Shelf[])
    setLoading(false)
  }, [supabase, ownerId])

  useEffect(() => {
    setLoading(true)
    refetch()
  }, [refetch])

  const addRelease = useCallback(async (input: {
    title: string
    cover_url?: string | null
    artist?: string | null
    description?: string | null
    released_on?: string | null
    shelf_id?: string | null
    tracks: { title: string; media_url: string }[]
  }): Promise<boolean> => {
    const nextPos = releases.reduce((m, r) => Math.max(m, r.position + 1), 0)
    const { data, error } = await supabase.from('releases').insert({
      user_id: ownerId,
      title: input.title,
      cover_url: input.cover_url ?? null,
      artist: input.artist ?? null,
      description: input.description ?? null,
      released_on: input.released_on ?? null,
      shelf_id: input.shelf_id ?? null,
      position: nextPos,
    }).select('id').single()
    if (error || !data) { console.error('[portfolio] addRelease', error); return false }
    if (input.tracks.length > 0) {
      const { error: tErr } = await supabase.from('release_tracks').insert(
        input.tracks.map((t, i) => ({ release_id: data.id, idx: i, title: t.title, media_url: t.media_url })),
      )
      if (tErr) console.error('[portfolio] addTracks', tErr)
    }
    await refetch()
    return true
  }, [supabase, ownerId, releases, refetch])

  /** Swap this release with its neighbour ON THE SAME SHELF — the
   *  artist's own sequencing. Positions are global; swapping the two
   *  rows' values reorders them relative to each other. */
  const moveRelease = useCallback(async (id: string, dir: 'up' | 'down') => {
    const me = releases.find((r) => r.id === id)
    if (!me) return
    const group = releases.filter((r) => (r.shelf_id ?? null) === (me.shelf_id ?? null))
    const gIdx = group.findIndex((r) => r.id === id)
    const other = group[gIdx + (dir === 'up' ? -1 : 1)]
    if (!other) return
    const idx = releases.findIndex((r) => r.id === me.id)
    // Optimistic swap so the row moves under the finger.
    setReleases((prev) => {
      const next = prev.map((r) =>
        r.id === me.id ? { ...r, position: other.position }
        : r.id === other.id ? { ...r, position: me.position }
        : r)
      next.sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
      return next
    })
    void idx
    await Promise.all([
      supabase.from('releases').update({ position: other.position }).eq('id', me.id),
      supabase.from('releases').update({ position: me.position }).eq('id', other.id),
    ])
    await refetch()
  }, [supabase, releases, refetch])

  const updateRelease = useCallback(async (id: string, patch: Partial<Pick<Release, 'title' | 'artist' | 'description' | 'released_on' | 'cover_url'>>) => {
    const { error } = await supabase.from('releases').update(patch).eq('id', id)
    if (error) console.error('[portfolio] updateRelease', error)
    await refetch()
  }, [supabase, refetch])

  const deleteRelease = useCallback(async (id: string) => {
    const { error } = await supabase.from('releases').delete().eq('id', id)
    if (error) console.error('[portfolio] deleteRelease', error)
    await refetch()
  }, [supabase, refetch])

  const addPhotos = useCallback(async (items: { media_url: string; caption?: string | null }[]) => {
    const { error } = await supabase.from('gallery_photos').insert(
      items.map((p) => ({ user_id: ownerId, media_url: p.media_url, caption: p.caption ?? null })),
    )
    if (error) console.error('[portfolio] addPhotos', error)
    await refetch()
  }, [supabase, ownerId, refetch])

  const updatePhoto = useCallback(async (id: string, caption: string | null) => {
    const { error } = await supabase.from('gallery_photos').update({ caption }).eq('id', id)
    if (error) console.error('[portfolio] updatePhoto', error)
    await refetch()
  }, [supabase, refetch])

  const deletePhoto = useCallback(async (id: string) => {
    const { error } = await supabase.from('gallery_photos').delete().eq('id', id)
    if (error) console.error('[portfolio] deletePhoto', error)
    await refetch()
  }, [supabase, refetch])

  const addShelf = useCallback(async (title: string): Promise<boolean> => {
    const t = title.trim()
    if (!t) return false
    const nextPos = shelves.reduce((m, x) => Math.max(m, x.position + 1), 0)
    const { error } = await supabase.from('shelves').insert({ user_id: ownerId, title: t, position: nextPos })
    if (error) { console.error('[portfolio] addShelf', error); return false }
    await refetch()
    return true
  }, [supabase, ownerId, shelves, refetch])

  /** Commit a full hand-arranged order for one shelf's releases —
   *  ids in the desired order get sequential positions. */
  const reorderShelf = useCallback(async (ids: string[]) => {
    setReleases((prev) => {
      const next = prev.map((r) => {
        const i = ids.indexOf(r.id)
        return i >= 0 ? { ...r, position: i } : r
      })
      next.sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
      return next
    })
    const updates = ids
      .map((id, i) => ({ id, i, r: releases.find((x) => x.id === id) }))
      .filter(({ r, i }) => r && r.position !== i)
      .map(({ id, i }) => supabase.from('releases').update({ position: i }).eq('id', id))
    if (updates.length) await Promise.all(updates)
    await refetch()
  }, [supabase, releases, refetch])

  /** Renaming the unnamed default shelf materialises it: a real shelf
   *  is created with the new name (in front of the others) and every
   *  loose release moves onto it. */
  const nameDefaultShelf = useCallback(async (title: string) => {
    const t = title.trim()
    if (!t) return
    const frontPos = shelves.reduce((m, x) => Math.min(m, x.position), 0) - 1
    const { data, error } = await supabase.from('shelves')
      .insert({ user_id: ownerId, title: t, position: frontPos })
      .select('id').single()
    if (error || !data) { console.error('[portfolio] nameDefaultShelf', error); return }
    const { error: mvErr } = await supabase.from('releases')
      .update({ shelf_id: data.id })
      .eq('user_id', ownerId)
      .is('shelf_id', null)
    if (mvErr) console.error('[portfolio] nameDefaultShelf move', mvErr)
    await refetch()
  }, [supabase, ownerId, shelves, refetch])

  const renameShelf = useCallback(async (id: string, title: string) => {
    const t = title.trim()
    if (!t) return
    const { error } = await supabase.from('shelves').update({ title: t }).eq('id', id)
    if (error) console.error('[portfolio] renameShelf', error)
    await refetch()
  }, [supabase, refetch])

  /** Deleting a shelf keeps its releases — they fall back to the
   *  unnamed default shelf (shelf_id null via FK on delete set null). */
  const deleteShelf = useCallback(async (id: string) => {
    const { error } = await supabase.from('shelves').delete().eq('id', id)
    if (error) console.error('[portfolio] deleteShelf', error)
    await refetch()
  }, [supabase, refetch])

  return { releases, shelves, photos, loading, addRelease, moveRelease, updateRelease, deleteRelease, addShelf, reorderShelf, nameDefaultShelf, renameShelf, deleteShelf, addPhotos, updatePhoto, deletePhoto, refetch }
}
