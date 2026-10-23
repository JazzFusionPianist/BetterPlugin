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
  return (+m[0] - 1) + (m[1] ? (clamp(+m[1], 1, beats) - 1) / beats : 0) + (m[2] ? (clamp(+m[2], 1, per) - 1) / (beats * per) : 0) + (m[3] ? (clamp(+m[3], 1, 240) - 1) / (240 * beats * per) : 0)
}
/* a name (or the tempo, or the key) is changed where it stands: an input laid over the words. A project's name has no
   place of its own on the board (the window's title says it), so it is asked for in a small box under the bar. */
/* what is a name, typed as its owner likes it: kept with its capitals. Everything else (a tempo, a key, a level, a place) is read in lowercase */
const NAME_KINDS = new Set(['track', 'scene', 'region', 'proj'])
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
  } else if (what === 'smptestart') {                                                              // where the time's count begins: a wide panel in the middle of the window (his ask, 2026-10-21)
    const left = typeof SKV === 'object' ? SKV.left || 0 : 0, w = 520, h = 76, x = Math.round((W - left - w) / 2), y = Math.round((H - h) / 2 - 30)
    S.ask = { x, y, w, h, label: 'smpte start', note: `hh:mm:ss:ff   at ${smpteRate().t} fps   return sets it, esc leaves it`, big: true }
    put(x + 140, y + 16, 220, 34, '500 22px', smpteStart(), false)
  } else if (typeof skinField === 'function' && skinField(what)) { const f = skinField(what); put(f.x, f.y, f.w, f.h, '500 12px', what === 'tempo' ? String(+S.tempo.toFixed(2)) : what === 'key' ? S.key : what === 'smpte' ? smpte(curPos()) : what === 'smptestart' ? smpteStart() : place(curPos()), true) }      // (the deck at the foot: where it says it is — skins.js)
  else if (what === 'tempo') put(DISP_X + BARC.tempo[0], 11, BARC.tempo[1], 22, '400 11.5px', String(+S.tempo.toFixed(2)), true)
  else if (what === 'key') put(DISP_X + BARC.key[0], 11, BARC.key[1], 22, '400 11.5px', S.key, true)
  else if (what === 'pos') put(DISP_X, 11, BARC.pos[1], 22, '500 12.5px', place(curPos()), true)           // where the playhead is, typed: a bar, or bar beat sixteenth tick
  else if (what === 'smpte' || what === 'smptestart') put(DISP_X + BARC.smpte[0], 11, BARC.smpte[1], 22, '400 11.5px', what === 'smpte' ? smpte(curPos()) : smpteStart(), true)      // a time to go to, or where the count begins
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
    const typed = el.value.trim().slice(0, 40), v = NAME_KINDS.has(what) ? typed : typed.toLowerCase()      // (a name is kept as it was typed, capitals and all)
    if (!keep || (!v && what !== 'key')) return
    if (what === 'track') { if (v !== t.name) edit(() => { t.name = v }) }
    else if (what === 'scene') { if (SCENES[i] && v !== SCENES[i].name) edit(() => { SCENES = mkScenes(SCENES.map((s, k) => [k === i ? v : s.name, s.a, s.c])) }) }
    else if (what === 'tempo') { const bpm = clamp(Math.round(parseFloat(v) * 100) / 100, 40, 240); if (isFinite(bpm) && bpm !== S.tempo) setTempo(bpm) }
    else if (what === 'key') S.key = v.slice(0, 8)
    else if (what === 'vol') {
      const x = /inf|∞/.test(v) ? -48 : parseFloat(v.replace(/[−–]/g, '-')), db = isFinite(x) ? (x <= -47.5 ? -48 : clamp(Math.round(x * 10) / 10, -48, 6)) : null
      if (db != null && i < 0) { S.master = db; pushMaster() } else if (db != null && S.tracks[i]) volSet(S.tracks[i], db)
    }
    else if (what === 'pos') { const to = parsePos(v); if (to != null) goTo(to) }
    else if (what === 'smpte') { const to = smptePos(v); if (to != null) goTo(clamp(to, 0, SONG_END)) }
    else if (what === 'smptestart') { const r = smpteRate(), k = tcCount(v, r); if (k != null) { S.smpte = { rate: r.t, start: tcLabel(k, r) }; say(`smpte starts at ${S.smpte.start}`) } }
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
/* coming: its sound is still being made ready (bringPaths) — placed now as it will lie, filled in when it comes; the regions
   placed are kept in placeDecoded.made */
function placeDecoded (list, lane, bar) {
  const before = editState(), good = list.filter(d => d && d.ok !== false && d.sec > 0), own = t => t && t.kind === 'audio' && !t.theirs && !t.inst
  let last = lane != null && own(S.tracks[lane]) ? S.tracks[lane] : null, any = false
  placeDecoded.made = []
  good.forEach((d, k) => {
    const base = String(d.name || 'audio'), nums = [...base.matchAll(/(?<![0-9a-z])(\d{2,3})(\s?bpm)?(?![0-9])/gi)].map(x => ({ v: +x[1], tag: !!x[2] })).filter(x => x.v >= 60 && x.v <= 200), bpm = (nums.find(x => x.tag) || nums[0] || { v: 0 }).v
    const rate = 1, sec = d.sec, len = sec / SPB()                                      // as it is: never made to go at the song's tempo by itself (his word, 2026-10-22 — a file of 104 named so was sped up to a song at 107; Region > Tempo > Fit Region to Project Tempo does it when asked)
    let t = k === 0 ? last : null
    if (!t && S.tracks.length >= MAX_TRACKS) t = last || S.tracks.filter(own).pop()
    if (!t) {
      t = mkTrack(base.slice(0, 24).toLowerCase(), null, null, null, null, isDemo() ? -6 : 0, [], mkPatch(0, 0, 0, [0, 0, 0]))
      t.patch0 = copy(t.patch)
      if (last) { t.parent = last.parent; S.tracks.splice(S.tracks.indexOf(last) + 1, 0, t) } else S.tracks.push(t)
      normalizeOrder()
    }
    if (!t) return
    const first = !t.tone && !t.regs.length
    if (first && !d.coming) { const tone = readTone(d); if (tone) t.tone = tone }        // how its first sound moves: read when its name says nothing
    carve(t, bar - 1, bar - 1 + len)
    const nr = mkReg({ a: bar, b: bar + len, buf: d.buf || null, key: d.key, file: d.file, peaksAll: d.peaks, loop: false, rate, sec, srcBars: len, name: base.toLowerCase() })
    if (d.coming) { nr.missing = true; nr.wait = true }
    if (bpm) nr.bpm = bpm                                                                // its name says how fast it goes; else the app listens (and says what it heard)
    else if (NAT && d.sec > 2 && !d.coming) heardTempo(nr, base)
    t.regs.push(nr)
    placeDecoded.made.push({ r: nr, t, first, base })
    last = t; any = true
  })
  if (any) { birthAll(); commit(before); refreshPool(); if (S.flex) for (const t of S.tracks) for (const r of t.regs) if (rubatoOn(r)) ensureTransients(r) }
  return any
}
const heardTempo = (r, base) => ensureTempo(r).then(heard => { if (heard) say(`${base.toLowerCase().slice(0, 28)} goes at ${+heard.toFixed(1)}`) })
/* sounds brought in by where they lie: let go from the Finder (the app kept where they lie: Mac.mm, slurDroppedPaths) or
   picked with import audio. The app copies them into the project's own sounds at once (a clone, where the disk can);
   they are placed straight away as they will lie, as outlines with their names, and each is filled in as it is made
   ready, eight at a time (his testers, 2026-10-20: bringing sound in was slow — each used to cross to the app in pieces,
   one after another, and be made ready with the window standing still). The card comes up only if it takes a while. */
async function bringPaths (paths, lane, bar) {
  const gen = SOUNDS.gen, project = projKey()
  const got = await NAT.call('audioBring', { project, paths })
  if (gen !== SOUNDS.gen) return false
  const all = Array.isArray(got) ? got : [], list = all.filter(d => d && d.ok)
  for (const d of all) if (!d || !d.ok) say(`couldn’t open ${fit(String((d && d.name) || 'a file'), 160, 9.5)}`)
  if (!list.length) return false
  placeDecoded(list.map(d => ({ ok: true, coming: true, sec: d.sec, file: d.file, name: d.name })), lane, bar)
  const made = placeDecoded.made, names = [...new Set(list.map(d => d.file))]
  let done = 0, shown = false                                                           // (the card is this one's only if a print did not have it already)
  const card = setTimeout(() => { if (done < names.length && !PRINT.on && !OPENING.on) { printBegin('bringing in', names.length === 1 ? list[0].name : `${names.length} files`, names.length); shown = PRINT.on; if (shown) printTell({ done }) } }, 300)
  try {
    let next = 0
    const one = async () => {
      while (next < names.length && gen === SOUNDS.gen) {
        const name = names[next++], f = await NAT.call('audioLoad', { project, file: name })
        if (gen !== SOUNDS.gen) { if (f && f.key) { NAT.call('dropBuffer', { key: f.key }); NAT.keys.delete(f.key) } return }
        SOUNDS.ready.set(name, f || { ok: false }); soundsFill()
        for (const m of made) if (m.r.file === name && m.r.key) {                        // what was left for its sound: how it moves, how fast it goes, where it begins
          if (m.first && !m.t.tone) { const tone = readTone(f); if (tone) { m.t.tone = tone; uiDirty('head', 'lanes') } }
          if (!m.r.bpm && f.sec > 2) heardTempo(m.r, m.base)
          if (S.flex && rubatoOn(m.r)) ensureTransients(m.r)
        }
        done++; if (shown) printTell({ done })
        clearTimeout(SOUNDS.settle); SOUNDS.settle = setTimeout(soundsSettle, 150)
      }
    }
    await Promise.all(Array.from({ length: Math.min(8, names.length) }, one))
  } finally { clearTimeout(card); if (shown) printEnd() }
  if (gen === SOUNDS.gen) { clearTimeout(SOUNDS.settle); soundsSettle(); refreshPool() }
  return true
}
async function dropFiles (files, lane, bar) {
  const list = [], onto = lane != null ? S.tracks[lane] : null
  /* sound let go on the window: while it is brought in (each file goes over to the app piece by piece and is made ready
     there), the card in the middle of the window says which file of how many, and how far along it is */
  const isSound = f => /^audio\//.test(f.type) || /\.(wav|aiff?|mp3|m4a|ogg|flac|caf)$/i.test(f.name), sounds = files.filter(f => !/\.midi?$/i.test(f.name) && isSound(f))
  /* from the Finder: where each lies is known (the same name and size), and they are brought in by it — the notes files
     as ever. A sound let go from somewhere that says nothing of where it lies still comes over in pieces */
  if (NAT && sounds.length && !(onto && onto.inst && onto.inst.kind === 'sampler' && files.length === 1)) {
    const known = (await NAT.call('dropPaths')) || [], paths = []
    for (const f of sounds) { const i = known.findIndex(k => k.name === f.name && k.size === f.size); if (i < 0) break; paths.push(known.splice(i, 1)[0].path) }
    if (paths.length === sounds.length) {
      for (const f of files) if (/\.midi?$/i.test(f.name)) { try { placeMidi(new Uint8Array(await f.arrayBuffer()), f.name, Math.max(1, Math.floor(bar + 1e-6))) } catch (err) { say(`couldn’t read ${fit(f.name, 160, 9.5)}`) } }
      return bringPaths(paths, lane, bar)
    }
  }
  let nth = 0
  if (NAT && sounds.length) printBegin('bringing in', sounds.length === 1 ? sounds[0].name.replace(/\.[^.]+$/, '') : `${sounds.length} files`, sounds.length)
  const told = p => printTell({ part: p * .9 })                                          // (the last tenth of a file's share: the app making it ready once all of it is there)
  try { return await dropFilesNow(files, lane, bar, list, onto, told, () => printTell({ done: ++nth })) } finally { printEnd() }
}
async function dropFilesNow (files, lane, bar, list, onto, told, one) {
  for (const f of files) {
    if (/\.midi?$/i.test(f.name)) { try { placeMidi(new Uint8Array(await f.arrayBuffer()), f.name, Math.max(1, Math.floor(bar + 1e-6))) } catch (err) { say(`couldn’t read ${fit(f.name, 160, 9.5)}`) } continue }      // a file of notes: its tracks, from the bar it was let go on
    if (!/^audio\//.test(f.type) && !/\.(wav|aiff?|mp3|m4a|ogg|flac|caf)$/i.test(f.name)) continue
    if (onto && onto.inst && onto.inst.kind === 'sampler' && files.length === 1) {       // one sound let go on a sampler's track: the sampler plays from it
      try { const d = await decodeFile(f, told); one(); if (d && d.file) { setInstSample(onto, 0, { file: d.file, name: f.name.replace(/\.[^.]+$/, '') }); refreshPool(); say(`the sampler plays ${fit(f.name.replace(/\.[^.]+$/, '').toLowerCase(), 160, 9.5)}`) } } catch (err) { say(`couldn’t open ${fit(f.name, 160, 9.5)}`) }
      return true
    }
    try { const d = await decodeFile(f, told); list.push(Object.assign({ name: f.name.replace(/\.[^.]+$/, '') }, d)) } catch (err) { say(`couldn’t open ${fit(f.name, 160, 9.5)}`) }
    one()
  }
  return placeDecoded(list, lane, bar)
}
async function importAudio () {
  const cur = S.tracks[S.sel], at = Math.max(0, snapPos(curPos(), null)) + 1, lane = cur && cur.kind === 'audio' && !cur.theirs && !cur.inst ? S.sel : null
  if (NAT) { const paths = await NAT.call('importPick'); if (Array.isArray(paths) && paths.length) await bringPaths(paths, lane, at); return }
  const inp = document.createElement('input')
  inp.type = 'file'; inp.accept = 'audio/*'; inp.multiple = true
  inp.onchange = () => dropFiles([...inp.files], lane, at)
  inp.click()
}

/* ── the project on disk (the app only) ── */
const KEEP_T = ['id', 'name', 'col', 'shape', 'tone', 'theirs', 'kind', 'vol', 'def', 'pan', 'mute', 'solo', 'inp', 'out', 'parent', 'open', 'h', 'sends', 'autos', 'ap', 'patch', 'midi', 'buf0', 'grp', 'alt', 'inst', 'disabled']
const KEEP_R = ['id', 'a', 'b', 'off', 'gain', 'mute', 'fi', 'fo', 'loop', 'rate', 'sec', 'srcBars', 'tag', 'name', 'file', 'tr', 'ft', 'flex', 'rev', 'fx', 'col', 'shape', 'fic', 'foc', 'fis', 'fos', 'grp', 'bpm', 'xo', 'sm', 'px', 'py', 'notes', 'ctl', 'q', 'qs', 'sw', 'vel', 'rep', 'chords', 'rub', 'flexOff', 'fib', 'fob']
function serialize () {
  return JSON.stringify({
    v: 3, name: PROJ.name, demo: PROJ.demo, fresh: PROJ.fresh ? true : undefined, tempo: S.tempo, meter: S.meter, key: S.key, smpte: S.smpte, end: SONG_END, scenes: SCENES.map(s => [s.name, s.a, s.c]), master: S.master, click: S.click, countIn: S.countIn,
    cycle: S.cycle, sel: S.sel, view: { pxb: PXB, vx: VX, vy: VY, rh: S.rh, wz: S.wz || 1, panel: { on: S.panel.on, tab: S.panel.tab, h: S.panel.h }, slur: S.slur }, snap: S.snap, mode: S.mode, nudge: S.nudge, grid: S.grid, q: S.q,
    out: typeof wallOutSaved === 'function' ? wallOutSaved() : undefined,              // (wall.js: what stands on the stereo out's wall)
    ref: typeof refSaved === 'function' ? refSaved() : undefined,                      // (reference.js: the reference row)
    tracks: S.tracks.map(t => {
      const o = {}
      for (const k of KEEP_T) if (t[k] !== undefined) o[k] = t[k]
      if (o.inst) o.inst = instCopy(o.inst)
      const kept = list => list.filter(r => r.loop || r.file || r.notes).map(r => { const q = {}; for (const k of KEEP_R) if (r[k] !== undefined && r[k] !== null) q[k] = r[k]; if (r.loop) q.buf = r.buf; return q })
      o.regs = kept(t.regs)
      if (t.frozen && t.frozen.reg && t.frozen.reg.file) { const fr = t.frozen.reg; o.frozen = { reg: { a: fr.a, b: fr.b, file: fr.file, sec: fr.sec }, sig: t.frozen.sig } }      // (freeze.js: its print, a file in the song's folder)
      if ((t.alts || []).length) o.alts = t.alts.map(a => ({ name: a.name, regs: kept(a.regs) }))
      if (t.wall && typeof wallSaved === 'function') o.wall = wallSaved(t)                 // (wall.js: how its patch is wired)
      o.inserts = (t.inserts || []).filter(i => i.id).map(i => Object.assign({ id: i.id, name: i.name, fmt: i.fmt, state: i.state || '' }, i.off ? { off: true } : {}, i.key ? { key: i.key } : {}, i.n ? { n: i.n } : {}, i.pn ? { pn: i.pn } : {}))
      return o
    }),
  })
}
/* full = ask every plug-in for its state too (slower; done now and then, on save, and on the way out).
   While a project is being opened or made (PROJ.hold) nothing is written, or half of one song would land in another's file. */
async function saveProject (full, evenHeld, moved) {                               // moved: only the plug-ins that have changed are asked (Engine::pluginStates)
  if (!NAT || PROJ.busy || S.rec || (PROJ.hold && !evenHeld)) return false
  PROJ.busy = true
  try {
    if (full) { const st = await NAT.call('pluginStates', moved ? { moved: 1 } : {}); if (st) for (const t of S.tracks) { for (const i of t.inserts || []) if (st['u' + i.uid] != null) i.state = st['u' + i.uid]; if (t.inst && t.inst.kind === 'plug' && t.inst.uid && st['u' + t.inst.uid] != null) t.inst.state = st['u' + t.inst.uid] } if (st && typeof OUT !== 'undefined') for (const i of OUT.inserts) if (st['u' + i.uid] != null) i.state = st['u' + i.uid] }
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
/* every file a project's regions point at, decoded again (a project opening, or the device moving to another rate).
   step: told after each file (how many are done, of how many) */
async function loadFiles (project, tracks, step) {
  const files = new Map(), names = []
  for (const t of tracks) for (const L of [t].concat(t.alts || [])) for (const q of L.regs) if (!q.loop && q.file && !names.includes(q.file)) names.push(q.file)
  /* several asked for at once: the app makes them ready on as many threads as it has to spare (a new sound is decoded the
     first time, which is the long part of opening a project of many takes) */
  let next = 0, done = 0
  const one = async () => { while (next < names.length) { const f = names[next++]; files.set(f, await NAT.call('audioLoad', { project, file: f })); done++; if (step) step(done, names.length) } }
  await Promise.all(Array.from({ length: Math.min(8, names.length) }, one))
  return files
}
/* ── the sounds of a project being opened come after it is on the screen (his ask, 2026-10-19: a project of sixty tracks
   and 4.5 GB stood still with the wheel spinning until every sound was ready — "적어도 메인 화면은 바로 띄워주고 progress
   bar"). Its regions are drawn at once as outlines with their sound's name (as one not found is: missing.js), and filled
   in as each sound comes, eight at a time beside the plug-ins being opened; the card says how far along they are. A
   region made meanwhile from one still waiting (a copy, an undo) is filled in with the rest (soundsFill). Another project
   opened before they have all come: no more of them is asked for, and what still comes is let go (gen). ── */
/* a song's text as the app hands it over: base64 of its bytes (Main.cpp, text64) */
const natText = b64 => { const s = atob(String(b64 || '')), u8 = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i); return new TextDecoder().decode(u8) }
const SOUNDS = { gen: 0, ready: new Map(), stop: null, fresh: [], settle: 0 }
function soundsStop () { SOUNDS.gen++; SOUNDS.ready = new Map(); SOUNDS.fresh = []; if (SOUNDS.stop) { const s = SOUNDS.stop; SOUNDS.stop = null; s(false) } }
const soundNames = tracks => [...new Set(tracks.flatMap(t => [t].concat(t.alts || [], t.frozen && t.frozen.reg ? [{ regs: [t.frozen.reg] }] : [])).flatMap(L => L.regs || []).filter(q => !q.loop && !q.notes && q.file).map(q => q.file))]
/* a region given its sound (f: what audioLoad answered); one whose sound could not be found stays, now as not found */
function soundOn (r, f) {
  delete r.wait
  if (f && f.ok) { r.key = f.key; r.peaksAll = f.peaks; r.buf = null; delete r.missing; delete r.peak; SOUNDS.fresh.push(r) }
  dirtyReg(r)
}
function soundsFill () {
  if (!SOUNDS.ready.size) return
  for (const L of S.tracks.flatMap(t => [t].concat(t.alts || [], t.frozen && t.frozen.reg ? [{ regs: [t.frozen.reg] }] : []))) for (const r of L.regs) if (r.wait && SOUNDS.ready.has(r.file)) soundOn(r, SOUNDS.ready.get(r.file))
}
/* -> a promise: true once every sound has come, false when another project was opened first. step(done): after each */
function soundsRead (project, names, step) {
  const gen = SOUNDS.gen
  return new Promise(resolve => {
    if (!names.length) { resolve(true); return }
    SOUNDS.stop = resolve
    let next = 0, done = 0
    const one = async () => {
      while (next < names.length && gen === SOUNDS.gen) {
        const name = names[next++], f = await NAT.call('audioLoad', { project, file: name })
        if (gen !== SOUNDS.gen) { if (f && f.key) { NAT.call('dropBuffer', { key: f.key }); NAT.keys.delete(f.key) } return }
        SOUNDS.ready.set(name, f || { ok: false }); soundsFill(); done++; step(done)
        clearTimeout(SOUNDS.settle); SOUNDS.settle = setTimeout(soundsSettle, 150)
        if (done === names.length) { SOUNDS.stop = null; resolve(true) }
      }
    }
    for (let k = 0; k < Math.min(8, names.length); k++) one()
  })
}
/* what has come is heard and drawn (a few at a time): its regions go to the engine, the stretched ones are rendered */
function soundsSettle () {
  const fresh = SOUNDS.fresh.splice(0)
  if (!fresh.length) return
  resync(); uiDirty('lanes', 'dock', 'info')
  rewarp(fresh.filter(r => S.tracks.some(t => t.regs.includes(r))))
}
/* ── a project being opened: a card in the middle of the window says whose it is, what is being done (its sounds made
   ready, its plug-ins opened one after another — the long part: each is a program of its own starting up — its stretched
   sounds rendered) and how far along it is. It comes up only when the opening takes more than a moment. How long each part
   took is written into the app's log (Library/Logs/Slur/daw.log), so that a slow one can be found. ── */
const OPENING = { on: false, t0: 0, show: 0, parts: [], marks: [], base: 0, n: 0, count: null, took: null, drawnAt: 0 }
/* beside the bar, while the card is up: a whole note walks a scale up and down five hairlines, a step every 0.14 s (his
   pick of five, design/progress motion draft 1: a) */
function ldNote () {
  const card = $('loading'), svgN = $('ld-note')
  if (!card || !svgN) return
  if (ldNote.on) return
  ldNote.on = true
  const t0 = performance.now(), STEPS = [0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1]
  let lines = ''
  for (let i = 0; i < 5; i++) lines += `<path d="M0 ${2 + i * 2.5}H26" stroke="${INK}" stroke-opacity=".28" stroke-width=".6"/>`
  const go = () => {
    if (!OPENING.on && !PRINT.on) { ldNote.on = false; return }
    const t = (performance.now() - t0) / 1000, i = Math.floor(t / .14) % STEPS.length, y = 12 - STEPS[i] * 1.25, x = 4 + (i / (STEPS.length - 1)) * 18
    svgN.innerHTML = lines + `<ellipse cx="${x}" cy="${y}" rx="2.6" ry="1.7" transform="rotate(-24 ${x} ${y})" fill="#6E86FF"/><ellipse cx="${x}" cy="${y}" rx="1.25" ry=".75" transform="rotate(-50 ${x} ${y})" fill="${K2}"/>`
    requestAnimationFrame(go)
  }
  requestAnimationFrame(go)
}
/* The card is up the moment a project is asked for (his ask, 2026-10-18: a big project showed nothing for a while, and he
   could not tell whether it was opening at all) — before the song that is open is saved, before the file is read and
   taken apart; what there is to do after that (its sounds, its plug-ins) is added once it is known (openingMore). */
function openingBegin (name, parts) {
  OPENING.on = true; OPENING.t0 = performance.now(); OPENING.parts = parts; OPENING.marks = []; OPENING.base = 0; OPENING.count = null; OPENING.took = null
  const n = ++OPENING.n, el = $('loading')
  if (!el) return n
  $('ld-word').textContent = LANG_WORDS('opening'); $('ld-name').textContent = String(name); $('ld-fill').style.width = '0'; $('ld-what').textContent = parts.length ? LANG_WORDS(parts[0][0]) : ''
  el.style.left = Math.round((W - 340) / 2) + 'px'; el.style.top = Math.round((H - 96) / 2) + 'px'
  clearTimeout(OPENING.show); el.hidden = false
  ldNote()
  return n
}
/* the rest of what there is to do, once the project has been read: its parts are said from here on by their own places */
function openingMore (parts) { OPENING.base = OPENING.parts.length; OPENING.parts = OPENING.parts.concat(parts) }
/* the card drawn on the screen before anything holds the page up (a big project read and taken apart in one go) */
const openingShown = () => new Promise(r => { let done = false; const go = () => { if (!done) { done = true; r() } }; requestAnimationFrame(() => setTimeout(go, 0)); setTimeout(go, 60) })
/* part: which part is under way (its place among those added last: [name, how many things]); done: how many of its things
   are done; what: the thing being done now. openingAt: the same by its place among all of them. */
function openingSay (part, done, what) { openingAt(OPENING.base + part, done, what) }
function openingAt (part, done, what) {
  if (!OPENING.on) return
  const ps = OPENING.parts, all = ps.reduce((n, p) => n + Math.max(1, p[1]), 0), before = ps.slice(0, part).reduce((n, p) => n + Math.max(1, p[1]), 0), p = ps[part]
  if (!p) return
  if (!OPENING.marks[part]) OPENING.marks[part] = performance.now()
  const el = $('ld-fill'), w = $('ld-what')
  if (el) el.style.width = (100 * Math.min(all, before + Math.min(done, Math.max(1, p[1]))) / Math.max(1, all)).toFixed(1) + '%'
  if (w) w.textContent = (p[1] > 1 ? LANG_WORDS(`${p[0]} ${Math.min(done + 1, p[1])} of ${p[1]}`) : LANG_WORDS(p[0])) + (what ? '   ' + String(what).toLowerCase() : '')
}
/* the card while the project is already on the screen: its plug-ins being opened (pd of pn, `what` the one now) and its
   sounds made ready beside them (sd of sn), as one bar */
function openingTell () {
  const c = OPENING.count, el = $('ld-fill'), w = $('ld-what')
  if (!OPENING.on || !c) return
  if (el) el.style.width = (100 * (c.pd + c.sd) / Math.max(1, c.pn + c.sn)).toFixed(1) + '%'
  if (w) w.textContent = c.pd < c.pn ? LANG_WORDS(`plug-ins ${c.pd + 1} of ${c.pn}`) + (c.what ? '   ' + String(c.what).toLowerCase() : '') : c.sd < c.sn ? LANG_WORDS(`sounds ${c.sd} of ${c.sn}`) : LANG_WORDS('getting ready')
}
/* n: the opening it ends (what openingBegin gave): one asked for after it has its own card */
function openingEnd (ok, n) {
  if (!OPENING.on || (n != null && n !== OPENING.n)) return
  OPENING.on = false; clearTimeout(OPENING.show)
  const el = $('loading'); if (el) el.hidden = true
  const now = performance.now(), ms = OPENING.marks, took = OPENING.took || OPENING.parts.map((p, i) => { if (!ms[i]) return null; let j = i + 1; while (j < ms.length && !ms[j]) j++; return `${p[0]} ${p[1]} in ${(((ms[j] || now) - ms[i]) / 1000).toFixed(1)} s` }).filter(Boolean)
  if (NAT) NAT.call('log', { text: `${ok ? 'opened' : 'would not open'} in ${((now - OPENING.t0) / 1000).toFixed(1)} s: ${took.join(', ')}` })
  OPENING.last = { ok, ms: Math.round(now - OPENING.t0), took }                         // (the last opening, as the check reads it)
}
/* key: the project, as projKey says it. json: the song as it was at another time (a copy put aside), opened in this project's place */
/* ── a print under way (the mix or stems handed off, a bounce in place): the same card says what is being printed and how
   far along it is — file by file, and within the file being written. It is up at once (a print is never over in a moment)
   and goes when the print ends, done or not. ── */
const PRINT = { on: false, total: 1, done: 0, part: 0 }
function printBegin (word, name, total) {
  if (OPENING.on) return
  PRINT.on = true; PRINT.total = Math.max(1, total || 1); PRINT.done = 0; PRINT.part = 0; PRINT.word = word
  const el = $('loading')
  if (!el) return
  $('ld-word').textContent = LANG_WORDS(word); $('ld-name').textContent = String(name)
  el.style.left = Math.round((W - 340) / 2) + 'px'; el.style.top = Math.round((H - 96) / 2) + 'px'
  printDraw(); el.hidden = false; ldNote()
  addEventListener('keydown', printKey, true)
}
/* esc while a print is under way: it stops, and nothing of it is kept (Engine::printStop) */
function printKey (e) {
  if (!PRINT.on || e.code !== 'Escape' || PRINT.word === 'bringing in') return              // (sound brought in is not stopped by it)
  e.preventDefault(); e.stopImmediatePropagation()
  if (PRINT.stopping) return
  PRINT.stopping = true
  if (NAT) NAT.call('bounceStop')
  const w = $('ld-what'); if (w) w.textContent = LANG_WORDS('stopping')
}
/* d: what the app says while it prints — done: how many files are written; part: how far along the one being written is */
function printTell (d) {
  if (!PRINT.on || !d) return
  if (d.done != null && d.done >= 0) { if (d.done !== PRINT.done) PRINT.part = 0; PRINT.done = Math.min(PRINT.total, d.done) } else if (d.part != null) PRINT.part = clamp(+d.part || 0, 0, 1)
  printDraw()
}
function printDraw () {
  const f = clamp((PRINT.done + (PRINT.done < PRINT.total ? PRINT.part : 0)) / PRINT.total, 0, 1), el = $('ld-fill'), w = $('ld-what')
  if (el) el.style.width = (f * 100).toFixed(1) + '%'
  if (w && !PRINT.stopping) w.textContent = (PRINT.total > 1 ? LANG_WORDS(`file ${Math.min(PRINT.done + 1, PRINT.total)} of ${PRINT.total}`) + '   ' : '') + Math.round(f * 100) + '%' + (PRINT.word === 'bringing in' ? '' : '   ' + LANG_WORDS('esc stops it'))
}
function printEnd () { if (!PRINT.on) return; PRINT.on = false; PRINT.stopping = false; removeEventListener('keydown', printKey, true); const el = $('loading'); if (el && !OPENING.on) el.hidden = true }
async function loadProject (key, json) {
  let n = OPENING.n
  if (!OPENING.on) { n = openingBegin(projNameOf(key), [['reading', 1]]); await openingShown() }
  PROJ.hold++
  let ok = false, held = true
  const free = () => { if (held) { held = false; PROJ.hold-- } }                        // (the song may be written once its plug-ins are in: loadProjectNow)
  try { ok = await loadProjectNow(key, json, free); return ok } finally { free(); openingEnd(ok, n) }
}
/* Plug-ins the app has learnt not to open by itself (one was playing, or being opened, when the app last went down), and what
   was left out of the song being opened. A plug-in left out keeps its place in the patch and its settings: it is drawn
   there dimmed, and a press brings it back. One that will not open (it is not on this machine) is kept the same way. */
const DISTRUST = new Set()
const LOAD = { bare: false, left: [] }
async function loadProjectNow (key, json, free) {
  soundsStop()                                                                         // (another project's sounds still on their way: no more of them)
  const gen = SOUNDS.gen, t0 = performance.now()
  openingAt(Math.max(0, OPENING.parts.findIndex(p => p[0] === 'reading')), 0)
  const r = json ? { ok: true, json, saved: Date.now() } : await NAT.call('projLoad', { name: key })
  if (!r || !r.ok) return false
  let d
  try { d = JSON.parse(r.json != null ? r.json : natText(r.json64)) } catch (e) { return false }
  if (!d || !Array.isArray(d.tracks) || !d.tracks.length) return false
  /* how much there is to do: its plug-ins (those of the stereo out too) and its sounds, both once it is on the screen */
  const names = soundNames(d.tracks), plugs = d.tracks.reduce((n, t) => n + (t.inserts || []).filter(i => !i.out).length, 0) + ((d.out && d.out.inserts) || []).filter(i => !i.out).length
  OPENING.count = { pn: plugs, pd: 0, sn: names.length, sd: 0, what: '' }
  resetSession()
  await NAT.call('session', { tempo: S.tempo, end: SONG_END, tracks: [] })                           // everything out of the engine first, plug-ins too
  dropAllAudio()
  if (gen !== SOUNDS.gen) return true                                                  // (another project was asked for meanwhile: it is that one's to open)
  const meter = Array.isArray(d.meter) && MEASURES.some(m => m[0] === d.meter[0] && m[1] === d.meter[1]) ? d.meter.slice(0, 2) : [4, 4]
  if (d.tempo !== S.tempo || meter[0] !== S.meter[0] || meter[1] !== S.meter[1]) { S.tempo = d.tempo; S.meter = meter; LOOPS = songLoops(S.tempo); await natSendLoops() }
  PROJ.fresh = !!d.fresh; setProj(key); PROJ.demo = d.demo == null ? !(d.v >= 2) : !!d.demo                    // it is called what its folder is called: a copy made in the Finder must not write into the one it was copied from
  SONG_END = d.end || 42
  SCENES = mkScenes(Array.isArray(d.scenes) ? d.scenes : (isDemo() ? DEMO_SCENES : []))
  S.tracks = d.tracks.map(o => {
    const t = Object.assign({ n: null, kind: 'audio', pan: 0, inp: 0, out: 0, parent: null, open: true, sends: [], autos: {}, ap: 'vol', arm: false, mon: false }, o, { inserts: [] })
    if (!(t.h >= ROW_MIN && t.h <= ROW_MAX)) delete t.h                                    // (a row's own height, when it was pulled to one)
    delete t.c; delete t.own                                                             // a project from before colours were read from what a track holds
    if (t.inst) { t.inst = Object.assign({}, t.inst); delete t.inst.out }               // (an instrument written as left out — it did not open on another Mac — is tried again here)
    if (d.demo && MOCK_PATCH[t.name] && JSON.stringify(t.patch) === JSON.stringify(MOCK_PATCH[t.name])) t.patch = NO_PATCH()          // the first song's mock-up patch, exactly as it was put there and never touched: taken off
    const back = list => list.map(q => Object.assign({ off: 0, gain: 0, mute: false, fi: 0, fo: 0 }, q, q.file && !q.loop && !q.notes ? { missing: true, wait: true } : {})).filter(q => q.notes ? Array.isArray(q.notes) : q.loop ? LOOPS[q.buf] : q.key || q.missing)      // (its sound is still to come: soundsRead. One not found is never let go of: its region stays, says so, and is written back as it was — missing.js)
    t.regs = back(o.regs)
    if (t.frozen && t.frozen.reg && t.frozen.reg.file) t.frozen = { reg: Object.assign({ rate: 1, off: 0, gain: 0, fi: 0, fo: 0 }, t.frozen.reg, { missing: true, wait: true }), sig: t.frozen.sig }; else delete t.frozen      // (a frozen track's print comes with the other sounds: until it has, the track plays as it is)
    t.alts = Array.isArray(o.alts) ? o.alts.map(a => ({ name: String(a.name), regs: back(a.regs || []) })) : []
    t.patch0 = copy(t.patch)
    return t
  })
  TID = Math.max(0, ...S.tracks.map(t => t.id)); RID = Math.max(0, ...S.tracks.flatMap(lanesOf).flatMap(t => t.regs.map(q => q.id)))
  PID = Math.max(0, ...S.tracks.flatMap(t => Object.values(t.autos).flatMap(p => p.map(q => q.id))))
  for (const t of S.tracks.flatMap(lanesOf)) for (const q of t.regs) if (q.notes) { for (const x of q.notes) if (x.id > NID) NID = x.id; for (const c of q.ctl || []) if (c.id > NID) NID = c.id }
  S.cycle = Object.assign({ on: false, a: 0, b: 4 }, d.cycle); S.sel = clamp(d.sel || 0, 0, Math.max(0, S.tracks.length - 1)); setMode(MODES.includes(d.mode) ? d.mode : d.snap === false ? 'slip' : 'smart'); S.nudge = NUDGES.includes(d.nudge) ? d.nudge : 'beat'; if (typeof GRIDS !== 'undefined') S.grid = GRIDS.includes(d.grid) ? d.grid : '1/4'; S.pos = 0
  S.master = d.master == null ? 0 : d.master; S.click = !!d.click; S.countIn = d.countIn !== false; S.q = d.q || 1 / 16; S.auto = false; S.flex = false; S.key = typeof d.key === 'string' ? d.key : ''; S.smpte = Object.assign({ rate: '30', start: '00:00:00:00' }, d.smpte); S.look = null
  /* the view comes back as it was left; in a project from before this room (rows were twice as tall, the dock was always there) only its zoom along the song does */
  const vw = d.view || {}, now = d.v >= 3
  if (now && vw.panel) { S.panel.on = !!vw.panel.on; S.panel.tab = vw.panel.tab === 'mixer' ? 'mixer' : 'patch'; S.panel.h = vw.panel.h || 316 }
  if (now && !PROJ.test) S.slur = !!vw.slur
  setView(true)
  PXB = clamp(vw.pxb || fitPXB(), fitPXB(), maxPXB()); VX = clamp(vw.vx || 0, 0, maxVX()); S.rh = now ? clamp(vw.rh || 25, 20, 120) : 25; S.wz = now ? clamp(vw.wz || 1, 1, 1024) : 1; VY = clamp(now ? vw.vy || 0 : 0, 0, maxVY())
  normalizeOrder(); repaint()
  resync(); pushTransport(); pushMaster(); pushClick(); applyAll()
  /* on the screen now, whole but for its sounds; they are asked for at once, and come beside the plug-ins */
  closeStart(); dirtyAll(); refreshPool(); setTitle(); flush()
  await openingShown()
  OPENING.drawnAt = performance.now()
  const c = OPENING.count, came = soundsRead(key, names, done => { c.sd = done; openingTell() })
  openingTell()
  LOAD.left = []
  let plugN = 0
  for (let i = 0; i < d.tracks.length; i++) for (const ins of d.tracks[i].inserts || []) {
    const t = byId(d.tracks[i].id)
    if (gen !== SOUNDS.gen) return true
    if (!t) continue
    delete ins.out                                                                     // (written as left out by an older version — it did not open on another Mac: tried again here)
    if (!ins.out) { c.pd = plugN++; c.what = ins.name; openingTell() }
    const kept = { uid: 0, name: ins.name || 'plug-in', fmt: ins.fmt || '', id: ins.id, state: ins.state || '', off: !!ins.off, key: ins.key || 0, n: ins.n || 0, pn: ins.pn || null, out: true }
    if (ins.out || LOAD.bare || DISTRUST.has(ins.id)) { t.inserts.push(kept); if (!ins.out) LOAD.left.push(kept.name); continue }
    const rr = await NAT.call('insert', { track: t.id, id: ins.id, state: ins.state || '', show: 0 })
    if (rr && rr.ok) { const got = { uid: rr.uid, name: rr.name, fmt: rr.fmt, id: ins.id, state: ins.state || '', off: !!ins.off, key: ins.key || 0, n: ins.n || 0, pn: ins.pn || null, sc: !!rr.key }; t.inserts.push(got); if (ins.off) NAT.call('bypass', { track: t.id, uid: rr.uid, off: 1 }); keyTold(t, got) }
    else { t.inserts.push(kept); LOAD.left.push(kept.name) }                              // it would not open: its place and its settings stay in the song
  }
  if (typeof refLoad === 'function') refLoad(d.ref)                                    // (reference.js: the reference row; its sound comes on its own)
  if (typeof wallOutLoad === 'function') await wallOutLoad(d.out, name => { c.pd = plugN++; c.what = name; openingTell() })      // (wall.js: the stereo out's own wall and plug-ins)
  if (gen !== SOUNDS.gen) return true
  c.pd = c.pn; openingTell()
  const plugged = performance.now()
  /* the song is whole from here (what its sounds bring changes nothing of what is written): it may be saved */
  PROJ.last = json ? '' : serialize(); PROJ.saved = !json; PROJ.savedAt = ''; PROJ.savedMs = r.saved || 0
  rememberProj()
  free()
  await came
  if (gen !== SOUNDS.gen) return true
  const heard = performance.now()
  clearTimeout(SOUNDS.settle); soundsSettle()
  await rewarpAll()
  dirtyAll(); refreshPool()
  const sec = (a, b) => `${((b - a) / 1000).toFixed(1)} s`
  OPENING.took = [`drawn in ${sec(t0, OPENING.drawnAt)}`, `plug-ins ${c.pn} in ${sec(OPENING.drawnAt, plugged)}`, `sounds ${c.sn} in ${sec(OPENING.drawnAt, heard)} (beside the plug-ins)`, `getting ready in ${sec(heard, performance.now())}`]
  return true
}
/* the device moved to another rate: every sound has to come again at it */
async function reloadAudio () {
  soundsStop()
  const files = await loadFiles(projKey(), S.tracks)
  const old = new Set(NAT.keys)
  for (const f of files.values()) if (f && f.key) old.delete(f.key)
  for (const t of S.tracks.flatMap(lanesOf)) for (const r of t.regs) { if (r.loop) { r.wkey = null; r.wsig = ''; continue } const f = r.file ? files.get(r.file) : null; if (f && f.ok) { soundOn(r, f); r.wkey = null; r.wsig = ''; r.wpeaks = null } else if (r.wait) soundOn(r, f) }
  WARPS.clear(); LIVEW.clear(); forgetTransients()
  resync()
  for (const key of old) { NAT.call('dropBuffer', { key }); NAT.keys.delete(key) }                  // what was decoded at the old rate
  await rewarpAll()
}
async function newProject () {
  if (!NAT) return
  const ans = typeof leaveFirst === 'function' ? await leaveFirst() : 'same'              // (the song that is open is closed: asked first, as on quitting — doors.js)
  if (ans === 'cancel') return
  if (ans === 'dont') await leavePutBack(); else if (!(await saveNow(true, ans === 'save')) && ans === 'save') { say('the song could not be written'); return }
  PROJ.hold++
  try { await newProjectNow() } finally { PROJ.hold-- }
}
async function newProjectNow () {
  soundsStop()
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
  S.tracks = [t]; S.sel = 0; S.cycle = { on: false, a: 0, b: 4 }; S.pos = 0; S.master = 0; S.auto = false; S.flex = false; S.key = ''; S.smpte = { rate: '30', start: '00:00:00:00' }; S.look = null; S.rh = 25; S.wz = 1; PXB = (X1 - X0) / 24; VX = 0; VY = 0          // a new song opens on its first twenty-four bars
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
/* another project opened: the one that is open is closed first — asked, as on quitting, when it is not as it was last
   saved (doors.js); answered, the card is up at once, and saving it is the card's first part */
async function openProject (key) {
  if (key === projKey() && !START.on) return                                             // (while the start page is up no project is open, whatever the song standing in is called)
  const ans = typeof leaveFirst === 'function' && !START.on ? await leaveFirst() : 'same'
  if (ans === 'cancel') return
  const save = !START.on && ans !== 'dont'
  const n = openingBegin(projNameOf(key), save ? [['saving', 1], ['reading', 1]] : [['reading', 1]])
  await openingShown()
  let ok = false
  try {
    if (save) { openingAt(0, 0); if (!(await saveNow(true, ans === 'save')) && ans === 'save') { say('the song could not be written'); return } }
    else if (ans === 'dont') await leavePutBack()
    ok = await loadProject(key)
  } finally { openingEnd(ok, n) }
  if (n !== OPENING.n) return                                                          // (another project was opened while this one's sounds were still coming)
  if (!ok) say('that project would not open'); else await takesBack()
}
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
  if (!r || !r.ok || !(await loadProject(projKey(), natText(r.json64)))) { say('that copy would not open'); return }
  await saveNow(false, true)
  say(`back to ${whenText(when)}`)
}
/* called once the engine has the demo: come back to where the last sitting left off */
async function projectBoot (hello) {
  if (!NAT) return
  PROJ.test = !!(hello && hello.selftest)
  CAP.mp3 = !!(hello && hello.mp3); CAP.lame = (hello && hello.lame) || ''          // (lame: where the program that makes an mp3 lies — inside the app, unless this build has none)
  if (hello && hello.ins) INPUTS = hello.ins
  NAT.on('dawDevice', d => { if (!d) return; if (d.ins) INPUTS = d.ins; if (d.block) STAT.buf = d.block; if (d.bits) STAT.bits = d.bits; uiDirty('cmd', 'dock') })
  NAT.on('dawMenu', d => { if (typeof menuDo === 'function') { menuDo(d && d.id); return } if (START.on) { startMenu(d && d.id); return } const f = d && MENU_DO[d.id]; if (f) f() })
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
  /* every three seconds, if anything has changed (TOUCHED: counted whenever something is drawn again); plug-ins are asked for
     their settings about once a minute, never while the song runs, and then only those that have changed (every fifth
     time all of them) — so a song left alone writes nothing and asks nothing (his ask, 2026-10-21) */
  setInterval(() => {
    if (drag) return
    const tick = ++PROJ.ticks, full = tick % 20 === 0 && !S.playing && S.tracks.some(t => (t.inserts || []).length)
    if (!full && TOUCHED === PROJ.seen) return
    const t0 = TOUCHED
    saveProject(full, false, full && tick % 100 !== 0).then(ok => { if (ok) PROJ.seen = t0 })
  }, 3000)
  NAT.on('dawQuit', () => { if (typeof quitAsked === 'function') quitAsked(); else saveNow(true).then(() => NAT.call('quit'), () => NAT.call('quit')) })      // (doors.js: it asks first when the song is not as it was last saved)
}
/* the menu bar's File: each line does what its key does */
const MENU_DO = {
  keys: () => toggleSheet(), revert: () => openRevertMenu(),
  timecut: () => KEYS['⌃⌘KeyX'](), timeroom: () => KEYS['⌃⌘KeyZ'](), timeput: () => KEYS['⌃⌘KeyV'](), timerepeat: () => KEYS['⌃⌘KeyR'](),
  fades: () => act.fades(), strip: () => act.strip(), groupregs: () => act.groupRegs(), ungroupregs: () => act.ungroupRegs(), tempofrom: () => act.tempoFrom(), fittempo: () => act.fitTempo(),
  grouptracks: () => (typeof grpMake === 'function' ? grpMake() : groupTracks()), groupsoff: () => KEYS['⇧KeyG'](),
  newtracks: () => openNewTrack(), newaudio: () => newTrack('audio'), newbus: () => newTrack('bus'), duptrack: () => duplicateTrack(S.sel), deltrack: () => deleteTracks(chosen()), renametrack: () => startRename('track', S.sel),
  new: () => newProject(), open: () => openProjectAsk(), recent: () => openProjectMenu(), save: () => KEYS['⌘KeyS'](), saveas: () => saveAsAsk(), rename: () => startRename('proj'),
  import: () => importAudio(), handoff: () => KEYS['⌘KeyB'](), audio: () => NAT.call('audioSettings'),
  winpatch: () => togglePanel('patch'), winmixer: () => togglePanel('mixer'), winslur: () => toggleSlur(),      // (Window: the panels and slur)
}
