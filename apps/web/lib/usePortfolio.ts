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
  description: string | null
  released_on: string | null
  created_at: string
  tracks: ReleaseTrack[]
}

export interface GalleryPhoto {
  id: string
  user_id: string
  media_url: string
  caption: string | null
  created_at: string
}

export function usePortfolio(supabase: SupabaseClient, ownerId: string) {
  const [releases, setReleases] = useState<Release[]>([])
  const [photos, setPhotos] = useState<GalleryPhoto[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    const [rel, tr, ph] = await Promise.all([
      supabase.from('releases').select('*').eq('user_id', ownerId)
        .order('released_on', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false }),
      supabase.from('release_tracks')
        .select('*, releases!inner(user_id)')
        .eq('releases.user_id', ownerId)
        .order('idx', { ascending: true }),
      supabase.from('gallery_photos').select('*').eq('user_id', ownerId)
        .order('created_at', { ascending: false }),
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
    setLoading(false)
  }, [supabase, ownerId])

  useEffect(() => {
    setLoading(true)
    refetch()
  }, [refetch])

  const addRelease = useCallback(async (input: {
    title: string
    cover_url?: string | null
    description?: string | null
    released_on?: string | null
    tracks: { title: string; media_url: string }[]
  }): Promise<boolean> => {
    const { data, error } = await supabase.from('releases').insert({
      user_id: ownerId,
      title: input.title,
      cover_url: input.cover_url ?? null,
      description: input.description ?? null,
      released_on: input.released_on ?? null,
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
  }, [supabase, ownerId, refetch])

  const updateRelease = useCallback(async (id: string, patch: Partial<Pick<Release, 'title' | 'description' | 'released_on' | 'cover_url'>>) => {
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

  return { releases, photos, loading, addRelease, updateRelease, deleteRelease, addPhotos, updatePhoto, deletePhoto, refetch }
}
