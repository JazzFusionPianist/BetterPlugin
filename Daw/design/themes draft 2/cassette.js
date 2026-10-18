/* ── theme: cassette — a tape deck of the eighties, at the room's own size ──
   Draft 2: labels in Archivo (its wide cut for the maker's name, as a deck's front has it), names typed on the card in
   Courier Prime as a J-card is typed, seven-segment digits drawn as an LCD draws them. */
const CS = { body: '#E9DFCA', dark: '#2E2620', card: '#F5EEDD', rule: '#8FB0C4', orange: '#E4572E', amber: '#F3A712', teal: '#2A9D8F', navy: '#264653', red: '#D62828', lcd0: '#B4C29D', lcd1: '#97A882', seg: '#1C2616' }
const csF = { sans: "'Archivo', sans-serif", typed: "'Courier Prime', monospace" }
const csFam = t => ({ kick: CS.orange, snare: CS.orange, hats: CS.amber, bass: CS.navy, keys: CS.teal, guitar: CS.amber, hum: CS.orange, air: '#5C8DA6' })[t.name] || CS.teal

function csDefs () {
  return `<defs>
    <linearGradient id="cs-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F1E8D6"/><stop offset="1" stop-color="#DCCFB4"/></linearGradient>
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
const SEGS = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '' }
function csSeg (x, y, h, ch, col = CS.seg) {
  const w = h * .5, t = h * .1, sk = h * .07, g = t * .4
  const P = (x0, y0) => [x + x0 + sk * (1 - y0 / h), y + y0]
  const hz = (y0) => { const [a1, b1] = P(t * .6 + g, y0), [a2, b2] = P(w - t * .6 - g, y0); return `M${nn(a1)} ${nn(b1)}L${nn(a1 + t * .5)} ${nn(b1 - t / 2)}L${nn(a2 - t * .5)} ${nn(b2 - t / 2)}L${nn(a2)} ${nn(b2)}L${nn(a2 - t * .5)} ${nn(b2 + t / 2)}L${nn(a1 + t * .5)} ${nn(b1 + t / 2)}Z` }
  const vt = (x0, y0, y1) => { const [a1, b1] = P(x0, y0 + g + t * .5), [a2, b2] = P(x0, y1 - g - t * .5); return `M${nn(a1)} ${nn(b1 - t * .5)}L${nn(a1 + t / 2)} ${nn(b1)}L${nn(a2 + t / 2)} ${nn(b2)}L${nn(a2)} ${nn(b2 + t * .5)}L${nn(a2 - t / 2)} ${nn(b2)}L${nn(a1 - t / 2)} ${nn(b1)}Z` }
  const S = { a: hz(t / 2), g: hz(h / 2), d: hz(h - t / 2), f: vt(t / 2, 0, h / 2), b: vt(w - t / 2, 0, h / 2), e: vt(t / 2, h / 2, h), c: vt(w - t / 2, h / 2, h) }
  const on = SEGS[ch] || ''
  let s = ''
  for (const k of 'abcdefg') s += pa(S[k], { fill: col, fa: on.includes(k) ? .9 : .06 })
  return s
}
function csNum (x, y, h, str, col) {
  let s = '', cx = x
  for (const ch of str) {
    if (ch === '.') { s += rc(cx - h * .02, y + h - h * .1, h * .09, h * .09, { fill: col || CS.seg, fa: .9 }); cx += h * .18; continue }
    if (ch === ':') { s += rc(cx + h * .02, y + h * .28, h * .08, h * .08, { fill: col || CS.seg, fa: .9 }) + rc(cx, y + h * .66, h * .08, h * .08, { fill: col || CS.seg, fa: .9 }); cx += h * .18; continue }
    s += csSeg(cx, y, h, ch, col); cx += h * .6
  }
  return s
}
function csReel (x, y, pack, turn) {
  let s = ci(x, y, pack, { fill: 'url(#cs-pack)' }) + ci(x, y, 9, { fill: '#F0E9DC' }) + ci(x, y, 4.6, { fill: '#2B231E' })
  for (let k = 0; k < 6; k++) { const a = (turn + k * 60) * Math.PI / 180; s += pa(`M${nn(x + 4.6 * Math.cos(a - .2))} ${nn(y + 4.6 * Math.sin(a - .2))}L${nn(x + 2 * Math.cos(a))} ${nn(y + 2 * Math.sin(a))}L${nn(x + 4.6 * Math.cos(a + .2))} ${nn(y + 4.6 * Math.sin(a + .2))}Z`, { fill: '#F0E9DC' }) }
  return s
}
const csBtn = (x, y, w, h, label, on, col = CS.red) => rc(x, y + 1.2, w, h, { rx: h / 2, fill: '#000', fa: .2 }) + rc(x, y, w, h, { rx: h / 2, fill: '#3C332C' }) + rc(x + 1.5, y + .8, w - 3, h * .42, { rx: h / 2, fill: '#FFF', fa: .09 }) + tx(x + w / 2 + 3, y + h / 2 + 2.4, label, { f: csF.sans, z: 6.4, w: 600, st: 112, c: '#EDE3CF', anchor: 'middle', ls: .6 }) + ci(x + 6, y + h / 2, 1.7, { fill: on ? col : '#5A4E44' }) + (on ? ci(x + 6, y + h / 2, 3.6, { fill: col, fa: .6, more: ' filter="url(#cs-glow)"' }) : '')
function csLed (x, y, w, h, v, n = 14) {
  let s = ''
  const sw = (w - (n - 1) * 1.2) / n
  for (let k = 0; k < n; k++) { const f = (k + 1) / n, col = f > .87 ? CS.red : f > .7 ? CS.amber : '#4CAF50'; s += rc(x + k * (sw + 1.2), y, sw, h, { rx: .5, fill: col, fa: f <= v ? .92 : .13 }) }
  return s
}
const csLab = (x, y, t, o = {}) => tx(x, y, t, Object.assign({ f: csF.sans, z: 6.4, w: 600, st: 115, c: '#6A5E52', ls: 1.1 }, o))

THEMES.cassette = () => {
  const song = tdSong(), T = song.tracks, head = song.head
  let s = csDefs() + rc(0, 0, TW, TH, { fill: CS.card })
  const DH = 112
  s += rc(0, 0, TW, DH, { fill: 'url(#cs-body)' }) + rc(0, 0, TW, 6, { fill: 'url(#cs-rib)' }) + rc(0, DH - 1, TW, 1, { fill: '#000', fa: .15 })
  /* the cassette in its window */
  const wx = 16, wy = 12, ww = 236, wh = 88
  s += rc(wx - 2, wy - 2, ww + 4, wh + 4, { rx: 6, fill: '#BFB197' }) + rc(wx, wy, ww, wh, { rx: 5, fill: 'url(#cs-win)' })
  const kx = wx + 12, ky = wy + 9, kw = ww - 24, kh = wh - 18
  s += rc(kx, ky, kw, kh, { rx: 4, fill: '#2A2622', stroke: '#4A423B', sw: .7 }) + rc(kx + 7, ky + 5, kw - 14, kh - 22, { rx: 2.5, fill: '#F2EADB' })
  ;[CS.orange, CS.amber, CS.teal].forEach((c, i) => { s += rc(kx + 7, ky + 27 + i * 3.4, kw - 14, 3, { fill: c }) })
  s += tx(kx + 13, ky + 17, song.name, { f: csF.typed, z: 10, w: 700, c: '#2A2420' }) + csLab(kx + kw - 13, ky + 16, 'SIDE A', { anchor: 'end', c: CS.orange, z: 6.6 })
  const played = head / song.end, rL = 10 + 16 * (1 - played), rR = 10 + 16 * played, hy = ky + kh - 13
  s += rc(kx + 44, hy - 12, kw - 88, 22, { rx: 11, fill: '#1A1512' }) + csReel(kx + 57, hy, Math.min(rL, 20), 12) + csReel(kx + kw - 57, hy, Math.min(rR, 20), 48)
  s += rc(wx, wy, ww, wh, { rx: 5, fill: 'url(#cs-shine)' })
  /* the LCD */
  const lx = 268, ly = 12, lw = 330, lh = 88
  s += rc(lx - 3, ly - 3, lw + 6, lh + 6, { rx: 5, fill: '#3A322C' }) + rc(lx, ly, lw, lh, { rx: 2.5, fill: 'url(#cs-lcd)' })
  const lab = (x, y, t, on = true) => tx(x, y, t, { f: csF.sans, z: 5.8, w: 600, st: 112, c: CS.seg, a: on ? .8 : .12, ls: .7 })
  s += lab(lx + 10, ly + 11, 'BAR') + csNum(lx + 10, ly + 15, 32, '20.1.1')
  s += lab(lx + 190, ly + 11, 'TIME') + csNum(lx + 190, ly + 15, 18, '0:49.5')
  s += lab(lx + 190, ly + 46, 'TEMPO') + csNum(lx + 190, ly + 50, 13, '92.00') + lab(lx + 252, ly + 61, 'BPM')
  s += lab(lx + 10, ly + 61, 'CYCLE') + lab(lx + 44, ly + 61, 'CLICK', false) + lab(lx + 78, ly + 61, 'COUNT', false) + lab(lx + 114, ly + 61, '4/4')
  for (const [row, v] of [[0, .74], [1, .7]]) { s += lab(lx + 10, ly + 72 + row * 8, row ? 'R' : 'L'); for (let k = 0; k < 34; k++) s += rc(lx + 20 + k * 5.2, ly + 67 + row * 8, 4, 4, { fill: CS.seg, fa: (k + 1) / 34 <= v ? .82 : .07 }) }
  s += lab(lx + 220, ly + 79, 'REC', false) + lab(lx + 246, ly + 79, 'PLAY') + tx(lx + 272, ly + 80, '▶', { z: 6.5, c: CS.seg })
  /* the keys */
  const keys = [['REC', 'cs-keyred', '●'], ['REW', 'cs-key', '◀◀'], ['PLAY', 'cs-key', '▶'], ['F.F', 'cs-key', '▶▶'], ['STOP', 'cs-key', '■'], ['PAUSE', 'cs-key', '❚❚']]
  const bw = 42, bx0 = 614
  keys.forEach(([t, g, sym], i) => {
    const x = bx0 + i * (bw + 3), down = t === 'PLAY', y = 16 + (down ? 3 : 0)
    s += rc(x, 19, bw, 62, { rx: 3, fill: '#1A1512' }) + pa(`M${x} ${y}H${x + bw}V${y + 56}L${x + bw - 3} ${y + 63}H${x + 3}L${x} ${y + 56}Z`, { fill: `url(#${g})` }) + rc(x + 2, y + 2, bw - 4, 2, { rx: 1, fill: '#FFF', fa: .14 })
    s += tx(x + bw / 2, y + 28, sym, { z: 10, c: '#EFE6D3', anchor: 'middle' }) + tx(x + bw / 2, y + 50, t, { f: csF.sans, z: 5.8, w: 600, st: 112, c: '#EFE6D3', anchor: 'middle', ls: .5, a: .85 })
  })
  s += tx(TW - 20, 34, 'SLUR STUDIO', { f: csF.sans, z: 13, w: 600, st: 125, c: CS.dark, ls: 2.4, anchor: 'end' }) + csLab(TW - 20, 48, 'ST-8 STEREO CASSETTE DECK', { anchor: 'end', z: 6.2 })
  s += csBtn(TW - 314, 66, 64, 13, 'CYCLE', true, CS.amber) + csBtn(TW - 246, 66, 60, 13, 'CLICK', false) + csBtn(TW - 182, 66, 72, 13, 'POINTER', true, CS.teal) + csBtn(TW - 106, 66, 86, 13, 'GRID 1/4', false)
  s += csLab(TW - 314, 94, 'NUDGE BEAT       OUT −4.2 DB', { more: ' xml:space="preserve"', z: 6 })
  ;[CS.orange, CS.amber, CS.teal, CS.navy].forEach((c, i) => { s += rc(0, DH + i * 3, TW, 3, { fill: c }) })
  /* the song on lined card; the heads at the right, a cassette's spine */
  const top = DH + 16, HR = 234, L = 16, R = TW - HR - 10, laneTop = top + 34, rh = 52, foot = 818
  tdMap(L, R, 1, song.end + 1)
  song.scenes.forEach((sc, i) => { const x = bx(sc.a), x2 = bx(sc.b); s += rc(x + .5, top, x2 - x - 1, 15, { rx: 2, fill: i % 2 ? '#EADFC7' : '#E3D6BA' }) + tx(x + 5, top + 10.6, 'A' + (i + 1), { f: csF.sans, z: 7, w: 700, c: CS.orange }) + tx(x + 21, top + 10.8, sc.name, { f: csF.typed, z: 9, w: 700, c: CS.dark }) })
  for (let b = 1; b <= song.end; b++) { const x = bx(b); if ((b - 1) % 4 === 0) s += csLab(x + 2.5, top + 28, String(b), { z: 6 }) + ln(x, top + 19, x, top + 30, '#7A6D60', .7); else s += ln(x, top + 26, x, top + 30, '#7A6D60', .5, .6) }
  const cy0 = bx(song.cycle.a + 1), cy1 = bx(song.cycle.b + 1)
  s += rc(cy0, top + 18, cy1 - cy0, 3, { rx: 1.5, fill: CS.teal })
  for (let y = laneTop; y <= foot; y += rh) s += ln(L, y, R, y, CS.rule, .7, .42)
  s += ln(L + 26, laneTop, L + 26, foot, '#E8A0A0', .7, .5)
  T.forEach((t, i) => {
    const y = laneTop + i * rh, c = csFam(t)
    for (const g of tdRegs(t, L, R)) {
      s += rc(g.xa + 1, y + 5, g.w - 2, rh - 10, { rx: 7, fill: c })
      if (tdIsNotes(t, g.r)) { const { d, tr } = tdNotes(g, y + 8, rh - 16); s += gr(pa(d, { stroke: '#FFFFFF', sw: 1.7, cap: 'round', sa: .95 }), tr) }
      else s += pa(tdWave(g, y + rh / 2, rh / 2 - 9), { fill: '#FFFFFF', fa: .9 })
    }
    const hx = TW - HR, hy = y + 3
    s += rc(hx, hy, HR - 14, rh - 6, { rx: 3, fill: '#FBF6EA', stroke: '#D9CCB0', sw: .7 }) + rc(hx, hy, 28, rh - 6, { rx: 3, fill: c }) + rc(hx + 24, hy, 4, rh - 6, { fill: c })
    s += tx(hx + 14, hy + (rh - 6) / 2 + 3, String(i + 1).padStart(2, '0'), { f: csF.sans, z: 9, w: 600, st: 112, c: '#FFFFFF', anchor: 'middle' })
    s += tx(hx + 38, hy + 16, t.name, { f: csF.typed, z: 11, w: 700, c: CS.dark }) + (t.theirs ? tx(hx + 40 + tw2(t.name, csF.typed, 11, 700) + 6, hy + 16, 'with ' + t.theirs, { f: csF.typed, z: 8, c: '#9A8A78' }) : '')
    s += csLed(hx + 38, hy + rh - 18, 92, 5, tdLevel(t, head) > -30 ? .5 + (tdLevel(t, head) + 12) / 30 : 0)
    s += csBtn(hx + 144, hy + rh - 22, 22, 11, 'M', !!t.mute, CS.amber) + csBtn(hx + 170, hy + rh - 22, 22, 11, 'S', !!t.solo, '#4CAF50') + csBtn(hx + 144, hy + 7, 48, 11, 'REC', i === 4)
  })
  /* the mixer, docked as the room's panel: a slider for each track as an eighties graphic equaliser has them */
  const py0 = 624, ST = T.concat([{ name: 'plate', vol: 0, regs: [], bus: true }])
  s += rc(0, py0, TW, foot - py0 + 6, { fill: 'url(#cs-body)' }) + rc(0, py0, TW, 1, { fill: '#000', fa: .15 }) + rc(0, py0 + 1, TW, 4, { fill: 'url(#cs-rib)' })
  ;['PATCH', 'MIXER', 'NOTES', 'PROMPT', 'RUBATO'].forEach((t2, k) => { s += csBtn(16 + k * 70, py0 + 12, 64, 13, t2, t2 === 'MIXER', CS.amber) })
  ST.forEach((t, i) => {
    const x = 16 + i * 118, y0 = py0 + 36, c = t.bus ? '#8C7E6E' : csFam(t)
    s += rc(x, y0, 110, foot - y0 - 4, { rx: 3, fill: '#FBF6EA', stroke: '#D9CCB0', sw: .7 }) + rc(x, y0, 110, 4, { rx: 2, fill: c })
    s += tx(x + 8, y0 + 18, t.name, { f: csF.typed, z: 10, w: 700, c: CS.dark })
    for (let j = 0; j < 14; j++) { const f = (j + 1) / 14, lv = t.bus ? .45 : (tdLevel(t, head) > -30 ? .5 + (tdLevel(t, head) + 12) / 30 : 0); s += rc(x + 10, y0 + 138 - j * 8, 8, 6, { rx: .5, fill: f > .87 ? CS.red : f > .7 ? CS.amber : '#4CAF50', fa: f <= lv ? .9 : .12 }) }
    const sx = x + 52, st0 = y0 + 30, st1 = y0 + 140, lv2 = Math.max(0, Math.min(1, ((t.vol || 0) + 30) / 36)), sy = st1 - (st1 - st0) * lv2
    for (let k = 0; k <= 6; k++) s += ln(sx - 14, st0 + k * (st1 - st0) / 6, sx - 9, st0 + k * (st1 - st0) / 6, '#7A6D60', .6)
    s += rc(sx - 1.5, st0, 3, st1 - st0, { rx: 1.5, fill: '#2A2420' }) + rc(sx - 11, sy - 6, 22, 12, { rx: 2, fill: 'url(#cs-key)' }) + rc(sx - 9, sy - .5, 18, 1, { fill: '#EFE6D3' })
    s += tx(x + 80, y0 + 140, ((t.vol || 0) > 0 ? '+' : '') + (t.vol || 0).toFixed(1), { f: csF.sans, z: 8, w: 500, c: CS.dark })
    s += csBtn(x + 74, y0 + 30, 26, 11, 'M', i === 2, CS.amber) + csBtn(x + 74, y0 + 46, 26, 11, 'S', false, '#4CAF50')
  })
  const px = bx(head + 1)
  s += ln(px, top + 17, px, py0, CS.red, 1.1) + pa(`M${px - 4} ${top + 17}L${px + 4} ${top + 17}L${px} ${top + 24}Z`, { fill: CS.red })
  /* the foot: a spectrum display */
  const fy = 826
  s += rc(0, fy, TW, TH - fy, { fill: 'url(#cs-body)' }) + rc(0, fy, TW, 1, { fill: '#000', fa: .12 })
  s += rc(16, fy + 12, 640, 50, { rx: 3, fill: '#1E1915' })
  const r = rnd(5)
  for (let k = 0; k < 56; k++) { const v = Math.max(.12, Math.min(1, .95 - Math.abs(k - 10) / 46 - r() * .25 + (k < 4 ? -.2 : 0))), x = 24 + k * 11.2; for (let j = 0; j < 12; j++) { const f = (j + 1) / 12; s += rc(x, fy + 56 - j * 3.6, 9, 2.4, { fill: f > .85 ? CS.red : f > .65 ? CS.amber : '#4CAF50', fa: f <= v ? .9 : .09 }) } }
  s += csLab(672, fy + 30, 'SPECTRUM ANALYSER') + tx(672, fy + 46, 'out  −4.2 dB', { f: csF.sans, z: 9, w: 500, c: CS.dark, more: ' xml:space="preserve"' })
  return s
}
