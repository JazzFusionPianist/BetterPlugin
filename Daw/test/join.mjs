// node test/join.mjs — regions made one (j, command j, the join tool), on the page with the song it is born with: pieces
// of one sound mended; regions of notes made one region that holds what each sounded; the join tool on one of several
// chosen regions, and on a region and the one after it; a marquee's stretch made a region of its own, on a track of
// notes with the empty bars in it; and in a browser, where no file can be written, different sounds are left as they
// are and it is said why. (That different sounds become one file that sounds the same is the app's own check: join.)
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y)
const key = async (k, code, vk, mod = 0) => { await b.press(k, code, vk, mod); await b.sleep(140) }
const fresh = () => ev(`while (UNDO.length) undoEdit(); REDO.length = 0; S.selR = []; S.selT = []; S.marq = null; S.cycle.on = false; S.last = null; pickTool('pointer'); if (S.menu) S.menu = null; document.getElementById('cmd').blur(); setView(true); VX = 0; VY = 0; PXB = fitPXB(); flush()`)
const said = () => ev(`return (S.last || {}).say || ''`)
/* where a place on a track's lane lies on the screen (bars from zero) */
const spot = (name, pos) => ev(`const i = S.tracks.findIndex(x => x.name === ${JSON.stringify(name)}), k = document.getElementById('board').getBoundingClientRect(), z = k.width / W; showRow(i); __daw.redraw(); return { x: k.left + bx(${pos} + 1) * z, y: k.top + (rowY(i) + S.rh / 2) * z }`)
const lane = name => ev(`const t = S.tracks.find(x => x.name === ${JSON.stringify(name)}); return t.regs.slice().sort((x, y) => x.a - y.a).map(r => [+r.a.toFixed(3), +r.b.toFixed(3), S.selR.includes(r.id) ? 1 : 0])`)

// ── pieces of one sound ──
await fresh()
const NAME = await ev(`return (S.tracks.find(t => t.kind === 'audio' && !t.inst && !t.parent && t.regs.some(r => r.b - r.a >= 6)) || {}).name || ''`)
const was = (await lane(NAME)).map(r => r.slice(0, 2))
const A = await ev(`const t = S.tracks.find(x => x.name === ${JSON.stringify(NAME)}), r = t.regs.slice().sort((x, y) => (y.b - y.a) - (x.b - x.a))[0]; edit(() => { splitReg(r, t, r.a - 1 + 2) }); const two = t.regs.filter(x => x.a >= r.a - 1e-6 && x.b <= r.a + (was => was)(0) + 99).sort((x, y) => x.a - y.a); S.selR = t.regs.filter(x => Math.abs(x.a - r.a) < 1e-6 || Math.abs(x.a - (r.a + 2)) < 1e-6).map(x => x.id); S.focus = 'lanes'; flush(); return { a: r.a, n: UNDO.length }`)
ok('a region cut in two: two pieces, both chosen', (await lane(NAME)).length === was.length + 1 && (await ev('return S.selR.length')) === 2, await lane(NAME))
await key('j', 'KeyJ', 74)
ok('j: pieces of one that lie end to end are one region again, in one step, and nothing is said of a file', same((await lane(NAME)).map(r => r.slice(0, 2)), was) && (await ev('return UNDO.length')) === A.n + 1 && (await said()) === '', [await lane(NAME), await said()])
await ev('undoEdit(); flush()'); await key('j', 'KeyJ', 74, 4)
ok('command j does the same', same((await lane(NAME)).map(r => r.slice(0, 2)), was), await lane(NAME))
await ev(`undoEdit(); const t = S.tracks.find(x => x.name === ${JSON.stringify(NAME)}), r2 = t.regs.find(x => Math.abs(x.a - ${A.a + 2}) < 1e-6); edit(() => { const d = 1; r2.a += d; r2.b += d; dirtyReg(r2) }); flush()`)
const gap = await ev(`return [JSON.stringify(S.tracks.find(x => x.name === ${JSON.stringify(NAME)}).regs.map(r => [r.id, r.a, r.b])), UNDO.length]`)
await key('j', 'KeyJ', 74)
ok('pieces with a gap between them are different sounds to join: in a browser no file can be written, it is said, and nothing is touched', (await said()) === 'joining different sounds into one is in the app' && same(await ev(`return [JSON.stringify(S.tracks.find(x => x.name === ${JSON.stringify(NAME)}).regs.map(r => [r.id, r.a, r.b])), UNDO.length]`), gap), await said())

// ── a marquee inside one region ──
await fresh()
const M = await ev(`const i = S.tracks.findIndex(x => x.name === ${JSON.stringify(NAME)}), r = S.tracks[i].regs.slice().sort((x, y) => (y.b - y.a) - (x.b - x.a))[0]; S.marq = { a: r.a, b: r.a + 2, t0: i, t1: i }; S.focus = 'lanes'; flush(); return { a: r.a, n: UNDO.length }`)
await key('j', 'KeyJ', 74)
{ const now = await lane(NAME), piece = now.find(r => r[2]); ok('a marquee inside one region, j: its stretch is a region of its own, chosen, the marquee put away; one step', now.length === was.length + 2 && !!piece && Math.abs(piece[0] - (M.a + 1)) < 1e-6 && Math.abs(piece[1] - (M.a + 3)) < 1e-6 && await ev('return !S.marq') && (await ev('return UNDO.length')) === M.n + 1, now) }
await ev(`undoEdit(); const i = S.tracks.findIndex(x => x.name === ${JSON.stringify(NAME)}); S.marq = { a: SONG_END - 1.5, b: SONG_END - .5, t0: i, t1: i }; flush()`)
const n1 = await ev('return UNDO.length'); await key('j', 'KeyJ', 74)
ok('a marquee over nothing: nothing is done', (await ev('return UNDO.length')) === n1 && (await said()) === '', await said())

// ── regions of notes ──
await fresh()
await ev(`const t = addTrack('midi', 'tune', S.sel, { kind: 'synth', sound: 'e piano' }); normalizeOrder()
  t.regs.push(mkReg({ a: 3, b: 4, loop: false, notes: [mkNote(0, 1, 60, 100), mkNote(2, 1, 64, 100)] }), mkReg({ a: 6, b: 7, loop: false, notes: [mkNote(1, 1, 67, 90)] }), mkReg({ a: 9, b: 10, loop: false, notes: [mkNote(0, 2, 72, 80)] }))
  S.selR = t.regs.slice(0, 2).map(r => r.id); S.focus = 'lanes'; leadTrack(S.tracks.indexOf(t)); flush()`)
const tune = () => ev(`const t = S.tracks.find(x => x.name === 'tune'); return t.regs.slice().sort((x, y) => x.a - y.a).map(r => [r.a, r.b, r.notes.map(x => [x.t, x.d, x.n, x.v]), S.selR.includes(r.id) ? 1 : 0])`)
const u0 = await ev('return UNDO.length')
await key('j', 'KeyJ', 74)
ok('two regions of notes, j: one region from the first one’s beginning to the last one’s end, each note where it sounded; one step', same(await tune(), [[3, 7, [[0, 1, 60, 100], [2, 1, 64, 100], [13, 1, 67, 90]], 1], [9, 10, [[0, 2, 72, 80]], 0]]) && (await ev('return UNDO.length')) === u0 + 1, await tune())
await ev('undoEdit(); S.selR = []; flush()')
ok('one step back: two regions again', (await tune()).length === 3, await tune())
// the join tool: t, then j; a press on a region joins it and the one after it
await key('t', 'KeyT', 84); await key('j', 'KeyJ', 74)
ok('t, j: the join tool', await ev(`return S.tool === 'join' && !S.menu`), await ev('return S.tool'))
{ const p = await spot('tune', 2.4); await b.click(p.x, p.y); await b.sleep(200) }
ok('the join tool pressed on a region of notes: it and the one that follows it are one', same((await tune()).map(r => r.slice(0, 3)), [[3, 7, [[0, 1, 60, 100], [2, 1, 64, 100], [13, 1, 67, 90]]], [9, 10, [[0, 2, 72, 80]]]]), await tune())
await ev(`undoEdit(); S.selR = S.tracks.find(x => x.name === 'tune').regs.map(r => r.id); flush()`)
{ const p = await spot('tune', 5.4); await b.click(p.x, p.y); await b.sleep(200) }
ok('the join tool pressed on one of several chosen regions: all of them are one', same((await tune()).map(r => r.slice(0, 3)), [[3, 10, [[0, 1, 60, 100], [2, 1, 64, 100], [13, 1, 67, 90], [24, 2, 72, 80]]]]), await tune())
// a marquee on a track of notes: its stretch, the empty bars with it
await ev(`undoEdit(); pickTool('pointer'); const i = S.tracks.findIndex(x => x.name === 'tune'); S.selR = []; S.marq = { a: 1, b: 7, t0: i, t1: i }; flush()`)
await key('j', 'KeyJ', 74)
ok('a marquee on a track of notes, j: one region that is the marquee’s stretch, empty bars and all, the notes where they sounded', same((await tune()).map(r => r.slice(0, 3)), [[2, 8, [[4, 1, 60, 100], [6, 1, 64, 100], [17, 1, 67, 90]]], [9, 10, [[0, 2, 72, 80]]]]) && await ev('return !S.marq'), await tune())
await ev(`undoEdit(); const i = S.tracks.findIndex(x => x.name === 'tune'); S.selR = []; S.marq = { a: 2, b: 3, t0: i, t1: i }; flush()`)
const n2 = await ev('return UNDO.length'); await key('j', 'KeyJ', 74)
ok('a marquee that is just one region of notes: nothing to do', (await ev('return UNDO.length')) === n2, await tune())
// with the join tool, a press inside a marquee makes its stretch one
await ev(`pickTool('join'); const i = S.tracks.findIndex(x => x.name === 'tune'); S.selR = []; S.marq = { a: 1, b: 7, t0: i, t1: i }; flush()`)
{ const p = await spot('tune', 4.5); await b.click(p.x, p.y); await b.sleep(200) }
ok('the join tool pressed inside a marquee: the marquee’s stretch is made one', same((await tune()).map(r => r.slice(0, 2)), [[2, 8], [9, 10]]) && await ev('return !S.marq'), await tune())
ok('nothing went wrong on the page', b.errors.length === 0 && (await ev('return (window.__errs || []).length')) === 0, [b.errors, await ev('return window.__errs')])
await b.close()
console.log(out.join('\n'))
console.log(bad.length ? `FAILED: ${bad.join(' | ')}` : 'join: all passed')
process.exit(bad.length ? 1 : 0)
