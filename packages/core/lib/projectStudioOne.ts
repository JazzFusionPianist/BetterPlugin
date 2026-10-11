import { parseXml, child, children, descendants, num, type XmlNode } from './miniXml.ts'
import { finishSnapshot, fileUrlCandidates, joinPath, dirName, baseName, type ProjectRegion, type ProjectSnapshot, type ProjectTrack, type RegionNote } from './projectRegions.ts'

/**
 * Studio One / Fender Studio Pro `.song` (a ZIP holding Song/song.xml and
 * Song/mediapool.xml). Verified on 6.x and Studio Pro 8 saved songs:
 * AudioEvent start/length/offset use timeFormat 0 = seconds, 2 = quarter
 * beats; TempoMapSegment tempo is seconds per beat; offset defaults to 0.
 */
export function parseStudioOneSong(input: { songXml: string; mediaPoolXml: string; songPath: string }): ProjectSnapshot {
  const song = parseXml(input.songXml), pool = parseXml(input.mediaPoolXml)
  if (song.name !== 'Song' || pool.name !== 'MediaPool') throw new Error('Not a Studio One song.')
  const root = children(song, 'Attributes').find(a => a.attrs['x:id'] === 'Root')
  const context = children(root, 'Attributes').find(a => a.attrs['x:id'] === 'timeContext')
  const rate = num(context?.attrs.sampleRate, 0)
  const segments = [...(context ? descendants(context, 'TempoMapSegment') : [])]
  // One segment = a constant tempo. Tempo changes are not converted yet.
  const secondsPerBeat = segments.length === 1 ? num(segments[0].attrs.tempo) : null

  const clips = new Map<string, XmlNode>()
  for (const clip of descendants(pool, 'AudioClip')) if (clip.attrs.mediaID) clips.set(clip.attrs.mediaID, clip)
  const songDir = dirName(input.songPath)

  const tracks: ProjectTrack[] = [], regions: ProjectRegion[] = []
  const list = children(root, 'List').find(l => l.attrs['x:id'] === 'Tracks')
  for (const track of list ? descendants(list, 'MediaTrack') : []) {
    if (track.attrs.mediaType !== 'Audio') continue
    const id = track.attrs.trackID
    if (!id) continue
    const format = children(track, 'SpeakerSetup').find(s => s.attrs['x:id'] === 'trackFormat')?.attrs.type
    tracks.push({ id, name: track.attrs.name || `Track ${tracks.length + 1}`, order: tracks.length,
      channels: format === 'Mono' ? 1 : format === 'Stereo' ? 2 : null })
    const events = children(track, 'List').find(l => l.attrs['x:id'] === 'Events')
    children(events, 'AudioEvent').forEach((event, index) => {
      const a = event.attrs
      const region: ProjectRegion = { id: `${id}#${index}`, trackId: id, name: a.name || 'Audio', source: null,
        startSeconds: 0, offsetSeconds: 0, lengthSeconds: 0, notes: [], disabledReason: null }
      regions.push(region)
      try {
        const format = a.timeFormat ?? '0'
        const toSeconds = (v: string | undefined) => {
          const n = num(v, 0)
          if (format === '0') return n
          if (format === '2') {
            if (secondsPerBeat === null) throw new Error('Tempo changes are not supported for beat-timed events yet.')
            return n * secondsPerBeat
          }
          throw new Error('Unsupported event time format.')
        }
        region.startSeconds = toSeconds(a.start)
        region.lengthSeconds = toSeconds(a.length)
        region.offsetSeconds = toSeconds(a.offset)
        if (num(a.speed, 1) !== 1 || num(a.transpose, 0) !== 0 || num(a.tune, 0) !== 0)
          throw new Error('Time-stretched or transposed events need rendering before sharing.')
        if (a.modification && a.modification !== '0') throw new Error('Audio Bend edits need rendering before sharing.')
        if (a.mute === '1') throw new Error('Muted event.')
        const clip = clips.get(a.clipID ?? '')
        if (!clip) throw new Error('The event audio is missing from the media pool.')
        const fileUrl = children(clip, 'Url').find(u => u.attrs['x:id'] === 'path')?.attrs.url
        if (!fileUrl) throw new Error('The event audio has no file path.')
        const candidates = fileUrlCandidates(fileUrl)
        // A moved song folder keeps its own copy under Media/.
        candidates.push(joinPath(songDir, 'Media/' + baseName(candidates[0] ?? fileUrl)))
        region.source = { candidates: [...new Set(candidates)] }
        // Timestretch tracks follow song tempo only when the clip has an approved, different tempo.
        const clipTempo = child(clip, 'AudioTempoMap')
        const approved = clipTempo?.attrs.tempoApproved === '1'
        const clipSegments = children(clipTempo, 'AudioTempoMapSegment')
        if (track.attrs.tempoFollow === '2' && approved && secondsPerBeat !== null
          && clipSegments.some(s => Math.abs(num(s.attrs.tempo, secondsPerBeat) - secondsPerBeat) > 1e-9))
          throw new Error('This event follows song tempo with time-stretching.')
        const notes = new Set<RegionNote>()
        if (a.normalize === '1') notes.add('gain')
        for (const c of event.children) {
          const kind = c.attrs['x:id'] ?? c.name
          if (kind === 'volumeCurve') { if (num(c.attrs.level, 1) !== 1) notes.add('gain') }
          else if (/fade/i.test(kind)) notes.add('fade')
          else notes.add('envelope')
        }
        if (num(a.fadeInLength, 0) > 0 || num(a.fadeOutLength, 0) > 0) notes.add('fade')
        region.notes = [...notes]
      } catch (e) { region.disabledReason = e instanceof Error ? e.message : String(e) }
    })
  }
  const name = baseName(input.songPath).replace(/\.song$/i, '')
  return finishSnapshot({ daw: 'Studio One', kind: 'studio-one', name, sampleRate: rate > 0 ? rate : null, tracks, regions })
}
