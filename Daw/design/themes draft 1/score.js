/* ── theme: score — the song as an engraved page ──
   Paper and ink and a red pencil. Each track is a staff (one line for the drums, five for the rest) named in italic at the
   left as in a full score, the drums under a bracket, the keys under a brace; the time signature stands at the start. A
   region is a phrase under a slur. Markers are rehearsal marks, boxed letters. The cycle is a pair of repeat barlines.
   A track's level reads as a dynamic (mf, f, p) with its decibels beside it. The tempo is a metronome mark; the transport
   is a line of type at the foot of the page. */
const SC = { paper: '#F7F2E7', ink: '#1D1A16', ink2: '#5C554B', rule: '#2A2520', red: '#C23B22', grey: '#8D8579' }
const scF = "'EB Garamond', serif"

function scDefs () {
  const r = rnd(11)
  let dots = ''
  for (let i = 0; i < 260; i++) dots += ci(r() * 200, r() * 200, .35 + r() * .5, { fill: r() > .5 ? '#000' : '#7A5A2A', fa: .025 + r() * .04 })
  return `<defs><pattern id="sc-paper" width="200" height="200" patternUnits="userSpaceOnUse">${dots}</pattern>
    <radialGradient id="sc-vig" cx=".5" cy=".45" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#5A4A30" stop-opacity=".12"/></radialGradient></defs>`
}
/* a quarter note, its head at x, y */
const scNote = (x, y, z = 1) => gr(`<ellipse cx="0" cy="0" rx="${5.2 * z}" ry="${3.7 * z}" fill="${SC.ink}" transform="rotate(-22)"/>` + ln(4.6 * z, -1 * z, 4.6 * z, -24 * z, SC.ink, 1.2 * z), `translate(${x} ${y})`)
const scDyn = v => v > -3 ? 'f' : v > -6 ? 'mf' : v > -9 ? 'mp' : 'p'
/* a slur over a phrase, x0 … x1, its ends at y */
function scSlur (x0, x1, y) { const w = x1 - x0, h = Math.min(14, 4 + w * .03); return pa(`M${nn(x0 + 3)} ${y}C${nn(x0 + w * .25)} ${nn(y - h)} ${nn(x1 - w * .25)} ${nn(y - h)} ${nn(x1 - 3)} ${y}C${nn(x1 - w * .25)} ${nn(y - h + 2.2)} ${nn(x0 + w * .25)} ${nn(y - h + 2.2)} ${nn(x0 + 3)} ${y}Z`, { fill: SC.ink }) }
/* repeat barlines: thick, thin, two dots — facing in or out */
function scRepeat (x, y0, y1, dots, open) {
  const thick = open ? x : x - 6, thin = open ? x + 6 : x - 1
  let s = rc(thick, y0, 4, y1 - y0, { fill: SC.ink }) + rc(thin, y0, 1.1, y1 - y0, { fill: SC.ink })
  for (const yd of dots) s += ci(open ? x + 12 : x - 12, yd, 2.1, { fill: SC.ink })
  return s
}

THEMES.score = () => {
  const song = tdSong(), T = song.tracks, head = song.head
  let s = scDefs() + rc(0, 0, TW, TH, { fill: SC.paper }) + rc(0, 0, TW, TH, { fill: 'url(#sc-paper)' })
  /* the head of the page */
  s += tx(TW / 2, 66, song.name, { f: scF, z: 42, it: true, c: SC.ink, anchor: 'middle' })
  s += tx(TW / 2, 94, 'SLUR STUDIO', { f: scF, z: 11, w: 500, c: SC.ink2, anchor: 'middle', ls: 4 })
  s += scNote(66, 128, .9) + tx(80, 132, '= 92', { f: scF, z: 19, w: 600, c: SC.ink })
  s += tx(TW - 64, 58, 'bar 20', { f: scF, z: 22, it: true, c: SC.ink, anchor: 'end' }) + tx(TW - 64, 82, '0′ 49″ 5', { f: scF, z: 15, c: SC.ink2, anchor: 'end' })
  /* the system */
  const L = 300, R = TW - 56, top = 186, foot = 808, rh = (foot - top) / T.length
  tdMap(L + 34, R - 10, 1, song.end + 1)
  const drums = ['kick', 'snare', 'hats'], staffOf = (t, i) => { const y = top + i * rh, mid = y + rh / 2, one = drums.includes(t.name); return { y, mid, one, y0: one ? mid : mid - 16, y1: one ? mid : mid + 16 } }
  /* rehearsal marks */
  song.scenes.forEach((sc, i) => {
    const x = bx(sc.a), L2 = String.fromCharCode(65 + i)
    s += rc(x - 2, top - 62, 22, 22, { fill: 'none', stroke: SC.ink, sw: 1.3 }) + tx(x + 9, top - 45, L2, { f: scF, z: 17, w: 600, c: SC.ink, anchor: 'middle' }) + tx(x + 26, top - 45, sc.name, { f: scF, z: 15, it: true, c: SC.ink })
  })
  for (let b = 1; b <= song.end; b += 4) s += tx(bx(b) + 3, top - 18, String(b), { f: scF, z: 11, it: true, c: SC.ink2 })
  /* names, brackets, staves */
  T.forEach((t, i) => {
    const st = staffOf(t, i)
    s += tx(L - 64, st.mid + 6, t.name[0].toUpperCase() + t.name.slice(1), { f: scF, z: 18, it: true, c: SC.ink, anchor: 'end' })
    if (t.theirs) s += tx(L - 64, st.mid + 22, 'with ' + t.theirs, { f: scF, z: 11, it: true, c: SC.grey, anchor: 'end' })
    /* the level as a dynamic, and its marks: m, s, a red dot when it records */
    const v = t.vol || 0
    s += tx(118, st.mid + 6, scDyn(v), { f: scF, z: 20, w: 600, it: true, c: SC.ink }) + tx(150, st.mid + 5, (v > 0 ? '+' : '') + v.toFixed(1), { f: scF, z: 11, c: SC.grey })
    const mk = (x, ch, on) => (on ? ci(x, st.mid + 1, 8, { stroke: SC.ink, sw: 1 }) : '') + tx(x, st.mid + 5, ch, { f: scF, z: 13, it: true, c: on ? SC.ink : SC.grey, anchor: 'middle' })
    s += mk(42, 'm', !!t.mute) + mk(64, 's', !!t.solo) + (i === 4 ? ci(86, st.mid + 1, 4.5, { fill: SC.red }) : ci(86, st.mid + 1, 4, { stroke: SC.grey, sw: .8 }))
    if (st.one) s += ln(L, st.mid, R, st.mid, SC.rule, .9, .7)
    else for (let k = 0; k < 5; k++) s += ln(L, st.y0 + k * 8, R, st.y0 + k * 8, SC.rule, .75, .42)
    /* the time signature */
    if (st.one) s += tx(L + 14, st.mid - 2, '4', { f: scF, z: 18, w: 600, c: SC.ink, anchor: 'middle' }) + tx(L + 14, st.mid + 14, '4', { f: scF, z: 18, w: 600, c: SC.ink, anchor: 'middle' })
    else s += tx(L + 14, st.mid - 1, '4', { f: scF, z: 24, w: 600, c: SC.ink, anchor: 'middle' }) + tx(L + 14, st.mid + 16, '4', { f: scF, z: 24, w: 600, c: SC.ink, anchor: 'middle' })
    /* barlines through the staff */
    for (let b = 2; b <= song.end; b++) { const x = bx(b); s += ln(x, st.one ? st.mid - 9 : st.y0, x, st.one ? st.mid + 9 : st.y1, SC.rule, (b - 1) % 4 ? .5 : .9, (b - 1) % 4 ? .35 : .7) }
    /* the sound in ink, each region a phrase under a slur */
    for (const g of tdRegs(t, L + 30, R)) {
      if (tdIsNotes(t, g.r)) {
        const { d, tr } = tdNotes(g, st.y0 - 2, st.y1 - st.y0 + 4)
        s += gr(pa(d, { stroke: SC.ink, sw: 1.1, sa: .75 }), tr)
        const heads = [...d.matchAll(/M([\d.-]+) ([\d.-]+)/g)].slice(0, 400)
        s += gr(heads.map(m => `<ellipse cx="${m[1]}" cy="${m[2]}" rx="3.4" ry="2.4" fill="${SC.ink}" transform="rotate(-22 ${m[1]} ${m[2]})"/>`).join(''), tr)
      } else s += pa(tdWave(g, st.mid, st.one ? 15 : 18), { fill: SC.ink, fa: .82 })
      s += scSlur(g.xa + 2, g.xb - 2, (st.one ? st.mid - 18 : st.y0 - 8))
    }
  })
  /* the brackets: a square one for the drums, a brace for the keys */
  const d0 = staffOf(T[0], 0), d2 = staffOf(T[2], 2)
  s += rc(L - 16, d0.mid - 18, 4, d2.mid - d0.mid + 36, { fill: SC.ink }) + pa(`M${L - 16} ${d0.mid - 18}q8 -2 12 -9`, { stroke: SC.ink, sw: 2.2, cap: 'round' }) + pa(`M${L - 16} ${d2.mid + 18}q8 2 12 9`, { stroke: SC.ink, sw: 2.2, cap: 'round' })
  const kk = T.findIndex(t => t.name === 'keys')
  if (kk >= 0) { const k = staffOf(T[kk], kk), y0 = k.y0 - 4, y1 = k.y1 + 4, m = (y0 + y1) / 2, x = L - 14; s += pa(`M${x} ${y0}C${x - 10} ${y0 + 4} ${x + 2} ${m - 8} ${x - 9} ${m}C${x + 2} ${m + 8} ${x - 10} ${y1 - 4} ${x} ${y1}C${x - 6} ${y1 - 6} ${x - 1} ${m + 6} ${x - 6} ${m}C${x - 1} ${m - 6} ${x - 6} ${y0 + 6} ${x} ${y0}Z`, { fill: SC.ink }) }
  /* the system's barline at its start, and its end: a thin and a thick */
  s += rc(L, top + 6, 1.2, foot - top - 12, { fill: SC.ink }) + rc(R - 8, top + 6, 1.2, foot - top - 12, { fill: SC.ink }) + rc(R - 4.5, top + 6, 4.5, foot - top - 12, { fill: SC.ink })
  /* the cycle: repeat barlines at its ends, on every staff */
  const c0 = bx(song.cycle.a + 1), c1 = bx(song.cycle.b + 1)
  T.forEach((t, i) => { const st = staffOf(t, i), dy = st.one ? [st.mid - 5, st.mid + 5] : [st.mid - 4, st.mid + 4]; s += scRepeat(c0, st.one ? st.mid - 10 : st.y0, st.one ? st.mid + 10 : st.y1, dy, true) + scRepeat(c1, st.one ? st.mid - 10 : st.y0, st.one ? st.mid + 10 : st.y1, dy, false) })
  s += tx(c0 + 8, top - 4, 'cycle', { f: scF, z: 12, it: true, c: SC.red })
  /* the playhead: a red pencil line */
  const px = bx(head + 1)
  s += ln(px, top - 8, px, foot, SC.red, 1.3, .9) + pa(`M${px - 5} ${top - 14}L${px + 5} ${top - 14}L${px} ${top - 4}Z`, { fill: SC.red })
  /* the foot: the transport as a line of type */
  const fy = 850
  s += ln(L, fy - 22, R, fy - 22, SC.rule, .6, .3)
  const ctl = [['to the start', '⏮'], ['play', '▶'], ['stop', '■'], ['record', '●']]
  let x = TW / 2 - 170
  ctl.forEach(([w2, g], i) => { const on = w2 === 'play'; s += ci(x, fy, 15, on ? { fill: SC.ink } : { stroke: SC.ink, sw: 1 }) + tx(x + (w2 === 'play' ? 1.5 : 0), fy + 5, g, { z: 13, c: on ? SC.paper : w2 === 'record' ? SC.red : SC.ink, anchor: 'middle' }) + tx(x, fy + 32, w2, { f: scF, z: 11.5, it: true, c: SC.ink2, anchor: 'middle' }); x += 82 })
  s += tx(x + 10, fy + 5, 'cycle', { f: scF, z: 14, it: true, c: SC.red }) + tx(x + 60, fy + 5, 'click', { f: scF, z: 14, it: true, c: SC.grey })
  s += tx(56, fy + 5, 'pointer', { f: scF, z: 14, it: true, c: SC.ink }) + tx(120, fy + 5, 'grid ¼', { f: scF, z: 14, it: true, c: SC.ink2 }) + tx(184, fy + 5, 'nudge a beat', { f: scF, z: 14, it: true, c: SC.ink2 })
  s += tx(TW - 56, fy + 5, '1', { f: scF, z: 14, c: SC.ink2, anchor: 'end' })
  s += rc(0, 0, TW, TH, { fill: 'url(#sc-vig)' })
  return s
}
