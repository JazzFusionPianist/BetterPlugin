// node mixlab/bench-roughplan.mjs [--out <folder>] — the score board: how near the rough mix (ui/roughplan.js) sets each
// part to where he set it, song by song. For every song read well (hear-mix r2 ≥ .6, its instruments not one bounce), the
// plan is made from that song's own tracks as they came (their loudness and octaves, from mixlab/out/<song>.json) with
// targets taken from his OTHER songs only (so no song marks its own work); each part's share of the mix the plan would
// make is then set beside the share that part has in his mix. The score is the mean of how far apart they lie, in db,
// over the parts the song has (lower is nearer him). Two plain ways are scored beside it: every track as it came (all
// faders at 0), and every track at one loudness (a common first automatic balance).
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { roleOf } from './role-of.mjs'

const here = dirname(fileURLToPath(import.meta.url)), OUT = join(here, 'out')
const { roughPlan, RP_PART } = createRequire(import.meta.url)(join(here, '..', 'ui', 'roughplan.js'))
const outAt = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : null

/* BS.1770's K filter at each octave's centre (as roles.mjs weighs them) */
const K = (() => {
  const H = (b, a, w) => { const re = c => c.reduce((s, v, i) => s + v * Math.cos(-i * w), 0), im = c => c.reduce((s, v, i) => s + v * Math.sin(-i * w), 0); const nr = re(b), ni = im(b), dr = re(a), di = im(a); return (nr * nr + ni * ni) / (dr * dr + di * di) }
  const s1 = [[1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]], s2 = [[1, -2, 1], [1, -1.99004745483398, 0.99007225036621]]
  return f => { const w = 2 * Math.PI * f / 48000; return H(s1[0], s1[1], w) * H(s2[0], s2[1], w) }
})()
const db = p => 10 * Math.log10(Math.max(p, 1e-20)), pw = d => Math.pow(10, d / 10)
const PARTS = ['lead', 'bgv', 'kick', 'snare', 'drums', 'bass', 'other']
/* a role as roleOf says it, as the plan's parts are named */
const ROLE_FOR_PLAN = { lead: 'lead', bgv: 'bgv', kick: 'kick', snare: 'snare', drums: 'drums', bass: 'bass', other: 'other' }

/* the ears' lines a track would have, worked from its octaves (31.5 … 16k): loudness as K-weighted power, and each
   stretch's share of the whole */
function linesOf (t, oct) {
  const e = t.raw.map(v => pw(v)), k = oct.map(K), all = e.reduce((s, v) => s + v, 0)
  const share = idx => db(idx.reduce((s, b) => s + e[b], 0) / all)
  return { loud: db(e.reduce((s, v, b) => s + v * k[b], 0)), low: share([0, 1]), mud: share([3]), box: share([4, 5]) - 3, presence: share([6, 7]), air: share([9]), dyn: 8, width: t.mono ? 0 : 0.3 }
}
/* each part's share of a mix, given each track's gain (db) and octaves */
function shares (tracks, oct, gainOf) {
  const k = oct.map(K), by = {}; let all = 0
  for (const t of tracks) { const g = gainOf(t); if (g == null) continue; const e = t.raw.reduce((s, v, b) => s + pw(v + g) * k[b], 0); all += e; by[t.part] = (by[t.part] || 0) + e }
  const out = {}; for (const p of Object.keys(by)) out[p] = db(by[p] / all)
  /* the kit as the papers and his table count it: kick, snare and the rest together */
  const kit = ['kick', 'snare', 'drums'].reduce((s, p) => s + (by[p] || 0), 0); if (kit) out.kit = db(kit / all)
  return out
}

const songs = []
for (const f of readdirSync(OUT).filter(f => f.endsWith('.json') && !/\.(test|logic|test-summary)\.json$|^(roles|plugin-use|logic-mix|projects)\.json$/.test(f))) {
  const d = JSON.parse(readFileSync(join(OUT, f), 'utf8')); if (!d.r2 || !d.tracks?.[0]?.raw) continue
  const tracks = d.tracks.filter(t => t.gain != null).map(t => ({ ...t, role: roleOf(t) })).filter(t => t.role)
  for (const t of tracks) t.part = RP_PART(ROLE_FOR_PLAN[t.role] || t.role)
  const fit = d.r2.reduce((s, v) => s + v, 0) / d.r2.length, his = shares(tracks, d.octaves, t => t.gain)
  if (fit < 0.6 || (his.other != null && his.other > -1.5)) continue                       // (read loosely, or its instruments came as one bounce)
  songs.push({ song: String(d.song).normalize('NFC'), oct: d.octaves, tracks, his, fit })
}

/* his targets with one song left out: the middle of the others' shares, part by part */
const middle = (xs) => { const s = xs.filter(v => v != null && isFinite(v)).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null }
const targetsWithout = song => { const t = {}; for (const p of PARTS) { const m = middle(songs.filter(s => s !== song).map(s => s.his[p])); if (m != null) t[p] = m } const kit = middle(songs.filter(s => s !== song).map(s => s.his.kit)); if (kit != null) t.drums = kit; return t }

const rows = []
for (const s of songs) {
  const targets = targetsWithout(s), lines = {}, roles = {}
  s.tracks.forEach((t, i) => { t.id = i + 1; lines[t.id] = linesOf(t, s.oct); roles[t.id] = ROLE_FOR_PLAN[t.role] || t.role })
  { const mid = middle(s.tracks.map(t => lines[t.id].loud)); for (const t of s.tracks) lines[t.id].loud -= mid + 20 }      // (the octaves' power is the fft's own scale: the middle track set at −20 LUFS, as tracks come)
  const plan = roughPlan(s.tracks.map(t => ({ id: t.id, name: t.name })), lines, roles, { targets })
  const gainC = new Map(plan.C.moves.filter(m => m.kind === 'gain').map(m => [m.track, m.value]))
  const loudAll = middle(s.tracks.map(t => lines[t.id].loud))
  const ways = {
    plan: shares(s.tracks, s.oct, t => gainC.has(t.id) ? gainC.get(t.id) : null),
    asCame: shares(s.tracks, s.oct, () => 0),
    sameLoud: shares(s.tracks, s.oct, t => loudAll - lines[t.id].loud)
  }
  const err = w => { const ps = PARTS.filter(p => s.his[p] != null && ways[w][p] != null && p !== 'drums').concat(s.his.kit != null ? ['kit'] : []); return ps.length ? ps.reduce((a, p) => a + Math.abs(ways[w][p] - s.his[p]), 0) / ps.length : null }
  const row = { song: s.song, fit: +s.fit.toFixed(2), tracks: s.tracks.length, plan: +err('plan').toFixed(2), asCame: +err('asCame').toFixed(2), sameLoud: +err('sameLoud').toFixed(2) }
  for (const p of ['lead', 'bgv', 'kit', 'kick', 'snare', 'bass', 'other']) { row['his_' + p] = s.his[p] != null ? +s.his[p].toFixed(1) : null; row['plan_' + p] = ways.plan[p] != null ? +ways.plan[p].toFixed(1) : null }
  rows.push(row)
}
const mean = k => rows.reduce((a, r) => a + r[k], 0) / rows.length
console.log('song'.padEnd(28), ' plan  as-came  same-loud   (mean db from his mix, over the parts the song has)')
for (const r of rows.sort((a, b) => a.plan - b.plan)) console.log(r.song.slice(0, 27).padEnd(28), String(r.plan).padStart(5), String(r.asCame).padStart(8), String(r.sameLoud).padStart(10))
console.log('ALL'.padEnd(28), mean('plan').toFixed(2).padStart(5), mean('asCame').toFixed(2).padStart(8), mean('sameLoud').toFixed(2).padStart(10), `  (${rows.length} songs)`)
if (outAt) { mkdirSync(outAt, { recursive: true }); writeFileSync(join(outAt, 'bench.json'), JSON.stringify(rows)); writeFileSync(join(outAt, 'bench-summary.json'), JSON.stringify([{ songs: rows.length, plan: +mean('plan').toFixed(2), asCame: +mean('asCame').toFixed(2), sameLoud: +mean('sameLoud').toFixed(2), made: new Date().toISOString() }])) }
