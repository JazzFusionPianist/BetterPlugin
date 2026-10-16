/* ── settings > plug-ins: every plug-in on the Mac, by kind or by maker, each in the room's lists or left out of them ──
   design/plugins draft 1 (his ask, 2026-10-16: "안쓰는 Plug-in 을 선택할 수 있게해서 리스트에 안보이게"; his OK, way 1 and
   way 2 both). Down the left the kinds (the room's own: cats.js) or the makers, each with how many of it are in the
   room's lists, and a field over them that finds a plug-in by its name or its maker's; on the right the chosen one's
   plug-ins in two columns, each ticked while it is in the room's lists (the patch's, the wall's, the instruments').
   Pressed, it is left out or taken back in, at once (settingsSet plugOut: kept by the app, and the room told). A song
   that has one that is left out still opens it. ⌘Z takes the last change back. */
const PG = { list: null, out: new Set(), by: 'kind', group: null, find: '', gs: 0, rs: 0, hist: [], looking: false, wheel: 0, gMax: 0, rMax: 0, rows: [] }
const PTX = 28, PTW = 196, PX0 = PTX + PTW + 36, PG_PER = 25, PG_GROUPS = 25

const pgKind = p => p.inst ? 'instruments' : plugCat(p)
const pgMaker = p => p.maker || 'others'
const pgIn = p => PG.by === 'maker' ? pgMaker(p) : pgKind(p)
const pgWord = g => PG.by === 'maker' && g !== 'others' ? asGiven(g.toLowerCase()) : g
const pgShown = p => !PG.out.has(p.id)
/* a tick box: filled with a tick while the plug-in is in the room's lists */
const pgTick = (x, y, on) => on ? R(x, y, 12, 12, { rx: 2, fill: INK }) + P(`M${x + 3} ${y + 6.2}L${x + 5.2} ${y + 8.4}L${x + 9.2} ${y + 3.8}`, { stroke: K1, sw: 1.4, cap: 'round' }) : R(x + .5, y + .5, 11, 11, { rx: 2, stroke: INK, sa: .32 })
/* the plug-ins the find field leaves (all of them when nothing is typed) */
function pgPool () {
  const q = PG.find.trim().toLowerCase()
  return q ? PG.list.filter(p => (p.name + ' ' + (p.maker || '')).toLowerCase().includes(q)) : PG.list
}
/* the groups down the left: the kinds in the room's order, or the makers with the most first ('others' last) */
function pgGroups (pool) {
  if (PG.by !== 'maker') return ['instruments'].concat(PLUG_CATS).filter(k => pool.some(p => pgKind(p) === k))
  const n = new Map()
  for (const p of pool) n.set(pgMaker(p), (n.get(pgMaker(p)) || 0) + 1)
  return [...n.keys()].sort((a, b) => (a === 'others') - (b === 'others') || n.get(b) - n.get(a) || a.localeCompare(b))
}

function plugBody () {
  const PR = DISP_W - SIDE - 28
  let b = T(28, 34, 'plug-ins', { size: 13, w: 500, a: .94 })
  const hx = 28 + tw('plug-ins', 13, 500) + 12
  if (!PG.list) return b + T(hx, 34, 'looking', { size: 10, a: .45 }) + hline(28, PR, 54, .1)
  const outN = PG.list.filter(p => !pgShown(p)).length
  b += T(hx, 34, PG.looking ? 'looking' : outN ? `${PG.list.length} on this Mac, ${outN} left out of the room’s list` : `${PG.list.length} on this Mac, all in the room’s list`, { size: 10, a: .45 })
  let kx = PR
  for (const [t, a] of [['look again', 'p-again'], ['bring every one back', 'p-back']]) { const w = keyW(t, { size: 10, pad: 10 }); kx -= w; b += key(kx, 20, t, { h: 20, size: 10, pad: 10, a })[0]; kx -= 8 }
  b += hline(28, PR, 54, .1)
  /* down the left: by kind or by maker, the field, the groups */
  b += cells(PTX, 66, 20, [{ t: 'by kind', on: PG.by !== 'maker', a: 'p-by', more: ' data-v="kind"' }, { t: 'by maker', on: PG.by === 'maker', a: 'p-by', more: ' data-v="maker"' }], { size: 9.5, pad: 12, widths: [PTW / 2, PTW / 2] })[0]
  const typing = !document.getElementById('ed').hidden
  b += R(PTX + .5, 96.5, PTW - 1, 21, { rx: 2, stroke: INK, sa: typing ? .5 : .22 }) + (typing ? '' : PG.find ? T(PTX + 9, 110.6, fit(asGiven(PG.find), PTW - 18, 10), { size: 10, a: .9 }) : T(PTX + 9, 110.6, 'find a plug-in', { size: 10, a: .36 })) + hit(PTX, 96, PTW, 22, 'p-find', '', 'text')
  const pool = pgPool(), finding = !!PG.find.trim(), groups = pgGroups(pool)
  if (PG.group != null && !groups.includes(PG.group)) PG.group = finding ? null : groups[0]
  if (PG.group == null && !finding) PG.group = groups[0]
  const lines = (finding ? [null] : []).concat(groups)                // (while something is typed: everything found, first)
  PG.gMax = Math.max(0, lines.length - PG_GROUPS); PG.gs = Math.max(0, Math.min(PG.gs, PG.gMax))
  let y = 130
  for (const grp of lines.slice(PG.gs, PG.gs + PG_GROUPS)) {
    const its = grp == null ? pool : pool.filter(p => pgIn(p) === grp), n = its.length, o = its.filter(p => !pgShown(p)).length, on = grp === PG.group
    if (on) b += R(PTX, y, PTW, 20, { rx: 2, fill: INK })
    b += T(PTX + 10, y + 13.6, fit(grp == null ? 'everything found' : pgWord(grp), PTW - 70, 10, on ? 500 : 400), { size: 10, w: on ? 500 : 400, c: on ? K1 : INK, a: on ? 1 : .72 })
    b += T(PTX + PTW - 10, y + 13.6, o ? `${n - o} of ${n}` : String(n), { size: 9.5, c: on ? K1 : INK, a: on ? .7 : .38, anchor: 'end' })
    b += hit(PTX, y, PTW, 20, 'p-group', ` data-v="${grp == null ? '' : esc(grp).replace(/"/g, '&quot;')}"`)
    y += 21
  }
  if (PG.gs < PG.gMax) b += T(PTX + 10, DISP_H - 14, `and ${PG.gMax - PG.gs} more, a scroll away`, { size: 9, a: .32 })
  if (!lines.length) b += T(PTX + 10, 143.6, 'nothing found', { size: 10, a: .4 })
  b += vline(PTX + PTW + 16, 62, DISP_H - 10, .1)
  /* the chosen group: every plug-in in it, ticked while it is in the room's lists */
  const rows = PG.group == null ? pool : pool.filter(p => pgIn(p) === PG.group)
  PG.rows = rows
  if (!rows.length) return b
  const o = rows.filter(p => !pgShown(p)).length, title = PG.group == null ? asGiven(`“${PG.find.trim()}”`) : pgWord(PG.group)
  b += T(PX0, 82, fit(title, 300, 12, 500), { size: 12, w: 500, a: .95 }) + T(PX0 + Math.min(300, tw(title, 12, 500)) + 10, 82, o ? `${rows.length - o} of ${rows.length} in the list` : `all ${rows.length} in the list`, { size: 9.5, a: .42 })
  kx = PR
  for (const [t, a] of [['leave all out', 'p-none'], ['take all in', 'p-all']]) { const w = keyW(t, { size: 9.5, pad: 9 }); kx -= w; b += key(kx, 69, t, { h: 18, size: 9.5, pad: 9, a })[0]; kx -= 6 }
  b += hline(PX0, PR, 98, .1)
  /* two columns, in blocks of as many as the window holds: the first column filled before the second, and the next block
     under them, a scroll away */
  const colW = (PR - PX0 - 24) / 2, lineOf = i => Math.floor(i / (PG_PER * 2)) * PG_PER + i % PG_PER
  PG.rMax = Math.max(0, lineOf(rows.length - 1) + 1 - PG_PER); PG.rs = Math.max(0, Math.min(PG.rs, PG.rMax))
  rows.forEach((p, i) => {
    const r = lineOf(i) - PG.rs
    if (r < 0 || r >= PG_PER) return
    const cx = PX0 + (i % (PG_PER * 2) >= PG_PER ? colW + 24 : 0), ry = 108 + r * 22, on = pgShown(p)
    b += pgTick(cx, ry + 3, on)
    const nm = fit(asGiven(p.name.replace(/^UAD /, '')), colW - 120, 10.5), nw = Math.min(colW - 120, tw(nm, 10.5))
    b += T(cx + 22, ry + 13, nm, { size: 10.5, a: on ? .9 : .36 })
    const side = PG.by === 'maker' ? p.kind : p.maker ? asGiven(p.maker.toLowerCase()) : ''
    if (side) b += T(cx + 22 + nw + 8, ry + 13, fit(side, colW - 22 - nw - 8 - 34, 9, 400, PG.by !== 'maker'), { size: 9, a: on ? .38 : .2, it: PG.by !== 'maker' })
    b += T(cx + colW, ry + 13, p.fmt || '', { size: 8.5, a: on ? .32 : .18, anchor: 'end' })
    b += hit(cx - 4, ry, colW + 8, 20, 'p-tick', ` data-n="${i}"`)
  })
  const below = rows.filter((p, i) => lineOf(i) - PG.rs >= PG_PER).length
  if (below) b += T(PX0, DISP_H - 14, `and ${below} more, a scroll away`, { size: 9.5, a: .38 })
  return b
}

/* ── a change: kept by the app and told to the room at once ── */
function pgSend (again) { if (NAT) NAT.call('settingsSet', { what: 'plugOut', value: [...PG.out], again: !!again }) }
function pgSet (ps, out) {
  const ids = ps.map(p => p.id).filter(id => PG.out.has(id) !== out)
  if (!ids.length) return
  PG.hist.push([...PG.out]); if (PG.hist.length > 200) PG.hist.shift()
  for (const id of ids) out ? PG.out.add(id) : PG.out.delete(id)
  pgSend(); draw()
}
function pgUndo () { if (!PG.hist.length) return; PG.out = new Set(PG.hist.pop()); pgSend(); draw() }

async function plugPress (el) {
  const a = el.dataset.a, v = el.dataset.v
  if (a === 'p-by') { if (PG.by !== v) { PG.by = v; PG.group = null; PG.gs = 0; PG.rs = 0 } draw() }
  else if (a === 'p-group') { PG.group = v === '' ? null : v; PG.rs = 0; draw() }
  else if (a === 'p-tick') { const p = PG.rows[+el.dataset.n]; if (p) pgSet([p], pgShown(p)) }
  else if (a === 'p-none') pgSet(PG.rows, true)
  else if (a === 'p-all') pgSet(PG.rows, false)
  else if (a === 'p-back') pgSet(PG.list.filter(p => !pgShown(p)), false)
  else if (a === 'p-again') await plugRead(true)
  else if (a === 'p-find') {
    const r = el.getBoundingClientRect()
    dType(r.left + 1, r.top + 1, PTW - 2, PG.find, t => { PG.find = t }, { live: t => { PG.find = t; PG.group = null; PG.gs = 0; PG.rs = 0; draw() }, bare: true })
    draw()
  }
}
function plugWheel (e) {
  if (!PG.list) return
  PG.wheel += e.deltaY
  const steps = Math.trunc(PG.wheel / 22)
  if (!steps) return
  PG.wheel -= steps * 22
  if (e.clientX < SIDE + PTX + PTW + 16) PG.gs = Math.max(0, Math.min(PG.gMax, PG.gs + steps)); else PG.rs = Math.max(0, Math.min(PG.rMax, PG.rs + steps))
  draw()
}
/* the plug-ins on the Mac, asked of the app (again: looked for afresh, and the room told to ask again too); what was
   left out, as the app keeps it, read once */
async function plugRead (again) {
  if (PG.looking) return
  PG.looking = true
  draw()
  let list = []
  if (NAT) {
    const [l, p] = await Promise.all([NAT.call('plugins'), PG.list ? null : NAT.call('prefGet')])
    list = Array.isArray(l) ? l : []
    if (p) PG.out = new Set((Array.isArray(p.plugOut) ? p.plugOut : []).map(String))
  } else { list = (window.PLUG_STAND_IN || []).map(p => Object.assign({}, p)); if (!PG.list) PG.out = new Set(window.PLUG_STAND_OUT || []) }      // (a browser: the stand-in the page was handed)
  for (const p of list) p.id = String(p.id || p.name)
  PG.list = plugMakers(list).sort((a, b) => a.name.localeCompare(b.name))
  for (const p of PG.list) p.kind = pgKind(p)
  PG.looking = false
  if (again) pgSend(true)
  draw()
}
