// node test/catalog.mjs — the build's check (tools/catalog-check.mjs) passes the plug-in's catalog as it is, and refuses one
// that no longer agrees with the wall: a print the wall has no place for, a hand that writes what the wall does not keep,
// a hand that lives where a print cannot hold it, a print the wall names that the plug-in has dropped.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url)), check = join(here, '../tools/catalog-check.mjs'), cat = readFileSync(join(here, '../ui/catalog.js'), 'utf8')
const tmp = mkdtempSync(join(tmpdir(), 'slurcheck-')), out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined && !cond ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const run = (more) => { const f = join(tmp, 'catalog.js'); writeFileSync(f, cat + '\n' + (more || '')); try { return { pass: true, said: execFileSync('node', [check, f], { encoding: 'utf8', stdio: 'pipe' }) } } catch (e) { return { pass: false, said: String(e.stderr || '') } } }
try {
  let r = run(); ok('the plug-in’s catalog as it is: the build goes on', r.pass, r.said)
  r = run(`PATCH_CATALOG.PRINTS.push({ type: 51, name: 'bloom', family: 'space' })`); ok('a print the wall has no place for stops the build, by its name', !r.pass && /"bloom".*neither lists it nor leaves it off/.test(r.said), r.said)
  r = run(`PATCH_CATALOG.STUDY_HANDS[2].push({ kind: 'gauge', key: 'x', label: 'shape', at: 'aux1', min: 0, max: 1, def: 0, get: () => 0, set: () => ({ glow: [0, 1] }) })`); ok('a hand that writes a part of a print the wall does not keep stops it', !r.pass && /"space" gauge "x": writes "glow"/.test(r.said), r.said)
  r = run(`PATCH_CATALOG.STUDY_HANDS[10].push({ kind: 'choice', key: 'y', label: 'y', at: 'aux9', options: ['a'], get: () => 0, set: () => ({}) })`); ok('a hand where a print holds nothing stops it', !r.pass && /"delay" choice "y": lives in "aux9"/.test(r.said), r.said)
  r = run(`PATCH_CATALOG.PRINTS.splice(PATCH_CATALOG.PRINTS.findIndex(p => p.name === 'wow'), 1)`); ok('a print the wall names that the plug-in dropped stops it', !r.pass && /WALL_KIND names "wow"/.test(r.said), r.said)
  r = run(`PATCH_CATALOG.STUDY_HANDS[35][1].max = 0.5`); ok('a hand whose rest is out of its range stops it', !r.pass && /"comp" gauge "ratio": its range/.test(r.said), r.said)
} finally { rmSync(tmp, { recursive: true, force: true }) }
console.log(out.join('\n'))
console.log(bad.length ? `catalog: ${bad.length} FAILED\n  ${bad.join('\n  ')}` : 'catalog: all passed')
process.exit(bad.length ? 1 : 0)
