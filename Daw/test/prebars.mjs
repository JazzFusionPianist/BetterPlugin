// node test/prebars.mjs — bars before bar 1 (his ask, 2026-10-24; his pick of bars before one draft 1): the song starts at bar
// 1, its start a small square at the foot of the bars; pulled to the left, a bar for each bar's width — counted 0, −1 … as
// Logic does — everything keeping the bar it had, one step of undo; no further than −8; pulled back, the empty bars go, never
// one with something in it; the other button: where the song starts, from a list; the panel, the time and what is typed count
// from bar 1; kept with the project. Real presses.
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined && !cond ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const mouse = (type, x, y, extra = {}) => b.send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' }, extra))
const pull = async (p, dx) => { await b.sleep(350); await mouse('mouseMoved', p.x, p.y, { buttons: 0 }); await mouse('mousePressed', p.x, p.y); for (let k = 1; k <= 12; k++) await mouse('mouseMoved', p.x + dx * k / 12, p.y); await b.sleep(30); await mouse('mouseReleased', p.x + dx, p.y); await b.sleep(150) }
const rclick = async p => { await b.sleep(300); await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'right', buttons: 2, clickCount: 1 }); await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'right', clickCount: 1 }); await b.sleep(120) }
const pick = async label => { const i = await ev(`return S.menu ? S.menu.items.findIndex(it => it.t === ${JSON.stringify(label)}) : -1`); if (i < 0) return false; const q = await ev(`const el = document.querySelector('[data-a="pick"][data-i="${i}"]').getBoundingClientRect(); return { x: el.left + el.width / 2, y: el.top + el.height / 2 }`); await b.click(q.x, q.y); await b.sleep(150); return true }
const square = () => ev(`flush(); const el = document.querySelector('[data-a="prestart"]'); if (!el) return null; const q = el.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }`)
const bar = () => ev(`return PXB * board.getBoundingClientRect().width / (W + (SKV.left || 0))`)
/* the first region of the kick, as its bar is said, and where it lies */
const first = () => ev(`const r = S.tracks.find(t => t.name === 'kick').regs.slice().sort((p, q) => p.a - q.a)[0]; return { said: readout(r.a - 1), a: r.a }`)
const labels = () => ev(`flush(); return [...document.querySelectorAll('#g-ruler text')].map(t => t.textContent).filter(w => /^[−\\d]+$/.test(w))`)
await ev(`if (typeof START !== 'undefined') START.on = false; tpanelSet(false, false); setZoom(60, 0); VX = 0; dirtyAll(); flush(); return 1`)      // (every bar named on the bars)
const f0 = await first()
ok('the song begins at bar 1: none before it, its start a square at the foot of the bars', await ev(`return preBars()`) === 0 && !!(await square()) && (await labels())[0] === '1', [await labels(), await square()])

/* pulled three bars to the left */
{ const u0 = await ev(`return UNDO.length`), w = await bar()
  await pull(await square(), -3 * w - 4)
  const f = await first(), l = await labels()
  ok('pulled three bars\' width to the left: three bars before bar 1', await ev(`return preBars()`) === 3, await ev(`return preBars()`))
  ok('…counted −2, −1, 0 before 1 on the bars', l.includes('−2') && l.includes('1') && l.indexOf('−2') < l.indexOf('1'), l)
  ok('…everything keeps the bar it had (the kick\'s first region is said where it was)', f.said === f0.said && f.a === f0.a + 3, [f0, f])
  ok('…one step of undo', await ev(`return UNDO.length`) === u0 + 1) }
/* the panel, the time and what is typed count from bar 1 */
await ev(`jumpTo(0); flush(); return 1`)
ok('at the song\'s first bar the place is −2.1.1.001', await ev(`return place(0)`) === '−2.1.1.001', await ev(`return place(0)`))
ok('…its time before zero, running up to it at bar 1', /^−/.test(await ev(`return smpte(0)`)) && await ev(`return smpte(3)`) === await ev(`return smpteStart()`), [await ev(`return smpte(0)`), await ev(`return smpte(3)`)])
ok('typed: "1" is bar 1, "−2" the first, "0" the one before 1', await ev(`return [parsePos('1'), parsePos('−2'), parsePos('-2'), parsePos('0')]`).then(v => JSON.stringify(v) === '[3,0,0,2]'), await ev(`return [parsePos('1'), parsePos('−2'), parsePos('-2'), parsePos('0')]`))
/* no further than −8 */
{ const w = await bar(); await pull(await square(), -12 * w)
  ok('pulled far: no further than −8 (nine before bar 1)', await ev(`return preBars()`) === 9 && (await labels())[0] === '−8', [await ev(`return preBars()`), (await labels()).slice(0, 3)]) }
/* back: the empty ones go, not one with something in it */
await ev(`const t = S.tracks.find(t => t.name === 'kick'), r = t.regs.slice().sort((p, q) => p.a - q.a)[0]; edit(() => { t.regs.push(cloneReg(r, { a: preBars() - 1 + 1, b: preBars() + 1 })) }); flush(); return 1`)      // (a region on bar 0)
{ const w = await bar(); await pull(await square(), 12 * w)
  ok('pulled back to the right: the empty bars go, the one with a region on it (bar 0) stays', await ev(`return preBars()`) === 1, await ev(`return preBars()`)) }
/* the other button: the list */
await rclick(await square())
{ const m = await ev(`return S.menu ? S.menu.items.map(it => [it.t, !!it.on, !!it.dim]) : null`)
  ok('the other button on the square: where the song starts — 1 (not to be had: a region on bar 0), 0 (now), −1 … −8', !!m && m[0][0] === 'the song starts at bar' && JSON.stringify(m[1]) === '["1",false,true]' && JSON.stringify(m[2]) === '["0",true,false]' && m[m.length - 1][0] === '−8', m) }
await pick('−4')
ok('…−4 picked: five before bar 1', await ev(`return preBars()`) === 5, await ev(`return preBars()`))
await ev(`undoEdit(); flush(); return 1`)
ok('…undone: as it was', await ev(`return preBars()`) === 1)
/* kept */
{ const k = await ev(`return JSON.parse(serialize()).pre`); ok('kept with the project', k === 1, k) }
{ const errs = await ev(`return window.__errs || []`); ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close(); process.exit(bad.length ? 1 : 0)
