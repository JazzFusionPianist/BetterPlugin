/* ── theme: bauhaus — a poster of primary colours, at the room's own size ──
   Draft 2: the composition kept, its parts at the room's density; Jost (a geometric sans of the Futura kind) in a few
   weights; thin black rules carry the grid; the mixer docked under the tracks as a row of bars and discs. */
const BH = { paper: '#F1ECDF', black: '#151412', red: '#D52B1E', blue: '#1D4E9E', yellow: '#F2C230', grey: '#BDB6A6' }
const bhF = "'Jost', sans-serif"
const bhCol = t => ({ kick: BH.red, snare: BH.red, hats: BH.yellow, bass: BH.blue, keys: BH.yellow, guitar: BH.black, hum: BH.red, air: BH.blue, plate: BH.grey })[t.name] || BH.black
const bhT = (x, y, s, o = {}) => tx(x, y, s, Object.assign({ f: bhF, z: 11, w: 500, c: BH.black }, o))

THEMES.bauhaus = () => {
  const song = tdSong(), T = song.tracks, head = song.head
  let s = rc(0, 0, TW, TH, { fill: BH.paper })
  const CW = 196
  s += bhT(20, 40, 'slur', { z: 28, w: 700, ls: -.6 }) + bhT(22, 52, 'STUDIO', { z: 7, w: 600, ls: 4 }) + rc(CW - 3, 0, 3, TH, { fill: BH.black })
  s += bhT(18, 132, '20', { z: 64, w: 700, ls: -2.5 }) + bhT(96, 132, '.1.1', { z: 22, w: 600, c: BH.red }) + bhT(20, 152, '0:49.5', { z: 14, w: 500, ls: .5 })
  s += ci(42, 200, 22, { fill: BH.red }) + pa('M35 189L35 211L53 200Z', { fill: BH.paper }) + rc(78, 184, 32, 32, { fill: BH.black }) + rc(88, 194, 12, 12, { fill: BH.paper }) + ci(143, 200, 13, { stroke: BH.red, sw: 4.5 })
  s += rc(18, 238, 2.5, 16, { fill: BH.black }) + pa('M33 238L33 254L21 246Z', { fill: BH.black }) + bhT(40, 250, 'to the start', { z: 10 })
  s += ci(42, 296, 22, { fill: BH.yellow }) + bhT(42, 301, '92', { z: 17, w: 700, anchor: 'middle' }) + bhT(42, 312, 'BPM', { z: 5.5, w: 600, anchor: 'middle', ls: 1.6 })
  s += rc(78, 280, 32, 32, { fill: BH.blue }) + bhT(94, 300, '4/4', { z: 11, w: 600, c: BH.paper, anchor: 'middle' })
  s += pa('M124 312L139 282L154 312Z', { fill: BH.yellow })
  s += bhT(20, 344, 'cycle', { z: 10, w: 600 }) + bhT(60, 344, 'bars 17 to 24', { z: 10, a: .6 }) + ci(24, 362, 4.5, { stroke: BH.black, sw: 1.4 }) + bhT(36, 366, 'click off', { z: 10, a: .6 })
  /* the master: a disc filled as loud as the mix */
  const mxc = 98, myc = 540
  s += ln(8, 430, 188, 640, BH.black, 2) + ci(mxc, myc, 66, { fill: BH.blue }) + pa(`M${mxc} ${myc}L${mxc} ${myc - 66}A66 66 0 1 1 ${nn(mxc - 66 * Math.sin(.42 * 2 * Math.PI))} ${nn(myc - 66 * Math.cos(.42 * 2 * Math.PI))}Z`, { fill: BH.black })
  s += ci(mxc, myc, 38, { fill: BH.paper }) + bhT(mxc, myc + 4, '−4.2', { z: 17, w: 700, anchor: 'middle' }) + bhT(mxc, myc + 16, 'OUT', { z: 6, w: 600, anchor: 'middle', ls: 2.4 }) + ci(168, 452, 10, { fill: BH.red })
  /* markers over a rule */
  const HL = CW, L = HL + 150, R = TW - 14, top = 22, ruleY = 54, laneTop = 64, rh = 56
  tdMap(L, R, 1, song.end + 1)
  song.scenes.forEach((sc, i) => {
    const x = bx(sc.a), col = [BH.red, BH.blue, BH.yellow][i % 3], sh = i % 3
    s += sh === 0 ? ci(x + 5, top + 12, 4.5, { fill: col }) : sh === 1 ? rc(x + .5, top + 7.5, 9, 9, { fill: col }) : pa(`M${x} ${top + 17}L${x + 5} ${top + 7.5}L${x + 10} ${top + 17}Z`, { fill: col })
    s += bhT(x + 14, top + 16.5, sc.name, { z: 13, w: 600 })
  })
  s += rc(HL, ruleY - 2, R - HL, 4, { fill: BH.black })
  const c0 = bx(song.cycle.a + 1), c1 = bx(song.cycle.b + 1)
  s += rc(c0, ruleY - 2, c1 - c0, 4, { fill: BH.yellow })
  for (let b = 1; b <= song.end; b += 4) s += bhT(bx(b) + 2.5, ruleY - 6, String(b), { z: 7.5, w: 600 })
  const foot = laneTop + rh * T.length
  for (let b = 1; b <= song.end; b++) { const x = bx(b); s += (b - 1) % 4 ? ln(x, laneTop, x, foot, BH.black, .5, .1) : rc(x - .6, laneTop, 1.2, foot - laneTop, { fill: BH.black, fa: .6 }) }
  T.forEach((t, i) => {
    const y = laneTop + i * rh, col = bhCol(t), mid = y + rh / 2
    s += bhT(HL + 12, mid + 8, String(i + 1).padStart(2, '0'), { z: 22, w: 700, c: col === BH.yellow ? BH.black : col, ls: -.6 })
    s += bhT(HL + 52, mid - 3, t.name, { z: 12, w: 500 })
    const sz = 7.5, bxx = HL + 53, byy = mid + 5
    s += rc(bxx, byy, sz, sz, t.mute ? { fill: BH.black } : { stroke: BH.black, sw: 1.1 }) + ci(bxx + 17, byy + sz / 2, sz / 2, t.solo ? { fill: BH.blue } : { stroke: BH.black, sw: 1.1 }) + pa(`M${bxx + 28} ${byy + sz}L${bxx + 32} ${byy}L${bxx + 36} ${byy + sz}Z`, i === 4 ? { fill: BH.red } : { stroke: BH.black, sw: 1.1, join: 'round' })
    const lv = Math.max(0, Math.min(1, ((t.vol || 0) + 24) / 30)), lx = HL + 98, lw = 38
    s += rc(lx, byy + 3, lw, 1.6, { fill: BH.black }) + ci(lx + lw * lv, byy + 3.8, 3.6, { fill: BH.red })
    s += ln(HL, y + rh, R, y + rh, BH.black, .6, .16)
    for (const g of tdRegs(t, L, R)) {
      s += rc(g.xa + .6, y + 4, g.w - 1.2, rh - 8, { fill: col })
      const cut = col === BH.yellow ? BH.black : BH.paper
      if (tdIsNotes(t, g.r)) { const { d, tr } = tdNotes(g, y + 7, rh - 14); s += gr(pa(d, { stroke: cut, sw: 2, sa: .95 }), tr) }
      else s += pa(tdWave(g, mid, rh / 2 - 8), { fill: cut, fa: .95 })
    }
  })
  const px = bx(head + 1)
  s += rc(px - 1.2, ruleY + 2, 2.4, foot - ruleY - 2, { fill: BH.red }) + ci(px, ruleY, 6, { fill: BH.red })
  /* the mixer, docked: each strip a bar of its colour as high as it is loud, a red dot where its level is, a ring for pan */
  const py0 = foot + 26, ST = T.concat([{ name: 'plate', vol: 0, regs: [], bus: true }]), sw2 = (TW - HL - 14) / ST.length
  s += rc(HL, py0 - 10, TW - HL, 3, { fill: BH.black })
  ;['patch', 'mixer', 'notes', 'prompt', 'rubato'].forEach((t2, k) => { const x = HL + 14 + k * 64; if (t2 === 'mixer') s += rc(x - 6, py0 + 2, 58, 18, { fill: BH.black }); s += bhT(x, py0 + 15, t2, { z: 11, w: t2 === 'mixer' ? 600 : 500, c: t2 === 'mixer' ? BH.paper : BH.black }) })
  ST.forEach((t, i) => {
    const x = HL + i * sw2 + 14, y0 = py0 + 38, h = 210, col = bhCol(t), lv = t.bus ? .5 : Math.max(.05, (tdLevel(t, head) + 30) / 34)
    s += bhT(x, y0, t.name, { z: 11, w: 600 })
    s += rc(x, y0 + 12 + h * (1 - lv), 18, h * lv, { fill: col }) + rc(x, y0 + 12, 18, h, { stroke: BH.black, sw: .8 })
    const vl = Math.max(0, Math.min(1, ((t.vol || 0) + 30) / 36)), fx = x + 40
    s += rc(fx - .8, y0 + 12, 1.6, h, { fill: BH.black }) + ci(fx, y0 + 12 + h * (1 - vl), 6, { fill: BH.red }) + bhT(fx + 12, y0 + 16 + h * (1 - vl), ((t.vol || 0) > 0 ? '+' : '') + (t.vol || 0).toFixed(1), { z: 9, w: 500 })
    const pa0 = (t.pan || 0) * 2.4
    s += ci(x + 92, y0 + 26, 10, { stroke: BH.black, sw: 1.2 }) + ln(x + 92, y0 + 26, x + 92 + 10 * Math.sin(pa0), y0 + 26 - 10 * Math.cos(pa0), BH.black, 1.4)
    s += rc(x + 84, y0 + 52, 7, 7, i === 2 ? { fill: BH.black } : { stroke: BH.black, sw: 1 }) + ci(x + 100, y0 + 55.5, 3.5, { stroke: BH.black, sw: 1 })
  })
  s += rc(HL, TH - 26, TW - HL, 26, { fill: BH.black })
  let fx = HL + 16
  for (const [k, v] of [['TOOL', 'pointer'], ['MODE', 'smart'], ['GRID', '1/4'], ['NUDGE', 'beat'], ['REGION', 'keys'], ['GAIN', '0.0']]) { s += bhT(fx, TH - 9.5, k, { z: 7, w: 600, c: BH.yellow, ls: 1.6 }); s += bhT(fx + tw2(k, bhF, 7, 600) + 9, TH - 9, v, { z: 11, c: BH.paper }); fx += 136 }
  return s
}
