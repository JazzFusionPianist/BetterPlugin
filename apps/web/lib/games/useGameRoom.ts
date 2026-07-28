import { useState, useEffect, useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { GameRoom } from '@/lib/games/types'

function isComputerRoom(room: GameRoom): boolean {
  const captured = room.captured as { computer?: boolean } | null | undefined
  return room.status === 'playing' && captured?.computer === true
}

function isResumableRoom(room: GameRoom, currentUserId: string): boolean {
  if (room.status === 'finished') return false
  if (room.guest_id) return true
  return room.host_id === currentUserId && isComputerRoom(room)
}

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
    if (!existing) return null

    const e = existing as GameRoom
    // Existing participants can always re-enter their current room,
    // including an in-progress match they left visually to visit the lobby.
    if (e.host_id === currentUserId || e.guest_id === currentUserId) {
      setRoom(e)
      return e
    }
    if (e.status !== 'lobby') return null

    const { data, error } = await supabase
      .from('game_rooms')
      .update({ guest_id: currentUserId })
      .eq('id', roomId)
      .is('guest_id', null)           // refuse to overwrite a claimed seat
      .select()
      .maybeSingle()
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
      captured: { white: [], black: [] },
      move_history: [],
      castling: { wK: true, wQ: true, bK: true, bQ: true },
      en_passant: null,
      halfmove: 0,
      winner_id: null,
      draw_offered_by: null,
      host_ready: false,
      guest_ready: false,
    }).eq('id', room.id)
  }, [supabase, room])

  const toggleReady = useCallback(async (): Promise<void> => {
    if (!room) return
    const isHost = currentUserId === room.host_id
    const field = isHost ? 'host_ready' : 'guest_ready'
    const current = isHost ? room.host_ready : room.guest_ready
    await supabase.from('game_rooms').update({ [field]: !current }).eq('id', room.id)
  }, [supabase, room, currentUserId])

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
    // Notifications-table row is kept for any downstream consumers
    // (admin reports, push pipelines, etc.) but the user-visible
    // notification flows through the chat now — see sendGameInviteMessage.
    const { error } = await supabase.from('notifications').insert({
      user_id: friendId,
      actor_id: currentUserId,
      type: 'game_invite',
      read: false,
      metadata: { room_id: roomId, game_type: 'chess' },
    })
    if (error) console.error('[inviteFriend] insert error:', error)
    // Mirror the invite into the DM as a chat bubble so the friend
    // can join from the conversation view too, not just the bell.
    const { sendGameInviteMessage } = await import('./gameRooms')
    sendGameInviteMessage(supabase, currentUserId, friendId, roomId, 'chess')
  }, [supabase, currentUserId])

  // Counterpart to inviteFriend. Removes the pending game_invite
  // notification we previously inserted so the recipient stops seeing
  // it (their useFriendEvents picks up the DELETE realtime event).
  // Idempotent: a stale call with no matching row is a no-op.
  const cancelInvite = useCallback(async (friendId: string, roomId: string): Promise<void> => {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', friendId)
      .eq('actor_id', currentUserId)
      .eq('type', 'game_invite')
      .eq('metadata->>room_id', roomId)
    if (error) console.error('[cancelInvite] delete error:', error)
    const { deleteGameInviteMessage } = await import('./gameRooms')
    deleteGameInviteMessage(supabase, currentUserId, friendId, roomId)
  }, [supabase, currentUserId])

  const leaveRoom = useCallback(() => {
    setRoom(null)
  }, [])

  // Delete the current room from Supabase. Used when backing out of a
  // lobby (cancel invite) or a finished game (close instead of rematch).
  const deleteCurrentRoom = useCallback(async (): Promise<void> => {
    if (!room) return
    await supabase.from('game_rooms').delete().eq('id', room.id)
    setRoom(null)
  }, [supabase, room])

  // Find a resumable room where the current user is host or guest.
  // Window/tab close is not a game action, so playing rooms and lobbies with
  // an opponent should be restored. Empty host-only lobbies are invite drafts.
  const findActiveRoom = useCallback(async (): Promise<GameRoom | null> => {
    const { data, error } = await supabase
      .from('game_rooms')
      .select('*')
      .or(`host_id.eq.${currentUserId},guest_id.eq.${currentUserId}`)
      .in('status', ['lobby', 'playing'])
      .order('updated_at', { ascending: false })
      .limit(5)
    if (error) { console.error('[findActiveRoom]', error); return null }
    const room = ((data as GameRoom[] | null) ?? [])
      .find(r => isResumableRoom(r, currentUserId)) ?? null
    if (room) setRoom(room)
    return room
  }, [supabase, currentUserId])

  const setRoomDirect = useCallback((r: GameRoom | null) => setRoom(r), [])

  return { room, loading, createRoom, joinRoom, startGame, makeMove, endGame, inviteFriend, cancelInvite, leaveRoom, deleteCurrentRoom, toggleReady, findActiveRoom, setRoom: setRoomDirect }
}
