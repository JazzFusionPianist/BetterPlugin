/* ── the command line in cells ──
   A command that deals in exact things is not typed out, it is put together: as a letter is typed, what begins with it
   is listed over the line; what is taken from the list stands in the line as a cell, and the next list holds only what
   can follow — a track, then what is on it (its level, its pan, its prints, its sends, its plug-ins, and of a plug-in
   its controls), a stretch of the song (in the cycle's colour: bars, a marker, the cycle as it stands), how much, and
   last the act. While the act is being chosen the line it would draw is shown dashed on the track's own lane; return
   draws it, in one step of undo, and what was done is said at the far end of the foot.
   Its words are english whatever language the room is shown in (as the rest of the command line: say.js); the act
   may be said first or last, and any order that makes sense is taken. A line with no cell in it is read as before
   (say.js, and Claude where there is one).
   Arrows choose, tab or return takes, escape puts the list away (again: the cells), backspace on nothing takes the last
   cell back, a press on a row takes it.  Draft: design/prompt draft 1 (frame 7, Claude's answer in cells, is not made:
   the app has no way to Claude yet).
   S.line = { parts, done }: a part is {k: who | what | param | where | much | act, t: its words, …}. */
const HINT_MAX = 8
const begins = (word, typed) => String(word).toLowerCase().startsWith(String(typed).toLowerCase())

/* ── the words ── */
const LINE_ACTS = [                                         // v: what it does to a value; ramp: over a stretch, which it needs
  { v: 'gdown', en: 'lower gradually', sign: -1, ramp: true, d: 'over the stretch' },
  { v: 'gup', en: 'raise gradually', sign: 1, ramp: true, d: 'over the stretch' },
  { v: 'down', en: 'lower', sign: -1, d: 'for the stretch' },
  { v: 'up', en: 'raise', sign: 1, d: 'for the stretch' },
  { v: 'set', en: 'set to', sign: 0, d: 'for the stretch' },
]
const LINE_WHAT = { vol: 'volume', pan: 'pan', tape: 'tape', space: 'space', delay: 'delay' }
/* how a ramp bends (auto.js: AUTO_CURVES); straight unless one is taken */
const LINE_SHAPES = [
  { v: 'exp', en: 'exponentially', d: 'slow, then fast' },
  { v: 'log', en: 'logarithmically', d: 'fast, then slow' },
  { v: 's', en: 's-curve', d: 'slow at both ends' },
]
const linePart = k => (S.line.parts.find(p => p.k === k) || null)
const lineTrack = () => { const w = linePart('who'); return w ? byId(w.id) : null }
/* the value the line is about, by its key among a track's lines (vol, pan, tape, send0, fx2.5…), once it is said */
const lineKey = () => { const p = linePart('param'), w = linePart('what'); return p ? p.key : w && w.key ? w.key : null }

/* ── a plug-in's controls: their names, and how one reads along its travel (the app says; a browser has what it was given) ── */
async function fxParams (t, ins) {
  if (NAT && ins.uid) { const r = await NAT.call('params', { track: t.id, uid: ins.uid }); if (Array.isArray(r)) ins.pl = r }
  return ins.pl || []
}
async function fxScale (t, ins, i) {
  ins.ps = ins.ps || {}
  if (!ins.ps[i] && NAT && ins.uid) { const r = await NAT.call('paramScale', { track: t.id, uid: ins.uid, index: i }); if (r && Array.isArray(r.texts) && r.texts.length > 1) ins.ps[i] = r }
  const sc = ins.ps[i]
  if (sc && !sc.read) {                                     // its words as numbers, when they are numbers and go one way
    const nums = sc.texts.map(x => parseFloat(String(x).replace(/[−–]/g, '-').replace(/,/g, '.'))), ok = nums.every(isFinite) && (nums.every((v, k) => !k || v >= nums[k - 1]) || nums.every((v, k) => !k || v <= nums[k - 1])) && nums[0] !== nums[nums.length - 1]
    sc.read = true; sc.nums = ok ? nums : null; sc.unit = ok ? String(sc.unit || '').trim().toLowerCase() : ''
  }
  return sc || null
}
/* a control's line is a plug-in's (fx<n>.<i>) or a macro's (mac<id>: it reads as the control it is wired to) */
const ctlKey = k => FX_KEY.test(k) || (typeof MAC_KEY !== 'undefined' && MAC_KEY.test(k))
const scaleIns = (t, k) => { if (FX_KEY.test(k)) return [fxIns(t, k), fxIndex(k)]; const m = typeof macroOf === 'function' ? macroOf(t, k) : null; return m && m.to ? [macroIns(t, m), m.to.i] : [null, -1] }
const scaleOf = (t, k) => { const [ins, i] = scaleIns(t, k); return ins && ins.ps ? ins.ps[i] || null : null }
/* a control's place (0 to 1) as its own number, and back */
const scaleNum = (sc, f) => { const n = sc.nums, x = clamp(f, 0, 1) * (n.length - 1), i = Math.min(n.length - 2, Math.floor(x)); return n[i] + (n[i + 1] - n[i]) * (x - i) }
const scaleAt = (sc, num) => { const n = sc.nums, up = n[n.length - 1] > n[0]; for (let i = 0; i < n.length - 1; i++) { const a = n[i], b = n[i + 1]; if ((up ? num >= a && num <= b : num <= a && num >= b) && a !== b) return (i + (num - a) / (b - a)) / (n.length - 1) } return (up ? num <= n[0] : num >= n[0]) ? 0 : 1 }
/* how a value of the line's thing is said, and in what unit an amount of it is typed */
function lineUnit (t, k) { if (k === 'vol' || /^send/.test(k)) return 'db'; if (ctlKey(k)) { const sc = scaleOf(t, k); return sc && sc.nums ? sc.unit : '%' } return '' }
function lineSays (t, k, v) {
  if (k === 'vol' || /^send/.test(k)) return `${fmtDb(v)} db`
  if (k === 'pan') return panText(v)
  if (ctlKey(k)) { const sc = scaleOf(t, k); return sc && sc.nums ? `${(Math.round(scaleNum(sc, v) * 10) / 10).toFixed(1).replace('-', '−')}${sc.unit ? ' ' + sc.unit : ''}` : `${Math.round(v * 100)} %` }
  return String(Math.round(v))
}
/* an amount to offer before one is typed: a small step in the thing's own unit */
function lineGuess (t, k) {
  const unit = lineUnit(t, k)
  if (k === 'vol' || /^send/.test(k)) return { v: 3, unit }
  if (ctlKey(k)) { const sc = scaleOf(t, k); if (sc && sc.nums) { const n = sc.nums, span = Math.abs(n[n.length - 1] - n[0]) / 10, p = Math.pow(10, Math.floor(Math.log10(span || 1))), v = [1, 2, 5, 10].map(m => m * p).find(x => x >= span * .7) || p; return { v: +v.toPrecision(3), unit } } return { v: 10, unit } }
  return { v: 10, unit }
}
/* a value moved by an amount typed in its unit (sign 0: put at that amount) */
function lineMoved (t, k, v, much, sign) {
  const A = AUTO[k], lim = x => A.inv(clamp(A.f(x), 0, 1))
  if (k === 'pan') return lim(sign ? v + sign * much / 64 : much / 64)
  if (ctlKey(k)) { const sc = scaleOf(t, k); if (sc && sc.nums) return lim(scaleAt(sc, sign ? scaleNum(sc, v) + sign * much : much)); return lim(sign ? v + sign * much / 100 : much / 100) }
  return lim(sign ? v + sign * much : much)
}

/* While the line is about a value of a track, that track's row is shown tall enough for the value's line, and the line
   that would be drawn, to be read (a row of the usual height gives three db less than a pixel); it goes back when the
   line is let go of. */
const LINE_TALL = 76
function lineTall () {
  const t = lineTrack(), k = lineKey()
  let any = false
  for (const x of S.tracks) { const want = x === t && k && !((x.h || S.rh) >= LINE_TALL) ? LINE_TALL : 0; if ((x.hNow || 0) !== want) { any = true; if (want) x.hNow = want; else delete x.hNow } }
  if (any) { if (t) showRow(S.tracks.indexOf(t)); VY = clamp(VY, 0, maxVY()); uiDirty('lanes', 'head') }
}

/* ── what can follow what stands in the line: [{t: its words, d: what kind of thing or how it stands, part}] ── */
function lineOffers (typed) {
  const P = S.line.parts, out = [], t = lineTrack(), what = linePart('what'), key = lineKey(), where = linePart('where'), much = linePart('much'), act = linePart('act')
  const add = (words, d, part, given) => out.push({ t: words, d, part: Object.assign({ t: words }, part), given })
  const acts = () => { for (const a of LINE_ACTS) if (!a.ramp || !t || (where && where.b != null)) add(a.en, where ? a.d : '', { k: 'act', v: a.v }) }
  const trackActs = () => { for (const [m, words] of SAY_FIXED) if (m.k === 'verb' && ['mute', 'unmute', 'solo', 'unsolo', 'delete', 'select', 'cut', 'again', 'fadein', 'fadeout', 'quantize', 'dequantize', 'reverse', 'join', 'strip', 'legato', 'follow'].includes(m.v)) add(words[0], '', { k: 'act', v: 'say', say: words[0] }) }      // (said with the track's name, by the line's own reader)
  if (!t) {
    S.tracks.forEach((x, i) => { if (x.name) add(String(x.name).toLowerCase(), x.kind === 'stack' ? 'stack' : x.kind === 'bus' ? 'bus' : `track ${pad2(i + 1)}`, { k: 'who', id: x.id }, true) })
    if (!act && !P.length) acts()                                                     // (english begins with the act; the plain acts are words of the line: lineList)
    return out
  }
  if (act && act.v === 'say') return out                                             // a track and what to do with it: nothing more to say
  if (!what) {
    for (const ins of t.inserts || []) if (!ins.out && ins.name) add(String(ins.name).toLowerCase(), 'plug-in', { k: 'what', plug: ins.n || (ins.n = 1 + Math.max(0, ...t.inserts.map(q => q.n || 0))) }, true)
    add(LINE_WHAT.vol, asGiven(lineSays(t, 'vol', shown(t, 'vol'))), { k: 'what', key: 'vol' })
    if (t.kind !== 'stack') add(LINE_WHAT.pan, asGiven(panText(shown(t, 'pan'))), { k: 'what', key: 'pan' })
    if (t.patch) for (const k of ['tape', 'space', 'delay']) add(LINE_WHAT[k], asGiven(String(Math.round(shown(t, k)))), { k: 'what', key: k })
    for (const m of t.macros || []) add(String(m.name).toLowerCase(), m.to ? asGiven(`macro · ${String(m.to.plug || '').toLowerCase()}`) : 'macro', { k: 'what', key: 'mac' + m.id }, true)
    ;(t.sends || []).forEach((sd, i) => { const bus = byId(sd.to); if (bus) add(`send ${String(bus.name).toLowerCase()}`, asGiven(`${fmtDb(sd.db)} dB`), { k: 'what', key: 'send' + i }, true) })
    if (!act) trackActs()
    return out
  }
  if (what.plug && !linePart('param')) {
    const ins = (t.inserts || []).find(x => x.n === what.plug)
    for (const [i, name, , text] of (ins && ins.pl) || []) add(String(name).toLowerCase(), asGiven(String(text == null ? '' : text).toLowerCase()), { k: 'param', key: `fx${what.plug}.${i}`, i }, true)
    return out
  }
  /* the thing is said: where, how much, and the act — numbers are read here, names of places and acts are listed */
  const num = /^([+\-−]?\d+(?:[.,]\d+)?)\s*(db|%|[a-z]*)$/.exec(typed), span = /^(\d+)\s*[~\-–]\s*(\d+)?$/.exec(typed), unit = lineUnit(t, key)
  if (where && where.open) { const m = /^(\d+)$/.exec(typed); if (m && +m[1] > where.a) add(`${where.a} ~ ${+m[1]}`, 'bars', { k: 'where', a: where.a, b: +m[1], fill: true, typed: true }); return out }
  if (!where) {
    if (span && span[2] && +span[2] > +span[1]) add(`${+span[1]} ~ ${+span[2]}`, 'bars', { k: 'where', a: +span[1], b: +span[2], typed: true })
    else if (span) add(`${+span[1]} ~`, 'then the last bar', { k: 'where', a: +span[1], b: null, open: true, typed: true })
    const n = /^\d+$/.test(typed) ? +typed : null
    if (n != null && n >= 1) {
      if (S.cycle && S.cycle.b > S.cycle.a && Math.round(S.cycle.a) + 1 === n) add(`${n} ~ ${Math.round(S.cycle.b) + 1}`, 'the cycle', { k: 'where', a: n, b: Math.round(S.cycle.b) + 1, typed: true })
      add(`${n} ~ end`, `from bar ${n} on`, { k: 'where', a: n, b: null, typed: true })
      add(`${n} ~`, 'then the last bar', { k: 'where', a: n, b: null, open: true, typed: true })
    }
    if (!num && !span) {
      for (const sc of SCENES) if (sc.name) add(`${String(sc.name).toLowerCase()} ${sc.a + 1} ~ ${sc.b + 1}`, 'marker', { k: 'where', a: sc.a + 1, b: sc.b + 1 }, true)
      if (S.cycle && S.cycle.b > S.cycle.a) add(`cycle ${Math.round(S.cycle.a) + 1} ~ ${Math.round(S.cycle.b) + 1}`, 'the cycle', { k: 'where', a: Math.round(S.cycle.a) + 1, b: Math.round(S.cycle.b) + 1 })
    }
  }
  if (!much && !typed && key && !(where && where.open)) { const g = lineGuess(t, key); if (g) add(`${g.v}${g.unit ? ' ' + g.unit : ''}`, 'how much', { k: 'much', v: g.v }) }      // (nothing typed yet: an amount to begin from, in the thing's own unit)
  if (!much && num && (!num[2] || num[2] === unit)) { const v = Math.abs(parseFloat(num[1].replace('−', '-').replace(',', '.'))); if (isFinite(v)) add(`${num[1].replace('-', '−')}${unit ? ' ' + unit : ''}`, 'how much', { k: 'much', v, typed: true }) }
  if (!act && !num && !span) acts()
  if (act && (LINE_ACTS.find(a => a.v === act.v) || {}).ramp && !linePart('shape')) for (const sh of LINE_SHAPES) add(sh.en, sh.d, { k: 'shape', v: sh.v })      // (return does it straight; one of these bends it)
  return out
}
/* ── words as they are typed ──
   A line typed out in words (no cells in it) is completed word by word: what has been typed of the word under the keys is
   matched against every word the line's grammar knows (say.js) — acts, which ones, where, how, units, tracks, markers,
   plug-ins, controls, macros, and the plain lines (play, undo, …) — and the matches are listed in the order of the
   alphabet; a word of several (fade in, trim the end of) is found across its spaces. After a space, with nothing typed
   yet, what the line still lacks is offered: an act and whom at first, then where, how, and how much. Tab takes a word;
   return says the line as typed — completing the last word first when it is not yet a word the grammar knows (rev). */
const SAY_PLAIN = ['play', 'stop', 'record', 'undo', 'redo', 'save', 'click on', 'click off', 'cycle on', 'cycle off', 'new track', 'new audio track', 'new bus', 'export', 'hand off', 'mixer', 'patch', 'tempo']
function wordKind (tok) {
  switch (tok.k) {
    case 'verb': return 'act'
    case 'sel': case 'all': case 'except': return 'which'
    case 'rfilt': return 'filter'
    case 'name': return 'track'
    case 'trk': return tok.fam ? 'tracks' : null                                       // (the many words a track answers to are found as its name)
    case 'rword': case 'notes': case 'tword': case 'tkind': case 'mword': case 'pword': return 'what'
    case 'tfilt': return 'filter'
    case 'tpos': return 'where'
    case 'color': case 'shade': return 'colour'
    case 'howhat': case 'fmt': case 'hoprint': case 'horange': return 'hand off'
    case 'printname': return 'print'
    case 'want': return 'sound'
    case 'what': return 'value'
    case 'plug': return 'plug-in'
    case 'ctlname': return 'control'
    case 'macroword': return 'macro'
    case 'mod': return 'how'
    case 'opt': return 'option'
    case 'shape': return 'curve'
    case 'qopt': return 'feel'
    case 'side': return 'pan'
    case 'here': case 'start': case 'end': case 'cycle': case 'sect': case 'ord': return 'where'
    case 'role': return { by: 'how much', after: 'filter', before: 'filter', above: 'filter', below: 'filter' }[tok.v] || 'where'
    case 'unit': return 'unit'
    case 'then': return 'then'
    case 'num': return 'how many'
    default: return null
  }
}
/* words that mean the same (selected, selection, this) are one thing to offer: the first of their list that fits what is
   typed — all of them are still read when typed out. A meaning, by what the line reads it as */
const wordKey = (w, tok) => ['name', 'plug', 'ctlname'].includes(tok.k) ? tok.k + ':' + w : tok.k === 'trk' ? 'fam:' + tok.v : tok.k === 'sect' ? (tok.n ? 'mark:' + w : 'sect:' + tok.v) : tok.k + ':' + (tok.v == null ? '' : tok.v) + (tok.hard ? ':hard' : '') + (tok.k === 'num' ? ':' + tok.unit : '')
let WORD_RANK = null
const wordRank = w => { if (!WORD_RANK) { WORD_RANK = new Map(); let k = 0; const put = x => { if (!WORD_RANK.has(x)) WORD_RANK.set(x, k++) }; for (const [, ws] of SAY_FIXED) ws.forEach(put); for (const f in SAY_FAM) SAY_FAM[f].forEach(put); for (const x in SAY_SECT) SAY_SECT[x].forEach(put) } return WORD_RANK.has(w) ? WORD_RANK.get(w) : 1e6 }
/* one row for each meaning: the first-listed of its words among those given, then in the order of the alphabet */
function oneEach (rows) {
  const best = new Map()
  for (const r of rows) { const b = best.get(r.key); if (!b || r.rank < b.rank) best.set(r.key, r) }
  return [...best.values()].sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0))
}
function sayWordsAll () {
  const V = sayVocab()
  if (SAY.words && SAY.words.v === V) return SAY.words.list
  const seen = new Map()
  for (const [w, tok] of V) { const d = wordKind(tok); if (d && w.length > 1 && /[a-z]/.test(w) && !seen.has(w)) seen.set(w, { t: w, d, key: wordKey(w, tok), rank: wordRank(w) }) }
  for (const w of SAY_PLAIN) if (!seen.has(w)) seen.set(w, { t: w, d: 'line', key: 'line:' + w, rank: 0 })
  const list = [...seen.values()].sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0))
  SAY.words = { v: V, list }
  return list
}
const wordRow = (w, from) => ({ t: w.t, d: w.d, part: { k: 'word', t: w.t, from } })
/* what the line still lacks, after what is typed before the word under the keys */
function sayNext (before) {
  const toks = before.trim() ? sayLex(before.trim()).filter(t => t.k !== 'raw') : [], all = sayWordsAll(), pick = (...ds) => oneEach(all.filter(w => ds.includes(w.d))), last = toks[toks.length - 1]
  if (last && last.k === 'num') return pick('unit')
  const act = toks.some(t => t.k === 'verb' || t.k === 'mod'), who = toks.some(t => ['sel', 'all', 'trk', 'name', 'notes', 'rword', 'plug', 'macroword', 'ctlname'].includes(t.k))
  if (!toks.length) return pick('act', 'line', 'which', 'track', 'tracks')
  if (!act && !who) return pick('act', 'which', 'track', 'tracks')
  if (who && !act) return pick('act', 'value', 'how')
  if (act && !who) return pick('which', 'track', 'tracks', 'what', 'filter', 'plug-in', 'macro')
  return pick('where', 'filter', 'how much', 'how', 'curve', 'option', 'unit', 'then')
}
function textList (raw) {
  const cur = /(\S*)$/.exec(raw)[1]
  if (!cur) return sayNext(raw).map(w => wordRow(w, raw.length))
  const starts = [0]
  for (let i = 1; i < raw.length; i++) if (raw[i - 1] === ' ' && raw[i] !== ' ') starts.push(i)
  const tail = starts.slice(-4), fits = []
  for (const w of sayWordsAll()) {
    const p = tail.find(q => { const s = raw.slice(q); return s && s !== w.t && w.t.startsWith(s) })        // (the earliest start that still fits: a word of several is found across its spaces)
    if (p != null) fits.push(Object.assign({ p }, w))
  }
  return oneEach(fits).map(w => wordRow(w, w.p))
}
/* the line is typed out in words: no cells, and a word already behind a space */
const lineTextMode = raw => !S.line.parts.length && /\S\s/.test(String(raw).replace(/^\s+/, ''))
/* what is offered for the letters typed: a number is read (its rows are made for it); a word must begin a row, or a word inside one */
function lineList (typed, raw = typed) {
  if (lineTextMode(raw)) { const cells = lineOffers(typed).filter(x => begins(x.t, typed)), have = new Set(cells.map(x => x.t)); return cells.concat(textList(raw).filter(x => !have.has(x.t))) }      // (a cell of several words — lower gradually, serum 2 — still found whole, before the words)
  const all = lineOffers(typed)
  let rows
  if (!typed) rows = all
  else { const ty = all.filter(x => x.part.typed); if (ty.length) rows = ty; else { const a = all.filter(x => begins(x.t, typed)), b = typed.includes(' ') ? [] : all.filter(x => !begins(x.t, typed) && x.t.split(' ').some(w => begins(w, typed))); rows = a.concat(b) } }
  if (!S.line.parts.length) { const have = new Set(rows.map(x => x.t)); rows = rows.concat(textList(raw).filter(x => !have.has(x.t))) }      // (the first word: the cells, then every word of the grammar that begins so)
  return rows
}
/* the list for the line as it stands now; `open`: also with nothing typed, where what follows is a short list of its own */
function hintFresh (open) {
  const cmd = $('cmd'), was = S.hint, L = S.line
  S.hint = null
  if (document.activeElement === cmd && !L.done) {
    const typed = cmd.value.trim().toLowerCase(), t = lineTrack(), what = linePart('what')
    const page = typeof promptUp === 'function' && promptUp(), short = open === true && !typed && t && (!what || (what.plug && !linePart('param')) || (lineKey() && linePart('much') && !linePart('act')))
    if (typed || short || page) {                                                    // (the prompt's page has room for the list at every step, with nothing typed too: prompt.js)
      const items = lineList(typed, cmd.value.toLowerCase()).slice(0, 200)                 // (the list goes down the rest with the arrows: drawn so many at a time)                  // (the page shows as many as it has room for, and goes down the rest with the arrows: prompt.js)
      if (items.length) { const keep = was ? items.findIndex(x => x.t === (was.items[was.at] || {}).t) : -1; S.hint = { items, at: Math.max(0, keep) } }
    }
  }
  uiDirty('hint', 'cmd')
}
/* a word taken into a line typed out: in place of what was typed of it, and a space after it */
function wordTake (it) {
  const cmd = $('cmd'), raw = cmd.value, p = it.part.from != null ? it.part.from : raw.length - /(\S*)$/.exec(raw)[1].length
  cmd.value = raw.slice(0, p) + it.part.t + ' '; S.hint = null; S.last = null
  cmd.focus(); cmd.setSelectionRange(cmd.value.length, cmd.value.length)
}
/* a row taken: it stands in the line as a cell; a plug-in then says its controls, a control how it reads */
async function hintTake (i) {
  const h = S.hint, it = h && h.items[i == null ? h.at : i], cmd = $('cmd'), L = S.line
  if (!it) return
  if (it.part.k === 'word') { wordTake(it); hintFresh(true); return }
  if (it.part.fill) L.parts = L.parts.filter(p => p.k !== 'where')                    // (the last bar of a stretch begun: the two are one cell)
  L.parts.push(it.part)
  cmd.value = ''; S.hint = null; S.last = null                                       // (what an earlier line did is no longer what the foot is about)
  cmd.focus()
  const t = lineTrack(), key = lineKey()
  if (t && key) { if (!S.auto) toggleAuto(); t.ap = key; uiDirty('lanes', 'head') }   // the thing's own line is on show while the line is about it
  if (t && it.part.k === 'what' && it.part.plug) await fxParams(t, t.inserts.find(x => x.n === it.part.plug))
  if (t && it.part.k === 'what' && it.part.key && ctlKey(it.part.key)) { const [ins, i] = scaleIns(t, it.part.key); if (ins) await fxScale(t, ins, i) }      // (a macro reads as the control it turns)
  if (t && it.part.k === 'param') { const ins = fxIns(t, it.part.key); if (ins) { ins.pn = ins.pn || {}; ins.pv = ins.pv || {}; ins.pn[it.part.i] = it.part.t; const row = (ins.pl || []).find(r => r[0] === it.part.i); if (row && ins.pv[it.part.i] == null) ins.pv[it.part.i] = clamp(+row[2] || 0, 0, 1); await fxScale(t, ins, it.part.i) } }
  hintFresh(true)
}

/* ── what the line would do: the thing's line as it would stand afterwards ── */
const ptsAt = (pts, pos, still) => { if (!pts.length) return still; if (pos <= pts[0].b) return pts[0].v; const n = pts.length; if (pos >= pts[n - 1].b) return pts[n - 1].v; let i = 1; while (pts[i].b < pos) i++; const a = pts[i - 1], b = pts[i], span = b.b - a.b; return span > 1e-9 ? a.v + (b.v - a.v) * curveAt(a.c, (pos - a.b) / span) : b.v }
/* a thing's line as it would stand afterwards — for the cells here, and for a line of words (say.js): one way of writing it.
   sp: a, b    the stretch, in bars counted from one (b null: on to the end; a null: the whole line, or the value itself)
       much    an amount in the thing's own unit; sign −1 lower by it, 1 raise by it, 0 put it at that
       ramp    over the stretch, to where it ends, and it stays there; else for the stretch only, and back
       from    a ramp from this value (in the thing's unit) to the amount; what lay inside the stretch gives way to it
       shape   how a ramp bends (auto.js: exp, log, s); back: after a ramp, back to what it was */
function autoWrite (t, k, sp) {
  if (!t || !AUTO[k] || !(sp.much >= 0 || sp.much < 0)) return null
  const A = AUTO[k], old = autoPts(t, k).map(q => Object.assign({}, q)), still = A.now(t), E = 1e-9, mv = v => lineMoved(t, k, v, sp.much, sp.sign)
  if (sp.a == null) return old.length ? { t, k, pts: old.map(q => Object.assign(q, { v: mv(q.v) })), from: ptsAt(old, curPos(), still), to: mv(ptsAt(old, curPos(), still)) } : { t, k, pts: null, from: still, to: mv(still) }
  const a = clamp(sp.a - 1, 0, SONG_END), b = sp.b == null ? null : clamp(sp.b - 1, a, SONG_END), va = ptsAt(old, a, still), vb = b == null ? null : ptsAt(old, b, still)
  const before = old.filter(q => q.b < a - E), inside = old.filter(q => q.b > a + E && (b == null || q.b < b - E)), after = b == null ? [] : old.filter(q => q.b > b + E)
  const c = sp.shape && AUTO_CURVES[sp.shape] ? sp.shape : undefined, bent = q => (c ? Object.assign(q, { c }) : q)
  if (sp.ramp && b != null && b > a + E) {
    if (sp.from != null || !sp.sign) {                       // from one value to another: a sweep
      const v0 = sp.from != null ? lineMoved(t, k, va, sp.from, 0) : va, v1 = mv(vb)
      return { t, k, pts: before.concat(Math.abs(v0 - va) > 1e-9 ? [{ b: a, v: va }] : [], [bent({ b: a, v: v0 })], [{ b, v: v1 }], sp.back ? [{ b, v: vb }] : [], after), from: v0, to: v1 }
    }
    const part = q => curveAt(c, (q.b - a) / (b - a))       // as much more (or less) by its end: what lay inside keeps its shape and is bent along
    const pts = before.concat([inside.length ? { b: a, v: va } : bent({ b: a, v: va })], inside.map(q => Object.assign(q, { v: lineMoved(t, k, q.v, sp.much * part(q), sp.sign) })), [{ b, v: mv(vb) }], sp.back ? [{ b, v: vb }].concat(after) : after.map(q => Object.assign(q, { v: mv(q.v) })))
    return { t, k, pts, from: va, to: mv(vb) }
  }
  if (b == null) return { t, k, pts: before.concat([{ b: a, v: va }, { b: a, v: mv(va) }], inside.map(q => Object.assign(q, { v: mv(q.v) }))), from: va, to: mv(va) }      // from that bar on
  return { t, k, pts: before.concat([{ b: a, v: va }, { b: a, v: mv(va) }], inside.map(q => Object.assign(q, { v: mv(q.v) })), [{ b, v: mv(vb) }, { b, v: vb }], after), from: va, to: mv(va) }      // for the stretch, and back
}
function lineAfter (actV, shapeV) {
  const t = lineTrack(), k = lineKey(), where = linePart('where'), much = linePart('much'), act = LINE_ACTS.find(a => a.v === actV), shape = linePart('shape')
  if (!t || !k || !AUTO[k] || !much || !act || (where && where.open) || (act.ramp && !(where && where.b != null))) return null
  return autoWrite(t, k, { a: where ? where.a : null, b: where ? where.b : null, much: much.v, sign: act.sign, ramp: !!act.ramp, shape: shapeV || (shape && shape.v) })
}
/* the line has all it needs: return does it */
function lineReady () { const a = linePart('act'), t = lineTrack(); return !!(a && t && !S.line.done && (a.v === 'say' || lineAfter(a.v))) }
/* what autoWrite gave, put in place: the line, or with no stretch the value itself (a control's as a line of one point) */
function autoApply (r) {
  const t = r.t
  if (r.pts) { t.autos = t.autos || {}; t.autos[r.k] = r.pts.map(q => Object.assign({ id: q.id || ++PID, b: q.b, v: q.v }, q.c ? { c: q.c } : {})) }
  else if (r.k === 'vol') t.vol = r.to
  else if (r.k === 'pan') t.pan = r.to
  else if (/^send/.test(r.k)) t.sends[+r.k.slice(4)].db = r.to
  else if (FX_KEY.test(r.k)) { t.autos = t.autos || {}; t.autos[r.k] = [{ id: ++PID, b: 0, v: r.to }] }
  else if (ctlKey(r.k)) { const m = macroOf(t, r.k); if (m && typeof macroSet === 'function') macroSet(t, m, r.to) }
  else setPrint(t, r.k, r.to)
  t.ap = r.k
  pushTrack(t); resyncSoon()
}
const autoSaid = r => `${autoName(r.t, r.k)}  ${lineSays(r.t, r.k, r.from)}  ${LANG.now === 'ko' ? '→' : 'to'}  ${lineSays(r.t, r.k, r.to)}`
/* return, with the act in the line: done, in one step */
async function lineDo () {
  const L = S.line, act = linePart('act'), t = lineTrack(), cmd = $('cmd')
  if (!act || !t || L.done) return false
  if (act.v === 'say') {                                    // a track and a plain act: said to the line's own reader, in its words
    S.line = { parts: [], done: false }
    await runCommand(`${t.name} ${act.say}`); cmd.value = ''; uiDirty('hint', 'cmd')
    return true
  }
  const r = lineAfter(act.v)
  if (!r) return false
  const before = Object.assign(editState(), { mix: mixState() })
  autoApply(r)
  commit(before)
  L.done = true
  S.last = { say: autoSaid(r), far: true }
  uiDirty('hint', 'cmd', 'lanes', 'head', 'dock')
  return true
}

/* ── drawn: the cells in the foot, the list over them, and on the lanes the stretch and the line that would be drawn ── */
function lineCells () {
  const P = S.line.parts, at = (typeof promptAt === 'function' && promptAt()) || { x: 26, y: H - FOOT_H + 3, h: 16, size: 9.5 }, cy = at.y, h = at.h, sz = at.size, pad = Math.round(sz * .74)      // (prompt.js: in the prompt's own page, larger)
  let s = '', x = at.x, i = 0
  while (i < P.length) {
    const p = P[i]
    if (p.k === 'who' || p.k === 'what' || p.k === 'param') { const run = []; while (i < P.length && ['who', 'what', 'param'].includes(P[i].k)) run.push({ t: asGiven(P[i++].t) }); const [g, w] = cells(x, cy, h, run, { size: sz, pad, a: .9, frame: .3 }); s += g; x += w + 6; continue }
    const w = Math.round(tw(asGiven(p.t), sz, p.k === 'act' ? 500 : 400) + pad * 2), ty = cy + h / 2 + sz * .35
    if (p.k === 'where') s += R(x + .5, cy + .5, w - 1, h - 1, { rx: 2, stroke: SOLO, sa: .7 }) + T(x + pad, ty, asGiven(p.t), { size: sz, c: SOLO })
    else if (p.k === 'act') s += R(x, cy, w, h, { rx: 2, fill: INK }) + T(x + pad, ty, asGiven(p.t), { size: sz, w: 500, c: K1 })
    else s += R(x + .5, cy + .5, w - 1, h - 1, { rx: 2, stroke: INK, sa: .3 }) + T(x + pad, ty, asGiven(p.t), { size: sz, a: .9 })
    x += w + 6; i++
  }
  return [s, P.length ? x : at.x]
}
function pHint () {
  const cmd = $('cmd'), h = S.hint, [cellsSvg, x0] = lineCells()
  if (S.lineX !== x0) { S.lineX = x0; cmd.style.left = x0 + 'px'; uiDirty('cmd') }
  lineTall()
  let s = cellsSvg
  /* on the lanes: the stretch, in the cycle's colour, and dashed the line as it would stand */
  const t = lineTrack(), key = lineKey(), where = linePart('where'), act = linePart('act'), ti = t ? S.tracks.indexOf(t) : -1
  if (t && rowOf(ti) >= 0 && !S.line.done) {
    let lanes = ''
    const y = rowY(ti), rh = rowH(ti)
    if (where && !where.open) { const xa = bx(where.a), xb = where.b == null ? bx(SONG_END + 1) : bx(where.b); s += G(R(xa, RU_Y, Math.max(1, xb - xa), RU_CY, { fill: SOLO, fa: .9 }), '', TL); lanes += R(xa, y, Math.max(1, xb - xa), rh, { fill: SOLO, fa: .06 }) }
    const hp = h && h.items[h.at] && h.items[h.at].part, hov = hp && hp.k === 'act' ? hp.v : act ? act.v : null, r = hov && hov !== 'say' && key && AUTO[key] ? lineAfter(hov, hp && hp.k === 'shape' ? hp.v : null) : null      // (a row of the list under the arrows: the line as that row would make it)
    if (r && S.auto && apOf(t) === key) {
      const g = autoGeom(t, y, rh), pts = r.pts || [{ b: 0, v: r.to }]
      let d = `M${X0 - 2} ${n(g.yOf(pts[0].v))}`
      for (const [qb, qv] of autoBent(pts)) d += `L${n(bx(qb + 1))} ${n(g.yOf(qv))}`
      d += `L${X1 + 2} ${n(g.yOf(pts[pts.length - 1].v))}`
      lanes += P(d, { stroke: K0, sa: .7, sw: 3 }) + P(d, { stroke: INK, sa: .95, sw: 1.2, dash: '3 3', x: ' id="line-would"' })
    }
    s += G(lanes, '', LN)
  }
  if (!h || (typeof promptOn === 'function' && promptOn())) return s                     // (with the prompt's page up, the list is drawn in it: prompt.js)
  const rowH_ = 20, cnt = h.items.length, room = Math.min(cnt, HINT_MAX), more = cnt > room, wide = Math.max(...h.items.map(it => tw(asGiven(it.t), 10.5, 500) + (it.d ? tw(it.d, 9.5) + 26 : 0)))
  S.hintTop = clamp(Math.min(S.hintTop || 0, h.at), Math.max(0, h.at - room + 1), Math.max(0, cnt - room))      // (a longer list than the rows shown goes down with the arrows: the row chosen is always in view)
  const w = clamp(Math.ceil(wide) + 30, 150, 360), hh = room * rowH_ + 12 + (more ? 14 : 0)
  const x = clamp(x0 - 13, 8, RX - w - 8), y = H - FOOT_H - hh - 4, typedOf = it => (it.part.k === 'word' && it.part.from != null ? cmd.value.slice(it.part.from) : cmd.value).trim().toLowerCase()
  s += R(x, y, w, hh, { rx: 3, fill: K2 }) + R(x + .5, y + .5, w - 1, hh - 1, { rx: 3, stroke: INK, sa: .28 })
  if (more) s += T(x + w - 13, y + hh - 6, `${S.hintTop + 1}–${S.hintTop + room} of ${cnt}`, { size: 9, a: .4, anchor: 'end' })
  let ry = y + 6
  h.items.slice(S.hintTop, S.hintTop + room).forEach((it, k) => {
    const i = S.hintTop + k, on = i === h.at, wt = on ? 500 : 400, typed = typedOf(it)
    if (on) s += R(x + 5, ry, w - 10, rowH_, { rx: 2, fill: INK })
    if (typed && it.t.startsWith(typed)) s += R(x + 13, ry + 15.5, tw(asGiven(it.t.slice(0, typed.length)), 10.5, wt), 1, { fill: on ? K1 : INK, fa: on ? .5 : .4 })      // the letters typed so far
    s += T(x + 13, ry + 13.6, fit(asGiven(it.t), w - 26 - (it.d ? tw(it.d, 9.5) + 12 : 0), 10.5, wt), { size: 10.5, w: wt, c: on ? K1 : INK, a: on ? 1 : .84 })
    if (it.d) s += T(x + w - 13, ry + 13.6, it.d, { size: 9.5, c: on ? K1 : INK, a: on ? .7 : .42, anchor: 'end' })
    s += hit(x + 5, ry, w - 10, rowH_, 'hint', ` data-i="${i}"`)
    ry += rowH_
  })
  return s
}

/* ── joined to the room ── */
{
  S.hint = null; S.line = { parts: [], done: false }; S.lineX = 26
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.id = 'g-hint'
  document.getElementById('svg').appendChild(g)
  PARTS.hint = pHint
  const cmd = $('cmd')
  cmd.addEventListener('input', () => { if (S.line.done) S.line = { parts: [], done: false }; hintFresh() })      // typing after a line was done begins a new one
  cmd.addEventListener('blur', () => { S.hint = null; if (S.line.done) S.line = { parts: [], done: false }; uiDirty('hint') })      // the keys gone elsewhere: the list goes, and a line that was done is cleared away
  /* the keys of the list, and of the cells, before the line's own keys see them */
  addEventListener('keydown', e => {
    if (document.activeElement !== cmd || e.isComposing || e.keyCode === 229) return
    const h = S.hint, L = S.line
    if (h) {
      const k = h.items.length
      if (e.key === 'ArrowDown') h.at = (h.at + 1) % k
      else if (e.key === 'ArrowUp') h.at = (h.at + k - 1) % k
      else if (e.key === 'Enter' && !cmd.value.trim() && lineReady()) lineDo()        // (a line that is whole is done by return, whatever else could still follow it)
      else if (e.key === 'Enter' && h.items[h.at] && h.items[h.at].part.k === 'word') {      // a line of words: return says it — the last word completed first, if it is not yet one the grammar knows
        const cur = /(\S*)$/.exec(cmd.value)[1].toLowerCase()
        if (cur && !/^[+\-−]?\d/.test(cur) && !sayWordsAll().some(w => w.t === cur) && !sayVocab().some(([w]) => w === cur)) wordTake(h.items[h.at])
        S.hint = null; uiDirty('hint', 'cmd'); return
      }
      else if (e.key === 'Tab' || e.key === 'Enter') hintTake()
      else if (e.key === 'Escape') S.hint = null
      else if (e.key === 'Backspace' && !cmd.value && L.parts.length) { L.parts.pop(); hintFresh(true) }
      else return
    }
    else if (!L.parts.length) return                                                 // no cell in the line: its own keys, as ever
    else if (e.key === 'Backspace' && !cmd.value) { if (L.done) S.line = { parts: [], done: false }; else L.parts.pop(); hintFresh(true) }
    else if (e.key === 'Escape' && !cmd.value) S.line = { parts: [], done: false }
    else if (e.key === 'Enter') { if (!cmd.value.trim()) lineDo() }
    else if (e.key === 'Tab') hintFresh(true)
    else return
    e.preventDefault(); e.stopImmediatePropagation()
    uiDirty('hint', 'cmd')
  }, true)
  /* a press on a row takes it, and the line keeps the keys */
  const down0 = onDown
  onDown = function (e) {
    const el = S.hint && e.target.closest ? e.target.closest('[data-a="hint"]') : null
    if (el) { e.preventDefault(); hintTake(+el.dataset.i); return }
    down0(e)
  }
}
