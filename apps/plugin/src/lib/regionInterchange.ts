import { callJuceNative, hasJuceNativeFunction, juceRegisteredFunctions } from './juceBridge'
import { regionBundleFunction } from './regionBundleProtocol'
import { downloadAudio } from './audioDownloads'
import { hasCompleteLayout, type RegionBundle } from '@orb/core/lib/regionBundle.ts'
import { createRegionArchive } from '@orb/core/lib/regionArchive.ts'

const toBase64 = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let p = 0; p < bytes.length; p += 0x8000) binary += String.fromCharCode(...bytes.subarray(p, p + 0x8000))
  return btoa(binary)
}

/** Sender: one AAF holding every track and region position, attached beside the stems.
 * Returns null when this build/host cannot make one or the layout is incomplete. */
export async function buildRegionAaf(prepared: { bundle: RegionBundle; filesByAsset: Map<string, File> }, name: string): Promise<File | null> {
  if (!hasCompleteLayout(prepared.bundle) || regionBundleFunction(juceRegisteredFunctions()) !== 'regionBundleTransfer') return null
  const archive = await createRegionArchive(prepared)
  if (archive.size > 300 * 1024 * 1024) throw new Error('Regions are too large for an AAF (300 MB).')
  const raw = await callJuceNative('regionBundleTransfer', ['buildAaf', 'aaf', await toBase64(archive)], 250000)
  let result: { ok?: boolean; error?: string; data?: string }
  try { result = JSON.parse(raw) } catch { throw new Error('The AAF converter is not installed. Reinstall Slur.') }
  if (result.ok !== true || typeof result.data !== 'string') throw new Error(result.error || 'Could not create the AAF.')
  const bytes = Uint8Array.from(atob(result.data), c => c.charCodeAt(0))
  const safe = name.replace(/[/\\:]/g, '_').replace(/\.aaf$/i, '').slice(0, 100) || 'Slur Regions'
  return new File([bytes], `${safe}.aaf`, { type: 'application/octet-stream' })
}

/** Receiver: fetch the attached AAF and save it where the user chooses. */
export async function saveInterchangeFile(file: { url: string; name: string; bytes: number }): Promise<'saved' | 'cancelled'> {
  const data = await downloadAudio(file.url)
  if (data.bytes !== file.bytes) throw new Error('The AAF download is incomplete. Try again.')
  if (hasJuceNativeFunction('saveInterchangeFile')) {
    const result = await callJuceNative('saveInterchangeFile', [data.base64, file.name], 0)
    if (result === 'saved' || result === 'cancelled') return result
    throw new Error('Could not save the AAF.')
  }
  // Browser: a save picker where available, otherwise the browser's download.
  const blob = new Blob([Uint8Array.from(atob(data.base64), c => c.charCodeAt(0))], { type: 'application/octet-stream' })
  const picker = (window as unknown as { showSaveFilePicker?: (o: object) => Promise<{ createWritable(): Promise<{ write(b: Blob): Promise<void>; close(): Promise<void> }> }> }).showSaveFilePicker
  if (picker) {
    try {
      const handle = await picker({ suggestedName: file.name, types: [{ description: 'AAF', accept: { 'application/octet-stream': ['.aaf'] } }] })
      const writable = await handle.createWritable(); await writable.write(blob); await writable.close()
      return 'saved'
    } catch (e) { if ((e as Error).name === 'AbortError') return 'cancelled'; throw e }
  }
  const href = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = href; link.download = file.name; link.click()
  window.setTimeout(() => URL.revokeObjectURL(href), 60_000)
  return 'saved'
}
