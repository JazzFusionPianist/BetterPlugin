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
  FX_VOCODE, FX_FREEZE, FX_SHIFT, FX_SMEAR, FX_PAN, FX_REPEAT, FX_ENV, FX_FOLD, FX_DRIFT, FX_PULSE, FX_SCENE, FX_SIEVE,
  type FxMode, type FxGraphNode,
} from '../../lib/fxBridge'

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
export const nameOf = (type: number) => (type === FX_MIX_TYPE ? 'mix' : type === FX_SPLIT_LR ? 'L/R' : type === FX_SPLIT_MS ? 'M/S' : type === FX_LFO ? 'LFO' : type === FX_RATE ? 'rate' : type === FX_MACRO ? 'macro' : type === FX_SIDE ? 'side' : type === FX_FOLLOW ? 'follow' : type === FX_COMP ? 'comp' : type === FX_BANDS ? 'bands' : type === FX_CARVE ? 'carve' : type === FX_MATCH ? 'match' : type === FX_VOCODE ? 'vocode' : type === FX_FREEZE ? 'freeze' : type === FX_SHIFT ? 'shift' : type === FX_SMEAR ? 'smear' : type === FX_PAN ? 'pan' : type === FX_REPEAT ? 'repeat' : type === FX_ENV ? 'env' : type === FX_FOLD ? 'fold' : type === FX_DRIFT ? 'drift' : type === FX_PULSE ? 'pulse' : type === FX_SCENE ? 'scene' : type === FX_SIEVE ? 'sieve' : MODES.find(m => m.id === type)?.name ?? '')   // the splitters are the one word in capitals: they name the channels
/** The shelf's families: one row of prints at a time. */
export const FAMILIES: Array<[string, string[]]> = [
  ['tone', ['cut', 'amp', 'tone', 'tape', 'glue', 'comp', 'air']],
  ['grit', ['crush', 'radio', 'ring', 'fold']],
  ['space', ['delay', 'space', 'shimmer', 'doubler', 'stereo']],
  ['motion', ['mod', 'tremolo', 'swell', 'stutter', 'gate', 'wow', 'repeat']],
  ['pitch', ['pitch', 'formant', 'harmony', 'arp', 'grain']],
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
export const NEW_VARIANTS: Record<number, string[]> = { [FX_ENV]: ['level', 'wire'], [FX_FOLD]: ['sine', 'triangle'] }
export const flavoursOf = (type: number) => (type === FX_MIX_TYPE ? ['blend', 'sum'] : VARIANTS[type] ?? NEW_VARIANTS[type] ?? [])
/** What each print's flavours are called in its study. */
export const VARIANT_LABEL: Record<number, string> = { 1: 'drive', 2: 'room', 6: 'kind', 7: 'pass', 8: 'stage', 9: 'spread', 10: 'type', 13: 'order', 14: 'band', 15: 'mode', 16: 'mode', 18: 'mode', 20: 'target', 21: 'interval', 22: 'floor', 23: 'grid', 24: 'mode', 25: 'mode', 26: 'release', 27: 'motion' }
/** The prints with a second way in, the key: what their detector listens to. */
export { hasKeyType } from '../../lib/fxBridge'
/** The prints that can drop their dry sound (wet only). */
export const WET_TYPES = new Set<number>([2, 10, 9, 6, 15, 18, 21])   // space, delay, doubler, mod, harmony, grain, shimmer

/* ── where a new print rests ── */
/** A new print's amount: tone, stereo, pitch, formant and pan rest in the middle, gain at unity. */
/** What a print's big knob is, where "amount" would be vague. */
export const MAIN_HAND: Record<number, string> = { 7: 'cutoff', [FX_COMP]: 'threshold', [FX_CARVE]: 'depth', [FX_PAN]: 'pan', [FX_FOLD]: 'drive', [FX_FREEZE]: 'hold', [FX_SIEVE]: 'keep', [FX_SHIFT]: 'mix', [FX_SMEAR]: 'mix', [FX_REPEAT]: 'mix' }
export const neutralOf = (type: number) => (type === 0 || type === 3 || type === 16 || type === 17 || type === FX_PAN ? 0.5 : type === 5 ? 0.75 : 0)
/** A new print's other hands (a macro's are its number, given by the wall). */
export const auxOf = (type: number, macroNo = 0): number[] => type === 7 ? [2, 0, 0] : type === 13 ? [12, 0, 0] : type === 15 ? [0, 0, 2] : type === 18 ? [120, 300, 7, 0, 0, 50, 0, 0] : type === FX_RATE ? [0, 3, 0, 200] : type === FX_LFO ? [0, 3, 0, 200, 0, 100, 0, 0] : type === FX_MACRO ? [macroNo, 0, 0] : type === FX_FOLLOW ? [10, 200, 50, -40] : type === FX_COMP ? [40, 100, 150, 6, 0] : type === FX_BANDS ? [250, 0, 0, 0, 0, 1, 0, 0] : type === FX_CARVE ? [20, 200, 20, 20000] : type === FX_MATCH ? [1, 12, 0] : type === FX_VOCODE ? [24, 10, 80] : type === FX_SHIFT ? [200, 0, 0] : type === FX_SMEAR ? [800, 0, 0] : type === FX_SIEVE ? [5, 80, 100] : type === FX_REPEAT ? [0, 3, 0, 200, -30, 0] : type === FX_ENV ? [10, 200, 70, 300, -30, 0] : type === FX_DRIFT ? [0, 3, 0, 200, 60, 100, 0, 0] : type === FX_PULSE ? [0, 1, 0, 200, 8, 3, 0, 50] : [0, 0, 0]   // follow: 10 ms up, 200 ms down, sense in the middle, hears from -40 dB; arp: octave steps; harmony: C major, a third; grain: 120 ms, 300 ms spray, 7 st in C major, pan 50; rate: sync, 1/4, straight, 2 hz; lfo: the same, not random, full depth
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
  if (type === FX_PAN) return clamp(v / 200 + 0.5, 0, 1)
  if (type === 7) {
    if (variant === 2) return clamp(1 - (v - 0.3) / 9, 0, 1)
    const hz = Math.max(1, v)   // ("2.5k" is 2500: parseLead reads the k)
    return clamp(variant === 0 ? Math.log(hz / 20) / Math.log(1000) : -Math.log(hz / 20000) / Math.log(1000), 0, 1)
  }
  return clamp(v / 100, 0, 1)
}

/* ── the hands a print's study shows ──
   A gauge is pulled (or typed into); a choice is picked from its options; a switch is thrown. Each reads its value from the
   node (`get`, in the units it is said in), and gives back what a change writes into the node (`set`, a part of the node:
   only what changes). `at` names the node's field it lives in — the wall's automation and gestures go by it — and
   `when` says whether it is shown for this node. A gauge marked `liveDrag` changes the node while it is dragged and keeps it
   when let go (the rest keep every step). Fields that hang on the node (a label, a range) may be functions of it. */
type N = FxGraphNode
type Of<T> = T | ((n: N) => T)
export type HandAt = 'variant' | 'decay' | 'div' | 'fb' | 'amount' | `aux${number}`
export interface GaugeHand { kind: 'gauge'; key: string; label: Of<string>; at: HandAt; min: Of<number>; max: Of<number>; step?: number; def: Of<number>; unit?: string; fine?: number; bipolar?: boolean; liveDrag?: boolean
  get: (n: N) => number; set: (v: number, n: N) => Partial<N>; live?: (v: number) => number; format?: (v: number, n: N) => string; parse?: (s: string, n: N) => number | null; when?: (n: N) => boolean }
export interface ChoiceHand { kind: 'choice'; key: string; label: Of<string>; at: HandAt; options: Of<string[]>; fill?: boolean
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

/** Every sound print's hands, in the order its study shows them (with its flavour row where it has one; the mix's is its
 *  mode). The control prints (LFO, rate, macro, follow, env, drift, pulse, scene), the mix's shares and the bands are drawn
 *  by Patch on Slur's wall itself (the clock's rows are CLOCK_HANDS); a print with no hand beyond its amount has none here. */
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
  h[FX_REPEAT] = [...CLOCK_HANDS, gauge('threshold', 'threshold', 4, n => n.aux[4] || -30, -60, -1, -30, { format: v => `${Math.round(v)} dB` })]
  h[FX_FREEZE] = [{ kind: 'switch', key: 'hold', label: 'hold', at: 'amount', get: n => n.amount > 0.5, set: on => ({ amount: on ? 1 : 0 }) }]   // the knob is this switch: a wire on it (an lfo's square, a follow) throws it
  return h
})()
/** The hands a print shows for this node, in order. */
export const studyHandsOf = (n: N): Hand[] => (STUDY_HANDS[n.type] || []).filter(x => !x.when || x.when(n))
