/* ── inside the app the sound is the app's: the same hands, another engine ──
   Everything here replaces a function of the browser engine (engine.js) with
   one that tells the native engine instead. Loaded last, before boot. */
if (NAT) {
  const N = window.__nat = { pos: 0, at: 0, playing: false, jumps: -1, ready: false, armed: false, armedAt: 0 }
  const b64 = u8 => { let s = ''; const CH = 0x8000; for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH)); return btoa(s) }
  /* the demo song is still made by the page; the app gets each loop once, as 16-bit samples */
  const sendLoops = async () => {
    const mine = LOOPS
    for (const k in mine) {
      if (LOOPS !== mine) return                                                        // (the tempo has moved on meanwhile: whoever moved it sends the loops of now, and these must not land after them)
      const lp = mine[k], ch = lp.ch.length, i16 = new Int16Array(lp.n * ch)
      for (let c = 0; c < ch; c++) { const a = lp.ch[c]; for (let i = 0; i < lp.n; i++) { const v = a[i] < -1 ? -1 : a[i] > 1 ? 1 : a[i]; i16[i * ch + c] = v < 0 ? v * 32768 : v * 32767 } }
      await NAT.call('buffer', { key: k, ch, frames: lp.n, pcm: b64(new Uint8Array(i16.buffer)) })
    }
  }
  /* a track is given its room (the patch engine) only once it could need one: a print turned up at either end of its scene hand, or a line drawn for one */
  const patched = t => ['A', 'B'].some(k => t.patch[k].tape + t.patch[k].space + t.patch[k].delay > 0) || ['tape', 'space', 'delay'].some(k => autoPts(t, k).length > 0)
  const trackMsg = t => { const p = patchNow(t); return { id: t.id, vol: dbLin(t.vol), on: audible(t) ? 1 : 0, pan: t.pan || 0, tape: p.tape / 100, space: p.space / 100, delay: p.delay / 100, share: p.share / 100, patched: patched(t) ? 1 : 0, mon: t.mon ? 1 : 0, live: liveOn(t) ? 1 : 0, input: t.inp || 0, sends: (t.sends || []).map(s => ({ to: s.to, gain: dbLin(s.db) })) } }
  const regMsg = r => { const w = r.wkey && LIVEW.has(r.wkey) ? r.wkey : null; return regMsgOf(r, w) }       // a rendering that was let go: the plain file plays until it is rendered again
  const regMsgOf = (r, w) => ({ a: r.a - 1, b: r.b - 1, buf: w || (r.loop ? r.buf : r.key), loop: r.loop ? 1 : 0, rate: w ? 1 : (r.rate || 1), bars: r.loop ? LOOPS[r.buf].bars : 1, off: r.off || 0, gain: dbLin(r.gain || 0), fi: r.fi || 0, fo: r.fo || 0, fic: r.fic || 0, foc: r.foc || 0 })
  /* The engine is told the whole session, but of each track only what is new to it: a track's regions, lines and wiring are
     written down as they were last sent (`_told`), numbered (`_ver`), and a track whose writing has not changed goes as
     its levels and the word `same`. The engine answers `again` when it does not hold a track in the telling the page
     thinks it does (it had let the session go, or was printing when the last one came): then everything is sent once more.
     only: when given, the regions for which it is true are the ones that sound (a bounce in place) */
  let telling = 0
  const sendSession = async only => {
    const mine = ++telling
    const tracks = S.tracks.map(t => {
      const wired = { kind: t.kind === 'audio' ? 0 : 1, out: destId(t), autos: autoMsg(t), regs: t.kind === 'audio' ? t.regs.filter(r => !r.mute && !r.notes && (!only || only(r))).map(regMsg) : [] }
      Object.assign(wired, noteMsg(t, only))                                           // a track of notes: what it plays, as it sounds
      const text = JSON.stringify(wired) + '|' + (t.sends || []).map(s => s.to).join()
      if (!only && t._told === text) return Object.assign(trackMsg(t), { same: 1, ver: t._ver })
      t._ver = (t._ver || 0) + 1; t._told = only ? null : text                             // (what is sent for a bounce in place is not what the track holds: it is sent again afterwards)
      return Object.assign(trackMsg(t), wired, { ver: t._ver })
    })
    const r = await NAT.call('session', { tempo: S.tempo, meter: S.meter, end: SONG_END, master: dbLin(S.master), tracks })
    if (!r || !r.ok || r.again) { for (const t of S.tracks) t._told = null; if (r && r.again && mine === telling && !only) return sendSession() }      // not taken, or not held as thought: nothing counts as told
    return r
  }

  ensureAudio = () => null
  birth = () => {}
  applyAll = () => { for (const t of S.tracks) NAT.call('track', trackMsg(t)) }
  pushTrack = t => { NAT.call('track', trackMsg(t)) }
  pushTransport = () => { NAT.call('loop', { on: S.cycle.on ? 1 : 0, a: S.cycle.a, b: S.cycle.b }) }
  pushQueue = () => { NAT.call('queue', { bar: S.queued == null || !SCENES[S.queued] ? -1 : SCENES[S.queued].a - 1 }) }
  pushMaster = () => { NAT.call('master', { gain: dbLin(S.master) }) }
  pushClick = () => { NAT.call('click', { on: S.click ? 1 : 0 }) }
  curPos = () => { if (!N.playing) return S.pos; const p = N.pos + (performance.now() - N.at) / 1000 / SPB(); return S.rec ? Math.max(0, p) : clamp(p, 0, SONG_END) }
  natRolling = bar => { S.playing = true; N.playing = true; N.armed = false; N.armedAt = performance.now(); N.pos = bar; N.at = performance.now() }
  natStopped = pos => { S.playing = false; N.playing = false; S.queued = null; S.pos = clamp(pos, 0, SONG_END) }
  play = from => {
    if (S.playing) return
    startBar(from)
    natRolling(S.pos)
    NAT.call('play', { bar: S.pos, loop: S.cycle.on ? 1 : 0, a: S.cycle.a, b: S.cycle.b })
  }
  halt = rewind => {
    if (S.rec) { stopRecord(true); return }
    if (S.playing) { natStopped(curPos()); NAT.call('stop', {}) }
    else if (rewind) S.pos = restBar()
  }
  jumpTo = bar => {
    bar = clamp(bar, 0, SONG_END)
    if (!S.playing) { S.pos = bar; return }
    if (S.rec) return
    N.pos = bar; N.at = performance.now()
    NAT.call('seek', { bar })
  }
  resync = () => { sendSession() }
  natSession = only => sendSession(only)
  setTempo = bpm => {
    const was = S.playing && !S.rec, p = curPos(), was0 = S.tempo
    if (S.rec) return
    if (was) halt(false)
    tempoStep()
    S.tempo = bpm
    LOOPS = songLoops(bpm)
    const follow = settleAfter(() => retime(was0, bpm)); liveSelX()                                              // files keep their length in seconds: where one now runs into the next, the later one is heard
    S.pos = Math.min(p, SONG_END)
    for (const t of S.tracks) for (const r of t.regs) if (r.loop && r.wkey) { r.wkey = null; r.wsig = '' }       // the loops are new: what was rendered from them is not theirs any more
    WARPS.clear()
    sendLoops().then(sendSession).then(() => rewarp(S.tracks.flatMap(t => t.regs).filter(r => r.loop || follow.includes(r)))).then(() => { if (was) { play(S.pos); uiDirty('top') } })
    growSong(); uiDirty(...EVERY)
  }
  tempoBack = bpm => {                                                                  // (undo, redo: the engine gets the loops of that tempo, then the song once more, and what is rendered from loops is rendered from these)
    S.tempo = bpm
    LOOPS = songLoops(bpm)
    const stale = () => { for (const t of S.tracks) for (const L of lanesOf(t)) for (const r of L.regs) if (r.loop && r.wkey) { r.wkey = null; r.wsig = '' } WARPS.clear() }
    stale()
    return sendLoops().then(() => { stale(); return sendSession() }).then(() => rewarp(S.tracks.flatMap(t => t.regs).filter(r => r.loop)))
  }
  /* a file let go on the page is kept in the project's own folder: it goes over in pieces of three megabytes */
  let putId = 0
  decodeFile = async f => {
    const id = `put${++putId}`, CH = 3 << 20
    let r = null
    for (let off = 0; off < Math.max(1, f.size); off += CH) r = await NAT.call('audioPut', { id, project: projKey(), name: f.name, data: b64(new Uint8Array(await f.slice(off, off + CH).arrayBuffer())), last: off + CH >= f.size ? 1 : 0 })
    if (!r || !r.ok) throw new Error('decode')
    return { key: r.key, sec: r.sec, peaks: r.peaks, file: r.file, tone: r.tone }
  }
  /* hand off: the app prints the stems (each track through its patch and its plug-ins) or the mix, and shows the folder */
  sendStems = async () => {
    const ho = S.ho
    if (ho.state === 'busy' || S.rec) return
    const pl = hoPlan(), f = hoFmt()
    if (!pl.mix && !pl.list.length) { ho.note = 'nothing sounds in this range'; uiDirty('hand'); return }
    if (S.playing) { halt(false); uiDirty('top') }
    ho.state = 'busy'; ho.done = 0; ho.total = pl.mix ? 1 : pl.list.length * pl.modes.length; ho.note = ''; uiDirty('hand')
    const r = await NAT.call('bounce', {
      kind: pl.mix ? 'mix' : 'stems', a0: pl.a0, a1: pl.a1, modes: pl.modes.map(m => m === 'dry' ? 'dry' : 'wet'),
      tracks: pl.list.map(t => ({ id: t.id, name: `${String(S.tracks.indexOf(t) + 1).padStart(2, '0')} ${t.name}` })),
      folder: `${PROJ.name} ${pl.name} ${pl.mix ? 'mix' : 'stems'}`, name: `${PROJ.name} ${pl.name}`, fmt: f.fmt, rate: f.rate, bits: f.bits,
    })
    ho.state = 'idle'
    if (r && r.ok) { ho.done = ho.total; ho.note = 'saved in music, slur studio'; handOffExtras(r.dir, `${PROJ.name} ${pl.name}`, pl.a0, pl.a1); handOffRest(r.dir) } else { ho.done = 0; ho.note = r && r.error ? String(r.error) : 'could not render' }
    resync(); applyAll()
    uiDirty('hand')
  }
  NAT.on('dawBounce', d => { if (S.ho.state === 'busy') { S.ho.done = d.done; uiDirty('hand') } })
  /* a file longer than twenty minutes that the disk has no room to keep ready: only its beginning is held, and that is said */
  NAT.on('dawCut', d => { if (d && d.name) say(`only the first ${Math.round(d.held / 60)} of ${Math.round(d.whole / 60)} minutes of ${String(d.name).toLowerCase().slice(0, 28)} are held${d.disk ? ': the disk has no room for the rest' : ''}`) })
  NAT.on('dawTick', d => {
    if (d.c != null) { const now = performance.now(); if (now - (STAT.at || 0) > 600) { STAT.at = now; const v = Math.round(d.c * 100) / 100; if (v !== STAT.cpu) { STAT.cpu = v; uiDirty('cmd') } } }      // how hard the machine works, read about twice a second
    if (d.m) { const m = d.m; METERS.m[0] = Math.max(METERS.m[0], m.m[0]); METERS.m[1] = Math.max(METERS.m[1], m.m[1]); METERS.i = Math.max(METERS.i, m.i); for (let k = 0; k + 1 < m.t.length; k += 2) if (m.t[k + 1] > (METERS.t.get(m.t[k]) || 0)) METERS.t.set(m.t[k], m.t[k + 1]) }
    if (d.j !== N.jumps) { if (N.jumps !== -1 && S.queued != null) { S.queued = null; uiDirty('scenes') } N.jumps = d.j }
    if (!S.playing) return
    if (d.on) { N.armed = true; N.pos = d.p; N.at = performance.now() }
    else if (!S.rec && (N.armed || performance.now() - N.armedAt > 1500)) { natStopped(d.p); uiDirty('top', 'scenes') }   // the song ran out
  })
  /* the device moved to another rate and the app followed: make the demo's loops again, and bring every file back at the new rate */
  NAT.on('dawTakeStalled', d => { if (S.rec) { stopRecord(true); say(d && d.rate ? 'the device went to another rate: the take ends here' : 'the audio device stopped: the take ends here') } })      // (nothing more of it comes in: it is kept as far as it got)
  NAT.on('dawRate', async d => {
    if (!d || !d.sr || d.sr === SND_SR) return
    SND_SR = d.sr
    natStopped(S.pos)
    LOOPS = songLoops(S.tempo)
    await sendLoops()
    await reloadAudio()
    say(`now at ${+(d.sr / 1000).toFixed(1)}k`)
    uiDirty(...EVERY)
  })
  natSendLoops = sendLoops
  /* the loops go over first; the session follows once it is known which song is opening (projectBoot) */
  natInit = async () => { await sendLoops(); pushClick() }
  natReady = async () => { N.ready = true; NAT.call('log', { text: `ready: ${PROJ.name}, ${S.tracks.length} tracks at ${SND_SR} hz` }) }
}
