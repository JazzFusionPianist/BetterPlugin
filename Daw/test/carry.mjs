// node test/carry.mjs — what is carried is drawn over the lane it is carried along: with ⌥ (a copy stays behind) and
// without, over another region of the lane, the one in the hand is drawn last, its name too; put down, it covers its stretch
import { open, PAGE } from './cdp.mjs'
setTimeout(() => { console.log('carry: TIMED OUT'); process.exit(2) }, 60000)
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined && !cond ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const mouse = (type, x, y, extra = {}) => b.send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' }, extra))
await ev(`if (typeof START !== 'undefined') START.on = false; S.rh = 40; setZoom(24, 20); S.tool = 'pointer'; setView(true); dirtyAll(); flush()`)
/* one lane, two regions apart: the first is taken up and laid over the second */
const lay = () => ev(`const i = S.tracks.findIndex(t => t.kind === 'audio' && t.regs.length && !t.inst), t = S.tracks[i], src = t.regs[0]
  t.regs = [cloneReg(src, { a: 3, b: 7 }), cloneReg(src, { a: 9, b: 13 })]; t.regs.forEach(r => { r.fi = 0; r.fo = 0; delete r.xo })
  S.selR = [t.regs[0].id]; S.sel = i; VX = 0; VY = 0; dirtyAll(); flush()
  const r = document.getElementById('board').getBoundingClientRect(); return { i, A: t.regs[0].id, B: t.regs[1].id, x: r.left + bx(5), y: r.top + rowY(i) + 1.5 + (rowH(i) - 3) * .72, to: r.left + bx(12.1) }`)
/* where in the lane's drawing each region's body is (the body is the first thing drawn of it, from its left edge) */
const order = (i, ids) => ev(`const t = S.tracks[${i}], html = LANES.rows.get(t.id).el.innerHTML, at = id => { const r = t.regs.find(q => q.id === id); if (!r) return -1; const x = n(bx(r.a) + .5); return html.lastIndexOf('M' + x + ' ') }
  return ${JSON.stringify(ids)}.map(at)`)
for (const alt of [true, false]) {
  const p = await lay(), word = alt ? 'with ⌥' : 'without ⌥'
  await mouse('mouseMoved', p.x, p.y, { buttons: 0, modifiers: alt ? 1 : 0 })
  await mouse('mousePressed', p.x, p.y, { modifiers: alt ? 1 : 0 })
  for (let k = 1; k <= 6; k++) await mouse('mouseMoved', p.x + (p.to - p.x) * k / 6, p.y, { modifiers: alt ? 1 : 0 })
  await b.sleep(60)
  const mid = await ev(`flush(); const r = S.tracks[${p.i}].regs.find(r => r.id === ${p.A}); return { moved: !!(drag && drag.moved), drag: drag && drag.a, a: r && r.a, n: S.tracks[${p.i}].regs.length, where: S.tracks.findIndex(t => t.regs.some(r => r.id === ${p.A})), i: ${p.i}, tool: S.tool }`)
  const [held, under] = await order(p.i, [p.A, p.B])
  ok(`${word}: carried over the other region, it is drawn after it`, mid.moved && mid.a > 8 && held > under && under >= 0, [mid, held, under])
  if (alt) ok('with ⌥: a copy stays behind', mid.n === 3, mid)
  await mouse('mouseReleased', p.to, p.y, { modifiers: alt ? 1 : 0 })
  await b.sleep(120)
  const end = await ev(`const t = S.tracks[${p.i}]; return t.regs.map(r => [r.id === ${p.A}, +r.a.toFixed(3), +r.b.toFixed(3)]).sort((x, y) => x[1] - y[1])`)
  const mine = end.find(x => x[0])
  ok(`${word}: put down, it covers its stretch`, !!mine && end.every(x => x[0] || x[2] <= mine[1] + 1e-6 || x[1] >= mine[2] - 1e-6), end)
  ok(`${word}: nothing else is drawn first after it is put down (the order is the lane's own)`, await ev(`return !drag`))
  await ev(`undoEdit(); flush()`)
}
{ const errs = await ev(`return window.__errs || []`); ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
await b.close()
console.log(out.join('\n'))
console.log(bad.length ? `carry: ${bad.length} FAILED\n  ${bad.join('\n  ')}` : 'carry: all passed')
process.exit(bad.length ? 1 : 0)
