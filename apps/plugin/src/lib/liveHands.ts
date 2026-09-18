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
let have = false
const subs = new Set<() => void>()
const notify = () => { for (const s of subs) s() }

if (typeof window !== 'undefined' && hasJuceBridge) {
  window.addEventListener('__juceDawAudio', (e: Event) => {
    const d = (e as CustomEvent).detail as { live?: number[][] }
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
