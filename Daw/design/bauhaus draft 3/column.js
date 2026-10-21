/* ── bauhaus, draft 3: the chosen track's strip in the column (his word, 2026-10-22: "왼쪽 기둥 안 … tool / mode / grid /
   nudge / automation / rubato / zoom across / zoom down 이거를 밑으로 내리고, 마스터 밑에다가 만들면 돼. default 테마의
   트랜스포트 패널을 참고하도록") ──
   Laid into the room by shots.mjs only. The column as draft 2 has it, drawn a little closer, and under the out the strip of
   the track chosen, as the transport panel has it: its number on a black block and its name, its pan a ring; two bars of
   its colour as loud as each side, the black rule and the red disc of its level, its level large; where it comes in; its
   plug-ins and a red disc to put one on; its sends as knobs with the bus under each (how much, with the pointer on it).
   Under it the tracks and the smallest things. A window too short has the column smaller. */
SKINS.left.poster = () => {
  const CW = SKIN_BANDS.poster[2], p = curPos(), [bar, rest] = bhSplit(p), o = -CW, k = Math.min(1, H / 940)
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
  s += T(24, 430, c.on ? `cycle ${Math.round(c.a + 1)} to ${Math.round(c.b)}` : 'cycle off', { size: 9, a: c.on ? .9 : .5 }) + hit(20, 420, 90, 14, 'loop')
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
        s += `<g class="bmk${turning ? ' on' : ''}">` + Cc(kx, ky, kr, { fill: BH.paper, stroke: BH.black, sw: 1.2 }) + (f > .004 ? P(`M${on(kr + 2.4, a0)}A${kr + 2.4} ${kr + 2.4} 0 ${f > 2 / 3 ? 1 : 0} 1 ${on(kr + 2.4, a1)}`, { stroke: BH.red, sw: 2.2 }) : '') + P(`M${n(kx)} ${n(ky)}L${on(kr - 1, a1)}`, { stroke: BH.black, sw: 1.5 })
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
  const zf = clamp(Math.log(PXB / fitPXB()) / Math.log(640 / fitPXB()), 0, 1), rf = clamp(((S.rh || 25) - 20) / 100, 0, 1), zw = 84
  const zoom = (x, y, f, a, word) => bhLab(x + zw / 2, y - 7, word, { anchor: 'middle' }) + R(x, y, zw, 1.4, { fill: BH.black }) + Cc(x + zw * f, y + .7, 3.4, { fill: BH.red }) + hit(x - 5, y - 9, zw + 10, 16, a, ` data-x0="${n(o + x * k)}" data-w="${n(zw * k)}"`, 'ew-resize')
  s += zoom(14, 922, zf, 'zoomx', 'zoom across') + zoom(111, 922, rf, 'zoomy', 'zoom down')
  const ground = R(0, 0, CW, H, { fill: K1 }) + R(CW - 3, 0, 3, H, { fill: BH.black })
  return G(ground + G(G(s, k < 1 ? `scale(${n(k)})` : ''), '', ' id="bh-col"'), `translate(${o} 0)`)
}
