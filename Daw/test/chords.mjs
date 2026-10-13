// node test/chords.mjs — chords typed on the command line, written out as notes (ui/chords.js), on the page with the song
// it is born with: a name is read as it is written over a staff, tensions and all; a line of names is a bar each, or
// with the bars drawn the names of a bar share it; what is written is the notes of those chords and no others, each
// held for as long as its chord stands, the root lowest, the hand above close to where it was and without half steps
// side by side; it goes on a track of notes, is one step back, and nothing but chord names is ever read as chords.
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const say = async line => { await ev(`await runCommand(${JSON.stringify(line)}); flush()`); await b.sleep(30); return ev(`const L = S.last || {}; return L.say || (L.res || []).map(a => String(a.text || a.k).replace(NAMED, '')).join(' | ')`) }
const read = async line => JSON.parse(await ev(`return JSON.stringify(parseLocal(${JSON.stringify(line)}))`))
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y)
const fresh = () => ev(`while (UNDO.length) undoEdit(); REDO.length = 0; S.selR = []; S.selT = []; S.marq = null; S.cycle.on = false; S.pos = 0; S.last = null; CHORD.track = null; if (S.panel.on) togglePanel(S.panel.tab); flush()`)
/* the region the line just wrote, as [where it begins, how long, its keys low to high] for each chord in it */
const written = () => ev(`const t = byId(CHORD.track), r = t.regs.find(x => S.selR.includes(x.id)), by = new Map()
  for (const x of r.notes) { const k = x.t + ' ' + x.d; if (!by.has(k)) by.set(k, []); by.get(k).push(x.n) }
  return { a: r.a, b: r.b, name: r.name, chords: r.chords, vel: [...new Set(r.notes.map(x => x.v))], hits: [...by.entries()].map(([k, ns]) => [+k.split(' ')[0], +k.split(' ')[1], ns.sort((p, q) => p - q)]).sort((p, q) => p[0] - q[0]) }`)
const pcs = ns => [...new Set(ns.map(n => n % 12))].sort((x, y) => x - y)

// ── a name, read ──
const NAMES = [
  ['C', [0, 4, 7]], ['Cm', [0, 3, 7]], ['Cmin', [0, 3, 7]], ['C-', [0, 3, 7]], ['Cdim', [0, 3, 6]], ['C°', [0, 3, 6]], ['Caug', [0, 4, 8]], ['C+', [0, 4, 8]], ['C5', [0, 7]],
  ['Csus4', [0, 5, 7]], ['Csus', [0, 5, 7]], ['Csus2', [0, 2, 7]], ['C6', [0, 4, 7, 9]], ['Cm6', [0, 3, 7, 9]], ['C69', [0, 4, 7, 9, 14]], ['C6/9', [0, 4, 7, 9, 14]], ['Cadd9', [0, 4, 7, 14]], ['Cmadd9', [0, 3, 7, 14]], ['Cm(add9)', [0, 3, 7, 14]],
  ['C7', [0, 4, 7, 10]], ['CM7', [0, 4, 7, 11]], ['Cmaj7', [0, 4, 7, 11]], ['C△7', [0, 4, 7, 11]], ['CΔ', [0, 4, 7, 11]], ['Cm7', [0, 3, 7, 10]], ['C-7', [0, 3, 7, 10]], ['CmM7', [0, 3, 7, 11]], ['Cm(maj7)', [0, 3, 7, 11]],
  ['Cdim7', [0, 3, 6, 9]], ['C°7', [0, 3, 6, 9]], ['Cm7b5', [0, 3, 6, 10]], ['Cø', [0, 3, 6, 10]], ['Cm7(b5)', [0, 3, 6, 10]], ['C7#5', [0, 4, 8, 10]], ['C+7', [0, 4, 8, 10]], ['C7+', [0, 4, 8, 10]], ['CM7#5', [0, 4, 8, 11]], ['C7b5', [0, 4, 6, 10]],
  ['C7sus4', [0, 5, 7, 10]], ['C9sus4', [0, 5, 7, 10, 14]], ['C13sus4', [0, 5, 7, 10, 14, 21]],
  ['C9', [0, 4, 7, 10, 14]], ['CM9', [0, 4, 7, 11, 14]], ['Cmaj9', [0, 4, 7, 11, 14]], ['Cm9', [0, 3, 7, 10, 14]], ['C11', [0, 7, 10, 14, 17]], ['Cm11', [0, 3, 7, 10, 14, 17]], ['C13', [0, 4, 7, 10, 14, 21]], ['CM13', [0, 4, 7, 11, 14, 21]], ['Cm13', [0, 3, 7, 10, 14, 21]],
  ['C7b9', [0, 4, 7, 10, 13]], ['C7(b9)', [0, 4, 7, 10, 13]], ['C7#9', [0, 4, 7, 10, 15]], ['C7(#9)', [0, 4, 7, 10, 15]], ['C7(b9,13)', [0, 4, 7, 10, 13, 21]], ['C7(#9,b13)', [0, 4, 7, 10, 15, 20]], ['C7(b13)', [0, 4, 7, 10, 20]], ['C7(13)', [0, 4, 7, 10, 21]], ['C7#11', [0, 4, 7, 10, 18]],
  ['C9#11', [0, 4, 7, 10, 14, 18]], ['C13b9', [0, 4, 7, 10, 13, 21]], ['C7b9#11', [0, 4, 7, 10, 13, 18]], ['C7#5#9', [0, 4, 8, 10, 15]], ['C7alt', [0, 4, 10, 13, 20]],
  ['CM7(9)', [0, 4, 7, 11, 14]], ['CM7(#11)', [0, 4, 7, 11, 18]], ['CM7#11', [0, 4, 7, 11, 18]], ['CM7(9,#11,13)', [0, 4, 7, 11, 14, 18, 21]], ['CM9#11', [0, 4, 7, 11, 14, 18]],
  ['Cm7(9)', [0, 3, 7, 10, 14]], ['Cm7(11)', [0, 3, 7, 10, 17]], ['Cm7(9,11)', [0, 3, 7, 10, 14, 17]], ['Cm7add11', [0, 3, 7, 10, 17]], ['C(9)', [0, 4, 7, 14]], ['C(omit3)', [0, 7]], ['C7sus4(b9)', [0, 5, 7, 10, 13]], ['C7(-9)', [0, 4, 7, 10, 13]], ['C7(+9)', [0, 4, 7, 10, 15]],
]
const got = await ev(`return ${JSON.stringify(NAMES.map(n => n[0]))}.map(w => { const c = chordOfName(w); return c && c.iv })`)
const wrong = NAMES.map((n, i) => same(got[i], n[1]) ? null : [n[0], got[i], n[1]]).filter(Boolean)
ok(`${NAMES.length} chord names read as they are written over a staff: kinds, sevenths, sus and add, tensions after the chord and in brackets`, wrong.length === 0, wrong.slice(0, 8))
const ROOTS = ['F#m7b5', 'Bbmaj9#11', 'Ebm9', 'Ab5', 'C/E', 'F#m7/C#', 'G7(b9)/B', 'C/C', 'B♭7', 'F♯m']
const roots = await ev(`return ${JSON.stringify(ROOTS)}.map(w => { const c = chordOfName(w); return c && [c.pc, c.bass] })`)
ok('a root with its sharp or flat, and a note written under the chord', same(roots, [[6, null], [10, null], [3, null], [8, null], [0, 4], [6, 1], [7, 11], [0, null], [10, null], [6, null]]), roots)
ok('a capital M is major and a small m is minor', same(await ev(`return [chordOfName('CM7').iv, chordOfName('Cm7').iv, chordOfName('CM9').iv, chordOfName('Cm9').iv]`), [[0, 4, 7, 11], [0, 3, 7, 10], [0, 4, 7, 11, 14], [0, 3, 7, 10, 14]]))
const NOT = ['c', 'am', 'H7', 'Cx', 'C7(b7)', 'C7(b9', 'Guitar', 'Bass', 'C#b', 'Cmaj7#4', 'C7()x', '']
const not = await ev(`return ${JSON.stringify(NOT)}.map(w => chordOfName(w) ? w : null)`)
ok('what is not a chord name is not read as one', not.every(x => x === null), not)

// ── a line, read ──
ok('a line of names: a bar each', same(await read('Dm7(9) G7(b9,13) CM7(9) A7(b13)'), [{ do: 'chords', bars: [['Dm7(9)'], ['G7(b9,13)'], ['CM7(9)'], ['A7(b13)']] }]), await read('Dm7(9) G7(b9,13) CM7(9) A7(b13)'))
ok('a space inside a bracket does not cut the name in two', same(await read('G7(b9, 13) CM7( 9 )'), [{ do: 'chords', bars: [['G7(b9,13)'], ['CM7(9)']] }]), await read('G7(b9, 13) CM7( 9 )'))
ok('with the bars drawn, the names of a bar share it; a dash holds', same(await read('| Dm7 G7 | CM7 - A7 - |'), [{ do: 'chords', bars: [['Dm7', 'G7'], ['CM7', '-', 'A7', '-']] }]) && same(await read('Dm7 G7|CM7 % A7 .'), [{ do: 'chords', bars: [['Dm7', 'G7'], ['CM7', '-', 'A7', '-']] }]) && same(await read('Am - F -'), [{ do: 'chords', bars: [['Am'], ['-'], ['F'], ['-']] }]), [await read('| Dm7 G7 | CM7 - A7 - |'), await read('Am - F -')])
ok('a name that cannot be read is said, and nothing is written', same((await read('Dm7 G7x CM7')).map(a => [a.do, String(a.text).replace(/^[^a-z]*/, '')]), [['note', 'couldn’t read the chord G7x']]), await read('Dm7 G7x CM7'))
const others = [await read('am f c g'), await read('Guitar'), await read('Bass up 3'), await read('Drums Bass'), await read('mute this'), await read('코드 만들어줘'), await read('make chords'), await read('C up')]
ok('nothing else is read as chords', same(await read('kick -3'), [{ do: 'volume', track: 'kick', db: -3, mode: 'relative' }]) && same(await read('play'), [{ do: 'play' }]) && same(await read('17'), [{ do: 'pos', bar: 17, beat: 1, six: 1 }]) && !others.some(r => JSON.stringify(r).includes('chords')), others)
await ev(`S.tracks[0].was = S.tracks[0].name; S.tracks[0].name = 'C'; SAY.vocab = null`)
ok('one name that is a track’s own name means the track', !JSON.stringify(await read('C')).includes('chords') && JSON.stringify(await read('C G')).includes('chords'), [await read('C'), await read('C G')])
await ev(`S.tracks[0].name = S.tracks[0].was; delete S.tracks[0].was; SAY.vocab = null`)

// ── written ──
await fresh()
const n0 = await ev('return [S.tracks.length, UNDO.length, S.key]')
const said = await say('Dm7(9) G7(b9,13) CM7(9) A7(b13)')
const one = await ev(`const t = byId(CHORD.track); return { tracks: S.tracks.length, undo: UNDO.length, name: t && t.name, inst: t && t.inst && [t.inst.kind, t.inst.sound], lead: S.tracks[S.sel] === t, regs: t ? t.regs.length : 0, roll: rollOn(), key: S.key, canUndo: canUndoSaid(), kept: KEEP_R.includes('chords') }`)
const w1 = await written()
ok('a track of notes of its own, called chords, playing the first sound', one.tracks === n0[0] + 1 && one.name === 'chords' && same(one.inst, ['synth', 'e piano']) && one.lead && one.regs === 1, one)
ok('a region of four bars from the bar the playhead is in, named for its chords, keeping where each begins', w1.a === 1 && w1.b === 5 && w1.name === 'Dm7(9)  G7(b9,13)  CM7(9)  A7(b13)' && same(w1.chords, [[0, 'Dm7(9)'], [4, 'G7(b9,13)'], [8, 'CM7(9)'], [12, 'A7(b13)']]) && one.kept, [w1.a, w1.b, w1.name, w1.chords])
ok('each chord is struck once, where it begins, and held for its bar', same(w1.hits.map(h => [h[0], h[1]]), [[0, 4], [4, 4], [8, 4], [12, 4]]), w1.hits.map(h => [h[0], h[1]]))
ok('the notes are those chords’ and no others: every one of each chord, the root lowest', same(w1.hits.map(h => pcs(h[2])), [[0, 2, 4, 5, 9], [2, 4, 5, 7, 8, 11], [0, 2, 4, 7, 11], [1, 4, 5, 7, 9]]) && same(w1.hits.map(h => h[2][0] % 12), [2, 7, 0, 9]) && w1.hits.every(h => h[2][0] <= 50 && h[2][1] >= 52), w1.hits)
ok('all struck alike, as hard as the notes page draws a note', w1.vel.length === 1 && w1.vel[0] === await ev('return ROLL.vel'), w1.vel)
ok('the line says where and what; the song’s key is left as it was; it is chosen, the notes page is open, and it is one step', said === 'bars 1 to 4:  Dm7(9)  G7(b9,13)  CM7(9)  A7(b13)' && one.key === n0[2] && one.roll && one.undo === n0[1] + 1 && one.canUndo, [said, one.key, one.roll, one.undo])
await ev('undoEdit(); flush()')
ok('one step back: the track and its region are gone', (await ev('return S.tracks.length')) === n0[0] && !(await ev(`return S.tracks.some(t => t.name === 'chords')`)))
await ev('redoEdit(); flush()')

// ── the names of a bar ──
const at = async (bar, line) => { await ev(`jumpTo(${bar}); S.selR = []; S.marq = null; flush()`); const s = await say(line); return [s, await written()] }
{ const [, w] = await at(8, '| Dm7 G7 | CM7 - A7 - |'); ok('two names halve a bar; four are a beat each, and a dash leaves the chord before it standing', w.a === 9 && w.b === 11 && same(w.hits.map(h => [h[0], h[1]]), [[0, 2], [2, 2], [4, 2], [6, 2]]) && same(w.hits.map(h => pcs(h[2])), [[0, 2, 5, 9], [2, 5, 7, 11], [0, 4, 7, 11], [1, 4, 7, 9]]), w.hits) }
{ const [, w] = await at(12, '| C F G |'); ok('three names in a bar of four: a beat each, the last to the end of the bar', same(w.hits.map(h => [h[0], h[1]]), [[0, 1], [1, 1], [2, 2]]), w.hits) }
{ const [, w] = await at(14, 'Am - F -'); ok('without bars drawn a dash holds a bar more', w.a === 15 && w.b === 19 && same(w.hits.map(h => [h[0], h[1]]), [[0, 8], [8, 8]]), w.hits) }
{ const [, w] = await at(20, '| C D E F G A B C |'); ok('eight names in a bar: an eighth each', same(w.hits.map(h => [h[0], h[1]]), [0, 1, 2, 3, 4, 5, 6, 7].map(i => [i / 2, .5])), w.hits.map(h => [h[0], h[1]])) }
{ const [, w] = await at(22, '- C'); ok('a dash with nothing before it is a bar of rest', w.a === 23 && w.b === 25 && same(w.hits.map(h => [h[0], h[1]]), [[4, 4]]), w.hits) }
{ const [, w] = await at(26, 'C C'); ok('the same name twice is struck twice', same(w.hits.map(h => [h[0], h[1]]), [[0, 4], [4, 4]]), w.hits) }
await ev(`jumpTo(30); S.selR = []; flush()`)
ok('more names in a bar than it has beats, and not an even share, is said', (await say('| C D E F G |')) === 'more chords in a bar than it has beats')

// ── the hand ──
const hands = await ev(`
  const bad = [], shown = {}, clash = new Set(['Cm11', 'CM7(9,#11,13)', 'Csus2', 'CmM7', 'CM7'])      // (chords whose own notes leave no way round a half step)
  for (const w of ['C13', 'CM7(#11)', 'C7(#9)', 'CM7(9,#11,13)', 'C7(b9,13)', 'Cm11', 'C69', 'Cadd9', 'CM7', 'C7(#9,b13)', 'Csus2', 'C7alt', 'CmM7', 'Cdim7', 'CM7(9)', 'Cm7(9)', 'C9sus4', 'C7(b13)']) {
    const c = chordOfName(w), v = chordVoice(c, null)
    shown[w] = v
    for (let i = 1; i < v.length; i++) if (v[i] - v[i - 1] === 1 && !clash.has(w)) bad.push('a half step side by side: ' + w + ' ' + v.join(','))
    if (v.length > 5 || v[0] < 52 || v[v.length - 1] > 84) bad.push('out of the hand: ' + w + ' ' + v.join(','))
    if (new Set(v.map(n => n % 12)).size !== v.length) bad.push('a note twice: ' + w)
  }
  /* through every key, three songs' worth of changes: the top key never leaps far, and every key struck is the chord's */
  const R = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'], nm = (st, q, tr) => R[(st + tr) % 12] + q
  const seqs = [[[2, 'm7(9)'], [7, '7(b9,13)'], [0, 'M7(9)'], [9, '7(b13)']], [[5, 'M7(#11)'], [4, 'm7(11)'], [2, 'm9'], [7, '13'], [0, '69'], [9, 'm11'], [2, '9sus4'], [7, '7alt']], [[0, ''], [9, 'm'], [5, ''], [7, '7'], [4, 'm7'], [9, 'm7'], [2, 'm7'], [7, '7sus4']]]
  let leap = 0
  for (let tr = 0; tr < 12; tr++) for (const seq of seqs) {
    let up = null, low = null
    for (const [st, q] of seq) {
      const c = chordOfName(nm(st, q, tr))
      if (!c) { bad.push('not read: ' + nm(st, q, tr)); continue }
      const v = chordVoice(c, up), bs = chordBass(c, low), tones = new Set(c.iv.map(i => (c.pc + i) % 12))
      if (up) leap = Math.max(leap, Math.abs(v[v.length - 1] - up[up.length - 1]))
      if (v.some(n => !tones.has(n % 12))) bad.push('a key that is not the chord’s: ' + nm(st, q, tr) + ' ' + v.join(','))
      if (bs % 12 !== c.pc || bs < 33 || bs > 50) bad.push('the low hand: ' + nm(st, q, tr) + ' ' + bs)
      up = v; low = bs
    }
  }
  return { bad: [...new Set(bad)].slice(0, 10), leap, shown }
`)
ok('the high hand: five keys at most, in its room, no note twice, and no half step side by side where another way of laying it avoids one', hands.bad.length === 0, [hands.bad, hands.shown])
ok('C13 is laid with its seventh at the bottom and its thirteenth on top', hands.shown.C13[0] % 12 === 10 && hands.shown.C13[hands.shown.C13.length - 1] % 12 === 9, hands.shown.C13)
ok('a fifth that could only lie a half step beside a tension is left out: C7(#9,b13) is its third, lowered thirteenth, seventh and raised ninth', same(hands.shown['C7(#9,b13)'].map(n => n % 12), [4, 8, 10, 3]), hands.shown['C7(#9,b13)'])
ok('from chord to chord, in every key, the top key never leaps more than a sixth', hands.leap <= 9, hands.leap)

// ── where it goes ──
await fresh()
await ev(`S.marq = { a: 8, b: 12, t0: 0, t1: 0 }; flush()`); await say('Am F')
ok('a marquee: from the bar it begins in — as many bars as were typed, not as many as are marked', await ev(`const t = byId(CHORD.track), r = t.regs[0]; return t.name === 'chords' && r.a === 9 && r.b === 11 && !S.marq`), await ev('return byId(CHORD.track).regs.map(r => [r.a, r.b])'))
await ev(`const i = S.tracks.findIndex(t => t.id === CHORD.track); S.marq = { a: 8, b: 9, t0: i, t1: i }; flush()`); await say('C G E7')
ok('a marquee on a track of notes: what stood in those bars makes way', await ev(`const t = byId(CHORD.track); return t.regs.length === 1 && t.regs[0].a === 9 && t.regs[0].b === 12 && t.regs[0].name === 'C  G  E7'`), await ev('return byId(CHORD.track).regs.map(r => [r.a, r.b, r.name])'))
await ev(`S.marq = null; S.selR = []; setCycle(28, 30, true); flush()`); await say('Fm')
ok('the cycle, when nothing is marked', await ev(`return byId(CHORD.track).regs.some(r => r.a === 29 && r.b === 30)`), await ev('return byId(CHORD.track).regs.map(r => [r.a, r.b])'))
await ev(`S.cycle.on = false; S.selR = []; jumpTo(0); flush()`)
ok('a track of notes that leads and is free there takes them — unless its sound plays one key at a time', await ev(`
  const keys = addTrack('midi', 'keys', S.sel, { kind: 'synth', sound: 'warm pad' }), bass = addTrack('midi', 'low', S.sel, { kind: 'synth', sound: 'sub bass' }); normalizeOrder()
  const run = async t => { leadTrack(S.tracks.indexOf(t)); S.selR = []; S.marq = null; jumpTo(32); await runCommand('Am F'); return CHORD.track }
  const onKeys = await run(keys) === keys.id, onBass = await run(bass) === bass.id
  for (const t of [keys, bass]) S.tracks.splice(S.tracks.indexOf(t), 1)
  normalizeOrder(); flush(); return onKeys && !onBass`))
await fresh()
await ev(`jumpTo(SONG_END - 2); flush()`)
{ const s2 = await say('C F G Am'); ok('past the end of the song: the bars that fit, and it is said how many did not', s2.startsWith('bars 41 to 42:  C  F') && /2 bars past the end of the song left out/.test(s2) && await ev(`return byId(CHORD.track).regs[0].b === 43`), s2) }
await ev(`S.selR = []; jumpTo(SONG_END); flush()`)
ok('no room at the very end is said, and nothing is written', (await say('C F')) === 'no room for chords there')

// ── other measures ──
await fresh()
const three = await ev(`const was = S.meter.slice(), hitsOf = () => { const r = byId(CHORD.track).regs.find(x => S.selR.includes(x.id)); return [...new Set(r.notes.map(x => x.t + ' ' + x.d))].sort((p, q) => parseFloat(p) - parseFloat(q)) }
  S.meter = [3, 4]; jumpTo(0); await runCommand('| C F G | Am |'); const h3 = hitsOf(); undoEdit()
  S.meter = [6, 8]; S.selR = []; await runCommand('| C G | Am |'); const h6 = hitsOf(); undoEdit()
  S.meter = was; flush(); return [h3, h6]`)
ok('three to a bar: three names are a beat each; six eighths: two names are a dotted quarter each', same(three, [['0 1', '1 1', '2 1', '3 3'], ['0 1.5', '1.5 1.5', '3 3']]), three)
ok('nothing went wrong on the page', b.errors.length === 0 && (await ev('return (window.__errs || []).length')) === 0, [b.errors, await ev('return window.__errs')])
await b.close()
console.log(out.join('\n'))
console.log(bad.length ? `FAILED: ${bad.join(' | ')}` : 'chords: all passed')
process.exit(bad.length ? 1 : 0)
