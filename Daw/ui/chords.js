/* ── chords: a progression made for a stretch of the song, as notes ──
   "코드 만들어줘" on the command line ("make chords"), with a stretch marked: a progression is picked from the ones
   songs are made of, set in the song's key, voiced so that each chord lies close to the one before it, and played in a
   rhythm that suits the tempo and the drums that are there. It is put on a track of notes as a region that is its notes
   and nothing else — to be pulled about on the notes page like any other.
   Nothing here was learnt from anywhere: the progressions are a list, and the rest is what a player of chords keeps to.
   Three things can be asked of it, a step at a time: darker or brighter, richer or plainer, more movement or less.
   Asked again (다시), the same stretch gets another one. A progression that is kept counts for itself, one that is
   asked again counts against itself, and one can be told to it (am f c g 기억해): that is all the taste it has, and
   it is kept with the program's own settings, not with a song. */
const CHORD = { dial: { dark: 0, rich: 0, move: 0 }, last: null, w: {}, own: [], recent: [], lastPat: '', rnd: Math.random, read: false }

/* a chord's kind: the notes it is, counted in semitones from its root */
const CH_Q = {
  '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9], add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14],
  9: [0, 4, 7, 10, 14], maj9: [0, 4, 7, 11, 14], m9: [0, 3, 7, 10, 14], sus4: [0, 5, 7], sus2: [0, 2, 7], '7sus4': [0, 5, 7, 10], '9sus4': [0, 5, 7, 10, 14],
  dim: [0, 3, 6], dim7: [0, 3, 6, 9], m7b5: [0, 3, 6, 10], aug: [0, 4, 8], 13: [0, 4, 7, 10, 14, 21], m11: [0, 3, 7, 10, 14, 17], 69: [0, 4, 7, 9, 14], '7b9': [0, 4, 7, 10, 13],
}
const CH_MINORISH = q => /^(m(?!aj)|dim)/.test(q)
/* the steps of a key, in semitones: a progression is written in steps (I, vi, bVII), so it is the same in every key. In a
   minor key the steps are the natural minor's own (III is the relative major, VII the whole step under the tonic). */
const CH_STEPS = { M: [0, 2, 4, 5, 7, 9, 11], m: [0, 2, 3, 5, 7, 8, 10] }
const CH_ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']
/* the progressions: [name, key (M major, m minor), a chord to a bar ("a,b": two in the bar; "-": the one before, held),
   how dark (0..1), how rich, how much it moves, how often it is met in songs]. */
const CH_LIST = [
  ['axis', 'M', 'I V vi IV', .30, 0, .5, 3], ['axis6', 'M', 'vi IV I V', .55, 0, .5, 3], ['fifties', 'M', 'I vi IV V', .15, 0, .5, 2],
  ['royal', 'M', 'IV V iii vi', .45, .1, .5, 2.6], ['four1', 'M', 'IV I V vi', .35, 0, .5, 2], ['one4', 'M', 'I IV vi V', .20, 0, .5, 2],
  ['rock', 'M', 'I IV V IV', .05, 0, .5, 1.2], ['plain', 'M', 'I IV I V', .05, 0, .5, 1.2], ['three', 'M', 'I iii IV V', .20, .1, .5, 1.4],
  ['six5', 'M', 'vi V IV V', .60, 0, .5, 1.6], ['rise', 'M', 'IV V vi -', .50, 0, .35, 1.6], ['fall', 'M', 'I V/VII vi IV', .30, .25, .5, 1.6],
  ['canon', 'M', 'I V vi iii IV I IV V', .25, .1, .5, 1.6], ['step', 'M', 'I V/VII vi I/V IV I/III ii V', .30, .3, .6, 1.3],
  ['circle', 'M', 'vi ii V I', .50, .15, .5, 1.5], ['third7', 'M', 'I III7 vi IV', .40, .5, .5, 1.8], ['royal7', 'M', 'IV V III7 vi', .50, .55, .5, 2],
  ['turn', 'M', 'Imaj7 vi7 ii7 V7', .25, .7, .5, 1.6], ['two5', 'M', 'ii7 V7 Imaj7 vi7', .30, .7, .5, 1.5], ['city', 'M', 'IVmaj7 V7 iii7 vi7', .45, .7, .5, 2.2],
  ['city8', 'M', 'IVmaj7 V7 iii7 vi7 ii7 V7 Imaj7 -', .40, .8, .5, 1.8], ['two', 'M', 'IVmaj7 III7 vi7 v7,I7', .55, .9, .6, 2],
  ['down7', 'M', 'IVmaj7 iii7 ii7 Imaj7', .35, .7, .5, 1.3], ['up7', 'M', 'ii7 iii7 IVmaj7 V7sus4', .30, .65, .5, 1.2], ['vamp', 'M', 'Imaj7 - IVmaj7 -', .20, .6, .1, 1.4],
  ['mixo', 'M', 'I bVII IV I', .35, .2, .5, 1.3], ['epic', 'M', 'I bVII bVI bVII', .60, .25, .5, 1], ['plagal', 'M', 'I - IV iv', .50, .4, .35, 1.3],
  ['lydian', 'M', 'I II IV I', .20, .4, .5, .7], ['six25', 'M', 'I VI7 ii7 V7', .25, .65, .5, 1.1], ['gospel', 'M', 'IV I/III ii7 V7sus4', .30, .6, .5, 1.1],
  ['pop9', 'M', 'Iadd9 V vi7 IVadd9', .30, .45, .5, 1.8], ['pop96', 'M', 'vi7 IVmaj7 Iadd9 V', .55, .5, .5, 1.8], ['minor4', 'M', 'IVmaj7 iv6 Imaj7 -', .50, .75, .35, 1],
  ['m-axis', 'm', 'i VI III VII', .50, 0, .5, 3], ['m-walk', 'm', 'i VII VI VII', .60, 0, .5, 2], ['m-rise', 'm', 'VI VII i -', .55, 0, .35, 2.4],
  ['m-circle', 'm', 'i iv VII III', .50, .1, .5, 1.8], ['m-plain', 'm', 'i iv v i', .85, 0, .5, 1], ['m-harm', 'm', 'i iv V i', .80, .2, .5, 1],
  ['m-anda', 'm', 'i VII VI V', .70, .2, .5, 1.8], ['m-three', 'm', 'i III VII VI', .45, 0, .5, 2], ['m-royal', 'm', 'VI VII v i', .50, .1, .5, 2.4],
  ['m-four', 'm', 'VI III VII i', .40, 0, .5, 1.8], ['m-rel', 'm', 'III VII i VI', .30, 0, .5, 1.8], ['m-hold', 'm', 'i - VI VII', .65, 0, .35, 1.5],
  ['m-deep', 'm', 'i - VI v', .85, 0, .35, 1.2], ['m-vamp', 'm', 'i - VII -', .60, 0, .1, 1], ['m-vamp6', 'm', 'i - VI -', .70, 0, .1, 1.2],
  ['m-dorian', 'm', 'i7 - IV7 -', .40, .5, .1, 1.4], ['m-soul', 'm', 'VImaj7 V7 i7 -', .60, .7, .35, 1.8], ['m-soul2', 'm', 'iv7 v7 i7 -', .60, .6, .35, 1.4],
  ['m-leaves', 'm', 'iv7 VII7 IIImaj7 VImaj7 iiø V7 i7 -', .60, .9, .5, 1.5], ['m-four5', 'm', 'iv7 VII7 IIImaj7 VImaj7', .45, .75, .5, 1.3],
  ['m-step', 'm', 'i III iv VI', .50, .1, .5, 1.2], ['m-turn', 'm', 'i VI iv V7', .70, .3, .5, 1.2], ['m-neo', 'm', 'i9 - iv9 -', .60, .85, .1, 1.2],
  ['m-city', 'm', 'VImaj7 VII7 v7 i7', .50, .75, .5, 1.8],
]

/* ── reading: a step of the key, a chord by its name, a key ── */
/* one chord written as a step of the key (IVmaj7, vi, bVII, V/VII) -> { root, q, bass } in semitones from the tonic */
function chordOfStep (tok, mode) {
  const m = /^([b#]?)(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)([^/]*)(?:\/([b#]?)(VII|VI|IV|V|III|II|I))?$/.exec(tok)
  if (!m) return null
  const st = CH_STEPS[mode], at = (acc, num) => (st[CH_ROMAN.indexOf(num.toUpperCase())] + (acc === 'b' ? -1 : acc === '#' ? 1 : 0) + 12) % 12
  const low = m[2] === m[2].toLowerCase(), sfx = m[3]
  const q = low ? ({ '': 'm', 7: 'm7', 9: 'm9', 6: 'm6', add9: 'madd9', 11: 'm11', '°': 'dim', dim: 'dim', 'ø': 'm7b5', '°7': 'dim7' })[sfx] : sfx === '+' ? 'aug' : sfx
  if (q == null || !CH_Q[q]) return null
  return { root: at(m[1], m[2]), q, bass: m[5] ? at(m[4], m[5]) : null }
}
/* a progression as it is written -> its bars, each a list of chords */
function chordBars (text, mode) {
  const bars = []
  for (const tok of String(text).trim().split(/\s+/)) {
    if (tok === '-') { if (!bars.length) return null; bars.push(bars[bars.length - 1].slice(-1).map(c => Object.assign({}, c))); continue }
    const cs = tok.split(',').map(x => chordOfStep(x, mode))
    if (cs.some(c => !c)) return null
    bars.push(cs)
  }
  return bars.length ? bars : null
}
const CH_PC = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }
/* a key as it is typed in the top bar or on the line: "a min", "Am", "f#m", "bb", "c major", "a마이너" -> { root, minor } */
function chordKeyOf (text) {
  const m = /^\s*([a-g])\s*([#♯b♭]?)\s*(.*?)\s*$/i.exec(String(text || ''))
  if (!m) return null
  const rest = m[3], low = rest.toLowerCase()
  let minor
  if (!rest) minor = false
  else if (rest === 'M' || /^(maj|major|메이저|장조)$/.test(low)) minor = false
  else if (/^(m|mi|min|minor|-|마이너|단조)$/.test(low)) minor = true
  else return null
  return { root: (CH_PC[m[1].toLowerCase()] + (/[#♯]/.test(m[2]) ? 1 : m[2] ? -1 : 0) + 12) % 12, minor }
}
const CH_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'], CH_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
/* does a key write its black keys as flats? (f, b flat, e flat… and the minors that share their signatures) */
const chordFlats = key => [5, 10, 3, 8, 1, 6].includes((key.root + (key.minor ? 3 : 0)) % 12)
function chordPcName (pc, key) {
  pc = ((pc % 12) + 12) % 12
  const d = (pc - key.root + 12) % 12, own = CH_STEPS[key.minor ? 'm' : 'M'].includes(d)
  return ((own ? chordFlats(key) : key.minor ? d === 1 : [1, 3, 8, 10].includes(d)) ? CH_FLAT : CH_SHARP)[pc]      // (a note from outside the key by what it is there: bVII is a flat, the leading note a sharp)
}
const chordKeyName = key => `${chordPcName(key.root, key).toLowerCase()} ${key.minor ? 'minor' : 'major'}`
/* a chord's name in a key, as it is written over a staff: Am7, F#m7b5, G/B */
const chordName = (c, key) => chordPcName(key.root + c.root, key) + c.q + (c.bass != null && c.bass !== c.root ? '/' + chordPcName(key.root + c.bass, key) : '')
/* a chord by its name (as the line has it, in small letters: am, fmaj7, bb, g/b) -> { pc, q, bass } with real pitches */
function chordOfName (word) {
  const m = /^([a-g])([#b]?)([^/]*)(?:\/([a-g])([#b]?))?$/.exec(word)
  if (!m) return null
  const alias = { min: 'm', '-': 'm', maj: '', major: '', ma7: 'maj7', min7: 'm7', '-7': 'm7', sus: 'sus4', '7sus': '7sus4', '°': 'dim', 'ø': 'm7b5', '+': 'aug' }
  const q = alias[m[3]] != null ? alias[m[3]] : m[3]
  if (!CH_Q[q]) return null
  const pc = (l, a) => (CH_PC[l] + (a === '#' ? 1 : a === 'b' ? -1 : 0) + 12) % 12
  return { pc: pc(m[1], m[2]), q, bass: m[4] ? pc(m[4], m[5]) : null }
}
/* the key a row of chords is in: the one they fit best, with the first of them as its tonic if that can be */
function chordKeyFor (cs) {
  let best = null, top = -1
  for (let root = 0; root < 12; root++) for (const minor of [false, true]) {
    const scale = new Set(CH_STEPS[minor ? 'm' : 'M'].map(s => (root + s) % 12))
    let k = 0
    for (const c of cs) k += CH_Q[c.q].every(i => scale.has((c.pc + i) % 12)) ? 2 : scale.has(c.pc) ? 1 : 0
    if (cs[0].pc === root && CH_MINORISH(cs[0].q) === minor) k += 1.5
    const end = cs[cs.length - 1]
    if (end.pc === root || end.pc === (root + 7) % 12) k += .5
    if (k > top) { top = k; best = { root, minor } }
  }
  return best
}
/* the key of the notes that are in the song (what is played on its tracks of notes, drums apart): the major or minor key
   whose own weights lie closest to how long each of the twelve keys sounds. Null with too little to go by. */
function chordKeyHeard () {
  const h = new Array(12).fill(0)
  let n = 0
  for (const t of S.tracks) { if (!t.inst || t.inst.kind === 'drums') continue; for (const r of t.regs) if (r.notes && !r.mute) for (const x of r.notes) { h[(((x.n + (r.tr || 0)) % 12) + 12) % 12] += Math.min(4, x.d); n++ } }
  if (n < 8) return null
  const MA = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88], MI = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
  const mean = a => a.reduce((s, x) => s + x, 0) / a.length, hm = mean(h)
  const corr = (p, root) => { const pm = mean(p); let a = 0, b = 0, c = 0; for (let i = 0; i < 12; i++) { const x = h[(i + root) % 12] - hm, y = p[i] - pm; a += x * y; b += x * x; c += y * y } return b && c ? a / Math.sqrt(b * c) : 0 }
  let best = null, top = -2
  for (let root = 0; root < 12; root++) for (const minor of [false, true]) { const k = corr(minor ? MI : MA, root); if (k > top) { top = k; best = { root, minor } } }
  return best
}

/* ── what it has been told and what has been kept: read once from the program's settings, written back when it changes ── */
function chordTaste () {
  if (CHORD.read || typeof NAT === 'undefined') return
  CHORD.read = true
  if (!NAT) return
  NAT.call('prefGet').then(p => {
    const c = p && p.chords
    if (!c || typeof c !== 'object') return
    if (c.w && typeof c.w === 'object') for (const k in c.w) if (isFinite(+c.w[k]) && CHORD.w[k] == null) CHORD.w[k] = clamp(+c.w[k], .2, 4)
    if (Array.isArray(c.own)) for (const o of c.own.slice(0, 200)) if (o && typeof o.s === 'string' && (o.m === 'M' || o.m === 'm') && chordBars(o.s, o.m) && !CHORD.own.some(x => x.s === o.s && x.m === o.m)) CHORD.own.push({ s: o.s, m: o.m })
  }).catch(() => {})
}
function chordKeep () { if (typeof NAT !== 'undefined' && NAT) NAT.call('prefSet', { key: 'chords', value: { w: CHORD.w, own: CHORD.own } }) }
const chordVote = (id, by) => { if (!id) return; CHORD.w[id] = clamp((CHORD.w[id] == null ? 1 : CHORD.w[id]) * by, .2, 4); chordKeep() }
/* every progression it can pick from: the list, and the ones it was told */
function chordAll () {
  const all = CH_LIST.map(([id, m, s, d, r, mv, w]) => ({ id, m, s, d, r, mv, w }))
  for (const o of CHORD.own) {
    const bars = chordBars(o.s, o.m), cs = bars.flat()
    all.push({ id: `own ${o.m} ${o.s}`, m: o.m, s: o.s, d: clamp(.25 + .5 * cs.filter(c => CH_MINORISH(c.q)).length / cs.length + (CH_MINORISH(cs[0].q) ? .1 : 0), 0, 1), r: cs.filter(c => CH_Q[c.q].length > 3).length / cs.length * .8, mv: clamp(.5 * cs.length / bars.length, .1, 1), w: 2.5 })
  }
  return all
}
/* one of several, each as likely as its weight */
function chordDraw (list, weight) {
  const ws = list.map(weight), sum = ws.reduce((a, b) => a + b, 0)
  if (!(sum > 0)) return list[Math.floor(CHORD.rnd() * list.length)]
  let x = CHORD.rnd() * sum
  for (let i = 0; i < list.length; i++) { x -= ws[i]; if (x <= 0) return list[i] }
  return list[list.length - 1]
}
const chordNear = (x, t, s) => Math.exp(-(((x - t) / s) ** 2))

/* ── the colour of a chord: plainer or richer than it was written ──
   level 0: its three notes; 1: as written; 2: with the seventh the key gives it (a ninth laid on I and IV where the
   progression is a plain one); 3: ninths and thirteenths where the key has them. */
function chordColour (c, level, mode, plainOne, next) {
  const iv = CH_Q[c.q], scale = new Set(CH_STEPS[mode]), in_ = s => scale.has(((c.root + s) % 12 + 12) % 12)
  const third = iv.includes(3) ? 'm' : iv.includes(4) ? 'M' : 's', dim = iv.includes(6) && third === 'm', q = x => Object.assign({}, c, { q: x })
  if (level <= 0) return q(dim ? 'dim' : c.q === 'aug' ? 'aug' : third === 'm' ? 'm' : third === 'M' ? '' : iv.includes(5) ? 'sus4' : 'sus2')
  if (level === 1 || c.q === 'aug' || c.q === 'dim7') return c
  const dom = iv.includes(10) && third === 'M', lead = third === 'M' && !in_(4)                   // (a major chord whose third is not the key's own leads somewhere: a dominant of another chord)
  const isV = third !== 'm' && c.root === 7
  let out = c.q
  if (iv.length === 3) {                                                                 // three notes: the seventh the key has over this root
    if (dim) out = 'm7b5'
    else if (third === 's') out = isV ? '7sus4' : c.q
    else if (third === 'm') out = 'm7'
    else if (isV || lead) out = plainOne && isV && mode === 'M' ? '' : '7'
    else if (plainOne && (c.root === 0 || c.root === 5) && CHORD.rnd() < .45) out = 'add9'
    else out = in_(11) ? 'maj7' : in_(10) ? '7' : 'maj7'
  }
  if (level >= 3) {
    const ninth = in_(14)
    if (out === 'maj7' && ninth) out = 'maj9'
    else if (out === 'm7' && ninth) out = 'm9'
    else if (out === '7') out = ninth ? (CHORD.rnd() < .4 ? '13' : '9') : next && CH_MINORISH(next.q) ? '7b9' : '7'
    else if (out === '7sus4' && ninth) out = '9sus4'
    else if (out === 'add9' && ninth && in_(11)) out = 'maj9'
    else if (out === '6' && ninth) out = '69'
  }
  return q(dom && !/^(7|9|13|7b9|7sus4|9sus4)$/.test(out) ? c.q : out)
}

/* ── the hand: which keys a chord is played on ──
   The low hand has the root (or the note written under the chord); the high hand the rest — without the root once the
   chord has four notes or more — as close to where it just was as the chord allows. */
function chordUpper (c) {
  const iv = CH_Q[c.q]
  if (c.bass != null && c.bass !== c.root) return iv.length <= 4 ? iv : iv.filter(i => i !== 7).slice(0, 4)
  if (iv.length <= 3) return iv
  if (iv.length <= 5) return iv.slice(1)
  return iv.filter(i => i !== 0 && i !== 7)
}
function chordVoice (c, key, prev) {
  const pcs = [...new Set(chordUpper(c).map(i => (key.root + c.root + i) % 12))].sort((x, y) => x - y), LO = 52, HI = 81, cands = []      // (in the order they lie on the keys: stacked from any one of them they are a close hand)
  for (let k = 0; k < pcs.length; k++) for (let o = 0; o < 2; o++) {
    let n = LO + ((pcs[k] - LO % 12 + 12) % 12) + 12 * o
    const v = [n]
    for (let j = 1; j < pcs.length; j++) { const pc = pcs[(k + j) % pcs.length]; n = n + ((pc - n % 12 + 12) % 12 || 12); v.push(n) }
    if (v[v.length - 1] <= HI) cands.push(v)
  }
  const dist = (A, B) => A.reduce((s, a) => s + Math.min(...B.map(b => Math.abs(a - b))), 0)
  let best = cands[0], low = Infinity
  for (const v of cands) {
    const top = v[v.length - 1]
    const leap = prev ? Math.abs(top - prev[prev.length - 1]) : 0
    let k = prev ? dist(prev, v) + dist(v, prev) + 1.2 * leap + (leap > 5 ? (leap - 5) ** 2 : 0) : Math.abs(top - 69)
    if (v[0] < 55) k += (55 - v[0]) * 1.5
    if (top > 76) k += (top - 76) * 2
    if (top < 62) k += (62 - top) * 1.5
    if (v.length > 1 && v[1] - v[0] <= 2 && v[0] < 58) k += 3                           // (two keys side by side low down: mud)
    k += CHORD.rnd() * .6
    if (k < low) { low = k; best = v }
  }
  return best
}
function chordBass (c, key, prev) {
  const pc = (key.root + (c.bass != null ? c.bass : c.root)) % 12
  if (prev == null) return pc <= 8 ? 36 + pc : 24 + pc                                    // (the first one between a1 and a flat 2; after it, the nearest of that name from a1 to d3)
  let best = 0, low = Infinity
  for (let n = 24 + pc; n <= 50; n += 12) { if (n < 33) continue; const k = Math.abs(n - prev); if (k < low) { low = k; best = n } }
  return best
}

/* ── the rhythm: how a bar of a chord is played ──
   Sixteen steps to a bar of four; each stroke is [step, how long, which keys, how hard]: all of the chord, up (the high
   hand), bass, or one key of the high hand counted from the lowest (a0, a1…: a broken chord). A stroke marked next plays
   the coming bar's chord a little early and is held into it. [name, tempo it sits well from, to, how busy, strokes] */
const CH_PATS = [
  ['pad', 40, 240, 0, [[0, 16, 'all', 1]]],
  ['half', 40, 240, .15, [[0, 8, 'all', 1], [8, 8, 'up', .86]]],
  ['late', 40, 240, .2, [[0, 12, 'all', 1], [12, 4, 'up', .84]]],
  ['neo', 56, 98, .3, [[0, 10, 'all', 1], [10, 6, 'up', .86]]],
  ['ballad', 54, 100, .35, [[0, 16, 'bass', 1], [0, 4, 'up', .95], [4, 4, 'up', .8], [8, 4, 'up', .88], [12, 4, 'up', .8]]],
  ['tres', 84, 136, .4, [[0, 6, 'all', 1], [6, 6, 'all', .88], [12, 4, 'all', .92]]],
  ['push', 76, 128, .45, [[0, 8, 'bass', 1], [8, 6, 'bass', .85], [0, 6, 'up', .95], [6, 8, 'up', .85], [14, 2, 'up', .9, 'next']]],
  ['off', 90, 136, .45, [[0, 4, 'bass', 1], [8, 4, 'bass', .9], [2, 2, 'up', .88], [6, 2, 'up', .84], [10, 2, 'up', .88], [14, 2, 'up', .84]]],
  ['four', 98, 142, .5, [[0, 4, 'bass', 1], [8, 4, 'bass', .9], [0, 2, 'up', .95], [4, 2, 'up', .82], [8, 2, 'up', .9], [12, 2, 'up', .82]]],
  ['house', 108, 136, .55, [[0, 6, 'bass', 1], [10, 6, 'bass', .85], [0, 2, 'up', .95], [3, 2, 'up', .8], [6, 3, 'up', .88], [10, 2, 'up', .9], [13, 2, 'up', .8]]],
  ['arp8', 58, 126, .55, [[0, 16, 'bass', 1], [0, 4, 'a0', .9], [2, 4, 'a1', .76], [4, 4, 'a2', .8], [6, 4, 'a1', .74], [8, 4, 'a3', .86], [10, 4, 'a1', .74], [12, 4, 'a2', .8], [14, 2, 'a1', .74]]],
  ['eight', 94, 152, .6, [[0, 8, 'bass', 1], [8, 8, 'bass', .9], [0, 2, 'up', .95], [2, 2, 'up', .7], [4, 2, 'up', .82], [6, 2, 'up', .7], [8, 2, 'up', .9], [10, 2, 'up', .7], [12, 2, 'up', .82], [14, 2, 'up', .72]]],
  ['arp16', 58, 112, .85, [[0, 8, 'bass', 1], [8, 8, 'bass', .88]].concat([0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 1].map((a, i) => [i, 2, 'a' + a, i % 4 ? .7 : .86]))],
]
/* the measures that are not four to a bar: a few plain ways each, written for their own count of sixteenths */
function chordPatsFor (steps) {
  if (steps === 16) return CH_PATS
  const beat = BEAT_16(), all = [['pad', 40, 240, 0, [[0, steps, 'all', 1]]]]
  if (steps === 8) return all.concat([['half', 40, 240, .3, [[0, 4, 'all', 1], [4, 4, 'up', .86]]], ['eight', 80, 160, .6, [[0, 8, 'bass', 1], [0, 2, 'up', .95], [2, 2, 'up', .72], [4, 2, 'up', .86], [6, 2, 'up', .72]]]])
  if (S.meter[1] === 8 && S.meter[0] % 3 === 0) {                                        // six, nine, twelve eighths: a pulse of three
    const pulses = S.meter[0] / 3, two = [[0, steps, 'bass', 1]], arp = [[0, steps, 'bass', 1]]
    for (let p = 0; p < pulses; p++) two.push([p * 6, 6, 'up', p ? .84 : .95])
    for (let e = 0; e * 2 < steps; e++) arp.push([e * 2, 4, 'a' + [0, 1, 2, 3, 2, 1][e % 6], e % 3 ? .74 : .88])      // (a broken chord in eighths, up and down again)
    return all.concat([['pulse', 40, 240, .3, two], ['arp8', 40, 200, .6, arp]])
  }
  const beats = [[0, steps, 'bass', 1]]
  for (let s = 0, k = 0; s < steps; s += beat, k++) beats.push([s, beat, 'up', k ? .8 : .95])
  return all.concat([['beats', 40, 240, .4, beats]])
}
/* where the kick falls in a bar, if a kit on the song plays one in or near the stretch (steps of a sixteenth) */
function chordKicks (a, b, steps) {
  const qb = QB(), here = new Set(), far = new Set()
  let any = false
  for (const t of S.tracks) {
    if (!t.inst || t.inst.kind !== 'drums') continue
    for (const r of t.regs) {
      if (!r.notes || r.mute) continue
      any = true
      const org = ((r.a - 1) - (r.off || 0)) * qb, into = r.a - 1 < b && r.b - 1 > a ? here : far
      for (const x of r.notes) if (x.n === 36 || x.n === 35) into.add(Math.round((((org + x.t) % qb) + qb) % qb * 4) % steps)
    }
  }
  return { any, hit: here.size ? here : far }
}
function chordPattern (a, b, steps) {
  const kicks = chordKicks(a, b, steps), tempo = S.tempo
  const want = clamp((kicks.any ? .38 : .5) + (tempo < 75 ? -.08 : tempo > 135 ? -.1 : 0) + .14 * CHORD.dial.move, .05, .95)
  return chordDraw(chordPatsFor(steps), ([id, lo, hi, busy, ev]) => {
    const off = tempo < lo ? lo - tempo : tempo > hi ? tempo - hi : 0, low = ev.filter(e => e[2] === 'all' || e[2] === 'bass')
    return Math.exp(-((off / 15) ** 2)) * chordNear(busy, want, .3) * (kicks.hit.size ? 1 + .6 * low.filter(e => kicks.hit.has(e[0])).length / Math.max(1, low.length) : 1) * (id === CHORD.lastPat ? .3 : 1)
  })
}
/* the notes: every bar's chords played the pattern's way. seq[bar] = [{ c, at (0..1 of the bar), up, bass }…] */
function chordNotes (seq, pat, steps) {
  const qb = QB(), q = qb / steps, out = [], ev = pat[4], jit = () => Math.round((CHORD.rnd() - .5) * 6)
  const put = (bar, s, len, keys, v) => { for (const n of keys) out.push(mkNote(+((bar * steps + s) * q).toFixed(4), +(len * q).toFixed(4), n, clamp(Math.round(v) + jit(), 20, 127))) }
  let tied = 0                                                                           // (how far into this bar the chord struck early at the end of the last one is still held)
  for (let bar = 0; bar < seq.length; bar++) {
    const cs = seq[bar], cuts = cs.map(x => Math.round(x.at * steps)), at = s => { let k = 0; for (let i = 0; i < cuts.length; i++) if (cuts[i] <= s) k = i; return k }
    const end = s => { const nx = cuts.find(x => x > s); return nx == null ? steps : nx }
    const strokes = ev.map(e => e.slice())
    for (const cut of cuts.slice(1)) if (!strokes.some(e => e[0] === cut && e[2] !== 'bass')) { const nx = Math.min(steps, ...ev.filter(e => e[0] > cut && e[2] !== 'bass').map(e => e[0])); strokes.push([cut, nx - cut, strokes.some(e => e[0] === cut && e[2] === 'bass') ? 'up' : 'all', .92]) }      // (a chord that comes in the middle of a bar is struck where it comes, whatever the pattern, and held to the pattern's next stroke)
    const tiedNow = tied
    tied = 0
    for (const [s, len, part, vel, mark] of strokes) {
      const nextBar = seq[bar + 1], early = mark === 'next' && nextBar && !chordSame(nextBar[0].c, cs[at(s)].c) ? nextBar[0] : null
      const x = early || cs[at(s)], hi = part === 'bass' ? [] : x.up, l = early ? steps - s : Math.min(len, end(s) - s)
      if (l <= 0) continue
      if (!early && tiedNow && part !== 'bass' && s < tiedNow) { if (part === 'all') put(bar, s, Math.min(len, end(s) - s), [x.bass], 90 * vel); continue }
      if (early) {
        const held = (ev.find(e => e[0] === 0 && (e[2] === 'up' || e[2] === 'all')) || [0, 4])[1]
        put(bar, s, l + held, hi, 82 * vel + 4); tied = held; continue
      }
      if (part === 'all') { put(bar, s, l, [x.bass], 90 * vel); put(bar, s, l, hi.slice(0, -1), 80 * vel); put(bar, s, l, hi.slice(-1), 86 * vel) }
      else if (part === 'bass') put(bar, s, l, [x.bass], 90 * vel)
      else if (part === 'up') { put(bar, s, l, hi.slice(0, -1), 80 * vel); put(bar, s, l, hi.slice(-1), 86 * vel) }
      else { const i = +part.slice(1); put(bar, s, l, [i < hi.length ? hi[i] : hi[i - hi.length] + 12], 84 * vel) }
    }
  }
  return out.sort((x, y) => x.t - y.t || x.n - y.n)
}

/* ── making one ── */
const chordSame = (x, y) => x.root === y.root && x.q === y.q && (x.bass == null ? x.root : x.bass) === (y.bass == null ? y.root : y.bass)
/* a progression's bars made to fill n bars: said over as often as it takes, each chord held twice as long where less
   movement is asked and there is the room, a chord laid between two where more is asked */
function chordFill (e, n, mode, level) {
  let unit = chordBars(e.s, e.m).map(b => b.map(c => chordColour(c, level, mode, e.r < .5, null)))
  const mv = CHORD.dial.move
  if (mv < 0 && n >= unit.length * 2) unit = unit.flatMap(b => [b, b.slice(-1)])
  if (mv > 0) unit = unit.map((b, i) => {
    const x = b[0], y = unit[(i + 1) % unit.length][0]
    if (b.length > 1 || chordSame(x, y) || (mv < 2 && i % 2 === 0)) return b
    const gap = (y.root - x.root + 12) % 12, xi = CH_Q[x.q], opts = []
    const between = [11, 10].map(d => (x.root + d) % 12).find(pc => CH_STEPS[mode].includes(pc))
    if ((gap === 9 || gap === 8) && x.bass == null && between != null) opts.push([x, Object.assign({}, x, { bass: between })])      // (down a third: the bass walks there, by the key's own note between)
    if (level >= 2 && !CH_Q[y.q].includes(6) && (y.root + 7) % 12 !== x.root) opts.push([x, { root: (y.root + 7) % 12, q: level >= 3 && CH_MINORISH(y.q) ? '7b9' : '7', bass: null }])      // (the chord that leads into the next one)
    if (x.root === 7 && xi.includes(4) && !xi.includes(10)) opts.push([Object.assign({}, x, { q: 'sus4' }), x])
    if (xi.length === 3 && x.bass == null) opts.push([x, Object.assign({}, x, { bass: (x.root + xi[1]) % 12 })])      // (the same chord with its third underneath)
    return opts.length ? opts[Math.floor(CHORD.rnd() * opts.length)] : b
  })
  const bars = []
  for (let i = 0; i < n; i++) bars.push(unit[i % unit.length].map(c => Object.assign({}, c)))
  /* said more than once, its last bar may turn back to the top: the chord that leads home in its second half */
  if (n >= unit.length * 2 && n % unit.length === 0 && bars[n - 1].length === 1 && CHORD.rnd() < .35) {
    const x = bars[n - 1][0], home = bars[0][0]
    if (x.root !== 7 && !(mode === 'm' && x.root === 10) && home.root !== 7) bars[n - 1] = [x, mode === 'M' ? { root: 7, q: level >= 2 ? '7' : '', bass: null } : { root: level >= 2 ? 7 : 10, q: level >= 2 ? '7' : '', bass: null }]
  }
  return bars
}
/* the key it is made in: the one asked for, the song's own, the one its notes are in, or the one it used last */
function chordKeyNow (asked) {
  if (asked) return asked
  const own = chordKeyOf(S.key)
  if (own) return own
  const heard = chordKeyHeard()
  if (heard) return heard
  if (CHORD.key) return CHORD.key
  return CHORD.rnd() < clamp(.5 + .25 * CHORD.dial.dark, 0, 1) ? { root: 9, minor: true } : { root: 0, minor: false }
}
/* a whole one: { key, id, pat, notes, names, chords } for n bars */
function chordMake (n, key, avoid, span) {
  const mode = key.minor ? 'm' : 'M', D = CHORD.dial, steps = Math.round(QB() * 4), level = clamp(1 + D.rich, 0, 3)
  const dark = clamp(.45 + .22 * D.dark, 0, 1), rich = clamp(.15 + .28 * D.rich, 0, 1), move = clamp(.5 + .2 * D.move, 0, 1)
  const e = chordDraw(chordAll().filter(x => x.m === mode), x => {
    const len = x.s.trim().split(/\s+/).length
    return x.w * (CHORD.w[x.id] == null ? 1 : CHORD.w[x.id]) * chordNear(x.d, dark, .28) * chordNear(x.r, rich, .3) * chordNear(x.mv, move, .35) * (len > n ? .15 : n % len ? .5 : 1) * (x.id === avoid ? 0 : CHORD.recent.includes(x.id) ? .08 : 1)
  })
  const bars = chordFill(e, n, mode, level)
  for (let i = 0; i < bars.length; i++) for (let j = 0; j < bars[i].length; j++) {                 // (a dominant is coloured by where it goes)
    const c = bars[i][j], nx = bars[i][j + 1] || (bars[i + 1] || bars[0])[0]
    if (level >= 3 && c.q === '7' && CH_MINORISH(nx.q) && (nx.root - c.root + 12) % 12 === 5) c.q = '7b9'
  }
  let up = null, bass = null
  const seq = bars.map(b => b.map((c, j) => { up = chordVoice(c, key, up); bass = chordBass(c, key, bass); return { c, at: j / b.length, up, bass } }))
  const pat = chordPattern(span ? span[0] : 0, span ? span[1] : n, steps)
  const names = [], chords = [], qb = QB()
  bars.forEach((b, i) => b.forEach((c, j) => { const nm = chordName(c, key); if (names[names.length - 1] !== nm) { names.push(nm); chords.push([+((i + j / b.length) * qb).toFixed(4), nm]) } }))
  return { key, id: e.id, pat: pat[0], notes: chordNotes(seq, pat, steps), names, chords, bars }
}

/* ── the line: what is asked, in the words it is asked in ── */
const CH_WORDS = {
  thing: ['chords', 'chord', 'progression', 'progressions', 'harmony', '코드진행', '코드', '진행', '프로그레션', '화성'],
  make: ['make', 'create', 'generate', 'suggest', 'write', 'give', 'add', 'new', '만들어', '만들', '추천', '깔아', '써', '넣어', '생성', '뽑아', '짜'],
  again: ['again', 'another', 'different', 'reroll', 're-roll', 'next', 'retry', '다시', '다른', '또', '새로', '바꿔'],
  dark: ['darker', 'dark', 'sadder', 'sad', 'moody', '어둡', '어두운', '어두워', '다크', '우울', '슬프', '슬픈'],
  bright: ['brighter', 'bright', 'happier', 'happy', '밝', '환하', '신나', '경쾌'],
  rich: ['richer', 'rich', 'jazzier', 'jazzy', 'fancier', 'fancy', 'colourful', 'colorful', '화려', '풍성', '풍부', '재즈', '세련', '복잡'],
  plain: ['plainer', 'plain', 'simpler', 'simple', 'cleaner', 'clean', '담백', '단순', '심플', '깔끔', '간단'],
  busy: ['busier', 'busy', 'moving', 'movement', '움직이', '바쁘', '자주'],
  calm: ['calmer', 'calm', 'stiller', 'still', 'slower', '가만히', '차분', '잔잔', '느긋', '천천히'],
  less: ['less', '덜'],
  reset: ['reset', 'normal', 'default', '기본', '보통', '원래'],
  like: ['like', 'good', 'nice', 'love', 'keep', '좋아', '좋다', '좋네', '좋은', '맘에', '마음에'],
  remember: ['remember', 'learn', 'memorize', 'memorise', '기억', '외워'],
  bar: ['bars', 'bar', '마디'],
  key: ['key', '키'],
  mode: ['major', 'maj', 'minor', 'min', '메이저', '마이너', '장조', '단조'],
  fill: ['a', 'an', 'the', 'some', 'me', 'please', 'pls', 'for', 'of', 'in', 'on', 'to', 'one', 'it', 'this', 'that', 'here', 'more', 'bit', 'little', 'slightly', 'much', 'with', 'and', 'but', 'make', '좀', '조금', '더', '약간', '훨씬', '많이', '이거', '이건', '이', '걸', '거', '것', '하나', '여기', '들어', '해줘', '해', '줘', '주세요', '줄래', '느낌', '한', '쪽', '식'],
}
const CH_ENDS = /^(을|를|은|는|이|가|도|로|으로|에|의|만|요|해|해줘|해줘요|해줄래|해주세요|해봐|줘|줘요|줄래|주세요|봐|하게|게|한|하고|이고|고|서|해서|짜리|쯤|정도|인데|은데|데|지만|으로다가|줘봐|해줘봐|줄래요)*$/
function chordWord (w) {
  for (const kind in CH_WORDS) for (const stem of CH_WORDS[kind]) {
    if (w === stem) return kind
    if (!/^[\x00-\x7f]+$/.test(stem) && w.startsWith(stem) && CH_ENDS.test(w.slice(stem.length))) return kind
  }
  return null
}
/* was the last thing the line did a progression? (then "다시", "더 어둡게" and "좋아" are about it) */
const chordFresh = () => !!(S.last && S.last.res && S.last.res.some(x => x.chords))
/* a line about chords -> the action it asks for; null when it is not one (the other readers have it then) */
function chordRead (s) {
  chordTaste()
  const words = s.replace(/[,.!?~]/g, ' ').split(/\s+/).filter(Boolean)
  const a = { do: 'chords' }, dial = { dark: 0, rich: 0, move: 0 }, names = []
  const told = words.some(w => chordWord(w) === 'remember')                               // (a line that tells it a progression: every word that is a chord's name is one, the letter a too)
  let thing = false, make = false, again = false, like = false, rem = false, less = false, keyRoot = null, reset = false
  for (let i = 0; i < words.length; i++) {
    const w = words[i], nx = words[i + 1] || ''
    if (told && chordOfName(w)) { names.push(w); continue }
    if (/^[a-g][#b]?$/.test(w) && chordWord(nx) === 'mode') { keyRoot = chordKeyOf(`${w} ${/^(minor|min|마이너|단조)/.test(nx) ? 'minor' : 'major'}`); i++; continue }      // (a letter and then major or minor: a key — and not the word "a")
    let m = /^(\d{1,2})(마디|bars?)?(.*)$/.exec(w)
    if (m && CH_ENDS.test(m[3]) && (m[2] || chordWord(words[i + 1] || '') === 'bar')) { a.bars = clamp(+m[1], 1, 64); if (!m[2]) i++; continue }
    const kind = chordWord(w)
    if (kind === 'thing') thing = true
    else if (kind === 'make') make = true
    else if (kind === 'again') again = true
    else if (kind === 'like') like = true
    else if (kind === 'remember') rem = true
    else if (kind === 'less') less = true
    else if (kind === 'reset') reset = true
    else if (kind === 'mode') return null
    else if (kind === 'dark' || kind === 'bright') { dial.dark += (kind === 'dark') !== less ? 1 : -1; less = false }
    else if (kind === 'rich' || kind === 'plain') { dial.rich += (kind === 'rich') !== less ? 1 : -1; less = false }
    else if (kind === 'busy' || kind === 'calm') { dial.move += (kind === 'busy') !== less ? 1 : -1; less = false }
    else if (kind === 'fill' || kind === 'bar' || kind === 'key') continue
    else {
      m = /^([a-g][#b]?(?:m|maj|min)?)(메이저|마이너|장조|단조)?(.*)$/.exec(w)
      const k = m && CH_ENDS.test(m[3]) && m[2] ? chordKeyOf(m[1].replace(/(maj|min|m)$/, '') + ' ' + m[2]) : null
      if (k) { keyRoot = k; continue }
      if (chordOfName(w)) { names.push(w); continue }
      return null
    }
  }
  if (rem) { if (names.length >= 2) return [Object.assign(a, { remember: names })]; if (names.length || !CHORD.last) return null; return [Object.assign(a, { like: true })] }
  const dials = dial.dark || dial.rich || dial.move, fresh = chordFresh()
  if (names.length > 1) return null
  if (names.length === 1) { const k = chordKeyOf(names[0]); if (!k || keyRoot) return null; keyRoot = k }      // (one chord's name on a line that makes chords: the key)
  if (!thing && !fresh) return null                                                     // (nothing here says chords, and the line was not just about them)
  if (like && !thing && !make && !again && !dials) return fresh ? [Object.assign(a, { like: true })] : null
  if (!thing && !make && !again && !dials && !reset && !keyRoot) return null
  if (keyRoot) a.key = keyRoot
  if (dials) a.dial = dial
  if (reset) a.reset = true
  if (again || (!thing && fresh) || (dials && fresh && !make)) a.again = true
  return [a]
}

/* ── carrying it out ── */
const CH_DIAL_WORD = { dark: ['brightest', 'brighter', '', 'darker', 'darkest'], rich: ['plainest', 'plainer', '', 'richer', 'richest'], move: ['calmest', 'calmer', '', 'busier', 'busiest'] }
/* the stretch it is made for, in bars from zero: what a marquee marks, or the cycle, or what is chosen, or so many bars
   from the bar the playhead is in — whole bars always */
function chordSpan (bars) {
  const whole = (x, y) => { const a = Math.floor(x + 1e-6), b = Math.max(a + 1, Math.ceil(y - 1e-6)); return [a, b] }
  if (S.marq && S.marq.b - S.marq.a >= MIN_LEN) return whole(S.marq.a, S.marq.b)
  if (bars) { const a = Math.floor(curPos() + 1e-6); return [a, a + bars] }
  if (S.cycle.on && S.cycle.b - S.cycle.a >= MIN_LEN) return whole(S.cycle.a, S.cycle.b)
  const rs = selRegs()
  if (rs.length) return whole(Math.min(...rs.map(x => x[0].a)) - 1, Math.max(...rs.map(x => x[0].b)) - 1)
  const a = Math.floor(curPos() + 1e-6)
  return [a, a + 8]
}
const chordPlays = t => !!(t && t.inst && t.inst.kind !== 'drums' && !t.theirs)
const chordFree = (t, a, b, but) => !t.regs.some(r => r !== but && r.a - 1 < b - 1e-9 && r.b - 1 > a + 1e-9)
function chordDo (a, out) {
  const word = (text, more) => out.push(Object.assign({ k: 'word', text }, more || {}))
  chordTaste()
  if (a.remember) {
    const cs = (a.remember || []).map(chordOfName)
    if (cs.length < 2 || cs.some(c => !c)) { word('couldn’t read those chords'); return true }
    const key = chordKeyOf(S.key) || chordKeyFor(cs), mode = key.minor ? 'm' : 'M', st = CH_STEPS[mode]
    const step = pc => { const d = (pc - key.root + 12) % 12, i = st.indexOf(d); return i >= 0 ? ['', CH_ROMAN[i]] : st.includes(d + 1) ? ['b', CH_ROMAN[st.indexOf(d + 1)]] : ['#', CH_ROMAN[st.indexOf(d - 1)]] }
    const s = cs.map(c => { const [acc, num] = step(c.pc), low = CH_MINORISH(c.q), sfx = low ? ({ m: '', m7: '7', m9: '9', m6: '6', madd9: 'add9', m11: '11', dim: '°', m7b5: 'ø', dim7: '°7' })[c.q] : c.q; return acc + (low ? num.toLowerCase() : num) + sfx + (c.bass != null && c.bass !== c.pc ? '/' + step(c.bass).join('') : '') }).join(' ')
    if (!chordBars(s, mode)) { word('couldn’t read those chords'); return true }
    if (!CHORD.own.some(x => x.s === s && x.m === mode)) CHORD.own.push({ s, m: mode })
    CHORD.w[`own ${mode} ${s}`] = 1.6
    chordKeep()
    word(asGiven(`kept in mind, in ${chordKeyName(key)}:  ${cs.map(c => chordName({ root: (c.pc - key.root + 12) % 12, q: c.q, bass: c.bass == null ? null : (c.bass - key.root + 12) % 12 }, key)).join('  ')}`))
    return true
  }
  if (a.like) { if (!CHORD.last) { word('no chords were made yet'); return true } chordVote(CHORD.last.id, 1.4); CHORD.last.voted = true; word('kept in mind', { chords: 1 }); return true }
  if (a.reset) CHORD.dial = { dark: 0, rich: 0, move: 0 }
  if (a.dial) for (const k of ['dark', 'rich', 'move']) CHORD.dial[k] = clamp(CHORD.dial[k] + (+a.dial[k] || 0), -2, 2)
  const L = CHORD.last, lt = L ? byId(L.track) : null, lr = lt ? lt.regs.find(r => r.id === L.reg) : null
  let span, t = null, r = null, avoid = ''
  if (a.again && lr) { span = [lr.a - 1, lr.b - 1]; t = lt; r = lr; avoid = L.id; if (!L.voted) chordVote(L.id, .85) }      // another one for the same stretch: the one it had counts a little against itself
  else {
    if (L && lr && !L.voted) { chordVote(L.id, 1.12); L.voted = true }                    // (the last one was left standing: it counts for itself)
    span = a.again && L ? L.span.slice() : chordSpan(a.bars)
    span[1] = Math.min(span[1], Math.floor(SONG_END + 1e-6))
    if (span[1] - span[0] < 1) { word('no room for chords there'); return true }
    const marked = S.marq && S.marq.b - S.marq.a >= MIN_LEN ? marqTracks().find(chordPlays) : null, lead = S.tracks[S.sel]
    t = marked || (chordPlays(lead) && chordFree(lead, span[0], span[1]) ? lead : null) || S.tracks.find(x => x.id === CHORD.track && chordPlays(x)) || null
    if (!t && S.tracks.length >= MAX_TRACKS) { word('no room for another track'); return true }
  }
  const n = Math.round(span[1] - span[0]), key = chordKeyNow(a.key ? { root: a.key.root, minor: !!a.key.minor } : null)
  const made = chordMake(n, key, avoid, span), name = made.names.join('  ').slice(0, 60)
  let fresh = false
  edit(() => {
    if (!t) { t = addTrack('midi', S.tracks.some(x => x.name === 'chords') ? null : 'chords', S.sel, { kind: 'synth', sound: 'e piano' }); normalizeOrder(); fresh = true }
    if (r) { setNotes(r, made.notes); r.name = name; r.chords = made.chords; delete r.tag }
    else { r = mkReg({ a: span[0] + 1, b: span[1] + 1, loop: false, notes: made.notes, name, chords: made.chords }); t.regs.push(r); settle([[r, t, span[0], span[1]]]) }
  })
  if (fresh) { birth(t); repaint() }
  CHORD.track = t.id; CHORD.key = key
  CHORD.recent.push(made.id); if (CHORD.recent.length > 6) CHORD.recent.shift()
  CHORD.lastPat = made.pat
  CHORD.last = { id: made.id, pat: made.pat, track: t.id, reg: r.id, span: span.slice(), voted: false }
  if (!S.key) { S.key = `${chordPcName(key.root, key).toLowerCase()} ${key.minor ? 'min' : 'maj'}`.slice(0, 8); uiDirty('top') }      // (the song had no key written on it: it has the one its chords are in)
  leadTrack(S.tracks.indexOf(t)); S.selR = [r.id]; S.selX = null; S.marq = null; S.focus = 'lanes'; showRow(S.sel)
  if (typeof rollOpen === 'function') rollOpen()
  const dials = ['dark', 'rich', 'move'].map(k => CH_DIAL_WORD[k][CHORD.dial[k] + 2]).filter(Boolean)
  word(asGiven(`${chordKeyName(key)}${dials.length ? ', ' + dials.join(', ') : ''}:  ${made.names.join('  ')}`), { step: 1, chords: 1 })
  uiDirty('lanes', 'dock', 'head', 'top')
  return true
}
addEventListener('load', () => setTimeout(chordTaste, 0))
