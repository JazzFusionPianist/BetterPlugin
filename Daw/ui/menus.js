/* ── the Mac's menu bar: everything the room does, findable from the top of the screen ──
   His ask (2026-10-16): someone new to a program of this kind wants to do a thing and does not know how; with every
   function in the menu bar, Help's search (the Mac's own, which looks through every line of every menu) finds it.
   Draft: design/menu draft 1 (his OK: "좋아 가자"). The bar is written here and handed to the app (Source/Mac.mm builds it):
   the lines, the keys they show, and which are on (a tick). A line pressed comes back as 'dawMenu' with its id and does
   what its key does in the room (KEYS) or what is written beside it.
   Keys: a line shows the key the room answers to. Only keys with ⌘ or ⌃ are the menu's own to answer, and only while no
   box is being typed in; every other key (a bare letter, an arrow, ⌥ or ⇧ alone) is shown and stays the page's.
   Words are written the Mac's way, in Title Case, as everything else the Mac draws for the app; with the program set to
   Korean they are the Mac's Korean (LANG.menuKo in lang.ko.js), and so is Help's search. A name someone gave stays as it is. */

/* a line: [title, key (as KEYS names it), opts]: { id (an id the app or the start page already knows), do, on (is it
   ticked), sub } — '-' is a line between */
const chosenRegs = () => (typeof selRegs === 'function' ? selRegs() : []).map(x => x[0])
const chosenTrack = () => S.tracks[S.sel]
const regsDo = f => { const rs = chosenRegs(); if (!rs.length) { say('choose a region first'); return } edit(() => { for (const r of rs) f(r) }); rewarp(rs); uiDirty('info', 'lanes') }
/* keys the menu answers wherever the keys are (slur's page, the settings window): they mean nothing in a box being typed in */
const ALWAYS = new Set(['⌘KeyN', '⌘KeyO', '⌘KeyS', '⇧⌘KeyS', '⌘KeyI', '⌘KeyB', '⌘KeyE', '⌥⌘KeyN', '⌥⌘KeyA', '⌥⌘KeyS'])
const NUDGE_COMBO = { bar: '⌥⇧KeyM', beat: '⌥⇧KeyB', '1/16': '⌥⇧KeyS', '10 ticks': '⌥⇧KeyT', tick: '⌥⇧KeyQ', '10 ms': '⌃⌥Digit0', '1 ms': '⌃⌥Digit1', sample: '⌃⌥KeyS' }
const MENU_BAR = () => [
  ['Slur Studio', [
    ['Settings', null, { sub: [['General', null, { id: 'settings:general' }], ['Display', null, { id: 'settings:display' }], ['Audio', null, { id: 'settings:audio' }], ['Plug-ins', null, { id: 'settings:plug-ins' }], ['Key Commands', null, { id: 'settings:key commands' }]] }],
    ['Key Commands…', '⌥KeyK', { id: 'settings:key commands' }],
  ]],
  ['File', [
    ['New', '⌘KeyN', { id: 'new' }], ['Open…', '⌘KeyO', { id: 'open' }],
    ['Open Recent', null, { sub: (MENUS.recent.length ? MENUS.recent.map(p => [p.name, null, { given: 1, id: 'recent:' + p.key, on: () => p.key === (typeof projKey === 'function' ? projKey() : '') }]) : [['No Projects Yet', null, { dim: true }]]).concat(['-', ['More…', null, { id: 'recent' }]]) }],
    '-',
    ['Save', '⌘KeyS', { id: 'save' }], ['Save As…', '⇧⌘KeyS', { id: 'saveas' }], ['Rename…', null, { id: 'rename' }], ['Revert To…', null, { id: 'revert' }], ['Find Missing Sounds…', null, { id: 'findmissing', do: () => findMissing() }],
    '-',
    ['Import Audio…', '⌘KeyI', { id: 'import' }],
    '-',
    ['Hand Off…', '⌘KeyB', { id: 'handoff' }], ['Hand Off Stems…', '⌘KeyE'], ['Bounce in Place', '⌃KeyB'], ['Bounce in Place in Realtime', null, { do: () => bounceInPlace(true) }],
  ]],
  ['Edit', [
    ['Undo', '⌘KeyZ', { sys: 'undo' }], ['Redo', '⇧⌘KeyZ', { sys: 'redo' }],
    '-',
    ['Cut', '⌘KeyX', { sys: 'cut' }], ['Copy', '⌘KeyC', { sys: 'copy' }], ['Paste', '⌘KeyV', { sys: 'paste' }], ['Delete', 'Backspace'], ['Select All', '⌘KeyA', { sys: 'selectAll' }],
    ['Select', null, { sub: [
      ['None', '⇧KeyD'], ['Invert', '⇧KeyI'], '-',
      ['All Following', '⇧KeyF'], ['All Following on the Same Track', '⌃⇧KeyF'], ['Inside the Cycle', '⇧KeyL'], ['Muted Regions', '⇧KeyM'], '-',
      ['Previous Region', 'ArrowLeft'], ['Next Region', 'ArrowRight'], ['Add Previous Region', '⇧ArrowLeft'], ['Add Next Region', '⇧ArrowRight'], ['First Region', '⇧Home'], ['Last Region', '⇧End'], '-',
      ['Previous Track', 'ArrowUp'], ['Next Track', 'ArrowDown']] }],
    '-',
    ['Split at Playhead', '⌘KeyT'], ['Split at Cycle Ends', '⌥⌘KeyT'], ['Join', 'KeyJ'], ['Repeat', '⌘KeyR'],
    '-',
    ['Cut Section Between Locators', '⌃⌘KeyX', { id: 'timecut' }], ['Insert Silence at Locators', '⌃⌘KeyZ', { id: 'timeroom' }], ['Insert Section at Playhead', '⌃⌘KeyV', { id: 'timeput' }], ['Repeat Section Between Locators', '⌃⌘KeyR', { id: 'timerepeat' }],
  ]],
  ['Region', [
    ['Mute', 'KeyN'], ['Rename…', null, { do: () => { if (S.selR.length) startRename('region'); else say('choose a region first') }, k: '⇧Enter' }],
    '-',
    ['Move to Playhead', 'Semicolon'], ['Move to Playhead and Select Next', '⇧Semicolon'], ['Loop to the Next Region', 'KeyL'],
    ['Trim Start to Playhead', 'BracketLeft'], ['Trim End to Playhead', 'BracketRight'], ['Shuffle Left', '⌥BracketLeft'], ['Shuffle Right', '⌥BracketRight'],
    '-',
    ['Gain', null, { sub: [['Up 1 dB', '⌃⇧ArrowUp'], ['Down 1 dB', '⌃⇧ArrowDown'], ['Up 0.1 dB', '⌃⌥⇧ArrowUp'], ['Down 0.1 dB', '⌃⌥⇧ArrowDown'], '-', ['Back to 0 dB', null, { do: () => regsDo(r => { r.gain = 0; dirtyReg(r) }) }]] }],
    ['Transpose', null, { sub: [['Up a Semitone', '⌥ArrowUp'], ['Down a Semitone', '⌥ArrowDown'], ['Up an Octave', '⌥⇧ArrowUp'], ['Down an Octave', '⌥⇧ArrowDown'], '-',
      ['Fine Tune Up 10 Cents', null, { do: () => regsDo(r => { if (!r.notes) r.ft = clamp((r.ft || 0) + 10, -100, 100) }) }], ['Fine Tune Down 10 Cents', null, { do: () => regsDo(r => { if (!r.notes) r.ft = clamp((r.ft || 0) - 10, -100, 100) }) }], '-',
      ['Back to the Original Pitch', null, { do: () => regsDo(r => { r.tr = 0; r.ft = 0 }) }]] }],
    ['Reverse', '⌃⇧KeyR'],
    ['Fades', null, { sub: [['Fades for Selection', 'KeyF', { id: 'fades' }], ['Fade In up to the Playhead', 'KeyD'], ['Fade Out from the Playhead', 'KeyG']] }],
    ['Nudge', null, { sub: [['Earlier', '⌥ArrowLeft'], ['Later', '⌥ArrowRight'], ['Shorter', '⌥⇧ArrowLeft'], ['Longer', '⌥⇧ArrowRight']] }],
    '-',
    ['Tempo', null, { sub: [['Follow the Tempo', '⌃KeyF', { on: () => chosenRegs().length > 0 && chosenRegs().every(r => r.fx) }], ['Fit Region to Project Tempo', '⌃⌥KeyF', { id: 'fittempo' }], ['Set Project Tempo from Region', '⌃⌥KeyT', { id: 'tempofrom' }]] }],
    ['Quantize', 'KeyQ'], ['Undo Quantize', '⌥⌘KeyQ'],
    ['Strip Silence', '⌃KeyX', { id: 'strip' }],
    '-',
    ['Group', '⌥⌘KeyG', { id: 'groupregs' }], ['Ungroup', '⌥⌘KeyU', { id: 'ungroupregs' }],
    ['Colour and Outline…', null, { do: () => { S.look = true; uiDirty('look', 'info') } }],
  ]],
  ['Track', [
    ['New Tracks…', '⌥⌘KeyN', { id: 'newtracks' }], ['New Audio Track', '⌥⌘KeyA', { id: 'newaudio' }], ['New Instrument Track', '⌥⌘KeyS'], ['New Bus', '⌃KeyN', { id: 'newbus' }],
    ['Create Reference Track', '⌥⌘KeyR'], ['Disable Track', null, { do: () => trackOffToggle(groupOf(S.sel)), on: () => !!(chosenTrack() && chosenTrack().disabled) }], ['Freeze Track', null, { do: () => freezeTrack(S.sel), on: () => !!(chosenTrack() && chosenTrack().frozen) }],
    '-',
    ['Duplicate', '⌘KeyD', { id: 'duptrack' }], ['Duplicate with Its Regions', '⌥⇧⌘KeyD'], ['Rename…', null, { id: 'renametrack', k: '⇧Enter' }], ['Delete', '⌘Backspace', { id: 'deltrack' }], ['Delete Empty Tracks', '⇧⌘Backspace'], ['Tidy Tracks', null, { do: () => tidyTracks() }],
    '-',
    ['Mute', 'KeyM', { on: () => !!(chosenTrack() && chosenTrack().mute) }], ['Solo', 'KeyS', { on: () => !!(chosenTrack() && chosenTrack().solo) }],
    ['Record Enable', null, { do: () => toggleArm(S.sel), on: () => !!(chosenTrack() && chosenTrack().arm) }], ['Hear the Input', '⌃KeyI', { on: () => !!(chosenTrack() && chosenTrack().mon) }],
    '-',
    ['Stack', null, { sub: [['Make a Stack', '⇧⌘KeyD'], ['Take the Stack Apart', '⇧⌘KeyU'], '-', ['Open the Stack', '⌃⌘ArrowRight'], ['Close the Stack', '⌃⌘ArrowLeft']] }],
    ['Group Tracks', '⌘KeyG', { id: 'grouptracks' }], ['Suspend Groups', '⇧KeyG', { id: 'groupsoff', on: () => !!S.grpOff }],
    '-',
    ['Instruments', null, { sub: [['Typing Keyboard', '⌘KeyK', { on: () => typeof TYPE !== 'undefined' && !!TYPE.on }], ['Capture as Recording', '⇧KeyR'], ['All Notes Off', '⌃⌘Period']] }],
  ]],
  ['Transport', [
    ['Play or Stop', 'Space'], ['Play from Selection', '⇧Space'], ['Record', 'KeyR'], ['Discard Recording', '⌘Period'],
    '-',
    ['Go to Start', 'Enter'], ['Go to End of Sound', '⌥Enter'], ['Back a Bar', 'Comma'], ['Forward a Bar', 'Period'], ['Back Eight Bars', '⇧Comma'], ['Forward Eight Bars', '⇧Period'],
    ['Previous Transient', '⌥Tab'], ['Next Transient', 'Tab'], ['Go to Bar…', 'Slash'],
    '-',
    ['Cycle', 'KeyC', { on: () => !!S.cycle.on }],
    ['Cycle Area', null, { sub: [['Set to Selection', 'KeyU'], ['Go to Its Start', '⌃⇧Comma'], ['Go to Its End', '⌃⇧Period'], '-', ['Move Forward by Its Length', '⇧⌘Period'], ['Move Back by Its Length', '⇧⌘Comma'], ['Twice as Long', '⌥⇧⌘Period'], ['Half as Long', '⌥⇧⌘Comma'], '-', ['Zoom to the Cycle', '⌃⇧KeyZ']] }],
    '-',
    ['Click', 'KeyK', { on: () => !!S.click }], ['Count-In', '⇧KeyK', { on: () => !!S.countIn }],
  ]],
  ['Markers', [
    ['Add Marker Here', '⌥Quote'], ['Add Marker for Selection', '⌥⇧Quote'], ['Rename Marker…', '⇧Quote'], ['Delete Marker Here', '⌥Backspace'],
    '-',
    ['Previous Marker', '⌥Comma'], ['Next Marker', '⌥Period'], ['Cycle the Marker', '⌃⌥KeyC'],
    ['Go to Marker', null, { sub: [1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => [`Marker ${k}`, 'Numpad' + k]) }],
  ]],
  ['Tools', [
    ['Tool', null, { sub: TOOLS.map(([name, , letter]) => [toolWord(name)[0].toUpperCase() + toolWord(name).slice(1), null, { do: () => pickTool(name), on: () => S.tool === name }]).concat(['-', ['Tool Menu', 'KeyT']]) }],
    ['Edit Mode', null, { sub: [['Smart', null, 'smart'], ['Grid', 'F4', 'grid'], ['Slip', 'F2', 'slip'], ['Shuffle', 'F1', 'shuffle'], ['Spot', 'F3', 'spot']].map(([t, k, m]) => [t, k, { do: () => setMode(m), on: () => S.mode === m }]).concat(['-', ['Slip, and Back', '⌘KeyG']]) }],
    ['Grid', null, { sub: GRIDS.flatMap((g, i) => (i === 6 ? ['-'] : []).concat([[g, null, { do: () => setGrid(g), on: () => S.grid === g }]])) }],
    ['Nudge Value', null, { sub: NUDGES.map(v => [v === '1/16' ? v : v.replace(/^\w/, c => c.toUpperCase()), NUDGE_COMBO[v] || null, { do: () => setNudge(v), on: () => S.nudge === v }]) }],
    ['Quantize Value', null, { sub: Q_VALUES.map(([v, t]) => [t.replace('triplet', 'Triplet'), null, { do: () => { S.q = v; uiDirty('info') }, on: () => Math.abs(S.q - v) < 1e-9 }]) }],
  ]],
  ['View', [
    ['Patch', 'KeyB', { on: () => S.panel.on && S.panel.tab === 'patch' }], ['Mixer', 'KeyX', { on: () => S.panel.on && S.panel.tab === 'mixer' }],
    ['Notes', 'KeyP', { on: () => S.panel.on && S.panel.tab === 'notes' }], ['Rubato Panel', 'KeyW', { on: () => S.panel.on && S.panel.tab === 'rubato' }],
    ['Slur', 'KeyO', { on: () => !!S.slur }], ['Inspector', null, { do: () => toggleInspector(), on: () => !!INSP.on }], ['Transport Panel', 'KeyH', { on: () => typeof TPANEL === 'object' && TPANEL.on }],
    '-',
    ['Automation', 'KeyA', { on: () => !!S.auto }], ['Next Automation Parameter', '⌘KeyY'], ['Rubato View', '⌘KeyF', { on: () => !!S.flex }],
    '-',
    ['Zoom In', '⌘ArrowRight'], ['Zoom Out', '⌘ArrowLeft'], ['Zoom to Fit or Selection', 'KeyZ'], ['Taller Rows', '⌘ArrowDown'], ['Shorter Rows', '⌘ArrowUp'], ['Taller Waveforms', '⌘Equal'], ['Lower Waveforms', '⌘Minus'],
    '-',
    ['Page Left', 'Home'], ['Page Right', 'End'], ['Page Up', 'PageUp'], ['Page Down', 'PageDown'], ['Show the Playhead', 'Backquote'], ['Show the Selection', '⇧Backquote'],
    '-',
    ['Close Plug-in Windows', 'KeyV'],
    ['Say It', '⌥Slash'],
  ]],
  ['Window', [
    ['Patch', null, { id: 'winpatch', do: () => togglePanel('patch'), on: () => S.panel.on && S.panel.tab === 'patch' }], ['Mixer', null, { id: 'winmixer', do: () => togglePanel('mixer'), on: () => S.panel.on && S.panel.tab === 'mixer' }], ['Slur', null, { id: 'winslur', do: () => toggleSlur(), on: () => !!S.slur }], ['Rubato Panel', 'KeyW', { id: 'winrubato', do: () => rubToggle(), on: () => S.panel.on && S.panel.tab === 'rubato' }],
    '-',
    ['Minimize', '⌘KeyM', { sys: 'performMiniaturize', always: 1 }], ['Zoom', null, { sys: 'performZoom' }],
    '-',
    ['Enter Full Screen', '⌃⌘KeyF', { sys: 'toggleFullScreen', always: 1 }],
  ]],
  ['Help', [
    ['Slur Studio Help', null, { id: 'guide' }],
    ['Key Commands', '⇧Slash', { id: 'keys' }],
    ['Quick Help', null, { do: () => qhToggle(), on: () => typeof QH === 'object' && QH.on }],
    ['Say It', '⌥Slash'],
  ]],
]

/* ── handed to the app ── */
const MENUS = { acts: new Map(), ons: new Map(), recent: [], sent: '', state: '', proj: null }
const NS_KEY = { ArrowUp: '', ArrowDown: '', ArrowLeft: '', ArrowRight: '', F1: '', F2: '', F3: '', F4: '', Home: '', End: '', PageUp: '', PageDown: '', Space: ' ', Enter: '\r', Backspace: '\b', Tab: '\t', Comma: ',', Period: '.', Semicolon: ';', Quote: '\'', Slash: '/', Backquote: '`', BracketLeft: '[', BracketRight: ']', Equal: '=', Minus: '-' }
/* a key as KEYS names it ('⌥⇧⌘KeyD') as the Mac's menu takes it: the key, and which of ⌘ ⌃ ⌥ ⇧ go with it */
function menuKeyOf (k) {
  if (!k) return null
  const mods = (k.match(/^[⌃⌥⇧⌘]*/) || [''])[0], code = k.slice(mods.length)
  const key = NS_KEY[code] || (/^Key[A-Z]$/.test(code) ? code.slice(3).toLowerCase() : /^(Digit|Numpad)\d$/.test(code) ? code.slice(-1) : null)
  if (key == null) return null
  return { key, cmd: mods.includes('⌘') ? 1 : 0, ctrl: mods.includes('⌃') ? 1 : 0, opt: mods.includes('⌥') ? 1 : 0, shift: mods.includes('⇧') ? 1 : 0 }
}
/* a line's words in the language the program speaks */
const menuWord = t => { if (LANG.now !== 'ko' || !LANG.menuKo) return t; const m = LANG.menuKo; if (m[t] != null) return m[t]; const n = /^Marker (\d)$/.exec(t); return n && m['Marker #'] ? m['Marker #'].replace('#', n[1]) : t }
function menuTree (lines, path, names) {
  return lines.map((l, i) => {
    if (l === '-') return { sep: 1 }
    const [t0, k0, o = {}] = l, t = o.given ? t0 : menuWord(t0), id = o.id || `m:${path}.${i}`
    const k = typeof kcShown === 'function' ? kcShown(`${names} > ${t0}`, k0, o.k) : k0 || o.k || null, own = !!k && k !== o.k      // (the key from settings > key commands: commands.js)
    if (o.sub) return { t, sub: menuTree(o.sub, `${path}.${i}`, `${names} > ${t0}`) }
    const run = o.do || (k0 && KEYS[k0] ? () => KEYS[k0]() : null)                    // (else, an id the app or MENU_DO knows)
    if (run) MENUS.acts.set(id, run)
    if (o.on) MENUS.ons.set(id, o.on)
    const mk = menuKeyOf(k)
    return Object.assign({ t, id }, mk ? { k: mk, answers: o.always || ALWAYS.has(k0 || k) ? 2 : (mk.cmd || mk.ctrl) && own ? 1 : 0 } : {}, o.sys ? { sys: o.sys } : {}, o.dim ? { dim: 1 } : {}, o.on ? { check: 1 } : {})
  })
}
async function menusSend () {
  if (!NAT) return
  try {
    const prefs = await NAT.call('prefGet'), also = prefs && Array.isArray(prefs.elsewhere) ? prefs.elsewhere : []
    MENUS.recent = ((await NAT.call('projList', { also })) || []).sort((a, b) => b.modified - a.modified).slice(0, 12)
  } catch (e) { MENUS.recent = [] }
  MENUS.acts.clear(); MENUS.ons.clear()
  const bar = MENU_BAR().map(([t, lines], i) => ({ t: menuWord(t), en: t, sub: menuTree(lines, String(i), t) })), json = JSON.stringify(bar)
  const words = Object.fromEntries(['About Slur Studio', 'Settings…', 'Services', 'Hide Slur Studio', 'Hide Others', 'Show All', 'Quit Slur Studio'].map(w => [w, menuWord(w)]))      // (the app's own menu, which the Mac makes)
  if (json !== MENUS.sent) { MENUS.sent = json; MENUS.state = ''; await NAT.call('menus', { bar, words }) }
  menusTick()
}
/* which lines are ticked, told to the app whenever that changes */
function menusTick () {
  if (!NAT || !MENUS.ons.size) return
  const on = {}
  for (const [id, f] of MENUS.ons) { let v = false; try { v = !!f() } catch (e) {} if (v) on[id] = 1 }
  const sig = Object.keys(on).join(',')
  if (sig !== MENUS.state) { MENUS.state = sig; NAT.call('menuState', { on }) }
  const pk = typeof projKey === 'function' ? projKey() : null
  if (pk !== MENUS.proj) { MENUS.proj = pk; if (MENUS.sent) menusSend() }     // another project: Open Recent is written again
}
/* a line pressed: what it does (the ids the start page and the room knew before go on as they were) */
function menuDo (id) {
  if (id === 'guideMissing') { say('the user guide is not in this build'); return }
  if (typeof START !== 'undefined' && START.on) { if (id === 'recent' || /^recent:/.test(id)) { const key = id.slice(7); if (key) openProject(key) } else startMenu(id); return }
  if (/^recent:/.test(id)) { openProject(id.slice(7)); return }
  const f = MENUS.acts.get(id) || (typeof MENU_DO === 'object' && MENU_DO[id])
  if (f) { f(); flush(); menusTick() }
}
/* where a box is being typed in, the menu answers no key: the keys are the box's */
const typingIn = e => e && e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)
if (NAT) {
  addEventListener('focusin', e => { if (typingIn(e)) NAT.call('typing', { on: 1 }) })
  addEventListener('focusout', e => { if (typingIn(e)) NAT.call('typing', { on: 0 }) })
  setInterval(menusTick, 250)
  LANG.heard.push(() => menusSend())                                            // another language: the bar is written again
  setTimeout(menusSend, 400)
  setInterval(menusSend, 60000)                                                  // (projects come and go on the disk too)
}
