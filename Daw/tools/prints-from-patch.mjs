// node tools/prints-from-patch.mjs — writes ui/prints.js: Patch on Slur's own drawings of its prints, for the DAW's wall.
// The pictures are not redrawn here: the plug-in's module that draws them (apps/plugin/src/components/collab/printGlyphs.ts,
// which gives plain SVG) is taken as it is and wrapped for a page without modules. build.sh runs it on every build, so a
// print added to Patch on Slur, or a picture changed there, is here with the next build.
import { writeFileSync, readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '../..'), src = join(root, 'apps/plugin/src/components/collab')
const esbuild = await import(pathToFileURL(join(root, 'node_modules/.pnpm', readdirSync(join(root, 'node_modules/.pnpm')).find(n => /^esbuild@/.test(n)), 'node_modules/esbuild/lib/main.js')).href)
/* the module also reads the LFO's shapes from a file that draws with React: nothing of React is needed for a picture */
const noReact = { name: 'no-react', setup (b) {
  b.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, a => ({ path: a.path, namespace: 'no-react' }))
  b.onLoad({ filter: /.*/, namespace: 'no-react' }, () => ({ contents: `const f = () => ({}), id = x => x; module.exports = new Proxy({}, { get: (_, k) => k === '__esModule' ? false : k === 'memo' || k === 'forwardRef' ? id : f })`, loader: 'js' }))
} }
/* the module reads the lfo's shapes and the print numbers from the prints' catalog, whose numbers come from the plug-in's
   bridge to its engine: nothing of the host is needed for a picture either */
const noHost = { name: 'no-host', setup (b) {
  b.onResolve({ filter: /\/juceBridge$/ }, () => ({ path: 'juceBridge', namespace: 'no-host' }))
  b.onLoad({ filter: /.*/, namespace: 'no-host' }, () => ({ contents: 'export const callJuceNative = async () => null, hasJuceNativeFunction = () => false, hasJuceBridge = false, juceRegisteredFunctions = () => []', loader: 'js' }))
} }
const r = await esbuild.build({ stdin: { contents: `export { printInner, PLATE_TINT, SHAPE, REACH } from './printGlyphs.ts'`, resolveDir: src, loader: 'ts', sourcefile: 'prints-entry.ts' }, absWorkingDir: root,
  bundle: true, format: 'iife', globalName: 'PATCH_PRINTS', target: 'es2020', jsx: 'automatic', treeShaking: true, legalComments: 'none', write: false, plugins: [noReact, noHost], logLevel: 'warning',
  loader: { '.css': 'empty', '.png': 'empty', '.svg': 'empty', '.woff2': 'empty' } })
const body = r.outputFiles[0].text
const out = `/* ── Patch on Slur's prints, as Patch on Slur draws them ──\n   MADE BY tools/prints-from-patch.mjs from the plug-in's own drawing module (printGlyphs.ts) on every build: not to be edited\n   here, and not to be redrawn. PATCH_PRINTS.printInner(node, family, tint) gives the SVG of a print in a box from -1 to 1. */\n` + body
const file = join(here, '../ui/prints.js')
let was = ''; try { was = readFileSync(file, 'utf8') } catch (e) { /* the first time */ }
if (was !== out) writeFileSync(file, out)                                                  // (untouched when nothing changed)
console.log(was === out ? 'ui/prints.js as it was' : 'wrote ui/prints.js', (body.length / 1024).toFixed(0) + ' KB')
