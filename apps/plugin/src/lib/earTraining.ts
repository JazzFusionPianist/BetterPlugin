/**
 * Ear Training Duel — pure domain logic + audio.
 *
 * Two responsibilities, kept in one file because they share music
 * vocabulary (intervals, chord shapes, MIDI math):
 *   1. Deterministic question generation from (roomId, round, config)
 *      using a seeded RNG. Both clients call this and get the SAME
 *      question without any round-trip to the server.
 *   2. WebAudio playback — synthesises sine-ish tones with a soft
 *      piano-like envelope. No samples shipped.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type Mode = 'interval' | 'chord'

export type Difficulty = 'basic' | 'intermediate' | 'advanced'

export interface RoomConfig {
  modes: Mode[]              // which question types are in the pool
  difficulty: Difficulty
}

export interface IntervalQuestion {
  type: 'interval'
  /** MIDI note of the bottom note. */
  rootMidi: number
  /** Distance in semitones (positive, ascending). */
  semitones: number
  /** 'asc' = arpeggiated up, 'desc' = down, 'harm' = simultaneous. */
  direction: 'asc' | 'desc' | 'harm'
  /** All choices shown to the user, including the correct one. */
  options: IntervalAnswer[]
  /** The correct option. */
  answer: IntervalAnswer
}

export interface ChordQuestion {
  type: 'chord'
  rootMidi: number
  quality: ChordQuality
  /** All choices shown to the user. */
  options: ChordQuality[]
  answer: ChordQuality
}

export type Question = IntervalQuestion | ChordQuestion

export type IntervalAnswer =
  | 'm2' | 'M2' | 'm3' | 'M3' | 'P4' | 'tt' | 'P5'
  | 'm6' | 'M6' | 'm7' | 'M7' | 'P8'

export type ChordQuality =
  | 'maj' | 'min' | 'dim' | 'aug'
  | 'sus2' | 'sus4'
  | 'maj7' | 'min7' | 'dom7' | 'm7b5'

// ─── Constants ────────────────────────────────────────────────────────────────

const INTERVAL_SEMITONES: Record<IntervalAnswer, number> = {
  m2: 1, M2: 2, m3: 3, M3: 4, P4: 5, tt: 6, P5: 7,
  m6: 8, M6: 9, m7: 10, M7: 11, P8: 12,
}

const CHORD_SHAPES: Record<ChordQuality, number[]> = {
  maj:  [0, 4, 7],
  min:  [0, 3, 7],
  dim:  [0, 3, 6],
  aug:  [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
  m7b5: [0, 3, 6, 10],
}

const DIFFICULTY_INTERVALS: Record<Difficulty, IntervalAnswer[]> = {
  basic:        ['m3', 'M3', 'P4', 'P5', 'P8'],
  intermediate: ['m2', 'M2', 'm3', 'M3', 'P4', 'P5', 'M6', 'P8'],
  advanced:     ['m2', 'M2', 'm3', 'M3', 'P4', 'tt', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'],
}

const DIFFICULTY_CHORDS: Record<Difficulty, ChordQuality[]> = {
  basic:        ['maj', 'min'],
  intermediate: ['maj', 'min', 'dim', 'aug'],
  advanced:     ['maj', 'min', 'dim', 'aug', 'maj7', 'min7', 'dom7', 'm7b5'],
}

/** MIDI 48 = C3, 84 = C6. We stay within this for consistent register. */
const MIN_ROOT = 52  // E3
const MAX_ROOT = 72  // C5

export const ROUND_DURATION_MS = 12_000   // 12s per question
export const REVEAL_DURATION_MS = 3_800   // pause between answer and next round — long enough to read both players' picks + projected score
export const MAX_PLAYS = 3                // replays per round

// ─── Seeded RNG (mulberry32) ──────────────────────────────────────────────────

/** xmur3 hash → seed. */
function xmur3 (str: string): () => number {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return (h ^= h >>> 16) >>> 0
  }
}

/** Fast, deterministic, decent-quality PRNG. */
function mulberry32 (seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeRng (roomId: string, round: number, config: RoomConfig): () => number {
  // Mix in difficulty + sorted modes so changing the lobby setup also
  // changes the question stream even at the same room+round.
  const key = `${roomId}|${round}|${config.difficulty}|${[...config.modes].sort().join(',')}`
  const seedHash = xmur3(key)
  return mulberry32(seedHash())
}

// ─── Question generation ──────────────────────────────────────────────────────

function pick<T> (rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

/** Fisher–Yates shuffle seeded by the same rng — same input → same order. */
function shuffle<T> (rng: () => number, arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Build the multiple-choice option set for an interval question.
 *  Always includes the answer + 3 plausible distractors from the pool. */
function buildIntervalOptions (rng: () => number, answer: IntervalAnswer, pool: IntervalAnswer[]): IntervalAnswer[] {
  const distractors = pool.filter(i => i !== answer)
  const shuffled = shuffle(rng, distractors).slice(0, 3)
  return shuffle(rng, [answer, ...shuffled])
}

function buildChordOptions (rng: () => number, answer: ChordQuality, pool: ChordQuality[]): ChordQuality[] {
  const distractors = pool.filter(q => q !== answer)
  const shuffled = shuffle(rng, distractors).slice(0, 3)
  return shuffle(rng, [answer, ...shuffled])
}

export function generateQuestion (roomId: string, round: number, config: RoomConfig): Question {
  const rng = makeRng(roomId, round, config)
  const modes = config.modes.length > 0 ? config.modes : ['interval' as Mode, 'chord' as Mode]
  const mode  = pick(rng, modes)
  const rootMidi = Math.floor(rng() * (MAX_ROOT - MIN_ROOT + 1)) + MIN_ROOT

  if (mode === 'interval') {
    const pool = DIFFICULTY_INTERVALS[config.difficulty]
    const answer = pick(rng, pool)
    const direction = pick(rng, ['asc', 'desc', 'harm'] as const)
    return {
      type: 'interval',
      rootMidi,
      semitones: INTERVAL_SEMITONES[answer],
      direction,
      options: buildIntervalOptions(rng, answer, pool),
      answer,
    }
  }

  // chord
  const pool = DIFFICULTY_CHORDS[config.difficulty]
  const answer = pick(rng, pool)
  return {
    type: 'chord',
    rootMidi,
    quality: answer,
    options: buildChordOptions(rng, answer, pool),
    answer,
  }
}

// ─── WebAudio playback ────────────────────────────────────────────────────────

let _ctx: AudioContext | null = null
function ctx (): AudioContext | null {
  if (_ctx) return _ctx
  try {
    const Ctor =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    _ctx = new Ctor()
    return _ctx
  } catch { return null }
}

const A4_HZ = 440
function midiToHz (midi: number): number {
  return A4_HZ * Math.pow(2, (midi - 69) / 12)
}

/** Play one note with a soft piano-like envelope.
 *  Two oscillators (sine + triangle) detuned slightly for warmth. */
function playNote (ac: AudioContext, midi: number, when: number, durSec: number, gain = 0.16) {
  const freq = midiToHz(midi)
  const g = ac.createGain()
  // Quick attack, exponential decay, sustain near zero for plucky feel.
  g.gain.setValueAtTime(0.0001, when)
  g.gain.exponentialRampToValueAtTime(gain, when + 0.015)
  g.gain.exponentialRampToValueAtTime(gain * 0.45, when + 0.2)
  g.gain.exponentialRampToValueAtTime(0.0001, when + durSec)
  g.connect(ac.destination)

  const o1 = ac.createOscillator()
  o1.type = 'sine'
  o1.frequency.value = freq
  o1.connect(g)
  o1.start(when)
  o1.stop(when + durSec + 0.05)

  const o2 = ac.createOscillator()
  o2.type = 'triangle'
  o2.frequency.value = freq
  o2.detune.value = 6 // subtle chorus
  const g2 = ac.createGain()
  g2.gain.value = 0.35
  o2.connect(g2)
  g2.connect(g)
  o2.start(when)
  o2.stop(when + durSec + 0.05)
}

/** Play a question. Returns approximate total duration in ms so the
 *  caller can decrement replays / disable the play button correctly. */
export function playQuestion (q: Question): number {
  const ac = ctx()
  if (!ac) return 0
  if (ac.state === 'suspended') ac.resume().catch(() => {})
  const now = ac.currentTime + 0.04

  if (q.type === 'interval') {
    const a = q.rootMidi
    const b = q.rootMidi + q.semitones
    if (q.direction === 'harm') {
      playNote(ac, a, now, 1.5)
      playNote(ac, b, now, 1.5)
      return 1500
    }
    const [first, second] = q.direction === 'asc' ? [a, b] : [b, a]
    playNote(ac, first,  now,         0.85)
    playNote(ac, second, now + 0.7,   0.85)
    return 1550
  }

  // chord
  const shape = CHORD_SHAPES[q.quality]
  for (const off of shape) playNote(ac, q.rootMidi + off, now, 1.6)
  return 1600
}

// ─── Display helpers ──────────────────────────────────────────────────────────

export const INTERVAL_LABELS: Record<IntervalAnswer, string> = {
  m2: 'm2', M2: 'M2', m3: 'm3', M3: 'M3', P4: 'P4', tt: 'TT', P5: 'P5',
  m6: 'm6', M6: 'M6', m7: 'm7', M7: 'M7', P8: 'P8',
}

export const CHORD_LABELS: Record<ChordQuality, string> = {
  maj: 'maj', min: 'min', dim: 'dim', aug: 'aug',
  sus2: 'sus2', sus4: 'sus4',
  maj7: 'maj7', min7: 'min7', dom7: 'dom7', m7b5: 'm7♭5',
}

export function isCorrect (q: Question, answer: string): boolean {
  return answer === q.answer
}
