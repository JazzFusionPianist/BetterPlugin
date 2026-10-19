/* ── terminal: the room as a terminal on a screen (design/themes draft 2, sheet 6) ──
   Over the room the screen's first lines: its name inverse and its tabs, where the song is in large figures, the
   transport as words in brackets, its switches as words, the out in two rows of blocks. At its foot a status line,
   inverse. The tracks and the arrangement each in a frame with its title set into the line; a track a line of text, its
   level in blocks; a marker ├ and its name; the cycle in brackets, doubled; the playhead a ▼ and a line; the sound in
   blocks; the mixer a pane of text, a line to a strip. The face has no blocks or box lines of its own, so they are drawn,
   on the face's own grid. */
const TM = { sig: '', mw: 0, ow: 0 }
const tmCw = (size = 11) => tw('0', size)
const tmT = (x, y, s, o = {}) => T(x, y, s, Object.assign({ size: 11, x: ' xml:space="preserve"' }, o))
const tmInv = (x, y, s, size = 11) => R(x - 1, y - size * .86, tw(s, size) + 2, size * 1.2, { fill: INK }) + tmT(x, y, s, { size, c: K0 })
/* a row of blocks: as much of it full as f says (to an eighth of a cell), the rest shaded */
const tmBlocks = (x, y, cells, f, cw, h, id) => { const w = cells * cw, q = Math.round(clamp(f, 0, 1) * cells * 8) / (cells * 8); return R(x, y, w, h, { fill: 'url(#tm-shade)' }) + R(x, y, w * q, h, { fill: INK, x: id ? ` id="${id}"` : '' }) }
const tmDb = v => `${v > 0 ? '+' : ''}${fmtDb(v)}`
/* a key of the transport: [▶] play, inverse when on */
function tmKey (x, y, kind, word, on, a) {
  const cw = tmCw(11), w = cw * (5 + word.length), gx = x + cw * 2, gy = y - 4, c = on ? K0 : INK
  const glyph = kind === 'play' ? P(`M${n(gx - 3)} ${gy - 4}L${n(gx + 4)} ${gy}L${n(gx - 3)} ${gy + 4}Z`, { fill: c }) : kind === 'stop' ? R(gx - 3.5, gy - 3.5, 7, 7, { fill: c }) : kind === 'rec' ? Cc(gx, gy, 3.8, { fill: on ? K0 : REC }) : P(`M${n(gx - 4)} ${gy - 4}V${gy + 4}M${n(gx + 4)} ${gy - 4}L${n(gx - 2)} ${gy}L${n(gx + 4)} ${gy + 4}Z`, { stroke: c, fill: c, sw: 1.2 })
  return [(on ? R(x - 2, y - 10, w + 4, 14, { fill: INK }) : '') + tmT(x, y, '[  ] ' + word, { c }) + glyph + hit(x - 3, y - 13, w + 6, 18, a), w]
}
/* the frames: the tracks, the arrangement, the panel; laid over everything, the pointer passes through them */
function tmFrames () {
  const box = (x0, y0, x1, y1, title) => x1 - x0 < 40 || y1 - y0 < 20 ? '' : R(x0 + .5, y0 + .5, x1 - x0 - 1, y1 - y0 - 1, { stroke: INK, sa: .75 }) + (title ? R(x0 + 12, y0 - 6, tw(` ${title} `, 11) + 2, 12, { fill: K1 }) + tmT(x0 + 13, y0 + 4, ` ${title} `) : '')
  const y0 = MK_Y + 1, y1 = BY - 3, right = SKIN.right
  let s = right ? box(X1 + 3, y0, RX - 4, y1, 'tracks') + box(4, y0, X1 - 2, y1, 'arrange') : box(4, y0, X0 - 3, y1, 'tracks') + box(X0 + 2, y0, RX - 4, y1, 'arrange')
  if (VIEW.p > .5) s += box(4, BY + PH + 6, RX - 4, BY + S.panel.h - 3, S.panel.tab)
  return s
}
const tmSig = () => [W, H, X0, X1, RX, MK_Y, BY, VIEW.p > .5, S.panel.tab, S.panel.h, SKIN.right].join()

SKINS.top.terminal = () => {
  const h = SKIN_BANDS.terminal[0], cw = tmCw(11), x0 = 22
  let s = R(0, 0, W, h, { fill: K1 })
  /* the first line: the name, the tabs; at the right the song's name, tempo, metre, key */
  s += tmInv(x0, 22, ' slur studio ')
  let x = x0 + tw(' slur studio ', 11) + cw * 3
  const now = !S.panel.on ? 'arrange' : S.panel.tab
  const tabs = [['arrange', 'arrange'], ['mixer', 'mixer'], ['patch', 'patch']].concat(typeof pRoll === 'function' ? [['notes', 'tab-notes']] : [], typeof pPrompt === 'function' ? [['prompt', 'tab-prompt']] : [])
  tabs.forEach(([t, a], k) => { const w = `${k + 1}:${t}${now === t ? '*' : ''}`; s += tmT(x, 22, w, { a: now === t ? 1 : .75 }) + hit(x - 4, 8, tw(w, 11) + 8, 20, a); x += tw(w, 11) + cw * 2 })
  let rx = W - 22
  const right = (w, a, field, al = .8) => { const ww = tw(w, 11); s += tmT(rx - ww, 22, w, { a: al }); if (a) { s += hit(rx - ww - 4, 8, ww + 8, 20, a); SKV.field[field || a] = { x: rx - ww - 4, y: 8, w: Math.max(60, ww + 8), h: 20 } } rx -= ww + cw * 3 }
  right(S.key || '—', 'key'); right(meterName(), 'meter'); right(`${(+S.tempo).toFixed(2)} bpm`, 'tempo')
  if (typeof PROJ === 'object' && PROJ.name) right(fit(asGiven(PROJ.name), 240, 11), null, null, .6)
  /* where the song is, in large figures */
  const p = curPos(), c30 = tmCw(30), c20 = tmCw(20)
  s += tmT(x0, 66, readout(p), { size: 30, w: 500, x: ' xml:space="preserve" id="tm-pos"' }) + hit(x0 - 4, 38, c30 * 7.5, 34, 'pos')
  SKV.field.pos = { x: x0, y: 42, w: c30 * 7, h: 28 }
  const tx = x0 + c30 * 7.5
  s += tmT(tx, 66, clock(p), { size: 20, a: .85, x: ' xml:space="preserve" id="tm-time"' })
  /* the transport as words */
  let kx = tx + c20 * 8 + 24
  for (const [kind, word, on, a] of [['play', 'play', S.playing && !S.rec, 'play'], ['stop', 'stop', false, 'stop'], ['rec', 'rec', !!S.rec, 'rec'], ['start', 'start', false, 'tostart']]) { const [g, w] = tmKey(kx, 52, kind, word, on, a); s += g; kx += w + cw * 2 }
  /* its switches */
  const c = S.cycle, p3 = v => String(Math.round(v + 1)).padStart(3, '0')
  let sx = tx + c20 * 8 + 24
  for (const [w, on, a] of [[c.on ? `cycle [${p3(c.a)}-${p3(c.b)}]` : 'cycle off', c.on, 'loop'], [`click ${S.click ? 'on' : 'off'}`, !!S.click, 'click'], [`low lat ${S.lowLat ? 'on' : 'off'}`, !!S.lowLat, 'lowlat'], [`nudge ${S.nudge}`, true, 'nudge'], [`grid ${S.grid}`, true, 'grid']]) {
    const ww = tw(w, 11); s += tmT(sx, 74, w, { a: on ? .95 : .6 }) + hit(sx - 4, 62, ww + 8, 18, a); SKV.field[a] = { x: sx - 4, y: 62, w: ww + 8, h: 18 }; sx += ww + cw * 3
  }
  /* the out: two rows of blocks, its level */
  const mw = cw * 18, mx = W - 22 - cw * 7 - mw, lvl = tmDb(S.master)
  TM.ow = mw
  s += tmT(W - 22, 44, 'out', { a: .55, anchor: 'end' })
  for (let k = 0; k < 2; k++) { const y = 50 + k * 13; s += R(mx, y, mw, 9, { fill: 'url(#tm-shade)' }) + G(R(0, 0, 0, 9, { fill: INK, x: ` id="mm-${k ? 'r' : 'l'}"` }), `translate(${n(mx)} ${y}) scale(${n(mw / METER_W)} 1)`) }
  s += tmT(W - 22, 59, lvl, { anchor: 'end' }) + hit(mx - 4, 46, W - 18 - mx + 4, 30, 'master', '', 'ns-resize')
  s += `<g id="tm-frames" pointer-events="none">${tmFrames()}</g>`; TM.sig = tmSig()
  return s
}
/* the status line, inverse */
SKINS.foot.terminal = y0 => {
  const cw = tmCw(11), y = y0 + 17, word = !S.panel.on ? 'ARRANGE' : S.panel.tab.toUpperCase()
  let s = R(0, y0, W, DECK_H, { fill: K1 }) + R(14, y0 + 6, W - 28, 15, { fill: INK })
  const parts = [word, toolWord(S.tool), S.mode, `grid ${S.grid}`, `nudge ${S.nudge}`, `cycle ${S.cycle.on ? 'on' : 'off'}`, `click ${S.click ? 'on' : 'off'}`]
  s += tmT(20, y, parts.join('  |  '), { c: K0 })
  const p = curPos()
  s += tmT(W - 20, y, `track ${pad2(S.sel + 1)}/${pad2(S.tracks.length)}   bar ${Math.floor(p) + 1}`, { c: K0, anchor: 'end', x: ' xml:space="preserve" id="tm-bar"' })
  return s
}
SKINS.frame.terminal = p => {
  const set = (id, t) => { const el = $(id); if (el && el.textContent !== t) el.textContent = t }
  set('tm-pos', readout(p)); set('tm-time', clock(p))
  const bar = $('tm-bar')
  if (bar) { const t = `track ${pad2(S.sel + 1)}/${pad2(S.tracks.length)}   bar ${Math.floor(p) + 1}`; if (bar.textContent !== t) { bar.textContent = t; bar.setAttribute('x', n(W - 20 - tw(t, 11))) } }
  /* the mixer's meters, in blocks */
  if (TM.mw && typeof METERS === 'object') {
    const w = v => n(TM.mw * volF(Math.min(6, linDb(v))))
    for (const t of S.tracks) { const el = $('tmm-' + t.id); if (el) el.setAttribute('width', w(METERS.now.get(t.id) || 0)) }
    const m = $('tmm-M'); if (m) m.setAttribute('width', w(Math.max(METERS.mm[0], METERS.mm[1])))
  }
  if (SKIN.k.transport === 'terminal') { const sig = tmSig(); if (sig !== TM.sig) { const el = $('tm-frames'); if (el) { el.innerHTML = tmFrames(); TM.sig = sig } } }
}

/* ── a track: a line of text — its number and name, m s r, its level in blocks and in figures ── */
SKINS.head.terminal = i => {
  const t = S.tracks[i], rh = rowH(i), y = rowY(i), sel = isChosen(i), cw = tmCw(11), x0 = 16, two = t.theirs && rh >= 30, base = y + rh / 2 + 4 - (two ? 5 : 0)
  let s = sel ? R(0, y, HEAD_W, rh, { fill: lkC('heads.chosen'), fa: lkA('heads.chosen') }) : ''
  const nm = (t.parent ? '  ' : '') + asGiven(t.name)
  s += tmT(x0, base, pad2(i + 1), { a: .6 }) + tmT(x0 + cw * 3, base, fit(nm, cw * 9.5, 11), { a: heard(t) ? 1 : .5 })
  if (two) s += tmT(x0 + cw * 4, base + 12, `with ${t.theirs}`, { size: 9.5, a: .45 })
  s += hit(0, y, x0 + cw * 13, rh, 'sel', ` data-i="${i}"`)
  let x = x0 + cw * 13
  for (const it of cellsOf(t)) { s += (it.on ? tmInv(x, base, it.t) : tmT(x, base, it.t, { a: .4 })) + hit(x - 3, y + 2, cw + 6, rh - 4, it.a, ` data-i="${i}"`); x += cw * 2 }
  const v = shown(t, 'vol'), lx = x0 + cw * 21, by = base - 8
  s += tmBlocks(lx, by, 10, volF(v), cw, 9) + tmT(lx + cw * 11, base, tmDb(v), { a: .85 })
  s += G(R(0, 0, 0, 1.5, { fill: LEVEL, x: ` id="mt-${t.id}"` }), `translate(${n(lx)} ${n(by + 11)}) scale(${n(cw * 10 / HEAD_FW)} 1)`)      // (as loud as it is now: the room's own meter, under the level)
  s += hit(lx - 4, y + 1, cw * 17 + 8, rh - 2, 'vol', ` data-i="${i}" data-rel="1"`, 'ew-resize')
  return s
}
/* ── a marker: ├ and its name ── */
SKINS.scenes.terminal = () => {
  const y = MK_Y, cur = sceneAt(curPos()).i
  let s = R(0, y, RX, MK_H, { fill: K1 }), g = '', hits = hit(X0, y, X1 - X0, MK_H, 'scenebar', '', 'default')
  SCENES.forEach((sc, i) => {
    const xa = bx(sc.a), xb = bx(sc.b), xl = Math.max(xa, X0), xr = Math.min(xb, X1)
    if (xr - xl < 1) return
    if (xa >= X0 - 1) g += P(`M${n(xa) + .5} ${y + 6}V${y + MK_H}M${n(xa) + .5} ${y + 12.5}H${n(xa) + 5}`, { stroke: INK, sw: 1.2 })
    const nm = fit(asGiven(sc.name), Math.max(8, xr - xl - 12), 11)
    g += S.focus === 'marker' && S.selM === sc.a ? tmInv(xl + 7, y + 16, nm) : tmT(xl + 7, y + 16, nm, { a: i === cur ? 1 : .78 })
    hits += hit(xl, y + 2, xr - xl, MK_H - 4, 'scene', ` data-i="${i}"`)
  })
  return s + G(g, '', TL) + hits
}
/* ── the cycle: [════] ── */
SKINS.cycle.terminal = (ca, cb, y, on) => {
  const a = on ? .95 : .35, l = n(ca), r = n(cb)
  return P(`M${l + 4} ${y + .5}H${l + .5}V${y + 7.5}H${l + 4}M${r - 4} ${y + .5}H${r - .5}V${y + 7.5}H${r - 4}`, { stroke: INK, sa: a, sw: 1.2 }) + P(`M${l + 3} ${y + 2.5}H${r - 3}M${l + 3} ${y + 5.5}H${r - 3}`, { stroke: INK, sa: a })
}
/* ── the playhead: ▼ and a line ── */
SKINS.play.terminal = (c, w) => {
  const y = RU_Y + RU_CY
  return P(`M-5 ${y}H5L0 ${y + 8}Z`, { fill: c }) + R(-.6, y + 8, 1.2, Math.max(0, BY - y - 8), { fill: c }) + hit(-10.5, y - 2, 22, RU_H - RU_CY + 2, 'playhead', '', 'ew-resize')
}
/* ── the sound in blocks: a cell of four pixels to a block, an eighth of the height to a step; under the middle the
   same, shaded ── */
SKINS.sound.terminal = (steps, hOf, yc, hmax, half) => {
  const cw = 4, q = hmax / 8
  let d = ''
  for (let c = 0; c * cw < steps; c++) {
    let m = 0
    for (let i = c * cw; i < Math.min(steps, (c + 1) * cw); i++) m = Math.max(m, hOf(i))
    const h = Math.round(m / q) * q
    if (h < .5) continue
    const x = c * cw
    d += `M${x} ${n(yc - h)}h3v${n(h)}h-3Z`
    if (!half) for (let yy = yc + 1; yy < yc + h * .85; yy += 2) d += `M${x} ${n(yy)}h3v1h-3Z`
  }
  return d || 'M0 0'
}
/* ── the mixer: a pane of text, a line to a strip ── */
SKINS.mixer.terminal = (y, h) => {
  const vis = rows(), cw = tmCw(11), row = 16, x0 = 22, mw = cw * 18
  const fitN = Math.max(1, Math.floor((h - 46) / row) - 1)
  S.panel.mx = clamp(S.panel.mx, 0, Math.max(0, vis.length - fitN))
  const list = vis.slice(S.panel.mx, S.panel.mx + fitN)
  const col = { name: x0, level: x0 + cw * 11, db: x0 + cw * 34, pan: x0 + cw * 42, meter: x0 + cw * 59, cells: x0 + cw * 80, out: x0 + cw * 90, fx: x0 + cw * 104 }
  TM.mw = mw
  let s = R(0, y, RX, h, { fill: K1 })
  const hy = y + 28
  for (const [k, w, end] of [['name', 'strip'], ['level', 'level'], ['db', 'db', true], ['pan', 'pan'], ['meter', 'meter'], ['cells', 'r i m s'], ['out', 'out'], ['fx', 'fx']]) if (col[k] < RX - 40) s += tmT(end ? col[k] + cw * 5 : col[k], hy, w, { a: .5, anchor: end ? 'end' : 'start' })
  if (fitN < vis.length) s += tmT(RX - 22, hy, `${S.panel.mx + 1}-${S.panel.mx + list.length} of ${vis.length}`, { a: .5, anchor: 'end' })
  const line = (k, t, i, master) => {
    const yb = hy + row * (k + 1) + 2, mid = yb - 4, di = ` data-i="${i}"`, vol = master ? S.master : shown(t, 'vol')
    let o = ''
    if (!master && isChosen(i)) o += R(x0 - 8, yb - 12, RX - 2 * x0 + 16, row, { fill: INK, fa: .08 })
    o += tmT(col.name, yb, fit((t.parent ? '  ' : '') + asGiven(t.name), cw * 10, 11), { a: master || heard(t) ? 1 : .5 }) + (master ? '' : hit(col.name - 4, yb - 12, cw * 10 + 8, row, 'msel', di))
    const lw = cw * 21, f = volF(vol), lx = col.level
    o += R(lx, mid - 1, lw * f, 2, { fill: INK }) + R(lx + lw * f, mid - .5, lw * (1 - f), 1, { fill: INK, fa: .55 }) + Cc(lx + lw * f, mid, 3.2, { fill: INK })
    o += master ? hit(lx - 4, yb - 12, lw + 8, row, 'master', '', 'ns-resize') : hit(lx - 4, yb - 12, lw + 8, row, 'vol', `${di} data-rel="1"`, 'ew-resize')
    o += tmT(col.db + cw * 5, yb, tmDb(vol), { anchor: 'end' }) + hit(col.db - 4, yb - 12, cw * 5 + 8, row, 'volnum', master ? ' data-i="-1"' : di, 'default')
    if (!master) {
      const pw = cw * 15, px = col.pan, pan = shown(t, 'pan') || 0, xp = px + 6 + (pw - 12) * (pan + 1) / 2
      o += P(`M${n(px)} ${mid}l4 -2.6v5.2zM${n(px + pw)} ${mid}l-4 -2.6v5.2z`, { fill: INK, fa: .7 }) + R(px + 4, mid - .5, pw - 8, 1, { fill: INK, fa: .55 }) + P(`M${n(px + pw / 2) + .5} ${mid - 3}V${mid + 3}`, { stroke: INK, sa: .4 }) + P(`M${n(xp)} ${mid - 5.5}V${mid + 5.5}M${n(xp - 3)} ${mid}H${n(xp + 3)}`, { stroke: INK, sw: 1.4 })
      o += hit(px - 3, yb - 12, pw + 6, row, 'mpan', `${di} data-x="${n(px + 6)}" data-pw="${n(pw - 12)}"`, 'ew-resize')
    }
    if (col.meter + mw < RX - 20) o += R(col.meter, mid - 4, mw, 8, { fill: 'url(#tm-shade)' }) + R(col.meter, mid - 4, 0, 8, { fill: INK, x: ` id="tmm-${master ? 'M' : t.id}"` })
    if (!master && col.cells < RX - 60) { let x = col.cells; for (const it of cellsOf(t)) { o += (it.on ? R(x, mid - 3.5, 7, 7, { fill: it.t === 'r' ? REC : INK }) : R(x + .5, mid - 3, 6, 6, { stroke: INK, sa: .7 })) + hit(x - 3, yb - 12, 13, row, it.a, di); x += cw * 2 } }
    if (!master && col.out < RX - 80) o += tmT(col.out, yb, fit(asGiven(outName(t)), cw * 12, 11), { a: .75 }) + hit(col.out - 4, yb - 12, cw * 12 + 8, row, 'mout', di)
    if (!master && col.fx < RX - 80) { const its = (typeof fxItems === 'function' ? fxItems(t) : (t.inserts || []).map(x => ({ t: x.name }))).map(it => asGiven(it.t)); o += tmT(col.fx, yb, its.length ? fit(its.join('  '), RX - 22 - col.fx, 11) : '-', { a: its.length ? .85 : .35 }) + hit(col.fx - 4, yb - 12, RX - 22 - col.fx + 8, row, 'm-patch', di) }
    return o
  }
  list.forEach((i, k) => { s += line(k, S.tracks[i], i, false) })
  const my = hy + row * (list.length + 1) + 6
  s += R(x0, my - 2, RX - 2 * x0, 1, { fill: INK, fa: .3 }) + line(list.length + .6, MASTER(), -1, true)
  return s
}
