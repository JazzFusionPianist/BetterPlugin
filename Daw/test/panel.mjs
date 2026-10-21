// node test/panel.mjs [w h] — the transport panel (his pick of design/transport panel draft 8, 2026-10-21; ui/panel.js):
// H brings it in at the left, with the control bar and the tracks' bar gone from the top; every part of it is there and
// does what its part did; the lists open beside their words; where the song is, the beat and the playhead move with the
// song; H hides it, and then nothing stands at the top (the bars there are gone, his word 2026-10-21). Real presses
// and keys; what is drawn is read back.
import { open, PAGE } from './cdp.mjs'
const [ww, hh] = [+process.argv[2] || 1440, +process.argv[3] || 900]
const b = await open(PAGE, { width: ww, height: hh, dsf: 1 })
await b.sleep(600)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined && !cond ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const mouse = (type, x, y, extra = {}) => b.send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' }, extra))
const click = async (x, y) => { await mouse('mouseMoved', x, y, { buttons: 0 }); await mouse('mousePressed', x, y); await mouse('mouseReleased', x, y); await b.sleep(120) }
const box = a => ev(`const el = [...document.querySelectorAll('#tp-col [data-a="${a}"]')][0]; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, l: r.x, t: r.y, r: r.x + r.width, b: r.y + r.height }`)
const key = (k, code, vk, mods = 0) => b.press(k, code, vk, mods).then(() => b.sleep(120))

await ev(`if (typeof START !== 'undefined') START.on = false; S.nudge = '1/16'; jumpTo(4 + 1 / 4 + 2 / 16 + 119 / 3840); S.panel.on = false; setView(true); dirtyAll(); flush()`)
ok('a bare page begins without it, and nothing at the top', await ev(`return !TPANEL.on && !document.getElementById('tp-col') && !document.getElementById('rd') && MK_Y === 0`))
await key('h', 'KeyH', 72)
const s0 = await ev(`flush(); const col = document.getElementById('tp-col'), r = col && col.getBoundingClientRect(), board = document.getElementById('board').getBoundingClientRect()
  return { on: TPANEL.on, col: !!col, w: r ? Math.round(r.width) : 0, left: r ? Math.round(r.left - board.left) : -1, bar: !!document.getElementById('rd'), tool: !!document.querySelector('[data-a="toolmenu"]:not(#tp-col *)'), mk: MK_Y, x0: X0 }`)
ok('the panel at the left, 248 wide', s0.on && s0.col && Math.abs(s0.w - 248) <= 2 && s0.left <= 1, s0)
ok('…the control bar and the tracks\' bar gone from the top: the room begins at its markers', !s0.bar && !s0.tool && s0.mk === 0, s0)
const parts = ['play', 'stop', 'rec', 'tostart', 'pos', 'smpte', 'meter', 'tempo', 'loop', 'key', 'click', 'lowlat', 'master', 'addtrack', 'look', 'toolmenu', 'modemenu', 'grid', 'nudge', 'autokey', 'flexkey', 'zoomx', 'zoomy']
const have = await ev(`return ${JSON.stringify(parts)}.filter(a => !document.querySelector('#tp-col [data-a="' + a + '"]'))`)
ok('every part of the two bars is in it', !have.length, have)
const t0 = await ev(`return { bar: document.getElementById('tp-bar').textContent, rest: document.getElementById('tp-rest').textContent, tick: document.getElementById('tp-tick').textContent, smpte: document.getElementById('tp-smpte').textContent }`)
ok('where the song is: 5, then .2.3 and .120 at its foot; the time as smpte', t0.bar === '5' && t0.rest === '.2.3' && t0.tick === '.120' && t0.smpte === '00:00:11:14', t0)
/* the place typed */
{ const p = await box('pos'); await click(p.x, p.y); await ev(`const el = document.getElementById('rename'); el.value = ''; return 1`); await b.type('19.3.2.038'); await key('Enter', 'Enter', 13)
  const t1 = await ev(`flush(); SKINS.frame.panel(curPos()); return [place(curPos()), document.getElementById('tp-bar').textContent, document.getElementById('tp-rest').textContent, document.getElementById('tp-tick').textContent]`)
  ok('the bar pressed: a place typed to the tick goes there, and the column says it', t1[0] === '19.3.2.038' && t1[1] === '19' && t1[2] === '.3.2' && t1[3] === '.038', t1) }
/* the playhead on the song's line and the beat move with the song */
{ const a = await ev(`const h = document.getElementById('tp-head'); return [+h.getAttribute('cx'), +h.getAttribute('cy'), [...document.querySelectorAll('[id^="tp-beat-"]')].findIndex(e => e.getAttribute('fill') !== 'none')]`)
  await ev(`jumpTo(30.5); flush(); SKINS.frame.panel(curPos()); return 1`)
  const c = await ev(`const h = document.getElementById('tp-head'); return [+h.getAttribute('cx'), +h.getAttribute('cy'), [...document.querySelectorAll('[id^="tp-beat-"]')].findIndex(e => e.getAttribute('fill') !== 'none')]`)
  ok('the playhead goes down the song\'s line as the song goes on', c[1] > a[1] && c[0] > a[0], [a, c])
  ok('…and the beat sounding is the one filled', a[2] === 2 && c[2] === 2, [a[2], c[2]]) }
/* the tempo and its hundredths never over each other, nor out of the ring — two figures or three (his ask, 2026-10-21) */
{ const r = await ev(`const out = []; for (const bpm of [92, 102, 240]) { S.tempo = bpm; uiDirty('top'); flush(); const ts = [...document.querySelectorAll('#tp-col text')], big = ts.find(t => t.textContent === String(bpm)), dec = ts.find(t => t.textContent === '.00'); const a = big.getBBox(), b = dec.getBBox(), g = TPX.geo.dial; out.push({ bpm, apart: a.x + a.width <= b.x + .5, inside: a.x >= g.tx - g.r && b.x + b.width <= g.tx + g.r }) } S.tempo = 92; uiDirty('top'); flush(); return out`)
  ok('the tempo and .00 apart and inside the ring, at 92, 102 and 240', r.every(x => x.apart && x.inside), r) }
/* the count of tracks and its word never over each other, one figure, two or three */
{ const r = await ev(`const real = S.tracks.slice(), out = []; for (const n of [1, 12, 120]) { S.tracks = Array.from({ length: n }, (_, k) => real[k % real.length]); uiDirty('top'); flush(); const ts = [...document.querySelectorAll('#tp-col text')], num = ts.find(t => t.textContent === String(n)), word = ts.find(t => /^tracks?$/.test(t.textContent)); out.push(num && word ? num.getBBox().x + num.getBBox().width + 2 <= word.getBBox().x : null) } S.tracks = real; uiDirty('top'); flush(); return out`)
  ok('the count of tracks never covers its word, 1, 12 or 120', r.every(x => x === true), r) }
/* the transport */
{ const p = await box('loop'); const was = await ev('return S.cycle.on'); await click(p.x, p.y); ok('the cycle\'s triangle turns the cycle', await ev('return S.cycle.on') === !was); await click(p.x, p.y) }
{ const p = await box('click'); await click(p.x, p.y); ok('click', await ev('return !!S.click')); await click(p.x, p.y) }
/* lists beside their words */
for (const [a, first] of [['nudge', 'bar'], ['grid', null], ['meter', null], ['toolmenu', 'pointer'], ['modemenu', 'smart']]) {
  await ev(`S.menu = null; uiDirty('menu'); flush(); return 1`)
  const p = await box(a); await click(p.x, p.y)
  const m = await ev(`flush(); if (!S.menu) return null; const bd = document.getElementById('board').getBoundingClientRect(), left = SKV.left || 0, k = bd.width / (W + left), x = bd.left + (S.menu.x + left) * k, y = bd.top + S.menu.y * k; return { first: S.menu.items[0].t, x, y, up: !!S.menu.up }`)
  ok(`${a}: its list, beside it`, !!m && (!first || m.first === first) && Math.abs(m.x - p.l) < 60 && (m.up ? Math.abs(m.y - p.t) < 40 : Math.abs(m.y - p.b) < 40), [m, p])
}
await ev(`S.menu = null; uiDirty('menu'); flush(); return 1`)
/* the tempo and the key typed where they stand */
{ const p = await box('tempo'); await click(p.x, p.y); const f = await ev(`const el = document.getElementById('rename'); const r = el.getBoundingClientRect(); return { open: !el.hidden, v: el.value, x: r.x, y: r.y }`)
  ok('the tempo pressed: typed where it stands', f.open && f.v === '92' && Math.abs(f.x + 34 - p.x) < 40 && Math.abs(f.y - p.y) < 40, [f, p]); await key('Escape', 'Escape', 27) }
/* the out's level dragged */
{ const p = await box('master'); const v0 = await ev('return S.master'); await mouse('mouseMoved', p.x, p.y, { buttons: 0 }); await mouse('mousePressed', p.x, p.y); await mouse('mouseMoved', p.x, p.y + 30); await mouse('mouseReleased', p.x, p.y + 30); await b.sleep(100)
  ok('the out\'s ring pulled down: the out goes down', await ev('return S.master') < v0, [v0, await ev('return S.master')]); await ev(`S.master = ${v0}; uiDirty('top'); return 1`) }
/* automation and rubato */
{ const p = await box('autokey'); await click(p.x, p.y); ok('automation', await ev('return !!S.auto')); await click(p.x, p.y) }
/* the zoom across */
{ const p = await box('zoomx'); const z0 = await ev('return PXB'); await mouse('mouseMoved', p.l + 4, p.y, { buttons: 0 }); await mouse('mousePressed', p.l + 4, p.y); await mouse('mouseMoved', p.r - 4, p.y); await mouse('mouseReleased', p.r - 4, p.y); await b.sleep(250)
  ok('zoom across pulled to its end: the room nearer', await ev('return PXB') > z0 * 3, [z0, await ev('return PXB')]) }
await b.shot('panel.png')
/* H: the panel gone, and nothing in its place — the song has all the room */
await key('h', 'KeyH', 72)
const s2 = await ev(`flush(); const board = document.getElementById('board').getBoundingClientRect(); return { on: TPANEL.on, col: !!document.getElementById('tp-col'), bar: !!document.getElementById('rd'), tool: !!document.querySelector('[data-a="toolmenu"]'), mk: MK_Y, left: SKV.left }`)
ok('H: the panel gone, nothing at the top or the left — the room begins at its markers', !s2.on && !s2.col && !s2.bar && !s2.tool && s2.mk === 0 && !s2.left, s2)
await key('h', 'KeyH', 72)
ok('H again: the panel back', await ev(`flush(); return TPANEL.on && !!document.getElementById('tp-col')`))
{ const errs = await ev(`return window.__errs || []`); ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close(); process.exit(bad.length ? 1 : 0)
