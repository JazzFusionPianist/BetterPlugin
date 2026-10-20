// node "design/transport panel draft 6/draft.mjs" — a DRAFT, drawn over the app's own page in a browser: the column as a
// composition, not a list (his ask, 2026-10-21: "각 요소들의 위치를 랜덤하게 막 섞어도 돼 … 훨씬 더 예술적 … 중요한 기능과
// 안중요한 기능의 사이즈 크기 차이가 더 났으면 … 구분 됐다는 느낌 없이", with bauhaus's column shown as what he means):
//   the bar the song is in, very large; beat, division and tick small at its foot; the time as SMPTE running up the edge
//   play a large triangle, stop a square, record a ring — the one the room is in filled
//   the song as a long diagonal through the column: its parts as ticks on it, the cycle a yellow length, the playhead a mark
//   the tempo a large figure in its ring of ticks; the measure a small square; the key a small triangle
//   the rest as captions, small: cycle, click, low latency; the tool, the mode, the grid, the nudge; the views, the zooms;
//   what is chosen and how many tracks
//   the out a large ring that fills as loud as the mix, its level in it, the fader a white square on the ring
// In the room's own type and colours; no name of the song or the program. Nothing of this is in the app: the page is
// drawn over here, in this browser only.
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
  const { CW } = TP, p = curPos(), f = clamp((H - FOOT_H) / 878, .74, 1), Y = v => v * f
  let s = R(0, 0, CW, H, { fill: K2 }) + R(CW - 1, 0, 1, H, { fill: INK, fa: .1 })
  const cap = (x, y, w, o = {}) => T(x, y, w, Object.assign({ size: 7.5, a: .36 }, o))
  const val = (x, y, w, o = {}) => T(x, y, w, Object.assign({ size: 8.5, a: .78, x: TP.num }, o))
  /* the bar, very large; beat . division . tick small at its foot */
  const pl = place(p).split('.'), bar = pl[0], bs = clamp(210 / (bar.length * .6), 60, 128)
  s += T(14, Y(124), bar, { size: bs, w: 300, x: TP.num + ' letter-spacing="-4"' })
  const rx = 14 + tw(bar, bs, 300) - 4 * (bar.length - 1) + 6
  s += T(rx, Y(124), '.' + pl[1] + '.' + pl[2], { size: 22, w: 400, a: .9, x: TP.num }) + T(rx + tw('.' + pl[1] + '.' + pl[2], 22) + 2, Y(124), '.' + pl[3], { size: 13, a: .55, x: TP.num })
  s += cap(16, Y(142), 'bar', { a: .3 }) + cap(rx + 4, Y(142), 'beat  div  tick', { a: .3, x: ' xml:space="preserve"' })
  /* the time as SMPTE, up the right edge */
  s += G(T(0, 0, smpte(p) + '    ' + smpteRate().t + ' fps', { size: 9, a: .55, x: TP.num + ' xml:space="preserve" letter-spacing="1.2"' }), 'translate(' + (CW - 12) + ' ' + Y(250) + ') rotate(-90)')
  /* play large, stop, record; to the start small */
  const playing = TP.play || (S.playing && !S.rec), stopped = !playing && !S.rec, ty = Y(222)
  s += TP.tri(48, ty, 52, 60, playing)
  s += TP.sq(112, ty + 12, 30, stopped)
  s += TP.disc(164, ty + 16, 13, !!S.rec, REC)
  s += R(18, Y(290) - 5, 1.2, 10, { fill: INK, fa: .7 }) + P('M28 ' + n(Y(290) - 5) + 'L20.5 ' + n(Y(290)) + 'L28 ' + n(Y(290) + 5) + 'Z', { stroke: INK, sa: .7, sw: .9, x: ' stroke-linejoin="round"' }) + cap(34, Y(290) + 3, 'to the start', { a: .45 })
  /* cycle, click, low latency: captions with their shapes */
  const cl = (y, shape, word, on) => shape + T(124, y + 3, word, { size: 8, a: on ? .85 : .4 })
  s += cl(Y(282), TP.disc(116, Y(282), 3, S.cycle.on, SOLO), S.cycle.on ? 'cycle ' + Math.round(S.cycle.a + 1) + '–' + Math.round(S.cycle.b + 1) : 'cycle', S.cycle.on)
  s += cl(Y(296), TP.tri(116, Y(296) - .3, 6.5, 5.6, !!S.click, INK, 'up'), 'click', !!S.click) + cl(Y(310), TP.dia(116, Y(310), 3.4, !!S.lowLat, MON), 'low latency', !!S.lowLat)
  /* the song as a diagonal: from the right edge down to the left */
  const A = [CW - 30, Y(336)], B = [14, Y(560)], at = b => [A[0] + (B[0] - A[0]) * b / SONG_END, A[1] + (B[1] - A[1]) * b / SONG_END]
  const ang = Math.atan2(B[1] - A[1], B[0] - A[0]), nx = -Math.sin(ang), ny = Math.cos(ang)
  s += P('M' + n(A[0]) + ' ' + n(A[1]) + 'L' + n(B[0]) + ' ' + n(B[1]), { stroke: INK, sa: .22, sw: .8 })
  for (const sc of SCENES) { const [x, y] = at(sc.a - 1); s += P('M' + n(x - nx * 3) + ' ' + n(y - ny * 3) + 'L' + n(x + nx * 3) + ' ' + n(y + ny * 3), { stroke: INK, sa: .35, sw: .7 }) }
  if (S.cycle.on) { const [x0, y0] = at(S.cycle.a), [x1, y1] = at(S.cycle.b); s += P('M' + n(x0) + ' ' + n(y0) + 'L' + n(x1) + ' ' + n(y1), { stroke: SOLO, sw: 3.5, sa: .9 }) }
  { const [x, y] = at(p); s += Cc(x, y, 3.2, { fill: INK }) + P('M' + n(x - nx * 9) + ' ' + n(y - ny * 9) + 'L' + n(x + nx * 9) + ' ' + n(y + ny * 9), { stroke: INK, sa: .7, sw: .8 }) }
  { const [x, y] = at(0); s += cap(x + 4, y - 6, '1', { a: .3, x: TP.num }) } { const [x, y] = at(SONG_END); s += cap(x, y + 12, String(Math.round(SONG_END) + 1), { a: .3, x: TP.num }) }
  /* the tempo, large in its ring; the measure, small; the key, smaller */
  { const tx = 74, cy = Y(432), r = 44, ph = p - Math.floor(p)
    for (let k = 0; k < 48; k++) { const a = k / 48 * 2 * Math.PI - Math.PI / 2, l = k % 12 ? 2.4 : 6; s += P('M' + n(tx + Math.cos(a) * r) + ' ' + n(cy + Math.sin(a) * r) + 'L' + n(tx + Math.cos(a) * (r - l)) + ' ' + n(cy + Math.sin(a) * (r - l)), { stroke: INK, sa: k % 12 ? .25 : .55, sw: .8 }) }
    { const a = ph * 2 * Math.PI - Math.PI / 2; s += Cc(tx + Math.cos(a) * (r + 4), cy + Math.sin(a) * (r + 4), 2.2, { fill: INK }) }
    const big = String(Math.floor(S.tempo)), dec = '.' + (+S.tempo).toFixed(2).split('.')[1]
    s += T(tx - 4, cy + 12, big, { size: 34, w: 300, anchor: 'middle', x: TP.num }) + T(tx - 4 + tw(big, 34, 300) / 2 + 1, cy + 12, dec, { size: 11, a: .6, x: TP.num }) + cap(tx, cy + 26, 'bpm', { anchor: 'middle', a: .35 })
    const mx = 168, my2 = Y(408), ms = 30
    s += R(mx + .5, my2 + .5, ms - 1, ms - 1, { stroke: INK, sa: .7, sw: .9 }) + T(mx + ms / 2, my2 + ms / 2 + 2, meterName(), { size: 10.5, anchor: 'middle', x: TP.num })
    const nb = BEATS(), bi = Math.floor(ph * nb + 1e-9)
    for (let k = 0; k < nb; k++) s += k === bi ? R(mx + k * 6.5, my2 + ms + 5, 4, 4, { fill: INK }) : R(mx + k * 6.5 + .3, my2 + ms + 5.3, 3.4, 3.4, { stroke: INK, sa: .4, sw: .6 })
    s += TP.tri(214, Y(470), 18, 16, false, INK, 'up').replace('stroke-opacity="0.8"', 'stroke-opacity="0.5"') + cap(214, Y(470) + 20, 'key ' + (S.key || '—'), { anchor: 'middle', a: .4 }) }
  /* captions: the hands, the mode, the grid, the nudge — a small block of their own */
  { const x = 128, y0 = Y(512), rows = [['tool', toolWord(S.tool)], ['mode', S.mode], ['grid', gridName()], ['nudge', S.nudge]]
    rows.forEach(([k, v], i) => { s += cap(x, y0 + i * 13, k, { a: .32 }) + val(x + 34, y0 + i * 13, v) }) }
  /* the views and the zooms, small */
  { const y0 = Y(526), a = on => on ? .85 : .38
    const autoG = (x, c5) => { const pts = [[x, c5 + 2], [x + 3.5, c5 - 2], [x + 7, c5 + 1], [x + 10, c5 - 3]]; return P('M' + pts.map(v => n(v[0]) + ' ' + n(v[1])).join('L'), { stroke: INK, sa: a(S.auto), sw: .8 }) + pts.map(v => Cc(v[0], v[1], 1, { fill: INK, fa: a(S.auto) })).join('') }
    s += autoG(16, y0) + T(31, y0 + 3, 'auto', { size: 8, a: a(S.auto) }) + (S.auto ? R(31, y0 + 5.5, tw('auto', 8), .7, { fill: INK, fa: .7 }) : '')
    s += T(62, y0 + 3, 'rubato', { size: 8, a: a(S.flex) })
    const sl = (y, fz, w) => R(16, y, 80, .6, { fill: INK, fa: .25 }) + R(16 + 80 * fz - 2.5, y - 2.2, 5, 5, { fill: WHITE }) + cap(102, y + 3, w, { a: .32 })
    s += sl(y0 + 18, zoomF(), 'zoom') + sl(y0 + 31, clamp((S.rh - 20) / 100, 0, 1), 'rows') }
  /* what is chosen; how many tracks */
  { const st = S.tracks[S.sel], rs = TP.region ? selRegs() : [], r = rs.length ? rs[0][0] : null, look = r ? regLook(r, rs[0][1]) : { c: st.c, outline: st.outline }, y0 = Y(590)
    s += R(16, y0 - 7, 8, 8, { fill: look.c }) + T(30, y0, fit(asGiven(r ? (r.tag || r.name || rs[0][1].name) : st.name), 90, 9.5), { size: 9.5, a: .9 }) + P(shapePath(30 + Math.min(90, tw(asGiven(r ? (r.tag || r.name || rs[0][1].name) : st.name), 9.5)) + 7, y0 - 7, 14, 7, SHAPES[look.outline], .5), { fill: INK, fa: .7 })
    s += cap(16, y0 + 12, r ? 'region' : 'track', { a: .3 })
    if (r) { const sg = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v || 0); s += cap(16, y0 + 25, 'gain ' + fmtDb(r.gain || 0) + '   tr ' + sg(r.tr) + '   fine ' + sg(r.ft) + '   fades ' + (+(r.fi || 0)).toFixed(2) + ' ' + (+(r.fo || 0)).toFixed(2), { a: .5, x: TP.num + ' xml:space="preserve"' }) }
    s += cap(CW - 34, y0, S.tracks.length + ' tracks', { anchor: 'end', a: .35, x: TP.num }) + R(CW - 29.5, y0 - 8.5, 10, 10, { rx: 2, stroke: INK, sa: .45, sw: .7 }) + P('M' + n(CW - 24.5) + ' ' + n(y0 - 6) + 'V' + n(y0 - .5) + 'M' + n(CW - 27.2) + ' ' + n(y0 - 3.3) + 'H' + n(CW - 21.8), { stroke: INK, sa: .8, sw: .9 }) }
  /* the out: a large ring filled as loud as the mix; the fader a white square on it */
  { const cx = 104, cy = H - FOOT_H - 98, r = 70, a0 = .75 * Math.PI, sweep = 1.5 * Math.PI, ang = v => a0 + sweep * v, pt = (v, rr) => [cx + Math.cos(ang(v)) * rr, cy + Math.sin(ang(v)) * rr]
    const arc = (v0, v1, rr) => { const [x0, y0] = pt(v0, rr), [x1, y1] = pt(v1, rr); return 'M' + n(x0) + ' ' + n(y0) + 'A' + rr + ' ' + rr + ' 0 ' + ((v1 - v0) * sweep > Math.PI ? 1 : 0) + ' 1 ' + n(x1) + ' ' + n(y1) }
    s += P(arc(0, 1, r), { stroke: INK, sa: .1, sw: 9 }) + P(arc(0, TP.lv[0], r), { stroke: LEVEL, sa: .9, sw: 9 }) + P(arc(0, 1, r - 9), { stroke: INK, sa: .06, sw: 4 }) + P(arc(0, TP.lv[1], r - 9), { stroke: LEVEL, sa: .55, sw: 4 })
    for (const db of [-48, -24, -12, -6, 0, 6]) { const v = volF(db), [x0, y0] = pt(v, r + 7), [x1, y1] = pt(v, r + 11), [lx, ly] = pt(v, r + 20); s += P('M' + n(x0) + ' ' + n(y0) + 'L' + n(x1) + ' ' + n(y1), { stroke: INK, sa: .4, sw: .7 }) + cap(lx, ly + 2.5, db > 0 ? '+' + db : String(db).replace('-', '−'), { anchor: 'middle', size: 6.5, a: .38, x: TP.num }) }
    { const [x, y] = pt(volF(S.master), r); s += R(x - 4.5, y - 4.5, 9, 9, { fill: WHITE }) }
    s += T(cx, cy + 10, fmtDb(S.master), { size: 30, w: 300, anchor: 'middle', x: TP.num }) + cap(cx, cy + 26, 'out db', { anchor: 'middle', a: .35 }) + cap(cx, cy + 50, 'peak ' + fmtDb(-3.1), { anchor: 'middle', a: .45, x: TP.num }) }
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
await sheet('4 the column, playing at bar 19, a region chosen, the lines up.png', 1440, 900, `S.panel.on = false; TP.play = true; S.click = true; S.auto = true; TP.region = true; const t = S.tracks.find(x => x.name === 'hum'); S.sel = S.tracks.indexOf(t); const r = t.regs.slice().sort((a, b) => a.a - b.a)[1]; r.gain = 1.5; r.fi = .25; S.selR = [r.id]; S.focus = 'lanes'; jumpTo(18 + 2 / 4 + 1 / 16 + 37 / 3840)`, [0, 0, 248, 900])
await sheet('5 a small window, 1100 x 700.png', 1100, 700, `S.panel.on = false`)
process.exit(0)
