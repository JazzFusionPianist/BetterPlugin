/* notes, round 2 — A DRAFT of the notes page (a region's notes against the keys; a kit's against its pads), drawn again
   after his words on round 1's: "디자인이 지금보다 훨씬 더 예쁘고 artistic 할 수 있을까? 그리고 velocity에 따라 노트 색깔이
   바꼈으면 좋겠어." Drawn with the room's own kit on the room's own page (draft.mjs reads this into the page; the app does
   not). Nothing here takes the pointer.
     NW.form   how a note is drawn    stroke  the shape of its sound: how it rises, dies and rings on after the key
                                       tile    a cut-cornered tile (the outline regions of notes have), flat
                                       slot    a slot with round ends, as punched in the paper of a player piano
     NW.ramp   what velocity does     own     the track's own pigment, from deep to light
                                       warm    across the pigments, from cool to warm */
const NW = { form: 'stroke', ramp: 'warm', keys: 'plate', view: { a: 32, b: 40, hi: 86 }, chosen: new Set(), pad: 2, held: new Set(), rowH: 11 }
const NW_RU = 16, NW_VH = 62
const nwBlack = p => [1, 3, 6, 8, 10].includes(((p % 12) + 12) % 12)

/* ── colour ── */
const hexLch = hex => {
  const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(u => u <= .04045 ? u / 12.92 : ((u + .055) / 1.055) ** 2.4)
  const l = Math.cbrt(.4122214708 * v[0] + .5363325363 * v[1] + .0514459929 * v[2]), m = Math.cbrt(.2119034982 * v[0] + .6806995451 * v[1] + .1073969566 * v[2]), s = Math.cbrt(.0883024619 * v[0] + .2817188376 * v[1] + .6299787005 * v[2])
  const L = .2104542553 * l + .793617785 * m - .0040720468 * s, a = 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, b = .0259040371 * l + .7827717662 * m - .808675766 * s
  return [L, Math.hypot(a, b), (Math.atan2(b, a) * 180 / Math.PI + 360) % 360]
}
/* a path through colours given as [at, L, C, h] */
const along = (stops, f) => { let k = 0; while (k < stops.length - 2 && f > stops[k + 1][0]) k++; const p = stops[k], q = stops[k + 1], u = clamp((f - p[0]) / (q[0] - p[0]), 0, 1); return oklch(lerp(p[1], q[1], u), lerp(p[2], q[2], u), lerp(p[3], q[3], u)) }
/* cool to warm: night blue, blue, teal, green, straw, orange, vermilion — the room's own pigments in the order of their hues */
const WARM = [[0, .40, .10, 290], [.17, .47, .115, 262], [.34, .57, .10, 212], [.5, .68, .085, 172], [.66, .81, .09, 104], [.83, .75, .145, 64], [1, .655, .19, 33]]
/* two inks: a cool one for what is played softly, a warm one for what is played hard; between them the room's own ink */
const DUO = [[0, .42, .12, 262], [.3, .62, .085, 236], [.55, .90, .02, 95], [.78, .78, .13, 62], [1, .655, .19, 33]]
function velColor (v, base, ramp = NW.ramp) {
  const f = clamp((v - 1) / 126, 0, 1)
  if (ramp === 'warm') return along(WARM, f)
  if (ramp === 'duo') return along(DUO, f)
  const [L0, C0, h0] = hexLch(base), g = f ** 1.15                                      // its own pigment: deep and a little cooler when soft, light and a little warmer when hard
  return oklch(lerp(.33, .93, g), C0 * (g < .55 ? lerp(.85, 1.2, g / .55) : lerp(1.2, .5, (g - .55) / .45)), h0 + lerp(16, -22, g))
}

/* ── the shape of a sound: how loud a note of this instrument is from the moment its key goes down (seconds), 0..1 ── */
function nwEnv (I) {
  if (!I || I.kind === 'plug' || I.kind === 'drums') return { A: 0, D: 1, S: 1, R: 0 }
  const p = instParams(I)
  return I.kind === 'sampler' ? { A: p.a == null ? .002 : p.a, D: p.d == null ? .3 : p.d, S: p.s == null ? 1 : p.s, R: p.r == null ? .12 : p.r } : { A: p.aA == null ? .004 : p.aA, D: p.aD == null ? .4 : p.aD, S: p.aS == null ? .8 : p.aS, R: p.aR == null ? .25 : p.aR }
}
/* a note as the stroke its sound makes: a body about the middle of its row, as tall as it is loud at each moment; after the
   key is let go, the ring it leaves, fainter */
function strokeNote (xa, xb, cy, half, env, pps, col, o = {}) {
  const { A, D, S, R } = env, floor = .22, top = [], bot = [], step = 1.5
  const at = t => t < A ? t / Math.max(1e-4, A) : S + (1 - S) * Math.exp(-(t - A) / Math.max(.02, D / 3))
  const w = Math.max(2, xb - xa)
  for (let x = 0; ; x = Math.min(w, x + step)) { const e = Math.max(floor, at(x / pps)) * half; top.push(`${n(xa + x)} ${n(cy - e)}`); bot.push(`${n(xa + x)} ${n(cy + e)}`); if (x >= w) break }
  let s = P('M' + top.join('L') + 'L' + bot.reverse().join('L') + 'Z', { fill: col, fa: o.fa == null ? 1 : o.fa })
  const e1 = Math.max(floor, at(w / pps)), tail = Math.min(R * 1.6, 3) * pps
  if (R > .03 && tail > 3 && !o.noTail) {
    const tt = [], bb = []
    for (let x = 0; ; x = Math.min(tail, x + step)) { const e = e1 * Math.exp(-(x / pps) / (R / 3)) * half; tt.push(`${n(xb + x)} ${n(cy - e)}`); bb.push(`${n(xb + x)} ${n(cy + e)}`); if (x >= tail || e < .35) break }
    s += P('M' + tt.join('L') + 'L' + bb.reverse().join('L') + 'Z', { fill: col, fa: (o.fa == null ? 1 : o.fa) * .42 })
  }
  return s
}
/* a drum struck: its stroke, as long as it rings (the kit page's own drawing, laid along the song's time) */
function strokeHit (xa, cy, half, name, decay, pps, col, xStop, o = {}) {
  const sec = 2.4, N = 200, vals = drumStroke(name, decay, N, sec), top = [], bot = []
  for (let i = 0; i < N; i++) { const t = sec * (i / (N - 1)) ** 2, x = xa + t * pps, e = vals[i] * half; if (x > xStop || (i > 3 && vals[i] < .035)) break; top.push(`${n(x)} ${n(cy - Math.max(.5, e))}`); bot.push(`${n(x)} ${n(cy + Math.max(.5, e))}`) }
  if (top.length < 2) return ''
  return P('M' + top.join('L') + 'L' + bot.reverse().join('L') + 'Z', { fill: col, fa: o.fa == null ? 1 : o.fa })
}

/* ── the panel's own bar: patch, mixer, notes ── */
function nwHead (y) {
  const t = S.tracks[S.sel], by = y + 16.6
  let s = R(0, y, RX, PH, { fill: K2 }) + hline(0, RX, y, .14) + hline(0, RX, y + PH - .5, .08)
  s += R(RX / 2 - 12, y + 2, 24, 2, { rx: 1, fill: INK, fa: .2 })
  s += cells(10, y + 4, 18, [{ t: 'patch' }, { t: 'mixer' }, { t: 'notes', on: true }], { size: 9.5, widths: [48, 48, 48] })[0]
  const nx = 168, nm = fit(t.name, 160, 10.5, 500)
  s += R(nx, y + 10, 6, 6, { fill: t.c }) + T(nx + 12, by, nm, { size: 10.5, w: 500 })
  let ax = nx + 12 + tw(nm, 10.5, 500) + 7
  const r = (S.selR.length && regOf(S.selR[0])[0]) || t.regs.find(q => q.notes)
  if (r) { const nmR = r.tag || r.name || 'region'; s += T(ax, by, nmR, { size: 9.5, a: .7 }); ax += tw(nmR, 9.5) + 8; s += T(ax, by, `bars ${+(r.a).toFixed(2)} to ${+(r.b).toFixed(2)}`, { size: 9.5, a: .4 }) }
  const g = r && r.q ? `1/${Math.round(4 / r.q)}` : 'off', fs = [['strength', String(Math.round((r && r.qs != null ? r.qs : 1) * 100))], ['swing', String(Math.round(((r && r.sw) || 0) * 100))], ['transpose', (r && r.tr ? (r.tr > 0 ? '+' : '−') + Math.abs(r.tr) : '0')], ['velocity', (r && r.vel ? (r.vel > 0 ? '+' : '−') + Math.abs(r.vel) : '0')]]
  let fx = RX - 14
  for (const [name, v] of fs.slice().reverse()) { const w = tw(name, 9.5) + 5 + tw(v, 9.5); fx -= w; s += field(fx, by, name, v)[0]; fx -= 18 }
  const mw = Math.round(tw(g, 9.5) + 26); fx -= mw; s += menuKey(fx, y + 4, g)[0]; fx -= tw('grid', 9.5) + 6; s += T(fx, by, 'grid', { size: 9.5, a: .4 })
  return s
}

/* ── the notes page ── */
function pNotes2 (y, h) {
  const t = S.tracks[S.sel], r = (S.selR.length && regOf(S.selR[0])[0]) || t.regs.find(q => q.notes), kit = isInst(t) && t.inst.kind === 'drums'
  const KW = kit ? 128 : 54, x0 = KW, x1 = RX, top = y + NW_RU, bot = y + h - NW_VH, gh = bot - top, V = NW.view
  const pxb = (x1 - x0) / (V.b - V.a), X = bar => x0 + (bar - V.a) * pxb, pps = pxb / SPB()
  const rowH = kit ? Math.floor(gh / DRUM_PADS.length) : NW.rowH, count = kit ? DRUM_PADS.length : Math.floor(gh / rowH), hi = kit ? 0 : V.hi, lo = hi - count + 1
  const rowOfKey = p => kit ? (() => { const i = DRUM_PADS.findIndex(q => q[1] === p); return i < 0 ? -1 : DRUM_PADS.length - 1 - i })() : hi - p
  const Y = p => top + rowOfKey(p) * rowH, gb = top + count * rowH
  const cid = 'nw' + (++UID), L = r ? regLook(r, t) : { c: t.c, deep: t.deep, sel: t.csel }, env = nwEnv(t.inst), form = NW.form
  let s = R(0, y, RX, h, { fill: K0 }) + `<clipPath id="${cid}"><rect x="${x0}" y="${n(y)}" width="${n(x1 - x0)}" height="${n(h)}"/></clipPath>`
  let g = ''
  /* the paper: the rows of the white keys a breath lighter, a hairline under every c; for a kit a hairline under every pad */
  if (kit) { let d = ''; for (let k = 1; k <= count; k++) d += `M${x0} ${top + k * rowH - .5}H${x1}`; g += P(d, { stroke: INK, sa: .045 }) }
  else for (let p = hi; p >= lo; p--) { if (!nwBlack(p)) g += R(x0, Y(p), x1 - x0, rowH, { fill: INK, fa: .022 }); if (((p % 12) + 12) % 12 === 0) g += hline(x0, x1, Y(p) + rowH - 1, .1) }
  /* the grid: bars, beats, and the steps (short ticks at the foot of every row of c for keys; hairlines for a kit, where a step is a place) */
  { let bars = '', beats = '', steps = ''
    const b = BEATS(), st = b * BEAT_16()
    for (let k = Math.floor(V.a * st); k <= Math.ceil(V.b * st); k++) { const x = n(X(k / st)) + .5, ln = `M${x} ${top}V${gb}`; if (k % st === 0) bars += ln; else if (k % BEAT_16() === 0) beats += ln; else if (pxb / st >= 5) steps += ln }
    g += P(steps, { stroke: INK, sa: kit ? .04 : .022 }) + P(beats, { stroke: INK, sa: kit ? .085 : .06 }) + P(bars, { stroke: INK, sa: .17 }) }
  /* its notes; and, fainter, what the lane holds on either side of the region */
  const draw = (q, own) => {
    let out = '', ring = ''
    const list = regSound(q).slice().sort((a, b2) => a.a - b2.a)
    for (let k = 0; k < list.length; k++) {
      const x = list[k], row = rowOfKey(x.n)
      if (row < 0 || row >= count) continue
      const xa = X(x.a), on = own && NW.chosen.has(x.id), col = velColor(x.v, L.c), fa = own ? 1 : .3, f = clamp((x.v - 1) / 126, 0, 1)
      const yy = Y(x.n), cy = yy + rowH / 2
      if (kit) {
        const [pn] = DRUM_PADS.find(q2 => q2[1] === x.n), cellW = pxb / (BEATS() * BEAT_16()), dec = (t.inst.p || {})[`${pn}.decay`]
        if (xa + 260 < x0 || xa > x1) continue
        if (form === 'stroke') { let stop = 1e9; for (let j = k + 1; j < list.length; j++) if (list[j].n === x.n) { stop = X(list[j].a) - 1.5; break } out += strokeHit(xa + .5, cy, (rowH / 2 - 2.5) * (.4 + .6 * f), pn, dec, pps, col, stop, { fa }) + (on ? R(xa - .5, yy + 2, 2, rowH - 4, { fill: INK }) : '') }
        else if (form === 'slot') out += Cc(xa + cellW / 2, cy, (Math.min(cellW, rowH) / 2 - 3) * (.62 + .38 * f), { fill: col, fa }) + (on ? Cc(xa + cellW / 2, cy, Math.min(cellW, rowH) / 2 - 1.5, { stroke: INK }) : '')
        else out += P(shapePath(xa + 1.5, yy + 2, cellW - 3, rowH - 4, SHAPES.notes, .8), { fill: col, fa }) + (on ? P(shapePath(xa + 1, yy + 1.5, cellW - 2, rowH - 3, SHAPES.notes, .8), { stroke: INK }) : '')
        continue
      }
      const xb = X(x.b), w = Math.max(2.5, xb - xa - 1)
      if (xa + w + 220 < x0 || xa > x1) continue
      if (form === 'stroke') { out += strokeNote(xa + .5, xa + .5 + w, cy, (rowH / 2 - .5) * (.66 + .34 * f), env, pps, col, { fa }); if (on) ring += R(xa - 1, yy - .5, w + 3, rowH + 1, { stroke: INK }) }
      else if (form === 'slot') out += R(xa + .5, yy + 1.5, w, rowH - 3, { rx: (rowH - 3) / 2, fill: col, fa }) + (on ? R(xa, yy + 1, w + 1, rowH - 2, { rx: (rowH - 2) / 2, stroke: INK }) : '')
      else out += P(shapePath(xa + .5, yy + 1, w, rowH - 2, SHAPES.notes, .62), { fill: col, fa }) + (on ? P(shapePath(xa - 1, yy - .5, w + 3, rowH + 1, SHAPES.notes, .62), { stroke: INK }) : '')
    }
    return out + ring
  }
  for (const q of t.regs) if (q.notes && q !== r) g += draw(q, false)
  if (r) {
    const xa = X(r.a - 1), xb = X(r.b - 1)
    g += draw(r, true)
    if (xa > x0) g += R(x0, top, xa - x0, gb - top, { fill: K1, fa: .62 })                 // outside the region the page is dimmed: what is edited is the region
    if (xb < x1) g += R(xb, top, x1 - xb, gb - top, { fill: K1, fa: .62 })
    g += P(`M${n(xa) + .5} ${top}V${y + h}M${n(xb) + .5} ${top}V${y + h}`, { stroke: INK, sa: .3 })
  }
  /* how hard each note is played: a bar under it, in the note's own colour — the lane is the key to the colours */
  { const vy = bot, base = y + h - 7, room = NW_VH - 20
    g += R(x0, vy, x1 - x0, NW_VH, { fill: K0 }) + hline(x0, x1, vy, .14) + hline(x0, x1, base - room, .045) + hline(x0, x1, base - room / 2, .03) + hline(x0, x1, base, .08)
    if (r) for (const x of regSound(r)) { const xa = X(x.a), hg = Math.max(2, room * x.v / 127), on = NW.chosen.has(x.id), col = velColor(x.v, L.c); if (xa < x0 - 4 || xa > x1) continue; g += R(xa + .5, base - hg, 3, hg, { fill: col }) + R(xa + .5, base - hg, 7, 2, { fill: col }) + (on ? R(xa - 1.5, base - hg - 2, 11, hg + 3, { stroke: INK, sa: .8 }) : '') } }
  { const px = X(curPos()); if (px >= x0 && px <= x1) g += P(`M${Math.round(px) + .5} ${y}V${y + h}`, { stroke: INK }) }
  s += G(g, '', ` clip-path="url(#${cid})"`)
  /* the bars along the top, and the region's own stretch marked on them */
  s += R(0, y, RX, NW_RU, { fill: K1 }) + hline(0, RX, y + NW_RU - .5, .1)
  for (let b = Math.ceil(V.a); b <= V.b; b++) { const x = X(b); if (x < x0 || x > x1 - 12) continue; s += T(x + 4, y + 11, String(b + 1), { size: 8.5, a: .5 }) + P(`M${n(x) + .5} ${y + 3}V${y + NW_RU}`, { stroke: INK, sa: .22 }) }
  if (r) s += R(Math.max(x0, X(r.a - 1)), y + NW_RU - 3, Math.max(0, Math.min(x1, X(r.b - 1)) - Math.max(x0, X(r.a - 1))), 2, { fill: L.c })
  /* down the left: the keys, as the instrument's own (its pigment, dark keys cut in) — or the kit's pads, each the drum it is */
  s += R(0, y, KW, h, { fill: K1 })
  if (kit) {
    DRUM_PADS.forEach(([name, key], i) => {
      const ry = top + (DRUM_PADS.length - 1 - i) * rowH, on = i === NW.pad, pw = 38, ph = rowH - 4
      if (on) s += R(0, ry, KW, rowH, { fill: INK, fa: .07 })
      s += R(8, ry + 2, pw, ph, { rx: 1.5, fill: on ? L.sel : L.c }) + PIC.pic(name, 8, ry + 2, pw, ph, L.deep, on ? L.sel : L.c, 1.5)
      s += T(8 + pw + 9, ry + rowH / 2 + 3.2, name, { size: 9, a: on ? 1 : .7, w: on ? 500 : 400 }) + hline(0, KW, ry + rowH - .5, .045)
    })
  } else {
    const plate = NW.keys === 'plate', kc = plate ? L.c : INK, kd = plate ? L.deep : K0, bwid = Math.round(KW * .6)
    let whites = R(0, top, KW, count * rowH, { fill: kc, fa: plate ? 1 : .9 }), blacks = '', seams = ''
    for (let p = hi; p >= lo; p--) {
      const ry = Y(p), pc = ((p % 12) + 12) % 12
      if (nwBlack(p)) { blacks += R(0, ry, bwid, rowH, { fill: kd }); seams += `M${bwid} ${n(ry + rowH / 2)}H${KW}` }
      else if (pc === 4 || pc === 11) seams += `M0 ${ry}H${KW}`                          // (e and b have no black key above them: their upper edge is a seam all the way across)
      if (NW.held.has(p)) whites += R(nwBlack(p) ? 0 : bwid, ry, nwBlack(p) ? bwid : KW - bwid, rowH, { fill: plate ? L.sel : L.c })
      if (pc === 0) blacks += T(KW - 5, ry + rowH - 2.4, keyName(p), { size: 7.5, w: 500, c: plate ? L.deep : K1, anchor: 'end' })
    }
    s += whites + P(seams, { stroke: kd, sa: plate ? .55 : .38 }) + blacks
  }
  /* the key to the colours, beside the lane of how hard: soft at the foot, hard at the head */
  { const base = y + h - 7, room = NW_VH - 20, kx = KW - 12
    s += R(0, bot, KW, NW_VH, { fill: K1 }) + T(kit ? 8 : 6, bot + 15, 'velocity', { size: 8.5, a: .4 }) + hline(0, KW, bot, .14)
    for (let k = 0; k < room; k++) s += R(kx, base - k - 1, 5, 1.2, { fill: velColor(1 + 126 * k / (room - 1), L.c) }) }
  s += vline(KW - .5, y, y + h, .12)
  /* where the page stands: along the song, and among the keys */
  s += R(x0 + 4 + (x1 - x0 - 8) * .34, y + h - 4.5, (x1 - x0 - 8) * .12, 3, { rx: 1.5, fill: INK, fa: .22 })
  if (!kit) s += R(RX - 5, top + 3 + (gh - 6) * (127 - hi) / 128, 3, Math.max(14, (gh - 6) * count / 128), { rx: 1.5, fill: INK, fa: .22 })
  return s
}
/* read into the room: the panel shows the notes page when its tab says so */
{ const dock1 = PARTS.dock
  PARTS.dock = function () {
    if (S.panel.tab !== 'notes' || VIEW.p <= .001) return dock1()
    const y = BY, h = S.panel.h
    return R(0, y, RX, h + 2, { fill: K1 }) + pNotes2(y + PH, h - PH) + nwHead(y)
  } }
