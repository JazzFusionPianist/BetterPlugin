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
    // 내가 팔로우한 경우 + 나를 팔로우한 경우만 각각 구독 (전체 follows 이벤트 X)
    const chOut = supabase
      .channel(`follows_out:${currentUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'follows', filter: `follower_id=eq.${currentUserId}` }, fetchAll)
      .subscribe()
    const chIn = supabase
      .channel(`follows_in:${currentUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'follows', filter: `following_id=eq.${currentUserId}` }, fetchAll)
      .subscribe()
    return () => { supabase.removeChannel(chOut); supabase.removeChannel(chIn) }
  }, [fetchAll, supabase, currentUserId])

  // 서로 팔로우한 경우만 친구 목록에 표시
  const mutualIds = useMemo(
    () => new Set([...followingIds].filter(id => followerIds.has(id))),
    [followingIds, followerIds]
  )

  const follow = useCallback(async (targetId: string) => {
    await supabase.from('follows').insert({ follower_id: currentUserId, following_id: targetId })
    // 중복 알림 방지: 기존 follow 알림이 없을 때만 insert
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', targetId)
      .eq('actor_id', currentUserId)
      .eq('type', 'follow')
      .maybeSingle()
    if (!existing) {
      await supabase.from('notifications').insert({ user_id: targetId, actor_id: currentUserId, type: 'follow' })
    }
    await fetchAll()
  }, [supabase, currentUserId, fetchAll])

  const unfollow = useCallback(async (targetId: string) => {
    await supabase.from('follows').delete()
      .eq('follower_id', currentUserId).eq('following_id', targetId)
    await fetchAll()
  }, [supabase, currentUserId, fetchAll])

  return { followingIds, followerIds, mutualIds, follow, unfollow }
}
