import { useSyncExternalStore } from 'react'
import { hasJuceBridge } from './juceBridge'

/*  What the engine is actually playing, hand by hand — after the rates,
    the macros and the follows have pushed. The study shows these numbers
    moving on a played hand; the wall's own values (the settings) stay.

    Twelve per slot, in the host's order: amount, mode, decay, feedback,
    time, wet, aux 1..6. Nothing arrives in a plain browser.             */

export const LIVE_HANDS = 12
export const LIVE_INDEX: Record<string, number> = { amount: 0, variant: 1, decay: 2, fb: 3, div: 4, wet: 5, aux0: 6, aux1: 7, aux2: 8, aux3: 9, aux4: 10, aux5: 11 }

const live = new Float32Array(16 * LIVE_HANDS)
const lfoPhase = new Float32Array(16), lfoCycle = new Float64Array(16)
export const SPEC_BANDS = 40   // a spectral print's meter: 40 log bands, 30 Hz .. 16 kHz
const spectra = new Map<number, number[]>()   // slot → [sound dB × 40, key dB × 40, gain dB × 40]
let lfoAt = 0
let have = false
const subs = new Set<() => void>()
const notify = () => { for (const s of subs) s() }

if (typeof window !== 'undefined' && hasJuceBridge) {
  window.addEventListener('__juceDawAudio', (e: Event) => {
    const d = (e as CustomEvent).detail as { live?: number[][]; lph?: number[]; lcy?: number[]; spec?: number[][] }
    if (Array.isArray(d.lph)) for (let i = 0; i < 16; i++) { lfoPhase[i] = Number(d.lph[i]) || 0; lfoCycle[i] = Number(d.lcy?.[i]) || 0 }
    if (Array.isArray(d.spec)) { spectra.clear(); for (const row of d.spec) if (Array.isArray(row) && row.length === 1 + SPEC_BANDS * 3) spectra.set(Number(row[0]), row.slice(1).map(Number)) }
    lfoAt = performance.now()
    if (!Array.isArray(d.live)) return
    let changed = !have
    for (let i = 0; i < 16 && i < d.live.length; i++) {
      const h = d.live[i]; if (!Array.isArray(h)) continue
      for (let k = 0; k < LIVE_HANDS && k < h.length; k++) {
        const v = Number(h[k]); if (!Number.isFinite(v)) continue
        if (live[i * LIVE_HANDS + k] !== v) { live[i * LIVE_HANDS + k] = v; changed = true }
      }
    }
    have = true
    if (changed) notify()
  })
}

const subscribe = (cb: () => void) => { subs.add(cb); return () => { subs.delete(cb) } }

/** The engine's value of one hand right now, or undefined (no engine, or no hand asked for). */
export function useLiveHand (slot: number, k: number): number | undefined {
  return useSyncExternalStore(subscribe, () => (have && slot >= 0 && slot < 16 && k >= 0 && k < LIVE_HANDS ? live[slot * LIVE_HANDS + k] : undefined))
}

/** The same, read once (for a draw loop, not a component). */
export function getLiveHand (slot: number, k: number): number | undefined {
  return have && slot >= 0 && slot < 16 && k >= 0 && k < LIVE_HANDS ? live[slot * LIVE_HANDS + k] : undefined
}

/** Where an lfo is in its shape right now (0..1) and which turn of it this is; in a plain browser a slow made-up clock, so the editor can be seen moving. */
export function getLfoClock (slot: number): { phase: number; cycle: number } {
  if (!hasJuceBridge || lfoAt === 0) { const t = performance.now() / 2400; return { phase: t - Math.floor(t), cycle: Math.floor(t) } }
  return { phase: lfoPhase[slot] ?? 0, cycle: lfoCycle[slot] ?? 0 }
}

/** A spectral print's meter right now (the engine's last frame): the sound, the key and the gain in dB over SPEC_BANDS log bands, or null (no engine, or not a spectral print). */
export function getSpectrum (slot: number): { sound: number[]; key: number[]; gain: number[] } | null {
  const r = spectra.get(slot); if (!r) return null
  return { sound: r.slice(0, SPEC_BANDS), key: r.slice(SPEC_BANDS, 2 * SPEC_BANDS), gain: r.slice(2 * SPEC_BANDS) }
}
/** The band's centre frequency, for drawing. */
export const specHz = (k: number) => 30 * Math.pow(16000 / 30, (k + 0.5) / SPEC_BANDS)
