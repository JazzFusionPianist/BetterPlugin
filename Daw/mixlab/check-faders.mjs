// node mixlab/check-faders.mjs [report folder] — hear-mix against the faders he actually set: for each song whose Logic
// project was found (out/<song>.logic.json, by logic-mix.mjs), the tracks are joined by name and each one's gain read
// back from the mix is set beside its fader and pan in the project. A fader is not all of a track's gain (plug-ins,
// clip gain, buses, automation also move it), so the two are compared as they stand against the song's own middle, and
// the check says how often they agree within 3 db, and how well they go together.
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'out'), to = process.argv[2]
const key = s => String(s).normalize('NFC').toLowerCase().replace(/\.wav$/, '').replace(/^untitled - /, '').replace(/[^a-z0-9가-힣]+/g, '')
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0 }
const rows = [], songs = [], panRows = []
/* the projects as they stood when the mix was bounced (out/rough, by the project's folder: "2605 ARTIST [TITLE] MIX"
   is the song "ARTIST, TITLE"), else as they stand now (out/<song>.logic.json) */
const ROUGH = join(OUT, 'rough'), sources = []
const index = new Map()                                                                        // (the project index names each project's song: out/projects.json)
if (existsSync(join(OUT, 'projects.json'))) for (const p of (JSON.parse(readFileSync(join(OUT, 'projects.json'), 'utf8')).projects || [])) if (p.folder && p.song) index.set(p.folder.normalize('NFC').replace(/[:/]/g, '-'), p.song.normalize('NFC'))
if (existsSync(ROUGH)) for (const f of readdirSync(ROUGH).filter(f => f.endsWith('.logic.json'))) { const folder = f.normalize('NFC').replace(/\.logic\.json$/, ''), m = /^\d*\s*(.+?)\s*\[(.+?)\]/.exec(folder), song = index.get(folder) || (m ? `${m[1].trim()}, ${m[2].trim()}` : null); if (song) sources.push({ file: join(ROUGH, f), song, atBounce: true }) }
for (const f of readdirSync(OUT).filter(f => f.endsWith('.logic.json'))) { const song = f.replace(/\.logic\.json$/, '').normalize('NFC'); if (!sources.some(x => x.song === song)) sources.push({ file: join(OUT, f), song, atBounce: false }) }
for (const src of sources) {
  const lg = JSON.parse(readFileSync(src.file, 'utf8')), mine = [join(OUT, src.song + '.json'), join(OUT, src.song.normalize('NFD') + '.json')].find(existsSync) || ''
  if (!existsSync(mine)) continue
  const hm = JSON.parse(readFileSync(mine, 'utf8')), byKey = new Map()
  for (const t of lg.tracks || []) if (t.fader != null) byKey.set(key(t.name), t)
  const pairs = []
  for (const t of hm.tracks) { if (t.gain == null) continue; const l = byKey.get(key(t.name)); if (l) pairs.push({ name: t.name, heard: t.gain, fader: l.fader, panHeard: t.pan, panSet: l.pan != null ? l.pan / 64 : null }) }
  if (pairs.length < 4) { console.log(`${hm.song}: ${pairs.length} tracks joined by name (too few)`); continue }
  const mh = median(pairs.map(p => p.heard)), mf = median(pairs.map(p => p.fader))
  for (const p of pairs) { p.heardRel = +(p.heard - mh).toFixed(2); p.faderRel = +(p.fader - mf).toFixed(2); p.diff = +(p.heardRel - p.faderRel).toFixed(2); rows.push({ song: String(hm.song).normalize('NFC'), track: p.name, heard: p.heardRel, fader: p.faderRel, diff: p.diff, fit: +(hm.r2.reduce((s, v) => s + v, 0) / hm.r2.length).toFixed(2) }) }
  const within = pairs.filter(p => Math.abs(p.diff) <= 3).length / pairs.length
  const mx = pairs.reduce((s, p) => s + p.heardRel, 0) / pairs.length, my = pairs.reduce((s, p) => s + p.faderRel, 0) / pairs.length
  let c = 0, vx = 0, vy = 0; for (const p of pairs) { c += (p.heardRel - mx) * (p.faderRel - my); vx += (p.heardRel - mx) ** 2; vy += (p.faderRel - my) ** 2 }
  const r = c / Math.sqrt(vx * vy || 1)
  songs.push({ song: String(hm.song).normalize('NFC'), joined: pairs.length, within3db: +within.toFixed(2), r: +r.toFixed(2), medianAbs: +median(pairs.map(p => Math.abs(p.diff))).toFixed(1), fit: +(hm.r2.reduce((s, v) => s + v, 0) / hm.r2.length).toFixed(2) })
  /* pans: a mono track's pan read back against the pan set (a gain plug-in moves a level, not a place) */
  const pp = pairs.filter(p => p.panHeard != null && p.panSet != null)
  let pr = null, pin = null
  if (pp.length >= 4) { const ax = pp.reduce((s, p) => s + p.panSet, 0) / pp.length, ay = pp.reduce((s, p) => s + p.panHeard, 0) / pp.length; let c2 = 0, x2 = 0, y2 = 0; for (const p of pp) { c2 += (p.panSet - ax) * (p.panHeard - ay); x2 += (p.panSet - ax) ** 2; y2 += (p.panHeard - ay) ** 2 } pr = c2 / Math.sqrt(x2 * y2 || 1); pin = pp.filter(p => Math.abs(p.panHeard - p.panSet) <= .2).length / pp.length; for (const p of pp) panRows.push({ song: String(hm.song).normalize('NFC'), track: p.name, set: +p.panSet.toFixed(2), heard: +p.panHeard.toFixed(2) }) }
  Object.assign(songs[songs.length - 1] || {}, {})
  console.log(`  pans: ${pp.length} mono tracks, r ${pr == null ? '—' : pr.toFixed(2)}, within ±0.2 ${pin == null ? '—' : (pin * 100).toFixed(0) + '%'}`)
  console.log(`${hm.song}: ${pairs.length} joined, within 3 db ${(within * 100).toFixed(0)}%, r ${r.toFixed(2)}, median |diff| ${median(pairs.map(p => Math.abs(p.diff))).toFixed(1)} db, fit ${songs[songs.length - 1].fit}`)
}
if (to) { writeFileSync(join(to, 'pan-check.json'), JSON.stringify(panRows)); writeFileSync(join(to, 'fader-check.json'), JSON.stringify(rows)); writeFileSync(join(to, 'fader-check-songs.json'), JSON.stringify(songs)) }
