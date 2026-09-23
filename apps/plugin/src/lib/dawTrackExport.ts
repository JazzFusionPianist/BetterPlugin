import { callJuceNative, hasJuceNativeFunction } from './juceBridge'
import { useEffect, useState } from 'react'
import { prepareArchivedRegionBundle } from '@orb/core/lib/regionArchive.ts'
import { extractAudioTimeline } from './audioTimeline'
import type { AttachmentTimelineMetadata } from '../types/collab'

export const hasTrackExport = () => hasJuceNativeFunction('trackExport')
export type TrackExportDaw = 'Pro Tools' | 'LUNA'
export function useTrackExportHost() {
  const [host, setHost] = useState('')
  const [adapters, setAdapters] = useState<TrackExportDaw[]>(['Pro Tools'])
  useEffect(() => {
    let active = true
    if (hasJuceNativeFunction('trackExportHost'))
      void callJuceNative('trackExportHost', []).then(result => { if (active) setHost(result) })
    if (hasJuceNativeFunction('trackExportCapabilities'))
      void callJuceNative('trackExportCapabilities', []).then(result => {
        try {
          const ids = JSON.parse(result).adapters
          if (active && Array.isArray(ids)) setAdapters(ids.filter((id): id is TrackExportDaw => id === 'Pro Tools' || id === 'LUNA'))
        } catch { /* Older native builds retain Pro Tools-only support. */ }
      })
    return () => { active = false }
  }, [])
  return { name: host, standalone: host === 'Standalone', adapters,
    supported: host === 'Standalone' || adapters.includes(host as TrackExportDaw) }
}

export async function prepareTrackExport(file: File) {
  const { bundle, filesByAsset } = await prepareArchivedRegionBundle(file)
  if (!['Pro Tools', 'LUNA'].includes(bundle.source?.daw ?? '') || !bundle.tracks.length) throw new Error('Invalid exported track layout.')
  return Promise.all(bundle.regions.map(async region => {
    const original = filesByAsset.get(region.assetId)
    if (!original || !region.start) throw new Error('Missing track audio or source position.')
    const audio = new File([original], region.name, { type: 'audio/wav' })
    const embedded = await extractAudioTimeline(audio, null)
    const metadata: AttachmentTimelineMetadata = {
      schema_version: 1, captured_at: new Date().toISOString(),
      position: { source: bundle.source?.daw === 'LUNA' ? 'luna' : 'ptsl', confidence: 'exact', basis: 'project',
        source_samples: region.start.samples, sample_rate: region.start.sampleRate,
        seconds: region.start.samples / region.start.sampleRate, bit_depth: embedded?.position.bit_depth },
    }
    return { file: audio, metadata, bundle, assetId: region.assetId }
  }))
}

export interface TrackExportSnapshot {
  daw?: TrackExportDaw
  rangeNote?: string
  sessionId: string
  name: string
  sampleRate: number
  tracks: { id: string; name: string; type: string; selected: boolean; disabledReason: string | null }[]
  ranges: Record<'entire' | 'selection', { start: number; end: number } | null>
  entireError: string
}
async function request(operation: string, sessionId?: string, options?: object) {
  const raw = await callJuceNative('trackExport', [operation, ...(sessionId ? [sessionId] : []),
    ...(options ? [JSON.stringify(options)] : [])], operation.startsWith('export') ? 1810000 : 250000)
  if (raw.startsWith('error:')) throw new Error('The DAW bridge did not respond. Check the installed Slur version.')
  const value = JSON.parse(raw)
  if (value.ok !== true) throw new Error(value.error || 'DAW track export failed.')
  return value
}
export async function inspectDawTracks(daw: TrackExportDaw = 'Pro Tools'): Promise<TrackExportSnapshot> {
  const value = await request(daw === 'LUNA' ? 'inspectLunaTracks' : 'inspectTracks')
  if (!value.sessionId || !Array.isArray(value.tracks) || !value.ranges || !(value.sampleRate > 0))
    throw new Error('Invalid DAW track list. Update the local DAW bridge.')
  return { ...value, daw }
}
export async function exportDawTracks(snapshot: TrackExportSnapshot, trackIds: string[], mode: 'entire' | 'selection') {
  const range = snapshot.ranges[mode]
  if (!range) throw new Error('Choose a non-empty export range.')
  const value = await request(snapshot.daw === 'LUNA' ? 'exportLunaTracks' : 'exportTracks', snapshot.sessionId,
    { trackIds, range: mode, ...range, sampleRate: snapshot.sampleRate })
  if (typeof value.data !== 'string' || !value.data.length || value.data.length > 420 * 1024 * 1024)
    throw new Error('Exported audio is missing or exceeds the 300 MB transfer limit.')
  const binary = atob(value.data), bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], 'tracks.orb-regions.zip', { type: 'application/zip' })
}
