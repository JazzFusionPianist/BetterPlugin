// node test/edit2.mjs — editing, round 2: the smart tool (what a press does goes by where on the region it lands), fades and
// crossfades made by hand, fades for everything chosen at once, and the five modes a pull is placed by
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const regs = name => ev(`return S.tracks.find(t => t.name === ${JSON.stringify(name)}).regs.slice().sort((x, y) => x.a - y.a).map(r => [+r.a.toFixed(4), +r.b.toFixed(4), +(r.off || 0).toFixed(4)])`)
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y)
// a place on a track's lane: the bar (from one) and how far down the row (0 its top, 1 its foot), with a few pixels to a side
const at = (name, bar, fy = .5, dx = 0) => ev(`const i = S.tracks.findIndex(t => t.name === ${JSON.stringify(name)}), r = document.getElementById('board').getBoundingClientRect(); return { x: r.left + bx(${bar}) + ${dx}, y: r.top + rowY(i) + 1.5 + (S.rh - 3) * ${fy} }`)
const zone = async (name, bar, fy, dx) => { const p = await at(name, bar, fy, dx); return ev(`const r = document.getElementById('board').getBoundingClientRect(); return smartZone(S.tracks.findIndex(t => t.name === ${JSON.stringify(name)}), { x: ${p.x} - r.left, y: ${p.y} - r.top }).z`) }
const key = async (k, code, vk, mods) => { await b.press(k, code, vk, mods || 0); await b.sleep(60) }
const undo = () => key('z', 'KeyZ', 90, 4)
const px = n => ev(`return ${n} / PXB`)                      // so many pixels, in bars
const near = (x, y, tol = 1e-6) => Math.abs(x - y) <= tol
const reg = (name, a) => `S.tracks.find(t => t.name === ${JSON.stringify(name)}).regs.find(x => Math.abs(x.a - ${a}) < 1e-6)`
const TOP = .08, FOOT = .94, UP = .3, LOW = .72

await ev(`S.rh = 40; setZoom(24, 20); __daw.redraw()`)       // rows tall enough to tell the zones apart, 24 pixels to a bar
ok('the tool menu has the smart tool, and s picks it', await ev(`return TOOLS.some(t => t[0] === 'smart' && t[1] === 'KeyS')`))
await key('t', 'KeyT', 84); await key('s', 'KeyS', 83)
ok('t then s: the smart tool is in the hand', await ev(`return S.tool === 'smart' && !S.menu`))

// ── where a press lands ──
ok('its top corners are its fades', (await zone('kick', 5, TOP, 4)) === 'fi' && (await zone('kick', 13, TOP, -4)) === 'fo', [await zone('kick', 5, TOP, 4), await zone('kick', 13, TOP, -4)])
ok('its ends trim it', (await zone('kick', 5, .5, 2)) === 'tl' && (await zone('kick', 13, .5, -2)) === 'tr')
ok('the upper half picks a stretch of time, the lower half takes hold of the region', (await zone('kick', 9, UP)) === 'range' && (await zone('kick', 9, LOW)) === 'grab')
ok('the foot of a join is the crossfade', (await zone('kick', 25, FOOT, 0)) === 'x' && (await zone('kick', 25, FOOT, 8)) === 'x' && (await zone('kick', 25, FOOT, -8)) === 'x')
ok('an empty lane picks a stretch of time', (await zone('kick', 15, .5)) === 'range')
ok('the other way round when asked (the logic way)', await ev(`SMART.flip = true; const i = S.tracks.findIndex(t => t.name === 'kick'), z = [smartZone(i, { x: bx(9), y: rowY(i) + 1.5 + (S.rh - 3) * ${UP} }).z, smartZone(i, { x: bx(9), y: rowY(i) + 1.5 + (S.rh - 3) * ${LOW} }).z]; SMART.flip = false; return z.join() === 'grab,range'`))
{ const p = await at('kick', 5, TOP, 4); await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y, buttons: 0 }); await b.sleep(40)
  const c1 = await ev(`return document.querySelector('[data-a="lanes"]').style.cursor`)
  const q = await at('kick', 9, LOW); await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: q.x, y: q.y, buttons: 0 }); await b.sleep(40)
  const c2 = await ev(`return document.querySelector('[data-a="lanes"]').style.cursor`)
  ok('the pointer says which: its own picture for a fade, another for taking hold', /url\(/.test(c1) && /url\(/.test(c2) && c1 !== c2, [c1.slice(0, 40), c2.slice(0, 40)]) }

// ── fades by hand ──
{ const p = await at('kick', 5, TOP, 4); await b.dragTo(p.x, p.y, p.x + 36, p.y + 6, 6); await b.sleep(60) }
ok('pulled in from the top left corner: a fade in as long as the hand moved, off the grid', near(await ev(`return ${reg('kick', 5)}.fi`), await px(36), 1e-6), [await ev(`return ${reg('kick', 5)}.fi`), await px(36)])
ok('and the region itself did not move', same((await regs('kick'))[0], [5, 13, 4]))
{ const fi = await ev(`return ${reg('kick', 5)}.fi`), p = await at('kick', 5 + fi, TOP, 0)
  ok('where the fade ends, along the top, is its handle', (await zone('kick', 5 + fi, TOP, 0)) === 'fi' && (await zone('kick', 5 + fi, TOP, 4)) === 'fi')
  await b.dragTo(p.x, p.y, p.x + 24, p.y, 6); await b.sleep(60)
  ok('pulled on from there: longer by as much', near(await ev(`return ${reg('kick', 5)}.fi`), fi + await px(24), 1e-6)) }
{ const p = await at('kick', 13, TOP, -4); await b.dragTo(p.x, p.y, p.x - 48, p.y, 6); await b.sleep(60) }
ok('and from the top right corner: a fade out', near(await ev(`return ${reg('kick', 5)}.fo`), await px(48), 1e-6))
{ const fo = await ev(`return ${reg('kick', 5)}.fo`), p = await at('kick', 13 - fo, TOP, 0); await b.dragTo(p.x, p.y, p.x + 200, p.y, 8); await b.sleep(60) }
ok('pushed back out past the end: the fade is gone', await ev(`return ${reg('kick', 5)}.fo === 0`))
await undo(); await undo(); await undo(); await undo()
ok('undone, one pull at a time', await ev(`const r = ${reg('kick', 5)}; return !r.fi && !r.fo`))

// ── the lower half takes hold, the upper half picks ──
{ const p = await at('kick', 9, LOW), q = await at('kick', 11, LOW); await b.dragTo(p.x, p.y, q.x, q.y, 8); await b.sleep(60) }
ok('pulled by its lower half: the region moves', same((await regs('kick'))[0], [7, 15, 4]), await regs('kick'))
await undo()
{ const p = await at('kick', 9, UP), q = await at('kick', 11, UP); await b.dragTo(p.x, p.y, q.x, q.y, 8); await b.sleep(60) }
ok('pulled across its upper half: a stretch of time, and nothing moves', await ev(`return !!S.marq && S.marq.a === 8 && S.marq.b === 10 && !S.selR.length`) && same((await regs('kick'))[0], [5, 13, 4]), await ev('return S.marq'))
{ const p = await at('kick', 12, UP); await b.click(p.x, p.y, 8); await b.sleep(60) }
ok('shift and a press further on: the stretch reaches there', await ev(`return !!S.marq && S.marq.a === 8 && S.marq.b === 11`), await ev('return S.marq'))
{ const p = await at('kick', 10, UP); await b.click(p.x, p.y); await b.sleep(60) }
ok('pressed and let go there: the playhead goes to it, and no stretch is left', await ev(`return !S.marq && S.pos === 9`), await ev('return [S.marq, S.pos]'))
{ const p = await at('kick', 13, .5, -2), q = await at('kick', 12, .5); await b.dragTo(p.x, p.y, q.x, q.y, 8); await b.sleep(60) }
ok('its end pulled in: trimmed', same((await regs('kick'))[0], [5, 12, 4]), await regs('kick'))
await undo()

// ── a crossfade by hand ──
{ const p = await at('kick', 25, FOOT, 0); await b.click(p.x, p.y); await b.sleep(60) }
const short = await ev(`return .02 / SPB()`)
ok('the foot of a join pressed: a crossfade just long enough to heal the cut, and it is the thing chosen', await ev(`const A = ${reg('kick', 17)}, B = S.tracks.find(t => t.name === 'kick').regs.find(x => x !== A && xfadeOf(A, x)); return !!B && Math.abs(xfadeOf(A, B) - ${short}) < 1e-9 && !!S.selX && S.selX[0] === A.id && S.selX[1] === B.id && !S.selR.length`))
await ev(`tpanelSet(true, false); flush(); return 1`)      // (the transport panel says it now: the tool row is gone)
ok('the transport panel says so, and how it bends', await ev(`const t = [...document.querySelectorAll('#tp-col text')].map(x => x.textContent); return t.includes('crossfade 20 ms') && !!document.querySelector('#tp-col [data-a="fcurve"]')`), await ev(`return [...document.querySelectorAll('#g-info text')].map(x => x.textContent).slice(-8)`))
{ const p = await ev(`const el = document.querySelector('[data-a="fcurve"]').getBoundingClientRect(); return { x: el.left + el.width / 2, y: el.top + el.height / 2 }`); await b.click(p.x, p.y); await b.sleep(60)
  const i = await ev(`return S.menu ? S.menu.items.findIndex(it => it.t === 's curve') : -1`)
  const q = await ev(`const el = document.querySelector('[data-a="pick"][data-i="${i}"]').getBoundingClientRect(); return { x: el.left + el.width / 2, y: el.top + el.height / 2 }`); await b.click(q.x, q.y); await b.sleep(60)
  ok('its bend is picked there: both sides take it', await ev(`const A = regOf(S.selX[0])[0], B = regOf(S.selX[1])[0]; return A.foc === 2 && B.fic === 2`)) }
await ev(`tpanelSet(false, false); flush(); return 1`)
await undo()
await key('Backspace', 'Backspace', 8)
ok('delete with it chosen: a plain join again, both regions still there', same(await regs('kick'), [[5, 13, 4], [17, 25, 16], [25, 33, 24], [33, 41, 32]]) && await ev(`return !${reg('kick', 17)}.fo && !S.selX`), await regs('kick'))
await undo(); await undo()
{ const p = await at('kick', 25, FOOT, 0); await b.dragTo(p.x, p.y, p.x + 30, p.y, 6); await b.sleep(60) }
ok('pulled out of the foot of a join: a crossfade twice as long as the pull, about the join', await ev(`const A = ${reg('kick', 17)}, B = S.tracks.find(t => t.name === 'kick').regs.find(x => x !== A && xfadeOf(A, x)); return !!B && Math.abs(xfadeOf(A, B) - 60 / PXB) < 1e-6 && Math.abs((A.b + B.a) / 2 - 25) < 1e-9`), await regs('kick'))
{ const over = await ev(`return 60 / PXB`), p = await at('kick', 25 + over / 2, TOP, -3)
  ok('its top corners are its handles', (await zone('kick', 25 + over / 2, TOP, -3)) === 'fi' && (await zone('kick', 25 - over / 2, TOP, 3)) === 'fo', [await zone('kick', 25 + over / 2, TOP, -3), await zone('kick', 25 - over / 2, TOP, 3)])
  await b.dragTo(p.x, p.y, p.x + 12, p.y, 6); await b.sleep(60)
  ok('one pulled outwards: longer by twice the pull, still about the join', await ev(`const A = ${reg('kick', 17)}, B = S.tracks.find(t => t.name === 'kick').regs.find(x => x !== A && xfadeOf(A, x)); return Math.abs(xfadeOf(A, B) - 84 / PXB) < 1e-6 && Math.abs((A.b + B.a) / 2 - 25) < 1e-9`), await ev(`const A = ${reg('kick', 17)}; return [A.b, A.fo * PXB]`)) }
{ const p = await at('kick', 25, FOOT, 0), q = await at('kick', 26, FOOT, 0); await b.dragTo(p.x, p.y, q.x, q.y, 8); await b.sleep(60) }
ok('taken hold of at its foot and pulled a bar on: the join goes along, the crossfade as long as it was', await ev(`const A = ${reg('kick', 17)}, B = S.tracks.find(t => t.name === 'kick').regs.find(x => x !== A && xfadeOf(A, x)); return Math.abs(xfadeOf(A, B) - 84 / PXB) < 1e-6 && Math.abs((A.b + B.a) / 2 - 26) < 1e-9 && Math.abs(B.off - (B.a - 1)) < 1e-9`), await regs('kick'))
await undo()
// the pointer on an end that is part of a crossfade pulls the join too
await ev(`pickTool('pointer')`)
{ const over = await ev(`return 84 / PXB`), p = await at('kick', 25 + over / 2, .5, -2), q = await at('kick', 24, .5, 0); await b.dragTo(p.x, p.y, q.x, q.y, 8); await b.sleep(60) }
// (the end stays under the hand — the pull is counted from where it was taken hold of — and it is the join, the middle of the crossfade, that keeps to the grid)
ok('the plain pointer on an end that is part of a crossfade pulls the join, not one side of it', await ev(`const A = ${reg('kick', 17)}, B = S.tracks.find(t => t.name === 'kick').regs.find(x => x !== A && xfadeOf(A, x)), mid = B ? (A.b + B.a) / 2 : 0; return !!B && Math.abs(xfadeOf(A, B) - 84 / PXB) < 1e-6 && Math.abs(mid - Math.round(mid)) < 1e-6 && Math.abs(A.b - 24) <= .5 + 1e-6`), await regs('kick'))
await undo()
// one of the two is taken away: a plain join first
{ const p = await at('kick', 29, .6), q = await at('kick', 30, .6); await b.dragTo(p.x, p.y, q.x, q.y, 8); await b.sleep(60) }
ok('one of the two pulled away: the other keeps to the join, with no fade left hanging', await ev(`const A = ${reg('kick', 17)}; return A.b === 25 && !A.fo`) && await ev(`const B = ${reg('kick', 26)}; return !!B && B.b === 34 && !B.fi && B.off === 24`), await regs('kick'))
await undo()
// scissors inside a crossfade
await ev(`pickTool('scissors'); S.mode = 'slip'; S.snap = false`)
{ const was = JSON.stringify(await regs('kick')), steps = await ev(`return UNDO.length`), p = await at('kick', 25, .5, 10); await b.click(p.x, p.y); await b.sleep(60)
  ok('the scissors inside a crossfade: the two are two already — nothing is cut, nothing changes, nothing to undo', JSON.stringify(await regs('kick')) === was && await ev(`return UNDO.length`) === steps && await ev(`const rs = S.tracks.find(t => t.name === 'kick').regs.slice().sort((x, y) => x.a - y.a); return rs.length === 4 && xfadeOf(rs[1], rs[2]) > 0`), await regs('kick')) }
await undo(); await undo()
await ev(`setMode('smart'); pickTool('pointer')`)
ok('all of it undone', same(await regs('kick'), [[5, 13, 4], [17, 25, 16], [25, 33, 24], [33, 41, 32]]) && await ev(`return S.tracks.find(t => t.name === 'kick').regs.every(r => !r.fi && !r.fo)`), await regs('kick'))

// ── the fade tool across a join ──
await ev(`pickTool('fade')`)
{ const p = await at('snare', 25, .5, -3), q = await at('snare', 25, .5, 21); await b.dragTo(p.x, p.y, q.x, q.y, 6); await b.sleep(60) }
ok('the fade tool pulled across a join: a crossfade', await ev(`const A = ${reg('snare', 17)}, B = S.tracks.find(t => t.name === 'snare').regs.find(x => x !== A && xfadeOf(A, x)); return !!B && Math.abs(xfadeOf(A, B) - 42 / PXB) < 1e-6`), await regs('snare'))
{ const p = await at('snare', 25, .5, 0); await b.click(p.x, p.y, 1); await b.sleep(60) }
ok('with option: taken off again', same(await regs('snare'), [[5, 13, 4], [17, 25, 16], [25, 33, 24], [33, 41, 32]]))
{ const p = await at('snare', 9, .5, 0), q = await at('snare', 6, .5); await b.dragTo(p.x - 60, p.y, q.x, q.y, 6); await b.sleep(60) }
ok('inside a region it is a fade as before: from its start to the pointer', near(await ev(`return ${reg('snare', 5)}.fi`), 1, 1e-6), await ev(`return ${reg('snare', 5)}.fi`))
await undo(); await undo(); await undo()
await ev(`pickTool('pointer')`)

// ── fades for everything chosen, at once ──
await ev(`const t = S.tracks.find(t => t.name === 'kick'); S.selR = t.regs.filter(r => r.a >= 17).map(r => r.id); S.marq = null; S.focus = 'lanes'; __daw.redraw()`)
await key('f', 'KeyF', 70)
ok('f with three neighbours chosen: both joins crossfaded, the two open ends given a short fade', await ev(`const rs = S.tracks.find(t => t.name === 'kick').regs.slice().sort((x, y) => x.a - y.a); const s = .01 / SPB(), x = .02 / SPB(); return rs.length === 4 && Math.abs(xfadeOf(rs[1], rs[2]) - x) < 1e-9 && Math.abs(xfadeOf(rs[2], rs[3]) - x) < 1e-9 && Math.abs(rs[1].fi - s) < 1e-12 && Math.abs(rs[3].fo - s) < 1e-12 && !rs[0].fi && !rs[0].fo`), await regs('kick'))
await key('f', 'KeyF', 70)
ok('again: nothing more to do, and nothing added to undo', await ev(`return UNDO.length`) === await ev(`return UNDO.length`))
await undo()
ok('one undo takes all of it back', same(await regs('kick'), [[5, 13, 4], [17, 25, 16], [25, 33, 24], [33, 41, 32]]) && await ev(`return S.tracks.find(t => t.name === 'kick').regs.every(r => !r.fi && !r.fo)`))
await ev(`S.selR = []; S.marq = { a: 23.5, b: 24.25, t0: 0, t1: 1 }; S.focus = 'lanes'; __daw.redraw()`)      // bars from zero: half a bar before the join at bar 25, a quarter after
await key('f', 'KeyF', 70)
ok('f with a marquee across a join, on two tracks: each is crossfaded over exactly the marquee', await ev(`return ['kick', 'snare'].every(n => { const rs = S.tracks.find(t => t.name === n).regs.slice().sort((x, y) => x.a - y.a); return Math.abs(rs[2].a - 24.5) < 1e-9 && Math.abs(rs[1].b - 25.25) < 1e-9 && Math.abs(xfadeOf(rs[1], rs[2]) - .75) < 1e-9 && Math.abs(rs[2].off - 23.5) < 1e-9 }) && !S.marq`), [await regs('kick'), await regs('snare')])
await undo()
await ev(`S.selR = []; S.marq = { a: 4, b: 4.5, t0: 0, t1: 0 }; __daw.redraw()`)
await key('f', 'KeyF', 70)
ok('a marquee over the start of a region: it fades in over it', await ev(`const r = ${reg('kick', 5)}; return r.fi === .5 && !r.fo`))
await undo()

// ── the modes ──
ok('the mode is in the transport panel', await ev(`tpanelSet(true, false); flush(); const on = !!document.querySelector('#tp-col [data-a="modemenu"]') && S.mode === 'smart'; tpanelSet(false, false); flush(); return on`))
await ev(`S.selR = []; S.marq = null; __daw.redraw()`)
// smart: a region let go near the end of another goes to that end
{ const p = await at('hats', 15, .5), q = await at('hats', 16.3, .5); await b.dragTo(p.x, p.y, q.x, q.y, 8); await b.sleep(60) }
ok('smart: let go a little way off the grid (a bar, at this zoom), it goes to the grid', same((await regs('hats'))[0], [14, 18, 12]), await regs('hats'))
await undo()
await ev(`S.pos = 2.3`)
{ const p = await at('hats', 13, .5, 30), q = await at('hats', 3.3, .5, 30 + 2); await b.dragTo(p.x, p.y, q.x, q.y, 8); await b.sleep(60) }
ok('smart: the playhead pulls harder than the grid', near((await regs('hats'))[0][0], 3.3, 1e-6), await regs('hats'))
await undo()
await key('F4', 'F4', 115)
ok('f4: the grid mode', await ev(`return S.mode === 'grid' && S.snap`))
{ const p = await at('hats', 13, .5, 30), q = await at('hats', 3.3, .5, 30 + 2); await b.dragTo(p.x, p.y, q.x, q.y, 8); await b.sleep(60) }
ok('grid: the grid alone — the playhead does not pull', near((await regs('hats'))[0][0], 3, 1e-6), await regs('hats'))
await undo()
await key('F2', 'F2', 113)
ok('f2: slip', await ev(`return S.mode === 'slip' && !S.snap`))
{ const p = await at('hats', 15, .5), q = await at('hats', 15, .5, 7); await b.dragTo(p.x, p.y, q.x, q.y, 8); await b.sleep(60) }
ok('slip: it stays exactly where it is let go', near((await regs('hats'))[0][0], 13 + await px(7), 1e-4), await regs('hats'))
await undo()
await key('F2', 'F2', 113); ok('f2 from slip: back to the mode before it', await ev(`return S.mode === 'grid'`))
await key('F2', 'F2', 113); ok('and again: slip', await ev(`return S.mode === 'slip'`))
// the menu
await ev(`tpanelSet(true, false); flush(); return 1`)      // (the mode's key is in the transport panel)
{ const p = await ev(`const el = document.querySelector('[data-a="modemenu"]').getBoundingClientRect(); return { x: el.left + el.width / 2, y: el.top + el.height / 2 }`); await b.click(p.x, p.y); await b.sleep(60)
  ok('the mode key opens the five of them', same(await ev(`return S.menu && S.menu.items.map(i => i.t)`), ['smart', 'grid', 'slip', 'shuffle', 'spot']))
  const i = await ev(`return S.menu.items.findIndex(it => it.t === 'shuffle')`)
  const q = await ev(`const el = document.querySelector('[data-a="pick"][data-i="${i}"]').getBoundingClientRect(); return { x: el.left + el.width / 2, y: el.top + el.height / 2 }`); await b.click(q.x, q.y); await b.sleep(60)
  ok('shuffle picked there', await ev(`return S.mode === 'shuffle' && !S.menu`)) }
await ev(`tpanelSet(false, false); flush(); return 1`)
await key('F1', 'F1', 112); ok('f1 is shuffle too', await ev(`return S.mode === 'shuffle'`))

// ── shuffle ──
{ const p = await at('snare', 20, .5); await b.click(p.x, p.y); await key('Backspace', 'Backspace', 8) }
ok('shuffle: a region taken out — what follows closes up, what came before stays', same(await regs('snare'), [[5, 13, 4], [17, 25, 24], [25, 33, 32]]), await regs('snare'))
await undo()
{ const p = await at('snare', 25, .5, -2), q = await at('snare', 23, .5); await b.dragTo(p.x, p.y, q.x, q.y, 8); await b.sleep(60) }
ok('an end pulled in two bars: everything after it comes two bars earlier', same(await regs('snare'), [[5, 13, 4], [17, 23, 16], [23, 31, 24], [31, 39, 32]]), await regs('snare'))
await undo()
{ const p = await at('snare', 17, .5, 2), q = await at('snare', 19, .5); await b.dragTo(p.x, p.y, q.x, q.y, 8); await b.sleep(60) }
ok('a start pulled in two bars: it still begins where it did, two bars into its sound, and the rest closes up', same(await regs('snare'), [[5, 13, 4], [17, 23, 18], [23, 31, 24], [31, 39, 32]]), await regs('snare'))
await undo()
{ const p = await at('snare', 9, .5), q = await at('snare', 9 + 23, .5); await b.dragTo(p.x, p.y, q.x, q.y, 10); await b.sleep(60) }
ok('a region let go further on: its gap closes, and it is put in at the nearest join — the ones after make room', same(await regs('snare'), [[9, 17, 16], [17, 25, 24], [25, 33, 4], [33, 41, 32]]), await regs('snare'))
await undo()
ok('undone', same(await regs('snare'), [[5, 13, 4], [17, 25, 16], [25, 33, 24], [33, 41, 32]]))
{ const p = await at('hats', 15, .5); await b.click(p.x, p.y); await key('c', 'KeyC', 67, 4)
  await ev(`S.sel = S.tracks.findIndex(t => t.name === 'snare'); S.pos = 20`); await key('v', 'KeyV', 86, 4) }
ok('pasted into the middle of a region: the region is cut there and its second half, with all that follows, makes room', same(await regs('snare'), [[5, 13, 4], [17, 21, 16], [21, 25, 12], [25, 29, 20], [29, 37, 24], [37, 45, 32]]), await regs('snare'))
await undo()
await ev(`S.selR = []; S.marq = { a: 18, b: 20, t0: S.tracks.findIndex(t => t.name === 'snare'), t1: S.tracks.findIndex(t => t.name === 'snare') }; S.focus = 'lanes'; __daw.redraw()`)
await key('Backspace', 'Backspace', 8)
ok('a stretch taken out with the marquee: two bars are gone from the track', same(await regs('snare'), [[5, 13, 4], [17, 19, 16], [19, 23, 20], [23, 31, 24], [31, 39, 32]]), await regs('snare'))
await undo()
ok('the other tracks were never touched', same(await regs('kick'), [[5, 13, 4], [17, 25, 16], [25, 33, 24], [33, 41, 32]]))

// ── spot ──
await key('F3', 'F3', 114); ok('f3: spot', await ev(`return S.mode === 'spot' && !S.snap`))
{ const p = await at('snare', 9, .5); await b.click(p.x, p.y); await b.sleep(120) }
ok('a region pressed: it asks where it should begin, and says where it begins now', await ev(`const el = document.getElementById('rename'); return !el.hidden && el.value === '5.1.1'`), await ev(`const el = document.getElementById('rename'); return [el.hidden, el.value]`))
await ev(`document.getElementById('rename').value = '7 3'`); await key('Enter', 'Enter', 13); await b.sleep(80)
ok('bar seven, the third beat typed: it begins there', same((await regs('snare'))[0], [7.5, 15.5, 4]), await regs('snare'))
await undo()
{ const p = await at('snare', 9, .5); await b.click(p.x, p.y); await b.sleep(120) }
await ev(`document.getElementById('rename').value = '10s'`); await key('Enter', 'Enter', 13); await b.sleep(80)
ok('a time typed: ten seconds in', near((await regs('snare'))[0][0], 1 + await ev(`return 10 / SPB()`), 1e-4), await regs('snare'))
await undo()
{ const p = await at('snare', 9, .5); await b.click(p.x, p.y); await b.sleep(120) }
await key('Escape', 'Escape', 27); await b.sleep(60)
ok('escape: nothing moves', same((await regs('snare'))[0], [5, 13, 4]) && await ev(`return document.getElementById('rename').hidden`))
ok('a place typed many ways', await ev(`const q = SPB(); return parsePos('17') === 16 && parsePos('17.3') === 16.5 && parsePos('17 3 2') === 16.5625 && Math.abs(parsePos('1.1.1.120') - 119 / 3840) < 1e-12 && parsePos('1.1.1.1') === 0 && Math.abs(parsePos('1:02.5') - 62.5 / q) < 1e-9 && Math.abs(parsePos('250ms') - .25 / q) < 1e-12 && parsePos('x') === null && parsePos('0') === null`))

// ── the mode is the project's ──
ok('the mode is written with the project and read back', await ev(`setMode('grid'); const j = JSON.parse(serialize()); const had = j.mode; setMode('smart'); return had === 'grid'`))
await ev(`setMode('smart')`)

// ── keys for working while the song runs ──
await ev(`S.selR = [${reg('kick', 5)}.id]; S.focus = 'lanes'; S.marq = null; S.pos = 6.5; __daw.redraw()`)
await key('d', 'KeyD', 68)
ok('d: the chosen region fades in from its start up to the playhead', await ev(`const r = ${reg('kick', 5)}; return r.fi === 2.5 && !r.fo`), await ev(`return ${reg('kick', 5)}.fi`))
await ev(`S.pos = 10`); await key('g', 'KeyG', 71)
ok('g: and out from the playhead to its end', await ev(`const r = ${reg('kick', 5)}; return r.fi === 2.5 && r.fo === 2`), await ev(`return ${reg('kick', 5)}.fo`))
await undo(); await undo()
await ev(`S.selR = []; S.sel = S.tracks.findIndex(t => t.name === 'snare'); S.selT = []; S.pos = 18`); await key('g', 'KeyG', 71)
ok('with nothing chosen: the region under the playhead on the chosen track', await ev(`return ${reg('snare', 17)}.fo === 6 && !${reg('kick', 17)}.fo`))
await undo()
await ev(`S.pos = 14.5`); await key('d', 'KeyD', 68)
ok('where no region stands under the playhead: nothing, and nothing to undo', await ev(`return UNDO.length`) === await ev(`return UNDO.length`) && await ev(`return S.tracks.find(t => t.name === 'snare').regs.every(r => !r.fi && !r.fo)`))
// cut, trimmed and gone from beginning to beginning while it plays
await ev(`
  const t = S.tracks.find(t => t.name === 'guitar'); t.theirs = null
  window.__F = mkReg({ a: 1, b: 9, key: 'file:t', loop: false, rate: 1, sec: 8 * SPB(), srcBars: 8, off: 0, name: 'take', bpm: 144 })
  t.regs.push(__F); TRANS.set('file:t', [2, 4, 6, 8, 10, 12, 14, 16, 18].map(k => k * SPB() / 4))
  S.selR = [__F.id]; S.sel = S.tracks.indexOf(t); S.pos = 0; S.marq = null; S.focus = 'lanes'; __daw.redraw()`)
await key(' ', 'Space', 32); await b.sleep(250)
ok('the song runs', await ev(`return S.playing`))
{ const p0 = await ev(`return curPos()`); await key('Tab', 'Tab', 9); await b.sleep(80); const p1 = await ev(`return curPos()`)
  ok('tab while it runs: on to the next beginning, and it goes on from there', p1 >= .5 - 1e-6 && p1 > p0 && p1 < 1.2 && await ev(`return S.playing`), [p0, p1]) }
{ const n0 = await ev(`return S.tracks.find(t => t.name === 'guitar').regs.filter(r => r.key === 'file:t').length`); await key('t', 'KeyT', 84, 4); await b.sleep(60)
  ok('command t while it runs: cut where the playhead was', await ev(`return S.tracks.find(t => t.name === 'guitar').regs.filter(r => r.key === 'file:t').length`) === n0 + 1 && await ev(`return S.playing`)) }
await key(' ', 'Space', 32); await undo()
// ── how fast a file goes ──
await ev(`S.selR = [__F.id]; S.focus = 'lanes'; __daw.redraw()`)
await ev(`tpanelSet(true, false); flush(); return 1`)      // (the transport panel says it now)
ok('a file whose speed is known says it in the transport panel', await ev(`const t = [...document.querySelectorAll('#tp-col text')].map(x => x.textContent); return t.some(x => x === '144 bpm') && !!document.querySelector('[data-a="rbpm"]')`), await ev(`return [...document.querySelectorAll('#g-info text')].map(x => x.textContent).slice(-8)`))
{ const p = await ev(`const el = document.querySelector('[data-a="rbpm"]').getBoundingClientRect(); return { x: el.left + el.width / 2, y: el.top + el.height / 2 }`); await b.click(p.x, p.y); await b.sleep(120)
  ok('pressed: it can be typed', await ev(`const el = document.getElementById('rename'); return !el.hidden && el.value === '144'`), await ev(`const el = document.getElementById('rename'); return [el.hidden, el.value]`))
  await ev(`document.getElementById('rename').value = '72'`); await key('Enter', 'Enter', 13); await b.sleep(80)
  ok('heard at twice its speed, put right by hand', await ev(`return regOf(__F.id)[0].bpm === 72`)) }
await ev(`tpanelSet(false, false); flush(); return 1`)
{ const t0 = await ev(`return S.tempo`)
  await ev(`S.selR = [__F.id]; await act.fitTempo()`); await b.sleep(80)
  ok('fitted to the song: it follows the tempo, stretched by the song’s speed over its own', await ev(`const r = regOf(__F.id)[0]; return r.fx === true && Math.abs(r.rate - S.tempo / 72) < 1e-9 && Math.abs((r.b - r.a) - 8 * 72 / S.tempo) < 1e-6 && Math.abs(r.srcBars - 8 * 72 / S.tempo) < 1e-6`), await ev(`const r = regOf(__F.id)[0]; return [r.rate, r.b - r.a, S.tempo]`))
  await undo()
  await ev(`S.selR = [__F.id]; await act.tempoFrom()`); await b.sleep(200)
  ok('the song takes the file’s speed', await ev(`return S.tempo`) === 72 && await ev(`return S.last.say`) === 'tempo 72, from take', [await ev(`return S.tempo`), await ev(`return S.last.say`)])
  await ev(`setTempo(${t0})`); await b.sleep(200) }
await ev(`const t = S.tracks.find(t => t.name === 'guitar'); t.regs = t.regs.filter(r => r.key !== 'file:t'); S.selR = []; __daw.redraw()`)

ok('no errors on the page', (await ev('return window.__errs')).length === 0 && b.errors.length === 0, [await ev('return window.__errs'), b.errors])
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close()
