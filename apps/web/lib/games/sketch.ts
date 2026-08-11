// Sketch — draw & guess. Pure data + word lists, no React.
// One drawer per turn picks a word and draws; everyone else guesses in
// the room chat side-channel. Points by solve order; drawer earns per
// solver. Everyone draws once per round.

export interface SketchStroke {
  c: string          // color
  w: number          // width (board units)
  p: number[]        // x0,y0,x1,y1,… in board units
}

export interface SketchState {
  turnIdx: number
  round: number
  rounds: number
  phase: 'choosing' | 'drawing' | 'reveal' | 'end'
  word: string | null
  choices: string[]
  strokes: SketchStroke[]
  solved: Record<string, number>      // uid → solve order (1-based)
  scores: Record<string, number>
  deadline: number | null             // epoch ms
  seq: number
}

export const SK_W = 340
export const SK_H = 300
export const SK_TURN_MS = 75_000
export const SK_REVEAL_MS = 4_000
export const SK_ROUNDS = 2
export const SK_COLORS = ['#1A1917', '#2440FF', '#E8543F', '#E9A13B', '#1FA05A', '#BA78FF']
export const GUESS_POINTS = [300, 200, 150, 120, 100]
export const DRAWER_POINTS = 100

const WORDS_EN = [
  'guitar', 'piano', 'drum', 'violin', 'trumpet', 'microphone', 'headphones', 'speaker',
  'apple', 'banana', 'pizza', 'cake', 'coffee', 'egg', 'cheese', 'candy',
  'cat', 'dog', 'rabbit', 'penguin', 'whale', 'snail', 'butterfly', 'octopus',
  'house', 'bridge', 'rocket', 'airplane', 'bicycle', 'train', 'umbrella', 'ladder',
  'moon', 'star', 'rainbow', 'volcano', 'island', 'cactus', 'snowman', 'cloud',
  'glasses', 'crown', 'clock', 'candle', 'scissors', 'camera', 'robot', 'ghost',
  'king', 'wizard', 'pirate', 'angel', 'clown', 'chef', 'astronaut', 'mermaid',
]
const WORDS_KO = [
  '기타', '피아노', '드럼', '바이올린', '트럼펫', '마이크', '헤드폰', '스피커',
  '사과', '바나나', '피자', '케이크', '커피', '계란', '치즈', '사탕',
  '고양이', '강아지', '토끼', '펭귄', '고래', '달팽이', '나비', '문어',
  '집', '다리', '로켓', '비행기', '자전거', '기차', '우산', '사다리',
  '달', '별', '무지개', '화산', '섬', '선인장', '눈사람', '구름',
  '안경', '왕관', '시계', '촛불', '가위', '카메라', '로봇', '유령',
  '왕', '마법사', '해적', '천사', '광대', '요리사', '우주인', '인어',
]

export function pickChoices(lang: string, exclude: string[] = []): string[] {
  const pool = (lang === 'ko' ? WORDS_KO : WORDS_EN).filter(w => !exclude.includes(w))
  const out: string[] = []
  while (out.length < 3 && pool.length > 0) {
    const i = Math.floor(Math.random() * pool.length)
    out.push(pool.splice(i, 1)[0])
  }
  return out
}

export function normalizeGuess(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '')
}

export function maskWord(w: string): string {
  return w.split('').map(ch => (ch === ' ' ? ' ' : '_')).join(' ')
}

export function initialSketchState(ids: string[], lang: string): SketchState {
  const scores: Record<string, number> = {}
  for (const id of ids) scores[id] = 0
  return {
    turnIdx: 0,
    round: 1,
    rounds: SK_ROUNDS,
    phase: 'choosing',
    word: null,
    choices: pickChoices(lang),
    strokes: [],
    solved: {},
    scores,
    deadline: null,
    seq: 0,
  }
}

/** Winner by score; exact tie → null. */
export function sketchWinner(st: SketchState, ids: string[]): string | null {
  let best: string | null = null
  let bs = -1
  let tied = false
  for (const id of ids) {
    const s = st.scores[id] ?? 0
    if (s > bs) { best = id; bs = s; tied = false }
    else if (s === bs) tied = true
  }
  return tied ? null : best
}
