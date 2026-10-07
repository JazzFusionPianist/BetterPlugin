/* ── the app's own check (it runs with --selftest, speakers silent, a tone standing in for the microphone) ──
   It drives the real page and the real engine, listens through the engine's meter, and writes what it found. */
async function runSelfTest (mode) {
  const sleep = ms => new Promise(r => setTimeout(r, ms))
  const note = (key, value) => NAT.call('testNote', { key, value: JSON.stringify(value === undefined ? null : value) })
  const listen = async ms => { await NAT.call('testMeter'); await sleep(ms); const m = await NAT.call('testMeter'); return { rms: +m.rms.toFixed(4), peak: +m.peak.toFixed(4) } }
  const snap = async name => { __daw.redraw(); await sleep(120); await NAT.call('testSnap', { name }); await sleep(250) }
  const wanted = /^steps:/.test(mode || '') ? new Set(mode.slice(6).split(',')) : null      // --selftest=steps:a,b — only those steps (for trying one out; the whole check is what counts)
  const step = async (key, fn) => { if (wanted && !wanted.has(key)) return; try { await note(key, await fn()) } catch (e) { await note(key, { error: String((e && e.stack) || e).slice(0, 400) }) } }
  const track = name => S.tracks.find(t => t.name === name)
  const playFrom = async bar => { halt(false); play(bar); await sleep(350) }
  const only = async (t, fn) => { for (const x of S.tracks) x.solo = x === t; applyAll(); const r = await fn(); for (const x of S.tracks) x.solo = false; applyAll(); return r }
  /* real pointer and key events on the page, at places given in the board's own units; a control is found by what it does */
  const at = (x, y) => { const b = document.getElementById('board').getBoundingClientRect(), k = b.width / W; return { clientX: b.left + x * k, clientY: b.top + y * k } }
  const mid = (sel, fx = .5, fy = .5) => { flush(); const el = document.querySelector(sel); if (!el) throw new Error('nothing to press: ' + sel); const r = el.getBoundingClientRect(), b = document.getElementById('board').getBoundingClientRect(), k = b.width / W; return [(r.left + r.width * fx - b.left) / k, (r.top + r.height * fy - b.top) / k] }
  const tap = (sel, more) => { const [x, y] = mid(sel); press(x, y, more) }
  const fire = (type, x, y, el, more) => { const p = at(x, y); (el || document.elementFromPoint(p.clientX, p.clientY)).dispatchEvent(new PointerEvent(type, Object.assign({ bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }, p, more || {}))) }
  const press = (x, y, more) => { fire('pointerdown', x, y, null, more); fire('pointerup', x, y, window, more) }
  const pull = async (x0, y0, x1, y1, more) => { fire('pointerdown', x0, y0, null, more); for (let k = 1; k <= 4; k++) fire('pointermove', x0 + (x1 - x0) * k / 4, y0 + (y1 - y0) * k / 4, window, more); fire('pointerup', x1, y1, window, more); flush(); await sleep(60) }
  const keyDown = (code, mods) => window.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: code, code, bubbles: true, cancelable: true }, mods || {})))
  const pickMenu = async label => { flush(); await sleep(40); const m = S.menu; if (!m) return false; const i = m.items.findIndex(it => it.t === label); if (i < 0) { S.menu = null; uiDirty('menu'); flush(); return false } const it = m.items[i]; S.menu = null; uiDirty('menu'); m.pick(it); await sleep(80); flush(); return true }
  await sleep(600)
  if (mode === 'bench' || mode === 'benchdevice') { await runBench({ sleep, note, step, device: mode === 'benchdevice' }); await note('page', { errors: window.__errs || [] }); await NAT.call('testDone'); return }      // only this: the measure
  /* only this: a bad end, and what comes back after it. First run (--selftest=crash): a song with a plug-in on one track and a
     take running on another; then that plug-in brings the app down in the middle of a block. The check is then started
     again (--selftest=back) and says what it finds. */
  if (mode === 'crash') {
    await step('before', async () => {
      const r = await natInsert(0, 'AudioUnit:Effects/aufx,dely,appl')
      const t = newTrack('audio', 'vox'); S.sel = S.tracks.indexOf(t); S.pos = 4; S.countIn = false
      const saved = await saveNow(true, true)
      await record(); await sleep(1400)
      /* the engine's other threads are new ones each time their number changes: more threads than there are places to
         note which plug-in each is inside will have played by the time the app is brought down — and the one it goes
         down in must still be named */
      let threads = 0
      for (let i = 0; i < 14; i++) { threads += (await NAT.call('testHands', { n: 2 + (i % 3) })).threads - 1; await sleep(90) }
      await NAT.call('testHands', { n: -1 }); await sleep(200)
      return { plugin: r && r.name, uid: r && r.uid, saved, recording: !!S.rec, at: +curPos().toFixed(2), threadsUsed: threads }
    })
    await NAT.call('testCrash', { uid: S.tracks[0].inserts[0] ? S.tracks[0].inserts[0].uid : -1 })
    await sleep(4000)
    await note('stillHere', true); await NAT.call('testDone'); return
  }
  /* only this: the app is closed while a print is under way. It must go at once, the half-made file with it, and end as an
     app ends by itself — the check's script looks at what is left behind (no mark of a bad end, no file, how long it took). */
  if (mode === 'quitprint') {
    await step('before', async () => {
      await natSession()
      const list = S.tracks.filter(t => t.kind === 'audio').slice(0, 6)
      NAT.call('bounce', { kind: 'stems', a0: 0, a1: 400, modes: ['wet'], tracks: list.map((t, i) => ({ id: t.id, name: `quit ${i + 1}` })), folder: 'quit print', name: 'quit print', fmt: 'm4a', rate: 48000, bits: 24 })      // (not waited for: six stems of four hundred bars, at another rate, keep the machine busy for a good while)
      await sleep(900)
      return { stems: list.length, at: Date.now() }
    })
    await NAT.call('quit')
    return
  }
  /* only this: the app is closed while a print is inside a plug-in that never comes back. It must not stay open for it:
     after its wait it leaves the note a crash leaves and goes; started again (the same mode), the plug-in is named and
     left out. */
  if (mode === 'stuck') {
    if (!S.back) {
      await step('before', async () => {
        const r = await natInsert(0, 'AudioUnit:Effects/aufx,dely,appl'), saved = await saveNow(true, true)
        await NAT.call('testHang', { uid: r && r.uid })
        NAT.call('bounce', { kind: 'stems', a0: 0, a1: 40, modes: ['wet'], tracks: [{ id: S.tracks[0].id, name: 'stuck 1' }], folder: 'stuck print', name: 'stuck print', fmt: 'wav', rate: 44100, bits: 24 })      // (not waited for: it never ends)
        await sleep(900)
        return { plugin: r && r.name, uid: r && r.uid, saved, at: Date.now() }
      })
      await NAT.call('quit')
      return
    }
    await step('after', async () => ({ title: S.back.title, said: S.back.lines, distrust: [...DISTRUST], inserts: (S.tracks[0].inserts || []).map(i => [i.name, !!i.out, i.uid > 0]) }))
    await note('page', { errors: window.__errs || [] }); await NAT.call('testDone'); return
  }
  /* only this: a plug-in on the device's own thread never comes back. The app stands still (the check's script puts it
     down, as a hand would); started again, the plug-in is named and left out — the app had written down where it stood. */
  if (mode === 'hung') {
    if (!S.back) {
      let uid = 0
      await step('before', async () => { const r = await natInsert(0, 'AudioUnit:Effects/aufx,dely,appl'), saved = await saveNow(true, true); uid = r && r.uid; return { plugin: r && r.name, uid, saved } })
      play(4); await sleep(500)
      NAT.call('testHang', { uid, live: 1 })                                       // (said last: from the next block on the device does not come back, and the app with it)
      return
    }
    await step('after', async () => ({ title: S.back.title, said: S.back.lines, distrust: [...DISTRUST], inserts: (S.tracks[0].inserts || []).map(i => [i.name, !!i.out, i.uid > 0]) }))
    await note('page', { errors: window.__errs || [] }); await NAT.call('testDone'); return
  }
  /* only this: bad ends with nothing to name. The check's script puts the app down twice from outside (it is caught at
     nothing), a song with a plug-in in it open; the third start must bring the song back without the plug-in. Each run
     says what it finds: how many such ends in a row there have been, and what stands on the first track. */
  if (mode === 'twice') {
    const n = PROJ.badEnds || 0
    await step('run' + (n + 1), async () => {
      let saved = null
      if (!n) { await natInsert(0, 'AudioUnit:Effects/aufx,dely,appl'); saved = await saveNow(true, true); await sleep(300) }
      const res = { ends: n, project: PROJ.name, saved, said: S.back ? S.back.lines : null, inserts: (S.tracks[0].inserts || []).map(i => [i.name, !!i.out, i.uid > 0]) }
      if (n >= 2) { await bringAllBack(); await sleep(400); res.allBack = (S.tracks[0].inserts || []).map(i => [i.name, !!i.out, i.uid > 0]) }      // (as a press with option held on one of them does)
      return res
    })
    if (n >= 2) { await note('page', { errors: window.__errs || [] }); await NAT.call('testDone') }
    return                                                                          // (the first two runs stay as they are: the script puts them down)
  }
  if (mode === 'back') {
    await step('back', async () => {
      flush()
      const shape = () => S.tracks.map(t => [t.name, t.regs.length, (t.inserts || []).map(i => [i.name, !!i.out, i.uid > 0])])
      const res = { project: PROJ.name, said: S.back ? S.back.lines : null, distrust: [...DISTRUST], tracks: shape() }
      const vox = track('vox'), r = vox && vox.regs[0]
      res.take = r ? { a: +r.a.toFixed(2), sec: +r.sec.toFixed(2), file: r.file } : null
      await snap('selftest-back-1-said.png')
      S.back = null; uiDirty('back')
      if (r) res.takeHeard = await only(vox, async () => { await playFrom(4.2); return listen(900) })
      halt(false)
      S.sel = 0; S.selT = []; S.panel.on = true; S.panel.tab = 'patch'; setView(true); await snap('selftest-back-2-left-out.png')
      await bringBack(S.tracks[0], 0); await sleep(400)
      res.broughtBack = (S.tracks[0].inserts || []).map(i => [i.name, !!i.out, i.uid > 0]); res.distrustAfter = [...DISTRUST]
      res.kickPlays = await only(track('kick'), async () => { await playFrom(16); return listen(900) }); halt(false)
      await snap('selftest-back-3-back.png')
      S.panel.on = false; setView(true)
      /* the song as it was earlier: a copy is put aside, the song is changed, and it is gone back to */
      const n0 = S.tracks.length
      await NAT.call('projSave', { name: PROJ.name, json: serialize(), backup: 1 })
      newTrack('audio', 'extra'); await saveNow(false, true)
      const list = await NAT.call('projBackups', { name: PROJ.name })
      res.copies = list.length
      if (list.length) { await revertTo(list[0].file, list[0].when); await sleep(400) }
      res.revert = { before: n0, changed: n0 + 1, after: S.tracks.length, copiesNow: (await NAT.call('projBackups', { name: PROJ.name })).length, said: S.last && S.last.say, shape: shape() }
      return res
    })
    await note('page', { errors: window.__errs || [] }); await NAT.call('testDone'); return
  }
  await sleep(900)                                                                 // the menu bar is put up a moment after the window
  await step('window', async () => NAT.call('testWindow', { name: 'selftest-window-bar.png' }))
  await step('room', async () => ({ lay: __daw.lay(), font: document.fonts.check("500 12px 'Instrument Sans'") && document.fonts.check("italic 400 12px 'Instrument Sans'"), parts: Object.keys(PARTS).filter(k => !document.getElementById('g-' + k)), menus: (await NAT.call('testMenus')).titles, stat: Object.assign({}, STAT), looks: S.tracks.map(t => [t.name, t.fam, t.outline, t.c]) }))
  if (mode === 'slur') {                                                           // only this: slur's own page, where the room keeps a place for it
    await step('slur', async () => {
      toggleSlur(); await sleep(400)
      const place = { slur: S.slur, s: VIEW.s, rx: RX, w: W }
      let page = null
      for (let k = 0; k < 40; k++) { await sleep(500); page = await NAT.call('testSlur'); if (page && page.ready && page.text) break }
      await sleep(1500); page = await NAT.call('testSlur')
      // the studio stood on end (?surface=panel): what stands where in it, with no one's words in the answer
      const panel = await NAT.call('testSlur', { js: `JSON.stringify((() => { const q = s => document.querySelector(s); const r = e => { if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)] }; return { stage: q('.wd-stage') ? q('.wd-stage').className : null, wd: q('.wd') ? q('.wd').className : null, door: !!q('.sl-door, input[type=password]'), small: !!q('.top-bar .icon-btn'), bar: r(q('.wd-bar')), greet: r(q('.wd-home-greet')), week: r(q('.wd-week')), arches: document.querySelectorAll('.wd-arch').length, rail: r(q('.wd-rail')), rows: document.querySelectorAll('.wd-rail-scroll .wd-row').length, foot: r(q('.wd-rail-foot')), logo: q('.wd-brand') ? getComputedStyle(q('.wd-brand')).display : null, beyond: [...document.querySelectorAll('.wd-stage *')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && (b.right > innerWidth + .5 || b.left < -.5) && !e.closest('.wd-bar-sheet') }).length, font: document.fonts.check("500 12px 'Instrument Sans'"), seen: document.visibilityState, notes: document.querySelectorAll('.wd-bar .sl-note').length, noteShows: q('.wd-bar .sl-note') ? getComputedStyle(q('.wd-bar .sl-note')).opacity : null, held: (() => { const a = document.getAnimations(); a.forEach(x => { try { x.finish() } catch (e) {} }); return a.length })() } })())` })      // (the check's window is in the background, where WebKit holds animations still; the notes come in by one, so they are let finish before the photograph)
      await NAT.call('testSnap', { name: 'selftest-slur-view.png', which: 'slur' }); await sleep(600)
      await snap('selftest-slur-room.png')
      keyDown('KeyB'); await sleep(300); const withPatch = { p: VIEW.p, tab: S.panel.tab }; await snap('selftest-slur-patch.png'); keyDown('KeyX'); await sleep(300); await snap('selftest-slur-mixer.png'); keyDown('KeyX'); await sleep(200)
      toggleSlur(); await sleep(400)
      return { place, page, panel, withPatch, closed: { slur: S.slur, s: VIEW.s } }
    })
    await step('audioWindow', async () => { await NAT.call('audioSettings'); await sleep(1200); return { windows: (await NAT.call('testMenus')).titles.split(' | ').pop() } })      // the window's own name, as the menu bar lists it
    await step('projects', async () => { const out = []; for (const p of (await NAT.call('projList')) || []) { const r = await NAT.call('projLoad', { name: p.name }); let d = null; try { d = JSON.parse(r.json) } catch (e) {} out.push([p.name, !!(r && r.ok), d ? d.tracks.length : 0, d ? d.v : null]) } return out })      // found, and readable: nothing is opened or written
    await note('page', { errors: window.__errs || [] })
    await NAT.call('testDone'); return
  }

  await step('chorus', async () => { await playFrom(16); return listen(1500) })
  await step('insertAppleDelay', () => natInsert(0, 'AudioUnit:Effects/aufx,dely,appl'))
  await step('kickSolo', () => only(track('kick'), async () => { await playFrom(16); return listen(1500) }))
  await step('meters', async () => { await playFrom(16); await sleep(700); __daw.redraw(); drawMeters(); const w = id => +(document.getElementById(id) || { getAttribute: () => 0 }).getAttribute('width'); const r = { out: [w('mm-l'), w('mm-r')], tracks: S.tracks.map(t => [t.name, w('mt-' + t.id)]) }; await NAT.call('testSnap', { name: 'selftest-0-meters.png' }); await sleep(300); halt(false); return r })
  await step('queue', async () => { await playFrom(16); gotoScene(5); const q = S.queued; await sleep(150); const atOnce = +curPos().toFixed(2); await sleep(3050); return { asked: q, atOnce, pos: +curPos().toFixed(2), queued: S.queued, playing: S.playing } })      // a marker pressed while the song runs: it waits for the bar line, then goes
  await snap('selftest-1-playing.png')
  await step('plugins', async () => { const l = await NAT.call('plugins'); return { all: l.length, au: l.filter(p => p.fmt === 'au').length, vst3: l.filter(p => p.fmt === 'vst3').length, ours: l.filter(p => /slur|orb/i.test(p.name + p.maker)).map(p => [p.name, p.maker, p.fmt]) } })
  await step('insertPatchOnSlur', async () => { await openPicker(); await sleep(900); await snap('selftest-2-picker.png'); const l = (S.picker.list || []).find(p => /patch on slur/i.test(p.name)); closePicker(); return l ? natInsert(1, l.id) : { skipped: 'patch on slur is not installed' } })
  halt(false)

  /* hands: real pointer and key events on the page */
  await step('hands', async () => {
    const look = () => ({ snare: S.tracks[1].vol, bassMute: S.tracks[3].mute, sel: S.sel, loop: S.cycle.on, tape: Math.round(patchNow(S.tracks[5]).tape), playing: S.playing, click: S.click, panel: S.panel.on && S.panel.tab })
    const before = look()
    { const [x, y] = mid('[data-a="vol"][data-i="1"]'); fire('pointerdown', x, y); fire('pointermove', x - 12, y, window); fire('pointerup', x - 12, y, window) }      // the snare's fader, down
    tap('[data-a="mute"][data-i="3"]')                                                                                // the bass's m
    tap('[data-a="sel"][data-i="5"]'); flush()                                                                        // choose the guitar
    tap('[data-a="patch"]'); await sleep(250); flush()                                                                // its patch, below: nothing on it yet
    const empty = document.querySelectorAll('#g-dock [data-a="print"]').length === 0
    tap('[data-a="plugs"]'); await sleep(700)                                                                         // the place to add: the list of prints and plug-ins
    const offered = [...document.querySelectorAll('#pk-list .pk-row')].slice(0, 3).map(e => e.dataset.print || '')
    { const row = document.querySelector('#pk-list .pk-row[data-print="tape"]'); if (row) row.click() } await sleep(150); flush()
    { const [x, y] = mid('[data-a="print"][data-k="tape"]'); fire('pointerdown', x, y); fire('pointermove', x, y - 40, window); fire('pointerup', x, y - 40, window) }   // tape is on it now: pulled up
    tap('[data-a="loop"]'); tap('[data-a="click"]')                                                                   // the cycle, the click
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }))
    await sleep(300)
    const middle = look()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }))
    await sleep(450)                                                                                                  // long enough that the next presses are not taken for the second of two
    tap('[data-a="mute"][data-i="3"]'); tap('[data-a="loop"]'); tap('[data-a="click"]')
    await runCommand('snare to -5')
    await snap('selftest-15-patch.png')
    keyDown('KeyX'); await sleep(250); flush(); const mixer = { on: S.panel.on, tab: S.panel.tab, strips: document.querySelectorAll('[data-a="msel"]').length }; await snap('selftest-16-mixer.png')
    keyDown('KeyX'); await sleep(250)
    return { before, mid: middle, after: look(), mixer, closed: !S.panel.on, patch: { empty, offered } }
  })

  /* a file dropped on the hats, at bar 25 */
  await step('dropFile', async () => {
    const sr = 44100, len = Math.round(sr * 2.6), ab = new AudioBuffer({ length: len, sampleRate: sr, numberOfChannels: 2 })
    for (let c = 0; c < 2; c++) { const d = ab.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-((i % 5512) / 5512) * 6) * .5 }
    await dropFiles([new File([wav16(ab)], 'Hat Loop 14 90bpm.wav', { type: 'audio/wav' })], 2, 25)
    const r = S.tracks[2].regs.slice(-1)[0]
    return { a: r.a, b: +r.b.toFixed(2), rate: +r.rate.toFixed(3), key: r.key, file: r.file, peaks: (r.peaksAll || []).length }
  })
  await step('droppedHatSounds', () => only(track('hats'), async () => { await playFrom(24); return listen(1500) }))

  /* editing: gain, split, mute, and the cycle */
  await step('edit', async () => {
    halt(false)
    const t = track('bass'), r = t.regs.find(x => x.a === 17)
    S.selR = [r.id]; act.gain(-6); S.pos = 20; act.splitAtPlayhead()
    S.selR = [t.regs.find(x => x.a === 21).id]; act.mute()
    const loud = await only(t, async () => { await playFrom(17); return listen(1200) }), silent = await only(t, async () => { await playFrom(21); return listen(1200) })
    setCycle(16, 18, true); await playFrom(17.2); await sleep(3600)
    const wrapped = +curPos().toFixed(2)
    halt(false); setCycle(16, 17, true); await playFrom(16.5); await sleep(2600)                       // a one-bar cycle whose end does not fall on a whole sample
    const wrapped2 = +curPos().toFixed(2)
    halt(false); setCycle(16, 18, false)
    return { bass: t.regs.map(x => [x.a, x.b, x.gain, x.mute ? 'm' : '']), loud, silent, cycleAt: wrapped, oneBarCycleAt: wrapped2 }
  })
  await snap('selftest-3-edit.png')

  /* routing: a bus, a route into it, a send */
  await step('routing', async () => {
    const kick = track('kick'), bus = newTrack('bus', 'room', true)
    const hear = () => only(kick, async () => { await playFrom(16); return listen(1300) })
    const direct = await hear()
    setOut(kick, bus.id); bus.vol = -6; applyAll(); const viaBusMinus6 = await hear()
    bus.mute = true; applyAll(); const busMuted = await only(kick, async () => { bus.mute = true; applyAll(); await playFrom(16); return listen(1300) })
    bus.mute = false; bus.vol = 0; setOut(kick, 0); setSend(kick, 0, bus.id); kick.sends[0].db = -6; applyAll(); const withSendMinus6 = await hear()
    setSend(kick, 0, 0)
    return { direct, viaBusMinus6, busMuted, withSendMinus6, tracks: S.tracks.map(t => t.name + ':' + t.kind) }
  })
  await step('stack', async () => {
    S.selR = [track('kick').regs[0].id, track('snare').regs[0].id]; S.focus = 'lanes'; makeStack(); await sleep(200)
    const st = S.tracks[S.sel], both = await only(st, async () => { await playFrom(16); return listen(1300) })
    st.vol = -48; applyAll(); const down = await only(st, async () => { await playFrom(16); return listen(1300) })
    st.vol = 0; applyAll()
    const r = { names: S.tracks.map(t => t.name + (t.parent ? '<' : '')), both, stackFaderDown: down }
    await snap('selftest-4-stack.png')
    deleteTrack(S.tracks.indexOf(st)); await sleep(200)
    return Object.assign(r, { after: S.tracks.map(t => t.name + (t.parent ? '<' : '')) })
  })

  /* automation: the snare falls from where it is to nothing across bar 17, and stays there */
  await step('automation', async () => {
    const t = track('snare')
    edit(() => { addPoint(t, 'vol', 16, t.vol); addPoint(t, 'vol', 17, -48) })
    const r = await only(t, async () => { await playFrom(16); const first = await listen(1600); await playFrom(17.2); const after = await listen(1200); return { first, after, shownAfter: shown(t, 'vol') } })
    S.auto = true; t.ap = 'vol'; S.sel = S.tracks.indexOf(t); await snap('selftest-5-automation.png'); S.auto = false
    undoEdit()
    return Object.assign(r, { ptsAfterUndo: autoPts(t, 'vol').length })
  })

  /* a take: the tone that stands in for the microphone, three seconds of it from bar 5, with a bar of count-in */
  await step('record', async () => {
    halt(false)
    const t = newTrack('audio', 'vox'); S.sel = S.tracks.indexOf(t); S.pos = 4
    await record(); await sleep(600)
    const counting = { rec: !!S.rec, pos: +curPos().toFixed(2), armed: t.arm }
    await sleep(2609 + 3000)
    await stopRecord(true)
    const r = t.regs[0]
    if (!r) return { counting, failed: 'no region' }
    const heard = await only(t, async () => { await playFrom(4.1); return listen(1500) })
    return { counting, region: { a: +r.a.toFixed(3), b: +r.b.toFixed(3), sec: +r.sec.toFixed(2), off: +r.off.toFixed(4), file: r.file }, heard }
  })
  await snap('selftest-6-take.png')

  /* pitch and time: the take up an octave; the dropped hats pulled to sixteenths; the bass loop up a fifth */
  await step('transpose', async () => {
    const t = track('vox'), r = t.regs[0]
    if (!r) return { skipped: true }
    S.selR = [r.id]; act.transpose(12); await sleep(300)
    for (let k = 0; k < 60 && !r.wkey; k++) await sleep(100)
    const heard = await only(t, async () => { await playFrom(4.1); return listen(1200) })
    return { tr: r.tr, wkey: r.wkey, heard }
  })
  await step('transposeLoop', async () => {
    const t = track('bass'), r = t.regs[0], before = await only(t, async () => { await playFrom(5); return listen(1200) })
    S.selR = [r.id]; act.transpose(7)
    for (let k = 0; k < 80 && !r.wkey; k++) await sleep(100)
    const after = await only(t, async () => { await playFrom(5); return listen(1200) })
    return { tr: r.tr, wkey: r.wkey, before, after }
  })
  await step('flex', async () => {
    const t = track('hats'), r = t.regs.find(x => x.file)
    if (!r) return { skipped: true }
    toggleFlex(); await sleep(900)
    const found = (TRANS.get(r.key) || []).length
    S.selR = [r.id]; S.q = 1 / 16
    await quantize([r])
    await snap('selftest-7-flex.png')
    const pins = (r.flex || []).length, moved = (r.flex || []).filter(m => Math.abs(m.d - m.s / (r.rate || 1)) > 1e-3).length
    toggleFlex()
    return { transients: found, pins, moved, wkey: r.wkey, grid: +(SPB() / 16).toFixed(4), firstPins: (r.flex || []).slice(0, 6).map(m => [+m.s.toFixed(3), +m.d.toFixed(3)]) }
  })

  /* out: stems as flac, the mix as wav at another rate, the mix as m4a; and a bounce in place */
  const send = async set => { Object.assign(S.ho, { open: true, done: 0, note: '' }, set); await sendStems(); return { note: S.ho.note, done: S.ho.done, total: S.ho.total } }
  setCycle(4, 8, false)
  await step('exportStemsFlac', () => send({ what: 'stems', print: 'with patch', range: 'cycle', fmt: 'flac', rate: 0, bits: 24 }))
  await step('exportMixWav441', () => send({ what: 'mix', range: 'cycle', fmt: 'wav', rate: 44100, bits: 16 }))
  await step('exportMixM4a', () => send({ what: 'mix', range: 'cycle', fmt: 'm4a', rate: 0, bits: 24 }))
  await step('exportMp3', () => CAP.mp3 ? send({ what: 'mix', range: 'cycle', fmt: 'mp3', rate: 0, bits: 24 }) : { skipped: 'there is no lame on this machine' })
  await snap('selftest-8-handoff.png')
  S.ho.open = false
  await step('bounceInPlace', async () => {
    const t = track('keys'), n0 = S.tracks.length
    S.selR = [t.regs[1].id]
    await bounceInPlace(); await sleep(300)
    const nt = S.tracks[S.tracks.indexOf(t) + 1]
    return { tracks: [n0, S.tracks.length], name: nt && nt.name, region: nt && nt.regs[0] && { a: nt.regs[0].a, b: +nt.regs[0].b.toFixed(2), file: nt.regs[0].file }, sourceMuted: t.regs[1].mute }
  })

  /* the project: saved, opened again, and the same — with a closed stack, a send, lines drawn, a scene renamed, a pan */
  await step('project', async () => {
    S.selR = [track('kick').regs[0].id, track('snare').regs[0].id]; S.focus = 'lanes'; makeStack(); await sleep(150)
    const st = S.tracks[S.sel]; st.open = false; st.name = 'drums'
    setSend(track('keys'), 0, track('room').id); track('keys').sends[0].db = -9; track('bass').pan = -.25; track('room').patch.A.space = 40
    edit(() => { const h = track('hum'); addPoint(h, 'vol', 16, -6); addPoint(h, 'vol', 20, -20); addPoint(h, 'pan', 16, -.5); addPoint(h, 'pan', 24, .5); SCENES = mkScenes(SCENES.map((s, k) => [k === 1 ? 'verse one' : s.name, s.a])) })
    applyAll(); await sleep(300)
    const mid = t => only(t, async () => { await playFrom(17); return listen(1000) })
    const humBefore = await mid(track('hum')), keysBefore = await mid(track('keys'))
    halt(false)
    const saved = await saveNow(true), before = serialize()
    const loaded = await loadProject('selftest'), after = serialize()
    const strip = s => s.replace(/"state":"[^"]*"/g, '"state":""')
    const humAfter = await mid(track('hum')), keysAfter = await mid(track('keys'))
    const heard = await (async () => { await playFrom(16); return listen(1300) })()
    halt(false)
    const shape = { names: S.tracks.map(t => t.name + (t.parent ? '<' : '')), rows: rows().length, send: copy(track('keys').sends), scene2: SCENES[1].name, humLines: [autoPts(track('hum'), 'vol').length, autoPts(track('hum'), 'pan').length], sameSound: { hum: [humBefore.rms, humAfter.rms], keys: [keysBefore.rms, keysAfter.rms] } }
    const drums = track('drums'); drums.open = true; deleteTrack(S.tracks.indexOf(drums)); await sleep(200)
    setSend(track('keys'), 0, 0); edit(() => { track('hum').autos = {} }); await sleep(100)
    return { saved, loaded, same: strip(before) === strip(after), bytes: before.length, shape, tracks: S.tracks.map(t => [t.name, t.kind, (t.inserts || []).map(i => i.name)]), heardAfterLoad: heard, warpedBack: S.tracks.flatMap(t => t.regs).filter(r => r.tr || (r.flex || []).length).map(r => [r.name || r.buf, r.tr || 0, (r.flex || []).length, !!r.wkey]) }
  })
  /* the newer controls, by hand: arm and record with the keys, a line drawn with the pointer, a pin pulled, a bus from the strip's menu, the panel's cells */
  await step('handsRecord', async () => {
    halt(false)
    const t = track('vox'), i = S.tracks.indexOf(t), n0 = t.regs.length
    showRow(i); __daw.redraw(); await sleep(50)
    t.arm = false; tap(`[data-a="arm"][data-i="${i}"]`); await sleep(250)             // its r
    const armed = t.arm
    S.pos = 8; S.countIn = false
    keyDown('KeyR'); await sleep(1500)
    const rolling = { rec: !!S.rec, pos: +curPos().toFixed(2) }
    keyDown('Space'); await sleep(900)
    S.countIn = true
    const r = t.regs[t.regs.length - 1]
    await sleep(300); tap(`[data-a="mon"][data-i="${i}"]`); await sleep(200)           // its i: the input is heard through the track
    const mon = t.mon, heardLive = await only(t, () => listen(700))
    tap(`[data-a="mon"][data-i="${i}"]`); await sleep(100)
    return { armed, rolling, regions: [n0, t.regs.length], take: r && { a: +r.a.toFixed(2), len: +((r.b - r.a) * SPB()).toFixed(2) }, mon, heardLive, monOff: !t.mon }
  })
  await step('handsAutomation', async () => {
    const t = track('hum'), i = S.tracks.indexOf(t)
    VY = 0; showRow(i); keyDown('KeyA'); flush(); await sleep(60)
    const g = autoGeom(t, rowY(i), S.rh), y = g.yOf(t.vol)
    press(bx(9), y); await sleep(60)                                                  // on the dashed line: the first point
    await pull(bx(13), y, bx(13), y + 12)                                             // a second one, pulled down
    const pts = autoPts(t, 'vol').map(q => [q.b, q.v])
    keyDown('Backspace'); await sleep(60)
    const afterDelete = autoPts(t, 'vol').length
    keyDown('KeyZ', { metaKey: true }); await sleep(60)
    const afterUndo = autoPts(t, 'vol').length
    keyDown('KeyA'); flush()
    return { on: true, pts, afterDelete, afterUndo, off: !S.auto }
  })
  await step('handsFlex', async () => {
    const t = track('hats'), i = S.tracks.indexOf(t), r = t.regs.find(x => x.file)
    if (!r) return { skipped: true }
    edit(() => { r.flex = [] }); await rewarp([r])
    keyDown('KeyF', { metaKey: true }); await sleep(500)
    setZoom(300, r.a - 1 + (r.b - r.a) / 2); VY = 0; showRow(i); flush(); await sleep(80)
    const tr = (TRANS.get(r.key) || []).slice().sort((a, b) => a - b), s = tr[4], x = xOfD(r, sToD(r, s)), y = rowY(i) + S.rh / 2
    await pull(x, y, x + 9, y, { ctrlKey: true, shiftKey: true })                     // control and shift: free of the grid
    for (let k = 0; k < 50 && !r.wkey; k++) await sleep(100)
    await snap('selftest-10-flex-close.png')
    const pin = (r.flex || []).find(m => Math.abs(m.s - s) < 1e-4), res = { transient: +s.toFixed(3), pins: (r.flex || []).length, movedBy: pin ? +(pin.d - s / (r.rate || 1)).toFixed(4) : null, pxAsSec: +(9 / PXB * SPB()).toFixed(4), wkey: r.wkey }
    keyDown('KeyZ', { metaKey: true }); await sleep(300)
    res.afterUndo = (regOf(r.id)[0].flex || []).length                                // an undo puts back the region as it was: another object with the same id
    setZoom(0); keyDown('KeyF', { metaKey: true }); flush()
    return res
  })
  await step('handsRouting', async () => {
    const t = track('guitar'), i = S.tracks.indexOf(t), n0 = S.tracks.length
    S.sel = i; S.panel.on = true; S.panel.tab = 'patch'; setView(true); __daw.redraw(); await sleep(80)
    tap(`[data-a="mout"][data-i="${i}"]`); const made = await pickMenu('new bus')            // out -> new bus
    const out = byId(destId(t)), afterOut = { made, out: out && out.name, tracks: S.tracks.length - n0 }
    S.sel = S.tracks.indexOf(t); __daw.redraw(); await sleep(450)
    const j = S.tracks.indexOf(t)
    tap(`[data-a="mout"][data-i="${j}"]`); await pickMenu('stereo out')
    S.sel = S.tracks.indexOf(t); __daw.redraw(); await sleep(80)
    tap(`[data-a="msendadd"][data-i="${j}"]`); const sent = await pickMenu(out ? out.name : 'x')      // send -> that bus
    __daw.redraw(); await sleep(80)
    { const el = document.querySelector(`[data-a="msend"][data-i="${j}"][data-k="0"]`), x0 = +el.dataset.x, pw = +el.dataset.pw, [, y] = mid(`[data-a="msend"][data-i="${j}"][data-k="0"]`); await pull(x0 + 4, y, x0 + pw * volF(-3), y) }      // the send, pulled until three under
    const res = { afterOut, backOut: destId(t), sent, sends: t.sends.map(s => [byId(s.to) && byId(s.to).name, s.db]) }
    const heard = await only(t, async () => { await playFrom(16); return listen(1000) })
    out.mute = true; applyAll(); const busMuted = await only(t, async () => { out.mute = true; applyAll(); await playFrom(16); return listen(1000) }); out.mute = false; applyAll()
    halt(false)
    S.panel.on = false; setView(true)
    return Object.assign(res, { heard, withTheBusMuted: busMuted })
  })
  await step('handsPanel', async () => {
    keyDown('KeyB', { metaKey: true }); flush(); await sleep(80)
    const cell = (k, v) => { const el = document.querySelector(`[data-a="ho-set"][data-k="${k}"][data-v="${v}"]`); if (!el) return false; const r = el.getBoundingClientRect(); el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, button: 0, buttons: 1, clientX: r.left + 3, clientY: r.top + 3 })); window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); flush(); return true }
    const got = [cell('what', 'mix'), cell('fmt', 'aiff'), cell('rate', 96000), cell('bits', 16), cell('range', 'song')]
    const f = hoFmt(), pl = hoPlan(), res = { got, what: S.ho.what, f, range: pl.range, a: [pl.a0, pl.a1], mp3Cell: !!document.querySelector('[data-a="ho-set"][data-v="mp3"]') }
    Object.assign(S.ho, { what: 'stems', fmt: 'wav', rate: 0, bits: 24, range: 'this scene' })
    keyDown('Escape'); flush()
    return res
  })
  await snap('selftest-9-end.png')

  /* editing, round 1 — one sound at a time on a track: a region pasted exactly onto itself covers the one under it, so it is as
     loud as one; piled up past the rule (as it used to be) it is as loud as two */
  await step('overlapRule', async () => {
    halt(false)
    const t = newTrack('audio', 'ov', true)                                           // a track of its own, with no patch on it, so that twice the sound is twice as loud
    t.regs.push(mkReg({ a: 17, b: 21, buf: 'bass', loop: true, off: 16 }))
    await natSession(); await sleep(150)
    const r = t.regs[0], hear = () => only(t, async () => { await playFrom(16.5); return listen(1200) })
    const one = await hear()
    S.selR = [r.id]; S.sel = S.tracks.indexOf(t); act.copy(); S.pos = 16; act.paste(); await sleep(200)
    const pasted = { regions: t.regs.length, there: t.regs.filter(x => Math.abs(x.a - 17) < 1e-6).length }
    const covered = await hear()
    halt(false); t.regs.push(cloneReg(t.regs[0])); resync(); await sleep(150)       // the same thing forced past the rule
    const piled = await hear()
    halt(false)
    const res = { one, pasted, covered, piled, coveredAgainstOne: +(covered.rms / one.rms).toFixed(3), piledAgainstOne: +(piled.rms / one.rms).toFixed(3) }
    await deleteTrack(S.tracks.indexOf(t)); await sleep(150)
    return res
  })
  /* a crossfade, printed and compared point by point with the uncut sound: a plain cut and a plain-curve crossfade give back
     what was there; the equal-power curve (meant for two different sounds) swells in the middle */
  await step('crossfadeSound', async () => {
    halt(false)
    const t = newTrack('audio', 'xf', true)
    t.regs.push(mkReg({ a: 5, b: 13, buf: 'bass', loop: true, off: 4 }))
    const print = async () => { await natSession(); const r = await NAT.call('bounce', { kind: 'place', project: PROJ.name, a0: 6, a1: 10, tail: 0, tracks: [{ id: t.id, name: 'xfade check' }] }); const d = r && r.placed && r.placed[0]; return d && d.ok ? d.peaks : [] }
    const far = (x, y) => { let m = 0; for (let k = 0; k < Math.min(x.length, y.length); k++) m = Math.max(m, Math.abs(x[k] - y[k])); return +m.toFixed(4) }
    const whole = await print()
    const A = t.regs[0], B = splitReg(A, t, 8)
    const cut = await print()
    const made = crossfade(A, B, .5), zone = xfadeOf(A, B), curve = A.foc, cross = await print()
    A.foc = B.fic = 1; const power = await print()
    const res = { made, zone, curve, points: whole.length, loudest: +Math.max(...whole).toFixed(3), cutAgainstWhole: far(whole, cut), crossAgainstWhole: far(whole, cross), powerAgainstWhole: far(whole, power) }
    await deleteTrack(S.tracks.indexOf(t)); await sleep(150)
    return res
  })
  /* from beginning to beginning in a file (tab, or control period), a cut there, and a marquee drawn to the next one */
  await step('transientKeys', async () => {
    halt(false)
    const t = track('hats'), r = t.regs.find(x => x.file)
    if (!r) return { skipped: true }
    S.selR = [r.id]; S.sel = S.tracks.indexOf(t); S.marq = null; S.pos = r.a - 1
    const seen = []
    for (let k = 0; k < 4; k++) { await act.transient(1); seen.push(+S.pos.toFixed(4)) }
    await act.transient(-1)
    const back = +S.pos.toFixed(4)
    const want = (TRANS.get(r.key) || []).slice().sort((x, y) => x - y).map(s => +barOfD(r, sToD(r, s)).toFixed(4)).filter(b => b > r.a - 1 + 1e-4 && b < r.b - 1 - 1e-4)
    const n0 = t.regs.length; act.splitAtPlayhead(); await sleep(60)
    const cut = [n0, t.regs.length]; undoEdit(); await sleep(60)
    S.selR = [regOf(r.id)[0].id]; await act.transient(1, true)
    const marq = S.marq && [+S.marq.a.toFixed(4), +S.marq.b.toFixed(4)]
    S.marq = null; uiDirty('lanes')
    return { found: (TRANS.get(r.key) || []).length, seen, want: want.slice(0, 4), back, cut, marq }
  })
  /* a plug-in that hands its sound over late: the track is read early by as much, so its stem still starts on time */
  await step('latency', async () => {
    const t = track('vox'), i = S.tracks.indexOf(t), tried = []
    setCycle(4, 5, false)
    await send({ what: 'stems', print: 'with patch', range: 'cycle', fmt: 'wav', rate: 0, bits: 24 })
    let late = null
    for (const id of ['AudioUnit:Effects/aufx,lmtr,appl', 'AudioUnit:Effects/aufx,mcmp,appl', 'AudioUnit:Effects/aufx,nptc,appl', 'AudioUnit:Effects/aufx,dcmp,appl']) {
      const r = await natInsert(i, id)
      tried.push([id.slice(-14), r && r.ok ? r.latency : String(r && r.error)])
      if (r && r.ok && r.latency > 0) { late = r; break }
      if (r && r.ok) { await NAT.call('remove', { track: t.id, uid: r.uid }); t.inserts = t.inserts.filter(x => x.uid !== r.uid) }
    }
    if (!late) return { tried, skipped: 'no plug-in here reports a delay' }
    await sleep(1200)                                                                 // the engine measures the delay about once a second
    await send({ what: 'stems', print: 'with patch', range: 'cycle', fmt: 'wav', rate: 0, bits: 24 })
    await NAT.call('remove', { track: t.id, uid: late.uid }); t.inserts = t.inserts.filter(x => x.uid !== late.uid)
    S.ho.open = false; setCycle(4, 8, false)
    return { tried, plugin: late.name, samples: late.latency }
  })

  /* a file let go over the lanes the way the Finder does it: the web view is told entered, updated, dropped */
  await step('finderDrop', async () => {
    const t = track('vox'), i = S.tracks.indexOf(t), n0 = t.regs.length, all0 = S.tracks.reduce((a, x) => a + x.regs.length, 0)
    VY = 0; showRow(i); setZoom(0); flush(); await sleep(80)
    const b = document.getElementById('board').getBoundingClientRect(), bar = 21, px = b.left + bx(bar) * b.width / W + 2, py = b.top + (rowY(i) + S.rh / 2) * b.height / H
    const seen = []
    const spy = e => seen.push(e.type); for (const k of ['dragenter', 'dragover', 'drop']) addEventListener(k, spy, true)
    const r = await NAT.call('testDrop', { project: PROJ.name, file: 'vox take.wav', x: px / innerWidth, y: py / innerHeight })
    await sleep(1500)
    for (const k of ['dragenter', 'dragover', 'drop']) removeEventListener(k, spy, true)
    const nr = t.regs[t.regs.length - 1]
    return { took: r && r.took, events: [...new Set(seen)], voxRegions: [n0, t.regs.length], allRegions: [all0, S.tracks.reduce((a, x) => a + x.regs.length, 0)], landed: t.regs.length > n0 ? { a: +nr.a.toFixed(2), name: nr.name, file: nr.file } : null }
  })

  /* a long file let go on the page: it comes over in several pieces and is whole on the other side */
  await step('longDrop', async () => {
    const sr = 48000, len = sr * 70, ab = new AudioBuffer({ length: len, sampleRate: sr, numberOfChannels: 2 })
    for (let c = 0; c < 2; c++) { const d = ab.getChannelData(c); for (let i = 0; i < len; i++) d[i] = Math.sin(i * 2 * Math.PI * 330 / sr) * .2 * (i > len - sr ? 1 : .5) }
    const bytes = wav16(ab), t0 = performance.now()
    const d = await decodeFile(new File([bytes], 'long tone.wav', { type: 'audio/wav' }))
    const ms = Math.round(performance.now() - t0)
    return { megabytes: +(bytes.length / 1048576).toFixed(1), pieces: Math.ceil(bytes.length / (3 << 20)), sec: +d.sec.toFixed(2), file: d.file, peaks: d.peaks.length, lastPeak: d.peaks[d.peaks.length - 1], firstPeak: d.peaks[0], ms }
  })

  /* a track like another, with its plug-ins as they are set; and four plug-ins on one track */
  await step('duplicate', async () => {
    const i = S.tracks.indexOf(track('kick')), n0 = S.tracks.length
    await duplicateTrack(i); await sleep(300)
    const t = S.tracks[i + 1], res = { name: t.name, inserts: (t.inserts || []).map(x => x.name), patch: JSON.stringify(t.patch) === JSON.stringify(track('kick').patch), tracks: [n0, S.tracks.length] }
    await deleteTrack(i + 1); await sleep(200)
    return Object.assign(res, { after: S.tracks.length })
  })
  await step('fourPlugins', async () => {
    const t = track('kick'), i = S.tracks.indexOf(t), before = await only(t, async () => { await playFrom(16); return listen(1000) })
    const got = []
    for (const id of ['AudioUnit:Effects/aufx,lpas,appl', 'AudioUnit:Effects/aufx,hpas,appl', 'AudioUnit:Effects/aufx,pmeq,appl']) { const r = await natInsert(i, id); got.push(r && r.ok ? r.name : String(r && r.error)) }
    const after = await only(t, async () => { await playFrom(16); return listen(1000) })
    for (const k of [1, 2]) { t.inserts[k].off = true; await NAT.call('bypass', { track: t.id, uid: t.inserts[k].uid, off: 1 }) }      // the two filters stepped past: the kick is back
    const filtersOff = await only(t, async () => { await playFrom(16); return listen(1000) })
    halt(false); S.sel = i
    await snap('selftest-11-four-plugins.png')
    for (let k = t.inserts.length - 1; k >= 1; k--) { await NAT.call('remove', { track: t.id, uid: t.inserts[k].uid }); t.inserts.splice(k, 1) }
    return { got, count: t.inserts.length, before, after, filtersOff }
  })

  /* the device moves to another rate: the engine follows and every sound comes again */
  /* a take that cannot go on: the device moves to another rate in the middle of it, or stops giving blocks (the machine
     sleeps). Each time the take ends by itself with what came in, it is said, and the song plays again afterwards. */
  await step('stall', async () => {
    halt(false)
    const t = track('vox'), kept = t.regs.slice(), sr0 = SND_SR, was = S.countIn, out = {}
    S.sel = S.tracks.indexOf(t); S.countIn = false
    for (const [key, op, arg] of [['rate', 'testRate', { sr: sr0 === 44100 ? 48000 : 44100 }], ['hole', 'testHole', {}]]) {
      S.pos = 30; await record(); await sleep(1300)
      const rolling = !!S.rec, n0 = t.regs.length
      await NAT.call(op, arg)
      for (let k = 0; k < 60 && S.rec; k++) await sleep(50)
      await sleep(500)
      const r = t.regs.find(x => !kept.includes(x))
      out[key] = { rolling, endedByItself: !S.rec, said: (S.last && S.last.say) || null, regions: t.regs.length - n0, sec: r ? +r.sec.toFixed(1) : null, sr: SND_SR, heard: await only(track('kick'), async () => { await playFrom(16); return listen(700) }) }
      halt(false)
      if (S.rec) await stopRecord(false)
      t.regs = kept.slice(); t.arm = false; resync()
    }
    S.countIn = was; uiDirty('lanes', 'head', 'dock')
    return out
  })
  await step('rate', async () => {
    const sr0 = SND_SR, r = track('vox').regs[0], sec0 = r.sec, key0 = r.key, other = sr0 === 44100 ? 48000 : 44100      // (a rate the engine is not at: the device this runs on may be at either)
    await NAT.call('testRate', { sr: other })
    for (let k = 0; k < 80 && (SND_SR !== other || regOf(r.id)[0].key === key0); k++) await sleep(100)
    await sleep(1200)
    const at441 = { sr: SND_SR, loopFrames: LOOPS.kick.n, sec: +regOf(r.id)[0].sec.toFixed(2), newKey: regOf(r.id)[0].key !== key0, heard: await (async () => { await playFrom(16); return listen(1200) })() }
    halt(false)
    await NAT.call('testRate', { sr: sr0 })
    for (let k = 0; k < 80 && SND_SR !== sr0; k++) await sleep(100)
    await sleep(1500)
    const back = { sr: SND_SR, heard: await (async () => { await playFrom(16); return listen(1200) })() }
    halt(false)
    return { sr0, sec0: +sec0.toFixed(2), at441, back }
  })

  /* a new project: nothing in it, no scenes; a file comes in, it plays, it is exported, the tempo moves, it is left and come back to */
  await step('newProject', async () => {
    await newProject(); await sleep(300)
    const res = { name: PROJ.name, demo: PROJ.demo, end: SONG_END, scenes: SCENES.length, tracks: S.tracks.map(t => t.name), rooms0: (await NAT.call('testInfo')).rooms }
    const sr = 44100, len = sr * 4, ab = new AudioBuffer({ length: len, sampleRate: sr, numberOfChannels: 1 })
    { const d = ab.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (((i * 110 / sr) % 1) * 2 - 1) * .3 * (i % 22050 < 6000 ? 1 : .05) }
    await dropFiles([new File([wav16(ab)], 'saw.wav', { type: 'audio/wav' })], 0, 1)
    const r = S.tracks[0].regs[0]
    res.region = r && { a: r.a, b: +r.b.toFixed(3), sec: r.sec }
    await playFrom(0); res.heard = await listen(1200); halt(false)
    await sleep(300); res.pool = (PROJ.pool || []).map(f => [f.file, +f.sec.toFixed(1)])
    await snap('selftest-12-new-project.png')
    keyDown('KeyC'); res.cycleNoScenes = Object.assign({}, S.cycle); keyDown('KeyC')
    addScene(3, 'b part'); document.activeElement && document.activeElement.blur(); await sleep(60)
    res.scenes = SCENES.map(s => [s.name, s.a, s.b])
    const pl = hoPlan(); res.plan = { range: pl.range, a: [pl.a0, +pl.a1.toFixed(2)], list: pl.list.map(t => t.name) }
    Object.assign(S.ho, { open: true, what: 'mix', range: 'song', fmt: 'wav', rate: 0, bits: 24, done: 0 }); await sendStems(); res.export = S.ho.note; S.ho.open = false
    const len0 = r.b - r.a
    setTempo(120); await sleep(900)
    res.tempo = { bpm: S.tempo, barsBefore: +len0.toFixed(3), barsAfter: +(regOf(r.id)[0].b - regOf(r.id)[0].a).toFixed(3) }
    S.selR = [r.id]; act.follow(); await sleep(600); setTempo(100); await sleep(1200)
    const rr = regOf(r.id)[0]
    res.follow = { fx: rr.fx, bars: +(rr.b - rr.a).toFixed(3), rate: +rr.rate.toFixed(3), wkey: !!rr.wkey }
    await playFrom(0); res.heardFollowing = await listen(1000); halt(false)
    const t2 = newTrack('audio'); deleteTrack(S.tracks.indexOf(t2)); await sleep(100); undoEdit(); await sleep(100)
    res.undoDelete = S.tracks.map(t => t.name)
    res.saved = await saveNow(true)
    await saveAs('selftest copy'); res.savedAs = { name: PROJ.name, pool: (PROJ.pool || []).length }
    res.list = ((await NAT.call('projList')) || []).map(p => p.name)
    await openProject('selftest'); await sleep(300)
    res.back = { name: PROJ.name, demo: PROJ.demo, end: SONG_END, scenes: SCENES.length, tracks: S.tracks.length }
    return res
  })
  S.sheet = true; await snap('selftest-13-keys.png'); S.sheet = false; __daw.redraw()
  await step('renameBoxes', async () => { const box = () => { const r = document.getElementById('rename').getBoundingClientRect(), b = document.getElementById('board').getBoundingClientRect(), k = W / b.width; return [Math.round((r.left - b.left) * k), Math.round((r.top - b.top) * k), Math.round(r.width * k), Math.round(r.height * k)] }; const out = {}; VY = 0; __daw.redraw(); startRename('track', 1); out.track = box(); await NAT.call('testSnap', { name: 'selftest-14-rename.png' }); await sleep(300); document.getElementById('rename').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); startRename('tempo'); out.tempo = box(); document.getElementById('rename').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); startRename('scene', 2); out.scene = box(); document.getElementById('rename').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); startRename('key'); out.key = box(); document.getElementById('rename').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); startRename('saveas'); out.saveas = box(); out.ask = !!S.ask; document.getElementById('rename').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); out.hidden = document.getElementById('rename').hidden; return out })
  await step('look', async () => {
    const t = S.tracks[0], r = t.regs[0], c0 = t.c, o0 = t.outline
    S.sel = 0; S.selR = []; __daw.redraw()
    tap('[data-a="look"]'); flush(); tap('[data-a="look-col"][data-f="vox"][data-s="2"]'); flush(); tap('[data-a="look-shape"][data-v="gtr"]'); flush()
    const byHand = { col: t.col, shape: t.shape, c: t.c, outline: t.outline, changed: t.c !== c0 }
    await snap('selftest-17-look.png')
    const kept = JSON.parse(serialize()).tracks[0]
    tap('[data-a="look-col"][data-f=""]'); flush(); tap('[data-a="look-shape"][data-v=""]'); flush(); keyDown('Escape'); flush()
    return { byHand, saved: { col: kept.col, shape: kept.shape }, back: { c: t.c === c0, outline: t.outline === o0, col: t.col || null }, open: !!S.look }
  })
  await step('tone', async () => {
    const sr = 48000, mk = (sec, f) => { const ab = new AudioBuffer({ length: Math.floor(sec * sr), sampleRate: sr, numberOfChannels: 1 }), d = ab.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = f(i / sr); return ab }
    const sounds = { thud: mk(6, t => { const p = t % .652; return Math.sin(2 * Math.PI * (50 + 90 * Math.exp(-p * 30)) * p) * .9 * Math.exp(-p * 9) }), low: mk(6, t => Math.sin(2 * Math.PI * 55 * t) * .5), sung: mk(6, t => (Math.sin(2 * Math.PI * 220 * t) + .5 * Math.sin(2 * Math.PI * 440 * t)) * .3) }
    const out = {}
    for (const k in sounds) { const d = await decodeFile(new File([wav16(sounds[k])], `tone ${k}.wav`, { type: 'audio/wav' })); out[k] = { read: readTone(d), tone: d.tone || null } }
    return out
  })
  /* the plain things, against the app's own engine: play from where the cycle begins; tracks chosen together, emptied, taken
     away and brought back with their plug-ins; the new-track list; a region taken to the playhead and heard there */
  await step('basics', async () => {
    halt(false)
    const res = {}, n0 = S.tracks.length
    setCycle(8, 12, true); S.pos = 2; play(); await sleep(500); res.playWithCycle = +curPos().toFixed(2); halt(false)
    S.pos = 30; halt(true); res.stopOnce = S.pos; halt(true); res.stopTwice = S.pos
    setCycle(8, 12, false); S.pos = 2; play(); await sleep(500); res.playWithoutCycle = +curPos().toFixed(2); halt(false)
    setCycle(16, 24, false)
    chooseTrack(S.tracks.indexOf(track('kick'))); chooseTrack(S.tracks.indexOf(track('snare')), 'toggle'); flush()
    res.chosen = { tracks: chosen().map(t => t.name), regions: S.selR.length, focus: S.focus, inserts: (track('kick').inserts || []).map(x => x.name) }
    tap('[data-a="scene"][data-i="2"]'); flush(); res.marker = { focus: S.focus, at: S.selM }
    await snap('selftest-19-chosen.png')
    chooseTrack(S.tracks.indexOf(track('kick'))); chooseTrack(S.tracks.indexOf(track('snare')), 'toggle')
    keyDown('Backspace'); await sleep(200); res.afterFirstDelete = { tracks: S.tracks.length, regions: [track('kick').regs.length, track('snare').regs.length] }
    keyDown('Backspace'); await sleep(600); res.afterSecondDelete = { tracks: S.tracks.length, gone: !track('kick') && !track('snare') }
    res.mixWithoutThem = await (async () => { await playFrom(4); return listen(900) })(); halt(false)
    undoEdit(); await sleep(900); undoEdit(); await sleep(900)
    res.afterTwoUndos = { tracks: S.tracks.length, regions: [track('kick').regs.length, track('snare').regs.length], inserts: (track('kick').inserts || []).map(x => [x.name, !!x.dead]) }
    res.kickHeardAgain = await only(track('kick'), async () => { await playFrom(16); return listen(1000) }); halt(false)
    S.sel = S.tracks.indexOf(track('snare')); S.selT = []
    openNewTrack(); flush(); await NAT.call('testSnap', { name: 'selftest-20-new-track.png' }); await sleep(300)
    S.newT.n = 2; S.newT.inp = 1; const made = makeNewTracks(); await sleep(250)
    res.newTracks = { made: made.map(t => [t.name, t.kind, t.inp]), under: S.tracks.slice(S.tracks.indexOf(track('snare')), S.tracks.indexOf(track('snare')) + 3).map(t => t.name) }
    undoEdit(); await sleep(250); res.newTracksUndone = S.tracks.length === n0
    const t = track('hats'), r = t.regs.slice().sort((x, y) => x.a - y.a)[0], a0 = r.a
    const before = await only(t, async () => { await playFrom(1); return listen(900) }); halt(false)
    S.selR = [r.id]; S.focus = 'lanes'; S.pos = 1; keyDown('Semicolon'); await sleep(250)
    res.toPlayhead = { from: a0, to: regOf(r.id)[0].a, silentThereBefore: before, heardThere: await only(t, async () => { await playFrom(1); return listen(900) }) }; halt(false)
    undoEdit(); await sleep(250); res.toPlayheadUndone = regOf(r.id)[0].a === a0
    S.nudge = '10 ms'; S.selR = [r.id]; act.nudge(1); await sleep(120); res.nudge10ms = +((regOf(r.id)[0].a - a0) * SPB()).toFixed(5); undoEdit(); S.nudge = 'beat'; await sleep(120)
    S.selR = []; S.selT = []; S.selM = null; S.focus = 'lanes'; __daw.redraw()
    return res
  })
  /* editing, round 2, in the app's own web view with real pointer events: the smart tool's fades and its crossfade at a join
     (heard: the crossfaded join is no louder and no quieter than the plain one, since both halves are one sound), the five modes,
     the shuffle closing up, an edit group, a part of the song said twice */
  await step('editing2', async () => {
    halt(false)
    const res = {}, k = track('kick'), ki = S.tracks.indexOf(k), rowTop = () => rowY(ki) + 1.5, lh = () => S.rh - 3
    const rh0 = S.rh, pxb0 = PXB, vx0 = VX, vy0 = VY
    S.rh = 40; setZoom(40, 22); VY = 0; __daw.redraw(); flush()
    const sorted = () => k.regs.slice().sort((x, y) => x.a - y.a), shape = () => sorted().map(r => [+r.a.toFixed(3), +r.b.toFixed(3), +(r.fi || 0).toFixed(3), +(r.fo || 0).toFixed(3)])
    res.before = shape()
    pickTool('smart'); flush()
    const r1 = sorted()[1]
    await pull(bx(r1.a) + 4, rowTop() + 3, bx(r1.a) + 44, rowTop() + 5); res.fadeIn = +(regOf(r1.id)[0].fi * PXB).toFixed(1)
    { const lanes = document.querySelector('[data-a="lanes"]'), seen = {}
      for (const [name, x, y] of [['fade', bx(r1.a) + 4, rowTop() + 3], ['trim', bx(r1.a) + 2, rowTop() + lh() / 2], ['range', bx(r1.a) + 120, rowTop() + lh() * .3], ['grab', bx(r1.a) + 120, rowTop() + lh() * .75], ['crossfade', bx(sorted()[2].a), rowTop() + lh() - 3]]) { fire('pointermove', x, y, lanes, { buttons: 0 }); seen[name] = lanes.style.cursor.replace(/url\([^)]*\)/g, 'url()').slice(0, 60) }
      res.pointers = seen }
    press(bx(sorted()[2].a), rowTop() + lh() - 3); flush(); await sleep(80)
    res.crossfade = { made: +(xfadeOf(sorted()[1], sorted()[2]) * SPB() * 1000).toFixed(1), chosen: !!S.selX, row: [...document.querySelectorAll('#g-info text')].map(x => x.textContent).filter(x => /crossfade|ms|linear|equal/.test(x)) }
    await pull(bx(sorted()[2].a) + 3, rowTop() + 3, bx(sorted()[2].a) + 63, rowTop() + 3)
    res.crossfadePulled = +(xfadeOf(sorted()[1], sorted()[2]) * PXB).toFixed(1)
    await snap('selftest-21-fades.png')
    const plain = async () => only(k, async () => { await playFrom(24 - .25); return listen(700) })      // the same stretch each time: a quarter of a bar before the join, on across it
    res.heardCrossfaded = await plain(); halt(false)
    keyDown('Backspace'); await sleep(120); res.afterDelete = { crossfade: xfadeOf(sorted()[1], sorted()[2]), regions: k.regs.length }
    res.heardPlain = await plain(); halt(false)
    undoEdit(); undoEdit(); undoEdit(); undoEdit(); await sleep(200)
    res.undone = JSON.stringify(shape()) === JSON.stringify(res.before)
    pickTool('pointer')
    /* the modes */
    tap('[data-a="modemenu"]'); res.modes = S.menu ? S.menu.items.map(i => i.t) : null; await pickMenu('shuffle'); res.mode = S.mode
    S.selR = [sorted()[1].id]; S.focus = 'lanes'; keyDown('Backspace'); await sleep(150); res.shuffleDelete = shape().map(x => x.slice(0, 2)); undoEdit(); await sleep(150)
    keyDown('F2'); res.f2 = S.mode; keyDown('KeyG', { metaKey: true }); res.cmdG = S.mode; keyDown('F3'); res.f3 = S.mode
    press(bx(sorted()[1].a) + 30, rowTop() + lh() / 2); await sleep(150); const box = document.getElementById('rename'); res.spotAsks = !box.hidden && box.value
    box.value = '15'; box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await sleep(150); res.spotted = shape().map(x => x.slice(0, 2)); undoEdit(); await sleep(150)
    setMode('smart')
    /* an edit group: the kick and the snare cut as one */
    chooseTrack(ki); chooseTrack(S.tracks.indexOf(track('snare')), 'toggle'); keyDown('KeyG', { ctrlKey: true, metaKey: true }); await sleep(120); flush()
    res.group = [k.grp, track('snare').grp]
    S.selR = []; S.selT = []; S.focus = 'lanes'; pickTool('scissors'); press(bx(9), rowTop() + lh() / 2); await sleep(120)
    res.cutAsOne = [k.regs.length, track('snare').regs.length]
    await snap('selftest-22-group.png')
    undoEdit(); undoEdit(); await sleep(200); pickTool('pointer'); res.ungrouped = !k.grp && !track('snare').grp
    /* a part said twice, and heard there */
    const ci = SCENES.findIndex(sc => sc.name === 'chorus')
    partAct(ci, 'repeat'); await sleep(500)
    res.repeated = { marks: SCENES.map(sc => [sc.name, sc.a]), kick: shape().map(x => x.slice(0, 2)), end: SONG_END }
    res.heardInTheCopy = await only(k, async () => { await playFrom(SCENES[ci + 1].a - 1 + .2); return listen(900) }); halt(false)
    undoEdit(); await sleep(400)
    res.marksBack = SCENES.map(sc => [sc.name, sc.a])
    S.rh = rh0; PXB = pxb0; VX = vx0; VY = vy0; S.selR = []; S.selX = null; S.selT = []; S.selM = null; S.focus = 'lanes'; __daw.redraw()
    return res
  })
  /* how fast a file goes, heard from its sound: a beat made here at a known speed (a loop cut to eight bars; one that is not a
     whole number of bars; a tone with no beat in it); a file fitted to the song's tempo and listened to again; the song taking a file's */
  await step('tempoHeard', async () => {
    halt(false)
    const sr = 44100
    const beat = (bpm, sec) => {
      const len = Math.round(sr * sec), ab = new AudioBuffer({ length: len, sampleRate: sr, numberOfChannels: 1 }), d = ab.getChannelData(0), per = 60 / bpm * sr
      let seed = 7
      const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2147483648 - 1 }
      for (let i = 0; i < len; i++) {
        const b = i / per, inBeat = (b % 1) * per, in8 = ((b * 2) % 1) * per / 2, q = Math.floor(b) % 4
        let v = Math.sin(2 * Math.PI * 55 * inBeat / sr * (1 + 3 * Math.exp(-inBeat / 400))) * Math.exp(-inBeat / (sr * .09)) * (q === 0 || q === 2 ? .8 : .25)      // a kick on one and three, a ghost of it on two and four
        if (q === 1 || q === 3) v += rnd() * Math.exp(-inBeat / (sr * .06)) * .5                // a snare on two and four
        v += rnd() * Math.exp(-in8 / (sr * .012)) * .18                                         // hats in eighths
        d[i] = v * .7
      }
      return ab
    }
    const tone = sec => { const len = Math.round(sr * sec), ab = new AudioBuffer({ length: len, sampleRate: sr, numberOfChannels: 1 }), d = ab.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.sin(2 * Math.PI * 220 * i / sr) * .3; return ab }
    const put = async (ab, name) => Object.assign({ name }, await decodeFile(new File([wav16(ab)], name + '.wav', { type: 'audio/wav' })))
    const loop96 = await put(beat(96, 8 * 4 * 60 / 96), 'beat a'), free = await put(beat(127.3, 21.7), 'beat b'), slow = await put(beat(72, 30.1), 'beat d'), fast = await put(beat(174, 19.3), 'beat e'), flat = await put(tone(12), 'tone c')
    const heard = {}
    for (const [name, d] of [['loop96', loop96], ['free1273', free], ['slow72', slow], ['fast174', fast], ['tone', flat]]) { const t0 = performance.now(); heard[name] = await NAT.call('tempo', { key: d.key }); heard[name].ms = Math.round(performance.now() - t0) }
    const t = newTrack('audio', 'tempo check', true), was = S.tempo
    placeDecoded([free], S.tracks.indexOf(t), 1); await sleep(1200)
    const r = t.regs[0], res = { heard, placedBpm: r.bpm, said: S.last && S.last.say }
    S.selR = [r.id]; S.focus = 'lanes'
    const len0 = r.b - r.a
    await act.fitTempo(); await sleep(3000)
    const rr = regOf(r.id)[0]
    res.fit = { song: S.tempo, rate: +rr.rate.toFixed(4), fx: !!rr.fx, bars: +(rr.b - rr.a).toFixed(3), barsBefore: +len0.toFixed(3), rendered: !!rr.wkey }
    if (rr.wkey) res.fit.heardAfter = await NAT.call('tempo', { key: rr.wkey })
    undoEdit(); await sleep(400)
    S.selR = [t.regs[0].id]
    await act.tempoFrom(); await sleep(1800)
    res.songTook = S.tempo
    setTempo(was); await sleep(1800)
    await deleteTrack(S.tracks.indexOf(t)); await sleep(250)
    res.tempoBack = S.tempo
    return res
  })
  /* strip silence: a file with three stretches of tone in it and silences between (one too short to count) is cut down to
     the stretches with sound; what is left is heard where there was tone and silent where there was none */
  await step('stripSilence', async () => {
    halt(false)
    const sr = 44100, plan = [[1, 1], [1, 0], [.5, 1], [.2, 0], [.5, 1], [2, 0], [1, 1]], total = plan.reduce((a, p) => a + p[0], 0)
    const ab = new AudioBuffer({ length: Math.round(sr * total), sampleRate: sr, numberOfChannels: 1 }), d = ab.getChannelData(0)
    let i = 0
    for (const [sec, on] of plan) { const n = Math.round(sec * sr); for (let j = 0; j < n; j++, i++) d[i] = on ? Math.sin(2 * Math.PI * 330 * j / sr) * .4 * Math.min(1, j / 200, (n - j) / 200) : 0 }
    const file = Object.assign({ name: 'gaps' }, await decodeFile(new File([wav16(ab)], 'gaps.wav', { type: 'audio/wav' })))
    const t = newTrack('audio', 'strip check', true)
    placeDecoded([file], S.tracks.indexOf(t), 5); await sleep(300)
    const r = t.regs[0], a0 = r.a - 1
    const parts = await NAT.call('soundParts', { key: r.key, floor: -40, gap: .3, pre: .01, post: .06 })
    S.selR = [r.id]; S.focus = 'lanes'
    await act.strip(); await sleep(400)
    const secs = t.regs.slice().sort((x, y) => x.a - y.a).map(q => [+((q.a - 1 - a0) * SPB()).toFixed(3), +((q.b - 1 - a0) * SPB()).toFixed(3), +((q.off || 0) * SPB()).toFixed(3)])
    const at = async sec => only(t, async () => { await playFrom(a0 + sec / SPB()); return (await listen(250)).rms })
    const res = { parts, pieces: secs, said: S.last && S.last.say, chosen: S.selR.length }
    res.heard = { inFirst: await at(.3), inTheGap: await at(1.3), inSecond: await at(2.1), inLongGap: await at(4), inLast: await at(5.4) }; halt(false)
    undoEdit(); await sleep(200); res.undone = t.regs.length
    await deleteTrack(S.tracks.indexOf(t)); await sleep(250)
    return res
  })
  /* close up: a file whose samples are known (a tone of a hundred samples to the wave, at the engine's own rate) is zoomed in on
     until a sample is sixteen pixels wide; the app is asked for the stretch on show and what it sends is those samples; a
     cut made there lands on a sample, and plays from that sample */
  await step('closeUp', async () => {
    halt(false)
    const sr = SND_SR, len = sr * 2, ab = new AudioBuffer({ length: len, sampleRate: sr, numberOfChannels: 1 }), d = ab.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.sin(2 * Math.PI * i / 100) * .5
    const file = Object.assign({ name: 'tone' }, await decodeFile(new File([wav16(ab)], 'tone.wav', { type: 'audio/wav' })))
    const t = newTrack('audio', 'close up', true), ti = S.tracks.indexOf(t)
    placeDecoded([file], ti, 5); await sleep(300)
    const r = t.regs[0], rh0 = S.rh, pxb0 = PXB, vx0 = VX, vy0 = VY, res = { rate: sr, outline: (r.peaksAll || []).length }
    S.rh = 60; showRow(ti); setZoom(maxPXB(), r.a - 1); VX = r.a - 1 - 40 / PXB; __daw.redraw(); flush()
    const t0 = performance.now()
    for (let k = 0; k < 40 && !FINE.get(r.id + ''); k++) await sleep(25)
    flush(); await sleep(60)
    const e = FINE.get(r.id + '')
    res.asked = e ? { ms: Math.round(performance.now() - t0), from: e.from, to: e.to, n: e.n, eachIsASample: e.n === e.to - e.from } : null
    if (e) { let worst = 0; for (let j = 0; j < Math.min(e.n, 400); j++) worst = Math.max(worst, Math.abs(e.lo[j] - Math.sin(2 * Math.PI * (e.from + j) / 100) * .5), Math.abs(e.hi[j] - e.lo[j])); res.asked.worstAgainstTheTone = +worst.toFixed(4) }
    const row = LANES.rows.get(t.id), paths = row ? [...row.el.querySelectorAll('path')].map(q => q.getAttribute('d')) : []
    res.drawn = { asSamples: paths.some(q => /h2\.8v2\.8h-2\.8Z/.test(q)), pxb: Math.round(PXB), bars: [...document.querySelectorAll('#g-ruler text')].map(x => x.textContent).filter(x => /^[\d ]+$/.test(x)).slice(0, 3) }
    await snap('selftest-23-close-up.png')
    /* a cut, 37 samples in: it lands on that sample, and what plays after it begins with that sample of the tone */
    pickTool('scissors'); press(bx(r.a) + 37 * 16 + 5, rowY(ti) + S.rh / 2); await sleep(120); pickTool('pointer')
    const two = t.regs.slice().sort((x, y) => x.a - y.a)
    const songSample = q => (q.a - 1) / oneSample()                                         // where it begins, in samples of the song (a bar is not a whole number of samples: the engine plays from the nearest one)
    res.cut = { pieces: two.length, onASampleOfTheSong: two[1] ? Math.abs(songSample(two[1]) - Math.round(songSample(two[1]))) < 1e-6 : null, samplesIn: two[1] ? Math.round(songSample(two[1])) - Math.round(songSample(two[0])) : null, sameSound: two[1] ? Math.abs((two[1].a - (two[1].off || 0)) - (two[0].a - (two[0].off || 0))) < 1e-12 : null }
    /* further out, where many samples share a pixel but the outline is too coarse: the app is asked again, a step to a pixel */
    setZoom(20000, r.a - 1); VX = r.a - 1 - 40 / PXB; __daw.redraw(); flush()
    const n0 = FINE_N
    for (let k = 0; k < 40 && FINE_N === n0; k++) await sleep(25)
    flush(); await sleep(60)
    const e2 = FINE.get((two[1] || two[0]).id + '')
    res.further = e2 ? { n: e2.n, samplesToAStep: +((e2.to - e2.from) / e2.n).toFixed(2), samplesToAPixel: +(SND_SR * SPB() / PXB).toFixed(2) } : null
    await snap('selftest-24-closer-than-the-outline.png')
    undoEdit(); await sleep(100)
    S.rh = rh0; PXB = pxb0; VX = vx0; VY = vy0
    await deleteTrack(S.tracks.indexOf(t)); await sleep(250); __daw.redraw()
    return res
  })
  /* the measure: in three-four the song sounds as it did — the kick that was heard from bar 17 is heard at that same moment, a
     third of the way into bar 22 now — the engine counts a bar of three beats (the playhead covers the bars a third faster),
     and four-four gives every region its bar back */
  await step('measure', async () => {
    halt(false)
    const k = track('kick'), heardAt = async bar => { const r = await only(k, async () => { await playFrom(bar); return listen(600) }); halt(false); return r }
    const res = { before: { spb: +SPB().toFixed(4), heard: await heardAt(16), gap: await heardAt(13.2) } }
    setMeter(3, 4); await sleep(700)
    res.three = { meter: S.meter.join('/'), spb: +SPB().toFixed(4), kickNow: +k.regs.slice().sort((x, y) => x.a - y.a)[1].a.toFixed(4), heardAtTheSameMoment: await heardAt(16 * 4 / 3), gapAtTheSameMoment: await heardAt(13.2 * 4 / 3) }
    play(0); await sleep(500); const p0 = curPos(), t0 = performance.now(); await sleep(2000); const p1 = curPos(), dt = (performance.now() - t0) / 1000; halt(false)
    res.three.barsASecond = +((p1 - p0) / dt).toFixed(3); res.three.shouldBe = +(1 / SPB()).toFixed(3)
    setMeter(4, 4); await sleep(700)
    res.back = { meter: S.meter.join('/'), kick: k.regs.slice().sort((x, y) => x.a - y.a).map(r => [+r.a.toFixed(4), +r.b.toFixed(4)]), heard: await heardAt(16) }
    return res
  })
  /* the click: played from bar three at a tempo whose bars are not a whole number of samples (92: the place of "one" is
     rounded up to the block's first sample), the first beat heard must be the bar's first; and a bar counted in before a
     take has four beats, the first of them the accent; in three-four a bar has three */
  await step('click', async () => {
    halt(false)
    const res = { tempo: S.tempo, barInSamples: +(SPB() * SND_SR).toFixed(3) }, was = S.click
    S.click = true; pushClick(); setCycle(S.cycle.a, S.cycle.b, false)
    const from = async (bar, ms) => { await NAT.call('testPerf'); play(bar); await sleep(ms); halt(false); await sleep(120); const p = await NAT.call('testPerf'); return { clicks: p.clicks, accents: p.accents } }
    res.fromBarThree = await from(2, Math.round(SPB() * 1000 * .6))                  // six tenths of a bar: beats one, two and three
    res.fromBarFive = await from(4, Math.round(SPB() * 1000 * 1.1))                  // a bar and a little: five beats, two of them a bar's first
    setMeter(3, 4); await sleep(600)
    res.threeFour = await from(3, Math.round(SPB() * 1000 * 1.1))                    // a bar of three and a little: four beats, two of them a bar's first
    setMeter(4, 4); await sleep(600)
    S.click = was; pushClick()
    return res
  })
  /* a change of tempo is a step that can be undone: the tempo comes back, the regions are where they were, and the engine
     plays the loops of that tempo again (and the same forwards) */
  await step('tempoUndo', async () => {
    halt(false)
    const k = track('kick'), t0 = S.tempo, lay = () => JSON.stringify(k.regs.slice().sort((x, y) => x.a - y.a).map(r => [+r.a.toFixed(4), +r.b.toFixed(4)])), was = lay(), frames0 = LOOPS.kick.n, steps0 = UNDO.length
    const heardAt = async bar => { const r = await only(k, async () => { await playFrom(bar); return listen(600) }); halt(false); return r }
    const res = { tempo: t0, heard: await heardAt(16) }
    setTempo(t0 === 120 ? 104 : 120); await sleep(1400)
    res.changed = { tempo: S.tempo, loopFrames: LOOPS.kick.n !== frames0, oneStep: UNDO.length - steps0, heard: await heardAt(16) }
    undoEdit(); await sleep(1600)
    res.undone = { tempo: S.tempo, sameLanes: lay() === was, loopFrames: LOOPS.kick.n === frames0, heard: await heardAt(16) }
    redoEdit(); await sleep(1600)
    res.redone = { tempo: S.tempo, heard: await heardAt(16) }
    undoEdit(); await sleep(1600)
    res.end = { tempo: S.tempo, sameLanes: lay() === was }
    return res
  })
  await step('menuBar', async () => {
    const titles = (await NAT.call('testMenus')).titles
    S.ho.open = false; await NAT.call('testMenu', { id: 'handoff' }); await sleep(150); const handOff = S.ho.open; S.ho.open = false
    await NAT.call('testMenu', { id: 'saveas' }); await sleep(150); const ask = !!S.ask; document.getElementById('rename').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await NAT.call('testMenu', { id: 'open' }); await sleep(400); const list = S.menu ? S.menu.items.map(it => it.t) : null; S.menu = null; uiDirty('menu'); flush()
    if (S.sheet) toggleSheet(); await NAT.call('testMenu', { id: 'keys' }); await sleep(150); const keys = !!S.sheet; if (S.sheet) toggleSheet()      // the app menu's key command assignments: the list of keys, for now
    await NAT.call('testMenu', { id: 'newtracks' }); await sleep(150); const newTracks = !!S.newT; closeNewTrack(); flush()                            // the track menu's first line: the new-track list
    return { titles, handOff, ask, list, keys, newTracks }
  })
  /* a project from before this room (kept as it was saved then, with its own colours and its tall rows): it opens, and takes the room's look */
  await step('oldProject', async () => {
    const list = ((await NAT.call('projList')) || []).map(p => p.name)
    if (!list.includes('migration check')) return { skipped: 'no old project was put there to try' }
    const opened = await loadProject('migration check'); await sleep(300); flush()
    const res = { opened, name: PROJ.name, demo: PROJ.demo, rh: S.rh, panel: S.panel.on, slur: S.slur, pxbFits: Math.abs(PXB - fitPXB()) < 40, scenes: SCENES.length, tracks: S.tracks.map(t => [t.name, t.fam, t.outline, t.c, t.regs.length]), oldColourKept: S.tracks.some(t => 'own' in t),
      patches: S.tracks.map(t => [t.name, t.patch.A.tape, t.patch.A.space, t.patch.A.delay, t.patch.B.tape, PRINTS3.filter(k => printOn(t, k)).join(' ') || 'nothing']) }      // the mock-up patch is taken off where it was never touched, and kept where it was
    await playFrom(16); res.heard = await listen(1200); halt(false)
    await snap('selftest-18-old-project.png')
    await openProject('selftest'); await sleep(300)
    return res
  })
  await step('audioWindow', async () => { await NAT.call('audioSettings'); await sleep(1200); return { opened: true, inputs: INPUTS, windows: (await NAT.call('testMenus')).titles.split(' | ').pop() } })
  await note('page', { errors: window.__errs || [], chains: await NAT.call('testInfo') })
  await NAT.call('testDone')
}
