// node "design/tool pointers draft 1/draft.mjs" — a pointer of its own for every tool (his ask, 2026-10-23: "각 툴마다 마우스
// 포인터 모양이 다 달랐으면 좋겠어"). Drawn as the smart tool's pointers were approved (editing round 1): ink with a dark edge, on a
// grid of 16 shown at 24 px, so that they read on a lane and on any pigment. The paths here are the ones the app would draw;
// the red cross is the spot a press lands on. Writes one standalone svg per sheet (for Figma) and its png.
import { open } from '../../test/cdp.mjs'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const K0 = '#0E0E0E', K1 = '#151514', K2 = '#1B1B1A', K3 = '#262625', INK = '#ECEAE4', RED = '#D8432E', FONT = 'Instrument Sans'

/* the pigments, as look.js gives them (hue, lightness, chroma in oklch) */
const oklch = (h, L, C) => {
  const a = C * Math.cos(h * Math.PI / 180), b = C * Math.sin(h * Math.PI / 180)
  const l = (L + .3963377774 * a + .2158037573 * b) ** 3, m = (L - .1055613458 * a - .0638541728 * b) ** 3, s = (L - .0894841775 * a - 1.291485548 * b) ** 3
  const lin = [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, -.0041960863 * l - .7034186147 * m + 1.707614701 * s]
  return '#' + lin.map(v => { v = Math.max(0, Math.min(1, v)); v = v <= .0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - .055; return Math.round(v * 255).toString(16).padStart(2, '0') }).join('').toUpperCase()
}
const VOX = oklch(36, .60, .175), KEYS = oklch(174, .48, .105), GTR = oklch(92, .81, .125), DRUMS = oklch(266, .40, .150)

/* the pointers: a path on the grid of 16, what of it is filled, and where a press lands */
const P = {
  pointer: { d: 'M3 2.5V13L5.8 10.4L7.9 14.3L9.9 13.3L7.8 9.5H11.6Z', fill: K0, hot: [3, 2.5], key: 't', way: ['over a region: grab', 'at its ends: trim'] },
  smart: { d: 'M2.5 2V11L4.8 8.9L6.5 12.1L8.1 11.3L6.4 8.2H9.5Z M10 10H14V14H10Z M12 10V14M10 12H14', fill: K0, hot: [2.5, 2], key: 's', way: ['in a region: the pointer of', 'the zone, as before'] },
  pencil: { d: 'M2.5 13.5L3.42 9.9L11.2 2.12L13.88 4.8L6.1 12.58Z M3.42 9.9L6.1 12.58 M9.36 3.96L12.04 6.64', fill: K0, hot: [2.5, 13.5], key: 'p', way: ['draws a region, or a point', 'on a line'] },
  eraser: { d: 'M2.2 9.8L8.85 3.15L12.81 7.11L6.16 13.76Z M5.03 6.97L8.99 10.93', fill: K0, solid: 'M2.2 9.8L5.03 6.97L8.99 10.93L6.16 13.76Z', hot: [4.2, 11.8], key: 'e', way: ['takes away what it', 'is pressed on'] },
  scissors: { d: 'M6.6 1.8L10.2 10.8M9.4 1.8L5.8 10.8 M2.6 10.8H6.4V14.4H2.6Z M9.6 10.8H13.4V14.4H9.6Z', hot: [8, 1.8], key: 'i', way: ['cuts where its tips are'] },
  join: { d: 'M2.5 3.5H7V9H2.5Z M9 3.5H13.5V9H9Z M4.75 9V12.5H11.25V9', hot: [8, 6.2], key: 'j', way: ['makes the regions one'] },
  mute: { d: 'M2.5 6H5V10H2.5Z M5 6L8.5 3V13L5 10 M10.2 6.2L13.8 9.8M13.8 6.2L10.2 9.8', fill: K0, hot: [8, 8], key: 'm', way: ['silences a region,', 'and back'] },
  gain: { d: 'M8 2V6.8M8 9.2V14 M6 4L8 2L10 4 M6 12L8 14L10 12', solidDark: 'M4.4 6.8H11.6V9.2H4.4Z', hot: [8, 8], key: 'g', way: ['pulled up or down:', 'the region louder or softer'] },
  fade: { d: 'M2 13C4.5 13 4.8 4 7.5 4H8.5C11.2 4 11.5 13 14 13', hot: [8, 8], key: 'a', way: ['a fade in at the start,', 'a fade out at the end'] },
  marquee: { d: 'M8 1.5V6M8 10V14.5M1.5 8H6M10 8H14.5 M11 13.5H13.5V11', hot: [8, 8], key: 'r', way: ['picks a stretch of time'] },
  rubato: { d: 'M8 2V14 M8 2H11.5V5H8 M4.5 9.5L2.5 11.5L4.5 13.5M2.5 11.5H6 M11.5 9.5L13.5 11.5L11.5 13.5M10 11.5H13.5', fill: INK, fillOnly: 'M8 2H11.5V5H8Z', hot: [8, 8], key: 'x', way: ['puts a pin, pulls it', 'along the time'] },
  zoom: { d: 'M2.5 2.5H10.5V10.5H2.5Z M10.5 10.5L14 14 M6.5 4.5V8.5M4.5 6.5H8.5', fill: K0, hot: [6.5, 6.5], key: 'y', way: ['pulled: closer', 'a press: farther'] },
  velocity: { d: 'M5 14V6.8 M11.5 2.5V13.5 M9.5 4.5L11.5 2.5L13.5 4.5 M9.5 11.5L11.5 13.5L13.5 11.5', fillOnly: 'M3.2 3.2H6.8V6.8H3.2Z', fill: INK, hot: [5, 5], key: 'v', way: ['on the notes: pulled,', 'harder or softer'] },
  point: { d: 'M1.5 12.5L6 9.2 M10 6.2L14.5 3', solidDark: 'M5.8 5.6H10.2V10H5.8Z', hot: [8, 7.8], key: '', way: ['on a volume line, with every', 'tool but the eraser'] }
}
const ORDER = ['pointer', 'smart', 'pencil', 'eraser', 'scissors', 'join', 'mute', 'gain', 'fade', 'marquee', 'rubato', 'zoom', 'velocity', 'point']
/* the smart tool's own, approved and built, kept as they are (ui.js makeCursors) */
const KEPT = { 'fade in': 'M2.5 13.5H13.5V2.5M2.5 13.5C8.5 13.5 9 2.5 13.5 2.5', 'fade out': 'M13.5 13.5H2.5V2.5M13.5 13.5C7.5 13.5 7 2.5 2.5 2.5', crossfade: 'M2.5 2.5C8.5 2.5 7.5 13.5 13.5 13.5M2.5 13.5C8.5 13.5 7.5 2.5 13.5 2.5',
  range: 'M5.5 2.5C7 2.5 8 3.2 8 4.5V11.5C8 12.8 7 13.5 5.5 13.5M10.5 2.5C9 2.5 8 3.2 8 4.5M10.5 13.5C9 13.5 8 12.8 8 11.5M6.3 8H9.7', trim: 'M2 8H14M4.6 5.2L2 8L4.6 10.8M11.4 5.2L14 8L11.4 10.8M8 3.5V12.5',
  grab: 'M4.5 8.2V4.6a1 1 0 0 1 2 0V7.4M6.5 7.4V3.4a1 1 0 0 1 2 0V7.4M8.5 7.4V3.8a1 1 0 0 1 2 0V7.8M10.5 7.8V5.4a1 1 0 0 1 2 0V10.2C12.5 12.4 11 13.8 8.8 13.8H8C6.4 13.8 5.4 13 4.6 11.6L3 8.8a.95 .95 0 0 1 1.5 -1.1Z' }

const n = v => +v.toFixed(2)
const T = (x, y, s, text, o = {}) => `<text x="${n(x)}" y="${n(y)}" font-family="${FONT}" font-size="${s}" font-weight="${o.w || 400}" fill="${o.c || INK}" fill-opacity="${o.a ?? 1}">${text}</text>`
const R = (x, y, w, h, c, a = 1) => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${c}"${a < 1 ? ` fill-opacity="${a}"` : ''}/>`
/* one pointer at a scale (1.5 is its own size: 24 px), drawn as the app draws it: the dark edge, what is filled, the ink */
function glyph (k, x, y, sc, opts = {}) {
  const g = P[k] || { d: KEPT[k] }
  let s = `<g transform="translate(${n(x)} ${n(y)}) scale(${sc})" stroke-linecap="round" stroke-linejoin="round">`
  s += `<path d="${g.d}${g.fillOnly ? ' ' + g.fillOnly : ''}${g.solidDark ? ' ' + g.solidDark : ''}${g.solid ? ' ' + g.solid : ''}" fill="none" stroke="${K0}" stroke-opacity=".92" stroke-width="3.4"/>`
  if (g.fill && !g.fillOnly) s += `<path d="${g.d}" fill="${g.fill}" fill-rule="evenodd" stroke="none"/>`
  if (k === 'grab') s += `<path d="${g.d}" fill="${K0}" fill-opacity=".4" stroke="none"/>`
  if (g.solidDark) s += `<path d="${g.solidDark}" fill="${K0}" stroke="${INK}" stroke-width="1.3"/>`
  if (g.solid) s += `<path d="${g.solid}" fill="${INK}" stroke="none"/>`
  if (g.fillOnly) s += `<path d="${g.fillOnly}" fill="${g.fill}" stroke="none"/>`
  s += `<path d="${g.d}" fill="none" stroke="${INK}" stroke-width="1.3"/>`
  if (opts.hot && g.hot) { const [hx, hy] = g.hot, r = 1.1; s += `<path d="M${hx - r} ${hy}H${hx + r}M${hx} ${hy - r}V${hy + r}" stroke="${RED}" stroke-width="${n(1.6 / sc * 2.2)}" stroke-linecap="butt"/>` }
  return s + '</g>'
}
/* a region on a lane, with a sound in it, as the room draws one */
function region (x, y, w, h, c, seed) {
  let s = R(x, y, w, h, c), d = `M${n(x + 3)} ${n(y + h / 2)}`, r = seed
  const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280 }
  const amps = []
  for (let i = 0; i <= w - 6; i += 3) amps.push((.18 + .8 * rnd() * (Math.sin(i / 23 + seed) * .5 + .6)) * h * .42)
  amps.forEach((a, i) => { d += `L${n(x + 3 + i * 3)} ${n(y + h / 2 - a)}` })
  for (let i = amps.length - 1; i >= 0; i--) d += `L${n(x + 3 + i * 3)} ${n(y + h / 2 + amps[i])}`
  return s + `<path d="${d}Z" fill="${K0}" fill-opacity=".72"/>`
}

/* ── sheet 1: every tool, its own pointer ── */
function sheet1 () {
  const W = 1440, H = 940, M = 70, cols = 7, cw = (W - 2 * M) / cols, tile = 56, pad = 5, sc = (tile - 2 * pad) / 16
  let s = R(0, 0, W, H, K1)
  s += T(M, 78, 15, 'a', { w: 600 }) + T(M + 22, 78, 15, 'every tool, a pointer of its own') + T(M + 22, 98, 11, 'drawn as the smart tool’s were: ink with a dark edge, so that they read on a lane and on any pigment. the red cross is where a press lands', { a: .55 })
  ORDER.forEach((k, i) => {
    const cx = M + (i % cols) * cw, cy = 140 + Math.floor(i / cols) * 172
    const bgs = [K0, KEYS, GTR]
    bgs.forEach((bg, j) => { s += R(cx + j * tile, cy, tile, tile, bg); s += glyph(k, cx + j * tile + pad, cy + pad, sc, { hot: j === 0 }) })
    const name = k === 'point' ? 'on a line' : k
    s += T(cx, cy + tile + 26, 12.5, name) + (P[k].key ? T(cx + 132, cy + tile + 26, 12.5, P[k].key, { a: .5 }) : '')
    P[k].way.forEach((l, j) => { s += T(cx, cy + tile + 46 + j * 15, 10.5, l, { a: .55 }) })
  })
  /* b: at their own size */
  const by = 520
  s += T(M, by, 15, 'b', { w: 600 }) + T(M + 22, by, 15, 'at their own size') + T(M + 22, by + 20, 11, 'each pointer on a region of a row of 25, as it would be met', { a: .55 })
  ORDER.forEach((k, i) => {
    const cx = M + (i % cols) * cw, cy = by + 50 + Math.floor(i / cols) * 86, lw = cw - 22
    s += R(cx, cy, lw, 36, K0)
    const pig = [VOX, KEYS, GTR, DRUMS][i % 4]
    s += region(cx + 14, cy + 5, lw - 40, 26, pig, i + 3)
    const g = P[k], at = [cx + lw * .45, cy + 18]
    s += glyph(k, at[0] - g.hot[0] * 1.5, at[1] - g.hot[1] * 1.5, 1.5)
    s += T(cx, cy + 56, 10.5, k === 'point' ? 'on a line' : k, { a: .7 })
  })
  /* c: what stays */
  const cy0 = 780
  s += T(M, cy0, 15, 'c', { w: 600 }) + T(M + 22, cy0, 15, 'what stays as it is') + T(M + 22, cy0 + 20, 11, 'the smart tool’s six, built after round 1; the pointer tool takes the same grab and trim over a region, in place of the system’s', { a: .55 })
  Object.keys(KEPT).forEach((k, i) => {
    const cx = M + i * cw, y = cy0 + 50
    ;[K0, KEYS].forEach((bg, j) => { s += R(cx + j * 40, y, 40, 40, bg); s += glyph(k, cx + j * 40 + 4, y + 4, 2) })
    s += T(cx + 92, y + 24, 11, k, { a: .7 })
  })
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${s}</svg>`
}

const svg = sheet1(), name = '1 every tool, a pointer of its own'
writeFileSync(join(here, name + '.svg'), svg)
const fonts = join(here, '..', '..', 'ui', 'fonts')
const html = join(process.env.SCRATCH || here, '_sheet.html')
writeFileSync(html, `<!doctype html><meta charset="utf-8"><style>@font-face { font-family: 'Instrument Sans'; font-weight: 400 700; src: url('${pathToFileURL(fonts).href}/instrument-sans-normal-400-700-latin.woff2') } body { margin: 0; background: ${K1} }</style>${svg.replace(/^<\?xml[^>]*>/, '')}`)
const b = await open(html, { width: 1440, height: 940, dsf: 2 })
await b.sleep(600)
const r = await b.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1440, height: 940, scale: 1 } })
writeFileSync(join(here, name + '.png'), Buffer.from(r.data, 'base64'))
console.log(name)
await b.close(); process.exit(0)
