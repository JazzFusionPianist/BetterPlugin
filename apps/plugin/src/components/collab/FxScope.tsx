import { useEffect, useRef } from 'react'
import { hasJuceBridge } from '../../lib/juceBridge'
import { FX_PLOT } from '../../lib/fxBridge'
import { plotPoints, demoSample, type PictureSpec, type Ring, type Rings } from '../../lib/picture'

/*  The wall's picture. Nothing is drawn here that the patch did not ask
    for: each plot print's points (see lib/picture.ts for how they are
    made) are projected through that plot's camera and joined. This file
    only keeps the signals (what the engine streams: the sounds wired
    into picture prints, and what the control prints are saying) and
    draws.                                                             */

const RING_S = 4.2             // seconds kept: a memory holds 4 s at most

interface Props {
  picture: PictureSpec
  width: number
  height: number
  ink: string                  // the wall's ink, "rgb(r, g, b)"
  /** Drawn over the picture every frame, in CSS px: the wall's wires and
   *  the discs under its prints live here too, so one full redraw per
   *  frame replaces WebKit's partial repaints (which smeared). */
  overlay?: (ctx: CanvasRenderingContext2D) => void
  /** Drawn first, under the picture: the room's light. */
  backdrop?: (ctx: CanvasRenderingContext2D) => void
}

function decode (b64: string): Float32Array | null {
  try {
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new Float32Array(bytes.buffer)
  } catch { return null }
}

export default function FxScope ({ picture, width, height, ink, overlay, backdrop }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const sr = useRef(48000)
  const sound = useRef(new Map<string, Ring>())     // "<node>:<input>" → what the engine streams for that input
  const control = useRef(new Map<number, Ring>())   // control print → what it has been saying
  const lastCtl = useRef(new Map<number, number>())
  const spec = useRef(picture); spec.current = picture
  const bridge = hasJuceBridge
  const ringIn = <K,>(m: Map<K, Ring>, k: K): Ring => {
    let r = m.get(k); const len = Math.round(sr.current * RING_S)
    if (!r || r.data.length !== len) { r = { data: new Float32Array(len), w: 0 }; m.set(k, r) }
    return r
  }
  const push = (r: Ring, v: Float32Array) => { for (let i = 0; i < v.length; i++) { r.data[r.w] = v[i]; r.w = (r.w + 1) % r.data.length } }

  // ── the signals ───────────────────────────────────────────────────
  useEffect(() => {
    if (bridge) {
      const onAudio = (e: Event) => {
        const d = (e as CustomEvent).detail as { sr?: number; ch?: number; samples?: string; ctl?: number[]; plots?: Array<{ slot: number; mask: number; y?: string; x?: string; z?: string }> }
        if (d.sr && d.sr !== sr.current) { sr.current = d.sr; sound.current.clear(); control.current.clear() }
        let n = 0
        for (const p of d.plots ?? []) {
          const axes = [p.y ? decode(p.y) : null, p.x ? decode(p.x) : null, p.z ? decode(p.z) : null]   // inputs 0, 1, 2
          axes.forEach((a, i) => { if (a) { push(ringIn(sound.current, `${p.slot}:${i}`), a); n = Math.max(n, a.length) } })
        }
        if (n === 0 && d.samples) n = Math.floor(d.samples.length * 3 / 4 / 4 / Math.max(1, d.ch ?? 2))   // no tap this block: the out stream keeps the clock
        // what the control prints say, ramped across the block so a memory of it is not a staircase
        if (n > 0 && Array.isArray(d.ctl)) {
          for (const from of new Set(spec.current.edges.filter(x => x.kind === 'control').map(x => x.from))) {
            const v1 = Number(d.ctl[from]) || 0, v0 = lastCtl.current.get(from) ?? v1
            const r = ringIn(control.current, from)
            for (let i = 0; i < n; i++) { r.data[r.w] = v0 + (v1 - v0) * ((i + 1) / n); r.w = (r.w + 1) % r.data.length }
            lastCtl.current.set(from, v1)
          }
        }
      }
      window.addEventListener('__juceDawAudio', onAudio)
      return () => window.removeEventListener('__juceDawAudio', onAudio)
    }
    // plain browser: made-up signals on every wire that enters the picture, so it can be built and seen
    let t = 0
    const id = setInterval(() => {
      const n = Math.round(sr.current / 30)
      const s = spec.current
      const keys = new Map<string, number[]>()
      for (const e of s.edges) if (e.kind === 'sound') { const k = `${e.to}:${e.in}`; keys.set(k, [...(keys.get(k) ?? []), e.from]) }
      for (const [k, froms] of keys) { const r = ringIn(sound.current, k); for (let i = 0; i < n; i++) { let v = 0; for (const f of froms) v += demoSample(f, (t + i) / sr.current); r.data[r.w] = v; r.w = (r.w + 1) % r.data.length } }
      for (const from of new Set(s.edges.filter(e => e.kind === 'control').map(e => e.from))) { const r = ringIn(control.current, from); for (let i = 0; i < n; i++) { r.data[r.w] = 0.5 + 0.5 * Math.sin(2 * Math.PI * (0.5 + (from % 4) * 0.25) * (t + i) / sr.current); r.w = (r.w + 1) % r.data.length } }
      t += n
    }, 1000 / 30)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge])

  // ── draw ──────────────────────────────────────────────────────────
  useEffect(() => {
    const el = canvas.current; if (!el) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    el.width = Math.round(width * dpr); el.height = Math.round(height * dpr)
    const ctx = el.getContext('2d'); if (!ctx) return
    let raf = 0
    const inkA = (a: number) => ink.replace('rgb(', 'rgba(').replace(')', `, ${a})`)
    const rings: Rings = { get sr () { return sr.current }, sound: (node, i) => sound.current.get(`${node}:${i}`), control: (from) => control.current.get(from) }

    /** A plot's camera. Straight on (turn 0, tilt 0) the unit cube's x and y span the wall edge to edge and depth cannot be seen. */
    const camera = (turnDeg: number, tiltDeg: number) => {
      const yaw = turnDeg * Math.PI / 180, pitch = -tiltDeg * Math.PI / 180
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch)
      const D = 4.6
      return (X: number, Y: number, Z: number): [number, number, number] => {
        const x1 = X * cy + Z * sy, z1 = -X * sy + Z * cy
        const y2 = Y * cp - z1 * sp, z2 = Y * sp + z1 * cp
        const f = D / Math.max(0.2, D + z2)
        return [(width / 2 + x1 * f * width / 2) * dpr, (height / 2 - y2 * f * height / 2) * dpr, f]
      }
    }
    /** The cube's floor and its three axes, faint: only when the camera has left the front, where they say which way is which. */
    const room = (P: ReturnType<typeof camera>) => {
      ctx.lineWidth = 1 * dpr
      ctx.beginPath()
      for (let k = -4; k <= 4; k++) {
        const t = k / 4
        let a = P(t, -1, -1), b = P(t, -1, 1); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1])
        a = P(-1, -1, t); b = P(1, -1, t); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1])
      }
      ctx.strokeStyle = inkA(0.1); ctx.stroke()
      ctx.beginPath()
      const o = P(-1, -1, -1)
      for (const e of [P(1, -1, -1), P(-1, 1, -1), P(-1, -1, 1)]) { ctx.moveTo(o[0], o[1]); ctx.lineTo(e[0], e[1]) }
      ctx.strokeStyle = inkA(0.3); ctx.stroke()
    }

    const tick = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, el.width, el.height)
      if (backdrop) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); backdrop(ctx); ctx.globalCompositeOperation = 'source-over'; ctx.setTransform(1, 0, 0, 1, 0, 0) }
      for (const plot of spec.current.nodes) {
        if (plot.type !== FX_PLOT) continue
        const { pts, n } = plotPoints(spec.current, plot, rings, Math.max(256, Math.round(width)))
        if (n === 0) continue
        const turn = plot.aux[6] || 0, tilt = plot.aux[7] || 0
        const P = camera(turn, tilt)
        if (turn !== 0 || tilt !== 0) room(P)
        ctx.globalCompositeOperation = 'lighter'
        ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = 1 * dpr; ctx.lineJoin = 'round'
        if (plot.variant === 1 || n === 1) {
          for (let i = 0; i < n; i++) { const q = P(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]); const s = dpr * (n === 1 ? 5 : 1.6) * q[2]; ctx.globalAlpha = Math.min(1, 0.7 * q[2] * q[2]); ctx.fillRect(q[0] - s / 2, q[1] - s / 2, s, s) }
        } else {
          ctx.beginPath()
          for (let i = 0; i < n; i++) { const q = P(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]); if (i === 0) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]) }
          ctx.globalAlpha = 0.6; ctx.stroke()
        }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'
      }
      if (overlay) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); overlay(ctx); ctx.setTransform(1, 0, 0, 1, 0, 0) }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [width, height, ink, overlay, backdrop])

  return <canvas ref={canvas} className="sg-scope" style={{ width, height }} />
}
