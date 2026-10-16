// node tools/catalog-check.mjs — stops the build when Patch on Slur and this wall no longer agree about the prints.
// ui/catalog.js (the plug-in's own catalog, tools/catalog-from-patch.mjs) says what the prints are; this wall says only which
// of them it stands and where each goes in its list (ui/wall.js: WALL_KIND, WALL_OFF). It fails, saying why, when
//   · the plug-in has a print the wall neither lists nor leaves off (a new print: give it a kind in WALL_KIND, or WALL_OFF),
//   · the wall names a print the plug-in no longer has (one taken away or renamed there),
//   · a print the wall stands has no picture in ui/prints.js (tools/prints-from-patch.mjs, from the plug-in's printGlyphs.ts),
//   · a hand lives somewhere a print on this wall cannot hold, or writes a part of the print the wall does not keep and the
//     engine is not told of (Source/Engine.h reads the wall's prints field by field),
//   · a hand cannot be read, said or set on a print as it is when it is new.
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
const here = dirname(fileURLToPath(import.meta.url)), ui = join(here, '../ui')
const bad = []
const load = (file, name) => { const c = {}; vm.createContext(c); vm.runInContext(readFileSync(file.includes('/') ? file : join(ui, file), 'utf8') + `;this.${name} = ${name}`, c); return c[name] }
const PC = load(process.argv[2] || 'catalog.js', 'PATCH_CATALOG'), PP = load('prints.js', 'PATCH_PRINTS')      // (another catalog may be named: test/catalog.mjs checks that a wrong one is refused)
/* the wall's own two tables, read from wall.js as they are written there */
const wall = readFileSync(join(ui, 'wall.js'), 'utf8')
const table = (re, what) => { const m = re.exec(wall); if (!m) { console.error(`catalog-check: ${what} not found in ui/wall.js`); process.exit(1) } return vm.runInNewContext(`(${m[1]})`) }
const KIND = table(/^const WALL_KIND = (\{[\s\S]*?\})\n/m, 'WALL_KIND')
const OFF = new Set(table(/^const WALL_OFF = new Set\((\[[^\]]*\])\)/m, 'WALL_OFF'))
const key = name => name.toLowerCase()
const names = new Set(PC.PRINTS.map(p => p.name))
for (const p of PC.PRINTS) {
  if (p.type < 0) bad.push(`the catalog's shelf names "${p.name}", which is no print it has`)
  if (!OFF.has(p.name) && !KIND[key(p.name)]) bad.push(`Patch on Slur has "${p.name}" and this wall neither lists it nor leaves it off: give it a kind in WALL_KIND, or put it in WALL_OFF (ui/wall.js)`)
}
for (const k of Object.keys(KIND)) if (!PC.PRINTS.some(p => key(p.name) === k)) bad.push(`WALL_KIND names "${k}", which Patch on Slur no longer has (ui/wall.js)`)
for (const nm of OFF) if (!names.has(nm)) bad.push(`WALL_OFF names "${nm}", which Patch on Slur no longer has (ui/wall.js)`)
/* what a print on this wall is made of, what the engine reads of it, and where a hand may live */
/* the engine reads a wall as Patch on Slur reads a patch (Plugin/Source/FxEngine.cpp graphFromVar), and Slur Studio's
   engine hands the page's wall to it (Source/Engine.h setWall) */
const engine = readFileSync(join(here, '../Source/Engine.h'), 'utf8'), shared = readFileSync(join(here, '../../Plugin/Source/FxEngine.cpp'), 'utf8')
const reader = shared.slice(shared.indexOf('bool graphFromVar'), shared.indexOf('\n}\n', shared.indexOf('bool graphFromVar')))
if (!reader) bad.push('the engine has no graphFromVar (Plugin/Source/FxEngine.cpp): nothing reads a wall as Patch on Slur does')
if (!/graphFromVar\s*\(\s*d\s*,/.test(engine.slice(engine.indexOf('juce::var setWall')))) bad.push('Slur Studio\'s engine does not read its wall with graphFromVar (Source/Engine.h setWall)')
const FIELDS = ['amount', 'variant', 'decay', 'delayDiv', 'delayFb', 'wet', 'bypass', 'aux', 'curve', 'pts', 'pts2', 'sceneA', 'sceneB'], DRAWN = ['curve', 'pts', 'pts2', 'sceneA', 'sceneB'], EDGE = ['hand', 'pol']
for (const f of FIELDS) if (!new RegExp(`n\\s*\\[\\s*"${f}"\\s*\\]|hasProperty\\s*\\(\\s*"${f}"\\s*\\)`).test(reader)) bad.push(`the engine does not read "${f}" of a print (graphFromVar), which the wall tells it`)
const msg = wall.slice(wall.indexOf('function wallMsg'), wall.indexOf('\n}\n', wall.indexOf('function wallMsg')))
const drawn = (/^const wallDrawn = .*$/m.exec(wall) || [''])[0]
for (const f of FIELDS) if (f !== 'amount' && !DRAWN.includes(f) && !new RegExp(`\\b${f === 'delayDiv' ? 'delayDiv: n\\.div' : f === 'delayFb' ? 'delayFb: n\\.fb' : f}\\b`).test(msg)) bad.push(`the wall does not tell the engine "${f}" of a print (ui/wall.js wallMsg)`)
if (!/wallDrawn\(n\)/.test(msg)) bad.push('the wall does not tell the engine what a print carries beside its hands (ui/wall.js wallMsg: wallDrawn)')
for (const f of DRAWN) if (!new RegExp(`n\\.${f}\\b`).test(drawn)) bad.push(`the wall does not tell the engine "${f}" of a print (ui/wall.js wallDrawn)`)
for (const f of EDGE) if (!new RegExp(`e\\s*\\[\\s*"${f}"\\s*\\]|hasProperty\\s*\\(\\s*"${f}"\\s*\\)`).test(reader)) bad.push(`the engine does not read "${f}" of a control wire (graphFromVar)`)
for (const f of EDGE) if (!new RegExp(`\\b${f}: e\\.${f}`).test(msg)) bad.push(`the wall does not tell the engine "${f}" of a control wire (ui/wall.js wallMsg)`)
const AT = /^(variant|decay|div|fb|amount|pts|pts2|aux[0-7])$/
for (const p of PC.PRINTS) {
  if (OFF.has(p.name)) continue
  const fresh = { id: 0, type: p.type, amount: PC.neutralOf(p.type), variant: PC.variantOf(p.type), decay: [0.5, 0.5, 0.5], delayDiv: 2, delayFb: 0.35, wet: false, bypass: false, aux: PC.auxOf(p.type).concat([0, 0, 0, 0, 0, 0, 0, 0]).slice(0, 8), x: 0, y: 0 }
  try { const svg = PP.printInner(fresh, p.family, PP.PLATE_TINT[p.type] || '#B8B4AA'); if (!PP.PLATE_TINT[p.type] || !svg || svg.length < 40) bad.push(`"${p.name}" has no picture in ui/prints.js`) } catch (e) { bad.push(`"${p.name}"'s picture fails: ${e.message}`) }
  try { PC.fmtValue(p.type, fresh.amount, fresh.variant); PC.parseAmount(p.type, '50', fresh.variant) } catch (e) { bad.push(`"${p.name}"'s amount cannot be said or read: ${e.message}`) }
  /* every hand, on every flavour the print has (some hands come with one flavour only) */
  const flavours = Math.max(1, PC.flavoursOf(p.type).length)
  for (let v = 0; v < flavours; v++) {
    const n = Object.assign({}, fresh, { variant: v })
    for (const h of PC.studyHandsOf(n)) {
      const at = `"${p.name}" ${h.kind} "${h.key}"`
      if (!['gauge', 'choice', 'switch'].includes(h.kind)) { bad.push(`${at}: a hand of a kind this wall cannot show`); continue }
      if (!AT.test(h.at)) { bad.push(`${at}: lives in "${h.at}", which a print here does not hold`); continue }
      try {
        const now = h.get(n), label = PC.valueOf(h.label, n)
        if (typeof label !== 'string' || !label) bad.push(`${at}: no name`)
        let wrote
        if (h.kind === 'gauge') {
          const lo = PC.valueOf(h.min, n), hi = PC.valueOf(h.max, n), def = PC.valueOf(h.def, n)
          if (!(Number.isFinite(now) && lo < hi && def >= lo && def <= hi)) bad.push(`${at}: its range or rest is not one (${lo}..${hi}, ${def}, now ${now})`)
          if (h.format && typeof h.format(now, n) !== 'string') bad.push(`${at}: is not said`)
          if (h.parse) h.parse('1', n)
          wrote = h.set(def, n)
        } else if (h.kind === 'choice') {
          const opts = PC.valueOf(h.options, n)
          if (!Array.isArray(opts) || !opts.length || !((now >= 0 || (now === -1 && h.none)) && now < opts.length)) bad.push(`${at}: its choice is not among its words (${now} of ${opts && opts.length})`)
          wrote = h.set(opts.length - 1, n)
        } else wrote = h.set(!h.get(n), n)
        for (const f of Object.keys(wrote || {})) if (!FIELDS.includes(f)) bad.push(`${at}: writes "${f}", a part of a print this wall does not keep or tell the engine`)
      } catch (e) { bad.push(`${at}: fails on a new print (${e.message})`) }
    }
  }
}
if (bad.length) { console.error(`catalog-check: Patch on Slur and Slur Studio's wall do not agree (${bad.length}):\n  ` + [...new Set(bad)].join('\n  ')); process.exit(1) }
console.log(`catalog-check: the wall stands ${PC.PRINTS.filter(p => !OFF.has(p.name)).length} of Patch on Slur's ${PC.PRINTS.length} prints, and agrees with it about every one`)
