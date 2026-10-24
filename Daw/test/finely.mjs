// node test/finely.mjs — control and a pull: a level goes by tenths of a db (his ask, 2026-10-24: "control + drag 하면 값이
// 막 0.6 1.2 이런식으로 움직이거든? 나는 0.1 단위로 움직이고 싶은데"): one step for every two units the hand moves, evenly
// whatever the fader's law does there — a point of a volume line low on a short lane, the level in a track's head, a
// fader of the mixer; control let go mid-pull, the pull goes on from there without a jump. Real presses, real modifiers.
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev, CTRL = 2
const mouse = (type, x, y, extra = {}) => b.send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' }, extra))
/* a pull in steps, each step with its own modifiers: [[dx, dy, modifiers] …] from (x, y) */
const pull = async (x, y, moves, m0 = 0) => {
  await b.sleep(300); await mouse('mouseMoved', x, y, { buttons: 0, modifiers: m0 }); await mouse('mousePressed', x, y, { modifiers: m0 })
  for (const [dx, dy, m] of moves) { x += dx; y += dy; await mouse('mouseMoved', x, y, { modifiers: m }); await b.sleep(15) }
  await mouse('mouseReleased', x, y, { modifiers: moves.length ? moves[moves.length - 1][2] : m0 }); await b.sleep(80)
}
const steps = (n, dx, dy, m) => Array.from({ length: n }, () => [dx, dy, m])
const tenth = v => Math.abs(v * 10 - Math.round(v * 10)) < 1e-6

await ev(`if (typeof START !== 'undefined') START.on = false; setView(true); S.tool = 'pointer'; S.rh = 30; VY = 0; setZoom(0); flush()
  const ti = rows().find(i => S.tracks[i].kind === 'audio' && !S.tracks[i].inst); window.TI = ti; const t = S.tracks[ti]
  t.autos = t.autos || {}; t.autos.vol = [{ id: ++PID, b: 4, v: -18 }, { id: ++PID, b: 12, v: -6 }]; S.auto = true; S.ap = 'vol'; showRow(ti); flush(); return 1`)
const pointAt = k => ev(`flush(); const t = S.tracks[TI], g = autoGeom(t, rowY(TI), rowH(TI)), q = autoPts(t, 'vol')[${k}]; return { x: bx(q.b + 1), y: g.yOf(q.v), v: q.v }`)
const vOf = k => ev(`return autoPts(S.tracks[TI], 'vol')[${k}].v`)

/* a point low on a short lane (-18 db, a row of 30): control, ten units up */
{ const p = await pointAt(0)
  await pull(p.x, p.y, steps(10, 0, -1, CTRL), CTRL)
  const v = await vOf(0)
  ok('a point at -18 db, control and ten units up: -17.5, by tenths', Math.abs(v - -17.5) < 1e-6 && tenth(v), v)
  await ev(`undoEdit(); flush(); return 1`)
  const q = await pointAt(0)
  await pull(q.x, q.y, steps(10, 0, -1, 0), 0)
  const w = await vOf(0)
  ok('…without control the same pull goes far further (more than 2 db)', w - -18 > 2, w)
  await ev(`undoEdit(); flush(); return 1`) }

/* control let go in the middle of the pull: on from where it was, no jump */
{ const p = await pointAt(0)
  await pull(p.x, p.y, steps(10, 0, -1, CTRL).concat([[0, -1, 0]]), CTRL)
  const v = await vOf(0)
  ok('control let go mid-pull: the next unit goes on from -17.5 (a unit of the plain pull there is about 1.6 db), not back to where the plain pull alone would be (-1.6)', v > -17.5 && v < -12, v)
  await ev(`undoEdit(); S.auto = false; flush(); return 1`) }

/* the level in a track's head */
{ const r = await ev(`flush(); const el = document.querySelector('#hd-' + TI + ' [data-a="vol"]'); if (!el) return null; const q = el.getBoundingClientRect(); S.tracks[TI].autos.vol = []; S.tracks[TI].vol = -10; flush(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }`)
  if (!r) ok('the head has a level to pull', false)
  else {
    await pull(r.x, r.y, steps(20, 1, 0, CTRL), CTRL)
    const v = await ev(`return S.tracks[TI].vol`)
    ok('the level in a track\'s head, control and twenty units right: up by a whole db, by tenths', Math.abs(v - -9) < 1e-6 && tenth(v), v)
  } }

/* a fader of the mixer */
{ const r = await ev(`S.panel.on = true; S.panel.tab = 'mixer'; S.panel.h = Math.max(S.panel.h, 360); setView(true); S.tracks[TI].vol = -10; dirtyAll(); flush(); const el = [...document.querySelectorAll('[data-a="mvol"]')].find(x => +x.dataset.i === TI); if (!el) return null; const q = el.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }`)
  if (!r) ok('the mixer has a fader to pull', false)
  else {
    await pull(r.x, r.y, steps(14, 0, -1, CTRL), CTRL)
    const v = await ev(`return S.tracks[TI].vol`)
    ok('a fader of the mixer, control and fourteen units up: up by 0.7 db, by tenths', Math.abs(v - -9.3) < 1e-6 && tenth(v), v)
  } }

ok('no errors on the page', !b.errors.length, b.errors.slice(0, 3))
console.log(out.join('\n'))
console.log(bad.length ? `\n${bad.length} failed` : '\nall passed')
await b.close()
process.exit(bad.length ? 1 : 0)
