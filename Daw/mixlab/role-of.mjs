// what part a track plays, from the name he gives it (MAIN, DUB, AD, HARM, WL1, his vocal stems named by the song's
// sections) and else from the room's own reading of a name (tidy.js's what) — shared by roles.mjs and the bench.
/* his names first, then the room's reading */
export function roleOf (t) {
  const n = t.name.normalize('NFC').toUpperCase(), w = t.what || ''
  if (/CLICK|GUIDE|\bREF\b|METRO/.test(n)) return null
  if (/SNARE|\bSN[TB]?\b|SNR|\bSUB SNARE/.test(n) || w === 'snare') return 'snare'
  if (/KICK|\bKIK\b|\bBD\b/.test(n) || w === 'kick') return 'kick'
  if (/\bHH\b|HAT|\bT\d\b|TOM|\bOH\b|OVERHEAD|ROOM|CLAP|PERC|TAMB|CYMBAL|RIDE|CRASH|SHAKER|DRUM|FILLS|BREAKS|COW ?BELL|TOP/.test(n) || ['hat', 'tom', 'overheads', 'cymbal', 'drums', 'clap', 'rim', 'perc', 'shaker', 'tambourine', 'conga', 'bongo', 'cajon', 'cowbell'].includes(w)) return 'drums'
  if (/BASS|\bSUB\b|808/.test(n) || ['bass', 'sub bass', 'synth bass', 'upright', '808'].includes(w)) return 'bass'
  if (/DUB|\bAD\b|ADLIB|HARM|CHORUS|BGV|BACKING|\bALT\b|CHOIR|DOUBLE|\bDBL\b|\bBV\b|CHOP|코러스|화음/.test(n) || ['backing', 'adlib', 'choir'].includes(w)) return 'bgv'
  if (/MAIN|\bWL\d|VOX|VOCAL|\bRAP\b|^LEAD 0\d/.test(n) || ['vox', 'rap'].includes(w)) return 'lead'
  if (/^(INTRO|VERSE|V\d|PRE|HOOK|BRIDGE|OUTRO|REFRAIN)[\s_\d*]*($|[\s_]\d|\*)/.test(n)) return 'lead'      // (his vocal stems named by the song's sections: Intro_1, V1_1, Pre_1, Hook 2_1)
  return 'other'
}
