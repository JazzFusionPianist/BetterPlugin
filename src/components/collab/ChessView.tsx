import { useState, useEffect, useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile, GameRoom } from '../../types/collab'
import { useGameRoom } from '../../hooks/useGameRoom'
import {
  initialChessState,
  getValidMoves,
  applyMove,
  pieceColor,
  isInCheck,
} from '../../hooks/useChess'
import type { ChessState, Pos } from '../../hooks/useChess'

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

// ─── Avatar helper ────────────────────────────────────────────────────────────

function Avatar({ profile, size = 32 }: { profile: Profile; size?: number }) {
  if (profile.avatar_url) {
    return (
      <img
        className="chess-player-av"
        src={profile.avatar_url}
        alt={profile.display_name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
      />
    )
  }
  return (
    <div
      className="chess-player-av"
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
                    className="chess-piece"
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

// ─── Board preview (lobby) ────────────────────────────────────────────────────

function BoardPreview() {
  const squares: React.ReactNode[] = []
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const isLight = (r + c) % 2 === 0
      squares.push(
        <div
          key={`${r}-${c}`}
          className={`chess-sq ${isLight ? 'sq-light' : 'sq-dark'}`}
        />
      )
    }
  }
  return (
    <div className="chess-lobby-board-preview chess-board" aria-hidden="true">
      {squares}
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

// ─── Invite modal ─────────────────────────────────────────────────────────────

interface InviteModalProps {
  friends: Profile[]
  invitedIds: Set<string>
  onInvite: (friendId: string) => void
  onClose: () => void
}

function InviteModal({ friends, invitedIds, onInvite, onClose }: InviteModalProps) {
  return (
    <div
      className="chess-invite-modal"
      role="dialog"
      aria-label="Invite a friend"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="chess-invite-modal-inner">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Invite a Friend</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
            aria-label="Close invite dialog"
          >
            ×
          </button>
        </div>
        {friends.length === 0 ? (
          <p style={{ color: 'var(--text-muted, #888)', fontSize: 14, margin: 0 }}>
            No friends to invite.
          </p>
        ) : (
          <div className="chess-invite-list">
            {friends.map(friend => (
              <div key={friend.id} className="chess-invite-row">
                <Avatar profile={friend} size={36} />
                <span className="chess-invite-name">{friend.display_name}</span>
                <button
                  className="chess-invite-do-btn"
                  onClick={() => onInvite(friend.id)}
                  disabled={invitedIds.has(friend.id)}
                >
                  {invitedIds.has(friend.id) ? 'Invited ✓' : 'Invite'}
                </button>
              </div>
            ))}
          </div>
        )}
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
  const { room, loading, createRoom, startGame, makeMove, endGame, inviteFriend, joinRoom, leaveRoom } =
    useGameRoom(supabase, currentUserId)

  // Auto-join room if navigated here from a game_invite notification
  useEffect(() => {
    const pendingRoomId = sessionStorage.getItem('join_room_id')
    if (pendingRoomId && !room) {
      sessionStorage.removeItem('join_room_id')
      joinRoom(pendingRoomId)
    }
  }, [joinRoom, room])

  // Local chess state (mirrors room, but updated optimistically)
  const [chessState, setChessState] = useState<ChessState>(initialChessState())

  // Last move squares for highlighting
  const [lastFrom, setLastFrom] = useState<Pos | null>(null)
  const [lastTo, setLastTo] = useState<Pos | null>(null)

  // Pawn promotion pending
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Pos; to: Pos } | null>(null)

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())

  // Draw offer state
  const [drawOffering, setDrawOffering] = useState(false)

  // Sync chess state from room updates
  useEffect(() => {
    if (!room || room.status === 'lobby' || !room.board) return
    setChessState(chessStateFromRoom(room))
  }, [room])

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

  const opponentProfile = opponentId
    ? friendProfiles.find(p => p.id === opponentId) ?? null
    : null

  const isHost = room ? currentUserId === room.host_id : false

  const isMyTurn =
    chessState.turn === myColor && room?.status === 'playing'

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
      let targetRoom = room
      if (!targetRoom) {
        targetRoom = await createRoom()
      }
      if (!targetRoom) return
      await inviteFriend(friendId, targetRoom.id)
      setInvitedIds(prev => new Set([...prev, friendId]))
    },
    [room, createRoom, inviteFriend],
  )

  const handleStartGame = useCallback(async () => {
    if (!room) return
    const initialState = initialChessState()
    await startGame(initialState.board as (string | null)[][])
    setChessState(initialState)
    setLastFrom(null)
    setLastTo(null)
  }, [room, startGame])

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

  const handleResign = useCallback(async () => {
    if (!room || !opponentId) return
    await endGame(opponentId)
  }, [room, opponentId, endGame])

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

  const handlePlayAgain = useCallback(async () => {
    leaveRoom()
    setChessState(initialChessState())
    setLastFrom(null)
    setLastTo(null)
    setInvitedIds(new Set())
    setPendingPromotion(null)
    setDrawOffering(false)
    await createRoom()
  }, [leaveRoom, createRoom])

  // ── Result UI ──────────────────────────────────────────────

  if (room?.status === 'finished') {
    let resultTitle = 'Draw'
    let resultEmoji = '🤝'
    if (room.winner_id === currentUserId) {
      resultTitle = 'You won!'
      resultEmoji = '🏆'
    } else if (room.winner_id && room.winner_id !== currentUserId) {
      resultTitle = 'You lost'
      resultEmoji = '😔'
    }

    return (
      <div className="chess-view chess-result">
        <div className="chess-header">
          <button
            className="chess-back-btn"
            onClick={() => { leaveRoom(); onClose() }}
            aria-label="Go back"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="chess-title">Chess</span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <div className="chess-result-title">
            <span style={{ fontSize: 48 }}>{resultEmoji}</span>
            <span style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>{resultTitle}</span>
          </div>
          <button className="chess-result-btn" onClick={handlePlayAgain}>
            Play Again
          </button>
          <button className="chess-result-btn" onClick={() => { leaveRoom(); onClose() }} style={{ opacity: 0.6 }}>
            Back
          </button>
        </div>
      </div>
    )
  }

  // ── Game UI ────────────────────────────────────────────────

  if (room?.status === 'playing') {
    const drawOfferedByOpponent =
      room.draw_offered_by !== null && room.draw_offered_by !== currentUserId

    return (
      <div className="chess-view">
        {/* Header */}
        <div className="chess-header">
          <button
            className="chess-back-btn"
            onClick={() => { leaveRoom(); onClose() }}
            aria-label="Go back"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="chess-title">Chess</span>
          <div className="chess-controls">
            <button
              className="chess-btn chess-btn-resign"
              onClick={handleResign}
            >
              Resign
            </button>
            <button
              className="chess-btn chess-btn-draw"
              onClick={handleDrawOffer}
              disabled={drawOffering && !drawOfferedByOpponent}
              title={drawOfferedByOpponent ? 'Opponent offered a draw — accept?' : 'Offer draw'}
            >
              {drawOfferedByOpponent ? 'Accept Draw' : drawOffering ? 'Draw offered' : 'Draw?'}
            </button>
          </div>
        </div>

        <div className="chess-game-area">
          {/* Opponent row (top) */}
          <div className="chess-player-row chess-player-row--opponent">
            {opponentProfile ? (
              <>
                <Avatar profile={opponentProfile} size={28} />
                <span className="chess-player-name">{opponentProfile.display_name}</span>
              </>
            ) : (
              <span className="chess-player-name chess-player-name--unknown">Opponent</span>
            )}
            {chessState.turn !== myColor && room.status === 'playing' && (
              <span className="chess-player-turn">● thinking…</span>
            )}
          </div>

          {/* Opponent captured pieces */}
          {opponentCaptured.length > 0 && (
            <div className="chess-captured">
              {opponentCaptured.map((p, i) => (
                <img key={i} src={PIECE_URLS[p]} alt={PIECE_NAMES[p] ?? p} draggable={false} style={{ width: 14, height: 14, verticalAlign: 'middle' }} />
              ))}
            </div>
          )}

          {/* Board */}
          <div className="chess-board-wrap">
            <ChessBoard
              state={chessState}
              myColor={myColor}
              onMove={handleMove}
              lastFrom={lastFrom}
              lastTo={lastTo}
              isMyTurn={isMyTurn}
            />
          </div>

          {/* My captured pieces */}
          {myCaptured.length > 0 && (
            <div className="chess-captured">
              {myCaptured.map((p, i) => (
                <img key={i} src={PIECE_URLS[p]} alt={PIECE_NAMES[p] ?? p} draggable={false} style={{ width: 14, height: 14, verticalAlign: 'middle' }} />
              ))}
            </div>
          )}

          {/* My player row (bottom) */}
          <div className="chess-player-row chess-player-row--me">
            {currentUserProfile ? (
              <>
                <Avatar profile={currentUserProfile} size={28} />
                <span className="chess-player-name">{currentUserProfile.display_name}</span>
              </>
            ) : (
              <span className="chess-player-name">Me</span>
            )}
            {isMyTurn && (
              <span className="chess-player-turn">● Your turn</span>
            )}
          </div>

          {/* Move history */}
          {(room.move_history ?? []).length > 0 && (
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
        </div>

        {/* Promotion modal */}
        {pendingPromotion && (
          <PromotionModal
            color={myColor}
            onChoose={handlePromotionChoice}
          />
        )}
      </div>
    )
  }

  // ── Lobby UI ───────────────────────────────────────────────

  const hasGuest = room && room.guest_id !== null
  const isWaitingForGuest = room && !room.guest_id
  const isGuestWaiting = room && room.guest_id === currentUserId

  return (
    <div className="chess-view chess-lobby">
      {/* Header */}
      <div className="chess-header">
        <button
          className="chess-back-btn"
          onClick={() => { leaveRoom(); onClose() }}
          aria-label="Go back"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="chess-title">Chess</span>
      </div>

      {/* Board preview */}
      <BoardPreview />

      {/* Lobby actions */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '0 24px', flex: 1 }}>
        {/* Invite button — only host sees it, or if no room yet */}
        {(!room || isHost) && (
          <button
            className="chess-invite-btn"
            onClick={() => setShowInviteModal(true)}
            disabled={loading}
          >
            🕹 Invite a Friend
          </button>
        )}

        {/* Guest info + start button (host only) */}
        {hasGuest && isHost && (
          <>
            <div className="chess-player-row" style={{ width: '100%', maxWidth: 280 }}>
              {opponentProfile ? (
                <>
                  <Avatar profile={opponentProfile} size={32} />
                  <span className="chess-player-name" style={{ marginLeft: 8 }}>
                    {opponentProfile.display_name}
                  </span>
                </>
              ) : (
                <span className="chess-player-name">Friend joined</span>
              )}
            </div>
            <button className="chess-btn" onClick={handleStartGame} disabled={loading}>
              ▶ Start Game
            </button>
          </>
        )}

        {/* Waiting states */}
        {isWaitingForGuest && isHost && (
          <p className="chess-waiting">Waiting for friend...</p>
        )}
        {isGuestWaiting && (
          <p className="chess-waiting">Waiting for host to start…</p>
        )}
      </div>

      {/* Invite modal */}
      {showInviteModal && (
        <InviteModal
          friends={friendProfiles}
          invitedIds={invitedIds}
          onInvite={id => {
            handleCreateAndInvite(id)
          }}
          onClose={() => setShowInviteModal(false)}
        />
      )}
    </div>
  )
}
