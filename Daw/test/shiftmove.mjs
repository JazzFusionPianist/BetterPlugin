// node test/shiftmove.mjs [w h] — shift held while a thing is pulled (his ask, 2026-10-19): a region goes to another track
// and stays where it was in the song; a point of a line goes along the song and keeps its value. Without shift both move
// both ways, as before. A real pointer: pressed plain, shift taken up on the way, as a hand does it — and pressed with it.
import { open, PAGE } from './cdp.mjs'
const [ww, hh] = [+process.argv[2] || 1440, +process.argv[3] || 900]
const b = await open(PAGE, { width: ww, height: hh, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev, SHIFT = 8
const m = (type, x, y, mods = 0) => b.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse', modifiers: mods })
/* pressed with `down`, pulled to (x1, y1) with `on` held, let go */
const pull = async (x0, y0, x1, y1, down, on) => {
  await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0, y: y0, buttons: 0, modifiers: down })
  await m('mousePressed', x0, y0, down)
  for (let i = 1; i <= 8; i++) await m('mouseMoved', x0 + (x1 - x0) * i / 8, y0 + (y1 - y0) * i / 8, on)
  await m('mouseReleased', x1, y1, on); await b.sleep(80)
}

// two audio tracks, one region on the first, at bar 3
const s = await ev(`setView(true); S.auto = false; S.flex = false; setMode('smart')
  const audio = S.tracks.filter(t => t.kind === 'audio' && !t.inst && !t.theirs)
  const t0 = audio[0], t1 = audio[1], r = t0.regs.find(x => !x.notes) || t0.regs[0]
  for (const t of [t0, t1]) t.regs = t.regs.filter(x => x === r)
  r.b = 3 + (r.b - r.a); r.a = 3
  S.selR = []; S.selP = []; S.marq = null; VX = 0; VY = 0; dirtyAll(); flush()
  return { r: r.id, t0: S.tracks.indexOf(t0), t1: S.tracks.indexOf(t1), pxb: PXB }`)
const at = () => ev(`const [r, t] = regOf(${s.r}); return { ti: S.tracks.indexOf(t), a: +r.a.toFixed(6), b: +r.b.toFixed(6) }`)
const spot = ti => ev(`flush(); const [r] = regOf(${s.r}); return { x: Math.round(bx(r.a) + Math.min(40, (bx(r.b) - bx(r.a)) / 2)), y: Math.round(rowY(${s.t0}) + rowH(${s.t0}) * .6), to: Math.round(rowY(${s.t1}) + rowH(${s.t1}) * .6) }`)

let r0 = await at(), p = await spot()
await pull(p.x, p.y, p.x + 3 * s.pxb, p.to, 0, SHIFT)
let r1 = await at()
ok('shift held on the way: the region is on the other track', r1.ti === s.t1, [r0, r1])
ok('and where it was in the song', r1.a === r0.a && r1.b === r0.b, [r0, r1])
await b.press('z', 'KeyZ', 90, 4); await b.sleep(80)
ok('one undo: back on its own track', JSON.stringify(await at()) === JSON.stringify(r0), await at())

await ev(`S.selR = []; flush()`)
p = await spot()
await pull(p.x, p.y, p.x + 3 * s.pxb, p.to, SHIFT, SHIFT)
r1 = await at()
ok('pressed with shift as well: the same', r1.ti === s.t1 && r1.a === r0.a && r1.b === r0.b, [r0, r1])
await b.press('z', 'KeyZ', 90, 4); await b.sleep(80)

p = await spot()
await pull(p.x, p.y, p.x + 3 * s.pxb, p.to, 0, 0)
r1 = await at()
ok('without shift it goes both ways, as before', r1.ti === s.t1 && Math.abs(r1.a - r0.a - 3) < .26, [r0, r1])
await b.press('z', 'KeyZ', 90, 4); await b.sleep(80)

// a line of three points on the first track
const q = await ev(`const t = S.tracks[${s.t0}]; t.autos = t.autos || {}; t.autos.vol = []; t.ap = 'vol'
  const q = [2, 4, 6].map(b => addPoint(t, 'vol', b, .5)); S.auto = true; S.sel = ${s.t0}; S.selR = []; S.selP = []; S.marq = null; dirtyAll(); flush(); return q.map(x => x.id)`)
const pts = () => ev(`return S.tracks[${s.t0}].autos.vol.map(q => [+q.b.toFixed(6), +q.v.toFixed(6), q.id])`)
const dot = () => ev(`flush(); const ti = ${s.t0}, t = S.tracks[ti], g = autoGeom(t, rowY(ti), rowH(ti)), q = t.autos.vol.find(x => x.id === ${q[1]}); return { x: Math.round(bx(q.b + 1)), y: Math.round(g.yOf(q.v)), lh: g.lh }`)

const v0 = await pts(), d = await dot()
await pull(d.x, d.y, d.x + s.pxb * 1.2, d.y - d.lh * .3, 0, SHIFT)
let v1 = await pts()
const mid = v1.find(x => x[2] === q[1])
ok('shift held on the way: the point goes along the song', mid[0] > 4 + .1, v1)
ok('and keeps its value', mid[1] === v0[1][1], [v0[1], mid])
await b.press('z', 'KeyZ', 90, 4); await b.sleep(80)
ok('one undo: where it was', JSON.stringify(await pts()) === JSON.stringify(v0), await pts())

await ev(`S.selP = []; flush()`)
const d2 = await dot()
await pull(d2.x, d2.y, d2.x + s.pxb * 1.2, d2.y - d2.lh * .3, 0, 0)
v1 = await pts()
const mid2 = v1.find(x => x[2] === q[1])
ok('without shift it goes up as well, as before', mid2[0] > 4 + .1 && mid2[1] > v0[1][1], [v0[1], mid2])

ok('nothing went wrong on the page', !b.errors.length, b.errors)
console.log(out.join('\n'))
console.log(bad.length ? `${bad.length} failed: ${bad.join('; ')}` : 'all passed')
await b.close()
process.exit(bad.length ? 1 : 0)
