import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile, PokerRoomState } from '../../types/collab'
import { usePokerRoom } from '../../hooks/usePokerRoom'
import { cardRank, cardSuit } from '../../hooks/usePoker'

// ─── Constants ────────────────────────────────────────────────────────────────

const BIG_BLIND = 20
const HAND_END_DELAY_MS = 4000

// ─── Avatar helper ────────────────────────────────────────────────────────────

function Avatar({ profile, size = 28 }: { profile: Profile; size?: number }) {
  if (profile.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={profile.display_name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: profile.avatar_color || '#555',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 700,
        fontSize: size * 0.4,
        flexShrink: 0,
      }}
    >
      {profile.initials}
    </div>
  )
}

// ─── Playing card ─────────────────────────────────────────────────────────────

function rankToDisplay(card: string): string {
  const r = card[0]
  if (r === 'T') return '10'
  return r
}

function suitToSymbol(s: string): string {
  switch (s) {
    case 'S': return '♠'
    case 'H': return '♥'
    case 'D': return '♦'
    case 'C': return '♣'
  }
  return '?'
}

function PlayingCard({ card, faceDown, small }: { card?: string; faceDown?: boolean; small?: boolean }) {
  if (!card && !faceDown) {
    return <div className={`poker-card poker-card-empty${small ? ' small' : ''}`} />
  }
  if (faceDown) {
    return <div className={`poker-card poker-card-back${small ? ' small' : ''}`} />
  }
  // sanity
  if (!card || card.length < 2) {
    return <div className={`poker-card poker-card-empty${small ? ' small' : ''}`} />
  }
  const suit = cardSuit(card)
  const isRed = suit === 'H' || suit === 'D'
  const colorClass = isRed ? 'red' : 'black'
  return (
    <div className={`poker-card ${colorClass}${small ? ' small' : ''}`}>
      <span className="poker-card-rank">{rankToDisplay(card)}</span>
      <span className="poker-card-suit">{suitToSymbol(suit)}</span>
    </div>
  )
}

// ─── Invite modal ─────────────────────────────────────────────────────────────

interface InviteModalProps {
  friends: Profile[]
  invitedIds: Set<string>
  maxInvitees: number
  onInvite: (friendId: string) => void
  onClose: () => void
}

function InviteModal({ friends, invitedIds, maxInvitees, onInvite, onClose }: InviteModalProps) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? friends.filter(f => f.display_name.toLowerCase().includes(q))
      : friends
    return [...list].sort((a, b) => {
      const aInv = invitedIds.has(a.id) ? 1 : 0
      const bInv = invitedIds.has(b.id) ? 1 : 0
      if (aInv !== bInv) return aInv - bInv
      const aOn = a.isOnline ? 0 : 1
      const bOn = b.isOnline ? 0 : 1
      if (aOn !== bOn) return aOn - bOn
      return a.display_name.localeCompare(b.display_name)
    })
  }, [friends, query, invitedIds])

  const limitReached = invitedIds.size >= maxInvitees

  return (
    <div
      className="poker-invite-modal-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="poker-invite-modal" role="dialog" aria-label="Invite friends">
        <div className="poker-invite-modal-header">
          <span className="poker-invite-modal-title">
            Invite Friends ({invitedIds.size}/{maxInvitees})
          </span>
          <button
            className="poker-invite-modal-close"
            onClick={onClose}
            aria-label="Close invite dialog"
          >
            ×
          </button>
        </div>
        {friends.length > 0 && (
          <div className="poker-invite-search-wrap">
            <input
              className="poker-invite-search-input"
              type="text"
              placeholder={`Search ${friends.length} friend${friends.length === 1 ? '' : 's'}…`}
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
          </div>
        )}
        {friends.length === 0 ? (
          <p className="poker-invite-empty">No friends to invite.</p>
        ) : filtered.length === 0 ? (
          <p className="poker-invite-empty">No friends match "{query}".</p>
        ) : (
          <div className="poker-invite-list">
            {filtered.map(friend => {
              const isInvited = invitedIds.has(friend.id)
              const disabled = isInvited || (limitReached && !isInvited)
              return (
                <div key={friend.id} className="poker-invite-row">
                  <div className="poker-invite-av-wrap">
                    <Avatar profile={friend} size={36} />
                    {friend.isOnline && <span className="poker-invite-online-dot" />}
                  </div>
                  <span className="poker-invite-name">{friend.display_name}</span>
                  <button
                    className="poker-invite-do-btn"
                    onClick={() => onInvite(friend.id)}
                    disabled={disabled}
                  >
                    {isInvited ? 'Invited ✓' : 'Invite'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  supabase: SupabaseClient
  currentUserId: string
  currentUserProfile: Profile | null
  friendProfiles: Profile[]
  onlineIds: Set<string>
  onClose: () => void
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PokerView({
  supabase,
  currentUserId,
  currentUserProfile,
  friendProfiles,
  onClose,
}: Props) {
  const {
    room,
    loading,
    playerStates,
    myHoleCards,
    createRoom,
    joinRoom,
    leaveRoom,
    deleteCurrentRoom,
    quitGame,
    findActiveRoom,
    toggleReady,
    inviteFriend,
    updatePlayerCount,
    startHand,
    startNewHandIfReady,
    fold,
    callOrCheck,
    raise,
  } = usePokerRoom(supabase, currentUserId)

  const [showInviteModal, setShowInviteModal] = useState(false)
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())
  const [pickedPlayerCount, setPickedPlayerCount] = useState<2 | 3 | 4 | 5 | 6>(2)
  const [raiseAmount, setRaiseAmount] = useState<number>(0)

  // ── Mount: try to resume an active room ──────────────────────────────────
  useEffect(() => {
    const pendingRoomId = sessionStorage.getItem('join_room_id')
    if (pendingRoomId && !room) {
      sessionStorage.removeItem('join_room_id')
      joinRoom(pendingRoomId)
      return
    }
    if (!room) findActiveRoom()
  }, [joinRoom, findActiveRoom, room])

  // ── Status helpers ───────────────────────────────────────────────────────
  const status = room?.status ?? 'lobby'
  const isLobby = status === 'lobby'
  const isPlaying = status === 'playing'
  const isFinished = status === 'finished'
  const isHost = !!(room && room.host_id === currentUserId)

  const playerCount = room?.player_count ?? pickedPlayerCount
  const hasAllPlayers = !!(room && room.player_ids.length === room.player_count)
  const myReady = !!(room && room.ready_ids.includes(currentUserId))
  const allReady = !!(room && room.ready_ids.length === room.player_count && hasAllPlayers)

  const roomState = (room?.state ?? {}) as Partial<PokerRoomState>
  const bettingRound = roomState.betting_round
  const isHandActive = isPlaying && bettingRound &&
    ['preflop', 'flop', 'turn', 'river'].includes(bettingRound)
  const isHandEnd = isPlaying && bettingRound === 'hand_end'

  const myState = playerStates.get(currentUserId)

  const opponentIds = useMemo(() => {
    if (!room) return []
    return room.player_ids.filter(id => id !== currentUserId)
  }, [room, currentUserId])

  const profileById = useMemo(() => {
    const map = new Map<string, Profile | null>()
    if (currentUserProfile) map.set(currentUserId, currentUserProfile)
    for (const id of (room?.player_ids ?? [])) {
      if (!map.has(id)) {
        const p = friendProfiles.find(fp => fp.id === id) ?? null
        map.set(id, p)
      }
    }
    return map
  }, [room, friendProfiles, currentUserProfile, currentUserId])

  const currentPlayerId = useMemo(() => {
    if (!room || typeof roomState.current_player_index !== 'number') return null
    return room.player_ids[roomState.current_player_index] ?? null
  }, [room, roomState.current_player_index])

  const isMyTurn = !!isHandActive && currentPlayerId === currentUserId

  // ── Back button ──────────────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    if (room && (room.status === 'lobby' || room.status === 'finished')) {
      deleteCurrentRoom()
    } else {
      leaveRoom()
    }
    onClose()
  }, [room, deleteCurrentRoom, leaveRoom, onClose])

  // ── Create room ──────────────────────────────────────────────────────────
  const handleCreateRoom = useCallback(async () => {
    await createRoom(pickedPlayerCount)
  }, [createRoom, pickedPlayerCount])

  const handleCreateAndInvite = useCallback(
    async (friendId: string) => {
      let targetRoom = room
      if (!targetRoom) {
        targetRoom = await createRoom(pickedPlayerCount)
      }
      if (!targetRoom) return
      await inviteFriend(friendId, targetRoom.id)
      setInvitedIds(prev => new Set([...prev, friendId]))
    },
    [room, createRoom, inviteFriend, pickedPlayerCount]
  )

  // ── Auto-start (host) when all ready ─────────────────────────────────────
  useEffect(() => {
    if (!room || !isHost) return
    if (room.status !== 'lobby') return
    if (room.player_ids.length !== room.player_count) return
    if (room.ready_ids.length !== room.player_count) return
    startHand()
  }, [room, isHost, startHand])

  // ── Hand-end auto-progression (host only) ────────────────────────────────
  const handEndTimerRef = useRef<number | null>(null)
  const handEndScheduledForHandRef = useRef<number | null>(null)
  useEffect(() => {
    if (!isHost || !isHandEnd || !room) return
    const handNum = roomState.hand_number ?? 0
    if (handEndScheduledForHandRef.current === handNum) return
    handEndScheduledForHandRef.current = handNum
    if (handEndTimerRef.current !== null) {
      window.clearTimeout(handEndTimerRef.current)
    }
    handEndTimerRef.current = window.setTimeout(() => {
      startNewHandIfReady()
      handEndTimerRef.current = null
    }, HAND_END_DELAY_MS)
    return () => {
      if (handEndTimerRef.current !== null) {
        window.clearTimeout(handEndTimerRef.current)
        handEndTimerRef.current = null
      }
    }
  }, [isHost, isHandEnd, roomState.hand_number, room, startNewHandIfReady])

  // Reset scheduled-for marker when hand changes (so next hand_end can fire)
  useEffect(() => {
    if (!isHandEnd) {
      // do nothing here — keep marker until new hand starts
    }
  }, [isHandEnd])

  // ── Reset raise input when betting state changes ─────────────────────────
  useEffect(() => {
    if (!isMyTurn) return
    const cur = roomState.current_bet ?? 0
    const minR = roomState.min_raise ?? BIG_BLIND
    setRaiseAmount(cur + minR)
  }, [isMyTurn, roomState.current_bet, roomState.min_raise])

  // ── Forfeit ──────────────────────────────────────────────────────────────
  // End the game outright (status='finished' with another player as winner).
  // The user can then exit cleanly — back button will delete the finished
  // room, so the next session starts fresh.
  const handleForfeit = useCallback(async () => {
    if (!confirm('Forfeit this game? The other player will win.')) return
    await quitGame()
  }, [quitGame])

  // ── Player count change in lobby (host only) ─────────────────────────────
  const handlePlayerCountChange = useCallback(
    async (count: 2 | 3 | 4 | 5 | 6) => {
      if (!room) {
        setPickedPlayerCount(count)
        return
      }
      if (!isHost || room.status !== 'lobby') return
      if (room.player_ids.length > count) return
      await updatePlayerCount(count)
    },
    [room, isHost, updatePlayerCount]
  )

  // ── Action handlers ──────────────────────────────────────────────────────
  const handleFold = useCallback(() => { fold() }, [fold])

  const handleCallOrCheck = useCallback(() => { callOrCheck() }, [callOrCheck])

  const handleRaise = useCallback(() => {
    raise(raiseAmount)
  }, [raise, raiseAmount])

  // ── Result text (finished) ───────────────────────────────────────────────
  let resultTitle = 'Game over'
  let resultEmoji = '🃏'
  if (isFinished && room) {
    if (room.winner_id === currentUserId) {
      resultTitle = 'You won!'
      resultEmoji = '🏆'
    } else if (room.winner_id) {
      const winnerProfile = profileById.get(room.winner_id) ?? null
      resultTitle = winnerProfile ? `${winnerProfile.display_name} won` : 'You lost'
      resultEmoji = '😔'
    } else {
      resultTitle = 'Game over'
      resultEmoji = '🃏'
    }
  }

  const maxInvitees = playerCount - 1

  // ── Derived values for action buttons ────────────────────────────────────
  const myChips = myState?.chips ?? 0
  const myBet = myState?.current_bet ?? 0
  const roomCurrentBet = roomState.current_bet ?? 0
  const minRaiseDelta = roomState.min_raise ?? BIG_BLIND
  const toCall = Math.max(0, roomCurrentBet - myBet)
  const callIsAllIn = toCall >= myChips && toCall > 0
  const callLabel = toCall === 0 ? 'Check' : (callIsAllIn ? `All-in (${myChips})` : `Call ${toCall}`)
  const minRaiseTotal = roomCurrentBet + minRaiseDelta
  const maxRaiseTotal = myChips + myBet
  const canRaise = maxRaiseTotal > roomCurrentBet
  const pot = roomState.pot ?? 0

  // Quick raise helpers
  const setRaiseQuick = (kind: 'min' | 'half' | 'pot' | 'allin') => {
    if (kind === 'min') setRaiseAmount(Math.min(minRaiseTotal, maxRaiseTotal))
    else if (kind === 'half') setRaiseAmount(Math.min(maxRaiseTotal, Math.max(minRaiseTotal, roomCurrentBet + Math.floor(pot / 2))))
    else if (kind === 'pot') setRaiseAmount(Math.min(maxRaiseTotal, Math.max(minRaiseTotal, roomCurrentBet + pot)))
    else if (kind === 'allin') setRaiseAmount(maxRaiseTotal)
  }

  // ── Showdown lookup ──────────────────────────────────────────────────────
  const showdownByUser = useMemo(() => {
    const m = new Map<string, { rank_name: string; hole_cards: string[]; best_cards: string[] }>()
    for (const s of (roomState.showdown ?? [])) {
      m.set(s.user_id, { rank_name: s.rank_name, hole_cards: s.hole_cards, best_cards: s.best_cards })
    }
    return m
  }, [roomState.showdown])

  const community: string[] = roomState.community_cards ?? []
  const communitySlots: (string | undefined)[] = [0, 1, 2, 3, 4].map(i => community[i])

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="poker-view" style={{ userSelect: 'none' }}>
      {/* Header */}
      <div className="poker-header">
        <button
          className="poker-back-btn chess-back-btn"
          onClick={handleBack}
          aria-label="Go back"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M12.5 15L7.5 10L12.5 5"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <span className="poker-title">Poker</span>
        {isPlaying && isHandActive && myState && !myState.folded && (
          <div className="poker-controls">
            <button
              className="poker-btn poker-btn-forfeit"
              onClick={handleForfeit}
              disabled={!isMyTurn}
              title={!isMyTurn ? 'Wait for your turn' : 'Fold'}
            >
              Forfeit
            </button>
          </div>
        )}
      </div>

      <div className="poker-game-layout">
        {/* Opponents row */}
        <div className="poker-opponents-row">
          {opponentIds.length === 0 ? (
            <div className="poker-opponent" style={{ opacity: 0.5 }}>
              <div className="poker-opponent-name">Waiting…</div>
            </div>
          ) : (
            opponentIds.map((id, idx) => {
              const profile = profileById.get(id) ?? null
              const ps = playerStates.get(id)
              const showdown = showdownByUser.get(id)
              const isTheirTurn = isHandActive && currentPlayerId === id
              const folded = ps?.folded ?? false
              const allIn = ps?.all_in ?? false
              const showdownReveal = !!isHandEnd && !!showdown
              return (
                <div
                  key={id}
                  className={`poker-opponent${folded ? ' folded' : ''}${isTheirTurn ? ' active' : ''}`}
                >
                  <div className="poker-opponent-av-wrap">
                    {profile ? (
                      <Avatar profile={profile} size={28} />
                    ) : (
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#555' }} />
                    )}
                  </div>
                  <span className="poker-opponent-name">
                    {profile?.display_name ?? `Player ${idx + 2}`}
                  </span>
                  <span className="poker-opponent-chips">
                    {ps?.chips ?? '—'} chips
                  </span>
                  {(ps?.current_bet ?? 0) > 0 && (
                    <span className="poker-opponent-bet">Bet {ps?.current_bet}</span>
                  )}
                  {folded && <span className="poker-opponent-status">Folded</span>}
                  {allIn && !folded && <span className="poker-opponent-status">All-in</span>}
                  <div className="poker-opponent-cards">
                    {showdownReveal && showdown && showdown.hole_cards.length >= 2 ? (
                      <>
                        <PlayingCard card={showdown.hole_cards[0]} small />
                        <PlayingCard card={showdown.hole_cards[1]} small />
                      </>
                    ) : isHandActive || isHandEnd ? (
                      folded ? (
                        <>
                          <PlayingCard small />
                          <PlayingCard small />
                        </>
                      ) : (
                        <>
                          <PlayingCard faceDown small />
                          <PlayingCard faceDown small />
                        </>
                      )
                    ) : (
                      <>
                        <PlayingCard small />
                        <PlayingCard small />
                      </>
                    )}
                  </div>
                  {isTheirTurn && (
                    <span className="poker-thinking">thinking…</span>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Table area */}
        <div className="poker-table-area">
          {/* Community cards */}
          <div className="poker-community">
            {communitySlots.map((c, i) => (
              <PlayingCard key={i} card={c} />
            ))}
          </div>

          {/* Pot info */}
          <div className="poker-pot-info">
            <div className="poker-pot-row">
              <span>Pot: {pot}</span>
              {roomCurrentBet > 0 && <span>Bet: {roomCurrentBet}</span>}
              {typeof roomState.hand_number === 'number' && (
                <span>Hand #{roomState.hand_number}</span>
              )}
              {bettingRound && (
                <span>{bettingRound}</span>
              )}
            </div>
          </div>

          {/* Hand-end banner */}
          {isHandEnd && (
            <div className="poker-handend-banner">
              <div className="poker-handend-winner">
                Hand {roomState.hand_number ?? ''} complete
                {roomState.hand_winner_ids && roomState.hand_winner_ids.length > 0 && (
                  <>
                    {' — '}
                    {roomState.hand_winner_ids.map(wid => {
                      const wp = profileById.get(wid) ?? null
                      return wp?.display_name ?? wid.slice(0, 6)
                    }).join(', ')}
                    {' won '}
                    +{roomState.hand_winner_amount ?? 0} chips
                  </>
                )}
              </div>
              {(roomState.showdown ?? []).length > 0 && (
                <div>
                  {(roomState.showdown ?? []).map(s => {
                    const wp = profileById.get(s.user_id) ?? null
                    const isWinner = (roomState.hand_winner_ids ?? []).includes(s.user_id)
                    return (
                      <div key={s.user_id} className={`poker-handend-eval${isWinner ? ' winner' : ''}`}>
                        {wp?.display_name ?? s.user_id.slice(0, 6)}: {s.rank_name}
                        {isWinner && roomState.hand_winner_amount != null && (
                          <span> +{roomState.hand_winner_amount}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Lobby/invite overlay */}
          {!isPlaying && !isFinished && (!room || !hasAllPlayers) && (
            <div className="poker-finish-overlay chess-finish-overlay">
              <div className="poker-finish-card chess-finish-card">
                <div className="poker-finish-emoji">🃏</div>
                <div className="poker-finish-title">Poker</div>
                <div className="poker-player-count-picker">
                  {[2, 3, 4, 5, 6].map(n => (
                    <button
                      key={n}
                      className={`poker-player-count-btn${
                        (room?.player_count ?? pickedPlayerCount) === n ? ' selected' : ''
                      }`}
                      onClick={() => handlePlayerCountChange(n as 2 | 3 | 4 | 5 | 6)}
                      disabled={!!room && (!isHost || (room.player_ids.length > n))}
                    >
                      {n}P
                    </button>
                  ))}
                </div>
                {!room ? (
                  <button
                    className="poker-btn"
                    onClick={handleCreateRoom}
                    disabled={loading}
                  >
                    Create Room
                  </button>
                ) : (
                  isHost && (
                    <button
                      className="poker-btn"
                      onClick={() => setShowInviteModal(true)}
                    >
                      🃏 Invite Friends
                    </button>
                  )
                )}
                {room && (
                  <div className="poker-finish-readystate">
                    {room.player_ids.length} / {room.player_count} joined
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Lobby ready overlay (all players present) */}
          {isLobby && hasAllPlayers && !allReady && (
            <div className="poker-finish-overlay chess-finish-overlay">
              <div className="poker-finish-card chess-finish-card">
                <div className="poker-finish-emoji">🃏</div>
                <div className="poker-finish-title">Ready to play?</div>
                <button
                  className={`poker-ready-btn chess-ready-btn${myReady ? ' ready' : ''}`}
                  onClick={toggleReady}
                  disabled={loading || !room?.player_ids.includes(currentUserId)}
                >
                  {myReady ? '✓ Ready' : 'Ready'}
                </button>
                <div className="poker-finish-readystate">
                  {room!.ready_ids.length} / {room!.player_count} ready
                </div>
              </div>
            </div>
          )}

          {/* Finished overlay */}
          {isFinished && room && (
            <div className="poker-finish-overlay chess-finish-overlay">
              <div className="poker-finish-card chess-finish-card">
                <div className="poker-finish-emoji">{resultEmoji}</div>
                <div className="poker-finish-title">{resultTitle}</div>
                <button
                  className={`poker-ready-btn chess-ready-btn${myReady ? ' ready' : ''}`}
                  onClick={toggleReady}
                >
                  {myReady ? '✓ Ready' : 'Rematch'}
                </button>
                <div className="poker-finish-readystate">
                  {room.ready_ids.length} / {room.player_count} ready
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Self row */}
        <div className="poker-self-row">
          <div className="poker-self-cards">
            {myHoleCards.length >= 2 ? (
              <>
                <PlayingCard card={myHoleCards[0]} />
                <PlayingCard card={myHoleCards[1]} />
              </>
            ) : (
              <>
                <PlayingCard />
                <PlayingCard />
              </>
            )}
          </div>
          <div className="poker-self-info">
            <span className="poker-self-chips">
              {currentUserProfile?.display_name ?? 'You'}: {myState?.chips ?? 0} chips
            </span>
            {(myState?.current_bet ?? 0) > 0 && (
              <span className="poker-self-bet">Bet {myState?.current_bet}</span>
            )}
            {myState?.folded && <span className="poker-opponent-status">Folded</span>}
            {myState?.all_in && !myState.folded && <span className="poker-opponent-status">All-in</span>}
          </div>

          {/* Action buttons */}
          {isMyTurn && myState && !myState.folded && !myState.all_in && (
            <>
              <div className="poker-actions">
                <button
                  className="poker-action-btn poker-action-btn--fold"
                  onClick={handleFold}
                >
                  Fold
                </button>
                <button
                  className="poker-action-btn poker-action-btn--call"
                  onClick={handleCallOrCheck}
                >
                  {callLabel}
                </button>
              </div>
              {canRaise && (
                <div className="poker-raise-controls">
                  <div className="poker-raise-row">
                    <input
                      className="poker-raise-input"
                      type="number"
                      value={raiseAmount}
                      min={minRaiseTotal}
                      max={maxRaiseTotal}
                      step={1}
                      onChange={e => setRaiseAmount(Number(e.target.value) || 0)}
                    />
                    <button
                      className="poker-action-btn poker-action-btn--raise"
                      onClick={handleRaise}
                      disabled={
                        raiseAmount < minRaiseTotal && raiseAmount !== maxRaiseTotal
                        || raiseAmount > maxRaiseTotal
                        || raiseAmount <= roomCurrentBet
                      }
                    >
                      Raise {raiseAmount}
                    </button>
                  </div>
                  <div className="poker-raise-quick">
                    <button onClick={() => setRaiseQuick('min')} type="button">Min</button>
                    <button onClick={() => setRaiseQuick('half')} type="button">½ Pot</button>
                    <button onClick={() => setRaiseQuick('pot')} type="button">Pot</button>
                    <button onClick={() => setRaiseQuick('allin')} type="button">All-in</button>
                  </div>
                </div>
              )}
            </>
          )}

          {isHandActive && !isMyTurn && currentPlayerId && (
            <div className="poker-thinking">
              {(profileById.get(currentPlayerId)?.display_name ?? 'Player')} thinking…
            </div>
          )}
        </div>
      </div>

      {/* Invite modal */}
      {showInviteModal && (
        <InviteModal
          friends={friendProfiles}
          invitedIds={invitedIds}
          maxInvitees={maxInvitees}
          onInvite={id => { handleCreateAndInvite(id) }}
          onClose={() => setShowInviteModal(false)}
        />
      )}
    </div>
  )
}

// Re-export to silence unused-import warnings if cardRank is referenced elsewhere
export { cardRank }
