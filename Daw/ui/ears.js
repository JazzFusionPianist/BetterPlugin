/* ── the room's ears: a sound's measurable lines ──
   A request made by its sound is read as changes along these lines, never as a recipe of its own (his ask, 2026-10-16:
   "케이스를 한 개, 두 개씩 늘려가면 … 100년 넘게 걸릴거야"): a word becomes "brighter by so much", "wider", "further
   back", "less covered by that one" — and every way of doing it is measured along the same lines until it is heard as
   asked. What the engine hears (Engine::listen, Source/Listen.h) is read here into the lines; each is a number whose
   CHANGE means the same for any sound (their zero is the room's own, not a standard's, but for loud, in LUFS).
     loud       how loud, as people hear it (BS.1770, gated), in LUFS
     tilt       how the spectrum leans, 100 hz to 10 khz: db an octave (up: brighter)
     low mud box presence air   how much of it lies in each stretch (20–120, 150–450, 450–1100 hz, 1.5–5, 10–20 khz),
                db against the whole
     ring       how far its loudest ringing stands out of its neighbours, 150 hz to 10 khz (db), and where (ringHz)
     sib        how far its esses jump: the top of 5 to 10 khz against its middle, frame by frame (db)
     punch      how sharply its hits rise: db in the 20 ms before each
     crest      how far its peaks stand over its body (db)
     dyn        how far its loud and quiet parts lie apart (db)
     tail       how much sounds on after its hits: the 80 to 400 ms after each against its first 80 (db) — up: further
                away, or longer (only hits with room after them count: a dense part has none, and no tail)
     fill       how far its quiet moments lie under its loud ones, 5 ms at a time (db, below zero) — up: filled in, by
                a room, a tail or a compressor
     width      how unlike its sides are, by the power of each third of an octave (0 alike, .5 unrelated, 1 opposed):
                a sound panned to one side is as narrow as one in the middle; low and high: below 150 hz, above 4 khz
     mono       how alike its sides are (1 the same, 0 unrelated, below 0 opposed): what is lost when it is summed
     wet        how much of it is unlike on its two sides (1 − mono): what a room adds to any sound, dense or sparse, held
                or struck — how far back it is put
     pan        where it stands: db louder on the right than on the left
   And of two: cover (how much of the one's hits the other covers where the one is loudest, 0 to 1), over (db the other
   stands over the one there, on its hits), apart (db the one is louder than the other). */
const EAR_LINES = ['loud', 'tilt', 'low', 'mud', 'box', 'presence', 'air', 'ring', 'sib', 'punch', 'crest', 'dyn', 'tail', 'fill', 'width', 'widthLow', 'widthHigh', 'mono', 'wet', 'pan']
const EAR_NONE = -60                                                                     // (a stretch this far under the whole holds nothing: its lines are not read)
const earPow = d => Math.pow(10, d / 10), earDb = p => 10 * Math.log10(Math.max(p, 1e-14))
const earPct = (xs, q) => { if (!xs.length) return 0; const s = xs.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))] }
const earMean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0

/* the hits, where it has any: a rise of 6 db on the 20 ms before, within 24 db of its loudest, 100 ms after the last
   (in steps of res.fast seconds) */
function earHits (fast, sec) {
  const mx = Math.max(...fast), gap = Math.round(.1 / sec), out = []
  for (let i = 4; i < fast.length; i++) if (fast[i] - Math.min(fast[i - 1], fast[i - 2], fast[i - 3], fast[i - 4]) >= 60 && fast[i] > mx - 240 && (!out.length || i - out[out.length - 1] >= gap)) out.push(i)
  return out
}

/* one sound's lines, from what the engine heard of it (h: a track of the answer; res: the answer, for its scales) */
function earsOf (h, res) {
  if (!h || !h.kl || !h.kl.length) return null
  const C = res.centres, sec = res.fast || 256 / 48000
  /* loud: frames of 190 ms, gated as BS.1770 gates (−70 LUFS, then 10 below what is left) */
  const lufs = h.kl.map(k => k / 10 - .691), abs = lufs.filter(l => l > -70)
  const g1 = abs.length ? earDb(earMean(abs.map(earPow))) - 10 : -70, kept = abs.filter(l => l > g1)
  const loud = kept.length ? earDb(earMean(kept.map(earPow))) : -70
  const act = h.kl.map(k => k / 10 - .691 > Math.max(-70, g1))                       // the frames where it sounds
  /* the spectrum where it sounds, a third of an octave a band */
  const S = C.map((_, b) => { let s = 0, n = 0; h.bands.forEach((f, i) => { if (act[i]) { s += earPow(f[b]); n++ } }); return n ? s / n : 1e-14 })
  const total = S.reduce((a, b) => a + b, 0)
  const rel0 = (lo, hi) => earDb(S.reduce((q, p, b) => q + (C[b] >= lo && C[b] <= hi ? p : 0), 0)) - earDb(total)
  const rel = (lo, hi) => { const r = rel0(lo, hi); return r < EAR_NONE ? null : r }
  let sx = 0, sy = 0, sxx = 0, sxy = 0, n = 0
  C.forEach((f, b) => { if (f < 100 || f > 10000) return; const x = Math.log2(f), y = earDb(S[b]); sx += x; sy += y; sxx += x * x; sxy += x * y; n++ })
  const tilt = n > 1 ? (n * sxy - sx * sy) / (n * sxx - sx * sx) : 0
  /* ringing: the long spectrum in twelfths, against itself smoothed over half an octave each way */
  const lt = (h.ltas || []).map(v => v / 10), fine = k => 20 * Math.pow(2, k / 12)
  let ring = 0, ringHz = 0
  for (let k = 6; k < lt.length - 6; k++) {
    const f = fine(k); if (f < 150 || f > 10000) continue
    let m = 0; for (let j = k - 6; j <= k + 6; j++) if (j !== k) m += lt[j]
    const over = lt[k] - m / 12
    if (over > ring) { ring = over; ringHz = Math.round(f) }
  }
  /* esses: 5 to 10 khz, frame by frame, the top against the middle */
  const ess = h.bands.filter((_, i) => act[i]).map(f => earDb(C.reduce((q, c, b) => q + (c >= 5000 && c <= 10000 ? earPow(f[b]) : 0), 0)))
  const sib = ess.length && rel0(5000, 10000) > EAR_NONE + 10 ? earPct(ess, .95) - earPct(ess, .5) : null
  /* hits: how sharp, and what sounds on after them */
  const fast = h.fast || [], hits = fast.length ? earHits(fast, sec) : []
  const punch = hits.length ? earMean(hits.map(i => (fast[i] - Math.min(fast[i - 1], fast[i - 2], fast[i - 3], fast[i - 4])) / 10)) : 0
  const w80 = Math.round(.08 / sec), w400 = Math.round(.4 / sec)
  const tails = hits.map((i, j) => {
    const end = Math.min(fast.length, i + w400, j + 1 < hits.length ? hits[j + 1] : Infinity)
    if (end - i <= w80 + 2) return null
    let a = 0, b = 0; for (let k = i; k < i + w80; k++) a += earPow(fast[k] / 10); for (let k = i + w80; k < end; k++) b += earPow(fast[k] / 10)
    return earDb(b / (end - i - w80)) - earDb(a / w80)
  }).filter(x => x != null)
  const tail = tails.length ? earMean(tails) : null
  const loudF = fast.filter(x => x > Math.max(...fast) - 300)
  const body = fast.filter(x => x > Math.max(...fast) - 600), fill = body.length > 20 ? (earPct(body, .1) - earPct(body, .9)) / 10 : null
  const crest = h.peak && h.peak.length && loudF.length ? earPct(h.peak, .99) / 10 - earDb(earMean(loudF.map(x => earPow(x / 10)))) : 0
  const kAct = lufs.filter((_, i) => act[i]), dyn = kAct.length ? earPct(kAct, .95) - earPct(kAct, .1) : 0
  /* width, low and high; how alike its sides are; where it stands */
  const mid = (h.mid || []).map(v => earPow(v / 10)), side = (h.sideBands || []).map(v => earPow(v / 10)), bc = h.bandCorr || []
  const wid = (lo, hi) => {
    if (rel0(lo, hi) < EAR_NONE) return null
    let w = 0, e = 0; C.forEach((c, b) => { if (c >= lo && c <= hi && bc[b] != null) { const p = (mid[b] || 0) + (side[b] || 0); w += p * (1 - bc[b] / 100) / 2; e += p } })
    return e > 0 ? w / e : null
  }
  const corr = (h.corr || []).filter((_, i) => act[i])
  const pan = h.lr && h.lr.length === 2 ? (h.lr[1] - h.lr[0]) / 10 : 0
  const r1 = x => x == null ? null : Math.round(x * 10) / 10, r2 = x => x == null ? null : Math.round(x * 100) / 100
  return {
    loud: r1(loud), tilt: r2(tilt), low: r1(rel(20, 120)), mud: r1(rel(150, 450)), box: r1(rel(450, 1100)), presence: r1(rel(1500, 5000)), air: r1(rel(10000, 20000)),
    ring: r1(ring), ringHz, sib: r1(sib), punch: r1(punch), crest: r1(crest), dyn: r1(dyn), tail: r1(tail), fill: r1(fill),
    width: r2(wid(20, 20000)), widthLow: r2(wid(20, 150)), widthHigh: r2(wid(4000, 20000)), mono: r2(corr.length ? earMean(corr) / 100 : 1), wet: r2(corr.length ? 1 - earMean(corr) / 100 : 0), pan: r1(pan),
    hits: hits.length, spectrum: S.map(p => r1(earDb(p))),
  }
}

/* two sounds: how much the second covers the first where the first is loudest, on the first's hits (or, without hits,
   wherever it sounds) */
function earsPair (ha, hb, res) {
  const A = earsOf(ha, res), B = earsOf(hb, res)
  if (!A || !B) return null
  const C = res.centres, sec = res.fast || 256 / 48000, top = A.spectrum.reduce((k, v, b) => v > A.spectrum[k] ? b : k, 0)
  const key = C.map((_, b) => A.spectrum[b] > A.spectrum[top] - 10)                // the bands where the first is loudest
  const hop = Math.round((res.hop || 2048 / 48000) / sec)
  const frames = A.hits ? earHits(ha.fast, sec).map(i => Math.floor(i / hop)).filter(f => f < ha.bands.length && f < hb.bands.length) : ha.bands.map((_, i) => i).filter(i => i < hb.bands.length && ha.level[i] > Math.max(...ha.level) - 30)
  let cov = 0, over = []
  for (const f of frames) {
    let a = 0, b = 0; C.forEach((_, k) => { if (key[k]) { a += earPow(ha.bands[f][k]); b += earPow(hb.bands[f][k]) } })
    const d = earDb(b) - earDb(a); over.push(d); if (d >= -3) cov++
  }
  return { cover: frames.length ? Math.round(cov / frames.length * 100) / 100 : 0, over: Math.round(earMean(over) * 10) / 10, apart: Math.round((A.loud - B.loud) * 10) / 10 }
}

/* what changed, line by line: after against before (only the lines both have) */
function earsMoved (a, b) {
  const out = {}
  for (const k of EAR_LINES) if (a && b && a[k] != null && b[k] != null) out[k] = Math.round((b[k] - a[k]) * 100) / 100
  return out
}

/* the engine asked: these tracks heard over [a0, a1] bars, as own | solo | rest; id 0 the whole mix. o.all: every one of
   them (own) in one pass of the song (Engine::listenEvery: what a rough mix or the mix doctor hears, forty tracks at
   once); o.seg: the stretch in pieces of so many bars, each kept apart too (earsPiece) */
async function earsListen (ids, a0, a1, as, o = {}) {
  if (!NAT) return null
  const ask = { a0, a1, tracks: ids, as: as || 'own' }
  if (o.all && (!as || as === 'own')) ask.all = true
  if (o.seg) ask.seg = o.seg
  const res = await NAT.call('listen', ask)
  if (!res || !res.ok) return null
  const out = { res }
  for (const t of res.tracks) out[t.id] = earsOf(t, res)
  return out
}

/* one piece of what was heard with o.seg: its frames, its 5 ms steps, and what the whole keeps only once (its long
   spectrum, its sides) kept again for the piece — read into the same lines as the whole (the mix doctor's bars) */
function earsPiece (h, res, k) {
  const sg = h && h.segs && h.segs[k]
  if (!sg) return null
  const f0 = k ? h.segs[k - 1].frames : 0, f1 = sg.frames, per = Math.round(res.hop / res.fast)
  const cut = a => (a || []).slice(f0, f1), cutF = a => (a || []).slice(f0 * per, f1 * per)
  const e = earsOf({ bands: cut(h.bands), level: cut(h.level), kl: cut(h.kl), side: cut(h.side), corr: cut(h.corr), fast: cutF(h.fast), peak: cutF(h.peak), ltas: sg.ltas, mid: sg.mid, sideBands: sg.sideBands, bandCorr: sg.bandCorr, lr: sg.lr }, res)
  if (e) e.lt = sg.ltas                                                                    // (its long spectrum, kept: a piece's ringing is read against the song's)
  return e
}
const earsPieces = (h, res) => ((h && h.segs) || []).map((_, k) => earsPiece(h, res, k))

/* two sounds at once, each heard alone (the patent search, mixlab/patents-1.md: what is measured is that both are loud in
   the same band at the same time — never how much one is lost under the other): in each third of an octave that matters
   to both (within 20 db of each one's own strongest), the share of the frames f0…f1 either is near its loudest there
   (within `near` db) in which both are; then the stretch of two to four bands where that share is highest */
function earsTogether (ha, hb, res, f0 = 0, f1 = Infinity, near = 12) {
  const C = res.centres, from = Math.max(0, f0), to = Math.min(ha.bands.length, hb.bands.length, f1)
  if (to - from < 2) return null
  const mean = (h, b) => { let p = 0; for (let i = from; i < to; i++) p += earPow(h.bands[i][b]); return earDb(p / (to - from)) }
  const top = (h, b) => { let m = -Infinity; for (let i = from; i < to; i++) m = Math.max(m, h.bands[i][b]); return m }
  const avA = C.map((_, b) => mean(ha, b)), avB = C.map((_, b) => mean(hb, b)), pkA = Math.max(...avA), pkB = Math.max(...avB)
  const share = C.map((_, b) => {
    if (avA[b] < pkA - 20 || avB[b] < pkB - 20) return 0
    const ta = top(ha, b), tb = top(hb, b)
    let both = 0, any = 0
    for (let i = from; i < to; i++) { const a = ha.bands[i][b] > ta - near, bb = hb.bands[i][b] > tb - near; if (a || bb) any++; if (a && bb) both++ }
    return any ? both / any : 0
  })
  let best = null
  for (let w = 2; w <= 4; w++) for (let b = 0; b + w <= C.length; b++) {
    const v = share.slice(b, b + w).reduce((x, y) => x + y, 0) / w
    if (!best || v > best.together + 1e-9) best = { together: v, lo: C[b], hi: C[b + w - 1] }
  }
  return { share: share.map(v => Math.round(v * 100) / 100), together: best ? Math.round(best.together * 100) / 100 : 0, lo: best && best.lo, hi: best && best.hi }
}
