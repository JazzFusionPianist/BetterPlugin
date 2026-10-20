// node "design/transport panel draft 2/draft.mjs" — a DRAFT, drawn over the app's own page in a browser: draft 1's column
// down the left (01 position and 05 out as he liked them), with 02 transport, 03 time and 04 edit drawn again in shapes,
// as bauhaus speaks — a triangle, a square, a circle — but in hairlines, as an instrument would:
//   02 transport  play a triangle, stop a square, record a circle: the one the room is in is filled (stopped: the square);
//                 cycle a disc, click a triangle, low latency a diamond, filled when on; the song as a line under them
//   03 time       the tempo a dial (its ring of ticks, a dot going round once a bar), the measure a square (its beats in
//                 it, the one sounding filled), the key a triangle
//   04 edit       one bar as a ruler: the grid's lines on it as tall ticks, how far one nudge goes as a step laid on it
// and, through the room: a level's handle a small square filled white (the tracks' rows and the mixer's faders), the
// r i m s keys' edges a hairline. His asks, 2026-10-20 ("2 트랜스포트 3 타임 4 에딧 쪽 … 훨씬 더 감각적으로 … 다양한 모양을
// 살려서", "볼륨 페이더 손잡이도 속을 흰색으로 꽉 채운 작은 정사각형", "R i m s 버튼들 outer edge가 너무 두꺼워"). No name at the
// column's head (his rule). Nothing of this is in the app: the page is drawn over here, in this browser only.
import { open, PAGE } from '../../test/cdp.mjs'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))

const KIT = `
SKIN_BANDS.panel = [0, 0, 236]
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
  chev (x, y) { return P('M' + n(x - 3.5) + ' ' + n(y - 1.8) + 'l3.5 3.5 3.5 -3.5', { stroke: INK, sa: .45, sw: 1 }) },
}
SKINS.left.panel = () => {
  const { CW, L } = TP, R0 = CW - L, U = R0 - L, p = curPos(), GAP = H >= 820 ? 36 : 24
  let s = R(0, 0, CW, H, { fill: K2 }) + R(CW - 1, 0, 1, H, { fill: INK, fa: .1 })
  /* 01 position */
  s += TP.head(30, '01', 'position')
  s += TP.fields(L, 78, 30, place(p).split('.'), ['bar', 'beat', 'div', 'tick'], { widths: [3, 1, 1, 3], gap: 4, keep: [0, 1, 1, 1] })
  s += TP.fields(L, 128, 16, smpte(p).split(/[:;]/), ['h', 'm', 's', 'f'], { sep: smpteRate().drop ? ';' : ':', gap: 3, keep: [0, 0, 1, 1] })
  const fps = smpteRate().t + ' fps', fw = tw(fps, 8) + 10
  s += R(R0 - fw + .5, 115.5, fw - 1, 15, { rx: 2, stroke: INK, sa: .22 }) + T(R0 - fw / 2, 126, fps, { size: 8, a: .55, anchor: 'middle' })
  /* 02 transport: the three shapes of the room's states, the one it is in filled */
  let y = 142 + GAP
  s += TP.head(y, '02', 'transport')
  const c2 = y + 38, base = c2 + 22, slot = k => L + U * (k + .5) / 4, playing = TP.play || (S.playing && !S.rec), stopped = !playing && !S.rec
  s += R(slot(0) - 8, c2 - 7, 1.3, 14, { fill: INK, fa: .85 }) + P('M' + n(slot(0) + 7) + ' ' + n(c2 - 7) + 'L' + n(slot(0) - 4) + ' ' + n(c2) + 'L' + n(slot(0) + 7) + ' ' + n(c2 + 7) + 'Z', { stroke: INK, sa: .8, sw: 1, x: ' stroke-linejoin="round"' })
  s += TP.tri(slot(1) + 2, c2, 22, 25, playing)
  s += TP.sq(slot(2), c2, 21, stopped)
  s += TP.disc(slot(3), c2, 12, !!S.rec, REC)
  s += R(L, base, U, .6, { fill: INK, fa: .3 })
  ;['start', 'play', 'stop', 'record'].forEach((w, k) => { s += R(slot(k) - .3, base, .6, 4, { fill: INK, fa: .45 }) + T(slot(k), base + 15, w, { size: 7.5, a: .42, anchor: 'middle' }) })
  /* cycle, click, low latency: a disc, a triangle, a diamond */
  const c3 = base + 40, lamp = (x, shape, word, on) => shape + T(x + 15, c3 + 3.4, word, { size: 9.5, a: on ? .95 : .5 })
  s += lamp(L, TP.disc(L + 5, c3, 5, S.cycle.on, SOLO), 'cycle', S.cycle.on)
  s += lamp(L + 68, TP.tri(L + 68 + 5, c3 - .5, 10.5, 9.5, !!S.click, INK, 'up'), 'click', !!S.click)
  s += lamp(L + 132, TP.dia(L + 132 + 5, c3, 5.5, !!S.lowLat, MON), 'low lat', !!S.lowLat)
  /* the song as a line: its parts, the cycle on it, the playhead */
  const my = c3 + 34, end = SONG_END, X = b => L + U * b / end
  s += R(L, my, U, .8, { fill: INK, fa: .3 })
  for (const sc of SCENES) s += R(X(sc.a - 1), my - 3, .7, 6.8, { fill: INK, fa: .38 })
  if (S.cycle.on) s += R(X(S.cycle.a), my - 2, X(S.cycle.b) - X(S.cycle.a), 4.8, { fill: SOLO, fa: .9 })
  s += P('M' + n(X(p)) + ' ' + (my - 8) + 'l-3.2 -5h6.4z', { fill: INK }) + R(X(p) - .4, my - 8, .8, 14, { fill: INK, fa: .9 })
  s += T(L, my + 17, '1', { size: 7.5, a: .38, x: TP.num }) + T(R0, my + 17, String(Math.round(end) + 1), { size: 7.5, a: .38, anchor: 'end', x: TP.num })
  if (S.cycle.on) s += T((X(S.cycle.a) + X(S.cycle.b)) / 2, my + 17, 'cycle ' + Math.round(S.cycle.a + 1) + ' – ' + Math.round(S.cycle.b + 1), { size: 7.5, a: .6, anchor: 'middle', x: TP.num })
  /* 03 time: the tempo a dial, the measure a square, the key a triangle */
  y = my + 20 + GAP
  s += TP.head(y, '03', 'time')
  const c4 = y + 46, tx = L + 28, r = 27, ph = p - Math.floor(p)
  for (let k = 0; k < 32; k++) { const a = k / 32 * 2 * Math.PI - Math.PI / 2, l = k % 8 ? 2.6 : 5.5; s += P('M' + n(tx + Math.cos(a) * r) + ' ' + n(c4 + Math.sin(a) * r) + 'L' + n(tx + Math.cos(a) * (r - l)) + ' ' + n(c4 + Math.sin(a) * (r - l)), { stroke: INK, sa: k % 8 ? .3 : .6, sw: .8 }) }
  { const a = ph * 2 * Math.PI - Math.PI / 2; s += Cc(tx + Math.cos(a) * (r + 3.5), c4 + Math.sin(a) * (r + 3.5), 2, { fill: INK }) }
  s += T(tx, c4 + 3, (+S.tempo).toFixed(2), { size: 13, anchor: 'middle', x: TP.num }) + T(tx, c4 + 13, 'bpm', { size: 6.5, a: .45, anchor: 'middle' })
  const mx = L + 98, ms = 50
  s += R(mx - ms / 2 + .5, c4 - ms / 2 + .5, ms - 1, ms - 1, { stroke: INK, sa: .8, sw: 1 }) + T(mx, c4 + 2, meterName(), { size: 15, anchor: 'middle', x: TP.num })
  const nb = BEATS(), bi = Math.floor(ph * nb + 1e-9), bw = 4.5, bg = 3.5, b0 = mx - (nb * bw + (nb - 1) * bg) / 2
  for (let k = 0; k < nb; k++) s += k === bi ? R(b0 + k * (bw + bg), c4 + 12, bw, bw, { fill: INK }) : R(b0 + k * (bw + bg) + .3, c4 + 12.3, bw - .6, bw - .6, { stroke: INK, sa: .45, sw: .6 })
  const kx = L + 168
  s += TP.tri(kx, c4 + 1, 56, 50, false, INK, 'up') + T(kx, c4 + 18, S.key || '—', { size: 12, a: S.key ? 1 : .45, anchor: 'middle' })
  ;[[tx, 'tempo'], [mx, 'measure'], [kx, 'key']].forEach(([x, w]) => { s += T(x, c4 + 44, w, { size: 7.5, a: .42, anchor: 'middle' }) })
  /* 04 edit: one bar as a ruler — the grid's lines on it, one nudge laid along it */
  y = c4 + 44 + GAP
  s += TP.head(y, '04', 'edit')
  const rw = y + 26, ru = rw + 26, gN = (m => m ? +m[1] / WHOLE() : BEATS())(String(gridName()).match(/^1\\/(\\d+)/)), fN = 16 / WHOLE(), nw = U * Math.min(1, nudgeBars())
  s += T(L, rw, 'grid', { size: 10, a: .55 }) + T(L + 32, rw, gridName(), { size: 12.5, x: TP.num }) + TP.chev(L + 32 + tw(gridName(), 12.5) + 10, rw - 4)
  s += T(R0 - 14, rw, S.nudge, { size: 12.5, anchor: 'end', x: TP.num }) + T(R0 - 14 - tw(S.nudge, 12.5) - 8, rw, 'nudge', { size: 10, a: .55, anchor: 'end' }) + TP.chev(R0 - 3.5, rw - 4)
  s += R(L, ru, U, .8, { fill: INK, fa: .4 })
  for (let k = 0; k <= fN; k++) s += R(L + U * k / fN - .3, ru - 3, .6, 3, { fill: INK, fa: .25 })
  for (let k = 0; k <= gN; k++) s += R(L + U * k / gN - .35, ru - 9, .7, 9, { fill: INK, fa: .75 })
  for (let k = 0; k < 4 && (k + 1) * nw <= U; k++) s += R(L + k * nw + (k ? 1 : 0), ru + 3, nw - (k ? 1 : 0), 3, { fill: INK, fa: k ? .18 : .9 })
  s += T(L, ru + 19, 'one nudge', { size: 7.5, a: .55 }) + T(R0, ru + 19, 'one bar', { size: 7.5, a: .38, anchor: 'end' })
  /* 05 out: at the foot of the column */
  const oy = Math.max(ru + 18 + GAP, H - FOOT_H - 132)
  s += TP.head(oy, '05', 'out')
  s += T(L, oy + 40, fmtDb(S.master), { size: 26, w: 400, x: TP.num }) + T(L + tw(fmtDb(S.master), 26) + 8, oy + 40, 'db', { size: 9, a: .45 })
  s += T(R0, oy + 40, 'peak ' + fmtDb(-3.1), { size: 8.5, a: .55, anchor: 'end' })
  const sx = L, sw = U, by = oy + 58, F = db => sx + sw * volF(db)
  TP.lv.forEach((f, c) => { const yy = by + c * 7; s += R(sx, yy, sw, 4, { fill: INK, fa: .08 }) + R(sx, yy, sw * f, 4, { fill: LEVEL, fa: .9 }) + R(sx + sw * (f + .04), yy, 1.2, 4, { fill: INK, fa: .7 }) + T(sx - 7, yy + 4.2, c ? 'r' : 'l', { size: 7, a: .38 }) })
  const ty = by + 18
  for (const db of [-48, -36, -24, -18, -12, -9, -6, -3, 0, 3, 6]) s += R(F(db) - .3, ty, .6, [-48, -24, -12, -6, 0, 6].includes(db) ? 5 : 3, { fill: INK, fa: .4 })
  for (const db of [-48, -24, -12, -6, 0, 6]) s += T(F(db), ty + 15, db > 0 ? '+' + db : String(db).replace('-', '−'), { size: 7.5, a: .42, anchor: 'middle', x: TP.num })
  s += P('M' + n(F(S.master)) + ' ' + (by - 3) + 'l-3.5 -6h7z', { fill: INK }) + R(F(S.master) - .4, by - 3, .8, 17, { fill: INK, fa: .55 })
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
await sheet('3 a small window, 1100.png', 1100, 700, `S.panel.on = false`)
await sheet('4 the column, stopped.png', 1440, 900, `S.panel.on = false`, [0, 0, 236, 900])
await sheet('5 the column, playing, click on.png', 1440, 900, `S.panel.on = false; TP.play = true; S.click = true; S.lowLat = true; jumpTo(18 + 2 / 4 + 1 / 16 + 37 / 3840)`, [0, 0, 236, 900])
await sheet('6 the rows, close.png', 1440, 900, `S.panel.on = true; S.panel.tab = 'mixer'; S.panel.h = 316`, [236, 72, 420, 150, 2.5])
await sheet('7 the strips, close.png', 1440, 900, `S.panel.on = true; S.panel.tab = 'mixer'; S.panel.h = 316`, [236, 560, 520, 330, 2])
process.exit(0)
