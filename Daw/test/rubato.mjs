// node test/rubato.mjs — a pin pulled in the flex view: while it is pulled the region's sound is drawn through the pins as
// they stand at that moment (what lay under the pin goes with the hand, what lies between follows the stretch), and so are
// the regions stretched with it (several microphones of one kit, in an edit group); let go, the pins are everyone's, and
// a press that moved nothing leaves the pins as they were — on all of them. The kinds of what the app hears begin in a
// file (a hit, a note) and their sureness: the sensitivity chooses which are shown, without listening again.
import { open, PAGE } from './cdp.mjs'
setTimeout(() => { console.log('rubato: TIMED OUT'); process.exit(2) }, 60000)
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined && !cond ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const mouse = (type, x, y, extra = {}) => b.send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' }, extra))
/* two tracks of one edit group, each with the same four-bar take: a file whose outline is silent but for a click at each
   bar (the outline has 100 points a second) */
const set = await ev(`if (typeof START !== 'undefined') START.on = false
  S.rh = 60; setZoom(48, 0); S.tool = 'flex'; S.flex = true; S.auto = false; S.snap = false; VX = 0; VY = 0
  const spb = SPB(), sec = 4 * spb, N = Math.round(sec * 100), pk = new Float32Array(N); for (let k = 0; k < 4; k++) pk[Math.round(k * spb * 100) + 3] = .9
  const tA = S.tracks.find(t => t.kind === 'audio' && !t.inst), iA = S.tracks.indexOf(tA), tB = S.tracks.slice(iA + 1).find(t => t.kind === 'audio' && !t.inst)
  const mk = () => mkReg({ a: 1, b: 5, key: 'file:clicks', file: 'clicks.wav', peaksAll: pk, loop: false, rate: 1, sec, srcBars: 4 })
  tA.regs = [mk()]; tB.regs = [mk()]; tA.grp = 'q'; tB.grp = 'q'; S.grpOff = false
  TRANS.clear(); TRANS_ALL.clear(); heardTransients('file:clicks', [0, 1, 2, 3].map(k => ({ s: k * spb + .03, k: 0, v: 1 })).concat([{ s: 1.5 * spb, k: 0, v: .05 }, { s: 2.5 * spb, k: 1, v: .4 }]))
  S.sel = iA; S.selR = []; dirtyAll(); flush()
  const r = document.getElementById('board').getBoundingClientRect()
  return { iA, iB: S.tracks.indexOf(tB), A: tA.regs[0].id, B: tB.regs[0].id, spb, x2: r.left + bx(2 + .03 / spb), x0: r.left, y: r.top + rowY(iA) + rowH(iA) / 2 }`)
ok('the sensitivity chooses what is shown: a sure hit, a note sure enough — not a faint stir', await ev(`const t = TRANS.get('file:clicks').map(s => +(s / SPB()).toFixed(3)); return t.length === 5 && t.includes(2.5) && !t.includes(1.5)`), await ev(`return TRANS.get('file:clicks')`))
ok('…and more when its track turns it up, without asking the app again', await ev(`const [r, t] = regOf(${set.A}); t.hs = 98; const n = transOf(r).length, other = transOf(regOf(${set.B})[0]).length; delete t.hs; return n === 6 && other === 5 && transOf(r).length === 5`))
/* where the click of bar 2 is drawn in a region: the pixel of the tallest point of its outline between bars 1.5 and 2.6 */
const clickAt = id => ev(`const [r, t] = regOf(${id}), i = S.tracks.indexOf(t), w = bx(r.b) - bx(r.a), steps = Math.round(w), pk = bufPeaks(r, steps, 0, 1)
  let best = -1, bv = 0; for (let k = Math.round(steps * .5 / 4); k < Math.round(steps * 1.6 / 4); k++) if (pk[k] > bv) { bv = pk[k]; best = k }
  return +(best / steps * 4 + 1).toFixed(3)`)
const before = [await clickAt(set.A), await clickAt(set.B)]
ok('at first the click of bar 2 is drawn at bar 2, on both', before.every(x => Math.abs(x - 2) < .03), before)
/* the pin is taken at the click of bar 2 and pulled a quarter of a bar later; looked at before it is let go */
await mouse('mouseMoved', set.x2, set.y, { buttons: 0 })
await mouse('mousePressed', set.x2, set.y)
const dx = await ev(`return bx(1.25) - bx(1)`)
for (let k = 1; k <= 6; k++) await mouse('mouseMoved', set.x2 + dx * k / 6, set.y)
await b.sleep(80)
const mid = await ev(`flush(); return { drag: drag && drag.a, moved: !!(drag && drag.moved), live: flexLive(regOf(${set.A})[0]), mate: flexLive(regOf(${set.B})[0]) }`)
const during = [await clickAt(set.A), await clickAt(set.B)]
ok('while it is pulled, the click is drawn where the hand has it, on the region…', mid.moved && mid.live && Math.abs(during[0] - 2.25) < .04, [mid, during])
ok('…and on the other microphone of the kit, which follows', mid.mate && Math.abs(during[1] - 2.25) < .04, [mid, during])
ok('…drawn as it is drawn: the lane shows the moved outline', await ev(`const html = LANES.rows.get(S.tracks[${set.iA}].id).el.innerHTML; return html.length > 100`))
await mouse('mouseReleased', set.x2 + dx, set.y)
await b.sleep(120)
const after = await ev(`const [a] = regOf(${set.A}), [c] = regOf(${set.B}); return { a: (a.flex || []).map(m => [+(m.s / SPB()).toFixed(3), +(m.d / SPB()).toFixed(3)]), b: (c.flex || []).map(m => [+(m.s / SPB()).toFixed(3), +(m.d / SPB()).toFixed(3)]), live: flexLive(a) }`)
ok('let go: the pin is where it was let go, and both carry the same pins', !after.live && after.a.some(([s, d]) => Math.abs(s - 1.03 / 1 + .0) < .05 && Math.abs(d - 1.28) < .05) && JSON.stringify(after.a) === JSON.stringify(after.b), after)
await ev(`undoEdit(); flush()`)
ok('undone: neither has pins', await ev(`return !(regOf(${set.A})[0].flex || []).length && !(regOf(${set.B})[0].flex || []).length`))
/* a press on the click that does not move leaves both as they were */
await mouse('mouseMoved', set.x2, set.y, { buttons: 0 }); await mouse('mousePressed', set.x2, set.y); await mouse('mouseReleased', set.x2, set.y); await b.sleep(100)
ok('a press that moved nothing leaves no pin, on either', await ev(`return !(regOf(${set.A})[0].flex || []).length && !(regOf(${set.B})[0].flex || []).length`))
/* the bar, with the region chosen */
const bar = () => ev(`S.selR = [${set.A}]; S.sel = ${set.iA}; S.focus = 'lanes'; dirtyAll(); flush(); const g = document.getElementById('g-info') || document.body; return { words: [...document.querySelectorAll('text')].map(q => q.textContent).filter(w => ['rubato', 'stretch', 'hits', 'notes', 'chords', 'cut', 'quantize', '70', '60'].includes(w)), tool: S.tool }`)
const b0 = await bar()
ok('in rubato, the cell and the tool say rubato; the bar says how the track is stretched, its two sensitivities, quantize', ['rubato', 'stretch', 'chords', 'hits', '70', 'notes', '60', 'quantize'].every(w => b0.words.includes(w)) && b0.words.filter(w => w === 'rubato').length >= 2, b0)
const at = sel => ev(`const el = document.querySelector('${sel}'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, l: r.x, w: r.width }`)
const click = async q => { await mouse('mouseMoved', q.x, q.y, { buttons: 0 }); await mouse('mousePressed', q.x, q.y); await mouse('mouseReleased', q.x, q.y); await b.sleep(120) }
await click(await at('[data-a="rstretch"]'))
const items = await ev(`return S.menu ? S.menu.items.map(i => i.t.split(' — ')[0]) : null`)
ok('its menu: chords, voice, cut, beat', JSON.stringify(items) === JSON.stringify(['chords', 'voice', 'cut', 'beat']), items)
await ev(`const k = S.menu.items.findIndex(i => i.v === 'cut'); S.menu.pick(S.menu.items[k]); S.menu = null; flush()`)
ok('cut chosen: the track and its edit group are stretched by cutting', await ev(`return regOf(${set.A})[1].stretch === 'cut' && regOf(${set.B})[1].stretch === 'cut' && stretchOf(regOf(${set.A})[1]) === 'cut'`))
await ev(`undoEdit(); flush()`)
ok('undone: chords again, on both', await ev(`return stretchOf(regOf(${set.A})[1]) === 'chords' && stretchOf(regOf(${set.B})[1]) === 'chords'`))
await bar()
{ const q = await at('[data-a="rsens"][data-k="0"]')
  await mouse('mouseMoved', q.l + 8, q.y, { buttons: 0 }); await mouse('mousePressed', q.l + 8, q.y); for (let k = 1; k <= 5; k++) await mouse('mouseMoved', q.l + 8 + (q.w + 20) * k / 5, q.y); await mouse('mouseReleased', q.l + q.w + 28, q.y); await b.sleep(120) }
ok('the hits rail pulled to its end: 100, and the faint stir shows', await ev(`const [r, t] = regOf(${set.A}); return t.hs === 100 && transOf(r).length === 6`), await ev(`return regOf(${set.A})[1].hs`))
await ev(`undoEdit(); flush()`)
ok('undone: as at first', await ev(`return regOf(${set.A})[1].hs === undefined && transOf(regOf(${set.A})[0]).length === 5`))
ok('a note is drawn dotted, a hit as a line', await ev(`const html = LANES.rows.get(S.tracks[${set.iA}].id).el.innerHTML; return html.includes('stroke-dasharray="2.5 2"')`))
ok('a track keeps how it is stretched and its sensitivities in the song', await ev(`const t = regOf(${set.A})[1]; t.stretch = 'beat'; t.hs = 40; t.ns = 80; const s = serialize(), j = typeof s === 'string' ? s : JSON.stringify(s); delete t.stretch; delete t.hs; delete t.ns; return /"stretch":"beat"/.test(j) && /"hs":40/.test(j) && /"ns":80/.test(j)`))
{ const errs = await ev(`return window.__errs || []`); ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
await b.close()
console.log(out.join('\n'))
console.log(bad.length ? `rubato: ${bad.length} FAILED\n  ${bad.join('\n  ')}` : 'rubato: all passed')
process.exit(bad.length ? 1 : 0)
