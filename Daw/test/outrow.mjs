// node test/outrow.mjs — the stereo out as a row of its own under the last track (his ask, 2026-10-21): it is there in
// the heads and in the lanes; pressed (its name, or its lane) it is chosen and its patch opens below, to put things on;
// a track pressed after it takes the patch back; its level is pulled across like a track's (with option, 0); the rows
// scroll as far as it. Real presses; what is drawn is read back.
import { open, PAGE } from './cdp.mjs'
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined && !cond ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(600)
const ev = b.ev
const mouse = (type, x, y, extra = {}) => b.send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' }, extra))
const click = async (p, extra = {}) => { await mouse('mouseMoved', p.x, p.y, { buttons: 0 }); await mouse('mousePressed', p.x, p.y, extra); await mouse('mouseReleased', p.x, p.y, extra); await b.sleep(150) }
const pull = async (from, dx, dy) => { await mouse('mouseMoved', from.x, from.y, { buttons: 0 }); await mouse('mousePressed', from.x, from.y); for (let k = 1; k <= 8; k++) await mouse('mouseMoved', from.x + dx * k / 8, from.y + dy * k / 8); await mouse('mouseReleased', from.x + dx, from.y + dy); await b.sleep(150) }
const box = (sel, k = 0) => ev(`const el = [...document.querySelectorAll('${sel}')][${k}]; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, l: r.x, r: r.right, t: r.y, b: r.bottom }`)

await ev(`if (typeof START !== 'undefined') START.on = false; tpanelSet(true, false); S.panel.on = false; setView(true); dirtyAll(); flush(); return 1`)
const rows = await ev(`flush(); const L = rowTops(); return { last: TY + L.all - VY, rh: S.rh }`)
const head = await box('#g-head [data-a="wall-out"]'), lane = await box('#ln-out rect')      // (its lane's ground: it has no press of its own since 2026-10-23)
ok('the stereo out has a row under the last track, in the heads and the lanes', !!head && !!lane && Math.abs(head.t - rows.last) < 2 && Math.abs(lane.t - rows.last) < 2, { head, lane, rows })
ok('…its name, as the tracks say theirs', await ev(`return [...document.querySelectorAll('#g-head text')].some(el => el.textContent === 'stereo out')`))
/* chosen: its patch opens */
await click({ x: head.l + 60, y: head.y })
const chosen = await ev(`flush(); return { out: !!WALL.out, panel: S.panel.on, tab: S.panel.tab, wall: wallTrack() === OUT }`)
ok('its name pressed: chosen, its patch open below', chosen.out && chosen.panel && chosen.tab === 'patch' && chosen.wall, chosen)
await ev(`WALL.out = false; uiDirty('dock', 'head'); flush(); return 1`)
await click({ x: lane.x, y: lane.t + 2 })      // (at its top edge: its middle is where its volume line runs, and a press there is the line's)
ok('its lane pressed: no patch (his ask, 2026-10-23: only its head opens it)', await ev(`flush(); return !WALL.out`))
/* a track pressed after it */
{ const t = await box('#g-head [data-a="sel"]', 2); await click(t) }
ok('a track pressed after it: the patch is the track\'s again', await ev(`flush(); return !WALL.out && wallTrack() === S.tracks[S.sel]`))
/* its level */
await ev(`S.master = -6; dirtyAll(); flush(); return 1`)
{ const v = await box('#g-head [data-a="outvol"]'); await pull({ x: v.l + 6 + (v.r - v.l - 12) * .5, y: v.y }, 40, 0) }
const m1 = await ev(`return S.master`)
ok('its level pulled across: the out\'s level moves', m1 > -6, m1)
ok('…and the row says it', await ev(`flush(); return [...document.querySelectorAll('#g-head text')].some(el => el.textContent === fmtDb(S.master))`))
await click(await box('#g-head [data-a="outvol"]'), { modifiers: 1 })
ok('with option: 0', await ev(`return S.master`) === 0, await ev(`return S.master`))
/* the rows scroll as far as it */
await ev(`S.rh = 80; relayout(); VY = maxVY(); dirtyAll(); flush(); return 1`)
const end = await ev(`flush(); const r = document.querySelector('#g-head [data-a="wall-out"]'); if (!r) return null; const q = r.getBoundingClientRect(); return { bottom: q.bottom, BY }`)
ok('scrolled to the end: its row in sight above the panel', !!end && end.bottom <= end.BY + 2, end)
await ev(`S.rh = 25; relayout(); VY = 0; dirtyAll(); flush(); return 1`)
{ const errs = await ev(`return window.__errs || []`); ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close(); process.exit(bad.length ? 1 : 0)
