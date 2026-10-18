/* writes ui/keyimport.js: the readers of other programs' own sets of keys (logic-decode.mjs, cubase-decode.mjs,
   protools-decode.mjs) as the settings window can load them, and for each command of Slur Studio (by its place in
   the menu bar) the commands of those programs that are it (logic-ids.json, cubase-ids.json, protools-ids.json):
   node "design/key commands research/build-import.mjs"   (from Daw) */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const here = dirname(fileURLToPath(import.meta.url)), out = join(here, '../../ui/keyimport.js')
const read = f => readFileSync(join(here, f), 'utf8')
const strip = code => code.replace(/^export \{[^}]*\}\s*$/mg, '').replace(/^export (async function|function|const|let|class) /mg, '$1 ')
const wrap = (name, file, ret) => `const ${name} = (() => {\n${strip(read(file))}\nreturn { ${ret} }\n})()\n`
const RENAMED = { 'Slur Studio > Key Commands': 'Slur Studio > Key Commands…' }
const rowId = r => { const id = `${r.menu} > ${r.line}`; return RENAMED[id] || id }
const ids = { logic: {}, cubase: {}, protools: {} }
for (const r of JSON.parse(read('logic-ids.json')).rows) if ((r.ids || []).length) ids.logic[rowId(r)] = { ids: r.ids, near: r.near || [] }
for (const r of JSON.parse(read('cubase-ids.json'))) if (r.name) ids.cubase[rowId(r)] = { category: r.category, name: r.name, alt: r.alt || null }
const pt = JSON.parse(read('protools-ids.json'))
for (const r of pt.rows) if ((r.ids || []).length || (r.focusIds || []).length) ids.protools[rowId(r)] = { ids: r.ids || [], focusIds: r.focusIds || [], filter: r.filter || '' }
const js = `/* ── reading another program's own set of keys ──
   Written by design/key commands research/build-import.mjs (2026-10-18) from the readers and the tables there: Logic
   Pro's (its preferences, a .logikcs), Cubase's (Key Commands.xml), Pro Tools' (PTCustomHotkeys.txt, a .ptpreset). Each
   reader gives the program's own commands and their keys in the room's notation; KI_IDS says which of them each command
   of Slur Studio is. keypage.js turns that into a set of the room's keys. Ableton Live has no set of its own to read: its
   keys cannot be changed. */
${wrap('KI_LOGIC', 'logic-decode.mjs', 'decodeLogicKeyCommands')}
${wrap('KI_CUBASE', 'cubase-decode.mjs', 'decodeCubaseXml')}
${wrap('KI_PROTOOLS', 'protools-decode.mjs', 'ptApply, ptParse, ptRowKeys, isFocus')}
const KI_IDS = ${JSON.stringify(ids)}
const KI_PT_DEFAULTS = ${JSON.stringify(pt.defaults)}
if (typeof module !== 'undefined') module.exports = { KI_LOGIC, KI_CUBASE, KI_PROTOOLS, KI_IDS, KI_PT_DEFAULTS }
`
writeFileSync(out, js)
console.log('keyimport.js', js.length, 'bytes;', Object.keys(ids.logic).length, 'logic,', Object.keys(ids.cubase).length, 'cubase,', Object.keys(ids.protools).length, 'pro tools commands tied')
