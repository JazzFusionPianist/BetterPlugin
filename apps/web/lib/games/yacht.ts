// Yacht Dice — pure rules + a workable bot. No React.
//
// Ruleset follows Clubhouse Games' Yacht Dice (Yahtzee-flavoured Yacht):
//   · 5 dice, up to 3 rolls per turn (hold any dice between rolls)
//   · 12 categories, one filled per turn → 12 rounds
//   · upper section (ones..sixes) = sum of matching faces;
//     upper total ≥ 63 → +35 bonus
//   · choice        = sum of all five dice
//   · four of a kind = sum of all five dice (needs 4+ of one face)
//   · full house    = sum of all five dice (needs exactly 3 + 2)
//   · small straight = 15 (any 4 consecutive)
//   · big straight   = 30 (five consecutive)
//   · yacht          = 50 (five of a kind)

export const YACHT_CATS = [
  'ones', 'twos', 'threes', 'fours', 'fives', 'sixes',
  'choice', 'fourKind', 'fullHouse', 'sStraight', 'bStraight', 'yacht',
] as const
export type YachtCat = number // 0..11
export const YACHT_NUM_CATS = 12
export const YACHT_UPPER_BONUS = 35
export const YACHT_UPPER_TARGET = 63

/** null = category still open. */
export type YachtCard = (number | null)[]

export function emptyCard(): YachtCard {
  return Array.from({ length: YACHT_NUM_CATS }, () => null)
}

function faceCounts(dice: number[]): number[] {
  const c = [0, 0, 0, 0, 0, 0, 0] // 1-indexed
  for (const d of dice) c[d]++
  return c
}

function diceSum(dice: number[]): number {
  return dice.reduce((a, b) => a + b, 0)
}

function hasRun(counts: number[], len: number): boolean {
  let run = 0
  for (let f = 1; f <= 6; f++) {
    run = counts[f] > 0 ? run + 1 : 0
    if (run >= len) return true
  }
  return false
}

/** Score `dice` in category `cat` under Yacht rules (0 when unqualified). */
export function scoreCategory(cat: YachtCat, dice: number[]): number {
  const counts = faceCounts(dice)
  if (cat <= 5) {
    const face = cat + 1
    return counts[face] * face
  }
  switch (cat) {
    case 6: return diceSum(dice)                                        // choice
    case 7: return counts.some(c => c >= 4) ? diceSum(dice) : 0         // four of a kind
    case 8: {                                                            // full house (3+2)
      const nz = counts.filter(c => c > 0).sort((a, b) => a - b)
      return nz.length === 2 && nz[0] === 2 && nz[1] === 3 ? diceSum(dice) : 0
    }
    case 9: return hasRun(counts, 4) ? 15 : 0                            // small straight
    case 10: return hasRun(counts, 5) ? 30 : 0                           // big straight
    case 11: return counts.some(c => c === 5) ? 50 : 0                   // yacht
    default: return 0
  }
}

export function upperTotal(card: YachtCard): number {
  let t = 0
  for (let i = 0; i <= 5; i++) t += card[i] ?? 0
  return t
}

export function upperBonus(card: YachtCard): number {
  return upperTotal(card) >= YACHT_UPPER_TARGET ? YACHT_UPPER_BONUS : 0
}

export function cardTotal(card: YachtCard): number {
  let t = upperBonus(card)
  for (let i = 0; i < YACHT_NUM_CATS; i++) t += card[i] ?? 0
  return t
}

export function cardComplete(card: YachtCard): boolean {
  return card.every(v => v !== null)
}

export function rollDice(n = 5): number[] {
  return Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6))
}

// ───────────────────────────────────────────────────────────────────────────
// Bot — a greedy expected-value-ish player. Good enough to be a real
// opponent without ever feeling superhuman.
// ───────────────────────────────────────────────────────────────────────────

/** Which dice should the bot keep? Returns a hold mask. */
export function botHolds(dice: number[], card: YachtCard): boolean[] {
  const counts = faceCounts(dice)

  // Straight chase: if a straight category is open and we already hold a
  // decent run, keep the run.
  const wantB = card[10] === null
  const wantS = card[9] === null
  if (wantB || wantS) {
    // longest run of distinct faces
    let bestLen = 0, bestEnd = 0, run = 0
    for (let f = 1; f <= 6; f++) {
      run = counts[f] > 0 ? run + 1 : 0
      if (run > bestLen) { bestLen = run; bestEnd = f }
    }
    if (bestLen >= 3) {
      const inRun = new Set<number>()
      for (let f = bestEnd - bestLen + 1; f <= bestEnd; f++) inRun.add(f)
      const used = new Set<number>()
      return dice.map(d => {
        if (inRun.has(d) && !used.has(d)) { used.add(d); return true }
        return false
      })
    }
  }

  // Otherwise keep the most frequent face (ties → the higher face)…
  let bestFace = 6, bestCount = 0
  for (let f = 6; f >= 1; f--) {
    if (counts[f] > bestCount) { bestCount = counts[f]; bestFace = f }
  }
  // …but if that face's upper slot AND the kind categories are all spent,
  // prefer a face whose upper slot is still open.
  if (card[bestFace - 1] !== null && card[7] !== null && card[11] !== null) {
    for (let f = 6; f >= 1; f--) {
      if (counts[f] > 0 && card[f - 1] === null) { bestFace = f; break }
    }
  }
  return dice.map(d => d === bestFace)
}

/** Which open category should the bot fill with these dice? */
export function botPickCategory(dice: number[], card: YachtCard): YachtCat {
  let bestCat = -1
  let bestVal = -Infinity
  for (let cat = 0; cat < YACHT_NUM_CATS; cat++) {
    if (card[cat] !== null) continue
    const s = scoreCategory(cat, dice)
    // weight: prefer the rare fixed-score hands when they actually hit,
    // and lightly protect choice for a big-sum day.
    let v = s
    if (cat === 11 && s > 0) v += 20
    if (cat === 10 && s > 0) v += 8
    if (cat === 9 && s > 0) v += 4
    if (cat === 6) v -= 6
    // sacrificial order when everything scores zero: dump the cheapest slot
    if (s === 0) v = cat === 11 ? -30 : cat <= 5 ? -10 + (5 - cat) : -20
    if (v > bestVal) { bestVal = v; bestCat = cat }
  }
  return bestCat
}
