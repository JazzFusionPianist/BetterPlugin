/* ── bauhaus, draft 2: the room's top rows folded into the theme, sized by how much they matter (his ask, 2026-10-21:
   "중요도에 따라 사이즈를 조절… 구분선도 안넣고, 정말 위치를 제각각해도 돼", "각 요소의 위치를 막 섞어도 되니 자유롭게") ──
   Laid into the room by shots.mjs only (the room's own files are not changed until he says so).
   No rules between them: a poster. Play the largest thing, a red disc at the head; stop a black square and record a red
   ring beside it. Where the song is in a large figure, its beat, division and tick in red; the time and smpte small
   under it. The tempo a yellow disc, the metre a blue square, the cycle a yellow triangle, set apart; the key, click and
   low latency small beside them. The out a blue ring as loud as the mix, crossed by a line. The tracks and the adding of
   one lower; the tool, mode, grid, nudge, automation, rubato and zoom smallest, together at the foot. The tool row is
   gone; the black band at the foot says what is chosen (as draft 1). */
const BHD = { CW: 212 }
const bhLab = (x, y, s, o = {}) => `<text x="${n(x)}" y="${n(y)}" font-family="${FONT}" font-size="${n((o.size || 5.6) * TF.scale)}" font-weight="600" letter-spacing="${o.ls == null ? 1.3 : o.ls}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o.rot ? ` transform="rotate(${o.rot} ${n(x)} ${n(y)})"` : ''} fill="${o.c || BH.black}"${o.a != null && o.a < 1 ? ` fill-opacity="${o.a}"` : ''}>${esc(String(s).toUpperCase())}</text>`
const bhPlace = p => { const t = typeof place === 'function' ? place(p) : readout(p), k = t.indexOf('.'); return k < 0 ? [t, ''] : [t.slice(0, k), t.slice(k)] }

function bhDraftLeft () {
  const CW = BHD.CW, p = curPos(), [bar, rest] = bhPlace(p), o = -CW
  let s = ''
  /* the transport, largest: play a red disc, stop a black square, record a red ring, to the start a small mark */
  const play = S.playing && !S.rec
  s += Cc(66, 78, 50, { fill: BH.red }) + (play ? R(52, 56, 10, 44, { fill: BH.paper }) + R(71, 56, 10, 44, { fill: BH.paper }) : P('M52 52L52 104L97 78Z', { fill: BH.paper })) + hit(14, 26, 104, 104, 'play')
  s += R(132, 34, 44, 44, { fill: BH.black }) + R(147, 49, 14, 14, { fill: BH.paper }) + hit(128, 30, 52, 52, 'stop')
  s += (S.rec ? Cc(160, 116, 19, { fill: BH.red }) : Cc(160, 116, 16, { stroke: BH.red, sw: 5 })) + hit(138, 94, 44, 44, 'rec')
  s += R(126, 141, 2.2, 12, { fill: BH.black }) + P('M140 141L140 153L130 147Z', { fill: BH.black }) + T(144, 151, 'start', { size: 8, a: .7 }) + hit(122, 136, 50, 20, 'tostart')
  /* where the song is: a large figure, its beat, division and tick in red; the time and smpte small */
  BHX.rest = 12 + tw(bar, 92, 700) + 4
  s += T(10, 250, bar, { size: 92, w: 700, x: ' id="bh-bar"' }) + T(BHX.rest, 250, rest, { size: 13, w: 600, c: BH.red, x: ' id="bh-rest"' }) + hit(8, 176, CW - 20, 80, 'pos')
  SKV.field.pos = { x: o + 12, y: 200, w: 150, h: 44 }
  s += T(14, 274, clock(p), { size: 12, w: 500, x: ' id="bh-time"' }) + T(70, 274, typeof smpte === 'function' ? smpte(p) : '', { size: 10, a: .55, x: ' id="bh-smpte"' }) + hit(66, 262, 90, 16, 'smpte')
  SKV.field.smpte = { x: o + 66, y: 262, w: 96, h: 18 }
  /* tempo, metre, cycle: the three shapes, set apart */
  s += Cc(150, 344, 42, { fill: BH.yellow }) + T(150, 352, String(Math.round(S.tempo * 100) / 100), { size: S.tempo >= 100 ? 21 : 26, w: 700, anchor: 'middle' }) + bhLab(150, 366, 'bpm', { anchor: 'middle' }) + hit(106, 300, 88, 88, 'tempo')
  SKV.field.tempo = { x: o + 118, y: 332, w: 64, h: 24 }
  s += R(20, 304, 50, 50, { fill: BH.blue }) + T(45, 334, meterName(), { size: 15, w: 600, c: BH.paper, anchor: 'middle' }) + hit(16, 300, 58, 58, 'meter')
  SKV.field.meter = { x: o + 20, y: 304, w: 50, h: 50 }
  const c = S.cycle
  s += P('M24 448L54 388L84 448Z', c.on ? { fill: BH.yellow } : { stroke: BH.yellow, sw: 3.5, x: ' stroke-linejoin="round"' }) + hit(20, 384, 68, 68, 'loop')
  s += T(24, 466, c.on ? `cycle ${Math.round(c.a + 1)} to ${Math.round(c.b)}` : 'cycle off', { size: 9, a: c.on ? .9 : .5 }) + hit(20, 456, 90, 14, 'loop')
  /* the key, click and low latency: small, beside them */
  s += bhLab(112, 412, 'key') + T(136, 413, S.key || '—', { size: 11, w: 600, a: S.key ? 1 : .4 }) + hit(108, 400, 80, 18, 'key')
  SKV.field.key = { x: o + 132, y: 401, w: 60, h: 16 }
  const ring = (x, y, on, word, a) => (on ? Cc(x + 3.5, y - 3, 3.5, { fill: BH.black }) : Cc(x + 3.5, y - 3, 3.2, { stroke: BH.black, sw: 1.2 })) + T(x + 11, y, word, { size: 9, a: on ? 1 : .55 }) + hit(x - 2, y - 11, tw(word, 9) + 16, 15, a)
  s += ring(112, 434, !!S.click, 'click', 'click') + ring(112, 450, !!S.lowLat, 'low latency', 'lowlat')
  /* the out: a blue ring as loud as the mix, crossed by a line, a red dot */
  const mx = 104, my = 568
  BHX.donut = [mx, my]
  s += P(`M0 ${my - 92}L${CW - 3} ${my + 112}`, { stroke: BH.black, sw: 2 }) + Cc(mx, my, 60, { fill: BH.blue }) + P('', { fill: BH.black, x: ' id="bh-donut"' })
  s += Cc(mx, my, 35, { fill: BH.paper }) + T(mx, my + 4, fmtDb(S.master), { size: 16, w: 700, anchor: 'middle' }) + bhLab(mx, my + 15, 'out', { anchor: 'middle', ls: 2.2 }) + Cc(182, my - 54, 9, { fill: BH.red })
  s += hit(mx - 38, my - 38, 76, 76, 'master', '', 'ns-resize')
  /* the tracks: a figure, a red disc to add one */
  const nt = S.tracks.filter(t => t.kind === 'audio').length
  s += T(22, 706, String(nt), { size: 34, w: 700 }) + T(26 + tw(String(nt), 34, 700), 706, nt === 1 ? 'track' : 'tracks', { size: 9, a: .65 })
  s += Cc(150, 694, 12, { fill: BH.red }) + P('M150 687V701M143 694H157', { stroke: BH.paper, sw: 2.2 }) + hit(134, 678, 32, 32, 'addtrack')
  /* the smallest: the tool, the mode, the grid, the nudge, automation, rubato, the zoom */
  const small = (x, y, k, v, a) => { SKV.field[a] = { x: o + x - 2, y: y - 10, w: Math.max(56, tw(v, 10, 500) + 14), h: 14 }; return bhLab(x, y - 12, k) + T(x, y, v, { size: 10, w: 500 }) + P(`M${n(x + tw(v, 10, 500) + 4)} ${y - 5}l2.6 2.8l2.6 -2.8`, { stroke: BH.black, sw: 1 }) + hit(x - 3, y - 20, tw(v, 10, 500) + 14, 24, a) }
  s += small(22, 760, 'tool', toolWord(S.tool), 'toolmenu') + small(80, 760, 'mode', S.mode, 'modemenu') + small(138, 760, 'grid', S.grid, 'grid')
  s += small(22, 792, 'nudge', S.nudge, 'nudge')
  const sq = (x, y, on, word, a) => R(x, y - 7, 7, 7, on ? { fill: BH.black } : { stroke: BH.black, sw: 1.1 }) + T(x + 11, y, word, { size: 9, a: on ? 1 : .55 }) + hit(x - 2, y - 11, tw(word, 9) + 16, 15, a)
  s += sq(80, 792, !!S.auto, 'automation', 'autokey') + sq(80, 808, !!S.flex, 'rubato', 'flexkey')
  const zf = typeof fitPXB === 'function' ? clamp(Math.log(PXB / fitPXB()) / Math.log(640 / fitPXB()), 0, 1) : .3, rf = clamp(((S.rh || 25) - 20) / 100, 0, 1)
  const zoom = (x, y, w, f, a, word) => bhLab(x, y - 6, word) + R(x, y, w, 1.2, { fill: BH.black }) + Cc(x + w * f, y + .6, 3, { fill: BH.red }) + hit(x - 4, y - 8, w + 8, 14, a, '', 'ew-resize')
  s += zoom(22, 836, 44, zf, 'zoomx', 'zoom across') + zoom(80, 836, 44, rf, 'zoomy', 'zoom down')
  return G(R(0, 0, CW, H, { fill: K1 }) + R(CW - 3, 0, 3, H, { fill: BH.black }) + G(s, '', ' id="bh-col"'), `translate(${o} 0)`)
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
