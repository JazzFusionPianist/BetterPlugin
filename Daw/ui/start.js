/* ── the start page: what the app shows when it is opened, before a project is ──
   A new project and what it can begin as across the top; under it every project the app knows, a row each, cut the way
   the room is cut: its name where a track's head would be, and in its lane the project itself seen from far away — every
   track a thin line in its own pigment where it sounds — all of them on one scale of minutes. (Daw/design/start draft 1,
   the first of its ways.) While it is up nothing behind it is touched: the room's keys and hands do not reach through
   it, and nothing is written (PROJ.hold), since no project is open yet. */
const START = { on: false, list: [], read: false, sel: 0, vy: 0, find: '', focus: 'list', tpl: 0, num: { tempo: 120, meter: [4, 4], key: '' }, busy: '', typing: '', dev: { in: '', out: '' }, free: 0, last: { key: '', at: 0 } }
/* what a new project can begin as: its tracks [name, kind, what it plays or holds]. A voice sends to the plate when there
   is one; with a print bus, the other buses play into it */
const BEGIN = [
  { name: 'empty', tracks: [] },
  { name: 'voice and guitar', tracks: [['vox'], ['vox double'], ['guitar'], ['guitar 2'], ['plate', 'bus', 'space'], ['slap', 'bus', 'delay']] },
  { name: 'band', tracks: [['drums'], ['bass'], ['keys'], ['guitar left'], ['guitar right'], ['lead vox'], ['backing vox'], ['plate', 'bus', 'space']] },
  { name: 'beat', tracks: [['kit', 'midi', 'drums'], ['bass', 'midi', 'synth'], ['keys', 'midi', 'synth'], ['pad', 'midi', 'synth'], ['lead vox'], ['plate', 'bus', 'space']] },
  { name: 'mixing', tracks: [['drums', 'bus'], ['bass', 'bus'], ['music', 'bus'], ['vocals', 'bus'], ['plate', 'bus', 'space'], ['slap', 'bus', 'delay'], ['print', 'bus']] },
]
const canNotes = () => typeof newInst === 'function'                 // tracks of notes, where the app has them
const beginKind = kind => kind === 'midi' && !canNotes() ? 'audio' : kind || 'audio'
/* a template's tracks as the room would paint them */
function beginLook (b) {
  if (b.look && b.notes === canNotes()) return b.look
  const fake = b.tracks.map(([name, kind], i) => ({ id: i + 1, name, kind: beginKind(kind) === 'bus' ? 'bus' : 'audio', inst: beginKind(kind) === 'midi' ? {} : undefined }))
  repaint(fake)
  b.notes = canNotes(); b.look = fake.map((t, i) => ({ name: t.name, kind: beginKind(b.tracks[i][1]), c: t.c }))
  return b.look
}

const ST_BAND = 158, ST_RU = 20, ST_ROW = 38, ST_FACTS = 268, ST_GB = 1073741824
const ST_DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'], ST_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
/* when a project was last saved, said as shortly as the day allows: the hour today, then the day, then the date */
function savedText (ms) {
  if (!ms) return ''
  const d = new Date(ms), now = new Date(), mid = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()), days = Math.round((mid(now) - mid(d)) / 86400000)
  return days <= 0 ? `${d.getHours()}:${pad2(d.getMinutes())}` : days === 1 ? 'yesterday' : days < 7 ? ST_DAYS[d.getDay()] : d.getFullYear() === now.getFullYear() ? `${d.getDate()} ${ST_MONTHS[d.getMonth()]}` : `${ST_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}
const weightText = b => b >= ST_GB ? `${(b / ST_GB).toFixed(1)} gb` : b >= 1048576 ? `${Math.round(b / 1048576)} mb` : b > 0 ? `${Math.max(1, Math.round(b / 1024))} kb` : ''
/* what was read from a project's file, made ready to draw: its numbers, and for every track that holds something its
   colour (as the room paints it) and where it sounds */
function factsOf (r) {
  const meter = Array.isArray(r.meter) && r.meter.length === 2 && r.meter[0] > 0 && r.meter[1] > 0 ? r.meter : [4, 4], tempo = +r.tempo > 0 ? +r.tempo : 120, spb = 240 / tempo * meter[0] / meter[1]
  const tracks = (Array.isArray(r.tracks) ? r.tracks : []).map(t => ({ id: t.id, name: String(t.name || ''), kind: t.kind || 'audio', tone: t.tone, col: Array.isArray(t.col) ? t.col : null, parent: t.parent || null, inst: t.notes ? {} : undefined, regs: Array.isArray(t.regs) ? t.regs : [] }))
  repaint(tracks)
  let end = 1
  for (const t of tracks) for (let i = 1; i < t.regs.length; i += 2) if (t.regs[i] > end) end = t.regs[i]
  return { tempo, meter, key: typeof r.key === 'string' ? r.key : '', spb, len: (end - 1) * spb, count: tracks.length, bytes: +r.bytes || 0, lanes: tracks.filter(t => t.regs.length > 1).map(t => ({ c: t.c, regs: t.regs })) }
}
/* the projects the app keeps and those kept somewhere else that it has had open, the last worked on first; one whose disk
   is not connected stays in the list, said so. Each is then read, one after the other, and drawn as it comes */
async function startList () {
  START.read = false
  const prefs = await NAT.call('prefGet'), also = prefs && Array.isArray(prefs.elsewhere) ? prefs.elsewhere.map(String) : []
  const list = ((await NAT.call('projList', { also })) || []).sort((a, b) => b.modified - a.modified)
  for (const p of list) if (!p.key) p.key = p.name                                    // one the app keeps is known by its name
  const have = new Set(list.map(p => p.key))
  for (const k of also) if (!have.has(k)) { const r = await NAT.call('projFacts', { name: k }); if (r && r.gone) list.push({ name: k.replace(/\/+$/, '').split('/').pop().replace(/\.(sls|slur)$/i, ''), key: k, gone: String(r.gone).toLowerCase(), modified: 0 }) }
  START.list = list; START.sel = 0; START.vy = 0
  uiDirty('start')
  for (const p of list) {
    if (!START.on) return
    if (p.gone) continue
    const r = await NAT.call('projFacts', { name: p.key })
    if (r && r.ok) { p.f = factsOf(r); uiDirty('start') }
  }
  START.read = true
}
const startShown = () => { const q = START.find.trim().toLowerCase(); return q ? START.list.filter(p => p.name.toLowerCase().includes(q)) : START.list }

/* ── up and away ── */
function openStart (hello) {
  if (START.on || !NAT) return
  START.on = true; START.focus = 'list'; START.find = ''; START.busy = ''; START.list = []; ST_FIND.value = ''
  PROJ.hold++                                                                          // no project is open: nothing is to be written while the page is up
  if (hello) { START.free = +hello.diskFree || 0; START.dev = { in: String(hello.inName || ''), out: String(hello.outName || '') } }
  $('cmd').style.display = 'none'
  S.menu = null; syncSlur(true)
  uiDirty('start', 'menu')
  startList()
}
/* a project has been opened or made: the room is the page again */
function closeStart () {
  if (!START.on) return
  START.on = false; START.typing = ''
  PROJ.hold--
  $('cmd').style.display = ''
  for (const el of [ST_FIND, ST_TYPE]) { el.hidden = true; el.blur() }
  syncSlur()
  uiDirty('start')
}
async function startOpen (p) {
  if (START.busy || !p || p.gone) return
  START.busy = 'open'; uiDirty('start')
  try { await openProject(p.key) } finally { START.busy = ''; uiDirty('start') }
}
async function startDisk () {
  if (START.busy) return
  START.busy = 'disk'
  try { await openProjectAsk() } finally { START.busy = ''; uiDirty('start') }
}
/* a new project, begun as the chosen template with the numbers the page shows */
async function startCreate () {
  if (START.busy) return
  START.busy = 'new'; uiDirty('start')
  const b = BEGIN[START.tpl], num = { tempo: START.num.tempo, meter: START.num.meter.slice(), key: START.num.key }
  try { await newProject(); if (!START.on) await beginAs(b, num) } finally { START.busy = ''; uiDirty('start') }
}
async function beginAs (b, num) {
  PROJ.hold++
  try {
    if (b.tracks.length) {
      S.tracks = []
      for (const [name, kind, what] of b.tracks) {
        const k = beginKind(kind), t = addTrack(k, name, S.tracks.length - 1, k === 'midi' ? { kind: what } : null)
        if (k === 'bus' && PRINT_START[what]) setPrint(t, what, PRINT_START[what])
        t.patch0 = copy(t.patch)
      }
      const plate = S.tracks.find(t => t.kind === 'bus' && t.name === 'plate'), print = S.tracks.find(t => t.kind === 'bus' && t.name === 'print')
      for (const t of S.tracks) {
        if (plate && t.kind === 'audio' && famByName(t.name) === 'vox') t.sends.push({ to: plate.id, db: -12 })
        if (print && t.kind === 'bus' && t !== print) t.out = print.id
      }
      S.sel = 0; S.selT = []
      normalizeOrder()
    }
    if (num.tempo !== S.tempo || num.meter[0] !== S.meter[0] || num.meter[1] !== S.meter[1]) { S.tempo = num.tempo; S.meter = num.meter; LOOPS = songLoops(S.tempo); await natSendLoops() }
    S.key = num.key
    UNDO.length = 0; REDO.length = 0                                                    // the project begins here: there is nothing before it to go back to
    repaint(); relayout()
    resync(); pushTransport(); applyAll()
    dirtyAll()
    PROJ.last = ''; await saveNow(false, true)
  } finally { PROJ.hold-- }
}
/* the menu bar while the page is up: a new project, one from the disk, the audio device; everything else waits for a project */
function startMenu (id) {
  if (id === 'new') startCreate()
  else if (id === 'open') startDisk()
  else if (id === 'audio') NAT.call('audioSettings')
}

/* ── drawing ── */
function startLay () {
  const y1 = ST_BAND + TOOL_H, y2 = y1 + ST_RU, yb = H - FOOT_H, lx = HEAD_W + ST_FACTS, list = startShown()
  let longest = 60
  for (const p of START.list) if (p.f && p.f.len > longest) longest = p.f.len
  return { y1, y2, yb, lx, list, pxm: Math.min(120, (W - lx - 104) / (longest / 60)), cw: Math.min(164, (W - HEAD_W) / BEGIN.length), maxVy: Math.max(0, list.length * ST_ROW - (yb - y2)) }
}
/* a key with its letter, filled when it is what return does; the return key's arrow is drawn */
function startKeyCell (xr, y, t, k, on, a, h = 24, size = 10) {
  const ret = k === '↩', [c, cw] = cells(0, 0, h, [{ t, k: ret ? ' ' : k, on, a }], { size })
  const arrow = ret ? P(`M${cw - 9.5} ${h / 2 - 3}V${h / 2 + .5}H${cw - 16.5}M${cw - 14.5} ${h / 2 - 1.5}L${cw - 16.5} ${h / 2 + .5}L${cw - 14.5} ${h / 2 + 2.5}`, { stroke: on ? K1 : INK, sa: on ? .6 : .4, cap: 'round', x: ' pointer-events="none"' }) : ''
  return G(c + arrow, `translate(${Math.round(xr - cw)} ${y})`)
}
function startBand (L) {
  const h = ST_BAND, list = startShown(), armed = START.focus === 'band' || !list.length
  let s = R(0, 0, W, h, { fill: K1 })
  BEGIN.forEach((b, i) => {
    const x = HEAD_W + i * L.cw, on = i === START.tpl
    if (on) s += R(x, 0, L.cw, h, { fill: K3 })
    s += T(x + 14, 24.4, fit(asGiven(b.name), L.cw - 28, 11, on ? 500 : 400), { size: 11, w: on ? 500 : 400, a: on ? 1 : .7 })
    beginLook(b).forEach((t, k) => { const ly = 47 + k * 13; s += R(x + 14, ly - 8, 2.5, 9.1, { fill: t.c }) + T(x + 23, ly, fit(t.name, L.cw - 28 - 9 - tw(t.kind, 9) - 8, 9.5), { size: 9.5, a: on ? .88 : .54 }) + T(x + L.cw - 14, ly, t.kind, { size: 9, a: on ? .4 : .24, anchor: 'end' }) })
    s += vline(x - .5, 0, h, on || i === START.tpl + 1 ? .1 : .07) + hit(x, 0, L.cw, h, 'st-tpl', ` data-i="${i}"`)
  })
  s += vline(HEAD_W + BEGIN.length * L.cw - .5, 0, h, .07) + T(14, 24.4, 'new project', { size: 12, w: 500, a: .94 })
  /* its three numbers, in the box the control bar keeps them in */
  const by = h - 38, num = START.num, disp = [[num.tempo.toFixed(2), 62, .86, 'st-tempo'], [`${num.meter[0]}/${num.meter[1]}`, 44, .86, 'st-meter'], [num.key || 'key', 58, num.key ? .86 : .36, 'st-key']]
  s += R(14, by, 164, 24, { rx: 2, fill: K0 }) + R(14.5, by + .5, 163, 23, { rx: 2, stroke: INK, sa: .2 })
  let cx = 14
  disp.forEach(([v, w, a, act], i) => { if (i) s += vline(cx - .5, by + 4, by + 20, .13); s += T(cx + w / 2, by + 16.2, fit(v, w - 8, 11), { size: 11, a, anchor: 'middle' }) + hit(cx, by, w, 24, act, '', act === 'st-meter' ? 'pointer' : 'text'); cx += w })
  s += startKeyCell(HEAD_W - 14, by, START.busy === 'new' ? 'creating' : 'create', '⌘n', armed, 'st-create')
  return s + hline(0, W, h - .5, .1)
}
function startTool (L) {
  const y = ST_BAND
  let s = R(0, y, W, TOOL_H, { fill: K1 }) + hline(0, W, y + TOOL_H - .5, .08) + field(14, y + 16.6, 'projects', START.list.length ? String(START.list.length) : '', { size: 10 })[0]
  let x = W - 12
  const [c, cw] = cells(0, 0, 18, [{ t: 'open from disk', k: '⌘o', a: 'st-disk' }], { size: 9.5 }); x -= cw; s += G(c, `translate(${x} ${y + 4})`)
  const fw = 172; x -= 8 + fw
  if (START.list.length) s += R(x + .5, y + 4.5, fw - 1, 17, { rx: 2, stroke: INK, sa: document.activeElement === ST_FIND ? .5 : .2 }) + (START.find || document.activeElement === ST_FIND ? '' : T(x + 9, y + 16.4, 'find', { size: 9.5, a: .34 })) + T(x + fw - 9, y + 16.2, '⌘f', { size: 8, a: .34, anchor: 'end' }) + hit(x, y + 4, fw, 18, 'st-find', '', 'text')
  ST_FIND.hidden = !START.list.length
  ST_FIND.style.cssText = `left:${x + 9}px;top:${y + 4}px;width:${fw - 36}px`
  return s
}
function startHead (L) {
  const y = L.y1, lab = (x, t, anchor = 'start') => T(x, y + 13.3, t, { size: 9, a: .38, anchor })
  let s = R(0, y, W, ST_RU, { fill: K1 }), t1 = '', t2 = ''
  s += lab(14, 'name') + lab(HEAD_W - 14, 'saved', 'end') + lab(HEAD_W + 46, 'tempo', 'end') + lab(HEAD_W + 62, 'key') + lab(HEAD_W + 148, 'tracks', 'end') + lab(HEAD_W + 198, 'length', 'end') + lab(HEAD_W + 254, 'on disk', 'end')
  /* the minutes: every one named while they stand far enough apart, then every second, fifth, tenth */
  const every = [1, 2, 5, 10, 20, 30, 60].find(k => k * L.pxm >= 44) || 60, q = L.pxm >= 80 ? 4 : L.pxm >= 30 ? 2 : 1
  for (let k = 0; L.lx + k * L.pxm / q < W; k++) {
    const x = L.lx + k * L.pxm / q
    if (k % q === 0) { const m = k / q; t1 += `M${n(x) + .5} ${y + (m % every ? 12 : 4)}V${y + ST_RU}`; if (m % every === 0) s += T(x + 4, y + 11.6, `${m}:00`, { size: 8.5, a: .58 }) } else t2 += `M${n(x) + .5} ${y + (q === 4 && k % 2 ? 16 : 12)}V${y + ST_RU}`
  }
  return s + P(t2, { stroke: INK, sa: .14 }) + P(t1, { stroke: INK, sa: .26 }) + hline(0, W, y + ST_RU - .5, .1) + vline(HEAD_W - .5, y, y + ST_RU, .08)
}
/* a project seen from far away: its tracks one under the other, each as tall as the row has room for */
function startOverview (x0, y, f, pxm) {
  const cnt = f.lanes.length
  if (!cnt) return ''
  const pitch = Math.min(3, (ST_ROW - 12) / cnt), bh = Math.max(.8, pitch - (pitch >= 2 ? .8 : pitch > 1.2 ? .4 : .12)), y0 = y + (ST_ROW - cnt * pitch) / 2 + (pitch - bh) / 2, k = f.spb / 60 * pxm, by = new Map()
  f.lanes.forEach((t, i) => { let d = by.get(t.c) || ''; for (let j = 0; j + 1 < t.regs.length; j += 2) { const xa = x0 + (t.regs[j] - 1) * k, w = Math.max(1, (t.regs[j + 1] - t.regs[j]) * k - .7); d += `M${n(xa)} ${n(y0 + i * pitch)}h${n(w)}v${n(bh)}h${n(-w)}z` } by.set(t.c, d) })
  let out = ''
  for (const [c, d] of by) out += P(d, { fill: c })
  return out
}
function startRow (L, p, i, y) {
  const h = ST_ROW, by = y + h / 2 + 3.9, on = i === START.sel, wt = on ? 500 : 400, f = p.f, ind = p.dir && !START.find.trim() ? 16 : 0, where = p.in ? String(p.in).toLowerCase() : p.dir && !ind ? String(p.dir).toLowerCase() : ''      // (ind: under its folder it is set in; found by name, it says which folder instead)
  let s = R(0, y, L.lx, h, { fill: on ? K3 : K1 }) + R(L.lx, y, W - L.lx, h, { fill: on ? K1 : K0 })
  const saved = savedText(p.modified), nm = fit(asGiven(p.name), HEAD_W - 28 - ind - tw(saved, 9.5) - 12 - (where ? Math.min(90, tw(where, 9.5)) + 9 : 0), 11.5, wt)
  s += T(14 + ind, by, nm, { size: 11.5, w: wt, a: p.gone ? .34 : on ? 1 : .9 })
  if (where) s += T(14 + ind + tw(nm, 11.5, wt) + 9, by, fit(where, 90, 9.5), { size: 9.5, a: .36 })
  s += T(HEAD_W - 14, by, saved, { size: 9.5, a: on ? .8 : .5, anchor: 'end' })
  const fa = on ? .9 : .62, num = (x, v) => T(x, by, v, { size: 9.5, a: fa, anchor: 'end' })
  if (p.gone) s += T(HEAD_W + 22, by, fit(`on ${p.gone}, which is not connected`, W - HEAD_W - 44, 9.5), { size: 9.5, a: .34 })
  else if (f) s += num(HEAD_W + 46, String(+f.tempo.toFixed(1))) + T(HEAD_W + 62, by, fit(f.key, 56, 9.5), { size: 9.5, a: fa }) + num(HEAD_W + 148, String(f.count)) + (f.len > 0 ? num(HEAD_W + 198, mmss(f.len)) : '') + num(HEAD_W + 254, weightText(f.bytes)) + startOverview(L.lx, y, f, L.pxm)
  s += hline(0, W, y + h - .5, .06) + hit(0, y, W, h, 'st-row', ` data-i="${i}"`, 'default')
  if (on && !p.gone) s += startKeyCell(W - 14, y + 9, START.busy === 'open' ? 'opening' : 'open', '↩', START.focus === 'list', 'st-open', 20, 9.5)
  return s
}
function startFoot (L) {
  const y = L.yb, by = y + 14.6
  let s = R(0, y, W, FOOT_H, { fill: K2 }) + hline(0, W, y, .1), x = W - 10
  const ko = { h: 16, size: 9, pad: 8, a: 'st-audio' }, kw = keyW('audio settings', ko); x -= kw; s += key(x, y + 3, 'audio settings', ko)[0]
  const cell = (label, v) => { if (!v) return; x -= 12; s += vline(x, y + 6, y + FOOT_H - 6, .1); x -= 12; x -= tw(v, 9.5); s += T(x, by, v, { size: 9.5, a: .8 }); x -= 5; x -= tw(label, 9.5); s += T(x, by, label, { size: 9.5, a: .4 }) }
  cell('disk', START.free > 0 ? `${(START.free / ST_GB).toFixed(1)} gb free` : '')
  cell('buffer', STAT.buf ? String(STAT.buf) : '')
  cell('rate', `${+(SND_SR / 1000).toFixed(1)}k`)
  cell('out', fit(START.dev.out.toLowerCase(), 190, 9.5)); cell('in', fit(START.dev.in.toLowerCase(), 190, 9.5))
  if (S.last && S.last.say) s += T(14, by, fit(S.last.say, x - 40, 9.5), { size: 9.5, a: .6 })              // what the app has to say meanwhile (a project that would not open, little room on the disk)
  return s
}
function pStart () {
  if (!START.on) return ''
  const L = startLay(), id = 'stl' + (++UID)
  START.vy = clamp(START.vy, 0, L.maxVy); START.sel = clamp(START.sel, 0, Math.max(0, L.list.length - 1))
  const first = Math.floor(START.vy / ST_ROW)
  let s = hit(0, 0, W, H, 'st-none', '', 'default') + R(0, 0, W, H, { fill: K0 }) + R(0, L.y2, L.lx, L.yb - L.y2, { fill: K1 }), rowsS = '', grid = ''
  for (let i = first; i < L.list.length && L.y2 + i * ST_ROW - START.vy < L.yb; i++) rowsS += startRow(L, L.list[i], i, L.y2 + i * ST_ROW - START.vy)
  for (let m = 1; L.lx + m * L.pxm < W; m++) grid += `M${n(L.lx + m * L.pxm) + .5} ${L.y2}V${L.yb}`
  s += `<clipPath id="${id}"><rect x="0" y="${L.y2}" width="${W}" height="${Math.max(0, L.yb - L.y2)}"/></clipPath>` + G(rowsS, '', ` clip-path="url(#${id})"`)
  s += P(grid, { stroke: INK, sa: .035, x: ' pointer-events="none"' }) + vline(HEAD_W - .5, L.y2, L.yb, .08) + vline(L.lx - .5, L.y1, L.yb, .08)
  return s + startBand(L) + startTool(L) + startHead(L) + startFoot(L)
}
PARTS.start = pStart

/* ── hands and keys ── */
/* the two places where something is typed: a name to find among the projects, and a number of the new project's */
const ST_FIND = document.createElement('input'), ST_TYPE = document.createElement('input')
for (const [el, id, label] of [[ST_FIND, 'st-find', 'find a project'], [ST_TYPE, 'st-type', 'tempo or key']]) { el.id = id; el.type = 'text'; el.hidden = true; el.autocomplete = 'off'; el.spellcheck = false; el.setAttribute('autocapitalize', 'off'); el.setAttribute('aria-label', label); $('board').appendChild(el) }
ST_FIND.addEventListener('input', () => { START.find = ST_FIND.value; START.sel = 0; START.vy = 0; uiDirty('start') })
ST_FIND.addEventListener('focus', () => uiDirty('start')); ST_FIND.addEventListener('blur', () => uiDirty('start'))
ST_TYPE.addEventListener('blur', () => startTyped(true))
function startType (what) {
  startTyped(true)
  const by = ST_BAND - 38, x = what === 'tempo' ? 14 : 14 + 106, w = what === 'tempo' ? 62 : 58
  START.typing = what
  ST_TYPE.style.cssText = `left:${x}px;top:${by}px;width:${w}px;height:24px`
  ST_TYPE.value = what === 'tempo' ? String(+START.num.tempo.toFixed(2)) : START.num.key
  ST_TYPE.hidden = false; ST_TYPE.focus(); ST_TYPE.select()
}
/* what was typed is taken (a tempo the room would take, a key as it is written) or let go */
function startTyped (take) {
  const what = START.typing
  if (!what) return
  START.typing = ''
  const v = ST_TYPE.value.trim()
  ST_TYPE.hidden = true
  if (take && what === 'tempo') { const bpm = parseFloat(v.replace(',', '.')); if (bpm >= 20 && bpm <= 400) START.num.tempo = Math.round(bpm * 100) / 100 }
  else if (take && what === 'key') START.num.key = v.toLowerCase().slice(0, 12)
  uiDirty('start')
}
function startChoose (i, L) {
  START.sel = clamp(i, 0, Math.max(0, L.list.length - 1)); START.focus = 'list'
  const y = START.sel * ST_ROW, room = L.yb - L.y2
  if (y < START.vy) START.vy = y; else if (y + ST_ROW > START.vy + room) START.vy = y + ST_ROW - room
  uiDirty('start')
}
function startDown (e) {
  e.stopPropagation()
  if (e.button || START.busy) return
  const el = e.target.closest ? e.target.closest('[data-a]') : null, a = el ? el.dataset.a : '', L = startLay()
  if (a !== 'st-find' && document.activeElement === ST_FIND) ST_FIND.blur()
  if (a !== 'st-tempo' && a !== 'st-key') startTyped(true)
  if (a === 'st-tpl') { START.tpl = +el.dataset.i; START.focus = 'band'; uiDirty('start') }
  else if (a === 'st-create') startCreate()
  else if (a === 'st-tempo') { e.preventDefault(); startType('tempo') }
  else if (a === 'st-key') { e.preventDefault(); startType('key') }
  else if (a === 'st-meter') openMenu(14 + 62, ST_BAND - 12, MEASURES.map(m => ({ t: `${m[0]}/${m[1]}`, v: m, on: m[0] === START.num.meter[0] && m[1] === START.num.meter[1] })), it => { START.num.meter = it.v.slice(); uiDirty('start') }, { w: 84 })
  else if (a === 'st-find') { e.preventDefault(); ST_FIND.focus() }
  else if (a === 'st-disk') startDisk()
  else if (a === 'st-audio') NAT.call('audioSettings')
  else if (a === 'st-open') startOpen(L.list[START.sel])
  else if (a === 'st-row') {
    const i = +el.dataset.i, p = L.list[i], now = performance.now(), twice = p && START.last.key === p.key && now - START.last.at < 450
    START.last = { key: p ? p.key : '', at: now }
    startChoose(i, L)
    if (twice) startOpen(p)
  }
}
function startKey (e) {
  if (!START.on) return
  e.stopImmediatePropagation()                                                          // the room's keys are not for this page
  if (typeof folderKey === 'function' && folderKey(e)) return                          // (folders.js: a folder being named, made or taken away)
  const L = startLay(), cmd = e.metaKey || e.ctrlKey, at = e.target
  if (S.menu) { if (e.key === 'Escape') { S.menu = null; uiDirty('menu') } e.preventDefault(); return }
  if (cmd && e.code === 'KeyN') { e.preventDefault(); startTyped(true); startCreate(); return }
  if (cmd && e.code === 'KeyO') { e.preventDefault(); startDisk(); return }
  if (cmd && e.code === 'KeyF') { e.preventDefault(); if (START.list.length) { ST_FIND.focus(); ST_FIND.select() } return }
  if (cmd || e.altKey) return
  if (at === ST_TYPE) { if (e.key === 'Enter') { e.preventDefault(); startTyped(true) } else if (e.key === 'Escape') { e.preventDefault(); startTyped(false) } return }
  const enter = e.code === 'Enter' || e.code === 'NumpadEnter'
  if (at === ST_FIND && !enter && !/^Arrow(Up|Down)$/.test(e.code)) { if (e.key === 'Escape') { e.preventDefault(); ST_FIND.value = ''; START.find = ''; ST_FIND.blur() } return }
  if (e.code === 'ArrowDown' || e.code === 'ArrowUp') { e.preventDefault(); if (L.list.length) startChoose(START.focus === 'list' ? START.sel + (e.code === 'ArrowDown' ? 1 : -1) : START.sel, L) }
  else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { e.preventDefault(); START.tpl = clamp(START.tpl + (e.code === 'ArrowRight' ? 1 : -1), 0, BEGIN.length - 1); START.focus = 'band'; uiDirty('start') }
  else if (e.code === 'Tab') { e.preventDefault(); START.focus = START.focus === 'list' && L.list.length ? 'band' : 'list'; uiDirty('start') }
  else if (enter) { e.preventDefault(); if (e.repeat) return; if (START.focus === 'band' || !L.list.length) startCreate(); else startOpen(L.list[START.sel]) }
  else if (e.key.length === 1 && e.key !== ' ' && START.list.length && at !== ST_FIND) ST_FIND.focus()      // a letter begins a search: it lands in the box
  else if (at !== ST_FIND) e.preventDefault()
}
{
  const g = $('g-start')
  g.addEventListener('pointerdown', startDown)
  g.addEventListener('wheel', e => { e.preventDefault(); e.stopPropagation(); const L = startLay(), vy = clamp(START.vy + e.deltaY, 0, L.maxVy); if (vy !== START.vy) { START.vy = vy; uiDirty('start') } }, { passive: false })
  g.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation() })
  addEventListener('keydown', startKey, true)
  /* nothing dropped on the page lands in the room behind it */
  for (const ev of ['dragover', 'drop']) addEventListener(ev, e => { if (START.on) { e.preventDefault(); e.stopImmediatePropagation() } }, true)
  if (NAT) NAT.on('dawDevice', d => { if (!d) return; START.dev = { in: String(d.inName || ''), out: String(d.outName || '') }; if (START.on) uiDirty('start') })
}
