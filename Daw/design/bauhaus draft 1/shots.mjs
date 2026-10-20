/* bauhaus draft 1, the pictures: the room in bauhaus with column.js laid in (the room's own files are not changed):
   node "design/bauhaus draft 1/shots.mjs" (from Daw; GUIDE_UI=tree for the working tree) */
import { room } from '../../guide/shots.mjs'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const here = dirname(fileURLToPath(import.meta.url))
const b = await room({ w: 1440, h: 900, dsf: 2 })
await b.sleep(900)
await b.ev(`for (const t of S.tracks) { if (t.theirs === 'jun') t.theirs = 'theo'; if (t.theirs === 'minseo') t.theirs = 'mina' } return 1`)
await b.ev(readFileSync(join(here, 'column.js'), 'utf8').replace(/^const /gm, 'var ') + '\nreturn 1')
await b.ev(`INSP.on = true; applyLook(JSON.parse(JSON.stringify(THEMES.bauhaus))); fitRoom(); setView(true); dirtyAll(); return 1`)
await b.sleep(1000)
const shot = async name => { await b.ev(`flush(); return 1`); await b.sleep(300); const r = await b.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1440, height: 900, scale: 1 } }); writeFileSync(join(here, name + '.png'), Buffer.from(r.data, 'base64')); console.log('took', name) }
/* 1: playing in the cycle, a track chosen */
await b.ev(`S.cycle = { on: true, a: 16, b: 24 }; S.pos = 19.25; leadTrack(4); S.selR = []; S.focus = 'tracks'; uiDirty('top', 'scenes', 'ruler', 'head', 'lanes'); return 1`); await b.sleep(400)
await shot('1 arrangement, a track chosen')
/* 2: a region chosen */
await b.ev(`const t = S.tracks[6]; leadTrack(6); S.focus = 'regions'; S.selR = [t.regs[1].id]; uiDirty('top', 'head', 'lanes'); return 1`); await b.sleep(400)
await shot('2 arrangement, a region chosen')
/* 3: the mixer open */
await b.ev(`S.panel.on = true; S.panel.tab = 'mixer'; setView(true); return 1`); await b.sleep(600)
await shot('3 the mixer open')
console.log('errors', b.errors.slice(0, 4))
await b.close()
