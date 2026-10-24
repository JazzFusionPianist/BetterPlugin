// node test/tidy.mjs — the session tidied (tidy.js): tracks called audio 1 to audio 8 are heard (yamnet.js, in a worker, the
// model ./yamnet.sh makes in ui/yamnet) and named for what they are; a name of one's own is kept and what it is only
// remembered; the tracks stand drums, bass, guitars, keys, voices; all of it is one step back; the command line finds a
// track by what it was heard to be. The page is served over http here (a worker, and fetch, want it).
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { open, PAGE } from './cdp.mjs'
const UI = join(dirname(fileURLToPath(import.meta.url)), '..', 'ui')
if (!existsSync(join(UI, 'yamnet', 'model.bin'))) { console.log('no ui/yamnet: ./yamnet.sh makes it'); process.exit(0) }
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' }
const server = createServer(async (req, res) => { if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return } const p = join(UI, decodeURIComponent(req.url.split('?')[0])); try { if (!p.startsWith(UI) || !(await stat(p)).isFile()) throw 0; res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); res.end(await readFile(p)) } catch (e) { res.writeHead(404); res.end() } })
await new Promise(r => server.listen(0, '127.0.0.1', r))
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/index.html` }); await b.sleep(1500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
await ev(`if (typeof START !== 'undefined') START.on = false; flush(); return 1`)
const names0 = await ev(`return S.tracks.map(t => t.name)`)
/* words first: the demo's own names say what each is */
ok('by words: a name, a file\'s name', await ev(`return tidyByWords('Kick In') === 'kick' && tidyByWords('BASS_DI_01.wav') === 'bass' && tidyByWords('Lead Vox comp') === 'vox' && tidyByWords('보컬 더블') === 'vox' && tidyByWords('Gtr L') === 'gtr' && tidyByWords('Audio 19') === null`))
ok('his corrections (2026-10-23): lead alone is a lead synth (in the synths); lead vocals and lead guitar are not; a pad fill is a pad', await ev(`return tidyByWords('lead - 0026') === 'lead' && tidyByWords('lead (D)') === 'lead' && tidyStackOf('lead') === 'synths' && tidyByWords('Lead Vocals-04') === 'vox' && tidyByWords('lead guitar') === 'gtr' && tidyByWords('pad fill') === 'pad' && tidyByWords('tom fill 5') === 'tom'`))
ok('…a track called after its instrument: astra, serum, omnisphere are synths, keyscape keys; the words of a name come first', await ev(`return tidyPlugOf('Astra 06 - 0029').v === 'synth' && tidyPlugOf('serum 2 02').v === 'synth' && tidyPlugOf('Omnisphere 01').v === 'synth' && tidyPlugOf('Keyscape 05').v === 'keys' && tidyPlugOf('astral pad') === null && tidyPlugOf('lead vocals') === null`))
{ const w = await ev(`const mk = n => ({ name: n, kind: 'audio', regs: [] }); const out = {}; for (const [n, heard] of [['astra 06', [['drums', .3]]], ['astra 03', [['flute', .2]]], ['astra 04', [['brass', .2]]], ['astra 01', [['synth bass', .2]]], ['omnisphere 01', [['electric', .2]]], ['serum 2 02', [['rhodes', .2]]], ['astra 05', []]]) { const was = tidyHear; tidyHear = async () => heard; try { out[n] = (await trackWhat(mk(n))).what } finally { tidyHear = was } } return out`)
  ok('…its sound only narrows it: astra heard as drums, a flute, brass is a synth; as a bass it is a bass, omnisphere as a guitar a guitar, serum as a rhodes a rhodes; heard as nothing, a synth', JSON.stringify(w) === JSON.stringify({ 'astra 06': 'synth', 'astra 03': 'synth', 'astra 04': 'synth', 'astra 01': 'synth bass', 'omnisphere 01': 'electric', 'serum 2 02': 'rhodes', 'astra 05': 'synth' }), w) }
ok('…shorthand with its last letter held (eppp is an ep, egg an eg), words run together (PowerUpStinger), and ohh is not overheads', await ev(`return tidyByWords('eppp - 0011') === 'rhodes' && tidyByWords('egg - 0105') === 'electric' && tidyByWords('PowerUpStinger_S011SF.566 - 0020') === 'fx' && tidyByWords('hhh loop') === 'hat' && tidyByWords('ohh yeah') !== 'overheads'`))
ok('…a stem that sounds in one bar of sixty is listened to there, its loudest stretches first', await ev(`const lv = new Uint8Array(91500).fill(255); for (let i = 60000; i < 62000; i++) lv[i] = 30; for (let i = 20000; i < 20500; i++) lv[i] = 90; const at = tidyLoudest({ hop: .001, lv }, 91.5); return Math.abs(at[0] - 60) < .6 && at.length <= 8 && at.every(x => x >= 0 && x <= 89.5)`), await ev(`const lv = new Uint8Array(91500).fill(255); for (let i = 60000; i < 62000; i++) lv[i] = 30; return tidyLoudest({ hop: .001, lv }, 91.5)`))
{ const m = await ev(`const sr = 16000, n = 2 * sr, tone = new Float32Array(n), noise = new Float32Array(n); let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1
  for (let i = 0; i < n; i++) { tone[i] = Math.sin(2 * Math.PI * 220 * i / sr) * .5; noise[i] = rnd() * .5 }
  return { tp: tidyPitch([tone]), np: tidyPitch([noise]), tf: tidyFlat([tone]), nf: tidyFlat([noise]) }`)
  ok('the ear\'s own measures: a tone is pitched and not noise-like, noise the other way round', m.tp > .8 && m.np < .45 && m.tf < .01 && m.nf > .3, m) }
ok('…the trained ear gives a chance to every family, together one; unsure of all of them, it says nothing', await ev(`const ear = { stacks: ['drums', 'keys'], kinds: ['Music'], d: 7, mu: [0, 0, 0, 0, 0, 0, 0], sd: [1, 1, 1, 1, 1, 1, 1], W: [[0, -2, 4, 0, 0, 0, 0, 20], [0, 2, -4, 0, 0, 0, 0, -20]] }, classes = ['Music'], f = (pitch, flat) => ({ scores: [.5], pitch, flat, low: .1, high: 0, struck: 0, crest: 12 })
  const a = tidyEar(f(.9, .001), classes, ear), b = tidyEar(f(.2, .3), classes, ear), even = { stacks: ['drums', 'keys', 'vox', 'fx'], kinds: ['Music'], d: 7, mu: Array(7).fill(0), sd: Array(7).fill(1), W: Array.from({ length: 4 }, () => Array(8).fill(0)) }
  return a[0][0] === 'keys' && b[0][0] === 'drums' && Math.abs(a[0][1] + a[1][1] - 1) < 1e-9 && tidyWhatBySound(f(.5, .05), classes, even).length === 0`))
ok('a name that says nothing, and one that does', await ev(`return tidyBare('Audio 19') && tidyBare('inst 3') && tidyBare('오디오 2') && tidyBare('Track 12.1') && !tidyBare('jay') && !tidyBare('bass')`))
/* the demo's tracks called audio 1 to 8, the sixth called by a name of its own, then tidied */
await ev(`S.tracks.filter(t => t.kind === 'audio').forEach((t, i) => { t.name = i === 5 ? 'jay' : 'Audio ' + (i + 1) }); repaint(); flush(); return 1`)
const order0 = await ev(`return S.tracks.map(t => t.id)`)
const r = await ev(`return await tidyTracks()`)
console.log('found:', JSON.stringify(r && r.found.map(f => `${f.name} = ${f.what} by ${f.by}${f.heard ? ' (' + f.heard.map(h => h[0] + ' ' + h[1].toFixed(2)).join(', ') + ') low ' + (f.low || 0).toFixed(2) + ' high ' + (f.high || 0).toFixed(2) : ''}`)))
ok('heard: most of the eight known by their sound', r && r.known >= 5, r && [r.known, r.left])
ok('every free end of the tidied sound fades in and out, a few ms (his ask, 2026-10-25); an end that meets another region does not', await ev(`const fd = TIDY_FADE_S / SPB(), bad = []
  for (const t of S.tracks.filter(t => t.kind === 'audio')) for (const r of t.regs) { if (r.notes) continue; const met = t.regs.some(q => q !== r && Math.abs(q.b - r.a) < 1e-6), meets = t.regs.some(q => q !== r && Math.abs(q.a - r.b) < 1e-6)
    if (!met && !((r.fi || 0) > 0)) bad.push([t.name, r.a, 'in']); if (!meets && !((r.fo || 0) > 0)) bad.push([t.name, r.b, 'out']); if (met && Math.abs((r.fi || 0) - fd) < 1e-9) bad.push([t.name, r.a, 'in at a join']) }
  return bad.length ? bad.slice(0, 4) : true`))
ok('…not named for what they are heard to be (his word, 2026-10-23): with no file to clean a name by, every name stays', await ev(`return S.tracks.some(t => t.name === 'jay') && S.tracks.filter(t => /^Audio \\d$/.test(t.name)).length === 7`), await ev(`return S.tracks.map(t => t.name)`))
ok('…what each is remembered, and its family', await ev(`return S.tracks.filter(t => t.what).every(t => t.tone === TIDY_FAM(t.what))`))
ok('…in the order a session is read in', await ev(`const rk = t => { const i = TIDY_ORDER.indexOf(t.what); return i < 0 ? 999 : i }, ts = S.tracks.filter(t => t.kind === 'audio'); return ts.every((t, i) => !i || rk(ts[i - 1]) <= rk(t))`), await ev(`return S.tracks.map(t => t.name + ':' + (t.what || '-'))`))
{ const jay = await ev(`const t = S.tracks.find(x => x.name === 'jay'); return t ? t.what : null`)
  if (jay) ok(`the command line finds jay by what it is (${jay})`, await ev(`return sayTracks([${JSON.stringify(jay)}]).some(t => t.name === 'jay')`)) }
ok('what it is is kept with the song', await ev(`return KEEP_T.includes('what')`))
await b.shot('tidy.png')
/* one step back */
await ev(`undoEdit(); flush(); return 1`)
ok('one step back: every name and place as it was', JSON.stringify(await ev(`return S.tracks.map(t => t.id)`)) === JSON.stringify(order0) && (await ev(`return S.tracks.filter(t => t.kind === 'audio').map(t => t.name)`)).every(n => /^Audio \d$|^jay$/.test(n)), await ev(`return S.tracks.map(t => t.name)`))
ok('said: tidy the tracks', await ev(`S.tracks.filter(t => t.kind === 'audio').forEach((t, i) => { t.name = 'Audio ' + (i + 1) }); await runCommand('트랙 정리해줘'); return /known/.test(S.last && S.last.say || '')`), await ev(`return S.last`))
await ev(`undoEdit(); flush(); return 1`)

/* ── names cleaned: only what surely says nothing (the names are his multitrack's of 2026-10-23, and some of his own) ── */
const BATCH = ['0 Lead Vocals - 0109', '0 Lead Vocals-04 (D) - 0057', '1 Backing Vocals-05 - 0084', '1 Drums - 0108', '1 Drums-01 - 0003', '12_Subdrop - 0073', '2 Drums - 0082', '3 Bass - 0092', '3 Synth - 0005', '4 Other - 0006', '5 Synth - 0094', '6 Other - 0095',
  '91V_LRB_perc_rim_woods - 0096', 'AB_PNB2_Zain_Wolf_148_Synth_Lead_Bulba_F - 0055', 'Astra 01 - 0106', 'BOS_AJ_170_Drum_Hat_Loop_Dots - 0103', 'DS_BPE_drum_kick_drive - 0059', 'DS_OT_150_drum_hat_storm - 0031', 'FSS_S2MHEV2_Kick_Feel_This_Way - 0086', 'FX 01-OneKnob Driver Stereo - 0111',
  'jc_el_160_drum_fill_snare_single_strokes - 0010', 'KSHMR_sok5_crash_clean_long_blazing - 0015', 'KSHMR_sok5_crash_clean_long_blazing - 0047', 'KSHMR_sok5_fx_cymbal_transition_swell_dawn-01 - 0044', 'MM_-_BLEEP_SNARE - 0089', 'OS_ATL_808_quality_C - 0022', 'PowerUpStinger_S011SF.566 - 0020',
  'SOUTHSIDE_160_hihat_loop_chicken - 0066', 'SULLIVAN_KING_guitar_sustained_150_A2 - 0068', 'TRKTRN_SLTSPV2_155_808_Bass_Loop_Saturn_F#Min - 0018', 'TS_HIHAT_150_hats_14_inch_eights_movement - 0009', 'V_RIOT_MDSTP_150_fill_rockfill_crispychicken - 0085', 'ZEN_BLA_150_vocal_chop_loop_liquidflower_D#min - 0034',
  'bass - 0042', 'lead (D) - 0027', 'piano - 0001', 'Chorus 1L - 0120', 'Chorus 2R - 0121', 'VOX_LEAD_main - 0122', '1 Shot Kick - 0123']
const WANT = { '0 Lead Vocals - 0109': 'Lead Vocals', '0 Lead Vocals-04 (D) - 0057': 'Lead Vocals-04 (D)', '1 Backing Vocals-05 - 0084': 'Backing Vocals-05', '1 Drums - 0108': '1 Drums', '2 Drums - 0082': '2 Drums', '1 Drums-01 - 0003': 'Drums-01',
  '12_Subdrop - 0073': 'Subdrop', '3 Bass - 0092': '3 Bass', '3 Synth - 0005': '3 Synth', '5 Synth - 0094': '5 Synth', '4 Other - 0006': '4 Other', '91V_LRB_perc_rim_woods - 0096': 'perc rim woods', 'AB_PNB2_Zain_Wolf_148_Synth_Lead_Bulba_F - 0055': 'Zain Wolf 148 Synth Lead Bulba F',
  'Astra 01 - 0106': 'Astra 01', 'BOS_AJ_170_Drum_Hat_Loop_Dots - 0103': 'Drum Hat Loop Dots', 'DS_BPE_drum_kick_drive - 0059': 'drum kick drive', 'DS_OT_150_drum_hat_storm - 0031': 'drum hat storm', 'FSS_S2MHEV2_Kick_Feel_This_Way - 0086': 'Kick Feel This Way',
  'FX 01-OneKnob Driver Stereo - 0111': 'FX 01-OneKnob Driver Stereo', 'jc_el_160_drum_fill_snare_single_strokes - 0010': 'jc_el_160_drum_fill_snare_single_strokes', 'KSHMR_sok5_crash_clean_long_blazing - 0015': 'crash clean long blazing',
  'KSHMR_sok5_fx_cymbal_transition_swell_dawn-01 - 0044': 'fx cymbal transition swell dawn-01', 'MM_-_BLEEP_SNARE - 0089': 'MM_-_BLEEP_SNARE', 'OS_ATL_808_quality_C - 0022': '808 quality C', 'PowerUpStinger_S011SF.566 - 0020': 'PowerUpStinger_S011SF.566',
  'SOUTHSIDE_160_hihat_loop_chicken - 0066': 'hihat loop chicken', 'SULLIVAN_KING_guitar_sustained_150_A2 - 0068': 'guitar sustained 150 A2', 'TRKTRN_SLTSPV2_155_808_Bass_Loop_Saturn_F#Min - 0018': '808 Bass Loop Saturn F#Min',
  'TS_HIHAT_150_hats_14_inch_eights_movement - 0009': 'HIHAT 150 hats 14 inch eights movement', 'V_RIOT_MDSTP_150_fill_rockfill_crispychicken - 0085': 'fill rockfill crispychicken', 'ZEN_BLA_150_vocal_chop_loop_liquidflower_D#min - 0034': 'vocal chop loop liquidflower D#min',
  'bass - 0042': 'bass', 'lead (D) - 0027': 'lead (D)', 'Chorus 1L - 0120': 'Chorus 1L', 'Chorus 2R - 0121': 'Chorus 2R', 'VOX_LEAD_main - 0122': 'VOX_LEAD_main', '1 Shot Kick - 0123': '1 Shot Kick' }
{ const got = await ev(`const m = tidyClean(${JSON.stringify(BATCH)}); return Object.fromEntries([...m])`), wrong = Object.keys(WANT).filter(k => got[k] !== WANT[k]).map(k => [k, got[k], WANT[k]])
  ok('names: the export\'s number, a track number and a pack\'s codes go; 1L, 2R, (D), -04, -01, a key, a number that is part of the name stay; numbers that would make two names one stay', !wrong.length, wrong) }
ok('a file brought in: its name as it came — every mark from the region (F#min), the capitals from the copy whose name lost the #', await ev(`return tidyFileBase({ name: 'trktrn_sltspv2_155_808_bass_loop_saturn_f#min - 0018', file: 'TRKTRN_SLTSPV2_155_808_Bass_Loop_Saturn_FMin - 0018.wav' }) === 'TRKTRN_SLTSPV2_155_808_Bass_Loop_Saturn_F#Min - 0018' && tidyClean(['TRKTRN_SLTSPV2_155_808_Bass_Loop_Saturn_F#Min - 0018', 'a - 0001']).get('TRKTRN_SLTSPV2_155_808_Bass_Loop_Saturn_F#Min - 0018') === '808 Bass Loop Saturn F#Min'`))
ok('…and a batch with no export numbers and no numbering keeps them: "2 Lead" alone is a name', await ev(`const m = tidyClean(['2 Lead', 'Pad 3', 'Vox Double']); return m.get('2 Lead') === '2 Lead' && m.get('Pad 3') === 'Pad 3'`))

/* ── a session of stems: names cleaned, each file stripped in whole bars against its own loudest, an empty one taken
   out, families in stacks — and all of it one step back ── */
const STEMS = [['audio 9', '0 Lead Vocals - 0109', [[4, 12, .5]]], ['1 drums - 0108', '1 Drums - 0108', [[4, 12, .6]]], ['2 drums - 0082', '2 Drums - 0082', [[16, 20, .6]]], ['3 bass - 0092', '3 Bass - 0092', [[4, 20, .5]]],
  ['kshmr_sok5_crash_clean_l', 'KSHMR_sok5_crash_clean_long_blazing - 0015', [[8, 9, .4]]], ['strings - 0036', 'Strings - 0036', [[8, 16, .007]]], ['pad - 0078', 'Pad - 0078', []], ['bgv chorus 1l - 0040', 'BGV Chorus 1L - 0040', [[12, 16, .3]]]]
await ev(`const spb = SPB(), sec = 24 * spb, N = Math.round(sec * 100)
  for (const [name, file, parts] of ${JSON.stringify(STEMS)}) {
    const pk = new Array(N).fill(0)
    for (const [a, b, v] of parts) for (let i = Math.round(a * spb * 100); i < Math.round(b * spb * 100); i++) pk[i] = v * (.6 + .4 * Math.abs(Math.sin(i / 7)))
    const t = addTrack('audio', name, S.tracks.length - 1); t.regs.push(mkReg({ a: 1, b: 25, key: 'k' + name, file: file + '.wav', peaksAll: pk, loop: false, rate: 1, sec, srcBars: 24, name: file.toLowerCase() }))
  }
  normalizeOrder(); flush(); return 1`)
const stems0 = await ev(`return S.tracks.map(t => t.id)`), u0 = await ev(`return UNDO.length`)
await ev(`window.__card = []; const b0 = printBegin, t0 = printTell; printBegin = (w, n, t) => { __card.push(['begin', w, n, t]); return b0(w, n, t) }; printTell = d => { const r = t0(d); __card.push(['tell', d.done, document.getElementById('ld-what').textContent]); return r }; return 1`)
const r2 = await ev(`return await tidyTracks()`)
{ const c = await ev(`return { log: __card, hidden: document.getElementById('loading').hidden, on: PRINT.on }`), ts = await ev(`return S.tracks.filter(t => t.kind === 'audio' && !t.theirs && !t.disabled).length + ${r2 ? r2.emptied.length : 0}`), last = c.log[c.log.length - 1]
  ok('the progress card while tidying: up at once for every track, track by track, to 100%, and gone at the end', c.log[0][0] === 'begin' && c.log[0][1] === 'tidying' && c.log[0][3] === ts && last[1] === ts && c.log[1][2] === `track 2 of ${ts}   ${Math.round(100 / ts)}%` && last[2] === `track ${ts} of ${ts}   100%` && c.hidden && !c.on, [ts, c.log.slice(0, 3), last, c.hidden]) }
const has = n => ev(`return S.tracks.some(t => t.name === ${JSON.stringify(n)})`)
const inStack = (n, st) => ev(`const t = S.tracks.find(x => x.name === ${JSON.stringify(n)}), s = t && S.tracks.find(x => x.id === t.parent); return !!s && s.kind === 'stack' && s.name === ${JSON.stringify(st)}`)
ok('stems: names cleaned — lead vocals (from audio 9), 1 drums and 2 drums kept apart, bass, crash clean long blazing, strings, bgv chorus 1l', (await Promise.all(['lead vocals', '1 drums', '2 drums', 'bass', 'crash clean long blazing', 'strings', 'bgv chorus 1l'].map(has))).every(Boolean), await ev(`return S.tracks.map(t => t.name)`))
ok('…the empty one taken out, and said', !(await has('pad')) && !(await has('pad - 0078')) && r2 && r2.emptied.length === 1, r2 && [r2.emptied, await ev(`return S.last && S.last.say`)])
ok('…the quiet strings (43 dB down) kept, cut to where they sound (to the beat after bar 16: its tail runs over the line)', await ev(`const t = S.tracks.find(x => x.name === 'strings'); return !!t && t.regs.length === 1 && t.regs[0].a === 9 && Math.abs(t.regs[0].b - 17.25) < 1e-9`), await ev(`const t = S.tracks.find(x => x.name === 'strings'); return t && t.regs.map(r => [r.a, r.b])`))
ok('…2 drums cut in whole bars: bar 17 to the beat after bar 20', await ev(`const t = S.tracks.find(x => x.name === '2 drums'); return t.regs.length === 1 && t.regs[0].a === 17 && Math.abs(t.regs[0].b - 21.25) < 1e-9`), await ev(`const t = S.tracks.find(x => x.name === '2 drums'); return t.regs.map(r => [r.a, r.b])`))
ok('…stacks by family: the drums (crash too), the voices (lead and the chorus)', (await inStack('1 drums', 'drums')) && (await inStack('2 drums', 'drums')) && (await inStack('crash clean long blazing', 'drums')) && (await inStack('lead vocals', 'vox')) && (await inStack('bgv chorus 1l', 'vox')), await ev(`return S.tracks.map(t => (t.kind === 'stack' ? '[' + t.name + ']' : (t.parent ? '  ' : '') + t.name))`))
await b.shot('tidy-stems.png')
await ev(`undoEdit(); flush(); return 1`)
ok('…one step back: every track, name, region and place as it was, no stacks', JSON.stringify(await ev(`return S.tracks.map(t => t.id)`)) === JSON.stringify(stems0) && await ev(`return UNDO.length === ${u0} && S.tracks.some(t => t.name === 'pad - 0078') && S.tracks.find(t => t.name === 'strings - 0036').regs.length === 1 && !S.tracks.some(t => t.kind === 'stack' && ['drums', 'vox'].includes(t.name))`), await ev(`return S.tracks.map(t => t.name)`))
/* ── only the chosen (his ask, 2026-10-24): after the whole session was tidied, new tracks and one from the drums stack
   are chosen and tidied with ⌃T — they stand apart, in stacks of their own; the rest is as it was ── */
await ev(`await tidyTracks(); flush(); return 1`)
const NEW = [['kick new - 0200', 'Kick New - 0200', [[2, 3, .6]]], ['snare new - 0201', 'Snare New - 0201', [[2, 3, .5]]], ['synth pad - 0202', 'Synth Pad - 0202', [[2, 6, .4]]]]
await ev(`const spb = SPB(), sec = 24 * spb, N = Math.round(sec * 100)
  for (const [name, file, parts] of ${JSON.stringify(NEW)}) {
    const pk = new Array(N).fill(0)
    for (const [a, b, v] of parts) for (let i = Math.round(a * spb * 100); i < Math.round(b * spb * 100); i++) pk[i] = v * (.6 + .4 * Math.abs(Math.sin(i / 7)))
    const t = addTrack('audio', name, S.tracks.length - 1); t.parent = null; t.regs.push(mkReg({ a: 1, b: 25, key: 'k' + name, file: file + '.wav', peaksAll: pk, loop: false, rate: 1, sec, srcBars: 24, name: file.toLowerCase() }))
  }
  normalizeOrder(); flush(); return 1`)
const shape = () => ev(`return S.tracks.map(t => (t.kind === 'stack' ? '[' + t.name + ']' : (t.parent ? '  ' + (S.tracks.find(x => x.id === t.parent) || {}).name + '/' : '') + t.name))`)
const keep = await ev(`const t = S.tracks.find(x => x.name === '2 drums'); return { parent: (S.tracks.find(x => x.id === t.parent) || {}).name, regs: t.regs.map(r => [r.a, r.b]) }`)
const u1 = await ev(`return UNDO.length`)
await ev(`const ids = S.tracks.filter(t => ['kick new - 0200', 'snare new - 0201', 'synth pad - 0202', '1 drums'].includes(t.name)).map(t => t.id); S.selT = ids; S.sel = S.tracks.findIndex(t => t.id === ids[0]); S.focus = 'tracks'; flush(); return 1`)
await b.press('t', 'KeyT', 84, 2); await b.sleep(1500)
const after = await shape()
ok('⌃T with four tracks chosen: only they are tidied — the new kick, snare and 1 drums in a drums stack of their own, apart from the drums stack there', after.includes('[drums 2]') && after.includes('  drums 2/kick new') && after.includes('  drums 2/snare new') && after.includes('  drums 2/1 drums') && after.includes('[drums]') && !after.some(x => /^  drums\/(kick new|snare new|1 drums)$/.test(x)), after)
ok('…the synth pad, alone of its family, stands by itself, its name cleaned', after.includes('synth pad'), after)
ok('…what was not chosen is as it was (2 drums still in the first drums stack, its regions the same); one step', JSON.stringify(await ev(`const t = S.tracks.find(x => x.name === '2 drums'); return { parent: (S.tracks.find(x => x.id === t.parent) || {}).name, regs: t.regs.map(r => [r.a, r.b]) }`)) === JSON.stringify(keep) && (await ev('return UNDO.length')) === u1 + 1, keep)
ok('…said as the chosen', /chosen tracks known/.test(await ev(`return (S.last || {}).say || ''`)), await ev(`return S.last`))
/* the voices: both chosen, so the vox stack they leave is empty — it goes, and theirs takes the name */
await ev(`const ids = S.tracks.filter(t => ['lead vocals', 'bgv chorus 1l'].includes(t.name)).map(t => t.id); S.selT = ids; S.sel = S.tracks.findIndex(t => t.id === ids[0]); flush(); await tidyTracks(); flush(); return 1`)
{ const v = await shape(); ok('…a stack left with nothing in it goes, and the new one is called vox again', v.filter(x => x === '[vox]').length === 1 && !v.includes('[vox 2]') && v.includes('  vox/lead vocals') && v.includes('  vox/bgv chorus 1l'), v) }
await ev(`undoEdit(); undoEdit(); flush(); return 1`)
ok('…and back, a step each', (await ev(`return S.tracks.filter(t => t.kind === 'stack' && /^drums 2$/.test(t.name)).length`)) === 0 && (await ev(`return S.tracks.some(t => t.name === 'kick new - 0200')`)), await shape())
ok('Track > Tidy Tracks shows ⌃T, and the key sheet lists it', await ev(`const l = MENU_BAR().find(m => m[0] === 'Track')[1].find(x => Array.isArray(x) && x[0] === 'Tidy Tracks'); return !!l && l[1] === '⌃KeyT' && typeof KEYS['⌃KeyT'] === 'function'`) && await ev(`return JSON.stringify(SHEET).includes('tidy the tracks')`))
ok('no errors on the page', !b.errors.length, b.errors.slice(0, 3))
console.log(out.join('\n'))
console.log(bad.length ? `\n${bad.length} failed` : '\nall passed')
await b.close(); server.close()
process.exit(bad.length ? 1 : 0)
