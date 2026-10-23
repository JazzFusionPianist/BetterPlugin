// node test/roughplan.mjs — the rough mix's plan (ui/roughplan.js), alone, in node: a small session of known tracks is
// planned in the three pictures, and what comes back is checked against what the plan promises — each part set to its
// share of the whole, the floor the same in all three, the drummer's view, pairs to opposite sides, only broadband
// ducking, carving both ways in A only, no bus in C — and against what mixlab/patents-1.md rules out.
import { createRequire } from 'node:module'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const { roughPlan, RP_TARGET } = createRequire(import.meta.url)(join(dirname(fileURLToPath(import.meta.url)), '..', 'ui', 'roughplan.js'))
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }

const tracks = [
  { id: 1, name: 'Kick In' }, { id: 2, name: 'Snare Top' }, { id: 3, name: 'HH' }, { id: 4, name: 'Tom 1' }, { id: 5, name: 'Tom 2' }, { id: 6, name: 'Floor Tom' },
  { id: 7, name: 'Bass DI' }, { id: 8, name: 'Gtr L' }, { id: 9, name: 'Gtr R' }, { id: 10, name: 'Lead Vox' }, { id: 11, name: 'BV 1' }, { id: 12, name: 'BV 2' },
  { id: 13, name: 'Keys' }, { id: 14, name: 'Riser' }
]
const roles = { 1: 'kick', 2: 'snare', 3: 'hat', 4: 'tom', 5: 'tom', 6: 'tom', 7: 'bass', 8: 'gtr', 9: 'gtr', 10: 'lead', 11: 'bgv', 12: 'bgv', 13: 'keys', 14: 'fx' }
const line = (loud, more = {}) => Object.assign({ loud, tilt: -3, low: -20, mud: -10, box: -10, presence: -12, air: -30, crest: 14, dyn: 10, width: 0 }, more)
const lines = { 1: line(-14, { low: -3 }), 2: line(-17), 3: line(-26, { low: -40 }), 4: line(-24), 5: line(-24), 6: line(-22, { low: -8 }), 7: line(-16, { low: -4 }),
  8: line(-20, { low: -30, mud: -4 }), 9: line(-21, { low: -30 }), 10: line(-18, { low: -30, ring: 12, ringHz: 3150 }), 11: line(-24, { low: -32 }), 12: line(-25, { low: -32 }), 13: line(-22, { width: 0.4 }), 14: line(-30, { width: 0.5 }) }
const pairs = [{ a: 1, b: 7, bands: { low: 0.8 } }, { a: 10, b: 8, bands: { presence: 0.5 } }]
const plan = roughPlan(tracks, lines, roles, { tempo: 96, pairs })
const of = (P, kind, id) => plan[P].moves.filter(m => m.kind === kind && (id == null || m.track === id))
const K = { kick: 'kick' }

/* balance: the parts' shares of the whole come out at their targets (their shares among the parts present) */
{ const g = new Map(of('C', 'gain').map(m => [m.track, m.value])), e = {}; let all = 0
  const partOf = id => ({ kick: 'kick', snare: 'snare', hat: 'drums', tom: 'drums', bass: 'bass', gtr: 'other', lead: 'lead', bgv: 'bgv', keys: 'other', fx: 'fx' })[roles[id]]
  for (const t of tracks) { const p = Math.pow(10, (lines[t.id].loud + g.get(t.id)) / 10); all += p; e[partOf(t.id)] = (e[partOf(t.id)] || 0) + p }
  const sh = p => 10 * Math.log10(e[p] / all)
  ok('every track is given a gain', g.size === tracks.length, g.size)
  ok('the lead stands above the bass and the bass above the snare, as his table has them', sh('lead') > sh('bass') && sh('bass') > sh('snare'), { lead: +sh('lead').toFixed(1), bass: +sh('bass').toFixed(1), snare: +sh('snare').toFixed(1) })
  ok('the whole sits at −18 LUFS before the bus', Math.abs(10 * Math.log10(all) + 18) < 0.2, +(10 * Math.log10(all)).toFixed(2))
  const gA = new Map(of('A', 'gain').map(m => [m.track, m.value]))
  ok('A puts the vocal higher than C does', gA.get(10) - g.get(10) > 0.5, [gA.get(10), g.get(10)]) }

/* the floor: the same low cuts in all three; none on the kick or the bass */
{ const cut = P => JSON.stringify(of(P, 'lowcut').map(m => [m.track, m.value.hz]))
  ok('the floor is the same in A, B and C', cut('A') === cut('B') && cut('B') === cut('C'))
  ok('no low cut on the kick or the bass', !of('A', 'lowcut').some(m => m.track === 1 || m.track === 7))
  ok('the hats are cut higher than the vocal', of('A', 'lowcut', 3)[0].value.hz > of('A', 'lowcut', 10)[0].value.hz, [of('A', 'lowcut', 3)[0].value.hz, of('A', 'lowcut', 10)[0].value.hz]) }

/* pan: the table (drummer's view), pairs opposite, the picture's spread */
{ const pan = (P, id) => of(P, 'pan', id)[0].value
  ok('kick, snare, bass and lead in the middle', [1, 2, 7, 10].every(id => pan('A', id) === 0))
  ok("hats on the left (the drummer's view)", pan('A', 3) < 0, pan('A', 3))
  ok('toms from left to right, high to floor', pan('A', 4) < pan('A', 5) && pan('A', 5) < pan('A', 6), [pan('A', 4), pan('A', 5), pan('A', 6)])
  ok('guitars L and R to their sides', pan('A', 8) < 0 && pan('A', 9) > 0)
  ok('C spreads them wider than A, B narrower', Math.abs(pan('C', 9)) > Math.abs(pan('A', 9)) && Math.abs(pan('B', 9)) < Math.abs(pan('A', 9)), [pan('A', 9), pan('B', 9), pan('C', 9)])
  ok('the backing pair to opposite sides', Math.sign(pan('A', 11)) === -Math.sign(pan('A', 12)) && pan('A', 11) !== 0)
  ok('a stereo part keeps its own image', pan('A', 13) === 0) }

/* what meets: A carves both ways (no part ranked over the other), B ducks broadband, C carves nothing */
{ const carves = P => of(P, 'eq').filter(m => /home/.test(m.why))
  ok('A carves kick and bass both ways', carves('A').some(m => m.track === 1) && carves('A').some(m => m.track === 7))
  ok('B and C carve nothing', !carves('B').length && !carves('C').length)
  ok('B ducks the bass under the kick, broadband (no band in it)', of('B', 'duck', 7).length === 1 && !('band' in of('B', 'duck', 7)[0].value) && !('f' in of('B', 'duck', 7)[0].value))
  ok('no ducking in A or C', !of('A', 'duck').length && !of('C', 'duck').length) }

/* eq, compressors, the bus and the rooms */
{ ok('the ringing vocal gets a narrow cut where it rings', of('A', 'eq', 10).some(m => m.value.f === 3150 && m.value.g < 0 && m.value.q >= 4))
  ok('the muddy guitar gets a cut at 300 hz', of('A', 'eq', 8).some(m => m.value.f === 300 && m.value.g < 0))
  ok('the vocal compressor holds at 3:1, its threshold over its loudness', of('A', 'comp', 10)[0].value.ratio === 3 && of('A', 'comp', 10)[0].value.thr > lines[10].loud)
  ok('A takes only the peaks on the bus, B glues, C has no bus', of('A', 'bus')[0].value.kind === 'peak' && of('B', 'bus')[0].value.kind === 'glue' && !of('C', 'bus').length)
  ok('A is dry: no sends', !of('A', 'send').length)
  ok('B sends everything that sends to one room', of('B', 'send').length > 5 && of('B', 'send').every(m => m.value.bus === 'room'))
  ok('in C the lead stays nearer than the backing', of('C', 'send', 10)[0].value.db < of('C', 'send', 11)[0].value.db)
  ok("C's room is longer than B's, both from the tempo", plan.C.room.decay > plan.B.room.decay && plan.B.room.decay > 0, [plan.B.room, plan.C.room])
  ok('the lows go to the middle in all three', ['A', 'B', 'C'].every(P => of(P, 'monoLows').length === 1)) }

/* nothing ruled out by mixlab/patents-1.md comes back */
{ const all = ['A', 'B', 'C'].flatMap(P => plan[P].moves)
  ok('no move names a masking loss or a keyed band', !all.some(m => /loss|partial|keyed|dynamic eq/i.test(JSON.stringify(m))))
  ok('every move says why', all.every(m => m.why && m.why.length > 2)) }

console.log(out.join('\n'))
console.log(bad.length ? `\n${bad.length} failed` : '\nall passed')
process.exit(bad.length ? 1 : 0)
