/* ── the command line, past its plain cases ──
   What is typed is cut into the words it knows — english and korean, particles and all — and read as: what is meant
   (this, a track by any word for it, all the voices), a place or a stretch of the song (here, bar 17, the second chorus,
   from here to the end, the cycle), what to do (cut, mute, delete, once more, copy, move, fade, quantize, choose, louder,
   send, stack) and by how much. One word it does not know and the line is not for here: Claude reads it, where there is
   one. What is read comes out as the same small actions Claude is asked for, so both speak one language, and each is
   carried out by the room's own hands (act, timeAct, edit): a command does what its key does, and counts as one step. */
const SAY = { ask: null, vocab: null, sig: '' }
/* a family of tracks, and the words for it; words that mean the same thing (the first is the one a name is read as) */
const SAY_FAM = { drums: ['drums', 'drum', '드럼'], bass: ['bass', '베이스'], vox: ['vox', 'vocals', 'vocal', 'voices', 'voice', '보컬', '목소리'], gtr: ['gtr', 'guitars', 'guitar', '기타'], keys: ['keys', 'keyboards', 'keyboard', '건반', '키보드'], fx: ['fx', 'effects', '효과음'], bus: ['bus', 'buses', 'busses', 'aux', '버스'] }
const SAY_SAME = [['kick', '킥', 'bd'], ['snare', '스네어'], ['hat', 'hats', 'hihat', 'hi-hat', '하이햇', '햇'], ['tom', 'toms', '탐'], ['overheads', 'overhead', 'oh', '오버헤드'], ['room', '룸'], ['lead', '리드', '메인', 'main'], ['backing', 'bgv', 'bv', '백킹', '화음'], ['double', 'dbl', '더블'], ['left', '왼쪽'], ['right', '오른쪽'], ['piano', '피아노'], ['pad', '패드'], ['synth', '신스'], ['strings', 'string', '스트링'], ['organ', '오르간'], ['rhodes', '로즈'], ['acoustic', '어쿠스틱', '통기타'], ['electric', '일렉'], ['plate', '플레이트'], ['reverb', 'verb', '리버브'], ['delay', 'echo', '딜레이', '에코'], ['slap', '슬랩'], ['perc', 'percussion', '퍼커션'], ['clap', '클랩'], ['sub', '서브'], ['adlib', 'adlibs', '애드립'], ['harmony', 'harm', '하모니'], ['choir', '합창'], ['stack', '스택']]
/* the parts of a song, and the words for them: a marker is found by its own name, or by one of these */
const SAY_SECT = { intro: ['intro', '인트로'], verse: ['verse', '벌스'], pre: ['pre', 'pre-chorus', 'prechorus', 'pre chorus', '프리코러스', '프리'], chorus: ['chorus', '코러스', '후렴', '싸비', '사비', 'hook', '훅'], bridge: ['bridge', '브리지', '브릿지'], out: ['out', 'outro', '아웃트로', '아우트로', 'ending', '엔딩'], break: ['break', '브레이크'], interlude: ['interlude', '간주'], drop: ['drop', '드롭'] }
const SAY_FIXED = [
  [{ k: 'sel' }, ['this', 'these', 'it', 'them', 'the selection', 'selection', 'selected', '이거', '이것', '이것들', '이거들', '얘네', '얘', '선택한 거', '선택한 것', '선택된 거', '선택한 리전', '선택한 부분', '선택한']],
  [{ k: 'all' }, ['all of', 'all the', 'all', 'every', 'everything', 'both', '전부', '모두', '전체', '싹 다', '다']],
  [{ k: 'here' }, ['here', 'now', 'the playhead', 'playhead', '여기', '지금', '재생선', '재생 위치', '현재 위치']],
  [{ k: 'start' }, ['the start', 'the beginning', 'the top', 'start', 'beginning', '처음', '맨 앞', '맨앞']],
  [{ k: 'end' }, ['the end', 'end', '끝', '맨 끝', '맨끝']],
  [{ k: 'cycle' }, ['the cycle', 'cycle', 'locators', '사이클']],
  [{ k: 'ord', v: 1 }, ['first', '1st', '첫 번째', '첫번째', '첫']], [{ k: 'ord', v: 2 }, ['second', '2nd', '두 번째', '두번째', '둘째']], [{ k: 'ord', v: 3 }, ['third', '3rd', '세 번째', '세번째', '셋째']], [{ k: 'ord', v: 4 }, ['fourth', '4th', '네 번째', '네번째', '넷째']],
  [{ k: 'ord', v: 'last' }, ['last', '마지막']], [{ k: 'ord', v: 'next' }, ['next', '다음']], [{ k: 'ord', v: 'prev' }, ['previous', 'prev', '이전']],
  [{ k: 'role', v: 'from' }, ['from', 'since']], [{ k: 'role', v: 'from', post: 1 }, ['부터', '에서부터']], [{ k: 'role', v: 'in', post: 1 }, ['에서']],
  [{ k: 'role', v: 'to' }, ['to', 'until', 'till']], [{ k: 'role', v: 'thru' }, ['through', 'thru']], [{ k: 'role', v: 'to', post: 1 }, ['까지']],
  [{ k: 'role', v: 'at' }, ['at', 'into', 'onto', 'in', 'on']], [{ k: 'role', v: 'at', post: 1 }, ['에다가', '에다', '에', '으로', '로']],
  [{ k: 'and' }, ['and', '&']], [{ k: 'and', post: 1 }, ['이랑', '랑', '하고', '와', '과']], [{ k: 'pl', post: 1 }, ['들']],
  [{ k: 'then' }, ['then', 'and then', '그리고 나서', '그리고', '그 다음에', '그 다음', '그다음']],
  [{ k: 'fill', post: 1 }, ['을', '를', '은', '는', '이', '가', '의', '도', '만']],
  [{ k: 'fill' }, ['the', 'a', 'an', 'of', 'for', 'my', 'please', 'pls', 'track', 'tracks', 'region', 'regions', '좀', '트랙', '리전', '해줘', '해 줘', '해줄래', '해주세요', '해라', '해', '줘', '줄래', '주세요', '하게']],
  [{ k: 'unit', v: 'db' }, ['db', 'decibels', '데시벨', '디비']], [{ k: 'unit', v: 'bar' }, ['bars', 'bar', '마디']], [{ k: 'unit', v: 'beat' }, ['beats', 'beat', '박자', '박']],
  [{ k: 'unit', v: 'times' }, ['times', 'time', '번', '회']], [{ k: 'unit', v: 'verse' }, ['절']], [{ k: 'unit', v: 'nth' }, ['번째']],
  [{ k: 'num', v: 2, unit: 'times' }, ['twice', '두 번', '두번']], [{ k: 'num', v: 3, unit: 'times' }, ['three times', '세 번', '세번']], [{ k: 'num', v: 4, unit: 'times' }, ['네 번', '네번']],
  [{ k: 'mod', v: 'half' }, ['in half', 'in halves', 'half', '반으로', '절반으로', '절반', '반']],
  [{ k: 'mod', v: 'up' }, ['up', 'louder', 'raise', '올려', '올리', '키워', '키우', '크게', '업']], [{ k: 'mod', v: 'down' }, ['down', 'quieter', 'lower', '내려', '내리', '줄여', '줄이', '낮춰', '낮추', '작게', '다운']],
  [{ k: 'verb', v: 'cut' }, ['cut', 'split', 'slice', 'chop', '잘라', '자르기', '자르', '컷', '나눠', '나누', '쪼개']],
  [{ k: 'verb', v: 'unmute' }, ['unmute', '언뮤트', '뮤트 해제', '뮤트해제', '뮤트 풀어', '뮤트 풀']], [{ k: 'verb', v: 'mute' }, ['mute', '뮤트', '음소거']],
  [{ k: 'verb', v: 'unsolo' }, ['unsolo', '솔로 해제', '솔로해제', '솔로 풀어', '솔로 풀']], [{ k: 'verb', v: 'solo' }, ['solo', '솔로']],
  [{ k: 'verb', v: 'delete' }, ['delete', 'remove', 'erase', 'clear', '지워', '지우', '삭제', '없애']],
  [{ k: 'verb', v: 'again' }, ['once more', 'one more time', 'again', 'repeat', 'duplicate', '한 번 더', '한번 더', '한번더', '반복', '다시', '복제']],
  [{ k: 'verb', v: 'copy' }, ['copy', '복사']], [{ k: 'verb', v: 'move' }, ['move', '옮겨', '옮기', '이동']],
  [{ k: 'verb', v: 'fadein' }, ['fade in', 'fadein', '페이드 인', '페이드인']], [{ k: 'verb', v: 'fadeout' }, ['fade out', 'fadeout', '페이드 아웃', '페이드아웃']],
  [{ k: 'verb', v: 'quantize' }, ['quantize', 'quantise', '퀀타이즈', '퀀타']], [{ k: 'verb', v: 'select' }, ['select', 'choose', 'pick', '선택', '골라', '고르']],
  [{ k: 'verb', v: 'send' }, ['send', '보내', '센드']], [{ k: 'verb', v: 'group' }, ['group', 'bus together', 'put together', '묶어', '묶']],
  [{ k: 'verb', v: 'goto' }, ['go to', 'goto', 'jump to', '가', '이동해']], [{ k: 'verb', v: 'loop' }, ['loop']],
]
const SAY_MANY = ['drums', '드럼', 'vocals', 'voices', 'guitars', 'keys', 'keyboards', 'effects', 'buses', 'busses']      // said like this, a family is all of its tracks; said as one (보컬, kick), it is asked which
const sayStem = w => { for (const f in SAY_FAM) if (SAY_FAM[f].includes(w)) return f; for (const g of SAY_SAME) if (g.includes(w)) return g[0]; return w }
const sayWords = name => String(name).toLowerCase().split(/[^a-z0-9가-힣'’-]+/).filter(w => w.length > 1 || /\d/.test(w))
/* what a track answers to: its name whole, each word of it, and its family */
function sayKeys (t) { const ks = new Set(sayWords(t.name).map(sayStem)); const fam = t.kind === 'bus' ? 'bus' : t.kind === 'stack' ? 'stack' : famByName(t.name) || t.tone || null; if (fam) ks.add(fam); return ks }
/* a marker's name as it is asked for: the part of the song it is, without the number it may carry */
function saySect (name) { const s = String(name).toLowerCase().replace(/\s*\d+$/, '').trim(); for (const k in SAY_SECT) if (SAY_SECT[k].includes(s)) return k; return s }
/* every word the line may hold, longest first: the tracks' and the markers' names are read off the song as it is now */
function sayVocab () {
  const sig = S.tracks.map(t => t.id + t.name).join('|') + '#' + SCENES.map(s => s.name).join('|')
  if (SAY.vocab && SAY.sig === sig) return SAY.vocab
  const V = new Map(), put = (w, tok) => { w = String(w).toLowerCase().trim(); if (w && !V.has(w)) V.set(w, tok) }
  for (const [tok, ws] of SAY_FIXED) for (const w of ws) put(w, tok)
  for (const sc of SCENES) { const st = saySect(sc.name); if (st) put(st, { k: 'sect', v: st }); put(sc.name, { k: 'sect', v: st, n: +(String(sc.name).match(/(\d+)$/) || [])[1] || 0 }) }
  for (const k in SAY_SECT) for (const w of SAY_SECT[k]) put(w, { k: 'sect', v: k })
  for (const t of S.tracks) put(t.name, { k: 'name', id: t.id })
  for (const t of S.tracks) for (const w of sayWords(t.name)) put(w, { k: 'trk', v: sayStem(w) })
  for (const f in SAY_FAM) for (const w of SAY_FAM[f]) put(w, { k: 'trk', v: f, fam: 1, many: SAY_MANY.includes(w) })
  for (const g of SAY_SAME) for (const w of g) put(w, { k: 'trk', v: g[0] })
  SAY.vocab = [...V.entries()].sort((a, b) => b[0].length - a[0].length); SAY.sig = sig
  return SAY.vocab
}
/* the line cut into words. A korean particle counts only stuck to the word before it; an english word only on its own.
   A verb may carry an ending: "and then" (내리고, 묶어서) or a plain asking (해줘) */
function sayLex (s) {
  const V = sayVocab(), out = [], isA = c => /[a-z0-9]/.test(c || '')
  let i = 0, glued = false
  while (i < s.length) {
    const c = s[i]
    if (c === ' ') { i++; glued = false; continue }
    if (c === ',' ) { out.push({ k: 'and', raw: c, at: i }); i++; glued = false; continue }
    if (/[.!?]/.test(c) && !/\d/.test(s[i + 1] || '')) { i++; continue }
    const last = out[out.length - 1]
    if ((c === '~' || (c === '-' && last && last.k === 'num' && /\d/.test(s[i + 1] || '') && glued)) && last) { out.push({ k: 'role', v: 'to', at: i }); i++; continue }
    let m = /^1\/(4|8|16|32)(?![\d])/.exec(s.slice(i))
    if (m && !isA(s[i - 1])) { out.push({ k: 'grid', v: 1 / +m[1], at: i, raw: m[0] }); i += m[0].length; glued = true; continue }
    m = /^[+-]?\d+(?:\.\d+)?/.exec(s.slice(i))
    if (m && !isA(s[i - 1]) && (/\d/.test(c) || !glued)) { out.push({ k: 'num', v: +m[0], signed: /^[+-]/.test(m[0]), raw: m[0], at: i }); i += m[0].length; glued = true; continue }
    if (c === '-' || c === '+') { i++; continue }
    const hit = V.find(([w, tok]) => s.startsWith(w, i) && (/^[\x00-\x7f]+$/.test(w) ? !(tok.k === 'unit' ? /[a-z]/ : /[a-z0-9]/).test(s[i - 1] || '') && !isA(s[i + w.length]) : !tok.post || glued))      // (a unit may stand right after its number: 3db)
    if (!hit) { const e = s.indexOf(' ', i); out.push({ k: 'raw', raw: s.slice(i, e < 0 ? s.length : e), at: i }); i = e < 0 ? s.length : e; glued = false; continue }
    const tok = Object.assign({ raw: hit[0], at: i, end: i + hit[0].length }, hit[1])
    i += hit[0].length; glued = true
    if (tok.k === 'verb' || tok.k === 'mod') {
      const rest = s.slice(i), th = /^(하고 나서|하고|해서|고서|고|서)(?=\s|,|$)/.exec(rest), pl = th ? null : /^(해 ?주세요|해 ?줄래|해 ?줘|해라|해요|해|줘|줄래|주세요|라|요|하기)(?=\s|[,.!?]|$)/.exec(rest)
      if (th) { tok.then = true; i += th[0].length } else if (pl) i += pl[0].length
    }
    out.push(tok)
  }
  return out
}
/* ── what is meant ── */
/* the tracks a few words stand for: every word must be one the track answers to */
function sayTracks (words) { return S.tracks.filter(t => { const ks = sayKeys(t); return words.every(w => ks.has(w)) }) }
/* a part of the song by its name; several of that name are told apart by their order (the second chorus, 2절 코러스,
   the last one, the next one) — and with nothing said, the one the playhead is in, or else comes to next */
function sayScene (stem, ord, own) {
  const all = SCENES.filter(sc => saySect(sc.name) === stem)
  if (!all.length) return null
  if (own) { const ex = all.find(sc => +(String(sc.name).match(/(\d+)$/) || [])[1] === own); if (ex) return ex }
  const p = curPos() + 1, cur = all.findIndex(sc => p >= sc.a - 1e-6 && p < sc.b - 1e-6), nxt = all.findIndex(sc => sc.a > p + 1e-6)
  if (ord === 'last') return all[all.length - 1]
  if (ord === 'next') return all[nxt < 0 ? all.length - 1 : nxt]
  if (ord === 'prev') { const before = all.filter(sc => sc.b <= p + 1e-6); return before[before.length - 1] || all[0] }
  if (typeof ord === 'number') return all[ord - 1] || null
  return all[cur >= 0 ? cur : nxt >= 0 ? nxt : 0]
}
const sayBar = v => { const b = Math.floor(v + 1e-9), beat = Math.round((v - b) * 10); return clamp(b - 1 + (clamp(beat || 1, 1, BEATS()) - 1) / BEATS(), 0, SONG_END) }
const SAY_FAM_NAME = { drums: 'drums', bass: 'bass', vox: 'vocals', gtr: 'guitars', keys: 'keys', fx: 'effects' }
const sayList = ts => ts.length <= 3 ? ts.map(t => t.name).join(', ') : `${ts.length} tracks`
/* one stretch of words up to an "and then": its things (who, where, what, how much), then what they come to */
function sayClause (toks, who0, s, made0) {
  const items = []
  let i = 0, pre = null
  const role = () => { const t = toks[i]; if (t && t.k === 'role' && t.post) { i++; return t.v } const r = pre; pre = null; return r }
  const skipFill = () => { while (toks[i] && toks[i].k === 'fill') i++ }
  while (i < toks.length) {
    const t = toks[i]
    if (t.k === 'fill' || t.k === 'pl') { i++; continue }
    if (t.k === 'role') { pre = t.v; i++; continue }
    if (t.k === 'and') { i++; continue }
    if (t.k === 'verb' || t.k === 'mod' || t.k === 'grid') { items.push({ t: t.k, v: t.v }); i++; pre = null; continue }
    if (t.k === 'sel') { i++; items.push({ t: 'who', sel: true, role: role() }); continue }
    if (t.k === 'here') { i++; items.push({ t: 'place', pos: curPos(), role: role() }); continue }
    if (t.k === 'start') { i++; items.push({ t: 'place', pos: 0, role: role() }); continue }
    if (t.k === 'end') { i++; items.push({ t: 'place', pos: songEnd(), end: true, role: role() }); continue }
    if (t.k === 'cycle') { i++; if (!(S.cycle.b - S.cycle.a >= MIN_LEN)) return { say: 'no cycle is set' }; items.push({ t: 'place', span: [S.cycle.a, S.cycle.b], name: 'the cycle', role: role() }); continue }
    /* a part of the song: [second] chorus [2], or 2절 [코러스] */
    if (t.k === 'ord' || t.k === 'sect' || (t.k === 'num' && toks[i + 1] && toks[i + 1].k === 'unit' && (toks[i + 1].v === 'verse' || toks[i + 1].v === 'nth'))) {
      let ord = null, stem = null, own = 0
      if (t.k === 'ord') { ord = t.v; i++ } else if (t.k === 'num') { ord = t.v; stem = toks[i + 1].v === 'verse' ? 'verse' : null; i += 2 }
      skipFill()
      if (toks[i] && toks[i].k === 'sect') { stem = toks[i].v; own = toks[i].n || 0; i++; const n = toks[i]; if (n && n.k === 'num' && !n.signed && Number.isInteger(n.v) && n.v < 10 && !(toks[i + 1] && toks[i + 1].k === 'unit')) { if (ord == null) ord = n.v; i++ } }
      if (!stem) { if (ord === 'last') { items.push({ t: 'place', pos: songEnd(), end: true, role: role() }); continue } return null }
      const sc = sayScene(stem, ord, ord == null ? own : 0)
      if (!sc) return { say: `no marker called ${stem}` }
      items.push({ t: 'place', span: [sc.a - 1, Math.min(SONG_END, sc.b - 1)], scene: sc.i, name: sc.name, role: role() }); continue
    }
    if (t.k === 'unit' && t.v === 'bar' && toks[i + 1] && toks[i + 1].k === 'num') { i++; const n = toks[i++]; items.push({ t: 'place', pos: sayBar(n.v), bar: Number.isInteger(n.v), role: role() }); continue }      // "bar 17"
    if (t.k === 'num') {
      i++
      const u = toks[i] && toks[i].k === 'unit' ? toks[i].v : t.unit || null
      if (toks[i] && toks[i].k === 'unit') i++
      const r = role(), nextTo = toks[i] && toks[i].k === 'role' && (toks[i].v === 'to' || toks[i].v === 'thru') && !toks[i].post
      if ((u === 'bar' || u == null) && !t.signed && (r || nextTo)) { items.push({ t: 'place', pos: sayBar(t.v), bar: Number.isInteger(t.v), role: r }); continue }
      items.push({ t: 'amt', n: t.v, unit: u, signed: t.signed, role: r }); continue
    }
    if (t.k === 'unit') { i++; continue }
    /* a track, or several: words for it, "all", "and" between two of them */
    if (t.k === 'trk' || t.k === 'name' || t.k === 'all') {
      const parts = [[]], from = t.at
      let all = false, last = t
      while (toks[i] && (toks[i].k === 'trk' || toks[i].k === 'name' || toks[i].k === 'all' || toks[i].k === 'pl' || (toks[i].k === 'fill' && !toks[i].post && toks[i + 1] && (toks[i + 1].k === 'trk' || toks[i + 1].k === 'name' || toks[i + 1].k === 'all')) || (toks[i].k === 'and' && toks[i + 1] && (toks[i + 1].k === 'trk' || toks[i + 1].k === 'name')))) {
        const x = toks[i++]
        if (x.k === 'and') parts.push([]); else if (x.k === 'all' || x.k === 'pl') all = true; else if (x.k !== 'fill') { parts[parts.length - 1].push(x); last = x }
      }
      const r = role(), got = []
      if (parts.every(p => !p.length)) { items.push({ t: 'who', all: true, role: r }); continue }
      for (const p of parts) {
        if (!p.length) continue
        const nm = p.find(x => x.k === 'name'), ts = nm ? S.tracks.filter(x => x.id === nm.id) : sayTracks(p.map(x => x.v)), word = p.map(x => x.raw).join(' ')
        if (!ts.length) { got.none = word; continue }
        if (ts.length > 1 && !all && !(p.length === 1 && p[0].many)) return { ask: { q: `which ${word}: ${ts.length <= 4 ? ts.map(x => x.name).join(', ') : ts.length + ' tracks'}, or all`, among: ts.map(x => x.id), from: p[0].at, to: p[p.length - 1].end, s } }
        for (const x of ts) if (!got.includes(x)) got.push(x)
      }
      items.push({ t: 'who', ids: got.map(x => x.id), none: got.none || '', word: parts.flat().map(x => x.v), fam: parts.length === 1 && parts[0].length === 1 && parts[0][0].fam ? parts[0][0].v : null, role: r }); continue
    }
    return null
  }
  /* what they come to */
  const verbs = items.filter(x => x.t === 'verb').map(x => x.v), mods = items.filter(x => x.t === 'mod').map(x => x.v), amts = items.filter(x => x.t === 'amt'), grid = (items.find(x => x.t === 'grid') || {}).v
  const routing = verbs.includes('send') || verbs.includes('group')
  let whos = items.filter(x => x.t === 'who'), dest = null
  if (routing) { dest = whos.find(x => x.role === 'at' || x.role === 'to') || null; whos = whos.filter(x => x !== dest) }
  { const lost = whos.find(x => x.none); if (lost) return { say: `no track called ${lost.none}` } }
  let who = whos.length ? (whos.some(x => x.sel) ? { sel: true } : whos.some(x => x.all) ? { all: true } : { tracks: [...new Set(whos.flatMap(x => x.ids))].map(id => byId(id).name), fam: whos.length === 1 ? whos[0].fam : null }) : null
  const said = !!who
  if (!who && who0) who = who0
  const places = items.filter(x => x.t === 'place'), at0 = x => x.span ? x.span[0] : x.pos
  const from = places.find(x => x.role === 'from') || (places.some(x => x.role === 'to' || x.role === 'thru') ? places.find(x => x.role === 'in' || (x.role == null && places.indexOf(x) === 0 && places.length > 1)) : null)
  const to = places.find(x => (x.role === 'to' || x.role === 'thru') && x !== from)
  const wantsDest = verbs.some(v => v === 'move' || v === 'copy' || v === 'again')
  let span = null, name = '', destPos = null
  if (from || (to && !wantsDest) || (to && from)) {
    const a = from ? at0(from) : curPos(), b = to ? (to.span && to.role === 'thru' ? to.span[1] : to.bar ? Math.min(SONG_END, to.pos + 1) : at0(to)) : songEnd()      // (a bar named as the end is in the stretch: 17 to 24 is eight bars; up to a marker is up to where it begins)
    if (!(Math.abs(b - a) >= MIN_LEN)) return { say: 'that stretch is empty' }
    span = [Math.min(a, b), Math.max(a, b)]
  }
  for (const p of places) {
    if (p === from || (p === to && span)) continue
    if ((p.role === 'at' || p.role === 'to') && wantsDest && destPos == null) { destPos = at0(p); continue }
    if (p.span && !span) { span = p.span.slice(); name = p.name || ''; continue }
    if (p.pos != null && destPos == null) destPos = p.pos
  }
  const db = amts.find(x => x.unit === 'db') || amts.find(x => x.unit == null && (mods.includes('up') || mods.includes('down') || x.signed)), times = amts.find(x => x.unit === 'times'), len = amts.find(x => x.unit === 'bar' || x.unit === 'beat')
  const lenBars = len ? (len.unit === 'beat' ? len.n / BEATS() : len.n) : null
  const acts = [], v = verbs[0], names = who && who.tracks ? who.tracks : null, more = {}
  if (who) more.who = who; if (span) more.span = span; if (name) more.name = name
  if (verbs.length > 1 && !(verbs.includes('group') && verbs.includes('send'))) return null
  if (!v) {
    if (mods.includes('half')) return null
    if ((mods.includes('up') || mods.includes('down') || (db && db.signed)) && db) {                 // louder, quieter: a track's fader, or the chosen regions' gain
      const d = mods.includes('down') ? -Math.abs(db.n) : mods.includes('up') ? Math.abs(db.n) : db.n
      if (names) { for (const n of names) acts.push({ do: 'volume', track: n, db: d, mode: 'relative' }); if (names.length > 1) acts.unshift({ do: 'note', text: `${names.length} tracks ${d > 0 ? '+' : '−'}${Math.abs(d)} db` }) }
      else if (who && who.all) for (const t of S.tracks.filter(x => x.kind !== 'bus')) acts.push({ do: 'volume', track: t.name, db: d, mode: 'relative' })
      else acts.push({ do: 'gain', db: d })
      return { acts, who: said ? who : who0 }
    }
    if (items.length === places.length && places.length === 1 && !who) {                              // a place and nothing else: the playhead goes there
      const p = places[0]
      return { acts: [p.scene != null ? { do: 'goto', scene: p.scene } : { do: 'jump', pos: at0(p) }] }
    }
    return null
  }
  if (v === 'goto' || v === 'loop') { const p = places[0]; if (!p) return null; return { acts: [v === 'loop' ? (p.scene != null ? { do: 'goto', scene: p.scene, loop: true } : p.span ? { do: 'cyclespan', span: p.span } : null) : p.scene != null ? { do: 'goto', scene: p.scene } : { do: 'jump', pos: at0(p) }].filter(Boolean) } }
  if (v === 'cut') acts.push(Object.assign(mods.includes('half') ? { do: 'halve' } : { do: 'cut', at: span ? null : destPos }, more))
  else if (v === 'mute' || v === 'unmute' || v === 'solo' || v === 'unsolo') {
    const many = names && !span ? names : who && who.all && !span ? S.tracks.map(t => t.name) : null
    if (many) { if (many.length > 1) acts.push({ do: 'note', text: `${many.length} tracks ${v === 'mute' ? 'muted' : v === 'unmute' ? 'unmuted' : v}` }); for (const n of many) acts.push({ do: v, track: n }) }      // tracks named, and no stretch: their own m and s
    else if (v === 'mute' || v === 'unmute') acts.push(Object.assign({ do: 'regmute', on: v === 'mute' }, more))
    else return null
  }
  else if (v === 'delete') acts.push(Object.assign({ do: 'delete' }, more))
  else if (v === 'again') acts.push(Object.assign({ do: 'again', times: times ? clamp(Math.round(times.n), 1, 32) : 1 }, destPos != null ? { to: destPos } : {}, more))
  else if (v === 'copy') { if (destPos == null) return { say: 'copy it to where' }; acts.push(Object.assign({ do: 'copyto', to: destPos }, more)) }
  else if (v === 'move') { if (destPos == null) return { say: 'move it to where' }; acts.push(Object.assign({ do: 'moveto', to: destPos }, more)) }
  else if (v === 'fadein' || v === 'fadeout') acts.push(Object.assign({ do: 'fade', out: v === 'fadeout' }, lenBars != null ? { bars: lenBars } : {}, more))
  else if (v === 'quantize') acts.push(Object.assign({ do: 'quantize' }, grid ? { grid } : {}, more))
  else if (v === 'select') acts.push(Object.assign({ do: 'select' }, more))
  else if (routing) {
    const ts = names || (who && who.all ? S.tracks.filter(x => x.kind === 'audio').map(x => x.name) : who && who.sel ? chosen().map(x => x.name) : null)
    if (!ts || !ts.length) return { say: 'which tracks' }
    const asBus = dest && dest.fam === 'bus' && verbs.includes('group'), label = SAY_FAM_NAME[who && who.fam] || ''
    let sendFrom = !said && made0 ? null : ts                                                   // (nothing named, and the clause before made a stack or a bus: that is what is sent)
    if (verbs.includes('group')) { acts.push({ do: asBus ? 'bus' : 'stack', tracks: ts, name: label }); if (verbs.includes('send')) sendFrom = null }
    if (verbs.includes('send') || (verbs.includes('group') && dest && !asBus)) {
      if (!dest) return { say: 'send it to where' }
      const one = dest.ids && dest.ids.length === 1 ? byId(dest.ids[0]) : null, w = dest.word || []
      const to = one && one.kind !== 'audio' ? { track: one.name } : w.includes('delay') || w.includes('slap') ? { print: 'delay' } : w.includes('reverb') || w.includes('plate') || w.includes('room') ? { print: 'space' } : null      // a bus by its name; or a reverb, a delay — the one there is, or one made for it
      acts.push(Object.assign({ do: 'send', to }, sendFrom ? { tracks: sendFrom } : { made: true }, db ? { db: -Math.abs(db.n) } : {}))
      if (!acts[acts.length - 1].to) return { say: 'send it to where' }
    }
    return { acts, who: said ? who : who0 }
  }
  else return null
  return { acts, who: said ? who : who0 }
}
/* the whole line: its clauses one after the other; a clause that names nothing takes what the one before it named.
   Null: not understood here. */
function sayRead (s) {
  if (typeof chordRead === 'function') { const c = chordRead(s); if (c) return c }      // a line about chords has words of its own (chords.js): a chord's name, darker, another one
  const toks = sayLex(s)
  if (!toks.length || toks.some(t => t.k === 'raw')) return null
  const clauses = [[]]
  for (const t of toks) { if (t.k === 'then') { clauses.push([]); continue } clauses[clauses.length - 1].push(t); if (t.then) clauses.push([]) }
  let who = null, made = false
  const acts = []
  for (const c of clauses) {
    if (!c.length) continue
    const r = sayClause(c, who, s, made)
    if (!r) return null
    if (r.ask) { SAY.ask = r.ask; return [{ do: 'note', text: r.ask.q, ask: true }] }
    if (r.say) return [{ do: 'note', text: r.say }]
    who = r.who || who; acts.push(...r.acts); made = r.acts.some(a => a.do === 'stack' || a.do === 'bus')
  }
  return acts.length ? acts : null
}
/* the answer to "which one": a name among those asked about, a number, or all — the line is read again with it */
function sayAnswer (text) {
  const q = SAY.ask
  SAY.ask = null
  if (!q) return null
  const a = text.toLowerCase().trim(), among = q.among.map(byId).filter(Boolean), word = q.s.slice(q.from, q.to)
  let pick = null
  if (/^(all|both|every|everything|전부|모두|다|둘 ?다|전체)$/.test(a)) pick = `${word} all`
  else if (/^\d$/.test(a) && among[+a - 1]) pick = among[+a - 1].name.toLowerCase()
  else { const ws = sayWords(a).map(sayStem), ts = among.filter(t => t.name.toLowerCase() === a || (ws.length > 0 && ws.every(w => sayKeys(t).has(w)))); if (ts.length === 1) pick = ts[0].name.toLowerCase() }      // (the words of the answer against the names asked about — whatever else those words may mean elsewhere)
  return pick ? q.s.slice(0, q.from) + pick + q.s.slice(q.to) : null
}

/* ── carrying it out ── */
/* the tracks and regions an action means: those chosen when nothing else is said; a stretch alone is every track */
function sayWho (a) {
  const w = a.who
  if (w && w.tracks) return S.tracks.filter(t => w.tracks.some(n => String(n).toLowerCase() === t.name.toLowerCase()))
  if ((w && w.all) || (!w && a.span)) return S.tracks.filter(t => t.kind === 'audio')
  return null                                                                                          // what is chosen
}
const sayIn = (ts, a, b) => ts.flatMap(t => t.regs.filter(r => r.a - 1 < b - 1e-9 && r.b - 1 > a + 1e-9).map(r => [r, t]))
const sayOf = a => { const ts = sayWho(a); return ts ? (a.span ? sayIn(ts, a.span[0], a.span[1]) : ts.flatMap(t => t.regs.map(r => [r, t]))) : selRegs() }
/* a stretch cut out of some tracks at both its ends: what then lies inside it (within an edit) */
function sayCarve (ts, a, b) { const inside = []; for (const t of ts) { cutLaneAt(t, a); cutLaneAt(t, b); for (const r of t.regs) if (after(r, a) && !after(r, b)) inside.push([r, t]) } return inside }
const sayCount = (n, what = 'region') => `${n} ${what}${n === 1 ? '' : 's'}`
function sayPut (clip, at) {                                                                           // what a clipboard holds, put down at a place on the tracks it came from
  const put = []
  for (const c of clip) { const t = S.tracks[c.ti]; if (!t || t.kind !== 'audio' || !!t.inst !== !!c.r.notes) continue; const len = c.r.b - c.r.a, n = cloneReg(c.r, { a: at + 1 + c.da, b: at + 1 + c.da + len }); t.regs.push(n); put.push([n, t, n.a - 1, n.b - 1]) }
  freshGroups(put.map(x => x[0])); S.selR = put.map(x => x[0].id); S.focus = 'lanes'; S.marq = null; settle(put)
  return put
}
function sayDo (a, out) {
  const word = (text, more) => out.push(Object.assign({ k: 'word', text, step: 1 }, more || {})), none = () => out.push({ k: 'word', text: sayWho(a) ? 'nothing there' : 'choose a region first' })
  if (a.do === 'note') { out.push({ k: 'word', text: String(a.text).slice(0, 90), quiet: 1 }); return true }
  if (a.do === 'chords') return typeof chordDo === 'function' ? chordDo(a, out) : false
  if (a.do === 'jump' && isFinite(+a.pos)) { const p = clamp(+a.pos, 0, SONG_END); jumpTo(p); out.push({ k: 'word', text: `at ${readout(p)}` }); return true }
  if (a.do === 'cyclespan' && a.span) { setCycle(a.span[0], a.span[1], true); out.push({ k: 'word', text: `cycle ${readout(a.span[0])} to ${readout(a.span[1])}` }); return true }
  if (a.do === 'cut') {
    const ts = sayWho(a)
    let n = 0
    if (a.span) edit(() => { const all = ts || [...new Set(selRegs().map(x => x[1]))], was = all.reduce((k, t) => k + t.regs.length, 0); for (const t of all) { cutLaneAt(t, a.span[0]); cutLaneAt(t, a.span[1]) } n = all.reduce((k, t) => k + t.regs.length, 0) - was; return n > 0 })
    else { const p = a.at == null ? curPos() : clamp(+a.at, 0, SONG_END); edit(() => { if (ts) { const was = ts.reduce((k, t) => k + t.regs.length, 0); for (const t of ts) cutLaneAt(t, p); n = ts.reduce((k, t) => k + t.regs.length, 0) - was } else for (const [r, t] of selRegs()) if (splitReg(r, t, p)) n++; return n > 0 }); a = Object.assign({}, a, { said: `cut at ${readout(p)}` }) }
    if (n) word(a.said || (a.name ? `${a.name} cut out` : `cut at ${readout(a.span[0])} and ${readout(a.span[1])}`)); else none()
    return true
  }
  if (a.do === 'halve') { const rs = sayOf(a); let n = 0; if (rs.length) edit(() => { for (const [r, t] of rs) if (splitReg(r, t, (r.a + r.b) / 2 - 1)) n++; return n > 0 }); if (n) word(`${sayCount(n)} cut in half`); else none(); return true }
  if (a.do === 'regmute') {
    const ts = sayWho(a), on = a.on !== false
    let n = 0
    edit(() => { const rs = a.span && ts ? sayCarve(ts, a.span[0], a.span[1]) : sayOf(a); for (const [r] of rs) if (!!r.mute !== on) { r.mute = on; dirtyReg(r); n++ } return n > 0 })
    if (n) word(`${a.name ? a.name + ': ' : ''}${sayCount(n)} ${on ? 'muted' : 'unmuted'}`); else none()
    return true
  }
  if (a.do === 'delete') {
    const ts = sayWho(a)
    let n = 0
    edit(() => { const rs = a.span && ts ? sayCarve(ts, a.span[0], a.span[1]) : sayOf(a), ids = rs.map(x => x[0].id); if (!ids.length) return false; if (!a.span) partCrossed(new Set(ids)); S.selX = null; removeRegs(ids); n = ids.length })
    if (n) word(`${a.name ? a.name + ': ' : ''}${sayCount(n)} deleted`); else none()
    return true
  }
  if (a.do === 'again' || a.do === 'copyto') {
    const ts = sayWho(a), times = a.do === 'again' ? clamp(Math.round(+a.times || 1), 1, 32) : 1, to = a.to == null ? null : clamp(+a.to, 0, SONG_END)
    if (a.span && to == null) { for (let k = 0; k < times; k++) timeAct.repeat(a.span[0], a.span[1]); word(`${a.name || 'that stretch'} ${times > 1 ? times + ' times more' : 'once more'}`); return true }      // a part of the song said again where it stands: what follows moves later
    let clip = null
    if (a.span) { const was = S.marq; S.marq = { a: a.span[0], b: a.span[1], t0: 0, t1: S.tracks.length - 1 }; clip = marqueeClip(); S.marq = was; if (ts && a.who) clip = clip.filter(c => ts.includes(S.tracks[c.ti])) }
    else { const rs = sayOf(a); if (rs.length) { if (to == null) { pickRegs(rs.map(x => x[0])); for (let k = 0; k < times; k++) act.repeat(); word(times > 1 ? `repeated ${times} times` : 'once more'); return true } const set = new Set(rs.map(x => x[0].id)), cs = rs.map(([r, t]) => [plainCopy(r, t, set), t]), a0 = Math.min(...cs.map(x => x[0].a)); clip = cs.map(([c, t]) => ({ r: c, ti: S.tracks.indexOf(t), da: c.a - a0 })) } }
    if (!clip || !clip.length) { none(); return true }
    const len = Math.max(...clip.map(c => c.da + c.r.b - c.r.a))
    let put = []
    edit(() => { for (let k = 0; k < times; k++) put = put.concat(sayPut(clip, to + k * len)); S.selR = put.map(x => x[0].id); return put.length > 0 })
    if (put.length) { rewarp(put.map(x => x[0])); word(`${a.name || sayCount(clip.length)} ${a.do === 'again' ? 'once more' : 'copied'} at ${readout(to)}`) } else none()
    return true
  }
  if (a.do === 'moveto') {
    const ts = sayWho(a), to = clamp(+a.to, 0, SONG_END)
    let rs = []
    if (a.span && ts) edit(() => { rs = sayCarve(ts, a.span[0], a.span[1]); return rs.length > 0 }); else rs = sayOf(a)
    if (!rs.length) { none(); return true }
    pickRegs(rs.map(x => x[0])); act.spot(to); word(`${sayCount(rs.length)} moved to ${readout(to)}`)
    return true
  }
  if (a.do === 'fade') {
    const out2 = !!a.out, p = curPos(), ts = sayWho(a)
    /* the regions meant; a track named with nothing else said gives the one under the playhead, or else its last (first, for a fade in) */
    let rs = a.span || !ts ? sayOf(a) : ts.flatMap(t => { const rr = t.regs.slice().sort((x, y) => x.a - y.a), under = rr.find(r => p > r.a - 1 && p < r.b - 1); return rr.length ? [[under || rr[out2 ? rr.length - 1 : 0], t]] : [] })
    rs = rs.filter(x => !x[0].notes)
    let n = 0, said = ''
    if (rs.length) edit(() => {
      for (const [r, t] of rs) {
        const inside = p > r.a - 1 + 1e-6 && p < r.b - 1 - 1e-6, len = a.bars != null ? +a.bars : inside ? (out2 ? r.b - 1 - p : p - (r.a - 1)) : 1
        if (!(len > 0)) continue
        for (const [A, B] of joinsOf(t)) if (xfadeOf(A, B) && (out2 ? A === r : B === r)) uncross(A, B)      // (the end that is faded was part of a crossfade: a plain end first)
        if (out2) r.fo = clamp(len, 0, fadeRoom(r, r.fi)); else r.fi = clamp(len, 0, fadeRoom(r, r.fo))
        said = `${+(out2 ? r.fo : r.fi).toFixed(2)} bars`; dirtyReg(r); n++
      }
      return n > 0
    })
    if (n) word(`fade ${out2 ? 'out' : 'in'}${n > 1 ? ' on ' + sayCount(n) : ''}, ${said}`); else none()
    return true
  }
  if (a.do === 'quantize') { const rs = sayOf(a).filter(x => !x[0].loop); if (!rs.length) { none(); return true } if (a.grid && [1 / 4, 1 / 8, 1 / 16, 1 / 32].includes(+a.grid)) S.q = +a.grid; pickRegs(rs.map(x => x[0])); act.quantize(); word(`${sayCount(rs.length)} quantized to 1/${Math.round(1 / S.q)}`); return true }
  if (a.do === 'select') {
    const ts = sayWho(a)
    if (a.span && (!a.who || a.who.all)) { S.selR = []; S.selX = null; S.focus = 'lanes'; S.marq = { a: a.span[0], b: a.span[1], t0: 0, t1: S.tracks.length - 1 }; out.push({ k: 'word', text: `${a.name || readout(a.span[0]) + ' to ' + readout(a.span[1])} chosen` }); uiDirty('lanes', 'dock'); return true }
    const rs = ts ? (a.span ? sayIn(ts, a.span[0], a.span[1]) : ts.flatMap(t => t.regs.map(r => [r, t]))) : []
    if (ts && !a.span) { S.selT = ts.map(t => t.id); S.sel = S.tracks.indexOf(ts[0]); S.focus = 'tracks'; S.selR = withTheirs(rs.map(x => x[0].id)); S.marq = null; showRow(S.sel); uiDirty('head', 'lanes', 'dock'); out.push({ k: 'word', text: `${sayList(ts)} chosen` }); return true }
    if (!rs.length) { none(); return true }
    pickRegs(rs.map(x => x[0])); out.push({ k: 'word', text: `${sayCount(rs.length)} chosen` })
    return true
  }
  if (a.do === 'gain' && isFinite(+a.db)) {
    const rs = sayOf(a)
    if (!rs.length) { none(); return true }
    const from = rs[0][0].gain || 0
    pickRegs(rs.map(x => x[0])); act.gain(+a.db)
    if (rs.length === 1) out.push({ k: 'gain', from, to: rs[0][0].gain || 0, step: 1 }); else word(`${sayCount(rs.length)} ${+a.db > 0 ? '+' : '−'}${Math.abs(+a.db)} db`)
    return true
  }
  if (a.do === 'stack' || a.do === 'bus') {
    const ts = (a.tracks || []).map(n => S.tracks.find(t => t.name.toLowerCase() === String(n).toLowerCase())).filter(t => t && !(a.do === 'stack' && (t.parent || t.kind === 'stack')))
    if (!ts.length) { out.push({ k: 'word', text: 'nothing to put together' }); return true }
    if (S.tracks.length >= MAX_TRACKS) { out.push({ k: 'word', text: 'no room for another track' }); return true }
    let made = null
    if (a.do === 'stack') { S.selT = ts.map(t => t.id); S.sel = S.tracks.indexOf(ts[0]); S.focus = 'tracks'; makeStack(); made = byId(ts[0].parent); if (made && a.name && !S.tracks.some(t => t !== made && t.name === a.name)) made.name = String(a.name).toLowerCase().slice(0, 40) }
    else edit(() => { made = addTrack('bus', a.name && !S.tracks.some(t => t.name === a.name) ? String(a.name).toLowerCase().slice(0, 40) : null); for (const t of ts) { t.parent = null; t.out = made.id } normalizeOrder() })
    if (!made) { out.push({ k: 'word', text: 'nothing to put together' }); return true }
    SAY.made = made.id
    repaint(); word(`${made.name}: ${sayList(ts)}`)
    return true
  }
  if (a.do === 'send') {
    const from = a.made ? [byId(SAY.made)].filter(Boolean) : (a.tracks || []).map(n => S.tracks.find(t => t.name.toLowerCase() === String(n).toLowerCase())).filter(Boolean)
    if (!from.length || !a.to) { out.push({ k: 'word', text: 'which tracks' }); return true }
    const k = a.to.print === 'delay' ? 'delay' : 'space', db = isFinite(+a.db) ? clamp(-Math.abs(+a.db), -48, 6) : null
    let dest = a.to.track ? S.tracks.find(t => t.name.toLowerCase() === String(a.to.track).toLowerCase() && t.kind !== 'audio') : S.tracks.find(t => t.kind === 'bus' && (patchNow(t)[k] > 0 || (k === 'space' ? /reverb|plate|verb|hall|room/ : /delay|echo|slap/).test(t.name)))
    let n = 0
    edit(() => {
      if (!dest) { if (a.to.track || S.tracks.length >= MAX_TRACKS) return false; dest = addTrack('bus', k === 'space' ? 'reverb' : 'delay'); setPrint(dest, k, PRINT_START[k]); dest.patch0 = copy(dest.patch) }
      for (const t of from) { if (t === dest) continue; const sd = (t.sends || []).find(x => x.to === dest.id); if (sd) { if (db != null && sd.db !== db) { sd.db = db; n++ } } else if ((t.sends || []).length < 3) { (t.sends = t.sends || []).push({ to: dest.id, db: db == null ? -12 : db }); n++ } }
      normalizeOrder()
      return n > 0
    })
    if (n) { repaint(); word(`${sayList(from)} to ${dest.name}${db != null ? ' at ' + fmtDb(db) + ' db' : ''}`) } else out.push({ k: 'word', text: dest ? 'already sent there' : 'no bus called that' })
    return true
  }
  return false
}
