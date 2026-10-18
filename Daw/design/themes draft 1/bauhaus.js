/* ── theme: bauhaus — a poster of primary colours ──
   Red, blue, yellow and black on paper, set in a geometric sans. The transport is a composition at the left: play is a
   red circle, stop a black square, record a ring; the place in the song is set huge; the tempo sits in a yellow disc.
   Tracks are numbered large; mute is a square, solo a circle, record a triangle; a track's level is a bar with a dot.
   Regions are flat fields of colour with the sound cut out of them. The markers are words over a heavy rule. */
const BH = { paper: '#F1ECDF', black: '#151412', red: '#D52B1E', blue: '#1D4E9E', yellow: '#F2C230', grey: '#BDB6A6' }
const bhF = "'Jost', sans-serif"
const bhCol = t => ({ kick: BH.red, snare: BH.red, hats: BH.yellow, bass: BH.blue, keys: BH.yellow, guitar: BH.black, hum: BH.red, air: BH.blue })[t.name] || BH.black

THEMES.bauhaus = () => {
  const song = tdSong(), T = song.tracks, head = song.head
  let s = rc(0, 0, TW, TH, { fill: BH.paper })
  /* the left: the transport as a composition */
  const CW = 300
  s += rc(0, 0, CW, TH, { fill: BH.paper })
  s += tx(28, 64, 'slur', { f: bhF, z: 46, w: 800, c: BH.black, ls: -1 }) + tx(30, 84, 'STUDIO', { f: bhF, z: 11, w: 600, c: BH.black, ls: 6 })
  s += rc(CW - 6, 0, 6, TH, { fill: BH.black })
  s += tx(26, 196, '20', { f: bhF, z: 120, w: 800, c: BH.black, ls: -4 }) + tx(168, 196, '.1.1', { f: bhF, z: 38, w: 700, c: BH.red })
  s += tx(30, 232, '0:49.5', { f: bhF, z: 26, w: 500, c: BH.black, ls: 1 })
  s += ci(64, 312, 46, { fill: BH.red }) + pa('M52 290L52 334L88 312Z', { fill: BH.paper })
  s += rc(126, 280, 62, 62, { fill: BH.black }) + rc(146, 300, 22, 22, { fill: BH.paper })
  s += ci(232, 311, 28, { stroke: BH.red, sw: 9 })
  s += pa('M46 384L46 418L20 401Z', { fill: BH.black }) + rc(14, 384, 5, 34, { fill: BH.black }) + tx(56, 408, 'to the start', { f: bhF, z: 13, w: 500, c: BH.black })
  s += ci(206, 398, 36, { fill: BH.yellow }) + tx(206, 404, '92', { f: bhF, z: 30, w: 800, c: BH.black, anchor: 'middle' }) + tx(206, 422, 'BPM', { f: bhF, z: 8, w: 700, c: BH.black, anchor: 'middle', ls: 2 })
  s += rc(26, 448, 54, 54, { fill: BH.blue }) + tx(53, 483, '4/4', { f: bhF, z: 19, w: 700, c: BH.paper, anchor: 'middle' })
  s += pa('M100 502L130 448L160 502Z', { fill: BH.yellow }) + tx(170, 470, 'cycle', { f: bhF, z: 13, w: 700, c: BH.black }) + tx(170, 488, 'bars 17 to 24', { f: bhF, z: 11, w: 500, c: BH.black, a: .6 })
  s += ci(118, 540, 14, { stroke: BH.black, sw: 2.5 }) + tx(140, 545, 'click off', { f: bhF, z: 13, w: 500, c: BH.black, a: .6 })
  /* the master: a disc, filled as loud as the mix is */
  const mxc = 150, myc = 720
  s += ln(10, 590, 290, 880, BH.black, 3)
  s += ci(mxc, myc, 104, { fill: BH.blue }) + pa(`M${mxc} ${myc}L${mxc} ${myc - 104}A104 104 0 1 1 ${nn(mxc - 104 * Math.sin(.42 * 2 * Math.PI))} ${nn(myc - 104 * Math.cos(.42 * 2 * Math.PI))}Z`, { fill: BH.black })
  s += ci(mxc, myc, 58, { fill: BH.paper }) + tx(mxc, myc + 6, '−4.2', { f: bhF, z: 30, w: 800, c: BH.black, anchor: 'middle' }) + tx(mxc, myc + 26, 'OUT', { f: bhF, z: 9, w: 700, c: BH.black, anchor: 'middle', ls: 3 })
  s += ci(262, 618, 18, { fill: BH.red })
  /* the markers over a heavy rule */
  const HL = CW, HR = HL + 210, L = HR, R = TW - 22, top = 34, ruleY = 92, laneTop = 108, foot = 856
  tdMap(L, R, 1, song.end + 1)
  const shapes = ['c', 's', 't']
  song.scenes.forEach((sc, i) => {
    const x = bx(sc.a), col = [BH.red, BH.blue, BH.yellow][i % 3], sh = shapes[i % 3]
    s += sh === 'c' ? ci(x + 9, top + 24, 8, { fill: col }) : sh === 's' ? rc(x + 1, top + 16, 16, 16, { fill: col }) : pa(`M${x + 1} ${top + 32}L${x + 9} ${top + 16}L${x + 17} ${top + 32}Z`, { fill: col })
    s += tx(x + 24, top + 31, sc.name, { f: bhF, z: 21, w: 700, c: BH.black, ls: -.3 })
  })
  s += rc(HL, ruleY - 3, R - HL, 8, { fill: BH.black })
  const c0 = bx(song.cycle.a + 1), c1 = bx(song.cycle.b + 1)
  s += rc(c0, ruleY - 3, c1 - c0, 8, { fill: BH.yellow })
  for (let b = 1; b <= song.end; b += 4) s += tx(bx(b) + 4, ruleY - 8, String(b), { f: bhF, z: 11, w: 600, c: BH.black })
  /* tracks */
  const rh = (foot - laneTop) / T.length
  for (let b = 1; b <= song.end; b++) { const x = bx(b); s += (b - 1) % 4 ? ln(x, laneTop, x, foot, BH.black, .6, .12) : rc(x - 1, laneTop, 2, foot - laneTop, { fill: BH.black, fa: .7 }) }
  T.forEach((t, i) => {
    const y = laneTop + i * rh, col = bhCol(t)
    s += tx(HL + 18, y + rh / 2 + 13, String(i + 1).padStart(2, '0'), { f: bhF, z: 36, w: 800, c: col === BH.yellow ? BH.black : col, ls: -1 })
    s += tx(HL + 78, y + rh / 2 - 6, t.name, { f: bhF, z: 18, w: 600, c: BH.black })
    const sz = 11, bxx = HL + 80, byy = y + rh / 2 + 6
    s += rc(bxx, byy, sz, sz, t.mute ? { fill: BH.black } : { stroke: BH.black, sw: 1.6 }) + ci(bxx + 26, byy + sz / 2, sz / 2, t.solo ? { fill: BH.blue } : { stroke: BH.black, sw: 1.6 }) + pa(`M${bxx + 42} ${byy + sz}L${bxx + 48} ${byy}L${bxx + 54} ${byy + sz}Z`, i === 4 ? { fill: BH.red } : { stroke: BH.black, sw: 1.6, join: 'round' })
    const lv = Math.max(0, Math.min(1, ((t.vol || 0) + 24) / 30)), lx = HL + 144, lw = 52
    s += rc(lx, byy + 4, lw, 3, { fill: BH.black }) + ci(lx + lw * lv, byy + 5.5, 6, { fill: BH.red })
    s += ln(HL, y + rh, R, y + rh, BH.black, 1, .18)
    for (const g of tdRegs(t, L, R)) {
      s += rc(g.xa + 1, y + 5, g.w - 2, rh - 10, { fill: col })
      const cut = col === BH.yellow ? BH.black : BH.paper
      if (tdIsNotes(t, g.r)) { const { d, tr } = tdNotes(g, y + 10, rh - 20); s += gr(pa(d, { stroke: cut, sw: 3, sa: .95 }), tr) }
      else s += pa(tdWave(g, y + rh / 2, rh / 2 - 11), { fill: cut, fa: .95 })
    }
  })
  /* the playhead: a red bar with a disc */
  const px = bx(head + 1)
  s += rc(px - 2, ruleY + 5, 4, foot - ruleY - 5, { fill: BH.red }) + ci(px, ruleY + 1, 9, { fill: BH.red })
  /* the foot */
  s += rc(HL, foot + 8, TW - HL, TH - foot - 8, { fill: BH.black })
  const foot2 = [['TOOL', 'pointer'], ['MODE', 'smart'], ['GRID', '1/4'], ['NUDGE', 'beat'], ['REGION', 'keys'], ['GAIN', '0.0']]
  let fx = HL + 24
  for (const [k, v] of foot2) { s += tx(fx, foot + 32, k, { f: bhF, z: 9, w: 700, c: BH.yellow, ls: 2 }); s += tx(fx + tw2(k, bhF, 9, 700) + 14, foot + 33, v, { f: bhF, z: 15, w: 500, c: BH.paper }); fx += 170 }
  return s
}
