/* ── coming in and going out ──
   Coming in: the page draws itself with the song it was written with before the app has said what is to open, and the
   start page (or the project that was asked for) came up over it a second later. Nothing of the room is shown until that
   is settled.
   Going out (command q, or the window closed): if the song is not as it was when it was last saved by hand — or opened,
   or made — the app asks first: save, don't save, cancel. The app also writes the song quietly every few seconds, so that
   nothing is lost when something goes wrong; "don't save" therefore puts the file back as it was at that last save (what
   was written quietly since is kept among the project's earlier copies, File > revert). Nothing changed: it saves as
   before and goes without asking.
   (Read after the room's own hands are made, before they are put to work: see the end.) */
const LEAVE = { kept: null, key: null, at: 0, how: '', sent: [] }                        // (sent: what would have been said to the app, where there is none — a browser)
const leaveCall = (op, d) => NAT ? NAT.call(op, d) : (LEAVE.sent.push(op), Promise.resolve({ ok: true }))
/* the song as it stands is what "saved" means from here on */
function keepNow (how) { LEAVE.kept = serialize(); LEAVE.key = projKey(); LEAVE.at = Date.now(); LEAVE.how = how }
/* what of a project is the song, and not where one happens to stand in it (which track is chosen, how near the view is, the cycle, the grid) */
function leaveCore (json) {
  try {
    const o = JSON.parse(json)
    for (const k of ['sel', 'view', 'cycle', 'snap', 'mode', 'nudge', 'grid', 'click']) delete o[k]
    for (const t of o.tracks || []) { delete t.open; delete t.ap; delete t.h }
    return JSON.stringify(o)
  } catch (e) { return json }
}
const leaveChanged = () => LEAVE.kept != null && LEAVE.key === projKey() && leaveCore(serialize()) !== leaveCore(LEAVE.kept)
/* the app says it is about to close */
function quitAsked () {
  if (S.leave) { leaveCall('quitWait'); return }                                         // asked again while the question is up: it stays up
  if (!NAT || PROJ.test || START.on || S.rec || !leaveChanged()) { saveNow(true).then(() => leaveCall('quit'), () => leaveCall('quit')); return }
  leaveAsk()
}
/* another project opened, or a new one made: the one that is open is closed — asked first in the same way when it is not
   as it was last saved (his ask, 2026-10-18). Answered with 'save', 'dont' or 'cancel' ('same': nothing to ask); what the
   answer means is the asker's to do, at once, with the opening card up (project.js) */
function leaveFirst () {
  if (!NAT || PROJ.test || START.on || S.rec || !leaveChanged()) return Promise.resolve('same')
  if (S.leave) return Promise.resolve('cancel')
  return new Promise(res => leaveAsk(res))
}
/* "don't save": the file as it was when it was last saved (what was written quietly since stays among its earlier copies) */
async function leavePutBack () {
  if (LEAVE.kept == null) return true
  const r = await leaveCall('projSave', { name: projKey(), json: LEAVE.kept, backup: 1 })
  if (r && r.ok) { PROJ.last = LEAVE.kept; PROJ.saved = true }
  return !!(r && r.ok)
}
function leaveAsk (then) {
  if (!then) leaveCall('quitWait')                                                       // the app waits for the answer instead of closing by itself
  if (S.playing) halt(false)
  PROJ.hold++                                                                            // nothing is written quietly while the question stands
  const d = new Date(LEAVE.at), at = `${d.getHours()}:${pad2(d.getMinutes())}`
  S.leave = { name: PROJ.name, since: LEAVE.how === 'saved' ? `last saved ${at}` : LEAVE.how === 'made' ? 'not saved since it was made' : `not saved since it was opened ${at}`, then }
  S.menu = null; uiDirty('leave', 'menu')
}
/* the answer: 'save', 'dont', 'cancel'. (stay: the app is not closed afterwards — the check asks for that) */
async function leaveAnswer (k, stay) {
  if (!S.leave || S.leave.busy) return
  if (S.leave.then) { const then = S.leave.then; S.leave = null; PROJ.hold--; uiDirty('leave'); flush(); then(k); return }      // (another project is opening: the answer is its to carry out)
  if (k === 'cancel') { S.leave = null; PROJ.hold--; uiDirty('leave'); return }
  S.leave.busy = k; uiDirty('leave')
  let ok = true
  if (k === 'save') ok = !NAT || await saveNow(true, true)
  else { const r = await leaveCall('projSave', { name: projKey(), json: LEAVE.kept, backup: 1 }); ok = !!(r && r.ok); if (ok) { PROJ.last = LEAVE.kept; PROJ.saved = true } }
  if (!ok) { S.leave.busy = ''; S.leave.since = 'could not be written'; uiDirty('leave'); return }      // (the disk said no: the question stays, the app stays)
  if (stay) { S.leave = null; PROJ.hold--; uiDirty('leave'); return }
  leaveCall('quit')
}
/* The question, in the middle of the window: the song itself seen from far away — every track a line of its own colour,
   as long as its regions — over its name and when it was last saved; then the three answers, each with its key, the
   one return gives filled. (An empty song has nothing to show: its name stands alone.)  Draft: design/save question
   draft 1, a. */
function pLeave () {
  const q = S.leave
  if (!q) return ''
  const rows = S.tracks.filter(t => t.kind !== 'bus' && (t.regs || []).length), w = 460, pad = 24, mh = rows.length ? 72 : 0, h = 154 + mh
  const x = Math.max(8, Math.round((W - w) / 2)), y = Math.max(8, Math.round((H - h) / 2)), L = x + pad, Rr = x + w - pad
  let s = hit(0, 0, W, H, 'leave', ' data-k="none"', 'default') + R(0, 0, W, H, { fill: K0, fa: .62 }) + R(x, y, w, h, { rx: 5, fill: K2 }) + R(x + .5, y + .5, w - 1, h - 1, { rx: 5, stroke: INK, sa: .28 })
  s += T(L, y + 34, 'save before closing?', { size: 12.5, w: 500, a: .94 })
  let cy = y + 52
  if (mh) {
    const mw = w - pad * 2, rh = Math.min(5, (mh - 14) / rows.length), top = cy + (mh - rows.length * rh) / 2
    s += R(L, cy, mw, mh, { rx: 2, fill: K0 }) + R(L + .5, cy + .5, mw - 1, mh - 1, { rx: 2, stroke: INK, sa: .12 })
    rows.forEach((t, i) => { for (const r of t.regs) { const a = clamp((r.a - 1) / SONG_END, 0, 1), b = clamp((r.b - 1) / SONG_END, 0, 1); if (b > a) s += R(L + 8 + a * (mw - 16), top + i * rh, Math.max(1, (b - a) * (mw - 16) - .7), Math.max(1, rh - .8), { fill: t.c || INK }) } })
    cy += mh + 22
  } else cy += 10
  s += T(L, cy, fit(asGiven(q.name), 250, 11.5, 500), { size: 11.5, w: 500 }) + T(Rr, cy, q.since, { size: 9.5, a: .46, anchor: 'end' })
  const fy = y + h - 24 - 22, o = { size: 10, pad: 11, frame: .26 }
  s += hline(x + 1, x + w - 1, fy - 18, .1)
  s += cells(L, fy, 22, [{ t: 'don’t save', k: 'd', a: 'leave', more: ' data-k="dont"', on: q.busy === 'dont' }], o)[0]
  const right = [{ t: 'cancel', k: 'esc', a: 'leave', more: ' data-k="cancel"' }, { t: 'save', k: '↩', a: 'leave', more: ' data-k="save"', on: true }]
  return s + cells(Rr - cells(0, 0, 22, right, o)[1], fy, 22, right, o)[0]
}

/* ── joined to the room ── */
{
  S.leave = null
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.id = 'g-leave'
  document.getElementById('svg').appendChild(g)                                          // (over everything else)
  PARTS.leave = pLeave
  const down0 = onDown
  onDown = function (e) {
    const el = S.leave && e.target.closest ? e.target.closest('[data-a="leave"]') : null
    if (S.leave) { e.preventDefault(); if (el && el.dataset.k !== 'none') leaveAnswer(el.dataset.k); return }
    down0(e)
  }
  /* while the question stands the keys are its own: return saves, escape stays, d does not save */
  addEventListener('keydown', e => {
    if (!S.leave) return
    e.preventDefault(); e.stopImmediatePropagation()
    if (e.repeat) return
    if (e.key === 'Enter') leaveAnswer('save'); else if (e.key === 'Escape') leaveAnswer('cancel'); else if (e.code === 'KeyD' && !e.shiftKey && !e.altKey && !e.ctrlKey) leaveAnswer('dont')
  }, true)
  addEventListener('keyup', e => { if (S.leave) e.stopImmediatePropagation() }, true)
  /* what "saved" is: a project opened or made, and every save that was asked for by name (the quiet one every few seconds is not one) */
  const load0 = loadProject, new0 = newProject, close0 = closeStart, save0 = saveNow, boot0 = projectBoot
  loadProject = async function (key, json) { const ok = await load0(key, json); if (ok) keepNow('opened'); return ok }
  newProject = async function () { const r = await new0(); keepNow('made'); return r }
  closeStart = function () { const was = START.on; close0(); if (was) keepNow(LEAVE.key === projKey() && Date.now() - LEAVE.at < 5000 ? LEAVE.how : 'made') }      // (the start page gone: a project was opened — noted a moment ago — or made)
  saveNow = async function (full, evenHeld) { const ok = await save0(full, evenHeld); if (ok && full && !S.leave) keepNow('saved'); return ok }
  /* coming in: the room is not shown before the app has said what opens */
  if (NAT) {
    const bd = document.getElementById('board')
    bd.style.visibility = 'hidden'
    projectBoot = async function (hello) { try { return await boot0(hello) } finally { bd.style.visibility = '' } }
  }
}
