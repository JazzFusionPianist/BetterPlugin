/* ── a track frozen (his ask, 2026-10-21: as fast as it can go, with nothing less at hand) ──
   A track frozen is printed once, before its fader, through its patch and its plug-ins (an instrument and all), from the
   start of the song to where its sound ends and two seconds on; from then on it plays that print, and its instrument, its
   plug-ins and its patch rest (Engine: Track::frozen). Its fader, pan, sends and their lines go on as they were. Anything
   the print was made from changed — a region, a note, a plug-in put on, taken off, stepped past or opened, the patch, a
   line of a print or a plug-in, the tempo — and it thaws by itself, and the print is let go. Track > Freeze Track; again,
   or Unfreeze, to thaw. A song keeps its frozen tracks: the print is a file in its own folder, read again when it opens.
   Read after native.js (sendSession asks frozenCheck before it tells the engine). */
const FROZEN_LIVE = new Set(['vol', 'pan', 'send0', 'send1', 'send2'])                   // lines after the fader: they go on live
const FROZEN_LOOKS = new Set(['id', 'name', 'tag', 'col', 'shape', 'grp', 'mute'])      // (and what is nothing — 0, false, none — is left out: a song opened again fills those in)
/* what the print was made from, written down as a song keeps it (so that it reads the same once the song is opened
   again): when it is not the same any more, the print no longer is what the track is */
function freezeSig (t) {
  const regs = t.regs.filter(r => !r.mute).map(r => { const q = {}; for (const k of KEEP_R) if (!FROZEN_LOOKS.has(k) && r[k]) q[k] = r[k]; if (r.loop) q.buf = r.buf; return q })
  const autos = Object.keys(t.autos || {}).filter(k => !FROZEN_LIVE.has(k) && (t.autos[k] || []).length).sort().map(k => [k, t.autos[k]])
  const inst = t.inst ? (typeof instCopy === 'function' ? instCopy(t.inst) : t.inst) : null
  return JSON.stringify([S.tempo, S.meter, regs, (t.inserts || []).map(i => [i.id, !!i.off, i.n || 0]), t.patch, inst && Object.assign({}, inst, { uid: undefined, state: undefined }), t.macros || null, typeof wallSaved === 'function' && t.wall ? wallSaved(t) : null, autos])
}
/* the print, as one region of the track's for the engine (native.js sends it in place of the track's own) */
const frozenReg = t => t.frozen && t.frozen.reg && t.frozen.reg.key ? t.frozen.reg : null
function thaw (t, why) {
  if (!t.frozen) return
  const key = t.frozen.reg && t.frozen.reg.key
  delete t.frozen
  if (NAT && key) NAT.call('dropBuffer', { key })
  if (why) say(`${t.name} ${why}`)
  uiDirty('head', 'lanes', 'dock')
}
/* before the engine is told: a frozen track whose makings have changed thaws */
function frozenCheck () { if (typeof OPENING === 'object' && OPENING.on) return; for (const t of S.tracks) if (t.frozen && t.frozen.sig !== freezeSig(t)) thaw(t, 'thawed') }      // (not while a song is being opened: its plug-ins come back one by one)
async function freezeTrack (i, want) {                                                 // want: true freeze, false thaw, else the other way round
  const t = S.tracks[i]
  if (!t) return
  if (t.frozen && want !== true) { thaw(t, 'thawed'); await natSession(); return }
  if (t.frozen || want === false) return
  if (!NAT) { say('freezing is in the app'); return }
  if (t.kind !== 'audio' || t.theirs || t.disabled) { say('only a track of sound or notes freezes'); return }
  const live = t.regs.filter(r => !r.mute && !r.missing)
  if (!live.length) { say('nothing on it to freeze'); return }
  const a1 = Math.max(...live.map(r => r.b - 1))
  if (S.playing) halt(false)
  await natSession()
  const sig = freezeSig(t)
  printBegin('freezing', t.name, 1)
  const res = await NAT.call('bounce', { kind: 'place', project: projKey(), a0: 0, a1, tail: 2, tracks: [{ id: t.id, name: `${t.name} frozen` }] })
  printEnd()
  const d = res && res.ok && Array.isArray(res.placed) ? res.placed.find(x => x && x.ok) : null
  if (!d) { resync(); say(res && res.error === 'stopped' ? 'stopped: nothing was kept' : 'could not freeze'); return }
  if (freezeSig(t) !== sig) { NAT.call('dropBuffer', { key: d.key }); say('it changed while it was being frozen'); return }
  t.frozen = { reg: { a: 1, b: 1 + d.sec / SPB(), key: d.key, file: d.file, peaksAll: d.peaks, sec: d.sec, rate: 1, off: 0, gain: 0, fi: 0, fo: 0 }, sig }
  await natSession()
  uiDirty('head', 'lanes', 'dock')
  say(`${t.name} frozen`)
}
/* a plug-in of a frozen track opened: it thaws first (what is turned in its window would not be heard) */
if (NAT) {
  const call0 = NAT.call
  NAT.call = (op, d) => { if (op === 'editor' && d) { const t = byId(d.track); if (t && t.frozen) { thaw(t, 'thawed'); natSession() } } return call0(op, d) }
}
/* the track's other button: freeze it, or thaw it, beside switching it off */
{
  const menu0 = openTrackMenu
  openTrackMenu = function (i, x, y) {
    const r = menu0(i, x, y), m = S.menu, t = S.tracks[i]
    if (!m || !t || !NAT || t.kind !== 'audio' || t.theirs) return r
    const k = m.items.findIndex(it => it.v === 'trackoff'), item = { t: t.frozen ? 'unfreeze track' : 'freeze track', v: 'freeze' }
    if (k >= 0) m.items.splice(k + 1, 0, item); else m.items.push(item)
    const pick0 = m.pick
    m.pick = it => it.v === 'freeze' ? freezeTrack(i) : pick0(it)
    uiDirty('menu')
    return r
  }
}
