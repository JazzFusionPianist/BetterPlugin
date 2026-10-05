import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { zipSync, strToU8 } from 'fflate'
import { inspectSession } from './ptsl.mjs'
import { parseProToolsTimeline, timelineExportRequest } from './proToolsTimeline.mjs'
import { parseRegionBundle } from '../../core/lib/regionBundle.ts'

const LIMIT = 300 * 1024 * 1024 - 2 * 1024 * 1024
const types = new Set(['TType_Audio', 'TType_Instrument', 'TType_Aux', 'TType_RoutingFolder'])
const active = value => value && value !== 'TAState_None'
function samples(value) {
  if (!/^-?\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw new Error('Invalid sample position from Pro Tools.')
  return Number(value)
}
function reason(track) {
  if (!types.has(track.type)) return 'Choose an audio, instrument, aux or routing-folder track.'
  if (active(track.track_attributes?.is_inactive)) return 'Activate this track in Pro Tools first.'
  if (!['TFormat_Mono', 'TFormat_Stereo'].includes(track.format)) return 'Only mono and stereo tracks are supported.'
  return null
}

export async function inspectProToolsTracks(call) {
  const session = await inspectSession(call)
  const selection = await call('GetTimelineSelection', { location_type: 'TLType_Samples' })
  const start = samples(selection.in_time), end = samples(selection.out_time)
  let entire = null, entireError = ''
  try {
    // SessionLength is normally 24 hours, NOT the end of the song.
    const report = parseProToolsTimeline((await call('ExportSessionInfoAsText', timelineExportRequest)).session_info)
    const timecode = (await call('GetSessionStartTime')).session_start_time
    const converted = await call('GetTimeAsType', { location: { location: timecode, time_type: 'TLType_TimeCode' }, time_type: 'TLType_Samples' })
    const first = samples(converted.converted_location?.location)
    const last = report.tracks.reduce((max, t) => t.events.reduce((n, e) => Math.max(n, e.end), max), first)
    if (session.tracks.some(t => ['TType_Midi', 'TType_Instrument'].includes(t.type) && t.track_attributes?.contains_clips))
      throw new Error('MIDI clip boundaries are not in the audio timeline report. Select the full song range in Pro Tools and use Timeline selection.')
    if (last <= first) throw new Error('No audio range found. Select a range in Pro Tools and refresh.')
    entire = { start: first, end: last }
  } catch (error) { entireError = error.message }
  if ((await call('GetSessionIDs')).instance_id !== session.instanceId) throw new Error('The session changed. Refresh the track list.')
  return { sessionId: session.instanceId, sampleRate: session.sampleRate,
    name: (await call('GetSessionName')).session_name,
    tracks: session.tracks.map(t => ({ id: t.id, name: t.name, type: t.type.replace('TType_', ''),
      selected: !!active(t.track_attributes?.is_selected), disabledReason: reason(t) })),
    ranges: { entire, selection: end > start ? { start, end } : null }, entireError }
}

/** Read what the host actually wrote; do not assume its bounce preferences. */
export function probeWave(bytes) {
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Pro Tools did not return a PCM WAV.')
  let format, dataBytes
  for (let p = 12; p + 8 <= bytes.length;) {
    const size = bytes.readUInt32LE(p + 4), name = bytes.toString('ascii', p, p + 4), start = p + 8
    if (start + size > bytes.length) throw new Error('Truncated WAV from Pro Tools.')
    if (name === 'fmt ' && size >= 16) {
      let encoding = bytes.readUInt16LE(start)
      if (encoding === 65534 && size >= 40) encoding = bytes.readUInt16LE(start + 24)
      format = { encoding, channels: bytes.readUInt16LE(start + 2), sampleRate: bytes.readUInt32LE(start + 4),
        block: bytes.readUInt16LE(start + 12), bits: bytes.readUInt16LE(start + 14) }
    }
    if (name === 'data') dataBytes = size
    p = start + size + size % 2
  }
  if (!format || ![1, 3].includes(format.encoding) || ![1, 2].includes(format.channels)
    || !format.block || !dataBytes || dataBytes % format.block) throw new Error('Unsupported WAV from Pro Tools.')
  return { ...format, frames: dataBytes / format.block }
}

export async function exportProToolsTracks({ call, sessionId, options, directory }) {
  if (!options || !Array.isArray(options.trackIds) || !options.trackIds.length || options.trackIds.length > 64
    || new Set(options.trackIds).size !== options.trackIds.length || !['entire', 'selection'].includes(options.range))
    throw new Error('Choose 1–64 tracks and an export range.')
  const snapshot = await inspectProToolsTracks(call)
  if (snapshot.sessionId !== sessionId || options.sampleRate !== snapshot.sampleRate) throw new Error('Session changed. Refresh the track list.')
  const range = snapshot.ranges[options.range]
  // The user must see the exact range being exported, not a changed selection.
  if (!range || range.start !== options.start || range.end !== options.end) throw new Error('Export range changed or is unavailable. Refresh the track list.')
  const selected = options.trackIds.map(id => snapshot.tracks.find(t => t.id === id))
  if (selected.some(t => !t || t.disabledReason)) throw new Error('A selected track is missing or unavailable. Refresh the track list.')
  if ((range.end - range.start) / snapshot.sampleRate * 8 * selected.length > LIMIT)
    throw new Error('This export may exceed 300 MB. Choose fewer tracks or a shorter range.')
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const captureId = randomUUID(), files = {}, assetPaths = {}
  const bundle = { format: 'orb-region-bundle', version: 1, id: randomUUID(), timebase: 'song-samples',
    source: { daw: 'Pro Tools', projectId: sessionId, captureId }, tracks: [], regions: [], assets: [] }
  const receipt = { sessionId, range, tracks: selected, status: 'exporting', completed: [] }
  const journal = () => writeFile(join(directory, 'export.json'), JSON.stringify(receipt), { mode: 0o600 })
  await journal()
  let total = 0
  try {
    for (const [index, track] of selected.entries()) {
      const current = await inspectSession(call)
      if (current.instanceId !== sessionId || current.sampleRate !== snapshot.sampleRate
        || !current.tracks.some(t => t.id === track.id && t.name === track.name && !reason(t)))
        throw new Error('Session or selected track changed during export.')
      if (!(await call('GetTransportState')).current_setting?.endsWith('TransportStopped')) throw new Error('Stop playback/recording before exporting tracks.')
      const output = join(directory, `track-${index}`)
      await mkdir(output, { mode: 0o700 })
      const prefix = track.name.replace(/[\x00-\x1f/\\:]/g, '_').slice(0, 100) || 'Track'
      const result = await call('BounceTrack', {
        // 2026.4 accepts file_name; the shipped schema documents file_name_prefix.
        file_name: prefix, file_name_prefix: prefix, file_type: 'EMFType_WAV',
        audio_info: {}, audio_encoding_options: {}, src_track_id: track.id,
        offline_bounce: 'TBool_True',
        in_location: { location: String(range.start), time_type: 'TLType_Samples' },
        out_location: { location: String(range.end), time_type: 'TLType_Samples' },
        location_info: { import_after_bounce: 'TBool_False', file_destination: 'EMFDestination_Directory', directory: output + sep },
      })
      if ((await call('GetSessionIDs')).instance_id !== sessionId) throw new Error('Session changed during bounce.')
      if (result.file_paths?.length !== 1) throw new Error('Expected one interleaved WAV per track. Check the Pro Tools Track Bounce settings.')
      const root = await realpath(output), path = await realpath(result.file_paths[0])
      if (!path.startsWith(root + sep)) throw new Error('Pro Tools returned a file outside the export folder.')
      const info = await stat(path)
      total += info.size
      if (!info.isFile() || total > LIMIT) throw new Error('Export exceeds the 300 MB transfer limit.')
      const bytes = await readFile(path), wave = probeWave(bytes)
      const expectedFrames = Math.round((range.end - range.start) * wave.sampleRate / snapshot.sampleRate)
      if (wave.frames !== expectedFrames) throw new Error('The bounced duration does not match the requested range. Nothing was attached.')
      const hash = createHash('sha256').update(bytes).digest('hex'), name = prefix + '.wav'
      if (!assetPaths[hash]) {
        assetPaths[hash] = `audio/${hash}.wav`; files[assetPaths[hash]] = bytes
        bundle.assets.push({ id: hash, sha256: hash, name, bytes: bytes.length, sampleRate: wave.sampleRate, channels: wave.channels, frames: wave.frames })
      }
      bundle.tracks.push({ id: track.id, name: track.name, order: index, channels: wave.channels })
      bundle.regions.push({ id: randomUUID(), assetId: hash, trackId: track.id, name,
        start: { samples: range.start, sampleRate: snapshot.sampleRate }, offsetFrames: 0, lengthFrames: wave.frames })
      receipt.completed.push(track.id); await journal()
    }
    if (!parseRegionBundle(bundle)) throw new Error('Exported track metadata is invalid.')
    files['orb-regions.json'] = strToU8(JSON.stringify({ ...bundle, assetPaths }))
    await writeFile(join(directory, 'selection.orb-regions.zip'), zipSync(files, { level: 0 }), { mode: 0o600 })
    receipt.status = 'complete'; await journal()
    return { name: 'tracks.orb-regions.zip', tracks: selected.length }
  } catch (error) {
    receipt.status = 'failed'; receipt.error = error.message; await journal()
    throw error
  }
}
