// node "design/transport panel draft 7/draft.mjs" — a DRAFT, drawn over the app's own page in a browser: the column as a
// composition after the one he showed (bauhaus's column, 2026-10-21: "이거!") — in the room's own colours and type, its
// shapes in hairlines and filled for what the room is doing:
//   play a large triangle at the head, stop a square and record a ring beside it, to the start small under them
//   the bar the song is in very large, beat . division . tick small at its foot, the time (SMPTE) small under it
//   the measure a square, the tempo a large figure in its ring of ticks
//   the cycle a triangle (filled, yellow, when on) with its bars said under it; the key, click, low latency as captions
//   the song a diagonal through the column: its parts ticks on it, the cycle a yellow length, the playhead a mark — and
//   the out a large ring on it, filled as loud as the mix, the fader a white square on the ring, a light that fills red
//   when the mix clips
//   how many tracks, large, and a key for a new one; what is chosen, small
//   at the foot, in small capitals: the tool, the mode, the grid, the nudge; auto and rubato; the two zooms
// No name of the song or the program. Nothing of this is in the app: the page is drawn over here, in this browser only.
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
  const { CW } = TP, p = curPos(), small = H < 820, f = clamp((H - FOOT_H - 380) / 498, .62, 1), Y = v => 26 + (v - 26) * f, z = small ? .8 : 1      // (z: a small window's shapes a fifth smaller)
  let s = R(0, 0, CW, H, { fill: K2 }) + R(CW - 1, 0, 1, H, { fill: INK, fa: .1 })
  const cap = (x, y, w, o = {}) => T(x, y, w, Object.assign({ size: 7.5, a: .38 }, o))
  const caps = (x, y, w, o = {}) => T(x, y, w.toUpperCase(), Object.assign({ size: 6, w: 600, a: .45, x: ' letter-spacing="1.1"' }, o))
  const chev = (x, y) => P('M' + n(x) + ' ' + n(y - 1.5) + 'l2.6 2.6 2.6 -2.6', { stroke: INK, sa: .5, sw: .9 })
  /* play at the head, large; stop and record beside it; to the start small */
  const playing = TP.play || (S.playing && !S.rec), stopped = !playing && !S.rec
  s += TP.tri(54 - (1 - z) * 20, Y(76), 62 * z, 72 * z, playing)
  s += TP.sq(150, Y(56), 30 * z, stopped)
  s += TP.disc(150, Y(104), 14.5 * z, !!S.rec, REC)
  s += R(136, Y(136) - 5, 1.2, 10, { fill: INK, fa: .7 }) + P('M146 ' + n(Y(136) - 5) + 'L138.5 ' + n(Y(136)) + 'L146 ' + n(Y(136) + 5) + 'Z', { stroke: INK, sa: .7, sw: .9, x: ' stroke-linejoin="round"' }) + cap(151, Y(136) + 3, 'start', { a: .45 })
  /* the bar, very large; the rest small at its foot; the time small under it */
  const pl = place(p).split('.'), bar = pl[0], bs = clamp(196 / (bar.length * .62), 60, small ? 84 : 124), by = Y(268)
  s += T(12, by, bar, { size: bs, w: 500, x: TP.num + ' letter-spacing="-5"' })
  const rx = 12 + tw(bar, bs, 500) - 5 * (bar.length - 1) + 8, rest = '.' + pl[1] + '.' + pl[2]
  s += T(rx, by, rest, { size: 17, w: 500, a: .9, x: TP.num }) + T(rx + tw(rest, 17, 500) + 4, by, '.' + pl[3], { size: 12, a: .55, x: TP.num })
  s += T(16, by + 24, smpte(p), { size: 10, a: .7, x: TP.num }) + cap(16 + tw(smpte(p), 10) + 8, by + 24, smpteRate().t + ' fps', { a: .32 })
  /* the measure a square, the tempo large in its ring */
  { const ms = 46 * z, mx = 16, my = Y(318)
    s += R(mx + .5, my + .5, ms - 1, ms - 1, { stroke: INK, sa: .75, sw: 1 }) + T(mx + ms / 2, my + ms / 2 + 3, meterName(), { size: 13, w: 500, anchor: 'middle', x: TP.num })
    const ph = p - Math.floor(p), nb = BEATS(), bi = Math.floor(ph * nb + 1e-9)
    for (let k = 0; k < nb; k++) s += k === bi ? R(mx + k * 7, my + ms + 6, 4.5, 4.5, { fill: INK }) : R(mx + k * 7 + .3, my + ms + 6.3, 3.9, 3.9, { stroke: INK, sa: .4, sw: .6 })
    const tx = 168, cy = Y(352), r = small ? 36 : 46
    for (let k = 0; k < 48; k++) { const a = k / 48 * 2 * Math.PI - Math.PI / 2, l = k % 12 ? 2.4 : 6; s += P('M' + n(tx + Math.cos(a) * r) + ' ' + n(cy + Math.sin(a) * r) + 'L' + n(tx + Math.cos(a) * (r - l)) + ' ' + n(cy + Math.sin(a) * (r - l)), { stroke: INK, sa: k % 12 ? .25 : .55, sw: .8 }) }
    { const a = ph * 2 * Math.PI - Math.PI / 2; s += Cc(tx + Math.cos(a) * (r + 4), cy + Math.sin(a) * (r + 4), 2.2, { fill: INK }) }
    const big = String(Math.floor(S.tempo)), dec = '.' + (+S.tempo).toFixed(2).split('.')[1]
    s += T(tx - 5, cy + 11 * z, big, { size: 34 * z, w: 500, anchor: 'middle', x: TP.num }) + T(tx - 5 + tw(big, 34 * z, 500) / 2 + 1, cy + 11 * z, dec, { size: 10, a: .55, x: TP.num }) + caps(tx, cy + 25 * z, 'bpm', { anchor: 'middle', a: .4 }) }
  /* the cycle a triangle; the key, click and low latency as captions */
  { const cx = 46, cy = Y(446) + (small ? 6 : 0), w = 54 * z, h = 47 * z
    s += TP.tri(cx, cy, w, h, S.cycle.on, SOLO, 'up') + cap(18, cy + h / 2 + 15, S.cycle.on ? 'cycle ' + Math.round(S.cycle.a + 1) + ' to ' + Math.round(S.cycle.b + 1) : 'cycle off', { a: .5, x: TP.num })
    const x = 126, y0 = Y(430)
    s += caps(x, y0, 'key') + T(x + 22, y0 + .5, S.key || '—', { size: 8.5, a: .6 })
    const bul = (y, on, word, c) => (on ? Cc(x + 3, y - 2.6, 3, { fill: c || INK }) : Cc(x + 3, y - 2.6, 2.6, { stroke: INK, sa: .55, sw: .8 })) + T(x + 11, y, word, { size: 8.5, a: on ? .85 : .45 })
    s += bul(y0 + 17, !!S.click, 'click') + bul(y0 + 32, !!S.lowLat, 'low latency', MON) }
  /* the foot: the hands, the mode, the grid, the nudge; the views; the zooms — small capitals */
  const y0 = H - FOOT_H - 76, C = [16, 92, 168]
  const pick = (k, y, label, v) => caps(C[k], y, label) + T(C[k], y + 12, v, { size: 9.5, a: .85, x: TP.num }) + chev(C[k] + tw(v, 9.5) + 4, y + 8.5)
  s += pick(0, y0, 'tool', toolWord(S.tool)) + pick(1, y0, 'mode', S.mode) + pick(2, y0, 'grid', gridName()) + pick(0, y0 + 28, 'nudge', S.nudge)
  const box = (x, y, on, word) => (on ? R(x, y - 7, 7, 7, { fill: INK }) : R(x + .4, y - 6.6, 6.2, 6.2, { stroke: INK, sa: .55, sw: .8 })) + T(x + 11, y, word, { size: 8.5, a: on ? .85 : .45 })
  s += box(C[1], y0 + 33, S.auto, 'automation') + box(C[1], y0 + 46, S.flex, 'rubato')
  const sl = (x, w, fz, label) => caps(x, y0 + 60, label) + R(x, y0 + 69, w, .6, { fill: INK, fa: .28 }) + R(x + w * fz - 2.6, y0 + 69 - 2.3, 5.2, 5.2, { fill: WHITE })
  s += sl(16, 64, zoomF(), 'zoom across') + sl(92, 64, clamp((S.rh - 20) / 100, 0, 1), 'zoom down')
  /* how many tracks, large; a new one; what is chosen */
  { const ty = y0 - 26, st = S.tracks[S.sel], rs = TP.region ? selRegs() : [], r = rs.length ? rs[0][0] : null, look = r ? regLook(r, rs[0][1]) : { c: st.c, outline: st.outline }
    s += T(14, ty, String(S.tracks.length), { size: 40, w: 500, x: TP.num }) + cap(16 + tw(String(S.tracks.length), 40, 500), ty, 'tracks', { a: .45 })
    s += Cc(212, ty - 13, 11.5, { stroke: INK, sa: .6, sw: 1 }) + P('M212 ' + n(ty - 19) + 'V' + n(ty - 7) + 'M206 ' + n(ty - 13) + 'H218', { stroke: INK, sa: .9, sw: 1.2 })
    const nm = asGiven(r ? (r.tag || r.name || rs[0][1].name) : st.name)
    s += R(92, ty - 16, 7, 7, { fill: look.c }) + T(103, ty - 9.5, fit(nm, 70, 8.5), { size: 8.5, a: .8 }) + cap(92, ty, r ? 'region' : 'track', { a: .3 })
    if (r) s += cap(92, ty + 10, 'gain ' + fmtDb(r.gain || 0) + '  tr ' + ((r.tr || 0) > 0 ? '+' : '') + (r.tr || 0), { a: .45, size: 7, x: TP.num + ' xml:space="preserve"' }) }
  /* the song a diagonal; the out a large ring on it */
  { const r = small ? 50 : 62, top = Y(500), bottom = y0 - 70, cx = 108, cy = Math.max(top + r + 10, (top + bottom) / 2 + 6), k = 1.05
    const A = [0, cy - cx * k], B = [CW, cy + (CW - cx) * k]
    const t0 = Math.max(0, (Y(470) + 40 - A[1]) / k), t1 = Math.min(CW, (bottom + 14 - A[1]) / k)       // (the line only where nothing else stands)
    const L0 = [t0, A[1] + t0 * k], L1 = [t1, A[1] + t1 * k], len = Math.hypot(L1[0] - L0[0], L1[1] - L0[1]), hole = r + 22, mid = Math.hypot(cx - L0[0], cy - L0[1])
    const shown = len - 2 * hole, at = b => { let d = shown * b / SONG_END; if (d > mid - hole) d += 2 * hole; return [L0[0] + (L1[0] - L0[0]) * d / len, L0[1] + (L1[1] - L0[1]) * d / len] }      // (the song along the line where it shows: it goes on past the ring)
    const ang = Math.atan2(L1[1] - L0[1], L1[0] - L0[0]), nx = -Math.sin(ang), ny = Math.cos(ang)
    s += P('M' + n(L0[0]) + ' ' + n(L0[1]) + 'L' + n(L1[0]) + ' ' + n(L1[1]), { stroke: INK, sa: .35, sw: 1 })
    /* the ring, over the line */
    const a0 = .75 * Math.PI, sweep = 1.5 * Math.PI, ang2 = v => a0 + sweep * v, pt = (v, rr) => [cx + Math.cos(ang2(v)) * rr, cy + Math.sin(ang2(v)) * rr]
    const arc = (v0, v1, rr) => { const [x0, y00] = pt(v0, rr), [x1, y1] = pt(v1, rr); return 'M' + n(x0) + ' ' + n(y00) + 'A' + rr + ' ' + rr + ' 0 ' + ((v1 - v0) * sweep > Math.PI ? 1 : 0) + ' 1 ' + n(x1) + ' ' + n(y1) }
    s += Cc(cx, cy, r + 6, { fill: K2 })
    s += P(arc(0, 1, r), { stroke: INK, sa: .1, sw: 11 }) + P(arc(0, TP.lv[0], r), { stroke: LEVEL, sa: .92, sw: 11 }) + P(arc(0, 1, r - 11), { stroke: INK, sa: .06, sw: 4 }) + P(arc(0, TP.lv[1], r - 11), { stroke: LEVEL, sa: .5, sw: 4 })
    for (const db of [-48, -24, -12, -6, 0, 6]) { const v = volF(db), [x0, y00] = pt(v, r + 8), [x1, y1] = pt(v, r + 12), [lx, ly] = pt(v, r + 21); s += P('M' + n(x0) + ' ' + n(y00) + 'L' + n(x1) + ' ' + n(y1), { stroke: INK, sa: .4, sw: .7 }) + cap(lx, ly + 2.5, db > 0 ? '+' + db : String(db).replace('-', '−'), { anchor: 'middle', size: 6.5, a: .38, x: TP.num }) }
    { const [x, y] = pt(volF(S.master), r); s += R(x - 5, y - 5, 10, 10, { fill: WHITE }) }
    s += T(cx, cy + 9, fmtDb(S.master), { size: small ? 24 : 28, w: 500, anchor: 'middle', x: TP.num }) + caps(cx, cy + 24, 'out', { anchor: 'middle', a: .4 })
    /* the light: red when the mix clips; the peak beside it */
    s += Cc(cx + r + 30, cy - r - 8, 6, { stroke: REC, sa: .8, sw: 1.2 }) + cap(cx + r + 30, cy - r + 10, 'peak ' + fmtDb(-3.1), { a: .45, anchor: 'middle', x: TP.num })
    /* the song's marks on the line, over the ring */
    for (const sc of SCENES) { const [x, y] = at(sc.a - 1); s += P('M' + n(x - nx * 3) + ' ' + n(y - ny * 3) + 'L' + n(x + nx * 3) + ' ' + n(y + ny * 3), { stroke: INK, sa: .45, sw: .7 }) }
    if (S.cycle.on) { const seg = (a, b) => { const [x0, y00] = at(a), [x1, y1] = at(b); return P('M' + n(x0) + ' ' + n(y00) + 'L' + n(x1) + ' ' + n(y1), { stroke: SOLO, sw: 3.4, sa: .95 }) }, cut = SONG_END * (mid - hole) / shown
      s += S.cycle.a < cut && S.cycle.b > cut ? seg(S.cycle.a, cut - 1e-6) + seg(cut + 1e-6, S.cycle.b) : seg(S.cycle.a, S.cycle.b) }
    { const [x, y] = at(p); s += Cc(x, y, 3.4, { fill: INK }) } }
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
