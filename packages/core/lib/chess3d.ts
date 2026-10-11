import { Chess, type Square } from 'chess.js'

export type BoardPosition = [number, number]
export interface ChessPosition {
  board: (string | null)[][]
  turn: 'white' | 'black'
  castling: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean }
  enPassant: BoardPosition | null
  halfmove: number
  fullmove: number
}

export function squareName([row, col]: BoardPosition): Square {
  return `${'abcdefgh'[col]}${8 - row}` as Square
}

export function boardPosition(square: string): BoardPosition {
  return [8 - Number(square[1]), 'abcdefgh'.indexOf(square[0])]
}

/** Both existing clients keep board arrays; chess.js supplies legal 3D targets. */
export function positionFen(state: ChessPosition, turn = state.turn): string {
  const ranks = state.board.map(row => {
    let rank = '', empty = 0
    for (const piece of row) {
      if (!piece) { empty++; continue }
      if (empty) { rank += empty; empty = 0 }
      rank += piece[0] === 'w' ? piece[1].toUpperCase() : piece[1].toLowerCase()
    }
    return rank + (empty || '')
  })
  const rights = (state.castling.wK ? 'K' : '') + (state.castling.wQ ? 'Q' : '')
    + (state.castling.bK ? 'k' : '') + (state.castling.bQ ? 'q' : '')
  const ep = turn === state.turn && state.enPassant ? squareName(state.enPassant) : '-'
  return `${ranks.join('/')} ${turn === 'white' ? 'w' : 'b'} ${rights || '-'} ${ep} ${state.halfmove} ${Math.max(1, state.fullmove)}`
}

export function legalTargets(state: ChessPosition, from: BoardPosition, turn = state.turn): BoardPosition[] {
  const chess = new Chess(positionFen(state, turn))
  return [...new Set(chess.moves({ square: squareName(from), verbose: true }).map(move => move.to))].map(boardPosition)
}

export function checkedKing(state: ChessPosition): BoardPosition | null {
  const chess = new Chess(positionFen(state))
  if (!chess.isCheck()) return null
  const king = (state.turn === 'white' ? 'w' : 'b') + 'K'
  for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
    if (state.board[row][col] === king) return [row, col]
  }
  return null
}
