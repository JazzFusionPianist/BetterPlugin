/* ── the session tidied: what each track is, its name, its colour, its place ──
   His ask (2026-10-22): a producer's tracks are called audio 19, and forty of them come in at once; what each one is must
   be found, not typed. Each track is read by its own name, then by the names of its sounds' files (Bass DI.wav), then by
   its instrument's plug-in, and last by its sound: YAMNet (yamnet.js, in a worker of its own) hears a few seconds of it
   and says how much it is each of 521 kinds of sound, which TIDY_HEAR gathers into the instruments a track may be
   (TIDY_INST). Then, in one step back:
     a name that says nothing (audio 19, inst 3, a file's own name with no instrument in it) becomes the instrument's
       (bass, kick 2); a name of his own is kept, and what the track is is only remembered (t.what), for the command line
       to find it by (say.js: sayKeys) and for its colour (t.tone, its family);
     the tracks stand in the order a session is read in: drums, bass, guitars, keys, the rest, voices, effects (stacks,
       buses and what stands in a stack keep their places).
   Track > Tidy Tracks, or said: "tidy the tracks", "트랙 정리해줘". Read after say.js and mix.js. */
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
const TIDY_WORDS = TIDY_INST.flatMap(([v, , en, ko]) => [...en.map(w => ({ v, w, re: tidyEnRe(w), n: w.length })), ...ko.map(w => ({ v, w, re: tidyKoRe(w), n: w.length }))])
  .concat([['hh', 'hat'], ['snr', 'snare'], ['ld vox', 'vox'], ['bv', 'backing'], ['ac gtr', 'acoustic'], ['eg', 'electric'], ['ep', 'rhodes'], ['kik', 'kick'], ['oh', 'overheads'], ['tmb', 'tambourine']].map(([w, v]) => ({ v, w, re: tidyEnRe('=' + w), n: w.length })))
  .sort((a, b) => b.n - a.n)
function tidyByWords (str) {
  const s = ' ' + String(str || '').toLowerCase().replace(/[_\-.()[\]]+/g, ' ').replace(/([a-z])(\d)/g, '$1 $2').replace(/\s+/g, ' ').trim() + ' '
  /* the longest words first, none inside one found already; the first of them in the name says what it is */
  const taken = [], found = []
  for (const p of TIDY_WORDS) {
    p.re.lastIndex = 0
    let m
    while ((m = p.re.exec(s))) { const at = m.index + m[0].length - m[1].length, end = m.index + m[0].length; if (!taken.some(([x, y]) => at < y && end > x)) { found.push({ v: p.v, at }); taken.push([at, end]) } p.re.lastIndex = m.index + 1 }
  }
  return found.length ? found.sort((x, y) => x.at - y.at)[0].v : null
}
/* a name that says nothing of what is in the track: the DAW's own (audio 19, inst 3, track 2, bus 4), or nothing but a number or a take */
const tidyBare = name => /^\s*(audio|inst|instrument|track|mono|stereo|오디오|트랙|인스트|untitled|new track|bounce|print|take|comp|rec|recording|voice memo)?[\s_\-#.]*\d*(\s*[._\-]\s*\d+)*\s*(take\s*\d+)?\s*$/i.test(String(name || ''))

/* ── by sound: YAMNet, in a worker ── */
const TIDY_WORKER = `
let M = null
onmessage = e => {
  const d = e.data
  if (d.init) { M = YAM_MODEL(d.model); postMessage({ id: d.id, ok: true }); return }
  const out = new Float32Array(M.T['fc.b'].length); let n = 0
  for (const pcm of d.parts) { const r = yamScores(M, pcm); for (const p of r.pieces) { for (let i = 0; i < out.length; i++) out[i] += p[i]; n++ } }
  for (let i = 0; i < out.length; i++) out[i] /= Math.max(1, n)
  postMessage({ id: d.id, scores: out, pieces: n }, [out.buffer])
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
      TIDY.w = new Worker(URL.createObjectURL(new Blob([code + TIDY_WORKER], { type: 'text/javascript' })))
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
async function tidySound (t) {
  const regs = (t.regs || []).filter(r => !r.missing && (NAT ? !r.notes && (r.key || (r.loop && r.buf)) : true)).sort((a, b) => (b.sec || b.b - b.a) - (a.sec || a.b - a.a))      // (the app hears its sounds' buffers, a loop's too; a page, what it plays: notes too)
  const parts = []
  if (NAT) {
    for (const r of regs.slice(0, 2)) {
      const key = r.key || r.buf, len = r.sec || (typeof LOOPS === 'object' && LOOPS[r.buf] && LOOPS[r.buf].sec) || (r.b - r.a) * SPB(), cand = []
      for (let k = 1; k <= 8 && len > TIDY_SEC; k++) cand.push((len - TIDY_SEC) * k / 9)
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
/* the instruments a track sounds like, best first: [[stem, score], …] */
async function tidyHear (t) {
  if (!(await tidyStart())) return null
  const parts = await tidySound(t)
  if (!parts.length) return []
  const r = await tidyAsk({ parts }), low = tidyLow(parts), high = tidyHigh(parts), struck = tidyStruck(parts), crest = tidyCrest(parts), out = tidyPick(r.scores, TIDY.classes, low, struck, high, crest)
  out.low = low; out.high = high; out.struck = struck; out.crest = crest
  return out
}

/* ── what a track is ── */
async function trackWhat (t) {
  if (t.kind !== 'audio' || t.theirs) return null
  let v = tidyByWords(t.name)
  if (v) return { what: v, by: 'name' }
  for (const r of t.regs || []) { v = tidyByWords(String(r.file || '').replace(/^.*\//, '')) || tidyByWords(r.tag) || tidyByWords(r.name); if (v) return { what: v, by: 'file' } }
  if (t.inst) { const ins = (t.inserts || []).find(i => i.inst) || null; v = tidyByWords(ins && ins.name) || ({ drums: 'drums', piano: 'piano', synth: 'synth', bass: 'synth bass' })[t.inst.kind] || null; if (v) return { what: v, by: 'plug-in' } }
  const heard = await tidyHear(t)
  if (heard && heard.length && heard[0][1] >= .03) return { what: heard[0][0], by: 'sound', sure: heard[0][1], heard: heard.slice(0, 3), low: heard.low, high: heard.high, struck: heard.struck, crest: heard.crest }
  return null
}

/* ── tidied ── */
async function tidyTracks () {
  if (S.playing) halt(false)
  const ts = S.tracks.filter(t => t.kind === 'audio' && !t.theirs && !t.disabled)
  if (!ts.length) { say('no track to tidy'); return null }
  say(`hearing ${ts.length} track${ts.length === 1 ? '' : 's'}`)
  const found = new Map()
  for (const t of ts) { const w = await trackWhat(t); if (w) found.set(t, w) }
  const before = Object.assign(editState(), { mix: mixState() }), n0 = UNDO.length
  let named = 0, known = 0
  edit(() => {
    /* names: only those that said nothing; the rest remember what they are */
    const taken = new Set(S.tracks.filter(t => !(found.has(t) && tidyBare(t.name))).map(t => t.name.toLowerCase()))
    for (const [t, w] of found) {
      t.what = w.what; t.tone = TIDY_FAM(w.what) || t.tone; known++
      if (!tidyBare(t.name)) continue
      const base = tidyName(w.what)
      let nm = base, k = 2
      while (taken.has(nm)) nm = `${base} ${k++}`
      taken.add(nm); t.name = nm; named++
    }
    /* order: the tracks that stand alone, in the order a session is read in, in the places they stood */
    const free = t => t.kind === 'audio' && !t.parent && !S.tracks.some(x => x.parent === t.id)
    const slots = S.tracks.map((t, i) => free(t) ? i : -1).filter(i => i >= 0), list = slots.map(i => S.tracks[i])
    const rank = t => { const v = t.what || tidyByWords(t.name); const i = v ? TIDY_ORDER.indexOf(v) : -1; return i < 0 ? TIDY_ORDER.length : i }
    const sorted = list.map((t, i) => [t, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(x => x[0]), lead = S.tracks[S.sel]
    slots.forEach((i, k) => { S.tracks[i] = sorted[k] })
    normalizeOrder(); S.sel = Math.max(0, S.tracks.indexOf(lead))
  })
  if (UNDO.length > n0) { UNDO.length = n0; UNDO.push(before); if (UNDO.length > 120) UNDO.shift(); REDO.length = 0 }      // (one step back for all of it)
  if (typeof SAY === 'object') SAY.vocab = null
  repaint(); dirtyAll()
  const left = ts.length - known
  say(`${known} of ${ts.length} tracks known${named ? `, ${named} named` : ''}${left ? `, ${left} not heard as anything` : ''}`)
  return { known, named, left, found: [...found].map(([t, w]) => ({ name: t.name, what: w.what, by: w.by, sure: w.sure, heard: w.heard, low: w.low, high: w.high, struck: w.struck, crest: w.crest })) }
}

/* ── joined to the room: the command line's words, and what a track answers to ── */
{
  const rc0 = runCommand
  runCommand = async function (text, ...more) {
    if (/^\s*(tidy( up)?( the)?( session| tracks)?|(세션|트랙)\s*(을|를)?\s*정리(해\s*줘|해|하자|좀)?|정리해\s*줘)\s*[.!]?\s*$/i.test(String(text || ''))) { const r = await tidyTracks(); if (r) S.last = { say: `${r.known} of ${r.known + r.left} known${r.named ? `, ${r.named} named` : ''}` }; uiDirty('cmd', 'head'); return }
    return rc0.call(this, text, ...more)
  }
  /* what a track is, found by tidying, is a word it answers to (a track called jay that is a bass answers to bass) */
  const keys0 = sayKeys
  sayKeys = function (t) { const ks = keys0(t); if (t.what) { ks.add(t.what); const f = TIDY_FAM(t.what); if (f) ks.add(f) } return ks }
}
