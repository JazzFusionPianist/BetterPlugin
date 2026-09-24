/*  The prints, in the Slur design (draft "prints-draft", 2026-09-24).

    Each print is its family's flat plate in one tint with the print's own picture inside in paper ink — or, for the
    spectral prints, a set of bars that IS the picture, and for the utilities a fitting drawn in the tint with no plate.
    Everything is drawn in the plate's unit space: the plate spans −1..1, a motion plate leans to ±1.25, the bars reach 1.14.
    `printInner` gives the SVG inside a `viewBox="-1 -1 2 2"` (overflow visible), so a plate of radius 1 is half the print's size. */

import {
  FX_MIX_TYPE, FX_SPLIT_LR, FX_SPLIT_MS, FX_LFO, FX_RATE, FX_MACRO, FX_SIDE, FX_FOLLOW, FX_COMP, FX_BANDS, FX_CARVE, FX_MATCH, FX_VOCODE,
  FX_FREEZE, FX_SHIFT, FX_SMEAR, FX_PAN, FX_REPEAT, FX_ENV, FX_FOLD, FX_DRIFT, FX_PULSE, FX_SCENE, FX_SIEVE,
} from '../../lib/fxBridge'
import { shapeAt, SINE_PTS, randomStep } from './LfoEditor'

export const PAPER = '#FBFAF7'

export type Family = 'tone' | 'grit' | 'space' | 'motion' | 'pitch' | 'utility' | 'control' | 'spectral'

/** The family shapes, unit space (the web's diagram, plus grit from the plug-in's struck corners). */
export const SHAPE: Record<Family, string> = {
  tone: 'M -1 -1 H 1 V 1 H -1 Z',
  grit: 'M -1 -1 H .38 L 1 -.38 V 1 H -.38 L -1 .38 Z',
  space: 'M -1 0 A 1 1 0 1 0 1 0 A 1 1 0 1 0 -1 0 Z',
  motion: 'M -.6 -1 H 1.25 L .6 1 H -1.25 Z',
  pitch: 'M 0 -1.2 L 1.2 0 L 0 1.2 L -1.2 0 Z',
  utility: 'M -1 -.12 H 1 V .12 H -1 Z M -.12 -1 H .12 V 1 H -.12 Z',
  control: 'M -1 0 A 1 1 0 1 0 1 0 A 1 1 0 1 0 -1 0 Z M -.5 0 A .5 .5 0 1 1 .5 0 A .5 .5 0 1 1 -.5 0 Z',
  spectral: 'M -1 -1 H -.66 V 1 H -1 Z M -.4 -.5 H -.06 V 1 H -.4 Z M .2 -1 H .54 V 1 H .2 Z M .8 -.2 H 1.14 V 1 H .8 Z',
}
/** How far the plate reaches left and right of its centre (where the ports sit). */
export const REACH: Record<Family, number> = { tone: 1, grit: 1, space: 1, motion: 1.25, pitch: 1.2, utility: .74, control: 1, spectral: 1 }
/** The fittings and the bars are drawn smaller than a sound plate (the draft's proportions); the lines everywhere a little finer than
 *  the draft's, since the wall's prints are about twice the draft's size. */
const UTIL_SCALE = .7, SPEC_SCALE = .85, LINE = .6

/** Every print's tint, flat, as the draft set them (the web's 14 first, the rest near their family). */
export const PLATE_TINT: Record<number, string> = {
  7: '#E9C46A', 8: '#C95C3A', 0: '#F0B450', 1: '#D27A45', 4: '#6FB07A', [FX_COMP]: '#3FB872', 24: '#B8B4AA',
  20: '#9C7A5C', 14: '#B38F62', 25: '#D9A441', [FX_FOLD]: '#E06A48',
  10: '#4AA3A0', 2: '#5C80FF', 21: '#8FA8FF', 9: '#6C9AC8', 3: '#7FB3C8',
  6: '#A7B04A', 12: '#C2547A', 22: '#B48ACF', 23: '#C97B5C', 26: '#8C9E6C', 27: '#C8A05C', [FX_REPEAT]: '#E0A050',
  16: '#5C80FF', 17: '#F27BA6', 15: '#B79CFF', 13: '#3FB872', 18: '#E9C46A',
  5: '#FBFAF7', [FX_MIX_TYPE]: '#ECE2C8', [FX_SPLIT_LR]: '#FBFAF7', [FX_SPLIT_MS]: '#FBFAF7', [FX_PAN]: '#E6E2F0', [FX_BANDS]: '#ECD654', [FX_SIDE]: '#5CE0A8',
  [FX_LFO]: '#B79CFF', [FX_RATE]: '#FFA848', [FX_MACRO]: '#F27B5A', [FX_FOLLOW]: '#FFD660', [FX_ENV]: '#FFAC78', [FX_DRIFT]: '#AAC8FF', [FX_PULSE]: '#FF8C8C', [FX_SCENE]: '#F6E296',
  [FX_CARVE]: '#E0607E', [FX_MATCH]: '#78D8FF', [FX_VOCODE]: '#A58BF0', [FX_FREEZE]: '#96E8FF', [FX_SHIFT]: '#FF96D2', [FX_SMEAR]: '#BAC4FF', [FX_SIEVE]: '#FFD078',
  19: '#D9A0C8',   // voice
}
export const hexToRgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

// ── drawing helpers, unit space ──
const f3 = (v: number) => (Math.round(v * 1000) / 1000).toString()
const poly = (pts: Array<[number, number]>, close = false) => pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${f3(x)} ${f3(y)}`).join(' ') + (close ? ' Z' : '')
const wave = (x0: number, x1: number, y: number, amp: number, cycles: number, phase = 0, env?: (t: number) => number, n = 64) => {
  const pts: Array<[number, number]> = []
  for (let i = 0; i <= n; i++) { const t = i / n; const a = amp * (env ? env(t) : 1); pts.push([x0 + (x1 - x0) * t, y + a * Math.sin(phase + t * cycles * 2 * Math.PI)]) }
  return poly(pts)
}
const P = (d: string, w = .09, op = .95, dash?: string, cap = 'round') =>
  `<path d="${d}" fill="none" stroke="${PAPER}" stroke-opacity="${op}" stroke-width="${f3(w * LINE)}" stroke-linecap="${cap}" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`
const F = (d: string, op = .95) => `<path d="${d}" fill="${PAPER}" fill-opacity="${op}"/>`
const C = (cx: number, cy: number, r: number, fill = true, op = .95, w = .09) => fill
  ? `<circle cx="${f3(cx)}" cy="${f3(cy)}" r="${f3(r)}" fill="${PAPER}" fill-opacity="${op}"/>`
  : `<circle cx="${f3(cx)}" cy="${f3(cy)}" r="${f3(r)}" fill="none" stroke="${PAPER}" stroke-opacity="${op}" stroke-width="${f3(w * LINE)}"/>`
const R = (x: number, y: number, w: number, h: number, op = .95, fill = PAPER) => `<rect x="${f3(x)}" y="${f3(y)}" width="${f3(w)}" height="${f3(h)}" fill="${fill}" fill-opacity="${op}"/>`
const T = (x: number, y: number, s: string, size = .5, weight = 500, op = .95) =>
  `<text x="${f3(x)}" y="${f3(y)}" text-anchor="middle" font-family="'Space Mono', ui-monospace, monospace" font-weight="${weight}" font-size="${size}" fill="${PAPER}" fill-opacity="${op}">${s}</text>`

export interface GlyphNode { type: number; amount: number; variant: number; aux: number[]; pts?: number[]; sceneA?: number[]; sceneB?: number[] }

// ── the pictures, in paper, one per sound print (the plate spans −1..1) ──
const pictures: Record<number, (n: GlyphNode) => string> = {
  0: () => [-.6, -.45, -.3, -.15, 0, .15, .3, .45, .6].map(y => P(`M -.62 ${y} H .62`, .07)).join(''),   // tone
  7: (n) => n.variant === 0   // cut: high pass climbs, low pass falls
    ? P('M -.7 .75 C -.5 .7 -.4 .5 -.35 .3 C -.3 .1 -.25 -.1 -.05 -.1 H .7', .1)
    : P('M -.7 -.1 H .05 C .25 -.1 .3 .1 .35 .3 C .4 .5 .5 .7 .7 .75', .1),
  8: () => P(poly([[-.7, .45], [-.45, .45], [-.35, -.45], [-.05, -.45], [.05, .45], [.35, .45], [.45, -.45], [.7, -.45]]), .1),   // amp
  1: () => C(-.35, -.05, .3, false) + C(.35, -.05, .3, false) + C(-.35, -.05, .07) + C(.35, -.05, .07) + P('M -.62 .45 Q 0 .62 .62 .45', .08),   // tape
  4: () => P(wave(-.7, .7, 0, .55, 2, 0, t => 1 - .55 * t)) + P('M .2 -.3 H .72 M .2 .3 H .72', .06, .55),   // glue
  [FX_COMP]: () => P('M -.65 .65 L .0 .0 C .15 -.15 .35 -.22 .68 -.28', .1) + P('M -.65 .65 L .68 -.68', .05, .35, '.08 .1'),
  24: () => P(wave(-.7, .7, .15, .18, 1.2), .08) + [-.5, -.25, 0, .25, .5].map(x => P(`M ${x} -.35 V -.6`, .06) + C(x, -.7, .04)).join(''),   // air
  20: () => {   // crush: a staircase sine
    const pts: Array<[number, number]> = []
    for (let i = 0; i < 17; i++) { const t = i / 16; const v = Math.round(Math.sin(t * 2 * Math.PI) * 3) / 3 * .5; pts.push([-.7 + 1.4 * t, v]); pts.push([-.7 + 1.4 * (i + 1) / 16, v]) }
    pts.pop(); return P(poly(pts), .09, .95, undefined, 'butt')
  },
  14: () => P('M -.7 .5 H -.3 C -.15 .5 -.1 -.55 0 -.55 C .1 -.55 .15 .5 .3 .5 H .7', .1) + P('M -.7 .5 H .7', .05, .4, '.06 .08'),   // radio
  25: () => P(wave(-.7, .7, 0, .55, 5, 0, t => Math.sin(t * Math.PI * 2)), .08) + P(wave(-.7, .7, 0, .55, 1), .05, .4, '.06 .08'),   // ring
  [FX_FOLD]: () => {
    const pts: Array<[number, number]> = []
    for (let i = 0; i <= 64; i++) { const t = i / 64; const s = Math.sin(t * 2 * Math.PI) * 2.2; const tt = s * .5 + .25; const f = tt - Math.floor(tt); const y = f < .5 ? f * 4 - 1 : 3 - f * 4; pts.push([-.7 + 1.4 * t, -y * .5]) }
    return P(poly(pts)) + P('M -.7 -.5 H .7 M -.7 .5 H .7', .04, .35, '.06 .08')
  },
  10: () => Array.from({ length: 7 }, (_, i) => R(-.55 + i * .17, -.35 + i * .045, .07, .7 - i * .09, 1 - i * .12)).join(''),   // delay
  2: () => [0, 1, 2, 3].map(i => C(0, 0, .12 + i * .16, false, 1 - i * .18, .07)).join('') + C(0, 0, .06),   // space
  21: () => [0, 1, 2].map(i => C(0, .1, .12 + i * .16, false, 1 - i * .2, .06)).join('') + [-.3, .3].map(x => P(`M ${x} -.15 V -.6 M ${x - .1} -.5 L ${x} -.62 L ${x + .1} -.5`, .06)).join(''),   // shimmer
  9: () => P(wave(-.7, .7, -.08, .28, 2), .08) + P(wave(-.7, .7, .12, .28, 2, .9), .08, .55),   // doubler
  3: () => C(0, 0, .09) + P('M -.15 0 H -.7 M -.55 -.15 L -.7 0 L -.55 .15 M .15 0 H .7 M .55 -.15 L .7 0 L .55 .15', .08),   // stereo
  6: () => [0, 1, 2, 3, 4, 5].map(i => P(wave(-.65, .65, -.45 + i * .18, .05, 3, i), .06)).join(''),   // mod
  12: () => P(wave(-.7, .7, 0, .5, 7, 0, t => Math.abs(Math.sin(t * Math.PI * 2))), .07),   // tremolo
  22: () => P('M -.7 .55 C -.2 .55 .1 .3 .35 -.35 C .45 -.55 .55 -.6 .7 -.6', .1) + P('M -.7 .55 H .7', .04, .35),   // swell
  23: () => { let s = ''; for (let g = 0; g < 3; g++) for (let k = 0; k < 3; k++) s += R(-.68 + g * .48 + k * .1, -.4 + k * .1, .06, .8 - k * .2, 1 - g * .28); return s },   // stutter
  26: () => P('M -.7 .35 H -.3', .08) + P(wave(-.3, .3, 0, .45, 2.5), .08) + P('M .3 .35 H .7', .08) + P('M -.3 -.55 V .55 M .3 -.55 V .55', .05, .45, '.06 .06'),   // gate
  27: () => P(wave(-.7, .7, 0, .22, .9, .6), .1),   // wow
  [FX_REPEAT]: () => {
    const tops = [0, .25, .12, .35], ops = [1, .65, .45]; let s = ''
    for (let g = 0; g < 3; g++) for (let k = 0; k < 4; k++) s += R(-.66 + g * .46 + k * .085, -.45 + tops[k], .05, .9 - tops[k] * 2, ops[g])
    return s + P('M -.68 -.62 V .62', .04, .5, '.05 .06')
  },
  16: () => { const pts: Array<[number, number]> = []; for (let i = 0; i <= 80; i++) { const t = i / 80; pts.push([-.7 + 1.4 * t, .35 * Math.sin(2 * Math.PI * (1.2 * t + 2.2 * t * t)) * (1 - .3 * t)]) } return P(poly(pts), .08) },   // pitch
  17: () => P('M -.7 .5 C -.55 .5 -.5 -.45 -.32 -.45 C -.14 -.45 -.1 .25 0 .25 C .1 .25 .12 -.2 .28 -.2 C .44 -.2 .5 .5 .7 .5'),   // formant
  15: () => P(wave(-.7, .7, .22, .22, 2), .08) + P(wave(-.7, .7, -.25, .22, 3, .5), .08, .6),   // harmony
  13: () => [0, 1, 2, 3, 4].map(i => C(-.6 + i * .3, .45 - i * .22, .07)).join('') + P('M -.6 .45 L .6 -.43', .04, .35, '.05 .07'),   // arp
  18: () => ([[-.6, -.4, .9], [-.35, .1, .7], [-.1, -.55, .8], [.15, .3, .6], [.4, -.2, .9], [-.5, .45, .5], [.5, .5, .7], [.05, -.1, .5], [-.25, -.15, .6], [.3, .05, .8], [.55, -.5, .5]] as Array<[number, number, number]>).map(([x, y, op]) => P(`M ${x} ${y} h .12`, .07, op)).join(''),   // grain
  19: () => P('M -.7 .5 C -.55 .5 -.5 -.45 -.32 -.45 C -.14 -.45 -.1 .25 0 .25 C .1 .25 .12 -.2 .28 -.2 C .44 -.2 .5 .5 .7 .5', .09, .6) + P(wave(-.7, .7, .1, .12, 4), .06),   // voice (legacy)
  // control (inside the ring)
  [FX_LFO]: (n) => {
    const random = n.aux[4] || 0
    if (random > 0) { let d = ''; for (let k = 0; k < random; k++) { const y = (.35 - randomStep(0, 0, random, k) * .7); d += `${k === 0 ? 'M' : 'L'} ${f3(-.72 + k / random * 1.44)} ${f3(y)} L ${f3(-.72 + (k + 1) / random * 1.44)} ${f3(y)} ` } return P(d, .09) }
    const p = n.pts && n.pts.length >= 6 ? n.pts : SINE_PTS
    const pts: Array<[number, number]> = []; for (let k = 0; k <= 48; k++) { const x = k / 48; pts.push([-.72 + x * 1.44, .35 - shapeAt(p, x) * .7]) }
    return P(poly(pts), .09)
  },
  [FX_RATE]: (n) => T(0, .17, n.aux[0] === 1 ? 'hz' : ['1/32', '1/16', '1/8', '1/4', '1/2', '1/1', '2/1', '4/1'][n.aux[1] ?? 3] ?? '1/4', .38, 500),
  [FX_MACRO]: (n) => T(0, .17, String((n.aux[0] || 0) + 1), .55, 500),
  [FX_FOLLOW]: () => P('M -.7 .5 L -.35 -.45 C -.15 .1 .15 .4 .7 .5') + [.5, .8, .6, .35, .2, .12, .08].map((h, i) => R(-.6 + i * .16, .5 - h, .08, h, .2)).join(''),
  [FX_ENV]: (n) => {
    const lg = (v: number, lo: number, hi: number) => Math.log(Math.max(lo, Math.min(hi, v)) / lo) / Math.log(hi / lo)
    const atk = .08 + .3 * lg(n.aux[0] || 10, 1, 5000), dec = .1 + .34 * lg(n.aux[1] || 200, 1, 5000), rel = .12 + .44 * lg(n.aux[3] || 300, 1, 10000)
    const sus = Math.max(0, Math.min(100, n.aux[2] ?? 70)) / 100
    const susW = Math.max(.1, 1.4 - atk - dec - rel), xA = -.7 + atk, xD = xA + dec, xS = xD + susW, xR = xS + rel, yS = .5 - sus
    const d = `M -.7 .5 L ${f3(xA)} -.5 L ${f3(xD)} ${f3(yS)} H ${f3(xS)} L ${f3(xR)} .5`
    return F(d + ' Z', .15) + P(d)
  },
  [FX_DRIFT]: () => P(poly(Array.from({ length: 41 }, (_, i) => [-.7 + 1.4 * i / 40, .35 * Math.sin(i * .55) * Math.cos(i * .21 + 1) + .12 * Math.sin(i * 1.7)] as [number, number]))),
  [FX_PULSE]: (n) => { const steps = n.aux[4] || 8, hits = pulseHits(steps, n.aux[5] ?? 3, n.aux[6] || 0); return hits.map((on, k) => { const a = -Math.PI / 2 + k / steps * 2 * Math.PI; return C(.55 * Math.cos(a), .55 * Math.sin(a), on ? (steps > 16 ? .06 : .1) : .045, true, on ? .95 : .5) }).join('') },
  [FX_SCENE]: (n) => { const a = Math.min(1, Math.max(0, n.amount)), hasA = !!n.sceneA?.length, hasB = !!n.sceneB?.length; return P('M -.55 0 H .55', .06, .5) + C(-.55, 0, hasA ? .1 : .06, hasA, .95, .06) + C(.55, 0, hasB ? .1 : .06, hasB, .95, .06) + C(-.55 + 1.1 * a, 0, .13) + T(-.55, .5, 'A', .32, 500, hasA ? .95 : .45) + T(.55, .5, 'B', .32, 500, hasB ? .95 : .45) },
}

/** The pulse's pattern: `hits` of `steps`, spread as evenly as they can be (euclid), turned by `rotate`. */
export function pulseHits (steps: number, hits: number, rotate: number): boolean[] {
  const n = Math.max(1, Math.min(32, steps)), h = Math.max(0, Math.min(n, hits))
  return Array.from({ length: n }, (_, k) => ((((k + rotate) % n) + n) % n * h) % n < h)
}

// ── plates that are the picture ──
const bars = (col: string, specs: Array<[number, number] | [number, number, number]>, w = .34) =>
  specs.map(([x, top, op]) => R(x, top, w, 1 - top, op ?? 1, col)).join('')
const fit = (col: string, d: string, w = .16) => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${f3(w * LINE)}" stroke-linecap="round" stroke-linejoin="round"/>`

const plates: Record<number, (col: string, n: GlyphNode) => string> = {
  [FX_CARVE]: (col) => bars(col, [[-1.15, -1], [-.75, -.72], [-.35, .18], [.05, .3], [.45, -.62], [.85, -.95]], .28),
  [FX_MATCH]: (col) => bars(col, [[-1.1, -.3], [-.5, -.95], [.1, -.1], [.7, -.6]], .4)
    + ([[-1.1, -.95], [-.5, -.3], [.1, -.6], [.7, -.1]] as Array<[number, number]>).map(([x, t]) => `<rect x="${x}" y="${t}" width=".4" height="${f3(1 - t)}" fill="none" stroke="${PAPER}" stroke-opacity=".75" stroke-width=".07"/>`).join(''),
  [FX_VOCODE]: (col) => bars(col, [[-1.15, -.55], [-.45, -1], [.25, -.25], [.95, -.75]]) + ([[-.72, -.2], [-.02, -.7], [.68, -.45]] as Array<[number, number]>).map(([x, t]) => R(x, t, .12, 1 - t, .85)).join(''),
  [FX_FREEZE]: (col, n) => bars(col, [[-1.15, -.55], [-.7, -.55], [-.25, -.55], [.2, -.55], [.65, -.55]], .3) + (n.amount > .5 ? P('M -1.25 -.72 H 1.05', .09) : P('M -1.25 -.72 H 1.05', .07, .35, '.1 .12')),
  [FX_SHIFT]: (col, n) => (n.aux[0] || 0) < 0
    ? bars(col, [[-1.15, -.95], [-.65, -.55], [-.15, -.15], [.35, .25]], .36) + P('M 1.15 .45 H .55 M .75 .25 L .55 .45 L .75 .65', .09)
    : bars(col, [[-1.15, .25], [-.65, -.15], [-.15, -.55], [.35, -.95]], .36) + P('M .55 -.35 H 1.15 M .95 -.55 L 1.15 -.35 L .95 -.15', .09),
  [FX_SMEAR]: (col) => { let s = ''; for (const [x, t] of [[-1.15, -.5], [-.5, -.95], [.15, -.3]] as Array<[number, number]>) [1, .5, .25, .12].forEach((o, k) => { s += R(x + k * .17, t + k * .12, .34, 1 - t - k * .12, o, col) }); return s },
  [FX_SIEVE]: (col, n) => {
    const keep = n.amount < .004 ? 9 : Math.max(1, Math.min(9, Math.round(9 * Math.pow(2, -n.amount * 4))))   // the loudest few stand
    const order = [2, 6, 4, 0, 8, 3, 5, 1, 7]
    return bars(col, Array.from({ length: 9 }, (_, k) => { const kept = order.indexOf(k) < keep; return [-1.2 + k * .29, kept ? (k === 2 ? -.95 : k === 6 ? -.7 : -.35 - (k % 3) * .15) : .25 + (k % 3) * .15, kept ? 1 : .3] as [number, number, number] }), .14)
  },
  5: (col, n) => fit(col, 'M 0 -1.05 V 1.05', .1) + R(-.5, -.16 + (.75 - Math.min(1, Math.max(0, n.amount))) * .9, 1, .32, 1, col),
  [FX_MIX_TYPE]: (col) => fit(col, 'M -1.05 -.6 C -.3 -.6 -.35 0 0 0 M -1.05 .6 C -.3 .6 -.35 0 0 0 M 0 0 H 1.05') + `<circle r=".2" fill="${col}"/>`,
  [FX_SPLIT_LR]: (col) => fit(col, 'M -1.05 0 H 0 M 0 0 C .35 0 .3 -.6 1.05 -.6 M 0 0 C .35 0 .3 .6 1.05 .6') + `<circle cx="1.05" cy="-.6" r=".2" fill="${col}"/><circle cx="1.05" cy=".6" r=".2" fill="none" stroke="${col}" stroke-width=".12"/>`,
  [FX_SPLIT_MS]: (col) => `<circle r=".8" fill="none" stroke="${col}" stroke-width=".16"/><circle r=".32" fill="${col}"/>`,
  [FX_PAN]: (col, n) => fit(col, 'M -1.05 0 H 1.05 M -1.05 -.3 V .3 M 1.05 -.3 V .3', .12) + `<circle cx="${f3(-.84 + 1.68 * Math.min(1, Math.max(0, n.amount)))}" r=".24" fill="${col}"/>`,
  [FX_BANDS]: (col, n) => { const nb = Math.max(1, Math.min(5, n.aux[5] || 1)); let d = 'M -1.05 0 H 1.05'; for (let k = 1; k <= nb; k++) { const x = -1.05 + 2.1 * k / (nb + 1); d += ` M ${f3(x)} -.55 V .55` } return fit(col, d, .14) },
  [FX_SIDE]: (col) => `<circle cx=".3" r=".58" fill="none" stroke="${col}" stroke-width=".14"/>` + fit(col, 'M -1.15 0 H -.28 M -.55 -.28 L -.28 0 L -.55 .28', .14),
}

/** The SVG inside a print: the plate in its tint and the picture in paper (or the bars / the fitting), unit space. */
export function printInner (n: GlyphNode, family: Family, tint: string): string {
  const plate = plates[n.type]
  if (plate) return `<g transform="scale(${family === 'utility' ? UTIL_SCALE : SPEC_SCALE})">${plate(tint, n)}</g>`
  const pic = pictures[n.type]?.(n) ?? ''
  const inkScale = family === 'control' ? .78 : 1
  return `<path d="${SHAPE[family]}" fill="${tint}" fill-rule="evenodd"/><g transform="scale(${inkScale})">${pic}</g>`
}
