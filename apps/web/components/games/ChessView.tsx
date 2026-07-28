'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile, GameRoom } from '@/lib/games/types'
import { useGameRoom } from '@/lib/games/useGameRoom'
import {
  initialChessState,
  getValidMoves,
  applyMove,
  pieceColor,
  isInCheck,
} from '@/lib/games/useChess'
import type { ChessState, Pos } from '@/lib/games/useChess'
import { useTurnSound } from '@/lib/games/useTurnSound'
import { useT } from '@/lib/games/i18n'
import { computerPlayerId, computerPlayerName, isComputerPlayerId } from '@/lib/games/computerPlayers'
import GameShell, { GameOverlayCard, GameReadyControl, GameResultMark } from './GameShell'
import GameChat from './GameChat'

// ─── Piece SVG URLs (Wikipedia cburnett set, public domain) ───────────────────
// Renders identically across all browsers/OSes. Cached via wikimedia CDN.

const PIECE_URLS: Record<string, string> = {
  wK: 'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg',
  wQ: 'https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg',
  wR: 'https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg',
  wB: 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg',
  wN: 'https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg',
  wP: 'https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg',
  bK: 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg',
  bQ: 'https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg',
  bR: 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg',
  bB: 'https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg',
  bN: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg',
  bP: 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg',
}

const PIECE_NAMES: Record<string, string> = {
  wK: 'White King', wQ: 'White Queen', wR: 'White Rook',
  wB: 'White Bishop', wN: 'White Knight', wP: 'White Pawn',
  bK: 'Black King', bQ: 'Black Queen', bR: 'Black Rook',
  bB: 'Black Bishop', bN: 'Black Knight', bP: 'Black Pawn',
}

const FILE_LABELS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

// ─── Chess board ──────────────────────────────────────────────────────────────

interface ChessBoardProps {
  state: ChessState
  myColor: 'white' | 'black'
  onMove: (from: Pos, to: Pos) => void
  lastFrom: Pos | null
  lastTo: Pos | null
  isMyTurn: boolean
}

function ChessBoard({
  state,
  myColor,
  onMove,
  lastFrom,
  lastTo,
  isMyTurn,
}: ChessBoardProps) {
  const [selected, setSelected] = useState<Pos | null>(null)
  const [validMoves, setValidMoves] = useState<Pos[]>([])

  // Reset selection when turn changes or game state changes
  useEffect(() => {
    setSelected(null)
    setValidMoves([])
  }, [state.turn])

  // Board representation: row 0 = rank 8 (black back), row 7 = rank 1 (white back).
  // Standard chess display: your pieces at the bottom, opponent at top.
  // White view: render row 0 first (black at top) → row 7 last (white at bottom).
  // Black view: render row 7 first (white at top) → row 0 last (black at bottom).
  const rows = myColor === 'white' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0]
  const cols = myColor === 'white' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0]

  // Find king position for check highlight
  const myKingPos: Pos | null = (() => {
    const pfx = myColor === 'white' ? 'w' : 'b'
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (state.board[r][c] === pfx + 'K') return [r, c]
      }
    }
    return null
  })()

  const opponentColor = myColor === 'white' ? 'black' : 'white'
  const opponentKingPos: Pos | null = (() => {
    const pfx = opponentColor === 'white' ? 'w' : 'b'
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (state.board[r][c] === pfx + 'K') return [r, c]
      }
    }
    return null
  })()

  const myKingInCheck = myKingPos !== null && isInCheck(state.board, myColor)
  const opponentKingInCheck = opponentKingPos !== null && isInCheck(state.board, opponentColor)

  function posEq(a: Pos | null, b: Pos | null) {
    if (!a || !b) return false
    return a[0] === b[0] && a[1] === b[1]
  }

  function handleSquareClick(row: number, col: number) {
    const piece = state.board[row][col]

    if (selected) {
      const isValid = validMoves.some(([vr, vc]) => vr === row && vc === col)
      if (isValid) {
        onMove(selected, [row, col])
        setSelected(null)
        setValidMoves([])
        return
      }
      // Clicking own piece re-selects
      if (piece && pieceColor(piece) === myColor) {
        if (isMyTurn) {
          const moves = getValidMoves(state, [row, col])
          setSelected([row, col])
          setValidMoves(moves)
        }
        return
      }
      // Clicking elsewhere deselects
      setSelected(null)
      setValidMoves([])
      return
    }

    // No piece selected yet
    if (!piece) return
    if (!isMyTurn) return
    if (pieceColor(piece) !== myColor) return

    const moves = getValidMoves(state, [row, col])
    setSelected([row, col])
    setValidMoves(moves)
  }

  // Drag handlers: HTML5 drag & drop
  function handleDragStart(e: React.DragEvent, row: number, col: number) {
    const piece = state.board[row][col]
    if (!piece || !isMyTurn || pieceColor(piece) !== myColor) {
      e.preventDefault()
      return
    }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', `${row},${col}`)
    const moves = getValidMoves(state, [row, col])
    setSelected([row, col])
    setValidMoves(moves)
  }

  function handleDragOver(e: React.DragEvent, row: number, col: number) {
    if (!selected) return
    const isValid = validMoves.some(([vr, vc]) => vr === row && vc === col)
    if (isValid) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
    }
  }

  function handleDrop(e: React.DragEvent, row: number, col: number) {
    e.preventDefault()
    if (!selected) return
    const isValid = validMoves.some(([vr, vc]) => vr === row && vc === col)
    if (isValid) {
      onMove(selected, [row, col])
    }
    setSelected(null)
    setValidMoves([])
  }

  function handleDragEnd() {
    // Clear selection if drop didn't land on a valid square
    setSelected(null)
    setValidMoves([])
  }

  return (
    <div className="chess-board" role="grid" aria-label="Chess board">
      {rows.map((row, rowIdx) => (
        <div key={row} className="chess-board-row" style={{ display: 'contents' }}>
          {cols.map((col, colIdx) => {
            const isLight = (row + col) % 2 === 0
            const piece = state.board[row][col]
            const isSelected = posEq(selected, [row, col])
            const isValidTarget = validMoves.some(([vr, vc]) => vr === row && vc === col)
            const isLastMove = posEq(lastFrom, [row, col]) || posEq(lastTo, [row, col])
            const isMyKingCheck = myKingInCheck && posEq(myKingPos, [row, col])
            const isOpponentKingCheck = opponentKingInCheck && posEq(opponentKingPos, [row, col])
            const isCheck = isMyKingCheck || isOpponentKingCheck

            const classes = [
              'chess-sq',
              isLight ? 'sq-light' : 'sq-dark',
              isSelected ? 'sq-selected' : '',
              isLastMove ? 'sq-lastmove' : '',
              isCheck ? 'sq-check' : '',
            ]
              .filter(Boolean)
              .join(' ')

            // Rank label on leftmost column in display
            const showRankLabel = colIdx === 0
            const rankLabel = 8 - row

            // File label on bottom row in display
            const showFileLabel = rowIdx === 7
            const fileLabel = FILE_LABELS[col]

            const canDragThis = piece !== null && isMyTurn && pieceColor(piece) === myColor
            return (
              <div
                key={col}
                className={classes}
                role="gridcell"
                aria-label={`${FILE_LABELS[col]}${8 - row}${piece ? ' ' + piece : ''}`}
                onClick={() => handleSquareClick(row, col)}
                onDragOver={e => handleDragOver(e, row, col)}
                onDrop={e => handleDrop(e, row, col)}
                style={{ position: 'relative', cursor: isMyTurn ? 'pointer' : 'default' }}
              >
                {showRankLabel && (
                  <span
                    className="chess-sq-rank"
                    style={{
                      position: 'absolute',
                      top: 2,
                      left: 3,
                      fontSize: 10,
                      fontWeight: 700,
                      lineHeight: 1,
                      opacity: 0.6,
                      pointerEvents: 'none',
                    }}
                  >
                    {rankLabel}
                  </span>
                )}
                {showFileLabel && (
                  <span
                    className="chess-sq-file"
                    style={{
                      position: 'absolute',
                      bottom: 2,
                      right: 3,
                      fontSize: 10,
                      fontWeight: 700,
                      lineHeight: 1,
                      opacity: 0.6,
                      pointerEvents: 'none',
                    }}
                  >
                    {fileLabel}
                  </span>
                )}
                {isValidTarget && (
                  <span
                    className={`sq-valid${piece ? '' : ''}`}
                    style={{ pointerEvents: 'none' }}
                  >
                    {piece ? null : <span className="sq-valid-dot" />}
                    {piece ? <span className="sq-valid-capture" /> : null}
                  </span>
                )}
                {piece && (
                  <span
                    className={`chess-piece chess-piece-${piece.startsWith('b') ? 'black' : 'white'}`}
                    draggable={canDragThis}
                    onDragStart={e => handleDragStart(e, row, col)}
                    onDragEnd={handleDragEnd}
                    style={{
                      cursor: canDragThis ? 'grab' : 'default',
                    }}
                  >
                    <img src={PIECE_URLS[piece]} alt={PIECE_NAMES[piece] ?? piece} draggable={false} />
                  </span>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ─── Promotion modal ──────────────────────────────────────────────────────────

interface PromotionModalProps {
  color: 'white' | 'black'
  onChoose: (piece: string) => void
}

function PromotionModal({ color, onChoose }: PromotionModalProps) {
  const pfx = color === 'white' ? 'w' : 'b'
  const choices = ['Q', 'R', 'B', 'N']

  return (
    <div className="chess-promo-modal" role="dialog" aria-label="Promote pawn">
      <div className="chess-promo-modal-inner">
        <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: 14 }}>
          Promote pawn to:
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          {choices.map(type => (
            <button
              key={type}
              className="chess-promo-choice"
              onClick={() => onChoose(pfx + type)}
              aria-label={`Promote to ${type}`}
            >
              <img src={PIECE_URLS[pfx + type]} alt={PIECE_NAMES[pfx + type] ?? pfx + type} draggable={false} style={{ width: '80%', height: '80%', objectFit: 'contain' }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function chessStateFromRoom(room: GameRoom): ChessState {
  const base = initialChessState()
  return {
    board: (room.board ?? base.board) as ChessState['board'],
    turn: room.turn,
    castling: room.castling,
    enPassant: room.en_passant as Pos | null,
    halfmove: room.halfmove,
    fullmove: base.fullmove,
  }
}

function getOppositeColor(color: 'white' | 'black'): 'white' | 'black' {
  return color === 'white' ? 'black' : 'white'
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  supabase: SupabaseClient
  currentUserId: string
  currentUserProfile: Profile | null
  friendProfiles: Profile[]
  onClose: () => void
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ChessView({
  supabase,
  currentUserId,
  currentUserProfile,
  friendProfiles,
  onClose,
}: Props) {
  const { t } = useT()
  const { room, loading, createRoom, startGame, makeMove, endGame, inviteFriend, cancelInvite, joinRoom, leaveRoom, deleteCurrentRoom, toggleReady, findActiveRoom, setRoom } =
    useGameRoom(supabase, currentUserId)
  const [resolvingRoom, setResolvingRoom] = useState(true)
  const [computerStartPending, setComputerStartPending] = useState(false)

  // Back button: in lobby/finished, delete the room so the next visit starts
  // fresh. In playing, just unmount locally so the user can resume later.
  const handleBack = useCallback(() => {
    if (room && (room.status === 'lobby' || room.status === 'finished')) {
      deleteCurrentRoom()
    } else {
      leaveRoom()
    }
    onClose()
  }, [room, deleteCurrentRoom, leaveRoom, onClose])

  // On mount: auto-join from pending invite first, otherwise resume any active room
  useEffect(() => {
    if (room) return
    let cancelled = false
    const resumeRoom = async () => {
      const pendingRoomId = sessionStorage.getItem('join_room_id')
      if (pendingRoomId) {
        sessionStorage.removeItem('join_room_id')
        const joined = await joinRoom(pendingRoomId)
        if (joined || cancelled) {
          if (!cancelled) setResolvingRoom(false)
          return
        }
      }
      if (!cancelled) await findActiveRoom()
      if (!cancelled) setResolvingRoom(false)
    }
    resumeRoom()
    return () => { cancelled = true }
  }, [joinRoom, findActiveRoom, room])

  // Local chess state (mirrors room, but updated optimistically)
  const [chessState, setChessState] = useState<ChessState>(initialChessState())

  // Last move squares for highlighting
  const [lastFrom, setLastFrom] = useState<Pos | null>(null)
  const [lastTo, setLastTo] = useState<Pos | null>(null)

  // Pawn promotion pending
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Pos; to: Pos } | null>(null)

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showResignConfirm, setShowResignConfirm] = useState(false)
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())

  // Draw offer state
  const [drawOffering, setDrawOffering] = useState(false)

  // Sync chess state from room updates
  useEffect(() => {
    if (!room || room.status === 'lobby' || !room.board) return
    setChessState(chessStateFromRoom(room))
  }, [room])

  // The invited friend claimed the seat — the invite list has done its
  // job, so close it and put Ready one tap away.
  useEffect(() => {
    if (room?.guest_id) setShowInviteModal(false)
  }, [room?.guest_id])

  // Determine my color and opponent
  const myColor: 'white' | 'black' = room
    ? currentUserId === room.host_id
      ? room.host_color
      : getOppositeColor(room.host_color)
    : 'white'

  const opponentId = room
    ? currentUserId === room.host_id
      ? room.guest_id
      : room.host_id
    : null

  const opponentProfile = opponentId && !isComputerPlayerId(opponentId)
    ? friendProfiles.find(p => p.id === opponentId) ?? null
    : null
  const isComputerMatch = !!(
    room &&
    room.status === 'playing' &&
    !room.guest_id &&
    currentUserId === room.host_id
  )
  const isComputerOpponent = isComputerPlayerId(opponentId) || isComputerMatch

  const isHost = room ? currentUserId === room.host_id : false

  const isMyTurn =
    chessState.turn === myColor && room?.status === 'playing'
  // Chime when it becomes my turn. Honors the Notifications toggle.
  useTurnSound(isMyTurn, 'chess', room?.status === 'playing')

  // Captured pieces
  const myCaptured: string[] = room
    ? myColor === 'white'
      ? (room.captured?.white ?? [])
      : (room.captured?.black ?? [])
    : []
  const opponentCaptured: string[] = room
    ? myColor === 'white'
      ? (room.captured?.black ?? [])
      : (room.captured?.white ?? [])
    : []

  // ── Actions ────────────────────────────────────────────────

  const handleCreateAndInvite = useCallback(
    async (friendId: string) => {
      // Toggle: if we've already invited this friend in this lobby
      // session, treat the click as a cancellation. Removes the row
      // from the recipient's notifications via realtime DELETE.
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
        targetRoom = await createRoom()
      }
      if (!targetRoom) return
      await inviteFriend(friendId, targetRoom.id)
      setInvitedIds(prev => new Set([...prev, friendId]))
    },
    [room, invitedIds, createRoom, inviteFriend, cancelInvite],
  )

  const handlePlayComputer = useCallback(async () => {
    setComputerStartPending(true)
    try {
      let targetRoom = room
      if (!targetRoom) targetRoom = await createRoom()
      if (!targetRoom) {
        setComputerStartPending(false)
        return
      }
      const initialState = initialChessState()
      const { data, error } = await supabase
        .from('game_rooms')
        .update({
          status: 'playing',
          board: initialState.board as (string | null)[][],
          turn: 'white',
          captured: { white: [], black: [], computer: true },
          move_history: [],
          castling: { wK: true, wQ: true, bK: true, bQ: true },
          en_passant: null,
          halfmove: 0,
          winner_id: null,
          draw_offered_by: null,
          host_ready: false,
          guest_ready: false,
        })
        .eq('id', targetRoom.id)
        .select()
        .single()
      if (error || !data) {
        console.error('[ChessView.handlePlayComputer]', error)
        setComputerStartPending(false)
        return
      }
      setRoom(data as GameRoom)
      setChessState(initialState)
      setLastFrom(null)
      setLastTo(null)
    } catch (error) {
      console.error('[ChessView.handlePlayComputer]', error)
      setComputerStartPending(false)
    }
  }, [room, createRoom, supabase, setRoom])

  useEffect(() => {
    if (room?.status === 'playing') setComputerStartPending(false)
  }, [room?.status])

  const handleMove = useCallback(
    async (from: Pos, to: Pos, promoteTo?: string) => {
      if (!room || !isMyTurn) return

      const result = applyMove(chessState, from, to, promoteTo)

      // If promotion needed and no choice yet, pause and ask
      if (result.promotion && !promoteTo) {
        setPendingPromotion({ from, to })
        return
      }

      // Optimistic update
      setChessState(result.state)
      setLastFrom(from)
      setLastTo(to)

      // Update captured
      const newCaptured = { ...(room.captured ?? { white: [], black: [] }) }
      if (result.captured) {
        const capturedBy = myColor === 'white' ? 'white' : 'black'
        newCaptured[capturedBy] = [...(newCaptured[capturedBy] ?? []), result.captured]
      }

      // Sync to Supabase
      const updates: Partial<GameRoom> = {
        board: result.state.board as (string | null)[][],
        turn: result.state.turn,
        castling: result.state.castling,
        en_passant: result.state.enPassant as [number, number] | null,
        halfmove: result.state.halfmove,
        captured: newCaptured,
        move_history: [...(room.move_history ?? []), result.algebraic],
      }
      await makeMove(updates)

      // Handle end conditions
      if (result.isCheckmate) {
        await endGame(currentUserId)
      } else if (result.isStalemate || result.isDraw) {
        await endGame(null)
      }
    },
    [room, isMyTurn, chessState, myColor, currentUserId, makeMove, endGame],
  )

  const handlePromotionChoice = useCallback(
    (piece: string) => {
      if (!pendingPromotion) return
      const { from, to } = pendingPromotion
      setPendingPromotion(null)
      handleMove(from, to, piece)
    },
    [pendingPromotion, handleMove],
  )

  const computerMoveKeyRef = useRef('')
  useEffect(() => {
    if (!room || room.status !== 'playing' || !isComputerOpponent) return
    const computerColor = getOppositeColor(myColor)
    if (chessState.turn !== computerColor) return
    const moveKey = `${room.id}:${room.move_history?.length ?? 0}:${chessState.turn}`
    if (computerMoveKeyRef.current === moveKey) return
    const timer = window.setTimeout(async () => {
      const moves: { from: Pos; to: Pos; capture: boolean }[] = []
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = chessState.board[r][c]
          if (!piece || pieceColor(piece) !== computerColor) continue
          for (const to of getValidMoves(chessState, [r, c])) {
            moves.push({ from: [r, c], to, capture: !!chessState.board[to[0]][to[1]] })
          }
        }
      }
      if (moves.length === 0) return
      const captures = moves.filter(m => m.capture)
      const pool = captures.length > 0 ? captures : moves
      const chosen = pool[Math.floor(Math.random() * pool.length)]
      computerMoveKeyRef.current = moveKey
      const result = applyMove(chessState, chosen.from, chosen.to, 'Q')
      setChessState(result.state)
      setLastFrom(chosen.from)
      setLastTo(chosen.to)

      const newCaptured = { ...(room.captured ?? { white: [], black: [] }) }
      if (result.captured) {
        newCaptured[computerColor] = [...(newCaptured[computerColor] ?? []), result.captured]
      }
      await makeMove({
        board: result.state.board as (string | null)[][],
        turn: result.state.turn,
        castling: result.state.castling,
        en_passant: result.state.enPassant as [number, number] | null,
        halfmove: result.state.halfmove,
        captured: newCaptured,
        move_history: [...(room.move_history ?? []), result.algebraic],
      })
      if (result.isCheckmate) {
        await endGame(null)
      } else if (result.isStalemate || result.isDraw) {
        await endGame(null)
      }
    }, 650)
    return () => window.clearTimeout(timer)
  }, [room, isComputerOpponent, opponentId, myColor, chessState, makeMove, endGame])

  // In-app confirm modal — matches the other games and works inside the
  // plugin (JUCE's WKWebView blocks window.confirm).
  const handleResign = useCallback(() => {
    if (!room || (!opponentId && !isComputerOpponent)) return
    setShowResignConfirm(true)
  }, [room, opponentId, isComputerOpponent])
  const confirmResign = useCallback(async () => {
    setShowResignConfirm(false)
    if (!room || (!opponentId && !isComputerOpponent)) return
    await endGame(isComputerOpponent ? null : opponentId)
  }, [room, opponentId, isComputerOpponent, endGame])

  const handleDrawOffer = useCallback(async () => {
    if (!room) return
    // If opponent already offered, accept
    if (room.draw_offered_by && room.draw_offered_by !== currentUserId) {
      await endGame(null)
      return
    }
    // Otherwise offer
    setDrawOffering(true)
    await makeMove({ draw_offered_by: currentUserId } as Partial<GameRoom>)
  }, [room, currentUserId, endGame, makeMove])

  // Auto-start when both players ready (host only triggers to avoid races)
  const isHostLocal = room ? currentUserId === room.host_id : false
  useEffect(() => {
    if (!room || !isHostLocal) return
    if (room.status === 'lobby' && room.guest_id && room.host_ready && room.guest_ready) {
      const initialState = initialChessState()
      startGame(initialState.board as (string | null)[][])
      setChessState(initialState)
      setLastFrom(null)
      setLastTo(null)
    }
  }, [room, isHostLocal, startGame])

  // ── Derived status ─────────────────────────────────────────────────────────
  const status = room?.status ?? 'lobby'
  const isFinished = status === 'finished'
  const isLobby = status === 'lobby'
  const isPlaying = status === 'playing'

  const hasGuest = !!(room && room.guest_id)
  const myReady = room ? (isHostLocal ? room.host_ready : room.guest_ready) : false
  const opponentReady = room ? (isHostLocal ? room.guest_ready : room.host_ready) : false

  // Display board: live state during play/finished, otherwise initial position
  const displayState = (isPlaying || isFinished) ? chessState : initialChessState()

  const drawOfferedByOpponent =
    !!(room && room.draw_offered_by !== null && room.draw_offered_by !== currentUserId)

  let resultTitle = t('chess.drawResult')
  let resultMark: 'win' | 'loss' | 'draw' = 'draw'
  if (isFinished && room) {
    if (room.winner_id === currentUserId) {
      resultTitle = t('chess.youWon')
      resultMark = 'win'
    } else if (room.winner_id && room.winner_id !== currentUserId) {
      resultTitle = t('chess.youLost')
      resultMark = 'loss'
    }
  }

  const readyCountStr = room
    ? t('chess.readyCount', { n: (room.host_ready ? 1 : 0) + (room.guest_ready ? 1 : 0) })
    : ''

  // ── Overlay (lobby → ready → finished); null while playing ─────────────────
  let overlay: React.ReactNode = null
  if (computerStartPending) {
    overlay = null
  } else if (isFinished && room) {
    overlay = (
      <GameOverlayCard emoji={<GameResultMark result={resultMark} />} title={resultTitle}>
        <GameReadyControl ready={myReady} count={readyCountStr} onToggle={toggleReady} />
      </GameOverlayCard>
    )
  } else if (isLobby && hasGuest) {
    overlay = (
      <GameOverlayCard emoji="♟" title={t('game.readyToPlay')}>
        <GameReadyControl ready={myReady} count={readyCountStr} onToggle={toggleReady} disabled={loading} />
      </GameOverlayCard>
    )
  } else if (resolvingRoom) {
    overlay = <GameOverlayCard emoji="⏳" title={t('common.joining')} />
  } else if (!isPlaying) {
    if (!room || (isHost && !hasGuest)) {
      overlay = (
        <GameOverlayCard emoji="♟" title={t('game.chess')}>
          <button className="game-invite-btn" onClick={() => setShowInviteModal(true)} disabled={loading}>
            {t('chess.inviteCta')}
          </button>
          <button className="game-invite-btn game-computer-btn" onClick={handlePlayComputer} disabled={loading}>
            {t('game.playComputer')}
          </button>
          {room && !hasGuest && (
            <div className="game-finish-readystate">{t('chess.waitingForFriend')}</div>
          )}
        </GameOverlayCard>
      )
    } else {
      overlay = <GameOverlayCard emoji="⏳" title={t('common.joining')} />
    }
  }

  return (
    <GameShell
      className="chess-shell"
      title={t('game.chess')}
      onBack={handleBack}
      actionStatus={
        isPlaying
          ? chessState.turn === myColor
            ? <>● {t('chess.yourTurn')}</>
            : <>● {t('common.thinking')}</>
          : undefined
      }
      controls={isPlaying ? (
        <span className="chess-row-controls">
          <button className="game-btn game-btn-danger" onClick={handleResign}>
            {t('chess.resign')}
          </button>
          <button
            className="game-btn"
            onClick={handleDrawOffer}
            disabled={drawOffering && !drawOfferedByOpponent}
            title={drawOfferedByOpponent ? t('chess.opponentOffered') : t('chess.offerDraw')}
          >
            {drawOfferedByOpponent ? t('chess.acceptDraw') : drawOffering ? t('chess.drawOffered') : t('chess.draw')}
          </button>
        </span>
      ) : undefined}
      aboveBoard={
        <>
          <div className="game-player-row chess-player-captured-row">
            {opponentProfile ? (
              <span className="game-player-name">{opponentProfile.display_name}</span>
            ) : isComputerOpponent ? (
              <span className="game-player-name">{computerPlayerName(computerPlayerId(0))}</span>
            ) : (
              <span className="game-player-name game-player-name--unknown">
                {hasGuest ? t('common.opponent') : t('common.waiting')}
              </span>
            )}
            <span className="chess-captured" aria-hidden={opponentCaptured.length === 0}>
              {opponentCaptured.map((p, i) => (
                <img
                  key={i}
                  className={`chess-captured-piece chess-captured-piece--${p.startsWith('b') ? 'black' : 'white'}`}
                  src={PIECE_URLS[p]}
                  alt={PIECE_NAMES[p] ?? p}
                  draggable={false}
                />
              ))}
            </span>
            {isLobby && hasGuest && (
              <span className={`game-ready-badge${opponentReady ? ' ready' : ''}`}>
                {opponentReady ? t('common.readyCheck') : t('common.notReady')}
              </span>
            )}
          </div>
        </>
      }
      board={computerStartPending ? (
        <div className="game-transition-blank" />
      ) : (
        <div className="chess-board-wrap">
          <ChessBoard
            state={displayState}
            myColor={myColor}
            onMove={handleMove}
            lastFrom={isPlaying || isFinished ? lastFrom : null}
            lastTo={isPlaying || isFinished ? lastTo : null}
            isMyTurn={isMyTurn && isPlaying}
          />
        </div>
      )}
      belowBoard={
        <>
          <div className="game-player-row chess-player-captured-row">
            {currentUserProfile ? (
              <span className="game-player-name">{currentUserProfile.display_name}</span>
            ) : (
              <span className="game-player-name">{t('common.me')}</span>
            )}
            <span className="chess-captured" aria-hidden={myCaptured.length === 0}>
              {myCaptured.map((p, i) => (
                <img
                  key={i}
                  className={`chess-captured-piece chess-captured-piece--${p.startsWith('b') ? 'black' : 'white'}`}
                  src={PIECE_URLS[p]}
                  alt={PIECE_NAMES[p] ?? p}
                  draggable={false}
                />
              ))}
            </span>
            {isLobby && hasGuest && (
              <span className={`game-ready-badge${myReady ? ' ready' : ''}`}>
                {myReady ? t('common.readyCheck') : t('common.notReady')}
              </span>
            )}
          </div>
          {room && (room.move_history ?? []).length > 0 && (
            <div className="chess-move-history">
              {(room.move_history ?? []).map((move, i) => (
                <span key={i} className="chess-move-entry">
                  {i % 2 === 0 && (
                    <span className="chess-move-number">{Math.floor(i / 2) + 1}.</span>
                  )}
                  {move}
                </span>
              ))}
            </div>
          )}
        </>
      }
      overlay={overlay}
      chat={!computerStartPending ? (
        <GameChat
          supabase={supabase}
          currentUserId={currentUserId}
          otherUserId={isComputerOpponent ? null : opponentId}
          otherName={isComputerOpponent ? computerPlayerName(computerPlayerId(0)) : opponentProfile?.display_name}
        />
      ) : undefined}
      invite={{
        open: showInviteModal,
        onClose: () => setShowInviteModal(false),
        friends: friendProfiles,
        invitedIds,
        onInvite: id => { handleCreateAndInvite(id) },
      }}
      confirm={{
        open: showResignConfirm,
        message: t('chess.resignConfirm'),
        confirmLabel: t('chess.resign'),
        onConfirm: confirmResign,
        onCancel: () => setShowResignConfirm(false),
      }}
      extraModals={pendingPromotion && (
        <PromotionModal color={myColor} onChoose={handlePromotionChoice} />
      )}
    />
  )
}