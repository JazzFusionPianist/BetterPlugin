// node test/fades.mjs — a fade pulled on one of several chosen regions is given to all of them: with the fade tool, with
// control and shift held under the pointer, and at the smart tool's corner; each as long, as far as it has room; they stay
// chosen; one step of undo; with option, the fade comes off all of them. One region alone is as before.
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const mouse = (type, x, y, extra = {}) => b.send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' }, extra))
const pull = async (x0, y0, x1, y1, mods = 0) => { await mouse('mouseMoved', x0, y0, { buttons: 0, modifiers: mods }); await mouse('mousePressed', x0, y0, { modifiers: mods }); for (let k = 1; k <= 6; k++) await mouse('mouseMoved', x0 + (x1 - x0) * k / 6, y0 + (y1 - y0) * k / 6, { modifiers: mods }); await b.sleep(40); await mouse('mouseReleased', x1, y1, { modifiers: mods }); await b.sleep(80) }
await ev(`if (typeof START !== 'undefined') START.on = false; setView(true); S.rh = 40; VY = 0; S.auto = false; S.mode = 'slip'; setZoom(0); dirtyAll(); flush()
  const pick = (n, k) => S.tracks.find(t => t.name === n).regs.filter(r => r.file || r.loop).sort((a, b) => a.a - b.a)[k]
  window.IDS = [pick('kick', 0), pick('snare', 0), pick('guitar', 1)].map(r => r.id); window.R3 = () => IDS.map(id => regOf(id)[0]); for (const r of R3()) { r.fi = 0; r.fo = 0 }`)      // (by id: an undo puts other objects in their places)
const fades = () => ev(`return { fi: R3().map(r => +(r.fi || 0).toFixed(3)), fo: R3().map(r => +(r.fo || 0).toFixed(3)), sel: S.selR.length, all: IDS.every(id => S.selR.includes(id)), undo: UNDO.length }`)
const at = (k, f, fy = .5) => ev(`flush(); const r = R3()[${k}], [, t] = regOf(r.id), i = S.tracks.indexOf(t), kk = board.getBoundingClientRect().width / W; return { x: (bx(r.a) + (bx(r.b) - bx(r.a)) * ${f}) * kk, y: (rowY(i) + rowH(i) * ${fy}) * kk, bar: (bx(r.b) - bx(r.a)) * kk / (r.b - r.a) }`)
const choose = () => ev(`S.selR = IDS.slice(); S.selX = null; S.focus = 'lanes'; dirtyAll(); flush()`)

/* the fade tool */
await ev(`pickTool('fade')`); await choose()
{ const p = await at(0, .05), u0 = (await fades()).undo
  await pull(p.x, p.y, p.x + p.bar * .5, p.y)
  const s = await fades()
  ok('the fade tool, pulled in the first half of one of three chosen regions: all three fade in', s.fi.every(v => v > .3) && Math.abs(s.fi[0] - s.fi[1]) < .01 && Math.abs(s.fi[0] - s.fi[2]) < .01, s.fi)
  ok('…they stay chosen, and it is one step of undo', s.all && s.sel === 3 && s.undo === u0 + 1, [s.sel, s.undo - u0])
  const q = await at(1, .95)
  await pull(q.x, q.y, q.x - q.bar * .75, q.y)
  const s2 = await fades()
  ok('pulled in the second half of another of them: all three fade out, the fades in as they were', s2.fo.every(v => v > .5) && JSON.stringify(s2.fi) === JSON.stringify(s.fi), s2)
  await ev(`undoEdit(); undoEdit(); flush()`)
  ok('undone twice: no fades', (await fades()).fi.every(v => v === 0) && (await fades()).fo.every(v => v === 0), await fades()) }

/* with option, off all of them */
{ await ev(`for (const r of R3()) { r.fi = .5; dirtyReg(r) } dirtyAll(); flush()`); await choose()
  const p = await at(2, .1)
  await b.click(p.x, p.y, 1); await b.sleep(80)
  ok('with option, pressed on one of them: the fade comes off all three', (await fades()).fi.every(v => v === 0), (await fades()).fi) }

/* control and shift under the pointer tool */
{ await ev(`pickTool('pointer')`); await choose()
  const p = await at(1, .08)
  await pull(p.x, p.y, p.x + p.bar * .4, p.y, 2 | 8)
  const s = await fades()
  ok('the pointer with control and shift held: the same, on all that are chosen', s.fi.every(v => v > .2) && s.all, s.fi)
  await ev(`undoEdit(); flush()`) }

/* the smart tool's corner */
{ await ev(`pickTool('smart')`); await choose()
  const z = await ev(`flush(); const r = R3()[0], [, t] = regOf(r.id), i = S.tracks.indexOf(t), kk = board.getBoundingClientRect().width / W; for (let dx = 1; dx < 14; dx++) for (let dy = 1; dy < 14; dy++) { const q = smartZone(i, { x: bx(r.a) + dx, y: rowY(i) + dy }); if (q.z === 'fi' && q.r === r) return { x: (bx(r.a) + dx) * kk, y: (rowY(i) + dy) * kk, bar: (bx(r.b) - bx(r.a)) * kk / (r.b - r.a) } } return null`)
  if (z) { await pull(z.x, z.y, z.x + z.bar * .4, z.y); const s = await fades(); ok('the smart tool, at the top corner of one of them: all that are chosen', s.fi.every(v => v > .2) && s.all, s.fi); await ev(`undoEdit(); flush()`) }
  else ok('the smart tool has a corner for a fade', false) }

/* one alone, as before */
{ await ev(`pickTool('fade'); for (const r of R3()) { r.fi = 0; dirtyReg(r) } S.selR = [IDS[1], IDS[2]]; dirtyAll(); flush()`)
  const p = await at(0, .05)
  await pull(p.x, p.y, p.x + p.bar * .5, p.y)
  const s = await fades()
  ok('a region that is not among the chosen ones: it alone fades, and it alone is chosen', s.fi[0] > .3 && s.fi[1] === 0 && s.fi[2] === 0 && s.sel === 1, s) }

{ const errs = await ev(`return window.__errs || []`)
  ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n'))
console.log(bad.length ? `fades: ${bad.length} FAILED\n  ${bad.join('\n  ')}` : 'fades: all passed')
await b.close()
process.exit(bad.length ? 1 : 0)
