/* ── theme: console — a tape room of the seventies, analog through and through ──
   Walnut cheeks, a bone-coloured panel, a meter bridge of backlit VU meters (the faders are gone: a track's level is its
   meter, and its knob), track names on masking tape, lamps for mute and solo, the song as oxide-brown tape, markers on
   yellow tape flags, the cycle in grease pencil, and a tape machine's keys, counters and bat-handle switches for the
   transport. Two frames: the arrangement, and the mixer as a console. */
const CN = { wood0: '#2E1B10', wood1: '#5A361F', wood2: '#7B4B2A', panel: '#E4D9C2', panel2: '#D6C8AA', ink: '#2B241C', ink2: '#5E5246', deep: '#16100B', tape: '#1B140E', oxide0: '#4D3524', oxide1: '#3A2819', wave: '#EAD7AE', amber: '#FFB547', red: '#C0392B', green: '#66B05E', yellow: '#F1CF63', mask: '#EFE6D0' }
const cnFont = { eng: "'Barlow Condensed', sans-serif", hand: "'Permanent Marker', cursive", dig: "'Barlow Condensed', sans-serif" }

function cnDefs () {
  const r = rnd(7)
  let grain = ''
  for (let i = 0; i < 26; i++) { const x = r() * 24, a = .12 + r() * .25; let d = `M${nn(x)} 0`; for (let y = 0; y <= 900; y += 60) d += ` Q${nn(x + (r() - .5) * 6)} ${y + 30} ${nn(x + (r() - .5) * 4)} ${y + 60}`; grain += pa(d, { stroke: i % 3 ? '#1E1209' : '#9A6338', sw: .5 + r() * 1.4, sa: a }) }
  let brush = ''
  for (let i = 0; i < 18; i++) brush += rc(0, i / 3, 600, .33, { fill: r() > .5 ? '#FFFFFF' : '#000000', fa: .03 + r() * .05 })
  return `<defs>
    <linearGradient id="cn-wood" x1="0" x2="1"><stop offset="0" stop-color="${CN.wood0}"/><stop offset=".45" stop-color="${CN.wood2}"/><stop offset="1" stop-color="${CN.wood1}"/></linearGradient>
    <pattern id="cn-grain" width="24" height="900" patternUnits="userSpaceOnUse">${grain}</pattern>
    <pattern id="cn-brush" width="600" height="6" patternUnits="userSpaceOnUse">${brush}</pattern>
    <radialGradient id="cn-vu" cx=".5" cy="1" r="1.05"><stop offset="0" stop-color="#FFF4D2"/><stop offset=".55" stop-color="#F6E2AE"/><stop offset="1" stop-color="#D9B675"/></radialGradient>
    <linearGradient id="cn-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".38"/><stop offset=".5" stop-color="#FFFFFF" stop-opacity=".06"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
    <linearGradient id="cn-key" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7F1E3"/><stop offset=".8" stop-color="#E2D6BC"/><stop offset="1" stop-color="#C7B794"/></linearGradient>
    <linearGradient id="cn-keydown" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DCCFB2"/><stop offset="1" stop-color="#CDBD99"/></linearGradient>
    <radialGradient id="cn-knob" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#5A5650"/><stop offset=".6" stop-color="#26231F"/><stop offset="1" stop-color="#0E0C0A"/></radialGradient>
    <radialGradient id="cn-skirt" cx=".5" cy=".5" r=".5"><stop offset=".7" stop-color="#1C1915"/><stop offset="1" stop-color="#3A3530"/></radialGradient>
    <linearGradient id="cn-drum" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050403"/><stop offset=".25" stop-color="#2A2622"/><stop offset=".5" stop-color="#3A3530"/><stop offset=".75" stop-color="#2A2622"/><stop offset="1" stop-color="#050403"/></linearGradient>
    <linearGradient id="cn-oxide" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${CN.oxide0}"/><stop offset="1" stop-color="${CN.oxide1}"/></linearGradient>
    <linearGradient id="cn-chrome" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8E8A84"/><stop offset=".45" stop-color="#F2EFE9"/><stop offset="1" stop-color="#77736D"/></linearGradient>
    <linearGradient id="cn-leather" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4A2E1E"/><stop offset=".5" stop-color="#2E1C12"/><stop offset="1" stop-color="#1C110A"/></linearGradient>
    <filter id="cn-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3.2"/></filter>
    <filter id="cn-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.2"/></filter>
  </defs>`
}
/* engraved: dark letters with a light edge under them */
const cnEng = (x, y, s, o = {}) => tx(x, y + .9, s, Object.assign({ f: cnFont.eng, z: 9, w: 600, ls: 1.2, c: '#FFFFFF', a: .55 }, o, { c: '#FFFFFF', a: .55 })) + tx(x, y, s, Object.assign({ f: cnFont.eng, z: 9, w: 600, ls: 1.2, c: CN.ink }, o))
const cnScrew = (x, y, rot = 30) => ci(x, y, 3.6, { fill: 'url(#cn-chrome)', stroke: '#6E675E', sw: .5 }) + ln(x - 2.6 * Math.cos(rot * Math.PI / 180), y - 2.6 * Math.sin(rot * Math.PI / 180), x + 2.6 * Math.cos(rot * Math.PI / 180), y + 2.6 * Math.sin(rot * Math.PI / 180), '#4A443C', 1)
/* masking tape with a name written on it in marker */
function cnTape (x, y, w, s, rot = -1.2, z = 15) {
  const h = z * 1.55
  return gr(pa(`M${x} ${y + 1}L${x + 3} ${y}L${x + w - 2} ${y + .6}L${x + w} ${y + 2}L${x + w - 1.5} ${y + h - 1}L${x + w} ${y + h}L${x + 2} ${y + h - .5}L${x} ${y + h - 1.6}Z`, { fill: CN.mask, more: ' filter="drop-shadow(0 1px 1px rgba(0,0,0,.25))"' }) + rc(x, y, w, h, { fill: '#C9B98F', fa: .12 }) + tx(x + 8, y + h * .72, s, { f: cnFont.hand, z, c: '#1F1A15' }), `rotate(${rot} ${x + w / 2} ${y + h / 2})`)
}
/* a VU meter: its needle at db */
let cnVuN = 0
function cnVu (x, y, w, h, db) {
  const id = 'cnvu' + (cnVuN++), px = x + w / 2, py = y + h + 10, R = h - 16, lin = v => Math.pow(10, v / 20), fr = v => (lin(v) - lin(-20)) / (lin(3) - lin(-20)), ang = v => (-41 + 82 * fr(Math.max(-22, Math.min(3.5, v)))) * Math.PI / 180
  const pt = (a, rr) => [px + rr * Math.sin(a), py - rr * Math.cos(a)]
  let s = rc(x - 3, y - 3, w + 6, h + 6, { rx: 6, fill: '#0B0806' }) + rc(x, y, w, h, { rx: 3, fill: 'url(#cn-vu)' })
  s += `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/></clipPath>`
  let face = ''
  const marks = [-20, -10, -7, -5, -3, -2, -1, 0, 1, 2, 3]
  const [a0x, a0y] = pt(ang(0), R + 1), [a3x, a3y] = pt(ang(3), R + 1)
  face += pa(`M${nn(a0x)} ${nn(a0y)}A${R + 1} ${R + 1} 0 0 1 ${nn(a3x)} ${nn(a3y)}`, { stroke: CN.red, sw: 2.6 })
  const [l0x, l0y] = pt(ang(-20), R - 2), [l1x, l1y] = pt(ang(3), R - 2)
  face += pa(`M${nn(l0x)} ${nn(l0y)}A${R - 2} ${R - 2} 0 0 1 ${nn(l1x)} ${nn(l1y)}`, { stroke: '#2A2018', sw: .8 })
  for (const m of marks) {
    const a = ang(m), [ix, iy] = pt(a, R - 2), [ox, oy] = pt(a, R + (m === 0 || m === -20 ? 6 : 4)), [tx0, ty0] = pt(a, R + 11)
    face += ln(ix, iy, ox, oy, m > 0 ? CN.red : '#2A2018', m === 0 ? 1.4 : 1)
    face += tx(tx0, ty0 + 2.6, String(Math.abs(m)), { f: cnFont.eng, z: 7.5, w: 600, c: m > 0 ? CN.red : '#2A2018', anchor: 'middle' })
  }
  for (let v = -18; v < 3; v += 1) if (!marks.includes(v)) { const [ix, iy] = pt(ang(v), R - 2), [ox, oy] = pt(ang(v), R + 1.5); face += ln(ix, iy, ox, oy, '#2A2018', .6) }
  face += tx(x + 8, y + 12, '−', { f: cnFont.eng, z: 9, w: 700, c: '#2A2018' }) + tx(x + w - 8, y + 12, '+', { f: cnFont.eng, z: 9, w: 700, c: CN.red, anchor: 'end' })
  face += tx(px, y + h - 21, 'VU', { f: cnFont.eng, z: 13, w: 700, ls: 1, c: '#2A2018', anchor: 'middle' })
  const a = ang(db), [nx, ny] = pt(a, R + 7), [sx, sy] = pt(a, 18)
  face += ln(sx + 1.6, sy + 1.6, nx + 1.6, ny + 1.6, '#000000', 1.4, .18) + ln(sx, sy, nx, ny, '#16110C', 1.25)
  face += pa(`M${x} ${y + h}L${x} ${y + h - 9}Q${px} ${y + h - 20} ${x + w} ${y + h - 9}L${x + w} ${y + h}Z`, { fill: '#1A140F' })
  face += rc(x, y, w, h * .5, { fill: 'url(#cn-glass)' })
  s += gr(face, '', ` clip-path="url(#${id})"`)
  return s
}
/* knobs: a chicken-head pointer, or a round cap with a line; angle 0 is straight up */
function cnKnob (x, y, r, angle, o = {}) {
  const { cap = null, kind = 'round', scale = false } = o
  let s = ''
  if (scale) for (let k = 0; k <= 10; k++) { const a = (-135 + k * 27) * Math.PI / 180; s += ln(x + (r + 4) * Math.sin(a), y - (r + 4) * Math.cos(a), x + (r + 8) * Math.sin(a), y - (r + 8) * Math.cos(a), CN.ink, k % 5 ? .7 : 1.2) }
  s += ci(x + 1.2, y + 2, r, { fill: '#000000', fa: .25 }) + ci(x, y, r, { fill: 'url(#cn-skirt)' })
  if (kind === 'chicken') {
    const p = `M0 ${-r * 1.25}C${r * .32} ${-r * 1.2} ${r * .52} ${-r * .2} ${r * .55} ${r * .35}C${r * .5} ${r * .8} ${-r * .5} ${r * .8} ${-r * .55} ${r * .35}C${-r * .52} ${-r * .2} ${-r * .32} ${-r * 1.2} 0 ${-r * 1.25}Z`
    s += gr(pa(p, { fill: 'url(#cn-knob)', stroke: '#000', sw: .5 }) + ln(0, -r * 1.12, 0, -r * .3, '#F2EAD8', 1.6, 1, ' stroke-linecap="round"'), `translate(${nn(x)} ${nn(y)}) rotate(${angle})`)
  } else {
    s += ci(x, y, r * .78, { fill: 'url(#cn-knob)', stroke: '#000', sw: .4 })
    if (cap) s += ci(x, y, r * .5, { fill: cap }) + ci(x - r * .12, y - r * .14, r * .22, { fill: '#FFFFFF', fa: .25 })
    s += gr(ln(0, -r * .74, 0, -r * .3, '#F2EAD8', 1.6, 1, ' stroke-linecap="round"'), `translate(${nn(x)} ${nn(y)}) rotate(${angle})`)
  }
  return s
}
/* a lamp push button */
function cnLamp (x, y, w, h, label, on, col) {
  let s = rc(x - 1, y - 1, w + 2, h + 2, { rx: 2.5, fill: '#0E0B08' })
  if (on) s += rc(x - 3, y - 3, w + 6, h + 6, { rx: 4, fill: col, fa: .55, more: ' filter="url(#cn-glow)"' })
  s += rc(x, y, w, h, { rx: 2, fill: on ? col : '#3A3129' }) + rc(x, y, w, h * .45, { rx: 2, fill: '#FFFFFF', fa: on ? .28 : .06 })
  s += tx(x + w / 2, y + h / 2 + 3.2, label, { f: cnFont.eng, z: 8.5, w: 700, ls: .6, c: on ? '#2A1A0E' : '#B9A98E', anchor: 'middle' })
  return s
}
/* a bat-handle toggle */
function cnToggle (x, y, label, on) {
  let s = ci(x, y, 9, { fill: 'url(#cn-chrome)', stroke: '#5A544C', sw: .6 }) + ci(x, y, 5.5, { fill: '#3B3631' })
  const d = on ? -1 : 1
  s += pa(`M${x - 3.2} ${y}L${x - 2.2} ${y + d * 24}Q${x} ${y + d * 28} ${x + 2.2} ${y + d * 24}L${x + 3.2} ${y}Z`, { fill: 'url(#cn-chrome)', stroke: '#6A645B', sw: .5 })
  s += ci(x + 15, y - 24, 3, { fill: on ? CN.red : '#4A2A24' }) + (on ? ci(x + 15, y - 24, 6, { fill: CN.red, fa: .5, more: ' filter="url(#cn-glow)"' }) : '')
  s += cnEng(x, y + 46, label, { z: 9, anchor: 'middle' }) + cnEng(x, y - 32, 'ON', { z: 7, anchor: 'middle', c: CN.ink2 })
  return s
}
/* a mechanical counter: drums of digits, the last one turning */
function cnCounter (x, y, groups, label) {
  const dw = 22, dh = 40
  let s = '', cx = x
  const total = groups.reduce((a, g) => a + g.length * dw, 0) + (groups.length - 1) * 10 + 14, cid = 'cnc' + x
  s += rc(x - 7, y - 7, total, dh + 14, { rx: 4, fill: '#120E0A' }) + rc(x - 7, y - 7, total, 4, { rx: 2, fill: '#000000', fa: .4 })
  s += `<clipPath id="${cid}"><rect x="${x - 7}" y="${y}" width="${total}" height="${dh}"/></clipPath><g clip-path="url(#${cid})">`
  groups.forEach((g, gi) => {
    for (let k = 0; k < g.length; k++) {
      const ch = g[k], last = gi === groups.length - 1 && k === g.length - 1
      s += rc(cx, y, dw - 2, dh, { fill: 'url(#cn-drum)' })
      if (last) s += tx(cx + (dw - 2) / 2, y + dh / 2 - 2, ch, { f: cnFont.dig, z: 22, w: 600, c: '#F4EEE2', anchor: 'middle' }) + tx(cx + (dw - 2) / 2, y + dh / 2 + 30, String((+ch + 1) % 10), { f: cnFont.dig, z: 22, w: 600, c: '#F4EEE2', anchor: 'middle', a: .9 })
      else s += tx(cx + (dw - 2) / 2, y + dh / 2 + 8, ch, { f: cnFont.dig, z: 22, w: 600, c: '#F4EEE2', anchor: 'middle' })
      s += rc(cx, y, dw - 2, dh, { fill: 'url(#cn-drum)', fa: .35 })
      cx += dw
    }
    if (gi < groups.length - 1) { s += ci(cx + 3, y + dh - 6, 1.6, { fill: '#F4EEE2', fa: .7 }); cx += 10 }
  })
  s += '</g>'
  s += rc(x - 7, y - 7, total, (dh + 14) * .45, { rx: 4, fill: 'url(#cn-glass)' })
  return s + cnEng(x - 4, y - 13, label, { z: 9 })
}
/* a piano-key transport button */
function cnKey (x, y, w, h, glyph, label, down, lamp) {
  const dy = down ? 4 : 0
  let s = rc(x, y + 6, w, h, { rx: 3, fill: '#0F0B08' })
  s += rc(x, y + dy, w, h, { rx: 3, fill: down ? 'url(#cn-keydown)' : 'url(#cn-key)', stroke: '#9C8C6C', sw: .6 })
  s += rc(x + 2, y + dy + h - 7, w - 4, 4, { rx: 1.5, fill: '#000000', fa: .08 })
  s += glyph(x + w / 2, y + dy + h * .42) + tx(x + w / 2, y + dy + h - 11, label, { f: cnFont.eng, z: 9.5, w: 700, ls: 1.4, c: CN.ink, anchor: 'middle' })
  if (lamp) s += ci(x + w - 10, y + dy + 10, 3.2, { fill: lamp }) + ci(x + w - 10, y + dy + 10, 7, { fill: lamp, fa: .5, more: ' filter="url(#cn-glow)"' })
  return s
}
const cnTri = (x, y, s, dir = 1, c = CN.ink) => pa(`M${x - s * .5 * dir} ${y - s * .6}L${x + s * .6 * dir} ${y}L${x - s * .5 * dir} ${y + s * .6}Z`, { fill: c })

/* the wood at either side, and a panel of brushed metal */
const cnCheeks = () => rc(0, 0, 24, TH, { fill: 'url(#cn-wood)' }) + rc(0, 0, 24, TH, { fill: 'url(#cn-grain)' }) + rc(TW - 24, 0, 24, TH, { fill: 'url(#cn-wood)' }) + gr(rc(0, 0, 24, TH, { fill: 'url(#cn-grain)' }), `translate(${TW - 24} 0)`) + rc(23, 0, 1.2, TH, { fill: '#000', fa: .4 }) + rc(TW - 24.2, 0, 1.2, TH, { fill: '#000', fa: .4 })
const cnPanel = (x, y, w, h) => rc(x, y, w, h, { fill: CN.panel }) + rc(x, y, w, h, { fill: 'url(#cn-brush)' }) + rc(x, y, w, 1, { fill: '#FFFFFF', fa: .6 }) + rc(x, y + h - 1, w, 1, { fill: '#000000', fa: .25 })

/* ── the arrangement ── */
THEMES.console = () => {
  const song = tdSong(), T = song.tracks, head = song.head
  cnVuN = 0
  let s = cnDefs()
  s += rc(0, 0, TW, TH, { fill: CN.deep })
  /* the meter bridge */
  s += cnPanel(24, 0, TW - 48, 160)
  s += rc(40, 16, TW - 80, 112, { rx: 6, fill: '#120D09' }) + rc(40, 16, TW - 80, 3, { rx: 2, fill: '#000', fa: .5 })
  const mw = 116, mh = 84, gap = 12, n = T.length, x0m = 40 + 14
  T.forEach((t, i) => { const x = x0m + i * (mw + gap); s += cnVu(x, 30, mw, mh, tdLevel(t, head)) })
  const mx = x0m + n * (mw + gap) + 26
  s += cnVu(mx, 30, mw, mh, -2.2) + cnVu(mx + mw + gap, 30, mw, mh, -1.6)
  T.forEach((t, i) => { const x = x0m + i * (mw + gap); s += cnEng(x + 2, 146, String(i + 1).padStart(2, '0'), { z: 10 }) + cnTape(x + 22, 132, mw - 26, t.name, (i % 2 ? .9 : -1.1), 13) })
  s += cnTape(mx + 6, 132, mw * 2 + gap - 12, 'mix  L  R', .6, 13)
  /* the ruler: bars engraved, markers on yellow tape flags, the cycle in grease pencil */
  const L = 322, R = TW - 24, top = 168, rulerH = 34, laneTop = top + rulerH + 4, foot = 752
  tdMap(L + 8, R - 8, 1, song.end + 1)
  s += cnPanel(24, top - 6, TW - 48, rulerH + 8)
  for (let b = 1; b <= song.end; b++) { const x = bx(b); if ((b - 1) % 4 === 0) s += ln(x, top + 18, x, top + rulerH, CN.ink, 1) + cnEng(x + 3, top + rulerH - 4, String(b), { z: 10, ls: .2 }); else s += ln(x, top + 26, x, top + rulerH, CN.ink, .7, .6) }
  const cy0 = bx(song.cycle.a + 1), cy1 = bx(song.cycle.b + 1)
  s += pa(`M${cy0} ${top + 14}L${cy0 + 2} ${top + 6}L${cy1 - 2} ${top + 5.4}L${cy1} ${top + 14}`, { stroke: '#B3261E', sw: 3.2, cap: 'round', join: 'round', sa: .85 }) + pa(`M${cy0 + 3} ${top + 7.4}L${cy1 - 4} ${top + 6.6}`, { stroke: '#D0453B', sw: 1.4, sa: .6 })
  /* heads */
  s += cnPanel(24, laneTop - 2, L - 24, foot - laneTop + 4)
  s += rc(L, laneTop - 2, R - L, foot - laneTop + 4, { fill: CN.tape })
  const rh = (foot - laneTop) / T.length
  for (let b = 1; b <= song.end; b++) { const x = bx(b); s += ln(x, laneTop, x, foot, '#E9D9B4', (b - 1) % 4 ? .5 : .8, (b - 1) % 4 ? .035 : .09) }
  s += rc(cy0, laneTop, cy1 - cy0, foot - laneTop, { fill: '#C0392B', fa: .05 })
  T.forEach((t, i) => {
    const y = laneTop + i * rh
    s += ln(24, y + rh, L, y + rh, '#000', .8, .2) + ln(24, y + rh + 1, L, y + rh + 1, '#FFF', .8, .5)
    s += ln(L, y + rh, R, y + rh, '#000', 1, .6)
    s += cnScrew(34, y + 10, 20 + i * 37) + cnEng(32, y + rh / 2 + 9, String(i + 1).padStart(2, '0'), { z: 13, ls: .4 })
    s += cnTape(58, y + rh / 2 - 15, 118, t.name, (i % 3) - 1, 16)
    if (t.theirs) s += tx(64, y + rh - 6, 'with ' + t.theirs, { f: cnFont.hand, z: 9, c: '#6B5B4A', a: .8, rot: -1 })
    s += cnLamp(190, y + rh / 2 - 9, 22, 18, 'R', i === 4, CN.red) + cnLamp(216, y + rh / 2 - 9, 22, 18, 'M', !!t.mute, CN.amber) + cnLamp(242, y + rh / 2 - 9, 22, 18, 'S', !!t.solo, CN.green)
    s += cnKnob(290, y + rh / 2, 11, ((t.vol || 0) + 10) * 9 - 60, { kind: 'chicken' })
    /* the tape */
    const yc = y + rh / 2, hh = rh / 2 - 9
    for (const g of tdRegs(t, L, R)) {
      s += rc(g.xa + .5, y + 6, g.w - 1, rh - 12, { rx: 3, fill: 'url(#cn-oxide)', stroke: '#6A4C34', sw: .8 }) + rc(g.xa + 2, y + 7, g.w - 4, 1.2, { fill: '#FFFFFF', fa: .08 })
      if (tdIsNotes(t, g.r)) { const { d, tr } = tdNotes(g, y + 9, rh - 18); s += gr(pa(d, { stroke: CN.wave, sw: 2.4, cap: 'round', sa: .9 }), tr) }
      else s += pa(tdWave(g, yc, hh), { fill: CN.wave, fa: .9 })
      if (g.r.name && g.r.name !== t.name) s += tx(g.xa + 6, y + 18, g.r.name, { f: cnFont.hand, z: 9, c: '#F1CF63', a: .9 })
    }
  })
  /* markers: yellow tape flags hanging from the ruler */
  for (const sc of song.scenes) {
    const x = bx(sc.a), w = tw2(sc.name, cnFont.hand, 11) + 16, rot = ((sc.i * 37) % 5) - 2
    s += ln(x, top + 2, x, laneTop + 6, '#1B140E', 1.2, .7)
    s += gr(rc(x + 1, top - 3, w, 18, { fill: CN.yellow, more: ' filter="drop-shadow(0 1px 1px rgba(0,0,0,.3))"' }) + tx(x + 8, top + 10, sc.name, { f: cnFont.hand, z: 11, c: '#2A1E10' }), `rotate(${rot * .4} ${x} ${top})`)
  }
  /* the playhead: a tape head on the ruler, an amber line down the tape */
  const hx = bx(head + 1)
  s += ln(hx, laneTop - 2, hx, foot, CN.amber, 5, .25, ' filter="url(#cn-soft)"') + ln(hx, laneTop - 2, hx, foot, CN.amber, 1.4)
  s += rc(hx - 9, top + 2, 18, rulerH - 4, { rx: 2, fill: 'url(#cn-chrome)', stroke: '#5E5850', sw: .6 }) + rc(hx - 1, top + 4, 2, rulerH - 8, { fill: '#2B2622' })
  /* the deck: counters, the keys of the machine, switches and dials */
  const dy = 762
  s += cnPanel(24, dy, TW - 48, TH - dy) + rc(24, dy, TW - 48, 3, { fill: '#000', fa: .35 })
  s += cnScrew(40, dy + 16) + cnScrew(40, TH - 16, 70) + cnScrew(TW - 40, dy + 16, 110) + cnScrew(TW - 40, TH - 16, 10)
  s += cnCounter(70, dy + 46, [['0', '2', '0'], ['1'], ['1']], 'BAR        BEAT    DIV')
  s += cnCounter(250, dy + 46, [['0'], ['4', '9'], ['5']], 'MIN    SEC        TENTH')
  const keys = [
    ['REW', (x, y) => cnTri(x - 6, y, 13, -1) + cnTri(x + 6, y, 13, -1)], ['F.FWD', (x, y) => cnTri(x - 6, y, 13) + cnTri(x + 6, y, 13)],
    ['STOP', (x, y) => rc(x - 8, y - 8, 16, 16, { fill: CN.ink })], ['PLAY', (x, y) => cnTri(x + 1, y, 18)], ['REC', (x, y) => ci(x, y, 8.5, { fill: CN.red })],
  ]
  const kw = 84, kh = 70, kx0 = 470
  keys.forEach(([label, g], i) => { s += cnKey(kx0 + i * (kw + 7), dy + 30, kw, kh, g, label, label === 'PLAY', label === 'PLAY' ? '#7FD36F' : null) })
  s += cnToggle(960, dy + 70, 'CYCLE', true) + cnToggle(1020, dy + 70, 'CLICK', false) + cnToggle(1080, dy + 70, 'COUNT', false)
  /* tempo: a dial */
  const tdx = 1180, tdy = dy + 66
  s += ci(tdx, tdy, 38, { fill: '#F4ECDB', stroke: '#8D7D60', sw: 1 })
  for (let k = 0; k <= 12; k++) { const a = (-130 + k * (260 / 12)) * Math.PI / 180, big = k % 3 === 0; s += ln(tdx + 30 * Math.sin(a), tdy - 30 * Math.cos(a), tdx + (big ? 36 : 34) * Math.sin(a), tdy - (big ? 36 : 34) * Math.cos(a), CN.ink, big ? 1.2 : .6); if (big) s += tx(tdx + 23 * Math.sin(a), tdy - 23 * Math.cos(a) + 3, String(60 + k * 10), { f: cnFont.eng, z: 7.5, w: 600, c: CN.ink, anchor: 'middle' }) }
  const ta = (-130 + (song.tempo - 60) / 120 * 260) * Math.PI / 180
  s += ln(tdx, tdy, tdx + 31 * Math.sin(ta), tdy - 31 * Math.cos(ta), CN.red, 1.4) + ci(tdx, tdy, 4, { fill: CN.ink })
  s += cnEng(tdx, dy + 122, 'TEMPO  92.00', { z: 9, anchor: 'middle' })
  /* grid and nudge: rotary selectors */
  const sel = (x, label, items, on) => { let o = cnKnob(x, dy + 70, 14, -75 + on * (150 / (items.length - 1)), { kind: 'chicken' }); items.forEach((t2, k) => { const a = (-75 + k * (150 / (items.length - 1))) * Math.PI / 180; o += tx(x + 32 * Math.sin(a), dy + 70 - 30 * Math.cos(a) + 3, t2, { f: cnFont.eng, z: 7.5, w: k === on ? 700 : 600, c: k === on ? CN.red : CN.ink, anchor: 'middle' }) }); return o + cnEng(x, dy + 122, label, { anchor: 'middle' }) }
  s += sel(1282, 'GRID', ['1/2', '1/4', '1/8', '1/16'], 1) + sel(1370, 'NUDGE', ['BAR', 'BEAT', '1/16', 'TICK'], 1)
  s += cnEng(70, dy + 124, 'SLUR STUDIO', { z: 10, ls: 3 }) + tx(170, dy + 124, song.name, { f: cnFont.hand, z: 11, c: '#2A1E10' })
  s += cnEng(250 + 150, dy + 124, '4 / 4', { z: 10 })
  s += cnCheeks()
  return s
}

/* ── the mixer, as a console: a VU meter and a big level knob where the fader was ── */
THEMES.consoleMixer = () => {
  const song = tdSong(), T = song.tracks.concat([{ name: 'plate', vol: 0, regs: [], bus: true }]), head = song.head
  cnVuN = 0
  let s = cnDefs() + rc(0, 0, TW, TH, { fill: CN.deep })
  const masterW = 200, n = T.length, sw = (TW - 48 - masterW) / n, top = 150
  /* the meter bridge */
  s += cnPanel(24, 0, TW - 48, top) + rc(36, 14, TW - 72, 104, { rx: 6, fill: '#120D09' })
  T.forEach((t, i) => { const x = 24 + i * sw + (sw - 112) / 2; s += cnVu(x, 26, 112, 80, t.bus ? -4 : tdLevel(t, head)) })
  s += cnVu(24 + n * sw + 22, 26, 76, 80, -2.2) + cnVu(24 + n * sw + 106, 26, 76, 80, -1.6)
  s += cnEng(24 + n * sw + 100, 136, 'MIX', { z: 11, anchor: 'middle', ls: 3 })
  /* strips */
  T.forEach((t, i) => {
    const x = 24 + i * sw, cx = x + sw / 2
    s += cnPanel(x, top, sw, TH - top) + rc(x + sw - 2, top, 2, TH - top, { fill: '#000', fa: .35 }) + rc(x + sw - 3, top, 1, TH - top, { fill: '#fff', fa: .4 })
    s += cnScrew(x + 10, top + 12, 30 + i * 20) + cnScrew(x + sw - 12, top + 12, 80 + i * 13)
    s += cnEng(cx, top + 34, 'INPUT', { anchor: 'middle' }) + cnKnob(cx, top + 58, 13, -40 + i * 11, { cap: CN.red })
    s += cnEng(cx, top + 92, 'EQUALISER', { anchor: 'middle', z: 8 })
    const eq = [['HF', '#3D6EA8', -20], ['HMF', '#4B8B5A', 30], ['LMF', '#4B8B5A', -50], ['LF', '#7B4B2A', 20]]
    eq.forEach(([lab, col, a], k) => { const ex = cx + (k % 2 ? 22 : -22), ey = top + 122 + Math.floor(k / 2) * 52 + (k % 2 ? 14 : 0); s += cnKnob(ex, ey, 12, a + i * 7, { cap: col }) + cnEng(ex, ey + 25, lab, { anchor: 'middle', z: 8 }) })
    s += cnEng(cx, top + 250, 'SENDS', { anchor: 'middle', z: 8 }) + cnKnob(cx - 22, top + 276, 10, i === 4 || i === 6 ? 40 : -120) + cnKnob(cx + 22, top + 276, 10, -120) + cnEng(cx - 22, top + 298, 'PLATE', { anchor: 'middle', z: 7 }) + cnEng(cx + 22, top + 298, 'B', { anchor: 'middle', z: 7 })
    s += cnEng(cx, top + 322, 'PAN', { anchor: 'middle', z: 8 }) + cnKnob(cx, top + 348, 14, ((t.pan || 0) * 120), { kind: 'chicken' }) + cnEng(cx - 26, top + 352, 'L', { z: 7, anchor: 'middle' }) + cnEng(cx + 26, top + 352, 'R', { z: 7, anchor: 'middle' })
    s += cnLamp(cx - 36, top + 380, 22, 18, 'R', i === 4, CN.red) + cnLamp(cx - 11, top + 380, 22, 18, 'M', i === 2, CN.amber) + cnLamp(cx + 14, top + 380, 22, 18, 'S', false, CN.green)
    /* the level: a big knob on a scale of decibels */
    const ky = top + 470, kr = 30, dbs = [[-60, '∞'], [-30, '30'], [-20, '20'], [-10, '10'], [-5, '5'], [0, '0'], [5, '5'], [10, '10']]
    const angOf = v => { const t2 = Math.max(0, Math.min(1, (v + 60) / 70)); return -140 + Math.pow(t2, 2.2) * 280 }
    for (const [v, lab] of dbs) { const a = angOf(v) * Math.PI / 180; s += ln(cx + (kr + 5) * Math.sin(a), ky - (kr + 5) * Math.cos(a), cx + (kr + 10) * Math.sin(a), ky - (kr + 10) * Math.cos(a), v === 0 ? CN.red : CN.ink, v === 0 ? 1.6 : 1) + tx(cx + (kr + 18) * Math.sin(a), ky - (kr + 18) * Math.cos(a) + 3, lab, { f: cnFont.eng, z: 7.5, w: 600, c: v === 0 ? CN.red : CN.ink, anchor: 'middle' }) }
    s += cnKnob(cx, ky, kr, angOf(t.vol || 0), { cap: '#E9E1CF' })
    s += cnEng(cx, ky + kr + 30, ((t.vol || 0) > 0 ? '+' : '') + (t.vol || 0).toFixed(1), { anchor: 'middle', z: 11 })
    s += cnTape(x + 8, top + 548, sw - 16, t.name, (i % 3 - 1) * .8, 14)
    s += cnEng(x + 10, top + 590, String(i + 1).padStart(2, '0'), { z: 10 })
  })
  /* the master section */
  const mx = 24 + n * sw
  s += cnPanel(mx, top, masterW, TH - top) + cnEng(mx + masterW / 2, top + 40, 'MASTER', { anchor: 'middle', z: 11, ls: 3 })
  const mky = top + 300
  for (let k = 0; k <= 10; k++) { const a = (-140 + k * 28) * Math.PI / 180; s += ln(mx + masterW / 2 + 50 * Math.sin(a), mky - 50 * Math.cos(a), mx + masterW / 2 + 58 * Math.sin(a), mky - 58 * Math.cos(a), k === 8 ? CN.red : CN.ink, k % 2 ? .8 : 1.4) }
  s += cnKnob(mx + masterW / 2, mky, 44, 80, { cap: '#E9E1CF' }) + cnEng(mx + masterW / 2, mky + 82, 'OUT  −4.2', { anchor: 'middle', z: 11 })
  s += rc(mx + 26, top + 430, masterW - 52, 64, { rx: 3, fill: '#1A140F' }) + tx(mx + masterW / 2, top + 458, 'SLUR', { f: cnFont.eng, z: 20, w: 700, ls: 7, c: '#E4D9C2', anchor: 'middle' }) + tx(mx + masterW / 2, top + 480, 'STUDIO  CONSOLE', { f: cnFont.eng, z: 9, w: 600, ls: 3, c: CN.amber, anchor: 'middle' })
  s += cnTape(mx + 20, top + 520, masterW - 40, song.name, -.8, 14)
  /* the armrest */
  s += rc(24, TH - 128, TW - 48, 128, { fill: 'url(#cn-leather)' }) + rc(24, TH - 128, TW - 48, 2, { fill: '#000', fa: .5 })
  s += pa(`M24 ${TH - 112}H${TW - 24}`, { stroke: '#7A5236', sw: 1, more: ' stroke-dasharray="5 4"', sa: .7 }) + pa(`M24 ${TH - 18}H${TW - 24}`, { stroke: '#7A5236', sw: 1, more: ' stroke-dasharray="5 4"', sa: .5 })
  s += rc(24, TH - 126, TW - 48, 40, { fill: '#FFFFFF', fa: .04 })
  s += cnCheeks()
  return s
}
