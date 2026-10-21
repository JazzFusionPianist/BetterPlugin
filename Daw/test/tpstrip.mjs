// node test/tpstrip.mjs — the chosen track's strip in the transport panel (his pick of design/transport strip draft 1,
// 2026-10-21): it stands between the out and the foot without touching either; its fader pulled moves the level, with
// option goes to 0, its level pressed is typed; its bars move with what is heard and its peak holds the loudest; its
// plug-ins and sends are there to press and turn; a short window has it on one line, its fader pulled across; the patch
// has no strips at its right while the panel shows the strip (hidden, it has them again). Real presses; what is drawn is read back.
import { open, PAGE } from './cdp.mjs'
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined && !cond ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
async function page (w, h) {
  const b = await open(PAGE, { width: w, height: h, dsf: 1 })
  await b.sleep(600)
  await b.ev(`if (typeof START !== 'undefined') START.on = false
    const tr = k => S.tracks.find(x => x.name === k), bus = name => { const t = mkTrack(name, null, null, null, null, 0, [], NO_PATCH()); t.kind = 'bus'; S.tracks.push(t); return t }
    const verb = bus('verb'), dly = bus('delay'), keys = tr('keys')
    keys.inserts = [{ name: 'Pro-Q 4', uid: 1 }, { name: 'Decapitator', uid: 2 }]; keys.sends = [{ to: verb.id, db: -11 }, { to: dly.id, db: -19 }]; keys.vol = -4.5
    if (typeof repaint === 'function') repaint()
    S.sel = S.tracks.indexOf(keys); S.selT = []; S.panel.on = false
    tpanelSet(true, false); setView(true); dirtyAll(); flush(); return 1`)
  await b.sleep(200)
  return b
}
const mouse = (b, type, x, y, extra = {}) => b.send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse' }, extra))
const box = (b, a, k) => b.ev(`const el = document.querySelector('#tp-col [data-a="${a}"]${k != null ? `[data-k="${k}"]` : ''}'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, l: r.x, t: r.y, r: r.right, b: r.bottom }`)
const pull = async (b, from, dx, dy, extra = {}) => { await mouse(b, 'mouseMoved', from.x, from.y, { buttons: 0 }); await mouse(b, 'mousePressed', from.x, from.y, extra); for (let k = 1; k <= 8; k++) await mouse(b, 'mouseMoved', from.x + dx * k / 8, from.y + dy * k / 8, extra); await mouse(b, 'mouseReleased', from.x + dx, from.y + dy, extra); await b.sleep(150) }
const click = async (b, p, extra = {}) => { await mouse(b, 'mouseMoved', p.x, p.y, { buttons: 0 }); await mouse(b, 'mousePressed', p.x, p.y, extra); await mouse(b, 'mouseReleased', p.x, p.y, extra); await b.sleep(150) }
const vol = b => b.ev(`return S.tracks[S.sel].vol`)

/* a window of a usual size */
{ const b = await page(1440, 900)
  const geo = await b.ev(`flush(); const col = document.getElementById('tp-col'), q = s => { const el = col.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); return { t: r.top, b: r.bottom } }
    const g = TPX.geo.out, bar = $('tps-m-0').getBoundingClientRect(), nums = [...col.querySelectorAll('text')].filter(el => el.getAttribute('font-size') === '38')
    return { sg: TPX.sg, ring: g.cy + g.r + 22, top: bar.top, bottom: bar.bottom, foot: nums.length ? nums[0].getBoundingClientRect().top : null, level: [...col.querySelectorAll('text')].some(el => el.textContent === fmtDb(S.tracks[S.sel].vol)) }`)
  ok('the strip stands between the out and the foot, touching neither', geo.sg && !geo.sg.across && geo.top > geo.ring && geo.foot != null && geo.bottom < geo.foot - 6, geo)
  ok('its level said large beside the fader', geo.level, geo)
  const names = await b.ev(`return [...document.querySelectorAll('#tp-col [data-a="mfx"]')].length + ' ' + [...document.querySelectorAll('#tp-col [data-a="mp-send"]')].length + ' ' + !!document.querySelector('#tp-col [data-a="mfxadd"]') + ' ' + !!document.querySelector('#tp-col [data-a="msendadd"]')`)
  ok('its plug-ins (two, + plug-in) and its sends (two knobs, a +)', names === '2 2 true true', names)
  /* the fader */
  const v0 = await vol(b), f = await box(b, 'tps-vol')
  await pull(b, { x: f.x, y: f.y }, 0, -30)
  const v1 = await vol(b)
  ok('its fader pulled up: louder', v1 > v0 + .5, [v0, v1])
  ok('…and the strip says it', await b.ev(`flush(); return [...document.querySelectorAll('#tp-col text')].some(el => el.textContent === fmtDb(S.tracks[S.sel].vol))`))
  await click(b, await box(b, 'tps-vol'), { modifiers: 1 })
  ok('with option: 0', await vol(b) === 0, await vol(b))
  /* the level typed */
  await click(b, await box(b, 'tps-volnum'))
  const ren = await b.ev(`const el = document.getElementById('rename'), r = el.getBoundingClientRect(); return { open: !el.hidden, x: r.x, y: r.y }`)
  ok('its level pressed: typed where it stands, in the panel', ren.open && ren.x < 248 && ren.x > 0, ren)
  await b.ev(`const el = document.getElementById('rename'); el.value = '-7.5'; return 1`); await b.press('Enter', 'Enter', 13); await b.sleep(150)
  ok('…a level typed is the level', await vol(b) === -7.5, await vol(b))
  /* a send turned */
  const db0 = await b.ev(`return S.tracks[S.sel].sends[0].db`), kn = await box(b, 'mp-send', 0)
  await pull(b, kn, 0, -40)
  const db1 = await b.ev(`return S.tracks[S.sel].sends[0].db`)
  ok('a send\'s knob pulled up: it sends more', db1 > db0 + 1, [db0, db1])
  /* the bars and the peak */
  const lv = await b.ev(`const id = S.tracks[S.sel].id; METERS.ts = METERS.ts || new Map(); METERS.ts.set(id, [.5, .25]); S.playing = false; drawMeters(); const a = +$('tps-m-0').getAttribute('height'), c = +$('tps-m-1').getAttribute('height'); return { a, c, pk: $('tps-peak').textContent }`)
  ok('its bars as loud as each side; its peak the louder', lv.a > lv.c && lv.c > 0 && /−6\.0/.test(lv.pk), lv)
  await click(b, await box(b, 'tps-clip'))
  ok('the light pressed: the peak let go', await b.ev(`flush(); return TPS.pk < -99 && /−∞/.test($('tps-peak').textContent)`))
  /* its input; a send pressed and let go: their lists open beside the press, inside the window */
  const menuAt = () => b.ev(`flush(); const g = document.getElementById('g-menu'), q = [...g.querySelectorAll('[data-a="pick"]')].map(e => e.getBoundingClientRect()); if (!S.menu || !q.length) return null; return { n: q.length, l: Math.min(...q.map(r => r.left)), t: Math.min(...q.map(r => r.top)), items: S.menu.items.map(i => i.t).slice(0, 3) }`)
  { const p = await box(b, 'min'); await click(b, p); const m = await menuAt()
    ok('its input pressed: the inputs, beside it', !!m && m.l >= 0 && Math.abs(m.l - p.l) < 60 && m.t > p.t - 10 && m.t < p.b + 40, [m, p])
    await b.ev(`S.menu = null; uiDirty('menu'); flush(); return 1`) }
  { const p = await box(b, 'mp-send', 1); await click(b, p); const m = await menuAt()
    ok('a send pressed and let go: where it goes, beside it', !!m && m.l >= 0 && m.l < 400 && Math.abs(m.t - p.b) < 80, [m, p])
    await b.ev(`S.menu = null; uiDirty('menu'); flush(); return 1`) }
  /* + plug-in */
  await click(b, await box(b, 'mfxadd'))
  ok('+ plug-in: the list of plug-ins opens', await b.ev(`return !!S.picker.open`))
  await b.ev(`closePicker(); return 1`)
  /* the patch has no strips at its right */
  const side = await b.ev(`S.panel.on = true; S.panel.tab = 'patch'; setView(true); dirtyAll(); flush(); return { strips: document.querySelectorAll('#g-dock [data-a="mvol"]').length + document.querySelectorAll('[data-a="mvol"]:not(#tp-col *)').length, word: [...document.querySelectorAll('text')].some(el => el.textContent === 'strip'), side: SIDE }`)
  ok('the patch has no strips at its right, nor the word', side.strips === 0 && !side.word && side.side === 0, side)
  /* the panel hidden (or a theme with a transport of its own): the patch keeps its strips, the strip is shown somewhere */
  const back = await b.ev(`tpanelSet(false, false); S.panel.on = true; S.panel.tab = 'patch'; setView(true); dirtyAll(); flush(); const n = document.querySelectorAll('[data-a="mvol"]').length; tpanelSet(true, false); S.panel.tab = 'patch'; setView(true); dirtyAll(); flush(); return { hidden: n, side: SIDE, again: document.querySelectorAll('[data-a="mvol"]').length }`)
  ok('the panel hidden: the patch has its strips again; shown: not', back.hidden >= 1 && back.side === 0 && back.again === 0, back)
  { const errs = await b.ev(`return window.__errs || []`); ok('nothing went wrong on the page (1440 x 900)', !errs.length && !b.errors.length, [errs, b.errors]) }
  await b.close() }

/* a short window: on one line, the fader across */
{ const b = await page(1100, 700)
  const g = await b.ev(`flush(); const r = $('tps-m-0').getBoundingClientRect(), o = TPX.geo.out; return { sg: TPX.sg, top: r.top, ring: o.cy + o.r + 22 }`)
  ok('a short window: the strip on one line, under the out', g.sg && g.sg.across && g.top > g.ring, g)
  const v0 = await vol(b), f = await box(b, 'tps-vol')
  await pull(b, { x: f.x, y: f.y }, 30, 0)
  const v1 = await vol(b)
  ok('…its fader pulled to the right: louder', v1 > v0 + .5, [v0, v1])
  { const errs = await b.ev(`return window.__errs || []`); ok('nothing went wrong on the page (1100 x 700)', !errs.length && !b.errors.length, [errs, b.errors]) }
  await b.close() }
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
process.exit(bad.length ? 1 : 0)
