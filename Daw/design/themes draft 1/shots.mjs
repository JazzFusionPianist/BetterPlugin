/* draws the themes of draft 1 over the room's own page (the song it has open), and takes their pictures:
   node "design/themes draft 1/shots.mjs" [theme …]   (from Daw; all of them when none is named) */
import { room } from '../../guide/shots.mjs'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const here = dirname(fileURLToPath(import.meta.url))
const FILES = ['base.js', 'console.js', 'cassette.js', 'score.js', 'bauhaus.js', 'deco.js', 'phosphor.js', 'sheets.js']
const NAMES = { console: '1 console, the arrangement', consoleMixer: '1 console, the mixer', cassette: '2 cassette', score: '3 score', bauhaus: '4 bauhaus', deco: '5 deco', phosphor: '6 phosphor', picker: '7 choosing a theme', keys: '8 key commands', keysLogic: '8 key commands, as logic pro' }
const want = process.argv.slice(2)
const code = FILES.map(f => { try { return readFileSync(join(here, f), 'utf8') } catch (e) { return '' } }).join('\n;\n')
const b = await room({ w: 1440, h: 900, dsf: 2 })
await b.sleep(800)
await b.ev(`const s = document.createElement('script'); s.textContent = ${JSON.stringify(code)}; document.head.appendChild(s); return 1`)
await b.ev(`await tdFonts(); return 1`)
for (const [k, name] of Object.entries(NAMES)) {
  if (want.length && !want.includes(k)) continue
  const ok = await b.ev(`if (!THEMES[${JSON.stringify(k)}]) return 0; tdShow(THEMES[${JSON.stringify(k)}](), ${JSON.stringify(['picker', 'keys', 'keysLogic'].includes(k) ? 'transparent' : '#000')}); return 1`)
  if (!ok) continue
  await b.sleep(300)
  const r = await b.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1440, height: 900, scale: 1 } })
  writeFileSync(join(here, name + '.png'), Buffer.from(r.data, 'base64'))
  console.log('took', name)
}
if (b.errors.length) console.log('errors', b.errors.slice(0, 5))
await b.close()
