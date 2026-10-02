import { callJuceNative } from './juceBridge'

export interface TrackExportSnapshot {
  sessionId: string
  name: string
  sampleRate: number
  tracks: { id: string; name: string; type: string; selected: boolean; disabledReason: string | null }[]
  ranges: Record<'entire' | 'selection', { start: number; end: number } | null>
  entireError: string
}
async function request(operation: string, sessionId?: string, options?: object) {
  const raw = await callJuceNative('regionTransfer', [operation, ...(sessionId ? [sessionId] : []),
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
