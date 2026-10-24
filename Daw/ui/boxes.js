/* ── the boxes: every surface of the room is a box the theme places ──
   His ask (2026-10-24): a theme maker where anyone lays the room out by drag and drop, with full freedom (완전
   자유배치) — design/theme maker draft 1, his OK. A theme says where a surface stands by eight numbers, as REAPER's
   WALTER has them: x y w h at the size the theme was drawn at, then how far each edge (left, top, right, bottom) goes
   when the window grows — 0 stays where it was, 1 follows the window, ½ half as far. The numbers are in the window's
   units, the transport's column counted (the room's own x begins at the column's edge).
   Stage one: the lanes, the heads, the markers, the bars, the tool row, the command line and the transport's bands are
   placed by their boxes. What stays linked, for good: the heads' rows are the lanes' rows (a head may stand anywhere
   across, never on other rows); the markers' and the bars' time is the lanes' time (a row may stand above or under
   the lanes). The panel opens over the lanes' foot, as it does; a row under the lanes keeps its place below it.
   A theme with no boxes is the room as its transport's kind cuts it (skins.js), to the pixel: boxWrite() says that
   cut as boxes, and test/boxes.mjs holds the room to it. Read last: it wraps skinLayout (skins.js), relayout
   (ui.js, inspector.js), the head and the command line (PARTS), setVolX, startRename and onDown. */
const BOX = { on: true, names: ['transport', 'foot', 'tool', 'markers', 'bars', 'heads', 'lanes', 'command line'], said: false, drawn: [1728, 1117], dx: 0, cmdDy: 0, in: false }
/* the qualities a theme carries: 'box.<name>' = "x y w h l t r b", 'box.drawn' = "W H". A kind of their own ('s'): the
   display page does not list them — the theme maker writes them; a theme kept as one's own keeps them (display.js clean) */
for (const nm of BOX.names.concat(['drawn'])) QUAL.set('box.' + nm, ['box.' + nm, nm, 's', { d: null }])
const boxSaid = () => BOX.on && BOX.names.some(nm => LOOK['box.' + nm] != null)
const boxNums = s => String(s).trim().split(/[\s,]+/).map(Number)
/* a box at the window's size (WW × WH, window units): its edges moved from where they were drawn by their pins */
function boxRect (nm, WW, WH) {
  const v = LOOK['box.' + nm]
  if (v == null) return null
  const [x, y, w, h, l = 0, t = 0, r = 0, b = 0] = boxNums(v), dW = WW - BOX.drawn[0], dH = WH - BOX.drawn[1]
  const x0 = x + l * dW, x1 = x + w + r * dW, y0 = y + t * dH, y1 = y + h + b * dH
  return { x0, y0, x1, y1, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) }
}
/* the room as it is cut now, said as boxes (the window's units; the inspector, slur and the panel closed): what the
   theme maker starts from, and what the test holds the room to */
function boxWrite () {
  const left = SKV.left || 0, WW = W + left, WH = H, o = { 'box.drawn': `${WW} ${WH}` }
  const say = (nm, x0, y0, x1, y1, l, t, r, b) => { o['box.' + nm] = [x0, y0, x1 - x0, y1 - y0, l, t, r, b].map(v => +(+v).toFixed(1)).join(' ') }
  if (left) say('transport', 0, 0, left, WH, 0, 0, 0, 1)
  else if (BAR_H) say('transport', 0, 0, WW, BAR_H, 0, 0, 1, 0)
  if (DECK_H) say('foot', 0, WH - DECK_H, WW, WH, 0, 1, 1, 1)
  if (!SKIN.noTool) say('tool', 0, TOOL_Y, WW, TOOL_Y + TOOL_H, 0, 0, 1, 0)
  const panel = S.panel.h * VIEW.p, hx = SKIN.right ? X1 : X0 - HEAD_W
  say('markers', left + X0, MK_Y, left + X1, MK_Y + MK_H, 0, 0, 1, 0)
  say('bars', left + X0, RU_Y, left + X1, RU_Y + RU_H, 0, 0, 1, 0)
  say('heads', left + hx, TY, left + hx + HEAD_W, BY + panel, SKIN.right ? 1 : 0, 0, SKIN.right ? 1 : 0, 1)
  say('lanes', left + X0, TY, left + X1, BY + panel, 0, 0, 1, 1)
  say('command line', left, H - FOOT_H, WW, H, 0, 1, 1, 1)
  return o
}
{
  /* the transport's bands, from its boxes: a column down the left (the room's x counted from its edge), a band over
     the room, a band over the foot — the kind's own cut when the theme says nothing */
  const lay0 = skinLayout
  skinLayout = function () {
    BOX.said = boxSaid()
    if (!BOX.said) { BOX.drawn = [W + (SKV.left || 0), H]; return lay0() }
    skinRead()
    SKIN.right = false                                                            // (where the heads stand, the box says)
    SKIN.noTool = SKIN_NO_TOOL.has(SKIN.k.transport) || LOOK['box.tool'] == null
    const left0 = SKV.left || 0, WW = W + left0, WH = H
    BOX.drawn = LOOK['box.drawn'] != null ? boxNums(LOOK['box.drawn']) : [WW, WH]
    const t = boxRect('transport', WW, WH), f = boxRect('foot', WW, WH)
    const col = !!t && t.x0 <= .5 && t.y0 <= .5 && t.y1 >= WH - .5 && t.w < WW / 2
    const top = !!t && !col && t.y0 <= .5 && t.h < WH / 2
    BAR_H = top ? Math.round(t.h) : 0
    DECK_H = Math.round(f ? f.h : t && !col && !top && t.y1 >= WH - .5 ? t.h : 0)
    const left = col ? Math.round(t.w) : 0
    if (SKV.left !== left) { SKV.left = left; if (typeof fitRoom === 'function' && typeof board !== 'undefined' && !BOX.in) { BOX.in = true; try { fitRoom() } finally { BOX.in = false } } }
  }
  /* the rows and the heads, from their boxes, once the room is cut as it comes */
  const relayout0 = relayout
  relayout = function () {
    relayout0()
    BOX.dx = 0; BOX.cmdDy = 0
    if (!BOX.said || (typeof RTB !== 'undefined' && RTB.on)) return
    const left = SKV.left || 0, WW = W + left, WH = H
    const at = nm => { const r = boxRect(nm, WW, WH); return r ? { x0: r.x0 - left, x1: r.x1 - left, y0: r.y0, y1: r.y1 } : null }      // (room units)
    const lanes = at('lanes'), heads = at('heads'), marks = at('markers'), bars = at('bars'), tool = at('tool'), cmd = at('command line')
    const insp = typeof INSP === 'object' && INSP.w ? INSP.w : 0, panel = S.panel.h * VIEW.p
    if (lanes) { X0 = Math.round(lanes.x0) + insp; X1 = Math.min(Math.round(lanes.x1), RX); TY = Math.round(lanes.y0); BY = Math.round(lanes.y1) - panel; LANES_H = Math.max(0, BY - TY) }
    if (marks) MK_Y = Math.round(marks.y0)
    if (bars) RU_Y = Math.round(bars.y0)
    if (tool) TOOL_Y = Math.round(tool.y0)
    if (heads) BOX.dx = Math.round(heads.x0)
    if (cmd) { BOX.cmdDy = Math.round(cmd.y0) - (H - FOOT_H); if ($('cmd')) $('cmd').style.top = Math.round(cmd.y0) + 'px' }
    /* the clips: the lanes; the heads (in their own units); and what the playhead runs through — the rows together */
    const set = (id, x, y, w, h) => { const r = $(id).firstChild; r.setAttribute('x', n(x)); r.setAttribute('y', n(y)); r.setAttribute('width', n(Math.max(0, w))); r.setAttribute('height', n(Math.max(0, h))) }
    const rows = [[TY, BY], marks ? [MK_Y, MK_Y + MK_H] : null, bars ? [RU_Y, RU_Y + RU_H] : null].filter(Boolean)
    const top = Math.min(...rows.map(r => r[0])), bot = Math.max(...rows.map(r => r[1]))
    set('tl', X0, top, X1 - X0, bot - top); set('ln', X0, TY, X1 - X0, LANES_H); set('hdc', 0, TY, HEAD_W, LANES_H)
    PXB = Math.max(PXB, fitPXB()); VX = clamp(VX, 0, maxVX()); VY = clamp(VY, 0, maxVY())
  }
  /* the heads drawn where their box stands (their own units begin at 0); the command line likewise */
  const head0 = PARTS.head
  PARTS.head = function () { const s = head0.apply(this, arguments); return BOX.dx ? G(s, `translate(${BOX.dx} 0)`) : s }
  const cmd0 = PARTS.cmd
  PARTS.cmd = function () { const s = cmd0.apply(this, arguments); return BOX.cmdDy ? G(s, `translate(0 ${BOX.cmdDy})`) : s }
  /* a head's level is read from where the pointer is, and its name typed over it: both in the heads' own units */
  const vol0 = setVolX
  setVolX = function (i, x, e) { return vol0(i, x - BOX.dx, e) }
  const rename0 = startRename
  startRename = function (what, i, at) { const r = rename0(what, i, at); if (what === 'track' && BOX.dx) { const el = $('rename'); el.style.left = (parseFloat(el.style.left) + BOX.dx) + 'px' } return r }
  const down0 = onDown
  onDown = function (e) { const r = down0(e); if (drag && drag.a === 'vol' && drag.lx != null && BOX.dx) drag.lx -= BOX.dx; return r }
}
