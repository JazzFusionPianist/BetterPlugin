/* ── theme: phosphor — the room as a terminal on an amber screen ──
   One colour, one typeface of fixed width, a glow and the lines of a tube. Everything is text: frames are drawn with
   box characters, a track's sound is a column of block characters for every cell, mirrored; levels are bars of blocks.
   Tabs along the top as a terminal multiplexer has them, a status line at the foot as an editor has it, and under it
   the command line, which the room already has. For those who live in a shell. */
const PH2 = { bg: '#0B0805', amb: '#FFB000', dim: '#8A5E00', deep: '#3A2600' }
const phF = { mono: "'IBM Plex Mono', monospace", big: "'VT323', monospace" }
const BLOCKS = ' ▁▂▃▄▅▆▇█'

function phDefs () {
  return `<defs>
    <pattern id="ph-scan" width="4" height="3" patternUnits="userSpaceOnUse"><rect width="4" height="1.2" fill="#000" fill-opacity=".38"/></pattern>
    <radialGradient id="ph-vig" cx=".5" cy=".5" r=".72"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".75"/></radialGradient>
    <radialGradient id="ph-tube" cx=".5" cy=".45" r=".7"><stop offset="0" stop-color="#1C1206"/><stop offset="1" stop-color="${PH2.bg}"/></radialGradient>
    <filter id="ph-glow" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur in="SourceGraphic" stdDeviation="2.4" result="b"/><feComponentTransfer in="b" result="bb"><feFuncA type="linear" slope=".55"/></feComponentTransfer><feMerge><feMergeNode in="bb"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>`
}
const phT = (x, y, s, o = {}) => tx(x, y, s, Object.assign({ f: phF.mono, z: 13, w: 500, c: PH2.amb, more: ' xml:space="preserve"' }, o))
/* text on an amber block (inverse) */
const phInv = (x, y, s, o = {}) => { const z = o.z || 13, w = tw2(s, phF.mono, z, 500); return rc(x - 2, y - z + 2, w + 4, z + 4, { fill: PH2.amb }) + phT(x, y, s, Object.assign({}, o, { c: PH2.bg })) }

THEMES.phosphor = () => {
  const song = tdSong(), T = song.tracks, head = song.head
  const cw = tw2('─', phF.mono, 13, 500), row = 18
  let s = phDefs() + rc(0, 0, TW, TH, { fill: '#050403' }) + rc(16, 14, TW - 32, TH - 28, { rx: 26, fill: 'url(#ph-tube)' })
  let g = ''
  /* tabs */
  const X0p = 40, Y0 = 46
  g += phInv(X0p, Y0, ' slur studio ') + phT(X0p + 130, Y0, ' 1:arrange*  2:mixer  3:patch  4:notes  5:prompt ') + phT(TW - 40, Y0, `${song.name}   92.00 bpm   4/4 `, { anchor: 'end', c: PH2.amb })
  /* the place, big */
  g += tx(X0p, 116, '020.1.1', { f: phF.big, z: 74, c: PH2.amb }) + tx(X0p + 300, 116, '00:49.5', { f: phF.big, z: 46, c: PH2.amb, a: .85 })
  g += phInv(X0p + 520, 84, ' ▶ PLAY ') + phT(X0p + 620, 84, '[■] stop  [●] rec  [⏮] start') + phT(X0p + 520, 110, 'cycle  [017 ── 025]   click off   count off   nudge beat   grid 1/4', { c: PH2.amb, a: .75 })
  g += phT(TW - 40, 84, 'out ', { anchor: 'end', a: .6 }) + phT(TW - 40, 102, '█████████████▌░░░░ −4.2', { anchor: 'end' }) + phT(TW - 40, 120, '█████████████▏░░░░ −4.6', { anchor: 'end' })
  /* the frames */
  const top = 150, foot = 806, HW = Math.round(330 / cw) * cw, L = X0p + HW, R = TW - 40 - cw
  const frame = (x0, y0, x1, y1, title) => { const n = Math.round((x1 - x0) / cw); let o = phT(x0, y0, '┌' + '─'.repeat(n - 1) + '┐') + phT(x0, y1, '└' + '─'.repeat(n - 1) + '┘'); for (let y = y0 + row; y < y1; y += row) o += phT(x0, y, '│') + phT(x0 + n * cw, y, '│'); if (title) o += rc(x0 + cw * 2, y0 - 12, tw2(` ${title} `, phF.mono, 13, 500), 16, { fill: '#120C05' }) + phT(x0 + cw * 2, y0, ` ${title} `); return o }
  g += frame(X0p, top, L, foot, 'tracks') + frame(L + cw, top, R + cw, foot, 'arrange')
  /* markers and bars */
  tdMap(L + cw * 2, R - cw, 1, song.end + 1)
  const snap = x => Math.round(x / cw) * cw
  for (const sc of song.scenes) { const x = snap(bx(sc.a)); g += phT(x, top + row * 1.4, '├' + sc.name) }
  for (let b = 1; b <= song.end; b += 4) g += phT(snap(bx(b)), top + row * 2.5, String(b), { a: .6 })
  const c0 = snap(bx(song.cycle.a + 1)), c1 = snap(bx(song.cycle.b + 1))
  g += phT(c0, top + row * 3.4, '[' + '═'.repeat(Math.max(0, Math.round((c1 - c0) / cw) - 2)) + ']', { a: .8 })
  /* tracks: a row of text at the left; the sound as blocks */
  const laneTop = top + row * 4, rh = (foot - laneTop - row * .5) / T.length
  T.forEach((t, i) => {
    const y = laneTop + i * rh, mid = y + rh / 2
    const lvn = Math.max(0, Math.min(10, Math.round(((t.vol || 0) + 24) / 3)))
    g += phT(X0p + cw * 2, mid - 4, String(i + 1).padStart(2, '0') + ' ' + t.name.padEnd(8))
    const bxx = X0p + cw * 14
    g += (t.mute ? phInv(bxx, mid - 4, 'm') : phT(bxx, mid - 4, 'm', { a: .45 })) + (t.solo ? phInv(bxx + cw * 2, mid - 4, 's') : phT(bxx + cw * 2, mid - 4, 's', { a: .45 })) + (i === 4 ? phInv(bxx + cw * 4, mid - 4, 'r') : phT(bxx + cw * 4, mid - 4, 'r', { a: .45 }))
    g += phT(bxx + cw * 7, mid - 4, '█'.repeat(lvn) + '░'.repeat(10 - lvn) + ' ' + ((t.vol || 0) > 0 ? '+' : '') + (t.vol || 0).toFixed(1), { a: .9 })
    if (t.theirs) g += phT(X0p + cw * 5, mid + 13, 'with ' + t.theirs, { a: .5, z: 11 })
    g += phT(X0p + cw * 2, y + rh - 2, '·'.repeat(0), {})
    /* the sound: a block for every cell, mirrored */
    for (const rg of tdRegs(t, L + cw * 2, R - cw)) {
      g += rc(rg.xa + 1, y + 6, rg.w - 2, rh - 12, { fill: PH2.amb, fa: .07 }) + ln(rg.xa + .5, y + 6, rg.xa + .5, y + rh - 6, PH2.amb, 1, .55)
      if (tdIsNotes(t, rg.r)) { const { d, tr } = tdNotes(rg, y + 9, rh - 18); g += gr(pa(d, { stroke: PH2.amb, sw: 2 }), tr); continue }
      const bw = tw2('█', phF.mono, 13, 500), pk = tdPeaks(rg.r, rg.w, rg.v0, rg.v1), cells = Math.floor(pk.length / bw), sy = (rh / 2 - 8) / 10.5
      let up = ''
      for (let k = 0; k < cells; k++) { let m = 0, c = 0, top = 0; for (let j = Math.floor(k * bw); j < Math.floor((k + 1) * bw); j++) { m += pk[j] || 0; c++; top = Math.max(top, pk[j] || 0) } m = Math.min(1, top * .7 + m / Math.max(1, c) * .5); up += BLOCKS[Math.min(8, Math.round(m * 8))] }      // (a cell: the mean of its sound)
      const x = rg.xa + rg.v0
      g += gr(phT(0, 0, up), `translate(${nn(x)} ${nn(mid + 1)}) scale(1 ${nn(sy)})`) + gr(phT(0, 0, up, { a: .5 }), `translate(${nn(x)} ${nn(mid + 1)}) scale(1 ${nn(-sy)})`)
    }
  })
  /* the playhead */
  const px = bx(head + 1)
  g += phT(px - cw / 2, laneTop - 6, '▼') + rc(px - .8, laneTop, 1.6, foot - laneTop - row, { fill: PH2.amb })
  /* the status line and the command line */
  const sy = foot + 34
  g += rc(X0p - 2, sy - 15, TW - 80 + 4, 20, { fill: PH2.amb })
  g += phT(X0p, sy, ' ARRANGE  pointer │ smart │ grid 1/4 │ nudge beat │ cycle on │ click off │ region keys │ gain 0.0 ', { c: PH2.bg }) + phT(TW - 40, sy, ' track 05/08  bar 20 ', { c: PH2.bg, anchor: 'end' })
  g += phT(X0p, sy + 30, ':split at the playhead') + rc(X0p + tw2(':split at the playhead', phF.mono, 13, 500) + 2, sy + 17, cw, 17, { fill: PH2.amb })
  g += phT(TW - 40, sy + 30, '? keys   / say it   : command', { anchor: 'end', a: .55 })
  s += gr(g, '', ' filter="url(#ph-glow)"')
  s += rc(16, 14, TW - 32, TH - 28, { rx: 26, fill: 'url(#ph-scan)' }) + rc(16, 14, TW - 32, TH - 28, { rx: 26, fill: 'url(#ph-vig)' })
  s += rc(16, 14, TW - 32, TH - 28, { rx: 26, stroke: '#2A2118', sw: 3 })
  return s
}
