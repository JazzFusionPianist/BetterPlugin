/* ── theme: console — a tape room of the seventies, at the room's own size ──
   Draft 2: everything at the density of the room as it comes; labels in IBM Plex Sans Condensed, engraved, small and
   spaced as a desk's are; names typed on label tape (Courier Prime) as a track sheet has them; counters in Plex Mono. */
const CN = { wood0: '#2E1B10', wood1: '#5A361F', wood2: '#7B4B2A', panel: '#E2D7C0', ink: '#2A231B', ink2: '#6A5E50', deep: '#15100B', tape: '#1A130D', oxide0: '#4A3322', oxide1: '#382718', wave: '#E8D5AC', amber: '#FFB547', red: '#C0392B', green: '#5DAA57', yellow: '#EFCB62', mask: '#EEE6D2' }
const cnF = { eng: "'IBM Plex Sans Condensed', sans-serif", typed: "'Courier Prime', monospace", mono: "'IBM Plex Mono', monospace" }

function cnDefs () {
  const r = rnd(7)
  let grain = ''
  for (let i = 0; i < 16; i++) { const x = r() * 12, a = .12 + r() * .25; let d = `M${nn(x)} 0`; for (let y = 0; y <= 900; y += 60) d += ` Q${nn(x + (r() - .5) * 4)} ${y + 30} ${nn(x + (r() - .5) * 3)} ${y + 60}`; grain += pa(d, { stroke: i % 3 ? '#1E1209' : '#9A6338', sw: .4 + r() * .9, sa: a }) }
  let brush = ''
  for (let i = 0; i < 18; i++) brush += rc(0, i / 3, 600, .33, { fill: r() > .5 ? '#FFFFFF' : '#000000', fa: .025 + r() * .04 })
  return `<defs>
    <linearGradient id="cn-wood" x1="0" x2="1"><stop offset="0" stop-color="${CN.wood0}"/><stop offset=".45" stop-color="${CN.wood2}"/><stop offset="1" stop-color="${CN.wood1}"/></linearGradient>
    <pattern id="cn-grain" width="12" height="900" patternUnits="userSpaceOnUse">${grain}</pattern>
    <pattern id="cn-brush" width="600" height="6" patternUnits="userSpaceOnUse">${brush}</pattern>
    <radialGradient id="cn-vu" cx=".5" cy="1" r="1.05"><stop offset="0" stop-color="#FFF4D2"/><stop offset=".55" stop-color="#F5E1AC"/><stop offset="1" stop-color="#D6B272"/></radialGradient>
    <linearGradient id="cn-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".32"/><stop offset=".5" stop-color="#FFFFFF" stop-opacity=".05"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
    <linearGradient id="cn-key" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F6F0E2"/><stop offset=".85" stop-color="#E0D4BA"/><stop offset="1" stop-color="#C6B693"/></linearGradient>
    <linearGradient id="cn-keydown" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D9CCAE"/><stop offset="1" stop-color="#CBBB97"/></linearGradient>
    <radialGradient id="cn-knob" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#5A5650"/><stop offset=".6" stop-color="#26231F"/><stop offset="1" stop-color="#0E0C0A"/></radialGradient>
    <radialGradient id="cn-skirt" cx=".5" cy=".5" r=".5"><stop offset=".7" stop-color="#1C1915"/><stop offset="1" stop-color="#3A3530"/></radialGradient>
    <linearGradient id="cn-drum" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050403"/><stop offset=".25" stop-color="#2A2622"/><stop offset=".5" stop-color="#36322D"/><stop offset=".75" stop-color="#2A2622"/><stop offset="1" stop-color="#050403"/></linearGradient>
    <linearGradient id="cn-oxide" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${CN.oxide0}"/><stop offset="1" stop-color="${CN.oxide1}"/></linearGradient>
    <linearGradient id="cn-chrome" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8E8A84"/><stop offset=".45" stop-color="#F2EFE9"/><stop offset="1" stop-color="#77736D"/></linearGradient>
    <linearGradient id="cn-leather" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4A2E1E"/><stop offset=".5" stop-color="#2E1C12"/><stop offset="1" stop-color="#1C110A"/></linearGradient>
    <filter id="cn-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.2"/></filter>
    <filter id="cn-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1"/></filter>
  </defs>`
}
/* engraved: small capitals of a desk, a light edge under them */
const cnEng = (x, y, s, o = {}) => { const base = Object.assign({ f: cnF.eng, z: 7.5, w: 600, ls: .9 }, o); return tx(x, y + .7, s, Object.assign({}, base, { c: '#FFFFFF', a: .5 })) + tx(x, y, s, Object.assign({ c: CN.ink }, base)) }
const cnScrew = (x, y, rot = 30) => ci(x, y, 2.6, { fill: 'url(#cn-chrome)', stroke: '#6E675E', sw: .4 }) + ln(x - 1.8 * Math.cos(rot * Math.PI / 180), y - 1.8 * Math.sin(rot * Math.PI / 180), x + 1.8 * Math.cos(rot * Math.PI / 180), y + 1.8 * Math.sin(rot * Math.PI / 180), '#4A443C', .8)
/* label tape with a name typed on it */
function cnTape (x, y, w, s, rot = 0, z = 10.5) {
  const h = z * 1.45
  return gr(pa(`M${x} ${y + .6}L${x + 2} ${y}L${x + w - 1.5} ${y + .4}L${x + w} ${y + 1.2}L${x + w - 1} ${y + h - .6}L${x + w} ${y + h}L${x + 1.5} ${y + h - .3}L${x} ${y + h - 1}Z`, { fill: CN.mask, more: ' filter="drop-shadow(0 .6px .6px rgba(0,0,0,.25))"' }) + tx(x + 6, y + h * .7, s, { f: cnF.typed, z, w: 700, c: '#211C17' }), rot ? `rotate(${rot} ${x + w / 2} ${y + h / 2})` : '')
}
let cnVuN = 0
function cnVu (x, y, w, h, db) {
  const id = 'cnvu' + (cnVuN++), px = x + w / 2, py = y + h + 8, R = h - 12, lin = v => Math.pow(10, v / 20), fr = v => (lin(v) - lin(-20)) / (lin(3) - lin(-20)), ang = v => (-42 + 84 * fr(Math.max(-22, Math.min(3.5, v)))) * Math.PI / 180
  const pt = (a, rr) => [px + rr * Math.sin(a), py - rr * Math.cos(a)]
  let s = rc(x - 2, y - 2, w + 4, h + 4, { rx: 4, fill: '#0B0806' }) + rc(x, y, w, h, { rx: 2, fill: 'url(#cn-vu)' })
  s += `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2"/></clipPath>`
  let face = ''
  const [a0x, a0y] = pt(ang(0), R + .5), [a3x, a3y] = pt(ang(3), R + .5), [l0x, l0y] = pt(ang(-20), R - 1.5), [l1x, l1y] = pt(ang(3), R - 1.5)
  face += pa(`M${nn(a0x)} ${nn(a0y)}A${R + .5} ${R + .5} 0 0 1 ${nn(a3x)} ${nn(a3y)}`, { stroke: CN.red, sw: 1.8 }) + pa(`M${nn(l0x)} ${nn(l0y)}A${R - 1.5} ${R - 1.5} 0 0 1 ${nn(l1x)} ${nn(l1y)}`, { stroke: '#2A2018', sw: .55 })
  for (const m of [-20, -10, -7, -5, -3, -2, -1, 0, 1, 2, 3]) {
    const a = ang(m), [ix, iy] = pt(a, R - 1.5), [ox, oy] = pt(a, R + (m === 0 || m === -20 ? 4 : 2.8)), [tx0, ty0] = pt(a, R + 8)
    face += ln(ix, iy, ox, oy, m > 0 ? CN.red : '#2A2018', m === 0 ? 1 : .7)
    if (m !== -1 && m !== 1 && m !== -2) face += tx(tx0, ty0 + 2, String(Math.abs(m)), { f: cnF.eng, z: 5.6, w: 600, c: m > 0 ? CN.red : '#2A2018', anchor: 'middle' })
  }
  face += tx(px, y + h - 15, 'VU', { f: cnF.eng, z: 7.5, w: 600, ls: .6, c: '#2A2018', anchor: 'middle' })
  const a = ang(db), [nx, ny] = pt(a, R + 5), [sx, sy] = pt(a, 12)
  face += ln(sx + 1.1, sy + 1.1, nx + 1.1, ny + 1.1, '#000000', 1, .16) + ln(sx, sy, nx, ny, '#16110C', .9)
  face += pa(`M${x} ${y + h}L${x} ${y + h - 6}Q${px} ${y + h - 14} ${x + w} ${y + h - 6}L${x + w} ${y + h}Z`, { fill: '#1A140F' }) + rc(x, y, w, h * .5, { fill: 'url(#cn-glass)' })
  return s + gr(face, '', ` clip-path="url(#${id})"`)
}
function cnKnob (x, y, r, angle, o = {}) {
  const { cap = null, kind = 'round' } = o
  let s = ci(x + .8, y + 1.3, r, { fill: '#000000', fa: .22 }) + ci(x, y, r, { fill: 'url(#cn-skirt)' })
  if (kind === 'chicken') {
    const p = `M0 ${-r * 1.25}C${r * .32} ${-r * 1.2} ${r * .52} ${-r * .2} ${r * .55} ${r * .35}C${r * .5} ${r * .8} ${-r * .5} ${r * .8} ${-r * .55} ${r * .35}C${-r * .52} ${-r * .2} ${-r * .32} ${-r * 1.2} 0 ${-r * 1.25}Z`
    s += gr(pa(p, { fill: 'url(#cn-knob)', stroke: '#000', sw: .4 }) + ln(0, -r * 1.1, 0, -r * .3, '#F2EAD8', Math.max(.9, r * .13), 1, ' stroke-linecap="round"'), `translate(${nn(x)} ${nn(y)}) rotate(${angle})`)
  } else {
    s += ci(x, y, r * .78, { fill: 'url(#cn-knob)', stroke: '#000', sw: .3 })
    if (cap) s += ci(x, y, r * .5, { fill: cap }) + ci(x - r * .12, y - r * .14, r * .2, { fill: '#FFFFFF', fa: .25 })
    s += gr(ln(0, -r * .74, 0, -r * .3, '#F2EAD8', Math.max(.9, r * .12), 1, ' stroke-linecap="round"'), `translate(${nn(x)} ${nn(y)}) rotate(${angle})`)
  }
  return s
}
function cnLamp (x, y, w, h, label, on, col) {
  let s = rc(x - .8, y - .8, w + 1.6, h + 1.6, { rx: 2, fill: '#0E0B08' })
  if (on) s += rc(x - 2, y - 2, w + 4, h + 4, { rx: 3, fill: col, fa: .5, more: ' filter="url(#cn-glow)"' })
  s += rc(x, y, w, h, { rx: 1.5, fill: on ? col : '#3A3129' }) + rc(x, y, w, h * .45, { rx: 1.5, fill: '#FFFFFF', fa: on ? .25 : .05 })
  return s + tx(x + w / 2, y + h / 2 + 2.5, label, { f: cnF.eng, z: 7, w: 600, c: on ? '#2A1A0E' : '#B5A58A', anchor: 'middle' })
}
function cnToggle (x, y, label, on) {
  let s = ci(x, y, 5.5, { fill: 'url(#cn-chrome)', stroke: '#5A544C', sw: .5 }) + ci(x, y, 3.4, { fill: '#3B3631' })
  const d = on ? -1 : 1
  s += pa(`M${x - 2} ${y}L${x - 1.4} ${y + d * 15}Q${x} ${y + d * 17.5} ${x + 1.4} ${y + d * 15}L${x + 2} ${y}Z`, { fill: 'url(#cn-chrome)', stroke: '#6A645B', sw: .4 })
  s += ci(x + 10, y - 15, 2, { fill: on ? CN.red : '#4A2A24' }) + (on ? ci(x + 10, y - 15, 4, { fill: CN.red, fa: .5, more: ' filter="url(#cn-glow)"' }) : '')
  return s + cnEng(x, y + 29, label, { anchor: 'middle' })
}
function cnCounter (x, y, groups, label) {
  const dw = 15, dh = 26, total = groups.reduce((a, g) => a + g.length * dw, 0) + (groups.length - 1) * 7 + 10, cid = 'cnc' + x
  let s = rc(x - 5, y - 5, total, dh + 10, { rx: 3, fill: '#120E0A' }) + `<clipPath id="${cid}"><rect x="${x - 5}" y="${y}" width="${total}" height="${dh}"/></clipPath><g clip-path="url(#${cid})">`
  let cx = x
  groups.forEach((g, gi) => {
    for (let k = 0; k < g.length; k++) {
      const ch = g[k], last = gi === groups.length - 1 && k === g.length - 1
      s += rc(cx, y, dw - 1.5, dh, { fill: 'url(#cn-drum)' })
      if (last) s += tx(cx + (dw - 1.5) / 2, y + dh / 2 - 1, ch, { f: cnF.mono, z: 14, w: 500, c: '#F4EEE2', anchor: 'middle' }) + tx(cx + (dw - 1.5) / 2, y + dh / 2 + 20, String((+ch + 1) % 10), { f: cnF.mono, z: 14, w: 500, c: '#F4EEE2', anchor: 'middle' })
      else s += tx(cx + (dw - 1.5) / 2, y + dh / 2 + 5, ch, { f: cnF.mono, z: 14, w: 500, c: '#F4EEE2', anchor: 'middle' })
      cx += dw
    }
    if (gi < groups.length - 1) { s += ci(cx + 2, y + dh - 5, 1.1, { fill: '#F4EEE2', fa: .7 }); cx += 7 }
  })
  return s + '</g>' + rc(x - 5, y - 5, total, (dh + 10) * .45, { rx: 3, fill: 'url(#cn-glass)' }) + cnEng(x - 3, y - 10, label)
}
function cnKey (x, y, w, h, glyph, label, down, lamp) {
  const dy = down ? 2.5 : 0
  let s = rc(x, y + 4, w, h, { rx: 2, fill: '#0F0B08' }) + rc(x, y + dy, w, h, { rx: 2, fill: down ? 'url(#cn-keydown)' : 'url(#cn-key)', stroke: '#9C8C6C', sw: .5 })
  s += glyph(x + w / 2, y + dy + h * .4) + tx(x + w / 2, y + dy + h - 7, label, { f: cnF.eng, z: 7, w: 600, ls: 1, c: CN.ink, anchor: 'middle' })
  if (lamp) s += ci(x + w - 7, y + dy + 7, 2.2, { fill: lamp }) + ci(x + w - 7, y + dy + 7, 4.5, { fill: lamp, fa: .5, more: ' filter="url(#cn-glow)"' })
  return s
}
const cnTri = (x, y, s, dir = 1, c = CN.ink) => pa(`M${x - s * .5 * dir} ${y - s * .6}L${x + s * .6 * dir} ${y}L${x - s * .5 * dir} ${y + s * .6}Z`, { fill: c })
const cnCheeks = () => rc(0, 0, 12, TH, { fill: 'url(#cn-wood)' }) + rc(0, 0, 12, TH, { fill: 'url(#cn-grain)' }) + rc(TW - 12, 0, 12, TH, { fill: 'url(#cn-wood)' }) + gr(rc(0, 0, 12, TH, { fill: 'url(#cn-grain)' }), `translate(${TW - 12} 0)`) + rc(11.5, 0, .8, TH, { fill: '#000', fa: .4 }) + rc(TW - 12.3, 0, .8, TH, { fill: '#000', fa: .4 })
const cnPanel = (x, y, w, h) => rc(x, y, w, h, { fill: CN.panel }) + rc(x, y, w, h, { fill: 'url(#cn-brush)' }) + rc(x, y, w, .8, { fill: '#FFFFFF', fa: .6 }) + rc(x, y + h - .8, w, .8, { fill: '#000000', fa: .25 })

THEMES.console = () => {
  const song = tdSong(), T = song.tracks, head = song.head
  cnVuN = 0
  let s = cnDefs() + rc(0, 0, TW, TH, { fill: CN.deep })
  /* the meter bridge */
  s += cnPanel(12, 0, TW - 24, 94) + rc(22, 8, TW - 44, 64, { rx: 4, fill: '#120D09' }) + rc(22, 8, TW - 44, 2, { rx: 1, fill: '#000', fa: .5 })
  const mw = 84, mh = 50
  T.forEach((t, i) => { const x = 32 + i * (mw + 8); s += cnVu(x, 15, mw, mh, tdLevel(t, head)) + cnEng(x + 1, 86, String(i + 1).padStart(2, '0')) + cnTape(x + 14, 76, mw - 14, t.name, 0, 9.5) })
  const mx = TW - 32 - mw * 2 - 8
  s += cnVu(mx, 15, mw, mh, -2.2) + cnVu(mx + mw + 8, 15, mw, mh, -1.6) + cnEng(mx + mw + 4, 86, 'MIX   LEFT   RIGHT', { anchor: 'middle', more: ' xml:space="preserve"' })
  const bx0 = 32 + T.length * (mw + 8) + 24
  s += rc(bx0, 20, mx - bx0 - 24, 40, { rx: 2, fill: '#1A140F' }) + tx(bx0 + 14, 38, 'SLUR STUDIO', { f: cnF.eng, z: 10, w: 600, ls: 3.2, c: '#E2D7C0' }) + tx(bx0 + 14, 52, 'CONSOLE 8   SERIES II', { f: cnF.eng, z: 7, w: 500, ls: 2.2, c: CN.amber, more: ' xml:space="preserve"' }) + tx(mx - 38, 46, song.name, { f: cnF.typed, z: 10, c: '#E2D7C0', anchor: 'end', a: .8 })
  /* the ruler, markers on tape flags, the cycle in grease pencil */
  const L = 236, R = TW - 12, top = 98, rulerH = 22, laneTop = top + rulerH + 3, rh = 52, foot = 818
  tdMap(L + 6, R - 6, 1, song.end + 1)
  s += cnPanel(12, top - 2, TW - 24, rulerH + 4)
  for (let b = 1; b <= song.end; b++) { const x = bx(b); if ((b - 1) % 4 === 0) s += ln(x, top + 13, x, top + rulerH, CN.ink, .8) + cnEng(x + 2.5, top + rulerH - 2.5, String(b), { z: 7, ls: .2 }); else s += ln(x, top + 17, x, top + rulerH, CN.ink, .5, .55) }
  const cy0 = bx(song.cycle.a + 1), cy1 = bx(song.cycle.b + 1)
  s += pa(`M${cy0} ${top + 10}L${cy0 + 1.5} ${top + 4.5}L${cy1 - 1.5} ${top + 4}L${cy1} ${top + 10}`, { stroke: '#B3261E', sw: 2.2, cap: 'round', join: 'round', sa: .85 })
  /* heads and tape */
  s += cnPanel(12, laneTop - 1, L - 12, foot - laneTop + 2) + rc(L, laneTop - 1, R - L, foot - laneTop + 2, { fill: CN.tape })
  for (let b = 1; b <= song.end; b++) { const x = bx(b); s += ln(x, laneTop, x, foot, '#E9D9B4', (b - 1) % 4 ? .4 : .7, (b - 1) % 4 ? .03 : .08) }
  for (let y = laneTop + T.length * rh; y < foot; y += rh) s += ln(L, y + rh, R, y + rh, '#000', .8, .45) + ln(12, y + rh, L, y + rh, '#000', .6, .15)
  s += rc(cy0, laneTop, cy1 - cy0, foot - laneTop, { fill: '#C0392B', fa: .045 })
  T.forEach((t, i) => {
    const y = laneTop + i * rh, mid = y + rh / 2
    s += ln(12, y + rh, L, y + rh, '#000', .6, .2) + ln(12, y + rh + .8, L, y + rh + .8, '#FFF', .6, .5) + ln(L, y + rh, R, y + rh, '#000', .8, .6)
    s += cnEng(20, mid + 3, String(i + 1).padStart(2, '0'), { z: 8.5, ls: .3 })
    s += cnTape(38, mid - 11, 96, t.name, ((i % 3) - 1) * .5, 10.5)
    if (t.theirs) s += tx(44, mid + 17, 'with ' + t.theirs, { f: cnF.typed, z: 8, c: '#7A6A58' })
    s += cnLamp(148, mid - 6.5, 15, 13, 'R', i === 4, CN.red) + cnLamp(166, mid - 6.5, 15, 13, 'M', !!t.mute, CN.amber) + cnLamp(184, mid - 6.5, 15, 13, 'S', !!t.solo, CN.green)
    s += cnKnob(216, mid, 7.5, ((t.vol || 0) + 10) * 9 - 60, { kind: 'chicken' })
    for (const g of tdRegs(t, L, R)) {
      s += rc(g.xa + .5, y + 4, g.w - 1, rh - 8, { rx: 2, fill: 'url(#cn-oxide)', stroke: '#664A33', sw: .6 }) + rc(g.xa + 1.5, y + 4.8, g.w - 3, .8, { fill: '#FFFFFF', fa: .07 })
      if (tdIsNotes(t, g.r)) { const { d, tr } = tdNotes(g, y + 7, rh - 14); s += gr(pa(d, { stroke: CN.wave, sw: 1.6, cap: 'round', sa: .9 }), tr) }
      else s += pa(tdWave(g, mid, rh / 2 - 7), { fill: CN.wave, fa: .88 })
      if (g.r.name && g.r.name !== t.name) s += tx(g.xa + 5, y + 13, g.r.name, { f: cnF.typed, z: 8, w: 700, c: CN.yellow, a: .9 })
    }
  })
  for (const sc of song.scenes) {
    const x = bx(sc.a), w = tw2(sc.name, cnF.typed, 8.5, 700) + 10
    s += ln(x, top + 1, x, laneTop + 3, '#1B140E', .9, .7) + rc(x + .8, top + 1, w, 11, { fill: CN.yellow, more: ' filter="drop-shadow(0 .5px .5px rgba(0,0,0,.3))"' }) + tx(x + 5, top + 9.4, sc.name, { f: cnF.typed, z: 8.5, w: 700, c: '#2A1E10' })
  }
  const hx = bx(head + 1)
  s += ln(hx, laneTop - 1, hx, foot, CN.amber, 4, .22, ' filter="url(#cn-soft)"') + ln(hx, laneTop - 1, hx, foot, CN.amber, 1)
  s += rc(hx - 6, top + 2, 12, rulerH - 4, { rx: 1.5, fill: 'url(#cn-chrome)', stroke: '#5E5850', sw: .5 }) + rc(hx - .7, top + 4, 1.4, rulerH - 8, { fill: '#2B2622' })
  /* the mixer, docked under the tape as the room's panel is: a level knob where the fader was */
  const py0 = 574, ST = T.concat([{ name: 'plate', vol: 0, regs: [], bus: true }]), sw2 = 128
  s += cnPanel(12, py0, TW - 24, 818 - py0) + rc(12, py0, TW - 24, 2, { fill: '#000', fa: .35 })
  ;['PATCH', 'MIXER', 'NOTES', 'PROMPT', 'RUBATO'].forEach((t2, k) => { const x = 22 + k * 62; s += cnLamp(x, py0 + 9, 56, 14, t2, t2 === 'MIXER', CN.amber) })
  s += cnEng(TW - 24, py0 + 20, '9 STRIPS', { anchor: 'end' })
  ST.forEach((t, i) => {
    const x = 12 + i * sw2, cx = x + sw2 / 2, y0 = py0 + 30
    s += rc(x + sw2 - 1, y0, 1, 818 - y0, { fill: '#000', fa: .18 })
    s += cnTape(x + 10, y0 + 4, sw2 - 20, t.name, 0, 9.5)
    s += cnEng(x + 12, y0 + 36, 'SEND', { z: 6.5 }) + cnKnob(cx + 2, y0 + 33, 6, i === 4 || i === 6 ? 50 : -120) + cnKnob(cx + 24, y0 + 33, 6, -120)
    s += cnEng(x + 12, y0 + 60, 'PAN', { z: 6.5 }) + cnKnob(cx + 13, y0 + 57, 7, (t.pan || 0) * 120, { kind: 'chicken' })
    s += cnLamp(cx - 30, y0 + 74, 16, 12, 'R', i === 4, CN.red) + cnLamp(cx - 8, y0 + 74, 16, 12, 'M', i === 2, CN.amber) + cnLamp(cx + 14, y0 + 74, 16, 12, 'S', false, CN.green)
    const ky = y0 + 132, kr = 17, angOf = v => { const t2 = Math.max(0, Math.min(1, (v + 60) / 70)); return -140 + Math.pow(t2, 2.2) * 280 }
    for (const [v, lab] of [[-60, '∞'], [-20, '20'], [-10, '10'], [-5, '5'], [0, '0'], [5, '5'], [10, '10']]) { const a = angOf(v) * Math.PI / 180; s += ln(cx + (kr + 3) * Math.sin(a), ky - (kr + 3) * Math.cos(a), cx + (kr + 6) * Math.sin(a), ky - (kr + 6) * Math.cos(a), v === 0 ? CN.red : CN.ink, v === 0 ? 1 : .6) + tx(cx + (kr + 11) * Math.sin(a), ky - (kr + 11) * Math.cos(a) + 2, lab, { f: cnF.eng, z: 5.4, w: 600, c: v === 0 ? CN.red : CN.ink, anchor: 'middle' }) }
    s += cnKnob(cx, ky, kr, angOf(t.vol || 0), { cap: '#E9E1CF' }) + tx(cx, ky + kr + 21, ((t.vol || 0) > 0 ? '+' : '') + (t.vol || 0).toFixed(1), { f: cnF.mono, z: 8.5, w: 500, c: CN.ink, anchor: 'middle' })
  })
  const mx2 = 12 + ST.length * sw2 + 20
  s += cnEng(mx2, py0 + 44, 'MASTER', { ls: 2 }) + cnKnob(mx2 + 60, py0 + 130, 24, 80, { cap: '#E9E1CF' }) + tx(mx2 + 60, py0 + 176, '−4.2', { f: cnF.mono, z: 9, w: 500, c: CN.ink, anchor: 'middle' })
  /* the deck */
  const dy = 822
  s += cnPanel(12, dy, TW - 24, TH - dy) + rc(12, dy, TW - 24, 2, { fill: '#000', fa: .35 }) + cnScrew(22, dy + 10) + cnScrew(22, TH - 10, 70) + cnScrew(TW - 22, dy + 10, 110) + cnScrew(TW - 22, TH - 10, 10)
  s += cnCounter(48, dy + 28, [['0', '2', '0'], ['1'], ['1']], 'BAR   BEAT   DIVISION') + cnCounter(160, dy + 28, [['0'], ['4', '9'], ['5']], 'MIN   SEC   TENTH')
  s += cnEng(256, dy + 50, '4 / 4', { z: 8 }) + cnEng(256, dy + 66, 'TEMPO 92.00', { z: 7.5 })
  const keys = [['REW', (x, y) => cnTri(x - 4, y, 8, -1) + cnTri(x + 4, y, 8, -1)], ['F.FWD', (x, y) => cnTri(x - 4, y, 8) + cnTri(x + 4, y, 8)], ['STOP', (x, y) => rc(x - 5, y - 5, 10, 10, { fill: CN.ink })], ['PLAY', (x, y) => cnTri(x + 1, y, 11)], ['REC', (x, y) => ci(x, y, 5.5, { fill: CN.red })]]
  const kw = 56, kh = 44, kx0 = TW / 2 - (5 * kw + 4 * 5) / 2
  keys.forEach(([label, g], i) => { s += cnKey(kx0 + i * (kw + 5), dy + 14, kw, kh, g, label, label === 'PLAY', label === 'PLAY' ? '#7FD36F' : null) })
  const rx0 = kx0 + 5 * (kw + 5) + 40
  s += cnToggle(rx0, dy + 40, 'CYCLE', true) + cnToggle(rx0 + 42, dy + 40, 'CLICK', false) + cnToggle(rx0 + 84, dy + 40, 'COUNT', false)
  const tdx = rx0 + 156, tdy = dy + 38
  s += ci(tdx, tdy, 22, { fill: '#F3EBDA', stroke: '#8D7D60', sw: .8 })
  for (let k = 0; k <= 12; k++) { const a = (-130 + k * (260 / 12)) * Math.PI / 180, big = k % 3 === 0; s += ln(tdx + 17 * Math.sin(a), tdy - 17 * Math.cos(a), tdx + (big ? 21 : 20) * Math.sin(a), tdy - (big ? 21 : 20) * Math.cos(a), CN.ink, big ? .9 : .5); if (big) s += tx(tdx + 12 * Math.sin(a), tdy - 12 * Math.cos(a) + 2, String(60 + k * 10), { f: cnF.eng, z: 5, w: 600, c: CN.ink, anchor: 'middle' }) }
  const ta = (-130 + (song.tempo - 60) / 120 * 260) * Math.PI / 180
  s += ln(tdx, tdy, tdx + 18 * Math.sin(ta), tdy - 18 * Math.cos(ta), CN.red, 1) + ci(tdx, tdy, 2.4, { fill: CN.ink }) + cnEng(tdx, dy + 70, 'TEMPO', { anchor: 'middle' })
  const sel = (x, label, items, on) => { let o = cnKnob(x, dy + 38, 8, -70 + on * (140 / (items.length - 1)), { kind: 'chicken' }); items.forEach((t2, k) => { const a = (-70 + k * (140 / (items.length - 1))) * Math.PI / 180; o += tx(x + 19 * Math.sin(a), dy + 38 - 17 * Math.cos(a) + 2, t2, { f: cnF.eng, z: 5.8, w: 600, c: k === on ? CN.red : CN.ink, anchor: 'middle' }) }); return o + cnEng(x, dy + 70, label, { anchor: 'middle' }) }
  s += sel(tdx + 70, 'GRID', ['1/2', '1/4', '1/8', '1/16'], 1) + sel(tdx + 132, 'NUDGE', ['BAR', 'BEAT', '1/16', 'TICK'], 1)
  s += cnCheeks()
  return s
}

THEMES.consoleMixer = () => {
  const song = tdSong(), T = song.tracks.concat([{ name: 'plate', vol: 0, regs: [], bus: true }]), head = song.head
  cnVuN = 0
  let s = cnDefs() + rc(0, 0, TW, TH, { fill: CN.deep })
  const masterW = 176, n = T.length, sw = (TW - 24 - masterW) / n, top = 96
  s += cnPanel(12, 0, TW - 24, top) + rc(20, 8, TW - 40, 66, { rx: 4, fill: '#120D09' })
  T.forEach((t, i) => { const x = 12 + i * sw + (sw - 92) / 2; s += cnVu(x, 15, 92, 52, t.bus ? -4 : tdLevel(t, head)) })
  s += cnVu(12 + n * sw + 12, 15, 70, 52, -2.2) + cnVu(12 + n * sw + 88, 15, 70, 52, -1.6) + cnEng(12 + n * sw + 88, 86, 'MIX', { anchor: 'middle', ls: 2.4 })
  T.forEach((t, i) => {
    const x = 12 + i * sw, cx = x + sw / 2
    s += cnPanel(x, top, sw, TH - top) + rc(x + sw - 1.4, top, 1.4, TH - top, { fill: '#000', fa: .3 }) + rc(x + sw - 2.2, top, .8, TH - top, { fill: '#fff', fa: .4 })
    s += cnScrew(x + 8, top + 9, 30 + i * 20) + cnScrew(x + sw - 9, top + 9, 80 + i * 13)
    s += cnEng(cx, top + 28, 'INPUT', { anchor: 'middle' }) + cnKnob(cx, top + 48, 9.5, -40 + i * 11, { cap: CN.red })
    const sec = (y, label) => ln(x + 10, top + y, x + sw - 10, top + y, '#000', .5, .15) + cnEng(cx, top + y + 14, label, { anchor: 'middle', z: 6.8 })
    s += sec(70, 'EQUALISER')
    ;[['HF', '#3D6EA8', -20], ['HMF', '#4B8B5A', 30], ['LMF', '#4B8B5A', -50], ['LF', '#7B4B2A', 20]].forEach(([lab, col, a], k) => { const ex = cx + (k % 2 ? 18 : -18), ey = top + 108 + Math.floor(k / 2) * 46 + (k % 2 ? 11 : 0); s += cnKnob(ex, ey, 8.5, a + i * 7, { cap: col }) + cnEng(ex, ey + 17, lab, { anchor: 'middle', z: 6.5 }) })
    s += sec(206, 'SENDS') + cnKnob(cx - 18, top + 240, 7, i === 4 || i === 6 ? 40 : -120) + cnKnob(cx + 18, top + 240, 7, -120) + cnEng(cx - 18, top + 256, 'PLATE', { anchor: 'middle', z: 6 }) + cnEng(cx + 18, top + 256, 'B', { anchor: 'middle', z: 6 })
    s += sec(272, 'DYNAMICS') + cnKnob(cx - 18, top + 306, 7, -30 + i * 9, { cap: '#B8B0A0' }) + cnKnob(cx + 18, top + 306, 7, 20 - i * 6, { cap: '#B8B0A0' }) + cnEng(cx - 18, top + 322, 'THRESH', { anchor: 'middle', z: 6 }) + cnEng(cx + 18, top + 322, 'RATIO', { anchor: 'middle', z: 6 })
    s += sec(338, 'PAN') + cnKnob(cx, top + 374, 9, ((t.pan || 0) * 120), { kind: 'chicken' }) + cnEng(cx - 20, top + 377, 'L', { z: 6, anchor: 'middle' }) + cnEng(cx + 20, top + 377, 'R', { z: 6, anchor: 'middle' })
    s += cnLamp(cx - 27, top + 400, 16, 13, 'R', i === 4, CN.red) + cnLamp(cx - 8, top + 400, 16, 13, 'M', i === 2, CN.amber) + cnLamp(cx + 11, top + 400, 16, 13, 'S', false, CN.green)
    s += sec(424, 'INSERTS') + [1, 2, 3].map(k => cnLamp(cx - 33 + (k - 1) * 23, top + 446, 20, 10, String(k), (i === 4 && k < 3) || (i === 6 && k === 1), CN.amber)).join('')
    const ky = top + 528, kr = 22, angOf = v => { const t2 = Math.max(0, Math.min(1, (v + 60) / 70)); return -140 + Math.pow(t2, 2.2) * 280 }
    s += ln(x + 10, top + 470, x + sw - 10, top + 470, '#000', .5, .15) + cnEng(cx, top + 484, 'LEVEL', { anchor: 'middle', z: 6.8 })
    for (const [v, lab] of [[-60, '∞'], [-30, '30'], [-20, '20'], [-10, '10'], [-5, '5'], [0, '0'], [5, '5'], [10, '10']]) { const a = angOf(v) * Math.PI / 180; s += ln(cx + (kr + 4) * Math.sin(a), ky - (kr + 4) * Math.cos(a), cx + (kr + 7) * Math.sin(a), ky - (kr + 7) * Math.cos(a), v === 0 ? CN.red : CN.ink, v === 0 ? 1.1 : .7) + tx(cx + (kr + 13) * Math.sin(a), ky - (kr + 13) * Math.cos(a) + 2, lab, { f: cnF.eng, z: 6, w: 600, c: v === 0 ? CN.red : CN.ink, anchor: 'middle' }) }
    s += cnKnob(cx, ky, kr, angOf(t.vol || 0), { cap: '#E9E1CF' }) + tx(cx, ky + kr + 24, ((t.vol || 0) > 0 ? '+' : '') + (t.vol || 0).toFixed(1), { f: cnF.mono, z: 9, w: 500, c: CN.ink, anchor: 'middle' })
    s += cnTape(x + 10, top + 600, sw - 20, t.name, ((i % 3) - 1) * .4, 10.5) + cnEng(x + 10, top + 636, String(i + 1).padStart(2, '0'), { z: 7.5 })
  })
  const mx = 12 + n * sw
  s += cnPanel(mx, top, masterW, TH - top) + cnEng(mx + masterW / 2, top + 28, 'MASTER', { anchor: 'middle', z: 8.5, ls: 2.6 })
  const mky = top + 300
  for (let k = 0; k <= 10; k++) { const a = (-140 + k * 28) * Math.PI / 180; s += ln(mx + masterW / 2 + 36 * Math.sin(a), mky - 36 * Math.cos(a), mx + masterW / 2 + 41 * Math.sin(a), mky - 41 * Math.cos(a), k === 8 ? CN.red : CN.ink, k % 2 ? .6 : 1) }
  s += cnKnob(mx + masterW / 2, mky, 30, 80, { cap: '#E9E1CF' }) + cnEng(mx + masterW / 2, mky + 58, 'OUT  −4.2 DB', { anchor: 'middle', z: 8, more: ' xml:space="preserve"' })
  s += rc(mx + 22, top + 440, masterW - 44, 46, { rx: 2, fill: '#1A140F' }) + tx(mx + masterW / 2, top + 460, 'SLUR STUDIO', { f: cnF.eng, z: 10, w: 600, ls: 3, c: '#E4D9C2', anchor: 'middle' }) + tx(mx + masterW / 2, top + 476, 'CONSOLE 8   SERIES II', { f: cnF.eng, z: 6.5, w: 500, ls: 2, c: CN.amber, anchor: 'middle', more: ' xml:space="preserve"' })
  s += cnTape(mx + 18, top + 600, masterW - 36, song.name, -.4, 10.5)
  s += rc(12, TH - 76, TW - 24, 76, { fill: 'url(#cn-leather)' }) + rc(12, TH - 76, TW - 24, 1.5, { fill: '#000', fa: .5 }) + pa(`M12 ${TH - 66}H${TW - 12}`, { stroke: '#7A5236', sw: .8, more: ' stroke-dasharray="4 3"', sa: .6 }) + rc(12, TH - 75, TW - 24, 24, { fill: '#FFFFFF', fa: .04 })
  s += cnCheeks()
  return s
}
