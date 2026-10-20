/* ── the sounds a project could not find ──
   A region whose sound is not where the project keeps its sounds — the project copied to another Mac without them, moved
   away from its folder, or kept where the Mac would not let the app read — is never let go of: it stays on its lane where
   it was, drawn as an outline with its sound's name and "not found", plays nothing, and is written back with the song
   exactly as it was (project.js keeps it; native.js does not send it). On opening, the app says how many sounds were not
   found. File › Find Missing Sounds… asks for the folder they are in: each found there is copied into the project's own
   sounds (so the project is whole again), and its regions play again.
   Read after project.js and native.js. */
const missingRegs = () => S.tracks.flatMap(t => [t].concat(t.alts || []).flatMap(L => L.regs.filter(r => r.missing && !r.wait)))
const missingNames = () => [...new Set(missingRegs().map(r => r.file))]
function missingTell () {
  const n = missingNames().length
  if (n) say(`${n} sound${n > 1 ? 's' : ''} of this project not found: File › Find Missing Sounds…`)
}
async function findMissing () {
  if (!NAT) return
  const names = missingNames()
  if (!names.length) { say('no sound of this project is missing'); return }
  const pick = await NAT.call('audioFind', { project: projKey() })
  if (!pick || !pick.ok) return
  let found = 0
  for (const name of names) {
    const f = await NAT.call('audioLoad', { project: projKey(), file: name, also: [pick.dir], adopt: 1 })
    if (!f || !f.ok) continue
    found++
    for (const r of missingRegs()) if (r.file === name) { r.key = f.key; r.peaksAll = f.peaks; r.buf = null; delete r.missing; delete r.peak; dirtyReg(r) }
  }
  for (const t of S.tracks) t._told = null
  resync(); uiDirty('lanes', 'dock', 'info')
  say(!found ? `none of the ${names.length} was there` : found === names.length ? `found ${found === 1 ? 'it' : `all ${found}`}: back in the project` : `found ${found} of ${names.length}: ${names.length - found} still missing`)
}
/* a region not found, on its lane: an outline, the name of its sound, and that it was not found. One whose sound is still
   still being made ready (wait: project.js, soundsRead and bringPaths): the outline unbroken and fainter, and only its name */
function missingLook (r, x, w, ly, lh, cx, cw, sh, on) {
  const wait = !!r.wait
  let q = P(shapePath(cx + .5, ly + .5, cw - 1, lh - 1, sh), { fill: K0, fa: .35, stroke: INK, sa: on ? .9 : wait ? .3 : .45, dash: wait ? undefined : '3 3' })
  if (w > 44 && lh >= 14) q += T(Math.max(x, X0) + 6, ly + Math.min(lh / 2 + 3.5, 15), fit(wait ? r.name || r.file : `${r.file} — not found`, Math.min(w, X1 - Math.max(x, X0)) - 12, 9), { size: 9, a: wait ? .45 : .62 })
  return q
}
{ const load0 = loadProject; loadProject = async function () { const ok = await load0.apply(this, arguments); missingTell(); return ok } }
/* a region that came back from before its sound did (an undo, a copy, a paste) is given it with the rest: before the
   engine is told the song, and after an undo or a redo (project.js, soundsFill) */
{ const tell0 = natSession; natSession = function () { soundsFill(); return tell0.apply(this, arguments) } }      // (resync tells it through natSession: midi.js)
{ const restore0 = restoreEdit; restoreEdit = function () { const r = restore0.apply(this, arguments); soundsFill(); return r } }
