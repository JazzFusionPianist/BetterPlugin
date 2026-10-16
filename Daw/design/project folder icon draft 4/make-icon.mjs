// node "design/project folder icon draft 4/make-icon.mjs" — writes Resources/project-folder.png: his pick of draft 4 ("제일 왼쪽
// 밑에게 제일 나은데": the plain black folder, the white whole note large and low at the right, run off the front's edge),
// 1024 by 1024 on nothing, for the Finder to wear on a project's own folder (Mac.mm, slurProjectIcon). Drawn from
// sheet.html's own drawing, so the icon is the draft exactly.
import { open } from '../../test/cdp.mjs'
import { writeFileSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const sheet = readFileSync(join(here, 'sheet.html'), 'utf8')
const pick = s => { const i = sheet.indexOf(s); return sheet.slice(i, sheet.indexOf('\n', i)) }
const page = join(here, '_icon.html')
writeFileSync(page, `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}</style><div id="i"></div><script>
${pick('const NOTE =')}
${pick('const note =')}
${pick('const BACK =')}
${sheet.slice(sheet.indexOf('const folder ='), sheet.indexOf('const COLOURS'))}
document.getElementById('i').innerHTML = '<svg viewBox="0 0 1024 1024" width="1024" height="1024">' + folder('p', note(760, 700, 1.25, '#FFFFFF')) + '</svg>'
document.documentElement.dataset.ready = '1'
</script>`)
const b = await open(page, { width: 1024, height: 1024, dsf: 1 })
await b.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } })
await b.sleep(300)
const r = await b.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1024, height: 1024, scale: 1 } })
writeFileSync(join(here, '../../Resources/project-folder.png'), Buffer.from(r.data, 'base64'))
await b.close()
const { rmSync } = await import('node:fs'); rmSync(page)
console.log('wrote Resources/project-folder.png')
