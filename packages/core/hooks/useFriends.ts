import { useEffect, useState, useCallback, useMemo } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

interface FriendshipRow {
  id: string
  user_id: string    // requester
  friend_id: string  // receiver
  status: 'pending' | 'accepted'
}

export function useFriends(supabase: SupabaseClient, currentUserId: string) {
  const [rows, setRows] = useState<FriendshipRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('friendships')
      .select('id, user_id, friend_id, status')
      .or(`user_id.eq.${currentUserId},friend_id.eq.${currentUserId}`)

    if (data) setRows(data as FriendshipRow[])
    setLoading(false)
  }, [supabase, currentUserId])

  useEffect(() => {
    fetch()

    // Real-time: re-fetch on any change involving current user
    const channel = supabase
      .channel(`friendships:${currentUserId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'friendships',
        filter: `friend_id=eq.${currentUserId}`,
      }, fetch)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'friendships',
        filter: `user_id=eq.${currentUserId}`,
      }, fetch)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetch, supabase, currentUserId])

  // Accepted mutual friends
  const friendIds = useMemo(() =>
    new Set(
      rows
        .filter(r => r.status === 'accepted')
        .map(r => r.user_id === currentUserId ? r.friend_id : r.user_id)
    ), [rows, currentUserId])

  // Requests I sent, still pending
  const pendingOutgoing = useMemo(() =>
    new Set(
      rows
        .filter(r => r.user_id === currentUserId && r.status === 'pending')
        .map(r => r.friend_id)
    ), [rows, currentUserId])

  // Requests others sent to me, still pending (array of requester IDs)
  const pendingIncoming = useMemo(() =>
    rows
      .filter(r => r.friend_id === currentUserId && r.status === 'pending')
      .map(r => r.user_id)
    , [rows, currentUserId])

  const addFriend = useCallback(async (friendId: string) => {
    await supabase.from('friendships').insert({
      user_id: currentUserId, friend_id: friendId, status: 'pending',
    })
    await fetch()
  }, [supabase, currentUserId, fetch])

  const acceptFriend = useCallback(async (requesterId: string) => {
    await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('user_id', requesterId)
      .eq('friend_id', currentUserId)
    await fetch()
  }, [supabase, currentUserId, fetch])

  const declineFriend = useCallback(async (requesterId: string) => {
    await supabase
      .from('friendships')
      .delete()
      .eq('user_id', requesterId)
      .eq('friend_id', currentUserId)
    await fetch()
  }, [supabase, currentUserId, fetch])

  const removeFriend = useCallback(async (otherId: string) => {
    await supabase
      .from('friendships')
      .delete()
      .or(
        `and(user_id.eq.${currentUserId},friend_id.eq.${otherId}),` +
        `and(user_id.eq.${otherId},friend_id.eq.${currentUserId})`
      )
    await fetch()
  }, [supabase, currentUserId, fetch])

  const cancelRequest = useCallback(async (friendId: string) => {
    await supabase
      .from('friendships')
      .delete()
      .eq('user_id', currentUserId)
      .eq('friend_id', friendId)
    await fetch()
  }, [supabase, currentUserId, fetch])

  return {
    friendIds,
    pendingOutgoing,
    pendingIncoming,
    loading,
    addFriend,
    acceptFriend,
    declineFriend,
    removeFriend,
    cancelRequest,
    refetch: fetch,
  }
}
