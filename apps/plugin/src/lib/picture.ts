/*  The picture domain — how the wall's background is made.

    Nothing is drawn unless the patch says so, and nothing is assumed:

    · a wire carries a SIGNAL: one value now (a sound's sample, or what a
      rate / follow / macro is saying).
    · `memory` is a shift register: each new sample goes in at one end,
      everything moves along one place, what reaches the other end is
      gone. Out comes a WINDOW: the last `length` of the signal, oldest
      first.
    · `index` takes a window and gives each sample's place in it, in ms
      (the oldest is 0, the newest is the window's length).
    · `decibel` turns amplitude into dB (a signal stays a signal, a
      window stays a window).
    · `offset` adds a constant, `scale` multiplies by one (a negative
      one turns things round). Nothing else moves or sizes a value.
    · `plot` zips what lands on x, y, z — sample by sample, from the
      newest end, as far as the shortest window goes — into points, and
      joins them. An axis with nothing on it is 0. A signal (no memory)
      is one value, so it is one point. The origin is the middle of the
      wall, always. Each axis has one number: how much is at the wall's
      edge, in the unit that arrives (x = 500 ms: the right edge is
      +500 ms, the left −500 ms). An index runs 0..length, so by itself
      it fills the right half only: to fill the wall, offset it.
    · the camera is the plot's: straight on, depth cannot be seen.

    Dense windows are reduced for drawing (a wall is ~800 px wide, a
    window can be 100 000 samples): every window of one plot is cut into
    buckets of the same number of samples, so the zip stays sample-true.
    With one dense axis each bucket keeps its min and max (nothing a
    sound does between two pixels is lost); with two or more, buckets
    are sampled instead, because min/max would break what x has to do
    with y.                                                            */

import { FX_PLOT, FX_PORT_IN } from './fxBridge'

export const PIC_MEMORY = 36, PIC_INDEX = 37, PIC_DECIBEL = 38, PIC_OFFSET = 39, PIC_SCALE = 40
export const isPictureType = (t: number) => t === FX_PLOT || (t >= PIC_MEMORY && t <= PIC_SCALE)

export type Unit = 'amp' | 'value' | 'dB' | 'ms' | 'none'
export interface PicNode { id: number; type: number; variant: number; aux: number[] }
/** A wire landing on a picture print. `kind`: a sound (streamed by the engine, summed per input there), a control print's value, or another picture print's output. */
export interface PicEdge { from: number; to: number; in: number; gain: number; kind: 'sound' | 'control' | 'picture' }
export interface PictureSpec { nodes: PicNode[]; edges: PicEdge[] }

export const DB_FLOOR = -120
const dB = (a: number, cal: number) => (a <= 1e-6 ? DB_FLOOR : Math.max(DB_FLOOR, 20 * Math.log10(a))) + cal

/** A ring of recent samples; `w` is where the next one goes. */
export interface Ring { data: Float32Array; w: number }
export interface Rings { sr: number; sound: (node: number, inIdx: number) => Ring | undefined; control: (from: number) => Ring | undefined }

type Sig = { kind: 'sig'; at: (back: number) => number; unit: Unit; dense: boolean }
type Win = { kind: 'win'; lo: Float32Array; hi: Float32Array; ms: number; unit: Unit; dense: boolean }   // oldest first
type Val = Sig | Win | null

/** What arrives at one input, without computing it: a signal or a window, its unit, and whether it is dense (a sound's samples). */
export function infer (spec: PictureSpec, node: number, inIdx: number, depth = 0): { kind: 'sig' | 'win'; unit: Unit; dense: boolean; samplesMs: number } | null {
  if (depth > 12) return null
  const ins = spec.edges.filter(e => e.to === node && e.in === inIdx)
  if (ins.length === 0) return null
  const pic = ins.find(e => e.kind === 'picture')
  if (pic) return inferOut(spec, pic.from, depth + 1)
  return { kind: 'sig', unit: ins.some(e => e.kind === 'sound') ? 'amp' : 'value', dense: ins.some(e => e.kind === 'sound'), samplesMs: 0 }
}
function inferOut (spec: PictureSpec, id: number, depth: number): ReturnType<typeof infer> {
  const n = spec.nodes.find(x => x.id === id); if (!n) return null
  const a = infer(spec, id, 0, depth)
  if (n.type === PIC_MEMORY) return a && a.kind === 'sig' ? { kind: 'win', unit: a.unit, dense: a.dense, samplesMs: memoryMs(n) } : null
  if (n.type === PIC_DECIBEL) return a ? { ...a, unit: 'dB' } : null
  if (n.type === PIC_INDEX) return a && a.kind === 'win' ? { kind: 'win', unit: 'ms', dense: false, samplesMs: a.samplesMs } : null
  if (n.type === PIC_OFFSET || n.type === PIC_SCALE) return a
  return null
}
/** What a picture print puts out: a signal or a window (null: nothing yet, or it makes nothing). */
export const outOf = (spec: PictureSpec, id: number) => inferOut(spec, id, 0)
export const memoryMs = (n: PicNode) => Math.min(4000, Math.max(1, n.aux[0] || 500))

/** One plot's points, ready to project: unit-cube coordinates (−1..1 is the axis's min..max), in drawing order. */
export function plotPoints (spec: PictureSpec, plot: PicNode, rings: Rings, maxBuckets = 2048): { pts: Float32Array; n: number } {
  const axes = [1, 0, 2]   // x, y, z are inputs 1, 0, 2
  const meta = axes.map(i => infer(spec, plot.id, i))
  const dense = meta.filter(m => m && m.kind === 'win' && m.dense).length
  const stride = dense >= 2
  const longest = Math.max(1, ...meta.map(m => (m && m.kind === 'win' ? Math.round(m.samplesMs / 1000 * rings.sr) : 1)))
  const B = Math.max(1, Math.ceil(longest / maxBuckets))   // samples per bucket, the same for every window of this plot

  const sumSig = (node: number, inIdx: number): Sig | null => {
    const ins = spec.edges.filter(e => e.to === node && e.in === inIdx && e.kind !== 'picture')
    if (ins.length === 0) return null
    const sound = ins.some(e => e.kind === 'sound') ? rings.sound(node, inIdx) : undefined
    const ctl = ins.filter(e => e.kind === 'control').map(e => ({ r: rings.control(e.from), g: e.gain }))
    return {
      kind: 'sig', unit: sound ? 'amp' : 'value', dense: !!sound,
      at: (back) => {
        let v = 0
        if (sound) { const L = sound.data.length; v += sound.data[(sound.w - 1 - back + L * 4) % L] }
        for (const c of ctl) if (c.r) { const L = c.r.data.length; v += c.g * c.r.data[(c.r.w - 1 - back + L * 4) % L] }
        return v
      },
    }
  }
  const evalIn = (node: number, inIdx: number, depth: number): Val => {
    if (depth > 12) return null
    const pic = spec.edges.find(e => e.to === node && e.in === inIdx && e.kind === 'picture')
    return pic ? evalOut(pic.from, depth + 1) : sumSig(node, inIdx)
  }
  const evalOut = (id: number, depth: number): Val => {
    const n = spec.nodes.find(x => x.id === id); if (!n) return null
    const a = evalIn(id, 0, depth)
    if (n.type === PIC_MEMORY) {
      if (!a || a.kind !== 'sig') return null
      const ms = memoryMs(n), N = Math.max(1, Math.round(ms / 1000 * rings.sr)), K = Math.ceil(N / B)
      const lo = new Float32Array(K), hi = new Float32Array(K)
      for (let k = 0; k < K; k++) {
        // bucket k, oldest first; the newest bucket ends at the newest sample
        const b1 = (K - 1 - k) * B, b0 = Math.min(N, b1 + B) - 1
        if (stride || !a.dense) { const v = a.at(b1); lo[k] = v; hi[k] = v; continue }
        let mn = Infinity, mx = -Infinity
        for (let s = b0; s >= b1; s--) { const v = a.at(s); if (v < mn) mn = v; if (v > mx) mx = v }
        lo[k] = mn; hi[k] = mx
      }
      return { kind: 'win', lo, hi, ms, unit: a.unit, dense: a.dense }
    }
    if (n.type === PIC_DECIBEL) {
      if (!a) return null
      const cal = n.aux[0] || 0
      if (a.kind === 'sig') return { ...a, unit: 'dB', at: (back) => dB(Math.abs(a.at(back)), cal) }
      const K = a.lo.length, lo = new Float32Array(K), hi = new Float32Array(K)
      for (let k = 0; k < K; k++) {
        const p = Math.abs(a.lo[k]), q = Math.abs(a.hi[k])
        hi[k] = dB(Math.max(p, q), cal)
        lo[k] = a.lo[k] < 0 && a.hi[k] > 0 ? DB_FLOOR + cal : dB(Math.min(p, q), cal)   // a bucket that crosses zero reaches down to silence
      }
      return { kind: 'win', lo, hi, ms: a.ms, unit: 'dB', dense: a.dense }
    }
    if (n.type === PIC_OFFSET || n.type === PIC_SCALE) {
      if (!a) return null
      const c = (n.aux[0] ?? (n.type === PIC_SCALE ? 100 : 0)) / 100
      const f = n.type === PIC_OFFSET ? (v: number) => v + c : (v: number) => v * c
      if (a.kind === 'sig') return { ...a, at: (back) => f(a.at(back)) }
      const K = a.lo.length, lo = new Float32Array(K), hi = new Float32Array(K)
      for (let k = 0; k < K; k++) { const p = f(a.lo[k]), q = f(a.hi[k]); lo[k] = Math.min(p, q); hi[k] = Math.max(p, q) }
      return { ...a, lo, hi }
    }
    if (n.type === PIC_INDEX) {
      if (!a || a.kind !== 'win') return null
      const K = a.lo.length, v = new Float32Array(K)
      for (let k = 0; k < K; k++) v[k] = K > 1 ? (k / (K - 1)) * a.ms : a.ms
      return { kind: 'win', lo: v, hi: v, ms: a.ms, unit: 'ms', dense: false }
    }
    return null
  }

  const vals = axes.map(i => evalIn(plot.id, i, 0))
  const wins = vals.filter((v): v is Win => !!v && v.kind === 'win')
  const L = wins.length ? Math.min(...wins.map(w => w.lo.length)) : (vals.some(v => v) ? 1 : 0)
  const two = !stride && wins.some(w => w.dense)   // min and max per bucket: two points
  const pts = new Float32Array(L * (two ? 2 : 1) * 3)
  // the origin is the wall's middle; each axis says how much is at the wall's edge
  const edge = [0, 1, 2].map(a => Math.abs(plot.aux[a] || 100) / 100)
  const unit = (a: number, v: number) => Math.max(-8, Math.min(8, v / edge[a]))
  let n = 0
  for (let j = 0; j < L; j++) {
    for (let pass = 0; pass < (two ? 2 : 1); pass++) {
      for (let a = 0; a < 3; a++) {
        const v = vals[a]
        let x = 0
        if (v && v.kind === 'win') { const k = v.lo.length - L + j; x = pass === 0 ? v.hi[k] : v.lo[k] }
        else if (v) x = v.at(0)
        pts[n * 3 + a] = unit(a, x)
      }
      n++
    }
  }
  return { pts, n }
}

/** The plain browser has no engine: what would arrive on a wire is made up here, so the picture can be built and seen. */
export function demoSample (from: number, t: number): number {
  const env = 0.5 + 0.5 * Math.sin(2 * Math.PI * 1.3 * t)
  const s = (Math.sin(2 * Math.PI * 110 * t) * 0.5 + Math.sin(2 * Math.PI * 330 * t) * 0.2) * env
  if (from === FX_PORT_IN) return s
  return Math.tanh(s * (1.6 + (from % 5) * 0.4)) * 0.7 * (0.6 + 0.4 * Math.sin(2 * Math.PI * (4 + from % 3) * t + from))
}
