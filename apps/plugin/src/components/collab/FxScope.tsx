import { useEffect, useRef } from 'react'
import { hasJuceBridge } from '../../lib/juceBridge'

/*  The scope: what the plugin hears (input, before the patch) and what
    leaves it (output, after), as live waveforms in the wall's corner.
    Both are drawn from the same clock so, side by side, the patch's
    work is visible as the difference between two traces — input in the
    wall's ink, quiet; output in the second ink over it.               */

const WINDOW_S = 0.16          // seconds of signal across the wall
const RING_S = 3               // seconds kept (the widest window is 2 s)

interface Props {
  input: boolean
  output: boolean
  width: number
  height: number
  ink: string                  // the wall's ink, "rgb(r, g, b)"
  accent: string               // the second ink
  gain?: number                // vertical zoom: 1 = full scale fills 84% of the wall
  windowS?: number             // horizontal zoom: seconds edge to edge
}

function decode (b64: string): Float32Array | null {
  try {
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new Float32Array(bytes.buffer)
  } catch { return null }
}

export default function FxScope ({ input, output, width, height, ink, accent, gain = 1, windowS = WINDOW_S }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const sr = useRef(48000)
  const ringIn = useRef(new Float32Array(48000 * RING_S))
  const ringOut = useRef(new Float32Array(48000 * RING_S))
  const wIn = useRef(0), wOut = useRef(0)
  const bridge = hasJuceBridge

  // ── feed ──────────────────────────────────────────────────────────
  useEffect(() => {
    const push = (ring: Float32Array, w: { current: number }, mono: Float32Array) => {
      for (let i = 0; i < mono.length; i++) { ring[w.current] = mono[i]; w.current = (w.current + 1) % ring.length }
    }
    const toMono = (f: Float32Array, ch: number) => {
      const n = Math.floor(f.length / ch)
      const m = new Float32Array(n)
      for (let i = 0; i < n; i++) { let s = 0; for (let c = 0; c < ch; c++) s += f[i * ch + c]; m[i] = s / ch }
      return m
    }
    if (bridge) {
      const onAudio = (e: Event) => {
        const d = (e as CustomEvent).detail as { samples?: string; inSamples?: string; sr?: number; ch?: number }
        const ch = Math.max(1, d.ch ?? 2)
        if (d.sr && d.sr !== sr.current) {
          sr.current = d.sr
          ringIn.current = new Float32Array(d.sr * RING_S); ringOut.current = new Float32Array(d.sr * RING_S)
          wIn.current = 0; wOut.current = 0
        }
        const out = d.samples ? decode(d.samples) : null
        const inp = d.inSamples ? decode(d.inSamples) : null
        if (out) push(ringOut.current, wOut, toMono(out, ch))
        if (inp) push(ringIn.current, wIn, toMono(inp, ch))
        else if (out) push(ringIn.current, wIn, new Float32Array(Math.floor(out.length / ch)))   // keep the clocks together
      }
      window.addEventListener('__juceDawAudio', onAudio)
      return () => window.removeEventListener('__juceDawAudio', onAudio)
    }
    // plain browser: a test tone so the scope has something to show —
    // the "output" is the tone through a make-believe patch
    let t = 0
    const id = setInterval(() => {
      const n = Math.round(sr.current / 30)
      const a = new Float32Array(n), b = new Float32Array(n)
      for (let i = 0; i < n; i++) {
        const x = t / sr.current
        const env = 0.5 + 0.5 * Math.sin(2 * Math.PI * 1.3 * x)
        const s = (Math.sin(2 * Math.PI * 110 * x) * 0.5 + Math.sin(2 * Math.PI * 330 * x) * 0.2) * env
        a[i] = s
        b[i] = Math.tanh(s * 2.2) * 0.7 * (0.6 + 0.4 * Math.sin(2 * Math.PI * 6 * x))
        t++
      }
      push(ringIn.current, wIn, a); push(ringOut.current, wOut, b)
    }, 1000 / 30)
    return () => clearInterval(id)
  }, [bridge])

  // ── draw ──────────────────────────────────────────────────────────
  useEffect(() => {
    const el = canvas.current; if (!el) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    el.width = Math.round(width * dpr); el.height = Math.round(height * dpr)
    const ctx = el.getContext('2d'); if (!ctx) return
    let raf = 0
    const SILENT = 0.002   // ≈ −54 dBFS: below this there is nothing to draw
    const trace = (ring: Float32Array, w: number, colour: string, lw: number) => {
      const n = Math.min(ring.length - 1, Math.round(sr.current * windowS))
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
    const tick = () => {
      ctx.clearRect(0, 0, el.width, el.height)
      // a backdrop, not a meter: quiet enough for the prints to sit on
      const both = input && output
      const inkA = (a: number) => ink.replace('rgb(', 'rgba(').replace(')', `, ${a})`)
      const accA = (a: number) => accent.replace('rgb(', 'rgba(').replace(')', `, ${a})`)
      if (input) trace(ringIn.current, wIn.current, both ? inkA(0.26) : inkA(0.5), 1)
      if (output) trace(ringOut.current, wOut.current, both ? (accent.startsWith('rgb(') ? accA(0.7) : accent) : inkA(0.5), 1.2)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [input, output, width, height, ink, accent, gain, windowS])

  return <canvas ref={canvas} className="sg-scope" style={{ width, height }} />
}
