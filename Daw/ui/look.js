/* ── the look: every part of the room and every quality of it, as values ──
   His word on the first draft of display (2026-10-16): no themes chosen for him, all of the design his to set. So nothing
   here is a choice made for him: the room as it comes is the one starting point, and a look is only the qualities that
   were changed from it (LOOK: key → value; what is not in it is as it comes). Settings > display lists every part and
   every quality (settings.js, design/display draft 2, sheet 2); the room wears them: applyLook sets the kit's tones
   again, and each part that has values of its own reads them here (lk, lkC, lkA). A look is kept in the app's settings
   ('look'); the looks someone kept by name lie beside it ('looks'), and one can be written to a file and opened again.

   A quality: [key, label, kind, opts]. kind 'c' a colour — its value {c: '#RRGGBB' or null, a: 0…100}; c null is
   'as it comes', which may be a colour of the room's (opts.d) or one worked out from something else (opts.by names it:
   a region's fill is its family's). 'n' a number (opts.d, unit, min, max, step). 'p' one of a few (opts.items, opts.d). */

/* each family's pigment: two ends, [hue, lightness, strength] (oklch), laid from deep to light across the family's
   tracks (engine.js: swatch); buses are grey. Kept here so the settings window can name them without the engine. */
const PIGMENT = { drums: [[266, .40, .150], [236, .73, .085]], bass: [[302, .44, .135], [322, .60, .120]], keys: [[174, .48, .105], [146, .75, .090]], gtr: [[54, .56, .125], [92, .81, .125]], vox: [[36, .60, .175], [4, .81, .070]], fx: [[88, .86, .035], [88, .78, .030]] }
const PIG_ORDER = ['drums', 'bass', 'keys', 'gtr', 'vox', 'fx']
const BUS_GREY = [85, .62, .01]

/* the room as it comes: taken before any look is put on */
const COME = { k0: K0, k1: K1, k2: K2, k3: K3, k4: K4, ink: INK, rec: REC, solo: SOLO, mon: MON, pig: JSON.parse(JSON.stringify(PIGMENT)), shapes: JSON.parse(JSON.stringify(SHAPES)) }

/* a colour named by hex, as oklch [L, C, h] (the other way from kit.js: oklch) */
function hexOklch (hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim())
  if (!m) return null
  const v = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255).map(c => c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4))
  const l = Math.cbrt(.4122214708 * v[0] + .5363325363 * v[1] + .0514459929 * v[2]), mm = Math.cbrt(.2119034982 * v[0] + .6806995451 * v[1] + .1073969566 * v[2]), s = Math.cbrt(.0883024619 * v[0] + .2817188376 * v[1] + .6299787005 * v[2])
  const L = .2104542553 * l + .793617785 * mm - .0040720468 * s, a = 1.9779984951 * l - 2.428592205 * mm + .4505937099 * s, b = .0259040371 * l + .7827717662 * mm - .808675766 * s
  return [L, Math.sqrt(a * a + b * b), (Math.atan2(b, a) * 180 / Math.PI + 360) % 360]
}
const pigHex = e => oklch(e[1], e[2], e[0])
const famHex = (f, end) => pigHex(COME.pig[f][end])

/* the shapes each part may take: the word the look keeps, and the theme it comes from (skins.js draws them) */
const PART_KINDS = {
  transport: [['a bar at the top', 'plain'], ['a tape deck at the foot', 'console'], ['a cassette deck', 'cassette'], ['a title and a line of type', 'score'], ['a composition down the left', 'poster'], ['a title block', 'blueprint'], ['a terminal', 'terminal']],
  heads: [['as it comes', 'plain'], ['labels, lamps, a knob', 'console'], ['a cassette’s spine', 'cassette'], ['a score’s names', 'score'], ['numbers and shapes', 'poster'], ['balloons', 'blueprint'], ['a terminal’s lines', 'terminal']],
  markers: [['words', 'plain'], ['tape flags', 'console'], ['a J-card', 'cassette'], ['rehearsal marks', 'score'], ['shapes', 'poster'], ['section lines', 'blueprint'], ['a terminal’s', 'terminal']],
  cycle: [['a band', 'plain'], ['grease pencil', 'console'], ['a stripe', 'cassette'], ['repeat barlines', 'score'], ['a yellow rule', 'poster'], ['a dimension', 'blueprint'], ['a terminal’s', 'terminal']],
  playhead: [['as it comes', 'plain'], ['a tape head', 'console'], ['a red pencil', 'score'], ['a disc on a bar', 'poster'], ['a centre line', 'blueprint'], ['a terminal’s', 'terminal']],
  mixer: [['strips', 'plain'], ['a console', 'console'], ['sliders and lights', 'cassette'], ['bars and dots', 'poster'], ['an elevation', 'blueprint'], ['a terminal’s', 'terminal']],
  lanes: [['as they come', 'plain'], ['staves', 'score'], ['a drawing', 'blueprint']],
  sound: [['as it comes', 'plain'], ['blocks of text', 'terminal']],
}
/* the shapes offered: the room's own and those of the themes offered (theme.js THEME_ORDER); a look that wears another still wears it */
const PART_SHOWN = new Set(['plain', 'poster'])
const PART_WORDS = k => PART_KINDS[k].filter(x => PART_SHOWN.has(x[1])).map(x => x[0])
/* the faces a theme may give the room (theme.js carries them) and the grounds */
const LOOK_FACES = ['instrument sans', 'plex condensed', 'archivo', 'archivo wide', 'garamond', 'jost', 'plex mono', 'courier']
/* ── every part and every quality ── [group, [[part, say (what it reaches), [[head, [quality…]]…]]…]] */
const LOOK_TREE = [
  ['type', [
    ['the words', 'every word of the room', [
      ['', [
        ['type.face', 'face', 'p', { items: LOOK_FACES, d: 'instrument sans' }],
        ['type.size', 'size', 'n', { d: 100, unit: '%', min: 85, max: 120, step: 1 }],
        ['type.case', 'letters', 'p', { items: ['as written', 'capitals'], d: 'as written' }],
        ['type.space', 'space between letters', 'n', { d: 0, unit: 'px', min: 0, max: 3, step: .1 }],
      ]],
    ]],
    ['names', 'what someone named: tracks, regions, markers, the song', [
      ['', [['type.names', 'face', 'p', { items: ['as the words', 'courier', 'garamond italic', 'plex mono', 'jost', 'archivo'], d: 'as the words' }]]],
    ]],
  ]],
  ['the parts', [
    ['their shapes', 'what a theme may change the shape of', [
      ['', [
        ['part.transport', 'the transport', 'p', { items: PART_WORDS('transport'), d: 'a bar at the top' }],
        ['part.meters', 'meters over the room', 'p', { items: PART_SHOWN.has('console') ? ['none', 'VU meters over the room'] : ['none'], d: 'none' }],
        ['part.heads', 'a track’s head', 'p', { items: PART_WORDS('heads'), d: 'as it comes' }],
        ['part.headsAt', 'the heads stand', 'p', { items: ['at the left', 'at the right'], d: 'at the left' }],
        ['part.lanes', 'the lanes', 'p', { items: PART_WORDS('lanes'), d: 'as they come' }],
        ['part.sound', 'the sound', 'p', { items: PART_WORDS('sound'), d: 'as it comes' }],
        ['part.markers', 'the markers', 'p', { items: PART_WORDS('markers'), d: 'words' }],
        ['part.cycle', 'the cycle', 'p', { items: PART_WORDS('cycle'), d: 'a band' }],
        ['part.playhead', 'the playhead', 'p', { items: PART_WORDS('playhead'), d: 'as it comes' }],
        ['part.mixer', 'the mixer', 'p', { items: PART_WORDS('mixer'), d: 'strips' }],
      ].filter(q => q[3].items.length > 1)],      // (a part with no shape but its own to choose is not listed)
    ]],
  ]],
  ['background', [
    ['under the lanes', 'a pattern on the lanes’ ground', [
      ['', [
        ['ground.lanes', 'pattern', 'p', { items: ['none', 'tape', 'ruled', 'paper', 'grid', 'dots'], d: 'none' }],
        ['ground.lanesC', 'its colour', 'c', { d: COME.ink, a: 6 }],
      ]],
    ]],
    ['over the window', 'a texture over everything', [
      ['', [
        ['ground.over', 'texture', 'p', { items: ['none', 'grain', 'brushed', 'scanlines'], d: 'none' }],
        ['ground.overA', 'strength', 'n', { d: 100, unit: '%', min: 0, max: 300, step: 10 }],
      ]],
    ]],
  ]],
  ['the window', [
    ['its tones', 'every page of the room', [
      ['', [
        ['win.k1', 'ground', 'c', { d: COME.k1, note: 'the walls, the heads, the bars' }],
        ['win.k2', 'raised', 'c', { d: COME.k2, note: 'the top bar, the foot, menus' }],
        ['win.k3', 'a control at rest', 'c', { d: COME.k3 }],
        ['win.k4', 'a control under the hand', 'c', { d: COME.k4 }],
        ['lanes.k0', 'deepest', 'c', { d: COME.k0, note: 'the lanes, the patch' }],
      ]],
    ]],
    ['ink', 'every word and mark', [
      ['', [
        ['win.ink', 'words and marks', 'c', { d: COME.ink }],
        ['win.line', 'lines between', 'c', { by: 'the ink', show: () => COME.ink }],
        ['win.lineK', 'their strength', 'n', { d: 100, unit: '%', min: 0, max: 400, step: 5 }],
      ]],
    ]],
  ]],
  ['the bars and the playhead', [
    ['the bars', 'the bars over the lanes', [
      ['', [
        ['bars.ground', 'ground', 'c', { by: 'the window’s ground', show: () => K1 }],
        ['bars.size', 'numbers', 'n', { d: 8.5, unit: 'px', min: 6, max: 14, step: .5 }],
      ]],
    ]],
    ['the playhead', 'in every song', [
      ['', [
        ['play.c', 'colour', 'c', { by: 'the ink', show: () => INK }],
        ['play.w', 'width', 'n', { d: 1, unit: 'px', min: .5, max: 4, step: .5 }],
      ]],
    ]],
    ['the cycle', 'while it is on', [
      ['', [['cycle.c', 'colour', 'c', { by: 'solo’s', show: () => SOLO }]]],
    ]],
  ]],
  ['tracks’ heads', [
    ['a head', 'every track', [
      ['', [
        ['heads.ground', 'ground', 'c', { by: 'the window’s ground', show: () => K1 }],
        ['heads.mark', 'its colour, down the edge', 'n', { d: 3, unit: 'px', min: 0, max: 12, step: 1 }],
        ['heads.num', 'number', 'p', { items: ['on', 'off'], d: 'on' }],
        ['heads.size', 'name', 'n', { d: 10.5, unit: 'px', min: 8, max: 16, step: .5 }],
      ]],
    ]],
    ['the chosen head', 'the track that is chosen', [
      ['', [['heads.chosen', 'wash', 'c', { d: COME.ink, a: 7.5 }]]],
    ]],
  ]],
  ['the lanes', [
    ['the lanes', 'under every track', [
      ['', [
        ['lanes.alt', 'every other lane', 'c', { d: COME.ink, a: 0 }],
        ['lanes.chosen', 'the chosen lane', 'c', { d: COME.ink, a: 3.5 }],
        ['lanes.ground', 'their ground', 'c', { by: 'the deepest tone', show: () => K0, note: 'the lanes alone' }],
        ['lanes.ink', 'marks on them', 'c', { by: 'the ink', show: () => INK, note: 'every mark drawn on the lanes' }],
      ]],
    ]],
    ['the grid', 'bars and beats down the lanes', [
      ['', [
        ['lanes.grid', 'strength', 'n', { d: 100, unit: '%', min: 0, max: 400, step: 5 }],
        ['lanes.end', 'where the song ends', 'n', { d: 100, unit: '%', min: 0, max: 400, step: 5 }],
      ]],
    ]],
  ]],
  ['regions', [
    ['a region', 'every region in every song', [
      ['body', [
        ['reg.fill', 'fill', 'c', { by: 'its family’s', show: () => famHex('drums', 0), note: 'or one colour for all' }],
        ['reg.line', 'edge', 'c', { d: COME.ink, a: 0 }],
        ['reg.lineW', 'edge width', 'n', { d: 1, unit: 'px', min: .5, max: 4, step: .5 }],
        ['reg.corners', 'corners', 'n', { d: 0, unit: 'px', min: 0, max: 12, step: 1 }],
        ['reg.shape', 'shape by instrument', 'p', { items: ['on', 'off'], d: 'on' }],
        ['reg.gap', 'gap from the lane’s edge', 'n', { d: 1.5, unit: 'px', min: 0, max: 8, step: .5 }],
      ]],
    ]],
    ['its sound', 'the sound drawn on a region', [
      ['', [
        ['snd.c', 'colour', 'c', { by: 'deep of its fill', show: () => oklch(.13, .09, 266) }],
        ['snd.drawn', 'drawn', 'p', { items: ['filled', 'line', 'half'], d: 'filled' }],
        ['snd.w', 'line', 'n', { d: 1, unit: 'px', min: .5, max: 3, step: .25 }],
      ]],
    ]],
    ['its name', 'the name on a region', [
      ['', [
        ['name.c', 'colour', 'c', { by: 'deep of its fill', show: () => oklch(.13, .09, 266) }],
        ['name.size', 'size', 'n', { d: 7.5, unit: 'px', min: 6, max: 14, step: .5 }],
        ['name.w', 'weight', 'p', { items: ['400', '500', '600'], d: '500' }],
        ['name.where', 'where', 'p', { items: ['inside', 'none'], d: 'inside' }],
      ]],
    ]],
    ['fades', 'a region’s fades', [
      ['', [
        ['fade.c', 'line', 'c', { by: 'ink or dark, by its fill', show: () => INK }],
        ['fade.shade', 'shade', 'n', { d: 50, unit: '%', min: 0, max: 100, step: 5 }],
      ]],
    ]],
    ['when chosen', 'a region that is chosen', [
      ['', [
        ['chosen.fill', 'fill', 'c', { by: 'its fill, lighter', show: () => oklch(.57, .1, 266) }],
        ['chosen.line', 'edge', 'c', { d: COME.ink }],
      ]],
    ]],
  ]],
  ['the families', PIG_ORDER.map(f => [SHAPE_WORD[f === 'drums' ? 'plain' : f], 'its tracks, deep to light', [
    ['', [
      [`fam.${f}.0`, 'deep end', 'c', { d: famHex(f, 0) }],
      [`fam.${f}.1`, 'light end', 'c', { d: famHex(f, 1) }],
    ]],
  ]]).concat([['buses', 'every bus', [['', [['fam.bus', 'colour', 'c', { d: pigHex(BUS_GREY) }]]]]]])],
  ['meanings', [
    ['what a colour means', 'wherever it is shown', [
      ['', [
        ['mean.rec', 'recording', 'c', { d: COME.rec }],
        ['mean.solo', 'solo', 'c', { d: COME.solo }],
        ['mean.mon', 'listening to the input', 'c', { d: COME.mon }],
        ['mean.level', 'a level', 'c', { by: 'the ink', show: () => INK }],
      ]],
    ]],
  ]],
  ['slur', [
    ['the panel', 'slur, beside the lanes', [
      ['', [
        ['slur.look', 'its look', 'p', { items: ['by the ground', 'dark', 'light'], d: 'by the ground' }],
        ['slur.at', 'light when the ground is lighter than', 'n', { d: 60, unit: '%', min: 5, max: 95, step: 1 }],
      ]],
    ]],
  ]],
]
/* every quality by its key */
const QUAL = new Map()
for (const [, parts] of LOOK_TREE) for (const [, , heads] of parts) for (const [, qs] of heads) for (const q of qs) QUAL.set(q[0], q)

let LOOK = {}, LOOK_STAMP = 0
/* a quality's value: what the look says, else as it comes */
function lk (key) {
  const q = QUAL.get(key), v = LOOK[key]
  if (!q) return undefined
  if (q[2] === 'c') { const o = q[3]; return { c: v && v.c != null ? v.c : (o.d || null), a: v && v.a != null ? +v.a : (o.a == null ? 100 : o.a) } }
  return v != null ? v : q[3].d
}
/* a colour quality, as a colour: its own, or `by` (what it is worked out from), or as it comes */
const lkC = (key, by) => { const v = lk(key); return v.c || by || INK }
const lkA = key => clamp01l(lk(key).a / 100)
const lkN = key => +lk(key)
const clamp01l = v => Math.max(0, Math.min(1, v))
const looksChanged = (v = LOOK) => Object.keys(v).filter(k => QUAL.has(k)).length

/* a look, put on: the kit's tones, the families, the outlines; then the room is drawn again (where there is one) */
function applyLook (v) {
  LOOK = v && typeof v === 'object' ? v : {}
  K0 = lkC('lanes.k0'); K1 = lkC('win.k1'); K2 = lkC('win.k2'); K3 = lkC('win.k3'); K4 = lkC('win.k4'); INK = lkC('win.ink')
  REC = lkC('mean.rec'); SOLO = lkC('mean.solo'); MON = lkC('mean.mon'); LEVEL = lkC('mean.level', INK)
  LINE = lk('win.line').c; LINE_K = lkN('win.lineK') / 100
  for (const f of PIG_ORDER) for (const end of [0, 1]) {
    const c = LOOK[`fam.${f}.${end}`] && LOOK[`fam.${f}.${end}`].c, o = c && hexOklch(c)
    PIGMENT[f][end] = o ? [o[2], o[0], o[1]] : COME.pig[f][end].slice()
  }
  const bus = LOOK['fam.bus'] && LOOK['fam.bus'].c && hexOklch(LOOK['fam.bus'].c)
  BUS_GREY[0] = bus ? bus[2] : 85; BUS_GREY[1] = bus ? bus[0] : .62; BUS_GREY[2] = bus ? bus[1] : .01
  const r = lkN('reg.corners'), byKind = lk('reg.shape') === 'on'
  for (const k in COME.shapes) SHAPES[k] = (byKind ? COME.shapes[k] : COME.shapes.plain).map(c => c[0] === 'sq' && r > 0 ? ['round', r] : c.slice())
  if (typeof GRID_A === 'object') { if (!applyLook.grid) applyLook.grid = Object.assign({}, GRID_A); const g = lkN('lanes.grid') / 100; for (const k in applyLook.grid) GRID_A[k] = applyLook.grid[k] * g }
  LOOK_STAMP++
  if (typeof themeWear === 'function') themeWear()                             // (the type and the grounds: theme.js)
  const st = document.documentElement.style
  st.setProperty('--k1', K1); st.setProperty('--k2', K2); st.setProperty('--ink', INK)
  if (typeof repaint === 'function' && typeof S === 'object' && S.tracks) repaint()
  if (typeof dirtyAll === 'function') { if (typeof relayout === 'function') relayout(); dirtyAll() }
  slurLookNow()
}
/* how light a colour is, 0…1 (oklab's L) */
const lightOf = hex => { const o = hexOklch(hex); return o ? o[0] : 0 }
/* slur's panel follows the room: dark, unless it is asked to be light, or the ground has grown lighter than the mark */
function slurLookNow () {
  if (typeof NAT === 'undefined' || !NAT || typeof S !== 'object') return
  const how = lk('slur.look'), light = how === 'light' || (how === 'by the ground' && lightOf(K1) * 100 > lkN('slur.at'))
  if (slurLookNow.was === light) return
  slurLookNow.was = light
  NAT.call('slurLook', { light: light ? 1 : 0 })
}
/* where the look is worn: the room puts on the kept one as it opens, and another whenever settings > display changes it.
   (The settings window itself stays as the room comes — LOOK_PLAIN — so a look can always be undone from there.) */
if (!window.LOOK_PLAIN && window.__JUCE__ && window.__JUCE__.backend) window.__JUCE__.backend.addEventListener('dawLook', d => { if (d) applyLook(d.look) })
if (!window.LOOK_PLAIN) addEventListener('load', async () => {
  const p = typeof NAT !== 'undefined' && NAT ? await NAT.call('prefGet') : null
  applyLook(p && p.look)
})
