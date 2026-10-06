// Pure-functions FallingBlocks game logic for multiplayer battle FallingBlocks.
// No React. All functions are pure (return new state, do not mutate inputs).
//
// Guideline ruleset:
//   - 10×20 board, 7-bag randomizer, 5-piece preview
//   - Hold piece (once per piece, Shift/C)
//   - SRS wall kicks on rotation
//   - Scoring (all × level): single 100, double 300, triple 500, four 800;
//     T-spin 400 / 800 / 1200 / 1600 for 0–3 lines, mini T-spin 100 / 200 /
//     400; back-to-back ×1.5 on a four or a T-spin clear that follows one;
//     combo +50 × (consecutive clears − 1); perfect clear 800 / 1200 / 1800 /
//     2000 (3200 back-to-back); soft drop +1/cell, hard drop +2/cell
//   - Level rises every 10 lines; gravity follows the guideline curve

export type Cell = string | null
export type Board = Cell[][]
export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'

export interface Piece {
  type: PieceType
  rotation: 0 | 1 | 2 | 3
  row: number // top-left of bounding box
  col: number
}

export type SpinKind = 'none' | 'mini' | 'full'

/** What the last scoring placement was — for the callout over the board. */
export interface ClearAction {
  spin: SpinKind
  lines: number // 0–4 (0 only for a T-spin that cleared nothing)
  b2b: boolean // the back-to-back bonus was paid
  perfect: boolean // the clear left the board empty
  combo: number // consecutive clears before this one (0 = no combo bonus)
}

export interface FallingBlocksState {
  board: Board // 20×10
  current: Piece | null // null between piece-lock and next-spawn (briefly)
  next: PieceType[] // upcoming pieces (at least 5 visible)
  bag: PieceType[] // remaining in current 7-bag (internal)
  hold: PieceType | null // held piece (tetr.io-style swap)
  holdUsed: boolean // true once hold was used for the current piece
  combo: number // consecutive line-clearing placements (0 = none)
  b2b: boolean // last clear was a four or a T-spin (back-to-back armed)
  lastKick: number | null // kick used by the last move if it was a rotation, else null
  action: ClearAction | null // the last scoring placement
  actionSeq: number // bumps with every scoring placement
  score: number
  lines: number
  topOut: boolean // true if game over
  garbagePending: number // incoming garbage to apply on next spawn
  lockTimer: number | null // ms remaining before piece locks; null when not on ground
}

export interface LockResult {
  state: FallingBlocksState
  linesCleared: number // 0–4
  garbageToSend: number // guideline attack: lines, T-spin, back-to-back, combo, perfect clear
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

// Guideline score tables, indexed by lines cleared. Everything × level.
const LINE_SCORES = [0, 100, 300, 500, 800]
const TSPIN_SCORES = [400, 800, 1200, 1600]
const MINI_TSPIN_SCORES = [100, 200, 400]
const COMBO_SCORE = 50
const B2B_MULT = 1.5
const PERFECT_CLEAR_SCORES = [0, 800, 1200, 1800, 2000]
const PERFECT_CLEAR_B2B_FOUR = 3200

// Guideline attack tables (garbage lines sent in a battle).
const LINE_ATTACK = [0, 0, 1, 2, 4]
const TSPIN_ATTACK = [0, 2, 4, 6]
const MINI_TSPIN_ATTACK = [0, 0, 1]
const COMBO_ATTACK = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5] // by combo count
const PERFECT_CLEAR_ATTACK = 10

// SRS wall-kick offsets. Tables are in guideline (x, y) coordinates with +y
// pointing UP — converted to (col, row) at test time (row = -y).
type KickTable = Record<string, readonly (readonly [number, number])[]>

const KICKS_JLSTZ: KickTable = {
  '0>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '1>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '1>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '2>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '2>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '3>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '3>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '0>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
}

const KICKS_I: KickTable = {
  '0>1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '1>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '1>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  '2>1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '3>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '3>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '0>3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
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
  // All pieces use a 4×4 bounding box. col=3 centres them on a 10-wide
  // board: 3-wide pieces span cols 3-5, the I piece spans cols 3-6.
  return { type, rotation: 0, row: 0, col: 3 }
}

function isOnGround(board: Board, piece: Piece): boolean {
  const moved: Piece = { ...piece, row: piece.row + 1 }
  return !isValidPosition(board, moved)
}

function applyLockTimer(state: FallingBlocksState): FallingBlocksState {
  if (!state.current) return { ...state, lockTimer: null }
  if (isOnGround(state.board, state.current)) {
    return { ...state, lockTimer: LOCK_DELAY_MS }
  }
  return { ...state, lockTimer: null }
}

/** Guideline T-spin test (three corners). The T's last move must have been
 *  a rotation and three of the four cells diagonal to its centre must be
 *  taken (walls and floor count). Both corners on the pointing side taken →
 *  a full T-spin; only one → a mini, unless the rotation used the last,
 *  two-down kick, which always counts as full. */
function detectTSpin(board: Board, piece: Piece, lastKick: number | null): SpinKind {
  if (piece.type !== 'T' || lastKick === null) return 'none'
  const taken = (r: number, c: number) =>
    c < 0 || c >= BOARD_COLS || r >= BOARD_ROWS || (r >= 0 && board[r][c] !== null)
  const tl = taken(piece.row, piece.col)
  const tr = taken(piece.row, piece.col + 2)
  const bl = taken(piece.row + 2, piece.col)
  const br = taken(piece.row + 2, piece.col + 2)
  // Rotation 0 points up, then clockwise: right, down, left.
  const front = [[tl, tr], [tr, br], [bl, br], [tl, bl]][piece.rotation]
  const back = [[bl, br], [tl, bl], [tl, tr], [tr, br]][piece.rotation]
  const frontCount = front.filter(Boolean).length
  if (frontCount + back.filter(Boolean).length < 3) return 'none'
  if (frontCount === 2 || lastKick === 4) return 'full'
  return 'mini'
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

/** Level rises every 10 cleared lines. Level 1 at the start. */
export function levelForLines(lines: number): number {
  return 1 + Math.floor(lines / 10)
}

/** Guideline gravity curve: (0.8 − (L−1)·0.007)^(L−1) seconds per row.
 *  L1 = 1000ms, L5 ≈ 718ms, L10 ≈ 387ms, L15 ≈ 180ms — a slow, steady
 *  creep at first that compounds, like classic marathon Tetris. */
export function gravityMsForLevel(level: number): number {
  const l = Math.max(1, level)
  const seconds = Math.pow(0.8 - (l - 1) * 0.007, l - 1)
  return Math.max(60, Math.round(seconds * 1000))
}

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

export function getGhostPiece(state: FallingBlocksState): Piece | null {
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

export function spawnPiece(state: FallingBlocksState): FallingBlocksState {
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

  const spawned: FallingBlocksState = {
    ...state,
    board,
    current: piece,
    next: queue,
    bag,
    holdUsed: false,
    lastKick: null,
    garbagePending: 0,
    topOut: false,
    lockTimer: null,
  }
  return applyLockTimer(spawned)
}

export function initialFallingBlocksState(): FallingBlocksState {
  const base: FallingBlocksState = {
    board: emptyBoard(),
    current: null,
    next: [],
    bag: freshBag(),
    hold: null,
    holdUsed: false,
    combo: 0,
    b2b: false,
    lastKick: null,
    action: null,
    actionSeq: 0,
    score: 0,
    lines: 0,
    topOut: false,
    garbagePending: 0,
    lockTimer: null,
  }
  return spawnPiece(base)
}

export function tryMove(state: FallingBlocksState, dx: number, dy: number): FallingBlocksState {
  if (!state.current || state.topOut) return state
  const candidate: Piece = {
    ...state.current,
    col: state.current.col + dx,
    row: state.current.row + dy,
  }
  if (!isValidPosition(state.board, candidate)) return state
  return applyLockTimer({ ...state, current: candidate, lastKick: null })
}

export function tryRotate(state: FallingBlocksState, dir: 1 | -1): FallingBlocksState {
  if (!state.current || state.topOut) return state
  if (state.current.type === 'O') return state // O never changes shape
  const from = state.current.rotation
  const to = ((((from + dir) % 4) + 4) % 4) as 0 | 1 | 2 | 3
  const table = state.current.type === 'I' ? KICKS_I : KICKS_JLSTZ
  const kicks = table[`${from}>${to}`] ?? [[0, 0] as const]
  for (let i = 0; i < kicks.length; i++) {
    const [kx, ky] = kicks[i]
    const candidate: Piece = {
      ...state.current,
      rotation: to,
      col: state.current.col + kx,
      row: state.current.row - ky, // kick tables use +y = up
    }
    if (isValidPosition(state.board, candidate)) {
      return applyLockTimer({ ...state, current: candidate, lastKick: i })
    }
  }
  return state
}

/** tetr.io-style hold: stash the current piece and continue with the held
 *  one (or the next from the queue on first use). Once per piece — the
 *  flag resets when the next piece spawns after a lock. */
export function holdSwap(state: FallingBlocksState): FallingBlocksState {
  if (!state.current || state.topOut || state.holdUsed) return state
  const stashed = state.current.type
  if (state.hold) {
    const piece = makePiece(state.hold)
    if (!isValidPosition(state.board, piece)) return state
    return applyLockTimer({
      ...state,
      current: piece,
      hold: stashed,
      holdUsed: true,
      lastKick: null,
    })
  }
  const { piece: nextType, bag, queue } = drawPiece(state.bag, state.next)
  const piece = makePiece(nextType)
  if (!isValidPosition(state.board, piece)) return state
  return applyLockTimer({
    ...state,
    current: piece,
    next: queue,
    bag,
    hold: stashed,
    holdUsed: true,
    lastKick: null,
  })
}

export function lockPiece(state: FallingBlocksState): LockResult {
  if (!state.current) {
    return { state, linesCleared: 0, garbageToSend: 0 }
  }
  const spin = detectTSpin(state.board, state.current, state.lastKick)
  const cells = pieceCells(state.current)
  const written = cellsToBoard(cells, state.current.type, state.board)
  const { board: cleared, cleared: linesCleared } = clearLines(written)

  // The level the clear was made at pays for it (guideline).
  const level = levelForLines(state.lines)
  // Combo counts consecutive line-clearing placements; the first one pays
  // nothing extra, and a placement that clears nothing ends the run.
  const combo = linesCleared > 0 ? state.combo + 1 : 0
  const comboCount = Math.max(0, combo - 1)
  // Back-to-back: a four or a T-spin clear straight after another one. A
  // plain single, double or triple breaks the chain; no clear leaves it.
  const difficult = linesCleared === 4 || (spin !== 'none' && linesCleared > 0)
  const b2bPaid = difficult && state.b2b
  const b2b = linesCleared === 0 ? state.b2b : difficult
  const perfect = linesCleared > 0 && cleared.every((row) => row.every((cell) => cell === null))

  const table =
    spin === 'full' ? TSPIN_SCORES : spin === 'mini' ? MINI_TSPIN_SCORES : LINE_SCORES
  const base = (table[linesCleared] ?? TSPIN_SCORES[linesCleared] ?? 0) * level
  let gained = Math.round(base * (b2bPaid ? B2B_MULT : 1))
  gained += COMBO_SCORE * comboCount * level
  if (perfect) {
    gained +=
      (linesCleared === 4 && b2bPaid ? PERFECT_CLEAR_B2B_FOUR : PERFECT_CLEAR_SCORES[linesCleared]) *
      level
  }

  let garbageToSend = 0
  if (linesCleared > 0) {
    const attack =
      spin === 'full' ? TSPIN_ATTACK : spin === 'mini' ? MINI_TSPIN_ATTACK : LINE_ATTACK
    garbageToSend =
      (attack[linesCleared] ?? TSPIN_ATTACK[linesCleared] ?? 0) +
      (b2bPaid ? 1 : 0) +
      COMBO_ATTACK[Math.min(comboCount, COMBO_ATTACK.length - 1)] +
      (perfect ? PERFECT_CLEAR_ATTACK : 0)
  }

  const scored = linesCleared > 0 || spin !== 'none'
  const next: FallingBlocksState = {
    ...state,
    board: cleared,
    current: null,
    combo,
    b2b,
    lastKick: null,
    action: scored
      ? { spin, lines: linesCleared, b2b: b2bPaid, perfect, combo: comboCount }
      : state.action,
    actionSeq: scored ? state.actionSeq + 1 : state.actionSeq,
    score: state.score + gained,
    lines: state.lines + linesCleared,
    lockTimer: null,
  }
  return { state: next, linesCleared, garbageToSend }
}

export function hardDrop(state: FallingBlocksState): LockResult {
  if (!state.current || state.topOut) {
    return { state, linesCleared: 0, garbageToSend: 0 }
  }
  let piece = state.current
  let distance = 0
  while (true) {
    const candidate: Piece = { ...piece, row: piece.row + 1 }
    if (!isValidPosition(state.board, candidate)) break
    piece = candidate
    distance++
  }
  // Hard drop scores +2 per cell travelled (guideline). A piece that fell
  // any distance did not finish on a rotation, so it is no T-spin.
  const dropped: FallingBlocksState = {
    ...state,
    current: piece,
    lastKick: distance > 0 ? null : state.lastKick,
    score: state.score + distance * 2,
  }
  return lockPiece(dropped)
}

export function softDropTick(
  state: FallingBlocksState,
  gravityMs: number
): FallingBlocksState {
  if (!state.current || state.topOut) return state

  const candidate: Piece = { ...state.current, row: state.current.row + 1 }
  if (isValidPosition(state.board, candidate)) {
    // Piece can keep falling; clear any pending lock timer.
    return { ...state, current: candidate, lastKick: null, lockTimer: null }
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
