import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { positionFen, legalTargets, checkedKing, boardPosition, squareName } from '../../packages/core/lib/chess3d.ts'

const require = createRequire(new URL('../../packages/core/package.json', import.meta.url))
const { Chess } = require('chess.js')
function position(fen) {
  const chess = new Chess(fen)
  const fields = chess.fen().split(' ')
  return {
    board: chess.board().map(row => row.map(piece => piece ? piece.color + piece.type.toUpperCase() : null)),
    turn: fields[1] === 'w' ? 'white' : 'black',
    castling: Object.fromEntries(['wK', 'wQ', 'bK', 'bQ'].map((key, i) => [key, fields[2].includes('KQkq'[i])])),
    enPassant: fields[3] === '-' ? null : boardPosition(fields[3]),
    halfmove: Number(fields[4]), fullmove: Number(fields[5]),
  }
}
const targets = (state, square, turn) => legalTargets(state, boardPosition(square), turn).map(squareName)

test('initial position and coordinates round-trip', () => {
  const fen = new Chess().fen()
  assert.equal(positionFen(position(fen)), fen)
  for (const square of ['a8', 'h8', 'a1', 'h1', 'e4']) assert.equal(squareName(boardPosition(square)), square)
  assert.deepEqual(targets(position(fen), 'e2').sort(), ['e3', 'e4'])
})
test('castling targets and pinned pieces use legal engine moves', () => {
  const castles = position('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1')
  assert(targets(castles, 'e1').includes('g1'))
  assert(targets(castles, 'e1').includes('c1'))
  const pinned = position('4r1k1/8/8/8/8/8/4R3/4K3 w - - 0 1')
  assert(!targets(pinned, 'e2').includes('d2'))
  assert(targets(pinned, 'e2').includes('e8'))
})
test('en passant and promotion expose one destination per square', () => {
  const ep = position('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1')
  assert(targets(ep, 'e5').includes('d6'))
  const promotion = position('4k3/P7/8/8/8/8/8/4K3 w - - 0 1')
  assert.deepEqual(targets(promotion, 'a7'), ['a8'])
})
test('check marking and black premove targets', () => {
  assert.deepEqual(checkedKing(position('4k3/8/8/8/8/8/4r3/4K3 w - - 0 1')), boardPosition('e1'))
  assert.equal(checkedKing(position(new Chess().fen())), null)
  assert.deepEqual(targets(position(new Chess().fen()), 'e7', 'black').sort(), ['e5', 'e6'])
})
