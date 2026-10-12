// node test/chords.mjs — a progression made for a stretch of the song (ui/chords.js), on the page with the song it is born
// with: the line that asks for one is read as that and nothing else is; what is made is notes of its chords and no others,
// inside its stretch, no key struck while it is still held, each hand where a hand plays, each chord close to the one
// before it — in every key, measure and length, at every setting of its three dials; it goes on a track of notes of its
// own, is one step back, is made again in place, is kept by the project; and a progression can be told to it.
import { open, PAGE } from './cdp.mjs'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
const ui = dirname(PAGE), listed = /src="chords\.js"/.test(readFileSync(PAGE, 'utf8'))
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1, before: listed ? '' : readFileSync(join(ui, 'chords.js'), 'utf8') })      // (until the page lists it, it is read in ahead of the page)
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const say = async line => { await ev(`await runCommand(${JSON.stringify(line)}); flush()`); await b.sleep(30); return ev(`const L = S.last || {}; return L.say || (L.res || []).map(a => String(a.text || a.k).replace(NAMED, '')).join(' | ')`) }
const read = async line => JSON.parse(await ev(`return JSON.stringify(parseLocal(${JSON.stringify(line)}))`))
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y)
const seed = n => ev(`let a = ${n} >>> 0; CHORD.rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }`)
const fresh = () => ev(`while (UNDO.length) undoEdit(); REDO.length = 0; S.selR = []; S.selT = []; S.marq = null; S.cycle.on = false; S.pos = 0; S.key = ''; S.last = null; CHORD.last = null; CHORD.track = null; CHORD.key = null; CHORD.dial = { dark: 0, rich: 0, move: 0 }; CHORD.w = {}; CHORD.own = []; CHORD.recent = []; CHORD.lastPat = ''; if (S.panel.on) togglePanel(S.panel.tab); flush()`)

// ── the line ──
ok('the line that asks for chords is read as that', same(await read('코드 만들어줘'), [{ do: 'chords' }]) && same(await read('make chords'), [{ do: 'chords' }]) && same(await read('코드 추천해줘'), [{ do: 'chords' }]), await read('코드 만들어줘'))
ok('so many bars', same(await read('8마디 코드 만들어줘'), [{ do: 'chords', bars: 8 }]) && same(await read('make 4 bars of chords'), [{ do: 'chords', bars: 4 }]), await read('make 4 bars of chords'))
ok('darker, richer, less movement: a step each', same(await read('darker chords'), [{ do: 'chords', dial: { dark: 1, rich: 0, move: 0 } }]) && same(await read('더 화려한 코드 추천해줘'), [{ do: 'chords', dial: { dark: 0, rich: 1, move: 0 } }]) && same(await read('덜 움직이게 코드 만들어줘'), [{ do: 'chords', dial: { dark: 0, rich: 0, move: -1 } }]) && same(await read('밝고 담백하게 코드'), [{ do: 'chords', dial: { dark: -1, rich: -1, move: 0 } }]), [await read('더 화려한 코드 추천해줘'), await read('밝고 담백하게 코드')])
ok('a key on the line', same(await read('a minor chords'), [{ do: 'chords', key: { root: 9, minor: true } }]) && same(await read('c#m 코드 만들어줘'), [{ do: 'chords', key: { root: 1, minor: true } }]) && same(await read('a마이너로 코드 만들어줘'), [{ do: 'chords', key: { root: 9, minor: true } }]) && same(await read('eb 메이저 코드'), [{ do: 'chords', key: { root: 3, minor: false } }]), [await read('a minor chords'), await read('eb 메이저 코드')])
ok('a progression told to it', same(await read('am f c g 기억해'), [{ do: 'chords', remember: ['am', 'f', 'c', 'g'] }]) && same(await read('remember a f#m d e'), [{ do: 'chords', remember: ['a', 'f#m', 'd', 'e'] }]), await read('remember a f#m d e'))
ok('the other words for the same things', same(await read('chords again'), [{ do: 'chords', again: true }]) && same(await read('코드 다른 거'), [{ do: 'chords', again: true }]) && same(await read('chords more movement'), [{ do: 'chords', dial: { dark: 0, rich: 0, move: 1 } }]) && same(await read('코드 가만히'), [{ do: 'chords', dial: { dark: 0, rich: 0, move: -1 } }]) && same(await read('brighter plainer chords'), [{ do: 'chords', dial: { dark: -1, rich: -1, move: 0 } }]) && same(await read('chords reset'), [{ do: 'chords', reset: true }]), [await read('chords again'), await read('chords more movement'), await read('chords reset')])
ok('what is not about chords is not read as chords', same(await read('kick -3'), [{ do: 'volume', track: 'kick', db: -3, mode: 'relative' }]) && !JSON.stringify(await read('mute this')).includes('chords') && !JSON.stringify(await read('다시')).includes('chords') && !JSON.stringify(await read('더 어둡게')).includes('chords') && !JSON.stringify(await read('좋아')).includes('chords') && (await read('코드 뮤트')) === null, [await read('다시'), await read('더 어둡게'), await read('코드 뮤트')])

// ── one made ──
await fresh(); await seed(1)
const n0 = await ev('return [S.tracks.length, UNDO.length]')
const said = await say('코드 만들어줘')
const one = await ev(`const t = S.tracks.find(x => x.id === CHORD.track), r = t && t.regs.find(x => x.id === CHORD.last.reg); return { tracks: S.tracks.length, undo: UNDO.length, name: t && t.name, inst: t && t.inst && [t.inst.kind, t.inst.sound], lead: S.tracks[S.sel] === t, a: r && r.a, b: r && r.b, notes: r ? r.notes.length : 0, reg: r && r.name, chords: r && r.chords, sel: S.selR, key: S.key, roll: rollOn(), kept: KEEP_R.includes('chords'), canUndo: canUndoSaid() }`)
ok('a track of notes of its own, called chords, playing the first sound', one.tracks === n0[0] + 1 && one.name === 'chords' && same(one.inst, ['synth', 'e piano']) && one.lead, one)
ok('a region over eight bars from the bar the playhead is in, with its notes in it', one.a === 1 && one.b === 9 && one.notes >= 8, [one.a, one.b, one.notes])
ok('the region is named for its chords, and keeps where each begins', typeof one.reg === 'string' && one.reg.length > 2 && Array.isArray(one.chords) && one.chords.length >= 2 && one.chords[0][0] === 0 && one.kept, [one.reg, one.chords])
ok('the line says the key and the chords', /^[a-g][#b]? (major|minor):  /.test(said) && said.includes(one.chords[0][1]), said)
ok('the song had no key written on it: now it has the one the chords are in', /^[a-g][#b]? (maj|min)$/.test(one.key) && said.startsWith(one.key.replace('maj', 'major').replace('min', 'minor').replace('majoror', 'major').replace('minoror', 'minor')), [one.key, said])
ok('it is chosen, the notes page is open on it, and it is one step', same(one.sel, [await ev('return CHORD.last.reg')]) && one.roll && one.undo === n0[1] + 1 && one.canUndo, [one.sel, one.roll, one.undo])
await ev('undoEdit(); flush()')
ok('one step back: the track and its region are gone', (await ev('return S.tracks.length')) === n0[0] && !(await ev(`return S.tracks.some(t => t.name === 'chords')`)))
await ev('redoEdit(); flush()')
ok('and forward again', await ev(`return S.tracks.some(t => t.name === 'chords' && t.regs.length === 1)`))

// ── again, in place ──
const before = await ev(`const t = byId(CHORD.track), r = t.regs[0]; return { id: r.id, pick: CHORD.last.id, name: r.name, n: UNDO.length, keys: JSON.stringify(r.notes.map(x => [x.t, x.n])) }`)
await ev(`S.last = { res: [{ k: 'word', text: 'x', chords: 1 }] }`)                      // (the line still says chords, as it does after one was made)
const again = await say('다시')
const after = await ev(`const t = byId(CHORD.track), r = t.regs[0]; return { id: r.id, regs: t.regs.length, pick: CHORD.last.id, name: r.name, n: UNDO.length, keys: JSON.stringify(r.notes.map(x => [x.t, x.n])), w: CHORD.w[${JSON.stringify(before.pick)}], tracks: S.tracks.length }`)
ok('다시: the same region, another progression in it, no second track', after.id === before.id && after.regs === 1 && after.pick !== before.pick && after.keys !== before.keys && after.tracks === n0[0] + 1, [before.pick, after.pick, again])
ok('the one that was asked again counts a little against itself, and it is a step of its own', after.w < 1 && after.n === before.n + 1, [after.w, after.n, before.n])
const dk = await say('더 어둡게')
ok('더 어둡게: a step darker, made again in place, and the line says so', (await ev('return CHORD.dial.dark')) === 1 && /darker/.test(dk) && (await ev('return byId(CHORD.track).regs.length')) === 1, dk)
await say('더 화려하게'); await say('more movement')
ok('richer, more movement: each a step of its own dial', same(await ev('return CHORD.dial'), { dark: 1, rich: 1, move: 1 }), await ev('return CHORD.dial'))
ok('reset puts the three back', /^[a-g]/.test(await say('코드 기본으로')) && same(await ev('return CHORD.dial'), { dark: 0, rich: 0, move: 0 }), await ev('return CHORD.dial'))
ok('right after one was made, a word alone is about it: another, calmer, like', same(await read('another'), [{ do: 'chords', again: true }]) && same(await read('다른 거'), [{ do: 'chords', again: true }]) && same(await read('calmer'), [{ do: 'chords', dial: { dark: 0, rich: 0, move: -1 }, again: true }]) && same(await read('like'), [{ do: 'chords', like: true }]), [await read('another'), await read('calmer'), await read('like')])
const liked = await ev('return CHORD.last.id'); await say('좋아')
ok('좋아: the one that stands counts for itself', (await ev(`return CHORD.w[${JSON.stringify(liked)}]`)) > 1, await ev('return CHORD.w'))

// ── where it goes ──
await fresh(); await seed(7)
await ev(`S.key = 'eb'; jumpTo(8); flush()`)
const eb = await say('4마디 코드 만들어줘')
const r1 = await ev(`const t = byId(CHORD.track), r = t.regs[0]; return { a: r.a, b: r.b, key: S.key }`)
ok('the song’s own key is the key, written with flats where it has flats; so many bars from the playhead’s bar', eb.startsWith('eb major:') && !/#/.test(eb) && r1.a === 9 && r1.b === 13 && r1.key === 'eb', [eb, r1])
await ev(`const i = S.tracks.findIndex(t => t.id === CHORD.track); S.marq = { a: 8, b: 12, t0: i, t1: i }; flush()`)
await say('코드 만들어줘')
ok('a marquee on its own track: the stretch it marks, and what stood there makes way', await ev(`const t = byId(CHORD.track); return t.regs.length === 1 && t.regs[0].a === 9 && t.regs[0].b === 13 && !S.marq`), await ev('return byId(CHORD.track).regs.map(r => [r.a, r.b])'))
await ev(`const i = S.tracks.findIndex(t => t.kind === 'audio' && !t.inst && t.regs.length); S.marq = { a: 16, b: 24, t0: i, t1: i }; leadTrack(i); flush()`)
await say('코드 만들어줘')
ok('a marquee on a track of sound: its stretch, on the track the chords live on', await ev(`const t = byId(CHORD.track); return t.name === 'chords' && t.regs.some(r => r.a === 17 && r.b === 25) && S.tracks.filter(x => x.name === 'chords').length === 1`), await ev('return byId(CHORD.track).regs.map(r => [r.a, r.b])'))
await ev(`S.marq = null; setCycle(28, 30, true); flush()`); await say('코드 만들어줘')
ok('the cycle, when nothing is marked', await ev(`return byId(CHORD.track).regs.some(r => r.a === 29 && r.b === 31)`), await ev('return byId(CHORD.track).regs.map(r => [r.a, r.b])'))
await ev(`S.cycle.on = false; S.selR = []; jumpTo(SONG_END); flush()`)
{ const said2 = await say('코드 만들어줘'); ok('no room at the end of the song is said, and nothing is made', said2 === 'no room for chords there', [said2, await ev('return [curPos(), SONG_END]')]) }

// ── told a progression ──
await fresh()
const told = await say('am f c g 기억해')
ok('told a progression: it is kept as steps of its key', told.startsWith('kept in mind, in a minor:') && same(await ev('return CHORD.own'), [{ s: 'i VI III VII', m: 'm' }]), [told, await ev('return CHORD.own')])
await say('remember c g/b am f')
ok('… with the note written under a chord', same((await ev('return CHORD.own'))[1], { s: 'I V/VII vi IV', m: 'M' }), await ev('return CHORD.own'))
ok('what it was told is among what it picks from', await ev(`return chordAll().filter(x => x.id.startsWith('own ')).length === 2`))

// ── every one it can make: its notes are its chords' and lie as hands play them ──
const sweep = await ev(`
  const bad = [], seen = { pats: new Set(), picks: new Set(), n: 0 }, was = [S.meter.slice(), S.tempo, Object.assign({}, CHORD.dial)]
  let a = 12345
  CHORD.rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const tones = (c, key) => new Set(CH_Q[c.q].map(i => (key.root + c.root + i) % 12).concat([(key.root + (c.bass != null ? c.bass : c.root)) % 12]))
  for (const meter of [[4, 4], [3, 4], [6, 8], [7, 8], [2, 4], [12, 8], [5, 4]]) for (const tempo of [62, 92, 124, 168]) for (const dark of [-2, 0, 2]) for (const rich of [-2, 0, 1, 2]) for (const move of [-2, 0, 1, 2]) {
    S.meter = meter; S.tempo = tempo; CHORD.dial = { dark, rich, move }; CHORD.recent = []
    const n = [1, 2, 3, 4, 8, 8, 16][seen.n % 7], key = { root: seen.n % 12, minor: seen.n % 2 === 1 }, qb = QB(), six = .25, m = chordMake(n, key, '', [0, n])
    seen.n++; seen.pats.add(m.pat); seen.picks.add(m.id)
    const at = t => { const bar = Math.min(n - 1, Math.floor(t / qb + 1e-9)), cs = m.bars[bar], j = Math.min(cs.length - 1, Math.floor((t - bar * qb) / qb * cs.length + 1e-9)); return [bar, cs[j]] }
    const where = () => [meter.join('/'), tempo, dark, rich, move, n, key.root, key.minor ? 'm' : 'M', m.id, m.pat].join(' ')
    if (!m.notes.length) { bad.push('no notes: ' + where()); continue }
    if (m.bars.length !== n) bad.push('bars: ' + where())
    const by = new Map()
    for (const x of m.notes) {
      if (!(x.t >= -1e-9 && x.d > 0 && x.t + x.d <= n * qb + 1e-6)) bad.push('outside its stretch: ' + where())
      if (!(x.v >= 20 && x.v <= 127 && Number.isInteger(x.v) && Number.isInteger(x.n))) bad.push('how hard: ' + where())
      if (!(x.n >= 31 && x.n <= 93)) bad.push('off the hands: ' + x.n + ' ' + where())
      const [bar, c0] = at(x.t), [, c1] = at(x.t + x.d - 1e-4), pc = ((x.n % 12) + 12) % 12, early = x.t - bar * qb >= qb - 2 * six - 1e-6 && bar + 1 < n && tones(m.bars[bar + 1][0], key).has(pc)
      if (!tones(c1, key).has(pc) || !(tones(c0, key).has(pc) || early)) bad.push('a note that is not its chord’s: ' + x.n + ' at ' + x.t + ' ' + where())
      if (!by.has(x.n)) by.set(x.n, []); by.get(x.n).push(x)
    }
    for (const l of by.values()) { l.sort((p, q) => p.t - q.t); for (let i = 1; i < l.length; i++) if (l[i].t < l[i - 1].t + l[i - 1].d - 1e-6) bad.push('a key struck while it is held: ' + l[i].n + ' at ' + l[i].t + ' ' + where()) }
    if (!m.notes.some(x => x.t < 1e-6)) bad.push('nothing on the first beat: ' + where())
    for (let bar = 0; bar < n; bar++) for (let j = 0; j < m.bars[bar].length; j++) { const t0 = (bar + j / m.bars[bar].length) * qb; if (!m.notes.some(x => Math.abs(x.t - t0) < 1e-6 || (x.t < t0 && x.t + x.d > t0 + 1e-6))) bad.push('a chord that is not heard where it begins: bar ' + bar + ' ' + where()) }
  }
  /* each chord close to the one before it: the high hand's top key never leaps far */
  let leap = 0
  for (let k = 0; k < 300; k++) { const key = { root: k % 12, minor: k % 3 === 0 }; let up = null; for (const c of chordFill(chordAll()[k % chordAll().length], 8, chordAll()[k % chordAll().length].m, k % 4).flat()) { const v = chordVoice(c, key, up); if (up && Math.abs(v[v.length - 1] - up[up.length - 1]) > 9) bad.push('a leap: ' + up.join(',') + ' -> ' + v.join(',') + ' ' + c.q); if (up) leap = Math.max(leap, Math.abs(v[v.length - 1] - up[up.length - 1])); if (v[0] < 52 || v[v.length - 1] > 81) bad.push('high hand out of its room: ' + v.join(',')); up = v } }
  S.meter = was[0]; S.tempo = was[1]; CHORD.dial = was[2]; CHORD.rnd = Math.random
  return { bad: [...new Set(bad)].sort((x, y) => (y.startsWith('a leap') ? 1 : 0) - (x.startsWith('a leap') ? 1 : 0)).slice(0, 12), count: bad.length, made: seen.n, pats: [...seen.pats].sort(), picks: seen.picks.size, leap, list: chordAll().length, unread: CH_LIST.filter(e => !chordBars(e[2], e[1])).map(e => e[0]) }
`)
ok('every progression on the list can be read', sweep.unread.length === 0 && sweep.list >= 55, [sweep.list, sweep.unread])
ok(`${sweep.made} made — every key, seven measures, four tempi, every setting of the dials: all notes their chords’, in the stretch, no key struck twice at once, every chord heard where it begins`, sweep.count === 0, sweep.bad)
ok('the rhythms and the progressions are all met on the way', sweep.pats.length >= 12 && sweep.picks >= 45, [sweep.pats, sweep.picks])
ok('the high hand stays close: its top key never leaps more than a sixth', sweep.leap <= 9, sweep.leap)

// ── darker is darker, richer is richer, calmer is calmer: measured over many ──
const lean = await ev(`
  let a = 99; CHORD.rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const run = (dial, f) => { CHORD.dial = Object.assign({ dark: 0, rich: 0, move: 0 }, dial); let s = 0; for (let k = 0; k < 160; k++) { CHORD.recent = []; s += f(chordMake(8, { root: 0, minor: false }, '', [0, 8])) } return s / 160 }
  const tagOf = new Map(chordAll().map(e => [e.id, e.d])), minor = m => tagOf.get(m.id), big = m => m.bars.flat().reduce((s, c) => s + CH_Q[c.q].length, 0) / m.bars.flat().length, changes = m => m.chords.length
  const r = { dark: [run({ dark: -2 }, minor), run({ dark: 2 }, minor)], rich: [run({ rich: -2 }, big), run({}, big), run({ rich: 2 }, big)], move: [run({ move: -2 }, changes), run({}, changes), run({ move: 2 }, changes)], perNote: [run({ move: -2 }, m => m.notes.length), run({ move: 2 }, m => m.notes.length)] }
  CHORD.dial = { dark: 0, rich: 0, move: 0 }; CHORD.rnd = Math.random
  return r
`)
ok('darker: the progressions it picks are the darker ones', lean.dark[1] > lean.dark[0] + .15, lean.dark)
ok('plainer is three notes to a chord; richer is more than as written', Math.abs(lean.rich[0] - 3) < 1e-9 && lean.rich[2] > lean.rich[1] + .5, lean.rich)
ok('less movement: fewer chords in the eight bars, and fewer notes; more: more', lean.move[0] < lean.move[1] && lean.move[2] > lean.move[1] && lean.perNote[0] < lean.perNote[1], [lean.move, lean.perNote])

// ── a key heard, when none is written ──
await fresh()
ok('with notes on the song and no key written, the key is the one the notes are in', await ev(`
  const t = addTrack('midi', 'tune', S.sel, { kind: 'synth', sound: 'e piano' }), sc = [62, 64, 66, 67, 69, 71, 73, 74, 69, 66, 62, 62]      // (a tune in d major)
  t.regs.push(mkReg({ a: 1, b: 5, loop: false, notes: sc.map((n, i) => mkNote(i, 1, n, 100)) })); normalizeOrder()
  const k = chordKeyNow(null); S.tracks.splice(S.tracks.indexOf(t), 1); normalizeOrder(); return k && k.root === 2 && !k.minor`), await ev('return 1'))
ok('a key as it is typed', await ev(`return JSON.stringify(['a min', 'Am', 'f#m', 'bb', 'Bb', 'c major', 'C', 'e단조', 'g♭', 'h'].map(k => { const x = chordKeyOf(k); return x ? x.root + (x.minor ? 'm' : '') : null })) === JSON.stringify(['9m', '9m', '6m', 10, 10, 0, 0, '4m', 6, null].map(x => x === null ? null : String(x)))`), await ev(`return ['a min', 'Am', 'f#m', 'bb', 'Bb', 'c major', 'C', 'e단조', 'g♭', 'h'].map(k => { const x = chordKeyOf(k); return x ? x.root + (x.minor ? 'm' : '') : null })`))
ok('nothing went wrong on the page', b.errors.length === 0 && (await ev('return (window.__errs || []).length')) === 0, [b.errors, await ev('return window.__errs')])
await b.close()
console.log(out.join('\n'))
console.log(bad.length ? `FAILED: ${bad.join(' | ')}` : 'chords: all passed')
process.exit(bad.length ? 1 : 0)
