/* ── the pitch and the time of a file: transpose, flex, quantize, reverse ──
   The app renders a new buffer away from the clock and the region plays that instead (r.wkey). The new buffer is as
   long as the old one played at the region's rate, so trimming, splitting and moving go on as before.
   r.tr: semitones; r.ft: cents, −100…100, on top of them (fine tune). r.flex: pins [{s, d}], s seconds into the file landing at d seconds of what is played.
   r.fx: follow the tempo by stretching, not by turning the tape faster. r.rev: backwards. */
const TRANS = new Map()            // a file's key -> where things begin in it, seconds
const WARPS = new Map()            // what was asked for -> what came back (or the promise of it)
const LIVEW = new Map()            // a rendered buffer the app still holds -> what it was asked as
const srcKey = r => r.loop ? r.buf : r.key
const rateOf = r => r.loop ? 1 : (r.rate || 1)
const warped = r => !r.notes && !!(r.tr || r.ft || (r.flex && r.flex.length) || r.rev || (r.fx && Math.abs(rateOf(r) - 1) > 1e-6))
/* a region not told to follow the tempo keeps the pitch its rate gives it, as it had before it was touched */
const warpSemis = r => (r.tr || 0) + (r.ft || 0) / 100 + (r.fx || r.loop ? 0 : 12 * Math.log2(rateOf(r)))
const warpSig = r => warped(r) ? `${srcKey(r)}|${+warpSemis(r).toFixed(4)}|${+rateOf(r).toFixed(6)}|${r.rev ? 1 : 0}|${(r.flex || []).map(m => m.s.toFixed(4) + ':' + m.d.toFixed(4)).join(',')}` : ''
async function renderWarp (r) {
  const sig = warpSig(r)
  if (!sig) { if (r.wkey) { r.wkey = null; r.wsig = ''; r.wpeaks = null; dirtyReg(r) } return true }
  if (r.wsig === sig && r.wkey && LIVEW.has(r.wkey)) return true
  if (!NAT || !srcKey(r)) return false
  let w = WARPS.get(sig)
  if (!w) { w = NAT.call('stretch', { src: srcKey(r), semis: warpSemis(r), rate: rateOf(r), marks: (r.flex || []).map(m => [m.s, m.d]), loop: r.loop ? 1 : 0, reverse: r.rev ? 1 : 0 }); WARPS.set(sig, w) }
  const res = await w
  if (!res || !res.ok) { WARPS.delete(sig); return false }
  WARPS.set(sig, res); LIVEW.set(res.key, sig)
  if (warpSig(r) !== sig) return true                                                  // it has moved on since it was asked
  r.wkey = res.key; r.wsig = sig; r.wpeaks = r.loop ? null : res.peaks; dirtyReg(r)
  return true
}
let warping = 0
async function rewarp (regs) {
  regs = regs.filter(r => r && (warpSig(r) !== (r.wsig || '') || (r.wkey && !LIVEW.has(r.wkey))))
  if (!regs.length) return
  if (!NAT) { uiDirty('lanes', 'dock'); return }
  if (++warping === 1) say('rendering')
  const ok = await Promise.all(regs.map(renderWarp))
  if (!--warping) say(ok.every(Boolean) ? 'rendered' : 'could not render that')
  resync(); uiDirty('lanes', 'dock')
  if (!warping) sweepWarps()
}
/* a rendered buffer no region plays any more is let go (an undo that wants it back has it rendered again) */
function sweepWarps () {
  if (!NAT) return
  const used = new Set(S.tracks.flatMap(t => t.regs.map(r => r.wkey)).filter(Boolean))
  for (const [key, sig] of LIVEW) if (!used.has(key)) { LIVEW.delete(key); if (WARPS.get(sig) && WARPS.get(sig).key === key) WARPS.delete(sig); NAT.call('dropBuffer', { key }) }
}
const rewarpAll = () => rewarp(S.tracks.flatMap(t => t.regs))

/* seconds in the file <-> seconds of what is played, through the pins */
const srcSec = r => (r.sec || 0) * rateOf(r)
function pins (r) { return [{ s: 0, d: 0 }].concat((r.flex || []).slice().sort((a, b) => a.s - b.s), [{ s: srcSec(r), d: r.sec || 0 }]) }
function sToD (r, s) { const p = pins(r); let i = 1; while (i < p.length - 1 && p[i].s < s) i++; const a = p[i - 1], b = p[i]; return b.s - a.s > 1e-9 ? a.d + (s - a.s) * (b.d - a.d) / (b.s - a.s) : a.d }
function dToS (r, d) { const p = pins(r); let i = 1; while (i < p.length - 1 && p[i].d < d) i++; const a = p[i - 1], b = p[i]; return b.d - a.d > 1e-9 ? a.s + (d - a.d) * (b.s - a.s) / (b.d - a.d) : a.s }
const barOfD = (r, d) => (r.a - 1) + d / SPB() - (r.off || 0)
const dOfBar = (r, bar) => (bar - (r.a - 1) + (r.off || 0)) * SPB()
const xOfD = (r, d) => bx(barOfD(r, d) + 1)

/* how fast a file goes, heard from its sound by the app (once for each file): r.bpm — beats a minute of the file itself,
   before any rate; 0 when nothing regular was heard in it. A loop cut to a whole number of bars says its speed exactly. */
const TEMPO_WAIT = new Map()
function ensureTempo (r) {
  if (!r || r.loop || !r.key || !NAT) return Promise.resolve(r && r.bpm ? r.bpm : 0)
  if (r.bpm != null) return Promise.resolve(r.bpm)
  if (!TEMPO_WAIT.has(r.key)) TEMPO_WAIT.set(r.key, NAT.call('tempo', { key: r.key }).then(res => (res && res.sure >= .12 && res.bpm > 0 ? +(res.loop || res.bpm).toFixed(2) : 0)))
  return TEMPO_WAIT.get(r.key).then(bpm => { for (const t of S.tracks) for (const q of t.regs) if (q.key === r.key && q.bpm == null) q.bpm = bpm; return bpm })
}
const TRANS_WAIT = new Map()       // a file's key -> the asking that is under way (or done), so that whoever needs the answer can wait for it
function ensureTransients (r) {
  const k = srcKey(r)
  if (!k || r.loop) return Promise.resolve()
  if (!NAT) return Promise.resolve()                                                    // in a browser there is no one to ask: whatever is in TRANS is all there is
  if (!TRANS_WAIT.has(k)) {
    if (!TRANS.has(k)) TRANS.set(k, [])
    TRANS_WAIT.set(k, NAT.call('onsets', { key: k }).then(list => { TRANS.set(k, Array.isArray(list) ? list : []); uiDirty('lanes') }))
  }
  return TRANS_WAIT.get(k)
}
const forgetTransients = () => { TRANS.clear(); TRANS_WAIT.clear(); TEMPO_WAIT.clear() }
function toggleFlex () {
  S.flex = !S.flex
  if (S.flex) { if (S.auto) { S.auto = false; S.selP = [] } for (const t of S.tracks) for (const r of t.regs) ensureTransients(r) }
  uiDirty('scenes', 'lanes', 'dock', 'head', 'info')
}
const Q_VALUES = [[1 / 4, '1/4'], [1 / 8, '1/8'], [1 / 12, '1/8 triplet'], [1 / 16, '1/16'], [1 / 24, '1/16 triplet'], [1 / 32, '1/32']]
const qName = q => (Q_VALUES.find(x => Math.abs(x[0] - q) < 1e-9) || [0, '1/16'])[1]
const openQMenu = (x, y) => openMenu(x, y, Q_VALUES.map(([v, t]) => ({ t, v, on: Math.abs(S.q - v) < 1e-9 })), it => { S.q = it.v; uiDirty('info') })

/* in the flex view: where things begin (faint), and the pins that hold them (bright, with a head) */
function flexLines (r, xa, xb, ly, lh) {
  if (r.loop) return ''
  let faint = '', bright = ''
  const lo = Math.max(xa + 1, X0), hi = Math.min(xb - 1, X1), held = new Set((r.flex || []).map(m => m.s.toFixed(4)))
  if (!r.rev) for (const s of TRANS.get(srcKey(r)) || []) { if (held.has(s.toFixed(4))) continue; const x = xOfD(r, sToD(r, s)); if (x > lo && x < hi) faint += `M${n(x)} ${ly + 2}V${ly + lh - 2}` }
  const pinsN = (r.flex || []).length, room = pinsN ? (xb - xa) / pinsN : 99                                  // crowded pins are drawn as plain lines: their heads would run into one block
  for (const m of r.flex || []) { const x = xOfD(r, m.d); if (x > lo && x < hi) bright += `M${n(x)} ${ly}V${ly + lh}` + (room >= 9 ? `M${n(x - 3)} ${ly}H${n(x + 3)}L${n(x)} ${ly + 4}Z` : '') }
  if (room < 4) return bright ? P(bright, { stroke: K0, sa: .3, sw: 2 }) + P(bright, { stroke: INK, sa: .55 }) : ''
  return (faint && room >= 9 ? P(faint, { stroke: K0, sa: .22, sw: 2 }) + P(faint, { stroke: INK, sa: .5, sw: .8 }) : '') + (bright ? P(bright, { stroke: K0, sa: .5, sw: 3 }) + P(bright, { stroke: INK, fill: INK, sw: room >= 9 ? 1.2 : 1, sa: room >= 9 ? 1 : .8 }) : '')
}
/* the nearest thing to take hold of in a region: a pin, or a place where something begins */
function flexPick (r, x) {
  let best = null, bd = 5
  for (const m of r.flex || []) { const d = Math.abs(xOfD(r, m.d) - x); if (d < bd) { bd = d; best = { pin: m } } }
  if (!best && !r.rev) for (const s of TRANS.get(srcKey(r)) || []) { const d = Math.abs(xOfD(r, sToD(r, s)) - x); if (d < bd) { bd = d; best = { s } } }
  return best
}
const flexNear = (r, x) => !!flexPick(r, x)
/* take hold: a new pin also pins the beginnings on either side of it, so only what lies between them moves */
function flexDown (e, p, r, t, tool, before) {
  let pk = flexPick(r, p.x)
  if (!pk && tool === 'flex') pk = { s: dToS(r, dOfBar(r, barAt(p.x))) }
  if (!pk) return false
  const keep = (r.flex || []).map(m => Object.assign({}, m))
  r.flex = r.flex || []
  let pin = pk.pin
  if (!pin) {
    const tr = (TRANS.get(srcKey(r)) || []).slice().sort((a, b) => a - b), has = s => r.flex.some(m => Math.abs(m.s - s) < 1e-4)
    const left = r.flex.filter(m => m.s < pk.s - 1e-4).map(m => m.s), right = r.flex.filter(m => m.s > pk.s + 1e-4).map(m => m.s)
    const tl = tr.filter(s => s < pk.s - .02).pop(), trr = tr.find(s => s > pk.s + .02)
    if (tl != null && !(left.length && Math.max(...left) >= tl) && !has(tl)) r.flex.push({ s: tl, d: sToD(r, tl) })
    if (trr != null && !(right.length && Math.min(...right) <= trr) && !has(trr)) r.flex.push({ s: trr, d: sToD(r, trr) })
    pin = { s: pk.s, d: sToD(r, pk.s) }
    r.flex.push(pin)
  }
  r.flex.sort((a, b) => a.s - b.s)
  const all = pins(r), i = all.findIndex(m => m === pin), L = all[i - 1], Rr = all[i + 1], k = rateOf(r)
  /* a stretch may not be squeezed below a quarter nor pulled beyond four times */
  const lo = Math.max(L.d + (pin.s - L.s) / k / 4, Rr.d - (Rr.s - pin.s) / k * 4), hi = Math.min(L.d + (pin.s - L.s) / k * 4, Rr.d - (Rr.s - pin.s) / k / 4)
  S.selR = [r.id]; S.sel = S.tracks.indexOf(t)
  drag = { a: 'flex', id: r.id, pin, lo, hi, d0: pin.d, grab: pin.d - dOfBar(r, barAt(p.x)), keep, before }                // it is held where it was taken, so it does not jump to the pointer
  return true
}
function flexMove (e, p) {
  const d = drag, [r] = regOf(d.id)
  if (!r) return
  d.pin.d = clamp(dOfBar(r, snapPos(barOfD(r, dOfBar(r, barAt(p.x)) + d.grab), e, new Set([r.id]))), d.lo, d.hi)
  if (Math.abs(d.pin.d - d.d0) > 1e-5) d.moved = true
  uiDirty('lanes')
}
function restoreFlex (d) { const [r] = regOf(d.id); if (r) r.flex = d.keep }                                // a press that moved nothing leaves no pin
function flexDbl (e, p) {                                                                                    // twice on a pin: it lets go
  const ti = laneAt(p.y), r = hitRegion(ti, barAt(p.x))
  if (!r || !r.flex) return
  const m = r.flex.find(x => Math.abs(xOfD(r, x.d) - p.x) < 5)
  if (!m) return
  let ms = []
  edit(() => { const was = r.flex; r.flex = r.flex.filter(x => x !== m); ms = flexShare(r, was) })
  rewarp([r].concat(ms))
}
/* the regions that are stretched as one with r, and so carry the very same pins:
   – on its own lane, the other pieces of the same take: the same file at the same speed, lying where it would lie had it
     never been cut. A take cut in two is still one sound; pins of their own would let the two pieces drift apart, and at
     the cut (or inside a crossfade over it) they would no longer play the same place in the file;
   – on the other tracks of its edit group, the regions over the same stretch whose files run alongside (the same rate, the
     same place in the file) — several microphones on one kit: what one heard stays in step with what the others heard.
   Only those that carry the same pins already count: one that was given pins of its own (while it stood elsewhere, or
   in a song from before pieces shared theirs) plays what those say, and is not overwritten with another's. `pins`: the
   pins r had when they last agreed — r's own, unless r has just been given new ones. */
const fileOrigin = r => (r.a - 1) - (r.off || 0)                                         // where the file's own beginning lies on the lane, in bars
const sameTake = (x, r) => x !== r && !x.loop && !r.loop && !x.notes && !r.notes && srcKey(x) === srcKey(r) && !x.rev === !r.rev && Math.abs(rateOf(x) - rateOf(r)) < 1e-9 && Math.abs(fileOrigin(x) - fileOrigin(r)) < 1e-6 && Math.abs((x.sec || 0) - (r.sec || 0)) < .005
const samePins = (p, q) => { p = (p || []).slice().sort((a, b) => a.s - b.s); q = (q || []).slice().sort((a, b) => a.s - b.s); return p.length === q.length && p.every((m, i) => Math.abs(m.s - q[i].s) < 1e-6 && Math.abs(m.d - q[i].d) < 1e-6) }
function flexMates (r, pins) {
  const [, t] = regOf(r.id)
  if (!t || r.loop) return []
  if (pins === undefined) pins = r.flex
  const own = t.regs.filter(x => sameTake(x, r) && samePins(x.flex, pins)), out = new Set(own)
  for (const q of [r].concat(own)) for (const [x] of companions(q, t)) if (!x.loop && !x.rev === !q.rev && Math.abs(rateOf(x) - rateOf(q)) < 1e-9 && Math.abs((x.off || 0) - (q.off || 0)) < 1e-6 && Math.abs((x.sec || 0) - (q.sec || 0)) < .005 && samePins(x.flex, pins)) out.add(x)
  out.delete(r)
  return [...out]
}
/* pins made on one of them by hand are the others' too (`was`: the pins it had before) */
function flexShare (r, was) { const ms = flexMates(r, was); for (const x of ms) x.flex = (r.flex || []).map(m => Object.assign({}, m)); return ms }
/* quantize: every beginning the chosen regions show is pulled to the nearest line of the grid. Regions that are stretched
   as one (see flexMates) are pulled by all their beginnings together: where two of them hear the same hit a moment apart,
   the earlier hearing is the one that counts. A piece of the same take that is not chosen plays what it played: a pin
   holds each of its ends where it is, the pins that lie in it stay, and nothing that begins in it is pulled. */
async function quantize (regs) {
  const asked = new Set(regs.map(r => r.id)), seen = new Set(), sets = []
  for (const r of regs) { if (seen.has(r.id)) continue; const set = [r].concat(flexMates(r).filter(x => !seen.has(x.id))); for (const x of set) seen.add(x.id); sets.push(set) }
  regs = sets.flat()
  await Promise.all(regs.map(ensureTransients))
  for (let k = 0; k < 40 && regs.some(r => TRANS.get(srcKey(r)) && !TRANS.get(srcKey(r)).length && !quantize.empty); k++) await new Promise(res => setTimeout(res, 50))
  let moved = 0
  edit(() => {
    for (const set0 of sets) {
      const set = set0.filter(x => regOf(x.id)[0] === x)                                // (as they are now: the app was listened to meanwhile)
      const r = set.find(x => asked.has(x.id))
      if (!r || r.rev) continue
      const k = rateOf(r), [, t] = regOf(r.id), out = []
      const every = set.flatMap(x => TRANS.get(srcKey(x)) || []).sort((a, b) => a - b), tr = []
      for (const s of every) if (!tr.length || s - tr[tr.length - 1] > .03) tr.push(s)                      // (heard by several within three hundredths of a second: one beginning)
      const pulled = set.filter(x => asked.has(x.id) && (x === r || sameTake(x, r))), held = t.regs.filter(x => sameTake(x, r) && !pulled.includes(x))      // on r's own lane: the pieces that are pulled, and the pieces of the same take that are not
      const within = bar => pulled.some(x => bar >= x.a - 1 - 1e-6 && bar <= x.b - 1 + 1e-6)
      /* what is held: the two ends of every piece that is not pulled, and the pins that lie in one — each where it plays
         now. Between its two ends (in what is played, and in the file) nothing is pulled and nothing is pulled to. */
      const spans = held.map(y => { const da = dOfBar(r, y.a - 1), db = dOfBar(r, y.b - 1); return [dToS(r, da), dToS(r, db), da, db] })
      const inHeld = (s, d) => spans.some(h => (s > h[0] - 1e-6 && s < h[1] + 1e-6) || (d > h[2] - 1e-6 && d < h[3] + 1e-6))
      const ends = [...new Set(spans.flatMap(h => [h[2], h[3]]).map(d => +d.toFixed(9)))].filter(d => d > 1e-6 && d < (r.sec || 0) - 1e-6)
      const holds = ends.map(d => ({ s: dToS(r, d), d, hold: true })).concat((r.flex || []).filter(m => spans.some(h => m.d >= h[2] - 1e-6 && m.d <= h[3] + 1e-6)).map(m => ({ s: m.s, d: m.d, hold: true })))
      const marks = tr.map(s => ({ s })).concat(holds).sort((a, b) => a.s - b.s || (a.d || 0) - (b.d || 0))
      let last = { s: 0, d: 0 }
      for (const mk of marks) {
        const s = mk.s, d0 = mk.hold ? mk.d : s / k, bar = barOfD(r, d0)
        if (mk.hold) {                                                                  // a held place stays where it is; a pulled beginning that would be crushed or torn against it gives way
          while (out.length && !out[out.length - 1].hold && (d0 - out[out.length - 1].d < (s - out[out.length - 1].s) / k / 4 || d0 - out[out.length - 1].d > (s - out[out.length - 1].s) / k * 4)) out.pop()
          if (out.length && Math.abs(out[out.length - 1].s - s) < 1e-6) continue
          const m = { s, d: d0, hold: true }
          out.push(m); last = m
          continue
        }
        if (!within(bar)) continue
        const q = S.q * WHOLE(), d1 = dOfBar(r, Math.round(bar / q) * q), seg = (s - last.s) / k              // (the note value is a part of a whole note; the grid is in bars)
        if (inHeld(s, d1)) continue
        if (seg < .03 || d1 - last.d < seg / 4 || d1 - last.d > seg * 4) continue                           // would crush or tear what lies before it
        const m = { s, d: d1 }
        out.push(m); last = m
        if (Math.abs(d1 - d0) > 1e-4) moved++
      }
      const end = { s: srcSec(r), d: r.sec || 0 }
      while (out.length && !out[out.length - 1].hold && (end.d - out[out.length - 1].d < (end.s - out[out.length - 1].s) / k / 4)) out.pop()
      for (const x of set) x.flex = out.map(m => ({ s: m.s, d: m.d }))
    }
    return true
  })
  await rewarp(regs)
  say(moved ? `${moved} pulled to ${qName(S.q)}` : 'nothing to pull')
}
