/* ── theme: blueprint — the song as a drawing, in place of deco ──
   His word on draft 1: deco to be replaced. A sheet of cyanotype with its grid; the song drawn as an engineer draws:
   a border with its zones lettered and numbered, a scale bar, each track called out with a numbered balloon, regions
   in outline with section hatching and their sound as a profile, markers as section lines, the cycle as a dimension,
   the playhead a centre line in red pencil. The transport lives in the title block, where a drawing says what it is.
   The mixer is its elevation. Type: IBM Plex Mono for annotations, Plex Sans Condensed for titles. */
const BP = { ground: '#174A80', ground2: '#123D6B', line: '#E8F1FF', red: '#FF7A59' }
const bpF = { mono: "'IBM Plex Mono', monospace", cond: "'IBM Plex Sans Condensed', sans-serif" }
const bpT = (x, y, s, o = {}) => tx(x, y, s, Object.assign({ f: bpF.mono, z: 8, w: 500, c: BP.line, ls: .4 }, o))
const bpL = (x1, y1, x2, y2, o = {}) => ln(x1, y1, x2, y2, o.c || BP.line, o.w || .8, o.a == null ? .9 : o.a, o.dash ? ` stroke-dasharray="${o.dash}"` : '')

function bpDefs () {
  return `<defs>
    <pattern id="bp-grid" width="40" height="40" patternUnits="userSpaceOnUse">${[8, 16, 24, 32].map(v => `<path d="M${v} 0V40M0 ${v}H40" stroke="#FFFFFF" stroke-opacity=".05" stroke-width=".5"/>`).join('')}<path d="M0 0V40M0 0H40" stroke="#FFFFFF" stroke-opacity=".12" stroke-width=".6"/></pattern>
    <pattern id="bp-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V6" stroke="#E8F1FF" stroke-opacity=".22" stroke-width=".7"/></pattern>
    <radialGradient id="bp-sheet" cx=".45" cy=".4" r=".8"><stop offset="0" stop-color="${BP.ground}"/><stop offset="1" stop-color="${BP.ground2}"/></radialGradient>
    <marker id="bp-arr" viewBox="0 0 8 8" refX="7.5" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1L8 4L0 7Z" fill="${BP.line}"/></marker>
  </defs>`
}
/* a dimension: a line with arrows between two extension lines, its words in the middle */
function bpDim (x0, x1, y, words, yExt) {
  let s = bpL(x0, yExt, x0, y - 4, { a: .6, w: .6 }) + bpL(x1, yExt, x1, y - 4, { a: .6, w: .6 })
  const tw0 = tw2(words, bpF.mono, 7.5, 500) + 10, mx = (x0 + x1) / 2
  s += `<line x1="${x0}" y1="${y}" x2="${mx - tw0 / 2}" y2="${y}" stroke="${BP.line}" stroke-width=".7" marker-start="url(#bp-arr)"/><line x1="${mx + tw0 / 2}" y1="${y}" x2="${x1}" y2="${y}" stroke="${BP.line}" stroke-width=".7" marker-end="url(#bp-arr)"/>`
  return s + bpT(mx, y + 2.6, words, { z: 7.5, anchor: 'middle' })
}
const bpBalloon = (x, y, n) => ci(x, y, 8, { fill: BP.ground, stroke: BP.line, sw: .8 }) + bpT(x, y + 2.8, n, { z: 7.5, anchor: 'middle', ls: 0 })
const bpBox = (x, y, on, red) => rc(x + .5, y + .5, 7, 7, on ? { fill: red ? BP.red : BP.line } : { stroke: BP.line, sw: .7, sa: .8 })

THEMES.blueprint = () => {
  const song = tdSong(), T = song.tracks, head = song.head
  let s = bpDefs() + rc(0, 0, TW, TH, { fill: 'url(#bp-sheet)' }) + rc(0, 0, TW, TH, { fill: 'url(#bp-grid)' })
  /* the border, its zones */
  const B = 14
  s += rc(B, B, TW - 2 * B, TH - 2 * B, { stroke: BP.line, sw: 1.4, sa: .9 }) + rc(B + 6, B + 6, TW - 2 * B - 12, TH - 2 * B - 12, { stroke: BP.line, sw: .6, sa: .7 })
  for (let k = 0; k < 12; k++) { const x = B + 6 + (TW - 2 * B - 12) * (k + .5) / 12; s += bpT(x, B + 4.6, String(k + 1), { z: 6.5, anchor: 'middle', a: .7 }) + bpT(x, TH - B - 1.4, String(k + 1), { z: 6.5, anchor: 'middle', a: .7 }); if (k) { const xb = B + 6 + (TW - 2 * B - 12) * k / 12; s += bpL(xb, B, xb, B + 6, { a: .6, w: .6 }) + bpL(xb, TH - B - 6, xb, TH - B, { a: .6, w: .6 }) } }
  for (let k = 0; k < 8; k++) { const y = B + 6 + (TH - 2 * B - 12) * (k + .5) / 8; s += bpT(B + 3, y + 2.4, 'ABCDEFGH'[k], { z: 6.5, anchor: 'middle', a: .7 }) + bpT(TW - B - 3, y + 2.4, 'ABCDEFGH'[k], { z: 6.5, anchor: 'middle', a: .7 }) }
  /* the heading, and a scale bar */
  s += tx(40, 52, 'ARRANGEMENT  —  PLAN', { f: bpF.cond, z: 12, w: 600, c: BP.line, ls: 2.6, more: ' xml:space="preserve"' }) + bpT(40, 66, 'EIGHT TRACKS   FORTY-THREE BARS   ALL UNITS IN BARS', { z: 7, a: .7, more: ' xml:space="preserve"' })
  const L = 230, R = TW - 40, top = 94, rh = 50
  tdMap(L, R, 1, song.end + 1)
  const sb = bx(9) - bx(1)
  s += rc(TW - 40 - sb, 44, sb / 2, 4, { fill: BP.line }) + rc(TW - 40 - sb / 2, 44, sb / 2, 4, { stroke: BP.line, sw: .6 }) + bpT(TW - 40 - sb, 60, '0', { z: 7, anchor: 'middle' }) + bpT(TW - 40 - sb / 2, 60, '4', { z: 7, anchor: 'middle' }) + bpT(TW - 40, 60, '8 BARS', { z: 7, anchor: 'middle' })
  /* markers: section lines, lettered */
  const laneTop = top + 40, foot = laneTop + rh * T.length
  song.scenes.forEach((sc, i) => {
    const x = bx(sc.a), L2 = String.fromCharCode(65 + i)
    s += bpL(x, top + 6, x, foot + 6, { a: .45, w: .7, dash: '14 3 2 3' }) + ci(x, top, 7, { stroke: BP.line, sw: .8 }) + bpT(x, top + 2.8, L2, { z: 8, anchor: 'middle', ls: 0 }) + bpT(x + 11, top + 3, sc.name.toUpperCase(), { z: 7.5 })
  })
  for (let b = 1; b <= song.end; b += 4) s += bpT(bx(b) + 2, laneTop - 4, String(b), { z: 6.5, a: .65 })
  /* the cycle: a dimension */
  const c0 = bx(song.cycle.a + 1), c1 = bx(song.cycle.b + 1)
  s += bpDim(c0, c1, top + 20, 'CYCLE  17 — 25', laneTop)
  /* tracks: a balloon, a name, its boxes; regions in outline, hatched, their sound a profile */
  T.forEach((t, i) => {
    const y = laneTop + i * rh, mid = y + rh / 2
    s += bpBalloon(46, mid, String(i + 1).padStart(2, '0')) + bpT(62, mid - 2, t.name.toUpperCase(), { z: 9, w: 600 }) + (t.theirs ? bpT(62, mid + 10, 'WITH ' + t.theirs.toUpperCase(), { z: 6.5, a: .6 }) : '')
    s += bpBox(132, mid - 9, !!t.mute) + bpBox(144, mid - 9, !!t.solo) + bpBox(156, mid - 9, i === 4, true) + bpT(131, mid + 7, 'M S R', { z: 6.2, a: .7, ls: 2.1, more: ' xml:space="preserve"' })
    const lv = Math.max(0, Math.min(1, ((t.vol || 0) + 24) / 30))
    s += bpL(176, mid - 5, 214, mid - 5, { a: .5, w: .6 }) + bpL(176 + 38 * lv, mid - 9, 176 + 38 * lv, mid - 1, { w: 1.2 }) + bpT(176, mid + 7, ((t.vol || 0) > 0 ? '+' : '') + (t.vol || 0).toFixed(1) + ' DB', { z: 6.5, a: .8 })
    s += bpL(70 + tw2(t.name.toUpperCase(), bpF.mono, 9, 600), mid - 5, 126, mid - 5, { a: .25, w: .5, dash: '1 2' })
    s += bpL(L, y + rh, R, y + rh, { a: .18, w: .5 })
    for (const g of tdRegs(t, L, R)) {
      s += rc(g.xa + 1, y + 6, g.w - 2, rh - 12, { fill: 'url(#bp-hatch)' }) + rc(g.xa + 1, y + 6, g.w - 2, rh - 12, { stroke: BP.line, sw: .9 })
      if (tdIsNotes(t, g.r)) { const { d, tr } = tdNotes(g, y + 9, rh - 18); s += gr(pa(d, { stroke: BP.line, sw: 1.2 }), tr) }
      else s += pa(tdWave(g, mid, rh / 2 - 9), { stroke: BP.line, sw: .8, fill: BP.ground, fa: .85 })
    }
  })
  /* one region's length, dimensioned under it (the chosen one) */
  const kt = T.find(t => t.name === 'hats'), kr = kt && kt.regs.find(r => r.a >= 12 && r.a < 15)      // (where the lane under it is empty)
  if (kr) { const ki = T.indexOf(kt), yb = laneTop + (ki + 1) * rh; s += bpDim(bx(kr.a), bx(kr.b), yb + 9, `${kr.b - kr.a} BARS`, yb - 6) }
  /* the playhead: a centre line in red pencil */
  const px = bx(head + 1)
  s += bpL(px, top + 26, px, foot + 10, { c: BP.red, w: 1.1, a: 1, dash: '16 3 3 3' }) + pa(`M${px - 4} ${top + 26}L${px + 4} ${top + 26}L${px} ${top + 33}Z`, { fill: BP.red })
  /* the elevation: the mixer, each strip drawn as its parts */
  const ey = foot + 46, ST = T.concat([{ name: 'plate', vol: 0, regs: [], bus: true }]), sw2 = 92
  s += tx(40, ey - 14, 'MIXER  —  ELEVATION', { f: bpF.cond, z: 10, w: 600, c: BP.line, ls: 2.4, more: ' xml:space="preserve"' })
  ;['PATCH', 'MIXER', 'NOTES', 'PROMPT', 'RUBATO'].forEach((t2, k) => { const x = 200 + k * 62; s += rc(x, ey - 25, 56, 15, t2 === 'MIXER' ? { fill: BP.line } : { stroke: BP.line, sw: .7, sa: .7 }) + bpT(x + 28, ey - 15, t2, { z: 7, anchor: 'middle', c: t2 === 'MIXER' ? BP.ground : BP.line }) })
  ST.forEach((t, i) => {
    const x = 40 + i * sw2, h = 168, y0 = ey + 4, vl = Math.max(0, Math.min(1, ((t.vol || 0) + 30) / 36)), cy = y0 + 34 + (h - 40) * (1 - vl)
    s += rc(x + .5, y0 + .5, sw2 - 8, h + 30, { stroke: BP.line, sw: .6, sa: .5 })
    s += bpT(x + 6, y0 + 12, t.name.toUpperCase(), { z: 7.5, w: 600 })
    s += ci(x + 66, y0 + 24, 8, { stroke: BP.line, sw: .7 }) + bpL(x + 66, y0 + 24, x + 66 + 8 * Math.sin((t.pan || 0) * 2.4), y0 + 24 - 8 * Math.cos((t.pan || 0) * 2.4), { w: 1 }) + bpT(x + 66, y0 + 42, 'PAN', { z: 5.8, anchor: 'middle', a: .6 })
    s += rc(x + 18, y0 + 34, 4, h - 40, { stroke: BP.line, sw: .6 }) + rc(x + 9, cy - 4, 22, 8, { fill: BP.ground, stroke: BP.line, sw: .9 }) + bpL(x + 11, cy, x + 29, cy, { w: .7 })
    for (let k = 0; k <= 6; k++) s += bpL(x + 34, y0 + 34 + k * (h - 40) / 6, x + 38, y0 + 34 + k * (h - 40) / 6, { a: .6, w: .5 })
    s += bpL(x + 44, cy, x + 50, cy, { w: .6 }) + bpT(x + 52, cy + 2.6, ((t.vol || 0) > 0 ? '+' : '') + (t.vol || 0).toFixed(1), { z: 7 })
    s += bpBox(x + 54, y0 + h + 8, i === 2) + bpBox(x + 66, y0 + h + 8, false) + bpT(x + 6, y0 + h + 15, 'M S', { z: 6, a: .7, more: ' xml:space="preserve"' })
  })
  /* the title block: what the drawing is, and the transport */
  const tbx = TW - 40 - 420, tby = TH - 40 - 96, cw = [140, 140, 140]
  s += rc(tbx, tby, 420, 96, { fill: BP.ground2, fa: .6, stroke: BP.line, sw: 1.2 })
  const cell = (x, y, w, h, k, v, big) => rc(x, y, w, h, { stroke: BP.line, sw: .6, sa: .8 }) + bpT(x + 5, y + 9, k, { z: 5.8, a: .65 }) + bpT(x + 5, y + h - 6, v, { z: big ? 12 : 9, w: big ? 600 : 500 })
  s += cell(tbx, tby, 210, 32, 'PROJECT', song.name.toUpperCase(), true) + cell(tbx + 210, tby, 105, 32, 'DRAWN BY', 'SLUR STUDIO') + cell(tbx + 315, tby, 105, 32, 'SHEET', '1 OF 1')
  s += cell(tbx, tby + 32, 105, 32, 'BAR', '020.1.1', true) + cell(tbx + 105, tby + 32, 105, 32, 'TIME', '0:49.5', true) + cell(tbx + 210, tby + 32, 105, 32, 'TEMPO', '92.00') + cell(tbx + 315, tby + 32, 105, 32, 'METRE', '4/4')
  s += rc(tbx, tby + 64, 420, 32, { stroke: BP.line, sw: .6, sa: .8 }) + bpT(tbx + 5, tby + 73, 'TRANSPORT', { z: 5.8, a: .65 })
  const tr = [['⏮', 0], ['▶', 1], ['■', 0], ['●', 0]]
  tr.forEach(([g, on], k) => { const x = tbx + 110 + k * 34, y = tby + 80; s += ci(x, y, 10, on ? { fill: BP.line } : { stroke: BP.line, sw: .8 }) + tx(x + (on ? 1 : 0), y + 3.4, g, { z: 9, c: on ? BP.ground : g === '●' ? BP.red : BP.line, anchor: 'middle' }) })
  s += bpT(tbx + 270, tby + 83, 'CYCLE ON   CLICK OFF', { z: 7.5, more: ' xml:space="preserve"' })
  s += bpT(tbx, tby - 8, 'TOOL POINTER   MODE SMART   GRID 1/4   NUDGE BEAT', { z: 7, a: .7, more: ' xml:space="preserve"' })
  return s
}
