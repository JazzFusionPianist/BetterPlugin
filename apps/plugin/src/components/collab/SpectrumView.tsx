import { useEffect, useRef } from 'react'
import { hasJuceBridge } from '../../lib/juceBridge'
import { getSpectrum, SPEC_BANDS } from '../../lib/liveHands'

/*  A spectral print's study picture: what it hears and what it does, over frequency.

    Left to right 30 Hz to 16 kHz, log. The paper line is the sound coming in; the dashed line in the print's colour is the key
    (when one is wired); the filled band is the result — the sound with the print's gain on it — so the carving or the matching
    is seen where it happens. A carve also shows its range as a lit strip; drag either edge to set it. In a plain browser a
    made-up spectrum stands in, so the picture can be seen.                                                                */

const LO_DB = -78, HI_DB = 6
const F0 = 30, F1 = 16000

export default function SpectrumView ({ slot, mode, width, height, hue, range, onRange, onGesture }: {
  slot: number
  mode: 'carve' | 'match'
  width: number
  height: number
  hue: string                                    // "r, g, b" — the print's tint
  range?: [number, number]                       // carve: from / to, hz
  onRange?: (lo: number, hi: number, final: boolean) => void
  onGesture?: (on: boolean) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const rangeRef = useRef(range); rangeRef.current = range
  const drag = useRef<'lo' | 'hi' | null>(null)
  const smooth = useRef<{ sound: number[]; key: number[]; gain: number[] } | null>(null)

  useEffect(() => {
    const el = canvas.current; if (!el) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    el.width = Math.round(width * dpr); el.height = Math.round(height * dpr)
    const ctx = el.getContext('2d'); if (!ctx) return
    const xOf = (hz: number) => (Math.log(Math.max(F0, Math.min(F1, hz)) / F0) / Math.log(F1 / F0)) * width
    const hzAt = (x: number) => F0 * Math.pow(F1 / F0, Math.max(0, Math.min(1, x / width)))
    const yOf = (db: number) => height - ((Math.max(LO_DB, Math.min(HI_DB, db)) - LO_DB) / (HI_DB - LO_DB)) * height
    const bandX = (k: number) => (k / SPEC_BANDS) * width
    let raf = 0
    const tick = () => {
      let live = hasJuceBridge ? getSpectrum(slot) : null
      if (!live) {
        // a plain browser: a made-up voice-like spectrum, breathing a little
        const t = performance.now() / 1000
        const sound: number[] = [], key: number[] = [], gain: number[] = []
        for (let k = 0; k < SPEC_BANDS; k++) {
          const f = k / SPEC_BANDS
          const s = -18 - 34 * f + 9 * Math.sin(f * 21 + t * 0.9) + 5 * Math.sin(f * 47 + t * 1.7) + 3 * Math.sin(t * 3 + k)
          const kk = -24 - 20 * f + 7 * Math.sin(f * 17 + 1.2) + 4 * Math.sin(f * 39 + 0.4)
          sound.push(s); key.push(kk)
          const r = rangeRef.current
          const inRange = !r || (hzAt(bandX(k + 0.5)) >= Math.min(r[0], r[1]) && hzAt(bandX(k + 0.5)) <= Math.max(r[0], r[1]))
          gain.push(mode === 'carve' ? (inRange ? -Math.max(0, 6 + 6 * Math.sin(f * 21 + t * 0.9)) : 0) : Math.max(-12, Math.min(12, (kk - s) * 0.6)))
        }
        live = { sound, key, gain }
      }
      // ease the picture so it breathes rather than flickers
      const sm = smooth.current
      if (!sm) smooth.current = { sound: [...live.sound], key: [...live.key], gain: [...live.gain] }
      else for (let k = 0; k < SPEC_BANDS; k++) { sm.sound[k] += (live.sound[k] - sm.sound[k]) * 0.35; sm.key[k] += (live.key[k] - sm.key[k]) * 0.35; sm.gain[k] += (live.gain[k] - sm.gain[k]) * 0.35 }
      const s = smooth.current!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      // the rule: a few frequencies, and the 0 dB line
      ctx.strokeStyle = 'rgba(246, 243, 234, 0.08)'; ctx.lineWidth = 1
      for (const hz of [100, 1000, 10000]) { const x = Math.round(xOf(hz)) + 0.5; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke() }
      ctx.font = '10px "Space Mono", ui-monospace, monospace'; ctx.fillStyle = 'rgba(246, 243, 234, 0.35)'; ctx.textAlign = 'center'
      for (const [hz, w] of [[100, '100'], [1000, '1k'], [10000, '10k']] as Array<[number, string]>) ctx.fillText(w, xOf(hz), height - 4)
      // carve: the range as a lit strip, its edges the handles
      const r = rangeRef.current
      if (mode === 'carve' && r) {
        const x0 = xOf(Math.min(r[0], r[1])), x1 = xOf(Math.max(r[0], r[1]))
        ctx.fillStyle = `rgba(${hue}, 0.08)`; ctx.fillRect(x0, 0, x1 - x0, height)
        ctx.strokeStyle = `rgba(${hue}, 0.7)`; ctx.lineWidth = 1
        for (const x of [x0, x1]) { const xx = Math.round(x) + 0.5; ctx.beginPath(); ctx.moveTo(xx, 0); ctx.lineTo(xx, height); ctx.stroke() }
      }
      const path = (arr: number[]) => { ctx.beginPath(); for (let k = 0; k < SPEC_BANDS; k++) { const x = bandX(k + 0.5), y = yOf(arr[k]); if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y) } }
      // the key, dashed, in the print's colour (only when one is heard)
      const keyed = s.key.some(v => v > -110)
      if (keyed) { ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = `rgba(${hue}, 0.75)`; ctx.lineWidth = 1.2; path(s.key); ctx.stroke(); ctx.restore() }
      // the result: the sound with the gain on it, filled to the floor in the print's colour
      const result = s.sound.map((v, k) => v + s.gain[k])
      path(result); ctx.lineTo(bandX(SPEC_BANDS - 0.5), height); ctx.lineTo(bandX(0.5), height); ctx.closePath()
      ctx.fillStyle = `rgba(${hue}, 0.28)`; ctx.fill()
      path(result); ctx.strokeStyle = `rgba(${hue}, 1)`; ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.stroke()
      // the sound as it came, in paper, over it
      path(s.sound); ctx.strokeStyle = 'rgba(246, 243, 234, 0.8)'; ctx.lineWidth = 1.1; ctx.stroke()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [slot, mode, width, height, hue])

  const hzAt = (clientX: number) => {
    const el = canvas.current; if (!el) return 1000
    const rect = el.getBoundingClientRect()
    const t = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.round(F0 * Math.pow(F1 / F0, t))
  }
  const xOf = (hz: number) => { const el = canvas.current; if (!el) return 0; const rect = el.getBoundingClientRect(); return rect.left + (Math.log(Math.max(F0, Math.min(F1, hz)) / F0) / Math.log(F1 / F0)) * rect.width }

  return (
    <canvas ref={canvas} className="fx-hot" style={{ width, height, display: 'block', cursor: mode === 'carve' ? 'ew-resize' : 'default', touchAction: 'none' }}
      onPointerDown={(e) => {
        if (mode !== 'carve' || !range || !onRange) return
        e.stopPropagation(); e.preventDefault()
        try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* fine */ }
        const dLo = Math.abs(e.clientX - xOf(Math.min(range[0], range[1]))), dHi = Math.abs(e.clientX - xOf(Math.max(range[0], range[1])))
        drag.current = dLo <= dHi ? 'lo' : 'hi'
        onGesture?.(true)
        const hz = hzAt(e.clientX)
        onRange(drag.current === 'lo' ? hz : Math.min(range[0], range[1]), drag.current === 'hi' ? hz : Math.max(range[0], range[1]), false)
      }}
      onPointerMove={(e) => {
        if (!drag.current || !range || !onRange) return
        const hz = hzAt(e.clientX)
        const lo = Math.min(range[0], range[1]), hi = Math.max(range[0], range[1])
        onRange(drag.current === 'lo' ? Math.min(hz, hi) : lo, drag.current === 'hi' ? Math.max(hz, lo) : hi, false)
      }}
      onPointerUp={() => { if (!drag.current || !range || !onRange) return; drag.current = null; onRange(Math.min(range[0], range[1]), Math.max(range[0], range[1]), true); onGesture?.(false) }} />
  )
}
