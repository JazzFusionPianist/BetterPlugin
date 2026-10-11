/* Tracks of notes against the page's own code, in Node: what a region of notes sounds like (its grid, its swing, its end),
   what the edits that work on any region do to one (cut, join, trim, copy, the tempo, the measure), a take of notes laid
   on a part, a standard file out and in again, a project written and read.
   Run by ../fuzz.cjs (alone: node test/fuzz/load.cjs notes). */
(async () => {
  let bad = 0
  const ok = (what, pass, got) => { if (!pass) bad++; console.log((pass ? 'ok   ' : 'FAIL ') + what + (pass ? '' : '  ' + JSON.stringify(got))) }
  const T0 = S.tempo, M0 = S.meter.slice(), st0 = editState()
  const fresh = () => {
    if (S.meter[0] !== M0[0] || S.meter[1] !== M0[1]) S.meter = M0.slice()
    if (S.tempo !== T0) S.tempo = T0
    LOOPS = songLoops(T0)
    restoreEdit(st0); UNDO.length = 0; REDO.length = 0
    S.selR = []; S.selX = null; S.marq = null; S.focus = 'lanes'; CLIP = []; TIME_CLIP = null; setMode('smart'); S.tool = 'pointer'; S.grpOff = false; S.pos = 0; S.rh = 40; PXB = 24; VX = 0
    S.sel = trki('kick'); S.selT = []; S.q = 1 / 16
  }
  const near = (x, y, e = 1e-6) => Math.abs(x - y) < e
  const r4 = v => +v.toFixed(4)
  /* a track of notes with one region from bar a to b (counted from one) holding notes [t, d, key, how hard] in quarter notes */
  const keys = (name = 'e piano') => { const made = newTracks({ kind: 'midi', inst: 'synth', n: 1, out: 0 }); made[0].name = name; return made[0] }
  const part = (t, a, b, list) => { const r = mkReg({ a, b, loop: false, notes: list.map(([tt, d, n, v]) => mkNote(tt, d, n, v == null ? 100 : v)) }); t.regs.push(r); return r }
  const snd = r => regSound(r).map(x => [r4(x.a), r4(x.b), x.n, x.v])
  const flat = t => { const f = trackSound(t), out = []; for (let k = 0; k < f.length; k += 4) out.push([r4(f[k]), r4(f[k + 1]), f[k + 2], f[k + 3]]); return out }
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

  //── a track of notes is a track that sounds, with an instrument ──
  { fresh(); const n0 = S.tracks.length, t = keys()
    ok('a new track of notes: one more track, of the kind that sounds, with the synth at its head, chosen', S.tracks.length === n0 + 1 && t.kind === 'audio' && isInst(t) && t.inst.kind === 'synth' && t.inst.sound === 'e piano' && S.tracks[S.sel] === t, [t.kind, t.inst])
    repaint()
    ok('its regions take the outline of notes', t.outline === 'notes', t.outline)
    ok('it hears the keys while it is chosen, and no other track does', liveOn(t) && S.tracks.filter(liveOn).length === 1)
    leadTrack(trki('kick'))
    ok('chosen no longer, it does not; armed, it does again', !liveOn(t) && (t.arm = true) && liveOn(t))
    KEYS['⌘KeyZ']()
    ok('undone, the track is gone', S.tracks.length === n0)
    const d = newTracks({ kind: 'midi', inst: 'drums', n: 2, out: 0 })
    ok('two kits made at once are named apart', d.length === 2 && d[0].name === 'drums' && d[1].name === 'drums 2' && d[0].inst.kind === 'drums', d.map(x => x.name)) }

  //── what a region of notes sounds like ──
  { fresh(); const t = keys(), r = part(t, 5, 7, [[0, 1, 60], [1, .5, 64, 80], [4, 2, 67], [7.5, 2, 72], [9, 1, 76]])
    ok('notes sound where they stand: a quarter note is a quarter of a bar in four-four', same(snd(r), [[4, 4.25, 60, 100], [4.25, 4.375, 64, 80], [5, 5.5, 67, 100], [5.875, 6, 72, 100]]), snd(r))
    ok('a note that begins inside the region is cut where the region ends; one that begins after it is not heard', snd(r).length === 4 && near(regSound(r)[3].b, 6))
    r.tr = 12; r.vel = -30
    ok('the region moves its notes up and plays them softer without touching them', same(snd(r).map(x => [x[2], x[3]]), [[72, 70], [76, 50], [79, 70], [84, 70]]) && r.notes[0].n === 60 && r.notes[0].v === 100, snd(r))
    r.tr = 0; r.vel = 0; r.gain = -5
    ok('its gain is how hard they are played', regSound(r)[0].v === 80, regSound(r)[0].v)
    r.gain = 0; r.mute = true
    ok('a silent region plays nothing', flat(t).length === 0)
    r.mute = false }
  { fresh(); const t = keys(), r = part(t, 1, 3, [[.07, .5, 60], [.4, .5, 62], [.62, .25, 64], [1.02, .25, 65], [1.3, .2, 67]])
    S.selR = [r.id]; S.q = 1 / 16; KEYS.KeyQ()
    ok('q pulls the notes to the grid — in the region\'s keeping: the notes are where they were played', same(snd(r).map(x => x[0]), [0, .125, .125, .25, .3125]) && near(r.notes[0].t, .07) && r.q === .25, [snd(r).map(x => x[0]), r.q])
    r.qs = .5
    ok('half the way', near(regSound(r)[0].a, .07 / 4 / 2) && near(regSound(r)[1].a, (.4 + .5) / 2 / 4), regSound(r).slice(0, 2).map(x => x.a))
    r.qs = 1; r.sw = 1
    ok('with swing the off-beats of the grid lie a third later, the beats where they were', near(regSound(r)[0].a, 0) && near(regSound(r).find(x => x.n === 67).a, (1.25 + .25 / 3) / 4), regSound(r).map(x => r4(x.a)))
    KEYS['⌘KeyZ']()
    ok('undone, they sound as played again', !r.q || near(regSound(regOf(r.id)[0]).find(x => x.n === 60).a, .07 / 4), regOf(r.id)[0].q)
    S.selR = [r.id]; KEYS.KeyQ(); KEYS['⌥⌘KeyQ']()
    ok('and option-command-q gives them back at any time', !regOf(r.id)[0].q) }
  { fresh(); const t = keys(), r = part(t, 3, 7, [[0, 1, 60], [1, 1, 62], [2, 1, 64], [3, 1, 65]])
    r.rep = 4
    ok('a region told to say its first bar over says it to its end', snd(r).length === 16 && same(snd(r)[4], [3, 3.25, 60, 100]) && same(snd(r)[15], [5.75, 6, 65, 100]), snd(r).length)
    delete r.rep; delete r._ns }
  { fresh(); const t = keys(), A = part(t, 1, 2, [[0, 6, 60], [2, 1, 64]]), B = part(t, 2, 3, [[0, 1, 60], [0, 1, 64]])
    const f = flat(t)
    ok('of two notes on one key the earlier ends where the later begins', f.length === 4 && same(f.filter(x => x[2] === 60), [[0, 1, 60, 100], [1, 1.25, 60, 100]]), f)
    part(t, 5, 6, [[0, 1, 60], [0, 1, 60], [.5, 1, 60]])
    const g = flat(t).filter(x => x[0] >= 4)
    ok('and two that begin on one key at once are one', g.length === 2 && near(g[0][1], 4.125), g) }
  { fresh(); const t = keys(), r = part(t, 5, 6, [[0, 1, 60]])
    r.ctl = [{ id: 1, t: 0, c: 64, v: 127 }, { id: 2, t: 2, c: 128, v: 12000 }, { id: 3, t: 9, c: 1, v: 5 }]
    ok('what is turned goes with the notes: a pedal, a bend (two bytes), nothing from past the region\'s end', same(trackCtl(t), [4, 0xB0, 64, 127, 4.5, 0xE0, 12000 & 127, 12000 >> 7]), trackCtl(t))
    ok('the engine is told it is a track of notes, with both', (() => { const m = noteMsg(t); return m.inst === 1 && m.notes.length === 4 && m.ctl.length === 8 })() && same(noteMsg(trk('kick')), {})) }

  //── the edits that work on any region ──
  { fresh(); const t = keys(), r = part(t, 5, 9, [[0, 1, 60], [4, 1, 62], [8, 1, 64], [12, 3, 65], [15, 2, 67]])
    const before = flat(t)
    S.selR = [r.id]; S.pos = 6.5; KEYS['⌘KeyT']()
    const ps = t.regs.slice().sort((x, y) => x.a - y.a)
    ok('cut in two, the pieces hold the same notes and each plays its own stretch', ps.length === 2 && ps[0].notes === ps[1].notes && near(ps[1].off, 2.5) && snd(ps[0]).length === 3 && snd(ps[1]).length === 2, ps.map(p => [p.a, p.b, p.off, snd(p).length]))
    ok('a note that runs over the cut ends at it — nothing else is heard differently', same(flat(t).map(x => [x[0], x[2]]), before.map(x => [x[0], x[2]])) && near(flat(t)[2][1], 6.25), flat(t))
    S.selR = ps.map(p => p.id); KEYS['⌘KeyJ']()
    ok('joined, they are one region again, sounding what it sounded', t.regs.length === 1 && same(flat(t), before), [t.regs.length, flat(t)])
    hPress(hAt(t.name, 7, .5, 0)); hUp()
    S.tool = 'scissors'; hPress(hAt(t.name, 7, .5, 0)); hUp(); S.tool = 'pointer'
    const qs = t.regs.slice().sort((x, y) => x.a - y.a)
    setNotes(qs[1], qs[1].notes.concat([mkNote(9, 1, 72, 90)]))
    S.selR = qs.map(p => p.id); KEYS['⌘KeyJ']()
    const j = t.regs[0]
    ok('two regions that hold different notes are made one by joining: every note that sounded, and no other', t.regs.length === 1 && near(j.a, 5) && near(j.b, 9) && flat(t).length === 6 && flat(t).some(x => x[2] === 72 && near(x[0], 6.25)), [t.regs.length, flat(t)])
    ok('with no crossfade between regions of notes, and no fade on one', !j.fi && !j.fo) }
  { fresh(); const t = keys(), r = part(t, 9, 11, [[0, 1, 60], [4, 1, 62]])
    S.tool = 'pointer'; S.mode = 'grid'
    hDrag(hAt(t.name, 9, .5, 1), hAt(t.name, 7, .5, 1))
    ok('its beginning pulled to the left of where it was made: the region is longer, the notes where they were', near(r.a, 7) && near(r.off, -2) && same(snd(r).map(x => x[0]), [8, 9]), [r.a, r.off, snd(r)])
    hDrag(hAt(t.name, 11, .5, -1), hAt(t.name, 14, .5, -1))
    ok('its end pulled out as far as wanted (nothing to run out of)', near(r.b, 14), r.b)
    hDrag(hAt(t.name, 10, .6, 0), hAt('kick', 10, .6, 0))
    ok('it cannot be pulled onto a track of sound', regOf(r.id)[1] === t)
    const k = reg('kick', 5); hDrag(hAt('kick', 6, .6, 0), hAt(t.name, 6, .6, 0))
    ok('nor a region of sound onto a track of notes', regOf(k.id)[1] === trk('kick'))
    setMode('smart')
    function reg (n, a) { return trk(n).regs.find(q => near(q.a, a)) } }
  { fresh(); const t = keys(), u = keys('other'), r = part(t, 5, 6, [[0, 1, 60]])
    S.selR = [r.id]; KEYS['⌘KeyC'](); leadTrack(S.tracks.indexOf(u)); S.pos = 8; KEYS['⌘KeyV']()
    ok('copied to another track of notes', u.regs.length === 1 && u.regs[0].notes === r.notes && near(u.regs[0].a, 9), u.regs.map(x => x.a))
    leadTrack(trki('kick')); const n0 = trk('kick').regs.length; S.pos = 1; KEYS['⌘KeyV']()
    ok('but not onto a track of sound', trk('kick').regs.length === n0)
    S.selR = [r.id]; KEYS['⌘KeyR']()
    ok('said again, the copy holds the same notes', t.regs.length === 2 && t.regs.every(x => x.notes === r.notes)) }
  { fresh(); const t = keys(), r = part(t, 5, 7, [[0, 1, 60], [6, 1, 62]]), was = snd(r)
    setTempo(120)
    ok('the tempo moves: a region of notes keeps its bars, and its notes their beats', near(r.a, 5) && near(r.b, 7) && same(snd(r), was), [r.a, r.b, snd(r)])
    KEYS['⌘KeyZ']()
    const secs = regSound(regOf(r.id)[0]).map(x => x.a * SPB())
    setMeter(3, 4)
    const q = regOf(r.id)[0]
    ok('the measure changes: every note sounds at the second it sounded at', same(regSound(q).map(x => r4(x.a * SPB())), secs.map(r4)) && near(q.a, 1 + 4 * 4 / 3), [regSound(q).map(x => x.a * SPB()), secs, q.a])
    setMeter(4, 4) }
  { fresh(); const t = keys()
    S.tool = 'pencil'; S.mode = 'grid'; hPress(hAt(t.name, 13, .5, 2)); hUp(); S.tool = 'pointer'; setMode('smart')
    ok('the pencil draws a region with nothing in it yet', t.regs.length === 1 && Array.isArray(t.regs[0].notes) && t.regs[0].notes.length === 0 && near(t.regs[0].a, 13), t.regs.map(x => [x.a, x.b, x.notes]))
    S.selR = [t.regs[0].id]; KEYS['⌥ArrowUp'](); KEYS.KeyF(); KEYS['⌃⇧KeyR'](); KEYS['⌃KeyF']()
    ok('what is only for sound leaves a region of notes alone: no fade, not turned round, not stretched', !t.regs[0].fi && !t.regs[0].fo && !t.regs[0].rev && !t.regs[0].fx && t.regs[0].tr === 1, [t.regs[0].fi, t.regs[0].rev, t.regs[0].fx, t.regs[0].tr]) }

  //── a take of notes ──
  { fresh(); const t = keys()
    const ev = [4, 0x90, 60, 100, 4.25, 0x80, 60, 0, 4.25, 0x90, 64, 90, 4.5, 0x90, 67, 80, 4.75, 0x80, 64, 0, 5.1, 0xB0, 64, 127, 5.2, 0x90, 72, 70]
    const put = placeTakes([{ ok: true, midi: true, track: t.id, bar: 4, ev }], 4, 5.6)
    const r = t.regs[0]
    ok('what was played becomes notes where it was played, in one region from where the take began to the bar line after it ended', put.length === 1 && t.regs.length === 1 && near(r.a, 5) && near(r.b, 7) && same(snd(r), [[4, 4.25, 60, 100], [4.25, 4.75, 64, 90], [4.5, 5.6, 67, 80], [5.2, 5.6, 72, 70]]), [r && [r.a, r.b], r && snd(r)])
    ok('a key still down when the take ended ends there; the pedal is kept', r.ctl.length === 1 && r.ctl[0].c === 64 && near(r.ctl[0].t, 1.1 * 4))
    placeTakes([{ ok: true, midi: true, track: t.id, bar: 4, ev: [4.5, 0x90, 48, 100, 5, 0x80, 48, 0] }], 4, 5.2)
    ok('played over a part, a take adds to it: the part is still one region and nothing in it is lost', t.regs.length === 1 && t.regs[0] === r && snd(r).length === 5 && snd(r).some(x => x[2] === 48), [t.regs.length, snd(t.regs[0])])
    placeTakes([{ ok: true, midi: true, track: t.id, bar: 5, ev: [5.5, 0x90, 50, 100, 8.2, 0x80, 50, 0] }], 5, 8.3)
    const m = t.regs[0]
    ok('a take that reaches past the part makes it longer, with everything that sounded', t.regs.length === 1 && near(m.a, 5) && near(m.b, 10) && snd(m).length === 6, [t.regs.map(x => [x.a, x.b]), snd(m).length])
    ok('a take with nothing in it leaves nothing, and no step to undo', (() => { const u = UNDO.length; const p = placeTakes([{ ok: true, midi: true, track: t.id, bar: 12, ev: [] }], 12, 13); return p.length === 0 && UNDO.length === u })())
    KEYS['⌘KeyZ'](); KEYS['⌘KeyZ']()
    ok('each take is one step back', trk(t.name).regs.length === 1 && snd(trk(t.name).regs[0]).length === 4, trk(t.name).regs.map(x => snd(x).length)) }

  //── a standard file, out and in ──
  { fresh(); const t = keys('rhodes'), d = newTracks({ kind: 'midi', inst: 'drums', n: 1, out: 0 })[0]
    part(t, 1, 3, [[0, 1, 60, 90], [1.5, .5, 64, 70], [4, 3, 67, 110]]); part(d, 2, 3, [[0, .25, 36, 120], [1, .25, 38, 100], [2, .25, 36, 120]])
    t.regs[0].ctl = [{ id: 1, t: 2, c: 64, v: 127 }]
    const f = smfWrite(), g = smfRead(f.bytes)
    ok('the song written as a standard file: one track for each track of notes, the tempo, the measure, the markers', f.tracks === 2 && g.ok && near(g.bpm, S.tempo, .01) && same(g.meter, [4, 4]) && g.tracks.length === 2 && g.markers.length === SCENES.length && g.markers[1][0] === SCENES[1].name && near(g.markers[1][1], (SCENES[1].a - 1) * 4), [f.tracks, g.bpm, g.meter, g.tracks.length, g.markers.slice(0, 2)])
    ok('read back: the same notes at the same beats, the names, the kit on the drum channel', g.tracks[0].name === 'rhodes' && same(g.tracks[0].notes.map(x => [r4(x.t), r4(x.d), x.n, x.v]), [[0, 1, 60, 90], [1.5, .5, 64, 70], [4, 3, 67, 110]]) && g.tracks[1].drum && near(g.tracks[1].notes[0].t, 4) && g.tracks[0].ctl.length === 1, [g.tracks.map(x => [x.name, x.drum, x.notes.map(n => [n.t, n.d, n.n, n.v])])])
    const part2 = smfRead(smfWrite(1, 2).bytes)
    ok('a stretch of the song written: it begins at the file\'s beginning, and a note that runs out of it ends with it', part2.tracks.length === 2 && near(part2.tracks[0].notes[0].t, 0) && part2.tracks[0].notes[0].n === 67 && near(part2.tracks[0].notes[0].d, 3) && near(part2.tracks[1].notes[0].t, 0), part2.tracks.map(x => x.notes.map(n => [n.t, n.d, n.n])))
    const n0 = S.tracks.length
    ok('a file let go on the room becomes tracks of notes, a kit where it was drums', placeMidi(f.bytes, 'idea.mid', 9) && S.tracks.length === n0 + 2 && (() => { const a = S.tracks[n0], b = S.tracks[n0 + 1]; return isInst(a) && a.inst.kind === 'synth' && b.inst.kind === 'drums' && near(a.regs[0].a, 9) && near(a.regs[0].b, 11) && same(snd(a.regs[0]).map(x => [x[0], x[2]]), [[8, 60], [8.375, 64], [9, 67]]) })(), S.tracks.slice(n0).map(x => [x.name, x.inst && x.inst.kind, x.regs.map(q => [q.a, q.b])]))
    KEYS['⌘KeyZ']()
    ok('in one step, which undo takes back', S.tracks.length === n0)
    ok('what is not such a file is refused', !placeMidi(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]), 'x.mid', 1) && !smfRead(new Uint8Array(4)).ok) }

  //── a project written and read ──
  { fresh(); const t = keys(), r = part(t, 5, 7, [[0, 1, 60], [2, 1, 64]])
    r.q = .25; r.sw = .4; r.ctl = [{ id: 7, t: 0, c: 64, v: 127 }]; t.inst.p.cutoff = 1200; t.inst.uid = 9; t._instTold = 'x'
    const d = JSON.parse(serialize()), o = d.tracks.find(x => x.name === t.name)
    ok('a project keeps a track\'s instrument and its regions of notes, and nothing that is only of this run', o && o.inst && o.inst.kind === 'synth' && o.inst.sound === 'e piano' && o.inst.p.cutoff === 1200 && o.inst.uid === undefined && o._instTold === undefined && o.regs.length === 1 && o.regs[0].notes.length === 2 && o.regs[0].q === .25 && o.regs[0].sw === .4 && o.regs[0].ctl.length === 1 && o.regs[0]._ns === undefined, o)
    ok('what the engine is given for it: its sound\'s numbers, then what was turned by hand', instParams(t.inst).cutoff === 1200 && instParams(t.inst).wave1 === 3) }

  //── the computer's keys ──
  { fresh(); const t = keys(), sent = []
    const NAT0 = typeof playKey === 'function' ? playKey : null
    playKey = (st, d1, d2) => sent.push([st, d1, d2])
    const down = (code, o) => typeDown(Object.assign({ code, preventDefault () {}, stopImmediatePropagation () {}, target: null }, o)), up = code => typeUp({ code, stopImmediatePropagation () {} })
    down('KeyA')
    ok('with the keys off, a letter is a command as ever', sent.length === 0 && !TYPE.on)
    toggleTyping(true)
    down('KeyA'); down('KeyA', { repeat: true }); down('KeyW'); up('KeyA'); up('KeyW')
    ok('with the keys on, a is middle c and w the black key above it; a key held down is one note', same(sent, [[0x90, 60, 100], [0x90, 61, 100], [0x80, 60, 0], [0x80, 61, 0]]), sent)
    sent.length = 0; down('KeyX'); down('KeyV'); down('KeyK'); up('KeyK')
    ok('x is an octave up, v harder; k the c above', same(sent, [[0x90, 84, 110], [0x80, 84, 0]]), sent)
    sent.length = 0; down('KeyA'); down('KeyZ')
    ok('moving the octave with a key down lets that key go first', same(sent, [[0x90, 72, 110], [0x80, 72, 0]]), sent)
    sent.length = 0; down('KeyS', { metaKey: true }); down('KeyR')
    ok('a key with command held, and a letter that is no note, are left to the commands', sent.length === 0)
    down('Tab'); up('Tab')
    ok('tab is the pedal', same(sent, [[0xB0, 64, 127], [0xB0, 64, 0]]), sent)
    sent.length = 0; down('KeyD'); toggleTyping(false)
    ok('turned off with a key down, the key comes up', same(sent, [[0x90, 64, 110], [0x80, 64, 0]]) && !TYPE.on, sent)
    TYPE.oct = 5; TYPE.vel = 100
    if (NAT0) playKey = NAT0 }

  fresh()
  console.log('notes: ' + (bad ? bad + ' FAILED' : 'all passed'))
  return bad
})()
