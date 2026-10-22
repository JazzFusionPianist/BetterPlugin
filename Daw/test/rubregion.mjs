// node test/rubregion.mjs — rubato is a region's own (his word, 2026-10-22: one turned on turned every track on): with a
// region chosen the key turns rubato on for it alone (and shows the view); in the view only it shows where things begin
// and takes pins — the other plays and is pulled as it is; the square at a region's foot turns it on or off; off, its
// pins are kept, and it plays plain; on again, they are back; with nothing chosen the key only shows or hides the view;
// kept with the project. Real presses where it matters.
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined && !cond ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const mouse = (type, x, y, extra = {}) => b.send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' }, extra))
const pull = async (x0, y0, x1, y1) => { await b.sleep(400); await mouse('mouseMoved', x0, y0, { buttons: 0 }); await mouse('mousePressed', x0, y0); for (let k = 1; k <= 6; k++) await mouse('mouseMoved', x0 + (x1 - x0) * k / 6, y0 + (y1 - y0) * k / 6); await b.sleep(30); await mouse('mouseReleased', x1, y1); await b.sleep(120) }
await ev(`if (typeof START !== 'undefined') START.on = false; tpanelSet(false, false)
  S.rh = 60; setZoom(48, 0); S.tool = 'flex'; S.flex = false; S.auto = false; S.snap = false; VX = 0; VY = 0
  const spb = SPB(), sec = 4 * spb, N = Math.round(sec * 100), pk = new Float32Array(N); for (let k = 0; k < 4; k++) pk[Math.round(k * spb * 100) + 3] = .9
  const aud = S.tracks.filter(t => t.kind === 'audio' && !t.inst), tA = aud[0], tB = aud[1]
  const mk = () => mkReg({ a: 1, b: 5, key: 'file:clicks', file: 'clicks.wav', peaksAll: pk, loop: false, rate: 1, sec, srcBars: 4 })
  tA.regs = [mk()]; tB.regs = [mk()]; tA.grp = ''; tB.grp = ''
  TRANS.clear(); TRANS_ALL.clear(); heardTransients('file:clicks', [0, 1, 2, 3].map(k => ({ s: k * spb + .03, k: 0, v: 1 })))
  window.RA = tA.regs[0]; window.RB = tB.regs[0]; window.IA = S.tracks.indexOf(tA); window.IB = S.tracks.indexOf(tB)
  S.sel = IA; S.selR = [RA.id]; S.focus = 'lanes'; dirtyAll(); flush(); return 1`)
const st = () => ev(`return { flex: S.flex, a: rubatoOn(RA), b: rubatoOn(RB), pa: (RA.flex || []).length, pb: (RB.flex || []).length, ka: (RA.flexOff || []).length }`)
/* the key, with A chosen */
await ev(`toggleFlex(); flush(); return 1`)
{ const s = await st(); ok('the key with a region chosen: rubato on for it alone, the view shown', s.flex && s.a && !s.b, s) }
ok('in the view: where things begin drawn on it, not on the other', await ev(`flush(); const L = LANES.rows; const ga = L.get(S.tracks[IA].id), gb = L.get(S.tracks[IB].id); return !!ga && !!gb && ga.html.includes('M') && ga.html.length > gb.html.length`))
/* a pin pulled on A; the same on B pulls nothing of it */
const xy = (i, bar, down = .5) => ev(`flush(); const b0 = board.getBoundingClientRect(), k = b0.width / (W + (SKV.left || 0)); return { x: b0.left + (bx(${bar}) + (SKV.left || 0)) * k, y: b0.top + (rowY(${i}) + rowH(${i}) * ${down}) * k }`)
const ia = await ev(`return IA`), ib = await ev(`return IB`)
{ const p = await xy(ia, 2 + .03 / await ev(`return SPB()`)); await pull(p.x, p.y, p.x + 20, p.y) }
{ const s = await st(); ok('on it: a pin is pulled', s.pa >= 1, s) }
{ const p = await xy(ib, 2 + .03 / await ev(`return SPB()`)); await pull(p.x, p.y, p.x + 20, p.y) }
{ const s = await st(); ok('on the other (rubato off): no pin', s.pb === 0, s) }
/* the square at B's foot */
{ const p = await ev(`flush(); const b0 = board.getBoundingClientRect(), k = b0.width / (W + (SKV.left || 0)), gap = Math.min(lkN('reg.gap'), rowH(IB) / 2 - 4), g = rubatoBoxAt(RB, rowY(IB) + gap, rowH(IB) - 2 * gap); return { x: b0.left + (g.x + g.w / 2 + (SKV.left || 0)) * k, y: b0.top + (g.y + g.h / 2) * k }`)
  await pull(p.x, p.y, p.x, p.y)
  ok('the square at the other\'s foot pressed: rubato on for it too', (await st()).b === true, await st())
  await pull(p.x, p.y, p.x, p.y)
  ok('…pressed again: off', (await st()).b === false, await st()) }
/* off: pins kept, played plain; on again: back */
await ev(`S.selR = [RA.id]; toggleFlex(); flush(); return 1`)
{ const s = await st(); ok('the key again with it chosen: off, its pins kept aside, nothing stretched', !s.a && s.pa === 0 && s.ka >= 1 && !(await ev(`return warped(RA)`)), s) }
await ev(`toggleFlex(); flush(); return 1`)
{ const s = await st(); ok('…and on again: its pins back', s.a && s.pa >= 1 && s.ka === 0, s) }
/* pressed twice where there is no pin: one is set there, the sound left as it lies; twice on it: gone */
{ const twice = async q => { await b.sleep(450); for (let k = 0; k < 2; k++) { await mouse('mouseMoved', q.x, q.y, { buttons: 0 }); await mouse('mousePressed', q.x, q.y, { clickCount: k + 1 }); await mouse('mouseReleased', q.x, q.y, { clickCount: k + 1 }); await b.sleep(60) } await b.sleep(150) }
  await ev(`S.tool = 'pointer'; S.flex = true; flush(); return 1`)
  const spot = await ev(`flush(); const far = b => (RA.flex || []).every(m => Math.abs(xOfD(RA, m.d) - bx(b)) > 15) && transOf(RA).every(t => Math.abs(xOfD(RA, sToD(RA, t)) - bx(b)) > 15); return [1.6, 2.6, 3.6, 4.6, 1.3, 2.3, 3.3, 4.3].find(far) || 0`)      // (a place with no pin and nothing heard near it)
  const n0 = (await st()).pa, q = await xy(ia, spot), at0 = await ev(`return dToS(RA, dOfBar(RA, ${spot - 1}))`)
  await twice(q)
  const s1 = await st(), same = await ev(`return Math.abs(dToS(RA, dOfBar(RA, ${spot - 1})) - ${at0}) < 1e-6`)
  ok('pressed twice where it has no pin: one is set there, and nothing moves', spot > 0 && s1.pa === n0 + 1 && same, [spot, n0, s1, same])
  const q2 = await ev(`flush(); const m = RA.flex.find(x => Math.abs(x.s - ${at0}) < .05) || RA.flex[RA.flex.length - 1], b0 = board.getBoundingClientRect(), k = b0.width / (W + (SKV.left || 0)); return { x: b0.left + (xOfD(RA, m.d) + (SKV.left || 0)) * k, y: b0.top + (rowY(IA) + rowH(IA) * .5) * k }`)
  await twice(q2)
  ok('…pressed twice on it: it lets go', (await st()).pa === n0, await st()) }
/* nothing chosen: the view only */
await ev(`S.selR = []; flush(); return 1`)
{ const before = await st(); await ev(`toggleFlex(); flush(); return 1`); const s = await st(); ok('nothing chosen: the key only shows or hides the view', s.flex === !before.flex && s.a === before.a && s.b === before.b, [before, s]) }
/* kept */
{ const k = await ev(`const d = JSON.parse(serialize()), rs = d.tracks.flatMap(t => t.regs || []); return rs.filter(r => r.rub).length`)
  ok('kept with the project', k >= 1, k) }
{ const errs = await ev(`return window.__errs || []`); ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close(); process.exit(bad.length ? 1 : 0)
