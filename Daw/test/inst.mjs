// node test/inst.mjs — the room's own instruments opened where the patch stands: the plate at the head of the patch, the
// synth's sounds picked by their pictures, its wave, filter and loudness taken hold of on their drawings, the kit's pads
// and the chosen pad's stroke, the sampler's marks; and the way back to the chain. A real pointer throughout.
import { open, PAGE } from './cdp.mjs'
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.sleep(500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
const ALT = 1
const at = async (sel, fx = .5, fy = .5) => ev(`const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; const r = el.getBoundingClientRect(), x = r.left + r.width * ${fx}, y = r.top + r.height * ${fy}, top = document.elementFromPoint(x, y); return { x, y, w: r.width, h: r.height, l: r.left, t: r.top, hit: top === el, top: top ? (top.dataset && top.dataset.a) || top.tagName : null }`)
const click = async (sel, mods = 0, fx = .5, fy = .5) => { const p = await at(sel, fx, fy); if (!p) { bad.push('missing ' + sel); out.push('FAIL missing ' + sel); return null } if (!p.hit) { bad.push('covered ' + sel); out.push(`FAIL covered ${sel} by ${p.top}`) } await b.click(p.x, p.y, mods); await b.sleep(40); return p }
const dragAt = async (x, y, dx, dy, mods = 0) => { await b.dragTo(x, y, x + dx, y + dy, 8, mods); await b.sleep(60) }
const P = k => ev(`flush(); return S.tracks[S.sel].inst.p[${JSON.stringify(k)}]`)
const near = (x, y, e = 1e-6) => Math.abs(x - y) < e

// a track of notes, its patch open
await ev(`const t = newInstTrack('synth', 'e piano'); if (!S.panel.on || S.panel.tab !== 'patch') togglePanel('patch'); setView(true); flush(); return t.name`)
ok('at the head of the patch the instrument is a plate with its picture, not a frame with its name', await ev(`const g = document.getElementById('g-dock').innerHTML; return !!document.querySelector('[data-a="inst"]') && g.includes('scale(') && !instOpen()`))
await click('[data-a="inst"]')
ok('pressed, it opens where the patch stands: its face, fourteen sounds, the wave, the filter, the loudness', await ev(`flush(); return instOpen() && document.querySelectorAll('[data-a="iv"][data-k="sound"]').length === 14 && ['filter', 'env', 'vib', 'glide', 'mix'].every(k => !!document.querySelector('[data-a="iv"][data-k="' + k + '"]'))`), await ev(`return [instOpen(), document.querySelectorAll('[data-a="iv"]').length]`))
ok('the panel\'s bar says which instrument, and has the key back to the chain', await ev(`return !!document.querySelector('[data-a="iv"][data-k="chain"]') && document.getElementById('g-dock').textContent.includes('e piano')`))

// a sound picked by its picture
await click('[data-a="iv"][data-k="sound"][data-v="strings"]')
ok('a sound is picked by its picture', await ev(`flush(); const t = S.tracks[S.sel]; return t.inst.sound === 'strings' && Object.keys(t.inst.p).length === 0 && instOpen()`), await ev('return S.tracks[S.sel].inst'))

// the filter: taken hold of on its drawing
{ const p = await at('[data-a="iv"][data-k="filter"]')
  await dragAt(p.x, p.y, -60, 0)
  const c1 = await P('cutoff')
  ok('the filter\'s plate pulled to the left: the cutoff comes down', c1 > 20 && c1 < 2600, c1)
  await dragAt(p.x, p.y, 0, -40)
  const r1 = await P('reso')
  ok('pulled up: more resonance', r1 > .15, r1)
  await b.click(p.x, p.y, ALT); await b.sleep(60)
  ok('with option, a press puts the filter back where the sound has it', (await P('cutoff')) === undefined && (await P('reso')) === undefined, await ev('return S.tracks[S.sel].inst.p')) }

// the loudness: the mark nearest the hand moves
{ const g = await ev(`flush(); const q = IV.g.env, r = document.getElementById('board').getBoundingClientRect(), k = r.width / W; return { marks: q.marks.map(m => [r.left + m[0] * k, r.top + m[1] * k, m[2]]) }`)
  const a = g.marks.find(m => m[2] === 'a'), d = g.marks.find(m => m[2] === 'd'), rl = g.marks.find(m => m[2] === 'r')
  await dragAt(a[0], a[1] + 2, 24, 0)
  const aA = await P('aA')
  ok('the first mark pulled right: a slower attack', aA > .22, aA)
  await dragAt((d[0] + g.marks.find(m => m[2] === 's')[0]) / 2 + 12, d[1] + 1, 0, 30)
  const aS = await P('aS')
  ok('the held level pulled down: it is held lower', aS < .9 && aS >= 0, aS)
  await dragAt(rl[0] - 1, rl[1] - 2, 20, 0)
  ok('the last mark pulled right: a longer release', (await P('aR')) > .6, await P('aR')) }

// the wave: its two shapes, and how much of each
await click('[data-a="iv"][data-k="wave1"][data-v="1"]')
ok('the first oscillator\'s shape picked by its drawing', (await P('wave1')) === 1)
{ const p = await at('[data-a="iv"][data-k="mix"]', .5, .5)
  await b.click(p.l + p.w * .8, p.y); await b.sleep(60)
  const m = await P('mix')
  ok('the line between the two pressed four fifths along: mostly the second', m > .7 && m <= 1, m) }
await click('[data-a="iv"][data-k="mono"][data-v="1"]')
ok('one voice', (await P('mono')) === 1)
{ const p = await at('[data-a="iv"][data-k="vib"]'); await dragAt(p.x, p.y, 0, -30); ok('the wavering pulled up', (await P('vib')) > .3, await P('vib')) }
{ const p = await at('[data-a="iv"][data-k="glide"]'); await dragAt(p.x, p.y, 40, 0); ok('the slide pulled out', (await P('glide')) > .05, await P('glide')) }

// back to the chain, and in again
await click('[data-a="iv"][data-k="chain"]')
ok('the chain key goes back to the patch', await ev(`flush(); return !instOpen() && !!document.querySelector('[data-a="inst"]') && !!document.querySelector('[data-a="inst-pick"]')`))
await click('[data-a="inst-pick"]')
ok('change, under the plate, still opens the list of instruments', await ev(`return !document.getElementById('picker').hidden && S.picker.what === 'inst'`))
await ev(`closePicker(); flush()`)

// the kit
await ev(`const t = newInstTrack('drums'); flush(); return t.name`)
ok('a kit\'s plate at the head of its patch', await ev(`return !!document.querySelector('[data-a="inst"]') && !instOpen()`))
await click('[data-a="inst"]')
ok('opened: sixteen pads, each a drum', await ev(`flush(); return instOpen() && document.querySelectorAll('[data-a="iv"][data-k="pad"]').length >= 16`), await ev(`return document.querySelectorAll('[data-a="iv"][data-k="pad"]').length`))
await click('[data-a="iv"][data-k="pad"][data-v="5"]')
ok('a pad pressed is the chosen pad', await ev(`flush(); return IV.pad.get(S.tracks[S.sel].id) === 5 && IV.g.stroke.pad === 'hat'`), await ev('return [IV.pad.get(S.tracks[S.sel].id), IV.g.stroke && IV.g.stroke.pad]'))
{ const g = await ev(`const q = IV.g.stroke, r = document.getElementById('board').getBoundingClientRect(), k = r.width / W; return q.marks.map(m => [r.left + m[0] * k, r.top + m[1] * k, m[2]])`)
  const dm = g.find(m => m[2] === 'decay'), lm = g.find(m => m[2] === 'level')
  await dragAt(dm[0], dm[1], 60, 0)
  ok('its tail pulled out: it rings longer', (await P('hat.decay')) > 1.2, await P('hat.decay'))
  await dragAt(lm[0] + 2, lm[1], 0, 20)
  ok('its height pulled down: it is quieter', (await P('hat.level')) < -3, await P('hat.level')) }
{ const p = await at('[data-a="iv"][data-k="ptune"]'); await b.click(p.l + p.w * .9, p.y); await b.sleep(60); ok('its tuning pressed towards the right: higher', (await P('hat.tune')) > 8, await P('hat.tune')) }
{ const p = await at('[data-a="iv"][data-k="ppan"]'); await b.click(p.l + p.w * .15, p.y); await b.sleep(60); ok('its place pressed towards the left', (await P('hat.pan')) < -.4, await P('hat.pan')) }
await click('[data-a="iv"][data-k="padsound"]')
ok('its sound: a list, with made here chosen', await ev(`return !!S.menu && S.menu.items[0].t === 'made here' && S.menu.items[0].on === true`))
await ev(`S.menu = null; uiDirty('menu'); flush()`)

// the sampler
await ev(`const t = newInstTrack('sampler'); t.inst.sample = { file: 'x.wav', name: 'ooh', peaks: Array.from({ length: 80 }, (_, i) => Math.exp(-i / 30)) }; flush(); return t.name`)
ok('with an instrument open, going to another track of notes shows that one\'s instrument: the sampler — its machine, its sound with a start and an end, its loudness', await ev(`uiDirty('dock'); flush(); return instOpen() && !!IV.g.sm && !!IV.g.senv && !!document.querySelector('[data-a="iv"][data-k="smsound"]')`))
{ const p = await at('[data-a="iv"][data-k="sm"]', .5, .5)
  await dragAt(p.l + 8, p.y, p.w * .2, 0)
  const st = await P('start')
  ok('the start pulled in from the left', st > .12 && st < .3, st)
  await dragAt(p.l + p.w - 8, p.y, -p.w * .25, 0)
  const en = await P('end')
  ok('the end pulled in from the right', en < .85 && en > .6, en) }
await click('[data-a="iv"][data-k="loop"][data-v="1"]')
ok('told to go round: a stretch inside what plays is marked', await ev(`flush(); const p = S.tracks[S.sel].inst.p; return p.loop === 1 && p.loopStart > p.start && p.loopEnd < p.end && IV.g.sm.loop === true`), await ev('return S.tracks[S.sel].inst.p'))
await click('[data-a="iv"][data-k="oneShot"][data-v="1"]')
ok('to its end', (await P('oneShot')) === 1)
if (await at('[data-a="iv"][data-k="root"]')) { const p = await at('[data-a="iv"][data-k="root"]', .5, .5); await b.click(p.l + p.w - 4, p.t + p.h - 3); await b.sleep(60); ok('its own key picked on the small keyboard', (await P('root')) > 60, await P('root')) }

// what was turned is kept with the track, and written with the project
ok('a project keeps what was turned on each instrument', await ev(`const d = JSON.parse(serialize()); const k = d.tracks.find(t => t.inst && t.inst.kind === 'drums'), s = d.tracks.find(t => t.inst && t.inst.kind === 'synth'), m = d.tracks.find(t => t.inst && t.inst.kind === 'sampler'); return k.inst.p['hat.decay'] > 1.2 && s.inst.sound === 'strings' && s.inst.p.mono === 1 && m.inst.p.loop === 1`))
// room: with the panel at its smallest, and with slur open beside it (a narrower panel), every control of each instrument
// stands inside the panel, clear of the strips, under nothing, and on no other control
{ const room = async label => {
    for (const kind of ['synth', 'drums', 'sampler']) {
      const r = await ev(`leadTrack(S.tracks.findIndex(t => t.inst && t.inst.kind === '${kind}')); dirtyAll(); flush()
        const bd = document.getElementById('board').getBoundingClientRect(), k = bd.width / W, top = bd.top + (BY + PH) * k, bot = bd.top + (BY + S.panel.h) * k, right = bd.left + (RX - SIDE) * k
        const els = [...document.querySelectorAll('[data-a="iv"]')].filter(e => e.dataset.k !== 'none' && e.dataset.k !== 'chain'), bad = [], q = els.map(e => e.getBoundingClientRect())
        els.forEach((e, i) => { const a = q[i], name = e.dataset.k + (e.dataset.v ? ':' + e.dataset.v : '')
          if (a.bottom > bot + .5 || a.top < top - .5) bad.push(name + ' outside the panel'); if (a.right > right + .5) bad.push(name + ' under the strips')
          const at = document.elementFromPoint(a.left + a.width / 2, a.top + a.height / 2); if (at !== e) bad.push(name + ' under ' + (at ? (at.dataset && at.dataset.k) || at.tagName : 'nothing'))
          for (let j = i + 1; j < els.length; j++) { const c = q[j]; if (Math.min(a.right, c.right) - Math.max(a.left, c.left) > 1 && Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top) > 1) bad.push(name + ' on ' + els[j].dataset.k) } })
        return { n: els.length, bad }`)
      ok(`${label}: the ${kind === 'drums' ? 'kit' : kind}'s controls all have room`, r.n >= 6 && r.bad.length === 0, r.bad.slice(0, 5))
    } }
  const h0 = await ev('return S.panel.h')
  await ev(`S.panel.inst = true; S.panel.h = MIN_PANEL; relayout(); dirtyAll(); flush()`); await room('the panel at its smallest')
  await ev(`toggleSlur(); setView(true); relayout(); dirtyAll(); flush()`); await room('at its smallest, with slur open beside it')
  await ev(`S.panel.h = ${h0}; relayout(); dirtyAll(); flush()`); await room('with slur open beside it')
  await ev(`toggleSlur(); setView(true); relayout(); dirtyAll(); flush()`) }
// a track of sound: its patch is its patch, whatever was open
await ev(`leadTrack(0); uiDirty('dock', 'head'); flush()`)
ok('on a track of sound the patch is the patch', await ev(`return !instOpen() && !document.querySelector('[data-a="iv"]') && !document.querySelector('[data-a="inst"]')`))
ok('no errors on the page', (await ev('return window.__errs')).length === 0 && b.errors.length === 0, [await ev('return window.__errs'), b.errors])
console.log(out.join('\n')); console.log(bad.length ? `\n${bad.length} FAILED` : '\nall passed')
await b.close()
