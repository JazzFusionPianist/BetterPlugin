/**
 * The prints, as data: one catalog that Patch on Slur's wall and Slur Studio's wall both read.
 *
 * Which prints there are and what they are called, their flavours and what a flavour is called, where a new one rests,
 * how its amount is said and read back, and every hand its study shows (the range, the step, the default, the unit, how
 * it is said, how a typed value is read, when it is shown, and what it writes into the node). Patch on Slur draws its
 * study from HANDS; Slur Studio bundles this file on every build (Daw/tools/catalog-from-patch.mjs) and builds its own
 * wall's hands from it, so a print changed or added here is changed or added there with the next build, and its build
 * fails when this file asks for something its wall cannot do (Daw/tools/catalog-check.mjs).
 *
 * Nothing here draws (no React): it is plain data and plain functions, so that a page with no modules can take it.
 */
import {
  FX_MIX_TYPE, FX_SPLIT_LR, FX_SPLIT_MS, FX_LFO, FX_RATE, FX_MACRO, FX_SIDE, FX_FOLLOW, FX_COMP, FX_BANDS, FX_CARVE, FX_MATCH,
  FX_VOCODE, FX_FREEZE, FX_SHIFT, FX_SMEAR, FX_PAN, FX_REPEAT, FX_ENV, FX_FOLD, FX_DRIFT, FX_PULSE, FX_SCENE, FX_SIEVE, FX_TUNE,
  isUtilityType, type FxMode, type FxGraphNode,
} from '../../lib/fxBridge'
/** A scene's snapshot: one row per print, led by its id, of the hands SCENE_HANDS names. */
export { SCENE_HANDS, SCENE_STRIDE, sceneRow } from '../../lib/fxBridge'

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
/** The number a typed value begins with ("−3.5 dB", "2.5k"); a k (or khz) after it is a thousand. */
export function parseLead (s: string): number | null {
  const m = /^\s*([+\-−]?\s*\d*\.?\d+)\s*([a-zA-Z%]*)/.exec(s.replace(/,/g, '.'))
  if (!m) return null
  let v = Number(m[1].replace('−', '-').replace(/\s+/g, ''))
  if (!Number.isFinite(v)) return null
  const unit = m[2].toLowerCase()
  if (unit === 'k' || unit === 'khz') v *= 1000
  return v
}
export const fmtHz = (hz: number) => (hz >= 1000 ? `${(hz / 1000).toFixed(hz >= 10000 ? 1 : 2)}k` : `${Math.round(hz)}`)

/* ── the prints and their names ── */
export const MODES: Array<{ id: FxMode; name: string }> = [
  { id: 7, name: 'cut' }, { id: 8, name: 'amp' }, { id: 0, name: 'tone' }, { id: 1, name: 'tape' }, { id: 6, name: 'mod' },
  { id: 9, name: 'doubler' }, { id: 10, name: 'delay' }, { id: 2, name: 'space' }, { id: 3, name: 'stereo' }, { id: 4, name: 'glue' },
  { id: 5, name: 'gain' }, { id: 12, name: 'tremolo' }, { id: 13, name: 'arp' }, { id: 14, name: 'radio' }, { id: 15, name: 'harmony' },
  { id: 16, name: 'pitch' }, { id: 17, name: 'formant' }, { id: 18, name: 'grain' }, { id: 20, name: 'crush' }, { id: 21, name: 'shimmer' },
  { id: 22, name: 'swell' }, { id: 23, name: 'stutter' }, { id: 24, name: 'air' }, { id: 25, name: 'ring' }, { id: 26, name: 'gate' },
  { id: 27, name: 'wow' },
]
/** A print's name, whatever its number. */
export const nameOf = (type: number) => (type === FX_MIX_TYPE ? 'mix' : type === FX_SPLIT_LR ? 'L/R' : type === FX_SPLIT_MS ? 'M/S' : type === FX_LFO ? 'LFO' : type === FX_RATE ? 'rate' : type === FX_MACRO ? 'macro' : type === FX_SIDE ? 'side' : type === FX_FOLLOW ? 'follow' : type === FX_COMP ? 'comp' : type === FX_BANDS ? 'bands' : type === FX_CARVE ? 'carve' : type === FX_MATCH ? 'match' : type === FX_VOCODE ? 'vocode' : type === FX_FREEZE ? 'freeze' : type === FX_SHIFT ? 'shift' : type === FX_SMEAR ? 'smear' : type === FX_PAN ? 'pan' : type === FX_REPEAT ? 'repeat' : type === FX_ENV ? 'env' : type === FX_FOLD ? 'fold' : type === FX_DRIFT ? 'drift' : type === FX_PULSE ? 'pulse' : type === FX_SCENE ? 'scene' : type === FX_SIEVE ? 'sieve' : type === FX_TUNE ? 'tune' : MODES.find(m => m.id === type)?.name ?? '')   // the splitters are the one word in capitals: they name the channels
/** The shelf's families: one row of prints at a time. */
export const FAMILIES: Array<[string, string[]]> = [
  ['tone', ['cut', 'amp', 'tone', 'tape', 'glue', 'comp', 'air']],
  ['grit', ['crush', 'radio', 'ring', 'fold']],
  ['space', ['delay', 'space', 'shimmer', 'doubler', 'stereo']],
  ['motion', ['mod', 'tremolo', 'swell', 'stutter', 'gate', 'wow', 'repeat']],
  ['pitch', ['pitch', 'formant', 'harmony', 'arp', 'grain', 'tune']],
  ['utility', ['gain', 'mix', 'L/R', 'M/S', 'pan', 'bands', 'side']],
  ['control', ['LFO', 'macro', 'follow', 'env', 'drift', 'pulse', 'scene']],
  ['spectral', ['carve', 'match', 'vocode', 'freeze', 'shift', 'smear', 'sieve']],
]
/** Every print on the shelf, with its number and family. */
export const PRINTS: Array<{ type: number; name: string; family: string }> = (() => {
  const byName = new Map<string, number>()
  for (let t = 0; t <= 60; t++) { const nm = nameOf(t); if (nm) byName.set(nm, t) }
  return FAMILIES.flatMap(([family, names]) => names.map(name => ({ type: byName.get(name) ?? -1, name, family })))
})()

/* ── flavours ── */
/** Sub-flavours, indexed by number (gain's are its two polarity switches, not a list). */
export const VARIANTS: string[][] = [
  [],                              // tone
  ['hard', 'clean'],               // tape
  ['hall', 'room', 'plate'],       // space
  [],                              // stereo
  [],                              // glue
  [],                              // gain
  ['chorus', 'flanger', 'phaser'], // mod
  ['low', 'high', 'band'],         // cut
  ['clean', 'crunch', 'lead', 'fuzz'], // amp
  ['tight', 'wide'],               // doubler
  ['clean', 'tape', 'pingpong'],   // delay
  [],                              // (mix slot)
  ['sine', 'triangle', 'square', 'pulse', 'saw'], // tremolo
  ['up', 'down', 'up-down', 'random'],            // arp
  ['am', 'phone'],                 // radio
  ['key', 'chromatic'],            // harmony
  ['raw', 'natural'],              // pitch
  [],                              // formant
  ['cloud', 'stutter', 'reverse'], // grain
  ['female', 'male', 'child', 'giant'], // voice
  ['both', 'bits', 'rate'],        // crush
  ['octave', 'fifth', 'down'],     // shimmer
  ['soft', 'hard'],                // swell
  ['beat', 'bar'],                 // stutter
  ['silk', 'bright'],              // air
  ['ring', 'am'],                  // ring
  ['tight', 'loose'],              // gate
  ['wow', 'flutter', 'both'],      // wow
]
/** The flavours of the prints that came after the first twenty-eight. */
export const NEW_VARIANTS: Record<number, string[]> = { [FX_ENV]: ['level', 'wire'], [FX_FOLD]: ['sine', 'triangle'], [FX_TUNE]: ['natural', 'raw'] }
export const flavoursOf = (type: number) => (type === FX_MIX_TYPE ? ['blend', 'sum'] : VARIANTS[type] ?? NEW_VARIANTS[type] ?? [])
/** What each print's flavours are called in its study. */
export const VARIANT_LABEL: Record<number, string> = { 1: 'drive', 2: 'room', 6: 'kind', 7: 'pass', 8: 'stage', 9: 'spread', 10: 'type', 13: 'order', 14: 'band', 15: 'mode', 16: 'mode', 18: 'mode', 20: 'target', 21: 'interval', 22: 'floor', 23: 'grid', 24: 'mode', 25: 'mode', 26: 'release', 27: 'motion', [FX_TUNE]: 'formant' }
/** The prints that can drop their dry sound (wet only). */
export const WET_TYPES = new Set<number>([2, 10, 9, 6, 15, 18, 21])   // space, delay, doubler, mod, harmony, grain, shimmer

/* ── where a new print rests ── */
/** A new print's amount: tone, stereo, pitch, formant and pan rest in the middle, gain at unity. */
/** What a print's big knob is, where "amount" would be vague. */
export const MAIN_HAND: Record<number, string> = { 7: 'cutoff', [FX_COMP]: 'threshold', [FX_CARVE]: 'depth', [FX_PAN]: 'pan', [FX_FOLD]: 'drive', [FX_FREEZE]: 'hold', [FX_SIEVE]: 'keep', [FX_TUNE]: 'retune', [FX_SHIFT]: 'mix', [FX_SMEAR]: 'mix', [FX_REPEAT]: 'mix' }
export const neutralOf = (type: number) => (type === 0 || type === 3 || type === 16 || type === 17 || type === FX_PAN ? 0.5 : type === 5 ? 0.75 : 0)
/** A new print's other hands (a macro's are its number, given by the wall). */
export const auxOf = (type: number, macroNo = 0): number[] => type === 7 ? [2, 0, 0] : type === 13 ? [12, 0, 0] : type === 15 ? [0, 0, 2] : type === 18 ? [120, 300, 7, 0, 0, 50, 0, 0] : type === FX_RATE ? [0, 3, 0, 200] : type === FX_LFO ? [0, 3, 0, 200, 0, 100, 0, 0] : type === FX_MACRO ? [macroNo, 0, 0] : type === FX_FOLLOW ? [10, 200, 50, -40] : type === FX_COMP ? [40, 100, 150, 6, 0] : type === FX_BANDS ? [250, 0, 0, 0, 0, 1, 0, 0] : type === FX_CARVE ? [20, 200, 20, 20000] : type === FX_MATCH ? [1, 12, 0] : type === FX_VOCODE ? [24, 10, 80] : type === FX_SHIFT ? [200, 0, 0] : type === FX_SMEAR ? [800, 0, 0] : type === FX_SIEVE ? [5, 80, 100] : type === FX_TUNE ? [0, 0, 20, 0, 50, 0] : type === FX_REPEAT ? [0, 3, 0, 200, -30, 0] : type === FX_ENV ? [10, 200, 70, 300, -30, 0] : type === FX_DRIFT ? [0, 3, 0, 200, 60, 100, 0, 0] : type === FX_PULSE ? [0, 1, 0, 200, 8, 3, 0, 50] : [0, 0, 0]   // follow: 10 ms up, 200 ms down, sense in the middle, hears from -40 dB; arp: octave steps; harmony: C major, a third; grain: 120 ms, 300 ms spray, 7 st in C major, pan 50; rate: sync, 1/4, straight, 2 hz; lfo: the same, not random, full depth
/** A new print's flavour: a cut begins as a low pass, open. */
export const variantOf = (type: number) => (type === 7 ? 1 : 0)

/* ── the clock's words ── */
export const DIV_LABELS = ['1/16', '1/8t', '1/8', '1/8.', '1/4', '1/4.', '1/2', '1/32']   // 1/32 came later and sits last, so old patches keep their index; DIV_ORDER lists them as music does
export const DIV_ORDER = [7, 0, 1, 2, 3, 4, 5, 6]
export const RATE_DIVS = ['1/32', '1/16', '1/8', '1/4', '1/2', '1/1', '2/1', '4/1']
export const RATE_FEEL = ['straight', 'dotted', 'triplet']
export const KEY_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
export const STUTTER_LABELS = ['1/4', '1/8', '1/16', '1/32', '1/64']

/* ── the tremolo's shapes ── */
export const CURVE_LEN = 32
export function baseShape (variant: number, ph: number): number {
  switch (variant) {
    case 1: return 1 - 2 * Math.abs(ph - 0.5)
    case 2: return ph < 0.5 ? 0 : 1        // square: the dip comes first
    case 3: return ph < 0.25 ? 0 : 1       // pulse: a short dip
    case 4: return ph                      // saw: rises, drops
    default: return 0.5 + 0.5 * Math.cos(2 * Math.PI * ph)
  }
}
/** Shape presets (after Tremolator's rhythm library): each is one cycle
 *  as 32 points, 1 = loud. A preset writes the node's curve. */
export const TREM_PRESETS: Array<{ name: string; curve: () => number[] }> = (() => {
  const pts = (f: (ph: number) => number) => Array.from({ length: CURVE_LEN }, (_, i) => Math.min(1, Math.max(0, f(i / CURVE_LEN))))
  const steps = (pattern: number[]) => pts(ph => pattern[Math.floor(ph * pattern.length)] ?? 0)
  const gate = (pattern: number[], width = 0.6) => pts(ph => { const k = ph * pattern.length; const i = Math.floor(k); return pattern[i] && (k - i) < width ? 1 : 0 })
  return [
    { name: 'sine', curve: () => pts(ph => baseShape(0, ph)) },
    { name: 'triangle', curve: () => pts(ph => baseShape(1, ph)) },
    { name: 'square', curve: () => pts(ph => baseShape(2, ph)) },
    { name: 'pulse', curve: () => pts(ph => baseShape(3, ph)) },
    { name: 'saw', curve: () => pts(ph => baseShape(4, ph)) },
    { name: 'eighths', curve: () => gate([1, 1, 1, 1, 1, 1, 1, 1], 0.55) },
    { name: 'sixteenths', curve: () => gate(new Array(16).fill(1), 0.5) },
    { name: '3-3-2', curve: () => gate([1, 0, 0, 1, 0, 0, 1, 0], 0.9) },
    { name: 'gallop', curve: () => gate([1, 0, 1, 1, 1, 0, 1, 1], 0.7) },
    { name: 'swing', curve: () => pts(ph => { const k = ph * 4; const i = Math.floor(k); const f = k - i; return f < (i % 2 ? 0.45 : 0.65) ? 1 : 0.15 }) },
    { name: 'offbeat', curve: () => gate([0, 1, 0, 1, 0, 1, 0, 1], 0.6) },
    { name: 'breath', curve: () => pts(ph => Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * ph), 2.2)) },
    { name: 'stairs', curve: () => steps([1, 0.75, 0.5, 0.25, 1, 0.75, 0.5, 0.25]) },
    { name: 'random', curve: () => { let s = 7; return steps(Array.from({ length: 8 }, () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return 0.2 + (s % 1000) / 1250 })) } },
  ]
})()

/* ── the lfo's shapes ──
   A shape is a row of points; between two points the line is straight until its bend bows it. Stored flat as
   [x, y, bend, x, y, bend, …] with x and y in 0..1 (y up) and bend in -1..1 for the stretch that follows the point. Two
   points on one x are a cliff: the hand the lfo plays jumps there. `steps` and `random` are not drawn as these are. */
const B = 0.2071   // the bend that makes a quarter of a sine out of a straight stretch
export const LFO_SHAPES: Array<{ name: string; pts: number[] | null }> = [
  { name: 'sine',     pts: [0, 0.5, B, 0.25, 1, B, 0.5, 0.5, -B, 0.75, 0, -B, 1, 0.5, 0] },
  { name: 'triangle', pts: [0, 0.5, 0, 0.25, 1, 0, 0.75, 0, 0, 1, 0.5, 0] },
  { name: 'saw up',   pts: [0, 0, 0, 1, 1, 0] },
  { name: 'saw down', pts: [0, 1, 0, 1, 0, 0] },
  { name: 'square',   pts: [0, 1, 0, 0.5, 1, 0, 0.5, 0, 0, 1, 0, 0] },
  { name: 'pulse',    pts: [0, 1, 0, 0.25, 1, 0, 0.25, 0, 0, 1, 0, 0] },
  { name: 'stairs',   pts: [0, 0, 0, 0.25, 0, 0, 0.25, 1 / 3, 0, 0.5, 1 / 3, 0, 0.5, 2 / 3, 0, 0.75, 2 / 3, 0, 0.75, 1, 0, 1, 1, 0] },
  { name: 'steps',    pts: null },   // a step sequencer: as many steps as you like, each at the height you drag it to (aux 6 = how many)
  { name: 'random',   pts: null },
]
export const LFO_RANDOM = LFO_SHAPES.length - 1
export const LFO_STEPS = LFO_SHAPES.length - 2
/** The stairs of `heights` as points: each step two points, a cliff between neighbours (the engine reads a cliff as a jump). */
export function stepsToPts (heights: number[]): number[] {
  const n = heights.length, out: number[] = []
  for (let k = 0; k < n; k++) out.push(k / n, heights[k], 0, (k + 1) / n, heights[k], 0)
  return out
}
/** The heights back out of a stairs shape (every second point). */
export function ptsToSteps (pts: number[], count: number): number[] {
  const n = pts.length / 6
  return Array.from({ length: count }, (_, k) => (k < n ? pts[k * 6 + 1] : 0.5))
}
export const SINE_PTS: number[] = LFO_SHAPES[0].pts!
/** y at x along the shape: straight stretches, each bowed by its bend. At a cliff (two points on one x) the value is the one after it. The engine reads the shape the same way. */
export function shapeAt (pts: number[], x: number): number {
  const n = pts.length / 3
  if (n === 0) return 0.5
  if (n === 1) return pts[1]
  for (let i = 0; i < n - 1; i++) {
    const x0 = pts[i * 3], y0 = pts[i * 3 + 1], b = pts[i * 3 + 2], x1 = pts[(i + 1) * 3], y1 = pts[(i + 1) * 3 + 1]
    if (x < x0) return y0
    if (x < x1 || i === n - 2) {
      const t = x1 > x0 ? Math.min(1, Math.max(0, (x - x0) / (x1 - x0))) : 1
      // the bow: the middle follows the finger, the ends stay put
      return Math.min(1, Math.max(0, y0 + (y1 - y0) * t + b * 0.5 * 4 * t * (1 - t)))
    }
  }
  return pts[(n - 1) * 3 + 1]
}
/** The shape as a table (the wall's small pictures use it; the engine makes its own, finer, from the points). */
export function sampleShape (pts: number[], count = 64): number[] {
  return Array.from({ length: count }, (_, i) => shapeAt(pts, i / count))
}
/** random: the value of one step — the engine's own arithmetic, so what is drawn is what is played. */
export function randomStep (slot: number, cycle: number, steps: number, k: number): number {
  const step = cycle * steps + k
  let h = (Math.imul(step | 0, 2654435761 | 0) ^ ((slot * 40503 + 12345) >>> 0)) >>> 0
  h ^= h >>> 15; h = Math.imul(h, 2246822519 | 0) >>> 0; h ^= h >>> 13; h = Math.imul(h, 3266489917 | 0) >>> 0; h ^= h >>> 16
  return ((h >>> 0) & 0xffffff) / 0xffffff
}

/* how the shape is drawn by hand: one rule for every wall that draws it (Patch on Slur's study, Slur Studio's) */
/** A new point where the empty grid was pressed: the points as they are then, and which is the new one. */
export function lfoAddPoint (pts: number[], p: { x: number; y: number }): { pts: number[]; i: number } {
  const n = pts.length / 3, next = [...pts]
  let at = n
  for (let i = 0; i < n; i++) if (pts[i * 3] > p.x) { at = i; break }
  next.splice(at * 3, 0, p.x, p.y, 0)
  return { pts: next, i: at }
}
/** A point dragged: as far as its neighbours, and onto them (two points on one x are a cliff); the two ends are the seam of the
 *  loop — ends that meet stay together, ends drawn apart move alone, one brought level with the other joins it; `alone` moves an end alone. */
export function lfoMovePoint (pts: number[], i: number, p: { x: number; y: number }, alone = false): number[] {
  const n = pts.length / 3, next = [...pts]
  const lo = i === 0 ? 0 : pts[(i - 1) * 3], hi = i === n - 1 ? 1 : pts[(i + 1) * 3]
  let x = i === 0 ? 0 : i === n - 1 ? 1 : Math.min(hi, Math.max(lo, p.x))
  // close to a neighbour it takes that neighbour's x exactly (a true vertical, not a steep slope)
  if (i > 0 && i < n - 1) { if (x - lo < 0.012) x = lo; else if (hi - x < 0.012) x = hi }
  next[i * 3] = x
  next[i * 3 + 1] = p.y
  if (i === 0 || i === n - 1) {
    const o = i === 0 ? n - 1 : 0
    const joined = Math.abs(pts[i * 3 + 1] - pts[o * 3 + 1]) < 1e-4
    if (alone) { /* alone */ }
    else if (joined) next[o * 3 + 1] = p.y
    else if (Math.abs(p.y - pts[o * 3 + 1]) < 0.03) next[i * 3 + 1] = pts[o * 3 + 1]
  }
  return next
}
/** A stretch's bend, from where its hollow middle point was dragged to (y, 0..1). */
export function lfoBend (pts: number[], i: number, y: number): number[] {
  const next = [...pts], y0 = pts[i * 3 + 1], y1 = pts[(i + 1) * 3 + 1]
  next[i * 3 + 2] = Math.min(1, Math.max(-1, (y - (y0 + y1) / 2) / 0.5))
  return next
}
/** A point taken away (not an end). */
export const lfoRemovePoint = (pts: number[], i: number): number[] => { const n = pts.length / 3; if (i === 0 || i === n - 1) return pts; const next = [...pts]; next.splice(i * 3, 3); return next }
/** A step sequencer: the step under x takes the height y. */
export function lfoSetStep (pts: number[], steps: number, p: { x: number; y: number }): number[] {
  const k = Math.min(steps - 1, Math.floor(p.x * steps))
  const h = ptsToSteps(pts, steps); h[k] = p.y
  return stepsToPts(h)
}
/** The drawn line, as a list of points (x, y in 0..1): each stretch sampled, a cliff drawn as the vertical it is. */
export function lfoLine (pts: number[]): Array<[number, number]> {
  const n = pts.length / 3, out: Array<[number, number]> = [[pts[0], pts[1]]]
  for (let i = 0; i < n - 1; i++) {
    const x0 = pts[i * 3], x1 = pts[(i + 1) * 3]
    if (x1 - x0 < 1e-6) { out.push([x1, pts[(i + 1) * 3 + 1]]); continue }
    for (let k = 1; k <= 24; k++) {
      const t = k / 24, y0 = pts[i * 3 + 1], y1 = pts[(i + 1) * 3 + 1], b = pts[i * 3 + 2]
      out.push([x0 + (x1 - x0) * t, Math.min(1, Math.max(0, y0 + (y1 - y0) * t + b * 2 * t * (1 - t)))])
    }
  }
  return out
}

/* ── the bands' cuts ──
   A ruler of frequency, 20 Hz to 20 kHz, cut into bands: the cuts live in aux 0..4 (Hz), aux 5 says how many (up to
   five cuts, six bands), each band in its lane's colour (the colour its wire carries). */
export const BAND_RGB: Array<[number, number, number]> = [[232, 92, 74], [240, 156, 56], [236, 214, 84], [96, 208, 128], [72, 168, 255], [176, 120, 255]]   // low → high
export const MAX_CROSS = 5
const F0 = 20, F1 = 20000
export const fx = (hz: number) => Math.log(Math.max(F0, Math.min(F1, hz)) / F0) / Math.log(F1 / F0)   // 0..1 along the ruler
export const xf = (t: number) => F0 * Math.pow(F1 / F0, Math.max(0, Math.min(1, t)))
export const crossovers = (aux: number[]) => { const n = Math.max(1, Math.min(MAX_CROSS, aux[5] || 1)); return Array.from({ length: n }, (_, k) => aux[k] || 250).sort((a, b) => a - b) }
/** The cuts put back into the print's hands (sorted, the count in aux 5). */
export function bandsPut (aux: number[], cuts: number[]): number[] {
  const sorted = [...cuts].sort((a, b) => a - b)
  const out = [...aux]; while (out.length < 8) out.push(0)
  for (let k = 0; k < MAX_CROSS; k++) out[k] = sorted[k] ?? 0
  out[5] = sorted.length
  return out
}
/** A cut dragged to t (0..1 along the ruler): it stays a little clear of its neighbours. */
export function bandsMoveCut (cuts: number[], k: number, t: number): number[] {
  const lo = k > 0 ? cuts[k - 1] * 1.05 : F0, hi = k < cuts.length - 1 ? cuts[k + 1] / 1.05 : F1
  const next = [...cuts]; next[k] = Math.round(Math.max(lo, Math.min(hi, xf(t))))
  return next
}
/** A band split where it was double-clicked (up to five cuts); a cut taken away (one is always left). */
export const bandsSplit = (cuts: number[], t: number): number[] => cuts.length >= MAX_CROSS ? cuts : [...cuts, Math.round(xf(t))]
export const bandsJoin = (cuts: number[], k: number): number[] => cuts.length > 1 ? cuts.filter((_, i) => i !== k) : cuts

/* ── how a print's amount is said, and read back ── */
/** The reverb's real ring time, mirrored from the processor: the decay
 *  hand trims roomSize around each flavour's centre, roomSize sets the
 *  Freeverb comb feedback (0.7 + 0.28·rs), and −60 dB through the
 *  ~32 ms comb loop gives the seconds. Display only. */
export function fmtDecay (variant: number, d: number): string {
  const rs = variant === 0 ? Math.min(1, Math.max(0, 0.769 + d * 0.191))
    : variant === 1 ? Math.min(1, Math.max(0.02, 0.16 + (d - 0.5) * 0.44))
    : Math.min(1, Math.max(0, 0.50 + (d - 0.5) * 0.70))
  const g = 0.7 + 0.28 * rs
  const t = 0.096 / -Math.log10(g)
  return `${t >= 10 ? t.toFixed(1) : t.toFixed(2)}s`
}
/** A decay in seconds (as fmtDecay prints it), back to the 0..1 hand. */
export function parseDecay (variant: number, s: string): number | null {
  const t = parseLead(s); if (t === null || t <= 0) return null
  const g = Math.pow(10, -0.096 / t)
  const rs = (g - 0.7) / 0.28
  const d = variant === 0 ? (rs - 0.769) / 0.191 : variant === 1 ? (rs - 0.16) / 0.44 + 0.5 : (rs - 0.5) / 0.7 + 0.5
  return clamp(d, 0, 1)
}
export function fmtSwell (a: number): string { const T = 0.02 * Math.pow(75, a); return T < 1 ? `${Math.round(T * 1000)}ms` : `${T.toFixed(2)}s` }
export function fmtGate (a: number): string { const t = Math.round(-60 + a * 60); return t === 0 ? '0 dB' : `−${-t} dB` }
export function fmtRing (a: number): string { const hz = 20 * Math.pow(2, a * 8); return hz >= 1000 ? `${(hz / 1000).toFixed(2)}k` : `${Math.round(hz)}` }
/** A print's amount, said in its own unit. */
export function fmtValue (type: number, a: number, variant = 0): string {
  if (type === FX_MACRO) return `${Math.round(a * 100)}`
  if (type === 13) return `${Math.round(a * 24)}st`
  if (type === 16 || type === 17) { const st = Math.round((a - 0.5) * 24); return `${st > 0 ? '+' : ''}${st} st` }
  if (type === 0 || type === 3) { const t = Math.round((a - 0.5) * 200); return t === 0 ? '0' : t > 0 ? `+${t}` : `${t}` }
  if (type === 22) return fmtSwell(a)
  if (type === 23) return STUTTER_LABELS[Math.min(4, Math.floor(a * 5))]
  if (type === 25) return fmtRing(a)
  if (type === 26) return fmtGate(a)
  if (type === 5) { const db = a < 0.75 ? (a / 0.75 - 1) * 60 : (a - 0.75) * 48; return `${db > 0 ? '+' : db < 0 ? '−' : ''}${Math.abs(db).toFixed(1)}` }
  if (type === FX_COMP) return `${Math.round(-60 * a)} dB`
  if (type === FX_CARVE) return `${Math.round(-24 * a)} dB`
  if (type === FX_PAN) { const p = Math.round((a - 0.5) * 200); return p === 0 ? 'centre' : p < 0 ? `L ${-p}` : `R ${p}` }
  if (type === FX_FREEZE) return a > 0.5 ? 'held' : 'open'
  if (type === FX_SCENE) return a <= 0.005 ? 'A' : a >= 0.995 ? 'B' : `${Math.round(a * 100)} %`
  if (type === FX_SIEVE) { const keep = Math.max(1, Math.round(Math.pow(2, (1 - a) * 10))); return a < 0.004 ? 'all' : `${keep}` }
  if (type === FX_TUNE) return a < 0.004 ? 'off' : a >= 0.995 ? 'hard' : `${Math.round(2 + 400 * (1 - a) * (1 - a))} ms`
  if (type === 7) {
    if (variant === 2) return `${(0.3 + (1 - a) * 9).toFixed(1)}oct`
    const hz = variant === 0 ? 20 * Math.pow(1000, a) : 20000 * Math.pow(1000, -a)   // the engine's sweep: 20 Hz ↔ 20 kHz, more knob is more cut
    return hz >= 1000 ? `${(hz / 1000).toFixed(hz >= 10000 ? 1 : 2)}k hz` : `${Math.round(hz)} hz`
  }
  return `${Math.round(a * 100)}`
}
/** What was typed for the main hand, back to 0..1 — fmtValue's mirror. */
export function parseAmount (type: number, s: string, variant = 0): number | null {
  const t = s.trim().toLowerCase()
  if (type === 23) { const i = STUTTER_LABELS.indexOf(t); if (i >= 0) return i / 5 + 0.1 }
  // the amounts said in words are read as words first (a number would not be found in them)
  if (type === FX_FREEZE) return /^(held|hold|on|1)/.test(t) ? 1 : /^(open|off|0)/.test(t) ? 0 : null
  if (type === FX_SCENE) { if (t === 'a') return 0; if (t === 'b') return 1 }
  if (type === FX_SIEVE && t === 'all') return 0
  if (type === FX_TUNE) { if (t === 'off') return 0; if (t === 'hard') return 1 }
  if (type === FX_PAN) {
    if (t === 'c' || t === 'centre' || t === 'center') return 0.5
    const lr = /^([lr])\s*(\d*\.?\d+)/.exec(t); if (lr) return clamp((lr[1] === 'l' ? -1 : 1) * Number(lr[2]) / 200 + 0.5, 0, 1)
  }
  const v = parseLead(t); if (v === null) return null
  if (type === 13) return clamp(v / 24, 0, 1)
  if (type === 16 || type === 17) return clamp(v / 24 + 0.5, 0, 1)
  if (type === 0 || type === 3) return clamp(v / 200 + 0.5, 0, 1)
  if (type === 22) { const T = /s\s*$/.test(t) && !/ms\s*$/.test(t) ? v : v / 1000; return clamp(Math.log(Math.max(1e-6, T) / 0.02) / Math.log(75), 0, 1) }
  if (type === 23) return clamp(v, 0, 1)
  if (type === 25) return clamp(Math.log2(Math.max(1, v) / 20) / 8, 0, 1)
  if (type === 26) return clamp((v + 60) / 60, 0, 1)
  if (type === 5) return clamp(v < 0 ? (v / 60 + 1) * 0.75 : v / 48 + 0.75, 0, 1)
  if (type === FX_COMP) return clamp(-v / 60, 0, 1)
  if (type === FX_CARVE) return clamp(-v / 24, 0, 1)
  if (type === FX_SIEVE) return clamp(1 - Math.log2(Math.max(1, v)) / 10, 0, 1)
  if (type === FX_TUNE) return clamp(1 - Math.sqrt(Math.max(0, v - 2) / 400), 0, 1)
  if (type === FX_PAN) return clamp(v / 200 + 0.5, 0, 1)
  if (type === 7) {
    if (variant === 2) return clamp(1 - (v - 0.3) / 9, 0, 1)
    const hz = Math.max(1, v)   // ("2.5k" is 2500: parseLead reads the k)
    return clamp(variant === 0 ? Math.log(hz / 20) / Math.log(1000) : -Math.log(hz / 20000) / Math.log(1000), 0, 1)
  }
  return clamp(v / 100, 0, 1)
}

/* ── what a control wire can play ──
   The hands of each print a control wire lands on (an lfo, a macro, a follow… playing them), as the print shows them when
   a wire is held over it: its big knob first, then these. A mix's are its wires' shares and the bands' their cuts: the
   wall knows those (they hang on the wires). */
export const PLAY_HANDS: Record<number, Array<{ key: string; label: string }>> = {
  2: [{ key: 'decay', label: 'decay' }],
  10: [{ key: 'fb', label: 'feedback' }],
  13: [{ key: 'aux0', label: 'step' }],
  [FX_CARVE]: [{ key: 'aux0', label: 'attack' }, { key: 'aux1', label: 'release' }, { key: 'aux2', label: 'from' }, { key: 'aux3', label: 'to' }],
  [FX_MATCH]: [{ key: 'aux1', label: 'smooth' }],
  [FX_VOCODE]: [{ key: 'aux0', label: 'bands' }, { key: 'aux1', label: 'attack' }, { key: 'aux2', label: 'release' }],
  [FX_SHIFT]: [{ key: 'aux0', label: 'hz' }, { key: 'aux1', label: 'feedback' }],
  [FX_SMEAR]: [{ key: 'aux0', label: 'time' }, { key: 'aux1', label: 'blur' }],
  [FX_REPEAT]: [{ key: 'aux4', label: 'threshold' }],
  [FX_SIEVE]: [{ key: 'aux0', label: 'attack' }, { key: 'aux1', label: 'release' }, { key: 'aux2', label: 'mix' }],
  [FX_TUNE]: [{ key: 'aux2', label: 'humanize' }, { key: 'aux3', label: 'flex' }, { key: 'aux4', label: 'vibrato' }],
  [FX_COMP]: [{ key: 'aux0', label: 'ratio' }, { key: 'aux1', label: 'attack' }, { key: 'aux2', label: 'release' }, { key: 'aux3', label: 'knee' }, { key: 'aux4', label: 'makeup' }],
  15: [{ key: 'aux2', label: 'interval' }],
  16: [{ key: 'aux0', label: 'cents' }],
  18: [{ key: 'aux0', label: 'size' }, { key: 'aux1', label: 'spray' }, { key: 'aux2', label: 'scatter' }, { key: 'aux5', label: 'pan' }],
  22: [{ key: 'aux0', label: 'depth' }],
}
export const RATE_HANDS = [{ key: 'aux0', label: 'clock' }, { key: 'aux1', label: 'rate' }, { key: 'aux2', label: 'feel' }, { key: 'aux3', label: 'hz' }]
export const FOLLOW_HANDS = [{ key: 'aux0', label: 'attack' }, { key: 'aux1', label: 'release' }, { key: 'aux2', label: 'sense' }, { key: 'aux3', label: 'threshold' }]
export const ENV_HANDS = [{ key: 'aux0', label: 'attack' }, { key: 'aux1', label: 'decay' }, { key: 'aux2', label: 'sustain' }, { key: 'aux3', label: 'release' }, { key: 'aux4', label: 'threshold' }, { key: 'aux5', label: 'gate' }]   // gate: what lands here opens the envelope while it is up (wire mode)
export const LFO_HANDS = [...RATE_HANDS, { key: 'aux5', label: 'depth' }, { key: 'aux6', label: 'reset' }, { key: 'decay', label: 'morph' }]
export const DRIFT_HANDS = [...RATE_HANDS, { key: 'aux4', label: 'smooth' }, { key: 'aux5', label: 'depth' }]
export const PULSE_HANDS = [...RATE_HANDS, { key: 'aux4', label: 'steps' }, { key: 'aux5', label: 'hits' }, { key: 'aux6', label: 'rotate' }, { key: 'aux7', label: 'length' }]   // reset: what lands here restarts the LFO when it rises (a follow's hit)
export const handsOfType = (type: number) => (type === FX_RATE ? RATE_HANDS : type === FX_LFO ? LFO_HANDS : type === FX_FOLLOW ? FOLLOW_HANDS : type === FX_ENV ? ENV_HANDS : type === FX_DRIFT ? DRIFT_HANDS : type === FX_PULSE ? PULSE_HANDS : type === FX_SCENE ? [{ key: 'amount', label: 'scene' }] : isUtilityType(type) ? [] : [{ key: 'amount', label: MAIN_HAND[type] ?? 'amount' }, ...(PLAY_HANDS[type] ?? [])])
/** A new control wire's depth: a macro, a follow, an env or a pulse pushes one way, the whole way; the rest swing half. */
export const newWireDepth = (fromType: number) => (fromType === FX_MACRO || fromType === FX_FOLLOW || fromType === FX_ENV || fromType === FX_PULSE ? 1 : 0.5)
/** Which prints play hands (their wires are control wires), which have no way in, which have a key, which are fittings. */
export { isControlType, playsHandsType, noInputType, hasKeyType, hasAmountType, isUtilityType, isSplitterType, outPortsOf, wireRef } from '../../lib/fxBridge'

/* ── the hands a print's study shows ──
   A gauge is pulled (or typed into); a choice is picked from its options; a switch is thrown. Each reads its value from the
   node (`get`, in the units it is said in), and gives back what a change writes into the node (`set`, a part of the node:
   only what changes). `at` names the node's field it lives in — the wall's automation and gestures go by it — and
   `when` says whether it is shown for this node. A gauge marked `liveDrag` changes the node while it is dragged and keeps it
   when let go (the rest keep every step). Fields that hang on the node (a label, a range) may be functions of it. */
type N = FxGraphNode
type Of<T> = T | ((n: N) => T)
export type HandAt = 'variant' | 'decay' | 'div' | 'fb' | 'amount' | 'pts' | 'pts2' | `aux${number}`   // pts, pts2: an lfo's drawn shape, and the one it morphs toward
export interface GaugeHand { kind: 'gauge'; key: string; label: Of<string>; at: HandAt; min: Of<number>; max: Of<number>; step?: number; def: Of<number>; unit?: string; fine?: number; bipolar?: boolean; liveDrag?: boolean
  get: (n: N) => number; set: (v: number, n: N) => Partial<N>; live?: (v: number) => number; format?: (v: number, n: N) => string; parse?: (s: string, n: N) => number | null; when?: (n: N) => boolean }
export interface ChoiceHand { kind: 'choice'; key: string; label: Of<string>; at: HandAt; options: Of<string[]>; fill?: boolean; list?: boolean; none?: string   // list: a drawer, however few; none: what it reads when nothing is chosen (-1)
  get: (n: N) => number; set: (k: number, n: N) => Partial<N>; when?: (n: N) => boolean }
export interface SwitchHand { kind: 'switch'; key: string; label: string; at: HandAt; get: (n: N) => boolean; set: (on: boolean, n: N) => Partial<N>; when?: (n: N) => boolean }
export type Hand = GaugeHand | ChoiceHand | SwitchHand
export const valueOf = <T,>(v: Of<T>, n: N): T => (typeof v === 'function' ? (v as (n: N) => T)(n) : v)

const aux8 = (n: N) => { const a = [...(n.aux || [])]; while (a.length < 8) a.push(0); return a }
const withAux = (n: N, k: number, v: number, extra?: (a: number[]) => void) => { const a = aux8(n); a[k] = v; extra?.(a); return { aux: a } }
const ms = (v: number) => `${Math.round(v)} ms`
const gauge = (key: string, label: Of<string>, k: number, read: (n: N) => number, min: Of<number>, max: Of<number>, def: Of<number>, o: Partial<GaugeHand> = {}): GaugeHand =>
  Object.assign({ kind: 'gauge' as const, key, label, at: `aux${k}` as HandAt, min, max, def, step: 1, get: read, set: (v: number, n: N) => withAux(n, k, Math.round(v)) }, o)
const choice = (key: string, label: Of<string>, k: number, options: Of<string[]>, read: (n: N) => number, o: Partial<ChoiceHand> = {}): ChoiceHand =>
  Object.assign({ kind: 'choice' as const, key, label, at: `aux${k}` as HandAt, options, get: read, set: (v: number, n: N) => withAux(n, k, v) }, o)
const sw = (key: string, label: string, k: number): SwitchHand => ({ kind: 'switch', key, label, at: `aux${k}` as HandAt, get: n => !!(n.aux || [])[k], set: (on, n) => withAux(n, k, on ? 1 : 0) })
/** The study's own flavour row, for a print that has flavours and no row of its own for them. */
const flavourHand = (type: number): ChoiceHand => ({ kind: 'choice', key: 'variant', label: type === FX_MIX_TYPE ? 'mode' : VARIANT_LABEL[type] ?? 'mode', at: 'variant', options: flavoursOf(type), get: n => n.variant, set: v => ({ variant: v }) })
/** A division of the beat, stepped as music goes (1/32 up to 1/2). */
const divHand = (key: string, label: string, o: Partial<ChoiceHand> = {}): ChoiceHand => Object.assign({ kind: 'choice' as const, key, label, at: 'div' as HandAt, options: DIV_ORDER.map(i => DIV_LABELS[i]), fill: true, get: (n: N) => DIV_ORDER.indexOf(n.delayDiv), set: (v: number) => ({ delayDiv: DIV_ORDER[v] }) }, o)
const keyHands = (k: number, when?: (n: N) => boolean): ChoiceHand[] => [
  choice('key', 'key', k, KEY_NAMES, n => (((n.aux[k] || 0) % 12) + 12) % 12, { fill: true, when }),
  choice('scale', 'scale', k + 1, ['major', 'minor'], n => (n.aux[k + 1] || 0) === 1 ? 1 : 0, { when }),
]
/** A clock of its own: in time with the song, or so many times a second (repeat; Patch on Slur's control prints too). */
export const CLOCK_HANDS: Hand[] = [
  choice('mode', 'clock', 0, ['sync', 'hz'], n => n.aux[0] || 0),
  choice('div', 'rate', 1, RATE_DIVS, n => n.aux[1] ?? 3, { fill: true, when: n => (n.aux[0] || 0) === 0 }),
  choice('feel', 'feel', 2, RATE_FEEL, n => n.aux[2] || 0, { when: n => (n.aux[0] || 0) === 0 }),
  gauge('hz', 'hz', 3, n => (n.aux[3] || 200) / 100, 0.01, 20, 2, { step: 0.01, fine: 260, live: v => v / 100, format: v => `${v.toFixed(2)} hz`, set: (v, n) => withAux(n, 3, Math.round(v * 100)), when: n => (n.aux[0] || 0) !== 0 }),
]
const toPos = (hz: number) => 100 * Math.log(Math.max(20, Math.min(20000, hz)) / 20) / Math.log(1000), toHz = (pos: number) => Math.round(20 * Math.pow(1000, Math.max(0, Math.min(100, pos)) / 100))

/** Every print's hands, in the order its study shows them (with its flavour row where it has one; the mix's is its mode).
 *  What a hand cannot say as a number or a choice is the wall's own to draw: an lfo's drawn shape, a scene's taking of its
 *  snapshots, the bands' cuts, the mix's shares, and the ranges of what plays a hand. A print with no hand beyond its
 *  amount (a macro) has none here. */
export const STUDY_HANDS: Record<number, Hand[]> = (() => {
  const h: Record<number, Hand[]> = {}
  // every print with flavours shows them as a row of its own, but for those whose rows say them otherwise
  for (let t = 0; t <= 60; t++) if (flavoursOf(t).length && t !== 5 && t !== 7 && t !== 12 && t !== FX_COMP && t !== FX_FOLLOW && t !== FX_ENV) h[t] = [flavourHand(t)]
  const add = (type: number, ...more: Hand[]) => { h[type] = (h[type] || []).concat(more) }
  add(2, { kind: 'gauge', key: 'decay', label: 'decay', at: 'decay', min: 0, max: 1, step: 0.005, def: 0.5, get: n => n.decay[n.variant] ?? 0.5, liveDrag: true, set: (v, n) => { const d = [...n.decay]; d[n.variant] = v; return { decay: d } }, format: (d, n) => fmtDecay(n.variant, d), parse: (s, n) => parseDecay(n.variant, s) })
  add(10, divHand('time', 'time'), { kind: 'gauge', key: 'fb', label: 'feedback', at: 'fb', min: 0, max: 100, step: 1, unit: '%', def: 35, live: v => v * 100, liveDrag: true, get: n => Math.round(n.delayFb * 100), set: v => ({ delayFb: v / 100 }) })
  add(13, divHand('rate', 'rate'), gauge('step', 'step', 0, n => n.aux[0] || 12, 1, 12, 12, { unit: 'st', fine: 120, set: (v, n) => withAux(n, 0, v) }))
  { const chroma = (n: N) => n.variant === 1
    add(15, ...keyHands(0, n => n.variant !== 1),
      gauge('int', n => chroma(n) ? 'interval' : 'degrees', 2, n => n.aux[2] || 0, n => chroma(n) ? -12 : -7, n => chroma(n) ? 12 : 7, n => chroma(n) ? 7 : 2, { bipolar: true, fine: 140, format: (v, n) => `${v > 0 ? '+' : ''}${v}${chroma(n) ? ' st' : v === 0 ? ' unison' : ''}`, set: (v, n) => withAux(n, 2, v) })) }
  add(16, gauge('cents', 'cents', 0, n => n.aux[0] || 0, -100, 100, 0, { bipolar: true, format: v => `${v > 0 ? '+' : ''}${v} c`, set: (v, n) => withAux(n, 0, v) }), choice('engine', 'engine', 1, ['fine', 'live'], n => n.aux[1] || 0))
  add(17, choice('engine', 'engine', 0, ['fine', 'live'], n => n.aux[0] || 0))
  add(18,
    gauge('size', 'size', 0, n => n.aux[0] || 120, 10, 600, 120, { unit: 'ms', set: (v, n) => withAux(n, 0, v) }),
    gauge('spray', 'spray', 1, n => n.aux[1] || 0, 0, 1500, 300, { unit: 'ms', set: (v, n) => withAux(n, 1, v) }),
    gauge('scatter', 'scatter', 2, n => n.aux[2] || 0, 0, 24, 0, { unit: 'st', fine: 140, set: (v, n) => withAux(n, 2, v) }),
    choice('pmode', 'pitch', 6, ['key', 'intervals', 'cents', 'free'], n => n.aux[6] || 0),
    ...keyHands(3, n => (n.aux[6] || 0) === 0),
    divHand('rate', 'rate', { when: n => n.variant === 1 }),
    gauge('pan', 'pan', 5, n => n.aux[5] ?? 50, 0, 100, 50, { unit: '%', set: (v, n) => withAux(n, 5, v) }),
    sw('freeze', 'freeze', 7))
  add(22, gauge('depth', 'depth', 0, n => n.aux[1] === 1 ? n.aux[0] : 100, 0, 100, 100, { unit: '%', set: (v, n) => withAux(n, 0, v, a => { a[1] = 1 }) }))
  h[12] = [
    choice('shape', 'shape', 2, TREM_PRESETS.map(p => p.name), n => Math.min(TREM_PRESETS.length - 1, n.aux[2] || 0), { set: (pi, n) => ({ ...withAux(n, 2, pi), curve: TREM_PRESETS[pi].curve(), variant: Math.min(4, pi) }) }),
    choice('target', 'moves', 0, ['volume', 'pan'], n => n.aux[0] || 0),
    divHand('rate', 'rate'),
  ]
  h[7] = [
    { kind: 'choice', key: 'variant', label: 'pass', at: 'variant', options: ['low pass', 'high pass'], get: n => n.variant === 1 ? 0 : 1, set: k => ({ variant: k === 0 ? 1 : 0 }) },   // the engine's words are low (cut) and high (cut): a low cut is a high pass. Said here as passes, low first.
    choice('slope', 'slope', 0, ['12', '24', '36', '48'], n => (n.aux[0] >= 1 && n.aux[0] <= 4 ? n.aux[0] : 2) - 1, { fill: true, set: (k, n) => withAux(n, 0, k + 1) }),
  ]
  h[5] = [
    { kind: 'switch', key: 'phaseL', label: 'ø left', at: 'variant', get: n => (n.variant & 1) !== 0, set: (_, n) => ({ variant: n.variant ^ 1 }) },
    { kind: 'switch', key: 'phaseR', label: 'ø right', at: 'variant', get: n => (n.variant & 2) !== 0, set: (_, n) => ({ variant: n.variant ^ 2 }) },
  ]
  h[FX_COMP] = [
    { kind: 'choice', key: 'variant', label: 'detector', at: 'variant', options: ['peak', 'rms'], get: n => n.variant, set: v => ({ variant: v }) },
    gauge('ratio', 'ratio', 0, n => (n.aux[0] || 40) / 10, 1, 20, 4, { step: 0.1, live: v => v / 10, format: v => `${v.toFixed(1)}:1`, set: (v, n) => withAux(n, 0, Math.round(v * 10)) }),
    gauge('attack', 'attack', 1, n => (n.aux[1] || 100) / 10, 0.1, 100, 10, { step: 0.1, fine: 260, live: v => v / 10, format: v => `${v < 10 ? v.toFixed(1) : Math.round(v)} ms`, set: (v, n) => withAux(n, 1, Math.round(v * 10)) }),
    gauge('release', 'release', 2, n => n.aux[2] || 150, 10, 2000, 150, { fine: 320, format: ms }),
    gauge('knee', 'knee', 3, n => n.aux[3] ?? 6, 0, 24, 6, { step: 0.5, format: v => `${v.toFixed(1)} dB` }),
    gauge('makeup', 'makeup', 4, n => n.aux[4] || 0, 0, 24, 0, { step: 0.5, format: v => `+${v.toFixed(1)} dB` }),
  ]
  h[FX_CARVE] = [
    gauge('attack', 'attack', 0, n => n.aux[0] || 20, 1, 200, 20, { format: ms }),
    gauge('release', 'release', 1, n => n.aux[1] || 200, 20, 2000, 200, { fine: 320, format: ms }),
    // from / to: the range that is carved, on a log track (the gauge's unit is 0..100 along it)
    gauge('from', 'from', 2, n => toPos(n.aux[2] || 20), 0, 100, 0, { step: 0.5, fine: 400, live: toPos, format: v => `${fmtHz(toHz(v))} hz`, set: (v, n) => withAux(n, 2, toHz(v)), parse: s => { const v = parseLead(s); return v === null ? null : toPos(v) } }),
    gauge('to', 'to', 3, n => toPos(n.aux[3] || 20000), 0, 100, 100, { step: 0.5, fine: 400, live: toPos, format: v => `${fmtHz(toHz(v))} hz`, set: (v, n) => withAux(n, 3, toHz(v)), parse: s => { const v = parseLead(s); return v === null ? null : toPos(v) } }),
  ]
  h[FX_MATCH] = [gauge('smooth', 'smooth', 1, n => n.aux[1] || 12, 1, 48, 12, { format: v => `${Math.round(v)}` }), sw('learn', 'learn', 0)]   // learn on: the curve follows the key and the sound; off: it is kept
  h[FX_VOCODE] = [
    gauge('bands', 'bands', 0, n => n.aux[0] || 24, 8, 64, 24, { format: v => `${Math.round(v)}` }),
    gauge('attack', 'attack', 1, n => n.aux[1] || 10, 1, 200, 10, { format: ms }),
    gauge('release', 'release', 2, n => n.aux[2] || 80, 10, 2000, 80, { fine: 320, format: ms }),
  ]
  h[FX_SHIFT] = [
    gauge('shz', 'hz', 0, n => n.aux[0] || 0, -2000, 2000, 0, { bipolar: true, fine: 400, format: v => `${v > 0 ? '+' : ''}${Math.round(v)} hz` }),
    gauge('sfb', 'feedback', 1, n => n.aux[1] || 0, 0, 95, 0, { unit: '%' }),
  ]
  h[FX_SMEAR] = [gauge('stime', 'time', 0, n => n.aux[0] || 800, 50, 5000, 800, { step: 10, fine: 320, format: ms }), gauge('blur', 'blur', 1, n => n.aux[1] || 0, 0, 100, 0, { unit: '%' })]
  h[FX_SIEVE] = [
    gauge('attack', 'attack', 0, n => n.aux[0] || 5, 1, 200, 5, { format: ms }),
    gauge('release', 'release', 1, n => n.aux[1] || 80, 20, 2000, 80, { fine: 320, format: ms }),
    gauge('smix', 'mix', 2, n => n.aux[2] ?? 100, 0, 100, 100, { unit: '%' }),
  ]
  add(FX_TUNE,
    choice('key', 'key', 0, KEY_NAMES, n => (((n.aux[0] || 0) % 12) + 12) % 12, { fill: true, when: n => (n.aux[1] || 0) !== 2 }),
    choice('scale', 'scale', 1, ['major', 'minor', 'chromatic'], n => Math.min(2, Math.max(0, n.aux[1] || 0))),
    gauge('humanize', 'humanize', 2, n => n.aux[2] ?? 20, 0, 100, 20, { unit: '%' }),   // slows the pull once a note has settled: long notes keep their life
    gauge('flex', 'flex', 3, n => n.aux[3] || 0, 0, 100, 0, { unit: '%' }),              // leaves a pitch far from any note (a slide, a bend) alone
    gauge('vibrato', 'vibrato', 4, n => n.aux[4] ?? 50, 0, 100, 50, { unit: '%' }),      // how much of the voice's own quiver is kept
    choice('engine', 'engine', 5, ['fine', 'live'], n => n.aux[5] || 0))
  h[FX_REPEAT] = [...CLOCK_HANDS, gauge('threshold', 'threshold', 4, n => n.aux[4] || -30, -60, -1, -30, { format: v => `${Math.round(v)} dB` })]
  h[FX_FREEZE] = [{ kind: 'switch', key: 'hold', label: 'hold', at: 'amount', get: n => n.amount > 0.5, set: on => ({ amount: on ? 1 : 0 }) }]   // the knob is this switch: a wire on it (an lfo's square, a follow) throws it
  /* the control prints: what plays other prints' hands */
  const round = (v: number) => `${Math.round(v)}`
  const depth = gauge('lfodepth', 'depth', 5, n => n.aux[5] ?? 100, 0, 100, 100, { unit: '%' })
  {
    const isRandom = (n: N) => (n.aux[4] || 0) > 0, isSteps = (n: N) => !isRandom(n) && n.variant === LFO_STEPS
    const toShapes = LFO_SHAPES.filter(sh => sh.pts)
    const morphOf = (n: N) => n.pts2 ? toShapes.findIndex(sh => sh.pts!.length === n.pts2!.length && sh.pts!.every((v, i) => Math.abs(v - n.pts2![i]) < 1e-6)) : -1
    h[FX_LFO] = [
      { kind: 'choice', key: 'shape', label: 'shape', at: 'variant', list: true, none: 'drawn', options: LFO_SHAPES.map(sh => sh.name), get: n => isRandom(n) ? LFO_RANDOM : n.variant,
        set: (k, n) => {
          const aux = aux8(n); const sh = LFO_SHAPES[k]
          if (k === LFO_RANDOM) { aux[4] = aux[4] || 8; return { variant: k, aux } }
          aux[4] = 0
          if (k === LFO_STEPS) { aux[6] = aux[6] || 8; return { variant: k, aux, pts: stepsToPts(Array.from({ length: aux[6] }, (_, i) => i / Math.max(1, aux[6] - 1))) } }
          return { pts: [...sh.pts!], variant: k, aux }
        } },
      gauge('steps', 'steps', 4, n => n.aux[4] || 8, 1, 32, 8, { format: round, set: (v, n) => withAux(n, 4, Math.max(1, Math.round(v))), when: isRandom }),
      // the morph: a second shape the lfo leans toward, as far as its `morph` hand says (a macro can play it)
      { kind: 'choice', key: 'morphto', label: 'morph to', at: 'pts2', list: true, none: 'none', options: toShapes.map(sh => sh.name), get: morphOf,
        set: (k, n) => { const cur = morphOf(n); return { pts2: k < 0 || k === cur ? undefined : [...toShapes[k].pts!], ...(cur < 0 && k >= 0 ? { decay: [0, 0, 0] } : {}) } },   // (a shape picked fresh starts unmorphed: the hand at 0)
        when: n => !isRandom(n) && !isSteps(n) },
      { kind: 'gauge', key: 'morph', label: 'morph', at: 'decay', min: 0, max: 100, step: 1, unit: '%', def: 0, live: v => v * 100, liveDrag: true,
        get: n => Math.round((n.decay[Math.max(0, Math.min(2, n.variant))] ?? 0) * 100), set: v => ({ decay: [v / 100, v / 100, v / 100] }), when: n => !isRandom(n) && !isSteps(n) && !!n.pts2 },
      gauge('nsteps', 'steps', 6, n => n.aux[6] || 8, 2, 32, 8, { format: round, when: isSteps,
        set: (v, n) => { const c = Math.max(2, Math.round(v)); return { ...withAux(n, 6, c), pts: stepsToPts(ptsToSteps(n.pts ?? SINE_PTS, c)) } } }),
      ...CLOCK_HANDS, depth,
    ]
  }
  h[FX_RATE] = [...CLOCK_HANDS]
  h[FX_DRIFT] = [...CLOCK_HANDS, gauge('dsmooth', 'smooth', 4, n => n.aux[4] ?? 60, 0, 100, 60, { unit: '%' }), depth]
  h[FX_PULSE] = [...CLOCK_HANDS,
    gauge('psteps', 'steps', 4, n => n.aux[4] || 8, 1, 32, 8, { format: round, set: (v, n) => withAux(n, 4, Math.max(1, Math.round(v))) }),
    gauge('hits', 'hits', 5, n => n.aux[5] ?? 3, 0, n => n.aux[4] || 8, 3, { format: round }),
    gauge('rotate', 'rotate', 6, n => n.aux[6] || 0, 0, n => Math.max(0, (n.aux[4] || 8) - 1), 0, { format: round }),
    gauge('length', 'length', 7, n => n.aux[7] || 50, 1, 100, 50, { unit: '%' })]
  // follow — envelope: the level, through attack and release; transient: a hit, the value leaps to full and falls at the release
  h[FX_FOLLOW] = [
    { kind: 'choice', key: 'variant', label: 'mode', at: 'variant', options: ['envelope', 'transient'], get: n => n.variant, set: v => ({ variant: v }) },
    gauge('attack', 'attack', 0, n => n.aux[0] || 10, 1, 500, 10, { format: ms }),
    gauge('release', 'release', 1, n => n.aux[1] || 200, 5, 2000, 200, { format: ms }),
    gauge('sense', 'sense', 2, n => n.aux[2] ?? 50, 0, 100, 50, { format: round }),
    gauge('threshold', 'threshold', 3, n => n.aux[3] || -40, -60, -1, -40, { format: v => `${Math.round(v)} dB` })]
  // env — level: it opens when the sound it hears is over the threshold; wire: when what lands on `gate` is up
  h[FX_ENV] = [
    { kind: 'choice', key: 'variant', label: 'opened by', at: 'variant', options: ['level', 'wire'], get: n => n.variant, set: v => ({ variant: v }) },
    gauge('attack', 'attack', 0, n => n.aux[0] || 10, 1, 5000, 10, { fine: 320, format: ms }),
    gauge('edecay', 'decay', 1, n => n.aux[1] || 200, 1, 5000, 200, { fine: 320, format: ms }),
    gauge('sustain', 'sustain', 2, n => n.aux[2] ?? 70, 0, 100, 70, { unit: '%' }),
    gauge('release', 'release', 3, n => n.aux[3] || 300, 1, 10000, 300, { fine: 320, format: ms }),
    gauge('threshold', 'threshold', 4, n => n.aux[4] || -30, -60, -1, -30, { format: v => `${Math.round(v)} dB`, when: n => n.variant === 0 })]
  return h
})()
/** The hands a print shows for this node, in order. */
export const studyHandsOf = (n: N): Hand[] => (STUDY_HANDS[n.type] || []).filter(x => !x.when || x.when(n))
