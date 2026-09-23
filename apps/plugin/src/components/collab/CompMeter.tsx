import { useEffect, useRef } from 'react'
import { hasJuceBridge } from '../../lib/juceBridge'

/*  The comp's meter — what it hears, where its threshold is, how much
    it takes away.

    Time runs right to left. The grey body is the key coming in (the
    sound itself, or whatever lands on the key point), in dB. The ruled
    line is the threshold: drag it to set it. What the comp takes away
    hangs from the top as a band in the row's colour, on the same dB
    scale, so "−6 dB of reduction" is six dB tall.                     */

const SECONDS = 6
const FLOOR = -60   // dB at the bottom; the top is 0

export default function CompMeter ({ slot, threshold, width, height, boxWidth, hue, onThreshold, onGesture }: {
  boxWidth?: number
  slot: number
  threshold: number                 // dB, −60..0
  width: number
  height: number
  hue: string                       // "r, g, b"
  onThreshold: (db: number, final: boolean) => void
  onGesture?: (on: boolean) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const hist = useRef<{ t: number; inDb: number; gr: number }[]>([])
  const thr = useRef(threshold); thr.current = threshold
  const drag = useRef(false)
  const toDb = (a: number) => (a <= 1e-6 ? -120 : 20 * Math.log10(a))

  useEffect(() => {
    hist.current = []
    if (hasJuceBridge) {
      const onAudio = (e: Event) => {
        const d = (e as CustomEvent).detail as { cin?: number[]; cgr?: number[] }
        if (!Array.isArray(d.cin) || !Array.isArray(d.cgr)) return
        const now = performance.now()
        hist.current.push({ t: now, inDb: toDb(Number(d.cin[slot]) || 0), gr: Number(d.cgr[slot]) || 0 })
        while (hist.current.length && now - hist.current[0].t > SECONDS * 1000 + 200) hist.current.shift()
      }
      window.addEventListener('__juceDawAudio', onAudio)
      return () => window.removeEventListener('__juceDawAudio', onAudio)
    }
    // a plain browser: a made-up drum pattern against the threshold, so the meter can be seen
    let env = -60
    const id = setInterval(() => {
      const now = performance.now(), beat = (now / 1000 * 2) % 1
      const inDb = -8 - 40 * Math.min(1, beat * 2.2) + (Math.random() - 0.5) * 3
      env += (inDb > env ? 0.7 : 0.1) * (inDb - env)
      const over = env - thr.current
      hist.current.push({ t: now, inDb, gr: over > 0 ? over * 0.75 : 0 })
      while (hist.current.length && now - hist.current[0].t > SECONDS * 1000 + 200) hist.current.shift()
    }, 1000 / 30)
    return () => clearInterval(id)
  }, [slot])

  useEffect(() => {
    const el = canvas.current; if (!el) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    el.width = Math.round(width * dpr); el.height = Math.round(height * dpr)
    const ctx = el.getContext('2d'); if (!ctx) return
    let raf = 0
    const padL = 30, padT = 6, padB = 6
    const W = width - padL, H = height - padT - padB
    const yOf = (db: number) => padT + (1 - (Math.max(FLOOR, Math.min(0, db)) - FLOOR) / -FLOOR) * H
    const ink = (a: number) => `rgba(246, 243, 234, ${a})`
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const now = performance.now()
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      ctx.font = "9px 'Space Mono', monospace"; ctx.textBaseline = 'middle'; ctx.textAlign = 'right'
      for (const db of [0, -12, -24, -36, -48, -60]) {
        const y = Math.round(yOf(db)) + 0.5
        ctx.strokeStyle = ink(db === 0 ? 0.22 : 0.08); ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(width, y); ctx.stroke()
        ctx.fillStyle = ink(0.42); ctx.fillText(String(db), padL - 6, y)
      }
      const h = hist.current
      const xOf = (t: number) => padL + W * (1 - (now - t) / (SECONDS * 1000))
      if (h.length > 1) {
        // the key: a grey body
        ctx.beginPath(); ctx.moveTo(xOf(h[0].t), yOf(FLOOR))
        for (const p of h) ctx.lineTo(xOf(p.t), yOf(p.inDb))
        ctx.lineTo(xOf(h[h.length - 1].t), yOf(FLOOR)); ctx.closePath()
        ctx.fillStyle = ink(0.16); ctx.fill()
        ctx.beginPath(); h.forEach((p, i) => (i === 0 ? ctx.moveTo(xOf(p.t), yOf(p.inDb)) : ctx.lineTo(xOf(p.t), yOf(p.inDb))))
        ctx.strokeStyle = ink(0.5); ctx.lineWidth = 1; ctx.stroke()
        // the reduction: a band hanging from the top, as many dB tall as it takes away
        ctx.beginPath(); ctx.moveTo(xOf(h[0].t), yOf(0))
        for (const p of h) ctx.lineTo(xOf(p.t), yOf(-p.gr))
        ctx.lineTo(xOf(h[h.length - 1].t), yOf(0)); ctx.closePath()
        ctx.fillStyle = `rgba(${hue}, 0.38)`; ctx.fill()
        ctx.beginPath(); h.forEach((p, i) => (i === 0 ? ctx.moveTo(xOf(p.t), yOf(-p.gr)) : ctx.lineTo(xOf(p.t), yOf(-p.gr))))
        ctx.strokeStyle = `rgb(${hue})`; ctx.lineWidth = 1.2; ctx.stroke()
        const grNow = h[h.length - 1].gr
        ctx.textAlign = 'right'; ctx.fillStyle = `rgb(${hue})`; ctx.fillText(`−${grNow.toFixed(1)} dB`, width - 4, yOf(-grNow) + 9)
      }
      // the threshold
      const ty = Math.round(yOf(thr.current)) + 0.5
      ctx.strokeStyle = ink(0.85); ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(padL, ty); ctx.lineTo(width, ty); ctx.stroke()
      ctx.fillStyle = ink(0.85); ctx.fillRect(width - 5, ty - 4.5, 5, 9)
      ctx.textAlign = 'left'; ctx.fillText(`${Math.round(thr.current)} dB`, padL + 5, ty - 8)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [width, height, hue])

  const dbAt = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const f = 1 - (e.clientY - r.top - 6) / (height - 12)
    return Math.round(Math.max(-60, Math.min(0, FLOOR + f * -FLOOR)))
  }
  return (
    <canvas ref={canvas} className="sg-follow-meter" style={{ width, height, cursor: 'ns-resize', display: 'block', touchAction: 'none', flex: 'none', marginLeft: boxWidth !== undefined ? (boxWidth - width) / 2 : undefined }}
      onPointerDown={(e) => { e.stopPropagation(); drag.current = true; try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* fine */ } onGesture?.(true); onThreshold(dbAt(e), false) }}
      onPointerMove={(e) => { if (drag.current) onThreshold(dbAt(e), false) }}
      onPointerUp={(e) => { if (drag.current) { drag.current = false; onThreshold(dbAt(e), true); onGesture?.(false) } }} />
  )
}
