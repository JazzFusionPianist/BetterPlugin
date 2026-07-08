import { useState, useEffect, useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { FallingBlocksRoom, FallingBlocksPlayerState } from '../types/collab'

const EMPTY_BOARD: (string | null)[][] = Array.from({ length: 20 }, () =>
  Array.from({ length: 10 }, () => null)
)

export function useFallingBlocksRoom(supabase: SupabaseClient, currentUserId: string) {
  const [room, setRoom] = useState<FallingBlocksRoom | null>(null)
  const [playerStates, setPlayerStates] = useState<Map<string, FallingBlocksPlayerState>>(new Map())
  const [loading, setLoading] = useState(false)

  // Initial fetch + realtime subscriptions when room is set
  useEffect(() => {
    if (!room) {
      setPlayerStates(new Map())
      return
    }

    let cancelled = false

    // Initial fetch of all player states for this room
    ;(async () => {
      const { data, error } = await supabase
        .from('falling_blocks_player_states')
        .select('*')
        .eq('room_id', room.id)
      if (cancelled) return
      if (error) {
        console.error('[useFallingBlocksRoom] initial player_states fetch error:', error)
        return
      }
      const next = new Map<string, FallingBlocksPlayerState>()
      for (const row of (data ?? []) as FallingBlocksPlayerState[]) {
        next.set(row.user_id, row)
      }
      setPlayerStates(next)
    })()

    const roomChannel = supabase
      .channel(`falling_blocks_room:${room.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'falling_blocks_rooms',
          filter: `id=eq.${room.id}`,
        },
        payload => setRoom(payload.new as FallingBlocksRoom)
      )
      .subscribe()

    const stateChannel = supabase
      .channel(`falling_blocks_player_states:${room.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'falling_blocks_player_states',
          filter: `room_id=eq.${room.id}`,
        },
        payload => {
          const row = payload.new as FallingBlocksPlayerState
          setPlayerStates(prev => {
            const next = new Map(prev)
            next.set(row.user_id, row)
            return next
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'falling_blocks_player_states',
          filter: `room_id=eq.${room.id}`,
        },
        payload => {
          const row = payload.new as FallingBlocksPlayerState
          setPlayerStates(prev => {
            const next = new Map(prev)
            next.set(row.user_id, row)
            return next
          })
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(roomChannel)
      supabase.removeChannel(stateChannel)
    }
  }, [room?.id, supabase])

  const createRoom = useCallback(
    async (playerCount: 2 | 3 | 4 = 4): Promise<FallingBlocksRoom | null> => {
      setLoading(true)
      const { data, error } = await supabase
        .from('falling_blocks_rooms')
        .insert({
          host_id: currentUserId,
          player_count: playerCount,
          status: 'lobby',
          player_ids: [currentUserId],
          ready_ids: [],
        })
        .select()
        .single()
      setLoading(false)
      if (error || !data) {
        console.error('[useFallingBlocksRoom.createRoom]', error)
        return null
      }
      setRoom(data as FallingBlocksRoom)
      return data as FallingBlocksRoom
    },
    [supabase, currentUserId]
  )

  const joinRoom = useCallback(
    async (roomId: string): Promise<FallingBlocksRoom | null> => {
      const { data: existing, error: fetchErr } = await supabase
        .from('falling_blocks_rooms')
        .select('*')
        .eq('id', roomId)
        .single()
      if (fetchErr || !existing) {
        console.error('[useFallingBlocksRoom.joinRoom] fetch error:', fetchErr)
        return null
      }
      const ex = existing as FallingBlocksRoom
      if (ex.status !== 'lobby') return null
      if (ex.player_ids.length >= ex.player_count && !ex.player_ids.includes(currentUserId)) {
        return null
      }
      if (ex.player_ids.includes(currentUserId)) {
        setRoom(ex)
        return ex
      }
      const newPlayerIds = [...ex.player_ids, currentUserId]
      const { data, error } = await supabase
        .from('falling_blocks_rooms')
        .update({ player_ids: newPlayerIds })
        .eq('id', roomId)
        .select()
        .single()
      if (error || !data) {
        console.error('[useFallingBlocksRoom.joinRoom] update error:', error)
        return null
      }
      setRoom(data as FallingBlocksRoom)
      return data as FallingBlocksRoom
    },
    [supabase, currentUserId]
  )

  const leaveRoom = useCallback(() => {
    setRoom(null)
  }, [])

  const deleteCurrentRoom = useCallback(async (): Promise<void> => {
    if (!room) return
    const { error } = await supabase.from('falling_blocks_rooms').delete().eq('id', room.id)
    if (error) console.error('[useFallingBlocksRoom.deleteCurrentRoom]', error)
    setRoom(null)
  }, [supabase, room])

  const findActiveRoom = useCallback(async (): Promise<FallingBlocksRoom | null> => {
    const { data, error } = await supabase
      .from('falling_blocks_rooms')
      .select('*')
      .contains('player_ids', [currentUserId])
      .eq('status', 'playing')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) {
      console.error('[useFallingBlocksRoom.findActiveRoom]', error)
      return null
    }
    if (data) setRoom(data as FallingBlocksRoom)
    return (data as FallingBlocksRoom | null) ?? null
  }, [supabase, currentUserId])

  const applyPlayerStates = useCallback((rows: FallingBlocksPlayerState[]): void => {
    setPlayerStates(prev => {
      const next = new Map(prev)
      for (const row of rows) next.set(row.user_id, row)
      return next
    })
  }, [])

  const toggleReady = useCallback(async (): Promise<void> => {
    if (!room) return
    const isReady = room.ready_ids.includes(currentUserId)
    const newReadyIds = isReady
      ? room.ready_ids.filter(id => id !== currentUserId)
      : [...room.ready_ids, currentUserId]
    const { error } = await supabase
      .from('falling_blocks_rooms')
      .update({ ready_ids: newReadyIds })
      .eq('id', room.id)
    if (error) console.error('[useFallingBlocksRoom.toggleReady]', error)
  }, [supabase, room, currentUserId])

  const startGame = useCallback(async (targetRoom?: FallingBlocksRoom): Promise<void> => {
    const activeRoom = targetRoom ?? room
    if (!activeRoom) return
    if (activeRoom.host_id !== currentUserId) {
      console.error('[useFallingBlocksRoom.startGame] only host can start')
      return
    }
    const playerIds = activeRoom.player_ids
    if (playerIds.length < 2) {
      console.error('[useFallingBlocksRoom.startGame] not enough players')
      return
    }
    if (!playerIds.every(id => activeRoom.ready_ids.includes(id))) {
      console.error('[useFallingBlocksRoom.startGame] not all players ready')
      return
    }
    const playerCount = playerIds.length as 2 | 3 | 4

    const now = new Date().toISOString()
    const rows = playerIds.map(uid => ({
      room_id: activeRoom.id,
      user_id: uid,
      board: EMPTY_BOARD,
      score: 0,
      lines: 0,
      top_out: false,
      garbage_pending: 0,
      updated_at: now,
    }))

    setPlayerStates(new Map(rows.map(row => [row.user_id, row as FallingBlocksPlayerState])))

    const { error: insertErr } = await supabase
      .from('falling_blocks_player_states')
      .upsert(rows, { onConflict: 'room_id,user_id' })
    if (insertErr) {
      console.error('[useFallingBlocksRoom.startGame] insert player_states:', insertErr)
    }

    const { error: updateErr } = await supabase
      .from('falling_blocks_rooms')
      .update({ status: 'playing', player_count: playerCount, player_ids: playerIds, ready_ids: [] })
      .eq('id', activeRoom.id)
    if (updateErr) console.error('[useFallingBlocksRoom.startGame] update room:', updateErr)
    setRoom({
      ...activeRoom,
      status: 'playing',
      player_count: playerCount,
      player_ids: playerIds,
      ready_ids: [],
    })
  }, [supabase, room, currentUserId])

  const endGame = useCallback(
    async (winnerId: string | null): Promise<void> => {
      if (!room) return
      const { error } = await supabase
        .from('falling_blocks_rooms')
        .update({ status: 'finished', winner_id: winnerId })
        .eq('id', room.id)
      if (error) console.error('[useFallingBlocksRoom.endGame]', error)
      setRoom({
        ...room,
        status: 'finished',
        winner_id: winnerId,
      })
    },
    [supabase, room]
  )

  const inviteFriend = useCallback(
    async (friendId: string, roomId: string): Promise<void> => {
      const { error } = await supabase.from('notifications').insert({
        user_id: friendId,
        actor_id: currentUserId,
        type: 'game_invite',
        read: false,
        metadata: { room_id: roomId, game_type: 'falling_blocks' },
      })
      if (error) console.error('[useFallingBlocksRoom.inviteFriend]', error)
      const { sendGameInviteMessage } = await import('../lib/gameRooms')
      sendGameInviteMessage(supabase, currentUserId, friendId, roomId, 'falling_blocks')
    },
    [supabase, currentUserId]
  )

  const cancelInvite = useCallback(
    async (friendId: string, roomId: string): Promise<void> => {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', friendId)
        .eq('actor_id', currentUserId)
        .eq('type', 'game_invite')
        .eq('metadata->>room_id', roomId)
      if (error) console.error('[useFallingBlocksRoom.cancelInvite]', error)
      const { deleteGameInviteMessage } = await import('../lib/gameRooms')
      deleteGameInviteMessage(supabase, currentUserId, friendId, roomId)
    },
    [supabase, currentUserId]
  )

  const updateMyState = useCallback(
    async (updates: Partial<FallingBlocksPlayerState>): Promise<void> => {
      if (!room) return
      const existing = playerStates.get(currentUserId)
      const merged: FallingBlocksPlayerState = {
        room_id: room.id,
        user_id: currentUserId,
        board: existing?.board ?? EMPTY_BOARD,
        score: existing?.score ?? 0,
        lines: existing?.lines ?? 0,
        top_out: existing?.top_out ?? false,
        garbage_pending: existing?.garbage_pending ?? 0,
        ...updates,
        updated_at: new Date().toISOString(),
      }
      const { error } = await supabase
        .from('falling_blocks_player_states')
        .upsert(merged, { onConflict: 'room_id,user_id' })
      if (error) console.error('[useFallingBlocksRoom.updateMyState]', error)
    },
    [supabase, room, currentUserId, playerStates]
  )

  const sendGarbage = useCallback(
    async (toUserId: string, lines: number): Promise<void> => {
      if (!room) return
      // Fetch current garbage_pending, then update.
      const { data, error: fetchErr } = await supabase
        .from('falling_blocks_player_states')
        .select('garbage_pending')
        .eq('room_id', room.id)
        .eq('user_id', toUserId)
        .single()
      if (fetchErr || !data) {
        console.error('[useFallingBlocksRoom.sendGarbage] fetch error:', fetchErr)
        return
      }
      const newPending = (data.garbage_pending ?? 0) + lines
      const { error } = await supabase
        .from('falling_blocks_player_states')
        .update({
          garbage_pending: newPending,
          updated_at: new Date().toISOString(),
        })
        .eq('room_id', room.id)
        .eq('user_id', toUserId)
      if (error) console.error('[useFallingBlocksRoom.sendGarbage] update error:', error)
    },
    [supabase, room]
  )

  const setPlayerTopOut = useCallback(
    async (userId: string, topOut: boolean): Promise<void> => {
      if (!room) return
      setPlayerStates(prev => {
        const next = new Map(prev)
        const existing = next.get(userId)
        next.set(userId, {
          room_id: room.id,
          user_id: userId,
          board: existing?.board ?? EMPTY_BOARD,
          score: existing?.score ?? 0,
          lines: existing?.lines ?? 0,
          top_out: topOut,
          garbage_pending: existing?.garbage_pending ?? 0,
          updated_at: new Date().toISOString(),
        })
        return next
      })
      const { error } = await supabase
        .from('falling_blocks_player_states')
        .update({
          top_out: topOut,
          updated_at: new Date().toISOString(),
        })
        .eq('room_id', room.id)
        .eq('user_id', userId)
      if (error) console.error('[useFallingBlocksRoom.setPlayerTopOut]', error)
    },
    [supabase, room]
  )

  return {
    room,
    playerStates,
    applyPlayerStates,
    loading,
    createRoom,
    joinRoom,
    leaveRoom,
    deleteCurrentRoom,
    findActiveRoom,
    toggleReady,
    startGame,
    endGame,
    inviteFriend,
    cancelInvite,
    updateMyState,
    sendGarbage,
    setPlayerTopOut,
  }
}
