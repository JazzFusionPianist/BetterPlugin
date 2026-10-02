import { callJuceNative, hasJuceNativeFunction, juceRegisteredFunctions } from './juceBridge'
import { regionBundleFunction } from './regionBundleProtocol'
import { downloadRegionBundle } from './regionBundleIO'
import type { BundleAudioEntry } from './regionBundle'
import { useEffect, useState } from 'react'

export const hasRegionBridge = () => regionBundleFunction(juceRegisteredFunctions()) !== null

export function useRegionHost() {
  const [host, setHost] = useState('')
  useEffect(() => {
    let active = true
    if (hasJuceNativeFunction('regionTransferHost'))
      void callJuceNative('regionTransferHost', []).then(value => { if (active) setHost(value) }).catch(() => {})
    return () => { active = false }
  }, [])
  return { logic: /logic/i.test(host), proTools: /pro tools|standalone/i.test(host) }
}

async function request(operation: 'inspect' | 'capture' | 'import' | 'exportLogic' | 'captureLogic', sessionId?: string, data?: string) {
  const args = [operation, ...(sessionId ? [sessionId] : []), ...(data ? [data] : [])]
  // Native conversion has its own four-minute deadline; the save dialog waits
  // for the user's choice and must not report a timeout after a successful save.
  const nativeFunction = regionBundleFunction(juceRegisteredFunctions())
  if (!nativeFunction) throw new Error('The region bundle bridge is unavailable.')
  const raw = await callJuceNative(nativeFunction, args, operation === 'exportLogic' ? 0 : operation.includes('Logic') ? 610000 : 250000)
  if (raw.startsWith('error:')) throw new Error('The DAW transfer did not return a result. Inspect the transfer journal before retrying.')
  const response = JSON.parse(raw) as { ok: boolean; error?: string; sessionId?: string; name?: string; data?: string; status?: string; ticket?: string }
  if (response.ok !== true) throw new Error(response.error || 'The DAW transfer failed.')
  return response
}

export async function captureRegionSelection(logic = false): Promise<File> {
  const source = logic ? null : await request('inspect')
  if (!logic && !source?.sessionId) throw new Error('No current Pro Tools session.')
  const capture = await request(logic ? 'captureLogic' : 'capture', source?.sessionId)
  if (!capture.data || capture.data.length > 420 * 1024 * 1024) throw new Error('The captured archive is missing or too large.')
  const binary = atob(capture.data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], 'selection.orb-regions.zip', { type: 'application/zip' })
}

async function encodeArchive(entries: BundleAudioEntry[], signal: AbortSignal) {
  const archive = await downloadRegionBundle(entries, signal)
  signal.throwIfAborted()
  if (archive.size > 300 * 1024 * 1024) throw new Error('The archive exceeds the native 300 MB transfer limit.')
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the region archive.'))
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.readAsDataURL(archive)
  })
  signal.throwIfAborted()
  return data
}

export async function exportLogicSelection(entries: BundleAudioEntry[], signal: AbortSignal) {
  const data = await encodeArchive(entries, signal)
  const result = await request('exportLogic', 'export', data)
  if (result.status !== 'saved' && result.status !== 'cancelled') throw new Error('Logic AAF export did not complete.')
  return result.status
}

export async function importRegionSelection(entries: BundleAudioEntry[], signal: AbortSignal) {
  const target = await request('inspect')
  if (!target.sessionId) throw new Error('No current Pro Tools session.')
  const data = await encodeArchive(entries, signal)
  const result = await request('import', target.sessionId, data)
  if (result.status !== 'complete') throw new Error('Timeline restoration was not verified.')
}
