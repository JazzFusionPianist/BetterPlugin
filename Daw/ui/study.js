/* ── the study: a print pressed on the wall is drawn big at the wall's right, with every hand of it (Patch on Slur's study) ──
   As on Patch on Slur's wall: a print taken hold of and pulled is MOVED (it no longer changes its amount); pressed and let go
   where it was, it opens its study — a column of its own at the right of the wall, lit in the print's own ink. In it:
     the print, drawn big: pulled up or down it turns the print's amount (with shift, finely); option, or twice, puts it back
     the amount under it, in the print's ink: pulled the same way, or pressed and typed into
     a row for each of its other hands: a number is pulled up or down (its hairline is its gauge) or typed into; a choice
       is a line of cells, the chosen one lit; on and off (wet only, bypass) are small switches
     remove, at its foot (pressed twice)
   The close mark at its top, esc, or a press on the empty wall puts it away. A wall too short for one column has the print
   at the left and the rows beside it. The print's lamp breathes with what the track plays, as Patch on Slur's does.
   Read after wall.js (it wraps the wall's hands and its drawing). */
const STUDY = { t: null, id: null, drag: null, arm: false, lastAt: 0, lastK: '', g: null, typing: null }
const STUDY_ROW = 28
const STUDY_IN = document.createElement('input')
{ STUDY_IN.type = 'text'; STUDY_IN.hidden = true; STUDY_IN.autocomplete = 'off'; STUDY_IN.spellcheck = false; STUDY_IN.dataset.own = '1'; STUDY_IN.setAttribute('autocapitalize', 'off'); STUDY_IN.setAttribute('aria-label', 'a value')
  STUDY_IN.style.cssText = 'position:absolute;box-sizing:border-box;padding:0 4px;margin:0;border:0;border-bottom:1px solid rgba(236,234,228,.5);border-radius:0;outline:0;background:#151514;color:var(--ink);caret-color:var(--ink);text-align:right;-webkit-user-select:text;user-select:text'
  document.getElementById('board').appendChild(STUDY_IN) }

const studyTint = node => (PATCH_PRINTS.PLATE_TINT || {})[WALL_TYPE[node.k]] || '#B8B4AA'
const studyBipolar = k => k === 'tone' || k === 'stereo' || k === 'pan' || k === 'pitch' || k === 'formant'
const studyHasAmount = node => wallHasAmount(node)
/* the print the study is open on, if it is still there and its wall is the one shown */
function studyNode () {
  const t = wallTrack()
  if (!t || STUDY.id == null || STUDY.t !== t.id || !(S.panel.on && S.panel.tab === 'patch')) return null
  const w = wallOf(t), node = w && wallNode(w, STUDY.id)
  return node && wallIsPrint(node) && node.k !== 'meter' ? node : null
}
function studyOpen (t, id) { STUDY.t = t.id; STUDY.id = id; STUDY.arm = false; studyType(null); uiDirty('dock') }
function studyClose () { if (STUDY.id == null) return; STUDY.id = null; STUDY.arm = false; studyType(null); uiDirty('dock') }

/* every row of a print's study, in order: its hands (a choice or a number), a mix's wires, its switches */
function studyRows (t, w, node) {
  const hands = wallHands(node.k, node), rows = hands.map((h, i) => ({ k: h.opts ? 'choice' : 'gauge', h, i })).filter(r => r.h.c.kind !== 'switch')      // (a hand that is a switch stands with the switches, as in Patch on Slur)
  if (node.k === 'mix') w.wires.forEach((e, i) => { if (e.to === node.id && !wallCtl(e)) rows.push({ k: 'share', i, label: e.from === WALL_IN ? 'in' : wallName(wallNode(w, e.from) || { k: '?' }) }) })
  const sw = hands.map((h, i) => h.c.kind === 'switch' ? 'h' + i : null).filter(Boolean).concat(WALL_WET.has(node.k) ? ['wet'] : []).concat(!PC.isUtilityType(WALL_TYPE[node.k]) ? ['by'] : [])
  if (typeof ctlRows === 'function') rows.push(...ctlRows(t, w, node))      // (a scene's takes, and what plays this print's hands: ctl.js)
  if (sw.length) rows.push({ k: 'switches', sw })
  return rows
}
/* where things go: one column when the wall is tall enough, else the print at the left and the rows beside it */
function studyLay (g, n) {
  const head = 48, val = 40, foot = 42
  const P = Math.min(220, g.h - head - val - n * STUDY_ROW - foot - 8)
  if (P >= 110) return { tall: true, w: 360, P, head, val, foot, off: Math.max(0, Math.floor((g.h - head - foot - (P + 48 + n * STUDY_ROW)) / 2)) }      // (what is left over stands above and below, as on Patch on Slur)
  const P2 = clamp(g.h - head - val - foot, 64, 190), per = Math.max(1, Math.floor((g.h - head - 18) / STUDY_ROW)), cols = Math.max(1, Math.ceil(n / per)), colW = 250, left = Math.max(P2, 150) + 48
  return { tall: false, w: Math.min(g.w - 60, left + cols * (colW + 22) + 10), P: P2, per, cols, colW, left, head, val, foot }
}
/* a number's place along its gauge, 0 to 1 (a wide range is read along a log) */
const studyLog = h => h.lo > 0 && h.hi / h.lo >= 100
const studyFrac = (h, v) => studyLog(h) ? Math.log(v / h.lo) / Math.log(h.hi / h.lo) : (v - h.lo) / (h.hi - h.lo)
const studyAmountText = (t, node) => wallValue(t, Object.assign({}, node, { bare: true })).trim()

/* ── drawn ── */
function studyDraw (t, w, node) {
  const g = WALL.g, rows = studyRows(t, w, node), L = studyLay(g, rows.length), tint = studyTint(node)
  const sx = Math.round(g.x + g.w - L.w), y = g.y, h = g.h, cx = L.tall ? sx + L.w / 2 : sx + 24 + Math.max(L.P, 150) / 2
  const py = y + L.head + (L.off || 0) + L.P / 2, lid = 'stl' + (++UID)
  STUDY.g = { sx, y, w: L.w, h, L, cx, py, rows }
  let s = R(sx, y, L.w, h, { fill: K1 }) + vline(sx, y, y + h, .14)
  /* the lamp: the print's ink, as bright as what the track plays (studyLamp sets it) */
  s += `<defs><radialGradient id="${lid}" gradientUnits="userSpaceOnUse" cx="${n(cx)}" cy="${n(py)}" r="${n(L.P * 1.7)}"><stop offset="0" stop-color="${tint}" stop-opacity=".5"/><stop offset=".22" stop-color="${tint}" stop-opacity=".33"/><stop offset=".42" stop-color="${tint}" stop-opacity=".16"/><stop offset=".7" stop-color="${tint}" stop-opacity=".05"/><stop offset="1" stop-color="${tint}" stop-opacity="0"/></radialGradient><clipPath id="${lid}c"><rect x="${n(sx)}" y="${n(y)}" width="${n(L.w)}" height="${n(h)}"/></clipPath></defs>`
  s += `<rect id="st-lamp" x="${n(sx)}" y="${n(y)}" width="${n(L.w)}" height="${n(h)}" fill="url(#${lid})" opacity="${n(STUDY.lamp || 0)}" clip-path="url(#${lid}c)"/>`
  s += hit(sx, y, L.w, h, 'study', ' data-k="bg"', 'default')
  /* its name, and the close mark */
  s += T(sx + 22, y + 26, node.k, { size: 12.5, w: 500 }) + (node.bypass ? T(sx + 22 + tw(node.k, 12.5, 500) + 5, y + 26, 'off', { size: 12.5, a: .42 }) : '')
  const kx = sx + L.w - 26, ky = y + 22
  s += Cc(kx, ky, 11.5, { stroke: INK, sa: .22, fill: K1 }) + P(`M${n(kx - 3.4)} ${n(ky - 3.4)}L${n(kx + 3.4)} ${n(ky + 3.4)}M${n(kx + 3.4)} ${n(ky - 3.4)}L${n(kx - 3.4)} ${n(ky + 3.4)}`, { stroke: INK, sa: .7, sw: 1.3, cap: 'round' }) + hit(kx - 13, ky - 13, 26, 26, 'study', ' data-k="close"', 'pointer')
  /* the print, big */
  const fam = WALL_FAMILY[node.k] || 'tone', type = WALL_TYPE[node.k]
  const drawn = typeof ctlArt === 'function' ? ctlArt(t, w, node, cx, py, L.P, tint) : null      // (an lfo's shape and the bands' cuts are drawn by hand here: ctl.js)
  const inner = drawn != null ? '' : PATCH_PRINTS.printInner(Object.assign({ type, amount: wallAmount(t, node), variant: node.variant || 0, aux: node.aux || [0, 0, 0, 0, 0, 0, 0, 0] }, wallDrawn(node)), fam, tint).replace(/'Space Mono', ui-monospace, monospace/g, 'Instrument Sans')
  s += drawn != null ? drawn : `<g transform="translate(${n(cx)} ${n(py)}) scale(${n(L.P / 2)})"${node.bypass ? ' opacity=".38"' : ''}>${inner}</g>`
  if (drawn == null) s += hit(cx - L.P / 2, py - L.P / 2, L.P, L.P, 'study', ' data-k="print"', studyHasAmount(node) ? 'ns-resize' : 'default')
  /* its amount, in its ink */
  const vy = py + L.P / 2 + 30
  if (studyHasAmount(node)) {
    const txt = studyAmountText(t, node), live = STUDY.drag && STUDY.drag.k === 'amt'
    if (!(STUDY.typing && STUDY.typing.k === 'amt')) s += T(cx, vy, asGiven(txt), { size: 24, w: 500, c: tint, a: live ? 1 : .94, anchor: 'middle' })
    const vw = Math.max(60, tw(asGiven(txt), 24, 500) + 20)
    s += hit(cx - vw / 2, vy - 24, vw, 32, 'study', ' data-k="amt"', 'ns-resize')
  }
  /* the rows */
  const place = L.tall
    ? (i => ({ x: sx + 24, y: vy + 18 + i * STUDY_ROW, w: L.w - 48 }))
    : (i => ({ x: sx + L.left + Math.floor(i / L.per) * (L.colW + 22), y: y + L.head - 6 + (i % L.per) * STUDY_ROW, w: L.colW }))
  if (L.tall && rows.length) s += hline(sx + 24, sx + L.w - 24, vy + 18, .14)
  rows.forEach((r, i) => { const q = place(i); s += studyRow(t, w, node, r, i, q.x, q.y, q.w, tint) })
  /* remove, at the foot */
  const label = STUDY.arm ? 'sure?' : 'remove', kw = keyW(label, { armed: STUDY.arm })
  s += key(Math.round(cx - kw / 2), y + h - 32, label, { a: 'study', more: ' data-k="rm"', armed: STUDY.arm })[0]
  return s
}
function studyRow (t, w, node, r, i, x, y, rw, tint) {
  if (r.k === 'ctl') return ctlRow(t, w, node, r, i, x, y, rw, tint)
  const by = y + STUDY_ROW / 2 + 3.6, more = ` data-k="row" data-i="${i}"`
  let s = ''
  if (r.k === 'switches') {
    let rx = x + rw
    for (const k of r.sw.slice().reverse()) {
      const hand = k[0] === 'h' ? wallHands(node.k, node)[+k.slice(1)] : null      // (a print's own switch: gain's phases, grain's freeze, match's learn)
      const on = hand ? wallHandNow(node, hand) === 1 : k === 'wet' ? !!node.wet : !!node.bypass, quiet = k === 'by', word = hand ? hand.label : k === 'wet' ? 'wet only' : 'bypass', sw = 26, sy = y + STUDY_ROW / 2 - 7
      rx -= sw
      s += R(rx + .5, sy + .5, sw - 1, 13, { rx: 6.5, stroke: on ? (quiet ? INK : tint) : INK, sa: on ? (quiet ? .6 : .9) : .3, fill: on ? (quiet ? INK : tint) : 'none', fa: on ? (quiet ? .08 : .16) : 0 })
      s += Cc(on ? rx + 19 : rx + 7, sy + 7, 4, { fill: on ? (quiet ? INK : tint) : INK, fa: on ? (quiet ? .85 : 1) : .5 })
      const lw = tw(word, 10.5)
      rx -= 8 + lw
      s += T(rx, by, word, { size: 10.5, a: on ? 1 : .5 })
      s += hit(rx - 4, y, lw + sw + 14, STUDY_ROW, 'study', ` data-k="sw" data-v="${k}"`, 'pointer')
      rx -= 18
    }
    return s
  }
  const label = r.k === 'share' ? asGiven(r.label) : r.h.label
  s += T(x, by, label, { size: 10.5, a: .5 })
  if (r.k === 'choice') {
    const h = r.h, now = wallHandNow(node, h), avail = rw - 74, fill = h.opts.length > 4, widest = Math.max(...h.opts.map(o => tw(asGiven(o), 9.5))) + 8, cell = Math.floor(avail / h.opts.length)
    const cw = fill && widest <= cell ? h.opts.map(() => cell) : h.opts.map(o => Math.round(tw(asGiven(o), 10) + 16)), total = cw.reduce((a, b) => a + b, 0), fs = fill && widest <= cell ? 9.5 : 10      // (a long line of short words: cells of one width across the row, as Patch on Slur's are)
    if (total <= avail) {
      let cx = x + rw - total
      s += R(cx + .5, y + 5.5, total - 1, 17, { rx: 3, stroke: INK, sa: .22 })
      h.opts.forEach((o, k) => {
        const on = h.vals[k] === now
        if (k) s += vline(cx, y + 6, y + 22, .14)
        if (on) s += R(cx + (k ? 1 : 1), y + 6, cw[k] - (k === h.opts.length - 1 ? 2 : 1), 16, { rx: k === 0 || k === h.opts.length - 1 ? 2 : 0, fill: tint, fa: .3 })
        s += T(cx + cw[k] / 2, y + 17.6, asGiven(o), { size: fs, w: on ? 500 : 400, a: on ? 1 : .5, anchor: 'middle' })
        s += hit(cx, y + 4, cw[k], 20, 'study', ` data-k="cell" data-i="${i}" data-v="${k}"`, 'pointer')
        cx += cw[k]
      })
    } else {                                                                              // too many to stand in a line: one cell that opens the list
      const word = asGiven(wallHandText(node, h)), mw = Math.round(tw(word, 10) + 26)
      s += R(x + rw - mw + .5, y + 5.5, mw - 1, 17, { rx: 3, stroke: INK, sa: .22, fill: tint, fa: .3 }) + T(x + rw - mw + 8, y + 17.6, word, { size: 10, w: 500 }) + caret(x + rw - 9.5, y + 14, .6)
      s += hit(x + rw - mw, y + 4, mw, 20, 'study', ` data-k="list" data-i="${i}"`, 'pointer')
    }
    return s + hline(x, x + rw, y + STUDY_ROW - 1, .14)
  }
  /* a number: its hairline is its gauge, filled in the print's ink */
  const h = r.k === 'share' ? { lo: 0, hi: 100 } : r.h, v = r.k === 'share' ? Math.round(w.wires[r.i].gain * 100) : wallHandNow(node, h), live = STUDY.drag && STUDY.drag.k === 'row' && STUDY.drag.i === i
  const txt = r.k === 'share' ? String(v) : wallHandText(node, h), f = clamp(studyFrac(h, v), 0, 1), z = h.lo < 0 && h.hi > 0 ? clamp(studyFrac(h, 0), 0, 1) : 0
  if (!(STUDY.typing && STUDY.typing.k === 'row' && STUDY.typing.i === i)) s += T(x + rw, by, asGiven(txt), { size: 11.5, w: 500, a: live ? 1 : .85, anchor: 'end' })
  const gy = y + STUDY_ROW - 2, a = Math.min(f, z), b = Math.max(f, z)
  s += R(x, gy, rw, live ? 3 : 2, { fill: INK, fa: .14 })
  if (b - a > .002) s += R(x + rw * a, gy - 1.5, rw * (b - a), live ? 6 : 5, { rx: 2, fill: tint, fa: .22 }) + R(x + rw * a, gy, rw * (b - a), live ? 3 : 2, { rx: 1, fill: tint })
  s += hit(x, y, rw, STUDY_ROW, 'study', more, 'ns-resize')
  return s
}
/* the lamp follows the track as it plays (no redrawing: its brightness only) */
function studyLamp () {
  const el = document.getElementById('st-lamp')
  if (!el || !studyNode()) { STUDY.lamp = 0; return }
  const t = wallTrack(), v = t === OUT ? Math.max(METERS.mm[0], METERS.mm[1]) : METERS.now.get(t.id) || 0
  const want = clamp(volF(Math.min(6, linDb(Math.max(v, 1e-6)))) * 1.25, 0, 1), k = (STUDY.lamp || 0) + (want - (STUDY.lamp || 0)) * (want > (STUDY.lamp || 0) ? .5 : .12)
  STUDY.lamp = k < .004 ? 0 : k
  el.setAttribute('opacity', n(STUDY.lamp))
}
setInterval(studyLamp, 50)

/* ── hands ── */
const studyPoint = e => pt(e)
function studyValueSet (t, w, node, r, v, live) {
  if (r.k === 'share') { wallSetShare(t, r.i, clamp(v / 100, 0, 1)); return }
  wallHandSet(node, r.h, clamp(v, r.h.lo, r.h.hi)); if (node.k === 'mix') wallShares(w, node.id)
  if (!live) wallPush(t); else wallPush(t)
}
function studyDown (e, el) {
  const t = wallTrack(), w = t && wallOf(t), node = studyNode(), G = STUDY.g
  if (!node || !G) return
  e.preventDefault()
  if (S.menu) { S.menu = null; uiDirty('menu') }
  studyType(true)
  S.focus = 'wall'
  const k = el.dataset.k, i = el.dataset.i == null ? -1 : +el.dataset.i, p = studyPoint(e), r = i >= 0 ? G.rows[i] : null
  const now = performance.now(), twice = STUDY.lastK === k + ':' + i && now - STUDY.lastAt < 380
  STUDY.lastAt = now; STUDY.lastK = k + ':' + i
  if (typeof ctlStudyDown === 'function' && ctlStudyDown(e, el, k, t, w, node, G, p, twice)) { STUDY.arm = false; uiDirty('dock'); return }      // (ctl.js: the shape, the cuts, a take, a play)
  const hold = d => { STUDY.drag = Object.assign({ p0: p, moved: false }, d); try { document.getElementById('svg').setPointerCapture(e.pointerId) } catch (err) {} }
  const rest = () => WALL_LEGACY[node.k] ? PRINT_START[node.k] / 100 : wallNeutral(node.k)
  if (k !== 'rm') STUDY.arm = false
  switch (k) {
    case 'close': studyClose(); break
    case 'print': case 'amt':
      if (!studyHasAmount(node)) break
      if (e.altKey || (twice && k === 'print')) { wallSetAmount(t, node, rest()); break }
      hold({ k: 'amt', v0: wallAmount(t, node), type: k === 'amt' }); break
    case 'row':
      if (!r || (r.k !== 'gauge' && r.k !== 'share')) break
      if (e.altKey) { if (r.k === 'share') { const m = node, n0 = w.wires.filter(x => x.to === m.id).length; wallSetShare(t, r.i, (m.variant || 0) === 0 ? 1 / n0 : 1) } else studyValueSet(t, w, node, r, r.h.def); break }
      hold({ k: 'row', i, v0: r.k === 'share' ? w.wires[r.i].gain * 100 : wallHandNow(node, r.h) }); break
    case 'cell': if (r && r.h) { wallHandSet(node, r.h, r.h.vals[+el.dataset.v]); if (node.k === 'mix') wallShares(w, node.id); wallPush(t) } break
    case 'list': if (r && r.h) { const h = r.h; openMenu(p.x - 60, p.y + 12, h.opts.map((o, x) => ({ t: asGiven(o), v: h.vals[x], on: wallHandNow(node, h) === h.vals[x] })), it => { wallHandSet(node, h, it.v); wallPush(t); uiDirty('dock') }, { w: 130 }) } break
    case 'sw': { const v = el.dataset.v, hand = v[0] === 'h' ? wallHands(node.k, node)[+v.slice(1)] : null; if (hand) wallHandSet(node, hand, wallHandNow(node, hand) ? 0 : 1); else if (v === 'wet') node.wet = !node.wet; else node.bypass = !node.bypass; wallPush(t); break }
    case 'rm': if (!STUDY.arm) STUDY.arm = true; else { STUDY.arm = false; wallRemove(t, node); studyClose() } break
  }
  uiDirty('dock')
}
function studyMove (e) {
  const d = STUDY.drag, t = wallTrack(), w = t && wallOf(t), node = studyNode(), G = STUDY.g
  if (!d || !node || !G) return
  const p = studyPoint(e), dy = d.p0.y - p.y
  if (d.ctl) { d.moved = true; ctlStudyMove(e, d, t, w, node, G, p); uiDirty('dock'); return }
  if (Math.abs(dy) > 2 || Math.abs(p.x - d.p0.x) > 2) d.moved = true
  if (!d.moved) return
  if (d.k === 'amt') wallSetAmount(t, node, d.v0 + dy / (e.shiftKey ? 950 : 190), true)
  else if (d.k === 'row') {
    const r = G.rows[d.i]
    if (!r) return
    if (r.k === 'share') studyValueSet(t, w, node, r, d.v0 + dy * 100 / (e.shiftKey ? 950 : 190), true)
    else { const h = r.h, v = studyLog(h) ? d.v0 * Math.pow(h.hi / h.lo, dy / (e.shiftKey ? 950 : 190)) : d.v0 + dy * (h.hi - h.lo) / (e.shiftKey ? 950 : 190); studyValueSet(t, w, node, r, v, true) }
  }
  uiDirty('dock')
}
function studyUp () {
  const d = STUDY.drag, t = wallTrack(), node = studyNode()
  STUDY.drag = null
  if (!d || !t) return
  if (d.ctl) { if (node) wallPush(t); uiDirty('dock'); return }
  if (d.moved) { if (node) wallPush(t) }
  else if (d.k === 'amt' && d.type) studyType({ k: 'amt' })                                  // the number pressed and let go: typed into
  else if (d.k === 'row') studyType({ k: 'row', i: d.i })
  uiDirty('dock')
}
/* a number typed into, where it stands: the amount as it reads (a print that leans either way, -100 to 100), a hand in its unit */
function studyType (what) {
  if (!what || what === true) { if (what !== true || !STUDY.typing) { if (STUDY.typing) { STUDY.typing = null; STUDY_IN.hidden = true; uiDirty('dock') } } else { studyTyped(true) } return }
  const t = wallTrack(), w = wallOf(t), node = studyNode(), G = STUDY.g
  if (!node || !G) return
  let x, y, wd, size, v
  if (what.k === 'amt') { size = 24; wd = 120; x = G.cx - wd / 2; y = G.py + G.L.P / 2 + 8; v = studyAmountText(t, node).replace(/^[−]/, '-') }
  else {
    const r = G.rows[what.i]
    if (!r) return
    const L = G.L, i = what.i, rx = L.tall ? G.sx + 24 : G.sx + L.left + Math.floor(i / L.per) * (L.colW + 22), rw = L.tall ? L.w - 48 : L.colW, ry = L.tall ? G.py + L.P / 2 + 30 + 18 + i * STUDY_ROW : G.y + L.head - 6 + (i % L.per) * STUDY_ROW
    size = 11.5; wd = 90; x = rx + rw - wd; y = ry + 4
    v = r.k === 'share' ? String(Math.round(w.wires[r.i].gain * 100)) : r.h.fmt ? r.h.fmt(wallHandNow(node, r.h), node).replace(/^[−]/, '-') : String(+(wallHandNow(node, r.h) * r.h.sc).toFixed(r.h.sc < 1 ? 2 : 0))      // (as it is said: a decay in seconds…)
  }
  STUDY.typing = Object.assign({ node: node.id }, what)
  STUDY_IN.style.left = n(x) + 'px'; STUDY_IN.style.top = n(y) + 'px'; STUDY_IN.style.width = n(wd) + 'px'; STUDY_IN.style.height = (size > 14 ? 32 : 20) + 'px'
  STUDY_IN.style.font = `500 ${size}px var(--f)`; STUDY_IN.style.textAlign = what.k === 'amt' ? 'center' : 'right'
  STUDY_IN.value = v; STUDY_IN.hidden = false; STUDY_IN.focus(); STUDY_IN.select()
  uiDirty('dock')
}
function studyTyped (keep) {
  const ty = STUDY.typing
  STUDY.typing = null; STUDY_IN.hidden = true
  const t = wallTrack(), w = t && wallOf(t), node = studyNode(), G = STUDY.g
  if (!keep || !ty || !node || node.id !== ty.node || !G) { uiDirty('dock'); return }
  const x = parseFloat(STUDY_IN.value.replace(/[−–]/g, '-').replace(/[^0-9.+-]/g, ''))
  /* typed in the units it is said in (wall.js: wallAmountParse, a hand's own parse): seconds, db, hz, centre… */
  if (ty.k === 'amt') { const a = typeof wallAmountParse === 'function' ? wallAmountParse(node.k, STUDY_IN.value, node.variant || 0) : (isFinite(x) ? (studyBipolar(node.k) ? .5 + x / 200 : x / 100) : null); if (a != null) wallSetAmount(t, node, a) }
  else { const r = G.rows[ty.i], own = r && r.h && r.h.parse ? r.h.parse(STUDY_IN.value, node) : null; if (r && (own != null || isFinite(x))) studyValueSet(t, w, node, r, own != null ? own : r.k === 'share' ? x : x / (r.h.sc || 1)) }
  uiDirty('dock')
}
STUDY_IN.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') studyTyped(true); else if (e.key === 'Escape') studyTyped(false) })
STUDY_IN.addEventListener('blur', () => { if (STUDY.typing) studyTyped(true) })

/* ── joined to the wall ── */
{
  const down0 = onDown, move0 = onMove, up0 = onUp, wheel0 = onWheel, patch0 = pPatch, wallDown0 = wallDown, wallUp0 = wallUp, foot0 = wallFoot, esc0 = KEYS.Escape
  /* a print on the wall: taken hold of it is moved; pressed and let go where it was, it opens its study */
  wallDown = function (e) {
    const el = e.target.closest ? e.target.closest('[data-a]') : null
    if (el && el.dataset.a === 'wall' && e.button !== 2) {
      const k = el.dataset.k, id = el.dataset.id == null ? null : +el.dataset.id, t = wallTrack(), w = t && wallOf(t), node = w && id != null && id >= 0 ? wallNode(w, id) : null
      if (k === 'bg') studyClose()
      if (k === 'node' && node && wallIsPrint(node) && node.k !== 'meter' && node.k !== 'side' && !e.altKey && WALL.g) {      // (a meter opens its face, a side asks what it plays: side.js)
        e.preventDefault()
        if (S.menu) { S.menu = null; uiDirty('menu') }
        S.focus = 'wall'; WALL.sel = { t: t.id, node: id }
        const p = pt(e)
        WALL.drag = { k: 'move', id, x: node.x, y: node.y, p0: p, q0: wallToWorld(w, WALL.g, p), moved: false, study: true }
        try { document.getElementById('svg').setPointerCapture(e.pointerId) } catch (err) {}
        uiDirty('dock'); return true
      }
    }
    return wallDown0(e)
  }
  wallUp = function () { const d = WALL.drag, t = wallTrack(); wallUp0(); if (d && d.study && !d.moved && t) studyOpen(t, d.id) }
  /* with the study up, the wall's foot is only the wall's (the study has the print's hands) */
  wallFoot = function (t, w, y, cw, sel) { const node = studyNode(); return node ? foot0(t, w, y, cw, null) : foot0(t, w, y, cw, sel) }
  pPatch = function (y, h) {
    let s = patch0(y, h)
    const t = wallTrack(), w = t && wallOf(t), node = studyNode()
    s = s.replace(/(data-k="node" data-id="\d+" style="cursor:)ns-resize/g, '$1pointer')        // (a print on the wall is moved or opened, no longer turned)
    if (!node || !WALL.g || WALL.g.id !== t.id) { if (STUDY.typing) studyType(null); return s }
    return s + studyDraw(t, w, node)
  }
  onDown = function (e) {
    const el = e.target.closest ? e.target.closest('[data-a]') : null
    if (STUDY.typing && el !== STUDY_IN) studyTyped(true)
    if (el && el.dataset.a === 'study' && e.button !== 2) { studyDown(e, el); return }
    down0(e)
  }
  onMove = function (e) { if (STUDY.drag) { studyMove(e); return } move0(e) }
  onUp = function (e) { if (STUDY.drag) { studyUp(); return } up0(e) }
  /* the wheel over the study: the print and its number turn the amount; elsewhere in it, nothing (the wall behind is not zoomed) */
  onWheel = function (e) {
    const G = STUDY.g, node = studyNode()
    if (node && G) {
      const p = pt(e)
      if (p.x >= G.sx && p.x <= G.sx + G.w && p.y >= G.y && p.y <= G.y + G.h) {
        e.preventDefault()
        if (studyHasAmount(node) && Math.hypot(p.x - G.cx, p.y - G.py) < G.L.P / 2 + 40) { const t = wallTrack(); wallSetAmount(t, node, wallAmount(t, node) - e.deltaY * (e.shiftKey ? .0004 : .002), true); uiDirty('dock') }
        return
      }
    }
    wheel0(e)
  }
  KEYS.Escape = () => { if (studyNode() && !S.menu) { studyClose(); return } esc0() }
}
