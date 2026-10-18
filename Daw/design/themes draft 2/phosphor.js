/* ── theme: phosphor — the room as a terminal on an amber screen, at the room's own size ──
   Draft 2: one face, IBM Plex Mono, at a terminal's size; the glow and the tube's lines held back; the mixer docked
   as a pane of text. */
const PH2 = { bg: '#0B0805', amb: '#FFB000', dim: '#8A5E00' }
const phF = "'IBM Plex Mono', monospace"
const BLOCKS = ' ▁▂▃▄▅▆▇█'
function phDefs () {
  return `<defs>
    <pattern id="ph-scan" width="4" height="3" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#000" fill-opacity=".3"/></pattern>
    <radialGradient id="ph-vig" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></radialGradient>
    <radialGradient id="ph-tube" cx=".5" cy=".45" r=".7"><stop offset="0" stop-color="#1A1106"/><stop offset="1" stop-color="${PH2.bg}"/></radialGradient>
    <filter id="ph-glow" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur in="SourceGraphic" stdDeviation="1.6" result="b"/><feComponentTransfer in="b" result="bb"><feFuncA type="linear" slope=".42"/></feComponentTransfer><feMerge><feMergeNode in="bb"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>`
}
const phT = (x, y, s, o = {}) => tx(x, y, s, Object.assign({ f: phF, z: 11, w: 400, c: PH2.amb, more: ' xml:space="preserve"' }, o))
const phInv = (x, y, s, o = {}) => { const z = o.z || 11, w = tw2(s, phF, z, o.w || 400); return rc(x - 1, y - z + 1.5, w + 2, z + 3, { fill: PH2.amb }) + phT(x, y, s, Object.assign({}, o, { c: PH2.bg })) }

THEMES.phosphor = () => {
  const song = tdSong(), T = song.tracks, head = song.head
  const cw = tw2('─', phF, 11), row = 15
  let s = phDefs() + rc(0, 0, TW, TH, { fill: '#050403' }) + rc(10, 8, TW - 20, TH - 16, { rx: 18, fill: 'url(#ph-tube)' })
  let g = ''
  const X0p = 30, Y0 = 34
  g += phInv(X0p, Y0, ' slur studio ') + phT(X0p + 110, Y0, ' 1:arrange*  2:mixer  3:patch  4:notes  5:prompt ') + phT(TW - 30, Y0, `${song.name}   92.00 bpm   4/4   44.1 kHz`, { anchor: 'end', a: .8 })
  g += phT(X0p, 72, '020.1.1', { z: 30, w: 500 }) + phT(X0p + 150, 72, '00:49.5', { z: 20, a: .85 })
  g += phInv(X0p + 290, 58, ' ▶ play ') + phT(X0p + 360, 58, '[■] stop  [●] rec  [⏮] start') + phT(X0p + 290, 76, 'cycle [017─025]   click off   count off   nudge beat   grid 1/4', { a: .7 })
  g += phT(TW - 30, 56, 'out', { anchor: 'end', a: .55 }) + phT(TW - 30, 70, '█████████████▌░░░░ −4.2', { anchor: 'end' }) + phT(TW - 30, 84, '█████████████▏░░░░ −4.6', { anchor: 'end' })
  const top = 104, HW = Math.round(300 / cw) * cw, L = X0p + HW, R = TW - 30 - cw, rh = 46
  const frame = (x0, y0, x1, y1, title) => { const n = Math.round((x1 - x0) / cw); let o = phT(x0, y0, '┌' + '─'.repeat(n - 1) + '┐') + phT(x0, y1, '└' + '─'.repeat(n - 1) + '┘'); for (let y = y0 + row; y < y1; y += row) o += phT(x0, y, '│') + phT(x0 + n * cw, y, '│'); if (title) o += rc(x0 + cw * 2, y0 - 10, tw2(` ${title} `, phF, 11), 13, { fill: '#120C05' }) + phT(x0 + cw * 2, y0, ` ${title} `); return o }
  const laneTop = top + row * 3.4, foot = laneTop + rh * T.length + 8
  g += frame(X0p, top, L, foot, 'tracks') + frame(L + cw, top, R + cw, foot, 'arrange')
  tdMap(L + cw * 2, R - cw, 1, song.end + 1)
  const snap = x => Math.round(x / cw) * cw
  for (const sc of song.scenes) g += phT(snap(bx(sc.a)), top + row * 1.2, '├' + sc.name)
  for (let b = 1; b <= song.end; b += 4) g += phT(snap(bx(b)), top + row * 2.2, String(b), { a: .55, z: 10 })
  const c0 = snap(bx(song.cycle.a + 1)), c1 = snap(bx(song.cycle.b + 1))
  g += phT(c0, top + row * 3, '[' + '═'.repeat(Math.max(0, Math.round((c1 - c0) / cw) - 2)) + ']', { a: .75 })
  T.forEach((t, i) => {
    const y = laneTop + i * rh, mid = y + rh / 2
    const lvn = Math.max(0, Math.min(10, Math.round(((t.vol || 0) + 24) / 3)))
    g += phT(X0p + cw * 2, mid + 3, String(i + 1).padStart(2, '0') + ' ' + t.name.padEnd(7))
    const bxx = X0p + cw * 13
    g += (t.mute ? phInv(bxx, mid + 3, 'm') : phT(bxx, mid + 3, 'm', { a: .4 })) + (t.solo ? phInv(bxx + cw * 2, mid + 3, 's') : phT(bxx + cw * 2, mid + 3, 's', { a: .4 })) + (i === 4 ? phInv(bxx + cw * 4, mid + 3, 'r') : phT(bxx + cw * 4, mid + 3, 'r', { a: .4 }))
    g += phT(bxx + cw * 7, mid + 3, '█'.repeat(lvn) + '░'.repeat(10 - lvn) + ' ' + ((t.vol || 0) > 0 ? '+' : '') + (t.vol || 0).toFixed(1), { a: .85 })
    if (t.theirs) g += phT(X0p + cw * 5, mid + 16, 'with ' + t.theirs, { a: .45, z: 9.5 })
    for (const rg of tdRegs(t, L + cw * 2, R - cw)) {
      g += rc(rg.xa + 1, y + 5, rg.w - 2, rh - 10, { fill: PH2.amb, fa: .06 }) + ln(rg.xa + .5, y + 5, rg.xa + .5, y + rh - 5, PH2.amb, .8, .5)
      if (tdIsNotes(t, rg.r)) { const { d, tr } = tdNotes(rg, y + 8, rh - 16); g += gr(pa(d, { stroke: PH2.amb, sw: 1.4 }), tr); continue }
      const bw = tw2('█', phF, 9), pk = tdPeaks(rg.r, rg.w, rg.v0, rg.v1), cells = Math.floor(pk.length / bw), sy = (rh / 2 - 6) / 7
      let up = ''
      for (let k = 0; k < cells; k++) { let m = 0, c = 0, tp = 0; for (let j = Math.floor(k * bw); j < Math.floor((k + 1) * bw); j++) { m += pk[j] || 0; c++; tp = Math.max(tp, pk[j] || 0) } m = Math.min(1, tp * .7 + m / Math.max(1, c) * .5); up += BLOCKS[Math.min(8, Math.round(m * 8))] }
      const x = rg.xa + rg.v0
      g += gr(phT(0, 0, up, { z: 9 }), `translate(${nn(x)} ${nn(mid + 1)}) scale(1 ${nn(sy)})`) + gr(phT(0, 0, up, { z: 9, a: .45 }), `translate(${nn(x)} ${nn(mid + 1)}) scale(1 ${nn(-sy)})`)
    }
  })
  const px = bx(head + 1)
  g += phT(px - cw / 2, laneTop - 4, '▼') + rc(px - .6, laneTop, 1.2, foot - laneTop - row, { fill: PH2.amb })
  /* the mixer: a pane of text */
  const my = foot + 26, ST = T.concat([{ name: 'plate', vol: 0, regs: [], bus: true }])
  g += frame(X0p, my, TW - 30 - cw, my + row * (ST.length + 3), 'mixer')
  g += phT(X0p + cw * 2, my + row * 1.3, 'strip    level                    db     pan            meter              m s r', { a: .55 })
  ST.forEach((t, i) => {
    const y = my + row * (2.4 + i), lvn = Math.max(0, Math.min(20, Math.round(((t.vol || 0) + 30) / 1.8))), pn = Math.round(((t.pan || 0) + 1) * 6), mtr = t.bus ? 7 : Math.max(0, Math.min(18, Math.round((tdLevel(t, head) + 30) / 1.9)))
    g += phT(X0p + cw * 2, y, t.name.padEnd(9) + '━'.repeat(lvn) + '●' + '─'.repeat(20 - lvn) + '  ' + (((t.vol || 0) > 0 ? '+' : '') + (t.vol || 0).toFixed(1)).padStart(5) + '   ◂' + '─'.repeat(pn) + '┼' + '─'.repeat(12 - pn) + '▸   ' + '█'.repeat(mtr) + '░'.repeat(18 - mtr) + '   ' + (i === 2 ? '■' : '□') + ' □ ' + (i === 4 ? '■' : '□'))
  })
  const sy = TH - 46
  g += rc(X0p - 2, sy - 12, TW - 60 + 4, 16, { fill: PH2.amb }) + phT(X0p, sy, ' ARRANGE  pointer │ smart │ grid 1/4 │ nudge beat │ cycle on │ click off │ region keys │ gain 0.0 ', { c: PH2.bg }) + phT(TW - 30, sy, ' track 05/08  bar 20 ', { c: PH2.bg, anchor: 'end' })
  g += phT(X0p, sy + 22, ':split at the playhead') + rc(X0p + tw2(':split at the playhead', phF, 11) + 2, sy + 12, cw, 13, { fill: PH2.amb }) + phT(TW - 30, sy + 22, '? keys   / say it   : command', { anchor: 'end', a: .5 })
  s += gr(g, '', ' filter="url(#ph-glow)"') + rc(10, 8, TW - 20, TH - 16, { rx: 18, fill: 'url(#ph-scan)' }) + rc(10, 8, TW - 20, TH - 16, { rx: 18, fill: 'url(#ph-vig)' }) + rc(10, 8, TW - 20, TH - 16, { rx: 18, stroke: '#2A2118', sw: 2 })
  return s
}
