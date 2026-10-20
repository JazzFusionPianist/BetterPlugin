// node "design/transport panel draft 3/draft.mjs" — a DRAFT, drawn over the app's own page in a browser: draft 2's column
// (his OK, 2026-10-21) with the tracks' bar taken into it as well, small, and the bar gone from the top: the room begins at
// its markers. In the column, in the same hand as 01 (each figure on a rule, its legend under it):
//   04 edit   the tool, the command tool and the mode as three figures; the grid and the nudge on their ruler as before
//   05 view   the lines (auto) and rubato as two lamps; the zoom along the song and the rows' height as two sliders, their
//             handles the small white square
//   06 track  what is chosen — its name, its colour, its shape (a region: its gain, transpose, fine and fades as figures
//             too); at the head, how many tracks, and a key for a new one
//   07 out    as before
// In a small window the sections that are least reached for fold to one line, their values said in it (a press opens one).
// His ask, 2026-10-21 ("auto / rubato / tool / cmd / mode / color + shape / zoom 요거도 작게 왼쪽 transport에 넣어볼 수
// 있나?"). Nothing of this is in the app: the page is drawn over here, in this browser only.
import { open, PAGE } from '../../test/cdp.mjs'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))

const KIT = `
SKIN_BANDS.panel = [-TOOL_H, 0, 236]                                          // (the tracks' bar drawn above the window: in the draft only, the room then begins at its markers)
{ const read0 = skinRead; skinRead = function () { read0(); SKIN.k.transport = 'panel' } }
const WHITE = '#FFFFFF'
/* a level's handle: a small square filled white */
levelBar = function (x, y, w, t, vol) {
  const f = volF(vol)
  return R(x, y - 1, w, 4, { fill: INK, fa: .12 }) + R(x, y - 1, w * .0, 4, { fill: LEVEL, fa: .86, x: ' id="mt-' + t.id + '" data-w="' + n(w) + '"' }) + R(x + w * volF(0), y - 3, 1, 8, { fill: INK, fa: .3 })
    + R(x + w * f - 3.5, y - 2.5, 7, 7, { fill: WHITE, fa: heard(t) ? 1 : .5 })
}
/* r i m s: their edges a hairline */
squareCells = function (x, y, items, cw, size, i, gap = 2) {
  let s = '', hits = ''
  items.forEach((it, k) => {
    const cx = x + k * (cw + gap)
    s += it.on ? R(cx, y, cw, cw, { fill: it.c || INK }) : R(cx + .3, y + .3, cw - .6, cw - .6, { stroke: INK, sa: .7, sw: .6 })
    s += T(cx + cw / 2, y + cw / 2 + size * .34, it.t, { size, w: it.on ? 500 : 400, c: it.on ? K0 : INK, a: it.on ? 1 : .82, anchor: 'middle' })
    if (it.a) hits += hit(cx, y - 2, cw, cw + 4, it.a, ' data-i="' + i + '"')
  })
  return s + hits
}
/* the mixer's fader caps, as drawn (mix.js draws them inside the strip): each made a small white square */
window.tpCaps = () => {
  for (const r of [...document.querySelectorAll('#g-dock rect[height="9"]')]) {
    const w = +r.getAttribute('width'); if (w !== 20 && w !== 24) continue
    const x = +r.getAttribute('x') + w / 2, y = +r.getAttribute('y') + 4.5
    r.setAttribute('x', x - 5); r.setAttribute('y', y - 5); r.setAttribute('width', 10); r.setAttribute('height', 10); r.setAttribute('fill', WHITE)
    const line = r.nextElementSibling; if (line && line.tagName === 'rect' && line.getAttribute('height') === '1.2') line.remove()
  }
}
window.TP = {
  CW: 236, L: 20,
  lv: [.62, .55],
  num: ' style="font-variant-numeric: tabular-nums"',
  head (y, k, name) {
    const { L, CW } = TP, x1 = L + 18 + tw(name, 9, 500) + 8
    return T(L, y, k, { size: 8, a: .3, x: TP.num }) + T(L + 18, y, name, { size: 9, w: 500, a: .62 }) + R(x1, y - 3, CW - L - x1, .6, { fill: INK, fa: .14 }) + R(CW - L - .3, y - 6, .6, 6, { fill: INK, fa: .3 })
  },
  fields (x, y, size, parts, legend, o = {}) {
    const wt = o.w || 400, dw = tw('0', size, wt), sep = o.sep || '.', sw = tw(sep, size, wt) + (o.gap || 3)
    let s = '', cx = x, lead = true
    parts.forEach((v, i) => {
      v = String(v).padStart(o.widths ? o.widths[i] : String(v).length, '0')
      if (i) { s += T(cx + sw / 2, y, sep, { size, w: wt, a: lead ? .16 : .42, anchor: 'middle' }); cx += sw }
      const x0 = cx
      for (let k = 0; k < v.length; k++) {
        if (v[k] !== '0' || (i === parts.length - 1 && k === v.length - 1) || (o.keep && o.keep[i])) lead = false
        s += T(cx + dw / 2, y, v[k], { size, w: wt, a: lead ? .16 : 1, anchor: 'middle' }); cx += dw
      }
      if (legend) s += R(x0, y + 6, cx - x0, .6, { fill: INK, fa: .2 }) + T((x0 + cx) / 2, y + 16, legend[i], { size: 7.5, a: .38, anchor: 'middle' })
    })
    return s
  },
  /* a shape at rest is drawn in a hairline; on, it is filled */
  tri (cx, cy, w, h, on, c, dir = 'right') {
    const d = dir === 'right' ? 'M' + n(cx - w / 2) + ' ' + n(cy - h / 2) + 'L' + n(cx + w / 2) + ' ' + n(cy) + 'L' + n(cx - w / 2) + ' ' + n(cy + h / 2) + 'Z'
      : 'M' + n(cx) + ' ' + n(cy - h / 2) + 'L' + n(cx + w / 2) + ' ' + n(cy + h / 2) + 'L' + n(cx - w / 2) + ' ' + n(cy + h / 2) + 'Z'
    return P(d, on ? { fill: c || INK } : { stroke: c || INK, sa: .8, sw: 1, x: ' stroke-linejoin="round"' })
  },
  sq (cx, cy, k, on, c) { return on ? R(cx - k / 2, cy - k / 2, k, k, { fill: c || INK }) : R(cx - k / 2 + .5, cy - k / 2 + .5, k - 1, k - 1, { stroke: c || INK, sa: .8, sw: 1 }) },
  disc (cx, cy, r, on, c) { return on ? Cc(cx, cy, r, { fill: c || INK }) : Cc(cx, cy, r - .5, { stroke: c || INK, sa: .8, sw: 1 }) },
  dia (cx, cy, r, on, c) { const d = 'M' + n(cx) + ' ' + n(cy - r) + 'L' + n(cx + r) + ' ' + n(cy) + 'L' + n(cx) + ' ' + n(cy + r) + 'L' + n(cx - r) + ' ' + n(cy) + 'Z'; return P(d, on ? { fill: c || INK } : { stroke: c || INK, sa: .8, sw: 1, x: ' stroke-linejoin="round"' }) },
  /* figures across, each on a rule with its legend under it (as 01's): [value, legend, {chev, swatch, shape}] */
  cols (y, items, widths) {
    const { L } = TP, U = TP.CW - 2 * L, gap = 8, ws = widths || items.map(() => (U - gap * (items.length - 1)) / items.length)
    let s = '', x = L
    items.forEach(([v, legend, o = {}], i) => {
      const w = ws[i]
      if (o.swatch) s += R(x, y - 10, 13, 13, { fill: o.swatch })
      else if (o.shape) s += P(shapePath(x, y - 9, 22, 11, SHAPES[o.shape], .5), { fill: INK, fa: .86 })
      else s += T(x, y, v, { size: o.size || 11.5, a: o.dim ? .45 : 1, x: TP.num })
      if (o.chev) s += TP.chev(x + w - 4, y - 4)
      s += R(x, y + 6, w, .6, { fill: INK, fa: .2 }) + T(x, y + 16, legend, { size: 7.5, a: .38 })
      x += w + gap
    })
    return s
  },
  /* a slider: a hairline rail with a few ticks, its handle the small white square, its legend under it */
  slider (x, y, w, f, legend, glyph) {
    let s = R(x, y, w, .8, { fill: INK, fa: .3 })
    for (let k = 0; k <= 4; k++) s += R(x + w * k / 4 - .3, y + 2, .6, 3, { fill: INK, fa: .3 })
    return s + R(x + w * f - 3.5, y - 3.1, 7, 7, { fill: WHITE }) + glyph(x + 4, y + 15.5) + T(x + 13, y + 18, legend, { size: 7.5, a: .38 })
  },
  /* a section folded: its number, its name, a leader, what it holds said in one line, and a plus to open it */
  folded (y, k, name, says) {
    const { L, CW } = TP, R0 = CW - L, x1 = L + 18 + tw(name, 9, 500) + 8, sw = tw(says, 9)
    return T(L, y, k, { size: 8, a: .3, x: TP.num }) + T(L + 18, y, name, { size: 9, w: 500, a: .62 }) + P('M' + n(x1) + ' ' + n(y - 3) + 'H' + n(R0 - sw - 18), { stroke: INK, sa: .22, sw: .8, x: ' stroke-dasharray="1 3"' })
      + T(R0 - 14, y, says, { size: 9, a: .8, anchor: 'end', x: TP.num + ' xml:space="preserve"' }) + P('M' + n(R0 - 4) + ' ' + n(y - 7) + 'V' + n(y + 1) + 'M' + n(R0 - 8) + ' ' + n(y - 3) + 'H' + n(R0), { stroke: INK, sa: .5, sw: .9 })
  },
  fold: new Set(),
  chev (x, y) { return P('M' + n(x - 3.5) + ' ' + n(y - 1.8) + 'l3.5 3.5 3.5 -3.5', { stroke: INK, sa: .45, sw: 1 }) },
}
SKINS.left.panel = () => {
  const { CW, L } = TP, R0 = CW - L, U = R0 - L, p = curPos(), GAP = H >= 820 ? 28 : 22, F = TP.fold
  let s = R(0, 0, CW, H, { fill: K2 }) + R(CW - 1, 0, 1, H, { fill: INK, fa: .1 })
  /* 01 position */
  s += TP.head(28, '01', 'position')
  s += TP.fields(L, 72, 28, place(p).split('.'), ['bar', 'beat', 'div', 'tick'], { widths: [3, 1, 1, 3], gap: 4, keep: [0, 1, 1, 1] })
  s += TP.fields(L, 118, 16, smpte(p).split(/[:;]/), ['h', 'm', 's', 'f'], { sep: smpteRate().drop ? ';' : ':', gap: 3, keep: [0, 0, 1, 1] })
  const fps = smpteRate().t + ' fps', fw = tw(fps, 8) + 10
  s += R(R0 - fw + .5, 105.5, fw - 1, 15, { rx: 2, stroke: INK, sa: .22 }) + T(R0 - fw / 2, 116, fps, { size: 8, a: .55, anchor: 'middle' })
  let y = 134 + GAP
  /* 02 transport */
  s += TP.head(y, '02', 'transport')
  const c2 = y + 32, base = c2 + 20, slot = k => L + U * (k + .5) / 4, playing = TP.play || (S.playing && !S.rec), stopped = !playing && !S.rec
  s += R(slot(0) - 7.5, c2 - 6.5, 1.3, 13, { fill: INK, fa: .85 }) + P('M' + n(slot(0) + 6.5) + ' ' + n(c2 - 6.5) + 'L' + n(slot(0) - 3.5) + ' ' + n(c2) + 'L' + n(slot(0) + 6.5) + ' ' + n(c2 + 6.5) + 'Z', { stroke: INK, sa: .8, sw: 1, x: ' stroke-linejoin="round"' })
  s += TP.tri(slot(1) + 2, c2, 20, 23, playing) + TP.sq(slot(2), c2, 19, stopped) + TP.disc(slot(3), c2, 11, !!S.rec, REC)
  s += R(L, base, U, .6, { fill: INK, fa: .3 })
  ;['start', 'play', 'stop', 'record'].forEach((w, k) => { s += R(slot(k) - .3, base, .6, 4, { fill: INK, fa: .45 }) + T(slot(k), base + 14, w, { size: 7.5, a: .42, anchor: 'middle' }) })
  const c3 = base + 36, lamp = (x, shape, word, on) => shape + T(x + 15, c3 + 3.4, word, { size: 9.5, a: on ? .95 : .5 })
  s += lamp(L, TP.disc(L + 5, c3, 5, S.cycle.on, SOLO), 'cycle', S.cycle.on) + lamp(L + 68, TP.tri(L + 68 + 5, c3 - .5, 10.5, 9.5, !!S.click, INK, 'up'), 'click', !!S.click) + lamp(L + 132, TP.dia(L + 132 + 5, c3, 5.5, !!S.lowLat, MON), 'low lat', !!S.lowLat)
  const my = c3 + 30, end = SONG_END, X = b => L + U * b / end
  s += R(L, my, U, .8, { fill: INK, fa: .3 })
  for (const sc of SCENES) s += R(X(sc.a - 1), my - 3, .7, 6.8, { fill: INK, fa: .38 })
  if (S.cycle.on) s += R(X(S.cycle.a), my - 2, X(S.cycle.b) - X(S.cycle.a), 4.8, { fill: SOLO, fa: .9 })
  s += P('M' + n(X(p)) + ' ' + (my - 8) + 'l-3.2 -5h6.4z', { fill: INK }) + R(X(p) - .4, my - 8, .8, 14, { fill: INK, fa: .9 })
  s += T(L, my + 16, '1', { size: 7.5, a: .38, x: TP.num }) + T(R0, my + 16, String(Math.round(end) + 1), { size: 7.5, a: .38, anchor: 'end', x: TP.num })
  if (S.cycle.on) s += T((X(S.cycle.a) + X(S.cycle.b)) / 2, my + 16, 'cycle ' + Math.round(S.cycle.a + 1) + ' – ' + Math.round(S.cycle.b + 1), { size: 7.5, a: .6, anchor: 'middle', x: TP.num })
  y = my + 18 + GAP
  /* 03 time */
  if (F.has('time')) { s += TP.folded(y, '03', 'time', (+S.tempo).toFixed(2) + ' bpm   ' + meterName() + '   key ' + (S.key || '—')); y += GAP }
  else {
    s += TP.head(y, '03', 'time')
    const c4 = y + 40, tx = L + 26, r = 24, ph = p - Math.floor(p)
    for (let k = 0; k < 32; k++) { const a = k / 32 * 2 * Math.PI - Math.PI / 2, l = k % 8 ? 2.4 : 5; s += P('M' + n(tx + Math.cos(a) * r) + ' ' + n(c4 + Math.sin(a) * r) + 'L' + n(tx + Math.cos(a) * (r - l)) + ' ' + n(c4 + Math.sin(a) * (r - l)), { stroke: INK, sa: k % 8 ? .3 : .6, sw: .8 }) }
    { const a = ph * 2 * Math.PI - Math.PI / 2; s += Cc(tx + Math.cos(a) * (r + 3.5), c4 + Math.sin(a) * (r + 3.5), 2, { fill: INK }) }
    s += T(tx, c4 + 3, (+S.tempo).toFixed(2), { size: 12, anchor: 'middle', x: TP.num }) + T(tx, c4 + 12, 'bpm', { size: 6.5, a: .45, anchor: 'middle' })
    const mx = L + 98, ms = 44
    s += R(mx - ms / 2 + .5, c4 - ms / 2 + .5, ms - 1, ms - 1, { stroke: INK, sa: .8, sw: 1 }) + T(mx, c4 + 2, meterName(), { size: 14, anchor: 'middle', x: TP.num })
    const nb = BEATS(), bi = Math.floor(ph * nb + 1e-9), bw = 4.5, bg = 3.5, b0 = mx - (nb * bw + (nb - 1) * bg) / 2
    for (let k = 0; k < nb; k++) s += k === bi ? R(b0 + k * (bw + bg), c4 + 10, bw, bw, { fill: INK }) : R(b0 + k * (bw + bg) + .3, c4 + 10.3, bw - .6, bw - .6, { stroke: INK, sa: .45, sw: .6 })
    const kx = L + 168
    s += TP.tri(kx, c4 + 1, 50, 44, false, INK, 'up') + T(kx, c4 + 16, S.key || '—', { size: 11.5, a: S.key ? 1 : .45, anchor: 'middle' })
    ;[[tx, 'tempo'], [mx, 'measure'], [kx, 'key']].forEach(([x, w]) => { s += T(x, c4 + 38, w, { size: 7.5, a: .42, anchor: 'middle' }) })
    y = c4 + 38 + GAP
  }
  /* 04 edit: the hands, the mode; the grid and the nudge on a ruler */
  s += TP.head(y, '04', 'edit')
  s += TP.cols(y + 26, [[toolWord(S.tool), 'tool', { chev: true }], [toolWord(S.tool2), '⌘ tool', { chev: true }], [S.mode, 'mode', { chev: true }]])
  const rw = y + 66, ru = rw + 22, gN = (m => m ? +m[1] / WHOLE() : BEATS())(String(gridName()).match(/^1\\/(\\d+)/)), fN = 16 / WHOLE(), nw = U * Math.min(1, nudgeBars())
  s += T(L, rw, 'grid', { size: 10, a: .55 }) + T(L + 32, rw, gridName(), { size: 12, x: TP.num }) + TP.chev(L + 32 + tw(gridName(), 12) + 10, rw - 4)
  s += T(R0 - 14, rw, S.nudge, { size: 12, anchor: 'end', x: TP.num }) + T(R0 - 14 - tw(S.nudge, 12) - 8, rw, 'nudge', { size: 10, a: .55, anchor: 'end' }) + TP.chev(R0 - 3.5, rw - 4)
  s += R(L, ru, U, .8, { fill: INK, fa: .4 })
  for (let k = 0; k <= fN; k++) s += R(L + U * k / fN - .3, ru - 3, .6, 3, { fill: INK, fa: .25 })
  for (let k = 0; k <= gN; k++) s += R(L + U * k / gN - .35, ru - 9, .7, 9, { fill: INK, fa: .75 })
  for (let k = 0; k < 4 && (k + 1) * nw <= U; k++) s += R(L + k * nw + (k ? 1 : 0), ru + 3, nw - (k ? 1 : 0), 3, { fill: INK, fa: k ? .18 : .9 })
  s += T(L, ru + 18, 'one nudge', { size: 7.5, a: .55 }) + T(R0, ru + 18, 'one bar', { size: 7.5, a: .38, anchor: 'end' })
  y = ru + 18 + GAP
  /* 05 view: the lines and rubato; the zooms */
  if (F.has('view')) { s += TP.folded(y, '05', 'view', (S.auto ? 'auto' : S.flex ? 'rubato' : 'regions') + '   zoom ' + Math.round(zoomF() * 100) + '%'); y += GAP }
  else {
    s += TP.head(y, '05', 'view')
    const c5 = y + 24, on = (k, glyph, word, x) => glyph + T(x + 20, c5 + 3.4, word, { size: 9.5, a: k ? .95 : .5 }) + (k ? R(x + 20, c5 + 7, tw(word, 9.5), 1, { fill: INK, fa: .8 }) : '')
    const autoG = x => { const a = S.auto ? .95 : .45, pts = [[x, c5 + 3], [x + 4.5, c5 - 3], [x + 9, c5 + 1], [x + 13, c5 - 4]]; return P('M' + pts.map(q => n(q[0]) + ' ' + n(q[1])).join('L'), { stroke: INK, sa: a, sw: 1 }) + pts.map(q => Cc(q[0], q[1], 1.4, { fill: INK, fa: a })).join('') }
    const rubG = x => { const a = S.flex ? .95 : .45; return R(x, c5 - 5, 1, 10, { fill: INK, fa: a }) + R(x + 13, c5 - 5, 1, 10, { fill: INK, fa: a }) + P('M' + n(x + 3) + ' ' + c5 + 'H' + n(x + 11) + 'M' + n(x + 5) + ' ' + n(c5 - 2) + 'L' + n(x + 3) + ' ' + c5 + 'L' + n(x + 5) + ' ' + n(c5 + 2) + 'M' + n(x + 9) + ' ' + n(c5 - 2) + 'L' + n(x + 11) + ' ' + c5 + 'L' + n(x + 9) + ' ' + n(c5 + 2), { stroke: INK, sa: a, sw: 1 }) }
    s += on(S.auto, autoG(L), 'auto', L) + on(S.flex, rubG(L + 100), 'rubato', L + 100)
    const zy = c5 + 30, zw = (U - 16) / 2
    const hz = (x, yy) => P('M' + n(x - 4) + ' ' + n(yy) + 'H' + n(x + 4) + 'M' + n(x - 2.5) + ' ' + n(yy - 1.8) + 'L' + n(x - 4) + ' ' + n(yy) + 'L' + n(x - 2.5) + ' ' + n(yy + 1.8) + 'M' + n(x + 2.5) + ' ' + n(yy - 1.8) + 'L' + n(x + 4) + ' ' + n(yy) + 'L' + n(x + 2.5) + ' ' + n(yy + 1.8), { stroke: INK, sa: .45, sw: .9 })
    const vt = (x, yy) => P('M' + n(x) + ' ' + n(yy - 4) + 'V' + n(yy + 4) + 'M' + n(x - 1.8) + ' ' + n(yy - 2.5) + 'L' + n(x) + ' ' + n(yy - 4) + 'L' + n(x + 1.8) + ' ' + n(yy - 2.5) + 'M' + n(x - 1.8) + ' ' + n(yy + 2.5) + 'L' + n(x) + ' ' + n(yy + 4) + 'L' + n(x + 1.8) + ' ' + n(yy + 2.5), { stroke: INK, sa: .45, sw: .9 })
    s += TP.slider(L, zy, zw, zoomF(), 'zoom', hz) + TP.slider(L + zw + 16, zy, zw, clamp((S.rh - 20) / 100, 0, 1), 'rows', vt)
    y = zy + 18 + GAP
  }
  /* 06 track: what is chosen; how many tracks, and a new one */
  const st = S.tracks[S.sel], rs = TP.region ? selRegs() : [], r = rs.length ? rs[0][0] : null, look = r ? regLook(r, rs[0][1]) : { c: st.c, outline: st.outline }
  if (F.has('track')) { s += TP.folded(y, '06', r ? 'region' : 'track', fit(asGiven(r ? (r.tag || r.name || rs[0][1].name) : st.name), 90, 9)); y += GAP }
  else {
    s += TP.head(y, '06', r ? 'region' : 'track')
    const nt = S.tracks.length + ' tracks', kx = R0 - 14
    s += R(R0 - 50 - tw(nt, 8), y - 12, 46 + tw(nt, 8), 14, { fill: K2 }) + T(kx - 6, y, nt, { size: 8, a: .5, anchor: 'end', x: TP.num })
    s += R(kx + .5, y - 10.5, 13, 13, { rx: 2, stroke: INK, sa: .5, sw: .8 }) + P('M' + n(kx + 7) + ' ' + n(y - 7.5) + 'V' + n(y - .5) + 'M' + n(kx + 3.5) + ' ' + n(y - 4) + 'H' + n(kx + 10.5), { stroke: INK, sa: .85, sw: 1 })
    const nm = fit(asGiven(r ? (r.tag || r.name || rs[0][1].name) : st.name), 96, 11.5)
    s += TP.cols(y + 26, [[nm, r ? 'region' : 'track'], ['', 'colour', { swatch: look.c, chev: true }], ['', 'shape', { shape: look.outline, chev: true }]], [100, 40, 40])
    y += 26 + 18
    if (r) {
      const sg = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v || 0)
      s += TP.cols(y + 22, [[fmtDb(r.gain || 0), 'gain db'], [sg(r.tr), 'transpose'], [sg(r.ft), 'fine'], [(+(r.fi || 0)).toFixed(2) + ' ' + (+(r.fo || 0)).toFixed(2), 'fades']], [40, 44, 34, 54])
      y += 22 + 18
    }
    y += GAP
  }
  /* 07 out: at the foot of the column */
  const oy = Math.max(y, H - FOOT_H - 118)
  s += TP.head(oy, '07', 'out')
  s += T(L, oy + 36, fmtDb(S.master), { size: 24, w: 400, x: TP.num }) + T(L + tw(fmtDb(S.master), 24) + 8, oy + 36, 'db', { size: 9, a: .45 })
  s += T(R0, oy + 36, 'peak ' + fmtDb(-3.1), { size: 8.5, a: .55, anchor: 'end' })
  const sx = L, sw = U, by = oy + 52, FD = db => sx + sw * volF(db)
  TP.lv.forEach((f, c) => { const yy = by + c * 7; s += R(sx, yy, sw, 4, { fill: INK, fa: .08 }) + R(sx, yy, sw * f, 4, { fill: LEVEL, fa: .9 }) + R(sx + sw * (f + .04), yy, 1.2, 4, { fill: INK, fa: .7 }) + T(sx - 7, yy + 4.2, c ? 'r' : 'l', { size: 7, a: .38 }) })
  const ty = by + 18
  for (const db of [-48, -36, -24, -18, -12, -9, -6, -3, 0, 3, 6]) s += R(FD(db) - .3, ty, .6, [-48, -24, -12, -6, 0, 6].includes(db) ? 5 : 3, { fill: INK, fa: .4 })
  for (const db of [-48, -24, -12, -6, 0, 6]) s += T(FD(db), ty + 15, db > 0 ? '+' + db : String(db).replace('-', '−'), { size: 7.5, a: .42, anchor: 'middle', x: TP.num })
  s += P('M' + n(FD(S.master)) + ' ' + (by - 3) + 'l-3.5 -6h7z', { fill: INK }) + R(FD(S.master) - .4, by - 3, .8, 17, { fill: INK, fa: .55 })
  return G(s, 'translate(' + (-CW) + ' 0)')
}
`
async function sheet (file, width, height, setup, clip) {
  const b = await open(PAGE, { width, height, dsf: 2 })
  await b.sleep(700)
  await b.ev(`if (typeof START !== 'undefined') START.on = false
    ${KIT}
    S.nudge = '1/16'; S.cycle = { on: true, a: 16, b: 24 }; jumpTo(4 + 1 / 4 + 2 / 16 + 119 / 3840); S.playing = false
    ${setup}
    if (typeof skinLayout === 'function') skinLayout(); fitRoom(); setView(true); dirtyAll(); flush(); return 1`)
  await b.sleep(400)
  await b.ev(`dirtyAll(); flush(); tpCaps(); return 1`)
  const r = await b.send('Page.captureScreenshot', clip ? { format: 'png', clip: { x: clip[0], y: clip[1], width: clip[2], height: clip[3], scale: clip[4] || 1.5 } } : { format: 'png' })
  writeFileSync(join(here, file), Buffer.from(r.data, 'base64'))
  console.log(file, JSON.stringify(b.errors))
  await b.close()
}
await sheet('1 the room, 1440.png', 1440, 900, `S.panel.on = false`)
await sheet('2 with the mixer, 1440.png', 1440, 900, `S.panel.on = true; S.panel.tab = 'mixer'; S.panel.h = 316`)
await sheet('3 the column, a track chosen.png', 1440, 900, `S.panel.on = false`, [0, 0, 236, 900])
await sheet('4 the column, a region chosen, the lines up.png', 1440, 900, `S.panel.on = false; S.auto = true; TP.region = true; const t = S.tracks.find(x => x.name === 'hum'); S.sel = S.tracks.indexOf(t); const r = t.regs.slice().sort((a, b) => a.a - b.a)[1]; r.gain = 1.5; r.fi = .25; S.selR = [r.id]; S.focus = 'lanes'`, [0, 0, 236, 900])
await sheet('5 a small window, 1100 x 700, two sections folded.png', 1100, 700, `S.panel.on = false; TP.fold = new Set(['time', 'view'])`)
process.exit(0)
