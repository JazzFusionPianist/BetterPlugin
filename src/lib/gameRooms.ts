import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Shared helpers for the chat-driven game invite flow.
 *
 * The game UIs (ChessView / PokerView / etc.) each have their own room
 * hooks for normal in-game state, but those hooks are too heavyweight
 * to mount just so the chat can create a fresh room. This module talks
 * straight to the room tables — same schema, just bypassing React state
 * we don't need at the chat layer.
 */

export type GameType = 'chess' | 'falling_blocks' | 'poker' | 'ear_training'

export const GAME_TABLE: Record<GameType, string> = {
  chess:          'game_rooms',
  falling_blocks: 'falling_blocks_rooms',
  poker:          'poker_rooms',
  ear_training:   'ear_training_rooms',
}

// Reasonable defaults when creating a room from a chat invite. The host
// can still tweak in the lobby (poker / falling_blocks) before others
// fill the seats.
const DEFAULT_PLAYER_COUNT: Record<GameType, number> = {
  chess: 2, ear_training: 2, falling_blocks: 2, poker: 2,
}

/** Maximum seats currently configured for a room. Reads the row, then
 *  picks the right column for that game type. Returns null if the room
 *  doesn't exist or the schema is unexpected. */
export async function getRoomCapacity (
  supabase: SupabaseClient,
  gameType: GameType,
  roomId: string,
): Promise<{ capacity: number; occupied: number; alreadyIn: boolean; userIds: string[] } | null> {
  const table = GAME_TABLE[gameType]
  const { data, error } = await supabase.from(table).select('*').eq('id', roomId).maybeSingle()
  if (error || !data) return null

  if (gameType === 'chess') {
    const r = data as { host_id: string; guest_id: string | null }
    return {
      capacity: 2,
      occupied: 1 + (r.guest_id ? 1 : 0),
      alreadyIn: false, // caller checks against currentUserId
      userIds: [r.host_id, ...(r.guest_id ? [r.guest_id] : [])],
    }
  }
  if (gameType === 'ear_training') {
    const r = data as { player1_id: string; player2_id: string | null }
    return {
      capacity: 2,
      occupied: 1 + (r.player2_id ? 1 : 0),
      alreadyIn: false,
      userIds: [r.player1_id, ...(r.player2_id ? [r.player2_id] : [])],
    }
  }
  // poker / falling_blocks
  const r = data as { player_ids: string[]; player_count: number }
  return {
    capacity: r.player_count,
    occupied: r.player_ids.length,
    alreadyIn: false,
    userIds: r.player_ids,
  }
}

/** Create an empty game room with the current user as the host /
 *  player1. Returns the room id, ready to be embedded in a chat invite
 *  bubble. */
export async function createGameRoom (
  supabase: SupabaseClient,
  gameType: GameType,
  userId: string,
): Promise<string | null> {
  const playerCount = DEFAULT_PLAYER_COUNT[gameType]
  if (gameType === 'chess') {
    const { data, error } = await supabase
      .from('game_rooms')
      .insert({
        host_id: userId,
        game_type: 'chess',
        status: 'lobby',
        turn: 'white',
        host_color: 'white',
        captured: { white: [], black: [] },
        move_history: [],
        castling: { wK: true, wQ: true, bK: true, bQ: true },
        en_passant: null,
        halfmove: 0,
        host_ready: false,
        guest_ready: false,
      })
      .select()
      .single()
    if (error) { console.error('[createGameRoom.chess]', error); return null }
    return (data as { id: string }).id
  }
  if (gameType === 'ear_training') {
    const { data, error } = await supabase
      .from('ear_training_rooms')
      .insert({
        player1_id: userId,
        config: { modes: ['interval', 'chord'], difficulty: 'basic' },
      })
      .select()
      .single()
    if (error) { console.error('[createGameRoom.ear_training]', error); return null }
    return (data as { id: string }).id
  }
  if (gameType === 'falling_blocks') {
    const { data, error } = await supabase
      .from('falling_blocks_rooms')
      .insert({
        host_id: userId,
        player_count: playerCount,
        status: 'lobby',
        player_ids: [userId],
        ready_ids: [],
      })
      .select()
      .single()
    if (error) { console.error('[createGameRoom.falling_blocks]', error); return null }
    return (data as { id: string }).id
  }
  // poker
  const { data, error } = await supabase
    .from('poker_rooms')
    .insert({
      host_id: userId,
      player_count: playerCount,
      status: 'lobby',
      player_ids: [userId],
      ready_ids: [],
      state: {},
    })
    .select()
    .single()
  if (error) { console.error('[createGameRoom.poker]', error); return null }
  return (data as { id: string }).id
}

/**
 * Atomically attempt to take a free seat in the room. Returns:
 *   - 'joined'        — the user is now part of the room
 *   - 'already-in'    — the user was already there (idempotent)
 *   - 'full'          — no seats left, caller should show "Room is full"
 *   - 'missing'       — the room no longer exists
 *
 * For the array-based games (poker / falling_blocks), the join is
 * a read-modify-write done client-side; that's racy in theory, but the
 * subsequent capacity check after the next state read will catch
 * over-allocation and the UI can recover by treating the extra player
 * as a spectator. For chess / ear_training the update is conditioned
 * on the guest seat still being NULL, so two concurrent join clicks
 * cannot both win.
 */
export type JoinResult = 'joined' | 'already-in' | 'full' | 'missing'

export async function joinGameRoom (
  supabase: SupabaseClient,
  gameType: GameType,
  roomId: string,
  userId: string,
): Promise<JoinResult> {
  const cap = await getRoomCapacity(supabase, gameType, roomId)
  if (!cap) return 'missing'
  if (cap.userIds.includes(userId)) return 'already-in'
  if (cap.occupied >= cap.capacity) return 'full'

  if (gameType === 'chess') {
    const { data, error } = await supabase
      .from('game_rooms')
      .update({ guest_id: userId })
      .eq('id', roomId)
      .is('guest_id', null)
      .select()
      .maybeSingle()
    if (error || !data) return 'full'
    return 'joined'
  }
  if (gameType === 'ear_training') {
    const { data, error } = await supabase
      .from('ear_training_rooms')
      .update({ player2_id: userId })
      .eq('id', roomId)
      .is('player2_id', null)
      .select()
      .maybeSingle()
    if (error || !data) return 'full'
    return 'joined'
  }
  // poker / falling_blocks — read-modify-write the array.
  const table = GAME_TABLE[gameType]
  const nextIds = [...cap.userIds, userId]
  const { error } = await supabase
    .from(table)
    .update({ player_ids: nextIds })
    .eq('id', roomId)
  if (error) return 'full'
  return 'joined'
}
