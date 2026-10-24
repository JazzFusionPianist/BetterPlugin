/* ── a track switched off, and an instrument that did not open brought back ──
   His ask (2026-10-20): a track can be switched off whole, for the processor's sake — muted or bypassed, its plug-ins
   still run. Switched off (the track's other button: disable track; or Track > Disable Track) nothing of it is worked:
   no region is read, no instrument or plug-in is played, its patch is not run, and it is silent (Engine: Track::dead).
   It is drawn faded, in its row and its strip; it can still be chosen and edited. A stack switched off switches off what
   is in it. It is kept with the project.
   And an instrument from outside that did not open (another Mac, a plug-in that would not start) keeps its place and its
   settings: a press on its frame tries again, as a plug-in's does. Read after the room's own scripts. */
const TRACK_OFF_A = .34, TRACK_OFF_LANE_A = .62                                  // (its lane less: at .34 its regions could not be seen — his ask, 2026-10-25)
const trackOffAll = list => { const out = new Set(); const add = t => { if (!t || out.has(t)) return; out.add(t); if (t.kind === 'stack') for (const c of S.tracks) if (c.parent === t.id) add(c) }; for (const t of list) add(t); return [...out] }
function trackOffToggle (some) {                                                         // (tracks, or their places)
  const list = trackOffAll((some || []).map(x => typeof x === 'number' ? S.tracks[x] : x).filter(Boolean))
  if (!list.length) return
  const off = !list.every(t => t.disabled)
  for (const t of list) { if (off) t.disabled = true; else delete t.disabled; pushTrack(t) }
  say(off ? `${list.length === 1 ? list[0].name : list.length + ' tracks'} switched off` : `${list.length === 1 ? list[0].name : list.length + ' tracks'} on again`)
  uiDirty('head', 'lanes', 'dock', 'insp')
  if (typeof menusTick === 'function') menusTick()
}
/* an instrument from outside that is left out: opened again, with what it was set to */
async function instBringBack (t) {
  const I = t && t.inst
  if (!I || I.kind !== 'plug' || I.uid || I.busy || !NAT) return false
  I.busy = true; uiDirty('dock', 'head')
  const r = await NAT.call('insert', { track: t.id, id: I.id, state: I.state || '', show: 1, inst: 1 })
  I.busy = false
  if (r && r.ok) {
    I.uid = r.uid; I.name = r.name; I.fmt = r.fmt; delete I.out; t._instTold = instSig(t)
    if (DISTRUST.delete(I.id)) NAT.call('distrust', { list: [...DISTRUST].map(id => ({ id })) })
    say(`${String(r.name).toLowerCase()} is back`)
  } else say(`${String(I.name || 'the instrument').toLowerCase()} would not open on this mac`)
  uiDirty('dock', 'head')
  return !!(r && r.ok)
}
{
  /* drawn faded: its head, its lane, its strip (the strip and the head as each look draws them) */
  const fade = (s, a = TRACK_OFF_A) => `<g opacity="${a}">${s}</g>`
  const head0 = headRow
  headRow = function (i) { const s = head0(i), t = S.tracks[i]; return t && t.disabled ? fade(s) : s }
  const lane0 = laneRow
  laneRow = function (i, sel, xEnd) { const s = lane0(i, sel, xEnd), t = S.tracks[i]; return t && t.disabled ? fade(s, TRACK_OFF_LANE_A) : s }
  const strip0 = strip
  strip = function (x, y, w, h, t, i, o = {}) { const s = strip0(x, y, w, h, t, i, o); return t && t.disabled && !o.master ? fade(s) : s }
  /* the track's other button: the line to switch it off, or on again, above delete */
  const menu0 = openTrackMenu
  openTrackMenu = function (i, x, y) {
    const r = menu0(i, x, y), m = S.menu, t = S.tracks[i]
    if (!m || !t) return r
    const many = groupOf(i), all = trackOffAll(many).every(x => x.disabled)
    const k = m.items.findIndex(it => it.v === 'del'), item = { t: all ? 'enable track' : 'disable track', v: 'trackoff', sep: true }
    if (k >= 0) { m.items.splice(k, 0, item); m.items[k + 1].sep = false } else m.items.push(item)
    const pick0 = m.pick
    m.pick = it => it.v === 'trackoff' ? trackOffToggle(many) : pick0(it)
    uiDirty('menu')
    return r
  }
  /* a press on an instrument that is left out: tried again (it used to open the list, and a new one had to be put in) */
  const down0 = onDown
  onDown = function (e) {
    const el = e.target.closest ? e.target.closest('[data-a]') : null
    if (el && el.dataset.a === 'inst' && !e.altKey) { const t = S.tracks[S.sel]; if (t && t.inst && t.inst.kind === 'plug' && t.inst.out && !t.inst.uid) { e.preventDefault(); instBringBack(t); return } }
    return down0(e)
  }
}
