import { useEffect, useState, useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

export function useFriends(supabase: SupabaseClient, currentUserId: string) {
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', currentUserId)

    if (data) {
      setFriendIds(new Set(data.map((r: { friend_id: string }) => r.friend_id)))
    }
    setLoading(false)
  }, [supabase, currentUserId])

  useEffect(() => {
    fetch()
  }, [fetch])

  const addFriend = useCallback(async (friendId: string) => {
    await supabase.from('friendships').insert({ user_id: currentUserId, friend_id: friendId })
    setFriendIds(prev => new Set([...prev, friendId]))
  }, [supabase, currentUserId])

  const removeFriend = useCallback(async (friendId: string) => {
    await supabase
      .from('friendships')
      .delete()
      .eq('user_id', currentUserId)
      .eq('friend_id', friendId)
    setFriendIds(prev => {
      const next = new Set(prev)
      next.delete(friendId)
      return next
    })
  }, [supabase, currentUserId])

  return { friendIds, loading, addFriend, removeFriend, refetch: fetch }
}
