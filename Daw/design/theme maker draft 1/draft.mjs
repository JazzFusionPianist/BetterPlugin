// node "design/theme maker draft 1/draft.mjs" — a DRAFT of the theme maker (his ask, 2026-10-24: a secondary app where
// anyone makes a theme by drag and drop, with "엄청나게 많은 자유"; his decision: 완전 자유배치). Nothing of this is in
// the app: the room is photographed from its own page in a browser, as the app shows it (the transport panel up), and
// the editor is drawn around the photograph here.
//   1 the editor: the parts at the left, the room live in the middle (a box chosen, its pins, a guide), what it is at the right
//   2 heads: the template opened — the real heads at three heights, in their states; a part chosen, its pins and images
//   3 free: a theme that could not be made before — the heads at the right, the bars under the lanes, the transport a
//     cluster floating over the lanes, the mixer's strips laid over their foot
//   default.sst: the room as it comes, written in the new form (areas' parts, eight numbers a box, layouts by height and state)
import { open, PAGE } from '../../test/cdp.mjs'
import { writeFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
setTimeout(() => { console.log('timed out'); process.exit(2) }, 300000)
const FONTS = pathToFileURL(join(here, '../../ui/fonts')).href
const K0 = '#0E0E0E', K1 = '#151514', K2 = '#1B1B1A', INK = '#ECEAE4', REC = '#DE4F3C', SOLO = '#D8B24A', ACC = '#6E9BFF'

/* ── the room, photographed at 16″ (1728×1117) ── */
const WW = 1728, WH = 1117, COL = 248, HW = 292, MK = 26, RU = 26, FT = 22
const STATES = `{ const t = S.tracks; chooseTrack(1); if (t[2]) t[2].arm = true; if (t[3]) t[3].mute = true; if (t[4]) t[4].solo = true; if (t[5]) t[5].name = 'a name so long it must be cut short' }`
const SET = panel => `if (typeof START !== 'undefined') START.on = false
  S.rh = 36; setZoom(26, 0); VX = 0; VY = 0; ${STATES}
  tpanelSet(${panel}, false); S.panel.on = false; setView(true); dirtyAll(); flush(); return 1`
const shot = async (b, clip, scale = 2) => { const r = await b.send('Page.captureScreenshot', { format: 'png', clip: { x: clip[0], y: clip[1], width: clip[2], height: clip[3], scale } }); return 'data:image/png;base64,' + r.data }
const photos = {}
{
  const b = await open(PAGE, { width: WW, height: WH, dsf: 2 })
  await b.sleep(700)
  await b.ev(SET(true))
  await b.sleep(400)
  const m = await b.ev(`return { W, H, X0, X1, TY, BY, left: SKV.left, rows: S.tracks.length + 1 }`)
  if (m.left !== COL || m.X0 !== HW || m.TY !== MK + RU || m.BY !== WH - FT) throw new Error('the room is not cut as this draft expects: ' + JSON.stringify(m))
  photos.room = await shot(b, [0, 0, WW, WH])
  /* the heads at three heights (the template, in its states) */
  for (const rh of [20, 36, 72]) { await b.ev(`S.rh = ${rh}; VY = 0; dirtyAll(); flush(); return 1`); await b.sleep(200); photos['heads' + rh] = await shot(b, [COL, MK + RU, HW, Math.min(WH - MK - RU - FT, rh * m.rows + 2)]) }
  await b.ev(`S.rh = 36; dirtyAll(); flush(); return 1`)
  /* without the transport panel: the lanes as wide as the window less the heads — the pieces of sheet 3 */
  await b.ev(`tpanelSet(false, false); setView(true); dirtyAll(); flush(); return 1`)
  await b.sleep(300)
  const LW = WW - HW, LH = WH - MK - RU - FT
  photos.heads = await shot(b, [0, MK + RU, HW, LH])
  photos.marks = await shot(b, [HW, 0, LW, MK])
  photos.ruler = await shot(b, [HW, MK, LW, RU])
  photos.lanes = await shot(b, [HW, MK + RU, LW, LH])
  photos.foot = await shot(b, [0, WH - FT, WW, FT])
  await b.ev(`S.panel.on = true; S.panel.tab = 'mixer'; S.panel.h = 300; setView(true); dirtyAll(); flush(); return 1`)
  await b.sleep(400)
  photos.mixer = await shot(b, [HW, WH - FT - 300, LW, 300])
  console.log('photographed', JSON.stringify(b.errors))
  await b.close()
}

/* ── the editor's kit: html over the room's own darks, one face ── */
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
const CSS = `
@font-face { font-family: 'Instrument Sans'; font-weight: 400 700; font-style: normal; src: url(${FONTS}/instrument-sans-normal-400-700-latin.woff2) }
@font-face { font-family: 'Instrument Sans'; font-weight: 400 700; font-style: italic; src: url(${FONTS}/instrument-sans-italic-400-700-latin.woff2) }
* { box-sizing: border-box; margin: 0; padding: 0 }
html, body { width: 1920px; height: 1200px; background: ${K1}; color: ${INK}; font: 10.5px/1.3 'Instrument Sans', system-ui, sans-serif; overflow: hidden; -webkit-font-smoothing: antialiased }
.top { position: absolute; left: 0; top: 0; width: 1920px; height: 44px; background: ${K2}; border-bottom: 1px solid rgba(236,234,228,.1) }
.left { position: absolute; left: 0; top: 44px; width: 236px; bottom: 0; background: ${K1}; border-right: 1px solid rgba(236,234,228,.12) }
.right { position: absolute; right: 0; top: 44px; width: 300px; bottom: 0; background: ${K1}; border-left: 1px solid rgba(236,234,228,.12) }
.mid { position: absolute; left: 236px; right: 300px; top: 44px; bottom: 0; background: ${K0} }
.layers { position: absolute; left: 0; right: 0; bottom: 0; height: 150px; background: ${K1}; border-top: 1px solid rgba(236,234,228,.12) }
.canvas { position: absolute; left: 0; right: 0; top: 0; bottom: 150px }
.h { font-size: 9.5px; opacity: .4; letter-spacing: .02em; padding: 14px 14px 6px; white-space: nowrap }
.row { display: flex; align-items: center; height: 22px; padding: 0 14px; font-size: 10.5px; white-space: nowrap }
.row .g { width: 14px; height: 14px; margin-right: 10px; flex: none }
.row .k { margin-left: auto; opacity: .36; font-size: 9px }
.row.on { background: rgba(236,234,228,.08) }
.field { display: flex; align-items: center; min-height: 24px; padding: 0 14px; font-size: 10.5px; white-space: nowrap }
.field .l { width: 92px; opacity: .5; flex: none }
.field .v { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; row-gap: 4px; padding: 2px 0 }
.box { height: 20px; min-width: 44px; padding: 0 7px; display: inline-flex; align-items: center; border: 1px solid rgba(236,234,228,.2); border-radius: 2px; background: ${K0}; font-variant-numeric: tabular-nums; white-space: nowrap }
.chip { height: 18px; padding: 0 8px; display: inline-flex; align-items: center; border: 1px solid rgba(236,234,228,.24); border-radius: 2px; font-size: 9.5px; white-space: nowrap }
.chip.on { background: ${INK}; color: ${K1}; border-color: ${INK}; font-weight: 500 }
.note { opacity: .4; font-size: 9.5px; line-height: 1.4; white-space: normal; padding: 2px 14px 6px 106px }
.sw { width: 14px; height: 14px; border-radius: 2px; border: 1px solid rgba(236,234,228,.2); flex: none }
.search { margin: 12px 14px 2px; height: 24px; border: 1px solid rgba(236,234,228,.2); border-radius: 2px; background: ${K0}; display: flex; align-items: center; padding: 0 8px; opacity: .6 }
.key { height: 22px; padding: 0 10px; display: inline-flex; align-items: center; border: 1px solid rgba(236,234,228,.24); border-radius: 2px; font-size: 9.5px; margin-left: 6px; white-space: nowrap }
.key.armed { background: ${INK}; color: ${K1}; border-color: ${INK}; font-weight: 500 }
svg { position: absolute; left: 0; top: 0; overflow: visible }
`
const html = body => `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${body}</body></html>`
/* the room's own glyphs (ui.js pBar) */
const GL = { tostart: 'M-5 -4.5H-3.6V4.5H-5ZM4.6 -4.5L-2.6 0L4.6 4.5Z', play: 'M-3.4 -4.8L5 0L-3.4 4.8Z', stop: 'M-4 -4H4V4H-4Z', loop: 'M-5.5 .5V-1a3 3 0 0 1 3 -3H3.4M1.4 -6.2L3.8 -4L1.4 -1.8M5.5 -.5V1a3 3 0 0 1 -3 3H-3.4M-1.4 6.2L-3.8 4L-1.4 1.8', click: 'M-4 5.2L-1.7 -5.2H1.7L4 5.2ZM0 2.2L3.8 -3.2' }
const glyph = (k, x, y, c = INK, a = .8, s = 1) => k === 'rec' ? `<circle cx="${x}" cy="${y}" r="${4.2 * s}" fill="${c}" fill-opacity="${a}"/>` : `<g transform="translate(${x} ${y}) scale(${s})"><path d="${GL[k]}" ${k === 'loop' || k === 'click' ? `fill="none" stroke="${c}" stroke-opacity="${a}" stroke-width="1.2" stroke-linecap="round"` : `fill="${c}" fill-opacity="${a}"`}/></g>`
/* the top bar: the theme's name, what it is based on, the sizes it is seen at, the demo song, the keys */
const topBar = (name, note) => `<div class="top">
  <div style="position:absolute;left:16px;top:13px;font-size:12px;font-weight:500;white-space:nowrap">${esc(name)}<span style="font-size:10px;font-weight:400;opacity:.4;margin-left:14px">${esc(note)}</span></div>
  <div style="position:absolute;left:720px;top:13px;display:flex;gap:4px"><span class="chip">13″ 1440×900</span><span class="chip on">16″ 1728×1117</span><span class="chip">27″ 2560×1440</span><span class="chip">…</span></div>
  <svg width="1920" height="44">${glyph('play', 1130, 22, INK, .85)}${glyph('stop', 1156, 22, INK, .85)}<text x="1176" y="25.5" font-size="9.5" fill="${INK}" fill-opacity=".4">the demo song plays in the room</text></svg>
  <div style="position:absolute;right:14px;top:11px"><span class="key">undo</span><span class="key">redo</span><span class="key">check</span><span class="key">open .sst…</span><span class="key">share as .sst…</span><span class="key armed">keep</span></div>
</div>`
/* a small drawing for a part (the parts box) */
const ICON = {
  box: `<rect x="1.5" y="1.5" width="11" height="11" fill="none" stroke="${INK}" stroke-opacity=".6"/>`,
  lanes: `<rect x="1.5" y="1.5" width="11" height="11" fill="none" stroke="${INK}" stroke-opacity=".6"/><path d="M1.5 5.5H12.5M1.5 9.5H12.5" stroke="${INK}" stroke-opacity=".35"/>`,
  button: `<rect x="1.5" y="3.5" width="11" height="7" rx="1" fill="none" stroke="${INK}" stroke-opacity=".6"/>`,
  readout: `<rect x="1.5" y="3.5" width="11" height="7" fill="${K0}" stroke="${INK}" stroke-opacity=".4"/><text x="7" y="9.6" font-size="6" fill="${INK}" text-anchor="middle" fill-opacity=".8">12.1</text>`,
  knob: `<circle cx="7" cy="7" r="5.5" fill="none" stroke="${INK}" stroke-opacity=".6"/><path d="M7 7L7 2.5" stroke="${INK}"/>`,
  fader: `<path d="M2 7H12" stroke="${INK}" stroke-opacity=".4"/><rect x="5" y="4" width="4" height="6" fill="${INK}" fill-opacity=".8"/>`,
  meter: `<rect x="2" y="2" width="3" height="10" fill="${INK}" fill-opacity=".2"/><rect x="2" y="6" width="3" height="6" fill="${INK}" fill-opacity=".8"/><rect x="9" y="2" width="3" height="10" fill="${INK}" fill-opacity=".2"/><rect x="9" y="4" width="3" height="8" fill="${INK}" fill-opacity=".8"/>`,
  lamp: `<circle cx="7" cy="7" r="3.5" fill="${REC}"/>`,
  text: `<text x="7" y="11" font-size="11" fill="${INK}" text-anchor="middle" font-weight="500">A</text>`,
  shape: `<path d="M7 1.5L12.5 12.5H1.5Z" fill="none" stroke="${INK}" stroke-opacity=".6"/>`,
  line: `<path d="M1.5 12.5L12.5 1.5" stroke="${INK}" stroke-opacity=".7"/>`,
  image: `<rect x="1.5" y="1.5" width="11" height="11" fill="none" stroke="${INK}" stroke-opacity=".6"/><path d="M2 11L6 6L9 9L12 7" fill="none" stroke="${INK}" stroke-opacity=".7"/>`,
  group: `<rect x="1.5" y="1.5" width="11" height="11" fill="none" stroke="${INK}" stroke-opacity=".6" stroke-dasharray="2 2"/>`,
  mark: `<rect x="3" y="2" width="3" height="10" fill="${SOLO}"/>`, num: `<text x="7" y="11" font-size="9" fill="${INK}" text-anchor="middle">01</text>`, cell: `<rect x="2.5" y="2.5" width="9" height="9" fill="none" stroke="${INK}" stroke-opacity=".6"/><text x="7" y="10.2" font-size="7" fill="${INK}" text-anchor="middle">m</text>`,
}
const row = (icon, t, k = '', on = false) => `<div class="row${on ? ' on' : ''}"><svg class="g" viewBox="0 0 14 14" style="position:static">${ICON[icon] || ICON.box}</svg><span>${esc(t)}</span>${k ? `<span class="k">${esc(k)}</span>` : ''}</div>`
/* the parts box: every box the room has, every control there is, the marks */
const partsBox = (chosen = 'heads') => `<div class="left">
  <div class="search">find a part or a function…</div>
  <div class="h">boxes</div>
  ${[['box', 'transport', ''], ['box', 'heads', ''], ['lanes', 'lanes', 'always'], ['box', 'bars', ''], ['box', 'markers', ''], ['box', 'mixer', ''], ['box', 'patch', ''], ['box', 'notes', ''], ['box', 'automation heads', ''], ['box', 'inspector', 'off'], ['box', 'command line', '']].map(([i, t, k]) => row(i, t, k, t === chosen)).join('')}
  <div class="h">controls: any function, as a</div>
  ${[['button', 'button', '212 functions'], ['readout', 'readout', 'position, tempo…'], ['knob', 'knob'], ['fader', 'fader'], ['meter', 'meter', 'bar, needle, led'], ['lamp', 'lamp', 'playing, recording…']].map(([i, t, k]) => row(i, t, k)).join('')}
  <div class="h">marks</div>
  ${[['text', 'text'], ['shape', 'shape'], ['line', 'line'], ['image', 'image', 'png, svg'], ['group', 'group']].map(([i, t, k]) => row(i, t, k)).join('')}
</div>`
/* what the chosen thing is: where it stands, what follows the window, what it is over, when it shows, how it looks */
const field = (l, v) => `<div class="field"><span class="l">${esc(l)}</span><span class="v">${v}</span></div>`
const note = t => `<div class="note">${esc(t)}</div>`
const box = (v, u = '') => `<span class="box">${esc(v)}${u ? `<span style="opacity:.4;margin-left:3px">${u}</span>` : ''}</span>`
const pin = (name, v) => { const on = v === 'follows', half = v === '½'; return `<span class="chip${on ? ' on' : ''}" style="min-width:64px;justify-content:space-between">${esc(name)}<span style="margin-left:6px;opacity:${on ? 1 : .55}">${half ? '½' : on ? '→' : ','}</span></span>` }
const chips = (...a) => a.map(([t, on]) => `<span class="chip${on ? ' on' : ''}">${esc(t)}</span>`).join('')
const propsBox = (title, sections) => `<div class="right">
  <div style="padding:16px 14px 4px;font-size:12px;font-weight:500">${esc(title)}</div>
  ${sections.map(([h, rows]) => `<div class="h">${esc(h)}</div>${rows.join('')}`).join('')}
</div>`
const SW = c => `<span class="sw" style="background:${c}"></span>`
/* the layers: what is over what, each with its eye and its lock */
const layers = (list, title = 'layers: what is over what') => `<div class="layers">
  <div class="h" style="display:flex">${esc(title)}<span style="margin-left:auto">warnings: none</span></div>
  <div style="columns:3;column-gap:0">${list.map(([t, on, hid, lock]) => `<div class="row${on ? ' on' : ''}" style="break-inside:avoid"><svg class="g" viewBox="0 0 14 14" style="position:static"><circle cx="7" cy="7" r="${hid ? 2 : 3.5}" fill="${INK}" fill-opacity="${hid ? .2 : .7}"/></svg><span style="opacity:${hid ? .4 : 1}">${esc(t)}</span><span class="k">${lock ? 'locked' : ''}</span></div>`).join('')}</div>
</div>`
const CW = 1920 - 236 - 300, CH = 1200 - 44 - 150
const hnd = (x, y) => `<rect x="${x - 3}" y="${y - 3}" width="6" height="6" fill="${K0}" stroke="${ACC}" stroke-width="1.2"/>`
const frame = (x, y, w, h) => `<rect x="${x + .5}" y="${y + .5}" width="${w - 1}" height="${h - 1}" fill="${ACC}" fill-opacity=".06" stroke="${ACC}"/>` + [[x, y], [x + w / 2, y], [x + w, y], [x, y + h / 2], [x + w, y + h / 2], [x, y + h], [x + w / 2, y + h], [x + w, y + h]].map(([a, b]) => hnd(a, b)).join('')
/* a pin on an edge: a dot (the edge stays) or an arrow (it follows the window), just inside the frame */
const pinG = (x, y, on, dir) => on ? `<g transform="rotate(${dir} ${x} ${y})"><path d="M${x - 5} ${y}H${x + 5}M${x + 2} ${y - 3}L${x + 5} ${y}L${x + 2} ${y + 3}" stroke="${ACC}" stroke-width="1.2" fill="none" stroke-linecap="round"/></g>` : `<circle cx="${x}" cy="${y}" r="2.4" fill="${ACC}"/>`
const pins = (x, y, w, h, [l, t, r, b]) => pinG(x + 12, y + h / 2 + 16, l, 180) + pinG(x + w / 2 + 16, y + 12, t, -90) + pinG(x + w - 12, y + h / 2 + 16, r, 0) + pinG(x + w / 2 + 16, y + h - 12, b, 90)
const dist = (x0, y0, x1, y1, label) => { const vert = x0 === x1; return `<path d="M${x0} ${y0}L${x1} ${y1}" stroke="${ACC}"/>` + (vert ? `<path d="M${x0 - 3} ${y0}H${x0 + 3}M${x0 - 3} ${y1}H${x0 + 3}" stroke="${ACC}"/><text x="${x0 + 6}" y="${(y0 + y1) / 2 + 3.5}" font-size="9.5" fill="${ACC}">${esc(label)}</text>` : `<path d="M${x0} ${y0 - 3}V${y0 + 3}M${x1} ${y0 - 3}V${y0 + 3}" stroke="${ACC}"/><text x="${(x0 + x1) / 2}" y="${y0 - 5}" font-size="9.5" fill="${ACC}" text-anchor="middle">${esc(label)}</text>`) }

/* ── 1 the editor ── */
{
  /* the room stands in the middle at 16″, scaled to fit the canvas */
  const k = Math.min((CW - 60) / WW, (CH - 60) / WH), RW = WW * k, RH = WH * k, rx = Math.round((CW - RW) / 2), ry = Math.round((CH - RH) / 2) + 4
  const room = `<img src="${photos.room}" style="position:absolute;left:${rx}px;top:${ry}px;width:${RW}px;height:${RH}px;box-shadow:0 0 0 1px rgba(236,234,228,.14)">`
  /* the heads box chosen: its frame, eight handles, a pin on each edge, the guide along its right edge, the distances */
  const bx = rx + COL * k, by = ry + (MK + RU) * k, bw = HW * k, bh = (WH - MK - RU - FT) * k
  const over = `<svg width="${CW}" height="${CH}">
    ${frame(bx, by, bw, bh)}${pins(bx, by, bw, bh, [false, false, false, true])}
    <path d="M${bx + bw + .5} ${ry}V${ry + RH}" stroke="${ACC}" stroke-opacity=".6" stroke-dasharray="3 3"/>
    ${dist(bx + bw / 2 - 40, ry, bx + bw / 2 - 40, by, '52')}
    ${dist(bx, by + bh - 40, bx + bw, by + bh - 40, '292')}
    <text x="${rx}" y="${ry - 8}" font-size="9.5" fill="${ACC}">heads   248, 52   292 × 1043</text>
    <text x="${rx + RW}" y="${ry - 8}" font-size="9.5" fill="${INK}" fill-opacity=".4" text-anchor="end">16″, 1728 × 1117</text>
  </svg>`
  const props = propsBox('heads: a box', [
    ['stands at', [field('left, top', box(248, 'px') + box(52, 'px')), field('width, height', box(292, 'px') + box(1043, 'px'))]],
    ['when the window grows', [field('the edges', pin('left', 'stays') + pin('top', 'stays')), field('', pin('right', 'stays') + pin('bottom', 'follows')), note('a wider window: the lanes take it; a taller one: the heads go on down. ½ makes an edge go half as far; a number, a share of its own.')]],
    ['gives way to', [field('at its left', box('inspector')), field('at its foot', box('the panel'))]],
    ['shows', [field('when', chips(['always', true], ['wide window'], ['never']))]],
    ['looks', [field('fill', SW(K1) + box('ground')), field('line at the right', SW(INK) + box(12, '%')), field('corners, shadow', box(0, 'px') + box('none')), field('opacity', box(100, '%'))]],
    ['the heads', [field('rows', `<span style="opacity:.6">follow the lanes</span> <svg width="14" height="14" style="position:static"><path d="M3 7h8M5 4.5h4a2.5 2.5 0 0 1 0 5h-4a2.5 2.5 0 0 1 0-5z" fill="none" stroke="${INK}" stroke-opacity=".5"/></svg>`), field('layouts', chips(['thin 9–17'], ['one line 17–36', true], ['two lines 36+'])), field('', `<span class="chip" style="border-style:dashed">+ a layout</span>`), field('rename', box('press twice')), field('the template', `<span class="key" style="margin:0">edit the head…</span>`)]],
  ])
  const lay = layers([['notes', false, true], ['mixer', false, true], ['patch', false, true], ['inspector', false, true], ['transport', false, false, true], ['command line', false, false], ['markers', false, false], ['bars', false, false], ['heads', true, false], ['lanes', false, false, true]])
  const body = topBar('untitled theme', 'from the room as it comes') + partsBox('heads') + `<div class="mid"><div class="canvas">${room}${over}</div>${lay}</div>` + props
  await sheet('1 the editor, the room live in the middle, the heads box chosen, its pins.png', body)
}

/* ── 2 heads: the template ── */
{
  const k = 1.3, gaps = [44, 126], rows = 9
  const cols = [['thin, 20', photos.heads20, 20], ['one line, 36', photos.heads36, 36], ['two lines, 72', photos.heads72, 72]]
  let x = 48, room = '', over = `<svg width="${CW}" height="${CH}">`
  const y = 64
  for (const [t, img, rh] of cols) {
    const w = HW * k, h = (rh * rows + 2) * k
    room += `<img src="${img}" style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;box-shadow:0 0 0 1px rgba(236,234,228,.14)">`
    over += `<text x="${x}" y="${y - 14}" font-size="10.5" fill="${INK}" fill-opacity=".86">${esc(t)}</text>`
    /* the states, named down the side of the middle one */
    if (rh === 36) {
      const names = ['plain', 'chosen', 'armed', 'muted', 'soloed', 'a long name', 'plain', 'plain', 'the out']
      names.forEach((nm, i) => { over += `<text x="${x + w + 10}" y="${y + (i + .5) * rh * k + 4}" font-size="9.5" fill="${INK}" fill-opacity=".4">${esc(nm)}</text>` })
      /* the level chosen in the chosen row (the second): its frame, its pins, its distances */
      const lx = x + 138 * k, ly = y + (rh + rh / 2 - 8) * k, lw = 40 * k, lh = 16 * k
      over += frame(lx, ly, lw, lh) + pinG(lx + lw / 2, ly - 10, false, -90)
      over += dist(x + 42 * k, ly + lh + 14, lx, ly + lh + 14, '96 from the name')
      over += `<text x="${x + w}" y="${y - 14}" font-size="9.5" fill="${ACC}" text-anchor="end">level   138, middle   40 × 16</text>`
    }
    x += w + gaps.shift()
  }
  over += `<text x="48" y="${CH - 22}" font-size="9.5" fill="${INK}" fill-opacity=".4">pull a column's foot to change its height and see the rows between; a layout's range runs from where one ends to where the next begins</text></svg>`
  const props = propsBox('level: a part of the head', [
    ['in the layout', [field('layouts', chips(['thin 9–17'], ['one line 17–36', true], ['two lines 36+'])), field('this one is for', box(17, 'px') + `<span style="opacity:.4">to</span>` + box(36, 'px'))]],
    ['stands at', [field('left, top', box(138, 'px') + box('middle')), field('width, height', box(40, 'px') + box(16, 'px'))]],
    ['when the row grows', [field('the edges', pin('left', 'stays') + pin('top', '½')), field('', pin('right', 'stays') + pin('bottom', '½'))]],
    ['what it shows', [field('value', box('the track’s level')), field('reads', box('−6.0 dB') + `<span style="opacity:.4">after it</span>`), field('as a', chips(['bar', true], ['knob'], ['fader'], ['image stack']))]],
    ['in each state', [field('states', chips(['at rest', true], ['chosen'], ['muted'], ['automation on'])), field('a line drawn', box('none')), field('muted', `<span style="opacity:.6">ink at 42%</span>`)]],
    ['images', [field('at rest', box('none')), field('under the hand', box('none')), field('pressed', box('none')), field('a knob stack', box('drop a png…') + `<span style="opacity:.4">64 frames</span>`)]],
    ['anyone may change', [field('', chips(['let the user set this'])), note('it then stands in settings › display, by your name for it, as a knob of the theme')]],
  ])
  const parts = `<div class="left">
    <div class="search">find a part…</div>
    <div class="h">the head: one line, 17–36</div>
    ${[['mark', 'colour mark', ''], ['num', 'number', ''], ['text', 'name', ''], ['text', 'tag: bus, frozen, alt', ''], ['text', 'group', ''], ['fader', 'level', '', true], ['readout', 'level, read', ''], ['cell', 'armed', 'r'], ['cell', 'listening', 'i'], ['cell', 'muted', 'm'], ['cell', 'soloed', 's'], ['readout', 'automation', 'when on'], ['line', 'rule under the row', '']].map(([i, t, k, on]) => row(i, t, k, on)).join('')}
    <div class="h">add to the head</div>
    ${[['meter', 'a meter', ''], ['knob', 'pan', ''], ['readout', 'input', ''], ['button', 'any function…', ''], ['image', 'image', '']].map(([i, t, k]) => row(i, t, k)).join('')}
  </div>`
  const lay = layers([['rule under the row', false], ['automation', false, true], ['cells', false], ['level, read', false], ['level', true], ['group', false], ['tag', false], ['name', false], ['number', false], ['colour mark', false], ['chosen wash', false, false, true]], 'layers of the head: what is over what')
  const body = topBar('untitled theme', 'the head: its template; every track draws it') + parts + `<div class="mid"><div class="canvas">${room}${over}</div>${lay}</div>` + props
  await sheet('2 heads, the template at three heights, the level chosen, its states and images.png', body)
}

/* ── 3 free: what could not be made before ── */
{
  /* the window itself, 1728×1117, as a theme made in the editor lays it out: the heads at the right, the bars under the
     lanes and the markers under them, the transport a cluster floating low over the lanes, the mixer's strips laid over
     the lanes' foot at two thirds, a thin band at the top, the command line at the very foot */
  const k = 1920 / WW
  const at = (img, x, y, w, h, more = '') => `<img src="${img}" style="position:absolute;left:${x * k}px;top:${y * k}px;width:${w * k}px;height:${h * k}px;${more}">`
  const TOP = 40, LW = WW - HW, LY = TOP, LH = WH - TOP - RU - MK - FT
  let s = `<div style="position:absolute;left:0;top:0;width:1920px;height:${WH * k}px;background:${K0}"></div>`
  s += at(photos.lanes, 0, LY, LW, LH) + at(photos.heads, LW, LY, HW, LH)
  s += at(photos.ruler, 0, LY + LH, LW, RU) + at(photos.marks, 0, LY + LH + RU, LW, MK)
  s += at(photos.foot, 0, WH - FT, WW, FT)
  s += at(photos.mixer, 0, LY + LH - 300, LW, 300, 'opacity:.66')
  s += `<svg width="1920" height="${WH * k}">
    <rect x="0" y="0" width="1920" height="${TOP * k}" fill="${K2}"/>
    <text x="${24 * k}" y="${28 * k}" font-size="${18 * k}" font-weight="500" fill="${INK}" style="font-variant-numeric:tabular-nums">17 . 3 . 1 . 120</text>
    <text x="${210 * k}" y="${28 * k}" font-size="${11.5 * k}" fill="${INK}" fill-opacity=".6">00:00:34:12</text>
    <text x="${(LW - 24) * k}" y="${28 * k}" font-size="${11.5 * k}" fill="${INK}" fill-opacity=".86" text-anchor="end">120.00 ,  4/4 ,  A minor</text>
    <g transform="translate(${100 * k} ${(LY + LH - 300 - 120) * k})">
      <circle cx="0" cy="0" r="${62 * k}" fill="${K2}" fill-opacity=".94" stroke="${INK}" stroke-opacity=".18"/>
      ${glyph('play', 0, -22 * k, INK, .95, k * 1.6)}${glyph('stop', -26 * k, 14 * k, INK, .8, k * 1.2)}${glyph('rec', 26 * k, 14 * k, REC, 1, k * 1.2)}${glyph('loop', 0, 40 * k, SOLO, 1, k * 1.1)}${glyph('tostart', -40 * k, -14 * k, INK, .7, k)}${glyph('click', 40 * k, -14 * k, INK, .7, k)}
    </g>
    <rect x="${12 * k}" y="${(LY + 16) * k}" width="${8 * k}" height="${(LH - 340) * k}" fill="${INK}" fill-opacity=".1"/><rect x="${12 * k}" y="${(LY + 16 + (LH - 340) * .42) * k}" width="${8 * k}" height="${(LH - 340) * .58 * k}" fill="${INK}" fill-opacity=".8"/>
    <rect x="${24 * k}" y="${(LY + 16) * k}" width="${8 * k}" height="${(LH - 340) * k}" fill="${INK}" fill-opacity=".1"/><rect x="${24 * k}" y="${(LY + 16 + (LH - 340) * .47) * k}" width="${8 * k}" height="${(LH - 340) * .53 * k}" fill="${INK}" fill-opacity=".8"/>
    <text x="${22 * k}" y="${(LY + LH - 310) * k}" font-size="${9.5 * k}" fill="${INK}" fill-opacity=".6" text-anchor="middle">−0.4</text>
  </svg>`
  const body = `<style>html,body{width:1920px;height:${Math.round(WH * k)}px}</style>${s}`
  await sheet('3 free, a theme that could not be made before: heads right, bars under, the transport a cluster over the lanes.png', body, [0, 0, 1920, Math.round(WH * k)])
}

async function sheet (file, body, clip = [0, 0, 1920, 1200]) {
  const page = join(here, '_sheet.html')
  writeFileSync(page, html(body))
  const b = await open(page, { width: clip[2], height: clip[3], dsf: 2 })
  await b.sleep(900)
  const r = await b.send('Page.captureScreenshot', { format: 'png', clip: { x: clip[0], y: clip[1], width: clip[2], height: clip[3], scale: 2 } })
  writeFileSync(join(here, file), Buffer.from(r.data, 'base64'))
  console.log(file, JSON.stringify(b.errors))
  await b.close()
}
rmSync(join(here, '_sheet.html'), { force: true })                                   // (the sheet's page: made again each run)
process.exit(0)
