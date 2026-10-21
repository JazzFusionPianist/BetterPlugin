/* ── the mixer with the transport panel: every track on one screen, the chosen ones opened wide ──
   His pick of design/mixer panel draft 3 (2026-10-21, "ㅇㅇㅇ하자", with: the sends must have a place to be put, and the
   meters must be stereo), drawn in bauhaus's way (the mixer he showed) in the room's colours and the panel's shapes:
     a wide strip: its number large in its colour (chosen: on a block of ink), its name, its pan a knob; its patch as a list
       of names (pressed: the plug-in's window; with option, pulled: a copy; the + : the list beside it); its sends as a
       list too, each a line as long as it sends with a small square at its end (pulled sideways: how much; + send: where
       to); its level two bars of its colour, left and right, beside the fader's line, the white square for a handle, the
       level beside the square (pressed twice: typed); r i m s as the panel's shapes; where it goes at its foot
     every track on one screen: the strips as wide as there is room for; when they no longer fit, the chosen ones stay
       wide and the rest go narrow — the number large, the name on its side, the two bars, the handle
     past that (60 tracks and more, or a narrow window): a row of their numbers along the top in their colours (pressed:
       that track chosen, and brought into sight); the strips shown are those around the chosen one
     the tracks chosen in the arrangement are the ones opened here: the mixer follows them.
   It is the room's one mixer, the transport panel up or not (his word, 2026-10-21); a theme's own mixer stays its own.
   The out the same as a wide strip, its name the word. The engine tells each track's two sides apart for the meters
   (Engine.h takeMeters "s"; native.js METERS.ts). Read after panel.js. */
const MPX = { geo: new Map(), lv: new Map(), slice: [0, 0] }
const MP_OUTW = 120, MP_WIDE = 150, MP_NARROW = 17
MPX.base = 94                                                                            // (a wide strip's own part: its bars, its fader, its level; its send knobs stand beside)
{ const read0 = skinRead
  skinRead = function () { read0(); if (SKIN.k.mixer === 'plain') SKIN.k.mixer = 'panel' } }      // (the room's one mixer, the transport panel up or not: his word, 2026-10-21 — a theme's own mixer, bauhaus's, stays its own)
const mpNum = ' style="font-variant-numeric: tabular-nums"'
const mpCaps = (x, y, w, o = {}) => T(x, y, String(w), Object.assign({ size: 8.5, w: 600, a: .45, x: ' letter-spacing=".4"' }, o))      // (small words in small letters: his rule, 2026-10-21 — capitals only for what one names oneself)
/* r i m s as the panel's shapes: record a ring, monitor a diamond, mute a square, solo a triangle — filled when on */
const mpShape = (k, cx, cy, z, on) => {
  if (k === 'r') return on ? Cc(cx, cy, z / 2, { fill: REC }) : Cc(cx, cy, z / 2 - .4, { stroke: REC, sa: .9, sw: 1 })
  if (k === 'i') return P(`M${n(cx)} ${n(cy - z / 2 - .6)}L${n(cx + z / 2 + .6)} ${n(cy)}L${n(cx)} ${n(cy + z / 2 + .6)}L${n(cx - z / 2 - .6)} ${n(cy)}Z`, on ? { fill: MON } : { stroke: MON, sa: .9, sw: 1, x: ' stroke-linejoin="round"' })
  if (k === 's') return P(`M${n(cx)} ${n(cy - z / 2)}L${n(cx + z / 2 + .5)} ${n(cy + z / 2)}L${n(cx - z / 2 - .5)} ${n(cy + z / 2)}Z`, on ? { fill: SOLO } : { stroke: INK, sa: .8, sw: 1, x: ' stroke-linejoin="round"' })
  return on ? R(cx - z / 2, cy - z / 2, z, z, { fill: INK }) : R(cx - z / 2 + .5, cy - z / 2 + .5, z - 1, z - 1, { stroke: INK, sa: .8, sw: 1 })
}
const mpKnob = (cx, cy, r, pan) => { const a = (pan * 135 - 90) * Math.PI / 180; return Cc(cx, cy, r - .5, { stroke: INK, sa: .85, sw: 1.1 }) + P(`M${n(cx)} ${n(cy)}L${n(cx + Math.cos(a) * (r - 2))} ${n(cy + Math.sin(a) * (r - 2))}`, { stroke: INK, sw: 1.2, cap: 'round' }) }
const mpPlus = (cx, cy) => Cc(cx, cy, 5, { stroke: INK, sa: .55, sw: .9 }) + P(`M${n(cx)} ${n(cy - 3)}V${n(cy + 3)}M${n(cx - 3)} ${n(cy)}H${n(cx + 3)}`, { stroke: INK, sa: .85, sw: 1 })
const MP_PRINT_C = () => ({ tape: CREAM, space: SPACE, delay: MINT })
{ const st = document.createElement('style')                                            // a send's knob says how much only while the pointer is on it (or it is turned)
  st.textContent = '.mpk .mpk-db{display:none}.mpk:hover .mpk-db,.mpk.on .mpk-db{display:inline}.mpk:hover .mpk-bus,.mpk.on .mpk-bus{display:none}'
  document.head.appendChild(st) }
const MP_SENDS = typeof MAX_SENDS === 'number' ? MAX_SENDS : 10                         // (ten at most: his word, 2026-10-21; the engine's own limit is Slur Studio 4's — mix.js/Engine.h)
/* a send's knob: the way it can go a ring of 270 degrees, how far it goes in the track's colour, a mark where it stands;
   its bus named in its title (pressed: where it goes) */
const mpSendDb = (t, k, sd) => { try { const v = shown(t, 'send' + k); return isFinite(v) ? v : sd.db } catch (e) { return sd.db } }      // (a send the lines do not know yet: as it is kept)
const mpKnobR = (ft, fb) => clamp(((fb - ft) / 6 - 20) / 2, 7, 12)                       // (six to a column at least)
const mpPer = (ft, fb, r) => Math.max(1, Math.floor((fb - ft) / (2 * r + 20)))
const mpSendKnob = (cx, cy, r, f, c, name) => {
  const at = (rr, v) => { const a = (-135 + 270 * v - 90) * Math.PI / 180; return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)] }
  const arc = (v0, v1, rr) => { if (v1 - v0 < .005) return ''; const [x0, y0] = at(rr, v0), [x1, y1] = at(rr, v1); return `M${n(x0)} ${n(y0)}A${rr} ${rr} 0 ${(v1 - v0) * 270 > 180 ? 1 : 0} 1 ${n(x1)} ${n(y1)}` }
  const [mx, my] = at(r - 3.5, f)
  return `<g><title>${esc(name)}</title>` + P(arc(0, 1, r), { stroke: INK, sa: .18, sw: 2 }) + P(arc(0, f, r), { stroke: c, sw: 2, cap: 'round' }) + Cc(cx, cy, r - 3, { fill: K2 }) + P(`M${n(cx)} ${n(cy)}L${n(mx)} ${n(my)}`, { stroke: INK, sw: 1.2, cap: 'round' }) + '</g>'
}
/* two bars, left and right, as loud as each side (the frame moves them: SKINS.frame.panel below) */
const mpBars = (key, x, ft, fb, bw, gap, c, dim) => {
  MPX.geo.set(key, { ft, fb })
  let s = ''
  for (let k = 0; k < 2; k++) { const bx = x + k * (bw + gap); s += R(bx, ft, bw, fb - ft, { fill: INK, fa: .06 }) + R(bx, fb, bw, 0, { fill: c, fa: dim ? .4 : .95, x: ` id="mpm-${key}-${k}"` }) + R(bx, fb, bw, 1.2, { fill: INK, fa: 0, x: ` id="mph-${key}-${k}"` }) }
  return s
}

SKINS.mixer.panel = (y, h) => {
  const list = rows(), N = list.length, A = Math.max(120, RX - 12 - MP_OUTW)
  /* where the faders stand (all on one line across): first a guess of the row of numbers, then under the longest patch */
  const fxRows = i => (S.tracks[i].theirs || S.tracks[i].kind === 'stack' ? 0 : fxItems(S.tracks[i]).length + 1)
  const geomAt = top => { const H = y + h - top, fb = y + h - 50, need = 64 + 15 * Math.max(2, ...list.map(fxRows)) + 12, ft = top + clamp(need, 110, Math.max(110, H * .52)); return { H, fb, ft } }
  /* a wide strip's width: the fader's part, and a column of send knobs for every so many of its sends (and its +) */
  const widthOf = (i, g) => { const t = S.tracks[i], r = mpKnobR(g.ft, g.fb), per = mpPer(g.ft, g.fb, r), k = t.kind === 'stack' ? 0 : Math.min(MP_SENDS, (t.sends || []).length + ((t.sends || []).length < MP_SENDS ? 1 : 0)); return MPX.base + Math.max(1, Math.ceil(k / per)) * (2 * r + 12) }
  /* how wide: all wide when they fit; else the chosen wide (the lead first) and the rest narrow */
  const lead = S.sel, chosenL = list.filter(i => isChosen(i)).sort((a, b) => (b === lead) - (a === lead))
  let g = geomAt(y), sumAll = list.reduce((q, i) => q + widthOf(i, g), 0), allWide = sumAll <= A, many = false, nw = 0, spare = 0
  let wideSet = new Set(chosenL)
  if (allWide) spare = Math.min(40, (A - sumAll) / Math.max(1, N))
  else {
    let sumW = 0; wideSet = new Set()
    for (const i of chosenL) { const w = widthOf(i, g); if (sumW + w > A * .7 && wideSet.size) break; wideSet.add(i); sumW += w }
    nw = (A - sumW) / Math.max(1, N - wideSet.size)
    if (nw < MP_NARROW) { many = true; nw = MP_NARROW; g = geomAt(y + 26) }
  }
  let s = R(0, y, RX, h, { fill: K1 }), top = y
  /* past one screen: their numbers in a row along the top */
  if (many) {
    const cw = Math.min(26, (A - 8) / N)
    list.forEach((i, k) => { const t = S.tracks[i], x = 8 + k * cw, on = isChosen(i); s += (on ? R(x - 1, y + 5, cw - 1, 15, { fill: INK }) : '') + T(x + (cw - 2) / 2, y + 16, pad2(i + 1), { size: Math.max(8.5, Math.min(10, cw * .6)), w: 600, c: on ? K1 : t.c, anchor: 'middle', x: mpNum }) + hit(x - 1, y + 3, cw, 19, 'mp-jump', ` data-i="${i}"`) })
    s += R(0, y + 25, RX, .6, { fill: INK, fa: .08 })
    top = y + 26
  }
  /* which are on the screen: with many, those around the lead (the arrangement's choice brought into sight) */
  let shownL = list
  if (many) {
    const wideW = [...wideSet].reduce((q, i) => q + widthOf(i, g), 0), fitN = Math.max(wideSet.size + 1, Math.floor((A - wideW) / MP_NARROW) + wideSet.size), at = list.indexOf(lead)
    if (lead !== MPX.lead && at >= 0 && (at < S.panel.mx || at >= S.panel.mx + fitN)) S.panel.mx = at - Math.floor(fitN / 3)      // (the track chosen elsewhere brought into sight; the wheel turns the rest)
    MPX.lead = lead
    S.panel.mx = clamp(S.panel.mx, 0, Math.max(0, N - fitN)); shownL = list.slice(S.panel.mx, S.panel.mx + fitN)
  } else S.panel.mx = 0
  const { H, fb, ft } = g, yOf = db => fb - (fb - ft) * volF(db), maxRows = Math.max(2, Math.floor((ft - top - 76) / 15))
  MPX.geo.clear()
  let x = 8
  for (const i of shownL) {
    const t = S.tracks[i], wide = allWide || wideSet.has(i), w = wide ? widthOf(i, g) + spare : nw, sel = isChosen(i), vol = shown(t, 'vol'), fy = yOf(vol), heardT = heard(t), di = ` data-i="${i}"`
    if (sel && !allWide) s += R(x, top, w, H, { fill: INK, fa: .045 })
    let hits = ''
    if (wide) {
      const L = x + 10, num = pad2(i + 1)
      let nsz = 30; while (nsz > 14 && twTab(num, nsz, 700) + 6 > w - 46) nsz -= 1      // (the number's block is never cut: smaller where the strip is narrow — his ask, 2026-10-21)
      const nwid = twTab(num, nsz, 700)
      /* the number large in its colour (chosen: on ink), the name, the pan a knob */
      s += (sel ? R(L - 3, top + 39 - nsz * .86, nwid + 6, nsz * 1.03, { fill: INK }) : '') + T(L, top + 39, num, { size: nsz, w: 700, c: sel ? K1 : t.c, x: mpNum })
      s += T(L + nwid + 7, top + 38, fit(asGiven(t.name), w - nwid - 46, 12.5, 600), { size: 12.5, w: 600, a: heardT ? .95 : .45 })
      hits += hit(x, top + 6, w - 34, 42, 'msel', di)
      if (t.kind !== 'stack') { s += mpKnob(x + w - 20, top + 30, 9, shown(t, 'pan')) + T(x + w - 20, top + 51, panText(shown(t, 'pan')), { size: 8.5, a: .5, anchor: 'middle' }); hits += hit(x + w - 33, top + 16, 28, 40, 'mpan', di, 'ns-resize') }
      /* the patch and the sends: lists of names */
      let ly = top + 66, used = 0
      const items = fxItems(t), sends = t.sends || [], room = maxRows - 2
      const showF = Math.min(items.length, Math.max(1, room))
      items.slice(0, showF).forEach((it, k) => {
        if (k === showF - 1 && items.length > showF) { s += T(L, ly, `+${items.length - k} more`, { size: 9.5, a: .5 }); hits += hit(x + 4, ly - 11, w - 8, 15, 'm-patch', di) }
        else { s += R(L, ly - 7, 7, 7, { fill: it.c || MP_PRINT_C()[it.k] || t.c, fa: it.off ? .4 : 1 }) + T(L + 12, ly, fit(asGiven(it.t), w - 30, 9.5), { size: 9.5, a: it.off ? .4 : .85 }); hits += hit(x + 4, ly - 11, w - 8, 15, 'mfx', `${di} data-k="${k}"`) }
        ly += 15; used++
      })
      if (!t.theirs && t.kind !== 'stack') { s += mpPlus(L + 4, ly - 3.5) + T(L + 14, ly, 'plug-in', { size: 8.5, a: .4 }); hits += hit(x + 4, ly - 11, w - 8, 15, 'mfxadd', di); ly += 15 }
      else if (t.theirs) { s += T(L, ly, 'patch →', { size: 8.5, a: .45 }); hits += hit(x + 4, ly - 11, w - 8, 15, 'm-patch', di); ly += 15 }      // (another program's track takes no plug-in here: its patch)
      /* its sends: round knobs (as Logic's) in a column right of the fader, how much each sends under it; one more, a + knob;
         when the column is full the strip widens by another (his asks, 2026-10-21) */
      if (t.kind !== 'stack') { const r = mpKnobR(ft, fb), per = mpPer(ft, fb, r), cw = 2 * r + 12, x0 = x + MPX.base + 1
        sends.slice(0, MP_SENDS).forEach((sd, k) => { const cx = x0 + Math.floor(k / per) * cw + r + 4, cy = ft + (k % per) * (2 * r + 20) + r + 2, b = byId(sd.to), db = mpSendDb(t, k, sd), pulling = drag && drag.a === 'msend' && drag.moved && S.tracks[drag.i] === t && drag.k === k
          /* under it the bus it goes to; how much it sends only while the pointer is on it, or it is turned (his ask, 2026-10-21) */
          const much = (db <= -47.5 ? '−∞' : (pulling ? db.toFixed(1) : String(Math.round(db))).replace('-', '−')) + ' db', bus = b ? asGiven(b.name) : 'send'
          /* the words under it stay inside the strip: centred on the knob where there is room, else against the strip's edge */
          const inside = (word, wt) => { const ww = tw(word, 8.5, wt), xr = x + w - 4, xl = x + 4; return cx + ww / 2 > xr ? xr - ww / 2 : cx - ww / 2 < xl ? xl + ww / 2 : cx }
          const busW = fit(bus, Math.min(2 * r + 12, w - 8), 8.5, 500)
          s += `<g class="mpk${pulling ? ' on' : ''}">` + mpSendKnob(cx, cy, r, volF(db), t.c, bus) + T(inside(busW, 500), cy + r + 11, busW, { size: 8.5, w: 500, a: .62, anchor: 'middle', x: ' class="mpk-bus"' }) + T(inside(much, 400), cy + r + 11, much, { size: 8.5, a: 1, anchor: 'middle', x: mpNum + ' class="mpk-db"' })
            + hit(cx - r - 3, cy - r - 3, 2 * r + 6, 2 * r + 16, 'mp-send', `${di} data-k="${k}"`, 'ns-resize') + '</g>' })
        if (sends.length < MP_SENDS) { const k = sends.length, cx = x0 + Math.floor(k / per) * cw + r + 4, cy = ft + (k % per) * (2 * r + 20) + r + 2
          s += Cc(cx, cy, r - .5, { stroke: INK, sa: .3, sw: .9, dash: '2 2' }) + P(`M${n(cx)} ${n(cy - 3.5)}V${n(cy + 3.5)}M${n(cx - 3.5)} ${n(cy)}H${n(cx + 3.5)}`, { stroke: INK, sa: .6, sw: 1 }) + T(cx, cy + r + 11, 'send', { size: 8.5, a: .35, anchor: 'middle' })
          hits += hit(cx - r - 3, cy - r - 3, 2 * r + 6, 2 * r + 16, 'msendadd', di) } }
      /* its level: two bars of its colour, the fader's line, the white square, the level beside it */
      const bx0 = L + 1, lx = bx0 + 2 * 7 + 2 + 18
      s += mpBars(t.id, bx0, ft, fb, 7, 2, t.c, !heardT)
      for (const db of DBS) s += R(lx - 4, yOf(db) - .3, db === 0 ? 3.5 : 2.5, .6, { fill: INK, fa: db === 0 ? .55 : .3 })
      if (t.ghost != null) s += R(lx - 7, yOf(t.ghost) - .5, 14, 1, { fill: INK, fa: .4 })
      s += R(lx - .6, ft, 1.2, fb - ft, { fill: INK, fa: .85 }) + R(lx - 6, fy - 6, 12, 12, { fill: INK, fa: heardT ? 1 : .5 }) + T(lx + 12, fy + 4.5, fmtDb(vol), { size: 13, w: 600, a: heardT || sel ? .95 : .5, x: mpNum })
      hits += hit(bx0 - 4, ft - 8, lx + 10 - bx0, fb - ft + 16, 'mvol', `${di} data-w="0"`, 'ns-resize')
      if (!autoPts(t, 'vol').length) hits += hit(lx + 9, fy - 8, 46, 16, 'volnum', di, 'default')
      /* r i m s; where it goes */
      cellsOf(t).forEach((it, k) => { const cx = L + 5 + k * 17; s += mpShape(it.t, cx, fb + 20, 10, it.on); hits += hit(cx - 8, fb + 10, 16, 20, it.a, di) })
      const out = outName(t) === 'stereo out' ? LANG_WORDS('stereo out') : outName(t)
      s += T(L, fb + 40, '→ ' + out, { size: 8.5, a: .5 }); hits += hit(L - 3, fb + 30, Math.min(w - 14, tw('→ ' + out, 8.5) + 10), 14, 'mout', di)
    } else if (w >= 44) {
      /* narrow, but with room: the number and the name across its head, the pan, the two bars, the fader and its level,
         as many of r i m s as there is room for */
      const L = x + 8, num = pad2(i + 1)
      let ns = Math.min(20, w * .34); while (ns > 10 && twTab(num, ns, 700) + 5 > w - (w >= 58 ? 34 : 14)) ns -= .5
      const nwid = twTab(num, ns, 700)
      s += (sel ? R(L - 2.5, top + 13, nwid + 5, ns + 3, { fill: INK }) : '') + T(L, top + 15 + ns * .82, num, { size: ns, w: 700, c: sel ? K1 : t.c, x: mpNum })
      s += T(L, top + 52, fit(asGiven(t.name), w - 14, 9.5, 600), { size: 9.5, w: 600, a: heardT ? .9 : .42 })
      hits += hit(x, top + 6, w, 52, 'msel', di)
      if (w >= 58 && t.kind !== 'stack') { s += mpKnob(x + w - 14, top + 26, 7, shown(t, 'pan')); hits += hit(x + w - 25, top + 14, 22, 26, 'mpan', di, 'ns-resize') }
      /* its patch and its sends said as counts: the patch's pressed opens its patch, the sends' opens the strip */
      if (t.kind !== 'stack') { const nf = fxItems(t).length, ns = (t.sends || []).length
        s += T(L, top + 72, t.theirs ? 'patch →' : nf ? `${nf} fx` : '+ fx', { size: 8.5, a: nf ? .7 : .4 }); hits += hit(x + 2, top + 61, w - 4, 15, 'm-patch', di)
        s += T(L, top + 88, ns ? `${ns} send${ns === 1 ? '' : 's'}` : '+ send', { size: 8.5, a: ns ? .7 : .4 }); hits += hit(x + 2, top + 77, w - 4, 15, 'msel', di) }
      const bx0 = L, lx = bx0 + 2 * 5 + 1.5 + 12, room = w >= 76
      s += mpBars(t.id, bx0, ft, fb, 5, 1.5, t.c, !heardT)
      for (const db of DBS) s += R(lx - 3.5, yOf(db) - .3, 2.2, .6, { fill: INK, fa: .3 })
      s += R(lx - .5, ft, 1, fb - ft, { fill: INK, fa: .75 }) + R(lx - 5, fy - 5, 10, 10, { fill: INK, fa: heardT ? 1 : .5 })
      s += room ? T(lx + 10, fy + 4, fmtDb(vol), { size: 11, w: 600, a: heardT || sel ? .9 : .5, x: mpNum }) : T(L, fb + 34, fmtDb(vol), { size: 10, w: 600, a: .8, x: mpNum })
      hits += hit(bx0 - 4, ft - 8, (room ? lx + 44 : x + w) - bx0, fb - ft + 16, 'mvol', `${di} data-w="0"`, 'ns-resize')
      const its = cellsOf(t), step = Math.min(14, (w - 16) / Math.max(1, its.length))
      its.forEach((it, k) => { const cx = L + 4 + k * step; s += mpShape(it.t, cx, fb + 18, Math.min(9, step - 3), it.on); hits += hit(cx - step / 2, fb + 9, step, 18, it.a, di) })
    } else {
      /* thin: the number large, the name on its side, the two bars, the handle */
      const cx = x + w / 2, ns = Math.min(13, w * .62)
      s += T(cx, top + 22, pad2(i + 1), { size: ns, w: 700, c: sel ? INK : t.c, anchor: 'middle', x: mpNum })
      s += G(T(0, 0, fit(asGiven(t.name), ft - top - 40, 10, 500), { size: 10, w: 500, a: heardT ? .8 : .4 }), `translate(${n(cx + 3.5)} ${n(ft - 8)}) rotate(-90)`)
      hits += hit(x, top + 4, w, ft - top - 4, 'msel', di)
      const bw = Math.max(2, Math.min(4, (w - 8) / 2 - 1))
      s += mpBars(t.id, cx - bw - .5, ft, fb, bw, 1, t.c, !heardT) + R(cx - 4.5, fy - 4.5, 9, 9, { fill: INK, fa: heardT ? 1 : .5 })
      hits += hit(x, ft - 8, w, fb - ft + 16, 'mvol', `${di} data-w="0"`, 'ns-resize')
      const on = cellsOf(t).find(it => it.on)
      if (on) { s += mpShape(on.t, cx, fb + 20, 8, true); hits += hit(x, fb + 10, w, 20, on.a, di) }
    }
    s += hits
    x += w
    s += R(x - .5, top + 8, .6, H - 16, { fill: INK, fa: .06 })
  }
  /* the out: as a wide strip, its name the word */
  { const L = RX - MP_OUTW + 6, bx0 = L, lx = bx0 + 2 * 7 + 2 + 32, vol = S.master, fy = yOf(vol)      // (room between its meters and its fader for the scale: his ask, 2026-10-21)
    s += R(RX - MP_OUTW - 6, top, MP_OUTW + 6, H, { fill: K2, fa: .6 })
    s += T(L, top + 39, 'out', { size: 30, w: 700, c: INK }) + mpCaps(L + tw(LANG_WORDS('out'), 30, 700) + 7, top + 37, 'stereo') + hit(L - 4, top + 8, MP_OUTW - 8, 40, 'wall-out')
    s += mpBars('M', bx0, ft, fb, 7, 2, LEVEL, false)
    for (const db of DBS) s += R(lx - 4, yOf(db) - .3, 2.5, .6, { fill: INK, fa: .3 }) + T(lx - 7, yOf(db) + 3, db === -48 ? '∞' : (db > 0 ? '+' : db < 0 ? '−' : '') + Math.abs(db), { size: 8.5, a: .35, anchor: 'end', x: mpNum })
    s += R(lx - .6, ft, 1.2, fb - ft, { fill: INK, fa: .85 }) + R(lx - 6, fy - 6, 12, 12, { fill: INK }) + T(lx + 12, fy + 4.5, fmtDb(vol), { size: 15, w: 600, x: mpNum })
    s += hit(bx0 - 4, ft - 8, lx + 10 - bx0, fb - ft + 16, 'mmaster', '', 'ns-resize') + hit(lx + 9, fy - 9, 50, 18, 'volnum', ' data-i="-1"', 'default')
    s += T(L, fb + 40, '→ output 1-2', { size: 8.5, a: .5 }) + (NAT ? hit(L - 3, fb + 30, 90, 14, 'audiokey') : '') }
  return s
}

/* ── each frame: the two bars of every strip shown, as loud as each side, falling back on their own ── */
{ const meters0 = drawMeters
  drawMeters = function () {
    meters0.apply(this, arguments)
    if (SKIN.k.mixer !== 'panel' || !MPX.geo.size || typeof METERS !== 'object' || VIEW.p <= .5) { if (typeof METERS === 'object' && METERS.ts && METERS.ts.size) METERS.ts.clear(); return }      // (nothing shown: what was heard meanwhile is not kept for later)
    const fall = .87, ts = METERS.ts
    const one = (key, l, r) => {
      const g = MPX.geo.get(key); if (!g) return
      const was = MPX.lv.get(key) || [0, 0, 0, 0], now = [Math.max(l, was[0] * fall), Math.max(r, was[1] * fall)]
      const f = v => volF(Math.min(6, linDb(v))), hold = [Math.max(f(now[0]), was[2] - .008), Math.max(f(now[1]), was[3] - .008)]
      MPX.lv.set(key, [now[0] < 1e-4 ? 0 : now[0], now[1] < 1e-4 ? 0 : now[1], hold[0], hold[1]])
      for (let c = 0; c < 2; c++) {
        const b = $(`mpm-${key}-${c}`), hk = $(`mph-${key}-${c}`), fh = (g.fb - g.ft) * f(now[c])
        if (b) { b.setAttribute('y', n(g.fb - fh)); b.setAttribute('height', n(fh)); if (now[c] > 1) b.setAttribute('fill', REC) }
        if (hk) { hk.setAttribute('y', n(g.fb - (g.fb - g.ft) * hold[c] - 1)); hk.setAttribute('fill-opacity', hold[c] > .005 ? '.75' : '0') }
      }
    }
    for (const [key] of MPX.geo) {
      if (key === 'M') { one('M', METERS.mm[0] || 0, METERS.mm[1] || 0); continue }
      const two = ts && ts.get(key), mono = METERS.now.get(key) || 0
      one(key, two ? two[0] : mono, two ? two[1] : mono)
    }
    if (ts) ts.clear()                                                                     // (read by every meter of this frame — the inspector's too: then let go)
  } }
/* a number in the row along the top pressed: that track chosen, and brought into sight */
{ const down0 = onDown
  onDown = function (e) {
    const el = e && e.target && e.target.closest ? e.target.closest('[data-a="mp-jump"]') : null
    if (el && e.button === 0) { const i = +el.dataset.i; if (typeof chooseTrack === 'function') chooseTrack(i, e.shiftKey ? 'range' : e.metaKey ? 'toggle' : ''); showRow(i); uiDirty('head', 'lanes', 'dock', 'top'); return }
    return down0.apply(this, arguments)
  } }
/* a send's knob: pulled up (or right) it sends more, as the room's knobs go — by how far the hand goes, never thrown;
   pressed and let go, it asks where it goes; pressed with the right, the same */
{ const down0 = onDown
  onDown = function (e) {
    const el = e && e.target && e.target.closest ? e.target.closest('[data-a="mp-send"]') : null
    if (el && e.button === 0) {
      const i = +el.dataset.i, k = +el.dataset.k, t = S.tracks[i], sd = t && (t.sends || [])[k], p = pt(e)
      if (sd) { drag = { a: 'msend', i, k, rel: true, f0: volF(sd.db), px: p.x, py: p.y, x0: p.x, y0: p.y, w: 1, lx: p.x, moved: false, f: null }; uiDirty('dock') }
      return
    }
    return down0.apply(this, arguments)
  } }
{ const ctx0 = onContext
  onContext = function (e) {
    const el = e && e.target && e.target.closest ? e.target.closest('[data-a="mp-send"]') : null
    if (el && e.button === 2) { e.preventDefault(); const p = pt(e), t = S.tracks[+el.dataset.i]; if (t) openSendMenu(t, +el.dataset.k, p.x, p.y); return }      // (a press with control is a press — turned, finely: ui.js pt — not the right button)
    return ctx0.apply(this, arguments)
  } }
