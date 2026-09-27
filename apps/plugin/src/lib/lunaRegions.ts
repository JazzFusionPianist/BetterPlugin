import { useEffect, useState } from 'react'
import { callJuceNative, hasJuceNativeFunction } from './juceBridge'
export interface LunaRegionSnapshot {
  sessionId: string; name: string; sampleRate: number; revision: string
  regions: { id: string; name: string; trackName: string; start?: number; sampleRate?: number; disabledReason: string | null }[]
}
export interface LunaDestination { sessionId: string; name: string; sampleRate: number }
export function useLunaRegionTransfer() {
  const [supported, setSupported] = useState(false)
  useEffect(() => {
    let active = true
    if (hasJuceNativeFunction('regionTransfer') && hasJuceNativeFunction('trackExportHost'))
      void callJuceNative('trackExportHost', []).then(host => { if (active) setSupported(host === 'LUNA' || host === 'Standalone') }).catch(() => {})
    return () => { active = false }
  }, [])
  return supported
}
async function request(operation: string, sessionId?: string, options?: object) {
  const raw = await callJuceNative('regionTransfer', [operation, ...(sessionId ? [sessionId] : []),
    ...(options ? [JSON.stringify(options)] : [])], operation.startsWith('inspect') ? 250000 : 1810000)
  let result
  try { result = JSON.parse(raw) } catch { throw new Error('The installed region bridge returned no valid response.') }
  if (result.ok !== true) throw new Error(result.error || 'LUNA region transfer failed.')
  return result
}
export async function inspectLunaRegions(): Promise<LunaRegionSnapshot> { return request('inspectLunaRegions') }
export async function inspectLunaDestination(): Promise<LunaDestination> { return request('inspectLunaDestination') }
export async function captureLunaRegions(snapshot: LunaRegionSnapshot, regionIds: string[]) {
  const result = await request('exportLunaRegions', snapshot.sessionId, { regionIds, revision: snapshot.revision })
  if (typeof result.data !== 'string' || !result.data.length || result.data.length > 400 * 1024 * 1024)
    throw new Error('Missing or oversized region archive.')
  const decoded = atob(result.data), bytes = new Uint8Array(decoded.length)
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i)
  return new File([bytes], 'regions.slur-regions.zip', { type: 'application/zip' })
}
export async function restoreLunaRegions(destination: LunaDestination, archive: File) {
  if (archive.size > 298 * 1024 * 1024) throw new Error('LUNA restoration is limited to 300 MB.')
  const bytes = new Uint8Array(await archive.arrayBuffer())
  let encoded = ''
  for (let p = 0; p < bytes.length; p += 0x8000) encoded += String.fromCharCode(...bytes.subarray(p, p + 0x8000))
  return request('importLunaRegions', destination.sessionId, { archive: btoa(encoded) })
}
