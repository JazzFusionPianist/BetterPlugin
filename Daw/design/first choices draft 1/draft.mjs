// node "design/first choices draft 1/draft.mjs" — a DRAFT, drawn over the app's own pages in a browser: the plug-in the
// room reaches for first, of each kind, when a request is made by its sound (the ways: design/choices draft 1).
//   1  the first time the app opens: the start page's empty shelf holds the first choices, one row a kind; a row's
//      list opened (eq): the eqs on this Mac, the room's own first
//   2  settings > plug-ins: the same rows as a group of their own above the kinds; how often each was used; what the
//      room has learnt of each (it learns a plug-in by sending sound through it: what each control does); a list
//      opened (compressor), the most used first
// His words, 2026-10-16: "처음 실행할 때도 골라야하지만, setting 에서도 고를 수 있었으면 좋겠어". Nothing of this is in
// the app: the pages are drawn over here, in this browser only.
import { open, PAGE } from '../../test/cdp.mjs'
import { copyFileSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))

/* what is drawn the same on both pages: a kind's row, a list opened */
const KIT = `
window.FC = {
  rows: [
    { k: 'eq', on: 'pro-q 4', st: 'learnt', n: 41 },
    { k: 'compressor', on: 'pro-c 2', st: 'learnt', n: 33 },
    { k: 'limiter', on: 'pro-l 2', st: 'learning', p: .62, n: 12 },
    { k: 'de-esser', on: 'pro-ds', st: 'next', n: 9 },
    { k: 'transients', on: 'spl transient designer', st: 'hardware', n: 2 },
    { k: 'reverb', on: 'valhallavintageverb', st: 'next', n: 27 },
    { k: 'delay', on: 'timeless 3', st: 'next', n: 14 },
    { k: 'saturation', on: 'decapitator', st: 'next', n: 19 },
    { k: 'width', on: 'the room’s own', own: true, n: 0 },
  ],
  /* one row: the kind, its list key, what has been learnt of it (and, in settings, how often it was used) */
  row (x, y, w, r, o = {}) {
    let s = T(x, y + 13.4, r.k, { size: 10.5, a: .62 })
    const mx = x + (o.mx || 150), mk = menuKey(mx, y, r.on, { h: 20, size: 10, dim: r.own })
    s += mk[0]
    const sx = mx + (o.sx || 270)
    if (r.st === 'learnt') s += T(sx, y + 13.4, 'learnt', { size: 9.5, a: .5 })
    else if (r.st === 'learning') s += T(sx, y + 13.4, 'learning', { size: 9.5, a: .8 }) + R(sx + 52, y + 9, 60, 2, { fill: INK, fa: .14 }) + R(sx + 52, y + 9, 60 * r.p, 2, { fill: INK, fa: .8 })
    else if (r.st === 'next') s += T(sx, y + 13.4, 'next', { size: 9.5, a: .32 })
    else if (r.st === 'hardware') s += T(sx, y + 13.4, 'cannot be learnt without its hardware', { size: 9.5, a: .32 })
    if (o.used && r.n) s += T(x + w, y + 13.4, 'used ' + r.n + (r.n === 1 ? ' time' : ' times'), { size: 9.5, a: .38, anchor: 'end' })
    return s
  },
  /* a list opened under a row's key: a field that finds, the room's own first, then the Mac's, the chosen one filled */
  list (x, y, w, word, items, more, o = {}) {
    const rh = 21, h = 32 + items.reduce((q, it) => q + (it.line ? 6 : rh), 0) + (more ? 22 : 6)
    let s = R(x, y, w, h, { rx: 3, fill: K2 }) + R(x + .5, y + .5, w - 1, h - 1, { rx: 3, stroke: INK, sa: .28 })
    s += R(x + 6.5, y + 6.5, w - 13, 19, { rx: 2, stroke: INK, sa: .2 }) + T(x + 14, y + 19.5, 'find ' + word, { size: 9.5, a: .34 })
    let ry = y + 32
    for (const it of items) {
      if (it.line) { s += hline(x + 10, x + w - 10, ry + 2, .1); ry += 6; continue }
      if (it.on) s += R(x + 5, ry, w - 10, rh - 1, { rx: 2, fill: INK })
      s += T(x + 13, ry + 13.6, it.t, { size: 10, w: it.on ? 500 : 400, c: it.on ? K1 : INK, a: it.on ? 1 : it.dim ? .36 : .86 })
      if (it.r) s += T(x + w - 13, ry + 13.6, it.r, { size: 9, c: it.on ? K1 : INK, a: it.on ? .6 : .34, anchor: 'end' })
      ry += rh
    }
    if (more) s += T(x + 13, ry + 14, more, { size: 9, a: .32 })
    return s
  },
  put (svg) { let g = document.getElementById('draft'); if (!g) { g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.id = 'draft'; document.getElementById('svg').appendChild(g) } g.innerHTML = svg },
}`

/* ── 1: the first time the app opens ── */
{
  const b = await open(PAGE, { width: 1440, height: 900, dsf: 2 })
  await b.sleep(700)
  await b.ev(`${KIT}
    START.on = true; START.list = []; START.read = true; START.find = ''; START.tpl = 0
    setView(true); dirtyAll(); flush()
    const L = startLay(), x = 20, y0 = L.y2 + 26, w = W - 40, mx = HEAD_W - x                     // (the kinds in the first column; the keys where the templates begin)
    let s = R(0, L.y1, W, L.yb - L.y1, { fill: K0 })
    s += T(x, y0 + 4, 'first choices', { size: 13, w: 500, a: .94 })
    s += T(x + tw('first choices', 13, 500) + 12, y0 + 4, 'the plug-in the room reaches for first, of each kind', { size: 10, a: .45 })
    const kw = keyW('done', { size: 10, pad: 12, armed: true }), lw = keyW('later', { size: 10, pad: 12 })
    s += key(x + w - kw, y0 - 11, 'done', { h: 20, size: 10, pad: 12, armed: true })[0] + key(x + w - kw - 8 - lw, y0 - 11, 'later', { h: 20, size: 10, pad: 12 })[0]
    s += hline(x, x + w, y0 + 20, .1)
    let y = y0 + 34
    FC.rows.forEach((r, i) => { s += FC.row(x, y, w, Object.assign({}, r, i > 1 && i !== 8 ? { st: r.st === 'hardware' ? 'hardware' : 'next' } : {}, i === 2 ? { st: 'learning' } : {}), { mx }); y += 30 })
    /* the eq row's list, opened */
    s += FC.list(x + mx, y0 + 34 + 24, 250, 'an eq', [
      { t: 'the mac’s eq', r: 'the room’s own' }, { line: true },
      { t: 'pro-q 4', on: true, r: 'fabfilter' }, { t: 'pro-q 3', r: 'fabfilter' }, { t: 'hitsville eq mastering', r: 'universal audio' }, { t: 'hitsville eq', r: 'universal audio' },
      { t: 'pultec eqp-1a', r: 'universal audio' }, { t: 'oxford eq', r: 'universal audio' }, { t: 'api 550a', r: 'universal audio' }, { t: 'neve 1073', r: 'universal audio' },
      { t: 'manley massive passive', r: 'universal audio' }, { t: 'sie-q', r: 'soundtoys' }], 'and 76 more, a scroll away')
    FC.put(s)`)
  await b.sleep(300)
  await b.shot('first-choices-1.png')
  copyFileSync(join(here, '../../test/out/first-choices-1.png'), join(here, '1 the first time the app opens.png'))
  console.log('1', JSON.stringify(b.errors))
  await b.close()
}

/* ── 2: settings > plug-ins, the first choices as a group of their own ── */
{
  const plugs = readFileSync(join(here, '../plugins draft 1/plugs.json'), 'utf8')
  const b = await open(join(here, '../../ui/settings.html') + '?part=plug-ins', { width: 1100, height: 692, dsf: 2, before: `window.PLUG_STAND_IN = ${plugs}.map((p, i) => Object.assign({ id: 'p' + i }, p))` })
  await b.sleep(1200)
  const r = await b.ev(`${KIT}
    if (typeof PG === 'undefined') return 'no plug-ins page'
    const pool = pgPool(), groups = pgGroups(pool)
    let s = R(SIDE + PTX - 6, 124, PTW + 12, DISP_H - 124, { fill: K1 }) + R(SIDE + PX0 - 20, 58, DISP_W - SIDE - PX0 + 20, DISP_H - 58, { fill: K1 })
    /* the groups: the first choices above the kinds */
    let y = 130
    const row = (t, n, on) => { let q = ''; if (on) q += R(SIDE + PTX, y, PTW, 20, { rx: 2, fill: INK }); q += T(SIDE + PTX + 10, y + 13.6, t, { size: 10, w: on ? 500 : 400, c: on ? K1 : INK, a: on ? 1 : .72 }) + T(SIDE + PTX + PTW - 10, y + 13.6, n, { size: 9.5, c: on ? K1 : INK, a: on ? .7 : .38, anchor: 'end' }); y += 21; return q }
    s += row('first choices', '9', true)
    y += 6; s += hline(SIDE + PTX + 6, SIDE + PTX + PTW - 6, y - 4, .1)
    for (const g of groups.slice(0, 13)) { const its = pool.filter(p => pgIn(p) === g), o = its.filter(p => !pgShown(p)).length; s += row(g, o ? (its.length - o) + ' of ' + its.length : String(its.length), false) }
    /* the right: the rows, with how often each was used */
    const x = SIDE + PX0, w = DISP_W - 28 - x
    s += T(x, 84, 'first choices', { size: 12, w: 500, a: .94 }) + T(x + tw('first choices', 12, 500) + 12, 84, 'what a request made by its sound puts on first, of each kind', { size: 9.5, a: .42 })
    const lk = keyW('learn again', { size: 10, pad: 10 })
    s += key(x + w - lk, 70, 'learn again', { h: 20, size: 10, pad: 10 })[0]
    s += hline(x, x + w, 102, .1)
    y = 116
    for (const r of FC.rows) { s += FC.row(x, y, w, r, { used: true, mx: 120 }); y += 30 }
    s += hline(x, x + w, y + 4, .1)
    s += T(x, y + 30, 'share which plug-ins are used, without a name', { size: 10, a: .62 })
    s += cells(x + w - 72, y + 17, 20, [{ t: 'on', on: true }, { t: 'off' }], { size: 9.5, widths: [36, 36] })[0]
    /* the compressor row's list, opened: the most used first */
    s += FC.list(x + 120, 116 + 30 + 24, 250, 'a compressor', [
      { t: 'the room’s comp', r: 'the room’s own' }, { line: true },
      { t: 'pro-c 2', on: true, r: '33' }, { t: 'teletronix la-2', r: '21' }, { t: 'ssl g bus compressor', r: '18' }, { t: 'empirical labs distressor', r: '11' },
      { t: 'neve 33609 c', r: '6' }, { t: 'shadow hills mastering compressor', r: '3' }, { t: 'api 2500', r: '1' }, { t: 'elysia mpressor' }, { t: 'fairchild 670 legacy' }], 'and 79 more, a scroll away')
    FC.put(s)
    return 'ok'`)
  await b.sleep(300)
  await b.shot('first-choices-2.png')
  copyFileSync(join(here, '../../test/out/first-choices-2.png'), join(here, '2 settings, plug-ins, first choices.png'))
  console.log('2', r, JSON.stringify(b.errors))
  await b.close()
}
process.exit(0)
