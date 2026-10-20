// node test/reference.mjs [w h] — his round of 2026-10-20: the inspector at the left (the chosen track's strip, its pan a knob),
// the mixer's pan as a bar the strip's width (moved by how far the hand goes, never thrown to the pointer), and the reference:
// a row above track 1, twice a track's height, its edge thicker; a press in it and it is heard, a press on the room and the
// mix is heard again; its region pulled along; put away and brought back (⌥⌘R); written with the project and read back.
// (No app here: the reference's sound is one of the page's own loops, and what the engine would be told is looked at.)
import { open, PAGE } from './cdp.mjs'
const [W, H] = [+(process.argv[2] || 1440), +(process.argv[3] || 900)]
const b = await open(PAGE, { width: W, height: H, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const mouse = (type, x, y, extra = {}) => b.send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' }, extra))
const pull = async (x0, y0, x1, y1, steps = 8, modifiers = 0) => { await mouse('mouseMoved', x0, y0, { buttons: 0, modifiers }); await mouse('mousePressed', x0, y0, { modifiers }); for (let k = 1; k <= steps; k++) await mouse('mouseMoved', x0 + (x1 - x0) * k / steps, y0 + (y1 - y0) * k / steps, { modifiers }); await b.sleep(40); await mouse('mouseReleased', x1, y1, { modifiers }); await b.sleep(80) }
const press = async (x, y) => { await b.sleep(450); await pull(x, y, x, y, 1) }      // (apart: two presses on one thing within a moment are a press twice)
const pullApart = async (...a) => { await b.sleep(450); await pull(...a) }
const el = (sel, dx = .5, dy = .5) => ev(`flush(); const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width * ${dx}, y: r.top + r.height * ${dy}, w: r.width, h: r.height }`)
const room = k => ev(`return board.getBoundingClientRect().width / W`).then(s => k * s)
await ev(`if (typeof START !== 'undefined') START.on = false
  S.sel = 1; for (const t of S.tracks) t.pan = 0; setView(true); dirtyAll(); flush()`)

/* ── the inspector ── */
{ const x0 = await ev(`return X0`)
  await ev(`INSP.on = true; setView(true); dirtyAll(); flush()`)
  const s = await ev(`flush(); const g = document.getElementById('g-head').getAttribute('transform'); return { X0, w: INSP.w, g, strip: document.querySelectorAll('#g-insp [data-a="ivol"]').length, knob: document.querySelectorAll('#g-insp [data-a="mpan"]').length, out: [...document.querySelectorAll('#g-insp text')].some(t => t.textContent === 'stereo out' && +t.getAttribute('y') > H - 80) }`)
  ok('the inspector shows: the heads and lanes move over by its width', s.w > 100 && s.X0 === x0 + s.w && /translate\(\d+ 0\)/.test(s.g || ''), s)
  ok('…in it the chosen track’s strip — its fader, its pan — and not the stereo out’s', s.strip === 1 && s.knob === 1 && !s.out, s)
  /* a head's level, pressed where it stands on the screen */
  const lv = await el('#hd-1 [data-a="vol"]', 0, .5)
  await press(lv.x + lv.w * .25, lv.y)
  const vol = await ev(`return S.tracks[1].vol`)
  await press(lv.x + lv.w * .85, lv.y)
  const vol2 = await ev(`return S.tracks[1].vol`)
  ok('a head’s level is still set where it is pressed (the heads stand further right)', vol2 > vol + 3, [vol, vol2])
  /* the knob: up is to the right, by how far the hand goes */
  const kn = await el('#g-insp [data-a="mpan"]')
  await pull(kn.x, kn.y, kn.x, kn.y - 32)
  const p1 = await ev(`return Math.round(S.tracks[1].pan * 64)`)
  ok('the inspector’s pan knob pulled up 32 points: R16', p1 === 16, p1)
  ok('…and the knob and its value say so', await ev(`flush(); return [...document.querySelectorAll('#g-insp text')].some(t => t.textContent === 'R16')`))
  /* its fader */
  const fd = await el('#g-insp [data-a="ivol"]'), v0 = await ev(`return S.tracks[1].vol`)
  await pull(fd.x, fd.y, fd.x, fd.y + 40)
  ok('the inspector’s fader pulled down: the track is quieter', (await ev(`return S.tracks[1].vol`)) < v0 - 1, [v0, await ev(`return S.tracks[1].vol`)])
  /* the name typed over its head */
  await ev(`startRename('track', 1)`)
  const rn = await ev(`const e = document.getElementById('rename'), h = document.querySelector('#hd-1 text'), r = e.getBoundingClientRect(); return { left: r.left, head: document.getElementById('g-head').getBoundingClientRect().left, x0: X0 }`)
  ok('the box a name is typed in stands over the head, past the inspector', rn.left > (await room(await ev(`return INSP.w`))) + 20, rn)
  await b.press('Escape', 'Escape', 27); await b.sleep(80)
  await ev(`INSP.on = false; setView(true); dirtyAll(); flush()`)
  ok('hidden again, the heads go back to the left', (await ev(`return X0`)) === x0) }

/* ── the mixer's pan: a bar the strip's width ── */
{ await ev(`S.panel.on = true; S.panel.tab = 'mixer'; S.panel.h = 360; S.tracks[2].pan = 0; setView(true); dirtyAll(); flush()`)
  const pn = await ev(`flush(); const e = [...document.querySelectorAll('#g-dock [data-a="mpan"]')].find(x => +x.dataset.i === 2), r = e.getBoundingClientRect(); return { x: r.left + r.width * .9, y: r.top + r.height / 2, w: r.width }`)      // (near its right end)
  await press(pn.x, pn.y)
  ok('pressed near its right end, the pan does not jump there', (await ev(`return S.tracks[2].pan`)) === 0)
  await pullApart(pn.x, pn.y, pn.x + 64, pn.y)
  ok('pulled 64 points to the right: R32, half way', (await ev(`return Math.round(S.tracks[2].pan * 64)`)) === 32, await ev(`return S.tracks[2].pan * 64`))
  await pullApart(pn.x, pn.y, pn.x - 64, pn.y, 8, 8)
  ok('…back 64 with shift: a quarter as far, R24', (await ev(`return Math.round(S.tracks[2].pan * 64)`)) === 24, await ev(`return S.tracks[2].pan * 64`))
  ok('the strip says it in capitals over the bar', await ev(`flush(); return [...document.querySelectorAll('#g-dock text')].some(t => t.textContent === 'R24')`))
  await ev(`S.panel.on = false; setView(true); dirtyAll(); flush()`) }

/* ── the reference ── */
{ const ty0 = await ev(`return TY`)
  await ev(`const src = S.tracks.find(t => t.name === 'keys'); REF.t = refTrack('a song', -3); REF.t.regs = [mkReg({ a: 1, b: 30, buf: src.buf0, loop: true, off: 0, name: 'a song' })]; REF.shown = true; REF.on = false; setView(true); dirtyAll(); flush()`)
  const s = await ev(`flush(); return { TY, rh: S.rh, h: refH(), y: refY(), regs: document.querySelectorAll('#g-ref [data-k="reg"]').length, edge: [...document.querySelectorAll('#g-ref rect')].some(r => r.getAttribute('stroke-width') === '2'), first: rowY(0) }`)
  ok('the reference stands above track 1, twice a track’s height, and the tracks begin under it', s.h === 2 * s.rh && s.TY === ty0 + 4 + s.h + 6 && s.y === ty0 + 4 && s.first === s.TY && s.regs === 1, s)
  ok('…its edge drawn thicker than a row’s', s.edge)
  const row = await el('#g-ref [data-k="reg"]', .5, .5)
  await press(row.x, row.y)
  const on = await ev(`flush(); return { on: REF.on, dim: !!document.querySelector('#g-ref rect[pointer-events="none"]') }`)
  ok('a press in its row: it is the one heard, and the room under it steps back', on.on && on.dim, on)
  const lane = await ev(`const k = board.getBoundingClientRect().width / W; return { x: (X0 + 200) * k, y: (rowY(3) + S.rh / 2) * k }`)
  await press(lane.x, lane.y)
  ok('a press on the room: the mix is heard again', !(await ev(`return REF.on`)))
  /* its region pulled along: it begins two bars later */
  const pxb = await ev(`return PXB`), k = await room(1)
  await pull(row.x, row.y, row.x + 2 * pxb * k, row.y, 10)
  const ra = await ev(`return REF.t.regs[0].a`)
  ok('its region pulled two bars to the right: it begins on bar 3', Math.abs(ra - 3) < 1e-6, ra)
  /* written with the project, and read back */
  const saved = await ev(`return JSON.parse(serialize()).ref`)
  ok('one with no file of its own (a loop of the page) is not written', saved === undefined, saved)
  await ev(`REF.t.regs[0].file = 'a song.wav'; REF.t.regs[0].sec = 60; REF.t.regs[0].srcBars = 23`)
  const saved2 = await ev(`return JSON.parse(serialize()).ref`)
  ok('…a reference brought in from a file is written with the project', saved2 && saved2.name === 'a song' && saved2.a === 3 && saved2.vol === -3 && saved2.file === 'a song.wav', saved2)
  await ev(`refLoad(null); flush()`)
  ok('a song without one: no row, the tracks back under the bars', (await ev(`return TY`)) === ty0 && !(await ev(`return !!REF.t`)))
  await ev(`refLoad(${JSON.stringify(saved2 || {})}); flush()`)
  ok('read back: there again, as it was written', (await ev(`return !!REF.t && REF.t.regs[0].a === 3 && REF.t.vol === -3 && TY > ${ty0}`)))
  /* put away with close, brought back with ⌥⌘R */
  await ev(`REF.t.regs = [mkReg({ a: 3, b: 30, buf: S.tracks.find(t => t.name === 'keys').buf0, loop: true, off: 0, name: 'a song' })]; dirtyAll(); flush()`)
  const cl = await el('#g-ref [data-k="close"]')
  await press(cl.x, cl.y)
  ok('close puts the row away: the tracks go back up', (await ev(`return TY`)) === ty0 && (await ev(`return !!REF.t && !REF.shown`)))
  await b.press('r', 'KeyR', 82, 1 | 4); await b.sleep(120)
  ok('⌥⌘R brings it back as it was', (await ev(`return REF.shown && TY > ${ty0} && REF.t.regs[0].a === 3`)))
  ok('the menu bar has it: Track > Create Reference Track, ⌥⌘R', await ev(`return MENU_BAR().find(m => m[0] === 'Track')[1].some(l => Array.isArray(l) && l[0] === 'Create Reference Track' && l[1] === '⌥⌘KeyR')`)) }

{ const errs = await ev(`return window.__errs || []`)
  ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n'))
console.log(bad.length ? `reference: ${bad.length} FAILED\n  ${bad.join('\n  ')}` : 'reference: all passed')
await b.close()
process.exit(bad.length ? 1 : 0)
