/* ── rubato: the bar while it is on, with a region chosen ──
   How the region's track is stretched (STRETCH, flex.js: chords, voice, cut, beat — chosen for a track and the tracks of
   its edit group), how sure a marker must be to be shown (hits and notes, each a rail: t.hs, t.ns), and quantize. A track
   keeps all three in the song. Read after flex.js, edit.js and project.js. */
for (const keep of [typeof KEEP_T !== 'undefined' ? KEEP_T : null, typeof T_KEEP !== 'undefined' ? T_KEEP : null]) if (keep) for (const k of ['stretch', 'hs', 'ns']) if (!keep.includes(k)) keep.push(k)      // (kept in the song, and by undo)
/* the bar, in rubato with a region chosen: how its track is stretched, how sure a marker must be to be shown — hits and
   notes, each a short rail (a press or a pull sets it; ⌥ and a press: as at first) — and quantize. Returns [drawing, x]. */
const SENS_W = 44, RUB = { sx: [0, 0] }
function rubatoBar (x, y, by, r, t, lim) {
  let s = ''
  const lab = w => { s += T(x, by, w, { size: 9.5, a: .4 }); x += tw(w, 9.5) + 6 }
  if (!r.loop && !r.notes) {
    lab('stretch'); { const [k, w] = menuKey(x, y + 4, '\u2063' + stretchOf(t), { a: 'rstretch' }); s += k; x += w + 14 }      // (the four are names, said the same in every language)
    for (const [w, k] of [['hits', 0], ['notes', 1]]) {
      if (x + 130 > lim) break
      lab(w); x += 1
      const v = sensOf(t, k), zy = y + 13, at = (SENS_W - 2) * v / 100
      RUB.sx[k] = x
      s += R(x, zy - 1, SENS_W, 2, { fill: INK, fa: .14 }) + R(x, zy - 1, at, 2, { fill: INK, fa: .5 }) + R(x + at, zy - 5, 2, 10, { fill: INK }) + hit(x - 6, y + 2, SENS_W + 12, 22, 'rsens', ` data-k="${k}"`, 'ew-resize')
      x += SENS_W + 7; s += T(x, by, String(Math.round(v)), { size: 9.5, a: .72 }); x += tw(String(Math.round(v)), 9.5) + 14
    }
  }
  if (x + 110 < lim) { const [k1, w1] = key(x, y + 4, 'quantize', { a: 'qgo' }), [k2, w2] = menuKey(x + w1 + 6, y + 4, qName(S.q), { a: 'qval' }); s += k1 + k2; x += w1 + 6 + w2 + 14 }
  return [s, x]
}
/* how the chosen region's track is stretched: chosen from the four; every region of it is rendered again */
function openStretchMenu (x, y) {
  const rs = selRegs(), t = rs.length ? rs[0][1] : S.tracks[S.sel]
  if (!t) return
  openMenu(x, y, STRETCH.map(([v, say, logic]) => ({ t: `${v} — ${say}`, k: logic, v, on: stretchOf(t) === v })), it => {
    const ts = [...new Set([t].concat(groupMates(t, 'rubato')))]
    edit(() => { for (const x of ts) { if (it.v === 'chords') delete x.stretch; else x.stretch = it.v } })
    rewarp(ts.flatMap(x => x.regs)); uiDirty('info', 'lanes')
  }, { w: 380 })
}
/* a sensitivity pulled along its rail (k: 0 hits, 1 notes); what is shown follows at once, and a track stretched by its
   hits (voice, cut, beat) is rendered again when the hand lets go */
function sensDown (k, p, reset) {
  const rs = selRegs(), t = rs.length ? rs[0][1] : null
  if (!t) return
  if (reset) { edit(() => { delete t[k ? 'ns' : 'hs'] }); sensDone(t); return }
  drag = { a: 'rsens', k, t, x0: RUB.sx[k], before: editState() }
  sensMove(p)
}
function sensMove (p) {
  const d = drag, v = Math.round(clamp((p.x - d.x0) / (SENS_W - 2), 0, 1) * 100)
  if (sensOf(d.t, d.k) !== v) { d.t[d.k ? 'ns' : 'hs'] = v; d.moved = true; uiDirty('info', 'lanes') }
}
function sensUp (d) { if (d.moved) { commit(d.before); sensDone(d.t) } }
const sensDone = t => { if (stretchOf(t) !== 'chords') rewarp(t.regs); uiDirty('info', 'lanes') }      // (voice keeps each hit's attack, cut and beat cut there: all three follow the hits shown)
