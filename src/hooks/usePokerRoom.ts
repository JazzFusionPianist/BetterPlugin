import { useState, useEffect, useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  PokerRoom,
  PokerRoomState,
  PokerPlayerState,
  PokerHoleCards,
  PokerHandEvalSnapshot,
  PokerRound,
} from '../types/collab'
import {
  freshDeck,
  dealCards,
  chooseHandWinners,
  isBettingRoundComplete,
} from './usePoker'

const STARTING_CHIPS = 1000
const SMALL_BLIND = 10
const BIG_BLIND = 20

type PlayerCount = 2 | 3 | 4 | 5 | 6

function emptyPlayerState(roomId: string, userId: string): PokerPlayerState {
  return {
    room_id: roomId,
    user_id: userId,
    chips: STARTING_CHIPS,
    current_bet: 0,
    folded: false,
    all_in: false,
    acted: false,
  }
}

export function usePokerRoom(supabase: SupabaseClient, currentUserId: string) {
  const [room, setRoom] = useState<PokerRoom | null>(null)
  const [playerStates, setPlayerStates] = useState<Map<string, PokerPlayerState>>(new Map())
  const [myHoleCards, setMyHoleCards] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  // ── Realtime + initial fetch ──────────────────────────────────────────
  useEffect(() => {
    if (!room) {
      setPlayerStates(new Map())
      setMyHoleCards([])
      return
    }

    let cancelled = false

    ;(async () => {
      const { data, error } = await supabase
        .from('poker_player_states')
        .select('*')
        .eq('room_id', room.id)
      if (cancelled) return
      if (error) {
        console.warn('[usePokerRoom] initial player_states fetch error:', error)
      } else {
        const next = new Map<string, PokerPlayerState>()
        for (const row of (data ?? []) as PokerPlayerState[]) {
          next.set(row.user_id, row)
        }
        setPlayerStates(next)
      }

      const { data: hcData, error: hcErr } = await supabase
        .from('poker_hole_cards')
        .select('*')
        .eq('room_id', room.id)
        .eq('user_id', currentUserId)
        .maybeSingle()
      if (cancelled) return
      if (hcErr) {
        console.warn('[usePokerRoom] initial hole_cards fetch error:', hcErr)
      } else if (hcData) {
        setMyHoleCards(((hcData as PokerHoleCards).cards ?? []) as string[])
      } else {
        setMyHoleCards([])
      }
    })()

    const roomChannel = supabase
      .channel(`poker_room:${room.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'poker_rooms',
          filter: `id=eq.${room.id}`,
        },
        payload => setRoom(payload.new as PokerRoom)
      )
      .subscribe()

    const stateChannel = supabase
      .channel(`poker_player_states:${room.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'poker_player_states',
          filter: `room_id=eq.${room.id}`,
        },
        payload => {
          if (payload.eventType === 'DELETE') {
            const old = payload.old as PokerPlayerState
            setPlayerStates(prev => {
              const next = new Map(prev)
              if (old?.user_id) next.delete(old.user_id)
              return next
            })
            return
          }
          const row = payload.new as PokerPlayerState
          setPlayerStates(prev => {
            const next = new Map(prev)
            next.set(row.user_id, row)
            return next
          })
        }
      )
      .subscribe()

    const holeChannel = supabase
      .channel(`poker_hole_cards:${room.id}:${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'poker_hole_cards',
          filter: `user_id=eq.${currentUserId}`,
        },
        payload => {
          if (payload.eventType === 'DELETE') {
            setMyHoleCards([])
            return
          }
          const row = payload.new as PokerHoleCards
          if (row.room_id === room.id) {
            setMyHoleCards((row.cards ?? []) as string[])
          }
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(roomChannel)
      supabase.removeChannel(stateChannel)
      supabase.removeChannel(holeChannel)
    }
  }, [room?.id, supabase, currentUserId])

  // ── Lifecycle ─────────────────────────────────────────────────────────
  const createRoom = useCallback(
    async (playerCount: PlayerCount): Promise<PokerRoom | null> => {
      setLoading(true)
      const { data, error } = await supabase
        .from('poker_rooms')
        .insert({
          host_id: currentUserId,
          player_count: playerCount,
          status: 'lobby',
          player_ids: [currentUserId],
          ready_ids: [],
          state: {},
          winner_id: null,
        })
        .select()
        .single()
      if (error || !data) {
        setLoading(false)
        console.warn('[usePokerRoom.createRoom]', error)
        return null
      }
      const newRoom = data as PokerRoom

      // Insert host's player state
      const { error: psErr } = await supabase
        .from('poker_player_states')
        .upsert(emptyPlayerState(newRoom.id, currentUserId), {
          onConflict: 'room_id,user_id',
        })
      if (psErr) console.warn('[usePokerRoom.createRoom] insert player_state:', psErr)

      setLoading(false)
      setRoom(newRoom)
      return newRoom
    },
    [supabase, currentUserId]
  )

  const joinRoom = useCallback(
    async (roomId: string): Promise<PokerRoom | null> => {
      const { data: existing, error: fetchErr } = await supabase
        .from('poker_rooms')
        .select('*')
        .eq('id', roomId)
        .single()
      if (fetchErr || !existing) {
        console.warn('[usePokerRoom.joinRoom] fetch error:', fetchErr)
        return null
      }
      const ex = existing as PokerRoom
      if (ex.status !== 'lobby') return null
      if (
        ex.player_ids.length >= ex.player_count &&
        !ex.player_ids.includes(currentUserId)
      ) {
        return null
      }
      if (ex.player_ids.includes(currentUserId)) {
        // Make sure player_state row exists
        await supabase
          .from('poker_player_states')
          .upsert(emptyPlayerState(ex.id, currentUserId), {
            onConflict: 'room_id,user_id',
            ignoreDuplicates: true,
          })
        setRoom(ex)
        return ex
      }
      const newPlayerIds = [...ex.player_ids, currentUserId]
      const { data, error } = await supabase
        .from('poker_rooms')
        .update({ player_ids: newPlayerIds })
        .eq('id', roomId)
        .select()
        .single()
      if (error || !data) {
        console.warn('[usePokerRoom.joinRoom] update error:', error)
        return null
      }
      const { error: psErr } = await supabase
        .from('poker_player_states')
        .upsert(emptyPlayerState(roomId, currentUserId), {
          onConflict: 'room_id,user_id',
          ignoreDuplicates: true,
        })
      if (psErr) console.warn('[usePokerRoom.joinRoom] player_state insert:', psErr)

      setRoom(data as PokerRoom)
      return data as PokerRoom
    },
    [supabase, currentUserId]
  )

  const leaveRoom = useCallback(() => {
    setRoom(null)
  }, [])

  const deleteCurrentRoom = useCallback(async (): Promise<void> => {
    if (!room) return
    const { error } = await supabase.from('poker_rooms').delete().eq('id', room.id)
    if (error) console.warn('[usePokerRoom.deleteCurrentRoom]', error)
    setRoom(null)
  }, [supabase, room])

  const findActiveRoom = useCallback(async (): Promise<PokerRoom | null> => {
    const { data, error } = await supabase
      .from('poker_rooms')
      .select('*')
      .contains('player_ids', [currentUserId])
      .eq('status', 'playing')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) {
      console.warn('[usePokerRoom.findActiveRoom]', error)
      return null
    }
    if (data) setRoom(data as PokerRoom)
    return (data as PokerRoom | null) ?? null
  }, [supabase, currentUserId])

  const toggleReady = useCallback(async (): Promise<void> => {
    if (!room) return
    const isReady = room.ready_ids.includes(currentUserId)
    const newReadyIds = isReady
      ? room.ready_ids.filter(id => id !== currentUserId)
      : [...room.ready_ids, currentUserId]
    const { error } = await supabase
      .from('poker_rooms')
      .update({ ready_ids: newReadyIds })
      .eq('id', room.id)
    if (error) console.warn('[usePokerRoom.toggleReady]', error)
  }, [supabase, room, currentUserId])

  const inviteFriend = useCallback(
    async (friendId: string, roomId: string): Promise<void> => {
      const { error } = await supabase.from('notifications').insert({
        user_id: friendId,
        actor_id: currentUserId,
        type: 'game_invite',
        read: false,
        metadata: { room_id: roomId, game_type: 'poker' },
      })
      if (error) console.warn('[usePokerRoom.inviteFriend]', error)
    },
    [supabase, currentUserId]
  )

  const updatePlayerCount = useCallback(
    async (n: PlayerCount): Promise<void> => {
      if (!room) return
      if (room.host_id !== currentUserId) {
        console.warn('[usePokerRoom.updatePlayerCount] only host can change')
        return
      }
      if (room.player_ids.length > n) {
        console.warn('[usePokerRoom.updatePlayerCount] too many players already')
        return
      }
      const { error } = await supabase
        .from('poker_rooms')
        .update({ player_count: n })
        .eq('id', room.id)
      if (error) console.warn('[usePokerRoom.updatePlayerCount]', error)
    },
    [supabase, room, currentUserId]
  )

  // ── Helpers (pure) ────────────────────────────────────────────────────

  // Find next acting player index, skipping folded/all-in/0-chip players.
  // Returns -1 if no eligible player exists.
  function findNextActor(
    playerIds: string[],
    states: Map<string, PokerPlayerState>,
    fromIndex: number
  ): number {
    const n = playerIds.length
    for (let i = 1; i <= n; i++) {
      const idx = (fromIndex + i) % n
      const uid = playerIds[idx]
      const ps = states.get(uid)
      if (!ps) continue
      if (ps.folded) continue
      if (ps.all_in) continue
      if (ps.chips <= 0) continue
      return idx
    }
    return -1
  }

  // First eligible actor strictly after `fromIndex` (inclusive of going around).
  // For preflop: first-to-act after BB. For postflop: first non-folded after dealer.
  function firstEligibleAfter(
    playerIds: string[],
    states: Map<string, PokerPlayerState>,
    fromIndex: number
  ): number {
    return findNextActor(playerIds, states, fromIndex)
  }

  // ── startHand ─────────────────────────────────────────────────────────
  const startHand = useCallback(async (): Promise<void> => {
    if (!room) return
    if (room.host_id !== currentUserId) {
      console.warn('[usePokerRoom.startHand] only host can start a hand')
      return
    }

    const playerIds = room.player_ids
    const n = playerIds.length

    // Pull latest player states from DB (chips persist across hands)
    const { data: psData, error: psErr } = await supabase
      .from('poker_player_states')
      .select('*')
      .eq('room_id', room.id)
    if (psErr) {
      console.warn('[usePokerRoom.startHand] fetch player_states:', psErr)
      return
    }
    const states = new Map<string, PokerPlayerState>()
    for (const row of (psData ?? []) as PokerPlayerState[]) states.set(row.user_id, row)
    // Ensure every player has a state row
    for (const uid of playerIds) {
      if (!states.has(uid)) states.set(uid, emptyPlayerState(room.id, uid))
    }

    // Determine new dealer index (skip 0-chip players)
    const prevState = (room.state ?? {}) as Partial<PokerRoomState>
    const prevDealer =
      typeof prevState.dealer_index === 'number' ? prevState.dealer_index : -1
    let dealerIndex = -1
    for (let i = 1; i <= n; i++) {
      const idx = (prevDealer + i + n) % n
      const uid = playerIds[idx]
      const s = states.get(uid)
      if (s && s.chips > 0) {
        dealerIndex = idx
        break
      }
    }
    if (dealerIndex < 0) {
      console.warn('[usePokerRoom.startHand] no players with chips')
      return
    }

    // Reset per-hand fields; mark 0-chip players as folded so they don't act
    const resetStates = new Map<string, PokerPlayerState>()
    for (const uid of playerIds) {
      const cur = states.get(uid)!
      resetStates.set(uid, {
        ...cur,
        current_bet: 0,
        folded: cur.chips <= 0,
        all_in: false,
        acted: false,
      })
    }

    // Shuffle deck and deal 2 hole cards to each non-folded player
    let deck = freshDeck()
    const holeCardsByUser = new Map<string, string[]>()
    // Deal in order around the table from dealer+1
    const order: number[] = []
    for (let i = 1; i <= n; i++) order.push((dealerIndex + i) % n)
    for (let card = 0; card < 2; card++) {
      for (const idx of order) {
        const uid = playerIds[idx]
        const ps = resetStates.get(uid)!
        if (ps.folded) continue
        const result = dealCards(deck, 1)
        deck = result.remaining
        const existing = holeCardsByUser.get(uid) ?? []
        holeCardsByUser.set(uid, [...existing, ...result.dealt])
      }
    }

    // Determine blind positions
    let sbIndex: number
    let bbIndex: number
    if (n === 2) {
      // Heads-up: dealer is small blind
      sbIndex = dealerIndex
      bbIndex = (dealerIndex + 1) % n
    } else {
      sbIndex = (dealerIndex + 1) % n
      bbIndex = (dealerIndex + 2) % n
    }
    // Skip folded (0-chip) players for blinds
    const advanceForBlind = (start: number): number => {
      for (let i = 0; i < n; i++) {
        const idx = (start + i) % n
        const ps = resetStates.get(playerIds[idx])!
        if (!ps.folded) return idx
      }
      return start
    }
    sbIndex = advanceForBlind(sbIndex)
    bbIndex = advanceForBlind((sbIndex + 1) % n)

    // Post small blind
    {
      const uid = playerIds[sbIndex]
      const ps = resetStates.get(uid)!
      const post = Math.min(SMALL_BLIND, ps.chips)
      resetStates.set(uid, {
        ...ps,
        chips: ps.chips - post,
        current_bet: post,
        all_in: ps.chips - post === 0,
      })
    }
    // Post big blind
    {
      const uid = playerIds[bbIndex]
      const ps = resetStates.get(uid)!
      const post = Math.min(BIG_BLIND, ps.chips)
      resetStates.set(uid, {
        ...ps,
        chips: ps.chips - post,
        current_bet: post,
        all_in: ps.chips - post === 0,
      })
    }

    const pot =
      (resetStates.get(playerIds[sbIndex])!.current_bet ?? 0) +
      (resetStates.get(playerIds[bbIndex])!.current_bet ?? 0)

    // First-to-act
    let firstToAct: number
    if (n === 2) {
      // Heads-up preflop: small blind (dealer) acts first
      firstToAct = sbIndex
    } else {
      firstToAct = (bbIndex + 1) % n
    }
    firstToAct = findNextActor(playerIds, resetStates, (firstToAct - 1 + n) % n)
    if (firstToAct < 0) firstToAct = bbIndex // fallback

    const newState: PokerRoomState = {
      hand_number: (prevState.hand_number ?? 0) + 1,
      dealer_index: dealerIndex,
      betting_round: 'preflop',
      deck,
      community_cards: [],
      pot,
      current_bet: BIG_BLIND,
      min_raise: BIG_BLIND,
      current_player_index: firstToAct,
      small_blind: SMALL_BLIND,
      big_blind: BIG_BLIND,
      last_aggressor_index: bbIndex,
      showdown: undefined,
      hand_winner_ids: undefined,
      hand_winner_amount: undefined,
    }

    // Persist player states
    const psRows = playerIds.map(uid => resetStates.get(uid)!)
    const { error: psUpdErr } = await supabase
      .from('poker_player_states')
      .upsert(psRows, { onConflict: 'room_id,user_id' })
    if (psUpdErr) {
      console.warn('[usePokerRoom.startHand] update player_states:', psUpdErr)
      return
    }

    // Wipe old hole cards then insert new ones
    const { error: delErr } = await supabase
      .from('poker_hole_cards')
      .delete()
      .eq('room_id', room.id)
    if (delErr) console.warn('[usePokerRoom.startHand] delete hole_cards:', delErr)

    const holeRows: PokerHoleCards[] = []
    for (const [uid, cards] of holeCardsByUser.entries()) {
      holeRows.push({ room_id: room.id, user_id: uid, cards })
    }
    if (holeRows.length > 0) {
      const { error: hcErr } = await supabase
        .from('poker_hole_cards')
        .upsert(holeRows, { onConflict: 'room_id,user_id' })
      if (hcErr) console.warn('[usePokerRoom.startHand] insert hole_cards:', hcErr)
    }

    // Update room: set status=playing if still in lobby
    const update: Partial<PokerRoom> = {
      state: newState,
      ready_ids: [],
    }
    if (room.status === 'lobby') update.status = 'playing'

    const { error: roomErr } = await supabase
      .from('poker_rooms')
      .update(update)
      .eq('id', room.id)
    if (roomErr) console.warn('[usePokerRoom.startHand] update room:', roomErr)
  }, [supabase, room, currentUserId])

  // ── startNewHandIfReady ───────────────────────────────────────────────
  const startNewHandIfReady = useCallback(async (): Promise<void> => {
    if (!room) return
    if (room.host_id !== currentUserId) return

    // Refresh player states from DB
    const { data: psData, error: psErr } = await supabase
      .from('poker_player_states')
      .select('*')
      .eq('room_id', room.id)
    if (psErr) {
      console.warn('[usePokerRoom.startNewHandIfReady] fetch:', psErr)
      return
    }
    const rows = (psData ?? []) as PokerPlayerState[]
    const withChips = rows.filter(r => r.chips > 0)
    if (withChips.length <= 1) {
      const winnerId = withChips[0]?.user_id ?? null
      const { error } = await supabase
        .from('poker_rooms')
        .update({ status: 'finished', winner_id: winnerId })
        .eq('id', room.id)
      if (error) console.warn('[usePokerRoom.startNewHandIfReady] finish:', error)
      return
    }
    await startHand()
  }, [supabase, room, currentUserId, startHand])

  // ── Action helpers (used internally) ──────────────────────────────────

  // Advance round / award pot. Returns the patch to apply to the room state.
  // states: latest player states (already updated for the just-acted player).
  async function advanceAfterAction(
    rm: PokerRoom,
    rmState: PokerRoomState,
    statesIn: Map<string, PokerPlayerState>
  ): Promise<void> {
    const playerIds = rm.player_ids
    const states = new Map(statesIn)

    // Check if only one non-folded player remains → award pot
    const liveIds = playerIds.filter(uid => !states.get(uid)!.folded)
    if (liveIds.length === 1) {
      const winnerId = liveIds[0]
      const ps = states.get(winnerId)!
      states.set(winnerId, { ...ps, chips: ps.chips + rmState.pot })

      const newState: PokerRoomState = {
        ...rmState,
        betting_round: 'hand_end',
        pot: 0,
        hand_winner_ids: [winnerId],
        hand_winner_amount: rmState.pot,
        showdown: undefined,
      }
      await persistStateAndPlayers(rm.id, newState, states, playerIds)
      return
    }

    // Determine if betting round complete
    const roundComplete = isBettingRoundComplete(
      playerIds,
      states,
      rmState.current_bet
    )

    if (!roundComplete) {
      // Move to next actor
      const nextIdx = findNextActor(
        playerIds,
        states,
        rmState.current_player_index
      )
      const newState: PokerRoomState = {
        ...rmState,
        current_player_index: nextIdx >= 0 ? nextIdx : rmState.current_player_index,
      }
      await persistStateAndPlayers(rm.id, newState, states, playerIds)
      return
    }

    // ─ Betting round complete; advance round ─
    let { deck, community_cards, betting_round } = rmState
    let newRound: PokerRound = betting_round
    let newCommunity = [...community_cards]

    const burnAndDeal = (count: number) => {
      // burn 1
      const burnRes = dealCards(deck, 1)
      deck = burnRes.remaining
      const dealRes = dealCards(deck, count)
      deck = dealRes.remaining
      newCommunity = [...newCommunity, ...dealRes.dealt]
    }

    if (betting_round === 'preflop') {
      newRound = 'flop'
      burnAndDeal(3)
    } else if (betting_round === 'flop') {
      newRound = 'turn'
      burnAndDeal(1)
    } else if (betting_round === 'turn') {
      newRound = 'river'
      burnAndDeal(1)
    } else if (betting_round === 'river') {
      // Showdown
      newRound = 'hand_end'
    }

    // Reset bets between rounds (but not on showdown — pot already accumulated)
    for (const uid of playerIds) {
      const ps = states.get(uid)!
      states.set(uid, { ...ps, current_bet: 0, acted: false })
    }

    if (newRound === 'hand_end') {
      // Showdown: evaluate hands of remaining live players
      // Fetch hole cards for contenders
      const { data: hcData, error: hcErr } = await supabase
        .from('poker_hole_cards')
        .select('*')
        .eq('room_id', rm.id)
        .in('user_id', liveIds)
      if (hcErr) console.warn('[usePokerRoom.advanceAfterAction] hole_cards fetch:', hcErr)
      const holeMap = new Map<string, string[]>()
      for (const row of (hcData ?? []) as PokerHoleCards[]) {
        holeMap.set(row.user_id, row.cards ?? [])
      }

      const contestants = liveIds.map(uid => ({
        user_id: uid,
        hole_cards: holeMap.get(uid) ?? [],
      }))
      const { winner_ids: winnerIds, evaluations } = chooseHandWinners(
        contestants,
        newCommunity
      )

      const splitAmount = Math.floor(rmState.pot / Math.max(winnerIds.length, 1))
      // Distribute pot
      for (const wid of winnerIds) {
        const ps = states.get(wid)!
        states.set(wid, { ...ps, chips: ps.chips + splitAmount })
      }
      const remainder = rmState.pot - splitAmount * winnerIds.length
      if (remainder > 0 && winnerIds.length > 0) {
        const ps = states.get(winnerIds[0])!
        states.set(winnerIds[0], { ...ps, chips: ps.chips + remainder })
      }

      const showdown: PokerHandEvalSnapshot[] = evaluations.map(e => ({
        user_id: e.user_id,
        rank_name: e.eval?.rank_name ?? '',
        best_cards: e.eval?.best_cards ?? [],
        hole_cards: holeMap.get(e.user_id) ?? [],
      }))

      const newState: PokerRoomState = {
        ...rmState,
        deck,
        community_cards: newCommunity,
        betting_round: 'hand_end',
        pot: 0,
        current_bet: 0,
        min_raise: BIG_BLIND,
        showdown,
        hand_winner_ids: winnerIds,
        hand_winner_amount: splitAmount,
      }
      await persistStateAndPlayers(rm.id, newState, states, playerIds)
      return
    }

    // Postflop: first non-folded, non-all-in player after dealer
    const firstToActIdx = firstEligibleAfter(
      playerIds,
      states,
      rmState.dealer_index
    )

    const newState: PokerRoomState = {
      ...rmState,
      deck,
      community_cards: newCommunity,
      betting_round: newRound,
      current_bet: 0,
      min_raise: BIG_BLIND,
      current_player_index: firstToActIdx >= 0 ? firstToActIdx : rmState.current_player_index,
      last_aggressor_index: -1,
    }
    await persistStateAndPlayers(rm.id, newState, states, playerIds)
  }

  async function persistStateAndPlayers(
    roomId: string,
    newState: PokerRoomState,
    states: Map<string, PokerPlayerState>,
    playerIds: string[]
  ): Promise<void> {
    const psRows = playerIds.map(uid => states.get(uid)!).filter(Boolean)
    const { error: psErr } = await supabase
      .from('poker_player_states')
      .upsert(psRows, { onConflict: 'room_id,user_id' })
    if (psErr) console.warn('[usePokerRoom.persist] player_states:', psErr)

    const { error: rmErr } = await supabase
      .from('poker_rooms')
      .update({ state: newState })
      .eq('id', roomId)
    if (rmErr) console.warn('[usePokerRoom.persist] room state:', rmErr)
  }

  // Snapshot current room + player states fresh from DB before performing an action
  async function snapshot(): Promise<{
    rm: PokerRoom
    rmState: PokerRoomState
    states: Map<string, PokerPlayerState>
  } | null> {
    if (!room) return null
    const { data: rmData, error: rmErr } = await supabase
      .from('poker_rooms')
      .select('*')
      .eq('id', room.id)
      .single()
    if (rmErr || !rmData) {
      console.warn('[usePokerRoom.snapshot] room fetch:', rmErr)
      return null
    }
    const rm = rmData as PokerRoom
    const rmState = rm.state as PokerRoomState
    if (!rmState || typeof rmState.current_player_index !== 'number') {
      console.warn('[usePokerRoom.snapshot] no active hand')
      return null
    }
    const { data: psData, error: psErr } = await supabase
      .from('poker_player_states')
      .select('*')
      .eq('room_id', rm.id)
    if (psErr) {
      console.warn('[usePokerRoom.snapshot] player_states fetch:', psErr)
      return null
    }
    const states = new Map<string, PokerPlayerState>()
    for (const row of (psData ?? []) as PokerPlayerState[]) {
      states.set(row.user_id, row)
    }
    return { rm, rmState, states }
  }

  // ── Player actions ────────────────────────────────────────────────────
  const fold = useCallback(async (): Promise<void> => {
    const snap = await snapshot()
    if (!snap) return
    const { rm, rmState, states } = snap
    const turnUid = rm.player_ids[rmState.current_player_index]
    if (turnUid !== currentUserId) {
      console.warn('[usePokerRoom.fold] not your turn')
      return
    }
    const ps = states.get(currentUserId)
    if (!ps) return
    states.set(currentUserId, { ...ps, folded: true, acted: true })
    await advanceAfterAction(rm, rmState, states)
  }, [supabase, room, currentUserId])

  const callOrCheck = useCallback(async (): Promise<void> => {
    const snap = await snapshot()
    if (!snap) return
    const { rm, rmState, states } = snap
    const turnUid = rm.player_ids[rmState.current_player_index]
    if (turnUid !== currentUserId) {
      console.warn('[usePokerRoom.callOrCheck] not your turn')
      return
    }
    const ps = states.get(currentUserId)
    if (!ps) return
    const toCall = Math.max(0, rmState.current_bet - ps.current_bet)
    const pay = Math.min(toCall, ps.chips)
    const newPs: PokerPlayerState = {
      ...ps,
      chips: ps.chips - pay,
      current_bet: ps.current_bet + pay,
      all_in: ps.chips - pay === 0 && pay > 0 ? true : ps.all_in,
      acted: true,
    }
    states.set(currentUserId, newPs)
    const newRmState: PokerRoomState = {
      ...rmState,
      pot: rmState.pot + pay,
    }
    await advanceAfterAction(rm, newRmState, states)
  }, [supabase, room, currentUserId])

  const raise = useCallback(
    async (raiseTo: number): Promise<void> => {
      const snap = await snapshot()
      if (!snap) return
      const { rm, rmState, states } = snap
      const turnUid = rm.player_ids[rmState.current_player_index]
      if (turnUid !== currentUserId) {
        console.warn('[usePokerRoom.raise] not your turn')
        return
      }
      const ps = states.get(currentUserId)
      if (!ps) return

      const minTotal = rmState.current_bet + rmState.min_raise
      const maxTotal = ps.chips + ps.current_bet // all-in max
      let target = Math.floor(raiseTo)
      if (target > maxTotal) target = maxTotal
      const isAllIn = target === maxTotal
      if (target < minTotal && !isAllIn) {
        console.warn('[usePokerRoom.raise] below min raise')
        return
      }
      if (target <= rmState.current_bet) {
        console.warn('[usePokerRoom.raise] must increase current bet')
        return
      }
      const delta = target - ps.current_bet
      if (delta > ps.chips) {
        console.warn('[usePokerRoom.raise] insufficient chips')
        return
      }
      const raiseSize = target - rmState.current_bet
      const newPs: PokerPlayerState = {
        ...ps,
        chips: ps.chips - delta,
        current_bet: target,
        all_in: ps.chips - delta === 0,
        acted: true,
      }
      states.set(currentUserId, newPs)

      // After a raise, all other live players need to act again
      for (const uid of rm.player_ids) {
        if (uid === currentUserId) continue
        const other = states.get(uid)
        if (!other) continue
        if (other.folded || other.all_in) continue
        states.set(uid, { ...other, acted: false })
      }

      const newRmState: PokerRoomState = {
        ...rmState,
        pot: rmState.pot + delta,
        current_bet: target,
        min_raise: Math.max(raiseSize, rmState.min_raise),
        last_aggressor_index: rmState.current_player_index,
      }
      await advanceAfterAction(rm, newRmState, states)
    },
    [supabase, room, currentUserId]
  )

  return {
    room,
    loading,
    playerStates,
    myHoleCards,
    createRoom,
    joinRoom,
    leaveRoom,
    deleteCurrentRoom,
    findActiveRoom,
    toggleReady,
    inviteFriend,
    updatePlayerCount,
    startHand,
    startNewHandIfReady,
    fold,
    callOrCheck,
    raise,
    setRoom,
  }
}
