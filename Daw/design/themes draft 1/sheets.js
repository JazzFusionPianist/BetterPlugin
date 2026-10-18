/* ── the settings that hold it: choosing a theme, and the key commands ──
   Drawn as the settings window over the room (the room as it comes, dimmed behind it). */
const SW = { bg: '#151514', side: '#151514', raised: '#22221F', ink: '#ECEAE4', dim: 'rgba(236,234,228,.5)', line: 'rgba(236,234,228,.1)', amber: '#E0A040' }
const swF = FONT
const swT = (x, y, s, o = {}) => tx(x, y, s, Object.assign({ f: swF, z: 10.5, c: SW.ink }, o))
const swKey = (x, y, t, o = {}) => { const z = o.z || 10, w = tw2(t, swF, z, o.w || 400) + (o.pad || 10) * 2; return [rc(x + .5, y + .5, w - 1, (o.h || 20) - 1, { rx: 2, fill: o.on ? SW.ink : 'none', stroke: SW.ink, sa: o.on ? 1 : .3 }) + swT(x + w / 2, y + (o.h || 20) / 2 + z * .36, t, { z, w: o.on ? 500 : 400, c: o.on ? SW.bg : SW.ink, anchor: 'middle', a: o.a || 1 }), w] }
const swCells = (x, y, items, on, z = 10) => { let s = '', cx = x; const ws = items.map(t => tw2(t, swF, z, 500) + 26); const W2 = ws.reduce((a, b) => a + b, 0); s += rc(x + .5, y + .5, W2 - 1, 21, { rx: 2, stroke: SW.ink, sa: .3 }); items.forEach((t, i) => { if (t === on) s += rc(cx, y, ws[i], 22, { fill: SW.ink }); else if (i) s += ln(cx, y + 4, cx, y + 18, SW.ink, 1, .2); s += swT(cx + ws[i] / 2, y + 15, t, { z, w: t === on ? 500 : 400, c: t === on ? SW.bg : SW.ink, anchor: 'middle', a: t === on ? 1 : .75 }); cx += ws[i] }); return [s, W2] }
/* the window: its bar, the parts down its left */
function swWindow (part, body) {
  const X = 170, Y = 76, WW = 1100, WH = 692 + 28
  let s = rc(0, 0, TW, TH, { fill: '#000', fa: .55 })
  s += rc(X - 1, Y - 1, WW + 2, WH + 2, { rx: 11, fill: '#000', fa: .5, more: ' filter="blur(18px)"' })
  s += rc(X, Y, WW, WH, { rx: 10, fill: SW.bg }) + rc(X, Y, WW, 28, { fill: SW.raised, rx: 10 }) + rc(X, Y + 18, WW, 10, { fill: SW.raised }) + ln(X, Y + 28, X + WW, Y + 28, SW.ink, 1, .1)
  s += ci(X + 18, Y + 14, 5.5, { fill: '#FF5F57' }) + ci(X + 37, Y + 14, 5.5, { fill: '#FEBC2E' }) + ci(X + 56, Y + 14, 5.5, { fill: '#28C840' }) + swT(X + WW / 2, Y + 18.5, 'Settings', { f: "-apple-system, 'Helvetica Neue', sans-serif", z: 12, w: 600, anchor: 'middle', a: .9 })
  const parts = ['general', 'display', 'audio', 'recording', 'editing', 'notes', 'key commands', 'plug-ins', 'command line', 'slur', 'hand off', 'storage']
  parts.forEach((p, i) => { const y = Y + 28 + 14 + i * 26, on = p === part; if (on) s += rc(X + 10, y, 144, 22, { rx: 2, fill: SW.ink }); s += swT(X + 22, y + 14.8, p, { w: on ? 500 : 400, c: on ? SW.bg : SW.ink, a: on ? 1 : p === 'key commands' ? .95 : .7 }) + (p === 'key commands' && !on ? ci(X + 150, y + 11, 2.5, { fill: SW.amber }) : '') })
  s += ln(X + 164, Y + 28, X + 164, Y + WH, SW.ink, 1, .1)
  s += gr(body, `translate(${X + 164} ${Y + 28})`)
  return s
}

/* ── choosing a theme: settings > display, with the themes over the qualities ── */
THEMES.picker = () => {
  const PR = 1100 - 164 - 28, here = '../design/themes%20draft%201/'
  let b = swT(28, 34, 'display', { z: 13, w: 500 }) + swT(28 + tw2('display', swF, 13, 500) + 12, 34, 'theme: console, as it comes', { z: 10, a: .45 })
  let kx = PR
  for (const t of ['share as .sst…', 'open .sst…', 'make your own…']) { const [k, w] = swKey(0, 0, t); kx -= w; b += swKey(kx, 20, t)[0]; kx -= 8 }
  b += rc(28, 54, PR - 28, 1, { fill: SW.ink, fa: .1 })
  /* the themes: as it comes, the six, and one of his own */
  const cards = [['as it comes', 'default.png'], ['console', '1%20console%2C%20the%20arrangement.png'], ['cassette', '2%20cassette.png'], ['score', '3%20score.png'], ['bauhaus', '4%20bauhaus.png'], ['deco', '5%20deco.png'], ['phosphor', '6%20phosphor.png']]
  const cw = 104, ch = 65, gap = 10, cy = 74
  cards.forEach(([name, file], i) => {
    const x = 28 + i * (cw + gap), on = name === 'console'
    if (on) b += rc(x - 4, cy - 4, cw + 8, ch + 8, { rx: 4, stroke: SW.ink, sw: 1.5 })
    b += rc(x, cy, cw, ch, { rx: 2, fill: '#222' }) + `<image href="${file === 'default.png' ? '../guide/pics/window.png' : here + file}" x="${x}" y="${cy}" width="${cw}" height="${ch}" preserveAspectRatio="xMidYMid slice"/>` + rc(x + .5, cy + .5, cw - 1, ch - 1, { rx: 2, stroke: SW.ink, sa: .15 })
    b += swT(x, cy + ch + 18, name, { w: on ? 500 : 400, a: on ? 1 : .7 }) + (i ? swT(x + cw, cy + ch + 18, 'built in', { z: 8.5, a: .35, anchor: 'end' }) : '')
  })
  const yx = 28 + 7 * (cw + gap)
  b += rc(yx + .5, cy + .5, 82, ch - 1, { rx: 2, stroke: SW.ink, sa: .3, more: ' stroke-dasharray="3 3"' }) + swT(yx + 41, cy + ch / 2 + 4, '+', { z: 20, a: .5, anchor: 'middle' }) + swT(yx, cy + ch + 18, 'your own', { a: .5 })
  b += rc(28, 190, PR - 28, 1, { fill: SW.ink, fa: .1 })
  /* the parts of a theme: what was there (colours of every part), and what a theme now also holds */
  const tree = [['type', true], ['layout', true, 1], ['transport', true], ['meters', true], ['background', true], ['the window', false], ['the bars and the playhead', false], ['tracks’ heads', false], ['the lanes', false], ['regions', false], ['the families', false], ['meanings', false], ['slur', false]]
  b += rc(28.5, 202.5, 195, 21, { rx: 2, stroke: SW.ink, sa: .22 }) + swT(37, 216.6, 'find a part', { z: 10, a: .36 })
  tree.forEach(([t, isNew, on], i) => { const y = 234 + i * 21; if (on) b += rc(28, y, 196, 20, { rx: 2, fill: SW.ink }); b += swT(40, y + 13.6, t, { z: 10.5, w: on ? 500 : 400, c: on ? SW.bg : SW.ink, a: on ? 1 : isNew ? .9 : .6 }) + (isNew && !on ? swT(214, y + 13.6, 'new', { z: 8, c: SW.amber, anchor: 'end' }) : '') })
  b += rc(240, 196, 1, 470, { fill: SW.ink, fa: .1 })
  /* layout: where everything stands */
  const X0 = 260
  b += swT(X0, 216, 'layout', { z: 12, w: 500 }) + swT(PR, 216, 'where everything stands, and how it is shown', { z: 9.5, a: .4, anchor: 'end' })
  const rows = [
    ['the transport', ['at the top', 'at the foot', 'down the left'], 'at the foot'],
    ['the tracks’ heads', ['at the left', 'at the right'], 'at the left'],
    ['a track’s level', ['a fader', 'a VU meter and a knob', 'a bar of lights', 'a dynamic'], 'a VU meter and a knob'],
    ['the mixer', ['strips', 'a console', 'a rack'], 'a console'],
    ['the markers', ['words', 'tape flags', 'plaques', 'rehearsal marks'], 'tape flags'],
    ['the cycle', ['a band', 'grease pencil', 'repeat barlines'], 'grease pencil'],
    ['the place in the song', ['numbers', 'a counter', 'seven segments', 'huge'], 'a counter'],
    ['the sound', ['filled', 'a line', 'standing', 'blocks of text'], 'filled'],
  ]
  let y = 234
  b += rc(X0, y - 4, PR - X0, 1, { fill: SW.ink, fa: .1 })
  for (const [label, items, on] of rows) { b += swT(X0, y + 15, label, { a: .7 }); b += swCells(PR - swCells(0, 0, items, on, 9.5)[1], y + 1, items, on, 9.5)[0]; y += 32 }
  b += rc(X0, y + 2, PR - X0, 1, { fill: SW.ink, fa: .1 })
  b += swT(X0, y + 24, 'type', { z: 9.5, a: .4 }) + swT(X0, y + 48, 'the face', { a: .7 }) + rc(PR - 208 + .5, y + 34.5, 207, 19, { rx: 2, stroke: SW.ink, sa: .26 }) + swT(PR - 199, y + 48, 'Barlow Condensed, Permanent Marker', { z: 10 })
  b += swT(X0, y + 80, 'its size', { a: .7 }) + rc(PR - 52.5, y + 66.5, 51, 19, { rx: 2, stroke: SW.ink, sa: .26 }) + swT(PR - 44, y + 80, '100', { z: 10 }) + swT(PR - 8, y + 80, '%', { z: 9, a: .4, anchor: 'end' })
  b += swT(X0, 655, 'a theme is kept as a .sst file in Slur Studio / Themes: opened, it changes every part of the room at once', { z: 9.5, a: .45 })
  return swWindow('display', b)
}

/* ── the key commands ── */
const KB_ROWS = [
  [['esc', 'Escape', 1.3], ['F1', 'F1'], ['F2', 'F2'], ['F3', 'F3'], ['F4', 'F4'], ['F5', 'F5'], ['F6', 'F6'], ['F7', 'F7'], ['F8', 'F8'], ['F9', 'F9'], ['F10', 'F10'], ['F11', 'F11'], ['F12', 'F12']],
  [['`', 'Backquote'], ['1', 'Digit1'], ['2', 'Digit2'], ['3', 'Digit3'], ['4', 'Digit4'], ['5', 'Digit5'], ['6', 'Digit6'], ['7', 'Digit7'], ['8', 'Digit8'], ['9', 'Digit9'], ['0', 'Digit0'], ['-', 'Minus'], ['=', 'Equal'], ['delete', 'Backspace', 1.5]],
  [['tab', 'Tab', 1.5], ['Q', 'KeyQ'], ['W', 'KeyW'], ['E', 'KeyE'], ['R', 'KeyR'], ['T', 'KeyT'], ['Y', 'KeyY'], ['U', 'KeyU'], ['I', 'KeyI'], ['O', 'KeyO'], ['P', 'KeyP'], ['[', 'BracketLeft'], [']', 'BracketRight'], ['\\', 'Backslash']],
  [['caps', 'CapsLock', 1.75], ['A', 'KeyA'], ['S', 'KeyS'], ['D', 'KeyD'], ['F', 'KeyF'], ['G', 'KeyG'], ['H', 'KeyH'], ['J', 'KeyJ'], ['K', 'KeyK'], ['L', 'KeyL'], [';', 'Semicolon'], ['\'', 'Quote'], ['return', 'Enter', 1.75]],
  [['shift', 'ShiftLeft', 2.25], ['Z', 'KeyZ'], ['X', 'KeyX'], ['C', 'KeyC'], ['V', 'KeyV'], ['B', 'KeyB'], ['N', 'KeyN'], ['M', 'KeyM'], [',', 'Comma'], ['.', 'Period'], ['/', 'Slash'], ['shift', 'ShiftRight', 2.25]],
  [['fn', 'Fn'], ['⌃', 'ControlLeft'], ['⌥', 'AltLeft'], ['⌘', 'MetaLeft', 1.25], ['', 'Space', 5], ['⌘', 'MetaRight', 1.25], ['⌥', 'AltRight'], ['←', 'ArrowLeft'], ['↑↓', 'ArrowUp'], ['→', 'ArrowRight']],
]
/* the plain keys of the room as it comes, in a word or two, and the family each belongs to */
const KB_SAYS = { Space: ['play, stop', 't'], KeyR: ['record', 't'], KeyK: ['click', 't'], KeyC: ['cycle', 't'], KeyU: ['cycle it', 't'], Enter: ['to start', 't'], Comma: ['bar back', 't'], Period: ['bar on', 't'], Tab: ['transient', 't'],
  KeyN: ['mute region', 'e'], KeyM: ['mute', 'k'], KeyS: ['solo', 'k'], KeyJ: ['join', 'e'], KeyL: ['fill', 'e'], KeyQ: ['quantize', 'e'], KeyF: ['fades', 'e'], KeyD: ['fade in', 'e'], KeyG: ['fade out', 'e'], Semicolon: ['to playhead', 'e'], BracketLeft: ['trim start', 'e'], BracketRight: ['trim end', 'e'], Backspace: ['delete', 'e'],
  KeyB: ['patch', 'v'], KeyX: ['mixer', 'v'], KeyO: ['slur', 'v'], KeyP: ['notes', 'v'], KeyW: ['rubato', 'v'], KeyZ: ['zoom', 'v'], KeyV: ['close plug-ins', 'v'], Backquote: ['find playhead', 'v'], KeyA: ['automation', 'v'],
  KeyT: ['tools', 'o'], F1: ['shuffle', 'o'], F2: ['slip', 'o'], F3: ['spot', 'o'], F4: ['grid', 'o'], Slash: ['say it', 'o'], Escape: ['close', 'o'], ArrowLeft: ['earlier', 'k'], ArrowRight: ['later', 'k'], ArrowUp: ['track', 'k'] }
const KB_FAM = { t: ['#D9534F', 'transport'], e: ['#4F86D9', 'editing'], k: ['#59A86B', 'tracks, choosing'], v: ['#B07FD0', 'views'], o: ['#D9A441', 'tools, the rest'] }

THEMES.keys = () => {
  const PR = 1100 - 164 - 28
  let b = swT(28, 34, 'key commands', { z: 13, w: 500 }) + swT(28 + tw2('key commands', swF, 13, 500) + 12, 34, '226 commands, 172 with a key', { z: 10, a: .45 })
  let kx = PR
  for (const t of ['export .sska…', 'import…', 'save as default']) { const w = swKey(0, 0, t)[1]; kx -= w; b += swKey(kx, 20, t)[0]; kx -= 8 }
  b += rc(28, 54, PR - 28, 1, { fill: SW.ink, fa: .1 })
  b += swT(28, 82, 'keys like', { a: .7 }) + swCells(100, 67, ['slur studio', 'logic pro', 'ableton live', 'cubase', 'pro tools'], 'slur studio')[0]
  b += swT(PR, 82, 'my keys, 2 changes', { z: 10, anchor: 'end' }) + pa(`M${PR - tw2('my keys, 2 changes', swF, 10) - 16} 76l3.5 3.5l3.5 -3.5`, { stroke: SW.ink, sw: 1, sa: .5 })
  /* the keyboard: the plain keys, coloured by what they do */
  const u = 52, kh = 40, ky0 = 106, kx0 = 28
  b += swT(kx0, ky0 + 4, 'with', { z: 9.5, a: .45 }) + swCells(kx0 + 32, ky0 - 11, ['no key', '⇧', '⌥', '⌃', '⌘', '⇧⌘', '⌥⌘'], 'no key', 9.5)[0]
  let fx = PR
  for (const k of Object.keys(KB_FAM).reverse()) { const [c, t] = KB_FAM[k]; const w = tw2(t, swF, 9) + 22; fx -= w; b += rc(fx, ky0 - 5, 8, 8, { rx: 1.5, fill: c, fa: .7 }) + swT(fx + 13, ky0 + 3, t, { z: 9, a: .6 }) }
  let y = ky0 + 22
  KB_ROWS.forEach((row, ri) => {
    let x = kx0
    const h = ri === 0 ? 26 : kh
    for (const [cap, code, wu = 1] of row) {
      const w = u * wu - 4, says = KB_SAYS[code], fam = says ? KB_FAM[says[1]][0] : null, mod = /Shift|Control|Alt|Meta|Fn|Caps/.test(code)
      b += rc(x, y, w, h, { rx: 4, fill: fam || '#2A2A27', fa: fam ? .26 : 1, stroke: fam || SW.ink, sa: fam ? .75 : .12 })
      b += swT(x + 6, y + 13, cap, { z: ri === 0 ? 8.5 : 10, w: 500, a: mod ? .45 : .9 })
      if (says) {
        const room = ri === 0 ? w - 12 - tw2(cap, swF, 8.5, 500) - 5 : w - 10, sx = ri === 0 ? x + 6 + tw2(cap, swF, 8.5, 500) + 5 : x + 6, sy = ri === 0 ? y + 13 : y + h - 7
        let t = says[0], z = 8
        if (tw2(t, swF, z) > room) z = 7
        while (t.length > 3 && tw2(t, swF, z) > room) t = t.slice(0, -2) + '…'
        b += swT(sx, sy, t, { z, a: .85 })
      }
      x += u * wu
    }
    y += h + 4
  })
  /* the commands, in their families; one being given a new key */
  const ly = y + 14
  b += rc(28, ly - 6, PR - 28, 1, { fill: SW.ink, fa: .1 })
  b += rc(28.5, ly + 4.5, 230, 21, { rx: 2, stroke: SW.ink, sa: .22 }) + swT(37, ly + 18.6, 'find a command, or press its key', { z: 10, a: .36 })
  const cols = [
    ['transport', [['play, stop', 'space'], ['record', 'R'], ['click', 'K'], ['to the start', '↩'], ['a bar back, a bar on', ',  .']]],
    ['regions', [['split at the playhead', null], ['join', 'J'], ['mute', 'N'], ['repeat', '⌘R'], ['bounce in place', '⌃B']]],
    ['tracks', [['new track', '⌥⌘N'], ['duplicate', '⌘D'], ['mute, solo', 'M  S'], ['group', '⌘G'], ['rename', '⇧↩']]],
  ]
  const cwid = (PR - 28) / 3
  cols.forEach(([head, rows], ci2) => {
    const x = 28 + ci2 * cwid
    b += swT(x, ly + 50, head, { z: 9.5, a: .4 })
    rows.forEach(([what, key], i) => {
      const yy = ly + 62 + i * 24
      if (!key) { b += rc(x - 6, yy - 2, cwid - 10, 24, { rx: 2, fill: SW.ink, fa: .07 }); b += swT(x, yy + 14, what) + rc(x + cwid - 120.5, yy + .5, 103, 19, { rx: 2, stroke: SW.amber, sw: 1.2 }) + swT(x + cwid - 112, yy + 14, '⌘J', { z: 10, w: 500 }) + rc(x + cwid - 90, yy + 4, 1, 12, { fill: SW.amber }); return }
      b += swT(x, yy + 14, what, { a: .8 }) + swT(x + cwid - 22, yy + 14, key, { z: 10, w: 500, anchor: 'end', more: ' xml:space="preserve"' })
    })
  })
  b += swT(28 + cwid, ly + 196, '⌘J is join’s already: take it from join, or press another', { z: 9.5, c: SW.amber }) + swKey(28 + cwid + 300, ly + 182, 'take it')[0]
  b += swT(28, 655, 'kept as .sska files in Slur Studio / Key Commands; save as default makes them the keys of every new song and of every start', { z: 9.5, a: .45 })
  return swWindow('key commands', b)
}
