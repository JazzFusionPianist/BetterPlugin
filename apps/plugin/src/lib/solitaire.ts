/**
 * Klondike solitaire — draw-1 or draw-3, four foundations (any suit
 * order), seven tableau piles. Scoring follows the classic desktop
 * rules: +10 to a foundation, +5 waste→tableau, +5 turning a tableau
 * card, −15 foundation→tableau, plus a time bonus on a win.
 */

export type Suit = 'S' | 'H' | 'D' | 'C'
export interface Card { suit: Suit; rank: number; faceUp: boolean; id: string }
export type Pile = Card[]

export const SUITS: Suit[] = ['S', 'H', 'D', 'C']
export function isRed(s: Suit): boolean { return s === 'H' || s === 'D' }
export const SUIT_GLYPH: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' }
export function rankLabel(r: number): string {
  return r === 1 ? 'A' : r === 11 ? 'J' : r === 12 ? 'Q' : r === 13 ? 'K' : String(r)
}

export type SolSource =
  | { kind: 'waste' }
  | { kind: 'foundation'; index: number }
  | { kind: 'tableau'; pile: number; index: number }
export type SolTarget =
  | { kind: 'foundation'; index: number }
  | { kind: 'tableau'; pile: number }

export class SolitaireGame {
  stock: Pile = []
  waste: Pile = []
  foundations: Pile[] = [[], [], [], []]
  tableau: Pile[] = [[], [], [], [], [], [], []]
  score = 0
  moves = 0
  won = false
  passes = 0

  constructor(public drawCount: 1 | 3 = 1) { this.reset() }

  reset(): void {
    const deck: Card[] = []
    for (const suit of SUITS) for (let rank = 1; rank <= 13; rank++) deck.push({ suit, rank, faceUp: false, id: `${suit}${rank}` })
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]] }
    this.tableau = Array.from({ length: 7 }, () => [])
    for (let p = 0; p < 7; p++) {
      for (let k = 0; k <= p; k++) {
        const c = deck.pop()!
        c.faceUp = k === p
        this.tableau[p].push(c)
      }
    }
    this.stock = deck
    this.waste = []
    this.foundations = [[], [], [], []]
    this.score = 0; this.moves = 0; this.won = false; this.passes = 0
  }

  /** Flip stock → waste (draw 1 or 3). Empty stock recycles the waste. */
  draw(): boolean {
    if (this.stock.length === 0) {
      if (this.waste.length === 0) return false
      this.stock = this.waste.reverse().map(c => ({ ...c, faceUp: false }))
      this.waste = []
      this.passes++
      if (this.drawCount === 1 && this.passes > 0) this.score = Math.max(0, this.score - 100)
      else if (this.drawCount === 3 && this.passes > 3) this.score = Math.max(0, this.score - 20)
      this.moves++
      return true
    }
    for (let i = 0; i < this.drawCount && this.stock.length > 0; i++) {
      const c = this.stock.pop()!
      c.faceUp = true
      this.waste.push(c)
    }
    this.moves++
    return true
  }

  cardsAt(src: SolSource): Card[] {
    if (src.kind === 'waste') return this.waste.length ? [this.waste[this.waste.length - 1]] : []
    if (src.kind === 'foundation') { const f = this.foundations[src.index]; return f.length ? [f[f.length - 1]] : [] }
    const pile = this.tableau[src.pile]
    const card = pile[src.index]
    if (!card || !card.faceUp) return []
    return pile.slice(src.index)
  }

  canPlaceFoundation(card: Card, index: number): boolean {
    const f = this.foundations[index]
    if (f.length === 0) return card.rank === 1
    const top = f[f.length - 1]
    return top.suit === card.suit && top.rank === card.rank - 1
  }

  canPlaceTableau(card: Card, pile: number): boolean {
    const p = this.tableau[pile]
    if (p.length === 0) return card.rank === 13
    const top = p[p.length - 1]
    return top.faceUp && isRed(top.suit) !== isRed(card.suit) && top.rank === card.rank + 1
  }

  /** Try to move `src` onto `dst`. Returns true when it happened. */
  move(src: SolSource, dst: SolTarget): boolean {
    const cards = this.cardsAt(src)
    if (cards.length === 0) return false
    if (dst.kind === 'foundation') {
      if (cards.length !== 1 || !this.canPlaceFoundation(cards[0], dst.index)) return false
      this.take(src)
      this.foundations[dst.index].push(cards[0])
      this.score += 10
    } else {
      if (src.kind === 'tableau' && src.pile === dst.pile) return false
      if (!this.canPlaceTableau(cards[0], dst.pile)) return false
      this.take(src)
      this.tableau[dst.pile].push(...cards)
      if (src.kind === 'waste') this.score += 5
      else if (src.kind === 'foundation') this.score = Math.max(0, this.score - 15)
    }
    this.moves++
    this.checkWin()
    return true
  }

  /** Send a card to whichever foundation takes it. */
  autoFoundation(src: SolSource): boolean {
    const cards = this.cardsAt(src)
    if (cards.length !== 1) return false
    for (let i = 0; i < 4; i++) if (this.canPlaceFoundation(cards[0], i)) return this.move(src, { kind: 'foundation', index: i })
    return false
  }

  private take(src: SolSource): void {
    if (src.kind === 'waste') { this.waste.pop(); return }
    if (src.kind === 'foundation') { this.foundations[src.index].pop(); return }
    const pile = this.tableau[src.pile]
    pile.splice(src.index)
    const top = pile[pile.length - 1]
    if (top && !top.faceUp) { top.faceUp = true; this.score += 5 }
  }

  private checkWin(): void {
    if (this.foundations.every(f => f.length === 13)) this.won = true
  }

  /** Final score with the classic time bonus. */
  finalScore(seconds: number): number {
    if (!this.won) return this.score
    const bonus = seconds >= 30 ? Math.round(700000 / seconds) : 0
    return this.score + bonus
  }
}
