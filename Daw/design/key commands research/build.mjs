/* writes ui/keysets.js from the four DAWs' default keys found here (logic.json, ableton.json, cubase.json, protools.json):
   node "design/key commands research/build.mjs"   (from Daw)
   For each DAW: the key it gives each command of Slur Studio that it has too (by the command's place in the menu bar:
   'Region > Mute'), the commands it has with no key, and every key it uses (so that what only Slur Studio has stays off
   them: ui/keymap.js). */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const here = dirname(fileURLToPath(import.meta.url)), out = join(here, '../../ui/keysets.js')
const OK = /^[⌃⌥⇧⌘]*(Key[A-Z]|Digit\d|Numpad(\d|Enter|Decimal|Multiply|Add|Subtract|Divide|Equal)|Space|Enter|Backspace|Delete|Tab|Escape|Arrow(Left|Right|Up|Down)|Home|End|PageUp|PageDown|Comma|Period|Slash|Semicolon|Quote|BracketLeft|BracketRight|Backquote|Minus|Equal|Backslash|F\d{1,2})$/
/* lines named otherwise since the research (the old name, the new) */
const RENAMED = { 'Slur Studio > Key Commands': 'Slur Studio > Key Commands…' }
const DAWS = [['logic', 'logic pro', 'Logic Pro 11.2'], ['ableton', 'ableton live', 'Ableton Live 12.4'], ['cubase', 'cubase', 'Cubase Pro 14'], ['protools', 'pro tools', 'Pro Tools 2025.12']]
const sets = {}
for (const [k, name, version] of DAWS) {
  const j = JSON.parse(readFileSync(join(here, k + '.json'), 'utf8'))
  const keys = {}, none = [], used = new Set()
  for (const r of j.rows) {
    const id0 = `${r.menu} > ${r.line}`, id = RENAMED[id0] || id0
    if (!r.equivalent) continue
    if (r.key && OK.test(r.key)) { if (!used.has(r.key)) { keys[id] = [r.key]; used.add(r.key) } else none.push(id) }       // (a key two of its commands share, the first keeps)
    else none.push(id)
  }
  const taken = [...new Set(j.taken.map(t => t.key).filter(x => x && OK.test(x)).concat([...used]))].sort()
  sets[k] = { name, version, keys, none, taken }
}
const js = `/* ── the default keys of four other DAWs, by the commands of Slur Studio they have too ──
   Written by design/key commands research/build.mjs from what was found there (2026-10-18; the sources are in those
   files). keys: a command (by its place in the menu bar) and the key that DAW gives it; none: those it has with no key;
   taken: every key it uses. ui/keymap.js makes a whole set of keys from these. */
const KEYSETS = ${JSON.stringify(sets)}
if (typeof module !== 'undefined') module.exports = { KEYSETS }
`
writeFileSync(out, js)
for (const [k, s] of Object.entries(sets)) console.log(k, Object.keys(s.keys).length, 'keys,', s.none.length, 'with none,', s.taken.length, 'taken')
