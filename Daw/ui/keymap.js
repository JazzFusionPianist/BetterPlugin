/* ── a set of keys: which key each command of the room answers to ──
   His ask (2026-10-18): every key command can be changed; a press makes the keys those of Logic Pro, Ableton Live,
   Cubase or Pro Tools (keysets.js, from each one's own default set), with what only Slur Studio has moved off their keys;
   a set can be kept as the default, written to a .sska file, read back, or made from one's own set of another DAW.
   A command is named by its place in the menu bar ('Region > Mute'), or for a key no menu line shows, 'key:' and the key.
   A set is { base, changes }: the keys of a base (slur, logic, ableton, cubase, protools), and what was changed by hand
   ({ command: [keys] }; [] for none). Read by the room (commands.js) and the settings window (keypage.js) alike. */
const KEY_BASES = ['slur', 'logic', 'ableton', 'cubase', 'protools']
const KEY_BASE_NAME = { slur: 'slur studio', logic: 'logic pro', ableton: 'ableton live', cubase: 'cubase', protools: 'pro tools' }
const KEY_MOD_ORDER = '⌃⌥⇧⌘'
const keyMods = k => (String(k).match(/^[⌃⌥⇧⌘]*/) || [''])[0]
const keyCode = k => String(k).slice(keyMods(k).length)
const keyNorm = (mods, code) => [...KEY_MOD_ORDER].filter(m => mods.includes(m)).join('') + code
/* a key as it is pressed (the room reads where the key sits, so a Korean keyboard changes nothing) */
const keyOfEvent = e => (e.ctrlKey ? '⌃' : '') + (e.altKey ? '⌥' : '') + (e.shiftKey ? '⇧' : '') + (e.metaKey ? '⌘' : '') + e.code
/* a key as it is written: ⌥⇧⌘D, ⌃→, space, F2, the keypad's 1 */
const KEY_SAID = { Space: 'space', Enter: '↩', Backspace: '⌫', Delete: '⌦', Tab: '⇥', Escape: 'esc', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Home: 'home', End: 'end', PageUp: 'pg up', PageDown: 'pg down', Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: '\'', BracketLeft: '[', BracketRight: ']', Backquote: '`', Minus: '−', Equal: '=', Backslash: '\\', NumpadEnter: 'keypad ↩', NumpadDecimal: 'keypad .', NumpadMultiply: 'keypad *', NumpadAdd: 'keypad +', NumpadSubtract: 'keypad −', NumpadDivide: 'keypad /', NumpadEqual: 'keypad =' }
function keySaid (k) {
  if (!k) return ''
  const code = keyCode(k)
  const c = KEY_SAID[code] || (/^Key[A-Z]$/.test(code) ? code.slice(3) : /^Digit\d$/.test(code) ? code.slice(5) : /^Numpad\d$/.test(code) ? 'keypad ' + code.slice(6) : code)
  return keyMods(k) + c
}
/* a key free of a DAW's keys and of those given already: as it is, or with ⌃⇧ (or ⌥⇧, ⌃⌥ …) added */
function keyFree (k, taken, used) {
  if (!taken.has(k) && !used.has(k)) return k
  const code = keyCode(k), mods = keyMods(k)
  for (const add of ['⌃⇧', '⌥⇧', '⌃⌥', '⌃⌥⇧', '⌃⇧⌘', '⌥⇧⌘']) { const k2 = keyNorm(mods + add, code); if (!taken.has(k2) && !used.has(k2)) return k2 }
  return null
}
/* the keys of a base, for the room's commands (catalog: [{ id, keys0, loose }]): a DAW's own key for what it has too,
   no key for what it has without one, and for what only Slur Studio has its own key, moved off the DAW's keys */
function keyBaseMap (base, catalog) {
  const map = {}
  const set = typeof KEYSETS === 'object' ? KEYSETS[base] : null
  if (!set) { for (const c of catalog) if (c.keys0 && c.keys0.length) map[c.id] = c.keys0.slice(); return map }
  const used = new Set(), taken = new Set(set.taken), none = new Set(set.none)
  for (const c of catalog) if (set.keys[c.id]) { map[c.id] = set.keys[c.id].slice(); for (const k of map[c.id]) used.add(k) }
  for (const c of catalog) {
    if (set.keys[c.id] || none.has(c.id) || !(c.keys0 && c.keys0.length)) continue
    const keys = []
    for (const k of c.keys0) {
      if (c.loose) { if (!taken.has(k) && !used.has(k)) { keys.push(k); used.add(k) } continue }      // (a key no line shows goes where it is, or not at all)
      const k2 = keyFree(k, taken, used); if (k2) { keys.push(k2); used.add(k2) }
    }
    if (keys.length) map[c.id] = keys
  }
  return map
}
/* a set's keys: its base's, with what was changed by hand */
function keyMapOf (set, catalog) {
  const map = keyBaseMap(set && set.base || 'slur', catalog), ch = set && set.changes || {}
  for (const id in ch) { const ks = Array.isArray(ch[id]) ? ch[id] : []; if (ks.length) map[id] = ks.slice(); else delete map[id] }
  return map
}
/* and the other way: for each key, the command it does (the first that has it, in the menu bar's order) */
function keyOwners (map, catalog) {
  const by = new Map()
  for (const c of catalog) for (const k of map[c.id] || []) if (!by.has(k)) by.set(k, c.id)
  return by
}
const keyPlain = set => !set || ((set.base || 'slur') === 'slur' && !Object.keys(set.changes || {}).length)
/* a set as a .sska file holds it, and read back from one */
const keySska = (set, name) => JSON.stringify({ slurKeys: 1, name: name || '', base: set.base || 'slur', changes: set.changes || {} }, null, 1)
function keyFromSska (text) {
  let j = null
  try { j = JSON.parse(text) } catch (e) { return null }
  if (!j || j.slurKeys !== 1 || !KEY_BASES.includes(j.base || 'slur')) return null
  const changes = {}
  for (const id in j.changes || {}) if (Array.isArray(j.changes[id])) changes[String(id)] = j.changes[id].filter(k => typeof k === 'string' && keyCode(k))
  return { base: j.base || 'slur', changes, name: String(j.name || '') }
}
if (typeof module !== 'undefined') module.exports = { keyBaseMap, keyMapOf, keyOwners, keyFree, keySaid, keySska, keyFromSska, keyPlain, KEY_BASES }
