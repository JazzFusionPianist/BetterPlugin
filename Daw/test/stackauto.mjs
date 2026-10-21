// node test/stackauto.mjs — a stack's own line works as a track's (his report, 2026-10-21): it is drawn a step lighter
// than its colour and thicker; with no points on it, a marquee drawn over its lane and the pointer pulled inside it
// (not on the line) takes the marquee's stretch up or down whole — not a point where it was pressed — with the lines
// shown or not; points chosen and deleted all go, a marquee up or not; a marquee over its points, deleted, takes them.
// Real presses; what the line holds is read back.
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined && !cond ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const mouse = (type, x, y, extra = {}) => b.send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' }, extra))
const pull = async (x0, y0, x1, y1) => { await mouse('mouseMoved', x0, y0, { buttons: 0 }); await mouse('mousePressed', x0, y0); for (let k = 1; k <= 6; k++) await mouse('mouseMoved', x0 + (x1 - x0) * k / 6, y0 + (y1 - y0) * k / 6); await b.sleep(40); await mouse('mouseReleased', x1, y1); await b.sleep(120) }
await ev(`if (typeof START !== 'undefined') START.on = false; setView(true); S.rh = 50; S.auto = false; S.tool = 'pointer'; S.marq = null; S.selP = []; S.selR = []
  const ts = ['kick', 'snare'].map(n => S.tracks.find(t => t.name === n)); S.sel = S.tracks.indexOf(ts[0]); S.selT = ts.map(t => t.id); S.focus = 'tracks'
  makeStack(); window.SI = S.sel; const st = S.tracks[SI]; st.name = 'drums'; st.autos = {}; st.vol = -6; VY = 0; setZoom(0); dirtyAll(); flush(); return 1`)
const line = () => ev(`const t = S.tracks[SI]; return { pts: (t.autos.vol || []).map(q => [+q.b.toFixed(3), +q.v.toFixed(2)]), sel: S.selP.length, undo: UNDO.length }`)
/* a place in the stack's lane, in the window's pixels: at a bar (from zero), so far down its row */
const at = (bar, down) => ev(`flush(); const k = board.getBoundingClientRect().width / (W + (SKV.left || 0)), y = rowY(SI) + rowH(SI) * ${down}; return { x: (bx(${bar} + 1) + (SKV.left || 0)) * k, y: y * k }`)
/* the line as drawn */
const drawn = await ev(`flush(); const t = S.tracks[SI], el = [...document.querySelectorAll('#ln-rows path')].find(p => p.getAttribute('stroke') === (t.csel || t.c)); return el ? { stroke: el.getAttribute('stroke'), w: +el.getAttribute('stroke-width'), c: t.c, csel: t.csel } : null`)
ok('the stack\'s line: a step lighter than its colour, and thicker', !!drawn && drawn.stroke === drawn.csel && drawn.csel !== drawn.c && drawn.w >= 1.8, drawn)
for (const shown of [false, true]) {
  const how = shown ? 'the lines shown' : 'the lines not shown'
  await ev(`S.auto = ${shown}; const t = S.tracks[SI]; t.autos = {}; t.ap = 'vol'; S.selP = []; S.marq = { a: 8, b: 12, t0: SI, t1: SI, also: [] }; dirtyAll(); flush(); return 1`)
  const p = await at(10, .85), u0 = (await line()).undo                             // (inside the marquee, well under the line)
  await pull(p.x, p.y, p.x + 6, p.y - 14)
  const s = await line()
  ok(`${how}: the pointer pulled inside a marquee on the stack's lane takes its stretch, not a point where it was pressed`, s.pts.length === 4 && s.pts[0][0] === 8 && s.pts[3][0] === 12 && s.pts[1][1] > -6 && s.pts[2][1] > -6 && s.pts[0][1] === -6, s.pts)
  ok(`${how}: …in one step of undo`, s.undo === u0 + 1, [u0, s.undo])
  /* chosen and deleted, a marquee up or not */
  await ev(`const t = S.tracks[SI]; S.selP = t.autos.vol.map(q => q.id); S.focus = 'lanes'; S.marq = ${shown ? 'null' : '{ a: 8, b: 12, t0: SI, t1: SI, also: [] }'}; dirtyAll(); flush(); return 1`)
  await b.press('Backspace', 'Backspace', 8); await b.sleep(120)
  ok(`${how}: its points chosen and deleted: all gone`, (await line()).pts.length === 0, (await line()).pts)
}
/* a marquee over its points, the lines not shown, deleted: they go */
await ev(`S.auto = false; const t = S.tracks[SI]; t.autos = {}; addPoint(t, 'vol', 9, -12); addPoint(t, 'vol', 9.01, -3); addPoint(t, 'vol', 20, -9); S.selP = []; S.focus = 'lanes'; S.marq = { a: 8, b: 12, t0: SI, t1: SI, also: [] }; dirtyAll(); flush(); return 1`)
await b.press('Backspace', 'Backspace', 8); await b.sleep(120)
{ const s = await line(); ok('the lines not shown: a marquee over its points, deleted, takes those in its stretch', s.pts.length === 1 && s.pts[0][0] === 20, s.pts) }
/* one point of a step chosen and deleted: the step goes whole */
await ev(`const t = S.tracks[SI]; t.autos = {}; addPoint(t, 'vol', 9, -12); const q = addPoint(t, 'vol', 9.01, -3); addPoint(t, 'vol', 20, -9); S.selP = [q.id]; S.marq = null; S.focus = 'lanes'; dirtyAll(); flush(); return 1`)
await b.press('Backspace', 'Backspace', 8); await b.sleep(120)
{ const s = await line(); ok('one point of a step chosen and deleted: both of the step go', s.pts.length === 1 && s.pts[0][0] === 20, s.pts) }
{ const errs = await ev(`return window.__errs || []`); ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close(); process.exit(bad.length ? 1 : 0)
