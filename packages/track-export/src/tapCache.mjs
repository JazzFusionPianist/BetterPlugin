// Reader for the Slur Tap capture cache (format: ../TAP-CACHE.md).
// Stems and regions are assembled only from audio a Tap actually captured.
import { readFile, readdir, open, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { canonicalHost } from '../../core/lib/stemRoutes.ts'
import { parseRegionBundle } from '../../core/lib/regionBundle.ts'
import { createRegionArchive } from '../../core/lib/regionArchive.ts'
import { floatWave } from './audioSource.mjs'

const LIMIT = 298 * 1024 * 1024
const STALE_MS = 15000
const PAGE = 65536
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const tapRoot = () => process.env.SLUR_TAP_ROOT || join(homedir(), 'Library', 'Application Support', 'Slur', 'Tap')
const hash = b => createHash('sha256').update(b).digest('hex')

function validSpans(spans) {
  if (!Array.isArray(spans) || spans.length > 1_000_000) return null
  let last = 0
  for (const s of spans) {
    if (!Array.isArray(s) || s.length !== 3 || !s.every(Number.isSafeInteger) || s[0] < last || s[1] <= s[0]) return null
    last = s[1]
  }
  return spans
}

/** Live taps in this host, oldest registry order. `now` is injectable for tests. */
export async function listTaps({ host, hostKey, now = Date.now() }) {
  let names = []
  try { names = await readdir(join(tapRoot(), 'taps')) } catch { return [] }
  const taps = []
  for (const name of names.filter(n => n.endsWith('.json'))) {
    let reg
    try { reg = JSON.parse(await readFile(join(tapRoot(), 'taps', name), 'utf8')) } catch { continue }
    if (reg?.version !== 1 || !ID.test(reg.tapId) || !ID.test(reg.generation) || name !== reg.tapId + '.json') continue
    if (!(now - reg.heartbeatMs <= STALE_MS)) continue
    // Same DAW process, or the same DAW when the plug-in runs in a separate hosting process.
    if (reg.hostKey !== hostKey && canonicalHost(reg.host ?? '') !== canonicalHost(host ?? '')) continue
    if (![1, 2].includes(reg.channels) || !(reg.sampleRate >= 8000 && reg.sampleRate <= 768000)) continue
    const dir = join(tapRoot(), 'cache', reg.tapId, reg.generation)
    let coverage
    try { coverage = JSON.parse(await readFile(join(dir, 'coverage.json'), 'utf8')) } catch { coverage = null }
    const spans = coverage && coverage.sampleRate === reg.sampleRate && coverage.channels === reg.channels
      && coverage.pageFrames === PAGE ? validSpans(coverage.spans) : null
    taps.push({ id: reg.tapId, generation: reg.generation, dir, name: typeof reg.track === 'string' ? reg.track.slice(0, 200) : '',
      colour: reg.colour ?? null, sampleRate: reg.sampleRate, channels: reg.channels, spans: spans ?? [],
      cacheFull: reg.cacheFull === true, dropped: Number.isSafeInteger(reg.dropped) ? reg.dropped : 0 })
  }
  // Unnamed taps get stable, distinct labels.
  taps.sort((a, b) => a.id.localeCompare(b.id))
  let unnamed = 0
  for (const t of taps) if (!t.name) t.name = `Slur Tap ${++unnamed}`
  return taps
}

/** Uncovered parts of [start, end) for one tap, and the oldest capture time inside it. */
export function coverageOf(spans, start, end) {
  const gaps = []
  let cursor = start, oldest = Infinity
  for (const [s, e, t] of spans) {
    if (e <= cursor) continue
    if (s >= end) break
    if (s > cursor) gaps.push([cursor, s])
    oldest = Math.min(oldest, t)
    cursor = Math.max(cursor, e)
    if (cursor >= end) break
  }
  if (cursor < end) gaps.push([cursor, end])
  return { gaps, oldestMs: Number.isFinite(oldest) ? oldest : null }
}

async function readRange(tap, start, end) {
  const ch = tap.channels, out = new Float32Array((end - start) * ch)
  for (let s = start; s < end;) {
    const page = Math.floor(s / PAGE), within = s % PAGE, n = Math.min(end - s, PAGE - within)
    const fh = await open(join(tap.dir, `page-${page}.f32`), 'r')
    try {
      const bytes = n * ch * 4
      const buf = Buffer.alloc(bytes)
      const { bytesRead } = await fh.read(buf, 0, bytes, within * ch * 4)
      if (bytesRead !== bytes) throw new Error(`Slur Tap capture for "${tap.name}" is incomplete. Play or bounce that range again.`)
      out.set(new Float32Array(buf.buffer, buf.byteOffset, n * ch), (s - start) * ch)
    } finally { await fh.close() }
    s += n
  }
  return out
}

const clock = (frames, rate) => { const t = frames / rate; return `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}` }

function snapshotOf(taps, host) {
  const rate = taps.length ? taps[0].sampleRate : null
  let first = Infinity, last = -Infinity
  for (const t of taps) if (t.sampleRate === rate && t.spans.length) { first = Math.min(first, t.spans[0][0]); last = Math.max(last, t.spans.at(-1)[1]) }
  const entire = Number.isFinite(first) ? { start: first, end: last } : null
  const revision = hash(JSON.stringify(taps.map(t => [t.id, t.generation, t.spans])))
  return {
    daw: 'Slur Tap', sessionId: hash(host + '|' + taps.map(t => t.id).join(',')).slice(0, 32), name: `${host} · Slur Tap`, sampleRate: rate, revision,
    tracks: taps.map(t => ({ id: t.id, name: t.name, type: t.channels === 1 ? 'Mono' : 'Stereo', selected: false, colour: t.colour,
      spans: t.spans.map(([s, e, at]) => [s, e, at]),
      disabledReason: t.sampleRate !== rate ? 'Different sample rate than the other taps.'
        : !t.spans.length ? 'Nothing captured yet. Play or bounce the song once.' : null })),
    ranges: { entire, selection: null },
    entireError: entire ? '' : 'No Slur Tap has captured audio yet. Play the song (or bounce it offline) once.',
  }
}

export async function inspectTapTracks({ host, hostKey }) {
  return snapshotOf(await listTaps({ host, hostKey }), host)
}

async function selectedTaps({ host, hostKey }, options) {
  if (!Array.isArray(options?.trackIds) || !options.trackIds.length || options.trackIds.length > 128
    || new Set(options.trackIds).size !== options.trackIds.length) throw new Error('Choose 1–128 tracks.')
  const taps = await listTaps({ host, hostKey })
  const chosen = options.trackIds.map(id => taps.find(t => t.id === id))
  if (chosen.some(t => !t)) throw new Error('A selected Slur Tap was removed or its plug-in window closed the project. Refresh.')
  const rate = chosen[0].sampleRate
  if (chosen.some(t => t.sampleRate !== rate)) throw new Error('Selected taps captured at different sample rates.')
  return { taps, chosen, rate }
}

/** Equal-length stems for [start, end); refuses when any selected track was not captured there. */
export async function exportTapTracks({ host, hostKey, options, directory }) {
  const { chosen, rate } = await selectedTaps({ host, hostKey }, options)
  const { start, end } = options
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start) throw new Error('Choose a non-empty range.')
  if (rate !== options.sampleRate) throw new Error('The capture sample rate changed. Refresh the track list.')
  const missing = []
  for (const t of chosen) {
    const { gaps } = coverageOf(t.spans, start, end)
    if (gaps.length) missing.push(`${t.name} (${gaps.slice(0, 3).map(([a, b]) => `${clock(a, rate)}–${clock(b, rate)}`).join(', ')}${gaps.length > 3 ? ', …' : ''})`)
  }
  if (missing.length) throw new Error(`Not captured yet: ${missing.join('; ')}. Play or bounce that range once with Slur Tap on those tracks.`)
  const bytesPer = (end - start) * 4
  if (chosen.reduce((sum, t) => sum + bytesPer * t.channels, 0) > LIMIT) throw new Error('Selected stems exceed 300 MB. Choose fewer tracks or a shorter range.')
  const assets = [], filesByAsset = new Map(), regions = [], tracks = []
  for (const [i, t] of chosen.entries()) {
    const pcm = await readRange(t, start, end)
    const bytes = floatWave(t.channels, rate, pcm)
    const sha = hash(bytes)
    const name = `${t.name.replace(/[/\\:]/g, '_')}.wav`
    if (!assets.some(a => a.id === sha)) {
      assets.push({ id: sha, sha256: sha, name, bytes: bytes.length, sampleRate: rate, channels: t.channels, frames: end - start })
      filesByAsset.set(sha, new File([bytes], name, { type: 'audio/wav' }))
    }
    tracks.push({ id: t.id, name: t.name, order: i, channels: t.channels })
    regions.push({ id: `${t.id}:${start}`, assetId: sha, trackId: t.id, name: t.name, start: { samples: start, sampleRate: rate }, offsetFrames: 0, lengthFrames: end - start })
  }
  const bundle = { format: 'orb-region-bundle', version: 1, id: randomUUID(), timebase: 'song-samples',
    source: { daw: 'Slur Tap', projectId: hash(host + hostKey).slice(0, 64), captureId: randomUUID() }, tracks, regions, assets }
  if (!parseRegionBundle(bundle)) throw new Error('Invalid stem layout.')
  const archive = await createRegionArchive({ bundle, filesByAsset })
  await writeFile(join(directory, 'selection.orb-regions.zip'), new Uint8Array(await archive.arrayBuffer()), { mode: 0o600 })
  return { tracks: tracks.length }
}

// ── Regions from captured audio (fallback when no project layout is readable) ──
const THRESHOLD = 10 ** (-66 / 20)   // −66 dBFS
/** Audible spans within the covered spans: split at ≥ minGap of silence, padded. */
export async function detectRegions(tap, { minGapSeconds = 0.75, padSeconds = 0.02, maxRegions = 512 } = {}) {
  const rate = tap.sampleRate, minGap = Math.round(minGapSeconds * rate), pad = Math.round(padSeconds * rate)
  const found = []
  for (const [s0, e0] of tap.spans) {
    let open = -1, lastLoud = -1
    for (let s = s0; s < e0;) {
      const n = Math.min(e0 - s, PAGE * 4)
      const pcm = await readRange(tap, s, s + n)
      for (let i = 0; i < n; i++) {
        let loud = false
        for (let c = 0; c < tap.channels; c++) if (Math.abs(pcm[i * tap.channels + c]) > THRESHOLD) loud = true
        if (!loud) continue
        const at = s + i
        if (open < 0) open = at
        else if (at - lastLoud > minGap) { found.push([open, lastLoud + 1]); open = at }
        lastLoud = at
      }
      s += n
    }
    if (open >= 0) found.push([open, lastLoud + 1])
    // Pad within the covered span only: never extend into uncaptured audio.
    for (let i = found.length - 1; i >= 0 && found[i][0] >= s0; i--)
      found[i] = [Math.max(s0, found[i][0] - pad), Math.min(e0, found[i][1] + pad)]
    if (found.length > maxRegions) throw new Error(`"${tap.name}" has more than ${maxRegions} audible regions. Share track stems instead.`)
  }
  return found
}

export async function inspectTapRegions({ host, hostKey }) {
  const taps = await listTaps({ host, hostKey })
  const snapshot = snapshotOf(taps, host)
  const regions = []
  for (const t of taps) {
    if (t.sampleRate !== snapshot.sampleRate) continue
    for (const [i, [s, e]] of (await detectRegions(t)).entries())
      regions.push({ id: `${t.id}:${s}:${e}`, name: `${t.name} ${i + 1}`, trackId: t.id, trackName: t.name,
        start: s / t.sampleRate, length: (e - s) / t.sampleRate, notes: ['processed'], disabledReason: null })
  }
  return { sessionId: snapshot.sessionId, daw: 'Slur Tap', kind: 'tap', name: snapshot.name, sampleRate: snapshot.sampleRate,
    revision: snapshot.revision, tracks: taps.map((t, order) => ({ id: t.id, name: t.name, order })), regions }
}

export async function exportTapRegions({ host, hostKey, options, directory }) {
  if (!Array.isArray(options?.regionIds) || !options.regionIds.length || options.regionIds.length > 512
    || new Set(options.regionIds).size !== options.regionIds.length) throw new Error('Choose 1–512 distinct regions.')
  const taps = await listTaps({ host, hostKey })
  if (snapshotOf(taps, host).revision !== options.revision) throw new Error('Slur Tap captured new audio. Refresh regions.')
  const assets = [], filesByAsset = new Map(), regions = [], tracks = []
  let total = 0
  for (const id of options.regionIds) {
    const m = /^([0-9a-f-]{36}):(\d+):(\d+)$/.exec(id)
    const tap = m && taps.find(t => t.id === m[1])
    const s = m ? Number(m[2]) : NaN, e = m ? Number(m[3]) : NaN
    if (!tap || !(e > s) || coverageOf(tap.spans, s, e).gaps.length) throw new Error('A selected region is no longer captured. Refresh regions.')
    const bytes = floatWave(tap.channels, tap.sampleRate, await readRange(tap, s, e))
    total += bytes.length
    if (total > LIMIT) throw new Error('Selected regions exceed 300 MB.')
    const sha = hash(bytes), name = `${tap.name.replace(/[/\\:]/g, '_')} ${regions.filter(r => r.trackId === tap.id).length + 1}.wav`
    if (!assets.some(a => a.id === sha)) {
      assets.push({ id: sha, sha256: sha, name, bytes: bytes.length, sampleRate: tap.sampleRate, channels: tap.channels, frames: e - s })
      filesByAsset.set(sha, new File([bytes], name, { type: 'audio/wav' }))
    }
    if (!tracks.some(t => t.id === tap.id)) tracks.push({ id: tap.id, name: tap.name, order: tracks.length, channels: tap.channels })
    regions.push({ id, assetId: sha, trackId: tap.id, name: name.replace(/\.wav$/, ''), start: { samples: s, sampleRate: tap.sampleRate }, offsetFrames: 0, lengthFrames: e - s })
  }
  const bundle = { format: 'orb-region-bundle', version: 1, id: randomUUID(), timebase: 'song-samples',
    source: { daw: 'Slur Tap', projectId: hash(host + hostKey).slice(0, 64), captureId: randomUUID() }, tracks, regions, assets }
  if (!parseRegionBundle(bundle)) throw new Error('Invalid region layout.')
  const archive = await createRegionArchive({ bundle, filesByAsset })
  await writeFile(join(directory, 'selection.orb-regions.zip'), new Uint8Array(await archive.arrayBuffer()), { mode: 0o600 })
  return { regions: regions.length }
}
