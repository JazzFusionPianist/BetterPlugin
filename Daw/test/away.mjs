// node test/away.mjs — the window and the playhead while the song plays: the page turns with the playhead as it did; scrolled
// away by hand, the window stays where it was put and the song plays on out of sight; a bar key, a press that sends the
// playhead somewhere, and ` bring the window back to it; started again, it follows again. And the bar keys while the song
// plays: pressed several times quickly (or held), each press is one more bar, back as well as on.
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const key = async (k, code, vk, mods = 0, repeat = false) => { await b.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: k, code, windowsVirtualKeyCode: vk, modifiers: mods, autoRepeat: repeat }); await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk, modifiers: mods }) }
const see = () => ev(`const p = curPos(), span = (X1 - X0) / PXB; return { p: +p.toFixed(2), vx: +VX.toFixed(2), span: +span.toFixed(2), in: p >= VX - .05 && p <= VX + span + .05, away: !!S.away, playing: S.playing }`)
await ev(`if (typeof START !== 'undefined') START.on = false; setView(true); S.cycle.on = false; S.tempo = 240; setZoom(200, 2); VX = 0; dirtyAll(); flush()`)
const m = await ev(`const k = board.getBoundingClientRect().width / W; return { x: (X0 + 300) * k, y: (TY + 80) * k }`)
await ev(`play(1)`); await b.sleep(600)
const s0 = await see()
ok('the song plays and the playhead is in the window', s0.playing && s0.in, s0)
/* it turns the page by itself */
await ev(`jumpTo(VX + (X1 - X0) / PXB - .3)`); await b.sleep(900)
const s1 = await see()
ok('the playhead runs off the right edge: the page turns with it', s1.in && s1.vx > s0.vx + 1 && !s1.away, [s0, s1])
/* scrolled away by hand */
for (let k = 0; k < 6; k++) await b.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: m.x, y: m.y, deltaX: 400, deltaY: 0 })
await b.sleep(300)
const s2 = await see()
ok('scrolled on by hand while it plays: the window is where it was put, the playhead out of sight', !s2.in && s2.vx > s1.vx + 2 && s2.away && s2.playing, [s1, s2])
await b.sleep(900)
const s3 = await see()
ok('…and it stays there (it does not go back to the playhead)', s3.vx === s2.vx && !s3.in && s3.p > s2.p, [s2, s3])
/* ` finds the playhead again */
await key('`', 'Backquote', 192); await b.sleep(200)
const s4 = await see()
ok('`: the window is brought to the playhead, and goes with it again', s4.in && !s4.away, s4)
/* away again, then a bar key */
for (let k = 0; k < 6; k++) await b.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: m.x, y: m.y, deltaX: 400, deltaY: 0 })
await b.sleep(250)
ok('away again', (await see()).away && !(await see()).in)
await key('.', 'Period', 190); await b.sleep(350)
const s5 = await see()
ok('a bar key sends the playhead on: the window goes with it again', s5.in && !s5.away, s5)
/* stopped and started */
for (let k = 0; k < 6; k++) await b.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: m.x, y: m.y, deltaX: 400, deltaY: 0 })
await b.sleep(250)
await key(' ', 'Space', 32); await b.sleep(200); await key(' ', 'Space', 32); await b.sleep(500)
const s6 = await see()
ok('stopped and started again: it follows again', s6.playing && s6.in && !s6.away, s6)

/* the bar keys while it plays */
await ev(`S.tempo = 60; jumpTo(20.4)`); await b.sleep(300)
for (let k = 0; k < 4; k++) { await key('.', 'Period', 190, 0, k > 0); await b.sleep(40) }
await b.sleep(250)
const f = await see()
ok('. four times quickly while it plays: four bars on', f.p >= 24 && f.p < 24.6, f.p)
await ev(`jumpTo(20.4)`); await b.sleep(900)
for (let k = 0; k < 4; k++) { await key(',', 'Comma', 188, 0, k > 0); await b.sleep(40) }
await b.sleep(250)
const g = await see()
ok(', four times quickly while it plays: the start of the bar, then three more back', g.p >= 17 && g.p < 17.6, g.p)
await b.sleep(800)
await key(',', 'Comma', 188); await b.sleep(200)
const h = await see()
ok(', once more, well into the bar: back to the start of that bar', h.p >= 17 && h.p < 17.5, h.p)
await key(',', 'Comma', 188); await b.sleep(200)
const h2 = await see()
ok('…and again at once: the bar before', h2.p >= 16 && h2.p < 16.5, h2.p)
await ev(`halt(true); S.tempo = 92`)
await ev(`S.pos = 10.5; flush()`); await key(',', 'Comma', 188); await b.sleep(900); await key(',', 'Comma', 188); await b.sleep(80)
ok('stopped, it is as it was: the start of the bar, then the bar before', (await see()).p === 9, (await see()).p)
{ const errs = await ev(`return window.__errs || []`)
  ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n'))
console.log(bad.length ? `away: ${bad.length} FAILED\n  ${bad.join('\n  ')}` : 'away: all passed')
await b.close()
process.exit(bad.length ? 1 : 0)
