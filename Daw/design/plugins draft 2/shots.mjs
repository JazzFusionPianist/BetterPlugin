/* draws the frames of draft 2 over the settings page itself: node "design/plugins draft 2/shots.mjs" (from Daw) */
import { open } from '../../test/cdp.mjs'
import { readFileSync, renameSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const here = dirname(fileURLToPath(import.meta.url)), ui = join(here, '../../ui')
const list = readFileSync(join(here, '../plugins draft 1/plugs.json'), 'utf8')
const out = ['Console Recall', 'Ocean Way Studios', 'Auto-Key', 'UAD Fairchild 660', 'UAD Fairchild 670', 'UAD dbx 160', 'UAD Teletronix LA-3A', 'UAD Precision Limiter', 'UAD Precision Multiband']
const draft = readFileSync(join(here, 'draft.js'), 'utf8')
const frames = [
  ['kinds 1, the kind on a row pressed', `PG.group = 'other'; draw(); kdDraw(1)`],
  ['kinds 2, a row dragged onto a kind', `KD_SET['Serum 2 FX'] = 'modulation'; PG.group = 'other'; draw(); kdDraw(2)`],
  ['kinds 3, set by hand', `KD_SET['Serum 2 FX'] = 'modulation'; KD_SET['UAD Sphere Mic Collection'] = 'channel'; KD_SET['UAD Ocean Way Mic Collection'] = 'channel'; KD_SET['UAD Putnam Mic Collection'] = 'channel'; PG.group = 'channel'; draw(); kdDraw(3)`],
]
for (const [name, js] of frames) {
  const b = await open(join(ui, 'settings.html') + '?part=plug-ins', { width: 1100, height: 692, dsf: 2, before: `window.PLUG_STAND_IN = ${list}; window.PLUG_STAND_OUT = ${JSON.stringify(out)}` })
  await b.sleep(700)
  await b.ev(`${draft}; ${js}; return 1`)
  await b.sleep(200)
  await b.shot('kd.png'); renameSync(join(here, '../../test/out/kd.png'), join(here, name + '.png'))
  if (b.errors.length) console.log(name, b.errors)
  await b.close()
  console.log('took', name)
}
