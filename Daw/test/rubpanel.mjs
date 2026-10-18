// node test/rubpanel.mjs — the rubato panel (rubato panel draft 1): W (and Window › Rubato Panel) opens it and closes it;
// every page of the panel has its tab; with nothing of sound chosen it says so; with a region it shows it as played and
// as recorded; its left side sets how the track is stretched and its sensitivities (undone like anything); a pin made and
// pulled in it moves the sound there and on the lanes, the line from where it was recorded leans, and how far the hit
// stands from its line is said; a pin pressed twice lets go; the wheel goes closer and fit shows all of it again.
import { open, PAGE } from './cdp.mjs'
setTimeout(() => { console.log('rubpanel: TIMED OUT'); process.exit(2) }, 90000)
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined && !cond ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const key = async (k, code, vk, mods) => { await b.press(k, code, vk, mods || 0); await b.sleep(80) }
const mouse = (type, x, y, extra = {}) => b.send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' }, extra))
const words = () => ev(`return [...document.getElementById('g-dock').querySelectorAll('text')].map(q => q.textContent)`)
await ev(`if (typeof START !== 'undefined') START.on = false; S.selR = []; S.panel.on = false; setView(true); dirtyAll(); flush()`)
await key('w', 'KeyW', 87)
ok('W: the panel opens on the rubato page', await ev(`return S.panel.on && S.panel.tab === 'rubato'`))
ok('nothing of sound chosen: it says so', (await words()).includes('choose a region of sound to see it here, close up'))
await key('w', 'KeyW', 87)
ok('W again: it closes', await ev(`return !S.panel.on`))
await ev(`S.panel.on = true; S.panel.tab = 'patch'; setView(true); flush()`)
ok('the patch page has the rubato tab too', await ev(`return !!document.querySelector('[data-a="tab-rubato"]')`))
await ev(`S.panel.tab = 'notes'; setView(true); flush()`)
ok('…and the notes page', await ev(`return !!document.querySelector('[data-a="tab-rubato"]')`))
{ const q = await ev(`const r = document.querySelector('[data-a="tab-rubato"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }`); await mouse('mouseMoved', q.x, q.y, { buttons: 0 }); await mouse('mousePressed', q.x, q.y); await mouse('mouseReleased', q.x, q.y); await b.sleep(120) }
ok('its tab pressed: the rubato page', await ev(`return S.panel.tab === 'rubato'`))
/* a take: a click on every beat of four bars */
const set = await ev(`const spb = SPB(), sec = 4 * spb, N = Math.round(sec * 100), pk = new Float32Array(N); for (let k = 0; k < 16; k++) pk[Math.round(k * spb / 4 * 100) + 3] = .9
  const t = S.tracks.find(t => t.kind === 'audio' && !t.inst && !t.theirs), i = S.tracks.indexOf(t)
  t.regs = [mkReg({ a: 5, b: 9, key: 'file:beats', file: 'beats.wav', peaksAll: pk, loop: false, rate: 1, sec, srcBars: 4, name: 'take 1' })]; t.grp = null; delete t.stretch; delete t.hs; delete t.ns
  TRANS.clear(); TRANS_ALL.clear(); heardTransients('file:beats', Array.from({ length: 16 }, (_, k) => ({ s: k * spb / 4 + .03, k: 0, v: 1 })))
  S.flex = true; S.tool = 'pointer'; S.snap = false; S.q = 1 / 4; S.sel = i; S.selR = [t.regs[0].id]; S.focus = 'lanes'; S.panel.h = 320; RUBP.view = null; setView(true); dirtyAll(); flush()
  return { i, r: t.regs[0].id, spb }`)
const w1 = await words()
ok('a region chosen: its track, as played, as recorded, the four ways, the rails', ['as played', 'as recorded', 'chords', 'voice', 'cut', 'beat', 'hits', 'notes', 'quantize', 'let go of every pin'].every(w => w1.includes(w)), w1.slice(0, 30))
ok('no words under the ways of stretching', !w1.some(w => /every pitch is kept|never stretched/.test(w)))
const box = sel => ev(`const el = document.querySelector('${sel}'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, l: r.x, w: r.width, t: r.y, h: r.height }`)
const click = async q => { await mouse('mouseMoved', q.x, q.y, { buttons: 0 }); await mouse('mousePressed', q.x, q.y); await mouse('mouseReleased', q.x, q.y); await b.sleep(120) }
await click(await box('[data-a="rp"][data-k="mode"][data-v="cut"]'))
ok('cut pressed: the track is stretched by cutting', await ev(`return stretchOf(S.tracks[${set.i}]) === 'cut'`))
await ev(`undoEdit(); flush()`)
ok('undone: chords', await ev(`return stretchOf(S.tracks[${set.i}]) === 'chords'`))
{ const q = await box('[data-a="rp"][data-k="sens"][data-v="0"]'); await mouse('mouseMoved', q.l + 8, q.y, { buttons: 0 }); await mouse('mousePressed', q.l + 8, q.y); for (let k = 1; k <= 5; k++) await mouse('mouseMoved', q.l + 8 + (q.w + 30) * k / 5, q.y); await mouse('mouseReleased', q.l + q.w + 38, q.y); await b.sleep(100) }
ok('the panel’s hits rail pulled to its end: 100', await ev(`return S.tracks[${set.i}].hs === 100`), await ev(`return S.tracks[${set.i}].hs`))
await ev(`undoEdit(); flush()`)
/* a pin: the third beat's click taken and pulled later in the panel */
const g = await ev(`const g = RUBP.g, r = regOf(${set.r})[0], br = document.getElementById('board').getBoundingClientRect(); return { x: br.left + RUBP_AT.xOf(r, sToD(r, 2 * ${set.spb} / 4 + .03)), y: br.top + (g.pT + g.pB) / 2, pxb: g.pxb }`)
await mouse('mouseMoved', g.x, g.y, { buttons: 0 }); await mouse('mousePressed', g.x, g.y)
for (let k = 1; k <= 6; k++) await mouse('mouseMoved', g.x + 24 * k / 6, g.y)
await b.sleep(80)
const mid = await ev(`flush(); const r = regOf(${set.r})[0]; return { live: flexLive(r), panelSays: [...document.getElementById('g-dock').querySelectorAll('path')].some(p => p.getAttribute('stroke') === S.tracks[${set.i}].c) }`)
ok('pulled in the panel: the sound follows the hand, and the line from where it was recorded leans in the track’s colour', mid.live && mid.panelSays, mid)
await mouse('mouseReleased', g.x + 24, g.y); await b.sleep(120)
const after = await ev(`const r = regOf(${set.r})[0], p = (r.flex || []).find(m => Math.abs(m.s - (2 * ${set.spb} / 4 + .03)) < 1e-3); return { pins: (r.flex || []).length, moved: p ? +((p.d - p.s) * 1000).toFixed(0) : null }`)
ok('let go: a pin where it was let go, and the neighbours held', after.pins >= 3 && Math.abs(after.moved - 24 / g.pxb * (await ev(`return SPB()`)) * 1000) < 8, after)
ok('how far the hit now stands from its line is said, in ms', (await words()).some(w => /^\+\d+$/.test(w)))
/* the pin pressed twice: it lets go */
const pinX = await ev(`const r = regOf(${set.r})[0], p = r.flex.find(m => Math.abs(m.s - (2 * ${set.spb} / 4 + .03)) < 1e-3), br = document.getElementById('board').getBoundingClientRect(); return br.left + RUBP_AT.xOf(r, p.d)`)
await click({ x: pinX, y: g.y }); await click({ x: pinX, y: g.y })
ok('a pin pressed twice lets go', await ev(`const r = regOf(${set.r})[0]; return !(r.flex || []).some(m => Math.abs(m.s - (2 * ${set.spb} / 4 + .03)) < 1e-3)`))
await click(await box('[data-a="rp"][data-k="unpin"]'))
ok('let go of every pin', await ev(`return !(regOf(${set.r})[0].flex || []).length`))
/* closer with ⌘ and the wheel; fit */
const span0 = await ev(`return RUBP.view.b - RUBP.view.a`)
await b.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: g.x, y: g.y, deltaX: 0, deltaY: -40, modifiers: 4 }); await b.sleep(120)
const span1 = await ev(`return RUBP.view.b - RUBP.view.a`)
ok('⌘ and the wheel: closer', span1 < span0 * .9, [span0, span1])
await click(await box('[data-a="rp"][data-k="fit"]'))
ok('fit: all of it again', Math.abs(await ev(`flush(); return RUBP.view.b - RUBP.view.a`) - span0) < 1e-6)
ok('the menu bar: View and Window have Rubato Panel on W; the lanes’ view is Rubato View', await ev(`const j = JSON.stringify(MENU_BAR(), (k, v) => typeof v === 'function' ? undefined : v); return (j.match(/\\["Rubato Panel","KeyW"/g) || []).length === 2 && j.includes('["Rubato View","⌘KeyF"')`))
{ const errs = await ev(`return window.__errs || []`); ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
await b.close()
console.log(out.join('\n'))
console.log(bad.length ? `rubpanel: ${bad.length} FAILED\n  ${bad.join('\n  ')}` : 'rubpanel: all passed')
process.exit(bad.length ? 1 : 0)
