import { parseXml, child, children, path, valueOf, num, type XmlNode } from './miniXml.ts'
import { tempoMap, beatsToSeconds, secondsPerBeatAt, type TempoMap, type TempoPoint } from './tempoMap.ts'
import { finishSnapshot, joinPath, dirName, baseName, type ProjectRegion, type ProjectSnapshot, type ProjectTrack, type RegionNote } from './projectRegions.ts'

/**
 * Ableton Live Set (`.als`, gzip-compressed XML; caller decompresses).
 * Arrangement clips sit in AudioTrack › DeviceChain › MainSequencer › Sample ›
 * ArrangerAutomation › Events. CurrentStart/CurrentEnd are arrangement beats.
 * Unwarped clip loop markers are source seconds; warped ones are clip beats
 * mapped to source seconds through WarpMarkers.
 *
 * Qualification: synthetic Live 11/12-schema sets only (Live is not installed
 * on the QA machine). Treat as experimental until verified on real sets.
 */
const bool = (node: XmlNode | undefined, name: string) => valueOf(node, name) === 'true'

// Device state can be most of a large set; never retain it.
const SKIP = new Set(['Devices', 'ClipSlotList', 'FreezeSequencer', 'MidiControllers', 'ViewData', 'Locators', 'Scenes'])

function readTempo(set: XmlNode): TempoMap {
  const main = child(set, 'MainTrack') ?? child(set, 'MasterTrack')
  const tempo = path(main, 'DeviceChain', 'Mixer', 'Tempo')
  const manual = num(valueOf(tempo, 'Manual'))
  const target = path(tempo, 'AutomationTarget')?.attrs.Id
  const points: TempoPoint[] = [{ beat: 0, bpm: manual, ramp: false }]
  if (target !== undefined) {
    for (const env of children(path(main, 'AutomationEnvelopes', 'Envelopes'), 'AutomationEnvelope')) {
      if (path(env, 'EnvelopeTarget', 'PointeeId')?.attrs.Value !== target) continue
      const events = children(path(env, 'Automation', 'Events'), 'FloatEvent')
      if (!events.length) break
      points.length = 0
      for (const e of events) {
        const beat = num(e.attrs.Time), bpm = num(e.attrs.Value)
        // The pre-song placeholder (≈ −63M beats) holds; real breakpoints ramp linearly.
        points.push({ beat: beat < -1e6 ? -1e6 : beat, bpm, ramp: beat >= -1e6 })
      }
    }
  }
  // Ramps only between real breakpoints; the last point holds forever.
  points.forEach((p, i) => { if (i === points.length - 1) p.ramp = false })
  return tempoMap(points)
}

function sourceCandidates(clip: XmlNode, setDir: string): string[] {
  const ref = path(clip, 'SampleRef', 'FileRef')
  const out: string[] = []
  const abs = valueOf(ref, 'Path')
  if (abs) out.push(abs)
  const rel = valueOf(ref, 'RelativePath')
  if (rel) out.push(joinPath(setDir, rel))
  // Live ≤10: RelativePath › RelativePathElement[Dir] + Name.
  const elements = children(child(ref, 'RelativePath'), 'RelativePathElement')
  const fileName = valueOf(ref, 'Name')
  if (fileName && elements.length) out.push(joinPath(setDir, [...elements.map(e => e.attrs.Dir), fileName].join('/')))
  else if (fileName) out.push(joinPath(setDir, 'Samples/Recorded/' + fileName), joinPath(setDir, 'Samples/Imported/' + fileName))
  return [...new Set(out.filter(Boolean))]
}

function warpSeconds(markers: { beat: number; sec: number }[], beat: number): number {
  // Piecewise-linear; Live extrapolates past the outer markers with the edge slope.
  if (markers.length === 1) throw new Error('Incomplete warp markers.')
  let i = 0
  while (i + 2 < markers.length && markers[i + 1].beat <= beat) i++
  const a = markers[i], b = markers[i + 1]
  return a.sec + (beat - a.beat) * (b.sec - a.sec) / (b.beat - a.beat)
}

function readClip(clip: XmlNode, map: TempoMap, setDir: string, region: ProjectRegion) {
  const startBeat = num(valueOf(clip, 'CurrentStart') ?? clip.attrs.Time)
  const endBeat = num(valueOf(clip, 'CurrentEnd'))
  if (!(endBeat > startBeat)) throw new Error('Empty clip.')
  region.startSeconds = beatsToSeconds(map, startBeat)
  region.lengthSeconds = beatsToSeconds(map, endBeat) - region.startSeconds
  region.source = { candidates: sourceCandidates(clip, setDir) }
  if (bool(clip, 'Disabled')) throw new Error('Deactivated clip.')
  if (num(valueOf(clip, 'PitchCoarse'), 0) !== 0 || num(valueOf(clip, 'PitchFine'), 0) !== 0)
    throw new Error('Transposed clips need rendering before sharing.')
  if (bool(clip, 'IsReversed') || bool(clip, 'Reverse')) throw new Error('Reversed clips need rendering before sharing.')
  const loop = child(clip, 'Loop')
  const loopStart = num(valueOf(loop, 'LoopStart'), 0), loopEnd = num(valueOf(loop, 'LoopEnd'), 0)
  const startMarker = loopStart + num(valueOf(loop, 'StartRelative'), 0)
  const looping = bool(loop, 'LoopOn')
  if (bool(clip, 'IsWarped')) {
    const markers = children(child(clip, 'WarpMarkers'), 'WarpMarker')
      .map(m => ({ beat: num(m.attrs.BeatTime), sec: num(m.attrs.SecTime) })).sort((a, b) => a.beat - b.beat)
    if (markers.length < 2) throw new Error('Incomplete warp markers.')
    // Unity rate only: each used marker segment must play at the arrangement tempo.
    const clipBeats = endBeat - startBeat
    for (let i = 0; i + 1 < markers.length; i++) {
      const a = markers[i], b = markers[i + 1]
      if (b.beat <= startMarker || a.beat >= startMarker + clipBeats) continue
      const ratio = (b.sec - a.sec) / (b.beat - a.beat)
      const spb = secondsPerBeatAt(map, startBeat + Math.max(0, a.beat - startMarker))
      if (Math.abs(ratio - spb) > 1e-6 * spb) throw new Error('Warped (time-stretched) clips need rendering before sharing.')
    }
    if (!map.constant) throw new Error('Warped clips over tempo changes need rendering before sharing.')
    if (looping && startMarker + clipBeats > loopEnd + 1e-9) throw new Error('Looped clips need consolidating before sharing.')
    region.offsetSeconds = warpSeconds(markers, startMarker)
  } else {
    // Unwarped: loop/start markers are already seconds in the sample.
    if (looping && startMarker + region.lengthSeconds > loopEnd + 1e-6) throw new Error('Looped clips need consolidating before sharing.')
    region.offsetSeconds = startMarker
  }
  const notes = new Set<RegionNote>()
  const volume = num(valueOf(clip, 'SampleVolume'), 1)
  if (Math.abs(volume - 1) > 1e-6) notes.add('gain')
  const fades = child(clip, 'Fades')
  if (fades && (num(valueOf(fades, 'FadeInLength'), 0) > 0 || num(valueOf(fades, 'FadeOutLength'), 0) > 0)) notes.add('fade')
  if (children(path(clip, 'Envelopes', 'Envelopes'), 'ClipEnvelope').length) notes.add('envelope')
  region.notes = [...notes]
}

export function parseAbletonSet(input: { xml: string; setPath: string }): ProjectSnapshot {
  const doc = parseXml(input.xml, { skip: name => SKIP.has(name) })
  const set = child(doc, 'LiveSet')
  if (doc.name !== 'Ableton' || !set) throw new Error('Not an Ableton Live Set.')
  const map = readTempo(set)
  const setDir = dirName(input.setPath)
  const tracks: ProjectTrack[] = [], regions: ProjectRegion[] = []
  for (const track of children(child(set, 'Tracks'), 'AudioTrack')) {
    const id = track.attrs.Id ?? String(tracks.length)
    const name = valueOf(child(track, 'Name'), 'UserName') || valueOf(child(track, 'Name'), 'EffectiveName') || `Audio ${tracks.length + 1}`
    tracks.push({ id, name, order: tracks.length, channels: null })
    const events = path(track, 'DeviceChain', 'MainSequencer', 'Sample', 'ArrangerAutomation', 'Events')
    children(events, 'AudioClip').forEach((clip, index) => {
      const region: ProjectRegion = { id: `${id}#${clip.attrs.Id ?? index}`, trackId: id, name: valueOf(clip, 'Name') || name,
        source: null, startSeconds: 0, offsetSeconds: 0, lengthSeconds: 0, notes: [], disabledReason: null }
      regions.push(region)
      try { readClip(clip, map, setDir, region) }
      catch (e) { region.disabledReason = e instanceof Error ? e.message : String(e) }
    })
  }
  return finishSnapshot({ daw: 'Ableton Live', kind: 'ableton', name: baseName(input.setPath).replace(/\.als$/i, ''),
    sampleRate: null, tracks, regions })
}
