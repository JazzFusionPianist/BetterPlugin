import { isMusicalPosition, parseRegionBundle, type RegionBundle, type MusicalPosition } from './regionBundle.ts'

interface LogicRegion {
  name: string; trackName: string; trackOrder: number; start: MusicalPosition; end?: MusicalPosition
  /** Exact song-sample start when the host tempo anchor is known (Logic drag payload path). */
  startSamples?: number; sampleRate?: number; trackId?: string
}
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

// ── Logic drag payload (no Accessibility, no name matching) ──────────────────
/** Per-file metadata the native drop handler reads from Logic's pasteboard item. */
export interface LogicDragMeta { kind: 'logic-region'; startClock: number; trackId: string; fileName: string; index: number; count: number }
export function isLogicDragMeta(v: unknown): v is LogicDragMeta {
  const m = v as LogicDragMeta
  return !!m && m.kind === 'logic-region' && Number.isSafeInteger(m.startClock) && m.startClock > 0
    && typeof m.trackId === 'string' && m.trackId.length <= 64 && typeof m.fileName === 'string' && m.fileName.length <= 512
    && Number.isSafeInteger(m.index) && Number.isSafeInteger(m.count) && m.index >= 0 && m.index < m.count && m.count <= 512
}
/** startClock = Logic ticks × 2^32; bar 1 sits at 38400 ticks; 960 ticks per quarter note. */
export const LOGIC_BAR1_TICKS = 38400
export function logicClockToPpq(startClock: number): number {
  return (startClock / 2 ** 32 - LOGIC_BAR1_TICKS) / 960
}
export interface HostTimeline { ppq: number | null; projectSamples: number | null; bpm: number; sr: number; tnum: number; tden: number }
/** Bar/beat/16th/tick (1-based, 240 ticks per 16th) for a constant meter. */
export function ppqToMusical(ppq: number, tnum: number, tden: number): MusicalPosition {
  if (!(ppq >= -1e-9) || !Number.isSafeInteger(tnum) || tnum < 1 || ![1, 2, 4, 8, 16, 32].includes(tden)) fail()
  const q = Math.max(0, ppq), barQ = tnum * 4 / tden, beatQ = 4 / tden
  const bar = Math.floor(q / barQ + 1e-9) + 1
  const inBar = q - (bar - 1) * barQ
  const beat = Math.min(tnum, Math.floor(inBar / beatQ + 1e-9) + 1)
  // Logic shows the tick a position falls in (truncated, 1-based), not the nearest one.
  const ticks = Math.min(959, Math.floor((inBar - (beat - 1) * beatQ) * 960 + 1e-6))
  const position: MusicalPosition = { bar, beat, division: Math.floor(ticks / 240) + 1, tick: (ticks % 240) + 1,
    divisionDenominator: 16, resolution: 'logic-tick' }
  if (!isMusicalPosition(position)) fail()
  return position
}
/** One region per dropped file, from its own pasteboard item. Track names come from an
 * optional Accessibility snapshot when it identifies the same region; otherwise "Track N". */
export function logicRegionsFromDrag(metas: LogicDragMeta[], timeline: HostTimeline | null, selection?: LogicSelection | null): LogicRegion[] {
  if (!metas.length || metas.some(m => !isLogicDragMeta(m) || m.count !== metas.length)
    || new Set(metas.map(m => m.index)).size !== metas.length) fail()
  const tnum = timeline?.tnum && timeline.tnum > 0 ? timeline.tnum : 4, tden = timeline?.tden && timeline.tden > 0 ? timeline.tden : 4
  const order = new Map<string, number>()
  return metas.map(m => {
    const ppq = logicClockToPpq(m.startClock)
    const start = ppqToMusical(ppq, tnum, tden)
    const key = m.trackId || `track-${m.index}`
    if (!order.has(key)) order.set(key, order.size)
    const ax = selection?.regions.find(r => audioName(r.name) === audioName(m.fileName)
      && r.start.bar === start.bar && r.start.beat === start.beat && r.start.division === start.division
      && Math.abs(r.start.tick - start.tick) <= 1)
    const region: LogicRegion = { name: audioName(m.fileName) || `Region ${m.index + 1}`, trackId: key,
      trackName: ax?.trackName ?? `Track ${order.get(key)! + 1}`, trackOrder: ax?.trackOrder ?? order.get(key)!, start }
    // Samples: constant tempo between the play head anchor and the region.
    if (timeline && timeline.ppq != null && timeline.projectSamples != null && timeline.bpm > 0 && timeline.sr > 0) {
      const samples = Math.round(timeline.projectSamples + (ppq - timeline.ppq) * 60 / timeline.bpm * timeline.sr)
      if (Number.isSafeInteger(samples) && samples >= 0) { region.startSamples = samples; region.sampleRate = Math.round(timeline.sr) }
    }
    return region
  })
}
export function applyLogicLayout(bundle: RegionBundle, evidence: LogicRegionEvidence[]): RegionBundle {
  if (evidence.length !== bundle.regions.length || !evidence.length
    || evidence.some(e => e.captureId !== evidence[0]!.captureId || e.projectId !== evidence[0]!.projectId)) fail()
  const b = structuredClone(bundle)
  b.source = { daw: 'Logic Pro', projectId: evidence[0]!.projectId, captureId: evidence[0]!.captureId }
  b.tracks = []
  b.regions.forEach((r, i) => {
    const e = evidence[i]!.region, asset = b.assets.find(a => a.id === r.assetId)!
    if (!asset.frames || !asset.channels || !asset.sampleRate) fail()
    const id = e.trackId ? `logic-${e.trackId}` : `logic-track-${e.trackOrder}`
    const track = b.tracks.find(t => t.id === id)
    if (track && (track.name !== e.trackName || track.channels !== asset.channels)) fail()
    if (!track) b.tracks.push({ id, name: e.trackName, order: e.trackOrder, channels: asset.channels })
    r.name = e.name; r.trackId = id
    r.start = e.startSamples != null && e.sampleRate ? { samples: e.startSamples, sampleRate: e.sampleRate } : null
    r.musicalStart = e.start
    if (e.end) r.musicalEnd = e.end
  })
  const checked = parseRegionBundle(b)
  if (!checked) fail()
  return checked
}
