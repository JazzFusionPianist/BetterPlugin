'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile, YachtState } from '@/lib/games/types'
import { useYachtRoom } from '@/lib/games/useYachtRoom'
import {
  scoreCategory,
  upperTotal,
  upperBonus,
  cardTotal,
  cardComplete,
  emptyCard,
  botHolds,
  botPickCategory,
} from '@/lib/games/yacht'
import type { YachtCard } from '@/lib/games/yacht'
import { useT } from '@/lib/games/i18n'
import { useWorldScores } from '@/lib/games/useWorldScores'
import type { WorldStanding } from '@/lib/games/useWorldScores'
import { computerPlayerIds, computerPlayerName, isComputerPlayerId } from '@/lib/games/computerPlayers'
import GameShell, { GameOverlayCard, GameReadyControl, GameResultMark } from './GameShell'
import GameChat from './GameChat'

const MAX_PLAYERS = 4
const CAT_LABELS = [
  'ones', 'twos', 'threes', 'fours', 'fives', 'sixes',
  'choice', '4 of a kind', 'full house', 'sm. straight', 'bg. straight', 'yacht',
]

// ─── Die ──────────────────────────────────────────────────────────────────────

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[26, 26], [50, 50], [74, 74]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[30, 26], [70, 26], [30, 50], [70, 50], [30, 74], [70, 74]],
}

function Die({ idx, value, held, tumbling, landed, onClick, disabled, refCb }: {
  idx: number
  value: number
  held: boolean
  tumbling?: boolean
  landed?: boolean
  onClick?: () => void
  disabled?: boolean
  refCb?: (el: HTMLButtonElement | null) => void
}) {
  // Every die comes to rest at its own small tilt — thrown, not typeset.
  const rest = ((idx * 37 + value * 13) % 9) - 4
  return (
    <button
      type="button"
      ref={refCb}
      data-die-idx={idx}
      className={`yacht-die${held ? ' held' : ''}${value === 0 ? ' blank' : ''}${tumbling ? ' tumble' : ''}${landed ? ' land' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={value === 0 ? 'die' : `die showing ${value}`}
    >
      <span className="yacht-die-body" style={{ transform: value > 0 && !tumbling ? `rotate(${rest}deg)` : undefined }}>
        {/* The die face stays paper-white on every wall, so the pips are
            always INK — held dice flip both to klein blue. */}
        <svg viewBox="0 0 100 100">
          <rect x="4" y="4" width="92" height="92" rx="18"
            fill="#FFFFFF"
            stroke={value === 0 ? '#8A8782' : held ? '#2440FF' : '#1A1917'}
            strokeWidth="3"
            strokeDasharray={value === 0 ? '7 7' : undefined} />
          {(PIPS[value] ?? []).map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="9.5" fill={held ? '#2440FF' : '#1A1917'} />
          ))}
        </svg>
      </span>
      <span className="yacht-die-shadow" aria-hidden="true" />
    </button>
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

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function YachtView({
  supabase,
  currentUserId,
  currentUserProfile,
  friendProfiles,
  onClose,
}: Props) {
  const { t } = useT()
  const {
    room, loading,
    createRoom, joinRoom, leaveRoom, deleteCurrentRoom, findActiveRoom,
    toggleReady, startGame, writeState, endGame, inviteFriend, cancelInvite,
  } = useYachtRoom(supabase, currentUserId)
  const { submitScore, loadStanding } = useWorldScores(supabase, currentUserId, 'yacht_scores')

  const [showInviteModal, setShowInviteModal] = useState(false)
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())
  const [computerOpponents, setComputerOpponents] = useState<1 | 2 | 3>(1)
  const [startPending, setStartPending] = useState(false)
  // ── Presentation: tumbling dice, landing bounce, FLIP to the shelf ──
  const [tumbling, setTumbling] = useState<Set<number>>(new Set())
  const [landedSet, setLandedSet] = useState<Set<number>>(new Set())
  const [flicker, setFlicker] = useState<number[]>([1, 1, 1, 1, 1])
  const tumbleTimers = useRef<number[]>([])
  const dieRefs = useRef<Map<number, HTMLElement>>(new Map())
  const lastRects = useRef<Map<number, DOMRect>>(new Map())
  const [ledgerOpen, setLedgerOpen] = useState(false)
  const [stampSeq, setStampSeq] = useState<{ cat: number; seq: number } | null>(null)

  // Solo run
  const [solo, setSolo] = useState(false)
  const [soloState, setSoloState] = useState<YachtState | null>(null)
  const [standing, setStanding] = useState<WorldStanding | null>(null)
  const [soloSubmitting, setSoloSubmitting] = useState(false)
  const soloSubmittedRef = useRef(false)

  // FLIP: whenever a die moves between the table and the keep shelf, it
  // slides there instead of teleporting.
  useEffect(() => {
    const map = dieRefs.current
    for (const [i, el] of map) {
      const prev = lastRects.current.get(i)
      const now = el.getBoundingClientRect()
      if (prev && (Math.abs(prev.left - now.left) > 2 || Math.abs(prev.top - now.top) > 2)) {
        const dx = prev.left - now.left
        const dy = prev.top - now.top
        el.style.transition = 'none'
        el.style.transform = `translate(${dx}px, ${dy}px)`
        requestAnimationFrame(() => {
          el.style.transition = 'transform 0.34s cubic-bezier(0.2, 1, 0.3, 1)'
          el.style.transform = ''
        })
      }
      lastRects.current.set(i, now)
    }
  })

  // ── Mount: resume ─────────────────────────────────────────────────────────
  useEffect(() => {
    const pendingRoomId = sessionStorage.getItem('join_room_id')
    if (pendingRoomId && !room) {
      sessionStorage.removeItem('join_room_id')
      joinRoom(pendingRoomId)
      return
    }
    if (!room) findActiveRoom()
  }, [joinRoom, findActiveRoom, room])

  useEffect(() => {
    let cancelled = false
    loadStanding().then(s => { if (!cancelled && s) setStanding(s) })
    return () => { cancelled = true }
  }, [loadStanding])

  // ── Status ────────────────────────────────────────────────────────────────
  const status = room?.status ?? 'lobby'
  const isLobby = status === 'lobby'
  const isPlaying = status === 'playing' && !solo
  const isFinished = status === 'finished' && !solo
  const isHost = !!(room && room.host_id === currentUserId)
  const playerIds = useMemo(() => room?.player_ids ?? [], [room])

  const st: YachtState | null = solo
    ? soloState
    : isPlaying || isFinished
      ? (room?.state && 'cards' in (room.state as object) ? room.state as YachtState : null)
      : null

  const ids = solo ? [currentUserId] : playerIds
  const currentTurnId = st ? ids[st.turn] ?? null : null
  const myTurn = solo || (isPlaying && currentTurnId === currentUserId)
  const rolled = !!st && st.rollsLeft < 3
  const soloOver = solo && !!soloState && cardComplete(soloState.cards[currentUserId] ?? [])

  const joinedCount = playerIds.length
  const readyCount = room ? room.ready_ids.filter(id => playerIds.includes(id)).length : 0
  const hasEnoughPlayers = joinedCount >= 2
  const myReady = !!(room && room.ready_ids.includes(currentUserId))
  const allReady = !!(room && hasEnoughPlayers && playerIds.every(id => room.ready_ids.includes(id)))
  const isComputerMatch = playerIds.some(isComputerPlayerId)

  const nameFor = useCallback((id: string): string => {
    if (id === currentUserId) return currentUserProfile?.display_name ?? 'me'
    if (isComputerPlayerId(id)) return computerPlayerName(id)
    return friendProfiles.find(p => p.id === id)?.display_name ?? 'player'
  }, [currentUserId, currentUserProfile, friendProfiles])

  // ── Tumble: any time dice change with a roll spent, the fresh dice
  //    flicker faces and land one after another (remote rolls included). ──
  const prevRollRef = useRef<{ rollsLeft: number; turn: number } | null>(null)
  useEffect(() => {
    if (!st) { prevRollRef.current = null; return }
    const prev = prevRollRef.current
    prevRollRef.current = { rollsLeft: st.rollsLeft, turn: st.turn }
    const rolledNow = prev && prev.turn === st.turn && st.rollsLeft < prev.rollsLeft
    if (!rolledNow) return
    const idxs = st.dice.map((_, i) => i).filter(i => !st.held[i])
    if (idxs.length === 0) return
    for (const t of tumbleTimers.current) window.clearTimeout(t)
    tumbleTimers.current = []
    setTumbling(new Set(idxs))
    setLandedSet(new Set())
    const flickerIv = window.setInterval(() => {
      setFlicker(f => f.map(() => 1 + Math.floor(Math.random() * 6)))
    }, 70)
    tumbleTimers.current.push(flickerIv as unknown as number)
    idxs.forEach((idx, k) => {
      const t = window.setTimeout(() => {
        setTumbling(prev2 => {
          const n = new Set(prev2); n.delete(idx)
          if (n.size === 0) window.clearInterval(flickerIv)
          return n
        })
        setLandedSet(prev2 => new Set(prev2).add(idx))
        const t2 = window.setTimeout(() => {
          setLandedSet(prev2 => { const n = new Set(prev2); n.delete(idx); return n })
        }, 340)
        tumbleTimers.current.push(t2 as unknown as number)
      }, 430 + k * 120)
      tumbleTimers.current.push(t as unknown as number)
    })
    return () => {
      window.clearInterval(flickerIv)
    }
  }, [st?.rollsLeft, st?.turn, st?.dice])
  useEffect(() => () => { for (const t of tumbleTimers.current) window.clearTimeout(t) }, [])
  const animating = tumbling.size > 0

  // The ledger presents itself when the last roll settles (you must write),
  // and retires when the turn passes on.
  useEffect(() => {
    if (myTurn && rolled && st?.rollsLeft === 0 && !animating) setLedgerOpen(true)
  }, [myTurn, rolled, st?.rollsLeft, animating])
  useEffect(() => {
    if (!myTurn) setLedgerOpen(false)
  }, [myTurn, st?.turn])

  // ── Turn helpers ─────────────────────────────────────────────────────────
  const freshTurn = (s: YachtState): YachtState => ({
    ...s,
    dice: [0, 0, 0, 0, 0],
    held: [false, false, false, false, false],
    rollsLeft: 3,
  })

  const advance = useCallback((s: YachtState, memberIds: string[]): { st: YachtState; finished: boolean } => {
    const nextTurn = (s.turn + 1) % memberIds.length
    const round = nextTurn === 0 ? s.round + 1 : s.round
    return { st: freshTurn({ ...s, turn: nextTurn, round }), finished: round > 12 }
  }, [])

  const winnerOf = useCallback((s: YachtState, memberIds: string[]): string | null => {
    let best: string | null = null
    let bestScore = -1
    let tied = false
    for (const id of memberIds) {
      const total = cardTotal(s.cards[id] ?? emptyCard())
      if (total > bestScore) { best = id; bestScore = total; tied = false }
      else if (total === bestScore) tied = true
    }
    return tied ? null : best
  }, [])

  // ── Actions (mine) ───────────────────────────────────────────────────────
  const doRoll = useCallback(() => {
    if (!st || !myTurn || st.rollsLeft <= 0) return
    const dice = st.dice.map((d, i) => (st.held[i] && d > 0 ? d : 1 + Math.floor(Math.random() * 6)))
    const next: YachtState = { ...st, dice, rollsLeft: st.rollsLeft - 1 }
    if (solo) setSoloState(next)
    else writeState(next)
  }, [st, myTurn, solo, writeState])

  const toggleHold = useCallback((i: number) => {
    if (!st || !myTurn || !rolled || st.rollsLeft === 0) return   // nothing to protect after the last roll
    const held = st.held.slice()
    held[i] = !held[i]
    const next = { ...st, held }
    if (solo) setSoloState(next)
    else writeState(next)
  }, [st, myTurn, rolled, solo, writeState])

  const pickCategory = useCallback((cat: number) => {
    if (!st || !myTurn || !rolled) return
    const me = solo ? currentUserId : currentTurnId
    if (!me) return
    const card = (st.cards[me] ?? emptyCard()).slice()
    if (card[cat] !== null) return
    card[cat] = scoreCategory(cat, st.dice)
    setStampSeq(s => ({ cat, seq: (s?.seq ?? 0) + 1 }))
    window.setTimeout(() => setLedgerOpen(false), 520)
    const withCard: YachtState = { ...st, cards: { ...st.cards, [me]: card } }
    if (solo) {
      if (cardComplete(card)) setSoloState(withCard)
      else setSoloState(freshTurn(withCard))
      return
    }
    const { st: adv, finished } = advance(withCard, ids)
    if (finished) endGame(winnerOf(withCard, ids), withCard)
    else writeState(adv)
  }, [st, myTurn, rolled, solo, currentUserId, currentTurnId, ids, advance, winnerOf, endGame, writeState])

  // ── Bots (host drives them, one visible action per tick) ────────────────
  useEffect(() => {
    if (!room || !isPlaying || !isHost || !st) return
    const cur = ids[st.turn]
    if (!cur || !isComputerPlayerId(cur)) return
    const timer = window.setTimeout(() => {
      const s = st
      const card = s.cards[cur] ?? emptyCard()
      if (s.rollsLeft === 3) {
        const dice = s.dice.map(() => 1 + Math.floor(Math.random() * 6))
        writeState({ ...s, dice, rollsLeft: 2 })
        return
      }
      const holds = botHolds(s.dice, card)
      if (s.rollsLeft > 0 && !holds.every(Boolean)) {
        const dice = s.dice.map((d, i) => (holds[i] ? d : 1 + Math.floor(Math.random() * 6)))
        writeState({ ...s, dice, held: holds, rollsLeft: s.rollsLeft - 1 })
        return
      }
      const cat = botPickCategory(s.dice, card)
      const nextCard = card.slice()
      nextCard[cat] = scoreCategory(cat, s.dice)
      const withCard: YachtState = { ...s, cards: { ...s.cards, [cur]: nextCard } }
      const { st: adv, finished } = advance(withCard, ids)
      if (finished) endGame(winnerOf(withCard, ids), withCard)
      else writeState(adv)
    }, 850)
    return () => window.clearTimeout(timer)
  }, [room, isPlaying, isHost, st, ids, advance, winnerOf, endGame, writeState])

  // ── Solo flow ────────────────────────────────────────────────────────────
  const startSolo = useCallback(() => {
    if (room && room.status !== 'playing') deleteCurrentRoom()
    soloSubmittedRef.current = false
    setSolo(true)
    setSoloState({
      turn: 0,
      round: 1,
      dice: [0, 0, 0, 0, 0],
      held: [false, false, false, false, false],
      rollsLeft: 3,
      cards: { [currentUserId]: emptyCard() },
    })
  }, [room, deleteCurrentRoom, currentUserId])

  useEffect(() => {
    if (!soloOver || soloSubmittedRef.current || !soloState) return
    soloSubmittedRef.current = true
    setSoloSubmitting(true)
    submitScore(cardTotal(soloState.cards[currentUserId] ?? [])).then(s => {
      if (s) setStanding(s)
      setSoloSubmitting(false)
    })
  }, [soloOver, soloState, submitScore, currentUserId])

  // ── Lobby / invite plumbing (same shape as falling blocks) ──────────────
  const handleBack = useCallback(() => {
    if (room && (room.status === 'lobby' || room.status === 'finished')) deleteCurrentRoom()
    else leaveRoom()
    onClose()
  }, [room, deleteCurrentRoom, leaveRoom, onClose])

  const handleOpenInvite = useCallback(async () => {
    setSolo(false)
    let target = room
    if (!target) target = await createRoom(MAX_PLAYERS as 2 | 3 | 4)
    if (!target) return
    setShowInviteModal(true)
  }, [room, createRoom])

  const handleCreateAndInvite = useCallback(async (friendId: string) => {
    if (room && invitedIds.has(friendId)) {
      await cancelInvite(friendId, room.id)
      setInvitedIds(prev => { const n = new Set(prev); n.delete(friendId); return n })
      return
    }
    let target = room
    if (!target) target = await createRoom(MAX_PLAYERS as 2 | 3 | 4)
    if (!target) return
    await inviteFriend(friendId, target.id)
    setInvitedIds(prev => new Set([...prev, friendId]))
  }, [room, invitedIds, createRoom, inviteFriend, cancelInvite])

  const handlePlayComputer = useCallback(async () => {
    setStartPending(true)
    try {
      setSolo(false)
      const bots = computerPlayerIds(computerOpponents)
      const idsAll = [currentUserId, ...bots]
      let target = room
      if (!target) target = await createRoom(idsAll.length as 2 | 3 | 4)
      if (!target) { setStartPending(false); return }
      await startGame({
        ...target,
        player_count: idsAll.length as 2 | 3 | 4,
        player_ids: idsAll,
        ready_ids: idsAll,
        winner_id: null,
      })
    } catch (e) {
      console.error('[YachtView.handlePlayComputer]', e)
      setStartPending(false)
    }
  }, [computerOpponents, currentUserId, room, createRoom, startGame])

  useEffect(() => { if (status === 'playing') setStartPending(false) }, [status])

  useEffect(() => {
    if (!room || !isHost) return
    if (room.status !== 'lobby' && room.status !== 'finished') return
    if (room.player_ids.length < 2) return
    if (!room.player_ids.every(id => room.ready_ids.includes(id))) return
    startGame()
  }, [room, isHost, startGame])

  const chatOpponentId = playerIds.length === 2 && !isComputerMatch
    ? playerIds.find(id => id !== currentUserId) ?? null : null

  // ── Scorecard render data ────────────────────────────────────────────────
  const cards: Record<string, YachtCard> = st?.cards ?? {}
  const previewFor = (cat: number): number | null => {
    if (!st || !myTurn || !rolled) return null
    const me = solo ? currentUserId : currentUserId
    const card = cards[me]
    if (!card || card[cat] !== null) return null
    if (!solo && currentTurnId !== currentUserId) return null
    return scoreCategory(cat, st.dice)
  }

  const pendingInviteCount = [...invitedIds].filter(id => !playerIds.includes(id)).length
  const canInviteMore = (id: string) =>
    invitedIds.has(id) || ((playerIds.length || 1) + pendingInviteCount < MAX_PLAYERS)

  // ── Leaderboard block (solo start + solo over) ──────────────────────────
  const leaderboardBlock = (
    <div className="pb-lb">
      <div className="pb-lb-title">{t('pb.leaderboard')}</div>
      {soloSubmitting && <div className="pb-lb-loading">…</div>}
      {!soloSubmitting && standing && standing.top.length > 0 && (
        <div className="pb-lb-rows">
          {standing.top.map((row, i) => (
            <div key={row.user_id} className={`pb-lb-row${row.user_id === currentUserId ? ' me' : ''}`}>
              <span className="pb-lb-rank">{i + 1}</span>
              <span className="pb-lb-name">{row.display_name}</span>
              <span className="pb-lb-score">{row.best_score.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
      {!soloSubmitting && standing && (
        <div className="pb-lb-mine">
          {t('pb.yourBest')} {standing.myBest.toLocaleString()}
          {standing.myRank != null && standing.totalPlayers > 0 && (
            <> · {t('pb.rank')} {standing.myRank}/{standing.totalPlayers}</>
          )}
        </div>
      )}
    </div>
  )

  // ── Overlays ─────────────────────────────────────────────────────────────
  let overlay: React.ReactNode = null
  if (startPending) {
    overlay = null
  } else if (solo && soloOver && soloState) {
    overlay = (
      <GameOverlayCard title={t('pb.gameOver')} className="pb-overlay-card">
        <div className="pb-final-score">{cardTotal(soloState.cards[currentUserId] ?? []).toLocaleString()}</div>
        {standing?.isNewBest && <div className="pb-newbest">{t('pb.newBest')}</div>}
        {leaderboardBlock}
        <button className="game-invite-btn pb-start-btn" onClick={startSolo}>
          {t('pb.playAgain')}
        </button>
      </GameOverlayCard>
    )
  } else if (isFinished && room && st) {
    const rows = ids
      .map(id => ({ id, name: nameFor(id), score: cardTotal(st.cards[id] ?? emptyCard()) }))
      .sort((a, b) => b.score - a.score)
    const mark: 'win' | 'loss' | 'draw' = room.winner_id === currentUserId ? 'win' : room.winner_id ? 'loss' : 'draw'
    overlay = (
      <GameOverlayCard
        emoji={<GameResultMark result={mark} />}
        title={room.winner_id === currentUserId ? t('chess.youWon')
          : room.winner_id ? t('fb.playerWon', { name: nameFor(room.winner_id) })
          : t('chess.drawResult')}
      >
        <div className="fb-final-scores">
          {rows.map((row, i) => (
            <div key={row.id} className={`fb-final-score-row${row.id === currentUserId ? ' me' : ''}`}>
              <span className="fb-final-score-name">{row.name}</span>
              <span className="fb-final-score-value">
                {row.score.toLocaleString()}
                {i > 0 && <span className="fb-final-score-diff">−{(rows[0].score - row.score).toLocaleString()}</span>}
              </span>
            </div>
          ))}
        </div>
        {isComputerMatch ? (
          <GameReadyControl ready={false} label={t('common.rematch')} onToggle={handlePlayComputer} />
        ) : (
          <GameReadyControl ready={myReady} count={`${readyCount} / ${joinedCount} ready`} onToggle={toggleReady} />
        )}
      </GameOverlayCard>
    )
  } else if (!solo && isLobby && room && !allReady) {
    overlay = (
      <GameOverlayCard emoji="🎲" title={t('game.readyToPlay')}>
        <GameReadyControl
          ready={myReady}
          count={`${readyCount} / ${joinedCount} ready`}
          onToggle={toggleReady}
          disabled={loading}
        />
        {isHost && (
          <button
            className="game-invite-btn"
            onClick={handleOpenInvite}
            disabled={loading || (playerIds.length + pendingInviteCount >= MAX_PLAYERS)}
          >
            {t('game.inviteFriends')}
          </button>
        )}
        {isHost && (
          <>
            <div className="game-computer-picker" aria-label={t('game.computerCount')}>
              {[1, 2, 3].map(n => (
                <button key={n}
                  className={`game-computer-count${computerOpponents === n ? ' selected' : ''}`}
                  onClick={() => setComputerOpponents(n as 1 | 2 | 3)} type="button">
                  1:{n}
                </button>
              ))}
            </div>
            <button className="game-invite-btn game-computer-btn" onClick={handlePlayComputer} disabled={loading}>
              {t('game.playComputer')}
            </button>
          </>
        )}
        {!hasEnoughPlayers && <div className="game-finish-readystate">{t('chess.waitingForFriend')}</div>}
        <div className="game-finish-readystate">{joinedCount} / {MAX_PLAYERS} joined</div>
      </GameOverlayCard>
    )
  } else if (!solo && !isPlaying && !isFinished && !room) {
    overlay = (
      <GameOverlayCard title={t('game.yacht')} className="pb-overlay-card">
        {leaderboardBlock}
        <button className="game-invite-btn pb-start-btn" onClick={startSolo} disabled={loading}>
          {t('fb.playSolo')}
        </button>
        <button className="game-invite-btn game-computer-btn" onClick={handleOpenInvite} disabled={loading}>
          {t('game.inviteFriends')}
        </button>
        <div className="game-computer-picker" aria-label={t('game.computerCount')}>
          {[1, 2, 3].map(n => (
            <button key={n}
              className={`game-computer-count${computerOpponents === n ? ' selected' : ''}`}
              onClick={() => setComputerOpponents(n as 1 | 2 | 3)} type="button">
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

  // ── Status line ──────────────────────────────────────────────────────────
  const statusLine = st && !solo
    ? myTurn ? t('y.yourTurn') : t('y.turnOf', { name: nameFor(currentTurnId ?? '') })
    : null

  const showBoard = (solo && soloState) || isPlaying || isFinished

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <GameShell
      title={t('game.yacht')}
      onBack={handleBack}
      className="yacht-shell"
      controls={solo && !soloOver ? (
        <button className="game-btn" onClick={startSolo}>{t('pb.reset')}</button>
      ) : undefined}
      fillBoard
      board={
        <div className="yacht-layout">
          {showBoard && st ? (
            <>
              {/* totals strip — everyone's running score at a glance */}
              <div className="yacht-topline">
                {ids.map(id => (
                  <span key={id} className={`yacht-total-chip${id === currentTurnId && !solo ? ' turn' : ''}${id === currentUserId ? ' me' : ''}`}>
                    <em>{nameFor(id).slice(0, 7).toLowerCase()}</em>
                    <b>{cardTotal(cards[id] ?? emptyCard())}</b>
                  </span>
                ))}
                <span className="yacht-round">{t('y.round')} {Math.min(st.round, 12)}/12</span>
              </div>

              <div className="yacht-status">
                {statusLine && <span className={`yacht-status-line${myTurn ? ' mine' : ''}`}>{statusLine}</span>}
              </div>

              <div className="yacht-stage">
                {/* the keep shelf — held dice slide up here and wait */}
                <div className="yacht-shelf">
                  <span className="yacht-shelf-label">{t('y.keep')}</span>
                  <div className="yacht-shelf-dice">
                    {st.dice.map((d, i) => st.held[i] ? (
                      <Die
                        key={i}
                        idx={i}
                        value={tumbling.has(i) ? flicker[i] : d}
                        held
                        disabled={!myTurn || !rolled || st.rollsLeft === 0 || animating}
                        onClick={() => toggleHold(i)}
                        refCb={el => { if (el) dieRefs.current.set(i, el); else dieRefs.current.delete(i) }}
                      />
                    ) : null)}
                    {st.held.every(h => !h) && (
                      <span className="yacht-shelf-hint">{rolled ? t('y.keepHint') : '\u00a0'}</span>
                    )}
                  </div>
                </div>

                {/* the table — live dice tumble here */}
                <div className="yacht-table-dice">
                  {st.dice.map((d, i) => !st.held[i] ? (
                    <Die
                      key={i}
                      idx={i}
                      value={tumbling.has(i) ? flicker[i] : d}
                      held={false}
                      tumbling={tumbling.has(i)}
                      landed={landedSet.has(i)}
                      disabled={!myTurn || !rolled || st.rollsLeft === 0 || animating}
                      onClick={() => toggleHold(i)}
                      refCb={el => { if (el) dieRefs.current.set(i, el); else dieRefs.current.delete(i) }}
                    />
                  ) : null)}
                </div>

                <div className="yacht-actions">
                  <button
                    className="yacht-roll-btn"
                    onClick={doRoll}
                    disabled={!myTurn || st.rollsLeft <= 0 || animating || (solo && soloOver)}
                  >
                    {t('y.roll')}
                    <span className="yacht-roll-pips">
                      {[0, 1, 2].map(i => (
                        <span key={i} className={`yacht-roll-pip${i < st.rollsLeft ? ' on' : ''}`} />
                      ))}
                    </span>
                  </button>
                  <button
                    className="yacht-write-btn"
                    onClick={() => setLedgerOpen(true)}
                    disabled={!myTurn || !rolled || animating}
                  >
                    {t('y.write')}
                  </button>
                </div>
              </div>

              {/* the ledger — a sheet that rises to take the score */}
              {ledgerOpen && <div className="yacht-ledger-veil" onClick={() => setLedgerOpen(false)} />}
              <div className={`yacht-ledger${ledgerOpen ? ' open' : ''}`} aria-hidden={!ledgerOpen}>
                <div className="yacht-ledger-head">
                  <span className="yacht-ledger-title">{t('y.ledger')}</span>
                  <button className="yacht-ledger-x" onClick={() => setLedgerOpen(false)} aria-label={t('common.close')}>×</button>
                </div>
                <div className="yacht-card">
                  <div className="yacht-card-head">
                    <span className="yacht-card-cat" />
                    {ids.map(id => (
                      <span key={id} className={`yacht-card-player${id === currentTurnId && !solo ? ' turn' : ''}${id === currentUserId ? ' me' : ''}`}>
                        {nameFor(id).slice(0, 6).toLowerCase()}
                      </span>
                    ))}
                  </div>
                  {CAT_LABELS.map((label, cat) => (
                    <div key={cat} className="yacht-card-row">
                      <span className="yacht-card-cat">{label}</span>
                      {ids.map(id => {
                        const v = (cards[id] ?? [])[cat]
                        const isMe = id === currentUserId
                        const preview = isMe ? previewFor(cat) : null
                        if (v !== null && v !== undefined) {
                          return (
                            <span
                              key={id}
                              className={`yacht-card-cell filled${v === 0 ? ' zero' : ''}${isMe && stampSeq?.cat === cat ? ' stamped' : ''}`}
                              {...(isMe && stampSeq?.cat === cat ? { 'data-stamp': stampSeq.seq } : {})}
                            >
                              {v}
                            </span>
                          )
                        }
                        if (preview !== null) {
                          return (
                            <button key={id} className={`yacht-card-cell pick${preview === 0 ? ' zero' : ''}`}
                              onClick={() => pickCategory(cat)}>
                              {preview}
                            </button>
                          )
                        }
                        return <span key={id} className="yacht-card-cell open">·</span>
                      })}
                    </div>
                  ))}
                  <div className="yacht-card-row bonus">
                    <span className="yacht-card-cat">{t('y.bonus')} <em>({YACHT_LABEL_BONUS})</em></span>
                    {ids.map(id => {
                      const card = cards[id] ?? emptyCard()
                      const up = upperTotal(card)
                      const b = upperBonus(card)
                      return (
                        <span key={id} className={`yacht-card-cell${b > 0 ? ' bonus-hit' : ''}`}>
                          {b > 0 ? `+${b}` : `${up}/63`}
                        </span>
                      )
                    })}
                  </div>
                  <div className="yacht-card-row total">
                    <span className="yacht-card-cat">{t('y.total')}</span>
                    {ids.map(id => (
                      <span key={id} className="yacht-card-cell total-cell">
                        {cardTotal(cards[id] ?? emptyCard())}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="game-transition-blank" />
          )}
        </div>
      }
      overlay={overlay}
      chat={!solo && !isComputerMatch ? (
        <GameChat
          supabase={supabase}
          currentUserId={currentUserId}
          roomId={room?.id ?? null}
          names={Object.fromEntries([[currentUserId, currentUserProfile?.display_name ?? 'me'], ...friendProfiles.map(p => [p.id, p.display_name])])}
          otherUserId={chatOpponentId}
          otherName={chatOpponentId ? nameFor(chatOpponentId) : undefined}
        />
      ) : undefined}
      invite={{
        open: showInviteModal,
        onClose: () => setShowInviteModal(false),
        friends: friendProfiles,
        invitedIds,
        onInvite: id => { handleCreateAndInvite(id) },
        canInvite: canInviteMore,
      }}
    />
  )
}

const YACHT_LABEL_BONUS = '63↑ +35'
