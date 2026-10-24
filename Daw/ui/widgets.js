/* ── widgets: controls and marks a theme places anywhere ──
   The theme maker, stage three (his ask, 2026-10-24: 완전 자유배치). A theme carries a list of widgets under
   'widgets' (JSON): each a kind, what it does or shows, a box of eight numbers in the window's units (boxes.js), and
   how it looks. They are drawn over the room's parts (g-widgets, under the menus) and pressed as the room's own
   controls are: a button that plays is the play key, by the same hit; a knob of the out is pulled as the out's level
   is; a readout of the position is written thirty times a second. With them the transport may be taken out of its
   column and laid anywhere — a cluster floating over the lanes, say.
     { id, is: button | readout | knob | fader | meter | lamp | text | shape | line | image,
       does: play | stop | rec | tostart | loop | click | lowlat | pos | smpte | tempo | meter | key | master | menu:<id> | key:<code>,
       shows: position | time | tempo | measure | key | out | tracks | chosen track | cpu | rate | what was said (readout)
              playing | recording | cycle | click | low latency (lamp),
       at: [x y w h l t r b], label, size, weight, ink, fill, fa, line, la, rx, op, shape: rect | disc | triangle, src }
   Read after tmpl.js, before maker.js. */
QUAL.set('widgets', ['widgets', 'widgets', 's', { d: null }])
const WG = { n: 0, loop: false }
const wgList = () => { const v = LOOK.widgets; if (!v) return []; try { const a = typeof v === 'string' ? JSON.parse(v) : v; return Array.isArray(a) ? a : [] } catch (e) { return [] } }
const wgSave = list => { LOOK.widgets = JSON.stringify(list) }
/* the room's x from the window's left edge (a transport column at the left; at the right, none — skins.js colOff) */
const wgOff = () => typeof colOff === 'function' ? colOff() : (SKV.left || 0)
const wgRect = w => { const r = boxRectOf(w.at || [0, 0, 60, 28], W + (SKV.left || 0), H); return r }
/* what a theme may ask a widget to do and to show, by the room's own names */
const WG_DOES = [['play', 'play'], ['stop', 'stop'], ['record', 'rec'], ['to the start', 'tostart'], ['the cycle', 'loop'], ['the click', 'click'], ['low latency', 'lowlat'], ['the position (type it)', 'pos'], ['the time (type it)', 'smpte'], ['the tempo (type it)', 'tempo'], ['the measure', 'meter'], ['the key', 'key'], ['the out', 'master']]
const WG_SHOWS = ['position', 'time', 'tempo', 'measure', 'key', 'out', 'tracks', 'chosen track', 'cpu', 'rate', 'what was said']
const WG_LAMPS = ['playing', 'recording', 'cycle', 'click', 'low latency']
/* the transport's glyphs (ui.js pBar), each about 10 wide at scale 1 */
const WG_GLYPH = {
  tostart: 'M-5 -4.5H-3.6V4.5H-5ZM4.6 -4.5L-2.6 0L4.6 4.5Z', play: 'M-3.4 -4.8L5 0L-3.4 4.8Z', stop: 'M-4 -4H4V4H-4Z', pause: 'M-4 -4.5H-1.2V4.5H-4ZM1.2 -4.5H4V4.5H1.2Z',
  loop: 'M-5.5 .5V-1a3 3 0 0 1 3 -3H3.4M1.4 -6.2L3.8 -4L1.4 -1.8M5.5 -.5V1a3 3 0 0 1 -3 3H-3.4M-1.4 6.2L-3.8 4L-1.4 1.8', click: 'M-4 5.2L-1.7 -5.2H1.7L4 5.2ZM0 2.2L3.8 -3.2', lowlat: 'M1.3 -5.8L-3.8 .7H-.2L-1.3 5.8L3.8 -.7H.2Z',
}
const WG_LINED = new Set(['loop', 'click'])
/* is a control on: play while the song runs (not recording), record while it does, the cycle, the click, low latency */
const wgOn = does => does === 'play' ? S.playing && !S.rec : does === 'rec' ? !!S.rec : does === 'loop' ? !!S.cycle.on : does === 'click' ? !!S.click : does === 'lowlat' ? !!S.lowLat : false
const wgLit = shows => shows === 'playing' ? !!S.playing : shows === 'recording' ? !!S.rec : shows === 'cycle' ? !!S.cycle.on : shows === 'click' ? !!S.click : shows === 'low latency' ? !!S.lowLat : false
const wgMean = k => k === 'rec' || k === 'recording' ? REC : k === 'loop' || k === 'cycle' ? SOLO : k === 'lowlat' || k === 'low latency' ? MON : INK
/* what a readout says now */
function wgText (shows) {
  switch (shows) {
    case 'position': return place(curPos())
    case 'time': return smpte(curPos())
    case 'tempo': return (+S.tempo).toFixed(2)
    case 'measure': return meterName()
    case 'key': return S.key || '—'
    case 'out': return fmtDb(S.master)
    case 'tracks': return String(S.tracks.filter(t => t.kind === 'audio').length)
    case 'chosen track': { const t = S.tracks[S.sel]; return t ? t.name : '' }
    case 'cpu': return typeof STAT === 'object' ? `${Math.round(STAT.cpu * 100)}%` : ''
    case 'rate': return typeof SND_SR === 'number' ? `${+(SND_SR / 1000).toFixed(1)}k` : ''
    case 'what was said': return S.last && S.last.say ? S.last.say : ''
  }
  return ''
}
/* a widget's colours: its own, or the room's */
const wgInk = w => w.ink || INK
const wgBox = (w, x, y, ww, hh) => (w.fill ? R(x, y, ww, hh, { rx: w.rx || 0, fill: w.fill, fa: w.fa == null ? 1 : w.fa / 100 }) : '') + (w.line ? R(x + .5, y + .5, ww - 1, hh - 1, { rx: w.rx || 0, stroke: w.line, sa: w.la == null ? 1 : w.la / 100 }) : '')
/* the out's level on a ring: 0 at −48, 1 at +6 */
const wgMasterV = () => clamp((S.master + 48) / 54, 0, 1)
function wgDraw (w) {
  const r = wgRect(w), off = wgOff(), x = r.x0 - off, y = r.y0, ww = Math.max(1, r.w), hh = Math.max(1, r.h), cx = x + ww / 2, cy = y + hh / 2, id = w.id
  const op = w.op == null ? '' : ` opacity="${n(w.op / 100)}"`
  let s = '', hits = ''
  switch (w.is) {
    case 'button': {
      const does = w.does || 'play', on = wgOn(does), c = wgMean(does), ink = wgInk(w)
      s += w.fill || w.line ? wgBox(Object.assign({}, w, on ? { fill: c, fa: 100 } : {}), x, y, ww, hh) : (on ? R(x, y, ww, hh, { rx: w.rx || 0, fill: c }) : R(x + .5, y + .5, ww - 1, hh - 1, { rx: w.rx || 0, stroke: ink, sa: .24 }))
      const g = WG_GLYPH[does], k = Math.min(ww, hh) / 26 * (w.size ? w.size / 10 : 1)
      if (g && !w.label) s += G(P(g, WG_LINED.has(does) ? { stroke: on ? K1 : ink, sa: on ? 1 : .78, sw: 1.2, cap: 'round' } : { fill: on ? K1 : ink, fa: on ? 1 : .85 }), `translate(${n(cx)} ${n(cy)}) scale(${n(k)})`)
      else s += T(cx, cy + (w.size || 10) * .35, w.label || WG_DOES.find(d => d[1] === does)?.[0] || does.replace(/^(menu|key):/, ''), { size: w.size || 10, w: on ? 500 : 400, c: on ? K1 : ink, a: on ? 1 : .85, anchor: 'middle' })
      hits += /^(menu|key):/.test(does) ? hit(x, y, ww, hh, 'wg', ` data-id="${id}"`) : hit(x, y, ww, hh, does, '', does === 'master' ? 'ns-resize' : 'pointer')
      break }
    case 'readout': {
      const shows = w.shows || 'position', size = w.size || Math.max(8, Math.min(hh * .6, ww / 7))
      s += wgBox(w, x, y, ww, hh) + T(cx, cy + size * .35, wgText(shows), { size, w: w.weight || 400, c: wgInk(w), a: .92, anchor: 'middle', x: ` id="wg-${id}" style="font-variant-numeric: tabular-nums"` })
      const does = shows === 'position' ? 'pos' : shows === 'time' ? 'smpte' : shows === 'tempo' ? 'tempo' : shows === 'measure' ? 'meter' : shows === 'key' ? 'key' : shows === 'out' ? 'master' : null
      if (does) hits += hit(x, y, ww, hh, does, '', does === 'master' ? 'ns-resize' : 'pointer')
      break }
    case 'knob': {
      const does = w.does || 'master', rr = Math.max(6, Math.min(ww, hh) / 2 - 4), g = { cx, cy }, v = does === 'tempo' ? clamp(((+S.tempo) - 40) / 200, 0, 1) : wgMasterV(), ink = wgInk(w)
      s += wgBox(w, x, y, ww, hh) + P(tpArc(g, 0, 1, rr), { stroke: ink, sa: .18, sw: Math.max(2, rr / 6), cap: 'round' }) + P(tpArc(g, 0, v, rr), { stroke: ink, sa: .95, sw: Math.max(2, rr / 6), cap: 'round', x: ` id="wg-${id}-arc"` })
      const [dx, dy] = tpRing(g, v, rr - Math.max(2, rr / 6) - 3); s += R(dx - 2.5, dy - 2.5, 5, 5, { fill: ink, x: ` id="wg-${id}-dot"` })
      s += T(cx, cy + Math.min(11, rr * .5) * .35, does === 'tempo' ? (+S.tempo).toFixed(0) : fmtDb(S.master), { size: Math.min(11, rr * .5), c: ink, a: .9, anchor: 'middle', x: ` id="wg-${id}"` })
      hits += hit(x, y, ww, hh, does, '', does === 'master' ? 'ns-resize' : 'pointer')
      break }
    case 'fader': {
      const ink = wgInk(w), vert = hh >= ww, v = wgMasterV()
      s += wgBox(w, x, y, ww, hh)
      if (vert) { const fy = y + 8 + (hh - 16) * (1 - v); s += R(cx - 1, y + 8, 2, hh - 16, { fill: ink, fa: .14 }) + R(cx - 1, fy, 2, y + hh - 8 - fy, { fill: ink, fa: .8, x: ` id="wg-${id}-on"` }) + R(cx - Math.min(10, ww / 2 - 1), fy - 4, Math.min(20, ww - 2), 8, { fill: ink, x: ` id="wg-${id}-cap"` }) }
      else { const fx = x + 8 + (ww - 16) * v; s += R(x + 8, cy - 1, ww - 16, 2, { fill: ink, fa: .14 }) + R(x + 8, cy - 1, fx - x - 8, 2, { fill: ink, fa: .8, x: ` id="wg-${id}-on"` }) + R(fx - 4, cy - Math.min(10, hh / 2 - 1), 8, Math.min(20, hh - 2), { fill: ink, x: ` id="wg-${id}-cap"` }) }
      hits += hit(x, y, ww, hh, 'master', '', 'ns-resize')
      break }
    case 'meter': {
      const ink = wgInk(w), vert = hh >= ww, gap = 3
      s += wgBox(w, x, y, ww, hh)
      for (let c = 0; c < 2; c++) {
        if (vert) { const bw = (ww - 8 - gap) / 2, bx0 = x + 4 + c * (bw + gap); s += R(bx0, y + 4, bw, hh - 8, { fill: ink, fa: .12 }) + R(bx0, y + hh - 4, bw, 0, { fill: LEVEL, fa: .86, x: ` id="wg-${id}-${c}" data-h="${n(hh - 8)}" data-b="${n(y + hh - 4)}"` }) }
        else { const bh = (hh - 8 - gap) / 2, by0 = y + 4 + c * (bh + gap); s += R(x + 4, by0, ww - 8, bh, { fill: ink, fa: .12 }) + R(x + 4, by0, 0, bh, { fill: LEVEL, fa: .86, x: ` id="wg-${id}-${c}" data-w="${n(ww - 8)}"` }) }
      }
      break }
    case 'lamp': {
      const shows = w.shows || 'playing', lit = wgLit(shows), c = wgMean(shows), rr = Math.max(3, Math.min(ww, hh) / 2 - 2), ink = wgInk(w)
      s += wgBox(w, x, y, ww, hh) + Cc(x + rr + 2, cy, rr, lit ? { fill: c, x: ` id="wg-${id}"` } : { stroke: ink, sa: .5, sw: 1, x: ` id="wg-${id}"` })
      if (w.label) s += T(x + 2 * rr + 8, cy + (w.size || 9.5) * .35, w.label, { size: w.size || 9.5, c: ink, a: .7 })
      break }
    case 'text':
      s += wgBox(w, x, y, ww, hh) + T(w.anchor === 'middle' ? cx : w.anchor === 'end' ? x + ww : x, cy + (w.size || 11) * .35, asGiven(w.label || 'text'), { size: w.size || 11, w: w.weight || 400, c: wgInk(w), a: w.a == null ? 1 : w.a / 100, anchor: w.anchor || 'start' })
      break
    case 'shape': {
      const o = { fill: w.fill || 'none', fa: w.fa == null ? 1 : w.fa / 100, stroke: w.line, sa: w.la == null ? 1 : w.la / 100, sw: w.sw || 1 }
      if (!w.fill && !w.line) o.stroke = wgInk(w)
      s += (w.shape === 'disc' ? Cc(cx, cy, Math.min(ww, hh) / 2, o) : w.shape === 'triangle' ? P(`M${n(x)} ${n(y + hh)}L${n(cx)} ${n(y)}L${n(x + ww)} ${n(y + hh)}Z`, o) : R(x, y, ww, hh, Object.assign({ rx: w.rx || 0 }, o)))
      break }
    case 'line':
      s += P(`M${n(x)} ${n(y)}L${n(x + ww)} ${n(y + hh)}`, { stroke: w.line || wgInk(w), sa: w.la == null ? 1 : w.la / 100, sw: w.sw || 1, cap: 'round' })
      break
    case 'image':
      s += w.src ? `<image href="${String(w.src).replace(/"/g, '')}" x="${n(x)}" y="${n(y)}" width="${n(ww)}" height="${n(hh)}" preserveAspectRatio="xMidYMid meet"/>` : R(x + .5, y + .5, ww - 1, hh - 1, { stroke: wgInk(w), sa: .3, dash: '3 3' })
      break
  }
  return G(s + hits, '', ` data-wg="${id}"${op}`)
}
function pWidgets () {
  const list = wgList(); WG.n = list.length
  if (!list.length || (typeof START !== 'undefined' && START.on)) return ''
  return list.map(wgDraw).join('')
}
PARTS.widgets = pWidgets
{
  /* a widget that does what a menu line or a key does */
  const down0 = onDown
  onDown = function (e) {
    const el = e.target.closest ? e.target.closest('[data-a="wg"]') : null
    if (el) {
      e.preventDefault()
      const w = wgList().find(q => String(q.id) === el.dataset.id), does = w && w.does || ''
      if (/^menu:/.test(does)) { if (!MENUS.acts.size) MENU_BAR().forEach((m, i) => menuTree(m[1], String(i), m[0])); menuDo(does.slice(5)) }
      else if (/^key:/.test(does)) { const f = KEYS[does.slice(4)]; if (f) f() }
      flush(); return
    }
    return down0(e)
  }
  /* what the room draws again, the widgets draw again: the transport's state, what is chosen, what was said */
  const dirty0 = uiDirty
  uiDirty = function () { dirty0.apply(null, arguments); if (WG.n) for (const p of arguments) if (p === 'top' || p === 'cmd' || p === 'head' || p === 'scenes') { dirty0('widgets'); break } }
  /* thirty times a second: the position and the time, the lamps, the out's meters */
  function wgFrame () {
    if (!WG.n || document.hidden) return
    const p = curPos()
    for (const w of wgList()) {
      if (w.is === 'readout' && (w.shows === 'position' || w.shows === 'time' || !w.shows)) { const el = $('wg-' + w.id); if (el) { const t = w.shows === 'time' ? smpte(p) : place(p); if (el.textContent !== t) el.textContent = t } }
      else if (w.is === 'lamp') { const el = $('wg-' + w.id), lit = wgLit(w.shows || 'playing'), c = wgMean(w.shows || 'playing'); if (el && (el.getAttribute('fill') === c) !== lit) uiDirty('widgets') }
      else if (w.is === 'meter' && typeof METERS === 'object') for (let c = 0; c < 2; c++) { const el = $(`wg-${w.id}-${c}`); if (!el) continue; const f = volF(Math.min(6, linDb(METERS.mm[c] || 0))); if (el.dataset.h) { const h = +el.dataset.h * f; el.setAttribute('y', n(+el.dataset.b - h)); el.setAttribute('height', n(h)) } else el.setAttribute('width', n(+el.dataset.w * f)) }
    }
  }
  WG.frame = wgFrame                                                              // (a check reads the readouts as a frame leaves them)
  const tick = () => { try { wgFrame() } catch (e) {} setTimeout(tick, 33) }
  addEventListener('load', () => setTimeout(tick, 500))
}
