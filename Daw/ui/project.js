/* ── names, files coming in, and the project on disk ── */
const PROJ = { name: 'night bus ep', at: '', demo: true, last: '', saved: false, savedAt: '', busy: false, hold: 0, list: null, test: false, ticks: 0 }
const isDemo = () => PROJ.demo                     // the song the app opens with the first time: its people, its scenes, its length
/* what the app knows a project by: its bare name while it lies where the app keeps projects (music, slur studio, projects), and
   the whole path of its .sls anywhere else on the disk (save as puts it wherever the mac's panel is pointed). It is called
   what its .sls is called. */
const projKey = () => PROJ.at || PROJ.name
const projNameOf = key => key[0] === '/' ? key.replace(/\/+$/, '').split('/').pop().replace(/\.(sls|slur)$/i, '') : key
function setProj (key) { key = String(key); PROJ.at = key[0] === '/' ? key : ''; PROJ.name = projNameOf(key) }
/* the last place the app was left, and the projects kept somewhere else it has had open (the newest first): so it comes back
   to one, and they stand in the list of projects to open */
async function rememberProj () {
  if (!NAT || PROJ.test) return
  await NAT.call('prefSet', { key: 'lastProject', value: projKey() })
  if (!PROJ.at) return
  const prefs = await NAT.call('prefGet'), was = prefs && Array.isArray(prefs.elsewhere) ? prefs.elsewhere : []
  if (was[0] !== PROJ.at) await NAT.call('prefSet', { key: 'elsewhere', value: [PROJ.at].concat(was.filter(k => k !== PROJ.at)).slice(0, 24) })
}

/* a place in the song as it is typed: a bar, or bar beat sixteenth (and ticks after that, 240 to a sixteenth); or a time —
   12.5s, 250ms, 1:02.25. In bars from zero; null when it cannot be read */
function parsePos (v) {
  v = String(v).trim().toLowerCase()
  let m = v.match(/^(\d+):(\d{1,2}(?:\.\d+)?)$/)
  if (m) return (+m[1] * 60 + +m[2]) / SPB()
  m = v.match(/^(\d+(?:\.\d+)?)\s*(s|sec|ms)$/)
  if (m) return +m[1] * (m[2] === 'ms' ? .001 : 1) / SPB()
  m = v.match(/\d+/g)
  if (!m || +m[0] < 1) return null
  const beats = BEATS(), per = BEAT_16()
  return (+m[0] - 1) + (m[1] ? (clamp(+m[1], 1, beats) - 1) / beats : 0) + (m[2] ? (clamp(+m[2], 1, per) - 1) / (beats * per) : 0) + (m[3] ? clamp(+m[3], 0, 239) / (240 * beats * per) : 0)
}
/* a name (or the tempo, or the key) is changed where it stands: an input laid over the words. A project's name has no
   place of its own on the board (the window's title says it), so it is asked for in a small box under the bar. */
function startRename (what, i, at) {
  const el = $('rename'), t = what === 'track' ? S.tracks[i] : null
  let rh = what === 'track' ? rowH(i) : S.rh
  const put = (x, y, w, h, font, v, centre) => { el.style.cssText = `left:${n(x)}px;top:${n(y)}px;width:${n(w)}px;height:${h}px;font:${font} var(--f);text-align:${centre ? 'center' : 'left'}`; el.value = v }
  S.ask = null
  if (what === 'track') {
    if (!t) return
    showRow(i); flush()
    const y = rowY(i), x0 = 42 + depthOf(t) * (HEAD_IN - 42), cx = 214 - cellsOf(t).length * 15
    put(x0 - 5, y + rh / 2 - 9, cx - x0 - 1, 18, '500 10.5px', t.name)
  } else if (what === 'scene') {
    const sc = SCENES[i]
    if (!sc) return
    put(clamp(bx(sc.a), X0, Math.max(X0, X1 - 112)) + 2, MK_Y + 2, 110, 18, '500 9px', sc.name)
  } else if (what === 'tempo') put(DISP_X + 144, 11, 62, 22, '400 11.5px', String(+S.tempo.toFixed(2)), true)
  else if (what === 'key') put(DISP_X + 250, 11, 58, 22, '400 11.5px', S.key, true)
  else if (what === 'pos') put(DISP_X, 11, 78, 22, '500 12.5px', readout(curPos()), true)           // where the playhead is, typed: a bar, or bar beat sixteenth
  else if (what === 'rbpm') { const r = selRegs().map(x => x[0]).find(q => !q.loop && q.bpm > 0); if (!r || !at) return; put(at.x + at.w - 46, at.y + at.h / 2 - 9, 46, 18, '400 9.5px', String(+r.bpm.toFixed(2)), true) }
  else if (what === 'spot') {                                                                        // where what is chosen should begin, typed where it begins now
    const rs = selRegs()
    if (!rs.length) return
    const [r, tr] = rs.reduce((p, q) => q[0].a < p[0].a ? q : p), ti = S.tracks.indexOf(tr)
    showRow(ti); flush(); rh = rowH(ti)
    put(clamp(bx(r.a), X0, Math.max(X0, X1 - 80)) + 1, rowY(ti) + Math.max(0, (rh - 18) / 2), 78, Math.min(18, rh), '500 10px', readout(r.a - 1))
  }
  else if (what === 'vol') { const tr = S.tracks[i], v = i < 0 ? S.master : tr ? tr.vol : null; if (v == null || !at) return; put(at.x + at.w / 2 - 22, at.y + at.h / 2 - 9, 44, 18, '400 9.5px', v <= -47.5 ? '-inf' : String(v), true) }      // a level, typed where it is read
  else if (what === 'region') {                                                                      // a region's own name, where the region begins
    const [r, tr] = selRegs()[0] || []
    if (!r) return
    const ti = S.tracks.indexOf(tr)
    showRow(ti); flush(); rh = rowH(ti)
    put(clamp(bx(r.a), X0, Math.max(X0, X1 - 134)) + 1, rowY(ti) + Math.max(0, (rh - 18) / 2), 132, Math.min(18, rh), '500 9px', String(r.tag || r.name || tr.name))
  } else {
    const w = 280, x = Math.round((RX - w) / 2), y = TY + 10, label = 'name', lw = Math.ceil(tw(label, 9.5)) + 24
    S.ask = { x, y, w, h: 34, label }
    put(x + lw, y + 6, w - lw - 8, 22, '500 11px', PROJ.name)
  }
  uiDirty('ask'); flush()
  const first = el.value.trim().toLowerCase().slice(0, 40)                              // what the box said when it opened
  el.hidden = false; el.focus(); el.select()
  /* opened by a press, the box would lose the keys at once (the press itself takes them away): it takes them back, and
     only after that does leaving it mean "done" */
  let live = false
  setTimeout(() => { live = true; if (!el.hidden && document.activeElement !== el) { el.focus(); el.select() } }, 0)
  const done = async keep => {
    el.onblur = el.onkeydown = null; el.hidden = true
    if (S.ask) { S.ask = null; uiDirty('ask') }
    const v = el.value.trim().toLowerCase().slice(0, 40)
    if (!keep || (!v && what !== 'key')) return
    if (what === 'track') { if (v !== t.name) edit(() => { t.name = v }) }
    else if (what === 'scene') { if (SCENES[i] && v !== SCENES[i].name) edit(() => { SCENES = mkScenes(SCENES.map((s, k) => [k === i ? v : s.name, s.a])) }) }
    else if (what === 'tempo') { const bpm = clamp(Math.round(parseFloat(v) * 100) / 100, 40, 240); if (isFinite(bpm) && bpm !== S.tempo) setTempo(bpm) }
    else if (what === 'key') S.key = v.slice(0, 8)
    else if (what === 'vol') {
      const x = /inf|∞/.test(v) ? -48 : parseFloat(v.replace(/[−–]/g, '-')), db = isFinite(x) ? (x <= -47.5 ? -48 : clamp(Math.round(x * 10) / 10, -48, 6)) : null
      if (db != null && i < 0) { S.master = db; pushMaster() } else if (db != null && S.tracks[i]) volSet(S.tracks[i], db)
    }
    else if (what === 'pos') { const to = parsePos(v); if (to != null) goTo(to) }
    else if (what === 'spot') { const to = parsePos(v); if (to != null && v !== first) act.spot(to) }      // (the box shows its place rounded to a sixteenth: left as it was, nothing moves)
    else if (what === 'rbpm') { const bpm = Math.round(parseFloat(v) * 100) / 100, rs = selRegs().map(x => x[0]).filter(q => !q.loop); if (isFinite(bpm) && bpm >= 30 && bpm <= 300 && rs.length) edit(() => { for (const r of rs) r.bpm = bpm }) }
    else if (what === 'region') { const rs = selRegs().map(x => x[0]); if (rs.length) edit(() => { for (const r of rs) { r.tag = v; dirtyReg(r) } }) }
    else if (v !== PROJ.name) await renameProject(v)
    uiDirty('head', 'top', 'dock', 'hand', 'scenes', 'lanes', 'ruler')
  }
  el.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') done(true); else if (e.key === 'Escape') done(false) }
  el.onblur = () => { if (live) done(true) }
}

/* ── the project's own sounds (what was brought in, recorded, bounced) ── */
async function refreshPool () {
  if (!NAT) return
  const list = await NAT.call('audioList', { project: projKey() })
  PROJ.pool = Array.isArray(list) ? list.sort((a, b) => b.modified - a.modified) : []
}
async function placeFile (i) {
  const f = (PROJ.pool || [])[i]
  if (!f || placeFile.busy) return
  placeFile.busy = true
  try {
    const d = await NAT.call('audioLoad', { project: projKey(), file: f.file }), cur = S.tracks[S.sel]
    if (d && d.ok) placeDecoded([d], cur && cur.kind === 'audio' && !cur.theirs && !cur.inst ? S.sel : null, Math.max(0, snapPos(curPos(), null)) + 1)
  } finally { placeFile.busy = false }
}

/* ── files in ── */
/* what comes in lands at one bar: the first file on the lane it was let go over (clearing what was under it), each further file on a track of its own right below */
function placeDecoded (list, lane, bar) {
  const before = editState(), good = list.filter(d => d && d.ok !== false && d.sec > 0), own = t => t && t.kind === 'audio' && !t.theirs && !t.inst
  let last = lane != null && own(S.tracks[lane]) ? S.tracks[lane] : null, any = false
  good.forEach((d, k) => {
    const base = String(d.name || 'audio'), nums = [...base.matchAll(/(?<![0-9a-z])(\d{2,3})(\s?bpm)?(?![0-9])/gi)].map(x => ({ v: +x[1], tag: !!x[2] })).filter(x => x.v >= 60 && x.v <= 200), bpm = (nums.find(x => x.tag) || nums[0] || { v: 0 }).v
    const rate = bpm >= 60 && bpm <= 200 && Math.abs(S.tempo / bpm - 1) <= .08 ? S.tempo / bpm : 1, sec = d.sec / rate, len = sec / SPB()
    let t = k === 0 ? last : null
    if (!t && S.tracks.length >= MAX_TRACKS) t = last || S.tracks.filter(own).pop()
    if (!t) {
      t = mkTrack(base.slice(0, 24).toLowerCase(), null, null, null, null, isDemo() ? -6 : 0, [], mkPatch(0, 0, 0, [0, 0, 0]))
      t.patch0 = copy(t.patch)
      if (last) { t.parent = last.parent; S.tracks.splice(S.tracks.indexOf(last) + 1, 0, t) } else S.tracks.push(t)
      normalizeOrder()
    }
    if (!t) return
    if (!t.tone && !t.regs.length) { const tone = readTone(d); if (tone) t.tone = tone }       // how its first sound moves: read when its name says nothing
    carve(t, bar - 1, bar - 1 + len)
    const nr = mkReg({ a: bar, b: bar + len, buf: d.buf || null, key: d.key, file: d.file, peaksAll: d.peaks, loop: false, rate, sec, srcBars: len, name: base.toLowerCase() })
    if (bpm) nr.bpm = bpm                                                                // its name says how fast it goes; else the app listens (and says what it heard)
    else if (NAT && d.sec > 2) ensureTempo(nr).then(heard => { if (heard) say(`${base.toLowerCase().slice(0, 28)} goes at ${+heard.toFixed(1)}`) })
    t.regs.push(nr)
    last = t; any = true
  })
  if (any) { birthAll(); commit(before); refreshPool(); if (S.flex) for (const t of S.tracks) for (const r of t.regs) ensureTransients(r) }
  return any
}
async function dropFiles (files, lane, bar) {
  const list = [], onto = lane != null ? S.tracks[lane] : null
  for (const f of files) {
    if (/\.midi?$/i.test(f.name)) { try { placeMidi(new Uint8Array(await f.arrayBuffer()), f.name, Math.max(1, Math.floor(bar + 1e-6))) } catch (err) { say(`couldn’t read ${fit(f.name, 160, 9.5)}`) } continue }      // a file of notes: its tracks, from the bar it was let go on
    if (!/^audio\//.test(f.type) && !/\.(wav|aiff?|mp3|m4a|ogg|flac|caf)$/i.test(f.name)) continue
    if (onto && onto.inst && onto.inst.kind === 'sampler' && files.length === 1) {       // one sound let go on a sampler's track: the sampler plays from it
      try { const d = await decodeFile(f); if (d && d.file) { setInstSample(onto, 0, { file: d.file, name: f.name.replace(/\.[^.]+$/, '') }); refreshPool(); say(`the sampler plays ${fit(f.name.replace(/\.[^.]+$/, '').toLowerCase(), 160, 9.5)}`) } } catch (err) { say(`couldn’t open ${fit(f.name, 160, 9.5)}`) }
      return true
    }
    try { const d = await decodeFile(f); list.push(Object.assign({ name: f.name.replace(/\.[^.]+$/, '') }, d)) } catch (err) { say(`couldn’t open ${fit(f.name, 160, 9.5)}`) }
  }
  return placeDecoded(list, lane, bar)
}
async function importAudio () {
  const cur = S.tracks[S.sel], at = Math.max(0, snapPos(curPos(), null)) + 1, lane = cur && cur.kind === 'audio' && !cur.theirs && !cur.inst ? S.sel : null
  if (NAT) { const list = await NAT.call('import', { project: projKey() }); if (Array.isArray(list)) placeDecoded(list, lane, at); return }
  const inp = document.createElement('input')
  inp.type = 'file'; inp.accept = 'audio/*'; inp.multiple = true
  inp.onchange = () => dropFiles([...inp.files], lane, at)
  inp.click()
}

/* ── the project on disk (the app only) ── */
const KEEP_T = ['id', 'name', 'col', 'shape', 'tone', 'theirs', 'kind', 'vol', 'def', 'pan', 'mute', 'solo', 'inp', 'out', 'parent', 'open', 'h', 'sends', 'autos', 'ap', 'patch', 'midi', 'buf0', 'grp', 'alt', 'inst']
const KEEP_R = ['id', 'a', 'b', 'off', 'gain', 'mute', 'fi', 'fo', 'loop', 'rate', 'sec', 'srcBars', 'tag', 'name', 'file', 'tr', 'flex', 'rev', 'fx', 'col', 'shape', 'fic', 'foc', 'grp', 'bpm', 'xo', 'sm', 'px', 'py', 'notes', 'ctl', 'q', 'qs', 'sw', 'vel', 'rep', 'chords']
function serialize () {
  return JSON.stringify({
    v: 3, name: PROJ.name, demo: PROJ.demo, fresh: PROJ.fresh ? true : undefined, tempo: S.tempo, meter: S.meter, key: S.key, end: SONG_END, scenes: SCENES.map(s => [s.name, s.a]), master: S.master, click: S.click, countIn: S.countIn,
    cycle: S.cycle, sel: S.sel, view: { pxb: PXB, vx: VX, vy: VY, rh: S.rh, wz: S.wz || 1, panel: { on: S.panel.on, tab: S.panel.tab, h: S.panel.h }, slur: S.slur }, snap: S.snap, mode: S.mode, nudge: S.nudge, grid: S.grid, q: S.q,
    out: typeof wallOutSaved === 'function' ? wallOutSaved() : undefined,              // (wall.js: what stands on the stereo out's wall)
    tracks: S.tracks.map(t => {
      const o = {}
      for (const k of KEEP_T) if (t[k] !== undefined) o[k] = t[k]
      if (o.inst) o.inst = instCopy(o.inst)
      const kept = list => list.filter(r => r.loop || r.file || r.notes).map(r => { const q = {}; for (const k of KEEP_R) if (r[k] !== undefined && r[k] !== null) q[k] = r[k]; if (r.loop) q.buf = r.buf; return q })
      o.regs = kept(t.regs)
      if ((t.alts || []).length) o.alts = t.alts.map(a => ({ name: a.name, regs: kept(a.regs) }))
      if (t.wall && typeof wallSaved === 'function') o.wall = wallSaved(t)                 // (wall.js: how its patch is wired)
      o.inserts = (t.inserts || []).filter(i => i.id).map(i => Object.assign({ id: i.id, name: i.name, fmt: i.fmt, state: i.state || '' }, i.off ? { off: true } : {}, i.out ? { out: true } : {}, i.key ? { key: i.key } : {}, i.n ? { n: i.n } : {}, i.pn ? { pn: i.pn } : {}))
      return o
    }),
  })
}
/* full = ask every plug-in for its state too (slower; done now and then, on save, and on the way out).
   While a project is being opened or made (PROJ.hold) nothing is written, or half of one song would land in another's file. */
async function saveProject (full, evenHeld) {
  if (!NAT || PROJ.busy || S.rec || (PROJ.hold && !evenHeld)) return false
  PROJ.busy = true
  try {
    if (full) { const st = await NAT.call('pluginStates'); if (st) for (const t of S.tracks) { for (const i of t.inserts || []) if (st['u' + i.uid] != null) i.state = st['u' + i.uid]; if (t.inst && t.inst.kind === 'plug' && t.inst.uid && st['u' + t.inst.uid] != null) t.inst.state = st['u' + t.inst.uid] } if (st && typeof OUT !== 'undefined') for (const i of OUT.inserts) if (st['u' + i.uid] != null) i.state = st['u' + i.uid] }
    const json = serialize()
    if (json === PROJ.last && PROJ.saved) return true
    const r = await NAT.call('projSave', { name: projKey(), json })
    if (r && r.ok) { PROJ.last = json; PROJ.saved = true; const d = new Date(), at = `${d.getHours()}:${pad2(d.getMinutes())}`; if (at !== PROJ.savedAt) { PROJ.savedAt = at; uiDirty('cmd') } if (!PROJ.test) NAT.call('prefSet', { key: 'lastProject', value: projKey() }) }
    return !!(r && r.ok)
  } finally { PROJ.busy = false }
}
/* a save that was asked for by name waits its turn instead of giving up when the quiet one is in the middle of writing */
async function saveNow (full, evenHeld) { for (let k = 0; k < 100 && PROJ.busy; k++) await new Promise(r => setTimeout(r, 30)); return saveProject(full, evenHeld) }
/* leaving a project: every sound decoded for it is let go in the app (call once nothing plays it any more) */
function dropAllAudio () { for (const key of NAT.keys) NAT.call('dropBuffer', { key }); NAT.keys.clear(); WARPS.clear(); LIVEW.clear(); forgetTransients() }
function resetSession () {
  halt(false)
  S.selR = []; S.selP = []; S.marq = null; S.queued = null; S.menu = null; S.last = null; S.rec = null; UNDO.length = 0; REDO.length = 0
  S.selT = []; S.selA = null; S.selM = null; S.focus = 'lanes'; S.newT = null
  for (const t of S.tracks) t.inserts = []
  S.selX = null; CLIP = []; TIME_CLIP = null
}
/* every file a project's regions point at, decoded again (a project opening, or the device moving to another rate) */
async function loadFiles (project, tracks) {
  const files = new Map()
  for (const t of tracks) for (const L of [t].concat(t.alts || [])) for (const q of L.regs) if (!q.loop && q.file && !files.has(q.file)) files.set(q.file, await NAT.call('audioLoad', { project, file: q.file }))
  return files
}
/* key: the project, as projKey says it. json: the song as it was at another time (a copy put aside), opened in this project's place */
async function loadProject (key, json) {
  PROJ.hold++
  try { return await loadProjectNow(key, json) } finally { PROJ.hold-- }
}
/* Plug-ins the app has learnt not to open by itself (one was playing, or being opened, when the app last went down), and what
   was left out of the song being opened. A plug-in left out keeps its place in the patch and its settings: it is drawn
   there dimmed, and a press brings it back. One that will not open (it is not on this machine) is kept the same way. */
const DISTRUST = new Set()
const LOAD = { bare: false, left: [] }
async function loadProjectNow (key, json) {
  const r = json ? { ok: true, json, saved: Date.now() } : await NAT.call('projLoad', { name: key })
  if (!r || !r.ok) return false
  let d
  try { d = JSON.parse(r.json) } catch (e) { return false }
  if (!d || !Array.isArray(d.tracks) || !d.tracks.length) return false
  resetSession()
  await NAT.call('session', { tempo: S.tempo, end: SONG_END, tracks: [] })                           // everything out of the engine first, plug-ins too
  dropAllAudio()
  const files = await loadFiles(key, d.tracks)
  const meter = Array.isArray(d.meter) && MEASURES.some(m => m[0] === d.meter[0] && m[1] === d.meter[1]) ? d.meter.slice(0, 2) : [4, 4]
  if (d.tempo !== S.tempo || meter[0] !== S.meter[0] || meter[1] !== S.meter[1]) { S.tempo = d.tempo; S.meter = meter; LOOPS = songLoops(S.tempo); await natSendLoops() }
  PROJ.fresh = !!d.fresh; setProj(key); PROJ.demo = d.demo == null ? !(d.v >= 2) : !!d.demo                    // it is called what its folder is called: a copy made in the Finder must not write into the one it was copied from
  SONG_END = d.end || 42
  SCENES = mkScenes(Array.isArray(d.scenes) ? d.scenes : (isDemo() ? DEMO_SCENES : []))
  S.tracks = d.tracks.map(o => {
    const t = Object.assign({ n: null, kind: 'audio', pan: 0, inp: 0, out: 0, parent: null, open: true, sends: [], autos: {}, ap: 'vol', arm: false, mon: false }, o, { inserts: [] })
    if (!(t.h >= ROW_MIN && t.h <= ROW_MAX)) delete t.h                                    // (a row's own height, when it was pulled to one)
    delete t.c; delete t.own                                                             // a project from before colours were read from what a track holds
    if (d.demo && MOCK_PATCH[t.name] && JSON.stringify(t.patch) === JSON.stringify(MOCK_PATCH[t.name])) t.patch = NO_PATCH()          // the first song's mock-up patch, exactly as it was put there and never touched: taken off
    const back = list => list.map(q => { const f = q.file ? files.get(q.file) : null; return Object.assign({ off: 0, gain: 0, mute: false, fi: 0, fo: 0 }, q, f && f.ok ? { key: f.key, peaksAll: f.peaks, buf: null } : {}) }).filter(q => q.notes ? Array.isArray(q.notes) : q.loop ? LOOPS[q.buf] : q.key)
    t.regs = back(o.regs)
    t.alts = Array.isArray(o.alts) ? o.alts.map(a => ({ name: String(a.name), regs: back(a.regs || []) })) : []
    t.patch0 = copy(t.patch)
    return t
  })
  TID = Math.max(0, ...S.tracks.map(t => t.id)); RID = Math.max(0, ...S.tracks.flatMap(lanesOf).flatMap(t => t.regs.map(q => q.id)))
  PID = Math.max(0, ...S.tracks.flatMap(t => Object.values(t.autos).flatMap(p => p.map(q => q.id))))
  for (const t of S.tracks.flatMap(lanesOf)) for (const q of t.regs) if (q.notes) { for (const x of q.notes) if (x.id > NID) NID = x.id; for (const c of q.ctl || []) if (c.id > NID) NID = c.id }
  S.cycle = Object.assign({ on: false, a: 0, b: 4 }, d.cycle); S.sel = clamp(d.sel || 0, 0, Math.max(0, S.tracks.length - 1)); setMode(MODES.includes(d.mode) ? d.mode : d.snap === false ? 'slip' : 'smart'); S.nudge = NUDGES.includes(d.nudge) ? d.nudge : 'beat'; if (typeof GRIDS !== 'undefined') S.grid = GRIDS.includes(d.grid) ? d.grid : '1/4'; S.pos = 0
  S.master = d.master == null ? 0 : d.master; S.click = !!d.click; S.countIn = d.countIn !== false; S.q = d.q || 1 / 16; S.auto = false; S.flex = false; S.key = typeof d.key === 'string' ? d.key : ''; S.look = null
  /* the view comes back as it was left; in a project from before this room (rows were twice as tall, the dock was always there) only its zoom along the song does */
  const vw = d.view || {}, now = d.v >= 3
  if (now && vw.panel) { S.panel.on = !!vw.panel.on; S.panel.tab = vw.panel.tab === 'mixer' ? 'mixer' : 'patch'; S.panel.h = vw.panel.h || 316 }
  if (now && !PROJ.test) S.slur = !!vw.slur
  setView(true)
  PXB = clamp(vw.pxb || fitPXB(), fitPXB(), maxPXB()); VX = clamp(vw.vx || 0, 0, maxVX()); S.rh = now ? clamp(vw.rh || 25, 20, 120) : 25; S.wz = now ? clamp(vw.wz || 1, 1, 1024) : 1; VY = clamp(now ? vw.vy || 0 : 0, 0, maxVY())
  normalizeOrder(); repaint()
  resync(); pushTransport(); pushMaster(); pushClick(); applyAll()
  LOAD.left = []
  for (let i = 0; i < d.tracks.length; i++) for (const ins of d.tracks[i].inserts || []) {
    const t = byId(d.tracks[i].id)
    if (!t) continue
    const kept = { uid: 0, name: ins.name || 'plug-in', fmt: ins.fmt || '', id: ins.id, state: ins.state || '', off: !!ins.off, key: ins.key || 0, n: ins.n || 0, pn: ins.pn || null, out: true }
    if (ins.out || LOAD.bare || DISTRUST.has(ins.id)) { t.inserts.push(kept); if (!ins.out) LOAD.left.push(kept.name); continue }
    const rr = await NAT.call('insert', { track: t.id, id: ins.id, state: ins.state || '', show: 0 })
    if (rr && rr.ok) { const got = { uid: rr.uid, name: rr.name, fmt: rr.fmt, id: ins.id, state: ins.state || '', off: !!ins.off, key: ins.key || 0, n: ins.n || 0, pn: ins.pn || null, sc: !!rr.key }; t.inserts.push(got); if (ins.off) NAT.call('bypass', { track: t.id, uid: rr.uid, off: 1 }); keyTold(t, got) }
    else { t.inserts.push(kept); LOAD.left.push(kept.name) }                              // it would not open: its place and its settings stay in the song
  }
  if (typeof wallOutLoad === 'function') await wallOutLoad(d.out)                         // (wall.js: the stereo out's own wall and plug-ins)
  await rewarpAll()
  PROJ.last = json ? '' : serialize(); PROJ.saved = !json; PROJ.savedAt = ''; PROJ.savedMs = r.saved || 0
  rememberProj()
  closeStart()
  dirtyAll()
  refreshPool(); setTitle()
  return true
}
/* the device moved to another rate: every sound has to come again at it */
async function reloadAudio () {
  const files = await loadFiles(projKey(), S.tracks)
  const old = new Set(NAT.keys)
  for (const f of files.values()) if (f && f.key) old.delete(f.key)
  for (const t of S.tracks.flatMap(lanesOf)) for (const r of t.regs) { if (r.loop) { r.wkey = null; r.wsig = ''; continue } const f = r.file ? files.get(r.file) : null; if (f && f.ok) { r.key = f.key; r.peaksAll = f.peaks; r.wkey = null; r.wsig = ''; r.wpeaks = null; dirtyReg(r) } }
  WARPS.clear(); LIVEW.clear(); forgetTransients()
  resync()
  for (const key of old) { NAT.call('dropBuffer', { key }); NAT.keys.delete(key) }                  // what was decoded at the old rate
  await rewarpAll()
}
async function newProject () {
  if (!NAT) return
  await saveNow(true)
  PROJ.hold++
  try { await newProjectNow() } finally { PROJ.hold-- }
}
async function newProjectNow () {
  const have = new Set(((await NAT.call('projList')) || []).map(p => p.name))
  let name = 'untitled', k = 1
  while (have.has(name)) name = `untitled ${++k}`
  resetSession()
  await NAT.call('session', { tempo: S.tempo, end: SONG_END, tracks: [] })
  dropAllAudio()
  const t = mkTrack('audio 1', null, null, null, null, 0, [], mkPatch(0, 0, 0, [0, 0, 0]))
  t.patch0 = copy(t.patch)
  setProj(name); PROJ.demo = false; PROJ.last = ''; PROJ.saved = false; PROJ.fresh = true      // (fresh: it has never been given a name — the first ⌘S asks for one)
  SONG_END = 64; SCENES = []
  if (typeof wallOutLoad === 'function') wallOutLoad(null)                               // (a new song: nothing on the stereo out's wall)
  S.tracks = [t]; S.sel = 0; S.cycle = { on: false, a: 0, b: 4 }; S.pos = 0; S.master = 0; S.auto = false; S.flex = false; S.key = ''; S.look = null; S.rh = 25; S.wz = 1; PXB = (X1 - X0) / 24; VX = 0; VY = 0          // a new song opens on its first twenty-four bars
  repaint()
  resync(); pushTransport(); pushMaster()
  await saveNow(false, true)
  closeStart()
  dirtyAll()
  refreshPool(); setTitle()
}
async function renameProject (to) {
  if (!NAT) { PROJ.name = to; return }
  await saveNow(true)
  const r = await NAT.call('projRename', { from: projKey(), to })
  if (!r || !r.ok) { say('that name is taken'); return }
  setProj(r.key || to); PROJ.last = ''; PROJ.fresh = false
  await saveNow(false)
  setTitle(); rememberProj()
}
/* ⇧⌘S: the mac asks where and under what name; the project as it is goes there as a .sls with its sounds, and the old one
   stays as it was last saved */
const NO_COPY = { taken: 'that name is taken', same: 'that is this project', inside: 'not inside another project', room: 'the disk has no room for a copy', write: 'could not save there' }
async function saveAsAsk () {
  if (!NAT || S.rec || saveAsAsk.busy) return
  saveAsAsk.busy = true
  try {
    const r = await NAT.call('projWhere', { from: projKey(), name: `${PROJ.name} 2` })
    if (r && r.ok) await saveAs(r.key, true)
    else if (r && r.why) say(NO_COPY[r.why] || NO_COPY.write)
  } finally { saveAsAsk.busy = false }
}
/* to: a name (it is kept with the others) or the whole path of a .sls. replace: what lies there goes to the trash first —
   only after the mac's panel has asked */
/* ⌘S on a song that has never been given a name (a new one is kept as "untitled" from the moment it is made, so that
   nothing is lost): the Mac asks where and under what name, as it does for any new document, and the song is that file
   from then on — the nameless one it was kept as goes to the Trash. Answered with the name it has, where it lies: it keeps
   it, and is not asked again. Cancelled: nothing is saved by hand (it is still kept as it was). */
async function saveFirst () {
  if (!NAT || S.rec || saveAsAsk.busy) return
  saveAsAsk.busy = true
  try {
    const r = await NAT.call('projWhere', { from: projKey(), name: PROJ.name })
    if (r && r.ok) await saveAs(r.key, true, true)
    else if (r && r.why === 'same') { PROJ.fresh = false; PROJ.last = ''; const ok = await saveNow(true); say(ok ? 'saved' : 'could not save') }
    else if (r && r.why) say(NO_COPY[r.why] || NO_COPY.write)
  } finally { saveAsAsk.busy = false }
}
async function saveAs (to, replace, move) {
  if (!NAT) return false
  await saveNow(true)
  const r = await NAT.call('projCopy', { from: projKey(), to, replace: replace ? 1 : 0, move: move ? 1 : 0 })
  if (!r || !r.ok) { say(NO_COPY[r && r.why] || NO_COPY.write); return false }
  setProj(r.key || to); PROJ.last = ''; PROJ.fresh = false
  const ok = await saveNow(false)
  setTitle(); refreshPool(); rememberProj()
  if (ok) say(PROJ.at ? `saved as ${PROJ.name}, in ${PROJ.at.split('/').slice(-2, -1)[0].toLowerCase()}` : `saved as ${PROJ.name}`)
  return ok
}
const setTitle = () => { if (NAT) NAT.call('title', { text: PROJ.name }) }
/* ⌘O: the mac's own panel, for a project anywhere on the disk */
async function openProjectAsk () {
  if (!NAT) { say('projects are in the app'); return }
  if (S.rec || openProjectAsk.busy) return
  openProjectAsk.busy = true
  try {
    const r = await NAT.call('projPick', { from: projKey() })
    if (r && r.ok) await openProject(r.key)
    else if (r && r.why) say('that is not a project')
  } finally { openProjectAsk.busy = false }
}
/* the projects the app keeps, and those kept somewhere else that it has had open: the last worked on first */
async function openProjectMenu () {
  if (!NAT) { say('projects are in the app'); return }
  const prefs = await NAT.call('prefGet'), also = prefs && Array.isArray(prefs.elsewhere) ? prefs.elsewhere : []
  PROJ.list = ((await NAT.call('projList', { also })) || []).sort((a, b) => b.modified - a.modified)
  if (!PROJ.list.length) { say('no project to open'); return }
  openMenu(Math.round(RX / 2 - 110), TY + 10, PROJ.list.slice(0, 24).map(p => Object.assign({ t: p.name, v: p.key, on: p.key === projKey() }, p.in ? { k: fit(String(p.in).toLowerCase(), 84, 9.5) } : {})), it => openProject(it.v), { w: 220 })
}
async function openProject (key) { if (key === projKey() && !START.on) return; await saveNow(true); if (!(await loadProject(key))) say('that project would not open'); else await takesBack() }      // (while the start page is up no project is open, whatever the song standing in is called)
/* a take that was being recorded when the app last stopped: its file was made whole on disk as it went, and it is put where
   it was being played — on its track when that is still there */
async function takesBack () {
  const list = await NAT.call('takesLeft', { project: projKey() })
  if (!Array.isArray(list) || !list.length) return []
  const put = placeTakes(list, list[0].bar)
  if (put.length) { say(`${put.length} take${put.length === 1 ? '' : 's'} brought back`); refreshPool() }
  return put
}
/* with option held: every plug-in of the song that is left out comes back, one after another — but for those the app has
   learnt not to trust, which come back only by a press of their own */
async function bringAllBack () {
  let n = 0
  for (const t of S.tracks) for (let k = 0; k < (t.inserts || []).length; k++) {
    const ins = t.inserts[k]
    if (!ins.out || ins.busy || DISTRUST.has(ins.id)) continue
    await bringBack(t, k)
    if (t.inserts[k] === ins && !ins.out) n++
  }
  if (n > 1) say(`${n} plug-ins are back`)
}
/* what is said once after a start that follows a bad end: the facts, and nothing to answer */
function cameBack (gone, cause, opened, takes, bare) {
  const lines = [], at = ms => { const d = new Date(ms); return `${d.getHours()}:${pad2(d.getMinutes())}` }
  if (opened) lines.push([PROJ.name, (PROJ.savedMs ? `as it was saved at ${at(PROJ.savedMs)}` : 'as it was last saved') + (bare ? ', without its plug-ins' : '')])
  if (cause) lines.push([String(cause.name || 'a plug-in').toLowerCase(), gone.inside && gone.inside.id === cause.id ? (gone.held ? 'had not come back when the app was closed, and is left out' : 'was playing when the app stopped, and is left out') : 'was being opened when the app stopped, and is left out'])
  for (const name of LOAD.left) if (!cause || String(cause.name || '').toLowerCase() !== String(name).toLowerCase()) lines.push([String(name).toLowerCase(), 'is left out'])
  if (takes.length) lines.push([takes.length === 1 ? 'a take' : `${takes.length} takes`, `that ${takes.length === 1 ? 'was' : 'were'} being recorded ${takes.length === 1 ? 'is' : 'are'} back on ${[...new Set(takes.map(x => x.track))].join(', ')}`])
  S.back = { title: gone.stuck ? 'a print did not come back when the app was closed' : gone.crashed ? 'the app stopped by itself last time' : 'the app was not closed last time', lines }       // (a crash leaves a note of itself; a forced quit or the power going does not)
  uiDirty('back')
}
/* a plug-in that was left out is opened again, in the place it holds in the patch */
async function bringBack (t, k) {
  const ins = t.inserts[k]
  if (!ins || !ins.out || ins.busy || !NAT) return
  ins.busy = true; uiDirty('dock')
  const at = t.inserts.slice(0, k).filter(x => !x.out).length
  const r = await NAT.call('insert', { track: t.id, id: ins.id, state: ins.state || '', show: 0, at })
  ins.busy = false
  if (r && r.ok) {
    ins.uid = r.uid; ins.name = r.name; ins.fmt = r.fmt; ins.sc = !!r.key; delete ins.out
    if (ins.off) NAT.call('bypass', { track: t.id, uid: r.uid, off: 1 })
    keyTold(t, ins)
    if (DISTRUST.delete(ins.id)) NAT.call('distrust', { list: [...DISTRUST].map(id => ({ id })) })          // it opened and the app is still here: trusted again
    say(`${r.name.toLowerCase()} is back`)
  } else say(`${String(ins.name).toLowerCase()} would not open`)
  uiDirty('dock', 'cmd')
}
/* the song as it was earlier: copies of the project are put aside as it is worked on (one every ten minutes at most) */
const whenText = ms => { const d = new Date(ms), now = new Date(), day = 86400000, days = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / day), hm = `${d.getHours()}:${pad2(d.getMinutes())}`; return days === 0 ? `today ${hm}` : days === 1 ? `yesterday ${hm}` : `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${hm}` }
async function openRevertMenu () {
  if (!NAT) { say('projects are in the app'); return }
  const list = await NAT.call('projBackups', { name: projKey() })
  if (!Array.isArray(list) || !list.length) { say('no earlier copy of this song yet'); return }
  openMenu(Math.round(RX / 2 - 110), TY + 10, list.slice(0, 24).map(b => ({ t: whenText(b.when), v: b.file, when: b.when })), it => revertTo(it.v, it.when), { w: 220 })
}
async function revertTo (file, when) {
  if (S.rec) return
  await saveNow(true)
  const cur = serialize()
  await NAT.call('projSave', { name: projKey(), json: cur, backup: 1 })                  // the song as it is now is put aside first: going back can itself be taken back
  const r = await NAT.call('projBackup', { name: projKey(), file })
  if (!r || !r.ok || !(await loadProject(projKey(), r.json))) { say('that copy would not open'); return }
  await saveNow(false, true)
  say(`back to ${whenText(when)}`)
}
/* called once the engine has the demo: come back to where the last sitting left off */
async function projectBoot (hello) {
  if (!NAT) return
  PROJ.test = !!(hello && hello.selftest)
  CAP.mp3 = !!(hello && hello.mp3)
  if (hello && hello.ins) INPUTS = hello.ins
  NAT.on('dawDevice', d => { if (!d) return; if (d.ins) INPUTS = d.ins; if (d.block) STAT.buf = d.block; if (d.bits) STAT.bits = d.bits; uiDirty('cmd', 'dock') })
  NAT.on('dawMenu', d => { if (START.on) { startMenu(d && d.id); return } const f = d && MENU_DO[d.id]; if (f) f() })
  NAT.on('dawOpen', d => { if (d && d.name) openProject(String(d.name)) })
  let opened = false
  /* the run before this one did not end by itself: the plug-in that was playing on the thread that failed (or was just being
     opened) is not trusted from here on, and the song that was open comes back without it */
  const gone = hello && hello.lastRun && typeof hello.lastRun === 'object' ? hello.lastRun : null
  const listed = await NAT.call('distrust'), distrust = Array.isArray(listed) ? listed : []
  const cause = gone ? (gone.inside && gone.inside.id ? gone.inside : gone.doing && gone.doing.what === 'opening' && gone.doing.id ? gone.doing : null) : null
  if (cause && !distrust.some(x => x.id === cause.id)) { distrust.push({ id: cause.id, name: cause.name || '', when: Date.now() }); await NAT.call('distrust', { list: distrust }) }
  for (const x of distrust) DISTRUST.add(x.id)
  /* a bad end with nothing to name: the app was not caught in the act. Twice in a row on one song, and the song comes back
     without its plug-ins — they are the part of it the app cannot vouch for; each keeps its place and its settings, and
     is brought back by hand. (A run that ends well, or a bad end with a name to it, and the count begins again.) */
  const unnamed = gone && !cause && gone.project ? String(gone.project) : '', before = unnamed ? await NAT.call('badEnds') : null
  const bad = unnamed ? { project: unnamed, n: before && before.project === unnamed ? (+before.n || 0) + 1 : 1 } : null
  await NAT.call('badEnds', { set: bad })
  PROJ.badEnds = bad ? bad.n : 0
  LOAD.bare = !!(bad && bad.n >= 2)
  if (gone && gone.project) opened = await loadProject(String(gone.project))
  else if (PROJ.test) PROJ.name = 'selftest'
  else if (hello && hello.open) opened = await loadProject(String(hello.open))        // the project the app was opened with (from the Finder)
  if (!opened) { await natSession(); pushMaster() }                                   // nothing is open yet: the song the app is born with stands in
  if (!opened && (!PROJ.test || hello.selftest === 'start')) openStart(hello)         // and the start page comes up over it: a new project, or one of those the app knows (the check asks for it by name)
  const takes = opened ? await takesBack() : [], bare = LOAD.bare
  LOAD.bare = false
  if (gone) cameBack(gone, cause, opened, takes, bare)
  /* little room left on the disk: said once, since a take needs room and so does every save (under ten gigabytes the app
     also stops keeping decoded sound ready on the disk and holds it in memory instead). The start page says the room left by itself */
  if (hello && hello.diskFree > 0 && hello.diskFree < 10 * 1073741824 && !PROJ.test && !START.on) say(`the disk has ${Math.round(hello.diskFree / 1073741824 * 10) / 10} gb left`)
  await natReady()
  PROJ.last = PROJ.last || serialize()
  if (!START.on) { refreshPool(); setTitle() }
  setInterval(() => { if (!drag) saveProject(++PROJ.ticks % 20 === 0 && !S.playing && S.tracks.some(t => (t.inserts || []).length)) }, 3000)      // plug-ins are asked for their settings about once a minute, and never while the song runs
  NAT.on('dawQuit', () => { if (typeof quitAsked === 'function') quitAsked(); else saveNow(true).then(() => NAT.call('quit'), () => NAT.call('quit')) })      // (doors.js: it asks first when the song is not as it was last saved)
}
/* the menu bar's File: each line does what its key does */
const MENU_DO = {
  keys: () => toggleSheet(), revert: () => openRevertMenu(),
  timecut: () => KEYS['⌃⌘KeyX'](), timeroom: () => KEYS['⌃⌘KeyZ'](), timeput: () => KEYS['⌃⌘KeyV'](), timerepeat: () => KEYS['⌃⌘KeyR'](),
  fades: () => act.fades(), strip: () => act.strip(), groupregs: () => act.groupRegs(), ungroupregs: () => act.ungroupRegs(), tempofrom: () => act.tempoFrom(), fittempo: () => act.fitTempo(),
  grouptracks: () => groupTracks(), groupsoff: () => KEYS['⇧KeyG'](),
  newtracks: () => openNewTrack(), newaudio: () => newTrack('audio'), newbus: () => newTrack('bus'), duptrack: () => duplicateTrack(S.sel), deltrack: () => deleteTracks(chosen()), renametrack: () => startRename('track', S.sel),
  new: () => newProject(), open: () => openProjectAsk(), recent: () => openProjectMenu(), save: () => KEYS['⌘KeyS'](), saveas: () => saveAsAsk(), rename: () => startRename('proj'),
  import: () => importAudio(), handoff: () => KEYS['⌘KeyB'](), audio: () => NAT.call('audioSettings'),
}
