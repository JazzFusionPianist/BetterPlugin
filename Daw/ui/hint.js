/* ── the command line in cells ──
   A command that deals in exact things is not typed out, it is put together: as a letter is typed, what begins with it
   is listed over the line; what is taken from the list stands in the line as a cell, and the next list holds only what
   can follow — a track, then what is on it (its level, its pan, its prints, its sends, its plug-ins, and of a plug-in
   its controls), a stretch of the song (in the cycle's colour: bars, a marker, the cycle as it stands), how much, and
   last the act. While the act is being chosen the line it would draw is shown dashed on the track's own lane; return
   draws it, in one step of undo, and what was done is said at the far end of the foot.
   A language has its own order — korean says what, where, how much, the act; english the act first — but any order
   that makes sense is taken. A line with no cell in it is read as before (say.js, and Claude where there is one).
   Arrows choose, tab or return takes, escape puts the list away (again: the cells), backspace on nothing takes the last
   cell back, a press on a row takes it.  Draft: design/prompt draft 1 (frame 7, Claude's answer in cells, is not made:
   the app has no way to Claude yet).
   S.line = { parts, done }: a part is {k: who | what | param | where | much | act, t: its words, …}. */
const HINT_MAX = 8
const hintKo = s => /[ㄱ-힝]/.test(s)
/* hangul by its letters, so that a syllable still being typed (저, then 점) finds the word it is on its way to */
const JAMO = ['ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ', 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ', ['', 'ㄱ', 'ㄲ', 'ㄱㅅ', 'ㄴ', 'ㄴㅈ', 'ㄴㅎ', 'ㄷ', 'ㄹ', 'ㄹㄱ', 'ㄹㅁ', 'ㄹㅂ', 'ㄹㅅ', 'ㄹㅌ', 'ㄹㅍ', 'ㄹㅎ', 'ㅁ', 'ㅂ', 'ㅂㅅ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']]
const jamo = s => { let o = ''; for (const ch of String(s).toLowerCase()) { const c = ch.charCodeAt(0) - 0xAC00; o += c >= 0 && c < 11172 ? JAMO[0][Math.floor(c / 588)] + JAMO[1][Math.floor(c / 28) % 21] + JAMO[2][c % 28] : ch } return o }
const begins = (word, typed) => jamo(word).startsWith(jamo(typed))

/* ── the words ── */
const LINE_ACTS = [                                         // v: what it does to a value; ramp: over a stretch, which it needs
  { v: 'gdown', en: 'lower gradually', ko: '점점 줄여줘', sign: -1, ramp: true, d: 'over the stretch' },
  { v: 'gup', en: 'raise gradually', ko: '점점 키워줘', sign: 1, ramp: true, d: 'over the stretch' },
  { v: 'down', en: 'lower', ko: '줄여줘', sign: -1, d: 'for the stretch' },
  { v: 'up', en: 'raise', ko: '키워줘', sign: 1, d: 'for the stretch' },
  { v: 'set', en: 'set to', ko: '맞춰줘', sign: 0, d: 'for the stretch' },
]
const LINE_WHAT = { vol: ['volume', '볼륨'], pan: ['pan', '팬'], tape: ['tape', '테이프'], space: ['space', '스페이스'], delay: ['delay', '딜레이'] }
const lineKo = () => LANG.now === 'ko'
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
const scaleOf = (t, k) => { const ins = fxIns(t, k); return ins && ins.ps ? ins.ps[fxIndex(k)] || null : null }
/* a control's place (0 to 1) as its own number, and back */
const scaleNum = (sc, f) => { const n = sc.nums, x = clamp(f, 0, 1) * (n.length - 1), i = Math.min(n.length - 2, Math.floor(x)); return n[i] + (n[i + 1] - n[i]) * (x - i) }
const scaleAt = (sc, num) => { const n = sc.nums, up = n[n.length - 1] > n[0]; for (let i = 0; i < n.length - 1; i++) { const a = n[i], b = n[i + 1]; if ((up ? num >= a && num <= b : num <= a && num >= b) && a !== b) return (i + (num - a) / (b - a)) / (n.length - 1) } return (up ? num <= n[0] : num >= n[0]) ? 0 : 1 }
/* how a value of the line's thing is said, and in what unit an amount of it is typed */
function lineUnit (t, k) { if (k === 'vol' || /^send/.test(k)) return 'db'; if (FX_KEY.test(k)) { const sc = scaleOf(t, k); return sc && sc.nums ? sc.unit : '%' } return '' }
function lineSays (t, k, v) {
  if (k === 'vol' || /^send/.test(k)) return `${fmtDb(v)} db`
  if (k === 'pan') return panText(v)
  if (FX_KEY.test(k)) { const sc = scaleOf(t, k); return sc && sc.nums ? `${(Math.round(scaleNum(sc, v) * 10) / 10).toFixed(1).replace('-', '−')}${sc.unit ? ' ' + sc.unit : ''}` : `${Math.round(v * 100)} %` }
  return String(Math.round(v))
}
/* a value moved by an amount typed in its unit (sign 0: put at that amount) */
function lineMoved (t, k, v, much, sign) {
  const A = AUTO[k], lim = x => A.inv(clamp(A.f(x), 0, 1))
  if (k === 'pan') return lim(sign ? v + sign * much / 64 : much / 64)
  if (FX_KEY.test(k)) { const sc = scaleOf(t, k); if (sc && sc.nums) return lim(scaleAt(sc, sign ? scaleNum(sc, v) + sign * much : much)); return lim(sign ? v + sign * much / 100 : much / 100) }
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
  const P = S.line.parts, ko = lineKo(), out = [], t = lineTrack(), what = linePart('what'), key = lineKey(), where = linePart('where'), much = linePart('much'), act = linePart('act')
  const add = (words, d, part, given) => out.push({ t: words, d, part: Object.assign({ t: words }, part), given })
  const acts = () => { for (const a of LINE_ACTS) if (!a.ramp || !t || (where && where.b != null)) add(ko ? a.ko : a.en, where ? a.d : '', { k: 'act', v: a.v }) }
  const trackActs = () => { for (const [m, words] of SAY_FIXED) if (m.k === 'verb' && ['mute', 'unmute', 'solo', 'unsolo', 'delete', 'select'].includes(m.v)) add((ko && words.find(hintKo)) || words[0], '', { k: 'act', v: 'say', say: words[0] }) }
  if (!t) {
    S.tracks.forEach((x, i) => { if (x.name) add(String(x.name).toLowerCase(), x.kind === 'stack' ? 'stack' : x.kind === 'bus' ? 'bus' : `track ${pad2(i + 1)}`, { k: 'who', id: x.id }, true) })
    if (!act && !P.length) { acts(); trackActs() }                                   // (english begins with the act)
    return out
  }
  if (act && act.v === 'say') return out                                             // a track and what to do with it: nothing more to say
  if (!what) {
    for (const ins of t.inserts || []) if (!ins.out && ins.name) add(String(ins.name).toLowerCase(), 'plug-in', { k: 'what', plug: ins.n || (ins.n = 1 + Math.max(0, ...t.inserts.map(q => q.n || 0))) }, true)
    add(LINE_WHAT.vol[ko ? 1 : 0], asGiven(lineSays(t, 'vol', shown(t, 'vol'))), { k: 'what', key: 'vol' })
    if (t.kind !== 'stack') add(LINE_WHAT.pan[ko ? 1 : 0], asGiven(panText(shown(t, 'pan'))), { k: 'what', key: 'pan' })
    if (t.patch) for (const k of ['tape', 'space', 'delay']) add(LINE_WHAT[k][ko ? 1 : 0], asGiven(String(Math.round(shown(t, k)))), { k: 'what', key: k })
    ;(t.sends || []).forEach((sd, i) => { const bus = byId(sd.to); if (bus) add(ko ? `${String(bus.name).toLowerCase()} 센드` : `send ${String(bus.name).toLowerCase()}`, asGiven(`${fmtDb(sd.db)} db`), { k: 'what', key: 'send' + i }, true) })
    if (!act) trackActs()
    return out
  }
  if (what.plug && !linePart('param')) {
    const ins = (t.inserts || []).find(x => x.n === what.plug)
    for (const [i, name, , text] of (ins && ins.pl) || []) add(String(name).toLowerCase(), asGiven(String(text == null ? '' : text).toLowerCase()), { k: 'param', key: `fx${what.plug}.${i}`, i }, true)
    return out
  }
  /* the thing is said: where, how much, and the act — numbers are read here, names of places and acts are listed */
  const num = /^([+\-−]?\d+(?:[.,]\d+)?)\s*(db|%|[a-z가-힣]*)$/.exec(typed), span = /^(\d+)\s*[~\-–]\s*(\d+)?$/.exec(typed), unit = lineUnit(t, key)
  if (where && where.open) { const m = /^(\d+)$/.exec(typed); if (m && +m[1] > where.a) add(`${where.a} ~ ${+m[1]}`, 'bars', { k: 'where', a: where.a, b: +m[1], fill: true, typed: true }); return out }
  if (!where) {
    if (span && span[2] && +span[2] > +span[1]) add(`${+span[1]} ~ ${+span[2]}`, 'bars', { k: 'where', a: +span[1], b: +span[2], typed: true })
    else if (span) add(`${+span[1]} ~`, 'then the last bar', { k: 'where', a: +span[1], b: null, open: true, typed: true })
    const n = /^\d+$/.test(typed) ? +typed : null
    if (n != null && n >= 1) {
      if (S.cycle && S.cycle.b > S.cycle.a && Math.round(S.cycle.a) + 1 === n) add(`${n} ~ ${Math.round(S.cycle.b) + 1}`, 'the cycle', { k: 'where', a: n, b: Math.round(S.cycle.b) + 1, typed: true })
      add(`${n} ~ ${ko ? '끝' : 'end'}`, `from bar ${n} on`, { k: 'where', a: n, b: null, typed: true })
      add(`${n} ~`, 'then the last bar', { k: 'where', a: n, b: null, open: true, typed: true })
    }
    if (!num && !span) {
      for (const sc of SCENES) if (sc.name) add(`${String(sc.name).toLowerCase()} ${sc.a + 1} ~ ${sc.b + 1}`, 'marker', { k: 'where', a: sc.a + 1, b: sc.b + 1 }, true)
      if (S.cycle && S.cycle.b > S.cycle.a) add(`${ko ? '사이클' : 'cycle'} ${Math.round(S.cycle.a) + 1} ~ ${Math.round(S.cycle.b) + 1}`, 'the cycle', { k: 'where', a: Math.round(S.cycle.a) + 1, b: Math.round(S.cycle.b) + 1 })
    }
  }
  if (!much && num && (!num[2] || num[2] === unit)) { const v = Math.abs(parseFloat(num[1].replace('−', '-').replace(',', '.'))); if (isFinite(v)) add(`${num[1].replace('-', '−')}${unit ? ' ' + unit : ''}`, 'how much', { k: 'much', v, typed: true }) }
  if (!act && !num && !span) acts()
  return out
}
/* what is offered for the letters typed: a number is read (its rows are made for it); a word must begin a row, or a word inside one */
function lineList (typed) {
  const all = lineOffers(typed)
  if (!typed) return all
  const rows = all.filter(x => x.part.typed)
  if (rows.length) return rows
  const a = all.filter(x => begins(x.t, typed)), b = typed.includes(' ') ? [] : all.filter(x => !begins(x.t, typed) && x.t.split(' ').some(w => begins(w, typed)))
  return a.concat(b)
}
/* the list for the line as it stands now; `open`: also with nothing typed, where what follows is a short list of its own */
function hintFresh (open) {
  const cmd = $('cmd'), was = S.hint, L = S.line
  S.hint = null
  if (document.activeElement === cmd && !L.done) {
    const typed = cmd.value.trim().toLowerCase(), t = lineTrack(), what = linePart('what')
    const short = open === true && !typed && t && (!what || (what.plug && !linePart('param')) || (lineKey() && linePart('much') && !linePart('act')))
    if (typed || short) {
      const items = lineList(typed).slice(0, HINT_MAX)
      if (items.length) { const keep = was ? items.findIndex(x => x.t === (was.items[was.at] || {}).t) : -1; S.hint = { items, at: Math.max(0, keep) } }
    }
  }
  uiDirty('hint', 'cmd')
}
/* a row taken: it stands in the line as a cell; a plug-in then says its controls, a control how it reads */
async function hintTake (i) {
  const h = S.hint, it = h && h.items[i == null ? h.at : i], cmd = $('cmd'), L = S.line
  if (!it) return
  if (it.part.fill) L.parts = L.parts.filter(p => p.k !== 'where')                    // (the last bar of a stretch begun: the two are one cell)
  L.parts.push(it.part)
  cmd.value = ''; S.hint = null; S.last = null                                       // (what an earlier line did is no longer what the foot is about)
  cmd.focus()
  const t = lineTrack(), key = lineKey()
  if (t && key) { if (!S.auto) toggleAuto(); t.ap = key; uiDirty('lanes', 'head') }   // the thing's own line is on show while the line is about it
  if (t && it.part.k === 'what' && it.part.plug) await fxParams(t, t.inserts.find(x => x.n === it.part.plug))
  if (t && it.part.k === 'param') { const ins = fxIns(t, it.part.key); if (ins) { ins.pn = ins.pn || {}; ins.pv = ins.pv || {}; ins.pn[it.part.i] = it.part.t; const row = (ins.pl || []).find(r => r[0] === it.part.i); if (row && ins.pv[it.part.i] == null) ins.pv[it.part.i] = clamp(+row[2] || 0, 0, 1); await fxScale(t, ins, it.part.i) } }
  hintFresh(true)
}

/* ── what the line would do: the thing's line as it would stand afterwards ── */
const ptsAt = (pts, pos, still) => { if (!pts.length) return still; if (pos <= pts[0].b) return pts[0].v; const n = pts.length; if (pos >= pts[n - 1].b) return pts[n - 1].v; let i = 1; while (pts[i].b < pos) i++; const a = pts[i - 1], b = pts[i], span = b.b - a.b; return span > 1e-9 ? a.v + (b.v - a.v) * (pos - a.b) / span : b.v }
function lineAfter (actV) {
  const t = lineTrack(), k = lineKey(), where = linePart('where'), much = linePart('much'), act = LINE_ACTS.find(a => a.v === actV)
  if (!t || !k || !AUTO[k] || !much || !act || (where && where.open) || (act.ramp && !(where && where.b != null))) return null
  const A = AUTO[k], old = autoPts(t, k).map(q => ({ id: q.id, b: q.b, v: q.v })), still = A.now(t), mv = v => lineMoved(t, k, v, much.v, act.sign), E = 1e-9
  if (!where) return old.length ? { t, k, pts: old.map(q => Object.assign(q, { v: mv(q.v) })), from: ptsAt(old, curPos(), still), to: mv(ptsAt(old, curPos(), still)) } : { t, k, pts: null, from: still, to: mv(still) }
  const a = clamp(where.a - 1, 0, SONG_END), b = where.b == null ? null : clamp(where.b - 1, a, SONG_END), va = ptsAt(old, a, still), vb = b == null ? null : ptsAt(old, b, still)
  const before = old.filter(q => q.b < a - E), inside = old.filter(q => q.b > a + E && (b == null || q.b < b - E)), after = b == null ? [] : old.filter(q => q.b > b + E)
  let pts
  if (act.ramp) {                                           // over the stretch: from where it is to as much lower at its end, and it stays there
    const part = q => (q.b - a) / (b - a)
    pts = before.concat([{ b: a, v: va }], inside.map(q => ({ id: q.id, b: q.b, v: lineMoved(t, k, q.v, much.v * part(q), act.sign) })), [{ b, v: mv(vb) }], after.map(q => ({ id: q.id, b: q.b, v: mv(q.v) })))
  } else if (b == null) pts = before.concat([{ b: a, v: va }, { b: a, v: mv(va) }], inside.map(q => ({ id: q.id, b: q.b, v: mv(q.v) })))      // from that bar on
  else pts = before.concat([{ b: a, v: va }, { b: a, v: mv(va) }], inside.map(q => ({ id: q.id, b: q.b, v: mv(q.v) })), [{ b, v: mv(vb) }, { b, v: vb }], after)      // for the stretch, and back
  return { t, k, pts, from: va, to: mv(act.ramp ? vb : va) }
}
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
  if (r.pts) t.autos[r.k] = r.pts.map(q => ({ id: q.id || ++PID, b: q.b, v: q.v }))
  else if (r.k === 'vol') t.vol = r.to
  else if (r.k === 'pan') t.pan = r.to
  else if (/^send/.test(r.k)) t.sends[+r.k.slice(4)].db = r.to
  else if (FX_KEY.test(r.k)) t.autos[r.k] = [{ id: ++PID, b: 0, v: r.to }]              // a control of a plug-in keeps where it is put as a line of one point
  else setPrint(t, r.k, r.to)
  t.ap = r.k
  commit(before); pushTrack(t); resyncSoon()
  L.done = true
  S.last = { say: `${autoName(t, r.k)}  ${lineSays(t, r.k, r.from)}  ${lineKo() ? '→' : 'to'}  ${lineSays(t, r.k, r.to)}`, far: true }
  uiDirty('hint', 'cmd', 'lanes', 'head', 'dock')
  return true
}

/* ── drawn: the cells in the foot, the list over them, and on the lanes the stretch and the line that would be drawn ── */
function lineCells () {
  const P = S.line.parts, fy = H - FOOT_H, cy = fy + 3, h = 16
  let s = '', x = 26, i = 0
  while (i < P.length) {
    const p = P[i]
    if (p.k === 'who' || p.k === 'what' || p.k === 'param') { const run = []; while (i < P.length && ['who', 'what', 'param'].includes(P[i].k)) run.push({ t: asGiven(P[i++].t) }); const [g, w] = cells(x, cy, h, run, { size: 9.5, pad: 7, a: .9, frame: .3 }); s += g; x += w + 6; continue }
    const w = Math.round(tw(asGiven(p.t), 9.5, p.k === 'act' ? 500 : 400) + 14)
    if (p.k === 'where') s += R(x + .5, cy + .5, w - 1, h - 1, { rx: 2, stroke: SOLO, sa: .7 }) + T(x + 7, cy + h / 2 + 3.3, asGiven(p.t), { size: 9.5, c: SOLO })
    else if (p.k === 'act') s += R(x, cy, w, h, { rx: 2, fill: INK }) + T(x + 7, cy + h / 2 + 3.3, asGiven(p.t), { size: 9.5, w: 500, c: K1 })
    else s += R(x + .5, cy + .5, w - 1, h - 1, { rx: 2, stroke: INK, sa: .3 }) + T(x + 7, cy + h / 2 + 3.3, asGiven(p.t), { size: 9.5, a: .9 })
    x += w + 6; i++
  }
  return [s, P.length ? x : 26]
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
    const hov = h && h.items[h.at] && h.items[h.at].part.k === 'act' ? h.items[h.at].part.v : act ? act.v : null, r = hov && hov !== 'say' && key && AUTO[key] ? lineAfter(hov) : null
    if (r && S.auto && apOf(t) === key) {
      const g = autoGeom(t, y, rh), pts = r.pts || [{ b: 0, v: r.to }]
      let d = `M${X0 - 2} ${n(g.yOf(pts[0].v))}`
      for (const q of pts) d += `L${n(bx(q.b + 1))} ${n(g.yOf(q.v))}`
      d += `L${X1 + 2} ${n(g.yOf(pts[pts.length - 1].v))}`
      lanes += P(d, { stroke: K0, sa: .7, sw: 3 }) + P(d, { stroke: INK, sa: .95, sw: 1.2, dash: '3 3', x: ' id="line-would"' })
    }
    s += G(lanes, '', LN)
  }
  if (!h) return s
  const rowH_ = 20, wide = Math.max(...h.items.map(it => tw(asGiven(it.t), 10.5, 500) + (it.d ? tw(it.d, 9.5) + 26 : 0)))
  const w = clamp(Math.ceil(wide) + 30, 150, 360), hh = h.items.length * rowH_ + 12
  const x = clamp(x0 - 13, 8, RX - w - 8), y = H - FOOT_H - hh - 4, typed = cmd.value.trim().toLowerCase()
  s += R(x, y, w, hh, { rx: 3, fill: K2 }) + R(x + .5, y + .5, w - 1, hh - 1, { rx: 3, stroke: INK, sa: .28 })
  let ry = y + 6
  h.items.forEach((it, i) => {
    const on = i === h.at, wt = on ? 500 : 400
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
