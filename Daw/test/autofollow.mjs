// node test/autofollow.mjs — a region's lines go with it (his ask, 2026-10-24, as Logic moves automation with regions):
// pulled along the song, the points of its track's lines inside it and on its ends go as far as it goes, the points where it
// lands give way, the ones outside stay; one step of undo puts all back; pulled with option, the points are copied; pulled
// onto another track, they go to that track's line; nudged, they go by the nudge. Real presses.
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined && !cond ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev, ALT = 1
const mouse = (type, x, y, extra = {}) => b.send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' }, extra))
const pull = async (p, q, modifiers = 0) => { await b.sleep(350); await mouse('mouseMoved', p.x, p.y, { buttons: 0, modifiers }); await mouse('mousePressed', p.x, p.y, { modifiers }); for (let k = 1; k <= 8; k++) await mouse('mouseMoved', p.x + (q.x - p.x) * k / 8, p.y + (q.y - p.y) * k / 8, { modifiers }); await b.sleep(30); await mouse('mouseReleased', q.x, q.y, { modifiers }); await b.sleep(150) }
/* a place on a track's row at a bar (1-based), in the window's pixels */
const at = (ti, bar, down = .6) => ev(`flush(); const b0 = board.getBoundingClientRect(), k = b0.width / (W + (SKV.left || 0)); return { x: b0.left + (bx(${bar}) + (SKV.left || 0)) * k, y: b0.top + (rowY(${ti}) + rowH(${ti}) * ${down}) * k }`)
const pts = ti => ev(`return (S.tracks[${ti}].autos.vol || []).map(q => +q.b.toFixed(4))`)
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y)
await ev(`if (typeof START !== 'undefined') START.on = false; tpanelSet(false, false); S.rh = 60; S.auto = false; S.tool = 'pointer'; S.mode = 'smart'; S.snap = 'grid'; setZoom(48, 0); VX = 0; VY = 0
  const aud = S.tracks.filter(t => t.kind === 'audio' && !t.inst && !t.midi), T = aud[0], U = aud[1]; window.TA = S.tracks.indexOf(T); window.TB = S.tracks.indexOf(U)
  const src = T.regs.find(r => !r.notes) || T.regs[0]; T.regs = [Object.assign(cloneReg(src, { a: 5, b: 9 }), { fi: 0, fo: 0 })]; U.regs = []
  T.autos = {}; U.autos = {}; for (const [bb, v] of [[1, -6], [5, 0], [6.5, -12], [8, -3], [9.5, -20]]) addPoint(T, 'vol', bb, v)
  S.selR = []; S.selP = []; dirtyAll(); flush(); return 1`)
const ta = await ev(`return TA`), tb = await ev(`return TB`)
const was = await pts(ta)
ok('set up: points at 1, 5, 6.5, 8, 9.5 (the region from 4 to 8, bars from zero)', same(was, [1, 5, 6.5, 8, 9.5]), was)

/* pulled two bars later */
{ const u0 = await ev(`return UNDO.length`)
  await pull(await at(ta, 6.5), await at(ta, 8.5))
  const r = await ev(`const q = S.tracks[TA].regs[0]; return [q.a, q.b]`), p = await pts(ta)
  ok('pulled two bars later: the region 7 to 11', same(r, [7, 11]), r)
  ok('…its points inside and on its ends went with it (5, 6.5, 8 → 7, 8.5, 10); the one where it landed (9.5) gave way; the one before stayed', same(p, [1, 7, 8.5, 10]), p)
  ok('…one step of undo', await ev(`return UNDO.length`) === u0 + 1)
  await ev(`undoEdit(); flush(); return 1`)
  ok('…undone: region and points as they were', same(await pts(ta), was) && same(await ev(`return [S.tracks[TA].regs[0].a, S.tracks[TA].regs[0].b]`), [5, 9]), await pts(ta)) }

/* pulled with option: copied, points and all */
await pull(await at(ta, 6.5), await at(ta, 12.5), ALT)
{ const p = await pts(ta), n = await ev(`return S.tracks[TA].regs.length`)
  ok('pulled with option: a copy, its points copied with it (the first ones stay)', n === 2 && same(p, [1, 5, 6.5, 8, 9.5, 11, 12.5, 14]), [n, p]) }
await ev(`undoEdit(); flush(); return 1`)

/* pulled onto the next track */
await pull(await at(ta, 6.5), await at(tb, 6.5))
{ const pa = await pts(ta), pb = await pts(tb), on = await ev(`return S.tracks[TB].regs.length`)
  ok('pulled onto another track: its points go to that track\'s line', on === 1 && same(pa, [1, 9.5]) && same(pb, [5, 6.5, 8]), [on, pa, pb]) }
await ev(`undoEdit(); flush(); return 1`)

/* nudged */
await ev(`S.selR = [S.tracks[TA].regs[0].id]; S.nudge = 'bar'; flush(); return 1`)
await b.press('ArrowRight', 'ArrowRight', 39, ALT); await b.sleep(150)
{ const p = await pts(ta), r = await ev(`return S.tracks[TA].regs[0].a`)
  ok('nudged a bar later: its points a bar later too, the one past it stays', r === 6 && same(p, [1, 6, 7.5, 9, 9.5]), [r, p]) }
{ const errs = await ev(`return window.__errs || []`); ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close(); process.exit(bad.length ? 1 : 0)
