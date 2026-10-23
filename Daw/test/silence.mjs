// node test/silence.mjs — strip silence (silence.js), on a file whose outline is made here: a hi-hat on every beat from
// bar 5 to bar 12, nothing for three bars, then again from bar 17 — the first hit of that a little before the bar line,
// the last one ringing a little past it. Logic's way cuts it down to one piece a hit; whole bars keeps each eight bars
// one piece, cut on the bar lines (and on the beat line beyond, where a sound leans over a line by less than a beat);
// fewer empty bars than asked for between two pieces makes them one. Then ⌃X on the lanes, in one step back, the values
// remembered, and the command line's words. (The app's own check, stripSilence, does it on a real file with the engine's
// outline and its zero crossings.)
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y)
const round = list => list.map(p => p.map(v => +v.toFixed(3)))
await ev(`if (typeof START !== 'undefined') START.on = false; try { localStorage.removeItem('slur.strip') } catch (e) {} Object.assign(SIL, SIL_DEF); flush(); return 1`)

/* the file: a hundred steps to the second, as the lanes' outline is; a hit is loud for 20 ms and rings at -34 dB for 60 ms */
await ev(`window.HATS = (o = {}) => {
  const spb = SPB(), sec = 24 * spb, N = Math.round(sec * 100), pk = new Array(N).fill(0), beat = 1 / BEATS()
  const hit = (bar, ring) => { const i0 = Math.round(bar * spb * 100); for (let i = 0; i < 2; i++) if (pk[i0 + i] != null) pk[i0 + i] = .3; for (let i = 2; i < 2 + (ring || 6); i++) if (pk[i0 + i] != null) pk[i0 + i] = Math.max(pk[i0 + i], .02) }
  for (let x = 4; x < 12 - 1e-9; x += beat) hit(x)
  hit(16 - (o.push || 0) / spb)
  for (let x = 16 + beat; x < 20 - 1e-9; x += beat) hit(x, x > 20 - beat - 1e-9 ? 6 + Math.round((o.ring || 0) * 100) : 6)
  return { pk, sec }
}; return 1`)
/* the reckoning alone */
const plan = (o, f = {}) => ev(`const h = HATS(${JSON.stringify(f)}), r = mkReg({ a: 1, b: 25, key: 'x', peaksAll: h.pk, loop: false, rate: 1, sec: h.sec, srcBars: 24 }); return silPlan(r, 1, silOutline(r), ${JSON.stringify(o)}).map(p => [p[0], p[1]])`)
const beat = await ev('return 1 / BEATS()'), spb = await ev('return SPB()')
{ const p = await plan({ whole: false }); ok(`Logic's way: one piece a hit (${p.length}), each a hundredth of a second early`, p.length === 32 + 16 && Math.abs(p[0][0] - (4 - .01 / spb)) < .006 / spb, round(p.slice(0, 2))) }
{ const p = await plan({ whole: true }); ok('whole bars: bars 5 to 12 one piece, bars 17 to 20 another, cut on the bar lines', same(round(p), [[4, 12], [16, 20]]), round(p)) }
{ const p = await plan({ whole: true }, { push: .03, ring: .8 }); ok('a hit pushed 30 ms ahead of bar 17: cut on the beat before it; a last hit that rings past bar 21: cut on the beat after', same(round(p), [[4, 12], [16 - beat, 20 + beat]]), round(p)) }
{ const p = await plan({ whole: true, bars: 5 }); ok('five empty bars asked for: the four between them are not enough, one piece', same(round(p), [[4, 20]]), round(p)) }
{ const p = await plan({ whole: true, bars: 4 }); ok('four asked for: two pieces', same(round(p), [[4, 12], [16, 20]]), round(p)) }
{ const p = await plan({ whole: true, floor: -30 }); ok('a threshold above the ringing: whole bars still keep each run of hits whole', same(round(p), [[4, 12], [16, 20]]), round(p)) }
{ const p = await plan({ whole: false, gap: 1 }); ok('Logic\'s way with a second as the shortest silence: the rests between hits are no silence, two pieces', p.length === 2, round(p)) }
{ const p = await ev(`const h = HATS(), r = mkReg({ a: 9.25, b: 19.25, off: 2.5, key: 'x', peaksAll: h.pk, loop: false, rate: 1, sec: h.sec, srcBars: 24 }); return silPlan(r, 1, silOutline(r), { whole: true }).map(p => [p[0], p[1]])`)
  ok('a region showing part of the file, put off the bar lines: cut on the song\'s bar and beat lines, inside the region', same(round(p), [[9.75, 18]]), round(p)) }
ok('values are kept in their bounds', await ev(`const c = silClean({ floor: -200, gap: -1, pre: 'x', bars: 2.6, zero: 'yes' }); return c.floor === -90 && c.gap === 0 && c.pre === SIL_DEF.pre && c.bars === 3 && c.zero === true`))

/* on the lanes: ⌃X */
const made = await ev(`const h = HATS(), t = newTrack('audio', 'strip hats', true), r = mkReg({ a: 1, b: 25, key: 'strip hats', peaksAll: h.pk, loop: false, rate: 1, sec: h.sec, srcBars: 24, name: 'strip hats' })
  t.regs.push(r); S.selR = [r.id]; S.focus = 'lanes'; leadTrack(S.tracks.indexOf(t)); showRow(S.tracks.indexOf(t)); flush(); return { n: UNDO.length }`)
const lane = () => ev(`const t = S.tracks.find(x => x.name === 'strip hats'); return t.regs.slice().sort((x, y) => x.a - y.a).map(r => [+r.a.toFixed(3), +r.b.toFixed(3), +(r.off || 0).toFixed(3)])`)
const said = () => ev(`return (S.last || {}).say || ''`)
await ev(`SIL.whole = true; return 1`)
const at = sel => ev(`const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }`)
const words = () => ev(`return [...document.querySelectorAll('#g-top text')].map(t => t.textContent).join(' ')`)
const band = () => ev(`return SILB.on ? { whole: SILB.o.whole, n: SILB.n, floor: SILB.o.floor, gap: SILB.o.gap, zero: SILB.o.zero } : null`)
await b.press('x', 'KeyX', 88, 2); await b.sleep(400)
ok('⌃X: the band is up, the remembered way chosen; nothing is cut yet', JSON.stringify(await band()) === JSON.stringify({ whole: true, n: 2, floor: -40, gap: .3, zero: true }) && same(await lane(), [[1, 25, 0]]) && (await ev('return UNDO.length')) === made.n, [await band(), await lane()])
{ const c = await ev(`const t = S.tracks.find(x => x.name === 'strip hats'), row = LANES.rows.get(t.id); return { pieces: silPieces(t.regs).map(q => [q.a, q.b, +(q.off || 0).toFixed(3)]), frame: !!(row && row.el.querySelector('rect[stroke-dasharray="4 3"]')), regs: t.regs.length }`)
  ok('the lanes show what would stay: the file drawn as two pieces, each as a region of its own, inside a dashed frame', same(c.pieces, [[5, 13, 4], [17, 21, 16]]) && c.frame && c.regs === 1, c) }
{ const w = await words(); ok('the band: the file, the way, the threshold, empty bars, after, the pieces, strip and cancel', ['strip silence', 'strip hats', 'each silence', 'whole bars', 'threshold', '−40 dB', 'empty bars', 'at least 1', 'after', '60 ms', 'pieces', 'strip', 'cancel'].every(x => w.includes(x)) && !w.includes('shortest'), w) }
await b.shot('silence-band.png')
await b.press('Enter', 'Enter', 13); await b.sleep(400)
{ const l = await lane(); ok('return: two regions, each beginning where its sound is in the file; chosen; one step; the band is gone', same(l, [[5, 13, 4], [17, 21, 16]]) && (await ev('return S.selR.length')) === 2 && (await ev('return UNDO.length')) === made.n + 1 && !(await band()), [l, await said()]) }
ok('…and it is said', (await said()) === '2 pieces in whole bars', await said())
await b.shot('silence-whole.png')
await ev('undoEdit(); flush(); return 1')
ok('one step back: the file whole again', same(await lane(), [[1, 25, 0]]), await lane())
await ev(`S.selR = S.tracks.find(x => x.name === 'strip hats').regs.map(r => r.id); S.focus = 'lanes'; await stripSilence({ whole: false }); flush(); return 1`)
ok('Logic\'s way for this once: a piece a hit; the remembered way is untouched', (await lane()).length === 48 && await ev('return SIL.whole === true'), (await lane()).length)
await ev('undoEdit(); flush(); return 1')
await ev(`silKeep({ whole: false, floor: -50 }); return 1`)
ok('values kept for next time, and for the next start', await ev(`const k = JSON.parse(localStorage.getItem('slur.strip')); return k.whole === false && k.floor === -50`))
await ev(`silKeep(SIL_DEF); return 1`)

/* the band's hands: the way pressed, a value pulled, typed, given back with option; zero crossings off; esc */
const pick = () => ev(`S.selR = S.tracks.find(x => x.name === 'strip hats').regs.map(r => r.id); S.focus = 'lanes'; flush(); return 1`)
await pick(); await b.press('x', 'KeyX', 88, 2); await b.sleep(300)
{ const p = await at('[data-a="sil-way"][data-k="whole"]'); await b.click(p.x, p.y); await b.sleep(200) }
ok('whole bars pressed: two pieces', (await band()).whole === true && (await band()).n === 2, await band())
{ const p = await at('[data-a="sil-way"][data-k="each"]'); await b.click(p.x, p.y); await b.sleep(200) }
{ const w = await words(); ok('each silence pressed: a piece a hit, and the band says shortest, before and zero crossings', (await band()).n === 48 && ['shortest', '0.30 s', 'before', '10 ms', 'zero crossings'].every(x => w.includes(x)) && !w.includes('empty bars'), [await band(), w]) }
{ const p = await at('[data-a="sil"][data-k="floor"]'); await b.dragTo(p.x, p.y, p.x, p.y - 40, 8); await b.sleep(200) }
ok('the threshold pulled up: higher, in half decibels', (await band()).floor > -36 && Math.abs((await band()).floor * 2 - Math.round((await band()).floor * 2)) < 1e-9, await band())
{ const p = await at('[data-a="sil"][data-k="floor"]'); await b.click(p.x, p.y, 1); await b.sleep(200) }
ok('…with option pressed: −40 dB again', (await band()).floor === -40, await band())
{ const p = await at('[data-a="sil"][data-k="gap"]'); await b.click(p.x, p.y); await b.sleep(60); await b.click(p.x, p.y); await b.sleep(250) }
ok('shortest pressed twice: a box to type it in', await ev(`const el = document.getElementById('rename'); return !el.hidden && document.activeElement === el`))
await b.type('1'); await b.press('Enter', 'Enter', 13); await b.sleep(300)
ok('…1 typed: the shortest silence a second, so the rests between hits are none — two pieces; the band still up', (await band()).gap === 1 && (await band()).n === 2, await band())
{ const p = await at('[data-a="sil"][data-k="zero"]'); await b.click(p.x, p.y); await b.sleep(200) }
ok('zero crossings pressed: off', (await band()).zero === false && (await words()).includes('zero crossings off'), await band())
await b.press('Escape', 'Escape', 27); await b.sleep(300)
ok('esc: the band is gone, nothing was cut, and nothing of it is remembered', !(await band()) && same(await lane(), [[1, 25, 0]]) && await ev('return SIL.gap === .3 && SIL.zero === true && SIL.whole === false'), [await lane(), await ev('return SIL')])
await pick(); await b.press('x', 'KeyX', 88, 2); await b.sleep(300)
{ const p = await at('[data-a="sil-off"]'); await b.click(p.x, p.y); await b.sleep(200) }
ok('cancel pressed: gone', !(await band()))
await pick(); await b.press('x', 'KeyX', 88, 2); await b.sleep(300)
await ev(`S.selR = []; flush(); return 1`); await b.sleep(500)
ok('another choice of regions: the band goes', !(await band()))
await pick(); await b.press('x', 'KeyX', 88, 2); await b.sleep(300)
{ const p = await at('[data-a="sil-go"]'); await b.click(p.x, p.y); await b.sleep(400) }
ok('strip pressed: done as shown (each silence), and that way remembered', (await lane()).length === 48 && !(await band()) && await ev('return SIL.whole === false'), (await lane()).length)
await ev('undoEdit(); flush(); return 1')

/* Region > Strip Silence in Whole Bars, whatever is remembered */
await ev(`S.selR = S.tracks.find(x => x.name === 'strip hats').regs.map(r => r.id); S.focus = 'lanes'; MENU_BAR().forEach(([t, lines], i) => menuTree(lines, String(i), t)); return 1`)
const viaMenu = await ev(`const f = MENUS.acts.get('stripwhole'); if (!f) return 'no line'; f(); flush(); return SILB.on && SILB.o.whole ? 1 : 'no band'`)
await b.sleep(300); await b.press('Enter', 'Enter', 13); await b.sleep(400)
ok('Region > Strip Silence in Whole Bars: the band in whole bars; return', viaMenu === 1 && same(await lane(), [[5, 13, 4], [17, 21, 16]]), [viaMenu, await lane()])
if (viaMenu === 1) await ev('undoEdit(); flush(); return 1')
ok('…and whole bars is the remembered way now', await ev('return SIL.whole === true'))
await ev(`silKeep(SIL_DEF); return 1`)

/* said on the command line */
const line = async text => { await ev(`S.selR = S.tracks.find(x => x.name === 'strip hats').regs.map(r => r.id); S.focus = 'lanes'; return 1`); await ev(`await runCommand(${JSON.stringify(text)}); flush(); return 1`); await b.sleep(400) }
const hasLine = await ev(`return typeof runCommand === 'function'`)
if (hasLine) {
  await line('strip silence in whole bars')
  ok('"strip silence in whole bars"', same(await lane(), [[5, 13, 4], [17, 21, 16]]), [await lane(), await said()])
  await ev('undoEdit(); flush(); return 1')
  await line('strip the empty bars')
  ok('"strip the empty bars"', same(await lane(), [[5, 13, 4], [17, 21, 16]]), [await lane(), await said()])
  await ev('undoEdit(); flush(); return 1')
  await line('strip silence')
  ok('"strip silence": the remembered way', (await lane()).length === 48, (await lane()).length)
  await ev('undoEdit(); flush(); return 1')
  await line('strip silence -20 db')
  ok('"strip silence -20 db": a threshold above the ringing for this once (each hit a shorter piece), not remembered', (await lane()).length === 48 && await ev('return SIL.floor === -40') && (await ev(`const t = S.tracks.find(x => x.name === 'strip hats'); return t.regs.reduce((m, r) => Math.max(m, r.b - r.a), 0)`)) < .05, (await lane()).slice(0, 2))
  await ev('undoEdit(); flush(); return 1')
  await line('strip silence -6 db')
  ok('a threshold above everything in the file: all of it is silence, taken out, and said', (await lane()).length === 0 && (await said()) === 'nothing in it reaches the threshold: taken out', await said())
  await ev('undoEdit(); flush(); return 1')
}
/* in bauhaus: the band is the black foot, as drawn in strip silence draft 1 */
await ev(`applyLook(JSON.parse(JSON.stringify(THEMES.bauhaus))); fitRoom(); setView(true); dirtyAll(); flush(); return 1`); await b.sleep(600)
await ev(`silKeep(SIL_DEF); return 1`); await pick(); await b.press('x', 'KeyX', 88, 2); await b.sleep(400)
{ const w = await words(); ok('bauhaus: the foot is the band — STRIP SILENCE, WAY, THRESHOLD, SHORTEST, BEFORE, AFTER, ZERO CROSSINGS, PIECES, strip, cancel', ['STRIP SILENCE', 'strip hats', 'WAY', 'each silence', 'whole bars', 'THRESHOLD', '−40 dB', 'SHORTEST', '0.30 s', 'BEFORE', '10 ms', 'AFTER', '60 ms', 'ZERO CROSSINGS', 'on', 'PIECES', '48', 'strip', 'cancel'].every(x => w.includes(x)) && !w.includes('GAIN'), w) }
await b.shot('silence-band-bauhaus.png')
{ const p = await at('[data-a="sil-way"][data-k="whole"]'); await b.click(p.x, p.y); await b.sleep(250) }
ok('bauhaus: whole bars pressed — THRESHOLD, EMPTY BARS, AFTER; 2 pieces', (await words()).includes('EMPTY BARS') && !(await words()).includes('SHORTEST') && (await band()).n === 2, await words())
await b.press('Escape', 'Escape', 27); await b.sleep(300)
ok('bauhaus: esc, the foot is the region\'s again', !(await band()) && (await words()).includes('GAIN'), await words())
ok('nothing went wrong on the page', b.errors.length === 0 && (await ev('return (window.__errs || []).length')) === 0, [b.errors, await ev('return window.__errs')])
await b.close()
console.log(out.join('\n'))
console.log(bad.length ? `FAILED: ${bad.join(' | ')}` : 'silence: all passed')
process.exit(bad.length ? 1 : 0)
