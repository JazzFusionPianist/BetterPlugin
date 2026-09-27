/** Track rendering is qualified only through the Pro Tools PTSL adapter.
 * Region/file sharing is independent of this policy and remains available. */
export const TRACK_EXPORT_DAWS = ['Pro Tools'] as const
export const TRACK_EXPORT_OPERATIONS = ['inspectTracks', 'inspectTrackRange', 'exportTracks'] as const
export function supportsTrackExport(host: string): boolean {
  return host === 'Pro Tools' || host === 'Standalone'
}
export function supportsTrackExportOperation(operation: string): boolean {
  return TRACK_EXPORT_OPERATIONS.some(allowed => allowed === operation)
}
