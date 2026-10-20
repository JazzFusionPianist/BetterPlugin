/* ── bauhaus, draft 1: the room's top rows folded into the theme (his ask, 2026-10-21) ──
   Laid into the room by shots.mjs only (the room's own files are not changed until he says so).
   The column down the left holds the song and the hand: where it is (bar, beat, division, tick; the time; smpte), the
   transport as shapes, tempo, metre and cycle as a yellow disc, a blue square and a yellow triangle, the key, click and
   low latency as rings, the tool and the mode in large words, automation and rubato as two squares, the grid and the
   nudge, the tracks (a red disc to add one) and the zoom as two rules with a red dot each; at its foot the out, a ring as
   loud as the mix. The tool row is gone. The black band at the foot says what is chosen: the track or the region, its
   colour, and the region's gain, transpose, fine tune, fades and tempo. */
const BHD = { CW: 212 }
const bhLab = (x, y, s, o = {}) => `<text x="${n(x)}" y="${n(y)}" font-family="${FONT}" font-size="${n((o.size || 6.6) * TF.scale)}" font-weight="600" letter-spacing="${o.ls == null ? 1.5 : o.ls}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''} fill="${o.c || BH.black}"${o.a != null && o.a < 1 ? ` fill-opacity="${o.a}"` : ''}>${esc(String(s).toUpperCase())}</text>`
const bhPlace = p => { const t = typeof place === 'function' ? place(p) : readout(p), k = t.indexOf('.'); return k < 0 ? [t, ''] : [t.slice(0, k), t.slice(k)] }      // (bar, then beat, division and tick, as the room's transport says it)
const bhRule = (y, w = 3) => R(0, y, BHD.CW - 3, w, { fill: BH.black })

function bhDraftLeft () {
  const CW = BHD.CW, p = curPos(), [bar, rest] = bhPlace(p), o = -CW, L = 18
  let s = R(0, 0, CW, H, { fill: K1 }) + R(CW - 3, 0, 3, H, { fill: BH.black })
  /* where the song is */
  BHX.rest = L - 2 + tw(bar, 76, 700) + 3
  s += T(L - 2, 86, bar, { size: 76, w: 700, x: ' id="bh-bar"' }) + T(BHX.rest, 86, rest, { size: 17, w: 600, c: BH.red, x: ' id="bh-rest"' }) + hit(L - 4, 20, CW - 30, 72, 'pos')
  SKV.field.pos = { x: o + L, y: 40, w: 150, h: 40 }
  s += bhLab(L, 108, 'time') + T(L, 125, clock(p), { size: 14, w: 500, x: ' id="bh-time"' })
  s += bhLab(98, 108, `smpte ${typeof smpteRate === 'function' ? smpteRate().t : ''}`) + T(98, 125, typeof smpte === 'function' ? smpte(p) : '', { size: 14, w: 500, x: ' id="bh-smpte"' }) + hit(94, 98, CW - 100, 32, 'smpte')
  SKV.field.smpte = { x: o + 96, y: 110, w: 100, h: 20 }
  s += bhRule(140)
  /* the transport */
  const play = S.playing && !S.rec
  s += Cc(42, 182, 24, { fill: BH.red }) + (play ? R(33, 171, 6.5, 22, { fill: BH.paper }) + R(45.5, 171, 6.5, 22, { fill: BH.paper }) : P('M34 169L34 195L55 182Z', { fill: BH.paper })) + hit(16, 156, 52, 52, 'play')
  s += R(80, 165, 34, 34, { fill: BH.black }) + R(91, 176, 12, 12, { fill: BH.paper }) + hit(76, 161, 42, 42, 'stop')
  s += (S.rec ? Cc(143, 182, 16, { fill: BH.red }) : Cc(143, 182, 14, { stroke: BH.red, sw: 4.5 })) + hit(124, 163, 38, 38, 'rec')
  s += R(172, 174, 2.6, 16, { fill: BH.black }) + P('M188 174L188 190L176 182Z', { fill: BH.black }) + hit(166, 166, 30, 32, 'tostart')
  /* tempo, metre, cycle: the three shapes */
  s += Cc(42, 252, 24, { fill: BH.yellow }) + T(42, 257, String(Math.round(S.tempo * 100) / 100), { size: S.tempo >= 100 ? 14 : 17, w: 700, anchor: 'middle' }) + bhLab(42, 268, 'bpm', { anchor: 'middle', size: 5.5 }) + hit(16, 226, 52, 52, 'tempo')
  SKV.field.tempo = { x: o + 14, y: 242, w: 60, h: 20 }
  s += R(80, 230, 44, 44, { fill: BH.blue }) + T(102, 257, meterName(), { size: 13, w: 600, c: BH.paper, anchor: 'middle' }) + hit(76, 226, 52, 52, 'meter')
  SKV.field.meter = { x: o + 80, y: 230, w: 44, h: 44 }
  const c = S.cycle
  s += P('M134 274L157 230L180 274Z', c.on ? { fill: BH.yellow } : { stroke: BH.yellow, sw: 3.5, x: ' stroke-linejoin="round"' }) + hit(130, 226, 54, 52, 'loop')
  const row = (y, k, v, a, dim) => bhLab(L, y, k) + T(70, y + .5, v, { size: 11, a: dim ? .55 : 1 }) + (a ? hit(L - 4, y - 11, CW - 30, 16, a) : '')
  s += row(298, 'cycle', c.on ? `bars ${Math.round(c.a + 1)} to ${Math.round(c.b)}` : 'off', 'loop', !c.on) + row(316, 'key', S.key || '—', 'key', !S.key)
  SKV.field.key = { x: o + 66, y: 305, w: 70, h: 16 }
  const ring = (x, y, on, word, a) => (on ? Cc(x + 5, y - 4, 5, { fill: BH.black }) : Cc(x + 5, y - 4, 4.5, { stroke: BH.black, sw: 1.5 })) + T(x + 15, y, word, { size: 11, a: on ? 1 : .6 }) + hit(x - 2, y - 13, tw(word, 11) + 22, 18, a)
  s += ring(L, 340, !!S.click, 'click', 'click') + ring(96, 340, !!S.lowLat, 'low latency', 'lowlat')
  s += bhRule(356)
  /* the hand: the tool and the mode, large; automation and rubato */
  const big = (x, y, k, v, a) => { const w = tw(v, 18, 600); SKV.field[a] = { x: o + x - 2, y: y - 18, w: Math.max(60, w + 6), h: 24 }; return bhLab(x, y - 22, k) + T(x, y, v, { size: 18, w: 600 }) + P(`M${n(x + w + 5)} ${y - 9}l4 4.5l4 -4.5`, { stroke: BH.black, sw: 1.4 }) + hit(x - 4, y - 32, w + 22, 38, a) }
  s += big(L, 398, 'tool', toolWord(S.tool), 'toolmenu') + big(116, 398, 'mode', S.mode, 'modemenu')
  const sq = (x, y, on, word, a) => R(x, y - 9, 10, 10, on ? { fill: BH.black } : { stroke: BH.black, sw: 1.4 }) + T(x + 16, y, word, { size: 11, a: on ? 1 : .6 }) + hit(x - 3, y - 13, tw(word, 11) + 24, 18, a)
  s += sq(L, 424, !!S.auto, 'automation', 'autokey') + sq(116, 424, !!S.flex, 'rubato', 'flexkey')
  s += bhRule(440)
  /* the grid and the nudge */
  s += big(L, 482, 'grid', S.grid, 'grid') + big(116, 482, 'nudge', S.nudge, 'nudge')
  s += bhRule(498)
  /* the tracks: a red disc to add one, how many */
  const nt = S.tracks.filter(t => t.kind === 'audio').length
  s += Cc(34, 530, 15, { fill: BH.red }) + P('M34 522V538M26 530H42', { stroke: BH.paper, sw: 2.4 }) + hit(17, 513, 34, 34, 'addtrack')
  s += T(60, 541, String(nt), { size: 30, w: 700 }) + T(64 + tw(String(nt), 30, 700), 541, nt === 1 ? 'track' : 'tracks', { size: 11, a: .7 })
  /* the zoom: two rules, a red dot each */
  const zf = typeof fitPXB === 'function' ? clamp(Math.log(PXB / fitPXB()) / Math.log(640 / fitPXB()), 0, 1) : .3, rf = clamp(((S.rh || 25) - 20) / 100, 0, 1)
  const zoom = (x, y, w, f, a, glyph) => bhLab(x, y - 10, glyph) + R(x, y, w, 1.6, { fill: BH.black }) + Cc(x + w * f, y + .8, 4, { fill: BH.red }) + hit(x - 4, y - 8, w + 8, 16, a, '', 'ew-resize')
  s += zoom(L, 578, 78, zf, 'zoomx', 'zoom across') + zoom(116, 578, 74, rf, 'zoomy', 'zoom down')
  /* the out: a ring as loud as the mix */
  if (H > 640) {
    const mx = 98, my = Math.max(680, H - 140)
    BHX.donut = [mx, my]
    s += P(`M8 ${my - 104}L190 ${my + 96}`, { stroke: BH.black, sw: 2 }) + Cc(mx, my, 62, { fill: BH.blue }) + P('', { fill: BH.black, x: ' id="bh-donut"' })
    s += Cc(mx, my, 36, { fill: BH.paper }) + T(mx, my + 4, fmtDb(S.master), { size: 17, w: 700, anchor: 'middle' }) + bhLab(mx, my + 16, 'out', { anchor: 'middle', ls: 2.4, size: 6 }) + Cc(172, my - 84, 10, { fill: BH.red })
    s += hit(mx - 40, my - 40, 80, 80, 'master', '', 'ns-resize')
  } else BHX.donut = null
  return G(R(0, 0, CW, H, { fill: K1 }) + G(s, '', ' id="bh-col"'), `translate(${o} 0)`)
}
/* the foot: a black band, what is chosen */
function bhDraftFoot (y0) {
  const rs = S.focus === 'tracks' ? [] : selRegs(), st = S.tracks[S.sel], r = rs.length ? rs[0][0] : null, look = r ? regLook(r, rs[0][1]) : st ? { c: st.c } : { c: BH.grey }
  let s = R(0, y0, W, DECK_H, { fill: BH.black }), x = 16
  const yb = y0 + DECK_H / 2 + 4
  const item = (k, v, a) => { const kw = tw(k, 7, 600) + 9, w = kw + tw(v, 11); if (x + w > W - 12) return; s += T(x, yb - .5, k, { size: 7, w: 600, c: BH.yellow }) + T(x + kw, yb, v, { size: 11, c: BH.paper }); if (a) s += hit(x - 4, y0 + 3, w + 8, DECK_H - 6, a); x += w + 30 }
  if (r) item(rs.length > 1 ? 'REGIONS' : 'REGION', rs.length > 1 ? String(rs.length) : asGiven(r.tag || r.name || rs[0][1].name))
  else if (st) item('TRACK', asGiven(st.name))
  s += R(x - 14, y0 + 8, 14, DECK_H - 16, { fill: look.c }) + hit(x - 16, y0 + 4, 18, DECK_H - 8, 'look'); x += 16
  if (r) {
    const sg = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v || 0)
    item('GAIN', fmtDb(r.gain || 0) + ' dB', 'rgain'); item('TRANSPOSE', sg(r.tr), 'rtr')
    if (!(r.notes || rs[0][1].midi)) item('FINE', sg(r.ft), 'rft')
    item('FADES', `${+(r.fi || 0).toFixed(2)}  ${+(r.fo || 0).toFixed(2)}`)
    if (!r.loop && r.bpm > 0) item('BPM', String(+r.bpm.toFixed(1)), 'rbpm')
    item('FROM', readout(r.a - 1)); item('LENGTH', `${+(r.b - r.a).toFixed(2)} bars`)
  } else if (st) { item('LEVEL', fmtDb(shown(st, 'vol')) + ' dB'); item('OUT', asGiven(outName(st))) }
  return s
}

/* laid into the room: the theme's column and foot are these; the tool row folds away when the transport is the column */
SKIN_BANDS.poster = [0, 30, BHD.CW]
SKINS.left.poster = bhDraftLeft
SKINS.foot.poster = bhDraftFoot
{
  const frame0 = SKINS.frame.poster
  SKINS.frame.poster = p => { frame0(p); const [, rest] = bhPlace(p), re = $('bh-rest'); if (re && re.textContent !== rest) re.textContent = rest; const sm = $('bh-smpte'); if (sm && typeof smpte === 'function') { const t = smpte(p); if (sm.textContent !== t) sm.textContent = t } }
  const relayout0 = relayout
  relayout = function () {
    relayout0()
    if (!(typeof SKIN === 'object' && SKIN.k.transport === 'poster')) return
    const d = MK_Y - TOOL_Y
    if (d <= 0) return
    MK_Y -= d; RU_Y -= d; TY -= d; LANES_H += d
    const set = (id, x, y, w, h) => { const q = $(id).firstChild; q.setAttribute('x', n(x)); q.setAttribute('y', n(y)); q.setAttribute('width', n(Math.max(0, w))); q.setAttribute('height', n(Math.max(0, h))) }
    set('tl', X0, MK_Y, X1 - X0, BY - MK_Y); set('ln', X0, TY, X1 - X0, LANES_H); set('hdc', 0, TY, HEAD_W, LANES_H)
    VY = clamp(VY, 0, maxVY())
  }
  const info0 = PARTS.info
  PARTS.info = () => typeof SKIN === 'object' && SKIN.k.transport === 'poster' ? '' : info0()
}
