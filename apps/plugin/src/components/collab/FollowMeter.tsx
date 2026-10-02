import { useEffect, useRef } from 'react'
import { hasJuceBridge } from '../../lib/juceBridge'

/*  The follow's meter — what it hears against where its threshold is.

    Time runs right to left. The grey body is the sound coming in (after
    `sense`), in dB. The bright line is the follow's own envelope: the
    same sound through `attack` and `release`. The ruled line is the
    threshold: whatever of the envelope stands above it is what the
    follow sends out (the threshold is 0, the top of the scale is 1).
    Drag the threshold line to set it.                                 */

const SECONDS = 6
const FLOOR = -60   // dB at the bottom; the top is 0

export default function FollowMeter ({ slot, threshold, width, height, boxWidth, hue, onThreshold, onGesture }: {
  boxWidth?: number                 // the box it sits in, if narrower: the meter centres itself over it
  slot: number
  threshold: number                 // dB
  width: number
  height: number
  hue: string                       // "r, g, b": the threshold's colour (its row's in the study)
  onThreshold: (db: number, final: boolean) => void
  onGesture?: (on: boolean) => void   // the finger lands on / leaves the threshold (the host records automation in between)
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const hist = useRef<{ t: number; inDb: number; envDb: number }[]>([])
  const thr = useRef(threshold); thr.current = threshold
  const drag = useRef(false)
  const toDb = (a: number) => (a <= 1e-6 ? -120 : 20 * Math.log10(a))

  useEffect(() => {
    hist.current = []
    if (hasJuceBridge) {
      const onAudio = (e: Event) => {
        const d = (e as CustomEvent).detail as { fin?: number[]; fenv?: number[] }
        if (!Array.isArray(d.fin) || !Array.isArray(d.fenv)) return
        const now = performance.now()
        hist.current.push({ t: now, inDb: toDb(Number(d.fin[slot]) || 0), envDb: toDb(Number(d.fenv[slot]) || 0) })
        while (hist.current.length && now - hist.current[0].t > SECONDS * 1000 + 200) hist.current.shift()
      }
      window.addEventListener('__juceDawAudio', onAudio)
      return () => window.removeEventListener('__juceDawAudio', onAudio)
    }
    // a plain browser: a made-up kick pattern, so the meter can be seen
    let env = 0
    const id = setInterval(() => {
      const now = performance.now(), beat = (now / 1000 * 2) % 1
      const x = Math.pow(10, (-6 - 46 * Math.min(1, beat * 2.2) + (Math.random() - 0.5) * 3) / 20)
      env += (x > env ? 0.8 : 0.12) * (x - env)
      hist.current.push({ t: now, inDb: toDb(x), envDb: toDb(env) })
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
      // the scale
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
        // what comes in: a grey body
        ctx.beginPath(); ctx.moveTo(xOf(h[0].t), yOf(FLOOR))
        for (const p of h) ctx.lineTo(xOf(p.t), yOf(p.inDb))
        ctx.lineTo(xOf(h[h.length - 1].t), yOf(FLOOR)); ctx.closePath()
        ctx.fillStyle = ink(0.16); ctx.fill()
        // what stands above the threshold, lit in the threshold's colour: this is what goes out
        ctx.save()
        ctx.beginPath(); ctx.rect(padL, padT, W, Math.max(0, yOf(thr.current) - padT)); ctx.clip()
        ctx.beginPath(); ctx.moveTo(xOf(h[0].t), yOf(FLOOR))
        for (const p of h) ctx.lineTo(xOf(p.t), yOf(p.envDb))
        ctx.lineTo(xOf(h[h.length - 1].t), yOf(FLOOR)); ctx.closePath()
        ctx.fillStyle = `rgba(${hue}, 0.28)`; ctx.fill()
        ctx.restore()
        // the envelope: the sound through attack and release
        ctx.beginPath()
        h.forEach((p, i) => (i === 0 ? ctx.moveTo(xOf(p.t), yOf(p.envDb)) : ctx.lineTo(xOf(p.t), yOf(p.envDb))))
        ctx.strokeStyle = ink(0.9); ctx.lineWidth = 1.2; ctx.lineJoin = 'round'; ctx.stroke()
      }
      // the threshold
      const ty = Math.round(yOf(thr.current)) + 0.5
      ctx.strokeStyle = `rgb(${hue})`; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(padL, ty); ctx.lineTo(width, ty); ctx.stroke()
      ctx.fillStyle = `rgb(${hue})`; ctx.fillRect(width - 5, ty - 4.5, 5, 9)
      ctx.textAlign = 'left'; ctx.fillText(`${Math.round(thr.current)} dB`, padL + 5, ty - 8)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [width, height, hue])

  const dbAt = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const f = 1 - (e.clientY - r.top - 6) / (height - 12)
    return Math.round(Math.max(-60, Math.min(-1, FLOOR + f * -FLOOR)))
  }
  return (
    <canvas ref={canvas} className="sg-follow-meter" style={{ width, height, cursor: 'ns-resize', display: 'block', touchAction: 'none', flex: 'none', marginLeft: boxWidth !== undefined ? (boxWidth - width) / 2 : undefined }}
      onPointerDown={(e) => { e.stopPropagation(); drag.current = true; try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* fine */ } onGesture?.(true); onThreshold(dbAt(e), false) }}
      onPointerMove={(e) => { if (drag.current) onThreshold(dbAt(e), false) }}
      onPointerUp={(e) => { if (drag.current) { drag.current = false; onThreshold(dbAt(e), true); onGesture?.(false) } }} />
  )
}
