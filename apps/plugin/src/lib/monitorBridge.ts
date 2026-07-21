/**
 * Monitor-section bridge: fader / balance / polarity / mute parameters
 * living in the JUCE processor. In a regular browser the native functions
 * are absent — setters no-op and the getter resolves to defaults, so the
 * panel still renders (with a demo signal for the meters).
 */

import { callJuceNative, hasJuceNativeFunction } from './juceBridge'

export interface MonitorState {
  gainDb: number   // -60 (== -inf) .. +6
  pan: number      // -1 .. 1
  invL: boolean
  invR: boolean
  mute: boolean
}

export const MONITOR_DEFAULTS: MonitorState = {
  gainDb: 0, pan: 0, invL: false, invR: false, mute: false,
}

export function hasMonitorBridge (): boolean {
  return hasJuceNativeFunction('setMonitor')
}

export async function getMonitor (): Promise<MonitorState> {
  if (!hasMonitorBridge()) return { ...MONITOR_DEFAULTS }
  try {
    const raw: unknown = await callJuceNative('getMonitor')
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (v && typeof v === 'object' && !String(v).startsWith('error:'))
      return { ...MONITOR_DEFAULTS, ...(v as Partial<MonitorState>) }
  } catch { /* fall through to defaults */ }
  return { ...MONITOR_DEFAULTS }
}

export function setMonitor (patch: Partial<MonitorState>): void {
  if (!hasMonitorBridge()) return
  void callJuceNative('setMonitor', [patch]).catch(() => {})
}
