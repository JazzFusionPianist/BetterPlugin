// Region sharing from a saved project file: no drag-and-drop, no host API, no satellite.
// The DAW stays untouched; only the saved project and the audio it references are read.
import { readFile, writeFile, stat, open, readdir } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { execFile } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { strFromU8 } from 'fflate'
import { projectKind, baseName, PROJECT_EXTENSIONS } from '../../core/lib/projectRegions.ts'
import { parseStudioOneSong } from '../../core/lib/projectStudioOne.ts'
import { parseAbletonSet } from '../../core/lib/projectAbleton.ts'
import { parseReaperProject } from '../../core/lib/projectReaper.ts'
import { parseDawproject } from '../../core/lib/projectDawproject.ts'
import { projectKinds } from '../../core/lib/stemRoutes.ts'
import { cropWaveRegion } from '../../core/lib/regionVstXml.ts'
import { createRegionArchive } from '../../core/lib/regionArchive.ts'
import { parseRegionBundle } from '../../core/lib/regionBundle.ts'
import { zipDirectory, readZipEntry } from './zipFile.mjs'
import { sourceAsWave } from './audioSource.mjs'
import { probeWave } from './proToolsTracks.mjs'

const LIMIT = 298 * 1024 * 1024
const PROJECT_MAX = 256 * 1024 * 1024
const hash = b => createHash('sha256').update(b).digest('hex')

// ── Discovery ────────────────────────────────────────────────────────────────
const IGNORED = /\/(History|Backup|Backups|Auto-?saves?|\.Trash)\//i
function spotlight(exts) {
  const query = exts.map(e => `kMDItemFSName == '*.${e}'c`).join(' || ')
  return new Promise(resolve => execFile('/usr/bin/mdfind', [`(${query}) && kMDItemFSContentChangeDate >= $time.today(-60)`],
    { timeout: 5000, maxBuffer: 8 * 1024 * 1024 }, (error, out) => resolve(error ? [] : out.split('\n').filter(Boolean))))
}
async function walk(root, exts, depth, out) {
  if (depth < 0 || out.length > 400) return
  let entries
  try { entries = await readdir(root, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    const p = join(root, e.name)
    if (e.isDirectory() && !e.name.startsWith('.') && !IGNORED.test(p + '/')) await walk(p, exts, depth - 1, out)
    else if (e.isFile() && exts.includes(e.name.split('.').pop().toLowerCase())) out.push(p)
  }
}
/** Recently saved projects of the formats this host can be read from, newest first. */
export async function suggestProjects({ host }) {
  const kinds = projectKinds(host)
  const exts = kinds.map(k => PROJECT_EXTENSIONS[k])
  if (!exts.length) return { projects: [] }
  let paths = await spotlight(exts)
  if (!paths.length) {
    const home = homedir()
    for (const root of [join(home, 'Documents/Studio One/Songs'), join(home, 'Music'), join(home, 'Documents')])
      await walk(root, exts, 4, paths)
  }
  const found = []
  for (const p of new Set(paths)) {
    if (IGNORED.test(p) || /-bak$|\.rpp-bak$/i.test(p)) continue
    try { const s = await stat(p); if (s.isFile()) found.push({ path: p, name: baseName(p), kind: projectKind(p), modifiedMs: s.mtimeMs }) } catch {}
  }
  found.sort((a, b) => b.modifiedMs - a.modifiedMs)
  return { projects: found.slice(0, 8) }
}

// ── Reading ──────────────────────────────────────────────────────────────────
async function loadProject(projectPath) {
  const kind = projectKind(projectPath)
  if (!kind) throw new Error('Choose a .song, .als, .rpp or .dawproject file.')
  const info = await stat(projectPath)
  if (!info.isFile()) throw new Error('The linked project file is missing. Link it again.')
  if (kind === 'dawproject') {
    const dir = await zipDirectory(projectPath)
    const xml = strFromU8(await readZipEntry(dir, 'project.xml', 64 * 1024 * 1024))
    const snapshot = parseDawproject({ projectXml: xml, projectPath, entries: [...dir.entries.keys()] })
    return { kind, info, snapshot, dir, label: baseName(projectPath), digest: hash(xml + info.size + info.mtimeMs) }
  }
  if (info.size > PROJECT_MAX) throw new Error('The project file is too large.')
  const bytes = await readFile(projectPath)
  let snapshot
  if (kind === 'studio-one') {
    const dir = await zipDirectory(projectPath)
    snapshot = parseStudioOneSong({ songXml: strFromU8(await readZipEntry(dir, 'Song/song.xml', 128 * 1024 * 1024)),
      mediaPoolXml: strFromU8(await readZipEntry(dir, 'Song/mediapool.xml', 64 * 1024 * 1024)), songPath: projectPath })
  } else if (kind === 'ableton') {
    snapshot = parseAbletonSet({ xml: gunzipSync(bytes, { maxOutputLength: 1024 * 1024 * 1024 }).toString('utf8'), setPath: projectPath })
  } else snapshot = parseReaperProject({ text: bytes.toString('utf8'), projectPath })
  return { kind, info, snapshot, dir: null, label: baseName(projectPath), digest: hash(bytes) }
}

async function headerProbe(path) {
  // Enough of the file to reach the data/SSND chunk header; samples are not read here.
  const fh = await open(path, 'r')
  try {
    const { size } = await fh.stat()
    const buf = Buffer.alloc(Math.min(size, 1024 * 1024))
    await fh.read(buf, 0, buf.length, 0)
    const tag = buf.toString('ascii', 0, 4)
    if (tag === 'RIFF') {
      let rate, channels, block
      for (let p = 12; p + 8 <= buf.length;) {
        const id = buf.toString('ascii', p, p + 4), sz = buf.readUInt32LE(p + 4), at = p + 8
        if (id === 'fmt ') { channels = buf.readUInt16LE(at + 2); rate = buf.readUInt32LE(at + 4); block = buf.readUInt16LE(at + 12) }
        if (id === 'data') return { rate, channels, frames: Math.floor(Math.min(sz, size - at) / block), size }
        p = at + sz + sz % 2
      }
    } else if (tag === 'FORM') {
      for (let p = 12; p + 8 <= buf.length;) {
        const id = buf.toString('ascii', p, p + 4), sz = buf.readUInt32BE(p + 4), at = p + 8
        if (id === 'COMM') {
          const exp = buf.readUInt16BE(at + 8) & 0x7fff, mant = buf.readUInt32BE(at + 10) * 2 ** 32 + buf.readUInt32BE(at + 14)
          return { rate: Math.round(mant * 2 ** (exp - 16383 - 63)), channels: buf.readUInt16BE(at), frames: buf.readUInt32BE(at + 2), size }
        }
        p = at + sz + sz % 2
      }
    }
    throw new Error('Only WAV and AIFF source audio can be shared from a project file yet.')
  } finally { await fh.close() }
}

async function resolveSources(loaded) {
  const { snapshot, dir } = loaded
  const probes = new Map()
  for (const r of snapshot.regions) {
    if (r.disabledReason || !r.source) continue
    try {
      let key
      if ('embedded' in r.source) {
        const e = dir?.entries.get(r.source.embedded)
        if (!e) throw new Error('Embedded audio is missing from the DAWproject.')
        key = 'zip:' + r.source.embedded
        if (!probes.has(key)) {
          const bytes = sourceAsWave(await readZipEntry(dir, r.source.embedded, LIMIT * 2))
          const w = probeWave(bytes)
          probes.set(key, { rate: w.sampleRate, channels: w.channels, frames: w.frames, size: bytes.length, embedded: r.source.embedded })
        }
      } else {
        let found
        for (const c of r.source.candidates) { try { if ((await stat(c)).isFile()) { found = c; break } } catch {} }
        if (!found) throw new Error(`Source audio not found: ${baseName(r.source.candidates[0] ?? 'audio')}`)
        key = found
        if (!probes.has(key)) probes.set(key, { ...await headerProbe(found), path: found })
      }
      const p = probes.get(key)
      if (!(p.rate > 0) || ![1, 2].includes(p.channels)) throw new Error('Only mono/stereo source audio is supported yet.')
      const offset = Math.round(r.offsetSeconds * p.rate), length = Math.round(r.lengthSeconds * p.rate)
      // Allow one frame of rounding between seconds and source frames.
      if (offset + length > p.frames + 1) throw new Error('The region extends past its source audio (looped or extended). Consolidate it before sharing.')
      r.resolved = { key, rate: p.rate, channels: p.channels, offset, length: Math.min(length, p.frames - offset) }
      if (r.resolved.length < 1) throw new Error('Empty region.')
    } catch (e) { r.disabledReason = e.message }
  }
  return probes
}

function revisionOf(loaded, probes) {
  return hash(JSON.stringify([loaded.digest, [...probes.entries()].map(([k, p]) => [k, p.size, p.frames])]))
}

/** Region list for any loaded snapshot (saved project file or a live host listing). */
export async function inspectLoadedRegions(loaded, sessionKey) {
  const probes = await resolveSources(loaded)
  const { snapshot } = loaded
  const tracks = new Map(snapshot.tracks.map(t => [t.id, t]))
  return {
    sessionId: hash(sessionKey).slice(0, 32), daw: snapshot.daw, kind: snapshot.kind, name: snapshot.name,
    project: { name: loaded.label, modifiedMs: loaded.info.mtimeMs },
    sampleRate: snapshot.sampleRate, revision: revisionOf(loaded, probes),
    tracks: snapshot.tracks.map(t => ({ id: t.id, name: t.name, order: t.order })),
    regions: snapshot.regions.map(r => ({ id: r.id, name: r.name, trackId: r.trackId, trackName: tracks.get(r.trackId)?.name ?? '',
      start: r.startSeconds, length: r.lengthSeconds, notes: r.notes, disabledReason: r.disabledReason })),
  }
}

export async function inspectProjectRegions({ projectPath }) {
  return inspectLoadedRegions(await loadProject(projectPath), projectPath)
}

export async function captureProjectRegions({ projectPath, options, directory }) {
  return captureLoadedRegions({ load: () => loadProject(projectPath), sessionKey: projectPath, options, directory })
}

/** Shared capture: crop each referenced source once, keep every region's own position. */
export async function captureLoadedRegions({ load, sessionKey, options, directory }) {
  if (!Array.isArray(options?.regionIds) || !options.regionIds.length || options.regionIds.length > 512
    || new Set(options.regionIds).size !== options.regionIds.length) throw new Error('Choose 1–512 distinct audio regions.')
  const loaded = await load()
  const probes = await resolveSources(loaded)
  if (revisionOf(loaded, probes) !== options.revision) throw new Error('The project was saved again or its audio changed. Refresh regions.')
  const { snapshot } = loaded
  const selected = options.regionIds.map(id => snapshot.regions.find(r => r.id === id))
  if (selected.some(r => !r || r.disabledReason || !r.resolved)) throw new Error('A selected region is unavailable. Refresh regions.')

  // One asset per source: the union span of the selected regions that use it.
  const bySource = new Map()
  for (const r of selected) { const list = bySource.get(r.resolved.key) ?? []; list.push(r); bySource.set(r.resolved.key, list) }
  const assets = [], filesByAsset = new Map(), regions = []
  let total = 0
  for (const [key, list] of bySource) {
    const probe = probes.get(key)
    const raw = probe.embedded ? await readZipEntry(loaded.dir, probe.embedded, LIMIT * 2) : await readFile(probe.path)
    const wave = sourceAsWave(raw), w = probeWave(wave)
    if (w.sampleRate !== probe.rate || w.channels !== probe.channels || Math.abs(w.frames - probe.frames) > 1)
      throw new Error('Source audio changed while sharing. Refresh regions.')
    const spanStart = Math.min(...list.map(r => r.resolved.offset))
    const spanEnd = Math.min(w.frames, Math.max(...list.map(r => r.resolved.offset + r.resolved.length)))
    const name = baseName(probe.path ?? probe.embedded).replace(/\.(aiff?|aifc|wave?)$/i, '') + '.wav'
    const file = await cropWaveRegion(new File([wave], name), { name, offsetFrames: spanStart, lengthFrames: spanEnd - spanStart })
    const bytes = Buffer.from(await file.arrayBuffer())
    total += bytes.length
    if (total > LIMIT) throw new Error('Selected regions exceed 300 MB. Share fewer regions at a time.')
    const sha = hash(bytes)
    if (!assets.some(a => a.id === sha)) {
      assets.push({ id: sha, sha256: sha, name: file.name, bytes: bytes.length, sampleRate: w.sampleRate, channels: w.channels, frames: spanEnd - spanStart })
      filesByAsset.set(sha, file)
    }
    for (const r of list) {
      const startRate = snapshot.sampleRate ?? w.sampleRate
      regions.push({ id: r.id, assetId: sha, trackId: r.trackId, name: r.name,
        start: { samples: Math.round(r.startSeconds * startRate), sampleRate: startRate },
        offsetFrames: r.resolved.offset - spanStart, lengthFrames: Math.min(r.resolved.length, spanEnd - r.resolved.offset) })
    }
  }
  const usedTracks = snapshot.tracks.filter(t => regions.some(r => r.trackId === t.id))
  const channelsOf = id => Math.max(...regions.filter(r => r.trackId === id).map(r => assets.find(a => a.id === r.assetId).channels))
  const order = new Map(selected.map((r, i) => [r.id, i]))
  regions.sort((a, b) => order.get(a.id) - order.get(b.id))
  const bundle = { format: 'orb-region-bundle', version: 1, id: randomUUID(), timebase: 'song-samples',
    source: { daw: snapshot.daw, projectId: hash(sessionKey).slice(0, 64), captureId: randomUUID() },
    tracks: usedTracks.map((t, i) => ({ id: t.id, name: t.name, order: i, channels: channelsOf(t.id) })),
    regions, assets }
  if (!parseRegionBundle(bundle)) throw new Error('The project produced an invalid region layout.')
  // Re-read the project: a save during capture must not mix two arrangements.
  const after = await load()
  if (after.digest !== loaded.digest) throw new Error('The project changed during sharing. Nothing was attached.')
  const archive = await createRegionArchive({ bundle, filesByAsset })
  await writeFile(join(directory, 'selection.orb-regions.zip'), new Uint8Array(await archive.arrayBuffer()), { mode: 0o600 })
  return { regions: regions.length, assets: assets.length, notes: [...new Set(selected.flatMap(r => r.notes))] }
}
