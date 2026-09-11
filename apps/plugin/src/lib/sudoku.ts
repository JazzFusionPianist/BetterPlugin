/**
 * Sudoku — generator (unique solution, difficulty by clue count),
 * checker and scoring. Cells are 0..80, values 0 (empty) or 1..9.
 */

export type SudokuDifficulty = 'easy' | 'medium' | 'hard'
export const SUDOKU_DIFFICULTIES: SudokuDifficulty[] = ['easy', 'medium', 'hard']

/** Target number of givens per difficulty. */
const CLUES: Record<SudokuDifficulty, number> = { easy: 40, medium: 32, hard: 26 }

export interface SudokuPuzzle {
  givens: number[]     // 81 values, 0 = empty
  solution: number[]   // 81 values
  difficulty: SudokuDifficulty
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function boxOf(i: number): number {
  return Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3)
}

/** Can `v` go at index `i` given the grid? */
export function fits(grid: number[], i: number, v: number): boolean {
  const r = Math.floor(i / 9), c = i % 9
  for (let k = 0; k < 9; k++) {
    if (grid[r * 9 + k] === v) return false
    if (grid[k * 9 + c] === v) return false
  }
  const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3
  for (let rr = br; rr < br + 3; rr++) for (let cc = bc; cc < bc + 3; cc++) if (grid[rr * 9 + cc] === v) return false
  return true
}

/** Fill an empty grid with a random complete solution (backtracking). */
function fillGrid(grid: number[], i = 0): boolean {
  if (i === 81) return true
  if (grid[i] !== 0) return fillGrid(grid, i + 1)
  for (const v of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
    if (fits(grid, i, v)) {
      grid[i] = v
      if (fillGrid(grid, i + 1)) return true
      grid[i] = 0
    }
  }
  return false
}

/** Count solutions, stopping at `limit`. */
function countSolutions(grid: number[], limit = 2): number {
  let count = 0
  const rec = (): boolean => {
    let i = grid.indexOf(0)
    if (i === -1) { count++; return count >= limit }
    // most-constrained-cell heuristic keeps this fast on hard boards
    let bestI = -1, bestN = 10
    for (i = 0; i < 81; i++) {
      if (grid[i] !== 0) continue
      let n = 0
      for (let v = 1; v <= 9; v++) if (fits(grid, i, v)) n++
      if (n < bestN) { bestN = n; bestI = i; if (n <= 1) break }
    }
    if (bestN === 0) return false
    for (let v = 1; v <= 9; v++) {
      if (!fits(grid, bestI, v)) continue
      grid[bestI] = v
      const stop = rec()
      grid[bestI] = 0
      if (stop) return true
    }
    return false
  }
  rec()
  return count
}

export function generateSudoku(difficulty: SudokuDifficulty): SudokuPuzzle {
  const solution = Array<number>(81).fill(0)
  fillGrid(solution)
  const givens = solution.slice()
  const target = CLUES[difficulty]
  let clues = 81
  // Remove symmetric pairs first (nicer boards), then singles.
  const order = shuffle(Array.from({ length: 81 }, (_, i) => i))
  for (const i of order) {
    if (clues <= target) break
    if (givens[i] === 0) continue
    const j = 80 - i
    const backupI = givens[i], backupJ = givens[j]
    givens[i] = 0
    if (j !== i) givens[j] = 0
    if (countSolutions(givens.slice()) === 1) {
      clues -= j !== i ? 2 : 1
    } else {
      givens[i] = backupI
      if (j !== i) givens[j] = backupJ
      // try the single cell alone
      givens[i] = 0
      if (countSolutions(givens.slice()) === 1) clues -= 1
      else givens[i] = backupI
    }
  }
  return { givens, solution, difficulty }
}

/** Points: harder boards and faster solves score more; each mistake
 *  costs a little. Never below 100 for a finished board. */
export function sudokuScore(difficulty: SudokuDifficulty, seconds: number, mistakes: number): number {
  const mult = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3
  const base = Math.max(100, 3600 - seconds)
  return Math.max(100, Math.round(mult * base - mistakes * 50))
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60), s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
