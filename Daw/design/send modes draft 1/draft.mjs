// node "design/send modes draft 1/draft.mjs" — a DRAFT, drawn over the app's own page in a browser: where a send takes its
// sound (his ask, 2026-10-24: "샌드 노브를 우클릭했을 때, 프리 패이더, 포스트 팬, 포스트 페이더 … 각각 다른 색깔로. 디폴트는
// 포스트 페이더"), as Logic has them:
//   post fader (the default): after the track's fader, before its pan — its knob's ring white, as the ink;
//   post pan: after the fader and the pan (the track's place left to right goes with it) — blue;
//   pre fader: before the fader (the fader does not move it) — amber;
//   the other button on a send: the buses as now, then the three ways, each with its colour, the one it is lit;
//   bauhaus: red (post fader, as its knobs are now), blue (post pan), yellow (pre fader).
// Nothing of this is in the app: the colours are laid over the page here, in this browser only.
import { open, PAGE } from '../../test/cdp.mjs'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
setTimeout(() => { console.log('timed out'); process.exit(2) }, 300000)
const SETUP = `if (typeof START !== 'undefined') START.on = false
  const bus = name => { const b = mkTrack(name, null, null, null, null, 0, [], NO_PATCH()); b.kind = 'bus'; S.tracks.push(b); return b }
  const vb = bus('verb'), dl = bus('delay'), hp = bus('phones')
  const t = S.tracks.find(x => x.name === 'hum'); t.sends = [{ to: vb.id, db: -8 }, { to: dl.id, db: -14 }, { to: hp.id, db: -3 }]
  window.MODEC = { verb: 'post', delay: 'pan', phones: 'pre' }
  S.sel = S.tracks.indexOf(t); S.selR = []; S.focus = 'tracks'`
/* the rings coloured by the way each send takes its sound (laid over the page as drawn) */
const PAINT = `
  const bau = SKIN.k.transport === 'poster', C = bau ? { post: BH.red, pan: BH.blue, pre: BH.yellow } : { post: INK, pan: '#7896FF', pre: '#FFA848' }
  for (const g of document.querySelectorAll('g')) { const tt = g.querySelector(':scope > title'), nm = tt && tt.textContent.replace(/\\u2063/g, ''); if (!tt || !MODEC[nm]) continue; const ps = g.querySelectorAll(':scope > path'); if (ps[1]) ps[1].setAttribute('stroke', C[MODEC[nm]]) }
  for (const g of document.querySelectorAll('g.bmk')) { const nm = g.querySelector('.bmk-name'); const m = nm && MODEC[nm.textContent]; if (!m) continue; for (const p of g.querySelectorAll('path')) if (p.getAttribute('stroke') === BH.red) p.setAttribute('stroke', C[m]) }
  return 1`
async function sheet (file, setup, clip, menu) {
  const b = await open(PAGE, { width: 1440, height: 900, dsf: 2 })
  await b.sleep(700)
  await b.ev(`${SETUP}; ${setup}; dirtyAll(); flush(); SKINS.frame.panel && SKINS.frame.panel(curPos()); return 1`)
  await b.sleep(400)
  await b.ev(`dirtyAll(); flush(); ${PAINT}`)
  if (menu) {
    await b.ev(`const el = [...document.querySelectorAll('[data-a="${menu}"]')].find(e => e.getBoundingClientRect().width > 0), q = el.getBoundingClientRect(), b0 = board.getBoundingClientRect(), k = b0.width / (W + (SKV.left || 0))
      const x = (q.left + q.width / 2 - b0.left) / k - (SKV.left || 0), y = (q.top + q.height - b0.top) / k
      const t = S.tracks[S.sel], cur = t.sends[0], items = S.tracks.filter(b => b.kind === 'bus').map(b => ({ t: b.name, v: b.id, on: cur.to === b.id }))
      items.push({ t: 'new bus', v: 'new', sep: true }, { t: 'no send', v: 0 }, { t: 'post fader', v: 'post', on: true, sep: true }, { t: 'post pan', v: 'pan' }, { t: 'pre fader', v: 'pre' })
      openMenu(x, y, items, () => {}, { w: 150 }); flush(); return 1`)
    await b.sleep(200)
    await b.ev(`const bau = SKIN.k.transport === 'poster', C = bau ? { 'post fader': BH.red, 'post pan': BH.blue, 'pre fader': BH.yellow } : { 'post fader': INK, 'post pan': '#7896FF', 'pre fader': '#FFA848' }
      const g = document.getElementById('g-menu') || document.querySelector('svg')
      for (const t of g.querySelectorAll('text')) { const c = C[t.textContent]; if (!c) continue; const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect'), x = +t.getAttribute('x'), y = +t.getAttribute('y')
        const m = t.parentNode.querySelector('rect[rx]'), right = m ? +m.getAttribute('x') + +m.getAttribute('width') - 22 : x + 110
        r.setAttribute('x', right); r.setAttribute('y', y - 8); r.setAttribute('width', 9); r.setAttribute('height', 9); r.setAttribute('fill', c); r.setAttribute('stroke', bau ? BH.black : K0); r.setAttribute('stroke-width', 1); t.parentNode.appendChild(r) }
      return 1`)
  }
  await b.sleep(150)
  await b.ev(`(() => { ${PAINT} })()`)
  const r = await b.send('Page.captureScreenshot', { format: 'png', clip: { x: clip[0], y: clip[1], width: clip[2], height: clip[3], scale: 2 } })
  writeFileSync(join(here, file), Buffer.from(r.data, 'base64'))
  console.log(file, JSON.stringify(b.errors))
  await b.close()
}
const mixer = `tpanelSet(false, false); S.panel.on = true; S.panel.tab = 'mixer'; S.panel.h = 420; setView(true)`
const panel = `tpanelSet(true, false)`
await sheet('1 the mixer - post fader (white), post pan (blue), pre fader (amber).png', mixer, [0, 470, 1440, 430])
await sheet('2 the transport panel\'s strip - the same three.png', panel, [0, 520, 248, 240])
await sheet('3 the other button on a send - the buses, then the three ways.png', panel, [0, 520, 420, 380], 'mp-send')
await sheet('4 bauhaus - red (post fader), blue (post pan), yellow (pre fader).png', panel + `; applyLook(JSON.parse(JSON.stringify(THEMES.bauhaus))); fitRoom(); setView(true)`, [0, 560, 212, 220])
process.exit(0)
