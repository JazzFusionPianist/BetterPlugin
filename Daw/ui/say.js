/* ── the command line, past its plain cases ──
   The command line speaks english only, whatever language the room is shown in (his choice, 2026-10-15: one grammar
   to build on; a track's own name is still found as it is written, in any letters).
   What is typed is cut into the words it knows and read as: what is meant
   (this, a track by any word for it, all the voices), a place or a stretch of the song (here, bar 17, the second chorus,
   from here to the end, the cycle), what to do (cut, mute, delete, once more, copy, move, fade, quantize, choose, louder,
   send, stack) and by how much. One word it does not know and the line is not for here: Claude reads it, where there is
   one. What is read comes out as the same small actions Claude is asked for, so both speak one language, and each is
   carried out by the room's own hands (act, timeAct, edit): a command does what its key does, and counts as one step. */
const SAY = { ask: null, vocab: null, sig: '' }
/* a family of tracks, and the words for it; words that mean the same thing (the first is the one a name is read as) */
const SAY_FAM = { drums: ['drums', 'drum'], bass: ['bass'], vox: ['vox', 'vocals', 'vocal', 'voices', 'voice'], gtr: ['gtr', 'guitars', 'guitar'], keys: ['keys', 'keyboards', 'keyboard'], fx: ['fx', 'effects'], bus: ['bus', 'buses', 'busses', 'aux'] }
const SAY_SAME = [['kick', 'bd'], ['snare'], ['hat', 'hats', 'hihat', 'hi-hat'], ['tom', 'toms'], ['overheads', 'overhead', 'oh'], ['room'], ['lead', 'main'], ['backing', 'bgv', 'bv'], ['double', 'dbl'], ['left'], ['right'], ['piano'], ['pad'], ['synth'], ['strings', 'string'], ['organ'], ['rhodes'], ['acoustic'], ['electric'], ['plate'], ['reverb', 'verb'], ['delay', 'echo'], ['slap'], ['perc', 'percussion'], ['clap'], ['sub'], ['adlib', 'adlibs'], ['harmony', 'harm'], ['choir'], ['stack']]
/* the parts of a song, and the words for them: a marker is found by its own name, or by one of these */
const SAY_SECT = { intro: ['intro'], verse: ['verse'], pre: ['pre', 'pre-chorus', 'prechorus', 'pre chorus'], chorus: ['chorus', 'hook'], bridge: ['bridge'], out: ['out', 'outro', 'ending'], break: ['break'], interlude: ['interlude'], drop: ['drop'] }
const SAY_FIXED = [
  [{ k: 'sel' }, ['this', 'selected', 'these', 'those', 'it', 'them', 'selection', 'the selection']],      // (a list's first word that fits what is typed is the one offered: hint.js)
  [{ k: 'all' }, ['all', 'every', 'everything', 'both', 'all of', 'all the']],
  [{ k: 'here' }, ['here', 'now', 'the playhead', 'playhead']],
  [{ k: 'start' }, ['the start', 'the beginning', 'the top', 'start', 'beginning']],
  [{ k: 'end' }, ['the end', 'end']],
  [{ k: 'cycle' }, ['the cycle', 'cycle', 'locators']],
  [{ k: 'ord', v: 1 }, ['first', '1st']], [{ k: 'ord', v: 2 }, ['second', '2nd']], [{ k: 'ord', v: 3 }, ['third', '3rd']], [{ k: 'ord', v: 4 }, ['fourth', '4th']],
  [{ k: 'ord', v: 'last' }, ['last']], [{ k: 'ord', v: 'next' }, ['next']], [{ k: 'ord', v: 'prev' }, ['previous', 'prev']],
  [{ k: 'role', v: 'from' }, ['from', 'since']],
  [{ k: 'role', v: 'to' }, ['to', 'until', 'till']], [{ k: 'role', v: 'thru' }, ['through', 'thru']],
  [{ k: 'role', v: 'at' }, ['at', 'into', 'onto', 'in', 'on']],
  [{ k: 'and' }, ['and', '&']],
  [{ k: 'then' }, ['then', 'and then']],
  [{ k: 'fill' }, ['the', 'a', 'an', 'of', 'for', 'my', 'please', 'pls']], [{ k: 'tword' }, ['tracks', 'track', 'channels', 'channel']],
  [{ k: 'unit', v: 'db' }, ['db', 'decibels']], [{ k: 'unit', v: 'bar' }, ['bars', 'bar']], [{ k: 'unit', v: 'beat' }, ['beats', 'beat']],
  [{ k: 'unit', v: 'times' }, ['times', 'time']],
  [{ k: 'num', v: 2, unit: 'times' }, ['twice']], [{ k: 'num', v: 3, unit: 'times' }, ['three times']],
  [{ k: 'mod', v: 'half' }, ['in half', 'in halves', 'half']],
  [{ k: 'mod', v: 'up' }, ['up', 'louder', 'raise']], [{ k: 'mod', v: 'down' }, ['down', 'quieter', 'lower']],
  [{ k: 'verb', v: 'cut' }, ['cut', 'split', 'slice', 'chop']],
  [{ k: 'verb', v: 'unmute' }, ['unmute']], [{ k: 'verb', v: 'mute' }, ['mute']],
  [{ k: 'verb', v: 'unsolo' }, ['unsolo']], [{ k: 'verb', v: 'solo' }, ['solo']],
  [{ k: 'verb', v: 'delete' }, ['delete', 'remove', 'erase', 'clear']],
  [{ k: 'verb', v: 'again' }, ['once more', 'one more time', 'again', 'repeat']], [{ k: 'verb', v: 'duplicate' }, ['duplicate']],      // (duplicate: a track named is made twice; regions are said once more)
  [{ k: 'verb', v: 'copy' }, ['copy']], [{ k: 'verb', v: 'move' }, ['move']],
  [{ k: 'verb', v: 'fadein' }, ['fade in', 'fadein']], [{ k: 'verb', v: 'fadeout' }, ['fade out', 'fadeout']],
  [{ k: 'verb', v: 'quantize' }, ['quantize', 'quantise']], [{ k: 'verb', v: 'select' }, ['select', 'choose', 'pick']],
  [{ k: 'verb', v: 'send' }, ['send']], [{ k: 'verb', v: 'group' }, ['group', 'bus together', 'put together']],
  [{ k: 'verb', v: 'goto' }, ['go to', 'goto', 'jump to']], [{ k: 'verb', v: 'loop' }, ['loop']],
  /* a value of a track, and how it goes: what (volume, pan, a print), a control of a plug-in or a macro by its name, a
     value by, to, from one to another, how a ramp bends, and which of many (after, before, except) */
  [{ k: 'verb', v: 'set' }, ['set']], [{ k: 'verb', v: 'ramp' }, ['ramp', 'sweep', 'automate']],
  [{ k: 'verb', v: 'transpose' }, ['transpose', 'pitch shift', 'pitch']],
  [{ k: 'verb', v: 'fadein' }, ['fade-in']], [{ k: 'verb', v: 'fadeout' }, ['fade-out']],
  [{ k: 'what', v: 'vol' }, ['volume', 'vol', 'level', 'fader']], [{ k: 'what', v: 'pan' }, ['pan', 'panning']],
  [{ k: 'what', v: 'tape' }, ['tape']], [{ k: 'what', v: 'space' }, ['space']], [{ k: 'what', v: 'mix' }, ['mix']],
  [{ k: 'macroword' }, ['macro', 'macros']],
  [{ k: 'side', v: -1, hard: 1 }, ['hard left']], [{ k: 'side', v: 1, hard: 1 }, ['hard right']],
  [{ k: 'side', v: -1 }, ['l']], [{ k: 'side', v: 1 }, ['r']], [{ k: 'side', v: 0 }, ['c', 'center', 'centre', 'middle']],
  [{ k: 'shape', v: 'lin' }, ['gradually', 'linearly', 'linear', 'evenly', 'steadily', 'straight']], [{ k: 'shape', v: 'pow' }, ['equal power', 'equal-power']],
  [{ k: 'shape', v: 'exp' }, ['exponentially', 'exponential']], [{ k: 'shape', v: 'log' }, ['logarithmically', 'logarithmic']],
  [{ k: 'shape', v: 's' }, ['s-curve', 's curve', 'smoothly']],
  [{ k: 'opt', v: 'back' }, ['and back', 'then back', 'and come back', 'and back again']], [{ k: 'opt', v: 'keep' }, ['and keep it', 'and stay', 'and hold it']],
  [{ k: 'role', v: 'by' }, ['by']], [{ k: 'role', v: 'in' }, ['over', 'during', 'across', 'throughout']],
  [{ k: 'role', v: 'after' }, ['after', 'past', 'later than']], [{ k: 'role', v: 'before' }, ['before', 'earlier than']],
  [{ k: 'except' }, ['except', 'but not', 'apart from', 'other than']],
  [{ k: 'fill' }, ['add', 'give', 'with', 'some']],
  [{ k: 'unit', v: 'ms' }, ['ms', 'milliseconds', 'millisecond', 'msec']], [{ k: 'unit', v: 's' }, ['seconds', 'second', 'secs', 'sec', 's']],
  [{ k: 'unit', v: 'pct' }, ['%', 'percent', 'pct']], [{ k: 'unit', v: 'khz' }, ['khz']], [{ k: 'unit', v: 'hz' }, ['hz', 'hertz']],
  [{ k: 'unit', v: 'st' }, ['semitones', 'semitone', 'semis']],
  /* regions and notes, as the hand edits them: what is done to them, and which of them */
  [{ k: 'verb', v: 'join' }, ['join', 'glue', 'merge']], [{ k: 'verb', v: 'reverse' }, ['reverse']],
  [{ k: 'verb', v: 'trimstart' }, ['trim the start of', 'trim the start', 'trim start of', 'trim start', 'trim the beginning of', 'trim the beginning']],
  [{ k: 'verb', v: 'trimend' }, ['trim the end of', 'trim the end', 'trim end of', 'trim end']], [{ k: 'verb', v: 'trim' }, ['trim']],
  [{ k: 'verb', v: 'nudge' }, ['nudge', 'shift']], [{ k: 'verb', v: 'ungroup' }, ['ungroup']], [{ k: 'verb', v: 'rename' }, ['rename', 'call']],
  [{ k: 'verb', v: 'strip' }, ['strip silence', 'strip the silence', 'strip']], [{ k: 'verb', v: 'bounce' }, ['bounce in place', 'bounce']],
  [{ k: 'verb', v: 'follow' }, ['follow the tempo', 'follow tempo']], [{ k: 'verb', v: 'fit' }, ['fit to the tempo', 'fit to tempo', 'fit']],
  [{ k: 'verb', v: 'dequantize' }, ['dequantize', 'unquantize', 'as played']], [{ k: 'verb', v: 'legato' }, ['force legato', 'legato']],
  [{ k: 'mod', v: 'earlier' }, ['earlier']], [{ k: 'mod', v: 'later' }, ['later']], [{ k: 'mod', v: 'longer' }, ['longer']], [{ k: 'mod', v: 'shorter' }, ['shorter']],
  [{ k: 'rfilt', v: 'muted' }, ['muted']], [{ k: 'rfilt', v: 'open' }, ['unmuted']], [{ k: 'rfilt', v: 'long' }, ['longer than']], [{ k: 'rfilt', v: 'short' }, ['shorter than']], [{ k: 'rfilt', v: 'named' }, ['named', 'called']],
  [{ k: 'rword' }, ['regions', 'region', 'clips', 'clip']], [{ k: 'notes' }, ['notes', 'note']],
  [{ k: 'what', v: 'gain' }, ['clip gain', 'region gain', 'gain']], [{ k: 'what', v: 'velocity' }, ['velocities', 'velocity', 'vel']], [{ k: 'what', v: 'length' }, ['lengths', 'length']],
  [{ k: 'qopt', v: 'strength' }, ['strength']], [{ k: 'qopt', v: 'swing' }, ['swing']],
  [{ k: 'role', v: 'above' }, ['above', 'higher than', 'more than']], [{ k: 'role', v: 'below' }, ['below', 'under', 'lower than', 'less than']],
  [{ k: 'unit', v: 'tick' }, ['ticks', 'tick']], [{ k: 'unit', v: 'sample' }, ['samples', 'sample']],
  [{ k: 'fill' }, ['make', 'scale', 'in place', 'its', 'their', 'by itself']],
  /* tracks, as the track keys and menus make and order them */
  [{ k: 'verb', v: 'new' }, ['new', 'create']], [{ k: 'tkind', v: 'audio' }, ['audio tracks', 'audio track', 'audio']], [{ k: 'tkind', v: 'midi' }, ['instrument tracks', 'instrument track', 'software instrument track', 'midi tracks', 'midi track', 'instrument']],
  [{ k: 'tfilt', v: 'empty' }, ['empty', 'unused']], [{ k: 'tpos', v: 'top' }, ['to the top', 'at the top', 'first in the list']], [{ k: 'tpos', v: 'bottom' }, ['to the bottom', 'at the bottom', 'last in the list']],
  [{ k: 'verb', v: 'group' }, ['stack']], [{ k: 'verb', v: 'unstack' }, ['unstack', 'take apart', 'take the stack apart']],
  [{ k: 'verb', v: 'arm' }, ['record enable', 'record-enable', 'arm']], [{ k: 'verb', v: 'disarm' }, ['disarm', 'unarm']],
  [{ k: 'verb', v: 'monitor' }, ['hear the input of', 'hear the input', 'monitor']], [{ k: 'verb', v: 'unmonitor' }, ['stop monitoring', 'unmonitor']],
  [{ k: 'verb', v: 'route' }, ['send the output of', 'route']], [{ k: 'verb', v: 'color' }, ['color', 'colour', 'paint']],
  [{ k: 'opt', v: 'edit' }, ['for editing', 'for edits']], [{ k: 'opt', v: 'full' }, ['with its regions', 'with their regions', 'with regions', 'with what is on it', 'with everything']],
  [{ k: 'color', v: 'drums' }, ['blue', 'navy']], [{ k: 'color', v: 'bass' }, ['purple', 'violet', 'magenta']], [{ k: 'color', v: 'keys' }, ['green', 'teal']],
  [{ k: 'color', v: 'gtr' }, ['yellow', 'orange', 'amber', 'gold']], [{ k: 'color', v: 'vox' }, ['red', 'pink', 'coral']], [{ k: 'color', v: 'fx' }, ['grey', 'gray']],
  [{ k: 'color', v: null }, ['as read', 'its own colour', 'its own color', 'automatic']], [{ k: 'shade', v: 1 }, ['dark', 'deep']], [{ k: 'shade', v: 5 }, ['light', 'pale']],
  /* the song's time: its markers, bars put in and taken out, its tempo */
  [{ k: 'mword' }, ['markers', 'marker']], [{ k: 'verb', v: 'insert' }, ['make room for', 'insert']], [{ k: 'verb', v: 'takeout' }, ['take out']],
  [{ k: 'opt', v: 'song' }, ['out of the song', 'from the song', 'of the song']], [{ k: 'what', v: 'tempo' }, ['tempo']], [{ k: 'unit', v: 'bpm' }, ['bpm']],
  /* the project: what is handed off, and how; saved under another name */
  [{ k: 'verb', v: 'export' }, ['export', 'hand off']], [{ k: 'verb', v: 'saveas' }, ['save a copy as', 'save as']],
  [{ k: 'howhat', v: 'mix' }, ['the mix', 'a mix', 'stereo mix', 'mixdown', 'mix down']], [{ k: 'howhat', v: 'stems' }, ['stems', 'stem']],
  [{ k: 'fmt', v: 'wav' }, ['wav', 'wave']], [{ k: 'fmt', v: 'aiff' }, ['aiff', 'aif']], [{ k: 'fmt', v: 'flac' }, ['flac']], [{ k: 'fmt', v: 'm4a' }, ['m4a', 'aac']], [{ k: 'fmt', v: 'mp3' }, ['mp3']],
  [{ k: 'hoprint', v: 'both' }, ['dry and wet', 'both ways']], [{ k: 'hoprint', v: 'dry' }, ['dry']], [{ k: 'hoprint', v: 'with patch' }, ['with the patch', 'with patch', 'wet']],
  [{ k: 'horange', v: 'song' }, ['the whole song', 'whole song']], [{ k: 'unit', v: 'bit' }, ['bits', 'bit', '-bit']], [{ k: 'unit', v: 'kbps' }, ['kbps', 'kbit']], [{ k: 'unit', v: 'k' }, ['k']],
  [{ k: 'fill' }, ['as', 'in']],
  /* the patch: plug-ins and prints put on a track, taken off, turned off and on, opened */
  [{ k: 'verb', v: 'put' }, ['put', 'load']], [{ k: 'pword' }, ['prints', 'print']],
  [{ k: 'verb', v: 'bypass' }, ['bypass', 'turn off', 'switch off']], [{ k: 'verb', v: 'unbypass' }, ['unbypass', 'turn on', 'switch on']], [{ k: 'verb', v: 'open' }, ['open', 'show']],
  [{ k: 'opt', v: 'parallel' }, ['in parallel', 'parallel', 'alongside']], [{ k: 'opt', v: 'series' }, ['in series', 'in line']],
]
/* a print said as a track word after a track (kick delay 30, guitar reverb 40): the print, unless it is sent to */
const SAY_PRINT_TRK = { reverb: 'space', delay: 'delay' }
const SAY_MANY = ['drums', 'vocals', 'voices', 'guitars', 'keys', 'keyboards', 'effects', 'buses', 'busses']      // said like this, a family is all of its tracks; said as one (vocal, kick), it is asked which
const sayStem = w => { for (const f in SAY_FAM) if (SAY_FAM[f].includes(w)) return f; for (const g of SAY_SAME) if (g.includes(w)) return g[0]; return w }
const sayWords = name => String(name).toLowerCase().split(/[^a-z0-9가-힣'’-]+/).filter(w => w.length > 1 || /\d/.test(w))      // (a name may be written in hangul: it is still a name)
/* what a track answers to: its name whole, each word of it, and its family */
function sayKeys (t) { const ks = new Set(sayWords(t.name).map(sayStem)); if (typeof ALIAS !== 'undefined') for (const a of ALIAS[t.name] || []) ks.add(sayStem(a)); const fam = t.kind === 'bus' ? 'bus' : t.kind === 'stack' ? 'stack' : famByName(t.name) || t.tone || null; if (fam) ks.add(fam); return ks }
/* a marker's name as it is asked for: the part of the song it is, without the number it may carry */
function saySect (name) { const s = String(name).toLowerCase().replace(/\s*\d+$/, '').trim(); for (const k in SAY_SECT) if (SAY_SECT[k].includes(s)) return k; return s }
/* every word the line may hold, longest first: the tracks' and the markers' names are read off the song as it is now */
function sayVocab () {
  const sig = (SAY.plugins ? SAY.plugins.length : 0) + '/' + S.tracks.map(t => t.id + t.name + '/' + (t.inserts || []).map(x => x.name + ((x.pl || []).length)).join(',') + '/' + (t.macros || []).map(m => m.name).join(',')).join('|') + '#' + SCENES.map(s => s.name).join('|')
  if (SAY.vocab && SAY.sig === sig) return SAY.vocab
  const V = new Map(), put = (w, tok) => { w = String(w).toLowerCase().trim(); if (w && !V.has(w)) V.set(w, tok) }
  for (const [tok, ws] of SAY_FIXED) for (const w of ws) put(w, tok)
  for (const sc of SCENES) { const st = saySect(sc.name); if (st) put(st, { k: 'sect', v: st }); put(sc.name, { k: 'sect', v: st, n: +(String(sc.name).match(/(\d+)$/) || [])[1] || 0 }) }
  for (const k in SAY_SECT) for (const w of SAY_SECT[k]) put(w, { k: 'sect', v: k })
  for (const t of S.tracks) put(t.name, { k: 'name', id: t.id })
  for (const t of S.tracks) for (const w of sayWords(t.name)) put(w, { k: 'trk', v: sayStem(w) })
  for (const f in SAY_FAM) for (const w of SAY_FAM[f]) put(w, { k: 'trk', v: f, fam: 1, many: SAY_MANY.includes(w) })
  for (const g of SAY_SAME) for (const w of g) put(w, { k: 'trk', v: g[0] })
  for (const t of S.tracks) for (const ins of t.inserts || []) if (!ins.out && ins.name) { for (const w of sayPlugNames(ins)) put(w, { k: 'plug', name: w }); for (const [, nm] of ins.pl || []) put(nm, { k: 'ctlname', name: String(nm).toLowerCase() }) }
  for (const t of S.tracks) for (const m of t.macros || []) put(m.name, { k: 'ctlname', name: String(m.name).toLowerCase() })
  for (const pl of SAY.plugins || []) for (const w of sayPlugNames(pl)) put(w, { k: 'plug', name: w })
  if (typeof WALL_PRINTS !== 'undefined') for (const k of WALL_PRINTS) put(k, { k: 'printname', v: k })      // (a print whose name is another word already — cut, gain, mix — is read as a print with the word print)      // (every plug-in the app has, once a line has asked for them: sayPrime)
  SAY.vocab = [...V.entries()].sort((a, b) => b[0].length - a[0].length); SAY.sig = sig
  return SAY.vocab
}
/* a plug-in's names as they may be said: whole, and without its maker's word before it (fabfilter pro-q 3, pro-q 3) */
const sayPlugNames = ins => { const n = String(ins.name).toLowerCase().replace(/_/g, ' ').trim(), w = n.split(' '); return w.length > 2 ? [n, w.slice(1).join(' ')] : [n] }
/* the line cut into words. A word counts only on its own (a unit may stand right after its number: 3db); a name
   written in other letters is found wherever it stands; kick's is kick */
function sayLex (s) {
  s = s.replace(/([a-z0-9])['’]s(?![a-z])/g, '$1  ')
  const V = sayVocab(), out = [], isA = c => /[a-z0-9]/.test(c || '')
  let i = 0, glued = false
  while (i < s.length) {
    const c = s[i]
    if (c === ' ') { i++; glued = false; continue }
    if (c === ',' ) { out.push({ k: 'and', raw: c, at: i }); i++; glued = false; continue }
    if (/[.!?]/.test(c) && !/\d/.test(s[i + 1] || '')) { i++; continue }
    const last = out[out.length - 1]
    if ((c === '~' || (c === '-' && last && last.k === 'num' && /\d/.test(s[i + 1] || '') && glued)) && last) { out.push({ k: 'role', v: 'to', at: i }); i++; continue }
    let m = /^1\/(4|8|16|32)(?![\d])/.exec(s.slice(i))
    if (m && !isA(s[i - 1])) { out.push({ k: 'grid', v: 1 / +m[1], at: i, raw: m[0] }); i += m[0].length; glued = true; continue }
    m = /^["“'‘]([^"”'’]{1,60})["”'’]/.exec(s.slice(i))                                      // a name in quotes: as it was typed, capitals and all
    if (m) { const q = SAY.quotes && SAY.quotes.shift(); out.push({ k: 'str', v: (q || m[1]).trim(), raw: m[0], at: i }); i += m[0].length; glued = false; continue }
    m = /^([a-g])(#|b)?(-?\d)(?![\d.])/.exec(s.slice(i))                                       // a key: c3 is middle c (key 60), as the notes page says it
    if (m && !isA(s[i - 1]) && !isA(s[i + m[0].length])) { out.push({ k: 'pitch', v: (+m[3] + 2) * 12 + ((NOTE_NAMES.indexOf(m[1]) + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12), raw: m[0], at: i }); i += m[0].length; glued = true; continue }
    const named = /\d/.test(c) && !isA(s[i - 1]) ? V.find(([w, tok]) => tok.k === 'name' && s.startsWith(w, i) && !isA(s[i + w.length])) : null      // (a track's whole name before a number: a track may be called 808)
    if (named) { out.push(Object.assign({ raw: named[0], at: i, end: i + named[0].length }, named[1])); i += named[0].length; glued = true; continue }
    m = /^[+-]?\d+(?:\.\d+)?/.exec(s.slice(i))
    if (m && !isA(s[i - 1]) && (/\d/.test(c) || !glued)) { out.push({ k: 'num', v: +m[0], signed: /^[+-]/.test(m[0]), raw: m[0], at: i }); i += m[0].length; glued = true; continue }
    if (c === '-' || c === '+') { i++; continue }
    const hit = V.find(([w, tok]) => s.startsWith(w, i) && (!/^[\x00-\x7f]+$/.test(w) || (!(tok.k === 'unit' ? /[a-z]/ : /[a-z0-9]/).test(s[i - 1] || '') && !isA(s[i + w.length]))))
    if (!hit) { const e = s.indexOf(' ', i); out.push({ k: 'raw', raw: s.slice(i, e < 0 ? s.length : e), at: i }); i = e < 0 ? s.length : e; glued = false; continue }
    out.push(Object.assign({ raw: hit[0], at: i, end: i + hit[0].length }, hit[1]))
    i += hit[0].length; glued = true
  }
  return out
}
/* ── what is meant ── */
/* the tracks a few words stand for: every word must be one the track answers to */
function sayTracks (words) { return S.tracks.filter(t => { const ks = sayKeys(t); return words.every(w => ks.has(w)) }) }
/* a part of the song by its name; several of that name are told apart by their order (the second chorus, chorus 2,
   the last one, the next one) — and with nothing said, the one the playhead is in, or else comes to next */
function sayScene (stem, ord, own) {
  const all = SCENES.filter(sc => saySect(sc.name) === stem)
  if (!all.length) return null
  if (own) { const ex = all.find(sc => +(String(sc.name).match(/(\d+)$/) || [])[1] === own); if (ex) return ex }
  const p = curPos() + 1, cur = all.findIndex(sc => p >= sc.a - 1e-6 && p < sc.b - 1e-6), nxt = all.findIndex(sc => sc.a > p + 1e-6)
  if (ord === 'last') return all[all.length - 1]
  if (ord === 'next') return all[nxt < 0 ? all.length - 1 : nxt]
  if (ord === 'prev') { const before = all.filter(sc => sc.b <= p + 1e-6); return before[before.length - 1] || all[0] }
  if (typeof ord === 'number') return all[ord - 1] || null
  return all[cur >= 0 ? cur : nxt >= 0 ? nxt : 0]
}
const sayBar = v => { const b = Math.floor(v + 1e-9), beat = Math.round((v - b) * 10); return clamp(b - 1 + (clamp(beat || 1, 1, BEATS()) - 1) / BEATS(), 0, SONG_END) }
const SAY_FAM_NAME = { drums: 'drums', bass: 'bass', vox: 'vocals', gtr: 'guitars', keys: 'keys', fx: 'effects' }
const sayList = ts => ts.length <= 3 ? ts.map(t => t.name).join(', ') : `${ts.length} tracks`
/* ── a value of a track ──
   Its level, its pan, a print, a control of a plug-in or a macro (by their names): set, raised or lowered — the value
   itself, or for a stretch and back, or from a bar on — or ramped over a stretch and left there (bent as it is said:
   exponentially, logarithmically, s-curve), or swept from one value to another. Written by the same hand as the cells
   (hint.js: autoWrite). Null: the clause is about something else. */
const SAY_UNIT = { vol: 'db', send: 'db' }
function sayValue (c) {
  const { items, verbs, mods, amts, who, span, after, before, s } = c
  const what = items.find(x => x.t === 'what'), ctl = items.find(x => x.t === 'ctl'), shapeIt = items.find(x => x.t === 'shape'), side = items.find(x => x.t === 'side'), opts = items.filter(x => x.t === 'opt').map(x => x.v)
  const vv = verbs.filter(v => v === 'set' || v === 'ramp'), other = verbs.some(v => v !== 'set' && v !== 'ramp')
  const toA = amts.find(x => x.role === 'to'), fromA = amts.find(x => x.role === 'from'), byA = amts.find(x => x.role === 'by') || amts.find(x => !x.role && !['times', 'bar', 'beat'].includes(x.unit))
  const named = who && who.tracks && who.tracks.length, moved = mods.includes('up') || mods.includes('down') || amts.some(x => x.signed)
  if (what && ['gain', 'velocity', 'length', 'tempo'].includes(what.key)) return null                         // (a region's gain, a note's velocity and length: sayEdit)
  if (items.some(x => x.t === 'notes' || x.t === 'rword')) return null
  if (other || !(what || ctl || shapeIt || side || vv.length || (named && (span || after != null) && moved) || (named && toA))) return null
  /* where: the stretch said, or from a bar on, or up to one */
  let a = null, b = null
  if (span) { a = span[0] + 1; b = span[1] + 1 } else if (after != null) a = after + 1; else if (before != null) { a = 1; b = before + 1 }
  const ramp = !!(shapeIt || vv.includes('ramp') || (fromA && toA)), shape = shapeIt && shapeIt.v !== 'lin' ? shapeIt.v : null
  if (ramp && (a == null || b == null)) return { say: 'over which bars' }
  /* how much: by it (lower, raise), to it, or from one to the other */
  let much = null, sign = 0, from = null, unit = null
  if (fromA && toA) { from = fromA.n; much = toA.n; unit = toA.unit || fromA.unit }
  else if (toA) { much = toA.n; unit = toA.unit }
  else if (byA) {
    unit = byA.unit
    if (mods.includes('down') || mods.includes('up')) { sign = mods.includes('down') ? -1 : 1; much = Math.abs(byA.n) }
    else if (byA.signed || byA.role === 'by') { sign = byA.n < 0 ? -1 : 1; much = Math.abs(byA.n) }
    else much = byA.n
  }
  if (side) {                                                                                         // pan: left, right, center, hard left; or moved left by so much
    if (byA && byA.role === 'by') { sign = side.v || 1; much = Math.abs(byA.n) } else { sign = 0; much = side.v * (side.hard || !byA ? 100 : Math.min(100, Math.abs(byA.n))) }
    unit = null
  }
  if (much == null) return { ask: moved || mods.length || ramp ? { q: 'by how much', append: ' by ', s } : { q: 'to what', append: ' to ', s } }
  if (unit === 'khz') { much *= 1000; if (from != null) from *= 1000; unit = 'hz' }
  /* whose, and which of their values */
  let ts = named ? who.tracks.map(n => S.tracks.find(t => t.name === n)).filter(Boolean) : who && who.all ? S.tracks.filter(t => t.kind === 'audio' && !(who.not || []).includes(t.name)) : who && who.sel ? chosen() : null
  const targets = []
  if (ctl) {
    for (const t of ts || S.tracks) {
      if (ctl.mac || !ctl.plug) for (const m of t.macros || []) if ((!ctl.ctl || String(m.name).toLowerCase() === ctl.ctl) && (!ctl.plug || (m.to && String(m.to.plug || '').toLowerCase().includes(ctl.plug)))) targets.push({ t, k: 'mac' + m.id, to: m.to })
      if (!ctl.mac && ctl.ctl) for (const ins of t.inserts || []) {
        if (ins.out || (ctl.plug && !sayPlugNames(ins).includes(ctl.plug))) continue
        const row = (ins.pl || []).find(r => String(r[1]).toLowerCase() === ctl.ctl)
        if (!row || targets.some(g => g.t === t && g.to && g.to.n === ins.n && g.to.i === row[0])) continue      // (a macro and the control it turns are one: the macro is taken)
        ins.n = ins.n || 1 + Math.max(0, ...t.inserts.map(q => q.n || 0))
        ins.pn = ins.pn || {}; ins.pv = ins.pv || {}; ins.pn[row[0]] = String(row[1]).toLowerCase(); if (ins.pv[row[0]] == null) ins.pv[row[0]] = clamp(+row[2] || 0, 0, 1)      // (named and read as the cells do when a control is taken)
        targets.push({ t, k: `fx${ins.n}.${row[0]}` })
      }
    }
    if (!targets.length) return { say: ctl.mac ? `no macro called ${ctl.ctl || ''}`.trim() : !ctl.ctl ? `which control of ${ctl.plug}` : `no control called ${ctl.ctl}` }
    if (targets.length > 1 && !ts) return { say: `which track's ${ctl.ctl || 'macro'}: ${sayList(targets.map(g => g.t))}` }
  } else {
    if (!ts || !ts.length) return { say: who && who.sel ? 'choose a track first' : 'which track' }
    for (const t of ts) targets.push({ t, k: what ? what.key : side ? 'pan' : 'vol' })
  }
  const acts = []
  for (const { t, k } of targets) {
    const own = SAY_UNIT[/^send/.test(k) ? 'send' : k] || ''
    if (!ctlKey(k) && unit && unit !== own && !(unit === 'pct' && !own)) return { say: `${autoName(t, k)} is said in ${own || 'plain numbers'}` }
    const m = k === 'pan' && !side ? .64 : 1, M = k === 'pan' ? .64 : 1                                     // (pan is said as 0 to 100 each way: the line counts to 64)
    const amt = side ? much * M : much * m, fr = from == null ? null : from * m
    if (a == null) {                                                                                   // no stretch: the value itself, as the room's own acts say it where they can
      if (k === 'vol') { acts.push(sign ? { do: 'volume', track: t.name, db: sign * amt, mode: 'relative' } : { do: 'volume', track: t.name, db: amt, mode: 'absolute' }); continue }
      if (k === 'pan' && !sign) { acts.push({ do: 'pan', track: t.name, value: clamp(amt / 64, -1, 1) }); continue }
      if (['tape', 'space', 'delay', 'mix'].includes(k) && !sign) { acts.push({ do: 'patch', track: t.name, print: k, value: amt }); continue }
    }
    if (k === 'mix') return { say: 'the mix of a patch is only set' }
    acts.push({ do: 'line', track: t.name, key: k, unit, spec: { a, b, much: amt, sign, from: fr, ramp, shape, back: opts.includes('back') } })
  }
  if (acts.length > 1 && acts.every(x => x.do === 'volume' && x.mode === 'relative')) acts.unshift({ do: 'note', text: `${acts.length} tracks ${sign > 0 ? '+' : '−'}${much} db` })
  return { acts, who: c.said ? who : c.who0 }
}
/* the plug-ins whose names a line says have their controls asked for first, so that the line may name one (async: the app answers) */
async function sayPrime (text) {
  const s = String(text).toLowerCase()
  if (NAT && !SAY.plugins && /\b(put|load|insert|add|open|bypass|remove|delete|turn|switch)\b/.test(s)) { const list = await NAT.call('plugins'); SAY.plugins = Array.isArray(list) ? list : []; SAY.vocab = null }      // (the plug-ins the app has, asked for once: their names are words of the line)
  for (const t of S.tracks) for (const ins of t.inserts || []) if (!ins.out && ins.name && !ins.pl && sayPlugNames(ins).some(w => s.includes(w))) await fxParams(t, ins)
  if (/macro/.test(s) || S.tracks.some(t => (t.macros || []).some(m => s.includes(String(m.name).toLowerCase())))) for (const t of S.tracks) for (const m of t.macros || []) { const ins = macroIns(t, m); if (ins && !ins.pl) await fxParams(t, ins) }
}
/* and a control's travel, before its line is written in its own unit */
async function sayReady (acts) {
  /* what the track keys do over time (asking for the input, the plug-ins' states) is done here, waited for, so that the line
     says what came of it and is still one step back */
  for (const a of acts || []) if (a && a.do === 'track' && ['duplicate', 'delete', 'empty', 'arm', 'disarm', 'monitor', 'unmonitor'].includes(a.op)) {
    const ts = (a.ids || []).map(byId).filter(Boolean), n0 = S.tracks.length
    if (a.op === 'duplicate') { for (const t of ts) await duplicateTrack(S.tracks.indexOf(t), !!a.full); a.result = S.tracks.length > n0 ? `${sayList(ts)} duplicated${a.full ? ' with ' + (ts.length > 1 ? 'their' : 'its') + ' regions' : ''}` : 'no room for another track' }
    else if (a.op === 'delete') { await deleteTracks(ts); a.result = S.tracks.length < n0 ? `${sayList(ts)} deleted` : 'not deleted' }
    else if (a.op === 'empty') { await deleteUnused(); a.result = S.tracks.length < n0 ? `${n0 - S.tracks.length} empty track${n0 - S.tracks.length === 1 ? '' : 's'} deleted` : 'no track is empty' }
    else { const key = a.op.endsWith('arm') ? 'arm' : 'mon', on = a.op === 'arm' || a.op === 'monitor'; for (const t of ts) if (!!t[key] !== on) await (key === 'arm' ? toggleArm : toggleMon)(S.tracks.indexOf(t)); const got = ts.filter(t => !!t[key] === on); a.result = got.length === ts.length ? `${sayList(ts)}: ${key === 'arm' ? (on ? 'armed' : 'not armed') : on ? 'input heard' : 'input not heard'}` : `${sayList(ts.filter(t => !got.includes(t)))}: the input could not be opened` }
    SAY.vocab = null
  }
  for (const a of acts || []) if (a && a.do === 'patch2' && a.op === 'add' && a.plug && NAT) {      // a plug-in put on: the app opens it (waited for, and said as it came out)
    const list = SAY.plugins || [], pl = list.find(x => sayPlugNames(x).includes(a.plug))
    if (!pl) { a.result = `no plug-in called ${a.plug}`; continue }
    const got = []
    for (const t of (a.ids || []).map(byId).filter(Boolean)) {
      const r = await natInsert(S.tracks.indexOf(t), pl.id)
      if (!(r && r.ok)) continue
      if (a.parallel) { const w = wallOf(t), ins = t.inserts.find(i => i.uid === r.uid), node = w && w.nodes.find(n => n.ins === ins); if (node) { sayParallel(w, node.id); await wallPush(t) } }
      got.push(t)
    }
    a.result = got.length ? `${pl.name.toLowerCase()} put on${a.parallel ? ' in parallel' : ''}: ${sayList(got)}` : `${pl.name.toLowerCase()} would not open`
  }
  for (const a of acts || []) if (a && a.do === 'project' && a.op === 'saveas' && NAT) { const ok = await saveAs(String(a.name).slice(0, 80), false); a.result = ok ? `saved as ${a.name}` : (S.last && S.last.say) || 'could not save' }
  for (const a of acts || []) if (a && a.do === 'line') { const t = S.tracks.find(x => x.name === a.track); if (t && ctlKey(a.key)) { const [ins, i] = scaleIns(t, a.key); if (ins) await fxScale(t, ins, i) } }
}
/* ── the patch ──
   A plug-in by its name (any the app has: "put pro-q 3 on vocals") or a print by its name and the word print ("add a
   chorus print to keys"): put on a track — at the end of its way, or "in parallel" beside what is there — taken off,
   turned off and on, its window opened. Which track: the one named (on, to, from), else the one chosen. Null: else. */
function sayPatch (c) {
  const { items, verbs, who, toks } = c, v = verbs[0], has = k => items.some(x => x.t === k), opt = o => items.some(x => x.t === 'opt' && x.v === o), done = acts => ({ acts, who: c.said ? who : c.who0 })
  const ctl = items.find(x => x.t === 'ctl'), plug = ctl && ctl.plug && !ctl.ctl && !ctl.mac ? ctl.plug : null
  const print = (items.find(x => x.t === 'printname') || {}).v || (has('pword') ? (toks.map(t => String(t.raw || '').toLowerCase()).find(w => WALL_PRINTS.includes(w)) || null) : null)
  if (!plug && !print) return null
  const ts = who && who.tracks ? who.tracks.map(n => S.tracks.find(t => t.name === n)).filter(Boolean) : who && who.sel ? chosen() : [S.tracks[S.sel]].filter(Boolean)
  if (!ts.length) return { say: 'on which track' }
  const what = plug ? { plug } : { print }, ids = ts.map(t => t.id)
  if (v === 'put' || v === 'insert' || (!v && items.some(x => x.t === 'who' && (x.role === 'to' || x.role === 'at')))) return done([Object.assign({ do: 'patch2', op: 'add', ids, parallel: opt('parallel') }, what)])
  if (v === 'delete') return done([Object.assign({ do: 'patch2', op: 'remove', ids }, what)])
  if (v === 'bypass' || v === 'unbypass') return done([Object.assign({ do: 'patch2', op: v, ids }, what)])
  if (v === 'open' && plug) return done([{ do: 'patch2', op: 'open', ids, plug }])
  return null
}
/* a node of a wall made to stand beside what is there: its way in from in, its way out to out (not after the rest) */
function sayParallel (w, id) {
  for (const e of w.wires) if (e.to === id && e.from !== WALL_IN && !wallCtl(e)) e.to = WALL_OUT
  if (!w.wires.some(e => e.from === WALL_IN && e.to === id)) w.wires.push({ from: WALL_IN, to: id, gain: 1, port: 0 })
  if (!w.wires.some(e => e.from === id && e.to === WALL_OUT)) w.wires.push({ from: id, to: WALL_OUT, gain: 1, port: 0 })
  const seen = new Set(); w.wires = w.wires.filter(e => { const k = `${e.from}>${e.to}>${e.port || 0}>${e.in || 0}>${e.hand || ''}`; if (seen.has(k)) return false; seen.add(k); return true })      // (two wires that became one)
}
const sayInsOf = (t, name) => (t.inserts || []).find(i => !i.out && sayPlugNames(i).includes(name))
const sayNodeOf = (t, k) => { const w = wallOf(t); return w ? w.nodes.find(n => n.k === k) : null }
/* ── the project ──
   A hand-off said in words sets the hand-off panel as it is said and opens it — the mix or stems (of these tracks), the
   format, bits, rate and an mp3's kbps, dry or with the patch, this part, the whole song or the cycle — and the hand-off
   key is still pressed by hand (the Mac asks where it goes). Saved as "…": a copy under that name. Null: something else. */
function sayProject (c) {
  const { items, verbs, amts, who, places } = c, v = verbs[0], get = k => items.find(x => x.t === k), done = acts => ({ acts, who: c.said ? who : c.who0 })
  if (v === 'saveas') { const str = get('str') || (items.find(x => x.t === 'rfilt' && x.v === 'named') ? { v: items.find(x => x.t === 'rfilt' && x.v === 'named').raw } : null); if (!str) return { say: 'save it as what (in quotes)' }; return done([{ do: 'project', op: 'saveas', name: str.v }]) }
  const what = get('howhat'), fmt = get('fmt')
  if (!(v === 'export' || (v === 'bounce' && (what || fmt)))) return null
  const o = {}
  if (what) o.what = what.v
  if (fmt) o.fmt = fmt.v
  const bits = amts.find(x => x.unit === 'bit'); if (bits) { if (!HO_BITS.includes(bits.n)) return { say: `the bits there are: ${HO_BITS.join(' ')}` }; o.bits = bits.n }
  const kb = amts.find(x => x.unit === 'kbps') || (o.fmt === 'mp3' ? amts.find(x => !x.unit && HO_KBPS.includes(x.n)) : null); if (kb) { if (!HO_KBPS.includes(kb.n)) return { say: `an mp3 is ${HO_KBPS.join(', ')} kbps` }; o.kbps = kb.n; o.fmt = o.fmt || 'mp3' }
  const rt = amts.find(x => x.unit === 'khz' || x.unit === 'k' || (x.unit === 'hz' && x.n > 1000)); if (rt) { const hz = Math.round(rt.unit === 'hz' ? rt.n : rt.n * 1000); if (!HO_RATE.includes(hz)) return { say: `the rates there are: ${HO_RATE.map(r => r / 1000).join(' ')} khz` }; o.rate = hz }
  const pr = get('hoprint'); if (pr) o.print = pr.v
  const rg = get('horange'), sc = places.find(p => p.scene != null), cyc = places.find(p => p.name === 'the cycle')
  if (rg) o.range = 'song'; else if (cyc) o.range = 'cycle'; else if (sc) { o.range = 'this scene'; o.scene = sc.scene }
  if (who && who.tracks && who.tracks.length) { o.what = 'stems'; o.only = who.tracks }
  return done([Object.assign({ do: 'project', op: 'handoff' }, o)])
}
/* ── the song's time ──
   Markers made (where it is said, else at the playhead; called "…"), renamed, deleted and moved; bars put in (insert 2 bars
   at 17) and taken out of the song (take out bars 9 to 12); the song's tempo. The tempo and the measure are one for the
   whole song in this version: a change of them partway along is said to be not yet there. Null: something else. */
function sayTime (c) {
  const { items, verbs, amts, places, span, destPos } = c, v = verbs[0], has = k => items.some(x => x.t === k), done = acts => ({ acts, who: c.said ? c.who : c.who0 })
  const str = items.find(x => x.t === 'str') || (items.find(x => x.t === 'rfilt' && x.v === 'named') ? { v: items.find(x => x.t === 'rfilt' && x.v === 'named').raw } : null)
  const what = items.find(x => x.t === 'what')
  if (what && what.key === 'tempo') {
    if (span || c.after != null || places.some(p => p.pos != null && p.role === 'at')) return { say: 'the tempo is one for the whole song in this version' }
    const toA = amts.find(x => x.role === 'to') || amts.find(x => !x.role && !x.signed && !items.some(y => y.t === 'mod')), byA = amts.find(x => x.role === 'by' || x.signed), mods = items.filter(x => x.t === 'mod').map(x => x.v)
    if (toA) return done([{ do: 'tempo', bpm: toA.n }])
    if (byA) return done([{ do: 'tempo', by: mods.includes('down') ? -Math.abs(byA.n) : mods.includes('up') ? Math.abs(byA.n) : byA.n }])
    return { ask: { q: 'to what', append: ' to ', s: c.s } }
  }
  if (has('mword')) {
    const sc = places.find(p => p.scene != null), at = destPos != null ? destPos : places.find(p => p.pos != null && p.scene == null) ? places.find(p => p.pos != null && p.scene == null).pos : null
    const here = () => { const m = typeof markerNow === 'function' ? markerNow() : null; return m ? m.i : null }
    if (v === 'delete') { const i = sc ? sc.scene : here(); if (i == null) return { say: 'which marker' }; return done([{ do: 'time', op: 'delmark', i }]) }
    if (v === 'rename') { const i = sc ? sc.scene : here(); if (i == null) return { say: 'which marker' }; if (!str) return { say: 'rename it to what (in quotes)' }; return done([{ do: 'time', op: 'namemark', i, name: str.v }]) }
    if (v === 'move') { const i = sc ? sc.scene : here(); if (i == null) return { say: 'which marker' }; if (at == null) return { say: 'move it to which bar' }; return done([{ do: 'time', op: 'movemark', i, at }]) }
    if (!v || v === 'new') return done([{ do: 'time', op: 'addmark', at: at != null ? at : null, name: str ? str.v : null }])
    return null
  }
  if (v === 'insert') {
    const len = amts.find(x => x.unit === 'bar' || x.unit === 'beat' || x.unit == null)
    if (!len) return { ask: { q: 'how many bars', append: ' ', s: c.s } }
    const at = destPos != null ? destPos : places.find(p => p.pos != null) ? places.find(p => p.pos != null).pos : null
    return done([{ do: 'time', op: 'room', at, len: len.unit === 'beat' ? len.n / BEATS() : len.n }])
  }
  if (v === 'takeout' || ((v === 'delete' || v === 'cut') && items.some(x => x.t === 'opt' && x.v === 'song'))) {
    if (!span) return { say: 'take out which bars' }
    return done([{ do: 'time', op: 'cut', a: span[0], b: span[1] }])
  }
  return null
}
/* ── tracks, as the track keys and menus make, order, colour and route them ──
   New ones (audio, instrument, bus; so many; called "…"), duplicated (with their regions), deleted (the empty ones), moved
   above or below another or to the top, coloured (blue, purple, green, yellow, red, grey — the room's own pigments —
   dark or light, or as read), stacked and taken apart, grouped for editing, armed, heard at their input, routed to a bus.
   Null: the clause is about something else. */
const SAY_TRACK_VERBS = ['new', 'duplicate', 'unstack', 'arm', 'disarm', 'monitor', 'unmonitor', 'route', 'color']
function sayTrack (c) {
  const { items, verbs, amts, who } = c, v = verbs[0], has = k => items.some(x => x.t === k), get = k => items.find(x => x.t === k), opt = o => items.some(x => x.t === 'opt' && x.v === o)
  const done = acts => ({ acts, who: c.said ? who : c.who0 }), named_ = items.find(x => x.t === 'rfilt' && x.v === 'named'), str = get('str') || (named_ ? { v: named_.raw } : null), plainWho = c.whos.filter(x => !x.role || x.role === 'at' || x.role === 'in')
  const named = () => { const ids = plainWho.flatMap(x => x.ids || []); return ids.length ? ids.map(id => byId(id)).filter(Boolean) : who && who.sel ? chosen() : who && who.all ? S.tracks.filter(t => !(who.not || []).includes(t.name)) : [] }
  /* new tracks: audio, instrument, a bus; so many; called "…" */
  const kind = get('tkind'), busWord = c.whos.some(x => (x.word || []).includes('bus') && !(x.ids || []).length)
  if ((v === 'new' || (!v && kind)) && (kind || busWord || has('tword'))) {
    const n = amts.find(x => !x.unit && Number.isInteger(x.n) && x.n > 0), k = kind ? kind.v : busWord ? 'bus' : 'audio'
    return done([{ do: 'track', op: 'new', kind: k, n: n ? Math.min(n.n, 32) : 1, name: str ? str.v : null }])
  }
  if (v === 'new') return { say: 'a new what: audio track, instrument track or bus' }
  if (v === 'duplicate' && !has('rword') && !(who && who.sel && !has('tword'))) { const ts = named(); if (!ts.length) return null; return done([{ do: 'track', op: 'duplicate', ids: ts.map(t => t.id), full: opt('full') }]) }
  if (v === 'delete' && (has('tword') || has('tfilt'))) {
    if (has('tfilt')) return done([{ do: 'track', op: 'empty' }])
    const ts = named(); if (!ts.length) return { say: 'which track' }; return done([{ do: 'track', op: 'delete', ids: ts.map(t => t.id) }])
  }
  if (v === 'move' && (c.whos.some(x => x.role === 'above' || x.role === 'below') || has('tpos'))) {
    const ts = named(), ref = c.whos.find(x => x.role === 'above' || x.role === 'below'), pos = get('tpos')
    if (!ts.length) return { say: 'move which track' }
    if (ref && (ref.ids || []).length !== 1) return { say: `${ref.role} which track` }
    return done([{ do: 'track', op: 'move', ids: ts.map(t => t.id), ref: ref ? ref.ids[0] : null, below: ref ? ref.role === 'below' : null, pos: pos ? pos.v : null }])
  }
  if (v === 'color') {
    const col = get('color'), shade = get('shade')
    if (!col) return { ask: { q: 'what colour: blue, purple, green, yellow, red, grey', append: ' ', s: c.s } }
    const regions = has('rword') || (who && who.sel && !has('tword') && S.focus !== 'tracks')
    return done([{ do: 'track', op: 'color', ids: regions ? null : named().map(t => t.id), regions, col: col.v ? [col.v, shade ? shade.v : 3] : null, who }])
  }
  if (v === 'unstack') { const ts = named().map(t => t.kind === 'stack' ? t : byId(t.parent)).filter(Boolean); if (!ts.length) return { say: 'no stack there' }; return done([{ do: 'track', op: 'unstack', ids: [...new Set(ts.map(t => t.id))] }]) }
  if (['arm', 'disarm', 'monitor', 'unmonitor'].includes(v)) { const ts = named().filter(t => t.kind === 'audio'); if (!ts.length) return { say: 'which track' }; return done([{ do: 'track', op: v, ids: ts.map(t => t.id) }]) }
  if (v === 'route') {
    const to = c.whos.find(x => x.role === 'to' || x.role === 'at'), from = c.whos.filter(x => x !== to).flatMap(x => x.ids || []), dest = to && (to.ids || []).length === 1 ? byId(to.ids[0]) : null
    if (!dest && !(to && (to.word || []).some(w => w === 'out' || w === 'stereo'))) return { say: 'route it to which bus' }
    if (!from.length) return { say: 'route which track' }
    return done([{ do: 'track', op: 'route', ids: from, to: dest ? dest.id : 0 }])
  }
  if ((v === 'group' || v === 'ungroup') && opt('edit')) { const ts = named(); if (!ts.length) return { say: 'which tracks' }; return done([{ do: 'track', op: v === 'group' ? 'editgroup' : 'editungroup', ids: ts.map(t => t.id) }]) }
  return null
}
/* ── regions and notes, as the hand edits them ──
   Moved or made longer by so much (in bars, beats, sixteenths, ms, ticks, samples: the nudge keys, so many times), trimmed
   to a place, joined, reversed, stripped of silence, bounced in place, made to follow or fit the tempo, quantized back to
   as played, grouped, renamed ("…"); a region's own gain; and notes — which of them by their key (above c3, below c1, c#2)
   and how hard they are (velocity above 100), deleted, moved by semitones, made as hard or as long as said, or legato.
   Null: the clause is about something else. */
const sayBars = (n, u) => u === 'beat' ? n / BEATS() : u === 'ms' ? n / 1000 / SPB() : u === 's' ? n / SPB() : n
function sayStep (a, grid) {
  const int = x => Math.abs(x - Math.round(x)) < 1e-9
  if (!a && grid) { const n = grid * 16; return int(n) ? { unit: '1/16', count: Math.round(n), said: `1/${Math.round(1 / grid)}` } : null }
  if (!a) return null
  const n = Math.abs(a.n), ms = a.unit === 's' ? n * 1000 : n
  if (!int(a.unit === 's' ? ms : n)) return null
  if (a.unit === 'bar' || a.unit == null) return { unit: 'bar', count: n, said: `${n} bar${n === 1 ? '' : 's'}` }
  if (a.unit === 'beat') return { unit: 'beat', count: n, said: `${n} beat${n === 1 ? '' : 's'}` }
  if (a.unit === 'ms' || a.unit === 's') return ms % 10 === 0 ? { unit: '10 ms', count: ms / 10, said: `${ms} ms` } : { unit: '1 ms', count: ms, said: `${ms} ms` }
  if (a.unit === 'tick') return n % 10 === 0 ? { unit: '10 ticks', count: n / 10, said: `${n} ticks` } : { unit: 'tick', count: n, said: `${n} ticks` }
  if (a.unit === 'sample') return { unit: 'sample', count: n, said: `${n} samples` }
  return null
}
function sayEdit (c) {
  const { items, verbs, mods, amts, grid, more, destPos } = c, v = verbs[0], done = acts => ({ acts, who: c.said ? c.who : c.who0 })
  const what = items.find(x => x.t === 'what'), rwords = items.some(x => x.t === 'rword'), notes = items.some(x => x.t === 'notes'), str = items.find(x => x.t === 'str')
  const toA = amts.find(x => x.role === 'to'), byA = amts.find(x => x.role !== 'to' && x.role !== 'above' && x.role !== 'below' && x.unit !== 'times')
  const signed = a => mods.includes('down') ? -Math.abs(a.n) : mods.includes('up') ? Math.abs(a.n) : a.n
  /* earlier, later, longer, shorter: by so much */
  const dir = mods.find(m => ['earlier', 'later', 'longer', 'shorter'].includes(m))
  if (dir && (!v || v === 'move' || v === 'nudge') && destPos == null && !notes) {
    const step = sayStep(amts.find(x => !['times', 'db', 'pct', 'hz', 'khz', 'st'].includes(x.unit)), grid)
    if (!step) return { ask: { q: `${dir} by how much`, append: ' by ', s: c.s } }
    if (step.count > 512) return { say: 'that is too far for one line' }
    return done([Object.assign({ do: dir === 'longer' || dir === 'shorter' ? 'nudgelen' : 'nudge', dir: dir === 'later' || dir === 'longer' ? 1 : -1, unit: step.unit, count: step.count, said: step.said }, more)])
  }
  if (v === 'nudge') return { say: 'earlier or later, and by how much' }
  if (v === 'trim') return { say: 'trim the start or the end' }
  if (v === 'trimstart' || v === 'trimend') return done([Object.assign({ do: 'trim', end: v === 'trimend', at: destPos }, more)])
  if (['join', 'reverse', 'strip', 'bounce', 'follow', 'fit', 'dequantize', 'legato', 'ungroup'].includes(v)) return done([Object.assign({ do: 'redit', op: v }, more)])
  if (v === 'group' && rwords && !verbs.includes('send')) return done([Object.assign({ do: 'redit', op: 'group' }, more)])
  if (v === 'rename') { if (!str) return { say: 'rename it to what (in quotes)' }; return done([Object.assign({ do: 'rename', to: str.v, tracks: c.who && c.who.tracks && !rwords ? c.who.tracks : null }, more)]) }
  /* a region's own gain */
  if (what && what.key === 'gain') {
    if (!toA && !byA) return { ask: { q: 'by how much', append: ' by ', s: c.s } }
    return done([Object.assign({ do: 'rgain', abs: !!toA, db: toA ? toA.n : signed(byA) }, more)])
  }
  /* notes: which of them, and what of them */
  if (notes || (what && (what.key === 'velocity' || what.key === 'length'))) {
    const nf = {}
    for (const x of items.filter(x => x.t === 'pitch')) nf[x.role === 'above' ? 'above' : x.role === 'below' ? 'below' : 'is'] = x.n
    for (const x of amts.filter(x => x.role === 'above' || x.role === 'below')) nf[x.role === 'above' ? 'vabove' : 'vbelow'] = x.n
    const go = (op, o) => done([Object.assign({ do: 'notes', op, nf }, o, more)])
    if (v === 'delete') return go('delete')
    if (v === 'transpose') { const st = amts.find(x => (x.unit == null || x.unit === 'st') && (!x.role || x.role === 'by')); if (!st) return { say: 'transpose by how much' }; return go('transpose', { d: signed(st) }) }
    if (v === 'select') return { say: 'notes are chosen on the notes page' }
    if (what && what.key === 'velocity') {
      if (toA) return toA.unit === 'pct' ? go('vscale', { d: toA.n }) : go('vset', { d: toA.n })
      if (byA) return byA.unit === 'pct' && !byA.signed && !mods.length ? go('vscale', { d: byA.n }) : go('vby', { d: signed(byA) })
      return { ask: { q: 'to what', append: ' to ', s: c.s } }
    }
    if (what && what.key === 'length') {
      const a = toA || byA, qn = grid ? grid * 4 : a && a.unit === 'beat' ? a.n * QB() / BEATS() : a && (a.unit === 'bar' || a.unit == null) ? a.n * QB() : a && (a.unit === 'ms' || a.unit === 's') ? sayBars(a.n, a.unit) * QB() : null
      if (!(qn > 0)) return { ask: { q: 'how long', append: ' to ', s: c.s } }
      return go('len', { d: qn, said: grid ? `1/${Math.round(1 / grid)}` : `${a.n} ${a.unit || 'bars'}` })
    }
    if (!v && amts.some(x => x.unit === 'st' || (x.signed && !x.role))) { const st = amts.find(x => x.unit === 'st' || x.signed); return go('transpose', { d: signed(st) }) }      // (notes above c4 +2)
    return null
  }
  return null
}
/* one stretch of words up to an "and then": its things (who, where, what, how much), then what they come to */
function sayClause (toks, who0, s, made0) {
  const items = []
  let i = 0, pre = null, not = false
  const role = () => { const r = pre; pre = null; return r }
  const skipFill = () => { while (toks[i] && toks[i].k === 'fill') i++ }
  while (i < toks.length) {
    const t = toks[i]
    if (t.k === 'fill') { i++; continue }
    if (t.k === 'role') { pre = t.v; i++; continue }
    if (t.k === 'and') { i++; continue }
    if (t.k === 'verb' || t.k === 'mod' || t.k === 'grid') { items.push({ t: t.k, v: t.v }); i++; pre = null; continue }
    if (t.k === 'shape' || t.k === 'opt') { items.push({ t: t.k, v: t.v }); i++; continue }
    if (t.k === 'side') { items.push({ t: 'side', v: t.v, hard: !!t.hard }); i++; continue }
    if (t.k === 'except') { not = true; i++; continue }
    if (t.k === 'str') { items.push({ t: 'str', v: t.v }); i++; continue }
    if (t.k === 'rword' || t.k === 'notes' || t.k === 'tword' || t.k === 'mword' || t.k === 'pword') { items.push({ t: t.k }); i++; continue }
    if (t.k === 'printname') { items.push({ t: 'printname', v: t.v }); i++; continue }
    if (t.k === 'tkind' || t.k === 'tfilt' || t.k === 'tpos' || t.k === 'color' || t.k === 'shade' || t.k === 'howhat' || t.k === 'fmt' || t.k === 'hoprint' || t.k === 'horange') { items.push({ t: t.k, v: t.v }); i++; continue }
    if (t.k === 'qopt') { items.push({ t: 'qopt', v: t.v }); i++; continue }
    if (t.k === 'pitch') { items.push({ t: 'pitch', n: t.v, role: role() }); i++; continue }
    if (t.k === 'rfilt') {                                                                         // which regions: muted, unmuted, longer or shorter than so much, named "…"
      i++
      if (t.v === 'long' || t.v === 'short') { const n = toks[i] && toks[i].k === 'num' ? toks[i++] : null, u = n && toks[i] && toks[i].k === 'unit' ? toks[i++].v : null; if (!n) return null; items.push({ t: 'rfilt', v: t.v, bars: sayBars(n.v, u) }); continue }
      if (t.v === 'named') { const q = toks[i] && toks[i].k === 'str' ? toks[i++] : null; if (!q) return { say: 'named what (in quotes)' }; items.push({ t: 'rfilt', v: 'named', s: q.v.toLowerCase(), raw: q.v }); continue }
      items.push({ t: 'rfilt', v: t.v }); continue
    }
    /* a value of a track: what it is (volume, pan, a print), or a control of a plug-in or a macro, by their names */
    if (t.k === 'what' || t.k === 'macroword' || t.k === 'plug' || t.k === 'ctlname') {
      let mac = false, plug = null, ctl = null, what = null
      while (toks[i] && (['macroword', 'plug', 'ctlname'].includes(toks[i].k) || (toks[i].k === 'what' && !what && !ctl))) { const x = toks[i++]; if (x.k === 'macroword') mac = true; else if (x.k === 'plug') plug = x.name; else if (x.k === 'what') { if (plug) ctl = x.raw; else what = x } else ctl = x.name }
      if (what && !plug && !ctl && !mac) items.push({ t: 'what', key: what.v })
      else items.push({ t: 'ctl', mac, plug, ctl: ctl || (what ? what.raw : null) })
      pre = null; continue
    }
    if (t.k === 'sel') { i++; items.push({ t: 'who', sel: true, role: role() }); continue }
    if (t.k === 'here') { i++; items.push({ t: 'place', pos: curPos(), role: role() }); continue }
    if (t.k === 'start') { i++; items.push({ t: 'place', pos: 0, role: role() }); continue }
    if (t.k === 'end') { i++; items.push({ t: 'place', pos: songEnd(), end: true, role: role() }); continue }
    if (t.k === 'cycle') { i++; if (!(S.cycle.b - S.cycle.a >= MIN_LEN)) return { say: 'no cycle is set' }; items.push({ t: 'place', span: [S.cycle.a, S.cycle.b], name: 'the cycle', role: role() }); continue }
    /* a part of the song: [second] chorus [2] */
    if (t.k === 'ord' && (t.v === 1 || t.v === 'last') && toks[i + 1] && toks[i + 1].k === 'num' && Number.isInteger(toks[i + 1].v) && !(toks[i + 2] && toks[i + 2].k === 'sect')) { items.push({ t: 'rfilt', v: t.v === 1 ? 'first' : 'last', n: toks[i + 1].v }); i += 2; continue }      // (the first 3 regions)
    if (t.k === 'ord' || t.k === 'sect') {
      let ord = null, stem = null, own = 0
      if (t.k === 'ord') { ord = t.v; i++ }
      skipFill()
      if (toks[i] && toks[i].k === 'sect') { stem = toks[i].v; own = toks[i].n || 0; i++; const n = toks[i]; if (n && n.k === 'num' && !n.signed && Number.isInteger(n.v) && n.v < 10 && !(toks[i + 1] && toks[i + 1].k === 'unit')) { if (ord == null) ord = n.v; i++ } }
      if (!stem) { if (ord === 'last') { items.push({ t: 'place', pos: songEnd(), end: true, role: role() }); continue } return null }
      const sc = sayScene(stem, ord, ord == null ? own : 0)
      if (!sc) return { say: `no marker called ${stem}` }
      items.push({ t: 'place', span: [sc.a - 1, Math.min(SONG_END, sc.b - 1)], scene: sc.i, name: sc.name, role: role() }); continue
    }
    if (t.k === 'unit' && t.v === 'bar' && toks[i + 1] && toks[i + 1].k === 'num') { i++; const n = toks[i++]; items.push({ t: 'place', pos: sayBar(n.v), bar: Number.isInteger(n.v), role: role() }); continue }      // "bar 17"
    if (t.k === 'num') {
      i++
      const u = toks[i] && toks[i].k === 'unit' ? toks[i].v : t.unit || null
      if (toks[i] && toks[i].k === 'unit') i++
      const r = role(), nextTo = toks[i] && toks[i].k === 'role' && (toks[i].v === 'to' || toks[i].v === 'thru')
      const valueTo = r === 'to' && u == null && items.some(x => x.t === 'what' || x.t === 'ctl') && !items.some(x => x.t === 'place')      // (set the space to 40: an amount, not bar 40)
      if ((u === 'bar' || u == null) && !t.signed && (r || nextTo) && !valueTo && r !== 'above' && r !== 'below' && r !== 'by') { items.push({ t: 'place', pos: sayBar(t.v), bar: Number.isInteger(t.v), role: r }); continue }
      items.push({ t: 'amt', n: t.v, unit: u, signed: t.signed, role: r }); continue
    }
    if (t.k === 'unit') { i++; continue }
    /* a track, or several: words for it, "all", "and" between two of them */
    if (t.k === 'trk' && (t.v === 'left' || t.v === 'right') && items.length && items[items.length - 1].t === 'what' && items[items.length - 1].key === 'pan') { items.push({ t: 'side', v: t.v === 'left' ? -1 : 1 }); i++; continue }
    if (t.k === 'trk' || t.k === 'name' || t.k === 'all') {
      const parts = [[]], from = t.at, routed = toks.some(x => x.k === 'verb' && (x.v === 'send' || x.v === 'group'))
      let all = false, last = t
      while (toks[i] && (toks[i].k === 'trk' || toks[i].k === 'name' || toks[i].k === 'all' || (toks[i].k === 'fill' && toks[i + 1] && (toks[i + 1].k === 'trk' || toks[i + 1].k === 'name' || toks[i + 1].k === 'all')) || (toks[i].k === 'and' && toks[i + 1] && (toks[i + 1].k === 'trk' || toks[i + 1].k === 'name')))) {
        const x = toks[i++]
        if (x.k === 'and') parts.push([]); else if (x.k === 'all') all = true; else if (x.k !== 'fill') { parts[parts.length - 1].push(x); last = x }
      }
      const r = role(), got = [], nt = not
      not = false
      if (parts.every(p => !p.length)) { items.push({ t: 'who', all: true, role: r, not: nt }); continue }
      for (const p of parts) {
        if (!p.length) continue
        /* a print said after a track (kick delay 30), or alone after one (kick, reverb 40): the print, unless it is sent to */
        const pw = p[p.length - 1], print = !routed && pw.k === 'trk' && SAY_PRINT_TRK[pw.v]
        if (print && p.length === 1 && toks.some(x => x.k === 'pword')) { items.push({ t: 'printname', v: print }); continue }      // (a delay print, a reverb print: the print of that name)
        if (print && p.length === 1 && items.some(x => x.t === 'who')) { items.push({ t: 'what', key: print }); continue }
        const resolve = q => { const nm = q.find(x => x.k === 'name'); return nm ? S.tracks.filter(x => x.id === nm.id) : sayTracks(q.map(x => x.v)) }
        let ts = resolve(p), word = p.map(x => x.raw).join(' ')
        if (print && p.length > 1) { const rest = p.slice(0, -1), rts = resolve(rest); if (rts.length && (!ts.length || rest.some(x => x.k === 'name'))) { ts = rts; word = rest.map(x => x.raw).join(' '); items.push({ t: 'what', key: print }) } }
        if (!ts.length) { got.none = word; continue }
        if (ts.length > 1 && !all && !(p.length === 1 && p[0].many)) return { ask: { q: `which ${word}: ${ts.length <= 4 ? ts.map(x => x.name).join(', ') : ts.length + ' tracks'}, or all`, among: ts.map(x => x.id), from: p[0].at, to: p[p.length - 1].end, s } }
        for (const x of ts) if (!got.includes(x)) got.push(x)
      }
      if (!got.length && !got.none) continue                                          // (only a print was said)
      items.push({ t: 'who', ids: got.map(x => x.id), none: got.none || '', word: parts.flat().map(x => x.v), fam: parts.length === 1 && parts[0].length === 1 && parts[0][0].fam ? parts[0][0].v : null, role: r, not: nt }); continue
    }
    return null
  }
  /* what they come to */
  const verbs = items.filter(x => x.t === 'verb').map(x => x.v), mods = items.filter(x => x.t === 'mod').map(x => x.v), amts = items.filter(x => x.t === 'amt'), grid = (items.find(x => x.t === 'grid') || {}).v
  const routing = verbs.includes('send') || verbs.includes('group')
  let whos = items.filter(x => x.t === 'who' && !x.not), dest = null
  const nots = items.filter(x => x.t === 'who' && x.not).flatMap(x => (x.ids || []).map(id => byId(id).name))      // (all but these)
  if (routing) { dest = whos.find(x => x.role === 'at' || x.role === 'to') || null; whos = whos.filter(x => x !== dest) }
  { const lost = whos.find(x => x.none); if (lost && !verbs.includes('new') && !items.some(x => x.t === 'tkind')) return { say: `no track called ${lost.none}` } }      // (a new bus: there need be none yet)
  let who = whos.length ? (whos.some(x => x.sel) ? { sel: true } : whos.some(x => x.all) ? { all: true } : { tracks: [...new Set(whos.flatMap(x => x.ids))].map(id => byId(id).name), fam: whos.length === 1 ? whos[0].fam : null }) : null
  if (who && nots.length) { if (who.tracks) who.tracks = who.tracks.filter(n => !nots.includes(n)); who.not = nots }
  const said = !!who
  if (!who && who0) who = who0
  /* after a bar, before one: which of many (regions that begin there or later, end there or sooner) */
  const filt = items.filter(x => x.t === 'place' && (x.role === 'after' || x.role === 'before')), fA = filt.find(x => x.role === 'after'), fB = filt.find(x => x.role === 'before')
  const after = fA ? (fA.span ? fA.span[1] : fA.pos) : null, before = fB ? (fB.span ? fB.span[0] : fB.pos) : null
  const places = items.filter(x => x.t === 'place' && !filt.includes(x)), at0 = x => x.span ? x.span[0] : x.pos
  const from = places.find(x => x.role === 'from') || (places.some(x => x.role === 'to' || x.role === 'thru') ? places.find(x => x.role === 'in' || (x.role == null && places.indexOf(x) === 0 && places.length > 1)) : null)
  const to = places.find(x => (x.role === 'to' || x.role === 'thru') && x !== from)
  const wantsDest = verbs.some(v => v === 'move' || v === 'copy' || v === 'again' || v === 'duplicate' || v === 'trimstart' || v === 'trimend')
  let span = null, name = '', destPos = null
  if (from || (to && !wantsDest) || (to && from)) {
    const a = from ? at0(from) : curPos(), b = to ? (to.span && to.role === 'thru' ? to.span[1] : to.bar ? Math.min(SONG_END, to.pos + 1) : at0(to)) : songEnd()      // (a bar named as the end is in the stretch: 17 to 24 is eight bars; up to a marker is up to where it begins)
    if (!(Math.abs(b - a) >= MIN_LEN)) return { say: 'that stretch is empty' }
    span = [Math.min(a, b), Math.max(a, b)]
  }
  for (const p of places) {
    if (p === from || (p === to && span)) continue
    if ((p.role === 'at' || p.role === 'to') && wantsDest && destPos == null) { destPos = at0(p); continue }
    if (p.span && !span) { span = p.span.slice(); name = p.name || ''; continue }
    if (p.pos != null && destPos == null) destPos = p.pos
  }
  const db = amts.find(x => x.unit === 'db') || amts.find(x => x.unit == null && (mods.includes('up') || mods.includes('down') || x.signed)), times = amts.find(x => x.unit === 'times'), len = amts.find(x => x.unit === 'bar' || x.unit === 'beat')
  const msA = amts.find(x => x.unit === 'ms' || x.unit === 's'), lenBars = len ? (len.unit === 'beat' ? len.n / BEATS() : len.n) : msA ? (msA.unit === 'ms' ? msA.n / 1000 : msA.n) / SPB() : null      // (a time in ms is so many bars at the song's tempo)
  const acts = [], names = who && who.tracks ? who.tracks : null, more = {}
  let v = verbs[0]
  if (who) more.who = who; if (span) more.span = span; if (name) more.name = name; if (after != null) more.after = after; if (before != null) more.before = before
  { const r = sayValue({ items, verbs, mods, amts, who, said, who0, span, after, before, s }); if (r) return r }
  { const rf = {}; for (const x of items.filter(x => x.t === 'rfilt')) rf[x.v] = x.v === 'long' || x.v === 'short' ? x.bars : x.v === 'named' ? x.s : x.v === 'first' || x.v === 'last' ? x.n : true; if (Object.keys(rf).length) more.rf = rf }
  { const r = sayPatch({ items, verbs, who, said, who0, toks, s }); if (r) return r }
  { const r = sayProject({ items, verbs, amts, who, said, who0, places, s }); if (r) return r }
  { const r = sayTime({ items, verbs, amts, who, said, who0, places, span, destPos, after, s }); if (r) return r }
  { const r = sayTrack({ items, verbs, amts, who, said, who0, whos: items.filter(x => x.t === 'who'), s }); if (r) return r }
  if (v === 'duplicate') v = 'again'                                                         // (regions duplicated: said once more)
  { const r = sayEdit({ items, verbs, mods, amts, grid, who, said, who0, more, destPos, s }); if (r) return r }
  if (verbs.length > 1 && !(verbs.includes('group') && verbs.includes('send'))) return null
  if (!v) {
    if (mods.includes('half')) return null
    if ((mods.includes('up') || mods.includes('down') || (db && db.signed)) && db) {                 // louder, quieter: a track's fader, or the chosen regions' gain
      const d = mods.includes('down') ? -Math.abs(db.n) : mods.includes('up') ? Math.abs(db.n) : db.n
      if (names) { for (const n of names) acts.push({ do: 'volume', track: n, db: d, mode: 'relative' }); if (names.length > 1) acts.unshift({ do: 'note', text: `${names.length} tracks ${d > 0 ? '+' : '−'}${Math.abs(d)} db` }) }
      else if (who && who.all) for (const t of S.tracks.filter(x => x.kind !== 'bus' && !(who.not || []).includes(x.name))) acts.push({ do: 'volume', track: t.name, db: d, mode: 'relative' })
      else acts.push({ do: 'gain', db: d })
      return { acts, who: said ? who : who0 }
    }
    if (items.length === places.length && places.length === 1 && !who) {                              // a place and nothing else: the playhead goes there
      const p = places[0]
      return { acts: [p.scene != null ? { do: 'goto', scene: p.scene } : { do: 'jump', pos: at0(p) }] }
    }
    return null
  }
  if (v === 'goto' || v === 'loop') { const p = places[0]; if (!p) return null; return { acts: [v === 'loop' ? (p.scene != null ? { do: 'goto', scene: p.scene, loop: true } : p.span ? { do: 'cyclespan', span: p.span } : null) : p.scene != null ? { do: 'goto', scene: p.scene } : { do: 'jump', pos: at0(p) }].filter(Boolean) } }
  if (v === 'cut') acts.push(Object.assign(mods.includes('half') ? { do: 'halve' } : { do: 'cut', at: span ? null : destPos }, more))
  else if (v === 'mute' || v === 'unmute' || v === 'solo' || v === 'unsolo') {
    const whole = !span && after == null && before == null, many = names && whole ? names : who && who.all && whole ? S.tracks.map(t => t.name).filter(n => !(who.not || []).includes(n)) : null
    if (many) { if (many.length > 1) acts.push({ do: 'note', text: `${many.length} tracks ${v === 'mute' ? 'muted' : v === 'unmute' ? 'unmuted' : v}` }); for (const n of many) acts.push({ do: v, track: n }) }      // tracks named, and no stretch: their own m and s
    else if (v === 'mute' || v === 'unmute') acts.push(Object.assign({ do: 'regmute', on: v === 'mute' }, more))
    else return null
  }
  else if (v === 'delete') acts.push(Object.assign({ do: 'delete' }, more))
  else if (v === 'again') acts.push(Object.assign({ do: 'again', times: times ? clamp(Math.round(times.n), 1, 32) : 1 }, destPos != null ? { to: destPos } : {}, more))
  else if (v === 'copy') { if (destPos == null) return { say: 'copy it to where' }; acts.push(Object.assign({ do: 'copyto', to: destPos }, more)) }
  else if (v === 'move') { if (destPos == null) return { say: 'move it to where' }; acts.push(Object.assign({ do: 'moveto', to: destPos }, more)) }
  else if (v === 'fadein' || v === 'fadeout') { const sh = (items.find(x => x.t === 'shape') || {}).v, curve = { lin: 0, pow: 1, s: 2 }[sh]; acts.push(Object.assign({ do: 'fade', out: v === 'fadeout' }, lenBars != null ? { bars: lenBars } : {}, msA ? { ms: msA.unit === 'ms' ? msA.n : msA.n * 1000 } : {}, curve != null ? { curve } : {}, more)) }
  else if (v === 'transpose') {
    const st = amts.find(x => x.unit == null || x.unit === 'st')
    if (!st) return { say: 'transpose by how much' }
    const d = mods.includes('down') ? -Math.abs(st.n) : mods.includes('up') ? Math.abs(st.n) : st.n
    if (names) for (const n of names) acts.push({ do: 'transpose', track: n, semitones: d, mode: 'relative' }); else acts.push({ do: 'transpose', semitones: d, mode: 'relative' })
  }
  else if (v === 'quantize') { const qs = items.filter(x => x.t === 'qopt'), pc = amts.filter(x => x.unit === 'pct'), feel = {}; qs.forEach((q, k) => { if (pc[k]) feel[q.v] = clamp(pc[k].n, 0, 100) }); acts.push(Object.assign({ do: 'quantize' }, grid ? { grid } : {}, feel, more)) }
  else if (v === 'select') acts.push(Object.assign({ do: 'select' }, more))
  else if (routing) {
    const ts = names || (who && who.all ? S.tracks.filter(x => x.kind === 'audio').map(x => x.name) : who && who.sel ? chosen().map(x => x.name) : null)
    if (!ts || !ts.length) return { say: 'which tracks' }
    const asBus = dest && dest.fam === 'bus' && verbs.includes('group'), label = SAY_FAM_NAME[who && who.fam] || ''
    let sendFrom = !said && made0 ? null : ts                                                   // (nothing named, and the clause before made a stack or a bus: that is what is sent)
    if (verbs.includes('group')) { acts.push({ do: asBus ? 'bus' : 'stack', tracks: ts, name: label }); if (verbs.includes('send')) sendFrom = null }
    if (verbs.includes('send') || (verbs.includes('group') && dest && !asBus)) {
      if (!dest) return { say: 'send it to where' }
      const one = dest.ids && dest.ids.length === 1 ? byId(dest.ids[0]) : null, w = dest.word || []
      const to = one && one.kind !== 'audio' ? { track: one.name } : w.includes('delay') || w.includes('slap') ? { print: 'delay' } : w.includes('reverb') || w.includes('plate') || w.includes('room') ? { print: 'space' } : null      // a bus by its name; or a reverb, a delay — the one there is, or one made for it
      acts.push(Object.assign({ do: 'send', to }, sendFrom ? { tracks: sendFrom } : { made: true }, db ? { db: -Math.abs(db.n) } : {}))
      if (!acts[acts.length - 1].to) return { say: 'send it to where' }
    }
    return { acts, who: said ? who : who0 }
  }
  else return null
  return { acts, who: said ? who : who0 }
}
/* the whole line: its clauses one after the other; a clause that names nothing takes what the one before it named.
   Null: not understood here. */
function sayRead (s) {
  const toks = sayLex(s)
  if (!toks.length || toks.some(t => t.k === 'raw')) return null
  const clauses = [[]]
  for (const t of toks) { if (t.k === 'then') { clauses.push([]); continue } clauses[clauses.length - 1].push(t) }
  let who = null, made = false
  const acts = []
  for (const c of clauses) {
    if (!c.length) continue
    const r = sayClause(c, who, s, made)
    if (!r) return null
    if (r.ask) { SAY.ask = r.ask; return [{ do: 'note', text: r.ask.q, ask: true }] }
    if (r.say) return [{ do: 'note', text: r.say }]
    who = r.who || who; acts.push(...r.acts); made = r.acts.some(a => a.do === 'stack' || a.do === 'bus')
  }
  return acts.length ? acts : null
}
/* the answer to "which one": a name among those asked about, a number, or all — the line is read again with it */
function sayAnswer (text) {
  const q = SAY.ask
  SAY.ask = null
  if (!q) return null
  if (q.append) return /^\s*$/.test(text) ? null : q.s + q.append + text                      // (how much: the line again, with the answer after it)
  const a = text.toLowerCase().trim(), among = q.among.map(byId).filter(Boolean), word = q.s.slice(q.from, q.to)
  let pick = null
  if (/^(all|both|every|everything)$/.test(a)) pick = `${word} all`
  else if (/^\d$/.test(a) && among[+a - 1]) pick = among[+a - 1].name.toLowerCase()
  else { const ws = sayWords(a).map(sayStem), ts = among.filter(t => t.name.toLowerCase() === a || (ws.length > 0 && ws.every(w => sayKeys(t).has(w)))); if (ts.length === 1) pick = ts[0].name.toLowerCase() }      // (the words of the answer against the names asked about — whatever else those words may mean elsewhere)
  return pick ? q.s.slice(0, q.from) + pick + q.s.slice(q.to) : null
}

/* ── carrying it out ── */
/* the tracks and regions an action means: those chosen when nothing else is said; a stretch alone is every track */
function sayWho (a) {
  const w = a.who
  if (w && w.tracks) return S.tracks.filter(t => w.tracks.some(n => String(n).toLowerCase() === t.name.toLowerCase()))
  if ((w && w.all) || (!w && (a.span || a.after != null || a.before != null || a.rf))) return S.tracks.filter(t => t.kind === 'audio' && !((w && w.not) || []).includes(t.name))
  return null                                                                                          // what is chosen
}
const sayIn = (ts, a, b) => ts.flatMap(t => t.regs.filter(r => r.a - 1 < b - 1e-9 && r.b - 1 > a + 1e-9).map(r => [r, t]))
const sayFiltered = a => a.after != null || a.before != null || !!a.rf
const sayOf = a => {
  const ts = sayWho(a), f = a.rf || {}, rs = (ts ? (a.span ? sayIn(ts, a.span[0], a.span[1]) : ts.flatMap(t => t.regs.map(r => [r, t]))) : selRegs()).filter(([r]) => (a.after == null || r.a - 1 >= a.after - 1e-9) && (a.before == null || r.b - 1 <= a.before + 1e-9)      // (after a bar: the regions that begin there or later; before one: that end there or sooner)
    && (!f.muted || r.mute) && (!f.open || !r.mute) && (f.long == null || r.b - r.a > f.long + 1e-9) && (f.short == null || r.b - r.a < f.short - 1e-9) && (!f.named || String(r.tag || r.name || '').toLowerCase().includes(f.named)))
  if (f.first || f.last) { rs.sort((x, y) => x[0].a - y[0].a); return f.first ? rs.slice(0, f.first) : rs.slice(-f.last) }
  return rs
}      // (after a bar: the regions that begin there or later; before one: that end there or sooner)
/* a stretch cut out of some tracks at both its ends: what then lies inside it (within an edit) */
function sayCarve (ts, a, b) { const inside = []; for (const t of ts) { cutLaneAt(t, a); cutLaneAt(t, b); for (const r of t.regs) if (after(r, a) && !after(r, b)) inside.push([r, t]) } return inside }
const sayCount = (n, what = 'region') => `${n} ${what}${n === 1 ? '' : 's'}`
function sayPut (clip, at) {                                                                           // what a clipboard holds, put down at a place on the tracks it came from
  const put = []
  for (const c of clip) { const t = S.tracks[c.ti]; if (!t || t.kind !== 'audio' || !!t.inst !== !!c.r.notes) continue; const len = c.r.b - c.r.a, n = cloneReg(c.r, { a: at + 1 + c.da, b: at + 1 + c.da + len }); t.regs.push(n); put.push([n, t, n.a - 1, n.b - 1]) }
  freshGroups(put.map(x => x[0])); S.selR = put.map(x => x[0].id); S.focus = 'lanes'; S.marq = null; settle(put)
  return put
}
function sayDo (a, out) {
  const word = (text, more) => out.push(Object.assign({ k: 'word', text, step: 1 }, more || {})), none = () => out.push({ k: 'word', text: sayWho(a) ? 'nothing there' : 'choose a region first' })
  if (a.do === 'note') { out.push({ k: 'word', text: String(a.text).slice(0, 90), quiet: 1 }); return true }
  if (a.do === 'chords') return typeof chordDo === 'function' ? chordDo(a, out) : false
  if (a.do === 'patch2') {                                                                         // the patch, by words: what the wall's own hands do
    const ts = (a.ids || []).map(byId).filter(Boolean), name = a.plug || a.print, said = []
    if (a.op === 'add' && a.plug) { out.push({ k: 'word', text: a.result || 'plug-ins are put on in the app' }); return true }      // (put on before the line: sayReady)
    for (const t of ts) {
      const w = wallOf(t)
      if (a.op === 'add') { const n0 = w.nodes.length; wallAdd(t, a.print); const node = w.nodes.length > n0 ? w.nodes[w.nodes.length - 1] : null; if (!node) continue; if (a.parallel) sayParallel(w, node.id); else wallAppend(w, node.id); wallPush(t); said.push(t) }
      else if (a.plug) {
        const ins = sayInsOf(t, a.plug), node = ins && w ? w.nodes.find(n => n.ins === ins) : null
        if (!ins) continue
        if (a.op === 'remove') { if (node) wallRemove(t, node); else { if (NAT && ins.uid) NAT.call('remove', { track: t.id, uid: ins.uid }); t.inserts.splice(t.inserts.indexOf(ins), 1) } wallPush(t) }
        else if (a.op === 'bypass' || a.op === 'unbypass') { ins.off = a.op === 'bypass'; if (NAT && ins.uid) NAT.call('bypass', { track: t.id, uid: ins.uid, off: ins.off ? 1 : 0 }) }
        else if (a.op === 'open') { if (NAT && ins.uid) NAT.call('editor', { track: t.id, uid: ins.uid }) }
        said.push(t)
      } else {
        const node = sayNodeOf(t, a.print)
        if (!node) continue
        if (a.op === 'remove') wallRemove(t, node); else node.bypass = a.op === 'bypass'
        wallPush(t); said.push(t)
      }
    }
    uiDirty('dock', 'lanes', 'head')
    if (!said.length) { out.push({ k: 'word', text: `no ${name} on ${sayList(ts)}` }); return true }
    word(`${name} ${{ add: 'put on', remove: 'taken off', bypass: 'off', unbypass: 'on', open: 'opened' }[a.op]}${a.op === 'add' && a.parallel ? ' in parallel' : ''}: ${sayList(said)}`)
    return true
  }
  if (a.do === 'project') {
    if (a.op === 'saveas') { out.push({ k: 'word', text: a.result || 'saving is in the app' }); return true }
    const ho = S.ho
    if (ho.state === 'busy') { out.push({ k: 'word', text: 'a hand-off is under way' }); return true }
    for (const k of ['what', 'fmt', 'bits', 'kbps', 'rate', 'print', 'range']) if (a[k] != null) ho[k] = a[k]
    if (a.scene != null && SCENES[a.scene]) jumpTo(SCENES[a.scene].a - 1)                       // (this part: the one the playhead stands in)
    if (a.only) { const pl = hoPlan(), want = new Set(a.only.map(n => String(n).toLowerCase())); ho.skip = pl.cands.filter(t => !want.has(t.name.toLowerCase())).map(t => t.id) } else if (a.what) ho.skip = []
    ho.open = true; ho.done = 0; ho.note = ''; uiDirty('top', 'hand')
    const f = hoFmt(), pl = hoPlan()
    if (ho.what !== 'mix' && !pl.list.length) { out.push({ k: 'word', text: `hand off set, but no stem sounds in ${ho.range === 'song' ? 'the song' : ho.range === 'cycle' ? 'the cycle' : pl.sc.name || 'this part'}` }); return true }
    out.push({ k: 'word', text: `hand off set: ${ho.what === 'mix' ? 'the mix' : `${pl.list.length} stem${pl.list.length === 1 ? '' : 's'}`}, ${f.fmt}${f.kbps ? ' ' + f.kbps + ' kbps' : f.bits ? ' ' + f.bits + ' bit' : ''} ${f.rate / 1000} khz, press hand off` })
    return true
  }
  if (a.do === 'time' && (a.op === 'room' || a.op === 'cut')) {                                  // bars put in, or taken out of the song (the song's time keys)
    if (a.op === 'room') { const at = a.at != null ? clamp(+a.at, 0, SONG_END) : curPos(); timeAct.room(at, +a.len); word(`${+(+a.len).toFixed(2)} bars put in at ${readout(at)}`) }
    else { timeAct.cut(+a.a, +a.b); word(`bars ${Math.round(a.a) + 1} to ${Math.round(a.b)} taken out of the song`) }
    uiDirty('scenes', 'ruler', 'lanes'); return true
  }
  if (a.do === 'tempo' && a.by != null) { const bpm = clamp(Math.round(S.tempo + (+a.by)), 60, 180), from = S.tempo; if (bpm !== from) setTempo(bpm); out.push({ k: 'tempo', from, to: bpm, mix: 1 }); return true }
  if (a.do === 'meter') { const ok = MEASURES.some(m => m[0] === +a.b && m[1] === +a.u); if (!ok) { out.push({ k: 'word', text: `the measures there are: ${MEASURES.map(m => m.join('/')).join(' ')}` }); return true } const was = S.meter.join('/'); setMeter(+a.b, +a.u); out.push({ k: 'word', text: `measure ${was} to ${a.b}/${a.u}: the steps back are cleared, as by hand` }); return true }      // (no step of its own: a new measure clears the steps back, as the measure menu does)
  if (a.do === 'time') {
    const mark = (list, fn) => { edit(fn); uiDirty('scenes', 'ruler', 'lanes') }
    if (a.op === 'addmark') {
      const bar1 = clamp(Math.round((a.at != null ? +a.at : curPos())) + 1, 1, SONG_END)
      if (SCENES.some(s => s.a === bar1)) { out.push({ k: 'word', text: `there is a marker at bar ${bar1}` }); return true }
      const name = String(a.name || `part ${SCENES.length + 1}`).slice(0, 40)
      mark(null, () => { SCENES = mkScenes(SCENES.map(s => [s.name, s.a, s.c]).concat([[name, bar1]])) }); SAY.vocab = null
      word(`marker ${name} at bar ${bar1}`); return true
    }
    const sc = SCENES[a.i]
    if (!sc) { out.push({ k: 'word', text: 'no such marker' }); return true }
    if (a.op === 'delmark') { removeScene(a.i); SAY.vocab = null; uiDirty('scenes', 'ruler'); word(`marker ${sc.name} deleted`); return true }
    if (a.op === 'namemark') { const name = String(a.name).slice(0, 40); mark(null, () => { SCENES = mkScenes(SCENES.map((s, k) => [k === a.i ? name : s.name, s.a, s.c])) }); SAY.vocab = null; word(`${sc.name} is ${name}`); return true }
    if (a.op === 'movemark') {
      const bar1 = clamp(Math.round(+a.at) + 1, 1, SONG_END)
      if (SCENES.some((s, k) => k !== a.i && s.a === bar1)) { out.push({ k: 'word', text: `there is a marker at bar ${bar1}` }); return true }
      mark(null, () => { SCENES = mkScenes(SCENES.map((s, k) => [s.name, k === a.i ? bar1 : s.a, s.c])) })
      word(`marker ${sc.name} at bar ${bar1}`); return true
    }
    return false
  }
  if (a.do === 'track') {                                                                         // the track keys and menus, on the tracks the line means
    const ts = (a.ids || []).map(byId).filter(Boolean), names = ts.map(t => t.name), list = () => sayList(ts)
    if (a.op === 'new') {
      const made = newTracks({ kind: a.kind === 'midi' ? 'midi' : a.kind, inst: a.kind === 'midi' ? { kind: 'synth' } : undefined, n: a.n, out: 0 })
      if (a.name) made.forEach((t, k) => { const nm = String(a.name).slice(0, 40) + (made.length > 1 ? ' ' + (k + 1) : ''); if (!S.tracks.some(x => x !== t && x.name === nm)) t.name = nm })
      repaint(); SAY.vocab = null
      word(made.length ? `${sayList(made)} made` : 'no room for another track'); return true
    }
    if (a.result != null) { word(a.result); return true }                                       // (done and waited for before the line: sayReady)
    if (a.op === 'move') {
      const vis = rows(), ref = a.ref ? byId(a.ref) : null
      let k = a.pos === 'top' ? 0 : a.pos === 'bottom' ? vis.length : ref ? vis.indexOf(S.tracks.indexOf(ref)) : -1
      if (ref && a.below) { const under = S.tracks.filter(x => x === ref || insideOf(x, ref)); k = Math.max(...under.map(x => vis.indexOf(S.tracks.indexOf(x)))) + 1 }      // (below a stack: below all that stands in it)
      if (k < 0) { out.push({ k: 'word', text: 'that track is not in view' }); return true }
      moveTracks(ts, k); repaint()
      word(`${list()} ${a.pos ? 'to the ' + a.pos : (a.below ? 'below ' : 'above ') + ref.name}`); return true
    }
    if (a.op === 'color') {
      if (a.regions) { const rs = sayOf({ who: a.who && !a.who.sel ? a.who : null }); if (!rs.length) { none(); return true } edit(() => { for (const [r] of rs) { if (a.col) r.col = a.col.slice(); else delete r.col; dirtyReg(r) } }); word(`${sayCount(rs.length)} ${a.col ? 'coloured' : 'as the track'}`); return true }
      if (!ts.length) { out.push({ k: 'word', text: 'which track' }); return true }
      edit(() => { for (const t of ts) { if (a.col) t.col = a.col.slice(); else delete t.col } }); repaint(); dirtyAll()
      word(`${list()} ${a.col ? 'coloured' : 'as read'}`); return true
    }
    if (a.op === 'unstack') { for (const t of ts) deleteTrack(S.tracks.indexOf(t)); SAY.vocab = null; word(`${list()} taken apart`); return true }
    if (a.op === 'route') { const to = a.to ? byId(a.to) : null; for (const t of ts) if (t !== to && (!to || canFeed(t, to) || to.kind === 'stack')) setOut(t, a.to || 0); repaint(); word(`${list()} to ${to ? to.name : 'the stereo out'}`); return true }
    if (a.op === 'editgroup' || a.op === 'editungroup') {
      const was = S.selT.slice(), set = a.op === 'editungroup' ? S.tracks.filter(x => ts.some(t => t.grp && x.grp === t.grp)) : ts
      if (a.op === 'editgroup' && set.length < 2) { out.push({ k: 'word', text: 'two tracks or more' }); return true }
      S.selT = set.map(t => t.id); if (a.op === 'editungroup' || !set.every(t => t.grp && t.grp === set[0].grp)) groupTracks(); S.selT = was
      word(`${sayList(set)} ${a.op === 'editgroup' ? 'grouped for editing' : 'no longer grouped'}`); return true
    }
    return false
  }
  if (a.do === 'nudge' || a.do === 'nudgelen') {                                                // the nudge keys, so many times, on what the line means (its regions, the lines up or not)
    const rs = sayOf(a)
    if (!rs.length) { none(); return true }
    pickRegs(rs.map(x => x[0])); const was = S.nudge; S.nudge = a.unit
    try { for (let k = 0; k < a.count; k++) (a.do === 'nudge' ? act.nudgeRegs || act.nudge : act.nudgeLenRegs || act.nudgeLen).call(act, a.dir) } finally { S.nudge = was }
    word(`${sayCount(rs.length)} ${a.do === 'nudge' ? (a.dir > 0 ? 'later' : 'earlier') : (a.dir > 0 ? 'longer' : 'shorter')} by ${a.said}`)
    return true
  }
  if (a.do === 'trim') {                                                                          // its start or its end to a place (else to the playhead)
    const rs = sayOf(a)
    if (!rs.length) { none(); return true }
    if (a.at != null && S.playing) { out.push({ k: 'word', text: 'stop first to trim to a bar' }); return true }
    pickRegs(rs.map(x => x[0])); const p0 = S.pos
    if (a.at != null) S.pos = clamp(+a.at, 0, SONG_END)
    const at = curPos()
    try { act.trimTo(!!a.end) } finally { S.pos = p0 }
    word(`${sayCount(rs.length)}: the ${a.end ? 'end' : 'start'} at ${readout(at)}`)
    return true
  }
  if (a.do === 'redit') {                                                                         // the region keys, on what the line means
    const op = a.op, all = sayOf(a)
    if (!all.length) { none(); return true }
    const can = { reverse: r => !r.loop && !r.notes, strip: r => !r.loop && !r.notes && !r.rev, follow: r => !r.loop && !r.notes, fit: r => !r.loop && !r.notes, legato: r => !!r.notes, dequantize: r => !!(r.notes ? r.q : r.flex && r.flex.length) }[op], rs = can ? all.filter(([r]) => can(r)) : all      // (what the key itself would leave alone is not counted as done)
    if (!rs.length) { out.push({ k: 'word', text: { reverse: 'loops and notes are not reversed', strip: 'only a file has silence to strip', follow: 'only a file follows the tempo', fit: 'only a file is fitted', legato: 'no notes there', dequantize: 'nothing there was quantized' }[op] || 'nothing there' }); return true }
    pickRegs(rs.map(x => x[0]))
    const n = rs.length, said = { join: 'joined', reverse: 'reversed', strip: 'silence being stripped', bounce: 'being bounced in place', follow: 'following the tempo, or not', fit: 'being fitted to the tempo', dequantize: 'as played', legato: 'legato', group: 'grouped', ungroup: 'ungrouped' }[op]
    if (op === 'join') act.join(); else if (op === 'reverse') act.reverse(); else if (op === 'strip') act.strip(); else if (op === 'bounce') bounceInPlace(); else if (op === 'follow') act.follow(); else if (op === 'fit') act.fitTempo(); else if (op === 'dequantize') act.dequantize(); else if (op === 'group') act.groupRegs(); else if (op === 'ungroup') act.ungroupRegs()
    else if (op === 'legato') { const s0 = ROLL.sel; ROLL.sel = new Set(); try { for (const [r] of rs) if (r.notes) rollLegato(r) } finally { ROLL.sel = s0 } }
    word(`${sayCount(n)} ${said}`)
    return true
  }
  if (a.do === 'rename') {
    const to = String(a.to).slice(0, 40)
    if (a.tracks) { const ts = S.tracks.filter(t => a.tracks.includes(t.name)); if (ts.length !== 1) { out.push({ k: 'word', text: 'one track at a time' }); return true } if (S.tracks.some(t => t !== ts[0] && t.name === to)) { out.push({ k: 'word', text: `there is a track called ${to}` }); return true } const was = ts[0].name; ts[0].name = to; SAY.vocab = null; word(`${was} is ${to}`); return true }
    const rs = sayOf(a)
    if (!rs.length) { none(); return true }
    edit(() => { for (const [r] of rs) { r.tag = to; dirtyReg(r) } })
    word(`${sayCount(rs.length)} called ${to}`)
    return true
  }
  if (a.do === 'rgain') {
    const rs = sayOf(a)
    if (!rs.length) { none(); return true }
    edit(() => { for (const [r] of rs) { r.gain = clamp(Math.round((a.abs ? +a.db : (r.gain || 0) + (+a.db)) * 10) / 10, -30, 12); dirtyReg(r) } })
    word(`${sayCount(rs.length)}: gain ${a.abs ? 'at ' + fmtDb(+a.db) : (a.db > 0 ? '+' : '−') + Math.abs(a.db)} db`)
    return true
  }
  if (a.do === 'notes') {                                                                         // the notes of the regions meant, those that answer
    const ts = sayWho(a), f = a.nf || {}, lo = a.span ? a.span[0] : a.after != null ? a.after : -Infinity, hi = a.span ? a.span[1] : a.before != null ? a.before : Infinity
    const rs = (ts ? ts.flatMap(t => t.regs.map(r => [r, t])) : selRegs()).filter(([r]) => r.notes && r.b - 1 > lo + 1e-9 && r.a - 1 < hi - 1e-9)
    if (!rs.length) { out.push({ k: 'word', text: ts ? 'no notes there' : 'choose a region of notes first' }); return true }
    const qb = QB(), hit = (r, x) => { const at = r.a - 1 - (r.off || 0) + x.t / qb; return at >= Math.max(lo, r.a - 1) - 1e-9 && at < Math.min(hi, r.b - 1) - 1e-9 && (f.is == null || x.n === f.is) && (f.above == null || x.n > f.above) && (f.below == null || x.n < f.below) && (f.vabove == null || x.v > f.vabove) && (f.vbelow == null || x.v < f.vbelow) }
    let n = 0
    edit(() => {
      for (const [r] of rs) {
        let k = 0
        const list = a.op === 'delete' ? r.notes.filter(x => hit(r, x) ? (k++, false) : true) : r.notes.map(x => {
          if (!hit(r, x)) return x
          k++
          if (a.op === 'transpose') return Object.assign({}, x, { n: clamp(x.n + Math.round(a.d), 0, 127) })
          if (a.op === 'vset') return Object.assign({}, x, { v: clamp(Math.round(a.d), 1, 127) })
          if (a.op === 'vby') return Object.assign({}, x, { v: clamp(Math.round(x.v + a.d), 1, 127) })
          if (a.op === 'vscale') return Object.assign({}, x, { v: clamp(Math.round(x.v * a.d / 100), 1, 127) })
          if (a.op === 'len') return Object.assign({}, x, { d: a.d })
          return x
        })
        if (k) { setNotes(r, list); n += k }
      }
      return n > 0
    })
    const what = { delete: 'deleted', transpose: `${a.d > 0 ? '+' : '−'}${Math.abs(a.d)} semitones`, vset: `velocity ${Math.round(a.d)}`, vby: `velocity ${a.d > 0 ? '+' : '−'}${Math.abs(a.d)}`, vscale: `velocity ${a.d}%`, len: `${a.said} long` }[a.op]
    if (n) word(`${n} note${n === 1 ? '' : 's'} ${what}`); else out.push({ k: 'word', text: 'no notes answer to that' })
    return true
  }

  if (a.do === 'line') {                                                                       // a value's line (sayValue), written as the cells write it
    const t = S.tracks.find(x => x.name.toLowerCase() === String(a.track).toLowerCase()), sp = Object.assign({}, a.spec)
    if (!t || !AUTO[a.key]) { out.push({ k: 'word', text: 'nothing to draw that on' }); return true }
    const own = lineUnit(t, a.key), conv = { 'ms>s': .001, 's>ms': 1000, 'hz>khz': .001 }[`${a.unit}>${own}`]
    if (ctlKey(a.key) && a.unit && own && a.unit !== own && !conv && !(a.unit === 'pct' && own === '%')) { out.push({ k: 'word', text: `${autoName(t, a.key)} is said in ${own}` }); return true }
    if (conv) { sp.much *= conv; if (sp.from != null) sp.from *= conv }
    const r = autoWrite(t, a.key, sp)
    if (!r) { out.push({ k: 'word', text: 'nothing to draw' }); return true }
    autoApply(r); if (!S.auto) toggleAuto()
    out.push({ k: 'word', text: `${t.name} ${autoSaid(r).replace(/\s+/g, ' ')}`, step: 1 })      // (a line of words names no cell: the track is said too)
    return true
  }
  if (a.do === 'jump' && isFinite(+a.pos)) { const p = clamp(+a.pos, 0, SONG_END); jumpTo(p); out.push({ k: 'word', text: `at ${readout(p)}` }); return true }
  if (a.do === 'cyclespan' && a.span) { setCycle(a.span[0], a.span[1], true); out.push({ k: 'word', text: `cycle ${readout(a.span[0])} to ${readout(a.span[1])}` }); return true }
  if (a.do === 'cut') {
    const ts = sayWho(a)
    let n = 0
    if (a.span) edit(() => { const all = ts || [...new Set(selRegs().map(x => x[1]))], was = all.reduce((k, t) => k + t.regs.length, 0); for (const t of all) { cutLaneAt(t, a.span[0]); cutLaneAt(t, a.span[1]) } n = all.reduce((k, t) => k + t.regs.length, 0) - was; return n > 0 })
    else { const p = a.at == null ? curPos() : clamp(+a.at, 0, SONG_END); edit(() => { if (ts) { const was = ts.reduce((k, t) => k + t.regs.length, 0); for (const t of ts) cutLaneAt(t, p); n = ts.reduce((k, t) => k + t.regs.length, 0) - was } else for (const [r, t] of selRegs()) if (splitReg(r, t, p)) n++; return n > 0 }); a = Object.assign({}, a, { said: `cut at ${readout(p)}` }) }
    if (n) word(a.said || (a.name ? `${a.name} cut out` : `cut at ${readout(a.span[0])} and ${readout(a.span[1])}`)); else none()
    return true
  }
  if (a.do === 'halve') { const rs = sayOf(a); let n = 0; if (rs.length) edit(() => { for (const [r, t] of rs) if (splitReg(r, t, (r.a + r.b) / 2 - 1)) n++; return n > 0 }); if (n) word(`${sayCount(n)} cut in half`); else none(); return true }
  if (a.do === 'regmute') {
    const ts = sayWho(a), on = a.on !== false
    let n = 0
    edit(() => { const rs = a.span && ts ? sayCarve(ts, a.span[0], a.span[1]) : sayOf(a); for (const [r] of rs) if (!!r.mute !== on) { r.mute = on; dirtyReg(r); n++ } return n > 0 })
    if (n) word(`${a.name ? a.name + ': ' : ''}${sayCount(n)} ${on ? 'muted' : 'unmuted'}`); else none()
    return true
  }
  if (a.do === 'delete') {
    const ts = sayWho(a)
    let n = 0
    edit(() => { const rs = a.span && ts ? sayCarve(ts, a.span[0], a.span[1]) : sayOf(a), ids = rs.map(x => x[0].id); if (!ids.length) return false; if (!a.span) partCrossed(new Set(ids)); S.selX = null; removeRegs(ids); n = ids.length })
    if (n) word(`${a.name ? a.name + ': ' : ''}${sayCount(n)} deleted`); else none()
    return true
  }
  if (a.do === 'again' || a.do === 'copyto') {
    const ts = sayWho(a), times = a.do === 'again' ? clamp(Math.round(+a.times || 1), 1, 32) : 1, to = a.to == null ? null : clamp(+a.to, 0, SONG_END)
    if (a.span && to == null) { for (let k = 0; k < times; k++) timeAct.repeat(a.span[0], a.span[1]); word(`${a.name || 'that stretch'} ${times > 1 ? times + ' times more' : 'once more'}`); return true }      // a part of the song said again where it stands: what follows moves later
    let clip = null
    if (a.span) { const was = S.marq; S.marq = { a: a.span[0], b: a.span[1], t0: 0, t1: S.tracks.length - 1 }; clip = marqueeClip(); S.marq = was; if (ts && a.who) clip = clip.filter(c => ts.includes(S.tracks[c.ti])) }
    else { const rs = sayOf(a); if (rs.length) { if (to == null) { pickRegs(rs.map(x => x[0])); for (let k = 0; k < times; k++) act.repeat(); word(times > 1 ? `repeated ${times} times` : 'once more'); return true } const set = new Set(rs.map(x => x[0].id)), cs = rs.map(([r, t]) => [plainCopy(r, t, set), t]), a0 = Math.min(...cs.map(x => x[0].a)); clip = cs.map(([c, t]) => ({ r: c, ti: S.tracks.indexOf(t), da: c.a - a0 })) } }
    if (!clip || !clip.length) { none(); return true }
    const len = Math.max(...clip.map(c => c.da + c.r.b - c.r.a))
    let put = []
    edit(() => { for (let k = 0; k < times; k++) put = put.concat(sayPut(clip, to + k * len)); S.selR = put.map(x => x[0].id); return put.length > 0 })
    if (put.length) { rewarp(put.map(x => x[0])); word(`${a.name || sayCount(clip.length)} ${a.do === 'again' ? 'once more' : 'copied'} at ${readout(to)}`) } else none()
    return true
  }
  if (a.do === 'moveto') {
    const ts = sayWho(a), to = clamp(+a.to, 0, SONG_END)
    let rs = []
    if (a.span && ts) edit(() => { rs = sayCarve(ts, a.span[0], a.span[1]); return rs.length > 0 }); else rs = sayOf(a)
    if (!rs.length) { none(); return true }
    pickRegs(rs.map(x => x[0])); act.spot(to); word(`${sayCount(rs.length)} moved to ${readout(to)}`)
    return true
  }
  if (a.do === 'fade') {
    const out2 = !!a.out, p = curPos(), ts = sayWho(a)
    /* the regions meant; a track named with nothing else said gives the one under the playhead, or else its last (first, for a fade in) */
    let rs = a.span || sayFiltered(a) || !ts ? sayOf(a) : ts.flatMap(t => { const rr = t.regs.slice().sort((x, y) => x.a - y.a), under = rr.find(r => p > r.a - 1 && p < r.b - 1); return rr.length ? [[under || rr[out2 ? rr.length - 1 : 0], t]] : [] })
    rs = rs.filter(x => !x[0].notes)
    let n = 0, said = ''
    if (rs.length) edit(() => {
      for (const [r, t] of rs) {
        const inside = p > r.a - 1 + 1e-6 && p < r.b - 1 - 1e-6, len = a.bars != null ? +a.bars : inside ? (out2 ? r.b - 1 - p : p - (r.a - 1)) : 1
        if (!(len > 0)) continue
        for (const [A, B] of joinsOf(t)) if (xfadeOf(A, B) && (out2 ? A === r : B === r)) uncross(A, B)      // (the end that is faded was part of a crossfade: a plain end first)
        if (out2) r.fo = clamp(len, 0, fadeRoom(r, r.fi)); else r.fi = clamp(len, 0, fadeRoom(r, r.fo))
        if (a.curve != null) { if (out2) r.foc = a.curve; else r.fic = a.curve }                    // (straight, equal power, s-curve)
        said = a.ms != null && Math.abs((out2 ? r.fo : r.fi) - len) < 1e-9 ? `${+a.ms} ms` : `${+(out2 ? r.fo : r.fi).toFixed(2)} bars`; dirtyReg(r); n++
      }
      return n > 0
    })
    if (n) word(`fade ${out2 ? 'out' : 'in'}${n > 1 ? ' on ' + sayCount(n) : ''}, ${said}`); else none()
    return true
  }
  if (a.do === 'quantize') { const rs = sayOf(a).filter(x => !x[0].loop); if (!rs.length) { none(); return true } if (a.grid && [1 / 4, 1 / 8, 1 / 16, 1 / 32].includes(+a.grid)) S.q = +a.grid; pickRegs(rs.map(x => x[0])); act.quantize(); const ns = rs.map(x => x[0]).filter(r => r.notes); if (ns.length && (a.strength != null || a.swing != null)) edit(() => { for (const r of ns) { if (a.strength != null) r.qs = a.strength / 100; if (a.swing != null) r.sw = a.swing / 100; delete r._ns; dirtyReg(r) } }); word(`${sayCount(rs.length)} quantized to 1/${Math.round(1 / S.q)}${a.strength != null ? `, ${a.strength}% strength` : ''}${a.swing != null ? `, ${a.swing}% swing` : ''}`); return true }
  if (a.do === 'select') {
    const ts = sayWho(a)
    if (a.span && (!a.who || a.who.all)) { S.selR = []; S.selX = null; S.focus = 'lanes'; S.marq = { a: a.span[0], b: a.span[1], t0: 0, t1: S.tracks.length - 1 }; out.push({ k: 'word', text: `${a.name || readout(a.span[0]) + ' to ' + readout(a.span[1])} chosen` }); uiDirty('lanes', 'dock'); return true }
    const rs = ts ? sayOf(a) : []
    if (ts && !a.span && !sayFiltered(a)) { S.selT = ts.map(t => t.id); S.sel = S.tracks.indexOf(ts[0]); S.focus = 'tracks'; S.selR = withTheirs(rs.map(x => x[0].id)); S.marq = null; showRow(S.sel); uiDirty('head', 'lanes', 'dock'); out.push({ k: 'word', text: `${sayList(ts)} chosen` }); return true }
    if (!rs.length) { none(); return true }
    pickRegs(rs.map(x => x[0])); out.push({ k: 'word', text: `${sayCount(rs.length)} chosen` })
    return true
  }
  if (a.do === 'gain' && isFinite(+a.db)) {
    const rs = sayOf(a)
    if (!rs.length) { none(); return true }
    const from = rs[0][0].gain || 0
    pickRegs(rs.map(x => x[0])); act.gain(+a.db)
    if (rs.length === 1) out.push({ k: 'gain', from, to: rs[0][0].gain || 0, step: 1 }); else word(`${sayCount(rs.length)} ${+a.db > 0 ? '+' : '−'}${Math.abs(+a.db)} db`)
    return true
  }
  if (a.do === 'stack' || a.do === 'bus') {
    const ts = (a.tracks || []).map(n => S.tracks.find(t => t.name.toLowerCase() === String(n).toLowerCase())).filter(t => !!t)
    if (!ts.length) { out.push({ k: 'word', text: 'nothing to put together' }); return true }
    if (S.tracks.length >= MAX_TRACKS) { out.push({ k: 'word', text: 'no room for another track' }); return true }
    let made = null
    if (a.do === 'stack') { S.selT = ts.map(t => t.id); S.sel = S.tracks.indexOf(ts[0]); S.focus = 'tracks'; makeStack(); made = byId(ts[0].parent); if (made && a.name && !S.tracks.some(t => t !== made && t.name === a.name)) made.name = String(a.name).toLowerCase().slice(0, 40) }
    else edit(() => { made = addTrack('bus', a.name && !S.tracks.some(t => t.name === a.name) ? String(a.name).toLowerCase().slice(0, 40) : null); for (const t of ts) { t.parent = null; t.out = made.id } normalizeOrder() })
    if (!made) { out.push({ k: 'word', text: 'nothing to put together' }); return true }
    SAY.made = made.id
    repaint(); word(`${made.name}: ${sayList(ts)}`)
    return true
  }
  if (a.do === 'send') {
    const from = a.made ? [byId(SAY.made)].filter(Boolean) : (a.tracks || []).map(n => S.tracks.find(t => t.name.toLowerCase() === String(n).toLowerCase())).filter(Boolean)
    if (!from.length || !a.to) { out.push({ k: 'word', text: 'which tracks' }); return true }
    const k = a.to.print === 'delay' ? 'delay' : 'space', db = isFinite(+a.db) ? clamp(-Math.abs(+a.db), -48, 6) : null
    let dest = a.to.track ? S.tracks.find(t => t.name.toLowerCase() === String(a.to.track).toLowerCase() && t.kind !== 'audio') : S.tracks.find(t => t.kind === 'bus' && (patchNow(t)[k] > 0 || (k === 'space' ? /reverb|plate|verb|hall|room/ : /delay|echo|slap/).test(t.name)))
    let n = 0
    edit(() => {
      if (!dest) { if (a.to.track || S.tracks.length >= MAX_TRACKS) return false; dest = addTrack('bus', k === 'space' ? 'reverb' : 'delay'); setPrint(dest, k, PRINT_START[k]); dest.patch0 = copy(dest.patch) }
      for (const t of from) { if (t === dest) continue; const sd = (t.sends || []).find(x => x.to === dest.id); if (sd) { if (db != null && sd.db !== db) { sd.db = db; n++ } } else if ((t.sends || []).length < 3) { (t.sends = t.sends || []).push({ to: dest.id, db: db == null ? -12 : db }); n++ } }
      normalizeOrder()
      return n > 0
    })
    if (n) { repaint(); word(`${sayList(from)} to ${dest.name}${db != null ? ' at ' + fmtDb(db) + ' db' : ''}`) } else out.push({ k: 'word', text: dest ? 'already sent there' : 'no bus called that' })
    return true
  }
  return false
}
