/* ── the notes page: a region's notes against the keys; a kit's against its pads (key p; a region of notes pressed twice) ──
   The third page of the panel under the lanes. A note is drawn as the stroke its sound makes — as tall, at each moment, as
   its instrument is loud: how it rises, dies down, is held, and (fainter) rings on after the key is let go; a drum as its
   stroke for as long as it rings. Its colour says how hard it is played, in two inks: a cool one for soft, the room's own
   ink in the middle, a warm one for hard. Under the notes a lane of how hard each is; down the left the keys, in the
   track's pigment — or the kit's pads, each the drum it is. (Draft: Daw/design/midi round 2 draft, way a, colour 1.)
   Hands: a note pressed is chosen (shift: one more or less) and heard; pulled, the chosen ones go with it along the grid
   and up and down the keys (option: copies of them); its end pulled, it is longer or shorter. Pressed twice on the paper,
   a note is made there (on a kit one press makes a stroke, a stroke pressed twice goes). A pull over the paper chooses what
   it crosses. In the lane below, a bar pulled up or down is how hard. Keys while the page has the keys: delete; command
   a, c, x, v; option and the arrows move the chosen notes (shift: an octave); escape lets them go.
   The notes are the region's own (r.notes, quarter notes from its beginning) and are shown where they sound: its grid,
   its transposing and its repeats are in what is drawn. A note made or moved past the region's end makes the region
   longer, as far as the next one on the lane.
   (Read after the room's own hands are made, before they are put to work: see the end.) */
const ROLL = { rid: null, view: { a: 0, b: 8, hi: 84 }, rowH: 13, grid: '1/16', sel: new Set(), drag: null, pad: -1, vel: 100, g: null, clip: null, h: 460, hOther: 316, shown: false, last: { id: 0, at: 0 }, band: null }
const RL_RU = 16, RL_VH = 62, RL_GRIDS = ['1/4', '1/8', '1/16', '1/32', '1/6', '1/12', '1/24']
const rollOn = () => S.panel.on && S.panel.tab === 'notes'
const rollBlack = p => [1, 3, 6, 8, 10].includes(((p % 12) + 12) % 12)
const rollStep = () => WHOLE() / (+ROLL.grid.slice(2) || 16)                             // the page's grid, in bars
/* how hard, as a colour: two inks — cool when soft, the room's own ink between, warm when hard */
const RL_INKS = [[0, .42, .12, 262], [.3, .62, .085, 236], [.55, .90, .02, 95], [.78, .78, .13, 62], [1, .655, .19, 33]]
function rollColor (v) {
  const f = clamp((v - 1) / 126, 0, 1), st = RL_INKS
  let k = 0
  while (k < st.length - 2 && f > st[k + 1][0]) k++
  const p = st[k], q = st[k + 1], u = clamp((f - p[0]) / (q[0] - p[0]), 0, 1)
  return oklch(lerp(p[1], q[1], u), lerp(p[2], q[2], u), lerp(p[3], q[3], u))
}
/* the region the page shows: the chosen one if it holds notes, else the one under the playhead on the chosen track, else the one it showed, else the track's first */
function rollReg () {
  const t = S.tracks[S.sel]
  if (!t || !isInst(t)) return [null, t || null]
  for (const id of S.selR) { const [r, tr] = regOf(id); if (r && r.notes && tr === t) return [r, t] }
  const pos = curPos(), own = t.regs.filter(q => q.notes)
  return [own.find(q => pos >= q.a - 1 && pos < q.b - 1) || own.find(q => q.id === ROLL.rid) || own.slice().sort((x, y) => x.a - y.a)[0] || null, t]
}
const rollKit = t => !!t && isInst(t) && t.inst.kind === 'drums'
/* the view laid on a region: from a little before its beginning, as many bars as read well; the keys about its notes */
function rollFit (r, t) {
  const V = ROLL.view, a = r ? r.a - 1 : Math.floor(curPos()), len = r ? r.b - r.a : 4
  const span = clamp(len + .5, 2.5, 8.5)
  V.a = a - .25; V.b = V.a + span
  if (r && r.notes.length && !rollKit(t)) { const ns = regSound(r).map(x => x.n); if (ns.length) { const lo = Math.min(...ns), hi = Math.max(...ns); V.hi = clamp(Math.round((lo + hi) / 2) + 12, 24, 127) } }
  ROLL.sel = new Set(); ROLL.rid = r ? r.id : null
}
/* how loud a note of this instrument is from the moment its key goes down (seconds): rise, fall, held level, ring */
function rollEnv (I) {
  if (!I || I.kind === 'plug' || I.kind === 'drums') return { A: 0, D: 1, S: 1, R: 0 }
  const p = instParams(I)
  return I.kind === 'sampler' ? { A: p.a == null ? .002 : p.a, D: p.d == null ? .3 : p.d, S: p.s == null ? 1 : p.s, R: p.r == null ? .12 : p.r } : { A: p.aA == null ? .004 : p.aA, D: p.aD == null ? .4 : p.aD, S: p.aS == null ? .8 : p.aS, R: p.aR == null ? .25 : p.aR }
}
function rollStroke (xa, xb, cy, half, env, pps, col, fa) {
  const { A, D, S: su, R: rl } = env, floor = .22, top = [], bot = [], step = 2
  const at = t => t < A ? t / Math.max(1e-4, A) : su + (1 - su) * Math.exp(-(t - A) / Math.max(.02, D / 3))
  const w = Math.max(2, xb - xa)
  for (let x = 0; ; x = Math.min(w, x + step)) { const e = Math.max(floor, at(x / pps)) * half; top.push(`${n(xa + x)} ${n(cy - e)}`); bot.push(`${n(xa + x)} ${n(cy + e)}`); if (x >= w) break }
  let s = P('M' + top.join('L') + 'L' + bot.reverse().join('L') + 'Z', { fill: col, fa })
  const e1 = Math.max(floor, at(w / pps)), tail = Math.min(rl * 1.6, 3) * pps
  if (rl > .03 && tail > 3) {
    const tt = [], bb = []
    for (let x = 0; ; x = Math.min(tail, x + step)) { const e = e1 * Math.exp(-(x / pps) / (rl / 3)) * half; tt.push(`${n(xb + x)} ${n(cy - e)}`); bb.push(`${n(xb + x)} ${n(cy + e)}`); if (x >= tail || e < .35) break }
    s += P('M' + tt.join('L') + 'L' + bb.reverse().join('L') + 'Z', { fill: col, fa: fa * .42 })
  }
  return s
}
function rollHit (xa, cy, half, name, decay, pps, col, xStop, fa) {
  const sec = 2.4, N = 160, vals = drumStroke(name, decay, N, sec), top = [], bot = []
  for (let i = 0; i < N; i++) { const t = sec * (i / (N - 1)) ** 2, x = xa + t * pps, e = vals[i] * half; if (x > xStop || (i > 3 && vals[i] < .035)) break; top.push(`${n(x)} ${n(cy - Math.max(.5, e))}`); bot.push(`${n(x)} ${n(cy + Math.max(.5, e))}`) }
  return top.length < 2 ? '' : P('M' + top.join('L') + 'L' + bot.reverse().join('L') + 'Z', { fill: col, fa })
}

/* ── drawing ── */
const rlHit = (x, y, w, h, k, more = '', cur = 'default') => hit(x, y, w, h, 'np', ` data-k="${k}"${more}`, cur)
function rollHead (y) {
  const t = S.tracks[S.sel], by = y + 16.6, [r] = rollReg()
  let s = R(0, y, RX, PH, { fill: K2 }) + hline(0, RX, y, .14) + hline(0, RX, y + PH - .5, .08)
  s += R(RX / 2 - 12, y + 2, 24, 2, { rx: 1, fill: INK, fa: .2 }) + hit(0, y - 3, RX, 8, 'pgrip', '', 'ns-resize')
  s += cells(10, y + 4, 18, [{ t: 'patch', a: 'tab-patch' }, { t: 'mixer', a: 'tab-mixer' }, { t: 'notes', on: true, a: 'tab-notes' }], { size: 9.5, widths: [48, 48, 48] })[0]
  if (!t) return s
  const nx = 168, nm = fit(asGiven(t.name), 160, 10.5, 500)
  s += R(nx, y + 10, 6, 6, { fill: t.c }) + T(nx + 12, by, nm, { size: 10.5, w: 500 })
  let ax = nx + 12 + tw(nm, 10.5, 500) + 7
  if (r) { const nmR = asGiven(r.tag || r.name || 'region'); s += T(ax, by, fit(nmR, 160, 9.5), { size: 9.5, a: .7 }); ax += tw(fit(nmR, 160, 9.5), 9.5) + 8; s += T(ax, by, `bars ${+r.a.toFixed(2)} to ${+r.b.toFixed(2)}`, { size: 9.5, a: .4 }) }
  else if (!isInst(t)) s += T(ax, by, 'a track of sound', { size: 9.5, a: .4 })
  const g = ROLL.grid, mw = Math.round(tw(g, 9.5) + 26), fx = RX - 14 - mw
  s += menuKey(fx, y + 4, g, { a: 'np', more: ' data-k="grid"' })[0] + T(fx - tw('grid', 9.5) - 6, by, 'grid', { size: 9.5, a: .4 })
  if (ROLL.sel.size) s += T(fx - tw('grid', 9.5) - 24, by, `${ROLL.sel.size} chosen`, { size: 9.5, a: .5, anchor: 'end' })
  return s
}
function pRoll (y, h) {
  const [r, t] = rollReg(), inst = !!t && isInst(t), kit = rollKit(t)
  if ((r ? r.id : null) !== ROLL.rid || ROLL.tid !== (t ? t.id : 0)) { rollFit(r, t); ROLL.tid = t ? t.id : 0 }
  const KW = kit ? 128 : 54, x0 = KW, x1 = RX, top = y + RL_RU, bot = y + h - RL_VH, gh = bot - top, V = ROLL.view
  const pxb = (x1 - x0) / (V.b - V.a), X = bar => x0 + (bar - V.a) * pxb, pps = pxb / SPB()
  const rowH = kit ? clamp(Math.floor(gh / DRUM_PADS.length), 12, 26) : ROLL.rowH, count = kit ? DRUM_PADS.length : Math.max(1, Math.floor(gh / rowH))
  if (!kit) V.hi = clamp(Math.round(V.hi), count - 1, 127)
  const hi = kit ? 0 : V.hi, lo = hi - count + 1
  const rowOfKey = p => kit ? (() => { const i = DRUM_PADS.findIndex(q => q[1] === p); return i < 0 ? -1 : DRUM_PADS.length - 1 - i })() : hi - p
  const Y = p => top + rowOfKey(p) * rowH, gb = top + count * rowH
  const cid = 'rl' + (++UID), L = r ? regLook(r, t) : { c: t ? t.c : INK, deep: t ? t.deep : K0, sel: t ? t.csel : INK }, env = rollEnv(inst ? t.inst : null), step = rollStep()
  ROLL.g = { y, h, x0, x1, top, bot, gb, rowH, count, hi, pxb, kit, KW, base: y + h - 7, room: RL_VH - 20 }
  let s = R(0, y, RX, h, { fill: K0 }) + `<clipPath id="${cid}"><rect x="${x0}" y="${n(y)}" width="${n(x1 - x0)}" height="${n(h)}"/></clipPath>`
  let g = '', hits = rlHit(x0, top, x1 - x0, gb - top, 'paper'), out = ''                // (hits: on the paper, cut with it; out: the ruler's and the keys')
  /* the paper: the rows of the white keys a breath lighter, a hairline under every c; for a kit a hairline under every pad */
  if (kit) { let d = ''; for (let k = 1; k <= count; k++) d += `M${x0} ${top + k * rowH - .5}H${x1}`; g += P(d, { stroke: INK, sa: .045 }) }
  else if (inst) for (let p = hi; p >= lo; p--) { if (!rollBlack(p)) g += R(x0, Y(p), x1 - x0, rowH, { fill: INK, fa: .022 }); if (((p % 12) + 12) % 12 === 0) g += hline(x0, x1, Y(p) + rowH - 1, .1) }
  /* the grid: bars, beats, and the page's own division while its lines have room */
  { let bars = '', beats = '', steps = ''
    const bt = 1 / BEATS(), fine = step * pxb >= 6 ? step : bt * pxb >= 6 ? bt : 1
    for (let k = Math.floor(V.a / fine); k * fine <= V.b + 1e-9; k++) { const p = k * fine, x = n(X(p)) + .5; if (x < x0) continue; const ln = `M${x} ${top}V${gb}`, inBar = p - Math.floor(p + 1e-9); if (inBar < 1e-6 || 1 - inBar < 1e-6) bars += ln; else if (Math.abs(inBar / bt - Math.round(inBar / bt)) < 1e-6) beats += ln; else steps += ln }
    g += P(steps, { stroke: INK, sa: kit ? .04 : .025 }) + P(beats, { stroke: INK, sa: kit ? .085 : .06 }) + P(bars, { stroke: INK, sa: .17 }) }
  /* its notes; and, fainter, what the lane holds on either side of the region */
  const draw = (q, own) => {
    let out = '', ring = ''
    const list = regSound(q)
    for (let k = 0; k < list.length; k++) {
      const x = list[k], row = rowOfKey(x.n)
      if (row < 0 || row >= count) continue
      const xa = X(x.a), on = own && ROLL.sel.has(x.id), col = rollColor(x.v), fa = own ? 1 : .28, f = clamp((x.v - 1) / 126, 0, 1), yy = Y(x.n), cy = yy + rowH / 2
      if (kit) {
        const pad = DRUM_PADS.find(q2 => q2[1] === x.n), cellW = Math.max(6, step * pxb), dec = (t.inst.p || {})[`${pad[0]}.decay`]
        if (xa + 280 < x0 || xa > x1) continue
        let stop = 1e9
        for (let j = k + 1; j < list.length; j++) if (list[j].n === x.n) { stop = X(list[j].a) - 1.5; break }
        out += rollHit(xa + .5, cy, (rowH / 2 - 2.5) * (.4 + .6 * f), pad[0], dec, pps, col, stop, fa)
        if (on) ring += R(xa - 1, yy + 1.5, Math.min(cellW, stop - xa) + 1, rowH - 3, { stroke: INK })
        if (own) hits += rlHit(xa, yy, Math.max(6, Math.min(cellW, stop - xa + 1.5)), rowH, 'note', ` data-i="${x.id}"`, 'grab')
        continue
      }
      const xb = X(x.b), w = Math.max(2.5, xb - xa - 1)
      if (xa + w + 240 < x0 || xa > x1) continue
      out += rollStroke(xa + .5, xa + .5 + w, cy, (rowH / 2 - .5) * (.66 + .34 * f), env, pps, col, fa)
      if (on) ring += R(xa - 1, yy - .5, w + 3, rowH + 1, { stroke: INK })
      if (own) { hits += rlHit(xa, yy, Math.max(4, w + 1), rowH, 'note', ` data-i="${x.id}"`, 'grab'); if (w >= 10) hits += rlHit(xa + w - 4, yy, 6, rowH, 'len', ` data-i="${x.id}"`, 'ew-resize') }
    }
    return out + ring
  }
  if (inst) for (const q of t.regs) if (q.notes && q !== r) g += draw(q, false)
  if (r) {
    const xa = X(r.a - 1), xb = X(r.b - 1)
    g += draw(r, true)
    if (xa > x0) g += R(x0, top, xa - x0, gb - top, { fill: K1, fa: .62 })                 // outside the region the page is dimmed: what is edited is the region
    if (xb < x1) g += R(xb, top, x1 - xb, gb - top, { fill: K1, fa: .62 })
    g += P(`M${n(xa) + .5} ${top}V${y + h}M${n(xb) + .5} ${top}V${y + h}`, { stroke: INK, sa: .3 })
  }
  if (ROLL.band) { const b = ROLL.band; g += R(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1), Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0), { fill: INK, fa: .06, stroke: INK, sa: .5 }) }
  /* how hard each note is played: a bar under it, in the note's own colour — the lane is the key to the colours */
  { const vy = bot, base = y + h - 7, room = RL_VH - 20
    g += R(x0, vy, x1 - x0, RL_VH, { fill: K0 }) + hline(x0, x1, vy, .14) + hline(x0, x1, base - room, .045) + hline(x0, x1, base - room / 2, .03) + hline(x0, x1, base, .08)
    if (r) for (const x of regSound(r)) { const xa = X(x.a), hg = Math.max(2, room * x.v / 127), on = ROLL.sel.has(x.id), col = rollColor(x.v); if (xa < x0 - 4 || xa > x1) continue; g += R(xa + .5, base - hg, 3, hg, { fill: col }) + R(xa + .5, base - hg, 7, 2, { fill: col }) + (on ? R(xa - 1.5, base - hg - 2, 11, hg + 3, { stroke: INK, sa: .8 }) : '') }
    hits += rlHit(x0, vy + 2, x1 - x0, RL_VH - 4, 'vel', '', 'ns-resize') }
  { const px = X(curPos()); g += `<g id="np-ph" transform="translate(${n(px)} 0)"${px >= x0 && px <= x1 ? '' : ' visibility="hidden"'}>` + P(`M.5 ${y}V${y + h}`, { stroke: INK }) + '</g>' }
  const paper = G(g, '', ` clip-path="url(#${cid})"`)
  s += paper
  /* the bars along the top, and the region's own stretch marked on them */
  s += R(0, y, RX, RL_RU, { fill: K1 }) + hline(0, RX, y + RL_RU - .5, .1)
  { const every = [1, 2, 4, 8].find(k => k * pxb >= 44) || 8
    for (let b = Math.ceil(V.a); b <= V.b; b++) { const x = X(b); if (x < x0 || x > x1 - 12) continue; s += P(`M${n(x) + .5} ${y + (b % every ? 10 : 3)}V${y + RL_RU}`, { stroke: INK, sa: .22 }); if (b % every === 0) s += T(x + 4, y + 11, String(b + 1), { size: 8.5, a: .5 }) } }
  if (r) s += R(Math.max(x0, X(r.a - 1)), y + RL_RU - 3, Math.max(0, Math.min(x1, X(r.b - 1)) - Math.max(x0, X(r.a - 1))), 2, { fill: L.c })
  out += rlHit(x0, y, x1 - x0, RL_RU, 'ruler', '', 'pointer')
  /* down the left: the keys, as the instrument's own (its pigment, dark keys cut in) — or the kit's pads, each the drum it is */
  s += R(0, y, KW, h, { fill: K1 })
  if (kit) {
    DRUM_PADS.forEach(([name, key], i) => {
      const ry = top + (DRUM_PADS.length - 1 - i) * rowH, on = i === ROLL.pad, pw = 38, ph = rowH - 4
      if (on) s += R(0, ry, KW, rowH, { fill: INK, fa: .07 })
      s += R(8, ry + 2, pw, ph, { rx: 1.5, fill: on ? L.sel : L.c }) + PIC.pic(name, 8, ry + 2, pw, ph, L.deep, on ? L.sel : L.c, 1.5)
      s += T(8 + pw + 9, ry + rowH / 2 + 3.2, name, { size: 9, a: on ? 1 : .7, w: on ? 500 : 400 }) + hline(0, KW, ry + rowH - .5, .045)
      out += rlHit(0, ry, KW, rowH, 'key', ` data-v="${key}"`, 'pointer')
    })
  } else if (inst) {
    const bwid = Math.round(KW * .6), held = typeof TYPE !== 'undefined' ? new Set(TYPE.down.values()) : new Set()
    let whites = R(0, top, KW, count * rowH, { fill: L.c }), blacks = '', seams = ''
    for (let p = hi; p >= lo; p--) {
      const ry = Y(p), pc = ((p % 12) + 12) % 12
      if (rollBlack(p)) { blacks += R(0, ry, bwid, rowH, { fill: L.deep }); seams += `M${bwid} ${n(ry + rowH / 2)}H${KW}` }
      else if (pc === 4 || pc === 11) seams += `M0 ${ry}H${KW}`                          // (e and b have no black key above them: their upper edge is a seam all the way across)
      if (held.has(p) || ROLL.key === p) whites += R(rollBlack(p) ? 0 : bwid, ry, rollBlack(p) ? bwid : KW - bwid, rowH, { fill: L.sel })
      if (pc === 0) blacks += T(KW - 5, ry + rowH - 2.4, keyName(p), { size: 7.5, w: 500, c: L.deep, anchor: 'end' })
      out += rlHit(0, ry, KW, rowH, 'key', ` data-v="${p}"`, 'pointer')
    }
    s += whites + P(seams, { stroke: L.deep, sa: .55 }) + blacks
  }
  /* the key to the colours, beside the lane of how hard: soft at the foot, hard at the head */
  { const base = y + h - 7, room = RL_VH - 20, kx = KW - 12
    s += R(0, bot, KW, RL_VH, { fill: K1 }) + T(kit ? 8 : 6, bot + 15, 'velocity', { size: 8.5, a: .4 }) + hline(0, KW, bot, .14)
    for (let k = 0; k < room; k++) s += R(kx, base - k - 1, 5, 1.2, { fill: rollColor(1 + 126 * k / (room - 1)) }) }
  s += vline(KW - .5, y, y + h, .12)
  return s + G(hits, '', ` clip-path="url(#${cid})"`) + out
}

/* ── what is done to the notes ── */
const rollQ = r => { const qb = QB(), org = (r.a - 1) - (r.off || 0); return { qb, org, toQ: bar => (bar - org) * qb, limit: rollLimit(r) } }
/* how far a region may grow: to the next region on its lane, or the song's end (bars from zero) */
function rollLimit (r) { const [, t] = regOf(r.id); let lim = SONG_END; if (t) for (const q of t.regs) if (q !== r && q.a > r.a && q.a - 1 < lim) lim = q.a - 1; return lim }
/* the region covers its notes: longer by whole bars when one ends past it (never past the limit) */
function rollGrow (r) {
  const { qb, org, limit } = rollQ(r)
  let end = r.b - 1
  for (const x of r.notes) { const e = org + (x.t + x.d) / qb; if (e > end + 1e-9) end = e }
  const b = Math.min(limit, Math.ceil(end - 1e-9)) + 1
  if (b > r.b) { r.b = b; dirtyReg(r) }
}
const rollSnap = (bar, e) => { if (e && e.ctrlKey && e.shiftKey) return bar; const st = e && e.ctrlKey ? rollStep() / 4 : rollStep(); return Math.round(bar / st) * st }
const rollAt = p => { const g = ROLL.g; return { bar: ROLL.view.a + (p.x - g.x0) / g.pxb, row: Math.floor((p.y - g.top) / g.rowH) } }
const rollKeyOfRow = row => { const g = ROLL.g; return g.kit ? (DRUM_PADS[DRUM_PADS.length - 1 - clamp(row, 0, DRUM_PADS.length - 1)] || DRUM_PADS[0])[1] : clamp(g.hi - row, 0, 127) }
function rollHear (key, v) { if (S.playing) return; syncLive(); playKey(0x90, key, v || ROLL.vel); setTimeout(() => playKey(0x80, key, 0), 160) }
/* a note made at a place (bars from zero) on a key as it sounds; the region is made first where the track has none there */
function rollMake (bar, key, e) {
  let [r, t] = rollReg()
  if (!t || !isInst(t) || t.theirs) return null
  const st = rollStep(), at = Math.max(0, Math.floor(bar / st + 1e-9) * st)
  let made = null
  edit(() => {
    if (!(r && at >= r.a - 1 - 1e-9 && at < rollLimit(r) - 1e-9)) {                      // not where the region shown is or may grow to
      const other = t.regs.find(q => q.notes && at >= q.a - 1 - 1e-9 && at < q.b - 1 - 1e-9)
      if (other) r = other                                                               // another region of notes lies there: it goes into that one
      else {                                                                             // none: a bar of its own, if the lane is free there
        const a = Math.floor(at + 1e-9) + 1
        if (t.regs.some(q => q.a < a + 1 - 1e-9 && q.b > a + 1e-9)) return false
        r = mkReg({ a, b: a + 1, loop: false, notes: [] }); t.regs.push(r)
      }
      S.selR = [r.id]; ROLL.rid = r.id
    }
    const { toQ } = rollQ(r), note = mkNote(toQ(at), Math.max(.05, st * QB()), clamp(key - (r.tr || 0), 0, 127), ROLL.vel)
    setNotes(r, r.notes.concat([note])); rollGrow(r)
    made = note
  })
  if (made) { ROLL.sel = new Set([made.id]); rollHear(key, ROLL.vel); uiDirty('dock', 'lanes') }
  return made
}
function rollDelete (ids) {
  const [r] = rollReg()
  if (!r || !ids.size) return
  edit(() => { setNotes(r, r.notes.filter(x => !ids.has(x.id))) })
  ROLL.sel = new Set(); uiDirty('dock', 'lanes')
}
/* the chosen notes moved by so many quarter notes and so many keys (from the list as it was: `from`) */
function rollMoved (r, from, ids, dq, dn, kit) {
  const { toQ, limit } = rollQ(r), lo = toQ(r.a - 1), hiQ = toQ(limit)
  const sel = from.filter(x => ids.has(x.id))
  if (!sel.length) return from
  dq = clamp(dq, lo - Math.min(...sel.map(x => x.t)), hiQ - .01 - Math.max(...sel.map(x => x.t)))
  const padI = k => DRUM_PADS.findIndex(q => q[1] === k)
  if (kit) { const is = sel.map(x => padI(x.n)).filter(i => i >= 0); if (is.length) dn = clamp(dn, -Math.min(...is), DRUM_PADS.length - 1 - Math.max(...is)) }
  else dn = clamp(dn, -Math.min(...sel.map(x => x.n)), 127 - Math.max(...sel.map(x => x.n)))
  return from.map(x => !ids.has(x.id) ? x : Object.assign({}, x, { t: x.t + dq, n: kit ? (padI(x.n) < 0 ? x.n : DRUM_PADS[padI(x.n) + dn][1]) : x.n + dn }))
}

/* ── hands ── */
function rollDown (e) {
  const el = e.target.closest ? e.target.closest('[data-a="np"]') : null
  if (!el || e.button === 2) return false
  e.preventDefault()
  if (S.menu) { S.menu = null; uiDirty('menu') }
  S.focus = 'notes'
  const k = el.dataset.k, p = pt(e), g = ROLL.g, [r, t] = rollReg(), now = performance.now()
  const hold = d => { ROLL.drag = Object.assign({ x0: p.x, y0: p.y, moved: false }, d); try { svg.setPointerCapture(e.pointerId) } catch (err) {} }
  if (k === 'grid') { openMenu(p.x - 70, g.y - 4, RL_GRIDS.map(v => ({ t: v, v, on: v === ROLL.grid, sep: v === '1/6' })), it => { ROLL.grid = it.v; uiDirty('dock') }, { w: 96 }); return true }
  if (k === 'ruler') { const at = Math.max(0, rollSnap(ROLL.view.a + (p.x - g.x0) / g.pxb, e)); jumpTo(at); uiDirty('dock', 'scenes', 'top'); return true }
  if (k === 'key') { const key = +el.dataset.v; if (g.kit) ROLL.pad = DRUM_PADS.findIndex(q => q[1] === key); ROLL.key = key; syncLive(); playKey(0x90, key, ROLL.vel); hold({ k: 'key', key }); uiDirty('dock'); return true }
  if (!t || !isInst(t)) return true
  const mine = !t.theirs
  if (k === 'note' || k === 'len') {
    const id = +el.dataset.i, x = r && r.notes.find(q => q.id === id)
    if (!x) return true
    const twice = ROLL.last.id === id && now - ROLL.last.at < 420
    ROLL.last = { id, at: now }
    if (g.kit && twice && !e.shiftKey && mine) { rollDelete(new Set([id])); return true }        // a stroke pressed twice goes
    if (e.shiftKey) { if (ROLL.sel.has(id)) ROLL.sel.delete(id); else ROLL.sel.add(id) } else if (!ROLL.sel.has(id)) ROLL.sel = new Set([id])
    ROLL.vel = clamp(x.v, 1, 127)
    const snd = regSound(r).find(q => q.id === id), at = rollAt(p)
    if (snd) rollHear(snd.n, snd.v)
    if (ROLL.sel.has(id) && mine) hold({ k: k === 'len' && !g.kit ? 'len' : 'move', id, from: r.notes, before: editState(), bar0: at.bar, row0: at.row, a0: snd ? snd.a : at.bar, b0: snd ? snd.b : at.bar, copy: e.altKey && k !== 'len', ids: new Set(ROLL.sel) })
    uiDirty('dock'); return true
  }
  if (k === 'vel') {
    if (!r || !mine) return true
    const list = regSound(r).map(x => [Math.abs(g.x0 + (x.a - ROLL.view.a) * g.pxb + 2 - p.x), x]).filter(q => q[0] <= 7).sort((a, b) => a[0] - b[0] || (ROLL.sel.has(b[1].id) ? 1 : 0) - (ROLL.sel.has(a[1].id) ? 1 : 0))
    if (!list.length) return true
    const id = list[0][1].id
    if (!ROLL.sel.has(id)) ROLL.sel = new Set([id])
    hold({ k: 'vel', id, from: r.notes, before: editState(), ids: new Set(ROLL.sel), v0: r.notes.find(q => q.id === id).v })
    rollMove(e); return true
  }
  /* the paper */
  const at = rollAt(p), twice = ROLL.last.id === -1 && now - ROLL.last.at < 420 && Math.hypot(p.x - ROLL.last.x, p.y - ROLL.last.y) < 5
  ROLL.last = { id: -1, at: now, x: p.x, y: p.y }
  if (at.row >= 0 && at.row < g.count && (twice || g.kit || S.tool === 'pencil' || e.metaKey)) { rollMake(at.bar, rollKeyOfRow(at.row), e); ROLL.last = { id: 0, at: 0 }; return true }
  if (!e.shiftKey) ROLL.sel = new Set()
  hold({ k: 'band', base: new Set(ROLL.sel) })
  uiDirty('dock'); return true
}
function rollMove (e) {
  const d = ROLL.drag
  if (!d) return
  const p = pt(e), g = ROLL.g, [r, t] = rollReg()
  if (d.k === 'key') return
  if (!d.moved && d.k !== 'vel' && Math.hypot(p.x - d.x0, p.y - d.y0) < 3) return
  if (d.k === 'band') {
    d.moved = true
    ROLL.band = { x0: d.x0, y0: clamp(d.y0, g.top, g.gb), x1: p.x, y1: clamp(p.y, g.top, g.gb) }
    const xa = Math.min(d.x0, p.x), xb = Math.max(d.x0, p.x), ra = Math.floor((Math.min(d.y0, p.y) - g.top) / g.rowH), rb = Math.floor((Math.max(d.y0, p.y) - g.top) / g.rowH), got = new Set(d.base)
    if (r) for (const x of regSound(r)) { const nx0 = g.x0 + (x.a - ROLL.view.a) * g.pxb, nx1 = g.kit ? nx0 + Math.max(6, rollStep() * g.pxb) : g.x0 + (x.b - ROLL.view.a) * g.pxb, row = g.kit ? DRUM_PADS.length - 1 - DRUM_PADS.findIndex(q => q[1] === x.n) : g.hi - x.n; if (nx1 >= xa && nx0 <= xb && row >= ra && row <= rb) got.add(x.id) }
    ROLL.sel = got; uiDirty('dock'); return
  }
  if (!r) return
  const { qb } = rollQ(r), at = rollAt(p)
  if (d.k === 'move') {
    if (!d.moved && d.copy) {                                                            // option: what is pulled away are copies; the notes themselves stay
      const copies = d.from.filter(x => d.ids.has(x.id)).map(x => mkNote(x.t, x.d, x.n, x.v))
      d.from = d.from.concat(copies); d.ids = new Set(copies.map(x => x.id)); ROLL.sel = new Set(d.ids)
    }
    const to = rollSnap(d.a0 + (at.bar - d.bar0), e), dq = (to - d.a0) * qb, dn = d.row0 - at.row
    setNotes(r, rollMoved(r, d.from, d.ids, dq, dn, g.kit)); rollGrow(r)
    if (dn !== d.dn) { d.dn = dn; const lead = regSound(r).find(x => d.ids.has(x.id)); if (lead && d.moved) rollHear(lead.n, lead.v) }
    d.moved = true
  } else if (d.k === 'len') {
    const end = rollSnap(d.b0 + (at.bar - d.bar0), e), dq = (end - d.b0) * qb, least = Math.min(rollStep() * qb / 4, .0625)
    setNotes(r, d.from.map(x => !d.ids.has(x.id) ? x : Object.assign({}, x, { d: Math.max(least, x.d + dq) }))); rollGrow(r)
    d.moved = true
  } else if (d.k === 'vel') {
    const v = clamp(Math.round((g.base - p.y) / g.room * 127), 1, 127), dv = v - d.v0
    setNotes(r, d.from.map(x => !d.ids.has(x.id) ? x : Object.assign({}, x, { v: clamp(x.id === d.id ? v : x.v + dv, 1, 127) })))
    ROLL.vel = v; say(`velocity ${v}`); d.moved = true
  }
  uiDirty('dock', 'lanes')
}
function rollUp () {
  const d = ROLL.drag
  ROLL.drag = null
  if (!d) return
  if (d.moved) ROLL.last = { id: 0, at: 0 }                                              // (a pull is not the first of two presses)
  if (d.k === 'key') { playKey(0x80, d.key, 0); ROLL.key = null; uiDirty('dock'); return }
  if (d.k === 'band') { ROLL.band = null; uiDirty('dock'); return }
  if (d.moved && d.before) { const [r] = rollReg(); if (r && r.notes !== d.from) commit(d.before); else uiDirty('dock') }
}
/* the wheel over the page: up and down the keys, along the song; a pinch (or command) draws the time nearer about the pointer */
function rollWheel (e) {
  const g = ROLL.g, V = ROLL.view, p = pt(e)
  if (!rollOn() || !g || p.y < g.y || p.y > g.y + g.h || p.x > RX) return false
  e.preventDefault()
  if (e.ctrlKey || e.metaKey) {
    const at = V.a + (p.x - g.x0) / g.pxb, k = Math.exp(e.deltaY * .01), span = clamp((V.b - V.a) * k, .5, 64)
    V.a = at - (at - V.a) * span / (V.b - V.a); V.b = V.a + span
  } else {
    const dx = e.shiftKey ? e.deltaY : e.deltaX, dy = e.shiftKey ? 0 : e.deltaY
    if (Math.abs(dx) > Math.abs(dy)) { const d = dx / g.pxb, span = V.b - V.a; V.a = clamp(V.a + d, -1, SONG_END); V.b = V.a + span }
    else if (!g.kit) { ROLL.wy = (ROLL.wy || 0) + dy; const rows = Math.trunc(ROLL.wy / g.rowH); if (rows) { ROLL.wy -= rows * g.rowH; V.hi = clamp(V.hi - rows, g.count - 1, 127) } }
  }
  uiDirty('dock')
  return true
}
/* the keys, while the page has them */
function rollKey (e) {
  if (!rollOn() || S.focus !== 'notes' || S.menu || S.leave || (typeof START !== 'undefined' && START.on)) return
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return
  const [r] = rollReg(), cmd = e.metaKey && !e.ctrlKey && !e.altKey, plain = !e.metaKey && !e.ctrlKey && !e.altKey, c = e.code, take = () => { e.preventDefault(); e.stopImmediatePropagation() }
  if ((c === 'Backspace' || c === 'Delete') && plain) { take(); if (!e.repeat) rollDelete(new Set(ROLL.sel)); return }
  if (c === 'Escape' && plain && ROLL.sel.size) { take(); ROLL.sel = new Set(); uiDirty('dock'); return }
  if (!r) return
  if (cmd && c === 'KeyA' && !e.shiftKey) { take(); ROLL.sel = new Set(r.notes.map(x => x.id)); uiDirty('dock'); return }
  if (cmd && (c === 'KeyC' || c === 'KeyX') && !e.shiftKey) {
    take()
    const sel = r.notes.filter(x => ROLL.sel.has(x.id))
    if (!sel.length) return
    const t0 = Math.min(...sel.map(x => x.t))
    ROLL.clip = sel.map(x => ({ dt: x.t - t0, d: x.d, n: x.n, v: x.v })); say(`${sel.length} ${sel.length === 1 ? 'note' : 'notes'} ${c === 'KeyX' ? 'cut' : 'copied'}`)
    if (c === 'KeyX') rollDelete(new Set(ROLL.sel))
    return
  }
  if (cmd && c === 'KeyV' && !e.shiftKey) {
    take()
    if (!ROLL.clip || !ROLL.clip.length) return
    const { toQ, limit } = rollQ(r), at = clamp(rollSnap(curPos()), r.a - 1, limit - rollStep()), made = ROLL.clip.map(x => mkNote(toQ(at) + x.dt, x.d, x.n, x.v))
    edit(() => { setNotes(r, r.notes.concat(made)); rollGrow(r) })
    ROLL.sel = new Set(made.map(x => x.id)); uiDirty('dock', 'lanes'); return
  }
  if (e.altKey && !e.metaKey && !e.ctrlKey && /^Arrow/.test(c) && ROLL.sel.size) {
    take()
    const up = c === 'ArrowUp' ? 1 : c === 'ArrowDown' ? -1 : 0, along = c === 'ArrowRight' ? 1 : c === 'ArrowLeft' ? -1 : 0, kit = ROLL.g && ROLL.g.kit
    edit(() => { setNotes(r, rollMoved(r, r.notes, ROLL.sel, along * rollStep() * QB(), up * (e.shiftKey && !kit ? 12 : 1), kit)); rollGrow(r) })
    if (up) { const lead = regSound(r).find(x => ROLL.sel.has(x.id)); if (lead) rollHear(lead.n, lead.v) }
    uiDirty('dock', 'lanes')
  }
}
/* the page comes and goes with a height of its own (the keys want more room than a patch does) */
function rollSync () {
  const on = rollOn()
  if (on === ROLL.shown) return
  ROLL.shown = on
  if (on) { ROLL.hOther = S.panel.h; S.panel.h = ROLL.h } else { ROLL.h = S.panel.h; S.panel.h = ROLL.hOther; if (S.focus === 'notes') S.focus = 'lanes' }
  relayout(); dirtyAll()
}
function rollOpen () { if (!rollOn()) { S.panel.on = true; S.panel.tab = 'notes'; closePicker(); setView() } rollSync(); S.focus = 'notes'; uiDirty('dock', 'top') }

/* ── joined to the room ── */
{
  const down0 = onDown, move0 = onMove, up0 = onUp, wheel0 = onWheel, dock0 = PARTS.dock, toggle0 = togglePanel, flush0 = flush
  PARTS.dock = function () {
    if (!rollOn() || VIEW.p <= .001) return dock0()
    const y = BY, h = S.panel.h
    MGEOM = null
    return R(0, y, RX, h + 2, { fill: K1 }) + pRoll(y + PH, h - PH) + rollHead(y)
  }
  togglePanel = function (tab) { toggle0(tab); rollSync() }
  onDown = function (e) {
    const el = e.target.closest ? e.target.closest('[data-a]') : null, a = el ? el.dataset.a : ''
    if (a === 'tab-notes') { e.preventDefault(); rollOpen(); return }
    if (rollDown(e)) return
    down0(e)
    if (a === 'tab-patch' || a === 'tab-mixer' || a === 'tab-notes' || a === 'patch' || a === 'mixer') rollSync()
    else if (a === 'lanes' && !e.button) {                                               // a region of notes pressed twice: its notes
      const p = pt(e), ti = laneAt(p.y), r = (p.y - TY + VY) < rows().length * S.rh ? hitRegion(ti, barAt(p.x)) : null, now = performance.now()
      if (r && r.notes && ROLL.lastReg && ROLL.lastReg.id === r.id && now - ROLL.lastReg.at < 420) { ROLL.lastReg = null; if (!rollOn()) rollOpen(); else { S.focus = 'notes'; uiDirty('dock') } }
      else ROLL.lastReg = r && r.notes ? { id: r.id, at: now } : null
    }
  }
  onMove = function (e) { if (ROLL.drag) { rollMove(e); return } move0(e) }
  onUp = function (e) { if (ROLL.drag) { rollUp(); return } up0(e) }
  onWheel = function (e) { if (!rollWheel(e)) wheel0(e) }
  addEventListener('keydown', rollKey, true)
  KEYS.KeyP = () => { if (rollOn()) togglePanel('notes'); else rollOpen() }
  /* held keys of the keyboard are shown on the page's own keys; while the song runs its playhead is carried along */
  flush = function () { if (rollOn() && dirty.has('keys')) dirty.add('dock'); flush0() }
  setInterval(() => { if (!rollOn() || !S.playing || !ROLL.g) return; const el = document.getElementById('np-ph'), g = ROLL.g; if (!el) return; const x = g.x0 + (curPos() - ROLL.view.a) * g.pxb; el.setAttribute('transform', `translate(${n(x)} 0)`); el.setAttribute('visibility', x >= g.x0 && x <= g.x1 ? 'visible' : 'hidden') }, 33)
}
