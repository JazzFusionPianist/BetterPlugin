/* ── tracks and where their sound goes: buses, stacks, sends; the strip of the chosen track; scenes ── */
const panText = p => Math.abs(p) < .005 ? 'C' : (p < 0 ? 'L' : 'R') + Math.round(Math.abs(p) * 64)      // (L and R and C as capitals: his ask, 2026-10-20)
const outName = t => { const d = byId(destId(t)); return d ? d.name : 'stereo out' }
/* a stack's tracks sit right under it, in the order they were in */
function normalizeOrder () {
  const sel = S.tracks[S.sel], out = []
  for (const t of S.tracks) if (t.parent && (!byId(t.parent) || byId(t.parent).kind !== 'stack' || t.parent === t.id || insideOf(byId(t.parent), t))) t.parent = null      // (its stack is gone, or it would stand inside itself)
  const put = t => { out.push(t); if (t.kind === 'stack') for (const c of S.tracks) if (c.parent === t.id) put(c) }      // a stack, then what is in it — a stack in it with what is in that, and so on down
  for (const t of S.tracks) if (!t.parent) put(t)
  S.tracks = out; S.sel = Math.max(0, S.tracks.indexOf(sel))
}
/* ── which tracks are chosen: the leading one (S.sel — its strip stands beside the patch) and any chosen along with it ── */
const chosenIds = () => { const ids = new Set(S.selT.filter(id => byId(id))), lead = S.tracks[S.sel]; if (lead) ids.add(lead.id); return ids }
const chosen = () => { const ids = chosenIds(); return S.tracks.filter(t => ids.has(t.id)) }
const isChosen = i => i === S.sel || (S.selT.length > 0 && !!S.tracks[i] && S.selT.includes(S.tracks[i].id))
/* the tracks a hand on one track's control moves: all the chosen ones when it is one of several, else that track alone */
const groupOf = (i, what) => { const t = S.tracks[i], all = chosen(), out = t && all.length > 1 && all.includes(t) ? all : [t].filter(Boolean); return what && t && typeof grpShares === 'function' && grpShares(t, what) ? [...new Set(out.concat(groupMates(t, what)))] : out }      // (what: a thing its group shares goes to the group's tracks too — groups.js)
/* one track made the leading one, alone, with nothing else said about what is chosen */
function leadTrack (i) { S.sel = clamp(i, 0, Math.max(0, S.tracks.length - 1)); S.selT = []; S.selA = S.tracks[S.sel] ? S.tracks[S.sel].id : null }
/* a track chosen by its head or its strip. how: '' — it alone; 'range' (shift) — all from the one last pressed to this one;
   'toggle' (command) — this one added to the chosen ones, or let go of. As in Logic, a track's regions are chosen with it:
   so the delete key takes what is on a track first, and the track itself only once it is empty (see act.del). */
function chooseTrack (i, how) {
  const t = S.tracks[i]
  if (!t) return
  if (how === 'toggle') {
    const ids = chosenIds()
    if (ids.has(t.id) && ids.size > 1) { ids.delete(t.id); if (S.sel === i) S.sel = S.tracks.findIndex(x => ids.has(x.id)) }      // one of several let go: another of them leads
    else { ids.add(t.id); S.sel = i }
    S.selT = ids.size > 1 ? [...ids] : []; S.selA = t.id
  } else if (how === 'range') {
    const vis = rows(), from = byId(S.selA) || S.tracks[S.sel], k0 = vis.indexOf(S.tracks.indexOf(from)), k1 = vis.indexOf(i)
    if (k0 < 0 || k1 < 0) leadTrack(i)
    else { const ids = vis.slice(Math.min(k0, k1), Math.max(k0, k1) + 1).map(j => S.tracks[j].id); S.selT = ids.length > 1 ? ids : []; S.sel = i; S.selA = from.id }
  } else leadTrack(i)
  S.focus = 'tracks'; S.selM = null
  S.selR = withTheirs(chosen().flatMap(x => x.regs.map(r => r.id))); S.selP = []; S.marq = null      // (a region that is one of a group is chosen with its group, however it came to be chosen)
  showRow(S.sel); uiDirty('head', 'lanes', 'dock', 'scenes')
}
/* kind: 'audio', or 'bus' (an aux: nothing on it, other tracks play or send into it). `after`: the row an audio track goes
   under (not given: under the leading track, and into its stack) */
/* kind 'midi' is a track of notes: a track that sounds, with an instrument (inst: { kind, sound }) at the head of its patch, named for what it plays */
function addTrack (kind, name, after, inst) {
  const k = S.tracks.filter(t => new RegExp(`^${kind} \\d+$`).test(t.name)).length + 1, cur = S.tracks[S.sel]
  const I = kind === 'midi' ? newInst(inst && inst.kind ? inst : { kind: 'synth' }) : null
  if (I) kind = 'audio'
  const t = mkTrack(name || (I ? instTrackName(I) : `${kind} ${k}`), null, null, null, null, 0, [], mkPatch(0, 0, 0, [0, 0, 0]), Object.assign({ kind }, I ? { inst: I } : {}))
  t.patch0 = copy(t.patch)
  if (kind === 'audio') { if (after == null && cur && cur.parent) t.parent = cur.parent; S.tracks.splice((after == null ? S.sel : after) + 1, 0, t) } else S.tracks.push(t)       // buses gather at the bottom
  return t
}
function newTrack (kind = 'audio', name, quiet) {
  if (S.tracks.length >= MAX_TRACKS) { say('no room for another track'); return null }
  const before = editState(), cur = S.tracks[S.sel]
  const t = addTrack(kind, name)
  normalizeOrder()
  if (!quiet) { leadTrack(S.tracks.indexOf(t)); S.focus = 'tracks'; S.selR = []; S.selM = null; showRow(S.sel) } else S.sel = Math.max(0, S.tracks.indexOf(cur))
  birth(t); commit(before)
  return t
}
/* what the new-track list asks for, made in one step: o = { kind, n, inp, out } (out: 0 the stereo out, or the id of a bus or a stack) */
function newTracks (o) {
  const n = Math.min(o.n || 1, MAX_TRACKS - S.tracks.length)
  if (n < 1) { say('no room for another track'); return [] }
  const before = editState(), made = [], dest = byId(o.out)
  let at = S.sel
  for (let k = 0; k < n; k++) {
    const t = addTrack(o.kind, null, at, o.kind === 'midi' ? (typeof o.inst === 'string' ? { kind: o.inst, sound: o.sound } : o.inst) : null)
    if (o.kind === 'audio') t.inp = o.inp || 0
    if (o.kind !== 'bus') at = S.tracks.indexOf(t)
    if (dest && dest.kind === 'stack') t.parent = dest.id; else if (dest) t.out = dest.id
    made.push(t)
  }
  normalizeOrder()
  leadTrack(S.tracks.indexOf(made[0])); if (made.length > 1) S.selT = made.map(t => t.id)
  S.focus = 'tracks'; S.selR = []; S.selM = null; showRow(S.sel)
  for (const t of made) birth(t)
  commit(before)
  return made
}
/* ⌘D: a track like this one, with nothing on it — its patch, its level, where it goes, what it sends, and its plug-ins as they
   are set. `full` (⌥⇧⌘D): with what is on it too */
/* ── alternatives: a track can hold its regions several times over — one set on the lane, the others put aside — sharing its
   strip, its patch, its plug-ins and its lines. Another take of the same part, another edit of it: made empty or as a copy,
   and gone back to at any time. They are numbered as they are made. On a track of an edit group, the group's other
   tracks go along (several microphones stay one recording through every take). ── */
const altName = t => t.alt || '1'
const altNames = t => [altName(t)].concat((t.alts || []).map(a => a.name))
function altAct (t, what, name) {
  const ts = [t].concat(groupMates(t)).filter(x => x.kind === 'audio')
  const next = String(1 + Math.max(0, ...ts.flatMap(altNames).map(n => +n || 0)))       // (one number for all the tracks of a group, so that a take is the same take on each)
  edit(() => {
    let any = false
    const copies = []
    for (const x of ts) {
      x.alts = x.alts || []
      if (what === 'use') {
        const k = x.alts.findIndex(a => a.name === name)
        if (k < 0) continue
        const a = x.alts[k]
        x.alts[k] = { name: altName(x), regs: x.regs }; x.regs = a.regs; x.alt = a.name
        x.alts.sort((p, q) => (+p.name || 0) - (+q.name || 0))
      } else if (what === 'new' || what === 'copy') {
        const now = x.regs
        x.alts.push({ name: altName(x), regs: now }); x.alt = next
        x.regs = what === 'copy' ? now.map(r => cloneReg(r)) : []
        copies.push(...x.regs)
      } else if (what === 'others') { if (!x.alts.length) continue; x.alts = [] }
      any = true
    }
    if (!any) return false
    freshGroups(copies)                                                                 // (the copies of a group of regions, on however many of these tracks, are one group of their own)
    S.selR = S.selR.filter(id => regOf(id)[0])
  })
  rewarp(ts.flatMap(x => x.regs)); uiDirty('head', 'lanes', 'dock')
}
function openAltMenu (t, x, y) {
  const now = altName(t), names = altNames(t).sort((p, q) => (+p || 0) - (+q || 0))
  const items = names.map(n => ({ t: `alternative ${n}`, v: 'use:' + n, on: n === now })).concat([{ t: 'new, empty', v: 'new', sep: true }, { t: 'new, a copy of this one', v: 'copy' }], (t.alts || []).length ? [{ t: 'delete the others', v: 'others', sep: true }] : [])
  openMenu(x, y, items, it => { if (it.v.startsWith('use:')) { if (it.v.slice(4) !== now) altAct(t, 'use', it.v.slice(4)) } else altAct(t, it.v) })
}
/* ── edit groups (see edit.js): the chosen tracks become a group; chosen tracks that are exactly one group are taken apart;
   a single track of a group leaves it ── */
function groupTracks () {
  const ts = chosen().filter(t => t.kind === 'audio')
  if (ts.length < 2 && !ts.some(t => t.grp)) return
  edit(() => {
    const g0 = ts[0].grp, whole = ts.length >= 2 && !!g0 && ts.every(t => t.grp === g0) && S.tracks.filter(t => t.grp === g0).length === ts.length
    if (whole || ts.length < 2) for (const t of ts) t.grp = null
    else { const used = new Set(S.tracks.filter(t => !ts.includes(t)).map(t => t.grp).filter(Boolean)), g = 'abcdefghijklmnopqrstuvwxyz'.split('').find(c => !used.has(c)) || 'z'; for (const t of ts) t.grp = g }
    for (const g of new Set(S.tracks.map(t => t.grp).filter(Boolean))) { const m = S.tracks.filter(t => t.grp === g); if (m.length < 2) for (const t of m) t.grp = null }      // a group of one is no group
  })
  uiDirty('head')
}
async function duplicateTrack (i, full) {
  const src = S.tracks[i]
  if (!src) return
  if (S.tracks.length >= MAX_TRACKS) { say('no room for another track'); return }
  const states = NAT && ((src.inserts || []).length || (src.inst && src.inst.kind === 'plug')) ? await NAT.call('pluginStates') : null
  const before = editState(), m = src.name.match(/^(.*?)(?: (\d+))?$/), stem = m[1]
  let k = m[2] ? +m[2] + 1 : 2
  while (S.tracks.some(x => x.name === `${stem} ${k}`)) k++
  const t = mkTrack(`${stem} ${k}`, null, null, null, src.buf0, src.vol, [], copy(src.patch), Object.assign({ kind: src.kind === 'stack' ? 'bus' : src.kind, pan: src.pan, out: src.out, parent: src.kind === 'stack' ? null : src.parent, sends: copy(src.sends), inp: src.inp, midi: src.midi }, src.inst ? { inst: instCopy(src.inst, states && src.inst.uid ? states['u' + src.inst.uid] : null) } : {}, src.col ? { col: src.col.slice() } : {}, src.shape ? { shape: src.shape } : {}, src.tone ? { tone: src.tone } : {}))
  t.def = src.def; t.patch0 = copy(src.patch0 || src.patch)
  if (src.wall && typeof wallSaved === 'function') t.wall = wallSaved(src)                 // (its patch wired as the other's is: the plug-ins find their places again as they are opened)
  if (full && src.kind === 'audio') { t.regs = src.regs.map(r => cloneReg(r)); freshGroups(t.regs) }
  S.tracks.splice(i + 1, 0, t); normalizeOrder(); leadTrack(S.tracks.indexOf(t)); S.focus = 'tracks'; S.selR = t.regs.map(r => r.id); S.selM = null; showRow(S.sel); birth(t)
  commit(before)
  if (NAT) for (const ins of src.inserts || []) {
    if (ins.out) { t.inserts.push(Object.assign({}, ins, { uid: 0, busy: false })); continue }
    const r = await NAT.call('insert', { track: t.id, id: ins.id, state: (states && states['u' + ins.uid]) || '', show: 0 })
    if (r && r.ok) { t.inserts.push({ uid: r.uid, name: r.name, fmt: r.fmt, id: ins.id, off: !!ins.off }); if (ins.off) NAT.call('bypass', { track: t.id, uid: r.uid, off: 1 }) }
  }
  uiDirty('dock', 'head')
}
/* a track taken by its name and let go between two others (a stack moves with what is in it; in front of a stack's track, it joins that stack) */
function reorderMove (p) {
  const d = drag
  if (!d.moved && Math.abs(p.y - d.y0) < 7) return
  d.moved = true
  const L = rowTops(), v = p.y - TY + VY, ends = L.tops.concat(L.all)                    // the gap between two rows the hand is nearest to
  const k = ends.reduce((best, y, j) => Math.abs(y - v) < Math.abs(ends[best] - v) ? j : best, 0)
  if (S.reorder !== k) { S.reorder = k; uiDirty('head') }
}
function reorderUp () {
  const d = drag, k = S.reorder
  S.reorder = null
  if (d.moved && k != null) moveTracks(d.keep ? chosen() : [S.tracks[d.i]], k)
  else if (d.keep) chooseTrack(d.i)                                                     // one of several pressed and let go without a pull: it alone is chosen
  uiDirty('head')
}
/* tracks taken together and let go in front of the row k: they keep their order; a stack moves with what is in it, and a
   track that was pulled out of its stack (or into one) is in the stack of the row it lands in front of */
function moveTracks (list, k) {
  const vis = rows(), picked = new Set(list.filter(Boolean))
  if (!picked.size) return
  const under = t => [...picked].some(p => p.kind === 'stack' && insideOf(t, p)), inBlock = t => picked.has(t) || under(t), block = S.tracks.filter(inBlock), lead = S.tracks[S.sel]      // (what stands in a picked stack, at any depth, goes with it)
  let before = k < vis.length ? S.tracks[vis[k]] : null                                // the track they are let go in front of
  if (before && block.includes(before)) { if (block.length === 1 || picked.size === 1) return; let j = S.tracks.indexOf(before); while (j < S.tracks.length && block.includes(S.tracks[j])) j++; before = j < S.tracks.length ? S.tracks[j] : null }
  { const deep = Math.max(...block.filter(t => !under(t)).map(t => t.kind === 'stack' ? Math.max(0, ...block.filter(c => insideOf(c, t)).map(c => depthOf(c) - depthOf(t))) : 0)); while (before && before.parent && depthOf(before) + deep > STACK_DEEP) before = byId(before.parent) }      // a stack may be set down inside another, as far as stacks go deep: past that it lands beside the stack it was aimed into
  edit(() => {
    const rest = S.tracks.filter(x => !block.includes(x)), parent = before && before.parent ? before.parent : null, was = block.map(t => t.parent)
    rest.splice(before ? rest.indexOf(before) : rest.length, 0, ...block)
    for (const t of block) { if (under(t)) continue; if (parent && !t.parent) t.out = 0; t.parent = parent }
    if (block.every((t, j) => t.parent === was[j]) && rest.every((x, j) => x === S.tracks[j])) return false
    S.tracks = rest; normalizeOrder(); S.sel = Math.max(0, S.tracks.indexOf(lead))
  })
}
const moveTrack = (i, k) => moveTracks([S.tracks[i]], k)
/* a send that goes takes its line with it, and the ones after it move up */
function removeSend (t, k) {
  t.sends.splice(k, 1)
  for (let i = k; i < 3; i++) { const next = t.autos['send' + (i + 1)]; if (next) t.autos['send' + i] = next; else delete t.autos['send' + i] }
  if (/^send/.test(t.ap) && !t.sends[+t.ap.slice(4)]) t.ap = 'vol'
}
/* tracks deleted together, in one step that an undo takes back. A song keeps at least one track. Afterwards nothing is
   chosen for the delete key: pressed again, it must not go on into the track that moved up into the place */
async function deleteTracks (list) {
  list = list.filter(t => S.tracks.includes(t))
  if (list.length >= S.tracks.length) list = list.slice(1)
  if (!list.length) return 0
  const st = NAT && list.some(t => (t.inserts || []).length) ? await NAT.call('pluginStates') : null      // so that an undo can bring their plug-ins back as they were
  list = list.filter(t => S.tracks.includes(t))
  if (!list.length || list.length >= S.tracks.length) return 0
  edit(() => {
    const first = Math.min(...list.map(t => S.tracks.indexOf(t))), lead = S.tracks[S.sel]
    for (const t of list) {
      for (const ins of t.inserts || []) { if (st && st['u' + ins.uid] != null) ins.state = st['u' + ins.uid]; ins.dead = true }
      if (t.kind === 'stack') for (const c of S.tracks) if (c.parent === t.id) { c.parent = t.parent || null; if (!c.parent) c.out = t.out }      // (in the stack its stack stood in, when it stood in one)
      for (const x of S.tracks) { if (x.out === t.id) x.out = 0; for (let k = x.sends.length - 1; k >= 0; k--) if (x.sends[k].to === t.id) removeSend(x, k) }
      S.tracks.splice(S.tracks.indexOf(t), 1)
      S.selR = S.selR.filter(id => !t.regs.some(r => r.id === id))
    }
    S.selT = []; S.sel = list.includes(lead) ? clamp(first, 0, S.tracks.length - 1) : Math.max(0, S.tracks.indexOf(lead))
    if (S.focus === 'tracks') S.focus = 'lanes'
    normalizeOrder()
  })
  return list.length
}
const deleteTrack = i => deleteTracks([S.tracks[i]].filter(Boolean))
/* ⇧⌘⌫: every audio track with nothing on it (one that is armed is waiting for a take, and stays) */
async function deleteUnused () {
  const n = await deleteTracks(S.tracks.filter(t => t.kind === 'audio' && !t.regs.length && !t.arm))
  say(n ? `${n} empty track${n === 1 ? '' : 's'} deleted` : 'no empty track')
}
/* plug-ins of a track that came back with an undo are opened again */
/* a plug-in's key (its side chain): the track it listens to on its second input, in place of its own sound — a compressor
   on the bass that ducks to the kick listens to the kick. It is kept with the plug-in (ins.key, that track's id; ins.sc
   says the plug-in has such an input at all) and told to the engine again whenever the plug-in is opened. */
const keyTold = (t, ins) => { if (NAT && ins.key && ins.uid && byId(ins.key)) NAT.call('keyFrom', { track: t.id, uid: ins.uid, from: ins.key }) }
async function setKey (t, ins, from) {
  if (!NAT || !ins || !ins.uid) return false
  const r = await NAT.call('keyFrom', { track: t.id, uid: ins.uid, from: from || 0 })
  if (r && r.ok) { ins.key = from || 0; say(from ? `${ins.name.toLowerCase()} listens to ${byId(from).name}` : `${ins.name.toLowerCase()} listens to its own track`) }
  else say(r && r.why === 'ring' ? 'that track is fed by this one' : r && r.why === 'no key input' ? 'this plug-in has no key input' : 'not while it prints')
  uiDirty('dock')
  return !!(r && r.ok)
}
/* the list under a plug-in that is pressed with the other button: what it listens to */
function openKeyMenu (t, k, x, y) {
  const ins = t && t.inserts[k]
  if (!ins || ins.out || !ins.uid) return
  if (!ins.sc) { openMenu(x, y, [{ t: 'no key input', dim: true }], () => {}); return }
  const now = byId(ins.key) ? ins.key : 0
  openMenu(x, y, [{ t: 'its own track', v: 0, on: !now }].concat(S.tracks.filter(s => s !== t).map((s, i) => ({ t: s.name, k: s.kind === 'audio' ? '' : s.kind, v: s.id, on: now === s.id, sep: i === 0 }))), it => setKey(t, ins, it.v), { w: 200 })
}
async function reviveInserts () {
  if (!NAT) return
  for (const t of S.tracks) for (const ins of t.inserts || []) if (ins.dead && !ins.busy) {
    if (ins.out) { ins.dead = false; continue }
    ins.busy = true
    const r = await NAT.call('insert', { track: t.id, id: ins.id, state: ins.state || '', show: 0 })
    ins.busy = false
    if (r && r.ok) { ins.uid = r.uid; ins.dead = false; ins.sc = !!r.key; if (ins.off) NAT.call('bypass', { track: t.id, uid: r.uid, off: 1 }); keyTold(t, ins); uiDirty('dock') }
  }
}
/* a summing stack: the tracks of the chosen regions (or the chosen track) play into one bus that sits above them */
function makeStack () {
  /* of what is chosen: tracks, stacks, tracks inside a stack. One stack is made, where the first of them stands (inside the
     stack that one is in, if it is in one); what stands inside a chosen stack goes along with that stack as it is. */
  const pool = (S.focus === 'tracks' ? chosen() : [...new Set(selRegs().map(x => x[1]))]).filter(Boolean), all = pool.length ? pool : chosen()
  const top = all.filter(t => !all.some(p => p !== t && p.kind === 'stack' && insideOf(t, p))), par = top.length ? top[0].parent || null : null
  const members = top.filter(t => (t.parent || null) === par)
  if (!members.length) return
  { const deep = 1 + Math.max(...members.map(t => t.kind === 'stack' ? Math.max(0, ...S.tracks.filter(c => insideOf(c, t)).map(c => depthOf(c) - depthOf(t))) : 0)); if ((par ? depthOf(byId(par)) + 1 : 0) + deep > STACK_DEEP) { say('stacks do not go deeper than that'); return } }
  if (S.tracks.length >= MAX_TRACKS) { say('no room for another track'); return }
  edit(() => {
    const k = S.tracks.filter(t => t.kind === 'stack').length + 1
    const st = mkTrack(`stack ${k}`, null, null, null, null, 0, [], mkPatch(0, 0, 0, [0, 0, 0]), { kind: 'stack' })
    st.patch0 = copy(st.patch)
    const at = Math.min(...members.map(t => S.tracks.indexOf(t)))
    st.parent = par
    for (const t of members) { t.parent = st.id; t.out = 0 }
    S.tracks.splice(at, 0, st)
    normalizeOrder(); leadTrack(S.tracks.indexOf(st)); birth(st)
  })
  showRow(S.sel)
}
function foldStack (open) { const t = S.tracks[S.sel], st = t && (t.kind === 'stack' ? t : byId(t.parent)); if (!st) return; st.open = open; if (!open) leadTrack(S.tracks.indexOf(st)); VY = clamp(VY, 0, maxVY()); uiDirty('head', 'lanes', 'dock') }
/* where a track plays: the stereo out (0), a bus, or a stack — which takes it in */
function setOut (t, id) {
  edit(() => {
    const d = byId(id)
    if (d && d.kind === 'stack' && d !== t && !insideOf(d, t)) { t.parent = d.id; t.out = 0 } else { t.parent = null; t.out = d ? d.id : 0 }
    const cur = S.tracks[S.sel]
    normalizeOrder(); S.sel = Math.max(0, S.tracks.indexOf(cur))
  })
}
function setSend (t, k, id) { edit(() => { if (!id) { if (!t.sends[k]) return false; removeSend(t, k) } else if (t.sends[k]) t.sends[k].to = id; else if (t.sends.length < 3) t.sends.push({ to: id, db: -12 }); else return false }) }
const canFeed = (t, b) => b !== t && b.kind !== 'audio' && !reaches(b, t)                          // nothing may come back round to itself
function openOutMenu (t, x, y) {
  const items = [{ t: 'stereo out', v: 0, on: !destId(t) }].concat(S.tracks.filter(b => canFeed(t, b)).map(b => ({ t: b.name, k: b.kind, v: b.id, on: destId(t) === b.id })))
  items.push({ t: 'new bus', v: 'new', sep: true })
  openMenu(x, y, items, it => { if (it.v === 'new') { const b = newTrack('bus', null, true); if (b) setOut(t, b.id) } else if (it.v !== destId(t)) setOut(t, it.v) })
}
function openSendMenu (t, k, x, y) {
  const cur = t.sends[k], items = S.tracks.filter(b => canFeed(t, b) && b.id !== destId(t)).map(b => ({ t: b.name, k: b.kind, v: b.id, on: !!cur && cur.to === b.id }))
  items.push({ t: 'new bus', v: 'new', sep: !!items.length })
  if (cur) items.push({ t: 'no send', v: 0 })
  openMenu(x, y, items, it => { if (it.v === 'new') { const b = newTrack('bus', null, true); if (b) setSend(t, k, b.id) } else setSend(t, k, it.v) })
}
function openTrackMenu (i, x, y) {
  const t = S.tracks[i], st = t.kind === 'stack' ? t : byId(t.parent)
  const many = groupOf(i).length > 1
  const items = [{ t: 'rename', k: '⇧⏎', v: 'rename' }, { t: 'duplicate', k: '⌘d', v: 'dup' }, { t: 'duplicate with what is on it', k: '⌥⇧⌘d', v: 'dupfull' }, { t: 'new track', k: '⌥⌘n', v: 'new', sep: true }, { t: 'new audio track', k: '⌥⌘a', v: 'audio' }, { t: 'new bus', k: '⌃n', v: 'bus' }]
  items.push({ t: 'put in a stack', k: '⇧⌘d', v: 'stack' })
  if (st) items.push({ t: 'take the stack apart', k: '⇧⌘u', v: 'flat' })
  const ga = groupOf(i).filter(x => x.kind === 'audio'), g0 = ga.length ? ga[0].grp : null, whole = ga.length >= 2 && !!g0 && ga.every(x => x.grp === g0) && S.tracks.filter(x => x.grp === g0).length === ga.length
  const n0 = items.length
  if (whole) items.push({ t: 'ungroup', k: '⌃⌘g', v: 'grp', sep: true }); else if (ga.length >= 2) items.push({ t: 'group', k: '⌃⌘g', v: 'grp', sep: true }); else if (ga.length === 1 && g0) items.push({ t: 'leave the group', k: '⌃⌘g', v: 'grp', sep: true })
  if (t.kind === 'audio' && !t.theirs) items.push({ t: (t.alts || []).length ? `alternatives, ${t.alts.length + 1}` : 'alternatives', v: 'alts', sep: items.length === n0 })
  if (S.tracks.length > 1) items.push({ t: many ? `delete ${groupOf(i).length} tracks` : 'delete', k: '⌘⌫', v: 'del', sep: true })
  openMenu(x, y, items, it => {
    if (it.v === 'rename') startRename('track', i); else if (it.v === 'dup') duplicateTrack(i); else if (it.v === 'dupfull') duplicateTrack(i, true); else if (it.v === 'new') openNewTrack(); else if (it.v === 'audio' || it.v === 'bus') newTrack(it.v)
    else if (it.v === 'grp') groupTracks()
    else if (it.v === 'alts') openAltMenu(t, x, y)
    else if (it.v === 'stack') { S.focus = 'tracks'; makeStack() } else if (it.v === 'flat') deleteTrack(S.tracks.indexOf(st)); else if (it.v === 'del') deleteTracks(groupOf(i))
  })
}

/* what a track listens to: one of the device's inputs (0, 1, …), or two of them as a pair (100 = 1 and 2, 101 = 3 and 4, …) */
let INPUTS = 2
const inputName = v => v >= 100 ? `input ${2 * (v - 100) + 1} and ${2 * (v - 100) + 2}` : `input ${v + 1}`
function inputItems (cur) {
  const n = Math.max(2, Math.min(16, INPUTS)), items = []
  for (let c = 0; c < n; c++) items.push({ t: inputName(c), v: c, on: (cur || 0) === c })
  for (let p = 0; p * 2 + 1 < n; p++) items.push({ t: inputName(100 + p), v: 100 + p, on: cur === 100 + p, sep: p === 0 })
  if (NAT) items.push({ t: 'audio settings', k: '⌘,', v: 'set', sep: true })
  return items
}
function openInputMenu (t, x, y) {
  openMenu(x, y, inputItems(t.inp), it => { if (it.v === 'set') NAT.call('audioSettings'); else { for (const q of groupOf(S.tracks.indexOf(t)).filter(q => q.kind === 'audio' && !q.theirs)) { q.inp = it.v; pushTrack(q) } uiDirty('dock') } })
}
/* ── a channel strip, from the top: its patch (the prints that are on, and a mark for each thing borrowed into the chain),
   its three sends, where it goes; where it sits; its fader on a scale beside its meter; what it reads; its cells; its
   colour and its name. Wide, it also says what comes in. A strip has no inserts of its own: the patch is where they live. ── */
const PRINTS = [['tape', CREAM], ['space', SPACE], ['delay', MINT]]
const DBS = [6, 0, -6, -12, -24, -48]
const SHORT = { 'stereo out': 'st out' }
const MASTER = () => ({ id: 'M', name: 'stereo out', kind: 'out', vol: S.master, pan: 0, c: oklch(.8, .004, 90), sends: [], inserts: [] })
/* A strip's rows: its patch as a column of slots (fx), its sends, where it goes. As many slots as the strip with most on
   it needs, and one more, and as many sends — three of each at least — as long as the fader keeps a hundred pixels; it
   gave two rows to them (his ask, 2026-10-19: "볼륨 페이더의 높이를 조금만 줄여서 fx랑 send를 넣을 자리를"). */
const MIX_FADER_MIN = 80
/* the room the pan takes: a bar as wide as the strip (his pick of pan draft 1, m-b), or a knob in the inspector (i-c) */
const PAN_BAR = 30, PAN_KNOB = 74
let MIX_N = { key: '', nf: 3, ns: 3 }
function mixCounts (h, wide) {
  const key = h + '|' + (wide ? 1 : 0) + '|' + S.tracks.map(t => `${t.wall ? t.wall.nodes.length : 0},${(t.inserts || []).length},${(t.sends || []).length},${PRINTS3.filter(k => printOn(t, k)).length}`).join(';')
  if (MIX_N.key === key) return MIX_N
  const most = Math.max(0, ...S.tracks.map(t => fxItems(t).length)), sends = Math.max(0, ...S.tracks.map(t => (t.sends || []).length))
  let nf = clamp(most + 1, 3, 8), ns = clamp(sends + 1, 3, 6)
  const room = h - (7 + 9 + PAN_BAR + 67) - 16 * (wide ? 2 : 1) - MIX_FADER_MIN
  while ((nf + ns) * 16 > room && (nf > 2 || ns > 2)) { if ((nf > ns && nf > 2) || ns <= 2) nf--; else ns-- }
  MIX_N = { key, nf, ns }
  return MIX_N
}
function stripGeom (y, h, wide, knob) {
  const sp = 16, sh = 14, { nf, ns } = mixCounts(h - (knob ? PAN_KNOB - PAN_BAR : 0), wide)
  const rws = (wide ? ['in'] : []).concat(Array.from({ length: nf }, (_, k) => 'fx' + k), ['send'], Array(ns - 1).fill(''), ['out'])
  const y0 = y + 7, panY = y0 + rws.length * sp + 9, ft = panY + (knob ? PAN_KNOB : PAN_BAR), fb = Math.max(ft + 24, y + h - 67)
  return { sp, sh, rows: rws, nf, ns, y0, panY, ft, fb, fh: fb - ft, yOf: db => fb - (fb - ft) * volF(db) }
}
/* what is on a track's patch, in order: the prints and plug-ins on its wall (a key's side is not a slot), else — no wall
   made yet — its prints and then its plug-ins */
const MIX_PRINT_C = { tape: CREAM, space: SPACE, delay: MINT }
const plugShort = name => String(name || '').replace(/^(fabfilter|uadx?|uaudio|waves)\s+/i, '').toLowerCase()
function fxItems (t) {
  const out = [], plug = ins => ({ kind: 'plug', ins, t: plugShort(ins.name), off: !!(ins.off || ins.out || ins.dead) })
  const w = t.wall
  if (w && Array.isArray(w.nodes)) {
    for (const nd of w.nodes) { if (nd.k === 'side') continue; if (nd.k === 'plug') { if (nd.ins) out.push(plug(nd.ins)) } else out.push({ kind: 'print', k: nd.k, node: nd.id, t: nd.k, c: MIX_PRINT_C[nd.k] }) }
    for (const ins of t.inserts || []) if (!out.some(o => o.ins === ins)) out.push(plug(ins))      // (put on a moment ago: not on the wall yet)
  } else {
    for (const k of PRINTS3) if (printOn(t, k)) out.push({ kind: 'print', k, t: k, c: MIX_PRINT_C[k] })
    for (const ins of t.inserts || []) out.push(plug(ins))
  }
  return out
}
function stripGutter (x, w, y, h, wide, knob) {
  const q = stripGeom(y, h, wide, knob)
  let s = ''
  q.rows.forEach((l, i) => { const said = l === 'fx0' ? 'fx' : /^fx\d/.test(l) ? '' : l; if (said) s += T(x + w - 6, q.y0 + i * q.sp + q.sh / 2 + 3.2, said, { size: 9, a: .4, anchor: 'end' }) })
  s += T(x + w - 6, q.panY + 4, 'pan', { size: 9, a: .4, anchor: 'end' })
  if (!(typeof SKIN === 'object' && SKINS.strip[SKIN.k.mixer] && !SKINS.strip[SKIN.k.mixer].meters)) for (const db of DBS) s += T(x + w - 6, q.yOf(db) + 3, db === -48 ? '∞' : String(Math.abs(db)), { size: 8.5, a: db === 0 ? .66 : .36, anchor: 'end' })      // (a console's knobs carry their own scale)
  return s
}
/* the pan as a bar the strip's width: a groove, filled from its middle, a handle where it stands (his pick, 2026-10-20) */
const panWide = (x, y, w, h, pan) => { const cx = x + w / 2, px = cx + pan * (w / 2 - 1.5); return R(x, y, w, h, { rx: 1.5, fill: K0, fa: .9 }) + R(x + .5, y + .5, w - 1, h - 1, { rx: 1.5, stroke: INK, sa: .16 }) + R(Math.min(cx, px), y + 2, Math.abs(px - cx), h - 4, { fill: INK, fa: .42 }) + R(cx - .5, y - 2, 1, h + 4, { fill: INK, fa: .3 }) + R(px - 1.5, y - 2, 3, h + 4, { rx: 1, fill: INK }) }
/* …and as a knob (the inspector's): the way it can go, 135 degrees either side of the top; how far it went, from the top */
const panKnob = (cx, cy, r, pan, sw = 3) => {
  const at = (rr, deg) => { const a = (deg - 90) * Math.PI / 180; return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)] }
  const arc = (d0, d1) => { if (Math.abs(d1 - d0) < .01) return ''; const [x0, y0] = at(r, d0), [x1, y1] = at(r, d1); return `M${n(x0)} ${n(y0)}A${r} ${r} 0 ${Math.abs(d1 - d0) > 180 ? 1 : 0} ${d1 > d0 ? 1 : 0} ${n(x1)} ${n(y1)}` }
  const d = pan * 135, [tx, ty] = at(r - sw - 2, d)
  return P(arc(-135, 135), { stroke: INK, sa: .16, sw, cap: 'round' }) + P(arc(0, d), { stroke: INK, sa: .95, sw, cap: 'round' }) + R(cx - .5, cy - r - sw / 2 - 3, 1, 3, { fill: INK, fa: .4 }) + P(`M${n(cx)} ${n(cy)}L${n(tx)} ${n(ty)}`, { stroke: INK, sa: .9, sw: Math.max(1, sw * .6), cap: 'round' })
}
/* left or right of the middle: a line that fills from its centre */
const panBar = (x, y, w, pan) => { const cx = x + w / 2, px = cx + pan * w / 2; return R(x, y, w, 2, { fill: INK, fa: .12 }) + R(Math.min(cx, px), y, Math.abs(px - cx), 2, { fill: INK, fa: .7 }) + R(cx - .5, y - 2, 1, 6, { fill: INK, fa: .3 }) + R(px - 1, y - 3, 2, 8, { fill: INK }) }
/* what plays into a bus, or sits in a stack: said where a track says its input */
const feedsOf = t => S.tracks.filter(x => x !== t && (x.sends || []).some(sd => sd.to === t.id)).length
function strip (x, y, w, h, t, i, o = {}) {
  const wide = !!o.wide, q = stripGeom(y, h, wide, !!o.knob), pad = wide ? 5 : 4, sx = x + pad, sw = w - pad * 2, fs = wide ? 9.5 : 9, sel = !!o.sel, tx = sx + (wide ? 6 : 4), di = ` data-i="${i}"`
  let s = '', yy = q.y0, si = 0, hits = ''
  const short = v => wide ? v : (SHORT[v] || v)
  const word = (txt, room, it, a = .88) => T(tx, yy + q.sh / 2 + fs * .35, fit(txt, room, fs, 400, !!it), { size: fs, a, it: !!it })
  const full = (txt, it, act) => { s += R(sx, yy, sw, q.sh, { rx: 1.5, fill: K3 }) + word(txt, sw - (wide ? 12 : 7), it); if (act) hits += hit(sx, yy, sw, q.sh, act, di) }
  const well = act => { s += R(sx, yy, sw, q.sh, { rx: 1.5, fill: K0, fa: .55 }); if (act) hits += hit(sx, yy, sw, q.sh, act, di) }
  /* a send is a button that fills from the left: the more is sent, the more of it is filled */
  const send = (sd, k) => {
    const db = shown(t, 'send' + k), f = volF(db), id = 'sd' + (++UID), b = byId(sd.to)
    s += `<clipPath id="${id}"><rect x="${n(sx)}" y="${n(yy)}" width="${n(sw)}" height="${q.sh}" rx="1.5"/></clipPath>`
    s += G(R(sx, yy, sw, q.sh, { fill: K0, fa: .7 }) + R(sx, yy, sw * f, q.sh, { fill: INK, fa: .3 }), '', ` clip-path="url(#${id})"`) + R(sx + .5, yy + .5, sw - 1, q.sh - 1, { rx: 1.5, stroke: INK, sa: autoPts(t, 'send' + k).length ? .5 : .16 })
    const pulling = drag && drag.a === 'msend' && drag.moved && S.tracks[drag.i] === t && drag.k === k      // (while it is pulled it says how much goes, to a tenth of a db: his ask, 2026-10-19)
    const much = db <= -47.5 ? '−∞' : (pulling ? db.toFixed(1) : String(Math.round(db))).replace('-', '−')
    if (pulling && !wide) s += word(`${much} db`, sw - 7)
    else s += word(b ? b.name : 'send', sw - (wide ? 34 : 7))
    if (wide) s += T(sx + sw - 5, yy + q.sh / 2 + fs * .35, much, { size: 9, a: pulling ? .95 : .66, anchor: 'end' })
    hits += hit(sx, yy, sw, q.sh, 'msend', `${di} data-k="${k}" data-x="${n(sx)}" data-pw="${n(sw)}"`, 'ew-resize')
  }
  for (const r of q.rows) {
    if (o.master) { if (r === 'out') full(wide ? 'output 1-2' : 'out 1-2', false, NAT ? 'audiokey' : null) }
    else if (r === 'in') {
      if (t.kind === 'stack') { const k = S.tracks.filter(c => c.parent === t.id).length; full(`${k} track${k === 1 ? '' : 's'}`) }
      else if (t.kind === 'bus') { const k = feedsOf(t); full(`${k} send${k === 1 ? '' : 's'}`) }
      else if (t.theirs) full(t.theirs, true)
      else if (t.inst) full('keyboard')
      else full(inputName(t.inp || 0), false, 'min')
    } else if (r === 'patch') {
      const p = patchNow(t), ln = (t.inserts || []).length, ls = 5, lp = wide ? 9 : 8, ly = yy + q.sh / 2 - ls / 2, l0 = sx + (wide ? 6 : 4)
      PRINTS.forEach(([k, c], j) => { const lx = l0 + j * lp; s += p[k] >= .5 ? R(lx, ly, ls, ls, { fill: c }) : R(lx + .5, ly + .5, ls - 1, ls - 1, { stroke: INK, sa: .16 }) })
      for (let j = 0; j < ln; j++) s += R(l0 + 2 * lp + ls + (wide ? 6 : 4) + j * (wide ? 6 : 4.5), ly, 3, ls, { fill: INK, fa: t.inserts[j].off || t.inserts[j].out ? .3 : .85 })
      hits += hit(sx, yy, sw, q.sh, 'm-patch', di)
    } else if (/^fx\d+$/.test(r)) {
      /* a slot: what is on the patch there — a plug-in's name, a print's beside its colour (dim where it is off) — or the
         empty one after them, which opens the list; where there is more than there are slots the last says how much more */
      const k = +r.slice(2), items = fxItems(t), more = items.length > q.nf && k === q.nf - 1, it = more ? null : items[k]
      const fd = drag && drag.a === 'mfx' && drag.alt && drag.moved ? drag : null
      if (more) { s += R(sx, yy, sw, q.sh, { rx: 1.5, fill: K0, fa: .55 }) + word(`+${items.length - k} more`, sw - 7, false, .5); hits += hit(sx, yy, sw, q.sh, 'm-patch', di) }
      else if (it) {
        const held = fd && fd.i === i && fd.k === k
        s += R(sx, yy, sw, q.sh, { rx: 1.5, fill: K3 }) + (held ? R(sx + .5, yy + .5, sw - 1, q.sh - 1, { rx: 1.5, stroke: INK, sa: .9 }) : '')
        if (it.c) s += R(sx + 3, yy + q.sh / 2 - 2, 4, 4, { fill: it.c, fa: it.off ? .4 : 1 })
        s += T(sx + (it.c ? 10 : 4), yy + q.sh / 2 + fs * .35, fit(asGiven(it.t), sw - (it.c ? 13 : 7), fs - .5), { size: fs - .5, a: it.off ? .4 : .9 })
        hits += hit(sx, yy, sw, q.sh, 'mfx', `${di} data-k="${k}"`)
      } else if (k === items.length && fd && fd.to && fd.to.includes(i)) s += R(sx, yy, sw, q.sh, { rx: 1.5, fill: K0, fa: .9 }) + R(sx + .5, yy + .5, sw - 1, q.sh - 1, { rx: 1.5, stroke: INK, sa: .7, dash: '2 2' }) + word(fd.word, sw - 7)      // (where a copy pulled with option would go)
      else { s += R(sx, yy, sw, q.sh, { rx: 1.5, fill: K0, fa: .55 }); if (k === items.length && !t.theirs) { s += T(sx + sw / 2, yy + q.sh / 2 + 3, '+', { size: 9, a: .4, anchor: 'middle' }); hits += hit(sx, yy, sw, q.sh, 'mfxadd', di) } else if (k === items.length) hits += hit(sx, yy, sw, q.sh, 'm-patch', di) }      // (another program's track takes no plug-in here: its slot opens its patch)
    } else if (r === 'send' || r === '') { const k = si++, sd = (t.sends || [])[k]; if (sd) send(sd, k); else well(k === (t.sends || []).length ? 'msendadd' : null) }
    else if (r === 'out') full(short(outName(t)), false, 'mout')
    yy += q.sp
  }
  const fx = x + (wide ? 34 : o.master ? 28 : 23), vol = o.master ? S.master : shown(t, 'vol'), muted = !o.master && !heard(t)
  const con = typeof SKIN === 'object' && SKINS.strip[SKIN.k.mixer]                    // (a theme's strip: its level, pan, buttons and name — skins.js)
  if (!o.master) {
    const pan = shown(t, 'pan'), px = sx + (wide ? 4 : 2), pw = sw - (wide ? 34 : 24), lit = autoPts(t, 'pan').length ? 1 : .88      // (its value in the size and weight of the strip's own words, on the line of the gutter's "pan": his ask, 2026-10-20)
    if (con) {                                                                             // (a theme's strip keeps its own pan: skins.js)
      s += con.pan(px, q.panY, pw, pan) + T(sx + sw - 2, q.panY + (wide ? 3.6 : 3.2), panText(pan), { size: wide ? 9.5 : 8.5, a: autoPts(t, 'pan').length ? 1 : .66, anchor: 'end' })
      hits += hit(px - 3, q.panY - 7, pw + 6, 16, 'mpan', `${di} data-x="${n(px)}" data-pw="${n(pw)}"`, 'ew-resize')
    } else if (o.knob) {                                                                   // the inspector: a knob, its value under it
      const r = 21, cy = q.panY - 1 + r
      s += panKnob(sx + sw / 2, cy, r, pan) + T(sx + sw / 2, cy + r + 14, panText(pan), { size: fs, a: lit, anchor: 'middle' })
      hits += hit(sx, q.panY - 8, sw, PAN_KNOB - 4, 'mpan', di, 'ns-resize')
    } else {                                                                               // a bar the strip's width, its value over it: taken anywhere on them, and moved by how far the hand goes (never thrown to where it is pressed)
      s += T(sx + sw / 2, q.panY + 4, panText(pan), { size: fs, a: lit, anchor: 'middle' }) + panWide(sx, q.panY + 9, sw, 9, pan)
      hits += hit(sx, q.panY - 8, sw, PAN_BAR - 2, 'mpan', di, 'ew-resize')
    }
  }
  /* the fader on its scale, the meter beside it */
  let tk = ''
  for (const db of DBS) tk += `M${fx - 10} ${n(q.yOf(db)) + .5}H${fx - (db === 0 ? 6 : 7.5)}`
  const fy = q.yOf(vol)
  if (con) s += con.level(x, w, sx, sw, q, vol, muted, o.master ? null : t)
  else {
    s += P(tk, { stroke: INK, sa: .26 }) + R(fx - 1, q.ft, 2, q.fh, { rx: 1, fill: INK, fa: .22 })      // (the fader and the meters drawn heavier: his ask, 2026-10-20)
    if (!o.master && t.ghost != null) s += R(fx - 8, q.yOf(t.ghost) - .5, 16, 1, { fill: INK, fa: .4 })
    s += R(fx - 8, fy - 4, 16, 8, { rx: 1.5, fill: INK, fa: muted ? .5 : 1 }) + P(`M${fx - 5.5} ${n(fy)}H${fx + 5.5}`, { stroke: K0, sa: .7, sw: 1.2 })
  }
  const bw = wide || o.master ? 6 : 5, mx = fx + (wide || o.master ? 15 : 13)
  for (let c = 0; c < 2 && (!con || con.meters); c++) {
    const x2 = mx + c * (bw + 1), ids = `${t.id}-${c}`
    s += R(x2, q.ft, bw, q.fh, { fill: INK, fa: .1 }) + R(x2, q.fb, bw, 0, { fill: LEVEL, fa: .86, x: ` id="ms-${ids}"` }) + R(x2, q.fb, bw, 0, { fill: SOLO, x: ` id="mh-${ids}"` }) + R(x2, q.fb, bw, 1, { fill: INK, fa: 0, x: ` id="mk-${ids}"` })
  }
  hits += con ? hit(sx, q.ft - 6, sw, q.fh + 12, o.master ? 'mmaster' : 'mvol', `${di} data-w="${wide ? 1 : 0}"`, 'ns-resize') : hit(fx - 12, q.ft - 6, mx + 2 * bw + 3 - (fx - 12), q.fh + 12, o.master ? 'mmaster' : 'mvol', `${di} data-w="${wide ? 1 : 0}"`, 'ns-resize')
  /* what it reads; its cells; its colour and its name */
  const ns = wide ? 10 : 9.5
  s += T(x + w / 2, y + h - 52, fmtDb(vol), { size: wide ? 10 : 9.5, a: sel || (!o.master && autoPts(t, 'vol').length) ? 1 : .72, anchor: 'middle' })
  if (o.master || !autoPts(t, 'vol').length) hits += hit(sx, y + h - 60.5, sw, 13.5, 'volnum', di, 'default')                 // what it reads: pressed twice, a level can be typed
  if (!o.master) { const its = cellsOf(t), cw = Math.min(wide ? 18 : 13, Math.floor(sw / its.length)); s += con ? con.cells(sx, sw, y + h - 44, its, i) : miniCells(sx + (sw - cw * its.length) / 2, y + h - 45, its, cw, 14, 9, i) }
  s += R(sx, y + h - 24, sw, 2, { fill: t.c, fa: !o.master && t.mute ? .4 : 1 })
  s += con ? con.name(x, w, sx, sw, y + h, t, sel) : T(x + w / 2, y + h - 9, fit(asGiven(t.name), sw, ns, sel ? 500 : 400), { size: ns, w: sel ? 500 : 400, a: !o.master && t.mute ? .42 : sel ? 1 : .84, anchor: 'middle' })
  if (con && con.box) s += con.box(x, y, w, h, sel, o.master ? null : t)
  if (!o.master) hits += hit(x, y + h - 27, w, 27, 'msel', di)
  else hits += hit(x, y + h - 27, w, 27, 'wall-out')                                      // (wall.js: the stereo out's own patch)
  return s + hits
}

/* ── markers: each begins on a bar and runs to the next ── */
function addScene (bar1, name) {
  const a = clamp(Math.round(bar1), 1, SONG_END)
  if (SCENES.some(s => s.a === a)) return
  edit(() => { SCENES = mkScenes(SCENES.map(s => [s.name, s.a]).concat([[name || `part ${SCENES.length + 1}`, a]])) })
  startRename('scene', SCENES.findIndex(s => s.a === a))
}
function removeScene (i) { if (SCENES[i]) edit(() => { S.queued = null; S.selM = null; SCENES = mkScenes(SCENES.filter((s, k) => k !== i).map(s => [s.name, s.a])) }) }
/* the marker a key is about: the one that was pressed, else the one the playhead stands in */
const markerNow = () => (S.focus === 'marker' && SCENES.find(s => s.a === S.selM)) || (sceneAt(curPos()).i >= 0 ? sceneAt(curPos()) : null)
/* ⌥. and ⌥, : to the next marker or the one before; the cycle's two ends go with it (it is not turned on by this) */
function stepMarker (dir) {
  const sc = SCENES[sceneAt(curPos()).i + dir]
  if (!sc) return
  jumpTo(sc.a - 1); S.cycle.a = sc.a - 1; S.cycle.b = Math.min(SONG_END, sc.b - 1); pushTransport()
  uiDirty('scenes', 'top', 'ruler', 'hand')
}
function markerNumber (n) { const sc = SCENES[n - 1]; if (sc) { jumpTo(sc.a - 1); uiDirty('scenes', 'top') } }
function cycleMarker () { const sc = markerNow(); if (sc) setCycle(sc.a - 1, Math.min(SONG_END, sc.b - 1), true) }
/* ⌥⇧' : a marker where what is chosen begins, named after it */
function markerForChosen () {
  const rs = selRegs(), a = S.marq ? S.marq.a + 1 : rs.length ? Math.min(...rs.map(x => x[0].a)) : null
  if (a == null) return
  const first = rs.length ? rs.reduce((p, q) => q[0].a < p[0].a ? q : p) : null
  addScene(Math.round(a), first ? String(first[0].tag || first[0].name || first[1].name).slice(0, 40) : null)
}
/* a marker taken by the hand and pulled along the song: it begins on another bar, between the one before it and the one after */
function sceneMove (p) {
  const d = drag, sc = SCENES[d.i]
  if (!sc || (!d.moved && Math.abs(p.x - d.x0) < 5)) return
  if (!d.moved) { d.moved = true; d.before = editState(); d.a0 = sc.a; d.grab = barAt(d.x0) - (sc.a - 1); if (S.queued != null) { S.queued = null; pushQueue() } }      // it keeps the place it was taken at under the hand
  const lo = d.i > 0 ? SCENES[d.i - 1].a + 1 : 1, hi = d.i + 1 < SCENES.length ? SCENES[d.i + 1].a - 1 : SONG_END
  const a = clamp(Math.round(barAt(p.x) - d.grab) + 1, lo, Math.max(lo, hi))
  if (a === sc.a) return
  SCENES = mkScenes(SCENES.map((x, k) => [x.name, k === d.i ? a : x.a])); S.selM = a
  uiDirty('scenes')
}
function sceneUp () { const d = drag; if (d.moved && SCENES[d.i] && SCENES[d.i].a !== d.a0) commit(d.before) }

/* ── bounce in place: the chosen regions, printed through the track's patch and plug-ins onto a track of their own (the app only) ── */
async function bounceInPlace (live) {                                                 // live: played through in real time (realtime.js)
  if (!NAT) { say('bouncing is in the app'); return }
  const rs = selRegs().filter(([, t]) => t.kind === 'audio')
  if (!rs.length) { say('choose a region first'); return }
  const tracks = [...new Set(rs.map(x => x[1]))], a0 = Math.min(...rs.map(x => x[0].a)) - 1, a1 = Math.max(...rs.map(x => x[0].b)) - 1, only = new Set(rs.map(x => x[0].id))
  if (S.playing) halt(false)
  say('bouncing')
  await natSession(r => only.has(r.id))                                                // for the print, only the chosen regions sound
  const opts = { kind: 'place', project: projKey(), a0, a1, tail: 2, tracks: tracks.map(t => ({ id: t.id, name: `${t.name} bounce` })) }
  let res
  if (live) res = await rtbRun(opts, only)
  else { printBegin('bouncing', tracks.map(t => t.name).join(', '), tracks.length); res = await NAT.call('bounce', opts); printEnd() }
  if (!res || !res.ok || !Array.isArray(res.placed)) { resync(); say(res && res.error === 'stopped' ? 'stopped: nothing was kept' : 'could not bounce'); return }
  edit(() => {
    const ids = []
    for (const d of res.placed) {
      const src = byId(d.track)
      if (!src || !d.ok || S.tracks.length >= MAX_TRACKS) continue
      const nt = mkTrack(`${src.name} bounce`, null, null, null, null, src.vol, [], mkPatch(0, 0, 0, [0, 0, 0]), Object.assign({ pan: src.pan, parent: src.parent, out: src.out, sends: copy(src.sends) }, src.col ? { col: src.col.slice() } : {}, src.shape ? { shape: src.shape } : {}, src.tone ? { tone: src.tone } : {}))
      nt.def = src.def; nt.patch0 = copy(nt.patch)
      const len = d.sec / SPB(), r = mkReg({ a: a0 + 1, b: a0 + 1 + len, key: d.key, file: d.file, peaksAll: d.peaks, loop: false, rate: 1, sec: d.sec, srcBars: len, name: String(d.name).toLowerCase() })
      nt.regs.push(r); ids.push(r.id)
      S.tracks.splice(S.tracks.indexOf(src) + 1, 0, nt)
      for (const x of src.regs) if (only.has(x.id)) x.mute = true                       // what was printed falls silent; it is still there
    }
    normalizeOrder(); S.selR = ids; S.focus = 'lanes'
    return ids.length > 0
  })
  say(`bounced ${res.placed.length}`)
  refreshPool()
}

/* ── a strip's slot taken hold of (ui.js: 'mfx') ──
   Let go where it was pressed: a plug-in's window opens, a print opens the patch on it. Pulled with option onto another
   strip: copied there — a plug-in with its settings, a print with its amounts — and onto one of several chosen strips, to
   every one of them (design/mixer inserts draft 1, 2). */
function fxTargets (from, p) {
  const vis = rows(), k = Math.floor((p.x - NGUT) / NSTRIP) + S.panel.mx, i = vis[k]
  if (i == null || i === from || p.x < NGUT || p.x > RX - 8 - MSTRIP - 8) return []
  const t = S.tracks[i]
  if (!t || t.kind === 'stack' || t.theirs) return []
  if (isChosen(i) && chosen().length > 1) return pickTracks().filter(j => j !== from)
  return [i]
}
async function fxUp (d) {
  const t = S.tracks[d.i], it = t && fxItems(t)[d.k]
  uiDirty('dock')
  if (!it) return
  if (!d.moved) {
    if (it.kind === 'plug') { if (NAT && it.ins.uid && !it.ins.out) NAT.call('editor', { track: t.id, uid: it.ins.uid }) }
    else { if (!isChosen(d.i)) leadTrack(d.i); else S.sel = d.i; S.panel.tab = 'patch'; if (it.node != null && typeof WALL !== 'undefined') WALL.sel = { t: t.id, node: it.node }; uiDirty('head', 'lanes', 'dock', 'top') }
    return
  }
  if (!d.alt || !d.to.length) return
  let done = 0
  if (it.kind === 'plug') {
    const st = NAT ? await NAT.call('pluginStates') : null, state = st && it.ins.uid ? st['u' + it.ins.uid] : it.ins.state
    for (const i of d.to) { if ((S.tracks[i].inserts || []).length >= MAX_INS) continue; const r = await natInsert(i, it.ins.id, { state, show: false }); if (r && r.ok) { done++; const ni = S.tracks[i].inserts.find(x => x.uid === r.uid); if (ni && it.ins.off) { ni.off = true; NAT.call('bypass', { track: S.tracks[i].id, uid: ni.uid, off: 1 }) } } }
  } else if (PRINTS3.includes(it.k)) {
    const v = patchNow(t)[it.k]
    for (const i of d.to) { const u = S.tracks[i]; setPrint(u, it.k, v); touchPatch(u); pushTrack(u); done++ }
  } else {
    const src = t.wall && t.wall.nodes.find(n => n.id === it.node)
    for (const i of d.to) {
      const u = S.tracks[i], w = wallOf(u), n0 = w.nodes.length
      wallAdd(u, it.k)
      const nd = w.nodes.length > n0 ? w.nodes[w.nodes.length - 1] : null
      if (!nd) continue
      if (src) { nd.amount = src.amount; if (src.aux) nd.aux = src.aux.slice(); if (src.variant != null) nd.variant = src.variant }
      wallAppend(w, nd.id); await wallPush(u); done++
    }
  }
  if (done) say(`${it.t} copied to ${done} track${done === 1 ? '' : 's'}`)
  uiDirty('dock', 'head')
}
/* a slot pressed with the other button: open it, turn it off or on, take it off */
function fxMenu (i, k, x, y) {
  const t = S.tracks[i], it = t && fxItems(t)[k]
  if (!it) return
  const node = () => { const w = wallOf(t); return it.kind === 'plug' ? w.nodes.find(n => n.ins === it.ins) : w.nodes.find(n => n.id === it.node || n.k === it.k) }
  const items = [{ t: 'open', v: 'open' }].concat(it.kind === 'plug' ? [{ t: it.ins.off ? 'turn on' : 'turn off', v: 'off' }] : [], [{ t: 'take off', v: 'remove' }])
  openMenu(x, y, items, m => {
    if (m.v === 'open') fxUp({ i, k, moved: false })
    else if (m.v === 'off') { it.ins.off = !it.ins.off; if (NAT && it.ins.uid) NAT.call('bypass', { track: t.id, uid: it.ins.uid, off: it.ins.off ? 1 : 0 }); uiDirty('dock') }
    else if (m.v === 'remove') { const nd = node(); if (nd) wallRemove(t, nd); else if (it.kind === 'plug') { if (NAT && it.ins.uid && !it.ins.out) NAT.call('remove', { track: t.id, uid: it.ins.uid }); t.inserts.splice(t.inserts.indexOf(it.ins), 1) } else { setPrint(t, it.k, 0); pushTrack(t) } uiDirty('dock') }
  }, { w: 140 })
}

/* a print of the room's picked from the list a strip's slot opened (or with several tracks chosen): on every chosen track,
   at the end of its way */
function fxPrintOn (k) {
  for (const i of pickTracks()) {
    const u = S.tracks[i]
    if (WALL_LEGACY[k]) { if (!printOn(u, k)) { setPrint(u, k, PRINT_START[k]); touchPatch(u); pushTrack(u); wallOf(u); wallPush(u) } continue }
    const w = wallOf(u), n0 = w.nodes.length
    if (wallFree(w) < 0) continue
    wallAdd(u, k)
    const nd = w.nodes.length > n0 ? w.nodes[w.nodes.length - 1] : null
    if (nd) { wallAppend(w, nd.id); wallPush(u) }
  }
  uiDirty('dock', 'head')
}
