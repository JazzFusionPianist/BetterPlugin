// node test/autoseg.mjs — a line taken hold of away from its points: pressed and let go in place, a point is set there (as
// before); pulled, the stretch of line goes up or down whole and no point is made under the hand. Which stretch: under a
// marquee that lies on the track, the marquee's stretch (a step at each of its ends, the line outside it as it was); else
// from the point before to the point after; a line with no point yet moves whole. One step of undo each.
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const mouse = (type, x, y, extra = {}) => b.send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' }, extra))
const pull = async (x0, y0, x1, y1) => { await mouse('mouseMoved', x0, y0, { buttons: 0 }); await mouse('mousePressed', x0, y0); for (let k = 1; k <= 6; k++) await mouse('mouseMoved', x0 + (x1 - x0) * k / 6, y0 + (y1 - y0) * k / 6); await b.sleep(40); await mouse('mouseReleased', x1, y1); await b.sleep(60) }
await ev(`if (typeof START !== 'undefined') START.on = false; setView(true); S.rh = 60; S.auto = true; S.tool = 'pointer'; S.marq = null; S.selP = []; S.selR = []
  window.TI = S.tracks.findIndex(t => t.name === 'snare'); const t = S.tracks[TI]; t.ap = 'vol'; t.autos = {}; t.vol = -6; VY = 0; setZoom(0); if (typeof keepNow === 'function') keepNow('opened'); dirtyAll(); flush()`)
/* where the snare's line is on the screen at a bar (from zero), and what it reads there */
const on = bar => ev(`flush(); const t = S.tracks[TI], g = autoGeom(t, rowY(TI), rowH(TI)), k = board.getBoundingClientRect().width / W, v = autoAt(t, 'vol', ${bar}); return { x: bx(${bar} + 1) * k, y: g.yOf(v == null ? t.vol : v) * k, v: v == null ? t.vol : v }`)
const line = () => ev(`const t = S.tracks[TI]; return { pts: (t.autos.vol || []).map(q => [+q.b.toFixed(3), +q.v.toFixed(2)]), sel: S.selP.length, vol: t.vol, undo: UNDO.length }`)

/* a line with no point yet: pulled, the whole of it moves */
{ const p = await on(10), u0 = (await line()).undo
  await pull(p.x, p.y, p.x + 30, p.y + 14)
  const s = await line()
  ok('a level line pulled down: it gets one point, at the beginning, and the whole line is lower', s.pts.length === 1 && s.pts[0][0] === 0 && s.pts[0][1] < -6.5, s.pts)
  ok('…in one step of undo', s.undo === u0 + 1, [u0, s.undo])
  await ev(`undoEdit(); flush()`)
  ok('undone: no point again', (await line()).pts.length === 0, (await line()).pts) }

/* pressed and let go in place: a point */
{ const p = await on(8)
  await mouse('mouseMoved', p.x, p.y, { buttons: 0 }); await mouse('mousePressed', p.x, p.y); await b.sleep(30); await mouse('mouseReleased', p.x, p.y); await b.sleep(60)
  const s = await line()
  ok('pressed and let go in place: a point there, at the line’s level, chosen', s.pts.length === 1 && Math.abs(s.pts[0][0] - 8) < .05 && s.pts[0][1] === -6 && s.sel === 1, s) }

/* between two points */
{ await ev(`const t = S.tracks[TI]; t.autos.vol = []; addPoint(t, 'vol', 4, -6); addPoint(t, 'vol', 12, -3); addPoint(t, 'vol', 20, -9); addPoint(t, 'vol', 30, -6); S.selP = []; dirtyAll(); flush()`)
  const p = await on(16), s0 = await line()
  await mouse('mouseMoved', p.x, p.y, { buttons: 0 }); await mouse('mousePressed', p.x, p.y)
  for (let k = 1; k <= 5; k++) await mouse('mouseMoved', p.x + k * 8, p.y + k * 3)
  await b.sleep(50)
  const mid = await ev(`flush(); const t = S.tracks[TI]; return { pts: t.autos.vol.map(q => [+q.b.toFixed(3), +q.v.toFixed(2)]), drawn: document.querySelector('#g-lanes') ? document.querySelectorAll('#g-lanes circle').length : -1 }`)
  await mouse('mouseReleased', p.x + 40, p.y + 15); await b.sleep(60)
  const s = await line()
  ok('the line pulled down between two points: no point is made under the hand', s.pts.length === 4, s.pts)
  ok('…the two points at its ends go down by the same, and stay where they are along the song', s.pts[1][0] === 12 && s.pts[2][0] === 20 && s.pts[1][1] < s0.pts[1][1] - .5 && s.pts[2][1] < s0.pts[2][1] - .5, [s0.pts, s.pts])
  ok('…it is already lower while the button is still down', mid.pts[1][1] < s0.pts[1][1] - .5, mid.pts)
  ok('…and the points beyond them are as they were', s.pts[0][1] === -6 && s.pts[3][1] === -6, s.pts)
  await ev(`undoEdit(); flush()`)
  ok('one step of undo puts it back', JSON.stringify((await line()).pts) === JSON.stringify(s0.pts), (await line()).pts) }

/* under a marquee */
{ await ev(`S.marq = { a: 14, b: 18, t0: TI, t1: TI }; S.selP = []; dirtyAll(); flush()`)
  const p = await on(16), before = await ev(`const t = S.tracks[TI]; return [13, 14, 16, 18, 19].map(x => +autoAt(t, 'vol', x).toFixed(2))`)
  await pull(p.x, p.y, p.x, p.y + 16)
  const s = await line(), after = await ev(`const t = S.tracks[TI]; return [13, 13.99, 14.05, 16, 17.95, 18.01, 19].map(x => +autoAt(t, 'vol', x).toFixed(2))`)
  ok('under a marquee: a point at each end of it to hold the line outside, and one just inside each end', s.pts.length === 8 && s.pts.filter(q => Math.abs(q[0] - 14) < .01).length === 2 && s.pts.filter(q => Math.abs(q[0] - 18) < .01).length === 2, s.pts)
  ok('…the stretch under it is lower by the same all along', after[2] < before[1] - .5 && after[3] < before[2] - .5 && after[4] < before[3] - .5 && Math.abs((before[2] - after[3]) - (before[1] - after[2])) < .8, [before, after])
  ok('…and the line outside it is as it was', after[0] === before[0] && after[6] === before[4] && Math.abs(after[1] - before[1]) < .05 && Math.abs(after[5] - before[3]) < .05, [before, after])
  ok('the two old points outside did not move', s.pts.some(q => q[0] === 12 && q[1] === -3) && s.pts.some(q => q[0] === 20 && q[1] === -9), s.pts)
  await ev(`undoEdit(); flush()`)
  ok('one step of undo puts it back', (await line()).pts.length === 4, (await line()).pts) }

/* a point itself is still moved as a point */
{ await ev(`S.marq = null; S.selP = []; dirtyAll(); flush()`)
  const p = await ev(`flush(); const t = S.tracks[TI], g = autoGeom(t, rowY(TI), rowH(TI)), k = board.getBoundingClientRect().width / W; return { x: bx(12 + 1) * k, y: g.yOf(-3) * k }`)
  await pull(p.x, p.y, p.x + 40, p.y + 6)
  const s = await line()
  ok('a point taken hold of goes where it is pulled, along the song too', s.pts.length === 4 && s.pts[1][0] > 12.3 && s.pts[1][1] < -3, s.pts) }

{ const errs = await ev(`return window.__errs || []`)
  ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n'))
console.log(bad.length ? `autoseg: ${bad.length} FAILED\n  ${bad.join('\n  ')}` : 'autoseg: all passed')
await b.close()
process.exit(bad.length ? 1 : 0)
