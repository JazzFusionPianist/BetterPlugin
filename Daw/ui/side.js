/* ── the side: Patch on Slur's sidechain, on a track's wall ──
   In Patch on Slur the side is a print with no way in and one way out: the sound the host gives the plug-in on its side
   bus. Here that sound is another track's, picked from a list when the side is pressed (as a plug-in from outside is
   given the track it listens to). It goes where it is wired: into a print's key — glue, gate, comp, repeat, carve, match
   and vocode have one, the point below their way in, marked key — so that the print listens to that track in place of
   its own sound (a comp on the bass that ducks to the kick); or into the way of the sound like anything else.
   The track is the wall's (t.sideFrom: every side on one wall plays it) and is written with the project. The engine works
   it before this one and lines it up with this one's way in (Engine::setSide); a track that is fed by this one is refused.
   It is told to the engine when it is picked and whenever the session is told again. Read after wall.js and preset.js. */
if (typeof KEEP_T !== 'undefined' && !KEEP_T.includes('sideFrom')) KEEP_T.push('sideFrom')
const WALL_KEYED = new Set(WALL_PRINTS.filter(k => PC.hasKeyType(WALL_TYPE[k])))        // the prints with a second way in (Patch on Slur's, from its catalog)
const wallHasKey = node => !!node && WALL_KEYED.has(node.k)
const wallKeyPort = (w, id) => { const q = wallPos(w, id); return { x: q.x - WALL_R - 3, y: q.y + 18 } }
/* a side has no way in; only a print with a key takes a wire into its key */
function wallTakesNothing (w, to, inp) { const node = wallNode(w, to); if (!node) return false; return node.k === 'side' || (!!inp && !wallHasKey(node)) }
const sideWord = t => { const s = t && t.sideFrom ? byId(t.sideFrom) : null; return s ? asGiven(s.name) : 'nothing' }
/* which track the wall's side plays */
async function sideSet (t, id) {
  id = id || 0
  if (!NAT) { t.sideFrom = id; uiDirty('dock'); return true }
  const r = await NAT.call('sideFrom', { track: t.id, from: id })
  if (r && r.ok) { t.sideFrom = id; say(id ? `the side plays ${byId(id).name}` : 'the side plays nothing') }
  else say(r && r.why === 'ring' ? 'that track is fed by this one' : r && r.why === 'busy' ? 'not while it prints' : 'that track is not there')
  uiDirty('dock')
  return !!(r && r.ok)
}
function sideMenu (t, node) {
  const w = wallOf(t), g = WALL.g
  if (!w || !g || t === OUT) return
  const v = wallView(w, g), x = v.tx + node.x * v.z - 20, y = v.ty + node.y * v.z + 34 * v.z + 4
  openMenu(x, y, [{ t: 'nothing', v: 0, on: !t.sideFrom }].concat(S.tracks.filter(s => s !== t).map((s, i) => ({ t: asGiven(s.name), k: s.kind === 'audio' ? '' : s.kind, v: s.id, on: t.sideFrom === s.id, sep: i === 0 }))), it => sideSet(t, it.v), { w: 200 })
}
{
  const patch0 = pPatch, remove0 = wallRemove
  /* a print's key point, below its way in, with its word */
  pPatch = function (y, h) {
    let s = patch0(y, h)
    const t = wallTrack(), w = t && wallOf(t), g = WALL.g
    if (!w || !g || g.id !== t.id) return s
    const v = wallView(w, g)
    let k = ''
    for (const node of w.nodes) {
      if (!wallHasKey(node)) continue
      const p = wallKeyPort(w, node.id), x = v.tx + p.x * v.z, yy = v.ty + p.y * v.z, used = w.wires.some(e => e.to === node.id && e.in), d = WALL.drag, lit = d && d.k === 'wire' && d.land === node.id && d.landIn
      k += Cc(x, yy, (lit ? 3.4 : 2.2) * Math.max(.7, v.z), { fill: used || lit ? INK : K1, stroke: INK, sa: used || lit ? 1 : .6, sw: 1.1 }) + T(x - 6, yy + 3, 'key', { size: 8.5 * Math.max(.75, Math.min(1, v.z)), a: used ? .7 : .42, anchor: 'end' })
    }
    return k ? s + `<clipPath id="side-clip"><rect x="0" y="${n(y)}" width="${n(g.w)}" height="${n(h - 26)}"/></clipPath>` + G(k, '', ' clip-path="url(#side-clip)"') : s
  }
  /* the last side taken off: the wall plays no track */
  wallRemove = function (t, node) { const r = remove0(t, node); if (node && node.k === 'side' && t.sideFrom && !wallOf(t).nodes.some(x => x.k === 'side')) sideSet(t, 0); return r }
  /* the session told again (a project opened, tracks made): each wall's side is told what it plays */
  if (typeof natSession === 'function') { const ns0 = natSession; natSession = async function (...a) { const r = await ns0(...a); if (NAT) for (const t of S.tracks) if (t.sideFrom && byId(t.sideFrom)) await NAT.call('sideFrom', { track: t.id, from: t.sideFrom }); return r } }
}
