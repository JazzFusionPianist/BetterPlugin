/* ── poster: a composition of primary colours (design/themes draft 2, sheet 4: bauhaus) ──
   Down the left a column that holds the transport as a poster would (no name at its head: neither the song's nor the
   program's, his rule): where the song is in large figures, play a red
   disc, stop a black square, record a red ring, the tempo a yellow disc, the metre a blue square, the cycle a yellow
   triangle, the out a ring filled as loud as the mix; and the room's top rows, the tool row folded away. At the foot a
   black band says what is chosen. A track
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
const bhSplit = p => { const t = typeof place === 'function' ? place(p) : readout(p), k = t.indexOf('.'); return k < 0 ? [t, ''] : [t.slice(0, k), t.slice(k)] }      // (bar, then beat, division and tick, as the room's transport says it)
const bhArc = (cx, cy, r, f) => { f = clamp(f, 0, .9999); const a = f * 2 * Math.PI; return f <= 0 ? '' : `M${n(cx)} ${n(cy)}L${n(cx)} ${n(cy - r)}A${r} ${r} 0 ${f > .5 ? 1 : 0} 1 ${n(cx + r * Math.sin(a))} ${n(cy - r * Math.cos(a))}Z` }

/* the column down the left (its x counted from the column's own edge: the room starts where it ends). Since 2026-10-21
   (his pick of design/bauhaus draft 2) it holds the room's top rows too, sized by how much each matters and set as a
   poster, with no rules between them: play the largest, a red disc at the head, stop a black square and record a red
   ring beside it; where the song is in a large figure (beat, division and tick in red), the time and smpte small under
   it; the tempo a yellow disc, the metre a blue square, the cycle a yellow triangle, set apart, the key, click and low
   latency small beside them; the out a blue ring as loud as the mix, crossed by a line; the tracks and a red disc to add
   one; the tool, mode, grid, nudge, automation, rubato and zoom smallest, at the foot. A window too short for it has it
   smaller. The tool row is folded away (skins.js SKIN.noTool). */
const bhLab = (x, y, s, o = {}) => `<text x="${n(x)}" y="${n(y)}" font-family="${FONT}" font-size="${n((o.size || 5.6) * TF.scale)}" font-weight="600" letter-spacing="${o.ls == null ? 1.3 : o.ls}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''} fill="${o.c || BH.black}"${o.a != null && o.a < 1 ? ` fill-opacity="${o.a}"` : ''}>${esc(String(s).toUpperCase())}</text>`
SKINS.left.poster = () => {
  const CW = SKIN_BANDS.poster[2], p = curPos(), [bar, rest] = bhSplit(p), o = -CW, k = Math.min(1, H / 870)
  const fld = (x, y, w, h) => ({ x: o + x * k, y: y * k, w: w * k, h: h * k })      // (a word's place in the room, for typing over it and for its list)
  let s = ''
  /* the transport, largest */
  const play = S.playing && !S.rec
  s += Cc(66, 78, 50, { fill: BH.red }) + (play ? R(52, 56, 10, 44, { fill: BH.paper }) + R(71, 56, 10, 44, { fill: BH.paper }) : P('M52 52L52 104L97 78Z', { fill: BH.paper })) + hit(14, 26, 104, 104, 'play')
  s += R(132, 34, 44, 44, { fill: BH.black }) + R(147, 49, 14, 14, { fill: BH.paper }) + hit(128, 30, 52, 52, 'stop')
  s += (S.rec ? Cc(160, 116, 19, { fill: BH.red }) : Cc(160, 116, 16, { stroke: BH.red, sw: 5 })) + hit(138, 94, 44, 44, 'rec')
  s += R(126, 141, 2.2, 12, { fill: BH.black }) + P('M140 141L140 153L130 147Z', { fill: BH.black }) + T(144, 151, 'start', { size: 8, a: .7 }) + hit(122, 136, 50, 20, 'tostart')
  /* where the song is */
  BHX.rest = 12 + tw(bar, 92, 700) + 4
  s += T(10, 250, bar, { size: 92, w: 700, x: ' id="bh-bar"' }) + T(BHX.rest, 250, rest, { size: 13, w: 600, c: BH.red, x: ' id="bh-rest"' }) + hit(8, 176, CW - 20, 80, 'pos')
  SKV.field.pos = fld(12, 200, 150, 44)
  const tc = typeof smpte === 'function' ? smpte(p) : ''                                 // (the time as smpte, where the room says it: ui.js)
  s += T(14, 274, clock(p), { size: 12, w: 500, x: ' id="bh-time"' }) + (tc ? T(70, 274, tc, { size: 10, a: .55, x: ' id="bh-smpte"' }) + hit(66, 262, 90, 16, 'smpte') : '')
  if (tc) SKV.field.smpte = fld(66, 262, 96, 18)
  /* tempo, metre, cycle: the three shapes, set apart */
  s += Cc(150, 344, 42, { fill: BH.yellow }) + T(150, 352, String(Math.round(S.tempo * 100) / 100), { size: S.tempo >= 100 ? 21 : 26, w: 700, anchor: 'middle' }) + bhLab(150, 366, 'bpm', { anchor: 'middle' }) + hit(106, 300, 88, 88, 'tempo')
  SKV.field.tempo = fld(118, 332, 64, 24)
  s += R(20, 304, 50, 50, { fill: BH.blue }) + T(45, 334, meterName(), { size: 15, w: 600, c: BH.paper, anchor: 'middle' }) + hit(16, 300, 58, 58, 'meter')
  SKV.field.meter = fld(20, 304, 50, 50)
  const c = S.cycle
  s += P('M24 448L54 388L84 448Z', c.on ? { fill: BH.yellow } : { stroke: BH.yellow, sw: 3.5, x: ' stroke-linejoin="round"' }) + hit(20, 384, 68, 68, 'loop')
  s += T(24, 466, c.on ? `cycle ${Math.round(c.a + 1)} to ${Math.round(c.b)}` : 'cycle off', { size: 9, a: c.on ? .9 : .5 }) + hit(20, 456, 90, 14, 'loop')
  /* the key, click and low latency: small, beside them */
  s += bhLab(112, 412, 'key') + T(136, 413, S.key || '—', { size: 11, w: 600, a: S.key ? 1 : .4 }) + hit(108, 400, 80, 18, 'key')
  SKV.field.key = fld(132, 401, 60, 16)
  const ring = (x, y, on, word, a) => (on ? Cc(x + 3.5, y - 3, 3.5, { fill: BH.black }) : Cc(x + 3.5, y - 3, 3.2, { stroke: BH.black, sw: 1.2 })) + T(x + 11, y, word, { size: 9, a: on ? 1 : .55 }) + hit(x - 2, y - 11, tw(word, 9) + 16, 15, a)
  s += ring(112, 434, !!S.click, 'click', 'click') + ring(112, 450, !!S.lowLat, 'low latency', 'lowlat')
  /* the out: a blue ring as loud as the mix, crossed by a line, a red dot */
  const mx = 104, my = 568
  BHX.donut = [mx, my, 60]
  s += P(`M0 ${my - 92}L${CW - 3} ${my + 112}`, { stroke: BH.black, sw: 2 }) + Cc(mx, my, 60, { fill: BH.blue }) + P('', { fill: BH.black, x: ' id="bh-donut"' })
  s += Cc(mx, my, 35, { fill: BH.paper }) + T(mx, my + 4, fmtDb(S.master), { size: 16, w: 700, anchor: 'middle' }) + bhLab(mx, my + 15, 'out', { anchor: 'middle', ls: 2.2 }) + Cc(182, my - 54, 9, { fill: BH.red })
  s += hit(mx - 38, my - 38, 76, 76, 'master', '', 'ns-resize')
  /* the tracks: a figure, a red disc to add one */
  const nt = S.tracks.filter(t => t.kind === 'audio').length
  s += T(22, 706, String(nt), { size: 34, w: 700 }) + T(26 + tw(String(nt), 34, 700), 706, nt === 1 ? 'track' : 'tracks', { size: 9, a: .65 })
  s += Cc(150, 694, 12, { fill: BH.red }) + P('M150 687V701M143 694H157', { stroke: BH.paper, sw: 2.2 }) + hit(134, 678, 32, 32, 'addtrack')
  /* the smallest: the tool, the mode, the grid, the nudge, automation, rubato, the zoom */
  const small = (x, y, key, v, a) => { const w = tw(v, 10, 500); SKV.field[a] = fld(x - 2, y - 10, Math.max(56, w + 14), 14); return bhLab(x, y - 12, key) + T(x, y, v, { size: 10, w: 500 }) + P(`M${n(x + w + 4)} ${y - 5}l2.6 2.8l2.6 -2.8`, { stroke: BH.black, sw: 1 }) + hit(x - 3, y - 20, w + 14, 24, a) }
  s += small(22, 760, 'tool', toolWord(S.tool), 'toolmenu') + small(80, 760, 'mode', S.mode, 'modemenu') + small(138, 760, 'grid', S.grid, 'grid')
  s += small(22, 792, 'nudge', S.nudge, 'nudge')
  const sq = (x, y, on, word, a) => R(x, y - 7, 7, 7, on ? { fill: BH.black } : { stroke: BH.black, sw: 1.1 }) + T(x + 11, y, word, { size: 9, a: on ? 1 : .55 }) + hit(x - 2, y - 11, tw(word, 9) + 16, 15, a)
  s += sq(80, 792, !!S.auto, 'automation', 'autokey') + sq(80, 808, !!S.flex, 'rubato', 'flexkey')
  /* the zoom: two rules side by side, their names over their middles (his word on draft 2) */
  const zf = clamp(Math.log(PXB / fitPXB()) / Math.log(640 / fitPXB()), 0, 1), rf = clamp(((S.rh || 25) - 20) / 100, 0, 1), zw = 84
  const zoom = (x, y, f, a, word) => bhLab(x + zw / 2, y - 7, word, { anchor: 'middle' }) + R(x, y, zw, 1.4, { fill: BH.black }) + Cc(x + zw * f, y + .7, 3.4, { fill: BH.red }) + hit(x - 5, y - 9, zw + 10, 16, a, ` data-x0="${n(o + x * k)}" data-w="${n(zw * k)}"`, 'ew-resize')
  s += zoom(14, 838, zf, 'zoomx', 'zoom across') + zoom(111, 838, rf, 'zoomy', 'zoom down')
  const ground = R(0, 0, CW, H, { fill: K1 }) + R(CW - 3, 0, 3, H, { fill: BH.black })
  return G(ground + G(G(s, k < 1 ? `scale(${n(k)})` : ''), '', ' id="bh-col"'), `translate(${o} 0)`)
}
/* the foot: a black band, what is chosen — the track, or the region (its colour and shape, gain, transpose, fine tune,
   fades, tempo, where it starts and how long it is), as the tool row said it */
SKINS.foot.poster = y0 => {
  const rs = S.focus === 'tracks' ? [] : selRegs(), st = S.tracks[S.sel], r = rs.length ? rs[0][0] : null, look = r ? regLook(r, rs[0][1]) : st ? { c: st.c } : { c: BH.grey }
  let s = R(0, y0, W, DECK_H, { fill: BH.black }), x = 16
  const yb = y0 + DECK_H / 2 + 4
  const item = (key, v, a) => { const kw = tw(key, 7, 600) + 9, w = kw + tw(v, 11); if (x + w > W - 12) return; s += T(x, yb - .5, key, { size: 7, w: 600, c: BH.yellow }) + T(x + kw, yb, v, { size: 11, c: BH.paper }); if (a) s += hit(x - 4, y0 + 3, w + 8, DECK_H - 6, a, '', 'ns-resize'); x += w + 30 }
  if (r) item(rs.length > 1 ? 'REGIONS' : 'REGION', rs.length > 1 ? String(rs.length) : asGiven(r.tag || r.name || rs[0][1].name))
  else if (st) item('TRACK', asGiven(st.name))
  s += R(x - 14, y0 + 8, 14, DECK_H - 16, { fill: look.c }) + hit(x - 16, y0 + 4, 18, DECK_H - 8, 'look')
  SKV.field.look = { x: x - 16, y: y0, w: 18, h: DECK_H }                             // (the look's card opens over it: ui.js pLook)
  x += 16
  if (r) {
    const sg = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v || 0)
    item('GAIN', fmtDb(r.gain || 0) + ' dB', 'rgain'); item('TRANSPOSE', sg(r.tr), 'rtr')
    if (!(r.notes || rs[0][1].midi)) item('FINE', sg(r.ft), 'rft')
    item('FADES', `${+(r.fi || 0).toFixed(2)}  ${+(r.fo || 0).toFixed(2)}`)
    if (!r.loop && r.bpm > 0) item('BPM', String(+r.bpm.toFixed(1)), 'rbpm')
    item('FROM', readout(r.a - 1)); item('LENGTH', `${+(r.b - r.a).toFixed(2)} bars`)
  } else if (st) { item('LEVEL', fmtDb(shown(st, 'vol')) + ' dB'); item('OUT', asGiven(outName(st))) }
  return s
}
SKINS.frame.poster = p => {
  /* the start page and the sheet of keys are over the room: the column's controls are not there to be pressed while they are */
  const col = $('bh-col'), hide = (typeof START === 'object' && START.on) || !!S.sheet
  if (col && col.getAttribute('visibility') !== (hide ? 'hidden' : 'visible')) col.setAttribute('visibility', hide ? 'hidden' : 'visible')
  const [bar, rest] = bhSplit(p), b = $('bh-bar'), r = $('bh-rest'), t = $('bh-time'), sm = $('bh-smpte'), ct = clock(p), st = typeof smpte === 'function' ? smpte(p) : ''
  if (b && b.textContent !== bar) { b.textContent = bar; BHX.rest = 12 + tw(bar, 92, 700) + 4; if (r) r.setAttribute('x', n(BHX.rest)) }
  if (r && r.textContent !== rest) r.textContent = rest
  if (t && t.textContent !== ct) t.textContent = ct
  if (sm && sm.textContent !== st) sm.textContent = st
  if (typeof METERS !== 'object') return
  const f = v => volF(Math.min(6, linDb(v)))
  const d = $('bh-donut'); if (d && BHX.donut) d.setAttribute('d', bhArc(BHX.donut[0], BHX.donut[1], BHX.donut[2], f(Math.max(METERS.mm[0], METERS.mm[1]))))
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
