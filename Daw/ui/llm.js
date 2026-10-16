/* ── low latency mode: the bolt in the transport ──
   On, what is heard live — a track listening to its input, one played by hand — goes its way without what is later than
   the limit (settings > audio > low latency, 5 ms at first): every plug-in and print on that track, on the buses it flows
   into and on the stereo out, later than that, is stepped past until the bolt is turned off, so what is played is heard at
   once. The engine decides it (Engine::lowLatency) and says what it steps past; on the wall each of those is dimmed and says
   so, and how late it was. Nothing written in the song changes, the mode is not kept with a project, and a print is never
   made with it: the engine is told to play everything for the print and the mode comes back after it.
   Read after wall.js and ctl.js. */
const LLM = { facts: null, soon: 0 }
S.lowLat = false
/* what the engine steps past on this track's wall: node id → milliseconds */
const llmSkippedOn = t => { const m = new Map(); if (!S.lowLat || !LLM.facts || !t) return m; for (const k of LLM.facts.skipped || []) if (k.track === t.id && k.node != null) m.set(k.node, k.ms); return m }
async function toggleLowLat (on) {
  S.lowLat = on == null ? !S.lowLat : !!on
  if (NAT) LLM.facts = await NAT.call('lowLatency', { on: S.lowLat ? 1 : 0 })
  const n = S.lowLat && LLM.facts ? (LLM.facts.skipped || []).length : 0
  say(!S.lowLat ? 'low latency off' : n ? `low latency: ${n} stepped past` : 'low latency: nothing to step past')
  uiDirty('top', 'dock')
}
/* what is stepped past follows what is armed and listened to, and the walls as they change */
async function llmRefresh () {
  if (!NAT || !S.lowLat) return
  const was = JSON.stringify(LLM.facts && LLM.facts.skipped)
  LLM.facts = await NAT.call('lowLatFacts')
  if (JSON.stringify(LLM.facts && LLM.facts.skipped) !== was) uiDirty('dock')
}
const llmSoon = () => { if (!S.lowLat) return; clearTimeout(LLM.soon); LLM.soon = setTimeout(llmRefresh, 250) }
setInterval(() => { if (S.lowLat) llmRefresh() }, 1000)
{
  const push0 = wallPush, track0 = typeof pushTrack === 'function' ? pushTrack : null, patch0 = pPatch
  wallPush = function () { const r = push0.apply(this, arguments); llmSoon(); return r }
  if (track0) pushTrack = function () { const r = track0.apply(this, arguments); llmSoon(); return r }
  if (NAT) {
    /* a print is made with everything in it: the mode is put aside while it is made, and back after it */
    const call0 = NAT.call.bind(NAT)
    NAT.call = async function (op, d) {
      if (op !== 'bounce' || !S.lowLat) return call0(op, d)
      await call0('lowLatency', { on: 0 })
      try { return await call0(op, d) } finally { LLM.facts = await call0('lowLatency', { on: S.lowLat ? 1 : 0 }); uiDirty('dock') }
    }
    /* settings told a new limit */
    NAT.on('dawLowLat', d => { LLM.facts = d; uiDirty('dock') })
  }
  /* on the wall: what is stepped past is dimmed, and says so in the monitor's orange */
  pPatch = function (y, h) {
    let s = patch0(y, h)
    const t = wallTrack(), w = t && wallOf(t), g = WALL.g, skip = llmSkippedOn(t)
    if (!w || !g || g.id !== t.id || !skip.size) return s
    const v = wallView(w, g)
    let a = ''
    for (const [id, ms] of skip) {
      const node = wallNode(w, id)
      if (!node) continue
      const x = v.tx + node.x * v.z, yy = v.ty + node.y * v.z, ctl = PC.isControlType(WALL_TYPE[node.k])
      a += node.k === 'plug' ? R(x - 34 * v.z, yy - 34 * v.z, 68 * v.z, 68 * v.z, { fill: K1, fa: .55 }) : Cc(x, yy, (WALL_R * (ctl ? .6 : 1) + 2) * v.z, { fill: K1, fa: .55 })
      a += T(x, yy + (ctl ? 62 : 74) * v.z, `skipped · ${Math.round(ms)} ms`, { size: 9 * Math.max(.8, Math.min(1, v.z)), c: MON, anchor: 'middle' })
    }
    return s + `<clipPath id="llm-clip"><rect x="0" y="${n(y)}" width="${n(g.w)}" height="${n(h - 26)}"/></clipPath>` + G(a, '', ' clip-path="url(#llm-clip)"')
  }
}
