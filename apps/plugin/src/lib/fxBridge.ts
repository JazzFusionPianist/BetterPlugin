/**
 * One-knob FX bridge. The effects live in the JUCE processor
 * (setFx / getFx native functions); in a plain browser the setters
 * no-op and the getter resolves to defaults so the panel still renders.
 *
 * v2: eleven effects and a CHAIN — any subset can be enabled at once
 * (`enabled` bitmask, bit = FxMode). The processor runs them in a fixed
 * studio order; `mode` is just the plate the room is looking at.
 */

import { callJuceNative, hasJuceNativeFunction } from './juceBridge'

export type FxMode = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
export const FX_COUNT = 11

export interface FxState {
  mode: FxMode
  /** One remembered amount per mode; amounts[0] (tone) is bipolar around 0.5
   *  and amounts[5] (gain) is a fader with unity at 0.75. */
  amounts: number[]
  /** Sub-flavour per mode: tape 0=hard 1=clean; space 0=hall 1=room 2=plate;
   *  gain is a polarity bitmask (bit0 = invert L, bit1 = invert R);
   *  mod 0=chorus 1=flanger 2=phaser; cut 0=low 1=high 2=band;
   *  amp 0=crunch 1=lead 2=fuzz; doubler 0=tight 1=wide;
   *  delay 0=clean 1=tape 2=pingpong. */
  variants: number[]
  /** Space's second hand: decay per flavour [hall, room, plate], 0.5 = stock. */
  decays: number[]
  /** Chain membership — one bit per FxMode. */
  enabled: number
  /** Delay's two hands: division index into {1/16, 1/8t, 1/8, 1/8., 1/4,
   *  1/4., 1/2} and feedback 0..1. */
  delayDiv: number
  delayFb: number
}

export const FX_DEFAULTS: FxState = {
  mode: 0,
  amounts: [0.5, 0, 0, 0, 0, 0.75, 0, 0, 0, 0, 0],
  variants: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  decays: [0.5, 0.5, 0.5],
  enabled: 0,
  delayDiv: 2,
  delayFb: 0.35,
}

export function hasFxBridge (): boolean {
  return hasJuceNativeFunction('setFx')
}

export async function getFx (): Promise<FxState> {
  const fallback = (): FxState => ({
    ...FX_DEFAULTS,
    amounts: [...FX_DEFAULTS.amounts],
    variants: [...FX_DEFAULTS.variants],
    decays: [...FX_DEFAULTS.decays],
  })
  if (!hasFxBridge()) return fallback()
  try {
    const raw: unknown = await callJuceNative('getFx')
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (v && typeof v === 'object' && Array.isArray((v as FxState).amounts)) {
      const s = v as Partial<FxState>
      return {
        mode: Math.min(FX_COUNT - 1, Math.max(0, s.mode ?? 0)) as FxMode,
        amounts: FX_DEFAULTS.amounts.map((d, i) => {
          const n = Number(s.amounts?.[i])
          return isFinite(n) ? Math.min(1, Math.max(0, n)) : d
        }),
        variants: FX_DEFAULTS.variants.map((d, i) => {
          const n = Number(s.variants?.[i])
          return isFinite(n) ? Math.min(3, Math.max(0, Math.round(n))) : d
        }),
        decays: FX_DEFAULTS.decays.map((d, i) => {
          const n = Number(s.decays?.[i])
          return isFinite(n) ? Math.min(1, Math.max(0, n)) : d
        }),
        enabled: isFinite(Number(s.enabled)) ? (Number(s.enabled) & ((1 << FX_COUNT) - 1)) : 0,
        delayDiv: isFinite(Number(s.delayDiv)) ? Math.min(6, Math.max(0, Math.round(Number(s.delayDiv)))) : 2,
        delayFb: isFinite(Number(s.delayFb)) ? Math.min(1, Math.max(0, Number(s.delayFb))) : 0.35,
      }
    }
  } catch { /* fall through */ }
  return fallback()
}

export function setFx (patch: {
  mode?: FxMode
  amount?: number
  variant?: number
  decay?: number
  enabled?: boolean
  delayDiv?: number
  delayFb?: number
}): void {
  if (!hasFxBridge()) return
  void callJuceNative('setFx', [patch]).catch(() => {})
}
