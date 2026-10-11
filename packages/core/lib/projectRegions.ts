/**
 * Region layouts read from a saved DAW project file (no drag, no host API).
 * Positions are the CURRENT edited arrangement placement, in seconds from song
 * zero. The shared audio is the original source PCM: edits that change timing
 * or pitch disable a region; level/fade edits are listed as not applied.
 */
export type ProjectKind = 'studio-one' | 'ableton' | 'reaper' | 'dawproject'
export type RegionNote = 'gain' | 'fade' | 'envelope'
export type ProjectSource = { candidates: string[] } | { embedded: string }
export interface ProjectTrack { id: string; name: string; order: number; channels: number | null }
export interface ProjectRegion {
  id: string
  trackId: string
  name: string
  source: ProjectSource | null
  startSeconds: number
  offsetSeconds: number
  lengthSeconds: number
  notes: RegionNote[]
  disabledReason: string | null
}
export interface ProjectSnapshot {
  daw: string
  kind: ProjectKind
  name: string
  /** Project rate when the file states it; otherwise each source's own rate is used. */
  sampleRate: number | null
  tracks: ProjectTrack[]
  regions: ProjectRegion[]
}

export const PROJECT_EXTENSIONS: Record<ProjectKind, string> = {
  'studio-one': 'song', ableton: 'als', reaper: 'rpp', dawproject: 'dawproject',
}
export function projectKind(fileName: string): ProjectKind | null {
  const ext = fileName.toLowerCase().split('.').pop()
  return (Object.keys(PROJECT_EXTENSIONS) as ProjectKind[]).find(k => PROJECT_EXTENSIONS[k] === ext) ?? null
}
export const PROJECT_REGION_LIMIT = 4096

/** Directory and file name joined with '/', tolerant of a trailing slash. */
export function joinPath(dir: string, rel: string): string {
  if (rel.startsWith('/')) return rel
  const parts = (dir.replace(/\/+$/, '') + '/' + rel).split('/')
  const out: string[] = []
  for (const part of parts) {
    if (part === '..') out.pop()
    else if (part !== '.' && part !== '') out.push(part)
  }
  return '/' + out.join('/')
}
export const dirName = (p: string) => p.replace(/\/[^/]*$/, '') || '/'
export const baseName = (p: string) => p.replace(/^.*[/\\]/, '')

/** file:// URL → path candidates (raw first: DAWs often store unescaped paths). */
export function fileUrlCandidates(url: string): string[] {
  if (!/^file:\/\//i.test(url)) return url.startsWith('/') ? [url] : []
  const raw = url.replace(/^file:\/\/(localhost)?/i, '')
  const out = [raw]
  try { const decoded = decodeURIComponent(raw); if (decoded !== raw) out.push(decoded) } catch { /* keep raw */ }
  return out
}

/** Shared sanity check: finite, non-negative layout before any audio is read. */
export function checkRegionTimes(r: Pick<ProjectRegion, 'startSeconds' | 'offsetSeconds' | 'lengthSeconds'>): string | null {
  if (![r.startSeconds, r.offsetSeconds, r.lengthSeconds].every(Number.isFinite)) return 'Invalid region time.'
  if (r.lengthSeconds <= 0) return 'Empty region.'
  if (r.startSeconds < 0) return 'Region starts before song zero.'
  if (r.offsetSeconds < -1e-9) return 'Region starts before its source audio.'
  return null
}

export function finishSnapshot(s: ProjectSnapshot): ProjectSnapshot {
  if (s.regions.length > PROJECT_REGION_LIMIT) throw new Error(`Projects with more than ${PROJECT_REGION_LIMIT} audio regions are not supported yet.`)
  for (const r of s.regions) {
    if (!r.disabledReason) r.disabledReason = checkRegionTimes(r)
    if (!r.disabledReason && !r.source) r.disabledReason = 'The source audio file is not referenced.'
    if (r.offsetSeconds < 0) r.offsetSeconds = 0
  }
  // Tracks without audio regions are not useful in a region picker.
  s.tracks = s.tracks.filter(t => s.regions.some(r => r.trackId === t.id))
  return s
}
