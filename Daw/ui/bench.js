/* ── the measure (the app started with --selftest=bench; see bench.sh) ──
   Sessions of growing size are made here and put through the real page and the real engine, and what each costs is
   written down: how long the page takes to draw and to edit, how much of a core the engine needs to play it (run as fast
   as it will go, in blocks of 512, 64 and 32), what the device's own blocks cost while it plays, and how much memory the
   app holds. Nothing here is heard: the check runs with the speakers silent. */
const AU = id => `AudioUnit:Effects/aufx,${id},appl`
const BENCH = { src: null, sessions: [
  ['8 tracks', { tracks: 8, regs: 8, patched: 2, buses: 1 }], ['32 tracks', { tracks: 32, regs: 32, patched: 8, buses: 2 }],
  ['100 tracks', { tracks: 100, regs: 40, patched: 16, buses: 4 }], ['200 tracks', { tracks: 200, regs: 50, patched: 0, buses: 4 }],
  /* plug-ins from outside (the Mac's own): three light ones on each of 24 tracks — they give the same sound every time, so they can show that many threads play what one plays;
     and two heavy ones on each of 16, to show what the threads are for */
  ['24 with plug-ins', { tracks: 24, regs: 8, patched: 0, buses: 2, inserts: [AU('dely'), AU('pmeq'), AU('dcmp')] }],
  ['16 with heavy plug-ins', { tracks: 16, regs: 8, patched: 0, buses: 2, inserts: [AU('mrev'), AU('nptc')] }],
] }
/* a session of o.tracks audio tracks, each with o.regs regions of one file end to end over o.bars bars; the first o.patched
   carry a patch; every third plays into a bus and every fourth sends to one */
async function benchSession (o) {
  halt(false)
  const src = BENCH.src, bars = o.bars || 64, len = bars / o.regs
  const mk = (name, kind) => { const t = mkTrack(name, null, null, null, null, -14, [], NO_PATCH(), { kind }); t.patch0 = copy(t.patch); return t }
  const tracks = [], buses = []
  for (let i = 0; i < o.tracks; i++) {
    const t = mk(`t ${i + 1}`, 'audio')
    for (let k = 0; k < o.regs; k++) t.regs.push(mkReg({ a: 1 + k * len, b: 1 + (k + 1) * len, key: src.key, file: src.file, peaksAll: src.peaks, loop: false, rate: 1, sec: src.sec, srcBars: src.sec / SPB(), off: ((i * 7 + k * 3) % 5) * .25, name: 'bench' }))
    if (i < o.patched) { t.patch = mkPatch(30, 30, 20, [30, 30, 20]); t.patch0 = copy(t.patch) }
    t.pan = ((i % 5) - 2) / 4
    tracks.push(t)
  }
  for (let k = 0; k < (o.buses || 0); k++) buses.push(mk(`bus ${k + 1}`, 'bus'))
  tracks.forEach((t, i) => { if (!buses.length) return; if (i % 3 === 0) t.out = buses[i % buses.length].id; if (i % 4 === 1) t.sends.push({ to: buses[(i + 1) % buses.length].id, db: -9 }) })
  S.tracks = tracks.concat(buses); S.sel = 0; S.selR = []; S.selT = []; S.selP = []; S.marq = null; S.focus = 'lanes'; S.cycle = { on: false, a: 0, b: 4 }; S.pos = 0
  SONG_END = bars; SCENES = mkScenes([['a', 1], ['b', Math.round(bars / 2) + 1]]); UNDO.length = 0; REDO.length = 0
  S.panel.on = false; S.slur = false; repaint(); setView(true); PXB = fitPXB(); VX = 0; VY = 0
  await natSession(); applyAll()
  let put = 0
  for (const id of o.inserts || []) for (let i = 0; i < o.tracks; i++) { const r = await natInsert(i, id); if (r && r.ok) put++ }
  await NAT.call('log', { text: `bench: ${o.tracks} tracks, ${o.tracks * o.regs} regions, ${put} plug-ins` })
  return put
}
async function runBench ({ sleep, note, step, device }) {
  const ms = v => +v.toFixed(2)
  const time = (fn, n = 5) => { const t0 = performance.now(); for (let k = 0; k < n; k++) fn(); return ms((performance.now() - t0) / n) }
  const mem = async () => +(await NAT.call('testMemory')).mb.toFixed(1)
  const none = { shiftKey: false, metaKey: false, altKey: false, ctrlKey: false }
  await step('up', async () => ({ toThePage: +(BOOT.up || 0).toFixed(2), thenToReady: ms((BOOT.ready - BOOT.page) / 1000), memory: await mem(), cores: navigator.hardwareConcurrency, sr: SND_SR, block: STAT.buf }))
  PROJ.name = 'bench'
  /* the sound the sessions are made of: thirty seconds, made by the app and decoded like any file */
  await step('source', async () => {
    const m0 = await mem(), f = await NAT.call('testFile', { project: 'bench', name: 'bench source', sec: 30 }), t0 = performance.now()
    const d = await NAT.call('audioLoad', { project: 'bench', file: f.file })
    BENCH.src = d
    return { made: f.ok, megabytes: +f.mb.toFixed(1), decoded: !!(d && d.ok), sec: d && d.sec, decodeMs: ms(performance.now() - t0), memoryAdded: +((await mem()) - m0).toFixed(1) }
  })
  if (!BENCH.src || !BENCH.src.ok) return
  for (const [name, o] of BENCH.sessions) {
    await step(name, async () => {
      const res = { tracks: o.tracks, regions: o.tracks * o.regs, patched: o.patched, buses: o.buses }
      const m0 = await mem(), t0 = performance.now()
      res.plugins = await benchSession(o)
      res.build = ms(performance.now() - t0)
      await sleep(400)
      res.memory = await mem(); res.memoryAdded = +(res.memory - m0).toFixed(1)
      /* the page */
      const page = res.page = {}
      page.drawAll = time(() => __daw.redraw(), 3)
      page.drawLanes = time(() => { pLanes() })
      page.drawHeads = time(() => { $('g-head').innerHTML = pHead() })
      page.nodes = document.querySelectorAll('#svg *').length
      page.undoCopy = time(() => editState())
      page.save = time(() => serialize(), 3); page.saveBytes = serialize().length
      page.snap = time(() => snapPos(10.3, null), 20)
      { const t1 = performance.now(); await natSession(); page.tellEngine = ms(performance.now() - t1) }
      { const r = S.tracks[1].regs[2], t1 = performance.now(); edit(() => { r.gain = -1; dirtyReg(r) }); flush(); page.editJs = ms(performance.now() - t1); await NAT.call('log', { text: 'bench: after an edit' }); page.editDone = ms(performance.now() - t1); undoEdit(); flush() }
      { act.selectAll(); page.chooseAll = time(() => selRegs(), 2); const t1 = performance.now(); flush(); __daw.redraw(); page.drawAllChosen = ms(performance.now() - t1); S.selR = [] }
      {                                                                               // a region taken and pulled along: what each move of the pointer costs, drawn
        __daw.redraw()
        const t = S.tracks[2], r = t.regs[1], p = { x: bx(r.a) + (bx(r.b) - bx(r.a)) / 2, y: rowY(2) + S.rh / 2 }
        lanesDown(none, p)
        const t1 = performance.now(), n = 24
        for (let k = 1; k <= n; k++) { if (drag) lanesMove(none, { x: p.x + k * 2, y: p.y }); flush() }
        page.pullFrame = ms((performance.now() - t1) / n)
        if (drag) { lanesUp(); drag = null } flush(); undoEdit(); flush()
      }
      { VY = maxVY(); const t1 = performance.now(); for (let k = 0; k < 10; k++) { VY = Math.max(0, VY - S.rh * 3); pLanes(); $('g-head').innerHTML = pHead() } page.scrollFrame = ms((performance.now() - t1) / 10); VY = 0 }
      { setZoom(120, 8); page.drawZoomed = time(() => { pLanes() }); setZoom(0) }
      { S.panel.on = true; S.panel.tab = 'mixer'; setView(true); page.drawMixer = time(() => { $('g-dock').innerHTML = pDock() }); S.panel.on = false; setView(true) }
      /* the engine, as fast as it will go */
      res.engine = {}
      for (const block of [512, 64, 32]) {
        const m = await NAT.call('testMeasure', { a0: 0, a1: 8, block, fresh: 1 })
        res.engine['block ' + block] = m && m.ok ? { load: +m.load.toFixed(4), meanMs: +m.mean.toFixed(4), p99Ms: +m.p99.toFixed(4), worstMs: +m.worst.toFixed(4), blockLastsMs: +m.lasts.toFixed(3), mark: m.mark, threads: m.threads, shared: m.shared } : { failed: true }
      }
      /* the same stretch played by one thread alone: it must come out the same, to the last bit */
      { const all = res.engine['block 512']; await NAT.call('testHands', { n: 0 })
        const one = await NAT.call('testMeasure', { a0: 0, a1: 8, block: 512, fresh: 1 }), one32 = await NAT.call('testMeasure', { a0: 0, a1: 8, block: 32, fresh: 1 })
        await NAT.call('testPerf'); play(0); await sleep(2000); const p1 = await NAT.call('testPerf'); halt(false)
        await NAT.call('testHands', { n: -1 })
        res.alone = { load: +one.load.toFixed(4), load32: +one32.load.toFixed(4), sameSound: one.mark === all.mark, sameSound32: one32.mark === res.engine['block 32'].mark, playing: { load: +p1.load.toFixed(4), worst: +p1.worst.toFixed(4), over: p1.over } } }
      { const again = await NAT.call('testMeasure', { a0: 0, a1: 8, block: 512, fresh: 1 }); res.engine.sameAgain = !!again && again.mark === res.engine['block 512'].mark }
      /* the device's own blocks, while it plays for three seconds */
      await NAT.call('testPerf'); play(0); await sleep(3000)
      { const p = await NAT.call('testPerf'); halt(false); res.playing = { blocks: p.blocks, load: +p.load.toFixed(4), worst: +p.worst.toFixed(4), over: p.over, held: p.held, block: p.block, threads: p.threads, shared: p.shared } }
      /* the same, while a region is being cut and put back four times a second (each edit tells the engine the whole session again) */
      await NAT.call('testPerf'); play(0)
      for (let k = 0; k < 12; k++) { const r = S.tracks[k % S.tracks.length].regs[3]; if (r) edit(() => { r.gain = -(k % 3); dirtyReg(r) }); await sleep(250) }
      { const p = await NAT.call('testPerf'); halt(false); res.playingWhileEditing = { blocks: p.blocks, load: +p.load.toFixed(4), worst: +p.worst.toFixed(4), over: p.over, held: p.held } }
      /* the device itself asked for small blocks — 64 samples, then 32 — and the session played through it for three seconds each:
         how hard the machine works, how many blocks took longer than they last, and how many the device says it lost.
         Only when asked for (./bench.sh device): a device's block is the device's, for every program that plays through it,
         so this is not done behind the back of another one that is open (Logic, say). */
      if (device) { const was = await NAT.call('testBlock', { n: 0 })
        res.smallBlocks = { device: was && was.name, sizes: was && was.sizes, was: was && was.block }
        if (was && was.ok && was.block) try {
          for (const want of [64, 32]) {
            const got = await NAT.call('testBlock', { n: want }); await sleep(700)
            await NAT.call('testPerf'); play(0); await sleep(3000)
            const p = await NAT.call('testPerf'); halt(false)
            res.smallBlocks['block ' + want] = { got: got && got.block, error: got && got.error, outLatency: got && got.outLatency, blocks: p.blocks, load: +p.load.toFixed(4), worst: +p.worst.toFixed(4), over: p.over, held: p.held, xruns: p.xruns }
          }
        } finally { const back = await NAT.call('testBlock', { n: was.block }); res.smallBlocks.back = back && back.block; await sleep(500) }
      }
      return res
    })
  }
  /* the sound of a file kept on the disk and read from there, against the same file held in memory: the same samples */
  await step('sound on disk', async () => {
    halt(false)
    const out = {}
    for (const [name, rate, ch] of [['same rate', 0, 2], ['another rate', SND_SR === 48000 ? 44100 : 48000, 2], ['one channel, 96k', 96000, 1]]) {
      const f = await NAT.call('testFile', Object.assign({ project: 'bench', name: 'sound ' + name, sec: 21, ch }, rate ? { rate } : {}))
      const r = await NAT.call('testSound', { project: 'bench', file: f.file })
      out[name] = r && r.ok ? { frames: r.frames, same: r.same, worst: r.worst, fromDisk: r.mapped, sameOutline: r.samePeaks } : { failed: true }
    }
    return out
  })
  /* a project of long files: how long it takes to open, and what it holds in memory */
  await step('long files', async () => {
    halt(false)
    const n = 12, sec = 180, made = []
    const t0 = performance.now()
    for (let k = 0; k < n; k++) { const f = await NAT.call('testFile', { project: 'bench long', name: `long ${k + 1}`, sec, ch: 1 }); made.push(f.file) }
    const wrote = ms(performance.now() - t0)
    PROJ.name = 'bench long'
    const m0 = await mem(), t1 = performance.now(), tracks = []
    for (let k = 0; k < n; k++) {
      const d = await NAT.call('audioLoad', { project: 'bench long', file: made[k] })
      const t = mkTrack(`long ${k + 1}`, null, null, null, null, -12, [], NO_PATCH()); t.patch0 = copy(t.patch)
      if (d && d.ok) t.regs.push(mkReg({ a: 1, b: 1 + d.sec / SPB(), key: d.key, file: d.file, peaksAll: d.peaks, loop: false, rate: 1, sec: d.sec, srcBars: d.sec / SPB(), name: 'long' }))
      tracks.push(t)
    }
    const firstLoad = ms(performance.now() - t1)
    S.tracks = tracks; S.sel = 0; SONG_END = 72; SCENES = []; repaint(); setView(true); await natSession(); applyAll()
    await sleep(300)
    const held = +((await mem()) - m0).toFixed(1)
    const saved = await saveNow(false, true)
    const t2 = performance.now(), opened = await loadProject('bench long'), openAgain = ms(performance.now() - t2)
    const afterOpen = await mem()
    await NAT.call('testPerf'); play(0); await sleep(2500); const p = await NAT.call('testPerf'); halt(false)
    const jump = await (async () => { await NAT.call('testPerf'); play(40); await sleep(1500); const q = await NAT.call('testPerf'); halt(false); return { load: +q.load.toFixed(4), worst: +q.worst.toFixed(4), over: q.over } })()
    return { files: n, minutesEach: sec / 60, wroteMs: wrote, firstLoadMs: firstLoad, memoryBefore: m0, memoryHeld: held, saved, opened, openAgainMs: openAgain, memoryAfterOpen: afterOpen, memoryAfterPlaying: await mem(), playing: { load: +p.load.toFixed(4), worst: +p.worst.toFixed(4), over: p.over, held: p.held }, playingFromBar41: jump }
  })
}
