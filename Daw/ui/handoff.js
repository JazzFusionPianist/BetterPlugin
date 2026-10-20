/* ── hand off, in the middle of the window ──
   His way b of design/bar and hand off draft 1 and of hand off draft 2, with his own two kinds (2026-10-16: "stems /
   bounce 이렇게 두 개만… stem → 스템 뽑게 하고 bounce → 현재 상태 바로 wav 나 mp3 로"):
     at the right, two large keys: stems (a file for each track) or bounce (the mix as it sounds now, at once).
       stems:  under them one line says how they will be printed (with the patch or dry, over what, as what file);
               change opens every choice
       bounce: wav or mp3 stands right there; change opens the rest (over what, the other kinds, the rate, the depth)
     at the left, what will be printed: the tracks (a row pressed is left out, with option only it) or the mix
     at the foot, cancel and send.
   Nothing the hand-off could do is taken away. Read after ui.js; it takes the hand-off panel's place (PARTS.hand).
   Kinds of file, rates and depths can be chosen several at once (his ask, 2026-10-21): one pass is printed and every file
   made from it (hoFiles). The kinds and the depths are cells pressed on and off; the rates and an mp3's rates are many,
   each in a list that opens from a box, the two boxes one width. */
const HO2 = { more: false }
const HO2_W = 720
const hoRateWord = v => `${+(v / 1000).toFixed(3)}k`
function hoLabel (k, v, pl) { if (k === 'rate') return hoRateWord(v); if (k === 'kbps') return `${v} kbps`; const L = { 32: '32 float', 'this scene': pl.sc.name || 'this part' }; return String(L[v] || v) }
function hoDim (k, v) {
  const fmts = hoSet('fmt'), pcm = fmts.some(HO_PCM)
  return (k === 'print' && S.ho.how === 'realtime' && v !== 'with patch') || (k === 'fmt' && v === 'mp3' && !CAP.mp3) || (k === 'bits' && (!pcm || (v === 32 && !fmts.includes('wav')))) || (k === 'rate' && !pcm && v > 48000)
    || (k === 'range' && v === 'cycle' && !(S.cycle.b - S.cycle.a >= 1 / 32)) || (k === 'range' && v === 'this scene' && !SCENES.length)
}
/* one more of a kind, rate, depth or mp3 rate chosen, or one taken away again (the last one stays) */
function hoToggle (k, v) {
  const ho = S.ho
  let set = hoSet(k).slice()
  if (set.includes(v)) { if (set.length > 1) set = set.filter(x => x !== v) } else set.push(v)
  ho[k] = set.length > 1 ? set : k === 'rate' && set[0] === SND_SR ? 0 : set[0]      // (the song's own rate alone: 0 again, so it follows the song)
  ho.done = 0; ho.note = ''
}
/* the list a box opens: every rate (or every mp3 rate), the chosen ones lit; it stays up while they are picked */
function hoListOpen (k, x, y, w) {
  const items = () => (k === 'rate' ? HO_RATE : HO_KBPS).map(v => ({ t: hoLabel(k, v), k: k === 'rate' && v === SND_SR ? 'project' : '', v, on: hoSet(k).includes(v) && !hoDim(k, v), dim: hoDim(k, v), sep: k === 'rate' && (v === 44100 || v === 88200) }))
  openMenu(x, y, items(), it => { hoToggle(k, it.v); if (S.menu) S.menu.items = items(); uiDirty('hand', 'menu') }, { w, keep: true })
}
/* the choices that are not on show until change is pressed: for stems all of them, for a bounce all but its kind of file.
   A row: [name, key, the choices, what is chosen, way]: way one (one of them), many (cells, several), list (a box) */
function hoRows (pl) {
  const ho = S.ho, rows = []
  if (!pl.mix) rows.push(['print', 'print', ['with patch', 'dry', 'both'], ho.print, 'one'])
  rows.push(['range', 'range', ['this scene', 'cycle', 'song'], pl.range, 'one'])
  if (NAT) rows.push(['mode', 'how', ['offline', 'realtime'], ho.how === 'realtime' ? 'realtime' : 'offline', 'one'])      // offline: printed ahead, as fast as it goes; realtime: played through as it prints, the room a picture of it (realtime.js)
  if (NAT) {
    const fmts = hoSet('fmt')
    rows.push(['file', 'fmt', HO_FMT, fmts, 'many'])
    rows.push(['rate', 'rate', HO_RATE, hoSet('rate'), 'list'])
    if (fmts.some(HO_PCM)) rows.push(['depth', 'bits', HO_BITS, hoSet('bits'), 'many'])      // (an mp3 has no depth: it has a rate of its own)
    if (fmts.includes('mp3')) rows.push(['mp3', 'kbps', HO_KBPS, hoSet('kbps'), 'list'])
  }
  return rows
}
function pHand2 () {
  const ho = S.ho
  if (!ho.open) return ''
  const pl = hoPlan(), f = hoFmt(), files = hoFiles(), busy = ho.state === 'busy', rows = HO2.more ? hoRows(pl) : []
  const w = Math.min(HO2_W, W - 40), rightH = 60 + 76 + 46 + (pl.mix && !HO2.more ? 44 : 0) + rows.length * 36 + 64
  const listN = pl.mix ? 1 + (files.length > 1 ? files.length : 0) : S.tracks.length, h = clamp(Math.max(rightH, 60 + 30 + listN * 26 + 64), 360, H - 80)
  const x = Math.round((W - w) / 2), y = Math.max(BAR_H + 4, Math.round((H - h) / 2)), L = x + 24, mid = x + Math.round(w * .47), Rr = x + w - 24
  const bytes = (m, o) => pl.secs(m) * (o.fmt === 'm4a' ? 32000 : o.fmt === 'mp3' ? o.kbps * 125 : o.rate * 2 * (o.bits / 8) * (o.fmt === 'flac' ? .6 : 1))
  const per = pl.modes.reduce((a, m) => a + files.reduce((b, o) => b + bytes(m, o), 0) / 1e6, 0)      // (every file it makes)
  let s = R(0, 0, W, H, { fill: '#000', fa: .5 }) + hit(0, 0, W, H, 'ho-close', '', 'default')
  s += R(x - 1, y - 1, w + 2, h + 2, { rx: 6, fill: '#000', fa: .4 }) + R(x, y, w, h, { rx: 5, fill: K2 }) + R(x + .5, y + .5, w - 1, h - 1, { rx: 5, stroke: INK, sa: .26 }) + hit(x, y, w, h, 'ho-pane', '', 'default')
  /* its head: what, how long, how big */
  const n = pl.list.length * pl.modes.length
  s += run(L, y + 32, [['hand off', { size: 13, w: 500 }], [pl.mix ? files.length > 1 ? `the mix, ${files.length} files` : 'the mix' : `${n} ${n === 1 ? 'stem' : 'stems'}${files.length > 1 ? `, ${files.length} kinds each` : ''}`, { size: 13, a: .45 }]], 9)[0]
  const meta = [[mmss(pl.secs(pl.modes[0])), { size: 10.5, a: .62 }], [`${(pl.mix ? per : per * pl.list.length).toFixed(1)} mb`, { size: 10.5, a: .62 }]]
  s += run(Rr - runW(meta, 14), y + 32, meta, 14)[0] + hline(x + 1, x + w - 1, y + 48, .08)
  /* the left: what will be printed */
  const ly = y + 74, bottom = y + h - 64
  s += T(L, ly, pl.mix ? 'the mix' : 'stems', { size: 9.5, a: .4 })
  if (pl.mix) {
    const done = ho.done >= 1, doing = busy, ry = ly + 26
    s += (done ? R(L, ry - 7.5, 6, 6, { fill: INK }) : R(L + .5, ry - 7.5, 6, 6, { stroke: INK, sa: doing ? 1 : .7 })) + T(L + 18, ry, 'everything, as it sounds', { size: 11, w: 500, a: .92 })
    if (doing) s += R(mid - 112, ry - 4.5, 72, 2, { fill: INK, fa: .14 }) + R(mid - 112, ry - 4.5, 36, 2, { fill: INK })
    else s += T(mid - 40, ry, `${per.toFixed(1)} mb`, { size: 10, a: .5, anchor: 'end' })
    if (files.length > 1) files.forEach((o, k) => {                                     // several files: each, as it will be
      const fy = ry + 24 + k * 22
      if (fy > bottom - 8) return
      s += T(L + 18, fy, `${o.fmt}${o.tag}`, { size: 10.5, a: .72 }) + T(mid - 40, fy, `${(bytes('with patch', o) / 1e6).toFixed(1)} mb`, { size: 10, a: .42, anchor: 'end' })
    })
  } else {
    const fits = Math.max(1, Math.floor((bottom - ly - 14) / 26)), shownT = S.tracks.slice(0, S.tracks.length > fits ? fits - 1 : fits), more = S.tracks.length - shownT.length
    shownT.forEach((t, i) => {
      const ry = ly + 26 + i * 26, k = pl.list.indexOf(t), inR = k >= 0, m = pl.modes.length, can = pl.cands.includes(t), out = can && !inR
      const done = inR && ho.done >= (k + 1) * m, doing = busy && inR && !done && ho.done >= k * m, nm = fit(asGiven(t.name), mid - L - 110, 11, 500)
      let g = done ? R(L, ry - 7.5, 6, 6, { fill: t.c }) : out ? P(`M${L} ${ry - 4}H${L + 7}`, { stroke: INK, sa: .7 }) : R(L + .5, ry - 7.5, 6, 6, { stroke: t.c, sa: doing ? 1 : .9 })
      g += T(L + 18, ry, nm, { size: 11, w: 500, a: .92 })
      if (t.theirs) g += T(L + 18 + tw(nm, 11, 500) + 7, ry, t.theirs, { size: 9.5, it: true, a: .42 })
      else if (t.kind !== 'audio') g += T(L + 18 + tw(nm, 11, 500) + 7, ry, t.kind, { size: 9.5, a: .42 })
      if (doing) g += R(mid - 112, ry - 4.5, 72, 2, { fill: INK, fa: .14 }) + R(mid - 112, ry - 4.5, 36, 2, { fill: INK })
      else g += T(mid - 40, ry, out ? 'left out' : inR ? `${per.toFixed(1)} mb` : '', { size: 10, a: .5, anchor: 'end' })
      s += inR || out ? G(g, '', out ? ' opacity=".45"' : '') : G(g, '', ' opacity=".3"')
      if (can && !busy) s += hit(L - 6, ry - 16, mid - L - 20, 26, 'ho-pick', ` data-i="${S.tracks.indexOf(t)}"`)      // a row pressed: its stem is left out, or taken in again (with option: it alone, or all again)
    })
    if (more) s += T(L + 18, ly + 26 + shownT.length * 26, `and ${more} more`, { size: 10, a: .42 })
  }
  s += vline(mid - 16, y + 62, bottom, .08)
  /* the right: stems or bounce, two large keys */
  const x0 = mid, kw = Math.floor((Rr - x0 - 10) / 2), kh = 62, ky = y + 66
  ;[['stems', 'a file for each track', false], ['bounce', 'the mix as it sounds', true]].forEach(([word, d, mix], k) => {
    const kx = x0 + k * (kw + 10), on = !!pl.mix === mix, dim = mix && !NAT
    s += on ? R(kx, ky, kw, kh, { rx: 4, fill: INK }) : R(kx + .5, ky + .5, kw - 1, kh - 1, { rx: 4, stroke: INK, sa: dim ? .12 : .28 })
    s += T(kx + 14, ky + 26, word, { size: 13, w: 500, c: on ? K1 : INK, a: dim ? .3 : 1 }) + T(kx + 14, ky + 45, d, { size: 10, c: on ? K1 : INK, a: on ? .72 : dim ? .25 : .5 })
    if (!dim && !busy) s += hit(kx, ky, kw, kh, 'ho-set', ` data-k="what" data-v="${mix ? 'mix' : 'stems'}"`, 'pointer')
  })
  let ry = ky + kh + 14
  /* a bounce: its kind of file at hand, wav or mp3 (or both) */
  if (pl.mix && !HO2.more) {
    const two = ['wav', 'mp3'], cw = Math.floor((Rr - x0 - 10) / 2), fmts = hoSet('fmt')
    two.forEach((v, k) => {
      const cx = x0 + k * (cw + 10), dim = hoDim('fmt', v), on = fmts.includes(v) && !dim
      s += on ? R(cx, ry, cw, 32, { rx: 3, fill: INK, fa: .9 }) : R(cx + .5, ry + .5, cw - 1, 31, { rx: 3, stroke: INK, sa: dim ? .12 : .26 })
      s += T(cx + cw / 2, ry + 21, v, { size: 11.5, w: 500, c: on ? K1 : INK, a: dim ? .3 : 1, anchor: 'middle' })
      if (!dim && !busy) s += hit(cx, ry, cw, 32, 'ho-tog', ` data-k="fmt" data-v="${v}"`, 'pointer')
    })
    ry += 44
  }
  /* what it will be, in one line, and the way to every choice */
  s += hline(x0, Rr, ry, .08)
  const ck = { h: 20, size: 9.5, pad: 9, armed: HO2.more }, cl = HO2.more ? 'less' : 'change'
  if (!HO2.more) {
    const one = files.length === 1, kinds = hoSet('fmt'), rates = [...new Set(files.filter(o => HO_PCM(o.fmt) || one).map(o => o.rate))]
    const words = (pl.mix ? [] : [ho.print]).concat([hoLabel('range', pl.range, pl)], ho.how === 'realtime' ? ['realtime'] : [], !NAT ? [] : one
      ? (pl.mix ? [] : [f.fmt]).concat([hoRateWord(f.rate), f.fmt === 'mp3' ? `${f.kbps} kbps` : f.bits ? `${f.bits} bit` : ''].filter(Boolean))
      : [`${files.length} files`, kinds.join(' ')].concat(rates.map(hoRateWord)))
    let sx = x0
    const lim = Rr - keyW(cl, ck) - 12
    for (const wd of words) { const ww = tw(asGiven(wd), 10.5); if (sx + ww > lim) break; s += T(sx, ry + 26, asGiven(wd), { size: 10.5, a: .84 }); sx += ww + 16 }      // (as many as fit before change)
  }
  s += key(Rr - keyW(cl, ck), ry + 12, cl, Object.assign({ a: busy ? null : 'ho-more' }, ck))[0]
  ry += 44
  /* every choice, when change is pressed: the kinds and depths as cells, several lit at once; the rates and an mp3's rates
     each a box that opens its list, the two boxes as wide as the row of kinds */
  const lw = HO_FMT.reduce((acc, v) => acc + Math.round(tw(v, 10, 500) + 22), 0)
  rows.forEach(([name, k, opts, cur, way]) => {
    s += T(x0, ry + 15, name, { size: 10, a: .45 })
    if (way === 'list') {
      const word = cur.filter(v => !hoDim(k, v)).map(v => k === 'rate' ? hoRateWord(v) : String(v)).join(' ') + (k === 'kbps' ? ' kbps' : '')
      s += menuKey(Rr - lw, ry + 1, word, { h: 22, size: 10, w: lw })[0]
      if (!busy) s += hit(Rr - lw, ry + 1, lw, 22, 'ho-list', ` data-k="${k}" data-x="${Rr - lw}" data-y="${ry + 25}" data-w="${lw}"`)
    } else {
      const many = way === 'many', act = busy ? null : many ? 'ho-tog' : 'ho-set'
      const items = opts.map(v => ({ t: fit(hoLabel(k, v, pl), 96, 10, 500), on: (many ? cur.includes(v) : v === cur) && !hoDim(k, v), dim: hoDim(k, v), a: act, more: ` data-k="${k}" data-v="${v}"` }))
      const wsum = items.reduce((acc, it) => acc + Math.round(tw(it.t, 10, 500) + 22), 0)
      s += cells(Rr - wsum, ry + 1, 22, items, { size: 10, pad: 11 })[0]
    }
    ry += 36
  })
  /* its foot: what is happening, cancel and send */
  const fy = y + h - 44
  s += hline(x + 1, x + w - 1, fy - 8, .08)
  const note = busy ? `rendering ${Math.min(ho.done + 1, ho.total)} of ${ho.total}` : ho.note
  if (note) s += T(L, fy + 18, note, { size: 10, a: .6 })
  if (!busy && note === 'saved as' && ho.at) s += T(L + tw(note, 10) + 6, fy + 18, fit(asGiven(ho.at), Math.max(40, mid - L - tw(note, 10) - 6), 10), { size: 10, a: .88 })      // (the name it was given)
  const so = { armed: !busy, dim: busy, h: 24, size: 10.5, pad: 14, a: busy ? null : 'ho-send' }, co = { h: 24, size: 10.5, pad: 14, a: 'ho-close' }, sw = keyW('send', so), cw = keyW('cancel', co)
  s += key(Rr - sw - 10 - cw, fy + 2, 'cancel', co)[0] + key(Rr - sw, fy + 2, 'send', so)[0]
  return s
}

/* ── joined to the room ── */
{
  PARTS.hand = pHand2
  const down0 = onDown
  onDown = function (e) {
    const el = S.ho.open && e.target.closest ? e.target.closest('[data-a="ho-more"], [data-a="ho-tog"], [data-a="ho-list"]') : null
    if (el && el.dataset.a === 'ho-more') { e.preventDefault(); HO2.more = !HO2.more; uiDirty('hand'); return }
    if (el && S.ho.state !== 'busy') {
      e.preventDefault()
      const k = el.dataset.k
      if (el.dataset.a === 'ho-tog') { hoToggle(k, k === 'fmt' ? el.dataset.v : +el.dataset.v); uiDirty('hand') }
      else if (S.menu) { S.menu = null; uiDirty('menu') } else hoListOpen(k, +el.dataset.x, +el.dataset.y, +el.dataset.w)
      return
    }
    down0(e)
  }
}
