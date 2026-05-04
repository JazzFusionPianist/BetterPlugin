// Pure Texas Hold'em poker logic. No React, no I/O.
// Card representation: 2-character string "rank+suit", e.g. "AS", "TH".

export type Suit = 'S' | 'H' | 'D' | 'C'
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A'
export type Card = string

export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']
export const SUITS: Suit[] = ['S', 'H', 'D', 'C']

export interface HandEvaluation {
  rank: number
  rank_name: string
  best_cards: Card[]
  kickers: number[]
}

const HAND_NAMES: Record<number, string> = {
  1: 'High Card',
  2: 'Pair',
  3: 'Two Pair',
  4: 'Three of a Kind',
  5: 'Straight',
  6: 'Flush',
  7: 'Full House',
  8: 'Four of a Kind',
  9: 'Straight Flush',
  10: 'Royal Flush',
}

export function formatHandRank(rank: number): string {
  return HAND_NAMES[rank] ?? 'Unknown'
}

// ---------- Card primitives ----------

export function cardRank(card: Card): number {
  const r = card[0] as Rank
  switch (r) {
    case '2': return 2
    case '3': return 3
    case '4': return 4
    case '5': return 5
    case '6': return 6
    case '7': return 7
    case '8': return 8
    case '9': return 9
    case 'T': return 10
    case 'J': return 11
    case 'Q': return 12
    case 'K': return 13
    case 'A': return 14
  }
  throw new Error(`Invalid card rank: ${card}`)
}

export function cardSuit(card: Card): Suit {
  return card[1] as Suit
}

// ---------- Deck ----------

export function freshDeck(): Card[] {
  const deck: Card[] = []
  for (const r of RANKS) {
    for (const s of SUITS) {
      deck.push(`${r}${s}`)
    }
  }
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = deck[i]
    deck[i] = deck[j]
    deck[j] = tmp
  }
  return deck
}

export function dealCards(deck: Card[], count: number): { dealt: Card[]; remaining: Card[] } {
  const dealt = deck.slice(0, count)
  const remaining = deck.slice(count)
  return { dealt, remaining }
}

// ---------- Combinations ----------

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]]
  if (k > arr.length) return []
  const [first, ...rest] = arr
  return [
    ...combinations(rest, k - 1).map(c => [first, ...c]),
    ...combinations(rest, k),
  ]
}

// ---------- Hand evaluation ----------

// Evaluate exactly 5 cards. Returns HandEvaluation.
function evaluateFive(cards: Card[]): HandEvaluation {
  if (cards.length !== 5) throw new Error('evaluateFive requires 5 cards')

  const ranksDesc = cards.map(cardRank).sort((a, b) => b - a)
  const suits = cards.map(cardSuit)

  // Count occurrences of each rank
  const counts = new Map<number, number>()
  for (const r of ranksDesc) counts.set(r, (counts.get(r) ?? 0) + 1)

  // Sort entries by count desc, then rank desc — for kicker ordering
  const countEntries = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    return b[0] - a[0]
  })
  const countsArr = countEntries.map(e => e[1])

  const isFlush = suits.every(s => s === suits[0])

  // Straight detection. ranksDesc has 5 distinct? Only a straight if all distinct.
  const distinct = [...new Set(ranksDesc)]
  let isStraight = false
  let straightHigh = 0
  if (distinct.length === 5) {
    const max = distinct[0]
    const min = distinct[4]
    if (max - min === 4) {
      isStraight = true
      straightHigh = max
    } else if (distinct[0] === 14 && distinct[1] === 5 && distinct[2] === 4 && distinct[3] === 3 && distinct[4] === 2) {
      // Wheel: A-2-3-4-5, ace plays low; high card is 5
      isStraight = true
      straightHigh = 5
    }
  }

  // For wheel, reorder the cards so kickers reflect 5-4-3-2-A (A as 1)
  const wheel = isStraight && straightHigh === 5 && distinct[0] === 14

  // Royal Flush
  if (isFlush && isStraight && straightHigh === 14) {
    return {
      rank: 10,
      rank_name: HAND_NAMES[10],
      best_cards: sortCardsByRankDesc(cards),
      kickers: [14, 13, 12, 11, 10],
    }
  }
  // Straight Flush
  if (isFlush && isStraight) {
    return {
      rank: 9,
      rank_name: HAND_NAMES[9],
      best_cards: sortCardsForStraight(cards, wheel),
      kickers: [straightHigh],
    }
  }
  // Four of a Kind
  if (countsArr[0] === 4) {
    const quad = countEntries[0][0]
    const kicker = countEntries[1][0]
    return {
      rank: 8,
      rank_name: HAND_NAMES[8],
      best_cards: orderByRankGroups(cards, [quad, kicker]),
      kickers: [quad, kicker],
    }
  }
  // Full House
  if (countsArr[0] === 3 && countsArr[1] === 2) {
    const trip = countEntries[0][0]
    const pair = countEntries[1][0]
    return {
      rank: 7,
      rank_name: HAND_NAMES[7],
      best_cards: orderByRankGroups(cards, [trip, pair]),
      kickers: [trip, pair],
    }
  }
  // Flush
  if (isFlush) {
    return {
      rank: 6,
      rank_name: HAND_NAMES[6],
      best_cards: sortCardsByRankDesc(cards),
      kickers: ranksDesc,
    }
  }
  // Straight
  if (isStraight) {
    return {
      rank: 5,
      rank_name: HAND_NAMES[5],
      best_cards: sortCardsForStraight(cards, wheel),
      kickers: [straightHigh],
    }
  }
  // Three of a Kind
  if (countsArr[0] === 3) {
    const trip = countEntries[0][0]
    const kickers = countEntries.slice(1).map(e => e[0]).sort((a, b) => b - a)
    return {
      rank: 4,
      rank_name: HAND_NAMES[4],
      best_cards: orderByRankGroups(cards, [trip, ...kickers]),
      kickers: [trip, ...kickers],
    }
  }
  // Two Pair
  if (countsArr[0] === 2 && countsArr[1] === 2) {
    const pairs = [countEntries[0][0], countEntries[1][0]].sort((a, b) => b - a)
    const kicker = countEntries[2][0]
    return {
      rank: 3,
      rank_name: HAND_NAMES[3],
      best_cards: orderByRankGroups(cards, [pairs[0], pairs[1], kicker]),
      kickers: [pairs[0], pairs[1], kicker],
    }
  }
  // Pair
  if (countsArr[0] === 2) {
    const pair = countEntries[0][0]
    const kickers = countEntries.slice(1).map(e => e[0]).sort((a, b) => b - a)
    return {
      rank: 2,
      rank_name: HAND_NAMES[2],
      best_cards: orderByRankGroups(cards, [pair, ...kickers]),
      kickers: [pair, ...kickers],
    }
  }
  // High Card
  return {
    rank: 1,
    rank_name: HAND_NAMES[1],
    best_cards: sortCardsByRankDesc(cards),
    kickers: ranksDesc,
  }
}

function sortCardsByRankDesc(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => cardRank(b) - cardRank(a))
}

// Order straight cards high-to-low; if wheel, place ace last (5-4-3-2-A).
function sortCardsForStraight(cards: Card[], wheel: boolean): Card[] {
  if (!wheel) return sortCardsByRankDesc(cards)
  const sorted = sortCardsByRankDesc(cards) // [A,5,4,3,2]
  // Move ace to end
  const ace = sorted.find(c => cardRank(c) === 14)!
  const rest = sorted.filter(c => cardRank(c) !== 14)
  return [...rest, ace]
}

// Order cards by groups of ranks (preserves the priority order given).
function orderByRankGroups(cards: Card[], rankOrder: number[]): Card[] {
  const out: Card[] = []
  for (const r of rankOrder) {
    for (const c of cards) {
      if (cardRank(c) === r) out.push(c)
    }
  }
  return out
}

export function evaluateHand(holeCards: Card[], communityCards: Card[]): HandEvaluation {
  const all = [...holeCards, ...communityCards]
  if (all.length < 5) {
    // Not enough cards yet — pad evaluation by treating what we have as the best.
    // For pre-flop / partial states, just evaluate everything we have as if it's a hand.
    // Caller should normally only invoke this once 5+ cards exist.
    // We'll do a degenerate evaluation: count what's there.
    return degenerateEvaluation(all)
  }
  const combos = combinations(all, 5)
  let best: HandEvaluation | null = null
  for (const combo of combos) {
    const ev = evaluateFive(combo)
    if (best === null || compareHands(ev, best) > 0) {
      best = ev
    }
  }
  return best!
}

// Fallback when fewer than 5 cards available.
function degenerateEvaluation(cards: Card[]): HandEvaluation {
  const ranks = cards.map(cardRank).sort((a, b) => b - a)
  const counts = new Map<number, number>()
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1)
  const countEntries = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    return b[0] - a[0]
  })
  let rank = 1
  if (countEntries[0]?.[1] === 4) rank = 8
  else if (countEntries[0]?.[1] === 3 && countEntries[1]?.[1] === 2) rank = 7
  else if (countEntries[0]?.[1] === 3) rank = 4
  else if (countEntries[0]?.[1] === 2 && countEntries[1]?.[1] === 2) rank = 3
  else if (countEntries[0]?.[1] === 2) rank = 2
  return {
    rank,
    rank_name: HAND_NAMES[rank],
    best_cards: sortCardsByRankDesc(cards),
    kickers: countEntries.flatMap(([r, c]) => Array(c).fill(r)),
  }
}

export function compareHands(a: HandEvaluation, b: HandEvaluation): number {
  if (a.rank !== b.rank) return a.rank - b.rank
  const len = Math.max(a.kickers.length, b.kickers.length)
  for (let i = 0; i < len; i++) {
    const av = a.kickers[i] ?? 0
    const bv = b.kickers[i] ?? 0
    if (av !== bv) return av - bv
  }
  return 0
}

// ---------- Betting ----------

export interface PlayerActionResult {
  newChips: number
  newCurrentBet: number
  newPotContribution: number
  newRoomCurrentBet: number
  newRoomMinRaise: number
  acted: boolean
  folded: boolean
  allIn: boolean
}

export function actionFold(player: { chips: number; current_bet: number }): PlayerActionResult {
  return {
    newChips: player.chips,
    newCurrentBet: player.current_bet,
    newPotContribution: 0,
    newRoomCurrentBet: 0, // caller should ignore — not changed by fold; merge as needed
    newRoomMinRaise: 0,
    acted: true,
    folded: true,
    allIn: false,
  }
}

export function actionCall(
  player: { chips: number; current_bet: number },
  room: { current_bet: number; min_raise: number },
): PlayerActionResult {
  const owed = Math.max(0, room.current_bet - player.current_bet)
  const pay = Math.min(player.chips, owed)
  const newChips = player.chips - pay
  const newCurrentBet = player.current_bet + pay
  return {
    newChips,
    newCurrentBet,
    newPotContribution: pay,
    newRoomCurrentBet: room.current_bet,
    newRoomMinRaise: room.min_raise,
    acted: true,
    folded: false,
    allIn: newChips === 0,
  }
}

export function actionRaise(
  player: { chips: number; current_bet: number },
  room: { current_bet: number; min_raise: number },
  raiseTo: number,
): PlayerActionResult {
  const maxAffordable = player.current_bet + player.chips
  if (raiseTo > maxAffordable) {
    throw new Error(`Cannot raise to ${raiseTo}; player can only reach ${maxAffordable}`)
  }
  const minLegal = room.current_bet + room.min_raise
  // Allow under-min raise only if player is going all-in
  const isAllIn = raiseTo === maxAffordable
  if (raiseTo < minLegal && !isAllIn) {
    throw new Error(`Raise to ${raiseTo} below minimum legal raise ${minLegal}`)
  }
  if (raiseTo <= room.current_bet && !isAllIn) {
    throw new Error(`Raise to ${raiseTo} must exceed current bet ${room.current_bet}`)
  }

  const pay = raiseTo - player.current_bet
  const newChips = player.chips - pay
  const newCurrentBet = raiseTo
  const newRoomCurrentBet = Math.max(room.current_bet, raiseTo)
  // Only update min_raise if this was a full raise (>= minLegal). Short all-ins don't reopen action — but we still raise the bet.
  const raiseIncrement = raiseTo - room.current_bet
  const newRoomMinRaise = raiseIncrement >= room.min_raise ? raiseIncrement : room.min_raise

  return {
    newChips,
    newCurrentBet,
    newPotContribution: pay,
    newRoomCurrentBet,
    newRoomMinRaise,
    acted: true,
    folded: false,
    allIn: newChips === 0,
  }
}

export function nextPlayerIndex(
  playerIds: string[],
  states: Map<string, { folded: boolean; all_in: boolean }>,
  fromIndex: number,
): number {
  const n = playerIds.length
  if (n === 0) return -1
  for (let step = 1; step <= n; step++) {
    const idx = (fromIndex + step) % n
    const id = playerIds[idx]
    const s = states.get(id)
    if (!s) continue
    if (!s.folded && !s.all_in) return idx
  }
  return -1
}

export function isBettingRoundComplete(
  playerIds: string[],
  states: Map<string, { current_bet: number; folded: boolean; all_in: boolean; acted: boolean }>,
  currentBet: number,
): boolean {
  let activeCount = 0
  for (const id of playerIds) {
    const s = states.get(id)
    if (!s) continue
    if (s.folded) continue
    activeCount++
    if (s.all_in) continue
    if (!s.acted) return false
    if (s.current_bet !== currentBet) return false
  }
  return activeCount > 0
}

// ---------- Showdown ----------

export function chooseHandWinners(
  contestants: { user_id: string; hole_cards: Card[] }[],
  community: Card[],
): { winner_ids: string[]; evaluations: { user_id: string; eval: HandEvaluation }[] } {
  const evaluations = contestants.map(c => ({
    user_id: c.user_id,
    eval: evaluateHand(c.hole_cards, community),
  }))
  if (evaluations.length === 0) {
    return { winner_ids: [], evaluations }
  }
  let best = evaluations[0].eval
  for (let i = 1; i < evaluations.length; i++) {
    if (compareHands(evaluations[i].eval, best) > 0) {
      best = evaluations[i].eval
    }
  }
  const winner_ids = evaluations
    .filter(e => compareHands(e.eval, best) === 0)
    .map(e => e.user_id)
  return { winner_ids, evaluations }
}
