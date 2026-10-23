// node test/hands.mjs [width height] — every control of the room, found by what it does and pressed with a real pointer; what changed is read back
import { open, PAGE, DRAFT } from './cdp.mjs'
const W = +(process.argv[2] || 1440), H = +(process.argv[3] || 900)
const b = await open(PAGE, { width: W, height: H, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
// where a control is: the middle of its hit rect, and whether the pointer would really land on it
const at = async (sel, fx = .5, fy = .5) => ev(`const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; const r = el.getBoundingClientRect(), x = r.left + r.width * ${fx}, y = r.top + r.height * ${fy}, top = document.elementFromPoint(x, y); return { x, y, w: r.width, h: r.height, hit: top === el, top: top ? (top.dataset && top.dataset.a) || top.tagName : null }`)
const click = async (sel, fx, fy, mods) => { const p = await at(sel, fx, fy); if (!p) { bad.push('missing ' + sel); out.push('FAIL missing ' + sel); return null } if (!p.hit) { bad.push('covered ' + sel); out.push(`FAIL covered ${sel} by ${p.top}`) } await b.click(p.x, p.y, mods || 0); await b.sleep(40); return p }
const dbl = async sel => { const p = await at(sel); if (!p) { bad.push('missing ' + sel); return } await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', buttons: 1, clickCount: 1 }); await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 }); await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', buttons: 1, clickCount: 2 }); await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 2 }); await b.sleep(40) }
const rclick = async (sel, fx, fy) => { const p = await at(sel, fx, fy); if (!p) { bad.push('missing ' + sel); return } await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'right', buttons: 2, clickCount: 1 }); await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'right', clickCount: 1 }); await b.sleep(40) }
const drag = async (sel, dx, dy, fx, fy) => { const p = await at(sel, fx, fy); if (!p) { bad.push('missing ' + sel); return } await b.dragTo(p.x, p.y, p.x + dx, p.y + dy, 6); await b.sleep(40) }
const st = expr => ev(`const S = __daw.S; return (${expr})`)
const key = async (k, code, vk, mods) => { await b.press(k, code, vk, mods || 0); await b.sleep(40) }
const settle = () => b.sleep(260)
const pick = async label => { const i = await st(`S.menu ? S.menu.items.findIndex(it => it.t === ${JSON.stringify(label)}) : -1`); if (i < 0) { bad.push('menu item ' + label); out.push('FAIL menu item ' + label + ' ' + JSON.stringify(await st('S.menu && S.menu.items.map(i => i.t)'))); return } await click(`[data-a="pick"][data-i="${i}"]`) }

// ── the control bar and the tracks' own bar: in the transport panel now (the bars at the top are gone) ──
await ev(`tpanelSet(true, false); flush(); return 1`)
ok('the bar has no keys for patch, mixer and slur (the Window menu opens them)', await ev(`return !document.querySelector('#g-top [data-a="patch"], #g-top [data-a="mixer"], #g-top [data-a="slur"]')`))
await ev(`MENU_DO.winpatch()`); await settle(); ok('window > patch opens the panel', await st(`S.panel.on && S.panel.tab === 'patch' && __daw.VIEW.p === 1`))
await ev(`MENU_DO.winmixer()`); await settle(); ok('window > mixer turns the panel to the mixer', await st(`S.panel.on && S.panel.tab === 'mixer'`))
await ev(`MENU_DO.winmixer()`); await settle(); ok('window > mixer again closes it', await st(`!S.panel.on && __daw.VIEW.p === 0`))
await ev(`MENU_DO.winslur()`); await settle(); ok('window > slur opens slur', await st(`S.slur && __daw.VIEW.s === 1 && __daw.lay().RX === __daw.lay().W - 300`))
await ev(`MENU_DO.winslur()`); await settle(); ok('window > slur again closes it', await st(`!S.slur && __daw.VIEW.s === 0`))
await key('b', 'KeyB', 66); await settle(); ok('b opens patch', await st(`S.panel.on && S.panel.tab === 'patch'`))
await key('x', 'KeyX', 88); await settle(); ok('x turns to mixer', await st(`S.panel.on && S.panel.tab === 'mixer'`))
await key('x', 'KeyX', 88); await settle(); ok('x closes', await st(`!S.panel.on`))
await key('o', 'KeyO', 79); await settle(); ok('o opens slur', await st(`S.slur`))
await key('o', 'KeyO', 79); await settle(); ok('o closes slur', await st(`!S.slur`))
await click('[data-a="play"]'); await b.sleep(250); ok('play', await st(`S.playing`))
const p1 = await ev(`return __daw.curPos()`); ok('the song moves', p1 > 0.01, p1)
await click('[data-a="stop"]'); ok('stop', await st(`!S.playing`))
await click('[data-a="tostart"]'); ok('to the start', await st(`S.pos === 0`))
await click('[data-a="loop"]'); ok('cycle on', await st(`S.cycle.on`)); await click('[data-a="loop"]'); ok('cycle off', await st(`!S.cycle.on`))
await click('[data-a="click"]'); ok('click on', await st(`S.click`)); await click('[data-a="click"]')
await click('[data-a="rec"]'); ok('record says it is in the app', await st(`S.last && S.last.say === 'recording is in the app'`), await st('S.last'))
// tempo and key, changed where they stand
await click('[data-a="tempo"]')
let box = await ev(`const r = document.getElementById('rename').getBoundingClientRect(), c = document.querySelector('[data-a="tempo"]').getBoundingClientRect(); return { hidden: document.getElementById('rename').hidden, dx: r.left - c.left, dy: r.top - c.top, w: r.width, cw: c.width }`)
ok('tempo box lies on its cell (inside it)', !box.hidden && box.dx >= -2 && box.dx + box.w <= box.cw + 2, box)
await ev(`const el = document.getElementById('rename'); el.value = '100'; el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`); await b.sleep(80)
ok('tempo is 100', await st(`S.tempo === 100`)); await ev(`__daw.S.tempo !== 92 && (function(){ })()`)
await click('[data-a="tempo"]'); await ev(`const el = document.getElementById('rename'); el.value = '92'; el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`); await b.sleep(80)
await click('[data-a="key"]')
box = await ev(`const r = document.getElementById('rename').getBoundingClientRect(), c = document.querySelector('[data-a="key"]').getBoundingClientRect(); return { hidden: document.getElementById('rename').hidden, dx: r.left - c.left, w: r.width, cw: c.width }`)
ok('key box lies on its cell (inside it)', !box.hidden && box.dx >= -2 && box.dx <= box.cw, box)
await ev(`const el = document.getElementById('rename'); el.value = 'A min'; el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`); await b.sleep(80)
ok('key is a min', await st(`S.key === 'a min'`), await st('S.key'))
// the way out
const m0 = await st('S.master'); await drag('[data-a="master"]', 0, 30); ok('the out goes down when pulled down', (await st('S.master')) < m0, await st('S.master'))
await dbl('[data-a="master"]'); ok('twice puts the out at 0', await st('S.master === 0')); await ev(`__daw.S.master = -4.2`)
// hand off
ok('the bar has no hand off key (file > hand off, command b)', await ev(`return !document.querySelector('#g-top [data-a="ho"]')`))
await ev(`MENU_DO.handoff()`); await b.sleep(120); ok('hand off opens, in the middle of the window', await st('S.ho.open') && await ev(`flush(); const r = [...document.querySelectorAll('#g-hand [data-a="ho-pane"]')][0].getBoundingClientRect(), bd = document.getElementById('board').getBoundingClientRect(); return Math.abs((r.left + r.right) / 2 - (bd.left + bd.right) / 2) < 2`))
ok('…stems or bounce, two large keys; the rest folded under change', !!(await ev(`return document.querySelector('#g-hand [data-a="ho-set"][data-k="what"][data-v="stems"]')`)) && !(await ev(`return document.querySelector('#g-hand [data-a="ho-set"][data-k="print"]')`)))
await click('[data-a="ho-more"]'); ok('change opens every choice', !!(await ev(`return document.querySelector('#g-hand [data-a="ho-set"][data-k="print"][data-v="dry"]')`)))
await click('[data-a="ho-set"][data-k="print"][data-v="dry"]'); ok('print dry', await st(`S.ho.print === 'dry'`))
await click('[data-a="ho-set"][data-k="range"][data-v="song"]'); ok('range song', await st(`S.ho.range === 'song'`))
await ev(`Object.assign(__daw.S.ho, { print: 'with patch', range: 'this scene' })`)
await click('[data-a="ho-close"]', .02, .9); ok('a press outside closes hand off', await st('!S.ho.open'))

// ── the tracks' own bar ──
const n0 = await st('S.tracks.length')
await click('[data-a="addtrack"]'); ok('the + key opens the new-track list', await st(`!!S.newT && S.newT.kind === 'audio'`)); await click('[data-a="new-make"]'); ok('create: a new audio track', await st(`S.tracks.length === ${n0 + 1} && !S.newT`))
await key('z', 'KeyZ', 90, 4); ok('undo takes it back', await st(`S.tracks.length === ${n0}`))
await click('[data-a="autokey"]'); ok('auto on', await st('S.auto')); await click('[data-a="flexkey"]'); ok('flex on turns auto off', await st('S.flex && !S.auto')); await click('[data-a="flexkey"]'); ok('flex off', await st('!S.flex'))
await click('[data-a="toolmenu"]'); await pick('scissors'); ok('tool scissors', await st(`S.tool === 'scissors'`))
await click('[data-a="toolmenu"]'); await pick('pointer')
ok('no command tool in the bar (he had it gone, 2026-10-21)', await st(`!document.querySelector('[data-a="tool2menu"]') && !('tool2' in S)`))
await click('[data-a="modemenu"]'); await pick('slip'); ok('the mode key: slip, nothing pulls', await st(`S.mode === 'slip' && !S.snap`)); await click('[data-a="modemenu"]'); await pick('smart'); ok('and smart again', await st(`S.mode === 'smart' && S.snap`))
// colour and outline
await click('[data-a="sel"][data-i="0"]')
const c0 = await st('S.tracks[0].c')
await click('[data-a="look"]'); ok('look opens', await st('!!S.look'))
await click('[data-a="look-col"][data-f="vox"][data-s="3"]'); ok('a colour set by hand', await st(`JSON.stringify(S.tracks[0].col) === '["vox",3]' && S.tracks[0].c !== ${JSON.stringify(c0)}`), await st('[S.tracks[0].col, S.tracks[0].c]'))
await click('[data-a="look-shape"][data-v="vox"]'); ok('an outline set by hand', await st(`S.tracks[0].shape === 'vox' && S.tracks[0].outline === 'vox'`))
await click('[data-a="look-col"][data-f=""]'); await click('[data-a="look-shape"][data-v=""]'); ok('given back: as read', await st(`!S.tracks[0].col && !S.tracks[0].shape && S.tracks[0].c === ${JSON.stringify(c0)} && S.tracks[0].outline === 'plain'`), await st('[S.tracks[0].col, S.tracks[0].shape, S.tracks[0].c, S.tracks[0].outline]'))
await click('[data-a="look-close"]', .02, .9); ok('look closes', await st('!S.look'))
// zoom
const z0 = await ev('return __daw.lay().PXB'); await drag('[data-a="zoomx"]', 20, 0, .2); const z1 = await ev('return __daw.lay().PXB'); ok('zoom along the song', z1 > z0, [z0, z1])
await dbl('[data-a="zoomx"]'); ok('twice: all of the song', await ev('return Math.abs(__daw.lay().PXB - fitPXB()) < .01'))
await drag('[data-a="zoomy"]', 20, 0, .6); ok('taller rows', (await st('S.rh')) > 25, await st('S.rh')); await dbl('[data-a="zoomy"]'); ok('twice: rows of 25', await st('S.rh === 25'))

await ev(`tpanelSet(false, false); flush(); return 1`)
// ── markers and bars ──
await click('[data-a="scene"][data-i="3"]'); ok('a marker pressed: the song goes there', await st('S.pos === 16'), await st('S.pos'))
// while the song runs a marker is not gone to in the middle of a bar: it is marked, and the song goes at the next bar line
// (presses of the same marker less than half a second apart are one double press, so these are spaced)
await b.sleep(500); await ev(`__daw.S.pos = 0.1; __daw.play()`); await b.sleep(200)
await click('[data-a="scene"][data-i="3"]')
{ const q = await ev(`__daw.flush(); return [__daw.S.queued, __daw.curPos(), document.getElementById('g-scenes').innerHTML.includes('height="6"')]`); ok('pressed while the song runs: it waits, with a mark', q[0] === 3 && q[1] < 1 && q[2], q) }
await b.sleep(500); await click('[data-a="scene"][data-i="3"]'); ok('pressed again: let go', await st('S.queued === null'))
await b.sleep(500); await click('[data-a="scene"][data-i="3"]'); await b.sleep(1700)
{ const q = await ev(`return [__daw.S.queued, __daw.curPos()]`); ok('at the bar line the song goes there', q[0] === null && q[1] >= 16 && q[1] < 17, q) }
await ev(`halt(false); return 1`); await ev(`__daw.S.pos = 16`)      // (stopped: the transport is hidden in this part)
await dbl('[data-a="scene"][data-i="1"]'); await b.sleep(80)
ok('twice: its name can be typed where it stands', await ev(`const el = document.getElementById('rename'); return !el.hidden && document.activeElement === el && el.value === SCENES[1].name`), await ev(`const el = document.getElementById('rename'); return [el.hidden, el.value]`))
await b.type('second verse'); await key('Enter', 'Enter', 13)
ok('… and return gives it that name', await ev(`return SCENES[1].name === 'second verse' && document.getElementById('rename').hidden`), await ev('return SCENES[1].name'))
await ev(`undoEdit(); __daw.flush()`); ok('… which one step takes back', await ev(`return SCENES[1].name === 'verse'`), await ev('return SCENES[1].name'))
await dbl('[data-a="scene"][data-i="1"]'); await b.sleep(80); await b.type('nothing'); await key('Escape', 'Escape', 27)
ok('escape leaves the name as it was', await ev(`return SCENES[1].name === 'verse' && document.getElementById('rename').hidden`), await ev('return SCENES[1].name'))
await rclick('[data-a="scene"][data-i="1"]'); await pick('cycle this part'); ok('its menu makes the part the cycle', await st('S.cycle.on && S.cycle.a === 4 && S.cycle.b === 12'), await st('S.cycle'))
await key('c', 'KeyC', 67)
await rclick('[data-a="scene"][data-i="2"]'); ok('the other button opens its menu', await st(`!!S.menu && S.menu.items[0].t === 'rename'`)); await key('Escape', 'Escape', 27)
await click('[data-a="seek"]', .5, .6); ok('a press on the bars moves the playhead', await st('S.pos > 10'), await st('S.pos'))
await ev(`S.cycle = { on: false, a: 0, b: 0 }; __daw.redraw()`)
await drag('[data-a="cycle"]', 120, 0, .1); ok('a pull along the top edge draws the cycle', await st('S.cycle.on && S.cycle.b - S.cycle.a > 2'), await st('S.cycle')); await key('c', 'KeyC', 67)

// ── heads ──
await click('[data-a="sel"][data-i="2"]'); ok('a head pressed: chosen', await st('S.sel === 2'))
await click('[data-a="mute"][data-i="2"]'); ok('m', await st('S.tracks[2].mute')); await click('[data-a="mute"][data-i="2"]')
await click('[data-a="solo"][data-i="2"]'); ok('s', await st('S.tracks[2].solo')); await click('[data-a="solo"][data-i="2"]')
const v0 = await st('S.tracks[2].vol'); await drag('[data-a="vol"][data-i="2"]', -14, 0); ok('the fader pulled left', (await st('S.tracks[2].vol')) < v0, await st('S.tracks[2].vol'))
await dbl('[data-a="vol"][data-i="2"]'); ok('twice: the fader at 0 db', await st(`S.tracks[2].vol === 0`)); await ev(`S.tracks[2].vol = ${v0}; __daw.applyAll(); __daw.redraw()`)
await dbl('[data-a="sel"][data-i="2"]')
box = await ev(`const r = document.getElementById('rename').getBoundingClientRect(), row = document.getElementById('hd-2').getBoundingClientRect(); return { hidden: document.getElementById('rename').hidden, left: r.left, top: r.top - row.top, h: r.height, w: r.width }`)
ok('a name is changed where it stands', !box.hidden && box.left > 30 && box.left < 60 && box.top >= 0 && box.top + box.h <= 26, box)
await ev(`const el = document.getElementById('rename'); el.value = 'ride'; el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`); await b.sleep(80)
ok('renamed', await st(`S.tracks[2].name === 'ride' && S.tracks[2].fam === 'drums'`)); await key('z', 'KeyZ', 90, 4)
await rclick('[data-a="sel"][data-i="1"]'); ok('a head’s own menu', await st(`!!S.menu && S.menu.items.some(i => i.t === 'duplicate')`)); await key('Escape', 'Escape', 27)

// ── lanes ──
const reg = await ev(`const t = __daw.S.tracks[0], r = t.regs[0], L = __daw.lay(), b = document.getElementById('board').getBoundingClientRect(); const x = (292 + (r.a - 1 - L.VX) * L.PXB + (r.b - r.a) * L.PXB / 2), y = L.TY + 0 * L.rh - L.VY + L.rh / 2; return { x: b.left + x, y: b.top + y, id: r.id, a: r.a, pxb: L.PXB }`)
await b.click(reg.x, reg.y); await b.sleep(40); ok('a region pressed: chosen', await st(`S.selR.length === 1 && S.selR[0] === ${reg.id}`))
await ev(`tpanelSet(true, false); flush(); return 1`)      // (what is chosen is said in the transport panel now)
ok('the transport panel names the region', await ev(`const r = regOf(${reg.id})[0], t = document.getElementById('tp-col').textContent; return t.includes(r.tag || r.name || S.tracks[0].name) && t.includes('gain')`))
await ev(`tpanelSet(false, false); flush(); return 1`)
await b.dragTo(reg.x, reg.y, reg.x + reg.pxb * 2, reg.y, 6); await b.sleep(60); ok('pulled two bars on', await st(`__daw.regOf(${reg.id})[0].a === ${reg.a + 2}`), await st(`__daw.regOf(${reg.id})[0].a`))
await key('z', 'KeyZ', 90, 4); ok('undo', await st(`__daw.regOf(${reg.id})[0].a === ${reg.a}`))
await ev(`tpanelSet(true, false); flush(); return 1`)
const g0 = await st(`__daw.regOf(${reg.id})[0].gain || 0`); await drag('[data-a="rgain"]', 0, -20); ok('gain pulled up in the transport panel', (await st(`__daw.regOf(${reg.id})[0].gain`)) > g0, await st(`__daw.regOf(${reg.id})[0].gain`)); await dbl('[data-a="rgain"]')
await click('[data-a="look"]'); await click('[data-a="look-col"][data-f="gtr"][data-s="5"]'); ok('a region takes a colour of its own', await st(`JSON.stringify(__daw.regOf(${reg.id})[0].col) === '["gtr",5]' && !S.tracks[0].col`)); await click('[data-a="look-col"][data-f=""]'); await click('[data-a="look-close"]', .02, .9)
await ev(`tpanelSet(false, false); flush(); return 1`)
await key('Escape', 'Escape', 27)

// ── the panel: patch ──
await click('[data-a="sel"][data-i="5"]'); await key('b', 'KeyB', 66); await settle()
// a patch begins with nothing on it; prints are put on its wall from the list, pulled, and taken off again (the wall itself: test/wall.mjs)
const prints = () => ev(`return [...document.querySelectorAll('#g-dock [data-a="wall"][data-k="node"]')].map(e => wallNode(wallOf(S.tracks[S.sel]), +e.dataset.id).k)`)
const NODE = '#g-dock [data-a="wall"][data-k="node"]'
ok('a patch begins empty: in, out, a key to add', JSON.stringify(await prints()) === '[]' && await ev(`return !!document.querySelector('#g-dock [data-a="plugs"]')`), await prints())
await click('[data-a="plugs"]'); await b.sleep(120); ok('the key to add opens the list, with patch on slur’s prints', await ev(`const r = [...document.querySelectorAll('#pk-list .pk-row')].map(e => e.dataset.print); return S.picker.open && ['tape', 'space', 'delay', 'comp', 'shimmer'].every(k => r.includes(k))`))
await ev(`document.querySelector('#pk-list .pk-row[data-print="tape"]').click()`); await b.sleep(80)
ok('pressed once in the list, tape is only lit', JSON.stringify(await prints()) === '[]' && await st('!!document.querySelector("#pk-list .pk-row.on[data-print=tape]")'))
await ev(`document.querySelector('#pk-list .pk-row[data-print="tape"]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`); await b.sleep(80)
ok('twice: tape is put on the wall, at a moderate amount, wired in between in and out', JSON.stringify(await prints()) === '["tape"]' && await st('Math.round(S.tracks[S.sel].patch.A.tape) === 24 && JSON.stringify(wallOf(S.tracks[S.sel]).wires.map(e => [e.from, e.to])) === JSON.stringify([[-1, wallOf(S.tracks[S.sel]).nodes[0].id], [wallOf(S.tracks[S.sel]).nodes[0].id, -2]])'), await prints())
ok('…and is no longer in the list (there is one tape on a wall)', await ev(`return !document.querySelector('#pk-list .pk-row[data-print="tape"]') && !!document.querySelector('#pk-list .pk-row[data-print="space"]')`))
await key('Escape', 'Escape', 27); await b.sleep(80)
const tp0 = await st('Math.round(S.tracks[S.sel].patch.A.tape)'), nx0 = await st('wallOf(S.tracks[S.sel]).nodes[0].x'); await drag(NODE, 40, -30)
ok('a print pulled on the wall is moved, its amount as it was', (await st('wallOf(S.tracks[S.sel]).nodes[0].x')) > nx0 && (await st('Math.round(S.tracks[S.sel].patch.A.tape)')) === tp0, [nx0, await st('wallOf(S.tracks[S.sel]).nodes[0].x')])
await b.sleep(450); await click(NODE); await b.sleep(80); ok('pressed: its study opens', await st('!!studyNode()'))
await drag('#g-dock [data-a="study"][data-k="print"]', 0, -30); ok('the big print pulled up turns it up', (await st('Math.round(S.tracks[S.sel].patch.A.tape)')) > tp0, [tp0, await st('Math.round(S.tracks[S.sel].patch.A.tape)')])
await click('#g-dock [data-a="study"][data-k="print"]', .5, .5, 1); ok('with option: back to the amount it comes on with', await st('Math.round(S.tracks[S.sel].patch.A.tape) === 24'), await st('S.tracks[S.sel].patch.A.tape'))
await click('#g-dock [data-a="study"][data-k="rm"]'); await b.sleep(60); await click('#g-dock [data-a="study"][data-k="rm"]'); await b.sleep(80)
ok('remove, twice, takes it off the wall, and the patch is empty again', JSON.stringify(await prints()) === '[]' && await st('S.tracks[S.sel].patch.A.tape === 0'), await prints())
const h0 = await st('S.panel.h'); await drag('[data-a="pgrip"]', 0, -60, .3); ok('the panel’s edge pulled up', (await st('S.panel.h')) === h0 + 60, [h0, await st('S.panel.h')]); await drag('[data-a="pgrip"]', 0, 60, .3)
const sv0 = await st('S.tracks[5].vol'); await drag('[data-a="mvol"][data-i="5"]', 0, 30); ok('the strip’s fader pulled down', (await st('S.tracks[5].vol')) < sv0, await st('S.tracks[5].vol')); await dbl('[data-a="mvol"][data-i="5"]')
await drag('[data-a="mpan"][data-i="5"]', 14, 0); ok('pan to the right', (await st('S.tracks[5].pan')) > 0, await st('S.tracks[5].pan')); await dbl('[data-a="mpan"][data-i="5"]'); ok('twice: the middle', await st('S.tracks[5].pan === 0'))
await click('[data-a="msendadd"][data-i="5"]'); await pick('new bus'); ok('a send to a new bus', await st(`S.tracks[5].sends.length === 1 && S.tracks.some(t => t.kind === 'bus')`), await st('S.tracks.map(t => t.name)'))
const sd0 = await st('S.tracks[5].sends[0].db'); await drag('[data-a="msend"][data-i="5"][data-k="0"]', 22, 0, .3); ok('the send fills as it is pulled', (await st('S.tracks[5].sends[0].db')) > sd0, [sd0, await st('S.tracks[5].sends[0].db')])
await click('[data-a="mout"][data-i="5"]'); ok('out opens its list', await st(`!!S.menu && S.menu.items[0].t === 'stereo out'`)); await pick('bus 1'); ok('out to the bus', await st(`S.tracks[5].out === S.tracks.find(t => t.kind === 'bus').id`)); await key('z', 'KeyZ', 90, 4)
await drag('[data-a="mmaster"]', 0, 24); ok('the out’s own fader pulled down', (await st('S.master')) < -4.2, await st('S.master')); await dbl('[data-a="mmaster"]'); ok('twice: the out at 0', await st('S.master === 0')); await ev(`__daw.S.master = -4.2`)
await click('[data-a="tab-mixer"]'); ok('the tab turns the panel', await st(`S.panel.tab === 'mixer'`))
// ── the panel: mixer ──
await click('[data-a="msel"][data-i="1"]'); ok('a strip pressed by its name: chosen', await st('S.sel === 1'))
const mv0 = await st('S.tracks[3].vol'); await drag('[data-a="mvol"][data-i="3"]', 0, -24); ok('a narrow strip’s fader', (await st('S.tracks[3].vol')) > mv0, await st('S.tracks[3].vol')); await dbl('[data-a="mvol"][data-i="3"]')
await click('[data-a="mute"][data-i="4"]'); ok('m on a strip', await st('S.tracks[4].mute')); await click('[data-a="mute"][data-i="4"]')
await click('[data-a="m-patch"][data-i="6"]'); ok('a strip’s patch goes to its patch (another program’s track: its empty slot)', await st(`S.sel === 6 && S.panel.tab === 'patch'`))
await key('z', 'KeyZ', 90, 4); await key('z', 'KeyZ', 90, 4); await key('b', 'KeyB', 66); await settle()

// ── the foot ──
await click('[data-a="cmdline"]'); ok('the mark focuses the line', await ev(`return document.activeElement === document.getElementById('cmd')`))
await ev(`const el = document.getElementById('cmd'); el.value = 'snare -3 db'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`); await b.sleep(120)
ok('said and done', await st('S.tracks[1].vol === -8 && S.last && S.last.res && S.last.res.length === 1'), await st('[S.tracks[1].vol, S.last]'))
ok('what was said stays', await ev(`return document.getElementById('cmd').value === 'snare -3 db'`))
await click('[data-a="undo"]'); ok('undo in the foot', await st('S.tracks[1].vol === -5'))
await ev(`document.getElementById('cmd').blur()`)
await click('[data-a="sheet"]'); ok('keys opens the sheet', await st('!!S.sheet')); await click('[data-a="sheet-close"]', .01, .5); ok('a press closes it', await st('!S.sheet'))


// ── a marquee, then the pointer (t, t): pressed inside it, the stretch is cut out at its edges and chosen; command x takes just it ──
{
  await ev(`while (UNDO.length) undoEdit(); S.selR = []; S.marq = null; S.auto = false; S.flex = false; if (S.sheet) S.sheet = false; setView(true); VX = 0; VY = 0; PXB = fitPXB(); pickTool('marquee'); __daw.redraw()`)
  const name = await ev(`return (S.tracks.find(t => t.kind === 'audio' && !t.parent && t.regs.some(r => r.b - r.a >= 6)) || {}).name || ''`)
  const lane = () => ev(`const t = S.tracks.find(x => x.name === ${JSON.stringify(name)}); return t.regs.slice().sort((x, y) => x.a - y.a).map(r => [+r.a.toFixed(3), +r.b.toFixed(3), S.selR.includes(r.id) ? 1 : 0])`)
  const g = await ev(`const i = S.tracks.findIndex(x => x.name === ${JSON.stringify(name)}), r = S.tracks[i].regs.slice().sort((x, y) => (y.b - y.a) - (x.b - x.a))[0], k = document.getElementById('board').getBoundingClientRect(), z = k.width / W, at = bar => k.left + bx(bar) * z; showRow(i); __daw.redraw(); return { y: k.top + (rowY(i) + S.rh / 2) * z, a: r.a, b: r.b, x1: at(r.a + 1), xm: at(r.a + 2), x3: at(r.a + 3), x5: at(r.a + 5) }`)
  const was = await lane()
  await b.dragTo(g.x1, g.y, g.x3, g.y, 8); await b.sleep(60)
  ok('a marquee over a stretch of one region', await st(`!!S.marq && Math.abs(S.marq.a - ${g.a}) < 1e-6 && Math.abs(S.marq.b - ${g.a + 2}) < 1e-6`), await st('S.marq'))
  await key('t', 'KeyT', 84); await key('t', 'KeyT', 84)
  ok('t, t: the pointer, and the marquee still up', await st(`S.tool === 'pointer' && !!S.marq && !S.menu`), await st('[S.tool, !!S.marq]'))
  await b.click(g.xm, g.y); await b.sleep(60)
  { const now = await lane(), piece = now.find(r => r[2]); ok('pressed inside it: that stretch alone is a region of its own, and chosen', now.length === was.length + 2 && !!piece && Math.abs(piece[0] - (g.a + 1)) < 1e-6 && Math.abs(piece[1] - (g.a + 3)) < 1e-6 && now.filter(r => r[2]).length === 1 && await st('!S.marq'), now) }
  await key('x', 'KeyX', 88, 4)
  { const now = await lane(); ok('command x takes just that stretch', now.length === was.length + 1 && !now.some(r => Math.abs(r[0] - (g.a + 1)) < 1e-6) && await ev('return CLIP.length === 1'), now) }
  await ev(`undoEdit(); undoEdit(); __daw.redraw()`); ok('two steps back: whole again', JSON.stringify((await lane()).map(r => r.slice(0, 2))) === JSON.stringify(was.map(r => r.slice(0, 2))), await lane())
  await ev(`pickTool('marquee'); __daw.redraw()`); await b.dragTo(g.x1, g.y, g.x3, g.y, 8); await b.sleep(60)
  await key('x', 'KeyX', 88, 4)
  { const now = await lane(); ok('command x with the marquee itself: the same stretch, and nothing more', now.length === was.length + 1 && !now.some(r => r[0] > g.a + 1 - 1e-6 && r[1] < g.a + 3 + 1e-6) && await ev('return CLIP.length === 1'), now) }
  await ev(`undoEdit(); __daw.redraw()`)
  await b.dragTo(g.x1, g.y, g.x3, g.y, 8); await b.sleep(60); await ev(`pickTool('pointer'); __daw.redraw()`)
  await b.click(g.x5, g.y); await b.sleep(60)
  ok('pressed outside it: the marquee is put away and nothing is cut', await st('!S.marq') && (await lane()).length === was.length && await ev('return UNDO.length === 0'), await lane())
  // copy and paste: the stretch under the marquee, put down at the playhead as often as command v is pressed
  await ev(`while (UNDO.length) undoEdit(); S.selR = []; S.marq = null; pickTool('marquee'); __daw.redraw()`)
  await b.dragTo(g.x1, g.y, g.x3, g.y, 8); await b.sleep(60)
  ok('a marquee leads the track it lies on', await ev(`return S.tracks[S.sel].name === ${JSON.stringify(name)}`), await ev('return S.tracks[S.sel].name'))
  await key('c', 'KeyC', 67, 4)
  const far = await ev(`jumpTo(SONG_END); return __daw.curPos()`)                          // (the playhead far away, at the end of the song: it is not where the copies go)
  for (let k = 0; k < 3; k++) await key('v', 'KeyV', 86, 4)
  { const now = await lane(), at = k => g.a + 3 + 2 * k
    ok('command v three times: each copy right after the stretch before it, on the track it came from', [0, 1, 2].every(k => now.some(r => Math.abs(r[0] - at(k)) < 1e-6 && Math.abs(r[1] - at(k) - 2) < 1e-6)) && !now.some(r => r[0] >= far + 1 - 1e-6), now)
    ok('the marquee lies over the last one put down, and the playhead has not moved', await st(`!!S.marq && Math.abs(S.marq.a - ${g.a + 6}) < 1e-6 && Math.abs(S.marq.b - ${g.a + 8}) < 1e-6 && Math.abs(__daw.curPos() - ${far}) < 1e-6 && S.selR.length === 0`), await st('[S.marq, __daw.curPos()]'))
    ok('each of them one step back', await ev('return UNDO.length === 3')) }
  await ev(`while (UNDO.length) undoEdit(); S.selR = []; S.marq = null; pickTool('marquee'); jumpTo(0); __daw.redraw()`)
  // a marquee drawn somewhere else says where: the copy begins where that marquee begins
  await b.dragTo(g.x1, g.y, g.x3, g.y, 8); await b.sleep(60); await key('c', 'KeyC', 67, 4)
  {
    const dest = await ev(`const i = S.tracks.findIndex(x => x.name === ${JSON.stringify(name)}), t = S.tracks[i], free = t.regs.slice().sort((p, q) => p.a - q.a).reduce((at, r) => Math.max(at, r.b), 1); S.marq = { a: free + 1, b: free + 2, t0: i, t1: i }; __daw.redraw(); return free + 1`)      // (a marquee of one bar in the empty stretch after the track's last region)
    await key('v', 'KeyV', 86, 4)
    const now = await lane()
    ok('a marquee drawn somewhere else: the copy begins where that marquee begins', now.some(r => Math.abs(r[0] - (dest + 1)) < 1e-6 && Math.abs(r[1] - r[0] - 2) < 1e-6) && await st(`!!S.marq && Math.abs(S.marq.a - ${dest}) < 1e-6 && Math.abs(S.marq.b - ${dest + 2}) < 1e-6`), [now, await st('S.marq'), dest])
    await key('v', 'KeyV', 86, 4)
    ok('and pressed again, the next one follows it', (await lane()).some(r => Math.abs(r[0] - (dest + 3)) < 1e-6), await lane()) }
  // command r with a marquee: the same, without the clipboard — and what the clipboard held is still there
  await ev(`while (UNDO.length) undoEdit(); S.selR = []; S.marq = null; pickTool('pointer'); jumpTo(0); __daw.redraw()`)
  await b.click(g.x5, g.y); await key('c', 'KeyC', 67, 4)
  { const held = await ev('return JSON.stringify(CLIP.map(c => [c.r.a, c.r.b]))')
    await ev(`S.selR = []; pickTool('marquee'); __daw.redraw()`); await b.dragTo(g.x1, g.y, g.x3, g.y, 8); await b.sleep(60)
    for (let k = 0; k < 3; k++) await key('r', 'KeyR', 82, 4)
    const now = await lane(), at = k => g.a + 3 + 2 * k
    ok('command r three times with a marquee: the stretch said again, each right after the last', [0, 1, 2].every(k => now.some(r => Math.abs(r[0] - at(k)) < 1e-6 && Math.abs(r[1] - at(k) - 2) < 1e-6)) && await st(`!!S.marq && Math.abs(S.marq.a - ${g.a + 6}) < 1e-6 && Math.abs(S.marq.b - ${g.a + 8}) < 1e-6`) && await ev('return UNDO.length === 3'), [now, await st('S.marq')])
    ok('and the clipboard holds what it held', await ev('return JSON.stringify(CLIP.map(c => [c.r.a, c.r.b]))') === held && await ev('return !CLIP.rows'), await ev('return JSON.stringify(CLIP.map(c => [c.r.a, c.r.b]))')) }
  // copied from a marquee, then command r, then command v: the paste follows what command r put down
  await ev(`while (UNDO.length) undoEdit(); S.selR = []; S.marq = null; pickTool('marquee'); __daw.redraw()`)
  await b.dragTo(g.x1, g.y, g.x3, g.y, 8); await b.sleep(60); await key('c', 'KeyC', 67, 4); await key('r', 'KeyR', 82, 4); await key('v', 'KeyV', 86, 4)
  { const now = await lane(); ok('c, r, v: three stretches in a row', [g.a + 3, g.a + 5].every(x => now.some(r => Math.abs(r[0] - x) < 1e-6 && Math.abs(r[1] - x - 2) < 1e-6)) && await st(`!!S.marq && Math.abs(S.marq.a - ${g.a + 4}) < 1e-6`), [now, await st('S.marq')]) }
  await ev(`while (UNDO.length) undoEdit(); S.marq = null; pickTool('pointer'); jumpTo(0); __daw.redraw()`)
  await b.click(g.xm, g.y); await key('c', 'KeyC', 67, 4); await ev(`jumpTo(${far})`); await key('v', 'KeyV', 86, 4); await key('v', 'KeyV', 86, 4)
  { const now = await lane(), put = now.filter(r => r[0] >= far + 1 - 1e-6), len = g.b - g.a
    ok('a region copied as a region: put down twice, end to end, the last one chosen', put.length === 2 && Math.abs(put[1][0] - put[0][1]) < 1e-6 && Math.abs(put[0][1] - put[0][0] - len) < 1e-6 && put[1][2] === 1 && put[0][2] === 0 && await st('!S.marq'), now) }
  await ev(`while (UNDO.length) undoEdit(); S.selR = []; jumpTo(0); __daw.redraw()`)
  // with the lines showing, the delete key takes the lines' points in the marquee's stretch and never the sound (his ask, 2026-10-19)
  await ev(`pickTool('marquee'); S.auto = true; __daw.redraw()`); await b.dragTo(g.x1, g.y, g.x3, g.y, 8); await b.sleep(60)
  await key('Backspace', 'Backspace', 8)
  { const now = await lane(); ok('with the lines showing, a marquee and the delete key leave the sound', JSON.stringify(now) === JSON.stringify(was), [was, now]) }
  await ev(`while (UNDO.length) undoEdit(); S.auto = false; S.selR = []; S.marq = null; pickTool('pointer'); __daw.redraw()`)
  await ev(`S.selR = []; __daw.redraw()`)
}
ok('no errors on the page', (await ev('return window.__errs')).length === 0 && b.errors.length === 0, [await ev('return window.__errs'), b.errors])
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.shot(`t1-end-${W}x${H}.png`)
await b.close()
