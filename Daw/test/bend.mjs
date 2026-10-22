// node test/bend.mjs — fades and lines bent (his asks, 2026-10-22): a fade of its own falls as the ear hears an even fall
// (bent .66), half of a crossfade stays straight; control and a pull up or down on a fade bends it (up: fuller sooner),
// one step of undo; control and a pull on a line between two points bends that stretch (up: it
// rises there). Real presses with real modifiers.
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined && !cond ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev, CTRL = 2
const mouse = (type, x, y, extra = {}) => b.send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' }, extra))
const pull = async (x0, y0, dx, dy, modifiers = 0) => { await b.sleep(400); await mouse('mouseMoved', x0, y0, { buttons: 0, modifiers }); await mouse('mousePressed', x0, y0, { modifiers }); for (let k = 1; k <= 10; k++) await mouse('mouseMoved', x0 + dx * k / 10, y0 + dy * k / 10, { modifiers }); await b.sleep(30); await mouse('mouseReleased', x0 + dx, y0 + dy, { modifiers }); await b.sleep(150) }
const toPage = (x, y) => ev(`const b0 = board.getBoundingClientRect(), k = b0.width / (W + (SKV.left || 0)); return { x: b0.left + (${x} + (SKV.left || 0)) * k, y: b0.top + ${y} * k }`)
await ev(`if (typeof START !== 'undefined') START.on = false; S.rh = 60; S.auto = false; S.tool = 'fade'; setZoom(48, 0); VX = 0; VY = 0
  const t = S.tracks.find(x => x.name === 'hum'); window.TI = S.tracks.indexOf(t); t.regs.sort((p, q) => p.a - q.a); window.RG = t.regs[0]; RG.fo = 1.5; RG.fi = 0; dirtyAll(); flush(); return 1`)

/* the default: a fade of its own is bent; half of a crossfade is not */
ok('a fade of its own falls as the ear hears an even fall (bent)', await ev(`return fadeBend(RG, false) === FADE_BEND`), await ev(`return fadeBend(RG, false)`))
ok('…straight it would be loud nearly to the end; bent, a quarter of the way from its end it is well down', await ev(`return fadeShape(0, .25) > .2 && fadeShape(0, .25, FADE_BEND) < .05`))
{ const r = await ev(`const t = S.tracks[TI], rs = t.regs.slice().sort((p, q) => p.a - q.a); for (let i = 0; i + 1 < rs.length; i++) if (xfadeOf(rs[i], rs[i + 1])) return [fadeBend(rs[i], false, t), fadeBend(rs[i + 1], true, t)]; const A = mkReg({ a: 30, b: 34, buf: RG.buf, loop: true, off: 0 }), B = mkReg({ a: 33, b: 37, buf: RG.buf, loop: true, off: 0 }); A.fo = 1; B.fi = 1; t.regs.push(A, B); const o = [xfadeOf(A, B) ? fadeBend(A, false, t) : 'none', xfadeOf(A, B) ? fadeBend(B, true, t) : 'none']; t.regs = t.regs.filter(x => x !== A && x !== B); return o`)
  ok('half of a crossfade stays straight', r[0] === 0 && r[1] === 0, r) }
/* control and a pull up on the fade: fuller sooner (its bend goes down); down: quieter longer */
{ const u0 = await ev(`return UNDO.length`), p = await ev(`flush(); return { x: bx(RG.b) - 20, y: rowY(TI) + rowH(TI) * .5 }`), q = await toPage(p.x, p.y)
  await pull(q.x, q.y, 0, -40, CTRL)
  const r1 = await ev(`return [RG.fob, RG.fo, UNDO.length, fadeBend(RG, false)]`)
  ok('control and a pull up on a fade: bent fuller (less than it was), its length as it was, one step', r1[0] < .66 && r1[1] === 1.5 && r1[2] === u0 + 1 && r1[3] === r1[0], r1)
  await pull(q.x, q.y, 0, 60, CTRL)
  const r2 = await ev(`return RG.fob`)
  ok('…pulled down: quieter longer (more than it was)', r2 > r1[0], [r1[0], r2])
  await ev(`undoEdit(); undoEdit(); flush(); return 1`)
  ok('…undone twice: as it was', await ev(`const r = regOf(RG.id)[0]; return r.fob == null && r.fo === 1.5`), await ev(`const r = regOf(RG.id)[0]; return [r.fob, r.fo]`)) }      // (an undo brings back another object with the same id)
/* a line's stretch: control and a pull up bends it */
await ev(`S.tool = 'pointer'; S.auto = true; const t = S.tracks[TI]; t.ap = 'vol'; t.autos = {}; addPoint(t, 'vol', 4, 0); addPoint(t, 'vol', 12, -24); S.selP = []; dirtyAll(); flush(); return 1`)
{ const mid0 = await ev(`return autoAt(S.tracks[TI], 'vol', 8)`), p = await ev(`flush(); const t = S.tracks[TI], g = autoGeom(t, rowY(TI), rowH(TI)); return { x: bx(9), y: g.yOf(autoAt(t, 'vol', 8)) }`), q = await toPage(p.x, p.y)
  await pull(q.x, q.y, 0, -40, CTRL)
  const r = await ev(`const t = S.tracks[TI]; return { mid: autoAt(t, 'vol', 8), c: t.autos.vol[0].c, pts: t.autos.vol.length, sent: autoMsg(t)[0].pts.length }`)
  ok('control and a pull up between two points: the stretch bent upward there, no point added, told to the engine as a bent run', r.mid > mid0 + 1 && typeof r.c === 'number' && r.pts === 2 && r.sent > 2, [mid0, r]) }
{ const errs = await ev(`return window.__errs || []`); ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close(); process.exit(bad.length ? 1 : 0)
