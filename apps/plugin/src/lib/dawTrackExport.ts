import { callJuceNative, hasJuceNativeFunction } from './juceBridge'
import { useEffect, useState } from 'react'
import { prepareArchivedRegionBundle } from '@orb/core/lib/regionArchive.ts'
import { extractAudioTimeline } from './audioTimeline'
import type { AttachmentTimelineMetadata } from '../types/collab'
import { trackRoutes, type TrackRoute } from '@orb/core/lib/stemRoutes.ts'

export const hasTrackExport = () => hasJuceNativeFunction('trackExport')
export type { TrackRoute }

/** Host name + the track routes this native build and host support, best first. */
export function useTrackExportHost() {
  const [host, setHost] = useState('')
  const [native, setNative] = useState<TrackRoute[]>(['ptsl'])
  useEffect(() => {
    let active = true
    if (hasJuceNativeFunction('trackExportHost'))
      void callJuceNative('trackExportHost', []).then(result => { if (active) setHost(result) })
    if (hasJuceNativeFunction('trackExportCapabilities'))
      void callJuceNative('trackExportCapabilities', []).then(result => {
        try {
          const ids: string[] = JSON.parse(result).adapters
          if (active && Array.isArray(ids)) setNative((['ptsl', 'reaper', 'tap'] as const).filter(r =>
            ids.includes(r === 'ptsl' ? 'Pro Tools' : r === 'reaper' ? 'REAPER' : 'Slur Tap')))
        } catch { /* Older native builds retain Pro Tools-only support. */ }
      })
    return () => { active = false }
  }, [])
  const routes = host ? trackRoutes(host).filter(r => native.includes(r)) : []
  return { name: host, standalone: host === 'Standalone', routes, supported: routes.length > 0 }
}

const SOURCES: Record<string, AttachmentTimelineMetadata['position']['source']> = {
  'Pro Tools': 'ptsl', LUNA: 'luna', 'Logic Pro': 'logic_export', REAPER: 'reaper', 'Slur Tap': 'slur_tap',
}
export async function prepareTrackExport(file: File) {
  const { bundle, filesByAsset } = await prepareArchivedRegionBundle(file)
  const source = SOURCES[bundle.source?.daw ?? '']
  if (!source || !bundle.tracks.length) throw new Error('Invalid exported track layout.')
  return Promise.all(bundle.regions.map(async region => {
    const original = filesByAsset.get(region.assetId)
    if (!original || !region.start) throw new Error('Missing track audio or source position.')
    const audio = new File([original], region.name.endsWith('.wav') ? region.name : `${region.name}.wav`, { type: 'audio/wav' })
    const embedded = await extractAudioTimeline(audio, null)
    const metadata: AttachmentTimelineMetadata = {
      schema_version: 1, captured_at: new Date().toISOString(),
      position: { source, confidence: 'exact', basis: 'project',
        source_samples: region.start.samples, sample_rate: region.start.sampleRate,
        seconds: region.start.samples / region.start.sampleRate, bit_depth: embedded?.position.bit_depth },
    }
    return { file: audio, metadata, bundle, assetId: region.assetId }
  }))
}

type Range = { start: number; end: number; nativeLabel?: never } | { nativeLabel: string; start?: never; end?: never }
export interface TrackExportSnapshot {
  route: TrackRoute
  daw?: string
  rangeNote?: string
  sessionId: string
  name: string
  sampleRate: number | null
  revision?: string
  tracks: { id: string; name: string; type: string; selected: boolean; disabledReason: string | null; spans?: [number, number, number][] }[]
  ranges: Record<'entire' | 'selection', Range | null>
  entireError: string
}

const OPS: Record<TrackRoute, { inspect: string; range: string | null; export: string }> = {
  ptsl: { inspect: 'inspectTracks', range: 'inspectTrackRange', export: 'exportTracks' },
  reaper: { inspect: 'inspectReaperTracks', range: 'inspectReaperTrackRange', export: 'exportReaperTracks' },
  tap: { inspect: 'inspectTapTracks', range: null, export: 'exportTapTracks' },
}

async function request(operation: string, sessionId?: string, options?: object) {
  const raw = await callJuceNative('trackExport', [operation, ...(sessionId ? [sessionId] : []),
    ...(options ? [JSON.stringify(options)] : [])], operation.endsWith('TrackRange') ? 6000 : operation.startsWith('export') ? 1810000 : 250000)
  if (raw.startsWith('error:')) throw new Error('The DAW bridge did not respond. Check the installed Slur version.')
  const value = JSON.parse(raw)
  if (value.ok !== true) throw new Error(value.error || 'DAW track export failed.')
  return value
}

/** Route availability right now: REAPER bridge running, number of live Slur Taps. */
export async function stemStatus(): Promise<{ reaper: { installed: boolean; connected: boolean }; taps: number }> {
  return request('stemStatus')
}

export async function inspectDawTracks(route: TrackRoute): Promise<TrackExportSnapshot> {
  const value = await request(OPS[route].inspect)
  if (!value.sessionId || !Array.isArray(value.tracks) || !value.ranges)
    throw new Error('Invalid DAW track list. Update the local DAW bridge.')
  const snapshot: TrackExportSnapshot = { ...value, route, daw: route === 'ptsl' ? 'Pro Tools' : value.daw }
  return route === 'tap' ? withHostLoop(snapshot) : snapshot
}

/** Slur Tap's selection is the host's loop/cycle range, read from this plug-in's play head. */
async function withHostLoop(snapshot: TrackExportSnapshot): Promise<TrackExportSnapshot> {
  if (!hasJuceNativeFunction('getDawTimeline') || !snapshot.sampleRate) return { ...snapshot, rangeNote: 'Turn on the DAW loop/cycle to choose a range.' }
  try {
    const t = JSON.parse(await callJuceNative('getDawTimeline', []))
    const ok = t.isLooping && t.ppq != null && t.projectSamples != null && t.ppqLoopStart != null && t.ppqLoopEnd != null && t.bpm > 0
      && t.sr === snapshot.sampleRate
    if (!ok) return { ...snapshot, ranges: { ...snapshot.ranges, selection: null }, rangeNote: 'Turn on the DAW loop/cycle to choose a range.' }
    // Constant tempo between the play head and the loop: one beat = 60/bpm s.
    const toSamples = (ppq: number) => Math.round(t.projectSamples + (ppq - t.ppq) * 60 / t.bpm * t.sr)
    const start = Math.max(0, toSamples(t.ppqLoopStart)), end = toSamples(t.ppqLoopEnd)
    return { ...snapshot, ranges: { ...snapshot.ranges, selection: end > start ? { start, end } : null },
      rangeNote: 'Uses the DAW loop/cycle range (assumes no tempo change inside it).' }
  } catch { return snapshot }
}

export async function exportDawTracks(snapshot: TrackExportSnapshot, trackIds: string[], mode: 'entire' | 'selection') {
  const range = snapshot.ranges[mode]
  if (!range) throw new Error('Choose a non-empty export range.')
  const value = await request(OPS[snapshot.route].export, snapshot.sessionId,
    { trackIds, range: mode, ...range, sampleRate: snapshot.sampleRate, revision: snapshot.revision })
  if (typeof value.data !== 'string' || !value.data.length || value.data.length > 420 * 1024 * 1024)
    throw new Error('Exported audio is missing or exceeds the 300 MB transfer limit.')
  const binary = atob(value.data), bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], 'tracks.orb-regions.zip', { type: 'application/zip' })
}

export async function inspectDawTrackRange(snapshot: TrackExportSnapshot): Promise<TrackExportSnapshot> {
  const op = OPS[snapshot.route].range
  if (!op) return snapshot.route === 'tap' ? withHostLoop(snapshot) : snapshot
  const value = await request(op)
  if (value.sessionId !== snapshot.sessionId || value.sampleRate !== snapshot.sampleRate)
    throw new Error('The DAW session changed. Refresh the track list.')
  if (value.selection !== null && (!Number.isSafeInteger(value.selection?.start)
    || !Number.isSafeInteger(value.selection?.end) || value.selection.end <= value.selection.start))
    throw new Error('Invalid timeline selection.')
  return { ...snapshot, ranges: { ...snapshot.ranges, selection: value.selection } }
}

/** Uncovered parts of [start, end) and the oldest capture time, for a Slur Tap row. */
export function tapCoverage(spans: [number, number, number][] | undefined, start: number, end: number) {
  let cursor = start, missing = 0, oldest = Infinity
  for (const [s, e, t] of spans ?? []) {
    if (e <= cursor) continue
    if (s >= end) break
    if (s > cursor) missing += s - cursor
    oldest = Math.min(oldest, t)
    cursor = Math.max(cursor, e)
  }
  if (cursor < end) missing += end - cursor
  return { complete: missing === 0, missing, oldestMs: Number.isFinite(oldest) ? oldest : null }
}
