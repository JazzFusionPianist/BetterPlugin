// node test/basics.mjs — the plain things a hand expects: several tracks chosen at once, the delete key going by what was
// taken hold of last, the playhead and the cycle each with their own place on the bars, play from where the cycle begins,
// a region taken to the playhead, the nudge and where it is said, option + press putting a thing back, the new-track list
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const ALT = 1, CTRL = 2, CMD = 4, SHIFT = 8
const at = async (sel, fx = .5, fy = .5) => ev(`const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; const r = el.getBoundingClientRect(), x = r.left + r.width * ${fx}, y = r.top + r.height * ${fy}, top = document.elementFromPoint(x, y); return { x, y, w: r.width, h: r.height, l: r.left, t: r.top, hit: top === el, top: top ? (top.dataset && top.dataset.a) || top.tagName : null }`)
const click = async (sel, mods = 0, fx = .5, fy = .5) => { const p = await at(sel, fx, fy); if (!p) { bad.push('missing ' + sel); out.push('FAIL missing ' + sel); return null } if (!p.hit) { bad.push('covered ' + sel); out.push(`FAIL covered ${sel} by ${p.top}`) } await b.click(p.x, p.y, mods); await b.sleep(40); return p }
const dbl = async (sel, fx = .5, fy = .5) => { const p = await at(sel, fx, fy); if (!p) { bad.push('missing ' + sel); return } for (const n of [1, 2]) { await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', buttons: 1, clickCount: n }); await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: n }) } await b.sleep(40) }
const drag = async (sel, dx, dy, mods = 0, fx = .5, fy = .5) => { const p = await at(sel, fx, fy); if (!p) { bad.push('missing ' + sel); out.push('FAIL missing ' + sel); return } if (!p.hit) { bad.push('covered ' + sel); out.push(`FAIL covered ${sel} by ${p.top}`) } await b.dragTo(p.x, p.y, p.x + dx, p.y + dy, 8, mods); await b.sleep(50) }
const key = async (k, code, vk, mods = 0) => { await b.press(k, code, vk, mods); await b.sleep(50) }
const del = () => key('Backspace', 'Backspace', 8)
const undo = () => key('z', 'KeyZ', 90, CMD)
const names = () => ev(`return chosen().map(t => t.name)`)
const tracks = () => ev(`return S.tracks.map(t => t.name)`)
const regsOf = name => ev(`return S.tracks.find(t => t.name === ${JSON.stringify(name)}).regs.slice().sort((x, y) => x.a - y.a).map(r => [+r.a.toFixed(4), +r.b.toFixed(4)])`)
const pick = async label => { const i = await ev(`return S.menu ? S.menu.items.findIndex(it => it.t === ${JSON.stringify(label)}) : -1`); if (i < 0) { bad.push('menu item ' + label); out.push('FAIL menu item ' + label); return } await click(`[data-a="pick"][data-i="${i}"]`) }
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y)
const pxb = await ev(`return PXB`)

// ── several tracks chosen at once ──
await click('[data-a="sel"][data-i="1"]')
ok('a head pressed: the track is chosen, and what is on it with it', same(await names(), ['snare']) && await ev(`return S.sel === 1 && S.focus === 'tracks' && S.selR.length === 4 && S.selR.every(id => regOf(id)[1].name === 'snare')`), await ev('return [S.sel, S.focus, S.selR.length]'))
await click('[data-a="sel"][data-i="4"]', SHIFT)
ok('shift and a press: every track from that one to this one', same(await names(), ['snare', 'hats', 'bass', 'keys']) && await ev(`return S.sel === 4 && S.selR.length === 15`), [await names(), await ev('return S.selR.length')])
await click('[data-a="sel"][data-i="2"]', CMD)
ok('command and a press on a chosen one: it is let go of', same(await names(), ['snare', 'bass', 'keys']), await names())
await click('[data-a="sel"][data-i="6"]', CMD)
ok('command and a press on another: it is one more', same(await names(), ['snare', 'bass', 'keys', 'hum']) && await ev('return S.sel === 6'), await names())
ok('each of them is shown chosen, on its head and along its lane', await ev(`flush(); const band = g => [...document.querySelectorAll(g + ' rect')].filter(r => r.getAttribute('fill') === INK && +r.getAttribute('fill-opacity') < .1 && +r.getAttribute('height') === S.rh).length; return band('#g-head') === 4 && band('#g-lanes') === 4`))
ok('the bar names them', (await ev(`flush(); return document.getElementById('g-info').textContent`)).includes('tracks4'), await ev(`return document.getElementById('g-info').textContent.slice(0, 120)`))
await key('m', 'KeyM', 77); ok('m: every chosen track is muted, and no other', same(await ev(`return S.tracks.filter(t => t.mute).map(t => t.name)`), ['snare', 'bass', 'keys', 'hum']))
await key('m', 'KeyM', 77); ok('m again: all of them open', await ev(`return !S.tracks.some(t => t.mute)`))
await click('[data-a="solo"][data-i="3"]'); ok('s pressed on one of them: all of them', same(await ev(`return S.tracks.filter(t => t.solo).map(t => t.name)`), ['snare', 'bass', 'keys', 'hum']))
await b.sleep(450); await click('[data-a="solo"][data-i="3"]'); ok('and off again, all of them', await ev(`return !S.tracks.some(t => t.solo)`))
{ const v0 = await ev(`return S.tracks.map(t => t.vol)`); await drag('[data-a="vol"][data-i="3"]', -6, 0)
  const v1 = await ev(`return S.tracks.map(t => t.vol)`), d = v1.map((v, i) => +(v - v0[i]).toFixed(1))
  ok('a fader of one of them pulled: the others go by as many db, the rest stay', d[3] < 0 && d[1] === d[3] && d[4] === d[3] && d[6] === d[3] && d[0] === 0 && d[2] === 0 && d[5] === 0 && d[7] === 0, d)
  await ev(`const v = ${JSON.stringify(v0)}; S.tracks.forEach((t, i) => { t.vol = v[i] }); applyAll(); __daw.redraw()`) }
await b.sleep(450); await click('[data-a="sel"][data-i="3"]')
ok('one of several pressed plainly and let go: it alone is chosen', same(await names(), ['bass']), await names())
await key('ArrowDown', 'ArrowDown', 40, SHIFT); await key('ArrowDown', 'ArrowDown', 40, SHIFT)
ok('shift and the arrow: the rows passed over are chosen too', same(await names(), ['bass', 'keys', 'guitar']) && await ev('return S.sel === 5'), await names())
await key('ArrowUp', 'ArrowUp', 38, SHIFT); ok('and back: one fewer', same(await names(), ['bass', 'keys']), await names())
await key('ArrowUp', 'ArrowUp', 38); ok('the arrow alone: one track', same(await names(), ['bass']), await names())
// two taken together and pulled to the top
await click('[data-a="sel"][data-i="5"]'); await click('[data-a="sel"][data-i="6"]', CMD)
{ const p = await at('[data-a="sel"][data-i="5"]'); await b.dragTo(p.x, p.y, p.x, p.y - 5 * 25 - 14, 8); await b.sleep(60) }
ok('two taken together and pulled to the top: both go, in their order', same((await tracks()).slice(0, 4), ['guitar', 'hum', 'kick', 'snare']) && same(await names(), ['guitar', 'hum']), await tracks())
await undo(); ok('undo puts them back', same(await tracks(), ['kick', 'snare', 'hats', 'bass', 'keys', 'guitar', 'hum', 'air']), await tracks())
// in the mixer
await key('x', 'KeyX', 88); await b.sleep(260)
await click('[data-a="msel"][data-i="0"]'); await click('[data-a="msel"][data-i="2"]', SHIFT)
ok('in the mixer too: shift and a press on a strip’s name', same(await names(), ['kick', 'snare', 'hats']), await names())
ok('and each chosen strip is shown chosen: its number on ink', await ev(`flush(); const on = [...document.querySelectorAll('#g-dock text')].filter(t => t.getAttribute('fill') === K1 && /^0[0-9]$/.test(t.textContent)).map(t => t.textContent); return ['01', '02', '03'].every(k => on.includes(k)) && on.length === 3`))      // (the mixer of the transport panel, the room's one mixer: mixpanel.js)
// the mixer's words can be read
{ const sizes = await ev(`flush(); return [...new Set([...document.querySelectorAll('#g-dock text')].map(t => +t.getAttribute('font-size')))].sort((x, y) => x - y)`)
  ok('no word in the mixer is set under 8.5', sizes[0] >= 8.5, sizes) }
await key('x', 'KeyX', 88); await b.sleep(260)
await key('Escape', 'Escape', 27); ok('escape: nothing chosen but the one track', same(await names(), ['hats']) && await ev(`return S.selR.length === 0 && S.focus === 'lanes'`), await names())

// ── the delete key goes by what was taken hold of last ──
const kick0 = await regsOf('kick')
{ const p = await ev(`const r = S.tracks[0].regs[0], bd = document.getElementById('board').getBoundingClientRect(); return { x: bd.left + bx(r.a) + 30, y: bd.top + rowY(0) + S.rh / 2, id: r.id }`)
  await b.click(p.x, p.y); await b.sleep(40)
  ok('a region pressed: it is what is chosen', await ev(`return S.selR.length === 1 && S.selR[0] === ${p.id} && S.focus === 'lanes'`)) }
await click('[data-a="scene"][data-i="2"]')
ok('a marker pressed: it is the one the delete key is about (the region stays chosen)', await ev(`return S.focus === 'marker' && S.selM === 13 && S.selR.length === 1 && S.pos === 12`), await ev('return [S.focus, S.selM, S.selR.length, S.pos]'))
ok('and it is marked', await ev(`flush(); return [...document.querySelectorAll('#g-scenes rect')].some(r => r.getAttribute('stroke') === K1)`))
await del()
ok('delete: the marker is gone, the region is not', await ev(`return SCENES.length === 6 && !SCENES.some(s => s.name === 'pre')`) && same(await regsOf('kick'), kick0), await ev('return SCENES.map(s => s.name)'))
await undo(); ok('undo brings the marker back', await ev(`return SCENES.length === 7 && SCENES[2].name === 'pre' && SCENES[2].a === 13`))
await b.sleep(450); await click('[data-a="sel"][data-i="2"]')
await del(); ok('a track chosen, delete: what is on it goes, the track stays', same(await regsOf('hats'), []) && (await tracks()).length === 8, [await regsOf('hats'), (await tracks()).length])
await del(); ok('delete again, with nothing on it: the track goes', same(await tracks(), ['kick', 'snare', 'bass', 'keys', 'guitar', 'hum', 'air']), await tracks())
{ const n = await ev(`return S.tracks.reduce((a, t) => a + t.regs.length, 0)`); await del(); await del()
  ok('and no further: the track that moved up is left alone', (await tracks()).length === 7 && await ev(`return S.tracks.reduce((a, t) => a + t.regs.length, 0) === ${n}`), await tracks()) }
await undo(); ok('undo: the track is back, empty', same(await tracks(), ['kick', 'snare', 'hats', 'bass', 'keys', 'guitar', 'hum', 'air']) && same(await regsOf('hats'), []), await tracks())
await undo(); ok('undo again: and what was on it', same(await regsOf('hats'), [[13, 17], [17, 25], [33, 41]]), await regsOf('hats'))
await click('[data-a="sel"][data-i="0"]'); await click('[data-a="sel"][data-i="1"]', SHIFT)
await del(); ok('two tracks chosen, delete: both are emptied', same(await regsOf('kick'), []) && same(await regsOf('snare'), []) && (await tracks()).length === 8)
await del(); ok('again: both go', same(await tracks(), ['hats', 'bass', 'keys', 'guitar', 'hum', 'air']), await tracks())
await undo(); await undo(); ok('two undos: as it was', same(await tracks(), ['kick', 'snare', 'hats', 'bass', 'keys', 'guitar', 'hum', 'air']) && same(await regsOf('kick'), kick0), await tracks())
await b.sleep(450); await click('[data-a="sel"][data-i="7"]'); await key('Backspace', 'Backspace', 8, CMD)
ok('command delete: the track at once, with what is on it', same(await tracks(), ['kick', 'snare', 'hats', 'bass', 'keys', 'guitar', 'hum']), await tracks()); await undo()
ok('a song keeps one track', await ev(`const keep = S.tracks.slice(); const n = await deleteTracks(S.tracks.slice()); const left = S.tracks.length; undoEdit(); return left === 1 && n === keep.length - 1 && S.tracks.length === keep.length`))
await key('Escape', 'Escape', 27)

// ── the bars: the cycle above, the playhead below ──
await ev(`S.cycle = { on: false, a: 16, b: 24 }; S.pos = 8; __daw.redraw()`)
{ const g = await ev(`const r = s => { const e = document.querySelector(s).getBoundingClientRect(); return [e.left, e.top, e.right, e.bottom] }; const head = document.querySelector('#ph path:nth-of-type(2)').getBoundingClientRect(); return { strip: r('[data-a="cycle"][data-m="new"]'), seek: r('[data-a="seek"]'), take: r('[data-a="playhead"]'), head: [head.left, head.top, head.right, head.bottom] }`)
  ok('the playhead’s head stands under the cycle’s strip, not on it', g.head[1] >= g.strip[3] - .5 && g.take[1] >= g.strip[3] - .5 && g.take[2] - g.take[0] >= 20 && g.seek[3] - g.seek[1] >= 14, g) }
{ const p = await at('[data-a="playhead"]'); ok('nothing lies over the place it is taken by', p.hit, p)
  await b.dragTo(p.x, p.y, p.x + 4 * pxb, p.y, 8); await b.sleep(50)
  ok('taken by its head and pulled four bars on: the playhead goes, the cycle is left as it was', await ev(`return Math.abs(S.pos - 12) < 1e-9 && !S.cycle.on && S.cycle.a === 16 && S.cycle.b === 24`), await ev('return [S.pos, S.cycle]'))
  const q = await at('[data-a="playhead"]', .8); await b.click(q.x, q.y); await b.sleep(40)
  ok('pressed beside its middle and let go: it stays where it is', await ev(`return Math.abs(S.pos - 12) < 1e-9`), await ev('return S.pos')) }
await click('[data-a="seek"]', 0, .25); ok('a press on the lower part of the bars moves the playhead there', await ev(`return Math.abs(S.pos - Math.round(barAt(X0 + (X1 - X0) * .25) / gridStep(true)) * gridStep(true)) < 1e-9`), await ev('return S.pos'))
{ const p0 = await ev('return S.pos'); await b.sleep(450); await dbl('[data-a="seek"]', .25); await b.sleep(200)
  ok('twice on the bars: the song plays from there', await ev(`return S.playing && curPos() >= ${p0} - .05 && curPos() < ${p0} + 1`), await ev('return [S.playing, curPos()]'))
  await b.sleep(450); await dbl('[data-a="seek"]', .25); ok('twice again: it stops', await ev('return !S.playing')) }
await ev(`S.cycle = { on: false, a: 0, b: 0 }; __daw.redraw()`)
{ const bd = await ev(`const r = document.getElementById('board').getBoundingClientRect(); return { x: r.left, y: r.top + RU_Y + 4 }`)
  const X = bar => ev(`return ${bd.x} + bx(${bar})`)
  await b.dragTo(await X(9), bd.y, await X(17), bd.y, 8); await b.sleep(50)
  ok('a pull along the top of the bars draws the cycle, and turns it on', await ev(`return S.cycle.on && S.cycle.a === 8 && S.cycle.b === 16`), await ev('return S.cycle'))
  await drag('[data-a="cycle"][data-m="b"]', 4 * pxb, 0); ok('its end taken and pulled: that end moves, the other stays', await ev(`return S.cycle.a === 8 && S.cycle.b === 20`), await ev('return S.cycle'))
  await drag('[data-a="cycle"][data-m="a"]', -4 * pxb, 0); ok('and its start', await ev(`return S.cycle.a === 4 && S.cycle.b === 20`), await ev('return S.cycle'))
  await drag('[data-a="cycle"][data-m="move"]', 8 * pxb, 0); ok('taken by its middle: it moves as it is', await ev(`return S.cycle.a === 12 && S.cycle.b === 28 && S.cycle.on`), await ev('return S.cycle'))
  await click('[data-a="cycle"][data-m="move"]'); ok('a press on it that pulls nothing turns it off', await ev(`return !S.cycle.on && S.cycle.a === 12 && S.cycle.b === 28`), await ev('return S.cycle'))
  await b.sleep(450); await click('[data-a="cycle"][data-m="move"]'); ok('and on again', await ev('return S.cycle.on')) }

// ── play: with the cycle on, from where the cycle begins ──
await ev(`halt(false); S.cycle = { on: true, a: 8, b: 12 }; S.pos = 2; pushTransport(); __daw.redraw()`)
await key(' ', 'Space', 32); await b.sleep(250)
ok('with the cycle on, play starts where the cycle begins', await ev(`return S.playing && curPos() >= 7.95 && curPos() < 8.6`), await ev('return [S.playing, curPos()]'))
await key(' ', 'Space', 32); await ev(`S.pos = 30`); await key(' ', 'Space', 32); await b.sleep(200)
ok('each time', await ev(`return curPos() >= 7.95 && curPos() < 8.6`), await ev('return curPos()')); await key(' ', 'Space', 32)
await ev(`S.cycle.on = false; S.pos = 2`); await key(' ', 'Space', 32); await b.sleep(200)
ok('with the cycle off, from the playhead', await ev(`return curPos() >= 1.95 && curPos() < 2.6`), await ev('return curPos()')); await key(' ', 'Space', 32)
await ev(`S.cycle.on = true; S.pos = 3`); await click('[data-a="stop"]'); ok('stop, with the song stopped: back to where the cycle begins', await ev('return S.pos === 8'), await ev('return S.pos'))
await b.sleep(450); await click('[data-a="stop"]'); ok('and again: to the start', await ev('return S.pos === 0'), await ev('return S.pos'))
await ev(`S.cycle = { on: false, a: 16, b: 24 }; __daw.redraw()`)

// ── a region taken to the playhead ──
await ev(`const t = S.tracks.find(t => t.name === 'snare'); S.selR = t.regs.filter(r => r.a === 17 || r.a === 25).map(r => r.id); S.focus = 'lanes'; S.pos = 2; __daw.redraw()`)
await key(';', 'Semicolon', 186)
ok('; — what is chosen begins at the playhead, and keeps its places to itself; what was under it gives way', same(await regsOf('snare'), [[3, 11], [11, 19], [33, 41]]), await regsOf('snare'))
await undo(); ok('undo', same(await regsOf('snare'), [[5, 13], [17, 25], [25, 33], [33, 41]]), await regsOf('snare'))
await ev(`const t = S.tracks.find(t => t.name === 'snare'); S.selR = [t.regs.find(r => r.a === 17).id]; S.pos = 14`)
await key(';', 'Semicolon', 186, SHIFT)
ok('shift ; — it goes there, and the one after it is chosen in its place', same(await regsOf('snare'), [[5, 13], [15, 23], [25, 33], [33, 41]]) && await ev(`return S.selR.length === 1 && regOf(S.selR[0])[0].a === 25`), [await regsOf('snare'), await ev('return S.selR.map(id => regOf(id)[0].a)')])
await undo()

// ── the nudge: said in the control bar, changed there or by key ──
ok('the control bar says how far a nudge goes', await ev(`flush(); const t = document.getElementById('g-top').textContent; return t.includes('nudge') && t.includes('beat') && !!document.querySelector('#g-top [data-a="nudge"]')`))
await click('[data-a="nudge"]')
ok('pressed: the list of them, each with its key', await ev(`return !!S.menu && S.menu.items.map(i => i.t).join() === NUDGES.join() && S.menu.items.every(i => i.k) && S.menu.items.find(i => i.on).t === 'beat'`), await ev('return S.menu && S.menu.items.map(i => [i.t, i.k])'))
await pick('1/16'); ok('picked: a sixteenth', await ev(`flush(); return S.nudge === '1/16' && document.getElementById('g-top').textContent.includes('1/16')`))
await key('0', 'Digit0', 48, CTRL | ALT); ok('control option 0: ten thousandths of a second', await ev(`return S.nudge === '10 ms'`), await ev('return S.nudge'))
await ev(`const t = S.tracks.find(t => t.name === 'hats'); S.selR = [t.regs.find(r => r.a === 13).id]; S.focus = 'lanes'`)
await key('ArrowRight', 'ArrowRight', 39, ALT)
ok('nudged by it: the region is ten thousandths of a second later, whatever the tempo', await ev(`const r = S.tracks.find(t => t.name === 'hats').regs.slice().sort((x, y) => x.a - y.a)[0]; return Math.abs((r.a - 13) * SPB() - .01) < 1e-9 && Math.abs((r.b - r.a) - 4) < 1e-9`))
await undo()
await key('ArrowRight', 'ArrowRight', 39, ALT | SHIFT)
ok('option shift arrow: its end is nudged, its start is not', await ev(`const r = S.tracks.find(t => t.name === 'hats').regs.slice().sort((x, y) => x.a - y.a)[0]; return r.a === 13 && Math.abs((r.b - 17) * SPB() - .01) < 1e-9`), await regsOf('hats'))
await undo()
await key('1', 'Digit1', 49, CTRL | ALT); const ms1 = await ev('return S.nudge'); await key('s', 'KeyS', 83, CTRL | ALT); const smp = await ev('return [S.nudge, nudgeBars() * SPB() * SND_SR]')
await key('q', 'KeyQ', 81, ALT | SHIFT); const tick = await ev('return [S.nudge, nudgeBars() * 3840]'); await key('b', 'KeyB', 66, ALT | SHIFT)
ok('each has its key', ms1 === '1 ms' && smp[0] === 'sample' && Math.abs(smp[1] - 1) < 1e-9 && tick[0] === 'tick' && Math.abs(tick[1] - 1) < 1e-9 && await ev(`return S.nudge === 'beat'`), [ms1, smp, tick])
ok('and the sheet of keys lists them', await ev(`const g = SHEET.flat().find(x => x[0] === 'nudge'); return !!g && ['⌥⇧m', '⌥⇧b', '⌥⇧s', '⌥⇧t', '⌥⇧q', '⌃⌥0', '⌃⌥1', '⌃⌥s'].every(k => g[1].some(r => r[1] === k))`))
await key('Escape', 'Escape', 27)

// ── option and a press: back to where it starts ──
await ev(`S.tracks[1].vol = -9; applyAll(); __daw.redraw()`)
await click('[data-a="vol"][data-i="1"]', ALT); ok('a head’s fader: 0 db', await ev('return S.tracks[1].vol === 0'), await ev('return S.tracks[1].vol'))
await ev(`S.tracks[1].vol = -5; S.sel = 5; S.selT = []; applyAll()`); await key('b', 'KeyB', 66); await b.sleep(260)
await ev(`S.tracks[5].vol = -11; S.tracks[5].pan = .5; applyAll(); __daw.redraw()`)
await click('[data-a="mvol"][data-i="5"]', ALT); ok('a strip’s fader: 0 db', await ev('return S.tracks[5].vol === 0'), await ev('return S.tracks[5].vol'))
await click('[data-a="mpan"][data-i="5"]', ALT); ok('a pan: the middle', await ev('return S.tracks[5].pan === 0'), await ev('return S.tracks[5].pan'))
await ev(`const bus = newTrack('bus', null, true); setSend(S.tracks[5], 0, bus.id); S.tracks[5].sends[0].db = -18; __daw.redraw()`)
await click('[data-a="msend"][data-i="5"][data-k="0"]', ALT); ok('a send: 0 db, and its list does not open', await ev('return S.tracks[5].sends[0].db === 0 && !S.menu'), await ev('return [S.tracks[5].sends[0].db, !!S.menu]'))
await ev(`S.master = -7; pushMaster(); __daw.redraw()`); await click('[data-a="mmaster"]', ALT); ok('the out’s fader: 0 db', await ev('return S.master === 0'))
await ev(`S.master = -7; pushMaster(); __daw.redraw()`); await click('[data-a="master"]', ALT); ok('the out in the control bar: 0 db', await ev('return S.master === 0')); await ev(`S.master = -4.2; pushMaster()`)
await ev(`const t = S.tracks[5]; setPrint(t, 'tape', 70); touchPatch(t); __daw.redraw()`)
await click('#g-dock [data-a="wall"][data-k="node"]', ALT); ok('a print: the amount it comes on with', await ev('return Math.round(S.tracks[5].patch.A.tape) === 24'), await ev('return S.tracks[5].patch.A.tape'))
await ev(`const t = S.tracks[5]; setPrint(t, 'tape', 0); touchPatch(t); S.tracks[5].vol = -5`); await undo(); await undo(); await key('b', 'KeyB', 66); await b.sleep(260)
await ev(`const r = S.tracks[0].regs[0]; r.gain = -6; r.tr = 3; S.selR = [r.id]; S.focus = 'lanes'; __daw.redraw()`)
await click('[data-a="rgain"]', ALT); ok('a region’s gain: none', await ev('return (S.tracks[0].regs[0].gain || 0) === 0'), await ev('return S.tracks[0].regs[0].gain'))
await click('[data-a="rtr"]', ALT); ok('its pitch: as it was', await ev('return (S.tracks[0].regs[0].tr || 0) === 0'), await ev('return S.tracks[0].regs[0].tr'))
await ev(`setZoom(60, 10)`); await click('[data-a="zoomx"]', ALT); ok('the zoom: all of the song', await ev('return Math.abs(PXB - fitPXB()) < .01'))
// finely, with shift
{ await key('x', 'KeyX', 88); await b.sleep(260)
  const v0 = await ev('return S.tracks[3].vol'); await drag('[data-a="mvol"][data-i="3"]', 0, -30); const coarse = (await ev('return S.tracks[3].vol')) - v0
  await ev(`S.tracks[3].vol = ${v0}; applyAll(); __daw.redraw()`); await drag('[data-a="mvol"][data-i="3"]', 0, -30, SHIFT); const fineD = (await ev('return S.tracks[3].vol')) - v0
  ok('with shift a pull moves a fader a fifth as far', coarse > 0 && fineD > 0 && Math.abs(fineD / coarse - .2) < .08, [coarse, fineD])
  await ev(`S.tracks[3].vol = ${v0}; applyAll()`); await key('x', 'KeyX', 88); await b.sleep(260) }
// option on an s: this one alone
await ev(`S.tracks[0].solo = true; S.tracks[1].solo = true; applyAll(); __daw.redraw()`)
await click('[data-a="solo"][data-i="4"]', ALT); ok('option and s: this one alone in solo', same(await ev(`return S.tracks.filter(t => t.solo).map(t => t.name)`), ['keys']))
await b.sleep(450); await click('[data-a="solo"][data-i="4"]', ALT); ok('again: no solo at all', await ev('return !S.tracks.some(t => t.solo)'))
// the hand going on across the rows
{ const p = await at('[data-a="mute"][data-i="1"]'), q = await at('[data-a="mute"][data-i="4"]'); await b.dragTo(p.x, p.y, q.x, q.y, 10); await b.sleep(50)
  ok('pressed on an m and pulled down the rows: each row passed is muted', same(await ev(`return S.tracks.filter(t => t.mute).map(t => t.name)`), ['snare', 'hats', 'bass', 'keys']), await ev(`return S.tracks.filter(t => t.mute).map(t => t.name)`))
  await ev(`for (const t of S.tracks) t.mute = false; applyAll(); __daw.redraw()`) }

// ── a new track: what kind, what it listens to, where it plays, how many ──
await click('[data-a="sel"][data-i="1"]')
await key('n', 'KeyN', 78, ALT | CMD)
ok('option command n: the new-track list', await ev(`flush(); return !!S.newT && S.newT.kind === 'audio' && S.newT.n === 1 && document.getElementById('g-new').textContent.startsWith('new track')`), await ev('return S.newT'))
await click('[data-a="new-kind"][data-v="midi"]'); ok('kind: midi — a track of notes, which says the instrument that plays it instead of what it listens to', await ev(`flush(); return S.newT.kind === 'midi' && S.newT.inst.kind === 'synth' && !!document.querySelector('[data-a="new-voice"]') && !document.querySelector('[data-a="new-in"]') && document.getElementById('g-new').textContent.includes('instrument')`), await ev('return S.newT'))
await click('[data-a="new-voice"]'); await b.sleep(80); ok('its key opens the list of instruments, beside the new-track list', await ev(`return !document.getElementById('picker').hidden && S.picker.what === 'new' && !!S.newT && document.querySelectorAll('.pk-row').length >= 16`), await ev(`return [document.getElementById('picker').hidden, S.picker.what, document.querySelectorAll('.pk-row').length]`))
await ev(`document.querySelector('.pk-row[data-print="kit"]').click()`); ok('picked there: the kit — the list goes, the new-track list stays and names it', await ev(`flush(); return !!S.newT && S.newT.inst.kind === 'drums' && document.getElementById('picker').hidden && document.getElementById('g-new').textContent.includes('kit')`), await ev('return S.newT'))
await click('[data-a="new-voice"]'); await b.sleep(80); await ev(`document.querySelector('.pk-row[data-print="e piano"]').click(); flush()`)
await click('[data-a="new-kind"][data-v="bus"]'); ok('kind: bus', await ev(`return S.newT.kind === 'bus'`)); await key('ArrowLeft', 'ArrowLeft', 37); ok('the arrow: midi', await ev(`return S.newT.kind === 'midi'`)); await key('ArrowLeft', 'ArrowLeft', 37); ok('and again: audio', await ev(`return S.newT.kind === 'audio'`))
await key('ArrowUp', 'ArrowUp', 38); await key('ArrowUp', 'ArrowUp', 38); ok('up twice: three of them', await ev('return S.newT.n === 3'))
await click('[data-a="new-in"]'); await pick('input 2'); ok('what it listens to: input 2', await ev('return S.newT.inp === 1 && !!S.newT'))
{ const n0 = (await tracks()).length; await key('Enter', 'Enter', 13)
  ok('return: three audio tracks under the chosen one, each listening to input 2, all three chosen', same((await tracks()).slice(0, 6), ['kick', 'snare', 'audio 1', 'audio 2', 'audio 3', 'hats']) && await ev(`return !S.newT && S.tracks.slice(2, 5).every(t => t.kind === 'audio' && t.inp === 1 && !t.regs.length) && chosen().map(t => t.name).join() === 'audio 1,audio 2,audio 3'`), await tracks())
  await undo(); ok('one undo takes all three back', (await tracks()).length === n0, await tracks()) }
await key('a', 'KeyA', 65, ALT | CMD); ok('option command a still makes one audio track at once', same((await tracks()).slice(1, 3), ['snare', 'audio 1']), await tracks()); await undo()
await click('[data-a="addtrack"]'); ok('the + key opens the same list', await ev('return !!S.newT')); await key('Escape', 'Escape', 27); ok('escape closes it', await ev('return !S.newT'))
await key('Escape', 'Escape', 27)

// ── choosing by key, and a few more of his Logic keys ──
await ev(`const t = S.tracks.find(t => t.name === 'kick'); S.selR = [t.regs.find(r => r.a === 17).id]; S.focus = 'lanes'; S.sel = 0; S.selT = []`)
await key('f', 'KeyF', 70, CTRL | SHIFT); ok('control shift f: all that follow on the same track', same(await ev(`return S.selR.map(id => regOf(id)[0].a).sort((x, y) => x - y)`), [17, 25, 33]))
await key('f', 'KeyF', 70, SHIFT); ok('shift f: all that follow, on every track', await ev(`return S.selR.length === S.tracks.flatMap(t => t.regs).filter(r => r.a >= 17).length && S.selR.length > 3`), await ev('return S.selR.length'))
await key('i', 'KeyI', 73, SHIFT); ok('shift i: the others', await ev(`return S.selR.length === S.tracks.flatMap(t => t.regs).filter(r => r.a < 17).length`))
await key('d', 'KeyD', 68, SHIFT); ok('shift d: none', await ev('return S.selR.length === 0'))
await ev(`setCycle(16, 24, false)`); await key('l', 'KeyL', 76, SHIFT); ok('shift l: what lies in the cycle', await ev(`return S.selR.length > 0 && S.selR.every(id => { const r = regOf(id)[0]; return r.a - 1 < 24 && r.b - 1 > 16 })`), await ev('return S.selR.length'))
await ev(`const t = S.tracks.find(t => t.name === 'kick'); S.selR = [t.regs.find(r => r.a === 5).id]`)
await key('ArrowRight', 'ArrowRight', 39, SHIFT); ok('shift and the arrow: one more', same(await ev(`return S.selR.map(id => regOf(id)[0].a)`), [5, 17]))
await ev(`const t = S.tracks.find(t => t.name === 'air'); S.selR = [t.regs[0].id]; setCycle(8, 12, false)`); await key('t', 'KeyT', 84, ALT | CMD)
ok('option command t: cut at the cycle’s two ends', same(await regsOf('air'), [[1, 9], [9, 13], [13, 43]]), await regsOf('air')); await undo()
await ev(`const t = S.tracks.find(t => t.name === 'kick'); S.selR = [t.regs.find(r => r.a === 17).id]`); await key('[', 'BracketLeft', 219, ALT)
ok('option [: up against the one before', same(await regsOf('kick'), [[5, 13], [13, 21], [25, 33], [33, 41]]), await regsOf('kick')); await undo()
await ev(`S.selR = [S.tracks.find(t => t.name === 'kick').regs.find(r => r.a === 5).id]`); await key(']', 'BracketRight', 221, ALT)
ok('option ]: up against the one after', same(await regsOf('kick'), [[9, 17], [17, 25], [25, 33], [33, 41]]), await regsOf('kick')); await undo()
await ev(`S.pos = 5`); await key('.', 'Period', 190, ALT); ok('option period: to the next marker, the cycle’s ends with it', await ev(`return S.pos === 12 && S.cycle.a === 12 && S.cycle.b === 16`), await ev('return [S.pos, S.cycle]'))
await key(',', 'Comma', 188, ALT); ok('option comma: the one before', await ev('return S.pos === 4'), await ev('return S.pos'))
await key('Enter', 'Enter', 13, ALT); ok('option return: to where the sound ends', await ev('return S.pos === 42'), await ev('return S.pos'))
await ev(`S.selR = []; S.marq = { a: 8, b: 10, t0: 0, t1: 0 }; S.focus = 'lanes'`); await key("'", 'Quote', 222, ALT | SHIFT)
ok('option shift quote: a marker where what is chosen begins, its name asked for at once', await ev(`return SCENES.some(s => s.a === 9) && !document.getElementById('rename').hidden`), await ev('return SCENES.map(s => [s.name, s.a])'))
await ev(`const el = document.getElementById('rename'); el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`); await undo(); await key('Escape', 'Escape', 27)
ok('(undone)', await ev('return SCENES.length === 7'))
// a marker pulled along the song
await b.sleep(450); await drag('[data-a="scene"][data-i="1"]', 2 * pxb, 0)
ok('a marker taken and pulled two bars on: it begins there', await ev(`return SCENES[1].name === 'verse' && SCENES[1].a === 7 && S.selM === 7`), await ev('return SCENES.map(s => [s.name, s.a])'))
await undo(); ok('undo', await ev('return SCENES[1].a === 5'))
// where the playhead is, typed
await click('[data-a="pos"]'); await ev(`const el = document.getElementById('rename'); el.value = '21.3'; el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`); await b.sleep(60)
ok('the place pressed and typed into: the playhead goes there', await ev('return S.pos === 20.5'), await ev('return S.pos'))
await ev(`const el = document.getElementById('cmd'); el.value = '17'; el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`); await b.sleep(80)
ok('a bar said on the line: the same', await ev('return S.pos === 16'), await ev('return [S.pos, S.last]')); await ev(`document.getElementById('cmd').blur()`)
// a region's own name
await ev(`const t = S.tracks.find(t => t.name === 'kick'); S.selR = [t.regs.find(r => r.a === 17).id]; S.focus = 'lanes'; __daw.redraw()`); await key('Enter', 'Enter', 13, SHIFT)
{ const box = await ev(`const r = document.getElementById('rename').getBoundingClientRect(), bd = document.getElementById('board').getBoundingClientRect(); return { hidden: document.getElementById('rename').hidden, x: r.left - bd.left, y: r.top - bd.top, want: [bx(17), rowY(0)] }`)
  ok('shift return with a region chosen: its name is asked where it begins', !box.hidden && Math.abs(box.x - box.want[0]) < 4 && box.y >= box.want[1] && box.y < box.want[1] + 25, box)
  await ev(`const el = document.getElementById('rename'); el.value = 'fill'; el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`); await b.sleep(60)
  ok('and it is called that', await ev(`return S.tracks.find(t => t.name === 'kick').regs.find(r => r.a === 17).tag === 'fill'`)); await undo() }
// tracks with nothing on them
await ev(`newTrack('audio', null, true); newTrack('audio', null, true); const t = newTrack('audio', null, true); t.arm = true`)
await key('Backspace', 'Backspace', 8, SHIFT | CMD); await b.sleep(80)
ok('shift command delete: the empty tracks go (one that is armed stays)', same((await tracks()).filter(n => /^audio/.test(n)), ['audio 3']), await tracks()); await undo(); await undo(); await undo(); await undo()
// a track like another, with what is on it
await ev(`S.sel = 2; S.selT = []`); await key('d', 'KeyD', 68, ALT | SHIFT | CMD); await b.sleep(120)
ok('option shift command d: a track like this one, with what is on it', same((await tracks()).slice(2, 4), ['hats', 'hats 2']) && same(await regsOf('hats 2'), await regsOf('hats')), await tracks()); await undo()

// ── what a fader reads: typed, or put back ──
await ev(`S.sel = 0; S.selT = []; __daw.redraw()`)
await b.sleep(450); await dbl('[data-a="volnum"][data-i="1"]')
{ const box = await ev(`const r = document.getElementById('rename').getBoundingClientRect(), c = document.querySelector('[data-a="volnum"][data-i="1"]').getBoundingClientRect(); return { hidden: document.getElementById('rename').hidden, dy: Math.abs((r.top + r.bottom) / 2 - (c.top + c.bottom) / 2), dx: Math.abs((r.left + r.right) / 2 - (c.left + c.right) / 2), v: document.getElementById('rename').value }`)
  ok('what a fader reads, pressed twice: a box on it, with the level in it', !box.hidden && box.dy < 2 && box.dx < 2 && box.v === '-5', box) }
await ev(`const el = document.getElementById('rename'); el.value = '-3.5'; el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`); await b.sleep(60)
ok('a level typed: the fader is there', await ev('return S.tracks[1].vol === -3.5'), await ev('return S.tracks[1].vol'))
await b.sleep(450); await click('[data-a="volnum"][data-i="1"]', ALT); ok('option and a press on it: 0 db', await ev('return S.tracks[1].vol === 0')); await ev(`S.tracks[1].vol = -5; applyAll(); __daw.redraw()`)
await key('x', 'KeyX', 88); await b.sleep(260)
await dbl('[data-a="volnum"][data-i="2"]'); await ev(`const el = document.getElementById('rename'); el.value = '-inf'; el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`); await b.sleep(60)
ok('in the mixer too; -inf is all the way down', await ev('return S.tracks[2].vol === -48'), await ev('return S.tracks[2].vol')); await ev(`S.tracks[2].vol = -6; applyAll(); __daw.redraw()`)
await b.sleep(450); await dbl('[data-a="volnum"][data-i="-1"]'); await ev(`const el = document.getElementById('rename'); el.value = '-2'; el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`); await b.sleep(60)
ok('and the out’s', await ev('return S.master === -2'), await ev('return S.master')); await ev(`S.master = -4.2; pushMaster()`)
await key('x', 'KeyX', 88); await b.sleep(260)
// a head is chosen by a press anywhere from its number to its cells
{ const p = await ev(`const bd = document.getElementById('board').getBoundingClientRect(); return { x: bd.left + 14, y: bd.top + rowY(6) + S.rh / 2 }`); await b.click(p.x, p.y); await b.sleep(40)
  ok('a press on a row’s number chooses the track', same(await names(), ['hum']), await names()) }
await ev(`S.selR = [S.tracks[0].regs[0].id, S.tracks[1].regs[0].id]; S.focus = 'lanes'; makeStack(); __daw.redraw()`)
await b.sleep(450); await click('[data-a="fold"]'); ok('a stack still closes by its mark', await ev(`return S.tracks.find(t => t.kind === 'stack').open === false`)); await click('[data-a="fold"]'); await undo()
ok('(the stack undone)', same(await tracks(), ['kick', 'snare', 'hats', 'bass', 'keys', 'guitar', 'hum', 'air']), await tracks())
// what a marquee holds can be copied
await ev(`const i = S.tracks.findIndex(t => t.name === 'air'); S.selR = []; S.marq = { a: 8, b: 10, t0: i, t1: i }; S.focus = 'lanes'`)
await key('c', 'KeyC', 67, CMD)
ok('command c with a marquee up: nothing on the lanes changes', same(await regsOf('air'), [[1, 43]]) && await ev('return !!S.marq'))
await ev(`const t = newTrack('audio', 'copy'); S.marq = null; S.pos = 0`); await key('v', 'KeyV', 86, CMD)
ok('pasted: the stretch the marquee held, from where it was cut', same(await regsOf('copy'), [[1, 3]]) && await ev(`return S.tracks.find(t => t.name === 'copy').regs[0].off === 8`), await regsOf('copy'))
await undo(); await undo()
// the room turns under a region held at its edge
await ev(`setZoom(60, 0); VX = 0; S.selR = []; __daw.redraw()`)
{ const p = await ev(`const r = S.tracks[0].regs[0], bd = document.getElementById('board').getBoundingClientRect(); return { x: bd.left + bx(r.a) + 40, y: bd.top + rowY(0) + S.rh / 2, edge: bd.left + X1 - 6, a: r.a, id: r.id, span: (X1 - X0) / PXB }`)
  await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y, button: 'none', buttons: 0 })
  await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', buttons: 1, clickCount: 1 })
  for (let k = 1; k <= 6; k++) await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x + (p.edge - p.x) * k / 6, y: p.y, button: 'left', buttons: 1 })
  await b.sleep(900)
  const mid = await ev('return [VX, regOf(' + p.id + ')[0].a]')
  await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.edge, y: p.y, button: 'left', buttons: 0, clickCount: 1 }); await b.sleep(60)
  ok('a region held at the right edge: the room turns, and the region goes on with it', mid[0] > 2 && mid[1] > p.a + p.span - 2, [mid, p.span])
  await undo(); await ev(`setZoom(0)`) }

// ── the sheet of keys still fits the smallest window ──
ok('no errors on the page', (await ev('return window.__errs')).length === 0 && b.errors.length === 0, [await ev('return window.__errs'), b.errors])
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close()
