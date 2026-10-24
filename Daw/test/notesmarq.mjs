// node test/notesmarq.mjs — his asks of 2026-10-23 on the notes page: the marquee tool as on the lanes ("notes 패널에서 노트
// 수정할 때도 marquee tool 이 메인창에서처럼 똑같이"): a stretch over keys, pulled along the grid; delete takes what lies in it,
// cut at its edges; command c and v put it down whole, its empty time too; command r; the pointer pressed inside it cuts out
// and takes hold; a press without a pull puts the playhead there. Shift \ is force legato; option shift \ ends each note on
// the grid line just before its end. A note's start is pulled as its end is. Option held: the pointer says a copy.
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
for (const evn of ['uncaughtException', 'unhandledRejection']) process.on(evn, e => { console.log(out.join('\n')); console.log('THREW', e && e.stack); process.exit(1) })
const ev = b.ev, ALT = 1, CMD = 4, SHIFT = 8
const key = (k, code, vk, mods = 0) => b.press(k, code, vk, mods).then(() => b.sleep(60))
const notes = () => ev(`flush(); const [r] = rollReg(); return r.notes.map(x => [+x.t.toFixed(4), +x.d.toFixed(4), x.n]).sort((p, q) => p[0] - q[0] || p[2] - q[2] || p[1] - q[1])`)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const place = (bar, k) => ev(`flush(); const g = ROLL.g, bd = document.getElementById('board').getBoundingClientRect(), s = bd.width / W, row = g.hi - ${k}; return { x: bd.left + (g.x0 + (${bar} - ROLL.view.a) * g.pxb) * s, y: bd.top + (g.top + (row + .5) * g.rowH) * s }`)
/* a track of notes; its region begins at bar 5 (4 bars from zero), four bars long: quarter notes from its beginning */
const FRESH = [[0, 1, 60], [1, 1, 64], [2, 3, 60], [6, 1, 67]]
const fresh = (list = FRESH) => ev(`const [r] = rollReg(); setNotes(r, ${JSON.stringify(list)}.map(([t, d, n]) => mkNote(t, d, n, 100))); ROLL.sel = new Set(); ROLL.marq = null; ROLL.clip = null; S.focus = 'notes'; dirtyAll(); flush(); return 1`)
const marq = (a, b2, keys) => ev(`ROLL.marq = { a: ${a}, b: ${b2}, k0: ${Math.max(...keys)}, k1: ${Math.min(...keys)}, keys: ${JSON.stringify(keys)} }; S.focus = 'notes'; dirtyAll(); flush(); return 1`)
const K = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, i) => hi - i)

await ev(`if (typeof START !== 'undefined') START.on = false; S.snap = true; S.tool = 'pointer'; S.auto = false; S.flex = false
  const t = newInstTrack('synth', 'e piano'); const r = mkReg({ a: 5, b: 9, loop: false, notes: [] }); t.regs = [r]
  S.selR = [r.id]; showRow(S.tracks.indexOf(t)); rollOpen(); S.panel.h = Math.max(S.panel.h, 420); setView(true); ROLL.grid = '1/16'; ROLL.view.a = 3.5; ROLL.view.b = 9; ROLL.view.hi = 76; dirtyAll(); flush(); return 1`)
await fresh()

/* the marquee tool: a stretch pulled over the keys */
{ await ev(`S.tool = 'marquee'; flush(); return 1`)
  const p0 = await place(4.25, 64), p1 = await place(4.75, 60)
  await b.dragTo(p0.x + 1, p0.y, p1.x + 1, p1.y, 8); await b.sleep(80)
  const m = await ev(`return ROLL.marq && { a: +ROLL.marq.a.toFixed(4), b: +ROLL.marq.b.toFixed(4), keys: ROLL.marq.keys.slice().sort((p, q) => p - q) }`)
  ok('the marquee tool pulled over the paper: a stretch along the grid, over the keys it crossed', m && m.a === 4.25 && m.b === 4.75 && same(m.keys, [60, 61, 62, 63, 64]), m)
  ok('…drawn as the lanes draw theirs', await ev(`return [...document.querySelectorAll('#g-dock rect')].some(el => el.getAttribute('fill-opacity') === '0.16')`))
  await key('Backspace', 'Backspace', 8)
  ok('delete: what lies in it goes, the note that crosses its end cut there (its tail stays)', same(await notes(), [[0, 1, 60], [3, 2, 60], [6, 1, 67]]), await notes())
  await key('z', 'KeyZ', 90, CMD)
  ok('…one step back: as it was', same(await notes(), FRESH.slice().sort((p, q) => p[0] - q[0] || p[2] - q[2] || p[1] - q[1])), await notes()) }

/* command c, command v: put down whole, right after itself, its empty time too */
{ await fresh(); await marq(4.25, 4.75, K(60, 64))
  await key('c', 'KeyC', 67, CMD); await key('v', 'KeyV', 86, CMD)
  ok('command c, v: put down right after itself — the note that lay there on its keys gives way over it', same(await notes(), [[0, 1, 60], [1, 1, 64], [2, 1, 60], [3, 1, 64], [4, 1, 60], [6, 1, 67]]), await notes())
  ok('…and the marquee lies over what was put down', same(await ev(`return [ROLL.marq.a, ROLL.marq.b]`), [4.75, 5.25]))
  await key('v', 'KeyV', 86, CMD)
  ok('command v again: it follows on (a note on another key is left alone)', same(await notes(), [[0, 1, 60], [1, 1, 64], [2, 1, 60], [3, 1, 64], [4, 1, 60], [5, 1, 64], [6, 1, 60], [6, 1, 67]]), await notes()) }

/* command r */
{ await fresh(); await marq(4.25, 4.75, K(60, 64))
  await key('r', 'KeyR', 82, CMD)
  ok('command r: said again right after itself', same(await notes(), [[0, 1, 60], [1, 1, 64], [2, 1, 60], [3, 1, 64], [4, 1, 60], [6, 1, 67]]), await notes())
  ok('…and the clipboard is what it was', await ev(`return ROLL.clip === null`)) }

/* a stretch with nothing in it empties where it goes */
{ await fresh(); await marq(6, 6.5, K(60, 64))
  await key('c', 'KeyC', 67, CMD); await marq(4, 4.5, K(60, 64)); await key('v', 'KeyV', 86, CMD)
  ok('an empty stretch put down at a marquee drawn elsewhere: the notes on its keys there go', same(await notes(), [[2, 3, 60], [6, 1, 67]]), await notes()) }

/* the pointer pressed inside the marquee: cut out and taken hold of */
{ await fresh(); await ev(`S.tool = 'pointer'; flush(); return 1`); await marq(4.25, 4.75, K(60, 64))
  const p0 = await place(4.4, 62), p1 = await place(4.65, 62)
  await b.dragTo(p0.x, p0.y, p1.x, p1.y, 8); await b.sleep(80)
  ok('the pointer pressed inside it: what lies in it is cut out, chosen, and pulled a quarter later', same(await notes(), [[0, 1, 60], [2, 1, 64], [3, 1, 60], [3, 2, 60], [6, 1, 67]]), await notes())
  ok('…and the marquee is put away', await ev(`return ROLL.marq === null`)) }

/* a press without a pull: the playhead */
{ await fresh(); await ev(`S.tool = 'marquee'; flush(); return 1`)
  const p = await place(5.5, 62); await b.click(p.x + 1, p.y); await b.sleep(80)
  ok('the marquee tool pressed without a pull: the playhead goes there, no marquee', await ev(`return Math.abs(curPos() - 5.5) < .02 && !ROLL.marq`), await ev(`return [curPos(), ROLL.marq]`))
  await ev(`S.tool = 'pointer'; flush(); return 1`) }

/* shift \ and option shift \ */
{ await fresh([[0, .5, 60], [1, .5, 64], [2, .5, 67]])
  await key('|', 'Backslash', 220, SHIFT)
  ok('shift \\: force legato — each to the next, the last as it is', same(await notes(), [[0, 1, 60], [1, 1, 64], [2, .5, 67]]), await notes())
  await fresh([[0, .6, 60], [1.1, .3, 64], [2.05, .1, 67], [3, .5, 69]])
  await key('»', 'Backslash', 220, ALT | SHIFT)
  ok('option shift \\: each end back to the 1/16 line just before it; one that ends on a line, or that no line crosses, as it is', same(await notes(), [[0, .5, 60], [1.1, .15, 64], [2.05, .1, 67], [3, .5, 69]]), await notes())
  await key('z', 'KeyZ', 90, CMD)
  ok('…one step back', same(await notes(), [[0, .6, 60], [1.1, .3, 64], [2.05, .1, 67], [3, .5, 69]]), await notes())
  const m = await ev(`const reg = MENU_BAR().find(x => x[0] === 'Region')[1]; return reg.filter(Array.isArray).filter(l => l[0] === 'Force Legato' || l[0] === 'Note Ends Back to the Grid').map(l => l[1])`)
  ok('both are lines of the Region menu, with their keys', same(m, ['⇧Backslash', '⌥⇧Backslash']), m) }

/* a note's start pulled, as its end is */
{ await fresh([[1, 1, 64]])
  const id = await ev(`const [r] = rollReg(); return r.notes[0].id`)
  const n0 = await place(4.375, 64); await b.click(n0.x, n0.y); await b.sleep(60)
  const h = await ev(`flush(); const el = document.querySelector('[data-a="np"][data-k="lenL"][data-i="${id}"]'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }`)
  ok('a long enough note has a handle at its start', !!h, h)
  if (h) {
    const q = await place(4, 64); await b.dragTo(h.x, h.y, h.x - (n0.x - q.x) / 1.5, h.y, 8); await b.sleep(80)
    ok('its start pulled a quarter earlier: it begins a quarter sooner and ends where it did', same(await notes(), [[0, 2, 64]]), await notes())
    const h2 = await ev(`flush(); const el = document.querySelector('[data-a="np"][data-k="lenL"]'); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }`), q2 = await place(4.375, 64), q0 = await place(4, 64)
    await b.dragTo(h2.x, h2.y, h2.x + (q2.x - q0.x), h2.y, 8); await b.sleep(80)
    ok('…and pulled later: shorter from the front', same(await notes(), [[1.5, .5, 64]]), await notes())
  } }

/* ; the chosen notes to the playhead; shift ;, and the next one chosen */
{ await fresh()
  await ev(`const [r] = rollReg(); ROLL.sel = new Set(r.notes.filter(x => x.t === 1 || x.t === 2).map(x => x.id)); jumpTo(5.25); S.focus = 'notes'; flush(); return 1`)
  await key(';', 'Semicolon', 186)
  ok('; — the chosen notes to the playhead: the first begins there, the other keeps its place to it', same(await notes(), [[0, 1, 60], [5, 1, 64], [6, 3, 60], [6, 1, 67]]), await notes())
  await fresh()
  await ev(`const [r] = rollReg(); ROLL.sel = new Set(r.notes.filter(x => x.t === 0).map(x => x.id)); jumpTo(4.75); S.focus = 'notes'; flush(); return 1`)
  await key(':', 'Semicolon', 186, SHIFT)
  const r = await ev(`const [r] = rollReg(); return [...ROLL.sel].map(id => { const x = r.notes.find(q => q.id === id); return [x.t, x.n] })`)
  ok('shift ; — taken there, and the note that came after it chosen in its place', same(await notes(), [[1, 1, 64], [2, 3, 60], [3, 1, 60], [6, 1, 67]]) && same(r, [[1, 64]]), [await notes(), r]) }

/* option held: the pointer says a copy */
{ await fresh()
  const p = await place(4.125, 60), el = `document.elementFromPoint(${p.x}, ${p.y})`
  const c0 = await ev(`return getComputedStyle(${el}).cursor`)
  await b.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Alt', code: 'AltLeft', windowsVirtualKeyCode: 18, modifiers: ALT }); await b.sleep(60)
  const c1 = await ev(`return [getComputedStyle(${el}).cursor, document.body.classList.contains('opt')]`)
  await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Alt', code: 'AltLeft', windowsVirtualKeyCode: 18, modifiers: 0 }); await b.sleep(60)
  const c2 = await ev(`return getComputedStyle(${el}).cursor`)
  ok('over a note, option held: another pointer (a copy), and back when let go', c1[1] && c1[0] !== c0 && /image-set|url\(/.test(c1[0]) && c2 === c0, [c0.slice(0, 30), c1[0].slice(0, 30), c2.slice(0, 30)]) }
{ const r = await ev(`S.focus = 'lanes'; const vis = rows(), ti = vis.find(i => S.tracks[i].kind === 'audio' && !S.tracks[i].inst && S.tracks[i].regs.length), t = S.tracks[ti], rg = t.regs[0], bd = document.getElementById('board').getBoundingClientRect(), s = bd.width / W; return { x: bd.left + bx(rg.a + (rg.b - rg.a) / 2) * s, y: bd.top + (rowY(ti) + rowH(ti) * .7) * s }`)
  await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x, y: r.y, buttons: 0 }); await b.sleep(40)
  await b.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Alt', code: 'AltLeft', windowsVirtualKeyCode: 18, modifiers: ALT }); await b.sleep(60)
  const c = await ev(`const d = document.createElement('div'); d.style.cursor = SMART_CURSOR.copy; const el = document.elementFromPoint(${r.x}, ${r.y}).closest('[data-a="lanes"]'); return el.style.cursor === d.style.cursor`)
  await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Alt', code: 'AltLeft', windowsVirtualKeyCode: 18, modifiers: 0 }); await b.sleep(60)
  const g = await ev(`const d = document.createElement('div'); d.style.cursor = SMART_CURSOR.grab; const el = document.elementFromPoint(${r.x}, ${r.y}).closest('[data-a="lanes"]'); return el.style.cursor === d.style.cursor`)
  ok('over a region on the lanes, option pressed without a move: the copy pointer; let go: the grab', c && g, [c, g]) }

ok('no errors on the page', !b.errors.length, b.errors.slice(0, 3))
console.log(out.join('\n'))
console.log(bad.length ? `\n${bad.length} failed` : '\nall passed')
await b.close()
process.exit(bad.length ? 1 : 0)
