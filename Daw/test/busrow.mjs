// node test/busrow.mjs — a bus's own row: the whole row, head and lane, is washed with the bus's colour, and the one line
// of that colour along its lane is its own line (its volume): always up, at the height of the fader, and taken hold of
// where it is without the lines being shown — a press on it makes a point, twice on the lane makes one, delete takes the
// chosen ones. A stack's line is up and taken the same way. No other kind of row has either.
import { open, PAGE } from './cdp.mjs'
setTimeout(() => { console.log('busrow: TIMED OUT'); process.exit(2) }, 90000)
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const mouse = (type, x, y, extra = {}) => b.send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' }, extra))
/* what the page drew for row i: in the head, a rectangle of the row's colour over the whole head; on the lane, such a
   rectangle over the whole lane, and a level line of that colour */
const seen = i => ev(`flush(); const t = S.tracks[${i}], rh = rowH(${i}), num = (e, a) => e ? +(e.getAttribute(a) || 1) : null
  const hd = [...document.getElementById('hd-${i}').querySelectorAll('rect')].find(r => r.getAttribute('fill') === t.c && +r.getAttribute('width') > 100)
  const el = LANES.rows.get(t.id).el
  const gr = [...el.querySelectorAll(':scope > rect')].find(r => r.getAttribute('fill') === t.c && +r.getAttribute('width') > 100)
  const ln = [...el.querySelectorAll(':scope > path')].find(p => p.getAttribute('stroke') === t.c && /^M[-\\d.]+ [-\\d.]+H[-\\d.]+$/.test(p.getAttribute('d')))
  const d = ln ? /^M([-\\d.]+) ([-\\d.]+)H([-\\d.]+)$/.exec(ln.getAttribute('d')).slice(1).map(Number) : null
  const dots = [...el.querySelectorAll(':scope > circle')].filter(c => c.getAttribute('stroke') === t.c).length, curve = [...el.querySelectorAll(':scope > path')].some(p => p.getAttribute('stroke') === t.c && /L/.test(p.getAttribute('d')))
  return { c: t.c, rh, dots, curve, auto: S.auto, volY: autoGeom(t, 0, rh).yOf(t.vol) + .5, head: hd ? { x: num(hd, 'x'), w: num(hd, 'width'), h: num(hd, 'height'), a: num(hd, 'fill-opacity') } : null, ground: gr ? { x: num(gr, 'x'), w: num(gr, 'width'), h: num(gr, 'height'), a: num(gr, 'fill-opacity') } : null, line: d ? { x0: d[0], y: d[1], x1: d[2], a: num(ln, 'stroke-opacity') } : null, X0, X1, HEAD_W }`)

await ev(`if (typeof START !== 'undefined') START.on = false; setView(true); S.rh = 25; for (const t of S.tracks) delete t.h; VY = 0; S.auto = false; newTrack('bus', 'plate', true); VY = maxVY(); dirtyAll(); flush()`)
let bi = await ev(`return S.tracks.findIndex(t => t.kind === 'bus')`), ai = await ev(`return S.tracks.findIndex(t => t.kind === 'audio')`)
ok('there is a bus and a track to tell it from', bi >= 0 && ai >= 0, [bi, ai])

const s0 = await seen(bi)
ok('the head of a bus is washed with its colour, from its colour strip to the lanes', !!s0.head && s0.head.x === 3 && s0.head.w === s0.HEAD_W - 3 && s0.head.h === s0.rh - 1 && s0.head.a === .1, s0.head)
ok('…and so is its lane, as wide as the lanes', !!s0.ground && s0.ground.x === s0.X0 && s0.ground.w === s0.X1 - s0.X0 && s0.ground.h === s0.rh - 1 && s0.ground.a === .1, s0.ground)
ok('one line of its colour runs along the lane from its start, at the height of its volume: its own line, with the lines not shown', !!s0.line && s0.auto === false && s0.line.x0 === s0.X0 && Math.abs(s0.line.y - s0.volY) < .6 && s0.line.x1 > s0.X0 && s0.line.x1 <= s0.X1 && s0.line.a === .75, [s0.line, s0.volY])
const a0 = await seen(ai)
ok('a track that is not a bus has neither', !a0.head && !a0.ground && !a0.line, a0)

/* its colour changed: the row follows */
{ await ev(`chooseTrack(${bi}, ''); S.focus = 'tracks'; setLook('col', ['drums', 4]); flush()`)
  const s = await seen(bi)
  ok('given another colour, the wash and the line are of that colour', s.c !== s0.c && !!s.head && !!s.ground && !!s.line, [s0.c, s.c, !!s.head, !!s.ground, !!s.line]) }

/* not heard: paler */
{ await ev(`S.tracks[${bi}].mute = true; dirtyAll(); flush()`)
  const s = await seen(bi)
  ok('a muted bus is paler, wash and line', !!s.head && s.head.a < .06 && s.ground.a < .06 && s.line.a < .4, [s.head, s.line])
  await ev(`S.tracks[${bi}].mute = false; dirtyAll(); flush()`) }

/* the fader moved: the line is where the volume is */
{ await ev(`const t = S.tracks[${bi}]; volSet(t, -20); dirtyAll(); flush()`)
  const s = await seen(bi)
  ok('the fader moved: the line goes to that height', s.line.y > s0.line.y + 2 && Math.abs(s.line.y - s.volY) < .6, [s0.line.y, s.line.y])
  await ev(`volSet(S.tracks[${bi}], 0); dirtyAll(); flush()`) }

/* the line is taken hold of where it is, the lines not shown */
const pts = () => ev(`const t = S.tracks[${bi}]; return { n: autoPts(t, 'vol').length, pts: autoPts(t, 'vol').map(q => [Math.round(q.b * 100) / 100, q.v]), selP: S.selP.length, auto: S.auto, ap: t.ap || null, drag: drag ? drag.a : null, sel: S.sel }`)
const at = (frac, dy = 0) => ev(`flush(); const t = S.tracks[${bi}], g = autoGeom(t, rowY(${bi}), rowH(${bi})), x = X0 + (X1 - X0) * ${frac}, pos = clamp(barAt(x), 0, SONG_END), v = autoPts(t, g.k).length ? autoAt(t, g.k, pos) : g.A.now(t); return { x, y: g.yOf(v) + ${dy}, row: [rowY(${bi}), rowH(${bi})] }`)
{ const p = await at(.3)
  await mouse('mouseMoved', p.x, p.y, { buttons: 0 }); await b.sleep(60)
  ok('over the line the pointer says a point can be made', (await ev(`return document.elementFromPoint(${p.x}, ${p.y}).style.cursor`)) === 'crosshair')
  await mouse('mousePressed', p.x, p.y); await b.sleep(40)
  const down = await pts()
  ok('a press on the line takes hold of it (no point yet: let go in place it would be one, pulled the line moves)', down.n === 0 && down.drag === 'apt' && down.auto === false, down)
  for (let k = 1; k <= 5; k++) await mouse('mouseMoved', p.x, p.y + k * 1.2)
  await mouse('mouseReleased', p.x, p.y + 6); await b.sleep(80)
  const up = await pts(), s = await seen(bi)
  ok('pulled down, the whole line is lower than the fader stood (one point, at the beginning); the lines were never shown', up.n === 1 && up.pts[0][0] === 0 && up.pts[0][1] < 0 && up.auto === false, up)
  ok('the bus is the chosen track', up.sel === bi, up.sel)
  ok('the line is drawn through its point, with the point on it', s.dots === 1 && !!s.curve, [s.dots, s.curve])
  await ev(`undoEdit(); flush()`)
  ok('…and it is one step back', (await pts()).n === 0) }

/* twice anywhere on the lane: a point there */
{ const p = await at(.5, -4)
  await b.click(p.x, p.y); await b.click(p.x, p.y); await b.sleep(120)
  const two = await pts()
  ok('twice on its lane: a point where the hand is', two.n === 1 && two.selP === 1, two)
  /* a second point, and the first taken and moved */
  const p2 = await at(.7)
  await mouse('mouseMoved', p2.x, p2.y, { buttons: 0 }); await mouse('mousePressed', p2.x, p2.y); await mouse('mouseReleased', p2.x, p2.y); await b.sleep(80)
  const three = await pts()
  ok('pressed and let go on the line: a second point, on the line', three.n === 2 && three.selP === 1 && three.pts[1][1] === three.pts[0][1], three)
  /* delete takes the chosen point, lines not shown */
  await b.press('Backspace', 'Backspace', 8); await b.sleep(100)
  const gone = await pts()
  ok('delete takes the chosen point away', gone.n === 1 && gone.selP === 0, gone)
  /* a press on another track's lane lets go of the points */
  await ev(`S.selP = [autoPts(S.tracks[${bi}], 'vol')[0].id]; flush()`)
  const q = await ev(`return { x: X0 + 40, y: rowY(${ai}) + rowH(${ai}) / 2 }`)
  await b.click(q.x, q.y); await b.sleep(80)
  ok('a press on another lane lets go of the point', (await pts()).selP === 0)
  await ev(`const t = S.tracks[${bi}]; t.autos.vol = []; S.selP = []; dirtyAll(); flush()`) }

/* a press away from the line on the bus's lane does not make a point */
{ await ev(`S.tracks[${bi}].h = 80; VY = maxVY(); dirtyAll(); flush()`)
  const p = await at(.4, 30)
  await b.click(p.x, p.y); await b.sleep(80)
  ok('a press on its lane away from the line makes no point', (await pts()).n === 0)
  const s = await seen(bi)
  ok('a bus pulled taller: the wash is as tall as the row', s.rh === 80 && s.head.h === 79 && s.ground.h === 79, [s.rh, s.head])
  await ev(`delete S.tracks[${bi}].h; dirtyAll(); flush()`) }

/* a stack: its line is always up too, in its colour, and is taken the same way; a track in it shows none */
{ await ev(`chooseTrack(0, ''); chooseTrack(1, 'range'); makeStack(); VY = 0; dirtyAll(); flush()`)
  const si = await ev(`return S.tracks.findIndex(t => t.kind === 'stack')`), ci = await ev(`return S.tracks.findIndex(t => t.parent)`)
  const s = await seen(si), c = await seen(ci)
  ok('a stack shows its own line in its colour, with no wash', si >= 0 && !!s.line && !s.ground && !s.head, [si, s.line, s.ground])
  ok('…a track inside it shows none', !c.line && !c.curve, c.line)
  const p = await ev(`flush(); const t = S.tracks[${si}], g = autoGeom(t, rowY(${si}), rowH(${si})); return { x: X0 + (X1 - X0) * .25, y: g.yOf(t.vol) }`)
  await mouse('mouseMoved', p.x, p.y, { buttons: 0 }); await mouse('mousePressed', p.x, p.y); await mouse('mouseMoved', p.x, p.y + 3); await mouse('mouseReleased', p.x, p.y + 3); await b.sleep(80)
  const n = await ev(`return [autoPts(S.tracks[${si}], 'vol').length, S.auto]`)
  ok('a press on a stack’s line makes a point, the lines not shown', n[0] === 1 && n[1] === false, n)
  await ev(`undoEdit(); flush()`)
  bi = await ev(`return S.tracks.findIndex(t => t.kind === 'bus')`); ai = await ev(`return S.tracks.findIndex(t => t.kind === 'audio' && !t.parent)`) }

/* with the lines shown it is still its line, in its colour, and other tracks show theirs in ink */
{ await ev(`toggleAuto(); flush()`)
  const s = await seen(bi), a = await ev(`flush(); const el = LANES.rows.get(S.tracks[${ai}].id).el; return [...el.querySelectorAll(':scope > path')].some(p => p.getAttribute('stroke-dasharray'))`)
  ok('with the lines shown the bus keeps its line in its colour, and a track shows its own dashed one', !!s.line && !!s.ground && a === true, [s.line, a])
  await ev(`toggleAuto(); flush()`)
  ok('…put away, the track’s is gone and the bus’s stays', !!(await seen(bi)).line && !(await ev(`flush(); const el = LANES.rows.get(S.tracks[${ai}].id).el; return [...el.querySelectorAll(':scope > path')].some(p => p.getAttribute('stroke-dasharray'))`))) }

{ const errs = await ev(`return window.__errs || []`)
  ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n'))
console.log(bad.length ? `busrow: ${bad.length} FAILED\n  ${bad.join('\n  ')}` : 'busrow: all passed')
process.exit(bad.length ? 1 : 0)
