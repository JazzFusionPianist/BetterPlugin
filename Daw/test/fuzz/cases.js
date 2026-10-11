/* What the random edits found, kept as plain cases: where a crossfade meets something else — a cut, a stretch of time
   taken out or put in, a key that moves an end, the tempo. Each says what should be there afterwards.
   Run by ../fuzz.cjs (alone: node test/fuzz/load.cjs cases). */
(async () => {
  let bad = 0
  const ok = (what, pass, got) => { if (!pass) bad++; console.log((pass ? 'ok   ' : 'FAIL ') + what + (pass ? '' : '  ' + JSON.stringify(got))) }
  const T0 = S.tempo, st0 = editState()
  const fresh = () => {
    if (S.tempo !== T0) { S.tempo = T0; LOOPS = songLoops(T0) }
    restoreEdit(st0); UNDO.length = 0; REDO.length = 0
    S.selR = []; S.selX = null; S.marq = null; S.focus = 'lanes'; CLIP = []; TIME_CLIP = null; setMode('smart'); S.tool = 'pointer'; S.grpOff = false; S.pos = 0; S.rh = 40; PXB = 24; VX = 0
    S.sel = trki('kick'); S.selT = []
  }
  const r4 = v => +v.toFixed(4)
  const lay = n => trk(n).regs.slice().sort((x, y) => x.a - y.a).map(r => [r4(r.a), r4(r.b), r4(r.off || 0)])
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  const reg = (n, a) => trk(n).regs.find(r => Math.abs(r.a - a) < 1e-6)
  const pair = () => { const A = reg('kick', 17), B = trk('kick').regs.find(r => r !== A && xfadeOf(A, r)); return [A, B] }
  const cross = len => { fresh(); const A = reg('kick', 17), B = reg('kick', 25); edit(() => { crossfade(A, B, len) }); return [A, B] }      // kick: [5,13] [17,25]×[25,33] [33,41], the two in the middle crossfaded about bar 25
  const file = (n, a, b, off, src, key) => { const r = mkReg({ a, b, off, buf: null, key: key || 'file:x', loop: false, rate: 1, srcBars: src, sec: src * SPB(), name: 'take' }); trk(n).regs.push(r); return r }
  const X = .02 / SPB()                                                               // what F makes: twenty thousandths of a second

  /* a cut, a key, with a crossfade */
  { const [A, B] = cross(1), n = __commits, was = lay('kick'); S.tool = 'scissors'; S.snap = false; hPress({ x: bx(25.2), y: hAt('kick', 1).y }); hUp(); S.snap = true; S.tool = 'pointer'
    S.selR = [A.id, B.id]; S.pos = 24; act.splitAtPlayhead()
    ok('the scissors, and ⌘T, inside a crossfade: nothing is cut (the two are two already), and no undo step', same(lay('kick'), was) && xfadeOf(A, B) === 1 && __commits === n && !inv().length, [lay('kick'), __commits - n]) }
  { cross(1); const n = __commits; S.selR = []; S.pos = 24.2; act.fadeTo(false); act.fadeTo(true)
    ok('d and g with the playhead inside a crossfade and nothing chosen: nothing, and no undo step', __commits === n && xfadeOf(...pair()) === 1, [__commits - n, lay('kick')]) }
  { const [A, B] = cross(1); S.selR = [A.id]; S.pos = 22; act.trimTo(true)
    ok('⌘] on the earlier of two that crossfade: the join goes to the playhead, the crossfade as long as it was', Math.abs((A.b + B.a) / 2 - 23) < 1e-9 && Math.abs(xfadeOf(A, B) - 1) < 1e-9 && !inv().length, lay('kick')) }
  { const [A, B] = cross(1); S.selR = [B.id]; S.pos = 26; act.trimTo(false)
    ok('⌘[ on the later of the two: the same join, to the playhead', Math.abs((A.b + B.a) / 2 - 27) < 1e-9 && Math.abs(xfadeOf(A, B) - 1) < 1e-9 && !inv().length, lay('kick')) }
  { const [A, B] = cross(1); S.selR = [A.id]; S.nudge = 'bar'; act.nudgeLen(1)
    ok('⌥⇧→ on the earlier of the two: the join a nudge later', Math.abs((A.b + B.a) / 2 - 26) < 1e-9 && Math.abs(xfadeOf(A, B) - 1) < 1e-9 && !inv().length, lay('kick')) }
  { fresh(); const A = reg('kick', 17), B = reg('kick', 25); S.selR = [A.id, B.id]; S.nudge = 'bar'; act.nudgeLen(1)
    ok('⌥⇧→ on two that meet, both chosen: the first does not run into the second', same(lay('kick'), [[5, 13, 4], [17, 25, 16], [25, 34, 24], [34, 41, 33]]) && !inv().length, lay('kick')) }

  /* the hand on the join of a crossfade */
  { const [A, B] = cross(1), was = JSON.stringify(lay('kick')), n = __commits; S.tool = 'smart'
    hPress(hAt('kick', 25, .94, 0)); for (const b of [25.4, 26, 25.3, 25]) hMove(hAt('kick', b, .94, 0)); hUp(); S.tool = 'pointer'
    ok('the join of a crossfade taken away and brought back to where it was: nothing changed, and no undo step', __commits === n && JSON.stringify(lay('kick')) === was && Math.abs(A.fo - 1) < 1e-12, [__commits - n, lay('kick')]) }
  { const [A, B] = cross(1); S.tool = 'smart'; hDrag(hAt('kick', 25, .94, 0), hAt('kick', 27, .94, 0), 6); S.tool = 'pointer'
    ok('the same join pulled two bars on: both go, the crossfade as long as it was', Math.abs((A.b + B.a) / 2 - 27) < 1e-6 && Math.abs(xfadeOf(A, B) - 1) < 1e-9 && !inv().length, lay('kick')) }
  { fresh(); trk('kick').regs = []; const A = file('kick', 17, 25, 0, 8.25, 'file:a'), B = file('kick', 25, 33, 0, 8, 'file:b')      // the first has a quarter of a bar after its end, the second nothing before its start
    S.tool = 'smart'; hDrag(hAt('kick', 25, .94, 0), hAt('kick', 25, .94, 200), 6); S.tool = 'pointer'
    ok('a crossfade pulled far out of the join of two files: as long as the sound they have, and no longer', Math.abs(xfadeOf(A, B) - .25) < 1e-9 && Math.abs(B.a - 25) < 1e-9 && !inv().length, [A.b, B.a, B.off]) }
  { fresh(); trk('kick').regs = []; const A = file('kick', 17, 17.5, 0, 40, 'file:a'), B = file('kick', 17.5, 33, 20, 40, 'file:b')
    S.tool = 'smart'; hDrag(hAt('kick', 17.5, .94, 0), hAt('kick', 17.5, .94, 300), 6); S.tool = 'pointer'
    ok('pulled out further than the earlier region is long: it still begins first and ends first', xfadeOf(A, B) > 0 && B.a - A.a > 1e-9 && B.b - A.b > 1e-9 && !inv().length, [A.a, A.b, B.a, B.b]) }

  /* the song's time */
  { cross(X); const i = SCENES.findIndex(s => Math.abs(s.a - 25) < 1e-9); partAct(i, 'repeat'); const [A, B] = pair()
    ok('a part said twice, a crossfade on its first bar line: that crossfade stays, the second time begins plainly',
      !!B && Math.abs(xfadeOf(A, B) - X) < 1e-9 && same(lay('kick').slice(3), [[33, 41, 24], [41, 49, 32]]) && same(lay('snare'), [[5, 13, 4], [17, 25, 16], [25, 33, 24], [33, 41, 24], [41, 49, 32]]) && !inv().length, [lay('kick'), lay('snare')])
    undoEdit(); ok('and undone: as it was', Math.abs(xfadeOf(...pair()) - X) < 1e-9 && lay('kick').length === 4, lay('kick')) }
  { cross(X); timeAct.room(24, 4)
    ok('room made on the bar line of a crossfade: the two part plainly there', same(lay('kick'), [[5, 13, 4], [17, 25, 16], [29, 37, 24], [37, 45, 32]]) && !reg('kick', 17).fo && !inv().length, lay('kick')) }
  { cross(1); timeAct.cut(24.25, 26)                                                  // from inside the crossfade on
    ok('a stretch taken out from inside a crossfade: the song closes over it with a plain join', !inv().length && lay('kick').every(r => r[1] > r[0]) && Math.abs(reg('kick', 17).b - 25.25) < 1e-9, lay('kick')) }

  /* the tempo */
  { fresh(); trk('kick').regs = []; const sec = 20, spb = SPB(), r = file('kick', 5, 5 + 10 / spb, 5 / spb, sec / spb, 'file:a')
    S.selR = [r.id]; act.copy(); setTempo(120); S.sel = trki('kick'); S.pos = 20; act.paste()
    const p = trk('kick').regs.find(x => x !== r), s = SPB()
    ok('copied, then the tempo moved, then pasted: the copy plays the same seconds of the file', !!p && Math.abs((p.off || 0) * s - 5) < 1e-6 && Math.abs((p.b - p.a) * s - 10) < 1e-6, p && [(p.off || 0) * s, (p.b - p.a) * s]) }
  { fresh(); trk('kick').regs = []; const sec = 20, spb = SPB(), r = file('kick', 5, 5 + 10 / spb, 5 / spb, sec / spb, 'file:a')
    S.selR = [r.id]; act.gain(1); setTempo(120); undoEdit()
    let q = trk('kick').regs[0], s = SPB()
    ok('a change of tempo undone: the tempo is back, and the file as many seconds long as it was', S.tempo === T0 && !!q && Math.abs((q.b - q.a) * s - 10) < 1e-6 && Math.abs((q.off || 0) * s - 5) < 1e-6 && (q.gain || 0) === 1, q && [S.tempo, (q.b - q.a) * s, q.gain])
    redoEdit(); q = trk('kick').regs[0]; s = SPB()
    ok('and done again: the tempo, and the same seconds', S.tempo === 120 && Math.abs((q.b - q.a) * s - 10) < 1e-6, [S.tempo, (q.b - q.a) * s]) }
  { fresh(); trk('kick').regs = []; const A = file('kick', 5, 9, 0, 6, 'file:a'), B = file('kick', 9, 13, 0, 6, 'file:b'), was = JSON.stringify(lay('kick'))
    setTempo(120); const cut = JSON.stringify(lay('kick')); undoEdit()
    ok('files that stand end to start, the tempo up and undone: none has lost its end', JSON.stringify(lay('kick')) === was && cut !== was && S.tempo === T0, [lay('kick'), S.tempo]) }
  { fresh(); trk('kick').regs = []; const A = file('kick', 17, 25, 4, 40, 'file:a'), B = file('kick', 25, 33, 4, 40, 'file:b'); edit(() => { crossfade(A, B, 1) })
    setTempo(120)
    ok('two files that crossfade, and the tempo goes up: they crossfade still, and nothing is wrong on the lane', xfadeOf(A, B) > 0 && Math.abs(A.fo - xfadeOf(A, B)) < 1e-6 && !inv().length, [A.a, A.b, A.fo, B.a, B.fi, inv()])
    setTempo(70)
    ok('and down again', !inv().length, inv()) }
  /* what the second look found (2026-10-07, a reviewer's 27 cases): each as a line here */
  const two = () => { fresh(); trk('kick').regs = []; const A = file('kick', 17, 25, 2, 14, 'file:a'), B = file('kick', 25, 33, 2, 14, 'file:b'); return [A, B] }      // two different files that meet on bar 25, each with sound to run on with
  { fresh(); trk('hats').regs = []; const r = file('hats', 9.37, 12, 0, 10, 'file:a'), n = __commits; S.tool = 'pointer'
    const p = hAt('hats', 10.5, .6); hPress(p); hMove({ x: p.x + 1, y: p.y }); hMove(p); hUp()
    ok('a press with a pixel of wobble on a region that stands off the grid: it stays where it is, and nothing to undo', r.a === 9.37 && __commits === n, [r.a, __commits - n]) }
  { const [A, B] = cross(1), was = JSON.stringify(lay('kick')), n = __commits; S.tool = 'pointer'
    const p = hAt('kick', 20, .6); hPress(p); hMove({ x: p.x + PXB, y: p.y }); hMove({ x: p.x + 2 * PXB, y: p.y }); hMove(p); hUp()
    ok('a region that crossfades into the next, carried off and brought back before it is let go: as it was, crossfade and all', JSON.stringify(lay('kick')) === was && xfadeOf(...pair()) === 1 && __commits === n, [lay('kick'), __commits - n]) }
  { fresh(); const [kick, snare, hats, keys, air] = ['kick', 'snare', 'hats', 'keys', 'air'].map(trk)
    S.tracks = [air, snare, hats, kick, keys]; air.regs = []; keys.regs = []; kick.regs = kick.regs.slice(0, 1)
    S.sel = trki('snare'); S.selT = [snare.id, hats.id]; S.focus = 'tracks'; makeStack(); S.sel = S.tracks.findIndex(t => t.kind === 'stack'); foldStack(false)
    const was = [snare.regs.length, hats.regs.length, kick.regs.length]; act.selectAll(); const r = kick.regs[0]; S.tool = 'pointer'
    hDrag(hAt('kick', (r.a + r.b) / 2, .6), { x: hAt('kick', (r.a + r.b) / 2, .6).x, y: hAt('keys', 1, .5).y }, 5)
    ok('everything chosen, some of it on tracks inside a closed stack, pulled a row down: nothing changes rows', same([snare.regs.length, hats.regs.length, kick.regs.length], was) && !air.regs.length && !keys.regs.length && !inv().length, [snare.regs.length, hats.regs.length, kick.regs.length, air.regs.length, keys.regs.length]) }
  { cross(1); const i = trki('kick'); S.marq = { a: 22, b: 24.2, t0: i, t1: i }; marqMates(); act.copy(); S.marq = null; S.sel = i; S.pos = 12; act.paste()
    ok('a marquee that ends inside a crossfade, copied and pasted: one piece, as a cut there would have left it', same(lay('kick').slice(1, 2), [[13, 15.2, 22]]) && !inv().length, [lay('kick'), inv()]) }
  { fresh(); const ms = v => v / 1000 / SPB(), t = trk('hum'); t.regs = []
    const r1 = file('hum', 17 - ms(20), 21, 1, 20, 'file:v1'), r2 = file('hum', 21.5, 25 + ms(30), 1, 20, 'file:v2'); r1.fi = ms(10); r2.fo = ms(25)
    partAct(SCENES.findIndex(q => q.a === 17), 'repeat')
    const rs = t.regs.slice().sort((x, y) => x.a - y.a)
    ok('a part said twice, a take in it that begins 20 ms before its bar line and one that rings 30 ms past its end: both whole, in the first saying and the second',
      rs.length === 4 && Math.abs(rs[0].a - (17 - ms(20))) < 1e-9 && Math.abs(rs[0].off - 1) < 1e-9 && Math.abs(rs[0].fi - ms(10)) < 1e-9 && Math.abs(rs[2].a - (25 - ms(20))) < 1e-9 && Math.abs(rs[2].off - 1) < 1e-9 && Math.abs(rs[3].b - (33 + ms(30))) < 1e-9 && Math.abs(rs[3].fo - ms(25)) < 1e-9 && !inv().length, rs.map(r => [r.a, r.b, r.off, r.fi, r.fo]))
    ok('and where the first saying meets the second, the take that follows is heard as it is — its fade in its own, the bar line at full level — and the one before ends where it begins, with the fade out it had',
      Math.abs(rs[2].fi - ms(10)) < 1e-9 && Math.abs(rs[1].b - rs[2].a) < 1e-9 && Math.abs(rs[1].fo - ms(25)) < 1e-9, [rs[1].b, rs[2].a, rs[1].fo, rs[2].fi])
    fresh(); t.regs = []; const q1 = file('hum', 17 - ms(20), 21, 1, 20, 'file:v1'), q2 = file('hum', 21.5, 25 + ms(30), 1, 20, 'file:v2'); q1.fi = ms(10)
    partAct(SCENES.findIndex(q => q.a === 17), 'repeat'); const qs = t.regs.slice().sort((x, y) => x.a - y.a)
    ok('the same, the one before with no fade of its own: it ends where the one that follows begins, with a fade out as long as that one\'s fade in — the two share nothing', !xfadeOf(qs[1], qs[2]) && Math.abs(qs[1].b - qs[2].a) < 1e-9 && Math.abs(qs[1].fo - ms(10)) < 1e-9 && Math.abs(qs[2].fi - ms(10)) < 1e-9 && Math.abs(qs[2].a - (25 - ms(20))) < 1e-9 && !inv().length, [qs[1].b, qs[2].a, qs[1].fo, qs[2].fi, inv()])
    S.selR = [qs[1].id]; act.del()
    ok('and with the one before deleted, the one that follows has the fade in it had', Math.abs(qs[2].fi - ms(10)) < 1e-9 && Math.abs(qs[2].a - (25 - ms(20))) < 1e-9, [qs[2].a, qs[2].fi])
    fresh(); t.regs = []; const X = file('hum', 9, 13 + ms(10), 1, 20, 'file:end'), Y = file('hum', 21 - ms(15), 25, 1, 20, 'file:next'); X.fo = 2
    const sc = SCENES.map(q => [q.name, q.a]); SCENES = mkScenes([['a', 1], ['b', 13], ['c', 21], ['d', 29]]); timeAct.move(20, 28, 12); SCENES = mkScenes(sc)
    ok('a region that dies away over two bars, and a part moved to follow it: it dies away over two bars still, and ends where the part begins', Math.abs(X.fo - 2) < 1e-9 && Math.abs(X.b - Y.a) < 1e-9 && !Y.fi && !inv().length, [X.a, X.b, X.fo, Y.a, Y.fi, inv()])
    fresh(); t.regs = []; file('hum', 17, 21.012, 1, 20, 'file:a'); file('hum', 25, 41, 1, 30, 'file:b'); timeAct.cut(16, 20); PXB = 3000; timeAct.put(24)
    ok('a stretch taken out with the room far, and put in with the room near: the hair it rang on with gives way all the same, and nothing sounds twice', !inv().length && t.regs.length === 3, [t.regs.map(r => [r.a, r.b]), inv()]) }
  { fresh(); const t = trk('kick'), line = () => JSON.stringify(t.autos.vol.map(q => [r4(q.b), r4(q.v)])), idx = nm => SCENES.findIndex(q => q.name === nm)
    t.autos.vol = [[0, -40], [40, 0]].map(([b, v]) => ({ id: ++PID, b, v })); partAct(idx('pre'), 'earlier'); const moved = line(); partAct(idx('pre'), 'later')
    ok('a line that rises through the song, a part moved earlier and back: the line as it was (and with the part away, it stepped at its seams)', line() === '[[0,-40],[40,0]]' && moved !== line(), [moved, line()])
    fresh(); t.autos.vol = [[0, -48], [16, -48], [16, 0], [40, 0]].map(([b, v]) => ({ id: ++PID, b, v })); timeAct.room(16, 8)
    const step = t.autos.vol.slice(1, 3).map(q => q.id)
    ok('room made on the bar line where a line steps: the level it arrived with is held through the room, and the step stands at its end', line() === '[[0,-48],[24,-48],[24,0],[48,0]]', line())
    ok('and the step is the two points it was', same(t.autos.vol.slice(1, 3).map(q => q.id), step) && !t.autos.vol.some(q => q.e), t.autos.vol)
    timeAct.cut(16, 24)
    ok('and the room taken out again: the line, and its points, as they were', line() === '[[0,-48],[16,-48],[16,0],[40,0]]' && same(t.autos.vol.slice(1, 3).map(q => q.id), step) && !t.autos.vol.some(q => q.e), t.autos.vol)
    fresh(); t.autos.vol = [[0, -6], [8, -6], [16, -6], [24, 0]].map(([b, v]) => ({ id: ++PID, b, v })); const ids = t.autos.vol.map(q => q.id); S.selP = [ids[1]]; timeAct.room(8, 4)
    ok('a point that stands, on a level stretch, exactly where room is made: it is still there, and still chosen', line() === '[[0,-6],[8,-6],[20,-6],[28,0]]' && same(t.autos.vol.map(q => q.id), ids) && same(S.selP, [ids[1]]), [line(), t.autos.vol.map(q => q.id), S.selP])
    timeAct.cut(8, 12)
    ok('and the room taken out again: as it was', line() === '[[0,-6],[8,-6],[16,-6],[24,0]]' && same(t.autos.vol.map(q => q.id), ids), [line(), t.autos.vol.map(q => q.id)])
    fresh(); t.autos.vol = [[0, -12], [8, -6], [16, 0]].map(([b, v]) => ({ id: ++PID, b, v })); const cs = t.autos.vol.map(q => q.id); S.selP = []; timeAct.cut(8, 12)
    ok('time taken out from a corner of a line on: the corner is the point it was, and the line steps there to where it had got to', line() === '[[0,-12],[8,-6],[8,-3],[12,0]]' && t.autos.vol[1].id === cs[1] && !t.autos.vol[1].e && t.autos.vol[2].e === 1, t.autos.vol) }
  { const [A, B] = two(); S.selR = [A.id, B.id]; act.fades(); S.selR = [B.id]; act.repeat(); act.repeat()
    const cs = trk('kick').regs.filter(r => r.key === 'file:b' && r !== B).sort((x, y) => x.a - y.a)
    ok('the later of two that crossfade, said again twice: each copy begins on its bar line, not late by the run-on', cs.length === 2 && Math.abs(cs[0].a - 33) < 1e-9 && Math.abs(cs[0].off - 2) < 1e-9 && Math.abs(cs[1].a - 41) < 1e-9 && !cs[0].fi, cs.map(r => [r.a, r.off, r.fi])) }
  { fresh(); trk('kick').regs = []; const A = file('kick', 17, 25, 0, 8, 'file:a'), B = file('kick', 25, 33, 3, 12, 'file:b'); edit(() => { crossfade(A, B, 1) })
    const made = [A.b, B.a]; S.selR = []; S.selX = [A.id, B.id]; act.del()
    ok('a crossfade made where the first file has nothing to run on with, then taken off: the join is where it was', same(made, [25, 24]) && A.b === 25 && B.a === 25 && Math.abs(B.off - 3) < 1e-9, [made, A.b, B.a, B.off]) }
  { const [A, B] = two(); edit(() => { crossfade(A, B, 1) }); const i = trki('kick'); S.selR = []; S.marq = { a: A.b - 1, b: 27, t0: i, t1: i }; marqMates(); act.del()
    ok('a marquee from the far edge of a crossfade on, deleted: the region that stays keeps its fade out (it is not heard at full level where it only faded)', Math.abs(A.fo - 1) < 1e-9 && Math.abs(A.b - 25.5) < 1e-9 && !inv().length, [A.b, A.fo, lay('kick')]) }
  { const [A, B] = two(); S.selR = [A.id]; act.fades(); S.selR = [B.id]; act.fades(); const fo = A.fo; S.selR = [A.id]; S.nudge = '10 ms'; act.nudge(1)
    ok('two that meet, each with a short fade of its own; the first nudged later by exactly that much: it keeps its fade', fo > 0 && Math.abs(A.fo - fo) < 1e-12 && !inv().length, [fo, A.fo, inv()]) }
  { const [A, B] = cross(1); S.selR = [A.id, B.id]; S.pos = 20; act.trimTo(false)
    ok('⌘[ with both of a crossfade chosen: the first begins at the playhead, the second and the crossfade stay', A.a === 21 && B.a === 24.5 && xfadeOf(A, B) === 1 && !inv().length, lay('kick'))
    fresh(); const r = reg('kick', 17); S.selR = [r.id]; S.pos = 8; act.trimTo(true)
    ok('⌘] with the playhead before the region: nothing (it is not crushed)', r.a === 17 && r.b === 25, [r.a, r.b]) }
  { const [A, B] = cross(1); S.selR = [A.id, B.id]; act.shuffle(-1)
    ok('⌥[ on two chosen that crossfade: they go as one, against the region before', same(lay('kick').slice(0, 3), [[5, 13, 4], [13, 21.5, 16], [20.5, 29, 23.5]]) && xfadeOf(A, B) === 1, lay('kick')) }
  { fresh(); trk('kick').regs = []; const A = file('kick', 5, 13, 0, 8, 'file:take'); TRANS.set('file:take', Array.from({ length: 34 }, (_, j) => j * .61 + .13)); quantize.empty = true
    S.selR = [A.id]; S.pos = 7.9; act.splitAtPlayhead(); const B = trk('kick').regs.find(r => r !== A), src = (r, bar0) => dToS(r, dOfBar(r, bar0))
    S.selR = [A.id, B.id]; S.q = 1 / 16; await quantize([A, B])
    ok('two pieces of one take, quantized: they carry the same pins, and at the cut both play the same place in the file', A.flex.length > 4 && JSON.stringify(A.flex) === JSON.stringify(B.flex) && Math.abs(src(A, A.b - 1) - src(B, B.a - 1)) < 1e-9, [A.flex.length, B.flex.length, src(A, A.b - 1), src(B, B.a - 1)]) }
  { fresh(); const r = reg('kick', 17); S.selR = [r.id]; S.focus = 'lanes'; S.cycle = { on: true, a: 16, b: 24 }; timeAct.cut(16, 24); PXB = fitPXB(); VX = 0; KEYS.KeyZ()
    ok('a chosen region whose time is taken out of the song is no longer chosen, and Z leaves the view where it can be seen', !S.selR.length && isFinite(VX) && isFinite(bx(5)), [S.selR, VX]); PXB = 24; VX = 0 }
  { fresh(); const i = SCENES.findIndex(q => q.name === 'chorus'); S.selM = SCENES[i].a; S.focus = 'marker'; timeAct.room(8, 4); const n = SCENES.length; act.del()
    ok('a marker pressed, then room made before it: delete does not take another marker in its place', SCENES.length === n && SCENES.some(q => q.name === 'pre'), SCENES.map(q => q.name)) }

  /* a song from before one sound at a time was the rule: the same slice put down twice on one spot (the first song
     made here has sixteen such pairs). Nothing takes them apart unasked. */
  const doubled = () => {
    fresh(); trk('kick').regs = []
    for (let k = 0; k < 16; k++) { file('kick', 17 + k / 4, 17.25 + k / 4, 0, 8, 'file:s'); if (k >= 4 && k < 8) file('kick', 17 + k / 4, 17.25 + k / 4, 0, 8, 'file:s') }
    S.selR = trk('kick').regs.map(r => r.id)
  }
  const pairs = () => { const rs = trk('kick').regs; let n = 0; for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) if (Math.abs(rs[i].a - rs[j].a) < 1e-9 && Math.abs(rs[i].b - rs[j].b) < 1e-9) n++; return n }
  { doubled(); S.nudge = 'bar'; act.nudge(1)
    ok('regions that lie twice on one spot, all nudged a bar: still twice', trk('kick').regs.length === 20 && pairs() === 4 && Math.abs(Math.min(...trk('kick').regs.map(r => r.a)) - 18) < 1e-9, [trk('kick').regs.length, pairs()]) }
  { doubled(); S.tool = 'pointer'; hDrag(hAt('kick', 17.1, .6), hAt('kick', 21.1, .6), 6)
    ok('the same, moved by hand: still twice', trk('kick').regs.length === 20 && pairs() === 4, [trk('kick').regs.length, pairs(), lay('kick').slice(0, 3)]) }
  { doubled(); setTempo(120); const rs = trk('kick').regs.slice().sort((x, y) => x.a - y.a)
    ok('the tempo goes up under them: still twice, and each slice gives way only to the next', rs.length === 20 && pairs() === 4 && rs.slice(0, -1).every(r => Math.abs(r.b - r.a - .25) < 1e-9) && rs[19].b - rs[19].a > .3, [rs.length, pairs(), rs.slice(0, 3).map(r => [r.a, r.b]), rs[19].b - rs[19].a])
    S.selR = [rs[0].id]; act.gain(1); setTempo(92); undoEdit(); undoEdit(); undoEdit()
    ok('and all of it undone, the two changes of tempo too: still twice, as at first', S.tempo === T0 && trk('kick').regs.length === 20 && pairs() === 4 && trk('kick').regs.every(r => Math.abs(r.b - r.a - .25) < 1e-9), [S.tempo, trk('kick').regs.length, pairs()]) }
  { doubled(); S.selR = []; timeAct.room(18, 2)
    ok('room made in the middle of them: still twice, on either side', trk('kick').regs.length === 20 && pairs() === 4, [trk('kick').regs.length, pairs()]) }
  /* what the third look found */
  { fresh(); const t = trk('hats'); t.regs = []; const a = file('hats', 9.37, 12, 0, 10, 'file:a'); S.tool = 'pointer'
    const p = hAt('hats', 10.5, .6), n = __commits, ev = q => ({ clientX: q.x * 1440 / W, clientY: q.y * 900 / H, button: 0, pointerId: 1, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, preventDefault () {}, target: { closest: () => ({ dataset: { a: 'lanes' } }) } })
    drag = null; onDown(ev(p)); onMove(ev({ x: p.x + 1, y: p.y })); onUp()
    ok('a press with a pixel of wobble, through the page\'s own press, move and let-go (which mark any drag at its first move): the region stays, nothing to undo', a.a === 9.37 && __commits === n, [a.a, __commits - n])
    drag = null; LASTP = null; onDown(ev(p)); onMove(ev({ x: p.x + 30, y: p.y })); onMove(ev({ x: p.x + 60, y: p.y })); onUp()
    ok('and pulled on, it goes', a.a > 10 && __commits === n + 1, [a.a, __commits - n]) }
  { const [A, B] = two(); edit(() => { crossfade(A, B, 1) }); S.selR = [A.id]; act.repeat(); const rs = trk('kick').regs.slice().sort((x, y) => x.a - y.a)
    ok('the first of two that crossfade, said again: it ends on the join with no fade, and its copy begins there — no hole in front of it', rs.length === 2 && rs[0] === A && A.b === 25 && !A.fo && rs[1].a === 25 && !rs[1].fi && rs[1].key === 'file:a' && !inv().length, rs.map(r => [r.a, r.b, r.fi, r.fo, r.key])) }
  { fresh(); const t = trk('hum'); t.regs = []; const A = file('hum', 9, 17, 2, 14, 'file:a'), B = file('hum', 17, 25, 2, 14, 'file:b'); edit(() => { crossfade(A, B, 1) })
    partAct(SCENES.findIndex(q => q.a === 17), 'repeat'); const rs = t.regs.slice().sort((x, y) => x.a - y.a)
    ok('a part that is crossfaded into, said twice: the crossfade leads into its first saying as it did, and its second begins at full level on its bar line', rs.length === 3 && xfadeOf(rs[0], rs[1]) === 1 && Math.abs(joinOf(rs[0], rs[1]) - 17) < 1e-9 && rs[2].a === 25 && !rs[2].fi && rs[1].b === 25 && !rs[1].fo && !inv().length, rs.map(r => [r.a, r.b, r.fi, r.fo])) }
  { const [A, B] = two(); A.srcBars = 14; B.off = 6; edit(() => { crossfade(A, B, 2) }); const sec = bar => (bar - 1) * SPB(), j0 = sec(joinOf(A, B))
    setMeter(2, 4); const j1 = sec(joinOf(A, B)); S.selX = [A.id, B.id]; S.selR = []; act.del(); const e1 = sec(A.b); setMeter(4, 4)
    ok('the measure changed under a crossfade: its join is the moment it was, and taking the crossfade off leaves the two meeting there', Math.abs(j1 - j0) < 1e-9 && Math.abs(e1 - j0) < 1e-9, [j0, j1, e1]) }
  { fresh(); trk('kick').regs = []; const A = file('kick', 5, 13, 0, 8, 'file:take'); TRANS.set('file:take', Array.from({ length: 34 }, (_, j) => j * .61 + .13)); quantize.empty = true
    S.selR = [A.id]; S.pos = 8; act.splitAtPlayhead(); const B = trk('kick').regs.find(r => r !== A), src = (r, bar0) => dToS(r, dOfBar(r, bar0))
    S.flex = true; S.tool = 'flex'; { const x = xOfD(B, sToD(B, 15.99)), y = hAt('kick', 1, .5).y; hPress({ x, y }); hMove({ x: x + 14, y }); hUp() } S.tool = 'pointer'; S.flex = false
    const at = [8.2, 9.3, 10.1, 11.4], was = at.map(b => src(B, b)), pinned = A.flex.length
    S.selR = [A.id]; S.q = 1 / 16; await quantize([A])
    ok('a pin pulled by hand in one piece of a take, then the other piece alone quantized: the first plays what it played, everywhere', pinned === 3 && at.every((b, i) => Math.abs(src(B, b) - was[i]) < 1e-9) && A.flex.length > 4 && JSON.stringify(A.flex) === JSON.stringify(B.flex) && Math.abs(src(A, A.b - 1) - src(B, B.a - 1)) < 1e-9, [pinned, A.flex.length, at.map(b => src(B, b)), was]) }
  { fresh(); trk('kick').regs = []; const A = file('kick', 5, 13, 0, 8, 'file:take'); TRANS.set('file:take', Array.from({ length: 34 }, (_, j) => j * .61 + .13))
    S.selR = [A.id]; S.pos = 8; act.splitAtPlayhead(); const B = trk('kick').regs.find(r => r !== A), src = (r, bar0) => dToS(r, dOfBar(r, bar0))
    B.flex = [{ s: 14.77, d: 14.77 }, { s: 15.38, d: 15.60 }, { s: 15.99, d: 15.99 }]; const was = src(B, 9.95), pins = JSON.stringify(B.flex)
    S.flex = true; S.tool = 'flex'; { const x = xOfD(A, sToD(A, 4.4)), y = hAt('kick', 1, .5).y; hPress({ x, y }); hMove({ x: x + 14, y }); hUp() } S.tool = 'pointer'; S.flex = false
    ok('a piece that has pins of its own (from before pieces shared theirs), and a pin moved on its sibling: its own pins stay, and it plays what it played', (A.flex || []).length > 0 && JSON.stringify(B.flex) === pins && Math.abs(src(B, 9.95) - was) < 1e-9, [A.flex, B.flex, src(B, 9.95), was]) }
  { const [A, B] = two(); edit(() => { crossfade(A, B, .5) }); A.fi = (A.b - A.a) - A.fo                       // the first is all fades: its own fade in, then the crossfade
    const P = file('kick', 9, 17 + 5e-5, 0, 20, 'file:p'), fo = A.fo; edit(() => { settle([[P, trk('kick'), P.a - 1, P.b - 1]]) })
    ok('something put down that ends a hair inside a region that is all fade in and crossfade: the hair is given up, the crossfade stays as long as it was, and the fade in gives way', Math.abs(A.a - (17 + 5e-5)) < 1e-12 && A.fo === fo && Math.abs(xfadeOf(A, B) - .5) < 1e-9 && A.fi < (A.b - A.a) - A.fo + 1e-12 && !inv().length, [A.a, A.b, A.fi, A.fo, B.a, B.fi, inv()]) }
  { fresh(); const key = code => onKey({ code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, repeat: false, target: null, preventDefault () {} })
    const r = reg('kick', 17), n = __commits; S.selR = [r.id]; S.pos = 18; key('BracketLeft'); const a1 = r.a; S.pos = 22; key('BracketRight')
    ok('[ and ] by themselves: what is chosen begins, then ends, at the playhead (as ⌘[ and ⌘] do), a step each', a1 === 19 && r.a === 19 && r.b === 23 && __commits === n + 2 && !inv().length, [a1, r.a, r.b, __commits - n]) }
  /* what the fourth look found: parts of the song said twice, moved and cut where takes begin a moment early, die away, or crossfade */
  { const hum = () => { fresh(); const t = trk('hum'); t.regs = []; return t }, parts = list => { const was = SCENES.map(q => [q.name, q.a]); SCENES = mkScenes(list); return () => { SCENES = mkScenes(was) } }
    const part = nm => SCENES.findIndex(q => q.name === nm), lane = t => t.regs.slice().sort((x, y) => x.a - y.a), near = (x, y) => Math.abs(x - y) < 1e-9
    { const t = hum(), A = file('hum', 9 - .004, 17, 1, 12, 'file:verse'), B = file('hum', 17, 25, 1, 12, 'file:chorus'); A.fi = .004
      S.selR = [A.id, B.id]; act.fades(); S.selR = []; const back = parts([['intro', 1], ['verse', 9], ['chorus', 17], ['out', 25]])
      partAct(part('verse'), 'later'); const rs = lane(t); back()
      ok('two parts that crossfade into each other change places, the first take beginning a moment early: nothing sounds twice, and the take keeps its head and its fade in', !inv().length && rs.length === 2 && rs[0].key === 'file:chorus' && near(rs[0].b, rs[1].a) && near(rs[1].a, 17 - .004) && near(rs[1].fi, .004), [rs.map(r => [r.key, r.a, r.b, r.fi, r.fo]), inv()]) }
    { const t = hum(), V = file('hum', 9, 17 + .004, 0, 12, 'file:verse'), P = file('hum', 17.5, 20.5, 0, 6, 'file:part'), C = file('hum', 21 - .004, 29, 1, 12, 'file:chorus'); V.fo = .5; C.fi = .25
      const back = parts([['a', 1], ['verse', 9], ['pre', 17], ['chorus', 21]]); partAct(part('pre'), 'repeat'); back()
      ok('a part said twice between a region that dies away and rings a moment past its line and a take that swells in from a moment before the next: neither is touched', near(V.b, 17 + .004) && near(V.fo, .5) && near(C.a, 25 - .004) && near(C.fi, .25) && t.regs.length === 4 && !inv().length, [[V.a, V.b, V.fo], [C.a, C.b, C.fi], t.regs.length, inv()]) }
    { const t = hum(), V = file('hum', 5, 9, 1, 12, 'file:verse'), P = file('hum', 9, 13, 1, 12, 'file:pre'), C = file('hum', 13 - .008, 17, 1, 12, 'file:chorus'); C.fi = .004
      const back = parts([['intro', 1], ['verse', 5], ['pre', 9], ['chorus', 13], ['out', 17]])
      partAct(part('pre'), 'later'); const away = [V.b, V.fo, C.a]; partAct(part('pre'), 'earlier'); back()
      ok('a part moved later, so that the next take with its early head follows the verse: the verse ends where the take begins, fading as the take fades in', near(away[0], away[2]) && near(away[1], .004), away)
      ok('and moved back in a second edit: the verse is as it was — its end, no fade, and no hole before the part', near(V.b, 9) && !V.fo && !V.sm && near(P.a, 9) && near(C.a, 13 - .008) && near(C.fi, .004) && !inv().length, [[V.a, V.b, V.fo, V.sm], [P.a, P.b], [C.a, C.fi], inv()]) }
    { const t = hum(), K = file('hum', 17 - .004, 21, 1, 12, 'file:take'), X = file('hum', 25 - .002, 25, 0, 4, 'file:tick')
      const back = parts([['intro', 1], ['a', 17], ['b', 25]]); partAct(part('a'), 'repeat'); back()
      ok('a part said twice, a sliver at its very end lying under the head of the take that begins its second saying: the sliver is gone, nothing sounds twice', !inv().length && t.regs.filter(r => r.key === 'file:take').length === 2 && t.regs.filter(r => r.key === 'file:tick').length === 1, [lane(t).map(r => [r.key, r.a, r.b]), inv()]) }
    { const t = hum(), A = file('hum', 9, 16.75, 1, 14, 'file:verse'), B = file('hum', 16.75, 25, 3, 14, 'file:chorus'); edit(() => { crossfade(A, B, 1) })
      const back = parts([['intro', 1], ['verse', 9], ['chorus', 17], ['out', 25]]), was = [A.b, B.a, B.off, joinOf(A, B)]; partAct(part('chorus'), 'repeat'); back()
      ok('a crossfade that lies over a part\'s line, about a place before it; the part said twice: in the first saying the crossfade lies where it lay, about the same place', near(A.b, was[0]) && near(B.a, was[1]) && near(B.off, was[2]) && near(joinOf(A, B), was[3]) && near(xfadeOf(A, B), 1) && !inv().length, [[A.b, B.a, B.off, joinOf(A, B)], was, inv()]) }
    { const t = hum(), A = file('hum', 9, 24, 0, 20, 'file:verse'), B = file('hum', 24, 33, 4, 20, 'file:chorus'); edit(() => { crossfade(A, B, 2) })
      const back = parts([['intro', 1], ['verse', 9], ['verse 2', 17], ['chorus', 25], ['out', 33]]); partAct(part('chorus'), 'earlier'); back(); const rs = lane(t)
      ok('a crossfade that ends on a part\'s line, the region before it running over two parts; the part moved earlier: no crossfade is made where another end of that region now meets it', rs.length === 3 && rs[1].key === 'file:chorus' && !rs[1].fi && !xfadeOf(rs[0], rs[1]) && near(rs[0].b, 17) && near(rs[1].a, 17) && !inv().length, [rs.map(r => [r.key, r.a, r.b, r.fi, r.fo]), inv()]) }
    { const t = hum(), P = file('hum', 15, 21, 0, 12, 'file:pad'); P.fi = 4
      const back = parts([['intro', 1], ['verse', 9], ['chorus', 17], ['out', 21]]); partAct(part('chorus'), 'repeat')
      ok('a region that swells in across a part\'s first line, the part said twice: its swell is as long as it was', near(P.fi, 4) && near(P.a, 15) && near(P.b, 21) && !inv().length, [P.a, P.b, P.fi, inv()])
      fresh(); const t2 = trk('hum'); t2.regs = []; const Q = file('hum', 15, 21, 0, 12, 'file:pad'); Q.fi = 4; timeAct.cut(16, 20); const cut = t2.regs.length; timeAct.put(16); back()
      ok('and with the part cut out and put back where it was: one region again, its swell as long as it was', cut === 1 && t2.regs.length === 1 && near(t2.regs[0].fi, 4) && near(t2.regs[0].a, 15) && near(t2.regs[0].b, 21) && !inv().length, [cut, t2.regs.map(r => [r.a, r.b, r.fi]), inv()]) }
    { const mk = () => { const t = hum(), A = file('hum', 9, 17, 1, 12, 'file:verse'), B = file('hum', 17, 25, 1, 12, 'file:chorus'); edit(() => { crossfade(A, B, X) }); return [t, A, B] }
      let [t, A, B] = mk(); timeAct.room(16, 4)
      ok('room made on the join of a crossfade: each of the two keeps its half of the fade — neither ends bare in the silence', near(A.b, 17) && near(A.fo, X / 2) && near(B.a, 21) && near(B.fi, X / 2) && !inv().length, [[A.b, A.fo], [B.a, B.fi], inv()])
      ;[t, A, B] = mk(); const back = parts([['intro', 1], ['verse', 9], ['chorus', 17], ['out', 25]]); partAct(part('chorus'), 'cut'); back()
      ok('the part after the join cut out of the song: the one before it ends with its half of the fade', t.regs.length === 1 && near(A.b, 17) && near(A.fo, X / 2), [t.regs.length, A.b, A.fo]) }
    { fresh(); const t = trk('kick'), pts = () => t.autos.vol.map(q => [r4(q.b), r4(q.v), q.e ? 1 : 0])
      t.autos.vol = [[0, -6], [4, -10], [8, -10], [12, -10], [12, -6], [16, -6]].map(([b, v]) => ({ id: ++PID, b, v })); timeAct.cut(8, 12); timeAct.put(8)
      ok('a stretch cut out of a line that steps at its end, and put back: as many set points as there were, each level where it was', same(pts(), [[0, -6, 0], [4, -10, 0], [8, -10, 0], [12, -10, 0], [12, -6, 0], [16, -6, 0]]), pts())
      fresh(); t.autos.vol = [[0, -12], [32, 0]].map(([b, v]) => ({ id: ++PID, b, v })); timeAct.room(8, 4); timeAct.move(4, 16, 20); timeAct.move(8, 20, 4); timeAct.cut(8, 12)
      ok('room made in a ramp, the stretch around it moved away and back, the room cut out again: the two points the ramp was', same(pts(), [[0, -12, 0], [32, 0, 0]]), pts()) }
  }
  fresh()
  console.log('cases: ' + (bad ? bad + ' FAILED' : 'all passed'))
  return bad
})()
