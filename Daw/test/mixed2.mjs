// node test/mixed2.mjs — more of the night's features against each other, with files (which have only so much sound to
// either side) rather than loops: a group's trim against the shorter file, crossfades where one side has nothing to run on,
// a join pulled to where a file ends, time edits over files, close-up drawing of fades and crossfades
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
const sound = () => ev(`
  const wrong = []
  for (const t of S.tracks) for (const L of lanesOf(t)) {
    const rs = L.regs.slice().sort((x, y) => x.a - y.a)
    for (const r of rs) {
      if (!(r.b - r.a > 1e-9)) wrong.push([t.name, 'empty', r.a, r.b]); if ((r.fi || 0) + (r.fo || 0) > r.b - r.a + 1e-6) wrong.push([t.name, 'fades longer than it', r.a, r.b, r.fi, r.fo]); if (r.a < 1 - 1e-9) wrong.push([t.name, 'before the song', r.a])
      if (![r.a, r.b, r.off || 0, r.fi || 0, r.fo || 0].every(Number.isFinite)) wrong.push([t.name, 'not a number', r.a, r.b, r.off, r.fi, r.fo])
      if (!r.loop && r.srcBars) { if ((r.off || 0) < -1e-6) wrong.push([t.name, 'before its file', r.a, r.off]); if ((r.off || 0) + (r.b - r.a) > r.srcBars + 1e-6) wrong.push([t.name, 'past its file', r.a, r.b, r.off, r.srcBars]) }
    }
    for (let i = 0; i + 1 < rs.length; i++) { const A = rs[i], B = rs[i + 1], over = A.b - B.a; if (over > 1e-6 && !(over <= Math.min(A.fo || 0, B.fi || 0) + 1e-6)) wrong.push([t.name, 'overlap', A.a, A.b, B.a, B.b, A.fo, B.fi]) }
  }
  return wrong`)
const fine = async name => { const w = await sound(); ok(name, w.length === 0, w.length ? w.slice(0, 4) : undefined) }

// two tracks of files: on "guitar" two files of four bars that meet at bar 5 (the first has a bar of sound to run on past its end,
// the second begins at the very start of its file); on "hum" one file of six bars shown from its second bar
await ev(`
  const g = S.tracks.find(t => t.name === 'guitar'), h = S.tracks.find(t => t.name === 'hum'); g.theirs = null; h.theirs = null; g.regs = []; h.regs = []
  const F = (o) => mkReg(Object.assign({ loop: false, rate: 1, off: 0 }, o, { sec: o.srcBars * SPB() }))
  window.__A = F({ a: 1, b: 5, key: 'file:a', srcBars: 5 }); window.__B = F({ a: 5, b: 9, key: 'file:b', srcBars: 4 }); window.__C = F({ a: 1, b: 5, key: 'file:c', srcBars: 6, off: 1 })
  g.regs.push(__A, __B); h.regs.push(__C)
  S.rh = 40; setZoom(60, 4); S.selR = []; __daw.redraw()`)
await fine('the set-up is sound')

// ── a crossfade where one side has nothing to run on ──
await ev(`pickTool('smart')`)
{ const p = await at('guitar', 5, .94, 0); await b.dragTo(p.x, p.y, p.x + 60, p.y, 6); await b.sleep(60) }
ok('a crossfade pulled two bars wide where the second file has nothing before its start: the first gives what it has (a bar) and the rest is not made up', await ev(`const o = xfadeOf(__A, __B); return o > 0 && o <= 1 + 1e-9 && __B.a >= 5 - 1e-9 && __B.off >= -1e-9 && __A.b <= 6 + 1e-9 && Math.abs(__A.fo - o) < 1e-9 && Math.abs(__B.fi - o) < 1e-9`), await ev(`return [xfadeOf(__A, __B), __A.b, __B.a, __B.off, __A.fo, __B.fi]`))
await fine('nothing reaches past its file')
// its foot pulled: the join can only go where both have sound
{ const mid = await ev(`return (__A.b + __B.a) / 2`), p = await at('guitar', mid, .94, 0), q = await at('guitar', 8, .94, 0); await b.dragTo(p.x, p.y, q.x, q.y, 8); await b.sleep(60) }
await fine('the crossfade taken along to the right as far as it will go: the first file ends where its sound ends')
ok('the first region never shows more than its file holds', await ev(`return __A.off + (__A.b - __A.a) <= __A.srcBars + 1e-6`), await ev(`return [__A.a, __A.b, __A.off, __A.srcBars, __B.a, __B.off]`))
{ const mid = await ev(`return (__A.b + __B.a) / 2`), p = await at('guitar', mid, .94, 0), q = await at('guitar', 2, .94, 0); await b.dragTo(p.x, p.y, q.x, q.y, 8); await b.sleep(60) }
await fine('and to the left: the second file begins where its sound begins, no earlier')
ok('the second region never begins before its file does', await ev(`return __B.off >= -1e-6`), await ev(`return [__A.a, __A.b, __B.a, __B.b, __B.off]`))
await undo(); await undo(); await undo()
ok('undone: two files meeting at bar five', same(await regs('guitar'), [[1, 5, 0], [5, 9, 0]]) && await ev(`const g = S.tracks.find(t => t.name === 'guitar'); return g.regs.every(r => !r.fi && !r.fo)`), await regs('guitar'))

// ── an edit group whose files are not equally long ──
await ev(`const g = S.tracks.find(t => t.name === 'guitar'), h = S.tracks.find(t => t.name === 'hum'); window.__A = g.regs.slice().sort((x, y) => x.a - y.a)[0]; window.__C = h.regs[0]; edit(() => { g.grp = h.grp = 'a' }); pickTool('pointer'); S.selR = []; __daw.redraw()`)
ok('the first file and the one on the other track lie over the same stretch', await ev(`return companions(__A, S.tracks.find(t => t.name === 'guitar')).length === 1`))
// (the second guitar file stands right after the first: in the smart mode pulling the first's end over it covers it — that is the overlap rule, and it is the limit of the files that is tried here, so the neighbour is taken away first)
await ev(`const g = S.tracks.find(t => t.name === 'guitar'); edit(() => { g.regs = g.regs.filter(r => r.a < 5) }); __daw.redraw()`)
{ const p = await at('guitar', 5, .5, -2), q = await at('guitar', 9, .5); await b.dragTo(p.x, p.y, q.x, q.y, 8); await b.sleep(60) }
ok('an end pulled out on one: both stop where the shorter file ends (a bar on)', await ev(`const a = regOf(__A.id)[0], c = regOf(__C.id)[0]; return Math.abs(a.b - 6) < 1e-9 && Math.abs(c.b - 6) < 1e-9`), [await regs('guitar'), await regs('hum')])
await fine('neither shows more than its file holds')
await undo()
{ const p = await at('hum', 1, .5, 2), q = await at('hum', 1, .5, -200); await b.dragTo(p.x, p.y, q.x, q.y, 8); await b.sleep(60) }
ok('a start pulled out on the other: neither can begin before bar one or before its file', await ev(`const a = regOf(__A.id)[0], c = regOf(__C.id)[0]; return a.a >= 1 - 1e-9 && c.a >= 1 - 1e-9 && a.off >= -1e-9 && c.off >= -1e-9 && Math.abs(a.a - c.a) < 1e-9`), [await regs('guitar'), await regs('hum')])
await fine('sound')
await undo(); await undo(); await undo()

// ── the song's time over files ──
await ev(`timeAct.cut(1, 2)`)
await fine('a bar cut out of the middle of files')
ok('each file is two pieces with a bar of its sound missing between them', same(await regs('hum'), [[1, 2, 1], [2, 4, 3]]) && same((await regs('guitar')).slice(0, 2), [[1, 2, 0], [2, 4, 2]]), [await regs('guitar'), await regs('hum')])
await ev(`timeAct.put(1)`)
ok('put back where it was: whole files again', same(await regs('hum'), [[1, 5, 1]]) && same(await regs('guitar'), [[1, 5, 0], [5, 9, 0]]), [await regs('guitar'), await regs('hum')])
await fine('sound')
await undo(); await undo()

// ── close up on a crossfade and on fades: drawn without numbers too large, and without errors ──
await ev(`const g = S.tracks.find(t => t.name === 'guitar'); const rs = g.regs.slice().sort((x, y) => x.a - y.a); edit(() => { crossfade(rs[0], rs[1], .5); rs[0].fi = 1; rs[1].fo = 2 }); setZoom(1e9, 4); __daw.redraw()`)
await b.sleep(120)
ok('as close as it goes, in the middle of a crossfade: nothing is drawn with a number too large', await ev(`let m = 0; for (const el of document.querySelectorAll('#ln-rows path, #ln-rows rect, #ln-rows g')) for (const a of ['d', 'x', 'width', 'transform']) { const v = el.getAttribute(a); if (v) for (const q of v.match(/-?\\d+(\\.\\d+)?/g) || []) m = Math.max(m, Math.abs(+q)) } return m`) < 20000)
await ev(`VX = 0 + 10 / PXB; __daw.redraw()`); await b.sleep(80)
ok('and at the very start of a long fade', await ev(`let m = 0; for (const el of document.querySelectorAll('#ln-rows path, #ln-rows rect, #ln-rows g')) for (const a of ['d', 'x', 'width', 'transform']) { const v = el.getAttribute(a); if (v) for (const q of v.match(/-?\\d+(\\.\\d+)?/g) || []) m = Math.max(m, Math.abs(+q)) } return m`) < 20000)
await ev(`setMeter(6, 8); __daw.redraw()`); await b.sleep(80)
await fine('the measure changed while close up')
ok('the room is still at a zoom it allows', await ev(`return PXB <= maxPXB() + 1e-6 && PXB >= fitPXB() - 1e-6 && Number.isFinite(VX)`), await ev('return [PXB, maxPXB(), VX]'))
await ev(`setMeter(4, 4); setZoom(0)`)
ok('no errors on the page', (await ev('return window.__errs')).length === 0 && b.errors.length === 0, [await ev('return window.__errs'), b.errors])
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close()
