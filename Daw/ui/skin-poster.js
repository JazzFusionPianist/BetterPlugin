/* ── poster: a composition of primary colours (design/themes draft 2, sheet 4: bauhaus) ──
   Down the left a column that holds the transport as a poster would (no name at its head: neither the song's nor the
   program's, his rule): where the song is in large figures, play a red
   disc, stop a black square, record a red ring, the tempo a yellow disc, the metre a blue square, the cycle a yellow
   triangle, the out a ring filled as loud as the mix. At the foot a black band with the room's settings in it. A track
   its number large in its colour, its name, its buttons shapes (a square to mute, a circle to solo, a triangle to record);
   the markers shapes; the cycle a yellow length of the black rule; the playhead a red disc on a bar; the mixer a bar of
   each track's colour as high as it is loud, a red dot where its level is. */
const BH = { paper: '#F1ECDF', black: '#151412', red: '#D52B1E', blue: '#1D4E9E', yellow: '#F2C230', grey: '#BDB6A6' }
const BHX = { donut: null, rest: 18, v: new Map() }
const bhCol = t => t ? (t.c || BH.black) : BH.grey
const bhInk = c => String(c).toUpperCase() === BH.yellow ? BH.black : c
/* a button as a shape: m a square, s a circle, r a triangle, i a diamond */
function bhShape (k, x, y, sz, on, c) {
  const o = on ? { fill: c || BH.black } : { stroke: BH.black, sw: 1.1 }
  if (k === 's') return Cc(x + sz / 2, y + sz / 2, sz / 2, o)
  if (k === 'r') return P(`M${n(x)} ${n(y + sz)}L${n(x + sz / 2)} ${n(y)}L${n(x + sz)} ${n(y + sz)}Z`, Object.assign({ x: ' stroke-linejoin="round"' }, on ? { fill: BH.red } : o))
  if (k === 'i') return P(`M${n(x + sz / 2)} ${n(y - .5)}L${n(x + sz + .5)} ${n(y + sz / 2)}L${n(x + sz / 2)} ${n(y + sz + .5)}L${n(x - .5)} ${n(y + sz / 2)}Z`, on ? { fill: BH.blue } : o)
  return R(x, y, sz, sz, o)
}
const bhSplit = p => { const r = readout(p), k = r.indexOf('.'); return k < 0 ? [r, ''] : [r.slice(0, k), r.slice(k)] }
const bhArc = (cx, cy, r, f) => { f = clamp(f, 0, .9999); const a = f * 2 * Math.PI; return f <= 0 ? '' : `M${n(cx)} ${n(cy)}L${n(cx)} ${n(cy - r)}A${r} ${r} 0 ${f > .5 ? 1 : 0} 1 ${n(cx + r * Math.sin(a))} ${n(cy - r * Math.cos(a))}Z` }

/* the column down the left (its x counted from the column's own edge: the room starts where it ends) */
SKINS.left.poster = () => {
  const CW = SKIN_BANDS.poster[2], p = curPos(), [bar, rest] = bhSplit(p), o = -CW, up = 40      // (up: the composition starts at the column's head)
  const ground = R(0, 0, CW, H, { fill: K1 }) + R(CW - 3, 0, 3, H, { fill: BH.black })
  let s = ''
  BHX.rest = 18 + tw(bar, 64, 700) + 2
  s += T(18, 132, bar, { size: 64, w: 700, x: ' id="bh-bar"' }) + T(BHX.rest, 132, rest, { size: 22, w: 600, c: BH.red, x: ' id="bh-rest"' }) + T(20, 154, clock(p), { size: 14, w: 500, x: ' id="bh-time"' }) + hit(14, 70, 170, 90, 'pos')
  SKV.field.pos = { x: o + 18, y: 84 - up, w: 150, h: 52 }
  const play = S.playing && !S.rec
  s += Cc(42, 200, 22, { fill: BH.red }) + (play ? R(34, 190, 6, 20, { fill: BH.paper }) + R(45, 190, 6, 20, { fill: BH.paper }) : P('M35 189L35 211L53 200Z', { fill: BH.paper })) + hit(18, 176, 48, 48, 'play')
  s += R(78, 184, 32, 32, { fill: BH.black }) + R(88, 194, 12, 12, { fill: BH.paper }) + hit(74, 180, 40, 40, 'stop')
  s += (S.rec ? Cc(143, 200, 15, { fill: BH.red }) : Cc(143, 200, 13, { stroke: BH.red, sw: 4.5 })) + hit(124, 181, 38, 38, 'rec')
  s += R(18, 238, 2.5, 16, { fill: BH.black }) + P('M33 238L33 254L21 246Z', { fill: BH.black }) + T(40, 250, 'to the start', { size: 10 }) + hit(14, 234, 110, 24, 'tostart')
  s += Cc(42, 296, 22, { fill: BH.yellow }) + T(42, 301, String(Math.round(S.tempo * 100) / 100), { size: S.tempo >= 100 ? 14 : 17, w: 700, anchor: 'middle' }) + T(42, 312, 'B P M', { size: 5.5, w: 600, anchor: 'middle', x: ' xml:space="preserve"' }) + hit(18, 272, 48, 48, 'tempo')
  SKV.field.tempo = { x: o + 14, y: 286 - up, w: 60, h: 20 }
  s += R(78, 280, 32, 32, { fill: BH.blue }) + T(94, 300, meterName(), { size: 11, w: 600, c: BH.paper, anchor: 'middle' }) + hit(74, 276, 40, 40, 'meter')
  SKV.field.meter = { x: o + 78, y: 280 - up, w: 32, h: 32 }
  const c = S.cycle
  s += P('M124 312L139 282L154 312Z', c.on ? { fill: BH.yellow } : { stroke: BH.yellow, sw: 3, x: ' stroke-linejoin="round"' }) + hit(120, 276, 40, 40, 'loop')
  s += T(20, 344, 'cycle', { size: 10, w: 600 }) + T(60, 344, c.on ? `bars ${Math.round(c.a + 1)} to ${Math.round(c.b)}` : 'off', { size: 10, a: .6 }) + hit(14, 332, 170, 16, 'loop')
  const ring = (y, on, word, a) => (on ? Cc(24, y, 4.5, { fill: BH.black }) : Cc(24, y, 4.5, { stroke: BH.black, sw: 1.4 })) + T(36, y + 4, word, { size: 10, a: on ? 1 : .6 }) + hit(14, y - 9, 150, 18, a)
  s += ring(364, !!S.click, `click ${S.click ? 'on' : 'off'}`, 'click') + ring(384, !!S.lowLat, `low latency ${S.lowLat ? 'on' : 'off'}`, 'lowlat')
  /* the out: a ring as loud as the mix, its level in the middle */
  if (H > 600) {
    const mx = 98, my = Math.max(500, Math.min(540, H - 130)) + up / 2
    BHX.donut = [mx, my]
    s += P(`M8 ${my - 110}L188 ${my + 100}`, { stroke: BH.black, sw: 2 }) + Cc(mx, my, 66, { fill: BH.blue }) + P('', { fill: BH.black, x: ' id="bh-donut"' })
    s += Cc(mx, my, 38, { fill: BH.paper }) + T(mx, my + 4, fmtDb(S.master), { size: 17, w: 700, anchor: 'middle' }) + T(mx, my + 16, 'O U T', { size: 6, w: 600, anchor: 'middle', x: ' xml:space="preserve"' }) + Cc(168, my - 88, 10, { fill: BH.red })
    s += hit(mx - 40, my - 40, 80, 80, 'master', '', 'ns-resize')
  } else BHX.donut = null
  return G(ground + G(s, `translate(0 ${-up})`), `translate(${o} 0)`)
}
/* the foot: a black band, the room's settings in it */
SKINS.foot.poster = y0 => {
  const st = S.tracks[S.sel], items = [['TOOL', toolWord(S.tool), 'toolmenu'], ['MODE', S.mode, 'modemenu'], ['GRID', S.grid, 'grid'], ['NUDGE', S.nudge, 'nudge'], ['TRACK', st ? asGiven(st.name) : '—', null], ['KEY', S.key || '—', 'key']]
  let s = R(0, y0, W, DECK_H, { fill: BH.black }), x = 16
  for (const [k, v, a] of items) {
    const kw = tw(k, 7, 600) + 9, w = kw + tw(v, 11)
    if (x + w > W - 12) break
    s += T(x, y0 + 18.5, k, { size: 7, w: 600, c: BH.yellow }) + T(x + kw, y0 + 19, v, { size: 11, c: BH.paper })
    if (a) { s += hit(x - 4, y0 + 3, w + 8, DECK_H - 6, a); SKV.field[a] = { x: x - 4, y: y0 + 3, w: Math.max(60, w + 8), h: DECK_H - 6 } }
    x += Math.max(136, w + 24)
  }
  return s
}
SKINS.frame.poster = p => {
  const [bar, rest] = bhSplit(p), b = $('bh-bar'), r = $('bh-rest'), t = $('bh-time'), ct = clock(p)
  if (b && b.textContent !== bar) { b.textContent = bar; BHX.rest = 18 + tw(bar, 64, 700) + 2; if (r) r.setAttribute('x', n(BHX.rest)) }
  if (r && r.textContent !== rest) r.textContent = rest
  if (t && t.textContent !== ct) t.textContent = ct
  if (typeof METERS !== 'object') return
  const f = v => volF(Math.min(6, linDb(v)))
  const d = $('bh-donut'); if (d && BHX.donut) d.setAttribute('d', bhArc(BHX.donut[0], BHX.donut[1], 66, f(Math.max(METERS.mm[0], METERS.mm[1]))))
  const lv = (key, v) => { const el = $('bhv-' + key), g = BHX.v.get(key); if (el && g) { const hh = g[1] * f(v); el.setAttribute('y', n(g[0] + g[1] - hh)); el.setAttribute('height', n(hh)) } }
  for (const tr of S.tracks) lv(tr.id, METERS.now.get(tr.id) || 0)
  lv('M', Math.max(METERS.mm[0], METERS.mm[1]))
}

/* ── a track: its number large, its name, its buttons as shapes, its level a line with a red dot ── */
SKINS.head.poster = i => {
  const t = S.tracks[i], rh = rowH(i), y = rowY(i), sel = isChosen(i), mid = y + rh / 2, di = ` data-i="${i}"`, two = rh >= 40, col = bhInk(t.c || BH.black)
  let s = sel ? R(0, y, HEAD_W, rh, { fill: lkC('heads.chosen'), fa: lkA('heads.chosen') }) : ''
  const nz = Math.max(11, Math.min(22, rh - 6))
  s += T(12, mid + nz * .36, pad2(i + 1), { size: nz, w: 700, c: col })
  const nx = 12 + tw('00', nz, 700) + 10, ny = two ? mid - 3 : mid + 4, nm = fit((t.parent ? '  ' : '') + asGiven(t.name), two ? 150 : 80, 12, 500)
  s += T(nx, ny, nm, { size: 12, w: 500, a: heard(t) ? 1 : .5 })
  if (t.theirs && two) s += T(nx + tw(nm, 12, 500) + 6, ny, asGiven(`with ${t.theirs}`), { size: 9, a: .5 })
  s += hit(0, y, nx + (two ? 150 : 84), two ? rh / 2 + 2 : rh, 'sel', di)
  const sz = 7.5, by = two ? mid + 5 : mid - sz / 2
  let x = two ? nx + 1 : nx + 88
  for (const it of cellsOf(t)) { s += bhShape(it.t, x, by, sz, it.on, it.t === 's' ? BH.blue : BH.black) + hit(x - 4, by - 5, sz + 8, sz + 10, it.a, di); x += 15 }
  const v = shown(t, 'vol'), lx = Math.max(x + 8, two ? nx + 70 : x + 6), lw = 40, f = volF(v)
  s += R(lx, by + 3, lw, 1.6, { fill: BH.black }) + Cc(lx + lw * f, by + 3.8, 3.6, { fill: BH.red, fa: heard(t) ? 1 : .5 })
  s += hit(lx - 6, by - 6, lw + 12, sz + 12, 'vol', `${di} data-rel="1"`, 'ew-resize')
  return s
}
/* ── the markers: shapes in the primary colours, and the names ── */
SKINS.scenes.poster = () => {
  const y0 = MK_Y, y = MK_Y + MK_C
  let s = R(0, y0, RX, MK_H, { fill: K1 }), g = '', hits = hit(X0, y0, X1 - X0, MK_H, 'scenebar', '', 'default')
  SCENES.forEach((sc, i) => {
    const xa = bx(sc.a), xb = bx(sc.b), xl = Math.max(xa, X0), xr = Math.min(xb, X1)
    if (xr - xl < 1) return
    const c = [BH.red, BH.blue, BH.yellow][i % 3], k = i % 3, x = xl + 2, cy = y + 12
    g += k === 0 ? Cc(x + 5, cy, 4.5, { fill: c }) : k === 1 ? R(x + .5, cy - 4.5, 9, 9, { fill: c }) : P(`M${n(x)} ${cy + 5}L${n(x + 5)} ${cy - 4.5}L${n(x + 10)} ${cy + 5}Z`, { fill: c })
    const chosen = S.focus === 'marker' && S.selM === sc.a
    g += T(x + 14, y + 16.5, fit(asGiven(sc.name), Math.max(8, xr - xl - 20), 13, 600), { size: 13, w: 600 }) + (chosen ? R(x + 13, y + 19, Math.min(xr - xl - 16, tw(asGiven(sc.name), 13, 600)), 2, { fill: BH.black }) : '')
    hits += hit(xl, y0 + 2, xr - xl, MK_H - 4, 'scene', ` data-i="${i}"`)
  })
  return s + G(g, '', TL) + hits
}
/* ── the rule, and the cycle a yellow length of it ── */
SKINS.rule.poster = y => R(X0, y, X1 - X0, 4, { fill: BH.black })
SKINS.cycle.poster = (ca, cb, y, on) => on ? R(ca, y, cb - ca, 4, { fill: BH.yellow }) : R(ca, y + 1.25, cb - ca, 1.5, { fill: BH.yellow })
/* ── the playhead: a red disc on a bar ── */
SKINS.play.poster = (c, w) => {
  const y = RU_Y + 2
  return R(-1.2, y, 2.4, Math.max(0, BY - y), { fill: c }) + Cc(0, y, 6, { fill: c }) + hit(-10.5, y - 6, 22, RU_H - 2, 'playhead', '', 'ew-resize')
}
/* ── the mixer: a bar of the track's colour as high as it is loud, a black line and a red dot where its level is, a
   ring for its pan, shapes for its buttons ── */
SKINS.strip.poster = {
  pan: (px, py, pw, pan) => { const cx = px + pw / 2, a = (pan || 0) * 2.4; return Cc(cx, py + 1, 6.5, { stroke: BH.black, sw: 1.2 }) + P(`M${n(cx)} ${py + 1}L${n(cx + 6.5 * Math.sin(a))} ${n(py + 1 - 6.5 * Math.cos(a))}`, { stroke: BH.black, sw: 1.4 }) },
  level: (x, w, sx, sw, q, vol, muted, t) => {
    const key = t ? t.id : 'M', bw = Math.min(16, Math.max(8, sw * .28)), bx0 = sx + 4, lx = bx0 + bw + Math.max(10, (sw - bw - 12) * .4), fy = q.yOf(vol)
    BHX.v.set(key, [q.ft, q.fh])
    return R(bx0, q.fb, bw, 0, { fill: bhCol(t), x: ` id="bhv-${key}"` }) + R(bx0 + .4, q.ft + .4, bw - .8, q.fh - .8, { stroke: BH.black, sw: .8 }) + R(lx - .8, q.ft, 1.6, q.fh, { fill: BH.black }) + Cc(lx, fy, 5.5, { fill: BH.red, fa: muted ? .5 : 1 })
  },
  cells: (sx, sw, y, its, i) => { let s = '', x = sx + (sw - its.length * 13 + 5) / 2; for (const it of its) { s += bhShape(it.t, x, y + 4, 8, it.on, it.t === 's' ? BH.blue : BH.black) + hit(x - 3, y, 14, 16, it.a, ` data-i="${i}"`); x += 13 } return s },
  name: (x, w, sx, sw, yb, t, sel) => T(sx + 4, yb - 9, fit(asGiven(t.name), sw - 6, 11, 600), { size: 11, w: sel ? 700 : 600 }),
}
