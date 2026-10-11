import { parseXml, child, children, descendants, path, num, type XmlNode } from './miniXml.ts'
import { tempoMap, beatsToSeconds, type TempoMap, type TempoPoint } from './tempoMap.ts'
import { finishSnapshot, joinPath, dirName, baseName, type ProjectRegion, type ProjectSnapshot, type ProjectTrack, type RegionNote } from './projectRegions.ts'

/**
 * DAWproject 1.0 (Bitwig, Cubase 14+, Studio One 6.5+ export). The open format
 * has no host-specific binary state. Supported clip shapes:
 *   Clip › Audio                         (content in seconds)
 *   Clip › Clips › Clip(time 0) › Audio  (Fender/Cubase nesting; Slur's writer)
 *   Clip › Warps › Audio + unity-rate Warp points
 * Anything else is listed but disabled rather than guessed.
 */
type Unit = 'beats' | 'seconds'
const unitOf = (node: XmlNode, inherited: Unit): Unit => {
  const u = node.attrs.timeUnit
  return u === 'seconds' || u === 'beats' ? u : inherited
}

function readTempo(project: XmlNode): TempoMap {
  const base = num(path(project, 'Transport', 'Tempo')?.attrs.value, 120)
  const auto = path(project, 'Arrangement', 'TempoAutomation')
  const points: TempoPoint[] = children(auto, 'RealPoint').map(p => ({
    beat: num(p.attrs.time), bpm: num(p.attrs.value), ramp: p.attrs.interpolation === 'linear' }))
  if (auto && auto.attrs.unit && auto.attrs.unit !== 'bpm') throw new Error('Unsupported tempo automation unit.')
  if (auto && unitOf(auto, 'beats') !== 'beats' && points.length) throw new Error('Tempo automation must be in beats.')
  return tempoMap(points.length ? points : [{ beat: 0, bpm: base, ramp: false }])
}

interface Resolved { source: ProjectRegion['source']; offset: number; rate: number }

/** Map clip content time → audio seconds for the supported nesting shapes. */
function resolveContent(clip: XmlNode, contentUnit: Unit, map: TempoMap, projectDir: string, embedded: (p: string) => boolean): Resolved {
  if (contentUnit !== 'seconds') {
    // Audio content measured in beats only plays at unity rate with a constant tempo.
    if (!map.constant) throw new Error('Beat-based audio content over tempo changes needs rendering before sharing.')
  }
  const audio = child(clip, 'Audio')
  if (audio) return { ...fileOf(audio, projectDir, embedded), offset: 0, rate: 1 }
  const warps = child(clip, 'Warps')
  if (warps) {
    const inner = child(warps, 'Audio')
    if (!inner) throw new Error('Unsupported warped content.')
    const warpUnit = unitOf(warps, contentUnit)
    const contentInner = warps.attrs.contentTimeUnit === 'beats' ? 'beats' : 'seconds'
    if (contentInner !== 'seconds') throw new Error('Unsupported warp content unit.')
    const points = children(warps, 'Warp').map(w => ({ t: num(w.attrs.time), c: num(w.attrs.contentTime) })).sort((a, b) => a.t - b.t)
    if (points.length < 2) throw new Error('Incomplete warp points.')
    for (let i = 0; i + 1 < points.length; i++) {
      const a = points[i], b = points[i + 1]
      const dt = warpUnit === 'seconds' ? b.t - a.t : beatsToSeconds(map, b.t) - beatsToSeconds(map, a.t)
      if (Math.abs((b.c - a.c) - dt) > 1e-6 * Math.max(1, dt)) throw new Error('Warped (time-stretched) audio needs rendering before sharing.')
    }
    const t0 = warpUnit === 'seconds' ? points[0].t : beatsToSeconds(map, points[0].t)
    // content seconds at clip-content time 0
    return { ...fileOf(inner, projectDir, embedded), offset: points[0].c - t0, rate: 1 }
  }
  const nested = child(clip, 'Clips')
  if (nested) {
    const inner = children(nested, 'Clip')
    if (inner.length !== 1) throw new Error('Clips containing several events need consolidating before sharing.')
    const unit = unitOf(nested, contentUnit)
    const c = inner[0]
    const innerTime = num(c.attrs.time, 0)
    const innerContentUnit: Unit = c.attrs.contentTimeUnit === 'beats' ? 'beats' : c.attrs.contentTimeUnit === 'seconds' ? 'seconds' : unit
    const resolved = resolveContent(c, innerContentUnit, map, projectDir, embedded)
    const start = unit === 'seconds' ? innerTime : beatsToSeconds(map, innerTime)
    const playStart = num(c.attrs.playStart, 0)
    const ps = innerContentUnit === 'seconds' ? playStart : beatsToSeconds(map, playStart)
    // outer content second x plays inner audio at resolved.offset + ps + (x - start)
    return { ...resolved, offset: resolved.offset + ps - start, rate: 1 }
  }
  throw new Error('Unsupported clip content.')
}

function fileOf(audio: XmlNode, projectDir: string, embedded: (p: string) => boolean): Pick<Resolved, 'source'> {
  const file = child(audio, 'File')
  const p = file?.attrs.path
  if (!p) throw new Error('The clip has no audio file.')
  if (file!.attrs.external === 'true' || p.startsWith('/')) return { source: { candidates: [joinPath(projectDir, p)] } }
  if (embedded(p)) return { source: { embedded: p } }
  return { source: { candidates: [joinPath(projectDir, p)] } }
}

export function parseDawproject(input: { projectXml: string; projectPath: string; entries: string[] }): ProjectSnapshot {
  const project = parseXml(input.projectXml)
  if (project.name !== 'Project') throw new Error('Not a DAWproject.')
  const map = readTempo(project)
  const projectDir = dirName(input.projectPath)
  const embedded = new Set(input.entries)
  const tracks: ProjectTrack[] = [], regions: ProjectRegion[] = []
  const byId = new Map<string, ProjectTrack>()
  for (const t of descendants(child(project, 'Structure')!, 'Track')) {
    if (!(t.attrs.contentType ?? '').split(' ').includes('audio') || !t.attrs.id) continue
    const channels = num(child(t, 'Channel')?.attrs.audioChannels, 0)
    const track = { id: t.attrs.id, name: t.attrs.name || `Track ${tracks.length + 1}`, order: tracks.length, channels: channels > 0 ? channels : null }
    tracks.push(track); byId.set(track.id, track)
  }
  const arrangement = child(project, 'Arrangement')
  const rootLanes = child(arrangement, 'Lanes')
  const walk = (node: XmlNode, unit: Unit, trackId: string | null) => {
    for (const c of node.children) {
      if (c.name === 'Lanes') walk(c, unitOf(c, unit), c.attrs.track ?? trackId)
      else if (c.name === 'Clips' && trackId && byId.has(trackId)) readClips(c, unitOf(c, unit), trackId)
    }
  }
  const readClips = (clips: XmlNode, unit: Unit, trackId: string) => {
    children(clips, 'Clip').forEach((clip, index) => {
      const a = clip.attrs
      const region: ProjectRegion = { id: `${trackId}#${clips.attrs.id ?? 'c'}:${index}`, trackId, name: a.name || byId.get(trackId)!.name,
        source: null, startSeconds: 0, offsetSeconds: 0, lengthSeconds: 0, notes: [], disabledReason: null }
      regions.push(region)
      try {
        const toSec = (v: number) => unit === 'seconds' ? v : beatsToSeconds(map, v)
        const time = num(a.time), duration = num(a.duration)
        region.startSeconds = toSec(time)
        region.lengthSeconds = toSec(time + duration) - region.startSeconds
        if (a.enable === 'false') throw new Error('Disabled clip.')
        if (a.loopStart !== undefined || a.loopEnd !== undefined) throw new Error('Looped clips need consolidating before sharing.')
        const contentUnit: Unit = a.contentTimeUnit === 'beats' ? 'beats' : a.contentTimeUnit === 'seconds' ? 'seconds' : unit
        // Clip duration in content time must equal its timeline length (unity rate).
        if (contentUnit !== unit && !map.constant) throw new Error('Clip content over tempo changes needs rendering before sharing.')
        const resolved = resolveContent(clip, contentUnit, map, projectDir, p => embedded.has(p))
        const playStart = num(a.playStart, 0)
        const playStartSec = contentUnit === 'seconds' ? playStart : beatsToSeconds(map, playStart)
        region.source = resolved.source
        region.offsetSeconds = resolved.offset + playStartSec
        if (a.playStop !== undefined) {
          const stop = num(a.playStop)
          const stopSec = contentUnit === 'seconds' ? stop : beatsToSeconds(map, stop)
          if (Math.abs((stopSec - playStartSec) - region.lengthSeconds) > 1e-6 * Math.max(1, region.lengthSeconds))
            throw new Error('Time-stretched clips need rendering before sharing.')
        }
        const notes = new Set<RegionNote>()
        if (num(a.fadeInTime, 0) > 0 || num(a.fadeOutTime, 0) > 0) notes.add('fade')
        region.notes = [...notes]
      } catch (e) { region.disabledReason = e instanceof Error ? e.message : String(e) }
    })
  }
  if (rootLanes) walk(rootLanes, unitOf(rootLanes, 'beats'), rootLanes.attrs.track ?? null)
  const app = child(project, 'Application')?.attrs.name
  return finishSnapshot({ daw: app ? `${app} (DAWproject)` : 'DAWproject', kind: 'dawproject',
    name: baseName(input.projectPath).replace(/\.dawproject$/i, ''), sampleRate: null, tracks, regions })
}
