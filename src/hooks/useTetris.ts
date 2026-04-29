// Pure-functions Tetris game logic for multiplayer battle Tetris.
// No React. All functions are pure (return new state, do not mutate inputs).

export type Cell = string | null
export type Board = Cell[][]
export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'

export interface Piece {
  type: PieceType
  rotation: 0 | 1 | 2 | 3
  row: number // top-left of bounding box
  col: number
}

export interface TetrisState {
  board: Board // 20×10
  current: Piece | null // null between piece-lock and next-spawn (briefly)
  next: PieceType[] // upcoming pieces (at least 5 visible)
  bag: PieceType[] // remaining in current 7-bag (internal)
  score: number
  lines: number
  topOut: boolean // true if game over
  garbagePending: number // incoming garbage to apply on next spawn
  lockTimer: number | null // ms remaining before piece locks; null when not on ground
}

export interface LockResult {
  state: TetrisState
  linesCleared: number // 0–4
  garbageToSend: number // = max(0, linesCleared - 1) for MVP
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const BOARD_ROWS = 20
export const BOARD_COLS = 10
export const LOCK_DELAY_MS = 500
const PREVIEW_SIZE = 5
const ALL_PIECES: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']

// Each piece described as a 4×4 matrix per rotation, with 1 = filled, 0 = empty.
// Rotation 0 is the spawn orientation. Rotations advance clockwise.
type Shape = readonly (readonly number[])[]
type ShapeSet = readonly [Shape, Shape, Shape, Shape]

const SHAPES: Record<PieceType, ShapeSet> = {
  I: [
    [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0],
    ],
    [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
    ],
  ],
  O: [
    [
      [0, 1, 1, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 1, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 1, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 1, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  ],
  T: [
    [
      [0, 1, 0, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 0, 0],
      [1, 1, 1, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [1, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
  ],
  S: [
    [
      [0, 1, 1, 0],
      [1, 1, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 0, 0],
      [0, 1, 1, 0],
      [1, 1, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [1, 0, 0, 0],
      [1, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
  ],
  Z: [
    [
      [1, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 1, 0],
      [0, 1, 1, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 0, 0],
      [1, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [1, 1, 0, 0],
      [1, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  ],
  J: [
    [
      [1, 0, 0, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 1, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 0, 0],
      [1, 1, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [1, 1, 0, 0],
      [0, 0, 0, 0],
    ],
  ],
  L: [
    [
      [0, 0, 1, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 0, 0],
      [1, 1, 1, 0],
      [1, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [1, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
  ],
}

const LINE_SCORES: Record<number, number> = {
  0: 0,
  1: 100,
  2: 300,
  3: 500,
  4: 800,
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function emptyBoard(): Board {
  const board: Board = []
  for (let r = 0; r < BOARD_ROWS; r++) {
    const row: Cell[] = []
    for (let c = 0; c < BOARD_COLS; c++) row.push(null)
    board.push(row)
  }
  return board
}

function cloneBoard(board: Board): Board {
  return board.map((row) => row.slice())
}

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

function freshBag(): PieceType[] {
  return shuffle(ALL_PIECES.slice())
}

// Pull one piece from the queue, refilling the bag and queue as needed.
function drawPiece(
  bag: PieceType[],
  queue: PieceType[]
): { piece: PieceType; bag: PieceType[]; queue: PieceType[] } {
  let nextBag = bag.slice()
  let nextQueue = queue.slice()

  // Make sure the queue has enough lookahead.
  while (nextQueue.length <= PREVIEW_SIZE) {
    if (nextBag.length === 0) nextBag = freshBag()
    nextQueue.push(nextBag.shift() as PieceType)
  }

  const piece = nextQueue.shift() as PieceType

  // Top up again so callers always see PREVIEW_SIZE upcoming pieces.
  while (nextQueue.length < PREVIEW_SIZE) {
    if (nextBag.length === 0) nextBag = freshBag()
    nextQueue.push(nextBag.shift() as PieceType)
  }

  return { piece, bag: nextBag, queue: nextQueue }
}

function makePiece(type: PieceType): Piece {
  // All pieces use a 4×4 bounding box. Using col=3 places the piece roughly
  // centered on a 10-wide board for both 3-wide pieces (occupying cols 3-5)
  // and the I piece (occupying cols 3-6 on rotation 0).
  return { type, rotation: 0, row: 0, col: 3 }
}

function isOnGround(board: Board, piece: Piece): boolean {
  const moved: Piece = { ...piece, row: piece.row + 1 }
  return !isValidPosition(board, moved)
}

function applyLockTimer(state: TetrisState): TetrisState {
  if (!state.current) return { ...state, lockTimer: null }
  if (isOnGround(state.board, state.current)) {
    return { ...state, lockTimer: LOCK_DELAY_MS }
  }
  return { ...state, lockTimer: null }
}

function clearLines(board: Board): { board: Board; cleared: number } {
  const surviving: Cell[][] = []
  let cleared = 0
  for (let r = 0; r < BOARD_ROWS; r++) {
    const row = board[r]
    const full = row.every((cell) => cell !== null)
    if (full) {
      cleared++
    } else {
      surviving.push(row.slice())
    }
  }
  const newBoard: Board = []
  for (let i = 0; i < cleared; i++) {
    const blank: Cell[] = []
    for (let c = 0; c < BOARD_COLS; c++) blank.push(null)
    newBoard.push(blank)
  }
  for (const row of surviving) newBoard.push(row)
  return { board: newBoard, cleared }
}

// ---------------------------------------------------------------------------
// Public utility functions
// ---------------------------------------------------------------------------

export function pieceCells(piece: Piece): [number, number][] {
  const shape = SHAPES[piece.type][piece.rotation]
  const cells: [number, number][] = []
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (shape[r][c]) cells.push([piece.row + r, piece.col + c])
    }
  }
  return cells
}

export function isValidPosition(board: Board, piece: Piece): boolean {
  const cells = pieceCells(piece)
  for (const [r, c] of cells) {
    if (c < 0 || c >= BOARD_COLS) return false
    if (r >= BOARD_ROWS) return false
    // Allow cells above the board (r < 0) so pieces can spawn partly
    // off-screen and rotate without false collisions.
    if (r < 0) continue
    if (board[r][c] !== null) return false
  }
  return true
}

export function cellsToBoard(
  cells: [number, number][],
  pieceType: PieceType,
  board: Board
): Board {
  const next = cloneBoard(board)
  for (const [r, c] of cells) {
    if (r < 0 || r >= BOARD_ROWS || c < 0 || c >= BOARD_COLS) continue
    next[r][c] = pieceType
  }
  return next
}

export function addGarbageLines(board: Board, n: number, holeCol: number): Board {
  if (n <= 0) return cloneBoard(board)
  const safeHole = ((holeCol % BOARD_COLS) + BOARD_COLS) % BOARD_COLS
  const next: Board = []
  // Drop the top n rows (they are pushed off the top of the board).
  for (let r = n; r < BOARD_ROWS; r++) next.push(board[r].slice())
  // Append n garbage rows at the bottom.
  for (let i = 0; i < n; i++) {
    const row: Cell[] = []
    for (let c = 0; c < BOARD_COLS; c++) {
      row.push(c === safeHole ? null : 'G')
    }
    next.push(row)
  }
  return next
}

export function getGhostPiece(state: TetrisState): Piece | null {
  if (!state.current) return null
  let ghost: Piece = { ...state.current }
  // Step down until the next position would be invalid.
  while (true) {
    const candidate: Piece = { ...ghost, row: ghost.row + 1 }
    if (!isValidPosition(state.board, candidate)) break
    ghost = candidate
  }
  return ghost
}

// ---------------------------------------------------------------------------
// Core state transitions
// ---------------------------------------------------------------------------

export function spawnPiece(state: TetrisState): TetrisState {
  // Apply any pending garbage before spawning.
  let board = state.board
  let topOut = state.topOut
  if (state.garbagePending > 0) {
    // If non-empty cells exist in the top `garbagePending` rows, those cells
    // would be pushed off the top — that is a top-out for the receiver.
    for (let r = 0; r < state.garbagePending; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        if (board[r][c] !== null) {
          topOut = true
          break
        }
      }
      if (topOut) break
    }
    const holeCol = Math.floor(Math.random() * BOARD_COLS)
    board = addGarbageLines(board, state.garbagePending, holeCol)
  }

  if (topOut) {
    return {
      ...state,
      board,
      current: null,
      garbagePending: 0,
      topOut: true,
      lockTimer: null,
    }
  }

  const { piece: nextType, bag, queue } = drawPiece(state.bag, state.next)
  const piece = makePiece(nextType)

  if (!isValidPosition(board, piece)) {
    return {
      ...state,
      board,
      current: null,
      next: queue,
      bag,
      garbagePending: 0,
      topOut: true,
      lockTimer: null,
    }
  }

  const spawned: TetrisState = {
    ...state,
    board,
    current: piece,
    next: queue,
    bag,
    garbagePending: 0,
    topOut: false,
    lockTimer: null,
  }
  return applyLockTimer(spawned)
}

export function initialTetrisState(): TetrisState {
  const base: TetrisState = {
    board: emptyBoard(),
    current: null,
    next: [],
    bag: freshBag(),
    score: 0,
    lines: 0,
    topOut: false,
    garbagePending: 0,
    lockTimer: null,
  }
  return spawnPiece(base)
}

export function tryMove(state: TetrisState, dx: number, dy: number): TetrisState {
  if (!state.current || state.topOut) return state
  const candidate: Piece = {
    ...state.current,
    col: state.current.col + dx,
    row: state.current.row + dy,
  }
  if (!isValidPosition(state.board, candidate)) return state
  return applyLockTimer({ ...state, current: candidate })
}

export function tryRotate(state: TetrisState, dir: 1 | -1): TetrisState {
  if (!state.current || state.topOut) return state
  const rot = (((state.current.rotation + dir) % 4) + 4) % 4
  const candidate: Piece = {
    ...state.current,
    rotation: rot as 0 | 1 | 2 | 3,
  }
  if (!isValidPosition(state.board, candidate)) return state
  return applyLockTimer({ ...state, current: candidate })
}

export function lockPiece(state: TetrisState): LockResult {
  if (!state.current) {
    return { state, linesCleared: 0, garbageToSend: 0 }
  }
  const cells = pieceCells(state.current)
  const written = cellsToBoard(cells, state.current.type, state.board)
  const { board: cleared, cleared: linesCleared } = clearLines(written)
  const score = state.score + (LINE_SCORES[linesCleared] ?? 0)
  const lines = state.lines + linesCleared
  const garbageToSend = Math.max(0, linesCleared - 1)
  const next: TetrisState = {
    ...state,
    board: cleared,
    current: null,
    score,
    lines,
    lockTimer: null,
  }
  return { state: next, linesCleared, garbageToSend }
}

export function hardDrop(state: TetrisState): LockResult {
  if (!state.current || state.topOut) {
    return { state, linesCleared: 0, garbageToSend: 0 }
  }
  let piece = state.current
  while (true) {
    const candidate: Piece = { ...piece, row: piece.row + 1 }
    if (!isValidPosition(state.board, candidate)) break
    piece = candidate
  }
  const dropped: TetrisState = { ...state, current: piece }
  return lockPiece(dropped)
}

export function softDropTick(
  state: TetrisState,
  gravityMs: number
): TetrisState {
  if (!state.current || state.topOut) return state

  const candidate: Piece = { ...state.current, row: state.current.row + 1 }
  if (isValidPosition(state.board, candidate)) {
    // Piece can keep falling; clear any pending lock timer.
    return { ...state, current: candidate, lockTimer: null }
  }

  // Piece is on the ground. Decrement (or start) the lock timer.
  const remaining =
    state.lockTimer == null ? LOCK_DELAY_MS - gravityMs : state.lockTimer - gravityMs

  if (remaining <= 0) {
    // Caller is expected to call lockPiece (and then spawnPiece) when they
    // notice lockTimer === 0. We expose the expired state by clamping to 0.
    return { ...state, lockTimer: 0 }
  }
  return { ...state, lockTimer: remaining }
}
