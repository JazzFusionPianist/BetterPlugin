// node test/inspector.mjs [w h] — the inspector's strip (his asks, 2026-10-21): it stands still when the panel below
// opens (the panel covers its foot); its fader no taller than about a third of it, the rows above for the patch and the
// sends; its name in the face and size of the heads' names, with room between it and r i m s.
import { open, PAGE } from './cdp.mjs'
const [ww, hh] = [+process.argv[2] || 1440, +process.argv[3] || 900]
const b = await open(PAGE, { width: ww, height: hh, dsf: 1 })
await b.sleep(600)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined && !cond ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const look = () => ev(`flush(); const g = document.getElementById('g-insp'), vol = g.querySelector('[data-a="ivol"]'), name = [...g.querySelectorAll('text')].filter(t => t.textContent === S.tracks[S.sel].name).pop(), cells = [...g.querySelectorAll('[data-a="mute"]')][0]
  const r = e => e ? e.getBoundingClientRect() : null, v = r(vol), nm = r(name), c = r(cells)
  return { fader: INSP.geom ? Math.round(INSP.geom.fh) : 0, strip: INSP.geom ? Math.round(INSP.geom.fb - INSP.geom.y0) : 0, nf: INSP.geom ? INSP.geom.nf : 0, ns: INSP.geom ? INSP.geom.ns : 0, volTop: v ? Math.round(v.top) : null, nameTop: nm ? Math.round(nm.top) : null, nameSize: name ? +name.getAttribute('font-size') : 0, nameFace: name ? name.getAttribute('font-family') : '', cellsBottom: c ? Math.round(c.bottom) : null }`)
await ev(`if (typeof START !== 'undefined') START.on = false; INSP.on = true; S.panel.on = false; S.sel = 4; setView(true); dirtyAll(); flush(); return 1`)
const a = await look()
const head = await ev(`flush(); const t = [...document.querySelectorAll('#g-head text')].find(e => e.textContent === S.tracks[S.sel].name); return t ? { size: +t.getAttribute('font-size'), face: t.getAttribute('font-family') } : null`)
ok('its name in the size and face of the heads’ names', !!head && a.nameSize === head.size && a.nameFace === head.face, [a, head])
ok('room between r i m s and its name', a.nameTop - a.cellsBottom >= 8, a)
ok('its fader no taller than about a third of it; at least six rows of patch', a.fader <= a.strip * .36 && a.fader >= 80 && a.nf >= 6, a)
await ev(`S.panel.on = true; S.panel.tab = 'mixer'; S.panel.h = 380; setView(true); dirtyAll(); flush(); return 1`)
const c = await look()
ok('the panel opened: it does not move, nor grow shorter', c.volTop === a.volTop && c.fader === a.fader && c.nameTop === a.nameTop, [a, c])
ok('…and the panel stands over its foot', await ev(`const d = document.getElementById('g-dock'), i = document.getElementById('g-insp'); return !!(i.compareDocumentPosition(d) & Node.DOCUMENT_POSITION_FOLLOWING) && BY < ${a.nameTop}`))
await b.shot('inspector.png')
{ const errs = await ev(`return window.__errs || []`); ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close(); process.exit(bad.length ? 1 : 0)
