/* Slur Studio, a patch kept as a preset: draft 1 (2026-10-13).
   He asked for Patch on Slur's own way of keeping a patch, inside the patch panel: the same bar (the one before, the name
   with its list, the one after), the same list (initial; the kept ones, each with remove; save, save as…, open…), the same
   files in the same folder (~/Library/Application Support/Orb/Sounds/Presets/<name>.orbpatch), so a patch kept in one is
   there in the other. The bar stands in the panel's head, over the middle of the wall.
     st = { name, dirty, open, list: [names], on, sure, hover }  */
function presetBar (st) {
  const y = BY, by = y + 16.6, cw = RX - SIDE, bw = 196, x = Math.round(cw / 2 - bw / 2), name = st.name || 'untitled'
  const chev = (cx, dir) => P(`M${n(cx - dir * 2)} ${n(y + 9)}L${n(cx + dir * 2)} ${n(y + 13)}L${n(cx - dir * 2)} ${n(y + 17)}`, { stroke: INK, sa: .5, sw: 1.1, cap: 'round' })
  let s = chev(x - 12, -1) + chev(x + bw + 12, 1)
  s += R(x + .5, y + 4.5, bw - 1, 17, { rx: 1.5, fill: st.open ? K3 : K2, stroke: INK, sa: st.open ? .42 : .22 })
  s += T(x + 9, by, fit(asGiven(name + (st.dirty ? ' *' : '')), bw - 30, 10.5, 500), { size: 10.5, w: 500, a: .88 }) + caret(x + bw - 11, y + 13, .5)
  if (!st.open) return s
  const rows = st.list || [], rh = 22, lw = 250, lx = Math.round(cw / 2 - lw / 2), ly = y + 26 + 3, lh = 8 + rh + 9 + Math.max(1, rows.length) * rh + 9 + 26
  s += R(lx + .5, ly + .5, lw - 1, lh - 1, { rx: 2, fill: K2, stroke: INK, sa: .3 })
  let yy = ly + 4
  s += T(lx + 12, yy + 15, 'initial', { size: 10.5, it: true, a: st.on === 'initial' ? 1 : .7 }); yy += rh
  s += hline(lx + 10, lx + lw - 10, yy + 4, .14); yy += 9
  if (!rows.length) { s += T(lx + 12, yy + 15, 'no presets yet', { size: 10.5, it: true, a: .42 }); yy += rh }
  for (const nm of rows) {
    const on = st.on === nm, hov = st.hover === nm
    if (hov) s += R(lx + 1, yy, lw - 2, rh, { fill: INK, fa: .05 })
    s += T(lx + 12, yy + 15, asGiven(nm), { size: 10.5, w: on ? 500 : 400, a: on ? 1 : .7 })
    s += T(lx + lw - 12, yy + 15, st.sure === nm ? 'sure?' : 'remove', { size: 9.5, a: st.sure === nm ? .9 : hov ? .6 : .34, anchor: 'end' })
    yy += rh
  }
  s += hline(lx + 1, lx + lw - 1, yy + 4, .14); yy += 9
  let ax = lx + 12
  for (const [w, live] of [['save', st.on && st.on !== 'initial'], ['save as…', true], ['open…', true]]) { if (!live) continue; s += T(ax, yy + 15, w, { size: 10.5, a: .88 }); ax += tw(w, 10.5) + 16 }
  return s
}
