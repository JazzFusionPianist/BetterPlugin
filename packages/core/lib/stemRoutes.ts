import type { ProjectKind } from './projectRegions.ts'

/**
 * Which mechanism sends stems from a given host. Two separate features:
 *   track bounce  — processed, equal-length stems of whole tracks
 *   region share  — the original region audio plus each region's position
 * Satellite-free routes always come first; Slur Tap (a pass-through insert on
 * each source track) is the fallback when the host offers nothing else.
 */
export type TrackRoute = 'ptsl' | 'reaper' | 'tap'
export type RegionRoute = 'luna' | 'reaper' | 'project' | 'tap'

export const HOSTS = ['Pro Tools', 'REAPER', 'LUNA', 'Logic Pro', 'Ableton Live', 'Studio One', 'Cubase', 'Nuendo',
  'Bitwig Studio', 'FL Studio', 'Standalone'] as const

/** Normalize JUCE host descriptions and application paths to one name. */
export function canonicalHost(description: string): string {
  const d = description.toLowerCase()
  if (d === 'standalone') return 'Standalone'
  if (d.includes('pro tools')) return 'Pro Tools'
  if (d.includes('reaper')) return 'REAPER'
  if (d.includes('luna')) return 'LUNA'
  if (d.includes('logic')) return 'Logic Pro'
  if (d.includes('ableton') || d === 'live') return 'Ableton Live'
  if (d.includes('studio one') || d.includes('studio pro')) return 'Studio One'
  if (d.includes('nuendo')) return 'Nuendo'
  if (d.includes('cubase')) return 'Cubase'
  if (d.includes('bitwig')) return 'Bitwig Studio'
  if (d.includes('fl studio') || d.includes('fruity')) return 'FL Studio'
  return description
}

export function trackRoutes(host: string): TrackRoute[] {
  const h = canonicalHost(host)
  if (h === 'Pro Tools') return ['ptsl', 'tap']
  if (h === 'REAPER') return ['reaper', 'tap']
  if (h === 'Standalone') return ['ptsl', 'reaper', 'tap']
  return ['tap']
}

/** Project file formats readable without exporting, or after one DAWproject export. */
export function projectKinds(host: string): ProjectKind[] {
  const h = canonicalHost(host)
  if (h === 'Studio One') return ['studio-one', 'dawproject']
  if (h === 'Ableton Live') return ['ableton']
  if (h === 'REAPER') return ['reaper']
  if (h === 'Cubase' || h === 'Nuendo' || h === 'Bitwig Studio') return ['dawproject']
  if (h === 'Standalone') return ['studio-one', 'ableton', 'reaper', 'dawproject']
  return []
}

export function regionRoutes(host: string): RegionRoute[] {
  const h = canonicalHost(host)
  const routes: RegionRoute[] = []
  if (h === 'LUNA' || h === 'Standalone') routes.push('luna')
  if (h === 'REAPER' || h === 'Standalone') routes.push('reaper')
  if (projectKinds(h).length) routes.push('project')
  routes.push('tap')
  return routes
}

/** True when the project format can be read straight from the saved file. */
export const savedFileIsLive = (kind: ProjectKind) => kind !== 'dawproject'

export const ROUTE_LABELS: Record<TrackRoute | RegionRoute, string> = {
  ptsl: 'Pro Tools', reaper: 'REAPER', luna: 'LUNA', project: 'Project file', tap: 'Slur Tap',
}
