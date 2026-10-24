/* ── the theme maker: the room laid out by hand ──
   His ask (2026-10-24): a secondary app where anyone makes a theme by drag and drop, with full freedom; design/theme
   maker draft 1, his OK. The maker is the room's own page opened with ?maker=1: the room stands live in the middle at
   the size the theme is drawn for, scaled to fit; the parts box at the left, what the chosen thing is at the right, the
   layers at the foot. A box pressed is chosen and pulled; its handles size it; its pins say what follows the window
   (boxes.js). The head opened: its template's parts, at three heights, pulled where they should stand (tmpl.js).
   Every change is made in the look (LOOK) and the room redraws: what is seen is what the theme is. Read after tmpl.js. */
const MK = { on: new URLSearchParams(location.search).get('maker') != null, alone: new URLSearchParams(location.search).get('alone') != null, size: [1728, 1117], k: 1, mode: 'boxes', sel: null, part: null, try: false, drag: null, undo: [], redo: [], name: 'untitled theme', said: '', warn: null, cols: [14, 28, 72], hz: 1.6, guides: [] }
const MK_SIZES = [['13″', 1440, 900], ['16″', 1728, 1117], ['27″', 2560, 1440]]
const MK_Z = ['command line', 'tool', 'markers', 'bars', 'heads', 'transport', 'foot', 'lanes']       // what is pressed first: the smaller over the larger
const MK_NAMES = { transport: 'transport', foot: 'foot band', tool: 'tool row', markers: 'markers', bars: 'bars', heads: 'heads', lanes: 'lanes', 'command line': 'command line' }
/* the maker opened from the room, and the room from the maker (the Mac's Window menu): the page comes again with ?maker=1, or without */
function makerToggle () {
  if (NAT) { NAT.call('maker', { on: MK.on ? 0 : 1 }); return }
  const u = new URL(location.href); if (MK.on) u.searchParams.delete('maker'); else u.searchParams.set('maker', '1'); location.href = u.href
}
if (MK.on) {
  /* ── the chrome: the room's own darks, one face ── */
  const css = document.createElement('style')
  css.textContent = `
  body.maker #room { position: absolute; left: 236px; right: 300px; top: 44px; bottom: 150px; height: auto; background: #0E0E0E }
  body.maker #board { background: var(--k1); box-shadow: 0 0 0 1px rgba(236,234,228,.14) }
  .mk { position: absolute; background: var(--k1); font: 10.5px/1.3 var(--f); color: var(--ink); -webkit-font-smoothing: antialiased; overflow: hidden }
  #mk-top { left: 0; top: 0; right: 0; height: 44px; background: var(--k2); border-bottom: 1px solid rgba(236,234,228,.1) }
  #mk-left { left: 0; top: 44px; width: 236px; bottom: 0; border-right: 1px solid rgba(236,234,228,.12); overflow-y: auto }
  #mk-right { right: 0; top: 44px; width: 300px; bottom: 0; border-left: 1px solid rgba(236,234,228,.12); overflow-y: auto }
  #mk-layers { left: 236px; right: 300px; bottom: 0; height: 150px; border-top: 1px solid rgba(236,234,228,.12) }
  .mk .h { font-size: 9.5px; opacity: .4; letter-spacing: .02em; padding: 14px 14px 6px; white-space: nowrap }
  .mk .row { display: flex; align-items: center; height: 22px; padding: 0 14px; white-space: nowrap; cursor: default }
  .mk .row .k { margin-left: auto; opacity: .36; font-size: 9px }
  .mk .row.on { background: rgba(236,234,228,.08) } .mk .row.dim { opacity: .4 }
  .mk .row:hover { background: rgba(236,234,228,.05) }
  .mk .field { display: flex; align-items: center; min-height: 24px; padding: 0 14px; white-space: nowrap }
  .mk .field .l { width: 92px; opacity: .5; flex: none }
  .mk .field .v { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; row-gap: 4px; padding: 2px 0 }
  .mk .note { opacity: .4; font-size: 9.5px; line-height: 1.4; padding: 2px 14px 6px 106px }
  .mk input.num { height: 20px; width: 54px; padding: 0 6px; border: 1px solid rgba(236,234,228,.2); border-radius: 2px; background: #0E0E0E; color: var(--ink); font: 10.5px var(--f); font-variant-numeric: tabular-nums; outline: 0 }
  .mk input.num:focus { border-color: rgba(236,234,228,.6) }
  .mk input.name { height: 24px; width: 180px; padding: 0 6px; border: 0; background: transparent; color: var(--ink); font: 500 12px var(--f); outline: 0 }
  .mk .chip { height: 18px; padding: 0 8px; display: inline-flex; align-items: center; border: 1px solid rgba(236,234,228,.24); border-radius: 2px; font-size: 9.5px; white-space: nowrap; cursor: default }
  .mk .chip.on { background: var(--ink); color: var(--k1); border-color: var(--ink); font-weight: 500 }
  .mk .chip.dim { opacity: .35 }
  .mk .key { height: 22px; padding: 0 10px; display: inline-flex; align-items: center; border: 1px solid rgba(236,234,228,.24); border-radius: 2px; font-size: 9.5px; margin-left: 6px; white-space: nowrap; cursor: default }
  .mk .key.armed { background: var(--ink); color: var(--k1); border-color: var(--ink); font-weight: 500 }
  .mk .key.dim { opacity: .35 }
  .mk .title { padding: 16px 14px 4px; font-size: 12px; font-weight: 500 }
  .mk .said { position: absolute; left: 50%; transform: translateX(-50%); top: 14px; font-size: 9.5px; opacity: .5 }
  #mk-top .sizes { position: absolute; left: 50%; transform: translateX(-50%); top: 13px; display: flex; gap: 4px }
  #mk-top .keys { position: absolute; right: 14px; top: 11px }
  #mk-top .play { position: absolute; left: 230px; top: 11px; display: flex; gap: 2px; align-items: center }
  #mk-layers .cols { columns: 3; column-gap: 0 }
  #g-maker text { pointer-events: none }
  `
  document.head.appendChild(css)
  document.body.classList.add('maker')
  for (const id of ['mk-top', 'mk-left', 'mk-right', 'mk-layers']) { const d = document.createElement('div'); d.id = id; d.className = 'mk'; document.body.appendChild(d) }
  { const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.id = 'g-maker'; $('svg').appendChild(g) }
  const MKC = '#6E9BFF'                                                              // the maker's own colour: what it draws over the room, never the room's
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const left = () => boxOff()
  const WW = () => W + left(), WH = () => H

  /* ── the room at the size the theme is drawn for, scaled into the middle ── */
  const fit0 = fitRoom
  fitRoom = function () {
    const room = $('room'), ww = Math.max(200, room.clientWidth - 48), hh = Math.max(200, room.clientHeight - 48), l = left(), [TW, TH] = MK.size
    W = TW - l; H = TH
    const k = Math.min(ww / TW, hh / TH); MK.k = k
    board.style.width = TW + 'px'; board.style.height = TH + 'px'; board.style.transform = `scale(${k})`
    board.style.left = Math.round((room.clientWidth - TW * k) / 2) + 'px'; board.style.top = Math.round((room.clientHeight - TH * k) / 2) + 'px'
    board.style.setProperty('--room-left', l + 'px')
    svg.setAttribute('viewBox', `${-l} 0 ${TW} ${TH}`); svg.setAttribute('width', TW); svg.setAttribute('height', TH)
    relayout(); dirtyAll(); if (typeof syncSlur === 'function') syncSlur()
  }
  /* the theme's boxes, seeded from the room as it stands when it has none (every box there, to be pulled) */
  const seed = () => { if (!boxSaid()) { Object.assign(LOOK, boxWrite()); relayout() } }
  /* a widget is chosen by 'w:' and its id; a box by its name */
  const isW = nm => typeof nm === 'string' && nm.startsWith('w:')
  const wgOf = nm => wgList().find(q => 'w:' + q.id === nm) || null
  const rectOf = nm => isW(nm) ? (wgOf(nm) ? wgRect(wgOf(nm)) : null) : boxRect(nm, WW(), WH())
  const pinsOf = nm => { if (isW(nm)) { const w = wgOf(nm); return w ? (w.at || []).slice(4, 8).map(x => x || 0) : [0, 0, 0, 0] } const v = LOOK['box.' + nm]; return v == null ? [0, 0, 0, 0] : boxNums(v).slice(4, 8).map(x => x || 0) }
  /* a box set at the window's size: stored at the size the theme was drawn at, its pins undone */
  const store = (nm, r, pins) => {
    const [l, t, rr, b] = pins || pinsOf(nm), dW = WW() - BOX.drawn[0], dH = WH() - BOX.drawn[1]
    const x = r.x0 - l * dW, x1 = r.x1 - rr * dW, y = r.y0 - t * dH, y1 = r.y1 - b * dH, nums = [x, y, x1 - x, y1 - y, l, t, rr, b].map(v => +(+v).toFixed(1))
    if (isW(nm)) { const list = wgList(), w = list.find(q => 'w:' + q.id === nm); if (w) { w.at = nums; wgSave(list) } return }
    LOOK['box.' + nm] = nums.join(' ')
  }
  /* a widget changed: the field set (or taken off), the list kept */
  const wgSet = (nm, k, v) => { const list = wgList(), w = list.find(q => 'w:' + q.id === nm); if (!w) return; if (v == null || v === '') delete w[k]; else w[k] = v; wgSave(list) }
  const wgNames = { button: 'button', readout: 'readout', knob: 'knob', fader: 'fader', meter: 'meter', lamp: 'lamp', text: 'text', shape: 'shape', line: 'line', image: 'image' }
  const wgSaid = w => `${wgNames[w.is] || w.is}${w.does ? ': ' + w.does.replace(/^(menu|key):/, '') : w.shows ? ': ' + w.shows : w.label ? ': ' + w.label : ''}`
  /* a new widget, in the middle of the window, chosen */
  const WG_NEW = { button: { does: 'play', at: [60, 28] }, readout: { shows: 'position', at: [120, 28] }, knob: { does: 'master', at: [72, 72] }, fader: { does: 'master', at: [28, 120] }, meter: { at: [24, 120] }, lamp: { shows: 'playing', label: 'playing', at: [80, 18] }, text: { label: 'text', at: [120, 20] }, shape: { shape: 'rect', at: [100, 60] }, line: { at: [120, 2] }, image: { at: [160, 100] } }
  function wgAdd (is, more = {}) {
    seed(); snap()
    const d = WG_NEW[is] || { at: [60, 28] }, list = wgList(), id = Date.now().toString(36) + (list.length + 1).toString(36), [w, h] = d.at
    list.push(Object.assign({ id, is }, d, more, { at: [Math.round(WW() / 2 - w / 2), Math.round(WH() / 2 - h / 2), w, h, 0, 0, 0, 0] })); wgSave(list)
    MK.sel = 'w:' + id; MK.mode = 'boxes'; lay(); chrome()
  }
  const lay = () => { relayout(); dirtyAll() }
  const snap = () => { MK.undo.push(JSON.stringify(LOOK)); if (MK.undo.length > 200) MK.undo.shift(); MK.redo.length = 0 }
  const back = (from, to) => { if (!from.length) return; to.push(JSON.stringify(LOOK)); applyLook(JSON.parse(from.pop())); setView(true); chrome() }
  const within = (r, x, y) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1
  /* what is pressed: the widgets first (the last drawn on top), then the boxes, the smaller over the larger */
  const boxAt = (x, y) => { const ws = wgList(); for (let i = ws.length - 1; i >= 0; i--) if (within(wgRect(ws[i]), x, y)) return 'w:' + ws[i].id; return MK_Z.find(nm => { const r = rectOf(nm); return r && within(r, x, y) }) || null }

  /* ── what is drawn over the room: the chosen box, its handles, its pins, the guides, the distances; the head's columns ── */
  const HANDLES = [['nw', 0, 0], ['n', .5, 0], ['ne', 1, 0], ['w', 0, .5], ['e', 1, .5], ['sw', 0, 1], ['s', .5, 1], ['se', 1, 1]]
  const CURS = { nw: 'nwse-resize', n: 'ns-resize', ne: 'nesw-resize', w: 'ew-resize', e: 'ew-resize', sw: 'nesw-resize', s: 'ns-resize', se: 'nwse-resize' }
  const frame = (x0, y0, x1, y1, k, more = '') => {
    const hs = 7 / k
    let s = R(x0 + .5 / k, y0 + .5 / k, x1 - x0 - 1 / k, y1 - y0 - 1 / k, { fill: MKC, fa: .06, stroke: MKC, sw: 1 / k, x: ' pointer-events="none"' }), hits = ''
    for (const [h, fx, fy] of HANDLES) { const hx = x0 + (x1 - x0) * fx, hy = y0 + (y1 - y0) * fy; s += R(hx - hs / 2, hy - hs / 2, hs, hs, { fill: K0, stroke: MKC, sw: 1.2 / k, x: ' pointer-events="none"' }); hits += hit(hx - hs, hy - hs, 2 * hs, 2 * hs, 'mk-handle', ` data-h="${h}"${more}`, CURS[h]) }
    return s + hits
  }
  const pinG = (x, y, on, dir, k) => on ? G(P(`M${n(x - 5 / k)} ${n(y)}H${n(x + 5 / k)}M${n(x + 2 / k)} ${n(y - 3 / k)}L${n(x + 5 / k)} ${n(y)}L${n(x + 2 / k)} ${n(y + 3 / k)}`, { stroke: MKC, sw: 1.2 / k, cap: 'round' }), `rotate(${dir} ${n(x)} ${n(y)})`) : Cc(x, y, 2.4 / k, { fill: MKC })
  const label = (x, y, t, k, anchor = 'start') => { const sz = 9.5 / k, w = tw(t, sz) + 6 / k, x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w + 3 / k : x - 3 / k; return R(x0, y - sz * .95, w, sz * 1.3, { fill: K0, fa: .86 }) + T(x, y, t, { size: sz, c: MKC, anchor }) }      // (on a dark ground of its own: it may stand over what the room draws)
  const dist = (x0, y0, x1, y1, t, k) => { const v = x0 === x1; return P(`M${n(x0)} ${n(y0)}L${n(x1)} ${n(y1)}`, { stroke: MKC, sw: 1 / k }) + (v ? P(`M${n(x0 - 3 / k)} ${n(y0)}H${n(x0 + 3 / k)}M${n(x0 - 3 / k)} ${n(y1)}H${n(x0 + 3 / k)}`, { stroke: MKC, sw: 1 / k }) + label(x0 + 6 / k, (y0 + y1) / 2 + 3.5 / k, t, k) : P(`M${n(x0)} ${n(y0 - 3 / k)}V${n(y0 + 3 / k)}M${n(x1)} ${n(y0 - 3 / k)}V${n(y0 + 3 / k)}`, { stroke: MKC, sw: 1 / k }) + label((x0 + x1) / 2, y0 - 5 / k, t, k, 'middle')) }
  function pMaker () {
    const k = 1, l = left()
    let s = MK.try ? '' : hit(-l, 0, WW(), WH(), 'mk-canvas', '', 'default')            // (the room is the maker's while it is edited; "try it" gives it back)
    if (MK.mode === 'head') return s + pHeadCols()
    const nm = MK.sel, r = nm && rectOf(nm)
    for (const g of MK.guides) s += P(g.v ? `M${n(g.at - l)} 0V${WH()}` : `M${n(-l)} ${n(g.at)}H${n(W)}`, { stroke: MKC, sa: .6, dash: '3 3', x: ' pointer-events="none"' })
    if (!r) return s
    const x0 = r.x0 - l, x1 = r.x1 - l, y0 = r.y0, y1 = r.y1, pins = pinsOf(nm)
    let d = pinG(x0 + 12, (y0 + y1) / 2 + 16, pins[0] === 1, 180, k) + pinG((x0 + x1) / 2 + 16, y0 + 12, pins[1] === 1, -90, k) + pinG(x1 - 12, (y0 + y1) / 2 + 16, pins[2] === 1, 0, k) + pinG((x0 + x1) / 2 + 16, y1 - 12, pins[3] === 1, 90, k)
    /* how far to what is nearest above and at the left (the window's edge, or another box's) */
    const above = nearest(nm, 'y', y0), beside = nearest(nm, 'x', r.x0)
    if (above != null && y0 - above > 1) d += dist((x0 + x1) / 2 - 40, above, (x0 + x1) / 2 - 40, y0, String(Math.round(y0 - above)), k)
    if (beside != null && r.x0 - beside > 1) d += dist(beside - l, (y0 + y1) / 2 - 40, x0, (y0 + y1) / 2 - 40, String(Math.round(r.x0 - beside)), k)
    d += label(x0, y0 - 8, `${isW(nm) ? wgSaid(wgOf(nm) || {}) : MK_NAMES[nm]}   ${Math.round(r.x0)}, ${Math.round(r.y0)}   ${Math.round(r.w)} × ${Math.round(r.h)}`, k)
    return s + G(d, '', ' pointer-events="none"') + frame(x0, y0, x1, y1, k, ` data-nm="${nm}"`)      // (what is drawn takes no presses; the handles do)
  }
  /* the nearest edge above (axis y: a bottom edge or the window's top) or at the left (a right edge or the window's left) */
  function nearest (nm, axis, at) {
    let best = 0
    for (const o of BOX.names) { if (o === nm) continue; const r = rectOf(o); if (!r) continue; const e = axis === 'y' ? r.y1 : r.x1; if (e <= at + .5 && e > best) best = e }
    return best
  }
  PARTS.maker = pMaker

  /* ── the head's columns: the template at three heights, every demo track in its state, the chosen part framed ── */
  const colX = c => 24 + c * (HEAD_W + 72), doc = () => tmplOf('head') || TMPL_HEAD0
  function pHeadCols () {
    const l = left(), rows = S.tracks.map((t, i) => i), was = S.rh, wasH = S.tracks.map(t => t.h), z = MK.hz
    let s = ''
    MK.cols.forEach((rh, c) => {
      S.rh = rh; for (const t of S.tracks) delete t.h
      relayout()
      const x = colX(c), y = 64, h = rows.length * rh                              // (in the columns' own units: the group is moved to the window's left edge and scaled)
      s += label(x, y - 14, `${tmplLayout(doc(), rh).name}, ${rh}`, z, 'start').replace(MKC, INK)
      s += R(x, y, HEAD_W, h, { fill: lkC('heads.ground', K1) })
      let rowsS = ''
      for (const i of rows) rowsS += G(headRow(i), `translate(0 ${n(y + i * rh - rowY(i))})`)
      s += G(rowsS, `translate(${n(x)} 0)`, ' pointer-events="none"')
      /* each part's place, a press on it chooses it; the chosen one framed, with its distances */
      for (const i of rows) for (const p of tmplGeom(i, rh)) {
        const px = x + p.x, py = y + i * rh + p.y
        s += hit(px, py, p.w, p.h, 'mk-part', ` data-is="${p.is}" data-c="${c}"`, 'move')
        if (MK.part && MK.part.is === p.is && MK.part.c === c && i === (MK.part.i == null ? 1 : MK.part.i)) {
          const nmP = tmplGeom(i, rh).find(q => q.is === 'name'), cl = tmplGeom(i, rh).find(q => q.is === 'cells')
          let d = ''
          if (p.is === 'level' && nmP) d += dist(x + nmP.x, py + p.h + 12, px, py + p.h + 12, `${Math.round(px - x - nmP.x)} from the name`, z)
          if (p.is === 'level' && cl) d += dist(px + p.w, py + p.h + 24, x + cl.x, py + p.h + 24, `${Math.round(x + cl.x - px - p.w)} to the cells`, z)
          d += label(px, py - 8, `${p.is}   ${Math.round(p.x)}, ${Math.round(p.y)}   ${Math.round(p.w)} × ${Math.round(p.h)}`, z)
          s += G(d, '', ' pointer-events="none"') + frame(px, py, px + p.w, py + p.h, z, ` data-is="${p.is}" data-c="${c}"`)
        }
      }
    })
    S.rh = was; S.tracks.forEach((t, i) => { if (wasH[i] != null) t.h = wasH[i] }); relayout()
    /* the columns stand larger than life (z), the hand's pull read back through it (partMove) */
    return R(-l, 0, WW(), WH(), { fill: K0 }) + G(s, `translate(${n(-l)} 0) scale(${z})`) + T(48 - l, WH() - 22, 'pull a part where it should stand; its column is the layout it belongs to: thin, one line, two lines', { size: 9.5, a: .4 })
  }

  /* ── the pointer: a box or a part pressed, pulled, let go ── */
  const down0 = onDown, move0 = onMove, up0 = onUp, key0 = onKey
  onDown = function (e) { if (!MK.try && mkDown(e)) return; return down0(e) }
  onMove = function (e) { if (MK.drag) return mkMove(e); return move0(e) }
  onUp = function (e) { if (MK.drag) return mkUp(e); return up0(e) }
  onKey = function (e) { if (!MK.try && document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName) && document.activeElement.closest('.mk')) return; if (!MK.try && mkKey(e)) return; return key0(e) }
  function mkDown (e) {
    const el = e.target.closest ? e.target.closest('[data-a]') : null, a = el && el.dataset.a
    if (!a || !/^mk-/.test(a)) return false
    e.preventDefault()
    const p = pt(e), wx = p.x + left(), wy = p.y
    if (MK.mode === 'head') {
      if (a === 'mk-part') { MK.part = { is: el.dataset.is, c: +el.dataset.c, i: 1 }; MK.drag = { kind: 'part', x: wx, y: wy, is: el.dataset.is, c: +el.dataset.c, moved: false }; chrome(); uiDirty('maker') }
      else if (a === 'mk-handle' && MK.part) MK.drag = { kind: 'part-size', h: el.dataset.h, x: wx, y: wy, is: MK.part.is, c: MK.part.c, moved: false }
      else { MK.part = null; chrome(); uiDirty('maker') }
      try { svg.setPointerCapture(e.pointerId) } catch (err) {}
      return true
    }
    seed()
    if (a === 'mk-handle' && MK.sel) { MK.drag = { kind: 'size', h: el.dataset.h, x: wx, y: wy, r0: rectOf(MK.sel), moved: false } }
    else { const nm = boxAt(wx, wy); MK.sel = nm; if (nm) MK.drag = { kind: 'move', x: wx, y: wy, r0: rectOf(nm), moved: false }; chrome() }
    uiDirty('maker')
    try { svg.setPointerCapture(e.pointerId) } catch (err) {}
    return true
  }
  /* the edges a box may fall in with: every other box's, and the window's */
  function edges (nm) {
    const xs = [0, WW()], ys = [0, WH()]
    for (const o of BOX.names) { if (o === nm) continue; const r = rectOf(o); if (r) { xs.push(r.x0, r.x1); ys.push(r.y0, r.y1) } }
    return { xs, ys }
  }
  function mkMove (e) {
    const d = MK.drag, p = pt(e), wx = p.x + left(), wy = p.y
    let dx = wx - d.x, dy = wy - d.y
    if (!d.moved && Math.hypot(dx, dy) < 2) return
    if (!d.moved) { d.moved = true; snap() }
    if (d.kind === 'part' || d.kind === 'part-size') return partMove(d, dx / MK.hz, dy / MK.hz, e)      // (the columns stand larger than life)
    if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0 }
    const r0 = d.r0, r = { x0: r0.x0, y0: r0.y0, x1: r0.x1, y1: r0.y1 }
    if (d.kind === 'move') { r.x0 += dx; r.x1 += dx; r.y0 += dy; r.y1 += dy } else {
      const h = d.h
      if (h.includes('w')) r.x0 = Math.min(r0.x1 - 8, r0.x0 + dx); if (h.includes('e')) r.x1 = Math.max(r0.x0 + 8, r0.x1 + dx)
      if (h.includes('n')) r.y0 = Math.min(r0.y1 - 8, r0.y0 + dy); if (h.includes('s')) r.y1 = Math.max(r0.y0 + 8, r0.y1 + dy)
    }
    /* falling in with an edge nearby (not with alt held) */
    MK.guides = []
    if (!e.altKey) {
      const { xs, ys } = edges(MK.sel), tol = 6 / MK.k
      const fall = (v, list) => { let best = null; for (const c of list) if (Math.abs(c - v) <= tol && (best == null || Math.abs(c - v) < Math.abs(best - v))) best = c; return best }
      if (d.kind === 'move') {
        const a = fall(r.x0, xs), b = fall(r.x1, xs); if (a != null) { const s = a - r.x0; r.x0 += s; r.x1 += s; MK.guides.push({ v: true, at: a }) } else if (b != null) { const s = b - r.x1; r.x0 += s; r.x1 += s; MK.guides.push({ v: true, at: b }) }
        const c = fall(r.y0, ys), f = fall(r.y1, ys); if (c != null) { const s = c - r.y0; r.y0 += s; r.y1 += s; MK.guides.push({ v: false, at: c }) } else if (f != null) { const s = f - r.y1; r.y0 += s; r.y1 += s; MK.guides.push({ v: false, at: f }) }
      } else {
        for (const [edge, list, v] of [['x0', xs, true], ['x1', xs, true], ['y0', ys, false], ['y1', ys, false]]) { if (!d.h.includes(edge === 'x0' ? 'w' : edge === 'x1' ? 'e' : edge === 'y0' ? 'n' : 's')) continue; const c = fall(r[edge], list); if (c != null) { r[edge] = c; MK.guides.push({ v, at: c }) } }
      }
    }
    store(MK.sel, r); lay(); chrome()
  }
  function mkUp (e) {
    const d = MK.drag; MK.drag = null; MK.guides = []
    try { svg.releasePointerCapture(e.pointerId) } catch (err) {}
    uiDirty('maker'); if (d.moved) chrome()
  }
  function mkKey (e) {
    if (MK.mode === 'boxes' && MK.sel && /^Arrow/.test(e.key)) {
      e.preventDefault(); snap(); const r = rectOf(MK.sel), s = e.shiftKey ? 10 : 1, dx = e.key === 'ArrowLeft' ? -s : e.key === 'ArrowRight' ? s : 0, dy = e.key === 'ArrowUp' ? -s : e.key === 'ArrowDown' ? s : 0
      store(MK.sel, { x0: r.x0 + dx, x1: r.x1 + dx, y0: r.y0 + dy, y1: r.y1 + dy }); lay(); chrome(); return true
    }
    if (MK.mode === 'head' && MK.part && /^Arrow/.test(e.key)) { e.preventDefault(); snap(); const s = e.shiftKey ? 10 : 1; partMove({ is: MK.part.is, c: MK.part.c, kind: 'part', x: 0, y: 0, moved: true, keyed: true }, e.key === 'ArrowLeft' ? -s : e.key === 'ArrowRight' ? s : 0, e.key === 'ArrowUp' ? -s : e.key === 'ArrowDown' ? s : 0, e); return true }
    if ((e.metaKey || e.ctrlKey) && e.code === 'KeyZ') { e.preventDefault(); if (e.shiftKey) back(MK.redo, MK.undo); else back(MK.undo, MK.redo); return true }
    if ((e.key === 'Backspace' || e.key === 'Delete') && MK.mode === 'boxes' && isW(MK.sel)) { e.preventDefault(); snap(); wgSave(wgList().filter(w => 'w:' + w.id !== MK.sel)); MK.sel = null; lay(); chrome(); return true }
    if ((e.metaKey || e.ctrlKey) && e.code === 'KeyD' && MK.mode === 'boxes' && isW(MK.sel)) { e.preventDefault(); document.querySelector('[data-mk="wdup"]') && document.querySelector('[data-mk="wdup"]').click(); return true }
    if ((e.key === 'Backspace' || e.key === 'Delete') && MK.mode === 'boxes' && MK.sel && MK.sel !== 'lanes') { e.preventDefault(); snap(); delete LOOK['box.' + MK.sel]; MK.sel = null; lay(); chrome(); return true }
    if (e.key === 'Escape') { MK.sel = null; MK.part = null; uiDirty('maker'); chrome(); return true }
    return false
  }

  /* ── a part of the head pulled: its rule's offset moved by as far as the hand went (the slope kept) ── */
  const moveRule = (v, by, from) => typeof v === 'number' ? +(v + by).toFixed(1) : typeof v === 'string' ? { from: v, a: +by.toFixed(1) } : v == null ? (from ? { from, a: +by.toFixed(1) } : +by.toFixed(1)) : Object.assign({}, v, { a: +((v.a || 0) + by).toFixed(1) })
  function partMove (d, dx, dy, e) {
    const d0 = JSON.parse(JSON.stringify(doc())), rh = MK.cols[d.c], layout = tmplLayout(d0, rh), p = layout.parts.find(q => q.is === d.is)
    if (!p) return
    const ddx = d.keyed ? dx : dx - (d.ax || 0), ddy = d.keyed ? dy : dy - (d.ay || 0)      // (what the hand moved since the last step)
    d.ax = dx; d.ay = dy
    if (d.kind === 'part-size') { if (d.h.includes('e')) p.w = Math.max(8, Math.round(tv(p.w, { rh, at: {} }) + ddx)); if (d.h.includes('w')) { p.x = moveRule(p.x, ddx); p.w = Math.max(8, Math.round(tv(p.w, { rh, at: {} }) - ddx)) } }
    else if (p.is === 'cells') p.right = Math.max(0, Math.round((p.right || 10) - ddx))
    else if (p.is === 'mark') { if (p.x != null) p.x = moveRule(p.x, ddx); p.inset = moveRule(p.inset, ddy) }
    else if (p.is === 'name') { p.y = moveRule(p.y, ddy) }
    else if (p.is === 'reads') { const lv = layout.parts.find(q => q.is === 'level'); if (lv) { lv.reads.x = moveRule(lv.reads.x, ddx); lv.reads.y = moveRule(lv.reads.y, ddy) } }
    else { if (p.x != null) p.x = moveRule(p.x, ddx); if (p.y != null || p.is === 'level' || p.is === 'number' || p.is === 'triangle') p.y = moveRule(p.y, ddy) }
    LOOK['tmpl.head'] = JSON.stringify(d0)
    dirtyAll(); chrome()
  }

  /* ── the chrome, drawn again whenever something is chosen or changed ── */
  const chip = (t, on, mk, more = '', dim = false) => `<span class="chip${on ? ' on' : ''}${dim ? ' dim' : ''}" data-mk="${mk}"${more}>${esc(t)}</span>`
  const field = (l, v) => `<div class="field"><span class="l">${esc(l)}</span><span class="v">${v}</span></div>`
  const num = (k, v, unit = 'px') => `<input class="num" data-k="${k}" value="${esc(Math.round(v * 10) / 10)}"><span style="opacity:.4;margin-left:-2px">${unit}</span>`
  const PIN_WORDS = { 0: 'stays', 1: 'follows', .5: '½' }
  function chrome () {
    const l = left()
    /* the top: the theme's name, the sizes it is seen at, the demo song, the keys */
    $('mk-top').innerHTML = `<input class="name" data-mk="name" value="${esc(MK.name)}" style="position:absolute;left:12px;top:10px">
      <span class="said">${esc(MK.said)}</span>
      <div class="sizes">${MK_SIZES.map(([t, w, h]) => chip(`${t} ${w}×${h}`, MK.size[0] === w && MK.size[1] === h, 'size', ` data-w="${w}" data-h="${h}"`)).join('')}</div>
      <div class="play"><span class="key" data-mk="play">${S.playing ? 'stop' : 'play'}</span><span class="key${MK.try ? ' armed' : ''}" data-mk="try">try the room</span>${MK.alone ? '' : '<span class="key" data-mk="back" style="margin-left:14px">back to the room</span>'}</div>
      <div class="keys"><span class="key${MK.undo.length ? '' : ' dim'}" data-mk="undo">undo</span><span class="key${MK.redo.length ? '' : ' dim'}" data-mk="redo">redo</span><span class="key" data-mk="check">check</span><span class="key" data-mk="open">open .sst…</span><span class="key" data-mk="share">share as .sst…</span><span class="key armed" data-mk="keep">keep</span></div>`
    /* the left: every box, the head's template, what comes later */
    const rows = BOX.names.map(nm => { const has = LOOK['box.' + nm] != null; return `<div class="row${MK.mode === 'boxes' && MK.sel === nm ? ' on' : ''}${has ? '' : ' dim'}" data-mk="box" data-nm="${nm}"><span>${esc(MK_NAMES[nm])}</span><span class="k">${has ? (nm === 'lanes' ? 'always' : '') : '+ add'}</span></div>` }).join('')
    $('mk-left').innerHTML = `<div class="h">boxes: pressed in the room, or here</div>${rows}
      <div class="h">templates: drawn once, drawn for every track</div>
      <div class="row${MK.mode === 'head' ? ' on' : ''}" data-mk="mode" data-mode="head"><span>the head</span><span class="k">${MK.mode === 'head' ? 'editing' : 'edit…'}</span></div>
      <div class="row${MK.mode === 'boxes' ? ' on' : ''}" data-mk="mode" data-mode="boxes"><span>the room</span><span class="k">${MK.mode === 'boxes' ? 'editing' : 'back…'}</span></div>
      <div class="h">controls: pressed, one is put in the middle of the room</div>
      ${[['button', 'play, stop… any menu line'], ['readout', 'position, tempo…'], ['knob', 'the out, the tempo'], ['fader', 'the out'], ['meter', 'the out'], ['lamp', 'playing, recording…']].map(([t, k]) => `<div class="row" data-mk="add" data-is="${t}"><span>${t}</span><span class="k">${k}</span></div>`).join('')}
      <div class="h">marks</div>
      ${[['text', ''], ['shape', 'rect, disc, triangle'], ['line', ''], ['image', 'png, jpg, svg']].map(([t, k]) => `<div class="row" data-mk="add" data-is="${t}"><span>${t}</span><span class="k">${k}</span></div>`).join('')}
      ${wgList().length ? `<div class="h">widgets in the theme</div>` + wgList().map(w => `<div class="row${MK.mode === 'boxes' && MK.sel === 'w:' + w.id ? ' on' : ''}" data-mk="box" data-nm="w:${w.id}"><span>${esc(wgSaid(w))}</span></div>`).join('') : ''}`
    /* the right: what the chosen thing is */
    let right = ''
    if (MK.mode === 'head') {
      const dd = doc(), p = MK.part, lay_ = p ? tmplLayout(dd, MK.cols[p.c]) : null, part = lay_ && lay_.parts.find(q => q.is === p.is)
      right = `<div class="title">${p ? esc(p.is) + ': a part of the head' : 'the head: its template'}</div>`
      right += `<div class="h">layouts, by the row's height</div>` + field('', dd.layouts.map((L, i) => chip(`${L.name} ${L.for[0] || 0}–${L.for[1] == null ? '∞' : L.for[1]}`, p && lay_ === L, 'col', ` data-c="${i}"`)).join(''))
      if (part) {
        const rule = v => v == null ? 'none' : typeof v === 'number' ? String(v) : typeof v === 'string' ? v : `${v.from ? v.from + ' ' : ''}${v.a != null ? (v.a >= 0 && v.from ? '+ ' : '') + v.a : ''}${v.k ? ` + ${v.k} × height` : ''}${v.round ? ', rounded' : ''}${v.min != null ? `, at least ${v.min}` : ''}${v.max != null ? `, at most ${v.max}` : ''}`
        right += `<div class="h">stands at: a number, or a rule of the row's height</div>`
        for (const k of ['x', 'y', 'w', 'inset', 'right', 'room', 'size']) if (part[k] != null) right += field(k === 'right' ? 'from the right' : k === 'room' ? 'the name ends by' : k, `<span style="font-variant-numeric:tabular-nums">${esc(rule(part[k]))}</span>`)
        if (part.reads) right += field('reads at', `<span style="font-variant-numeric:tabular-nums">${esc(rule(part.reads.x))}, ${esc(rule(part.reads.y))}</span>`)
        right += `<div class="note">pull it in its column; ⇧ and the arrows move it by ten. The slope on the height (½: it stays in the row's middle) is kept.</div>`
        if (part.states) { right += `<div class="h">in each state</div>`; for (const st in part.states) right += field(st, `<span style="opacity:.6">${esc(JSON.stringify(part.states[st]))}</span>`) }
        right += `<div class="h">what comes later</div><div class="note">as a bar, a knob, a fader, an image stack; images in each state; a part added to the head; letting the user set it: later.</div>`
      } else right += `<div class="note" style="padding-left:14px">press a part in any column: the colour mark, the number, the name, the cells, the level, its reading. Each column is one layout: thin rows, one line, two lines.</div>`
    } else if (isW(MK.sel) && wgOf(MK.sel)) right = wgProps(MK.sel)
    else {
      const nm = MK.sel, r = nm && rectOf(nm)
      if (!r) right = `<div class="title">the room</div><div class="note" style="padding-left:14px">press a box in the room to choose it; pull it, or its handles; the arrows nudge it. A box pressed in the list at the left is chosen too.</div>`
      else {
        const pins = pinsOf(nm)
        right = `<div class="title">${esc(MK_NAMES[nm])}: a box</div>
          <div class="h">stands at</div>${field('left, top', num('x', r.x0) + num('y', r.y0))}${field('width, height', num('w', r.w) + num('h', r.h))}
          <div class="h">when the window grows</div>${field('the edges', chip(`left ${PIN_WORDS[pins[0]] || pins[0]}`, pins[0] === 1, 'pin', ' data-p="0"') + chip(`top ${PIN_WORDS[pins[1]] || pins[1]}`, pins[1] === 1, 'pin', ' data-p="1"'))}${field('', chip(`right ${PIN_WORDS[pins[2]] || pins[2]}`, pins[2] === 1, 'pin', ' data-p="2"') + chip(`bottom ${PIN_WORDS[pins[3]] || pins[3]}`, pins[3] === 1, 'pin', ' data-p="3"'))}
          <div class="note">pressed, an edge goes from staying, to following the window, to half way. A wider window: what follows at the right moves or stretches.</div>`
        if (nm === 'transport' || nm === 'foot') right += `<div class="h">drawn as</div>${field('', `<span style="opacity:.6">${nm === 'transport' ? (l ? `a column down the left, ${l} wide` : BAR_H ? `a band over the room, ${BAR_H} tall` : 'no band: the transport is drawn by its kind') : `a band over the foot, ${DECK_H} tall`}</span>`)}<div class="note">the transport is drawn by its kind for now (stage three draws it from widgets); its box says only how wide its column, or how tall its band, is.</div>`
        if (nm === 'heads') right += `<div class="h">the heads</div>${field('rows', '<span style="opacity:.6">follow the lanes, always</span>')}${field('width', '<span style="opacity:.6">292 for now</span>')}${field('the template', chip('edit the head…', false, 'mode', ' data-mode="head"'))}`
        if (nm === 'markers' || nm === 'bars') right += `<div class="h">the ${nm}</div>${field('time', '<span style="opacity:.6">the lanes\', always; above or under them as the box stands</span>')}`
        if (nm === 'command line') right += `<div class="h">the command line</div>${field('height', '<span style="opacity:.6">22 for now</span>')}`
        right += `<div class="h">shows</div>${field('', chip('always', true, '') + (nm === 'lanes' ? '' : chip('take it out', false, 'remove')))}`
        right += `<div class="h">looks</div><div class="note" style="padding-left:14px">fill, line, corners, shadow, opacity: later. Colours are the look's, on the display page.</div>`
      }
    }
    $('mk-right').innerHTML = right
    /* the foot: the order they are drawn in */
    const order = wgList().map(w => 'w:' + w.id).reverse().concat(['lanes', 'heads', 'bars', 'markers', 'tool', 'transport', 'foot', 'command line'].filter(nm => LOOK['box.' + nm] != null || nm === 'lanes').reverse())
    $('mk-layers').innerHTML = `<div class="h" style="display:flex">layers: what is over what<span style="margin-left:auto">${MK.warn == null ? 'press check' : MK.warn.length ? MK.warn.length + ' covered: ' + esc(MK.warn.slice(0, 3).join(', ')) : 'nothing is covered'}</span></div>
      <div class="cols">${order.map(nm => `<div class="row${MK.mode === 'boxes' && MK.sel === nm ? ' on' : ''}" data-mk="box" data-nm="${nm}" style="break-inside:avoid"><span>${esc(isW(nm) ? wgSaid(wgOf(nm) || {}) : MK_NAMES[nm])}</span><span class="k">${nm === 'lanes' ? 'under everything' : isW(nm) ? 'widget' : ''}</span></div>`).join('')}</div>
      <div class="note" style="padding-left:14px">the widgets lie over the room's parts, the later over the earlier; the parts keep their order for now.</div>`
  }
  /* what a widget is: what it does or shows, its words, where it stands, its pins, its looks */
  const sel = (k, items, v) => `<select data-wk="${k}" class="num" style="width:auto;max-width:170px">${items.map(([t, val]) => `<option value="${esc(val)}"${val === v ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`
  const txt = (k, v, w = 120) => `<input class="num" data-wk="${k}" value="${esc(v == null ? '' : v)}" style="width:${w}px">`
  const nump = (k, v, unit = '') => `<input class="num" data-wk="${k}" data-num="1" value="${v == null ? '' : v}" style="width:54px">${unit ? `<span style="opacity:.4;margin-left:-2px">${unit}</span>` : ''}`
  const col = (k, v) => `<input type="color" data-wk="${k}" value="${v || '#ECEAE4'}" style="width:22px;height:20px;padding:0;border:1px solid rgba(236,234,228,.2);background:#0E0E0E">${v ? chip('none', false, 'wnone', ` data-k="${k}"`) : `<span style="opacity:.4;font-size:9.5px">the room's</span>`}`
  /* every line of the menu bar, as a button may do it */
  const menuLines = () => { const out = []; for (const [m, lines] of MENU_BAR()) (function walk (ls, path) { for (const l of ls) { if (l === '-') continue; const [t0, k0, o = {}] = l; if (o.sub) { walk(o.sub, path + ' › ' + t0); continue } if (o.id || o.do || (k0 && KEYS[k0])) out.push([path + ' › ' + t0, 'menu:' + (o.id || `m:${out.length}`)]) } })(lines, m); return out }
  function wgProps (nm) {
    const w = wgOf(nm), r = wgRect(w), pins = pinsOf(nm)
    let s = `<div class="title">${esc(wgNames[w.is] || w.is)}: a widget</div>`
    if (w.is === 'button') s += `<div class="h">what it does</div>` + field('does', sel('does', WG_DOES.concat([['none', '']], menuLines().filter(([, v]) => !/m:\d+$/.test(v))), w.does || 'play')) + field('label', txt('label', w.label) + `<span style="opacity:.4">(none: its glyph)</span>`) + field('size', nump('size', w.size, 'px'))
    if (w.is === 'readout') s += `<div class="h">what it shows</div>` + field('shows', sel('shows', WG_SHOWS.map(x => [x, x]), w.shows || 'position')) + field('size, weight', nump('size', w.size, 'px') + sel('weight', [['regular', 400], ['medium', 500], ['bold', 600]], w.weight || 400))
    if (w.is === 'knob') s += `<div class="h">what it turns</div>` + field('does', sel('does', [['the out', 'master'], ['the tempo', 'tempo']], w.does || 'master'))
    if (w.is === 'lamp') s += `<div class="h">what it shows</div>` + field('lit when', sel('shows', WG_LAMPS.map(x => [x, x]), w.shows || 'playing')) + field('label', txt('label', w.label))
    if (w.is === 'text') s += `<div class="h">the words</div>` + field('text', txt('label', w.label, 160)) + field('size, weight', nump('size', w.size, 'px') + sel('weight', [['regular', 400], ['medium', 500], ['bold', 600]], w.weight || 400)) + field('set', sel('anchor', [['from the left', 'start'], ['in the middle', 'middle'], ['to the right', 'end']], w.anchor || 'start'))
    if (w.is === 'shape') s += `<div class="h">the shape</div>` + field('shape', sel('shape', [['rect', 'rect'], ['disc', 'disc'], ['triangle', 'triangle']], w.shape || 'rect')) + field('line width', nump('sw', w.sw, 'px'))
    if (w.is === 'line') s += `<div class="h">the line</div>` + field('width', nump('sw', w.sw, 'px')) + `<div class="note">a line runs from the box's top left to its bottom right: size the box to lay it</div>`
    if (w.is === 'image') s += `<div class="h">the image</div>` + field('', chip(w.src ? 'another image…' : 'choose an image…', false, 'wimg')) + `<div class="note">kept inside the theme (a png, jpg or svg; small ones keep the .sst small)</div>`
    s += `<div class="h">stands at</div>${field('left, top', num('x', r.x0) + num('y', r.y0))}${field('width, height', num('w', r.w) + num('h', r.h))}`
    s += `<div class="h">when the window grows</div>${field('the edges', chip(`left ${PIN_WORDS[pins[0]] || pins[0]}`, pins[0] === 1, 'pin', ' data-p="0"') + chip(`top ${PIN_WORDS[pins[1]] || pins[1]}`, pins[1] === 1, 'pin', ' data-p="1"'))}${field('', chip(`right ${PIN_WORDS[pins[2]] || pins[2]}`, pins[2] === 1, 'pin', ' data-p="2"') + chip(`bottom ${PIN_WORDS[pins[3]] || pins[3]}`, pins[3] === 1, 'pin', ' data-p="3"'))}`
    s += `<div class="h">looks</div>${field('ink', col('ink', w.ink))}${w.is === 'line' ? '' : field('fill', col('fill', w.fill) + (w.fill ? nump('fa', w.fa == null ? 100 : w.fa, '%') : ''))}${field('line', col('line', w.line) + (w.line ? nump('la', w.la == null ? 100 : w.la, '%') : ''))}${w.is === 'line' ? '' : field('corners', nump('rx', w.rx, 'px'))}${field('opacity', nump('op', w.op == null ? 100 : w.op, '%'))}`
    s += `<div class="h">the widget</div>${field('', chip('another like it ⌘D', false, 'wdup') + chip('take it out ⌫', false, 'wremove'))}`
    return s
  }
  function wgImage (nm) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/png,image/jpeg,image/svg+xml'
    inp.onchange = () => { const f = inp.files[0]; if (!f) return; if (f.size > 2 * 1024 * 1024) { MK.said = 'an image under 2 MB, please'; chrome(); return } const rd = new FileReader(); rd.onload = () => { snap(); wgSet(nm, 'src', String(rd.result)); lay(); chrome() }; rd.readAsDataURL(f) }
    inp.click()
  }
  /* a press in the chrome */
  document.addEventListener('click', e => {
    const el = e.target.closest ? e.target.closest('[data-mk]') : null
    if (!el || el.tagName === 'INPUT') return
    const mk = el.dataset.mk
    if (mk === 'add') { wgAdd(el.dataset.is); if (el.dataset.is === 'image') wgImage(MK.sel) }
    else if (mk === 'wremove' && isW(MK.sel)) { snap(); wgSave(wgList().filter(w => 'w:' + w.id !== MK.sel)); MK.sel = null; lay(); chrome() }
    else if (mk === 'wdup' && isW(MK.sel)) { snap(); const list = wgList(), w = list.find(q => 'w:' + q.id === MK.sel), c = JSON.parse(JSON.stringify(w)); c.id = Date.now().toString(36) + (list.length + 1).toString(36); c.at[0] += 16; c.at[1] += 16; list.push(c); wgSave(list); MK.sel = 'w:' + c.id; lay(); chrome() }
    else if (mk === 'wnone' && isW(MK.sel)) { snap(); wgSet(MK.sel, el.dataset.k, null); lay(); chrome() }
    else if (mk === 'wpick' && isW(MK.sel)) { snap(); wgSet(MK.sel, el.dataset.k, el.dataset.v); lay(); chrome() }
    else if (mk === 'wimg' && isW(MK.sel)) wgImage(MK.sel)
    else if (mk === 'box' && isW(el.dataset.nm)) { MK.mode = 'boxes'; MK.sel = el.dataset.nm; uiDirty('maker'); chrome() }
    else if (mk === 'box') { MK.mode = 'boxes'; const nm = el.dataset.nm; if (LOOK['box.' + nm] == null) { seed(); snap(); if (LOOK['box.' + nm] == null) { Object.assign(LOOK, { ['box.' + nm]: boxWrite()['box.' + nm] || `${left()} 0 200 100 0 0 0 0` }); lay() } } MK.sel = nm; uiDirty('maker'); chrome() }
    else if (mk === 'mode') { MK.mode = el.dataset.mode; MK.part = null; if (MK.mode === 'head') { if (!LOOK['tmpl.head']) { snap(); LOOK['tmpl.head'] = JSON.stringify(TMPL_HEAD0) } if (!NAT) demoStates() } setView(true); chrome() }      // (the demo's tracks put in their states; in the app the song's own tracks are left as they are)
    else if (mk === 'col' && MK.part) { MK.part.c = +el.dataset.c; uiDirty('maker'); chrome() }
    else if (mk === 'size') { MK.size = [+el.dataset.w, +el.dataset.h]; fitRoom(); chrome() }
    else if (mk === 'pin' && MK.sel) { snap(); const p = pinsOf(MK.sel), i = +el.dataset.p; p[i] = p[i] === 0 ? 1 : p[i] === 1 ? .5 : 0; store(MK.sel, rectOf(MK.sel), p); lay(); chrome() }
    else if (mk === 'remove' && MK.sel) { snap(); delete LOOK['box.' + MK.sel]; MK.sel = null; lay(); chrome() }
    else if (mk === 'undo') back(MK.undo, MK.redo)
    else if (mk === 'redo') back(MK.redo, MK.undo)
    else if (mk === 'play') { togglePlay(); chrome() }
    else if (mk === 'try') { MK.try = !MK.try; uiDirty('maker'); chrome() }
    else if (mk === 'check') { MK.warn = check(); chrome() }
    else if (mk === 'keep') keep()
    else if (mk === 'share') share()
    else if (mk === 'open') openFile()
    else if (mk === 'back') makerToggle()
  })
  document.addEventListener('change', e => {
    const el = e.target
    if (!el.closest || !el.closest('.mk')) return
    if (el.dataset.mk === 'name') { MK.name = el.value.trim().slice(0, 40) || 'untitled theme'; return }
    if (el.dataset.wk && isW(MK.sel)) { snap(); const k = el.dataset.wk, v = el.type === 'number' || el.dataset.num ? (el.value === '' ? null : +el.value) : el.value; wgSet(MK.sel, k, v); lay(); chrome(); return }
    if (el.classList.contains('num') && MK.sel) {
      const r = rectOf(MK.sel), v = +el.value; if (!isFinite(v)) return
      snap()
      if (el.dataset.k === 'x') { const w = r.x1 - r.x0; r.x0 = v; r.x1 = v + w } else if (el.dataset.k === 'y') { const h = r.y1 - r.y0; r.y0 = v; r.y1 = v + h } else if (el.dataset.k === 'w') r.x1 = r.x0 + Math.max(8, v); else if (el.dataset.k === 'h') r.y1 = r.y0 + Math.max(8, v)
      store(MK.sel, r); lay(); chrome()
    }
  })
  /* the demo tracks in their states, for the head's columns: one chosen, one armed, one muted, one soloed, a long name */
  function demoStates () { const t = S.tracks; if (t[1]) chooseTrack(1); if (t[2]) t[2].arm = true; if (t[3]) t[3].mute = true; if (t[4]) t[4].solo = true; if (t[5] && t[5].name.length < 20) t[5].name = 'a name so long it must be cut short'; S.selT = [] }
  /* the check: every control of the room's rows and bands, is the thing on top of its middle itself? */
  function check () {
    const g = $('g-maker'), was = g.style.display; g.style.display = 'none'
    const bad = [], r0 = board.getBoundingClientRect(), k = MK.k
    for (const sel of ['#g-head [data-a]', '#g-scenes [data-a]', '#g-ruler [data-a]', '#g-top [data-a]', '#g-cmd [data-a]', '#g-widgets [data-a]']) for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2
      if (cx < r0.left || cx > r0.right || cy < r0.top || cy > r0.bottom) continue
      const top = document.elementFromPoint(cx, cy)
      if (top && top !== el && !(top.dataset && top.dataset.a) && !el.contains(top)) bad.push(`${el.dataset.a}${el.dataset.i != null ? ' ' + el.dataset.i : ''} under ${top.dataset && top.dataset.a ? top.dataset.a : top.id || top.tagName.toLowerCase()}`)
    }
    g.style.display = was
    return [...new Set(bad)]
  }
  const themeOut = () => { const o = {}; for (const k in LOOK) if (QUAL.has(k)) o[k] = LOOK[k]; return o }
  async function keep () {
    const theme = themeOut()
    if (NAT && MK.alone) { const r = await NAT.call('lookKeepRoom', { name: MK.name, look: theme }); MK.said = r && r.ok ? `kept as ${MK.name}: in Slur Studio, settings › display` : 'could not keep it' }      // (the theme maker's own app: the room's list, not its own)
    else if (NAT) { const p = await NAT.call('prefGet'), looks = (p && p.looks) || {}; looks[MK.name] = theme; await NAT.call('prefSet', { key: 'looks', value: looks }); MK.said = `kept as ${MK.name} (settings › display)` }
    else { try { localStorage.setItem('slur.maker.' + MK.name, JSON.stringify(theme)); MK.said = `kept as ${MK.name} (this browser)` } catch (e) { MK.said = 'could not keep it' } }
    chrome()
  }
  async function share () {
    const json = JSON.stringify({ slurTheme: 1, name: MK.name, theme: themeOut() }, null, 1)
    if (NAT) { const r = await NAT.call('lookShare', { name: MK.name, json }); MK.said = r && r.ok ? 'written' : '' }
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); a.download = MK.name + '.sst'; a.click(); MK.said = 'written' }
    chrome()
  }
  function take (json, name) {
    let got = null
    try { const j = JSON.parse(json), v = j && (j.theme || j.look); got = v && typeof v === 'object' ? v : null; if (j && j.name) name = j.name } catch (e) {}
    if (!got) { MK.said = 'that file holds no theme'; chrome(); return }
    snap(); applyLook(got); MK.name = name || MK.name; MK.sel = null; MK.part = null; setView(true); MK.said = `opened ${MK.name}`; chrome()
  }
  async function openFile () {
    if (NAT) { const r = await NAT.call('lookOpen'); if (r && r.ok) take(r.json, String(r.name || '').replace(/\.sst$/, '')); return }
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.sst,.json'
    inp.onchange = () => { const f = inp.files[0]; if (!f) return; f.text().then(t => take(t, f.name.replace(/\.(sst|json)$/, ''))) }
    inp.click()
  }
  /* the theme maker's own app (Main.cpp makerApp): no project is opened (not the last one, not one handed over), no start
     page comes, nothing is ever written; its menu bar is its own */
  if (MK.alone) {
    PROJ.hold++
    openStart = () => {}
    loadProject = async () => false
    openProject = async () => {}
    menusSend = async function () {
      if (!NAT) return
      const sizes = MK_SIZES.map(([t, w, h]) => [`${t} ${w}×${h}`, null, { do: () => { MK.size = [w, h]; fitRoom(); chrome() }, on: () => MK.size[0] === w && MK.size[1] === h }])
      const lines = [
        ['File', [['Open Theme…', null, { do: () => openFile() }], ['Share as .sst…', null, { do: () => share() }], '-', ['Keep in Slur Studio', null, { do: () => keep() }]]],
        ['Edit', [['Undo', null, { do: () => back(MK.undo, MK.redo) }], ['Redo', null, { do: () => back(MK.redo, MK.undo) }]]],
        ['View', [['The Room', null, { do: () => { MK.mode = 'boxes'; MK.part = null; setView(true); chrome() }, on: () => MK.mode === 'boxes' }], ['The Head', null, { do: () => { const e = document.querySelector('[data-mk="mode"][data-mode="head"]'); if (e) e.click() }, on: () => MK.mode === 'head' }], '-'].concat(sizes)],
        ['Window', [['Minimize', '⌘KeyM', { sys: 'performMiniaturize', always: 1 }], ['Zoom', null, { sys: 'performZoom' }], '-', ['Enter Full Screen', '⌃⌘KeyF', { sys: 'toggleFullScreen', always: 1 }]]],
      ]
      MENUS.acts.clear(); MENUS.ons.clear()
      const bar = lines.map(([t, ls], i) => ({ t, en: t, sub: menuTree(ls, String(i), t) })), json = JSON.stringify(bar)
      const words = Object.fromEntries(['About Slur Studio', 'Settings…', 'Services', 'Hide Slur Studio', 'Hide Others', 'Show All', 'Quit Slur Studio'].map(w => [w, w.replace('Slur Studio', 'Slur Studio Theme Maker')]))
      if (json !== MENUS.sent) { MENUS.sent = json; MENUS.state = ''; await NAT.call('menus', { bar, words }) }
      menusTick()
    }
  }
  /* on the way in, once the room is up (boot, ui.js): the room as it comes, its boxes written out, the chrome drawn */
  const boot0 = boot
  boot = async function () { await boot0(); if (typeof START !== 'undefined') START.on = false; if (typeof tpanelSet === 'function') tpanelSet(true, false); seed(); setView(true); chrome() }
}
