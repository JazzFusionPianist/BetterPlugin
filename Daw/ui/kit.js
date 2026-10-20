/* ── the drawing kit: black paper, white ink. Everything is an SVG string ──
   The room is quiet: neutral darks, hairlines, one family of type (Instrument Sans; italic for the names of people).
   Colour is kept for what plays (a track's own pigment), for what a state means, and for the prints. */
let W = 1440, H = 900                                      // the room, in its own units; it takes the size of the window (see fit)
/* the darks, from the deepest (the lanes) up to a thing under the hand; the ink */
let K0 = '#0E0E0E', K1 = '#151514', K2 = '#1B1B1A', K3 = '#262625', K4 = '#32322F', INK = '#ECEAE4'      // (let: a look may set them again — look.js)
/* what a colour means: recording, solo and the cycle, listening to the input */
let REC = '#DE4F3C', SOLO = '#D8B24A', MON = '#D68A3E', LEVEL = INK
const PAPER = '#FBFAF7'
/* the hairlines between things: in ink unless a look gives them a colour of their own, and as strong as drawn times LINE_K */
let LINE = null, LINE_K = 1
/* the prints' own colours (never changed) */
const CREAM = '#ECE2C8', SPACE = '#7896FF', MINT = '#5CE0A8', AMBER = '#FFA848'
let FONT = "'Instrument Sans', 'Pretendard Variable', 'Apple SD Gothic Neo', system-ui, sans-serif"      // (let: a theme gives the room another face — theme.js)
/* the type a theme gives the room (theme.js): the face of what someone named, capitals for the room's own words, the
   space between letters, a scale of every size, a wider cut */
let TF = { names: null, namesIt: false, caps: false, space: 0, scale: 1, stretch: '' }
let UID = 0

const cv = document.createElement('canvas').getContext('2d')
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
const n = v => +(+v).toFixed(2)
/* What is written is written in the language of the settings (lang.js): the program's own words, wherever they are
   drawn or measured. A name someone gave — a track, a marker, a song, a file — is never turned into another word:
   asGiven(s) marks it (an unseen sign before it, taken off again here), and so does italic, which is for people. */
const NAMED = '\u2063'
const asGiven = s => NAMED + String(s == null ? '' : s)
const inWords = (s, it) => { s = String(s); return s.charCodeAt(0) === 0x2063 ? s.slice(1) : !it && typeof window.LANG_WORDS === 'function' ? window.LANG_WORDS(s) : s }
/* how a string is set: its face, its letters, its space (a name someone gave keeps its letters, in the face of names) */
function typeset (s, it) {
  const named = it || String(s).charCodeAt(0) === 0x2063, said = inWords(s, it)
  if (named) return { t: said, face: TF.names || FONT, it: it || (TF.namesIt && !!TF.names), space: 0, stretch: TF.names ? '' : TF.stretch }
  return { t: TF.caps ? said.toUpperCase() : said, face: FONT, it, space: TF.space, stretch: TF.stretch }
}
function tw (s, size = 10, w = 400, it = false) { const f = typeset(s, it); cv.font = `${f.it ? 'italic ' : ''}${w} ${f.stretch ? f.stretch + ' ' : ''}${size * TF.scale}px ${f.face}`; return cv.measureText(f.t).width + f.space * f.t.length }
function T (x, y, s, o = {}) {
  const { size = 10, w = 400, c = INK, a = 1, anchor = 'start', it = false, x: extra = '' } = o
  const f = typeset(s, it), wd = anchor === 'start' ? 0 : tw(s, size, w, it)
  const xx = anchor === 'middle' ? x - wd / 2 : anchor === 'end' ? x - wd : x
  return `<text x="${n(xx)}" y="${n(y)}" font-family="${f.face}" font-size="${n(size * TF.scale)}" font-weight="${w}"${f.it ? ' font-style="italic"' : ''}${f.space ? ` letter-spacing="${f.space}"` : ''}${f.stretch ? ` font-stretch="${f.stretch}"` : ''} fill="${c}"${a < 1 ? ` fill-opacity="${a}"` : ''}${extra}>${esc(f.t)}</text>`
}
/* a string cut to a width, with a mark that it was */
const fit = (s, maxW, size = 10, w = 400, it = false) => {
  const given = String(s), said = inWords(given, it), sign = said === given ? '' : NAMED       // (in other words, or a name: what comes back is not put into words again)
  if (tw(sign + said, size, w, it) <= maxW) return sign ? sign + said : given
  let k = said.length
  while (k > 1 && tw(sign + said.slice(0, k).trimEnd() + '…', size, w, it) > maxW) k--
  return sign + said.slice(0, k).trimEnd() + '…'
}
function run (x, y, parts, gap = 0) {
  let out = '', cx = x
  for (const [s, o] of parts) { out += T(cx, y, s, o); cx += tw(s, o.size, o.w, o.it) + gap }
  return [out, cx - gap]
}
const runW = (parts, gap = 0) => parts.reduce((a, [t, o]) => a + tw(t, o.size, o.w, o.it) + gap, -gap)
const R = (x, y, w, h, o = {}) => {
  const { rx = 0, fill = 'none', fa = 1, stroke, sa = 1, sw = 1, dash, x: extra = '' } = o
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(Math.max(0, w))}" height="${n(Math.max(0, h))}"${rx ? ` rx="${rx}"` : ''} fill="${fill}"${fill !== 'none' && fa < 1 ? ` fill-opacity="${n(fa)}"` : ''}${stroke ? ` stroke="${stroke}" stroke-width="${sw}"${sa < 1 ? ` stroke-opacity="${n(sa)}"` : ''}` : ''}${dash ? ` stroke-dasharray="${dash}"` : ''}${extra}/>`
}
const P = (d, o = {}) => {
  const { fill = 'none', fa = 1, stroke, sa = 1, sw = 1, dash, cap, rule, x: extra = '' } = o
  return `<path d="${d}" fill="${fill}"${fill !== 'none' && fa < 1 ? ` fill-opacity="${n(fa)}"` : ''}${rule ? ` fill-rule="${rule}"` : ''}${stroke ? ` stroke="${stroke}" stroke-width="${sw}"${sa < 1 ? ` stroke-opacity="${n(sa)}"` : ''}` : ''}${dash ? ` stroke-dasharray="${dash}"` : ''}${cap ? ` stroke-linecap="${cap}" stroke-linejoin="${cap}"` : ''}${extra}/>`
}
const Cc = (cx, cy, r, o = {}) => {
  const { fill = 'none', fa = 1, stroke, sa = 1, sw = 1, dash, x: extra = '' } = o
  return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${fill}"${fill !== 'none' && fa < 1 ? ` fill-opacity="${n(fa)}"` : ''}${stroke ? ` stroke="${stroke}" stroke-width="${sw}"${sa < 1 ? ` stroke-opacity="${n(sa)}"` : ''}` : ''}${dash ? ` stroke-dasharray="${dash}"` : ''}${extra}/>`
}
const G = (inner, tr, extra = '') => `<g${tr ? ` transform="${tr}"` : ''}${extra}>${inner}</g>`
/* an unseen rectangle that takes the pointer */
const hit = (x, y, w, h, a, more = '', cur = 'pointer') => `<rect x="${n(x)}" y="${n(y)}" width="${n(Math.max(0, w))}" height="${n(Math.max(0, h))}" fill="#000" fill-opacity="0" data-a="${a}"${more} style="cursor:${cur}"/>`
const hline = (x0, x1, y, a = .08) => P(`M${n(x0)} ${n(y) + .5}H${n(x1)}`, { stroke: LINE || INK, sa: Math.min(1, a * LINE_K) })
const vline = (x, y0, y1, a = .08) => P(`M${n(x) + .5} ${n(y0)}V${n(y1)}`, { stroke: LINE || INK, sa: Math.min(1, a * LINE_K) })
const caret = (x, y, a = .5) => P(`M${n(x - 2.5)} ${n(y - 1.2)}L${n(x)} ${n(y + 1.6)}L${n(x + 2.5)} ${n(y - 1.2)}`, { stroke: INK, sa: a, sw: 1, cap: 'round' })

/* colour by lightness, strength and hue (oklch), so that the colours of one family weigh alike */
function oklch (L, C, h) {
  const a = C * Math.cos(h * Math.PI / 180), b = C * Math.sin(h * Math.PI / 180)
  const l = (L + .3963377774 * a + .2158037573 * b) ** 3, m = (L - .1055613458 * a - .0638541728 * b) ** 3, s = (L - .0894841775 * a - 1.291485548 * b) ** 3
  const lin = [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, -.0041960863 * l - .7034186147 * m + 1.707614701 * s]
  const f = v => { v = Math.min(1, Math.max(0, v)); return v <= .0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - .055 }
  return '#' + lin.map(v => Math.round(f(v) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()
}

/* one outlined frame cut into cells; the chosen cell filled. An item: {t, k (the letter of its key), g (a drawing), on, c, dim, a (what a press does), more} */
function cells (x, y, h, items, o = {}) {
  const { size = 9.5, pad = 9, widths, frame = .24, a = .62 } = o
  let cx = x, out = '', div = '', hits = ''
  const ws = items.map((it, i) => widths ? widths[i] : Math.round(tw(it.t || '', size, 500) + pad * 2 + (it.k ? tw(it.k, size - 1.5) + 7 : 0)))
  const total = ws.reduce((p, q) => p + q, 0), id = 'cl' + (++UID)
  items.forEach((it, i) => {
    const w = ws[i], ty = y + h / 2 + size * .35
    if (it.on) out += R(cx, y, w, h, { fill: it.c || INK })
    if (it.t) {
      if (it.k) out += T(cx + pad, ty, it.t, { size, w: it.on ? 500 : 400, c: it.on ? K1 : INK, a: it.on ? 1 : a }) + T(cx + w - pad, ty - .2, it.k, { size: size - 1.5, c: it.on ? K1 : INK, a: it.on ? .55 : .34, anchor: 'end' })
      else out += T(cx + w / 2, ty, it.t, { size, w: it.on ? 500 : 400, c: it.on ? K1 : INK, a: it.on ? 1 : (it.dim ? .22 : a), anchor: 'middle' })
    }
    if (it.g) out += it.g(cx + w / 2, y + h / 2, it.on ? K1 : (it.gc || INK), it.on ? 1 : (it.ga || .78))
    if (i) div += `M${n(cx) + .5} ${y + 1}V${y + h - 1}`
    if (it.a && !it.dim) hits += hit(cx, y, w, h, it.a, it.more || '')
    cx += w
  })
  return [`<clipPath id="${id}"><rect x="${n(x)}" y="${n(y)}" width="${total}" height="${h}" rx="2"/></clipPath>` + G(out, '', ` clip-path="url(#${id})"`) + P(div, { stroke: INK, sa: frame * .7 }) + R(x + .5, y + .5, total - 1, h - 1, { rx: 2, stroke: INK, sa: frame }) + hits, total]
}
/* a key by itself: {h, size, pad, a, more, armed (filled), dim} */
const keyW = (t, o = {}) => Math.round(tw(t, o.size || 9.5, o.armed ? 500 : 400) + (o.pad == null ? 9 : o.pad) * 2)
const key = (x, y, t, o = {}) => {
  const { h = 18, size = 9.5, pad = 9, a, more = '', armed, dim, c } = o, w = keyW(t, o)
  return [(armed ? R(x, y, w, h, { rx: 2, fill: c || INK }) : R(x + .5, y + .5, w - 1, h - 1, { rx: 2, stroke: INK, sa: dim ? .14 : .24 })) + T(x + pad, y + h / 2 + size * .35, t, { size, w: armed ? 500 : 400, c: armed ? K1 : INK, a: armed ? 1 : dim ? .32 : .8 }) + (a ? hit(x, y, w, h, a, more) : ''), w]
}
/* a key that opens a list: what is chosen, and a small mark that it opens */
function menuKey (x, y, word, o = {}) {                                                // o.w: a width of its own (the word fitted into it)
  const { h = 18, size = 9.5, a, more = '', dim } = o, w = o.w || Math.round(tw(word, size) + 26)
  return [R(x + .5, y + .5, w - 1, h - 1, { rx: 2, stroke: INK, sa: .2 }) + T(x + 8, y + h / 2 + size * .35, o.w ? fit(word, w - 26, size) : word, { size, a: dim ? .4 : .88 }) + caret(x + w - 9.5, y + h / 2, .45) + (a ? hit(x, y, w, h, a, more) : ''), w]
}
/* a word and its value, side by side; with `a` the value can be taken hold of */
function field (x, y, label, v, o = {}) {
  const { size = 9.5, alpha = .9, a, more = '', cur = 'ns-resize', c = INK } = o, lw = tw(label, size), vw = tw(v, size)
  return [T(x, y, label, { size, a: .4 }) + T(x + lw + 5, y, v, { size, a: alpha, c }) + (a ? hit(x + lw, y - 12, vw + 10, 18, a, more, cur) : ''), lw + 5 + vw]
}

/* the prints: Patch on Slur's plates, as the landing draws them (not to be redrawn) */
function plate (kind, cx, cy, r) {
  const K = r / 44
  let s = ''
  if (kind === 'tape') {
    s += R(-r, -r, 2 * r, 2 * r, { rx: 2, fill: '#786E5A', fa: .55 })
    let d = ''
    const rr = r * .78
    for (let y = -rr + 1.2; y < rr; y += 3.4 * K) { const hw = Math.sqrt(rr * rr - y * y); d += `M${n(-hw)} ${n(y)}H${n(hw)}` }
    s += P(d, { stroke: CREAM, sa: .95, sw: n(.9 * K) })
  } else if (kind === 'space') {
    s += Cc(0, 0, r, { fill: '#283278', fa: .85 })
    for (let i = 1; i <= 4; i++) s += Cc(0, 0, r * (.1 + i * .12), { stroke: SPACE, sa: n((1 - i * .15) * .95), sw: n(.9 * K) })
    s += Cc(0, 0, 2 * K, { fill: SPACE })
  } else if (kind === 'delay') {
    s += Cc(0, 0, r, { fill: '#284646', fa: .85 })
    for (let i = 0; i < 7; i++) s += R(-r * .55 + i * r * .17, -r * .35 + i * 2 * K, 1.6 * K, r * .7 - i * 4 * K, { fill: MINT, fa: n(1 - i * .12) })
  } else if (kind === 'mix') {
    s += Cc(0, 0, r, { fill: '#3C3228', fa: .7, stroke: SPACE, sa: .9, sw: n(1.4 * K), dash: `${n(r * 3.9)} ${n(r * 2.4)}` })
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * .38; s += P(`M0 ${n(r * .35)}L${n(Math.cos(a) * r * .8)} ${n(r * .35 + Math.sin(a) * r * .9)}`, { stroke: AMBER, sa: .95, sw: n(.9 * K) }) }
    for (let i = 1; i <= 3; i++) s += Cc(0, r * .35, r * .22 * i, { stroke: AMBER, sa: .7, sw: n(.8 * K) })
  }
  return G(s, `translate(${n(cx)} ${n(cy)})`)
}

/* ── the outline a region takes from what it holds. Recorded sound is read roughly (its name, how it moves) and given the
   outline of its kind: drums a plain rectangle; bass round at the foot; a voice round at the head; keys with a step out of
   one top corner; guitars with one corner folded down; effects with their corners bitten out. Notes have all four corners
   cut. The upright edges never move, so where a region begins and ends stays exact. Each corner is [kind, size, depth], in
   the order top-left, top-right, bottom-right, bottom-left; any of it can be set by hand. ── */
const SHAPES = {
  plain: [['sq'], ['sq'], ['sq'], ['sq']],
  bass: [['sq'], ['sq'], ['round', 7], ['round', 7]],
  keys: [['sq'], ['notch', 6, 7], ['sq'], ['sq']],
  gtr: [['sq'], ['cut', 9], ['sq'], ['sq']],
  vox: [['round', 7], ['round', 7], ['sq'], ['sq']],
  fx: [['bite', 5], ['bite', 5], ['bite', 5], ['bite', 5]],
  notes: [['cut', 3.5], ['cut', 3.5], ['cut', 3.5], ['cut', 3.5]],
}
const SHAPE_NAMES = ['plain', 'bass', 'keys', 'gtr', 'vox', 'fx', 'notes'], SHAPE_WORD = { plain: 'drums', bass: 'bass', keys: 'keys', gtr: 'guitar', vox: 'voice', fx: 'effects', notes: 'notes' }
const fitShape = (sh, w, h, k = 1) => sh.map(([kind, s = 0, v = 0]) => [kind, Math.min(s * k, w / 2.4, h / 2), Math.min(v * k, h / 2)])        // a short or a low region takes smaller corners
function shapePath (x, y, w, h, sh0, k = 1) {
  const [tl, tr, br, bl] = fitShape(sh0, w, h, k), X = x + w, Y = y + h, f = n
  let d = tl[0] === 'sq' ? `M${f(x)} ${f(y)}` : tl[0] === 'notch' ? `M${f(x)} ${f(y + tl[2])}H${f(x + tl[1])}V${f(y)}` : `M${f(x)} ${f(y + tl[1])}` + (tl[0] === 'cut' ? `L${f(x + tl[1])} ${f(y)}` : `A${f(tl[1])} ${f(tl[1])} 0 0 ${tl[0] === 'round' ? 1 : 0} ${f(x + tl[1])} ${f(y)}`)
  d += tr[0] === 'sq' ? `H${f(X)}` : `H${f(X - tr[1])}` + (tr[0] === 'notch' ? `V${f(y + tr[2])}H${f(X)}` : tr[0] === 'cut' ? `L${f(X)} ${f(y + tr[1])}` : `A${f(tr[1])} ${f(tr[1])} 0 0 ${tr[0] === 'round' ? 1 : 0} ${f(X)} ${f(y + tr[1])}`)
  d += br[0] === 'sq' ? `V${f(Y)}` : br[0] === 'notch' ? `V${f(Y - br[2])}H${f(X - br[1])}V${f(Y)}` : `V${f(Y - br[1])}` + (br[0] === 'cut' ? `L${f(X - br[1])} ${f(Y)}` : `A${f(br[1])} ${f(br[1])} 0 0 ${br[0] === 'round' ? 1 : 0} ${f(X - br[1])} ${f(Y)}`)
  d += bl[0] === 'sq' ? `H${f(x)}` : `H${f(x + bl[1])}` + (bl[0] === 'notch' ? `V${f(Y - bl[2])}H${f(x)}` : bl[0] === 'cut' ? `L${f(x)} ${f(Y - bl[1])}` : `A${f(bl[1])} ${f(bl[1])} 0 0 ${bl[0] === 'round' ? 1 : 0} ${f(x)} ${f(Y - bl[1])}`)
  return d + 'Z'
}
/* how far a corner reaches in from its edge, at a distance along that edge: the sound drawn inside keeps clear of it */
const cornerIn = ([k, s, v], dx) => dx >= s || k === 'sq' ? 0 : k === 'cut' ? s - dx : k === 'round' ? s - Math.sqrt(Math.max(0, s * s - (s - dx) * (s - dx))) : k === 'bite' ? Math.sqrt(Math.max(0, s * s - dx * dx)) : v
const roomOf = (sh0, w, h) => { const [tl, tr, br, bl] = fitShape(sh0, w, h); return dx => Math.max(cornerIn(tl, dx), cornerIn(tr, w - dx), cornerIn(br, w - dx), cornerIn(bl, dx)) }
