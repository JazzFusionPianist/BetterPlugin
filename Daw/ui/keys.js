/* ── the keyboard: what shows while the computer's keys are a keyboard (command k) ──
   A sheet over the lower left of the lanes with a piano on it: the keys as a piano has them, each with the letter that
   plays it, a held key in the pigment of the track that hears it; beside them where it starts (z, x), how hard it plays
   (c, v), the pedal (tab), the bend (1, 2) and the wheel (3 to 8). Everything on it can be pressed with the pointer too.
   The playing itself is in midi.js (TYPE and its hands); this draws it and gives the pointer the same hands.
   (Read after the room's own hands are made, before they are put to work: see the end.) */
const KB_WHITE = [['a', 0], ['s', 2], ['d', 4], ['f', 5], ['g', 7], ['h', 9], ['j', 11], ['k', 12], ['l', 14], [';', 16], ["'", 17]]
const KB_BLACK = [['w', 1, 0], ['e', 3, 1], ['t', 6, 3], ['y', 8, 4], ['u', 10, 5], ['o', 13, 7], ['p', 15, 8]]
const KB = { w: 652, h: 150, held: null }                                                // (held: what the pointer holds down on the sheet — 'key' or 'bend')
/* the track that hears the keyboard: the chosen one if it is a track of notes, or else one that is armed */
const kbTrack = () => { const t = S.tracks[S.sel]; return isInst(t) ? t : S.tracks.find(liveOn) || null }
function pKeys () {
  if (!TYPE.on || (typeof START !== 'undefined' && START.on)) return ''
  const x = X0 + 12, y = Math.max(TY + 4, BY - KB.h - 12), t = kbTrack()
  const kw = 34, wh = 92, bw = 21, bh = 56, pad = 16, kx = x + pad, ky = y + 42, base = TYPE.oct * 12, held = new Set([...TYPE.down.values()].map(k => k - base)), lit = t ? t.c : INK, onLit = t && t.on ? t.on : K0
  const h1 = (hx, hy, hw, hh, k, v, cur) => hit(hx, hy, hw, hh, 'kb', ` data-k="${k}"${v == null ? '' : ` data-v="${v}"`}`, cur || 'pointer')
  let s = R(x, y, KB.w, KB.h, { rx: 3, fill: K2 }) + R(x + .5, y + .5, KB.w - 1, KB.h - 1, { rx: 3, stroke: INK, sa: .28 }) + h1(x, y, KB.w, KB.h, 'none', null, 'default')
  /* its name; the track that hears it, by its pigment and its name; at the far end the key that puts it away */
  s += T(x + pad, y + 25.5, 'keyboard', { size: 11.5, w: 500 })
  const tx = x + pad + tw('keyboard', 11.5, 500) + 12
  s += t ? R(tx, y + 17, 6, 6, { fill: t.c }) + T(tx + 11, y + 25.5, fit(t.name, 180, 9.5), { size: 9.5, a: .7 }) : T(tx, y + 25.5, 'no track of notes is chosen', { size: 9.5, a: .4 })
  s += T(x + KB.w - pad, y + 25.5, '⌘k', { size: 9.5, a: .36, anchor: 'end' }) + h1(x + KB.w - pad - 26, y + 10, 34, 24, 'close')
  /* the piano: white keys in ink, black keys in paper, a held key in the track's pigment; on each the letter that plays it */
  const dim = t ? 1 : .34, Wd = KB_WHITE.length * kw, cid = 'kb' + (++UID)
  let body = R(kx, ky, Wd, wh, { fill: INK, fa: .92 }), seams = '', hits = ''
  KB_WHITE.forEach(([letter, semi], i) => {
    const cx = kx + i * kw, on = held.has(semi)
    if (on) body += R(cx, ky, kw, wh, { fill: lit })
    if (i) seams += `M${cx} ${ky}V${ky + wh}`
    body += T(cx + kw / 2, ky + wh - (semi % 12 === 0 ? 19 : 11), letter, { size: 11, w: 500, c: on ? onLit : K0, a: on ? 1 : .86, anchor: 'middle' })
    if (semi % 12 === 0) body += T(cx + kw / 2, ky + wh - 7.5, keyName(base + semi), { size: 7.5, c: on ? onLit : K0, a: on ? .7 : .5, anchor: 'middle' })
    hits += h1(cx, ky, kw, wh, 'key', semi)
  })
  body += P(seams, { stroke: K2, sw: 1 })
  for (const [letter, semi, after] of KB_BLACK) {
    const cx = kx + (after + 1) * kw - bw / 2, on = held.has(semi)
    body += R(cx - 1, ky, bw + 2, bh + 1, { fill: K2 }) + R(cx, ky, bw, bh, { fill: on ? lit : K0 }) + T(cx + bw / 2, ky + bh - 9, letter, { size: 9.5, w: on ? 500 : 400, c: on ? onLit : INK, a: on ? 1 : .78, anchor: 'middle' })
    hits += h1(cx, ky, bw, bh, 'key', semi)
  }
  s += G(`<clipPath id="${cid}"><rect x="${kx}" y="${ky}" width="${Wd}" height="${wh}" rx="2.5"/></clipPath>` + G(body, '', ` clip-path="url(#${cid})"`), '', dim < 1 ? ` opacity="${dim}"` : '') + hits
  /* beside it: four lines — where it starts, how hard, pedal and bend, the wheel */
  const sx = kx + Wd + 24, lw = 58, row = 23, line = 74, y0 = ky + 2
  const name = (k, word) => T(sx, y0 + k * row + 12.6, word, { size: 9.5, a: .4 })
  const pair = (k, a, b, onA, onB, kind, va, vb) => cells(x + KB.w - pad - 44, y0 + k * row, 18, [{ t: a, on: onA, a: 'kb', more: ` data-k="${kind}" data-v="${va}"` }, { t: b, on: onB, a: 'kb', more: ` data-k="${kind}" data-v="${vb}"` }], { size: 9.5, widths: [22, 22] })[0]
  { const lx = sx + lw, ly = y0 + 9, from = base / 127, span = 18 / 127                  // the whole run of keys as a line; the stretch the letters reach, marked on it
    s += name(0, 'from') + R(lx, ly - 1, line, 2, { fill: INK, fa: .12 }) + R(lx + line * from, ly - 3, Math.max(6, line * span), 6, { fill: INK }) + T(lx + line + 10, y0 + 12.6, keyName(base), { size: 9.5, a: .92 }) + pair(0, 'z', 'x', false, false, 'oct', -1, 1) }
  { const lx = sx + lw, ly = y0 + row + 9, f = TYPE.vel / 127
    s += name(1, 'velocity') + R(lx, ly - 1, line, 2, { fill: INK, fa: .12 }) + R(lx, ly - 1, line * f, 2, { fill: INK, fa: .5 }) + R(lx + line * f - 1, ly - 5, 2, 10, { fill: INK }) + T(lx + line + 10, y0 + row + 12.6, String(TYPE.vel), { size: 9.5, a: .92 }) + pair(1, 'c', 'v', false, false, 'vel', -10, 10) }
  s += name(2, 'pedal') + key(sx + lw, y0 + 2 * row, 'tab', { armed: TYPE.ped, pad: 8, a: 'kb', more: ' data-k="ped"' })[0]
  s += T(x + KB.w - pad - 44 - 8, y0 + 2 * row + 12.6, 'bend', { size: 9.5, a: .4, anchor: 'end' }) + pair(2, '1', '2', TYPE.bend < 0, TYPE.bend > 0, 'bend', -1, 1)
  s += name(3, 'wheel') + cells(sx + lw, y0 + 3 * row, 18, ['3', '4', '5', '6', '7', '8'].map((k, i) => ({ t: k, on: TYPE.mod === i, a: 'kb', more: ` data-k="mod" data-v="${i}"` })), { size: 9.5, widths: [22, 22, 22, 22, 22, 22] })[0]
  return s
}
/* the pointer on the sheet: a key is held while the button is; the small keys do what their letters do */
function kbDown (e) {
  const el = e.target.closest ? e.target.closest('[data-a="kb"]') : null
  if (!el || e.button === 2) return false
  e.preventDefault()
  const k = el.dataset.k, v = +el.dataset.v
  const hold = what => { KB.held = what; try { svg.setPointerCapture(e.pointerId) } catch (err) {} }
  if (k === 'key') { typeNote('pointer', TYPE.oct * 12 + v, true); hold('key') }
  else if (k === 'oct') typeOct(v)
  else if (k === 'vel') typeVel(v)
  else if (k === 'ped') typePed(!TYPE.ped)                                               // (the pointer cannot hold it down and play: a press sets it, another lets it go)
  else if (k === 'bend') { typeBend(v); hold('bend') }
  else if (k === 'mod') typeMod(v)
  else if (k === 'close') toggleTyping(false)
  return true
}
function kbUp () { if (KB.held === 'key') typeNote('pointer', 0, false); else if (KB.held === 'bend') typeBend(0); KB.held = null }

/* ── joined to the room ── */
{
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.id = 'g-keys'
  document.getElementById('svg').insertBefore(g, document.getElementById('g-top'))
  PARTS.keys = pKeys
  const down0 = onDown, up0 = onUp, flush0 = flush
  onDown = function (e) { if (!kbDown(e)) down0(e) }
  onUp = function (e) { if (KB.held) { kbUp(); return } up0(e) }
  /* the sheet names the track that hears it and sits on the lanes' lower edge: whatever redraws those redraws it */
  flush = function () { if (TYPE.on && (dirty.has('head') || dirty.has('dock') || dirty.has('lanes'))) dirty.add('keys'); flush0() }
}
