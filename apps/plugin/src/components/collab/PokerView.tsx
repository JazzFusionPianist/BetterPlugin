import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile, PokerRoomState } from '../../types/collab'
import { usePokerRoom } from '../../hooks/usePokerRoom'
import { cardRank, cardSuit } from '../../hooks/usePoker'
import { useTurnSound } from '../../hooks/useTurnSound'
import { useT } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/translations'
import { computerPlayerIds, computerPlayerName, isComputerPlayerId } from '../../lib/computerPlayers'
import GameShell, { GameOverlayCard, GameReadyControl, GameResultMark } from './GameShell'
import GameChat from './GameChat'

// ─── Constants ────────────────────────────────────────────────────────────────

const BIG_BLIND = 20
const HAND_END_DELAY_MS = 7000
const MAX_PLAYERS = 6

const POKER_RANK_KEYS: Record<string, TKey> = {
  'High Card': 'poker.rankHighCard',
  Pair: 'poker.rankPair',
  'Two Pair': 'poker.rankTwoPair',
  'Three of a Kind': 'poker.rankTrips',
  Straight: 'poker.rankStraight',
  Flush: 'poker.rankFlush',
  'Full House': 'poker.rankFullHouse',
  'Four of a Kind': 'poker.rankQuads',
  'Straight Flush': 'poker.rankStraightFlush',
  'Royal Flush': 'poker.rankRoyalFlush',
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

function PlayingCard({
  card,
  faceDown,
  small,
  highlighted,
}: {
  card?: string
  faceDown?: boolean
  small?: boolean
  highlighted?: boolean
}) {
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
    <div className={`poker-card ${colorClass}${small ? ' small' : ''}${highlighted ? ' highlighted' : ''}`}>
      <span className="poker-card-rank">{rankToDisplay(card)}</span>
      <span className="poker-card-suit">{suitToSymbol(suit)}</span>
    </div>
  )
}

function bestHandLabel(rankName: string, t: (key: TKey) => string): string {
  const key = POKER_RANK_KEYS[rankName]
  return key ? t(key) : rankName
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
  const { t } = useT()
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
    cancelInvite,
    startHand,
    startNewHandIfReady,
    fold,
    callOrCheck,
    computerCallOrCheck,
    raise,
    setRoom,
  } = usePokerRoom(supabase, currentUserId)

  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showForfeitConfirm, setShowForfeitConfirm] = useState(false)
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())
  const [computerOpponents, setComputerOpponents] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [raiseAmount, setRaiseAmount] = useState<number>(0)
  // Suppress lobby UI flicker until the initial join/findActiveRoom completes.
  const [resolving, setResolving] = useState(true)

  // ── Mount: try to resume an active room ──────────────────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const pendingRoomId = sessionStorage.getItem('join_room_id')
      if (pendingRoomId) {
        sessionStorage.removeItem('join_room_id')
        await joinRoom(pendingRoomId)
      } else {
        await findActiveRoom()
      }
      if (!cancelled) setResolving(false)
    })()
    return () => { cancelled = true }
    // Run only on mount — joinRoom/findActiveRoom are stable but listing them
    // would cause re-runs on every state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Status helpers ───────────────────────────────────────────────────────
  const status = room?.status ?? 'lobby'
  const isLobby = status === 'lobby'
  const isPlaying = status === 'playing'
  const isFinished = status === 'finished'
  const isHost = !!(room && room.host_id === currentUserId)

  const joinedCount = room?.player_ids.length ?? 0
  const readyCount = room ? room.ready_ids.filter(id => room.player_ids.includes(id)).length : 0
  const hasEnoughPlayers = joinedCount >= 2
  const myReady = !!(room && room.ready_ids.includes(currentUserId))
  const allReady = !!(room && hasEnoughPlayers && room.player_ids.every(id => room.ready_ids.includes(id)))

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
        const p = isComputerPlayerId(id) ? null : friendProfiles.find(fp => fp.id === id) ?? null
        map.set(id, p)
      }
    }
    return map
  }, [room, friendProfiles, currentUserProfile, currentUserId])
  const chatOpponentId = opponentIds.length === 1 && !isComputerPlayerId(opponentIds[0]) ? opponentIds[0] : null
  const chatOpponentProfile = chatOpponentId ? profileById.get(chatOpponentId) ?? null : null

  const currentPlayerId = useMemo(() => {
    if (!room || typeof roomState.current_player_index !== 'number') return null
    return room.player_ids[roomState.current_player_index] ?? null
  }, [room, roomState.current_player_index])

  const isMyTurn = !!isHandActive && currentPlayerId === currentUserId
  // Chime when it becomes my turn. Active only during a live hand.
  useTurnSound(isMyTurn, 'poker', !!isHandActive)

  // ── Back button ──────────────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    if (room && (room.status === 'lobby' || room.status === 'finished')) {
      deleteCurrentRoom()
    } else {
      leaveRoom()
    }
    onClose()
  }, [room, deleteCurrentRoom, leaveRoom, onClose])

  // ── Invite flow ─────────────────────────────────────────────────────────
  const handleOpenInvite = useCallback(async () => {
    let targetRoom = room
    if (!targetRoom) targetRoom = await createRoom(MAX_PLAYERS as 2 | 3 | 4 | 5 | 6)
    if (!targetRoom) return
    setShowInviteModal(true)
  }, [room, createRoom])

  const handleCreateAndInvite = useCallback(
    async (friendId: string) => {
      // Toggle: re-clicking an already-invited friend cancels the invite.
      if (room && invitedIds.has(friendId)) {
        await cancelInvite(friendId, room.id)
        setInvitedIds(prev => {
          const next = new Set(prev)
          next.delete(friendId)
          return next
        })
        return
      }
      let targetRoom = room
      if (!targetRoom) {
        targetRoom = await createRoom(MAX_PLAYERS as 2 | 3 | 4 | 5 | 6)
      }
      if (!targetRoom) return
      await inviteFriend(friendId, targetRoom.id)
      setInvitedIds(prev => new Set([...prev, friendId]))
    },
    [room, invitedIds, createRoom, inviteFriend, cancelInvite]
  )

  const handlePlayComputer = useCallback(async () => {
    const bots = computerPlayerIds(computerOpponents)
    const playerIds = [currentUserId, ...bots]
    let targetRoom = room
    if (!targetRoom) {
      targetRoom = await createRoom(playerIds.length as 2 | 3 | 4 | 5 | 6)
    }
    if (!targetRoom) return
    const { data, error } = await supabase
      .from('poker_rooms')
      .update({
        player_count: playerIds.length,
        player_ids: playerIds,
        ready_ids: playerIds,
        winner_id: null,
        state: {},
      })
      .eq('id', targetRoom.id)
      .select()
      .single()
    if (error || !data) {
      console.warn('[PokerView.handlePlayComputer]', error)
      return
    }
    setRoom(data)
    await startHand(data)
  }, [computerOpponents, currentUserId, room, createRoom, supabase, startHand, setRoom])

  // ── Auto-start (host) when all ready ─────────────────────────────────────
  useEffect(() => {
    if (!room || !isHost) return
    if (room.status !== 'lobby') return
    if (room.player_ids.length < 2) return
    if (!room.player_ids.every(id => room.ready_ids.includes(id))) return
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

  const computerPokerActionKeyRef = useRef('')
  useEffect(() => {
    if (!isHost || !isHandActive || !currentPlayerId || !isComputerPlayerId(currentPlayerId)) return
    const key = `${room?.id}:${roomState.hand_number}:${roomState.betting_round}:${currentPlayerId}:${roomState.current_player_index}:${roomState.pot}:${roomState.current_bet}`
    if (computerPokerActionKeyRef.current === key) return
    computerPokerActionKeyRef.current = key
    const timer = window.setTimeout(() => {
      computerCallOrCheck(currentPlayerId)
    }, 750 + Math.floor(Math.random() * 900))
    return () => window.clearTimeout(timer)
  }, [isHost, isHandActive, currentPlayerId, room?.id, roomState.hand_number, roomState.betting_round, roomState.current_player_index, roomState.pot, roomState.current_bet, computerCallOrCheck])

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
  // In-app confirm modal — JUCE's WKWebView blocks window.confirm,
  // so the native call silently no-op'd inside the plugin.
  const handleForfeit = useCallback(() => {
    setShowForfeitConfirm(true)
  }, [])
  const confirmForfeit = useCallback(async () => {
    setShowForfeitConfirm(false)
    await quitGame()
  }, [quitGame])

  // ── Action handlers ──────────────────────────────────────────────────────
  const handleFold = useCallback(() => { fold() }, [fold])

  const handleCallOrCheck = useCallback(() => { callOrCheck() }, [callOrCheck])

  const handleRaise = useCallback(() => {
    raise(raiseAmount)
  }, [raise, raiseAmount])

  // ── Result text (finished) ───────────────────────────────────────────────
  let resultTitle = t('poker.gameOver')
  let resultMark: 'win' | 'loss' | 'draw' = 'draw'
  if (isFinished && room) {
    if (room.winner_id === currentUserId) {
      resultTitle = t('poker.youWon')
      resultMark = 'win'
    } else if (room.winner_id) {
      const winnerProfile = profileById.get(room.winner_id) ?? null
      resultTitle = winnerProfile ? t('poker.playerWon', { name: winnerProfile.display_name }) : t('poker.youLost')
      resultMark = 'loss'
    } else {
      resultTitle = t('poker.gameOver')
      resultMark = 'draw'
    }
  }

  const pendingInviteCount = [...invitedIds].filter(id => !(room?.player_ids ?? []).includes(id)).length
  const canInviteMore = (id: string) =>
    invitedIds.has(id) || ((room?.player_ids.length ?? 1) + pendingInviteCount < MAX_PLAYERS)

  // ── Derived values for action buttons ────────────────────────────────────
  const myChips = myState?.chips ?? 0
  const myBet = myState?.current_bet ?? 0
  const roomCurrentBet = roomState.current_bet ?? 0
  const minRaiseDelta = roomState.min_raise ?? BIG_BLIND
  const toCall = Math.max(0, roomCurrentBet - myBet)
  const callIsAllIn = toCall >= myChips && toCall > 0
  const callLabel = toCall === 0
    ? t('poker.check')
    : (callIsAllIn ? t('poker.callAllInChips', { chips: myChips }) : t('poker.call', { amount: toCall }))
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

  // ── Overlay (resolving / lobby → ready → finished); null while playing ────
  let overlay: React.ReactNode = null
  if (resolving && !room) {
    overlay = <GameOverlayCard emoji="🃏" title={t('common.joining')} />
  } else if (isFinished && room) {
    overlay = (
      <GameOverlayCard emoji={<GameResultMark result={resultMark} />} title={resultTitle}>
        <GameReadyControl
          ready={myReady}
          count={`${readyCount} / ${joinedCount} ready`}
          onToggle={toggleReady}
        />
      </GameOverlayCard>
    )
  } else if (isLobby && room && !allReady) {
    overlay = (
      <GameOverlayCard emoji="🃏" title={t('game.readyToPlay')}>
        <GameReadyControl
          ready={myReady}
          count={`${readyCount} / ${joinedCount} ready`}
          onToggle={toggleReady}
          disabled={loading || !room?.player_ids.includes(currentUserId)}
        />
        {isHost && (
          <button
            className="game-invite-btn"
            onClick={handleOpenInvite}
            disabled={loading || (room.player_ids.length + pendingInviteCount >= MAX_PLAYERS)}
          >
            {t('game.inviteFriends')}
          </button>
        )}
        {isHost && (
          <>
            <div className="game-computer-picker" aria-label={t('game.computerCount')}>
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  className={`game-computer-count${computerOpponents === n ? ' selected' : ''}`}
                  onClick={() => setComputerOpponents(n as 1 | 2 | 3 | 4 | 5)}
                  type="button"
                >
                  1:{n}
                </button>
              ))}
            </div>
            <button className="game-invite-btn game-computer-btn" onClick={handlePlayComputer} disabled={loading}>
              {t('game.playComputer')}
            </button>
          </>
        )}
        {!hasEnoughPlayers && (
          <div className="game-finish-readystate">{t('chess.waitingForFriend')}</div>
        )}
        <div className="game-finish-readystate">
          {joinedCount} / {MAX_PLAYERS} joined
        </div>
      </GameOverlayCard>
    )
  } else if (!resolving && !isPlaying && !isFinished && !room) {
    overlay = (
      <GameOverlayCard emoji="🃏" title={t('game.poker')}>
        <button
          className="game-invite-btn"
          onClick={handleOpenInvite}
          disabled={loading}
        >
          {t('game.inviteFriends')}
        </button>
        <div className="game-computer-picker" aria-label={t('game.computerCount')}>
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              className={`game-computer-count${computerOpponents === n ? ' selected' : ''}`}
              onClick={() => setComputerOpponents(n as 1 | 2 | 3 | 4 | 5)}
              type="button"
            >
              1:{n}
            </button>
          ))}
        </div>
        <button className="game-invite-btn game-computer-btn" onClick={handlePlayComputer} disabled={loading}>
          {t('game.playComputer')}
        </button>
      </GameOverlayCard>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <GameShell
      title={t('game.poker')}
      onBack={handleBack}
      controls={isPlaying ? (
        <button
          className="game-btn game-btn-danger"
          onClick={handleForfeit}
          title={t('poker.forfeitTip')}
        >
          {t('poker.forfeit')}
        </button>
      ) : undefined}
      fillBoard
      board={
        <div className="poker-game-layout">
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
                  <span className="poker-opponent-name">
                    {profile?.display_name ?? (isComputerPlayerId(id) ? computerPlayerName(id) : `Player ${idx + 2}`)}
                  </span>
                  <span className="poker-opponent-chips">
                    {ps?.chips ?? '—'} chips
                  </span>
                  {(ps?.current_bet ?? 0) > 0 && (
                    <span className="poker-opponent-bet">Bet {ps?.current_bet}</span>
                  )}
                  {folded && <span className="poker-opponent-status">{t('poker.folded')}</span>}
                  {allIn && !folded && <span className="poker-opponent-status">{t('poker.allInShort')}</span>}
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
                    <span className="poker-thinking">{t('common.thinking')}</span>
                  )}
                </div>
              )
            })
          )}
        </div>
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
          {isHandEnd && (() => {
            const winners = (roomState.hand_winner_ids ?? [])
            const amount = roomState.hand_winner_amount ?? 0
            const winnerNames = winners.map(wid => {
              const wp = profileById.get(wid) ?? null
              return wp?.display_name ?? wid.slice(0, 6)
            })
            const iWon = winners.includes(currentUserId)
            const showdown = [...(roomState.showdown ?? [])].sort((a, b) => {
              const aw = winners.includes(a.user_id) ? 0 : 1
              const bw = winners.includes(b.user_id) ? 0 : 1
              if (aw !== bw) return aw - bw
              return (room?.player_ids.indexOf(a.user_id) ?? 0) - (room?.player_ids.indexOf(b.user_id) ?? 0)
            })
            const resultText = winners.length === 0
              ? t('poker.handComplete')
              : winners.length > 1
                ? t('poker.splitPot', { names: winnerNames.join(' & '), amount })
                : iWon
                  ? t('poker.youWinPot', { amount })
                  : t('poker.playerWinsPot', { name: winnerNames[0] ?? '', amount })
            return (
              <div className="poker-handend-banner">
                <div className={`poker-handend-status${iWon ? ' win' : winners.length > 0 ? 'loss' : 'draw'}`}>
                  {iWon ? 'WIN' : winners.length > 0 ? 'LOSS' : 'DRAW'}
                </div>
                <div className="poker-handend-headline">
                  {resultText}
                </div>
                <div className="poker-handend-sub">
                  {t('poker.showdown')} · {t('poker.handNumber', { n: roomState.hand_number ?? '' })}
                </div>
                {showdown.length > 0 && (
                  <div className="poker-showdown-list">
                    {showdown.map(s => {
                      const wp = profileById.get(s.user_id) ?? null
                      const isWinner = winners.includes(s.user_id)
                      const bestCards = new Set(s.best_cards)
                      const rankLabel = bestHandLabel(s.rank_name, t)
                      return (
                        <div
                          key={s.user_id}
                          className={`poker-showdown-player${isWinner ? ' winner' : ''}`}
                        >
                          <div className="poker-showdown-player-head">
                            <div className="poker-showdown-name">
                              {wp?.display_name ?? s.user_id.slice(0, 6)}
                            </div>
                            <div className={`poker-showdown-badge${isWinner ? ' winner' : ''}`}>
                              {isWinner ? t('poker.winner') : t('poker.revealed')}
                            </div>
                          </div>
                          <div className="poker-showdown-rank">{rankLabel}</div>
                          <div className="poker-showdown-cards-row">
                            <span>{t('poker.holeCards')}</span>
                            <div className="poker-showdown-cards">
                              {s.hole_cards.map(card => (
                                <PlayingCard key={card} card={card} small highlighted={bestCards.has(card)} />
                              ))}
                            </div>
                          </div>
                          <div className="poker-showdown-cards-row">
                            <span>{t('poker.bestFive')}</span>
                            <div className="poker-showdown-cards">
                              {s.best_cards.map(card => (
                                <PlayingCard key={card} card={card} small highlighted />
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })()}
        </div>
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
            {myState?.folded && <span className="poker-opponent-status">{t('poker.folded')}</span>}
            {myState?.all_in && !myState.folded && <span className="poker-opponent-status">{t('poker.allInShort')}</span>}
          </div>

          {/* Action buttons */}
          {isMyTurn && myState && !myState.folded && !myState.all_in && (
            <>
              <div className="poker-actions">
                <button
                  className="poker-action-btn poker-action-btn--fold"
                  onClick={handleFold}
                >
                  {t('poker.fold')}
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
                      {t('poker.raise')} {raiseAmount}
                    </button>
                  </div>
                  <div className="poker-raise-quick">
                    <button onClick={() => setRaiseQuick('min')} type="button">{t('poker.min')}</button>
                    <button onClick={() => setRaiseQuick('half')} type="button">½ Pot</button>
                    <button onClick={() => setRaiseQuick('pot')} type="button">{t('poker.pot')}</button>
                    <button onClick={() => setRaiseQuick('allin')} type="button">{t('poker.allInShort')}</button>
                  </div>
                </div>
              )}
            </>
          )}

          {isHandActive && !isMyTurn && currentPlayerId && (
            <div className="poker-thinking">
              {t('poker.playerThinking', { name: profileById.get(currentPlayerId)?.display_name ?? '' })}
            </div>
          )}
        </div>
        </div>
      }
      overlay={overlay}
      chat={
        <GameChat
          supabase={supabase}
          currentUserId={currentUserId}
          otherUserId={chatOpponentId}
          otherName={chatOpponentProfile?.display_name}
        />
      }
      invite={{
        open: showInviteModal,
        onClose: () => setShowInviteModal(false),
        friends: friendProfiles,
        invitedIds,
        onInvite: id => { handleCreateAndInvite(id) },
        canInvite: canInviteMore,
      }}
      confirm={{
        open: showForfeitConfirm,
        message: t('confirm.forfeitPoker'),
        confirmLabel: t('poker.forfeit'),
        onConfirm: confirmForfeit,
        onCancel: () => setShowForfeitConfirm(false),
      }}
    />
  )
}

// Re-export to silence unused-import warnings if cardRank is referenced elsewhere
export { cardRank }
