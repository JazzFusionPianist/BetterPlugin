/**
 * One-knob FX bridge. The five effects live in the JUCE processor
 * (setFx / getFx native functions); in a plain browser the setters
 * no-op and the getter resolves to defaults so the panel still renders.
 */

import { callJuceNative, hasJuceNativeFunction } from './juceBridge'

export type FxMode = 0 | 1 | 2 | 3 | 4
export const FX_COUNT = 5

export interface FxState {
  mode: FxMode
  /** One remembered amount per mode; amounts[0] (tone) is bipolar around 0.5. */
  amounts: number[]
}

export const FX_DEFAULTS: FxState = {
  mode: 0,
  amounts: [0.5, 0, 0, 0, 0],
}

export function hasFxBridge (): boolean {
  return hasJuceNativeFunction('setFx')
}

export async function getFx (): Promise<FxState> {
  if (!hasFxBridge()) return { ...FX_DEFAULTS, amounts: [...FX_DEFAULTS.amounts] }
  try {
    const raw: unknown = await callJuceNative('getFx')
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (v && typeof v === 'object' && Array.isArray((v as FxState).amounts))
      return {
        mode: Math.min(4, Math.max(0, (v as FxState).mode ?? 0)) as FxMode,
        amounts: FX_DEFAULTS.amounts.map((d, i) => {
          const n = Number((v as FxState).amounts[i])
          return isFinite(n) ? Math.min(1, Math.max(0, n)) : d
        }),
      }
  } catch { /* fall through */ }
  return { ...FX_DEFAULTS, amounts: [...FX_DEFAULTS.amounts] }
}

export function setFx (patch: { mode?: FxMode; amount?: number }): void {
  if (!hasFxBridge()) return
  void callJuceNative('setFx', [patch]).catch(() => {})
}
