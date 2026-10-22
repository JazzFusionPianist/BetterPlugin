// node guide/build.mjs [en|ko] [--look=3,7,12] — the chapters set on their sheets and printed: pdf/<name>.pdf for each
// language. --look also photographs the named sheets (or all, with --look=all) into the folder given by GUIDE_LOOK,
// for reading them over before the file is sent. A sheet whose words run past its foot is named, and the run fails.
import { open } from '../test/cdp.mjs'
import { writeFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { here, setLang, t, LANGS } from './lib.mjs'
import chapters from './chapters/index.mjs'

const args = process.argv.slice(2)
const only = args.find(a => LANGS.includes(a))
const look = (args.find(a => a.startsWith('--look=')) || '').slice(7)
const lookDir = process.env.GUIDE_LOOK || join(here, 'pdf', 'look')
const VERSION = '0.1.7', DATE = '2026-10'
const NAME = { en: 'Slur Studio User Guide', ko: 'Slur Studio 사용 설명서' }
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const word = readFileSync(join(here, '..', 'design', 'logo', 'slur studio, white.svg'), 'utf8').replace(/ id="sheet"/, '').replace(/ width="\d+" height="\d+"/, '')

/* the five lines and the one note of the app's icon. The note stands a step higher with every chapter. */
function staff (step, x = 228) {
  const y0 = 138, gap = 5.4
  let s = ''
  for (let i = 0; i < 5; i++) s += `<line x1="0" x2="297" y1="${y0 + i * gap}" y2="${y0 + i * gap}" stroke="#ECEAE4" stroke-opacity=".2" stroke-width=".28"/>`
  const cy = y0 + 4 * gap - step * gap / 2
  s += `<g transform="translate(${x} ${cy}) rotate(-21)"><ellipse rx="4.75" ry="3.05" fill="#5C80FF"/><ellipse rx="2.05" ry="2.3" fill="#0E0E0E" transform="rotate(38)"/></g>`
  return `<svg class="staff" viewBox="0 0 297 210">${s}</svg>`
}

function sheets (lang) {
  setLang(lang)
  const chs = chapters.map(f => f())
  // which sheet each thing lands on: cover 1, contents 2, then each chapter's first page and its pages
  let n = 3
  for (const c of chs) { c.n = n++; for (const pg of c.pages) pg.n = n++ }
  const total = n - 1
  const guide = t('slur studio user guide', 'slur studio 사용 설명서')
  const out = []
  out.push(`<section class="page black cover">${staff(4, 196)}<div class="word">${word}</div><div class="what">${t('user guide', '사용 설명서')}</div><div class="ver">${t(`<b>for slur studio ${VERSION}, alpha</b><br>written ${DATE}. the app is still growing: a page is added here whenever a feature is.`, `<b>slur studio ${VERSION} 알파 기준</b><br>${DATE} 작성. 앱에 기능이 더해질 때마다 이 책에도 장이 더해집니다.`)}</div></section>`)
  out.push(`<section class="page toc"><header><b>${guide}</b></header><h2>${t('contents', '차례')}</h2><div class="body">${chs.map((c, i) => `<div class="ch"><a class="c" href="#c${i}"><span><i>${String(i + 1).padStart(2, '0')}</i>${esc(c.title)}</span><span>${c.n}</span></a>${c.pages.map((pg, k) => `<a href="#c${i}p${k}"><span>${esc(pg.title)}</span><span>${pg.n}</span></a>`).join('')}</div>`).join('')}</div><footer><span>${guide}</span><span class="pn">2</span></footer></section>`)
  chs.forEach((c, i) => {
    const num = String(i + 1).padStart(2, '0')
    out.push(`<section class="page black opener" id="c${i}">${staff(i % 9, 60 + (i * 37) % 200)}<div class="num">${num}</div><h1>${esc(c.title)}</h1><div class="intro">${c.intro}</div><div class="in">${c.pages.map((pg, k) => `<a href="#c${i}p${k}"><span>${esc(pg.title)}</span><span>${pg.n}</span></a>`).join('')}</div><div class="foot"><span>${guide}</span><span>${c.n}</span></div></section>`)
    c.pages.forEach((pg, k) => {
      const style = [pg.tw ? `--tw:${pg.tw}mm` : '', pg.cc ? `--cc:${pg.cc}` : ''].filter(Boolean).join(';')
      const art = pg.art ? `<div class="art${pg.mid ? ' mid' : ''}">${pg.art}</div>` : ''
      const txt = pg.txt ? `<div class="txt">${pg.txt}</div>` : ''
      out.push(`<section class="page ${pg.kind}${pg.flip ? ' flip' : ''}" id="c${i}p${k}" data-n="${pg.n}" style="${style}"><header><span>${num}</span><b>${esc(c.title)}</b></header><h2>${esc(pg.title)}</h2><div class="body">${pg.kind === 'wide' ? art + txt : txt + art}</div><footer><span>${guide}</span><span class="pn">${pg.n}</span></footer></section>`)
    })
  })
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${NAME[lang]}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="guide.css"></head><body lang="${lang}">${out.join('\n')}
<script>Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 9000))]).then(() => Promise.all([...document.images].map(i => i.decode ? i.decode().catch(() => 0) : 0))).then(() => { document.documentElement.dataset.ready = '1' })</script></body></html>`
  return { html, total }
}

let bad = 0
for (const lang of LANGS) {
  if (only && lang !== only) continue
  const { html, total } = sheets(lang)
  const file = join(here, `guide.${lang}.html`)
  writeFileSync(file, html)
  const b = await open(file, { width: 1123, height: 794, dsf: 1 })
  await b.sleep(600)
  // every sheet's own words must end above its foot, and nothing may hang out at the sides
  const over = await b.ev(`
    const out = []
    for (const s of document.querySelectorAll('.page[data-n]')) {
      const body = s.querySelector('.body'), bb = body.getBoundingClientRect()
      let low = 0, right = 0
      for (const e of body.querySelectorAll('p, li, td, th, dd, h3, figure, figcaption, svg')) { const r = e.getBoundingClientRect(); if (r.width && r.height) { low = Math.max(low, r.bottom); right = Math.max(right, r.right) } }
      const d = Math.round((low - bb.bottom) / 3.78), w = Math.round((right - bb.right) / 3.78)
      if (d > 0 || w > 0) out.push([+s.dataset.n, s.querySelector('h2').textContent, d, w])
    }
    const miss = [...document.querySelectorAll('.missing, .miss')].map(e => e.textContent)
    return { out, miss, fonts: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family).filter((v, i, a) => a.indexOf(v) === i) }`)
  for (const [n, title, d, w] of over.out) { bad++; console.log(`${lang}  sheet ${n} "${title}" runs over: ${d > 0 ? d + ' mm past the foot ' : ''}${w > 0 ? w + ' mm past the side' : ''}`) }
  for (const m of over.miss) { bad++; console.log(`${lang}  ${m}`) }
  mkdirSync(join(here, 'pdf'), { recursive: true })
  // the file is handed over in pieces: whole, it is more than one message of the browser's line can carry
  const made = await b.send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, generateDocumentOutline: true, generateTaggedPDF: false, transferMode: 'ReturnAsStream' })
  const pieces = []
  for (;;) { const c = await b.send('IO.read', { handle: made.stream, size: 1 << 20 }); pieces.push(Buffer.from(c.data, c.base64Encoded ? 'base64' : 'utf8')); if (c.eof) break }
  await b.send('IO.close', { handle: made.stream })
  const pdf = Buffer.concat(pieces)
  const dest = join(here, 'pdf', NAME[lang] + '.pdf')
  writeFileSync(dest, pdf)
  console.log(`${lang}  ${total} sheets, ${(pdf.length / 1048576).toFixed(1)} MB, fonts: ${over.fonts.join(', ')}`)
  if (look) {
    rmSync(join(lookDir, lang), { recursive: true, force: true }); mkdirSync(join(lookDir, lang), { recursive: true })
    const want = look === 'all' ? Array.from({ length: total }, (_, i) => i + 1) : look.split(',').map(Number)
    for (const n of want) {
      const y = await b.ev(`const s = document.querySelectorAll('.page')[${n - 1}]; return s ? s.getBoundingClientRect().top + scrollY : -1`)
      if (y < 0) continue
      const r = await b.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y, width: 1122.5, height: 793.7, scale: 1.6 } })
      writeFileSync(join(lookDir, lang, String(n).padStart(2, '0') + '.png'), Buffer.from(r.data, 'base64'))
    }
  }
  if (b.errors.length) console.log(b.errors.join('\n'))
  await b.close()
}
process.exit(bad ? 1 : 0)
