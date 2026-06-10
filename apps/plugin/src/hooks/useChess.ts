// Pure chess logic — no React dependencies
// Board layout: row 0 = rank 8 (black back row), row 7 = rank 1 (white back row)

export type Piece = string
export type ChessBoard = (Piece | null)[][]
export type Color = 'white' | 'black'

export interface ChessState {
  board: ChessBoard
  turn: Color
  castling: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean }
  enPassant: Pos | null
  halfmove: number
  fullmove: number
}

export interface MoveResult {
  state: ChessState
  captured: Piece | null
  promotion: boolean
  isCheck: boolean
  isCheckmate: boolean
  isStalemate: boolean
  isDraw: boolean
  algebraic: string
}

export type Pos = [row: number, col: number]

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function pieceColor(piece: Piece): Color {
  return piece[0] === 'w' ? 'white' : 'black'
}

function opponent(color: Color): Color {
  return color === 'white' ? 'black' : 'white'
}

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row <= 7 && col >= 0 && col <= 7
}

function cloneBoard(board: ChessBoard): ChessBoard {
  return board.map(row => [...row])
}

const COL_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

function posToAlg(pos: Pos): string {
  return COL_LETTERS[pos[1]] + (8 - pos[0])
}

// ─── Initial State ────────────────────────────────────────────────────────────

export function initialChessState(): ChessState {
  const board: ChessBoard = [
    ['bR', 'bN', 'bB', 'bQ', 'bK', 'bB', 'bN', 'bR'],
    ['bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP'],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ['wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP'],
    ['wR', 'wN', 'wB', 'wQ', 'wK', 'wB', 'wN', 'wR'],
  ]
  return {
    board,
    turn: 'white',
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    enPassant: null,
    halfmove: 0,
    fullmove: 1,
  }
}

// ─── Board accessor ───────────────────────────────────────────────────────────

export function boardFromState(state: ChessState): ChessBoard {
  return state.board
}

// ─── Attack / check detection ─────────────────────────────────────────────────

/**
 * Returns true if `square` is attacked by any piece of `attackerColor`.
 */
function isSquareAttackedBy(
  board: ChessBoard,
  square: Pos,
  attackerColor: Color,
): boolean {
  const [tr, tc] = square
  const pfx = attackerColor === 'white' ? 'w' : 'b'

  // Pawn attacks
  const pawnDir = attackerColor === 'white' ? 1 : -1 // white pawns move up (decreasing row)
  const pawnRow = tr + pawnDir
  for (const dc of [-1, 1]) {
    const pc = tc + dc
    if (inBounds(pawnRow, pc) && board[pawnRow][pc] === pfx + 'P') return true
  }

  // Knight attacks
  for (const [dr, dc] of [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1],
  ]) {
    const r = tr + dr, c = tc + dc
    if (inBounds(r, c) && board[r][c] === pfx + 'N') return true
  }

  // Bishop / Queen diagonals
  for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    let r = tr + dr, c = tc + dc
    while (inBounds(r, c)) {
      const p = board[r][c]
      if (p !== null) {
        if (p === pfx + 'B' || p === pfx + 'Q') return true
        break
      }
      r += dr; c += dc
    }
  }

  // Rook / Queen straight lines
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    let r = tr + dr, c = tc + dc
    while (inBounds(r, c)) {
      const p = board[r][c]
      if (p !== null) {
        if (p === pfx + 'R' || p === pfx + 'Q') return true
        break
      }
      r += dr; c += dc
    }
  }

  // King attacks
  for (const [dr, dc] of [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1],
  ]) {
    const r = tr + dr, c = tc + dc
    if (inBounds(r, c) && board[r][c] === pfx + 'K') return true
  }

  return false
}

export function isInCheck(board: ChessBoard, color: Color): boolean {
  // Find king
  const pfx = color === 'white' ? 'w' : 'b'
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === pfx + 'K') {
        return isSquareAttackedBy(board, [r, c], opponent(color))
      }
    }
  }
  return false // king not found (shouldn't happen in a valid game)
}

// ─── Pseudo-legal move generation ─────────────────────────────────────────────

/**
 * Generates pseudo-legal destination squares (does not filter for self-check).
 * Also does NOT generate castling moves here — those are handled separately
 * because they require full state context.
 */
function pseudoMoves(board: ChessBoard, from: Pos): Pos[] {
  const [r, c] = from
  const piece = board[r][c]
  if (!piece) return []

  const color = pieceColor(piece)
  const type = piece[1]
  const moves: Pos[] = []

  const push = (nr: number, nc: number): boolean => {
    if (!inBounds(nr, nc)) return false
    const target = board[nr][nc]
    if (target === null) {
      moves.push([nr, nc])
      return true // can continue sliding
    } else if (pieceColor(target) !== color) {
      moves.push([nr, nc])
      return false // capture, stop sliding
    }
    return false // own piece, blocked
  }

  switch (type) {
    case 'P': {
      const dir = color === 'white' ? -1 : 1
      const startRow = color === 'white' ? 6 : 1
      // Single advance
      if (inBounds(r + dir, c) && board[r + dir][c] === null) {
        moves.push([r + dir, c])
        // Double advance from start
        if (r === startRow && board[r + 2 * dir][c] === null) {
          moves.push([r + 2 * dir, c])
        }
      }
      // Captures
      for (const dc of [-1, 1]) {
        const nr = r + dir, nc = c + dc
        if (inBounds(nr, nc) && board[nr][nc] !== null && pieceColor(board[nr][nc]!) !== color) {
          moves.push([nr, nc])
        }
      }
      break
    }
    case 'N': {
      for (const [dr, dc] of [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1],
      ]) {
        push(r + dr, c + dc)
      }
      break
    }
    case 'B': {
      for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        let nr = r + dr, nc = c + dc
        while (push(nr, nc)) { nr += dr; nc += dc }
      }
      break
    }
    case 'R': {
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        let nr = r + dr, nc = c + dc
        while (push(nr, nc)) { nr += dr; nc += dc }
      }
      break
    }
    case 'Q': {
      for (const [dr, dc] of [
        [-1, -1], [-1, 1], [1, -1], [1, 1],
        [-1, 0], [1, 0], [0, -1], [0, 1],
      ]) {
        let nr = r + dr, nc = c + dc
        while (push(nr, nc)) { nr += dr; nc += dc }
      }
      break
    }
    case 'K': {
      for (const [dr, dc] of [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1],
      ]) {
        push(r + dr, c + dc)
      }
      break
    }
  }

  return moves
}

// ─── En passant pseudo moves ──────────────────────────────────────────────────

function enPassantMoves(state: ChessState, from: Pos): Pos[] {
  if (!state.enPassant) return []
  const [r, c] = from
  const piece = state.board[r][c]
  if (!piece || piece[1] !== 'P') return []
  const color = pieceColor(piece)
  const dir = color === 'white' ? -1 : 1
  const [epR, epC] = state.enPassant
  if (r + dir === epR && Math.abs(c - epC) === 1) {
    return [[epR, epC]]
  }
  return []
}

// ─── Castling pseudo moves ────────────────────────────────────────────────────

function castlingMoves(state: ChessState): Pos[] {
  const { board, castling, turn } = state
  const moves: Pos[] = []
  const row = turn === 'white' ? 7 : 0
  const attackerColor = opponent(turn)

  // King must not currently be in check
  if (isInCheck(board, turn)) return []

  if (turn === 'white') {
    // Kingside: e1-g1 (cols 4-6), rook on h1 (col 7)
    if (
      castling.wK &&
      board[row][5] === null &&
      board[row][6] === null &&
      !isSquareAttackedBy(board, [row, 5], attackerColor) &&
      !isSquareAttackedBy(board, [row, 6], attackerColor)
    ) {
      moves.push([row, 6])
    }
    // Queenside: e1-c1 (cols 4-2), rook on a1 (col 0)
    if (
      castling.wQ &&
      board[row][3] === null &&
      board[row][2] === null &&
      board[row][1] === null &&
      !isSquareAttackedBy(board, [row, 3], attackerColor) &&
      !isSquareAttackedBy(board, [row, 2], attackerColor)
    ) {
      moves.push([row, 2])
    }
  } else {
    // Kingside
    if (
      castling.bK &&
      board[row][5] === null &&
      board[row][6] === null &&
      !isSquareAttackedBy(board, [row, 5], attackerColor) &&
      !isSquareAttackedBy(board, [row, 6], attackerColor)
    ) {
      moves.push([row, 6])
    }
    // Queenside
    if (
      castling.bQ &&
      board[row][3] === null &&
      board[row][2] === null &&
      board[row][1] === null &&
      !isSquareAttackedBy(board, [row, 3], attackerColor) &&
      !isSquareAttackedBy(board, [row, 2], attackerColor)
    ) {
      moves.push([row, 2])
    }
  }

  return moves
}

// ─── Apply a move on a board (low-level, for simulation) ─────────────────────

interface RawMoveInfo {
  board: ChessBoard
  captured: Piece | null
  wasEnPassant: boolean
  wasCastle: boolean
  castleSide: 'K' | 'Q' | null
  promotedTo: Piece | null
}

function applyMoveToBoard(
  board: ChessBoard,
  from: Pos,
  to: Pos,
  enPassant: Pos | null,
  promoteTo: Piece | undefined,
  color: Color,
): RawMoveInfo {
  const b = cloneBoard(board)
  const [fr, fc] = from
  const [tr, tc] = to
  const piece = b[fr][fc]!
  const type = piece[1]

  let captured: Piece | null = b[tr][tc]
  let wasEnPassant = false
  let wasCastle = false
  let castleSide: 'K' | 'Q' | null = null
  let promotedTo: Piece | null = null

  // En passant capture
  if (
    type === 'P' &&
    enPassant !== null &&
    tr === enPassant[0] &&
    tc === enPassant[1]
  ) {
    wasEnPassant = true
    const capturedPawnRow = color === 'white' ? tr + 1 : tr - 1
    captured = b[capturedPawnRow][tc]
    b[capturedPawnRow][tc] = null
  }

  // Castling detection: king moving two squares
  if (type === 'K' && Math.abs(tc - fc) === 2) {
    wasCastle = true
    if (tc > fc) {
      // Kingside
      castleSide = 'K'
      b[tr][5] = b[tr][7]
      b[tr][7] = null
    } else {
      // Queenside
      castleSide = 'Q'
      b[tr][3] = b[tr][0]
      b[tr][0] = null
    }
  }

  // Move piece
  b[fr][fc] = null
  b[tr][tc] = piece

  // Promotion
  if (type === 'P') {
    const backRank = color === 'white' ? 0 : 7
    if (tr === backRank) {
      const pfx = color === 'white' ? 'w' : 'b'
      const promoPiece = promoteTo ?? pfx + 'Q'
      b[tr][tc] = promoPiece
      promotedTo = promoPiece
    }
  }

  return { board: b, captured, wasEnPassant, wasCastle, castleSide, promotedTo }
}

// ─── Legal move filter ────────────────────────────────────────────────────────

function isLegalMove(
  state: ChessState,
  from: Pos,
  to: Pos,
): boolean {
  const color = state.turn
  const { board: nb } = applyMoveToBoard(
    state.board,
    from,
    to,
    state.enPassant,
    undefined,
    color,
  )
  return !isInCheck(nb, color)
}

// ─── Public: get valid moves ──────────────────────────────────────────────────

export function getValidMoves(state: ChessState, from: Pos): Pos[] {
  const [r, c] = from
  const piece = state.board[r][c]
  if (!piece) return []
  if (pieceColor(piece) !== state.turn) return []

  const pseudo = pseudoMoves(state.board, from)
  const ep = enPassantMoves(state, from)

  // Castling only applies when the piece is the king
  const castles = piece[1] === 'K' ? castlingMoves(state) : []

  const candidates = [...pseudo, ...ep, ...castles]

  return candidates.filter(to => isLegalMove(state, from, to))
}

// ─── Algebraic notation ───────────────────────────────────────────────────────

function buildAlgebraic(
  state: ChessState,
  from: Pos,
  to: Pos,
  piece: Piece,
  captured: Piece | null,
  wasCastle: boolean,
  castleSide: 'K' | 'Q' | null,
  promotedTo: Piece | null,
  isCheck: boolean,
  isCheckmate: boolean,
): string {
  if (wasCastle) {
    const base = castleSide === 'K' ? 'O-O' : 'O-O-O'
    if (isCheckmate) return base + '#'
    if (isCheck) return base + '+'
    return base
  }

  const type = piece[1]
  const isCapture = captured !== null
  const toAlg = posToAlg(to)
  const suffix = isCheckmate ? '#' : isCheck ? '+' : ''

  if (type === 'P') {
    let str = ''
    if (isCapture) {
      str = COL_LETTERS[from[1]] + 'x' + toAlg
    } else {
      str = toAlg
    }
    if (promotedTo) {
      str += '=' + promotedTo[1]
    }
    return str + suffix
  }

  // For non-pawn pieces, check if disambiguation is needed
  const board = state.board
  const ambiguous: Pos[] = []
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (r === from[0] && c === from[1]) continue
      const p = board[r][c]
      if (!p || p !== piece) continue
      // Same piece type can reach the same square
      const moves = pseudoMoves(board, [r, c])
      if (moves.some(([mr, mc]) => mr === to[0] && mc === to[1])) {
        // Check it's legal too
        if (isLegalMove(state, [r, c], to)) {
          ambiguous.push([r, c])
        }
      }
    }
  }

  let disambig = ''
  if (ambiguous.length > 0) {
    const sameCol = ambiguous.some(([, ac]) => ac === from[1])
    const sameRow = ambiguous.some(([ar]) => ar === from[0])
    if (!sameCol) {
      disambig = COL_LETTERS[from[1]]
    } else if (!sameRow) {
      disambig = String(8 - from[0])
    } else {
      disambig = COL_LETTERS[from[1]] + String(8 - from[0])
    }
  }

  const captureStr = isCapture ? 'x' : ''
  return type + disambig + captureStr + toAlg + suffix
}

// ─── Public: apply move ───────────────────────────────────────────────────────

export function applyMove(
  state: ChessState,
  from: Pos,
  to: Pos,
  promoteTo?: Piece,
): MoveResult {
  const [fr, fc] = from
  const [tr, tc] = to
  const piece = state.board[fr][fc]!
  const type = piece[1]
  const color = state.turn
  const pfx = color === 'white' ? 'w' : 'b'

  // If promoteTo is provided, validate prefix; if not, default to queen
  let resolvedPromoteTo: Piece | undefined = promoteTo
  if (promoteTo && promoteTo[0] !== pfx[0]) {
    resolvedPromoteTo = pfx + promoteTo[1]
  }

  const rawInfo = applyMoveToBoard(
    state.board,
    from,
    to,
    state.enPassant,
    resolvedPromoteTo,
    color,
  )

  const newBoard = rawInfo.board
  const captured = rawInfo.captured
  const promotedTo = rawInfo.promotedTo

  // Update castling rights
  const newCastling = { ...state.castling }
  if (type === 'K') {
    if (color === 'white') { newCastling.wK = false; newCastling.wQ = false }
    else { newCastling.bK = false; newCastling.bQ = false }
  }
  if (type === 'R') {
    if (color === 'white') {
      if (fr === 7 && fc === 0) newCastling.wQ = false
      if (fr === 7 && fc === 7) newCastling.wK = false
    } else {
      if (fr === 0 && fc === 0) newCastling.bQ = false
      if (fr === 0 && fc === 7) newCastling.bK = false
    }
  }
  // If a rook was captured on its starting square, revoke that side's castling
  if (captured !== null && captured[1] === 'R') {
    if (tr === 7 && tc === 0) newCastling.wQ = false
    if (tr === 7 && tc === 7) newCastling.wK = false
    if (tr === 0 && tc === 0) newCastling.bQ = false
    if (tr === 0 && tc === 7) newCastling.bK = false
  }

  // En passant target square
  let newEnPassant: Pos | null = null
  if (type === 'P' && Math.abs(tr - fr) === 2) {
    newEnPassant = [(fr + tr) / 2, fc]
  }

  // Halfmove clock (reset on pawn move or capture)
  const newHalfmove =
    type === 'P' || captured !== null ? 0 : state.halfmove + 1

  // Fullmove counter increments after black's move
  const newFullmove = color === 'black' ? state.fullmove + 1 : state.fullmove

  const nextTurn = opponent(color)

  const newState: ChessState = {
    board: newBoard,
    turn: nextTurn,
    castling: newCastling,
    enPassant: newEnPassant,
    halfmove: newHalfmove,
    fullmove: newFullmove,
  }

  // Check detection
  const isCheck = isInCheck(newBoard, nextTurn)

  // Checkmate / stalemate: does the next player have any legal moves?
  let hasLegalMoves = false
  outer: for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = newBoard[r][c]
      if (!p || pieceColor(p) !== nextTurn) continue
      if (getValidMoves(newState, [r, c]).length > 0) {
        hasLegalMoves = true
        break outer
      }
    }
  }

  const isCheckmate = isCheck && !hasLegalMoves
  const isStalemate = !isCheck && !hasLegalMoves
  const isDraw = newHalfmove >= 100 // 50-move rule (100 half-moves)

  const promotion = promotedTo !== null

  // Build algebraic notation (needs the original state for disambiguation)
  const algebraic = buildAlgebraic(
    state,
    from,
    to,
    piece,
    captured,
    rawInfo.wasCastle,
    rawInfo.castleSide,
    promotedTo,
    isCheck,
    isCheckmate,
  )

  return {
    state: newState,
    captured,
    promotion,
    isCheck,
    isCheckmate,
    isStalemate,
    isDraw,
    algebraic,
  }
}
