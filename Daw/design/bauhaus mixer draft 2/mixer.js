/* ── bauhaus, the mixer, draft 2: every track in sight (his ask, 2026-10-21: with many tracks, finding one should not
   take scrolling) ──
   Laid into the room by shots.mjs only (the room's own files are not changed until he says so).
   As draft 1, a strip a column of a poster; but the strips share the width, so that every track is in sight. The chosen
   tracks (chosen anywhere: in the lanes, the heads or here) stand open, as draft 1 has them; the others close to their
   number, their name turned up the strip, the bar of their colour and the red disc of their level, and mute and solo as
   a square and a circle. Pressed, a closed strip opens (it is chosen). Only past what the width can hold, the strips
   scroll, and a row of the numbers over them goes to any one. */
const BMX = { v: new Map() }
const BMX_WIDE = 148, BMX_MIN = 15
function bhMixer (y, h) {
  const vis = rows(), mw = 150, gutter = 14, room = RX - mw - gutter * 2
  const open = vis.filter(i => isChosen(i)), nOpen = Math.min(open.length, Math.floor(room / BMX_WIDE))
  let wide = BMX_WIDE, slim = 0, list = vis, over = false
  if (vis.length * 104 <= room) { wide = clamp(Math.floor(room / vis.length), 104, BMX_WIDE); slim = wide }      // (all of them open, as draft 1)
  else {
    slim = Math.floor((room - nOpen * BMX_WIDE) / Math.max(1, vis.length - nOpen))
    if (slim < BMX_MIN) { over = true; slim = BMX_MIN; const fitN = nOpen + Math.floor((room - nOpen * BMX_WIDE) / BMX_MIN); S.panel.mx = clamp(S.panel.mx, 0, Math.max(0, vis.length - fitN)); list = vis.slice(S.panel.mx, S.panel.mx + fitN) }
    slim = Math.min(slim, 100)
  }
  const top = y + (over ? 26 : 10), foot = y + h - 10, lt = top + 98, lb = foot - 40, lh = Math.max(40, lb - lt)
  const yOf = db => lb - lh * volF(db)
  let s = R(0, y, RX, h, { fill: K1 })
  const lab = (x, yy, t, o = {}) => `<text x="${n(x)}" y="${n(yy)}" font-family="${FONT}" font-size="${n((o.size || 5.6) * TF.scale)}" font-weight="600" letter-spacing="1.3"${o.anchor ? ` text-anchor="${o.anchor}"` : ''} fill="${o.c || BH.black}"${o.a != null ? ` fill-opacity="${o.a}"` : ''}>${esc(String(t).toUpperCase())}</text>`
  /* past the width: a row of the numbers, each going to its track */
  if (over) {
    const cw = Math.min(22, (RX - 2 * gutter) / vis.length)
    vis.forEach((i, k) => { const t = S.tracks[i], x = gutter + k * cw, inView = list.includes(i); s += T(x + cw / 2, y + 16, String(i + 1), { size: 8, w: 700, c: bhInk(bhCol(t)), a: inView ? 1 : .45, anchor: 'middle' }) + hit(x, y + 4, cw, 16, 'msel', ` data-i="${i}"`) })
  }
  let x = gutter
  for (const i of list) {
    const t = S.tracks[i], di = ` data-i="${i}"`, sel = isChosen(i), c = bhCol(t), ink = bhInk(c), vol = shown(t, 'vol'), pan = shown(t, 'pan') || 0, sw = sel || slim >= 104 ? wide : slim, isOpen = sw >= 104
    const num = pad2(i + 1)
    BMX.v.set(t.id, [lt, lh])
    if (isOpen) {
      /* open: as draft 1 */
      const nw = tw(num, 26, 700)
      if (sel) s += R(x - 4, top - 2, nw + 8, 30, { fill: BH.black })
      s += T(x, top + 23, num, { size: 26, w: 700, c: sel ? BH.paper : ink }) + T(x + nw + 8, top + 22, fit(asGiven(t.name), sw - nw - 44, 12, 600), { size: 12, w: 600, a: heard(t) ? 1 : .5 }) + hit(x - 4, top - 2, sw - 30, 32, 'msel', di)
      const pcx = x + sw - 26, pcy = top + 14, a = pan * 2.4
      s += Cc(pcx, pcy, 9, { stroke: BH.black, sw: 1.3 }) + P(`M${n(pcx)} ${n(pcy)}L${n(pcx + 9 * Math.sin(a))} ${n(pcy - 9 * Math.cos(a))}`, { stroke: BH.black, sw: 1.6 }) + hit(pcx - 16, pcy - 13, 32, 26, 'mpan', `${di} data-x="${n(pcx - 30)}" data-pw="60"`, 'ew-resize')
      const its = fxItems(t), show = its.slice(0, 3)
      show.forEach((it, j) => { const yy = top + 46 + j * 13; s += R(x, yy - 7, 7, 7, { fill: it.c || BH.black, fa: it.off ? .35 : 1 }) + T(x + 11, yy, fit(asGiven(it.t), sw - 40, 9), { size: 9, a: it.off ? .45 : .9 }) + hit(x - 2, yy - 10, sw - 30, 13, 'mfx', `${di} data-k="${j}"`) })
      if (its.length > 3) s += T(x + 11, top + 46 + 3 * 13, `+${its.length - 3} more`, { size: 8, a: .5 }) + hit(x - 2, top + 46 + 3 * 13 - 10, sw - 30, 13, 'm-patch', di)
      if (!t.theirs) { const ay = top + 46 + Math.min(its.length, 3) * 13 + (its.length > 3 ? 13 : 0); s += Cc(x + 3.5, ay - 3.5, 4.5, { fill: BH.red }) + P(`M${n(x + 3.5)} ${n(ay - 6.5)}v6M${n(x + .5)} ${n(ay - 3.5)}h6`, { stroke: BH.paper, sw: 1.2 }) + hit(x - 3, ay - 10, 14, 13, 'mfxadd', di) }
      const bw = 16, rx0 = x + bw + 16, fy = yOf(vol)
      s += R(x, lt, bw, lh, { fill: BH.black, fa: .05 }) + R(x, lb, bw, 0, { fill: c, x: ` id="bmx-${t.id}"` })
      for (const db of [6, 0, -6, -12, -24]) s += R(rx0 - 5, yOf(db) - .4, 3, .8, { fill: BH.black, fa: .4 })
      s += R(rx0 - .9, lt, 1.8, lh, { fill: BH.black }) + Cc(rx0, fy, 7, { fill: BH.red, fa: heard(t) ? 1 : .5 }) + T(rx0 + 12, fy + 4, fmtDb(vol), { size: 11, w: 700 })
      s += hit(x - 2, lt - 8, sw - 30, lh + 16, 'mvol', `${di} data-w="0"`, 'ns-resize')
      let cx = x
      for (const it of cellsOf(t)) { s += bhShape(it.t, cx, foot - 26, 9, it.on, it.t === 's' ? BH.blue : BH.black) + hit(cx - 3, foot - 30, 15, 17, it.a, di); cx += 17 }
      s += T(x, foot - 2, '→ ' + fit(asGiven(outName(t)), sw - 46, 8.5), { size: 8.5, a: .6 }) + hit(x - 2, foot - 12, sw - 30, 13, 'mout', di)
    } else {
      /* closed: its number, its name turned up the strip, its bar and its red disc, mute and solo */
      const cxm = x + (sw - 6) / 2, nz = sw >= 30 ? 15 : 10, fy = yOf(vol)
      s += T(cxm, top + 18, sw >= 30 ? num : String(i + 1), { size: nz, w: 700, c: ink, anchor: 'middle' })
      const nameRoom = lt - top - 34
      s += `<text x="${n(cxm + 3.5)}" y="${n(lt - 10)}" transform="rotate(-90 ${n(cxm + 3.5)} ${n(lt - 10)})" font-family="${FONT}" font-size="${n(9.5 * TF.scale)}" font-weight="500" fill="${BH.black}"${heard(t) ? '' : ' fill-opacity=".5"'}>${esc(fit(asGiven(t.name), nameRoom, 9.5))}</text>`
      s += hit(x, top - 2, sw - 4, lt - top, 'msel', di)
      const bw = Math.max(5, Math.min(12, sw * .3)), bx0 = cxm - bw - 1, rx0 = cxm + 4
      s += R(bx0, lt, bw, lh, { fill: BH.black, fa: .05 }) + R(bx0, lb, bw, 0, { fill: c, x: ` id="bmx-${t.id}"` })
      s += R(rx0 - .6, lt, 1.2, lh, { fill: BH.black }) + Cc(rx0, fy, sw >= 30 ? 5 : 4, { fill: BH.red, fa: heard(t) ? 1 : .5 })
      s += hit(x, lt - 6, sw - 4, lh + 12, 'mvol', `${di} data-w="0"`, 'ns-resize')
      const ms = cellsOf(t).filter(it => it.t === 'm' || it.t === 's')
      ms.forEach((it, k) => { const yy = foot - 30 + k * 13; s += bhShape(it.t, cxm - 3.5, yy, 7, it.on, it.t === 's' ? BH.blue : BH.black) + hit(x, yy - 3, sw - 4, 13, it.a, di) })
    }
    x += sw
  }
  /* the out */
  const ox = RX - mw - gutter + 18, fy = yOf(S.master)
  BMX.v.set('M', [lt, lh])
  s += T(ox, top + 23, 'out', { size: 26, w: 700, c: BH.blue }) + lab(ox + 52, top + 21, 'stereo') + hit(ox - 4, top - 2, mw - 20, 32, 'wall-out')
  s += R(ox, lt, 12, lh, { fill: BH.black, fa: .05 }) + R(ox, lb, 12, 0, { fill: BH.blue, x: ' id="bmx-ML"' }) + R(ox + 15, lt, 12, lh, { fill: BH.black, fa: .05 }) + R(ox + 15, lb, 12, 0, { fill: BH.blue, x: ' id="bmx-MR"' })
  const mr = ox + 50
  for (const db of [6, 0, -6, -12, -24]) s += R(mr - 5, yOf(db) - .4, 3, .8, { fill: BH.black, fa: .4 }) + lab(mr - 9, yOf(db) + 2, db > 0 ? '+' + db : db, { anchor: 'end', size: 5 })
  s += R(mr - .9, lt, 1.8, lh, { fill: BH.black }) + Cc(mr, fy, 9, { fill: BH.black }) + T(mr + 16, fy + 6, fmtDb(S.master), { size: 18, w: 700 })
  s += hit(ox - 2, lt - 8, mw - 20, lh + 16, 'mmaster', '', 'ns-resize')
  return s
}
SKINS.mixer.poster = bhMixer
window.BMX = BMX                                                                     // (for the pictures: shots.mjs sets the bars by hand)
