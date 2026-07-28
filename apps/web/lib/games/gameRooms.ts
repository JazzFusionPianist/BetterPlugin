import type { SupabaseClient } from '@supabase/supabase-js'
import { getOrCreateDmConversation } from './conversations'
import { isComputerPlayerId } from './computerPlayers'

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

function hasMultiplePlayers(playerIds: unknown): boolean {
  return Array.isArray(playerIds) && playerIds.filter(Boolean).length > 1
}

function isComputerChessRoom(room: { status: string; host_id?: string | null; captured?: unknown }, userId: string): boolean {
  const captured = room.captured as { computer?: boolean } | null | undefined
  return room.status === 'playing' && room.host_id === userId && captured?.computer === true
}

function isResumableChessRoom(room: { status: string; host_id?: string | null; guest_id?: string | null; captured?: unknown }, userId: string): boolean {
  return !!room.guest_id || isComputerChessRoom(room, userId)
}

function isResumableMultiPlayerRoom(room: { player_ids?: unknown }): boolean {
  return hasMultiplePlayers(room.player_ids)
}

function isResumableEarTrainingRoom(room: { player2_id?: string | null }): boolean {
  return !!room.player2_id || isComputerPlayerId(room.player2_id)
}

export const GAME_TABLE: Record<GameType, string> = {
  chess:          'game_rooms',
  falling_blocks: 'falling_blocks_rooms',
  poker:          'poker_rooms',
  ear_training:   'ear_training_rooms',
}

interface RoomCapacity {
  capacity: number
  occupied: number
  alreadyIn: boolean
  userIds: string[]
  hostId: string
  status: string
}

// Lobby rooms for variable-player games stay open up to their maximum.
// When everyone currently in the lobby readies up, the game start path
// locks `player_count` down to the actual joined player count.
const DEFAULT_PLAYER_COUNT: Record<GameType, number> = {
  chess: 2, ear_training: 2, falling_blocks: 4, poker: 6,
}

/** Maximum seats currently configured for a room. Reads the row, then
 *  picks the right column for that game type. Returns null if the room
 *  doesn't exist or the schema is unexpected. */
export async function getRoomCapacity (
  supabase: SupabaseClient,
  gameType: GameType,
  roomId: string,
): Promise<RoomCapacity | null> {
  const table = GAME_TABLE[gameType]
  const { data, error } = await supabase.from(table).select('*').eq('id', roomId).maybeSingle()
  if (error || !data) return null

  if (gameType === 'chess') {
    const r = data as { host_id: string; guest_id: string | null; status: string }
    return {
      capacity: 2,
      occupied: 1 + (r.guest_id ? 1 : 0),
      alreadyIn: false, // caller checks against currentUserId
      userIds: [r.host_id, ...(r.guest_id ? [r.guest_id] : [])],
      hostId: r.host_id,
      status: r.status,
    }
  }
  if (gameType === 'ear_training') {
    const r = data as { player1_id: string; player2_id: string | null; status: string }
    return {
      capacity: 2,
      occupied: 1 + (r.player2_id ? 1 : 0),
      alreadyIn: false,
      userIds: [r.player1_id, ...(r.player2_id ? [r.player2_id] : [])],
      hostId: r.player1_id,
      status: r.status,
    }
  }
  // poker / falling_blocks
  const r = data as { host_id: string; player_ids: string[]; player_count: number; status: string }
  return {
    capacity: r.player_count,
    occupied: r.player_ids.length,
    alreadyIn: false,
    userIds: r.player_ids,
    hostId: r.host_id,
    status: r.status,
  }
}

async function deleteStaleRoom (
  supabase: SupabaseClient,
  gameType: GameType,
  roomId: string,
): Promise<void> {
  const table = GAME_TABLE[gameType]
  const { error } = await supabase.from(table).delete().eq('id', roomId)
  if (error) console.warn('[deleteStaleRoom]', error)
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
 * Find a game the user is currently in (status='lobby' or 'playing')
 * across all four game tables. Returns the most recently active one
 * so the toolbar's Games button can drop the user back into the
 * lobby they wandered off from instead of the picker.
 *
 * The query fans out in parallel — typical round-trip is one Supabase
 * RPC's worth of latency. Returns null if the user isn't in any live
 * game. Window/tab close is treated as a visual detach, but empty
 * host-only lobbies are invite drafts, not games to auto-resume.
 */
export async function findActiveGame (
  supabase: SupabaseClient,
  userId: string,
): Promise<{ gameType: GameType; roomId: string; updatedAt: string } | null> {
  const [chess, fb, poker, et] = await Promise.all([
    supabase.from('game_rooms')
      .select('id, updated_at, status, host_id, guest_id, captured')
      .or(`host_id.eq.${userId},guest_id.eq.${userId}`)
      .in('status', ['lobby', 'playing'])
      .order('updated_at', { ascending: false })
      .limit(5),
    supabase.from('falling_blocks_rooms')
      .select('id, updated_at, status, player_ids')
      .contains('player_ids', [userId])
      .in('status', ['lobby', 'playing'])
      .order('updated_at', { ascending: false })
      .limit(5),
    supabase.from('poker_rooms')
      .select('id, updated_at, status, player_ids')
      .contains('player_ids', [userId])
      .in('status', ['lobby', 'playing'])
      .order('updated_at', { ascending: false })
      .limit(5),
    supabase.from('ear_training_rooms')
      .select('id, updated_at, status, player2_id')
      .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
      .in('status', ['lobby', 'playing'])
      .order('updated_at', { ascending: false })
      .limit(5),
  ])

  const candidates: { gameType: GameType; roomId: string; updatedAt: string }[] = []
  const chessRoom = chess.data?.find(r => isResumableChessRoom(r, userId))
  const fbRoom = fb.data?.find(isResumableMultiPlayerRoom)
  const pokerRoom = poker.data?.find(isResumableMultiPlayerRoom)
  const etRoom = et.data?.find(isResumableEarTrainingRoom)
  if (chessRoom) candidates.push({ gameType: 'chess', roomId: chessRoom.id, updatedAt: chessRoom.updated_at })
  if (fbRoom)    candidates.push({ gameType: 'falling_blocks', roomId: fbRoom.id, updatedAt: fbRoom.updated_at })
  if (pokerRoom) candidates.push({ gameType: 'poker', roomId: pokerRoom.id, updatedAt: pokerRoom.updated_at })
  if (etRoom)    candidates.push({ gameType: 'ear_training', roomId: etRoom.id, updatedAt: etRoom.updated_at })

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
  options: { onlineIds?: Set<string> } = {},
): Promise<JoinResult> {
  const cap = await getRoomCapacity(supabase, gameType, roomId)
  if (!cap) return 'missing'

  if (cap.status !== 'lobby' && cap.status !== 'playing') return 'missing'
  if (cap.status === 'playing' && cap.occupied < 2) return 'missing'

  if (
    cap.hostId !== userId &&
    (cap.status === 'lobby' || cap.status === 'playing') &&
    options.onlineIds &&
    options.onlineIds.size > 0 &&
    !options.onlineIds.has(cap.hostId)
  ) {
    await deleteStaleRoom(supabase, gameType, roomId)
    return 'missing'
  }
  if (cap.userIds.includes(userId)) return 'already-in'
  if (cap.status !== 'lobby') return 'missing'
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
