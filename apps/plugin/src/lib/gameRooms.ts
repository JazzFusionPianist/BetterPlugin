import type { SupabaseClient } from '@supabase/supabase-js'
import { getOrCreateDmConversation } from './conversations'

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
 * Post a `game_invite` chat message into the DM between `senderId`
 * and `recipientId`. Used by each game's `inviteFriend` hook so the
 * invite also shows up as a tappable bubble in the conversation, not
 * just the notifications panel.
 *
 * Resolves the DM conversation (creating it if needed) and inserts
 * the row directly — we don't go through useMessages because the
 * caller usually isn't sitting in the DM and the optimistic UI path
 * doesn't apply.
 */
export async function sendGameInviteMessage (
  supabase: SupabaseClient,
  senderId: string,
  recipientId: string,
  roomId: string,
  gameType: GameType,
): Promise<void> {
  try {
    const conversationId = await getOrCreateDmConversation(supabase, senderId, recipientId)
    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: '',
      attachment_type: 'game_invite',
      attachment_url: roomId,
      attachment_name: gameType,
    })
    if (error) console.warn('[sendGameInviteMessage] insert failed', error)
  } catch (e) {
    console.warn('[sendGameInviteMessage] failed', e)
  }
}

/**
 * Find a game the user is currently mid-match in (status='playing')
 * across all four game tables. Returns the most recently active one
 * so the toolbar's Games button can drop the user back into the
 * lobby they wandered off from instead of the picker.
 *
 * The query fans out in parallel — typical round-trip is one Supabase
 * RPC's worth of latency. Returns null if the user isn't in any live
 * game.
 */
export async function findActiveGame (
  supabase: SupabaseClient,
  userId: string,
): Promise<{ gameType: GameType; roomId: string; updatedAt: string } | null> {
  const [chess, fb, poker, et] = await Promise.all([
    supabase.from('game_rooms')
      .select('id, updated_at')
      .or(`host_id.eq.${userId},guest_id.eq.${userId}`)
      .eq('status', 'playing')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('falling_blocks_rooms')
      .select('id, updated_at')
      .contains('player_ids', [userId])
      .eq('status', 'playing')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('poker_rooms')
      .select('id, updated_at')
      .contains('player_ids', [userId])
      .eq('status', 'playing')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('ear_training_rooms')
      .select('id, updated_at')
      .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
      .eq('status', 'playing')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const candidates: { gameType: GameType; roomId: string; updatedAt: string }[] = []
  if (chess.data) candidates.push({ gameType: 'chess', roomId: chess.data.id, updatedAt: chess.data.updated_at })
  if (fb.data)    candidates.push({ gameType: 'falling_blocks', roomId: fb.data.id, updatedAt: fb.data.updated_at })
  if (poker.data) candidates.push({ gameType: 'poker', roomId: poker.data.id, updatedAt: poker.data.updated_at })
  if (et.data)    candidates.push({ gameType: 'ear_training', roomId: et.data.id, updatedAt: et.data.updated_at })

  if (candidates.length === 0) return null
  candidates.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return candidates[0]
}

/**
 * Counterpart to sendGameInviteMessage — removes the chat bubble when
 * the inviter cancels. We resolve the same DM and delete the row that
 * still carries `attachment_url = roomId`, so a recipient who hasn't
 * clicked Join yet sees the bubble disappear via realtime DELETE.
 *
 * Safe to call when no chat message exists (e.g. the invite was only
 * sent before this feature shipped) — DELETE on an empty match is a
 * no-op.
 */
export async function deleteGameInviteMessage (
  supabase: SupabaseClient,
  senderId: string,
  recipientId: string,
  roomId: string,
): Promise<void> {
  try {
    const conversationId = await getOrCreateDmConversation(supabase, senderId, recipientId)
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('sender_id', senderId)
      .eq('attachment_type', 'game_invite')
      .eq('attachment_url', roomId)
    if (error) console.warn('[deleteGameInviteMessage]', error)
  } catch (e) {
    console.warn('[deleteGameInviteMessage] failed', e)
  }
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
