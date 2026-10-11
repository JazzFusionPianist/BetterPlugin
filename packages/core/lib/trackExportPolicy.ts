import { canonicalHost, trackRoutes } from './stemRoutes.ts'

/** Track rendering adapters. Pro Tools (PTSL) and REAPER (ReaScript) render in the
 * host without satellites; Slur Tap assembles stems captured on each source track.
 * Region/file sharing is independent of this policy and remains available. */
export const TRACK_EXPORT_DAWS = ['Pro Tools', 'REAPER', 'Slur Tap'] as const
export const TRACK_EXPORT_OPERATIONS = ['inspectTracks', 'inspectTrackRange', 'exportTracks',
  'inspectReaperTracks', 'exportReaperTracks', 'inspectTapTracks', 'exportTapTracks'] as const
export function supportsTrackExport(host: string): boolean {
  // Every host can use Slur Tap; this only gates whether the picker is shown.
  return trackRoutes(canonicalHost(host)).length > 0
}
export function supportsTrackExportOperation(operation: string): boolean {
  return TRACK_EXPORT_OPERATIONS.some(allowed => allowed === operation)
}
