import { useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

// World leaderboard for pinball. One row per user (personal best) in
// `pinball_scores` — top N is the ranking, rank = 1 + players above you.

export interface PinballLeaderRow {
  user_id: string
  best_score: number
  updated_at: string
  display_name: string
  username: string | null
}

export interface PinballStanding {
  top: PinballLeaderRow[]
  myBest: number
  myRank: number | null
  totalPlayers: number
  isNewBest: boolean
}

interface ScoreRow {
  user_id: string
  best_score: number
  plays: number
  updated_at: string
  profiles?: { display_name: string | null; username: string | null } | null
}

async function fetchStanding(
  supabase: SupabaseClient,
  myBest: number,
  isNewBest: boolean,
): Promise<PinballStanding> {
  const [topRes, rankRes, totalRes] = await Promise.all([
    supabase
      .from('pinball_scores')
      .select('user_id, best_score, updated_at, profiles(display_name, username)')
      .order('best_score', { ascending: false })
      .limit(10),
    supabase
      .from('pinball_scores')
      .select('user_id', { count: 'exact', head: true })
      .gt('best_score', myBest),
    supabase
      .from('pinball_scores')
      .select('user_id', { count: 'exact', head: true }),
  ])

  const top: PinballLeaderRow[] = ((topRes.data ?? []) as unknown as ScoreRow[]).map(r => ({
    user_id: r.user_id,
    best_score: r.best_score,
    updated_at: r.updated_at,
    display_name: r.profiles?.display_name ?? 'player',
    username: r.profiles?.username ?? null,
  }))

  return {
    top,
    myBest,
    myRank: rankRes.count != null ? rankRes.count + 1 : null,
    totalPlayers: totalRes.count ?? top.length,
    isNewBest,
  }
}

export function usePinballScores(supabase: SupabaseClient, currentUserId: string) {
  /** Record a finished game and return the fresh world standing. */
  const submitScore = useCallback(
    async (score: number): Promise<PinballStanding | null> => {
      try {
        const { data: existing } = await supabase
          .from('pinball_scores')
          .select('user_id, best_score, plays')
          .eq('user_id', currentUserId)
          .maybeSingle()

        const prevBest = (existing as ScoreRow | null)?.best_score ?? 0
        const isNewBest = score > prevBest
        const best = Math.max(score, prevBest)

        const { error } = await supabase.from('pinball_scores').upsert(
          {
            user_id: currentUserId,
            best_score: best,
            plays: ((existing as ScoreRow | null)?.plays ?? 0) + 1,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        if (error) console.error('[usePinballScores.submitScore]', error)

        return await fetchStanding(supabase, best, isNewBest)
      } catch (e) {
        console.error('[usePinballScores.submitScore]', e)
        return null
      }
    },
    [supabase, currentUserId]
  )

  /** Read-only standing (start screen). */
  const loadStanding = useCallback(async (): Promise<PinballStanding | null> => {
    try {
      const { data: mine } = await supabase
        .from('pinball_scores')
        .select('best_score')
        .eq('user_id', currentUserId)
        .maybeSingle()
      const myBest = (mine as { best_score: number } | null)?.best_score ?? 0
      return await fetchStanding(supabase, myBest, false)
    } catch (e) {
      console.error('[usePinballScores.loadStanding]', e)
      return null
    }
  }, [supabase, currentUserId])

  return { submitScore, loadStanding }
}
