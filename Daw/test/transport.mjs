// node test/transport.mjs [w h] — the control bar as he asked for it on 2026-10-20 (design/transport draft 1, way B): the
// place to the tick (bar . beat . sixteenth . tick), the time as SMPTE timecode, a right press on the time for where its
// count begins and its rate; the nudge and the grid in a box of their own at the right end, beside the out. Real presses
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
const right = async (x, y) => { await mouse('mouseMoved', x, y, { buttons: 0 }); await mouse('mousePressed', x, y, { button: 'right', buttons: 2 }); await mouse('mouseReleased', x, y, { button: 'right' }); await b.sleep(150) }
const box = a => ev(`const el = document.querySelector('#g-top [data-a="${a}"]'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, l: r.x, r: r.x + r.width }`)
const typeIn = async text => { await ev(`const el = document.getElementById('rename'); el.value = ''; return 1`); await b.type(text); await b.press('Enter', 'Enter', 13); await b.sleep(150) }
const menuRow = t => ev(`const k = S.menu ? S.menu.items.findIndex(i => i.t === ${JSON.stringify(t)}) : -1; if (k < 0) return null; const el = document.querySelector('#g-menu [data-a="menu-item"][data-i="' + k + '"]') || [...document.querySelectorAll('#g-menu [data-a]')].filter(e => e.dataset.a !== 'menu-close')[k]; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }`)

await ev(`if (typeof START !== 'undefined') START.on = false; S.nudge = '1/16'; S.smpte = { rate: '30', start: '00:00:00:00' }; jumpTo(4 + 1 / 4 + 2 / 16 + 119 / 3840); S.panel.on = false; setView(true); dirtyAll(); flush()`)
const t0 = await ev(`return { rd: document.getElementById('rd').textContent, rt: document.getElementById('rt').textContent }`)
ok('the place to the tick: 5.2.3.120', t0.rd === '5.2.3.120', t0)
ok('the time as SMPTE, at 30 frames: 00:00:11:14', t0.rt === '00:00:11:14', t0)
/* the boxes: the middle one, then the nudge and the grid apart at the right, before the out */
{ const [k, s, n, g, m] = await Promise.all(['key', 'smpte', 'nudge', 'grid', 'master'].map(box))
  ok('nudge and grid stand apart, right of the key, the out after them', k && n && g && m && n.l - k.r >= 20 && g.l >= n.r - 1 && m.l >= g.r && s.r <= k.l, [k, n, g, m]) }
/* typed: a place to the tick, a time */
{ const p = await box('pos'); await click(p.x, p.y); await typeIn('9.3.2.061')
  ok('a place typed to the tick goes there', await ev(`return place(curPos())`) === '9.3.2.061', await ev(`return place(curPos())`)) }
{ const p = await box('smpte'); await click(p.x, p.y); await typeIn('00:00:30:15')
  ok('a time typed goes there', await ev(`return smpte(curPos())`) === '00:00:30:15', await ev(`return [smpte(curPos()), place(curPos())]`)) }
/* a right press on the time: where its count begins, then its rate */
{ const p = await box('smpte'); await right(p.x, p.y)
  const items = await ev(`return S.menu ? S.menu.items.map(i => i.t) : null`)
  ok('a right press on the time: its start, then the rates', !!items && items[0] === 'start at 00:00:00:00' && items.includes('29.97 drop fps') && items.includes('25 fps'), items)
  const r = await menuRow('start at 00:00:00:00'); if (r) await click(r.x, r.y)
  await typeIn('01:00:00:00')
  ok('the start typed: the song begins at 01:00:00:00', await ev(`return [S.smpte.start, smpte(0)].join()`) === '01:00:00:00,01:00:00:00', await ev(`return S.smpte`))
  ok('…and the time shown counts from it', /^01:00:30:1[45]$/.test(await ev(`flush(); return document.getElementById('rt').textContent`)), await ev(`return document.getElementById('rt').textContent`)) }
{ const p = await box('smpte'); await right(p.x, p.y); const r = await menuRow('25 fps'); if (r) await click(r.x, r.y)
  ok('25 frames chosen: the start stays, the frames count to 24', await ev(`flush(); return S.smpte.rate === '25' && S.smpte.start === '01:00:00:00' && smpte(59.999 / SPB()) === '01:00:59:24'`), await ev(`return [S.smpte, smpte(59.999 / SPB())]`)) }
{ const p = await box('smpte'); await right(p.x, p.y); const r = await menuRow('29.97 drop fps'); if (r) await click(r.x, r.y)
  ok('29.97 drop: a ; before the frames, ten minutes on the clock read as ten minutes', await ev(`return S.smpte.rate === '29.97 drop' && smpte(600 / SPB()) === '01:10:00;00'`), await ev(`return [S.smpte, smpte(600 / SPB())]`)) }
/* kept with the project */
ok('kept with the project', await ev(`return JSON.parse(serialize()).smpte.rate === '29.97 drop' && JSON.parse(serialize()).smpte.start === '01:00:00;00'`), await ev(`return JSON.parse(serialize()).smpte`))
/* the nudge's and the grid's lists open where they now stand */
{ await ev(`S.menu = null; uiDirty('menu'); flush()`); const n = await box('nudge'); await click(n.x, n.y)
  const m = await ev(`return S.menu ? { x: S.menu.x, first: S.menu.items[0].t } : null`)
  ok('nudge pressed: its list, under it', !!m && m.first === 'bar' && Math.abs(m.x - (n.l)) < 40, [m, n]) }
{ await ev(`S.menu = null; uiDirty('menu'); flush()`); const g = await box('grid'); await click(g.x, g.y)
  const m = await ev(`return S.menu ? { x: S.menu.x, n: S.menu.items.length } : null`)
  ok('grid pressed: its list, under it', !!m && Math.abs(m.x - g.l) < 40, [m, g]) }
await ev(`S.menu = null; S.smpte = { rate: '30', start: '00:00:00:00' }; uiDirty('menu', 'top'); flush()`)
{ const errs = await ev(`return window.__errs || []`); ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close(); process.exit(bad.length ? 1 : 0)
