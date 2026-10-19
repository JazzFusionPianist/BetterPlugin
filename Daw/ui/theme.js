/* ── themes: a whole room put on at once ──
   His ask (2026-10-18) and his OK of draft 2 (design/themes draft 2, 2026-10-19: "ㅇㅇㅇㄱㄱㄱ"): besides the room as it
   comes, six themes built in, any of them changed and kept as one's own, written to a .sst file and opened again. A theme
   is a look (look.js): every quality of the room as a value, now with the type of the room (its face, its size, capitals,
   spacing, the face of names), its grounds (a pattern under the lanes, a texture over the whole window), and the marks on
   the lanes. Stage one of three: colour, type and ground; the parts that change their shape (where the transport stands,
   a level as a VU meter, the mixer as a console …) come next.
   This file: the faces the room carries (ui/fonts, all under the SIL Open Font License: fonts/OFL), the patterns, the
   texture over the window, and the six themes. look.js asks it to wear a look (themeWear) every time one is put on. */

/* the faces, each with the room's own after it (for the letters it lacks: Korean, signs) */
const THEME_FACES = {
  'instrument sans': { family: "'Instrument Sans'" },
  'plex condensed': { family: "'IBM Plex Sans Condensed'", file: [['ibm-plex-sans-condensed-normal-400-latin', 400], ['ibm-plex-sans-condensed-normal-500-latin', 500], ['ibm-plex-sans-condensed-normal-600-latin', 600]] },
  'archivo': { family: "'Archivo'", file: [['archivo-normal-100-900-latin', '100 900', '62% 125%']] },
  'archivo wide': { family: "'Archivo'", stretch: 'expanded' },
  'garamond': { family: "'EB Garamond'", file: [['eb-garamond-normal-400-800-latin', '400 800'], ['eb-garamond-italic-400-800-latin', '400 800', null, 'italic']] },
  'jost': { family: "'Jost'", file: [['jost-normal-100-900-latin', '100 900']] },
  'plex mono': { family: "'IBM Plex Mono'", file: [['ibm-plex-mono-normal-400-latin', 400], ['ibm-plex-mono-normal-500-latin', 500]] },
  'courier': { family: "'Courier Prime'", file: [['courier-prime-normal-400-latin', 400], ['courier-prime-normal-700-latin', 700]] },
}
const TYPE_FACE_NAMES = Object.keys(THEME_FACES)
const ROOM_FACE = "'Instrument Sans', 'Pretendard Variable', 'Apple SD Gothic Neo', system-ui, sans-serif"
const faceChain = f => { const o = THEME_FACES[f]; return !o || f === 'instrument sans' ? ROOM_FACE : `${o.family}, ${ROOM_FACE}` }
/* the faces, made known to the page (once) */
;(function themeFaces () {
  const at = (document.currentScript && document.currentScript.src || '').replace(/[^/]*$/, '')
  let css = ''
  for (const f in THEME_FACES) for (const [file, weight, stretch, style] of THEME_FACES[f].file || []) css += `@font-face { font-family: ${THEME_FACES[f].family}; font-weight: ${weight}; font-style: ${style || 'normal'};${stretch ? ` font-stretch: ${stretch};` : ''} src: url(${at}fonts/${file}.woff2) format('woff2') }\n`
  const el = document.createElement('style'); el.id = 'theme-faces'; el.textContent = css; document.head.appendChild(el)
})()

/* ── the patterns: under the lanes, and over the whole window ── */
const GROUND_LANES = ['none', 'tape', 'ruled', 'paper', 'grid', 'dots']
const GROUND_OVER = ['none', 'grain', 'brushed', 'scanlines']
function themeNoise (seed, n, w, h, c, a0, a1, r0, r1) { let s = seed >>> 0 || 1; const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296 }; let o = ''; for (let i = 0; i < n; i++) o += `<circle cx="${n2(rnd() * w)}" cy="${n2(rnd() * h)}" r="${n2(r0 + rnd() * (r1 - r0))}" fill="${c}" fill-opacity="${n2(a0 + rnd() * (a1 - a0))}"/>`; return o }
const n2 = v => Math.round(v * 100) / 100
function themeDefs (lanesC, overA) {
  const c = lanesC.c, k = Math.max(.02, lanesC.a / 100)
  const P = (id, w, h, inner, more = '') => `<pattern id="${id}" width="${w}" height="${h}" patternUnits="userSpaceOnUse"${more}>${inner}</pattern>`
  let d = ''
  d += P('th-tape', 400, 6, `<rect width="400" height="1" fill="${c}" fill-opacity="${n2(k * .5)}"/><rect y="3" width="400" height=".6" fill="${c}" fill-opacity="${n2(k * .25)}"/>`)
  d += P('th-ruled', 40, 26, `<rect y="25.4" width="40" height=".7" fill="${c}" fill-opacity="${n2(k * 2.4)}"/>`)
  d += P('th-paper', 160, 160, themeNoise(11, 180, 160, 160, c, k * .6, k * 1.6, .3, .8))
  d += P('th-grid', 40, 40, [8, 16, 24, 32].map(v => `<path d="M${v} 0V40M0 ${v}H40" stroke="${c}" stroke-opacity="${n2(k * .7)}" stroke-width=".5"/>`).join('') + `<path d="M0 0V40M0 0H40" stroke="${c}" stroke-opacity="${n2(k * 1.6)}" stroke-width=".6"/>`)
  d += P('th-dots', 16, 16, `<circle cx="8" cy="8" r=".8" fill="${c}" fill-opacity="${n2(k * 2.5)}"/>`)
  const o = overA
  d += P('th-grain', 200, 200, themeNoise(7, 900, 200, 200, '#000000', .02 * o, .07 * o, .3, .7) + themeNoise(9, 500, 200, 200, '#FFFFFF', .015 * o, .05 * o, .3, .6))
  let br = ''
  for (let i = 0; i < 24; i++) br += `<rect y="${n2(i / 4)}" width="600" height=".25" fill="${i % 3 ? '#000000' : '#FFFFFF'}" fill-opacity="${n2((.02 + (i * 37 % 7) / 140) * o)}"/>`
  d += P('th-brushed', 600, 6, br)
  d += P('th-scanlines', 4, 3, `<rect width="4" height="1.1" fill="#000000" fill-opacity="${n2(.32 * o)}"/>`)
  return d
}
/* the pattern under the lanes, over their ground (ui.js pLanes) */
function themeLanesGround (x, y, w, h) {
  const g = typeof lk === 'function' ? lk('ground.lanes') : 'none'
  return g && g !== 'none' && GROUND_LANES.includes(g) ? `<rect x="${n2(x)}" y="${n2(y)}" width="${n2(Math.max(0, w))}" height="${n2(Math.max(0, h))}" fill="url(#th-${g})"/>` : ''
}
/* the defs and the texture over the window, in the room's own drawing */
function themeBoard () {
  const svg = document.getElementById('svg')
  if (!svg || !document.getElementById('g-lanes')) return
  let defs = document.getElementById('th-defs')
  if (!defs) { defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs'); defs.id = 'th-defs'; svg.insertBefore(defs, svg.firstChild) }
  defs.innerHTML = themeDefs(lk('ground.lanesC'), lkN('ground.overA') / 100)
  let over = document.getElementById('g-theme-over')
  if (!over) { over = document.createElementNS('http://www.w3.org/2000/svg', 'g'); over.id = 'g-theme-over'; over.setAttribute('pointer-events', 'none'); svg.appendChild(over) }
  const t = lk('ground.over')
  over.innerHTML = t && t !== 'none' && GROUND_OVER.includes(t) ? `<rect width="6000" height="4000" fill="url(#th-${t})"/>` : ''
}

/* ── a look worn: the type of the room, its grounds (look.js applyLook calls this before it draws again) ── */
const THEME_LOADED = new Set(['instrument sans'])
function themeWear () {
  const face = lk('type.face'), names = lk('type.names'), o = THEME_FACES[face] || {}
  FONT = faceChain(face)
  TF.names = names && names !== 'as the words' ? faceChain(names === 'garamond italic' ? 'garamond' : names) : null
  TF.namesIt = names === 'garamond italic'
  TF.caps = lk('type.case') === 'capitals'
  TF.space = lkN('type.space') || 0
  TF.scale = (lkN('type.size') || 100) / 100
  TF.stretch = o.stretch || ''
  document.documentElement.style.setProperty('--f', FONT)
  themeBoard()
  /* a face not yet loaded: what was measured with another is measured again once it is in */
  const want = [face, names === 'garamond italic' ? 'garamond' : names].filter(f => f && THEME_FACES[f] && !THEME_LOADED.has(f))
  if (want.length && document.fonts) Promise.all(want.map(f => Promise.all([400, 500, 600].map(w => document.fonts.load(`${w} 10px ${THEME_FACES[f].family}`).catch(() => null))).then(() => THEME_LOADED.add(f)))).then(() => { if (typeof dirtyAll === 'function') { if (typeof relayout === 'function') relayout(); dirtyAll() } })
}

/* ── the six themes (design/themes draft 2): each a look, as the room as it comes is changed to be it ── */
const thC = (c, a = 100) => ({ c, a })
const famAll = (deep, light) => Object.fromEntries(['drums', 'bass', 'keys', 'gtr', 'vox', 'fx'].flatMap(f => [[`fam.${f}.0`, thC(deep)], [`fam.${f}.1`, thC(light || deep)]]))
const THEMES = {
  /* a tape room of the seventies: bone panels, oxide tape, cream sound, a red grease pencil, labels typed */
  console: {
    'win.k1': thC('#E2D7C0'), 'win.k2': thC('#D8CCB1'), 'win.k3': thC('#CBBD9C'), 'win.k4': thC('#BCAC88'), 'lanes.k0': thC('#CFC3A6'), 'win.ink': thC('#2A231B'), 'win.lineK': 140, 'lanes.ground': thC('#1A130D'),
    'bars.ground': thC('#E2D7C0'), 'play.c': thC('#FFB547'), 'cycle.c': thC('#B3261E'), 'heads.ground': thC('#E2D7C0'), 'heads.mark': 4, 'heads.chosen': thC('#2A231B', 9),
    'lanes.ink': thC('#E8D5AC'), 'lanes.chosen': thC('#E8D5AC', 4), 'lanes.grid': 140,
    'reg.fill': thC('#4A3322'), 'reg.line': thC('#6A4C34'), 'reg.corners': 2, 'reg.shape': 'off', 'snd.c': thC('#E8D5AC'), 'name.c': thC('#EFCB62'), 'fade.c': thC('#E8D5AC'), 'chosen.fill': thC('#6E4C32'), 'chosen.line': thC('#FFB547'),
    'mean.rec': thC('#C0392B'), 'mean.solo': thC('#5DAA57'), 'mean.mon': thC('#E08A2E'), 'mean.level': thC('#2A231B'),
    'type.face': 'plex condensed', 'type.case': 'capitals', 'type.space': .6, 'type.names': 'courier',
    'ground.lanes': 'tape', 'ground.lanesC': thC('#E8D5AC', 7), 'ground.over': 'brushed', 'ground.overA': 80,
    'part.transport': 'a tape deck at the foot', 'part.meters': 'VU meters over the room', 'part.heads': 'labels, lamps, a knob', 'part.markers': 'tape flags', 'part.cycle': 'grease pencil', 'part.playhead': 'a tape head', 'part.mixer': 'a console', 'heads.size': 10.5,
  },
  /* a tape deck of the eighties: card and beige plastic, the label's stripes, pills of colour, typed names */
  cassette: {
    'win.k1': thC('#F5EEDD'), 'win.k2': thC('#E9DFCA'), 'win.k3': thC('#DCCFB4'), 'win.k4': thC('#CFC0A2'), 'lanes.k0': thC('#F7F1E2'), 'win.ink': thC('#2E2620'),
    'play.c': thC('#D62828'), 'cycle.c': thC('#2A9D8F'), 'heads.mark': 6, 'heads.chosen': thC('#2E2620', 7), 'lanes.ink': thC('#8FB0C4'), 'lanes.chosen': thC('#2A9D8F', 5),
    'fam.drums.0': thC('#E4572E'), 'fam.drums.1': thC('#F08A4B'), 'fam.bass.0': thC('#264653'), 'fam.bass.1': thC('#3B6E80'), 'fam.keys.0': thC('#2A9D8F'), 'fam.keys.1': thC('#5BBDAF'), 'fam.gtr.0': thC('#F3A712'), 'fam.gtr.1': thC('#F6C35A'), 'fam.vox.0': thC('#E4572E'), 'fam.vox.1': thC('#EE7B55'), 'fam.fx.0': thC('#5C8DA6'), 'fam.fx.1': thC('#8DB2C4'),
    'reg.corners': 7, 'reg.shape': 'off', 'reg.gap': 3, 'snd.c': thC('#FFFFFF', 92), 'name.c': thC('#FFFFFF'), 'fade.c': thC('#FFFFFF'),
    'mean.rec': thC('#D62828'), 'mean.solo': thC('#F3A712'), 'mean.level': thC('#2A9D8F'),
    'type.face': 'archivo', 'type.names': 'courier',
    'ground.lanes': 'ruled', 'ground.lanesC': thC('#8FB0C4', 22),
  },
  /* the song as an engraved page: paper and ink, no boxes, the sound in ink, a red pencil */
  score: {
    'win.k1': thC('#F7F2E7'), 'win.k2': thC('#F0EADC'), 'win.k3': thC('#E5DCC9'), 'win.k4': thC('#D8CDB6'), 'lanes.k0': thC('#F7F2E7'), 'win.ink': thC('#1D1A16'), 'win.lineK': 130,
    'play.c': thC('#B83A22'), 'cycle.c': thC('#B83A22'), 'heads.mark': 0, 'heads.size': 12, 'heads.chosen': thC('#1D1A16', 6), 'lanes.ink': thC('#1D1A16'), 'lanes.grid': 170, 'lanes.chosen': thC('#1D1A16', 3),
    ...famAll('#2B2620', '#5C554B'),
    'reg.fill': thC('#F7F2E7', 0), 'reg.line': thC('#1D1A16', 0), 'reg.shape': 'off', 'snd.c': thC('#1D1A16', 85), 'name.c': thC('#5C554B'), 'name.where': 'inside', 'fade.c': thC('#1D1A16'), 'chosen.fill': thC('#1D1A16', 8), 'chosen.line': thC('#B83A22'),
    'mean.rec': thC('#B83A22'), 'mean.solo': thC('#8A6A1E'), 'mean.mon': thC('#8A5A2A'),
    'type.face': 'garamond', 'type.size': 112, 'type.names': 'garamond italic',
    'ground.lanes': 'paper', 'ground.lanesC': thC('#5A4A30', 4), 'ground.over': 'grain', 'ground.overA': 60,
  },
  /* a poster of primary colours: red, blue, yellow and black on paper, the sound cut out of flat fields */
  bauhaus: {
    'win.k1': thC('#F1ECDF'), 'win.k2': thC('#E8E1D0'), 'win.k3': thC('#DCD4C0'), 'win.k4': thC('#CEC5AE'), 'lanes.k0': thC('#F1ECDF'), 'win.ink': thC('#151412'), 'win.lineK': 180,
    'play.c': thC('#D52B1E'), 'play.w': 2.5, 'cycle.c': thC('#F2C230'), 'heads.mark': 8, 'heads.size': 12, 'heads.chosen': thC('#151412', 7), 'lanes.ink': thC('#151412'), 'lanes.grid': 200, 'lanes.chosen': thC('#151412', 3),
    'fam.drums.0': thC('#D52B1E'), 'fam.drums.1': thC('#D52B1E'), 'fam.bass.0': thC('#1D4E9E'), 'fam.bass.1': thC('#1D4E9E'), 'fam.keys.0': thC('#F2C230'), 'fam.keys.1': thC('#F2C230'), 'fam.gtr.0': thC('#151412'), 'fam.gtr.1': thC('#151412'), 'fam.vox.0': thC('#D52B1E'), 'fam.vox.1': thC('#D52B1E'), 'fam.fx.0': thC('#1D4E9E'), 'fam.fx.1': thC('#1D4E9E'),
    'reg.shape': 'off', 'reg.gap': 3, 'snd.c': thC('#F1ECDF'), 'name.c': thC('#F1ECDF'), 'name.w': '600', 'fade.c': thC('#F1ECDF'), 'chosen.line': thC('#151412'),
    'mean.rec': thC('#D52B1E'), 'mean.solo': thC('#F2C230'), 'mean.mon': thC('#1D4E9E'), 'mean.level': thC('#D52B1E'),
    'type.face': 'jost', 'type.size': 104, 'type.names': 'jost',
  },
  /* the song as a drawing: cyanotype, a grid, everything in outline, a red pencil centre line */
  blueprint: {
    'win.k1': thC('#123D6B'), 'win.k2': thC('#0F3560'), 'win.k3': thC('#1C548F'), 'win.k4': thC('#2563A3'), 'lanes.k0': thC('#174A80'), 'win.ink': thC('#E8F1FF'), 'win.lineK': 160,
    'play.c': thC('#FF7A59'), 'cycle.c': thC('#E8F1FF'), 'heads.mark': 0, 'heads.chosen': thC('#E8F1FF', 9), 'lanes.ink': thC('#E8F1FF'), 'lanes.chosen': thC('#E8F1FF', 4),
    ...famAll('#E8F1FF', '#B9CDEA'),
    'reg.fill': thC('#174A80', 70), 'reg.line': thC('#E8F1FF', 90), 'reg.lineW': 1, 'reg.shape': 'off', 'snd.c': thC('#E8F1FF'), 'snd.drawn': 'line', 'snd.w': .8, 'name.c': thC('#E8F1FF'), 'fade.c': thC('#E8F1FF'), 'chosen.fill': thC('#2563A3'), 'chosen.line': thC('#FF7A59'),
    'mean.rec': thC('#FF7A59'), 'mean.solo': thC('#FFD36A'), 'mean.mon': thC('#FFB27A'),
    'type.face': 'plex condensed', 'type.case': 'capitals', 'type.space': .5, 'type.names': 'plex mono',
    'ground.lanes': 'grid', 'ground.lanesC': thC('#FFFFFF', 9),
  },
  /* the room as a terminal on an amber screen: one colour, one face of fixed width, the lines of a tube */
  phosphor: {
    'win.k1': thC('#0B0805'), 'win.k2': thC('#120C05'), 'win.k3': thC('#22170A'), 'win.k4': thC('#33230E'), 'lanes.k0': thC('#0B0805'), 'win.ink': thC('#FFB000'), 'win.lineK': 180,
    'bars.ground': thC('#0B0805'), 'play.c': thC('#FFB000'), 'cycle.c': thC('#FFB000'), 'heads.mark': 2, 'heads.chosen': thC('#FFB000', 10), 'lanes.ink': thC('#FFB000'), 'lanes.chosen': thC('#FFB000', 5),
    ...famAll('#FFB000', '#C98A00'),
    'reg.fill': thC('#FFB000', 7), 'reg.line': thC('#FFB000', 55), 'reg.shape': 'off', 'snd.c': thC('#FFB000'), 'name.c': thC('#FFB000'), 'fade.c': thC('#FFB000'), 'chosen.fill': thC('#FFB000', 22), 'chosen.line': thC('#FFB000'),
    'mean.rec': thC('#FF5A1F'), 'mean.solo': thC('#FFD060'), 'mean.mon': thC('#FF8A1F'), 'mean.level': thC('#FFB000'), 'slur.look': 'dark',
    'type.face': 'plex mono', 'type.names': 'plex mono', 'type.size': 96,
    'ground.over': 'scanlines', 'ground.overA': 100,
  },
}
const THEME_ORDER = ['console', 'cassette', 'score', 'bauhaus', 'blueprint', 'phosphor']
if (typeof module !== 'undefined') module.exports = { THEMES, THEME_ORDER, THEME_FACES }
