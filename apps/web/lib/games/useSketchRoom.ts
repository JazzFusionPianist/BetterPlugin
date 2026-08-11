import { useState, useEffect, useCallback, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SketchRoom } from '@/lib/games/types'
import { initialSketchState, type SketchState } from '@/lib/games/sketch'

/**
 * Sketch room — one jsonb `state` blob on the room row. The current
 * drawer's client is the single writer for its turn; everyone else
 * renders realtime updates.
 */
export function useSketchRoom(supabase: SupabaseClient, currentUserId: string) {
  const [room, setRoom] = useState<SketchRoom | null>(null)
  const [loading, setLoading] = useState(false)
  const roomRef = useRef(room)
  useEffect(() => { roomRef.current = room }, [room])

  useEffect(() => {
    if (!room) return
    const ch = supabase
      .channel(`sketch_room:${room.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sketch_rooms', filter: `id=eq.${room.id}` },
        payload => setRoom(payload.new as SketchRoom)
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [room?.id, supabase])

  const createRoom = useCallback(
    async (playerCount = 6): Promise<SketchRoom | null> => {
      setLoading(true)
      const { data, error } = await supabase
        .from('sketch_rooms')
        .insert({
          host_id: currentUserId,
          player_count: playerCount,
          status: 'lobby',
          player_ids: [currentUserId],
          ready_ids: [],
          state: {},
        })
        .select()
        .single()
      setLoading(false)
      if (error || !data) {
        console.error('[useSketchRoom.createRoom]', error)
        return null
      }
      setRoom(data as SketchRoom)
      return data as SketchRoom
    },
    [supabase, currentUserId]
  )

  const joinRoom = useCallback(
    async (roomId: string): Promise<SketchRoom | null> => {
      const { data: existing, error: fetchErr } = await supabase
        .from('sketch_rooms')
        .select('*')
        .eq('id', roomId)
        .maybeSingle()
      if (fetchErr || !existing) return null
      const ex = existing as SketchRoom
      if (ex.player_ids.includes(currentUserId)) {
        setRoom(ex)
        return ex
      }
      if (ex.status !== 'lobby') return null
      if (ex.player_ids.length >= ex.player_count) return null
      const { data, error } = await supabase
        .from('sketch_rooms')
        .update({ player_ids: [...ex.player_ids, currentUserId] })
        .eq('id', roomId)
        .select()
        .single()
      if (error || !data) return null
      setRoom(data as SketchRoom)
      return data as SketchRoom
    },
    [supabase, currentUserId]
  )

  const leaveRoom = useCallback(() => { setRoom(null) }, [])

  const deleteCurrentRoom = useCallback(async (): Promise<void> => {
    if (!roomRef.current) return
    await supabase.from('sketch_rooms').delete().eq('id', roomRef.current.id)
    setRoom(null)
  }, [supabase])

  const findActiveRoom = useCallback(async (): Promise<SketchRoom | null> => {
    const { data, error } = await supabase
      .from('sketch_rooms')
      .select('*')
      .contains('player_ids', [currentUserId])
      .eq('status', 'playing')
      .order('updated_at', { ascending: false })
      .limit(5)
    if (error) return null
    const active = ((data as SketchRoom[] | null) ?? [])
      .find(r => Array.isArray(r.player_ids) && r.player_ids.filter(Boolean).length > 1) ?? null
    if (active) setRoom(active)
    return active
  }, [supabase, currentUserId])

  const toggleReady = useCallback(async (): Promise<void> => {
    const r = roomRef.current
    if (!r) return
    const isReady = r.ready_ids.includes(currentUserId)
    const newReady = isReady
      ? r.ready_ids.filter(id => id !== currentUserId)
      : [...r.ready_ids, currentUserId]
    await supabase.from('sketch_rooms').update({ ready_ids: newReady }).eq('id', r.id)
  }, [supabase, currentUserId])

  /** Host locks the lobby and deals the opening state. */
  const startGame = useCallback(async (lang: string): Promise<void> => {
    const r = roomRef.current
    if (!r || r.host_id !== currentUserId) return
    const ids = r.player_ids
    if (ids.length < 2) return
    const state: SketchState = initialSketchState(ids, lang)
    const next = {
      status: 'playing' as const,
      player_count: r.player_count,
      player_ids: ids,
      ready_ids: [],
      winner_id: null,
      state,
    }
    const { error } = await supabase.from('sketch_rooms').update(next).eq('id', r.id)
    if (error) console.error('[useSketchRoom.startGame]', error)
    setRoom({ ...r, ...next })
  }, [supabase, currentUserId])

  const writeState = useCallback(async (state: SketchState): Promise<void> => {
    const r = roomRef.current
    if (!r) return
    setRoom(prev => (prev ? { ...prev, state } : prev))
    const { error } = await supabase.from('sketch_rooms').update({ state }).eq('id', r.id)
    if (error) console.error('[useSketchRoom.writeState]', error)
  }, [supabase])

  const endGame = useCallback(async (winnerId: string | null, state?: SketchState): Promise<void> => {
    const r = roomRef.current
    if (!r) return
    const patch: Record<string, unknown> = { status: 'finished', winner_id: winnerId }
    if (state) patch.state = state
    setRoom(prev => (prev ? { ...prev, ...patch } as SketchRoom : prev))
    const { error } = await supabase.from('sketch_rooms').update(patch).eq('id', r.id)
    if (error) console.error('[useSketchRoom.endGame]', error)
  }, [supabase])

  const inviteFriend = useCallback(
    async (friendId: string, roomId: string): Promise<void> => {
      await supabase.from('notifications').insert({
        user_id: friendId,
        actor_id: currentUserId,
        type: 'game_invite',
        read: false,
        metadata: { room_id: roomId, game_type: 'sketch' },
      })
      const { sendGameInviteMessage } = await import('./gameRooms')
      sendGameInviteMessage(supabase, currentUserId, friendId, roomId, 'sketch')
    },
    [supabase, currentUserId]
  )

  const cancelInvite = useCallback(
    async (friendId: string, roomId: string): Promise<void> => {
      await supabase
        .from('notifications')
        .delete()
        .eq('user_id', friendId)
        .eq('actor_id', currentUserId)
        .eq('type', 'game_invite')
        .eq('metadata->>room_id', roomId)
      const { deleteGameInviteMessage } = await import('./gameRooms')
      deleteGameInviteMessage(supabase, currentUserId, friendId, roomId)
    },
    [supabase, currentUserId]
  )

  return {
    room,
    loading,
    createRoom,
    joinRoom,
    leaveRoom,
    deleteCurrentRoom,
    findActiveRoom,
    toggleReady,
    startGame,
    writeState,
    endGame,
    inviteFriend,
    cancelInvite,
  }
}
