// Pro Tools keyboard-shortcut files -> Slur key notation.
//
// Where a Pro Tools user's own shortcuts live on macOS (Pro Tools 2022.4+, checked against 2025.12):
//   ~/Library/Preferences/Avid/Pro Tools/PTCustomHotkeys.txt
//       the set in use now (written by PTCustomHotkeys::SaveToDefaultFile; read with the same loader as presets).
//   ~/Documents/Pro Tools/Pro Tools Presets/Keyboard Shortcuts/Quick Preset 1.ptpreset … Quick Preset 5.ptpreset
//       the five preset buttons of Setup > Keyboard Shortcuts (Control+1…5).
//   ~/Documents/Pro Tools/Pro Tools Presets/Keyboard Shortcuts/*.ptpreset
//       named presets from the Librarian menu ("Save Settings As"); the Application/ subfolder holds Avid's
//       alternate-DAW presets (copies of /Applications/Pro Tools.app/Contents/SharedSupport/Factory Content/…).
//
// File format (JSON, UTF-8):
//   { "Version": { "Major": "1", "Minor": "0" },
//     "Bindings": [ { "Command": "NewTrack",
//                     "Original Key": "N", "Original Modifiers": "<Cmd>+<Shift>",
//                     "New Key": "T",      "New Modifiers": "" }, … ] }
//   The file holds only the changes from the factory set. One entry = one binding of one command:
//     Original + New        the factory binding Original is replaced by New
//     Original + New=Invalid the factory binding Original is removed (command left without it)
//     New only              a binding added to the command (it had none, or this is an extra one)
//   A command can own several bindings (e.g. MoveEditInsertionToNextEdit: Tab, Shift+Tab, Focus+').
//   Modifiers: "<Cmd>", "<Opt>", "<Ctrl>", "<Shift>", "<Focus>" joined by "+", written in that order.
//     <Ctrl> is the Mac Control key; <Focus> means the binding works only with Commands Keyboard Focus on
//     (a single key in the Edit window). Pro Tools also knows "<Alt>" and "[Cmd]"-style spellings; a file
//     written on Windows may use <Ctrl>/<Alt>/<Start> for Control/Alt/Windows key (see `windows` below).
//   Keys: one character for letters, digits and punctuation ("A", "5", ",", "'", "[", "\\", "=", "-"),
//     otherwise names: BackSpace Tab Clear Return Esc Space PageUp PageDown Home End LeftArrow RightArrow
//     UpArrow DownArrow Insert Delete Tilde (= the ` key) "Numpad 0"…"Numpad 9" "Numpad *" "Numpad +" "Numpad -"
//     "Numpad ." "Numpad /" "Numpad =" "Numpad ," "Numpad Enter" F1…F24 NumLock ScrollLock; "Invalid" = no key.
//
// Slur notation: modifiers ⌃ ⌥ ⇧ ⌘ in that order, then KeyboardEvent.code. A Commands-Focus binding is
// returned as 'focus:' + notation (e.g. 'focus:KeyA', 'focus:⇧KeyZ'); Slur has no focus mode, so callers
// decide what to do with those (Avid: with focus off the same key held with Control does the same).

const NAMED = {
  backspace: 'Backspace', tab: 'Tab', clear: 'NumLock', return: 'Enter', enter: 'Enter', esc: 'Escape', escape: 'Escape',
  space: 'Space', pageup: 'PageUp', pagedown: 'PageDown', home: 'Home', end: 'End',
  leftarrow: 'ArrowLeft', rightarrow: 'ArrowRight', uparrow: 'ArrowUp', downarrow: 'ArrowDown',
  insert: 'Insert', delete: 'Delete', tilde: 'Backquote', numlock: 'NumLock', 'num lock': 'NumLock',
  scrolllock: 'ScrollLock', 'scroll lock': 'ScrollLock', prtsc: 'PrintScreen',
  comma: 'Comma', period: 'Period', apostrophe: 'Quote', semicolon: 'Semicolon', minus: 'Minus', equals: 'Equal',
  'numpad *': 'NumpadMultiply', 'numpad +': 'NumpadAdd', 'numpad -': 'NumpadSubtract', 'numpad minus': 'NumpadSubtract',
  'numpad .': 'NumpadDecimal', 'numpad period': 'NumpadDecimal', 'numpad /': 'NumpadDivide', 'numpad =': 'NumpadEqual',
  'numpad ,': 'NumpadComma', 'numpad comma': 'NumpadComma', 'numpad enter': 'NumpadEnter',
}
const PUNCT = { "'": 'Quote', ',': 'Comma', '-': 'Minus', '.': 'Period', '/': 'Slash', ';': 'Semicolon', '=': 'Equal',
  '[': 'BracketLeft', ']': 'BracketRight', '\\': 'Backslash', '`': 'Backquote', '~': 'Backquote' }

// Pro Tools key name -> KeyboardEvent.code ('' when there is no key or it cannot be typed on a Mac)
export function ptCode(key) {
  if (key == null) return ''
  const k = String(key).trim()
  if (!k || /^(invalid|unknown|none|cancel|select|execute|snapshot|alt)$/i.test(k)) return ''
  if (k.length === 1) {
    if (/[a-z]/i.test(k)) return 'Key' + k.toUpperCase()
    if (/[0-9]/.test(k)) return 'Digit' + k
    return PUNCT[k] || ''
  }
  const low = k.toLowerCase().replace(/\s+/g, ' ')
  if (NAMED[low]) return NAMED[low]
  let m = /^numpad ?([0-9])$/.exec(low); if (m) return 'Numpad' + m[1]
  m = /^f([1-9]|1[0-9]|2[0-4])$/.exec(low); if (m) return 'F' + m[1]
  return ''
}

// Modifier string -> { ctrl, alt, shift, meta, focus }. windows=true reads a Windows-written file
// (<Ctrl> = Control there = ⌘ here, <Alt> = ⌥, <Start>/<Win> = ⌃).
export function ptMods(mods, { windows = false } = {}) {
  const r = { ctrl: false, alt: false, shift: false, meta: false, focus: false }
  for (const raw of String(mods || '').split('+')) {
    const t = raw.replace(/[<>\[\]\s]/g, '').toLowerCase()
    if (!t) continue
    if (t === 'shift') r.shift = true
    else if (t === 'focus') r.focus = true
    else if (t === 'cmd' || t === 'command') r.meta = true
    else if (t === 'opt' || t === 'option' || t === 'alt') r.alt = true
    else if (t === 'ctrl' || t === 'cntrl' || t === 'control') { if (windows) r.meta = true; else r.ctrl = true }
    else if (t === 'start' || t === 'win' || t === 'winkey' || t === 'windows') r.ctrl = true
  }
  return r
}

// Pro Tools key + modifiers -> Slur notation ('' when there is no key)
export function ptKey(key, mods, opts = {}) {
  const code = ptCode(key)
  if (!code) return ''
  const m = ptMods(mods, opts)
  const s = (m.ctrl ? '⌃' : '') + (m.alt ? '⌥' : '') + (m.shift ? '⇧' : '') + (m.meta ? '⌘' : '') + code
  return m.focus ? 'focus:' + s : s
}

export const isFocus = k => typeof k === 'string' && k.startsWith('focus:')

// Parse the text of a .ptpreset or PTCustomHotkeys.txt (tolerates a BOM).
export function ptParse(text) {
  const d = typeof text === 'string' ? JSON.parse(text.replace(/^﻿/, '')) : text
  if (!d || !Array.isArray(d.Bindings)) throw new Error('not a Pro Tools keyboard shortcuts file (no "Bindings")')
  return d
}

// True when the file looks written by Pro Tools for Windows (uses <Alt>/<Start>/<Win> and never <Cmd>/<Opt>).
export function ptLooksWindows(preset) {
  let win = false, mac = false
  for (const b of preset.Bindings || []) for (const f of ['Original Modifiers', 'New Modifiers']) {
    const s = String(b[f] || '').toLowerCase()
    if (/(<|\[)(cmd|opt)(>|\])/.test(s)) mac = true
    if (/(<|\[)(alt|start|win|winkey)(>|\])/.test(s)) win = true
  }
  return win && !mac
}

// Apply a preset/active-set file to a default table { command: [slurKeys] }.
// Returns { table, changed, conflicts, missingOriginal, unmapped }. Nothing is mutated.
//   resolve: when true, a key newly given to a command is taken off every other command
//            (Pro Tools itself keeps both and flags a conflict until the user presses Resolve).
export function ptApply(defaults, preset, { resolve = false, windows } = {}) {
  const p = ptParse(preset)
  const opts = { windows: windows ?? ptLooksWindows(p) }
  const table = {}
  for (const [c, ks] of Object.entries(defaults || {})) table[c] = [...ks]
  const changed = new Set(), missingOriginal = [], unmapped = [], added = []
  for (const b of p.Bindings) {
    const cmd = b.Command
    if (!cmd) continue
    const list = table[cmd] || (table[cmd] = [])
    const hasOrig = b['Original Key'] != null && String(b['Original Key']) !== ''
    const orig = hasOrig ? ptKey(b['Original Key'], b['Original Modifiers'], opts) : ''
    const neu = ptKey(b['New Key'], b['New Modifiers'], opts)
    const newIsNone = /^\s*(invalid)?\s*$/i.test(String(b['New Key'] ?? ''))
    if (!neu && !newIsNone) unmapped.push(b)
    let at = -1
    if (hasOrig) {
      if (!orig) unmapped.push(b)
      at = list.indexOf(orig)
      if (at >= 0) list.splice(at, 1)
      else if (orig) missingOriginal.push({ command: cmd, key: orig })
    }
    if (neu && !list.includes(neu)) {
      if (at >= 0) list.splice(at, 0, neu); else list.push(neu)
      added.push([cmd, neu])
    }
    changed.add(cmd)
  }
  if (resolve) {                                       // the last command in the file to take a key keeps it
    const owner = new Map()
    for (const [cmd, k] of added) if ((table[cmd] || []).includes(k)) owner.set(k, cmd)
    for (const [k, cmd] of owner)
      for (const [c, ks] of Object.entries(table)) if (c !== cmd) { const i = ks.indexOf(k); if (i >= 0) { ks.splice(i, 1); changed.add(c) } }
  }
  const owners = {}
  for (const [c, ks] of Object.entries(table)) for (const k of ks) (owners[k] || (owners[k] = [])).push(c)
  const conflicts = added.map(([, k]) => k).filter((k, i, a) => a.indexOf(k) === i && owners[k] && owners[k].length > 1)
    .map(k => ({ key: k, commands: owners[k] }))
  return { table, changed: [...changed], conflicts, missingOriginal, unmapped }
}

// The keys of one Slur command from a table, using a row of protools-ids.json
// ({ ids, focusIds, filter }): key = first non-focus binding found in ids (in order), keyFocus = first
// focus binding found in ids then focusIds; filter 'shift' keeps only bindings with ⇧, 'noshift' only without.
export function ptRowKeys(table, row) {
  const pass = k => row.filter === 'shift' ? k.includes('⇧') : row.filter === 'noshift' ? !k.includes('⇧') : true
  const keys = [], focus = []
  for (const id of row.ids || []) for (const k of table[id] || []) if (pass(k)) (isFocus(k) ? focus : keys).push(k)
  for (const id of row.focusIds || []) for (const k of table[id] || []) if (isFocus(k) && pass(k)) focus.push(k)
  return { key: keys[0] || '', keyFocus: focus[0] ? focus[0].slice(6) : '', keys, focus: focus.map(k => k.slice(6)) }
}
