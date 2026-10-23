// node test/lit.mjs — the transport panel says what was just changed and what is on (his ask, 2026-10-23; his pick of
// design/panel lit draft 1, two seconds): a region's transpose pulled by hand is boxed in the panel's ink, its name and value
// in its ground, and the box goes two seconds after; changed with no hand on it (a line of automation, a script), nothing;
// another region chosen, nothing; the tempo typed: boxed round its words, not its dial; click turned on: boxed for as long
// as it is on; bauhaus: a black box with paper words in its column, a paper box with black words in its foot. Real presses.
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined && !cond ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const mouse = (type, x, y, extra = {}) => b.send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' }, extra))
const pull = async (p, dx, dy) => { await b.sleep(300); await mouse('mouseMoved', p.x, p.y, { buttons: 0 }); await mouse('mousePressed', p.x, p.y); for (let k = 1; k <= 6; k++) await mouse('mouseMoved', p.x + dx * k / 6, p.y + dy * k / 6); await b.sleep(30); await mouse('mouseReleased', p.x + dx, p.y + dy); await b.sleep(150) }
const place = (a, last) => ev(`flush(); const h = [...document.querySelectorAll('#g-top [data-a="${a}"]')]; const e = h[${last ? 'h.length - 1' : 0}]; if (!e) return null; const q = e.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }`)
/* the boxes on the panel now: the words each holds, its fill, the fill of its words */
const boxes = () => ev(`flush(); await new Promise(r => setTimeout(r, 30)); return [...document.querySelectorAll('#g-top .lit')].map(g => ({ words: [...g.querySelectorAll('text')].map(t => t.textContent).join(' '), box: g.querySelector('rect').getAttribute('fill'), word: (g.querySelector('text') || g.querySelector('rect')).getAttribute('fill'), shapes: g.children.length - 1 - g.querySelectorAll('text').length }))`)
const has = (bs, w) => bs.find(x => x.words.includes(w))
await ev(`if (typeof START !== 'undefined') START.on = false; tpanelSet(true, false); S.rh = 60; S.auto = false; S.flex = false; S.click = false; S.lowLat = false; S.cycle.on = false
  const t = S.tracks.find(x => x.name === 'hum'); window.TI = S.tracks.indexOf(t); t.regs.sort((p, q) => p.a - q.a); window.RA = t.regs[0]; window.RB = t.regs[1]; RA.tr = 0
  S.sel = TI; S.selR = [RA.id]; S.focus = 'lanes'; dirtyAll(); flush(); return 1`)
ok('nothing changed, nothing on: no box', (await boxes()).length === 0, await boxes())

/* a region's transpose, pulled up by hand */
await pull(await place('rtr'), 0, -30)
{ const bs = await boxes(), x = has(bs, 'transpose'), ink = await ev(`return [INK, K2]`)
  ok('transpose pulled: boxed, its name and value in it', !!x && /transpose \+\d/.test(x.words) && bs.length === 1, bs)
  ok('…the box in the panel\'s ink, the words in its ground', !!x && x.box === ink[0] && x.word === ink[1], [x, ink]) }
await b.sleep(1300)
ok('…still there a second later', !!has(await boxes(), 'transpose'))
await b.sleep(1100)
await ev(`flush(); return 1`)
ok('…gone two seconds after it was changed', !has(await boxes(), 'transpose'), await boxes())

/* changed with no hand on it */
await b.sleep(800)
await ev(`RA.tr = 7; uiDirty('top'); flush(); return 1`)
ok('changed with no hand on it (a line, a script): no box', !has(await boxes(), 'transpose'), await boxes())
/* another region chosen: its own values, not changed */
await ev(`S.selR = [RB.id]; RB.tr = 3; uiDirty('top'); flush(); return 1`)
await pull(await place('rtr'), 0, 0)                                                     // (a press, no pull: a hand on the panel, nothing changed)
ok('another region chosen: nothing boxed', !has(await boxes(), 'transpose'), await boxes())

/* the tempo, typed where it stands: round its words, not its dial */
{ const t0 = await ev(`return S.tempo`); await pull(await place('tempo'), 0, 0)
  await ev(`const el = document.getElementById('rename'); el.select(); return 1`); await b.type('96'); await b.press('Enter', 'Enter', 13); await b.sleep(150)
  const bs = await boxes(), x = bs.find(q => /bpm/.test(q.words))
  ok('the tempo typed: boxed round its value and its word, its dial left out', await ev(`return S.tempo`) === 96 && !!x && x.shapes === 0, [bs, t0, await ev(`return S.tempo`)])
  await ev(`setTempo(${t0}); flush(); return 1`) }

/* click turned on: boxed for as long as it is on */
await b.sleep(2300)
await pull(await place('click'), 0, 0)
{ const bs = await boxes(); ok('click turned on: boxed, its light with it', !!has(bs, 'click') && has(bs, 'click').shapes >= 1, bs) }
await b.sleep(2400)
ok('…still boxed two seconds on (it is on)', !!has(await boxes(), 'click'), await boxes())
await pull(await place('click'), 0, 0)
await b.sleep(2300)
ok('…turned off: gone', !has(await boxes(), 'click'), await boxes())

/* bauhaus */
await ev(`applyLook(JSON.parse(JSON.stringify(THEMES.bauhaus))); fitRoom(); setView(true); S.selR = [RA.id]; S.focus = 'lanes'; dirtyAll(); flush(); return 1`); await b.sleep(400)
await pull(await place('click'), 0, 0)
{ const bs = await boxes(), x = has(bs, 'click'), c = await ev(`return BH`)
  ok('bauhaus, click on: a black box, its word in the paper', !!x && x.box === c.black && x.word === c.paper, [bs, c]) }
await pull(await place('rtr'), 0, -30)
{ const bs = await boxes(), x = bs.find(q => /TRANSPOSE|transpose/.test(q.words)), c = await ev(`return BH`)
  ok('bauhaus, transpose pulled in its black foot: a paper box, black words', !!x && x.box === c.paper && x.word === c.black, [bs, c]) }
await pull(await place('click'), 0, 0)
{ const errs = await ev(`return window.__errs || []`); ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close(); process.exit(bad.length ? 1 : 0)
