// node "design/transport panel draft 4/draft.mjs" — a DRAFT, drawn over the app's own page in a browser: draft 3's column
// (his OK, 2026-10-21) laid out again by how much each thing matters, so that it reads at a glance (his ask, 2026-10-21:
// "각 기능의 중요도에 따라 사이즈를 조절해서 좀 덜 조잡하게"). Three weights:
//   first    where the song is (large), play / stop / record (large shapes), the out (its level large)
//   second   the time as SMPTE, the tempo, the measure, the tool and the mode (the command tool gone: his word, 2026-10-21)
//   third    the rest — cycle, click, low latency, the song's line, the key, grid and nudge, the views, the zooms, what is
//            chosen — small and quiet
// Fewer lines: no rule after every head, a hairline only between the groups; legends only under the figures that need them;
// one left edge, one right edge, one step down the column. Nothing of this is in the app: the page is drawn over here, in
// this browser only.
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
  const { CW, L } = TP, R0 = CW - L, U = R0 - L, p = curPos(), F = TP.fold, small = H < 820
  let s = R(0, 0, CW, H, { fill: K2 }) + R(CW - 1, 0, 1, H, { fill: INK, fa: .1 })
  const head = (y, k, name, right) => T(L, y, k, { size: 7.5, a: .28, x: TP.num }) + T(L + 15, y, name, { size: 8.5, w: 500, a: .5 }) + (right || '')
  const sep = y => R(0, y, CW - 1, .6, { fill: INK, fa: .09 })
  const lab = (x, y, w, o = {}) => T(x, y, w, Object.assign({ size: 7.5, a: .34 }, o))
  /* ── first: where the song is ── */
  s += head(26, '01', 'position')
  s += TP.fields(L, 70, 30, place(p).split('.'), ['bar', 'beat', 'div', 'tick'], { widths: [3, 1, 1, 3], gap: 3, keep: [0, 1, 1, 1] })
  s += TP.fields(L, 112, 15, smpte(p).split(/[:;]/), ['h', 'm', 's', 'f'], { sep: smpteRate().drop ? ';' : ':', gap: 3, keep: [0, 0, 1, 1] })
  s += T(R0, 112, smpteRate().t + ' fps', { size: 8, a: .4, anchor: 'end' })
  let y = 140
  s += sep(y)
  /* ── first: the transport, large; its switches and the song's line small under it ── */
  y += 20; s += head(y, '02', 'transport')
  const c2 = y + 34, slot = k => L + U * (k + .5) / 4, playing = TP.play || (S.playing && !S.rec), stopped = !playing && !S.rec
  s += R(slot(0) - 8, c2 - 7.5, 1.3, 15, { fill: INK, fa: .8 }) + P('M' + n(slot(0) + 7.5) + ' ' + n(c2 - 7.5) + 'L' + n(slot(0) - 4) + ' ' + n(c2) + 'L' + n(slot(0) + 7.5) + ' ' + n(c2 + 7.5) + 'Z', { stroke: INK, sa: .75, sw: 1, x: ' stroke-linejoin="round"' })
  s += TP.tri(slot(1) + 2, c2, 24, 28, playing) + TP.sq(slot(2), c2, 23, stopped) + TP.disc(slot(3), c2, 13.5, !!S.rec, REC)
  const c3 = c2 + 40, lamp = (x, shape, word, on) => shape + T(x + 13, c3 + 3, word, { size: 9, a: on ? .9 : .45 })
  s += lamp(L, TP.disc(L + 4, c3, 4, S.cycle.on, SOLO), 'cycle', S.cycle.on) + lamp(L + 66, TP.tri(L + 66 + 4, c3 - .4, 8.5, 7.5, !!S.click, INK, 'up'), 'click', !!S.click) + lamp(L + 128, TP.dia(L + 128 + 4, c3, 4.5, !!S.lowLat, MON), 'low lat', !!S.lowLat)
  const my = c3 + 24, end = SONG_END, X = b => L + U * b / end
  s += R(L, my, U, .6, { fill: INK, fa: .22 })
  for (const sc of SCENES) s += R(X(sc.a - 1) - .3, my - 2, .6, 4.6, { fill: INK, fa: .3 })
  if (S.cycle.on) s += R(X(S.cycle.a), my - 1.5, X(S.cycle.b) - X(S.cycle.a), 3.6, { fill: SOLO, fa: .85 }) + lab((X(S.cycle.a) + X(S.cycle.b)) / 2, my + 13, Math.round(S.cycle.a + 1) + ' – ' + Math.round(S.cycle.b + 1), { anchor: 'middle', a: .45, x: TP.num })
  s += P('M' + n(X(p)) + ' ' + (my - 6) + 'l-2.8 -4.4h5.6z', { fill: INK, fa: .9 }) + R(X(p) - .35, my - 6, .7, 11, { fill: INK, fa: .8 })
  y = my + 26
  s += sep(y)
  /* ── second: the tempo, the measure; third: the key — three shapes stepping down, standing on one line ── */
  y += 20
  if (F.has('time')) { s += head(y, '03', 'time') + T(R0, y, (+S.tempo).toFixed(2) + ' bpm   ' + meterName() + '   ' + (S.key || '—'), { size: 9, a: .75, anchor: 'end', x: TP.num + ' xml:space="preserve"' }); y += 22 }
  else {
    s += head(y, '03', 'time')
    const foot = y + 70, r = 25, tx = L + r, cy = foot - r, ph = p - Math.floor(p)
    for (let k = 0; k < 32; k++) { const a = k / 32 * 2 * Math.PI - Math.PI / 2, l = k % 8 ? 2.2 : 4.6; s += P('M' + n(tx + Math.cos(a) * r) + ' ' + n(cy + Math.sin(a) * r) + 'L' + n(tx + Math.cos(a) * (r - l)) + ' ' + n(cy + Math.sin(a) * (r - l)), { stroke: INK, sa: k % 8 ? .28 : .55, sw: .8 }) }
    { const a = ph * 2 * Math.PI - Math.PI / 2; s += Cc(tx + Math.cos(a) * (r + 3.4), cy + Math.sin(a) * (r + 3.4), 1.9, { fill: INK }) }
    s += T(tx, cy + 4, (+S.tempo).toFixed(2), { size: 13.5, anchor: 'middle', x: TP.num }) + lab(tx, cy + 13, 'bpm', { size: 6.5, anchor: 'middle', a: .4 })
    const ms = 40, mx = L + 2 * r + 18 + ms / 2
    s += R(mx - ms / 2 + .5, foot - ms + .5, ms - 1, ms - 1, { stroke: INK, sa: .75, sw: 1 }) + T(mx, foot - ms / 2 + 2, meterName(), { size: 13, anchor: 'middle', x: TP.num })
    const nb = BEATS(), bi = Math.floor(ph * nb + 1e-9), bw = 4, bg = 3, b0 = mx - (nb * bw + (nb - 1) * bg) / 2
    for (let k = 0; k < nb; k++) s += k === bi ? R(b0 + k * (bw + bg), foot - 11, bw, bw, { fill: INK }) : R(b0 + k * (bw + bg) + .3, foot - 10.7, bw - .6, bw - .6, { stroke: INK, sa: .4, sw: .6 })
    const kw = 32, kx = mx + ms / 2 + 18 + kw / 2
    s += TP.tri(kx, foot - kw * .45, kw, kw * .9, false, INK, 'up').replace('stroke-opacity="0.8"', 'stroke-opacity="0.55"') + T(kx, foot - 5, S.key || '—', { size: 10, a: S.key ? .9 : .4, anchor: 'middle' })
    s += lab(kx + kw / 2 + 8, foot, 'key', { a: .3 })
    y = foot + 18
  }
  s += sep(y)
  /* ── second: the hands and the mode; third: the grid and the nudge on a short ruler ── */
  y += 20; s += head(y, '04', 'edit')
  s += TP.cols(y + 26, [[toolWord(S.tool), 'tool', { chev: true, size: 12 }], [S.mode, 'mode', { chev: true, size: 12 }]])      // (no command tool: he has it gone, 2026-10-21)
  const rw = y + 66, gN = (m => m ? +m[1] / WHOLE() : BEATS())(String(gridName()).match(/^1\\/(\\d+)/)), fN = 16 / WHOLE(), nw = U * Math.min(1, nudgeBars())
  s += lab(L, rw, 'grid', { size: 9, a: .42 }) + T(L + 26, rw, gridName(), { size: 10, a: .85, x: TP.num }) + lab(L + 98, rw, 'nudge', { size: 9, a: .42 }) + T(L + 98 + 32, rw, S.nudge, { size: 10, a: .85, x: TP.num })
  const ru = rw + 12
  s += R(L, ru, U, .6, { fill: INK, fa: .28 })
  for (let k = 0; k <= fN; k++) s += R(L + U * k / fN - .3, ru - 2, .6, 2, { fill: INK, fa: .2 })
  for (let k = 0; k <= gN; k++) s += R(L + U * k / gN - .3, ru - 6, .6, 6, { fill: INK, fa: .6 })
  for (let k = 0; k < 4 && (k + 1) * nw <= U; k++) s += R(L + k * nw + (k ? 1 : 0), ru + 2.5, nw - (k ? 1 : 0), 2.4, { fill: INK, fa: k ? .16 : .85 })
  y = ru + 22
  s += sep(y)
  /* ── third: the views and the zooms ── */
  y += 20
  if (F.has('view')) { s += head(y, '05', 'view') + T(R0, y, (S.auto ? 'auto' : S.flex ? 'rubato' : 'regions') + '   zoom ' + Math.round(zoomF() * 100) + '%', { size: 9, a: .75, anchor: 'end', x: TP.num + ' xml:space="preserve"' }); y += 22 }
  else {
    s += head(y, '05', 'view')
    const c5 = y + 22, a = on => on ? .9 : .42
    const autoG = x => { const pts = [[x, c5 + 2.5], [x + 4, c5 - 2.5], [x + 8, c5 + 1], [x + 11.5, c5 - 3.5]]; return P('M' + pts.map(q => n(q[0]) + ' ' + n(q[1])).join('L'), { stroke: INK, sa: a(S.auto), sw: .9 }) + pts.map(q => Cc(q[0], q[1], 1.2, { fill: INK, fa: a(S.auto) })).join('') }
    const rubG = x => R(x, c5 - 4, .9, 8, { fill: INK, fa: a(S.flex) }) + R(x + 11, c5 - 4, .9, 8, { fill: INK, fa: a(S.flex) }) + P('M' + n(x + 2.5) + ' ' + c5 + 'H' + n(x + 9) + 'M' + n(x + 4.2) + ' ' + n(c5 - 1.7) + 'L' + n(x + 2.5) + ' ' + c5 + 'L' + n(x + 4.2) + ' ' + n(c5 + 1.7) + 'M' + n(x + 7.3) + ' ' + n(c5 - 1.7) + 'L' + n(x + 9) + ' ' + c5 + 'L' + n(x + 7.3) + ' ' + n(c5 + 1.7), { stroke: INK, sa: a(S.flex), sw: .9 })
    const word = (x, w, on) => T(x, c5 + 3, w, { size: 9, a: on ? .9 : .45 }) + (on ? R(x, c5 + 6, tw(w, 9), .9, { fill: INK, fa: .7 }) : '')
    s += autoG(L) + word(L + 17, 'auto', S.auto) + rubG(L + 66) + word(L + 66 + 17, 'rubato', S.flex)
    const zy = c5 + 24, zw = (U - 16) / 2
    const hz = (x, yy) => P('M' + n(x - 3.5) + ' ' + n(yy) + 'H' + n(x + 3.5) + 'M' + n(x - 2) + ' ' + n(yy - 1.5) + 'L' + n(x - 3.5) + ' ' + n(yy) + 'L' + n(x - 2) + ' ' + n(yy + 1.5) + 'M' + n(x + 2) + ' ' + n(yy - 1.5) + 'L' + n(x + 3.5) + ' ' + n(yy) + 'L' + n(x + 2) + ' ' + n(yy + 1.5), { stroke: INK, sa: .4, sw: .8 })
    const vt = (x, yy) => P('M' + n(x) + ' ' + n(yy - 3.5) + 'V' + n(yy + 3.5) + 'M' + n(x - 1.5) + ' ' + n(yy - 2) + 'L' + n(x) + ' ' + n(yy - 3.5) + 'L' + n(x + 1.5) + ' ' + n(yy - 2) + 'M' + n(x - 1.5) + ' ' + n(yy + 2) + 'L' + n(x) + ' ' + n(yy + 3.5) + 'L' + n(x + 1.5) + ' ' + n(yy + 2), { stroke: INK, sa: .4, sw: .8 })
    const sl = (x, w, f, g) => { let q = R(x + 12, zy, w - 12, .6, { fill: INK, fa: .25 }); return q + R(x + 12 + (w - 12) * f - 3, zy - 2.7, 6, 6, { fill: WHITE }) + g(x + 4, zy + .3) }
    s += sl(L, zw, zoomF(), hz) + sl(L + zw + 16, zw, clamp((S.rh - 20) / 100, 0, 1), vt)
    y = zy + 20
  }
  s += sep(y)
  /* ── third: what is chosen; how many tracks, and a new one ── */
  y += 20
  const st = S.tracks[S.sel], rs = TP.region ? selRegs() : [], r = rs.length ? rs[0][0] : null, look = r ? regLook(r, rs[0][1]) : { c: st.c, outline: st.outline }
  const kx = R0 - 12
  s += head(y, '06', r ? 'region' : 'track', T(kx - 6, y, S.tracks.length + ' tracks', { size: 8, a: .4, anchor: 'end', x: TP.num }) + R(kx + .5, y - 9.5, 11, 11, { rx: 2, stroke: INK, sa: .45, sw: .7 }) + P('M' + n(kx + 6) + ' ' + n(y - 7) + 'V' + n(y - 1) + 'M' + n(kx + 3) + ' ' + n(y - 4) + 'H' + n(kx + 9), { stroke: INK, sa: .8, sw: .9 }))
  const ry = y + 24, nm = fit(asGiven(r ? (r.tag || r.name || rs[0][1].name) : st.name), 100, 11)
  s += T(L, ry, nm, { size: 11, a: .95 }) + R(R0 - 72, ry - 9, 10, 10, { fill: look.c }) + TP.chev(R0 - 52, ry - 4) + P(shapePath(R0 - 36, ry - 8.5, 18, 9, SHAPES[look.outline], .5), { fill: INK, fa: .8 }) + TP.chev(R0 - 4, ry - 4)
  y = ry + 6
  if (r) {
    const sg = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v || 0)
    s += TP.cols(y + 20, [[fmtDb(r.gain || 0), 'gain', { size: 10 }], [sg(r.tr), 'transpose', { size: 10 }], [sg(r.ft), 'fine', { size: 10 }], [(+(r.fi || 0)).toFixed(2) + ' ' + (+(r.fo || 0)).toFixed(2), 'fades', { size: 10 }]], [36, 46, 34, 56])
    y += 20 + 18
  }
  /* ── first: the out, at the foot ── */
  const oy = Math.max(y + 24, H - FOOT_H - 126)
  s += sep(oy - 20) + head(oy, '07', 'out')
  s += T(L, oy + 36, fmtDb(S.master), { size: 28, w: 400, x: TP.num }) + T(L + tw(fmtDb(S.master), 28) + 7, oy + 36, 'db', { size: 9, a: .4 })
  s += T(R0, oy + 36, 'peak ' + fmtDb(-3.1), { size: 8.5, a: .5, anchor: 'end' })
  const sx = L, sw = U, by = oy + 52, FD = db => sx + sw * volF(db)
  TP.lv.forEach((f, c) => { const yy = by + c * 7; s += R(sx, yy, sw, 4, { fill: INK, fa: .08 }) + R(sx, yy, sw * f, 4, { fill: LEVEL, fa: .9 }) + R(sx + sw * (f + .04), yy, 1.2, 4, { fill: INK, fa: .7 }) })
  const ty = by + 18
  for (const db of [-48, -36, -24, -18, -12, -9, -6, -3, 0, 3, 6]) s += R(FD(db) - .3, ty, .6, [-48, -24, -12, -6, 0, 6].includes(db) ? 4.5 : 2.5, { fill: INK, fa: .35 })
  for (const db of [-48, -24, -12, -6, 0, 6]) s += T(FD(db), ty + 14, db > 0 ? '+' + db : String(db).replace('-', '−'), { size: 7, a: .38, anchor: 'middle', x: TP.num })
  s += P('M' + n(FD(S.master)) + ' ' + (by - 3) + 'l-3.5 -6h7z', { fill: INK }) + R(FD(S.master) - .4, by - 3, .8, 17, { fill: INK, fa: .5 })
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
