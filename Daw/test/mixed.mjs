// node test/mixed.mjs — the night's features against each other: shuffle with an edit group, a crossfade through a change of
// measure, a crossfaded pair in shuffle, spot with a group, fades over what is crossfaded already; and after each, a track
// must hold no two regions that overlap without being a crossfade
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y)
const regs = name => ev(`return S.tracks.find(t => t.name === ${JSON.stringify(name)}).regs.slice().sort((x, y) => x.a - y.a).map(r => [+r.a.toFixed(4), +r.b.toFixed(4), +(r.off || 0).toFixed(4)])`)
const at = (name, bar, fy = .5, dx = 0) => ev(`const i = S.tracks.findIndex(t => t.name === ${JSON.stringify(name)}), r = document.getElementById('board').getBoundingClientRect(); return { x: r.left + bx(${bar}) + ${dx}, y: r.top + rowY(i) + 1.5 + (S.rh - 3) * ${fy} }`)
const key = async (k, code, vk, mods) => { await b.press(k, code, vk, mods || 0); await b.sleep(60) }
const undo = () => key('z', 'KeyZ', 90, 4)
// what must hold on every track, always: nothing overlaps except as a crossfade whose two fades are the stretch they share; no fade longer than its region; nothing shorter than nothing
const sound = () => ev(`
  const wrong = []
  for (const t of S.tracks) for (const L of lanesOf(t)) {
    const rs = L.regs.slice().sort((x, y) => x.a - y.a)
    for (const r of rs) { if (!(r.b - r.a > 1e-9)) wrong.push([t.name, 'empty', r.a, r.b]); if ((r.fi || 0) + (r.fo || 0) > r.b - r.a + 1e-6) wrong.push([t.name, 'fades longer than it', r.a, r.b, r.fi, r.fo]); if (r.a < 1 - 1e-9) wrong.push([t.name, 'before the song', r.a]); if (![r.a, r.b, r.off || 0, r.fi || 0, r.fo || 0].every(Number.isFinite)) wrong.push([t.name, 'not a number', r.a, r.b, r.off, r.fi, r.fo]) }
    for (let i = 0; i + 1 < rs.length; i++) { const A = rs[i], B = rs[i + 1], over = A.b - B.a; if (over > 1e-6 && !(over <= Math.min(A.fo || 0, B.fi || 0) + 1e-6)) wrong.push([t.name, 'overlap', A.a, A.b, B.a, B.b, A.fo, B.fi]) }
    for (let i = 0; i + 2 < rs.length; i++) if (rs[i].b - rs[i + 2].a > 1e-6) wrong.push([t.name, 'three deep', rs[i].a, rs[i].b, rs[i + 2].a])
  }
  return wrong`)
const fine = async name => { const w = await sound(); ok(name, w.length === 0, w.length ? w.slice(0, 4) : undefined) }
const K0 = [[5, 13, 4], [17, 25, 16], [25, 33, 24], [33, 41, 32]]
const whole = () => ev(`return JSON.stringify(S.tracks.map(t => [t.name, t.grp || '', t.regs.slice().sort((x, y) => x.a - y.a).map(r => [+r.a.toFixed(6), +r.b.toFixed(6), +(r.off || 0).toFixed(6), +(r.fi || 0).toFixed(6), +(r.fo || 0).toFixed(6), r.grp || 0])]))`)
const start = await whole()
await ev(`S.rh = 40; setZoom(24, 20); __daw.redraw()`)

// ── shuffle with an edit group ──
await ev(`const k = S.tracks.find(t => t.name === 'kick'), s = S.tracks.find(t => t.name === 'snare'); edit(() => { k.grp = s.grp = 'a' }); setMode('shuffle'); S.selR = []; __daw.redraw()`)
{ const p = await at('kick', 25, .5, -2), q = await at('kick', 23, .5); await b.dragTo(p.x, p.y, q.x, q.y, 8); await b.sleep(60) }
ok('shuffle, a group: an end pulled in on one track — both are trimmed and both tracks close up', same(await regs('kick'), [[5, 13, 4], [17, 23, 16], [23, 31, 24], [31, 39, 32]]) && same(await regs('snare'), [[5, 13, 4], [17, 23, 16], [23, 31, 24], [31, 39, 32]]), [await regs('kick'), await regs('snare')])
await fine('nothing lies on anything')
await undo()
{ const p = await at('kick', 20); await b.click(p.x, p.y); await key('Backspace', 'Backspace', 8) }
ok('shuffle, a group: a region taken out on one — its companion goes too and both tracks close up', same(await regs('kick'), [[5, 13, 4], [17, 25, 24], [25, 33, 32]]) && same(await regs('snare'), [[5, 13, 4], [17, 25, 24], [25, 33, 32]]), [await regs('kick'), await regs('snare')])
await fine('nothing lies on anything')
await undo()
{ const p = await at('kick', 9), q = await at('kick', 9 + 23); await b.dragTo(p.x, p.y, q.x, q.y, 10); await b.sleep(60) }
ok('shuffle, a group: one moved further on — both are put in at the same join', same(await regs('kick'), [[9, 17, 16], [17, 25, 24], [25, 33, 4], [33, 41, 32]]) && same(await regs('snare'), [[9, 17, 16], [17, 25, 24], [25, 33, 4], [33, 41, 32]]), [await regs('kick'), await regs('snare')])
await fine('nothing lies on anything')
await undo()

// ── a crossfaded pair in shuffle ──
await ev(`const rs = S.tracks.find(t => t.name === 'hats').regs.slice().sort((x, y) => x.a - y.a); edit(() => { crossfade(rs[0], rs[1], 1) }); S.selR = []; __daw.redraw()`)
ok('a crossfade on the hats', await ev(`const rs = S.tracks.find(t => t.name === 'hats').regs.slice().sort((x, y) => x.a - y.a); return xfadeOf(rs[0], rs[1]) === 1`))
{ const p = await at('hats', 15), q = await at('hats', 30); await b.dragTo(p.x, p.y, q.x, q.y, 10); await b.sleep(60) }
await fine('one of a crossfaded pair moved away in shuffle: nothing overlaps, no fade hangs over')
ok('and the one left behind has no fade into nothing', await ev(`return S.tracks.find(t => t.name === 'hats').regs.every(r => !(r.fi > 0) && !(r.fo > 0))`), await ev(`return S.tracks.find(t => t.name === 'hats').regs.map(r => [r.a, r.b, r.fi, r.fo])`))
await undo()
{ const p = await at('hats', 20); await b.click(p.x, p.y); await key('Backspace', 'Backspace', 8) }
await fine('one of a crossfaded pair deleted in shuffle: nothing overlaps')
ok('the other is whole up to the join, with no fade left', await ev(`const rs = S.tracks.find(t => t.name === 'hats').regs.slice().sort((x, y) => x.a - y.a); return rs[0].a === 13 && rs[0].b === 17 && !rs[0].fo`), await regs('hats'))
await undo(); await undo()
await ev(`setMode('smart')`)

// ── spot with a group ──
await ev(`setMode('spot'); S.selR = []; __daw.redraw()`)
{ const p = await at('snare', 9); await b.click(p.x, p.y); await b.sleep(120) }
await ev(`document.getElementById('rename').value = '2'`); await key('Enter', 'Enter', 13); await b.sleep(80)
ok('spot, a group: a place typed for one — its companion goes there too', same((await regs('kick'))[0], [2, 10, 4]) && same((await regs('snare'))[0], [2, 10, 4]), [await regs('kick'), await regs('snare')])
await undo(); await ev(`setMode('smart')`)

// ── fades over what is crossfaded already ──
await ev(`const rs = S.tracks.find(t => t.name === 'bass').regs.slice().sort((x, y) => x.a - y.a); S.selR = rs.map(r => r.id); S.marq = null; S.focus = 'lanes'; __daw.redraw()`)
await key('f', 'KeyF', 70)
const afterF = await whole()
await fine('f on a whole track')
await key('f', 'KeyF', 70)
ok('f again changes nothing', (await whole()) === afterF)
{ const n = await ev(`return joinsOf(S.tracks.find(t => t.name === 'bass')).filter(([A, B]) => xfadeOf(A, B)).length`); ok('every join of it is crossfaded', n === await ev(`return joinsOf(S.tracks.find(t => t.name === 'bass')).length`) && n > 0, n) }
await ev(`pickTool('scissors'); setMode('slip')`)
{ const j = await ev(`const [A, B] = joinsOf(S.tracks.find(t => t.name === 'bass')).find(([A, B]) => xfadeOf(A, B)); return (A.b + B.a) / 2`), p = await at('bass', j, .5, 0); await b.click(p.x, p.y); await b.sleep(60) }
await fine('a cut exactly on a crossfaded join')
ok('there is nothing to cut on the join itself: the crossfade stays, and nothing is added to undo', (await whole()) === afterF)
{ const j = await ev(`const [A, B] = joinsOf(S.tracks.find(t => t.name === 'bass')).find(([A, B]) => xfadeOf(A, B)); window.__n = S.tracks.find(t => t.name === 'bass').regs.length; return (A.b + B.a) / 2`), p = await at('bass', j, .5, 0)
  await ev(`VX = 0; setZoom(640, ${j} - 1)`); const q = await at('bass', j, .5, 4); await b.click(q.x, q.y); await b.sleep(60)
  ok('a little to one side of it, inside the crossfade: a plain join, and the cut', await ev(`const t = S.tracks.find(t => t.name === 'bass'); return t.regs.length === __n + 1`))
  await fine('nothing overlaps after it')
  await undo(); await ev(`setZoom(24, 20)`)
  ok('one undo gives the crossfade back', (await whole()) === afterF) }
await ev(`pickTool('pointer'); setMode('smart')`)

// ── a change of measure with crossfades and fades standing ──
await ev(`setMeter(3, 4)`)
await fine('three-four with crossfades standing: every crossfade is still one')
ok('a crossfade is as long in seconds as it was', await ev(`const [A, B] = joinsOf(S.tracks.find(t => t.name === 'bass')).find(([A, B]) => xfadeOf(A, B)); return Math.abs(xfadeOf(A, B) * SPB() - .02) < 1e-9 && Math.abs(A.fo - B.fi) < 1e-12`), await ev(`const [A, B] = joinsOf(S.tracks.find(t => t.name === 'bass')).find(([A, B]) => xfadeOf(A, B)); return [xfadeOf(A, B) * SPB(), A.fo, B.fi]`))
await ev(`timeAct.repeat(4, 8)`)
await fine('a stretch said twice in three-four')
await ev(`setMeter(4, 4)`)
await fine('back in four-four')

// ── the smart tool at the edges of what it can do ──
await ev(`pickTool('smart'); setZoom(0); S.rh = 20; __daw.redraw()`)          // the smallest rows, the widest view
{ const p = await at('kick', 5, .1, 1); await b.dragTo(p.x, p.y, p.x + 3000, p.y, 6); await b.sleep(60) }
await fine('a fade pulled far past the region’s end')
{ const p = await at('kick', 13, .1, -1); await b.dragTo(p.x, p.y, p.x - 3000, p.y, 6); await b.sleep(60) }
await fine('and the other fade pulled far past its start')
ok('the two fades share the region between them and no more', await ev(`const r = S.tracks.find(t => t.name === 'kick').regs.slice().sort((x, y) => x.a - y.a)[0]; return r.fi + r.fo <= r.b - r.a + 1e-9`), await ev(`const r = S.tracks.find(t => t.name === 'kick').regs.slice().sort((x, y) => x.a - y.a)[0]; return [r.fi, r.fo, r.b - r.a]`))

ok('no errors on the page', (await ev('return window.__errs')).length === 0 && b.errors.length === 0, [await ev('return window.__errs'), b.errors])
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close()
