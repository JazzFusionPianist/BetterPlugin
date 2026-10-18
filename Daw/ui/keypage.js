/* ── settings > key commands ──
   design/themes draft 1, sheets 8 (his OK, 2026-10-18: "ㅇㅇㅇ"; "from my own set" for any program, turned into the
   room's keys at once). Over it: the keys like slur studio, logic pro, ableton live, cubase or pro tools (keymap.js,
   keysets.js), and from one's own set of another program (keyimport.js); save as default, import and export .sska
   (Slur Studio/Key Commands). A keyboard shows what each key does, with no key held or with ⇧, ⌥, ⌃, ⌘ …; under it every
   command of the room by its menu, each with its keys: pressed, the next key pressed is its key (one another command
   has is asked for; ⌫ leaves it without; esc keeps it as it was). A command whose key is not its set's has a dot before
   it; pressed, it goes back. ⌘Z takes the last change back. Every change is worn by the room at once (settingsSet keys). */
const KP = { cat: [], set: { base: 'slur', changes: {} }, def: null, found: null, layer: '', find: '', top: 0, lines: 12, rec: null, conflict: null, menu: null, said: '', hist: [], ready: false, flash: null, items: [], rowsAt: [] }
const KP_LAYERS = [['no key', ''], ['⇧', '⇧'], ['⌥', '⌥'], ['⌃', '⌃'], ['⌘', '⌘'], ['⇧⌘', '⇧⌘'], ['⌥⌘', '⌥⌘'], ['⌃⌘', '⌃⌘']]
const KP_FAM = { t: ['#D9534F', 'transport, markers'], e: ['#4F86D9', 'editing'], k: ['#59A86B', 'tracks'], v: ['#B07FD0', 'views'], o: ['#D9A441', 'the rest'] }
const kpFam = c => { const m = (c.menu || '').split(' > ')[0]; return m === 'Transport' || m === 'Markers' ? 't' : m === 'Edit' || m === 'Region' ? 'e' : m === 'Track' ? 'k' : m === 'View' || m === 'Window' ? 'v' : 'o' }
const KP_ROWS = [
  [['esc', 'Escape', 1.3], ['F1', 'F1'], ['F2', 'F2'], ['F3', 'F3'], ['F4', 'F4'], ['F5', 'F5'], ['F6', 'F6'], ['F7', 'F7'], ['F8', 'F8'], ['F9', 'F9'], ['F10', 'F10'], ['F11', 'F11'], ['F12', 'F12']],
  [['`', 'Backquote'], ['1', 'Digit1'], ['2', 'Digit2'], ['3', 'Digit3'], ['4', 'Digit4'], ['5', 'Digit5'], ['6', 'Digit6'], ['7', 'Digit7'], ['8', 'Digit8'], ['9', 'Digit9'], ['0', 'Digit0'], ['-', 'Minus'], ['=', 'Equal'], ['delete', 'Backspace', 1.5]],
  [['tab', 'Tab', 1.5], ['Q', 'KeyQ'], ['W', 'KeyW'], ['E', 'KeyE'], ['R', 'KeyR'], ['T', 'KeyT'], ['Y', 'KeyY'], ['U', 'KeyU'], ['I', 'KeyI'], ['O', 'KeyO'], ['P', 'KeyP'], ['[', 'BracketLeft'], [']', 'BracketRight'], ['\\', 'Backslash']],
  [['caps', 'CapsLock', 1.75], ['A', 'KeyA'], ['S', 'KeyS'], ['D', 'KeyD'], ['F', 'KeyF'], ['G', 'KeyG'], ['H', 'KeyH'], ['J', 'KeyJ'], ['K', 'KeyK'], ['L', 'KeyL'], [';', 'Semicolon'], ['\'', 'Quote'], ['return', 'Enter', 1.75]],
  [['shift', 'ShiftLeft', 2.25], ['Z', 'KeyZ'], ['X', 'KeyX'], ['C', 'KeyC'], ['V', 'KeyV'], ['B', 'KeyB'], ['N', 'KeyN'], ['M', 'KeyM'], [',', 'Comma'], ['.', 'Period'], ['/', 'Slash'], ['shift', 'ShiftRight', 2.25]],
  [['fn', 'Fn'], ['⌃', 'ControlLeft'], ['⌥', 'AltLeft'], ['⌘', 'MetaLeft', 1.25], ['space', 'Space', 5], ['⌘', 'MetaRight', 1.25], ['⌥', 'AltRight'], ['←', 'ArrowLeft'], ['↑', 'ArrowUp'], ['↓', 'ArrowDown'], ['→', 'ArrowRight']],
]
/* a command's name in the language of the settings: the menu bar's own words (lang.ko.js: LANG.menuKo) */
const kpWord = t => LANG.now === 'ko' && LANG.menuKo && LANG.menuKo[t] != null ? LANG.menuKo[t] : String(t).toLowerCase()
const kpPath = m => m.split(' > ').map(kpWord).join(' › ')
const kpMap = () => keyMapOf(KP.set, KP.cat)
const kpBaseWord = b => KEY_BASE_NAME[b] || b

function keyBody () {
  const PR = DISP_W - SIDE - 28
  let b = T(28, 34, 'key commands', { size: 13, w: 500, a: .94 })
  if (!KP.ready) return b + T(28 + tw('key commands', 13, 500) + 12, 34, 'looking', { size: 10, a: .45 })
  const map = kpMap(), owners = keyOwners(map, KP.cat), nCh = Object.keys(KP.set.changes || {}).length, withKey = KP.cat.filter(c => (map[c.id] || []).length).length
  const head = asGiven(`${inWords('as #').replace('#', kpBaseWord(KP.set.base))}${KP.isDef ? ' (' + inWords('my default') + ')' : ''}${nCh ? ', ' + inWords(nCh === 1 ? 'one change' : '# changes').replace('#', nCh) : ''}`), hx = 28 + tw('key commands', 13, 500) + 12
  b += T(hx, 34, head, { size: 10, a: .62 }) + T(hx + tw(head, 10) + 14, 34, asGiven(inWords('# commands, # with a key').replace('#', KP.cat.length).replace('#', withKey)), { size: 10, a: .38 })
  let kx = PR
  for (const [t, a] of [['export .sska…', 'k-export'], ['import…', 'k-import'], ['save as default', 'k-default']]) { const w = keyW(t, { size: 10, pad: 10 }); kx -= w; b += key(kx, 20, t, { h: 20, size: 10, pad: 10, a })[0]; kx -= 8 }
  b += hline(28, PR, 54, .1)
  /* the bases */
  const bases = KEY_BASES.map(k => ({ t: kpBaseWord(k), on: k === KP.set.base && !KP.isDef, a: 'k-base', more: ` data-v="${k}"` })).concat(KP.def ? [{ t: 'my default', on: !!KP.isDef, a: 'k-def' }] : [])
  b += T(28, 81, 'keys like', { size: 10.5, a: .62 }) + cells(96, 66, 22, bases, { size: 10, pad: 13 })[0]
  b += menuKey(PR - menuKey(0, 0, 'from my own set…', { h: 20, size: 10 })[1], 67, 'from my own set…', { h: 20, size: 10, a: 'k-foreign' })[0]
  /* the keyboard */
  const u = 50, ky0 = 106, kx0 = 28
  b += T(kx0, ky0 + 4, 'held', { size: 9.5, a: .45 }) + cells(kx0 + 32, ky0 - 10, 20, KP_LAYERS.map(([t, v]) => ({ t, on: v === KP.layer, a: 'k-layer', more: ` data-v="${v}"` })), { size: 9.5, pad: 9 })[0]
  let fx = PR
  for (const k of Object.keys(KP_FAM).reverse()) { const [c, t] = KP_FAM[k], w = tw(t, 9) + 22; fx -= w; b += R(fx, ky0 - 4, 8, 8, { rx: 1.5, fill: c, fa: .7 }) + T(fx + 13, ky0 + 4, t, { size: 9, a: .6 }) }
  let y = ky0 + 20
  KP_ROWS.forEach((row, ri) => {
    let x = kx0
    const h = ri === 0 ? 22 : 36
    for (const [cap, code, wu = 1] of row) {
      const w = u * wu - 4, mod = /Shift|Control|Alt|Meta|Fn|Caps/.test(code), combo = keyNorm(KP.layer, code), id = mod ? null : owners.get(combo), c = id ? KP.cat.find(x2 => x2.id === id) : null, fam = c ? KP_FAM[kpFam(c)][0] : null
      const hot = KP.flash && KP.flash === id
      b += R(x, y, w, h, { rx: 3.5, fill: fam || '#2A2A27', fa: fam ? (hot ? .55 : .24) : 1, stroke: fam || INK, sa: fam ? .75 : .12 })
      b += T(x + 5, y + 11.5, asGiven(cap), { size: ri === 0 ? 8 : 9.5, w: 500, a: mod ? .45 : .9 })
      if (c) {
        const room = ri === 0 ? w - 12 - tw(asGiven(cap), 8, 500) - 4 : w - 9, sx = ri === 0 ? x + 5 + tw(asGiven(cap), 8, 500) + 4 : x + 5, sy = ri === 0 ? y + 11.5 : y + h - 6
        b += T(sx, sy, fit(asGiven(kpWord(c.name)), room, 7.5), { size: 7.5, a: .85 })
      }
      if (id) b += hit(x, y, w, h, 'k-key', ` data-v="${esc(id).replace(/"/g, '&quot;')}"`)
      x += u * wu
    }
    y += h + 4
  })
  /* the commands */
  const ly = y + 12
  b += hline(28, PR, ly - 6, .1)
  const typing = !document.getElementById('ed').hidden
  b += R(28.5, ly + 4.5, 230, 21, { rx: 2, stroke: INK, sa: typing ? .5 : .22 }) + (typing ? '' : KP.find ? T(37, ly + 18.6, fit(asGiven(KP.find), 214, 10), { size: 10, a: .9 }) : T(37, ly + 18.6, 'find a command, or its key', { size: 10, a: .36 })) + hit(28, ly + 4, 230, 22, 'k-find', '', 'text')
  if (KP.said) b += T(272, ly + 18.6, asGiven(KP.said), { size: 9.5, c: KP.conflict || KP.rec ? '#E0A040' : INK, a: KP.conflict || KP.rec ? 1 : .6 })
  if (KP.conflict) { const w = keyW('take it', { size: 10, pad: 10 }); b += key(PR - w, ly + 4, 'take it', { h: 20, size: 10, pad: 10, a: 'k-take' })[0] }
  /* every command, by its menu, in three columns read down; a scroll moves them all */
  const f = KP.find.trim().toLowerCase(), items = []
  let last = null
  for (const c of KP.cat) {
    const ks = map[c.id] || []
    if (f && !(kpWord(c.name).toLowerCase().includes(f) || c.name.toLowerCase().includes(f) || ks.some(k => keySaid(k).toLowerCase() === f || keySaid(k).toLowerCase().includes(f) && f.length > 1))) continue
    if (c.menu !== last) { items.push({ head: c.menu }); last = c.menu }
    items.push({ c, ks })
  }
  KP.items = items
  const colW = (PR - 28 - 40) / 3, rowH = 21, top = ly + 38, lines = Math.max(4, Math.floor((DISP_H - 26 - top) / rowH))
  KP.lines = lines; KP.top = Math.max(0, Math.min(KP.top, Math.max(0, items.length - lines * 3)))
  KP.rowsAt = []
  for (let col = 0; col < 3; col++) for (let r = 0; r < lines; r++) {
    const it = items[KP.top + col * lines + r]
    if (!it) continue
    const x = 28 + col * (colW + 20), yy = top + r * rowH
    if (it.head) { b += T(x, yy + 14, asGiven(kpPath(it.head)), { size: 9, a: .4 }); continue }
    const c = it.c, on = KP.rec === c.id, changed = c.id in (KP.set.changes || {}), hot = KP.flash === c.id
    if (on || hot) b += R(x - 6, yy, colW + 8, rowH - 1, { rx: 2, fill: INK, fa: .07 })
    if (changed) b += Cc(x - 10, yy + 10, 2.3, { fill: INK, fa: .8 }) + hit(x - 15, yy + 3, 10, 15, 'k-back', ` data-v="${esc(c.id).replace(/"/g, '&quot;')}"`)
    b += T(x, yy + 14, fit(asGiven(kpWord(c.name)), colW - 110, 10.5), { size: 10.5, a: on ? 1 : .82 })
    if (on) b += R(x + colW - 104.5, yy + .5, 102, 18, { rx: 2, stroke: '#E0A040', sw: 1.2 }) + T(x + colW - 97, yy + 13, KP.conflict ? asGiven(keySaid(KP.conflict.key)) : 'press a key', { size: 10, w: KP.conflict ? 500 : 400, a: KP.conflict ? 1 : .5 })
    else b += T(x + colW - 4, yy + 14, asGiven(it.ks.map(keySaid).join('   ')), { size: 10, w: 500, a: it.ks.length ? .9 : .25, anchor: 'end' })
    b += hit(x - 4, yy, colW - (changed ? 0 : 0), rowH - 1, 'k-cmd', ` data-v="${esc(c.id).replace(/"/g, '&quot;')}"`)
    KP.rowsAt.push(c.id)
  }
  const more = items.length - (KP.top + lines * 3)
  if (more > 0) b += T(28, DISP_H - 10, asGiven(inWords('and # more, a scroll away').replace('#', more)), { size: 9, a: .38 })
  else b += T(28, DISP_H - 10, 'kept as .sska files in Slur Studio / Key Commands', { size: 9, a: .38 })
  return b
}
/* the list of the other programs' sets found on this Mac, and a file of one */
function keyMenu () {
  if (!KP.menu) return ''
  const items = (KP.found || []).map(f => ({ t: asGiven(`${kpBaseWord(f.daw)}: ${f.name === 'the set in use' ? inWords('the set in use') : f.name}`), a: 'k-read', v: f.path })).concat([{ t: 'a file of another program…', a: 'k-file', v: '' }])
  if (!(KP.found || []).length) items.unshift({ t: 'none found on this Mac', a: 'k-none', v: '', dim: true })
  const rowH = 20, w = 300, h = items.length * rowH + 12, x = SIDE + DISP_W - SIDE - 28 - w, y = 92
  let s = hit(0, 0, DISP_W, DISP_H, 'k-close', '', 'default') + R(x, y, w, h, { rx: 3, fill: K2 }) + R(x + .5, y + .5, w - 1, h - 1, { rx: 3, stroke: INK, sa: .28 }), ry = y + 6
  for (const it of items) { s += T(x + 13, ry + 13.6, fit(it.t, w - 26, 10.5), { size: 10.5, a: it.dim ? .4 : .88 }) + (it.dim ? '' : hit(x + 5, ry, w - 10, rowH, it.a, ` data-v="${esc(it.v).replace(/"/g, '&quot;')}"`)); ry += rowH }
  return s
}

/* ── a change: the room wears it at once, the app keeps it ── */
function kpSend () { if (NAT) NAT.call('settingsSet', { what: 'keys', value: KP.set }) }
const kpKeep = () => { KP.hist.push(JSON.stringify({ set: KP.set, isDef: KP.isDef })); if (KP.hist.length > 200) KP.hist.shift() }
/* the changes of a set kept as small as they are: a command's keys the same as its base's are no change */
function kpTidy (set) {
  const base = keyBaseMap(set.base, KP.cat), ch = {}
  for (const id in set.changes || {}) { const a = (set.changes[id] || []).slice(), b2 = base[id] || []; if (a.join(' ') !== b2.join(' ')) ch[id] = a }
  return { base: set.base, changes: ch }
}
function kpWear (set, isDef) { kpKeep(); KP.set = kpTidy(set); KP.isDef = !!isDef; KP.rec = null; KP.conflict = null; kpSend(); draw() }
/* a command given a key: whatever had it gives it up */
function kpGive (id, k) {
  const map = kpMap(), ch = Object.assign({}, KP.set.changes)
  for (const c of KP.cat) if (c.id !== id && (map[c.id] || []).includes(k)) ch[c.id] = map[c.id].filter(x => x !== k)
  ch[id] = [k]
  kpWear({ base: KP.set.base, changes: ch }, false)
}
function kpUndo () { const h = KP.hist.pop(); if (!h) return; const o = JSON.parse(h); KP.set = o.set; KP.isDef = o.isDef; KP.rec = null; KP.conflict = null; kpSend(); draw() }
/* a key pressed while a command waits for one */
function keyRecord (e) {
  if (!KP.rec) return false
  if (/^(Shift|Control|Alt|Meta|CapsLock|Fn)/.test(e.code)) return true
  e.preventDefault(); e.stopPropagation()
  const k = keyOfEvent(e), c = KP.cat.find(x => x.id === KP.rec)
  if (e.code === 'Escape' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) { KP.rec = null; KP.conflict = null; KP.said = ''; kpTyping(false); draw(); return true }
  if (e.code === 'Backspace' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) { const ch = Object.assign({}, KP.set.changes); ch[KP.rec] = []; KP.said = asGiven(`${kpWord(c.name)}: ${inWords('no key')}`); kpTyping(false); kpWear({ base: KP.set.base, changes: ch }, false); return true }
  const owner = keyOwners(kpMap(), KP.cat).get(k)
  if (owner && owner !== KP.rec) { const oc = KP.cat.find(x => x.id === owner); KP.conflict = { id: KP.rec, key: k, owner }; KP.said = asGiven(inWords('# is #’s already: take it from it, or press another').replace('#', keySaid(k)).replace('#', kpWord(oc.name))); draw(); return true }
  KP.said = asGiven(`${kpWord(c.name)}: ${keySaid(k)}`); kpTyping(false)
  kpGive(KP.rec, k)
  return true
}
function kpTyping (on) { if (NAT) NAT.call('typing', { on: on ? 1 : 0 }) }       // (while a key is awaited the menu bar answers none)

/* ── another program's own set, turned into the room's keys ── */
function kpForeign (ext, bytes) {
  const keysOf = new Map(), taken = new Set()
  let daw = null
  const text = () => new TextDecoder().decode(bytes)
  if (ext === '.logikcs' || ext === '.plist') {
    daw = 'logic'
    const byId = new Map()
    for (const e of KI_LOGIC.decodeLogicKeyCommands(bytes) || []) if (e.key && !e.unplaced) { if (!byId.has(e.id)) byId.set(e.id, []); byId.get(e.id).push(e.key); taken.add(e.key) }
    for (const id in KI_IDS.logic) { const ks = []; for (const n of KI_IDS.logic[id].ids) for (const k of byId.get(n) || []) if (!ks.includes(k)) ks.push(k); keysOf.set(id, ks) }
  } else if (ext === '.xml') {
    daw = 'cubase'
    const by = new Map(), byName = new Map()
    for (const c of KI_CUBASE.decodeCubaseXml(text()) || []) { const ks = (c.keys || []).filter(Boolean); by.set(c.category + '|' + c.name, ks); if (!byName.has(c.name)) byName.set(c.name, ks); for (const k of ks) taken.add(k) }
    for (const id in KI_IDS.cubase) {
      const r = KI_IDS.cubase[id], alt = r.alt ? (typeof r.alt === 'string' ? { category: r.alt, name: r.name } : { category: r.alt.category, name: r.alt.name || r.name }) : null
      keysOf.set(id, by.get(r.category + '|' + r.name) || (alt && by.get(alt.category + '|' + alt.name)) || byName.get(r.name) || [])
    }
  } else if (ext === '.ptpreset' || ext === '.txt') {
    daw = 'protools'
    const r = KI_PROTOOLS.ptApply(KI_PT_DEFAULTS, text())
    for (const cmd in r.table) for (const k of r.table[cmd]) if (!KI_PROTOOLS.isFocus(k)) taken.add(k)
    for (const id in KI_IDS.protools) keysOf.set(id, KI_PROTOOLS.ptRowKeys(r.table, KI_IDS.protools[id]).keys.slice(0, 1))
  }
  if (!daw) return null
  /* the room's keys: the program's for what it has, and for what only the room has its own key, off the program's */
  const map = {}, used = new Set(), set = KEYSETS[daw]
  for (const c of KP.cat) { const ks = (keysOf.get(c.id) || []).filter(k => !used.has(k)); if (ks.length) { map[c.id] = ks; ks.forEach(k => used.add(k)) } }
  for (const c of KP.cat) {
    if (keysOf.has(c.id) || !(c.keys0 || []).length || (set && set.none.includes(c.id))) continue
    if (set && set.keys[c.id]) { const k = set.keys[c.id][0]; if (!used.has(k) && !taken.has(k)) { map[c.id] = [k]; used.add(k) } continue }
    const keys = []
    for (const k of c.keys0) { if (c.loose) { if (!taken.has(k) && !used.has(k)) { keys.push(k); used.add(k) } continue } const k2 = keyFree(k, taken, used); if (k2) { keys.push(k2); used.add(k2) } }
    if (keys.length) map[c.id] = keys
  }
  const base = keyBaseMap(daw, KP.cat), changes = {}
  for (const id of new Set(Object.keys(map).concat(Object.keys(base)))) { const a = map[id] || [], b2 = base[id] || []; if (a.join(' ') !== b2.join(' ')) changes[id] = a }
  return { daw, set: { base: daw, changes }, mapped: KP.cat.filter(c => (keysOf.get(c.id) || []).length).length }
}
const kpBytes = b64 => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u }
function kpTakeForeign (r) {
  if (!r || !r.ok) return
  let got = null
  try { got = kpForeign(r.ext, kpBytes(r.b64)) } catch (e) { got = null }
  if (!got) { KP.said = 'that file holds no set of keys this room can read'; draw(); return }
  kpWear(got.set, false)
  const n = Object.keys(got.set.changes).length
  KP.said = asGiven(inWords('#, #: # commands take its keys, # not as # comes').replace('#', kpBaseWord(got.daw)).replace('#', r.name === 'the set in use' ? inWords('the set in use') : r.name).replace('#', got.mapped).replace('#', n).replace('#', kpBaseWord(got.daw)))
  draw()
}

async function keyPress (el, e) {
  const a = el.dataset.a, v = el.dataset.v
  if (a === 'k-close') { KP.menu = null; draw(); return }
  if (KP.menu && a !== 'k-read' && a !== 'k-file') KP.menu = null
  if (a === 'k-base') { KP.said = ''; kpWear({ base: v, changes: {} }, false) }
  else if (a === 'k-def') { if (KP.def) { KP.said = ''; kpWear(KP.def, true) } }
  else if (a === 'k-layer') { KP.layer = v; draw() }
  else if (a === 'k-key') { KP.flash = v; const i = KP.items.findIndex(it => it.c && it.c.id === v); if (i >= 0 && !KP.rowsAt.includes(v)) KP.top = Math.max(0, i - 2); draw(); setTimeout(() => { if (KP.flash === v) { KP.flash = null; draw() } }, 1400) }
  else if (a === 'k-cmd') { if (KP.rec === v) { KP.rec = null; KP.conflict = null; KP.said = ''; kpTyping(false) } else { KP.rec = v; KP.conflict = null; KP.said = 'press its key, ⌫ for none, esc to keep it'; kpTyping(true); document.activeElement && document.activeElement.blur && document.activeElement.blur() } draw() }
  else if (a === 'k-take') { const c = KP.conflict; if (c) { KP.said = ''; kpTyping(false); kpGive(c.id, c.key) } }
  else if (a === 'k-back') { const ch = Object.assign({}, KP.set.changes); delete ch[v]; kpWear({ base: KP.set.base, changes: ch }, false) }
  else if (a === 'k-default') { KP.def = JSON.parse(JSON.stringify(KP.set)); KP.isDef = true; if (NAT) await NAT.call('prefSet', { key: 'keysDefault', value: KP.def }); KP.said = 'kept as my default'; draw() }
  else if (a === 'k-export') { if (!NAT) return; const r = await NAT.call('keysExport', { name: KP.isDef ? 'my default' : kpBaseWord(KP.set.base), json: keySska(KP.set) }); KP.said = r && r.ok ? asGiven(`${inWords('written as')} ${r.name}.sska`) : ''; draw() }
  else if (a === 'k-import') {
    if (!NAT) return
    const r = await NAT.call('keysImport')
    if (!r || !r.ok) return
    const got = keyFromSska(new TextDecoder().decode(kpBytes(r.b64)))
    if (!got) { KP.said = 'that file holds no set of keys'; draw(); return }
    kpWear(got, false); KP.said = asGiven(`${inWords('read')} ${r.name}`); draw()
  }
  else if (a === 'k-foreign') { KP.menu = !KP.menu; if (KP.menu && NAT) KP.found = await NAT.call('keysFind'); draw() }
  else if (a === 'k-read') { KP.menu = null; const f = (KP.found || []).find(x => x.path === v); if (NAT) kpTakeForeign(Object.assign(await NAT.call('keysRead', { path: v }) || {}, f ? { name: f.name } : {})) }      // (named as the list names it: 'the set in use')
  else if (a === 'k-file') { KP.menu = null; draw(); if (NAT) kpTakeForeign(await NAT.call('keysForeign')) }
  else if (a === 'k-find') {
    const r = el.getBoundingClientRect()
    dType(r.left + 1, r.top + 1, 228, KP.find, t => { KP.find = t }, { live: t => { KP.find = t; KP.top = 0; draw() }, bare: true })
    draw()
  }
}
function keyWheel (e) {
  KP.wheel = (KP.wheel || 0) + e.deltaY
  const steps = Math.trunc(KP.wheel / 21)
  if (!steps) return
  KP.wheel -= steps * 21
  KP.top = Math.max(0, Math.min(Math.max(0, KP.items.length - KP.lines * 3), KP.top + steps))
  draw()
}
/* the room's commands (the room tells the app; ui/commands.js), the set in use, my default */
async function keyRead () {
  if (NAT) {
    const [cat, p] = await Promise.all([NAT.call('keysCatalog'), NAT.call('prefGet')])
    KP.cat = Array.isArray(cat) ? cat : []
    if (p && p.keys) KP.set = { base: KEY_BASES.includes(p.keys.base) ? p.keys.base : 'slur', changes: p.keys.changes || {} }
    KP.def = p && p.keysDefault && KEY_BASES.includes(p.keysDefault.base) ? p.keysDefault : null
    KP.isDef = !!KP.def && JSON.stringify(KP.def) === JSON.stringify(KP.set)
  } else { KP.cat = window.KEY_STAND_IN || []; KP.set = Object.assign({ base: 'slur', changes: {} }, window.KEY_STAND_SET || {}) }
  KP.ready = true
  draw()
}
