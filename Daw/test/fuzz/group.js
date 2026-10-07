/* Two tracks edited as one (an edit group), and edits at random on either of them: after each, the two must still carry
   the very same regions — same places, same lengths, same fades — and each must be sound in itself (inv, in load.cjs).
   Run by ../fuzz.cjs (one seed: node test/fuzz/load.cjs group <seed> <steps>). */
(async () => {
  let s = __seed
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647, ri = n => Math.floor(rnd() * n), pick = a => a[ri(a.length)]
  const names = ['kick', 'snare']
  /* the two begin alike: the snare is given the kick's regions (its own sound in them), every other one a file with only so much sound to run on with */
  trk('snare').regs = trk('kick').regs.map(r => cloneReg(r, { buf: trk('snare').regs[0] ? trk('snare').regs[0].buf : r.buf }))
  trk('kick').regs.forEach((r, i) => {
    if (i % 2) return
    const len = r.b - r.a, head = pick([0, .25, 1, 3]), tail = pick([0, .25, 1, 3])
    for (const n of names) Object.assign(trk(n).regs[i], { loop: false, buf: null, key: 'file:' + n + i, rate: 1, off: head, srcBars: head + len + tail, sec: (head + len + tail) * SPB(), name: n + ' take ' + i })
  })
  S.sel = trki('kick'); S.selT = [trk('kick').id, trk('snare').id]; groupTracks(); S.selT = []
  const st0 = editState()
  let log = []
  const fresh = () => { restoreEdit(st0); UNDO.length = 0; REDO.length = 0; S.selR = []; S.selX = null; S.marq = null; S.focus = 'lanes'; CLIP = []; TIME_CLIP = null; setMode('smart'); S.tool = 'pointer'; S.grpOff = false; S.pos = 0; S.rh = 40; PXB = 24; VX = 0; log = [] }
  fresh()
  const lay = n => JSON.stringify(trk(n).regs.slice().sort((x, y) => x.a - y.a || x.b - y.b).map(r => [+r.a.toFixed(6), +r.b.toFixed(6), +(r.off || 0).toFixed(6), +(r.fi || 0).toFixed(6), +(r.fo || 0).toFixed(6), r.fic || 0, r.foc || 0, !!r.mute]))
  const sorted = n => trk(n).regs.slice().sort((x, y) => x.a - y.a)
  const joins = n => joinsOf(trk(n))
  const one = (n, f) => { const rs = sorted(n); return rs.length ? f(pick(rs), rs) : undefined }
  const press = (n, r) => { S.tool = 'pointer'; hPress(hAt(n, (r.a + r.b) / 2, .6)); hUp(); S.marq = null; S.focus = 'lanes'; S.selX = null }      // a press on one of them chooses the same one on the other
  const marq = (n, a, b) => { S.tool = 'marquee'; hDrag({ x: bx(a + 1), y: hAt(n, 1).y }, { x: bx(b + 1), y: hAt(n, 1).y }, 4, { ctrlKey: true, shiftKey: true }); S.tool = 'pointer' }
  const ops = {
    F () { const n = pick(names), rs = sorted(n); if (rs.length < 2) return; const i = ri(rs.length - 1), k = 2 + ri(2); S.selR = withTheirs(rs.slice(i, i + k).map(r => r.id)); S.marq = null; S.focus = 'lanes'; act.fades(); return 'F ' + n + ' ' + i + '+' + k },
    footClick () { const n = pick(names), js = joins(n); if (!js.length) return; const [A, B] = pick(js); S.tool = 'smart'; hPress(hAt(n, (A.b + B.a) / 2, .94, 0)); hUp(); S.tool = 'pointer'; return 'foot click ' + n + ' @' + A.b.toFixed(3) },
    footDrag () { const n = pick(names), js = joins(n); if (!js.length) return; const [A, B] = pick(js), dx = (rnd() - .5) * 120, was = xfadeOf(A, B); S.tool = 'smart'; hDrag(hAt(n, (A.b + B.a) / 2, .94, 0), hAt(n, (A.b + B.a) / 2, .94, dx), 5); S.tool = 'pointer'; return 'foot drag ' + n + ' @' + A.b.toFixed(3) + ' dx ' + dx.toFixed(1) + (was ? ' (the join of a crossfade)' : ' (a new crossfade)') },
    move () { const n = pick(names); return one(n, r => { const dx = (rnd() - .5) * 400; S.tool = 'pointer'; S.selR = []; hDrag(hAt(n, (r.a + r.b) / 2, .6), hAt(n, (r.a + r.b) / 2, .6, dx), 5, rnd() < .15 ? { altKey: true } : {}); return 'move ' + n + ' [' + r.a.toFixed(3) + '] dx ' + dx.toFixed(1) + ' mode ' + S.mode }) },
    trim () { const n = pick(names); return one(n, r => { const left = rnd() < .5, dx = (rnd() - .5) * 200; S.tool = 'pointer'; S.selR = []; hDrag(hAt(n, left ? r.a : r.b, .5, left ? 2 : -2), hAt(n, left ? r.a : r.b, .5, dx), 5); return 'trim ' + (left ? 'L ' : 'R ') + n + ' [' + r.a.toFixed(3) + ',' + r.b.toFixed(3) + '] dx ' + dx.toFixed(1) + ' mode ' + S.mode }) },
    fade () { const n = pick(names); return one(n, r => { const left = rnd() < .5, dx = rnd() * 150; S.tool = 'smart'; hDrag(hAt(n, left ? r.a : r.b, .06, left ? 4 : -4), hAt(n, left ? r.a : r.b, .06, left ? 4 + dx : -4 - dx), 5); S.tool = 'pointer'; return 'fade ' + (left ? 'in ' : 'out ') + n + ' ' + dx.toFixed(1) }) },
    fadeTool () { const n = pick(names); return one(n, r => { const left = rnd() < .5, dx = rnd() * 60; S.tool = 'fade'; hDrag(hAt(n, left ? r.a : r.b, .5, left ? 30 : -30), hAt(n, left ? r.a : r.b, .5, left ? 30 + dx : -30 - dx), 5, rnd() < .2 ? { altKey: true } : {}); S.tool = 'pointer'; return 'fade tool ' + (left ? 'in ' : 'out ') + n + ' ' + dx.toFixed(1) }) },
    cut () { const n = pick(names); return one(n, r => { const at = r.a - 1 + rnd() * (r.b - r.a); S.tool = 'scissors'; hPress({ x: bx(at + 1), y: hAt(n, 1).y }); hUp(); S.tool = 'pointer'; return 'scissors ' + n + ' @' + at.toFixed(3) }) },
    del () { const n = pick(names); return one(n, r => { press(n, r); act.del(); return 'press + delete ' + n + ' [' + r.a.toFixed(3) + '] mode ' + S.mode }) },
    marqDel () { const n = pick(names), a = rnd() < .5 ? ri(40) : rnd() * 40, b = a + .5 + rnd() * 6; marq(n, a, b); act.del(); return 'marquee delete ' + n + ' ' + a.toFixed(3) + '…' + b.toFixed(3) + ' mode ' + S.mode },
    marqF () { const n = pick(names), js = joins(n); if (!js.length) return; const [A, B] = pick(js), at = (A.b + B.a) / 2 - 1; marq(n, at - rnd() * .4, at + rnd() * .4); act.fades(); return 'marquee F ' + n + ' @' + at.toFixed(3) },
    marqMute () { const n = pick(names), a = rnd() * 38, b = a + .2 + rnd() * 3; marq(n, a, b); act.mute(); return 'marquee mute ' + n + ' ' + a.toFixed(3) + '…' + b.toFixed(3) },
    xDel () { const n = pick(names), js = joins(n).filter(([A, B]) => xfadeOf(A, B)); if (!js.length) return; const [A, B] = pick(js); S.tool = 'smart'; hPress(hAt(n, (A.b + B.a) / 2, .94, 0)); hUp(); S.tool = 'pointer'; act.del(); return 'crossfade pressed + delete ' + n },
    curve () { const n = pick(names), js = joins(n).filter(([A, B]) => xfadeOf(A, B)); if (!js.length) return; const [A, B] = pick(js), v = ri(3); edit(() => { for (const [a, b] of [[A, B]].concat(joinMates(A, B, trk(n)))) a.foc = b.fic = v }); return 'curve ' + v },
    nudge () { const n = pick(names); return one(n, r => { press(n, r); S.nudge = pick(['bar', 'beat', '1/16', '10 ms']); const dir = rnd() < .5 ? -1 : 1; act.nudge(dir); return 'nudge ' + n + ' [' + r.a.toFixed(3) + '] ' + dir + ' ' + S.nudge }) },
    nudgeLen () { const n = pick(names); return one(n, r => { press(n, r); S.nudge = pick(['bar', 'beat', '1/16', '10 ms']); const dir = rnd() < .5 ? -1 : 1; act.nudgeLen(dir); return 'nudge the end ' + n + ' [' + r.a.toFixed(3) + '] ' + dir + ' ' + S.nudge }) },
    trimTo () { const n = pick(names); return one(n, r => { press(n, r); S.pos = Math.max(0, r.a - 1 + (rnd() * 1.6 - .3) * (r.b - r.a)); const end = rnd() < .5; act.trimTo(end); return 'trim ' + (end ? 'end' : 'start') + ' to the playhead ' + n + ' [' + r.a.toFixed(3) + '] at ' + S.pos.toFixed(3) }) },
    splitHead () { const n = pick(names); return one(n, r => { press(n, r); S.pos = r.a - 1 + rnd() * (r.b - r.a); act.splitAtPlayhead(); return 'cut at the playhead ' + n + ' @' + S.pos.toFixed(3) }) },
    fadeTo () { const n = pick(names); return one(n, r => { press(n, r); S.pos = r.a - 1 + rnd() * (r.b - r.a); const out = rnd() < .5; act.fadeTo(out); return 'fadeTo ' + (out ? 'out ' : 'in ') + n + ' at ' + S.pos.toFixed(3) }) },
    shuffleKey () { const n = pick(names); return one(n, r => { press(n, r); const dir = rnd() < .5 ? -1 : 1; act.shuffle(dir); return 'shuffle key ' + n + ' [' + r.a.toFixed(3) + '] ' + dir }) },
    repeat () { const n = pick(names); return one(n, r => { press(n, r); act.repeat(); return 'repeat ' + n + ' [' + r.a.toFixed(3) + ']' }) },
    mute () { const n = pick(names); return one(n, r => { press(n, r); act.mute(); return 'mute ' + n }) },
    alt () { const n = pick(names), t = trk(n), what = pick(['new', 'copy', 'copy', 'copy', 'use', 'use', 'use']); if (what === 'use') { if (!(t.alts || []).length) return; altAct(t, 'use', pick(t.alts).name) } else altAct(t, what); return 'alt ' + what + ' ' + n },
    mode () { setMode(pick(MODES.filter(m => m !== 'spot'))) },
    zoom () { PXB = pick([24, 24, 200, 640, 3000]) },
  }
  const list = __only ? __only.split(',') : Object.keys(ops), seen = new Map()
  const say1 = (key, ...lines) => { seen.set(key, (seen.get(key) || 0) + 1); if (seen.get(key) === 1) console.log(lines.join('\n   ')) }
  const counts = {}
  for (let k = 0; k < __steps; k++) {
    { const t = trk('kick'), back = !t.regs.length && (t.alts || []).find(a => a.regs.length); if (back) altAct(t, 'use', back.name) }      // (left on an empty alternative, the two go back to one with something on it)
    const name = pick(list)
    let what
    try { what = ops[name]() } catch (e) { say1('THROWN ' + name, 'THROWN in ' + name + ' — ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e), 'after: ' + log.slice(-4).join(' ; ')); fresh(); continue }
    drag = null
    if (what) { log.push(what); counts[name] = (counts[name] || 0) + 1 }
    const errs = inv()
    if (lay('kick') !== lay('snare')) { say1('APART ' + name, 'OUT OF STEP after ' + what, 'kick  ' + lay('kick'), 'snare ' + lay('snare'), 'before that: ' + log.slice(-4, -1).join(' ; '), 'zoom ' + PXB + ', mode ' + S.mode); fresh() }
    else if (errs.length) { say1(name + ' | ' + errs[0].replace(/[\d.]+/g, '#'), 'BROKEN by ' + what, ...errs.slice(0, 3), 'after: ' + log.slice(-5, -1).join(' ; '), 'kick ' + lay('kick')); fresh() }
    if (S.tracks.reduce((a, t) => a + t.regs.length, 0) > 140 || SONG_END > 400) fresh()
  }
  if (process.env.FUZZ_COUNTS) console.log('acts that did something: ' + Object.entries(counts).map(([key, v]) => key + ' ' + v).join(', '))
  console.log('group, seed ' + __seed + ': ' + (seen.size ? [...seen].map(([key, v]) => v + '× ' + key).join('\n   ') : 'nothing wrong in ' + __steps))
  return seen.size
})()
