// node test/mixpanel.mjs [w h] — the mixer with the transport panel (his pick of design/mixer panel draft 3, 2026-10-21;
// ui/mixpanel.js): few tracks all wide; many tracks narrow with the chosen ones wide, and following what is chosen in the
// arrangement; very many with a row of numbers that goes to a track; every part of a wide strip does what the old strip's
// did (level, pan, a plug-in added, a send added and pulled, out, r i m s); two meters a strip, left and right apart.
import { open, PAGE } from './cdp.mjs'
const [ww, hh] = [+process.argv[2] || 1440, +process.argv[3] || 900]
const b = await open(PAGE, { width: ww, height: hh, dsf: 1 })
await b.sleep(600)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined && !cond ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const mouse = (type, x, y, extra = {}) => b.send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' }, extra))
const click = async (x, y) => { await mouse('mouseMoved', x, y, { buttons: 0 }); await mouse('mousePressed', x, y); await mouse('mouseReleased', x, y); await b.sleep(120) }
const pull = async (x0, y0, x1, y1) => { await mouse('mouseMoved', x0, y0, { buttons: 0 }); await mouse('mousePressed', x0, y0); for (let k = 1; k <= 5; k++) await mouse('mouseMoved', x0 + (x1 - x0) * k / 5, y0 + (y1 - y0) * k / 5); await mouse('mouseReleased', x1, y1); await b.sleep(150) }
const box = (sel) => ev(`const el = document.querySelector('#g-dock ${sel}'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, l: r.x, r: r.x + r.width, t: r.y, b: r.y + r.height, w: r.width }`)

await ev(`if (typeof START !== 'undefined') START.on = false; tpanelSet(true, false); S.panel.on = true; S.panel.tab = 'mixer'; S.panel.h = 470; S.sel = S.tracks.findIndex(t => t.name === 'keys'); setView(true); dirtyAll(); flush()`)
const s0 = await ev(`return { mixer: SKIN.k.mixer, sels: [...document.querySelectorAll('#g-dock [data-a="msel"]')].length, vols: [...document.querySelectorAll('#g-dock [data-a="mvol"]')].length, adds: [...document.querySelectorAll('#g-dock [data-a="msendadd"]')].length, fxadd: [...document.querySelectorAll('#g-dock [data-a="mfxadd"]')].length, pans: [...document.querySelectorAll('#g-dock [data-a="mpan"]')].length, n: rows().length }`)
ok('with the panel the mixer is its own', s0.mixer === 'panel', s0)
ok('eight tracks: all of them wide, each with its level, pan, a place for a plug-in and for a send', s0.vols === s0.n && s0.pans >= s0.n - 1 && s0.adds >= s0.n - 3 && s0.fxadd >= s0.n - 3, s0)
/* a send added: the list of where to, a new bus; then pulled */
{ const p = await box('[data-a="msendadd"][data-i="4"]'); await click(p.x, p.y)
  const m = await ev(`return S.menu ? S.menu.items.map(i => i.t) : null`)
  ok('+ send: where it goes, a new bus among them', !!m && m.some(t => /new bus/.test(t)), m)
  const row = await ev(`const k = S.menu.items.findIndex(i => /new bus/.test(i.t)); const el = [...document.querySelectorAll('#g-menu [data-a="pick"]')][k]; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }`)
  if (row) await click(row.x, row.y)
  ok('…a send to a new bus', await ev(`flush(); return S.tracks[4].sends.length === 1 && S.tracks.some(t => t.kind === 'bus')`))
  const sd = await box('[data-a="mp-send"][data-i="4"][data-k="0"]'); const d0 = await ev('return S.tracks[4].sends[0].db')
  ok('…its knob beside the fader, with the + knob under it', !!sd && !!(await box('[data-a="msendadd"][data-i="4"]')) && sd.l > (await box('[data-a="mvol"][data-i="4"]')).r, sd)
  { const seen = () => ev(`const g = document.querySelector('#g-dock [data-a="mp-send"][data-i="4"][data-k="0"]').closest('.mpk'), on = el => getComputedStyle(el).display !== 'none'; return { bus: on(g.querySelector('.mpk-bus')), db: on(g.querySelector('.mpk-db')), busWord: g.querySelector('.mpk-bus').textContent, dbWord: g.querySelector('.mpk-db').textContent }`)
    await mouse('mouseMoved', 20, 20, { buttons: 0 }); await b.sleep(80); const away = await seen()
    await mouse('mouseMoved', sd.x, sd.y, { buttons: 0 }); await b.sleep(80); const over = await seen()
    ok('under the knob its bus; the pointer on it: how much it sends instead', away.bus && !away.db && /bus/.test(away.busWord) && over.db && !over.bus && /dB$/.test(over.dbWord), [away, over])
    ok('…the amount inside the strip, never past its edge', await ev(`const g = document.querySelector('#g-dock [data-a="mp-send"][data-i="4"][data-k="0"]').closest('.mpk'), d = g.querySelector('.mpk-db'), st = document.querySelector('#g-dock [data-a="msel"][data-i="4"]'), nx = document.querySelector('#g-dock [data-a="msel"][data-i="5"]'); d.style.display = 'inline'; const a = d.getBoundingClientRect(), b = st.getBoundingClientRect(), c = nx.getBoundingClientRect(); d.style.display = ''; return a.right <= c.left + .5 && a.left >= b.left - .5`)) }
  if (sd) await pull(sd.x, sd.y, sd.x, sd.y - 40)
  ok('the knob pulled up sends more', sd && await ev('return S.tracks[4].sends[0].db') > d0, [d0, await ev('return S.tracks[4].sends[0].db')])
  if (sd) { await click(sd.x, sd.y); ok('…pressed and let go: where it goes', await ev('return !!S.menu')); await ev(`S.menu = null; uiDirty('menu'); flush(); return 1`) } }
/* many sends: a strip widens by a column, ten at most */
{ const w0 = await ev(`const el = document.querySelector('#g-dock [data-a="msel"][data-i="4"]'); return el.getBoundingClientRect().width`)
  await ev(`const bus = S.tracks.find(t => t.kind === 'bus'); S.tracks[4].sends = Array.from({ length: 10 }, () => ({ to: bus.id, db: -12 })); uiDirty('dock'); flush(); return 1`)
  const r = await ev(`const el = document.querySelector('#g-dock [data-a="msel"][data-i="4"]'); return { w: el.getBoundingClientRect().width, knobs: document.querySelectorAll('#g-dock [data-a="mp-send"][data-i="4"]').length, plus: !!document.querySelector('#g-dock [data-a="msendadd"][data-i="4"]') }`)
  ok('ten sends: the strip wider by a column, all ten there, no + for an eleventh', r.w > w0 + 20 && r.knobs === 10 && !r.plus, [w0, r])
  await ev(`S.tracks[4].sends = S.tracks[4].sends.slice(0, 1); uiDirty('dock'); flush(); return 1`) }
/* the level pulled; pan; r i m s */
{ const p = await box('[data-a="mvol"][data-i="1"]'); const v0 = await ev('return S.tracks[1].vol'); await pull(p.x, p.y, p.x, p.y + 40)
  ok('the level pulled down', await ev('return S.tracks[1].vol') < v0, [v0, await ev('return S.tracks[1].vol')]); await ev(`S.tracks[1].vol = ${v0}; uiDirty('dock'); flush(); return 1`) }
{ const p = await box('[data-a="mpan"][data-i="4"]'); await pull(p.x, p.y, p.x, p.y - 30); ok('the pan turned', await ev('return Math.abs(S.tracks[4].pan || 0) > .05'), await ev('return S.tracks[4].pan')); await ev(`S.tracks[4].pan = 0; uiDirty('dock'); flush(); return 1`) }
{ const p = await box('[data-a="mute"][data-i="4"]'); await click(p.x, p.y); ok('m, a square', await ev('return !!S.tracks[4].mute')); await click(p.x, p.y) }
/* two meters, left and right apart */
{ const r = await ev(`const id = S.tracks[0].id; METERS.ts = new Map([[id, [.9, .1]]]); drawMeters(); const a = document.getElementById('mpm-' + id + '-0'), c = document.getElementById('mpm-' + id + '-1'); return [+a.getAttribute('height'), +c.getAttribute('height')]`)
  ok('two meters a strip: the left louder than the right when it is', r[0] > r[1] * 2 && r[0] > 50, r) }
/* a chosen strip's number on its block of ink: never cut, whatever the number (his ask, 2026-10-21) */
{ const r = await ev(`const out = []; for (const i of [0, 3, 4]) { S.sel = i; uiDirty('dock', 'head'); flush(); const t = [...document.querySelectorAll('#g-dock text')].find(e => e.getAttribute('fill') === K1 && e.textContent === pad2(i + 1)); const blk = t && t.previousElementSibling; if (!t || !blk) { out.push(null); continue } const a = t.getBBox(), b = blk.getBBox(); out.push(a.x >= b.x - .5 && a.x + a.width <= b.x + b.width + .5) } S.sel = 4; uiDirty('dock'); flush(); return out`)
  ok('a chosen strip\'s number stands inside its block', r.every(x => x === true), r) }
/* the out: room between its meters and its fader */
{ const r = await ev(`const m = document.getElementById('mpm-M-1'), f = document.querySelector('#g-dock [data-a="mmaster"]'); const mb = +m.getAttribute('x') + +m.getAttribute('width'); return { gap: [...document.querySelectorAll('#g-dock rect')].filter(e => e.getAttribute('width') === '1.2' && +e.getAttribute('x') > mb).map(e => +e.getAttribute('x') - mb)[0] }`)
  ok('the out: its fader well apart from its meters', r.gap >= 28, r) }
/* the one mixer: the transport panel hidden, the same mixer */
{ await b.press('h', 'KeyH', 72); await b.sleep(150)
  const r = await ev(`flush(); return { panel: TPANEL.on, mixer: SKIN.k.mixer, own: !!document.querySelector('#g-dock [id^="mpm-"]'), bar: !!document.getElementById('rd') }`)
  ok('the transport panel hidden: the same mixer', !r.panel && r.mixer === 'panel' && r.own && !r.bar, r)
  await b.press('h', 'KeyH', 72); await b.sleep(150); await ev('flush(); return 1') }
/* many tracks: the chosen wide, the rest narrow, the mixer follows the arrangement */
await ev(`const base = S.tracks.slice(); for (let k = 0; S.tracks.length < 36; k++) { const src = base[k % 8], t = mkTrack('t' + k, null, null, null, null, -6, [], NO_PATCH()); t.c = src.c; S.tracks.push(t) } S.sel = 20; S.selT = []; dirtyAll(); flush(); return 1`)
{ const r = await ev(`const w = i => { const el = document.querySelector('#g-dock [data-a="msel"][data-i="' + i + '"]'); return el ? el.getBoundingClientRect().width : 0 }; return { chosen: w(20), other: w(21), all: [...document.querySelectorAll('#g-dock [data-a="mvol"]')].length, n: rows().length, row: !!document.querySelector('#g-dock [data-a="mp-jump"]') }`)
  ok('36 tracks: all on one screen, the chosen one wide, the rest narrow', r.all === r.n && r.chosen > 3 * r.other && !r.row, r) }
await ev(`S.sel = 30; uiDirty('dock', 'head'); flush(); return 1`)
ok('chosen in the arrangement: that strip opens', await ev(`const w = i => { const el = document.querySelector('#g-dock [data-a="msel"][data-i="' + i + '"]'); return el ? el.getBoundingClientRect().width : 0 }; return w(30) > 3 * w(20)`))
/* very many: the row of numbers, pressed */
await ev(`const base = S.tracks.slice(0, 8); for (let k = 0; S.tracks.length < 90; k++) { const src = base[k % 8], t = mkTrack('u' + k, null, null, null, null, -6, [], NO_PATCH()); t.c = src.c; S.tracks.push(t) } S.sel = 2; dirtyAll(); flush(); return 1`)
{ const has = await ev(`return [...document.querySelectorAll('#g-dock [data-a="mp-jump"]')].length`); ok('90 tracks: a row of their numbers along the top', has === 90, has)
  const p = await box('[data-a="mp-jump"][data-i="77"]'); await click(p.x, p.y)
  ok('…a number pressed: that track chosen and its strip in sight, wide', await ev(`flush(); const el = document.querySelector('#g-dock [data-a="mvol"][data-i="77"]'); return S.sel === 77 && !!el && el.getBoundingClientRect().width > 40`)) }
await b.shot('mixpanel.png')
{ const errs = await ev(`return window.__errs || []`); ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close(); process.exit(bad.length ? 1 : 0)
