/* ── folders among the projects (the start page) ──
   A folder is a row of the list, as a stack is a row of the room: a mark that opens it, its name, how many it holds; open,
   its projects stand under it, set in. A project's row is taken hold of and let go on a folder (or on one of its
   projects) to be put in it; let go among the projects that are in no folder, it is taken out again. On the disk a
   folder is a folder in the projects' place, so the Finder shows the same. New folder: the key beside the count, or shift
   command n; its name is typed where it stands. An empty folder is taken away with the delete key.
   While something is looked for by name, the folders step back: every project that matches is listed, wherever it lies.
   (Read after the start page is made, before it is put to work: see the end.) */
const FOLD = { list: [], open: new Set(), naming: null, press: null, drag: null, rows: new Map() }
const FOLD_IN = document.createElement('input')
{ FOLD_IN.type = 'text'; FOLD_IN.hidden = true; FOLD_IN.autocomplete = 'off'; FOLD_IN.spellcheck = false; FOLD_IN.dataset.own = '1'; FOLD_IN.setAttribute('autocapitalize', 'off'); FOLD_IN.setAttribute('aria-label', 'the folder’s name')
  FOLD_IN.style.cssText = 'position:absolute;box-sizing:border-box;height:22px;padding:0 5px;margin:0;border:1px solid rgba(236,234,228,.5);border-radius:2px;outline:0;background:#0E0E0E;color:var(--ink);caret-color:var(--ink);font:500 11.5px var(--f);-webkit-user-select:text;user-select:text'
  document.getElementById('board').appendChild(FOLD_IN) }
const foldSay = t => { say(t); uiDirty('start') }
const foldKeep = () => { if (NAT) NAT.call('prefSet', { key: 'foldersOpen', value: [...FOLD.open] }) }
/* a folder's row: one thing for as long as the folder is (the list is asked for again and again; what is chosen is known by its place in it) */
function foldRow (name, kids) {
  let r = FOLD.rows.get(name)
  if (!r) { r = { folder: name, name, key: 'folder:' + name }; FOLD.rows.set(name, r) }
  r.n = kids.length; r.modified = Math.max(0, ...kids.map(p => p.modified || 0))
  return r
}
function foldToggle (name, to) {
  const open = to == null ? !FOLD.open.has(name) : to
  if (open) FOLD.open.add(name); else FOLD.open.delete(name)
  foldKeep(); uiDirty('start')
}
/* a new folder: a row at the head of the list with its name being typed */
function foldNew () {
  if (START.busy || FOLD.naming || !NAT) return
  if (START.find) { ST_FIND.value = ''; START.find = '' }
  FOLD.naming = { folder: '', name: '', key: 'folder:', naming: true, n: 0, modified: 0 }
  START.sel = 0; START.vy = 0; START.focus = 'list'
  uiDirty('start'); flush()
  const y = startLay().y2 + (ST_ROW - 22) / 2
  FOLD_IN.style.left = '28px'; FOLD_IN.style.top = y + 'px'; FOLD_IN.style.width = (HEAD_W - 28 - 14) + 'px'
  FOLD_IN.value = 'untitled folder'; FOLD_IN.hidden = false; FOLD_IN.focus(); FOLD_IN.select()
}
async function foldNamed (take) {
  if (!FOLD.naming) return
  const name = FOLD_IN.value.trim()
  FOLD.naming = null; FOLD_IN.hidden = true; FOLD_IN.blur()
  if (take && name) {
    const r = await NAT.call('folderNew', { name })
    if (r && r.ok) { FOLD.list.push(String(r.name)); FOLD.open.add(String(r.name)); foldKeep(); const L = startLay(), i = L.list.findIndex(p => p.folder === String(r.name)); if (i >= 0) startChoose(i, L) }
    else foldSay(r && r.why ? String(r.why) : 'the folder could not be made')
  }
  uiDirty('start')
}
async function foldDrop (name) {
  const r = await NAT.call('folderDrop', { name })
  if (r && r.ok) { FOLD.list = FOLD.list.filter(x => x !== name); FOLD.open.delete(name); FOLD.rows.delete(name); foldKeep(); uiDirty('start') }
  else foldSay(r && r.why ? String(r.why) : 'the folder is still there')
}
/* a project put into a folder (to: its name) or taken out of one (to: '') */
async function foldMove (p, to) {
  if (!p || p.folder || (p.dir || '') === to) return
  if (p.gone) { foldSay('its disk is not connected'); return }
  const was = p.key, r = await NAT.call('projMove', { name: p.key, to })
  if (!r || !r.ok) { foldSay(r && r.why ? String(r.why) : 'it could not be moved'); return }
  p.key = String(r.key); if (to) p.dir = to; else delete p.dir
  delete p.in
  if (to) FOLD.open.add(to)
  foldKeep()
  /* what the app remembers by where a project lies goes with it */
  const prefs = await NAT.call('prefGet')
  if (prefs && prefs.lastProject === was) await NAT.call('prefSet', { key: 'lastProject', value: p.key })
  if (prefs && Array.isArray(prefs.elsewhere) && prefs.elsewhere.includes(was)) await NAT.call('prefSet', { key: 'elsewhere', value: prefs.elsewhere.filter(k => k !== was) })
  const L = startLay(), i = L.list.indexOf(p)
  if (i >= 0) startChoose(i, L)
  foldSay(to ? `${p.name} is in ${to}` : `${p.name} is out of its folder`)
}
/* where a row taken hold of would land if it were let go here: a folder's name, '' (among those in no folder), or null (nowhere) */
function foldUnder (e) {
  const el = document.elementFromPoint(e.clientX, e.clientY), row = el && el.closest ? el.closest('[data-a="st-row"], [data-a="st-fold"]') : null
  if (!row) return null
  const p = startLay().list[+row.dataset.i]
  return !p ? null : p.folder != null ? (p.naming ? null : p.folder) : p.dir || ''
}
function foldRowDraw (L, p, i, y) {
  const h = ST_ROW, by = y + h / 2 + 3.9, on = i === START.sel, open = FOLD.open.has(p.folder), over = FOLD.drag && FOLD.drag.over === p.folder && !p.naming
  let s = R(0, y, L.lx, h, { fill: over ? K4 : on ? K3 : K1 }) + R(L.lx, y, W - L.lx, h, { fill: over ? K2 : on ? K1 : K0 })
  if (over) s += R(.5, y + .5, W - 1, h - 1, { stroke: INK, sa: .5 })
  s += triMark(18, by - 4, open, p.naming ? .3 : .62)
  if (!p.naming) {
    const nm = fit(asGiven(p.name), HEAD_W - 30 - 70, 11.5, 500), saved = p.n ? savedText(p.modified) : ''
    s += T(30, by, nm, { size: 11.5, w: 500, a: on ? 1 : .92 }) + T(30 + tw(nm, 11.5, 500) + 9, by, String(p.n), { size: 9.5, a: .4 })
    s += T(HEAD_W - 14, by, saved, { size: 9.5, a: on ? .8 : .5, anchor: 'end' })
  }
  s += hline(0, W, y + h - .5, .06) + hit(0, y, W, h, 'st-row', ` data-i="${i}"`, 'default') + (p.naming ? '' : hit(6, y, 24, h, 'st-fold', ` data-i="${i}"`))
  return s
}
/* the row that is carried: a small strip with its name, under the pointer */
function foldGhost () {
  const d = FOLD.drag
  if (!d) return ''
  const nm = fit(asGiven(d.p.name), 220, 11.5, 500), w = Math.round(tw(nm, 11.5, 500) + 28), x = clamp(d.x + 10, 4, W - w - 4), y = clamp(d.y - 12, 4, H - 28)
  return G(R(x, y, w, 24, { rx: 2, fill: K3 }) + R(x + .5, y + .5, w - 1, 23, { rx: 2, stroke: INK, sa: .4 }) + T(x + 14, y + 15.9, nm, { size: 11.5, w: 500 }), '', ' pointer-events="none"')
}
/* the keys that are the folders' on the start page (asked first by the page's own keys): says whether it took the key */
function folderKey (e) {
  if (e.target === FOLD_IN) { if (e.key === 'Enter') { e.preventDefault(); foldNamed(true) } else if (e.key === 'Escape') { e.preventDefault(); foldNamed(false) } return true }
  if (S.menu || START.busy) return false
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === 'KeyN') { e.preventDefault(); foldNew(); return true }
  if (e.metaKey || e.ctrlKey || e.altKey || e.target === ST_FIND || e.target === ST_TYPE) return false
  const p = startLay().list[START.sel]
  if (!p || p.folder == null || START.focus !== 'list') return false
  if (e.code === 'Backspace' || e.code === 'Delete') { e.preventDefault(); if (!e.repeat) { if (p.n) foldSay('the folder is not empty'); else foldDrop(p.folder) } return true }
  return false
}

/* ── joined to the start page ── */
{
  const list0 = startList, lay0 = startLay, row0 = startRow, open0 = startOpen, tool0 = startTool, page0 = pStart
  startList = async function () {
    FOLD.rows.clear(); FOLD.naming = null; FOLD_IN.hidden = true
    const [fs, prefs] = await Promise.all([NAT.call('projFolders'), NAT.call('prefGet')])
    FOLD.list = (Array.isArray(fs) ? fs : []).map(f => String(f.name))
    FOLD.open = new Set(prefs && Array.isArray(prefs.foldersOpen) ? prefs.foldersOpen.map(String).filter(n => FOLD.list.includes(n)) : [])
    return list0()
  }
  /* the list as it is drawn: the folders first, by name, each with its projects under it while it stands open; then the projects that are in no folder */
  startLay = function () {
    const L = lay0(), base = L.list
    if (START.find.trim()) return L
    const inF = new Map(), out = []
    for (const p of base) if (p.dir) { if (!inF.has(p.dir)) inF.set(p.dir, []); inF.get(p.dir).push(p) }
    if (FOLD.naming) out.push(FOLD.naming)
    for (const name of [...new Set(FOLD.list.concat([...inF.keys()]))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))) { const kids = inF.get(name) || []; out.push(foldRow(name, kids)); if (FOLD.open.has(name)) for (const p of kids) out.push(p) }
    for (const p of base) if (!p.dir) out.push(p)
    L.list = out; L.maxVy = Math.max(0, out.length * ST_ROW - (L.yb - L.y2))
    return L
  }
  startRow = function (L, p, i, y) { return p.folder != null ? foldRowDraw(L, p, i, y) : row0(L, p, i, y) }
  startOpen = async function (p) { if (p && p.folder != null) { if (!p.naming) foldToggle(p.folder); return } return open0(p) }
  startTool = function (L) {
    const y = ST_BAND, x = 14 + tw('projects', 10) + 5 + tw(START.list.length ? String(START.list.length) : '', 10) + 18
    const [c] = cells(0, 0, 18, [{ t: 'new folder', k: '⇧⌘n', a: 'st-folder' }], { size: 9.5 })
    return tool0(L) + (NAT ? G(c, `translate(${Math.round(x)} ${y + 4})`) : '')
  }
  PARTS.start = function () { const s = page0(); return s ? s + foldGhost() : s }
  const g = $('g-start')
  g.addEventListener('pointerdown', e => {
    if (e.button || START.busy || !START.on) return
    const el = e.target.closest ? e.target.closest('[data-a]') : null, a = el ? el.dataset.a : ''
    if (FOLD.naming && e.target !== FOLD_IN) foldNamed(true)
    if (a === 'st-folder') { e.preventDefault(); foldNew() }                             // (the press must not take the keys away from the name that is about to be typed)
    else if (a === 'st-fold') { const p = startLay().list[+el.dataset.i]; if (p && p.folder != null) { startChoose(+el.dataset.i, startLay()); foldToggle(p.folder) } }
    else if (a === 'st-row') { const p = startLay().list[+el.dataset.i]; if (p && p.folder == null && !START.find.trim()) FOLD.press = { p, x: e.clientX, y: e.clientY } }
  })
  addEventListener('pointermove', e => {
    const q = FOLD.press
    if (!q || !START.on) return
    if (!FOLD.drag && Math.hypot(e.clientX - q.x, e.clientY - q.y) < 6) return
    const at = pt(e)
    FOLD.drag = { p: q.p, x: at.x, y: at.y, over: foldUnder(e) }
    if (FOLD.drag.over === (q.p.dir || '')) FOLD.drag.over = null                         // (where it already is, is nowhere to go)
    uiDirty('start')
  })
  const up = e => {
    const d = FOLD.drag
    FOLD.press = null; FOLD.drag = null
    if (!d) return
    uiDirty('start')
    if (e.type === 'pointerup' && d.over != null && START.on) foldMove(d.p, d.over)
  }
  addEventListener('pointerup', up); addEventListener('pointercancel', up)
  FOLD_IN.addEventListener('blur', () => { if (FOLD.naming) foldNamed(true) })
  FOLD_IN.addEventListener('pointerdown', e => e.stopPropagation())
}
