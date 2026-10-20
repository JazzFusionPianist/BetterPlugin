/* bauhaus mixer draft 2, the pictures: 8, 24 and 48 tracks, with mixer.js laid in (the room's own files are not
   changed): node "design/bauhaus mixer draft 2/shots.mjs" (from Daw; GUIDE_UI=tree for the working tree) */
import { room } from '../../guide/shots.mjs'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const here = dirname(fileURLToPath(import.meta.url))
const b = await room({ w: 1440, h: 900, dsf: 2 })
await b.sleep(900)
await b.ev(readFileSync(join(here, 'mixer.js'), 'utf8').replace(/^const /gm, 'var ') + '\nreturn 1')
await b.ev(`INSP.on = true; applyLook(JSON.parse(JSON.stringify(THEMES.bauhaus))); fitRoom(); S.cycle = { on: true, a: 16, b: 24 }; S.pos = 19.25; return 1`)
/* a session of n tracks, made from the demo's (each kind from the demo track of its family) */
const N24 = ['kick in', 'kick out', 'snare top', 'snare bottom', 'hats', 'toms', 'overheads', 'room', 'bass di', 'bass amp', 'synth bass', 'rhodes', 'piano', 'pad', 'strings', 'guitar 1', 'guitar 2', 'acoustic', 'lead vox', 'vox double', 'harmony', 'backing', 'riser', 'air']
const N48 = N24.concat(['clap', 'shaker', 'tamb', 'perc', '808', 'sub', 'organ', 'arp', 'pluck', 'choir', 'brass', 'piano 2', 'guitar 3', 'slide', 'harmony 2', 'adlib', 'backing 2', 'whisper', 'impact', 'reverse', 'noise', 'tape stop', 'verb', 'delay'])
const make = (names, chosen) => b.ev(`
  const fam = n => /kick|snare|hat|tom|overhead|room|clap|shaker|tamb|perc|808/.test(n) ? 'kick' : /bass|sub/.test(n) ? 'bass' : /rhodes|piano|pad|string|organ|arp|pluck|choir|brass|synth/.test(n) ? 'keys' : /guitar|acoustic|slide/.test(n) ? 'guitar' : /vox|harmony|backing|adlib|whisper/.test(n) ? 'hum' : 'air'
  if (!window.DEMO) window.DEMO = S.tracks.slice()
  const tpl = n => DEMO.find(t => t.name === fam(n)) || DEMO[0]
  S.tracks = ${JSON.stringify(names)}.map((name, k) => { const t0 = tpl(name), t = Object.assign({}, t0, { id: 'dr' + k, name, n: undefined, theirs: null, inserts: [], sends: [], wall: undefined, regs: t0.regs.map(r => Object.assign({}, r, { id: r.id + '-' + k, _p: undefined, _k: undefined })) }); return t })
  const by = n => S.tracks.findIndex(t => t.name === n)
  const by2 = n => S.tracks[by(n)]
  try { if (by2('kick in')) setPrint(by2('kick in'), 'tape', PRINT_START.tape); if (by2('lead vox')) { setPrint(by2('lead vox'), 'space', PRINT_START.space); setPrint(by2('lead vox'), 'delay', PRINT_START.delay); by2('lead vox').inserts = [{ name: 'Soothe2', id: 'dr-a' }, { name: 'FabFilter Pro-Q 3', id: 'dr-b' }] } if (by2('bass di')) by2('bass di').inserts = [{ name: 'Ampeg SVT', id: 'dr-c' }] } catch (e) {}
  const want = ${JSON.stringify(chosen)}.map(by).filter(i => i >= 0)
  leadTrack(want[0]); for (const i of want.slice(1)) chooseTrack(i, 'toggle')
  S.panel.on = true; S.panel.tab = 'mixer'; S.panel.h = 380; VY = 0; setView(true); dirtyAll(); return 1`)
const sound = () => b.ev(`const lv = [.62, .5, .42, .55, .58, .36, .47, .3, .66, .4, .52, .44]; S.tracks.forEach((t, k) => { const f = lv[k % lv.length], el = document.getElementById('bmx-' + t.id), g = BMX.v.get(t.id); if (el && g) { el.setAttribute('y', g[0] + g[1] * (1 - f)); el.setAttribute('height', g[1] * f) } }); for (const [id, f] of [['bmx-ML', .6], ['bmx-MR', .56]]) { const m = document.getElementById(id), g = BMX.v.get('M'); if (m && g) { m.setAttribute('y', g[0] + g[1] * (1 - f)); m.setAttribute('height', g[1] * f) } } return 1`)
const shot = async name => { await b.ev(`flush(); return 1`); await b.sleep(400); await sound(); await b.sleep(100); const r = await b.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1440, height: 900, scale: 1 } }); writeFileSync(join(here, name + '.png'), Buffer.from(r.data, 'base64')); console.log('took', name) }
await make(['kick', 'snare', 'hats', 'bass', 'keys', 'guitar', 'hum', 'air'].map(n => n), ['keys']); await b.sleep(800); await shot('1 eight tracks, keys chosen')
await make(N24, ['lead vox']); await b.sleep(800); await shot('2 twenty-four tracks, lead vox chosen')
await make(N48, ['bass di', 'lead vox']); await b.sleep(800); await shot('3 forty-eight tracks, two chosen')
console.log('errors', b.errors.slice(0, 4))
await b.close()
