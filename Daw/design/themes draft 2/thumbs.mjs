/* the pictures of the themes in settings > display (ui/themes/<name>.png): the room as it comes and in each built-in
   theme, with the demo song and the mixer open, made small: node "design/themes draft 2/thumbs.mjs" (from Daw) */
import { room } from '../../guide/shots.mjs'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const out = join(dirname(fileURLToPath(import.meta.url)), '../../ui/themes')
const b = await room({ w: 1440, h: 900, dsf: 1 })
await b.sleep(900)
await b.ev(`for (const t of S.tracks) { if (t.theirs === 'jun') t.theirs = 'theo'; if (t.theirs === 'minseo') t.theirs = 'mina' } S.panel.on = true; S.panel.tab = 'mixer'; setView(true); return 1`)
for (const name of ['as it comes'].concat(await b.ev(`return THEME_ORDER`))) {
  await b.ev(`applyLook(${name === 'as it comes' ? '{}' : `JSON.parse(JSON.stringify(THEMES[${JSON.stringify(name)}]))`}); return 1`)
  await b.sleep(900); await b.ev(`flush(); return 1`); await b.sleep(200)
  const r = await b.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1440, height: 900, scale: .2 } })
  writeFileSync(join(out, name.replace(/ /g, '-') + '.png'), Buffer.from(r.data, 'base64'))
  console.log('took', name)
}
await b.close()
