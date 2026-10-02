import { useEffect, useState, useSyncExternalStore } from 'react'
import { hasCompleteLayout, type RegionBundle } from '@orb/core/lib/regionBundle.ts'
import { createRegionArchive } from '@orb/core/lib/regionArchive.ts'
import { callJuceNative, hasJuceNativeFunction } from '../../lib/juceBridge'
import { downloadAudio } from '../../lib/audioDownloads'
import { audioDownloadCache } from '../../lib/audioDownloadCache'

type Host = 'Pro Tools' | 'LUNA'
type Status = { phase: 'busy' | 'done' | 'uncertain'; text: string }
// Survives disclosure unmounts. Per-region reservations also prevent row/all overlap.
const reservations = new Map<string, Status>()
const listeners = new Set<() => void>()
let revision = 0
const notify = () => { revision++; listeners.forEach(fn => fn()) }
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
async function request(operation: string, sessionId?: string, archive?: string) {
  const raw = await callJuceNative('regionTransfer', [operation, ...(sessionId ? [sessionId] : []),
    ...(archive ? [JSON.stringify({ archive })] : [])], operation.startsWith('inspect') ? 250000 : 1810000)
  let result
  try { result = JSON.parse(raw) } catch { throw new Error('No valid response from the installed region bridge.') }
  if (result.ok !== true) throw new Error(result.error || 'Could not place the regions.')
  return result
}

export default function PlaceRegionsButton({ bundle, entries }: {
  bundle: RegionBundle; entries: { assetId?: string; url: string }[]
}) {
  const [host, setHost] = useState<Host | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [destinationName, setDestinationName] = useState('')
  useSyncExternalStore(subscribe, () => revision, () => revision)
  useEffect(() => {
    let active = true
    if (hasJuceNativeFunction('regionTransfer') && hasJuceNativeFunction('trackExportHost'))
      void callJuceNative('trackExportHost', []).then(h => {
        if (active && (h === 'Pro Tools' || h === 'LUNA')) setHost(h)
      }).catch(() => {})
    return () => { active = false }
  }, [])
  if (!host || !hasCompleteLayout(bundle)) return null
  const prefix = `${audioDownloadCache.scope()}:${host}:${bundle.source!.projectId}:${bundle.source!.captureId}:`
  const keys = bundle.regions.map(r => prefix + r.id)
  const states = keys.map(k => reservations.get(k))
  const blocked = states.some(Boolean)
  const done = states.every(s => s?.phase === 'done')
  const uncertain = states.some(s => s?.phase === 'uncertain')
  const inProgress = states.some(s => s?.phase === 'busy')
  const place = async () => {
    if (busy || keys.some(k => reservations.has(k))) return
    keys.forEach(k => reservations.set(k, { phase: 'busy', text: 'Preparing…' })); notify()
    setBusy(true); setError('')
    const accountScope = audioDownloadCache.scope()
    const checkAccount = () => { if (audioDownloadCache.scope() !== accountScope) throw new Error('Placement cancelled: account changed.') }
    let started = false
    try {
      const adapter = host === 'Pro Tools' ? 'ProTools' : 'Luna'
      const destination = await request(`inspect${adapter}Destination`)
      checkAccount()
      if (!destination.sessionId || !destination.name) throw new Error('No named destination session.')
      setDestinationName(destination.name)
      const filesByAsset = new Map<string, File>()
      for (const asset of bundle.assets) {
        checkAccount()
        const entry = entries.find(e => e.assetId === asset.id)
        if (!entry) throw new Error('Missing region audio.')
        const data = await downloadAudio(entry.url)
        if (data.bytes !== asset.bytes) throw new Error('Region audio size mismatch.')
        const decoded = atob(data.base64), bytes = Uint8Array.from(decoded, c => c.charCodeAt(0))
        filesByAsset.set(asset.id, new File([bytes], asset.name))
      }
      const archive = await createRegionArchive({ bundle, filesByAsset }) // verifies SHA and manifest
      if (archive.size > 298 * 1024 * 1024) throw new Error('Automatic placement is limited to 300 MB.')
      const bytes = new Uint8Array(await archive.arrayBuffer())
      let binary = ''
      for (let p = 0; p < bytes.length; p += 0x8000) binary += String.fromCharCode(...bytes.subarray(p, p + 0x8000))
      checkAccount(); started = true
      await request(`import${adapter}Regions`, destination.sessionId, btoa(binary))
      keys.forEach(k => reservations.set(k, { phase: 'done', text: `Placed in ${destination.name}` }))
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setError(message)
      keys.forEach(k => started ? reservations.set(k, { phase: 'uncertain', text: message }) : reservations.delete(k))
    } finally { setBusy(false); notify() }
  }
  return <span className="slur-region-placement">
    <button className="wd-word" type="button" disabled={busy || blocked} onClick={() => void place()}
      title={`Create new tracks in the current ${host} session at the original elapsed-time positions. Existing tracks and tempo map stay unchanged.`}>
      {done ? 'Placed ✓' : busy || inProgress ? 'Placing…' : uncertain ? 'Check session' : blocked ? 'Partly placed' : 'Place at original position'}
    </button>
    {destinationName && <small> {destinationName}</small>}
    {(error || uncertain) && <span role="alert"> {error || states.find(s => s?.phase === 'uncertain')?.text}</span>}
  </span>
}
