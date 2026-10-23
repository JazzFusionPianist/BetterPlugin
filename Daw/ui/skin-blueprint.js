/* ── blueprint: the song as a drawing (design/themes draft 2, sheet 5) ──
   The window a sheet with its border and zones; over the room the drawing's heading and a scale bar; at its foot a
   title block that holds the transport. Each track called out by a numbered balloon, its name in capitals, boxes for its
   buttons; regions hatched in outline; the markers section lines; the cycle a dimension; the playhead a centre line;
   the mixer its elevation. */
const BPR = { red: '#FF7A59' }
const bpLine = (x1, y1, x2, y2, o = {}) => P(`M${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}`, { stroke: o.c || INK, sw: o.w || .8, sa: o.a == null ? .9 : o.a, dash: o.dash })
const bpBox = (x, y, on, c) => on ? R(x, y, 7, 7, { fill: c || INK }) : R(x + .5, y + .5, 6, 6, { stroke: INK, sw: .7, sa: .8 })
const bpWords = n0 => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'][n0] || String(n0)
/* the sheet's border and its zones, round the whole window */
function bpBorder () {
  const B = 4, w = W - 2 * B, h = H - 2 * B
  let s = R(B + .5, B + .5, w - 1, h - 1, { stroke: INK, sw: 1.1, sa: .75 })
  for (let k = 0; k < 12; k++) {
    const x = B + w * k / 12, xm = x + w / 24
    if (k) s += bpLine(x, B, x, B + 5, { a: .5, w: .6 }) + bpLine(x, H - B - 5, x, H - B, { a: .5, w: .6 })
    s += T(xm, B + 7, String(k + 1), { size: 5.5, a: .45, anchor: 'middle' }) + T(xm, H - B - 2, String(k + 1), { size: 5.5, a: .45, anchor: 'middle' })
  }
  for (let k = 0; k < 8; k++) {
    const y = B + h * k / 8, ym = y + h / 16 + 2
    if (k) s += bpLine(B, y, B + 5, y, { a: .5, w: .6 }) + bpLine(W - B - 5, y, W - B, y, { a: .5, w: .6 })
    s += T(B + 3.5, ym, String.fromCharCode(65 + k), { size: 5.5, a: .45, anchor: 'middle' }) + T(W - B - 3.5, ym, String.fromCharCode(65 + k), { size: 5.5, a: .45, anchor: 'middle' })
  }
  return `<g pointer-events="none">${s}</g>`
}
SKINS.top.blueprint = () => {
  const h = SKIN_BANDS.blueprint[0], tracks = S.tracks.filter(t => t.kind !== 'stack').length
  let s = R(0, 0, W, h, { fill: K1 }) + R(0, 0, W, h, { fill: 'url(#th-grid)' })
  s += T(26, 30, 'arrangement  —  plan', { size: 12, w: 600, x: ' xml:space="preserve"' }) + T(26, 46, `${bpWords(tracks)} tracks   ${SONG_END + 1} bars   all units in bars`, { size: 8, a: .7, x: ' xml:space="preserve"' })
  /* the scale: eight bars as drawn now */
  const sb = Math.min(320, 8 * PXB), sx = W - 30 - sb
  s += R(sx, 22, sb / 2, 3.5, { fill: INK }) + R(sx + sb / 2 + .5, 22.5, sb / 2 - 1, 2.5, { stroke: INK, sw: .6 }) + T(sx, 38, '0', { size: 7.5, anchor: 'middle' }) + T(sx + sb / 2, 38, sb >= 8 * PXB - .5 ? '4' : '', { size: 7.5, anchor: 'middle' }) + T(sx + sb, 38, sb >= 8 * PXB - .5 ? '8 bars' : `${+(sb / PXB).toFixed(1)} bars`, { size: 7.5, anchor: 'middle' })
  return s + bpBorder() + hline(0, W, h - .5, .3)
}
/* the title block, which holds the transport */
SKINS.foot.blueprint = y0 => {
  let s = R(0, y0, W, DECK_H, { fill: K1 }) + R(0, y0, W, DECK_H, { fill: 'url(#th-grid)' }) + hline(0, W, y0 + .5, .3)
  const bw = 430, bh = 92, bx0 = W - 26 - bw, by0 = y0 + 10
  s += R(bx0, by0, bw, bh, { fill: K2, fa: .6 }) + R(bx0 + .5, by0 + .5, bw - 1, bh - 1, { stroke: INK, sw: 1.2 })
  const cell = (x, y, w, h, k, v, big, a, id) => R(x + .5, y + .5, w - 1, h - 1, { stroke: INK, sw: .6, sa: .8 }) + T(x + 5, y + 9, k, { size: 5.8, a: .65 }) + T(x + 5, y + h - 6, v, { size: big ? 12 : 9, w: big ? 600 : 500, x: id ? ` id="${id}"` : '' }) + (a ? hit(x, y, w, h, a) : '')
  const p = curPos()                                                                 // (no name in it: neither the song's nor the program's, his rule)
  s += cell(bx0, by0, 215, 30, 'bar', readout(p), true, 'pos', 'bp-bar') + cell(bx0 + 215, by0, 215, 30, 'time', clock(p), true, null, 'bp-time')
  s += cell(bx0, by0 + 30, 108, 30, 'tempo', (+S.tempo).toFixed(2), false, 'tempo') + cell(bx0 + 108, by0 + 30, 107, 30, 'metre', meterName(), false, 'meter') + cell(bx0 + 215, by0 + 30, 108, 30, 'key', S.key ? asGiven(S.key.toUpperCase()) : '—', false, 'key') + cell(bx0 + 323, by0 + 30, 107, 30, 'grid', S.grid, false, 'grid')
  SKV.field.pos = { x: bx0 + 2, y: by0 + 8, w: 200, h: 20 }; SKV.field.tempo = { x: bx0 + 2, y: by0 + 38, w: 100, h: 20 }; SKV.field.meter = { x: bx0 + 108, y: by0 + 30, w: 107, h: 30 }; SKV.field.key = { x: bx0 + 217, y: by0 + 38, w: 100, h: 20 }; SKV.field.grid = { x: bx0 + 323, y: by0 + 30, w: 107, h: 30 }
  s += R(bx0 + .5, by0 + 60.5, bw - 1, 31, { stroke: INK, sw: .6, sa: .8 }) + T(bx0 + 5, by0 + 69, 'transport', { size: 5.8, a: .65 })
  const tr = [['tostart', '⏮'], ['play', '▶'], ['stop', '■'], ['rec', '●']]
  tr.forEach(([a, g], k) => { const x = bx0 + 96 + k * 32, y = by0 + 77, on = a === 'play' ? S.playing && !S.rec : a === 'rec' ? !!S.rec : false; s += Cc(x, y, 9.5, on ? { fill: INK } : { stroke: INK, sw: .8 }) + `<text x="${x + (a === 'play' ? 1 : 0)}" y="${y + 3.2}" text-anchor="middle" font-size="8.5" fill="${on ? K1 : a === 'rec' ? BPR.red : INK}">${g}</text>` + hit(x - 12, y - 12, 24, 24, a) })
  const flag = (x, t, on, a) => T(x, by0 + 81, `${t} ${on ? 'on' : 'off'}`, { size: 7.5, a: on ? 1 : .55, x: ' xml:space="preserve"' }) + hit(x - 4, by0 + 70, tw(`${t} ${on ? 'on' : 'off'}`, 7.5) + 8, 18, a)
  s += flag(bx0 + 238, 'cycle', S.cycle.on, 'loop') + flag(bx0 + 304, 'click', !!S.click, 'click') + flag(bx0 + 366, 'llm', !!S.lowLat, 'lowlat')
  /* the rest of the drawing's notes, at the left */
  const note = (x, k, v, a) => { const t = `${k} ${v}`; SKV.field[a] = { x: x - 4, y: y0 + 22, w: tw(t, 8) + 8, h: 18 }; return T(x, y0 + 34, t, { size: 8, x: ' xml:space="preserve"' }) + (a ? hit(x - 4, y0 + 22, tw(t, 8) + 8, 18, a) : '') }
  let nx = 30
  for (const [k, v, a] of [['nudge', S.nudge, 'nudge'], ['out', fmtDb(S.master) + ' db', 'master']]) { s += note(nx, k, v, a); nx += tw(`${k} ${v}`, 8) + 26 }
  s += T(30, y0 + 58, 'notes', { size: 6, a: .6 }) + T(30, y0 + 72, '1.  all regions shown hatched in section.', { size: 7.5, a: .7 }) + T(30, y0 + 86, '2.  the centre line in red is where the song is.', { size: 7.5, a: .7 })
  return s
}
SKINS.frame.blueprint = p => {
  const b = $('bp-bar'), t = $('bp-time'), bt = readout(p), ct = clock(p)
  if (b && b.textContent !== bt) b.textContent = bt
  if (t && t.textContent !== ct) t.textContent = ct
}

/* ── a track: a numbered balloon, its name in capitals, boxes for its buttons, its level a line with a mark ── */
SKINS.head.blueprint = i => {
  const t = S.tracks[i], rh = rowH(i), y = rowY(i), sel = isChosen(i), mid = y + rh / 2
  let s = ''
  if (sel) s += R(0, y, HEAD_W, rh, { fill: lkC('heads.chosen'), fa: lkA('heads.chosen') })
  const r = Math.min(8, rh / 2 - 2)
  s += Cc(20, mid, r, { fill: K1, stroke: INK, sw: .8 }) + T(20, mid + r * .36, pad2(i + 1), { size: Math.max(6, r * .95), anchor: 'middle' })
  const nm = fit(asGiven(t.name.toUpperCase()), 82, 9, 600)
  s += T(34, mid + 3, nm, { size: 9, w: 600, a: t.mute ? .45 : 1 })
  if (t.theirs && rh >= 30) s += T(34, mid + 14, `with ${t.theirs}`, { size: 6.5, a: .6 })
  s += bpLine(38 + tw(nm, 9, 600), mid, 124, mid, { a: .25, w: .5, dash: '1 2' }) + hit(0, y, 128, rh, 'sel', ` data-i="${i}"`)
  let x = 130
  for (const it of cellsOf(t)) { s += bpBox(x, mid - 5, it.on, it.t === 'r' ? BPR.red : null) + T(x + 3.5, mid + 10, it.t, { size: 5.5, a: .7, anchor: 'middle' }) + hit(x - 2, mid - 8, 11, 20, it.a, ` data-i="${i}"`); x += 12 }
  const v = shown(t, 'vol'), lx = 196, lw = 40, f = volF(v)
  s += bpLine(lx, mid - 2, lx + lw, mid - 2, { a: .5, w: .6 }) + bpLine(lx + lw * f, mid - 6, lx + lw * f, mid + 2, { w: 1.3, a: heard(t) ? 1 : .5 }) + T(lx + lw + 6, mid + 1, `${fmtDb(v)} db`, { size: 7, a: .85 })
  s += hit(lx - 4, y + 1, lw + 50, rh - 2, 'vol', ` data-i="${i}" data-rel="1"`, 'ew-resize')
  return s + hline(0, HEAD_W, y + rh - .5, .08)
}

/* ── the lanes: regions hatched, section lines at the markers ── */
SKINS.lanes.blueprint = (vis, L) => {
  let hatch = '', sec = ''
  vis.forEach((i, k) => {
    const t = S.tracks[i], h = rowH(i), y = TY + L.tops[k] - VY
    if (y + h <= TY || y >= BY) return
    for (const r of t.regs || []) { const xa = bx(r.a), xb = bx(r.b); if (xb < X0 || xa > X1) continue; hatch += R(xa + 1, y + lkN('reg.gap'), xb - xa - 2, h - 2 * lkN('reg.gap'), { fill: 'url(#bp-hatch)' }) }
  })
  for (const sc of SCENES) { const x = bx(sc.a); if (x >= X0 && x <= X1) sec += `M${n(x) + .5} ${TY}V${BY}` }
  return hatch + P(sec, { stroke: INK, sw: .7, sa: .4, dash: '14 3 2 3' })
}
/* ── section lines: a circled letter and the name ── */
SKINS.scenes.blueprint = () => {
  const y0 = MK_Y, y = MK_Y + MK_C, cur = sceneAt(curPos()).i
  let s = R(0, y0, RX, MK_H, { fill: K1 }), g = '', hits = hit(X0, y0, X1 - X0, MK_H, 'scenebar', '', 'default')
  SCENES.forEach((sc, i) => {
    const xa = bx(sc.a), xb = bx(sc.b), xl = Math.max(xa, X0), xr = Math.min(xb, X1)
    if (xr - xl < 1) return
    const cx = Math.max(xa, X0 + 8)
    if (xa >= X0 - 1) g += bpLine(xa, y0 + MK_H - 4, xa, y0 + MK_H, { a: .5 }) + Cc(cx, y + 10, 6.5, { fill: K1, stroke: INK, sw: .8 }) + T(cx, y + 12.6, i < 26 ? String.fromCharCode(65 + i) : String(i + 1), { size: 7.5, w: 600, anchor: 'middle' })
    g += T(cx + 10, y + 13, fit(asGiven(sc.name.toUpperCase()), Math.max(8, xr - xl - 16), 7.5), { size: 7.5, a: i === cur ? 1 : .7 })
    if (S.focus === 'marker' && S.selM === sc.a) g += Cc(cx, y + 10, 8.5, { stroke: INK, sw: .8 })
    hits += hit(xl, y0 + 2, xr - xl, MK_H - 4, 'scene', ` data-i="${i}"`)
  })
  return s + G(g, '', TL) + hits
}
/* ── the cycle: a dimension, from its start to its end ── */
SKINS.cycle.blueprint = (ca, cb, y, on) => {
  const a = on ? 1 : .4, c = S.cycle, words = `cycle ${barWord(Math.round(c.a))} — ${barWord(Math.round(c.b))}`, mid = (ca + cb) / 2, tw0 = tw(words, 6.5) + 10, yy = y + 2.5
  let s = bpLine(ca, y, ca, y + RU_H, { a: a * .6, w: .6 }) + bpLine(cb, y, cb, y + RU_H, { a: a * .6, w: .6 })
  const arrow = (x, d) => P(`M${n(x)} ${yy}l${n(-5 * d)} -2.2v4.4z`, { fill: INK, fa: a })
  if (cb - ca > tw0 + 14) s += bpLine(ca, yy, mid - tw0 / 2, yy, { a, w: .7 }) + bpLine(mid + tw0 / 2, yy, cb, yy, { a, w: .7 }) + arrow(ca, -1) + arrow(cb, 1) + R(mid - tw0 / 2 + 2, y, tw0 - 4, 8, { fill: lkC('bars.ground', K1) }) + T(mid, y + 5.6, words, { size: 6.5, a, anchor: 'middle' })
  else s += bpLine(ca, yy, cb, yy, { a, w: .7 }) + arrow(ca, -1) + arrow(cb, 1)
  return s
}
/* ── the playhead: a centre line in red ── */
SKINS.play.blueprint = (c, w) => {
  const y = RU_Y + RU_CY
  return P(`M.5 ${y}V${BY}`, { stroke: BPR.red, sw: Math.max(.9, w), dash: '16 3 3 3' }) + P(`M-4 ${y - 2}H5L.5 ${y + 5}Z`, { fill: BPR.red }) + hit(-10.5, y - 2, 22, RU_H - RU_CY + 2, 'playhead', '', 'ew-resize')
}
/* ── the mixer, its elevation: a slot and a cap for the level, a circle for the pan, boxes ── */
SKINS.strip.blueprint = {
  pan: (px, py, pw, pan) => { const cx = px + pw / 2; return Cc(cx, py + 1, 6, { stroke: INK, sw: .7 }) + bpLine(cx, py + 1, cx + 6 * Math.sin((pan || 0) * 2.4), py + 1 - 6 * Math.cos((pan || 0) * 2.4), { w: 1 }) },
  level: (x, w, sx, sw, q, vol, muted) => {
    const cx = x + w / 2 - 6, fy = q.yOf(vol)
    let s = R(cx - 1.5, q.ft, 3, q.fh, { stroke: INK, sw: .6 })
    for (const db of DBS) s += bpLine(cx + 6, q.yOf(db), cx + 9, q.yOf(db), { a: .55, w: .5 })
    return s + R(cx - 9, fy - 3.5, 18, 7, { fill: K1, stroke: INK, sw: .9, sa: muted ? .5 : 1 }) + bpLine(cx - 7, fy, cx + 7, fy, { w: .6 }) + bpLine(cx + 12, fy, cx + 16, fy, { w: .6 })
  },
  cells: (sx, sw, y, its, i) => { let s = '', x = sx + (sw - its.length * 11) / 2; for (const it of its) { s += bpBox(x + 2, y + 2, it.on, it.t === 'r' ? BPR.red : null) + T(x + 5.5, y + 16, it.t, { size: 5.5, a: .7, anchor: 'middle' }) + hit(x, y, 11, 18, it.a, ` data-i="${i}"`); x += 11 } return s },
  box: (x, y, w, h, sel) => R(x + 2.5, y + .5, w - 5, h - 1, { stroke: INK, sw: sel ? 1.1 : .7, sa: sel ? .9 : .45 }),
  name: (x, w, sx, sw, yb, t, sel) => T(x + w / 2, yb - 9, fit(asGiven(t.name.toUpperCase()), sw, 8, 600), { size: 8, w: 600, a: sel ? 1 : .85, anchor: 'middle' }),
}
