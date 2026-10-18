/* ── the way in: arming, hearing the input, the click, and a take (the app only) ── */
async function needInput () {
  if (!NAT) { say('the input is in the app'); return false }
  const r = await NAT.call('inputOn')
  if (r && r.ins) INPUTS = r.ins
  if (PROJ.test) return true                                                           // the app's own check: a tone stands in for the microphone
  if (r && r.ok) { if (r.mic === 1) say('the microphone is not allowed for this app'); return r.mic !== 1 }
  say(r && r.mic === 1 ? 'the microphone is not allowed for this app' : 'no input to open')
  return false
}
/* r and i on a row: with several rows chosen and this one among them, they all go the way this one goes */
async function toggleArm (i) {
  const t = S.tracks[i]
  if (!t || t.kind !== 'audio' || t.theirs || S.rec) return
  if (!t.arm && groupOf(i, 'record').some(x => x.kind === 'audio' && !x.theirs && !x.inst) && !(await needInput())) return      // (tracks of notes need no input opened: the keys are always listened to)
  const to = !t.arm
  for (const x of groupOf(i, 'record')) if (x.kind === 'audio' && !x.theirs) x.arm = to
  uiDirty('head', 'dock')
}
async function toggleMon (i) {
  const t = S.tracks[i]
  if (!t || t.kind !== 'audio' || t.inst) return
  if (!t.mon && !(await needInput())) return
  const to = !t.mon
  for (const x of groupOf(i, 'record')) if (x.kind === 'audio' && !x.inst) { x.mon = to; pushTrack(x) }
  uiDirty('head', 'dock')
}
function toggleClick () { S.click = !S.click; pushClick(); uiDirty('top') }

/* R: a take on every armed track (or the chosen one), from where the playhead stands, after one bar of click */
async function record () {
  if (S.rec) return stopRecord(true)
  if (!NAT) { say('recording is in the app'); return }
  if (record.busy) return
  record.busy = true
  try {
    let armed = S.tracks.filter(t => t.kind === 'audio' && t.arm)
    if (!armed.length) {
      const t = S.tracks[S.sel]
      if (!t || t.kind !== 'audio' || t.theirs) { say('arm a track first'); return }
      if (!t.inst && !(await needInput())) return
      t.arm = true; armed = [t]
    } else if (armed.some(t => !t.inst) && !(await needInput())) return
    if (S.playing) halt(false)
    const bar = S.pos >= SONG_END - 1e-6 ? 0 : S.pos, count = S.countIn ? 1 : 0
    const r = await NAT.call('recStart', { bar, countIn: count, project: projKey(), tracks: armed.map(t => Object.assign({ id: t.id, name: `${t.name} take` }, t.inst ? { midi: 1 } : {})) })
    if (!r || !r.ok) { say(r && r.error ? `could not record: ${r.error}` : 'could not record'); return }
    S.rec = { start: bar, ids: armed.map(t => t.id) }
    natRolling(bar - count)
    uiDirty('top', 'head', 'dock')
  } finally { record.busy = false }
}
/* stop a take: each file becomes a region where it was played, moved back by how late the input runs */
async function stopRecord (keep) {
  const rec = S.rec
  if (!rec) return
  S.rec = null
  const end = curPos(), list = await NAT.call('recStop', { keep: keep ? 1 : 0 })
  natStopped(end)
  $('g-rec').innerHTML = ''
  if (keep && Array.isArray(list) && list.length && placeTakes(list, rec.start, end).length) {}
  else if (keep) say('nothing came in')
  refreshPool()
  uiDirty('top', 'head', 'lanes', 'dock')
}
/* takes become regions where they were played (bars from zero), moved back by how late the input runs; what was under them
   gives way. Returns what was placed: [{ track: its name, id: the region }] */
function placeTakes (list, start, end) {
  const put = []
  edit(() => {
    for (const d of list) {
      const t = byId(d.track)
      if (!t || !d.ok || t.kind !== 'audio') continue
      if (d.midi) { const r = t.inst ? placeNoteTake(t, d, start, end) : null; if (r) put.push({ track: t.name, id: r.id }); continue }      // what was played on the keys: notes where they were played
      const lat = Math.min(d.lat || 0, d.sec / 2), len = (d.sec - lat) / SPB(), a = start
      if (!t.tone && !t.regs.length) { const tone = readTone(d); if (tone) t.tone = tone }
      carve(t, a, a + len)                                                              // a take lands on top: what was under it gives way
      const r = mkReg({ a: a + 1, b: a + 1 + len, off: lat / SPB(), key: d.key, file: d.file, peaksAll: d.peaks, loop: false, rate: 1, sec: d.sec, srcBars: d.sec / SPB(), name: String(d.name).toLowerCase() })
      t.regs.push(r); put.push({ track: t.name, id: r.id })
    }
    S.selR = put.map(x => x.id); S.focus = 'lanes'
    return put.length > 0
  })
  return put
}
/* while a take runs: what is being written, growing behind the playhead */
function drawRec (p) {
  const rec = S.rec, vis = rows()
  let s = ''
  if (p > SONG_END - 2) { SONG_END += 16; SCENES = mkScenes(SCENES.map(x => [x.name, x.a])); pushTransport(); uiDirty('lanes', 'ruler', 'scenes') }      // the song grows under a long take
  for (const id of rec.ids) {
    const i = S.tracks.findIndex(t => t.id === id), k = vis.indexOf(i)
    if (k < 0 || p <= rec.start) continue
    const y = rowY(i), rh = rowH(i), xa = bx(rec.start + 1), xb = bx(p + 1)
    s += R(xa + .5, y + 1.5, Math.max(1, xb - xa - 1), rh - 3, { fill: REC, fa: .3 }) + R(xa + 1, y + 2, Math.max(1, xb - xa - 2), rh - 4, { stroke: REC, sa: .9 })
  }
  $('g-rec').innerHTML = s
}
