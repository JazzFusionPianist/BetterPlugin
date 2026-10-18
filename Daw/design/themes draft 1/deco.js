/* ── theme: deco — gold on midnight, the twenties ──
   A pattern of gold fans over a midnight ground. The transport is a medallion in the middle of the top with a sunburst
   behind it, stop and record smaller medallions at its sides, the place and the time on stepped plaques. Markers are
   plaques with cut corners; the heads are framed panels; a track's level is a fan that opens as it grows louder; mute,
   solo and record are diamonds. Regions are cream panels with gold edges and cut corners. */
const DC = { night: '#0E1726', night2: '#15213A', gold: '#C9A45C', gold2: '#E8D3A2', cream: '#F2E8D2', emerald: '#2E7D67', ruby: '#A8323E', sapphire: '#3A5BA0', amber: '#D99A2B' }
const dcF = { show: "'Poiret One', sans-serif", text: "'Josefin Sans', sans-serif" }
const dcGem = t => ({ kick: DC.ruby, snare: DC.ruby, hats: DC.amber, bass: DC.sapphire, keys: DC.emerald, guitar: DC.amber, hum: DC.ruby, air: DC.sapphire })[t.name] || DC.emerald

function dcDefs () {
  let fan = ''
  for (const [cx, cy] of [[24, 24], [0, 12], [48, 12], [0, 36], [48, 36], [24, 48]]) for (const r of [22, 16, 10, 4]) fan += `<path d="M${cx - r} ${cy}A${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="${DC.gold}" stroke-width=".8"/>`
  return `<defs><pattern id="dc-fan" width="48" height="24" patternUnits="userSpaceOnUse">${fan}</pattern>
    <linearGradient id="dc-goldg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F1DDAA"/><stop offset=".5" stop-color="${DC.gold}"/><stop offset="1" stop-color="#8E6E34"/></linearGradient>
    <radialGradient id="dc-med" cx=".5" cy=".4" r=".6"><stop offset="0" stop-color="#22324F"/><stop offset="1" stop-color="${DC.night}"/></radialGradient>
    <filter id="dc-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.5"/></filter></defs>`
}
/* a frame with its corners cut */
const dcCut = (x, y, w, h, c, o = {}) => pa(`M${x + c} ${y}H${x + w - c}L${x + w} ${y + c}V${y + h - c}L${x + w - c} ${y + h}H${x + c}L${x} ${y + h - c}V${y + c}Z`, o)
const dcDia = (x, y, r, on, col = DC.gold) => pa(`M${x} ${y - r}L${x + r} ${y}L${x} ${y + r}L${x - r} ${y}Z`, on ? { fill: col } : { stroke: DC.gold, sw: 1 })

THEMES.deco = () => {
  const song = tdSong(), T = song.tracks, head = song.head
  let s = dcDefs() + rc(0, 0, TW, TH, { fill: DC.night }) + rc(0, 0, TW, TH, { fill: 'url(#dc-fan)', fa: .13 })
  /* the top: a medallion with a sunburst, its wings */
  const cx = TW / 2, cy = 92
  s += rc(0, 0, TW, 178, { fill: DC.night, fa: .82 })
  for (let k = 0; k < 44; k++) { const a = (-90 + (k - 21.5) * 4.1) * Math.PI / 180, r0 = 78, r1 = k % 2 ? 150 : 128; s += ln(cx + r0 * Math.cos(a), cy + r0 * Math.sin(a), cx + r1 * Math.cos(a), cy + r1 * Math.sin(a), DC.gold, k % 2 ? .6 : 1.1, .7) }
  s += ci(cx, cy, 70, { fill: 'url(#dc-med)', stroke: 'url(#dc-goldg)', sw: 3 }) + ci(cx, cy, 62, { stroke: DC.gold, sw: .8 })
  s += pa(`M${cx - 14} ${cy - 24}L${cx - 14} ${cy + 24}L${cx + 26} ${cy}Z`, { fill: 'url(#dc-goldg)' }) + tx(cx, cy + 50, 'PLAY', { f: dcF.text, z: 8, w: 600, c: DC.gold2, anchor: 'middle', ls: 3 })
  const side = (x, glyph, label) => ci(x, cy, 30, { fill: 'url(#dc-med)', stroke: DC.gold, sw: 2 }) + glyph + tx(x, cy + 46, label, { f: dcF.text, z: 8, w: 600, c: DC.gold2, anchor: 'middle', ls: 3 })
  s += side(cx - 172, rc(cx - 182, cy - 10, 20, 20, { fill: 'url(#dc-goldg)' }), 'STOP') + side(cx + 172, ci(cx + 172, cy, 11, { fill: DC.ruby, stroke: DC.gold2, sw: 1 }), 'RECORD')
  s += side(cx - 260, pa(`M${cx - 250} ${cy - 10}L${cx - 250} ${cy + 10}L${cx - 266} ${cy}Z`, { fill: 'url(#dc-goldg)' }) + rc(cx - 271, cy - 10, 3, 20, { fill: DC.gold }), 'TO START')
  /* stepped plaques: the place, the time, the tempo, the metre */
  const plaque = (x, w, big, small, alignR) => { let o = pa(`M${x} ${cy + 26}V${cy - 22}H${x + 12}V${cy - 32}H${x + w - 12}V${cy - 22}H${x + w}V${cy + 26}Z`, { fill: DC.night2, stroke: DC.gold, sw: 1.2 }); o += tx(x + w / 2, cy + 8, big, { f: dcF.show, z: 34, c: DC.cream, anchor: 'middle' }) + tx(x + w / 2, cy + 22, small, { f: dcF.text, z: 7.5, w: 600, c: DC.gold, anchor: 'middle', ls: 3 }); return o }
  s += plaque(cx - 500, 196, '20.1.1', 'BAR') + plaque(cx + 304, 196, '0:49.5', 'TIME')
  s += plaque(44, 160, '92', 'BEATS A MINUTE') + plaque(TW - 204, 160, '4/4', 'METRE')
  s += tx(44, 30, 'SLUR STUDIO', { f: dcF.text, z: 9, w: 600, c: DC.gold, ls: 5 })
  s += tx(cx, 182, song.name, { f: dcF.show, z: 16, c: DC.gold2, anchor: 'middle', ls: 4 })
  /* the rule under it: two gold lines and a diamond */
  s += ln(40, 192, cx - 90, 192, DC.gold, 1) + ln(cx + 90, 192, TW - 40, 192, DC.gold, 1) + ln(40, 196, cx - 90, 196, DC.gold, .5) + ln(cx + 90, 196, TW - 40, 196, DC.gold, .5) + dcDia(cx - 84, 194, 4, true) + dcDia(cx + 84, 194, 4, true)
  /* the markers on plaques */
  const HW = 300, L = 40 + HW + 14, R = TW - 40, mTop = 208, laneTop = 250, foot = 846
  tdMap(L + 6, R - 6, 1, song.end + 1)
  for (const sc of song.scenes) { const x = bx(sc.a), w = Math.min(bx(sc.b) - x - 6, tw2(sc.name.toUpperCase(), dcF.text, 10, 600) + 30); s += dcCut(x, mTop, w, 22, 6, { fill: DC.night2, stroke: DC.gold, sw: 1 }) + tx(x + 12, mTop + 15, sc.name.toUpperCase(), { f: dcF.text, z: 10, w: 600, c: DC.gold2, ls: 2.4 }) }
  const c0 = bx(song.cycle.a + 1), c1 = bx(song.cycle.b + 1)
  for (let x = c0; x < c1 - 8; x += 12) s += pa(`M${x} ${mTop + 34}l6 -5l6 5`, { stroke: DC.gold, sw: 1.2 })
  /* heads and lanes */
  s += dcCut(L - 6, laneTop - 8, R - L + 12, foot - laneTop + 16, 14, { fill: DC.night, fa: .9, stroke: DC.gold, sw: 1.4 }) + dcCut(L - 2, laneTop - 4, R - L + 4, foot - laneTop + 8, 11, { stroke: DC.gold, sw: .5 })
  const rh = (foot - laneTop) / T.length
  for (let b = 1; b <= song.end; b++) { const x = bx(b); s += ln(x, laneTop, x, foot, DC.gold, (b - 1) % 4 ? .4 : .7, (b - 1) % 4 ? .1 : .25) }
  T.forEach((t, i) => {
    const y = laneTop + i * rh, gem = dcGem(t)
    s += dcCut(40, y + 4, HW, rh - 8, 10, { fill: DC.night2, stroke: DC.gold, sw: 1 })
    s += pa(`M${52} ${y + rh / 2}L${60} ${y + rh / 2 - 9}L${68} ${y + rh / 2}L${60} ${y + rh / 2 + 9}Z`, { fill: gem, stroke: DC.gold2, sw: .8 })
    s += tx(82, y + rh / 2 + 2, t.name, { f: dcF.show, z: 24, c: DC.cream }) + tx(84, y + rh / 2 + 18, String(i + 1).padStart(2, '0') + (t.theirs ? '   WITH ' + t.theirs.toUpperCase() : ''), { f: dcF.text, z: 7.5, w: 600, c: DC.gold, ls: 2, more: ' xml:space="preserve"' })
    s += dcDia(212, y + rh / 2 - 6, 6, !!t.mute, DC.amber) + dcDia(230, y + rh / 2 - 6, 6, !!t.solo, DC.emerald) + dcDia(248, y + rh / 2 - 6, 6, i === 4, DC.ruby)
    s += tx(212, y + rh / 2 + 16, 'M', { f: dcF.text, z: 7, w: 600, c: DC.gold, anchor: 'middle' }) + tx(230, y + rh / 2 + 16, 'S', { f: dcF.text, z: 7, w: 600, c: DC.gold, anchor: 'middle' }) + tx(248, y + rh / 2 + 16, 'R', { f: dcF.text, z: 7, w: 600, c: DC.gold, anchor: 'middle' })
    /* the level: a fan that opens */
    const fx = 300, fy = y + rh / 2 + 14, lv = Math.max(0, Math.min(1, ((t.vol || 0) + 24) / 30)), a1 = Math.PI * (1 + lv)
    for (const r of [22, 16, 10]) s += pa(`M${fx - r} ${fy}A${r} ${r} 0 0 1 ${fx + r} ${fy}`, { stroke: DC.gold, sw: .6, sa: .45 })
    s += pa(`M${fx} ${fy}L${fx - 22} ${fy}A22 22 0 0 1 ${nn(fx + 22 * Math.cos(a1))} ${nn(fy + 22 * Math.sin(a1))}Z`, { fill: DC.gold, fa: .8 })
    for (const g of tdRegs(t, L, R)) {
      s += dcCut(g.xa + 1.5, y + 7, g.w - 3, rh - 14, 6, { fill: DC.cream, stroke: DC.gold, sw: 1.2 })
      if (tdIsNotes(t, g.r)) { const { d, tr } = tdNotes(g, y + 12, rh - 24); s += gr(pa(d, { stroke: DC.night, sw: 2.2, sa: .9 }), tr) }
      else s += pa(tdWave(g, y + rh / 2, rh / 2 - 12), { fill: DC.night, fa: .88 })
    }
  })
  /* the playhead: a gold line with a diamond */
  const px = bx(head + 1)
  s += ln(px, mTop + 30, px, foot + 4, DC.gold2, 4, .25, ' filter="url(#dc-glow)"') + ln(px, mTop + 30, px, foot + 4, DC.gold2, 1.3) + dcDia(px, mTop + 32, 7, true, DC.gold2)
  /* the foot */
  s += ln(40, foot + 18, TW - 40, foot + 18, DC.gold, .5)
  const words = [['TOOL', 'pointer'], ['MODE', 'smart'], ['GRID', '¼'], ['NUDGE', 'a beat'], ['CYCLE', 'on'], ['CLICK', 'off']]
  let x = 60
  for (const [k, v] of words) { s += tx(x, foot + 42, k, { f: dcF.text, z: 8, w: 600, c: DC.gold, ls: 2.5 }) + tx(x + tw2(k, dcF.text, 8, 600) + 22, foot + 43, v, { f: dcF.show, z: 15, c: DC.cream }); x += 180 }
  s += tx(TW - 60, foot + 43, 'OUT  −4.2', { f: dcF.text, z: 10, w: 600, c: DC.gold2, anchor: 'end', ls: 2, more: ' xml:space="preserve"' })
  return s
}
