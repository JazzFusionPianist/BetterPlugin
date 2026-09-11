/**
 * Minesweeper — classic rules. Mines are placed on the FIRST reveal so
 * that click (and its 8 neighbours) is always safe. Chording: revealing
 * an open number whose flag count matches opens its hidden neighbours.
 */

export type MsDifficulty = 'easy' | 'medium' | 'hard'
export const MS_DIFFICULTIES: MsDifficulty[] = ['easy', 'medium', 'hard']
export const MS_PRESETS: Record<MsDifficulty, { rows: number; cols: number; mines: number }> = {
  easy:   { rows: 9,  cols: 9,  mines: 10 },
  medium: { rows: 16, cols: 16, mines: 40 },
  hard:   { rows: 16, cols: 30, mines: 99 },
}

export type MsState = 'hidden' | 'revealed' | 'flagged'
export interface MsCell { mine: boolean; adj: number; state: MsState; blown?: boolean }

export class MinesweeperGame {
  rows: number; cols: number; mines: number
  cells: MsCell[][] = []
  started = false
  over = false
  won = false
  revealed = 0
  flags = 0

  constructor(public difficulty: MsDifficulty) {
    const p = MS_PRESETS[difficulty]
    this.rows = p.rows; this.cols = p.cols; this.mines = p.mines
    this.reset()
  }

  reset(): void {
    this.cells = Array.from({ length: this.rows }, () =>
      Array.from({ length: this.cols }, () => ({ mine: false, adj: 0, state: 'hidden' as MsState })))
    this.started = false; this.over = false; this.won = false; this.revealed = 0; this.flags = 0
  }

  private inb(r: number, c: number): boolean { return r >= 0 && c >= 0 && r < this.rows && c < this.cols }

  private neighbours(r: number, c: number): [number, number][] {
    const out: [number, number][] = []
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue
      const rr = r + dr, cc = c + dc
      if (this.inb(rr, cc)) out.push([rr, cc])
    }
    return out
  }

  private place(safeR: number, safeC: number): void {
    const safe = new Set<number>([safeR * this.cols + safeC])
    for (const [r, c] of this.neighbours(safeR, safeC)) safe.add(r * this.cols + c)
    const pool: number[] = []
    for (let i = 0; i < this.rows * this.cols; i++) if (!safe.has(i)) pool.push(i)
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]] }
    for (const i of pool.slice(0, this.mines)) this.cells[Math.floor(i / this.cols)][i % this.cols].mine = true
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      this.cells[r][c].adj = this.neighbours(r, c).filter(([rr, cc]) => this.cells[rr][cc].mine).length
    }
    this.started = true
  }

  /** Reveal a cell. Returns true when the board changed. */
  reveal(r: number, c: number): boolean {
    if (this.over || !this.inb(r, c)) return false
    const cell = this.cells[r][c]
    if (cell.state === 'flagged') return false
    if (cell.state === 'revealed') return this.chord(r, c)
    if (!this.started) this.place(r, c)
    if (cell.mine) { this.blow(r, c); return true }
    this.flood(r, c)
    this.checkWin()
    return true
  }

  private flood(r: number, c: number): void {
    const stack: [number, number][] = [[r, c]]
    while (stack.length) {
      const [rr, cc] = stack.pop()!
      const cell = this.cells[rr][cc]
      if (cell.state !== 'hidden' || cell.mine) continue
      cell.state = 'revealed'
      this.revealed++
      if (cell.adj === 0) for (const n of this.neighbours(rr, cc)) if (this.cells[n[0]][n[1]].state === 'hidden') stack.push(n)
    }
  }

  private chord(r: number, c: number): boolean {
    const cell = this.cells[r][c]
    if (cell.adj === 0) return false
    const ns = this.neighbours(r, c)
    const flagged = ns.filter(([rr, cc]) => this.cells[rr][cc].state === 'flagged').length
    if (flagged !== cell.adj) return false
    let changed = false
    for (const [rr, cc] of ns) {
      const n = this.cells[rr][cc]
      if (n.state !== 'hidden') continue
      changed = true
      if (n.mine) { this.blow(rr, cc); return true }
      this.flood(rr, cc)
    }
    if (changed) this.checkWin()
    return changed
  }

  toggleFlag(r: number, c: number): boolean {
    if (this.over || !this.inb(r, c)) return false
    const cell = this.cells[r][c]
    if (cell.state === 'revealed') return false
    if (cell.state === 'flagged') { cell.state = 'hidden'; this.flags-- }
    else { cell.state = 'flagged'; this.flags++ }
    return true
  }

  private blow(r: number, c: number): void {
    this.over = true; this.won = false
    this.cells[r][c].blown = true
    for (const row of this.cells) for (const cell of row) if (cell.mine && cell.state !== 'flagged') cell.state = 'revealed'
  }

  private checkWin(): void {
    if (this.revealed === this.rows * this.cols - this.mines) {
      this.over = true; this.won = true
      for (const row of this.cells) for (const cell of row) if (cell.mine) cell.state = 'flagged'
      this.flags = this.mines
    }
  }
}

/** Points for a cleared board: harder × faster. */
export function minesweeperScore(difficulty: MsDifficulty, seconds: number): number {
  const mult = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 3 : 8
  return Math.max(100, Math.round(mult * Math.max(100, 1800 - seconds)))
}
