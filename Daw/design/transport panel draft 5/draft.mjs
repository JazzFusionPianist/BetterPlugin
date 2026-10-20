// node "design/transport panel draft 5/draft.mjs" — a DRAFT, drawn over the app's own page in a browser: draft 4's column
// with no heads and no rules between its groups — they are told apart by where they stand, the room between them shared out
// evenly down the column — and each thing as large as it matters (his asks, 2026-10-21: "1 position 2 transport… 이런식으로
// 구분선 놓고 구분 안해도 … 레이아웃으로 구분되어 보이게", "무슨 도구 선택되어있는지 또는 넛지 벨류가 얼만지 … 작게 만들고,
// 중요한 걸 조금만 더 키워서"):
//   large    where the song is; play, stop, record; the out (at the foot; the room between the groups no more than 46)
//   middle   the time as SMPTE; the tempo and the measure
//   small    the key; cycle, click, low latency, the song's line; and, quiet in two columns, the tool, the mode, the grid,
//            the nudge, the views, the zooms, what is chosen, the tracks
// The column a little wider (248) for the larger figures. No command tool (gone, his word). Nothing of this is in the app:
// the page is drawn over here, in this browser only.
import { open, PAGE } from '../../test/cdp.mjs'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))

const KIT = `
SKIN_BANDS.panel = [-TOOL_H, 0, 248]                                          // (the tracks' bar drawn above the window: in the draft only, the room then begins at its markers)
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
  CW: 248, L: 22,
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
  const { CW, L } = TP, R0 = CW - L, U = R0 - L, p = curPos()
  let s = R(0, 0, CW, H, { fill: K2 }) + R(CW - 1, 0, 1, H, { fill: INK, fa: .1 })
  const lab = (x, y, w, o = {}) => T(x, y, w, Object.assign({ size: 7.5, a: .34 }, o))
  /* the groups' heights; the room left over shared out between them */
  const HT = { pos: 104, tr: 112, time: 52, quiet: 156, out: 96 }, top = 30, bottom = FOOT_H + 22
  const gap = clamp((H - top - bottom - Object.values(HT).reduce((a, b) => a + b, 0)) / 4, 22, 46)      // (more room than that is left above the out, which stands at the foot)
  let y = top
  /* ── large: where the song is ── */
  s += TP.fields(L, y + 30, 32, place(p).split('.'), ['bar', 'beat', 'div', 'tick'], { widths: [3, 1, 1, 3], gap: 3, keep: [0, 1, 1, 1] })
  s += TP.fields(L, y + 78, 17, smpte(p).split(/[:;]/), ['h', 'm', 's', 'f'], { sep: smpteRate().drop ? ';' : ':', gap: 3, keep: [0, 0, 1, 1] })
  s += T(R0, y + 78, smpteRate().t + ' fps', { size: 8, a: .38, anchor: 'end' })
  y += HT.pos + gap
  /* ── large: play, stop, record; small under them: cycle, click, low latency, the song's line ── */
  const c2 = y + 20, slot = k => L + U * (k + .5) / 4, playing = TP.play || (S.playing && !S.rec), stopped = !playing && !S.rec
  s += R(slot(0) - 9, c2 - 9, 1.5, 18, { fill: INK, fa: .8 }) + P('M' + n(slot(0) + 9) + ' ' + n(c2 - 9) + 'L' + n(slot(0) - 4.5) + ' ' + n(c2) + 'L' + n(slot(0) + 9) + ' ' + n(c2 + 9) + 'Z', { stroke: INK, sa: .75, sw: 1.1, x: ' stroke-linejoin="round"' })
  s += TP.tri(slot(1) + 3, c2, 30, 34, playing) + TP.sq(slot(2), c2, 29, stopped) + TP.disc(slot(3), c2, 16.5, !!S.rec, REC)
  const c3 = c2 + 52, lamp = (x, shape, word, on) => shape + T(x + 12, c3 + 3, word, { size: 8.5, a: on ? .85 : .42 })
  s += lamp(L, TP.disc(L + 3.5, c3, 3.5, S.cycle.on, SOLO), 'cycle', S.cycle.on) + lamp(L + 68, TP.tri(L + 68 + 3.5, c3 - .3, 7.5, 6.5, !!S.click, INK, 'up'), 'click', !!S.click) + lamp(L + 136, TP.dia(L + 136 + 3.5, c3, 4, !!S.lowLat, MON), 'low lat', !!S.lowLat)
  const my = c3 + 24, end = SONG_END, X = b => L + U * b / end
  s += R(L, my, U, .6, { fill: INK, fa: .2 })
  for (const sc of SCENES) s += R(X(sc.a - 1) - .3, my - 2, .6, 4.6, { fill: INK, fa: .28 })
  if (S.cycle.on) s += R(X(S.cycle.a), my - 1.5, X(S.cycle.b) - X(S.cycle.a), 3.4, { fill: SOLO, fa: .85 }) + lab((X(S.cycle.a) + X(S.cycle.b)) / 2, my + 13, Math.round(S.cycle.a + 1) + ' – ' + Math.round(S.cycle.b + 1), { anchor: 'middle', a: .42, size: 7, x: TP.num })
  s += P('M' + n(X(p)) + ' ' + (my - 6) + 'l-2.8 -4.4h5.6z', { fill: INK, fa: .9 }) + R(X(p) - .35, my - 6, .7, 11, { fill: INK, fa: .8 })
  y += HT.tr + gap
  /* ── middle: the tempo and the measure; small: the key ── */
  { const foot = y + HT.time, r = 24, tx = L + r, cy = foot - r, ph = p - Math.floor(p)
    for (let k = 0; k < 32; k++) { const a = k / 32 * 2 * Math.PI - Math.PI / 2, l = k % 8 ? 2.2 : 4.6; s += P('M' + n(tx + Math.cos(a) * r) + ' ' + n(cy + Math.sin(a) * r) + 'L' + n(tx + Math.cos(a) * (r - l)) + ' ' + n(cy + Math.sin(a) * (r - l)), { stroke: INK, sa: k % 8 ? .28 : .55, sw: .8 }) }
    { const a = ph * 2 * Math.PI - Math.PI / 2; s += Cc(tx + Math.cos(a) * (r + 3.4), cy + Math.sin(a) * (r + 3.4), 1.9, { fill: INK }) }
    s += T(tx, cy + 4, (+S.tempo).toFixed(2), { size: 13.5, anchor: 'middle', x: TP.num }) + lab(tx, cy + 13, 'bpm', { size: 6.5, anchor: 'middle', a: .4 })
    const ms = 40, mx = L + 2 * r + 20 + ms / 2
    s += R(mx - ms / 2 + .5, foot - ms + .5, ms - 1, ms - 1, { stroke: INK, sa: .75, sw: 1 }) + T(mx, foot - ms / 2 + 2, meterName(), { size: 13, anchor: 'middle', x: TP.num })
    const nb = BEATS(), bi = Math.floor(ph * nb + 1e-9), bw = 4, bg = 3, b0 = mx - (nb * bw + (nb - 1) * bg) / 2
    for (let k = 0; k < nb; k++) s += k === bi ? R(b0 + k * (bw + bg), foot - 11, bw, bw, { fill: INK }) : R(b0 + k * (bw + bg) + .3, foot - 10.7, bw - .6, bw - .6, { stroke: INK, sa: .4, sw: .6 })
    const kw = 26, kx = mx + ms / 2 + 20 + kw / 2
    s += TP.tri(kx, foot - kw * .45, kw, kw * .9, false, INK, 'up').replace('stroke-opacity="0.8"', 'stroke-opacity="0.5"') + T(kx, foot - 4, S.key || '—', { size: 9, a: S.key ? .85 : .38, anchor: 'middle' }) + lab(kx + kw / 2 + 7, foot, 'key', { a: .3 }) }
  y += HT.time + gap
  /* ── small, in two columns: the tool, the mode; the grid, the nudge; the views; the zooms; what is chosen ── */
  const cw = (U - 14) / 2, C = [L, L + cw + 14]
  const cell = (k, yy, label, value, o = {}) => { const x = C[k]; return lab(x, yy, label, { a: .32 }) + T(x, yy + 15, value, { size: 10.5, a: .82, x: TP.num }) + (o.chev ? P('M' + n(x + cw - 6) + ' ' + n(yy + 9.5) + 'l3 3 3 -3', { stroke: INK, sa: .35, sw: .9 }) : '') }
  let q = y
  s += cell(0, q, 'tool', toolWord(S.tool), { chev: true }) + cell(1, q, 'mode', S.mode, { chev: true })
  q += 34
  s += cell(0, q, 'grid', gridName(), { chev: true }) + cell(1, q, 'nudge', S.nudge, { chev: true })
  q += 34
  { const a = on => on ? .85 : .4, c5 = q + 11
    const autoG = x => { const pts = [[x, c5 + 2.5], [x + 4, c5 - 2.5], [x + 8, c5 + 1], [x + 11.5, c5 - 3.5]]; return P('M' + pts.map(v => n(v[0]) + ' ' + n(v[1])).join('L'), { stroke: INK, sa: a(S.auto), sw: .9 }) + pts.map(v => Cc(v[0], v[1], 1.1, { fill: INK, fa: a(S.auto) })).join('') }
    const rubG = x => R(x, c5 - 4, .9, 8, { fill: INK, fa: a(S.flex) }) + R(x + 11, c5 - 4, .9, 8, { fill: INK, fa: a(S.flex) }) + P('M' + n(x + 2.5) + ' ' + c5 + 'H' + n(x + 9) + 'M' + n(x + 4.2) + ' ' + n(c5 - 1.7) + 'L' + n(x + 2.5) + ' ' + c5 + 'L' + n(x + 4.2) + ' ' + n(c5 + 1.7) + 'M' + n(x + 7.3) + ' ' + n(c5 - 1.7) + 'L' + n(x + 9) + ' ' + c5 + 'L' + n(x + 7.3) + ' ' + n(c5 + 1.7), { stroke: INK, sa: a(S.flex), sw: .9 })
    const word = (x, w, on) => T(x, c5 + 3, w, { size: 9, a: on ? .88 : .42 }) + (on ? R(x, c5 + 6, tw(w, 9), .8, { fill: INK, fa: .7 }) : '')
    s += autoG(C[0]) + word(C[0] + 17, 'auto', S.auto) + rubG(C[1]) + word(C[1] + 17, 'rubato', S.flex)
    const zy = q + 34
    const hz = (x, yy) => P('M' + n(x - 3.5) + ' ' + n(yy) + 'H' + n(x + 3.5) + 'M' + n(x - 2) + ' ' + n(yy - 1.5) + 'L' + n(x - 3.5) + ' ' + n(yy) + 'L' + n(x - 2) + ' ' + n(yy + 1.5) + 'M' + n(x + 2) + ' ' + n(yy - 1.5) + 'L' + n(x + 3.5) + ' ' + n(yy) + 'L' + n(x + 2) + ' ' + n(yy + 1.5), { stroke: INK, sa: .4, sw: .8 })
    const vt = (x, yy) => P('M' + n(x) + ' ' + n(yy - 3.5) + 'V' + n(yy + 3.5) + 'M' + n(x - 1.5) + ' ' + n(yy - 2) + 'L' + n(x) + ' ' + n(yy - 3.5) + 'L' + n(x + 1.5) + ' ' + n(yy - 2) + 'M' + n(x - 1.5) + ' ' + n(yy + 2) + 'L' + n(x) + ' ' + n(yy + 3.5) + 'L' + n(x + 1.5) + ' ' + n(yy + 2), { stroke: INK, sa: .4, sw: .8 })
    const sl = (x, f, g) => R(x + 13, zy, cw - 13, .6, { fill: INK, fa: .25 }) + R(x + 13 + (cw - 13) * f - 3, zy - 2.7, 6, 6, { fill: WHITE }) + g(x + 4, zy + .3)
    s += sl(C[0], zoomF(), hz) + sl(C[1], clamp((S.rh - 20) / 100, 0, 1), vt) }
  q += 56
  { const st = S.tracks[S.sel], rs = TP.region ? selRegs() : [], r = rs.length ? rs[0][0] : null, look = r ? regLook(r, rs[0][1]) : { c: st.c, outline: st.outline }
    const nm = fit(asGiven(r ? (r.tag || r.name || rs[0][1].name) : st.name), cw, 10.5)
    s += lab(C[0], q, r ? 'region' : 'track', { a: .32 }) + T(C[0], q + 15, nm, { size: 10.5, a: .9 })
    s += R(C[1], q + 6, 9, 9, { fill: look.c }) + P(shapePath(C[1] + 16, q + 6.5, 16, 8, SHAPES[look.outline], .5), { fill: INK, fa: .75 })
    const kx = R0 - 11
    s += lab(kx - 5, q, S.tracks.length + ' tracks', { a: .32, anchor: 'end', x: TP.num }) + R(kx + .5, q + 4.5, 10, 10, { rx: 2, stroke: INK, sa: .45, sw: .7 }) + P('M' + n(kx + 5.5) + ' ' + n(q + 7) + 'V' + n(q + 12.5) + 'M' + n(kx + 2.8) + ' ' + n(q + 9.7) + 'H' + n(kx + 8.2), { stroke: INK, sa: .8, sw: .9 })
    if (r) { const sg = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v || 0); s += lab(C[0], q + 32, 'gain ' + fmtDb(r.gain || 0) + '   transpose ' + sg(r.tr) + '   fine ' + sg(r.ft) + '   fades ' + (+(r.fi || 0)).toFixed(2) + ' ' + (+(r.fo || 0)).toFixed(2), { a: .55, size: 8, x: TP.num + ' xml:space="preserve"' }) } }
  /* ── large: the out, at the foot ── */
  const oy = H - bottom - HT.out
  s += lab(L, oy + 4, 'out', { a: .34 }) + T(L, oy + 40, fmtDb(S.master), { size: 32, w: 400, x: TP.num }) + T(L + tw(fmtDb(S.master), 32) + 7, oy + 40, 'db', { size: 9, a: .4 })
  s += T(R0, oy + 40, 'peak ' + fmtDb(-3.1), { size: 8.5, a: .5, anchor: 'end' })
  const sx = L, sw = U, by = oy + 56, FD = db => sx + sw * volF(db)
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
await sheet('3 the column, close.png', 1440, 900, `S.panel.on = false`, [0, 0, 248, 900])
await sheet('4 the column, playing, a region chosen, the lines up.png', 1440, 900, `S.panel.on = false; TP.play = true; S.click = true; S.auto = true; TP.region = true; const t = S.tracks.find(x => x.name === 'hum'); S.sel = S.tracks.indexOf(t); const r = t.regs.slice().sort((a, b) => a.a - b.a)[1]; r.gain = 1.5; r.fi = .25; S.selR = [r.id]; S.focus = 'lanes'; jumpTo(18 + 2 / 4 + 1 / 16 + 37 / 3840)`, [0, 0, 248, 900])
await sheet('5 a small window, 1100 x 700.png', 1100, 700, `S.panel.on = false`)
process.exit(0)
