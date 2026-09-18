import { useEffect, useRef } from 'react'
import { hasJuceBridge } from '../../lib/juceBridge'
import { getLiveHand, LIVE_INDEX } from '../../lib/liveHands'

/*  The scope: the wall's picture. Every plot print on the wall draws
    here — whatever is wired into its y (and x, and z). A plot with only
    a y is a waveform scrolling by; fed straight from `in` it is the
    quiet trace in the wall's ink, anywhere later it is the lit ribbon
    that takes the lamps' colours. With an x it is a figure (y against
    x); a z pushes it away and dims it. All plots share one clock, so
    two traces side by side show what the patch did between them.     */

const RING_S = 3               // seconds kept (the widest window is 2 s)

export type PlotAxis = 'sound' | 'value' | null
export interface PlotSpec {
  slot: number
  quiet: boolean               // fed straight from `in`: the wall's ink, quiet
  mode: number                 // 0 = line, 1 = dots (a figure only)
  trail: number                // 0..100: how much of a figure stays
  windowS: number              // with no x: seconds of signal across the wall (the speed it scrolls by)
  gain: number                 // vertical zoom: 1 = full scale fills 84% of the wall
  y: PlotAxis; x: PlotAxis; z: PlotAxis   // a sound wire, a control wire, or nothing
}

interface Props {
  plots: PlotSpec[]
  width: number
  height: number
  ink: string                  // the wall's ink, "rgb(r, g, b)"
  accent: string               // the second ink
  /** Drawn over the traces every frame, in CSS px: the wall's wires and
   *  the discs under its prints live here too, so one full redraw per
   *  frame replaces WebKit's partial repaints (which smeared). */
  overlay?: (ctx: CanvasRenderingContext2D) => void
  /** Drawn first, under the traces: the room's light. */
  backdrop?: (ctx: CanvasRenderingContext2D) => void
  /** The lamps along the wall, for the output trace to take their
   *  colour as it passes under them: x in CSS px, tint, brightness. */
  palette?: () => Array<{ x: number; rgb: [number, number, number]; k: number }>
}

function decode (b64: string): Float32Array | null {
  try {
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new Float32Array(bytes.buffer)
  } catch { return null }
}

export default function FxScope ({ plots, width, height, ink, accent, overlay, backdrop, palette }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const sr = useRef(48000)
  // one ring per plot and axis, all written in step
  type Rings = { y: Float32Array; x: Float32Array; z: Float32Array; w: number }
  const rings = useRef(new Map<number, Rings>())
  const ringOf = (slot: number): Rings => {
    let r = rings.current.get(slot)
    const len = sr.current * RING_S
    if (!r || r.y.length !== len) { r = { y: new Float32Array(len), x: new Float32Array(len), z: new Float32Array(len), w: 0 }; rings.current.set(slot, r) }
    return r
  }
  const specs = useRef(plots); specs.current = plots
  const bridge = hasJuceBridge
  /** A played axis as a signal: the hand runs 0..1000 around 500. */
  const valueOf = (slot: number, axis: 'x' | 'y' | 'z') => { const v = getLiveHand(slot, LIVE_INDEX[axis === 'x' ? 'aux1' : axis === 'y' ? 'aux2' : 'aux3']); return v === undefined ? 0 : Math.max(-1, Math.min(1, (v - 500) / 500)) }
  /** n samples into a plot's rings: a sound axis from its stream, a value axis held, nothing as zero. */
  const feed = (spec: PlotSpec, n: number, sound: { y?: Float32Array | null; x?: Float32Array | null; z?: Float32Array | null }) => {
    const r = ringOf(spec.slot)
    const vy = spec.y === 'value' ? valueOf(spec.slot, 'y') : 0, vx = spec.x === 'value' ? valueOf(spec.slot, 'x') : 0, vz = spec.z === 'value' ? valueOf(spec.slot, 'z') : 0
    for (let i = 0; i < n; i++) {
      r.y[r.w] = spec.y === 'sound' ? (sound.y?.[i] ?? 0) : vy
      r.x[r.w] = spec.x === 'sound' ? (sound.x?.[i] ?? 0) : vx
      r.z[r.w] = spec.z === 'sound' ? (sound.z?.[i] ?? 0) : vz
      r.w = (r.w + 1) % r.y.length
    }
  }

  // ── feed ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (bridge) {
      const onAudio = (e: Event) => {
        const d = (e as CustomEvent).detail as { sr?: number; plots?: Array<{ slot: number; mask: number; y?: string; x?: string; z?: string }> }
        if (d.sr && d.sr !== sr.current) { sr.current = d.sr; rings.current.clear() }
        if (!Array.isArray(d.plots)) return
        for (const p of d.plots) {
          const spec = specs.current.find(s => s.slot === p.slot); if (!spec) continue
          const y = p.y ? decode(p.y) : null, x = p.x ? decode(p.x) : null, z = p.z ? decode(p.z) : null
          const n = (y ?? x ?? z)?.length ?? 0
          if (n > 0) feed(spec, n, { y, x, z })
        }
      }
      window.addEventListener('__juceDawAudio', onAudio)
      return () => window.removeEventListener('__juceDawAudio', onAudio)
    }
    // plain browser: test tones so the picture has something to show —
    // a plot fed from `in` gets the tone, any other the tone through a make-believe patch
    let t = 0
    const id = setInterval(() => {
      const n = Math.round(sr.current / 30)
      const a = new Float32Array(n), b = new Float32Array(n), c = new Float32Array(n), dz = new Float32Array(n)
      for (let i = 0; i < n; i++) {
        const x = t / sr.current
        const env = 0.5 + 0.5 * Math.sin(2 * Math.PI * 1.3 * x)
        const s = (Math.sin(2 * Math.PI * 110 * x) * 0.5 + Math.sin(2 * Math.PI * 330 * x) * 0.2) * env
        a[i] = s
        b[i] = Math.tanh(s * 2.2) * 0.7 * (0.6 + 0.4 * Math.sin(2 * Math.PI * 6 * x))
        c[i] = Math.sin(2 * Math.PI * 165.3 * x + 0.6) * 0.6 * env
        dz[i] = Math.sin(2 * Math.PI * 0.4 * x)
        t++
      }
      for (const spec of specs.current) feed(spec, n, { y: spec.quiet ? a : b, x: c, z: dz })
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
    const SILENT = 0.002   // ≈ −54 dBFS: below this there is nothing to draw
    const trace = (ring: Float32Array, w: number, colour: string, lw: number, gain: number, win: number) => {
      const n = Math.min(ring.length - 1, Math.round(sr.current * win))
      const per = n / width
      ctx.beginPath()
      ctx.strokeStyle = colour; ctx.lineWidth = lw * dpr; ctx.lineJoin = 'round'
      const mid = height / 2, amp = height * 0.42
      let pen = false   // silence breaks the line — no flat trace at zero
      for (let x = 0; x < width; x++) {
        // min/max over the samples this column covers — the print of a
        // waveform, not an alias of it
        let lo = 1, hi = -1
        const s0 = Math.floor(x * per), s1 = Math.max(s0 + 1, Math.floor((x + 1) * per))
        for (let s = s0; s < s1; s++) {
          const v = ring[(w - n + s + ring.length * 2) % ring.length]
          if (v < lo) lo = v; if (v > hi) hi = v
        }
        if (Math.max(Math.abs(lo), Math.abs(hi)) < SILENT) { pen = false; continue }
        const yHi = (mid - Math.min(1.2, hi * gain) * amp) * dpr, yLo = (mid - Math.max(-1.2, lo * gain) * amp) * dpr
        if (!pen) { ctx.moveTo(x * dpr, yHi); pen = true } else ctx.lineTo(x * dpr, yHi)
        ctx.lineTo(x * dpr, yLo)
      }
      ctx.stroke()
    }
    /** The output as light: the min/max envelope filled softly and edged
     *  finely, coloured by whatever lamp it passes under, added to the
     *  wall (never a flat coloured line). Silence breaks it. */
    const ribbon = (ring: Float32Array, w: number, paper: [number, number, number], alpha: number, gain: number, win: number) => {
      const n = Math.min(ring.length - 1, Math.round(sr.current * win))
      const per = n / width
      const mid = height / 2, amp = height * 0.42
      // colour across the wall: paper, warmed toward each lamp's tint
      const lamps = (palette ? palette() : []).filter(l => l.k > 0.02).sort((a, b) => a.x - b.x)
      const colAt = (x: number): [number, number, number] => {
        if (lamps.length === 0) return paper
        // nearest two lamps, blended by distance; a lamp's pull fades with its brightness
        let best = lamps[0], second: typeof best | null = null
        for (const l of lamps) if (Math.abs(l.x - x) < Math.abs(best.x - x)) { second = best; best = l } else if (!second || Math.abs(l.x - x) < Math.abs(second.x - x)) second = l
        const pull = (l: { x: number; k: number }) => Math.max(0, 1 - Math.abs(l.x - x) / (240 + 260 * l.k)) * (0.55 + 0.45 * l.k)
        let c: [number, number, number] = [paper[0], paper[1], paper[2]]
        for (const l of [best, second]) {
          if (!l) continue
          const t = pull(l)
          c = [c[0] + (l.rgb[0] - c[0]) * t, c[1] + (l.rgb[1] - c[1]) * t, c[2] + (l.rgb[2] - c[2]) * t]
        }
        return c
      }
      const grad = ctx.createLinearGradient(0, 0, width * dpr, 0)
      const steps = 14
      for (let i = 0; i <= steps; i++) {
        const c = colAt((i / steps) * width)
        grad.addColorStop(i / steps, `rgb(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])})`)
      }
      // envelope segments between silences
      const his: number[] = new Array(width), los: number[] = new Array(width)
      for (let x = 0; x < width; x++) {
        let lo = 1, hi = -1
        const s0 = Math.floor(x * per), s1 = Math.max(s0 + 1, Math.floor((x + 1) * per))
        for (let s = s0; s < s1; s++) { const v = ring[(w - n + s + ring.length * 2) % ring.length]; if (v < lo) lo = v; if (v > hi) hi = v }
        const silent = Math.max(Math.abs(lo), Math.abs(hi)) < SILENT
        his[x] = silent ? NaN : (mid - Math.min(1.2, hi * gain) * amp) * dpr
        los[x] = silent ? NaN : (mid - Math.max(-1.2, lo * gain) * amp) * dpr
      }
      ctx.globalCompositeOperation = 'lighter'
      let x = 0
      while (x < width) {
        while (x < width && Number.isNaN(his[x])) x++
        const start = x
        while (x < width && !Number.isNaN(his[x])) x++
        if (x - start < 2) continue
        ctx.beginPath()
        ctx.moveTo(start * dpr, his[start])
        for (let i = start + 1; i < x; i++) ctx.lineTo(i * dpr, his[i])
        for (let i = x - 1; i >= start; i--) ctx.lineTo(i * dpr, los[i])
        ctx.closePath()
        ctx.fillStyle = grad; ctx.globalAlpha = 0.16 * alpha; ctx.fill()
        ctx.strokeStyle = grad; ctx.globalAlpha = 0.7 * alpha; ctx.lineWidth = 1 * dpr; ctx.lineJoin = 'round'; ctx.stroke()
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
    }
    /** A figure: y against x over the last stretch of signal; z pushes it away (smaller, dimmer). */
    const figure = (r: { y: Float32Array; x: Float32Array; z: Float32Array; w: number }, spec: PlotSpec, colour: string, alpha: number) => {
      const gain = spec.gain
      const secs = 0.02 + Math.pow(Math.min(100, Math.max(0, spec.trail)) / 100, 2) * 1.2
      const n = Math.min(r.y.length - 1, Math.round(sr.current * secs))
      const step = Math.max(1, Math.floor(n / 2400))
      const cxp = width / 2, cyp = height / 2, amp = Math.min(width, height) * 0.42
      const len = r.y.length
      ctx.globalCompositeOperation = 'lighter'
      ctx.strokeStyle = colour; ctx.fillStyle = colour; ctx.lineWidth = 1 * dpr; ctx.lineJoin = 'round'
      let pen = false
      if (spec.mode !== 1) ctx.beginPath()
      for (let s2 = 0; s2 < n; s2 += step) {
        const k = (r.w - n + s2 + len * 2) % len
        const d = spec.z ? (Math.max(-1, Math.min(1, r.z[k])) + 1) / 2 : 0          // 0 near … 1 far
        const sc = 1 - 0.45 * d
        const px = (cxp + Math.max(-1.2, Math.min(1.2, r.x[k] * gain)) * amp * sc) * dpr
        const py = (cyp - Math.max(-1.2, Math.min(1.2, r.y[k] * gain)) * amp * sc) * dpr
        const age = s2 / n                                                         // old … new
        if (spec.mode === 1) { ctx.globalAlpha = alpha * 0.6 * (0.15 + 0.85 * age) * (1 - 0.6 * d); ctx.fillRect(px - dpr * 0.75, py - dpr * 0.75, dpr * 1.5, dpr * 1.5) }
        else if (!pen) { ctx.moveTo(px, py); pen = true } else ctx.lineTo(px, py)
      }
      if (spec.mode !== 1) { ctx.globalAlpha = alpha * 0.34; ctx.stroke() }   // a backdrop: the prints sit on it
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
    }
    /** The room: with a z wired, a plot is drawn in space — a camera a little to the side and above,
     *  turning very slowly, so depth reads as depth. Everything lives in a −1..1 cube. */
    const camera = (now: number) => {
      const yaw = 0.52 + 0.14 * Math.sin(now / 9000), pitch = -0.34   // the eye is above the floor, looking a little down (at +0.3 it sat exactly at floor height: the floor went edge-on)
      const cy2 = Math.cos(yaw), sy2 = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch)
      const S = Math.min(width * 0.3, height * 0.36), D = 4.6   // the whole room fits the wall; a long lens, so the near corner does not balloon
      return (X: number, Y: number, Z: number): [number, number, number] => {
        const x1 = X * cy2 + Z * sy2, z1 = -X * sy2 + Z * cy2
        const y2 = Y * cp - z1 * sp, z2 = Y * sp + z1 * cp
        const f = D / (D + z2)
        return [(width / 2 + x1 * f * S) * dpr, (height * 0.47 - y2 * f * S) * dpr, f]
      }
    }
    /** The room's floor and its three axes, faint: drawn once when any plot is in space. */
    const room = (P: ReturnType<typeof camera>, colour: (a: number) => string) => {
      ctx.lineWidth = 1 * dpr
      ctx.beginPath()
      for (let k = -4; k <= 4; k++) {
        const t = k / 4 * 1.3
        let a = P(t, -1, -1.3), b = P(t, -1, 1.3); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1])
        a = P(-1.3, -1, t); b = P(1.3, -1, t); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1])
      }
      ctx.strokeStyle = colour(0.13); ctx.stroke()
      ctx.beginPath()
      const o = P(-1.3, -1, -1.3)
      for (const e of [P(1.3, -1, -1.3), P(-1.3, 1, -1.3), P(-1.3, -1, 1.3)]) { ctx.moveTo(o[0], o[1]); ctx.lineTo(e[0], e[1]) }
      ctx.strokeStyle = colour(0.34); ctx.stroke()
    }
    /** A plot in space. With an x: the points (x, y, z). Without: time runs along x, the sound stands on y, z carries it near and far. */
    const space = (r: { y: Float32Array; x: Float32Array; z: Float32Array; w: number }, spec: PlotSpec, P: ReturnType<typeof camera>, colour: string, alpha: number) => {
      const len = r.y.length, g = spec.gain
      const cl = (v: number) => Math.max(-1.2, Math.min(1.2, v))
      ctx.globalCompositeOperation = 'lighter'
      ctx.strokeStyle = colour; ctx.fillStyle = colour; ctx.lineWidth = 1 * dpr; ctx.lineJoin = 'round'
      if (spec.x) {
        const secs = 0.02 + Math.pow(Math.min(100, Math.max(0, spec.trail)) / 100, 2) * 1.2
        const n = Math.min(len - 1, Math.round(sr.current * secs)), step = Math.max(1, Math.floor(n / 2400))
        if (spec.mode !== 1) ctx.beginPath()
        let pen = false
        for (let s2 = 0; s2 < n; s2 += step) {
          const k = (r.w - n + s2 + len * 2) % len
          const q = P(cl(r.x[k] * g), cl(r.y[k] * g), cl(r.z[k]))
          if (spec.mode === 1) { ctx.globalAlpha = alpha * 0.6 * (0.15 + 0.85 * s2 / n) * Math.min(1, q[2] * q[2]); const d = dpr * 1.6 * q[2]; ctx.fillRect(q[0] - d / 2, q[1] - d / 2, d, d) }
          else if (!pen) { ctx.moveTo(q[0], q[1]); pen = true } else ctx.lineTo(q[0], q[1])
        }
        if (spec.mode !== 1) { ctx.globalAlpha = alpha * 0.4; ctx.stroke() }
      } else {
        // time along x: one column per two pixels, min and max standing on y, the column's z its depth
        const n = Math.min(len - 1, Math.round(sr.current * spec.windowS))
        const cols = Math.max(32, Math.round(width / 2)), per = n / cols
        ctx.beginPath()
        let pen = false
        for (let c = 0; c < cols; c++) {
          let lo = 1, hi = -1, zs = 0, zn = 0
          const s0 = Math.floor(c * per), s1 = Math.max(s0 + 1, Math.floor((c + 1) * per))
          for (let s2 = s0; s2 < s1; s2++) { const k = (r.w - n + s2 + len * 2) % len; const v = r.y[k]; if (v < lo) lo = v; if (v > hi) hi = v; zs += r.z[k]; zn++ }
          if (Math.max(Math.abs(lo), Math.abs(hi)) < SILENT && !(spec.y === 'value')) { pen = false; continue }
          const X = (c / (cols - 1)) * 2.6 - 1.3, Z = cl(zn ? zs / zn : 0)
          const a = P(X, cl(hi * g), Z), b = P(X, cl(lo * g), Z)
          if (spec.mode === 1) { ctx.globalAlpha = alpha * 0.55 * Math.min(1, a[2] * a[2]); const d = dpr * 1.6 * a[2]; ctx.fillRect(a[0] - d / 2, a[1] - d / 2, d, d); ctx.fillRect(b[0] - d / 2, b[1] - d / 2, d, d); continue }
          if (!pen) { ctx.moveTo(a[0], a[1]); pen = true } else ctx.lineTo(a[0], a[1])
          ctx.lineTo(b[0], b[1])
        }
        if (spec.mode !== 1) { ctx.globalAlpha = alpha * 0.55; ctx.stroke() }
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
    }
    const paperOf = (c: string): [number, number, number] => { const m = /rgb\((\d+), (\d+), (\d+)\)/.exec(c); return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [246, 243, 234] }

    let last = performance.now()
    const tick = () => {
      // a plot with no sound wire at all has no stream: its values are sampled here, on the same clock
      const now = performance.now(); const dtN = Math.min(sr.current / 10, Math.round((now - last) / 1000 * sr.current)); last = now
      for (const spec of specs.current) if (bridge && spec.y !== 'sound' && spec.x !== 'sound' && spec.z !== 'sound' && (spec.y || spec.x || spec.z) && dtN > 0) feed(spec, dtN, {})
      ctx.clearRect(0, 0, el.width, el.height)
      if (backdrop) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); backdrop(ctx); ctx.globalCompositeOperation = 'source-over' }
      // a backdrop, not a meter: quiet enough for the prints to sit on
      const live = specs.current.filter(p => p.y || p.x || p.z)
      const both = live.some(p => p.quiet) && live.some(p => !p.quiet)
      const inkA = (a: number) => ink.replace('rgb(', 'rgba(').replace(')', `, ${a})`)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      void accent
      // a z wired anywhere: the wall is a room
      const P = live.some(p => p.z) ? camera(now) : null
      if (P) room(P, inkA)
      // the quiet ones first, the lit ones over them
      for (const spec of [...live].sort((p, q) => Number(q.quiet) - Number(p.quiet))) {
        const r = rings.current.get(spec.slot); if (!r) continue
        if (spec.z && P) space(r, spec, P, spec.quiet ? inkA(0.7) : ink, spec.quiet ? 0.6 : 1)
        else if (spec.x) figure(r, spec, spec.quiet ? inkA(0.6) : ink, spec.quiet ? 0.6 : 1)
        else if (spec.quiet) trace(r.y, r.w, both ? inkA(0.22) : inkA(0.45), 1, spec.gain, spec.windowS)
        else ribbon(r.y, r.w, paperOf(ink), both ? 1 : 0.85, spec.gain, spec.windowS)
      }
      if (overlay) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); overlay(ctx); ctx.setTransform(1, 0, 0, 1, 0, 0) }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, ink, accent, overlay, backdrop, palette])

  return <canvas ref={canvas} className="sg-scope" style={{ width, height }} />
}
