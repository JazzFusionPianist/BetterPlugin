/** Legacy bundle builds expose a host probe; Slur's newer placement bridge does not. */
export function regionBundleFunction(functions: readonly string[]): string | null {
  if (functions.includes('regionBundleTransfer')) return 'regionBundleTransfer'
  if (functions.includes('regionTransferHost') && functions.includes('regionTransfer')) return 'regionTransfer'
  return null
}
