/**
 * One-knob FX bridge. The eleven effects live in the JUCE processor
 * (setFx / getFx native functions); one runs at a time. In a plain
 * browser the setters no-op and the getter resolves to defaults so the
 * panel still renders.
 */

import { callJuceNative, hasJuceNativeFunction } from './juceBridge'

export type FxMode = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27
/** Slots: 0..10 the first prints, 11 the mix (no memory), 12..27 the newer prints. */
export const FX_COUNT = 28

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
  amounts: [0.5, 0, 0, 0, 0, 0.75, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0.5, 0, 0, 0],
  variants: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
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
/** Graph-only splitters: two output ports. l/r gives the left and the
 *  right as mono lanes; m/s the mid and the side. Lanes that meet again
 *  (or reach out) join back into a stereo pair. */
export const FX_SPLIT_LR = 28
export const FX_SPLIT_MS = 29
/** Control nodes: no audio passes through them. An lfo is a drawn shape;
 *  a rate is a clock that plays a shape into a hand of another print. */
export const FX_LFO = 30
export const FX_RATE = 31
/** A knob the host can turn (macro 1 … 8): played into hands, or onto a control wire's depth. */
export const FX_MACRO = 32
export const FX_MACROS = 8
/** The sidechain: `side` is the host's side bus as a print (no input, one output);
 *  `follow` listens to whatever is wired into it and pushes a hand with what it hears. */
export const FX_SIDE = 33
export const FX_FOLLOW = 34
/** The wall's picture: whatever is wired into a plot's y, x, z is drawn behind the prints. No output. */
export const FX_PLOT = 35
/** The wall's format: 2 = the picture is made by plot prints (older patches get the two stock ones on load). */
export const FX_GRAPH_V = 2
/** Picture prints live outside the engine's sixteen slots: ids 16..47. */
export const FX_PICTURE_ID0 = 16
export const FX_GRAPH_NODES = 48
export const FX_PORT_IN = -1
export const FX_PORT_OUT = -2
export const FX_MAX_NODES = 16
/** The graph-only nodes: no hand, no lamp, no bypass. */
export const isUtilityType = (t: number) => t === FX_MIX_TYPE || t === FX_SPLIT_LR || t === FX_SPLIT_MS || t === FX_LFO || t === FX_RATE || t === FX_MACRO || t === FX_SIDE || t === FX_FOLLOW || t === FX_PLOT || (t >= 36 && t <= 40)   // …and the picture's memory, index, decibel, offset, scale
export const isSplitterType = (t: number) => t === FX_SPLIT_LR || t === FX_SPLIT_MS
export const isControlType = (t: number) => t === FX_LFO || t === FX_RATE || t === FX_MACRO || t === FX_FOLLOW
/** The prints whose wire lands on a hand (a dashed control wire). */
export const playsHandsType = (t: number) => t === FX_RATE || t === FX_MACRO || t === FX_FOLLOW
/** The prints with a second input, the key: their detector listens to it (glue, gate). */
export const hasKeyType = (t: number) => t === 4 || t === 26
/** A print's extra input points: which input, where (degrees below the main one), and its word. */
export const extraInputsOf = (t: number): Array<{ in: number; ang: number; word: string }> =>
  (hasKeyType(t) ? [{ in: 1, ang: 42, word: 'key' }] : t === FX_PLOT ? [{ in: 1, ang: -42, word: 'x' }, { in: 2, ang: 42, word: 'z' }] : [])
/** The prints nothing leaves. */
export const noOutputType = (t: number) => t === FX_PLOT
/** The prints with no input point: the shapes and the sources. */
export const noInputType = (t: number) => t === FX_LFO || t === FX_SIDE
/** The prints whose big number is a hand of their own (the effects, and a macro's knob). */
export const hasAmountType = (t: number) => !isUtilityType(t) || t === FX_MACRO
/** A control wire's target: a hand, or another control wire ("wire:<from>:<hand>") whose depth it sets. */
export const wireRef = (hand: string | undefined): { from: number; hand: string } | null => {
  if (!hand || !hand.startsWith('wire:')) return null
  const i = hand.indexOf(':', 5)
  return i < 0 ? null : { from: Number(hand.slice(5, i)), hand: hand.slice(i + 1) }
}

export interface FxGraphNode {
  id: number
  type: number            // FxMode | FX_MIX_TYPE
  amount: number
  variant: number
  decay: number[]         // [hall, room, plate]
  delayDiv: number
  delayFb: number
  wet: boolean            // Wet Solo — drop the dry on space/delay/doubler/mod/harmony
  bypass?: boolean        // the print hangs there, the signal passes it by
  aux: number[]           // tremolo [vol|pan]; arp [interval st]; harmony [key root, scale, degrees];
                          // grain [size ms, spray ms, scatter st, key, scale, pan %, pitch mode, freeze] (8 slots)
  curve?: number[]        // tremolo: a drawn cycle (32 points, 0..1) overriding the shape; lfo: its shape as 64 samples
  pts?: number[]          // lfo: the drawn points, flat [x, y, bend, …] (see LfoEditor)
  x: number
  y: number
}
export interface FxGraphEdge {
  from: number; to: number
  gain: number            // an audio wire's send level; a control wire's depth (-1..1)
  port?: number           // which output of `from` (a splitter has two)
  in?: number             // which input of `to`: 1 = its key (glue and gate listen to it)
  hand?: string           // a control wire: which hand of `to` it plays (amount, decay, fb, aux0…)
}

export interface FxGraph { nodes: FxGraphNode[]; edges: FxGraphEdge[]; v?: number }

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
/** The wall's finger lands on (or leaves) a print's amount: the host records automation in between. */
export function paramGesture (slot: number, begin: boolean, hand = 'amount'): void {
  if (!hasJuceNativeFunction('gesture')) return
  void callJuceNative('gesture', [slot, begin, hand]).catch(() => {})
}

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

/** The OS save panel ("save as…"): resolves to the saved name, or null
 *  if cancelled / unavailable (a plain browser has no panel). */
export function hasPresetDialogs (): boolean { return hasJuceNativeFunction('savePresetDialog') }
export async function savePresetDialog (g: FxGraph, suggested: string): Promise<string | null> {
  if (!hasPresetDialogs()) return null
  try {
    const raw: unknown = await callJuceNative('savePresetDialog', [JSON.stringify(g), suggested], 600000)
    return typeof raw === 'string' && raw && !raw.startsWith('error:') ? raw : null
  } catch { return null }
}
/** The OS open panel: resolves to { name, graph } or null. */
export async function openPresetDialog (): Promise<{ name: string; graph: FxGraph } | null> {
  if (!hasPresetDialogs()) return null
  try {
    const raw: unknown = await callJuceNative('openPresetDialog', [], 600000)
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!v || typeof v !== 'object') return null
    const o = v as { name?: string; json?: string }
    const g = o.json ? JSON.parse(o.json) as FxGraph : null
    return g && Array.isArray(g.nodes) && o.name ? { name: o.name, graph: g } : null
  } catch { return null }
}
