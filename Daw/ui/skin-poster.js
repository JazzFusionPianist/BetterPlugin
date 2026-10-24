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
/* the column down the left, as a poster (his picks: design/bauhaus draft 2, then draft 3 of 2026-10-22: the chosen track's
   strip under the out, the smallest things at the foot); its x counted from the column's own edge */
SKINS.left.poster = () => {
  const CW = SKIN_BANDS.poster[2], p = curPos(), [bar, rest] = bhSplit(p), o = SKIN.colRight ? W : -CW, k = Math.min(1, H / 940)
  const fld = (x, y, w, h) => ({ x: o + x * k, y: y * k, w: w * k, h: h * k })
  let s = ''
  /* the transport, largest */
  const play = S.playing && !S.rec
  s += Cc(66, 78, 50, { fill: BH.red }) + (play ? R(52, 56, 10, 44, { fill: BH.paper }) + R(71, 56, 10, 44, { fill: BH.paper }) : P('M52 52L52 104L97 78Z', { fill: BH.paper })) + hit(14, 26, 104, 104, 'play')
  s += R(132, 34, 44, 44, { fill: BH.black }) + R(147, 49, 14, 14, { fill: BH.paper }) + hit(128, 30, 52, 52, 'stop')
  s += (S.rec ? Cc(160, 116, 19, { fill: BH.red }) : Cc(160, 116, 16, { stroke: BH.red, sw: 5 })) + hit(138, 94, 44, 44, 'rec')
  s += R(126, 141, 2.2, 12, { fill: BH.black }) + P('M140 141L140 153L130 147Z', { fill: BH.black }) + T(144, 151, 'start', { size: 8, a: .7 }) + hit(122, 136, 50, 20, 'tostart')
  /* where the song is */
  BHX.rest = 12 + tw(bar, 86, 700) + 4
  s += T(10, 238, bar, { size: 86, w: 700, x: ' id="bh-bar"' }) + T(BHX.rest, 238, rest, { size: 13, w: 600, c: BH.red, x: ' id="bh-rest"' }) + hit(8, 168, CW - 20, 76, 'pos')
  SKV.field.pos = fld(12, 190, 150, 44)
  const tc = typeof smpte === 'function' ? smpte(p) : ''
  s += T(14, 260, clock(p), { size: 12, w: 500, x: ' id="bh-time"' }) + (tc ? T(70, 260, tc, { size: 10, a: .55, x: ' id="bh-smpte"' }) + hit(66, 248, 90, 16, 'smpte') : '')
  if (tc) SKV.field.smpte = fld(66, 248, 96, 18)
  /* tempo, metre, cycle */
  s += Cc(152, 322, 38, { fill: BH.yellow }) + T(152, 330, String(Math.round(S.tempo * 100) / 100), { size: S.tempo >= 100 ? 20 : 24, w: 700, anchor: 'middle' }) + bhLab(152, 343, 'bpm', { anchor: 'middle' }) + hit(112, 282, 80, 80, 'tempo')
  SKV.field.tempo = fld(122, 310, 60, 24)
  s += R(20, 286, 46, 46, { fill: BH.blue }) + T(43, 314, meterName(), { size: 14, w: 600, c: BH.paper, anchor: 'middle' }) + hit(16, 282, 54, 54, 'meter')
  SKV.field.meter = fld(20, 286, 46, 46)
  const c = S.cycle
  s += P('M24 414L52 360L80 414Z', c.on ? { fill: BH.yellow } : { stroke: BH.yellow, sw: 3.5, x: ' stroke-linejoin="round"' }) + hit(20, 356, 64, 62, 'loop')
  s += T(24, 430, c.on ? `cycle ${barWord(Math.round(c.a))} to ${barWord(Math.round(c.b) - 1)}` : 'cycle off', { size: 9, a: c.on ? .9 : .5 }) + hit(20, 420, 90, 14, 'loop')
  s += bhLab(108, 384, 'key') + T(132, 385, S.key || '—', { size: 11, w: 600, a: S.key ? 1 : .4 }) + hit(104, 372, 80, 18, 'key')
  SKV.field.key = fld(128, 373, 60, 16)
  const ring = (x, y, on, word, a) => (on ? Cc(x + 3.5, y - 3, 3.5, { fill: BH.black }) : Cc(x + 3.5, y - 3, 3.2, { stroke: BH.black, sw: 1.2 })) + T(x + 11, y, word, { size: 9, a: on ? 1 : .55 }) + hit(x - 2, y - 11, tw(word, 9) + 16, 15, a)
  s += ring(108, 404, !!S.click, 'click', 'click') + ring(108, 420, !!S.lowLat, 'low latency', 'lowlat')
  /* the out */
  const mx = 104, my = 508, mr = 52
  BHX.donut = [mx, my, mr]
  s += P(`M0 ${my - 84}L${CW - 3} ${my + 62}`, { stroke: BH.black, sw: 2 }) + Cc(mx, my, mr, { fill: BH.blue }) + P('', { fill: BH.black, x: ' id="bh-donut"' })
  s += Cc(mx, my, 31, { fill: BH.paper }) + T(mx, my + 4, fmtDb(S.master), { size: 15, w: 700, anchor: 'middle' }) + bhLab(mx, my + 14, 'out', { anchor: 'middle', ls: 2.2 }) + Cc(182, my - 48, 8, { fill: BH.red })
  s += hit(mx - 34, my - 34, 68, 68, 'master', '', 'ns-resize')
  /* ── the strip of the track chosen ── */
  const t = S.tracks[S.sel]
  if (t) {
    const i = S.sel, di = ` data-i="${i}"`, col = bhCol(t), vol = shown(t, 'vol'), heardT = heard(t), top = 584
    /* its number on a black block, its name; its pan a ring */
    const num = pad2(i + 1), nw = tw(num, 24, 700)
    s += R(12, top - 2, nw + 8, 28, { fill: BH.black }) + T(16, top + 20, num, { size: 24, w: 700, c: BH.paper }) + T(24 + nw, top + 19, fit(asGiven(t.name), 120, 12, 600), { size: 12, w: 600, a: heardT ? 1 : .5 }) + hit(12, top - 2, 150, 28, 'sel', di)
    const pan = shown(t, 'pan') || 0, pcx = 186, pcy = top + 12, pa = pan * 2.4
    s += Cc(pcx, pcy, 9, { stroke: BH.black, sw: 1.3 }) + P(`M${pcx} ${pcy}L${n(pcx + 9 * Math.sin(pa))} ${n(pcy - 9 * Math.cos(pa))}`, { stroke: BH.black, sw: 1.6 }) + hit(pcx - 14, pcy - 12, 28, 24, 'mpan', `${di} data-x="${n(o + (pcx - 30) * k)}" data-pw="${n(60 * k)}"`, 'ew-resize')
    /* its level: two bars of its colour, the rule, the red disc; its level large; where it comes in */
    const ft = top + 40, fb = top + 168, fh = fb - ft, yOf = db => fb - fh * volF(db)
    BHX.strip = [ft, fh]
    for (let q = 0; q < 2; q++) s += R(14 + q * 7, ft, 5, fh, { fill: BH.black, fa: .06 }) + R(14 + q * 7, fb, 5, 0, { fill: col, fa: heardT ? 1 : .45, x: ` id="bhs-${q}"` })
    for (const db of [6, 0, -6, -12, -24]) s += R(34, yOf(db) - .4, 3, .8, { fill: BH.black, fa: .4 })
    s += R(39.1, ft, 1.8, fh, { fill: BH.black }) + Cc(40, yOf(vol), 6, { fill: BH.red, fa: heardT ? 1 : .5 }) + hit(10, ft - 6, 40, fh + 12, 'vol', `${di} data-rel="1"`, 'ns-resize')
    s += T(54, ft + 18, fmtDb(vol), { size: 22, w: 700, a: heardT ? 1 : .5 }) + bhLab(55, ft + 30, 'level') + hit(52, ft - 2, 60, 34, 'volnum', di, 'text')
    if (t.kind === 'audio' && !t.theirs && !t.inst) { const word = inputName(t.inp || 0); s += bhLab(55, ft + 52, 'in') + T(68, ft + 52, fit(word, 50, 8.5), { size: 8.5, a: .8 }) + hit(52, ft + 42, 64, 14, 'min', di) }
    if (t.grp && typeof grpMeta === 'function') {                                         // its group (groups.js), as the transport panel has it: pressed, as there
      const m = grpMeta(t.grp), off = S.grpOff || !m.on, gn = fit(asGiven(m.name), 44, 8.5), gy = ft + 68
      s += bhLab(55, gy, 'group') + T(84, gy, gn, { size: 8.5, a: off ? .4 : .85 }) + Cc(84 + tw(gn, 8.5) + 6, gy - 3, 2.8, { fill: grpColour(t.grp), fa: off ? .35 : 1 })
      s += hit(52, gy - 11, 44 + tw(gn, 8.5), 15, 'mgrp', `${di} data-x="${n(o + 82 * k)}" data-y="${n((gy - 11) * k)}" data-w="${n(70 * k)}" data-h="${n(13 * k)}"`)
    }
    /* its plug-ins, a red disc to put one on */
    const items = fxItems(t), gx = 120
    let ly = ft + 8
    if (t.theirs) { s += T(gx, ly, 'patch →', { size: 8.5, a: .5 }) + hit(gx - 3, ly - 10, 80, 14, 'm-patch', di); ly += 13 }
    else {
      const show = Math.min(items.length, 3)
      items.slice(0, show).forEach((it, j) => { s += R(gx, ly - 7, 7, 7, { fill: it.c || BH.black, fa: it.off ? .35 : 1 }) + T(gx + 11, ly, fit(asGiven(it.t), 66, 8.5), { size: 8.5, a: it.off ? .45 : .9 }) + hit(gx - 3, ly - 10, 84, 13, 'mfx', `${di} data-k="${j}"`); ly += 13 })
      if (items.length > 3) { s += T(gx + 11, ly, `+${items.length - 3} more`, { size: 8, a: .5 }) + hit(gx - 3, ly - 10, 84, 13, 'm-patch', di); ly += 13 }
      s += Cc(gx + 3.5, ly - 3.5, 4.5, { fill: BH.red }) + P(`M${gx + 3.5} ${ly - 6.5}v6M${gx + .5} ${ly - 3.5}h6`, { stroke: BH.paper, sw: 1.2 }) + T(gx + 12, ly, 'plug-in', { size: 8, a: .45 }) + hit(gx - 3, ly - 10, 60, 13, 'mfxadd', di)
    }
    /* its sends: knobs with the bus under each, how much with the pointer on it; three, then how many more */
    if (t.kind !== 'stack') {
      const sends = t.sends || [], three = sends.slice(0, sends.length > 4 ? 3 : 4), kr = 8, ky = fb - 26
      let kx = 70
      three.forEach((sd, q) => {
        const b = byId(sd.to), f = volF(sd.db), a0 = -135 * Math.PI / 180, a1 = a0 + f * 270 * Math.PI / 180, on = (r, z) => `${n(kx + r * Math.sin(z))} ${n(ky - r * Math.cos(z))}`, turning = drag && drag.a === 'msend' && drag.i === i && drag.k === q
        s += `<g class="bmk${turning ? ' on' : ''}">` + Cc(kx, ky, kr, { fill: BH.paper, stroke: BH.black, sw: 1.2 }) + (f > .004 ? P(`M${on(kr + 2.4, a0)}A${kr + 2.4} ${kr + 2.4} 0 ${f > 2 / 3 ? 1 : 0} 1 ${on(kr + 2.4, a1)}`, { stroke: sendTapC(sd, true), sw: 2.2 }) : '') + P(`M${n(kx)} ${n(ky)}L${on(kr - 1, a1)}`, { stroke: BH.black, sw: 1.5 })
          + T(kx, ky + kr + 9, fit(asGiven(b ? b.name : 'send'), 30, 7.5, 600), { size: 7.5, w: 600, a: .8, anchor: 'middle', x: ' class="bmk-name"' }) + T(kx, ky + kr + 9, fmtDb(sd.db), { size: 7.5, w: 600, c: BH.red, anchor: 'middle', x: ' class="bmk-db"' })
          + hit(kx - kr - 4, ky - kr - 4, 2 * kr + 8, 2 * kr + 14, 'msend', `${di} data-k="${q}" data-rel="1" data-x="${n(o + (kx - 60) * k)}" data-pw="${n(120 * k)}"`, 'ns-resize') + '</g>'
        kx += 34
      })
      if (sends.length > three.length) s += T(kx, ky + 3, `+${sends.length - three.length}`, { size: 9, w: 600, a: .6, anchor: 'middle' }) + hit(kx - kr, ky - kr, 2 * kr, 2 * kr, 'tab-mixer')
      else if (sends.length < (typeof MAX_SENDS === 'number' ? MAX_SENDS : 10) && !t.theirs) s += Cc(kx, ky, kr, { stroke: BH.black, sw: 1, dash: '2 2', sa: .5 }) + P(`M${kx} ${ky - 4}v8M${kx - 4} ${ky}h8`, { stroke: BH.black, sw: 1.2, sa: .6 }) + T(kx, ky + kr + 9, 'send', { size: 7.5, a: .4, anchor: 'middle' }) + hit(kx - kr - 4, ky - kr - 4, 2 * kr + 8, 2 * kr + 8, 'msendadd', di)
    }
  }
  /* the tracks: a figure, a red disc to add one */
  const nt = S.tracks.filter(x => x.kind === 'audio').length
  s += T(22, 806, String(nt), { size: 30, w: 700 }) + T(26 + tw(String(nt), 30, 700), 806, nt === 1 ? 'track' : 'tracks', { size: 9, a: .65 })
  s += Cc(150, 796, 11, { fill: BH.red }) + P('M150 789V803M143 796H157', { stroke: BH.paper, sw: 2.2 }) + hit(135, 781, 30, 30, 'addtrack')
  /* the smallest, at the foot */
  const small = (x, y, key, v, a) => { const w = tw(v, 10, 500); SKV.field[a] = fld(x - 2, y - 10, Math.max(56, w + 14), 14); return bhLab(x, y - 12, key) + T(x, y, v, { size: 10, w: 500 }) + P(`M${n(x + w + 4)} ${y - 5}l2.6 2.8l2.6 -2.8`, { stroke: BH.black, sw: 1 }) + hit(x - 3, y - 20, w + 14, 24, a) }
  s += small(22, 848, 'tool', toolWord(S.tool), 'toolmenu') + small(80, 848, 'mode', S.mode, 'modemenu') + small(138, 848, 'grid', S.grid, 'grid')
  s += small(22, 878, 'nudge', S.nudge, 'nudge')
  const sq = (x, y, on, word, a) => R(x, y - 7, 7, 7, on ? { fill: BH.black } : { stroke: BH.black, sw: 1.1 }) + T(x + 11, y, word, { size: 9, a: on ? 1 : .55 }) + hit(x - 2, y - 11, tw(word, 9) + 16, 15, a)
  s += sq(80, 874, !!S.auto, 'automation', 'autokey') + sq(80, 890, !!S.flex, 'rubato', 'flexkey')
  const zf = clamp(Math.log(PXB / fitPXB()) / Math.log(640 / fitPXB()), 0, 1), rf = rhF(), zw = 84
  const zoom = (x, y, f, a, word) => bhLab(x + zw / 2, y - 7, word, { anchor: 'middle' }) + R(x, y, zw, 1.4, { fill: BH.black }) + Cc(x + zw * f, y + .7, 3.4, { fill: BH.red }) + hit(x - 5, y - 9, zw + 10, 16, a, ` data-x0="${n(o + x * k)}" data-w="${n(zw * k)}"`, 'ew-resize')
  s += zoom(14, 922, zf, 'zoomx', 'zoom across') + zoom(111, 922, rf, 'zoomy', 'zoom down')
  const ground = R(0, 0, CW, H, { fill: K1 }) + R(SKIN.colRight ? 0 : CW - 3, 0, 3, H, { fill: BH.black })      // (its black edge toward the room)
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
  const sg = BHX.strip, tk = S.tracks[S.sel]
  if (sg && tk && typeof METERS === 'object') {                                          // the chosen track's two bars: as loud as each side (one level for both where the app gives one)
    const two = METERS.ts && METERS.ts.get(tk.id), mono = METERS.now.get(tk.id) || 0, f = v => volF(Math.min(6, linDb(v)))
    ;[two ? two[0] : mono, two ? two[1] : mono].forEach((v, q) => { const el = $('bhs-' + q); if (el) { const hh = sg[1] * f(v); el.setAttribute('y', n(sg[0] + sg[1] - hh)); el.setAttribute('height', n(hh)) } })
  }
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

/* ── the mixer (his pick of design/bauhaus mixer draft 2, 2026-10-21): every track in sight ──
   A strip a column of a poster, no rules between them; the strips share the width so that every track is in sight. The
   chosen tracks stand open: their number large in their colour (on a black block) and their name, their pan a ring with a
   needle, what is on their patch as squares of colour with names, a red disc to put one on; the level, the largest part: a bar of their colour as high as they sound, a black rule, a red disc on it and its
   figure beside, and right of it their sends as round knobs, how much under each; their buttons as shapes and where
   they go. The others close to their number, their name turned up the
   strip, the bar and the red disc, mute and solo. Pressed, a closed strip opens (it is chosen). Only past what the width
   holds do the strips scroll, and a row of the numbers over them goes to any one. The out at the right: a blue bar for
   each side, a black disc on the rule, its figure large. */
const BMX = { v: new Map() }
const BMX_WIDE = 148, BMX_MIN = 15, BMX_COL = 34                                   // (BMX_COL: a column of send knobs more, when a strip's height holds no more)
const bmxSends = () => typeof MAX_SENDS === 'number' ? MAX_SENDS : 10                // (as many sends as a track can have: engine.js)
/* where a strip's send knobs stand: as many to a column as its height holds at their smallest, sized so six stand in one
   (his word); past that the strip is wider to the right by a column (his word, 2026-10-21), ten at most */
function bmxKnobs (t, lh) {
  const sends = t.sends || [], canAdd = !t.theirs && sends.length < bmxSends(), count = sends.length + (canAdd ? 1 : 0)
  const fits = Math.max(1, Math.floor(lh / 28)), inCol = Math.min(fits, Math.max(6, count)), cols = Math.max(1, Math.ceil(count / inCol)), per = lh / inCol
  return { sends, canAdd, inCol, cols, per, kr: clamp((per - 14) / 2, 5.5, 11), extra: (cols - 1) * BMX_COL }
}
function bhMixer (y, h) {
  const vis = rows(), mw = 150, gutter = 14, room0 = RX - mw - gutter * 2
  /* how many lines the open strips' patches take: the level starts under the longest */
  const lines = t => { const f = fxItems(t).length; return Math.min(f, 3) + (f > 3 ? 1 : 0) + (t.theirs ? 0 : 1) }
  const allOpen0 = vis.length * 104 <= room0, openers = allOpen0 ? vis : vis.filter(i => isChosen(i))
  const most = Math.max(3, ...openers.map(i => lines(S.tracks[i])))
  const lh0 = Math.max(30, (y + h - 50) - (y + 26 + 46 + most * 13))                      // (the level's height at its least: what the knobs are planned for)
  const extraOf = i => bmxKnobs(S.tracks[i], lh0).extra, room = room0 - openers.reduce((a, i) => a + extraOf(i), 0)
  const nOpen = Math.min(vis.filter(i => isChosen(i)).length, Math.floor(room / BMX_WIDE))
  let wide = BMX_WIDE, slim = 0, list = vis, over = false
  if (vis.length * 104 <= room) { wide = clamp(Math.floor(room / vis.length), 104, BMX_WIDE); slim = wide }
  else {
    slim = Math.floor((room - nOpen * BMX_WIDE) / Math.max(1, vis.length - nOpen))
    if (slim < BMX_MIN) {
      over = true; slim = BMX_MIN
      const fitN = nOpen + Math.floor((room - nOpen * BMX_WIDE) / BMX_MIN), at = vis.indexOf(S.sel)
      if (at >= 0 && (at < S.panel.mx || at >= S.panel.mx + fitN)) S.panel.mx = at - Math.floor(fitN / 2)      // (the track chosen elsewhere is brought into sight)
      S.panel.mx = clamp(S.panel.mx, 0, Math.max(0, vis.length - fitN)); list = vis.slice(S.panel.mx, S.panel.mx + fitN)
    }
    slim = Math.min(slim, 100)
  }
  const top = y + (over ? 26 : 10), foot = y + h - 10, lt = top + 46 + most * 13, lb = foot - 40, lh = Math.max(30, lb - lt)
  const yOf = db => lb - lh * volF(db)
  BMX.v.clear()
  let s = R(0, y, RX, h, { fill: K1 })
  if (over) {
    const cw = Math.min(22, (RX - 2 * gutter) / vis.length)
    vis.forEach((i, k) => { const t = S.tracks[i], x = gutter + k * cw; s += T(x + cw / 2, y + 16, String(i + 1), { size: 8, w: 700, c: bhInk(bhCol(t)), a: list.includes(i) ? 1 : .45, anchor: 'middle' }) + hit(x, y + 4, cw, 16, 'msel', ` data-i="${i}"`) })
  }
  let x = gutter
  for (const i of list) {
    const t = S.tracks[i], di = ` data-i="${i}"`, sel = isChosen(i), c = bhCol(t), ink = bhInk(c), vol = shown(t, 'vol'), open = sel || slim >= 104, kp = open ? bmxKnobs(t, lh0) : null, sw = open ? wide : slim      // (sw: the strip as it is drawn; it takes kp.extra more for its knobs)
    const num = pad2(i + 1)
    BMX.v.set(t.id, [lt, lh])
    if (sw >= 104) {
      const nw = tw(num, 26, 700), pan = shown(t, 'pan') || 0
      if (sel) s += R(x - 4, top - 2, nw + 8, 30, { fill: BH.black })
      s += T(x, top + 23, num, { size: 26, w: 700, c: sel ? BH.paper : ink }) + T(x + nw + 8, top + 22, fit(asGiven(t.name), sw - nw - 44, 12, 600), { size: 12, w: 600, a: heard(t) ? 1 : .5 }) + hit(x - 4, top - 2, sw - 30, 32, 'msel', di)
      const pcx = x + sw - 26, pcy = top + 14, a = pan * 2.4
      s += Cc(pcx, pcy, 9, { stroke: BH.black, sw: 1.3 }) + P(`M${n(pcx)} ${n(pcy)}L${n(pcx + 9 * Math.sin(a))} ${n(pcy - 9 * Math.cos(a))}`, { stroke: BH.black, sw: 1.6 }) + hit(pcx - 16, pcy - 13, 32, 26, 'mpan', `${di} data-x="${n(pcx - 30)}" data-pw="60"`, 'ew-resize')
      /* its patch, a red disc to put one on */
      const its = fxItems(t)
      let yy = top + 46
      its.slice(0, 3).forEach((it, j) => { s += R(x, yy - 7, 7, 7, { fill: it.c || BH.black, fa: it.off ? .35 : 1 }) + T(x + 11, yy, fit(asGiven(it.t), sw - 40, 9), { size: 9, a: it.off ? .45 : .9 }) + hit(x - 2, yy - 10, sw - 30, 13, 'mfx', `${di} data-k="${j}"`); yy += 13 })
      if (its.length > 3) { s += T(x + 11, yy, `+${its.length - 3} more`, { size: 8, a: .5 }) + hit(x - 2, yy - 10, sw - 30, 13, 'm-patch', di); yy += 13 }
      if (!t.theirs) s += Cc(x + 3.5, yy - 3.5, 4.5, { fill: BH.red }) + P(`M${n(x + 3.5)} ${n(yy - 6.5)}v6M${n(x + .5)} ${n(yy - 3.5)}h6`, { stroke: BH.paper, sw: 1.2 }) + hit(x - 3, yy - 10, 14, 13, 'mfxadd', di)
      /* its sends: round knobs down the room right of the level, as many as there are and one more to give another (his
         word on draft 2: knobs as Logic Pro's sends, how much under each); a column more to the right when they run out */
      const per = lh / kp.inCol, kr = clamp((per - 14) / 2, 5.5, 11)
      const at = j => ({ kx: x + sw - 22 + Math.floor(j / kp.inCol) * BMX_COL, cy: lt + per * (j % kp.inCol) + kr + 3 })
      const knob = (kx, cy, f, c) => { const a0 = -135 * Math.PI / 180, a1 = a0 + f * 270 * Math.PI / 180, on = (r, q) => `${n(kx + r * Math.sin(q))} ${n(cy - r * Math.cos(q))}`; return Cc(kx, cy, kr, { fill: BH.paper, stroke: BH.black, sw: 1.2 }) + (f > .004 ? P(`M${on(kr + 2.6, a0)}A${n(kr + 2.6)} ${n(kr + 2.6)} 0 ${f > 2 / 3 ? 1 : 0} 1 ${on(kr + 2.6, a1)}`, { stroke: c, sw: 2.4 }) : '') + P(`M${n(kx)} ${n(cy)}L${on(kr - 1, a1)}`, { stroke: BH.black, sw: 1.6 }) }
      kp.sends.forEach((sd, k) => {
        const { kx, cy } = at(k), b = byId(sd.to), turning = drag && drag.a === 'msend' && drag.i === i && drag.k === k
        /* under it the bus it goes to; the pointer over it (or turning it), how much it sends — his word, 2026-10-21 */
        const nm = T(kx, cy + kr + 9, fit(asGiven(b ? b.name : 'send'), BMX_COL - 2, 7.5, 600), { size: 7.5, w: 600, a: .8, anchor: 'middle', x: ' class="bmk-name"' })
        const db = T(kx, cy + kr + 9, fmtDb(sd.db), { size: 7.5, w: 600, c: BH.red, anchor: 'middle', x: ' class="bmk-db"' })
        s += `<g class="bmk${turning ? ' on' : ''}">` + knob(kx, cy, volF(sd.db), sendTapC(sd, true)) + nm + db + hit(kx - kr - 5, cy - kr - 5, 2 * kr + 10, 2 * kr + 16, 'msend', `${di} data-k="${k}" data-rel="1" data-x="${n(kx - 60)}" data-pw="120"`, 'ns-resize') + '</g>'
      })
      if (kp.canAdd) { const { kx, cy } = at(kp.sends.length); s += Cc(kx, cy, kr, { stroke: BH.black, sw: 1, dash: '2 2', sa: .5 }) + P(`M${n(kx)} ${n(cy - 4)}v8M${n(kx - 4)} ${n(cy)}h8`, { stroke: BH.black, sw: 1.2, sa: .6 }) + hit(kx - kr - 4, cy - kr - 4, 2 * kr + 8, 2 * kr + 8, 'msendadd', di) }
      /* the level */
      const bw = 16, rx0 = x + bw + 16, fy = yOf(vol)
      s += R(x, lt, bw, lh, { fill: BH.black, fa: .05 }) + R(x, lb, bw, 0, { fill: c, x: ` id="bmx-${t.id}"` })
      for (const db of [6, 0, -6, -12, -24]) s += R(rx0 - 5, yOf(db) - .4, 3, .8, { fill: BH.black, fa: .4 })
      s += R(rx0 - .9, lt, 1.8, lh, { fill: BH.black }) + Cc(rx0, fy, 7, { fill: BH.red, fa: heard(t) ? 1 : .5 }) + T(rx0 + 12, fy + 4, fmtDb(vol), { size: 11, w: 700 })
      s += hit(x - 2, lt - 8, sw - 38, lh + 16, 'mvol', `${di} data-w="0"`, 'ns-resize')      // (short of the sends' knobs)
      let cx = x
      for (const it of cellsOf(t)) { s += bhShape(it.t, cx, foot - 26, 9, it.on, it.t === 's' ? BH.blue : BH.black) + hit(cx - 3, foot - 30, 15, 17, it.a, di); cx += 17 }
      s += T(x, foot - 2, '→ ' + fit(asGiven(outName(t)), sw - 46, 8.5), { size: 8.5, a: .6 }) + hit(x - 2, foot - 12, sw - 30, 13, 'mout', di)
    } else {
      const cxm = x + (sw - 6) / 2, fy = yOf(vol)
      s += T(cxm, top + 18, sw >= 30 ? num : String(i + 1), { size: sw >= 30 ? 15 : 10, w: 700, c: ink, anchor: 'middle' })
      s += `<text x="${n(cxm + 3.5)}" y="${n(lt - 10)}" transform="rotate(-90 ${n(cxm + 3.5)} ${n(lt - 10)})" font-family="${FONT}" font-size="${n(9.5 * TF.scale)}" font-weight="500" fill="${BH.black}"${heard(t) ? '' : ' fill-opacity=".5"'}>${esc(fit(asGiven(t.name), lt - top - 34, 9.5))}</text>`
      s += hit(x, top - 2, sw - 4, lt - top, 'msel', di)
      const bw = Math.max(5, Math.min(12, sw * .3)), bx0 = cxm - bw - 1, rx0 = cxm + 4
      s += R(bx0, lt, bw, lh, { fill: BH.black, fa: .05 }) + R(bx0, lb, bw, 0, { fill: c, x: ` id="bmx-${t.id}"` })
      s += R(rx0 - .6, lt, 1.2, lh, { fill: BH.black }) + Cc(rx0, fy, sw >= 30 ? 5 : 4, { fill: BH.red, fa: heard(t) ? 1 : .5 })
      s += hit(x, lt - 6, sw - 4, lh + 12, 'mvol', `${di} data-w="0"`, 'ns-resize')
      cellsOf(t).filter(it => it.t === 'm' || it.t === 's').forEach((it, k) => { const yy = foot - 30 + k * 13; s += bhShape(it.t, cxm - 3.5, yy, 7, it.on, it.t === 's' ? BH.blue : BH.black) + hit(x, yy - 3, sw - 4, 13, it.a, di) })
    }
    x += sw + (kp ? kp.extra : 0)
  }
  /* the out */
  const ox = RX - mw - gutter + 18, fy = yOf(S.master), mr = ox + 50
  BMX.v.set('M', [lt, lh])
  s += T(ox, top + 23, 'out', { size: 26, w: 700, c: BH.blue }) + bhLab(ox + 52, top + 21, 'stereo') + hit(ox - 4, top - 2, mw - 20, 32, 'wall-out')
  s += R(ox, lt, 12, lh, { fill: BH.black, fa: .05 }) + R(ox, lb, 12, 0, { fill: BH.blue, x: ' id="bmx-ML"' }) + R(ox + 15, lt, 12, lh, { fill: BH.black, fa: .05 }) + R(ox + 15, lb, 12, 0, { fill: BH.blue, x: ' id="bmx-MR"' })
  for (const db of [6, 0, -6, -12, -24]) s += R(mr - 5, yOf(db) - .4, 3, .8, { fill: BH.black, fa: .4 }) + bhLab(mr - 9, yOf(db) + 2, db > 0 ? '+' + db : db, { anchor: 'end', size: 5 })
  s += R(mr - .9, lt, 1.8, lh, { fill: BH.black }) + Cc(mr, fy, 9, { fill: BH.black }) + T(mr + 16, fy + 6, fmtDb(S.master), { size: 18, w: 700 })
  s += hit(ox - 2, lt - 8, mw - 20, lh + 16, 'mmaster', '', 'ns-resize')
  return s
}
SKINS.mixer.poster = bhMixer
SKIN_OWN_STRIP.add('poster')                                                          // (its column holds the chosen track's strip: the patch keeps none at its right — panel.js SIDE)
/* the column's strip is the chosen track's: drawn again where the heads and the panel below change (another track chosen, a level, a send, a plug-in), as panel.js's strip is
   (this file comes before ui.js: its uiDirty is wrapped once every file is in) */
addEventListener('DOMContentLoaded', () => { const dirty0 = uiDirty
  uiDirty = function () { dirty0.apply(this, arguments); if (SKIN.k.transport === 'poster' && BHX.strip) for (const q of arguments) if (q === 'head' || q === 'dock') { dirty0('top'); break } } })
/* a send's knob shows its bus; how much it sends, while the pointer is over it or it is turned */
{ const st = document.createElement('style'); st.textContent = '.bmk .bmk-db{display:none}.bmk:hover .bmk-db,.bmk.on .bmk-db{display:inline}.bmk:hover .bmk-name,.bmk.on .bmk-name{display:none}'; document.head.appendChild(st) }
/* the panel's tabs: words, the open one on a black block */
SKINS.tabs.poster = (x, y, h, items, o = {}) => {
  let s = '', cx = x
  items.forEach((it, k) => {
    const w = tw(it.t, 11, it.on ? 600 : 500), cw = o.widths ? o.widths[k] : w + 16      // (as wide as the room's own tabs where it says: what follows them stays where it was)
    s += (it.on ? R(cx, y, Math.max(cw, w + 12), h, { fill: BH.black }) : '') + T(cx + 6, y + h / 2 + 4, it.t, { size: 11, w: it.on ? 600 : 500, c: it.on ? BH.paper : BH.black, a: it.on ? 1 : .75 }) + hit(cx, y, cw, h, it.a)
    cx += cw + (o.widths ? 0 : 4)
  })
  return [s, cx - x]
}
{ /* the mixer's bars, as loud as each track sounds now */
  const frame0 = SKINS.frame.poster
  SKINS.frame.poster = p => {
    frame0(p)
    if (typeof METERS !== 'object' || !BMX.v.size) return
    const f = v => volF(Math.min(6, linDb(v)))
    const bar = (id, g, v) => { const el = $(id); if (el && g) { const hh = g[1] * f(v); el.setAttribute('y', n(g[0] + g[1] - hh)); el.setAttribute('height', n(hh)) } }
    for (const [key, g] of BMX.v) { if (key === 'M') { bar('bmx-ML', g, METERS.mm[0]); bar('bmx-MR', g, METERS.mm[1]) } else bar('bmx-' + key, g, METERS.now.get(key) || 0) }
  }
}
