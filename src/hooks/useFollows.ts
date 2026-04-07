import { useEffect, useState, useCallback, useMemo } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

export function useFollows(supabase: SupabaseClient, currentUserId: string) {
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())
  const [followerIds, setFollowerIds]   = useState<Set<string>>(new Set())

  const fetchAll = useCallback(async () => {
    const [{ data: following }, { data: followers }] = await Promise.all([
      supabase.from('follows').select('following_id').eq('follower_id', currentUserId),
      supabase.from('follows').select('follower_id').eq('following_id', currentUserId),
    ])
    setFollowingIds(new Set((following ?? []).map((r: { following_id: string }) => r.following_id)))
    setFollowerIds(new Set((followers ?? []).map((r: { follower_id: string }) => r.follower_id)))
  }, [supabase, currentUserId])

  useEffect(() => {
    fetchAll()
    const channel = supabase
      .channel(`follows:${currentUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'follows' }, fetchAll)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchAll, supabase, currentUserId])

  // 서로 팔로우한 경우만 친구 목록에 표시
  const mutualIds = useMemo(
    () => new Set([...followingIds].filter(id => followerIds.has(id))),
    [followingIds, followerIds]
  )

  const follow = useCallback(async (targetId: string) => {
    await supabase.from('follows').insert({ follower_id: currentUserId, following_id: targetId })
    // 팔로우 알림 전송
    await supabase.from('notifications').insert({ user_id: targetId, actor_id: currentUserId, type: 'follow' })
    await fetchAll()
  }, [supabase, currentUserId, fetchAll])

  const unfollow = useCallback(async (targetId: string) => {
    await supabase.from('follows').delete()
      .eq('follower_id', currentUserId).eq('following_id', targetId)
    await fetchAll()
  }, [supabase, currentUserId, fetchAll])

  return { followingIds, followerIds, mutualIds, follow, unfollow }
}
