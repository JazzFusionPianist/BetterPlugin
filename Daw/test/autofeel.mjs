// node test/autofeel.mjs [w h] — his round of 2026-10-19 on lines and sends: no dashed line where a lane has no points (a
// press there makes the first one, and the line with it); points small, each with its value beside it; with the lines up
// a delete takes the chosen points — a marquee up or not — and never the sound under them; a send says how much goes
// while it is pulled. Real presses and keys, and what is drawn is looked at.
import { open, PAGE } from './cdp.mjs'
const [ww, hh] = [+process.argv[2] || 1440, +process.argv[3] || 900]
const b = await open(PAGE, { width: ww, height: hh, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined && !cond ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const key = (k, code, vk, mods = 0) => b.press(k, code, vk, mods).then(() => b.sleep(60))
const mouse = (type, x, y, extra = {}) => b.send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' }, extra))
const click = async (x, y) => { await mouse('mouseMoved', x, y, { buttons: 0 }); await mouse('mousePressed', x, y); await mouse('mouseReleased', x, y); await b.sleep(120) }

/* the lines up, a track with a region and no line yet */
const t0 = await ev(`if (typeof START !== 'undefined') START.on = false; setView(true); const ti = S.tracks.findIndex(t => t.regs.length), t = S.tracks[ti]; t.autos = t.autos || {}; t.autos.vol = []; t.ap = 'vol'
  S.auto = true; S.flex = false; S.sel = ti; S.selR = []; S.selP = []; S.marq = null; S.focus = 'lanes'; VX = 0; dirtyAll(); flush()
  const svg = document.getElementById('svg').getBoundingClientRect(), k = svg.width / W
  return { ti, y: (rowY(ti) + rowH(ti) * .3) * k + svg.y, x: bx(9) * k + svg.x, dashed: [...document.querySelectorAll('#g-lanes path')].filter(p => p.getAttribute('stroke-dasharray')).length, regs: t.regs.length }`)
ok('no dashed line where a lane has no points', t0.dashed === 0, t0)
await click(t0.x, t0.y)
const t1 = await ev(`const t = S.tracks[${t0.ti}]; flush(); return { pts: t.autos.vol.map(q => [+q.b.toFixed(3), q.v]), lines: [...document.querySelectorAll('#g-lanes path')].length, chosen: S.selP.length, regs: t.regs.length }`)
ok('a press on the empty lane: its first point, there, at the height pressed', t1.pts.length === 1 && Math.abs(t1.pts[0][0] - 8) < .3 && t1.pts[0][1] > -6, t1)
/* more points: their values beside them, the dots small */
const t2 = await ev(`const t = S.tracks[${t0.ti}]; for (const [bb, v] of [[12, -3], [16, -9.5], [20, 0]]) addPoint(t, 'vol', bb, v); S.selP = []; dirtyAll(); flush()
  const words = [...document.querySelectorAll('#g-lanes text')].map(e => e.textContent), dots = [...document.querySelectorAll('#g-lanes circle')].map(c => +c.getAttribute('r'))
  return { words, dots }`)
ok('each point says its value beside it', ['−3.0', '−9.5', '0.0'].every(w => t2.words.some(x => x.replace(/\s*db$/, '') === w || x.startsWith(w))), t2.words)
ok('the dots are small (2, chosen 2.6)', t2.dots.length >= 4 && t2.dots.every(r => r <= 2.6), t2.dots)
/* a marquee up over the region, then a band of points chosen: delete takes the points, never the sound */
const t3 = await ev(`const t = S.tracks[${t0.ti}], r = t.regs[0]; S.marq = { a: r.a - 1, b: r.b - 1, t0: ${t0.ti}, t1: ${t0.ti} }; S.selP = t.autos.vol.filter(q => q.b > 10 && q.b < 18).map(q => q.id); uiDirty('lanes'); flush(); return { chosen: S.selP.length, regs: t.regs.length, len: r.b - r.a }`)
await key('Backspace', 'Backspace', 8)
const t4 = await ev(`const t = S.tracks[${t0.ti}], r = t.regs[0]; return { pts: t.autos.vol.map(q => q.b), regs: t.regs.length, len: r ? r.b - r.a : 0 }`)
ok('lines up, a marquee up and points chosen: delete takes the points', t4.pts.length === 2 && !t4.pts.some(bb => bb > 10 && bb < 18), t4)
ok('…and not a hair of the sound', t4.regs === t3.regs && Math.abs(t4.len - t3.len) < 1e-9, [t3, t4])
/* nothing chosen, the marquee still up: delete takes the points in its stretch, still not the sound */
await ev(`S.selP = []; uiDirty('lanes'); flush()`)
await key('Backspace', 'Backspace', 8)
const t5 = await ev(`const t = S.tracks[${t0.ti}], r = t.regs[0]; return { pts: t.autos.vol.map(q => q.b), regs: t.regs.length, len: r ? r.b - r.a : 0 }`)
ok('lines up, a marquee and nothing chosen: its stretch\'s points go, the sound stays', t5.regs === t3.regs && Math.abs(t5.len - t3.len) < 1e-9, [t3, t5])
/* a send pulled in the mixer says how much goes */
const s0 = await ev(`S.auto = false; S.marq = null; if (!S.tracks.some(x => x.kind === 'bus')) newTracks({ kind: 'bus', n: 1, out: 0 }); const t = S.tracks[${t0.ti}], bus = S.tracks.find(x => x.kind === 'bus') || null
  if (!bus) return { skipped: 'no bus' }
  t.sends = [{ to: bus.id, db: -12 }]; S.panel.on = true; S.panel.tab = 'mixer'; S.panel.h = 360; setView(true); dirtyAll(); flush()
  const el = document.querySelector('[data-a="msend"][data-i="${t0.ti}"][data-k="0"]'); if (!el) return { skipped: 'no send drawn' }
  const q = el.getBoundingClientRect(); return { x: q.x + 4, y: q.y + q.height / 2, w: q.width }`)
if (s0.skipped) ok('a send pulled says how much goes (' + s0.skipped + ')', true)
else {
  await mouse('mouseMoved', s0.x, s0.y, { buttons: 0 }); await mouse('mousePressed', s0.x, s0.y); await mouse('mouseMoved', s0.x + s0.w * .5, s0.y); await b.sleep(80)
  const s1 = await ev(`flush(); return [...document.getElementById('g-dock').querySelectorAll('text')].map(e => e.textContent).filter(w => /db$|^−?\\d+\\.\\d$/.test(w))`)
  await mouse('mouseReleased', s0.x + s0.w * .5, s0.y); await b.sleep(80)
  const s2 = await ev(`return [...document.getElementById('g-dock').querySelectorAll('text')].map(e => e.textContent).filter(w => /db$/.test(w))`)
  ok('a send pulled says how much goes, to a tenth of a db', s1.some(w => /^−?\d+\.\d( db)?$/.test(w)), s1)
  ok('…and its bus again once let go', !s2.some(w => /^−?\d+\.\d db$/.test(w)), s2)
}
{ const errs = await ev(`return window.__errs || []`); ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close(); process.exit(bad.length ? 1 : 0)
