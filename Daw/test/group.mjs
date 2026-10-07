// node test/group.mjs — what is edited as one: edit groups (tracks whose regions over the same stretch are chosen, cut, trimmed,
// faded and crossfaded together) and region groups (regions that are always chosen together)
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const regs = name => ev(`return S.tracks.find(t => t.name === ${JSON.stringify(name)}).regs.slice().sort((x, y) => x.a - y.a).map(r => [+r.a.toFixed(4), +r.b.toFixed(4), +(r.off || 0).toFixed(4)])`)
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y)
const at = (name, bar, fy = .5, dx = 0) => ev(`const i = S.tracks.findIndex(t => t.name === ${JSON.stringify(name)}), r = document.getElementById('board').getBoundingClientRect(); return { x: r.left + bx(${bar}) + ${dx}, y: r.top + rowY(i) + 1.5 + (S.rh - 3) * ${fy} }`)
const head = name => ev(`const i = S.tracks.findIndex(t => t.name === ${JSON.stringify(name)}), el = document.querySelector('[data-a="sel"][data-i="' + i + '"]').getBoundingClientRect(); return { x: el.left + 60, y: el.top + el.height / 2 }`)
const key = async (k, code, vk, mods) => { await b.press(k, code, vk, mods || 0); await b.sleep(60) }
const undo = () => key('z', 'KeyZ', 90, 4)
const chosenOn = name => ev(`const t = S.tracks.find(t => t.name === ${JSON.stringify(name)}); return t.regs.filter(r => S.selR.includes(r.id)).map(r => r.a).sort((x, y) => x - y)`)
const reg = (name, a) => `S.tracks.find(t => t.name === ${JSON.stringify(name)}).regs.find(x => Math.abs(x.a - ${a}) < 1e-6)`
const START = [[5, 13, 4], [17, 25, 16], [25, 33, 24], [33, 41, 32]]

await ev(`S.rh = 40; setZoom(24, 20); __daw.redraw()`)
// ── an edit group is made of the chosen tracks ──
{ const p = await head('kick'), q = await head('snare'); await b.click(p.x, p.y); await b.click(q.x, q.y, 8); await b.sleep(60) }
ok('two tracks chosen', await ev(`return chosen().map(t => t.name).join()`) === 'kick,snare')
await key('g', 'KeyG', 71, 6)
ok('control command g: they are a group, with a letter', await ev(`return S.tracks.find(t => t.name === 'kick').grp === 'a' && S.tracks.find(t => t.name === 'snare').grp === 'a' && !S.tracks.find(t => t.name === 'hats').grp`))
ok('the letter is said after each name on the track head', await ev(`const i = S.tracks.findIndex(t => t.name === 'kick'); return [...document.querySelectorAll('#hd-' + i + ' text')].map(x => x.textContent).includes('a') && ![...document.querySelectorAll('#hd-' + S.tracks.findIndex(t => t.name === 'hats') + ' text')].map(x => x.textContent).includes('a')`))
// ── choosing ── (the tracks were chosen by their heads, and their regions with them: first nothing is chosen)
await key('d', 'KeyD', 68, 8)
{ const p = await at('kick', 9); await b.click(p.x, p.y); await b.sleep(60) }
ok('a region pressed on one: the region over the same stretch on the other is chosen with it', same(await chosenOn('kick'), [5]) && same(await chosenOn('snare'), [5]) && (await ev('return S.selR.length')) === 2)
{ const p = await at('kick', 20); await b.click(p.x, p.y, 8); await b.sleep(60) }
ok('shift and another: both pairs', same(await chosenOn('kick'), [5, 17]) && same(await chosenOn('snare'), [5, 17]))
{ const p = await at('kick', 20); await b.click(p.x, p.y, 8); await b.sleep(60) }
ok('shift on it again: that pair is let go', same(await chosenOn('kick'), [5]) && same(await chosenOn('snare'), [5]))
await key('ArrowRight', 'ArrowRight', 39)
ok('the arrow goes to the next region, with its companion', same(await chosenOn('kick'), [17]) && same(await chosenOn('snare'), [17]))
// ── moved, trimmed, cut ──
{ const p = await at('kick', 9), q = await at('kick', 11); await b.dragTo(p.x, p.y, q.x, q.y, 8); await b.sleep(60) }
ok('one pulled two bars on: both go', same((await regs('kick'))[0], [7, 15, 4]) && same((await regs('snare'))[0], [7, 15, 4]), [await regs('kick'), await regs('snare')])
await undo()
{ const p = await at('kick', 13, .5, -2), q = await at('kick', 11); await b.dragTo(p.x, p.y, q.x, q.y, 8); await b.sleep(60) }
ok('an end pulled in on one: the same end on the other', same((await regs('kick'))[0], [5, 11, 4]) && same((await regs('snare'))[0], [5, 11, 4]), [await regs('kick'), await regs('snare')])
await undo()
{ const p = await at('snare', 5, .5, 2), q = await at('snare', 7); await b.dragTo(p.x, p.y, q.x, q.y, 8); await b.sleep(60) }
ok('a start pulled in on the other: the same on the first', same((await regs('kick'))[0], [7, 13, 6]) && same((await regs('snare'))[0], [7, 13, 6]), [await regs('kick'), await regs('snare')])
await undo()
await ev(`pickTool('scissors')`)
{ const p = await at('kick', 9); await b.click(p.x, p.y); await b.sleep(60) }
ok('one cut: both are cut at the same place', same((await regs('kick')).slice(0, 2), [[5, 9, 4], [9, 13, 8]]) && same((await regs('snare')).slice(0, 2), [[5, 9, 4], [9, 13, 8]]), [await regs('kick'), await regs('snare')])
await undo()
ok('one undo for both', same(await regs('kick'), START) && same(await regs('snare'), START))
// ── fades and crossfades ──
await ev(`pickTool('smart')`)
{ const p = await at('kick', 5, .08, 4); await b.dragTo(p.x, p.y, p.x + 30, p.y, 6); await b.sleep(60) }
ok('a fade pulled on one: the same fade on the other', await ev(`const a = ${reg('kick', 5)}.fi, c = ${reg('snare', 5)}.fi; return a > 0 && Math.abs(a - 30 / PXB) < 1e-6 && a === c`), await ev(`return [${reg('kick', 5)}.fi, ${reg('snare', 5)}.fi]`))
await undo()
{ const p = await at('kick', 25, .94, 0); await b.click(p.x, p.y); await b.sleep(60) }
ok('a join pressed at its foot on one: both are crossfaded there', await ev(`return ['kick', 'snare'].every(n => { const rs = S.tracks.find(t => t.name === n).regs.slice().sort((x, y) => x.a - y.a); return Math.abs(xfadeOf(rs[1], rs[2]) - .02 / SPB()) < 1e-9 })`))
{ const p = await at('kick', 25, .94, 0), q = await at('kick', 26, .94, 0); await b.dragTo(p.x, p.y, q.x, q.y, 8); await b.sleep(60) }
ok('the crossfade taken along a bar on one: on both', await ev(`return ['kick', 'snare'].every(n => { const rs = S.tracks.find(t => t.name === n).regs.slice().sort((x, y) => x.a - y.a); return Math.abs((rs[1].b + rs[2].a) / 2 - 26) < 1e-9 && Math.abs(xfadeOf(rs[1], rs[2]) - .02 / SPB()) < 1e-9 })`), [await regs('kick'), await regs('snare')])
await undo()
{ const p = await at('kick', 25, .94, 0); await b.click(p.x, p.y); await b.sleep(60) }
await key('Backspace', 'Backspace', 8)
ok('delete with it chosen: both are plain joins again', same(await regs('kick'), START) && same(await regs('snare'), START) && await ev(`return ['kick', 'snare'].every(n => S.tracks.find(t => t.name === n).regs.every(r => !r.fi && !r.fo))`))
await undo(); await undo()
// ── a stretch of time ──
{ const p = await at('kick', 19, .3), q = await at('kick', 21, .3); await b.dragTo(p.x, p.y, q.x, q.y, 8); await b.sleep(60) }
ok('a stretch picked on one lies on the other too, and is drawn there', await ev(`const sn = S.tracks.find(t => t.name === 'snare'); return !!S.marq && S.marq.a === 18 && S.marq.b === 20 && S.marq.also.includes(sn.id) && marqTracks().map(t => t.name).sort().join() === 'kick,snare'`), await ev('return S.marq'))
ok('two boxes are drawn', await ev(`return document.querySelectorAll('#ln-over rect').length`) === 2 || await ev(`return rows().indexOf(S.tracks.findIndex(t => t.name === 'snare')) - rows().indexOf(S.tracks.findIndex(t => t.name === 'kick'))`) === 1, await ev(`return document.querySelectorAll('#ln-over rect').length`))
await key('Backspace', 'Backspace', 8)
ok('delete: the stretch is gone from both', same((await regs('kick')).slice(1, 3), [[17, 19, 16], [21, 25, 20]]) && same((await regs('snare')).slice(1, 3), [[17, 19, 16], [21, 25, 20]]), [await regs('kick'), await regs('snare')])
await undo()
// ── let go of for a while ──
await ev(`pickTool('pointer')`)
await key('g', 'KeyG', 71, 8)
ok('shift g: the groups are let go of', await ev(`return S.grpOff === true && S.last.say === 'groups off'`))
{ const p = await at('kick', 9); await b.click(p.x, p.y); await b.sleep(60) }
ok('now a press chooses only what is pressed', same(await chosenOn('kick'), [5]) && same(await chosenOn('snare'), []))
await key('g', 'KeyG', 71, 8)
ok('shift g again: taken up again', await ev(`return S.grpOff === false`))
// ── leaving, taking apart ──
{ const p = await head('kick'); await b.click(p.x, p.y); await b.sleep(40) }
await key('g', 'KeyG', 71, 6)
ok('one track of a group of two leaves: there is no group left', await ev(`return S.tracks.every(t => !t.grp)`))
await undo()
ok('undo: the group is back', await ev(`return S.tracks.find(t => t.name === 'kick').grp === 'a' && S.tracks.find(t => t.name === 'snare').grp === 'a'`))
{ const p = await head('hats'), q = await head('bass'); await b.click(p.x, p.y); await b.click(q.x, q.y, 4); await b.sleep(60) }
await key('g', 'KeyG', 71, 6)
ok('another two: the next letter', await ev(`return S.tracks.find(t => t.name === 'hats').grp === 'b' && S.tracks.find(t => t.name === 'bass').grp === 'b'`), await ev(`return S.tracks.map(t => t.grp || '-').join('')`))
await key('g', 'KeyG', 71, 6)
ok('the same two again: taken apart', await ev(`return !S.tracks.find(t => t.name === 'hats').grp && !S.tracks.find(t => t.name === 'bass').grp && S.tracks.find(t => t.name === 'kick').grp === 'a'`))
ok('written with the project', await ev(`const j = JSON.parse(serialize()); return j.tracks.find(t => t.name === 'kick').grp === 'a' && !j.tracks.find(t => t.name === 'hats').grp`))
{ const p = await head('kick'), q = await head('snare'); await b.click(p.x, p.y); await b.click(q.x, q.y, 8); await key('g', 'KeyG', 71, 6) }
ok('and the first group taken apart', await ev(`return S.tracks.every(t => !t.grp)`))

// ── region groups ──
await ev(`S.selR = [${reg('kick', 5)}.id, ${reg('hats', 13)}.id]; S.focus = 'lanes'; __daw.redraw()`)
await key('g', 'KeyG', 71, 5)
ok('option command g: the chosen regions are a group', await ev(`const a = ${reg('kick', 5)}.grp, c = ${reg('hats', 13)}.grp; return a > 0 && a === c`))
await ev(`S.selR = []; __daw.redraw()`)
{ const p = await at('hats', 15); await b.click(p.x, p.y); await b.sleep(60) }
ok('one of them pressed: both are chosen', same(await chosenOn('kick'), [5]) && same(await chosenOn('hats'), [13]))
{ const p = await at('hats', 15), q = await at('hats', 16); await b.dragTo(p.x, p.y, q.x, q.y, 8); await b.sleep(60) }
ok('one pulled a bar on: both go', same((await regs('kick'))[0], [6, 14, 4]) && same((await regs('hats'))[0], [14, 18, 12]), [await regs('kick'), await regs('hats')])
await undo()
await key('r', 'KeyR', 82, 4)
ok('repeated: the copies are a group of their own', await ev(`const k = S.tracks.find(t => t.name === 'kick').regs, h = S.tracks.find(t => t.name === 'hats').regs, g0 = ${reg('kick', 5)}.grp; const copies = k.concat(h).filter(r => S.selR.includes(r.id)); return copies.length === 2 && copies[0].grp === copies[1].grp && copies[0].grp !== g0 && copies[0].grp > 0`), await ev(`return S.tracks.flatMap(t => t.regs).filter(r => r.grp).map(r => [r.a, r.grp])`))
await undo()
await ev(`S.selR = [${reg('kick', 5)}.id]; __daw.redraw()`)
await key('u', 'KeyU', 85, 5)
ok('option command u with one of them chosen: the group is taken apart', await ev(`return S.tracks.every(t => t.regs.every(r => !r.grp))`))
await undo()
ok('written with the project', await ev(`const j = JSON.parse(serialize()); return j.tracks.find(t => t.name === 'kick').regs.some(r => r.grp > 0)`))
await undo()
ok('undone: no groups', await ev(`return S.tracks.every(t => t.regs.every(r => !r.grp))`))

// ── stretched as one: two microphones on one kit keep in step ──
await ev(`
  const g = S.tracks.find(t => t.name === 'guitar'), h = S.tracks.find(t => t.name === 'hum'); g.theirs = null; h.theirs = null; g.regs = []; h.regs = []
  window.__M1 = mkReg({ a: 1, b: 5, key: 'file:m1', loop: false, rate: 1, sec: 4 * SPB(), srcBars: 4, off: 0 }); window.__M2 = mkReg({ a: 1, b: 5, key: 'file:m2', loop: false, rate: 1, sec: 4 * SPB(), srcBars: 4, off: 0 })
  g.regs.push(__M1); h.regs.push(__M2); g.grp = h.grp = 'k'
  const q = SPB() / 16                                                                           // a sixteenth, in seconds
  TRANS.set('file:m1', [1.1 * q, 4.2 * q, 7.9 * q, 12.15 * q]); TRANS.set('file:m2', [1.1 * q + .004, 4.2 * q + .006, 10.2 * q])      // the second microphone hears the same hits a little later, and one hit of its own
  S.q = 1 / 16; S.selR = [__M1.id]; S.focus = 'lanes'; __daw.redraw()`)
await ev(`await quantize([__M1])`); await b.sleep(80)
ok('quantize on one of a group: both are given the very same pins', await ev(`return __M1.flex.length > 0 && JSON.stringify(__M1.flex) === JSON.stringify(__M2.flex) && __M1.flex !== __M2.flex`), await ev(`return [__M1.flex, __M2.flex]`))
ok('the pins come from what either microphone heard, the earlier hearing counting', await ev(`const q = SPB() / 16, ss = __M1.flex.map(m => +(m.s / q).toFixed(2)); return JSON.stringify(ss) === JSON.stringify([1.1, 4.2, 7.9, 10.2, 12.15])`), await ev(`const q = SPB() / 16; return __M1.flex.map(m => [+(m.s / q).toFixed(2), +(m.d / q).toFixed(2)])`))
ok('each pulled to the nearest sixteenth', await ev(`const q = SPB() / 16; return JSON.stringify(__M1.flex.map(m => +(m.d / q).toFixed(4))) === JSON.stringify([1, 4, 8, 10, 12])`))
await undo()
ok('undone on both', await ev(`const a = regOf(__M1.id)[0], c = regOf(__M2.id)[0]; return !(a.flex || []).length && !(c.flex || []).length`))
await ev(`S.grpOff = true; await quantize([regOf(__M1.id)[0]]); S.grpOff = false`); await b.sleep(80)
ok('with the groups let go of, only the one is pulled, by its own beginnings', await ev(`const a = regOf(__M1.id)[0], c = regOf(__M2.id)[0], q = SPB() / 16; return a.flex.length === 4 && !(c.flex || []).length`))
await undo()
await ev(`for (const n of ['guitar', 'hum']) { const t = S.tracks.find(t => t.name === n); t.regs = []; t.grp = null } S.selR = []; __daw.redraw()`)

ok('no errors on the page', (await ev('return window.__errs')).length === 0 && b.errors.length === 0, [await ev('return window.__errs'), b.errors])
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close()
