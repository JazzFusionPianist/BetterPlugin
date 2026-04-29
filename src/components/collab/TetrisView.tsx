import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile, TetrisPlayerState } from '../../types/collab'
import { useTetrisRoom } from '../../hooks/useTetrisRoom'
import {
  initialTetrisState,
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
} from '../../hooks/useTetris'
import type { TetrisState, Board, Piece, PieceType } from '../../hooks/useTetris'

// ─── Constants ────────────────────────────────────────────────────────────────

const GRAVITY_MS = 800
const TICK_MS = 50
const SYNC_THROTTLE_MS = 250

const PIECE_CLASS: Record<string, string> = {
  I: 'tetris-cell--I',
  O: 'tetris-cell--O',
  T: 'tetris-cell--T',
  S: 'tetris-cell--S',
  Z: 'tetris-cell--Z',
  J: 'tetris-cell--J',
  L: 'tetris-cell--L',
  G: 'tetris-cell--G',
}

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

// ─── Board renderer ───────────────────────────────────────────────────────────

interface TetrisBoardProps {
  board: Board
  currentPiece?: Piece | null
  ghost?: Piece | null
  topOut?: boolean
  size?: 'self' | 'opponent'
}

function TetrisBoard({ board, currentPiece, ghost, topOut, size = 'self' }: TetrisBoardProps) {
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
    <div className={`tetris-board ${sizeClass}`} role="grid" aria-label="Tetris board">
      {display.map((row, r) => (
        <div key={r} className="tetris-board-row" style={{ display: 'contents' }}>
          {row.map((cell, c) => {
            let cls = 'tetris-cell'
            if (cell) {
              if (cell.startsWith('ghost-')) {
                const t = cell.slice('ghost-'.length)
                cls += ` tetris-cell--ghost ${PIECE_CLASS[t] ?? ''}`
              } else {
                cls += ` ${PIECE_CLASS[cell] ?? ''}`
              }
            }
            return <div key={`${r}-${c}`} className={cls} />
          })}
        </div>
      ))}
      {topOut && (
        <div className="tetris-topout-overlay">
          <span>Topped out</span>
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
    <div className="tetris-next-list">
      {pieces.slice(0, 3).map((type, i) => {
        const shape = PIECE_PREVIEW_SHAPES[type]
        return (
          <div
            key={i}
            className="tetris-next-piece"
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
                  className={v ? `tetris-cell ${PIECE_CLASS[type]}` : 'tetris-cell'}
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
  state: TetrisPlayerState | undefined
  fallbackName: string
}

function OpponentBoard({ profile, state, fallbackName }: OpponentBoardProps) {
  const board: Board = state?.board ?? Array.from({ length: BOARD_ROWS }, () =>
    Array.from({ length: BOARD_COLS }, () => null)
  )
  return (
    <div className="tetris-opponent">
      <div className="tetris-opponent-header">
        {profile && <Avatar profile={profile} size={20} />}
        <span className="tetris-opponent-name">
          {profile?.display_name ?? fallbackName}
        </span>
        <span className="tetris-opponent-score">
          {state?.score ?? 0}
        </span>
      </div>
      <TetrisBoard
        board={board}
        topOut={state?.top_out ?? false}
        size="opponent"
      />
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
      className="tetris-invite-modal-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="tetris-invite-modal" role="dialog" aria-label="Invite friends">
        <div className="tetris-invite-modal-header">
          <span className="tetris-invite-modal-title">
            Invite Friends ({invitedIds.size}/{maxInvitees})
          </span>
          <button
            className="tetris-invite-modal-close"
            onClick={onClose}
            aria-label="Close invite dialog"
          >
            ×
          </button>
        </div>
        {friends.length > 0 && (
          <div className="tetris-invite-search-wrap">
            <input
              className="tetris-invite-search-input"
              type="text"
              placeholder={`Search ${friends.length} friend${friends.length === 1 ? '' : 's'}…`}
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
          </div>
        )}
        {friends.length === 0 ? (
          <p className="tetris-invite-empty">No friends to invite.</p>
        ) : filtered.length === 0 ? (
          <p className="tetris-invite-empty">No friends match "{query}".</p>
        ) : (
          <div className="tetris-invite-list">
            {filtered.map(friend => {
              const isInvited = invitedIds.has(friend.id)
              const disabled = isInvited || (limitReached && !isInvited)
              return (
                <div key={friend.id} className="tetris-invite-row">
                  <div className="tetris-invite-av-wrap">
                    <Avatar profile={friend} size={36} />
                    {friend.isOnline && <span className="tetris-invite-online-dot" />}
                  </div>
                  <span className="tetris-invite-name">{friend.display_name}</span>
                  <button
                    className="tetris-invite-do-btn"
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

export default function TetrisView({
  supabase,
  currentUserId,
  currentUserProfile,
  friendProfiles,
  onClose,
}: Props) {
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
    updateMyState,
    sendGarbage,
    setPlayerTopOut,
  } = useTetrisRoom(supabase, currentUserId)

  const [showInviteModal, setShowInviteModal] = useState(false)
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())
  const [pickedPlayerCount, setPickedPlayerCount] = useState<2 | 3 | 4>(2)

  // Local game state
  const [tetris, setTetris] = useState<TetrisState>(() => ({
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
  const tetrisRef = useRef(tetris)
  useEffect(() => { tetrisRef.current = tetris }, [tetris])

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

  const playerCount = room?.player_count ?? pickedPlayerCount
  const hasAllPlayers = !!(room && room.player_ids.length === room.player_count)
  const myReady = !!(room && room.ready_ids.includes(currentUserId))
  const allReady = !!(room && room.ready_ids.length === room.player_count && hasAllPlayers)

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
    startGame()
  }, [room, isHost, startGame])

  // ── On game start: reset local state ─────────────────────────────────────
  const prevStatusRef = useRef<string | null>(null)
  useEffect(() => {
    const prev = prevStatusRef.current
    prevStatusRef.current = status
    if (prev !== 'playing' && status === 'playing') {
      const fresh = initialTetrisState()
      setTetris(fresh)
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
      setTetris(prev => ({
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
      board: tetris.board,
      score: tetris.score,
      lines: tetris.lines,
    })
  }, [tetris.board, tetris.score, tetris.lines, isPlaying, updateMyState])

  // ── On local top-out: notify server ──────────────────────────────────────
  const reportedTopOutRef = useRef(false)
  useEffect(() => {
    if (!isPlaying) {
      reportedTopOutRef.current = false
      return
    }
    if (tetris.topOut && !reportedTopOutRef.current) {
      reportedTopOutRef.current = true
      updateMyState({
        top_out: true,
        board: tetris.board,
        score: tetris.score,
        lines: tetris.lines,
      })
    }
  }, [tetris.topOut, tetris.board, tetris.score, tetris.lines, isPlaying, updateMyState])

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
    (state: TetrisState): TetrisState => {
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
    if (myTopOutServer || tetris.topOut) return

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

      setTetris(prev => {
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
  }, [isPlaying, myTopOutServer, tetris.topOut, distributeGarbage])

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

      setTetris(prev => {
        if (prev.topOut || !prev.current) return prev
        let next = prev
        if (gravityAccum >= GRAVITY_MS) {
          gravityAccum = 0
          next = softDropTick(next, GRAVITY_MS)
        } else {
          next = softDropTick(next, dt)
        }
        if (next.lockTimer !== null && next.lockTimer <= 0) {
          // Lock & spawn
          next = handleLockAndSpawn(next)
        }
        return next
      })
    }, TICK_MS)

    return () => window.clearInterval(interval)
  }, [isPlaying, myTopOutServer, handleLockAndSpawn])

  // ── Forfeit ──────────────────────────────────────────────────────────────
  const handleForfeit = useCallback(() => {
    setPlayerTopOut(currentUserId, true)
  }, [setPlayerTopOut, currentUserId])

  // ── Rematch helper: when finished, host auto-starts when all ready ───────
  useEffect(() => {
    if (!room || !isHost) return
    if (room.status !== 'finished') return
    if (room.ready_ids.length !== room.player_count) return
    if (room.player_ids.length !== room.player_count) return
    startGame()
  }, [room, isHost, startGame])

  // ── Player count change in lobby (host only) ─────────────────────────────
  const updatePlayerCount = useCallback(
    async (count: 2 | 3 | 4) => {
      if (!room || !isHost || room.status !== 'lobby') {
        setPickedPlayerCount(count)
        return
      }
      if (room.player_ids.length > count) return
      const { error } = await supabase
        .from('tetris_rooms')
        .update({ player_count: count })
        .eq('id', room.id)
      if (error) console.error('[TetrisView.updatePlayerCount]', error)
    },
    [supabase, room, isHost]
  )

  // ── Ghost piece ──────────────────────────────────────────────────────────
  const ghost = useMemo(() => getGhostPiece(tetris), [tetris])

  // ── Display board for self ───────────────────────────────────────────────
  const selfDisplayBoard: Board = isPlaying || isFinished
    ? tetris.board
    : Array.from({ length: BOARD_ROWS }, () => Array.from({ length: BOARD_COLS }, () => null))

  // ── Result text ──────────────────────────────────────────────────────────
  let resultTitle = 'Game over'
  let resultEmoji = '🎮'
  if (isFinished && room) {
    if (room.winner_id === currentUserId) {
      resultTitle = 'You won!'
      resultEmoji = '🏆'
    } else if (room.winner_id) {
      const winnerProfile = friendProfiles.find(p => p.id === room.winner_id)
      resultTitle = winnerProfile ? `${winnerProfile.display_name} won` : 'You lost'
      resultEmoji = '😔'
    } else {
      resultTitle = 'Draw'
      resultEmoji = '🤝'
    }
  }

  const maxInvitees = playerCount - 1

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="tetris-view" style={{ userSelect: 'none' }}>
      {/* Header */}
      <div className="tetris-header">
        <button
          className="tetris-back-btn chess-back-btn"
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
        <span className="tetris-title">Tetris</span>
        {isPlaying && !myTopOutServer && (
          <div className="tetris-controls">
            <button
              className="tetris-btn tetris-btn-forfeit"
              onClick={handleForfeit}
            >
              Forfeit
            </button>
          </div>
        )}
      </div>

      <div className="tetris-game-layout">
        {/* Opponents row */}
        <div className="tetris-opponents-row">
          {opponentIds.length === 0 ? (
            <div className="tetris-opponent" style={{ opacity: 0.5 }}>
              <div className="tetris-opponent-header">
                <span className="tetris-opponent-name">Waiting…</span>
              </div>
              <TetrisBoard
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

        {/* Self row */}
        <div className="tetris-self-row">
          <div style={{ position: 'relative' }}>
            <TetrisBoard
              board={selfDisplayBoard}
              currentPiece={isPlaying && !myTopOutServer ? tetris.current : null}
              ghost={isPlaying && !myTopOutServer ? ghost : null}
              size="self"
            />

            {/* Lobby overlay: no room or not all players present */}
            {!isPlaying && !isFinished && (!room || !hasAllPlayers) && (
              <div className="tetris-finish-overlay chess-finish-overlay">
                <div className="tetris-finish-card chess-finish-card">
                  <div className="tetris-finish-emoji">🧱</div>
                  <div className="tetris-finish-title">Tetris Battle</div>
                  <div className="tetris-player-count-picker">
                    {[2, 3, 4].map(n => (
                      <button
                        key={n}
                        className={`tetris-player-count-btn${
                          (room?.player_count ?? pickedPlayerCount) === n ? ' selected' : ''
                        }`}
                        onClick={() => updatePlayerCount(n as 2 | 3 | 4)}
                        disabled={!!room && (!isHost || (room.player_ids.length > n))}
                      >
                        {n}P
                      </button>
                    ))}
                  </div>
                  {!room ? (
                    <button
                      className="tetris-btn"
                      onClick={handleCreateRoom}
                      disabled={loading}
                    >
                      Create Room
                    </button>
                  ) : (
                    isHost && (
                      <button
                        className="tetris-btn"
                        onClick={() => setShowInviteModal(true)}
                      >
                        🕹 Invite Friends
                      </button>
                    )
                  )}
                  {room && (
                    <div className="tetris-finish-readystate">
                      {room.player_ids.length} / {room.player_count} joined
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Lobby ready overlay (all players present) */}
            {isLobby && hasAllPlayers && !allReady && (
              <div className="tetris-finish-overlay chess-finish-overlay">
                <div className="tetris-finish-card chess-finish-card">
                  <div className="tetris-finish-emoji">🧱</div>
                  <div className="tetris-finish-title">Ready to play?</div>
                  <button
                    className={`tetris-ready-btn chess-ready-btn${myReady ? ' ready' : ''}`}
                    onClick={toggleReady}
                    disabled={loading}
                  >
                    {myReady ? '✓ Ready' : 'Ready'}
                  </button>
                  <div className="tetris-finish-readystate">
                    {room!.ready_ids.length} / {room!.player_count} ready
                  </div>
                </div>
              </div>
            )}

            {/* Finish overlay */}
            {isFinished && room && (
              <div className="tetris-finish-overlay chess-finish-overlay">
                <div className="tetris-finish-card chess-finish-card">
                  <div className="tetris-finish-emoji">{resultEmoji}</div>
                  <div className="tetris-finish-title">{resultTitle}</div>
                  <button
                    className={`tetris-ready-btn chess-ready-btn${myReady ? ' ready' : ''}`}
                    onClick={toggleReady}
                  >
                    {myReady ? '✓ Ready' : 'Rematch'}
                  </button>
                  <div className="tetris-finish-readystate">
                    {room.ready_ids.length} / {room.player_count} ready
                  </div>
                </div>
              </div>
            )}

            {/* Self topped out (game still going) */}
            {isPlaying && myTopOutServer && (
              <div className="tetris-topout-overlay">
                <span>You're out</span>
              </div>
            )}
          </div>

          {/* Side info */}
          <div className="tetris-side-info">
            <div className="tetris-stat">
              <span className="tetris-stat-label">Score</span>
              <span className="tetris-stat-value">{tetris.score}</span>
            </div>
            <div className="tetris-stat">
              <span className="tetris-stat-label">Lines</span>
              <span className="tetris-stat-value">{tetris.lines}</span>
            </div>
            <div className="tetris-stat">
              <span className="tetris-stat-label">Incoming</span>
              <span className="tetris-stat-value">
                {tetris.garbagePending + (myPlayerState?.garbage_pending ?? 0)}
              </span>
            </div>
            <div className="tetris-stat">
              <span className="tetris-stat-label">Next</span>
              <NextPiecesPreview pieces={tetris.next} />
            </div>
            {isLobby && hasAllPlayers && (
              <div className="tetris-stat">
                <span className="tetris-stat-label">You</span>
                <span className="tetris-stat-value">
                  {currentUserProfile?.display_name ?? 'Me'}
                </span>
              </div>
            )}
          </div>
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
