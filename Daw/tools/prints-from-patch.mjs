// node tools/prints-from-patch.mjs — writes ui/prints.js: Patch on Slur's own drawings of its prints, for the DAW's wall.
// The pictures are not redrawn here: the plug-in's module that draws them (apps/plugin/src/components/collab/printGlyphs.ts,
// which gives plain SVG) is taken as it is and wrapped for a page without modules. Run it again when a print is added to
// Patch on Slur or its picture changes.
import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdtempSync, rmSync, readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '../..'), src = join(root, 'apps/plugin/src/components/collab')
const esb = join(root, 'node_modules/.pnpm', readdirSync(join(root, 'node_modules/.pnpm')).find(n => /^esbuild@/.test(n)), 'node_modules/esbuild/bin/esbuild')
const tmp = mkdtempSync(join(tmpdir(), 'slurprints-'))
try {
  /* the module also reads the LFO's shapes from a file that draws with React: nothing of React is needed for a picture */
  writeFileSync(join(tmp, 'react.cjs'), `const f = () => ({}), id = x => x; module.exports = new Proxy({}, { get: (_, k) => k === '__esModule' ? false : k === 'memo' || k === 'forwardRef' ? id : f })`)
  writeFileSync(join(tmp, 'entry.ts'), `export { printInner, PLATE_TINT, SHAPE, REACH } from ${JSON.stringify(join(src, 'printGlyphs.ts'))}\n`)
  execFileSync(esb, [join(tmp, 'entry.ts'), '--bundle', '--format=iife', '--global-name=PATCH_PRINTS', '--target=es2020', '--jsx=automatic', '--tree-shaking=true', '--legal-comments=none',
    `--alias:react=${join(tmp, 'react.cjs')}`, `--alias:react-dom=${join(tmp, 'react.cjs')}`, `--alias:react/jsx-runtime=${join(tmp, 'react.cjs')}`, '--loader:.css=empty', '--loader:.png=empty', '--loader:.svg=empty', '--loader:.woff2=empty',
    `--outfile=${join(tmp, 'out.js')}`, '--log-level=warning'], { stdio: 'inherit', cwd: root })
  const body = readFileSync(join(tmp, 'out.js'), 'utf8')
  writeFileSync(join(here, '../ui/prints.js'), `/* ── Patch on Slur's prints, as Patch on Slur draws them ──\n   MADE BY tools/prints-from-patch.mjs from the plug-in's own drawing module (printGlyphs.ts): not to be edited here, and not\n   to be redrawn. PATCH_PRINTS.printInner(node, family, tint) gives the SVG of a print in a box from -1 to 1. */\n` + body)
  console.log('wrote ui/prints.js', (body.length / 1024).toFixed(0) + ' KB')
} finally { rmSync(tmp, { recursive: true, force: true }) }
