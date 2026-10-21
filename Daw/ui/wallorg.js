/* ── the wall, kept in order (his asks, 2026-10-20: patching should go faster) ──
   A plain drag on the wall's ground chooses everything it passes over (option held, the ground is moved instead, as a drag
   on it did before); shift and a press adds a thing to what is chosen, or takes it away. What is chosen moves together.
   Command and a press on a thing: it is bypassed, or back on. Control and a press on a thing: it is taken off its wires —
   what fed it feeds what it fed, so the way goes on without it — and stays where it stands.
   The other button on the ground, or on something chosen: organize, and bypass all (what is chosen, else everything).
   Organize lays the way out from in to out as it is wired: one column for each step along it, so that what follows one
   thing stands on that thing's line (in a row, one height) and what runs side by side stands one under the other; the
   things are seen moving there, the wires with them. What is not on the way from in stands in a row under it, and what
   plays other prints' hands stands over what it plays.
   This script is read after wall.js, ctl.js and study.js: it holds the wall's hands before theirs. */
const WALLORG = { many: new Set(), band: null, ctlAt: 0, anim: 0 }
const wallOrgMany = t => (WALL.g && t && WALL.g.id === t.id ? WALLORG.many : new Set())
/* a thing taken off its wires, left standing: when one way fed it, that way now goes on to what it fed (as wallTake heals) */
function wallLoose (t, id) {
  const w = wallOf(t), node = wallNode(w, id)
  if (!node) return
  const ins = w.wires.filter(e => e.to === id && !e.in && !wallCtl(e)), outs = w.wires.filter(e => e.from === id && !wallCtl(e)), keys = w.wires.filter(e => e.to === id && e.in)
  if (!ins.length && !outs.length && !keys.length) return
  w.wires = w.wires.filter(e => !((e.from === id || e.to === id) && !wallCtl(e)))
  if (ins.length === 1) for (const o of outs) if (o.to !== ins[0].from && !w.wires.some(e => e.from === ins[0].from && e.to === o.to && (e.port || 0) === (ins[0].port || 0) && !e.in)) w.wires.push({ from: ins[0].from, to: o.to, gain: o.gain, port: ins[0].port || 0 })
  for (const o of outs) wallShares(w, o.to)
  wallPush(t)
}
/* bypassed, or back on: a plug-in from outside is stepped past by the app; a print by its own switch (a mix, a gain, a
   splitter and the prints that play hands have none) */
const wallCanBypass = node => node.k === 'plug' ? !!(node.ins && node.ins.uid && !node.ins.out) : !PC.isUtilityType(WALL_TYPE[node.k]) && !PC.isControlType(WALL_TYPE[node.k]) && node.k !== 'side' && node.k !== 'meter'
const wallIsBypassed = node => node.k === 'plug' ? !!(node.ins && node.ins.off) : !!node.bypass
function wallSetBypass (t, node, off) {
  if (!wallCanBypass(node)) return
  if (node.k === 'plug') { node.ins.off = off; if (NAT) NAT.call('bypass', { track: t.id, uid: node.ins.uid, off: off ? 1 : 0 }) }
  else node.bypass = off
}
function wallBypassAll (t, ids) {
  const w = wallOf(t), list = w.nodes.filter(q => (!ids || ids.has(q.id)) && wallCanBypass(q))
  if (!list.length) return
  const off = !list.every(wallIsBypassed)                                                // (all of them off already: all back on)
  for (const q of list) wallSetBypass(t, q, off)
  wallPush(t); uiDirty('dock')
}

/* ── organize: where each thing goes ── */
function wallLayout (w) {
  const sound = w.wires.filter(e => !wallCtl(e) && !e.in), ctlNode = q => PC.isControlType(WALL_TYPE[q.k])
  const main = w.nodes.filter(q => !ctlNode(q))
  /* how many steps from in, along the longest way (the wall is never wired round in a ring) */
  const depth = new Map([[WALL_IN, 0]])
  for (let round = 0; round <= main.length + 1; round++) {
    let moved = false
    for (const e of sound) { if (e.to === WALL_OUT || !depth.has(e.from)) continue; const d = depth.get(e.from) + 1; if (!(depth.get(e.to) >= d)) { depth.set(e.to, d); moved = true } }
    if (!moved) break
  }
  const on = main.filter(q => depth.has(q.id)), off = main.filter(q => !depth.has(q.id)), D = Math.max(0, ...on.map(q => depth.get(q.id)))
  const at = new Map(), span = Math.max(WALL_STEP * (D + 1), w.out.x - w.in.x), dx = span / (D + 1)
  const out = { x: Math.round(w.in.x + span), y: w.in.y }
  const yOf = id => id === WALL_IN ? w.in.y : at.has(id) ? at.get(id).y : (wallNode(w, id) || w.in).y
  /* column by column: each thing at the height of what feeds it (the middle of them, when several do); those of one column
     that would stand on one another are spread apart, in the order of the ports and heights that feed them */
  const GAP = 124
  for (let d = 1; d <= D; d++) {
    const col = on.filter(q => depth.get(q.id) === d).map(q => {
      const feeds = sound.filter(e => e.to === q.id && (e.from === WALL_IN || depth.has(e.from)))
      const want = feeds.length ? feeds.reduce((a, e) => a + yOf(e.from), 0) / feeds.length : w.in.y
      const order = feeds.length ? Math.min(...feeds.map(e => yOf(e.from) * 10 + (e.port || 0))) : 0
      return { q, want, order }
    }).sort((a, b) => a.want - b.want || a.order - b.order || a.q.y - b.q.y || a.q.id - b.q.id)
    const ys = col.map(c => c.want)
    for (let i = 1; i < ys.length; i++) if (ys[i] < ys[i - 1] + GAP) ys[i] = ys[i - 1] + GAP
    const shift = col.length ? col.reduce((a, c) => a + c.want, 0) / col.length - ys.reduce((a, y) => a + y, 0) / ys.length : 0
    col.forEach((c, i) => at.set(c.q.id, { x: Math.round(w.in.x + dx * d), y: Math.round(ys[i] + shift) }))
  }
  const placed = [...at.values()], top = Math.min(w.in.y, ...placed.map(p => p.y)), bottom = Math.max(w.in.y, ...placed.map(p => p.y))
  /* what is not on the way from in: a row under it */
  off.sort((a, b) => a.x - b.x || a.id - b.id).forEach((q, i) => at.set(q.id, { x: Math.round(w.in.x + WALL_STEP * (i + 1)), y: Math.round(bottom + 150) }))
  /* what plays hands: over what it plays, along a row of its own */
  const ctl = w.nodes.filter(ctlNode).map(q => {
    const plays = w.wires.filter(e => e.from === q.id && wallCtl(e)).map(e => at.get(e.to) || wallNode(w, e.to)).filter(Boolean)
    return { q, x: plays.length ? plays.reduce((a, p) => a + p.x, 0) / plays.length : q.x }
  }).sort((a, b) => a.x - b.x || a.q.id - b.q.id)
  let last = -Infinity
  for (const c of ctl) { const x = Math.max(c.x, last + 96); last = x; at.set(c.q.id, { x: Math.round(x), y: Math.round(top - 130) }) }
  return { at, out }
}
/* seen moving there: the things, out, and the view with them, over half a second */
function wallOrganize (t, ids) {
  const w = wallOf(t), g = WALL.g
  if (!w || !g) return
  const { at, out } = wallLayout(w), moving = w.nodes.filter(q => (!ids || ids.has(q.id)) && at.has(q.id))
  const from = new Map(moving.map(q => [q.id, { x: q.x, y: q.y }])), out0 = { x: w.out.x, y: w.out.y }
  const outTo = !ids || ids.size >= w.nodes.length ? out : { x: Math.max(w.out.x, out.x), y: w.out.y }      // (out comes along when the whole wall is put in order)
  /* the view the wall will be seen at, once it is there */
  const end = { nodes: w.nodes.map(q => Object.assign({}, q, at.has(q.id) && from.has(q.id) ? at.get(q.id) : null)), in: w.in, out: outTo, z: 0 }
  wallFit(end, g)
  const v0 = { z: w.z, ox: w.ox, oy: w.oy }, t0 = performance.now(), run = ++WALLORG.anim, MS = 520
  const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
  /* the next frame — or a moment, where the window is not drawn (hidden behind another, it gets no frames) */
  const next = f => { let gone = false; const go = () => { if (!gone) { gone = true; f(performance.now()) } }; requestAnimationFrame(go); setTimeout(go, 40) }
  const step = now => {
    if (run !== WALLORG.anim) return
    const k = clamp((now - t0) / MS, 0, 1), e = ease(k)
    for (const q of moving) { const a = from.get(q.id), b = at.get(q.id); q.x = a.x + (b.x - a.x) * e; q.y = a.y + (b.y - a.y) * e }
    w.out.x = out0.x + (outTo.x - out0.x) * e; w.out.y = out0.y + (outTo.y - out0.y) * e
    w.z = v0.z + (end.z - v0.z) * e; w.ox = v0.ox + (end.ox - v0.ox) * e; w.oy = v0.oy + (end.oy - v0.oy) * e
    if (k >= 1) { for (const q of moving) { q.x = Math.round(q.x); q.y = Math.round(q.y) } w.out.x = Math.round(w.out.x); w.out.y = Math.round(w.out.y) }
    uiDirty('dock')
    if (k < 1) next(step)
  }
  next(step)
}
/* the other button on one thing: taken off its wires, bypassed (or back on), deleted — and what a plug-in from outside
   listens to, as that button used to give */
function wallNodeMenu (t, node, x, y) {
  const w = wallOf(t), wired = w.wires.some(e => (e.from === node.id || e.to === node.id) && !wallCtl(e)), can = wallCanBypass(node), id = node.id
  WALL.sel = { t: t.id, node: id }; S.focus = 'wall'; uiDirty('dock')
  const items = [{ t: 'disconnect', v: 'loose', dim: !wired }, { t: 'bypass', v: 'by', on: can && wallIsBypassed(node), dim: !can }, { t: 'delete', v: 'del', k: '⌫' }]
  if (node.k === 'plug' && node.ins && typeof openKeyMenu === 'function') items.push({ t: 'what it listens to', v: 'key', sep: true })
  openMenu(x, y, items, it => {
    const nd = wallNode(wallOf(t), id)
    if (!nd) return
    if (it.v === 'loose') wallLoose(t, id)
    else if (it.v === 'by') { wallSetBypass(t, nd, !wallIsBypassed(nd)); wallPush(t) }
    else if (it.v === 'del') wallRemove(t, nd)
    else if (it.v === 'key') openKeyMenu(t, t.inserts.indexOf(nd.ins), x, y)
    uiDirty('dock')
  }, { w: 150 })
}
function wallOrgMenu (t, x, y) {
  const w = wallOf(t), many = wallOrgMany(t), ids = many.size ? new Set(many) : null
  const list = w.nodes.filter(q => (!ids || ids.has(q.id)) && wallCanBypass(q)), allOff = list.length > 0 && list.every(wallIsBypassed)
  openMenu(x, y, [{ t: 'organize', v: 'org' }, { t: 'bypass all', v: 'by', on: allOff }], it => { if (it.v === 'org') wallOrganize(t, ids); else wallBypassAll(t, ids) }, { w: 128 })
}

/* ── joined to the wall ── */
{
  const down0 = wallDown, move0 = wallMove, up0 = wallUp, patch0 = pPatch, context0 = onContext
  wallDown = function (e) {
    const el = e.target.closest ? e.target.closest('[data-a]') : null
    if (!el || el.dataset.a !== 'wall') return down0(e)
    const k = el.dataset.k, id = el.dataset.id == null ? null : +el.dataset.id, t = wallTrack(), w = t && wallOf(t), g = WALL.g
    if (!w || !g) return down0(e)
    const node = (k === 'node' || k === 'cap') && id != null && id >= 0 ? wallNode(w, id) : null, p = pt(e)
    const done = () => { e.preventDefault(); if (S.menu) { S.menu = null; uiDirty('menu') } S.focus = 'wall'; uiDirty('dock'); return true }
    if (node && e.ctrlKey) { WALLORG.ctlAt = performance.now(); wallLoose(t, id); WALL.sel = { t: t.id, node: id }; return done() }      // control: off its wires
    if (e.button === 2) return down0(e)
    if (node && e.metaKey) { wallSetBypass(t, node, !wallIsBypassed(node)); wallPush(t); WALL.sel = { t: t.id, node: id }; return done() }      // command: bypassed, or back on
    if (node && e.shiftKey) { if (WALLORG.many.has(id)) WALLORG.many.delete(id); else { if (WALL.sel && WALL.sel.node != null && WALL.sel.node !== id && !WALLORG.many.size) WALLORG.many.add(WALL.sel.node); WALLORG.many.add(id) } WALL.sel = { t: t.id, node: id }; return done() }
    if (k === 'bg' && !e.altKey) {
      const now = performance.now(), twice = now - (WALLORG.bgAt || 0) < 380
      WALLORG.bgAt = now
      if (!twice) {                                                                        // a band over the ground (twice on it: the wall is fitted to the panel, as it was)
        if (typeof studyClose === 'function') studyClose()
        WALL.sel = null
        const q = wallToWorld(w, g, p)
        WALL.drag = { k: 'band', p0: p, q0: q, moved: false, base: e.shiftKey ? [...WALLORG.many] : [] }
        try { svg.setPointerCapture(e.pointerId) } catch (err) {}
        return done()
      }
      WALLORG.many.clear(); WALL.drag = null; w.z = 0
      return done()
    }
    if (k === 'bg' && e.altKey) WALLORG.many.clear()
    if (node && !WALLORG.many.has(id)) WALLORG.many.clear()
    const r = down0(e)
    /* something chosen with others, taken hold of: they all go with it */
    const d = WALL.drag
    if (d && d.k === 'move' && d.id >= 0 && WALLORG.many.has(d.id) && WALLORG.many.size > 1) d.group = new Map(w.nodes.filter(q => WALLORG.many.has(q.id)).map(q => [q.id, { x: q.x, y: q.y }]))
    return r
  }
  wallMove = function (e) {
    const d = WALL.drag, t = wallTrack(), w = t && wallOf(t), g = WALL.g
    if (d && d.k === 'band' && w && g) {
      const p = pt(e), q = wallToWorld(w, g, p)
      if (Math.hypot(p.x - d.p0.x, p.y - d.p0.y) > 3) d.moved = true
      if (!d.moved) return
      const x0 = Math.min(d.q0.x, q.x), x1 = Math.max(d.q0.x, q.x), y0 = Math.min(d.q0.y, q.y), y1 = Math.max(d.q0.y, q.y)
      WALLORG.band = { x0, y0, x1, y1 }
      WALLORG.many = new Set(d.base.concat(w.nodes.filter(nd => nd.x + 20 >= x0 && nd.x - 20 <= x1 && nd.y + 20 >= y0 && nd.y - 20 <= y1).map(nd => nd.id)))      // (a thing the band reaches a good way into)
      uiDirty('dock')
      return
    }
    const r = move0(e)
    if (d && d.group && d.moved && w) { const lead = wallNode(w, d.id), o = d.group.get(d.id); if (lead && o) { const dx = lead.x - o.x, dy = lead.y - o.y; for (const [id, p] of d.group) { if (id === d.id) continue; const q = wallNode(w, id); if (q) { q.x = Math.round(p.x + dx); q.y = Math.round(p.y + dy) } } uiDirty('dock') } }
    return r
  }
  wallUp = function () {
    const d = WALL.drag
    if (d && d.k === 'band') { WALL.drag = null; WALLORG.band = null; if (!d.moved) WALLORG.many.clear(); uiDirty('dock'); return }
    if (d && d.group && d.moved) d.study = false                                           // (a group carried: no study opens)
    return up0()
  }
  /* drawn over the wall: the band, and a mark round each thing chosen with others */
  pPatch = function (y, h) {
    let s = patch0(y, h)
    const t = wallTrack(), w = t && wallOf(t), g = WALL.g
    if (!w || !g || g.id !== t.id || (!WALLORG.band && !WALLORG.many.size)) return s
    for (const id of [...WALLORG.many]) if (!wallNode(w, id)) WALLORG.many.delete(id)
    const v = wallView(w, g)
    let a = ''
    for (const id of WALLORG.many) { const q = wallNode(w, id); if (!q) continue; a += q.k === 'plug' ? R(q.x - 38.5, q.y - 38.5, 77, 77, { rx: 3, stroke: INK, sa: .7, dash: '2 3' }) : Cc(q.x, q.y, WALL_R * (PC.isControlType(WALL_TYPE[q.k]) ? .6 : 1) + 7, { stroke: INK, sa: .7, dash: '2 3' }) }
    const b = WALLORG.band
    if (b) a += R(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, { fill: INK, fa: .05, stroke: INK, sa: .5, dash: '3 3' })
    const cid = 'wo' + (++UID)
    return s + `<clipPath id="${cid}"><rect x="0" y="${n(g.y)}" width="${n(g.w)}" height="${n(g.h - 26)}"/></clipPath>` + G(G(a, `translate(${n(v.tx)} ${n(v.ty)}) scale(${n(v.z)})`), '', ` clip-path="url(#${cid})" pointer-events="none"`)
  }
  /* the other button (or control and a press, as a Mac has it) */
  onContext = function (e) {
    const el = e.target.closest ? e.target.closest('[data-a="wall"]') : null
    if (!el) return context0(e)
    const t = wallTrack(), w = t && wallOf(t), k = el.dataset.k, id = el.dataset.id == null ? null : +el.dataset.id, node = w && (k === 'node' || k === 'cap') && id != null && id >= 0 ? wallNode(w, id) : null
    if (!w) return context0(e)
    if (node && e.ctrlKey) { e.preventDefault(); if (performance.now() - WALLORG.ctlAt > 600) { wallLoose(t, id); uiDirty('dock') } return }      // (control and a press was the wires': no list)
    if (k === 'bg' || (node && WALLORG.many.has(id) && WALLORG.many.size > 1)) { e.preventDefault(); const p = pt(e); wallOrgMenu(t, p.x, p.y); return }
    if (node) { e.preventDefault(); const p = pt(e); wallNodeMenu(t, node, p.x, p.y); return }      // a thing by itself: disconnect, bypass, delete (his ask, 2026-10-22)
    return context0(e)
  }
  /* the delete key, with several chosen: all of them go */
  for (const code of ['Backspace', 'Delete']) { const k0 = KEYS[code]; KEYS[code] = () => { const t = wallTrack(), w = t && wallOf(t); if (S.focus !== 'wall' || !w || !(S.panel.on && S.panel.tab === 'patch') || WALLORG.many.size < 2) return k0(); for (const id of [...WALLORG.many]) { const q = wallNode(w, id); if (q) wallRemove(t, q) } WALLORG.many.clear(); uiDirty('dock') } }
}
