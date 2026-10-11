// node test/roll.mjs [w h] — the notes page (key p; a region of notes pressed twice): a region's notes against the keys,
// chosen, pulled along the grid and up and down the keys, made longer, made, copied, taken away; how hard in the lane
// below; the keys' own keys; a kit against its pads. A real pointer and real keys.
import { open, PAGE } from './cdp.mjs'
import { readFileSync } from 'node:fs'
const [ww, hh] = [+process.argv[2] || 1440, +process.argv[3] || 900]
const b = await open(PAGE, { width: ww, height: hh, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
for (const evn of ['uncaughtException', 'unhandledRejection']) process.on(evn, e => { console.log(out.join('\n')); console.log('THREW', e && e.stack); process.exit(1) })
const ev = b.ev, ALT = 1, CMD = 4, SHIFT = 8
// (until the page reads roll.js by itself, the check reads it in)
await ev(`if (typeof ROLL === 'undefined') { const s = document.createElement('script'); s.textContent = ${JSON.stringify(readFileSync(new URL('../ui/roll.js', import.meta.url), 'utf8'))}; document.head.appendChild(s) } setView(true); dirtyAll(); flush()`)
const notes = () => ev(`flush(); const [r] = rollReg(); return r ? r.notes.map(x => [+x.t.toFixed(4), +x.d.toFixed(4), x.n, x.v, x.id]) : null`)
const sel = () => ev(`return [...ROLL.sel]`)
const rect = q => ev(`flush(); const el = document.querySelector(${JSON.stringify(q)}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, l: r.left, r: r.right, t: r.top, w: r.width, h: r.height, hit: document.elementFromPoint(r.left + Math.min(3, r.width / 2), r.top + r.height / 2) === el }`)
const noteEl = id => rect(`[data-a="np"][data-k="note"][data-i="${id}"]`)
// a place on the paper: so many bars from zero, on a key
const place = (bar, key) => ev(`flush(); const g = ROLL.g, bd = document.getElementById('board').getBoundingClientRect(), k = bd.width / W, row = g.kit ? DRUM_PADS.length - 1 - DRUM_PADS.findIndex(q => q[1] === ${key}) : g.hi - ${key}; return { x: bd.left + (g.x0 + (${bar} - ROLL.view.a) * g.pxb) * k, y: bd.top + (g.top + (row + .5) * g.rowH) * k, step: rollStep() * g.pxb * k, row: g.rowH * k, pxb: g.pxb * k }`)
const key = (k, code, vk, mods = 0) => b.press(k, code, vk, mods).then(() => b.sleep(60))
const twice = async (x, y) => { await b.click(x, y); await b.sleep(40); await b.click(x, y); await b.sleep(80) }

const ids = await ev(`
  S.snap = true; S.tool = 'pointer'; S.auto = false; S.flex = false
  const t = newInstTrack('synth', 'e piano'); t.name = 'rhodes'
  const r = mkReg({ a: 5, b: 7, loop: false, notes: [mkNote(0, 1, 60, 100), mkNote(1, 1, 64, 60), mkNote(2, 2, 67, 120)] }); t.regs = [r]
  const far = mkReg({ a: 9, b: 10, loop: false, notes: [mkNote(0, 1, 72, 90)] }); t.regs.push(far)
  S.selR = [r.id]; repaint(); showRow(S.tracks.indexOf(t)); dirtyAll(); flush()
  return { r: r.id, far: far.id, n: r.notes.map(x => x.id), ti: S.tracks.indexOf(t), h0: S.panel.h, on0: S.panel.on }`)

// ── it comes and goes ──
await key('p', 'KeyP', 80)
ok('p: the notes page is up under the lanes, taller than a patch, and has the keys', await ev(`flush(); return rollOn() && S.focus === 'notes' && S.panel.h >= Math.min(460, ${ids.h0}) && document.querySelectorAll('[data-a="np"][data-k="note"]').length === 3`), await ev(`return [rollOn(), S.focus, S.panel.h, document.querySelectorAll('[data-a="np"][data-k="note"]').length]`))
ok('it shows the chosen region, from a little before its beginning, the keys about its notes', await ev(`const V = ROLL.view, g = ROLL.g; return ROLL.rid === ${ids.r} && V.a < 4 && V.a > 3.5 && g.hi >= 67 && g.hi - g.count + 1 <= 60`), await ev('return [ROLL.rid, ROLL.view, ROLL.g.hi, ROLL.g.count]'))
ok('every note of it can be reached', (await Promise.all(ids.n.map(noteEl))).every(r => r && r.hit))
await key('p', 'KeyP', 80)
ok('p again: away, the panel as tall as it was', await ev(`flush(); return !S.panel.on && S.panel.h === ${ids.h0}`), await ev('return [S.panel.on, S.panel.h]'))
// a region of notes pressed twice in the lanes
{ const q = await ev(`flush(); const [r, t] = regOf(${ids.r}), bd = document.getElementById('board').getBoundingClientRect(), k = bd.width / W; return { x: bd.left + (bx(r.a) + 30) * k, y: bd.top + (rowY(S.tracks.indexOf(t)) + S.rh / 2) * k }`)
  await twice(q.x, q.y)
  ok('a region of notes pressed twice on its lane: its notes', await ev(`flush(); return rollOn() && ROLL.rid === ${ids.r}`)) }
await ev(`setView(true); relayout(); dirtyAll(); flush()`); await b.sleep(450)                // (the panel has come up all the way)

// ── choosing ──
{ const a = await noteEl(ids.n[0]); await b.click(a.x, a.y); await b.sleep(60)
  ok('a note pressed is the chosen one, framed', JSON.stringify(await sel()) === JSON.stringify([ids.n[0]]))
  const c = await noteEl(ids.n[2]); await b.click(c.x, c.y, SHIFT); await b.sleep(60)
  ok('with shift, one more', (await sel()).length === 2)
  await b.click(c.x, c.y, SHIFT); await b.sleep(60)
  ok('with shift again, one less', JSON.stringify(await sel()) === JSON.stringify([ids.n[0]])) }
// ── pulled along the grid and up the keys ──
{ const was = await notes(), a = await noteEl(ids.n[0]), p = await place(4, 60)
  await b.dragTo(a.x, a.y, a.x + p.step * 4, a.y - p.row * 2, 8); await b.sleep(80)
  const now = await notes(), m = now.find(x => x[4] === ids.n[0])
  ok('pulled a beat to the right and two keys up: a quarter note later, two keys higher; the others where they were', m[0] === 1 && m[2] === 62 && now.filter(x => x[4] !== ids.n[0]).every((x, i) => JSON.stringify(x) === JSON.stringify(was.filter(y => y[4] !== ids.n[0])[i])), now)
  await key('z', 'KeyZ', 90, CMD)
  ok('one undo: as it was', JSON.stringify(await notes()) === JSON.stringify(was), await notes()) }
// ── its end pulled ──
{ const was = await notes(), c = await noteEl(ids.n[2]), p = await place(4, 60), e = await rect(`[data-a="np"][data-k="len"][data-i="${ids.n[2]}"]`)
  ok('a long note has its end to take hold of', !!e && e.hit, e)
  await b.dragTo(e.x, e.y, e.x + p.step * 4, e.y, 8); await b.sleep(80)
  const m = (await notes()).find(x => x[4] === ids.n[2])
  ok('its end pulled a beat out: a quarter note longer, beginning where it did', m[1] === 3 && m[0] === 2, m)
  await key('z', 'KeyZ', 90, CMD) }
// ── made, and taken away ──
{ const n0 = (await notes()).length, p = await place(4 + 3 / 16 + .01, 65)
  await twice(p.x, p.y)
  const now = await notes(), made = now.find(x => !ids.n.includes(x[4]))
  ok('the paper pressed twice: a note there, on the grid and on that key, as long as a step, chosen', now.length === n0 + 1 && !!made && Math.abs(made[0] - .75) < 1e-6 && made[2] === 65 && Math.abs(made[1] - .25) < 1e-6 && JSON.stringify(await sel()) === JSON.stringify([made[4]]), made)
  await key('Backspace', 'Backspace', 8)
  ok('the delete key takes the chosen note away — and nothing else: the region is still there', (await notes()).length === n0 && (await ev(`return !!regOf(${ids.r})[0] && S.tracks[${ids.ti}].regs.length === 2`)), await notes()) }
// ── a pull over the paper chooses what it crosses ──
{ const p0 = await place(3.9, 70), p1 = await place(5.6, 58)
  await b.dragTo(p0.x, p0.y, p1.x, p1.y, 8); await b.sleep(80)
  ok('a pull over the paper chooses what it crosses', (await sel()).length === 3, await sel())
  await key('ArrowUp', 'ArrowUp', 38, ALT)
  ok('option and the up arrow: the chosen notes a key higher', JSON.stringify((await notes()).map(x => x[2])) === JSON.stringify([61, 65, 68]), await notes())
  await key('ArrowDown', 'ArrowDown', 40, ALT | SHIFT); await key('ArrowDown', 'ArrowDown', 40, ALT)
  ok('with shift an octave; then back down a key', JSON.stringify((await notes()).map(x => x[2])) === JSON.stringify([48, 52, 55]), await notes())
  await key('ArrowUp', 'ArrowUp', 38, ALT | SHIFT)
  await key('ArrowRight', 'ArrowRight', 39, ALT)
  ok('option and the right arrow: a step later', JSON.stringify((await notes()).map(x => x[0])) === JSON.stringify([.25, 1.25, 2.25]), await notes())
  await key('ArrowLeft', 'ArrowLeft', 37, ALT)
  await key('Escape', 'Escape', 27)
  ok('escape lets them go', (await sel()).length === 0) }
// ── copies ──
{ const n0 = (await notes()).length
  await key('a', 'KeyA', 65, CMD)
  ok('command a: every note of the region', (await sel()).length === n0)
  await key('c', 'KeyC', 67, CMD)
  await ev(`jumpTo(5.5); flush()`)
  await key('v', 'KeyV', 86, CMD)
  const now = await notes()
  ok('copied, and put down at the playhead: as many again, the first of them there, chosen', now.length === 2 * n0 && (await sel()).length === n0 && Math.abs(Math.min(...now.filter(x => !ids.n.includes(x[4])).map(x => x[0])) - 6) < 1e-6, now)
  await key('z', 'KeyZ', 90, CMD)
  const a = await noteEl(ids.n[1]), p = await place(4, 60)
  await b.click(a.x, a.y); await b.sleep(40)
  await b.dragTo(a.x, a.y, a.x + p.step * 8, a.y, 8, ALT); await b.sleep(80)
  const after = await notes(), orig = after.find(x => x[4] === ids.n[1]), copy = after.find(x => !ids.n.includes(x[4]))
  ok('pulled with option: the note stays, a copy of it goes', after.length === n0 + 1 && orig[0] === 1 && !!copy && copy[0] === 3 && copy[2] === orig[2], after)
  await key('z', 'KeyZ', 90, CMD) }
// ── how hard ──
{ const a = await noteEl(ids.n[0]), g = await ev(`const g = ROLL.g, bd = document.getElementById('board').getBoundingClientRect(), k = bd.width / W; return { base: bd.top + g.base * k, room: g.room * k }`)
  const fill0 = await ev(`return document.getElementById('g-dock').innerHTML.includes('${''}')`)
  await b.dragTo(a.l + 2, g.base - g.room * .9, a.l + 2, g.base - g.room * .25, 6); await b.sleep(80)
  const m = (await notes()).find(x => x[4] === ids.n[0])
  ok('in the lane below, its bar pulled down: played softer', m[3] >= 28 && m[3] <= 36, m)
  ok('and its colour is the cool ink now', await ev(`const [r] = rollReg(), x = r.notes.find(q => q.id === ${ids.n[0]}); return rollColor(x.v) !== rollColor(100) && document.getElementById('g-dock').innerHTML.includes(rollColor(x.v))`))
  await key('z', 'KeyZ', 90, CMD) }
// ── past the region's end ──
{ const c = await noteEl(ids.n[2]), p = await place(4, 60)
  await b.click(c.x, c.y); await b.sleep(40)
  await b.dragTo(c.x, c.y, c.x + p.pxb * 2, c.y, 8); await b.sleep(80)
  ok('a note pulled past the region\'s end: the region is longer by whole bars, no further than the next one', await ev(`const [r] = regOf(${ids.r}); return r.b > 7 && r.b <= 9 && Number.isInteger(r.b)`), await ev(`return regOf(${ids.r})[0].b`))
  await key('z', 'KeyZ', 90, CMD) }
// ── the keys down the left, the ruler, the grid ──
{ const k = await rect('[data-a="np"][data-k="key"][data-v="64"]')
  await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: k.x, y: k.y, buttons: 0 }); await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: k.x, y: k.y, button: 'left', buttons: 1, clickCount: 1 }); await b.sleep(60)
  const down = await ev('return ROLL.key')
  await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: k.x, y: k.y, button: 'left', buttons: 0, clickCount: 1 }); await b.sleep(60)
  ok('a key down the left is held while it is pressed', down === 64 && (await ev('return ROLL.key')) == null, down)
  const r = await rect('[data-a="np"][data-k="ruler"]'), p = await place(5, 60)
  await b.click(p.x, r.y); await b.sleep(60)
  ok('the bars along its top pressed: the playhead goes there', Math.abs((await ev('return curPos()')) - 5) < 1e-6, await ev('return curPos()'))
  const gk = await rect('[data-a="np"][data-k="grid"]'); await b.click(gk.x, gk.y); await b.sleep(80)
  const it = await ev(`flush(); const i = S.menu ? S.menu.items.findIndex(x => x.t === '1/8') : -1, el = i < 0 ? null : document.querySelector('[data-a="pick"][data-i="' + i + '"]'); if (!el) return null; const q = el.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2, n: S.menu.items.length }`)
  ok('its grid has a list of its own', !!it && it.n === 7, it)
  await b.click(it.x, it.y); await b.sleep(80)
  ok('picked: the page\'s grid is that', (await ev('return ROLL.grid')) === '1/8')
  await ev(`ROLL.grid = '1/16'; uiDirty('dock'); flush()`) }
// ── the wheel ──
{ const p = await place(4.5, 62), v0 = await ev('return Object.assign({}, ROLL.view)')
  await b.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: p.x, y: p.y, deltaX: 0, deltaY: 60 }); await b.sleep(80)
  const v1 = await ev('return Object.assign({}, ROLL.view)')
  await b.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: p.x, y: p.y, deltaX: 0, deltaY: -40, modifiers: CMD }); await b.sleep(80)
  const v2 = await ev('return Object.assign({}, ROLL.view)')
  ok('the wheel goes down the keys; with command it draws the time nearer about the pointer; the lanes above stay', v1.hi < v0.hi && v1.a === v0.a && (v2.b - v2.a) < (v1.b - v1.a) && v2.hi === v1.hi, [v0, v1, v2])
  await ev(`Object.assign(ROLL.view, ${JSON.stringify(v0)}); uiDirty('dock'); flush()`) }
// ── the other pages show its tab ──
{ await key('b', 'KeyB', 66)
  ok('b: the patch, at its own height; its bar has the notes tab', await ev(`flush(); return S.panel.tab === 'patch' && S.panel.h === ${ids.h0} && !!document.querySelector('[data-a="tab-notes"]')`), await ev('return [S.panel.tab, S.panel.h]'))
  const t = await rect('[data-a="tab-notes"]'); await b.click(t.x, t.y); await b.sleep(80)
  ok('the tab pressed: the notes again', await ev(`flush(); return rollOn() && S.panel.h >= Math.min(460, ${ids.h0})`)) }
// ── a kit ──
const kit = await ev(`const t = newInstTrack('drums'); const r = mkReg({ a: 5, b: 6, loop: false, notes: [mkNote(0, .25, 36, 110), mkNote(1, .25, 38, 100)] }); t.regs = [r]; S.selR = [r.id]; repaint(); showRow(S.tracks.indexOf(t)); dirtyAll(); flush(); return { r: r.id, n: r.notes.map(x => x.id) }`)
ok('on a kit: sixteen pads down the left, each the drum it is, and its strokes', await ev(`flush(); return ROLL.g.kit && ROLL.g.count === 16 && document.querySelectorAll('[data-a="np"][data-k="key"]').length === 16 && document.querySelectorAll('[data-a="np"][data-k="note"]').length === 2`), await ev(`return [ROLL.g.kit, ROLL.g.count, document.querySelectorAll('[data-a="np"][data-k="note"]').length]`))
{ const p = await place(4 + 2 / 4 + .01, 42)
  await b.click(p.x, p.y); await b.sleep(80)
  const now = await notes(), made = now.find(x => !kit.n.includes(x[4]))
  ok('one press on the paper: a stroke on that pad, on that step', !!made && made[2] === 42 && Math.abs(made[0] - 2) < 1e-6, now)
  const h = await noteEl(made[4]), q = await place(4, 46)
  await b.dragTo(h.x, h.y, h.x, q.y, 6); await b.sleep(80)
  ok('pulled up: another pad', (await notes()).find(x => x[4] === made[4])[2] === 46, await notes())
  const h2 = await noteEl(made[4]); await twice(h2.x, h2.y)
  ok('a stroke pressed twice goes', !(await notes()).some(x => x[4] === made[4]) && (await notes()).length === 2, await notes()) }
// ── a track of sound ──
await ev(`leadTrack(0); S.selR = []; uiDirty('head', 'dock', 'lanes'); flush()`)
ok('on a track of sound the page says so and holds nothing to press', await ev(`return document.getElementById('g-dock').textContent.includes('a track of sound') && document.querySelectorAll('[data-a="np"][data-k="note"]').length === 0`))
ok('no errors on the page', (await ev('return window.__errs')).length === 0 && b.errors.length === 0, [await ev('return window.__errs'), b.errors])
if (process.env.PICS) { const { writeFileSync } = await import('node:fs')
  const shot = async name => { await b.sleep(120); const r = await b.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); writeFileSync(process.env.PICS + name + '.png', Buffer.from(r.data, 'base64')) }
  await ev(`leadTrack(${ids.ti}); S.selR = [${ids.r}]; const [r] = regOf(${ids.r}); setNotes(r, [[0,1.4,57,110],[0,1.4,60,96],[0,1.4,64,84],[0,1.4,67,100],[1.5,.9,57,60],[1.5,.9,60,52],[1.5,.9,64,48],[2.5,1.4,57,78],[2.5,1.4,60,70],[2.5,1.4,65,66],[2.5,1.4,69,90],[4,.9,57,96],[4,.9,60,80],[4,.9,65,72],[5.5,1.4,57,64],[5.5,1.4,60,58],[5.5,1.4,65,50],[7,.45,71,40],[7.5,.45,72,74],[0,3.4,45,104],[4,3.4,41,98]].map(q => mkNote(...q))); ROLL.sel = new Set(); ROLL.rid = null; uiDirty('head', 'dock', 'lanes'); flush()`)
  await shot('notes page, keys')
  await ev(`leadTrack(S.tracks.findIndex(t => t.inst && t.inst.kind === 'drums')); const t = S.tracks[S.sel], r = t.regs[0]; r.b = 7; const ns = []; for (let k = 0; k < 2; k++) { const q = k * 4; for (const at of [0, 1.5, 2.5]) ns.push([q + at, .25, 36, at ? 98 : 122]); ns.push([q + 1, .25, 38, 112], [q + 3, .25, 38, 120], [q + 2.25, .25, 38, 30]); for (let h = 0; h < 8; h++) ns.push([q + h * .5, .25, 42, h % 2 ? 46 : 92]); if (!k) ns.push([q, .25, 49, 108]); ns.push([q + 3.5, .25, 46, 88]) } setNotes(r, ns.map(q => mkNote(...q))); S.selR = [r.id]; ROLL.rid = null; uiDirty('head', 'dock', 'lanes'); flush()`)
  await shot('notes page, kit') }
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close()
