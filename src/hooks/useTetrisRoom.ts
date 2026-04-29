import { useState, useEffect, useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { TetrisRoom, TetrisPlayerState } from '../types/collab'

const EMPTY_BOARD: (string | null)[][] = Array.from({ length: 20 }, () =>
  Array.from({ length: 10 }, () => null)
)

export function useTetrisRoom(supabase: SupabaseClient, currentUserId: string) {
  const [room, setRoom] = useState<TetrisRoom | null>(null)
  const [playerStates, setPlayerStates] = useState<Map<string, TetrisPlayerState>>(new Map())
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
        .from('tetris_player_states')
        .select('*')
        .eq('room_id', room.id)
      if (cancelled) return
      if (error) {
        console.error('[useTetrisRoom] initial player_states fetch error:', error)
        return
      }
      const next = new Map<string, TetrisPlayerState>()
      for (const row of (data ?? []) as TetrisPlayerState[]) {
        next.set(row.user_id, row)
      }
      setPlayerStates(next)
    })()

    const roomChannel = supabase
      .channel(`tetris_room:${room.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tetris_rooms',
          filter: `id=eq.${room.id}`,
        },
        payload => setRoom(payload.new as TetrisRoom)
      )
      .subscribe()

    const stateChannel = supabase
      .channel(`tetris_player_states:${room.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tetris_player_states',
          filter: `room_id=eq.${room.id}`,
        },
        payload => {
          const row = payload.new as TetrisPlayerState
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
          table: 'tetris_player_states',
          filter: `room_id=eq.${room.id}`,
        },
        payload => {
          const row = payload.new as TetrisPlayerState
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
    async (playerCount: 2 | 3 | 4): Promise<TetrisRoom | null> => {
      setLoading(true)
      const { data, error } = await supabase
        .from('tetris_rooms')
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
        console.error('[useTetrisRoom.createRoom]', error)
        return null
      }
      setRoom(data as TetrisRoom)
      return data as TetrisRoom
    },
    [supabase, currentUserId]
  )

  const joinRoom = useCallback(
    async (roomId: string): Promise<TetrisRoom | null> => {
      const { data: existing, error: fetchErr } = await supabase
        .from('tetris_rooms')
        .select('*')
        .eq('id', roomId)
        .single()
      if (fetchErr || !existing) {
        console.error('[useTetrisRoom.joinRoom] fetch error:', fetchErr)
        return null
      }
      const ex = existing as TetrisRoom
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
        .from('tetris_rooms')
        .update({ player_ids: newPlayerIds })
        .eq('id', roomId)
        .select()
        .single()
      if (error || !data) {
        console.error('[useTetrisRoom.joinRoom] update error:', error)
        return null
      }
      setRoom(data as TetrisRoom)
      return data as TetrisRoom
    },
    [supabase, currentUserId]
  )

  const leaveRoom = useCallback(() => {
    setRoom(null)
  }, [])

  const deleteCurrentRoom = useCallback(async (): Promise<void> => {
    if (!room) return
    const { error } = await supabase.from('tetris_rooms').delete().eq('id', room.id)
    if (error) console.error('[useTetrisRoom.deleteCurrentRoom]', error)
    setRoom(null)
  }, [supabase, room])

  const findActiveRoom = useCallback(async (): Promise<TetrisRoom | null> => {
    const { data, error } = await supabase
      .from('tetris_rooms')
      .select('*')
      .contains('player_ids', [currentUserId])
      .eq('status', 'playing')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) {
      console.error('[useTetrisRoom.findActiveRoom]', error)
      return null
    }
    if (data) setRoom(data as TetrisRoom)
    return (data as TetrisRoom | null) ?? null
  }, [supabase, currentUserId])

  const toggleReady = useCallback(async (): Promise<void> => {
    if (!room) return
    const isReady = room.ready_ids.includes(currentUserId)
    const newReadyIds = isReady
      ? room.ready_ids.filter(id => id !== currentUserId)
      : [...room.ready_ids, currentUserId]
    const { error } = await supabase
      .from('tetris_rooms')
      .update({ ready_ids: newReadyIds })
      .eq('id', room.id)
    if (error) console.error('[useTetrisRoom.toggleReady]', error)
  }, [supabase, room, currentUserId])

  const startGame = useCallback(async (): Promise<void> => {
    if (!room) return
    if (room.host_id !== currentUserId) {
      console.error('[useTetrisRoom.startGame] only host can start')
      return
    }
    if (room.ready_ids.length !== room.player_count) {
      console.error('[useTetrisRoom.startGame] not all players ready')
      return
    }
    if (room.player_ids.length !== room.player_count) {
      console.error('[useTetrisRoom.startGame] room not full')
      return
    }

    const now = new Date().toISOString()
    const rows = room.player_ids.map(uid => ({
      room_id: room.id,
      user_id: uid,
      board: EMPTY_BOARD,
      score: 0,
      lines: 0,
      top_out: false,
      garbage_pending: 0,
      updated_at: now,
    }))

    const { error: insertErr } = await supabase
      .from('tetris_player_states')
      .upsert(rows, { onConflict: 'room_id,user_id' })
    if (insertErr) {
      console.error('[useTetrisRoom.startGame] insert player_states:', insertErr)
      return
    }

    const { error: updateErr } = await supabase
      .from('tetris_rooms')
      .update({ status: 'playing', ready_ids: [] })
      .eq('id', room.id)
    if (updateErr) console.error('[useTetrisRoom.startGame] update room:', updateErr)
  }, [supabase, room, currentUserId])

  const endGame = useCallback(
    async (winnerId: string | null): Promise<void> => {
      if (!room) return
      const { error } = await supabase
        .from('tetris_rooms')
        .update({ status: 'finished', winner_id: winnerId })
        .eq('id', room.id)
      if (error) console.error('[useTetrisRoom.endGame]', error)
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
        metadata: { room_id: roomId, game_type: 'tetris' },
      })
      if (error) console.error('[useTetrisRoom.inviteFriend]', error)
    },
    [supabase, currentUserId]
  )

  const updateMyState = useCallback(
    async (updates: Partial<TetrisPlayerState>): Promise<void> => {
      if (!room) return
      const existing = playerStates.get(currentUserId)
      const merged: TetrisPlayerState = {
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
        .from('tetris_player_states')
        .upsert(merged, { onConflict: 'room_id,user_id' })
      if (error) console.error('[useTetrisRoom.updateMyState]', error)
    },
    [supabase, room, currentUserId, playerStates]
  )

  const sendGarbage = useCallback(
    async (toUserId: string, lines: number): Promise<void> => {
      if (!room) return
      // Fetch current garbage_pending, then update.
      const { data, error: fetchErr } = await supabase
        .from('tetris_player_states')
        .select('garbage_pending')
        .eq('room_id', room.id)
        .eq('user_id', toUserId)
        .single()
      if (fetchErr || !data) {
        console.error('[useTetrisRoom.sendGarbage] fetch error:', fetchErr)
        return
      }
      const newPending = (data.garbage_pending ?? 0) + lines
      const { error } = await supabase
        .from('tetris_player_states')
        .update({
          garbage_pending: newPending,
          updated_at: new Date().toISOString(),
        })
        .eq('room_id', room.id)
        .eq('user_id', toUserId)
      if (error) console.error('[useTetrisRoom.sendGarbage] update error:', error)
    },
    [supabase, room]
  )

  const setPlayerTopOut = useCallback(
    async (userId: string, topOut: boolean): Promise<void> => {
      if (!room) return
      const { error } = await supabase
        .from('tetris_player_states')
        .update({
          top_out: topOut,
          updated_at: new Date().toISOString(),
        })
        .eq('room_id', room.id)
        .eq('user_id', userId)
      if (error) console.error('[useTetrisRoom.setPlayerTopOut]', error)
    },
    [supabase, room]
  )

  return {
    room,
    playerStates,
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
    updateMyState,
    sendGarbage,
    setPlayerTopOut,
  }
}
