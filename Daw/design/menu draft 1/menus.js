/* Slur Studio's menu bar, draft 1 (2026-10-16): everything the room does, findable from the bar (and so from Help's
   search, which looks through every line of it). A line: [title, key, opts]. key is how the room's own key table names
   a key ('⌥⇧⌘KeyD'); the menu shows it the Mac's way. opts: { sub: [lines] } a menu inside; { check } a line that is on
   or off; { note } what the draft says of it. '-' is a line between. Words are written the Mac's way (Title Case). */
const MENU_BAR = [
  ['Slur Studio', [
    ['About Slur Studio'],
    '-',
    ['Settings…', '⌘Comma'],
    ['Settings', null, { sub: [['General'], ['Display'], ['Audio']] }],
    ['Key Commands', '⌥KeyK'],
    '-',
    ['Services', null, { sys: true }],
    '-',
    ['Hide Slur Studio', '⌘KeyH', { sys: true }], ['Hide Others', '⌥⌘KeyH', { sys: true }], ['Show All', null, { sys: true }],
    '-',
    ['Quit Slur Studio', '⌘KeyQ', { sys: true }],
  ]],
  ['File', [
    ['New', '⌘KeyN'], ['Open…', '⌘KeyO'], ['Open Recent', null, { sub: [['(the last projects)'], '-', ['Clear Menu']] }],
    '-',
    ['Save', '⌘KeyS'], ['Save As…', '⇧⌘KeyS'], ['Rename…'], ['Revert To…'],
    '-',
    ['Import Audio…', '⌘KeyI'],
    '-',
    ['Hand Off…', '⌘KeyB'], ['Hand Off Stems…', '⌘KeyE'], ['Bounce in Place', '⌃KeyB'],
  ]],
  ['Edit', [
    ['Undo', '⌘KeyZ'], ['Redo', '⇧⌘KeyZ'],
    '-',
    ['Cut', '⌘KeyX'], ['Copy', '⌘KeyC'], ['Paste', '⌘KeyV'], ['Delete', 'Backspace'], ['Select All', '⌘KeyA'],
    ['Select', null, { sub: [
      ['None', '⇧KeyD'], ['Invert', '⇧KeyI'], '-',
      ['All Following', '⇧KeyF'], ['All Following on the Same Track', '⌃⇧KeyF'], ['Inside the Cycle', '⇧KeyL'], ['Muted Regions', '⇧KeyM'], '-',
      ['Previous Region', 'ArrowLeft'], ['Next Region', 'ArrowRight'], ['Add Previous Region', '⇧ArrowLeft'], ['Add Next Region', '⇧ArrowRight'], ['First Region', '⇧Home'], ['Last Region', '⇧End'], '-',
      ['Previous Track', 'ArrowUp'], ['Next Track', 'ArrowDown']] }],
    '-',
    ['Split at Playhead', '⌘KeyT'], ['Split at Cycle Ends', '⌥⌘KeyT'], ['Join', 'KeyJ'], ['Repeat', '⌘KeyR'],
    '-',
    ['Cut Section Between Locators', '⌃⌘KeyX'], ['Insert Silence at Locators', '⌃⌘KeyZ'], ['Insert Section at Playhead', '⌃⌘KeyV'], ['Repeat Section Between Locators', '⌃⌘KeyR'],
  ]],
  ['Region', [
    ['Mute', 'KeyN'], ['Rename…', '⇧Enter'],
    '-',
    ['Move to Playhead', 'Semicolon'], ['Move to Playhead and Select Next', '⇧Semicolon'], ['Loop to the Next Region', 'KeyL'],
    ['Trim Start to Playhead', 'BracketLeft'], ['Trim End to Playhead', 'BracketRight'], ['Shuffle Left', '⌥BracketLeft'], ['Shuffle Right', '⌥BracketRight'],
    '-',
    ['Gain', null, { sub: [['Up 1 dB', '⌃⇧ArrowUp'], ['Down 1 dB', '⌃⇧ArrowDown'], ['Up 0.1 dB', '⌃⌥⇧ArrowUp'], ['Down 0.1 dB', '⌃⌥⇧ArrowDown'], '-', ['Back to 0 dB']] }],
    ['Transpose', null, { sub: [['Up a Semitone', '⌥ArrowUp'], ['Down a Semitone', '⌥ArrowDown'], ['Up an Octave', '⌥⇧ArrowUp'], ['Down an Octave', '⌥⇧ArrowDown'], '-', ['Fine Tune Up 10 Cents'], ['Fine Tune Down 10 Cents'], '-', ['Back to the Original Pitch']] }],
    ['Reverse', '⌃⇧KeyR'],
    ['Fades', null, { sub: [['Fades for Selection', 'KeyF'], ['Fade In up to the Playhead', 'KeyD'], ['Fade Out from the Playhead', 'KeyG']] }],
    ['Nudge', null, { sub: [['Earlier', '⌥ArrowLeft'], ['Later', '⌥ArrowRight'], ['Shorter', '⌥⇧ArrowLeft'], ['Longer', '⌥⇧ArrowRight']] }],
    '-',
    ['Tempo', null, { sub: [['Follow the Tempo', '⌃KeyF', { check: true }], ['Fit Region to Project Tempo', '⌃⌥KeyF'], ['Set Project Tempo from Region', '⌃⌥KeyT']] }],
    ['Quantize', 'KeyQ'], ['Undo Quantize', '⌥⌘KeyQ'],
    ['Strip Silence', '⌃KeyX'],
    '-',
    ['Group', '⌥⌘KeyG'], ['Ungroup', '⌥⌘KeyU'],
    ['Colour and Outline…'],
  ]],
  ['Track', [
    ['New Tracks…', '⌥⌘KeyN'], ['New Audio Track', '⌥⌘KeyA'], ['New Instrument Track', '⌥⌘KeyS'], ['New Bus', '⌃KeyN'],
    '-',
    ['Duplicate', '⌘KeyD'], ['Duplicate with Its Regions', '⌥⇧⌘KeyD'], ['Rename…', '⇧Enter'], ['Delete', '⌘Backspace'], ['Delete Empty Tracks', '⇧⌘Backspace'],
    '-',
    ['Mute', 'KeyM', { check: true }], ['Solo', 'KeyS', { check: true }], ['Record Enable'], ['Hear the Input', '⌃KeyI', { check: true }],
    '-',
    ['Stack', null, { sub: [['Make a Stack', '⇧⌘KeyD'], ['Take the Stack Apart', '⇧⌘KeyU'], '-', ['Open the Stack', '⌃⌘ArrowRight'], ['Close the Stack', '⌃⌘ArrowLeft']] }],
    ['Group for Editing', '⌃⌘KeyG'], ['Suspend Groups', '⇧KeyG', { check: true }],
    '-',
    ['Instruments', null, { sub: [['Typing Keyboard', '⌘KeyK', { check: true }], ['Capture as Recording', '⇧KeyR'], ['All Notes Off', '⌃⌘Period']] }],
  ]],
  ['Transport', [
    ['Play or Stop', 'Space'], ['Play from Selection', '⇧Space'], ['Record', 'KeyR'], ['Discard Recording', '⌘Period'],
    '-',
    ['Go to Start', 'Enter'], ['Go to End of Sound', '⌥Enter'], ['Back a Bar', 'Comma'], ['Forward a Bar', 'Period'], ['Back Eight Bars', '⇧Comma'], ['Forward Eight Bars', '⇧Period'],
    ['Previous Transient', '⌥Tab'], ['Next Transient', 'Tab'], ['Go to Bar…', 'Slash', { note: 'the command line, with the bar typed' }],
    '-',
    ['Cycle', 'KeyC', { check: true }],
    ['Cycle Area', null, { sub: [['Set to Selection', 'KeyU'], ['Go to Its Start', '⌃⇧Comma'], ['Go to Its End', '⌃⇧Period'], '-', ['Move Forward by Its Length', '⇧⌘Period'], ['Move Back by Its Length', '⇧⌘Comma'], ['Twice as Long', '⌥⇧⌘Period'], ['Half as Long', '⌥⇧⌘Comma'], '-', ['Zoom to the Cycle', '⌃⇧KeyZ']] }],
    '-',
    ['Click', 'KeyK', { check: true }], ['Count-In', '⇧KeyK', { check: true }],
  ]],
  ['Markers', [
    ['Add Marker Here', '⌥Quote'], ['Add Marker for Selection', '⌥⇧Quote'], ['Rename Marker…', '⇧Quote'], ['Delete Marker Here', '⌥Backspace'],
    '-',
    ['Previous Marker', '⌥Comma'], ['Next Marker', '⌥Period'], ['Cycle the Marker', '⌃⌥KeyC'],
    ['Go to Marker', null, { sub: [1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => [`Marker ${k}`, 'Numpad' + k]) }],
  ]],
  ['Tools', [
    ['Tool', null, { sub: [['Pointer'], ['Smart'], ['Pencil'], ['Eraser'], ['Scissors'], ['Join'], ['Mute'], ['Gain'], ['Fade'], ['Marquee'], ['Flex'], ['Zoom'], ['Velocity'], '-', ['Tool Menu', 'KeyT']].map(l => typeof l === 'string' || l[1] ? l : [l[0], null, { check: true }]) }],
    ['Edit Mode', null, { sub: [['Smart', null, { check: true }], ['Grid', 'F4', { check: true }], ['Slip', 'F2', { check: true }], ['Shuffle', 'F1', { check: true }], ['Spot', 'F3', { check: true }], '-', ['Slip, and Back', '⌘KeyG']] }],
    ['Grid', null, { sub: ['1/1', '1/2', '1/4', '1/8', '1/16', '1/32', '-', '1/3', '1/6', '1/12', '1/24'].map(g => g === '-' ? g : [g, null, { check: true }]) }],
    ['Nudge Value', null, { sub: [['Bar', '⌥⇧KeyM'], ['Beat', '⌥⇧KeyB'], ['1/16', '⌥⇧KeyS'], ['10 Ticks', '⌥⇧KeyT'], ['Tick', '⌥⇧KeyQ'], ['10 ms', '⌃⌥Digit0'], ['1 ms', '⌃⌥Digit1'], ['Sample', '⌃⌥KeyS']].map(([t, k]) => [t, k, { check: true }]) }],
    ['Quantize Value', null, { sub: ['1/4', '1/8', '1/8 Triplet', '1/16', '1/16 Triplet', '1/32'].map(q => [q, null, { check: true }]) }],
  ]],
  ['View', [
    ['Patch', 'KeyB', { check: true }], ['Mixer', 'KeyX', { check: true }], ['Notes', 'KeyP', { check: true }], ['Prompt', null, { check: true }], ['Slur', 'KeyO', { check: true }],
    '-',
    ['Automation', 'KeyA', { check: true }], ['Next Automation Parameter', '⌘KeyY'], ['Flex', '⌘KeyF', { check: true }],
    '-',
    ['Zoom In', '⌘ArrowRight'], ['Zoom Out', '⌘ArrowLeft'], ['Zoom to Fit or Selection', 'KeyZ'], ['Taller Rows', '⌘ArrowDown'], ['Shorter Rows', '⌘ArrowUp'], ['Taller Waveforms', '⌘Equal'], ['Lower Waveforms', '⌘Minus'],
    '-',
    ['Page Left', 'Home'], ['Page Right', 'End'], ['Page Up', 'PageUp'], ['Page Down', 'PageDown'], ['Show the Playhead', 'Backquote'], ['Show the Selection', '⇧Backquote'],
    '-',
    ['Close Plug-in Windows', 'KeyV'],
    ['Say It', 'Slash', { note: 'the command line' }],
  ]],
  ['Window', [
    ['Minimize', '⌘KeyM', { sys: true }], ['Zoom', null, { sys: true }], '-', ['Enter Full Screen', '⌃⌘KeyF', { sys: true }],
  ]],
  ['Help', [
    ['Search', null, { search: true }],
    ['Slur Studio Help', null, { note: 'the user guide, in the settings’ language' }],
    ['Key Commands', '⇧Slash'],
    ['Say It', 'Slash'],
  ]],
]

/* a key as the room's table names it, the Mac's way: ⌃⌥⇧⌘ then the key */
const KEY_SIGN = { Space: 'Space', Enter: '↩', Backspace: '⌫', Delete: '⌦', Tab: '⇥', Escape: '⎋', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Home: '↖', End: '↘', PageUp: '⇞', PageDown: '⇟', Comma: ',', Period: '.', Semicolon: ';', Quote: '\'', Slash: '/', Backquote: '`', BracketLeft: '[', BracketRight: ']', Equal: '=', Minus: '−' }
function keySign (k) {
  if (!k) return ''
  const mods = (k.match(/^[⌃⌥⇧⌘]*/) || [''])[0], code = k.slice(mods.length)
  const order = ['⌃', '⌥', '⇧', '⌘'].filter(m => mods.includes(m)).join('')
  const key = KEY_SIGN[code] || (/^Key[A-Z]$/.test(code) ? code.slice(3) : /^Digit\d$/.test(code) ? code.slice(5) : /^Numpad\d$/.test(code) ? code.slice(6) : code)
  return order + key
}
if (typeof module !== 'undefined') module.exports = { MENU_BAR, keySign }
