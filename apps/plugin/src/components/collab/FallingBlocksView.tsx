import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile, FallingBlocksPlayerState } from '../../types/collab'
import { useFallingBlocksRoom } from '../../hooks/useFallingBlocksRoom'
import {
  initialFallingBlocksState,
  tryMove,
  tryRotate,
  hardDrop,
  softDropTick,
  lockPiece,
  spawnPiece,
  getGhostPiece,
  pieceCells,
  BOARD_ROWS,
  BOARD_COLS,
} from '../../hooks/useFallingBlocks'
import type { FallingBlocksState, Board, Piece, PieceType } from '../../hooks/useFallingBlocks'
import { useT } from '../../i18n/LanguageContext'
import { computerPlayerIds, computerPlayerName, isComputerPlayerId } from '../../lib/computerPlayers'
import GameShell, { GameOverlayCard, GameReadyControl, GameResultMark } from './GameShell'
import GameChat from './GameChat'

// ─── Constants ────────────────────────────────────────────────────────────────

const GRAVITY_MS = 1000
const TICK_MS = 50
const SYNC_THROTTLE_MS = 250
const MAX_PLAYERS = 4

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

// ─── Next pieces preview ──────────────────────────────────────────────────────

const PIECE_PREVIEW_SHAPES: Record<PieceType, number[][]> = {
  I: [[1, 1, 1, 1]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  Z: [[1, 1, 0], [0, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]],
}

function NextPiecesPreview({ pieces }: { pieces: PieceType[] }) {
  return (
    <div className="falling-blocks-next-list">
      {pieces.slice(0, 3).map((type, i) => {
        const shape = PIECE_PREVIEW_SHAPES[type]
        return (
          <div
            key={i}
            className="falling-blocks-next-piece"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${shape[0].length}, 12px)`,
              gridTemplateRows: `repeat(${shape.length}, 12px)`,
              gap: 1,
            }}
          >
            {shape.flatMap((row, r) =>
              row.map((v, c) => (
                <div
                  key={`${r}-${c}`}
                  className={v ? `falling-blocks-cell ${PIECE_CLASS[type]}` : 'falling-blocks-cell'}
                  style={{ width: 12, height: 12, opacity: v ? 1 : 0 }}
                />
              ))
            )}
          </div>
        )
      })}
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
        topOut={state?.top_out ?? false}
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
    sendGarbage,
    setPlayerTopOut,
  } = useFallingBlocksRoom(supabase, currentUserId)

  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showForfeitConfirm, setShowForfeitConfirm] = useState(false)
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())
  const [computerOpponents, setComputerOpponents] = useState<1 | 2 | 3>(1)

  // Local game state
  const [game, setGame] = useState<FallingBlocksState>(() => ({
    board: Array.from({ length: BOARD_ROWS }, () => Array.from({ length: BOARD_COLS }, () => null)),
    current: null,
    next: [],
    bag: [],
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

  const joinedCount = room?.player_ids.length ?? 0
  const readyCount = room ? room.ready_ids.filter(id => room.player_ids.includes(id)).length : 0
  const hasEnoughPlayers = joinedCount >= 2
  const myReady = !!(room && room.ready_ids.includes(currentUserId))
  const allReady = !!(room && hasEnoughPlayers && room.player_ids.every(id => room.ready_ids.includes(id)))

  const myPlayerState = playerStates.get(currentUserId)
  const myTopOutServer = !!myPlayerState?.top_out

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
  const chatOpponentId = opponentIds.length === 1 && !isComputerPlayerId(opponentIds[0]) ? opponentIds[0] : null
  const chatOpponentProfile = chatOpponentId ? opponentProfilesById.get(chatOpponentId) ?? null : null

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

  const handlePlayComputer = useCallback(async () => {
    const bots = computerPlayerIds(computerOpponents)
    const playerIds = [currentUserId, ...bots]
    let targetRoom = room
    if (!targetRoom) {
      targetRoom = await createRoom(playerIds.length as 2 | 3 | 4)
    }
    if (!targetRoom) return
    const { data, error } = await supabase
      .from('falling_blocks_rooms')
      .update({
        player_count: playerIds.length,
        player_ids: playerIds,
        ready_ids: playerIds,
        winner_id: null,
      })
      .eq('id', targetRoom.id)
      .select()
      .single()
    if (error || !data) {
      console.error('[FallingBlocksView.handlePlayComputer]', error)
      return
    }
    await startGame(data)
  }, [computerOpponents, currentUserId, room, createRoom, supabase, startGame])

  // ── Auto-start (host) when all ready ─────────────────────────────────────
  useEffect(() => {
    if (!room || !isHost) return
    if (room.status !== 'lobby') return
    if (room.player_ids.length < 2) return
    if (!room.player_ids.every(id => room.ready_ids.includes(id))) return
    startGame()
  }, [room, isHost, startGame])

  // ── On game start: reset local state ─────────────────────────────────────
  const prevStatusRef = useRef<string | null>(null)
  useEffect(() => {
    const prev = prevStatusRef.current
    prevStatusRef.current = status
    if (prev !== 'playing' && status === 'playing') {
      const fresh = initialFallingBlocksState()
      setGame(fresh)
      // Push initial state to server
      updateMyState({
        board: fresh.board,
        score: 0,
        lines: 0,
        top_out: false,
        garbage_pending: 0,
      })
    }
  }, [status, updateMyState])

  // ── Apply incoming garbage from server inbox ─────────────────────────────
  useEffect(() => {
    if (!isPlaying) return
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
  }, [playerStates, currentUserId, isPlaying, updateMyState])

  // ── Sync my local state to server, throttled ─────────────────────────────
  const lastSyncRef = useRef(0)
  useEffect(() => {
    if (!isPlaying) return
    const now = Date.now()
    if (now - lastSyncRef.current < SYNC_THROTTLE_MS) return
    lastSyncRef.current = now
    updateMyState({
      board: game.board,
      score: game.score,
      lines: game.lines,
    })
  }, [game.board, game.score, game.lines, isPlaying, updateMyState])

  // ── On local top-out: notify server ──────────────────────────────────────
  const reportedTopOutRef = useRef(false)
  useEffect(() => {
    if (!isPlaying) {
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
  }, [game.topOut, game.board, game.score, game.lines, isPlaying, updateMyState])

  // ── Win detection: if all opponents topped out and I'm alive, end game ──
  useEffect(() => {
    if (!room || !isPlaying) return
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
        endGame(currentUserId)
      }
    }
  }, [room, isPlaying, opponentIds, playerStates, myTopOutServer, currentUserId, endGame])

  // ── Distribute garbage to opponents ──────────────────────────────────────
  const distributeGarbage = useCallback(
    (lines: number) => {
      if (lines <= 0) return
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

  // ── Keyboard controls ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying) return
    if (myTopOutServer || game.topOut) return

    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
      }

      const key = e.key
      if (
        key === 'ArrowLeft' ||
        key === 'ArrowRight' ||
        key === 'ArrowDown' ||
        key === 'ArrowUp' ||
        key === ' ' ||
        key === 'z' ||
        key === 'Z'
      ) {
        e.preventDefault()
      }

      setGame(prev => {
        if (prev.topOut || !prev.current) return prev
        switch (key) {
          case 'ArrowLeft':
            return tryMove(prev, -1, 0)
          case 'ArrowRight':
            return tryMove(prev, 1, 0)
          case 'ArrowDown': {
            const moved = tryMove(prev, 0, 1)
            // Soft drop: +1 score per cell when moved
            if (moved !== prev) {
              return { ...moved, score: moved.score + 1 }
            }
            return moved
          }
          case 'ArrowUp':
            return tryRotate(prev, 1)
          case 'z':
          case 'Z':
            return tryRotate(prev, -1)
          case ' ': {
            const result = hardDrop(prev)
            if (result.garbageToSend > 0) distributeGarbage(result.garbageToSend)
            return spawnPiece(result.state)
          }
          default:
            return prev
        }
      })
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isPlaying, myTopOutServer, game.topOut, distributeGarbage])

  // ── Game loop: gravity tick + lock timer ─────────────────────────────────
  useEffect(() => {
    if (!isPlaying) return
    if (myTopOutServer) return

    let lastTick = Date.now()
    let gravityAccum = 0

    const interval = window.setInterval(() => {
      const now = Date.now()
      const dt = now - lastTick
      lastTick = now
      gravityAccum += dt

      setGame(prev => {
        if (prev.topOut || !prev.current) return prev
        let next = prev
        // Gravity step (move piece down) only fires every GRAVITY_MS.
        if (gravityAccum >= GRAVITY_MS) {
          gravityAccum = 0
          next = softDropTick(next, GRAVITY_MS)
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
  }, [isPlaying, myTopOutServer, handleLockAndSpawn])

  useEffect(() => {
    if (!room || !isPlaying || room.host_id !== currentUserId) return
    const botIds = room.player_ids.filter(isComputerPlayerId)
    if (botIds.length === 0) return
    const startedAt = Date.now()
    const interval = window.setInterval(async () => {
      const elapsed = Date.now() - startedAt
      const rows = botIds.map((botId, index) => {
        const prev = playerStatesRef.current.get(botId)
        const topOut = prev?.top_out || elapsed > 45_000 + index * 12_000 + Math.random() * 10_000
        return {
          room_id: room.id,
          user_id: botId,
          board: prev?.board ?? Array.from({ length: BOARD_ROWS }, () => Array.from({ length: BOARD_COLS }, () => null)),
          score: (prev?.score ?? 0) + (topOut ? 0 : Math.floor(Math.random() * 90)),
          lines: (prev?.lines ?? 0) + (topOut ? 0 : (Math.random() < 0.35 ? 1 : 0)),
          top_out: topOut,
          garbage_pending: prev?.garbage_pending ?? 0,
          updated_at: new Date().toISOString(),
        }
      })
      await supabase.from('falling_blocks_player_states').upsert(rows, { onConflict: 'room_id,user_id' })
    }, 1100)
    return () => window.clearInterval(interval)
  }, [room, isPlaying, currentUserId, supabase])

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
    await setPlayerTopOut(currentUserId, true)
    const aliveOpponents = opponentIds.filter(id => {
      const ps = playerStatesRef.current.get(id)
      return ps && !ps.top_out
    })
    if (aliveOpponents.length === 1) {
      await endGame(aliveOpponents[0])
    } else if (aliveOpponents.length === 0) {
      await endGame(null)
    }
    // 2+ alive opponents → let the game continue normally
  }, [setPlayerTopOut, currentUserId, opponentIds, endGame])

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
  const selfDisplayBoard: Board = isPlaying || isFinished
    ? game.board
    : Array.from({ length: BOARD_ROWS }, () => Array.from({ length: BOARD_COLS }, () => null))

  // ── Result text ──────────────────────────────────────────────────────────
  let resultTitle = t('fb.gameOver')
  let resultMark: 'win' | 'loss' | 'draw' = 'draw'
  if (isFinished && room) {
    if (room.winner_id === currentUserId) {
      resultTitle = t('chess.youWon')
      resultMark = 'win'
    } else if (room.winner_id) {
      const winnerProfile = friendProfiles.find(p => p.id === room.winner_id)
      resultTitle = winnerProfile ? t('fb.playerWon', { name: winnerProfile.display_name }) : t('chess.youLost')
      resultMark = 'loss'
    } else {
      resultTitle = t('chess.drawResult')
      resultMark = 'draw'
    }
  }

  const pendingInviteCount = [...invitedIds].filter(id => !(room?.player_ids ?? []).includes(id)).length
  const canInviteMore = (id: string) =>
    invitedIds.has(id) || ((room?.player_ids.length ?? 1) + pendingInviteCount < MAX_PLAYERS)

  // ── Overlay (lobby → ready → finished); null while playing ─────────────────
  let overlay: React.ReactNode = null
  if (isFinished && room) {
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
        {isHost && (
          <>
            <div className="game-computer-picker" aria-label={t('game.computerCount')}>
              {[1, 2, 3].map(n => (
                <button
                  key={n}
                  className={`game-computer-count${computerOpponents === n ? ' selected' : ''}`}
                  onClick={() => setComputerOpponents(n as 1 | 2 | 3)}
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
  } else if (!isPlaying && !isFinished && !room) {
    overlay = (
      <GameOverlayCard emoji="🧱" title={t('game.fallingBlocks')}>
        <button
          className="game-invite-btn"
          onClick={handleOpenInvite}
          disabled={loading}
        >
          {t('game.inviteFriends')}
        </button>
        <div className="game-computer-picker" aria-label={t('game.computerCount')}>
          {[1, 2, 3].map(n => (
            <button
              key={n}
              className={`game-computer-count${computerOpponents === n ? ' selected' : ''}`}
              onClick={() => setComputerOpponents(n as 1 | 2 | 3)}
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
      title={t('game.fallingBlocks')}
      onBack={handleBack}
      controls={isPlaying && !myTopOutServer ? (
        <button
          className="game-btn game-btn-danger"
          onClick={handleForfeit}
        >
          Forfeit
        </button>
      ) : undefined}
      fillBoard
      board={
        <div className="falling-blocks-game-layout">
        <div className="falling-blocks-opponents-row">
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
                fallbackName={isComputerPlayerId(id) ? computerPlayerName(id) : `Player ${idx + 2}`}
              />
            ))
          )}
        </div>
        <div className="falling-blocks-self-row">
          <div className="falling-blocks-self-board-wrap">
            <FallingBlocksBoard
              board={selfDisplayBoard}
              currentPiece={isPlaying && !myTopOutServer ? game.current : null}
              ghost={isPlaying && !myTopOutServer ? ghost : null}
              size="self"
            />

            {/* Self topped out (game still going) — stays anchored to the
                board because it's a "you specifically are out" indicator. */}
            {isPlaying && myTopOutServer && (
              <div className="falling-blocks-topout-overlay">
                <span>{t('fb.youAreOut')}</span>
              </div>
            )}
          </div>

          {/* Side info */}
          <div className="falling-blocks-side-info">
            <div className="falling-blocks-stat">
              <span className="falling-blocks-stat-label">{t('fb.score')}</span>
              <span className="falling-blocks-stat-value">{game.score}</span>
            </div>
            <div className="falling-blocks-stat">
              <span className="falling-blocks-stat-label">{t('fb.lines')}</span>
              <span className="falling-blocks-stat-value">{game.lines}</span>
            </div>
            <div className="falling-blocks-stat">
              <span className="falling-blocks-stat-label">{t('fb.incoming')}</span>
              <span className="falling-blocks-stat-value">
                {game.garbagePending + (myPlayerState?.garbage_pending ?? 0)}
              </span>
            </div>
            <div className="falling-blocks-stat">
              <span className="falling-blocks-stat-label">{t('fb.next')}</span>
              <NextPiecesPreview pieces={game.next} />
            </div>
            {isLobby && room && (
              <div className="falling-blocks-stat">
                <span className="falling-blocks-stat-label">{t('common.you')}</span>
                <span className="falling-blocks-stat-value">
                  {currentUserProfile?.display_name ?? 'Me'}
                </span>
              </div>
            )}
          </div>
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
        message: t('confirm.forfeitFb'),
        confirmLabel: t('poker.forfeit'),
        onConfirm: confirmForfeit,
        onCancel: () => setShowForfeitConfirm(false),
      }}
    />
  )
}
