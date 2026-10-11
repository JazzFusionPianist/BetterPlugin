// REAPER adapter: talks to "Slur REAPER Bridge.lua" (a startup ReaScript) through
// private files. Tracks render offline inside REAPER; item layouts are read live,
// so the project does not need saving. No satellite plug-ins, no UI automation.
import { readFile, writeFile, rename, unlink, mkdir, stat, readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { finishSnapshot, baseName } from '../../core/lib/projectRegions.ts'
import { parseRegionBundle } from '../../core/lib/regionBundle.ts'
import { createRegionArchive } from '../../core/lib/regionArchive.ts'
import { probeWave } from './proToolsTracks.mjs'
import { inspectLoadedRegions, captureLoadedRegions } from './projectRegions.mjs'

const LIMIT = 298 * 1024 * 1024
const hash = b => createHash('sha256').update(b).digest('hex')
export const reaperRoot = () => process.env.SLUR_REAPER_ROOT || join(homedir(), 'Library', 'Application Support', 'Slur', 'HostControl', 'reaper')
const NOT_RUNNING = 'The Slur REAPER bridge is not running. Reinstall Slur, then restart REAPER (it starts with REAPER).'

export async function reaperConnected(now = Date.now()) {
  try {
    const s = JSON.parse(await readFile(join(reaperRoot(), 'status.json'), 'utf8'))
    return s.version === 1 && now - s.heartbeatMs < 5000
  } catch { return false }
}

export async function reaperCall(command, payload = {}, timeoutMs = 15000) {
  if (!await reaperConnected()) throw new Error(NOT_RUNNING)
  const dir = reaperRoot(), id = randomUUID()
  await mkdir(dir, { recursive: true, mode: 0o700 })
  const tmp = join(dir, `.request-${id}.tmp`), response = join(dir, `response-${id}.json`)
  await writeFile(tmp, JSON.stringify({ ...payload, command }), { mode: 0o600 })
  await rename(tmp, join(dir, `request-${id}.json`))
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const body = JSON.parse(await readFile(response, 'utf8'))
      await unlink(response).catch(() => {})
      if (body.ok !== true) throw Object.assign(new Error(body.error || 'REAPER reported an error.'), { fromHost: true })
      return body
    } catch (e) { if (e.fromHost) throw e }
    await new Promise(r => setTimeout(r, 40))
  }
  await unlink(join(dir, `request-${id}.json`)).catch(() => {})
  throw new Error(command === 'render' ? 'REAPER did not finish rendering. Check REAPER, then retry.' : NOT_RUNNING)
}

// ── Track bounce ─────────────────────────────────────────────────────────────
function trackSnapshot(body) {
  const p = body.project, rate = p.sampleRate
  if (!Number.isSafeInteger(rate) || rate < 8000 || rate > 768000) throw new Error('Unsupported REAPER sample rate.')
  const end = Math.round(p.length * rate)
  return {
    daw: 'REAPER', sessionId: hash(p.path || p.name).slice(0, 32), name: p.name || 'Unsaved project', sampleRate: rate,
    revision: String(p.revision),
    tracks: body.tracks.map(t => ({ id: t.id, name: t.name || `Track ${t.index + 1}`, type: t.folder ? 'Folder' : 'Audio',
      selected: t.selected === true, disabledReason: null })),
    ranges: {
      entire: end > 0 ? { start: 0, end } : null,
      selection: p.selection ? { start: Math.round(p.selection[0] * rate), end: Math.round(p.selection[1] * rate) } : null,
    },
    entireError: end > 0 ? '' : 'The REAPER project is empty.',
    rangeNote: 'Uses REAPER’s time selection.',
  }
}

export async function inspectReaperTracks() { return trackSnapshot(await reaperCall('tracks')) }
export async function inspectReaperTrackRange() {
  const s = trackSnapshot(await reaperCall('tracks'))
  return { sessionId: s.sessionId, sampleRate: s.sampleRate, selection: s.ranges.selection }
}

export async function exportReaperTracks({ sessionId, options, directory }) {
  if (!Array.isArray(options?.trackIds) || !options.trackIds.length || options.trackIds.length > 128
    || new Set(options.trackIds).size !== options.trackIds.length || !['entire', 'selection'].includes(options.range))
    throw new Error('Choose 1–128 tracks and a range.')
  const snap = trackSnapshot(await reaperCall('tracks'))
  if (snap.sessionId !== sessionId || snap.sampleRate !== options.sampleRate) throw new Error('The REAPER project changed. Refresh the track list.')
  const range = snap.ranges[options.range]
  if (!range || range.start !== options.start || range.end !== options.end) throw new Error('The range changed. Refresh the track list.')
  const chosen = options.trackIds.map(id => snap.tracks.find(t => t.id === id))
  if (chosen.some(t => !t)) throw new Error('A selected track no longer exists. Refresh the track list.')
  const out = join(directory, 'render')
  await mkdir(out, { recursive: true, mode: 0o700 })
  const rate = snap.sampleRate
  const body = await reaperCall('render', { trackIds: options.trackIds, start: range.start / rate, finish: range.end / rate, dir: out }, 1_800_000)
  const frames = range.end - range.start
  const assets = [], filesByAsset = new Map(), regions = [], tracks = []
  let total = 0
  for (const [i, t] of chosen.entries()) {
    const file = body.files?.find(f => f.trackId === t.id)
    if (!file || !file.path?.startsWith(out + '/')) throw new Error(`REAPER did not render "${t.name}".`)
    const bytes = await readFile(file.path)
    const w = probeWave(bytes)
    // REAPER may round the custom range to whole samples differently by one frame.
    if (w.sampleRate !== rate || Math.abs(w.frames - frames) > 1) throw new Error(`"${t.name}" rendered with an unexpected length or rate.`)
    total += bytes.length
    if (total > LIMIT) throw new Error('Rendered stems exceed 300 MB. Choose fewer tracks or a shorter range.')
    const sha = hash(bytes), name = `${t.name.replace(/[/\\:]/g, '_')}.wav`
    if (!assets.some(a => a.id === sha)) {
      assets.push({ id: sha, sha256: sha, name, bytes: bytes.length, sampleRate: rate, channels: w.channels, frames: w.frames })
      filesByAsset.set(sha, new File([bytes], name, { type: 'audio/wav' }))
    }
    tracks.push({ id: t.id, name: t.name, order: i, channels: w.channels })
    regions.push({ id: `${t.id}:${range.start}`, assetId: sha, trackId: t.id, name: t.name,
      start: { samples: range.start, sampleRate: rate }, offsetFrames: 0, lengthFrames: w.frames })
  }
  const bundle = { format: 'orb-region-bundle', version: 1, id: randomUUID(), timebase: 'song-samples',
    source: { daw: 'REAPER', projectId: sessionId, captureId: randomUUID() }, tracks, regions, assets }
  if (!parseRegionBundle(bundle)) throw new Error('Invalid stem layout.')
  const archive = await createRegionArchive({ bundle, filesByAsset })
  await writeFile(join(directory, 'selection.orb-regions.zip'), new Uint8Array(await archive.arrayBuffer()), { mode: 0o600 })
  // Rendered intermediates stay private to this job folder.
  for (const f of await readdir(out)) await unlink(join(out, f)).catch(() => {})
  return { tracks: tracks.length }
}

// ── Regions (live layout, no save needed) ────────────────────────────────────
/** Pure: bridge item listing → ProjectSnapshot. Exported for tests. */
export function reaperItemsSnapshot(body) {
  const p = body.project
  const tracks = body.tracks.map((t, order) => ({ id: t.id, name: t.name || `Track ${t.index + 1}`, order, channels: null }))
  const regions = body.items.map(it => {
    const r = { id: it.id, trackId: it.trackId, name: it.name || baseName(it.file || '') || 'Item', source: null,
      startSeconds: it.position, offsetSeconds: it.offset ?? 0, lengthSeconds: it.length, notes: [], disabledReason: null }
    try {
      if (it.midi) throw new Error('MIDI items are not audio.')
      if (it.mute) throw new Error('Muted item.')
      if (it.reversed || it.sourceType === 'SECTION') throw new Error('Reversed or section sources need rendering before sharing.')
      if (it.playrate !== 1) throw new Error('Rate-changed items need rendering before sharing.')
      if (it.pitch !== 0) throw new Error('Pitch-shifted items need rendering before sharing.')
      if (!['WAVE'].includes(it.sourceType)) throw new Error(`${it.sourceType || 'Unknown'} sources are not supported yet.`)
      if (!it.file) throw new Error('The item has no source file.')
      r.source = { candidates: [it.file] }
      const notes = new Set()
      if (Math.abs(it.volume - 1) > 1e-6 || Math.abs((it.takeVolume ?? 1) - 1) > 1e-6) notes.add('gain')
      if (it.fadeIn > 0.0105 || it.fadeOut > 0.0105) notes.add('fade')
      if (it.envelopes > 0) notes.add('envelope')
      r.notes = [...notes]
    } catch (e) { r.disabledReason = e.message }
    return r
  })
  return finishSnapshot({ daw: 'REAPER', kind: 'reaper', name: p.name || 'Unsaved project', sampleRate: p.sampleRate, tracks, regions })
}

async function loadLive() {
  const body = await reaperCall('items', {}, 30000)
  const snapshot = reaperItemsSnapshot(body)
  return { kind: 'reaper', snapshot, dir: null, label: snapshot.name, info: { mtimeMs: Date.now() },
    digest: hash(JSON.stringify([body.project.path, body.project.revision])) }
}

export async function inspectReaperRegions() {
  const loaded = await loadLive()
  return inspectLoadedRegions(loaded, 'reaper')
}
export async function exportReaperRegions({ options, directory }) {
  return captureLoadedRegions({ load: loadLive, sessionKey: 'reaper', options, directory })
}

export const reaperBridgeInstalled = async () => {
  try { return (await stat(join(homedir(), 'Library/Application Support/REAPER/Scripts/Slur/Slur REAPER Bridge.lua'))).isFile() } catch { return false }
}
