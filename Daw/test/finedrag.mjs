// node test/finedrag.mjs — control held while pulling goes a quarter as far as the hand (his ask, 2026-10-21): a track's
// fader in its head, the strip's fader in the transport panel, a send's knob in the mixer (no list opens), a point of a
// line, a region moved along the song; control let go halfway, it goes on from where it got to (no jump); a band and the
// zoom tool still follow the hand (control and shift together, the fade tool, are fades.mjs's and fadekeys.mjs's). Real
// presses with real modifiers.
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(600)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined && !cond ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const CTRL = 2
const mouse = (type, x, y, extra = {}) => b.send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' }, extra))
/* a pull: pressed, moved in steps, let go; mods for each step (a function of the step) */
const pull = async (x0, y0, dx, dy, mods = () => 0, steps = 12) => {
  await mouse('mouseMoved', x0, y0, { buttons: 0, modifiers: mods(0) }); await mouse('mousePressed', x0, y0, { modifiers: mods(0) })
  for (let k = 1; k <= steps; k++) await mouse('mouseMoved', x0 + dx * k / steps, y0 + dy * k / steps, { modifiers: mods(k) })
  await b.sleep(30); await mouse('mouseReleased', x0 + dx, y0 + dy, { modifiers: mods(steps) }); await b.sleep(120)
}
const box = sel => ev(`flush(); const el = document.querySelector('${sel}'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, l: r.x, r: r.right }`)
const near = (a, b2, tol) => Math.abs(a - b2) <= tol

await ev(`if (typeof START !== 'undefined') START.on = false; tpanelSet(true, false); S.panel.on = false; S.auto = false; S.tool = 'pointer'; setView(true); dirtyAll(); flush(); return 1`)
const V12 = await ev(`return volF(-12)`), V20 = await ev(`return volF(-20)`)

/* a track's fader in its head: pulled across a little (it is short), with control from where it stands */
{ const ti = await ev(`return S.tracks.findIndex(t => t.name === 'snare')`)
  const f = () => ev(`return volF(S.tracks[${ti}].vol)`)
  const set = v => ev(`S.tracks[${ti}].vol = ${v}; dirtyAll(); flush(); return 1`)
  await set(-12); const h = await box(`#g-head [data-a="vol"][data-i="${ti}"]`)
  const g = await ev(`const el = document.querySelector('#g-head [data-a="vol"][data-i="${ti}"]'), b0 = board.getBoundingClientRect(), kk = b0.width / (W + (SKV.left || 0)); return { hx: (+el.dataset.gx + +el.dataset.gw * volF(S.tracks[${ti}].vol) + (SKV.left || 0)) * kk + b0.left, per: 1 / (+el.dataset.gw * kk) }`)
  await pull(g.hx, h.y, 12, 0); const plain = await f() - V12
  await set(-12); await pull(g.hx, h.y, 12, 0, () => CTRL); const fine = await f() - V12
  ok('a track\'s fader: plain, as far as the hand; with control, a quarter as far', near(plain, 12 * g.per, .03) && near(fine, 3 * g.per, .015), { plain, fine, want: [12 * g.per, 3 * g.per] })
  /* control let go halfway: no jump, and the rest as far as the hand */
  await set(-12); await pull(g.hx, h.y, 12, 0, k => k <= 6 ? CTRL : 0); const half = await f() - V12
  ok('…control let go halfway: on from where it got to, the rest as far as the hand', near(half, 7.5 * g.per, .02), { half, want: 7.5 * g.per }) }

/* the strip's fader in the transport panel: pulled up */
{ const f = () => ev(`return volF(S.tracks[S.sel].vol)`), set = v => ev(`S.tracks[S.sel].vol = ${v}; dirtyAll(); flush(); return 1`)
  await set(-12); let v = await box('#tp-col [data-a="tps-vol"]'); await pull(v.x, v.y, 0, -40); const plain = await f() - V12
  await set(-12); v = await box('#tp-col [data-a="tps-vol"]'); await pull(v.x, v.y, 0, -40, () => CTRL); const fine = await f() - V12
  ok('the strip\'s fader in the panel: with control, a quarter as far', plain > .02 && near(fine / plain, .25, .08), { plain, fine }) }

/* a send's knob in the mixer: no list, and a quarter as far */
{ await ev(`const tr = k => S.tracks.find(x => x.name === k), bus = mkTrack('verb', null, null, null, null, 0, [], NO_PATCH()); bus.kind = 'bus'; S.tracks.push(bus); tr('keys').sends = [{ to: bus.id, db: -20 }]; if (typeof repaint === 'function') repaint(); S.panel.on = true; S.panel.tab = 'mixer'; S.panel.h = 420; setView(true); dirtyAll(); flush(); return 1`)
  const db = () => ev(`return volF(S.tracks.find(x => x.name === 'keys').sends[0].db)`), set = v => ev(`S.tracks.find(x => x.name === 'keys').sends[0].db = ${v}; S.menu = null; dirtyAll(); flush(); return 1`)
  const ki = await ev(`return S.tracks.findIndex(x => x.name === 'keys')`)
  await set(-20); let k = await box(`#g-dock [data-a="mp-send"][data-i="${ki}"]`); await pull(k.x, k.y, 0, -40); const plain = await db() - V20
  await set(-20); k = await box(`#g-dock [data-a="mp-send"][data-i="${ki}"]`); await pull(k.x, k.y, 0, -40, () => CTRL); const fine = await db() - V20, menu = await ev(`return !!S.menu`)
  ok('a send\'s knob in the mixer: with control, a quarter as far, and no list opens', plain > .05 && near(fine / plain, .25, .08) && !menu, { plain, fine, menu })
  await ev(`S.menu = null; S.panel.on = false; setView(true); dirtyAll(); flush(); return 1`) }

/* a point of a line: pulled up */
{ await ev(`S.auto = true; const t = S.tracks.find(x => x.name === 'hum'); t.ap = 'vol'; t.autos = {}; addPoint(t, 'vol', 10, -12); window.HI = S.tracks.indexOf(t); dirtyAll(); flush(); return 1`)
  const pv = () => ev(`return AUTO.vol.f(S.tracks[HI].autos.vol[0].v)`), at = () => ev(`flush(); const t = S.tracks[HI], g = autoGeom(t, rowY(HI), rowH(HI)), q = t.autos.vol[0], b0 = board.getBoundingClientRect(), k = b0.width / (W + (SKV.left || 0)); return { x: b0.left + (bx(q.b + 1) + (SKV.left || 0)) * k, y: b0.top + g.yOf(q.v) * k }`)
  const reset = () => ev(`const t = S.tracks[HI]; t.autos = {}; addPoint(t, 'vol', 10, -12); S.selP = []; dirtyAll(); flush(); return 1`)
  const f0 = await pv(); let p = await at(); await pull(p.x, p.y, 0, -12); const plain = await pv() - f0
  await reset(); p = await at(); await pull(p.x, p.y, 0, -12, () => CTRL); const fine = await pv() - f0
  ok('a point of a line: with control, a quarter as far', plain > .02 && near(fine / plain, .25, .1), { plain, fine })
  await ev(`S.auto = false; S.selP = []; dirtyAll(); flush(); return 1`) }

/* a region moved along the song */
{ const ri = await ev(`const t = S.tracks.find(x => x.name === 'guitar'), r = t.regs[0]; window.RG = r.id; return S.tracks.indexOf(t)`)
  const a = () => ev(`return regOf(RG)[0].a`), at = () => ev(`flush(); const [r] = regOf(RG), ti = S.tracks.findIndex(t => t.regs.includes(r)), b0 = board.getBoundingClientRect(), k = b0.width / (W + (SKV.left || 0)); return { x: b0.left + (bx(r.a) + 30 + (SKV.left || 0)) * k, y: b0.top + (rowY(ti) + rowH(ti) * .55) * k }`)
  const a0 = await a(); let p = await at(); await pull(p.x, p.y, 160, 0); const plain = await a() - a0
  await ev(`undoEdit(); S.selR = []; dirtyAll(); flush(); return 1`)
  p = await at(); await pull(p.x, p.y, 160, 0, () => CTRL); const fine = await a() - a0
  ok('a region moved: with control, a good deal less far (a quarter, on the finer grid)', plain > .5 && fine > 0 && fine / plain < .45, { plain, fine })
  await ev(`undoEdit(); S.selR = []; dirtyAll(); flush(); return 1`) }

/* a band follows the hand */
{ const p = await ev(`flush(); const ti = S.tracks.findIndex(t => t.name === 'kick'), b0 = board.getBoundingClientRect(), k = b0.width / (W + (SKV.left || 0)); return { x: b0.left + (bx(2.2) + (SKV.left || 0)) * k, y: b0.top + (rowY(ti) + 4) * k, k }`)
  await mouse('mouseMoved', p.x, p.y, { buttons: 0, modifiers: CTRL }); await mouse('mousePressed', p.x, p.y, { modifiers: CTRL })
  for (let k = 1; k <= 8; k++) await mouse('mouseMoved', p.x + 80 * k / 8, p.y + 60 * k / 8, { modifiers: CTRL })
  const band = await ev(`return S.band ? { w: S.band.x1 - S.band.x0, h: S.band.y1 - S.band.y0 } : null`)
  await mouse('mouseReleased', p.x + 80, p.y + 60, { modifiers: CTRL }); await b.sleep(100)
  ok('a band drawn with control held: it follows the hand', !!band && near(band.w, 80 / p.k, 4) && near(band.h, 60 / p.k, 4), [band, p.k])
  await ev(`S.selR = []; S.band = null; dirtyAll(); flush(); return 1`) }
{ const errs = await ev(`return window.__errs || []`); ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close(); process.exit(bad.length ? 1 : 0)
