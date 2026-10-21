/* ── groups: tracks bound by a name (groups draft 1, approved 2026-10-16) ──
   A group is the tracks that carry one letter (t.grp). Its name, whether it is on, and what it shares stand on each of
   its tracks alike (t.gm) — so a track takes its group along into undo and into the song file, and a group lasts as long
   as two of its tracks do. What can be shared, each thing by itself:
     editing      choosing, cutting, moving, trimming, fades, the song's time, alternatives (edit.js: groupMates)
     region gain  the gain of a region, on the same stretch of the others
     rubato       pins and quantize, and how the tracks are stretched (flex.js, rubato.js)
     automation   a line drawn on one is drawn on the others: volume by as much (each keeps its own level), the rest as it is
     volume       a fader moved moves the others' by as much
     pan          a pan moved moves the others' by as much
     mute, solo   pressed on one, pressed on all
     record       armed on one, armed on all (and listening to the input)
   Its name stands after each track's name, in the colour of its first track; pressed, the group's card opens. ⌘G makes a
   group of the chosen tracks (all of one group chosen: its card opens); ⇧G lets go of every group for a while.
   A strip in the mixer and the inspector's say a track's group in a row of their own (mix.js). Pressed twice there, or on
   the name after a track's name, the group is named where it stands; the other button gives what it can share, each on or
   off, as Logic's group settings do (his ask, 2026-10-22).
   Read after edit.js, mix.js, rubato.js and ui.js. */
const GRP_SHARES = ['editing', 'region gain', 'rubato', 'automation', 'volume', 'pan', 'mute', 'solo', 'record']
for (const keep of [typeof KEEP_T !== 'undefined' ? KEEP_T : null, typeof T_KEEP !== 'undefined' ? T_KEEP : null]) if (keep && !keep.includes('gm')) keep.push('gm')
const GRP_LETTERS = 'abcdefghijklmnopqrstuvwxyz'
const grpTracks = g => S.tracks.filter(t => t.grp === g && t.kind === 'audio')
function grpMeta (g) {
  const m = (grpTracks(g).find(t => t.gm) || {}).gm
  const share = {}
  for (const k of GRP_SHARES) share[k] = !(m && m.share && m.share[k] === false)
  return { name: m && m.name ? m.name : `group ${GRP_LETTERS.indexOf(g) + 1}`, on: !(m && m.on === false), share }
}
/* whether a track shares `what` with its group now */
const grpShares = (t, what) => !!t && !!t.grp && t.kind === 'audio' && !S.grpOff && grpMeta(t.grp).on && grpMeta(t.grp).share[what] !== false
/* what a group is, written onto every track of it */
function grpSet (g, patch) {
  const m = Object.assign(grpMeta(g), patch)
  for (const t of grpTracks(g)) t.gm = { name: m.name, on: m.on, share: Object.assign({}, m.share) }
}
const grpColour = g => (grpTracks(g)[0] || {}).c || INK
/* a group of one is no group */
function grpTidy () { for (const g of new Set(S.tracks.map(t => t.grp).filter(Boolean))) { const m = S.tracks.filter(t => t.grp === g); if (m.length < 2) for (const t of m) { t.grp = null; delete t.gm } } }

/* ── ⌘G ── */
function grpMake () {
  const ts = chosen().filter(t => t.kind === 'audio')
  const one = ts.length && ts[0].grp && ts.every(t => t.grp === ts[0].grp) ? ts[0].grp : null
  if (one) { grpOpen(one, S.tracks.indexOf(ts[0])); return }                              // (all of one group: its card)
  if (ts.length < 2) { say(ts.length ? 'choose two tracks or more to group them' : 'choose the tracks to group'); return }
  const used = new Set(S.tracks.filter(t => !ts.includes(t)).map(t => t.grp).filter(Boolean)), g = GRP_LETTERS.split('').find(c => !used.has(c)) || 'z'
  const n = new Set(S.tracks.map(t => t.grp).filter(x => x && x !== g)).size + 1
  edit(() => { for (const t of ts) { t.grp = g; delete t.gm } grpSet(g, { name: `group ${n}`, on: true }); grpTidy() })
  grpOpen(g, S.tracks.indexOf(ts[0]), true)
}

/* ── the name after a track's name ── */
const grpChipW = t => tw(fit(grpMeta(t.grp).name, 64, 8.5, 500), 8.5, 500) + 18
function grpChip (t, i, x, by) {
  const m = grpMeta(t.grp), c = grpColour(t.grp), off = S.grpOff || !m.on, word = fit(m.name, 64, 8.5, 500), w = tw(word, 8.5, 500) + 11
  let s = R(x + .5, by - 10.5, w, 14, { rx: 7, fill: c, fa: off ? .1 : .55, stroke: c, sa: off ? .3 : 1 }) + T(x + 6, by - .6, word, { size: 8.5, w: 500, a: off ? .3 : .92 })
  if (GCARD && GCARD.g === t.grp && GCARD.i === i) s += R(x - 1, by - 12, w + 3, 17, { rx: 8.5, stroke: INK, sa: .8 })
  return s + hit(x - 2, by - 13, w + 6, 20, 'grp-chip', ` data-i="${i}"`)
}

/* ── its card ── */
let GCARD = null                                                                         // { g, i: the track whose name was pressed }
function grpOpen (g, i, typing) { GCARD = { g, i }; uiDirty('menu', 'head'); if (typing) setTimeout(grpName, 0) }
const grpClose = () => { if (GCARD) { GCARD = null; uiDirty('menu', 'head') } }
const GC_W = 268
function grpCardBox () {
  if (!GCARD || !grpTracks(GCARD.g).length) return null
  const members = grpTracks(GCARD.g), L = rowTops(), k = L.r.indexOf(GCARD.i)
  const h = 14 + 34 + 16 + 10 + Math.ceil(GRP_SHARES.length / 2) * 22 + 10 + 16 + 8 + members.length * 20 + 8 + 20 + 18
  const rowTop = k >= 0 ? TY + L.tops[k] - VY : TY + 40, below = rowTop + (k >= 0 ? rowH(GCARD.i) : 0) + 2
  const y = below + h <= H - 8 ? below : Math.max(8, rowTop - h - 2)
  return { x: clamp(150, 8, RX - GC_W - 8), y, w: GC_W, h, members }
}
function pGrpCard () {
  const b = grpCardBox()
  if (!b) return ''
  const m = grpMeta(GCARD.g), { x, w, h, members } = b
  let s = hit(0, 0, W, H, 'gc-close', '', 'default') + R(x, b.y, w, h, { rx: 3, fill: K2 }) + R(x + .5, b.y + .5, w - 1, h - 1, { rx: 3, stroke: INK, sa: .26 }) + hit(x, b.y, w, h, 'gc-pane', '', 'default')
  let y = b.y + 14
  GCARD.nameAt = { x: x + 30, y: y - 3, w: 150, h: 20 }
  s += R(x + 12, y, 10, 10, { rx: 5, fill: grpColour(GCARD.g) }) + T(x + 30, y + 9.5, m.name, { size: 12.5, w: 500 }) + P(`M${x + 30} ${y + 15.5}H${x + 160}`, { stroke: INK, sa: .14 }) + hit(x + 28, y - 4, 136, 22, 'gc-name', '', 'text')
  s += miniCells(x + w - 12 - 52, y - 2, [{ t: 'on', on: m.on }, { t: 'off', on: !m.on }], 26, 15, 9, 0)
  s += hit(x + w - 64, y - 3, 26, 17, 'gc-on', ' data-v="1"') + hit(x + w - 38, y - 3, 26, 17, 'gc-on', ' data-v="0"')
  y += 34
  s += hline(x + 12, x + w - 12, y, .1); y += 16
  s += T(x + 12, y, 'what is shared', { size: 9, a: .4 }); y += 10
  GRP_SHARES.forEach((k, j) => {
    const cx = x + 12 + (j % 2) * 128, cy = y + Math.floor(j / 2) * 22, on = m.share[k] !== false
    s += R(cx + .5, cy + 5.5, 11, 11, { rx: 2, stroke: INK, sa: on ? .9 : .32, fill: on ? INK : 'none' }) + (on ? P(`M${cx + 3} ${cy + 11}L${cx + 5.5} ${cy + 13.5}L${cx + 9.5} ${cy + 8}`, { stroke: K1, sw: 1.4, cap: 'round' }) : '') + T(cx + 19, cy + 14.5, k, { size: 10.5, a: on ? .92 : .45 })
    s += hit(cx, cy + 2, 122, 20, 'gc-share', ` data-k="${k}"`)
  })
  y += Math.ceil(GRP_SHARES.length / 2) * 22 + 10
  s += hline(x + 12, x + w - 12, y, .1); y += 16
  const can = chosen().some(t => t.kind === 'audio' && t.grp !== GCARD.g)
  s += T(x + 12, y, 'tracks', { size: 9, a: .4 }) + T(x + w - 12, y, '+ the chosen tracks', { size: 9.5, a: can ? .8 : .3, anchor: 'end' }) + (can ? hit(x + w - 120, y - 12, 110, 18, 'gc-add') : ''); y += 8
  for (const t of members) {
    s += R(x + 12, y + 5, 3, 12, { fill: t.c }) + T(x + 22, y + 15, fit(asGiven(t.name), w - 60, 10.5), { size: 10.5, a: .88 })
    s += P(`M${x + w - 20} ${y + 8}l6 6M${x + w - 14} ${y + 8}l-6 6`, { stroke: INK, sa: .45, cap: 'round' }) + hit(x + w - 26, y + 3, 18, 18, 'gc-out', ` data-t="${t.id}"`)
    y += 20
  }
  y += 8
  s += hline(x + 12, x + w - 12, y, .1); y += 20
  s += T(x + 12, y, 'delete the group', { size: 10.5, a: .6 }) + hit(x + 8, y - 13, 110, 18, 'gc-del') + T(x + w - 12, y, 'the tracks stay', { size: 9, a: .32, anchor: 'end' })
  return s
}
/* the group's name, typed where it stands: on its card, or in a strip's group row (at: the box, font: how it is set) */
function grpName () {
  const b = GCARD && grpCardBox()
  if (!b) return
  flush()
  grpNameAt(GCARD.g, GCARD.nameAt, '500 12.5px')
}
function grpNameAt (g, at, font) {
  const el = $('rename')
  if (!el || !at || !g) return
  el.style.cssText = `left:${n(at.x - 3)}px;top:${n(at.y)}px;width:${n(at.w)}px;height:${at.h}px;font:${font} var(--f);text-align:left`
  el.value = grpMeta(g).name; el.hidden = false; el.focus(); el.select()
  let live = false
  setTimeout(() => { live = true; if (!el.hidden && document.activeElement !== el) { el.focus(); el.select() } }, 0)
  const done = keep => {
    el.onblur = el.onkeydown = null; el.hidden = true
    const v = el.value.trim().slice(0, 32)
    if (keep && v && v !== grpMeta(g).name) edit(() => grpSet(g, { name: v }))
    uiDirty('menu', 'head')
  }
  el.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') done(true); else if (e.key === 'Escape') done(false) }
  el.onblur = () => { if (live) done(true) }
}

/* ── presses (ui.js hands them on through DOWN_MORE) ── */
var DOWN_MORE = typeof DOWN_MORE === 'object' && DOWN_MORE ? DOWN_MORE : {}
Object.assign(DOWN_MORE, {
  'grp-chip': (e, el) => { const i = +el.dataset.i, t = S.tracks[i]; if (!t || !t.grp) return; if (grpTwice('chip' + i)) { grpOpen(t.grp, i, true); return } if (GCARD && GCARD.g === t.grp && GCARD.i === i) grpClose(); else grpOpen(t.grp, i) },
  'mgrp': (e, el) => {                                                                   // a strip's group row: chosen; pressed twice, the group named there
    const i = +el.dataset.i, t = S.tracks[i]
    if (!t) return
    if (!isChosen(i)) leadTrack(i); else S.sel = i
    uiDirty('head', 'lanes', 'dock')
    if (t.grp && grpTwice('row' + i)) grpNameAt(t.grp, { x: +el.dataset.x + 6, y: +el.dataset.y - 2, w: Math.max(60, +el.dataset.w - 4), h: +el.dataset.h + 4 }, '400 9.5px')
  },
  'gc-close': () => grpClose(),
  'gc-pane': () => {},
  'gc-name': () => grpName(),
  'gc-on': (e, el) => { const on = el.dataset.v === '1', g = GCARD.g; if (grpMeta(g).on !== on) { edit(() => grpSet(g, { on })); uiDirty('menu', 'head') } },
  'gc-share': (e, el) => { const g = GCARD.g, k = el.dataset.k, share = Object.assign({}, grpMeta(g).share); share[k] = !share[k]; edit(() => grpSet(g, { share })); uiDirty('menu') },
  'gc-add': () => { const g = GCARD.g, meta = grpMeta(g), ts = chosen().filter(t => t.kind === 'audio' && t.grp !== g); if (!ts.length) return; edit(() => { for (const t of ts) t.grp = g; grpSet(g, meta); grpTidy() }); uiDirty('menu', 'head') },
  'gc-out': (e, el) => {
    const g = GCARD.g, t = S.tracks.find(x => String(x.id) === el.dataset.t)
    if (!t) return
    edit(() => { t.grp = null; delete t.gm; grpTidy() })
    if (!grpTracks(g).length) grpClose()
    uiDirty('menu', 'head')
  },
  'gc-del': () => { const g = GCARD.g; edit(() => { for (const t of grpTracks(g)) { t.grp = null; delete t.gm } }); grpClose(); say('the group is gone; its tracks stay') },
})
/* pressed twice on one thing within a moment */
const GRP_TWICE = { k: '', at: 0 }
function grpTwice (k) { const now = performance.now(), two = GRP_TWICE.k === k && now - GRP_TWICE.at < 380; GRP_TWICE.k = two ? '' : k; GRP_TWICE.at = now; return two }
/* the other button on a group (its row in a strip, or the name after a track's): what it shares, each on or off — the
   menu comes back after each, so several can be set in a row — its name, its card, and letting it go. On a track with no
   group: a group of the chosen tracks. */
function grpMenu (i, x, y) {
  const t = S.tracks[i]
  if (!t) return
  if (!t.grp) { openMenu(x, y, [{ t: 'group the chosen tracks', k: '⌘g', v: 'make', dim: chosen().filter(c => c.kind === 'audio').length < 2 }], () => grpMake(), { w: 200 }); return }
  const g = t.grp, m = grpMeta(g)
  const items = [{ t: 'group on', v: 'on', on: m.on }].concat(GRP_SHARES.map((k, j) => ({ t: k, v: 's:' + k, on: m.share[k] !== false, sep: j === 0 })), [{ t: 'rename', v: 'name', sep: true }, { t: 'its card', v: 'card' }, { t: 'delete the group', v: 'del' }])
  openMenu(x, y, items, it => {
    if (it.v === 'on') { edit(() => grpSet(g, { on: !grpMeta(g).on })); uiDirty('head', 'dock'); grpMenu(i, x, y) }
    else if (it.v.startsWith('s:')) { const k = it.v.slice(2), share = Object.assign({}, grpMeta(g).share); share[k] = !share[k]; edit(() => grpSet(g, { share })); uiDirty('head', 'dock'); grpMenu(i, x, y) }
    else if (it.v === 'name') grpOpen(g, i, true)
    else if (it.v === 'card') grpOpen(g, i)
    else if (it.v === 'del') { edit(() => { for (const x of grpTracks(g)) { x.grp = null; delete x.gm } }); grpClose(); say('the group is gone; its tracks stay'); uiDirty('head', 'dock') }
  }, { w: 168 })
}
{ const context0 = onContext
  onContext = function (e) {
    const el = e.target.closest ? e.target.closest('[data-a="mgrp"], [data-a="grp-chip"]') : null
    if (!el) return context0(e)
    e.preventDefault()
    const p = pt(e), i = +el.dataset.i
    grpMenu(i, p.x, p.y)
  } }
/* esc closes the card first */
if (typeof KEYS === 'object' && KEYS.Escape) { const esc0 = KEYS.Escape; KEYS.Escape = function () { if (GCARD && !S.menu) { grpClose(); return } return esc0.apply(this, arguments) } }
/* the card stands over everything, with the menus */
{ const menu0 = pMenu; pMenu = function () { return menu0() + pGrpCard() }; PARTS.menu = pMenu }

/* ── automation drawn on one track of a group is drawn on the others: looked for whenever an edit is kept ── */
const GRP_AUTO = new Map()                                                               // track id -> its lines as they were last seen
const grpAutoKeys = k => !(typeof FX_KEY !== 'undefined' && FX_KEY.test(k)) && !(typeof MAC_KEY !== 'undefined' && MAC_KEY.test(k))      // (a plug-in's or a macro's line belongs to that track's own plug-in)
function grpAutoSync () {
  const changed = []
  for (const t of S.tracks) {
    const now = JSON.stringify(t.autos || {}), was = GRP_AUTO.get(t.id)
    if (was !== undefined && was !== now && grpShares(t, 'automation')) changed.push([t, JSON.parse(was)])
  }
  const done = new Set(changed.map(([t]) => t))
  for (const [t, before] of changed) {
    const after = t.autos || {}
    for (const k of new Set(Object.keys(before).concat(Object.keys(after)))) {
      if (!grpAutoKeys(k) || JSON.stringify(before[k] || []) === JSON.stringify(after[k] || [])) continue
      for (const m of groupMates(t, 'automation')) {
        if (done.has(m) && JSON.stringify((GRP_AUTO.get(m.id) && JSON.parse(GRP_AUTO.get(m.id))[k]) || []) !== JSON.stringify((m.autos || {})[k] || [])) continue      // (changed by the same edit itself)
        /* volume by as much: the other keeps the distance it stood at from this one */
        const by = k === 'vol' ? (autoPts(m, 'vol').length && (before.vol || []).length ? autoPts(m, 'vol')[0].v - before.vol[0].v : (m.vol || 0) - (t.vol || 0)) : 0
        m.autos = m.autos || {}
        m.autos[k] = (after[k] || []).map(q => Object.assign({}, q, { id: ++PID }, k === 'vol' ? { v: clamp(Math.round((q.v + by) * 10) / 10, -48, 6) } : {}))
        if (!m.autos[k].length) delete m.autos[k]
      }
    }
  }
  for (const t of S.tracks) GRP_AUTO.set(t.id, JSON.stringify(t.autos || {}))
  if (changed.length) { resync(); uiDirty('lanes', 'head', 'dock') }
}
{ const commit0 = commit; commit = function () { const r = commit0.apply(this, arguments); grpAutoSync(); return r } }
{ const restore0 = restoreEdit; restoreEdit = function () { const r = restore0.apply(this, arguments); for (const t of S.tracks) GRP_AUTO.set(t.id, JSON.stringify(t.autos || {})); return r } }      // (undo and redo: what comes back is not drawn again on the others)
setTimeout(() => { for (const t of S.tracks) GRP_AUTO.set(t.id, JSON.stringify(t.autos || {})) }, 0)

/* ── region gain: a region's gain moved, with the same stretch on the others when the group shares it — and only on
   the region itself when it does not (even where editing chose them together) ── */
function grpGainIds (r, t, ids) {
  const out = new Set(ids)
  if (!r || !t || !t.grp) return [...out]
  if (grpShares(t, 'region gain')) { for (const [x] of companions(r, t, 'region gain')) out.add(x.id) }
  else for (const [x] of companions(r, t, 'editing')) if (x.id !== r.id) out.delete(x.id)
  return [...out]
}
