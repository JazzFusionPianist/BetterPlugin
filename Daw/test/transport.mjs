// node test/transport.mjs [w h] — where the song is and its time, as the transport panel says them (his asks of
// 2026-10-20 and 21): the place to the tick (bar . beat . sixteenth . tick), the time as SMPTE timecode; a place or a
// time typed goes there; a right press on the time gives its start and its rate; its start is set in a wide panel in
// the middle of the window. Real presses and keys; what is drawn is read back.
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
const box = a => ev(`const el = document.querySelector('#tp-col [data-a="${a}"]'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }`)
const typeIn = async text => { await ev(`const el = document.getElementById('rename'); el.value = ''; return 1`); await b.type(text); await b.press('Enter', 'Enter', 13); await b.sleep(150) }
const pick = async t => { const r = await ev(`const k = S.menu ? S.menu.items.findIndex(i => i.t === ${JSON.stringify(t)}) : -1; const el = [...document.querySelectorAll('#g-menu [data-a="pick"]')][k]; if (!el) return null; const q = el.getBoundingClientRect(); return { x: q.x + q.width / 2, y: q.y + q.height / 2 }`); if (r) await click(r.x, r.y); return !!r }
const said = () => ev(`flush(); SKINS.frame.panel(curPos()); return { bar: document.getElementById('tp-bar').textContent, rest: document.getElementById('tp-rest').textContent, tick: document.getElementById('tp-tick').textContent, smpte: document.getElementById('tp-smpte').textContent }`)

await ev(`if (typeof START !== 'undefined') START.on = false; tpanelSet(true, false); S.smpte = { rate: '30', start: '00:00:00:00' }; jumpTo(4 + 1 / 4 + 2 / 16 + 119 / 3840); S.panel.on = false; setView(true); dirtyAll(); flush(); return 1`)
const t0 = await said()
ok('the place to the tick: 5 .2.3 .120', t0.bar === '5' && t0.rest === '.2.3' && t0.tick === '.120', t0)
ok('the time as SMPTE, at 30 frames: 00:00:11:14', t0.smpte === '00:00:11:14', t0)
/* typed: a place to the tick, a time */
{ const p = await box('pos'); await click(p.x, p.y); await typeIn('9.3.2.061')
  ok('a place typed to the tick goes there', await ev(`return place(curPos())`) === '9.3.2.061', await ev(`return place(curPos())`)) }
{ const p = await box('smpte'); await click(p.x, p.y); await typeIn('00:00:30:15')
  ok('a time typed goes there', await ev(`return smpte(curPos())`) === '00:00:30:15', await ev(`return [smpte(curPos()), place(curPos())]`)) }
/* a right press on the time: its start, then its rate */
{ const p = await box('smpte'); await right(p.x, p.y)
  const items = await ev(`return S.menu ? S.menu.items.map(i => i.t) : null`)
  ok('a right press on the time: its start, then the rates', !!items && items[0] === 'start at 00:00:00:00' && items.includes('29.97 drop fps') && items.includes('25 fps'), items)
  await pick('start at 00:00:00:00')
  const q = await ev(`flush(); const el = document.getElementById('rename'), r = el.getBoundingClientRect(), a = S.ask; return { open: !el.hidden, v: el.value, big: !!(a && a.big), mid: r.x + r.width / 2, midY: r.y + r.height / 2, w: innerWidth, h: innerHeight }`)
  ok('its start: a wide panel in the middle of the window, the start in it', q.open && q.big && q.v === '00:00:00:00' && Math.abs(q.mid - q.w / 2) < 140 && Math.abs(q.midY - q.h / 2) < 120, q)
  await typeIn('01:00:00:00')
  ok('the start typed: the song begins at 01:00:00:00', await ev(`return [S.smpte.start, smpte(0)].join()`) === '01:00:00:00,01:00:00:00', await ev(`return S.smpte`))
  ok('…and the panel gone, the time counting from it', /^01:00:30:1[45]$/.test((await said()).smpte) && await ev('return !S.ask'), await said()) }
{ const p = await box('smpte'); await right(p.x, p.y); await pick('25 fps')
  ok('25 frames chosen: the start stays, the frames count to 24', await ev(`flush(); return S.smpte.rate === '25' && S.smpte.start === '01:00:00:00' && smpte(59.999 / SPB()) === '01:00:59:24'`), await ev(`return [S.smpte, smpte(59.999 / SPB())]`)) }
{ const p = await box('smpte'); await right(p.x, p.y); await pick('29.97 drop fps')
  ok('29.97 drop: a ; before the frames, ten minutes on the clock read as ten minutes', await ev(`return S.smpte.rate === '29.97 drop' && smpte(600 / SPB()) === '01:10:00;00'`), await ev(`return [S.smpte, smpte(600 / SPB())]`)) }
ok('kept with the project', await ev(`return JSON.parse(serialize()).smpte.rate === '29.97 drop' && JSON.parse(serialize()).smpte.start === '01:00:00;00'`), await ev(`return JSON.parse(serialize()).smpte`))
/* esc leaves the start as it was */
{ const p = await box('smpte'); await right(p.x, p.y); await pick(await ev(`return S.menu.items[0].t`)); await ev(`const el = document.getElementById('rename'); el.value = '02:00:00;00'; return 1`); await b.press('Escape', 'Escape', 27); await b.sleep(150)
  ok('esc: the start as it was, the panel gone', await ev(`return S.smpte.start === '01:00:00;00' && !S.ask`), await ev('return [S.smpte, !!S.ask]')) }
await ev(`S.menu = null; S.smpte = { rate: '30', start: '00:00:00:00' }; uiDirty('menu', 'top'); flush(); return 1`)
{ const errs = await ev(`return window.__errs || []`); ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close(); process.exit(bad.length ? 1 : 0)
