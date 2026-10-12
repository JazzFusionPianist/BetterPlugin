/* Slur Studio, a bus's own lane: draft 2 (2026-10-12).
   Draft 1 drew what comes into a bus (a stream, a rail, dotted sends); he found all three too much and asked for a
   small difference only. So nothing is told here: a bus's lane can hold no region, and it only looks like such a lane.
     a  the line     one hairline along the middle of the lane, as long as the song
     b  the ground   the whole row, head and lane, a shade lighter than the page
     c  the hatch    a faint slant over the lane, as long as the song */
function busLane (b, rh, xEnd, kind) {
  const xe = Math.min(xEnd, X1)
  if (kind === 'a') return P(`M${X0} ${n(rh / 2) + .5}H${n(xe)}`, { stroke: INK, sa: .22 })
  if (kind === 'b') return R(X0, 0, X1 - X0, rh - 1, { fill: INK, fa: .05 })
  let d = ''
  for (let x = X0 - rh - ((X0 - rh) % 7); x < xe; x += 7) { const t0 = Math.max(1, X0 - x), t1 = Math.min(rh - 2, xe - x); if (t1 - t0 > 1) d += `M${n(x + t0)} ${n(rh - 1 - t0)}L${n(x + t1)} ${n(rh - 1 - t1)}` }
  return P(d, { stroke: INK, sa: .1 })
}
function busHead (kind) {
  if (kind !== 'b') return ''
  const L = rowTops()
  let s = ''
  L.r.forEach((i, k) => { if (S.tracks[i].kind === 'bus') s += R(3, TY + L.tops[k] - VY, HEAD_W - 3, rowH(i) - 1, { fill: INK, fa: .05 }) })
  return s
}
