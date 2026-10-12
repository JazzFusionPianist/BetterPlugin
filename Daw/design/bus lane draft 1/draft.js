/* Slur Studio, a bus's own lane: draft 1 (2026-10-12).
   A stack's lane shows what it holds (a dark block where anything in it sounds, a thin line for each of its tracks). A
   bus holds nothing: sound comes to it — from tracks that send to it, from tracks that play to it. Today its lane is
   empty. Three ways to draw what comes in, over the room's own page (draft.mjs puts busLane into ui.js's laneRow):
     a  the stream   one band along the song, as thick as what comes in at that moment is loud
     b  the rail     two hairlines the length of the song (a bus bar), and between them each sender in its own colour
     c  the sends    a dotted line for each sender, in its colour, as strong as it sends
   and in the head, for all three, the senders' colours before the m and s. */
const busFeeders = b => S.tracks.filter(t => t.kind !== 'bus' && t.kind !== 'stack').map(t => { const sd = (t.sends || []).find(x => x.to === b.id); return t.out === b.id ? { t, g: 1 } : sd ? { t, g: dbLin(sd.db) } : null }).filter(f => f && f.t.regs.length)
function busLane (b, rh, xEnd, kind) {
  const ly = 1.5, lh = rh - 3, mid = ly + lh / 2, F = busFeeders(b)
  let s = ''
  if (!F.length) return s
  if (kind === 'a') {
    /* every place where something begins or ends, and between two of them how much comes in */
    const cuts = [...new Set(F.flatMap(f => f.t.regs.flatMap(r => [r.a, r.b])))].sort((p, q) => p - q), sums = []
    for (let k = 0; k < cuts.length - 1; k++) { const m = (cuts[k] + cuts[k + 1]) / 2; sums.push(F.reduce((v, f) => v + (heard(f.t) && f.t.regs.some(r => r.a <= m && r.b > m) ? f.g : 0), 0)) }
    const top = Math.max(...sums, 1e-6), half = v => v > 0 ? 1.2 + (lh / 2 - 1.5) * Math.sqrt(v / top) : 0
    s += P(`M${X0} ${n(mid) + .5}H${n(Math.min(xEnd, X1))}`, { stroke: INK, sa: .16 })
    let up = '', down = ''
    for (let k = 0; k < sums.length; k++) { const xa = bx(cuts[k]), xb = Math.min(bx(cuts[k + 1]), xEnd), h = half(sums[k]); if (!h || xb < X0 - 2 || xa > X1 + 2) continue; s += R(xa, mid - h, xb - xa, h * 2, { fill: INK, fa: .2 }); up += `M${n(xa)} ${n(mid - h) + .5}H${n(xb)}`; down += `M${n(xa)} ${n(mid + h) - .5}H${n(xb)}` }
    s += P(up + down, { stroke: INK, sa: .6 })
  } else if (kind === 'b') {
    const gap = Math.max(6, Math.min(lh - 9, 4 + F.length * 3.5)), y0 = mid - gap / 2, sl = gap / F.length
    F.forEach((f, k) => { for (const r of f.t.regs) { const xa = bx(r.a), xb = Math.min(bx(r.b), xEnd); if (xb > X0 - 2 && xa < X1 + 2 && xb - xa > 1.5) s += R(xa + .5, y0 + k * sl, xb - xa - 1, Math.max(.8, sl - .4), { fill: f.t.c, fa: heard(f.t) ? .35 + .65 * Math.min(1, f.g * 2.4) : .2 }) } })
    s += P(`M${X0} ${n(y0 - 2) + .5}H${n(Math.min(xEnd, X1))}M${X0} ${n(y0 + gap + 2) - .5}H${n(Math.min(xEnd, X1))}`, { stroke: INK, sa: .42 })
  } else {
    F.forEach((f, k) => {
      const yy = ly + 4 + (F.length > 1 ? k * (lh - 9) / (F.length - 1) : (lh - 9) / 2)
      let d = ''
      for (const r of f.t.regs) { const xa = bx(r.a), xb = Math.min(bx(r.b), xEnd); if (xb > X0 - 2 && xa < X1 + 2 && xb - xa > 5) d += `M${n(xa + 2)} ${n(yy) + .5}H${n(xb - 2)}` }
      s += P(d, { stroke: f.t.c, sa: heard(f.t) ? .35 + .65 * Math.min(1, f.g * 2.4) : .2, sw: 1.6, dash: '1.6 3', cap: 'round' })
    })
  }
  return s
}
/* in the head: the colours of what comes in, before the m and the s */
function busHead (kind) {
  if (!kind) return ''
  const L = rowTops()
  let s = ''
  L.r.forEach((i, k) => { const b = S.tracks[i]; if (b.kind !== 'bus') return; const y = TY + L.tops[k] - VY, rh = rowH(i), F = busFeeders(b).slice(0, 8); F.forEach((f, j) => { s += R(176 - (F.length - j) * 7, y + rh / 2 - 2.5, 5, 5, { fill: f.t.c }) }) })
  return s
}
