import { parseRegionBundle } from '@orb/core/lib/regionBundle.ts'
import type { RegionBundle } from '@orb/core/lib/regionBundle.ts'

/** A row restores only that occurrence, even when several regions reuse one file. */
export function selectedRegionBundle(value: unknown, entries: { assetId?: string; regionId?: string }[]): RegionBundle | null {
  const b = parseRegionBundle(value)
  if (!b) return null
  const regions = b.regions.filter(r => entries.some(e => e.regionId ? e.regionId === r.id : e.assetId === r.assetId))
  return parseRegionBundle({ ...b, regions,
    tracks: b.tracks.filter(t => regions.some(r => r.trackId === t.id)),
    assets: b.assets.filter(a => regions.some(r => r.assetId === a.id)) })
}
