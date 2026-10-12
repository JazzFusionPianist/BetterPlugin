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
// ── the lane under the notes: a pulls it up ──
ok('the lane under the notes is away until it is asked for', await ev(`flush(); return ROLL.lane === false && !document.querySelector('[data-a="np"][data-k="vel"]') && !!document.querySelector('[data-a="np"][data-k="lane"]')`))
{ const a = await noteEl(ids.n[0]); await b.click(a.x, a.y); await b.sleep(40)
  const auto0 = await ev('return S.auto')
  await key('a', 'KeyA', 65)
  ok('a, with the page having the keys: the lane comes up, showing how hard — and the lanes above are not put into their own automation', await ev(`flush(); return ROLL.lane === true && !!document.querySelector('[data-a="np"][data-k="vel"]') && S.auto === ${auto0} && ROLL.param === 'velocity'`), await ev('return [ROLL.lane, S.auto]')) }
// ── how hard ──
{ const a = await noteEl(ids.n[0]), g = await ev(`const g = ROLL.g, bd = document.getElementById('board').getBoundingClientRect(), k = bd.width / W; return { base: bd.top + g.base * k, room: g.room * k }`)
  const fill0 = await ev(`return document.getElementById('g-dock').innerHTML.includes('${''}')`)
  await b.dragTo(a.l + 2, g.base - g.room * .9, a.l + 2, g.base - g.room * .25, 6); await b.sleep(80)
  const m = (await notes()).find(x => x[4] === ids.n[0])
  ok('in the lane below, its bar pulled down: played softer', m[3] >= 28 && m[3] <= 36, m)
  ok('and its colour is the cool ink now', await ev(`const [r] = rollReg(), x = r.notes.find(q => q.id === ${ids.n[0]}); return rollColor(x.v) !== rollColor(100) && document.getElementById('g-dock').innerHTML.includes(rollColor(x.v))`))
  await key('z', 'KeyZ', 90, CMD) }
// ── something turned along the region ──
{ const pk = await rect('[data-a="np"][data-k="param"]'); await b.click(pk.x, pk.y); await b.sleep(80)
  const it = await ev(`flush(); const i = S.menu ? S.menu.items.findIndex(x => x.t === 'modulation') : -1, el = i < 0 ? null : document.querySelector('[data-a="pick"][data-i="' + i + '"]'); if (!el) return null; const q = el.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2, n: S.menu.items.length }`)
  ok('what the lane shows is picked from a list: the named ones, and a way on to every other controller', !!it && it.n === 11, it)
  await b.click(it.x, it.y); await b.sleep(80)
  ok('modulation picked: the lane is its own now, with nothing in it yet', await ev(`flush(); return ROLL.param === 'modulation' && !!document.querySelector('[data-a="np"][data-k="clane"]') && document.querySelectorAll('[data-a="np"][data-k="cpt"]').length === 0`))
  const G = await ev(`const g = ROLL.g, bd = document.getElementById('board').getBoundingClientRect(), k = bd.width / W; return { base: bd.top + g.base * k, room: g.room * k, x: bar => 0 }`), p0 = await place(4, 60), p1 = await place(5, 60)
  await b.click(p0.x, G.base - G.room * .25); await b.sleep(80)
  await b.click(p1.x, G.base - G.room * .75); await b.sleep(80)
  const ctl = () => ev(`const [r] = rollReg(); return (r.ctl || []).map(q => [+q.t.toFixed(3), q.c, q.v, q.id])`)
  const c1 = await ctl()
  ok('a press in the lane puts a point there; another, another: at their places on the grid, as high as they were put', c1.length === 2 && c1[0][0] === 0 && c1[1][0] === 4 && c1.every(q => q[1] === 1) && Math.abs(c1[0][2] - 32) <= 4 && Math.abs(c1[1][2] - 95) <= 4, c1)
  const flat = await ev(`const t = S.tracks[S.sel], f = trackCtl(t), out = []; for (let i = 0; i < f.length; i += 4) out.push([f[i], f[i + 1], f[i + 2], f[i + 3]]); return out`)
  ok('the engine is told the line between them as a ramp: many steps, each a little higher and later than the last', flat.length > 20 && flat.every((q, i) => q[1] === 0xB0 && q[2] === 1 && (!i || (q[0] > flat[i - 1][0] && q[3] >= flat[i - 1][3]))) && flat[0][3] === c1[0][2] && flat[flat.length - 1][3] === c1[1][2], [flat.length, flat[0], flat[flat.length - 1]])
  const pt = await rect(`[data-a="np"][data-k="cpt"][data-i="${c1[1][3]}"]`)
  ok('a point can be taken hold of', !!pt && pt.hit, pt)
  await b.dragTo(pt.x, pt.y, pt.x - p0.step * 4, G.base - G.room * .5, 6); await b.sleep(80)
  const c2 = await ctl(), m = c2.find(q => q[3] === c1[1][3])
  ok('pulled: a beat earlier, and lower', m[0] === 3 && Math.abs(m[2] - 64) <= 4, c2)
  await key('z', 'KeyZ', 90, CMD)
  ok('one undo: where it was', JSON.stringify(await ctl()) === JSON.stringify(c1), await ctl())
  const pt2 = await rect(`[data-a="np"][data-k="cpt"][data-i="${c1[0][3]}"]`); await b.click(pt2.x, pt2.y); await b.sleep(60)
  { const n0 = await notes(); await ev(`ROLL.sel = new Set([${ids.n[0]}]); uiDirty('dock'); flush()`)
    await key('ArrowRight', 'ArrowRight', 39, ALT); await key('ArrowUp', 'ArrowUp', 38, ALT)
    const c3 = await ctl(), m3 = c3.find(q => q[3] === c1[0][3])
    ok('option and the arrows, with a point of the lane chosen: the point goes a step later and a little higher — it alone, though a note is chosen too', Math.abs(m3[0] - .25) < 1e-6 && m3[2] === c1[0][2] + 1 && JSON.stringify(await notes()) === JSON.stringify(n0), [c3, await notes()])
    await key('ArrowLeft', 'ArrowLeft', 37, ALT); await key('ArrowDown', 'ArrowDown', 40, ALT)
    ok('and back', JSON.stringify(await ctl()) === JSON.stringify(c1), await ctl())
    await ev(`ROLL.sel = new Set(); uiDirty('dock'); flush()`) }
  const notes0 = (await notes()).length
  await key('Backspace', 'Backspace', 8)
  ok('the delete key takes the chosen point away, and no note', (await ctl()).length === 1 && (await notes()).length === notes0, await ctl())
  const pt3 = await rect(`[data-a="np"][data-k="cpt"][data-i="${c1[1][3]}"]`); await twice(pt3.x, pt3.y)
  ok('a point pressed twice goes', (await ctl()).length === 0, await ctl())
  // any controller by its number
  { const pk2 = await rect('[data-a="np"][data-k="param"]'); await b.click(pk2.x, pk2.y); await b.sleep(80)
    const pickT = async txt => { const q = await ev(`flush(); const i = S.menu ? S.menu.items.findIndex(x => x.t === ${JSON.stringify(txt)}) : -1, el = i < 0 ? null : document.querySelector('[data-a="pick"][data-i="' + i + '"]'); if (!el) return null; const z = el.getBoundingClientRect(); return { x: z.left + z.width / 2, y: z.top + z.height / 2 }`); if (!q) return false; await b.click(q.x, q.y); await b.sleep(120); return true }
    const a1 = await pickT('another controller'), a2 = await pickT('16 to 31'), a3 = await pickT('23')
    ok('another controller, then its sixteen, then its number: the lane is controller 23\'s', a1 && a2 && a3 && (await ev('return ROLL.param')) === 'cc 23' && (await ev('return rollParam()[1]')) === 23, [a1, a2, a3, await ev('return ROLL.param')])
    const p9 = await place(4.5, 60); await b.click(p9.x, G.base - G.room * .5); await b.sleep(80)
    ok('a point put there is that controller\'s, and the engine is told so', (await ctl()).some(q => q[1] === 23) && (await ev(`const f = trackCtl(S.tracks[S.sel]); return f[1] === 0xB0 && f[2] === 23`)), await ctl())
    await key('z', 'KeyZ', 90, CMD) }
  await ev(`ROLL.param = 'velocity'; uiDirty('dock'); flush()`) }
// ── the panel at the left ──
{ ok('the panel at the left does not lie on the keys: every key and every note can still be reached', (await rect('[data-a="np"][data-k="key"][data-v="64"]')).hit && (await noteEl(ids.n[1])).hit)
  const T = () => notes().then(l => l.map(x => x[0]))
  await ev(`const [r] = regOf(${ids.r}); setNotes(r, r.notes.map((x, i) => Object.assign({}, x, { t: [.07, 1.1, 2.3][i] }))); ROLL.qv = '1/16'; ROLL.qs = 1; ROLL.sw = 0; ROLL.sel = new Set([${ids.n[0]}, ${ids.n[1]}]); uiDirty('dock'); flush()`)
  const on = await rect('[data-a="np"][data-k="qon"]'); await b.click(on.x, on.y); await b.sleep(80)
  ok('its q: the chosen notes go to the grid — only they; the region itself is not told to quantize', JSON.stringify(await T()) === JSON.stringify([0, 1, 2.3]) && (await ev(`return !(regOf(${ids.r})[0].q > 0)`)), await T())
  const ln = await rect('[data-a="np"][data-k="qs"]'); await b.dragTo(ln.l + ln.w * .9, ln.y, ln.l + ln.w * .5, ln.y, 5); await b.sleep(80)
  const half = await T()
  ok('strength pulled to about half: they stand about half way back to where they were played', half[0] > .02 && half[0] < .05 && half[1] > 1.03 && half[1] < 1.07 && half[2] === 2.3, half)
  await ev(`ROLL.qs = 1; uiDirty('dock'); flush()`)
  await b.click(on.x, on.y); await b.sleep(80)
  ok('q again: as they were played', JSON.stringify(await T()) === JSON.stringify([.07, 1.1, 2.3]), await T())
  const gk = await rect('[data-a="np"][data-k="qgrid"]'); await b.click(gk.x, gk.y); await b.sleep(80)
  const it = await ev(`flush(); const i = S.menu ? S.menu.items.findIndex(x => x.t === '1/4') : -1, el = i < 0 ? null : document.querySelector('[data-a="pick"][data-i="' + i + '"]'); if (!el) return null; const z = el.getBoundingClientRect(); return { x: z.left + z.width / 2, y: z.top + z.height / 2 }`)
  await b.click(it.x, it.y); await b.sleep(80)
  ok('a grid picked from its list: the chosen notes go to that one', JSON.stringify(await T()) === JSON.stringify([0, 1, 2.3]) && (await ev('return ROLL.qv')) === '1/4', await T())
  await ev(`ROLL.sel = new Set(); uiDirty('dock'); flush()`)
  await b.click(on.x, on.y); await b.sleep(80)
  ok('with none chosen, q is for every note of the region', JSON.stringify(await T()) === JSON.stringify([0, 1, 2]), await T())
  await ev(`const [r] = regOf(${ids.r}); setNotes(r, r.notes.map((x, i) => { const y = Object.assign({}, x, { t: [0, 1, 2][i] }); delete y.o; return y })); ROLL.qv = '1/16'; uiDirty('dock', 'lanes'); flush()`)
  // the keys of a scale
  await ev(`const [r] = regOf(${ids.r}); setNotes(r, r.notes.map((x, i) => Object.assign({}, x, { n: [61, 63, 66][i] }))); ROLL.sel = new Set(); ROLL.root = 0; ROLL.scale = 'major'; uiDirty('dock'); flush()`)
  const sq = await rect('[data-a="np"][data-k="sq"]'); await b.click(sq.x, sq.y); await b.sleep(80)
  ok('scale quantize: every note to the nearest key of the scale', JSON.stringify((await notes()).map(x => x[2])) === JSON.stringify([60, 62, 65]), await notes())
  await key('z', 'KeyZ', 90, CMD)
  await ev(`const [r] = regOf(${ids.r}); setNotes(r, r.notes.map((x, i) => Object.assign({}, x, { n: [60, 64, 67][i] }))); uiDirty('dock'); flush()`)
  // how hard the chosen are
  const a = await noteEl(ids.n[1]); await b.click(a.x, a.y); await b.sleep(40)
  const vl = await rect('[data-a="np"][data-k="nvel"]'); await b.dragTo(vl.l + vl.w * .5, vl.y, vl.l + vl.w * .85, vl.y, 5); await b.sleep(80)
  const v = (await notes()).find(x => x[4] === ids.n[1])[3]
  ok('the velocity line: the chosen note is played that hard', v > 95 && v < 127, v)
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
// ── command and the arrows are the page's own while it has the keys ──
{ const a0 = await noteEl(ids.n[0]); await b.click(a0.x, a0.y); await b.sleep(40)
  const v0 = await ev('return { span: ROLL.view.b - ROLL.view.a, rowH: ROLL.rowH, pxb: PXB, rh: S.rh }')
  await key('ArrowRight', 'ArrowRight', 39, CMD)
  const v1 = await ev('return { span: ROLL.view.b - ROLL.view.a, rowH: ROLL.rowH, pxb: PXB, rh: S.rh }')
  await key('ArrowLeft', 'ArrowLeft', 37, CMD)
  const v2 = await ev('return { span: ROLL.view.b - ROLL.view.a, rowH: ROLL.rowH, pxb: PXB, rh: S.rh }')
  await key('ArrowDown', 'ArrowDown', 40, CMD)
  const v3 = await ev('return { span: ROLL.view.b - ROLL.view.a, rowH: ROLL.rowH, pxb: PXB, rh: S.rh }')
  await key('ArrowUp', 'ArrowUp', 38, CMD)
  const v4 = await ev('return { span: ROLL.view.b - ROLL.view.a, rowH: ROLL.rowH, pxb: PXB, rh: S.rh }')
  ok('command right, left: the notes nearer, further — not the lanes above', v1.span < v0.span * .7 && Math.abs(v2.span - v0.span) < 1e-6 && v1.pxb === v0.pxb && v2.pxb === v0.pxb, [v0, v1, v2])
  ok('command down, up: its rows taller, shorter — not the lanes\'', v3.rowH > v0.rowH && v4.rowH === v0.rowH && v3.rh === v0.rh, [v3, v4])
  // on the lanes they are the lanes' again
  const q = await ev(`flush(); const z = document.querySelector('[data-a="lanes"]').getBoundingClientRect(); return { x: z.right - 30, y: z.top + 8 }`)      // (a press on the lanes, wherever there is lane to press)
  await b.click(q.x, q.y); await b.sleep(500)
  await key('ArrowRight', 'ArrowRight', 39, CMD)
  const v5 = await ev('return { span: ROLL.view.b - ROLL.view.a, pxb: PXB, focus: S.focus }')
  ok('after a press on the lanes they are the lanes\' again', v5.pxb > v0.pxb && v5.focus === 'lanes', v5)
  await key('ArrowLeft', 'ArrowLeft', 37, CMD)
  await ev(`S.selR = [${ids.r}]; ROLL.rid = null; uiDirty('dock', 'lanes'); flush()`) }
// ── a grid once picked stays picked ──
{ await ev(`ROLL.qv = '1/16'; ROLL.sel = new Set(); uiDirty('dock'); flush()`)
  const a1 = await noteEl(ids.n[0]); await b.click(a1.x, a1.y); await b.sleep(40)
  const gk = await rect('[data-a="np"][data-k="qgrid"]'); await b.click(gk.x, gk.y); await b.sleep(80)
  const it = await ev(`flush(); const i = S.menu.items.findIndex(x => x.t === '1/8'), el = document.querySelector('[data-a="pick"][data-i="' + i + '"]'), z = el.getBoundingClientRect(); return { x: z.left + z.width / 2, y: z.top + z.height / 2, marked: S.menu.items.find(x => x.on).t }`)
  ok('the list of grids marks the one that is set (a sixteenth to begin with)', it.marked === '1/16', it.marked)
  await b.click(it.x, it.y); await b.sleep(80)
  const a2 = await noteEl(ids.n[1]); await b.click(a2.x, a2.y); await b.sleep(60)
  const shown = await ev(`flush(); return { qv: ROLL.qv, label: [...document.querySelectorAll('#g-dock text')].some(e => e.textContent === '1/8') }`)
  await b.click(gk.x, gk.y); await b.sleep(80)
  const marked = await ev(`const m = S.menu && S.menu.items.find(x => x.on); S.menu = null; uiDirty('menu'); flush(); return m && m.t`)
  ok('another note chosen: the grid is still the one that was picked, on the key and in its list', shown.qv === '1/8' && shown.label && marked === '1/8', [shown, marked])
  await key('z', 'KeyZ', 90, CMD)
  // the q key is the panel's q while the page has the keys: the chosen note, to the panel's grid — the region is not told to quantize
  await ev(`const [r] = regOf(${ids.r}); setNotes(r, r.notes.map((x, i) => Object.assign({}, x, { t: [.3, 1.1, 2.3][i] }))); ROLL.qv = '1/8'; ROLL.sel = new Set([${ids.n[0]}]); S.focus = 'notes'; uiDirty('dock'); flush()`)
  await key('q', 'KeyQ', 81)
  ok('the q key, with the page having the keys: the chosen note goes to the panel\'s grid, the others stay, the region is left alone', JSON.stringify((await notes()).map(x => x[0])) === JSON.stringify([.5, 1.1, 2.3]) && (await ev(`return !(regOf(${ids.r})[0].q > 0) && ROLL.qv === '1/8'`)), await notes())
  await key('q', 'KeyQ', 81, CMD | ALT)
  ok('option command q: as it was played', JSON.stringify((await notes()).map(x => x[0])) === JSON.stringify([.3, 1.1, 2.3]), await notes())
  await ev(`const [r] = regOf(${ids.r}); setNotes(r, r.notes.map((x, i) => { const y = Object.assign({}, x, { t: [0, 1, 2][i] }); delete y.o; return y })); ROLL.qv = '1/16'; ROLL.sel = new Set(); uiDirty('dock', 'lanes'); flush()`) }
// ── the scissors, the eraser, and force legato ──
{ await ev(`const [r] = regOf(${ids.r}); setNotes(r, r.notes.map((x, i) => { const y = Object.assign({}, x, { t: [0, 1, 2][i], d: [1, 1, 2][i], n: [60, 64, 67][i] }); delete y.o; return y })); ROLL.sel = new Set(); S.selR = [${ids.r}]; S.focus = 'notes'; uiDirty('dock', 'lanes'); flush()`)
  await key('t', 'KeyT', 84); await key('i', 'KeyI', 73)
  ok('t, then i: the scissors, and the pointer over a note says so', await ev(`flush(); return S.tool === 'scissors' && document.querySelector('[data-a="np"][data-k="note"]').style.cursor === 'col-resize'`), await ev('return S.tool'))
  const c = await noteEl(ids.n[2]), p = await place(4, 60)
  await b.click(c.l + p.step * 4 + 3, c.y); await b.sleep(80)
  const cut = (await notes()).filter(x => x[2] === 67).sort((x, y) => x[0] - y[0])
  ok('a note pressed with them is cut there, on the grid: two notes on that key, the one ending where the other begins', cut.length === 2 && cut[0][0] === 2 && cut[0][1] === 1 && cut[1][0] === 3 && cut[1][1] === 1 && cut[1][3] === cut[0][3], cut)
  await key('z', 'KeyZ', 90, CMD)
  await key('t', 'KeyT', 84); await key('e', 'KeyE', 69)
  const a = await noteEl(ids.n[1]); await b.click(a.x, a.y); await b.sleep(80)
  ok('the eraser: the note pressed goes', (await notes()).length === 2 && !(await notes()).some(x => x[4] === ids.n[1]), await notes())
  await key('z', 'KeyZ', 90, CMD)
  await key('t', 'KeyT', 84); await key('t', 'KeyT', 84)
  ok('t, t: the pointer again', (await ev('return S.tool')) === 'pointer')
  // the velocity tool
  await key('t', 'KeyT', 84); await key('v', 'KeyV', 86)
  ok('t, then v: the velocity tool; over a note the pointer says up and down, and the note has no end to pull', await ev(`flush(); return S.tool === 'velocity' && document.querySelector('[data-a="np"][data-k="note"]').style.cursor === 'ns-resize' && !document.querySelector('[data-a="np"][data-k="len"]')`), await ev('return S.tool'))
  { const v0 = (await notes()).map(x => x[3]), n1 = await noteEl(ids.n[0])
    await b.dragTo(n1.x, n1.y, n1.x + 30, n1.y - 25, 6); await b.sleep(80)
    const v1 = (await notes()).map(x => x[3]), t1 = (await notes()).map(x => [x[0], x[2]])
    ok('a note pulled up with it: played harder — and nothing else of it moves', v1[0] > v0[0] + 12 && v1[1] === v0[1] && v1[2] === v0[2] && JSON.stringify(t1) === JSON.stringify([[0, 60], [1, 64], [2, 67]]), [v0, v1])
    await key('a', 'KeyA', 65, CMD)
    const n2 = await noteEl(ids.n[1]); await b.dragTo(n2.x, n2.y, n2.x, n2.y + 40, 6); await b.sleep(80)
    const v2 = (await notes()).map(x => x[3])
    ok('with several chosen, pulled down: all of them softer by as much', v2.every((v, i) => v < v1[i]) && v1[1] - v2[1] === v1[2] - v2[2], [v1, v2])
    await key('z', 'KeyZ', 90, CMD); await key('z', 'KeyZ', 90, CMD)
    ok('undone twice: as hard as they were', JSON.stringify((await notes()).map(x => x[3])) === JSON.stringify(v0), await notes()) }
  await key('t', 'KeyT', 84); await key('t', 'KeyT', 84); await key('Escape', 'Escape', 27)
  // force legato
  await ev(`const [r] = regOf(${ids.r}); setNotes(r, r.notes.map((x, i) => Object.assign({}, x, { t: [0, 1, 3][i], d: [.5, 2.5, .25][i] }))); ROLL.sel = new Set(); S.focus = 'notes'; uiDirty('dock'); flush()`)
  await key('a', 'KeyA', 65, CMD)
  await key('l', 'KeyL', 76)
  ok('l, with notes chosen: each lasts until the next begins — the short one longer, the long one shorter, the last as it was', JSON.stringify((await notes()).map(x => [x[0], x[1]])) === JSON.stringify([[0, 1], [1, 2], [3, .25]]), await notes())
  await key('z', 'KeyZ', 90, CMD)
  ok('one undo: as they were', JSON.stringify((await notes()).map(x => x[1])) === JSON.stringify([.5, 2.5, .25]), await notes())
  await ev(`const [r] = regOf(${ids.r}); setNotes(r, r.notes.map((x, i) => Object.assign({}, x, { t: [0, 1, 2][i], d: [1, 1, 2][i] }))); ROLL.sel = new Set(); uiDirty('dock', 'lanes'); flush()`) }
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
