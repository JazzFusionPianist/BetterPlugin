import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

/** One "played <part> on <work>" line. `status` is the admin's verdict —
 *  owners see all of theirs, everyone else only 'approved' (RLS). */
export interface Credit {
  id: string
  user_id: string
  work: string
  artist: string | null
  part: string
  year: number | null
  link: string | null
  status: 'pending' | 'approved' | 'rejected'
  note: string | null
  position: number
  created_at: string
}

export type NewCredit = Pick<Credit, 'work' | 'part'> & Partial<Pick<Credit, 'artist' | 'year' | 'link'>>

/** Credits for one profile (mine or a friend's). Refetches after every
 *  write — the trigger may have re-queued a line, so the row that comes
 *  back is the truth. */
export function useCredits(supabase: SupabaseClient, ownerId: string | null) {
  const [credits, setCredits] = useState<Credit[]>([])
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    if (!ownerId) { setCredits([]); setLoaded(true); return }
    const { data, error } = await supabase
      .from('profile_credits')
      .select('*')
      .eq('user_id', ownerId)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) { console.error('[credits] fetch', error.message); setLoaded(true); return }
    setCredits((data ?? []) as Credit[])
    setLoaded(true)
  }, [supabase, ownerId])

  useEffect(() => { setLoaded(false); void refresh() }, [refresh])

  const add = useCallback(async (c: NewCredit): Promise<string | null> => {
    if (!ownerId) return 'no owner'
    const position = credits.length > 0 ? Math.max(...credits.map(x => x.position)) + 1 : 0
    const { error } = await supabase.from('profile_credits').insert({
      user_id: ownerId,
      work: c.work.trim(),
      artist: c.artist?.trim() || null,
      part: c.part.trim(),
      year: c.year ?? null,
      link: c.link?.trim() || null,
      position,
    })
    if (error) { console.error('[credits] add', error.message); return error.message }
    await refresh()
    return null
  }, [supabase, ownerId, credits, refresh])

  const update = useCallback(async (id: string, patch: Partial<NewCredit>): Promise<string | null> => {
    const { error } = await supabase.from('profile_credits').update({
      ...(patch.work !== undefined ? { work: patch.work.trim() } : {}),
      ...(patch.artist !== undefined ? { artist: patch.artist?.trim() || null } : {}),
      ...(patch.part !== undefined ? { part: patch.part.trim() } : {}),
      ...(patch.year !== undefined ? { year: patch.year ?? null } : {}),
      ...(patch.link !== undefined ? { link: patch.link?.trim() || null } : {}),
    }).eq('id', id)
    if (error) { console.error('[credits] update', error.message); return error.message }
    await refresh()
    return null
  }, [supabase, refresh])

  const remove = useCallback(async (id: string): Promise<string | null> => {
    setCredits(prev => prev.filter(c => c.id !== id))
    const { error } = await supabase.from('profile_credits').delete().eq('id', id)
    if (error) { console.error('[credits] remove', error.message); await refresh(); return error.message }
    return null
  }, [supabase, refresh])

  return { credits, loaded, refresh, add, update, remove }
}
