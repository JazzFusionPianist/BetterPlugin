// node test/autonudge.mjs [w h] — chosen points of a line nudged with the keys: option and the left or right arrow move them a
// nudge earlier or later — the points alone (a region chosen besides, and the playhead, stay); they stop at the next point of
// their line; with no point chosen the same keys are the regions' again. Real keys, and what is drawn is looked at.
import { open, PAGE } from './cdp.mjs'
const [ww, hh] = [+process.argv[2] || 1440, +process.argv[3] || 900]
const b = await open(PAGE, { width: ww, height: hh, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev, ALT = 1, CMD = 4
const key = (k, code, vk, mods = 0) => b.press(k, code, vk, mods).then(() => b.sleep(60))

// a line of three points on the first track that has a region, the lines up, the middle point chosen — and its region chosen too
const ids = await ev(`setView(true); const ti = S.tracks.findIndex(t => t.regs.length), t = S.tracks[ti], r = t.regs[0]; t.autos = t.autos || {}; t.autos.vol = []; t.ap = 'vol'
  const q = [2, 3, 4].map(b => addPoint(t, 'vol', b, .5)); S.auto = true; S.flex = false; S.sel = ti; S.selR = [r.id]; S.selP = [q[1].id]; S.nudge = 'beat'; S.focus = 'lanes'; S.marq = null
  VX = 0; dirtyAll(); flush(); return { ti, r: r.id, q: q.map(x => x.id) }`)
const pts = () => ev(`return S.tracks[${ids.ti}].autos.vol.map(q => [+q.b.toFixed(6), +q.v.toFixed(6), q.id])`)
const reg = () => ev(`const [r] = regOf(${ids.r}); return [r.a, r.b, +curPos().toFixed(6)]`)
// where the chosen point is drawn (the one dot of the row drawn larger)
const dot = () => ev(`flush(); const c = [...document.querySelectorAll('#g-lanes circle')].filter(c => +c.getAttribute('r') > 2.3); return c.map(c => +c.getAttribute('cx'))`)
const beat = await ev('return 1 / BEATS()'), pxb = await ev('return PXB')

const p0 = await pts(), r0 = await reg(), d0 = await dot()
ok('the chosen point is drawn', d0.length === 1, d0)
await key('ArrowRight', 'ArrowRight', 39, ALT)
const p1 = await pts(), d1 = await dot()
ok('option right: the chosen point a beat later — the other points where they were', Math.abs(p1[1][0] - (3 + beat)) < 1e-6 && p1[0][0] === 2 && p1[2][0] === 4 && p1[1][1] === p0[1][1], p1)
ok('the region chosen besides has not moved, nor the playhead', JSON.stringify(await reg()) === JSON.stringify(r0), [r0, await reg()])
ok('and on the screen the point stands a beat further right', d1.length === 1 && Math.abs(d1[0] - d0[0] - beat * pxb) < .6, [d0, d1, beat * pxb])
ok('it is still the chosen one', await ev(`return S.selP.length === 1 && S.selP[0] === ${ids.q[1]}`))
await key('ArrowLeft', 'ArrowLeft', 37, ALT)
ok('option left: back', JSON.stringify(await pts()) === JSON.stringify(p0), await pts())
// by a bar: it stops at the next point of its line
await ev(`S.nudge = 'bar'`)
await key('ArrowRight', 'ArrowRight', 39, ALT); await key('ArrowRight', 'ArrowRight', 39, ALT)
const p2 = await pts()
ok('it does not pass the next point of its line', p2[1][0] === 4 && p2[2][0] === 4 && p2[1][2] === ids.q[1] && p2[2][2] === ids.q[2], p2)
await key('z', 'KeyZ', 90, CMD)
ok('one undo: where it was', JSON.stringify(await pts()) === JSON.stringify(p0), await pts())
// two chosen go together, and stop together at the song's beginning
await ev(`S.selP = [${ids.q[0]}, ${ids.q[1]}]; uiDirty('lanes'); flush()`)
await key('ArrowLeft', 'ArrowLeft', 37, ALT)
const p3 = await pts()
ok('two chosen: both a bar earlier, as far apart as they were', p3[0][0] === 1 && p3[1][0] === 2 && p3[2][0] === 4, p3)
await key('ArrowLeft', 'ArrowLeft', 37, ALT); await key('ArrowLeft', 'ArrowLeft', 37, ALT)
const p4 = await pts()
ok('at the beginning of the song they stop, still as far apart', p4[0][0] === 0 && p4[1][0] === 1, p4)
ok('the region still has not moved', JSON.stringify(await reg()) === JSON.stringify(r0), await reg())
// up and down are still the points' value
await key('ArrowUp', 'ArrowUp', 38, ALT)
const p5 = await pts()
ok('option up: their value, not their place', p5[0][1] > p4[0][1] && p5[0][0] === 0 && p5[1][0] === 1, p5)
// with the lines up and no point chosen, nothing of the sound moves (his ask, 2026-10-19): the playhead goes on instead
await ev(`S.selP = []; uiDirty('lanes'); flush()`)
await key('ArrowRight', 'ArrowRight', 39, ALT)
const r5 = await reg()
ok('lines up, no point chosen: the region stays, the playhead goes a bar on', r5[0] === r0[0] && r5[1] === r0[1] && Math.abs(r5[2] - (r0[2] + 1)) < 1e-6 && JSON.stringify((await pts()).map(q => q[0])) === JSON.stringify([0, 1, 4]), [r0, r5])
// the lines away: the keys are the regions' again
await ev(`S.auto = false; uiDirty('lanes'); flush()`)
await key('ArrowRight', 'ArrowRight', 39, ALT)
const r6 = await reg()
ok('lines away: the region is nudged, as before', r6[0] === r0[0] + 1 && r6[1] === r0[1] + 1, r6)

// a stack's own line cut out every half bar, as his: steps of two points a hair apart. The corner pressed is chosen and
// drawn so; nudged, its step goes whole (its twin with it), and the next step stays
{ const st = await ev(`S.auto = false; S.selR = [S.tracks[0].regs[0].id, S.tracks[1].regs[0].id]; S.focus = 'lanes'; makeStack(); const st = S.tracks.find(t => t.kind === 'stack'); st.autos = { vol: [] }
    for (const [b, v] of [[10, 0], [10.002, -48], [10.498, -48], [10.5, 0], [14, 0], [14.002, -48]]) addPoint(st, 'vol', b, v); S.selP = []; S.nudge = 'beat'; VX = 6; dirtyAll(); flush()
    const ti = S.tracks.indexOf(st), g = autoGeom(st, rowY(ti), rowH(ti)), q = st.autos.vol[1], bd = document.getElementById('board').getBoundingClientRect(), k = bd.width / W
    return { x: bd.left + bx(q.b + 1) * k, y: bd.top + g.yOf(q.v) * k, id: q.id }`)
  await b.click(st.x, st.y); await b.sleep(80)
  const drawn = await ev(`flush(); const c = [...document.querySelectorAll('#g-lanes circle')]; const big = c.filter(e => +e.getAttribute('r') > 2.3); return { chosen: S.selP.slice(), lastIsChosen: big.length > 0 && c.indexOf(big[big.length - 1]) > c.findIndex(e => Math.abs(+e.getAttribute('cx') - +big[0].getAttribute('cx')) < .5 && +e.getAttribute('r') < 2.3) }`)
  ok('a corner of a step on a stack\'s line pressed: it is chosen, and drawn over its twin', drawn.chosen.length === 1 && drawn.chosen[0] === st.id && drawn.lastIsChosen, drawn)
  await key('ArrowRight', 'ArrowRight', 39, ALT)
  const pts = await ev(`return S.tracks.find(t => t.kind === 'stack').autos.vol.map(q => +q.b.toFixed(3))`)
  ok('option right: the whole step a beat later — both its points — and the next step where it was', JSON.stringify(pts) === JSON.stringify([10.25, 10.252, 10.498, 10.5, 14, 14.002]), pts)
  await key('ArrowLeft', 'ArrowLeft', 39 - 2, ALT)
  ok('option left: back', JSON.stringify(await ev(`return S.tracks.find(t => t.kind === 'stack').autos.vol.map(q => +q.b.toFixed(3))`)) === JSON.stringify([10, 10.002, 10.498, 10.5, 14, 14.002])) }

// the lines hidden, a drag along the stack's own row, off its line: the points inside are chosen (his ask, 2026-10-19), and
// they go with the keys; a drag over the regions of its tracks still takes the regions, and no point
{ const at = await ev(`S.auto = false; S.selP = []; S.selR = []; dirtyAll(); flush(); const st = S.tracks.find(t => t.kind === 'stack'), ti = S.tracks.indexOf(st), g = autoGeom(st, rowY(ti), rowH(ti)), bd = document.getElementById('board').getBoundingClientRect(), k = bd.width / W
    const X = b => bd.left + bx(b + 1) * k, Y = y => bd.top + y * k
    return { x0: X(9.5), y0: Y(g.ly + g.lh - 1), x1: X(10.75), y1: Y(g.ly + 1), top: Y(g.yOf(0)), mx: X(10.6), my: Y(rowY(ti + 1) + rowH(ti + 1) / 2) }`)
  await b.dragTo(at.x0, at.y0, at.x1, at.y1, 8); await b.sleep(80)
  const got = await ev(`const st = S.tracks.find(t => t.kind === 'stack'); return { chosen: st.autos.vol.filter(q => S.selP.includes(q.id)).map(q => +q.b.toFixed(3)), regs: S.selR.length, band: S.band }`)
  ok('lines hidden: a drag along a stack\'s row chooses the points of its line inside it, and no region', JSON.stringify(got.chosen) === JSON.stringify([10, 10.002, 10.498, 10.5]) && got.regs === 0 && !got.band, [got, at])
  await key('ArrowRight', 'ArrowRight', 39, ALT)
  ok('and option right takes them a beat on, the next step where it was', JSON.stringify(await ev(`return S.tracks.find(t => t.kind === 'stack').autos.vol.map(q => +q.b.toFixed(3))`)) === JSON.stringify([10.25, 10.252, 10.748, 10.75, 14, 14.002]))
  await key('z', 'KeyZ', 90, CMD)
  await b.dragTo(at.x0, at.my, at.x1, at.y1, 8); await b.sleep(80)
  const both = await ev(`return { regs: S.selR.length, pts: S.selP.length }`)
  ok('a drag that also lies over its tracks\' regions takes the regions, and no point', both.regs > 0 && both.pts === 0, both) }

console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
if (b.errors.length) console.log('page errors:', b.errors.slice(0, 5))
await b.close()
process.exit(bad.length || b.errors.length ? 1 : 0)
