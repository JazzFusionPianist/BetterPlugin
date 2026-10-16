/* Slur Studio, macros in the patch panel: draft 1 (2026-10-15).
   He asked: a plug-in from outside on a wall shows only its name in the automation list, not its knobs. Instead: macros
   made in the patch panel; a macro is wired to a plug-in on the wall, and a small panel lists that plug-in's controls;
   the one picked is what the macro turns from then on, and the macro takes its name. In the automation view a track's
   lines are its macros, by those names.
   Drawn over the room's own page: a column of macros at the left of the wall (st.macros), a wire being drawn from one
   (st.drag), the small panel of a plug-in's controls (st.list). */
const MAC_W = 96
function macroKnob (x, y, m, sel) {
  const r = 15, a0 = Math.PI * .75, a1 = a0 + Math.PI * 1.5 * m.v
  const arc = (from, to, rr) => `M${n(x + Math.cos(from) * rr)} ${n(y + Math.sin(from) * rr)}A${rr} ${rr} 0 ${to - from > Math.PI ? 1 : 0} 1 ${n(x + Math.cos(to) * rr)} ${n(y + Math.sin(to) * rr)}`
  let s = Cc(x, y, r, { fill: K3, stroke: INK, sa: sel ? .7 : .3 })
  s += P(arc(a0, a0 + Math.PI * 1.5, r + 4), { stroke: INK, sa: .14, sw: 2, cap: 'round' })
  if (m.v > .01) s += P(arc(a0, a1, r + 4), { stroke: m.to ? INK : INK, sa: m.to ? .9 : .4, sw: 2, cap: 'round' })
  s += P(`M${n(x + Math.cos(a1) * 5)} ${n(y + Math.sin(a1) * 5)}L${n(x + Math.cos(a1) * (r - 3))} ${n(y + Math.sin(a1) * (r - 3))}`, { stroke: INK, sw: 1.6, cap: 'round' })
  s += Cc(x + r + 10, y, 2.2, { fill: INK })                                             // its port: a wire is drawn from here to a plug-in
  s += T(x, y + r + 16, fit(m.to ? m.to.name : m.name, MAC_W - 10, 10, 500), { size: 10, w: 500, anchor: 'middle', a: m.to ? 1 : .6 })
  s += T(x, y + r + 28, m.to ? fit(m.to.plug, MAC_W - 10, 9) : 'not wired', { size: 9, a: .42, anchor: 'middle', it: !m.to })
  if (sel) s += R(x - MAC_W / 2 + 6.5, y - r - 8.5, MAC_W - 13, 2 * r + 46, { rx: 3, stroke: INK, sa: .5, dash: '2 3' })
  return s
}
function macroDraft (st) {
  const g = WALL.g, t = wallTrack(), w = wallOf(t)
  if (!g || !w) return ''
  const v = wallView(w, g), at = node => ({ x: v.tx + node.x * v.z, y: v.ty + node.y * v.z })
  let s = R(0, g.y, MAC_W, g.h - 26, { fill: K1 }) + P(`M${MAC_W - .5} ${g.y}V${g.y + g.h - 26}`, { stroke: INK, sa: .08 })
  s += T(12, g.y + 18, 'macros', { size: 9.5, a: .42 }) + key(MAC_W - 12 - keyW('+', {}), g.y + 5, '+', {})[0]      // (a new macro)
  const ys = st.macros.map((m, k) => g.y + 52 + k * 72)
  st.macros.forEach((m, k) => {
    s += macroKnob(MAC_W / 2 - 6, ys[k], m, st.sel === k)
    const node = m.to && w.nodes.find(q => q.k === 'plug' && q.ins && q.ins.name.toLowerCase().startsWith(m.to.plug))
    if (node && !st.hideLinks) { const p = at(node), a = { x: MAC_W / 2 - 6 + 25, y: ys[k] }, b = { x: p.x - 34 * v.z, y: p.y - 18 * v.z }; s += P(`M${n(a.x)} ${n(a.y)}C${n(a.x + 90)} ${n(a.y)} ${n(b.x - 90)} ${n(b.y)} ${n(b.x)} ${n(b.y)}`, { stroke: INK, sa: .22, dash: '3 4' }) + Cc(b.x, b.y, 2.2, { fill: INK, fa: .5 }) }
  })
  if (st.drag != null) {
    const k = st.drag, node = w.nodes.find(q => q.k === 'plug' && q.ins && q.ins.name.toLowerCase().startsWith(st.dragTo)), p = at(node), a = { x: MAC_W / 2 - 6 + 25, y: ys[k] }, b = { x: p.x - 10, y: p.y + 6 }
    s += P(`M${n(a.x)} ${n(a.y)}C${n(a.x + 90)} ${n(a.y)} ${n(b.x - 90)} ${n(b.y)} ${n(b.x)} ${n(b.y)}`, { stroke: INK, sw: 1.4 }) + Cc(p.x, p.y, 32 * v.z + 9, { stroke: INK, sa: .9 })
  }
  if (st.list) {
    const node = w.nodes.find(q => q.k === 'plug' && q.ins && q.ins.name.toLowerCase().startsWith(st.list.plug)), p = at(node), lw = 236, rh = 21, rows = st.list.rows, lx = Math.round(p.x + 34 * v.z + 14), ly = Math.round(Math.max(g.y + 8, p.y - 70)), lh = 30 + 30 + rows.length * rh + 26
    s += R(lx + .5, ly + .5, lw - 1, lh - 1, { rx: 2, fill: K2, stroke: INK, sa: .3 })
    s += T(lx + 12, ly + 19, st.list.plug, { size: 10.5, w: 500 }) + T(lx + lw - 12, ly + 19, `to ${st.macros[st.list.k].name}`, { size: 9.5, a: .42, anchor: 'end' })
    s += R(lx + 10.5, ly + 30.5, lw - 21, 21, { rx: 1.5, fill: K0, stroke: INK, sa: .22 }) + T(lx + 18, ly + 45, st.list.q || 'find a control', { size: 10, a: st.list.q ? .9 : .38, it: !st.list.q })
    rows.forEach(([nm, val], i) => { const yy = ly + 60 + i * rh; if (i === st.list.hover) s += R(lx + 1, yy, lw - 2, rh, { fill: INK, fa: .06 }); s += T(lx + 12, yy + 14.5, nm, { size: 10.5, a: i === st.list.hover ? 1 : .78 }) + T(lx + lw - 12, yy + 14.5, val, { size: 9.5, a: .46, anchor: 'end' }) })
    s += hline(lx + 1, lx + lw - 1, ly + 60 + rows.length * rh + 4, .14) + T(lx + 12, ly + lh - 9, st.list.count, { size: 9, a: .42 })
  }
  return s
}
