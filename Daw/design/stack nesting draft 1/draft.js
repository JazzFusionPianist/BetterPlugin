/* Slur Studio, a stack that holds its tracks: draft 1 (2026-10-12).
   Today a track in a stack stands twelve units to the right of its stack and nothing else says it is inside. Three ways
   to make it look held, drawn over the room's own page (draft.mjs puts pHeadDraft in the place of ui.js's pHead):
     a  the spine   the stack's colour runs down the left edge of everything in it; each track's own colour moves inside
     b  the tray    the stack and its tracks lie in one outlined tray, the stack's row its lid
     c  the bracket a line comes down from the stack's arrow and reaches out to each track
   The rows are ui.js's headRow, with only what each way changes. */
function stackSpans () {                                    // every open stack on show: its row's top, and how many of its tracks follow it
  const vis = rows(), rh = S.rh, out = []
  vis.forEach((i, k) => { const t = S.tracks[i]; if (t.kind !== 'stack' || !t.open) return; let n = 0; while (k + 1 + n < vis.length && S.tracks[vis[k + 1 + n]].parent === t.id) n++; if (n) out.push({ t, y: TY + k * rh - VY, n }) })
  return out
}
function headRowDraft (i, kind) {
  const t = S.tracks[i], rh = S.rh, y = rowY(i), sel = isChosen(i), stack = t.kind === 'stack', par = t.parent != null ? byId(t.parent) : null, by = y + rh / 2 + 3.9
  const x0 = kind === 'a' ? (par ? 58 : 42) : kind === 'b' ? (par ? 60 : stack ? 54 : 42) : (par ? 58 : 42), tri = kind === 'b' ? 43 : 34
  let s = ''
  if (kind === 'a' && par) s += R(3, y, HEAD_W - 3, rh, { fill: K0, fa: .55 })
  if (sel) s += R(0, y, HEAD_W, rh, { fill: INK, fa: .075 })
  if (kind === 'a' && par) s += R(0, y, 3, rh, { fill: par.c }) + R(44, y + 5, 3, rh - 10, { fill: t.c, fa: t.mute ? .4 : 1 })
  else if (kind === 'a' && stack && t.open) s += R(0, y, 3, rh, { fill: t.c })
  else if (kind === 'b' && par) s += R(0, y, 3, rh - 1, { fill: t.c, fa: t.mute ? .4 : 1 })
  else s += R(0, y, 3, rh - 1, { fill: t.c, fa: t.mute ? .4 : 1 })
  s += T(25, by - .4, pad2(i + 1), { size: 8.5, a: sel ? .8 : .32, anchor: 'end' })
  if (stack) s += triMark(tri, by - 4, t.open, .62)
  const its = cellsOf(t), cw = 15, cx = 214 - its.length * cw
  const tag = t.theirs || (t.kind === 'bus' ? 'bus' : ''), tagW = tag ? tw(tag, 9, 400, !!t.theirs) + 6 : 0, wt = stack || sel ? 500 : 400
  const nm = fit(asGiven(t.name), cx - 8 - x0 - tagW, 10.5, wt)
  s += T(x0, by, nm, { size: 10.5, w: wt, a: t.mute ? .42 : sel ? 1 : .88 })
  if (tag) s += T(x0 + tw(nm, 10.5, wt) + 6, by, tag, { size: 9, it: !!t.theirs, a: .4 })
  s += miniCells(cx, y + rh / 2 - 7, its, cw, 14, 8.5, i)
  const vol = shown(t, 'vol')
  s += levelBar(HEAD_FX, y + rh / 2 - 1, HEAD_FW, t, vol) + T(HEAD_W - 8, by - .4, fmtDb(vol), { size: 9, a: sel ? .9 : .56, anchor: 'end' })
  const inTray = kind === 'b' && (par || (stack && t.open))
  return s + (inTray ? hline(33, HEAD_W - 5, y + rh - .5, .05) : hline(0, HEAD_W, y + rh - .5, stack ? .09 : .05))
}
function pHeadDraft (kind) {
  const vis = rows(), rh = S.rh, spans = stackSpans()
  let s = ''
  if (kind === 'b') for (const sp of spans) {
    const x = 31, w = HEAD_W - x - 4, yy = sp.y + 2, hh = (sp.n + 1) * rh - 5
    s += R(x, yy, w, hh, { rx: 4, fill: K0 }) + R(x + 1, yy + 1, w - 2, rh - 4, { rx: 3, fill: K3, fa: .9 }) + R(x + .5, yy + .5, w - 1, hh - 1, { rx: 4, stroke: INK, sa: .2 })
  }
  vis.forEach((i, k) => { const y = TY + k * rh - VY; if (y + rh > TY && y < BY) s += `<g id="hd-${i}">${headRowDraft(i, kind)}</g>` })
  if (kind === 'a') for (const sp of spans) s += R(0, sp.y + (sp.n + 1) * rh - 1, 3, 1, { fill: K1 })
  if (kind === 'c') for (const sp of spans) {
    const x = 34.5, top = sp.y + rh / 2 + 7, last = sp.y + sp.n * rh + rh / 2
    let d = `M${x} ${top}V${last - 4}Q${x} ${last} ${x + 4} ${last}H49`
    for (let k = 1; k < sp.n; k++) d += `M${x} ${sp.y + k * rh + rh / 2}H49`
    s += P(d, { stroke: INK, sa: .34 })
  }
  return s
}
