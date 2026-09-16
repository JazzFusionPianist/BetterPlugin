import type {
  AttachmentTimelineMetadata,
  DawDropAnchor,
  TempoMapPoint,
  TimeSignatureMapPoint,
} from '../types/collab'

interface DawTimelineEventDetail {
  sr: number
  ppq: number | null
  barPpq?: number | null
  barCount?: number | null
  projectSamples?: number | null
  bpm: number
  tnum: number
  tden: number
  playing: boolean
  /** Cycle state — newer plug-in binaries only. Absent → unknown. */
  isLooping?: boolean
  ppqLoopStart?: number | null
  ppqLoopEnd?: number | null
}

let listenerAttached = false
let latest: DawTimelineEventDetail | null = null
/** The last snapshot verbatim, minus the audio payload fields the live
 *  event rides in on — kept for the drop diagnostics ring buffer. */
let latestRaw: Record<string, unknown> | null = null
let nativeTimelinePromiseId = -1
const tempoMap: TempoMapPoint[] = []
const signatureMap: TimeSignatureMapPoint[] = []

function sortedByPpq<T extends { ppq: number }>(points: T[]): T[] {
  return points.slice().sort((a, b) => a.ppq - b.ppq)
}

function appendTempo(ppq: number, bpm: number) {
  if (!Number.isFinite(ppq) || !Number.isFinite(bpm) || bpm <= 0) return
  const previous = tempoMap[tempoMap.length - 1]
  if (previous && Math.abs(previous.bpm - bpm) < 0.001) return
  tempoMap.push({ ppq, bpm })
  if (tempoMap.length > 512) tempoMap.shift()
}

function appendSignature(ppq: number, numerator: number, denominator: number) {
  if (!Number.isFinite(ppq) || numerator <= 0 || denominator <= 0) return
  const previous = signatureMap[signatureMap.length - 1]
  if (previous && previous.numerator === numerator && previous.denominator === denominator) return
  signatureMap.push({ ppq, numerator, denominator })
  if (signatureMap.length > 128) signatureMap.shift()
}

function acceptTimelineDetail(detail: DawTimelineEventDetail | null): boolean {
  if (!detail || typeof detail !== 'object' || !Number.isFinite(detail.bpm)) return false
  // A snapshot whose ppq the host didn't report still carries bpm,
  // meter and the cycle state — keep it. (Discarding it wholesale left
  // exact BWF stamps with NO bpm at all, which renders as no label.)
  latest = detail
  {
    const { samples: _s, inSamples: _i, peaks: _p, gr: _g, ...rest } =
      detail as DawTimelineEventDetail & { samples?: unknown; inSamples?: unknown; peaks?: unknown; gr?: unknown }
    latestRaw = rest as Record<string, unknown>
  }
  if (detail.ppq != null && Number.isFinite(detail.ppq)) {
    appendTempo(detail.ppq, detail.bpm)
    appendSignature(detail.ppq, detail.tnum, detail.tden)
  }
  return true
}

/** Track the host context the plug-in observes while it is instantiated. */
export function initAudioTimelineTracking() {
  if (listenerAttached || typeof window === 'undefined') return
  listenerAttached = true
  window.addEventListener('__juceDawAudio', (event: Event) => {
    const detail = (event as CustomEvent<DawTimelineEventDetail>).detail
    acceptTimelineDetail(detail)
  })
}

/** Ask the native plug-in for a fresh snapshot at the exact drop moment. */
export async function refreshDawTimelineSnapshot(): Promise<AttachmentTimelineMetadata | null> {
  const backend = window.__JUCE__?.backend
  if (!backend) return getDawTimelineSnapshot()

  const promiseId = nativeTimelinePromiseId--
  const raw = await new Promise<unknown>(resolve => {
    const timeout = window.setTimeout(() => {
      backend.removeEventListener('__juce__complete', handler)
      resolve(null)
    }, 750)
    const handler = (data: unknown) => {
      const result = data as { promiseId?: number; result?: unknown }
      if (result.promiseId !== promiseId) return
      window.clearTimeout(timeout)
      backend.removeEventListener('__juce__complete', handler)
      resolve(result.result)
    }
    backend.addEventListener('__juce__complete', handler)
    backend.emitEvent('__juce__invoke', { name: 'getDawTimeline', params: [], resultId: promiseId })
  })

  try {
    const detail = typeof raw === 'string' ? JSON.parse(raw) as DawTimelineEventDetail : raw as DawTimelineEventDetail
    acceptTimelineDetail(detail)
  } catch {
    // Keep the last event-driven snapshot if an older plug-in returns no data.
  }
  return getDawTimelineSnapshot()
}

/** Snapshot used when an exported region contains no embedded source timestamp. */
export function getDawTimelineSnapshot(): AttachmentTimelineMetadata | null {
  if (!latest) return null
  const ppq = latest.ppq != null && Number.isFinite(latest.ppq) ? latest.ppq : undefined
  const denominatorScale = latest.tden / 4
  const beat = ppq != null && Number.isFinite(latest.barPpq)
    ? (ppq - (latest.barPpq ?? ppq)) * denominatorScale + 1
    : undefined

  // The cycle anchor rides along only when the plug-in binary reports
  // loop state at all; its absence marks an old binary → basis 'unknown'.
  // The playhead's OWN bar grid (bar count + that bar's start ppq +
  // meter) travels with it: bar numbering anchors on it, never on any
  // assumption about where ppq zero sits.
  const anchor: DawDropAnchor | undefined = latest.isLooping != null ? {
    is_looping: latest.isLooping,
    loop_start_ppq: latest.ppqLoopStart != null && Number.isFinite(latest.ppqLoopStart)
      ? latest.ppqLoopStart
      : undefined,
    loop_end_ppq: latest.ppqLoopEnd != null && Number.isFinite(latest.ppqLoopEnd)
      ? latest.ppqLoopEnd
      : undefined,
    ppq,
    samples: latest.projectSamples ?? undefined,
    bar_count: latest.barCount != null && Number.isFinite(latest.barCount)
      ? latest.barCount
      : undefined,
    bar_ppq: latest.barPpq != null && Number.isFinite(latest.barPpq)
      ? latest.barPpq
      : undefined,
    tnum: Number.isFinite(latest.tnum) && latest.tnum > 0 ? latest.tnum : undefined,
    tden: Number.isFinite(latest.tden) && latest.tden > 0 ? latest.tden : undefined,
  } : undefined

  return {
    anchor,
    schema_version: 1,
    position: {
      source_samples: latest.projectSamples ?? undefined,
      sample_rate: latest.sr,
      seconds: latest.projectSamples != null && latest.sr > 0
        ? latest.projectSamples / latest.sr
        : undefined,
      ppq,
      bar: latest.barCount != null ? latest.barCount + 1 : undefined,
      beat: beat != null ? Math.max(1, beat) : undefined,
      source: 'daw_playhead',
      confidence: 'estimated',
    },
    tempo_map: sortedByPpq(tempoMap),
    time_signature_map: sortedByPpq(signatureMap),
    bpm: Number.isFinite(latest.bpm) && latest.bpm > 0 ? latest.bpm : undefined,
    time_sig_num: Number.isFinite(latest.tnum) && latest.tnum > 0 ? latest.tnum : undefined,
    time_sig_den: Number.isFinite(latest.tden) && latest.tden > 0 ? latest.tden : undefined,
    captured_at: new Date().toISOString(),
  }
}

function ppqAtSeconds(seconds: number, points: TempoMapPoint[]): number | undefined {
  if (points.length === 0) return undefined
  const sorted = sortedByPpq(points)
  let ppq = 0
  let elapsed = 0
  let bpm = sorted[0]!.bpm
  for (const point of sorted) {
    if (point.ppq <= ppq) { bpm = point.bpm; continue }
    const segmentSeconds = (point.ppq - ppq) * 60 / bpm
    if (elapsed + segmentSeconds >= seconds) return ppq + (seconds - elapsed) * bpm / 60
    elapsed += segmentSeconds
    ppq = point.ppq
    bpm = point.bpm
  }
  return ppq + (seconds - elapsed) * bpm / 60
}

/** Inverse of ppqAtSeconds — project seconds at a quarter-note position. */
function secondsAtPpq(targetPpq: number, points: TempoMapPoint[]): number | undefined {
  if (points.length === 0) return undefined
  const sorted = sortedByPpq(points)
  let ppq = 0
  let elapsed = 0
  let bpm = sorted[0]!.bpm
  for (const point of sorted) {
    if (point.ppq <= ppq) { bpm = point.bpm; continue }
    if (point.ppq >= targetPpq) break
    elapsed += (point.ppq - ppq) * 60 / bpm
    ppq = point.ppq
    bpm = point.bpm
  }
  return elapsed + (targetPpq - ppq) * 60 / bpm
}

function barBeatAtPpq(ppq: number, points: TimeSignatureMapPoint[]): { bar: number; beat: number } | null {
  if (points.length === 0) return null
  const sorted = sortedByPpq(points)
  let segmentStart = 0
  let barIndex = 0
  let numerator = sorted[0]!.numerator
  let denominator = sorted[0]!.denominator
  for (const point of sorted) {
    if (point.ppq <= segmentStart) {
      numerator = point.numerator
      denominator = point.denominator
      continue
    }
    if (point.ppq > ppq) break
    const barPpq = numerator * 4 / denominator
    barIndex += (point.ppq - segmentStart) / barPpq
    segmentStart = point.ppq
    numerator = point.numerator
    denominator = point.denominator
  }
  const beatPpq = 4 / denominator
  const barPpq = numerator * beatPpq
  const offset = Math.max(0, ppq - segmentStart)
  return {
    bar: Math.floor(barIndex + offset / barPpq) + 1,
    beat: (offset % barPpq) / beatPpq + 1,
  }
}

/** The playhead's own bar grid, recovered from the drop anchor. Bar
 *  numbering anchors HERE: bar_of(x) = (bar_count + 1) +
 *  floor((x − bar_ppq) / barLength). The old "ppq 0 = bar 1" assumption
 *  is gone — projects with a count-in or shifted start number correctly
 *  because the host itself said which bar the playhead's ppq was in. */
export interface AnchorBarGrid {
  /** Display number of the bar the anchor sits in (host barCount + 1,
   *  matching the snapshot's own bar display). */
  anchorBar: number
  /** Quarter-note position of that bar's start (ppqPositionOfLastBarStart). */
  anchorBarPpq: number
  numerator: number
  denominator: number
}

function anchorBarGrid(metadata: AttachmentTimelineMetadata): AnchorBarGrid | null {
  const anchor = metadata.anchor
  if (!anchor || anchor.bar_count == null || anchor.bar_ppq == null
      || !Number.isFinite(anchor.bar_count) || !Number.isFinite(anchor.bar_ppq)) return null
  const numerator = anchor.tnum && anchor.tnum > 0 ? anchor.tnum
    : metadata.time_sig_num && metadata.time_sig_num > 0 ? metadata.time_sig_num : 4
  const denominator = anchor.tden && anchor.tden > 0 ? anchor.tden
    : metadata.time_sig_den && metadata.time_sig_den > 0 ? metadata.time_sig_den : 4
  return { anchorBar: anchor.bar_count + 1, anchorBarPpq: anchor.bar_ppq, numerator, denominator }
}

/** Quarter-note position of project bar 1's downbeat, derived from the
 *  anchor grid (bar 1 = anchor bar minus (anchorBar − 1) bar lengths).
 *  Null when no grid was captured — callers fall back to ppq 0.
 *  Constant-meter between bar 1 and the anchor is assumed; that
 *  assumption is measured, not guessed — see the drop diagnostics. */
export function anchorBarOnePpq(metadata: AttachmentTimelineMetadata | null | undefined): number | null {
  if (!metadata) return null
  const grid = anchorBarGrid(metadata)
  if (!grid) return null
  const barPpq = grid.numerator * 4 / grid.denominator
  return grid.anchorBarPpq - (grid.anchorBar - 1) * barPpq
}

/** Bar/beat at a quarter-note position measured against the anchor
 *  grid. Floored division keeps positions BEFORE the anchor bar (and
 *  before bar 1 — count-in territory) correct. */
function barBeatAtAnchoredPpq(ppq: number, grid: AnchorBarGrid): { bar: number; beat: number } {
  const beatPpq = 4 / grid.denominator
  const barPpq = grid.numerator * beatPpq
  const barsFromAnchor = Math.floor((ppq - grid.anchorBarPpq) / barPpq)
  const intraBar = ppq - grid.anchorBarPpq - barsFromAnchor * barPpq
  return { bar: grid.anchorBar + barsFromAnchor, beat: intraBar / beatPpq + 1 }
}

/** Fill older BWF-only records with the project context available now. */
export function mergeEmbeddedTimelineWithProject(
  embedded: AttachmentTimelineMetadata | null | undefined,
  project: AttachmentTimelineMetadata | null | undefined,
): AttachmentTimelineMetadata | null {
  if (!embedded) return project ?? null
  if (!project) return embedded

  const tempoMap = embedded.tempo_map?.length ? embedded.tempo_map : project.tempo_map
  const signatureMap = embedded.time_signature_map?.length ? embedded.time_signature_map : project.time_signature_map
  let ppq = embedded.position.ppq
  let bar = embedded.position.bar
  let beat = embedded.position.beat

  if (ppq == null && embedded.position.seconds != null && tempoMap?.length) {
    // Logic's BWF timeline normally starts at 01:00:00 while its musical
    // timeline starts at bar 1. Preserve sub-hour project time for conversion.
    const musicalSeconds = Math.max(0, embedded.position.seconds - (embedded.position.seconds >= 3600 ? 3600 : 0))
    ppq = ppqAtSeconds(musicalSeconds, tempoMap)
  }
  if ((bar == null || beat == null) && ppq != null && signatureMap?.length) {
    const musical = barBeatAtPpq(ppq, signatureMap)
    bar = bar ?? musical?.bar
    beat = beat ?? musical?.beat
  }

  return {
    ...embedded,
    position: { ...embedded.position, ppq, bar, beat },
    tempo_map: tempoMap,
    time_signature_map: signatureMap,
    bpm: embedded.bpm ?? project.bpm,
    time_sig_num: embedded.time_sig_num ?? project.time_sig_num,
    time_sig_den: embedded.time_sig_den ?? project.time_sig_den,
    anchor: embedded.anchor ?? project.anchor,
  }
}

/**
 * Resolve the file's stamp against the drop-time host anchor into an
 * absolute project position. Logic stamps a promise-exported region
 * relative to the CYCLE start while the cycle is on (observed: a region
 * at project bar 3 stamped as bar 2 with the cycle starting at bar 2),
 * and relative to project zero otherwise — so:
 *   · cycle on + left locator known → basis 'cycle',
 *     absolute = locator + stamp (converted through the tempo map)
 *   · cycle reported off            → basis 'project', absolute = stamp
 *   · no loop report (old binary)   → basis 'unknown', no absolute —
 *     display falls back to the relative reading and says so.
 * Bar numbers come from the playhead's OWN grid (anchor bar_count +
 * bar_ppq) whenever the drop captured one — never from an assumption
 * about where ppq zero sits. The raw stamp, the anchor, and the
 * computed absolute are ALL stored, so the detection rule can evolve
 * without re-uploading audio.
 */
function withAbsolutePosition(metadata: AttachmentTimelineMetadata): AttachmentTimelineMetadata {
  const { position, anchor } = metadata
  if (position.confidence !== 'exact') return metadata

  // The stamp in quarter notes from ITS OWN zero (whatever that is):
  // prefer the tempo-map conversion the merge already did, then bpm.
  let stampPpq = position.ppq
  if (stampPpq == null && position.seconds != null && metadata.bpm && metadata.bpm > 0) {
    const seconds = Math.max(0, position.seconds - (position.seconds >= 3600 ? 3600 : 0))
    stampPpq = seconds * metadata.bpm / 60
  }
  if (stampPpq == null || anchor?.is_looping == null
      || (anchor.is_looping && anchor.loop_start_ppq == null)) {
    return { ...metadata, position: { ...position, basis: 'unknown' } }
  }

  let absolutePpq = stampPpq
  let basis: 'cycle' | 'project' = 'project'
  if (anchor.is_looping && anchor.loop_start_ppq != null) {
    basis = 'cycle'
    // Offset in SECONDS from the locator, so a tempo change before the
    // cycle doesn't skew the conversion; constant tempo reduces this to
    // loop_start_ppq + stampPpq exactly.
    const tempoMap = metadata.tempo_map ?? []
    const loopStartSeconds = secondsAtPpq(anchor.loop_start_ppq, tempoMap)
    const stampSeconds = position.seconds != null
      ? Math.max(0, position.seconds - (position.seconds >= 3600 ? 3600 : 0))
      : undefined
    const converted = loopStartSeconds != null && stampSeconds != null
      ? ppqAtSeconds(loopStartSeconds + stampSeconds, tempoMap)
      : undefined
    absolutePpq = converted ?? anchor.loop_start_ppq + stampPpq
  }

  // A non-finite result must never be stored: NaN/Infinity strips to
  // null in the jsonb round trip and the label silently disappears.
  // Fall back to the honest 'unknown' reading instead.
  if (!Number.isFinite(absolutePpq)) {
    return { ...metadata, position: { ...position, basis: 'unknown' } }
  }

  // Bar/beat now describe the ABSOLUTE position, matching what the
  // labels show; the raw stamp stays in ppq/seconds/source_samples.
  // Numbering anchors on the playhead's OWN bar grid when the drop
  // captured one — no assumption about where ppq zero sits. Only
  // without a grid (old records) does the zero-anchored map reading
  // remain.
  const grid = anchorBarGrid(metadata)
  let bar: number
  let beat: number
  if (grid) {
    ({ bar, beat } = barBeatAtAnchoredPpq(absolutePpq, grid))
  } else {
    const musical = barBeatAtPpq(absolutePpq, metadata.time_signature_map ?? [])
    const numerator = metadata.time_sig_num && metadata.time_sig_num > 0 ? metadata.time_sig_num : 4
    const denominator = metadata.time_sig_den && metadata.time_sig_den > 0 ? metadata.time_sig_den : 4
    const beatPpq = 4 / denominator
    const barPpq = numerator * beatPpq
    bar = musical?.bar ?? Math.floor(absolutePpq / barPpq) + 1
    beat = musical?.beat ?? (absolutePpq % barPpq) / beatPpq + 1
  }
  return {
    ...metadata,
    position: { ...position, absolute_ppq: absolutePpq, basis, bar, beat },
  }
}

/** Logic ticks: 960 per quarter note, 240 per 16th (the division). */
const TICKS_PER_QUARTER = 960
const TICKS_PER_DIVISION = 240

interface PositionParts {
  bar: number
  beat: number
  /** 16th-note subdivision within the beat, 1-based (Logic's division). */
  division: number
  /** Ticks within the division, 0..239. */
  tick: number
}

/** Bar/beat/division/tick at a quarter-note position, honoring the
 *  signature map when there is one. Integer tick math so "exactly on
 *  the downbeat" never reads as bar N-1 beat 4 div 4 tick 239. */
function positionPartsAtPpq(
  ppq: number,
  points: TimeSignatureMapPoint[],
  fallbackNumerator: number,
  fallbackDenominator: number,
): PositionParts {
  let numerator = fallbackNumerator
  let denominator = fallbackDenominator
  let segmentStart = 0
  let barIndex = 0
  if (points.length > 0) {
    const sorted = sortedByPpq(points)
    numerator = sorted[0]!.numerator
    denominator = sorted[0]!.denominator
    for (const point of sorted) {
      if (point.ppq <= segmentStart) {
        numerator = point.numerator
        denominator = point.denominator
        continue
      }
      if (point.ppq > ppq) break
      const barPpq = numerator * 4 / denominator
      barIndex += (point.ppq - segmentStart) / barPpq
      segmentStart = point.ppq
      numerator = point.numerator
      denominator = point.denominator
    }
  }
  const beatPpq = 4 / denominator
  const barPpq = numerator * beatPpq
  const totalBars = barIndex + Math.max(0, ppq - segmentStart) / barPpq
  let bar = Math.floor(totalBars)
  const ticksPerBeat = Math.round(beatPpq * TICKS_PER_QUARTER)
  const ticksPerBar = numerator * ticksPerBeat
  let ticksIntoBar = Math.round((totalBars - bar) * barPpq * TICKS_PER_QUARTER)
  if (ticksIntoBar >= ticksPerBar) { bar += 1; ticksIntoBar = 0 }
  const beat = Math.floor(ticksIntoBar / ticksPerBeat) + 1
  const beatRemainder = ticksIntoBar % ticksPerBeat
  return {
    bar: bar + 1,
    beat,
    division: Math.floor(beatRemainder / TICKS_PER_DIVISION) + 1,
    tick: beatRemainder % TICKS_PER_DIVISION,
  }
}

/** Same Logic-grade parts, but measured against the playhead's own
 *  bar grid: integer tick distance from the anchor bar's downbeat,
 *  floored so positions before the anchor (or before bar 1) still land
 *  in the right bar with a non-negative intra-bar remainder. */
function positionPartsAtAnchoredPpq(ppq: number, grid: AnchorBarGrid): PositionParts {
  const beatPpq = 4 / grid.denominator
  const ticksPerBeat = Math.round(beatPpq * TICKS_PER_QUARTER)
  const ticksPerBar = grid.numerator * ticksPerBeat
  const ticksFromAnchor = Math.round((ppq - grid.anchorBarPpq) * TICKS_PER_QUARTER)
  const barsFromAnchor = Math.floor(ticksFromAnchor / ticksPerBar)
  const ticksIntoBar = ticksFromAnchor - barsFromAnchor * ticksPerBar
  const beatRemainder = ticksIntoBar % ticksPerBeat
  return {
    bar: grid.anchorBar + barsFromAnchor,
    beat: Math.floor(ticksIntoBar / ticksPerBeat) + 1,
    division: Math.floor(beatRemainder / TICKS_PER_DIVISION) + 1,
    tick: beatRemainder % TICKS_PER_DIVISION,
  }
}

export interface TimelinePositionLabel {
  /** "bar 3.2.4" — ".tick" appended only when nonzero. */
  text: string
  /** Full reading for the tooltip: "3 2 4 120 / 120bpm" — with the
   *  relative caveat appended when the project position is unknown. */
  tooltip: string
  /** True when the numbers count from the exported audio's own zero
   *  (no drop anchor) rather than from project zero. */
  relative: boolean
}

/**
 * The Logic-grade position (마디.박.디비전.틱) a region starts at —
 * absolute project position when ingestion could anchor the stamp,
 * otherwise the old stamp-relative reading marked as such. Only
 * sample-exact stamps qualify, and only when the capture carried the
 * host tempo; estimated playhead snapshots and older records without
 * bpm return null (the UI shows nothing).
 */
export function timelinePositionLabel(
  metadata: AttachmentTimelineMetadata | null | undefined,
): TimelinePositionLabel | null {
  if (!metadata || metadata.position.confidence !== 'exact') return null
  const bpm = metadata.bpm
  if (bpm == null || !Number.isFinite(bpm) || bpm <= 0) return null
  const { position } = metadata

  const anchored = position.absolute_ppq != null && Number.isFinite(position.absolute_ppq)
    && (position.basis === 'cycle' || position.basis === 'project')
  let ppq = anchored ? position.absolute_ppq : position.ppq
  if (ppq == null && position.source_samples != null
      && position.sample_rate != null && position.sample_rate > 0) {
    const rawSeconds = position.source_samples / position.sample_rate
    // Logic's BWF clock starts at 01:00:00 while its ppq zero sits at
    // the project start (which the anchor grid places on the bar line).
    const seconds = Math.max(0, rawSeconds - (rawSeconds >= 3600 ? 3600 : 0))
    ppq = seconds * bpm / 60
  }
  if (ppq == null || !Number.isFinite(ppq)) return null

  const numerator = metadata.time_sig_num && metadata.time_sig_num > 0 ? metadata.time_sig_num : 4
  const denominator = metadata.time_sig_den && metadata.time_sig_den > 0 ? metadata.time_sig_den : 4
  // Absolute readings number bars against the playhead's own grid when
  // the drop captured one; the zero-anchored map reading survives only
  // for relative stamps and old records without a grid.
  const grid = anchorBarGrid(metadata)
  const partsAt = (x: number) => anchored && grid
    ? positionPartsAtAnchoredPpq(x, grid)
    : positionPartsAtPpq(x, metadata.time_signature_map ?? [], numerator, denominator)
  const parts = partsAt(ppq)
  const relative = !anchored
  const text = `bar ${parts.bar}.${parts.beat}.${parts.division}${parts.tick > 0 ? `.${parts.tick}` : ''}`
  const full = `${parts.bar} ${parts.beat} ${parts.division} ${parts.tick} / ${Math.round(bpm)}bpm`
  // A FILES-tab upload padded to bar 1 says so — and where it came from.
  const alignedFrom = position.aligned_from_ppq
  let tooltip = relative
    ? `${full} — relative to the exported audio — project position unknown`
    : full
  if (alignedFrom != null && Number.isFinite(alignedFrom)) {
    const was = grid
      ? positionPartsAtAnchoredPpq(alignedFrom, grid)
      : positionPartsAtPpq(alignedFrom, metadata.time_signature_map ?? [], numerator, denominator)
    tooltip = `${full} — aligned to bar 1 (was bar ${was.bar}.${was.beat}.${was.division}${was.tick > 0 ? `.${was.tick}` : ''})`
  }
  return { text, tooltip, relative }
}

function fourCC(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset]!, bytes[offset + 1]!, bytes[offset + 2]!, bytes[offset + 3]!)
}

/** Every leaf tag the iXML chunk carries, verbatim (trimmed, value
 *  capped) — the diagnostics dump ALL of them, not just the keys the
 *  parser uses, so the export-reference rule can be read off real
 *  files instead of guessed. */
function xmlAllTags(xml: string): Record<string, string> {
  const tags: Record<string, string> = {}
  const pattern = /<([A-Za-z0-9_:.-]+)(?:\s[^>]*)?>([^<]*)<\/\1>/g
  let count = 0
  for (let match = pattern.exec(xml); match && count < 256; match = pattern.exec(xml)) {
    const value = match[2]!.trim()
    if (!value) continue
    const key = match[1]!
    tags[key in tags ? `${key}#${count}` : key] = value.slice(0, 256)
    count++
  }
  return tags
}

function xmlNumber(xml: string, tag: string): number | undefined {
  const match = xml.match(new RegExp(`<${tag}[^>]*>\\s*([^<]+)`, 'i'))
  if (!match) return undefined
  const text = match[1]!.trim()
  if (text.includes('/')) {
    const [a, b] = text.split('/').map(Number)
    return Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? a / b : undefined
  }
  const value = Number(text)
  return Number.isFinite(value) ? value : undefined
}

export interface AudioFormatProbe {
  sampleRate?: number
  bitDepth?: number
}

function readWavFormat(bytes: Uint8Array): AudioFormatProbe | null {
  if (bytes.length < 12 || fourCC(bytes, 0) !== 'RIFF' || fourCC(bytes, 8) !== 'WAVE') return null
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const size = new DataView(bytes.buffer, bytes.byteOffset + offset + 4, 4).getUint32(0, true)
    const dataOffset = offset + 8
    if (fourCC(bytes, offset) === 'fmt ' && size >= 16 && dataOffset + 16 <= bytes.length) {
      const view = new DataView(bytes.buffer, bytes.byteOffset + dataOffset, 16)
      return { sampleRate: view.getUint32(4, true), bitDepth: view.getUint16(14, true) }
    }
    offset = dataOffset + size + (size & 1)
  }
  return null
}

/** Read enough of a previously uploaded WAV to recover its format fields. */
export async function probeRemoteAudioFormat(url: string): Promise<AudioFormatProbe | null> {
  try {
    const response = await fetch(url, { headers: { Range: 'bytes=0-65535' } })
    if (!response.ok || !response.body) return null
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let length = 0
    while (length < 65536) {
      const { done, value } = await reader.read()
      if (done) break
      const remaining = 65536 - length
      const chunk = value.length > remaining ? value.subarray(0, remaining) : value
      chunks.push(chunk)
      length += chunk.length
      if (value.length > remaining) break
    }
    await reader.cancel().catch(() => {})
    const bytes = new Uint8Array(length)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    return readWavFormat(bytes)
  } catch {
    return null
  }
}

/** One drop ingestion, raw — everything the pipeline saw and decided,
 *  so cycle-on/off × project-start scenarios can be measured in the
 *  field and pasted back instead of theorized about. */
export interface DropIngestionReport {
  captured_at: string
  file: { name: string; size: number; type: string }
  /** RIFF chunk walk: id, declared size, bytes actually available. */
  chunks: { id: string; size: number; available: number }[]
  bext: { time_reference_samples: number | null; sample_rate: number | null } | null
  /** EVERY leaf tag the iXML chunk carried, not just the parsed keys. */
  ixml_tags: Record<string, string> | null
  /** extractAudioTimeline's parsed result (post-merge, post-anchor). */
  parsed_result: AttachmentTimelineMetadata | null
  /** The drop-frozen host snapshot verbatim (audio payload stripped). */
  snapshot_raw: Record<string, unknown> | null
  /** The fallback metadata the ingestion was handed (anchor included). */
  fallback_metadata: AttachmentTimelineMetadata | null
  computed: {
    absolute_ppq: number | null
    basis: string | null
    label: string | null
    label_tooltip: string | null
  }
  note?: string
}

const dropReports: DropIngestionReport[] = []

/** Last 10 ingestions, newest first. Read by the studio's hidden
 *  diagnostics overlay (double-click the 'orb' wordmark). */
export function getDropIngestionReports(): DropIngestionReport[] {
  return dropReports.slice().reverse()
}

function recordDropReport(report: DropIngestionReport) {
  dropReports.push(report)
  if (dropReports.length > 10) dropReports.shift()
}

/**
 * Read sample-accurate BWF/iXML timestamps from a dropped WAV. The audio is
 * left byte-for-byte unchanged; the extracted manifest travels with the chat
 * message. Non-WAV formats safely fall back to the host playhead snapshot.
 * Every call records a full raw diagnostics report (ring of 10).
 */
export async function extractAudioTimeline(
  file: File,
  fallback: AttachmentTimelineMetadata | null,
): Promise<AttachmentTimelineMetadata | null> {
  const report: DropIngestionReport = {
    captured_at: new Date().toISOString(),
    file: { name: file.name, size: file.size, type: file.type },
    chunks: [],
    bext: null,
    ixml_tags: null,
    parsed_result: null,
    snapshot_raw: latestRaw,
    fallback_metadata: fallback,
    computed: { absolute_ppq: null, basis: null, label: null, label_tooltip: null },
  }
  const finish = (result: AttachmentTimelineMetadata | null, note?: string) => {
    report.parsed_result = result
    report.computed.absolute_ppq = result?.position.absolute_ppq ?? null
    report.computed.basis = result?.position.basis ?? null
    const label = timelinePositionLabel(result)
    report.computed.label = label?.text ?? null
    report.computed.label_tooltip = label?.tooltip ?? null
    if (note) report.note = note
    recordDropReport(report)
    return result
  }

  const riffHeader = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  if (riffHeader.length < 12 || fourCC(riffHeader, 0) !== 'RIFF' || fourCC(riffHeader, 8) !== 'WAVE') {
    return finish(fallback, 'not RIFF/WAVE — host snapshot fallback')
  }

  let sampleRate: number | undefined
  let bitDepth: number | undefined
  let sourceSamples: number | undefined
  let source: 'bwf' | 'ixml' | undefined
  let ixml = ''

  // Read only each chunk header, then seek over its declared length. Logic
  // commonly writes the bext chunk *after* the multi-megabyte data chunk, so
  // scanning a prefix of the file misses the timestamp. Blob.slice gives us
  // random access without copying the audio payload into memory again.
  // A chunk whose declared size overruns the file (stale bookkeeping in a
  // streamed promise-export) is CLAMPED and still parsed as far as its
  // bytes actually exist — aborting the walk there used to throw away a
  // trailing bext stamp entirely.
  for (let offset = 12; offset + 8 <= file.size;) {
    const headerBytes = new Uint8Array(await file.slice(offset, offset + 8).arrayBuffer())
    if (headerBytes.length < 8) break
    const id = fourCC(headerBytes, 0)
    const size = new DataView(headerBytes.buffer, headerBytes.byteOffset, headerBytes.byteLength)
      .getUint32(4, true)
    const dataOffset = offset + 8
    const available = Math.min(size, file.size - dataOffset)
    report.chunks.push({ id, size, available })

    if (id === 'fmt ' && available >= 8) {
      const fmt = await file.slice(dataOffset, dataOffset + Math.min(available, 16)).arrayBuffer()
      if (fmt.byteLength >= 8) sampleRate = new DataView(fmt).getUint32(4, true)
      if (fmt.byteLength >= 16) bitDepth = new DataView(fmt).getUint16(14, true)
    }
    if (id === 'bext' && available >= 346) {
      const bext = await file.slice(dataOffset + 338, dataOffset + 346).arrayBuffer()
      if (bext.byteLength === 8) {
        const bextView = new DataView(bext)
        const low = bextView.getUint32(0, true)
        const high = bextView.getUint32(4, true)
        sourceSamples = high * 0x1_0000_0000 + low
        source = 'bwf'
      }
    }
    if (id.toLowerCase() === 'ixml' && available > 0) {
      const xmlBytes = await file.slice(dataOffset, dataOffset + Math.min(available, 1024 * 1024)).arrayBuffer()
      ixml = new TextDecoder().decode(xmlBytes)
    }
    offset = dataOffset + size + (size & 1)
  }

  if (ixml) report.ixml_tags = xmlAllTags(ixml)

  if (sourceSamples == null && ixml) {
    const direct = xmlNumber(ixml, 'BWF_TIME_REFERENCE') ?? xmlNumber(ixml, 'TIMESTAMP_SAMPLES')
    const low = xmlNumber(ixml, 'TIMESTAMP_SAMPLES_SINCE_MIDNIGHT_LO')
    const high = xmlNumber(ixml, 'TIMESTAMP_SAMPLES_SINCE_MIDNIGHT_HI')
    if (direct != null) sourceSamples = direct
    else if (low != null && high != null) sourceSamples = high * 0x1_0000_0000 + low
    if (sourceSamples != null) source = 'ixml'
    sampleRate = xmlNumber(ixml, 'TIMESTAMP_SAMPLE_RATE') ?? sampleRate
  }

  report.bext = {
    time_reference_samples: source === 'bwf' && sourceSamples != null ? sourceSamples : null,
    sample_rate: sampleRate ?? null,
  }

  if (sourceSamples == null || !source) {
    return finish(fallback, 'no BWF/iXML stamp — host snapshot fallback')
  }
  const exact: AttachmentTimelineMetadata = {
    schema_version: 1,
    position: {
      source_samples: sourceSamples,
      sample_rate: sampleRate,
      bit_depth: bitDepth,
      seconds: sampleRate && sampleRate > 0 ? sourceSamples / sampleRate : undefined,
      source,
      confidence: 'exact',
    },
    tempo_map: fallback?.tempo_map,
    time_signature_map: fallback?.time_signature_map,
    captured_at: new Date().toISOString(),
  }
  // Anchor the raw stamp against the drop-time host snapshot HERE, at
  // ingestion — a later display-time merge sees the host's CURRENT
  // cycle state, which says nothing about the drop's.
  const merged = mergeEmbeddedTimelineWithProject(exact, fallback)
  return finish(merged ? withAbsolutePosition(merged) : merged)
}

// ChatView is eagerly bundled with the collaboration screen, so start
// observing host changes before the user opens a particular conversation.
initAudioTimelineTracking()
