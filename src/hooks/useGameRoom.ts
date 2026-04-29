import { useState, useEffect, useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { GameRoom } from '../types/collab'

export function useGameRoom(supabase: SupabaseClient, currentUserId: string) {
  const [room, setRoom] = useState<GameRoom | null>(null)
  const [loading, setLoading] = useState(false)

  // Subscribe to room changes when we have a room
  useEffect(() => {
    if (!room) return
    const channel = supabase
      .channel(`game_room:${room.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'game_rooms',
        filter: `id=eq.${room.id}`,
      }, payload => setRoom(payload.new as GameRoom))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [room?.id, supabase])

  // Also subscribe to incoming game invites (game_rooms where guest_id = currentUserId and status = 'lobby')
  // This is handled via notifications, but we also need to be able to fetch a room by id

  const createRoom = useCallback(async (): Promise<GameRoom | null> => {
    setLoading(true)
    const { data, error } = await supabase
      .from('game_rooms')
      .insert({
        game_type: 'chess',
        host_id: currentUserId,
        status: 'lobby',
        turn: 'white',
        host_color: 'white',
        captured: { white: [], black: [] },
        move_history: [],
        castling: { wK: true, wQ: true, bK: true, bQ: true },
        en_passant: null,
        halfmove: 0,
      })
      .select()
      .single()
    setLoading(false)
    if (error || !data) return null
    setRoom(data as GameRoom)
    return data as GameRoom
  }, [supabase, currentUserId])

  const joinRoom = useCallback(async (roomId: string): Promise<GameRoom | null> => {
    // Fetch the room first
    const { data: existing } = await supabase
      .from('game_rooms')
      .select('*')
      .eq('id', roomId)
      .single()
    if (!existing || existing.status !== 'lobby') return null

    const { data, error } = await supabase
      .from('game_rooms')
      .update({ guest_id: currentUserId })
      .eq('id', roomId)
      .select()
      .single()
    if (error || !data) return null
    setRoom(data as GameRoom)
    return data as GameRoom
  }, [supabase, currentUserId])

  const startGame = useCallback(async (initialBoard: (string|null)[][]): Promise<void> => {
    if (!room) return
    await supabase.from('game_rooms').update({
      status: 'playing',
      board: initialBoard,
      turn: 'white',
    }).eq('id', room.id)
  }, [supabase, room])

  const makeMove = useCallback(async (updates: Partial<GameRoom>): Promise<void> => {
    if (!room) return
    await supabase.from('game_rooms').update({
      ...updates,
      updated_at: new Date().toISOString(),
    }).eq('id', room.id)
  }, [supabase, room])

  const endGame = useCallback(async (winnerId: string | null): Promise<void> => {
    if (!room) return
    await supabase.from('game_rooms').update({
      status: 'finished',
      winner_id: winnerId,
    }).eq('id', room.id)
  }, [supabase, room])

  const inviteFriend = useCallback(async (friendId: string, roomId: string): Promise<void> => {
    const { error } = await supabase.from('notifications').insert({
      user_id: friendId,
      actor_id: currentUserId,
      type: 'game_invite',
      read: false,
      metadata: { room_id: roomId, game_type: 'chess' },
    })
    if (error) console.error('[inviteFriend] insert error:', error)
    else console.log('[inviteFriend] sent to', friendId, 'roomId', roomId)
  }, [supabase, currentUserId])

  const leaveRoom = useCallback(() => {
    setRoom(null)
  }, [])

  const setRoomDirect = useCallback((r: GameRoom | null) => setRoom(r), [])

  return { room, loading, createRoom, joinRoom, startGame, makeMove, endGame, inviteFriend, leaveRoom, setRoom: setRoomDirect }
}
