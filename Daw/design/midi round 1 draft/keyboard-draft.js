/* the keyboard, draft 2 — what shows while the computer's keys are a keyboard (command k). A DRAFT, drawn with the room's
   own kit on the room's own page (draft.mjs reads it into the page; the app does not). Two ways:
     a  a sheet with a piano on it: the keys as a piano has them, each with the letter that plays it; beside them where it
        starts (z, x), how hard it plays (c, v), the pedal (tab), the bend (1, 2) and the wheel (3 to 8)
     b  one line: the same letters in the order of the keys, the black ones dark
   st: { held: [semitones up from the first key], ped, oct, vel, mod (0..5, the cell of the wheel), bend (-1, 0, 1), track: { name, c } | null } */
const KB_WHITE = [['a', 0], ['s', 2], ['d', 4], ['f', 5], ['g', 7], ['h', 9], ['j', 11], ['k', 12], ['l', 14], [';', 16], ["'", 17]]
const KB_BLACK = [['w', 1, 0], ['e', 3, 1], ['t', 6, 3], ['y', 8, 4], ['u', 10, 5], ['o', 13, 7], ['p', 15, 8]]
const KB_A = { w: 652, h: 150 }
function kbSheet (x, y, st) {
  const kw = 34, wh = 92, bw = 21, bh = 56, pad = 16, kx = x + pad, ky = y + 42, base = st.oct * 12, t = st.track, held = new Set(st.held || []), lit = t ? t.c : INK, onLit = t && t.on ? t.on : K0
  let s = R(x, y, KB_A.w, KB_A.h, { rx: 3, fill: K2 }) + R(x + .5, y + .5, KB_A.w - 1, KB_A.h - 1, { rx: 3, stroke: INK, sa: .28 })
  /* its name; the track that hears it, by its pigment and its name; at the far end the key that puts it away */
  s += T(x + pad, y + 25.5, 'keyboard', { size: 11.5, w: 500 })
  const tx = x + pad + tw('keyboard', 11.5, 500) + 12
  s += t ? R(tx, y + 17, 6, 6, { fill: t.c }) + T(tx + 11, y + 25.5, fit(t.name, 180, 9.5), { size: 9.5, a: .7 }) : T(tx, y + 25.5, 'no track of notes is chosen', { size: 9.5, a: .4 })
  s += T(x + KB_A.w - pad, y + 25.5, '⌘k', { size: 9.5, a: .36, anchor: 'end' })
  /* the piano: white keys in ink, black keys in paper, a held key in the track's pigment; on each the letter that plays it */
  const dim = t ? 1 : .34, W = KB_WHITE.length * kw, cid = 'kb' + (++UID)
  let keys = `<clipPath id="${cid}"><rect x="${kx}" y="${ky}" width="${W}" height="${wh}" rx="2.5"/></clipPath>`, body = R(kx, ky, W, wh, { fill: INK, fa: .92 }), seams = ''
  KB_WHITE.forEach(([letter, semi], i) => {
    const cx = kx + i * kw, on = held.has(semi)
    if (on) body += R(cx, ky, kw, wh, { fill: lit })
    if (i) seams += `M${cx} ${ky}V${ky + wh}`
    body += T(cx + kw / 2, ky + wh - (semi % 12 === 0 ? 19 : 11), letter, { size: 11, w: 500, c: on ? onLit : K0, a: on ? 1 : .86, anchor: 'middle' })
    if (semi % 12 === 0) body += T(cx + kw / 2, ky + wh - 7.5, keyName(base + semi), { size: 7.5, c: on ? onLit : K0, a: on ? .7 : .5, anchor: 'middle' })
  })
  body += P(seams, { stroke: K2, sw: 1 })
  for (const [letter, semi, after] of KB_BLACK) {
    const cx = kx + (after + 1) * kw - bw / 2, on = held.has(semi)
    body += R(cx - 1, ky, bw + 2, bh + 1, { fill: K2 }) + R(cx, ky, bw, bh, { fill: on ? lit : K0 }) + T(cx + bw / 2, ky + bh - 9, letter, { size: 9.5, w: on ? 500 : 400, c: on ? onLit : INK, a: on ? 1 : .78, anchor: 'middle' })
  }
  s += G(keys + G(body, '', ` clip-path="url(#${cid})"`), '', dim < 1 ? ` opacity="${dim}"` : '')
  /* beside it: four lines — where it starts, how hard, pedal and bend, the wheel */
  const sx = kx + W + 24, lw = 58, row = 23, line = 74, y0 = ky + 2
  const name = (k, word) => T(sx, y0 + k * row + 12.6, word, { size: 9.5, a: .4 })
  const pair = (k, a, b, onA, onB) => cells(x + KB_A.w - pad - 44, y0 + k * row, 18, [{ t: a, on: onA }, { t: b, on: onB }], { size: 9.5, widths: [22, 22] })[0]
  { const lx = sx + lw, ly = y0 + 9, from = (st.oct * 12) / 127, span = 18 / 127                 // the whole run of keys as a line; the stretch the letters reach, marked on it
    s += name(0, 'from') + R(lx, ly - 1, line, 2, { fill: INK, fa: .12 }) + R(lx + line * from, ly - 3, Math.max(6, line * span), 6, { fill: INK }) + T(lx + line + 10, y0 + 12.6, keyName(base), { size: 9.5, a: .92 }) + pair(0, 'z', 'x') }
  { const lx = sx + lw, ly = y0 + row + 9, f = st.vel / 127
    s += name(1, 'velocity') + R(lx, ly - 1, line, 2, { fill: INK, fa: .12 }) + R(lx, ly - 1, line * f, 2, { fill: INK, fa: .5 }) + R(lx + line * f - 1, ly - 5, 2, 10, { fill: INK }) + T(lx + line + 10, y0 + row + 12.6, String(st.vel), { size: 9.5, a: .92 }) + pair(1, 'c', 'v') }
  s += name(2, 'pedal') + key(sx + lw, y0 + 2 * row, 'tab', { armed: !!st.ped, pad: 8 })[0]
  s += T(x + KB_A.w - pad - 44 - 8, y0 + 2 * row + 12.6, 'bend', { size: 9.5, a: .4, anchor: 'end' }) + pair(2, '1', '2', st.bend < 0, st.bend > 0)
  s += name(3, 'wheel') + cells(sx + lw, y0 + 3 * row, 18, ['3', '4', '5', '6', '7', '8'].map((k, i) => ({ t: k, on: st.mod === i })), { size: 9.5, widths: [22, 22, 22, 22, 22, 22] })[0]
  return s
}
/* way b: one line of it — the letters in the order of the keys in one frame cut into cells (a black key's cell dark, a
   held one filled), then where it starts and how hard */
const KB_B = { h: 26 }
function kbStrip (x, y, st) {
  const order = [['a', 0, 0], ['w', 1, 1], ['s', 2, 0], ['e', 3, 1], ['d', 4, 0], ['f', 5, 0], ['t', 6, 1], ['g', 7, 0], ['y', 8, 1], ['h', 9, 0], ['u', 10, 1], ['j', 11, 0], ['k', 12, 0], ['o', 13, 1], ['l', 14, 0], ['p', 15, 1], [';', 16, 0], ["'", 17, 0]]
  const cw = 20, h = 18, t = st.track, held = new Set(st.held || []), base = st.oct * 12, lit = t ? t.c : INK, onLit = t && t.on ? t.on : K0, pad = 10
  const wAll = pad + tw('keyboard', 9.5, 500) + 12 + order.length * cw + 14 + tw(keyName(base), 9.5) + 12 + tw(String(st.vel), 9.5) + (st.ped ? 12 + tw('pedal', 9.5) : 0) + pad
  let s = R(x, y, wAll, KB_B.h, { rx: 3, fill: K2 }) + R(x + .5, y + .5, wAll - 1, KB_B.h - 1, { rx: 3, stroke: INK, sa: .28 })
  let cx = x + pad
  s += T(cx, y + 16.8, 'keyboard', { size: 9.5, w: 500 }); cx += tw('keyboard', 9.5, 500) + 12
  const fy = y + 4, x0 = cx
  let fill = '', div = '', text = ''
  order.forEach(([letter, semi, black], i) => {
    const on = held.has(semi)
    if (on) fill += R(cx, fy, cw, h, { fill: lit }); else if (black) fill += R(cx, fy, cw, h, { fill: K0 })
    text += T(cx + cw / 2, fy + 12.6, letter, { size: 9.5, w: on ? 500 : 400, c: on ? onLit : INK, a: on ? 1 : black ? .6 : .86, anchor: 'middle' })
    if (i) div += `M${cx + .5} ${fy + 1}V${fy + h - 1}`
    cx += cw
  })
  s += fill + P(div, { stroke: INK, sa: .15 }) + text + R(x0 + .5, fy + .5, order.length * cw - 1, h - 1, { rx: 2, stroke: INK, sa: .24 })
  cx += 14; s += T(cx, y + 16.8, keyName(base), { size: 9.5, a: .92 }); cx += tw(keyName(base), 9.5) + 12
  s += T(cx, y + 16.8, String(st.vel), { size: 9.5, a: .6 }); cx += tw(String(st.vel), 9.5)
  if (st.ped) s += T(cx + 12, y + 16.8, 'pedal', { size: 9.5, a: .92 })
  return [s, wAll]
}
/* in the room: over the lower left of the lanes (a), or lying on the lanes' lower edge (b) */
ND.kb = null
function pKeyboard () {
  const o = ND.kb
  if (!o) return ''
  const t = S.tracks[S.sel], st = Object.assign({ oct: TYPE.oct, vel: TYPE.vel, track: isInst(t) ? t : null }, o)
  return o.way === 'b' ? kbStrip(X0 + 10, BY - KB_B.h - 12, st)[0] : kbSheet(X0 + 12, BY - KB_A.h - 12, st)
}
/* every state on one sheet, at the size it would be in the room, each with a word of what it is (the words are the draft's, not the room's) */
function kbStates (track) {
  const tr = { name: track.name, c: track.c, on: track.on }
  const A = [['at rest', { oct: 5, vel: 100, mod: -1, bend: 0, track: tr }], ['c e g down, the pedal held, the wheel at 5', { oct: 5, vel: 100, held: [0, 4, 7], ped: true, mod: 2, bend: 0, track: tr }], ['an octave down, softer, bent up; a black key down', { oct: 4, vel: 70, held: [3, 12], mod: -1, bend: 1, track: tr }], ['no track of notes chosen', { oct: 5, vel: 100, mod: -1, bend: 0, track: null }]]
  let s = R(0, 0, W, H, { fill: K1 }) + T(40, 44, 'the keyboard', { size: 12, w: 500 }) + T(40 + tw('the keyboard', 12, 500) + 10, 44, 'command k', { size: 9.5, a: .46 }) + T(40, 64, 'way a, a sheet with a piano on it', { size: 9.5, a: .46 }) + T(740, 64, 'way b, one line (below)', { size: 9.5, a: .46 })
  A.forEach(([word, st], i) => { const gx = 40 + (i % 2) * 700, gy = 104 + Math.floor(i / 2) * 250; s += T(gx, gy, word, { size: 9.5, a: .46 }) + G(kbSheet(0, 0, st), `translate(${gx} ${gy + 12})`) })
  const by = 104 + 2 * 250 + 30
  s += T(40, by, 'way b, at rest', { size: 9.5, a: .46 }) + G(kbStrip(0, 0, { oct: 5, vel: 100, track: tr })[0], `translate(40 ${by + 12})`)
  s += T(740, by, 'way b, c e g down, the pedal held', { size: 9.5, a: .46 }) + G(kbStrip(0, 0, { oct: 5, vel: 100, held: [0, 4, 7], ped: true, track: tr })[0], `translate(740 ${by + 12})`)
  return s
}
