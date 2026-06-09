import { useEffect, useState, useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { EarTrainingRoom } from '../types/collab'
import type { RoomConfig } from '../lib/earTraining'

/**
 * Ear Training Duel room hook.
 *
 * Mirrors useGameRoom but uses symmetric `player1_id` / `player2_id`
 * instead of the host/guest split — neither side has special powers
 * over question generation (both clients derive questions from the
 * deterministic seed; see lib/earTraining.ts).
 *
 * Subscribes to realtime UPDATEs so both clients see ready toggles,
 * answer submissions, score changes, and round advances live.
 */
export function useEarTrainingRoom (supabase: SupabaseClient, currentUserId: string) {
  const [room, setRoom] = useState<EarTrainingRoom | null>(null)
  const [loading, setLoading] = useState(false)

  // ─── Realtime ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!room) return
    const ch = supabase
      .channel(`et_room:${room.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ear_training_rooms', filter: `id=eq.${room.id}` },
        payload => setRoom(payload.new as EarTrainingRoom)
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'ear_training_rooms', filter: `id=eq.${room.id}` },
        () => setRoom(null)
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [supabase, room?.id])

  // ─── Helpers ───────────────────────────────────────────────────────────

  /** Identify which seat the current user is in. */
  const seat: 'player1' | 'player2' | null = !room
    ? null
    : room.player1_id === currentUserId ? 'player1'
    : room.player2_id === currentUserId ? 'player2'
    : null

  // ─── Actions ───────────────────────────────────────────────────────────

  const createRoom = useCallback(async (config: RoomConfig, totalRounds = 10): Promise<EarTrainingRoom | null> => {
    setLoading(true)
    // Tear down any stale lobby this user is sitting in so we never
    // accumulate orphans.
    await supabase.from('ear_training_rooms').delete().eq('player1_id', currentUserId).eq('status', 'lobby')
    const { data, error } = await supabase
      .from('ear_training_rooms')
      .insert({ player1_id: currentUserId, config, total_rounds: totalRounds })
      .select()
      .single()
    setLoading(false)
    if (error) {
      console.error('[useEarTrainingRoom.createRoom]', error)
      // Surface the failure so a missing migration / broken RLS doesn't
      // present as "the Invite button just does nothing". Schema-issue
      // errors here (relation does not exist, RLS denied) need user
      // attention — they aren't transient.
      const msg = error.message?.includes('relation') || error.message?.includes('does not exist')
        ? 'Ear Training table is missing. Apply the 20260603_ear_training_rooms.sql migration in Supabase.'
        : `Couldn't create Ear Training room: ${error.message ?? 'unknown error'}`
      try { alert(msg) } catch {/* non-browser */}
      return null
    }
    setRoom(data as EarTrainingRoom)
    return data as EarTrainingRoom
  }, [supabase, currentUserId])

  const joinRoom = useCallback(async (roomId: string): Promise<EarTrainingRoom | null> => {
    setLoading(true)
    // Fetch first so we don't overwrite player2 if someone else got there.
    const { data: existing, error: fetchErr } = await supabase
      .from('ear_training_rooms').select('*').eq('id', roomId).maybeSingle()
    if (fetchErr || !existing) { setLoading(false); return null }
    const r = existing as EarTrainingRoom
    if (r.player1_id === currentUserId) {
      setRoom(r); setLoading(false); return r
    }
    if (r.player2_id && r.player2_id !== currentUserId) {
      // Seat taken. Just observe as a read-only spectator state.
      setRoom(r); setLoading(false); return r
    }
    const { data, error } = await supabase
      .from('ear_training_rooms')
      .update({ player2_id: currentUserId })
      .eq('id', roomId)
      .select()
      .single()
    setLoading(false)
    if (error) { console.error('[useEarTrainingRoom.joinRoom]', error); return null }
    setRoom(data as EarTrainingRoom)
    return data as EarTrainingRoom
  }, [supabase, currentUserId])

  const updateConfig = useCallback(async (config: RoomConfig) => {
    if (!room) return
    // Changing the config invalidates the "Ready" agreement.
    await supabase.from('ear_training_rooms')
      .update({ config, player1_ready: false, player2_ready: false })
      .eq('id', room.id)
  }, [supabase, room])

  const toggleReady = useCallback(async () => {
    if (!room || !seat) return
    const field = seat === 'player1' ? 'player1_ready' : 'player2_ready'
    const next  = seat === 'player1' ? !room.player1_ready : !room.player2_ready
    await supabase.from('ear_training_rooms')
      .update({ [field]: next })
      .eq('id', room.id)
  }, [supabase, room, seat])

  /** Idempotent "begin round 1" used by either client once both ready. */
  const startGame = useCallback(async () => {
    if (!room) return
    if (room.status !== 'lobby') return
    if (!room.player1_id || !room.player2_id) return
    if (!room.player1_ready || !room.player2_ready) return
    await supabase.from('ear_training_rooms')
      .update({
        status: 'playing',
        current_round: 1,
        round_started_at: new Date().toISOString(),
        player1_answer: null,
        player2_answer: null,
      })
      .eq('id', room.id)
      .eq('status', 'lobby')   // Lost-update guard — only the first call wins.
  }, [supabase, room])

  const submitAnswer = useCallback(async (answer: string) => {
    if (!room || !seat) return
    const field = seat === 'player1' ? 'player1_answer' : 'player2_answer'
    const already = seat === 'player1' ? room.player1_answer : room.player2_answer
    if (already) return     // Locked in once submitted.
    await supabase.from('ear_training_rooms')
      .update({ [field]: answer })
      .eq('id', room.id)
  }, [supabase, room, seat])

  /** Award points and advance to the next round (or finish). Caller is
   *  expected to have computed the correct answer locally and decide
   *  who scored. Idempotent across both clients via the round guard. */
  const advanceRound = useCallback(async (params: {
    round: number,                // the round we're CLOSING (must match server)
    player1Correct: boolean,
    player2Correct: boolean,
  }) => {
    if (!room) return
    if (room.current_round !== params.round) return
    const nextRound = room.current_round + 1
    const finished = nextRound > room.total_rounds
    const newP1Score = room.player1_score + (params.player1Correct ? 1 : 0)
    const newP2Score = room.player2_score + (params.player2Correct ? 1 : 0)
    const winnerId =
      !finished ? null
      : newP1Score > newP2Score ? room.player1_id
      : newP2Score > newP1Score ? room.player2_id
      : null   // tie
    await supabase.from('ear_training_rooms')
      .update({
        player1_score: newP1Score,
        player2_score: newP2Score,
        current_round: finished ? room.current_round : nextRound,
        status: finished ? 'finished' : 'playing',
        winner_id: winnerId,
        player1_answer: null,
        player2_answer: null,
        round_started_at: finished ? room.round_started_at : new Date().toISOString(),
      })
      .eq('id', room.id)
      .eq('current_round', params.round)   // Lost-update guard.
  }, [supabase, room])

  const leaveRoom = useCallback(() => { setRoom(null) }, [])

  const deleteCurrentRoom = useCallback(async () => {
    if (!room) return
    await supabase.from('ear_training_rooms').delete().eq('id', room.id)
    setRoom(null)
  }, [supabase, room])

  /** End the game with the opponent declared winner. Mirrors the
   *  Forfeit action in chess/poker — the player who tapped this
   *  immediately concedes the match. Idempotent: only fires if the
   *  game is still in progress. */
  const forfeitGame = useCallback(async () => {
    if (!room || !seat) return
    if (room.status === 'finished') return
    const opponentId = seat === 'player1' ? room.player2_id : room.player1_id
    await supabase.from('ear_training_rooms')
      .update({ status: 'finished', winner_id: opponentId })
      .eq('id', room.id)
      .neq('status', 'finished')   // lost-update guard
  }, [supabase, room, seat])

  /** Same idea as useGameRoom.findActiveRoom — resume on remount. */
  const findActiveRoom = useCallback(async (): Promise<EarTrainingRoom | null> => {
    const { data } = await supabase
      .from('ear_training_rooms')
      .select('*')
      .or(`player1_id.eq.${currentUserId},player2_id.eq.${currentUserId}`)
      .eq('status', 'playing')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) setRoom(data as EarTrainingRoom)
    return (data as EarTrainingRoom | null) ?? null
  }, [supabase, currentUserId])

  /** Send a game_invite. Writes to the notifications table (kept for
   *  downstream consumers) AND posts a chat message so the orb pulse
   *  / banner surfaces it to the recipient. */
  const inviteFriend = useCallback(async (friendId: string, roomId: string) => {
    const { error } = await supabase.from('notifications').insert({
      user_id: friendId,
      actor_id: currentUserId,
      type: 'game_invite',
      read: false,
      metadata: { room_id: roomId, game_type: 'ear_training' },
    })
    if (error) console.error('[useEarTrainingRoom.inviteFriend]', error)
    const { sendGameInviteMessage } = await import('../lib/gameRooms')
    sendGameInviteMessage(supabase, currentUserId, friendId, roomId, 'ear_training')
  }, [supabase, currentUserId])

  const cancelInvite = useCallback(async (friendId: string, roomId: string) => {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', friendId)
      .eq('actor_id', currentUserId)
      .eq('type', 'game_invite')
      .eq('metadata->>room_id', roomId)
    if (error) console.error('[useEarTrainingRoom.cancelInvite]', error)
    const { deleteGameInviteMessage } = await import('../lib/gameRooms')
    deleteGameInviteMessage(supabase, currentUserId, friendId, roomId)
  }, [supabase, currentUserId])

  return {
    room,
    loading,
    seat,
    createRoom,
    joinRoom,
    updateConfig,
    toggleReady,
    startGame,
    submitAnswer,
    advanceRound,
    forfeitGame,
    leaveRoom,
    deleteCurrentRoom,
    findActiveRoom,
    inviteFriend,
    cancelInvite,
    setRoom: (r: EarTrainingRoom | null) => setRoom(r),
  }
}
