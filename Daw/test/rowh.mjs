// node test/rowh.mjs — a row's own height: the line under a row, in the heads, is taken hold of and pulled; the row
// grows or shrinks under the hand (looked at while the button is still down, as the page drew it by itself), the rows
// below move, the others keep the room's height; several chosen take it together; twice on the line puts it back; what
// stands where (a press on a lane, a track dropped between two rows) follows the new heights; it is kept with the
// project and is not a change of the song.
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const mouse = (type, x, y, extra = {}) => b.send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' }, extra))
/* what is on the screen, as the page drew it (no flush here: a drag must show by itself) */
const seen = () => ev(`const rowBox = i => { const g = document.getElementById('hd-' + i), h = g && g.querySelector('[data-a="sel"]'); return h ? [+h.getAttribute('y'), +h.getAttribute('height')] : null }
  const lane = i => { const el = LANES.rows.get(S.tracks[i].id); return el ? +/translate\\(0 ([-\\d.]+)\\)/.exec(el.el.getAttribute('transform'))[1] : null }
  return { heads: [0, 1, 2, 3, 4, 5].map(rowBox), lanes: [0, 1, 2, 3].map(lane), h: S.tracks.map(t => t.h || 0), rh: S.rh, vy: VY, pull: S.rowPull }`)
const line = i => ev(`flush(); const el = document.elementFromPoint(120, rowY(${i}) + rowH(${i}) - 1) || {}, d = el.dataset || {}; return { x: 120, y: rowY(${i}) + rowH(${i}) - 1, under: { a: d.a, i: d.i }, cur: (el.style || {}).cursor }`)

await ev(`if (typeof START !== 'undefined') START.on = false; setView(true); S.rh = 25; for (const t of S.tracks) delete t.h; VY = 0; S.sel = 0; S.selT = []; if (typeof keepNow === 'function') keepNow('opened'); dirtyAll(); flush()`)
const s0 = await seen()
ok('to begin with every row is as tall as the room’s rows', s0.heads.every((r, k) => r && r[1] === 25 && r[0] === s0.heads[0][0] + k * 25) && s0.h.every(h => !h), s0.heads)

/* one row pulled taller */
{ const l = await line(1)
  ok('the line under a row can be taken hold of, and says so with its pointer', l.under.a === 'rowh' && l.under.i === '1' && l.cur === 'ns-resize', [l.under, l.cur])
  await mouse('mouseMoved', l.x, l.y, { buttons: 0 }); await mouse('mousePressed', l.x, l.y)
  for (let k = 1; k <= 6; k++) await mouse('mouseMoved', l.x, l.y + k * 5)
  await b.sleep(120)
  const mid = await seen()
  ok('while it is being pulled the row is already taller on the screen', mid.heads[1][1] === 55 && mid.h[1] === 55 && mid.pull === 1, mid.heads[1])
  ok('…the rows below it have moved down by as much, in the heads and on the lanes', mid.heads[2][0] === s0.heads[2][0] + 30 && mid.heads[3][0] === s0.heads[3][0] + 30 && mid.lanes[2] === s0.lanes[2] + 30 && mid.lanes[1] === s0.lanes[1], [mid.heads[2], mid.lanes])
  ok('…and the rows above it, and every other row’s height, are as they were', mid.heads[0][0] === s0.heads[0][0] && mid.heads[0][1] === 25 && mid.heads[2][1] === 25, mid.heads)
  await mouse('mouseReleased', l.x, l.y + 30); await b.sleep(80)
  const end = await seen()
  ok('let go: the row keeps its height, the others have none of their own', end.h[1] === 55 && end.h.filter(Boolean).length === 1 && end.pull == null, end.h) }

/* where things are follows the heights */
{ const r = await ev(`flush(); const y1 = rowY(1), y2 = rowY(2); return { in1: laneAt(y1 + 50), in2: laneAt(y2 + 3), last: laneAt(TY + rowTops().all - VY + 400), all: rowTops().all, n: rows().length, max: maxVY(), wave: (() => { const el = LANES.rows.get(S.tracks[1].id); return el.el.innerHTML.length })() }`)
  ok('a place fifty down a tall row is still that row; three into the next is the next', r.in1 === 1 && r.in2 === 2, r)
  ok('all the rows together are as tall as their heights added up', r.all === (r.n - 1) * 25 + 55, [r.all, r.n]) }
{ const r = await ev(`const j = serialize(); const o = JSON.parse(j); return { h: o.tracks.map(t => t.h || 0), changed: typeof leaveChanged === 'function' ? leaveChanged() : null }`)
  ok('the height is written with the project', r.h[1] === 55 && r.h.filter(Boolean).length === 1, r.h)
  ok('…and is not a change of the song (closing does not ask because of it)', r.changed === false, r.changed) }

/* a track dropped between two rows lands where the hand is, tall rows and all */
{ const names0 = await ev(`return S.tracks.map(t => t.name)`)
  const p = await ev(`flush(); return { x: 60, y0: rowY(5) + 12, y1: rowY(2) + 1 }`)
  await mouse('mouseMoved', p.x, p.y0, { buttons: 0 }); await mouse('mousePressed', p.x, p.y0)
  for (let k = 1; k <= 8; k++) await mouse('mouseMoved', p.x, p.y0 + (p.y1 - p.y0) * k / 8)
  await b.sleep(80)
  const mid = await ev(`return S.reorder`)
  await mouse('mouseReleased', p.x, p.y1); await b.sleep(80)
  const names1 = await ev(`flush(); return S.tracks.map(t => t.name)`)
  ok('a track pulled to the gap under the tall row goes there', mid === 2 && names1[2] === names0[5] && names1[1] === names0[1], [mid, names1.slice(0, 6)])
  await ev(`undoEdit(); flush()`)
  ok('…and the tall row is still the tall one after that is undone', (await seen()).h[1] === 55) }

/* twice on the line: the room's height again */
{ const l = await line(1)
  await b.click(l.x, l.y); await b.click(l.x, l.y); await b.sleep(120)
  const s = await seen()
  ok('twice on the line puts the row back to the room’s height', !s.h[1] && s.heads[1][1] === 25 && s.heads[2][0] === s0.heads[2][0], [s.h, s.heads[1]]) }

/* several chosen: they take the height together; it stops at the shortest and the tallest a row may be */
{ await ev(`chooseTrack(3, ''); chooseTrack(4, 'range'); flush()`)
  const l = await line(4)
  await mouse('mouseMoved', l.x, l.y, { buttons: 0 }); await mouse('mousePressed', l.x, l.y)
  for (let k = 1; k <= 5; k++) await mouse('mouseMoved', l.x, l.y + k * 8)
  await b.sleep(100)
  const mid = await seen()
  ok('one of two chosen rows pulled: both are taller, on the screen too', mid.h[3] === 65 && mid.h[4] === 65 && mid.heads[3][1] === 65 && mid.heads[4][1] === 65, [mid.h, mid.heads[3], mid.heads[4]])
  for (let k = 1; k <= 6; k++) await mouse('mouseMoved', l.x, l.y + 40 + k * 200)
  await b.sleep(80)
  const tall = await seen()
  ok('a row is never taller than the tallest a row may be', tall.h[3] === 240 && tall.h[4] === 240, tall.h)
  for (let k = 1; k <= 6; k++) await mouse('mouseMoved', l.x, l.y - k * 200)
  await b.sleep(80)
  const low = await seen()
  ok('…nor shorter than the shortest', low.h[3] === 20 && low.h[4] === 20, low.h)
  await mouse('mouseMoved', l.x, l.y); await mouse('mouseReleased', l.x, l.y); await b.sleep(80)
  const back = await seen()
  ok('pulled back to exactly the room’s height: it has no height of its own any more', !back.h[3] && !back.h[4], back.h) }

/* the room's rows made taller: a row with a height of its own keeps it */
{ await ev(`S.tracks[1].h = 70; setRowH(40); flush()`)
  const s = await seen()
  ok('taller rows for the room: the one with its own height keeps it, the rest follow', s.heads[1][1] === 70 && s.heads[0][1] === 40 && s.heads[2][1] === 40 && s.heads[2][0] === s.heads[0][0] + 110, s.heads)
  await ev(`delete S.tracks[1].h; setRowH(25); VY = 0; chooseTrack(0, ''); dirtyAll(); flush()`) }

{ const errs = await ev(`return window.__errs || []`)
  ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n'))
console.log(bad.length ? `rowh: ${bad.length} FAILED\n  ${bad.join('\n  ')}` : 'rowh: all passed')
await b.close()
process.exit(bad.length ? 1 : 0)
