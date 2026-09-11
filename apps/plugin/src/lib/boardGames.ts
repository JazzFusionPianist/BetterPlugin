/**
 * Grid board games — connect4 / gomoku / reversi — pure rules + a
 * built-in opponent. Cells hold a SEAT ('h' host / 'g' guest / null), so
 * one board shape serves all three games and the room table stays
 * colour-agnostic (the view decides which seat draws which stone).
 *
 * Moves are [row, col]. For connect4 the column is what matters — the
 * caller passes any row and resolveMove() returns the landing square.
 */
import type { BoardGameType } from '../types/collab'

export type Seat = 'h' | 'g'
export type Cell = Seat | null
export type Board = Cell[][]
export type Move = [number, number]

export const BOARD_DIMS: Record<BoardGameType, { rows: number; cols: number }> = {
  connect4: { rows: 6, cols: 7 },
  gomoku:   { rows: 15, cols: 15 },
  reversi:  { rows: 8, cols: 8 },
}

export function other(seat: Seat): Seat { return seat === 'h' ? 'g' : 'h' }

/** Fresh board. Reversi seeds the centre — `first` (the seat that moves
 *  first, i.e. black) takes the d5/e4 diagonal. */
export function createBoard(game: BoardGameType, first: Seat = 'h'): Board {
  const { rows, cols } = BOARD_DIMS[game]
  const b: Board = Array.from({ length: rows }, () => Array<Cell>(cols).fill(null))
  if (game === 'reversi') {
    const second = other(first)
    b[3][3] = second; b[4][4] = second
    b[3][4] = first;  b[4][3] = first
  }
  return b
}

export function cloneBoard(b: Board): Board { return b.map(r => r.slice()) }

export function counts(b: Board): { h: number; g: number; empty: number } {
  let h = 0, g = 0, empty = 0
  for (const row of b) for (const c of row) { if (c === 'h') h++; else if (c === 'g') g++; else empty++ }
  return { h, g, empty }
}

const DIRS8: Move[] = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]
const LINES4: Move[] = [[0, 1], [1, 0], [1, 1], [1, -1]]

function inBounds(b: Board, r: number, c: number): boolean {
  return r >= 0 && c >= 0 && r < b.length && c < b[0].length
}

// ── reversi flips ────────────────────────────────────────────────────────────
function reversiFlips(b: Board, seat: Seat, r: number, c: number): Move[] {
  if (b[r][c] !== null) return []
  const opp = other(seat)
  const flips: Move[] = []
  for (const [dr, dc] of DIRS8) {
    const run: Move[] = []
    let rr = r + dr, cc = c + dc
    while (inBounds(b, rr, cc) && b[rr][cc] === opp) { run.push([rr, cc]); rr += dr; cc += dc }
    if (run.length > 0 && inBounds(b, rr, cc) && b[rr][cc] === seat) flips.push(...run)
  }
  return flips
}

/** Every legal move for `seat`. */
export function legalMoves(game: BoardGameType, b: Board, seat: Seat): Move[] {
  const out: Move[] = []
  if (game === 'connect4') {
    for (let c = 0; c < b[0].length; c++) {
      const r = dropRow(b, c)
      if (r >= 0) out.push([r, c])
    }
    return out
  }
  for (let r = 0; r < b.length; r++) {
    for (let c = 0; c < b[0].length; c++) {
      if (b[r][c] !== null) continue
      if (game === 'reversi') { if (reversiFlips(b, seat, r, c).length > 0) out.push([r, c]) }
      else out.push([r, c])
    }
  }
  return out
}

function dropRow(b: Board, c: number): number {
  for (let r = b.length - 1; r >= 0; r--) if (b[r][c] === null) return r
  return -1
}

/** Where the move actually lands (connect4 gravity), or null if illegal. */
export function resolveMove(game: BoardGameType, b: Board, seat: Seat, r: number, c: number): Move | null {
  if (!inBounds(b, r, c)) return null
  if (game === 'connect4') {
    const rr = dropRow(b, c)
    return rr >= 0 ? [rr, c] : null
  }
  if (b[r][c] !== null) return null
  if (game === 'reversi' && reversiFlips(b, seat, r, c).length === 0) return null
  return [r, c]
}

/** Apply a resolved move; returns the new board (input untouched). */
export function applyMove(game: BoardGameType, b: Board, seat: Seat, [r, c]: Move): Board {
  const nb = cloneBoard(b)
  nb[r][c] = seat
  if (game === 'reversi') for (const [fr, fc] of reversiFlips(b, seat, r, c)) nb[fr][fc] = seat
  return nb
}

/** Longest run through (r,c) along any of the four lines. */
function longestLine(b: Board, r: number, c: number): number {
  const seat = b[r][c]
  if (!seat) return 0
  let best = 0
  for (const [dr, dc] of LINES4) {
    let n = 1
    for (const s of [1, -1]) {
      let rr = r + dr * s, cc = c + dc * s
      while (inBounds(b, rr, cc) && b[rr][cc] === seat) { n++; rr += dr * s; cc += dc * s }
    }
    best = Math.max(best, n)
  }
  return best
}

export interface Outcome { over: boolean; winner: Seat | null }

/** Game state after `mover` played `last`. */
export function outcome(game: BoardGameType, b: Board, mover: Seat, last: Move | null): Outcome {
  if (game === 'reversi') {
    if (legalMoves(game, b, 'h').length === 0 && legalMoves(game, b, 'g').length === 0) {
      const { h, g } = counts(b)
      return { over: true, winner: h === g ? null : h > g ? 'h' : 'g' }
    }
    return { over: false, winner: null }
  }
  const need = game === 'connect4' ? 4 : 5
  if (last && longestLine(b, last[0], last[1]) >= need) return { over: true, winner: mover }
  if (counts(b).empty === 0) return { over: true, winner: null }
  return { over: false, winner: null }
}

/** Who moves next after `mover` played (reversi passes when the
 *  opponent has no move). */
export function nextSeat(game: BoardGameType, b: Board, mover: Seat): Seat {
  const opp = other(mover)
  if (game !== 'reversi') return opp
  if (legalMoves(game, b, opp).length > 0) return opp
  return mover
}

// ── built-in opponent ────────────────────────────────────────────────────────

/** connect4 — alpha-beta over window scores, depth 5. */
function c4Score(b: Board, me: Seat): number {
  const opp = other(me)
  let score = 0
  const rows = b.length, cols = b[0].length
  // centre preference
  const centre = Math.floor(cols / 2)
  for (let r = 0; r < rows; r++) if (b[r][centre] === me) score += 3
  const win = (cells: Cell[]) => {
    const mine = cells.filter(x => x === me).length
    const theirs = cells.filter(x => x === opp).length
    const empty = cells.filter(x => x === null).length
    if (mine === 4) return 100000
    if (mine === 3 && empty === 1) return 50
    if (mine === 2 && empty === 2) return 8
    if (theirs === 3 && empty === 1) return -60
    if (theirs === 4) return -100000
    return 0
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      for (const [dr, dc] of LINES4) {
        const er = r + dr * 3, ec = c + dc * 3
        if (!inBounds(b, er, ec)) continue
        score += win([b[r][c], b[r + dr][c + dc], b[r + dr * 2][c + dc * 2], b[er][ec]])
      }
    }
  }
  return score
}

function c4Search(b: Board, me: Seat, turn: Seat, depth: number, alpha: number, beta: number, last: Move | null): number {
  const prev = other(turn)
  const out = outcome('connect4', b, prev, last)
  if (out.over) return out.winner === null ? 0 : out.winner === me ? 1_000_000 + depth : -1_000_000 - depth
  if (depth === 0) return c4Score(b, me)
  const moves = legalMoves('connect4', b, turn)
  const centre = Math.floor(b[0].length / 2)
  moves.sort((a, z) => Math.abs(a[1] - centre) - Math.abs(z[1] - centre))
  if (turn === me) {
    let best = -Infinity
    for (const m of moves) {
      best = Math.max(best, c4Search(applyMove('connect4', b, turn, m), me, other(turn), depth - 1, alpha, beta, m))
      alpha = Math.max(alpha, best)
      if (alpha >= beta) break
    }
    return best
  }
  let best = Infinity
  for (const m of moves) {
    best = Math.min(best, c4Search(applyMove('connect4', b, turn, m), me, other(turn), depth - 1, alpha, beta, m))
    beta = Math.min(beta, best)
    if (alpha >= beta) break
  }
  return best
}

function c4Ai(b: Board, me: Seat): Move | null {
  const moves = legalMoves('connect4', b, me)
  if (moves.length === 0) return null
  let best: Move = moves[0], bestScore = -Infinity
  const shuffled = [...moves].sort(() => Math.random() - 0.5)
  for (const m of shuffled) {
    const s = c4Search(applyMove('connect4', b, me, m), me, other(me), 4, -Infinity, Infinity, m)
    if (s > bestScore) { bestScore = s; best = m }
  }
  return best
}

/** gomoku — pattern scoring of every candidate square near a stone;
 *  attack and defence are both counted so it blocks open threes/fours. */
function gomokuLineValue(b: Board, r: number, c: number, seat: Seat): number {
  let total = 0
  for (const [dr, dc] of LINES4) {
    let n = 1, open = 0
    for (const s of [1, -1]) {
      let rr = r + dr * s, cc = c + dc * s
      while (inBounds(b, rr, cc) && b[rr][cc] === seat) { n++; rr += dr * s; cc += dc * s }
      if (inBounds(b, rr, cc) && b[rr][cc] === null) open++
    }
    if (n >= 5) total += 1_000_000
    else if (n === 4) total += open === 2 ? 50_000 : open === 1 ? 4_000 : 0
    else if (n === 3) total += open === 2 ? 3_000 : open === 1 ? 300 : 0
    else if (n === 2) total += open === 2 ? 120 : open === 1 ? 20 : 0
    else total += open === 2 ? 5 : 0
  }
  return total
}

function gomokuAi(b: Board, me: Seat): Move | null {
  const rows = b.length, cols = b[0].length
  const opp = other(me)
  let any = false
  const cand = new Set<number>()
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (b[r][c] === null) continue
    any = true
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      const rr = r + dr, cc = c + dc
      if (inBounds(b, rr, cc) && b[rr][cc] === null) cand.add(rr * cols + cc)
    }
  }
  if (!any) return [Math.floor(rows / 2), Math.floor(cols / 2)]
  let best: Move | null = null, bestScore = -1
  for (const k of cand) {
    const r = Math.floor(k / cols), c = k % cols
    const s = gomokuLineValue(b, r, c, me) * 1.05 + gomokuLineValue(b, r, c, opp) + Math.random() * 3
    if (s > bestScore) { bestScore = s; best = [r, c] }
  }
  return best
}

/** reversi — alpha-beta depth 3 over a positional weight table + mobility. */
const RV_W = [
  [120, -20, 20,  5,  5, 20, -20, 120],
  [-20, -40, -5, -5, -5, -5, -40, -20],
  [ 20,  -5, 15,  3,  3, 15,  -5,  20],
  [  5,  -5,  3,  3,  3,  3,  -5,   5],
  [  5,  -5,  3,  3,  3,  3,  -5,   5],
  [ 20,  -5, 15,  3,  3, 15,  -5,  20],
  [-20, -40, -5, -5, -5, -5, -40, -20],
  [120, -20, 20,  5,  5, 20, -20, 120],
]
function rvScore(b: Board, me: Seat): number {
  const opp = other(me)
  let s = 0
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    if (b[r][c] === me) s += RV_W[r][c]
    else if (b[r][c] === opp) s -= RV_W[r][c]
  }
  s += 4 * (legalMoves('reversi', b, me).length - legalMoves('reversi', b, opp).length)
  const { empty } = counts(b)
  if (empty < 12) { const k = counts(b); s += 6 * ((me === 'h' ? k.h - k.g : k.g - k.h)) }
  return s
}
function rvSearch(b: Board, me: Seat, turn: Seat, depth: number, alpha: number, beta: number): number {
  const out = outcome('reversi', b, turn, null)
  if (out.over) return out.winner === null ? 0 : out.winner === me ? 1_000_000 : -1_000_000
  if (depth === 0) return rvScore(b, me)
  const moves = legalMoves('reversi', b, turn)
  if (moves.length === 0) return rvSearch(b, me, other(turn), depth - 1, alpha, beta)
  if (turn === me) {
    let best = -Infinity
    for (const m of moves) {
      best = Math.max(best, rvSearch(applyMove('reversi', b, turn, m), me, other(turn), depth - 1, alpha, beta))
      alpha = Math.max(alpha, best); if (alpha >= beta) break
    }
    return best
  }
  let best = Infinity
  for (const m of moves) {
    best = Math.min(best, rvSearch(applyMove('reversi', b, turn, m), me, other(turn), depth - 1, alpha, beta))
    beta = Math.min(beta, best); if (alpha >= beta) break
  }
  return best
}
function rvAi(b: Board, me: Seat): Move | null {
  const moves = legalMoves('reversi', b, me)
  if (moves.length === 0) return null
  let best: Move = moves[0], bestScore = -Infinity
  for (const m of [...moves].sort(() => Math.random() - 0.5)) {
    const s = rvSearch(applyMove('reversi', b, me, m), me, other(me), 3, -Infinity, Infinity)
    if (s > bestScore) { bestScore = s; best = m }
  }
  return best
}

export function aiMove(game: BoardGameType, b: Board, me: Seat): Move | null {
  if (game === 'connect4') return c4Ai(b, me)
  if (game === 'gomoku') return gomokuAi(b, me)
  return rvAi(b, me)
}
