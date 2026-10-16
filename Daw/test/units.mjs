// node test/units.mjs — a print's amount and its hands are Patch on Slur's: said in its units, as its own catalog says them
// (printCatalog.ts, which its study draws from and which every build brings here as ui/catalog.js) — a space's decay in
// seconds for each of its rooms, a comp's threshold in db, a cut in hz, a pan as left and right…; every print's hands on
// every flavour are its study's, in its order and words; what is typed comes back to the same place; a hand set here writes
// what the plug-in's study writes.
import { open, PAGE } from './cdp.mjs'
setTimeout(() => { console.log('units: TIMED OUT'); process.exit(2) }, 90000)
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(400)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
/* the plug-in's own words are its catalog (PATCH_CATALOG, made from printCatalog.ts on every build): the wall must say what
   it says, once the room's way of writing is taken off (lowercase, a space before the unit, a true minus, a unit named) */
const plain = s => String(s).toLowerCase().replace(/−/g, '-').replace(/\s+/g, '').replace(/(hz|db)$/, '')      // (where the plug-in leaves the unit unsaid — a gain's db, a ring's hz — the room names it)
const room = await ev(`const res = []; for (const k of WALL_PRINTS) { if (k === 'meter' || k === 'side' || k === 'mix' || WALL_TWO.has(k)) continue; const vs = Math.max(1, wallFlavours(k).length); for (const a of [0, .1, .25, .5, .62, .75, .9, 1]) for (let v = 0; v < vs; v++) res.push([k, a, v, PATCH_CATALOG.fmtValue(WALL_TYPE[k], a, v), wallAmountText(k, a, v)]) } return res`)
const off = room.filter(([k, a, v, want, got]) => plain(want) !== plain(got).replace(/hz$/, ''))
ok('every print’s amount is said as Patch on Slur says it, on every flavour (the room’s way of writing aside)', room.length > 300 && !off.length, off.slice(0, 8))
/* every hand of every print on the wall, on every flavour: the same hands, in the same order, named the same, with the
   same words to choose from and the same value said, as the plug-in's study has them */
const all = await ev(`const res = []; for (const k of WALL_PRINTS) { if (k === 'meter') continue; const vs = Math.max(1, wallFlavours(k).length); for (let v = 0; v < vs; v++) { const node = Object.assign(wallNew(k, 0, 0), { variant: v }), n = wallAsNode(node)
    const theirs = PATCH_CATALOG.studyHandsOf(n).filter(c => c.at !== 'amount').map(c => [c.key, PATCH_CATALOG.valueOf(c.label, n), c.kind === 'choice' ? PATCH_CATALOG.valueOf(c.options, n) : c.kind === 'switch' ? ['off', 'on'] : null, c.kind === 'gauge' ? (c.format ? c.format(c.get(n), n) : String(c.get(n)) + (c.unit ? ' ' + c.unit : '')) : c.kind === 'switch' ? (c.get(n) ? 'on' : 'off') : c.get(n) < 0 && c.none ? c.none : PATCH_CATALOG.valueOf(c.options, n)[c.get(n)]])
    const ours = wallHands(k, node).map(h => [h.c.key, h.label, h.opts || null, wallHandText(node, h)])
    res.push([k, v, theirs, ours]) } } return res`)
const lower = x => JSON.stringify(x).toLowerCase()
const apart = all.filter(([k, v, theirs, ours]) => theirs.length !== ours.length || theirs.some((t, i) => t[0] !== ours[i][0] || t[1].toLowerCase() !== ours[i][1] || lower(t[2]) !== lower(ours[i][2]) || plain(t[3]) !== plain(ours[i][3])))
ok('every print’s hands, on every flavour: the plug-in’s study’s, in its order, its names, its words, its values', all.length > 60 && !apart.length, apart.slice(0, 3))
const said = await ev(`const r = {}; for (const v of [0, 1, 2]) for (const d of [0, 25, 50, 75, 100]) r[v + ':' + d] = PATCH_CATALOG.fmtDecay(v, d / 100); return r`)
const dec = await ev(`const r = []; for (const v of [0, 1, 2]) for (const d of [0, 25, 50, 75, 100]) { const node = { k: 'space', variant: v, decay: [d / 100, d / 100, d / 100] }; r.push([v, d, wallHandText(node, wallHands('space', node).find(h => h.h === 'decay'))]) } return r`)
ok('a space’s decay is said in seconds, for each of its rooms, as the plug-in works them out', dec.every(([v, d, got]) => /^\d+\.\d+ s$/.test(got)) && dec.every(([v, d, got]) => plain(got) === plain(said[v + ':' + d])), dec.slice(0, 6))
const back = await ev(`const r = []; for (const v of [0, 1, 2]) { const node = { k: 'space', variant: v, decay: [.37, .37, .37] }, h = wallHands('space', node).find(h => h.h === 'decay'); const said = wallHandText(node, h); r.push([v, said, h.parse(said, node)]) } return r`)
ok('…and a decay typed in seconds goes back to the same place', back.every(x => Math.abs(x[2] - .37) <= .01), back)
const hands = await ev(`const n = (k, o) => Object.assign(wallNew(k, 0, 0), o), say = (node, h) => wallHandText(node, wallHands(node.k, node).find(x => x.h === h)); return {
  attackShort: say(n('comp', { aux: [40, 25, 150, 6, 3] }), 'aux1'), attackLong: say(n('comp', { aux: [40, 250, 150, 6, 3] }), 'aux1'), ratio: say(n('comp', { aux: [40, 100, 150, 6, 3] }), 'aux0'), knee: say(n('comp', { aux: [40, 100, 150, 6, 3] }), 'aux3'), makeup: say(n('comp', { aux: [40, 100, 150, 6, 3] }), 'aux4'),
  from: say(n('carve', { aux: [20, 200, 2500, 20000] }), 'aux2'), to: say(n('carve', { aux: [20, 200, 2500, 20000] }), 'aux3'), shift: say(n('shift', { aux: [200, 0] }), 'aux0'), cents: say(n('pitch', { aux: [12, 0] }), 'aux0'),
  degrees: say(n('harmony', { aux: [0, 0, 2] }), 'aux2'), unison: say(n('harmony', { aux: [0, 0, 0] }), 'aux2'), semis: say(n('harmony', { variant: 1, aux: [0, 0, 7] }), 'aux2'), repeatHz: say(n('repeat', { aux: [1, 3, 0, 200, -30] }), 'aux3'),
  labels: Object.fromEntries(['tape', 'space', 'mod', 'delay', 'arp', 'swell', 'gate', 'wow'].map(k => [k, (wallHands(k).find(h => h.h === 'variant') || {}).label])) }`)
ok('a comp’s hands: attack in ms (tenths under ten), ratio, knee and makeup in db', hands.attackShort === '2.5 ms' && hands.attackLong === '25 ms' && hands.ratio === '4.0:1' && hands.knee === '6.0 db' && hands.makeup === '+3.0 db', hands)
ok('a carve’s band in hz as the plug-in writes it; a shift and a pitch’s cents with their sign; a harmony in degrees or semitones', hands.from === '2.50k hz' && hands.to === '20.0k hz' && hands.shift === '+200 hz' && hands.cents === '+12 c' && hands.degrees === '+2' && hands.unison === '0 unison' && hands.semis === '+7 st' && hands.repeatHz === '2.00 hz', hands)
ok('flavours named as the plug-in names them', JSON.stringify(hands.labels) === JSON.stringify({ tape: 'drive', space: 'room', mod: 'kind', delay: 'type', arp: 'order', swell: 'floor', gate: 'release', wow: 'motion' }), hands.labels)
const typed = await ev(`return { gate: wallAmountParse('gate', '−24 db'), comp: wallAmountParse('comp', '-30 db'), pan: wallAmountParse('pan', 'l 40'), centre: wallAmountParse('pan', 'centre'), cut: wallAmountParse('cut', '2.5k hz', 1), swell: wallAmountParse('swell', '1.50 s'), ring: wallAmountParse('ring', '440 hz'), pitch: wallAmountParse('pitch', '+7 st'), plain: wallAmountParse('tape', '30'), held: wallAmountParse('freeze', 'held'), all: wallAmountParse('sieve', 'all') }`)
const round = v => Math.round(v * 1000) / 1000
ok('what is typed in those units comes back to the amount that is said so', round(typed.gate) === .6 && round(typed.comp) === .5 && round(typed.pan) === .3 && typed.centre === .5 && Math.abs(typed.cut - Math.log(20000 / 2500) / Math.log(1000)) < 1e-6 && Math.abs(.02 * Math.pow(75, typed.swell) - 1.5) < 1e-6 && Math.abs(20 * Math.pow(2, typed.ring * 8) - 440) < 1e-6 && Math.abs(typed.pitch - (7 / 24 + .5)) < 1e-6 && typed.plain === .3 && typed.held === 1 && typed.all === 0, typed)
/* a hand set from the wall writes what the plug-in's study writes: a tremolo's shape draws its curve, a swell's depth says it is set */
const wrote = await ev(`const tr = wallNew('tremolo', 0, 0), hs = wallHands('tremolo', tr), shape = hs.find(h => h.h === 'aux2'); wallHandSet(tr, shape, 8); const sw = wallNew('swell', 0, 0); wallHandSet(sw, wallHands('swell', sw).find(h => h.h === 'aux0'), 60)
  const g = wallNew('gain', 0, 0), [l, r] = wallHands('gain', g); wallHandSet(g, r, 1); wallHandSet(g, r, 1); const msg = wallMsg({ id: 7, wall: { nodes: [Object.assign(tr, { id: 0 })], wires: [] }, patch: NO_PATCH() })
  return { opt: shape.opts[8], aux2: tr.aux[2], curve: Array.isArray(tr.curve) && tr.curve.length === PATCH_CATALOG.CURVE_LEN, variant: tr.variant, sent: !!(msg && msg.nodes[0] && msg.nodes[0].curve), swell: sw.aux.slice(0, 2), gain: g.variant, labels: [l.label, r.label] }`)
ok('a hand set here writes what the plug-in’s study writes (a tremolo’s shape draws its curve and the engine is told it; a swell’s depth; a phase thrown once)', wrote.opt === 'gallop' && wrote.aux2 === 8 && wrote.curve && wrote.variant === 4 && wrote.sent && JSON.stringify(wrote.swell) === '[60,1]' && wrote.gain === 2 && wrote.labels.join() === 'ø left,ø right', wrote)
{ const errs = await ev(`return window.__errs || []`); ok('nothing went wrong on the page', !errs.length && !b.errors.length, [errs, b.errors]) }
console.log(out.join('\n'))
console.log(bad.length ? `units: ${bad.length} FAILED\n  ${bad.join('\n  ')}` : 'units: all passed')
process.exit(bad.length ? 1 : 0)
