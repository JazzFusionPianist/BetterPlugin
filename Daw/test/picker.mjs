// node test/picker.mjs — the list of plug-ins inside the patch's panel: pressed for on a patch it stands in the panel, at
// the right of the chain, as tall as the panel; the chain keeps clear of it; the kinds of plug-in stand down its left,
// each with its number, and a kind pressed lists only that kind; what is typed is looked for among all of them; it
// follows the panel when the panel is made taller; from the new-track list it is still the card beside that list.
// (No app here: the plug-ins are a made-up list, put where the app's answer would be; the list is opened by the place to add
// at the end of the chain, which is there without the app too.)
import { open, PAGE } from './cdp.mjs'
const [W, H] = [+(process.argv[2] || 1440), +(process.argv[3] || 900)]
const b = await open(PAGE, { width: W, height: H, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const LIST = [['Pro-Q 4', 'FabFilter'], ['Pro-C 2', 'FabFilter'], ['Pro-L 2', 'FabFilter'], ['Pro-R 2', 'FabFilter'], ['Saturn 2', 'FabFilter'], ['Timeless 3', 'FabFilter'], ['ValhallaVintageVerb', 'Valhalla DSP, LLC'], ['ValhallaPlate', 'Valhalla DSP, LLC'],
  ['ValhallaDelay', 'Valhalla DSP, LLC'], ['EchoBoy', 'Soundtoys'], ['Decapitator', 'Soundtoys'], ['MicroShift', 'Soundtoys'], ['UAD Pultec EQP-1A', 'Universal Audio'], ['UAD Fairchild 670', 'Universal Audio'], ['UADx LA-2A Tube Compressor', 'Universal Audio (UADx)'],
  ['UAD EMT 140', 'Universal Audio'], ['UAD Lexicon 224', 'Universal Audio'], ['UAD Marshall Plexi Classic', 'Universal Audio'], ['UAD Neve 1073', 'Universal Audio'], ['UAD Chandler Limited Curve Bender', 'Universal Audio'], ['UAD SSL E Channel Strip', 'Universal Audio'],
  ['UAD Studer A800', 'Universal Audio'], ['UAD Tube-Tech PE 1C', 'Universal Audio'], ['Auto-Tune Pro', 'Antares'], ['Archetype Plini', 'Neural DSP'], ['Ozone 12 Imager', 'iZotope'], ['RX 11 De-click', 'iZotope'], ['soothe2', 'oeksound'], ['AUGraphicEQ', 'Apple'],
  ['bx_tuner', 'Universal Audio'], ['Softube Vocoder', 'Universal Audio'], ['Maag EQ4 MS', 'Universal Audio'], ['Serum 2', 'Xfer Records', true]]
const WANT = { 'pro-q 4': 'eq', 'pro-c 2': 'dynamics', 'pro-l 2': 'dynamics', 'pro-r 2': 'reverb', 'saturn 2': 'saturation', 'timeless 3': 'delay', valhallavintageverb: 'reverb', valhallaplate: 'reverb', valhalladelay: 'delay', echoboy: 'delay', decapitator: 'saturation',
  microshift: 'modulation', 'uad pultec eqp-1a': 'eq', 'uad fairchild 670': 'dynamics', 'uadx la-2a tube compressor': 'dynamics', 'uad emt 140': 'reverb', 'uad lexicon 224': 'reverb', 'uad marshall plexi classic': 'amp', 'uad neve 1073': 'eq',
  'uad chandler limited curve bender': 'eq', 'uad ssl e channel strip': 'channel', 'uad studer a800': 'saturation', 'uad tube-tech pe 1c': 'eq', 'auto-tune pro': 'pitch', 'archetype plini': 'amp', 'ozone 12 imager': 'stereo', 'rx 11 de-click': 'repair', soothe2: 'eq',
  augraphiceq: 'eq', bx_tuner: 'other', 'softube vocoder': 'pitch', 'maag eq4 ms': 'eq' }

await ev(`if (typeof START !== 'undefined') START.on = false; setView(true)
  S.picker.list = ${JSON.stringify(LIST)}.map(([name, maker, inst], i) => ({ id: 'p' + i, name, maker, fmt: 'au', inst: !!inst })).sort((a, b) => a.name.localeCompare(b.name))      // (what the app would have answered)
  S.sel = S.tracks.findIndex(t => t.kind === 'audio' && !t.midi && !t.inst); for (const t of S.tracks) { t.inserts = t.inserts || [] }
  S.panel.on = true; S.panel.tab = 'patch'; S.panel.h = H < 900 ? 232 : 316; setView(true); dirtyAll(); flush()`)
const where = () => ev(`flush(); const el = document.getElementById('picker'), r = el.getBoundingClientRect(), k = board.getBoundingClientRect().width / W, cats = [...document.querySelectorAll('.pk-cat')].map(c => [c.dataset.cat, c.querySelector('b').textContent, +c.querySelector('span').textContent, c.classList.contains('on')])
  const rows = [...document.querySelectorAll('.pk-row')].map(x => [x.querySelector('b').textContent, x.querySelector('i').textContent]), clip = document.querySelector('#g-dock clipPath rect')
  return { open: S.picker.open, hidden: el.hidden, in: el.classList.contains('in'), box: [r.left / k, r.top / k, r.width / k, r.height / k].map(v => Math.round(v)), panel: [Math.round(BY + PH), Math.round(S.panel.h - PH), RX - SIDE], cats, rows, head: document.getElementById('pk-head').textContent, chainW: clip ? +clip.getAttribute('width') : null, catsShown: !document.getElementById('pk-cats').hidden, focus: document.activeElement && document.activeElement.id }`)

/* opened from the patch itself */
{ const p = await ev(`flush(); const el = document.querySelector('#g-dock [data-a="plugs"]'), r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, clip: +document.querySelector('#g-dock clipPath rect').getAttribute('width') }`)
  await b.click(p.x, p.y); await b.sleep(250)
  const s = await where()
  ok('pressed for on a patch, the list is open', s.open && !s.hidden, s.head)
  ok('it stands inside the panel: under the panel’s bar, down to the panel’s foot', s.in && s.box[1] === s.panel[0] && s.box[3] === s.panel[1], [s.box, s.panel])
  ok('…at the right of the chain, up against the strip', s.box[0] + s.box[2] === s.panel[2] && s.box[0] > 200, [s.box, s.panel])
  ok('the chain keeps clear of it', s.chainW === s.box[0] && p.clip === s.panel[2], [p.clip, s.chainW, s.box[0]])
  ok('the search field has the keys', s.focus === 'pk-q', s.focus)
  ok('the kinds stand down its left, all of them first', s.catsShown && s.cats[0][0] === 'all' && s.cats[0][3] && s.cats.length > 8, s.cats.map(c => c[0] + ' ' + c[2]))
  ok('all: the prints, then every effect (no instrument)', s.cats[0][2] === 3 + LIST.length - 1 && s.rows.length === s.cats[0][2] && s.rows.slice(0, 3).every(r => r[1] === 'print') && !s.rows.some(r => r[0] === 'serum 2'), [s.cats[0][2], s.rows.length])
  ok('the numbers of the kinds add up to all', s.cats.slice(1).reduce((n, c) => n + c[2], 0) === s.cats[0][2], s.cats.map(c => c[2]))
  const kinds = await ev(`return Object.fromEntries(S.picker.list.filter(p => !p.inst).map(p => [p.name.toLowerCase(), plugCat(p)]))`)
  const wrong = Object.entries(WANT).filter(([k, v]) => kinds[k] !== v).map(([k, v]) => k + ': ' + kinds[k] + ' not ' + v)
  ok('each is filed under what it is (an 1176 a compressor, a Pultec an equalizer, a plate a reverb)', !wrong.length, wrong) }

/* a kind pressed */
const pressCat = async c => { const p = await ev(`const el = document.querySelector('.pk-cat[data-cat="${c}"]'), r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }`); await b.click(p.x, p.y); await b.sleep(120) }
{ await pressCat('reverb')
  const s = await where()
  ok('reverb pressed: only the reverbs, the room’s own space among them', s.open && s.cats.find(c => c[0] === 'reverb')[3] && s.rows.length === 6 && s.rows[0][0] === 'space' && s.rows.every(r => /space|verb|plate|pro-r|emt|lexicon/.test(r[0])), s.rows.map(r => r[0]))
  ok('…the list is still open, and the keys are the search field’s again', s.open && s.focus === 'pk-q', s.focus)
  await pressCat('dynamics')
  const d = await where()
  ok('dynamics: the compressors and limiters', d.rows.length === 4 && d.rows.every(r => /pro-c|pro-l|fairchild|la-2a/.test(r[0])), d.rows.map(r => r[0])) }

/* typed: looked for among all the kinds */
{ await b.type('valh'); await b.sleep(150)
  const s = await where()
  ok('typing looks among all the kinds again', s.cats[0][3] && s.rows.length === 3 && s.rows.every(r => r[0].startsWith('valhalla')), s.rows.map(r => r[0]))
  ok('…and the kinds count what was found', JSON.stringify(s.cats.map(c => [c[0], c[2]])) === JSON.stringify([['all', 3], ['reverb', 2], ['delay', 1]]), s.cats.map(c => [c[0], c[2]]))
  await pressCat('delay')
  const d = await where()
  ok('a kind pressed then narrows what was found', d.rows.length === 1 && d.rows[0][0] === 'valhalladelay', d.rows) }

/* the panel made taller: the list goes with it */
{ await ev(`S.panel.h = 420; setView(true); dirtyAll(); flush()`)
  const s = await where()
  ok('the panel made taller, the list is as tall and still in its place', s.box[1] === s.panel[0] && s.box[3] === s.panel[1] && s.panel[1] > 290 - (H < 900 ? 80 : 0), [s.box, s.panel])
  await b.shot(`picker-${W}.png`) }

/* escape closes it and the chain has its room back */
{ await b.press('Escape', 'Escape', 27); await b.sleep(120)
  const s = await where()
  ok('escape closes it; the chain has all of its room again', !s.open && s.hidden && s.chainW === s.panel[2], [s.open, s.chainW]) }

/* from the new-track list it is the card beside that list, as before, with no kinds */
{ await ev(`openNewTrack(); flush(); openPicker('new')`); await b.sleep(200)
  const s = await where()
  ok('asked for from the new-track list it is a card beside that list, without the kinds', s.open && !s.in && !s.catsShown && s.box[0] === 302 && s.box[2] === 304 && s.rows.some(r => r[0] === 'serum 2'), [s.box, s.in])
  await ev(`closeNewTrack(); flush()`) }

{ const errs = await ev(`return window.__errs || []`)
  ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n'))
console.log(bad.length ? `picker: ${bad.length} FAILED\n  ${bad.join('\n  ')}` : 'picker: all passed')
await b.close()
process.exit(bad.length ? 1 : 0)
