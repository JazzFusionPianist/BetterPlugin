/* ── the prints that play other prints' hands: lfo, drift, pulse, macro, follow, env, scene ──
   As on Patch on Slur's wall: a wire drawn from one of them is a control wire. Held over a print, the print shows the hands
   it can be played on, as words round its middle (its big hand first: what Patch on Slur's catalog, PLAY_HANDS, lists for
   it; a mix's are its wires' shares, the bands' their cuts); let go on a word, the wire lands on that hand. A control wire
   is drawn dashed into the print, to where its hand's word stands, with the word beside it. A macro let go on a hand an lfo
   already plays takes over that play's depth (a wire onto the wire). Chosen, a control wire's foot says what it plays, how
   deep (a hundred is the hand's whole travel) and which way: as its print goes (an lfo both ways round the setting, a macro
   or a follow one way from it), one way, or both ways. The engine plays them (orbfx::Modulator, Patch on Slur's own).
   Read after wall.js, side.js and macro.js, before study.js. */
const CTL = { reveal: null, hand: null }
/* the hands a control wire may land on, on this print, in the order they stand round it */
function ctlHands (w, node) {
  if (!node || node.k === 'plug' || node.k === 'meter') return []
  if (node.k === 'mix') return w.wires.filter(e => e.to === node.id && !wallCtl(e) && !e.in).map(e => ({ key: `share:${e.from}`, label: e.from === WALL_IN ? 'in' : wallName(wallNode(w, e.from) || { k: '?' }) }))
  if (node.k === 'bands') return PC.crossovers(node.aux || []).map((hz, k) => ({ key: `aux${k}`, label: `${wallSaid(PC.fmtHz(hz))} hz` }))
  return PC.handsOfType(WALL_TYPE[node.k]).map(h => ({ key: h.key, label: wallSaid(h.label) }))
}
const ctlHandLabel = (w, node, key) => { const m = /^wire:(-?\d+):(.+)$/.exec(key); if (m) return `${ctlHandLabel(w, node, m[2])} depth`; const h = ctlHands(w, node).find(x => x.key === key); return h ? h.label : key }
/* where a hand's word stands inside its print (round the middle, the first at the top), in the wall's own units */
function ctlHandAt (w, node, key) {
  const all = ctlHands(w, node), N = all.length, k = Math.max(0, all.findIndex(h => h.key === key))
  const a = N <= 1 ? 0 : k / N * Math.PI * 2 - Math.PI / 2, r = N <= 1 ? 0 : N === 2 ? WALL_R * .36 : WALL_R * .5
  return { x: node.x + r * Math.cos(a), y: node.y + r * Math.sin(a) }
}
/* where a control wire lands: on its hand, or (a wire onto a wire) half way along the wire whose depth it sets */
function ctlLanding (w, e) {
  const node = wallNode(w, e.to), m = /^wire:(-?\d+):(.+)$/.exec(e.hand)
  if (!node) return null
  if (!m) return ctlHandAt(w, node, e.hand)
  const under = w.wires.find(x => wallCtl(x) && x.from === +m[1] && x.to === e.to && x.hand === m[2])
  if (!under) return ctlHandAt(w, node, m[2])
  const a = wallOutPort(w, under.from, under.port), b = ctlHandAt(w, node, under.hand)
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + 4 }
}
/* which way a control wire pushes: 0 as its print goes, 1 one way from the setting, 2 both ways round it */
const CTL_WAYS = ['as it goes', 'one way', 'both ways']
const ctlBoth = (w, e) => { const src = wallNode(w, e.from); return e.pol === 2 || (!(e.pol || 0) && !!src && ['lfo', 'drift'].includes(src.k)) }
/* a control wire, landed: the hand it plays (one play of a hand by one print; a macro on a hand already played sets that play's depth) */
function ctlConnect (t, from, to, hand) {
  const w = wallOf(t), src = wallNode(w, from)
  if (!src || from === to) return false
  if (src.k === 'macro') {
    const played = w.wires.find(e => wallCtl(e) && e.to === to && e.hand === hand && ['lfo', 'drift', 'pulse', 'follow', 'env'].includes((wallNode(w, e.from) || {}).k))
    if (played) hand = `wire:${played.from}:${hand}`
  }
  if (w.wires.some(e => e.from === from && e.to === to && e.hand === hand)) return false
  w.wires.push({ from, to, gain: PC.newWireDepth(WALL_TYPE[src.k]), port: 0, hand, pol: 0 })
  WALL.sel = { t: t.id, wire: w.wires.length - 1 }
  wallPush(t)
  return true
}
{
  const patch0 = pPatch, move0 = wallMove, up0 = wallUp, foot0 = wallFoot, down0 = wallDown
  /* drawn over the wall, in its own place and scale: the control wires, and a print showing its hands under a wire in the air */
  pPatch = function (y, h) {
    let s = patch0(y, h)
    const t = wallTrack(), w = t && wallOf(t), g = WALL.g
    if (!w || !g || g.id !== t.id) return s
    const v = wallView(w, g), sel = WALL.sel && WALL.sel.t === t.id ? WALL.sel : null, d = WALL.drag
    let a = '', hits = ''
    w.wires.forEach((e, i) => {
      if (!wallCtl(e) || !wallNode(w, e.from) || !wallNode(w, e.to)) return
      const p0 = wallOutPort(w, e.from, e.port), p1 = ctlLanding(w, e)
      if (!p1) return
      const dd = wallCurve(p0, p1), chosen = sel && sel.wire === i, deep = Math.min(1, Math.abs(+e.gain || 0))
      a += P(dd, { stroke: INK, sa: chosen ? 1 : .32 + deep * .38, sw: chosen ? 1.5 : 1, dash: '3 3' }) + Cc(p0.x, p0.y, 2.2, { fill: INK }) + Cc(p1.x, p1.y, 2.6, { fill: INK, sa: 1 })
      if (!(d && d.ctl && CTL.reveal === e.to)) a += T((p0.x + p1.x) / 2 + 6, (p0.y + p1.y) / 2 + 3, asGiven(ctlHandLabel(w, wallNode(w, e.to), e.hand)), { size: 8.5, a: chosen ? .95 : .6 })      // (the hand's name rides beside the wire, half way, as on Patch on Slur's wall)
      hits += `<path d="${dd}" fill="none" stroke="#000" stroke-opacity="0" stroke-width="12" data-a="wall" data-k="wire" data-i="${i}" style="cursor:pointer"/>`
    })
    /* a wire in the air from a control print: the print under it shows its hands, the nearest word lit */
    if (d && d.k === 'wire' && d.ctl) {
      if (d.to) a += P(wallCurve(wallOutPort(w, d.from, d.port), CTL.hand ? CTL.hand.at : d.to), { stroke: INK, sa: .85, dash: '3 3' })
      const node = CTL.reveal != null ? wallNode(w, CTL.reveal) : null
      if (node) {
        a += Cc(node.x, node.y, WALL_R + 2, { fill: K1, fa: .86 })
        for (const hd of ctlHands(w, node)) {
          const q = ctlHandAt(w, node, hd.key), lit = CTL.hand && CTL.hand.key === hd.key, wd = tw(hd.label, 9) + 10
          a += R(q.x - wd / 2, q.y - 8, wd, 15, { rx: 2, fill: lit ? INK : K3, stroke: INK, sa: lit ? 1 : .35 }) + T(q.x, q.y + 3, asGiven(hd.label), { size: 9, w: lit ? 600 : 500, c: lit ? K1 : INK, a: lit ? 1 : .85, anchor: 'middle' })
        }
      }
    }
    if (!a) return s
    return s + `<clipPath id="ctl-clip"><rect x="0" y="${n(y)}" width="${n(g.w)}" height="${n(h - 26)}"/></clipPath>` + G(G(a + hits, `translate(${n(v.tx)} ${n(v.ty)}) scale(${n(v.z)})`), '', ' clip-path="url(#ctl-clip)"')
  }
  /* a wire drawn from a control print looks for a hand, not a way in */
  wallMove = function (e) {
    const r = move0(e), d = WALL.drag, t = wallTrack(), w = t && wallOf(t), g = WALL.g
    if (d && d.k === 'wire' && w && g) {
      const src = wallNode(w, d.from)
      d.ctl = wallPlays(src)
      if (d.ctl) {
        d.land = null; d.landIn = 0
        const q = d.to || wallToWorld(w, g, pt(e))
        const over = w.nodes.filter(x => x.id !== d.from && ctlHands(w, x).length).map(x => ({ x, dist: Math.hypot(x.x - q.x, x.y - q.y) })).filter(o => o.dist <= WALL_R + 8).sort((a, b) => a.dist - b.dist)[0]
        CTL.reveal = over ? over.x.id : null
        CTL.hand = null
        if (over) { let best = 1e9; for (const hd of ctlHands(w, over.x)) { const at = ctlHandAt(w, over.x, hd.key), dist = Math.hypot(at.x - q.x, at.y - q.y); if (dist < best) { best = dist; CTL.hand = { key: hd.key, at, node: over.x.id } } } }
        uiDirty('dock')
      }
    } else if (d && d.k === 'cdepth' && w) {
      const wire = w.wires[d.i]
      if (wire) { wire.gain = clamp(Math.round((d.v0 + (d.ly - pt(e).y) * (e.shiftKey ? .002 : .01)) * 100) / 100, -1, 1); wallPush(t); uiDirty('dock') }
    }
    return r
  }
  wallUp = function () {
    const d = WALL.drag, t = wallTrack()
    if (d && d.k === 'wire' && d.ctl) {
      WALL.drag = null
      const hand = CTL.hand
      CTL.reveal = null; CTL.hand = null
      if (hand && t) ctlConnect(t, d.from, hand.node, hand.key)
      uiDirty('dock')
      return
    }
    if (d && d.k === 'cdepth') { WALL.drag = null; if (t) wallPush(t); uiDirty('dock'); return }
    return up0()
  }
  /* a control wire chosen: what it plays, how deep, which way */
  wallFoot = function (t, w, y, cw, sel) {
    const e = sel && sel.wire != null ? w.wires[sel.wire] : null
    if (!e || !wallCtl(e)) return foot0(t, w, y, cw, sel)
    let s = R(0, y, cw, 26, { fill: K1 }) + hline(0, cw, y, .07)
    const by = y + 16.6, lim = cw - 12, src = wallNode(w, e.from), dst = wallNode(w, e.to)
    s += key(10, y + 4, 'add', { a: 'plugs', armed: S.picker.open })[0]
    let x = 10 + keyW('add', {}) + 14
    const said = asGiven(`${src ? wallName(src) : '?'} → ${dst ? wallName(dst) : '?'} ${ctlHandLabel(w, dst, e.hand)}`)
    s += T(x, by, said, { size: 10, w: 500 }); x += tw(said, 10, 500) + 16
    const [f1, w1] = field(x, by, 'depth', String(Math.round((+e.gain || 0) * 100)), { a: 'wall', more: ` data-k="cdepth" data-i="${sel.wire}"`, cur: 'ns-resize' }); s += f1; x += w1 + 14
    if (!/^wire:/.test(e.hand)) { const [f2] = field(x, by, 'way', CTL_WAYS[e.pol || 0], { a: 'wall', more: ` data-k="cway" data-i="${sel.wire}"`, cur: 'pointer' }); s += f2 }
    const wd = keyW('remove', {}); s += key(lim - wd, y + 4, 'remove', { a: 'wall', more: ' data-k="rmw"' })[0]
    return s
  }
  wallDown = function (e) {
    const el = e.target.closest ? e.target.closest('[data-a]') : null
    const k = el && el.dataset.a === 'wall' ? el.dataset.k : null
    if (k !== 'cdepth' && k !== 'cway') return down0(e)
    e.preventDefault()
    const t = wallTrack(), w = wallOf(t), i = +el.dataset.i, wire = w && w.wires[i], p = pt(e)
    if (!wire) return true
    S.focus = 'wall'
    if (k === 'cway') openMenu(p.x, p.y - 8, CTL_WAYS.map((o, v) => ({ t: o, v, on: (wire.pol || 0) === v })), it => { wire.pol = it.v; wallPush(t); uiDirty('dock') }, { w: 130 })
    else if (e.altKey) { wire.gain = PC.newWireDepth(WALL_TYPE[(wallNode(w, wire.from) || {}).k]); wallPush(t) }
    else { WALL.drag = { k: 'cdepth', i, v0: +wire.gain || 0, ly: p.y, p0: p, moved: false }; try { svg.setPointerCapture(e.pointerId) } catch (err) {} }
    uiDirty('dock')
    return true
  }
}

/* ── in a print's study ──
   An lfo's study shows its shape to be drawn in place of the picture (Patch on Slur's editor: press the empty grid for a new
   point, drag a point or the hollow middle of a stretch, press a point twice to take it away; the ends of the loop move
   together while they meet, alt moves one alone; steps are drawn by sweeping across them). The bands' study shows the ruler
   it cuts (drag a cut; press a band twice to cut it there, a cut twice to take it away). A scene's study takes the wall as it
   is into A or B and says how many hands the two hold apart. And every print's study says what plays its hands: a row a
   play — who, which hand, how deep (drag it), which way. The rules of drawing are Patch on Slur's own (PATCH_CATALOG). */
const CTL_PAD = 6
const ctlLfoBox = G => { const P = G.L.P; return { x: G.cx - P / 2, y: G.py - P / 2, P, W: P - CTL_PAD * 2 } }
const ctlLfoAt = (G, p) => { const b = ctlLfoBox(G); return { x: clamp((p.x - b.x - CTL_PAD) / b.W, 0, 1), y: clamp(1 - (p.y - b.y - CTL_PAD) / b.W, 0, 1) } }
const ctlRandom = node => ((node.aux || [])[4] || 0) > 0 ? (node.aux[4] || 8) : 0
const ctlSteps = node => !ctlRandom(node) && (node.variant || 0) === PC.LFO_STEPS ? ((node.aux || [])[6] || 8) : 0
/* the print's own picture is drawn by the study, unless it is drawn by hand here */
function ctlArt (t, w, node, cx, py, size, tint) {
  if (node.k === 'lfo') {
    const b = { x: cx - size / 2, y: py - size / 2, W: size - CTL_PAD * 2 }, sx = x => b.x + CTL_PAD + x * b.W, sy = y => b.y + CTL_PAD + (1 - y) * b.W
    let s = ''
    for (let k = 0; k <= 8; k++) s += P_(`M${n(sx(k / 8))} ${n(sy(0))}V${n(sy(1))}M${n(sx(0))} ${n(sy(k / 8))}H${n(sx(1))}`, k === 4 ? .22 : .12)
    const rnd = ctlRandom(node), steps = ctlSteps(node), pts = node.pts && node.pts.length >= 6 ? node.pts : PC.SINE_PTS
    let line
    if (rnd) { line = []; for (let k = 0; k < rnd; k++) { const y = PC.randomStep(node.id, 0, rnd, k); line.push([k / rnd, y], [(k + 1) / rnd, y]) } }
    else line = PC.lfoLine(pts)
    s += P(line.map(([x, y], k) => `${k ? 'L' : 'M'}${n(sx(x))} ${n(sy(y))}`).join(''), { stroke: tint, sw: 1.6, cap: 'round' })
    s += hit(b.x, b.y, size, size, 'study', ' data-k="lgrid"', rnd ? 'default' : steps ? 'ns-resize' : 'crosshair')
    if (!rnd && !steps) {
      const np = pts.length / 3
      for (let i = 0; i < np - 1; i++) {
        if (pts[(i + 1) * 3] - pts[i * 3] < 1e-6) continue
        const xm = (pts[i * 3] + pts[(i + 1) * 3]) / 2, ym = PC.shapeAt(pts, xm)
        s += Cc(sx(xm), sy(ym), 3.5, { fill: K1, stroke: INK, sa: .7 }) + hit(sx(xm) - 6, sy(ym) - 6, 12, 12, 'study', ` data-k="lbend" data-v="${i}"`, 'ns-resize')
      }
      for (let i = 0; i < np; i++) s += Cc(sx(pts[i * 3]), sy(pts[i * 3 + 1]), 4, { fill: INK }) + hit(sx(pts[i * 3]) - 7, sy(pts[i * 3 + 1]) - 7, 14, 14, 'study', ` data-k="lpt" data-v="${i}"`, 'move')
    }
    return s
  }
  if (node.k === 'bands') {
    const x0 = cx - size / 2 + 8, W = size - 16, y0 = py - size * .2, H = size * .34, cuts = PC.crossovers(node.aux || []), edges = [0, ...cuts.map(PC.fx), 1]
    let s = ''
    edges.slice(0, -1).forEach((a, k) => { const c = PC.BAND_RGB[k]; s += R(x0 + a * W, y0, Math.max(1, (edges[k + 1] - a) * W), H, { fill: `rgb(${c[0]},${c[1]},${c[2]})`, fa: .5 }) })
    s += hit(x0, y0, W, H, 'study', ' data-k="bstrip"', 'crosshair')
    s += hline(x0, x0 + W, y0 + H + 18, .35)
    for (const f of [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]) { const big = f === 100 || f === 1000 || f === 10000; s += vline(x0 + PC.fx(f) * W, y0 + H + 14, y0 + H + 22, big ? .7 : .35); if (big) s += T(x0 + PC.fx(f) * W, y0 + H + 36, wallSaid(PC.fmtHz(f)), { size: 10, a: .55, anchor: 'middle' }) }
    cuts.forEach((hz, k) => { const x = x0 + PC.fx(hz) * W, on = STUDY.drag && STUDY.drag.ctl === 'cut' && STUDY.drag.k2 === k; s += P(`M${n(x)} ${n(y0 - 10)}V${n(y0 + H + 10)}`, { stroke: INK, sa: on ? 1 : .9, sw: on ? 2 : 1.4 }) + T(x, y0 - 16, wallSaid(PC.fmtHz(hz)), { size: 11, a: .9, anchor: 'middle' }) + hit(x - 6, y0 - 26, 12, H + 38, 'study', ` data-k="bcut" data-v="${k}"`, 'ew-resize') })
    return s
  }
  return null
}
function P_ (d, a) { return P(d, { stroke: INK, sa: a, sw: 1 }) }
/* the rows a study adds: a scene's takes, and every play of this print's hands */
function ctlRows (t, w, node) {
  const rows = []
  if (node.k === 'scene') rows.push({ k: 'ctl', what: 'take' }, { k: 'ctl', what: 'holds' })
  w.wires.forEach((e, i) => { if (wallCtl(e) && e.to === node.id && wallNode(w, e.from)) rows.push({ k: 'ctl', what: 'play', i }) })
  return rows
}
/* what a scene holds apart: the hands its two takes disagree on */
function ctlHeld (node) {
  const A = node.sceneA || [], B = node.sceneB || [], S_ = PC.SCENE_STRIDE, rows = a => { const m = new Map(); for (let i = 0; i + S_ <= a.length; i += S_) m.set(a[i], a.slice(i + 1, i + S_)); return m }
  if (!A.length || !B.length) return A.length ? 'a only' : B.length ? 'b only' : 'nothing yet'
  const ra = rows(A), rb = rows(B); let held = 0
  for (const [id, a] of ra) { const b = rb.get(id); if (b && id !== node.id) a.forEach((v, k) => { if (Math.abs(v - b[k]) > 1e-4) held++ }) }
  return `${held} hand${held === 1 ? '' : 's'}`
}
const ctlRowOf = (t, x) => PC.sceneRow(Object.assign(wallAsNode(x), { id: x.id, amount: wallAmount(t, x) }))
function ctlRow (t, w, node, r, i, x, y, rw, tint) {
  const by = y + STUDY_ROW / 2 + 3.6
  let s = ''
  if (r.what === 'take') {
    s += T(x, by, 'take', { size: 10.5, a: .5 })
    const cw = 54, cx = x + rw - cw * 2
    s += R(cx + .5, y + 5.5, cw * 2 - 1, 17, { rx: 3, stroke: INK, sa: .22 }) + vline(cx + cw, y + 6, y + 22, .14)
    ;['a', 'b'].forEach((v, k) => { s += T(cx + cw * k + cw / 2, y + 17.6, v, { size: 10, a: .7, anchor: 'middle' }) + hit(cx + cw * k, y + 4, cw, 20, 'study', ` data-k="ctake" data-v="${v}"`, 'pointer') })
  } else if (r.what === 'holds') {
    s += T(x, by, 'holds', { size: 10.5, a: .5 }) + T(x + rw, by, ctlHeld(node), { size: 11.5, w: 500, a: .85, anchor: 'end' })
  } else if (r.what === 'play') {
    const e = w.wires[r.i], src = wallNode(w, e.from), dep = Math.round((+e.gain || 0) * 100), both = ctlBoth(w, e)
    const who = `${wallName(src)}${['lfo', 'drift', 'pulse'].includes(src.k) ? ' ' + wallRate(src) : src.k === 'macro' ? ' ' + (((src.aux || [])[0] || 0) + 1) : ''}`
    const word = asGiven(`${who} · ${ctlHandLabel(w, node, e.hand)}`), ww = Math.min(rw - 110, tw(word, 9.5) + 12)
    s += R(x + .5, y + 6.5, ww, 15, { rx: 2, stroke: tint, sa: .7 }) + T(x + 6, y + 17, fit(word, ww - 10, 9.5), { size: 9.5, c: tint })
    const live = STUDY.drag && STUDY.drag.ctl === 'depth' && STUDY.drag.i2 === r.i
    s += T(x + rw, by, `${dep}${/^wire:/.test(e.hand) ? '' : ' · ' + (both ? 'both ways' : 'one way')}`, { size: 11, w: 500, a: live ? 1 : .85, anchor: 'end' })
    const gy = y + STUDY_ROW - 2, mid = x + rw / 2, f = clamp(dep / 100, -1, 1) * rw / 2
    s += R(x, gy, rw, 2, { fill: INK, fa: .14 }) + R(Math.min(mid, mid + f), gy, Math.abs(f), 2, { fill: tint })
    s += hit(x + ww + 4, y, rw - ww - 4, STUDY_ROW, 'study', ` data-k="pdepth" data-v="${r.i}"`, 'ns-resize')
  }
  return s + hline(x, x + rw, y + STUDY_ROW - 1, .14)
}
/* pressed in a study: the shape, the cuts, a take, a play's depth */
function ctlStudyDown (e, el, k, t, w, node, G, p, twice) {
  const v = +el.dataset.v, hold = d => { STUDY.drag = Object.assign({ p0: p, moved: false }, d); try { document.getElementById('svg').setPointerCapture(e.pointerId) } catch (err) {} }
  const lfo = pts => { node.pts = pts; wallPush(t) }
  switch (k) {
    case 'lgrid': {
      if (ctlRandom(node)) return true
      const q = ctlLfoAt(G, p), steps = ctlSteps(node), pts = node.pts && node.pts.length >= 6 ? node.pts : PC.SINE_PTS.slice()
      if (steps) { lfo(PC.lfoSetStep(pts, steps, q)); hold({ ctl: 'step' }); return true }
      const added = PC.lfoAddPoint(pts, q); lfo(added.pts); hold({ ctl: 'pt', k2: added.i }); return true
    }
    case 'lpt': if (twice) lfo(PC.lfoRemovePoint(node.pts, v)); else hold({ ctl: 'pt', k2: v }); return true
    case 'lbend': if (twice) { const pts = node.pts.slice(); pts[v * 3 + 2] = 0; lfo(pts) } else hold({ ctl: 'bend', k2: v }); return true
    case 'bcut': { const cuts = PC.crossovers(node.aux || []); if (twice) { node.aux = PC.bandsPut(node.aux || [], PC.bandsJoin(cuts, v)); wallPush(t) } else hold({ ctl: 'cut', k2: v }); return true }
    case 'bstrip': if (twice) { const x0 = G.cx - G.L.P / 2 + 8, W = G.L.P - 16; node.aux = PC.bandsPut(node.aux || [], PC.bandsSplit(PC.crossovers(node.aux || []), clamp((p.x - x0) / W, 0, 1))); wallPush(t) } return true
    case 'ctake': { node[el.dataset.v === 'a' ? 'sceneA' : 'sceneB'] = [].concat(...w.nodes.filter(x => x.id !== node.id && x.k !== 'scene' && x.k !== 'plug' && x.k !== 'meter').map(x => ctlRowOf(t, x))); CTL.seen.delete(t.id); wallPush(t); return true }
    case 'pdepth': { const wire = w.wires[v]; if (!wire) return true; if (e.altKey || twice) { wire.gain = PC.newWireDepth(WALL_TYPE[(wallNode(w, wire.from) || {}).k]); wallPush(t) } else hold({ ctl: 'depth', i2: v, v0: +wire.gain || 0 }); return true }
  }
  return false
}
function ctlStudyMove (e, d, t, w, node, G, p) {
  if (d.ctl === 'step') { node.pts = PC.lfoSetStep(node.pts, ctlSteps(node), ctlLfoAt(G, p)); wallPush(t) }
  else if (d.ctl === 'pt') { node.pts = PC.lfoMovePoint(node.pts, d.k2, ctlLfoAt(G, p), e.altKey); wallPush(t) }
  else if (d.ctl === 'bend') { node.pts = PC.lfoBend(node.pts, d.k2, ctlLfoAt(G, p).y); wallPush(t) }
  else if (d.ctl === 'cut') { const x0 = G.cx - G.L.P / 2 + 8, W = G.L.P - 16; node.aux = PC.bandsPut(node.aux || [], PC.bandsMoveCut(PC.crossovers(node.aux || []), d.k2, clamp((p.x - x0) / W, 0, 1))); wallPush(t) }
  else if (d.ctl === 'depth') { const wire = w.wires[d.i2]; if (wire) { wire.gain = clamp(Math.round((d.v0 + (d.p0.y - p.y) * (e.shiftKey ? .002 : .01)) * 100) / 100, -1, 1); wallPush(t) } }
}
/* a scene with both its takes: an edit on the wall goes into the take its knob is nearer to (at A you shape A, at B you shape
   B), as on Patch on Slur's wall. What each print was, as the scene last saw it, is kept to know what was edited. */
CTL.seen = new Map()
{
  const push0 = wallPush
  wallPush = function (t) {
    const w = t && t.wall ? wallOf(t) : null, sc = w && w.nodes.find(x => x.k === 'scene' && x.sceneA && x.sceneA.length && x.sceneB && x.sceneB.length)
    if (sc) {
      const was = CTL.seen.get(t.id), now = new Map(w.nodes.filter(x => x.k !== 'scene' && x.k !== 'plug' && x.k !== 'meter').map(x => [x.id, ctlRowOf(t, x)]))
      if (was) {
        const key = wallAmount(t, sc) < .5 ? 'sceneA' : 'sceneB', arr = sc[key].slice(), S_ = PC.SCENE_STRIDE
        let changed = false
        for (const [id, row] of now) {
          const old = was.get(id)
          if (old && row.every((v, k) => v === old[k])) continue
          let at = -1; for (let i = 0; i + S_ <= arr.length; i += S_) if (arr[i] === id) { at = i; break }
          if (at < 0) arr.push(...row); else arr.splice(at, S_, ...row)
          changed = true
        }
        if (changed) sc[key] = arr
      }
      CTL.seen.set(t.id, now)
    } else if (t) CTL.seen.delete(t.id)
    return push0.apply(this, arguments)
  }
}
