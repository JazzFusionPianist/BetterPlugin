/* ── theme: cassette — a tape deck of the eighties ──
   Beige plastic and the stripes of an eighties label. The transport is the deck itself: a cassette in its window whose
   reels hold as much tape as the song has left and has played, a green LCD with seven-segment digits, and piano keys.
   The song is written on lined label card; the heads stand at the right like a cassette's spine, with LED bar meters.
   A spectrum display runs along the foot. */
const CS = { body: '#E9DFCA', body2: '#D5C7AA', dark: '#2E2620', card: '#F5EEDD', rule: '#8FB0C4', orange: '#E4572E', amber: '#F3A712', teal: '#2A9D8F', navy: '#264653', red: '#D62828', lcd0: '#B4C29D', lcd1: '#97A882', seg: '#1C2616' }
const csFont = { wide: "'Michroma', sans-serif", hand: "'Permanent Marker', cursive" }
const csFam = t => ({ kick: CS.orange, snare: CS.orange, hats: CS.amber, bass: CS.navy, keys: CS.teal, guitar: CS.amber, hum: CS.orange, air: '#5C8DA6' })[t.name] || CS.teal

function csDefs () {
  return `<defs>
    <linearGradient id="cs-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F1E8D6"/><stop offset="1" stop-color="#DCCFB4"/></linearGradient>
    <linearGradient id="cs-lcd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${CS.lcd0}"/><stop offset="1" stop-color="${CS.lcd1}"/></linearGradient>
    <linearGradient id="cs-key" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5A4C40"/><stop offset=".85" stop-color="#3A3029"/><stop offset="1" stop-color="#231C17"/></linearGradient>
    <linearGradient id="cs-keyred" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E24B3B"/><stop offset="1" stop-color="#9E1F18"/></linearGradient>
    <linearGradient id="cs-win" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3A322C"/><stop offset="1" stop-color="#1A1512"/></linearGradient>
    <linearGradient id="cs-shine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".22"/><stop offset=".4" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
    <radialGradient id="cs-pack" cx=".5" cy=".5" r=".5"><stop offset=".3" stop-color="#5A4030"/><stop offset=".95" stop-color="#2A1C14"/><stop offset="1" stop-color="#1A110C"/></radialGradient>
    <pattern id="cs-rib" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="2" fill="#000" fill-opacity=".06"/></pattern>
    <filter id="cs-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2"/></filter>
  </defs>`
}
/* seven segments: a digit at x, y (top left), h tall */
const SEGS = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '' }
function csSeg (x, y, h, ch, col = CS.seg) {
  const w = h * .52, t = h * .09, sk = h * .08, g = t * .4
  const P = (x0, y0) => [x + x0 + sk * (1 - y0 / h), y + y0]
  const hz = (y0) => { const [a1, b1] = P(t * .6 + g, y0), [a2, b2] = P(w - t * .6 - g, y0); return `M${nn(a1)} ${nn(b1)}L${nn(a1 + t * .5)} ${nn(b1 - t / 2)}L${nn(a2 - t * .5)} ${nn(b2 - t / 2)}L${nn(a2)} ${nn(b2)}L${nn(a2 - t * .5)} ${nn(b2 + t / 2)}L${nn(a1 + t * .5)} ${nn(b1 + t / 2)}Z` }
  const vt = (x0, y0, y1) => { const [a1, b1] = P(x0, y0 + g + t * .5), [a2, b2] = P(x0, y1 - g - t * .5); return `M${nn(a1)} ${nn(b1 - t * .5)}L${nn(a1 + t / 2)} ${nn(b1)}L${nn(a2 + t / 2)} ${nn(b2)}L${nn(a2)} ${nn(b2 + t * .5)}L${nn(a2 - t / 2)} ${nn(b2)}L${nn(a1 - t / 2)} ${nn(b1)}Z` }
  const S = { a: hz(t / 2), g: hz(h / 2), d: hz(h - t / 2), f: vt(t / 2, 0, h / 2), b: vt(w - t / 2, 0, h / 2), e: vt(t / 2, h / 2, h), c: vt(w - t / 2, h / 2, h) }
  const on = SEGS[ch] || ''
  let s = ''
  for (const k of 'abcdefg') s += pa(S[k], { fill: col, fa: on.includes(k) ? .92 : .07 })
  return s
}
function csNum (x, y, h, str, col) {
  let s = '', cx = x
  for (const ch of str) {
    if (ch === '.' || ch === ':') { if (ch === '.') s += rc(cx - h * .02, y + h - h * .1, h * .1, h * .1, { fill: col || CS.seg, fa: .9 }); else s += rc(cx + h * .02, y + h * .28, h * .09, h * .09, { fill: col || CS.seg, fa: .9 }) + rc(cx, y + h * .68, h * .09, h * .09, { fill: col || CS.seg, fa: .9 }); cx += h * .2; continue }
    s += csSeg(cx, y, h, ch, col); cx += h * .62
  }
  return s
}
/* a reel: its hub with teeth, the tape wound on it */
function csReel (x, y, pack, turn) {
  let s = ci(x, y, pack, { fill: 'url(#cs-pack)' }) + ci(x, y, pack, { stroke: '#7A5A44', sw: .6, sa: .5 })
  s += ci(x, y, 17, { fill: '#F0E9DC' }) + ci(x, y, 9, { fill: '#2B231E' })
  for (let k = 0; k < 6; k++) { const a = (turn + k * 60) * Math.PI / 180; s += pa(`M${nn(x + 9 * Math.cos(a - .18))} ${nn(y + 9 * Math.sin(a - .18))}L${nn(x + 4 * Math.cos(a))} ${nn(y + 4 * Math.sin(a))}L${nn(x + 9 * Math.cos(a + .18))} ${nn(y + 9 * Math.sin(a + .18))}Z`, { fill: '#F0E9DC' }) }
  return s
}
/* an eighties rubber key with its LED */
const csBtn = (x, y, w, h, label, on, col = CS.red) => rc(x, y + 2, w, h, { rx: h / 2, fill: '#000', fa: .2 }) + rc(x, y, w, h, { rx: h / 2, fill: '#3C332C' }) + rc(x + 2, y + 1, w - 4, h * .45, { rx: h / 2, fill: '#FFF', fa: .1 }) + tx(x + w / 2 + 4, y + h / 2 + 3, label, { f: csFont.wide, z: 6.5, c: '#EDE3CF', anchor: 'middle', ls: .5 }) + ci(x + 8, y + h / 2, 2.4, { fill: on ? col : '#5A4E44' }) + (on ? ci(x + 8, y + h / 2, 5, { fill: col, fa: .6, more: ' filter="url(#cs-glow)"' }) : '')
/* an LED bar meter: segments lit up to v (0 … 1) */
function csLed (x, y, w, h, v, n = 16) {
  let s = ''
  const sw = (w - (n - 1) * 1.5) / n
  for (let k = 0; k < n; k++) { const f = (k + 1) / n, col = f > .87 ? CS.red : f > .7 ? CS.amber : '#4CAF50'; s += rc(x + k * (sw + 1.5), y, sw, h, { rx: .8, fill: col, fa: f <= v ? .95 : .14 }) }
  return s
}

THEMES.cassette = () => {
  const song = tdSong(), T = song.tracks, head = song.head
  let s = csDefs() + rc(0, 0, TW, TH, { fill: CS.card })
  /* the deck */
  const DH = 214
  s += rc(0, 0, TW, DH, { fill: 'url(#cs-body)' }) + rc(0, 0, TW, 14, { fill: 'url(#cs-rib)' }) + rc(0, DH - 2, TW, 2, { fill: '#000', fa: .15 })
  /* the cassette in its window */
  const wx = 34, wy = 26, ww = 420, wh = 168
  s += rc(wx - 4, wy - 4, ww + 8, wh + 8, { rx: 10, fill: '#BFB197' }) + rc(wx, wy, ww, wh, { rx: 8, fill: 'url(#cs-win)' })
  const kx = wx + 22, ky = wy + 18, kw = ww - 44, kh = wh - 34
  s += rc(kx, ky, kw, kh, { rx: 7, fill: '#2A2622', stroke: '#4A423B', sw: 1 })
  s += rc(kx + 12, ky + 10, kw - 24, kh - 40, { rx: 4, fill: '#F2EADB' })
  ;[CS.orange, CS.amber, CS.teal].forEach((c, i) => { s += rc(kx + 12, ky + 52 + i * 7, kw - 24, 6, { fill: c }) })
  s += tx(kx + 22, ky + 32, song.name, { f: csFont.hand, z: 17, c: '#2A2420' }) + tx(kx + kw - 22, ky + 30, 'A', { f: csFont.wide, z: 16, c: CS.orange, anchor: 'end' }) + tx(kx + kw - 46, ky + 28, 'SIDE', { f: csFont.wide, z: 6, c: '#6A5E52', anchor: 'end' })
  const played = head / song.end, rL = 18 + 34 * (1 - played), rR = 18 + 34 * played
  const hy = ky + kh - 30
  s += rc(kx + 80, hy - 26, kw - 160, 46, { rx: 22, fill: '#1A1512' })
  s += csReel(kx + 102, hy, Math.min(rL, 40), 12) + csReel(kx + kw - 102, hy, Math.min(rR, 40), 48)
  s += pa(`M${kx + 102 - Math.min(rL, 40) * .2} ${hy + Math.min(rL, 40)}L${kx + kw / 2} ${ky + kh - 4}L${kx + kw - 102} ${hy + Math.min(rR, 40)}`, { stroke: '#4A3424', sw: 1.4 })
  s += rc(wx, wy, ww, wh, { rx: 8, fill: 'url(#cs-shine)' })
  /* the LCD */
  const lx = 486, ly = 30, lw = 470, lh = 160
  s += rc(lx - 6, ly - 6, lw + 12, lh + 12, { rx: 8, fill: '#3A322C' }) + rc(lx, ly, lw, lh, { rx: 4, fill: 'url(#cs-lcd)' })
  const lab = (x, y, t, on = true) => tx(x, y, t, { f: csFont.wide, z: 7, c: CS.seg, a: on ? .85 : .12, ls: .6 })
  s += lab(lx + 18, ly + 20, 'BAR') + csNum(lx + 18, ly + 28, 58, '20.1.1')
  s += lab(lx + 300, ly + 20, 'TIME') + csNum(lx + 300, ly + 28, 34, '0:49.5')
  s += lab(lx + 300, ly + 84, 'TEMPO') + csNum(lx + 300, ly + 92, 22, '92.00') + lab(lx + 400, ly + 112, 'BPM')
  s += lab(lx + 18, ly + 112, 'CYCLE') + lab(lx + 76, ly + 112, 'CLICK', false) + lab(lx + 132, ly + 112, 'COUNT', false) + lab(lx + 196, ly + 112, '4/4')
  s += lab(lx + 18, ly + 132, 'L') + lab(lx + 18, ly + 146, 'R')
  for (const [row, v] of [[0, .74], [1, .7]]) for (let k = 0; k < 30; k++) s += rc(lx + 32 + k * 9, ly + 126 + row * 14, 7, 7, { fill: CS.seg, fa: (k + 1) / 30 <= v ? .85 : .08 })
  s += lab(lx + 310, ly + 146, 'REC', false) + lab(lx + 350, ly + 146, 'PLAY') + tx(lx + 398, ly + 146, '▶', { z: 9, c: CS.seg })
  /* the keys */
  const keys = [['REC', 'cs-keyred', '●'], ['REW', 'cs-key', '◀◀'], ['PLAY', 'cs-key', '▶'], ['F.F', 'cs-key', '▶▶'], ['STOP', 'cs-key', '■'], ['PAUSE', 'cs-key', '❚❚']]
  const bw = 66, bx0 = 980
  keys.forEach(([t, g, sym], i) => {
    const x = bx0 + i * (bw + 4), down = t === 'PLAY', y = 40 + (down ? 6 : 0)
    s += rc(x, 46, bw, 92, { rx: 4, fill: '#1A1512' })
    s += pa(`M${x} ${y}H${x + bw}V${y + 78}L${x + bw - 4} ${y + 88}H${x + 4}L${x} ${y + 78}Z`, { fill: `url(#${g})` }) + rc(x + 3, y + 3, bw - 6, 3, { rx: 1.5, fill: '#FFF', fa: .15 })
    s += tx(x + bw / 2, y + 40, sym, { z: 17, c: '#EFE6D3', anchor: 'middle' }) + tx(x + bw / 2, y + 72, t, { f: csFont.wide, z: 7, c: '#EFE6D3', anchor: 'middle', ls: .6, a: .85 })
  })
  s += tx(980, 168, 'SLUR STUDIO', { f: csFont.wide, z: 13, c: CS.dark, ls: 3 }) + tx(980, 186, 'ST-8 STEREO CASSETTE DECK', { f: csFont.wide, z: 6.5, c: '#6A5E52', ls: 2 })
  s += csBtn(1230, 160, 74, 18, 'CYCLE', true, CS.amber) + csBtn(1310, 160, 74, 18, 'CLICK', false)
  /* the stripes */
  ;[CS.orange, CS.amber, CS.teal, CS.navy].forEach((c, i) => { s += rc(0, DH + i * 5, TW, 5, { fill: c }) })
  /* the song on lined card, the heads at the right like a cassette's spine */
  const top = DH + 20, HR = 280, L = 24, R = TW - HR - 14, rulerH = 54, laneTop = top + rulerH, foot = 812
  tdMap(L, R, 1, song.end + 1)
  const rh = (foot - laneTop) / T.length
  /* the markers as a J-card's list: A1 intro, A2 verse … */
  song.scenes.forEach((sc, i) => {
    const x = bx(sc.a), x2 = bx(sc.b)
    s += rc(x + 1, top + 4, x2 - x - 2, 22, { rx: 3, fill: i % 2 ? '#EADFC7' : '#E1D4B7' })
    s += tx(x + 8, top + 19, 'A' + (i + 1), { f: csFont.wide, z: 7.5, c: CS.orange }) + tx(x + 30, top + 20, sc.name, { f: csFont.hand, z: 12, c: CS.dark })
  })
  for (let b = 1; b <= song.end; b++) { const x = bx(b); if ((b - 1) % 4 === 0) s += tx(x + 3, top + 46, String(b), { f: csFont.wide, z: 7, c: '#7A6D60' }) + ln(x, top + 32, x, top + 50, '#7A6D60', 1); else s += ln(x, top + 42, x, top + 50, '#7A6D60', .6, .6) }
  const cy0 = bx(song.cycle.a + 1), cy1 = bx(song.cycle.b + 1)
  s += rc(cy0, top + 30, cy1 - cy0, 5, { rx: 2.5, fill: CS.teal })
  for (let i = 0; i <= T.length; i++) s += ln(L, laneTop + i * rh, R, laneTop + i * rh, CS.rule, 1, .45)
  s += ln(L + 40, laneTop, L + 40, foot, '#E8A0A0', 1, .5)
  T.forEach((t, i) => {
    const y = laneTop + i * rh, c = csFam(t)
    for (const g of tdRegs(t, L, R)) {
      s += rc(g.xa + 1.5, y + 7, g.w - 3, rh - 14, { rx: (rh - 14) / 2, fill: c })
      if (tdIsNotes(t, g.r)) { const { d, tr } = tdNotes(g, y + 12, rh - 24); s += gr(pa(d, { stroke: '#FFFFFF', sw: 2.6, cap: 'round', sa: .95 }), tr) }
      else s += pa(tdWave(g, y + rh / 2, rh / 2 - 13), { fill: '#FFFFFF', fa: .92 })
    }
    /* the spine */
    const hx = TW - HR, hy = y + 3
    s += rc(hx, hy, HR - 22, rh - 6, { rx: 5, fill: '#FBF6EA', stroke: '#D9CCB0', sw: 1 })
    s += rc(hx, hy, 46, rh - 6, { rx: 5, fill: c }) + rc(hx + 40, hy, 6, rh - 6, { fill: c })
    s += tx(hx + 23, hy + rh / 2 + 3, String(i + 1).padStart(2, '0'), { f: csFont.wide, z: 13, c: '#FFFFFF', anchor: 'middle' })
    s += tx(hx + 58, hy + 26, t.name, { f: csFont.hand, z: 17, c: CS.dark }) + (t.theirs ? tx(hx + 60 + tw2(t.name, csFont.hand, 17) + 8, hy + 26, 'with ' + t.theirs, { f: csFont.hand, z: 9, c: '#9A8A78' }) : '')
    s += csLed(hx + 58, hy + rh - 22, 120, 8, tdLevel(t, head) > -30 ? .5 + (tdLevel(t, head) + 12) / 30 : 0)
    s += csBtn(hx + 186, hy + rh - 28, 26, 16, 'M', !!t.mute, CS.amber) + csBtn(hx + 216, hy + rh - 28, 26, 16, 'S', !!t.solo, '#4CAF50') + csBtn(hx + 186, hy + 10, 56, 16, 'REC', i === 4)
  })
  /* the playhead */
  const px = bx(head + 1)
  s += ln(px, top + 28, px, foot, CS.red, 1.6) + pa(`M${px - 6} ${top + 28}L${px + 6} ${top + 28}L${px} ${top + 38}Z`, { fill: CS.red })
  /* the foot: a spectrum display */
  const fy = 822
  s += rc(0, fy, TW, TH - fy, { fill: 'url(#cs-body)' }) + rc(0, fy, TW, 2, { fill: '#000', fa: .12 })
  s += rc(24, fy + 12, 860, 58, { rx: 4, fill: '#1E1915' })
  const r = rnd(5)
  for (let k = 0; k < 48; k++) { const v = Math.max(.12, Math.min(1, .95 - Math.abs(k - 9) / 40 - r() * .25 + (k < 4 ? -.2 : 0))), x = 34 + k * 17.6; for (let j = 0; j < 12; j++) { const f = (j + 1) / 12; s += rc(x, fy + 62 - j * 4.2, 14, 3, { fill: f > .85 ? CS.red : f > .65 ? CS.amber : '#4CAF50', fa: f <= v ? .9 : .1 }) } }
  s += tx(900, fy + 30, 'SPECTRUM', { f: csFont.wide, z: 7, c: '#6A5E52', ls: 1.5 }) + tx(900, fy + 48, 'out  −4.2 dB', { f: csFont.wide, z: 8, c: CS.dark })
  s += csBtn(1060, fy + 22, 90, 20, 'POINTER', true, CS.teal) + csBtn(1156, fy + 22, 80, 20, 'GRID 1/4', false) + csBtn(1242, fy + 22, 90, 20, 'NUDGE BEAT', false) + csBtn(1338, fy + 22, 78, 20, 'KEYS', false)
  s += tx(1060, fy + 64, 'TOOL', { f: csFont.wide, z: 6.5, c: '#6A5E52', ls: 1.5 })
  return s
}
