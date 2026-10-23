// node mixlab/report-data.mjs <out folder> — the score board's findings as the files the report page reads: each song's
// role levels against the whole mix, how much of each mix its tracks explain octave by octave, the papers' targets, and
// the plug-ins he reaches for. Read from mixlab/out (hear-mix.mjs, roles.mjs, logic-use.mjs); nothing is made up here.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'out'), to = process.argv[2]
if (!to) { console.log('node mixlab/report-data.mjs <out folder>'); process.exit(1) }
mkdirSync(to, { recursive: true })
const nfc = s => String(s).normalize('NFC')

/* the role levels, one row a song and a role (long, so a chart and a table read it alike) */
const roles = JSON.parse(readFileSync(join(OUT, 'roles.json'), 'utf8')).rows
const ROLE = { lead: 'Lead vocal', bgv: 'Backing vocals', drums: 'Drum kit', kick: 'Kick', snare: 'Snare', bass: 'Bass', other: 'Other instruments' }
const long = []
for (const r of roles) for (const k of Object.keys(ROLE)) if (r[k] != null) long.push({ song: nfc(r.song), role: ROLE[k], db: r[k], fit: r.r2, reliable: r.r2 >= .6 && !(r.other != null && r.other > -1.5) })
writeFileSync(join(to, 'role-levels.json'), JSON.stringify(long))
writeFileSync(join(to, 'songs.json'), JSON.stringify(roles.map(r => ({ song: nfc(r.song), fit: r.r2, busHold: r.hold, lead: r.lead, backing: r.bgv, drums: r.drums, kick: r.kick, snare: r.snare, bass: r.bass, other: r.other, reliable: r.r2 >= .6 && !(r.other != null && r.other > -1.5) }))))

/* the papers' targets (research-1.md §2.1, each with where it was read) */
writeFileSync(join(to, 'paper-targets.json'), JSON.stringify([
  { role: 'Lead vocal', target: -2.7, low: -4.3, high: -1.1, source: 'De Man et al., analysis of mixes (−2.7 ± 1.6 LU)' },
  { role: 'Drum kit', target: -7.5, low: -8.5, high: -6.5, source: 'De Man, PhD thesis Table 6.1 (median −6.5 to −8.5 LU)' },
  { role: 'Kick', target: -13.2, low: null, high: null, source: 'De Man et al., Table 2 (−13.2 LU)' },
  { role: 'Snare', target: -16.8, low: null, high: null, source: 'De Man et al., Table 2 (−16.8 LU)' },
  { role: 'Bass', target: -9.5, low: -10, high: -8, source: 'De Man et al., Table 2; thesis Table 6.1 (−8 to −10 LU)' }
]))

/* how much of each mix the plain sum of its tracks explains, octave by octave */
const fit = []
for (const f of readdirSync(OUT).filter(f => f.endsWith('.json') && !/\.test\.json$|^(roles|plugin-use)\.json$/.test(f))) {
  const d = JSON.parse(readFileSync(join(OUT, f), "utf8")); if (!d.r2 || !d.tracks?.[0]?.raw) continue
  d.octaves.forEach((hz, b) => fit.push({ song: nfc(d.song), hz, octave: hz < 1000 ? String(hz) : hz / 1000 + 'k', r2: d.r2[b] }))
}
writeFileSync(join(to, 'fit-by-octave.json'), JSON.stringify(fit))

/* the plug-ins he reaches for, from his Logic projects: how often, and on what kind of strip */
const pu = JSON.parse(readFileSync(join(OUT, 'plugin-use.json'), 'utf8')), count = new Map()
for (const p of pu.projects) for (const s of p.strips) for (const x of s.chain) {
  if (x.inst) continue
  const name = x.name.replace(/^Logic: /, 'Logic ').replace(/^[^:]+: /, ''), c = count.get(name) || { plugin: name, uses: 0, onTracks: 0, onBuses: 0, onOutput: 0, projects: new Set() }
  c.uses++; c[s.kind === 'aux' ? 'onBuses' : s.kind === 'out' ? 'onOutput' : 'onTracks']++; c.projects.add(p.project); count.set(name, c)
}
const plugins = [...count.values()].sort((a, b) => b.uses - a.uses).slice(0, 15).map(c => ({ plugin: c.plugin, uses: c.uses, onTracks: c.onTracks, onBuses: c.onBuses, onOutput: c.onOutput, projects: c.projects.size }))
writeFileSync(join(to, 'plugins.json'), JSON.stringify(plugins))
writeFileSync(join(to, 'plugin-totals.json'), JSON.stringify([{ projects: pu.projects.length, instances: [...count.values()].reduce((s, c) => s + c.uses, 0), distinct: count.size }]))
/* how he sets faders across all his projects (logic-mix.mjs, the 10s Rough Mix session's): most stay at 0 dB */
{ const lm = JSON.parse(readFileSync(join(OUT, 'logic-mix.json'), 'utf8')); let n = 0, z = 0, projects = 0; const off = []
  for (const p of lm.projects || []) { let any = false; for (const t of p.tracks || []) if (t.fader != null) { n++; any = true; if (Math.abs(t.fader) < .05) z++; else off.push(t.fader) } if (any) projects++ }
  off.sort((a, b) => a - b)
  writeFileSync(join(to, 'fader-habit.json'), JSON.stringify([{ projects, faders: n, atZero: z, atZeroShare: Math.round(z / n * 100) + '%', movedMedian: off.length ? +off[Math.floor(off.length / 2)].toFixed(1) : null }])) }
console.log(`role-levels ${long.length} rows, songs ${roles.length}, fit ${fit.length}, plugins ${plugins.length}`)
