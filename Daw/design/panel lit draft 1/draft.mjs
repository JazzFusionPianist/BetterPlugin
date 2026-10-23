// node "design/panel lit draft 1/draft.mjs" — a DRAFT, drawn over the app's own page in a browser: the transport panel says
// what was just changed and what is on (his ask, 2026-10-23: "바꾼 기능의 이름과, 바꾼 기능의 값 주위로 흰색 rectangle …
// 이름과 값은 색상 반전 … cycle, low latency, click, rubato 같은 경우는 … 켜져있으면 계속"):
//   a value just changed (transpose, the tempo, the grid, the out …): a square box filled in the panel's ink round its name
//     and its value, the two in the panel's ground — inverted; it stays while the value is being changed and goes two seconds
//     after the last change;
//   what is on — the cycle, click, low latency, automation, rubato — boxed the same way for as long as it is on (the cycle's
//     triangle keeps its yellow: the box holds its words; the tempo's and the out's rings stay, the box round their words);
//   bauhaus the other way round: a black box on its paper, the words in the paper's colour.
// Nothing of this is in the app: the boxes are laid over the page here, in this browser only.
import { open, PAGE } from '../../test/cdp.mjs'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
setTimeout(() => { console.log('timed out'); process.exit(2) }, 300000)
/* lays a box over each named place of the panel: round the words and marks inside the place where it is pressed */
const LIT = `
window.litDraft = (names, pad = 2.5) => {
  document.querySelectorAll('.lit-draft').forEach(e => e.remove())
  const NS = 'http://www.w3.org/2000/svg', top = document.createElementNS(NS, 'svg')
  top.setAttribute('class', 'lit-draft'); Object.assign(top.style, { position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 50 })
  document.body.appendChild(top)
  const rgb = c => { const m = String(c).match(/\\d+(\\.\\d+)?/g); return m ? m.slice(0, 3).map(Number) : null }
  const grey = c => { const v = rgb(c); return !!v && Math.max(...v) - Math.min(...v) < 40 }
  let n = 0
  for (const [a, k] of names) {
    const hits = [...document.querySelectorAll('[data-a="' + a + '"]')].filter(e => e.getBoundingClientRect().left < 260)
    const h = hits[k == null ? hits.length - 1 : k]; if (!h) continue
    const q = h.getBoundingClientRect(), inside = []; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
    for (const e of h.ownerSVGElement.querySelectorAll('text, circle, rect, path, line')) {
      if (e.dataset.a || e.closest('[data-a]')) continue
      if (q.width > 60 && q.height > 60 && e.tagName !== 'text') continue      // (a large place — the tempo's dial, the out's ring: its words only)
      const r = e.getBoundingClientRect(); if (r.width < .5 && r.height < .5) continue
      if (r.width > q.width + 2 || r.height > q.height + 2) continue
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2
      if (cx < q.left || cx > q.right || cy < q.top || cy > q.bottom) continue
      inside.push(e); x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom)
    }
    if (!inside.length) continue
    /* the box in the panel's ink, the words in its ground; a coloured mark keeps its colour */
    const ink = INK, ground = SKIN.k.transport === 'poster' ? BH.paper : K2      // (bauhaus: its own black box with paper words, as its track number has)
    const box = document.createElementNS(NS, 'rect')
    for (const [k2, v] of Object.entries({ x: x0 - pad - 1, y: y0 - pad, width: x1 - x0 + 2 * pad + 2, height: y1 - y0 + 2 * pad, fill: ink })) box.setAttribute(k2, v)
    top.appendChild(box)
    for (const e of inside) {
      const c = e.cloneNode(true), m = e.getScreenCTM(), st = getComputedStyle(e)
      c.setAttribute('transform', 'matrix(' + [m.a, m.b, m.c, m.d, m.e, m.f].join(' ') + ')'); c.removeAttribute('id')
      for (const p of ['fill', 'stroke']) { const v = st[p]; if (v && v !== 'none') c.setAttribute(p, grey(v) ? ground : v) }
      if (e.tagName === 'text') { c.setAttribute('font-family', st.fontFamily); c.setAttribute('font-size', st.fontSize); c.setAttribute('font-weight', st.fontWeight) }
      c.removeAttribute('fill-opacity'); c.removeAttribute('stroke-opacity'); c.removeAttribute('opacity')
      top.appendChild(c)
    }
    n++
  }
  return n
}`
async function sheet (file, width, height, setup, lit, clip, bau) {
  const b = await open(PAGE, { width, height, dsf: 2 })
  await b.sleep(700)
  await b.ev(`if (typeof START !== 'undefined') START.on = false
    ${LIT}
    ${bau ? 'applyLook(JSON.parse(JSON.stringify(THEMES.bauhaus))); fitRoom(); setView(true)' : ''}
    const t = S.tracks.find(x => x.name === 'hum'), r = t.regs[0]; r.gain = -3.5; r.tr = 2; r.ft = 15; S.sel = S.tracks.indexOf(t); S.selR = [r.id]; S.focus = 'lanes'
    ${setup}
    tpanelSet(true, false); setView(true); dirtyAll(); flush(); SKINS.frame.panel(curPos()); return 1`)
  await b.sleep(400)
  await b.ev(`dirtyAll(); flush(); SKINS.frame.panel(curPos()); return 1`)
  console.log(file, 'boxes', await b.ev(`return litDraft(${JSON.stringify(lit)})`))
  await b.sleep(200)
  const r = await b.send('Page.captureScreenshot', { format: 'png', clip: { x: clip[0], y: clip[1], width: clip[2], height: clip[3], scale: clip[4] || 2 } })
  writeFileSync(join(here, file), Buffer.from(r.data, 'base64'))
  if (b.errors.length) console.log(JSON.stringify(b.errors))
  await b.close()
}
const ON = [['loop', 1], ['click'], ['lowlat'], ['autokey'], ['flexkey']]
const on = `S.cycle.on = true; S.cycle.a = 8; S.cycle.b = 16; S.click = true; S.lowLat = true; S.auto = true; S.flex = true`
await sheet('1 transpose just changed.png', 1440, 900, ``, [['rtr']], [0, 0, 248, 900, 2])
await sheet('2 the tempo just changed.png', 1440, 900, `S.tempo = 96`, [['tempo']], [0, 0, 248, 900, 2])
await sheet('3 on - cycle, click, low latency, automation, rubato; the grid just changed.png', 1440, 900, on + `; S.grid = '1/8'`, ON.concat([['grid']]), [0, 0, 248, 900, 2])
await sheet('4 the foot close - transpose just changed, automation and rubato on.png', 1440, 900, `S.auto = true; S.flex = true`, [['rtr'], ['autokey'], ['flexkey']], [0, 690, 248, 210, 3])
await sheet('5 bauhaus - on, and the tempo just changed.png', 1440, 900, on, ON.concat([['tempo']]), [0, 0, 212, 900, 2], true)
process.exit(0)
