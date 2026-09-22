export const timelineExportRequest = {
  include_file_list: false, include_clip_list: false, include_markers: false,
  include_plugin_list: false, include_track_edls: true,
  track_list_type: 'TListType_AllTracks', fade_handling_type: 'FHType_ShowCrossfades',
  location_type: 'TLType_Samples', text_as_file_format: 'TFFormat_UTF8', output_type: 'ESIOType_String',
}

/** PTSL exposes timeline instances as a tab-delimited EDL, not GetClipList definitions. */
export function parseProToolsTimeline(text) {
  if (typeof text !== 'string' || text.length > 16 * 1024 * 1024) throw new Error('Invalid Pro Tools timeline report.')
  const tracks = []
  let sampleRate, track, columns
  for (const line of text.split(/\r\n|\n|\r/)) {
    const fields = line.split('\t').map(v => v.trim())
    if (fields[0] === 'SAMPLE RATE:') sampleRate = Number(fields[1])
    if (fields[0] === 'TRACK NAME:') {
      if (!fields[1] || fields.length !== 2) throw new Error('Ambiguous track name in timeline report.')
      track = { name: fields[1], events: [] }
      tracks.push(track); columns = null
      continue
    }
    if (!track) continue
    if (fields[0] === 'CHANNEL') {
      const required = ['CHANNEL', 'EVENT', 'CLIP NAME', 'START TIME', 'END TIME', 'DURATION', 'STATE']
      if (required.some(key => fields.filter(v => v === key).length !== 1))
        throw new Error('Unsupported Pro Tools timeline columns.')
      columns = Object.fromEntries(required.map(key => [key, fields.indexOf(key)]))
      continue
    }
    if (!line.trim() || !columns) continue
    const number = key => {
      const value = fields[columns[key]]
      if (!/^-?\d+$/.test(value ?? '') || !Number.isSafeInteger(Number(value)))
        throw new Error('Timeline report is not in integer samples.')
      return Number(value)
    }
    const start = number('START TIME'), end = number('END TIME'), duration = number('DURATION')
    if (duration <= 0 || end - start !== duration) throw new Error('Invalid timeline event duration.')
    const name = fields[columns['CLIP NAME']]
    if (!name) throw new Error('Missing timeline clip name.')
    track.events.push({ channel: number('CHANNEL'), event: number('EVENT'), name, start, end, duration,
      state: fields[columns.STATE] })
  }
  if (!Number.isSafeInteger(sampleRate) || sampleRate <= 0) throw new Error('Missing timeline sample rate.')
  return { sampleRate, tracks }
}

export function verifyProToolsTimeline(report, expected, hostTracks, sampleRate) {
  const timeline = parseProToolsTimeline(report)
  if (timeline.sampleRate !== sampleRate) throw new Error('Timeline sample rate changed.')
  for (const target of expected) {
    const host = hostTracks.filter(t => t.id === target.id)
    if (host.length !== 1 || host[0].name !== target.name) throw new Error('Imported track changed during verification.')
    const label = target.name + (target.channels === 2 ? ' (Stereo)' : '')
    const tracks = timeline.tracks.filter(t => t.name === label)
    if (tracks.length !== 1) throw new Error('Cannot uniquely identify the imported track in the timeline report.')
    const remaining = [...tracks[0].events]
    for (const clip of target.clips) {
      const index = remaining.findIndex(e => e.channel === clip.channel && e.name === clip.name
        && e.start === clip.start && e.duration === clip.duration)
      if (index < 0) throw new Error(`Timeline verification failed for ${target.name}: ${clip.name}.`)
      remaining.splice(index, 1)
    }
    if (remaining.length) throw new Error(`Unexpected clips on imported track ${target.name}.`)
  }
  return { trackCount: expected.length, channelClipCount: expected.reduce((n, t) => n + t.clips.length, 0) }
}
