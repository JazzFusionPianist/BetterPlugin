// what the chapters are written with. One source, two languages: every sentence is given as t(english, korean) and the
// build asks for one of them. A chapter is a list of pages; a page is a title and blocks of text, pictures and drawings.
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const here = dirname(fileURLToPath(import.meta.url))
export const LANGS = ['en', 'ko']
let L = 'en'
export const setLang = l => { L = l }
export const lang = () => L
export const t = (en, ko) => (L === 'ko' ? (ko ?? en) : en)

/* how the app itself says a thing in Korean (ui/lang.ko.js). The key list's lines are put into Korean through it; words
   quoted from the screen ({{…}}) stay as the installed app writes them until KO_SCREEN is switched on. */
export const KO_SCREEN = process.env.GUIDE_KO_SCREEN === '1'
let KO = null
export function koWord (s) {
  if (!KO) { KO = {}; try { const LANG = { lists: {} }; new Function('LANG', readFileSync(join(here, '..', 'ui', 'lang.ko.js'), 'utf8'))(LANG); KO = LANG.lists.ko || {} } catch (e) {} }
  return KO[s]
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/* inside a sentence: [[⌥⌘N]] is a key, {{hand off}} a word as the screen writes it, ((File > Save As…)) a line of the
   Mac's menu bar, __word__ a term being named for the first time. */
const MODS = '⌘⌥⇧⌃'
function caps (k) {
  const parts = []
  let rest = k.trim()
  while (rest.length && MODS.includes(rest[0])) { parts.push(rest[0]); rest = rest.slice(1) }
  if (rest.length) parts.push(rest)
  return `<kbd>${parts.map(p => `<i${MODS.includes(p) ? ' class="m"' : ''}>${esc(/^[a-z]$/.test(p) ? p.toUpperCase() : p)}</i>`).join('')}</kbd>`
}
export function rich (s) {
  return esc(s)
    .replace(/\[\[(.+?)\]\](?!\])/g, (_, k) => caps(k.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')))
    .replace(/\{\{(.+?)\}\}/g, (_, w) => `<b class="ui">${L === 'ko' && KO_SCREEN && koWord(w) ? esc(koWord(w)) : w}</b>`)
    .replace(/\(\((.+?)\)\)/g, (_, m) => `<span class="menu">${m.split(/\s*&gt;\s*/).join('<em>›</em>')}</span>`)
    .replace(/__(.+?)__/g, '<dfn>$1</dfn>')
    .replace(/`(.+?)`/g, '<code>$1</code>')                                    // a line as it is typed into the command line
}
export const T = (en, ko) => rich(t(en, ko))

// blocks
export const p = (en, ko) => `<p>${T(en, ko)}</p>`
export const lead = (en, ko) => `<p class="lead">${T(en, ko)}</p>`
export const h = (en, ko) => `<h3>${T(en, ko)}</h3>`
export const note = (en, ko) => `<p class="note">${T(en, ko)}</p>`
export const steps = (...rows) => `<ol class="steps">${rows.map(([en, ko]) => `<li>${T(en, ko)}</li>`).join('')}</ol>`
export const list = (...rows) => `<ul class="list">${rows.map(([en, ko]) => `<li>${T(en, ko)}</li>`).join('')}</ul>`
/* a picture's numbered parts: [n, name, what it is] */
export const legend = (...rows) => `<dl class="legend">${rows.map(([n, en, ko]) => `<div><dt>${n}</dt><dd>${T(en, ko)}</dd></div>`).join('')}</dl>`
/* what the hand does and what comes of it: [gesture, english, korean]; the gesture is written with the marks above */
export const table = (head, ...rows) => `<table class="tbl">${head ? `<thead><tr>${head.map(([en, ko]) => `<th>${T(en, ko)}</th>`).join('')}</tr></thead>` : ''}<tbody>${rows.map(r => `<tr>${r.map(c => typeof c === 'number' ? `<td class="nc"><span class="num">${c}</span></td>` : `<td>${Array.isArray(c) ? T(c[0], c[1]) : rich(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
export const cols = (n, ...blocks) => `<div class="cols c${n}">${blocks.map(b => `<div>${b}</div>`).join('')}</div>`
export const box = (...blocks) => `<div class="boxed">${blocks.join('')}</div>`

/* a picture of the app with numbered lines drawn to its parts.
   name: a file in pics/ (made by shots.mjs, which also writes name.json = where each named part lies in it)
   calls: [n, target, side, shift] — target is the name of a part in the json or [x, y] in the picture's own points;
   side is where the number stands: t, b, l, r; shift moves the number along that side. */
export function fig (name, { w = 160, calls = [], pad, cap, frame = true } = {}) {
  const file = join(here, 'pics', name + '.png'), meta = join(here, 'pics', name + '.json')
  if (!existsSync(file)) return `<div class="missing">missing picture: ${esc(name)}</div>`
  const m = existsSync(meta) ? JSON.parse(readFileSync(meta, 'utf8')) : { w: 1000, h: 600, parts: {} }
  const W = m.w, H = m.h
  const u = W / w * 1                                       // points of the picture to a millimetre of paper
  const P = Object.assign({ t: 0, b: 0, l: 0, r: 0 }, pad || {})
  for (const [, , side = 't'] of calls) P[side] = Math.max(P[side], 7.5)
  const k = mm => mm * u
  const vb = [-k(P.l), -k(P.t), W + k(P.l + P.r), H + k(P.t + P.b)]
  let marks = ''
  const cid = 'c-' + name.replace(/[^a-z0-9]/gi, '')
  for (const [n, target, side = 't', shift = 0, opt = {}] of calls) {
    let x, y
    if (Array.isArray(target)) [x, y] = target
    else { const b = m.parts[target]; if (!b) { marks += `<text x="0" y="${k(3)}" class="miss">no part ${esc(target)}</text>`; continue } x = b[0] + b[2] * (opt.fx ?? (side === 'l' ? .12 : side === 'r' ? .88 : .5)); y = b[1] + b[3] * (opt.fy ?? (side === 't' ? .14 : side === 'b' ? .86 : .5)) }      // a named part is touched at the edge nearest its number, so the ring does not sit on its word
    const s = k(4.2), g = k(1.2)                            // the number's square, and the gap it keeps from the picture
    let mx, my
    if (side === 't') { mx = x + k(shift); my = -g - s / 2 }
    else if (side === 'b') { mx = x + k(shift); my = H + g + s / 2 }
    else if (side === 'l') { mx = -g - s / 2; my = y + k(shift) }
    else { mx = W + g + s / 2; my = y + k(shift) }
    const vert = side === 't' || side === 'b'
    const from = vert ? [mx, my + (side === 't' ? s / 2 : -s / 2)] : [mx + (side === 'l' ? s / 2 : -s / 2), my]
    const pts = [from, [x, y]]                              // one straight line from the number to the part, slanting when the number was moved along its side
    const line = pts.map(q => q.map(v => v.toFixed(1)).join(',')).join(' '), sw = k(.2).toFixed(2), inside = x >= 0 && x <= W && y >= 0 && y <= H
    marks += `<polyline class="ld" stroke-width="${sw}" points="${line}"/><polyline class="ld on-pic" stroke-width="${sw}" points="${line}" clip-path="url(#${cid})"/><circle class="ld-end${inside ? ' on-pic' : ''}" stroke-width="${sw}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${k(.6).toFixed(1)}"/>`
    marks += `<rect class="ld-n" x="${(mx - s / 2).toFixed(1)}" y="${(my - s / 2).toFixed(1)}" width="${s.toFixed(1)}" height="${s.toFixed(1)}" rx="${k(.5).toFixed(1)}"/><text class="ld-t" x="${mx.toFixed(1)}" y="${(my + k(1.05)).toFixed(1)}" font-size="${k(2.9).toFixed(1)}" text-anchor="middle">${n}</text>`
  }
  const wmm = w + P.l + P.r
  return `<figure class="fig" style="width:${wmm}mm"><svg viewBox="${vb.map(v => v.toFixed(1)).join(' ')}" style="width:${wmm}mm" xmlns="http://www.w3.org/2000/svg">${frame ? `<rect x="0" y="0" width="${W}" height="${H}" rx="${k(.9).toFixed(1)}" fill="#0E0E0E"/>` : ''}<clipPath id="${cid}"><rect x="0" y="0" width="${W}" height="${H}" rx="${k(.9).toFixed(1)}"/></clipPath><image href="pics/${encodeURI(name)}.png" x="0" y="0" width="${W}" height="${H}" clip-path="url(#${cid})"/>${marks}</svg>${cap ? `<figcaption>${T(cap[0], cap[1])}</figcaption>` : ''}</figure>`
}

/* a drawing made for the guide. Its own points are millimetres of paper: draw(w, h, inner svg, caption). */
export function draw (w, h, inner, cap) {
  return `<figure class="fig drawn" style="width:${w}mm"><svg viewBox="0 0 ${w} ${h}" style="width:${w}mm;height:${h}mm" xmlns="http://www.w3.org/2000/svg">${inner}</svg>${cap ? `<figcaption>${T(cap[0], cap[1])}</figcaption>` : ''}</figure>`
}
// the drawing's parts
export const D = {
  txt: (x, y, en, ko, cls = '') => `<text x="${x}" y="${y}" class="dt ${cls}">${esc(t(en, ko))}</text>`,
  box: (x, y, w, h, cls = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx=".7" class="db ${cls}"/>`,
  /* a cell with its word in the middle */
  cell: (x, y, w, h, en, ko, cls = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx=".7" class="db ${cls}"/><text x="${x + w / 2}" y="${y + h / 2 + 1.05}" text-anchor="middle" class="dt ${cls}">${esc(t(en, ko))}</text>`,
  line: (x1, y1, x2, y2, cls = '') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="dl ${cls}"/>`,
  /* an arrow along points; its head is drawn, not a marker, so it prints the same everywhere */
  arrow: (pts, cls = '') => {
    const [x2, y2] = pts[pts.length - 1], [x1, y1] = pts[pts.length - 2]
    const a = Math.atan2(y2 - y1, x2 - x1), s = 1.9, w = .62
    const hx = x2 - Math.cos(a) * s, hy = y2 - Math.sin(a) * s
    const head = `${x2},${y2} ${(hx - Math.sin(a) * w).toFixed(2)},${(hy + Math.cos(a) * w).toFixed(2)} ${(hx + Math.sin(a) * w).toFixed(2)},${(hy - Math.cos(a) * w).toFixed(2)}`
    const body = pts.slice(0, -1).concat([[x2 - Math.cos(a) * s * .8, y2 - Math.sin(a) * s * .8]])
    return `<polyline points="${body.map(q => q.join(',')).join(' ')}" class="da ${cls}"/><polygon points="${head}" class="dh ${cls}"/>`
  },
  path: (d, cls = '') => `<path d="${d}" class="dl ${cls}"/>`,
  dot: (x, y, r = .7, cls = '') => `<circle cx="${x}" cy="${y}" r="${r}" class="dd ${cls}"/>`,
  num: (x, y, n) => `<rect x="${x - 2.1}" y="${y - 2.1}" width="4.2" height="4.2" rx=".5" class="ld-n"/><text x="${x}" y="${y + 1.05}" text-anchor="middle" class="ld-t" font-size="2.9">${n}</text>`,
}

/* a page. kind: 'split' (words at the left, the picture at the right), 'wide' (the picture across, words under it),
   'text' (words only, in columns). */
export const page = (title, o) => Object.assign({ kind: 'split', title }, o)
export const chapter = (id, title, intro, pages) => ({ id, title, intro, pages })
