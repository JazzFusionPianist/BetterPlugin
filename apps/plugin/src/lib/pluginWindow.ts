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
export function compactPluginWindow () { return setPluginSize(COMPACT_W, COMPACT_H) }

export const isExpandSupported = () =>
  hasJuceBridge && hasJuceNativeFunction('setPluginSize')
