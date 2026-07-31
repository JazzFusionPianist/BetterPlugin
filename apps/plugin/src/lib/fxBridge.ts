/**
 * One-knob FX bridge. The five effects live in the JUCE processor
 * (setFx / getFx native functions); in a plain browser the setters
 * no-op and the getter resolves to defaults so the panel still renders.
 */

import { callJuceNative, hasJuceNativeFunction } from './juceBridge'

export type FxMode = 0 | 1 | 2 | 3 | 4 | 5 | 6
export const FX_COUNT = 7

export interface FxState {
  mode: FxMode
  /** One remembered amount per mode; amounts[0] (tone) is bipolar around 0.5
   *  and amounts[5] (gain) is a fader with unity at 0.75. */
  amounts: number[]
  /** Sub-flavour per mode: tape 0=hard 1=clean; space 0=hall 1=room 2=plate;
   *  gain is a polarity bitmask (bit0 = invert L, bit1 = invert R);
   *  mod 0=chorus 1=flanger 2=phaser. */
  variants: number[]
  /** Space's second hand: decay per flavour [hall, room, plate], 0.5 = stock. */
  decays: number[]
}

export const FX_DEFAULTS: FxState = {
  mode: 0,
  amounts: [0.5, 0, 0, 0, 0, 0.75, 0],
  variants: [0, 0, 0, 0, 0, 0, 0],
  decays: [0.5, 0.5, 0.5],
}

export function hasFxBridge (): boolean {
  return hasJuceNativeFunction('setFx')
}

export async function getFx (): Promise<FxState> {
  const fallback = (): FxState =>
    ({ ...FX_DEFAULTS, amounts: [...FX_DEFAULTS.amounts], variants: [...FX_DEFAULTS.variants] })
  if (!hasFxBridge()) return fallback()
  try {
    const raw: unknown = await callJuceNative('getFx')
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (v && typeof v === 'object' && Array.isArray((v as FxState).amounts))
      return {
        mode: Math.min(FX_COUNT - 1, Math.max(0, (v as FxState).mode ?? 0)) as FxMode,
        amounts: FX_DEFAULTS.amounts.map((d, i) => {
          const n = Number((v as FxState).amounts[i])
          return isFinite(n) ? Math.min(1, Math.max(0, n)) : d
        }),
        variants: FX_DEFAULTS.variants.map((d, i) => {
          const n = Number((v as FxState).variants?.[i])
          return isFinite(n) ? Math.min(3, Math.max(0, Math.round(n))) : d
        }),
        decays: FX_DEFAULTS.decays.map((d, i) => {
          const n = Number((v as FxState).decays?.[i])
          return isFinite(n) ? Math.min(1, Math.max(0, n)) : d
        }),
      }
  } catch { /* fall through */ }
  return fallback()
}

export function setFx (patch: { mode?: FxMode; amount?: number; variant?: number; decay?: number }): void {
  if (!hasFxBridge()) return
  void callJuceNative('setFx', [patch]).catch(() => {})
}
