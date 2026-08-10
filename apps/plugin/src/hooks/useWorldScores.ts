import { useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

// Generic world leaderboard: one row per user (personal best) in a
// `<game>_scores` table. Used by pinball and solo falling blocks.

export type WorldScoreTable = 'pinball_scores' | 'falling_blocks_scores' | 'yacht_scores'

export interface WorldLeaderRow {
  user_id: string
  best_score: number
  updated_at: string
  display_name: string
  username: string | null
}

export interface WorldStanding {
  top: WorldLeaderRow[]
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
  table: WorldScoreTable,
  myBest: number,
  isNewBest: boolean,
): Promise<WorldStanding> {
  const [topRes, rankRes, totalRes] = await Promise.all([
    supabase
      .from(table)
      .select('user_id, best_score, updated_at, profiles(display_name, username)')
      .order('best_score', { ascending: false })
      .limit(10),
    supabase
      .from(table)
      .select('user_id', { count: 'exact', head: true })
      .gt('best_score', myBest),
    supabase
      .from(table)
      .select('user_id', { count: 'exact', head: true }),
  ])

  const top: WorldLeaderRow[] = ((topRes.data ?? []) as unknown as ScoreRow[]).map(r => ({
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

export function useWorldScores(
  supabase: SupabaseClient,
  currentUserId: string,
  table: WorldScoreTable,
) {
  /** Record a finished game and return the fresh world standing. */
  const submitScore = useCallback(
    async (score: number): Promise<WorldStanding | null> => {
      try {
        const { data: existing } = await supabase
          .from(table)
          .select('user_id, best_score, plays')
          .eq('user_id', currentUserId)
          .maybeSingle()

        const prevBest = (existing as ScoreRow | null)?.best_score ?? 0
        const isNewBest = score > prevBest
        const best = Math.max(score, prevBest)

        const { error } = await supabase.from(table).upsert(
          {
            user_id: currentUserId,
            best_score: best,
            plays: ((existing as ScoreRow | null)?.plays ?? 0) + 1,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        if (error) console.error('[useWorldScores.submitScore]', table, error)

        return await fetchStanding(supabase, table, best, isNewBest)
      } catch (e) {
        console.error('[useWorldScores.submitScore]', table, e)
        return null
      }
    },
    [supabase, currentUserId, table]
  )

  /** Read-only standing (start screens). */
  const loadStanding = useCallback(async (): Promise<WorldStanding | null> => {
    try {
      const { data: mine } = await supabase
        .from(table)
        .select('best_score')
        .eq('user_id', currentUserId)
        .maybeSingle()
      const myBest = (mine as { best_score: number } | null)?.best_score ?? 0
      return await fetchStanding(supabase, table, myBest, false)
    } catch (e) {
      console.error('[useWorldScores.loadStanding]', table, e)
      return null
    }
  }, [supabase, currentUserId, table])

  return { submitScore, loadStanding }
}
