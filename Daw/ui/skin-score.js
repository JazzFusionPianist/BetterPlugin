/* ── score: the song as an engraved page (design/themes draft 2, sheet 3) ──
   Over the room, its title and the tempo as a metronome mark, where the playhead is as a bar number; at its foot the
   transport as a line of type (circles for its keys, its words in italic). Each track a staff (the drums one line), its
   name in italic as a full score names its parts, its level as a dynamic; a region a phrase under a slur; the markers
   rehearsal marks; the cycle a pair of repeat barlines; the playhead a red pencil line. */
const SCK = { red: '#B83A22' }
const scInk = () => INK
const scDyn = v => v > -3 ? 'f' : v > -6 ? 'mf' : v > -9 ? 'mp' : v > -15 ? 'p' : 'pp'
/* a quarter note, its head at x, y */
const scNote = (x, y, z = 1) => G(`<ellipse cx="0" cy="0" rx="${n(4 * z)}" ry="${n(2.9 * z)}" fill="${INK}" transform="rotate(-22)"/>` + P(`M${n(3.6 * z)} ${n(-.8 * z)}V${n(-18 * z)}`, { stroke: INK, sw: n(.9 * z) }), `translate(${n(x)} ${n(y)})`)
const scWordsOfMeter = () => S.meter[0] === 4 && S.meter[1] === 4 ? 'four in a bar' : S.meter[0] === 3 && S.meter[1] === 4 ? 'three in a bar' : `${S.meter[0]} in a bar of ${S.meter[1]}`

SKINS.top.score = () => {
  let s = R(0, 0, W, SKIN_BANDS.score[0], { fill: K1 })
  const title = typeof PROJ === 'object' && PROJ.name ? PROJ.name : ''
  s += T(W / 2, 40, asGiven(title), { size: 24, it: true, anchor: 'middle' }) + T(W / 2, 58, 'slur studio', { size: 9.5, w: 500, a: .6, anchor: 'middle' })
  /* the metronome mark: pressed, the tempo is typed */
  s += scNote(30, 46, .62) + T(40, 49, `= ${+(+S.tempo).toFixed(2)}`, { size: 13, w: 500 }) + hit(22, 28, 90, 26, 'tempo')
  SKV.field.tempo = { x: 52, y: 34, w: 60, h: 20 }
  s += T(30, 67, scWordsOfMeter(), { size: 10.5, it: true, a: .65 }) + hit(26, 56, 110, 16, 'meter'); SKV.field.meter = { x: 26, y: 56, w: 110, h: 16 }
  if (S.key) s += T(30 + tw(scWordsOfMeter(), 10.5, 400, true) + 14, 67, `in ${S.key}`, { size: 10.5, it: true, a: .65 })
  s += hit(150, 56, 60, 16, 'key'); SKV.field.key = { x: 150, y: 54, w: 60, h: 20 }
  /* where the playhead is: a bar, and the time */
  const p = curPos()
  s += T(W - 30, 40, `bar ${Math.floor(p + 1e-6) + 1}`, { size: 15, it: true, anchor: 'end', x: ' id="sc-bar"' }) + T(W - 30, 58, scClock(p), { size: 10.5, a: .7, anchor: 'end', x: ' id="sc-time"' }) + hit(W - 130, 24, 104, 40, 'pos')
  SKV.field.pos = { x: W - 130, y: 28, w: 100, h: 20 }
  return s + hline(0, W, SKIN_BANDS.score[0] - .5, .12)
}
const scClock = p => { const sec = p * SPB(), m = Math.floor(sec / 60), ss = Math.floor(sec % 60), t = Math.floor(sec * 10 % 10); return `${m}′ ${String(ss).padStart(2, '0')}″ ${t}` }
SKINS.frame.score = p => {
  const b = $('sc-bar'), t = $('sc-time'), bt = `bar ${Math.floor(p + 1e-6) + 1}`, ct = scClock(p)
  if (b && b.textContent !== bt) b.textContent = bt
  if (t && t.textContent !== ct) t.textContent = ct
}
/* the foot of the page: the transport, a line of type */
SKINS.foot.score = y0 => {
  let s = R(0, y0, W, DECK_H, { fill: K1 }) + hline(24, W - 24, y0 + 6, .25)
  const fy = y0 + 26
  const ctl = [['to the start', 'tostart', '⏮'], ['play', 'play', '▶'], ['stop', 'stop', '■'], ['record', 'rec', '●']]
  let x = Math.round(W / 2 - 1.5 * 60)
  for (const [w2, a, g] of ctl) {
    const on = a === 'play' ? S.playing && !S.rec : a === 'rec' ? !!S.rec : false
    s += Cc(x, fy - 4, 10, on ? { fill: INK } : { stroke: INK, sw: .8 }) + `<text x="${x + (a === 'play' ? 1 : 0)}" y="${fy - .6}" text-anchor="middle" font-size="8.5" fill="${on ? K1 : a === 'rec' ? SCK.red : INK}">${g}</text>` + T(x, fy + 18, w2, { size: 9.5, it: true, a: .7, anchor: 'middle' }) + hit(x - 26, fy - 16, 52, 40, a)
    x += 60
  }
  const word = (xx, t, on, a, col) => { const w0 = tw(t, 11, 400, true); SKV.field[a] = { x: xx - 4, y: fy - 14, w: w0 + 8, h: 22 }; return T(xx, fy, t, { size: 11, it: true, c: col || INK, a: on ? 1 : .45 }) + hit(xx - 4, fy - 14, w0 + 8, 22, a) }
  x += 10
  s += word(x, 'cycle', S.cycle.on, 'loop', S.cycle.on ? SCK.red : INK); x += 50
  s += word(x, 'click', !!S.click, 'click'); x += 46
  s += word(x, 'quick to hear', !!S.lowLat, 'lowlat')
  s += word(30, `grid ${S.grid}`, true, 'grid') + word(30 + tw(`grid ${S.grid}`, 11, 400, true) + 22, `nudge a ${S.nudge}`, true, 'nudge')
  s += T(W - 30, fy, `out ${fmtDb(S.master)}`, { size: 11, it: true, a: .75, anchor: 'end' }) + hit(W - 110, fy - 16, 84, 26, 'master', '', 'ns-resize')
  return s
}

/* ── a track: its name in italic, its level a dynamic, m s and a dot for its record ── */
SKINS.head.score = i => {
  const t = S.tracks[i], rh = rowH(i), y = rowY(i), sel = isChosen(i), mid = y + rh / 2, by = mid + 4
  let s = ''
  if (sel) s += R(0, y, HEAD_W, rh, { fill: lkC('heads.chosen'), fa: lkA('heads.chosen') })
  const nm = fit(asGiven(t.name), 150, 13, 400, true)
  s += T(HEAD_W - 44, by, nm, { size: 13, it: true, a: t.mute ? .4 : 1, anchor: 'end' })
  if (t.theirs && rh >= 30) s += T(HEAD_W - 44, by + 12, `with ${t.theirs}`, { size: 9, it: true, a: .45, anchor: 'end' })
  s += hit(96, y, HEAD_W - 140, rh, 'sel', ` data-i="${i}"`)
  /* m s and the record dot */
  let x = 14
  for (const it of cellsOf(t)) {
    if (it.t === 'i') continue
    if (it.t === 'r') s += it.on ? Cc(x + 3, mid, 3.2, { fill: SCK.red }) : Cc(x + 3, mid, 3, { stroke: INK, sw: .6, sa: .5 })
    else s += (it.on ? Cc(x + 3, mid - 1, 6, { stroke: INK, sw: .8 }) : '') + T(x + 3, mid + 3, it.t, { size: 10, it: true, a: it.on ? 1 : .45, anchor: 'middle' })
    s += hit(x - 4, mid - 9, 14, 18, it.a, ` data-i="${i}"`)
    x += 17
  }
  /* the level, as a dynamic: pulled up or down */
  const v = shown(t, 'vol')
  s += T(84, by, scDyn(v), { size: 14, w: 600, it: true, a: heard(t) ? 1 : .5, anchor: 'end' }) + T(88, by - .5, fmtDb(v), { size: 8.5, a: .45 })
  s += hit(58, y + 1, 56, rh - 2, 'vol', ` data-i="${i}" data-rel="1"`, 'ns-resize')
  return s
}

/* ── the lanes: a staff for each track, barlines through it, a slur over each region ── */
const scDrums = t => t.fam === 'drums' || /kick|snare|hat|drum|perc|tom|clap|cymbal/i.test(t.name)
SKINS.lanes.score = (vis, L) => {
  let lines = '', bars = '', strong = '', slurs = '', sig = ''
  const span = (X1 - X0) / PXB, b0 = Math.max(0, Math.floor(VX)), b1 = Math.min(SONG_END + 1, Math.ceil(VX + span) + 1)
  vis.forEach((i, k) => {
    const t = S.tracks[i], h = rowH(i), y = TY + L.tops[k] - VY
    if (y + h <= TY || y >= BY || t.kind === 'stack') return
    const mid = y + h / 2, one = scDrums(t), gap = Math.max(2.5, Math.min(6, h / 9)), y0 = one ? mid : mid - 2 * gap, y1 = one ? mid : mid + 2 * gap
    if (one) lines += `M${X0} ${n(mid) + .5}H${X1}`
    else for (let j = 0; j < 5; j++) lines += `M${X0} ${n(y0 + j * gap) + .5}H${X1}`
    const top = one ? mid - 7 : y0, bot = one ? mid + 7 : y1
    for (let b = b0; b <= b1; b++) { const x = bx(b + 1); if (x < X0 || x > X1) continue; const d = `M${n(x) + .5} ${n(top)}V${n(bot)}`; if (b % 4) bars += d; else strong += d }
    /* the time signature at the song's start */
    const xs = bx(1)
    if (xs >= X0 - 2 && xs < X1 - 30 && h >= 18) { const z = one ? Math.min(12, h * .42) : Math.min(16, gap * 2.6); sig += T(xs + 9, (one ? mid - 1 : mid - .5), String(S.meter[0]), { size: z, w: 600, anchor: 'middle' }) + T(xs + 9, (one ? mid + z * .8 : mid + z * .82), String(S.meter[1]), { size: z, w: 600, anchor: 'middle' }) }
    /* a slur over each region */
    for (const r of t.regs || []) {
      const xa = bx(r.a), xb = bx(r.b)
      if (xb < X0 || xa > X1 || xb - xa < 8) continue
      const w = xb - xa, hh = Math.min(8, 2.5 + w * .02), ys = (one ? mid - 9 : y0 - 4)
      slurs += `M${n(xa + 3)} ${n(ys)}C${n(xa + w * .25)} ${n(ys - hh)} ${n(xb - w * .25)} ${n(ys - hh)} ${n(xb - 3)} ${n(ys)}C${n(xb - w * .25)} ${n(ys - hh + 1.4)} ${n(xa + w * .25)} ${n(ys - hh + 1.4)} ${n(xa + 3)} ${n(ys)}Z`
    }
  })
  return P(lines, { stroke: INK, sw: .55, sa: .45 }) + P(bars, { stroke: INK, sw: .5, sa: .3 }) + P(strong, { stroke: INK, sw: .8, sa: .55 }) + P(slurs, { fill: INK, fa: .9 }) + sig
}

/* ── rehearsal marks: a boxed letter, the name in italic ── */
SKINS.scenes.score = () => {
  const y0 = MK_Y, y = MK_Y + MK_C, cur = sceneAt(curPos()).i
  let s = R(0, y0, RX, MK_H, { fill: K1 }), g = '', hits = hit(X0, y0, X1 - X0, MK_H, 'scenebar', '', 'default')
  SCENES.forEach((sc, i) => {
    const xa = bx(sc.a), xb = bx(sc.b), xl = Math.max(xa, X0), xr = Math.min(xb, X1), on = i === cur
    if (xr - xl < 1) return
    const L2 = i < 26 ? String.fromCharCode(65 + i) : String(i + 1)
    if (xa >= X0 - 1) g += R(xa + .5, y + 3.5, 14, 14, { stroke: INK, sw: on ? 1.3 : .9 }) + T(xa + 7.5, y + 14.6, L2, { size: 10.5, w: 600, anchor: 'middle' })
    const nm = fit(asGiven(sc.name), Math.max(8, xr - xl - 24), 10.5, 400, true)
    g += T(Math.max(xa, X0) + 19, y + 14.6, nm, { size: 10.5, it: true, a: on ? 1 : .7 })
    if (S.focus === 'marker' && S.selM === sc.a) g += P(`M${n(xl + 19)} ${y + 18}H${n(Math.min(xr - 4, xl + 19 + tw(nm, 10.5, 400, true)))}`, { stroke: INK, sw: .8 })
    hits += hit(xl, y0 + 2, xr - xl, MK_H - 4, 'scene', ` data-i="${i}"`)
  })
  return s + G(g, '', TL) + hits
}
/* ── the cycle: repeat barlines at its ends, the word in red ── */
SKINS.cycle.score = (ca, cb, y, on) => {
  const c = on ? SCK.red : INK, a = on ? 1 : .35, y0 = y + 2, y1 = y + RU_H - 4
  const rep = (x, open) => { const thick = open ? x : x - 3.5, thin = open ? x + 4 : x - .8, dx = open ? x + 8 : x - 8; return R(thick, y0, 2.6, y1 - y0, { fill: c, fa: a }) + R(thin, y0, .8, y1 - y0, { fill: c, fa: a }) + Cc(dx, y0 + (y1 - y0) * .35, 1.3, { fill: c, fa: a }) + Cc(dx, y0 + (y1 - y0) * .65, 1.3, { fill: c, fa: a }) }
  return rep(ca, true) + rep(cb, false) + (cb - ca > 70 ? T(ca + 14, y + 9, 'cycle', { size: 9.5, it: true, c, a }) : '')
}
/* ── the playhead: a red pencil line ── */
SKINS.play.score = (c, w) => {
  const y = RU_Y + RU_CY
  return P(`M.5 ${y}V${BY}`, { stroke: SCK.red, sw: Math.max(.9, w), sa: .9 }) + P(`M-4 ${y - 4}H5L.5 ${y + 3}Z`, { fill: SCK.red }) + hit(-10.5, y - 4, 22, RU_H - RU_CY + 4, 'playhead', '', 'ew-resize')
}
