/**
 * One-knob FX bridge. The eleven effects live in the JUCE processor
 * (setFx / getFx native functions); one runs at a time. In a plain
 * browser the setters no-op and the getter resolves to defaults so the
 * panel still renders.
 */

import { callJuceNative, hasJuceNativeFunction } from './juceBridge'

export type FxMode = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 12 | 13 | 14 | 15
/** Slots: 0..10 the first prints, 11 the mix (no memory), 12..15 the newer prints. */
export const FX_COUNT = 16

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
  /** Delay's two hands: division index into {1/16, 1/8t, 1/8, 1/8., 1/4,
   *  1/4., 1/2} and feedback 0..1. */
  delayDiv: number
  delayFb: number
  /** True when the running JUCE binary predates the new prints (its getFx
   *  reported fewer than FX_COUNT amounts) — cut/amp/doubler/delay would
   *  alias onto the old engine's modes until the plugin is rebuilt. */
  stale: boolean
}

export const FX_DEFAULTS: FxState = {
  mode: 0,
  amounts: [0.5, 0, 0, 0, 0, 0.75, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  variants: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  decays: [0.5, 0.5, 0.5],
  delayDiv: 2,
  delayFb: 0.35,
  stale: false,
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
          return isFinite(n) ? Math.min(7, Math.max(0, Math.round(n))) : d
        }),
        decays: FX_DEFAULTS.decays.map((d, i) => {
          const n = Number(s.decays?.[i])
          return isFinite(n) ? Math.min(1, Math.max(0, n)) : d
        }),
        delayDiv: isFinite(Number(s.delayDiv)) ? Math.min(6, Math.max(0, Math.round(Number(s.delayDiv)))) : 2,
        delayFb: isFinite(Number(s.delayFb)) ? Math.min(1, Math.max(0, Number(s.delayFb))) : 0.35,
        stale: (s.amounts?.length ?? 0) < FX_COUNT,
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
  delayDiv?: number
  delayFb?: number
}): void {
  if (!hasFxBridge()) return
  void callJuceNative('setFx', [patch]).catch(() => {})
}

/* ── The patchable wall (Orb Sounds) ──────────────────────────────────
   A patch is nodes + wires. Node ids double as engine slots (0..15);
   type 0..10 are the prints, 11 is `mix`. Wires run from a node id (or
   -1 = in) to a node id (or -2 = out) with a send level. Feedback is
   refused by the engine ("cycle"). */
export const FX_MIX_TYPE = 11
export const FX_PORT_IN = -1
export const FX_PORT_OUT = -2
export const FX_MAX_NODES = 16

export interface FxGraphNode {
  id: number
  type: number            // FxMode | FX_MIX_TYPE
  amount: number
  variant: number
  decay: number[]         // [hall, room, plate]
  delayDiv: number
  delayFb: number
  wet: boolean            // Wet Solo — drop the dry on space/delay/doubler/mod/harmony
  aux: number[]           // tremolo [vol|pan]; arp [interval st]; harmony [key root, scale, degrees]
  curve?: number[]        // tremolo: a drawn cycle (32 points, 0..1) overriding the shape
  x: number
  y: number
}
export interface FxGraphEdge { from: number; to: number; gain: number }
export interface FxGraph { nodes: FxGraphNode[]; edges: FxGraphEdge[] }

export function hasGraphBridge (): boolean {
  return hasJuceNativeFunction('setGraph')
}

export async function getGraph (): Promise<FxGraph | null> {
  if (!hasGraphBridge()) return null
  try {
    const raw: unknown = await callJuceNative('getGraph')
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (v && typeof v === 'object' && Array.isArray((v as FxGraph).nodes) && Array.isArray((v as FxGraph).edges)) return v as FxGraph
  } catch { /* fall through */ }
  return null
}

/** Push a whole patch; resolves to the engine's verdict. */
export async function setGraph (g: FxGraph): Promise<{ ok: boolean; error?: string }> {
  if (!hasGraphBridge()) return { ok: false, error: 'no bridge' }
  try {
    const raw: unknown = await callJuceNative('setGraph', [JSON.stringify(g)])
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (v && typeof v === 'object') return v as { ok: boolean; error?: string }
  } catch (e) { return { ok: false, error: String(e) } }
  return { ok: false, error: 'bad reply' }
}

/** Ask the plugin to tap its input (before the patch) into the audio
 *  events as `inSamples`, for the wall's scope. */
export function setScopeInput (on: boolean): void {
  if (!hasJuceNativeFunction('setScopeInput')) return
  void callJuceNative('setScopeInput', [on]).catch(() => {})
}

/* ── Presets: the wall's patches as files the user owns ─────────────
   In the plugin: ~/Library/Application Support/Orb/Sounds/Presets/
   <name>.orbpatch (JSON). In a plain browser: localStorage stands in. */
const PRESET_LS = 'orb_wall_presets'
function lsPresets (): Record<string, FxGraph> {
  try { return JSON.parse(localStorage.getItem(PRESET_LS) || '{}') as Record<string, FxGraph> } catch { return {} }
}
export function hasPresetFiles (): boolean { return hasJuceNativeFunction('listPresets') }

export async function listPresets (): Promise<string[]> {
  if (hasPresetFiles()) {
    try {
      const raw: unknown = await callJuceNative('listPresets')
      const v = typeof raw === 'string' ? JSON.parse(raw) : raw
      return Array.isArray(v) ? v.map(String) : []
    } catch { return [] }
  }
  return Object.keys(lsPresets()).sort()
}
export async function savePreset (name: string, g: FxGraph): Promise<boolean> {
  if (hasPresetFiles()) {
    try { const r: unknown = await callJuceNative('savePreset', [name, JSON.stringify(g)]); return r === true || r === 'true' } catch { return false }
  }
  const all = lsPresets(); all[name] = g
  try { localStorage.setItem(PRESET_LS, JSON.stringify(all)); return true } catch { return false }
}
export async function loadPreset (name: string): Promise<FxGraph | null> {
  if (hasPresetFiles()) {
    try {
      const raw: unknown = await callJuceNative('loadPreset', [name])
      const v = typeof raw === 'string' ? JSON.parse(raw) : raw
      return v && Array.isArray((v as FxGraph).nodes) ? v as FxGraph : null
    } catch { return null }
  }
  return lsPresets()[name] ?? null
}
export async function deletePreset (name: string): Promise<boolean> {
  if (hasPresetFiles()) {
    try { const r: unknown = await callJuceNative('deletePreset', [name]); return r === true || r === 'true' } catch { return false }
  }
  const all = lsPresets(); delete all[name]
  try { localStorage.setItem(PRESET_LS, JSON.stringify(all)); return true } catch { return false }
}
