import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile, BoardRoom, BoardGameType, BoardSeat } from '../../types/collab'
import { useBoardRoom } from '../../hooks/useBoardRoom'
import { useTurnSound } from '../../hooks/useTurnSound'
import { useT } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/translations'
import { computerPlayerId, computerPlayerName, isComputerPlayerId } from '../../lib/computerPlayers'
import {
  BOARD_DIMS, createBoard, legalMoves, resolveMove, applyMove, outcome, nextSeat, aiMove, counts, other,
  type Board, type Seat, type Move,
} from '../../lib/boardGames'
import GameShell, { GameOverlayCard, GameReadyControl, GameResultMark } from './GameShell'
import GameChat from './GameChat'

interface Props {
  game: BoardGameType
  supabase: SupabaseClient
  currentUserId: string
  currentUserProfile: Profile | null
  friendProfiles: Profile[]
  onClose: () => void
}

const NAME_KEY: Record<BoardGameType, TKey> = { connect4: 'game.connect4', gomoku: 'game.gomoku', reversi: 'game.reversi' }
const HINT_KEY: Record<BoardGameType, TKey> = { connect4: 'bg.hintConnect4', gomoku: 'bg.hintGomoku', reversi: 'bg.hintReversi' }

function seatOf(s: BoardSeat): Seat { return s === 'host' ? 'h' : 'g' }
function seatName(s: Seat): BoardSeat { return s === 'h' ? 'host' : 'guest' }

/** Head-to-head strip — the chess dock's, same classes. */
function H2HBar({ name, w, d, l }: { name: string; w: number; d: number; l: number }) {
  const total = w + d + l
  if (total === 0) return null
  const half = (n: number) => (n % 1 !== 0 ? `${Math.floor(n)}½` : `${n}`)
  return (
    <div className="chess-h2h" aria-label={`versus ${name}: ${w} wins, ${d} draws, ${l} losses`}>
      <span className="chess-h2h-name">vs {name}</span>
      <span className="chess-h2h-bar">
        {w > 0 && <span className="chess-h2h-seg chess-h2h-w" style={{ flexGrow: w }}>{w}</span>}
        {d > 0 && <span className="chess-h2h-seg chess-h2h-d" style={{ flexGrow: d }}>{d}</span>}
        {l > 0 && <span className="chess-h2h-seg chess-h2h-l" style={{ flexGrow: l }}>{l}</span>}
      </span>
      <span className="chess-h2h-score">{half(w + d * 0.5)}{'–'}{half(l + d * 0.5)}</span>
    </div>
  )
}

/**
 * One view for the three grid games. The room lifecycle (invite → ready
 * → play → rematch, or play the computer) is ChessView's, ported onto
 * board_rooms; only the board renderer and the rules module differ.
 */
export default function BoardGameView({ game, supabase, currentUserId, currentUserProfile, friendProfiles, onClose }: Props) {
  const { t } = useT()
  const { room, loading, createRoom, joinRoom, startGame, toggleReady, makeMove, endGame, inviteFriend, cancelInvite, leaveRoom, deleteCurrentRoom, findActiveRoom } =
    useBoardRoom(supabase, currentUserId, game)
  const [resolvingRoom, setResolvingRoom] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showResignConfirm, setShowResignConfirm] = useState(false)
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())
  const [computerStartPending, setComputerStartPending] = useState(false)
  const { rows, cols } = BOARD_DIMS[game]

  const handleBack = useCallback(() => {
    if (room && (room.status === 'lobby' || (room.status === 'finished' && !room.guest_id))) deleteCurrentRoom()
    else leaveRoom()
    onClose()
  }, [room, deleteCurrentRoom, leaveRoom, onClose])

  // Mount: pending invite first, otherwise resume.
  useEffect(() => {
    if (room) return
    let cancelled = false
    ;(async () => {
      const pending = sessionStorage.getItem('join_room_id')
      if (pending) {
        sessionStorage.removeItem('join_room_id')
        const joined = await joinRoom(pending)
        if (joined || cancelled) { if (!cancelled) setResolvingRoom(false); return }
      }
      if (!cancelled) await findActiveRoom()
      if (!cancelled) setResolvingRoom(false)
    })()
    return () => { cancelled = true }
  }, [joinRoom, findActiveRoom, room])

  useEffect(() => { if (room?.guest_id) setShowInviteModal(false) }, [room?.guest_id])
  useEffect(() => { if (room?.status === 'playing') setComputerStartPending(false) }, [room?.status])

  // ── Seats ──────────────────────────────────────────────────────────────
  const isHost = room ? currentUserId === room.host_id : true
  const mySeat: Seat = isHost ? 'h' : 'g'
  const firstSeat: Seat = room ? seatOf(room.first_player) : 'h'
  const opponentId = room ? (isHost ? room.guest_id : room.host_id) : null
  const isComputerOpponent = !!room && room.computer && !room.guest_id
  const opponentProfile = opponentId && !isComputerPlayerId(opponentId) ? friendProfiles.find(p => p.id === opponentId) ?? null : null

  const status = room?.status ?? 'lobby'
  const isPlaying = status === 'playing'
  const isFinished = status === 'finished'
  const isLobby = status === 'lobby'
  const hasGuest = !!room?.guest_id

  // Local board mirrors the room, updated optimistically on my move.
  const [board, setBoard] = useState<Board>(() => createBoard(game, 'h'))
  const [turnSeat, setTurnSeat] = useState<Seat>('h')
  const [lastMove, setLastMove] = useState<Move | null>(null)
  useEffect(() => {
    if (!room || isLobby || !room.board) return
    setBoard(room.board as Board)
    setTurnSeat(seatOf(room.turn))
    setLastMove(room.last_move ?? null)
  }, [room, isLobby])

  const isMyTurn = isPlaying && turnSeat === mySeat
  useTurnSound(isMyTurn, 'chess', isPlaying)

  const legal = useMemo(() => (isPlaying && isMyTurn ? legalMoves(game, board, mySeat) : []), [game, board, mySeat, isPlaying, isMyTurn])
  const legalSet = useMemo(() => new Set(legal.map(([r, c]) => r * cols + c)), [legal, cols])

  // ── Actions ────────────────────────────────────────────────────────────
  const handleCreateAndInvite = useCallback(async (friendId: string) => {
    if (room && invitedIds.has(friendId)) {
      await cancelInvite(friendId, room.id)
      setInvitedIds(prev => { const n = new Set(prev); n.delete(friendId); return n })
      return
    }
    let target = room
    if (!target) target = await createRoom()
    if (!target) return
    await inviteFriend(friendId, target.id)
    setInvitedIds(prev => new Set([...prev, friendId]))
  }, [room, invitedIds, createRoom, inviteFriend, cancelInvite])

  const handlePlayComputer = useCallback(async () => {
    setComputerStartPending(true)
    let target = room
    if (!target) target = await createRoom()
    if (!target) { setComputerStartPending(false); return }
    // alternate who opens between games against the computer
    const first: BoardSeat = target.status === 'finished' && target.computer ? (target.first_player === 'host' ? 'guest' : 'host') : 'host'
    const fresh = await startGame(createBoard(game, seatOf(first)), { firstPlayer: first, computer: true })
    if (!fresh) setComputerStartPending(false)
  }, [room, createRoom, startGame, game])

  // Both ready → host starts (rematch flips the opening seat).
  useEffect(() => {
    if (!room || !isHost) return
    const rematch = room.status === 'finished'
    if ((room.status === 'lobby' || rematch) && room.guest_id && room.host_ready && room.guest_ready) {
      const first: BoardSeat = rematch ? (room.first_player === 'host' ? 'guest' : 'host') : 'host'
      void startGame(createBoard(game, seatOf(first)), { firstPlayer: first })
    }
  }, [room, isHost, startGame, game])

  const commitMove = useCallback(async (seat: Seat, mv: Move, current: Board) => {
    if (!room) return
    const nb = applyMove(game, current, seat, mv)
    const out = outcome(game, nb, seat, mv)
    const next = out.over ? seat : nextSeat(game, nb, seat)
    setBoard(nb); setTurnSeat(next); setLastMove(mv)
    const updates: Partial<BoardRoom> = {
      board: nb, turn: seatName(next), last_move: mv, move_count: (room.move_count ?? 0) + 1,
    }
    if (out.over) {
      const winnerId = out.winner === null ? null
        : out.winner === 'h' ? room.host_id
        : (room.guest_id ?? computerPlayerId(0))
      await endGame(winnerId, updates)
    } else {
      await makeMove(updates)
    }
  }, [room, game, makeMove, endGame])

  const handleCell = useCallback((r: number, c: number) => {
    if (!room || !isMyTurn) return
    const mv = resolveMove(game, board, mySeat, r, c)
    if (!mv) return
    void commitMove(mySeat, mv, board)
  }, [room, isMyTurn, game, board, mySeat, commitMove])

  // Computer's turn (host's client drives it).
  const aiKeyRef = useRef('')
  useEffect(() => {
    if (!room || !isPlaying || !isComputerOpponent || !isHost) return
    const aiSeat: Seat = 'g'
    if (turnSeat !== aiSeat) return
    const key = `${room.id}:${room.move_count}`
    if (aiKeyRef.current === key) return
    const timer = window.setTimeout(() => {
      aiKeyRef.current = key
      const mv = aiMove(game, board, aiSeat)
      if (!mv) return
      void commitMove(aiSeat, mv, board)
    }, 550)
    return () => window.clearTimeout(timer)
  }, [room, isPlaying, isComputerOpponent, isHost, turnSeat, board, game, commitMove])

  const confirmResign = useCallback(async () => {
    setShowResignConfirm(false)
    if (!room) return
    await endGame(isComputerOpponent ? computerPlayerId(0) : opponentId)
  }, [room, isComputerOpponent, opponentId, endGame])

  // ── Result / readiness ─────────────────────────────────────────────────
  const myReady = room ? (isHost ? room.host_ready : room.guest_ready) : false
  const opponentReady = room ? (isHost ? room.guest_ready : room.host_ready) : false
  const readyCountStr = room ? t('chess.readyCount', { n: (room.host_ready ? 1 : 0) + (room.guest_ready ? 1 : 0) }) : ''
  let resultTitle = t('chess.drawResult')
  let resultMark: 'win' | 'loss' | 'draw' = 'draw'
  if (isFinished && room) {
    if (room.winner_id === currentUserId) { resultTitle = t('chess.youWon'); resultMark = 'win' }
    else if (room.winner_id) { resultTitle = t('chess.youLost'); resultMark = 'loss' }
  }

  // Head-to-head record vs this opponent (human games only).
  const [record, setRecord] = useState<{ w: number; d: number; l: number } | null>(null)
  useEffect(() => {
    if (!opponentId || isComputerOpponent || !hasGuest) { setRecord(null); return }
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('board_rooms')
        .select('winner_id')
        .eq('game_type', game)
        .eq('status', 'finished')
        .or(`and(host_id.eq.${currentUserId},guest_id.eq.${opponentId}),and(host_id.eq.${opponentId},guest_id.eq.${currentUserId})`)
      if (cancelled || error || !data) return
      let w = 0, d = 0, l = 0
      for (const r of data as { winner_id: string | null }[]) {
        if (r.winner_id === currentUserId) w++; else if (r.winner_id) l++; else d++
      }
      setRecord({ w, d, l })
    })()
    return () => { cancelled = true }
  }, [opponentId, isComputerOpponent, hasGuest, room?.status, room?.winner_id, supabase, currentUserId, game])

  // ── Overlay ────────────────────────────────────────────────────────────
  let overlay: React.ReactNode = null
  if (computerStartPending) {
    overlay = null
  } else if (isFinished && room) {
    const k = counts(board)
    overlay = (
      <GameOverlayCard emoji={<GameResultMark result={resultMark} />} title={resultTitle}>
        {game === 'reversi' && (
          <div className="game-finish-readystate">{mySeat === 'h' ? k.h : k.g} – {mySeat === 'h' ? k.g : k.h}</div>
        )}
        {isComputerOpponent ? (
          <button className="game-ready-btn" onClick={handlePlayComputer}>{t('chess.playAgain')}</button>
        ) : (
          <GameReadyControl ready={myReady} count={readyCountStr} onToggle={toggleReady} label={myReady ? undefined : t('chess.playAgain')} />
        )}
        <button className="game-endgame-btn" onClick={handleBack}>{t('chess.endGame')}</button>
      </GameOverlayCard>
    )
  } else if (isLobby && hasGuest) {
    overlay = (
      <GameOverlayCard title={t('game.readyToPlay')}>
        <GameReadyControl ready={myReady} count={readyCountStr} onToggle={toggleReady} disabled={loading} />
      </GameOverlayCard>
    )
  } else if (resolvingRoom) {
    overlay = <GameOverlayCard title={t('common.joining')} />
  } else if (!isPlaying) {
    if (!room || (isHost && !hasGuest)) {
      overlay = (
        <GameOverlayCard title={t(NAME_KEY[game])}>
          <button className="game-invite-btn" onClick={() => setShowInviteModal(true)} disabled={loading}>{t('chess.inviteCta')}</button>
          <button className="game-invite-btn game-computer-btn" onClick={handlePlayComputer} disabled={loading}>{t('game.playComputer')}</button>
          {room && !hasGuest && <div className="game-finish-readystate">{t('chess.waitingForFriend')}</div>}
          <div className="pb-hint">{t(HINT_KEY[game])}</div>
        </GameOverlayCard>
      )
    } else {
      overlay = <GameOverlayCard title={t('common.joining')} />
    }
  }

  // ── Board ──────────────────────────────────────────────────────────────
  const stoneClass = (cell: Seat) => (cell === firstSeat ? 'bg-stone bg-stone-first' : 'bg-stone bg-stone-second')
  const displayBoard = isPlaying || isFinished ? board : createBoard(game, 'h')
  const k = counts(displayBoard)
  const myCount = mySeat === 'h' ? k.h : k.g
  const theirCount = mySeat === 'h' ? k.g : k.h
  const [hoverCol, setHoverCol] = useState<number | null>(null)

  const boardEl = (
    <div
      className={`bg-board bg-${game}${isMyTurn ? ' my-turn' : ''}`}
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, aspectRatio: `${cols} / ${rows}` }}
      onMouseLeave={() => setHoverCol(null)}
    >
      {displayBoard.map((row, r) => row.map((cell, c) => {
        const isLast = !!lastMove && lastMove[0] === r && lastMove[1] === c
        const isLegal = legalSet.has(r * cols + c)
        const ghost = game === 'connect4' && isMyTurn && hoverCol === c && cell === null && (r === rows - 1 || displayBoard[r + 1][c] !== null)
        return (
          <div
            key={`${r}-${c}`}
            className={`bg-cell${isLast ? ' last' : ''}${isLegal && game !== 'connect4' ? ' legal' : ''}`}
            onClick={() => handleCell(r, c)}
            onMouseEnter={() => game === 'connect4' && setHoverCol(c)}
          >
            {cell && <span className={stoneClass(cell)} />}
            {!cell && ghost && <span className="bg-stone bg-stone-ghost" />}
          </div>
        )
      }))}
    </div>
  )

  const playerRow = (profile: Profile | null, fallback: React.ReactNode, ready: boolean, count: number, seat: Seat) => (
    <div className="game-player-row bg-player-row">
      <span className={`bg-swatch ${seat === firstSeat ? 'bg-stone-first' : 'bg-stone-second'}`} aria-hidden="true" />
      {profile ? <span className="game-player-name">{profile.display_name}</span> : fallback}
      {game === 'reversi' && (isPlaying || isFinished) && <span className="bg-count">{count}</span>}
      {isLobby && hasGuest && (
        <span className={`game-ready-badge${ready ? ' ready' : ''}`}>{ready ? t('common.readyCheck') : t('common.notReady')}</span>
      )}
    </div>
  )

  return (
    <GameShell
      className={`chess-shell bg-shell bg-shell-${game}`}
      title={t(NAME_KEY[game])}
      onBack={handleBack}
      actionStatus={isPlaying ? (isMyTurn ? <>● {t('chess.yourTurn')}</> : <>● {t('common.thinking')}</>) : undefined}
      controls={isPlaying ? (
        <button className="game-btn game-btn-danger" onClick={() => setShowResignConfirm(true)}>{t('chess.resign')}</button>
      ) : undefined}
      aboveBoard={playerRow(
        opponentProfile,
        isComputerOpponent
          ? <span className="game-player-name">{computerPlayerName(computerPlayerId(0))}</span>
          : <span className="game-player-name game-player-name--unknown">{hasGuest ? t('common.opponent') : t('common.waiting')}</span>,
        opponentReady, theirCount, other(mySeat),
      )}
      board={computerStartPending ? <div className="game-transition-blank" /> : <div className="chess-board-wrap bg-board-wrap">{boardEl}</div>}
      belowBoard={playerRow(
        currentUserProfile,
        <span className="game-player-name">{t('common.me')}</span>,
        myReady, myCount, mySeat,
      )}
      overlay={overlay}
      chat={!computerStartPending ? (
        <div className="chess-dock">
          {record && <H2HBar name={opponentProfile?.display_name ?? t('common.opponent')} w={record.w} d={record.d} l={record.l} />}
          <GameChat
            supabase={supabase}
            currentUserId={currentUserId}
            roomId={room?.id ?? null}
            names={Object.fromEntries([[currentUserId, currentUserProfile?.display_name ?? 'me'], ...friendProfiles.map(p => [p.id, p.display_name])])}
            otherUserId={isComputerOpponent ? null : opponentId}
            otherName={isComputerOpponent ? computerPlayerName(computerPlayerId(0)) : opponentProfile?.display_name}
          />
        </div>
      ) : undefined}
      invite={{ open: showInviteModal, onClose: () => setShowInviteModal(false), friends: friendProfiles, invitedIds, onInvite: id => { void handleCreateAndInvite(id) } }}
      confirm={{ open: showResignConfirm, message: t('chess.resignConfirm'), confirmLabel: t('chess.resign'), onConfirm: confirmResign, onCancel: () => setShowResignConfirm(false) }}
    />
  )
}
