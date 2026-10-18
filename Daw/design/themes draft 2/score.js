/* ── theme: score — the song as an engraved page, at the room's own size ──
   Draft 2: EB Garamond at the sizes of a printed part (its small capitals for names of things, italic for directions),
   staves of a part's proportions, the transport a line of small type at the foot. */
const SC = { paper: '#F7F2E7', ink: '#1D1A16', ink2: '#5C554B', rule: '#2A2520', red: '#B83A22', grey: '#8D8579' }
const scF = "'EB Garamond', serif"

function scDefs () {
  const r = rnd(11)
  let dots = ''
  for (let i = 0; i < 260; i++) dots += ci(r() * 200, r() * 200, .3 + r() * .45, { fill: r() > .5 ? '#000' : '#7A5A2A', fa: .02 + r() * .035 })
  return `<defs><pattern id="sc-paper" width="200" height="200" patternUnits="userSpaceOnUse">${dots}</pattern>
    <radialGradient id="sc-vig" cx=".5" cy=".45" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#5A4A30" stop-opacity=".1"/></radialGradient></defs>`
}
const scNote = (x, y, z = 1) => gr(`<ellipse cx="0" cy="0" rx="${4 * z}" ry="${2.9 * z}" fill="${SC.ink}" transform="rotate(-22)"/>` + ln(3.6 * z, -.8 * z, 3.6 * z, -18 * z, SC.ink, .9 * z), `translate(${x} ${y})`)
const scDyn = v => v > -3 ? 'f' : v > -6 ? 'mf' : v > -9 ? 'mp' : 'p'
function scSlur (x0, x1, y) { const w = x1 - x0, h = Math.min(9, 3 + w * .02); return pa(`M${nn(x0 + 3)} ${y}C${nn(x0 + w * .25)} ${nn(y - h)} ${nn(x1 - w * .25)} ${nn(y - h)} ${nn(x1 - 3)} ${y}C${nn(x1 - w * .25)} ${nn(y - h + 1.5)} ${nn(x0 + w * .25)} ${nn(y - h + 1.5)} ${nn(x0 + 3)} ${y}Z`, { fill: SC.ink }) }
function scRepeat (x, y0, y1, dots, open) {
  const thick = open ? x : x - 4.5, thin = open ? x + 4.5 : x - .8
  let s = rc(thick, y0, 3, y1 - y0, { fill: SC.ink }) + rc(thin, y0, .8, y1 - y0, { fill: SC.ink })
  for (const yd of dots) s += ci(open ? x + 9 : x - 9, yd, 1.5, { fill: SC.ink })
  return s
}

THEMES.score = () => {
  const song = tdSong(), T = song.tracks, head = song.head
  let s = scDefs() + rc(0, 0, TW, TH, { fill: SC.paper }) + rc(0, 0, TW, TH, { fill: 'url(#sc-paper)' })
  s += tx(TW / 2, 50, song.name, { f: scF, z: 26, it: true, c: SC.ink, anchor: 'middle' }) + tx(TW / 2, 68, 'slur studio', { f: scF, z: 10.5, w: 500, c: SC.ink2, anchor: 'middle', ls: 1.6, sc: true })
  s += scNote(48, 104, .62) + tx(58, 107, '= 92', { f: scF, z: 13, w: 500, c: SC.ink }) + tx(48, 124, 'four in a bar', { f: scF, z: 10.5, it: true, c: SC.ink2 })
  s += tx(TW - 48, 46, 'bar 20', { f: scF, z: 14, it: true, c: SC.ink, anchor: 'end' }) + tx(TW - 48, 62, '0′ 49″ 5', { f: scF, z: 10.5, c: SC.ink2, anchor: 'end' })
  const L = 250, R = TW - 44, top = 160, rh = 70, foot = top + rh * T.length
  tdMap(L + 28, R - 8, 1, song.end + 1)
  const drums = ['kick', 'snare', 'hats'], staffOf = (t, i) => { const y = top + i * rh, mid = y + rh / 2 + 4, one = drums.includes(t.name); return { y, mid, one, y0: one ? mid : mid - 12, y1: one ? mid : mid + 12 } }
  song.scenes.forEach((sc, i) => { const x = bx(sc.a); s += rc(x - 1, top - 40, 15, 15, { stroke: SC.ink, sw: 1 }) + tx(x + 6.5, top - 28.5, String.fromCharCode(65 + i), { f: scF, z: 11.5, w: 600, c: SC.ink, anchor: 'middle' }) + tx(x + 19, top - 28.5, sc.name, { f: scF, z: 11, it: true, c: SC.ink }) })
  for (let b = 1; b <= song.end; b += 4) s += tx(bx(b) + 2, top - 12, String(b), { f: scF, z: 8.5, it: true, c: SC.ink2 })
  T.forEach((t, i) => {
    const st = staffOf(t, i)
    s += tx(L - 44, st.mid + 4, t.name, { f: scF, z: 13, it: true, c: SC.ink, anchor: 'end' })
    if (t.theirs) s += tx(L - 44, st.mid + 16, 'with ' + t.theirs, { f: scF, z: 9, it: true, c: SC.grey, anchor: 'end' })
    const v = t.vol || 0
    s += tx(102, st.mid + 4, scDyn(v), { f: scF, z: 14, w: 600, it: true, c: SC.ink }) + tx(124, st.mid + 3.5, (v > 0 ? '+' : '') + v.toFixed(1), { f: scF, z: 8.5, c: SC.grey })
    const mk = (x, ch, on) => (on ? ci(x, st.mid + .5, 6, { stroke: SC.ink, sw: .8 }) : '') + tx(x, st.mid + 3.5, ch, { f: scF, z: 10, it: true, c: on ? SC.ink : SC.grey, anchor: 'middle' })
    s += mk(36, 'm', !!t.mute) + mk(54, 's', !!t.solo) + (i === 4 ? ci(72, st.mid + .5, 3.2, { fill: SC.red }) : ci(72, st.mid + .5, 3, { stroke: SC.grey, sw: .6 }))
    if (st.one) s += ln(L, st.mid, R, st.mid, SC.rule, .7, .7)
    else for (let k = 0; k < 5; k++) s += ln(L, st.y0 + k * 6, R, st.y0 + k * 6, SC.rule, .55, .42)
    if (st.one) s += tx(L + 11, st.mid - 1.5, '4', { f: scF, z: 12.5, w: 600, c: SC.ink, anchor: 'middle' }) + tx(L + 11, st.mid + 10, '4', { f: scF, z: 12.5, w: 600, c: SC.ink, anchor: 'middle' })
    else s += tx(L + 11, st.mid - .5, '4', { f: scF, z: 17, w: 600, c: SC.ink, anchor: 'middle' }) + tx(L + 11, st.mid + 12, '4', { f: scF, z: 17, w: 600, c: SC.ink, anchor: 'middle' })
    for (let b = 2; b <= song.end; b++) { const x = bx(b); s += ln(x, st.one ? st.mid - 7 : st.y0, x, st.one ? st.mid + 7 : st.y1, SC.rule, (b - 1) % 4 ? .4 : .7, (b - 1) % 4 ? .32 : .65) }
    for (const g of tdRegs(t, L + 26, R)) {
      if (tdIsNotes(t, g.r)) {
        const { d, tr } = tdNotes(g, st.y0 - 1, st.y1 - st.y0 + 2)
        s += gr(pa(d, { stroke: SC.ink, sw: .8, sa: .7 }), tr)
        const heads = [...d.matchAll(/M([\d.-]+) ([\d.-]+)/g)].slice(0, 500)
        s += gr(heads.map(m => `<ellipse cx="${m[1]}" cy="${m[2]}" rx="2.5" ry="1.8" fill="${SC.ink}" transform="rotate(-22 ${m[1]} ${m[2]})"/>`).join(''), tr)
      } else s += pa(tdWave(g, st.mid, st.one ? 11 : 13), { fill: SC.ink, fa: .8 })
      s += scSlur(g.xa + 2, g.xb - 2, st.one ? st.mid - 14 : st.y0 - 6)
    }
  })
  const d0 = staffOf(T[0], 0), d2 = staffOf(T[2], 2)
  s += rc(L - 12, d0.mid - 13, 3, d2.mid - d0.mid + 26, { fill: SC.ink }) + pa(`M${L - 12} ${d0.mid - 13}q6 -1.5 9 -7`, { stroke: SC.ink, sw: 1.6, cap: 'round' }) + pa(`M${L - 12} ${d2.mid + 13}q6 1.5 9 7`, { stroke: SC.ink, sw: 1.6, cap: 'round' })
  const kk = T.findIndex(t => t.name === 'keys')
  if (kk >= 0) { const k = staffOf(T[kk], kk), y0 = k.y0 - 3, y1 = k.y1 + 3, m = (y0 + y1) / 2, x = L - 10; s += pa(`M${x} ${y0}C${x - 7} ${y0 + 3} ${x + 1.5} ${m - 6} ${x - 6.5} ${m}C${x + 1.5} ${m + 6} ${x - 7} ${y1 - 3} ${x} ${y1}C${x - 4.5} ${y1 - 4.5} ${x - .8} ${m + 4.5} ${x - 4.5} ${m}C${x - .8} ${m - 4.5} ${x - 4.5} ${y0 + 4.5} ${x} ${y0}Z`, { fill: SC.ink }) }
  s += rc(L, top + 14, .9, foot - top - 28, { fill: SC.ink }) + rc(R - 6, top + 14, .9, foot - top - 28, { fill: SC.ink }) + rc(R - 3.4, top + 14, 3.4, foot - top - 28, { fill: SC.ink })
  const c0 = bx(song.cycle.a + 1), c1 = bx(song.cycle.b + 1)
  T.forEach((t, i) => { const st = staffOf(t, i), dy = st.one ? [st.mid - 3.6, st.mid + 3.6] : [st.mid - 3, st.mid + 3]; s += scRepeat(c0, st.one ? st.mid - 7.5 : st.y0, st.one ? st.mid + 7.5 : st.y1, dy, true) + scRepeat(c1, st.one ? st.mid - 7.5 : st.y0, st.one ? st.mid + 7.5 : st.y1, dy, false) })
  s += tx(c0 + 7, top - 2, 'cycle', { f: scF, z: 9.5, it: true, c: SC.red })
  const px = bx(head + 1)
  s += ln(px, top - 6, px, foot - 8, SC.red, .9, .9) + pa(`M${px - 3.5} ${top - 10}L${px + 3.5} ${top - 10}L${px} ${top - 3}Z`, { fill: SC.red })
  /* the foot of the page: the transport, a line of type */
  const fy = 852
  s += ln(L, fy - 26, R, fy - 26, SC.rule, .5, .25)
  const ctl = [['to the start', '⏮'], ['play', '▶'], ['stop', '■'], ['record', '●']]
  let x = TW / 2 - 120
  ctl.forEach(([w2, g]) => { const on = w2 === 'play'; s += ci(x, fy - 4, 10, on ? { fill: SC.ink } : { stroke: SC.ink, sw: .8 }) + tx(x + (on ? 1 : 0), fy - .6, g, { z: 8.5, c: on ? SC.paper : w2 === 'record' ? SC.red : SC.ink, anchor: 'middle' }) + tx(x, fy + 18, w2, { f: scF, z: 9.5, it: true, c: SC.ink2, anchor: 'middle' }); x += 60 })
  s += tx(x + 6, fy, 'cycle', { f: scF, z: 11, it: true, c: SC.red }) + tx(x + 44, fy, 'click', { f: scF, z: 11, it: true, c: SC.grey })
  s += tx(44, fy, 'pointer', { f: scF, z: 11, it: true, c: SC.ink }) + tx(96, fy, 'grid ¼', { f: scF, z: 11, it: true, c: SC.ink2 }) + tx(146, fy, 'nudge a beat', { f: scF, z: 11, it: true, c: SC.ink2 })
  s += tx(TW - 44, fy, '1', { f: scF, z: 11, c: SC.ink2, anchor: 'end' })
  s += rc(0, 0, TW, TH, { fill: 'url(#sc-vig)' })
  return s
}
