/**
 * Programmatic plugin-window sizing via the JUCE bridge.
 * Used by the Expand View button on the live viewer to make the plugin
 * window wider for landscape video viewing, then restore on collapse.
 *
 * No-op in the browser preview (no JUCE bridge available).
 */
import { callJuceNative, hasJuceBridge, hasJuceNativeFunction } from './juceBridge'

/** Default compact size used by the editor. Keep in sync with PluginEditor kWidth/kHeight. */
export const COMPACT_W = 300
export const COMPACT_H = 500
/** Wide layout for landscape live viewing. */
export const EXPANDED_W = 720
export const EXPANDED_H = 460

/**
 * User-selectable plugin-window sizes (Display ▸ Screen size).
 * The window grows but the inner UI keeps its pixel sizes — the layout
 * simply spreads out into the extra room. 'small' is the original
 * 300×500 shell (100%); 'medium' is 150% of that; 'large' keeps medium's
 * height and widens to a 16:9 monitor ratio. All within the editor's
 * resize limits (PluginEditor setResizeLimits → max 1600×1200).
 */
export type ScreenSize = 'small' | 'medium' | 'large'
const MED_H = COMPACT_H * 1.5 // 750 — also large's (fixed) height
export const SCREEN_SIZES: Record<ScreenSize, { w: number; h: number }> = {
  small:  { w: COMPACT_W,       h: COMPACT_H },                // 300 × 500  (100%)
  medium: { w: COMPACT_W * 1.5, h: MED_H },                   // 450 × 750  (150%)
  large:  { w: Math.round(MED_H * 16 / 9), h: MED_H },        // 1333 × 750 (16:9)
}

/**
 * The user's chosen base window size. Live-view "Expand" temporarily grows
 * past this for landscape video, then restores back to it (not a hardcoded
 * 300×500) on collapse so a Medium/Large preference survives a live session.
 */
let _baseSize = SCREEN_SIZES.small

/** Record the base size without resizing (used to keep restore-on-collapse correct). */
export function setBaseScreenSize (size: ScreenSize) { _baseSize = SCREEN_SIZES[size] }

/** Apply a Screen size: remember it as the base and resize the host window now. */
export function applyScreenSize (size: ScreenSize) {
  setBaseScreenSize(size)
  const { w, h } = SCREEN_SIZES[size]
  return setPluginSize(w, h)
}

export async function setPluginSize (width: number, height: number): Promise<boolean> {
  if (!hasJuceBridge || !hasJuceNativeFunction('setPluginSize')) return false
  try {
    const r = await callJuceNative('setPluginSize', [width, height], 2000)
    return r.startsWith('ok')
  } catch (e) {
    console.warn('[pluginWindow] setPluginSize failed', e)
    return false
  }
}

export function expandPluginWindow () { return setPluginSize(EXPANDED_W, EXPANDED_H) }
/** Restore to the user's chosen base size (defaults to compact 300×500). */
export function compactPluginWindow () { return setPluginSize(_baseSize.w, _baseSize.h) }

export const isExpandSupported = () =>
  hasJuceBridge && hasJuceNativeFunction('setPluginSize')
