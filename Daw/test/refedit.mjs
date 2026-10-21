// node test/refedit.mjs — the reference's regions edited with the room's tools (his ask, 2026-10-22): scissors cut it in
// two where pressed; the pointer by an end trims it (no further than its file goes), by its body moves it (not over its
// neighbour); the fade tool pulls a fade in; gain makes it softer; mute mutes it; join makes the two one again; delete
// takes the chosen away; each is one step of undo; what the engine is told follows (its pieces); kept with the project.
// Real presses. (No app here: its sound is one of the page's own loops, and what the engine would be told is looked at.)
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined && !cond ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const mouse = (type, x, y, extra = {}) => b.send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' }, extra))
const pull = async (x0, y0, x1, y1, modifiers = 0) => { await b.sleep(400); await mouse('mouseMoved', x0, y0, { buttons: 0, modifiers }); await mouse('mousePressed', x0, y0, { modifiers }); for (let k = 1; k <= 8; k++) await mouse('mouseMoved', x0 + (x1 - x0) * k / 8, y0 + (y1 - y0) * k / 8, { modifiers }); await b.sleep(30); await mouse('mouseReleased', x1, y1, { modifiers }); await b.sleep(120) }
const press = (x, y) => pull(x, y, x, y)
/* a place in the reference's row, at a bar (1-based), in the window's pixels */
const at = (bar, down = .5) => ev(`flush(); const b0 = board.getBoundingClientRect(), k = b0.width / (W + (SKV.left || 0)); return { x: b0.left + (bx(${bar}) + (SKV.left || 0)) * k, y: b0.top + (refY() + refH() * ${down}) * k }`)
const regs = () => ev(`return REF.t.regs.map(r => [+r.a.toFixed(3), +r.b.toFixed(3), +(r.off || 0).toFixed(3), +(r.gain || 0).toFixed(1), +(r.fi || 0).toFixed(3), +(r.fo || 0).toFixed(3), !!r.mute])`)
const tool = t => ev(`S.tool = '${t}'; dirtyAll(); flush(); return 1`)
const told = () => ev(`return refMsg().pieces`)
await ev(`if (typeof START !== 'undefined') START.on = false; tpanelSet(true, false); S.panel.on = false
  const src = S.tracks.find(t => t.name === 'keys'); REF.t = refTrack('a song', 0); REF.t.regs = [mkReg({ a: 1, b: 33, buf: src.buf0, loop: false, off: 0, srcBars: 40, name: 'a song' })]; REF.shown = true; REF.on = false; REF.told = ''
  window.NAT0 = NAT; S.snap = 'grid'; setZoom(0); setView(true); dirtyAll(); flush(); return 1`)

/* scissors */
await tool('scissors')
{ const u0 = await ev(`return UNDO.length`), p = await at(9); await press(p.x, p.y)
  const r = await regs()
  ok('scissors: cut in two where pressed, the second going on in the file from there', r.length === 2 && r[0][1] === 9 && r[1][0] === 9 && r[1][2] === 8 && r[1][1] === 33, r)
  ok('…one step of undo', await ev(`return UNDO.length`) === u0 + 1)
  await ev(`undoEdit(); flush(); return 1`)
  ok('…undone: one again', (await regs()).length === 1, await regs())
  await press(p.x, p.y) }
/* the pointer: an end trimmed, the body moved */
await tool('pointer')
{ const p = await at(33, .5); await pull(p.x - 2, p.y, (await at(29)).x, p.y)
  const r = await regs()
  ok('the pointer by its right end: trimmed', r[1][1] === 29, r) }
{ const p = await at(1); await pull(p.x + 2, p.y, (await at(3)).x, p.y)
  const r = await regs()
  ok('by its left end: trimmed, the file read on from further in', r[0][0] === 3 && r[0][2] === 2, r) }
{ const p = await at(3); await pull(p.x + 2, p.y, (await at(-4)).x, p.y)                // (no further than its file goes: it began at the file's start)
  ok('…no further than its file: its start stays the file\'s', (await regs())[0][0] === 1 && (await regs())[0][2] === 0, await regs()) }
{ const p = await at(20); await pull(p.x, p.y, (await at(14)).x, p.y)
  const r = await regs()
  ok('by its body: moved along the song, no further than its neighbour', r[1][0] === 9 && r[1][1] === 29, r)
  const p2 = await at(20); await pull(p2.x, p2.y, (await at(24)).x, p2.y)
  ok('…and on, where there is room', (await regs())[1][0] === 13, await regs()) }
/* the fade tool, gain, mute */
await tool('fade')
{ const p = await at(14); await pull(p.x, p.y, (await at(15)).x, p.y)
  ok('the fade tool near its start: a fade in', (await regs())[1][4] === 2, await regs()) }
await tool('gain')
{ const p = await at(20); await pull(p.x, p.y, p.x, p.y + 30)
  ok('gain pulled down: softer', (await regs())[1][3] === -3, await regs()) }
await tool('mute')
{ const p = await at(20); await press(p.x, p.y)
  ok('mute: muted', (await regs())[1][6] === true, await regs()) }
{ const t = await told()
  ok('the engine is told its pieces: where each lies, where in the file, gain, fades, mute', !!t && t.length === 2 && t[1][0] === 12 && t[1][2] === 8 && Math.abs(t[1][3] - Math.pow(10, -3 / 20)) < 1e-6 && t[1][4] === 2 && t[1][6] === 1, t) }
/* join: the two meet as the file runs again once moved back */
await tool('mute'); { const p = await at(20); await press(p.x, p.y) }
await tool('pointer'); { const p = await at(20); await pull(p.x, p.y, (await at(16)).x, p.y) }
await tool('join'); { const p = await at(5); await press(p.x, p.y) }
{ const r = await regs(); ok('join: the two made one where they meet as the file runs', r.length === 1 && r[0][0] === 1 && r[0][1] === 29 && r[0][2] === 0, r) }
/* delete the chosen */
await tool('pointer'); { const p = await at(5); await press(p.x, p.y) }
await b.press('Backspace', 'Backspace', 8); await b.sleep(120)
ok('delete: the chosen goes', (await regs()).length === 0, await regs())
await ev(`undoEdit(); flush(); return 1`)
ok('…undone: back', (await regs()).length === 1, await regs())
/* kept with the project */
{ const kept = await ev(`REF.t.regs[0].file = 'a song.wav'; REF.t.regs[0].sec = 60; const d = refSaved(); return d && d.regs`)
  ok('kept with the project: each region with its place in the file, gain, fades, mute', Array.isArray(kept) && kept.length === 1 && kept[0].a === 1 && kept[0].off === 0, kept) }
{ const errs = await ev(`return window.__errs || []`); ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close(); process.exit(bad.length ? 1 : 0)
