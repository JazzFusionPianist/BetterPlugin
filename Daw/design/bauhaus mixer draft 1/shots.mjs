/* bauhaus mixer draft 1, the pictures: the room in bauhaus with mixer.js laid in (the room's own files are not changed):
   node "design/bauhaus mixer draft 1/shots.mjs" (from Daw; GUIDE_UI=tree for the working tree) */
import { room } from '../../guide/shots.mjs'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const here = dirname(fileURLToPath(import.meta.url))
const b = await room({ w: 1440, h: 900, dsf: 2 })
await b.sleep(900)
await b.ev(`for (const t of S.tracks) { if (t.theirs === 'jun') t.theirs = 'theo'; if (t.theirs === 'minseo') t.theirs = 'mina' } return 1`)
await b.ev(readFileSync(join(here, 'mixer.js'), 'utf8').replace(/^const /gm, 'var ') + '\nreturn 1')
/* a few things on the patches, so that the slots show */
await b.ev(`const by = n => S.tracks.find(t => t.name === n); try { setPrint(by('kick'), 'tape', PRINT_START.tape); setPrint(by('keys'), 'space', PRINT_START.space); setPrint(by('hum'), 'space', PRINT_START.space); setPrint(by('guitar'), 'delay', PRINT_START.delay); setPrint(by('guitar'), 'tape', PRINT_START.tape) } catch (e) {} by('bass').inserts = (by('bass').inserts || []).concat([{ name: 'FabFilter Pro-Q 3', id: 'draft-1' }]); by('snare').inserts = (by('snare').inserts || []).concat([{ name: 'Soothe2', id: 'draft-2' }]); return 1`)
await b.ev(`INSP.on = true; applyLook(JSON.parse(JSON.stringify(THEMES.bauhaus))); fitRoom(); S.cycle = { on: true, a: 16, b: 24 }; S.pos = 19.25; leadTrack(4); S.panel.on = true; S.panel.tab = 'mixer'; S.panel.h = 380; setView(true); dirtyAll(); return 1`)
await b.sleep(1200)
const shot = async name => { await b.ev(`flush(); return 1`); await b.sleep(300); const r = await b.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1440, height: 900, scale: 1 } }); writeFileSync(join(here, name + '.png'), Buffer.from(r.data, 'base64')); console.log('took', name) }
await shot('1 the mixer, keys chosen')
/* some sound: the bars as high as each track sounds (set by hand: no app plays here) */
await b.ev(`const lv = [.62, .5, .42, .55, .58, .36, .47, .3]; S.tracks.forEach((t, k) => { const f = lv[k % lv.length]; const el = document.getElementById('bmx-' + t.id), g = BMX.v.get(t.id); if (el && g) { el.setAttribute('y', g[0] + g[1] * (1 - f)); el.setAttribute('height', g[1] * f) } }); const m = document.getElementById('bmx-M'), g = BMX.v.get('M'); if (m && g) { m.setAttribute('y', g[0] + g[1] * .4); m.setAttribute('height', g[1] * .6) } SKINS.frame.poster = () => {}; return 1`)
await shot('2 the mixer, playing')
console.log('errors', b.errors.slice(0, 4))
await b.close()
