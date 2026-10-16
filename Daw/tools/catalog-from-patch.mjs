// node tools/catalog-from-patch.mjs — writes ui/catalog.js: what Patch on Slur's prints are, for the DAW's wall.
// Which prints there are and what they are called, their flavours, where a new one rests, how its amount is said and read
// back, and the hands its study shows (range, step, default, unit, how each is said and read, when it is shown, what it
// writes into the print): all of it is the plug-in's own module (apps/plugin/src/components/collab/printCatalog.ts), taken
// as it is and wrapped for a page without modules. build.sh runs it on every build, so the wall follows the plug-in;
// tools/catalog-check.mjs then stops the build when the plug-in has something the wall has no place for.
import { writeFileSync, readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '../..'), src = join(root, 'apps/plugin/src')
const esbuild = await import(pathToFileURL(join(root, 'node_modules/.pnpm', readdirSync(join(root, 'node_modules/.pnpm')).find(n => /^esbuild@/.test(n)), 'node_modules/esbuild/lib/main.js')).href)
{
  /* the print numbers come from the plug-in's bridge to its engine, which also speaks to the plug-in's host: nothing of
     that is needed for data, so the host's side is a stand-in that does nothing */
  const host = { name: 'no-host', setup (b) {
    b.onResolve({ filter: /\/juceBridge$/ }, () => ({ path: 'juceBridge', namespace: 'no-host' }))
    b.onLoad({ filter: /.*/, namespace: 'no-host' }, () => ({ contents: 'export const callJuceNative = async () => null, hasJuceNativeFunction = () => false, hasJuceBridge = false, juceRegisteredFunctions = () => []', loader: 'js' }))
  } }
  const r = await esbuild.build({ entryPoints: [join(src, 'components/collab/printCatalog.ts')], bundle: true, format: 'iife', globalName: 'PATCH_CATALOG', target: 'es2020', treeShaking: true,
    legalComments: 'none', write: false, plugins: [host], logLevel: 'warning' })
  const body = r.outputFiles[0].text
  const out = `/* ── Patch on Slur's prints, as Patch on Slur says they are ──\n   MADE BY tools/catalog-from-patch.mjs from the plug-in's own catalog (printCatalog.ts) on every build: not to be edited\n   here. PATCH_CATALOG.PRINTS, .STUDY_HANDS, .fmtValue, .parseAmount, .auxOf … (the wall reads them in wall.js). */\n` + body
  const file = join(here, '../ui/catalog.js')
  let was = ''; try { was = readFileSync(file, 'utf8') } catch (e) { /* the first time */ }
  if (was !== out) writeFileSync(file, out)                                                // (untouched when nothing changed: the build copies by date)
  console.log(was === out ? 'ui/catalog.js as it was' : 'wrote ui/catalog.js', (body.length / 1024).toFixed(0) + ' KB')
}
