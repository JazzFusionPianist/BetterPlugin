/* ── the keys the room answers to, as settings > key commands has them (keymap.js) ──
   Every command of the room is a line of the menu bar (menus.js) or a key no line shows (below); each does what its own
   key does in KEYS (edit.js) or what its line says. With the keys as the room comes, nothing here changes anything: the
   room reads KEYS as it always has. With another set, a key pressed finds its command here, and the menu bar shows
   each line's key from the set. The settings window is told what the commands are (keysCatalog) and tells the room the
   set (dawKeys). Escape always closes what is up, whatever the set. */
const KC = { set: { base: 'slur', changes: {} }, plain: true, catalog: [], map: {}, by: new Map(), run: new Map(), sent: '' }
/* keys that do what a line's own key does (they go with it, and go when the set is another DAW's) */
const KC_ALIAS = { '⌃⌘KeyG': '⌘KeyG', '⇧⌘Equal': '⌘Equal', '⌘NumpadAdd': '⌘Equal', '⌘NumpadSubtract': '⌘Minus', '⌘KeyJ': 'KeyJ', Delete: 'Backspace', '⌃Period': 'Tab', '⌃Comma': '⌥Tab', '⌘BracketLeft': 'BracketLeft', '⌘BracketRight': 'BracketRight', '⇧⌘KeyI': '⌘KeyI' }
/* keys no line shows, each a command of its own */
const KC_LOOSE = { NumpadEnter: 'Play (Keypad)', Numpad0: 'Stop (Keypad)', NumpadDecimal: 'Play or Stop (Keypad)', NumpadMultiply: 'Record (Keypad)', '⌃Home': 'Go to the Start of the Selection', '⌃End': 'Go to the End of the Selection', '⌘KeyU': 'Cycle Exactly Round the Selection', '⇧Tab': 'Select to the Next Transient', '⌥⇧Tab': 'Select to the Previous Transient', '⇧ArrowUp': 'Add the Track Above', '⇧ArrowDown': 'Add the Track Below', '⇧Enter': 'Rename What Is Chosen', '⌘Comma': 'Audio Settings' }
const KC_FIXED = new Set(['Escape'])

/* the commands, from the menu bar as it is now */
function kcCatalog () {
  const out = [], inMenu = new Set()
  const walk = (lines, names) => {
    for (const l of lines) {
      if (l === '-' || !Array.isArray(l)) continue
      const [t0, k0, o = {}] = l, id = `${names} > ${t0}`
      if (o.sub) { if (Array.isArray(o.sub)) walk(o.sub, id); continue }
      if (o.given || (o.dim && !k0)) continue
      const run = o.do || (k0 && KEYS[k0] ? () => KEYS[k0]() : null) || (o.id && typeof MENU_DO === 'object' && MENU_DO[o.id] ? () => MENU_DO[o.id]() : null) || (o.id && /^settings:|^guide$/.test(o.id) && NAT ? () => NAT.call('menuPick', { id: o.id }) : null)
      if (!run) continue                                                         // (the Mac's own: minimize, full screen …)
      const keys0 = k0 ? [k0].concat(Object.keys(KC_ALIAS).filter(a => KC_ALIAS[a] === k0)) : []
      for (const k of keys0) inMenu.add(k)
      out.push({ id, menu: names, name: t0, keys0, shown: o.k || null, run })
    }
  }
  for (const [t, lines] of MENU_BAR()) walk(lines, t)
  for (const k in KC_LOOSE) if (!inMenu.has(k) && KEYS[k]) out.push({ id: 'key:' + k, menu: 'Keys', name: KC_LOOSE[k], keys0: [k], loose: true, run: () => KEYS[k]() })
  return out
}
/* a set worn: the room's keys, its menu bar, the sheet */
function kcApply (set) {
  KC.set = set && typeof set === 'object' ? { base: KEY_BASES.includes(set.base) ? set.base : 'slur', changes: set.changes && typeof set.changes === 'object' ? set.changes : {} } : { base: 'slur', changes: {} }
  KC.plain = keyPlain(KC.set)
  kcCatalogNow()
  if (typeof menusSend === 'function') menusSend()
  if (typeof uiDirty === 'function') uiDirty('sheet')
}
function kcCatalogNow () {
  KC.catalog = kcCatalog()
  KC.map = keyMapOf(KC.set, KC.catalog); KC.by = keyOwners(KC.map, KC.catalog); KC.run = new Map(KC.catalog.map(c => [c.id, c.run]))
  const list = KC.catalog.map(c => ({ id: c.id, menu: c.menu, name: c.name, keys0: c.keys0, shown: c.shown, loose: !!c.loose })), sig = JSON.stringify(list)
  if (NAT && sig !== KC.sent) { KC.sent = sig; NAT.call('keysCatalog', { list }) }      // (for the settings window)
}
/* what a key does now */
function keyFor (k) {
  if (KC.plain || KC_FIXED.has(k)) return KEYS[k]
  const id = KC.by.get(k)
  return id ? KC.run.get(id) : undefined
}
/* the key a menu line shows: the set's, or (as the room comes) its own */
function kcShown (id, k0, shown) {
  if (KC.plain) return k0 || shown || null
  const ks = KC.map[id]
  if (ks && ks.length) return ks[0]
  return shown && (KC.map['key:' + shown] || []).includes(shown) ? shown : null
}
/* ⌥K opens the key commands in the settings, as Logic's does; the sheet (⇧/, Help > Key Commands) lists the keys as the
   room comes, so with another set it is the settings that show them */
const kcSettings = () => { if (NAT) NAT.call('settings', { part: 'key commands' }); else toggleSheet() }
KEYS['⌥KeyK'] = kcSettings
KEYS['⇧Slash'] = () => { if (KC.plain || S.sheet) toggleSheet(); else kcSettings() }
if (typeof MENU_DO === 'object') MENU_DO.keys = () => KEYS['⇧Slash']()
if (NAT) {
  NAT.on('dawKeys', d => { if (d) kcApply(d.keys) })
  NAT.call('prefGet').then(p => { if (p && p.keys) kcApply(p.keys); else setTimeout(kcCatalogNow, 600) })
}
