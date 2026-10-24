// node test/colside.mjs — the transport panel at the left or the right of the window (his ask, 2026-10-24: picked in settings >
// display, its inside as it is): the quality is offered with the parts' shapes; at the right the column stands against the
// window's right edge and the room begins at its left edge; its inside is the same, only moved; a press on its play, on a
// region in the room, its lists and its typed fields all land where they are drawn; bauhaus's column too; back at the left,
// as it was. Real presses.
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined && !cond ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const side = v => ev(`applyLook(Object.assign({}, LOOK, { 'part.transportAt': ${JSON.stringify(v)} })); if (typeof skinLayout === 'function') skinLayout(); fitRoom(); setView(true); dirtyAll(); flush(); return 1`)
const rect = id => ev(`flush(); const e = document.getElementById('${id}'); if (!e) return null; const q = e.getBoundingClientRect(); return { l: Math.round(q.left), r: Math.round(q.right), w: Math.round(q.width) }`)
const place = a => ev(`flush(); const e = [...document.querySelectorAll('#g-top [data-a="${a}"]')].find(x => x.getBoundingClientRect().width > 0); if (!e) return null; const q = e.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }`)
await ev(`if (typeof START !== 'undefined') START.on = false; tpanelSet(true, false); S.playing && halt(false); dirtyAll(); flush(); return 1`)
ok('offered with the parts\' shapes: the transport panel stands at the left or at the right', await ev(`return LOOK_TREE.flatMap(g => g[1]).flatMap(p => p[2]).flatMap(h => h[1]).some(q => q[0] === 'part.transportAt' && q[3].items.join() === 'at the left,at the right')`))
const L = await rect('tp-col'), heads0 = await ev(`flush(); return Math.round(document.querySelector('[data-a="sel"]').getBoundingClientRect().left)`)
ok('as it comes: the column at the window\'s left edge, the room after it', L && L.l <= 1 && heads0 >= L.r - 1, [L, heads0])
const inside0 = await ev(`flush(); return [...document.querySelectorAll('#tp-col [data-a]')].map(e => { const q = e.getBoundingClientRect(), c = document.getElementById('tp-col').getBoundingClientRect(); return [e.dataset.a, Math.round(q.left - c.left), Math.round(q.top)] }).slice(0, 40)`)
await side('at the right')
const Rr = await rect('tp-col'), heads1 = await ev(`flush(); return Math.round(document.querySelector('[data-a="sel"]').getBoundingClientRect().left)`)
ok('at the right: the column against the window\'s right edge, the room from its left edge', Rr && Math.abs(Rr.r - 1440) <= 1 && heads1 <= 2, [Rr, heads1])
const inside1 = await ev(`flush(); return [...document.querySelectorAll('#tp-col [data-a]')].map(e => { const q = e.getBoundingClientRect(), c = document.getElementById('tp-col').getBoundingClientRect(); return [e.dataset.a, Math.round(q.left - c.left), Math.round(q.top)] }).slice(0, 40)`)
ok('…its inside as it was, only moved', JSON.stringify(inside0) === JSON.stringify(inside1), [inside0.slice(0, 4), inside1.slice(0, 4)])
/* presses land where things are drawn */
await b.click(...Object.values(await place('play'))); await b.sleep(250)
ok('its play pressed: it plays', await ev(`return !!S.playing`))
await b.click(...Object.values(await place('play'))); await b.sleep(250)
{ const p = await ev(`flush(); const t = S.tracks.find(x => x.name === 'hum'), r = t.regs.slice().sort((p, q) => p.a - q.a)[0], b0 = board.getBoundingClientRect(), k = b0.width / (W + (SKV.left || 0)), i = S.tracks.indexOf(t); window.WANT = { x: bx(r.a + .5), y: rowY(i) + rowH(i) * .6, i }; S.selR = []
    return { x: b0.left + (WANT.x + colOff()) * k, y: b0.top + WANT.y * k }`)
  await b.click(p.x, p.y); await b.sleep(150)
  const r = await ev(`const at = hitRegion(WANT.i, barAt(WANT.x)); return { got: LASTP && [Math.round(LASTP.x), Math.round(LASTP.y)], want: [Math.round(WANT.x), Math.round(WANT.y)], chosen: !!at && S.selR.includes(at.id) }`)
  ok('a region in the room pressed: the press lands where it is drawn, and the region there is chosen', JSON.stringify(r.got) === JSON.stringify(r.want) && r.chosen, r) }
{ await b.click(...Object.values(await place('grid'))); await b.sleep(200)
  const m = await ev(`flush(); const g = document.querySelector('#g-menu rect[rx]') || [...document.querySelectorAll('rect[rx="3"]')].pop(); return S.menu && g ? Math.round(g.getBoundingClientRect().right) : null`)
  ok('its grid\'s list opens inside the window', m != null && m <= 1440, m)
  await ev(`S.menu = null; uiDirty('menu'); flush(); return 1`) }
{ const p = await place('tempo'); await b.click(p.x, p.y); await b.sleep(200)
  const f = await ev(`const el = document.getElementById('rename'), q = el.getBoundingClientRect(); return { hidden: el.hidden || el.style.display === 'none', l: Math.round(q.left), r: Math.round(q.right) }`)
  ok('its tempo typed where it stands (the field over it, in the column)', !f.hidden && f.l >= Rr.l - 2 && f.r <= 1441, [f, Rr])
  await b.press('Escape', 'Escape', 27); await b.sleep(100) }
/* bauhaus */
await ev(`applyLook(Object.assign(JSON.parse(JSON.stringify(THEMES.bauhaus)), { 'part.transportAt': 'at the right' })); skinLayout(); fitRoom(); setView(true); dirtyAll(); flush(); return 1`); await b.sleep(300)
{ const r = await rect('bh-col'), cw = await ev(`return SKIN_BANDS.poster[2]`); ok('bauhaus: its column at the right too', !!r && Math.abs(r.l - (1440 - cw)) <= 2, [r, cw]) }
await ev(`applyLook({}); skinLayout(); fitRoom(); tpanelSet(true, false); setView(true); dirtyAll(); flush(); return 1`); await b.sleep(300)
{ const r = await rect('tp-col'); ok('back at the left: as it was', !!r && r.l <= 1, r) }
{ const errs = await ev(`return window.__errs || []`); ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close(); process.exit(bad.length ? 1 : 0)
