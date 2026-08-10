import { useState, useEffect, useCallback, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { OrbPartyRoom } from '../types/collab'
import { initialPartyState, type PartyState } from '../lib/orbParty'

/**
 * Orb Party room — one jsonb `state` blob on the room row, advanced by
 * whichever client owns the current turn (the host's client plays the
 * bots). Everyone else just renders realtime updates.
 */
export function useOrbPartyRoom(supabase: SupabaseClient, currentUserId: string) {
  const [room, setRoom] = useState<OrbPartyRoom | null>(null)
  const [loading, setLoading] = useState(false)
  const roomRef = useRef(room)
  useEffect(() => { roomRef.current = room }, [room])

  useEffect(() => {
    if (!room) return
    const ch = supabase
      .channel(`orb_party_room:${room.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orb_party_rooms', filter: `id=eq.${room.id}` },
        payload => setRoom(payload.new as OrbPartyRoom)
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [room?.id, supabase])

  const createRoom = useCallback(
    async (playerCount: 2 | 3 | 4 = 4): Promise<OrbPartyRoom | null> => {
      setLoading(true)
      const { data, error } = await supabase
        .from('orb_party_rooms')
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
        console.error('[useOrbPartyRoom.createRoom]', error)
        return null
      }
      setRoom(data as OrbPartyRoom)
      return data as OrbPartyRoom
    },
    [supabase, currentUserId]
  )

  const joinRoom = useCallback(
    async (roomId: string): Promise<OrbPartyRoom | null> => {
      const { data: existing, error: fetchErr } = await supabase
        .from('orb_party_rooms')
        .select('*')
        .eq('id', roomId)
        .maybeSingle()
      if (fetchErr || !existing) return null
      const ex = existing as OrbPartyRoom
      if (ex.player_ids.includes(currentUserId)) {
        setRoom(ex)
        return ex
      }
      if (ex.status !== 'lobby') return null
      if (ex.player_ids.length >= ex.player_count) return null
      const { data, error } = await supabase
        .from('orb_party_rooms')
        .update({ player_ids: [...ex.player_ids, currentUserId] })
        .eq('id', roomId)
        .select()
        .single()
      if (error || !data) return null
      setRoom(data as OrbPartyRoom)
      return data as OrbPartyRoom
    },
    [supabase, currentUserId]
  )

  const leaveRoom = useCallback(() => { setRoom(null) }, [])

  const deleteCurrentRoom = useCallback(async (): Promise<void> => {
    if (!roomRef.current) return
    await supabase.from('orb_party_rooms').delete().eq('id', roomRef.current.id)
    setRoom(null)
  }, [supabase])

  const findActiveRoom = useCallback(async (): Promise<OrbPartyRoom | null> => {
    const { data, error } = await supabase
      .from('orb_party_rooms')
      .select('*')
      .contains('player_ids', [currentUserId])
      .eq('status', 'playing')
      .order('updated_at', { ascending: false })
      .limit(5)
    if (error) return null
    const active = ((data as OrbPartyRoom[] | null) ?? [])
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
    await supabase.from('orb_party_rooms').update({ ready_ids: newReady }).eq('id', r.id)
  }, [supabase, currentUserId])

  /** Host locks the lobby and deals the opening state. */
  const startGame = useCallback(async (targetRoom?: OrbPartyRoom): Promise<void> => {
    const r = targetRoom ?? roomRef.current
    if (!r || r.host_id !== currentUserId) return
    const ids = r.player_ids
    if (ids.length < 2) return
    const state: PartyState = initialPartyState(ids)
    const next = {
      status: 'playing' as const,
      player_count: ids.length as 2 | 3 | 4,
      player_ids: ids,
      ready_ids: [],
      winner_id: null,
      state,
    }
    const { error } = await supabase.from('orb_party_rooms').update(next).eq('id', r.id)
    if (error) console.error('[useOrbPartyRoom.startGame]', error)
    setRoom({ ...r, ...next })
  }, [supabase, currentUserId])

  /** Write a full replacement game state (turn owner / host-for-bots only). */
  const writeState = useCallback(async (state: PartyState): Promise<void> => {
    const r = roomRef.current
    if (!r) return
    setRoom(prev => (prev ? { ...prev, state } : prev))
    const { error } = await supabase.from('orb_party_rooms').update({ state }).eq('id', r.id)
    if (error) console.error('[useOrbPartyRoom.writeState]', error)
  }, [supabase])

  const endGame = useCallback(async (winnerId: string | null, state?: PartyState): Promise<void> => {
    const r = roomRef.current
    if (!r) return
    const patch: Record<string, unknown> = { status: 'finished', winner_id: winnerId }
    if (state) patch.state = state
    setRoom(prev => (prev ? { ...prev, ...patch } as OrbPartyRoom : prev))
    const { error } = await supabase.from('orb_party_rooms').update(patch).eq('id', r.id)
    if (error) console.error('[useOrbPartyRoom.endGame]', error)
  }, [supabase])

  const inviteFriend = useCallback(
    async (friendId: string, roomId: string): Promise<void> => {
      await supabase.from('notifications').insert({
        user_id: friendId,
        actor_id: currentUserId,
        type: 'game_invite',
        read: false,
        metadata: { room_id: roomId, game_type: 'orb_party' },
      })
      const { sendGameInviteMessage } = await import('../lib/gameRooms')
      sendGameInviteMessage(supabase, currentUserId, friendId, roomId, 'orb_party')
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
      const { deleteGameInviteMessage } = await import('../lib/gameRooms')
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
