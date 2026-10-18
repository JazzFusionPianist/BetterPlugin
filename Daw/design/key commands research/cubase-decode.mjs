// Reads Cubase's key commands file ("Key Commands.xml", or a preset from Presets/KeyCommands/*.xml)
// and turns Cubase key names into Slur's notation: modifiers in the order ⌃ ⌥ ⇧ ⌘, then the
// physical key as KeyboardEvent.code names it (KeyA, Digit1, Numpad5, NumpadMultiply, ArrowLeft, …).
//
// What Cubase writes (seen in real files from Cubase on macOS; Windows names by Steinberg's convention):
//   <KeyCommands>
//     <list name="Categories" type="list">
//       <item>
//         <string name="Name" value="Transport"/>
//         <list name="Commands" type="list">
//           <item><string name="Name" value="Goto End"/></item>                          ← no key
//           <item><string name="Name" value="Start"/><string name="Key" value="Enter" wide="true"/></item>
//           <item><string name="Name" value="Return to Zero"/>
//                 <list name="Key" type="string"><item value="Pad ."/><item value=","/></list></item>
//         …
//     <list name="Macros" type="list">
//       <item><string name="Name" value="My Macro"/>
//             <list name="Commands" type="list"><item><string name="Category" value="Edit"/>
//                                                   <string name="Name" value="Select All"/></item>…</list></item>
// Names are Cubase's internal ones (the same pairs the MIDI Remote API binds), not the dialog's labels,
// and they are English whatever language Cubase shows. A macro's key sits in the "Macro" category.
//
// Modifiers: macOS files say Command, Option, Control, Shift; Windows files say Ctrl, Alt, Shift.
// Per Slur's rule a Windows Ctrl becomes ⌘ and Alt ⌥; the Mac Control key ("Control") becomes ⌃.
// Keypad keys: Pad0…Pad9, "Pad *", "Pad +", "Pad -", "Pad /", "Pad ."; "Enter" is the keypad Enter and
// "Return" the main one. Punctuation is the character itself (",", ".", ";", "'", "/", "\" …), read as a
// US layout.
//
// No DOM and no Node APIs are used inside these functions.

const MODS = [
  [/^(command|cmd)\+/i, '⌘'],
  [/^ctrl\+/i, '⌘'],            // a Windows Ctrl is ⌘ on the Mac
  [/^control\+/i, '⌃'],         // the Mac Control key, as Cubase on macOS writes it
  [/^(option|opt|alt)\+/i, '⌥'],
  [/^shift\+/i, '⇧'],
]
const ORDER = '⌃⌥⇧⌘'

const NAMED = {
  'space': 'Space', 'return': 'Enter', 'enter': 'NumpadEnter', 'pad enter': 'NumpadEnter', 'padenter': 'NumpadEnter',
  'tab': 'Tab', 'esc': 'Escape', 'escape': 'Escape', 'backspace': 'Backspace', 'back space': 'Backspace',
  'del': 'Delete', 'delete': 'Delete', 'ins': 'Insert', 'insert': 'Insert', 'help': 'Insert',
  'home': 'Home', 'end': 'End', 'pgup': 'PageUp', 'page up': 'PageUp', 'pageup': 'PageUp',
  'pgdown': 'PageDown', 'pgdn': 'PageDown', 'page down': 'PageDown', 'pagedown': 'PageDown',
  'up arrow': 'ArrowUp', 'down arrow': 'ArrowDown', 'left arrow': 'ArrowLeft', 'right arrow': 'ArrowRight',
  'up': 'ArrowUp', 'down': 'ArrowDown', 'left': 'ArrowLeft', 'right': 'ArrowRight',
  'clear': 'NumLock', 'pad clear': 'NumLock', 'num lock': 'NumLock', 'numlock': 'NumLock',
  'pad *': 'NumpadMultiply', 'pad +': 'NumpadAdd', 'pad -': 'NumpadSubtract', 'pad /': 'NumpadDivide',
  'pad .': 'NumpadDecimal', 'pad ,': 'NumpadDecimal', 'pad ;': 'NumpadDecimal', 'pad del': 'NumpadDecimal',
  'pad =': 'NumpadEqual',
  ',': 'Comma', '.': 'Period', '/': 'Slash', ';': 'Semicolon', "'": 'Quote', '[': 'BracketLeft',
  ']': 'BracketRight', '\\': 'Backslash', '-': 'Minus', '=': 'Equal', '`': 'Backquote', '<': 'IntlBackslash',
}

// One Cubase key name ("Command+Shift+D", "Option+Pad8", "Shift+Pad *", "Pad .", "Up Arrow") → Slur notation
// ("⇧⌘KeyD", "⌥Numpad8", "⇧NumpadMultiply", "NumpadDecimal", "ArrowUp"); null when it cannot be read.
export function cubaseKey(text) {
  if (typeof text !== 'string') return null
  let rest = text.trim()
  let mods = ''
  for (let changed = true; changed && rest.length > 1;) {
    changed = false
    for (const [re, sym] of MODS) {
      const m = re.exec(rest)
      if (m && rest.length > m[0].length) {           // keep a lone "+" as the key itself
        if (!mods.includes(sym)) mods += sym
        rest = rest.slice(m[0].length)
        changed = true
        break
      }
    }
  }
  if (/^(win|meta|super)\+/i.test(rest)) return null
  const key = rest.trim() === '' ? rest : rest.trim()
  const low = key.toLowerCase().replace(/\s+/g, ' ')
  let code = null
  if (/^[a-z]$/i.test(key)) code = 'Key' + key.toUpperCase()
  else if (/^[0-9]$/.test(key)) code = 'Digit' + key
  else if (/^pad ?[0-9]$/i.test(key)) code = 'Numpad' + key.slice(-1)
  else if (/^f([1-9]|1[0-9]|2[0-4])$/i.test(key)) code = 'F' + key.slice(1)
  else if (NAMED[low]) code = NAMED[low]
  else if (low.startsWith('pad') && NAMED['pad ' + low.slice(3).trim()]) code = NAMED['pad ' + low.slice(3).trim()]
  else if (key === '+') code = 'Equal'                  // "+" without "Pad": the =/+ key on a US layout
  if (!code) return null
  return [...ORDER].filter(c => mods.includes(c)).join('') + code
}

// ---- a tiny XML reader: elements, attributes, text is ignored ----
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
function unescapeXml(s) {
  return s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (all, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(n) ? String.fromCodePoint(n) : all
    }
    return ENT[e.toLowerCase()] ?? all
  })
}
function parseXml(text) {
  const root = { tag: '#root', attrs: {}, kids: [] }
  const stack = [root]
  const n = text.length
  let i = 0
  while (i < n) {
    const lt = text.indexOf('<', i)
    if (lt < 0) break
    if (text.startsWith('<!--', lt)) { const e = text.indexOf('-->', lt + 4); i = e < 0 ? n : e + 3; continue }
    if (text.startsWith('<![CDATA[', lt)) { const e = text.indexOf(']]>', lt + 9); i = e < 0 ? n : e + 3; continue }
    if (text.startsWith('<?', lt) || text.startsWith('<!', lt)) { const e = text.indexOf('>', lt + 2); i = e < 0 ? n : e + 1; continue }
    // find the closing '>' outside quotes
    let j = lt + 1, q = null
    for (; j < n; j++) {
      const c = text[j]
      if (q) { if (c === q) q = null }
      else if (c === '"' || c === "'") q = c
      else if (c === '>') break
    }
    if (j >= n) break
    const raw = text.slice(lt + 1, j)
    i = j + 1
    if (raw[0] === '/') {
      const tag = raw.slice(1).trim()
      for (let k = stack.length - 1; k > 0; k--) if (stack[k].tag === tag) { stack.length = k; break }
      continue
    }
    const selfClose = raw.endsWith('/')
    const body = selfClose ? raw.slice(0, -1) : raw
    const m = /^\s*([^\s/>]+)/.exec(body)
    if (!m) continue
    const el = { tag: m[1], attrs: {}, kids: [] }
    const re = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g
    let a
    const attrText = body.slice(m[0].length)
    while ((a = re.exec(attrText))) el.attrs[a[1]] = unescapeXml(a[3] ?? a[4] ?? '')
    stack[stack.length - 1].kids.push(el)
    if (!selfClose) stack.push(el)
  }
  return root
}
const kidsNamed = (el, tag, name) => el.kids.filter(k => k.tag === tag && (name === undefined || k.attrs.name === name))
const strVal = (el, name) => { const s = kidsNamed(el, 'string', name)[0]; return s ? s.attrs.value ?? '' : undefined }

// The whole file → [{ category, name, keys: ['⇧⌘KeyD', …], raw: ['Command+Shift+D', …], unread: […] }]
// One entry per command in the file, keys [] when none is assigned (the file lists every command, so an
// empty list means "no key", not "default"). Commands of the "Macro" category also carry
// macro: [{ category, name }, …], the steps of that macro from the file's Macros list.
export function decodeCubaseXml(text) {
  const doc = parseXml(String(text ?? ''))
  const top = doc.kids.find(k => k.tag === 'KeyCommands') ?? doc
  const macros = new Map()
  for (const list of kidsNamed(top, 'list', 'Macros')) {
    for (const item of kidsNamed(list, 'item')) {
      const name = strVal(item, 'Name')
      if (name === undefined) continue
      const steps = []
      for (const cl of kidsNamed(item, 'list', 'Commands'))
        for (const st of kidsNamed(cl, 'item')) steps.push({ category: strVal(st, 'Category') ?? '', name: strVal(st, 'Name') ?? '' })
      macros.set(name, steps)
    }
  }
  const out = []
  for (const cats of kidsNamed(top, 'list', 'Categories')) {
    for (const cat of kidsNamed(cats, 'item')) {
      const category = strVal(cat, 'Name') ?? ''
      for (const cl of kidsNamed(cat, 'list', 'Commands')) {
        for (const cmd of kidsNamed(cl, 'item')) {
          const name = strVal(cmd, 'Name')
          if (name === undefined) continue
          const raw = []
          for (const s of kidsNamed(cmd, 'string', 'Key')) if (s.attrs.value) raw.push(s.attrs.value)
          for (const l of kidsNamed(cmd, 'list', 'Key')) for (const it of kidsNamed(l, 'item')) if (it.attrs.value) raw.push(it.attrs.value)
          const keys = [], unread = []
          for (const r of raw) { const k = cubaseKey(r); if (k) { if (!keys.includes(k)) keys.push(k) } else unread.push(r) }
          const entry = { category, name, keys, raw }
          if (unread.length) entry.unread = unread
          if (category === 'Macro' && macros.has(name)) entry.macro = macros.get(name)
          out.push(entry)
        }
      }
    }
  }
  return out
}
