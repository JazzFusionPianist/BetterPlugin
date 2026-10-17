/* ── what kind of thing a plug-in is ──
   The list of plug-ins is laid out by what they do: an equalizer among the equalizers, a reverb among the reverbs. Almost
   no plug-in says what it is (of four hundred audio units on the Mac this was written on, twenty-eight carry a word about
   it; a vst3 mostly says "Fx"), so it is read from the name: first the words a maker uses for the kind itself (reverb,
   compressor, eq), then the names of the machines that plug-ins are modelled on (an 1176 is a compressor, a Pultec an
   equalizer, an EMT 140 a plate). The rules are tried in order and the first that fits says the kind; a name that tells
   nothing is filed by what the plug-in says of itself, where it says anything (a vst3's sub categories); the rest is `other`.
   A kind he set by hand (settings > plug-ins) comes before all of it: plugCat is his word where he gave one, plugCatRead
   always the room's own reading. */
const PLUG_CATS = ['eq', 'dynamics', 'reverb', 'delay', 'modulation', 'saturation', 'amp', 'pitch', 'stereo', 'channel', 'repair', 'other']
const CAT_RULES = [
  /* things that carry a kind's word in their name without being of that kind */
  ['other', /tuner|mic collection|console recall|\bconnect\b|net ?send|roger ?beep|round ?trip|\bmeter|analy[sz]er|loudness|\bscope\b|spectrograph|\bmonitor\b/],
  ['repair', /\brx \d|\bde-?(click|clip|crackle|hum|plosive|reverb|noise|bleed|rustle|wind)|de-?nois|dialogue|breath control|repair|spectral editor|rebalance|sound ?isolation|\bc-suite|restor|clarity vx|\bnoise (reduc|suppress)|unmix/],
  ['eq', /dynamic eq|match ?eq|stem eq|eq ?match|(graphic|parametric|band)eq$/],
  ['saturation', /exciter|enhancer|vitalizer|fresh air/],
  ['channel', /channel ?strip|voxbox|vt-737|la-6176|\bcs-1\b|neve 88rs|\b88rs\b|dfc\b|effect ?rack|^ozone( \d+)?( advanced| standard| elements)?$|^neutron|^nectar|masterdesk|console [a-z0-9]|bx console|omni ?channel|scheps|ssl e-? ?channel|ssl 4000 e|\bchannel\b/],
  ['amp', /\bamp\b|amp ?room|ampeg|marshall|fender|friedman|diezel|\bengl\b|fuchs|\bsuhr\b|gallien|eden wt|archetype|gav19t|tweed|plexi|tube screamer|ts808|overdrive|bermuda triangle|^raw$|wood works|guitar rig|amplitube|bias (amp|fx)|helix|\bcab(inet)?\b|fuzz|pedal|stomp|big muff|\brat\b|parallax|fortin|nolly|gojira|cory wong|tim henson|soldano|mesa|rectifier|\bjcm|\bac30|twin reverb/],
  ['delay', /delay|echo|timeless|re-201|ep-34|primal ?tap|time cube|sdd-3000|dmx 15-80|crystallizer|replika|\btap\b|ultratap|h-delay|supertap|repeater|tape ?delay|space echo|memory man|deluxe memory|comeback kid|dubstation/],
  ['reverb', /verb|plate|chamber|room|\bhall\b|\bemt ?\d|lexicon|\b224\b|480l|bx 20|rmx16|ocean way studios|sound city|supermassive|shimmer|pro-r\b|reflection engine|blackhole|black hole|altiverb|\bspaces?\b|seventh heaven|spring|\braum\b|nimbus|stratus|\br2\b|\br4\b|lx480|mangledverb|tverb|cathedral|ambien|lacuna|convol/],
  ['modulation', /chorus|flang|phas(e|er|is)|tremol|vibrato|rotary|leslie|dimension ?d|\bce-1\b|uber ?mod|space ?modulator|micro ?shift|pan ?man|panner|auto-?pan|cyclosonic|studio d\b|brigade|ensemble|doubler|\badt\b|lfo ?tool|shaperbox|volume ?shaper|ring ?mod|wow|flutter|juno ?chorus|modulat/],
  ['dynamics', /comp|limit|\bgate|expand|de-?ess|supp?r?ess|transient|dynamics|maximi[sz]|level+er|pro-c\b|pro-l\b|pro-g\b|pro-ds\b|pro-mb\b|multi-?band|\b1176|\bla-?2a?\b|\bla-?3a\b|fairchild|distressor|dbx ?160|33609|2254|variable mu|vsc-2|zener|tla-100|cl ?1b|175-b|\b176\b|dyna-mite|mpressor|elysia alpha|shadow hills|api[- ]?2500|unlimiter|envolution|\bimpact\b|\bott\b|kickstart|duck|side-?chain|pump|\bglue\b|\bbus\b|buss\b|\bl[123]\b|\bc[146]\b|rvox|mv2|vocal rider|bass rider|smack|trans-x|puigchild|cla-(2a|3a|76)|kotelnikov|molot|mjuc|spl iron|\bmu\b|opto|\bfet\b|\bvca\b|peak ?limiter/],
  ['saturation', /\baural\b|analog machines|verve|satur|\btape\b|distort|\bdrive|twintube|culture vulture|decapitator|radiator|fatso|oxide|studer|ampex|atr-102|\ba800\b|\bj37\b|decimort|biscuit|crush|rc-20|vsm-3|saturn|preamp|\b610-?[ab]\b|\bv76\b|\bhg-2|black box|trash|vinyl|lo-?fi|warm|\btube\b(?!-tech)|clipper|\bclip\b|inflator|sausage|devil-loc|kramer (hls|pie|tape)|thermionic|harmonics|color\b|colour\b|retro color/],
  ['pitch', /pitch|voc-?align|auto-?tune|\btune\b|auto-?key|melodyne|harmon[iy]|alter ?boy|vocal ?synth|vocoder|\bh910\b|\bh949\b|\bh3000\b|shift|formant|ovox|manipulator|half-?time|octav|whammy|\bvoice\b|vocal doubler|talkbox|throat/],
  ['stereo', /imager|stereo|\bk-stereo|wid(e|th|ener)|\bm\/s\b|mid-?side|\bibp\b|phase align|auto-?align|spread|\bhaas\b|binaural|surround|spatial|\bs1\b|ozone imager|\bpan\b/],
  ['eq', /\beq\b|eq\d|\beqp|\bmeq|equali[sz]|pultec|puigtec|pro-q\b|api[- ]?5[56]0|neve 10[78]\d|\b10[78]\d\b|31102|maag|massive passive|nseq|harrison|helios|trident|a-range|tonelux|\btilt\b|\bbax\b|cambridge|curve bender|sie-?q|\bpe ?1c\b|\bme ?1b\b|filter|hi-?pass|low-?pass|band-?pass|shelf|volcano|simplon|^micro$|soothe|bx digital|bx refinement|low end focus|bass control|clarity|stabilizer|spectral shaper|\bvog\b|moog|gullfoss|nova\b|slick ?eq|\bq\d\b|\bq10\b|f6\b|kirchhoff|resonan|\bbass\b|sub ?synth|subsynth|\brbass|\bmaxx ?bass|\bair\b/],
]
/* what a plug-in says of itself (a vst3's sub categories, an audio unit's tags), where it says anything that tells kinds apart */
const CAT_SAID = [['reverb', /reverb/], ['delay', /delay/], ['dynamics', /dynamics|compressor|limiter/], ['eq', /\beq\b|equali[sz]er|filter/], ['modulation', /modulation|chorus|flanger|phaser/], ['saturation', /distortion|saturation|exciter/],
  ['pitch', /pitch/], ['stereo', /spatial|imaging|panner|stereo|surround/], ['repair', /restoration/], ['amp', /guitar|amp sim/], ['channel', /channel ?strip|mastering/], ['other', /analy[sz]er|tools|network|generator/]]
function plugCatRead (p) {
  const said = String(p.sub || '').toLowerCase()
  const name = String(p.name || '').toLowerCase().replace(/_/g, ' ').replace(/^(uadx?|uaudio|fabfilter) /, '')      // (a file's name may be written with lines for spaces, and with its maker's name before its own)
    .replace(/chandler limited/, 'chandler').replace(/\(mono\)|\bmono$|\blegacy$/g, '').trim()
  for (const [cat, re] of CAT_RULES) if (re.test(name)) return cat
  for (const [cat, re] of CAT_SAID) if (re.test(said)) return cat
  return 'other'
}
/* the kinds he set by hand (settings > plug-ins, plugpage.js), kept in the app's settings by the plug-ins' ids ('plugKind') */
const PLUG_KIND = new Map()
const plugCat = p => (p && !p.inst && PLUG_KIND.get(String(p.id))) || plugCatRead(p)
function plugKindSet (kinds) {
  PLUG_KIND.clear()
  for (const [id, k] of Object.entries(kinds && typeof kinds === 'object' ? kinds : {})) if (PLUG_CATS.includes(k)) PLUG_KIND.set(String(id), k)
  if (typeof S === 'undefined' || !S.picker) return
  for (const p of S.picker.list || []) delete p.cat                                    // (the list's kinds were kept with it: read again)
  if (S.picker.open && typeof drawPicker === 'function') drawPicker()
  if (typeof uiDirty === 'function') uiDirty('dock')
}
/* the room's own prints, by the same kinds */
const PRINT_CAT = { tape: 'saturation', space: 'reverb', delay: 'delay' }
/* the plug-ins he has left out of the room's lists (settings > plug-ins, plugpage.js): kept in the app's settings by
   their ids ('plugOut'); the lists of the room (the patch's, the wall's, the instruments') do not show them. A song that
   has one still opens it. */
const PLUG_OUT = new Set()
const plugShown = p => !p || !PLUG_OUT.has(p.id)
function plugOutSet (ids) {
  PLUG_OUT.clear(); for (const id of Array.isArray(ids) ? ids : []) PLUG_OUT.add(String(id))
  if (typeof S !== 'undefined' && S.picker && S.picker.open && typeof drawPicker === 'function') drawPicker()      // (the list that is up, written again)
  if (typeof uiDirty === 'function') uiDirty('dock')
}
if (typeof window !== 'undefined' && window.__JUCE__ && window.__JUCE__.backend) {
  window.__JUCE__.backend.addEventListener('dawPlugOut', d => { if (!d) return; if (d.again && typeof S !== 'undefined' && S.picker && !S.picker.open) S.picker.list = null; plugOutSet(d.ids) })      // (again: the plug-ins were looked for again, and the room asks the app afresh)
  window.__JUCE__.backend.addEventListener('dawPlugKind', d => { if (d) plugKindSet(d.kinds) })
  addEventListener('load', async () => { if (typeof NAT !== 'undefined' && NAT) { const p = await NAT.call('prefGet'); plugOutSet(p && p.plugOut); plugKindSet(p && p.plugKind) } })
}
/* who made a vst3 that does not say (Source/Engine.h listPlugins): the maker of the audio units whose name its bundle's id
   carries ('com.fabfilter.Micro' → FabFilter), else what its copyright says ('Copyright © 2002-2024 FabFilter') */
const squash = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
function plugMakers (list) {
  const known = new Map()
  for (const p of list) if (p.maker && p.fmt === 'au') known.set(squash(p.maker), p.maker)
  for (const p of list) {
    if (p.maker) continue
    const k = squash(String(p.bid || '').split('.')[1])
    let m = k.length >= 3 ? known.get(k) : null
    if (!m && k.length >= 4) for (const [q, v] of known) if (q.length >= 4 && (q.startsWith(k) || k.startsWith(q))) { m = v; break }
    if (!m && p.by) {
      const by = String(p.by).replace(/all rights reserved\.?|copyright|\(c\)|©|\b(19|20)\d\d(\s*[-–]\s*((19|20)\d\d|present))?\b|\bv?\d+(\.\d+)+\b/gi, ' ').replace(/^[\s,.]+|[\s,.]+$/g, '').replace(/\s+/g, ' ')
      const name = by.replace(/,?\s+(oy|inc|ltd|llc|gmbh|ab|ag|bv|sas|sarl|s\.?a\.?|co|corp)\.?$/i, '').trim()
      if (/[a-z]/i.test(name) && name.length <= 40 && !list.some(o => o.name === name)) m = name      // (not the plug-in's own name, read back from a string that only names it)
    }
    if (m) p.maker = m
  }
  return list
}
if (typeof module !== 'undefined') module.exports = { plugCat, plugCatRead, plugKindSet, PLUG_CATS, PRINT_CAT, plugMakers }
