import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { zipSync, strToU8 } from 'fflate'
import { parseRegionBundle } from '../../core/lib/regionBundle.ts'
import { probeWave } from './proToolsTracks.mjs'

const LIMIT = 298 * 1024 * 1024
const uid = value => typeof value === 'string' && /^[a-f0-9]{32}$/i.test(value) && !/^0+$/.test(value)
export const lunaValue = (response, key) => response?.data?.properties?.[key]?.value
// LUNA may append render/tail blocks beyond the song end. Keep the user's
// displayed range, without re-encoding, shifting, or padding missing samples.
export function cropLunaWave(bytes, frames) {
  const wave = probeWave(bytes)
  if (!Number.isSafeInteger(frames) || frames <= 0 || wave.frames < frames)
    throw new Error('LUNA rendered a shorter duration than requested. Nothing was attached.')
  let format, data
  for (let p = 12; p + 8 <= bytes.length;) {
    const size = bytes.readUInt32LE(p + 4), type = bytes.toString('ascii', p, p + 4)
    if (type === 'fmt ') format = bytes.subarray(p + 8, p + 8 + size)
    if (type === 'data') data = bytes.subarray(p + 8, p + 8 + frames * wave.block)
    p += 8 + size + size % 2
  }
  if (!format || !data) throw new Error('Invalid LUNA WAV.')
  const chunk = (name, payload) => {
    const header = Buffer.alloc(8); header.write(name); header.writeUInt32LE(payload.length, 4)
    return Buffer.concat([header, payload, Buffer.alloc(payload.length % 2)])
  }
  const count = Buffer.alloc(4); count.writeUInt32LE(frames)
  const body = Buffer.concat([Buffer.from('WAVE'), chunk('fmt ', format), chunk('fact', count), chunk('data', data)])
  const header = Buffer.alloc(8); header.write('RIFF'); header.writeUInt32LE(body.length, 4)
  return Buffer.concat([header, body])
}
export async function lunaRequest(path, body) {
  if (!path.startsWith('/') || path.includes('..')) throw new Error('Invalid LUNA request.')
  let response
  try {
    response = await fetch('http://127.0.0.1:4718' + path, {
      method: body === undefined ? 'GET' : 'POST', redirect: 'error',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000),
    })
  } catch { throw new Error('Could not connect to LUNA. Open LUNA and a session, then refresh.') }
  const raw = await response.text()
  if (!response.ok) throw new Error('LUNA rejected the request (' + response.status + ').')
  let result
  try { result = JSON.parse(raw) } catch { throw new Error('LUNA returned an unsupported response. No audio was attached.') }
  if (!result || typeof result !== 'object' || result.error || !Object.hasOwn(result, 'data'))
    throw new Error('LUNA could not complete the request. No audio was attached.')
  return result
}

export async function inspectLunaTracks(call = lunaRequest) {
  const sessionId = lunaValue(await call('/sessions'), 'focused_session')
  if (!uid(sessionId)) throw new Error('Open a session in LUNA, then refresh.')
  const path = '/sessions/' + sessionId
  const session = await call(path)
  if (lunaValue(session, 'loaded') !== true) throw new Error('Wait for the LUNA session to finish loading.')
  const sampleRate = (await call('/sample_rate')).data?.value
  if (![44100, 48000, 88200, 96000, 176400, 192000].includes(sampleRate)) throw new Error('Unknown LUNA sample rate.')
  const context = await call(path + '/contexts/main')
  const selected = lunaValue(context, 'selection_tracks') ?? []
  const tracks = []
  const children = (await call(path + '/tracks')).data?.children
  if (!Array.isArray(children) || children.length > 10000) throw new Error('Unsupported LUNA track list.')
  for (const child of children) {
    if (!uid(child.path)) throw new Error('Invalid LUNA track ID.')
    const track = await call(path + '/tracks/' + child.path)
    const type = lunaValue(track, 'track_type')
    // Internal metronome/count-in channels are not user stems.
    if (type === 'click' || type === 'count_in') continue
    const format = lunaValue(track, 'stem_format')
    tracks.push({ id: child.path, name: lunaValue(track, 'name') || 'Untitled',
      type: type === 'instrument' ? 'Instrument' : 'Audio', order: lunaValue(track, 'order') ?? tracks.length,
      selected: selected.includes(child.path),
      disabledReason: !['audio', 'instrument'].includes(type) ? 'Only audio and instrument tracks are supported in LUNA.'
        : lunaValue(track, 'enabled') !== true ? 'Activate this track in LUNA first.'
        : !['mono', 'stereo'].includes(format) ? 'Only mono and stereo tracks are supported.' : null })
  }
  const endTime = session.data?.properties?.max_tick?.min_sec
  const seconds = endTime && Number(endTime.minutes) * 60 + Number(endTime.seconds)
  const end = Math.round(seconds * sampleRate)
  const entire = Number.isSafeInteger(end) && end > 0 ? { start: 0, end } : null
  if (lunaValue(await call('/sessions'), 'focused_session') !== sessionId) throw new Error('LUNA session changed. Refresh the track list.')
  return { daw: 'LUNA', sessionId, name: lunaValue(session, 'name'), sampleRate,
    tracks: tracks.sort((a, b) => a.order - b.order), ranges: { entire, selection: null },
    entireError: entire ? '' : 'No session audio range found in LUNA.',
    rangeNote: 'LUNA currently supports Entire session only. Timeline selection is not yet supported.',
    revision: lunaValue(session, 'change_count') }
}

export async function exportLunaTracks({ call = lunaRequest, sessionId, options, directory, poll = () => delay(250), maxPolls = 6720 }) {
  if (!options || options.range !== 'entire' || !Array.isArray(options.trackIds) || !options.trackIds.length
    || options.trackIds.length > 64 || new Set(options.trackIds).size !== options.trackIds.length)
    throw new Error('Choose 1–64 LUNA tracks and Entire session.')
  const snapshot = await inspectLunaTracks(call)
  if (snapshot.sessionId !== sessionId || snapshot.sampleRate !== options.sampleRate) throw new Error('LUNA session changed. Refresh the track list.')
  const range = snapshot.ranges.entire
  if (!range || range.start !== options.start || range.end !== options.end) throw new Error('LUNA export range changed. Refresh the track list.')
  const selected = options.trackIds.map(id => snapshot.tracks.find(t => t.id === id))
  if (selected.some(t => !t || t.disabledReason)) throw new Error('A selected LUNA track is no longer available.')
  if (range.end * 8 * selected.length > LIMIT) throw new Error('This export exceeds 300 MB. Choose fewer tracks.')
  const sessionPath = '/sessions/' + sessionId
  const before = await call(sessionPath)
  if (lunaValue(before, 'playing') !== false || lunaValue(before, 'record_enabled') === true)
    throw new Error('Stop playback and disarm recording in LUNA before exporting.')
  if (uid(lunaValue(before, 'render_uid'))) throw new Error('Another LUNA render is running.')
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const renderId = randomUUID().replaceAll('-', '')
  const tracks = {}, output_paths = {}
  const outputs = selected.map((track, index) => {
    const fileId = randomUUID().replaceAll('-', ''), path = join(directory, 'track-' + index + '.wav')
    tracks[track.id] = fileId; output_paths[fileId] = path
    return { track, path }
  })
  const receipt = { daw: 'LUNA', sessionId, renderId, range, tracks: selected, status: 'creating' }
  const journal = () => writeFile(join(directory, 'export.json'), JSON.stringify(receipt), { mode: 0o600 })
  await journal()
  let created = false, completed = false
  try {
    const result = await call('/renders/new', { uid: renderId, type: 'bounce', name: 'Slur track export',
      real_time: false, add_to_session: false, record_point: 'post_pan', session_uid: sessionId,
      tracks, buses: {}, outputs: {}, output_paths })
    if (result.data?.uid !== renderId) throw new Error('LUNA did not create the requested render.')
    created = true
    const statePath = '/renders/' + renderId
    if (lunaValue(await call(statePath), 'render_is_offline') !== true) throw new Error('These LUNA tracks require real-time rendering; offline export was not started.')
    receipt.status = 'rendering'; await journal()
    await call('/renders/start', { uid: renderId })
    for (let count = 0; count < maxPolls; count++) {
      const state = await call(statePath), value = lunaValue(state, 'state')
      if (value === 'completed') { completed = true; break }
      if (['error', 'aborted'].includes(value)) throw new Error('LUNA render failed: ' + (lunaValue(state, 'error') || value))
      if (lunaValue(await call('/sessions'), 'focused_session') !== sessionId) throw new Error('LUNA session changed during export.')
      await poll()
    }
    if (!completed) throw new Error('LUNA export timed out. Nothing was attached.')
    // The render itself increments change_count (media/cache bookkeeping).
    // Check session/range/track identity instead of treating that as a user edit.
    const after = await inspectLunaTracks(call)
    if (after.sessionId !== sessionId || after.sampleRate !== snapshot.sampleRate
      || after.ranges.entire?.end !== range.end
      || selected.some(track => !after.tracks.some(t => t.id === track.id && t.name === track.name && !t.disabledReason)))
      throw new Error('LUNA session or tracks changed during export. Refresh and try again.')
    const bundle = { format: 'orb-region-bundle', version: 1, id: randomUUID(), timebase: 'song-samples',
      source: { daw: 'LUNA', projectId: sessionId, captureId: renderId }, tracks: [], regions: [], assets: [] }
    const files = {}, assetPaths = {}, root = await realpath(directory)
    let total = 0
    for (const [index, { track, path }] of outputs.entries()) {
      const actual = await realpath(path), info = await stat(actual)
      if (!actual.startsWith(root + sep) || !info.isFile()) throw new Error('Invalid LUNA output path.')
      total += info.size
      if (total > LIMIT) throw new Error('LUNA export exceeds 300 MB.')
      const raw = await readFile(actual)
      if (probeWave(raw).sampleRate !== snapshot.sampleRate)
        throw new Error('LUNA rendered a different duration or sample rate. Nothing was attached.')
      const bytes = cropLunaWave(raw, range.end), wave = probeWave(bytes)
      const hash = createHash('sha256').update(bytes).digest('hex')
      const name = (track.name.replace(/[\x00-\x1f/\\:]/g, '_').slice(0, 100) || 'Track') + '.wav'
      if (!assetPaths[hash]) {
        assetPaths[hash] = 'audio/' + hash + '.wav'; files[assetPaths[hash]] = bytes
        bundle.assets.push({ id: hash, sha256: hash, name, bytes: bytes.length, sampleRate: wave.sampleRate, channels: wave.channels, frames: wave.frames })
      }
      bundle.tracks.push({ id: track.id, name: track.name, order: index, channels: wave.channels })
      bundle.regions.push({ id: randomUUID(), assetId: hash, trackId: track.id, name, start: { samples: 0, sampleRate: wave.sampleRate }, offsetFrames: 0, lengthFrames: wave.frames })
    }
    if (!parseRegionBundle(bundle)) throw new Error('Invalid LUNA track metadata.')
    files['orb-regions.json'] = strToU8(JSON.stringify({ ...bundle, assetPaths }))
    await writeFile(join(directory, 'selection.orb-regions.zip'), zipSync(files, { level: 0 }), { mode: 0o600 })
    receipt.status = 'complete'; await journal()
    return { name: 'tracks.orb-regions.zip', tracks: selected.length }
  } catch (error) {
    receipt.status = 'failed'; receipt.error = error.message; await journal(); throw error
  } finally {
    if (created) {
      // Only our render handle, never another export or project content.
      try {
        if (!completed) {
          await call('/renders/abort', { uid: renderId })
          const state = lunaValue(await call('/renders/' + renderId), 'state')
          if (!['aborted', 'completed', 'error'].includes(state)) throw new Error('Render is still active.')
        }
        await call('/renders/delete', { uid: renderId })
      } catch {
        const error = new Error('Could not confirm LUNA render cleanup. The export lock is retained; inspect the local export journal before retrying.')
        error.cleanupUncertain = true
        throw error
      }
    }
  }
}
