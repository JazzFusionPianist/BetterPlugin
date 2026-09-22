import { callJuceNative, hasJuceNativeFunction } from './juceBridge'
import { useEffect, useState } from 'react'
import { prepareArchivedRegionBundle } from '@orb/core/lib/regionArchive.ts'
import { extractAudioTimeline } from './audioTimeline'
import type { AttachmentTimelineMetadata } from '../types/collab'

export const hasTrackExport = () => hasJuceNativeFunction('trackExport')
export function useTrackExportHost() {
  const [host, setHost] = useState('')
  useEffect(() => {
    let active = true
    if (hasJuceNativeFunction('trackExportHost'))
      void callJuceNative('trackExportHost', []).then(result => { if (active) setHost(result) })
    return () => { active = false }
  }, [])
  return { proTools: /pro tools|standalone/i.test(host) }
}

export async function prepareTrackExport(file: File) {
  const { bundle, filesByAsset } = await prepareArchivedRegionBundle(file)
  if (bundle.source?.daw !== 'Pro Tools' || !bundle.tracks.length) throw new Error('Invalid exported track layout.')
  return Promise.all(bundle.regions.map(async region => {
    const original = filesByAsset.get(region.assetId)
    if (!original || !region.start) throw new Error('Missing track audio or source position.')
    const audio = new File([original], region.name, { type: 'audio/wav' })
    const embedded = await extractAudioTimeline(audio, null)
    const metadata: AttachmentTimelineMetadata = {
      schema_version: 1, captured_at: new Date().toISOString(),
      position: { source: 'ptsl', confidence: 'exact', basis: 'project',
        source_samples: region.start.samples, sample_rate: region.start.sampleRate,
        seconds: region.start.samples / region.start.sampleRate, bit_depth: embedded?.position.bit_depth },
    }
    return { file: audio, metadata, bundle, assetId: region.assetId }
  }))
}

export interface TrackExportSnapshot {
  sessionId: string
  name: string
  sampleRate: number
  tracks: { id: string; name: string; type: string; selected: boolean; disabledReason: string | null }[]
  ranges: Record<'entire' | 'selection', { start: number; end: number } | null>
  entireError: string
}
async function request(operation: string, sessionId?: string, options?: object) {
  const raw = await callJuceNative('trackExport', [operation, ...(sessionId ? [sessionId] : []),
    ...(options ? [JSON.stringify(options)] : [])], operation === 'exportTracks' ? 1810000 : 250000)
  if (raw.startsWith('error:')) throw new Error('The Pro Tools bridge did not respond. Check the installed Slur Chat version.')
  const value = JSON.parse(raw)
  if (value.ok !== true) throw new Error(value.error || 'Pro Tools track export failed.')
  return value
}
export async function inspectDawTracks(): Promise<TrackExportSnapshot> {
  const value = await request('inspectTracks')
  if (!value.sessionId || !Array.isArray(value.tracks) || !value.ranges || !(value.sampleRate > 0))
    throw new Error('Invalid Pro Tools track list. Update the local DAW bridge.')
  return value
}
export async function exportDawTracks(snapshot: TrackExportSnapshot, trackIds: string[], mode: 'entire' | 'selection') {
  const range = snapshot.ranges[mode]
  if (!range) throw new Error('Choose a non-empty export range.')
  const value = await request('exportTracks', snapshot.sessionId,
    { trackIds, range: mode, ...range, sampleRate: snapshot.sampleRate })
  if (typeof value.data !== 'string' || !value.data.length || value.data.length > 420 * 1024 * 1024)
    throw new Error('Exported audio is missing or exceeds the 300 MB transfer limit.')
  const binary = atob(value.data), bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], 'tracks.orb-regions.zip', { type: 'application/zip' })
}
