/* ── the meter, on a wall ──
   A thing picked from the wall's own list like a print (it stands among the channel's things), wired like one, and
   changing nothing: the engine hands it the sound as it passes and takes it back as it went (Source/Meter.h). What it
   measures is shown on its face, a window of its own that a press on it opens (ui/meter.html, meterface.js); several can
   stand on one wall, each where it is wired. On the stereo out's wall it is the meter of the whole song.
   It is not a thing Patch on Slur has: in a hand-off's patch file, and in the part of a preset Patch on Slur reads, its
   place is closed over, as a plug-in's from outside is (preset.js keeps it in the part this app reads).
   The count (integrated, range, the held peaks) begins again when the song is played from another place than it was
   left at, and when reset is pressed on the face. This script is read after wall.js and preset.js. */
WALL_FAMILY.meter = 'utility'; WALL_KIND.meter = 'channel'
if (!WALL_PRINTS.includes('meter')) WALL_PRINTS.push('meter')
const meterNodes = w => (w ? w.nodes.filter(n => n.k === 'meter') : [])
/* its plate: a frame with the three bars of a level */
function meterPlate (node, sel) {
  const x = node.x, y = node.y, r = WALL_R
  let s = R(x - r + .5, y - r + .5, 2 * r - 1, 2 * r - 1, { rx: 2, fill: K3, stroke: INK, sa: .34 })
  for (const [dx, h, a] of [[-13, 20, .82], [-4, 34, .82], [5, 26, .82]]) s += R(x + dx, y + 17 - h, 7, h, { fill: INK, fa: a })
  s += P(`M${n(x - 13)} ${n(y - 21) + .5}H${n(x + 12)}`, { stroke: INK, sa: .5 })
  return G(s, '', node.bypass ? ' opacity=".35"' : '') + (sel ? Cc(x, y, r + 7, { stroke: INK, sa: .5, dash: '2 3' }) : '')
}
/* its face: the app shows the window (in a browser there is none) */
function meterOpen (t, node) {
  METER_AT.asked = { track: t.id, id: node.id }
  if (NAT) return NAT.call('meterShow', { track: t.id, id: node.id, name: asGiven(t.name).replace(/⁣/g, ''), c: t.c })
}
const METER_AT = { asked: null, left: null }
{
  const msg0 = wallMsg, print0 = wallPrint, preset0 = wallPreset, remove0 = wallRemove, play0 = play, halt0 = halt
  /* told to the engine: a place the sound is handed out at and taken back from, with a meter standing there */
  wallMsg = function (t) {
    const m = msg0(t), w = m ? wallOf(t) : null
    if (m) for (const node of meterNodes(w)) { const at = m.nodes.findIndex(x => x.id === node.id); if (at >= 0) m.nodes[at] = { id: node.id, type: 5, amount: .75, bypass: 0, meter: 1 } }
    return m
  }
  wallPrint = function (t, node, sel) { return node.k === 'meter' ? meterPlate(node, sel) : print0(t, node, sel) }
  /* the wall as a file Patch on Slur opens: without the meters, the way going on through where each stood */
  wallPreset = function (t) {
    const w = wallOf(t)
    if (!meterNodes(w).length) return preset0(t)
    const lean = Object.assign({}, w, { nodes: w.nodes.slice(), wires: w.wires.map(e => Object.assign({}, e)) })
    for (const node of meterNodes(w)) {
      const ins = lean.wires.filter(e => e.to === node.id && !e.in), outs = lean.wires.filter(e => e.from === node.id)
      lean.wires = lean.wires.filter(e => e.from !== node.id && e.to !== node.id)
      for (const i of ins) for (const o of outs) if (i.from !== o.to && !lean.wires.some(e => e.from === i.from && e.to === o.to && (e.port || 0) === (i.port || 0) && (e.in || 0) === (o.in || 0))) lean.wires.push(Object.assign({ from: i.from, to: o.to, gain: o.gain, port: i.port || 0 }, o.in ? { in: 1 } : {}))
      lean.nodes = lean.nodes.filter(x => x !== node)
    }
    t.wall = lean
    try { return preset0(t) } finally { t.wall = w }
  }
  wallRemove = function (t, node) { if (node && node.k === 'meter' && NAT) NAT.call('meterClose', { track: t.id, id: node.id }); return remove0(t, node) }
  /* played from another place than it was left at: every meter counts anew */
  play = function (from) { const at = from == null ? S.pos : from; if (NAT && (METER_AT.left == null || Math.abs(at - METER_AT.left) > 1e-6)) NAT.call('meterReset', { track: 0 }); return play0.apply(this, arguments) }
  halt = function () { METER_AT.left = typeof curPos === 'function' ? curPos() : S.pos; return halt0.apply(this, arguments) }
}
