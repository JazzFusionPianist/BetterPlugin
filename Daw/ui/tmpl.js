/* ── templates: a track's head drawn from a document, so that a theme may move its parts ──
   The theme maker, stage two (his ask, 2026-10-24; design/theme maker draft 1, his OK): a head is a template — drawn
   once, drawn for every track. The template holds layouts, one for each range of row heights (thin, one line, two
   lines); a layout holds parts in the order they are drawn, each with its place in the row and how it looks in each
   state. A number in a part is a number, or a rule worked out from the row's height and a place in it:
     { a, k, from, round, min, max }  →  clamp(round?(a + k × height + from), min, max)
   where `from` names a place: 'name' (where the name begins), 'cells' (where the cells begin), 'right' (the head's
   width), 'size' (the look's size of names), 'mark' (the look's width of the colour mark).
   TMPL_HEAD0 is the head as it comes (ui.js headRow), written as a template: tmplHead(i) draws the same string as
   headRow(i) for every track in every state at every height (test/tmpl.mjs holds it to that). A theme carries its own
   under 'tmpl.head' (a kind of its own, 's': not on the display page; kept by display.js clean); with none, headRow
   draws as it always did. Read after boxes.js; ui.js headRow asks tmplOn('head') first. */
QUAL.set('tmpl.head', ['tmpl.head', 'the head', 's', { d: null }])
const TMPL = { on: true }
const tmplOn = what => TMPL.on && LOOK['tmpl.' + what] != null && !(typeof SKIN === 'object' && SKIN.heads)
const tmplOf = what => { const v = LOOK['tmpl.' + what]; return typeof v === 'string' ? JSON.parse(v) : v }
/* the head as it comes: every number of headRow, as rules of the row's height */
const TMPL_HEAD0 = {
  drawn: 36,
  layouts: [
    { name: 'thin', for: [0, 17], thin: true,
      parts: [
        { is: 'wash', when: 'in a stack' }, { is: 'wash', when: 'bus' }, { is: 'wash', when: 'chosen' }, { is: 'stack lines' },
        { is: 'mark', x: 10, inset: { k: .22, round: true, min: 4, max: 11 }, states: { stack: { x: 0, inset: 0, joined: true } } },
        { is: 'number', x: 18, y: { a: 3.5, k: .5 }, size: 8.5, states: { stack: { x: 25, y: { a: 3.5, k: .5 }, anchor: 'end' } } },
        { is: 'triangle', x: 34, y: { a: -.1, k: .5 }, states: { 'in a stack': { x: { from: 'name', a: -7 } } } },
        { is: 'name', x: 'name', y: { a: 3.9, k: .5 }, room: 128 }, { is: 'tag' }, { is: 'press' }, { is: 'group' },      // (thin: the name's own line is the row's middle; its y is the group's)
        { is: 'cells', right: 10, cw: 14, gap: 2, size: 8.5 },
        { is: 'level', x: 138, w: 40, y: { a: -1, k: .5 }, reads: { x: 212, y: { a: 3.5, k: .5 } } },
        { is: 'rule' },
      ] },
    { name: 'one line', for: [17, 36],
      parts: [
        { is: 'wash', when: 'in a stack' }, { is: 'wash', when: 'bus' }, { is: 'wash', when: 'chosen' }, { is: 'stack lines' },
        { is: 'mark', x: 10, inset: { k: .22, round: true, min: 4, max: 11 }, states: { stack: { x: 0, inset: 0, joined: true } } },
        { is: 'number', x: 18, y: { a: 3.5, k: .5 }, size: 8.5, states: { stack: { x: 25, y: { a: 3.5, k: .5 }, anchor: 'end' } } },
        { is: 'triangle', x: 34, y: { a: -.1, k: .5 }, states: { 'in a stack': { x: { from: 'name', a: -7 } } } },
        { is: 'name', x: 'name', y: { a: 3.9, k: .5 }, room: 128 }, { is: 'tag' }, { is: 'press' }, { is: 'group' },
        { is: 'cells', right: 10, cw: 14, gap: 2, size: 8.5 },
        { is: 'level', x: 138, w: 40, y: { a: -1, k: .5 }, reads: { x: 212, y: { a: 3.5, k: .5 } } },
        { is: 'rule' },
      ] },
    { name: 'two lines', for: [36, null],
      parts: [
        { is: 'wash', when: 'in a stack' }, { is: 'wash', when: 'bus' }, { is: 'wash', when: 'chosen' }, { is: 'stack lines' },
        { is: 'mark', x: 10, inset: { k: .22, round: true, min: 4, max: 11 }, states: { stack: { x: 0, inset: 0, joined: true } } },
        { is: 'number', x: 18, y: { a: -1.9, k: .5 }, size: 8.5, states: { stack: { x: 25, y: { a: 3.5, k: .5 }, anchor: 'end' } } },
        { is: 'triangle', x: 34, y: { a: -.1, k: .5 }, states: { 'in a stack': { x: { from: 'name', a: -7 } } } },
        { is: 'name', x: 'name', y: { a: -1.5, k: .5 }, room: { from: 'cells', a: -12 } }, { is: 'tag' }, { is: 'press' }, { is: 'group' },
        { is: 'cells', right: 10, cw: 14, gap: 2, size: 8.5 },
        { is: 'level', x: 'name', w: 110, y: { a: 9, k: .5 }, reads: { x: { from: 'level end', a: 30 }, y: { a: 12.6, k: .5 } } },
        { is: 'rule' },
      ] },
  ],
}
/* a template's number, worked out for a row */
function tv (e, c) {
  if (e == null) return 0
  if (typeof e === 'number') return e
  if (typeof e === 'string') return c.at[e] != null ? c.at[e] : +e
  let v = (e.a || 0) + (e.k || 0) * c.rh + (e.from != null ? tv(e.from, c) : 0)
  if (e.round) v = Math.round(v)
  if (e.min != null) v = Math.max(v, tv(e.min, c))
  if (e.max != null) v = Math.min(v, tv(e.max, c))
  return v
}
/* a part as it is in a row's states: its own fields, then each state's over them, in the template's order */
const tmplPart = (p, states) => { if (!p.states) return p; const o = Object.assign({}, p); for (const k in p.states) if (states.has(k)) Object.assign(o, p.states[k]); return o }
/* the layout for a row's height: the first whose range holds it (the last, past every range) */
function tmplLayout (doc, rh) { const L = doc.layouts || []; return L.find(l => (l.for[0] == null || rh >= l.for[0]) && (l.for[1] == null || rh < l.for[1])) || L[L.length - 1] }

/* ── a head drawn from its template: what headRow draws, part by part, each where its template puts it ── */
function tmplHead (i) {
  const doc = tmplOf('head'), t = S.tracks[i], rh = rowH(i), y = rowY(i), sel = isChosen(i), stack = t.kind === 'stack', par = t.parent ? byId(t.parent) : null
  const ups = []
  for (let x = par, k = 0; x && k < 16; x = x.parent ? byId(x.parent) : null, k++) ups.unshift(x)
  const deep = ups.length, x0 = 42 + deep * (HEAD_IN - 42)
  const nx = S.tracks[i + 1], on = par ? !!nx && (nx === ups[0] ? false : insideOf(nx, ups[0])) : stack && t.open && !!nx && nx.parent === t.id
  const lay = tmplLayout(doc, rh), thin = !!lay.thin
  const states = new Set()
  if (sel) states.add('chosen'); if (stack) states.add('stack'); if (par) states.add('in a stack'); if (t.kind === 'bus') states.add('bus')
  if (t.mute) states.add('muted'); if (t.solo) states.add('soloed'); if (t.arm) states.add('armed'); if (t.mon) states.add('listening')
  if (t.theirs) states.add('theirs'); if (t.frozen) states.add('frozen'); if (S.auto) states.add('automation on'); if (thin) states.add('thin')
  const its = cellsOf(t), hs = lkN('heads.size')
  const c = { rh, at: { right: HEAD_W, size: hs, mark: lkN('heads.mark'), name: x0, cells: HEAD_W - 10 - squaresW(its.length, HEAD_CW) } }
  /* the places parts lean on, read ahead: where the cells begin, where the level ends */
  for (const p0 of lay.parts) {
    const p = tmplPart(p0, states)
    if (p.is === 'cells') { c.cw = p.cw || HEAD_CW; c.gap = p.gap == null ? 2 : p.gap; c.at.cells = HEAD_W - tv(p.right, c) - squaresW(its.length, c.cw, c.gap) }
    if (p.is === 'level') { c.lx = tv(p.x, c); c.lw = tv(p.w, c); c.at['level end'] = c.lx + c.lw }
  }
  const grp = t.kind === 'audio' && t.grp ? t.grp : '', grpW = grp ? (typeof grpChipW === 'function' ? grpChipW(t) : tw(grp, 9, 500) + 7) : 0
  const alt = t.kind === 'audio' && (t.alts || []).length ? `alt ${altName(t)}` : ''
  const tag = t.theirs || (t.kind === 'bus' ? 'bus' : t.frozen ? 'frozen' : alt), tagW = tag ? tw(tag, 9, 400, !!t.theirs) + 6 : 0, wt = stack || sel ? 500 : 400
  let s = '', k = '', nm = '', ny = 0, namePart = null
  for (const p0 of lay.parts) {
    const p = tmplPart(p0, states)
    if (p.when && !states.has(p.when)) continue
    switch (p.is) {
      case 'wash':
        if (p.when === 'in a stack') s += R(3, y, HEAD_W - 3, rh, { fill: K0, fa: .55 })
        else if (p.when === 'bus') s += R(3, y, HEAD_W - 3, rh - 1, { fill: t.c, fa: busWash(t) })
        else if (p.when === 'chosen') s += R(0, y, HEAD_W, rh, { fill: lkC('heads.chosen'), fa: lkA('heads.chosen') })
        break
      case 'stack lines':
        if (!par) break
        s += R(0, y, 3, on ? rh : rh - 1, { fill: ups[0].c, fa: ups[0].mute ? .4 : 1 })
        for (let q = 1; q < deep; q++) { const more = !!nx && insideOf(nx, ups[q]); s += R(44 + (q - 1) * (HEAD_IN - 42), y, 3, more ? rh : rh - 1, { fill: ups[q].c, fa: ups[q].mute ? .4 : 1 }) }
        s += R(44 + (deep - 1) * (HEAD_IN - 42), y + 5, 3, Math.max(4, rh - 10), { fill: t.c, fa: t.mute ? .4 : 1 })
        break
      case 'mark': {
        const ins = tv(p.inset, c), x = tv(p.x, c)
        s += R(x, y + ins, lkN('heads.mark'), p.joined ? (on ? rh : rh - 1) : rh - 2 * ins, { fill: t.c, fa: t.mute ? .4 : 1 })
        break }
      case 'number':
        if (lk('heads.num') === 'on') k += T(tv(p.x, c), y + tv(p.y, c), pad2(i + 1), Object.assign({ size: p.size || 8.5, a: sel ? .8 : .32 }, p.anchor ? { anchor: p.anchor } : {}))
        break
      case 'triangle':
        if (stack) s += triMark(tv(p.x, c), y + tv(p.y, c), t.open, .62)
        break
      case 'name': {
        namePart = p
        const room = tv(p.room, c)
        nm = fit(asGiven(t.name), room - x0 - tagW - grpW, hs, wt)
        ny = y + tv(p.y, c)
        const nameY = thin ? y + rh / 2 + Math.min(hs, rh - 2) * .36 : ny      // (a thin row: the name in its middle, as large as fits)
        if (!thin || rh >= 9) s += T(x0, nameY, nm, { size: thin ? Math.min(hs, rh - 2) : hs, w: wt, a: t.mute ? .42 : sel ? 1 : .88 })
        break }
      case 'tag':
        if (tag && !thin) s += T(x0 + tw(nm, hs, wt) + 6, ny, tag, { size: 9, it: !!t.theirs, a: .4 })
        break
      case 'press':
        s += hit(0, y, c.at.cells - 4, rh, 'sel', ` data-i="${i}"`) + (stack ? hit(deep ? x0 - 13 : 27, y, 14, rh, 'fold', ` data-i="${i}"`) : '')
        break
      case 'group':
        if (grp) s += typeof grpChip === 'function' ? grpChip(t, i, x0 + tw(nm, hs, wt) + 8 + tagW, ny) : T(x0 + tw(nm, hs, wt) + 6 + tagW, ny, grp, { size: 9, w: 500, a: S.grpOff ? .22 : .62 })
        break
      case 'cells':
        k += squareCells(c.at.cells, y + (rh - c.cw) / 2, its, c.cw, p.size || 8.5, i, c.gap)
        break
      case 'level': {
        const vol = shown(t, 'vol'), led = autoPts(t, 'vol').length > 0, lx = c.lx, lw = c.lw, ly = y + tv(p.y, c), dbx = tv(p.reads.x, c), dby = y + tv(p.reads.y, c)
        if (S.auto) {
          const q = apOf(t), bx0 = lx - .5
          k += R(bx0, ly - 6, 40, 13, { rx: 0, stroke: INK, sa: .22 }) + T(bx0 + 3.5, ly + 3.4, fit(autoName(t, q), 34, 8.5), { size: 8.5, a: .8 }) + hit(bx0 - 1.5, ly - 7, 43, 15, 'ap', ` data-i="${i}"`)
          k += T(dbx, dby, AUTO[q].fmt(shown(t, q)), { size: 8.5, a: autoPts(t, q).length ? .9 : .56, anchor: 'end' })
        } else {
          k += levelBar(lx, ly, lw, t, vol) + hit(lx - 6, ly - 7, lw + 12, 16, 'vol', ` data-i="${i}" data-gx="${n(lx)}" data-gw="${n(lw)}"`, 'ew-resize')
          k += T(dbx, dby, fmtDb(vol), { size: 9, a: t.ghost != null || led || sel ? .9 : .56, anchor: 'end' })
          if (!led) k += hit(dbx - 30, ly - 7, 32, 16, 'volnum', ` data-i="${i}"`, 'default')
        }
        break }
      case 'rule':
        break
    }
  }
  const gone = typeof RTB !== 'undefined' ? rtbHideOf(i) : 0
  if (thin) k = ''
  s += gone <= 0 ? k : gone < 1 ? G(k, `translate(${n(-16 * gone)} 0)`, ` opacity="${n(1 - gone)}"`) : ''
  return s + (lay.parts.some(p => p.is === 'rule') ? hline(0, HEAD_W, y + rh - .5, stack ? .09 : .05) : '')
}
/* where each part of a head stands, for the theme maker to take hold of: [{is, x, y, w, h}] in the row's own units
   (x from the head's left edge, y from the row's top), worked out from the same rules the drawing uses */
function tmplGeom (i, rh) {
  const doc = tmplOf('head') || TMPL_HEAD0, t = S.tracks[i]
  if (!t) return []
  const stack = t.kind === 'stack', par = !!t.parent, sel = isChosen(i), lay = tmplLayout(doc, rh), thin = !!lay.thin
  const states = new Set([sel && 'chosen', stack && 'stack', par && 'in a stack', t.kind === 'bus' && 'bus', t.mute && 'muted', thin && 'thin', S.auto && 'automation on'].filter(Boolean))
  const its = cellsOf(t), hs = lkN('heads.size'), x0 = 42 + depthOf(t) * (HEAD_IN - 42)
  const c = { rh, at: { right: HEAD_W, size: hs, mark: lkN('heads.mark'), name: x0, cells: HEAD_W - 10 - squaresW(its.length, HEAD_CW) } }
  for (const p0 of lay.parts) { const p = tmplPart(p0, states); if (p.is === 'cells') { c.cw = p.cw || HEAD_CW; c.gap = p.gap == null ? 2 : p.gap; c.at.cells = HEAD_W - tv(p.right, c) - squaresW(its.length, c.cw, c.gap) } if (p.is === 'level') { c.lx = tv(p.x, c); c.lw = tv(p.w, c); c.at['level end'] = c.lx + c.lw } }
  const out = [], wt = stack || sel ? 500 : 400, nm = fit(asGiven(t.name), 120, hs, wt)
  for (const p0 of lay.parts) {
    const p = tmplPart(p0, states)
    if (p.when && !states.has(p.when)) continue
    if (p.is === 'mark') { const ins = tv(p.inset, c); out.push({ is: 'mark', x: tv(p.x, c) - 2, y: ins, w: lkN('heads.mark') + 4, h: Math.max(4, rh - 2 * ins) }) }
    else if (p.is === 'number' && lk('heads.num') === 'on') { const x = tv(p.x, c), w = tw('00', p.size || 8.5); out.push({ is: 'number', x: p.anchor === 'end' ? x - w : x, y: tv(p.y, c) - 8, w, h: 11 }) }
    else if (p.is === 'name') { const y = thin ? rh / 2 + Math.min(hs, rh - 2) * .36 : tv(p.y, c); out.push({ is: 'name', x: x0, y: y - hs * .8, w: Math.max(24, tw(nm, hs, wt)), h: hs + 3 }) }
    else if (p.is === 'cells' && !thin) out.push({ is: 'cells', x: c.at.cells, y: (rh - c.cw) / 2, w: squaresW(its.length, c.cw, c.gap), h: c.cw })
    else if (p.is === 'level' && !thin) { const ly = tv(p.y, c); out.push({ is: 'level', x: c.lx, y: ly - 7, w: c.lw, h: 16 }); out.push({ is: 'reads', x: tv(p.reads.x, c) - 30, y: tv(p.reads.y, c) - 9, w: 32, h: 12 }) }
  }
  return out
}
