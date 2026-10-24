/* ── the transport panel says what was just changed, and what is on (his ask, 2026-10-23; his pick of design/panel lit
   draft 1, "2초 지나면 꺼줘"): a value changed by hand — the tempo, a region's transpose, the grid, the out, the strip's
   level … — has a box round its name and its value, filled in the panel's ink, the two in its ground, while it is changed
   and for two seconds after; what is on — the cycle, click, low latency, automation, rubato — is boxed so for as long as it
   is on. Bauhaus the other way round: in its column a black box with paper words, in its black foot a paper box with black
   words. A mark of colour in the box keeps its colour.
   The box is laid over the panel once it is drawn, round what is drawn inside the place where the thing is pressed (where
   that place is large — the tempo's dial, the out's ring — round its words only), with what it holds drawn again on it.
   Changed by hand: a key, a press, a pull, a wheel or a pick from the Mac's menus a moment before. What plays (a line of
   automation) or what is chosen (another region, another track) lights nothing. The place in the song and its time are
   not lit: they move by themselves. ── */
const LIT_HOLD = 2000, LIT_HAND = 700
const LIT = { was: new Map(), until: new Map(), hand: -1e9, timer: 0 }
const litA = a => `[data-a="${a}"]`
/* how far past its place a thing reaches: the strip's level has its word under the place it is typed in */
const LIT_GROW = { [litA('tps-volnum')]: 14 }
for (const ev of ['pointerdown', 'keydown', 'wheel']) addEventListener(ev, () => { LIT.hand = performance.now() }, true)
addEventListener('pointermove', e => { if (e.buttons) LIT.hand = performance.now() }, true)
{ const menuDo0 = menuDo; menuDo = function () { LIT.hand = performance.now(); return menuDo0.apply(this, arguments) } }

/* what the panel shows that is changed by hand: [its place, what it belongs to, what it is now] */
function litNow () {
  const t = S.tracks[S.sel], rs = S.focus === 'tracks' ? [] : selRegs(), r = rs.length ? rs[0][0] : null
  const out = [[litA('meter'), 0, meterName()], [litA('tempo'), 0, S.tempo], [litA('key'), 0, S.key || ''], [litA('master'), 0, S.master],
    [litA('toolmenu'), 0, S.tool], [litA('modemenu'), 0, S.mode], [litA('grid'), 0, gridName()], [litA('nudge'), 0, S.nudge], [litA('qval'), 0, S.q],
    [litA('zoomx'), 0, +zoomF().toFixed(4)], [litA('zoomy'), 0, S.rh]]
  if (r) out.push([litA('rgain'), r.id, r.gain || 0], [litA('rtr'), r.id, r.tr || 0], [litA('rft'), r.id, r.ft || 0], [litA('fcurve'), r.id, `${r.fic || 0} ${r.foc || 0}`], [litA('rbpm'), r.id, r.bpm || 0])
  if (t) {
    out.push([litA('tps-volnum'), t.id, t.vol], [litA('volnum'), t.id, t.vol], [litA('mpan'), t.id, t.pan || 0], [litA('min'), t.id, t.inp || 0], [litA('mgrp'), t.id, t.grp || ''])
    ;(t.sends || []).forEach((sd, k) => out.push([`${litA('msend')}[data-k="${k}"]`, t.id + '/' + k, `${sd.to} ${sd.db}`]))
  }
  return out
}
/* what is on, boxed for as long as it is */
const litOn = () => [[litA('loop'), S.cycle.on], [litA('click'), S.click], [litA('lowlat'), S.lowLat], [litA('autokey'), S.auto], [litA('flexkey'), S.flex]]
/* each time the panel is drawn: what has changed by hand since it was drawn last is lit for two seconds more */
function litNote () {
  const now = performance.now(), byHand = now - LIT.hand < LIT_HAND, seen = new Map()
  for (const [sel, of, v] of litNow()) {
    const was = LIT.was.get(sel), now1 = typeof v === 'number' ? +v.toFixed(6) : v
    if (was && was[0] !== of) LIT.until.delete(sel)                                       // (another region or track: its own values, not changed)
    else if (was && was[1] !== now1 && byHand) LIT.until.set(sel, now + LIT_HOLD)
    seen.set(sel, [of, now1])
  }
  LIT.was = seen
}
/* the boxes, laid over the panel just drawn */
function litLay () {
  const top = $('g-top'), poster = typeof SKIN === 'object' && SKIN.k.transport === 'poster', col = $(poster ? 'bh-col' : 'tp-col')
  clearTimeout(LIT.timer)
  if (!top || !col) return
  const now = performance.now(), want = []
  for (const [sel, until] of LIT.until) if (until > now) want.push(sel); else LIT.until.delete(sel)
  for (const [sel, on] of litOn()) if (on) want.push(sel)
  if (LIT.until.size) LIT.timer = setTimeout(() => uiDirty('top'), Math.min(...LIT.until.values()) - now + 30)
  if (!want.length) return
  const scope = poster ? top : col, marks = []
  for (const e of scope.querySelectorAll('text, circle, rect, path, line, polygon, ellipse')) {
    if (e.closest('[data-a]') || e.closest('.lit')) continue
    const r = e.getBoundingClientRect()
    if (r.width >= .5 || r.height >= .5) marks.push([e, r])
  }
  const rgb = c => (String(c).match(/[\d.]+/g) || []).slice(0, 3).map(Number), grey = c => { const v = rgb(c); return v.length === 3 && Math.max(...v) - Math.min(...v) < 40 }
  for (const sel of want) {
    const hits = [...scope.querySelectorAll(sel)], h = hits[hits.length - 1]                // (the cycle has two places: its triangle, then its words — the words are boxed)
    if (!h) continue
    const q = h.getBoundingClientRect(), grow = LIT_GROW[sel] || 0, big = q.width > 60 && q.height > 60, inCol = col.contains(h)
    const x0 = q.left, x1 = q.right, y0 = q.top, y1 = q.bottom + grow
    const held = marks.filter(([e, r]) => (!big || e.tagName === 'text') && r.width <= q.width + 2 && r.height <= q.height + grow + 2
      && r.left + r.width / 2 >= x0 && r.left + r.width / 2 <= x1 && r.top + r.height / 2 >= y0 && r.top + r.height / 2 <= y1)
    if (!held.length) continue
    /* the panel's ink and ground; bauhaus: black on its paper, paper on its black foot */
    const box = poster ? (inCol ? BH.black : BH.paper) : INK, word = poster ? (inCol ? BH.paper : BH.black) : K2
    const b = held.reduce((m, [, r]) => [Math.min(m[0], r.left), Math.min(m[1], r.top), Math.max(m[2], r.right), Math.max(m[3], r.bottom)], [1e9, 1e9, -1e9, -1e9])
    const host = inCol ? col : top, back = host.getScreenCTM().inverse(), at = (x, y) => new DOMPoint(x, y).matrixTransform(back)
    const pad = 2.5, p0 = at(b[0] - pad - 1, b[1] - pad), p1 = at(b[2] + pad + 1, b[3] + pad)
    let s = R(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y, { fill: box })
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    g.setAttribute('class', 'lit'); g.setAttribute('pointer-events', 'none'); g.innerHTML = s
    for (const [e] of held) {
      const c = e.cloneNode(true), m = back.multiply(e.getScreenCTM()), st = getComputedStyle(e)
      c.removeAttribute('id'); c.setAttribute('transform', `matrix(${[m.a, m.b, m.c, m.d, m.e, m.f].map(v => n(v)).join(' ')})`)
      for (const k of ['fill-opacity', 'stroke-opacity', 'opacity']) c.removeAttribute(k)
      for (const k of ['fill', 'stroke']) { const v = st[k]; if (v && v !== 'none') c.setAttribute(k, (e.tagName === 'text' && poster && !inCol) || grey(v) ? word : v) }
      if (e.tagName === 'text') for (const [k, v] of [['font-family', st.fontFamily], ['font-size', st.fontSize], ['font-weight', st.fontWeight], ['letter-spacing', st.letterSpacing]]) if (v && v !== 'normal') c.setAttribute(k, v)
      g.appendChild(c)
    }
    host.appendChild(g)
  }
}
{ const top0 = PARTS.top
  PARTS.top = function () { litNote(); const s = top0.apply(this, arguments); queueMicrotask(litLay); return s } }

/* ── the same on the main screen (his ask, 2026-10-25: "메인 화면 안에도 어떤 값이 바뀔 때, 사각형으로 보여줘 2초 동안"): the chosen
   track's level in its head, its level, pan and sends in the mixer or the inspector, the chosen region's gain, transpose,
   fine tune and tempo in the panel under the song — changed by hand, its value boxed for two seconds, as the transport
   panel's are. These are drawn again piece by piece while they are pulled (a head's row, a strip), so the boxes are laid
   on a layer of their own over the room, each frame for as long as one is lit. ── */
const LITM = { was: new Map(), until: new Map(), raf: 0, drawn: false }
const LITM_IN = ['g-head', 'g-dock', 'g-insp']
function litMainNow () {
  const i = S.sel, t = S.tracks[i], out = []
  if (!t) return out
  const at = (a, more = '') => `[data-a="${a}"][data-i="${i}"]${more}`
  out.push([`#hd-${i} ${at('volnum')}`, t.id, t.vol], [at('mvol'), t.id, t.vol], [at('ivol'), t.id, t.vol], [at('mpan'), t.id, t.pan || 0])
  ;(t.sends || []).forEach((sd, k) => out.push([at('msend', `[data-k="${k}"]`), t.id + '/' + k, `${sd.to} ${sd.db}`], [at('mp-send', `[data-k="${k}"]`), t.id + '/' + k, `${sd.to} ${sd.db}`]))      // (a theme's knob, the mixer panel's)
  const rs = S.focus === 'tracks' ? [] : selRegs(), r = rs.length ? rs[0][0] : null
  if (r) out.push([litA('rgain'), r.id, r.gain || 0], [litA('rtr'), r.id, r.tr || 0], [litA('rft'), r.id, r.ft || 0], [litA('rbpm'), r.id, r.bpm || 0])
  return out
}
function litMainTick () {
  LITM.raf = 0
  const now = performance.now(), byHand = now - LIT.hand < LIT_HAND, seen = new Map()
  for (const [sel, of, v] of litMainNow()) {
    const was = LITM.was.get(sel), v1 = typeof v === 'number' ? +v.toFixed(6) : v
    if (was && was[0] !== of) LITM.until.delete(sel)
    else if (was && was[1] !== v1 && byHand) LITM.until.set(sel, now + LIT_HOLD)
    seen.set(sel, [of, v1])
  }
  LITM.was = seen
  for (const [sel, until] of LITM.until) if (until <= now) LITM.until.delete(sel)
  litMainLay()
  if (LITM.until.size || now - LIT.hand < LIT_HAND + 100) LITM.raf = requestAnimationFrame(litMainTick)      // (on while the hand is at work, and while a box is up)
}
function litMainLay () {
  const dock = $('g-dock')
  if (!dock) return
  let layer = $('g-litm')
  if (!layer) { layer = document.createElementNS('http://www.w3.org/2000/svg', 'g'); layer.id = 'g-litm'; layer.setAttribute('pointer-events', 'none'); dock.after(layer) }
  if (!LITM.until.size && !LITM.drawn) return                                           // (nothing up, nothing to take down)
  layer.innerHTML = ''; LITM.drawn = false
  if (!LITM.until.size) return
  const poster = typeof SKIN === 'object' && SKIN.k.transport === 'poster', box = poster ? BH.black : INK, word = poster ? BH.paper : K2
  const back = layer.getScreenCTM().inverse(), at = (x, y) => new DOMPoint(x, y).matrixTransform(back)
  for (const sel of LITM.until.keys()) for (const id of LITM_IN) {
    const scope = $(id), h = scope && scope.querySelector(sel)
    if (!h) continue
    const q = h.getBoundingClientRect(), grow = sel.includes('volnum') ? 4 : 0
    /* its value: the words drawn inside the place it is pressed (or pulled), not those of another place */
    const held = [...(h.parentNode || scope).querySelectorAll('text')].filter(e => !e.closest('[data-a]') && !e.closest('.lit')).map(e => [e, e.getBoundingClientRect()])
      .filter(([, r]) => r.width > .5 && r.left + r.width / 2 >= q.left - grow && r.left + r.width / 2 <= q.right + grow && r.top + r.height / 2 >= q.top - grow && r.top + r.height / 2 <= q.bottom + grow && r.height <= 30)
    if (!held.length) continue
    const b = held.reduce((m, [, r]) => [Math.min(m[0], r.left), Math.min(m[1], r.top), Math.max(m[2], r.right), Math.max(m[3], r.bottom)], [1e9, 1e9, -1e9, -1e9])
    const p0 = at(b[0] - 3.5, b[1] - 2.5), p1 = at(b[2] + 3.5, b[3] + 2.5)
    let s = R(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y, { fill: box })
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    g.innerHTML = s
    for (const [e] of held) {
      const c = e.cloneNode(true), m = back.multiply(e.getScreenCTM()), st = getComputedStyle(e)
      c.removeAttribute('id'); c.setAttribute('transform', `matrix(${[m.a, m.b, m.c, m.d, m.e, m.f].map(v => n(v)).join(' ')})`)
      for (const k of ['fill-opacity', 'opacity']) c.removeAttribute(k)
      c.setAttribute('fill', word)
      for (const [k, v] of [['font-family', st.fontFamily], ['font-size', st.fontSize], ['font-weight', st.fontWeight]]) if (v && v !== 'normal') c.setAttribute(k, v)
      g.appendChild(c)
    }
    layer.appendChild(g); LITM.drawn = true
    break
  }
}
for (const ev of ['pointerdown', 'keydown', 'wheel']) addEventListener(ev, () => { if (!LITM.raf) LITM.raf = requestAnimationFrame(litMainTick) })
setInterval(() => { if (!LITM.raf) litMainTick() }, 300)                                 // (what things are now, kept up while nothing is touched: a key's change is told apart from it)
addEventListener('pointermove', e => { if (e.buttons && !LITM.raf) LITM.raf = requestAnimationFrame(litMainTick) })
