'use client'

/**
 * Open call — the public demo stream. Every signed-in member reads the
 * whole pool (first genuinely public surface in the app); rows are
 * owner-written. Fresh-first, realtime on new tracks, comments fetched
 * per track when a row unfolds.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getInitials } from '@orb/core'
import { uploadAttachment } from '@/lib/upload'
import { readAudioMeta, type AudioMeta } from '@/lib/audioPeaks'

/** Slim uploader card — enough for a byline (initials derived, never selected). */
export interface TrackAuthor {
  id: string
  display_name: string
  username: string
  avatar_color: string
  avatar_url: string | null
  initials: string
}

export interface DemoTrack {
  id: string
  user_id: string
  title: string
  caption: string | null
  audio_url: string
  duration: number | null
  peaks: number[] | null
  plays: number
  created_at: string
  author: TrackAuthor | null
}

export interface TrackComment {
  id: string
  track_id: string
  user_id: string
  at_seconds: number | null
  body: string
  created_at: string
  author: TrackAuthor | null
}

const AUTHOR_COLS = 'id, display_name, username, avatar_color, avatar_url'

type AuthorRow = Omit<TrackAuthor, 'initials'>
const toAuthor = (p: AuthorRow): TrackAuthor => ({
  ...p,
  initials: getInitials(p.display_name || '?'),
})

export function useOpenCall(supabase: SupabaseClient, currentUserId: string) {
  const [tracks, setTracks] = useState<DemoTrack[]>([])
  const [loading, setLoading] = useState(true)
  // Author cards accumulate across fetches so realtime rows resolve fast.
  const authorsRef = useRef<Map<string, TrackAuthor>>(new Map())
  const bumpedRef = useRef<Set<string>>(new Set())

  const resolveAuthors = useCallback(async (ids: string[]) => {
    const missing = [...new Set(ids)].filter((id) => !authorsRef.current.has(id))
    if (missing.length > 0) {
      const { data } = await supabase.from('profiles').select(AUTHOR_COLS).in('id', missing)
      for (const p of (data ?? []) as AuthorRow[]) authorsRef.current.set(p.id, toAuthor(p))
    }
    return authorsRef.current
  }, [supabase])

  const refetch = useCallback(async () => {
    const { data, error } = await supabase
      .from('demo_tracks')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error || !data) { setLoading(false); return }
    const rows = data as Omit<DemoTrack, 'author'>[]
    const authors = await resolveAuthors(rows.map((r) => r.user_id))
    setTracks(rows.map((r) => ({ ...r, author: authors.get(r.user_id) ?? null })))
    setLoading(false)
  }, [supabase, resolveAuthors])

  useEffect(() => { refetch() }, [refetch])

  // New tracks drift in live — anyone posting shows up without a refresh.
  useEffect(() => {
    const ch = supabase
      .channel('open-call')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'demo_tracks' }, async (payload) => {
        const row = payload.new as Omit<DemoTrack, 'author'>
        const authors = await resolveAuthors([row.user_id])
        setTracks((prev) => prev.some((t) => t.id === row.id)
          ? prev
          : [{ ...row, author: authors.get(row.user_id) ?? null }, ...prev])
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'demo_tracks' }, (payload) => {
        const gone = (payload.old as { id?: string }).id
        if (gone) setTracks((prev) => prev.filter((t) => t.id !== gone))
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [supabase, resolveAuthors])

  /** Decode → upload → insert. Progress: 0..0.15 reading, 0.15..0.95 upload.
   *  Pass `meta` when the composer already decoded the file (skips a
   *  second multi-second decode on long bounces); undefined = decode here. */
  const post = useCallback(async (
    file: File,
    title: string,
    caption: string,
    onProgress?: (ratio: number) => void,
    meta?: AudioMeta | null,
  ) => {
    onProgress?.(0.02)
    if (meta === undefined) meta = await readAudioMeta(file)
    onProgress?.(0.15)
    const att = await uploadAttachment(file, currentUserId, (r) => onProgress?.(0.15 + r * 0.8))
    const { data, error } = await supabase
      .from('demo_tracks')
      .insert({
        user_id: currentUserId,
        title: title.trim(),
        caption: caption.trim() || null,
        audio_url: att.url,
        duration: meta?.duration ?? null,
        peaks: meta?.peaks ?? null,
      })
      .select('*')
      .single()
    if (error) throw error
    onProgress?.(1)
    // Realtime dedupes by id, but prepend optimistically for the poster.
    const authors = await resolveAuthors([currentUserId])
    const mine = { ...(data as Omit<DemoTrack, 'author'>), author: authors.get(currentUserId) ?? null }
    setTracks((prev) => prev.some((t) => t.id === mine.id) ? prev : [mine, ...prev])
    return mine
  }, [supabase, currentUserId, resolveAuthors])

  const deleteTrack = useCallback(async (id: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== id))
    await supabase.from('demo_tracks').delete().eq('id', id)
  }, [supabase])

  /** Once per track per session — fire-and-forget. */
  const bumpPlays = useCallback((id: string) => {
    if (bumpedRef.current.has(id)) return
    bumpedRef.current.add(id)
    setTracks((prev) => prev.map((t) => t.id === id ? { ...t, plays: t.plays + 1 } : t))
    supabase.rpc('bump_plays', { track: id }).then(({ error }) => {
      if (error) console.error('[open-call] bump_plays:', error)
    })
  }, [supabase])

  const fetchComments = useCallback(async (trackId: string): Promise<TrackComment[]> => {
    const { data, error } = await supabase
      .from('track_comments')
      .select('*')
      .eq('track_id', trackId)
      .order('created_at', { ascending: true })
    if (error || !data) return []
    const rows = data as Omit<TrackComment, 'author'>[]
    const authors = await resolveAuthors(rows.map((r) => r.user_id))
    return rows.map((r) => ({ ...r, author: authors.get(r.user_id) ?? null }))
  }, [supabase, resolveAuthors])

  const addComment = useCallback(async (
    trackId: string,
    body: string,
    atSeconds: number | null,
  ): Promise<TrackComment | null> => {
    const { data, error } = await supabase
      .from('track_comments')
      .insert({ track_id: trackId, user_id: currentUserId, body: body.trim(), at_seconds: atSeconds })
      .select('*')
      .single()
    if (error || !data) return null
    const authors = await resolveAuthors([currentUserId])
    return { ...(data as Omit<TrackComment, 'author'>), author: authors.get(currentUserId) ?? null }
  }, [supabase, currentUserId, resolveAuthors])

  const deleteComment = useCallback(async (id: string) => {
    await supabase.from('track_comments').delete().eq('id', id)
  }, [supabase])

  return { tracks, loading, refetch, post, deleteTrack, bumpPlays, fetchComments, addComment, deleteComment }
}
