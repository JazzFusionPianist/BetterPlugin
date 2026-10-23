/* ── the session tidied: what each track is, its name, its colour, its place ──
   His ask (2026-10-22): a producer's tracks are called audio 19, and forty of them come in at once; what each one is must
   be found, not typed. Each track is read by its own name, then by the names of its sounds' files (Bass DI.wav), then by
   its instrument's plug-in, and last by its sound: YAMNet (yamnet.js, in a worker of its own) hears a few seconds of it
   and says how much it is each of 521 kinds of sound, which TIDY_HEAR gathers into the instruments a track may be
   (TIDY_INST). Then, in one step back (his round of 2026-10-23, on a multitrack of 111 stems):
     a name that came with its file is only cleaned of what surely says nothing — an export's number, a track number, a
       sample pack's codes — and never renamed for what it is heard to be; a name of his own is kept as it is; what the
       track is is remembered (t.what), for the command line to find it by (say.js: sayKeys) and for its colour (t.tone);
     every file is stripped of silence in whole bars (silence.js), each against its own loudest, and a track left with no
       sound in it is taken out;
     the tracks stand in the order a session is read in: drums, bass, guitars, keys, the rest, voices, effects, and those
       of one family stand in a stack of their own (stacks, buses and what stands in a stack keep their places).
   Track > Tidy Tracks, or said: "tidy the tracks", "트랙 정리해줘". Read after say.js, mix.js and silence.js. */
const TIDY = { state: '', w: null, wait: new Map(), n: 0, classes: null }
for (const keep of [typeof KEEP_T !== 'undefined' ? KEEP_T : null, typeof T_KEEP !== 'undefined' ? T_KEEP : null]) if (keep && !keep.includes('what')) keep.push('what')      // (what a track was found to be: kept with the song, and in a step back)

/* ── the kinds of sound YAMNet knows, gathered into instruments: [stem, [[class, weight], …]] ── */
const TIDY_HEAR = [
  ['kick', [['Bass drum', 1]]], ['snare', [['Snare drum', 1], ['Rimshot', .6]]], ['hat', [['Hi-hat', 1]]], ['cymbal', [['Cymbal', 1]]],
  ['drums', [['Drum kit', 1], ['Drum machine', 1], ['Drum', .8], ['Drum roll', .6], ['Percussion', .45]]],
  ['perc', [['Wood block', .8], ['Tabla', .8], ['Gong', .6]]], ['cowbell', [['Cowbell', 1]]], ['shaker', [['Maraca', 1], ['Rattle (instrument)', .9]]], ['tambourine', [['Tambourine', 1]]],
  ['timpani', [['Timpani', 1]]], ['steel drum', [['Steelpan', 1]]], ['clap', [['Clapping', 1]]],
  ['bass', [['Bass guitar', 1]]], ['upright', [['Double bass', 1]]],
  ['gtr', [['Guitar', 1], ['Steel guitar, slide guitar', 1], ['Tapping (guitar technique)', .8], ['Strum', .8], ['Plucked string instrument', .45], ['Distortion', .3], ['Effects unit', .3]]],
  ['electric', [['Electric guitar', 1]]], ['acoustic', [['Acoustic guitar', 1]]], ['banjo', [['Banjo', 1]]], ['mandolin', [['Mandolin', 1]]], ['sitar', [['Sitar', 1]]], ['uke', [['Ukulele', 1]]],
  ['keys', [['Keyboard (musical)', .6]]], ['piano', [['Piano', 1]]], ['rhodes', [['Electric piano', 1]]], ['organ', [['Organ', 1], ['Hammond organ', 1]]], ['harpsichord', [['Harpsichord', 1]]],
  ['synth', [['Synthesizer', 1], ['Sampler', .5], ['Alarm', .5], ['Beep, bleep', .5], ['Buzzer', .4], ['Ringtone', .4]]], ['organ', [['Singing bowl', .5]]],
  ['strings', [['String section', 1], ['Bowed string instrument', .8], ['Pizzicato', .8], ['Orchestra', .6]]], ['violin', [['Violin, fiddle', 1]]], ['cello', [['Cello', 1]]], ['harp', [['Harp', 1]]],
  ['brass', [['Brass instrument', 1], ['Vehicle horn, car horn, honking', .6], ['Air horn, truck horn', .4]]], ['trumpet', [['Trumpet', 1]]], ['trombone', [['Trombone', 1]]], ['horn', [['French horn', 1]]],
  ['sax', [['Saxophone', 1]]], ['flute', [['Flute', 1]]], ['clarinet', [['Clarinet', 1]]], ['woodwinds', [['Wind instrument, woodwind instrument', .8]]], ['harmonica', [['Harmonica', 1]]], ['accordion', [['Accordion', 1]]],
  ['marimba', [['Marimba, xylophone', 1]]], ['glockenspiel', [['Glockenspiel', 1]]], ['vibes', [['Vibraphone', 1]]], ['bell', [['Bell', .6], ['Church bell', .4], ['Jingle bell', .4]]], ['chimes', [['Chime', .8], ['Wind chime', .5], ['Tubular bells', 1]]],
  ['vox', [['Singing', 1], ['Child singing', .8], ['Synthetic singing', .8], ['A capella', .8], ['Vocal music', .6], ['Humming', .7], ['Yodeling', .6]]],
  ['choir', [['Choir', 1]]], ['rap', [['Rapping', 1]]], ['narration', [['Narration, monologue', 1], ['Speech', .5]]],
  ['fx', [['Sound effect', .6]]], ['riser', [['Whoosh, swoosh, swish', .8]]], ['noise', [['White noise', 1], ['Pink noise', 1], ['Noise', .5], ['Static', .5]]],
]
/* the order a session is read in, and each instrument's family (the room's six pigments: engine.js) */
const TIDY_ORDER = ['kick', 'snare', 'hat', 'tom', 'overheads', 'cymbal', 'drums', 'clap', 'rim', 'perc', 'shaker', 'tambourine', 'conga', 'bongo', 'cajon', 'cowbell', 'triangle', 'timpani', 'steel drum',
  '808', 'sub bass', 'bass', 'synth bass', 'upright', 'gtr', 'electric', 'acoustic', 'nylon', 'banjo', 'mandolin', 'uke', 'sitar', 'keys', 'piano', 'rhodes', 'organ', 'clav', 'harpsichord', 'celesta',
  'synth', 'lead', 'pad', 'pluck', 'arp', 'bell', 'strings', 'violin', 'viola', 'cello', 'harp', 'orchestra', 'brass', 'trumpet', 'trombone', 'horn', 'tuba', 'sax', 'flute', 'clarinet', 'oboe', 'bassoon',
  'woodwinds', 'harmonica', 'accordion', 'marimba', 'vibes', 'xylophone', 'glockenspiel', 'chimes', 'kalimba', 'gayageum', 'geomungo', 'haegeum', 'daegeum', 'piri', 'janggu', 'kkwaenggwari', 'buk',
  'vox', 'backing', 'choir', 'rap', 'adlib', 'narration', 'vocoder', 'fx', 'riser', 'sweep', 'noise', 'foley']
const TIDY_FAM = s => ['kick', 'snare', 'hat', 'tom', 'overheads', 'cymbal', 'drums', 'clap', 'rim', 'perc', 'shaker', 'tambourine', 'conga', 'bongo', 'cajon', 'cowbell', 'triangle', 'timpani', 'steel drum', 'janggu', 'kkwaenggwari', 'buk'].includes(s) ? 'drums'
  : ['808', 'sub bass', 'bass', 'synth bass', 'upright'].includes(s) ? 'bass' : ['gtr', 'electric', 'acoustic', 'nylon', 'banjo', 'mandolin', 'uke', 'sitar'].includes(s) ? 'gtr'
  : ['vox', 'backing', 'choir', 'rap', 'adlib', 'narration', 'vocoder'].includes(s) ? 'vox' : ['fx', 'riser', 'sweep', 'noise', 'foley'].includes(s) ? 'fx' : s ? 'keys' : null
/* the instruments a track may be: what the app calls it (its stem, as say.js stems a track's words: a track called "lead
   vocal" answers to vox), what a track of it is named, and the english and korean words a name says it by (=word: the
   word alone, not inside another) */
const TIDY_INST = [
  ['vox', 'vocal', ['lead vocal', 'vocals', 'vocal', 'vox', 'voice'], ['메인보컬', '리드보컬', '보컬', '보칼', '목소리', '보이스', '노래', '가창', '=싱어']],
  ['backing', 'backing vocal', ['backing vocals', 'backing vocal', 'backing', 'bgv', 'harmonies'], ['백보컬', '코러스', '화음', '백킹', '배킹', '하모니']],
  ['choir', 'choir', ['choir'], ['콰이어', '합창', '성가대']], ['rap', 'rap', ['rapper', 'rap'], ['=랩', '래퍼']], ['adlib', 'adlib', ['adlibs', 'adlib'], ['애드립']],
  ['narration', 'narration', ['narration', 'voiceover', 'narrator'], ['내레이션', '나레이션', '보이스오버']],
  ['kick', 'kick', ['kick drum', 'kick', 'bd'], ['베이스드럼', '킥드럼', '킥', '베드']], ['snare', 'snare', ['snare'], ['스네어', '스내어', '스네']],
  ['hat', 'hats', ['hi-hats', 'hi-hat', 'hihats', 'hihat', 'hi hat', 'hats', 'hat'], ['하이햇', '하이헷', '하햇', '=햇']], ['tom', 'toms', ['toms', 'tom'], ['탐탐', '=탐', '=톰']],
  ['overheads', 'overheads', ['overheads', 'overhead'], ['오버헤드']], ['drums', 'drums', ['drum kit', 'drums', 'drum', 'kit'], ['드럼킷', '드럼즈', '드럼']],
  ['clap', 'clap', ['claps', 'clap'], ['클랩', '박수']], ['rim', 'rim', ['rimshot'], ['림샷', '=림']], ['cymbal', 'cymbals', ['cymbals', 'cymbal', 'crash', 'ride'], ['심벌즈', '심벌', '크래시', '라이드']],
  ['perc', 'percussion', ['percussion', 'perc'], ['퍼커션', '타악기']], ['shaker', 'shaker', ['shaker'], ['셰이커', '쉐이커']], ['tambourine', 'tambourine', ['tambourine', 'tamb'], ['탬버린']],
  ['conga', 'congas', ['congas', 'conga'], ['콩가']], ['bongo', 'bongos', ['bongos', 'bongo'], ['봉고']], ['cajon', 'cajon', ['cajon'], ['카혼']], ['cowbell', 'cowbell', ['cowbell'], ['카우벨']],
  ['triangle', 'triangle', ['triangle'], ['트라이앵글']], ['timpani', 'timpani', ['timpani'], ['팀파니']], ['808', '808', ['808'], []],
  ['synth bass', 'synth bass', ['synth bass', 'synthbass'], ['신스베이스', '신스 베이스']], ['upright', 'upright bass', ['upright bass', 'double bass', 'contrabass'], ['콘트라베이스', '더블베이스', '업라이트베이스']],
  ['sub bass', 'sub bass', ['sub bass'], ['서브베이스']], ['bass', 'bass', ['bass guitar', 'bass'], ['베이스기타', '베이스', '베이쓰']],
  ['electric', 'electric guitar', ['electric guitar'], ['일렉기타', '일렉']], ['acoustic', 'acoustic guitar', ['acoustic guitar'], ['통기타', '어쿠스틱기타', '어쿠스틱']],
  ['nylon', 'nylon guitar', ['nylon guitar', 'classical guitar'], ['클래식기타', '나일론기타']], ['gtr', 'guitar', ['guitars', 'guitar', 'gtr'], ['기타']],
  ['keys', 'keys', ['keyboards', 'keyboard', 'keys'], ['건반', '키보드', '키즈']], ['piano', 'piano', ['grand piano', 'piano'], ['그랜드피아노', '피아노']],
  ['rhodes', 'rhodes', ['electric piano', 'e-piano', 'rhodes', 'wurlitzer', 'wurli'], ['일렉피아노', '로즈', '워리처']], ['organ', 'organ', ['hammond', 'organ', 'b3'], ['오르간', '하몬드']],
  ['clav', 'clavinet', ['clavinet', 'clav'], ['클라비넷']], ['harpsichord', 'harpsichord', ['harpsichord'], ['하프시코드', '쳄발로']], ['celesta', 'celesta', ['celesta'], ['첼레스타']],
  ['lead', 'lead synth', ['lead synth', 'synth lead'], ['리드신스', '리드 신스']], ['synth', 'synth', ['synthesizer', 'synths', 'synth'], ['신시사이저', '신디', '신스', '씬스']],
  ['pad', 'pad', ['pads', 'pad'], ['패드']], ['pluck', 'pluck', ['plucks', 'pluck'], ['플럭']], ['arp', 'arp', ['arpeggiator', 'arpeggio', 'arp'], ['아르페지오', '아르프']], ['bell', 'bells', ['bells'], ['=벨', '종소리']],
  ['strings', 'strings', ['string section', 'strings'], ['스트링', '현악']], ['violin', 'violin', ['violins', 'violin', 'fiddle'], ['바이올린']], ['viola', 'viola', ['viola'], ['비올라']],
  ['cello', 'cello', ['cellos', 'cello'], ['첼로']], ['harp', 'harp', ['harp'], ['=하프']], ['orchestra', 'orchestra', ['orchestra'], ['오케스트라', '오케']],
  ['brass', 'brass', ['horn section', 'brass'], ['브라스', '금관']], ['trumpet', 'trumpet', ['trumpets', 'trumpet'], ['트럼펫', '트렘펫']], ['trombone', 'trombone', ['trombones', 'trombone'], ['트롬본']],
  ['horn', 'horn', ['french horn', 'horns', 'horn'], ['프렌치호른', '호른']], ['tuba', 'tuba', ['tuba'], ['튜바']],
  ['sax', 'sax', ['saxophone', 'alto sax', 'tenor sax', 'sax'], ['알토색소폰', '테너색소폰', '색소폰', '섹소폰', '색소']], ['flute', 'flute', ['flutes', 'flute'], ['플루트', '플룻']],
  ['clarinet', 'clarinet', ['clarinet'], ['클라리넷']], ['oboe', 'oboe', ['oboe'], ['오보에']], ['bassoon', 'bassoon', ['bassoon'], ['바순']], ['woodwinds', 'woodwinds', ['woodwinds'], ['목관']],
  ['marimba', 'marimba', ['marimba'], ['마림바']], ['vibes', 'vibraphone', ['vibraphone', 'vibes'], ['비브라폰']], ['xylophone', 'xylophone', ['xylophone'], ['실로폰']],
  ['glockenspiel', 'glockenspiel', ['glockenspiel', 'glock'], ['글로켄슈필', '글로켄']], ['chimes', 'chimes', ['tubular bells', 'chimes'], ['튜블러벨', '차임']], ['kalimba', 'kalimba', ['kalimba'], ['칼림바']],
  ['steel drum', 'steel drum', ['steel drum', 'steelpan'], ['스틸드럼', '스틸팬']], ['uke', 'ukulele', ['ukulele', 'uke'], ['우쿨렐레']], ['mandolin', 'mandolin', ['mandolin'], ['만돌린']],
  ['banjo', 'banjo', ['banjo'], ['밴조']], ['sitar', 'sitar', ['sitar'], ['시타르']], ['accordion', 'accordion', ['accordion'], ['아코디언']], ['harmonica', 'harmonica', ['harmonica'], ['하모니카']],
  ['gayageum', 'gayageum', ['gayageum'], ['가야금']], ['geomungo', 'geomungo', ['geomungo'], ['거문고']], ['haegeum', 'haegeum', ['haegeum'], ['해금']], ['daegeum', 'daegeum', ['daegeum'], ['대금']],
  ['piri', 'piri', ['piri'], ['=피리']], ['janggu', 'janggu', ['janggu'], ['장구']], ['kkwaenggwari', 'kkwaenggwari', [], ['꽹과리']], ['buk', 'buk', [], ['=북']],
  ['fx', 'fx', ['effects', 'sfx', 'fx'], ['이펙트', '효과음']], ['riser', 'riser', ['uplifter', 'riser'], ['업리프터', '라이저']], ['sweep', 'sweep', ['sweep'], ['스윕']],
  ['noise', 'noise', ['white noise', 'noise'], ['화이트노이즈', '노이즈']], ['foley', 'foley', ['foley'], ['폴리']], ['vocoder', 'vocoder', ['vocoder'], ['보코더']],
]
const tidyName = s => (TIDY_INST.find(e => e[0] === s) || [s, s])[1]

/* ── by words: a name, a file's name, a plug-in's ── */
const tidyEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const tidyEnRe = w => { const x = w[0] === '=', ws = (x ? w.slice(1) : w).split(' ').map(tidyEsc).join('\\s+'); return new RegExp(`(?:^|[^a-z'])(${ws}${x || /\s/.test(w) ? '' : '(?:s|es)?'})(?![a-z])`, 'g') }
const tidyKoRe = w => w[0] === '=' ? new RegExp(`(?:^|[^가-힣])(${tidyEsc(w.slice(1))})(?=$|[^가-힣])`, 'g') : new RegExp(`(?:^|[^가-힣])(${w.split(' ').map(tidyEsc).join('\\s*')})`, 'g')
/* shorthand written with its last letter held, as names are typed in a hurry: eppp is an ep, egg an eg (his multitrack,
   2026-10-23) — not oh (overheads), which held is a word sung */
const TIDY_HELD = new Set(['hh', 'snr', 'bv', 'eg', 'ep', 'kik', 'tmb', 'gt'])
const tidyHeldRe = w => new RegExp(`(?:^|[^a-z'])(${tidyEsc(w)}${tidyEsc(w.slice(-1))}*)(?![a-z])`, 'g')
/* words that say what a track is only when nothing else in its name does: lead alone is a lead synth (his word,
   2026-10-23), but lead vocals are vocals and lead guitar a guitar; a fill is drums, but a pad fill a pad */
const TIDY_WEAK = new Set(['lead', 'fill'])
const TIDY_WORDS = TIDY_INST.flatMap(([v, , en, ko]) => [...en.map(w => ({ v, w, re: tidyEnRe(w), n: w.length })), ...ko.map(w => ({ v, w, re: tidyKoRe(w), n: w.length }))])
  .concat([['hh', 'hat'], ['snr', 'snare'], ['ld vox', 'vox'], ['bv', 'backing'], ['ac gtr', 'acoustic'], ['eg', 'electric'], ['ep', 'rhodes'], ['kik', 'kick'], ['oh', 'overheads'], ['tmb', 'tambourine'],
    ['ele gt', 'electric'], ['ele', 'electric'], ['gt', 'gtr'], ['rim', 'rim'], ['fill', 'drums'], ['stinger', 'fx'], ['lead', 'lead']].map(([w, v]) => ({ v, w, re: TIDY_HELD.has(w) ? tidyHeldRe(w) : tidyEnRe('=' + w), n: w.length, weak: TIDY_WEAK.has(w) })))      // (ele gt, rim, fill, stinger, lead: what his multitrack of 2026-10-23 said and was not read)
  .sort((a, b) => b.n - a.n)
function tidyByWords (str) {
  const s = ' ' + String(str || '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()      // (PowerUpStinger is power up stinger).replace(/[_\-.()[\]]+/g, ' ').replace(/([a-z])(\d)/g, '$1 $2').replace(/\s+/g, ' ').trim() + ' '
  /* the longest words first, none inside one found already; the first of them in the name says what it is */
  const taken = [], found = []
  for (const p of TIDY_WORDS) {
    p.re.lastIndex = 0
    let m
    while ((m = p.re.exec(s))) { const at = m.index + m[0].length - m[1].length, end = m.index + m[0].length; if (!taken.some(([x, y]) => at < y && end > x)) { found.push({ v: p.v, at, weak: p.weak }); taken.push([at, end]) } p.re.lastIndex = m.index + 1 }
  }
  const strong = found.filter(f => !f.weak)
  return found.length ? (strong.length ? strong : found).sort((x, y) => x.at - y.at)[0].v : null
}
/* a plug-in's name in a track's name: a producer's stems are called after the instrument that played them (astra 06,
   serum 02, keyscape 05). What it is then is that instrument's kind; its sound may only say which of the kinds that
   instrument plays (his corrections, 2026-10-23: astra heard as drums, as a flute, as brass is a synth; omnisphere
   heard as a guitar, astra as a bass, serum as a rhodes are what they were heard to be). [names, kind, the stacks the sound may take it to] */
const TIDY_PLUGS = [
  [['astra', 'serum', 'vital', 'massive', 'massive x', 'sylenth', 'sylenth1', 'spire', 'pigments', 'diva', 'phase plant', 'hive', 'avenger', 'zebra', 'zebra2', 'omnisphere', 'nexus', 'es2', 'alchemy', 'retro synth', 'analog lab', 'repro', 'dune', 'synthmaster', 'surge', 'icarus', 'kontour', 'minimoog', 'jup-8000', 'obxd', 'helm'], 'synth', ['bass', 'keys', 'guitars', 'synths']],
  [['keyscape', 'pianoteq', 'noire', 'ivory', 'una corda', 'lounge lizard', 'grandeur', 'the gentleman', 'mark i'], 'keys', ['keys']],
  [['addictive drums', 'superior drummer', 'ezdrummer', 'ez drummer', 'battery', 'ssd5', 'bfd', 'drum kit designer', 'ultrabeat'], 'drums', ['drums']],
]
const TIDY_PLUG_RE = TIDY_PLUGS.map(([ws, v, may]) => [ws.map(w => tidyEnRe('=' + w)), v, may])
function tidyPlugOf (str) {
  const s = ' ' + String(str || '').toLowerCase().replace(/[_.()[\]]+/g, ' ').replace(/\s+/g, ' ').trim() + ' '
  for (const [res, v, may] of TIDY_PLUG_RE) if (res.some(re => { re.lastIndex = 0; return re.test(s) })) return { v, may }
  return null
}
/* a name that says nothing of what is in the track: the DAW's own (audio 19, inst 3, track 2, bus 4), or nothing but a number or a take */
const tidyBare = name => /^\s*(audio|inst|instrument|track|mono|stereo|오디오|트랙|인스트|untitled|new track|bounce|print|take|comp|rec|recording|voice memo)?[\s_\-#.]*\d*(\s*[._\-]\s*\d+)*\s*(take\s*\d+)?\s*$/i.test(String(name || ''))

/* ── names: only what can surely go (his word, 2026-10-23: "정말 '지워도 된다고' 판단되는 것들만") ──
   What a track is heard to be does not name it (a track called other may well hold a kick; an omnisphere preset may well
   be a guitar): a name is only cleaned of what says nothing — the number a DAW puts after every stem it hands out
   (" - 0095", where most of the files have one), a track's number in front ("0 lead vocals", "12_subdrop", where several
   files are numbered so, and only where the name stays its own), and a sample pack's codes in front of what the sound is
   ("KSHMR_sok5_", "DS_BPE_", with the tempo the sample was made at). Everything else stays as it was written: chorus 1L
   is still chorus 1L, lead vocals-04 (d) keeps its -04 and its (d). A name typed by hand is never touched. */
const TIDY_TAIL = / - \d{3,5}$/, TIDY_NUM = /^\d{1,2}[ _](?=\S)/
const TIDY_NUM_KEEP = /^\d{1,2}[ _](shots?|bars?|beats?|steps?|osc|ways?|bands?|parts?|bits?|strings?|voices?)\b/i      // (1 shot kick, 4 bars loop: the number is part of the name)
/* a sample pack's name: words joined by _, the pack's codes first — in capitals, or a short code with a figure in it right
   after them — then perhaps the tempo it was made at; what follows says what the sound is */
function tidyPack (s) {
  if (/\s/.test(s) || (s.match(/_/g) || []).length < 2) return s                          // (spaces: a name someone wrote)
  const tok = s.split('_'), caps = w => /^[A-Z0-9]{1,9}$/.test(w) && /[A-Z]/.test(w) && !tidyByWords(w)      // (a word that says an instrument is no code: VOX_LEAD stays)
  let i = 0
  while (i < tok.length - 1 && i < 4 && (caps(tok[i]) || (i && /^[a-z0-9]{2,6}$/i.test(tok[i]) && /\d/.test(tok[i]) && /[a-z]/i.test(tok[i]) && !tidyByWords(tok[i])))) i++
  if (!i) return s
  if (i < tok.length - 1 && /^\d{2,3}$/.test(tok[i]) && +tok[i] >= 60 && +tok[i] <= 200) i++
  const rest = tok.slice(i)
  if (!rest.some(w => /[a-z]/.test(w))) return s                                            // (all of it in capitals: no telling the codes from the words)
  return rest.join(' ').replace(/\s+/g, ' ').trim()
}
/* the names of a batch of files (what the evidence is: many of them numbered, most of them with an export's number) → what each is called */
function tidyClean (bases) {
  const tails = bases.filter(b => TIDY_TAIL.test(b)).length >= Math.max(2, bases.length * .5), nums = bases.filter(b => TIDY_NUM.test(b)).length >= 3
  const one = bases.map(b => tidyPack(tails ? String(b).trim().replace(TIDY_TAIL, '') : String(b).trim()))
  const two = one.map(x => nums && TIDY_NUM.test(x) && !TIDY_NUM_KEEP.test(x) ? x.replace(TIDY_NUM, '') : x)
  const seen = new Map(); two.forEach(x => seen.set(x.toLowerCase(), (seen.get(x.toLowerCase()) || 0) + 1))
  return new Map(bases.map((b, i) => [b, (two[i] !== one[i] && seen.get(two[i].toLowerCase()) > 1 ? one[i] : two[i]) || b]))      // (1 drums and 2 drums keep their numbers: without them they are one name)
}
/* a file's own name as it came: the region's name keeps every mark of it (F#min) but not its capitals, the copy in the
   project keeps the capitals (the pack's codes are told by them) but not every mark — # is dropped from a file's name —
   so it is written out of the one with the other's capitals */
const TIDY_EXT = /\.(wav|aiff?|caf|mp3|m4a|flac|ogg)$/i
function tidyFileBase (r) {
  const said = String(r.name || '').replace(TIDY_EXT, ''), file = String(r.file || '').replace(/^.*\//, '').replace(TIDY_EXT, '')
  if (!said || !file) return said || file
  let out = '', j = 0
  for (const c of said) { if (j < file.length && file[j].toLowerCase() === c) out += file[j++]; else out += c }
  return out
}

/* ── the stacks the tidied tracks stand in, one to a family (his ask, 2026-10-23): by what each is, heard or read — a
   track called other that is heard as a kick stands with the drums ── */
const TIDY_STACKS = ['drums', 'bass', 'guitars', 'keys', 'synths', 'strings', 'brass', 'winds', 'vox', 'fx']
function tidyStackOf (w) {
  if (!w) return null
  const f = TIDY_FAM(w)
  if (f === 'drums' || f === 'bass' || f === 'vox' || f === 'fx') return f
  if (f === 'gtr') return 'guitars'
  if (['synth', 'lead', 'pad', 'pluck', 'arp', 'bell'].includes(w)) return 'synths'
  if (['strings', 'violin', 'viola', 'cello', 'harp', 'orchestra', 'gayageum', 'geomungo', 'haegeum'].includes(w)) return 'strings'
  if (['brass', 'trumpet', 'trombone', 'horn', 'tuba', 'sax'].includes(w)) return 'brass'
  if (['flute', 'clarinet', 'oboe', 'bassoon', 'woodwinds', 'harmonica', 'accordion', 'daegeum', 'piri'].includes(w)) return 'winds'
  return 'keys'
}

/* ── by sound: YAMNet, in a worker ── */
const TIDY_WORKER = `
let M = null
onmessage = e => {
  const d = e.data
  if (d.init) { M = YAM_MODEL(d.model); postMessage({ id: d.id, ok: true }); return }
  const out = new Float32Array(M.T['fc.b'].length); let n = 0
  for (const pcm of d.parts) { const r = yamScores(M, pcm); for (const p of r.pieces) { for (let i = 0; i < out.length; i++) out[i] += p[i]; n++ } }
  for (let i = 0; i < out.length; i++) out[i] /= Math.max(1, n)
  postMessage({ id: d.id, scores: out, pieces: n, pitch: tidyPitch(d.parts), flat: tidyFlat(d.parts) }, [out.buffer])
}`
const tidyAsk = d => new Promise(res => { const id = ++TIDY.n; TIDY.wait.set(id, res); TIDY.w.postMessage(Object.assign({ id }, d), d.model ? [d.model] : []) })
async function tidyStart () {
  if (TIDY.state === 'ready') return true
  if (TIDY.state === 'none') return false
  if (TIDY.starting) return TIDY.starting
  TIDY.starting = (async () => {
    try {
      const get = async (u, k) => { const r = await fetch(u); if (!r.ok) throw new Error(u); return k === 'b' ? r.arrayBuffer() : k === 'j' ? r.json() : r.text() }
      const [code, model, classes] = await Promise.all([get('yamnet.js'), get('yamnet/model.bin', 'b'), get('yamnet/classes.json', 'j')])
      TIDY.classes = classes
      try { TIDY.ear = await get('tidy-ear.json', 'j') } catch (e) { TIDY.ear = null }      // (the trained ear; without it the evidence alone decides, as before)
      TIDY.w = new Worker(URL.createObjectURL(new Blob([code + '\n' + tidyPitch + '\n' + tidyFlat + TIDY_WORKER], { type: 'text/javascript' })))      // (how pitched and how noise-like are measured there too, off the window's thread)
      TIDY.w.onmessage = e => { const f = TIDY.wait.get(e.data.id); if (f) { TIDY.wait.delete(e.data.id); f(e.data) } }
      TIDY.w.onerror = () => { TIDY.state = 'none' }
      await tidyAsk({ init: true, model })
      TIDY.state = 'ready'
    } catch (e) { TIDY.state = 'none' }
    TIDY.starting = null
    return TIDY.state === 'ready'
  })()
  return TIDY.starting
}
/* a few seconds of a track, where it sounds: from the app (its sounds' buffers, as they are), else as the page plays it */
const TIDY_SEC = 2, TIDY_PARTS = 3
const tidyRms = a => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i]; return Math.sqrt(s / Math.max(1, a.length)) }
/* the starts (seconds) of up to eight stretches of TIDY_SEC where a file is loudest, none over another: from how loud it
   is along its length (silence.js), the sum of each stretch's steps, in power */
function tidyLoudest (L, len) {
  const per = Math.max(1, Math.round(TIDY_SEC / L.hop)), n = L.lv.length, pw = new Float64Array(n + 1)
  for (let i = 0; i < n; i++) pw[i + 1] = pw[i] + (L.lv[i] >= 255 ? 0 : Math.pow(10, -L.lv[i] / 20))      // (half decibels down: a step's power)
  const at = []
  for (let i = 0; i + per <= n; i += Math.max(1, per >> 2)) at.push([pw[i + per] - pw[i], i])
  at.sort((x, y) => y[0] - x[0])
  const out = []
  for (const [p, i] of at) { if (p <= 0 || out.length >= 8) break; if (out.every(j => Math.abs(j - i) >= per)) out.push(i) }
  return out.map(i => Math.min(Math.max(0, len - TIDY_SEC), i * L.hop))
}
async function tidySound (t) {
  const regs = (t.regs || []).filter(r => !r.missing && (NAT ? !r.notes && (r.key || (r.loop && r.buf)) : true)).sort((a, b) => (b.sec || b.b - b.a) - (a.sec || a.b - a.a))      // (the app hears its sounds' buffers, a loop's too; a page, what it plays: notes too)
  const parts = []
  if (NAT) {
    for (const r of regs.slice(0, 2)) {
      const key = r.key || r.buf, len = r.sec || (typeof LOOPS === 'object' && LOOPS[r.buf] && LOOPS[r.buf].sec) || (r.b - r.a) * SPB()
      /* where it is loudest (a stem may sound in one bar of sixty: eight even places in it heard nothing of 4 other, his
         multitrack 2026-10-23), else eight even places */
      const L = r.key && typeof silLevels === 'function' ? await silLevels(r.key) : null
      const cand = L ? tidyLoudest(L, len) : []
      for (let k = 1; k <= 8 && len > TIDY_SEC && !cand.length; k++) cand.push((len - TIDY_SEC) * k / 9)
      if (!cand.length) cand.push(0)
      for (const from of cand) {
        const p = await NAT.call('pcm', { key, from, sec: TIDY_SEC })
        if (!p || !p.ok || !p.n) continue
        const bin = atob(p.pcm), a = new Float32Array(bin.length >> 1)
        for (let i = 0; i < a.length; i++) { const v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8); a[i] = (v & 0x8000 ? v - 0x10000 : v) / 32768 }
        parts.push({ a, rate: p.rate, rms: tidyRms(a) })
      }
      if (parts.length >= TIDY_PARTS * 2) break
    }
  } else if (typeof renderStem === 'function' && regs.length) {                                // (a browser: the track as the page plays it, dry, where its sound is)
    const r = regs[0], a0 = r.a - 1, a1 = Math.min(r.b - 1, a0 + 8), buf = await renderStem(t, a0, a1, 'dry'), L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L, step = Math.round(buf.sampleRate * TIDY_SEC)
    for (let at = 0; at + step <= buf.length; at += step) { const a = new Float32Array(step); for (let i = 0; i < step; i++) a[i] = (L[at + i] + R[at + i]) / 2; parts.push({ a, rate: buf.sampleRate, rms: tidyRms(a) }) }
  }
  const loud = parts.filter(p => p.rms > 1e-3).sort((x, y) => y.rms - x.rms).slice(0, TIDY_PARTS)
  return loud.map(p => yamTo16k(p.a, p.rate))
}
/* ── what the scores come to (pure: the tests run it on loops whose names say what they are) ── */
/* how much of a sound lies under 150 hz (a synth that is a bass, an 808): one pole, the energy below against the whole */
function tidyLow (parts) { let lo = 0, all = 0; const k = 1 - Math.exp(-2 * Math.PI * 150 / 16000); for (const a of parts) { let y = 0; for (let i = 0; i < a.length; i++) { y += k * (a[i] - y); lo += y * y; all += a[i] * a[i] } } return all > 0 ? lo / all : 0 }
/* how much lies over 5 khz (hats, cymbals): the power of 512-sample frames above it, against all of theirs */
function tidyHigh (parts) {
  let hi = 0, all = 0
  const re = new Float32Array(512), im = new Float32Array(512)
  for (const a of parts) for (let at = 0; at + 512 <= a.length; at += 512) {
    for (let i = 0; i < 512; i++) { re[i] = a[at + i] * (.5 - .5 * Math.cos(2 * Math.PI * i / 511)); im[i] = 0 }
    yamFFT(re, im)
    for (let k = 1; k < 256; k++) { const p = re[k] * re[k] + im[k] * im[k]; all += p; if (k * 16000 / 512 >= 5000) hi += p }
  }
  return all > 0 ? hi / all : 0
}
/* how far its peaks stand over its body (a kick's far, a held bass's not): the loudest sample against the rms, in db */
function tidyCrest (parts) { let pk = 0, q = 0, n = 0; for (const a of parts) for (let i = 0; i < a.length; i++) { const v = Math.abs(a[i]); if (v > pk) pk = v; q += v * v; n++ } return n && q ? 20 * Math.log10(pk / Math.sqrt(q / n)) : 0 }
/* how struck it is: peaks a second — a level, 10 ms at a time, at its highest for 50 ms either way, 10 db over the middle
   of the sound and within 24 of its loudest, 100 ms apart at least (a kick with a long tail is struck; a held bass is not) */
function tidyStruck (parts) {
  let hits = 0, sec = 0
  for (const a of parts) {
    const n = Math.floor(a.length / 160), e = new Float32Array(n)
    for (let f = 0; f < n; f++) { let q = 0; for (let i = 0; i < 160; i++) { const v = a[f * 160 + i]; q += v * v } e[f] = 10 * Math.log10(q / 160 + 1e-12) }
    let top = -Infinity; for (let f = 0; f < n; f++) if (e[f] > top) top = e[f]
    const live = Array.from(e).filter(v => v > top - 50).sort((x, y) => x - y), mid = live.length ? live[live.length >> 1] : top
    sec += n / 100
    let last = -100
    for (let f = 0; f < n; f++) {
      if (e[f] < mid + 10 || e[f] < top - 24 || f - last < 10) continue
      let peak = true; for (let k = Math.max(0, f - 5); k <= Math.min(n - 1, f + 5); k++) if (e[k] > e[f]) { peak = false; break }
      if (peak) { hits++; last = f }
    }
  }
  return sec ? hits / sec : 0
}
const TIDY_GENRE = ['Electronic music', 'House music', 'Techno', 'Electronica', 'Electronic dance music', 'Dubstep', 'Trance music', 'Ambient music', 'New-age music', 'Drum and bass', 'Dance music', 'Hip hop music']
/* the instruments a sound is heard as, best first ([[stem, score], …]): the kinds of sound gathered (TIDY_HEAR); a bass where
   a guitar and a bass are near and it lives low; and where it is heard only as music of a kind, by how it is struck and how low */
function tidyPick (scores, classes, low, struck, high = 0, crest = 0) {
  const hit = struck >= 1.5 || crest >= 16                                                    // (struck: hits a second, or peaks far over the body)
  const idx = new Map(classes.map((c, i) => [c, i])), at = c => { const i = idx.get(c); return i == null ? 0 : scores[i] }, out = []
  for (const [v, cl] of TIDY_HEAR) { let best = 0; for (const [c, w] of cl) best = Math.max(best, at(c) * w); if (best > 0) out.push([v, best]) }
  out.sort((a, b) => b[1] - a[1])
  if (out.length && out[0][1] >= .03) {
    const bass = out.find(x => x[0] === 'bass')
    if (bass && bass !== out[0] && TIDY_FAM(out[0][0]) === 'gtr' && bass[1] >= out[0][1] * .7 && low > .45) return [['bass', out[0][1]]].concat(out)      // (a bass heard as a guitar: it lives lower)
    if (['synth', 'keys', 'organ'].includes(out[0][0]) && low > .55 && !hit) return [['synth bass', out[0][1]]].concat(out)      // (a synth that lives under 150 hz is a bass)
    if (['drums', 'perc'].includes(out[0][0])) { const one = low > .6 ? 'kick' : high > .45 && low < .1 ? 'hat' : low < .3 && high < .25 && (struck >= 1 || crest >= 16) ? 'snare' : null; if (one) return [[one, out[0][1]]].concat(out) }      // (one drum alone, told by where it lives: a kick low, a hat high, a snare in the middle and struck; the rest a kit)
    return out
  }
  const genre = Math.max(...TIDY_GENRE.map(at))
  if (hit) return [[low > .6 ? 'kick' : high > .45 && low < .1 ? 'hat' : 'drums', .05]].concat(out)
  if (low > .55) return [['synth bass', .05]].concat(out)
  if (genre >= .03) return [['synth', .05]].concat(out)
  return out
}
/* ── the trained ear (his ask, 2026-10-23: the corrections he gave were for the ear to classify better, not to be written
   in one by one; "아리까리 하면 나한테 들려주고 … machine learning이 돼서") ──
   Which family a sound is: a softmax over YAMNet's evidence for 56 kinds of sound (their logs) and six measures of the
   sound itself — how pitched, how noise-like, how much of it lives low and high, how struck, how far its peaks stand out
   — learnt from his own projects: tracks named for what they are, and the ones he told by ear on the listening page.
   Nothing it learnt from ships but its numbers (ui/tidy-ear.json, made by tools/tidy-ear.mjs). Measured on songs it never
   heard, on Apple Loops (only ever used to measure) and on a multitrack of 111 stems: see tools/tidy-ear.mjs. Within the
   family, YAMNet's evidence says which instrument (a kick, a hat, an organ). */
/* how pitched: YIN's clearest period (60 to 1000 Hz) in 64 ms frames that carry sound — 1 a pure tone, 0 noise */
function tidyPitch (parts, sr = 16000) {
  const W = 1024, H = 512, minL = Math.floor(sr / 1000), maxL = Math.floor(sr / 60), d = new Float32Array(maxL + 1)
  let all = 0, cnt = 0
  for (const a of parts) {
    let sum = 0, n = 0, top = 0
    for (let i = 0; i < a.length; i++) top = Math.max(top, Math.abs(a[i]))
    for (let s = 0; s + W + maxL < a.length; s += H) {
      let e = 0; for (let i = 0; i < W; i++) e += a[s + i] * a[s + i]
      if (Math.sqrt(e / W) < top * .05) continue
      let run = 0, best = 1
      for (let L = 1; L <= maxL; L++) { let q = 0; for (let i = 0; i < W; i++) { const x = a[s + i] - a[s + i + L]; q += x * x } d[L] = q; run += q; const c = run > 0 ? q * L / run : 1; if (L >= minL && c < best) best = c }
      sum += 1 - Math.min(1, best); n++
    }
    all += n ? sum / n : 0; cnt++
  }
  return cnt ? all / cnt : 0
}
/* how noise-like: the spectrum's flatness (geometric over arithmetic mean of the power, 2048-point frames) — near 1 noise, near 0 a tone */
function tidyFlat (parts) {
  const N = 2048, re = new Float32Array(N), im = new Float32Array(N)
  let all = 0, cnt = 0
  for (const a of parts) {
    let sum = 0, n = 0, top = 0
    for (let i = 0; i < a.length; i++) top = Math.max(top, Math.abs(a[i]))
    for (let s = 0; s + N <= a.length; s += N) {
      let e = 0; for (let i = 0; i < N; i++) { re[i] = a[s + i] * (.5 - .5 * Math.cos(2 * Math.PI * i / (N - 1))); im[i] = 0; e += a[s + i] * a[s + i] }
      if (Math.sqrt(e / N) < top * .05) continue
      yamFFT(re, im)
      let lg = 0, ar = 0
      for (let k = 4; k < N / 2; k++) { const p = re[k] * re[k] + im[k] * im[k] + 1e-12; lg += Math.log(p); ar += p }
      const m = N / 2 - 4; sum += Math.exp(lg / m) / (ar / m); n++
    }
    all += n ? sum / n : 1; cnt++
  }
  return cnt ? all / cnt : 1
}
/* the family a sound is, by the trained ear: [[family, chance], …] best first. f: { scores, low, high, struck, crest, pitch, flat } */
function tidyEar (f, classes, ear) {
  const idx = new Map(classes.map((c, i) => [c, i])), x = ear.kinds.map(k => Math.log(1e-4 + (f.scores[idx.get(k)] || 0))).concat([f.pitch, Math.log(1e-4 + f.flat), f.low, f.high, Math.min(6, f.struck), f.crest / 10])
  const z = x.map((v, j) => (v - ear.mu[j]) / ear.sd[j]), s = ear.W.map(w => w[ear.d] + z.reduce((a, v, j) => a + v * w[j], 0)), mx = Math.max(...s), e = s.map(v => Math.exp(v - mx)), t = e.reduce((a, b) => a + b, 0)
  return ear.stacks.map((st, k) => [st, e[k] / t]).sort((a, b) => b[1] - a[1])
}
const TIDY_FAMILY_STEM = { drums: 'drums', bass: 'bass', guitars: 'gtr', keys: 'keys', synths: 'synth', strings: 'strings', horns: 'brass', vox: 'vox', fx: 'fx' }
const tidyFamilyOf = v => { const s = tidyStackOf(v); return s === 'brass' || s === 'winds' ? 'horns' : s }
/* the instruments a sound is, best first ([[stem, chance], …]): the family by the trained ear, then the instrument in it by
   YAMNet's evidence (a lone drum told by where it lives: a kick low, a hat high, a snare in the middle and struck); none
   when the ear is not sure of any family */
function tidyWhatBySound (f, classes, ear) {
  const fam = tidyEar(f, classes, ear)
  if (fam[0][1] < .3) return []
  const idx = new Map(classes.map((c, i) => [c, i])), at = c => { const i = idx.get(c); return i == null ? 0 : f.scores[i] }, ev = []
  for (const [v, cl] of TIDY_HEAR) { let b = 0; for (const [c, w] of cl) b = Math.max(b, at(c) * w); if (b > 0) ev.push([v, b]) }
  ev.sort((a, b) => b[1] - a[1])
  return fam.map(([st, p]) => {
    let v = (ev.find(([w]) => tidyFamilyOf(w) === st) || [TIDY_FAMILY_STEM[st]])[0]
    if (st === 'drums' && (v === 'drums' || v === 'perc')) v = f.low > .6 ? 'kick' : f.high > .45 && f.low < .1 ? 'hat' : f.low < .3 && f.high < .25 && (f.struck >= 1 || f.crest >= 16) ? 'snare' : v
    if (st === 'bass' && v === 'bass' && at('Bass guitar') < .03) v = 'synth bass'
    return [v, p]
  })
}
/* the instruments a track sounds like, best first: [[stem, score], …] */
async function tidyHear (t) {
  if (!(await tidyStart())) return null
  const parts = await tidySound(t)
  if (!parts.length) return []
  const r = await tidyAsk({ parts }), low = tidyLow(parts), high = tidyHigh(parts), struck = tidyStruck(parts), crest = tidyCrest(parts)
  const out = TIDY.ear ? tidyWhatBySound({ scores: r.scores, low, high, struck, crest, pitch: r.pitch != null ? r.pitch : tidyPitch(parts), flat: r.flat != null ? r.flat : tidyFlat(parts) }, TIDY.classes, TIDY.ear) : tidyPick(r.scores, TIDY.classes, low, struck, high, crest)
  out.low = low; out.high = high; out.struck = struck; out.crest = crest
  return out
}

/* ── what a track is ── */
async function trackWhat (t) {
  if (t.kind !== 'audio' || t.theirs) return null
  let v = tidyByWords(t.name)
  if (v) return { what: v, by: 'name' }
  for (const r of t.regs || []) { v = tidyByWords(String(r.file || '').replace(/^.*\//, '')) || tidyByWords(r.tag) || tidyByWords(r.name); if (v) return { what: v, by: 'file' } }
  /* named after the instrument that played it: that instrument's kind, which its sound may only narrow */
  const pl = tidyPlugOf(t.name) || (t.regs || []).map(r => tidyPlugOf(tidyFileBase(r))).find(Boolean)
  if (pl) {
    const heard = await tidyHear(t), top = heard && heard.length && heard[0][1] >= .03 ? heard[0][0] : null
    return top && pl.may.includes(tidyStackOf(top)) ? { what: top, by: 'plug-in name, sound', sure: heard[0][1], heard: heard.slice(0, 3) } : { what: pl.v, by: 'plug-in name' }
  }
  if (t.inst) { const ins = (t.inserts || []).find(i => i.inst) || null; v = tidyByWords(ins && ins.name) || ({ drums: 'drums', piano: 'piano', synth: 'synth', bass: 'synth bass' })[t.inst.kind] || null; if (v) return { what: v, by: 'plug-in' } }
  const heard = await tidyHear(t)
  if (heard && heard.length && heard[0][1] >= .03) return { what: heard[0][0], by: 'sound', sure: heard[0][1], heard: heard.slice(0, 3), low: heard.low, high: heard.high, struck: heard.struck, crest: heard.crest }
  return null
}

/* ── tidied ──
   In one step back: each track's name cleaned (above); what it is remembered (t.what, its colour t.tone); every file of
   sound stripped of silence in whole bars, each against its own loudest (a quiet part is not silence: a part 43 dB down
   is kept), and a track left with no sound at all taken out; the tracks that stand alone put in the order a session is
   read in, and those of one family, two or more, into a stack of their own. Stacks, buses and what already stands in a
   stack keep their places.
   With several tracks chosen (his ask, 2026-10-24: "일부 트랙을 선택해서 … 그 선택된 트랙만 … 아예 분리되게"), only they are
   tidied: they leave the stacks they stood in and stand together where the first of them stood, those of a family in a
   stack of their own — never the stacks already there, whatever those are called; a stack they leave with nothing in it
   goes too. A chosen stack stands for what is in it. ⌃T, Track > Tidy Tracks, or said. */
const tidyStackName = f => { let nm = f, k = 2; while (S.tracks.some(t => t.kind === 'stack' && t.name === nm)) nm = `${f} ${k++}`; return nm }
async function tidyTracks () {
  if (S.playing) halt(false)
  const own = t => t.kind === 'audio' && !t.theirs && !t.disabled, pick = chosen()
  const picked = S.tracks.filter(t => own(t) && pick.some(c => c === t || (c.kind === 'stack' && insideOf(t, c))))
  const scoped = picked.length >= 2, ts = scoped ? picked : S.tracks.filter(own)
  if (!ts.length) { say('no track to tidy'); return null }
  say(`hearing ${ts.length} track${ts.length === 1 ? '' : 's'}`)
  /* how far along: the card that says a print's progress (his ask, 2026-10-23: "tidying 작업할 때도 progress bar"), track by
     track — each heard for what it is, and its files measured for where they sound */
  printBegin('tidying', LANG_WORDS(`${ts.length} tracks`), ts.length)
  let step = 0
  const found = new Map(), heard = []
  try {
    for (const t of ts) {
      const w = await trackWhat(t)
      if (w) found.set(t, w)
      /* where each of its files sounds, in whole bars, against its own loudest */
      for (const r of t.regs) {
        if (r.loop || r.notes || r.rev || r.missing || !(r.key || r.peaksAll)) continue
        const { key, k } = silSource(r), L = NAT ? await silLevels(key) : silOutline(r)
        if (!L) continue
        let top = 255
        for (let i = 0; i < L.lv.length; i++) if (L.lv[i] < top) top = L.lv[i]
        const plan = top === 255 ? [] : silPlan(r, k, L, Object.assign({}, SIL_DEF, { whole: true, floor: Math.min(SIL_DEF.floor, -top / 2 - 40) }))
        heard.push([r, plan.map(p => [p[0], p[1]]), silSig(r)])
      }
      printTell({ done: ++step })
    }
  } finally { printEnd() }
  const before = Object.assign(editState(), { mix: mixState() }), n0 = UNDO.length
  let named = 0, known = 0, cut = { cut: 0, pieces: 0 }, stacks = 0
  const emptied = [], left = [], newStacks = []
  edit(() => {
    /* the silence */
    const had = new Map(ts.map(t => [t, t.regs.length]))
    cut = silCut(heard)
    for (const t of ts) if (had.get(t) && !t.regs.length && !S.tracks.some(x => x.parent === t.id)) emptied.push(t)
    /* names: a name that came with its file (or one that says nothing) is cleaned; one typed by hand is left */
    const own = ts.map(t => { const r = t.regs.find(q => q.file) || null, base = r ? tidyFileBase(r) : ''; return [t, base] }).filter(([t, b]) => b && (t.name === b.slice(0, 24).toLowerCase() || t.name === b.toLowerCase() || tidyBare(t.name)))
    const clean = tidyClean(own.map(([, b]) => b))
    for (const [t, b] of own) { const nm = clean.get(b).toLowerCase().slice(0, 64); if (nm && nm !== t.name) { t.name = nm; named++ } }
    for (const [t, w] of found) { t.what = w.what; t.tone = TIDY_FAM(w.what) || t.tone; known++ }
    const rank = t => { const v = t.what || tidyByWords(t.name); const i = v ? TIDY_ORDER.indexOf(v) : -1; return i < 0 ? TIDY_ORDER.length : i }, lead = S.tracks[S.sel]
    const inOrder = list => list.map((t, i) => [t, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(x => x[0])
    /* a new stack for each family of two or more (not the ones about to be taken out), named apart from the stacks there */
    const stackUp = list => {
      const fam = new Map(), made = new Map()
      for (const t of list) { if (emptied.includes(t)) continue; const f = tidyStackOf(t.what || tidyByWords(t.name)); if (!f) continue; if (!fam.has(f)) fam.set(f, []); fam.get(f).push(t) }
      for (const f of TIDY_STACKS) {
        const members = fam.get(f)
        if (!members || members.length < 2 || S.tracks.length >= MAX_TRACKS) continue
        const st = mkTrack(tidyStackName(f), null, null, null, null, 0, [], mkPatch(0, 0, 0, [0, 0, 0]), { kind: 'stack' })
        st.patch0 = copy(st.patch); st.parent = null; st.tone = members[0].tone
        for (const t of members) { t.parent = st.id; t.out = 0 }
        made.set(st, members); newStacks.push(st); birth(st); stacks++
      }
      return made
    }
    if (!scoped) {
      /* the whole session: the tracks that stand alone, in the order a session is read in, in the places they stood */
      const free = t => t.kind === 'audio' && !t.parent && !S.tracks.some(x => x.parent === t.id)
      const slots = S.tracks.map((t, i) => free(t) ? i : -1).filter(i => i >= 0), sorted = inOrder(slots.map(i => S.tracks[i]))
      slots.forEach((i, k) => { S.tracks[i] = sorted[k] })
      for (const [st, members] of stackUp(sorted.filter(t => ts.includes(t)))) S.tracks.splice(Math.min(...members.map(t => S.tracks.indexOf(t))), 0, st)
    } else {
      /* the chosen: out of the stacks they stood in, together where the first of them stood, in order, in stacks of their own */
      const set = new Set(ts), was = new Set(ts.map(t => t.parent).filter(Boolean)), first = S.tracks.find(t => set.has(t))
      for (const t of ts) t.parent = null
      const sorted = inOrder(ts), made = stackUp(sorted), block = [], put = new Set()
      for (const t of sorted) {
        if (put.has(t)) continue
        const st = [...made.keys()].find(x => made.get(x).includes(t))
        if (st) { block.push(st, ...made.get(st)); for (const m of made.get(st)) put.add(m) } else { block.push(t); put.add(t) }
      }
      const out = []
      for (const t of S.tracks) { if (t === first) out.push(...block); if (!set.has(t)) out.push(t) }
      S.tracks = out
      for (const id of was) { const st = byId(id); if (st && st.kind === 'stack' && !S.tracks.some(x => x.parent === id)) left.push(st) }      // (a stack left with nothing in it)
    }
    normalizeOrder(); S.sel = Math.max(0, S.tracks.indexOf(lead))
  })
  if (emptied.length || left.length) await deleteTracks(emptied.concat(left))
  for (const st of newStacks) { const base = st.name.replace(/ \d+$/, ''); if (st.name !== base && !S.tracks.some(t => t !== st && t.kind === 'stack' && t.name === base)) st.name = base }      // (the stack it was called apart from has gone: its own name back)
  if (UNDO.length > n0) { UNDO.length = n0; UNDO.push(before); if (UNDO.length > 120) UNDO.shift(); REDO.length = 0 }      // (one step back for all of it)
  if (typeof SAY === 'object') SAY.vocab = null
  repaint(); dirtyAll()
  const unknown = ts.length - known
  say(`${known} of ${ts.length}${scoped ? ' chosen' : ''} tracks known${named ? `, ${named} named` : ''}${stacks ? `, ${stacks} stack${stacks === 1 ? '' : 's'}` : ''}${cut.cut ? `, ${cut.pieces} pieces in whole bars` : ''}${emptied.length ? `, ${emptied.length} empty taken out` : ''}`)
  return { known, named, left: unknown, scoped, stacks, pieces: cut.pieces, cut: cut.cut, emptied: emptied.map(t => t.name), found: [...found].map(([t, w]) => ({ name: t.name, what: w.what, by: w.by, sure: w.sure, heard: w.heard, low: w.low, high: w.high, struck: w.struck, crest: w.crest })) }
}

/* ── joined to the room: ⌃T (his ask, 2026-10-24: free in the room and in Logic's keys), the command line's words, and what a
   track answers to ── */
{
  if (typeof KEYS === 'object') KEYS['⌃KeyT'] = () => tidyTracks()
  const rc0 = runCommand
  runCommand = async function (text, ...more) {
    if (/^\s*(tidy( up)?( the)?( session| tracks)?|(세션|트랙)\s*(을|를)?\s*정리(해\s*줘|해|하자|좀)?|정리해\s*줘)\s*[.!]?\s*$/i.test(String(text || ''))) { await tidyTracks(); uiDirty('cmd', 'head'); return }
    return rc0.call(this, text, ...more)
  }
  /* what a track is, found by tidying, is a word it answers to (a track called jay that is a bass answers to bass) */
  const keys0 = sayKeys
  sayKeys = function (t) { const ks = keys0(t); if (t.what) { ks.add(t.what); const f = TIDY_FAM(t.what); if (f) ks.add(f) } return ks }
}
