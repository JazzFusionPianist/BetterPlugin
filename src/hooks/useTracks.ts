import { useEffect, useState, useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface Track {
  id: string
  user_id: string
  title: string
  artist: string | null
  version: string | null
  date: string | null
  description: string | null
  audio_url: string
  cover_url: string | null
  created_at: string
}

export function useTracks(supabase: SupabaseClient, userId: string) {
  const [tracks, setTracks] = useState<Track[]>([])

  const fetchTracks = useCallback(async () => {
    const { data } = await supabase
      .from('tracks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (data) setTracks(data)
  }, [supabase, userId])

  useEffect(() => {
    fetchTracks()
    const ch = supabase
      .channel(`tracks:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tracks', filter: `user_id=eq.${userId}` }, fetchTracks)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [fetchTracks, supabase, userId])

  const addTrack = useCallback(async (
    audioFile: File,
    meta: { title: string; artist?: string; version?: string; date?: string; description?: string },
    coverFile?: File
  ) => {
    const ts = Date.now()
    const ext = audioFile.name.split('.').pop() || 'mp3'
    const audioPath = `${userId}/audio-${ts}.${ext}`
    const { error: audioErr } = await supabase.storage
      .from('tracks')
      .upload(audioPath, audioFile, { contentType: audioFile.type })
    if (audioErr) throw audioErr

    const { data: audioPub } = supabase.storage.from('tracks').getPublicUrl(audioPath)

    let coverUrl: string | null = null
    if (coverFile) {
      const coverExt = coverFile.name.split('.').pop() || 'png'
      const coverPath = `${userId}/cover-${ts}.${coverExt}`
      const { error: coverErr } = await supabase.storage
        .from('tracks')
        .upload(coverPath, coverFile, { contentType: coverFile.type })
      if (coverErr) throw coverErr
      const { data: coverPub } = supabase.storage.from('tracks').getPublicUrl(coverPath)
      coverUrl = coverPub.publicUrl
    }

    const { error: dbErr } = await supabase.from('tracks').insert({
      user_id: userId,
      title: meta.title,
      artist: meta.artist || null,
      version: meta.version || null,
      date: meta.date || null,
      description: meta.description || null,
      audio_url: audioPub.publicUrl,
      cover_url: coverUrl,
    })
    if (dbErr) throw dbErr
    await fetchTracks()
  }, [supabase, userId, fetchTracks])

  const deleteTrack = useCallback(async (trackId: string) => {
    await supabase.from('tracks').delete().eq('id', trackId)
    await fetchTracks()
  }, [supabase, fetchTracks])

  const updateTrack = useCallback(async (
    trackId: string,
    patch: { title?: string; artist?: string; version?: string; date?: string | null; description?: string | null }
  ) => {
    const { error } = await supabase.from('tracks').update(patch).eq('id', trackId)
    if (error) throw error
    await fetchTracks()
  }, [supabase, fetchTracks])

  return { tracks, addTrack, updateTrack, deleteTrack, refetch: fetchTracks }
}
