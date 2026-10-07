/* Edits at random, a few thousand of them, by the hands and the keys: after each one, what must hold of every lane is
   looked at (inv, in load.cjs); an edit that made an undo step is undone and done again, and must give back exactly what
   was there; and nothing may change without making a step. What goes wrong is said once for each kind, with the few
   acts that led to it. Run by ../fuzz.cjs (one seed: node test/fuzz/load.cjs edits <seed> <steps> [ops]). */
(async () => {
  let s = __seed
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647, ri = n => Math.floor(rnd() * n), pick = a => a[ri(a.length)]
  const names = ['kick', 'snare', 'hats'], T0 = S.tempo
  /* every other region on the three tracks is a file from here on: so much sound and no more, with only a little of it
     (or none) before the region's start and after its end for a crossfade or a pull to run on with */
  names.forEach((n, k) => trk(n).regs.forEach((r, i) => {
    if ((i + k) % 2) return
    const len = r.b - r.a, head = pick([0, .25, 1, 3]), tail = pick([0, .25, 1, 3])
    Object.assign(r, { loop: false, buf: null, key: 'file:' + n + i, rate: 1, off: head, srcBars: head + len + tail, sec: (head + len + tail) * SPB(), name: n + ' take ' + i })
  }))
  /* seeds above a thousand: a song from before one sound at a time was the rule — some regions lie twice on one spot, some
     half over another. Such a lane cannot be asked to be sound; what is asked is that nothing throws, nothing comes out
     of no length or with a fade it cannot hold, and undo still gives back exactly what was there. */
  const legacy = __seed > 1000
  if (legacy) for (const n of names) { const rs = trk(n).regs.slice(); for (let k = 0; k < 3; k++) { const r = pick(rs); trk(n).regs.push(cloneReg(r)) } for (let k = 0; k < 2; k++) { const r = pick(rs), d = (r.b - r.a) / 3; trk(n).regs.push(cloneReg(r, { a: r.a + d, b: r.b + d })) } }
  growSong()                                                                          // (the song is as long as what is in it: said once, before anything is compared with it)
  const st0 = editState()
  let log = []
  const fresh = () => {
    if (S.tempo !== T0) { S.tempo = T0; LOOPS = songLoops(T0) }
    restoreEdit(st0); UNDO.length = 0; REDO.length = 0
    S.selR = []; S.selX = null; S.marq = null; S.focus = 'lanes'; CLIP = []; TIME_CLIP = null; setMode('smart'); S.tool = 'pointer'; S.grpOff = false; S.pos = 0
    S.rh = 40; PXB = 24; VX = 0; log = []
  }
  fresh()
  const round = (k, v) => typeof v === 'number' ? Math.round(v * 1e8) / 1e8 : v
  const lane = rs => rs.map(r => [r.id, r.a, r.b, r.off || 0, r.fi || 0, r.fo || 0, r.fic || 0, r.foc || 0, r.grp || 0, !!r.mute, r.gain || 0, r.srcBars || 0])
  const full = () => JSON.stringify([S.tracks.map(t => [t.name, t.grp || '', t.alt || '', lane(t.regs), (t.alts || []).map(a => [a.name, lane(a.regs)]), t.autos]), SCENES.map(x => [x.name, x.a]), SONG_END], round)
  const sorted = n => trk(n).regs.slice().sort((x, y) => x.a - y.a)
  const joins = n => joinsOf(trk(n))
  const one = (n, f) => { const rs = sorted(n); return rs.length ? f(pick(rs), rs) : undefined }
  const at3 = v => v.toFixed(3)
  const ops = {
    /* the smart tool, the pointer, the scissors, the fade tool */
    F () { const n = pick(names), rs = sorted(n); if (rs.length < 2) return; const i = ri(rs.length - 1), k = 2 + ri(2); S.selR = rs.slice(i, i + k).map(r => r.id); S.marq = null; S.focus = 'lanes'; act.fades(); return 'F ' + n + ' ' + i + '+' + k },
    footClick () { const n = pick(names), js = joins(n); if (!js.length) return; const [A, B] = pick(js); S.tool = 'smart'; hPress(hAt(n, (A.b + B.a) / 2, .94, 0)); hUp(); S.tool = 'pointer'; return 'foot click ' + n + ' @' + at3(A.b) },
    footDrag () { const n = pick(names), js = joins(n); if (!js.length) return; const [A, B] = pick(js), dx = (rnd() - .5) * 120; S.tool = 'smart'; hDrag(hAt(n, (A.b + B.a) / 2, .94, 0), hAt(n, (A.b + B.a) / 2, .94, dx), 5); S.tool = 'pointer'; return 'foot drag ' + n + ' @' + at3(A.b) + ' dx ' + dx.toFixed(1) },
    move () { const n = pick(names); return one(n, r => { const dx = (rnd() - .5) * 400, n2 = rnd() < .25 ? pick(names) : n, copy = rnd() < .15; S.tool = 'pointer'; S.selR = []; hDrag(hAt(n, (r.a + r.b) / 2, .6), hAt(n2, (r.a + r.b) / 2, .6, dx), 5, copy ? { altKey: true } : {}); return (copy ? 'copy ' : 'move ') + n + ' [' + at3(r.a) + '] dx ' + dx.toFixed(1) + ' → ' + n2 + ' mode ' + S.mode }) },
    trim () { const n = pick(names); return one(n, r => { const left = rnd() < .5, dx = (rnd() - .5) * 200; S.tool = 'pointer'; S.selR = []; hDrag(hAt(n, left ? r.a : r.b, .5, left ? 2 : -2), hAt(n, left ? r.a : r.b, .5, dx), 5); return 'trim ' + (left ? 'L ' : 'R ') + n + ' [' + at3(r.a) + ',' + at3(r.b) + '] dx ' + dx.toFixed(1) + ' mode ' + S.mode }) },
    fade () { const n = pick(names); return one(n, r => { const left = rnd() < .5, dx = rnd() * 150; S.tool = 'smart'; hDrag(hAt(n, left ? r.a : r.b, .06, left ? 4 : -4), hAt(n, left ? r.a : r.b, .06, left ? 4 + dx : -4 - dx), 5); S.tool = 'pointer'; return 'fade ' + (left ? 'in ' : 'out ') + n + ' [' + at3(r.a) + '] ' + dx.toFixed(1) }) },
    fadeTool () { const n = pick(names); return one(n, r => { const left = rnd() < .5, dx = rnd() * 60, opt = rnd() < .2; S.tool = 'fade'; hDrag(hAt(n, left ? r.a : r.b, .5, left ? 30 : -30), hAt(n, left ? r.a : r.b, .5, left ? 30 + dx : -30 - dx), 5, opt ? { altKey: true } : {}); S.tool = 'pointer'; return 'fade tool ' + (opt ? 'with option ' : '') + (left ? 'in ' : 'out ') + n + ' [' + at3(r.a) + '] ' + dx.toFixed(1) }) },
    fadeToolJoin () { const n = pick(names), js = joins(n); if (!js.length) return; const [A, B] = pick(js), dx = (rnd() - .5) * 100; S.tool = 'fade'; hDrag(hAt(n, (A.b + B.a) / 2, .5, 0), hAt(n, (A.b + B.a) / 2, .5, dx), 5, rnd() < .15 ? { altKey: true } : {}); S.tool = 'pointer'; return 'fade tool at join ' + n + ' @' + at3(A.b) + ' dx ' + dx.toFixed(1) },
    cut () { const n = pick(names); return one(n, r => { const at = r.a - 1 + rnd() * (r.b - r.a); S.tool = 'scissors'; hPress({ x: bx(at + 1), y: hAt(n, 1).y }); hUp(); S.tool = 'pointer'; return 'scissors ' + n + ' @' + at3(at) }) },
    curve () { const n = pick(names), js = joins(n).filter(([A, B]) => xfadeOf(A, B)); if (!js.length) return; const [A, B] = pick(js), v = ri(3); edit(() => { for (const [a, b] of [[A, B]].concat(joinMates(A, B, trk(n)))) a.foc = b.fic = v }); return 'curve ' + v },
    /* the keys */
    del () { const n = pick(names); return one(n, r => { S.selR = withTheirs([r.id]); S.marq = null; S.focus = 'lanes'; S.selX = null; act.del(); return 'del ' + n + ' [' + at3(r.a) + '] mode ' + S.mode }) },
    xDel () { const n = pick(names), js = joins(n).filter(([A, B]) => xfadeOf(A, B)); if (!js.length) return; const [A, B] = pick(js); S.selR = []; S.selX = [A.id, B.id]; S.focus = 'lanes'; act.del(); return 'delete crossfade ' + n },
    marqDel () { const n = pick(names), js0 = joins(n), ja = js0.length && rnd() < .5 ? (x => (x[0].b + x[1].a) / 2 - 1)(pick(js0)) : null, a = ja != null ? ja : ri(40) + (rnd() < .5 ? 0 : rnd()), b = a + .5 + rnd() * 6, i = trki(n); S.selR = []; S.selX = null; S.marq = { a, b, t0: i, t1: i }; marqMates(); S.focus = 'lanes'; act.del(); return 'marquee del ' + n + ' ' + at3(a) + '…' + at3(b) + ' mode ' + S.mode },
    marqF () { const n = pick(names), js = joins(n); if (!js.length) return; const [A, B] = pick(js), at = (A.b + B.a) / 2 - 1, a = at - rnd() * .4, b = at + rnd() * .4, i = trki(n); S.selR = []; S.selX = null; S.marq = { a, b, t0: i, t1: i }; marqMates(); S.focus = 'lanes'; act.fades(); return 'marquee F ' + n + ' ' + at3(a) + '…' + at3(b) },
    marqMute () { const n = pick(names), a = rnd() * 38, b = a + .2 + rnd() * 3, i = trki(n); S.selR = []; S.selX = null; S.marq = { a, b, t0: i, t1: i }; marqMates(); S.focus = 'lanes'; act.mute(); return 'marquee mute ' + n + ' ' + at3(a) + '…' + at3(b) },
    paste () { const n = pick(names); return one(n, r => { S.selR = [r.id]; S.marq = null; act.copy(); S.sel = trki(pick(names)); S.selT = []; S.pos = rnd() < .5 ? ri(40) : rnd() * 40; act.paste(); return 'paste [' + at3(r.a) + '] at ' + at3(S.pos) + ' on ' + S.tracks[S.sel].name + ' mode ' + S.mode }) },
    fadeTo () { const n = pick(names); return one(n, r => { S.selR = [r.id]; S.marq = null; S.pos = r.a - 1 + rnd() * (r.b - r.a); const out = rnd() < .5; act.fadeTo(out); return 'fadeTo ' + (out ? 'out ' : 'in ') + n + ' [' + at3(r.a) + '] at ' + at3(S.pos) }) },
    spot () { const n = pick(names); return one(n, r => { S.selR = withTheirs([r.id]); S.marq = null; const to = rnd() * 40; act.spot(to); return 'spot ' + n + ' [' + at3(r.a) + '] to ' + at3(to) }) },
    joinKey () { const n = pick(names), rs = sorted(n); if (rs.length < 2) return; const i = ri(rs.length - 1); S.selR = [rs[i].id, rs[i + 1].id]; S.marq = null; act.join(); return 'join key ' + n + ' ' + i },
    nudge () { const n = pick(names); return one(n, r => { S.selR = withTheirs([r.id]); S.marq = null; S.nudge = pick(['bar', 'beat', '1/16', '10 ms', 'sample']); const dir = rnd() < .5 ? -1 : 1; act.nudge(dir); return 'nudge ' + n + ' [' + at3(r.a) + '] ' + dir + ' ' + S.nudge }) },
    nudgeLen () { const n = pick(names); return one(n, r => { S.selR = withTheirs([r.id]); S.marq = null; S.nudge = pick(['bar', 'beat', '1/16', '10 ms', 'sample']); const dir = rnd() < .5 ? -1 : 1; act.nudgeLen(dir); return 'nudge the end ' + n + ' [' + at3(r.a) + ',' + at3(r.b) + '] ' + dir + ' ' + S.nudge }) },
    trimTo () { const n = pick(names); return one(n, r => { S.selR = withTheirs([r.id]); S.marq = null; S.pos = r.a - 1 + (rnd() * 1.6 - .3) * (r.b - r.a); if (S.pos < 0) S.pos = 0; const end = rnd() < .5; act.trimTo(end); return 'trim ' + (end ? 'end' : 'start') + ' to the playhead ' + n + ' [' + at3(r.a) + ',' + at3(r.b) + '] at ' + at3(S.pos) }) },
    toPlayhead () { const n = pick(names); return one(n, r => { S.selR = withTheirs([r.id]); S.marq = null; S.pos = rnd() * 40; act.toPlayhead(false); return 'to the playhead ' + n + ' [' + at3(r.a) + '] at ' + at3(S.pos) }) },
    shuffleKey () { const n = pick(names); return one(n, r => { S.selR = withTheirs([r.id]); S.marq = null; const dir = rnd() < .5 ? -1 : 1; act.shuffle(dir); return 'shuffle key ' + n + ' [' + at3(r.a) + '] ' + dir }) },
    splitHead () { const n = pick(names); return one(n, r => { S.selR = withTheirs([r.id]); S.marq = null; S.pos = r.a - 1 + rnd() * (r.b - r.a); act.splitAtPlayhead(); return 'cut at the playhead ' + n + ' @' + at3(S.pos) }) },
    repeat () { const n = pick(names); return one(n, r => { S.selR = withTheirs([r.id]); S.marq = null; act.repeat(); return 'repeat ' + n + ' [' + at3(r.a) + ']' }) },
    loop () { const n = pick(names); return one(n, r => { if (r.b - r.a < .2) return; S.selR = [r.id]; S.marq = null; act.loop(); return 'loop ' + n + ' [' + at3(r.a) + ']' }) },
    mute () { const n = pick(names); return one(n, r => { S.selR = withTheirs([r.id]); S.marq = null; act.mute(); return 'mute ' + n }) },
    regGroup () { const rs = names.flatMap(sorted); if (rs.length < 2) return; if (rnd() < .5) { S.selR = [pick(rs).id, pick(rs).id]; act.groupRegs(); return 'group regions' } S.selR = withTheirs([pick(rs).id]); act.ungroupRegs(); return 'ungroup regions' },
    /* the song's time, its parts, alternatives, groups */
    time () {
      const jn = pick(names), js0 = joins(jn), ja = js0.length && rnd() < .4 ? (x => (x[0].b + x[1].a) / 2 - 1)(pick(js0)) : null
      const what = pick(['cut', 'room', 'put', 'repeat', 'move']), a = ja != null ? ja : rnd() < .7 ? ri(36) : rnd() * 36, len = rnd() < .7 ? 1 + ri(6) : .1 + rnd() * 5, to = rnd() < .7 ? ri(40) : rnd() * 40
      if (what === 'cut') timeAct.cut(a, a + len); else if (what === 'room') timeAct.room(a, len); else if (what === 'put') timeAct.put(to); else if (what === 'repeat') timeAct.repeat(a, a + len); else timeAct.move(a, a + len, to)
      return 'time ' + what + ' ' + at3(a) + ' +' + at3(len) + ' to ' + at3(to)
    },
    part () { if (!SCENES.length) return; const i = ri(SCENES.length), what = pick(['repeat', 'cut', 'earlier', 'later']); partAct(i, what); return 'part ' + i + ' ' + what },
    alt () { const n = pick(names), t = trk(n), what = pick(['new', 'copy', 'copy', 'copy', 'use', 'use', 'use', 'others']); if (what === 'use') { if (!(t.alts || []).length) return; altAct(t, 'use', pick(t.alts).name) } else altAct(t, what); return 'alt ' + what + ' ' + n },
    group () { const a = trki('kick'), b = trki('snare'); S.sel = a; S.selT = [S.tracks[a].id, S.tracks[b].id]; groupTracks(); S.selT = []; return 'group kick+snare → ' + (trk('kick').grp || 'none') },
    /* what is not an edit, but changes how the next one goes */
    mode () { setMode(pick(MODES.filter(m => m !== 'spot'))) },
    zoom () { PXB = pick([24, 24, 200, 640, 3000, 60000, maxPXB()]) },
    tempo () { const to = pick([70, 84, 92, 92, 104, 120, 141.5, 160].filter(v => v !== S.tempo)); setTempo(to); return 'tempo ' + to },
    undoMany () {
      const k = Math.min(UNDO.length, 1 + ri(6)), was = full()
      for (let i = 0; i < k; i++) { undoEdit(); if (!legacy && inv().length) return 'undo ×' + (i + 1) + ' of ' + k }
      for (let i = 0; i < k; i++) redoEdit()
      if (full() !== was) throw new Error('undo ×' + k + ' and redo ×' + k + ' do not give back what was there')
      return k ? 'undo ×' + k + ' and back' : undefined
    },
  }
  const list = __only ? __only.split(',') : Object.keys(ops), seen = new Map(), f4 = v => +v.toFixed(4)
  const say1 = (key, ...lines) => { seen.set(key, (seen.get(key) || 0) + 1); if (seen.get(key) === 1) console.log(lines.join('\n   ')) }
  const show = rs => JSON.stringify(rs.map(r => [r[0], f4(r[1]), f4(r[2]), f4(r[3]), f4(r[4]), f4(r[5])]).sort((x, y) => x[1] - y[1]))
  const detail = (before, tn, alts) => {                                              // the track an error names, before and after (its alternatives too, when it is one of them that is wrong)
    const b = JSON.parse(before)[0].find(x => x[0] === tn), t = trk(tn)
    if (!b || !t) return []
    return ['before: ' + show(b[3]), 'after:  ' + show(lane(t.regs))].concat(alts ? ['alts before: ' + JSON.stringify(b[4].map(x => [x[0], JSON.parse(show(x[1]))])), 'alts after:  ' + JSON.stringify((t.alts || []).map(x => [x.name, JSON.parse(show(lane(x.regs)))]))] : [], ['zoom ' + f4(PXB) + ', mode ' + S.mode + ', tempo ' + S.tempo + ', chosen ' + JSON.stringify(S.selR)])
  }
  const counts = {}
  for (let k = 0; k < __steps; k++) {
    for (const n of names) { const t = trk(n), back = !t.regs.length && (t.alts || []).find(a => a.regs.length); if (back) altAct(t, 'use', back.name) }      // (a track left on an empty alternative goes back to one with something on it: there is nothing to edit on an empty lane)
    const name = pick(list), before = full(), n0 = __commits
    let what
    try { what = ops[name]() } catch (e) { say1('THROWN ' + name + ' ' + String(e && e.message).replace(/[\d.]+/g, '#'), 'THROWN in ' + name + ' — ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e), 'after: ' + log.slice(-4).join(' ; ')); fresh(); continue }
    drag = null
    if (what) { log.push(what); counts[name] = (counts[name] || 0) + 1 }
    const errs = inv().filter(e => !legacy || !/overlap, no crossfade|out of step|swallows/.test(e))
    if (errs.length) {
      say1(name + ' | ' + errs[0].replace(/[\d.]+/g, '#'), 'BROKEN by ' + what, ...errs.slice(0, 3), 'after: ' + log.slice(-5, -1).join(' ; '), ...detail(before, errs[0].split(/[ :]/)[0], / alt /.test(errs[0].split(':')[0])))
      fresh(); continue
    }
    if (name !== 'tempo' && name !== 'undoMany') {
      if (__commits === n0 + 1) {                                                     // one step: undone, it gives back exactly what was there; done again, what it made
        const after = full()
        undoEdit()
        if (full() !== before) say1('UNDO ' + name, 'UNDO does not give back what was there: ' + what, 'after: ' + log.slice(-4, -1).join(' ; '))
        else if (!legacy && inv().length) say1('UNDONE ' + name, 'BROKEN once undone: ' + what, ...inv().slice(0, 2))
        redoEdit()
        if (full() !== after) say1('REDO ' + name, 'REDO differs: ' + what)
      } else if (__commits > n0 + 1) say1('STEPS ' + name, (__commits - n0) + ' undo steps for one act: ' + what)
      else if (full() !== before) {
        const x = JSON.parse(before), y = JSON.parse(full()), tn = (x[0].find((t, i) => JSON.stringify(t) !== JSON.stringify(y[0][i])) || [''])[0]
        const ti = x[0].findIndex((t, i) => JSON.stringify(t) !== JSON.stringify(y[0][i])), what2 = ti < 0 ? [] : x[0][ti].map((part, k) => JSON.stringify(part) === JSON.stringify(y[0][ti][k]) ? null : ['name', 'group', 'alternative', 'regions', 'alternatives', 'lines'][k]).filter(Boolean)
        const rows = ti < 0 || !what2.includes('regions') ? [] : x[0][ti][3].filter(r => !y[0][ti][3].some(q => JSON.stringify(q) === JSON.stringify(r))).map(r => 'was ' + JSON.stringify(r) + ' is ' + JSON.stringify(y[0][ti][3].find(q => q[0] === r[0]) || null))
        say1('NOSTEP ' + name, 'changed with no undo step: ' + what + ' [the hand: ' + __hand + ']', 'after: ' + log.slice(-3, -1).join(' ; '), 'what differs: ' + what2.join(', '), ...rows.slice(0, 4), ...(tn ? detail(before, tn, true) : ['markers or the end of the song: ' + JSON.stringify(x.slice(1)) + ' → ' + JSON.stringify(y.slice(1))]))
      }
    }
    if (SONG_END > 400 || S.tracks.reduce((a, t) => a + lanesOf(t).reduce((n, L) => n + L.regs.length, 0), 0) > 220) fresh()
  }
  if (process.env.FUZZ_COUNTS) console.log('acts that did something: ' + Object.entries(counts).map(([key, v]) => key + ' ' + v).join(', '))
  console.log('edits, seed ' + __seed + ': ' + (seen.size ? [...seen].map(([key, v]) => v + '× ' + key).join('\n   ') : 'nothing wrong in ' + __steps))
  return seen.size
})()
