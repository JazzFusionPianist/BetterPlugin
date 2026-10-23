// node test/marqfill.mjs — a marquee's stretch put down whole, its empty time too (his ask, 2026-10-23: "marquee 는 말그대로
// 선택툴이기 때문에, 빈공간을 같이 선택하더라도, 복사하고 붙여넣을때 같은 위치에 빈공간이 있어야해"): pasted, on every row it
// covered, what stood there over its length gives way — under its empty time as under what it held; command r the same; a
// stretch with nothing in it empties where it goes; one step back puts all of it back. Regions chosen and pasted are as before.
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev, CMD = 4
const key = (k, code, vk, m = 0) => b.press(k, code, vk, m)
/* two tracks: A has a region inside the stretch [1, 4) (bars from zero) and one at [4, 8); B has nothing in the stretch and one at [4, 8) */
const setUp = () => ev(`if (typeof START !== 'undefined') START.on = false; setView(true); S.tool = 'pointer'; S.mode = 'slip'
  const vis = rows(), idx = vis.filter(i => S.tracks[i].kind === 'audio' && !S.tracks[i].inst && S.tracks[i].regs.length).slice(0, 2), [A, B] = idx.map(i => S.tracks[i]), src = A.regs[0]
  window.__A = A; window.__B = B; window.__src = src
  A.regs = [cloneReg(src, { a: 2, b: 3, fi: 0, fo: 0 }), cloneReg(src, { a: 5, b: 9, fi: 0, fo: 0 })]; B.regs = [cloneReg(src, { a: 5, b: 9, fi: 0, fo: 0 })]
  S.selR = []; S.marq = { a: 1, b: 4, t0: idx[0], t1: idx[1] }; marqMates(); S.focus = 'lanes'; flush(); return idx`)
const spans = () => ev(`const f = t => t.regs.map(r => [+(r.a - 1).toFixed(4), +(r.b - 1).toFixed(4)]).sort((p, q) => p[0] - q[0]); return { A: f(__A), B: f(__B) }`)

await setUp()
await key('c', 'KeyC', 67, CMD); await key('v', 'KeyV', 86, CMD); await b.sleep(80)
{ const s = await spans()
  ok('pasted right after itself: on A, what it held, then its empty time — the region that stood there gives way over it', JSON.stringify(s.A) === JSON.stringify([[1, 2], [4, 5], [7, 8]]), s.A)
  ok('…and on B, where it held nothing, nothing over its whole length', JSON.stringify(s.B) === JSON.stringify([[7, 8]]), s.B)
  ok('the marquee lies over what was put down', JSON.stringify(await ev(`return [S.marq.a, S.marq.b]`)) === '[4,7]') }
await key('z', 'KeyZ', 90, CMD); await b.sleep(60)
{ const s = await spans()
  ok('one step back: as it was', JSON.stringify(s) === JSON.stringify({ A: [[1, 2], [4, 8]], B: [[4, 8]] }), s) }

/* command r: the same */
await setUp()
await key('r', 'KeyR', 82, CMD); await b.sleep(80)
{ const s = await spans()
  ok('command r: said again right after itself, empty time and all', JSON.stringify(s) === JSON.stringify({ A: [[1, 2], [4, 5], [7, 8]], B: [[7, 8]] }), s) }

/* a stretch with nothing in it */
await ev(`__A.regs = [cloneReg(__src, { a: 5, b: 9, fi: 0, fo: 0 })]; __B.regs = [cloneReg(__src, { a: 5, b: 9, fi: 0, fo: 0 })]; S.marq = Object.assign({}, S.marq, { a: 1, b: 3 }); flush(); return 1`)
await key('c', 'KeyC', 67, CMD); await ev(`S.marq = Object.assign({}, S.marq, { a: 5, b: 6 }); flush(); return 1`); await key('v', 'KeyV', 86, CMD); await b.sleep(80)
{ const s = await spans()
  ok('a stretch with nothing in it, put down at a marquee drawn elsewhere: it empties two bars there', JSON.stringify(s) === JSON.stringify({ A: [[4, 5], [7, 8]], B: [[4, 5], [7, 8]] }), s) }

/* regions chosen (no marquee): as before — what is pasted covers its own stretch only */
await ev(`__A.regs = [cloneReg(__src, { a: 2, b: 3, fi: 0, fo: 0 }), cloneReg(__src, { a: 5, b: 9, fi: 0, fo: 0 })]; __B.regs = [cloneReg(__src, { a: 5, b: 9, fi: 0, fo: 0 })]; S.marq = null; S.selR = [__A.regs[0].id]; S.sel = S.tracks.indexOf(__A); S.pos = 4.5; flush(); return 1`)
await key('c', 'KeyC', 67, CMD); await key('v', 'KeyV', 86, CMD); await b.sleep(80)
{ const s = await spans()
  ok('a region chosen and pasted at the playhead covers its own bar, no more', JSON.stringify(s.A) === JSON.stringify([[1, 2], [4, 4.5], [4.5, 5.5], [5.5, 8]]) && JSON.stringify(s.B) === JSON.stringify([[4, 8]]), s) }

ok('no errors on the page', !b.errors.length, b.errors.slice(0, 3))
console.log(out.join('\n'))
console.log(bad.length ? `\n${bad.length} failed` : '\nall passed')
await b.close()
process.exit(bad.length ? 1 : 0)
