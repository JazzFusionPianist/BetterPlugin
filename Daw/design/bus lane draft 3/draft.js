/* Slur Studio, a bus's own lane: draft 3 (2026-10-12).
   His answer to draft 2: the line and the ground together, and both in the bus's own colour — the whole row, head and
   lane, washed with it, and one line of it along the middle of the lane, as long as the song. A muted bus is paler. */
const BUS_WASH = .1, BUS_LINE = .75
function busLane (b, rh, xEnd, kind) {
  if (!kind) return ''
  const k = b.mute ? .45 : 1
  return R(X0, 0, X1 - X0, rh - 1, { fill: b.c, fa: BUS_WASH * k }) + P(`M${X0} ${n(rh / 2) + .5}H${n(Math.min(xEnd, X1))}`, { stroke: b.c, sa: BUS_LINE * k })
}
function busHead (kind) {
  if (!kind) return ''
  const L = rowTops()
  let s = ''
  L.r.forEach((i, k) => { const b = S.tracks[i]; if (b.kind === 'bus') s += R(3, TY + L.tops[k] - VY, HEAD_W - 3, rowH(i) - 1, { fill: b.c, fa: BUS_WASH * (b.mute ? .45 : 1) }) })
  return s
}
