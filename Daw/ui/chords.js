/* ── chords: the chords that are typed, written out as notes ──
   A line of chord names on the command line —  Dm7(9)  G7(b9,13)  CM7(9)  A7(b13)  — is written into the song as the
   notes of those chords and no others. A name to a bar; or, with the bars drawn ( | Dm7 G7 | CM7 - A7 - | ), the names
   of a bar share it: two halve it, four are a beat each, and a dash holds the one before. Nothing is chosen for whoever
   types them: not a chord, not a tension, not a rhythm. Each chord is held for as long as it stands. Its lowest note is
   its root, or the note written under it; the hand above has the rest of it, laid as close to where it just was as the
   chord allows, and with no two of its notes a half step apart side by side where another way of laying them avoids it.
   A name is read as it is written over a staff, capitals and all: C is a root, M is major and m is minor (CM7, Cm7);
   tensions stand after the chord or in brackets (C7b9, C7(b9,13), CM7(9,#11)). */
const CHORD = { track: null }
const CH_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const chordPc = (letter, acc) => (CH_PC[letter] + (acc === '#' ? 1 : acc === 'b' ? -1 : 0) + 12) % 12
/* what is added over a chord, by its number: the semitones it lies above the root */
const CH_OVER = { 2: 14, 4: 17, 6: 9, 9: 14, 11: 17, 13: 21 }
const CH_BENT = { b5: [7, 6], '#5': [7, 8], b9: [14, 13], '#9': [14, 15], '#11': [17, 18], b13: [21, 20] }      // an altered note: the plain one it stands in for, and where it lies

/* a chord by its name -> { pc (its root), iv (its notes, in semitones above the root), bass (the note written under it, or null) };
   null for a name that cannot be read */
function chordOfName (word) {
  const w = String(word).replace(/♯/g, '#').replace(/♭/g, 'b').replace(/[△Δ](?=\d)/g, 'maj').replace(/[△Δ]/g, 'maj7').replace(/ø7?/g, 'm7b5').replace(/°/g, 'dim')
  const m = /^([A-G])([#b]?)(.*)$/.exec(w)
  if (!m) return null
  let rest = m[3].replace(/6\/9/g, '69'), bass = null
  const under = /\/([A-G])([#b]?)$/.exec(rest)
  if (under) { bass = chordPc(under[1], under[2]); rest = rest.slice(0, under.index) }
  let third = 4, fifth = 7, sev = null, major = false, dim = false, num = 0
  const over = new Set()
  const eat = re => { const x = re.exec(rest); if (x) rest = rest.slice(x[0].length); return x }
  const bend = (acc, n) => { const k = (acc === '+' ? '#' : acc === '-' ? 'b' : acc) + n, b = CH_BENT[k]; if (!b) return false; if (b[0] === 7) fifth = b[1]; else { if (n !== '9') over.delete(b[0]); else over.delete(14); over.add(b[1]) } return true }
  /* one thing said of the chord after its kind and number: sus, add, omit, an altered note, or a bracket of them */
  const more = () => {
    let x
    if ((x = eat(/^sus(2|4)?/))) { third = null; over.add(x[1] === '2' ? 2 : 5); return true }
    if ((x = eat(/^add(2|4|6|9|11|13)/))) { over.add(CH_OVER[x[1]]); return true }
    if ((x = eat(/^(?:omit|no)(3|5)/))) { if (x[1] === '3') third = null; else fifth = null; return true }
    if (eat(/^alt/)) { fifth = null; over.delete(14); over.add(13); over.add(20); if (sev == null) sev = 10; return true }
    if ((x = eat(/^(?:maj|Maj|M)7/))) { sev = 11; return true }
    if ((x = eat(/^([b#+-])(5|9|11|13)/))) return bend(x[1], x[2])
    if (eat(/^\+/)) { fifth = 8; return true }
    if ((x = eat(/^(13|11|9|7|6)/))) { if (x[1] === '7') sev = major ? 11 : 10; else over.add(CH_OVER[x[1]]); return true }
    return false
  }
  /* its kind */
  let x = eat(/^m(?:in)?\(?(?:maj|Maj|M)(7|9|11|13)\)?/)                                 // minor with a major seventh: CmM7, Cm(maj7)
  if (x) { third = 3; major = true; num = +x[1] }
  else {
    if (eat(/^(?:maj|Maj|MAJ|ma(?![a-z])|M)/)) major = true
    else if (eat(/^(?:min|mi(?![a-z])|m|-)/)) third = 3
    else if (eat(/^(?:dim|o(?=7|$))/)) { third = 3; fifth = 6; dim = true }
    else if (eat(/^(?:aug|\+)/)) fifth = 8
    x = eat(/^(69|13|11|9|7|6|5|4|2)/)
    if (x) num = +x[1]
  }
  /* its number: what stands under the tensions it names */
  const seventh = major ? 11 : dim ? 9 : 10
  if (num === 7) sev = seventh
  else if (num === 9) { sev = seventh; over.add(14) }
  else if (num === 11) { sev = seventh; over.add(14); over.add(17); if (third === 4) third = null }      // (an eleventh over a major third is played without the third)
  else if (num === 13) { sev = seventh; over.add(14); over.add(21) }
  else if (num === 6) over.add(9)
  else if (num === 69) { over.add(9); over.add(14) }
  else if (num === 5) third = null
  else if (num === 4) { third = null; over.add(5) }
  else if (num === 2) over.add(14)
  /* and whatever is said after it */
  while (rest) {
    const br = eat(/^\(([^)]*)\)/)
    if (br) {
      for (const item of br[1].split(/[,\s]+/).filter(Boolean)) { const was = rest; rest = item; const ok = more() && !rest; rest = was; if (!ok) return null }
      continue
    }
    if (!more()) return null
  }
  const iv = [0]
  if (third != null) iv.push(third)
  if (fifth != null) iv.push(fifth)
  if (sev != null) iv.push(sev)
  for (const o of over) iv.push(o)
  return { pc: chordPc(m[1], m[2]), iv: [...new Set(iv)].sort((a, b) => a - b), bass: bass != null && bass !== chordPc(m[1], m[2]) ? bass : null }
}

/* ── the hands: which keys a chord is played on ──
   The low hand has the root, or the note written under the chord. The high hand has the rest: without the root once
   there are three other notes to play, and without the fifth, then the root, when it would be more than five. */
function chordUpper (c) {
  let iv = c.iv.slice()
  if (c.bass == null && iv.length > 3) iv = iv.filter(i => i !== 0)
  if (iv.length > 5) iv = iv.filter(i => i !== 7)
  if (iv.length > 5) iv = iv.filter(i => i !== 0)
  return iv.slice(0, 5)
}
/* the high hand's keys: its notes in the order they lie on the keyboard, stacked from any one of them, in the octave
   that leaves the hand nearest to where it was. Where every such way leaves a half step side by side (a fifth beside a
   raised eleventh or a lowered thirteenth), the ways without the fifth are tried too. */
function chordVoice (c, prev) {
  const full = chordUpper(c), LO = 52, HI = 84, cands = []
  for (const iv of [full].concat(full.includes(7) && full.length > 4 ? [full.filter(i => i !== 7)] : [])) {
    const pcs = [...new Set(iv.map(i => (c.pc + i) % 12))].sort((x, y) => x - y)
    for (let k = 0; k < pcs.length; k++) for (let o = 0; o < 2; o++) {
      let n = LO + ((pcs[k] - LO % 12 + 12) % 12) + 12 * o
      const v = [n]
      for (let j = 1; j < pcs.length; j++) { const pc = pcs[(k + j) % pcs.length]; n = n + ((pc - n % 12 + 12) % 12 || 12); v.push(n) }
      if (v[v.length - 1] <= HI) { v.less = iv !== full; cands.push(v) }
    }
  }
  const dist = (A, B) => A.reduce((s, a) => s + Math.min(...B.map(b => Math.abs(a - b))), 0)
  let best = cands[0], low = Infinity
  for (const v of cands) {
    const top = v[v.length - 1], leap = prev ? Math.abs(top - prev[prev.length - 1]) : 0
    let k = prev ? (dist(prev, v) + dist(v, prev)) / v.length * 4 + 1.2 * leap + (leap > 5 ? (leap - 5) ** 2 : 0) : Math.abs(top - 69)
    for (let i = 1; i < v.length; i++) if (v[i] - v[i - 1] === 1) k += i === v.length - 1 ? 14 : 9      // (a half step side by side; worst at the top)
    if (v.less) k += 5                                                                  // (a note of the chord left out: only to be rid of a half step)
    if (v[0] < 55) k += (55 - v[0]) * 1.5
    if (top > 77) k += (top - 77) * 2
    if (top < 62) k += (62 - top) * 1.5
    if (v.length > 1 && v[1] - v[0] <= 2 && v[0] < 58) k += 3                           // (two keys side by side low down: mud)
    if (k < low) { low = k; best = v }
  }
  return best.slice()
}
/* the low hand's key: the first one between a1 and a flat 2; after it the nearest of its name from a1 to d3 */
function chordBass (c, prev) {
  const pc = c.bass != null ? c.bass : c.pc
  if (prev == null) return pc <= 8 ? 36 + pc : 24 + pc
  let best = 0, low = Infinity
  for (let n = 24 + pc; n <= 50; n += 12) { if (n < 33) continue; const k = Math.abs(n - prev); if (k < low) { low = k; best = n } }
  return best
}

/* ── the line ── */
const CH_HOLD = /^(?:-|–|—|%|_|\.)$/
/* a line of chord names -> the action that writes them; null when the line is not one (the other readers have it then).
   A word that begins with a capital A to G is not a chord by that alone: most of them must read as chords. */
function chordLine (raw) {
  let s = String(raw || '').trim()
  if (!/[A-G]/.test(s)) return null
  s = s.replace(/\(([^)]*)\)/g, (all, inner) => '(' + inner.replace(/\s+/g, '') + ')')      // ("b9, 13" in its bracket is one word)
  let names = 0, tried = 0, bad = ''
  const one = w => { if (CH_HOLD.test(w)) return '-'; if (!/^[A-G]/.test(w)) return null; tried++; if (chordOfName(w)) names++; else if (!bad) bad = w; return w }
  const bars = []
  if (s.includes('|')) { for (const part of s.split('|')) { const ws = part.trim().split(/\s+/).filter(Boolean); if (!ws.length) continue; const b = ws.map(one); if (b.includes(null)) return null; bars.push(b) } }
  else for (const w of s.split(/\s+/)) { const x = one(w); if (x == null) return null; bars.push([x]) }
  if (!names || names * 2 < tried) return null
  if (tried === 1 && bars.length === 1 && (S.tracks.some(t => t.name.toLowerCase() === s.toLowerCase()) || SCENES.some(sc => String(sc.name).toLowerCase() === s.toLowerCase()))) return null      // (a track or a marker of that very name is what is meant)
  if (bad) return [{ do: 'note', text: asGiven(`couldn’t read the chord ${bad}`) }]
  return [{ do: 'chords', bars }]
}

/* ── carrying it out ── */
/* can a track play chords? one of notes that is not a kit, and not a sound of the synth's that plays one key at a time (a bass, a lead) */
const chordPlays = t => !!(t && t.inst && t.inst.kind !== 'drums' && !t.theirs && !(t.inst.kind === 'synth' && instParams(t.inst).mono))
const chordFree = (t, a, b) => !t.regs.some(r => r.a - 1 < b - 1e-9 && r.b - 1 > a + 1e-9)
/* the bar it begins in: where a marquee begins, or the cycle if it is on, or what is chosen, or the bar the playhead is in */
function chordFrom () {
  if (S.marq && S.marq.b - S.marq.a >= MIN_LEN) return Math.floor(S.marq.a + 1e-6)
  if (S.cycle.on && S.cycle.b - S.cycle.a >= MIN_LEN) return Math.floor(S.cycle.a + 1e-6)
  const rs = selRegs()
  if (rs.length) return Math.floor(Math.min(...rs.map(x => x[0].a)) - 1 + 1e-6)
  return Math.floor(curPos() + 1e-6)
}
function chordDo (a, out) {
  const word = (text, more) => out.push(Object.assign({ k: 'word', text }, more || {}))
  const bars = (Array.isArray(a.bars) ? a.bars : []).slice(0, 64).map(b => (Array.isArray(b) ? b : [b]).map(String))
  const beats = BEATS(), steps = beats * BEAT_16(), qb = QB(), from = chordFrom(), n = Math.min(bars.length, Math.floor(SONG_END + 1e-6) - from)
  if (!bars.length) { word('no chords'); return true }
  if (n < 1) { word('no room for chords there'); return true }
  /* where each name stands: the names of a bar share it evenly where that comes out in beats (or in sixteenths); else
     each has a beat and the last holds to the end of the bar. A dash leaves the chord before it standing. */
  const slots = []
  for (let i = 0; i < n; i++) {
    const b = bars[i], k = b.length, even = beats % k === 0 || (k > beats && steps % k === 0)
    if (!even && k > beats) { word('more chords in a bar than it has beats'); return true }
    const len = even ? qb / k : qb / beats
    for (let j = 0; j < k; j++) {
      if (b[j] === '-') continue
      const c = chordOfName(b[j])
      if (!c) { word(asGiven(`couldn’t read the chord ${b[j]}`)); return true }
      slots.push({ t: +(i * qb + j * len).toFixed(4), c, name: b[j] })
    }
  }
  if (!slots.length) { word('no chords'); return true }
  const end = n * qb, vel = typeof ROLL !== 'undefined' && ROLL.vel ? clamp(Math.round(ROLL.vel), 1, 127) : 100, notes = []
  let up = null, low = null
  slots.forEach((sl, i) => {
    const d = +(((slots[i + 1] ? slots[i + 1].t : end) - sl.t)).toFixed(4)
    up = chordVoice(sl.c, up); low = chordBass(sl.c, low)
    for (const key of [low].concat(up)) notes.push(mkNote(sl.t, d, key, vel))
  })
  const marked = S.marq && S.marq.b - S.marq.a >= MIN_LEN ? marqTracks().find(chordPlays) : null, lead = S.tracks[S.sel]
  let t = marked || (chordPlays(lead) && chordFree(lead, from, from + n) ? lead : null) || S.tracks.find(x => x.id === CHORD.track && chordPlays(x)) || null
  if (!t && S.tracks.length >= MAX_TRACKS) { word('no room for another track'); return true }
  const name = slots.map(sl => sl.name).join('  ').slice(0, 60)
  let r = null, made = false
  edit(() => {
    if (!t) { t = addTrack('midi', S.tracks.some(x => x.name === 'chords') ? null : 'chords', S.sel, { kind: 'synth', sound: 'e piano' }); normalizeOrder(); made = true }
    r = mkReg({ a: from + 1, b: from + n + 1, loop: false, notes, name, chords: slots.map(sl => [sl.t, sl.name]) })
    t.regs.push(r); settle([[r, t, from, from + n]])
  })
  if (made) { birth(t); repaint() }
  CHORD.track = t.id
  leadTrack(S.tracks.indexOf(t)); S.selR = [r.id]; S.selX = null; S.marq = null; S.focus = 'lanes'; showRow(S.sel)
  if (typeof rollOpen === 'function') rollOpen()
  word(asGiven(`${n === 1 ? 'bar' : 'bars'} ${from + 1}${n > 1 ? ' to ' + (from + n) : ''}:  ${slots.map(sl => sl.name).join('  ')}`), { step: 1, chords: 1 })
  if (n < bars.length) word(`${bars.length - n} ${bars.length - n === 1 ? 'bar' : 'bars'} past the end of the song left out`, { quiet: 1 })
  uiDirty('lanes', 'dock', 'head', 'top')
  return true
}
