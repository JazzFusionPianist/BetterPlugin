// node test/widgets.mjs — widgets (ui/widgets.js): controls and marks a theme places anywhere, drawn over the room and
// pressed as the room's own. A theme with the transport taken out and its functions laid as widgets: the buttons play,
// stop, go to the start and cycle; a readout of the position runs; a knob turns the out; a lamp lights while playing; a
// button does a menu line; text and a shape are drawn; the widgets follow their pins when the window changes.
import { open, PAGE } from './cdp.mjs'
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const WIDGETS = [
  { id: 'a', is: 'button', does: 'play', at: [40, 40, 60, 28, 0, 0, 0, 0] }, { id: 'b', is: 'button', does: 'stop', at: [110, 40, 60, 28, 0, 0, 0, 0] },
  { id: 'c', is: 'button', does: 'tostart', at: [180, 40, 60, 28, 0, 0, 0, 0] }, { id: 'd', is: 'button', does: 'loop', at: [250, 40, 60, 28, 0, 0, 0, 0] },
  { id: 'e', is: 'readout', shows: 'position', at: [40, 80, 200, 36, 0, 0, 0, 0], size: 22 }, { id: 'f', is: 'knob', does: 'master', at: [40, 130, 80, 80, 0, 0, 0, 0] },
  { id: 'g', is: 'lamp', shows: 'playing', label: 'playing', at: [140, 130, 90, 18, 0, 0, 0, 0] }, { id: 'h', is: 'button', does: 'menu:winmixer', label: 'mixer', at: [320, 40, 70, 28, 0, 0, 0, 0] },
  { id: 'i', is: 'text', label: 'hello', at: [140, 160, 100, 20, 0, 0, 0, 0], size: 14 }, { id: 'j', is: 'shape', shape: 'disc', fill: '#D8B24A', at: [140, 190, 30, 30, 0, 0, 0, 0] },
  { id: 'k', is: 'meter', at: [1680, 40, 24, 200, 1, 0, 1, 0] }, { id: 'l', is: 'readout', shows: 'tempo', at: [1540, 40, 120, 28, 1, 0, 1, 0] },
]
const b = await open(PAGE, { width: 1728, height: 1117, dsf: 1 })
await b.sleep(600)
await b.ev(`if (typeof START !== 'undefined') START.on = false; S.rh = 36; setZoom(26, 0); VX = 0; VY = 0; S.panel.on = false; INSP.on = false; tpanelSet(true, false); setView(true); dirtyAll(); flush()
  const doc = boxWrite(); delete doc['box.transport']; doc.widgets = JSON.stringify(${JSON.stringify(WIDGETS)})
  applyLook(doc); setView(true); dirtyAll(); flush(); return 1`)
await b.sleep(400)
const up = await ev_(`return { left: SKV.left, bar: BAR_H, X0, n: document.querySelectorAll('#g-widgets [data-wg]').length, play: !!document.querySelector('#g-widgets [data-a="play"]'), menu: !!document.querySelector('#g-widgets [data-a="wg"][data-id="h"]') }`)
ok('the transport taken out, twelve widgets drawn over the room, the play button a press of play, the mixer button its own', up.left === 0 && up.bar === 0 && up.n === 12 && up.play && up.menu, up)
const at = async sel => ev_(`const e = document.querySelector(${JSON.stringify(sel)}), r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }`)
/* play, the lamp, the readout, stop */
let p = await at('#g-widgets [data-a="play"]'); await b.click(p.x, p.y); await b.sleep(500)
const playing = await ev_(`flush(); WG.frame(); return { playing: S.playing, lamp: document.getElementById('wg-g') && document.getElementById('wg-g').getAttribute('fill'), text: document.getElementById('wg-e') && document.getElementById('wg-e').textContent, pos: place(curPos()) }`)
const beat = s => String(s).split('.').slice(0, 3).join('.')      // (bar . beat . division: the ticks run on between two readings)
ok('the play button pressed: the song runs, the lamp lit, the readout at the position', playing.playing && playing.lamp && playing.lamp !== 'none' && beat(playing.text) === beat(playing.pos), playing)
await b.sleep(400)
const later = await ev_(`WG.frame(); return { text: document.getElementById('wg-e').textContent, pos: place(curPos()) }`)
ok('…a moment on: the readout has moved with the song', beat(later.text) === beat(later.pos) && later.text !== playing.text, { was: playing.text, now: later })
p = await at('#g-widgets [data-a="stop"]'); await b.click(p.x, p.y); await b.sleep(200)
ok('stop pressed: the song stops, the lamp dark', !(await ev_(`return S.playing`)) && (await ev_(`flush(); const e = document.getElementById('wg-g'); return e.getAttribute('fill')`)) === 'none')
/* to the start, the cycle */
await ev_(`jumpTo(8); return 1`); p = await at('#g-widgets [data-a="tostart"]'); await b.click(p.x, p.y); await b.sleep(150)
ok('to the start pressed: the playhead at the start', (await ev_(`return curPos()`)) === 0)
const cyc0 = await ev_(`return !!S.cycle.on`); p = await at('#g-widgets [data-a="loop"]'); await b.click(p.x, p.y); await b.sleep(150)
ok('the cycle button pressed: the cycle turned', (await ev_(`return !!S.cycle.on`)) !== cyc0)
/* the knob of the out */
const m0 = await ev_(`return S.master`); p = await at('#g-widgets [data-a="master"]')
await b.dragTo(p.x, p.y, p.x, p.y - 40, 8); await b.sleep(200)
const m1 = await ev_(`return S.master`)
ok('the knob pulled up: the out louder', m1 > m0, { m0, m1 })
await ev_(`S.master = 0; pushMaster(); return 1`)
/* a menu line as a button */
p = await at('#g-widgets [data-a="wg"][data-id="h"]'); await b.click(p.x, p.y); await b.sleep(250)
ok('the mixer button pressed: the mixer opens', await ev_(`return S.panel.on && S.panel.tab === 'mixer'`), await ev_(`return [S.panel.on, S.panel.tab]`))
await ev_(`S.panel.on = false; setView(true); dirtyAll(); flush(); return 1`)
/* text, the shape, the tempo readout */
const marks = await ev_(`flush(); const t = [...document.querySelectorAll('#g-widgets text')].find(e => e.textContent === 'hello'), d = document.querySelector('#g-widgets [data-wg="j"] circle'); return { hello: !!t, size: t && t.getAttribute('font-size'), disc: d && d.getAttribute('fill'), tempo: document.getElementById('wg-l') && document.getElementById('wg-l').textContent }`)
ok('text, a disc in its colour, the tempo read', marks.hello && +marks.size === 14 && marks.disc === '#D8B24A' && /^\d+\.\d\d$/.test(marks.tempo), marks)
/* pins: the meter at the right edge follows the window */
const r0 = await ev_(`return wgRect(wgList().find(w => w.id === 'k')).x0`)
await b.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }); await b.sleep(400)
await ev_(`fitRoom(); flush(); return 1`)
const r1 = await ev_(`return { x: wgRect(wgList().find(w => w.id === 'k')).x0, W: W + SKV.left, drawn: !!document.querySelector('#g-widgets [data-wg="k"]') }`)
ok('a smaller window: the meter pinned to the right edge moved with it', r1.W === 1440 && Math.abs(r1.x - (r0 - 288)) < .5 && r1.drawn, { r0, r1 })
ok('nothing went wrong on the page', !(await ev_(`return (window.__errs || []).length`)) && !b.errors.length, [await ev_(`return window.__errs`), b.errors.slice(0, 2)])
await b.close()
console.log(out.join('\n'))
console.log(bad.length ? `widgets: ${bad.length} FAILED\n  ${bad.join('\n  ')}` : 'widgets: all passed')
process.exit(bad.length ? 1 : 0)
function ev_ (js) { return b.ev(js) }
