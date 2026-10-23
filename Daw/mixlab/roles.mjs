// node mixlab/roles.mjs — how loud each part stands in his mixes, against the whole mix: what hear-mix.mjs read back
// (mixlab/out/<song>.json), gathered by role. A track's part of the mix is its own sound in each octave turned by what it
// was given there, weighed as BS.1770 hears loudness (its K filter at each octave's centre); a role's share of all of it,
// in db, is the role's level against the whole mix — the measure the papers give their targets in (research-1.md §2.1:
// lead vocal about −3, bass −8 to −10, the drum kit −6.5 to −8.5).
// A role is found from the names he gives his tracks (MAIN, DUB, AD, HARM, WL1 …), else from the room's own reading of
// a name (tidy.js). A song whose mix the tracks explain poorly (how much, octave by octave, in hear-mix's r2) is marked.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'out')

/* BS.1770's K filter (48 kHz), its power at each octave's centre */
const K = (() => {
  const H = (b, a, w) => { const re = (c, k) => c.reduce((s, v, i) => s + v * Math.cos(-i * w), 0), im = c => c.reduce((s, v, i) => s + v * Math.sin(-i * w), 0)
    const nr = re(b), ni = im(b), dr = re(a), di = im(a); return (nr * nr + ni * ni) / (dr * dr + di * di) }
  const s1 = [[1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]], s2 = [[1, -2, 1], [1, -1.99004745483398, 0.99007225036621]]
  return f => { const w = 2 * Math.PI * f / 48000; return H(s1[0], s1[1], w) * H(s2[0], s2[1], w) }
})()

import { roleOf } from './role-of.mjs'

const ROLES = ['lead', 'bgv', 'drums', 'kick', 'snare', 'bass', 'other'], PAPER = { lead: -2.7, bass: -9.5, drums: '-6.5…-8.5', kick: -13.2, snare: -16.8 }
const songs = readdirSync(OUT).filter(f => f.endsWith('.json') && !f.endsWith('.test.json') && f !== 'plugin-use.json')
const rows = []
for (const f of songs) {
  const d = JSON.parse(readFileSync(join(OUT, f), 'utf8'))
  if (!d.tracks || !d.tracks[0] || !d.tracks[0].raw) continue                                 // (read before the octaves were kept: read again)
  const kOct = d.octaves.map(K), parts = {}, who = {}
  let all = 0
  for (const t of d.tracks) {
    if (t.gain == null) continue
    const role = roleOf(t); if (!role) continue
    const e = d.octaves.reduce((s, _, b) => s + Math.pow(10, (t.raw[b] + t.gain + (t.eq[b] ?? 0)) / 10) * kOct[b], 0)
    all += e
    const key = role === 'kick' || role === 'snare' ? [role, 'drumsAll'] : role === 'drums' ? ['drums', 'drumsAll'] : [role]
    for (const k of key) parts[k] = (parts[k] || 0) + e
    ;(who[role] = who[role] || []).push(t.name)
  }
  const lu = k => parts[k] ? +(10 * Math.log10(parts[k] / all)).toFixed(1) : null
  const r2 = d.r2.reduce((s, v) => s + v, 0) / d.r2.length
  rows.push({ song: d.song, r2: +r2.toFixed(2), hold: d.holdDb, lead: lu('lead'), bgv: lu('bgv'), drums: lu('drumsAll'), kick: lu('kick'), snare: lu('snare'), bass: lu('bass'), other: lu('other'), who })
}
rows.sort((a, b) => b.r2 - a.r2)
const cell = v => v == null ? '     ·' : String(v).padStart(6)
console.log('song'.padEnd(28), '  fit  hold', ['lead', 'bgv', 'drums', 'kick', 'snare', 'bass', 'other'].map(r => r.padStart(6)).join(''))
for (const r of rows) console.log(r.song.normalize('NFC').slice(0, 27).padEnd(28), String(r.r2).padStart(5), String(r.hold ?? '').padStart(5), [r.lead, r.bgv, r.drums, r.kick, r.snare, r.bass, r.other].map(cell).join(''), r.r2 < .6 ? '  (read loosely)' : r.other != null && r.other > -1.5 ? '  (instruments as one bounce)' : '')
/* a song whose instruments came as one bounce (the rest of the mix stands at the whole mix's own level) says nothing of how
   its instruments stand: not counted in the middles */
for (const row of rows) row.mrBounce = row.other != null && row.other > -1.5
const good = rows.filter(r => r.r2 >= .6 && !r.mrBounce), med = k => { const v = good.map(r => r[k]).filter(x => x != null).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null }
console.log('his middle (fit ≥ .6)'.padEnd(28), '           ', ['lead', 'bgv', 'drums', 'kick', 'snare', 'bass', 'other'].map(k => cell(med(k))).join(''))
console.log('the papers'.padEnd(28), '           ', ['lead', 'bgv', 'drums', 'kick', 'snare', 'bass', 'other'].map(k => String(PAPER[k] ?? '·').padStart(6)).join(''))
writeFileSync(join(OUT, 'roles.json'), JSON.stringify({ made: new Date().toISOString(), rows }, null, 1))
