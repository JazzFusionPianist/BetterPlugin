// Orb Party — a Mario-Party-flavoured dice board. Pure data + rules,
// no React.
//
// The board is a hand-drawn graph on a 340×500 sheet: a winding outer
// loop, an inner cut that skips the top (and its star), and a risky
// mid-board shortcut. Land on tiles to earn/lose coins, draw events,
// pick up items and duel; pass the star spot with 20 coins to buy a
// star (it relocates afterwards). Most stars after 12 rounds wins,
// coins break ties.

export const PARTY_W = 340
export const PARTY_H = 500
export const PARTY_ROUNDS = 12
export const STAR_COST = 20
export const START_COINS = 10
export const PASS_START_PAY = 5

export type TileType = 'start' | 'blue' | 'red' | 'event' | 'item' | 'duel'

export interface PartyNode {
  x: number
  y: number
  t: TileType
  next: number[]
}

/** Node 0 is the start. Junctions are simply nodes with two exits. */
export const PARTY_BOARD: PartyNode[] = [
  { x: 52,  y: 462, t: 'start', next: [1] },    // 0
  { x: 36,  y: 404, t: 'blue',  next: [2] },    // 1
  { x: 42,  y: 344, t: 'blue',  next: [3] },    // 2
  { x: 58,  y: 288, t: 'event', next: [4] },    // 3
  { x: 86,  y: 238, t: 'blue',  next: [5] },    // 4
  { x: 118, y: 192, t: 'blue',  next: [6, 23] },// 5 — junction: high road / inner cut
  { x: 108, y: 132, t: 'item',  next: [7] },    // 6
  { x: 138, y: 86,  t: 'blue',  next: [8] },    // 7
  { x: 188, y: 60,  t: 'red',   next: [9] },    // 8
  { x: 240, y: 54,  t: 'blue',  next: [10] },   // 9  — star candidate
  { x: 286, y: 74,  t: 'event', next: [11] },   // 10
  { x: 312, y: 120, t: 'blue',  next: [12] },   // 11
  { x: 320, y: 170, t: 'blue',  next: [13] },   // 12
  { x: 302, y: 222, t: 'blue',  next: [14, 26] },// 13 — junction: long way / shortcut
  { x: 318, y: 272, t: 'blue',  next: [15] },   // 14
  { x: 322, y: 322, t: 'item',  next: [16] },   // 15 — star candidate
  { x: 302, y: 370, t: 'red',   next: [17] },   // 16
  { x: 270, y: 408, t: 'event', next: [18] },   // 17
  { x: 230, y: 434, t: 'blue',  next: [19] },   // 18
  { x: 186, y: 450, t: 'blue',  next: [20] },   // 19 — shortcut rejoins here
  { x: 142, y: 454, t: 'duel',  next: [21] },   // 20
  { x: 102, y: 448, t: 'blue',  next: [22] },   // 21
  { x: 72,  y: 428, t: 'red',   next: [0] },    // 22
  { x: 162, y: 206, t: 'red',   next: [24] },   // 23 — inner cut
  { x: 204, y: 216, t: 'event', next: [25] },   // 24
  { x: 246, y: 212, t: 'blue',  next: [13] },   // 25 — star candidate
  { x: 256, y: 262, t: 'red',   next: [27] },   // 26 — shortcut
  { x: 216, y: 302, t: 'event', next: [28] },   // 27
  { x: 186, y: 352, t: 'red',   next: [19] },   // 28 — star candidate
]

export const STAR_NODES = [9, 15, 25, 28, 3]

export type PartyItem = 'double' | 'pick' | 'mirror'
export const ITEM_NAMES: Record<PartyItem, string> = {
  double: 'double dice',
  pick: 'loaded die',
  mirror: 'mirror',
}
export const MAX_ITEMS = 2

export type PartyEvent =
  | 'windfall' | 'tax' | 'warp' | 'starMoves' | 'gift' | 'storm' | 'swap'
export const PARTY_EVENTS: PartyEvent[] = [
  'windfall', 'tax', 'warp', 'starMoves', 'gift', 'storm', 'swap',
]

export type PartyPhase = 'idle' | 'junction' | 'buy' | 'end'

export interface PartyState {
  turn: number                       // index into player_ids
  round: number                      // 1..PARTY_ROUNDS
  phase: PartyPhase
  positions: Record<string, number>
  coins: Record<string, number>
  stars: Record<string, number>
  items: Record<string, PartyItem[]>
  starNode: number
  dice: number | null                // the number being walked off
  stepsLeft: number
  pendingNode: number | null         // junction node awaiting a choice
  /** Nodes traversed in the move being written — remote clients animate
   *  along this trail instead of teleporting. */
  trail: number[]
  /** Short serif ticker lines, newest last (kept to 4). */
  log: string[]
}

export function initialPartyState(ids: string[]): PartyState {
  const positions: Record<string, number> = {}
  const coins: Record<string, number> = {}
  const stars: Record<string, number> = {}
  const items: Record<string, PartyItem[]> = {}
  for (const id of ids) {
    positions[id] = 0
    coins[id] = START_COINS
    stars[id] = 0
    items[id] = []
  }
  return {
    turn: 0,
    round: 1,
    phase: 'idle',
    positions, coins, stars, items,
    starNode: STAR_NODES[0],
    dice: null,
    stepsLeft: 0,
    pendingNode: null,
    trail: [],
    log: [],
  }
}

export function pushLog(log: string[], line: string): string[] {
  return [...log.slice(-3), line]
}

export function randomItem(): PartyItem {
  const pool: PartyItem[] = ['double', 'pick', 'mirror']
  return pool[Math.floor(Math.random() * pool.length)]
}

export function randomEvent(): PartyEvent {
  return PARTY_EVENTS[Math.floor(Math.random() * PARTY_EVENTS.length)]
}

/** A fresh star spot, never the node it's on now. */
export function nextStarNode(current: number): number {
  const pool = STAR_NODES.filter(n => n !== current)
  return pool[Math.floor(Math.random() * pool.length)]
}

export function rollD6(): number {
  return 1 + Math.floor(Math.random() * 6)
}

/** Winner by stars, coins as the tiebreak; exact tie → null. */
export function partyWinner(st: PartyState, ids: string[]): string | null {
  let best: string | null = null
  let bs = -1, bc = -1
  let tied = false
  for (const id of ids) {
    const s = st.stars[id] ?? 0
    const c = st.coins[id] ?? 0
    if (s > bs || (s === bs && c > bc)) { best = id; bs = s; bc = c; tied = false }
    else if (s === bs && c === bc) tied = true
  }
  return tied ? null : best
}

// ── Bot decisions ──────────────────────────────────────────────────────────

/** Prefer the exit whose short lookahead passes the star; otherwise coin
 *  expectation; otherwise chance. */
export function botPickExit(node: number, starNode: number): number {
  const exits = PARTY_BOARD[node].next
  if (exits.length === 1) return exits[0]
  const scoreExit = (start: number): number => {
    let score = 0
    let cur = start
    for (let d = 0; d < 8; d++) {
      if (cur === starNode) score += 30
      const t = PARTY_BOARD[cur].t
      if (t === 'blue') score += 3
      if (t === 'red') score -= 3
      if (t === 'item') score += 4
      cur = PARTY_BOARD[cur].next[0]
    }
    return score + Math.random() * 6
  }
  let best = exits[0], bestScore = -Infinity
  for (const e of exits) {
    const s = scoreExit(e)
    if (s > bestScore) { bestScore = s; best = e }
  }
  return best
}
