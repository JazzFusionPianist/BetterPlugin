import { readFile, writeFile, stat, realpath, mkdir } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { lunaRequest, lunaValue } from './lunaTracks.mjs'
import { probeWave } from './proToolsTracks.mjs'
import { prepareRegionBundle, planRegionImport, rescaleSamples } from '../../core/lib/regionBundle.ts'
import { cropVstWave } from '../../core/lib/regionVstXml.ts'
import { createRegionArchive, prepareArchivedRegionBundle } from '../../core/lib/regionArchive.ts'

const LIMIT = 298 * 1024 * 1024
const uid = s => typeof s === 'string' && /^[a-f0-9]{32}$/.test(s) && !/^0+$/.test(s)
const hash = b => createHash('sha256').update(b).digest('hex')
const integer = n => Number.isSafeInteger(n) && n >= 0
export function lunaNanoseconds(frames, rate) {
  if (!integer(frames) || !Number.isSafeInteger(rate) || rate < 1 || rate > 768000) throw new Error('Invalid region time.')
  const n = Number((BigInt(frames) * 1000000000n + BigInt(Math.floor(rate / 2))) / BigInt(rate))
  if (!integer(n)) throw new Error('Region position exceeds LUNA precision.')
  return n
}
function framesAt(ns, rate) {
  const f = Math.round(ns * rate / 1e9)
  if (!integer(ns) || !integer(f) || Math.abs(lunaNanoseconds(f, rate) - ns) > 1)
    throw new Error('Source trim is not on the audio sample grid.')
  return f
}
function cropEvidence(name, offsetFrames, lengthFrames) {
  return { format: 'vst-xml', version: 1, captureId: 'luna-native', sourceApp: 'LUNA',
    channelId: null, name, offsetFrames, lengthFrames, positionSeconds: null }
}
async function session(call, expected) {
  const id = lunaValue(await call('/sessions'), 'focused_session')
  if (!uid(id) || (expected && id !== expected)) throw new Error('LUNA session changed. Refresh regions.')
  const s = await call('/sessions/' + id), p = s.data?.properties
  if (p?.loaded?.value !== true || p?.playing?.value !== false || p?.record_enabled?.value !== false)
    throw new Error('Open a LUNA session and stop playback/recording first.')
  const rate = (await call('/sample_rate')).data?.value
  if (!Number.isSafeInteger(rate) || rate < 1 || rate > 768000 || !uid(p.session_package_uid?.value))
    throw new Error('Unsupported LUNA session metadata.')
  return { id, rate, packageId: p.session_package_uid.value, path: p.session_package_path?.value,
    name: p.name?.value, revision: p.change_count?.value }
}
export function readLunaClip(info, clipId, track) {
  const c = info?.compiled_clips?.[0], source = c?.source_info
  if (!uid(clipId) || info?.track_uid !== track.id || info.clip_type !== 'audio'
    || info.compiled_clips?.length !== 1 || c.clip_uid !== clipId || !source
    || c.compiled_start !== c.full_start || c.compiled_stop !== c.full_stop
    || info.start !== c.full_start || info.stop !== c.full_stop)
    throw new Error('Layered, partial or non-audio regions are not supported yet.')
  // LUNA asynchronously builds an SRC playback cache for a different-rate file.
  // Preserve the original PCM, not that derived cache. Other rendering is rejected.
  const srcCache = source.sample_rate !== info.sample_rate && c.render_source_info?.sample_rate === info.sample_rate
    && c.render_source_info?.stem_format === source.stem_format
    && c.render_source_info?.length_samples === rescaleSamples(source.length_samples, source.sample_rate, info.sample_rate)
    && c.flattened_warps?.every(w => w.tce_ratio === undefined || w.tce_ratio === 1)
  if (c.has_tce !== false || !(c.has_rendering === false || (c.has_rendering === true && srcCache)) || c.has_fade_in !== false || c.has_fade_out !== false
    || c.ara_is_modified !== false || c.looping !== false || c.mute !== false || c.gain !== 0 || c.pitch !== 1)
    throw new Error('Render fades, gain, stretch, loops or ARA edits before sharing this region.')
  const channels = source.stem_format === 'mono' ? 1 : source.stem_format === 'stereo' ? 2 : 0
  if (!channels || channels !== track.channels || source.format !== 'wav'
    || !integer(source.length_samples) || !integer(source.size) || source.size > LIMIT
    || !integer(c.full_start_sample) || !integer(c.full_length_samples) || c.full_length_samples < 1
    || typeof source.path !== 'string' || typeof info.name !== 'string' || !info.name.length || info.name.length > 512)
    throw new Error('Unsupported region audio or position.')
  const offset = framesAt(c.source_start, source.sample_rate), end = framesAt(c.source_stop, source.sample_rate)
  if (end <= offset || end > source.length_samples
    || rescaleSamples(end - offset, source.sample_rate, info.sample_rate) !== c.full_length_samples)
    throw new Error('Region length differs from its source audio.')
  return { id: clipId, name: info.name, trackId: track.id, trackName: track.name, channels,
    start: c.full_start_sample, sampleRate: info.sample_rate, offsetFrames: offset, lengthFrames: end - offset,
    sourceRate: source.sample_rate, sourceFrames: source.length_samples, path: source.path, bytes: source.size }
}
async function scan(call) {
  const s = await session(call), root = '/sessions/' + s.id
  const children = (await call(root + '/tracks')).data?.children
  if (!Array.isArray(children) || children.length > 512) throw new Error('Unsupported LUNA track count.')
  const regions = [], tracks = []
  for (const child of children) {
    if (!uid(child.path)) throw new Error('Invalid track ID.')
    const t = await call(root + '/tracks/' + child.path)
    if (lunaValue(t, 'track_type') !== 'audio') continue
    const playlist = lunaValue(t, 'playlist_uid'), format = lunaValue(t, 'stem_format')
    if (!uid(playlist)) throw new Error('Invalid playlist ID.')
    const track = { id: child.path, name: lunaValue(t, 'name'), order: lunaValue(t, 'order'), channels: format === 'mono' ? 1 : format === 'stereo' ? 2 : 0 }
    tracks.push(track)
    const clips = (await call(root + '/playlists/' + playlist + '/clips')).data?.children
    if (!Array.isArray(clips) || regions.length + clips.length > 512) throw new Error('Choose a session with at most 512 audio regions.')
    for (const clip of clips) {
      if (!uid(clip.path)) throw new Error('Invalid region ID.')
      const info = (await call(root + '/get_clip_info', { session_uid: s.id, clip_uid: clip.path })).data
      const effects = (await call(root + '/playlists/' + playlist + '/clips/' + clip.path + '/effects')).data?.children
      try {
        if (Array.isArray(effects) && effects.length) throw new Error('Clip effects require rendering before sharing.')
        regions.push({ ...readLunaClip(info, clip.path, track), disabledReason: null })
      }
      catch (e) { regions.push({ id: clip.path, name: info?.name || 'Unsupported region', trackId: track.id, trackName: track.name, disabledReason: e.message }) }
    }
  }
  const after = await session(call, s.id)
  if (after.revision !== s.revision || after.rate !== s.rate) throw new Error('LUNA was edited during inspection. Refresh regions.')
  return { ...s, tracks, regions, fingerprint: hash(JSON.stringify({ s, tracks, regions })) }
}
export async function inspectLunaRegions(call = lunaRequest) {
  const s = await scan(call)
  return { sessionId: s.id, name: s.name, sampleRate: s.rate, revision: s.fingerprint,
    regions: s.regions.map(({ path, bytes, ...r }) => r) }
}
export async function captureLunaRegions({ call = lunaRequest, sessionId, options, directory }) {
  if (!Array.isArray(options?.regionIds) || !options.regionIds.length || options.regionIds.length > 512
    || new Set(options.regionIds).size !== options.regionIds.length) throw new Error('Choose distinct audio regions.')
  const s = await scan(call)
  if (s.id !== sessionId || s.fingerprint !== options.revision) throw new Error('LUNA regions changed. Refresh before sharing.')
  const selected = options.regionIds.map(id => s.regions.find(r => r.id === id))
  if (selected.some(r => !r || r.disabledReason)) throw new Error('A selected region is unavailable.')
  const root = await realpath(s.path), files = []
  let total = 0
  for (const r of selected) {
    const path = await realpath(r.path), st = await stat(path)
    if (!path.startsWith(root + sep) || !st.isFile() || st.size !== r.bytes || st.size > LIMIT)
      throw new Error('Region source is outside its session or has changed.')
    const bytes = await readFile(path), wave = probeWave(bytes)
    if (wave.sampleRate !== r.sourceRate || wave.frames !== r.sourceFrames || wave.channels !== r.channels)
      throw new Error('LUNA source metadata differs from its audio.')
    const file = await cropVstWave(new File([bytes], 'source.wav'), cropEvidence(r.name, r.offsetFrames, r.lengthFrames))
    total += file.size
    if (total > LIMIT) throw new Error('Selected regions exceed 300 MB.')
    files.push(file)
  }
  const p = await prepareRegionBundle(files, async f => { const w = probeWave(Buffer.from(await f.arrayBuffer())); return { sampleRate: w.sampleRate, channels: w.channels, frames: w.frames } })
  p.bundle.source = { daw: 'LUNA', projectId: s.id, captureId: randomUUID() }
  p.bundle.tracks = s.tracks.filter(t => selected.some(r => r.trackId === t.id)).sort((a, b) => a.order - b.order)
  p.bundle.regions.forEach((r, i) => Object.assign(r, { id: selected[i].id, name: selected[i].name, trackId: selected[i].trackId,
    start: { samples: selected[i].start, sampleRate: selected[i].sampleRate }, offsetFrames: 0, lengthFrames: selected[i].lengthFrames }))
  const after = await scan(call)
  if (after.fingerprint !== s.fingerprint) throw new Error('LUNA changed during capture. Nothing was attached.')
  const archive = await createRegionArchive(p)
  await writeFile(join(directory, 'selection.orb-regions.zip'), new Uint8Array(await archive.arrayBuffer()), { mode: 0o600 })
  return { regions: selected.length }
}
export async function inspectLunaDestination(call = lunaRequest) {
  const s = await session(call)
  return { sessionId: s.id, name: s.name, sampleRate: s.rate }
}
export async function importLunaRegions({ call = lunaRequest, sessionId, archive, directory }) {
  const s = await session(call, sessionId), root = '/sessions/' + s.id
  if (!(archive instanceof Uint8Array) || archive.length > LIMIT) throw new Error('Region archive exceeds 300 MB.')
  const p = await prepareArchivedRegionBundle(new File([archive], 'regions.slur-regions.zip'))
  const plan = planRegionImport(p.bundle, s.rate)
  // Validate all data before the first host mutation.
  for (const a of p.bundle.assets) {
    const wave = probeWave(Buffer.from(await p.filesByAsset.get(a.id).arrayBuffer()))
    if (wave.sampleRate !== a.sampleRate || wave.channels !== a.channels || wave.frames !== a.frames)
      throw new Error('Received WAV metadata mismatch.')
  }
  const ready = []
  await mkdir(directory, { recursive: true, mode: 0o700 })
  for (const t of plan) {
    let end = -1
    if (![1, 2].includes(t.channels)) throw new Error('Only mono/stereo tracks can be restored.')
    for (const r of [...t.regions].sort((a, b) => a.startSamples - b.startSamples)) {
      if (r.startSamples < end || r.startSamples < 0) throw new Error('Overlapping or negative regions require a layering adapter.')
      end = r.startSamples + rescaleSamples(r.sourceLengthFrames, r.sourceSampleRate, s.rate)
      const asset = p.bundle.assets.find(a => a.id === r.assetId)
      if (asset.channels !== t.channels) throw new Error('Track channel mapping mismatch.')
      const cropped = await cropVstWave(p.filesByAsset.get(r.assetId), cropEvidence(r.name, r.sourceOffsetFrames, r.sourceLengthFrames))
      const bytes = Buffer.from(await cropped.arrayBuffer()), digest = hash(bytes), path = join(directory, digest + '.wav')
      await writeFile(path, bytes, { mode: 0o600 })
      ready.push({ track: t, region: r, path, hash: digest, location: lunaNanoseconds(r.startSamples, s.rate),
        duration: lunaNanoseconds(r.sourceLengthFrames, r.sourceSampleRate) })
    }
  }
  const receipt = { sessionId: s.id, bundleId: p.bundle.id, status: 'started', tracks: [], regions: [] }
  const journal = () => writeFile(join(directory, 'region-import.json'), JSON.stringify(receipt), { mode: 0o600 })
  await journal()
  const trackIds = new Map(), sources = new Map()
  try {
    for (const item of ready) {
      const current = await session(call, s.id)
      if (current.rate !== s.rate) throw new Error('Destination sample rate changed.')
      if (!sources.has(item.hash)) {
        const data = (await call('/workspace/import_file', { session_package_uid: s.packageId,
          phase: 'local_copy', type: 'audio', path: item.path })).data
        if (!uid(data?.uid)) throw new Error('LUNA did not confirm the copied audio.')
        sources.set(item.hash, data.uid)
      }
      if (!trackIds.has(item.track.sourceTrackId)) {
        const trackId = randomUUID().replaceAll('-', '')
        receipt.tracks.push(trackId); await journal()
        const data = (await call(root + '/new_track', { uid: s.id, track_uid: trackId, name: item.track.name,
          track_type: 'audio', stem_format: item.track.channels === 1 ? 'mono' : 'stereo', follows: 'time', select_tracks: false,
          create_preamp_controls: false })).data
        if (data?.uid !== trackId) throw new Error('Could not identify the new LUNA track.')
        trackIds.set(item.track.sourceTrackId, trackId)
      }
      await session(call, s.id)
      const trackId = trackIds.get(item.track.sourceTrackId)
      const result = (await call(root + '/insert_clip', { session_uid: s.id, track_uid: trackId,
        source_uid: sources.get(item.hash), name: item.region.name, location: item.location, duration: item.duration,
        source_start: 0, source_stop: item.duration, length_follows: 'time', use_provided_tempo: false })).data
      if (!uid(result?.uid)) throw new Error('LUNA did not confirm the new region.')
      receipt.regions.push(result.uid); await journal()
      const info = (await call(root + '/get_clip_info', { session_uid: s.id, clip_uid: result.uid })).data
      const clip = readLunaClip(info, result.uid, { id: trackId, name: item.track.name, channels: item.track.channels })
      if (clip.start !== item.region.startSamples || clip.sampleRate !== s.rate || clip.offsetFrames !== 0
        || clip.lengthFrames !== item.region.sourceLengthFrames || clip.sourceRate !== item.region.sourceSampleRate)
        throw new Error('LUNA placement readback differs from the received region.')
      const actual = await realpath(clip.path), sessionRoot = await realpath(s.path)
      if (!actual.startsWith(sessionRoot + sep) || hash(await readFile(actual)) !== item.hash)
        throw new Error('LUNA did not preserve the copied audio.')
    }
    await session(call, s.id)
    receipt.status = 'complete'; await journal()
    return { importedRegions: receipt.regions.length, importedTracks: receipt.tracks.length }
  } catch (e) {
    receipt.status = 'incomplete'; receipt.error = e.message; await journal()
    const error = new Error('LUNA import stopped: ' + e.message + ' Some new items may remain; inspect the local journal before retrying.')
    error.cleanupUncertain = true
    throw error
  }
}
