/* ── bauhaus, the mixer, draft 1 (his ask, 2026-10-21: "믹서 창도 한 번 너맘대로 디자인 해볼래?") ──
   Laid into the room by shots.mjs only (the room's own files are not changed until he says so).
   A strip is a column of a poster, no rules between them. Its number large in its colour and its name at the head, its
   pan a ring with a needle beside them; what is on its patch as small squares of colour with their names, a red disc to
   put one on; then the level, the largest part: a bar of the track's colour as high as it sounds, a black rule beside
   it and on the rule a red disc where its level is, the level's figure riding beside the disc; at its foot its buttons
   as shapes (a triangle to record, a diamond to hear the input, a square to mute, a circle to solo) and where it goes.
   The chosen strip has its number on a black block. The out at the right: a blue bar for each side, a black disc on the
   rule, its figure large. */
const BMX = { geo: null, v: new Map() }
function bhMixer (y, h) {
  const vis = rows(), mw = 150, gutter = 14, room = RX - mw - gutter * 2, sw = clamp(Math.floor(room / Math.max(1, vis.length)), 104, 148), fitN = Math.max(1, Math.floor(room / sw))
  S.panel.mx = clamp(S.panel.mx, 0, Math.max(0, vis.length - fitN))
  const shownT = vis.slice(S.panel.mx, S.panel.mx + fitN)
  const top = y + 10, foot = y + h - 10, lt = top + 98, lb = foot - 40, lh = Math.max(40, lb - lt)        // (lt..lb: the level's rule)
  const yOf = db => lb - lh * volF(db)
  BMX.geo = { lt, lh }
  let s = R(0, y, RX, h, { fill: K1 })
  const lab = (x, yy, t, o = {}) => `<text x="${n(x)}" y="${n(yy)}" font-family="${FONT}" font-size="${n((o.size || 5.6) * TF.scale)}" font-weight="600" letter-spacing="1.3"${o.anchor ? ` text-anchor="${o.anchor}"` : ''} fill="${o.c || BH.black}"${o.a != null ? ` fill-opacity="${o.a}"` : ''}>${esc(String(t).toUpperCase())}</text>`
  shownT.forEach((i, k) => {
    const t = S.tracks[i], x = gutter + k * sw, di = ` data-i="${i}"`, sel = isChosen(i), c = bhCol(t), ink = bhInk(c), vol = shown(t, 'vol'), pan = shown(t, 'pan') || 0
    /* its number and name; the chosen one's number on a black block */
    const num = pad2(i + 1), nw = tw(num, 26, 700)
    if (sel) s += R(x - 4, top - 2, nw + 8, 30, { fill: BH.black })
    s += T(x, top + 23, num, { size: 26, w: 700, c: sel ? BH.paper : ink }) + T(x + nw + 8, top + 22, fit(asGiven(t.name), sw - nw - 44, 12, 600), { size: 12, w: 600, a: heard(t) ? 1 : .5 }) + hit(x - 4, top - 2, sw - 30, 32, 'msel', di)
    /* its pan: a ring with a needle */
    const pcx = x + sw - 26, pcy = top + 14, a = pan * 2.4
    s += Cc(pcx, pcy, 9, { stroke: BH.black, sw: 1.3 }) + P(`M${n(pcx)} ${n(pcy)}L${n(pcx + 9 * Math.sin(a))} ${n(pcy - 9 * Math.cos(a))}`, { stroke: BH.black, sw: 1.6 }) + hit(pcx - 16, pcy - 13, 32, 26, 'mpan', `${di} data-x="${n(pcx - 30)}" data-pw="60"`, 'ew-resize')
    /* what is on its patch: squares of colour and their names; a red disc to put one on */
    const its = fxItems(t), show = its.slice(0, 3)
    show.forEach((it, j) => { const yy = top + 46 + j * 13; s += R(x, yy - 7, 7, 7, { fill: it.c || BH.black, fa: it.off ? .35 : 1 }) + T(x + 11, yy, fit(asGiven(it.t), sw - 40, 9), { size: 9, a: it.off ? .45 : .9 }) + hit(x - 2, yy - 10, sw - 30, 13, 'mfx', `${di} data-k="${j}"`) })
    if (its.length > 3) s += T(x + 11, top + 46 + 3 * 13, `+${its.length - 3} more`, { size: 8, a: .5 }) + hit(x - 2, top + 46 + 3 * 13 - 10, sw - 30, 13, 'm-patch', di)
    if (!t.theirs) { const ay = top + 46 + Math.min(its.length, 3) * 13 + (its.length > 3 ? 13 : 0); s += Cc(x + 3.5, ay - 3.5, 4.5, { fill: BH.red }) + P(`M${n(x + 3.5)} ${n(ay - 6.5)}v6M${n(x + .5)} ${n(ay - 3.5)}h6`, { stroke: BH.paper, sw: 1.2 }) + hit(x - 3, ay - 10, 14, 13, 'mfxadd', di) }
    /* the level: a bar of its colour as high as it sounds, a black rule, a red disc on it, its figure beside */
    const bx0 = x, bw = 16, rx0 = x + bw + 16, fy = yOf(vol)
    BMX.v.set(t.id, [lt, lh])
    s += R(bx0, lt, bw, lh, { fill: BH.black, fa: .05 }) + R(bx0, lb, bw, 0, { fill: c, x: ` id="bmx-${t.id}"` })
    for (const db of [6, 0, -6, -12, -24]) s += R(rx0 - 5, yOf(db) - .4, 3, .8, { fill: BH.black, fa: .4 })
    s += R(rx0 - .9, lt, 1.8, lh, { fill: BH.black }) + Cc(rx0, fy, 7, { fill: BH.red, fa: heard(t) ? 1 : .5 }) + T(rx0 + 12, fy + 4, fmtDb(vol), { size: 11, w: 700 })
    s += hit(bx0 - 2, lt - 8, sw - 30, lh + 16, 'mvol', `${di} data-w="0"`, 'ns-resize')
    /* its buttons as shapes, and where it goes */
    let cx = x
    for (const it of cellsOf(t)) { s += bhShape(it.t, cx, foot - 26, 9, it.on, it.t === 's' ? BH.blue : BH.black) + hit(cx - 3, foot - 30, 15, 17, it.a, di); cx += 17 }
    s += T(x, foot - 2, '→ ' + fit(asGiven(outName(t)), sw - 46, 8.5), { size: 8.5, a: .6 }) + hit(x - 2, foot - 12, sw - 30, 13, 'mout', di)
  })
  if (fitN < vis.length) s += T(gutter, foot + 8, `${S.panel.mx + 1}–${S.panel.mx + shownT.length} of ${vis.length}`, { size: 8, a: .5 })
  /* the out: a blue bar for each side, a black rule, a black disc on it, its figure large */
  const ox = RX - mw - gutter + 18, fy = yOf(S.master)
  BMX.v.set('M', [lt, lh])
  s += T(ox, top + 23, 'out', { size: 26, w: 700, c: BH.blue }) + lab(ox + 52, top + 21, 'stereo') + hit(ox - 4, top - 2, mw - 20, 32, 'wall-out')
  s += R(ox, lt, 12, lh, { fill: BH.black, fa: .05 }) + R(ox, lb, 12, 0, { fill: BH.blue, x: ' id="bmx-M"' }) + R(ox + 15, lt, 12, lh, { fill: BH.black, fa: .05 })
  const mr = ox + 50
  for (const db of [6, 0, -6, -12, -24]) s += R(mr - 5, yOf(db) - .4, 3, .8, { fill: BH.black, fa: .4 }) + lab(mr - 9, yOf(db) + 2, db > 0 ? '+' + db : db, { anchor: 'end', size: 5 })
  s += R(mr - .9, lt, 1.8, lh, { fill: BH.black }) + Cc(mr, fy, 9, { fill: BH.black }) + T(mr + 16, fy + 6, fmtDb(S.master), { size: 18, w: 700 })
  s += hit(ox - 2, lt - 8, mw - 20, lh + 16, 'mmaster', '', 'ns-resize')
  return s
}
SKINS.mixer.poster = bhMixer
window.BMX = BMX                                                                     // (for the pictures: shots.mjs sets the bars by hand)
