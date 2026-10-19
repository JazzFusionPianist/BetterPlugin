/* ── cassette: a tape deck of the eighties (design/themes draft 2, sheet 2) ──
   Over the room the deck: the cassette in its window (its reels turn as the song goes, the tape passes from one to the
   other), an LCD with seven-segment figures, six piano keys, the maker's name and its switches as pills with lights;
   under it the stripes. At its foot the out, lit as a deck's display is. The heads at the right, each a cassette's
   spine: its colour, its number, its name typed, a row of lights, pills for its buttons. The markers a J-card; the
   cycle a stripe; the mixer a slider and a column of lights to a strip. The deck's labels are set in the room's face,
   wide; the names typed in the theme's face for names. */
const CS = { body0: '#F1E8D6', body1: '#DCCFB4', dark: '#2E2620', card: '#FBF6EA', edge: '#D9CCB0', orange: '#E4572E', amber: '#F3A712', teal: '#2A9D8F', navy: '#264653', red: '#D62828', green: '#4CAF50', lcd0: '#B4C29D', lcd1: '#97A882', seg: '#1C2616', label: '#6A5E52' }
const CSX = { lcd: '', turn: 0, at: 0, hw: new Map(), v: new Map(), lcdAt: null, reels: null, fw: 0 }
/* words as the deck's front has them: the room's face, wide, spaced */
const csTx = (x, y, s, o = {}) => `<text x="${n(x)}" y="${n(y)}" font-family="${FONT}" font-size="${n((o.size || 6.4) * TF.scale)}" font-weight="${o.w || 600}" font-stretch="${o.stretch || 'expanded'}" letter-spacing="${o.ls == null ? 1 : o.ls}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''} fill="${o.c || CS.label}"${o.a != null && o.a < 1 ? ` fill-opacity="${o.a}"` : ''}${o.x || ''}>${esc(s)}</text>`
function csDefs () {
  return `<defs>
    <linearGradient id="cs-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${CS.body0}"/><stop offset="1" stop-color="${CS.body1}"/></linearGradient>
    <linearGradient id="cs-lcd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${CS.lcd0}"/><stop offset="1" stop-color="${CS.lcd1}"/></linearGradient>
    <linearGradient id="cs-key" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5A4C40"/><stop offset=".85" stop-color="#3A3029"/><stop offset="1" stop-color="#231C17"/></linearGradient>
    <linearGradient id="cs-keyred" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E24B3B"/><stop offset="1" stop-color="#9E1F18"/></linearGradient>
    <linearGradient id="cs-win" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3A322C"/><stop offset="1" stop-color="#1A1512"/></linearGradient>
    <linearGradient id="cs-shine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".2"/><stop offset=".4" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
    <radialGradient id="cs-pack" cx=".5" cy=".5" r=".5"><stop offset=".3" stop-color="#5A4030"/><stop offset=".95" stop-color="#2A1C14"/><stop offset="1" stop-color="#1A110C"/></radialGradient>
    <pattern id="cs-rib" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="1.4" fill="#000" fill-opacity=".06"/></pattern>
    <filter id="cs-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.4"/></filter>
  </defs>`
}
/* seven segments, leaning as an LCD's do; the ones that are off still faintly there */
const CS_SEGS = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '' }
function csSeg (x, y, h, ch, col = CS.seg) {
  const w = h * .5, t = h * .1, sk = h * .07, g = t * .4
  const at = (x0, y0) => [x + x0 + sk * (1 - y0 / h), y + y0]
  const hz = y0 => { const [a1, b1] = at(t * .6 + g, y0), [a2, b2] = at(w - t * .6 - g, y0); return `M${n(a1)} ${n(b1)}L${n(a1 + t * .5)} ${n(b1 - t / 2)}L${n(a2 - t * .5)} ${n(b2 - t / 2)}L${n(a2)} ${n(b2)}L${n(a2 - t * .5)} ${n(b2 + t / 2)}L${n(a1 + t * .5)} ${n(b1 + t / 2)}Z` }
  const vt = (x0, y0, y1) => { const [a1, b1] = at(x0, y0 + g + t * .5), [a2, b2] = at(x0, y1 - g - t * .5); return `M${n(a1)} ${n(b1 - t * .5)}L${n(a1 + t / 2)} ${n(b1)}L${n(a2 + t / 2)} ${n(b2)}L${n(a2)} ${n(b2 + t * .5)}L${n(a2 - t / 2)} ${n(b2)}L${n(a1 - t / 2)} ${n(b1)}Z` }
  const sg = { a: hz(t / 2), g: hz(h / 2), d: hz(h - t / 2), f: vt(t / 2, 0, h / 2), b: vt(w - t / 2, 0, h / 2), e: vt(t / 2, h / 2, h), c: vt(w - t / 2, h / 2, h) }
  const on = CS_SEGS[ch] || ''
  let lit = '', dim = ''
  for (const k of 'abcdefg') if (on.includes(k)) lit += sg[k]; else dim += sg[k]
  return P(dim, { fill: col, fa: .06 }) + P(lit, { fill: col, fa: .9 })
}
function csNum (x, y, h, str, col) {
  let s = '', cx = x
  for (const ch of String(str)) {
    if (ch === '.') { s += R(cx - h * .02, y + h - h * .1, h * .09, h * .09, { fill: col || CS.seg, fa: .9 }); cx += h * .18; continue }
    if (ch === ':') { s += R(cx + h * .02, y + h * .28, h * .08, h * .08, { fill: col || CS.seg, fa: .9 }) + R(cx, y + h * .66, h * .08, h * .08, { fill: col || CS.seg, fa: .9 }); cx += h * .18; continue }
    s += csSeg(cx, y, h, CS_SEGS[ch] != null ? ch : ' ', col); cx += h * .6
  }
  return s
}
const csNumW = (h, str) => [...String(str)].reduce((a, ch) => a + (ch === '.' || ch === ':' ? h * .18 : h * .6), 0)
/* a reel: its pack of tape, its hub and its spokes (the spokes turn) */
const csReel = (x, y, id) => Cc(x, y, 20, { fill: 'url(#cs-pack)', x: ` id="${id}-p"` }) + Cc(x, y, 9, { fill: '#F0E9DC' }) + G(Cc(0, 0, 4.6, { fill: '#2B231E' }) + [0, 1, 2, 3, 4, 5].map(k => { const a = k * Math.PI / 3; return P(`M${n(4.6 * Math.cos(a - .2))} ${n(4.6 * Math.sin(a - .2))}L${n(2 * Math.cos(a))} ${n(2 * Math.sin(a))}L${n(4.6 * Math.cos(a + .2))} ${n(4.6 * Math.sin(a + .2))}Z`, { fill: '#F0E9DC' }) }).join(''), `translate(${n(x)} ${n(y)}) rotate(${n(CSX.turn)})`, ` id="${id}"`)
/* a pill with a light */
function csBtn (x, y, w, h, label, on, col, a, more = '') {
  const lamp = on != null
  return R(x, y + 1.2, w, h, { rx: h / 2, fill: '#000', fa: .2 }) + R(x, y, w, h, { rx: h / 2, fill: '#3C332C' }) + R(x + 1.5, y + .8, w - 3, h * .42, { rx: h / 2, fill: '#FFFFFF', fa: .09 })
    + csTx(x + w / 2 + (lamp ? 3 : 0), y + h / 2 + 2.3, label, { size: 6.2, c: '#EDE3CF', anchor: 'middle', ls: .5 })
    + (lamp ? Cc(x + 6, y + h / 2, 1.7, { fill: on ? col : '#5A4E44' }) + (on ? Cc(x + 6, y + h / 2, 3.6, { fill: col, fa: .6, x: ' filter="url(#cs-glow)"' }) : '') : '')
    + (a ? hit(x - 2, y - 3, w + 4, h + 6, a, more) : '')
}
/* a row (or a column) of lights: green, then amber, then red; those lit are a clip the frame moves */
function csLeds (x, y, w, h, N, id, vertical) {
  const seg = on => {
    let o = ''
    const sw = ((vertical ? h : w) - (N - 1) * 1.2) / N
    for (let k = 0; k < N; k++) { const f = (k + 1) / N, c = f > .87 ? CS.red : f > .7 ? CS.amber : CS.green; o += vertical ? R(x, y + h - (k + 1) * sw - k * 1.2, w, sw, { rx: .5, fill: c, fa: on ? .92 : .13 }) : R(x + k * (sw + 1.2), y, sw, h, { rx: .5, fill: c, fa: on ? .92 : .13 }) }
    return o
  }
  return seg(false) + `<clipPath id="${id}-c"><rect id="${id}" x="${n(x)}" y="${n(vertical ? y + h : y)}" width="${vertical ? n(w) : 0}" height="${vertical ? 0 : n(h)}"/></clipPath>` + G(seg(true), '', ` clip-path="url(#${id}-c)"`)
}
/* what the LCD says: drawn again when it changes */
function csLcd (p) {
  const { x, y } = CSX.lcdAt, lab = (xx, yy, t, on = true) => csTx(xx, yy, t, { size: 5.8, c: CS.seg, a: on ? .8 : .14, ls: .7 })
  let s = lab(x + 10, y + 11, 'BAR') + csNum(x + 10, y + 15, 32, readout(p))
  s += lab(x + 190, y + 11, 'TIME') + csNum(x + 190, y + 15, 18, clock(p))
  s += lab(x + 190, y + 46, 'TEMPO') + csNum(x + 190, y + 50, 13, (+S.tempo).toFixed(2)) + lab(x + 252, y + 61, 'BPM')
  s += lab(x + 10, y + 61, 'CYCLE', S.cycle.on) + lab(x + 44, y + 61, 'CLICK', !!S.click) + lab(x + 78, y + 61, 'LOW LAT', !!S.lowLat) + lab(x + 122, y + 61, meterName())
  s += lab(x + 220, y + 80, 'REC', !!S.rec) + lab(x + 246, y + 80, 'PLAY', S.playing) + P(`M${x + 274} ${y + 75}l5 2.6l-5 2.6z`, { fill: CS.seg, fa: S.playing ? .8 : .14 })
  return s
}
const csLcdSig = p => [readout(p), clock(p), S.tempo, S.cycle.on, S.click, S.lowLat, S.meter, S.rec, S.playing].join()

SKINS.top.cassette = () => {
  const DH = SKIN_BANDS.cassette[0] - 12
  let s = csDefs() + R(0, 0, W, DH, { fill: 'url(#cs-body)' }) + R(0, 0, W, 6, { fill: 'url(#cs-rib)' }) + R(0, DH - 1, W, 1, { fill: '#000', fa: .15 })
  /* the cassette in its window */
  const wx = 16, wy = 12, ww = 236, wh = 88, kx = wx + 12, ky = wy + 9, kw = ww - 24, kh = wh - 18
  s += R(wx - 2, wy - 2, ww + 4, wh + 4, { rx: 6, fill: '#BFB197' }) + R(wx, wy, ww, wh, { rx: 5, fill: 'url(#cs-win)' })
  s += R(kx, ky, kw, kh, { rx: 4, fill: '#2A2622', stroke: '#4A423B', sw: .7 }) + R(kx + 7, ky + 5, kw - 14, kh - 22, { rx: 2.5, fill: '#F2EADB' })
  ;[CS.orange, CS.amber, CS.teal].forEach((c, i) => { s += R(kx + 7, ky + 27 + i * 3.4, kw - 14, 3, { fill: c }) })
  const name = typeof PROJ === 'object' && PROJ.name ? PROJ.name : 'untitled'
  s += T(kx + 13, ky + 17, fit(asGiven(name), kw - 70, 10, 700), { size: 10, w: 700, c: '#2A2420' }) + csTx(kx + kw - 13, ky + 16, 'SIDE A', { anchor: 'end', c: CS.orange, size: 6.6 })
  const hy = ky + kh - 13
  CSX.reels = [kx + 57, kx + kw - 57, hy]
  s += R(kx + 44, hy - 12, kw - 88, 22, { rx: 11, fill: '#1A1512' }) + G(csReel(kx + 57, hy, 'cs-rl') + csReel(kx + kw - 57, hy, 'cs-rr'), '', ' clip-path="url(#cs-reelwin)"') + `<clipPath id="cs-reelwin"><rect x="${kx + 44}" y="${hy - 12}" width="${kw - 88}" height="22" rx="11"/></clipPath>`
  s += R(wx, wy, ww, wh, { rx: 5, fill: 'url(#cs-shine)' })
  /* the LCD */
  const lx = 268, ly = 12, lw = 330, lh = 88, p = curPos()
  CSX.lcdAt = { x: lx, y: ly }
  s += R(lx - 3, ly - 3, lw + 6, lh + 6, { rx: 5, fill: '#3A322C' }) + R(lx, ly, lw, lh, { rx: 2.5, fill: 'url(#cs-lcd)' })
  s += G(csLcd(p), '', ' id="cs-lcd"'); CSX.lcd = csLcdSig(p)
  for (let r = 0; r < 2; r++) { const y = ly + 67 + r * 8; s += csTx(lx + 10, y + 4.5, r ? 'R' : 'L', { size: 5.8, c: CS.seg, a: .8 }); let dots = '', lit = ''; for (let k = 0; k < 34; k++) { dots += R(lx + 20 + k * 5.2, y, 4, 4, { fill: CS.seg, fa: .07 }); lit += R(lx + 20 + k * 5.2, y, 4, 4, { fill: CS.seg, fa: .82 }) } s += dots + `<clipPath id="cs-d${r}-c"><rect id="cs-d${r}" x="${lx + 20}" y="${y}" width="0" height="4"/></clipPath>` + G(lit, '', ` clip-path="url(#cs-d${r}-c)"`) }
  s += hit(lx + 4, ly + 4, 170, 46, 'pos') + hit(lx + 186, ly + 46, 130, 22, 'tempo') + hit(lx + 6, ly + 54, 34, 10, 'loop') + hit(lx + 40, ly + 54, 34, 10, 'click') + hit(lx + 74, ly + 54, 46, 10, 'lowlat') + hit(lx + 118, ly + 54, 26, 10, 'meter')
  SKV.field.pos = { x: lx + 6, y: ly + 16, w: 150, h: 30 }; SKV.field.tempo = { x: lx + 186, y: ly + 48, w: 80, h: 18 }; SKV.field.meter = { x: lx + 118, y: ly + 54, w: 26, h: 10 }
  /* the keys */
  const keys = [['REC', 'cs-keyred', 'rec', !!S.rec], ['REW', 'cs-key', 'barback'], ['PLAY', 'cs-key', 'play', S.playing && !S.rec], ['F.F', 'cs-key', 'barfwd'], ['STOP', 'cs-key', 'stop'], ['PAUSE', 'cs-key', 'pause']]
  const bw = 42, bx0 = lx + lw + 16
  keys.forEach(([t, g, a, down], i) => {
    const x = bx0 + i * (bw + 3), y = 16 + (down ? 3 : 0), gx = x + bw / 2, gy = y + 25, c = '#EFE6D3'
    s += R(x, 19, bw, 62, { rx: 3, fill: '#1A1512' }) + P(`M${x} ${y}H${x + bw}V${y + 56}L${x + bw - 3} ${y + 63}H${x + 3}L${x} ${y + 56}Z`, { fill: `url(#${g})` }) + R(x + 2, y + 2, bw - 4, 2, { rx: 1, fill: '#FFFFFF', fa: .14 })
    s += t === 'REC' ? Cc(gx, gy, 3, { fill: c }) : t === 'REW' ? P(`M${gx} ${gy - 4}l-6 4l6 4zM${gx + 6} ${gy - 4}l-6 4l6 4z`, { fill: c }) : t === 'PLAY' ? P(`M${gx - 3} ${gy - 4.5}l7.5 4.5l-7.5 4.5z`, { fill: c }) : t === 'F.F' ? P(`M${gx - 6} ${gy - 4}l6 4l-6 4zM${gx} ${gy - 4}l6 4l-6 4z`, { fill: c }) : t === 'STOP' ? R(gx - 3, gy - 3, 6, 6, { fill: c }) : R(gx - 4, gy - 4, 2.6, 8, { fill: c }) + R(gx + 1.4, gy - 4, 2.6, 8, { fill: c })
    s += csTx(gx, y + 50, t, { size: 5.8, c, anchor: 'middle', ls: .5, a: .85 }) + hit(x, 16, bw, 66, a)
  })
  /* the maker's name; the switches */
  const kEnd = bx0 + 6 * (bw + 3), rx = Math.max(kEnd + 20, W - 330)
  if (W - kEnd > 240) s += csTx(W - 20, 34, 'SLUR STUDIO', { size: 13, c: CS.dark, ls: 2.4, anchor: 'end' }) + csTx(W - 20, 48, 'ST-8 STEREO CASSETTE DECK', { size: 6.2, anchor: 'end' })
  const pills = [['CYCLE', S.cycle.on, CS.amber, 'loop', 64], ['CLICK', !!S.click, CS.amber, 'click', 60], [toolWord(S.tool).toUpperCase(), true, CS.teal, 'toolmenu', 72], [`GRID ${S.grid}`, null, null, 'grid', 72]]
  let px = rx
  for (const [t, on, col, a, w] of pills) { if (px + w > W - 16) break; s += csBtn(px, 66, w, 13, t, on, col, a); if (a === 'grid') SKV.field.grid = { x: px, y: 66, w, h: 13 }; px += w + 4 }
  const nw = `NUDGE ${S.nudge}`.toUpperCase(), ow = `OUT ${fmtDb(S.master)} DB`
  s += csTx(rx, 96, nw, { size: 6.2 }) + hit(rx - 3, 86, 90, 14, 'nudge') + csTx(rx + 100, 96, ow, { size: 6.2 }) + hit(rx + 97, 86, 90, 14, 'master', '', 'ns-resize')
  SKV.field.nudge = { x: rx - 3, y: 86, w: 90, h: 14 }
  /* the stripes */
  ;[CS.orange, CS.amber, CS.teal, CS.navy].forEach((c, i) => { s += R(0, DH + i * 3, W, 3, { fill: c }) })
  return s
}
/* the foot: the out, lit */
SKINS.foot.cassette = y0 => {
  const dw = Math.min(640, W * .48)
  let s = R(0, y0, W, DECK_H, { fill: 'url(#cs-body)' }) + R(0, y0, W, 1, { fill: '#000', fa: .12 }) + R(16, y0 + 10, dw, 50, { rx: 3, fill: '#1E1915' })
  CSX.fw = dw - 40
  for (let r = 0; r < 2; r++) s += csTx(26, y0 + 27 + r * 18, r ? 'R' : 'L', { size: 6.4, c: '#EDE3CF', a: .7 }) + csLeds(38, y0 + 17 + r * 18, dw - 40, 12, 48, `cs-f${r}`)
  s += csTx(dw + 32, y0 + 30, 'OUTPUT LEVEL') + T(dw + 32, y0 + 47, `out  ${fmtDb(S.master)} dB`, { size: 9, w: 500, c: CS.dark, x: ' xml:space="preserve"' }) + hit(dw + 28, y0 + 36, 110, 16, 'master', '', 'ns-resize')
  return s
}
SKINS.frame.cassette = p => {
  if (CSX.lcdAt && SKIN.k.transport === 'cassette') {
    const sig = csLcdSig(p)
    if (sig !== CSX.lcd) { const el = $('cs-lcd'); if (el) { el.innerHTML = csLcd(p); CSX.lcd = sig } }
    /* the reels: they turn while it plays; the tape goes from the left to the right as the song does */
    const now = performance.now(), dt = Math.min(.1, (now - (CSX.at || now)) / 1000); CSX.at = now
    if (S.playing) CSX.turn = (CSX.turn + dt * 140) % 360
    const done = clamp(p / Math.max(1, SONG_END), 0, 1)
    for (const [id, k, r] of [['cs-rl', 0, 10 + 10 * (1 - done)], ['cs-rr', 1, 10 + 10 * done]]) {
      const el = $(id), pk = $(id + '-p')
      if (el && CSX.reels) el.setAttribute('transform', `translate(${n(CSX.reels[k])} ${n(CSX.reels[2])}) rotate(${n(CSX.turn)})`)
      if (pk) pk.setAttribute('r', n(r))
    }
  }
  if (typeof METERS !== 'object') return
  const f = v => volF(Math.min(6, linDb(v)))
  for (let r = 0; r < 2; r++) { const d = $('cs-d' + r); if (d) d.setAttribute('width', n(34 * 5.2 * f(METERS.mm[r]))); const fo = $('cs-f' + r); if (fo) fo.setAttribute('width', n(CSX.fw * f(METERS.mm[r]))) }
  const lv = (key, v) => {
    const h = $('csh-' + key); if (h) h.setAttribute('width', n((CSX.hw.get(key) || 0) * f(v)))
    const s = $('csv-' + key), g = CSX.v.get(key); if (s && g) { const hh = g[1] * f(v); s.setAttribute('y', n(g[0] + g[1] - hh)); s.setAttribute('height', n(hh)) }
  }
  for (const t of S.tracks) lv(t.id, METERS.now.get(t.id) || 0)
  lv('M', Math.max(METERS.mm[0], METERS.mm[1]))
}

/* ── a track: a cassette's spine ── */
SKINS.head.cassette = i => {
  const t = S.tracks[i], rh = rowH(i), y = rowY(i), sel = isChosen(i), cx = 6, cw = HEAD_W - 20, cy = y + 3, ch = rh - 6, di = ` data-i="${i}"`, tall = ch >= 34
  let s = R(cx, cy, cw, ch, { rx: 3, fill: CS.card, stroke: sel ? CS.dark : CS.edge, sw: sel ? 1.2 : .7 }) + R(cx, cy, 28, ch, { rx: 3, fill: t.c }) + R(cx + 24, cy, 4, ch, { fill: t.c })
  s += csTx(cx + 14, cy + ch / 2 + 3, pad2(i + 1), { size: Math.min(9, ch * .5), c: '#FFFFFF', anchor: 'middle', ls: .3 })
  const ny = tall ? cy + 15 : cy + ch / 2 + 3.6, nm = fit((t.parent ? '  ' : '') + asGiven(t.name), tall ? 130 : 70, 11, 700)
  s += T(cx + 36, ny, nm, { size: 11, w: 700, c: CS.dark, a: heard(t) ? 1 : .5 })
  if (t.theirs && tall) s += T(cx + 42 + tw(nm, 11, 700), ny, asGiven(`with ${t.theirs}`), { size: 8, c: '#9A8A78' })
  s += hit(0, y, tall ? 180 : 108, rh, 'sel', di)
  /* its lights, and its level a mark over them */
  const lx = tall ? cx + 36 : cx + 110, lw = tall ? 92 : 52, lh = 5, ly = tall ? cy + ch - 11 : cy + ch / 2 - 2.5, v = shown(t, 'vol'), xv = lx + lw * volF(v)
  CSX.hw.set(t.id, lw)
  s += csLeds(lx, ly, lw, lh, tall ? 14 : 9, `csh-${t.id}`) + P(`M${n(xv - 3)} ${n(ly - 4.5)}h6l-3 3.5z`, { fill: CS.dark })
  if (tall) s += T(lx + lw + 6, ly + 5, `${fmtDb(v)}`, { size: 7.5, c: CS.dark, a: .75 })
  s += hit(lx - 4, ly - 7, lw + (tall ? 34 : 8), 14, 'vol', `${di} data-rel="1"`, 'ew-resize')
  /* its buttons, pills */
  const its = cellsOf(t), rgt = cx + cw - 8
  if (tall) {
    const r = its.find(it => it.t === 'r'), rest = its.filter(it => it.t !== 'r')
    if (r) s += csBtn(rgt - 48, cy + 6, 48, 11, 'REC', r.on, CS.red, r.a, di)
    rest.forEach((it, k) => { const w = 22, x = rgt - (rest.length - k) * (w + 4) + 4; s += csBtn(x, cy + ch - 17, w, 11, it.t.toUpperCase(), it.on ? true : null, it.c || CS.amber, it.a, di) })
  } else {
    let x = rgt
    for (const it of its.slice().reverse()) { const w = it.t === 'r' ? 30 : 18; x -= w; s += csBtn(x, cy + ch / 2 - 5.5, w, 11, it.t === 'r' ? 'REC' : it.t.toUpperCase(), it.t === 'r' || it.on ? !!it.on : null, it.t === 'r' ? CS.red : it.c || CS.amber, it.a, di); x -= 4 }
  }
  return s
}
/* ── the markers: a J-card ── */
SKINS.scenes.cassette = () => {
  const y = MK_Y
  let s = R(0, y, RX, MK_H, { fill: K1 }), g = '', hits = hit(X0, y, X1 - X0, MK_H, 'scenebar', '', 'default')
  SCENES.forEach((sc, i) => {
    const xa = bx(sc.a), xb = bx(sc.b), xl = Math.max(xa, X0), xr = Math.min(xb, X1)
    if (xr - xl < 1) return
    const chosen = S.focus === 'marker' && S.selM === sc.a
    g += R(xl + .5, y + 4, xr - xl - 1, 15, { rx: 2, fill: i % 2 ? '#EADFC7' : '#E3D6BA', stroke: chosen ? CS.dark : null })
    g += csTx(xl + 5, y + 14.6, 'A' + (i + 1), { size: 7, w: 700, c: CS.orange, ls: .3 }) + T(xl + 22, y + 14.8, fit(asGiven(sc.name), Math.max(8, xr - xl - 27), 9, 700), { size: 9, w: 700, c: CS.dark })
    hits += hit(xl, y + 2, xr - xl, MK_H - 4, 'scene', ` data-i="${i}"`)
  })
  return s + G(g, '', TL) + hits
}
/* ── the cycle: a stripe ── */
SKINS.cycle.cassette = (ca, cb, y, on) => R(ca, y + 1, cb - ca, 3, { rx: 1.5, fill: lkC('cycle.c', CS.teal), fa: on ? 1 : .35 })
/* ── the mixer: a slider and a column of lights to a strip, on a card with its colour at the top ── */
SKINS.strip.cassette = {
  pan: (px, py, pw, pan) => { const xp = px + 6 + (pw - 12) * ((pan || 0) + 1) / 2; return R(px + 4, py, pw - 8, 2, { rx: 1, fill: '#2A2420' }) + R(xp - 5, py - 3.5, 10, 9, { rx: 1.5, fill: 'url(#cs-key)' }) + R(xp - .5, py - 2.5, 1, 7, { fill: '#EFE6D3' }) },
  level: (x, w, sx, sw, q, vol, muted, t) => {
    const key = t ? t.id : 'M', cx = x + w / 2 + 6, fy = q.yOf(vol)
    CSX.v.set(key, [q.ft, q.fh])
    let s = csLeds(sx + 6, q.ft, 7, q.fh, 14, `csv-${key}`, true)
    for (const db of DBS) s += R(cx - 13, q.yOf(db) - .3, 5, .6, { fill: '#7A6D60' })
    return s + R(cx - 1.5, q.ft, 3, q.fh, { rx: 1.5, fill: '#2A2420' }) + R(cx - 11, fy - 6, 22, 12, { rx: 2, fill: 'url(#cs-key)', fa: muted ? .6 : 1 }) + R(cx - 9, fy - .5, 18, 1, { fill: '#EFE6D3' })
  },
  cells: (sx, sw, y, its, i) => { let s = '', w = Math.min(22, Math.floor((sw - 6) / its.length) - 3), x = sx + (sw - its.length * (w + 3) + 3) / 2; for (const it of its) { s += csBtn(x, y + 2, w, 11, it.t.toUpperCase(), it.on ? true : null, it.t === 'r' ? CS.red : it.c || CS.amber, it.a, ` data-i="${i}"`); x += w + 3 } return s },
  name: (x, w, sx, sw, yb, t, sel) => T(x + w / 2, yb - 9, fit(asGiven(t.name), sw - 4, 10, 700), { size: 10, w: 700, c: CS.dark, a: sel ? 1 : .85, anchor: 'middle' }),
  box: (x, y, w, h, sel, t) => R(x + 3, y + 3, w - 6, h - 6, { rx: 3, stroke: sel ? CS.dark : CS.edge, sw: sel ? 1.2 : .8 }) + R(x + 3, y + 3, w - 6, 4, { rx: 2, fill: t ? t.c : '#8C7E6E' }),
}
