import { isMusicalPosition, parseRegionBundle, type RegionBundle, type MusicalPosition } from './regionBundle.ts'

interface LogicRegion { name: string; trackName: string; trackOrder: number; start: MusicalPosition; end: MusicalPosition }
export interface LogicSelection { project: string; regions: LogicRegion[] }
function fail(): never { throw new Error('Could not match the dropped audio to the selected Logic regions. Nothing was sent.') }

export function parseLogicPosition(text: string, divisionDenominator: number | null = null): MusicalPosition {
  const units = ['bar', 'beat', 'division', 'tick'], values = [1, 1, 1, 1], seen = new Set<number>()
  const tokens = [...text.matchAll(/(\d+) (bars?|beats?|divisions?|ticks?)\b/g)]
  if (!tokens.length || text.replace(/(\d+) (bars?|beats?|divisions?|ticks?)\b/g, '').trim()) fail()
  for (const token of tokens) {
    const i = units.indexOf(token[2]!.replace(/s$/, '')), value = Number(token[1])
    if (seen.has(i) || !Number.isSafeInteger(value) || value < 1) fail()
    seen.add(i); values[i] = value
  }
  const position: MusicalPosition = { bar: values[0]!, beat: values[1]!, division: values[2]!, tick: values[3]!, divisionDenominator, resolution: 'logic-tick' }
  if (!isMusicalPosition(position)) fail()
  return position
}

/** Read only the selected regions; never substitute playhead time or file clocks. */
export function readLogicSelection(value: unknown): LogicSelection {
  const s = value as { version?: number; projectId?: string; tracks?: { AXDescription?: string; regions?: {
    AXDescription?: string; AXHelp?: string; AXSelected?: boolean | number }[] }[] }
  if (!s || s.version !== 1 || typeof s.projectId !== 'string' || !s.projectId.includes('.logicx')
    || !Array.isArray(s.tracks) || s.tracks.length > 4096) fail()
  const regions: LogicRegion[] = []
  for (const track of s.tracks) {
    if (!track || !Array.isArray(track.regions) || track.regions.some(r => !r)) fail()
    const selected = track.regions.filter(r => r.AXSelected === true || r.AXSelected === 1)
    if (!selected.length) continue
    const title = /^Track (\d+) [\u201c"](.+)[\u201d"]$/.exec(track.AXDescription ?? '')
    if (!title || !Number.isSafeInteger(Number(title[1])) || Number(title[1]) < 1) fail()
    for (const r of selected) {
      const timing = /Region starts at (.*?) and ends at (.*?), Audio region\./.exec(r.AXHelp ?? '')
      if (!timing || !r.AXDescription || r.AXDescription.length > 512) fail()
      const start = parseLogicPosition(timing[1]!.trim()), end = parseLogicPosition(timing[2]!.trim())
      const delta = [end.bar - start.bar, end.beat - start.beat, end.division - start.division, end.tick - start.tick].find(n => n !== 0)
      if (!delta || delta < 0) fail()
      regions.push({ name: r.AXDescription, trackName: title[2]!, trackOrder: Number(title[1]) - 1, start, end })
    }
  }
  if (!regions.length || regions.length > 512) fail()
  return { project: s.projectId, regions }
}

const audioName = (name: string) => name.normalize('NFC').replace(/\.(wav|wave|aif|aiff|caf)$/i, '')
/** File-promise completion order is not region order. Ambiguous names are refused. */
export function matchLogicDrop(before: LogicSelection, after: LogicSelection, names: string[]): LogicRegion[] {
  const stable = (s: LogicSelection) => JSON.stringify({ project: s.project,
    regions: s.regions.slice().sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) })
  if (stable(before) !== stable(after) || names.length !== before.regions.length) fail()
  const byName = new Map<string, LogicRegion>()
  for (const r of before.regions) {
    const name = audioName(r.name)
    if (byName.has(name)) fail()
    byName.set(name, r)
  }
  return names.map(name => {
    const key = audioName(name), region = byName.get(key)
    if (!region) fail()
    byName.delete(key)
    return region
  })
}

export interface LogicRegionEvidence { captureId: string; projectId: string; region: LogicRegion }
export function applyLogicLayout(bundle: RegionBundle, evidence: LogicRegionEvidence[]): RegionBundle {
  if (evidence.length !== bundle.regions.length || !evidence.length
    || evidence.some(e => e.captureId !== evidence[0]!.captureId || e.projectId !== evidence[0]!.projectId)) fail()
  const b = structuredClone(bundle)
  b.source = { daw: 'Logic Pro', projectId: evidence[0]!.projectId, captureId: evidence[0]!.captureId }
  b.tracks = []
  b.regions.forEach((r, i) => {
    const e = evidence[i]!.region, asset = b.assets.find(a => a.id === r.assetId)!
    if (!asset.frames || !asset.channels || !asset.sampleRate) fail()
    const id = `logic-track-${e.trackOrder}`
    const track = b.tracks.find(t => t.id === id)
    if (track && (track.name !== e.trackName || track.channels !== asset.channels)) fail()
    if (!track) b.tracks.push({ id, name: e.trackName, order: e.trackOrder, channels: asset.channels })
    r.name = e.name; r.trackId = id; r.start = null
    r.musicalStart = e.start; r.musicalEnd = e.end
  })
  const checked = parseRegionBundle(b)
  if (!checked) fail()
  return checked
}
