/* ── the parts' shapes: what a theme gives the room besides its colours, its type and its grounds ──
   Themes, stage two (design/themes draft 2, his OK 2026-10-19; his word on stage one: it looked like the room as it
   comes — the draft's parts are what he agreed to). Each part's shape is a quality of the look ('part.*' in look.js),
   so a theme sets them and anyone may mix them: the transport as a tape deck at the foot, VU meters over the room, the
   heads with names on label tape, lamps and a knob for the level, the markers on tape flags, the cycle in grease pencil,
   the playhead as a tape head. As the room comes, none of them is on and nothing here draws.
   The materials (the meters' faces, the keys' plastic, chrome) are the parts' own; the panel, the ink and the meanings
   (recording, solo, listening) are the look's. */
const SKIN = { k: {}, bridge: false, right: false, deck: false, heads: false, flags: false, pencil: false, tapehead: false, console: false }
/* the bands a transport takes: over the room, over the foot, down the left */
const SKIN_BANDS = { plain: [44, 0, 0], console: [0, 82, 0], cassette: [124, 70, 0], score: [84, 52, 0], poster: [0, 28, 196], blueprint: [64, 112, 0], terminal: [96, 30, 0] }
/* what each theme's parts draw (filled by skin-*.js): top, foot, left (the transport's bands), head, scenes, cycle, play, lanes, strip */
const SKINS = { top: {}, foot: {}, left: {}, head: {}, scenes: {}, cycle: {}, play: {}, rule: {}, lanes: {}, strip: {}, mixer: {}, sound: {}, frame: {} }
const BRIDGE_H = 96
let DECK_H = 0
function skinRead () {
  if (typeof lk !== 'function') return
  for (const part in PART_KINDS) { const v = lk('part.' + part), f = PART_KINDS[part].find(x => x[0] === v); SKIN.k[part] = f ? f[1] : 'plain' }
  SKIN.bridge = lk('part.meters') === 'VU meters over the room'
  SKIN.right = lk('part.headsAt') === 'at the right'
  SKIN.deck = SKIN.k.transport === 'console'
  SKIN.heads = SKIN.k.heads === 'console'
  SKIN.flags = SKIN.k.markers === 'console'
  SKIN.pencil = SKIN.k.cycle === 'console'
  SKIN.tapehead = SKIN.k.playhead === 'console'
  SKIN.console = SKIN.k.mixer === 'console'
}
const skinHas = part => SKIN.k[part] && SKIN.k[part] !== 'plain'
/* the window cut again (ui.js relayout asks first): the bands of the transport and the bridge of meters */
function skinLayout () {
  skinRead()
  const b = SKIN_BANDS[SKIN.k.transport] || SKIN_BANDS.plain
  BAR_H = (SKIN.bridge ? BRIDGE_H : 0) + b[0]
  DECK_H = b[1]
  if (SKV.left !== b[2]) { SKV.left = b[2]; if (typeof fitRoom === 'function' && typeof board !== 'undefined' && !skinLayout.in) { skinLayout.in = true; try { fitRoom() } finally { skinLayout.in = false } } }
}
const skinDeckY = () => H - FOOT_H - DECK_H
/* where the lists of the transport's things open: under its band at the top, or over it at the foot */
/* a menu opened from a theme's own word stands at the word: under it, or over it when the word is low in the window */
const skinMenuAt = what => { const f = skinField(what); return f ? { x: f.x, y: f.y > H / 2 ? f.y - 4 : f.y + f.h + 2, up: f.y > H / 2 } : null }
const barMenuY = () => (SKIN_BANDS[SKIN.k.transport] || SKIN_BANDS.plain)[0] ? BAR_H - 6 : H

/* ── materials ── */
const SK = { well: '#120D09', face0: '#FFF4D2', face1: '#D6B272', red: '#C0392B', mask: '#EEE6D2', maskInk: '#211C17', chrome0: '#8E8A84', chrome1: '#F2EFE9', key0: '#F6F0E2', key1: '#C6B693', amber: '#FFB547', green: '#5DAA57' }
let SK_DEFS = ''
function skinDefs () {
  return `<defs>
    <radialGradient id="sk-vu" cx=".5" cy="1" r="1.05"><stop offset="0" stop-color="${SK.face0}"/><stop offset=".55" stop-color="#F5E1AC"/><stop offset="1" stop-color="${SK.face1}"/></radialGradient>
    <linearGradient id="sk-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".32"/><stop offset=".5" stop-color="#FFFFFF" stop-opacity=".05"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
    <linearGradient id="sk-key" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${SK.key0}"/><stop offset=".85" stop-color="#E0D4BA"/><stop offset="1" stop-color="${SK.key1}"/></linearGradient>
    <linearGradient id="sk-keydown" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D9CCAE"/><stop offset="1" stop-color="#CBBB97"/></linearGradient>
    <radialGradient id="sk-knob" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#5A5650"/><stop offset=".6" stop-color="#26231F"/><stop offset="1" stop-color="#0E0C0A"/></radialGradient>
    <radialGradient id="sk-skirt" cx=".5" cy=".5" r=".5"><stop offset=".7" stop-color="#1C1915"/><stop offset="1" stop-color="#3A3530"/></radialGradient>
    <linearGradient id="sk-drum" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050403"/><stop offset=".25" stop-color="#2A2622"/><stop offset=".5" stop-color="#36322D"/><stop offset=".75" stop-color="#2A2622"/><stop offset="1" stop-color="#050403"/></linearGradient>
    <linearGradient id="sk-chrome" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${SK.chrome0}"/><stop offset=".45" stop-color="${SK.chrome1}"/><stop offset="1" stop-color="#77736D"/></linearGradient>
    <pattern id="tm-shade" width="2" height="2" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="${INK}" fill-opacity=".5"/><rect x="1" y="1" width="1" height="1" fill="${INK}" fill-opacity=".5"/></pattern>
    <pattern id="bp-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V6" stroke="${INK}" stroke-opacity=".22" stroke-width=".7"/></pattern>
    <filter id="sk-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.2"/></filter>
  </defs>`
}
/* engraved: the ink, with a light edge under it */
const skEng = (x, y, s, o = {}) => T(x, y + .7, s, Object.assign({ size: 7.5, w: 600 }, o, { c: '#FFFFFF', a: .45 })) + T(x, y, s, Object.assign({ size: 7.5, w: 600, a: .9 }, o))
const skScrew = (x, y, rot = 30) => Cc(x, y, 2.6, { fill: 'url(#sk-chrome)', stroke: '#6E675E', sw: .4 }) + P(`M${n(x - 1.8 * Math.cos(rot * Math.PI / 180))} ${n(y - 1.8 * Math.sin(rot * Math.PI / 180))}L${n(x + 1.8 * Math.cos(rot * Math.PI / 180))} ${n(y + 1.8 * Math.sin(rot * Math.PI / 180))}`, { stroke: '#4A443C', sw: .8 })
/* label tape with a name on it, typed in the face of names */
function skTape (x, y, w, name, size = 10.5, rot = 0) {
  const h = size * 1.5, nm = fit(asGiven(name), w - 10, size, 700)
  return G(P(`M${x} ${y + .6}L${x + 2} ${y}L${x + w - 1.5} ${y + .4}L${x + w} ${y + 1.2}L${x + w - 1} ${y + h - .6}L${x + w} ${y + h}L${x + 1.5} ${y + h - .3}L${x} ${y + h - 1}Z`, { fill: SK.mask, x: ' filter="drop-shadow(0 .6px .6px rgba(0,0,0,.25))"' }) + T(x + 5, y + h * .7, nm, { size, w: 700, c: SK.maskInk }), rot ? `rotate(${rot} ${n(x + w / 2)} ${n(y + h / 2)})` : '')
}
/* a VU meter at x, y: its needle a group of its own (id), turned as the level moves (skinFrame) */
const VU_A = db => { const lin = v => Math.pow(10, v / 20), f = (lin(Math.max(-22, Math.min(3.5, db))) - lin(-20)) / (lin(3) - lin(-20)); return -42 + 84 * f }
function skVu (x, y, w, h, id) {
  const cid = 'skvu' + (++UID), px = x + w / 2, py = y + h + 8, R0 = h - 12
  const pt = (deg, rr) => { const a = deg * Math.PI / 180; return [px + rr * Math.sin(a), py - rr * Math.cos(a)] }
  let s = R(x - 2, y - 2, w + 4, h + 4, { rx: 4, fill: '#0B0806' }) + R(x, y, w, h, { rx: 2, fill: 'url(#sk-vu)' })
  let f = ''
  const [a0x, a0y] = pt(VU_A(0), R0 + .5), [a3x, a3y] = pt(VU_A(3), R0 + .5), [l0x, l0y] = pt(VU_A(-20), R0 - 1.5), [l1x, l1y] = pt(VU_A(3), R0 - 1.5)
  f += P(`M${n(a0x)} ${n(a0y)}A${R0 + .5} ${R0 + .5} 0 0 1 ${n(a3x)} ${n(a3y)}`, { stroke: SK.red, sw: 1.8 }) + P(`M${n(l0x)} ${n(l0y)}A${R0 - 1.5} ${R0 - 1.5} 0 0 1 ${n(l1x)} ${n(l1y)}`, { stroke: '#2A2018', sw: .55 })
  for (const m of [-20, -10, -7, -5, -3, -2, -1, 0, 1, 2, 3]) {
    const a = VU_A(m), [ix, iy] = pt(a, R0 - 1.5), [ox, oy] = pt(a, R0 + (m === 0 || m === -20 ? 4 : 2.8)), [tx0, ty0] = pt(a, R0 + 8)
    f += P(`M${n(ix)} ${n(iy)}L${n(ox)} ${n(oy)}`, { stroke: m > 0 ? SK.red : '#2A2018', sw: m === 0 ? 1 : .7 })
    if (m !== -1 && m !== 1 && m !== -2) f += `<text x="${n(tx0)}" y="${n(ty0 + 2)}" text-anchor="middle" font-family="${FONT}" font-size="5.6" font-weight="600" fill="${m > 0 ? SK.red : '#2A2018'}">${Math.abs(m)}</text>`
  }
  f += `<text x="${n(px)}" y="${n(y + h - 15)}" text-anchor="middle" font-family="${FONT}" font-size="7.5" font-weight="600" fill="#2A2018">VU</text>`
  const [nx, ny] = pt(0, R0 + 5), [sx, sy] = pt(0, 12)
  f += `<g id="${id}" transform="rotate(${n(VU_A(-30))} ${n(px)} ${n(py)})">` + P(`M${n(sx + 1.1)} ${n(sy + 1.1)}L${n(nx + 1.1)} ${n(ny + 1.1)}`, { stroke: '#000000', sw: 1, sa: .16 }) + P(`M${n(sx)} ${n(sy)}L${n(nx)} ${n(ny)}`, { stroke: '#16110C', sw: .9 }) + '</g>'
  f += P(`M${x} ${y + h}L${x} ${y + h - 6}Q${n(px)} ${y + h - 14} ${x + w} ${y + h - 6}L${x + w} ${y + h}Z`, { fill: '#1A140F' }) + R(x, y, w, h * .5, { fill: 'url(#sk-glass)' })
  SKV.pivot.set(id, [px, py])
  return s + `<clipPath id="${cid}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2"/></clipPath>` + G(f, '', ` clip-path="url(#${cid})"`)
}
/* a knob: a chicken-head pointer or a round cap; angle 0 straight up */
function skKnob (x, y, r, angle, o = {}) {
  let s = Cc(x + .8, y + 1.3, r, { fill: '#000000', fa: .22 }) + Cc(x, y, r, { fill: 'url(#sk-skirt)' })
  if (o.kind === 'chicken') {
    const p = `M0 ${n(-r * 1.25)}C${n(r * .32)} ${n(-r * 1.2)} ${n(r * .52)} ${n(-r * .2)} ${n(r * .55)} ${n(r * .35)}C${n(r * .5)} ${n(r * .8)} ${n(-r * .5)} ${n(r * .8)} ${n(-r * .55)} ${n(r * .35)}C${n(-r * .52)} ${n(-r * .2)} ${n(-r * .32)} ${n(-r * 1.2)} 0 ${n(-r * 1.25)}Z`
    s += G(P(p, { fill: 'url(#sk-knob)', stroke: '#000', sw: .4 }) + P(`M0 ${n(-r * 1.1)}L0 ${n(-r * .3)}`, { stroke: '#F2EAD8', sw: Math.max(.9, r * .13), cap: 'round' }), `translate(${n(x)} ${n(y)}) rotate(${n(angle)})`)
  } else {
    s += Cc(x, y, r * .78, { fill: 'url(#sk-knob)', stroke: '#000', sw: .3 })
    if (o.cap) s += Cc(x, y, r * .5, { fill: o.cap }) + Cc(x - r * .12, y - r * .14, r * .2, { fill: '#FFFFFF', fa: .25 })
    s += G(P(`M0 ${n(-r * .74)}L0 ${n(-r * .3)}`, { stroke: '#F2EAD8', sw: Math.max(.9, r * .12), cap: 'round' }), `translate(${n(x)} ${n(y)}) rotate(${n(angle)})`)
  }
  return s
}
/* a lamp push button */
function skLamp (x, y, w, h, label, on, col) {
  let s = R(x - .8, y - .8, w + 1.6, h + 1.6, { rx: 2, fill: '#0E0B08' })
  if (on) s += R(x - 2, y - 2, w + 4, h + 4, { rx: 3, fill: col, fa: .5, x: ' filter="url(#sk-glow)"' })
  s += R(x, y, w, h, { rx: 1.5, fill: on ? col : '#3A3129' }) + R(x, y, w, h * .45, { rx: 1.5, fill: '#FFFFFF', fa: on ? .25 : .05 })
  return s + `<text x="${n(x + w / 2)}" y="${n(y + h / 2 + 2.5)}" text-anchor="middle" font-family="${FONT}" font-size="7" font-weight="600" fill="${on ? '#2A1A0E' : '#B5A58A'}">${esc(label)}</text>`
}
/* a bat-handle switch */
function skToggle (x, y, label, on, a) {
  let s = Cc(x, y, 5.5, { fill: 'url(#sk-chrome)', stroke: '#5A544C', sw: .5 }) + Cc(x, y, 3.4, { fill: '#3B3631' })
  const d = on ? -1 : 1
  s += P(`M${x - 2} ${y}L${x - 1.4} ${y + d * 15}Q${x} ${y + d * 17.5} ${x + 1.4} ${y + d * 15}L${x + 2} ${y}Z`, { fill: 'url(#sk-chrome)', stroke: '#6A645B', sw: .4 })
  s += Cc(x + 10, y - 15, 2, { fill: on ? SK.red : '#4A2A24' }) + (on ? Cc(x + 10, y - 15, 4, { fill: SK.red, fa: .5, x: ' filter="url(#sk-glow)"' }) : '')
  return s + skEng(x, y + 29, label, { anchor: 'middle' }) + (a ? hit(x - 16, y - 22, 32, 58, a) : '')
}
/* a counter of drums: its digits held by id, turned by skinFrame */
function skCounter (x, y, groups, label, id, digits = []) {
  const dw = 15, dh = 26, total = groups.reduce((a, g) => a + g * dw, 0) + (groups.length - 1) * 7 + 10, cid = 'skc' + (++UID)
  let s = R(x - 5, y - 5, total, dh + 10, { rx: 3, fill: '#120E0A' }) + `<clipPath id="${cid}"><rect x="${x - 5}" y="${y}" width="${total}" height="${dh}"/></clipPath><g clip-path="url(#${cid})">`
  let cx = x, k = 0
  groups.forEach((g, gi) => {
    for (let j = 0; j < g; j++) { s += R(cx, y, dw - 1.5, dh, { fill: 'url(#sk-drum)' }) + `<text id="${id}-${k}" x="${n(cx + (dw - 1.5) / 2)}" y="${n(y + dh / 2 + 5)}" text-anchor="middle" font-family="'IBM Plex Mono', monospace" font-size="14" font-weight="500" fill="#F4EEE2">${esc(digits[k] || '0')}</text>`; k++; cx += dw }
    if (gi < groups.length - 1) { s += Cc(cx + 2, y + dh - 5, 1.1, { fill: '#F4EEE2', fa: .7 }); cx += 7 }
  })
  return s + '</g>' + R(x - 5, y - 5, total, (dh + 10) * .45, { rx: 3, fill: 'url(#sk-glass)' }) + skEng(x - 3, y - 10, label)
}
/* a piano key of the machine */
function skKey (x, y, w, h, glyph, label, down, lamp, a) {
  const dy = down ? 2.5 : 0
  let s = R(x, y + 4, w, h, { rx: 2, fill: '#0F0B08' }) + R(x, y + dy, w, h, { rx: 2, fill: down ? 'url(#sk-keydown)' : 'url(#sk-key)', stroke: '#9C8C6C', sw: .5 })
  s += glyph(x + w / 2, y + dy + h * .4) + `<text x="${n(x + w / 2)}" y="${n(y + dy + h - 7)}" text-anchor="middle" font-family="${FONT}" font-size="7" font-weight="600" letter-spacing="1" fill="#2A231B">${esc(TF.caps ? label.toUpperCase() : label)}</text>`
  if (lamp) s += Cc(x + w - 7, y + dy + 7, 2.2, { fill: lamp }) + Cc(x + w - 7, y + dy + 7, 4.5, { fill: lamp, fa: .5, x: ' filter="url(#sk-glow)"' })
  return s + (a ? hit(x, y, w, h + 4, a) : '')
}
const skTri = (x, y, s, dir = 1, c = '#2A231B') => P(`M${n(x - s * .5 * dir)} ${n(y - s * .6)}L${n(x + s * .6 * dir)} ${y}L${n(x - s * .5 * dir)} ${n(y + s * .6)}Z`, { fill: c })

/* ── the bridge: a VU meter for each track over the room, and the mix's two ── */
const SKV = { pivot: new Map(), at: new Map(), field: {}, left: 0 }
function skinBridge () {
  SKV.pivot.clear()
  let s = R(0, 0, W, BRIDGE_H, { fill: K1 }) + R(10, 8, W - 20, 64, { rx: 4, fill: SK.well }) + R(10, 8, W - 20, 2, { rx: 1, fill: '#000', fa: .5 })
  const mw = 84, mh = 50, gap = 8, mixW = 2 * mw + gap, list = S.tracks.filter(t => t.kind !== 'stack')
  const room = W - 20 - mixW - 30, fits = Math.max(0, Math.floor((room + gap) / (mw + gap)))
  list.slice(0, fits).forEach((t, i) => {
    const x = 20 + i * (mw + gap)
    s += skVu(x, 15, mw, mh, 'vu-' + t.id) + skEng(x + 1, 87, pad2(S.tracks.indexOf(t) + 1), { size: 7.5 }) + skTape(x + 14, 76, mw - 14, t.name, 9.5)
  })
  const mx = W - 20 - mixW
  s += skVu(mx, 15, mw, mh, 'vu-L') + skVu(mx + mw + gap, 15, mw, mh, 'vu-R') + skEng(mx + mixW / 2, 87, 'mix   left   right', { anchor: 'middle', x: ' xml:space="preserve"' })
  const plateX = 20 + Math.min(fits, list.length) * (mw + gap) + 16, plateW = mx - 24 - plateX
  if (plateW > 160) s += R(plateX, 20, plateW, 40, { rx: 2, fill: '#1A140F' }) + `<text x="${plateX + 14}" y="38" font-family="${FONT}" font-size="10" font-weight="600" letter-spacing="3.2" fill="${lkC('win.k1', K1)}">SLUR STUDIO</text>` + `<text x="${plateX + 14}" y="52" font-family="${FONT}" font-size="7" font-weight="500" letter-spacing="2.2" fill="${SK.amber}">CONSOLE 8   SERIES II</text>` + (typeof PROJ === 'object' && PROJ.name ? T(plateX + plateW - 14, 46, fit(asGiven(PROJ.name), plateW - 150, 10), { size: 10, c: lkC('win.k1', K1), a: .8, anchor: 'end' }) : '')
  return s + hline(0, W, BRIDGE_H - .5, .25)
}

/* ── the deck: the transport as a tape machine, at the foot ── */
function skinDeck () {
  const y0 = skinDeckY(), mid = y0 + DECK_H / 2
  let s = R(0, y0, W, DECK_H, { fill: K1 }) + R(0, y0, W, 2, { fill: '#000', fa: .3 }) + skScrew(10, y0 + 10) + skScrew(10, y0 + DECK_H - 10, 70) + skScrew(W - 10, y0 + 10, 110) + skScrew(W - 10, y0 + DECK_H - 10, 10)
  /* the counters: where the playhead is, in bars and in time; pressed, a place is typed */
  const [bd, td] = skDigits(curPos())
  s += skCounter(36, y0 + 30, [3, 1, 1], 'bar   beat   division', 'skb', bd) + hit(30, y0 + 24, 132, 38, 'pos')
  s += skCounter(176, y0 + 30, [1, 2, 1], 'min   sec   tenth', 'skt', td)
  SKV.field.pos = { x: 30, y: y0 + 26, w: 132, h: 32 }
  s += skEng(268, y0 + 42, meterName(), { size: 8.5 }) + hit(262, y0 + 30, 40, 16, 'meter'); SKV.field.meter = { x: 262, y: y0 + 30, w: 40, h: 16 }
  s += skEng(268, y0 + 58, `key  ${S.key || '—'}`, { size: 7.5, x: ' xml:space="preserve"' }) + hit(262, y0 + 48, 60, 16, 'key')
  SKV.field.key = { x: 300, y: y0 + 46, w: 58, h: 20 }
  /* the keys of the machine */
  const keys = [['to start', 'tostart', (x, y) => R(x - 6, y - 4.5, 1.6, 9, { fill: '#2A231B' }) + skTri(x + 1, y, 9, -1)], ['play', 'play', (x, y) => skTri(x + 1, y, 11)], ['stop', 'stop', (x, y) => R(x - 5, y - 5, 10, 10, { fill: '#2A231B' })], ['rec', 'rec', (x, y) => Cc(x, y, 5.5, { fill: REC })]]
  const kw = 56, kh = 46, kx0 = Math.round(W / 2 - (keys.length * kw + (keys.length - 1) * 5) / 2)
  keys.forEach(([label, a, g], i) => { const down = a === 'play' ? S.playing && !S.rec : a === 'rec' ? !!S.rec : false; s += skKey(kx0 + i * (kw + 5), y0 + 14, kw, kh, g, label, down, a === 'play' && down ? '#7FD36F' : a === 'rec' && down ? REC : null, a) })
  let rx = kx0 + keys.length * (kw + 5) + 34
  s += skToggle(rx, y0 + 42, 'cycle', S.cycle.on, 'loop') + skToggle(rx + 44, y0 + 42, 'click', !!S.click, 'click') + skToggle(rx + 88, y0 + 42, 'low lat', !!S.lowLat, 'lowlat')
  /* tempo: a dial; pressed, typed */
  const tdx = rx + 160, tdy = y0 + 38
  s += Cc(tdx, tdy, 22, { fill: '#F3EBDA', stroke: '#8D7D60', sw: .8 })
  for (let k = 0; k <= 12; k++) { const a = (-130 + k * (260 / 12)) * Math.PI / 180, big = k % 3 === 0; s += P(`M${n(tdx + 17 * Math.sin(a))} ${n(tdy - 17 * Math.cos(a))}L${n(tdx + (big ? 21 : 20) * Math.sin(a))} ${n(tdy - (big ? 21 : 20) * Math.cos(a))}`, { stroke: '#2A231B', sw: big ? .9 : .5 }); if (big) s += `<text x="${n(tdx + 12 * Math.sin(a))}" y="${n(tdy - 12 * Math.cos(a) + 2)}" text-anchor="middle" font-family="${FONT}" font-size="5" font-weight="600" fill="#2A231B">${60 + k * 10}</text>` }
  const ta = (-130 + clamp((S.tempo - 60) / 120, 0, 1) * 260) * Math.PI / 180
  s += P(`M${tdx} ${tdy}L${n(tdx + 18 * Math.sin(ta))} ${n(tdy - 18 * Math.cos(ta))}`, { stroke: SK.red, sw: 1 }) + Cc(tdx, tdy, 2.4, { fill: '#2A231B' }) + skEng(tdx, y0 + 74, `tempo ${(+S.tempo).toFixed(2)}`, { anchor: 'middle', x: ' xml:space="preserve"' }) + hit(tdx - 24, tdy - 24, 48, 60, 'tempo')
  SKV.field.tempo = { x: tdx - 31, y: tdy - 10, w: 62, h: 20 }
  /* the grid and the nudge: selectors; pressed, their lists */
  const sel = (x, label, items, on, a) => { let o = skKnob(x, y0 + 38, 8, -70 + Math.max(0, on) * (140 / (items.length - 1)), { kind: 'chicken' }); items.forEach((t2, k) => { const an = (-70 + k * (140 / (items.length - 1))) * Math.PI / 180; o += `<text x="${n(x + 19 * Math.sin(an))}" y="${n(y0 + 38 - 17 * Math.cos(an) + 2)}" text-anchor="middle" font-family="${FONT}" font-size="5.8" font-weight="600" fill="${k === on ? SK.red : '#2A231B'}">${esc(t2)}</text>` }); return o + skEng(x, y0 + 74, label, { anchor: 'middle' }) + hit(x - 24, y0 + 14, 48, 64, a) }
  const grids = ['1/2', '1/4', '1/8', '1/16'], nudges = ['bar', 'beat', '1/16', 'tick']
  s += sel(tdx + 70, 'grid', grids, grids.indexOf(S.grid), 'grid') + sel(tdx + 132, 'nudge', nudges.map(v => v.toUpperCase()), nudges.indexOf(S.nudge), 'nudge')
  SKV.field.grid = { x: tdx + 50, y: y0 + 16, w: 40, h: 44 }; SKV.field.nudge = { x: tdx + 112, y: y0 + 16, w: 40, h: 44 }      // (the lists of the grid and the nudge open by their selectors)
  /* the mix's level: a knob */
  const ox = W - 44, f = volF(S.master)
  s += skKnob(ox, y0 + 36, 15, -140 + f * 280, { cap: '#E9E1CF' }) + skEng(ox, y0 + 70, `out ${fmtDb(S.master)}`, { anchor: 'middle', x: ' xml:space="preserve"' }) + hit(ox - 22, y0 + 14, 44, 62, 'master', '', 'ns-resize')
  return s
}
/* the control bar's place: what pTop draws when a theme has the bridge or the deck */
function skinTop (bar) {
  const k = SKIN.k.transport, top = SKIN.bridge ? BRIDGE_H : 0
  SKV.field = {}                                                                     // (each theme says again where its words stand)
  let s = skinDefs() + (SKIN.bridge ? skinBridge() : '')
  if (k === 'plain') return s + G(bar(), `translate(0 ${top})`)
  if (k === 'console') return s + skinDeck()
  return s + (SKINS.top[k] ? G(SKINS.top[k](), top ? `translate(0 ${top})` : '') : '') + (SKINS.foot[k] ? SKINS.foot[k](skinDeckY()) : '') + (SKINS.left[k] ? SKINS.left[k]() : '')
}
/* where a value is typed over the deck (project.js startRename) */
const skinField = what => skinHas('transport') && SKV.field[what] ? SKV.field[what] : null

/* ── a frame: the drums turn, the needles move ── */
const VU_LAG = .22
/* the drums' digits for a place: bar beat division, and minutes seconds tenths */
function skDigits (p) {
  const r = readout(p).split('.'), bar = String(r[0] || '1').padStart(3, '0').slice(-3), bd = (bar + (r[1] || '1') + (r[2] || '1')).split('')
  const sec = p * SPB(), m = Math.floor(sec / 60) % 10, ss = Math.floor(sec % 60), tenth = Math.floor((sec * 10) % 10)
  return [bd, [String(m), ...String(ss).padStart(2, '0'), String(tenth)]]
}
function skinFrame (p) {
  const ran = []                                                                    // (each theme whose part is worn: its transport, its heads, its mixer)
  for (const part of ['transport', 'heads', 'mixer']) { const k = SKIN.k[part]; if (SKINS.frame[k] && !ran.includes(k)) { ran.push(k); SKINS.frame[k](p) } }
  if (SKIN.deck) {
    const [bd, td] = skDigits(p)
    bd.forEach((d, k) => { const el = $('skb-' + k); if (el && el.textContent !== d) el.textContent = d })
    td.forEach((d, k) => { const el = $('skt-' + k); if (el && el.textContent !== d) el.textContent = d })
  }
  if (SKIN.bridge && typeof METERS === 'object') {
    const turn = (id, lin) => {
      const el = $(id), pv = SKV.pivot.get(id)
      if (!el || !pv) return
      const db = lin > 0 ? 20 * Math.log10(lin) + 2 : -40, was = SKV.at.has(id) ? SKV.at.get(id) : -40, now = was + (db - was) * VU_LAG
      SKV.at.set(id, now)
      el.setAttribute('transform', `rotate(${n(VU_A(now))} ${n(pv[0])} ${n(pv[1])})`)
    }
    for (const t of S.tracks) turn('vu-' + t.id, METERS.now.get(t.id) || 0)
    turn('vu-L', METERS.mm[0] || 0); turn('vu-R', METERS.mm[1] || 0)
  }
}

/* ── a head: the name on label tape, lamps for its buttons, a knob for its level ── */
const LAMP_C = { r: () => REC, i: () => MON, m: () => '#E0A93A', s: () => SK.green }
function skinLamps (x, y, items, i, lw = 15) {
  let s = ''
  items.forEach((it, k) => { const cx = x + k * (lw + 3); s += skLamp(cx, y, lw, 13, String(it.t).toUpperCase(), !!it.on, (LAMP_C[String(it.t).toLowerCase()] || (() => it.c || SOLO))()) + (it.a ? hit(cx - 1, y - 2, lw + 2, 17, it.a, ` data-i="${i}"`) : '') })
  return s
}
const skinKnobAngle = vol => -135 + volF(vol) * 270
function skinLevel (x, y, t, vol, i) {
  return skKnob(x, y, 7.5, skinKnobAngle(vol), { kind: 'chicken' }) + hit(x - 12, y - 12, 24, 24, 'vol', ` data-i="${i}" data-rel="1"`, 'ns-resize')
}

/* ── the markers on yellow tape flags, hanging from the top of their row ── */
function skinScenes () {
  const y0 = MK_Y, y = MK_Y, cur = sceneAt(curPos()).i      // (its flags hang from the top of the row)
  let s = R(0, y0, RX, MK_H, { fill: K1 }) + (X0 > 70 ? T(12 + (typeof INSP === 'object' ? INSP.w || 0 : 0), y + 14.2, 'markers', { size: 9, a: .38 }) : ''), g = '', hits = hit(X0, y0, X1 - X0, MK_H, 'scenebar', '', 'default')
  SCENES.forEach((sc, i) => {
    const xa = bx(sc.a), xb = bx(sc.b), on = i === cur, xl = Math.max(xa, X0), xr = Math.min(xb, X1)
    if (xr - xl < 1) return
    const nm = fit(asGiven(sc.name), Math.max(8, xr - xl - 14), 8.5, 700), w = Math.min(xr - xl - 4, tw(nm, 8.5, 700) + 10)
    g += P(`M${n(xa) + .5} ${y + 2}V${y0 + MK_H}`, { stroke: INK, sa: .5 })
    if (w > 8) g += R(Math.max(xa, X0) + .8, y + 4, w, 13, { fill: on ? '#F7D774' : '#EFCB62', x: ' filter="drop-shadow(0 .5px .5px rgba(0,0,0,.3))"' }) + T(Math.max(xa, X0) + 5, y + 13.6, nm, { size: 8.5, w: 700, c: '#2A1E10' })
    if (S.focus === 'marker' && S.selM === sc.a && w > 8) g += R(Math.max(xa, X0) + .8, y + 4, w, 13, { stroke: '#2A1E10', sw: 1 })
    hits += hit(xl, y0 + 2, xr - xl, MK_H - 4, 'scene', ` data-i="${i}"`)
  })
  return s + G(g, '', TL) + hline(0, RX, y0 + MK_H - .5, .06) + vline(Math.max(HEAD_W, X0) - .5, y0, y0 + MK_H, .08) + hits
}
/* the cycle, in red grease pencil along the top of the bars */
function skinCycle (ca, cb, y, on) {
  const c = on ? lkC('cycle.c', SOLO) : INK, a = on ? .9 : .35
  return P(`M${n(ca)} ${y + 9}L${n(ca + 1.5)} ${y + 3.5}L${n(cb - 1.5)} ${y + 3}L${n(cb)} ${y + 9}`, { stroke: c, sw: 2.2, cap: 'round', sa: a, x: ' stroke-linejoin="round"' })
}
/* the playhead: a tape head on the bars, a line down the tape */
function skinPlayhead (c, w) {
  const y = RU_Y + RU_CY
  return P(`M.5 ${y}V${BY}`, { stroke: c, sw: Math.max(1, w) }) + R(-6, RU_Y + 2, 12, RU_H - 4, { rx: 1.5, fill: 'url(#sk-chrome)', stroke: '#5E5850', sw: .5 }) + R(-.7, RU_Y + 4, 1.4, RU_H - 8, { fill: '#2B2622' }) + hit(-10.5, y, 22, RU_H - RU_CY, 'playhead', '', 'ew-resize')
}

/* ── the mixer as a console: a level knob on its scale of decibels where the fader was, the pan a pointer, lamps ── */
const STRIP_ANG = v => { const t = Math.max(0, Math.min(1, volF(v))); return -140 + t * 280 }
function skinStripLevel (cx, cy, r, vol, muted) {
  let s = ''
  for (const [v, lab] of [[-48, '∞'], [-24, '24'], [-12, '12'], [-6, '6'], [0, '0'], [6, '6']]) {
    const a = STRIP_ANG(v) * Math.PI / 180
    s += P(`M${n(cx + (r + 3) * Math.sin(a))} ${n(cy - (r + 3) * Math.cos(a))}L${n(cx + (r + 6) * Math.sin(a))} ${n(cy - (r + 6) * Math.cos(a))}`, { stroke: v === 0 ? SK.red : INK, sw: v === 0 ? 1 : .7, sa: v === 0 ? 1 : .7 })
    s += `<text x="${n(cx + (r + 12) * Math.sin(a))}" y="${n(cy - (r + 12) * Math.cos(a) + 2)}" text-anchor="middle" font-family="${FONT}" font-size="5.6" font-weight="600" fill="${v === 0 ? SK.red : INK}" fill-opacity="${v === 0 ? 1 : .75}">${lab}</text>`
  }
  return s + G(skKnob(cx, cy, r, STRIP_ANG(vol), { cap: '#E9E1CF' }), '', muted ? ' opacity=".6"' : '')
}
function skinStripPan (cx, cy, pan) {
  return skKnob(cx, cy, 7, (pan || 0) * 135, { kind: 'chicken' })
}

/* console's own, among every theme's */
SKINS.scenes.console = skinScenes; SKINS.cycle.console = skinCycle; SKINS.play.console = skinPlayhead
SKINS.strip.console = {
  pan: (px, py, pw, pan) => skinStripPan(px + pw / 2, py + 1, pan),
  level: (x, w, sx, sw, q, vol, muted) => skinStripLevel(x + w / 2, (q.ft + q.fb) / 2, Math.max(8, Math.min(sw / 2 - 14, q.fh / 2 - 12, 22)), vol, muted),
  cells: (sx, sw, y, its, i) => { const lw = Math.min(15, Math.floor((sw + 3) / its.length) - 3); return skinLamps(sx + (sw - (lw + 3) * its.length + 3) / 2, y, its, i, lw) },
  name: (x, w, sx, sw, yb, t) => skTape(sx + 1, yb - 19, sw - 2, t.name, 9.5),
}
