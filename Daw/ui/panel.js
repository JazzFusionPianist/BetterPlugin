/* ── the transport panel: the room's top rows as a column down the left ──
   His pick of design/transport panel draft 8 (2026-10-21, "이걸로 적용하자"), for the room as it comes (a theme with a
   transport of its own keeps its own): the control bar and the tracks' bar taken into one column and set by how much each
   matters, on two columns and one right edge, the room between its groups the same all the way down —
     play a large triangle, stop a square, record a ring (the one the room is in filled), to the start small beside them;
     the bar the song is in very large, beat . division . tick at its foot, the time as SMPTE under it;
     the measure a square (its beats in it, the one sounding filled) beside the tempo, large in a ring of ticks with a dot
       going round once a bar;
     the cycle a triangle (yellow, filled when on) beside the key, click and low latency;
     the song a diagonal through the column, its parts ticks on it, the cycle a yellow length, the playhead a dot — and
       the out a large ring on it, filled as loud as the mix, the fader a white square on the ring, a light that fills red
       once the mix has clipped (pressed: the hold let go), the loudest peak beside it;
     how many tracks, large, a key for a new one, what is chosen (its colour and shape: the look's card), a region's gain
       and transpose; at the foot in small capitals the tool, the mode, the grid, the nudge, automation, rubato, the zooms.
   H shows or hides it (View > Transport Panel); hidden, nothing stands in its place (since 2026-10-21: the bars at the
   top are gone) and the song has all the room. The app remembers which; it begins with it up. No name of the song or of
   the program in it (his rule). Read after skins.js, ui.js, inspector.js and selftest.js. */
const TPANEL = { on: (() => { try { const v = localStorage.getItem('slur.tpanel'); return v == null ? !!NAT : v !== '0' } catch (e) { return !!NAT } })() }      // (the app begins with it; a bare page in a browser — the tests' — without it, unless they ask)
const TPX = { CW: 248, pk: -100, clip: false, was: false, geo: null }
SKIN_BANDS.panel = [0, 0, TPX.CW]; SKIN_BANDS.none = [0, 0, 0]
SKIN_NO_TOOL.add('panel'); SKIN_NO_TOOL.add('none')
/* the room's transport is the panel; hidden, nothing stands in its place — the control bar and the tracks' bar at the top are
   gone (his word, 2026-10-21: "transport를 닫았을 때 … 화면 상단 … 이제 필요없지 않나"): the song has all the room */
{ const read0 = skinRead
  skinRead = function () {
    read0(); if (SKIN.k.transport === 'plain') { SKIN.k.transport = TPANEL.on ? 'panel' : 'none'; SKIN.noTool = true }
    SIDE = (typeof SKIN_OWN_STRIP === 'object' ? SKIN_OWN_STRIP.has(SKIN.k.transport) : SKIN.k.transport === 'panel') ? 0 : 222                                         // (the chosen track's strip is the panel's: the patch keeps none at its right — ui.js)
  } }
function tpanelSet (on, keep = true) {
  TPANEL.on = !!on
  if (keep) try { localStorage.setItem('slur.tpanel', TPANEL.on ? '1' : '0') } catch (e) {}
  if (typeof S.menu === 'object' && S.menu) S.menu = null
  setView(true); dirtyAll()
  if (typeof menusTick === 'function') menusTick()
}
const toggleTransportPanel = () => tpanelSet(!TPANEL.on)
KEYS.KeyH = () => toggleTransportPanel()
/* the app's own check runs on the room as it comes: the panel up */
{ const run0 = runSelfTest
  runSelfTest = async function (mode) { tpanelSet(true, false); return run0(mode) } }

/* ── drawing ── */
const tpNum = ' style="font-variant-numeric: tabular-nums"'
const tpCap = (x, y, w, o = {}) => T(x, y, w, Object.assign({ size: 7.5, a: .38 }, o))
const tpCaps = (x, y, w, o = {}) => T(x, y, String(w), Object.assign({ size: 7.5, w: 600, a: .45, x: ' letter-spacing=".4"' }, o))      // (small words in small letters: his rule, 2026-10-21 — capitals only for what one names oneself)
/* a shape at rest in a hairline; on, filled */
const tpTri = (cx, cy, w, h, on, c, up) => {
  const d = up ? `M${n(cx)} ${n(cy - h / 2)}L${n(cx + w / 2)} ${n(cy + h / 2)}L${n(cx - w / 2)} ${n(cy + h / 2)}Z` : `M${n(cx - w / 2)} ${n(cy - h / 2)}L${n(cx + w / 2)} ${n(cy)}L${n(cx - w / 2)} ${n(cy + h / 2)}Z`
  return P(d, on ? { fill: c || INK } : { stroke: c || INK, sa: .8, sw: 1, x: ' stroke-linejoin="round"' })
}
const tpSq = (cx, cy, k, on, c) => on ? R(cx - k / 2, cy - k / 2, k, k, { fill: c || INK }) : R(cx - k / 2 + .5, cy - k / 2 + .5, k - 1, k - 1, { stroke: c || INK, sa: .8, sw: 1 })
const tpDisc = (cx, cy, r, on, c) => on ? Cc(cx, cy, r, { fill: c || INK }) : Cc(cx, cy, r - .5, { stroke: c || INK, sa: .8, sw: 1 })
const tpChev = (x, y) => P(`M${n(x)} ${n(y - 1.5)}l2.6 2.6 2.6 -2.6`, { stroke: INK, sa: .5, sw: .9 })
/* the out's ring: where a level stands on it */
const tpRing = (g, v, rr) => { const a = .75 * Math.PI + 1.5 * Math.PI * clamp(v, 0, 1); return [g.cx + Math.cos(a) * rr, g.cy + Math.sin(a) * rr] }
const tpArc = (g, v0, v1, rr) => { if (v1 - v0 < 1e-4) return ''; const [x0, y0] = tpRing(g, v0, rr), [x1, y1] = tpRing(g, v1, rr); return `M${n(x0)} ${n(y0)}A${rr} ${rr} 0 ${(v1 - v0) * 1.5 * Math.PI > Math.PI ? 1 : 0} 1 ${n(x1)} ${n(y1)}` }
/* the song along its line: the line shows on both sides of the ring, and the song runs on past it */
const tpAt = (g, b) => { let d = g.shown * clamp(b, 0, SONG_END) / Math.max(1e-9, SONG_END); if (d > g.mid - g.hole) d += 2 * g.hole; return [g.L0[0] + (g.L1[0] - g.L0[0]) * d / g.len, g.L0[1] + (g.L1[1] - g.L0[1]) * d / g.len] }

SKINS.left.panel = () => {
  const CW = TPX.CW, o = -CW, p = curPos(), small = H < 820, z = small ? .8 : 1, GL = 16, GR = 132, RE = CW - 16
  const fld = (x, y, w, h) => ({ x: o + x, y, w, h })                                    // (a word's place in the room: typed over, its list under it)
  const geo = TPX.geo = {}
  TPX.fixed = ''
  let s = R(0, 0, CW, H, { fill: K2 }) + R(CW - 1, 0, 1, H, { fill: INK, fa: .1 })
  /* the groups' heights; the room between them the same */
  const playH = 72 * z, bs0 = small ? 84 : 112, posH = bs0 * .72 + 24, timeH = Math.max(46 * z + 12, 92 * z + 6), cycH = 47 * z + 14, ring = small ? 50 : 62, outH = 2 * ring + 40
  /* the foot's rows apart, its height (a short window has them closer, and lets the strip have the room it would lose to the
     row of a region's values), and how far the large count of tracks reaches above it */
  const fs = small ? 26 : 28, ft = small ? 28 : 30, foot = ft + 3 * fs + 26, lift = small ? 30 : 36
  /* the chosen track's strip stands over the foot (lift: the large count of tracks reaches that far above it); the groups'
     gaps give it room, and a short window has it on one line */
  const room0 = H - FOOT_H - 24 - foot - lift - (playH + posH + timeH + cycH + outH), stripH = room0 - 6 * 10 >= 92 ? Math.min(124, room0 - 6 * 10) : 50
  const gap = clamp((room0 - stripH) / 6, small ? 5 : 6, 40), below = clamp(gap * .6, 8, 22)
  let y = 24
  /* play | stop, record, to the start */
  const playing = S.playing && !S.rec, stopped = !S.playing && !S.rec, pw = 62 * z
  s += tpTri(GL + pw / 2, y + playH / 2, pw, playH, playing) + hit(GL - 4, y - 4, pw + 8, playH + 8, 'play')
  const sq = 30 * z, rr = 14.5 * z
  s += tpSq(GR + sq / 2, y + sq / 2, sq, stopped) + hit(GR - 4, y - 4, sq + 8, sq + 8, 'stop')
  s += tpDisc(GR + rr, y + playH - rr, rr, !!S.rec, REC) + hit(GR - 4, y + playH - 2 * rr - 4, 2 * rr + 8, 2 * rr + 8, 'rec')
  const sx = GR + 2 * rr + 18, sy = y + playH - rr
  s += R(sx, sy - 5, 1.2, 10, { fill: INK, fa: .7 }) + P(`M${n(sx + 10)} ${n(sy - 5)}L${n(sx + 2.5)} ${n(sy)}L${n(sx + 10)} ${n(sy + 5)}Z`, { stroke: INK, sa: .7, sw: .9, x: ' stroke-linejoin="round"' }) + tpCap(sx + 15, sy + 3, 'start', { a: .45 }) + hit(sx - 4, sy - 10, 54, 20, 'tostart')
  y += playH + gap
  /* where the song is: the bar very large, the rest at its foot, the time under it */
  { const pl = place(p).split('.'), bar = pl[0], bs = (() => { const fix = v => String(v).replace(/\d/g, '0'), tail = twTab(fix('.' + pl[1] + '.' + pl[2]), 17, 500) + 4 + twTab(fix('.' + pl[3]), 12) + 8, room = RE + 6 - (GL - 3); let k = bs0; while (k > 36 && twTab(fix(bar), k, 500) - 5 * bar.length + tail > room) k -= 2; return k })(), by = y + bs0 * .72
    /* (the bar as large as fits, beat . division . tick and all, inside the column: at three figures they ran past its edge — his word, 2026-10-22) */
    geo.bar = { x: GL - 3, y: by, bs }
    s += T(GL - 3, by, bar, { size: bs, w: 500, x: tpNum + ' letter-spacing="-5" id="tp-bar"' })
    const fig = v => String(v).replace(/\d/g, '0')                                        // (figures all as wide: measured as they are drawn)
    const rx = GL - 3 + tw(fig(bar), bs, 500) - 5 * (bar.length - 1) + 8, rest = '.' + pl[1] + '.' + pl[2]
    s += T(rx, by, rest, { size: 17, w: 500, a: .9, x: tpNum + ' id="tp-rest"' }) + T(rx + tw(fig(rest), 17, 500) + 4, by, '.' + pl[3], { size: 12, a: .55, x: tpNum + ' id="tp-tick"' })
    s += hit(GL - 4, by - bs * .74, RE - GL + 4, bs * .74 + 6, 'pos')
    SKV.field.pos = fld(GL, by - 30, 150, 30)
    const tc = smpte(p)
    s += T(GL, by + 24, tc, { size: 10, a: .7, x: tpNum + ' id="tp-smpte"' }) + tpCap(GL + twTab(tc, 10) + 8, by + 24, smpteRate().t + ' fps', { a: .32 }) + hit(GL - 4, by + 12, 150, 16, 'smpte')
    SKV.field.smpte = fld(GL - 2, by + 10, 96, 18)
    y = by + 24 + gap }
  /* the measure | the tempo, their tops on one line */
  { const ms = 46 * z, mt = y, ph = p - Math.floor(p), nb = BEATS(), bi = Math.floor(ph * nb + 1e-9)
    s += R(GL + .5, mt + .5, ms - 1, ms - 1, { stroke: INK, sa: .75, sw: 1 }) + T(GL + ms / 2, mt + ms / 2 + 3, meterName(), { size: 13 * z, w: 500, anchor: 'middle', x: tpNum }) + hit(GL - 4, mt - 4, ms + 8, ms + 8, 'meter')
    SKV.field.meter = fld(GL, mt, ms, ms)
    geo.beats = []
    for (let k = 0; k < nb; k++) { geo.beats.push(k); s += R(GL + k * 7 + .3, mt + ms + 6.3, 3.9, 3.9, { fill: k === bi ? INK : 'none', stroke: INK, sa: k === bi ? 0 : .4, sw: .6, x: ` id="tp-beat-${k}"` }) }
    const r = Math.min(46 * z, (RE - GR) / 2 - 4), tx = GR + r, cy = mt + r
    for (let k = 0; k < 48; k++) { const a = k / 48 * 2 * Math.PI - Math.PI / 2, l = k % 12 ? 2.4 : 6; s += P(`M${n(tx + Math.cos(a) * r)} ${n(cy + Math.sin(a) * r)}L${n(tx + Math.cos(a) * (r - l))} ${n(cy + Math.sin(a) * (r - l))}`, { stroke: INK, sa: k % 12 ? .25 : .55, sw: .8 }) }
    geo.dial = { tx, cy, r: r + 4 }
    { const a = ph * 2 * Math.PI - Math.PI / 2; s += Cc(tx + Math.cos(a) * (r + 4), cy + Math.sin(a) * (r + 4), 2.2, { fill: INK, x: ' id="tp-dial"' }) }
    /* the tempo and its hundredths side by side, inside the ring: a tempo of three figures set smaller (his ask, 2026-10-21) */
    const big = String(Math.floor(S.tempo)), dec = '.' + (+S.tempo).toFixed(2).split('.')[1], room = 2 * r - 16
    let bs = 34 * z; while (bs > 16 && twTab(big, bs, 500) + 2 + twTab(dec, 10) > room) bs -= 1
    const bw = twTab(big, bs, 500), x0 = tx - (bw + 2 + twTab(dec, 10)) / 2
    s += T(x0, cy + 11 * z, big, { size: bs, w: 500, x: tpNum }) + T(x0 + bw + 2, cy + 11 * z, dec, { size: 10, a: .55, x: tpNum }) + tpCaps(tx, cy + 25 * z, 'bpm', { anchor: 'middle', a: .4 }) + hit(tx - r, cy - r, 2 * r, 2 * r, 'tempo')
    SKV.field.tempo = fld(tx - 34, cy - 14, 68, 24)
    y = mt + Math.max(ms + 12, 2 * r + 6) + gap }
  /* the cycle | the key, click, low latency */
  { const w = 54 * z, h = 47 * z, ct = y, c = S.cycle
    s += tpTri(GL + w / 2, ct + h / 2, w, h, c.on, SOLO, true) + hit(GL - 4, ct - 4, w + 8, h + 8, 'loop')
    s += tpCap(GL, ct + h + 14, c.on ? `cycle ${Math.round(c.a + 1)} to ${Math.round(c.b + 1)}` : 'cycle off', { a: .5, x: tpNum }) + hit(GL - 4, ct + h + 3, 100, 15, 'loop')
    s += tpCaps(GR, ct + 6, 'key') + T(GR + 22, ct + 6.5, S.key || '—', { size: 8.5, a: S.key ? .85 : .5 }) + hit(GR - 4, ct - 5, 90, 15, 'key')
    SKV.field.key = fld(GR + 18, ct - 6, 70, 16)
    const bul = (yy, on, word, a, col) => (on ? Cc(GR + 3, yy - 2.6, 3, { fill: col || INK }) : Cc(GR + 3, yy - 2.6, 2.6, { stroke: INK, sa: .55, sw: .8 })) + T(GR + 11, yy, word, { size: 8.5, a: on ? .85 : .45 }) + hit(GR - 4, yy - 11, tw(word, 8.5) + 20, 15, a)
    s += bul(ct + 24, !!S.click, 'click', 'click') + bul(ct + 40, !!S.lowLat, 'low latency', 'lowlat', MON)
    y = ct + h + 14 + gap }
  /* the song a diagonal; the out a large ring on it */
  const f0 = H - FOOT_H - foot
  { const r = ring, cx = CW / 2, cy = y + 20 + r, k = 1.05, top = y - gap / 2, bottom = f0 - lift - below - stripH - 10
    const A1 = cy - cx * k, t0 = Math.max(0, (top - A1) / k), t1 = Math.min(CW, (bottom - A1) / k)
    const L0 = [t0, A1 + t0 * k], L1 = [t1, A1 + t1 * k], len = Math.hypot(L1[0] - L0[0], L1[1] - L0[1]), hole = r + 22
    const g = geo.song = { L0, L1, len, hole, mid: Math.hypot(cx - L0[0], cy - L0[1]), shown: Math.max(1, len - 2 * hole) }
    const ang = Math.atan2(L1[1] - L0[1], L1[0] - L0[0]); g.nx = -Math.sin(ang); g.ny = Math.cos(ang)
    s += P(`M${n(L0[0])} ${n(L0[1])}L${n(L1[0])} ${n(L1[1])}`, { stroke: INK, sa: .35, sw: 1 })
    const og = geo.out = { cx, cy, r }
    s += Cc(cx, cy, r + 6, { fill: K2 }) + P(tpArc(og, 0, 1, r), { stroke: INK, sa: .1, sw: 11 }) + P('', { stroke: LEVEL, sa: .92, sw: 11, x: ' id="tp-lvl-l"' }) + P(tpArc(og, 0, 1, r - 11), { stroke: INK, sa: .06, sw: 4 }) + P('', { stroke: LEVEL, sa: .5, sw: 4, x: ' id="tp-lvl-r"' })
    for (const db of [-48, -24, -12, -6, 0, 6]) { const v = volF(db), [x0, y0] = tpRing(og, v, r + 8), [x1, y1] = tpRing(og, v, r + 12), [lx, ly] = tpRing(og, v, r + 21); s += P(`M${n(x0)} ${n(y0)}L${n(x1)} ${n(y1)}`, { stroke: INK, sa: .4, sw: .7 }) + tpCap(lx, ly + 2.5, db > 0 ? '+' + db : String(db).replace('-', '−'), { anchor: 'middle', size: 6.5, a: .38, x: tpNum }) }
    { const [fx, fy] = tpRing(og, volF(S.master), r); s += R(fx - 5, fy - 5, 10, 10, { fill: '#FFFFFF' }) }
    s += T(cx, cy + 9, fmtDb(S.master), { size: small ? 24 : 28, w: 500, anchor: 'middle', x: tpNum }) + tpCaps(cx, cy + 24, 'out', { anchor: 'middle', a: .4 }) + hit(cx - r - 8, cy - r - 8, 2 * r + 16, 2 * r + 16, 'master', '', 'ns-resize')
    s += Cc(RE - 6, cy - r - 6, 6, { stroke: REC, sa: .8, sw: 1.2, fill: TPX.clip ? REC : 'none', x: ' id="tp-clip"' }) + tpCap(RE, cy - r + 12, 'peak ' + (TPX.pk > -99 ? fmtDb(Math.round(TPX.pk * 10) / 10) : '−∞'), { a: .45, anchor: 'end', x: tpNum + ' id="tp-peak"' }) + hit(RE - 40, cy - r - 16, 44, 34, 'tp-clip')
    for (const sc of SCENES) { const [x, yy] = tpAt(g, sc.a - 1); s += P(`M${n(x - g.nx * 3)} ${n(yy - g.ny * 3)}L${n(x + g.nx * 3)} ${n(yy + g.ny * 3)}`, { stroke: INK, sa: .45, sw: .7 }) }
    if (S.cycle.on) { const seg = (a, b) => { const [x0, y0] = tpAt(g, a), [x1, y1] = tpAt(g, b); return P(`M${n(x0)} ${n(y0)}L${n(x1)} ${n(y1)}`, { stroke: SOLO, sw: 3.4, sa: .95 }) }, cut = SONG_END * (g.mid - g.hole) / g.shown
      s += S.cycle.a < cut && S.cycle.b > cut ? seg(S.cycle.a, cut - 1e-6) + seg(cut + 1e-6, S.cycle.b) : seg(S.cycle.a, S.cycle.b) }
    { const [x, yy] = tpAt(g, p); s += Cc(x, yy, 3.4, { fill: INK, x: ' id="tp-head"' }) } }
  s += tpStrip(f0 - lift - below - stripH, stripH, GL, GR, RE)
  /* the foot, on the same two columns: how many tracks | what is chosen, a new one at the right edge; then the small capitals */
  { const st = S.tracks[S.sel], rs = S.focus === 'tracks' ? [] : selRegs(), r = rs.length ? rs[0][0] : null, look = r ? regLook(r, rs[0][1]) : st ? { c: st.c } : { c: INK }, ty = f0 + 6
    const nt = S.tracks.filter(t => t.kind === 'audio').length
    s += T(GL - 2, ty, String(nt), { size: 38, w: 500, x: tpNum }) + tpCap(GL - 2 + twTab(String(nt), 38, 500) + 6, ty, nt === 1 ? 'track' : 'tracks', { a: .45 })
    s += Cc(RE - 11.5, ty - 13, 11.5, { stroke: INK, sa: .6, sw: 1 }) + P(`M${n(RE - 11.5)} ${n(ty - 19)}V${n(ty - 7)}M${n(RE - 17.5)} ${n(ty - 13)}H${n(RE - 5.5)}`, { stroke: INK, sa: .9, sw: 1.2 }) + hit(RE - 26, ty - 28, 30, 30, 'addtrack')
    if (st) {
      const many = typeof chosen === 'function' ? chosen().length : 1, nm = r ? (rs.length > 1 ? `${rs.length} regions` : asGiven(r.tag || r.name || rs[0][1].name)) : many > 1 ? `${many} tracks` : asGiven(st.name)      // (several chosen: how many, as the tracks' bar said)
      s += R(GR, ty - 16, 7, 7, { fill: look.c }) + T(GR + 11, ty - 9.5, fit(nm, 56, 8.5), { size: 8.5, a: .8 }) + hit(GR - 3, ty - 20, 74, 14, 'look')
      SKV.field.look = { x: o + GR, y: ty - 20, w: 74, h: 14 }
      /* what the tracks' bar said of what is chosen, here now (the bar is gone): a crossfade's length and curve; in rubato
         how its track is stretched, and quantize; else a region's fades and their curve, its tempo (its gain, transpose
         and fine tune have a row of their own, under) */
      const line = (y, items) => { let xx = GR; for (const [word, act, cur] of items) { if (!word) continue; const ww = tw(word, 7.5); if (xx + ww > RE + 2) break; s += tpCap(xx, y, word, { a: act ? .62 : .4, x: tpNum }) + (act ? hit(xx - 2, y - 9, ww + 4, 12, act, '', cur || 'pointer') : ''); xx += ww + 7 } }
      const X = typeof DRAFT === 'object' && DRAFT.fades && S.selX ? [regOf(S.selX[0])[0], regOf(S.selX[1])[0]] : null, xf = X && X[0] && X[1] && typeof xfadeOf === 'function' ? xfadeOf(X[0], X[1]) : 0
      if (xf) { line(ty, [[`crossfade ${fadeLen(xf)}`]]); line(ty + 11, [[FADE_CURVES[X[0].foc || 0] + ' ▾', 'fcurve']]) }
      else if (r && S.flex) { line(ty, [!r.loop && !r.notes && typeof stretchOf === 'function' ? [`stretch ${stretchOf(rs[0][1])} ▾`, 'rstretch'] : null].filter(Boolean)); line(ty + 11, [['quantize', 'qgo'], [qName(S.q) + ' ▾', 'qval']]) }
      else if (r) {
        const fades = (r.fi || 0) > 0 || (r.fo || 0) > 0
        line(ty, [[`fades ${+(r.fi || 0).toFixed(2)} ${+(r.fo || 0).toFixed(2)}`], fades ? [FADE_CURVES[(r.fi > 0 ? r.fic : r.foc) || 0] + ' ▾', 'fcurve'] : ['', null], !r.loop && r.bpm > 0 ? [`${+r.bpm.toFixed(1)} bpm`, 'rbpm'] : ['', null]])
      }
      else s += tpCap(GR, ty, 'track', { a: .3 })
    } }
  const pick = (x, yy, label, v, a) => { const w = tw(v, 9.5); SKV.field[a] = fld(x - 2, yy + 1, Math.max(56, w + 14), 14); return tpCaps(x, yy, label) + T(x, yy + 12, v, { size: 9.5, a: .85, x: tpNum }) + tpChev(x + w + 4, yy + 8.5) + hit(x - 3, yy - 8, w + 16, 24, a) }
  /* the chosen region's gain, transpose and fine tune, a row across the column, its values as large as the tool's and the
     mode's (his pick of design/region values draft 1, 2026-10-23, the values made that size); pulled up or down; with no
     region chosen a dash, the row kept (the panel does not move when one is pressed) */
  { const rs = S.focus === 'tracks' ? [] : selRegs(), r = rs.length ? rs[0][0] : null, sg = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v || 0), yr = f0 + ft
    const notes = r && (r.notes || rs[0][1].midi), cols = [['gain', r ? fmtDb(r.gain || 0) + ' dB' : '—', 'rgain'], ['transpose', r ? sg(r.tr) : '—', 'rtr'], ['fine tune', r && !notes ? sg(r.ft) + ' ct' : '—', notes ? null : 'rft']]
    cols.forEach(([k, v, a], i) => { const x = GL + i * 76; s += tpCaps(x, yr, k, { a: r ? .45 : .3 }) + T(x, yr + 12, v, { size: 9.5, a: r ? .85 : .3, x: tpNum }) + (r && a ? hit(x - 3, yr - 8, 70, 24, a, '', 'ns-resize') : '') }) }
  const r1 = f0 + ft + fs
  s += pick(GL, r1, 'tool', toolWord(S.tool), 'toolmenu') + pick(GR, r1, 'mode', S.mode, 'modemenu') + pick(GL, r1 + fs, 'grid', gridName(), 'grid') + pick(GR, r1 + fs, 'nudge', S.nudge, 'nudge')
  const box = (x, yy, on, word, a) => (on ? R(x, yy - 7, 7, 7, { fill: INK }) : R(x + .4, yy - 6.6, 6.2, 6.2, { stroke: INK, sa: .55, sw: .8 })) + T(x + 11, yy, word, { size: 8.5, a: on ? .85 : .45 }) + hit(x - 3, yy - 10, tw(word, 8.5) + 18, 14, a)
  const rb = r1 + 2 * fs + 2
  s += box(GL, rb, !!S.auto, 'automation', 'autokey') + box(GR, rb, !!S.flex, 'rubato', 'flexkey')
  const sl = (x, w, f, label, a) => tpCaps(x, rb + 14, label) + R(x, rb + 22, w, .6, { fill: INK, fa: .28 }) + R(x + w * f - 2.6, rb + 22 - 2.3, 5.2, 5.2, { fill: '#FFFFFF' }) + hit(x - 5, rb + 14, w + 10, 16, a, ` data-x0="${n(o + x)}" data-w="${n(w)}"`, 'ew-resize')
  s += sl(GL, GR - GL - 16, zoomF(), 'zoom across', 'zoomx') + sl(GR, RE - GR, clamp(((S.rh || 25) - 20) / 100, 0, 1), 'zoom down', 'zoomy')
  return G(G(s, '', ' id="tp-col"'), `translate(${o} 0)`)
}

/* ── the chosen track's strip, between the out and the foot: his pick of design/transport strip draft 1 (2026-10-21,
   "1번 시안 좋아"). Its level short — two bars as loud as each side, the fader's line, the white square — its level large
   beside them and its loudest peak under it (a light that fills red once it has clipped: pressed, let go); on the second
   column its plug-ins, a list of names (+ plug-in), and its sends, round knobs with the bus each goes to under it (how much
   while the pointer is on it or it is turned), a + for one more. A short window has it on one line. It stands for the
   strips the patch had at its right, gone the same day. ── */
const TPS = { key: null, lv: [0, 0], pk: -100, clip: false, was: false }
function tpStrip (top, h, GL, GR, RE) {
  const t = S.tracks[S.sel]
  TPX.sg = null
  if (!t || h < 30) return ''
  if (TPS.key !== t.id) { TPS.key = t.id; TPS.lv = [0, 0]; TPS.pk = -100; TPS.clip = false }
  const i = S.sel, di = ` data-i="${i}"`, vol = shown(t, 'vol'), heardT = heard(t), stack = t.kind === 'stack', short = h < 80
  let s = '', hits = ''
  const lvF = k => volF(Math.min(6, linDb(TPS.lv[k])))                                     // (drawn again, the bars stand where the meters had them)
  const peak = (x, y) => Cc(x + 3.4, y - 2.6, 3.4, { stroke: REC, sa: .8, sw: 1, fill: TPS.clip ? REC : 'none', x: ' id="tps-clip"' }) + tpCap(x + 11, y, 'peak ' + (TPS.pk > -99 ? fmtDb(Math.round(TPS.pk * 10) / 10) : '−∞'), { a: .5, x: tpNum + ' id="tps-peak"' })
  /* a send's knob, the bus under it (how much while the pointer is on it, or it is turned: mixpanel.js's rule) */
  const knob = (k, sd, cx, cy, r, size, room) => {
    const b = byId(sd.to), db = mpSendDb(t, k, sd), pulling = drag && drag.a === 'msend' && drag.moved && drag.i === i && drag.k === k
    const bus = fit(b ? asGiven(b.name) : 'send', room, size, 500), much = (db <= -47.5 ? '−∞' : (pulling ? db.toFixed(1) : String(Math.round(db))).replace('-', '−')) + ' db'
    return `<g class="mpk${pulling ? ' on' : ''}">` + mpSendKnob(cx, cy, r, volF(db), t.c, b ? b.name : 'send') + T(cx, cy + r + 9.5, bus, { size, w: 500, a: .6, anchor: 'middle', x: ' class="mpk-bus"' }) + T(cx, cy + r + 9.5, much, { size, anchor: 'middle', x: tpNum + ' class="mpk-db"' })
      + hit(cx - r - 3, cy - r - 3, 2 * r + 6, 2 * r + 14, 'mp-send', `${di} data-k="${k}"`, 'ns-resize') + '</g>'
  }
  const plusKnob = (cx, cy, r, word) => Cc(cx, cy, r - .5, { stroke: INK, sa: .3, sw: .9, dash: '2 2' }) + P(`M${n(cx)} ${n(cy - r / 2.6)}V${n(cy + r / 2.6)}M${n(cx - r / 2.6)} ${n(cy)}H${n(cx + r / 2.6)}`, { stroke: INK, sa: .6, sw: 1 }) + (word ? T(cx, cy + r + 9.5, word, { size: 7.5, a: .35, anchor: 'middle' }) : '') + hit(cx - r - 3, cy - r - 3, 2 * r + 6, 2 * r + 14, 'msendadd', di)
  /* its sends in a row on the second column: three knobs, then a + (or how many more, which opens the mixer) */
  const sendRow = (cy, r, size, step) => {
    if (stack) return ''
    const sends = t.sends || [], shown3 = sends.slice(0, sends.length > 4 ? 3 : 4)
    let q = ''
    shown3.forEach((sd, k) => { q += knob(k, sd, GR + r + k * step, cy, r, size, step - 2) })
    const k = shown3.length, cx = GR + r + k * step
    if (sends.length > shown3.length) q += T(cx, cy + 3, `+${sends.length - k}`, { size: 8.5, a: .55, anchor: 'middle', x: tpNum }) + hit(cx - r, cy - r, 2 * r, 2 * r, 'tab-mixer')
    else if (k < 4 && sends.length < MP_SENDS) q += plusKnob(cx, cy, r, short ? '' : 'send')
    return q
  }
  const fxLine = (it, k, y) => R(GR, y - 6.5, 6.5, 6.5, { fill: it.c || MP_PRINT_C()[it.k] || t.c, fa: it.off ? .4 : 1 })
  if (short) {
    /* on one line: its level two bars across with the fader's line under them, its level and peak under that; its plug-ins
       one line (the first named, how many more), its sends small knobs */
    const w = GR - GL - 16, y0 = top + 3, ly = top + 20, hx = GL + w * volF(vol)
    for (let k = 0; k < 2; k++) s += R(GL, y0 + k * 6, w, 4, { fill: INK, fa: .06 }) + R(GL, y0 + k * 6, w * lvF(k), 4, { fill: t.c, fa: heardT ? .95 : .4, x: ` id="tps-m-${k}"` })
    TPX.sg = { across: true, x: GL, w, ft: y0, fb: y0 + 10 }
    s += R(GL, ly - .6, w, 1.2, { fill: INK, fa: .85 }) + R(hx - 5, ly - 5, 10, 10, { fill: '#FFFFFF', fa: heardT ? 1 : .5 })
    hits += hit(GL - 4, top - 2, w + 8, 30, 'tps-vol', di, 'ew-resize')
    s += T(GL, top + 45, fmtDb(vol), { size: 17, w: 500, a: heardT ? 1 : .5, x: tpNum }) + peak(GL + 50, top + 43)
    hits += hit(GL - 2, top + 30, 46, 20, 'tps-volnum', di, 'text') + hit(GL + 47, top + 32, 60, 16, 'tps-clip')
    if (!stack) {
      const items = fxItems(t), it = items[0]
      if (t.theirs) { s += T(GR, top + 9.5, 'patch →', { size: 8.5, a: .45 }); hits += hit(GR - 3, top, 70, 14, 'm-patch', di) }
      else {
        if (it) { s += fxLine(it, 0, top + 9.5) + T(GR + 11, top + 9.5, fit(asGiven(it.t), 62, 8.5), { size: 8.5, a: it.off ? .4 : .85 }); hits += hit(GR - 3, top, 74, 14, 'mfx', `${di} data-k="0"`) }
        if (items.length > 1) { s += T(GR + 78, top + 9.5, `+${items.length - 1}`, { size: 8.5, a: .55, x: tpNum }); hits += hit(GR + 74, top, 18, 14, 'm-patch', di) }
        s += mpPlus(RE - 5, top + 6); hits += hit(RE - 12, top - 1, 14, 14, 'mfxadd', di)
      }
      s += sendRow(top + 28, 7, 7, 24)
    }
    return s + hits
  }
  /* its level: two short bars of its colour, the fader's line, the white square */
  const ft = top + 4, fb = top + h - 4, yOf = db => fb - (fb - ft) * volF(db), fy = yOf(vol), bw = 5, lx = GL + 2 * bw + 2 + 14
  for (let k = 0; k < 2; k++) { const x = GL + k * (bw + 2); s += R(x, ft, bw, fb - ft, { fill: INK, fa: .06 }) + R(x, fb - (fb - ft) * lvF(k), bw, (fb - ft) * lvF(k), { fill: t.c, fa: heardT ? .95 : .4, x: ` id="tps-m-${k}"` }) }
  TPX.sg = { across: false, x: GL, ft, fb }
  for (const db of DBS) s += R(lx - 5, yOf(db) - .3, db === 0 ? 3.5 : 2.5, .6, { fill: INK, fa: db === 0 ? .55 : .3 })
  s += R(lx - .6, ft, 1.2, fb - ft, { fill: INK, fa: .85 }) + R(lx - 5, fy - 5, 10, 10, { fill: '#FFFFFF', fa: heardT ? 1 : .5 })
  hits += hit(GL - 4, ft - 6, lx + 10 - GL, fb - ft + 12, 'tps-vol', di, 'ns-resize')
  /* its level large, the loudest peak under it */
  const vx = lx + 16
  s += T(vx, ft + 20, fmtDb(vol), { size: 24, w: 500, a: heardT ? 1 : .5, x: tpNum }) + tpCaps(vx + 1, ft + 33, 'level', { a: .4 }) + peak(vx + 1, ft + 54.5)
  hits += hit(vx - 2, ft - 2, 76, 26, 'tps-volnum', di, 'text') + hit(vx - 2, ft + 42, 72, 16, 'tps-clip')
  /* where its sound comes from (the patch's strips had it; gone with them, so here): pressed, the inputs */
  const vc = vx + 31, vr = GR - 8 - vc                                                  // (in and group: their values in one column, kept out of the plug-ins' column beside them — his word, 2026-10-22: they ran into it)
  if (t.kind === 'audio' && !t.theirs && !t.inst && fb - ft >= 84) { const word = fit(inputName(t.inp || 0).replace(/^input /, '').replace(' and ', '–'), vr - 10, 8.5), ww = tw(word, 8.5)      // (input 3 and 4 said 3–4)
    s += tpCaps(vx + 1, ft + 76, 'in', { a: .4 }) + T(vc, ft + 76, word, { size: 8.5, a: .8, x: tpNum }) + tpChev(vc + 4 + ww, ft + 72.5); hits += hit(vx - 2, ft + 65, vc - vx + ww + 14, 15, 'min', di) }
  /* its group (groups.js: pressed twice, named here; the other button, what it shares — his ask, 2026-10-22) */
  if (t.grp && typeof grpMeta === 'function' && fb - ft >= 100) { const m = grpMeta(t.grp), off = S.grpOff || !m.on, gy = ft + 92, gn = fit(asGiven(m.name), vr - 10, 8.5)
    s += tpCaps(vx + 1, gy, 'group', { a: .4 }) + T(vc, gy, gn, { size: 8.5, a: off ? .4 : .8 }) + Cc(vc + tw(gn, 8.5) + 6, gy - 3, 2.6, { fill: grpColour(t.grp), fa: off ? .35 : 1 })      // (its name in the in's column, its colour after it as the in's chevron is)
    hits += hit(vx - 2, gy - 11, vc - vx + 16 + tw(gn, 8.5), 15, 'mgrp', `${di} data-x="${n(vc - 3)}" data-y="${n(gy - 11)}" data-w="80" data-h="13"`) }
  if (stack) return s + hits
  /* its plug-ins, a list of names; its sends, round knobs with the bus under each */
  const r = 8, rows = Math.max(1, Math.floor((h - 2 * r - 44) / 13) - 1)
  let ly = ft + 8
  if (t.theirs) { s += T(GR, ly, 'patch →', { size: 8.5, a: .45 }); hits += hit(GR - 3, ly - 11, RE - GR + 6, 15, 'm-patch', di); ly += 13 }
  else {
    const items = fxItems(t), show = Math.min(items.length, rows)
    items.slice(0, show).forEach((it, k) => {
      if (k === show - 1 && items.length > show) { s += T(GR, ly, `+${items.length - k} more`, { size: 8.5, a: .5 }); hits += hit(GR - 3, ly - 11, RE - GR + 6, 15, 'm-patch', di) }
      else { s += fxLine(it, k, ly) + T(GR + 11, ly, fit(asGiven(it.t), RE - GR - 11, 8.5), { size: 8.5, a: it.off ? .4 : .85 }); hits += hit(GR - 3, ly - 11, RE - GR + 6, 15, 'mfx', `${di} data-k="${k}"`) }
      ly += 13
    })
    s += mpPlus(GR + 3, ly - 3) + T(GR + 11, ly, 'plug-in', { size: 8, a: .4 }); hits += hit(GR - 3, ly - 11, 70, 15, 'mfxadd', di)
  }
  s += sendRow(Math.min(ly + 14 + r, fb - r - 10), r, 7.5, 26)
  return s + hits
}
/* the strip's bars, each frame: as loud as each side, falling back on their own; its peak since the song was started */
{ const meters0 = drawMeters
  drawMeters = function () {
    meters0.apply(this, arguments)
    const g = TPX.sg, t = S.tracks[S.sel]
    if (!g || !t || t.id !== TPS.key || typeof METERS !== 'object' || !TPANEL.on) return
    const two = METERS.ts && METERS.ts.get(t.id), mono = METERS.now.get(t.id) || 0, lr = two ? [two[0], two[1]] : [mono, mono], f = v => volF(Math.min(6, linDb(v)))
    for (let c = 0; c < 2; c++) {
      TPS.lv[c] = Math.max(lr[c], TPS.lv[c] * .87); if (TPS.lv[c] < 1e-4) TPS.lv[c] = 0
      const el = $('tps-m-' + c), k = f(TPS.lv[c])
      if (!el) continue
      if (g.across) el.setAttribute('width', n(g.w * k))
      else { const fh = (g.fb - g.ft) * k; el.setAttribute('y', n(g.fb - fh)); el.setAttribute('height', n(fh)) }
    }
    if (S.playing && !TPS.was) { TPS.pk = -100; TPS.clip = false; const pe = $('tps-peak'), c = $('tps-clip'); if (pe) pe.textContent = LANG_WORDS('peak −∞'); if (c) c.setAttribute('fill', 'none') }
    TPS.was = S.playing
    const db = linDb(Math.max(lr[0], lr[1]))
    if (db > TPS.pk + .05 && db > -99) {
      TPS.pk = db; const pe = $('tps-peak'); if (pe) pe.textContent = LANG_WORDS('peak ' + fmtDb(Math.round(db * 10) / 10))
      if (db >= -.05 && !TPS.clip) { TPS.clip = true; const c = $('tps-clip'); if (c) c.setAttribute('fill', REC) }
    }
  } }
/* its fader pulled (up and down; on one line, across), its level pressed to be typed, its light pressed to let go */
{ const down0 = onDown
  onDown = function (e) {
    const el = e && e.target && e.target.closest ? e.target.closest('#tp-col [data-a^="tps-"]') : null
    if (!el || e.button !== 0) return down0.apply(this, arguments)
    e.preventDefault()
    const a = el.dataset.a, i = +el.dataset.i, tr = S.tracks[i], p = pt(e), g = TPX.sg
    if (a === 'tps-clip') { TPS.pk = -100; TPS.clip = false; uiDirty('top'); return }
    if (!tr) return
    if (a === 'tps-volnum') { startRename('vol', i, { x: +el.getAttribute('x') - TPX.CW, y: +el.getAttribute('y'), w: +el.getAttribute('width'), h: +el.getAttribute('height') }); return }      // (typed where it stands: the column's own x, counted from the room's)
    if (e.altKey) { for (const x of groupOf(i, 'volume')) if (!autoPts(x, 'vol').length) { x.vol = 0; x.ghost = null } applyAll(); uiDirty('head', 'dock', 'top'); return }      // (with option: 0 db, as every fader)
    tr.ghost = null
    const across = !!(g && g.across)
    drag = { a: across ? 'tps-volx' : 'mvol', i, ly: across ? -p.x : p.y, f0: volF(shown(tr, 'vol')), acc: 0, v0: tr.vol, others: others(i, 'vol'), g: { fh: g ? (across ? g.w : g.fb - g.ft) : 100 }, before: autoPts(tr, 'vol').length ? editState() : null }
    try { svg.setPointerCapture(e.pointerId) } catch (err) {}
  } }
{ const move0 = onMove, up0 = onUp
  onMove = function (e) {
    const r = move0.apply(this, arguments)
    if (drag && drag.a === 'tps-volx') stripVolY(drag, -pt(e).x, e)                         // (across: the hand's x read as a fader reads its y)
    if (drag && TPX.sg && (drag.a === 'mvol' || drag.a === 'tps-volx' || drag.a === 'msend')) uiDirty('top')
    return r
  }
  onUp = function (e) { const d = drag, r = up0.apply(this, arguments); if (d && d.a === 'tps-volx' && d.before) commit(d.before); return r } }
/* what the strip shows changes where the heads and the panel below change (a level, a send, a plug-in): drawn again with them */
{ const dirty0 = uiDirty
  uiDirty = function () { dirty0.apply(this, arguments); if (TPANEL.on && TPX.sg) for (const q of arguments) if (q === 'head' || q === 'dock') { dirty0('top'); break } } }

/* ── each frame: where the song is, the beat, the tempo's dot, the playhead on the song's line, the out ── */
SKINS.frame.panel = p => {
  const col = $('tp-col'), hide = (typeof START === 'object' && START.on) || !!S.sheet
  if (col && col.getAttribute('visibility') !== (hide ? 'hidden' : 'visible')) col.setAttribute('visibility', hide ? 'hidden' : 'visible')
  const g = TPX.geo
  if (!g || !g.bar) return
  const pl = place(p).split('.'), b = $('tp-bar'), rest = $('tp-rest'), tick = $('tp-tick'), sm = $('tp-smpte')
  if (b && b.textContent !== pl[0]) { if (pl[0].length !== b.textContent.length) uiDirty('top'); else b.textContent = pl[0] }
  const rs = '.' + pl[1] + '.' + pl[2]
  if (rest && rest.textContent !== rs) rest.textContent = rs
  if (tick && tick.textContent !== '.' + pl[3]) tick.textContent = '.' + pl[3]
  const tc = smpte(p); if (sm && sm.textContent !== tc) sm.textContent = tc
  /* beat . division . tick stand right after the bar as it is drawn (its width read off the page, not guessed) */
  if (b && rest && tick && b.getComputedTextLength) { const k = b.textContent + rest.textContent; if (TPX.fixed !== k) { TPX.fixed = k; const x = +b.getAttribute('x') + b.getComputedTextLength() + 5; rest.setAttribute('x', n(x)); tick.setAttribute('x', n(x + rest.getComputedTextLength() + 3)) } }
  const ph = p - Math.floor(p), bi = Math.floor(ph * BEATS() + 1e-9)
  for (const k of g.beats || []) { const el = $('tp-beat-' + k); if (el) { const on = k === bi; if ((el.getAttribute('fill') !== 'none') !== on) { el.setAttribute('fill', on ? INK : 'none'); el.setAttribute('stroke-opacity', on ? '0' : '0.4') } } }
  if (g.dial) { const el = $('tp-dial'), a = ph * 2 * Math.PI - Math.PI / 2; if (el) { el.setAttribute('cx', n(g.dial.tx + Math.cos(a) * g.dial.r)); el.setAttribute('cy', n(g.dial.cy + Math.sin(a) * g.dial.r)) } }
  if (g.song) { const el = $('tp-head'), [x, y] = tpAt(g.song, p); if (el) { el.setAttribute('cx', n(x)); el.setAttribute('cy', n(y)) } }
  if (typeof METERS !== 'object' || !g.out) return
  const f = v => volF(Math.min(6, linDb(v)))
  const l = $('tp-lvl-l'), r = $('tp-lvl-r')
  if (l) l.setAttribute('d', tpArc(g.out, 0, f(METERS.mm[0] || 0), g.out.r))
  if (r) r.setAttribute('d', tpArc(g.out, 0, f(METERS.mm[1] || 0), g.out.r - 11))
  /* the loudest peak since the song was last started; the light once it went over */
  if (S.playing && !TPX.was) { TPX.pk = -100; TPX.clip = false }
  TPX.was = S.playing
  const db = linDb(Math.max(METERS.mm[0] || 0, METERS.mm[1] || 0))
  if (db > TPX.pk + .05) {
    TPX.pk = db; const pe = $('tp-peak'); if (pe) pe.textContent = LANG_WORDS('peak ' + fmtDb(Math.round(db * 10) / 10))
    if (db >= -.05 && !TPX.clip) { TPX.clip = true; const c = $('tp-clip'); if (c) c.setAttribute('fill', REC) }
  }
}
/* a list opened from the panel (quantize, stretch, a fade's curve) stands beside where it was pressed, not where the
   tracks' bar stood */
{ const down0 = onDown
  onDown = function (e) {
    const el = e && e.target && e.target.closest ? e.target.closest('#tp-col [data-a]') : null, a = el && el.dataset.a
    if (a === 'rbpm' && e.button === 0) { startRename('rbpm', 0, { x: +el.getAttribute('x') - TPX.CW, y: +el.getAttribute('y'), w: +el.getAttribute('width'), h: +el.getAttribute('height') }); return }      // (typed where it stands: the column's own x, counted from the room's)
    const r = down0.apply(this, arguments)
    if (a && ['qval', 'rstretch', 'fcurve', 'min', 'msendadd'].includes(a) && S.menu) { const q = el.getBoundingClientRect(), b = $('board').getBoundingClientRect(), k = b.width / (W + (SKV.left || 0)); S.menu.x = (q.left - b.left) / k - (SKV.left || 0); S.menu.y = (q.bottom - b.top) / k + 3; uiDirty('menu') }
    return r
  } }
/* the light pressed: the hold let go */
{ const down0 = onDown
  onDown = function (e) {
    const el = e && e.target && e.target.closest ? e.target.closest('[data-a="tp-clip"]') : null
    if (el && e.button === 0) { TPX.pk = -100; TPX.clip = false; uiDirty('top'); return }
    return down0.apply(this, arguments)
  } }
/* what the tracks' bar said (the tool, the mode, what is chosen…) is the panel's now: when that bar would be drawn again,
   the panel is */
{ const info0 = PARTS.info
  PARTS.info = function () { if (TPANEL.on && typeof SKIN === 'object' && SKIN.k.transport === 'panel') uiDirty('top'); return info0.apply(this, arguments) } }
