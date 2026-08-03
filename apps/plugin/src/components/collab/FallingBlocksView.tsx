
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { holdKeyboard } from '../../lib/keyboardCapture'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile, FallingBlocksPlayerState } from '../../types/collab'
import { useFallingBlocksRoom } from '../../hooks/useFallingBlocksRoom'
import {
  initialFallingBlocksState,
  tryMove,
  tryRotate,
  holdSwap,
  hardDrop,
  softDropTick,
  lockPiece,
  spawnPiece,
  getGhostPiece,
  pieceCells,
  levelForLines,
  gravityMsForLevel,
  BOARD_ROWS,
  BOARD_COLS,
} from '../../hooks/useFallingBlocks'
import type { FallingBlocksState, Board, Piece, PieceType } from '../../hooks/useFallingBlocks'
import { useT } from '../../i18n/LanguageContext'
import { useWorldScores } from '../../hooks/useWorldScores'
import type { WorldStanding } from '../../hooks/useWorldScores'
import GameShell, { GameOverlayCard, GameReadyControl, GameResultMark } from './GameShell'
import GameChat from './GameChat'

// ─── Constants ────────────────────────────────────────────────────────────────

const TICK_MS = 50
const SYNC_THROTTLE_MS = 250
const MAX_PLAYERS = 4
/** On top of the per-10-lines level, the clock itself adds +1 level every
 *  minute — the slow, inevitable speed creep of classic marathon play. */
const TIME_LEVEL_MS = 60_000

const PIECE_CLASS: Record<string, string> = {
  I: 'falling-blocks-cell--I',
  O: 'falling-blocks-cell--O',
  T: 'falling-blocks-cell--T',
  S: 'falling-blocks-cell--S',
  Z: 'falling-blocks-cell--Z',
  J: 'falling-blocks-cell--J',
  L: 'falling-blocks-cell--L',
  G: 'falling-blocks-cell--G',
}

// ─── Board renderer ───────────────────────────────────────────────────────────

interface FallingBlocksBoardProps {
  board: Board
  currentPiece?: Piece | null
  ghost?: Piece | null
  topOut?: boolean
  size?: 'self' | 'opponent'
}

function FallingBlocksBoard({ board, currentPiece, ghost, topOut, size = 'self' }: FallingBlocksBoardProps) {
  const { t } = useT()
  // Build display board: base + ghost overlay + current piece overlay
  const display: (string | null)[][] = useMemo(() => {
    const out: (string | null)[][] = board.map(row => row.slice())
    if (ghost && currentPiece) {
      for (const [r, c] of pieceCells(ghost)) {
        if (r >= 0 && r < BOARD_ROWS && c >= 0 && c < BOARD_COLS) {
          if (out[r][c] === null) out[r][c] = `ghost-${ghost.type}`
        }
      }
    }
    if (currentPiece) {
      for (const [r, c] of pieceCells(currentPiece)) {
        if (r >= 0 && r < BOARD_ROWS && c >= 0 && c < BOARD_COLS) {
          out[r][c] = currentPiece.type
        }
      }
    }
    return out
  }, [board, currentPiece, ghost])

  const sizeClass = size === 'self' ? 'is-self' : 'is-opponent'

  return (
    <div className={`falling-blocks-board ${sizeClass}`} role="grid" aria-label="Falling Blocks board">
      {display.map((row, r) => (
        <div key={r} className="falling-blocks-board-row" style={{ display: 'contents' }}>
          {row.map((cell, c) => {
            let cls = 'falling-blocks-cell'
            if (cell) {
              if (cell.startsWith('ghost-')) {
                const t = cell.slice('ghost-'.length)
                cls += ` falling-blocks-cell--ghost ${PIECE_CLASS[t] ?? ''}`
              } else {
                cls += ` ${PIECE_CLASS[cell] ?? ''}`
              }
            }
            return <div key={`${r}-${c}`} className={cls} />
          })}
        </div>
      ))}
      {topOut && (
        <div className="falling-blocks-topout-overlay">
          <span>{t('fb.toppedOut')}</span>
        </div>
      )}
    </div>
  )
}

// ─── Piece preview (hold box + next queue) ────────────────────────────────────

const PIECE_PREVIEW_SHAPES: Record<PieceType, number[][]> = {
  I: [[1, 1, 1, 1]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  Z: [[1, 1, 0], [0, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]],
}

function PiecePreview({ type, cell = 9, dim = false }: { type: PieceType; cell?: number; dim?: boolean }) {
  const shape = PIECE_PREVIEW_SHAPES[type]
  return (
    <div
      className="falling-blocks-next-piece"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${shape[0].length}, ${cell}px)`,
        gridTemplateRows: `repeat(${shape.length}, ${cell}px)`,
        gap: 1,
        opacity: dim ? 0.35 : 1,
      }}
    >
      {shape.flatMap((row, r) =>
        row.map((v, c) => (
          <div
            key={`${r}-${c}`}
            className={v ? `falling-blocks-cell ${PIECE_CLASS[type]}` : 'falling-blocks-cell'}
            style={{ width: cell, height: cell, opacity: v ? 1 : 0 }}
          />
        ))
      )}
    </div>
  )
}

// ─── Opponent mini-board ──────────────────────────────────────────────────────

interface OpponentBoardProps {
  profile: Profile | null
  state: FallingBlocksPlayerState | undefined
  fallbackName: string
}

function OpponentBoard({ profile, state, fallbackName }: OpponentBoardProps) {
  const board: Board = state?.board ?? Array.from({ length: BOARD_ROWS }, () =>
    Array.from({ length: BOARD_COLS }, () => null)
  )
  return (
    <div className="falling-blocks-opponent">
      <div className="falling-blocks-opponent-header">
        <span className="falling-blocks-opponent-name">
          {profile?.display_name ?? fallbackName}
        </span>
        <span className="falling-blocks-opponent-score">
          {state?.score ?? 0}
        </span>
      </div>
      <FallingBlocksBoard
        board={board}
        size="opponent"
      />
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

export default function FallingBlocksView({
  supabase,
  currentUserId,
  currentUserProfile,
  friendProfiles,
  onClose,
}: Props) {
  const { t } = useT()
  const {
    room,
    playerStates,
    loading,
    createRoom,
    joinRoom,
    leaveRoom,
    deleteCurrentRoom,
    findActiveRoom,
    toggleReady,
    startGame,
    endGame,
    inviteFriend,
    cancelInvite,
    updateMyState,
    applyPlayerStates,
    sendGarbage,
    setPlayerTopOut,
  } = useFallingBlocksRoom(supabase, currentUserId)
  const { submitScore, loadStanding } = useWorldScores(supabase, currentUserId, 'falling_blocks_scores')

  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showForfeitConfirm, setShowForfeitConfirm] = useState(false)
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())
  // Combo flash — bumps `seq` so the CSS animation restarts per combo step.
  const [comboFlash, setComboFlash] = useState<{ mult: number; seq: number } | null>(null)

  // Solo run (no room, world leaderboard)
  const [solo, setSolo] = useState(false)
  const [standing, setStanding] = useState<WorldStanding | null>(null)
  const [soloSubmitting, setSoloSubmitting] = useState(false)
  const soloSubmittedRef = useRef(false)
  const mpSubmittedRef = useRef(false)

  // Local game state
  const [game, setGame] = useState<FallingBlocksState>(() => ({
    board: Array.from({ length: BOARD_ROWS }, () => Array.from({ length: BOARD_COLS }, () => null)),
    current: null,
    next: [],
    bag: [],
    hold: null,
    holdUsed: false,
    combo: 0,
    b2b: false,
    score: 0,
    lines: 0,
    topOut: false,
    garbagePending: 0,
    lockTimer: null,
  }))
  const gameRef = useRef(game)
  useEffect(() => { gameRef.current = game }, [game])

  const playerStatesRef = useRef(playerStates)
  useEffect(() => { playerStatesRef.current = playerStates }, [playerStates])

  const roomRef = useRef(room)
  useEffect(() => { roomRef.current = room }, [room])

  // When the current round started — drives the time part of the speed curve.
  const playStartRef = useRef<number>(Date.now())

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

  // Start-screen leaderboard
  useEffect(() => {
    let cancelled = false
    loadStanding().then(s => { if (!cancelled && s) setStanding(s) })
    return () => { cancelled = true }
  }, [loadStanding])

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

  const myPlayerState = playerStates.get(currentUserId)
  const myTopOutServer = !!myPlayerState?.top_out

  // The one gate that matters for input + gravity, in both modes.
  const localActive = solo ? !game.topOut : (isPlaying && !myTopOutServer)

  const opponentIds = useMemo(() => {
    if (!room) return []
    return room.player_ids.filter(id => id !== currentUserId)
  }, [room, currentUserId])

  const opponentProfilesById = useMemo(() => {
    const map = new Map<string, Profile | null>()
    for (const id of opponentIds) {
      const p = friendProfiles.find(fp => fp.id === id) ?? null
      map.set(id, p)
    }
    return map
  }, [opponentIds, friendProfiles])
  const chatOpponentId = opponentIds.length === 1 ? opponentIds[0] : null
  const chatOpponentProfile = chatOpponentId ? opponentProfilesById.get(chatOpponentId) ?? null : null

  const nameFor = useCallback((id: string): string => {
    if (id === currentUserId) return currentUserProfile?.display_name ?? 'me'
    return friendProfiles.find(p => p.id === id)?.display_name ?? 'player'
  }, [currentUserId, currentUserProfile, friendProfiles])

  // ── Score helpers — the round is decided on points, not survival ─────────
  const scoreFor = useCallback((id: string): number => {
    if (id === currentUserId) {
      return Math.max(gameRef.current.score, playerStatesRef.current.get(id)?.score ?? 0)
    }
    return playerStatesRef.current.get(id)?.score ?? 0
  }, [currentUserId])

  /** Highest score wins; an exact tie is a draw (null). */
  const scoreWinner = useCallback((): string | null => {
    const ids = roomRef.current?.player_ids ?? []
    if (ids.length === 0) return null
    let best: string | null = null
    let bestScore = -1
    let tied = false
    for (const id of ids) {
      const s = scoreFor(id)
      if (s > bestScore) { best = id; bestScore = s; tied = false }
      else if (s === bestScore) tied = true
    }
    return tied ? null : best
  }, [scoreFor])

  // ── Solo flow ────────────────────────────────────────────────────────────
  const startSolo = useCallback(() => {
    // A lobby draft room isn't needed any more.
    if (roomRef.current && roomRef.current.status !== 'playing') deleteCurrentRoom()
    soloSubmittedRef.current = false
    setSolo(true)
    const fresh = initialFallingBlocksState()
    setGame(fresh)
    playStartRef.current = Date.now()
    setComboFlash(null)
  }, [deleteCurrentRoom])

  // Solo game over → record the score, refresh the world ranking.
  useEffect(() => {
    if (!solo || !game.topOut || soloSubmittedRef.current) return
    soloSubmittedRef.current = true
    setSoloSubmitting(true)
    submitScore(gameRef.current.score).then(s => {
      if (s) setStanding(s)
      setSoloSubmitting(false)
    })
  }, [solo, game.topOut, submitScore])

  // Multiplayer finish → quietly bank my final score on the same board.
  useEffect(() => {
    if (!isFinished) { mpSubmittedRef.current = false; return }
    if (solo || mpSubmittedRef.current) return
    mpSubmittedRef.current = true
    submitScore(Math.max(gameRef.current.score, playerStatesRef.current.get(currentUserId)?.score ?? 0))
  }, [isFinished, solo, submitScore, currentUserId])

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
    setSolo(false)
    let targetRoom = room
    if (!targetRoom) targetRoom = await createRoom(MAX_PLAYERS as 2 | 3 | 4)
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
        targetRoom = await createRoom(MAX_PLAYERS as 2 | 3 | 4)
      }
      if (!targetRoom) return
      await inviteFriend(friendId, targetRoom.id)
      setInvitedIds(prev => new Set([...prev, friendId]))
    },
    [room, invitedIds, createRoom, inviteFriend, cancelInvite]
  )

  // ── Auto-start (host) when all ready ─────────────────────────────────────
  useEffect(() => {
    if (!room || !isHost) return
    if (room.status !== 'lobby') return
    if (room.player_ids.length < 2) return
    if (!room.player_ids.every(id => room.ready_ids.includes(id))) return
    startGame()
  }, [room, isHost, startGame])

  // ── On multiplayer game start: reset local state, drop out of solo ──────
  const prevStatusRef = useRef<string | null>(null)
  useEffect(() => {
    const prev = prevStatusRef.current
    prevStatusRef.current = status
    if (prev !== 'playing' && status === 'playing') {
      setSolo(false)
      const fresh = initialFallingBlocksState()
      setGame(fresh)
      playStartRef.current = Date.now()
      setComboFlash(null)
      // Push initial state to server
      updateMyState({
        board: fresh.board,
        score: 0,
        lines: 0,
        top_out: false,
        garbage_pending: 0,
      })
    }
  }, [room?.player_ids, status, updateMyState])

  // ── Combo flash when the multiplier kicks in (×2 and up) ─────────────────
  const prevComboRef = useRef(0)
  useEffect(() => {
    const prev = prevComboRef.current
    prevComboRef.current = game.combo
    if (game.combo >= 2 && game.combo > prev) {
      setComboFlash(f => ({ mult: game.combo, seq: (f?.seq ?? 0) + 1 }))
    }
  }, [game.combo])

  // ── Apply incoming garbage from server inbox ─────────────────────────────
  useEffect(() => {
    if (!isPlaying || solo) return
    const ps = playerStates.get(currentUserId)
    if (!ps) return
    if (ps.garbage_pending > 0) {
      // Add to local pending and reset server inbox
      setGame(prev => ({
        ...prev,
        garbagePending: prev.garbagePending + ps.garbage_pending,
      }))
      updateMyState({ garbage_pending: 0 })
    }
  }, [playerStates, currentUserId, isPlaying, solo, updateMyState])

  // ── Sync my local state to server, throttled ─────────────────────────────
  const lastSyncRef = useRef(0)
  useEffect(() => {
    if (!isPlaying || solo) return
    const now = Date.now()
    if (now - lastSyncRef.current < SYNC_THROTTLE_MS) return
    lastSyncRef.current = now
    updateMyState({
      board: game.board,
      score: game.score,
      lines: game.lines,
    })
  }, [game.board, game.score, game.lines, isPlaying, solo, updateMyState])

  // ── On local top-out: notify server ──────────────────────────────────────
  const reportedTopOutRef = useRef(false)
  useEffect(() => {
    if (!isPlaying || solo) {
      reportedTopOutRef.current = false
      return
    }
    if (game.topOut && !reportedTopOutRef.current) {
      reportedTopOutRef.current = true
      updateMyState({
        top_out: true,
        board: game.board,
        score: game.score,
        lines: game.lines,
      })
    }
  }, [game.topOut, game.board, game.score, game.lines, isPlaying, solo, updateMyState])

  // ── End detection: last player standing ends the round, but the WINNER is
  //    whoever has the most points — surviving only decides when it's over.
  const localTopOutEndedRef = useRef(false)
  useEffect(() => {
    if (!isPlaying || solo) {
      localTopOutEndedRef.current = false
      return
    }
    if (!game.topOut || localTopOutEndedRef.current) return
    localTopOutEndedRef.current = true
    const aliveOpponents = opponentIds.filter(id => {
      const ps = playerStatesRef.current.get(id)
      return !ps || !ps.top_out
    })
    if (aliveOpponents.length <= 1) {
      endGame(scoreWinner())
    }
    // 2+ alive opponents → they keep playing; the round ends later.
  }, [game.topOut, isPlaying, solo, opponentIds, endGame, scoreWinner])

  useEffect(() => {
    if (!room || !isPlaying || solo) return
    if (myTopOutServer) return
    if (opponentIds.length === 0) return
    const allDead = opponentIds.every(id => {
      const ps = playerStates.get(id)
      return ps?.top_out === true
    })
    if (allDead) {
      // Make sure all opponent rows actually exist (game initialized)
      const allHaveState = opponentIds.every(id => playerStates.has(id))
      if (allHaveState) {
        endGame(scoreWinner())
      }
    }
  }, [room, isPlaying, solo, opponentIds, playerStates, myTopOutServer, currentUserId, endGame, scoreWinner])

  // ── Distribute garbage to opponents ──────────────────────────────────────
  const distributeGarbage = useCallback(
    (lines: number) => {
      if (lines <= 0 || !roomRef.current) return
      const aliveOpponents = opponentIds.filter(id => {
        const ps = playerStatesRef.current.get(id)
        return ps && !ps.top_out
      })
      if (aliveOpponents.length === 0) return
      // Send all to the first alive opponent (MVP)
      sendGarbage(aliveOpponents[0], lines)
    },
    [opponentIds, sendGarbage]
  )

  // ── Lock & spawn helper ──────────────────────────────────────────────────
  const handleLockAndSpawn = useCallback(
    (state: FallingBlocksState): FallingBlocksState => {
      const lockResult = lockPiece(state)
      if (lockResult.garbageToSend > 0) {
        distributeGarbage(lockResult.garbageToSend)
      }
      const spawned = spawnPiece(lockResult.state)
      return spawned
    },
    [distributeGarbage]
  )

  // ── Keyboard controls — DAS/ARR like tetr.io ─────────────────────────────
  // The OS key-repeat is slow and laggy; we run our own auto-shift instead:
  // instant first step, then after DAS_MS the piece marches at ARR_MS.
  // Soft drop repeats at a fixed fast rate. Rotations/hold/drop never repeat.
  const dasRef = useRef<{ dir: -1 | 1 | 0; das: number | null; arr: number | null; soft: number | null }>({
    dir: 0, das: null, arr: null, soft: null,
  })
  useEffect(() => {
    if (!localActive) return
    const DAS_MS = 130
    const ARR_MS = 35
    const SOFT_MS = 35

    const clearSide = () => {
      const d = dasRef.current
      if (d.das != null) window.clearTimeout(d.das)
      if (d.arr != null) window.clearInterval(d.arr)
      d.das = null; d.arr = null; d.dir = 0
    }
    const clearSoft = () => {
      const d = dasRef.current
      if (d.soft != null) window.clearInterval(d.soft)
      d.soft = null
    }

    const move = (dir: -1 | 1) => setGame(prev => tryMove(prev, dir, 0))
    const softStep = () => setGame(prev => {
      const m = tryMove(prev, 0, 1)
      return m !== prev ? { ...m, score: m.score + 1 } : m
    })

    const startSide = (dir: -1 | 1) => {
      if (dasRef.current.dir === dir) return
      clearSide()
      dasRef.current.dir = dir
      move(dir)
      dasRef.current.das = window.setTimeout(() => {
        dasRef.current.arr = window.setInterval(() => move(dir), ARR_MS)
      }, DAS_MS)
    }
    const startSoft = () => {
      if (dasRef.current.soft != null) return
      softStep()
      dasRef.current.soft = window.setInterval(softStep, SOFT_MS)
    }

    const isTyping = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
    }

    function onKeyDown(e: KeyboardEvent) {
      if (isTyping(e)) return
      const key = e.key
      const handled =
        key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowDown' ||
        key === 'ArrowUp' || key === ' ' ||
        key === 'z' || key === 'Z' || key === 'x' || key === 'X' ||
        key === 'c' || key === 'C' || key === 'Shift'
      if (handled) e.preventDefault()
      if (e.repeat) return   // our own DAS handles repetition

      switch (key) {
        case 'ArrowLeft': startSide(-1); return
        case 'ArrowRight': startSide(1); return
        case 'ArrowDown': startSoft(); return
        case 'ArrowUp': case 'x': case 'X':
          setGame(prev => tryRotate(prev, 1)); return
        case 'z': case 'Z':
          setGame(prev => tryRotate(prev, -1)); return
        case 'Shift': case 'c': case 'C':
          setGame(prev => holdSwap(prev)); return
        case ' ':
          setGame(prev => {
            if (prev.topOut || !prev.current) return prev
            const result = hardDrop(prev)
            if (result.garbageToSend > 0) distributeGarbage(result.garbageToSend)
            return spawnPiece(result.state)
          })
          return
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      switch (e.key) {
        case 'ArrowLeft': if (dasRef.current.dir === -1) clearSide(); break
        case 'ArrowRight': if (dasRef.current.dir === 1) clearSide(); break
        case 'ArrowDown': clearSoft(); break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    const releaseKeys = holdKeyboard()   // arrows/space/shift belong to the game while it's up
    return () => {
      releaseKeys()
      clearSide()
      clearSoft()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [localActive, distributeGarbage])

  // ── Touch controls: drag sideways to move, drag down to soft drop,
  //    flick down to hard drop, tap to rotate, tap the hold box to hold. ────
  const touchRef = useRef({
    active: false, id: -1, x0: 0, y0: 0, t0: 0,
    lastX: 0, lastY: 0, moved: false, dropped: false,
  })
  const boardWrapRef = useRef<HTMLDivElement | null>(null)

  const onBoardPointerDown = useCallback((e: React.PointerEvent) => {
    if (!localActive) return
    if (e.pointerType === 'mouse') return
    touchRef.current = {
      active: true, id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: Date.now(),
      lastX: e.clientX, lastY: e.clientY, moved: false, dropped: false,
    }
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* synthetic events throw */ }
  }, [localActive])

  const onBoardPointerMove = useCallback((e: React.PointerEvent) => {
    const tc = touchRef.current
    if (!tc.active || tc.id !== e.pointerId || tc.dropped) return
    const wrap = boardWrapRef.current
    const cellPx = wrap ? wrap.clientWidth / BOARD_COLS : 24
    const stepX = cellPx * 0.9
    const stepY = cellPx * 1.1
    let dx = e.clientX - tc.lastX
    let dy = e.clientY - tc.lastY
    while (Math.abs(dx) >= stepX) {
      const dir = dx > 0 ? 1 : -1
      setGame(prev => tryMove(prev, dir, 0))
      tc.lastX += dir * stepX
      dx = e.clientX - tc.lastX
      tc.moved = true
    }
    while (dy >= stepY) {
      setGame(prev => {
        const moved = tryMove(prev, 0, 1)
        return moved !== prev ? { ...moved, score: moved.score + 1 } : moved
      })
      tc.lastY += stepY
      dy = e.clientY - tc.lastY
      tc.moved = true
    }
  }, [])

  const onBoardPointerUp = useCallback((e: React.PointerEvent) => {
    const tc = touchRef.current
    if (!tc.active || tc.id !== e.pointerId) return
    tc.active = false
    const dt = Date.now() - tc.t0
    const totalDx = e.clientX - tc.x0
    const totalDy = e.clientY - tc.y0
    // Fast downward flick → hard drop
    if (!tc.dropped && dt < 260 && totalDy > 56 && totalDy > Math.abs(totalDx) * 1.4) {
      tc.dropped = true
      setGame(prev => {
        if (prev.topOut || !prev.current) return prev
        const result = hardDrop(prev)
        if (result.garbageToSend > 0) distributeGarbage(result.garbageToSend)
        return spawnPiece(result.state)
      })
      return
    }
    // Quiet tap → rotate clockwise
    if (!tc.moved && dt < 300 && Math.abs(totalDx) < 12 && Math.abs(totalDy) < 12) {
      setGame(prev => tryRotate(prev, 1))
    }
  }, [distributeGarbage])

  const handleHoldTap = useCallback(() => {
    if (!localActive) return
    setGame(prev => holdSwap(prev))
  }, [localActive])

  // ── Game loop: gravity tick + lock timer ─────────────────────────────────
  useEffect(() => {
    if (!localActive) return

    let lastTick = Date.now()
    let gravityAccum = 0

    const interval = window.setInterval(() => {
      const now = Date.now()
      const dt = now - lastTick
      lastTick = now
      gravityAccum += dt

      // Speed curve: lines-based level + a slow time creep, re-read every
      // tick so the fall keeps accelerating mid-round.
      const elapsed = now - playStartRef.current
      const effLevel = levelForLines(gameRef.current.lines) + Math.floor(elapsed / TIME_LEVEL_MS)
      const gravityMs = gravityMsForLevel(effLevel)

      setGame(prev => {
        if (prev.topOut || !prev.current) return prev
        let next = prev
        // Gravity step (move piece down) only fires every gravityMs.
        if (gravityAccum >= gravityMs) {
          gravityAccum = 0
          next = softDropTick(next, gravityMs)
        } else if (next.lockTimer !== null) {
          // Between gravity ticks, just decrement the lock-delay timer
          // when the piece is already resting on the ground.
          const remaining = next.lockTimer - dt
          next = { ...next, lockTimer: Math.max(0, remaining) }
        }
        if (next.lockTimer !== null && next.lockTimer <= 0) {
          next = handleLockAndSpawn(next)
        }
        return next
      })
    }, TICK_MS)

    return () => window.clearInterval(interval)
  }, [localActive, handleLockAndSpawn])

  // ── Forfeit ──────────────────────────────────────────────────────────────
  // Tops out the current player. Also explicitly ends the game when only one
  // other player is still alive — otherwise the room would stay in 'playing'
  // status if everyone left before the natural top-out detection fired.
  // In-app confirm modal — JUCE's WKWebView blocks window.confirm,
  // so the native call silently no-op'd inside the plugin.
  const handleForfeit = useCallback(() => {
    setShowForfeitConfirm(true)
  }, [])
  const confirmForfeit = useCallback(async () => {
    setShowForfeitConfirm(false)
    setGame(prev => ({ ...prev, topOut: true }))
    applyPlayerStates([{
      room_id: room?.id ?? '',
      user_id: currentUserId,
      board: gameRef.current.board,
      score: gameRef.current.score,
      lines: gameRef.current.lines,
      top_out: true,
      garbage_pending: 0,
      updated_at: new Date().toISOString(),
    }])
    await setPlayerTopOut(currentUserId, true)
    const aliveOpponents = opponentIds.filter(id => {
      const ps = playerStatesRef.current.get(id)
      return ps && !ps.top_out
    })
    if (aliveOpponents.length <= 1) {
      await endGame(scoreWinner())
    }
    // 2+ alive opponents → let the game continue normally
  }, [applyPlayerStates, room?.id, setPlayerTopOut, currentUserId, opponentIds, endGame, scoreWinner])

  // ── Rematch helper: when finished, host auto-starts when all ready ───────
  useEffect(() => {
    if (!room || !isHost) return
    if (room.status !== 'finished') return
    if (room.player_ids.length < 2) return
    if (!room.player_ids.every(id => room.ready_ids.includes(id))) return
    startGame()
  }, [room, isHost, startGame])

  // ── Ghost piece ──────────────────────────────────────────────────────────
  const ghost = useMemo(() => getGhostPiece(game), [game])

  // ── Display board for self ───────────────────────────────────────────────
  const selfDisplayBoard: Board = isPlaying || isFinished || solo
    ? game.board
    : Array.from({ length: BOARD_ROWS }, () => Array.from({ length: BOARD_COLS }, () => null))

  // ── Level readout (same curve the game loop uses, minus the ms jitter) ──
  const displayLevel = levelForLines(game.lines) + (localActive
    ? Math.floor((Date.now() - playStartRef.current) / TIME_LEVEL_MS)
    : 0)

  // ── Result: decided on points ────────────────────────────────────────────
  let resultTitle = t('fb.gameOver')
  let resultMark: 'win' | 'loss' | 'draw' = 'draw'
  if (isFinished && room) {
    if (room.winner_id === currentUserId) {
      resultTitle = t('chess.youWon')
      resultMark = 'win'
    } else if (room.winner_id) {
      resultTitle = t('fb.playerWon', { name: nameFor(room.winner_id) })
      resultMark = 'loss'
    } else {
      resultTitle = t('chess.drawResult')
      resultMark = 'draw'
    }
  }

  // Final score table (sorted desc) + margin over the runner-up.
  const finalScores = useMemo(() => {
    if (!isFinished || !room) return []
    return room.player_ids
      .map(id => ({
        id,
        name: nameFor(id),
        score: id === currentUserId
          ? Math.max(game.score, playerStates.get(id)?.score ?? 0)
          : playerStates.get(id)?.score ?? 0,
      }))
      .sort((a, b) => b.score - a.score)
  }, [isFinished, room, playerStates, game.score, nameFor, currentUserId])

  const pendingInviteCount = [...invitedIds].filter(id => !(room?.player_ids ?? []).includes(id)).length
  const canInviteMore = (id: string) =>
    invitedIds.has(id) || ((room?.player_ids.length ?? 1) + pendingInviteCount < MAX_PLAYERS)

  // Shared world-ranking block (start card + solo game-over card)
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

  // ── Overlay (lobby → ready → finished / solo game-over) ──────────────────
  let overlay: React.ReactNode = null
  if (solo) {
    if (game.topOut) {
      overlay = (
        <GameOverlayCard title={t('fb.gameOver')} className="pb-overlay-card">
          <div className="pb-final-score">{game.score.toLocaleString()}</div>
          {standing?.isNewBest && <div className="pb-newbest">{t('pb.newBest')}</div>}
          {leaderboardBlock}
          <button className="game-invite-btn pb-start-btn" onClick={startSolo}>
            {t('pb.playAgain')}
          </button>
        </GameOverlayCard>
      )
    }
  } else if (isFinished && room) {
    overlay = (
      <GameOverlayCard emoji={<GameResultMark result={resultMark} />} title={resultTitle}>
        {finalScores.length > 0 && (
          <div className="fb-final-scores">
            {finalScores.map((row, i) => (
              <div key={row.id} className={`fb-final-score-row${row.id === currentUserId ? ' me' : ''}`}>
                <span className="fb-final-score-name">{row.name}</span>
                <span className="fb-final-score-value">
                  {row.score.toLocaleString()}
                  {i > 0 && (
                    <span className="fb-final-score-diff">−{(finalScores[0].score - row.score).toLocaleString()}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
        <GameReadyControl
          ready={myReady}
          count={`${readyCount} / ${joinedCount} ready`}
          onToggle={toggleReady}
        />
      </GameOverlayCard>
    )
  } else if (isLobby && room && !allReady) {
    overlay = (
      <GameOverlayCard emoji="🧱" title={t('game.readyToPlay')}>
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
            disabled={loading || (room.player_ids.length + pendingInviteCount >= MAX_PLAYERS)}
          >
            {t('game.inviteFriends')}
          </button>
        )}
        {!hasEnoughPlayers && (
          <div className="game-finish-readystate">{t('chess.waitingForFriend')}</div>
        )}
        <div className="game-finish-readystate">
          {joinedCount} / {MAX_PLAYERS} joined
        </div>
      </GameOverlayCard>
    )
  } else if (!isPlaying && !isFinished && !room) {
    overlay = (
      <GameOverlayCard title={t('game.fallingBlocks')} className="pb-overlay-card">
        {leaderboardBlock}
        <button className="game-invite-btn pb-start-btn" onClick={startSolo} disabled={loading}>
          {t('fb.playSolo')}
        </button>
        <button className="game-invite-btn game-computer-btn" onClick={handleOpenInvite} disabled={loading}>
          {t('game.inviteFriends')}
        </button>
      </GameOverlayCard>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <GameShell
      title={t('game.fallingBlocks')}
      onBack={handleBack}
      className={`falling-blocks-shell${solo ? ' fb-solo-shell' : ''}`}
      controls={solo && !game.topOut ? (
        <>
          <button
            className="game-btn game-btn-danger"
            onClick={() => setGame(prev => ({ ...prev, topOut: true }))}
          >
            {t('pb.end')}
          </button>
          <button className="game-btn" onClick={startSolo}>
            {t('pb.reset')}
          </button>
        </>
      ) : isPlaying && !myTopOutServer ? (
        <button
          className="game-btn game-btn-danger"
          onClick={handleForfeit}
        >
          Forfeit
        </button>
      ) : undefined}
      fillBoard
      board={(
        <div className="falling-blocks-game-layout">
          <div className={`falling-blocks-playfield${solo ? ' fb-solo' : ''}`}>
            {/* Left rail: hold box + next queue */}
            <div className="falling-blocks-rail">
              <button
                type="button"
                className={`fb-rail-box fb-hold${game.holdUsed ? ' used' : ''}`}
                onClick={handleHoldTap}
                aria-label={t('fb.hold')}
              >
                <span className="fb-rail-label">{t('fb.hold')}</span>
                <div className="fb-rail-piece">
                  {game.hold
                    ? <PiecePreview type={game.hold} dim={game.holdUsed} />
                    : <span className="fb-hold-empty">⇧</span>}
                </div>
              </button>
              <div className="fb-rail-box fb-next">
                <span className="fb-rail-label">{t('fb.next')}</span>
                <div className="fb-next-queue">
                  {game.next.slice(0, 5).map((type, i) => (
                    <PiecePreview key={i} type={type} cell={i === 0 ? 9 : 7} />
                  ))}
                </div>
              </div>
              <div className="fb-rail-level">
                <span className="fb-rail-label">{t('fb.level')}</span>
                <span className="fb-rail-level-num">{displayLevel}</span>
              </div>
            </div>

            <div className="falling-blocks-self-row">
              <div
                className="falling-blocks-self-board-wrap"
                ref={boardWrapRef}
                onPointerDown={onBoardPointerDown}
                onPointerMove={onBoardPointerMove}
                onPointerUp={onBoardPointerUp}
                onPointerCancel={onBoardPointerUp}
              >
                <FallingBlocksBoard
                  board={selfDisplayBoard}
                  currentPiece={localActive ? game.current : null}
                  ghost={localActive ? ghost : null}
                  size="self"
                />

                {/* Combo flash — restarts its animation on every step up. */}
                {localActive && comboFlash && game.combo >= 2 && (
                  <div key={comboFlash.seq} className="fb-combo-flash" aria-hidden="true">
                    ×{Math.min(comboFlash.mult, 10)}
                  </div>
                )}

                {/* Self topped out (game still going) — stays anchored to the
                    board because it's a "you specifically are out" indicator. */}
                {isPlaying && !solo && myTopOutServer && (
                  <div className="falling-blocks-topout-overlay">
                    <span>{t('fb.youAreOut')}</span>
                  </div>
                )}
              </div>
            </div>

            {!solo && (
              <div className={`falling-blocks-opponents-row opponents-${Math.max(1, opponentIds.length)}`}>
                {opponentIds.length === 0 ? (
                  <div className="falling-blocks-opponent" style={{ opacity: 0.5 }}>
                    <div className="falling-blocks-opponent-header">
                      <span className="falling-blocks-opponent-name">Waiting…</span>
                    </div>
                    <FallingBlocksBoard
                      board={Array.from({ length: BOARD_ROWS }, () =>
                        Array.from({ length: BOARD_COLS }, () => null)
                      )}
                      size="opponent"
                    />
                  </div>
                ) : (
                  opponentIds.map((id, idx) => (
                    <OpponentBoard
                      key={id}
                      profile={opponentProfilesById.get(id) ?? null}
                      state={playerStates.get(id)}
                      fallbackName={`Player ${idx + 2}`}
                    />
                  ))
                )}
              </div>
            )}
          </div>

          {/* Bottom info */}
          <div className="falling-blocks-side-info">
            <div className="falling-blocks-stat">
              <span className="falling-blocks-stat-label">{t('fb.score')}</span>
              <span className="falling-blocks-stat-value">{game.score.toLocaleString()}</span>
            </div>
            <div className="falling-blocks-stat">
              <span className="falling-blocks-stat-label">{t('fb.lines')}</span>
              <span className="falling-blocks-stat-value">{game.lines}</span>
            </div>
            <div className="falling-blocks-stat">
              <span className="falling-blocks-stat-label">{t('fb.combo')}</span>
              <span className={`falling-blocks-stat-value${game.combo >= 2 ? ' combo-hot' : ''}`}>
                {game.combo >= 1 ? `×${Math.min(game.combo, 10)}` : '—'}
              </span>
            </div>
            <div className="falling-blocks-stat">
              <span className="falling-blocks-stat-label">{t('fb.incoming')}</span>
              <span className="falling-blocks-stat-value">
                {solo ? 0 : game.garbagePending + (myPlayerState?.garbage_pending ?? 0)}
              </span>
            </div>
          </div>
        </div>
      )}
      overlay={overlay}
      chat={!solo ? (
        <GameChat
          supabase={supabase}
          currentUserId={currentUserId}
          roomId={room?.id ?? null}
          names={Object.fromEntries([[currentUserId, currentUserProfile?.display_name ?? 'me'], ...friendProfiles.map((p) => [p.id, p.display_name])])}
          otherUserId={chatOpponentId}
          otherName={chatOpponentProfile?.display_name}
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
      confirm={{
        open: showForfeitConfirm,
        message: t('confirm.forfeitFb'),
        confirmLabel: t('poker.forfeit'),
        onConfirm: confirmForfeit,
        onCancel: () => setShowForfeitConfirm(false),
      }}
    />
  )
}
