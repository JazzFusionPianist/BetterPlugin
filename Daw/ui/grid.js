/* ── the grid on the lanes ──
   Lines down the lanes at the division chosen in the control bar (grid: so many to a whole note — 1/4 unless another is
   chosen; 1/3, 1/6, 1/12 and 1/24 are the triplet ones). Three weights: a bar line, a line that falls on a beat, and
   every other line of the division — much fainter, so that a fine grid is felt more than seen. The division is counted
   from each bar line. Seen from far away the lines would run together: then only every second (or third) of them is
   drawn, and in the end the bars alone — every one, then every second, fourth … as before.
   What is pulled along the lanes goes to the steps of the grid's own kind: with a triplet grid, to thirds, sixths,
   twelfths … of a whole note instead of halves, quarters, eighths (gridSteps, in edit.js, asks gridTriple here).
   (Read after the room is made, before it is put to work. ui.js draws the lanes with gridLanes and the control bar's cell
   with gridName; a press on that cell opens gridMenu.) */
const GRIDS = ['1/1', '1/2', '1/4', '1/8', '1/16', '1/32', '1/3', '1/6', '1/12', '1/24']
const GRID_A = { bar: .13, far: .05, beat: .07, sub: .03, deep: .02 }                         // how strong a line is: a bar's (far: a bar between the named ones, seen from far away), a beat's, the rest of the division, what the close-up counts below it
const GRID_W = 66, GRID_MIN = 7                                                          // the cell in the control bar; the least room between two lines, in the room's units
S.grid = '1/4'
const gridN = () => +String(S.grid).slice(2) || 4                                        // so many to a whole note
const gridTriple = () => gridN() % 3 === 0
const gridName = () => S.grid
/* the division as it is drawn at this zoom: so many to a whole note — the chosen one, or the next coarser of its kind that leaves room between its lines (0: none of them does, the bars stand alone) */
function gridShown () {
  const w = WHOLE()
  for (let k = gridN(); k >= 1; k = k % 2 === 0 && (k % 3 !== 0 || (k / 2) % 3 === 0) ? k / 2 : k % 3 === 0 ? k / 3 : 0) { if (w / k < 1 - 1e-9 && w / k * PXB >= GRID_MIN) return k; if (k === 1) break }
  return 0
}
function setGrid (v) { if (!GRIDS.includes(v)) return; S.grid = v; say(`grid ${v}`); uiDirty('top', 'lanes') }
function gridMenu () {
  if (S.menu) { S.menu = null; uiDirty('menu'); return }
  const at = typeof skinMenuAt === 'function' && skinMenuAt('grid')                 // (a theme's own word for the grid: the menu stands at it — skins.js)
  openMenu(at ? at.x : DISP_X + 308 + NUDGE_W, at ? at.y : barMenuY(), GRIDS.map((v, i) => ({ t: v, v, on: v === S.grid, sep: v === '1/3' })), it => setGrid(it.v), { w: 96, up: at && at.up })
}
/* the lines, as the lanes' own drawing: D is the close-up's steps (ui.js, deepSteps) when the view is that near */
function gridLanes (D) {
  const span = (X1 - X0) / PXB, beats = BEATS(), top = TY, bot = BY
  const ln = x => `M${n(x) + .5} ${top}V${bot}`
  let far = '', bar = '', beat = '', sub = '', deep = ''
  /* the bars: every one while they stand far enough apart, else every second, fourth …; those the ruler names are the stronger */
  const lab = [1, 2, 4, 8, 16, 32, 64].find(k => k * PXB >= 56) || 64, major = lab > 1 && lab / 2 * PXB >= 14 ? lab / 2 : lab
  const b0 = Math.floor(VX / major) * major, b1 = Math.min(SONG_END, VX + span + 1)
  for (let b = b0; b <= b1; b += major) { const x = bx(b + 1); if (x < X0 || x > X1) continue; if (b % lab === 0) bar += ln(x); else far += ln(x) }
  /* the division inside each bar, counted from its line */
  const k = major === 1 ? gridShown() : 0
  if (k) {
    const step = WHOLE() / k
    for (let b = Math.max(0, Math.floor(VX)); b <= b1 && b < SONG_END; b++) for (let j = 1; j * step < 1 - 1e-9; j++) {
      const p = b + j * step, x = bx(p + 1)
      if (x < X0 || x > X1) continue
      const onBeat = Math.abs(p * beats - Math.round(p * beats)) < 1e-6
      if (onBeat) beat += ln(x); else sub += ln(x)
    }
  }
  /* close up, what the ruler counts below the division (sixteenths, ticks, samples): fainter still */
  if (D) for (const [x, , p] of deepLines(D)) { if (p > SONG_END + 1e-9) continue; const q = (p - Math.floor(p + 1e-9)) * k / WHOLE(); if (k && Math.abs(q - Math.round(q)) < 1e-6) continue; deep += ln(x) }
  return P(deep, { stroke: INK, sa: GRID_A.deep }) + P(sub, { stroke: INK, sa: GRID_A.sub }) + P(beat, { stroke: INK, sa: GRID_A.beat }) + P(far, { stroke: INK, sa: GRID_A.far }) + P(bar, { stroke: INK, sa: GRID_A.bar })
}
