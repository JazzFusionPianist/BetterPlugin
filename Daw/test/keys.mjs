// node test/keys.mjs [w h] — the keyboard's sheet (command k): it comes up over the lower left of the lanes and names the
// track that hears it; a letter held lights its key, z x c v tab 1 2 3–8 move what they move; the pointer does the same
// on the sheet; a press on the sheet goes no further; it is put away again. Real keys and a real pointer.
import { open, PAGE } from './cdp.mjs'
const [w, h] = [+process.argv[2] || 1440, +process.argv[3] || 900]
const b = await open(PAGE, { width: w, height: h, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const VK = { KeyA: 65, KeyG: 71, KeyW: 87, KeyK: 75, KeyX: 88, KeyZ: 90, KeyC: 67, KeyV: 86, Tab: 9, Digit1: 49, Digit2: 50, Digit5: 53 }
const down = (key, code, modifiers = 0) => b.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode: VK[code], modifiers })
const up = (key, code, modifiers = 0) => b.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: VK[code], modifiers })
const tap = async (key, code, modifiers = 0) => { await down(key, code, modifiers); await up(key, code, modifiers); await b.sleep(40) }
const at = (sel, fx = .5, fy = .5) => ev(`flush(); const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; const r = el.getBoundingClientRect(), x = r.left + r.width * ${fx}, y = r.top + r.height * ${fy}; return { x, y, hit: document.elementFromPoint(x, y) === el }`)
const state = () => ev(`flush(); return { on: TYPE.on, oct: TYPE.oct, vel: TYPE.vel, ped: TYPE.ped, bend: TYPE.bend, mod: TYPE.mod, down: [...TYPE.down.entries()], drawn: document.getElementById('g-keys').innerHTML.length, text: document.getElementById('g-keys').textContent }`)

await ev(`const t = newInstTrack('synth', 'e piano'); t.name = 'rhodes'; setView(true); repaint(); dirtyAll(); flush()`)
ok('before command k nothing of it is drawn', (await state()).drawn === 0)
await tap('k', 'KeyK', 4)
{ const s = await state()
  ok('command k: the sheet is up, and names the track that hears it', s.on && s.drawn > 1000 && s.text.includes('keyboard') && s.text.includes('rhodes'), s.text.slice(0, 60))
  ok('the foot says so too', await ev(`return document.getElementById('g-cmd').textContent.includes('keyboard')`)) }
{ const r = await ev(`const el = document.querySelector('[data-a="kb"][data-k="none"]').getBoundingClientRect(), bd = document.getElementById('board').getBoundingClientRect(), k = bd.width / W; return { l: (el.left - bd.left) / k, t: (el.top - bd.top) / k, r: (el.right - bd.left) / k, b: (el.bottom - bd.top) / k, X0, TY, BY, RX }`)
  ok('it lies on the lanes, inside them', r.l >= r.X0 && r.r <= r.RX && r.t >= r.TY && r.b <= r.BY, r) }
// a letter held
await down('a', 'KeyA'); await b.sleep(40)
{ const s = await state(), lit = await ev(`const t = S.tracks[S.sel]; return document.getElementById('g-keys').innerHTML.includes('fill="' + t.c + '"')`)
  ok('a held: its key is down and lit in the track\'s pigment', s.down.length === 1 && s.down[0][1] === 60 && lit, s.down) }
await up('a', 'KeyA'); await b.sleep(40)
ok('let go: up again', (await state()).down.length === 0)
await tap('x', 'KeyX'); ok('x: an octave up, and the sheet says from where', (await state()).oct === 6 && (await state()).text.includes('c4'), (await state()).oct)
await tap('z', 'KeyZ'); ok('z: back down', (await state()).oct === 5)
await tap('v', 'KeyV'); ok('v: harder', (await state()).vel === 110)
await tap('c', 'KeyC'); ok('c: softer', (await state()).vel === 100)
await down('Tab', 'Tab'); await b.sleep(40); ok('tab held: the pedal', (await state()).ped === true)
await up('Tab', 'Tab'); await b.sleep(40); ok('let go: no pedal', (await state()).ped === false)
await down('2', 'Digit2'); await b.sleep(40); ok('2 held: bent up', (await state()).bend === 1)
await up('2', 'Digit2'); await b.sleep(40); ok('let go: straight', (await state()).bend === 0)
await tap('5', 'Digit5'); ok('5: the wheel\'s third cell', (await state()).mod === 2)
// the pointer on the sheet
{ const p = await at('[data-a="kb"][data-k="key"][data-v="7"]', .5, .8)
  ok('a white key can be reached', !!p && p.hit)
  const sel0 = await ev('return JSON.stringify([S.sel, S.selR])')
  await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y, buttons: 0 }); await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', buttons: 1, clickCount: 1 }); await b.sleep(50)
  const s = await state()
  ok('pressed with the pointer: the key is down while the button is', s.down.length === 1 && s.down[0][0] === 'pointer' && s.down[0][1] === 67, s.down)
  await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', buttons: 0, clickCount: 1 }); await b.sleep(50)
  ok('let go: up', (await state()).down.length === 0)
  ok('a press on the sheet goes no further: what was chosen under it is as it was', (await ev('return JSON.stringify([S.sel, S.selR])')) === sel0) }
{ const p = await at('[data-a="kb"][data-k="key"][data-v="1"]', .5, .4)
  ok('a black key lies over the white ones', !!p && p.hit)
  await b.click(p.x, p.y); await b.sleep(40); ok('and a click on it leaves nothing held', (await state()).down.length === 0) }
{ const p = await at('[data-a="kb"][data-k="oct"][data-v="1"]'); await b.click(p.x, p.y); await b.sleep(40); ok('the x on the sheet: an octave up', (await state()).oct === 6)
  const q = await at('[data-a="kb"][data-k="oct"][data-v="-1"]'); await b.click(q.x, q.y); await b.sleep(40); ok('the z: back', (await state()).oct === 5) }
{ const p = await at('[data-a="kb"][data-k="vel"][data-v="-10"]'); await b.click(p.x, p.y); await b.sleep(40); ok('the c on the sheet: softer', (await state()).vel === 90) }
{ const p = await at('[data-a="kb"][data-k="ped"]'); await b.click(p.x, p.y); await b.sleep(40); ok('tab on the sheet: the pedal stays down', (await state()).ped === true)
  const q = await at('[data-a="kb"][data-k="ped"]'); await b.click(q.x, q.y); await b.sleep(40); ok('again: let go', (await state()).ped === false) }
{ const p = await at('[data-a="kb"][data-k="mod"][data-v="5"]'); await b.click(p.x, p.y); await b.sleep(40); ok('the 8 on the sheet: the wheel all the way', (await state()).mod === 5) }
// a track of sound chosen, none armed: the sheet says nobody hears it
await ev(`leadTrack(0); uiDirty('head', 'dock'); flush()`)
ok('with a track of sound chosen it says no track of notes is', (await state()).text.includes('no track of notes is chosen'))
await ev(`leadTrack(S.tracks.findIndex(isInst)); uiDirty('head', 'dock'); flush()`)
ok('back on the track of notes it names it again', (await state()).text.includes('rhodes'))
// with the panel open the sheet moves up with the lanes' lower edge
{ const y0 = await ev(`return document.querySelector('[data-a="kb"][data-k="none"]').getBoundingClientRect().bottom`)
  await ev(`togglePanel('mixer'); setView(true); relayout(); dirtyAll(); flush()`)
  const r = await ev(`const el = document.querySelector('[data-a="kb"][data-k="none"]').getBoundingClientRect(), bd = document.getElementById('board').getBoundingClientRect(), k = bd.width / W; return { t: (el.top - bd.top) / k, b: (el.bottom - bd.top) / k, TY, BY, y: el.bottom }`)
  ok('the panel opened: the sheet stands above it, still on the lanes', r.b <= r.BY && r.t >= r.TY && (r.y < y0 || r.t <= r.TY + 5), r)
  await ev(`togglePanel('mixer'); setView(true); relayout(); dirtyAll(); flush()`) }
// put away
{ const p = await at('[data-a="kb"][data-k="close"]'); await b.click(p.x, p.y); await b.sleep(40)
  const s = await state(); ok('its own key puts it away', !s.on && s.drawn === 0) }
await tap('k', 'KeyK', 4); ok('command k brings it back', (await state()).on && (await state()).drawn > 1000)
await tap('k', 'KeyK', 4); ok('and puts it away', !(await state()).on && (await state()).drawn === 0)
ok('no errors on the page', (await ev('return window.__errs')).length === 0 && b.errors.length === 0, [await ev('return window.__errs'), b.errors])
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close()
