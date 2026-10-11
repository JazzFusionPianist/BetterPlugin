/* notes and instruments, round 1 — A DRAFT of what is new to the eye, drawn with the room's own kit on the room's own page
   (draft.mjs reads this into the page; the app does not). Nothing here takes the pointer yet: once the look is agreed,
   these become parts of the page and get their hands.
     the notes page   a third page of the panel below the lanes (patch, mixer, notes): the chosen region's notes against
                      the keys, how hard each is played underneath; for a kit, its pads instead of keys
     the instrument   what stands at the head of a track of notes' patch, opened: the synth, the kit, the sampler
     the keyboard     the computer's keys as a keyboard (command k) */
const ND = { inst: false, keys: false, view: { a: 32, b: 40, hi: 86 }, chosen: new Set(), pad: 2, held: new Set(), rowH: 9 }
const NOTES_RU = 15, NOTES_VH = 58
const isBlack = p => [1, 3, 6, 8, 10].includes(((p % 12) + 12) % 12)

/* the track's own strip and the room's, at the right of a page of the panel (as the patch has them) */
function sideStrips (y, h) {
  const t = S.tracks[S.sel], rx = RX - SIDE, x1 = rx + GUT, x2 = x1 + WSTRIP + 6
  let s = R(rx, y, RX - rx, h, { fill: K2, fa: .6 }) + vline(rx - .5, y, y + h, .08)
  MGEOM = stripGeom(y, h, true)
  s += stripGutter(rx, GUT, y, h, true)
  s += R(x1, y, WSTRIP, h, { fill: INK, fa: .05 }) + strip(x1, y, WSTRIP, h, t, S.sel, { wide: true, sel: true }) + vline(x1 + WSTRIP + 2.5, y + 8, y + h - 8, .07)
  return s + strip(x2, y, WSTRIP, h, MASTER(), -1, { wide: true, master: true })
}
/* a thing that is turned: its name, a line with a mark on it (the room's own level line), what it reads */
const turn = (x, y, name, f, val, o = {}) => {
  const { lw = 70, w = 132, mid } = o, bx0 = x + lw, at = bx0 + w * clamp(f, 0, 1)
  return T(x, y + 3.4, name, { size: 9.5, a: .46 }) + R(bx0, y - 1, w, 2, { fill: INK, fa: .12 })
    + (mid ? R(Math.min(bx0 + w / 2, at), y - 1, Math.abs(at - bx0 - w / 2), 2, { fill: INK, fa: .5 }) + R(bx0 + w / 2, y - 2.5, 1, 5, { fill: INK, fa: .3 }) : R(bx0, y - 1, at - bx0, 2, { fill: INK, fa: .5 }))
    + R(at - 1, y - 5, 2, 10, { fill: INK }) + T(bx0 + w + 50, y + 3.4, val, { size: 9.5, a: .9, anchor: 'end' })
}
const groupName = (x, y, name) => T(x, y, name, { size: 9, a: .34 })

/* ── the panel's own bar: patch, mixer, notes ── */
pPanelHead = function (y, tab) {
  const t = S.tracks[S.sel], by = y + 16.6
  let s = R(0, y, RX, PH, { fill: K2 }) + hline(0, RX, y, .14) + hline(0, RX, y + PH - .5, .08)
  s += R(RX / 2 - 12, y + 2, 24, 2, { rx: 1, fill: INK, fa: .2 }) + hit(0, y - 3, RX, 8, 'pgrip', '', 'ns-resize')
  s += cells(10, y + 4, 18, [{ t: 'patch', on: tab === 'patch', a: 'tab-patch' }, { t: 'mixer', on: tab === 'mixer', a: 'tab-mixer' }, { t: 'notes', on: tab === 'notes', a: 'tab-notes' }], { size: 9.5, widths: [48, 48, 48] })[0]
  const nx = 168
  if (tab === 'mixer') return s + field(nx, by, 'strips', String(rows().length))[0]
  const nm = fit(t.name, 160, 10.5, 500)
  s += R(nx, y + 10, 6, 6, { fill: t.c }) + T(nx + 12, by, nm, { size: 10.5, w: 500 })
  let ax = nx + 12 + tw(nm, 10.5, 500) + 7
  if (tab === 'patch') {
    s += T(ax, by, `track ${S.sel + 1}`, { size: 9.5, a: .4 })
    const rx = RX - SIDE, o = { armed: ND.inst }, word = isInst(t) ? instName(t) : 'plug-ins'
    if (ND.inst && isInst(t)) { const cw = keyW('chain', {}); s += key(rx - 12 - cw, y + 4, 'chain', {})[0]; s += T(rx - 12 - cw - 10, by, `${instName(t)}  ${instWord(t)}`, { size: 9.5, a: .6, anchor: 'end' }) }
    else s += key(rx - 12 - keyW('plug-ins', {}), y + 4, 'plug-ins', {})[0]
    return s + vline(rx - .5, y, y + PH, .08) + T(rx + 12, by, 'strip', { size: 9.5, a: .4 })
  }
  /* notes: which region, then what the region does to its notes — the grid they are pulled to, how far, how late the off-beats, how far up or down, how much harder */
  const r = (S.selR.length && regOf(S.selR[0])[0]) || t.regs.find(q => q.notes)
  if (r) { const nmR = r.tag || r.name || 'region'; s += T(ax, by, nmR, { size: 9.5, a: .7 }); ax += tw(nmR, 9.5) + 8; s += T(ax, by, `bars ${+(r.a).toFixed(2)} to ${+(r.b).toFixed(2)}`, { size: 9.5, a: .4 }) }
  const g = r && r.q ? `1/${Math.round(4 / r.q)}` : 'off', fs = [['strength', String(Math.round((r && r.qs != null ? r.qs : 1) * 100))], ['swing', String(Math.round(((r && r.sw) || 0) * 100))], ['transpose', (r && r.tr ? (r.tr > 0 ? '+' : '−') + Math.abs(r.tr) : '0')], ['velocity', (r && r.vel ? (r.vel > 0 ? '+' : '−') + Math.abs(r.vel) : '0')]]
  let fx = RX - 14
  for (const [name, v] of fs.slice().reverse()) { const w = tw(name, 9.5) + 5 + tw(v, 9.5); fx -= w; s += field(fx, by, name, v)[0]; fx -= 18 }
  const mw = Math.round(tw(g, 9.5) + 26); fx -= mw; s += menuKey(fx, y + 4, g)[0]; fx -= tw('grid', 9.5) + 6; s += T(fx, by, 'grid', { size: 9.5, a: .4 })
  return s
}

/* ── the notes page ── */
function pNotes (y, h) {
  const t = S.tracks[S.sel], r = (S.selR.length && regOf(S.selR[0])[0]) || t.regs.find(q => q.notes), kit = isInst(t) && t.inst.kind === 'drums'
  const KW = kit ? 98 : 46, x0 = KW, x1 = RX, top = y + NOTES_RU, bot = y + h - NOTES_VH, gh = bot - top, V = ND.view
  const pxb = (x1 - x0) / (V.b - V.a), X = bar => x0 + (bar - V.a) * pxb
  const rowH = kit ? Math.floor(gh / DRUM_PADS.length) : ND.rowH, count = kit ? DRUM_PADS.length : Math.floor(gh / rowH), hi = kit ? 0 : V.hi, lo = hi - count + 1
  const rowOfKey = p => kit ? (() => { const i = DRUM_PADS.findIndex(q => q[1] === p); return i < 0 ? -1 : DRUM_PADS.length - 1 - i })() : hi - p
  const Y = p => top + rowOfKey(p) * rowH, gb = top + count * rowH
  const cid = 'nt' + (++UID), L = r ? regLook(r, t) : { c: t.c, deep: t.deep, sel: t.csel }
  let s = R(0, y, RX, h, { fill: K0 }) + `<clipPath id="${cid}"><rect x="${x0}" y="${n(y)}" width="${n(x1 - x0)}" height="${n(h)}"/></clipPath>`
  let g = ''
  /* the rows: the white keys a shade lighter, a line under every c; for a kit a line under every pad */
  if (kit) { let d = ''; for (let k = 1; k <= count; k++) d += `M${x0} ${top + k * rowH - .5}H${x1}`; g += P(d, { stroke: INK, sa: .05 }) }
  else for (let p = hi; p >= lo; p--) { if (!isBlack(p)) g += R(x0, Y(p), x1 - x0, rowH, { fill: INK, fa: .03 }); if (((p % 12) + 12) % 12 === 0) g += hline(x0, x1, Y(p) + rowH - 1, .09) }
  /* the grid: bars, beats, the steps notes are drawn on */
  { let bars = '', beats = '', steps = ''
    const b = BEATS(), st = b * BEAT_16()
    for (let k = Math.floor(V.a * st); k <= Math.ceil(V.b * st); k++) { const x = n(X(k / st)) + .5, ln = `M${x} ${top}V${y + h}`; if (k % st === 0) bars += ln; else if (k % BEAT_16() === 0) beats += ln; else if (pxb / st >= 5) steps += ln }
    g += P(steps, { stroke: INK, sa: kit ? .05 : .03 }) + P(beats, { stroke: INK, sa: kit ? .1 : .075 }) + P(bars, { stroke: INK, sa: .16 }) }
  /* its notes; and, fainter, what the lane holds on either side of the region */
  const draw = (q, own) => {
    let out = ''
    for (const x of regSound(q)) {
      if (rowOfKey(x.n) < 0 || rowOfKey(x.n) >= count) continue
      const xa = X(x.a), w = kit ? Math.max(3, pxb / (BEATS() * BEAT_16()) - 2) : Math.max(2, (x.b - x.a) * pxb - 1), on = own && ND.chosen.has(x.id)
      if (xa + w < x0 || xa > x1) continue
      const fa = own ? .5 + .5 * x.v / 127 : .22
      out += R(xa + .5, Y(x.n) + 1, w, rowH - 2, { rx: 1, fill: on ? L.sel : L.c, fa: on ? 1 : fa }) + (on ? R(xa + 1, Y(x.n) + 1.5, w - 1, rowH - 3, { rx: 1, stroke: INK }) : '')
    }
    return out
  }
  for (const q of t.regs) if (q.notes && q !== r) g += draw(q, false)
  if (r) {
    const xa = X(r.a - 1), xb = X(r.b - 1)
    g += draw(r, true)
    if (xa > x0) g += R(x0, top, xa - x0, y + h - top, { fill: K1, fa: .6 })               // outside the region the page is dimmed: what is edited is the region
    if (xb < x1) g += R(xb, top, x1 - xb, y + h - top, { fill: K1, fa: .6 })
    g += P(`M${n(xa) + .5} ${top}V${y + h}M${n(xb) + .5} ${top}V${y + h}`, { stroke: INK, sa: .34 })
  }
  /* how hard each note is played: a stem under it */
  { const vy = bot, base = y + h - 6, room = NOTES_VH - 18
    g += R(x0, vy, x1 - x0, NOTES_VH, { fill: K0 }) + hline(x0, x1, vy, .14) + hline(x0, x1, base - room, .05) + hline(x0, x1, base - room / 2, .035) + hline(x0, x1, base, .08)
    if (r) for (const x of regSound(r)) { const xa = X(x.a), hg = room * x.v / 127, on = ND.chosen.has(x.id); if (xa < x0 - 4 || xa > x1) continue; g += R(xa + .5, base - hg, 2, hg, { fill: on ? L.sel : L.c, fa: on ? 1 : .85 }) + R(xa + .5, base - hg, 5, 2, { fill: on ? INK : L.c }) } }
  { const px = X(curPos()); if (px >= x0 && px <= x1) g += P(`M${Math.round(px) + .5} ${y}V${y + h}`, { stroke: INK }) }
  s += G(g, '', ` clip-path="url(#${cid})"`)
  /* the bars along the top, and the region's own stretch marked on them */
  s += R(0, y, RX, NOTES_RU, { fill: K1 }) + hline(0, RX, y + NOTES_RU - .5, .1)
  for (let b = Math.ceil(V.a); b <= V.b; b++) { const x = X(b); if (x < x0 || x > x1 - 12) continue; s += T(x + 4, y + 10.6, String(b + 1), { size: 8.5, a: .5 }) + P(`M${n(x) + .5} ${y + 3}V${y + NOTES_RU}`, { stroke: INK, sa: .22 }) }
  if (r) s += R(Math.max(x0, X(r.a - 1)), y + NOTES_RU - 3, Math.max(0, Math.min(x1, X(r.b - 1)) - Math.max(x0, X(r.a - 1))), 2, { fill: L.c })
  /* the keys down the left: white ink, black paper, c named — or the kit's pads by name */
  s += R(0, y, KW, h, { fill: K1 })
  if (kit) {
    DRUM_PADS.forEach(([name, key], i) => { const ry = top + (DRUM_PADS.length - 1 - i) * rowH, on = i === ND.pad; if (on) s += R(0, ry, KW, rowH, { fill: INK, fa: .08 }); s += T(10, ry + rowH / 2 + 3.2, name, { size: 9, a: on ? 1 : .74, w: on ? 500 : 400 }) + T(KW - 8, ry + rowH / 2 + 3, keyName(key), { size: 8, a: .32, anchor: 'end' }) + hline(0, KW, ry + rowH - .5, .05) })
  } else {
    let whites = R(0, top, KW, count * rowH, { fill: INK, fa: .9 }), blacks = '', seams = ''
    for (let p = hi; p >= lo; p--) {
      const ry = Y(p), pc = ((p % 12) + 12) % 12
      if (isBlack(p)) { blacks += R(0, ry, Math.round(KW * .6), rowH, { fill: K0 }); seams += `M${Math.round(KW * .6)} ${n(ry + rowH / 2)}H${KW}` }
      else if (pc === 4 || pc === 11) seams += `M0 ${ry}H${KW}`                         // (e and b have no black key above them: their upper edge is a seam all the way across)
      if (ND.held.has(p)) whites += R(isBlack(p) ? 0 : Math.round(KW * .6), ry, isBlack(p) ? Math.round(KW * .6) : KW - Math.round(KW * .6), rowH, { fill: L.c })
      if (pc === 0) blacks += T(KW - 4, ry + rowH - 1.6, keyName(p), { size: 7.5, w: 500, c: K1, anchor: 'end' })
    }
    s += whites + P(seams, { stroke: K0, sa: .38 }) + blacks
  }
  s += R(0, bot, KW, NOTES_VH, { fill: K1 }) + T(kit ? 10 : 6, bot + 15, 'velocity', { size: 8.5, a: .4 }) + (kit ? T(KW - 8, y + h - 6 - (NOTES_VH - 18) + 3, '127', { size: 7.5, a: .3, anchor: 'end' }) : '') + hline(0, KW, bot, .14)
  s += vline(KW - .5, y, y + h, .12)
  /* where the page stands: along the song, and among the keys */
  s += R(x0 + 4 + (x1 - x0 - 8) * .34, y + h - 4.5, (x1 - x0 - 8) * .12, 3, { rx: 1.5, fill: INK, fa: .22 })
  if (!kit) s += R(RX - 5, top + 3 + (gh - 6) * (127 - hi) / 128, 3, Math.max(14, (gh - 6) * count / 128), { rx: 1.5, fill: INK, fa: .22 })
  return s
}

/* ── the instrument, opened where the patch stands ── */
function pInstr (y, h) {
  const t = S.tracks[S.sel], I = t.inst, rx = RX - SIDE
  let s = sideStrips(y, h)
  const p = instParams(I)
  if (I.kind === 'synth') {
    /* the sounds, in one frame cut into cells; then what is turned, in three columns */
    const names = Object.keys(SYNTH_SOUNDS), cw = 112, ch = 22, gx = 24, gy = y + 36, per = Math.ceil(names.length / 2)
    s += groupName(gx, y + 24, 'sound')
    let cellsS = '', div = ''
    names.forEach((nm, i) => { const cx = gx + (i < per ? 0 : cw), cy = gy + (i % per) * ch, on = nm === I.sound; if (on) cellsS += R(cx, cy, cw, ch, { fill: INK }); cellsS += T(cx + 10, cy + 14.6, nm, { size: 9.5, w: on ? 500 : 400, c: on ? K1 : INK, a: on ? 1 : .66 }) })
    for (let k = 1; k < per; k++) div += `M${gx + 1} ${gy + k * ch + .5}H${gx + 2 * cw - 1}`
    div += `M${gx + cw + .5} ${gy + 1}V${gy + per * ch - 1}`
    s += cellsS + P(div, { stroke: INK, sa: .15 }) + R(gx + .5, gy + .5, 2 * cw - 1, per * ch - 1, { rx: 2, stroke: INK, sa: .24 })
    const c1 = gx + 2 * cw + 44, colW = Math.min(300, (rx - c1 - 20) / 3), bw = colW - 70 - 64, row = 25
    const v = (k, d) => p[k] == null ? d : p[k], ms = x => x >= 1 ? `${+x.toFixed(2)} s` : `${Math.round(x * 1000)} ms`, hz = x => x >= 1000 ? `${+(x / 1000).toFixed(1)}k` : String(Math.round(x)), tf = x => Math.log(x / .0005) / Math.log(10 / .0005)
    let cx = c1, cy = y + 24
    s += groupName(cx, cy, 'filter'); cy += 22
    s += turn(cx, cy, 'cutoff', Math.log(v('cutoff', 4000) / 20) / Math.log(1000), hz(v('cutoff', 4000)), { w: bw }); cy += row
    s += turn(cx, cy, 'resonance', v('reso', .15), String(Math.round(v('reso', .15) * 100)), { w: bw }); cy += row
    s += turn(cx, cy, 'envelope', (v('envAmt', 2) + 6) / 12, (v('envAmt', 2) >= 0 ? '+' : '−') + Math.abs(v('envAmt', 2)).toFixed(1), { w: bw, mid: true }); cy += row
    s += turn(cx, cy, 'follows keys', v('keyTrack', .4), String(Math.round(v('keyTrack', .4) * 100)), { w: bw }); cy += row + 4
    s += T(cx, cy + 3.4, 'slope', { size: 9.5, a: .46 }) + cells(cx + 70, cy - 9, 18, [{ t: '12', on: v('slope', 1) < .5 }, { t: '24', on: v('slope', 1) >= .5 }], { size: 9.5, widths: [34, 34] })[0]
    cx += colW + 16; cy = y + 24
    s += groupName(cx, cy, 'loudness'); cy += 22
    const A = v('aA', .004), D = v('aD', .4), Su = v('aS', .8), Rl = v('aR', .25)
    s += turn(cx, cy, 'attack', tf(A), ms(A), { w: bw }); cy += row
    s += turn(cx, cy, 'decay', tf(D), ms(D), { w: bw }); cy += row
    s += turn(cx, cy, 'sustain', Su, String(Math.round(Su * 100)), { w: bw }); cy += row
    s += turn(cx, cy, 'release', tf(Rl), ms(Rl), { w: bw }); cy += row + 2
    { const ew = 70 + bw + 50, eh = 46, ex = cx, ey = cy - 8, k = ew / 4, xa = ex + k * (.15 + tf(A)), xd = xa + k * (.2 + tf(D)), xs = xd + k * .9, xr = Math.min(ex + ew, xs + k * (.2 + tf(Rl)))
      s += hline(ex, ex + ew, ey + eh, .12) + P(`M${ex} ${ey + eh}L${n(xa)} ${ey + 3}Q${n(xa + (xd - xa) * .25)} ${n(ey + 3 + (eh - 3) * (1 - Su) * .9)} ${n(xd)} ${n(ey + 3 + (eh - 3) * (1 - Su))}H${n(xs)}Q${n(xs + (xr - xs) * .25)} ${n(ey + eh - 3)} ${n(xr)} ${ey + eh}`, { stroke: INK, sa: .8, sw: 1.2 }) }
    cx += colW + 16; cy = y + 24
    s += groupName(cx, cy, 'movement'); cy += 22
    s += turn(cx, cy, 'vibrato', v('vib', 0), String(Math.round(v('vib', 0) * 100)), { w: bw }); cy += row
    s += turn(cx, cy, 'glide', v('glide', 0) / 2, ms(v('glide', 0)), { w: bw }); cy += row
    s += turn(cx, cy, 'width', v('spread', .35), String(Math.round(v('spread', .35) * 100)), { w: bw }); cy += row + 4
    s += T(cx, cy + 3.4, 'voices', { size: 9.5, a: .46 }) + cells(cx + 70, cy - 9, 18, [{ t: 'many', on: v('mono', 0) < .5 }, { t: 'one', on: v('mono', 0) >= .5 }], { size: 9.5, widths: [44, 40] })[0]; cy += row + 14
    s += turn(cx, cy, 'level', (v('level', -6) + 36) / 42, `${fmtDb(v('level', -6))} db`, { w: bw })
  } else if (I.kind === 'drums') {
    /* the pads, four by four, the lowest at the lower left; then the chosen pad's own things */
    const pw = 82, ph = Math.min(54, Math.floor((h - 44) / 4)), gx = 24, gy = y + Math.round((h - 4 * ph) / 2) + 4
    let cs = '', div = ''
    DRUM_PADS.forEach(([name, key], i) => {
      const cx = gx + (i % 4) * pw, cy = gy + (3 - Math.floor(i / 4)) * ph, on = i === ND.pad, own = I.pads && I.pads[i]
      if (on) cs += R(cx, cy, pw, ph, { fill: INK })
      cs += T(cx + 9, cy + 18, name, { size: 9.5, w: on ? 500 : 400, c: on ? K1 : INK, a: on ? 1 : .8 }) + T(cx + 9, cy + ph - 9, keyName(key), { size: 8, c: on ? K1 : INK, a: on ? .6 : .32 })
      if (own) cs += R(cx + pw - 12, cy + 8, 4, 4, { fill: on ? K1 : INK })
    })
    for (let k = 1; k < 4; k++) div += `M${gx + 1} ${gy + k * ph + .5}H${gx + 4 * pw - 1}M${gx + k * pw + .5} ${gy + 1}V${gy + 4 * ph - 1}`
    s += groupName(gx, gy - 10, 'pads') + cs + P(div, { stroke: INK, sa: .15 }) + R(gx + .5, gy + .5, 4 * pw - 1, 4 * ph - 1, { rx: 2, stroke: INK, sa: .24 })
    const [pn, pk] = DRUM_PADS[ND.pad], own = I.pads && I.pads[ND.pad], cx = gx + 4 * pw + 48, bw = 150, row = 25
    let cy = gy + 6
    s += T(cx, cy + 4, pn, { size: 11.5, w: 500 }) + T(cx + tw(pn, 11.5, 500) + 8, cy + 4, keyName(pk), { size: 9.5, a: .4 }); cy += 30
    s += T(cx, cy + 3.4, 'sound', { size: 9.5, a: .46 }) + menuKey(cx + 70, cy - 9, own ? String(own.name).toLowerCase() : 'made here')[0]; cy += row + 6
    const q = k => p[`${pn}.${k}`]
    s += turn(cx, cy, 'level', ((q('level') || 0) + 36) / 42, `${fmtDb(q('level') || 0)} db`, { w: bw }); cy += row
    s += turn(cx, cy, 'tune', ((q('tune') || 0) + 24) / 48, ((q('tune') || 0) >= 0 ? '+' : '−') + Math.abs(q('tune') || 0), { w: bw, mid: true }); cy += row
    s += turn(cx, cy, 'decay', ((q('decay') == null ? 1 : q('decay')) - .2) / 2.8, String(Math.round((q('decay') == null ? 1 : q('decay')) * 100)), { w: bw }); cy += row
    s += turn(cx, cy, 'pan', ((q('pan') || 0) + 1) / 2, panText(q('pan') || 0), { w: bw, mid: true })
    const kx = cx + 70 + bw + 110
    if (kx + 280 < rx) { s += groupName(kx, gy - 10, 'kit') + turn(kx, gy + 36, 'level', ((p.level == null ? -3 : p.level) + 36) / 42, `${fmtDb(p.level == null ? -3 : p.level)} db`, { w: bw }) }
  } else {
    /* the sampler: the sound it plays from, as a region shows a sound; where it starts and ends; the stretch it goes round, marked as the cycle is */
    const wx = 24, wy = y + 32, ww = rx - 48, wh = Math.min(118, h - 150), sm = I.sample, st = p.start || 0, en = p.end == null ? 1 : p.end, l0 = p.loopStart || 0, l1 = p.loopEnd == null ? 1 : p.loopEnd
    s += groupName(wx, y + 22, 'sound') + T(wx + tw('sound', 9) + 8, y + 22, sm ? String(sm.name).toLowerCase() : 'none', { size: 9.5, a: .8 }) + (sm && sm.sec ? T(wx + tw('sound', 9) + 16 + tw(String(sm.name).toLowerCase(), 9.5), y + 22, `${sm.sec.toFixed(2)} s`, { size: 9.5, a: .4 }) : '')
    s += R(wx, wy, ww, wh, { fill: t.c })
    if (sm && sm.peaks) { const pk = sm.peaks, N = pk.length, mid = wy + wh / 2, top = [], bot = []; for (let i = 0; i < N; i++) { const x = wx + 1 + (ww - 2) * i / (N - 1), a = Math.max(.6, pk[i] * (wh / 2 - 5)); top.push(`${n(x)} ${n(mid - a)}`); bot.push(`${n(x)} ${n(mid + a)}`) } s += P('M' + top.join('L') + 'L' + bot.reverse().join('L') + 'Z', { fill: t.deep }) }
    const xs = wx + ww * st, xe = wx + ww * en
    s += R(wx, wy, xs - wx, wh, { fill: K1, fa: .68 }) + R(xe, wy, wx + ww - xe, wh, { fill: K1, fa: .68 })
    s += P(`M${n(xs) + .5} ${wy - 5}V${wy + wh}M${n(xe) + .5} ${wy - 5}V${wy + wh}`, { stroke: INK }) + P(`M${n(xs)} ${wy - 6}H${n(xs) + 6}L${n(xs)} ${wy + 1}Z`, { fill: INK }) + P(`M${n(xe) + 1} ${wy - 6}H${n(xe) - 5}L${n(xe) + 1} ${wy + 1}Z`, { fill: INK })
    if ((p.loop || 0) >= .5) s += R(wx + ww * l0, wy, ww * (l1 - l0), 3, { fill: SOLO }) + P(`M${n(wx + ww * l0) + .5} ${wy}V${wy + wh}M${n(wx + ww * l1) - .5} ${wy}V${wy + wh}`, { stroke: SOLO, sa: .7 })
    let cx = wx, cy = wy + wh + 30
    const bw = 132, colW = 70 + bw + 50 + 34, row = 25, ms = x => x >= 1 ? `${+x.toFixed(2)} s` : `${Math.round(x * 1000)} ms`, tf = x => Math.log(x / .0005) / Math.log(10 / .0005), v = (k, d) => p[k] == null ? d : p[k]
    s += T(cx, cy + 3.4, 'plays', { size: 9.5, a: .46 }) + cells(cx + 70, cy - 9, 18, [{ t: 'while held', on: v('oneShot', 0) < .5 }, { t: 'to its end', on: v('oneShot', 0) >= .5 }], { size: 9.5 })[0]
    s += T(cx, cy + row + 3.4, 'goes round', { size: 9.5, a: .46 }) + cells(cx + 70, cy + row - 9, 18, [{ t: 'no', on: v('loop', 0) < .5 }, { t: 'yes', on: v('loop', 0) >= .5, c: SOLO }], { size: 9.5, widths: [34, 38] })[0]
    s += T(cx, cy + 2 * row + 3.4, 'its own key', { size: 9.5, a: .46 }) + menuKey(cx + 70, cy + 2 * row - 9, keyName(v('root', 60)))[0]
    cx += colW; s += turn(cx, cy, 'attack', tf(v('a', .002)), ms(v('a', .002)), { w: bw }) + turn(cx, cy + row, 'decay', tf(v('d', .3)), ms(v('d', .3)), { w: bw }) + turn(cx, cy + 2 * row, 'sustain', v('s', 1), String(Math.round(v('s', 1) * 100)), { w: bw })
    cx += colW; s += turn(cx, cy, 'release', tf(v('r', .12)), ms(v('r', .12)), { w: bw }) + turn(cx, cy + row, 'tune', (v('tune', 0) + 100) / 200, (v('tune', 0) >= 0 ? '+' : '−') + Math.abs(v('tune', 0)), { w: bw, mid: true }) + turn(cx, cy + 2 * row, 'cutoff', Math.log(v('cutoff', 20000) / 20) / Math.log(1000), v('cutoff', 20000) >= 19000 ? 'open' : `${+(v('cutoff', 20000) / 1000).toFixed(1)}k`, { w: bw })
    cx += colW; if (cx + colW - 30 < rx) s += turn(cx, cy, 'level', (v('level', -3) + 36) / 48, `${fmtDb(v('level', -3))} db`, { w: bw })
  }
  return s
}
pDock = function () {
  if (VIEW.p <= .001) { MGEOM = null; return '' }
  const y = BY, h = S.panel.h, tab = S.panel.tab, t = S.tracks[S.sel]
  const body = tab === 'mixer' ? pMixer(y + PH, h - PH) : tab === 'notes' ? pNotes(y + PH, h - PH) : ND.inst && isInst(t) ? pInstr(y + PH, h - PH) : pPatch(y + PH, h - PH)
  return R(0, y, RX, h + 2, { fill: K1 }) + body + pPanelHead(y, tab)
}

/* ── the keyboard: the computer's keys as they play (command k) — a small sheet over the lower left of the lanes ── */
function pKeyboard () {
  if (!ND.keys) return ''
  const whites = [['a', 0], ['s', 2], ['d', 4], ['f', 5], ['g', 7], ['h', 9], ['j', 11], ['k', 12], ['l', 14], [';', 16], ["'", 17]], blacks = [['w', 1, 0], ['e', 3, 1], ['t', 6, 3], ['y', 8, 4], ['u', 10, 5], ['o', 13, 7], ['p', 15, 8]]
  const kw = 30, wh = 44, bh = 26, bw = 22, padX = 16, side = 118, w = padX * 2 + whites.length * kw + 22 + side, h = 46 + bh + wh - 14 + 18, x = X0 + 12, y = BY - h - 12, kx = x + padX, ky = y + 44, base = TYPE.oct * 12
  let s = R(x, y, w, h, { rx: 3, fill: K2 }) + R(x + .5, y + .5, w - 1, h - 1, { rx: 3, stroke: INK, sa: .28 })
  s += T(x + padX, y + 25, 'keyboard', { size: 11.5, w: 500 }) + T(x + padX + tw('keyboard', 11.5, 500) + 10, y + 25, fit(S.tracks[S.sel].name, 150, 9.5), { size: 9.5, a: .46 })
  /* the white keys in one frame cut into cells, each with its letter; c named */
  let cs = '', div = ''
  whites.forEach(([letter, st], i) => { const cx = kx + i * kw, on = ND.held.has(base + st); if (on) cs += R(cx, ky, kw, wh + bh - 14, { fill: INK }); cs += T(cx + kw / 2, ky + bh + wh - 26, letter, { size: 10.5, w: on ? 500 : 400, c: on ? K1 : INK, a: on ? 1 : .86, anchor: 'middle' }); if (st % 12 === 0) cs += T(cx + kw / 2, ky + bh + wh - 14 - 5 + 1, keyName(base + st), { size: 7.5, c: on ? K1 : INK, a: on ? .7 : .36, anchor: 'middle' }); if (i) div += `M${cx + .5} ${ky + 1}V${ky + bh + wh - 15}` })
  s += cs + P(div, { stroke: INK, sa: .16 }) + R(kx + .5, ky + .5, whites.length * kw - 1, bh + wh - 15, { rx: 2, stroke: INK, sa: .26 })
  /* the black keys: dark, sitting over the seams */
  for (const [letter, st, after] of blacks) { const cx = kx + (after + 1) * kw - bw / 2, on = ND.held.has(base + st); s += R(cx, ky, bw, bh, { fill: on ? INK : K0 }) + R(cx + .5, ky + .5, bw - 1, bh - 1, { stroke: INK, sa: .3 }) + T(cx + bw / 2, ky + bh - 9, letter, { size: 9.5, c: on ? K1 : INK, a: on ? 1 : .7, anchor: 'middle' }) }
  /* at the side: where it starts and how hard it plays, with the keys that move them; the pedal */
  const sx = kx + whites.length * kw + 22
  const pair = (yy, name, val, k1, k2) => T(sx, yy + 12.6, name, { size: 9.5, a: .4 }) + T(sx + 50, yy + 12.6, val, { size: 9.5, a: .9 }) + cells(sx + 78, yy, 18, [{ t: k1 }, { t: k2 }], { size: 9.5, widths: [20, 20] })[0]
  s += pair(ky - 2, 'from', keyName(base), 'z', 'x') + pair(ky + 22, 'hard', String(TYPE.vel), 'c', 'v')
  s += T(sx, ky + 58.6, 'pedal', { size: 9.5, a: .4 }) + key(sx + 78, ky + 46, 'tab', { armed: TYPE.ped })[0]
  return s
}
