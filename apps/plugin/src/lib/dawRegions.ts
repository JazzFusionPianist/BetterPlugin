import { useEffect, useState } from 'react'
import { callJuceNative, hasJuceNativeFunction } from './juceBridge'
import { regionRoutes, projectKinds, type RegionRoute } from '@orb/core/lib/stemRoutes.ts'
import type { ProjectKind } from '@orb/core/lib/projectRegions.ts'

export type { RegionRoute }
export interface RegionRow {
  id: string; name: string; trackId: string; trackName: string
  start?: number; length?: number; sampleRate?: number
  notes?: string[]; disabledReason: string | null
}
export interface RegionSnapshot {
  route: RegionRoute
  sessionId: string; name: string; daw?: string; kind?: string; revision: string
  sampleRate: number | null
  project?: { name: string; modifiedMs: number }
  tracks?: { id: string; name: string; order: number }[]
  regions: RegionRow[]
}
export interface LinkedProject { path: string; name: string; kind: ProjectKind; exists: boolean; modifiedMs: number }
export interface ProjectSuggestion { index: number; name: string; folder: string; kind: ProjectKind; modifiedMs: number }

/** Region routes this host can use with this native build, best first. */
export function useRegionHost() {
  const [host, setHost] = useState('')
  const [routes, setRoutes] = useState<RegionRoute[]>([])
  useEffect(() => {
    let active = true
    if (!hasJuceNativeFunction('regionTransfer') || !hasJuceNativeFunction('trackExportHost')) return
    void Promise.all([
      callJuceNative('trackExportHost', []),
      hasJuceNativeFunction('trackExportCapabilities') ? callJuceNative('trackExportCapabilities', []) : Promise.resolve('{}'),
    ]).then(([name, caps]) => {
      if (!active) return
      let native: string[] = ['luna']
      try { const r = JSON.parse(caps).regionRoutes; if (Array.isArray(r)) native = r } catch { /* older build: LUNA only */ }
      setHost(name)
      setRoutes(regionRoutes(name).filter(r => native.includes(r)))
    }).catch(() => {})
    return () => { active = false }
  }, [])
  return { host, routes, kinds: host ? projectKinds(host) : [] as ProjectKind[] }
}

const OPS: Record<RegionRoute, [string, string]> = {
  luna: ['inspectLunaRegions', 'exportLunaRegions'],
  reaper: ['inspectReaperRegions', 'exportReaperRegions'],
  project: ['inspectProjectRegions', 'exportProjectRegions'],
  tap: ['inspectTapRegions', 'exportTapRegions'],
}
async function request(operation: string, sessionId?: string, options?: object) {
  const raw = await callJuceNative('regionTransfer', [operation, ...(sessionId ? [sessionId] : []),
    ...(options ? [JSON.stringify(options)] : [])], operation.startsWith('inspect') ? 250000 : 1810000)
  let result
  try { result = JSON.parse(raw) } catch { throw new Error('The installed region bridge returned no valid response.') }
  if (result.ok !== true) throw new Error(result.error || 'Region transfer failed.')
  return result
}

export async function inspectRegions(route: RegionRoute): Promise<RegionSnapshot> {
  const value = await request(OPS[route][0])
  if (!Array.isArray(value.regions)) throw new Error('Invalid region list. Update Slur.')
  return { ...value, route }
}

export async function captureRegions(snapshot: RegionSnapshot, regionIds: string[]): Promise<File> {
  const result = await request(OPS[snapshot.route][1], snapshot.sessionId || 'session', { regionIds, revision: snapshot.revision })
  if (typeof result.data !== 'string' || !result.data.length || result.data.length > 400 * 1024 * 1024)
    throw new Error('Missing or oversized region archive.')
  const decoded = atob(result.data), bytes = new Uint8Array(decoded.length)
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i)
  return new File([bytes], 'regions.slur-regions.zip', { type: 'application/zip' })
}

// ── Project file link (owned by the native plug-in, persisted in the DAW session) ──
async function link(args: (string | number)[]) {
  if (!hasJuceNativeFunction('projectLink')) throw new Error('Update Slur to link project files.')
  const value = JSON.parse(await callJuceNative('projectLink', args, args[0] === 'choose' ? 600000 : 30000))
  if (value.ok !== true) throw new Error(value.error || 'Could not link the project.')
  return value
}
export const linkedProject = async (): Promise<LinkedProject | null> => (await link(['get'])).linked ?? null
export const suggestProjects = async (): Promise<ProjectSuggestion[]> => (await link(['suggest'])).projects ?? []
export const linkSuggestedProject = async (index: number): Promise<LinkedProject | null> => (await link(['use', index])).linked ?? null
export const chooseProject = async (): Promise<LinkedProject | null> => (await link(['choose'])).linked ?? null
export const unlinkProject = async () => { await link(['clear']) }
