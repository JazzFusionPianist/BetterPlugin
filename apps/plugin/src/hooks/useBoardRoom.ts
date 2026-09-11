import { useState, useEffect, useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { BoardRoom, BoardGameType } from '../types/collab'

/** Room lifecycle for the grid board games (connect4 / gomoku / reversi).
 *  A one-table port of useGameRoom (chess): same create / join / ready /
 *  move / end / invite grammar, parameterised by game type so the three
 *  games share board_rooms without seeing each other's rooms. */

function isResumableRoom(room: BoardRoom, currentUserId: string): boolean {
  if (room.status === 'finished') return false
  if (room.guest_id) return true
  return room.host_id === currentUserId && room.computer && room.status === 'playing'
}

export function useBoardRoom(supabase: SupabaseClient, currentUserId: string, gameType: BoardGameType) {
  const [room, setRoom] = useState<BoardRoom | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!room) return
    const channel = supabase
      .channel(`board_room:${room.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'board_rooms',
        filter: `id=eq.${room.id}`,
      }, payload => setRoom(payload.new as BoardRoom))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [room?.id, supabase])

  const createRoom = useCallback(async (): Promise<BoardRoom | null> => {
    setLoading(true)
    const { data, error } = await supabase
      .from('board_rooms')
      .insert({ game_type: gameType, host_id: currentUserId, status: 'lobby' })
      .select()
      .single()
    setLoading(false)
    if (error || !data) { console.error('[useBoardRoom.createRoom]', error); return null }
    setRoom(data as BoardRoom)
    return data as BoardRoom
  }, [supabase, currentUserId, gameType])

  const joinRoom = useCallback(async (roomId: string): Promise<BoardRoom | null> => {
    const { data: existing } = await supabase
      .from('board_rooms')
      .select('*')
      .eq('id', roomId)
      .eq('game_type', gameType)
      .maybeSingle()
    if (!existing) return null
    const e = existing as BoardRoom
    if (e.host_id === currentUserId || e.guest_id === currentUserId) {
      setRoom(e)
      return e
    }
    if (e.status !== 'lobby') return null
    const { data, error } = await supabase
      .from('board_rooms')
      .update({ guest_id: currentUserId })
      .eq('id', roomId)
      .is('guest_id', null)
      .select()
      .maybeSingle()
    if (error || !data) return null
    setRoom(data as BoardRoom)
    return data as BoardRoom
  }, [supabase, currentUserId, gameType])

  /** Start (or restart) a game on a fresh board. `computer` marks a solo
   *  game against the built-in opponent. Returns the fresh row. */
  const startGame = useCallback(async (
    board: (string | null)[][],
    opts: { firstPlayer?: 'host' | 'guest'; computer?: boolean } = {},
  ): Promise<BoardRoom | null> => {
    if (!room) return null
    const first = opts.firstPlayer ?? 'host'
    const { data, error } = await supabase.from('board_rooms').update({
      status: 'playing',
      board,
      turn: first,
      first_player: first,
      computer: opts.computer ?? false,
      winner_id: null,
      last_move: null,
      move_count: 0,
      host_ready: false,
      guest_ready: false,
    }).eq('id', room.id).select().single()
    if (error || !data) { console.error('[useBoardRoom.startGame]', error); return null }
    setRoom(data as BoardRoom)
    return data as BoardRoom
  }, [supabase, room])

  const toggleReady = useCallback(async (): Promise<void> => {
    if (!room) return
    const isHost = currentUserId === room.host_id
    const field = isHost ? 'host_ready' : 'guest_ready'
    const current = isHost ? room.host_ready : room.guest_ready
    await supabase.from('board_rooms').update({ [field]: !current }).eq('id', room.id)
  }, [supabase, room, currentUserId])

  const makeMove = useCallback(async (updates: Partial<BoardRoom>): Promise<void> => {
    if (!room) return
    await supabase.from('board_rooms').update(updates).eq('id', room.id)
  }, [supabase, room])

  const endGame = useCallback(async (winnerId: string | null, updates: Partial<BoardRoom> = {}): Promise<void> => {
    if (!room) return
    await supabase.from('board_rooms').update({ ...updates, status: 'finished', winner_id: winnerId }).eq('id', room.id)
  }, [supabase, room])

  const inviteFriend = useCallback(async (friendId: string, roomId: string): Promise<void> => {
    const { error } = await supabase.from('notifications').insert({
      user_id: friendId,
      actor_id: currentUserId,
      type: 'game_invite',
      read: false,
      metadata: { room_id: roomId, game_type: gameType },
    })
    if (error) console.error('[useBoardRoom.inviteFriend]', error)
    const { sendGameInviteMessage } = await import('../lib/gameRooms')
    sendGameInviteMessage(supabase, currentUserId, friendId, roomId, gameType)
  }, [supabase, currentUserId, gameType])

  const cancelInvite = useCallback(async (friendId: string, roomId: string): Promise<void> => {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', friendId)
      .eq('actor_id', currentUserId)
      .eq('type', 'game_invite')
      .eq('metadata->>room_id', roomId)
    if (error) console.error('[useBoardRoom.cancelInvite]', error)
    const { deleteGameInviteMessage } = await import('../lib/gameRooms')
    deleteGameInviteMessage(supabase, currentUserId, friendId, roomId)
  }, [supabase, currentUserId])

  const leaveRoom = useCallback(() => { setRoom(null) }, [])

  const deleteCurrentRoom = useCallback(async (): Promise<void> => {
    if (!room) return
    await supabase.from('board_rooms').delete().eq('id', room.id)
    setRoom(null)
  }, [supabase, room])

  const findActiveRoom = useCallback(async (): Promise<BoardRoom | null> => {
    const { data, error } = await supabase
      .from('board_rooms')
      .select('*')
      .eq('game_type', gameType)
      .or(`host_id.eq.${currentUserId},guest_id.eq.${currentUserId}`)
      .in('status', ['lobby', 'playing'])
      .order('updated_at', { ascending: false })
      .limit(5)
    if (error) { console.error('[useBoardRoom.findActiveRoom]', error); return null }
    const found = ((data as BoardRoom[] | null) ?? []).find(r => isResumableRoom(r, currentUserId)) ?? null
    if (found) setRoom(found)
    return found
  }, [supabase, currentUserId, gameType])

  const setRoomDirect = useCallback((r: BoardRoom | null) => setRoom(r), [])

  return { room, loading, createRoom, joinRoom, startGame, toggleReady, makeMove, endGame, inviteFriend, cancelInvite, leaveRoom, deleteCurrentRoom, findActiveRoom, setRoom: setRoomDirect }
}
