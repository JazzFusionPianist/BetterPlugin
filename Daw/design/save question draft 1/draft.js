/* Slur Studio, the question asked when the app is closed with the song changed: draft 1 (2026-10-11).
   Read by the room's own page (draft.mjs loads it over ui/doors.js's pLeave): drawn with the room's kit, in the middle
   of the window. `kind`: 'a' the song itself is shown, seen from far away, over its name; 'b' words alone. */
function pLeaveDraft (kind) {
  const q = S.leave
  if (!q) return ''
  const w = 460, pad = 24, mh = 72, h = kind === 'a' ? 226 : 148
  const x = Math.round((W - w) / 2), y = Math.round((H - h) / 2), L = x + pad, Rr = x + w - pad
  let s = hit(0, 0, W, H, 'leave', ' data-k="none"', 'default') + R(0, 0, W, H, { fill: K0, fa: .62 })
  s += R(x, y, w, h, { rx: 5, fill: K2 }) + R(x + .5, y + .5, w - 1, h - 1, { rx: 5, stroke: INK, sa: .28 })
  let cy
  if (kind === 'a') {
    s += T(L, y + 34, 'save before closing?', { size: 12.5, w: 500, a: .94 })
    /* the song, seen from far away: every track a line of its own colour, as long as its regions */
    const my = y + 52, mw = w - pad * 2, rows = S.tracks.filter(t => t.kind !== 'bus' && t.regs.length), rh = Math.min(5, (mh - 14) / Math.max(1, rows.length)), top = my + (mh - rows.length * rh) / 2
    s += R(L, my, mw, mh, { rx: 2, fill: K0 }) + R(L + .5, my + .5, mw - 1, mh - 1, { rx: 2, stroke: INK, sa: .12 })
    rows.forEach((t, i) => { for (const r of t.regs) s += R(L + 8 + (r.a - 1) / SONG_END * (mw - 16), top + i * rh, Math.max(1, (r.b - r.a) / SONG_END * (mw - 16) - .7), Math.max(1, rh - .8), { fill: t.c }) })
    cy = my + mh + 22
    s += T(L, cy, fit(q.name, 250, 11.5, 500), { size: 11.5, w: 500 }) + T(Rr, cy, q.since, { size: 9.5, a: .46, anchor: 'end' })
  } else {
    s += T(L, y + 38, fit(q.name, w - pad * 2, 15, 500), { size: 15, w: 500, a: .96 })
    s += T(L, y + 60, 'save before closing?', { size: 10.5, a: .62 }) + T(Rr, y + 60, q.since, { size: 9.5, a: .46, anchor: 'end' })
  }
  /* the answers, each with its key: the one return gives is filled */
  const fy = y + h - 24 - 22, o = { size: 10, pad: 11, frame: .26 }
  s += hline(x + 1, x + w - 1, fy - 18, .1)
  s += cells(L, fy, 22, [{ t: 'don’t save', k: 'd', a: 'leave', more: ' data-k="dont"', on: q.busy === 'dont' }], o)[0]
  const right = [{ t: 'cancel', k: 'esc', a: 'leave', more: ' data-k="cancel"' }, { t: 'save', k: '↩', a: 'leave', more: ' data-k="save"', on: true }]
  return s + cells(Rr - cells(0, 0, 22, right, o)[1], fy, 22, right, o)[0]
}
