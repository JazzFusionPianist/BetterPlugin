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
  /* only this: the app opened the way a hand opens it. Its window must be as large as the screen leaves a window; the
     start page must come up by itself, knowing the device and the room on the disk; with nothing saved yet its list is empty and nothing gets written while it waits; command n makes a
     project from the chosen template with the tempo set there; brought up again, the page lists that project with what it
     read from its file, and return opens it */
  if (mode === 'start') {
    const res = {}, names = async () => ((await NAT.call('projList')) || []).map(p => p.name)
    for (let k = 0; k < 60 && !(START.on && START.read); k++) await sleep(100)
    await sleep(3600)                                                                    // the quiet save comes round once meanwhile
    flush(); await NAT.call('testSnap', { name: 'selftest-start-1-first.png' }); await sleep(250)
    res.up = { on: START.on, held: PROJ.hold, list: START.list.length, written: await names(), dev: START.dev, free: START.free > 0, cmdHidden: getComputedStyle(document.getElementById('cmd')).display === 'none', templates: BEGIN.map(b => beginLook(b).map(t => t.kind).join(' ')) }
    keyDown('Space'); await sleep(200); res.up.played = S.playing
    res.up.fill = await NAT.call('testFill')                                            // the window, against what the screen leaves it: it opens as large as that
    START.tpl = 2; START.num.tempo = 96; uiDirty('start'); flush()
    keyDown('KeyN', { metaKey: true }); for (let k = 0; k < 80 && (START.on || START.busy); k++) await sleep(100)
    await sleep(300)
    res.made = { on: START.on, held: PROJ.hold, name: PROJ.name, tempo: S.tempo, tracks: S.tracks.map(t => `${t.name} ${t.kind}`), sends: S.tracks.filter(t => t.sends.length).map(t => t.name), plate: patchNow(S.tracks.find(t => t.name === 'plate')).space, written: await names(), undo: UNDO.length }
    await snap('selftest-start-2-made.png')
    openStart(null); for (let k = 0; k < 60 && !START.read; k++) await sleep(100)
    flush(); await NAT.call('testSnap', { name: 'selftest-start-3-again.png' }); await sleep(250)
    res.again = { on: START.on, listed: START.list.map(p => ({ name: p.name, tracks: p.f ? p.f.count : -1, tempo: p.f ? p.f.tempo : -1, bytes: p.f ? p.f.bytes : -1, saved: savedText(p.modified) })) }
    keyDown('Enter'); for (let k = 0; k < 80 && START.on; k++) await sleep(100)
    await sleep(300)
    res.opened = { on: START.on, held: PROJ.hold, name: PROJ.name, tracks: S.tracks.length, tempo: S.tempo }
    await note('start', res); await note('page', { errors: window.__errs || [] }); await NAT.call('testDone'); return
  }
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
  await step('renameBoxes', async () => { const box = () => { const r = document.getElementById('rename').getBoundingClientRect(), b = document.getElementById('board').getBoundingClientRect(), k = W / b.width; return [Math.round((r.left - b.left) * k), Math.round((r.top - b.top) * k), Math.round(r.width * k), Math.round(r.height * k)] }; const out = {}; VY = 0; __daw.redraw(); startRename('track', 1); out.track = box(); await NAT.call('testSnap', { name: 'selftest-14-rename.png' }); await sleep(300); document.getElementById('rename').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); startRename('tempo'); out.tempo = box(); document.getElementById('rename').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); startRename('scene', 2); out.scene = box(); document.getElementById('rename').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); startRename('key'); out.key = box(); document.getElementById('rename').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); startRename('proj'); out.proj = box(); out.ask = !!S.ask; document.getElementById('rename').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); out.hidden = document.getElementById('rename').hidden; return out })
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
  /* save as, to a place outside the folder the app keeps projects in (the check has no hands for the mac's panel: the app
     answers for it with a folder of the check's own). The song goes there with its sounds, is known by where it lies, is
     renamed where it lies, stands in the list of projects to open, and opens again from there. */
  /* the program's folders under its old name (slur daw) come to lie under its new one: on stand-ins of the check's own */
  await step('moved', async () => NAT.call('testMoved'))
  /* the settings window: what it reads of the device, a thing set through it (the threads: the check never moves the
     machine's device), the window itself and a picture of its page */
  await step('settings', async () => {
    const d = await NAT.call('settingsRead'), res = { outs: (d.outs || []).length, ins: (d.ins || []).length, hasOut: (d.outs || []).includes(d.out), rate: d.rate, rates: (d.rates || []).length, block: d.block, blocks: (d.blocks || []).length, threads: d.threads, asked: d.asked, cores: d.cores }
    res.two = (await NAT.call('settingsSet', { what: 'threads', value: 2 })).ok && (await NAT.call('settingsRead')).threads
    res.all = (await NAT.call('settingsSet', { what: 'threads', value: 0 })).ok && (await NAT.call('settingsRead')).asked
    res.device = (await NAT.call('settingsSet', { what: 'block', value: d.block })).why                         // left alone by the check
    res.unknown = (await NAT.call('settingsSet', { what: 'nothing', value: 1 })).why
    await NAT.call('testMenu', { id: 'settings' }); await sleep(1500)
    res.window = await NAT.call('testSettings', { name: 'selftest-settings.png' }); await sleep(600)
    res.inMenu = (await NAT.call('testMenus')).titles.split(' | ')[0]
    await NAT.call('settingsClose'); await sleep(200)
    res.closed = !(await NAT.call('testSettings', {})).open
    return res
  })
  /* the language of the settings: the room writes itself again in korean and back, a name someone gave stays as it was given */
  await step('language', async () => {
    const texts = () => [...document.querySelectorAll('#svg text')].map(t => t.textContent), has = w => texts().includes(w), res = { was: LANG.now }
    S.panel.on = true; S.panel.tab = 'mixer'; setView(true); __daw.redraw(); flush()
    res.english = { mixer: has('mixer'), tracks: has('tracks'), a: has('믹서') }
    res.set = (await NAT.call('settingsSet', { what: 'lang', value: 'ko' })).ok; await sleep(400); __daw.redraw(); flush()
    res.korean = { now: LANG.now, mixer: has('믹서'), tracks: has('트랙'), english: has('mixer'), name: has(S.tracks[0].name), read: (await NAT.call('settingsRead')).lang }
    await snap('selftest-language-ko.png')
    await NAT.call('settings', { part: 'general' }); await sleep(1500); res.window = await NAT.call('testSettings', { name: 'selftest-settings-ko.png' }); await sleep(500); await NAT.call('settingsClose')
    res.back = (await NAT.call('settingsSet', { what: 'lang', value: 'en' })).ok; await sleep(400); __daw.redraw(); flush()
    res.again = { now: LANG.now, mixer: has('mixer'), korean: has('믹서') }
    S.panel.on = false; setView(true); __daw.redraw()
    return res
  })
  await step('elsewhere', async () => {
    const tail = k => String(k).replace(/^.*\/Slur DAW self-test\//, ''), home = projKey(), res = { home }
    await openProject('selftest copy'); await sleep(300); await refreshPool()
    const from = projKey(), pool0 = (PROJ.pool || []).length, tracks0 = S.tracks.length, lanes0 = S.tracks.map(t => t.regs.length).join(' ')
    await NAT.call('testMenu', { id: 'saveas' })
    for (let k = 0; k < 150 && (projKey() === from || saveAsAsk.busy); k++) await sleep(100)
    await refreshPool()
    res.saved = { key: tail(projKey()), name: PROJ.name, outside: PROJ.at[0] === '/', pool: [pool0, (PROJ.pool || []).length], said: S.last && S.last.say }
    const there = projKey()
    newTrack('audio'); res.write = await saveNow(true)
    res.onDisk = JSON.parse((await NAT.call('projLoad', { name: there })).json).tracks.length - tracks0             // the track just made is in the file that lies there
    res.old = JSON.parse((await NAT.call('projLoad', { name: from })).json).tracks.length - tracks0                 // and not in the one it was copied from
    await renameProject('selftest moved'); res.renamed = { key: tail(projKey()), name: PROJ.name, oldGone: !(await NAT.call('projLoad', { name: there })).ok }
    const moved = projKey()
    res.same = (await NAT.call('projCopy', { from: moved, to: moved })).why
    res.inside = (await NAT.call('projCopy', { from, to: moved + '/audio/in.sls' })).why
    res.taken = (await NAT.call('projCopy', { from, to: moved })).why
    res.listed = ((await NAT.call('projList', { also: [moved, there, '/nowhere/x.sls'] })) || []).filter(p => p.in).map(p => [p.name, p.in])
    await openProject(from); await sleep(300); res.away = [projKey(), S.tracks.length - tracks0]
    await openProject(moved); await sleep(300); await refreshPool()
    res.again = { key: tail(projKey()), name: PROJ.name, tracks: S.tracks.length - tracks0, lanes: S.tracks.slice(0, tracks0).map(t => t.regs.length).join(' ') === lanes0, pool: (PROJ.pool || []).length }
    await playFrom(0); res.heard = await listen(1000); halt(false)
    await openProject(home); await sleep(300); res.back = projKey()
    return res
  })
  /* the mac's own panels do come up (not part of the whole check: they show on the screen for a moment — ./selftest.sh steps:panels).
     Each is looked at and closed by its cancel: nothing is saved, nothing opened. */
  if (wanted) await step('panels', async () => {
    const res = { from: projKey() }
    const up = async cancel => { const r = await NAT.call('testPanel', { cancel: cancel ? 1 : 0 }); return String(r.up).replace(/\/\S.*\/Slur DAW self-test\//, '') }
    let ans = null
    NAT.call('projWhere', { from: projKey(), name: `${PROJ.name} 2`, panel: 1 }).then(r => { ans = r })
    for (let k = 0; k < 40 && !(await up()); k++) await sleep(100)
    await sleep(600); res.save = await up(true)
    for (let k = 0; k < 40 && !ans; k++) await sleep(100)
    res.saveCancelled = ans; ans = null
    NAT.call('projPick', { from: projKey(), panel: 1 }).then(r => { ans = r })
    for (let k = 0; k < 40 && !(await up()); k++) await sleep(100)
    await sleep(600); res.open = await up(true)
    for (let k = 0; k < 40 && !ans; k++) await sleep(100)
    res.openCancelled = ans; res.still = projKey()
    return res
  })
  await step('menuBar', async () => {
    const titles = (await NAT.call('testMenus')).titles
    S.ho.open = false; await NAT.call('testMenu', { id: 'handoff' }); await sleep(150); const handOff = S.ho.open; S.ho.open = false
    await NAT.call('testMenu', { id: 'rename' }); await sleep(150); const ask = !!S.ask; document.getElementById('rename').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await NAT.call('testMenu', { id: 'recent' }); await sleep(400); const list = S.menu ? S.menu.items.map(it => it.t) : null; S.menu = null; uiDirty('menu'); flush()
    if (S.sheet) toggleSheet(); await NAT.call('testMenu', { id: 'keys' }); await sleep(150); const keys = !!S.sheet; if (S.sheet) toggleSheet()      // the app menu's key command assignments: the list of keys, for now
    await NAT.call('testMenu', { id: 'newtracks' }); await sleep(150); const newTracks = !!S.newT; closeNewTrack(); flush()                            // the track menu's first line: the new-track list
    return { titles, handOff, ask, list, keys, newTracks }
  })
  /* ── tracks of notes ──
     The pitch of a sound the app holds, read from a stretch of its samples (4096 of them, from `sec` seconds in). */
  const pitchOf = async (key, sec) => {
    const w = await NAT.call('wave', { key, from: Math.round(sec * SND_SR), to: Math.round(sec * SND_SR) + 4096, n: 4096 })
    if (!w || !w.ok) return 0
    const x = w.hi
    let first = -1, last = -1, c = 0
    for (let i = 1; i < x.length; i++) if (x[i - 1] < 0 && x[i] >= 0) { const at = i - 1 - x[i - 1] / (x[i] - x[i - 1]); if (first < 0) first = at; else c++; last = at }
    return c > 0 ? +(w.rate * c / (last - first)).toFixed(1) : 0
  }
  const notesOn = (t, a, b, list) => { let r = null; edit(() => { r = mkReg({ a, b, loop: false, notes: list.map(([tt, d, n, v]) => mkNote(tt, d, n, v == null ? 110 : v)) }); t.regs.push(r) }); return r }
  const key = (st, d1, d2) => NAT.call('key', { st, d1, d2 })
  /* the room's own synth plays the notes on its lane: heard where they are and not before; a' is 440; silent, soloed away,
     and transposed by its region; printed twice it is the same to the last bit, however many threads */
  await step('notes', async () => {
    halt(false); if (S.cycle.on) keyDown('KeyC')
    const res = {}, n0 = S.tracks.length
    const t = newInstTrack('synth', 'sub bass'); await natSession(); await sleep(250)
    res.made = { tracks: S.tracks.length - n0, name: t.name, kind: t.kind, inst: t.inst.kind, sound: t.inst.sound, outline: (repaint(), t.outline), cells: cellsOf(t).map(c => c.t).join(' '), engineTracks: (await NAT.call('testInfo')).tracks }
    const r = notesOn(t, 3, 4, [[0, 3.6, 69]]); await natSession(); await sleep(150)
    res.before = await only(t, async () => { await playFrom(1); return listen(500) }); halt(false)
    res.heard = await only(t, async () => { await playFrom(2); return listen(800) }); halt(false)
    await sleep(900); res.afterStop = await only(t, () => listen(300))
    S.selR = [r.id]; await bounceInPlace(); await sleep(200)
    const b = S.tracks.find(x => x.name === `${t.name} bounce`), br = b && b.regs[0]
    res.bounce = { track: !!b, onATrackOfSound: !!b && !b.inst, sourceSilent: r.mute, pitch: br ? await pitchOf(br.key, .6) : 0, sec: br ? +br.sec.toFixed(2) : 0 }
    if (b) await deleteTracks([b]); r.mute = false
    edit(() => { r.tr = 12 }); await natSession(); await sleep(100)
    S.selR = [r.id]; await bounceInPlace(); await sleep(200)
    const b2 = S.tracks.find(x => x.name === `${t.name} bounce`)
    res.octaveUp = b2 && b2.regs[0] ? await pitchOf(b2.regs[0].key, .6) : 0
    if (b2) await deleteTracks([b2]); r.mute = false; edit(() => { r.tr = 0 })
    edit(() => { setNotes(r, [mkNote(0, .9, 57, 110), mkNote(1, .9, 60, 100), mkNote(2, .9, 64, 90), mkNote(3, .9, 69, 120)]) }); await natSession(); await sleep(100)
    const m = async (fresh, n) => { if (n != null) await NAT.call('testHands', { n }); const x = await NAT.call('testMeasure', { a0: 2, a1: 3.5, fresh: 1 }); return [x.mark, +x.sum.toFixed(3)] }
    for (const x of S.tracks) x.solo = x === t; applyAll(); await sleep(60)
    const one = await m(1, 0), again = await m(1, 0), many = await m(1, 3)
    await NAT.call('testHands', { n: -1 })
    for (const x of S.tracks) x.solo = false; applyAll()
    res.print = { sounds: one[1] > 1, sameTwice: one[0] === again[0], sameWithMoreThreads: one[0] === many[0], mark: one[0] }
    r.mute = true; await natSession(); await sleep(100)
    res.regionSilent = await only(t, async () => { await playFrom(2); return listen(600) }); halt(false)
    r.mute = false; await natSession()
    await snap('selftest-19-notes.png')
    return res
  })
  /* the keys: a key played by hand sounds on the chosen track of notes, and on no other; the computer's own keys are a keyboard
     when they are switched on, and commands again when they are off */
  await step('keys', async () => {
    halt(false)
    const res = {}, t = S.tracks.find(isInst) || newInstTrack('synth', 'sub bass')
    await natSession(); leadTrack(S.tracks.indexOf(t)); flush(); await sleep(150)
    res.inputs = await NAT.call('keyInputs')
    await key(0x90, 69, 110); res.down = await only(t, () => listen(500))
    await key(0x80, 69, 0); await sleep(900); res.up = await only(t, () => listen(300))
    leadTrack(S.tracks.indexOf(track('kick'))); flush(); await sleep(150)
    await key(0x90, 69, 110); res.otherTrackChosen = await listen(400); await key(0x80, 69, 0)
    t.arm = true; uiDirty('head'); flush(); await sleep(150)
    await key(0x90, 69, 110); res.armedThoughNotChosen = await only(t, () => listen(400)); await key(0x80, 69, 0); await sleep(300)
    t.arm = false; leadTrack(S.tracks.indexOf(t)); flush(); await sleep(150)
    const autoWas = S.auto
    keyDown('KeyK', { metaKey: true }); await sleep(50)
    res.typing = { on: TYPE.on, said: S.last && S.last.say }
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true, cancelable: true })); res.typed = await only(t, () => listen(450))
    /* its sheet: up over the lanes, naming the track, the held key lit; a key of its piano pressed with the pointer is heard too */
    { flush(); const g = document.getElementById('g-keys'); res.typing.sheet = { drawn: g.innerHTML.length > 1000, names: g.textContent.includes(t.name), lit: g.innerHTML.includes(`fill="${t.c}"`) }
      await snap('selftest-29-keyboard.png')
      for (const x of S.tracks) x.solo = x === t; applyAll()
      const [mx, my] = mid('[data-a="kb"][data-k="key"][data-v="7"]', .5, .8)
      await NAT.call('testMeter'); fire('pointerdown', mx, my); await sleep(60); const held = [...TYPE.down.keys()].includes('pointer'); await sleep(350); const m = await NAT.call('testMeter')
      fire('pointerup', mx, my, window); await sleep(60)
      for (const x of S.tracks) x.solo = false; applyAll()
      res.typing.sheet.pointer = { held, letGo: ![...TYPE.down.keys()].includes('pointer'), rms: +m.rms.toFixed(4) } }
    res.typing.letterWasNoCommand = S.auto === autoWas
    await key(0x90, 72, 100); await sleep(80)
    leadTrack(S.tracks.indexOf(track('kick'))); flush(); await sleep(700); res.keysLetGoWhenTheTrackIsLeft = await only(t, () => listen(300))      // (two keys were down on it: both come up)
    document.body.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', code: 'KeyA', bubbles: true, cancelable: true })); await key(0x80, 72, 0)
    keyDown('KeyK', { metaKey: true }); await sleep(50); res.typing.off = !TYPE.on
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true, cancelable: true })); res.typing.letterIsACommandAgain = S.auto !== autoWas
    if (S.auto !== autoWas) toggleAuto()
    leadTrack(S.tracks.indexOf(t)); flush(); await sleep(150)
    await key(0x90, 64, 110); await sleep(200); const ringing = await only(t, () => listen(300))
    keyDown('Numpad0'); await sleep(700)                                              // stop, with the song standing still: every note off
    res.stopTwiceSilences = { ringing, after: await only(t, () => listen(300)) }; await key(0x80, 64, 0)
    return res
  })
  /* a take of notes: what is played while the take runs becomes notes where it was played; and what was played with nothing
     recording is still there to be kept (shift r) */
  await step('noteTake', async () => {
    halt(false)
    const res = {}, t = newInstTrack('synth', 'pluck'); await natSession(); flush(); await sleep(200)
    S.pos = 8; S.countIn = false; const clickWas = S.click; if (S.click) toggleClick()
    await record(); await sleep(450)
    res.rolling = { rec: !!S.rec, armed: t.arm }
    const at1 = curPos(); await key(0x90, 60, 100); await sleep(320); const up1 = curPos(); await key(0x80, 60, 0); await sleep(280)
    const at2 = curPos(); await key(0x90, 67, 80); await sleep(260); await key(0x80, 67, 0); await sleep(500)
    await stopRecord(true); await sleep(200)
    const r = t.regs[0], sn = r ? regSound(r) : []
    res.take = { regions: t.regs.length, from: r && r.a, to: r && r.b, notes: sn.map(x => [+x.a.toFixed(3), +x.b.toFixed(3), x.n, x.v]), sent: [+at1.toFixed(3), +up1.toFixed(3), +at2.toFixed(3)], undo: UNDO.length }
    res.take.inPlace = sn.length === 2 && Math.abs(sn[0].a - at1) < .09 && Math.abs(sn[1].a - at2) < .09 && Math.abs((sn[0].b - sn[0].a) - (up1 - at1)) < .06
    res.heardBack = await only(t, async () => { await playFrom(8); return listen(900) }); halt(false)
    await playFrom(12); await sleep(200)
    const at3 = curPos(); await key(0x90, 72, 90); await sleep(300); await key(0x80, 72, 0); await sleep(250); halt(false); await sleep(150)
    const n1 = t.regs.length, c1 = await captureNotes(); await sleep(100)
    res.captured = { region: !!c1, regions: t.regs.length - n1, at: c1 ? regSound(c1).map(x => [+x.a.toFixed(3), x.n]) : null, sent: +at3.toFixed(3), inPlace: !!c1 && regSound(c1).length === 1 && Math.abs(regSound(c1)[0].a - at3) < .09, said: S.last && S.last.say }
    S.pos = 20; uiDirty('top'); await sleep(200)
    await key(0x90, 55, 90); await sleep(250); await key(0x80, 55, 0); await sleep(250); await key(0x90, 57, 90); await sleep(250); await key(0x80, 57, 0); await sleep(200)
    const c2 = await captureNotes(); await sleep(100)
    res.capturedStandingStill = c2 ? { from: c2.a, notes: regSound(c2).map(x => [+x.a.toFixed(3), x.n]), firstAtThePlayhead: Math.abs(regSound(c2)[0].a - 20) < 1e-6, secondLater: regSound(c2).length === 2 && Math.abs((regSound(c2)[1].a - 20) * SPB() - .5) < .12 } : null
    t.arm = false; if (clickWas) toggleClick()
    return res
  })
  /* the kit and the sampler: every pad struck is heard; a sound let go on a sampler's track is played up the keys from its own */
  await step('kitAndSampler', async () => {
    halt(false)
    const res = {}, d = newInstTrack('drums'); await natSession(); await sleep(200)
    notesOn(d, 3, 5, DRUM_PADS.map(([, n], i) => [i * .5, .25, n, 110])); await natSession(); await sleep(100)
    res.kit = { name: d.name, heard: await only(d, async () => { await playFrom(2); return listen(1500) }) }; halt(false)
    const sm = newInstTrack('sampler'); await natSession(); await sleep(200)
    notesOn(sm, 3, 4, [[0, 1.8, 60], [2, 1.8, 72]]); await natSession()
    res.samplerEmpty = await only(sm, async () => { await playFrom(2); return listen(600) }); halt(false)
    const sr = 48000, len = sr * 2, ab = new AudioBuffer({ length: len, sampleRate: sr, numberOfChannels: 1 })
    { const x = ab.getChannelData(0); for (let i = 0; i < len; i++) x[i] = Math.sin(2 * Math.PI * 330 * i / sr) * .5 }
    const lanes0 = sm.regs.length, tracks0 = S.tracks.length
    await dropFiles([new File([wav16(ab)], 'tone 330.wav', { type: 'audio/wav' })], S.tracks.indexOf(sm), 1); await sleep(400)
    res.sampler = { takesTheSound: !!(sm.inst.sample && sm.inst.sample.file), noRegionMade: sm.regs.length === lanes0 && S.tracks.length === tracks0, said: S.last && S.last.say, named: instName(sm) }
    res.sampler.heard = await only(sm, async () => { await playFrom(2); return listen(700) }); halt(false)
    S.selR = [sm.regs[0].id]; await bounceInPlace(); await sleep(200)
    const b = S.tracks.find(x => x.name === `${sm.name} bounce`), br = b && b.regs[0], half = SPB() / 2
    res.sampler.pitchOnItsKey = br ? await pitchOf(br.key, half * .4) : 0
    res.sampler.pitchAnOctaveUp = br ? await pitchOf(br.key, half * 1.4) : 0
    if (b) await deleteTracks([b]); sm.regs[0].mute = false
    return res
  })
  /* the instruments' own pages, with the real engine: the plate at the head of the patch pressed, the page stands where the
     patch stood; what is taken hold of there is heard — a filter pulled shut is quieter, a pad pressed sounds, a pad's height
     pulled down is quieter, a sampler told to play to its end rings on after the key */
  await step('instrumentPage', async () => {
    halt(false)
    const res = {}, was = { on: S.panel.on, tab: S.panel.tab }, q = SPB() / 4
    const heard = (t, bar, ms) => only(t, async () => { await playFrom(bar); return listen(ms) })
    const t = newInstTrack('synth', 'saw lead'); await natSession(); await sleep(200)
    notesOn(t, 3, 5, [[0, 7.5, 57]]); await natSession()
    if (!S.panel.on || S.panel.tab !== 'patch') togglePanel('patch')
    S.panel.inst = false; setView(true); uiDirty('dock', 'head'); flush(); await sleep(120)
    res.plate = !!document.querySelector('[data-a="inst"]') && !instOpen()
    tap('[data-a="inst"]'); flush(); await sleep(80)
    res.opened = { open: instOpen(), sounds: document.querySelectorAll('[data-a="iv"][data-k="sound"]').length }
    await snap('selftest-25-instrument-synth.png')
    const open = await heard(t, 2, 600); halt(false)
    const [fx, fy] = mid('[data-a="iv"][data-k="filter"]')
    await pull(fx, fy, fx - 150, fy); await sleep(250)
    const shut = await heard(t, 2, 600); halt(false)
    res.filter = { cutoff: Math.round(t.inst.p.cutoff), open, shut, quieterShut: shut.rms < open.rms * .8 }
    press(fx, fy, { altKey: true }); flush(); await sleep(250)
    const again = await heard(t, 2, 600); halt(false)
    res.filter.putBack = { asTheSoundHasIt: t.inst.p.cutoff === undefined, again, asBefore: Math.abs(again.rms - open.rms) < open.rms * .25 }
    tap('[data-a="iv"][data-k="sound"][data-v="sub bass"]'); flush(); await sleep(300)
    res.sound = { picked: t.inst.sound, heard: await heard(t, 2, 500) }; halt(false)
    /* the kit: the page follows the chosen track; a pad pressed is chosen and heard; its height pulled down, its strokes are quieter */
    const d = newInstTrack('drums'); await natSession(); await sleep(250); uiDirty('dock', 'head'); flush(); await sleep(80)
    res.kit = { pageFollows: instOpen(), pads: document.querySelectorAll('[data-a="iv"][data-k="pad"]').length }
    for (const x of S.tracks) x.solo = x === d; applyAll()
    await NAT.call('testMeter'); tap('[data-a="iv"][data-k="pad"][data-v="2"]'); await sleep(450)
    { const m = await NAT.call('testMeter'); res.kit.padPressed = { chosen: IV.pad.get(d.id), rms: +m.rms.toFixed(4), peak: +m.peak.toFixed(4) } }
    for (const x of S.tracks) x.solo = false; applyAll()
    notesOn(d, 3, 4, [0, 1, 2, 3].map(i => [i, .5, 38, 110])); await natSession()
    const loud = await heard(d, 2, 900); halt(false)
    flush(); const lm = IV.g.stroke.marks.find(m => m[2] === 'level')
    await pull(lm[0] + 2, lm[1], lm[0] + 2, lm[1] + 50); await sleep(250)
    const soft = await heard(d, 2, 900); halt(false)
    res.kit.level = { db: d.inst.p['snare.level'], loud, soft, quieter: soft.peak < loud.peak * .5 }
    await snap('selftest-26-instrument-kit.png')
    /* the sampler: its sound's outline comes from the app; told to play to its end, a short key rings on */
    const sm = newInstTrack('sampler'); await natSession(); await sleep(200)
    const sr = 48000, len = sr * 2, ab = new AudioBuffer({ length: len, sampleRate: sr, numberOfChannels: 1 })
    { const x = ab.getChannelData(0); for (let i = 0; i < len; i++) x[i] = Math.sin(2 * Math.PI * 330 * i / sr) * .5 * (1 - .6 * i / len) }
    await dropFiles([new File([wav16(ab)], 'tone for the page.wav', { type: 'audio/wav' })], S.tracks.indexOf(sm), 1); await sleep(400)
    leadTrack(S.tracks.indexOf(sm)); uiDirty('dock', 'head'); flush(); await sleep(600); flush()
    res.sampler = { page: instOpen() && !!IV.g.sm, sound: !!(sm.inst.sample && sm.inst.sample.file), outline: ((sm.inst.sample && sm.inst.sample.peaks) || []).length }
    notesOn(sm, 3, 4, [[0, .25, 60]]); await natSession()
    const tail = () => only(sm, async () => { await playFrom(2); await sleep(q * 250 + 500); return listen(300) })
    const held = await tail(); halt(false)
    tap('[data-a="iv"][data-k="oneShot"][data-v="1"]'); await sleep(250)
    const whole = await tail(); halt(false)
    res.sampler.toItsEnd = { p: sm.inst.p.oneShot, held, whole, ringsOn: held.rms < .002 && whole.rms > .01 }
    { const [x0, y0] = mid('[data-a="iv"][data-k="sm"]', 0, .5), [x1] = mid('[data-a="iv"][data-k="sm"]', 1, .5)
      await pull(x0 + 6, y0, x0 + (x1 - x0) * .2, y0); res.sampler.startPulledIn = +(sm.inst.p.start || 0).toFixed(3) }
    await snap('selftest-27-instrument-sampler.png')
    tap('[data-a="iv"][data-k="chain"]'); flush(); await sleep(60)
    res.backToTheChain = !instOpen() && !!document.querySelector('[data-a="inst"]')
    await snap('selftest-28-instrument-plate.png')
    S.panel.inst = false
    if (!was.on) { if (S.panel.on) togglePanel(S.panel.tab) } else if (S.panel.tab !== was.tab) togglePanel(was.tab)
    setView(true); uiDirty('dock', 'head'); flush()
    return res
  })
  /* a region stretched by its end (option, the right end pulled): a sound plays slower to fill its new length at the pitch
     it had — the app renders it — and is as long as it says; notes are as much later and longer */
  await step('stretchByEnd', async () => {
    halt(false)
    const res = {}, t = newTracks({ kind: 'audio', n: 1, out: 0 })[0]; await natSession(); await sleep(150)
    const sr = 48000, len = sr * 2, ab = new AudioBuffer({ length: len, sampleRate: sr, numberOfChannels: 1 })
    { const x = ab.getChannelData(0); for (let i = 0; i < len; i++) x[i] = Math.sin(2 * Math.PI * 330 * i / sr) * .5 }
    await dropFiles([new File([wav16(ab)], 'tone to stretch.wav', { type: 'audio/wav' })], S.tracks.indexOf(t), 30); await sleep(500)
    const r = t.regs[0]
    if (!r) return { error: 'the file made no region' }
    const was = { a: r.a, b: r.b, sec: r.sec, rate: r.rate || 1, fx: !!r.fx }
    const toolWas = S.tool, flexWas = S.flex; S.tool = 'pointer'; S.flex = false
    leadTrack(S.tracks.indexOf(t)); showRow(S.sel); VX = Math.max(0, r.a - 4); relayout(); dirtyAll(); flush(); await sleep(80)
    const y = rowY(S.sel) + S.rh * .7, x0 = bx(r.b) - 2, x1 = bx(r.a + (r.b - r.a) * 1.5)
    /* held, half way: the page has drawn the region longer already (nothing asked it to but the hand), with its sound stretched in it */
    const lanes0 = document.getElementById('g-lanes').innerHTML, alt = { altKey: true }
    fire('pointerdown', x0, y, null, alt); flush(); for (let k = 1; k <= 3; k++) fire('pointermove', x0 + (x1 - x0) * k / 6, y, window, alt)
    const asked = dirty.has('lanes')                                                     // (the check's window is not in front, where a page is not given its turn to draw: that it asked to be drawn is what can be seen here; then it is drawn by hand)
    flush(); await sleep(60)
    res.held = { longer: r.b > was.b, asksToBeDrawn: asked, drawnLonger: document.getElementById('g-lanes').innerHTML !== lanes0, says: S.last && S.last.say }
    await snap('selftest-31-stretch-held.png')
    for (let k = 4; k <= 6; k++) fire('pointermove', x0 + (x1 - x0) * k / 6, y, window, alt)
    fire('pointerup', x1, y, window, alt); flush(); await sleep(60)
    for (let k = 0; k < 60 && !(r.wkey && r.wsig === warpSig(r)); k++) await sleep(100)
    const g = (r.b - r.a) / (was.b - was.a)
    res.sound = { was, grew: +g.toFixed(4), rate: +(r.rate || 1).toFixed(4), sec: +r.sec.toFixed(3), follows: !!r.fx, rendered: !!r.wkey, asLongAsItSays: Math.abs(r.sec - was.sec * g) < .01, pitch: r.wkey ? await pitchOf(r.wkey, r.sec * .4) : 0 }
    res.sound.heard = await only(t, async () => { await playFrom(r.a - 1); return listen(500) }); halt(false)
    keyDown('KeyZ', { metaKey: true }); await sleep(500)
    const back = t.regs[0]
    res.undone = back ? { b: back.b === was.b, rate: (back.rate || 1) === was.rate, follows: !!back.fx === was.fx } : null
    /* notes */
    const n = S.tracks.find(isInst) || newInstTrack('synth', 'e piano'); await natSession()
    const nr = notesOn(n, 40, 41, [[0, 1, 60], [2, 1, 64]]); await natSession()
    leadTrack(S.tracks.indexOf(n)); showRow(S.sel); VX = Math.max(0, nr.a - 4); relayout(); dirtyAll(); flush(); await sleep(80)
    { const y2 = rowY(S.sel) + S.rh * .7; await pull(bx(nr.b) - 2, y2, bx(nr.a + (nr.b - nr.a) * 2), y2, { altKey: true }) }
    const g2 = (nr.b - nr.a)
    res.notes = { grew: +g2.toFixed(4), at: nr.notes.map(q => [+q.t.toFixed(3), +q.d.toFixed(3)]), sounding: regSound(nr).map(x => +x.a.toFixed(3)) }
    res.notes.secondLater = await only(n, async () => { await playFrom(nr.a - 1 + g2 * .5 - .02); return listen(400) }); halt(false)
    S.tool = toolWas; S.flex = flexWas; uiDirty('info')
    return res
  })
  /* an instrument from outside: the list tells instruments from effects; the Mac's own one opens on a track of notes, plays its
     notes, has a window, and comes back with the project */
  await step('instrumentFromOutside', async () => {
    halt(false)
    const res = {}, list = (await NAT.call('plugins')) || []
    const dls = list.find(p => p.inst && /dls/i.test(p.id)) || list.find(p => p.inst && p.fmt === 'au' && /apple/i.test(p.maker || ''))
    res.list = { instruments: list.filter(p => p.inst).length, effects: list.filter(p => !p.inst).length, unsure: list.filter(p => p.unsure).length, picked: dls && dls.name }
    if (!dls) return res
    const t = newInstTrack('synth', 'e piano'); await natSession(); await sleep(200)
    notesOn(t, 3, 4, [[0, 1.8, 60], [2, 1.8, 67]]); await natSession()
    const r = await setInstPlug(t, dls, true); await sleep(600)
    res.opened = { ok: !!(r && r.ok), kind: t.inst.kind, name: instName(t), word: instWord(t) }
    res.heard = await only(t, async () => { await playFrom(2); return listen(900) }); halt(false)
    res.effectRefusedAsInstrument = await NAT.call('insert', { track: t.id, id: 'AudioUnit:Effects/aufx,dely,appl', inst: 1, show: 0 }).then(x => !(x && x.ok) || 'it opened')
    setInst(t, 'synth', 'organ'); await sleep(400)
    res.backToOurOwn = { kind: t.inst.kind, heard: await only(t, async () => { await playFrom(2); return listen(700) }) }; halt(false)
    await setInstPlug(t, dls, true); await sleep(500)
    /* a track made with an instrument from outside from the start (the new-track list's instrument key): it is opened once the engine has the track */
    const nt = newTracks({ kind: 'midi', inst: { kind: 'plug', id: dls.id, name: dls.name, fmt: dls.fmt }, n: 1, out: 0 })[0]
    await natSession(); await sleep(600)
    notesOn(nt, 3, 4, [[0, 1.8, 64]]); await natSession()
    res.madeWithIt = { name: nt.name, kind: nt.inst.kind, open: !!nt.inst.uid && !nt.inst.out, heard: await only(nt, async () => { await playFrom(2); return listen(800) }) }; halt(false)
    return res
  })
  /* a song with notes in it, saved, left and opened again: the instruments are there, the notes sound; undone, a track of
     notes that was taken away comes back with its instrument */
  await step('notesProject', async () => {
    halt(false)
    const res = {}, was = projKey(), mine = S.tracks.filter(isInst).map(t => [t.name, t.inst.kind, t.regs.length])
    const t = S.tracks.find(x => isInst(x) && x.inst.kind === 'synth' && x.regs.length) || (() => { const n = newInstTrack('synth', 'saw bass'); notesOn(n, 3, 4, [[0, 3, 45]]); return n })()
    await natSession(); await sleep(100)
    const name = t.name
    res.saved = await saveNow(true, true)
    await newProject(); await sleep(300)
    res.elsewhere = { name: PROJ.name, tracksOfNotes: S.tracks.filter(isInst).length }
    await openProject(was); await sleep(700)
    const back = S.tracks.filter(isInst).map(x => [x.name, x.inst.kind, x.regs.length])
    res.back = { same: JSON.stringify(back) === JSON.stringify(mine.length ? mine : back), tracksOfNotes: back.length, plugOpen: S.tracks.filter(x => isInst(x) && x.inst.kind === 'plug').map(x => !!x.inst.uid && !x.inst.out) }
    const t2 = S.tracks.find(x => x.name === name)
    res.back.heard = t2 ? await only(t2, async () => { await playFrom(2); return listen(800) }) : null; halt(false)
    if (t2) {
      const i = S.tracks.indexOf(t2); await deleteTracks([t2]); await sleep(200)
      const gone = !S.tracks.includes(t2); keyDown('KeyZ', { metaKey: true }); await sleep(500)
      const t3 = S.tracks.find(x => x.name === name)
      res.undoneDelete = { gone, back: !!t3, at: S.tracks.indexOf(t3) === i, heard: t3 ? await only(t3, async () => { await playFrom(2); return listen(800) }) : null }; halt(false)
    }
    /* handed off: beside the sound, the notes as a standard file and a page about the song */
    const dir = (await NAT.call('bounce', { kind: 'mix', a0: 2, a1: 4, modes: ['wet'], tracks: [], folder: 'notes hand off', name: 'notes mix', fmt: 'wav', rate: 0, bits: 24 })) || {}
    res.handOff = { printed: !!dir.ok, extras: dir.ok ? await handOffExtras(dir.dir, 'notes mix', 2, 4) : 0, outsideRefused: !(await NAT.call('fileWrite', { dir: '/tmp', name: 'x.txt', data: btoa('x') })).ok }
    resync(); applyAll()
    return res
  })
  /* going out: with the song changed since it was last saved the app is asked to wait and the question comes up; cancel
     lets it stand (the app is still here a good while later); don't save puts the file back as it was last saved, and what
     was written quietly since is kept among its earlier copies */
  await step('quitAsk', async () => {
    halt(false)
    const res = {}
    await saveNow(true); await sleep(150)
    const kept = LEAVE.kept, n0 = S.tracks.length, copies0 = ((await NAT.call('projBackups', { name: projKey() })) || []).length
    res.unchanged = !leaveChanged()
    newTracks({ kind: 'audio', n: 1, out: 0 }); await natSession(); await sleep(3600)        // a change, and time for the quiet save to write it
    const quiet = (await NAT.call('projLoad', { name: projKey() })) || {}
    res.changed = { asks: leaveChanged(), writtenQuietly: quiet.json !== kept }
    const hold0 = PROJ.hold
    leaveAsk(); flush(); await sleep(120)
    res.asked = { up: !!S.leave, says: S.leave && S.leave.since, appWaits: ((await NAT.call('quitWait')) || {}).ok === true, drawn: document.getElementById('g-leave').textContent }
    await snap('selftest-30-quit-asks.png')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true })); await sleep(1800)      // (longer than the app would have waited by itself)
    res.cancelled = { gone: !S.leave, writingAgain: PROJ.hold === hold0, stillHere: true }
    leaveAsk(); flush(); await leaveAnswer('dont', true); await sleep(250)
    const disk = (await NAT.call('projLoad', { name: projKey() })) || {}
    res.dontSave = { fileAsLastSaved: disk.json === kept, copiesMore: ((await NAT.call('projBackups', { name: projKey() })) || []).length - copies0, gone: !S.leave }
    await loadProject(projKey()); await sleep(700)
    res.reopened = { tracksAsSaved: S.tracks.length === n0, nothingToAsk: !leaveChanged() }
    return res
  })
  /* folders among the projects, in the app's own place: one is made (a second of the same name is not), a project is put in
     it and is listed there by where it lies, read like any other; a folder that holds one is not taken away; taken out
     again, the project is known by its name as before, and the empty folder goes */
  await step('folders', async () => {
    const res = {}, names = async () => ((await NAT.call('projFolders')) || []).map(f => f.name), where = async () => ((await NAT.call('projList', { also: [] })) || []).filter(p => p.name === 'to be moved').map(p => [p.dir || '', p.key])
    res.made = await NAT.call('folderNew', { name: 'demos check' })
    res.secondOfThatName = await NAT.call('folderNew', { name: 'demos check' })
    res.noName = await NAT.call('folderNew', { name: 'x.sls' })
    res.listed = (await names()).includes('demos check')
    await NAT.call('projSave', { name: 'to be moved', json: JSON.stringify({ v: 3, name: 'to be moved', demo: false, tempo: 100, meter: [4, 4], key: '', end: 64, scenes: [], tracks: [] }) })
    await saveNow(false, true)                                                         // (the app's note of which project is being worked on is the open one's again)
    res.putIn = await NAT.call('projMove', { name: 'to be moved', to: 'demos check' })
    const inKey = String((res.putIn || {}).key || '')
    res.listedIn = await where()
    res.readThere = !!((await NAT.call('projFacts', { name: inKey })) || {}).ok
    res.notWhereItWas = !((await NAT.call('projLoad', { name: 'to be moved' })) || {}).ok
    res.heldFolderStays = await NAT.call('folderDrop', { name: 'demos check' })
    res.nowhere = await NAT.call('projMove', { name: inKey, to: 'no such folder' })
    res.takenOut = await NAT.call('projMove', { name: inKey, to: '' })
    res.listedOut = await where()
    res.emptyFolderGoes = await NAT.call('folderDrop', { name: 'demos check' })
    res.listedAfter = (await names()).includes('demos check')
    await saveNow(false, true)
    return res
  })
  /* the grid on the lanes: a quarter to begin with — between two bar lines three lines on the beats; a sixteenth chosen from
     the list in the control bar, there are twelve fainter ones more; with a triplet grid what is pulled goes to thirds */
  await step('grid', async () => {
    const res = {}, was = { grid: S.grid, pxb: PXB, vx: VX }
    const lines = () => { flush(); const out = {}; for (const p of document.getElementById('ln-grid').querySelectorAll('path')) { const a = p.getAttribute('stroke-opacity') || '1', k = (p.getAttribute('d').match(/M/g) || []).length; if (k) out[a] = (out[a] || 0) + k } return out }
    S.grid = '1/4'; setZoom(240, 8); VX = 4; relayout(); dirtyAll(); flush(); await sleep(60)
    res.quarter = { lines: lines(), bar: document.getElementById('g-top').textContent.includes('grid1/4') }
    tap('[data-a="grid"]'); await sleep(80)
    res.list = S.menu ? S.menu.items.map(it => it.t).join(' ') : null
    res.picked = await pickMenu('1/16'); await sleep(80)
    res.sixteenth = { grid: S.grid, said: S.last && S.last.say, lines: lines() }
    await snap('selftest-32-grid.png')
    S.grid = '1/12'; dirtyAll(); flush()
    res.triplet = { lines: lines(), pulledTo: +(WHOLE() / gridStep()).toFixed(3) }
    S.grid = '1/4'; res.straight = { pulledTo: +(WHOLE() / gridStep()).toFixed(3) }
    res.kept = JSON.parse(serialize()).grid
    S.grid = was.grid; setZoom(was.pxb, 0); VX = was.vx; relayout(); dirtyAll(); flush()
    return res
  })
  /* the notes page with the real engine: p brings it up on a region of notes; a note made on its paper with two presses is
     heard when the song plays there; pulled up the keys it sounds higher (the bounce says by how much); taken away, silence */
  await step('notesPage', async () => {
    halt(false)
    const res = {}, panel = { on: S.panel.on, tab: S.panel.tab }
    const t = newInstTrack('synth', 'sub bass'); await natSession(); await sleep(200)            // (a plain wave: its pitch can be read off the bounce)
    const r = notesOn(t, 44, 45, []); await natSession()
    S.selR = [r.id]; leadTrack(S.tracks.indexOf(t)); flush()
    if (!rollOn()) keyDown('KeyP'); await sleep(80); setView(true); relayout(); dirtyAll(); flush(); await sleep(120)
    res.up = { on: rollOn(), focus: S.focus, shows: ROLL.rid === r.id, keys: document.querySelectorAll('[data-a="np"][data-k="key"]').length > 10 }
    const g = ROLL.g, at = (bar, key) => [g.x0 + (bar - ROLL.view.a) * g.pxb + 2, g.top + (g.hi - key + .5) * g.rowH]
    { const [x, y] = at(43.5, 69); press(x, y); await sleep(60); press(x, y); await sleep(200) }
    res.made = r.notes.map(q => [+q.t.toFixed(3), +q.d.toFixed(3), q.n, q.v])
    await natSession(); await sleep(100)
    res.heard = await only(t, async () => { await playFrom(43.4); return listen(500) }); halt(false)
    await snap('selftest-33-notes-page.png')
    { flush(); const el = document.querySelector('[data-a="np"][data-k="note"]'), b0 = document.getElementById('board').getBoundingClientRect(), k = b0.width / W, q = el.getBoundingClientRect(), x = (q.left + q.width / 2 - b0.left) / k, y = (q.top + q.height / 2 - b0.top) / k
      await pull(x, y, x, y - 12 * ROLL.g.rowH) }
    res.pulledUp = r.notes.map(q => q.n)
    setNotes(r, r.notes.map(q => Object.assign({}, q, { d: 2 }))); await natSession()
    S.selR = [r.id]; await bounceInPlace(); await sleep(200)
    const bt = S.tracks.find(x => x.name === `${t.name} bounce`), br = bt && bt.regs[0]
    res.pitchAnOctaveUp = br ? await pitchOf(br.key, SPB() * .5 + .2) : 0
    if (bt) await deleteTracks([bt])
    r.mute = false; S.selR = [r.id]; leadTrack(S.tracks.indexOf(t)); S.focus = 'notes'; ROLL.sel = new Set(r.notes.map(q => q.id)); flush()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', code: 'Backspace', bubbles: true, cancelable: true })); await sleep(120); await natSession()
    res.takenAway = { notes: r.notes.length, regionStill: !!regOf(r.id)[0], heard: await only(t, async () => { await playFrom(43.4); return listen(400) }) }; halt(false)
    if (rollOn()) togglePanel('notes'); if (panel.on) togglePanel(panel.tab); setView(true); relayout(); dirtyAll(); flush()
    return res
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
  /* for a print that is to be measured: nothing muted, nothing soloed, whatever the steps before left; and back as it was */
  const allHeard = () => { const was = S.tracks.map(x => [x, x.mute, x.solo]); for (const x of S.tracks) { x.mute = false; x.solo = false } applyAll(); return () => { for (const [x, m, so] of was) { x.mute = m; x.solo = so } applyAll() } }
  const sounding = x => x.kind === 'audio' && !x.inst && !x.parent && x.regs.some(r => (r.loop || r.file) && !r.mute)
  const firstBar = x => Math.floor(x.regs.filter(r => (r.loop || r.file) && !r.mute).sort((p, q) => p.a - q.a)[0].a - 1)
  /* a send into a bus whose plug-in hands its sound over late arrives together with the same sound gone its plain way:
     one track plays into a bus with nothing on it and sends into a bus with such a plug-in; the two buses are printed
     apart, and their sound lies on the same sample (it would lie the plug-in's lateness apart) */
  await step('sendLatency', async () => {
    const t = S.tracks.find(sounding), n0 = UNDO.length, tried = []
    if (!t) return { skipped: 'no track with sound on it' }
    const a0 = firstBar(t), back = allHeard()
    const A = newTrack('bus', 'way a', true), B = newTrack('bus', 'way b', true)
    setOut(t, A.id); setSend(t, t.sends.length, B.id)
    const sd = t.sends.find(x => x.to === B.id)
    if (!sd) { while (UNDO.length > n0) undoEdit(); back(); return { skipped: 'no send left on that track' } }
    sd.db = -6
    await natSession()
    let late = null
    for (const id of ['AudioUnit:Effects/aufx,lmtr,appl', 'AudioUnit:Effects/aufx,mcmp,appl', 'AudioUnit:Effects/aufx,nptc,appl', 'AudioUnit:Effects/aufx,dcmp,appl']) {
      const r = await natInsert(S.tracks.indexOf(B), id)
      tried.push([id.slice(-14), r && r.ok ? r.latency : String(r && r.error)])
      if (r && r.ok && r.latency > 0) { late = r; break }
      if (r && r.ok) { await NAT.call('remove', { track: B.id, uid: r.uid }); B.inserts = B.inserts.filter(x => x.uid !== r.uid) }
    }
    const res = { tried, track: t.name }
    if (late) {
      await sleep(300)
      const b = await NAT.call('bounce', { kind: 'stems', a0, a1: a0 + 2, modes: ['wet'], tracks: [{ id: A.id, name: 'way a' }, { id: B.id, name: 'way b' }], folder: 'send latency', name: 'send latency', fmt: 'wav', rate: 0, bits: 24 })
      res.plugin = late.name; res.samples = late.latency; res.printed = !!(b && b.ok)
      if (res.printed) res.lag = await NAT.call('testLag', { a: `${b.dir}/way a.wav`, b: `${b.dir}/way b.wav` })
      await NAT.call('remove', { track: B.id, uid: late.uid }); B.inserts = B.inserts.filter(x => x.uid !== late.uid)
    } else res.skipped = 'no plug-in here reports a delay'
    while (UNDO.length > n0) undoEdit()
    back(); await natSession(); await sleep(200)
    res.after = { buses: S.tracks.filter(x => x.name === 'way a' || x.name === 'way b').length, out: t.out, sends: t.sends.length }
    return res
  })
  /* a plug-in that listens to another track (its key, or side chain). The check's own plug-in lets its sound through whole
     while its second input is silent and at a quarter while anything sounds there: one track is printed with it alone,
     then listening to a track that sounds, then to one that is silent — and a track its own sound flows into is refused */
  await step('sideChain', async () => {
    const audio = S.tracks.filter(sounding), n0 = UNDO.length
    const t = audio[0], a0 = t ? firstBar(t) : 0
    const loud = audio.slice(1).reverse().find(x => x.regs.some(r => (r.loop || r.file) && !r.mute && r.a - 1 <= a0 + 1e-6 && r.b - 1 >= a0 + 2 - 1e-6))      // one listed after it: it has to be played first all the same
    if (!t || !loud) return { skipped: 'no two tracks sounding together' }
    const r = await natInsert(S.tracks.indexOf(t), 'test:duck')
    if (!r || !r.ok) return { skipped: 'the check\u2019s plug-in would not open', why: r && r.error }
    const back = allHeard()
    const ins = t.inserts.find(x => x.uid === r.uid), res = { track: t.name, key: loud.name, hasInput: !!ins.sc }
    const print = async name => { const b = await NAT.call('bounce', { kind: 'stems', a0, a1: a0 + 2, modes: ['wet'], tracks: [{ id: t.id, name }], folder: 'side chain', name: 'side chain', fmt: 'wav', rate: 0, bits: 24 }); return b && b.ok ? `${b.dir}/${name}.wav` : '' }
    const alone = await print('alone')
    res.given = await setKey(t, ins, loud.id); const keyed = await print('keyed')
    res.kept = (JSON.parse(serialize()).tracks.find(x => x.id === t.id).inserts || []).some(x => x.id === 'test:duck' && x.key === loud.id)      // it is written into the project with the plug-in
    const quiet = newTrack('audio', 'quiet one', true)
    await natSession()
    res.givenQuiet = await setKey(t, ins, quiet.id); const still = await print('still')
    const bus = newTrack('bus', 'after it', true); setOut(t, bus.id); await natSession()
    res.ring = await NAT.call('keyFrom', { track: t.id, uid: ins.uid, from: bus.id })
    res.ringRefused = !res.ring.ok && res.ring.why === 'ring' && !(await setKey(t, ins, bus.id)) && ins.key === quiet.id
    res.back = await setKey(t, ins, 0)
    if (alone && keyed && still) {
      const k = await NAT.call('testLag', { a: alone, b: keyed }), q = await NAT.call('testLag', { a: alone, b: still })
      res.keyed = { level: +(k.levelB / k.levelA).toFixed(3), lag: k.lag }; res.quiet = { level: +(q.levelB / q.levelA).toFixed(3), lag: q.lag }
    }
    await NAT.call('remove', { track: t.id, uid: r.uid }); t.inserts = t.inserts.filter(x => x.uid !== r.uid)
    while (UNDO.length > n0) undoEdit()
    back(); await natSession(); await sleep(200)
    res.after = { left: S.tracks.filter(x => x.name === 'quiet one' || x.name === 'after it').length, mine: t.inserts.filter(x => x.id === 'test:duck').length, out: t.out }
    return res
  })
  /* a line for one of a plug-in's own controls. The check's plug-in has one (how much of its sound it lets through): moved
     the way a hand moves it in the plug-in's window, it is the control the track's list of lines then offers; a line drawn
     for it at half is played by the engine — the track printed with it is half as loud — and is kept with the project */
  await step('plugLine', async () => {
    const t = S.tracks.find(sounding), n0 = UNDO.length
    if (!t) return { skipped: 'no track with sound on it' }
    const r = await natInsert(S.tracks.indexOf(t), 'test:duck')
    if (!r || !r.ok) return { skipped: 'the check’s plug-in would not open', why: r && r.error }
    const ins = t.inserts.find(x => x.uid === r.uid), a0 = firstBar(t), back = allHeard(), ap0 = t.ap, res = {}
    const print = async name => { const b = await NAT.call('bounce', { kind: 'stems', a0, a1: a0 + 2, modes: ['wet'], tracks: [{ id: t.id, name }], folder: 'plug line', name: 'plug line', fmt: 'wav', rate: 0, bits: 24 }); return b && b.ok ? `${b.dir}/${name}.wav` : '' }
    res.before = (await NAT.call('touched', { track: t.id, uid: ins.uid })).index
    await NAT.call('testTouch', { track: t.id, uid: ins.uid, i: 0, v: .8 }); await sleep(120)
    const moved = await NAT.call('touched', { track: t.id, uid: ins.uid }), list = await NAT.call('params', { track: t.id, uid: ins.uid })
    res.moved = [moved.index, moved.name, +(+moved.value).toFixed(2)]; res.list = (list || []).map(x => [x[0], x[1]])
    await NAT.call('testTouch', { track: t.id, uid: ins.uid, i: 0, v: 1 }); await sleep(120)
    const whole = await print('whole')
    await openAutoMenu(t, 100, 100)
    const offered = S.menu ? S.menu.items.find(x => x.v === `fx${ins.n}.0`) : null                      // (its own control: another plug-in on the track may offer one of its own too)
    res.offered = offered ? offered.t : null
    if (offered) { const m = S.menu; S.menu = null; m.pick(offered) }
    const k = t.ap
    res.key = k
    if (offered) {
      edit(() => { t.autos[k] = [{ id: ++PID, b: a0, v: .5 }, { id: ++PID, b: a0 + 2, v: .5 }] })
      await natSession(); await sleep(100)
      const half = await print('half'), saved = JSON.parse(serialize()).tracks.find(x => x.id === t.id)
      res.kept = !!(saved.autos[k] && saved.autos[k].length === 2) && (saved.inserts || []).some(x => x.id === 'test:duck' && x.n === ins.n && x.pn && x.pn[0] === 'level')
      res.shown = [autoName(t, k), AUTO[k].fmt(shown(t, k))]
      if (whole && half) { const q = await NAT.call('testLag', { a: whole, b: half }); res.level = +(q.levelB / q.levelA).toFixed(3); res.lag = q.lag }
    }
    await NAT.call('remove', { track: t.id, uid: r.uid }); t.inserts = t.inserts.filter(x => x.uid !== r.uid)
    while (UNDO.length > n0) undoEdit()
    t.ap = ap0; back(); S.menu = null; await natSession(); await sleep(200); __daw.redraw()
    res.after = { mine: t.inserts.filter(x => x.id === 'test:duck').length, lines: Object.keys(t.autos || {}).filter(x => /^fx/.test(x) && t.autos[x].length).length }
    return res
  })
  /* command x, c, v and a, pressed the way the Mac sends them — to the window (its views first: the page's web view among
     them), then to the menu bar — with the Latin letter, as the keyboard set to English gives it. The page has to hear them
     as keys (JUCE's web view kept these four to itself: see slurKeysToPage). With a marquee up, x cuts the stretch out
     and holds it; c holds it and v puts it down right after the marquee, twice in a row; a chooses every region. */
  await step('cmdKeys', async () => {
    const t = S.tracks.find(sounding), n0 = UNDO.length
    if (!t) return { skipped: 'no track with sound on it' }
    const ti = S.tracks.indexOf(t), r = t.regs.filter(q => (q.loop || q.file) && !q.mute && q.b - q.a >= 3).sort((p, q) => p.a - q.a)[0]
    if (!r) return { skipped: 'no region long enough' }
    const lane = () => t.regs.slice().sort((p, q) => p.a - q.a).map(q => [+q.a.toFixed(3), +q.b.toFixed(3)])
    const res = { track: t.name, was: lane() }, a = r.a, clip0 = CLIP, at = (x, y) => t.regs.some(q => Math.abs(q.a - x) < 1e-6 && Math.abs(q.b - y) < 1e-6)
    const press = async (key, code) => { const took = (await NAT.call('testCmdKey', { key, code })).took; await sleep(300); const then = (await NAT.call('testCmdKeyOn')).took; await sleep(150); return took + ' / ' + then }
    const el = document.activeElement
    res.had = el && el !== document.body ? el.id || el.tagName : ''                        // (a step before this one may have left a box with the keys: then they are the box's, as they should be)
    if (res.had) { el.blur(); await sleep(300) }
    const mark = () => { S.auto = false; S.selR = []; S.focus = 'lanes'; S.marq = { a, b: a + 1, t0: ti, t1: ti, also: [] }; CLIP = []; __daw.redraw() }      // (a marquee over the region's second bar)
    mark(); res.x = await press('x', 7)
    res.cut = { gone: !t.regs.some(q => q.a < a + 2 - 1e-6 && q.b > a + 1 + 1e-6), held: CLIP.length, marq: !!S.marq, steps: UNDO.length - n0 }
    while (UNDO.length > n0) undoEdit()
    mark(); res.c = await press('c', 8)
    res.copied = { held: CLIP.length, steps: UNDO.length - n0 }
    res.v = await press('v', 9); res.v2 = await press('v', 9)
    res.pasted = { first: at(a + 2, a + 3), second: at(a + 3, a + 4), marq: S.marq ? [S.marq.a, S.marq.b] : null, steps: UNDO.length - n0 }
    while (UNDO.length > n0) undoEdit()
    S.marq = null; S.selR = []; __daw.redraw()
    res.a = await press('a', 0)
    res.all = { chosen: S.selR.length, of: S.tracks.reduce((n, x) => n + x.regs.length, 0) }
    S.selR = []; S.marq = null; CLIP = clip0; jumpTo(0); __daw.redraw()
    res.after = lane()
    /* in a box that is being typed in they are the Mac's own, as they were: the page leaves the key alone, and it goes on
       to the Mac (command a here, which touches nothing outside the box: all of its text is chosen, and no region is) */
    const box = document.getElementById('cmd'), had = box.value
    box.focus(); box.value = 'abc def'; box.setSelectionRange(3, 3); await sleep(300)
    res.boxA = await press('a', 0)
    res.box = { focus: document.activeElement === box, from: box.selectionStart, to: box.selectionEnd, regions: S.selR.length }
    box.value = had; box.blur(); S.selR = []; __daw.redraw(); await sleep(300)
    mark(); res.x2 = await press('x', 7)                                                  // (and the box let go of: they are the page's again)
    res.again = { gone: !t.regs.some(q => q.a < a + 2 - 1e-6 && q.b > a + 1 + 1e-6), steps: UNDO.length - n0 }
    while (UNDO.length > n0) undoEdit()
    S.selR = []; S.marq = null; CLIP = clip0; __daw.redraw()
    res.ok = res.cut.gone && res.cut.held > 0 && res.cut.steps === 1 && res.copied.held > 0 && res.copied.steps === 0 && res.pasted.first && res.pasted.second && res.pasted.steps === 2 && !!res.pasted.marq && Math.abs(res.pasted.marq[0] - (a + 2)) < 1e-6
      && res.all.chosen === res.all.of && res.all.of > 0 && JSON.stringify(res.after) === JSON.stringify(res.was)
      && [res.x, res.c, res.v, res.v2, res.a, res.x2].every(w => / kept by the page$/.test(w)) && / left alone by the page/.test(res.boxA)
      && res.box.focus && res.box.from === 0 && res.box.to === 7 && res.box.regions === 0 && res.again.gone && res.again.steps === 1 && JSON.stringify(lane()) === JSON.stringify(res.was)
    return res
  })
  /* the hand-off folder holds everything: beside the sound, the patch of each track that has one as a file Patch on Slur
     opens (the same graph the engine runs, with the prints as they stand), and the project itself, whole */
  await step('handOffRest', async () => {
    const t = S.tracks.find(x => x.kind === 'audio'), was = copy(t.patch)
    setPrint(t, 'space', 40); setPrint(t, 'delay', 25); pushTrack(t)
    const b = await NAT.call('bounce', { kind: 'mix', a0: 0, a1: 1, modes: ['wet'], tracks: [], folder: 'hand off rest', name: 'rest mix', fmt: 'wav', rate: 0, bits: 24 })
    const res = { printed: !!(b && b.ok) }
    if (res.printed) {
      const r = await handOffRest(b.dir), now = patchNow(t)
      const pj = JSON.parse((await NAT.call('patchPreset', { tape: now.tape / 100, space: now.space / 100, delay: now.delay / 100, share: now.share / 100 })).json)
      const there = await NAT.call('projFacts', { name: `${b.dir}/${PROJ.name}.sls` })
      res.rest = r
      res.preset = { types: pj.nodes.map(n => n.type), amounts: pj.nodes.map(n => +n.amount.toFixed(2)), wires: pj.edges.map(e => [e.from, e.to, +e.gain.toFixed(2)]) }
      res.project = { ok: !!(there && there.ok), tracks: there && there.tracks ? there.tracks.length : -1, mine: S.tracks.length }
    }
    t.patch = was; pushTrack(t)
    return res
  })
  /* the start page, brought up over the check's own project the way it comes up when the app is opened: it lists what the
     app knows with what it read from each; nothing is written while it is up (a level moved meanwhile is not on the disk
     afterwards); the room's keys do not reach through it; and the project opened from it puts it away */
  await step('start', async () => {
    await saveNow(true)
    const key = typeof projKey === 'function' ? projKey() : PROJ.name, held0 = PROJ.hold
    openStart(null)
    for (let k = 0; k < 60 && !START.read; k++) await sleep(100)
    flush(); await sleep(150); await NAT.call('testSnap', { name: 'selftest-25-start.png' }); await sleep(250)
    const res = { on: START.on, held: PROJ.hold - held0, rows: document.querySelectorAll('[data-a="st-row"]').length, cmdHidden: getComputedStyle(document.getElementById('cmd')).display === 'none' }
    res.listed = START.list.map(p => ({ name: p.name, tracks: p.f ? p.f.count : -1, seconds: p.f ? Math.round(p.f.len) : -1, lanes: p.f ? p.f.lanes.length : -1, bytes: p.f ? p.f.bytes : -1 }))
    const vol0 = S.tracks[0].vol
    S.tracks[0].vol = vol0 - 3; await sleep(3600)                                        // the quiet save comes round meanwhile: it must leave the disk alone
    res.wroteNothing = JSON.parse((await NAT.call('projLoad', { name: key })).json).tracks[0].vol === vol0
    keyDown('Space'); await sleep(200); res.played = S.playing
    START.sel = Math.max(0, START.list.findIndex(p => p.key === key)); START.focus = 'list'
    keyDown('Enter'); for (let k = 0; k < 80 && START.on; k++) await sleep(100)
    await sleep(300)
    res.after = { on: START.on, name: PROJ.name, volBack: S.tracks[0].vol === vol0, held: PROJ.hold - held0, tracks: S.tracks.length }
    return res
  })
  await step('audioWindow', async () => { await NAT.call('audioSettings'); await sleep(1200); return { opened: true, inputs: INPUTS, windows: (await NAT.call('testMenus')).titles.split(' | ').pop() } })
  await note('page', { errors: window.__errs || [], chains: await NAT.call('testInfo') })
  await NAT.call('testDone')
}
