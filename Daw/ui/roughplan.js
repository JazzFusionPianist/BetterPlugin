/* ── the rough mix's plan: what each of the three pictures does to each track ──
   His ask (2026-10-23): a first mix of the whole session in seconds, three ways that differ in the PICTURE — A up front
   (dry, the vocal on top, what meets carved apart by eq, the bus only takes the peaks), B one room (all of it in one
   room, what meets ducks, glued on the bus), C wide (to the edges, the back given long tails, the front dry, nothing on
   the bus). All three share the floor: each part set to where he sets it, low cut where nothing low is played, the lows
   in mono. Drawn in design/rough mix draft 1 and 2; put on (or, in US/UK sales, only listed) by roughmix.js.
   The targets are his own: what each part stands at against the whole mix, read back from his finished mixes against
   their multitracks (mixlab/hear-mix.mjs and roles.mjs — the middle of the songs read well), never from his project
   files' faders (they hold another kind of thing) and never a song looked up by its likeness.
   Kept clear of the patents in mixlab/patents-1.md: panning from a table of roles, never from what a track's spectrum
   holds; carving between two parts is static and goes both ways (each keeps a home band, neither ranks over the other);
   ducking is broadband; a room's send is a level from a table, not measured back; a compressor's ratio, attack and
   release are its role's, its threshold a place in the track's own spread of levels; the role that drives all of it is
   the one he confirmed.
   roughPlan(tracks, lines, roles, opts) → { floor, A, B, C } — each picture { moves: [{ track, part, kind, value, why }],
   summary } — plain data (no page, no engine), so the bench in node reads it as the room does.
     tracks  [{ id, name }]          lines  { id: the ears' lines of that track heard alone (ears.js) }
     roles   { id: role }            opts   { targets, region, tempo, pairs: [{ a, b, bands: { low, mid, presence } }] } */

/* ── what each part stands at against the whole mix, in db (his middle, the songs read well: 19 on 2026-10-23) ── */
const RP_TARGET = { lead: -5.8, bgv: -12.1, kick: -10.2, snare: -14.4, drums: -7.8, bass: -8.9, other: -4.4, fx: -16 }
/* the pictures move a few parts off that: A puts the vocal on top, B lets the room blend it, C keeps the table */
const RP_PICTURE = {
  A: { name: 'up front', lead: +1, bgv: -1, other: 0 },
  B: { name: 'one room', lead: -0.5, bgv: +0.5, other: +0.5 },
  C: { name: 'wide', lead: 0, bgv: +0.5, other: 0 }
}
const RP_MIX_LUFS = -18                                                                   // where the whole sits before the bus (room left for the master)

/* ── a role, gathered into the part it is balanced as ── */
const RP_PART = role => {
  const r = String(role || '').toLowerCase()
  if (/^(lead|vox|vocal|rap|main)$/.test(r)) return 'lead'
  if (/^(bgv|backing|double|adlib|choir|harmony)$/.test(r)) return 'bgv'
  if (r === 'kick') return 'kick'
  if (r === 'snare' || r === 'clap' || r === 'rim') return 'snare'
  if (/^(hat|tom|overheads|cymbal|drums|perc|shaker|tambourine|conga|bongo|cajon|cowbell|triangle|room)$/.test(r)) return 'drums'
  if (/^(bass|sub bass|synth bass|upright|808)$/.test(r)) return 'bass'
  if (/^(fx|riser|sweep|noise|foley)$/.test(r)) return 'fx'
  return 'other'
}

/* ── where each part stands left to right: a table of roles (the drummer's view, his pick 2026-10-23), never the
   spectrum. Pairs (doubles, two guitars, left and right takes) go to opposite sides; each picture its own spread ── */
const RP_PAN = { kick: 0, snare: 0, bass: 0, '808': 0, 'sub bass': 0, 'synth bass': 0, upright: 0, lead: 0, vox: 0, rap: 0,
  hat: -0.35, overheads: 0, cymbal: 0.25, ride: 0.4, tom: 0, perc: 0.3, shaker: -0.4, tambourine: 0.45, clap: 0 }
const RP_SPREAD = { A: 0.6, B: 0.45, C: 0.95 }
/* a track named for its side, or one of a numbered pair */
const rpSide = name => { const n = String(name || ''); if (/(^|[\s_\-(])(l|left)([\s_\-)]|\d|$)/i.test(n)) return -1; if (/(^|[\s_\-(])(r|right)([\s_\-)]|\d|$)/i.test(n)) return 1; return 0 }
/* toms by their order in the session, high to floor: from left to right as the drummer sits */
const rpTomPan = (i, n) => n <= 1 ? 0.2 : -0.35 + 0.8 * i / (n - 1)

/* ── low cut: where nothing low is played, up to the role's most ── */
const RP_CUT = { lead: [80, 120], bgv: [100, 160], snare: [60, 90], drums: [100, 250], other: [40, 120], fx: [60, 200], kick: [0, 25], bass: [0, 30] }
const RP_CUT_ROLE = { hat: [200, 350], overheads: [80, 150], cymbal: [200, 350], pad: [80, 160], gtr: [70, 110], electric: [70, 110], acoustic: [60, 100], piano: [30, 60], keys: [40, 90], synth: [40, 100], strings: [50, 90] }

/* ── a compressor by role (textbook: ratio, attack, release); its threshold where the track's level stands this many db
   over its own middle (a place in its own spread: dyn is the spread of its loud and quiet parts) ── */
const RP_COMP = {
  lead: { ratio: 3, attack: 10, release: 100, over: 0.35 }, bgv: { ratio: 4, attack: 5, release: 80, over: 0.3 },
  kick: { ratio: 4, attack: 30, release: 60, over: 0.5 }, snare: { ratio: 4, attack: 20, release: 80, over: 0.5 },
  bass: { ratio: 4, attack: 20, release: 120, over: 0.35 }, other: { ratio: 2, attack: 20, release: 150, over: 0.5 }
}

/* ── the rooms: sends in db against the track's own fader, by picture and part (0: none) ── */
const RP_SEND = {
  A: {},
  B: { lead: -12, bgv: -8, snare: -10, drums: -14, other: -12, fx: -8 },
  C: { lead: -20, bgv: -7, snare: -16, drums: -18, other: -10, fx: -6, pad: -5 }
}

function roughPlan (tracks, lines, roles, opts = {}) {
  const T = Object.assign({}, RP_TARGET, opts.targets || {}), tempo = opts.tempo || 120
  const items = tracks.map(t => ({ t, role: String(roles[t.id] || 'other').toLowerCase(), L: lines[t.id] || null })).filter(x => x.L && isFinite(x.L.loud))
  for (const x of items) x.part = RP_PART(x.role)

  /* the floor, the same in all three: low cut, the lows in mono */
  const floor = []
  for (const x of items) {
    const [lo, hi] = RP_CUT_ROLE[x.role] || RP_CUT[x.part] || [40, 120]
    if (hi <= 0) continue
    const quiet = x.L.low == null || x.L.low < -24                                          // (how much lies under 120 hz, against the whole of it)
    const hz = Math.round(quiet ? hi : lo)
    if (hz >= 20) floor.push({ track: x.t.id, part: x.part, kind: 'lowcut', value: { hz, slope: 12 }, why: quiet ? 'nothing low is played' : 'below what it plays' })
  }

  const pictures = {}
  for (const P of ['A', 'B', 'C']) {
    const moves = [], pic = RP_PICTURE[P]
    /* balance: each part a share of the whole by its target (the shares of the parts present are made to fill it);
       within a part, its tracks keep the balance they came with */
    const parts = [...new Set(items.map(x => x.part))]
    const want = Object.fromEntries(parts.map(p => [p, Math.pow(10, ((T[p] ?? T.other) + (pic[p] || 0)) / 10)]))
    if (want.drums != null && (want.kick != null || want.snare != null)) want.drums = Math.max(want.drums * 0.3, want.drums - (want.kick || 0) - (want.snare || 0))   // (the kit's target holds its kick and snare too)
    const sum = Object.values(want).reduce((s, v) => s + v, 0), whole = Math.pow(10, RP_MIX_LUFS / 10)
    for (const p of parts) {
      const its = items.filter(x => x.part === p), e = its.map(x => Math.pow(10, x.L.loud / 10)), eg = e.reduce((s, v) => s + v, 0)
      its.forEach((x, k) => {
        const target = whole * want[p] / sum * e[k] / eg, db = Math.max(-40, Math.min(12, 10 * Math.log10(target / e[k])))
        moves.push({ track: x.t.id, part: p, kind: 'gain', value: Math.round(db * 10) / 10, why: `${p} at ${(10 * Math.log10(want[p] / sum)).toFixed(1)} db of the whole` })
      })
    }

    /* pan: the role table; pairs and sides spread by the picture */
    const spread = RP_SPREAD[P], toms = items.filter(x => x.role === 'tom'), twins = new Map()
    for (const x of items) {
      let v = RP_PAN[x.role]
      if (x.role === 'tom') v = rpTomPan(toms.indexOf(x), toms.length)
      if (v == null) {
        const side = rpSide(x.t.name)
        if (side) v = side * spread
        else if (x.L.width != null && x.L.width > 0.2) v = 0                                    // (a stereo part keeps its own image)
        else { const k = (twins.get(x.part) || 0) + 1; twins.set(x.part, k); v = x.part === 'lead' ? 0 : (k % 2 ? -1 : 1) * spread * (k <= 2 ? 1 : 0.6) }
      }
      if (P === 'B' && v) v = Math.round(v * 0.85 * 100) / 100
      moves.push({ track: x.t.id, part: x.part, kind: 'pan', value: Math.round(v * 100) / 100, why: x.role === 'tom' ? 'toms from high to floor, as the drummer sits' : RP_PAN[x.role] != null ? `${x.role}: its place in the table` : 'one of a pair, to its side' })
    }

    /* corrective eq: only what stands out of its role's own range (a resonance, mud, a boxy middle) */
    for (const x of items) {
      if (x.L.ring != null && x.L.ring > 9 && x.L.ringHz) moves.push({ track: x.t.id, part: x.part, kind: 'eq', value: { type: 'bell', f: Math.round(x.L.ringHz), g: -Math.min(6, Math.round((x.L.ring - 6) * 10) / 10), q: 6 }, why: 'a ringing that stands out' })
      if (x.L.mud != null && x.L.mud > -6 && x.part !== 'bass' && x.part !== 'kick') moves.push({ track: x.t.id, part: x.part, kind: 'eq', value: { type: 'bell', f: 300, g: -Math.min(4, Math.round((x.L.mud + 9) * 10) / 10), q: 1 }, why: 'mud' })
      if (x.L.box != null && x.L.box > -5 && x.part !== 'bass') moves.push({ track: x.t.id, part: x.part, kind: 'eq', value: { type: 'bell', f: 700, g: -Math.min(3, Math.round((x.L.box + 8) * 10) / 10), q: 1.4 }, why: 'a boxy middle' })
    }

    /* what meets: A carves both ways, each keeping a home band; B ducks broadband; C leaves the eq alone */
    const pairs = opts.pairs || []
    const home = { kick: 55, bass: 110, lead: 2500, other: 1200, bgv: 3500, snare: 200 }
    for (const pr of pairs) {
      const a = items.find(x => x.t.id === pr.a), b = items.find(x => x.t.id === pr.b)
      if (!a || !b) continue
      const meet = Math.max(...Object.values(pr.bands || {}).map(Number).filter(isFinite), 0)
      if (meet < 0.3) continue
      if (P === 'A') {
        const ha = home[a.part], hb = home[b.part]
        if (ha && hb && ha !== hb) {
          moves.push({ track: b.t.id, part: b.part, kind: 'eq', value: { type: 'bell', f: ha, g: -2, q: 1.2 }, why: `room for the ${a.part} at its home` })
          moves.push({ track: a.t.id, part: a.part, kind: 'eq', value: { type: 'bell', f: hb, g: -2, q: 1.2 }, why: `room for the ${b.part} at its home` })
        }
      }
      if (P === 'B' && ((a.part === 'kick' && b.part === 'bass') || (a.part === 'bass' && b.part === 'kick'))) {
        const k = a.part === 'kick' ? a : b, bs = a.part === 'kick' ? b : a
        moves.push({ track: bs.t.id, part: 'bass', kind: 'duck', value: { key: k.t.id, depth: 3, attack: 2, release: 80 }, why: 'the bass steps aside for the kick' })
      }
    }

    /* compressors by role; the bus by picture */
    for (const x of items) {
      const c = RP_COMP[x.part]; if (!c || (P === 'C' && x.part === 'other')) continue
      const thr = Math.round((x.L.loud + (x.L.dyn || 8) * c.over) * 10) / 10
      moves.push({ track: x.t.id, part: x.part, kind: 'comp', value: { thr, ratio: c.ratio, attack: c.attack, release: c.release }, why: `${x.part}: held a little` })
    }
    if (P === 'A') moves.push({ track: 0, part: 'bus', kind: 'bus', value: { kind: 'peak', ratio: 4, attack: 1, release: 50, gr: 1.5 }, why: 'only the loudest hits taken' })
    if (P === 'B') moves.push({ track: 0, part: 'bus', kind: 'bus', value: { kind: 'glue', ratio: 2, attack: 30, release: 'auto', gr: 2 }, why: 'held together' })

    /* the rooms: a send from the table, the room's length from the tempo */
    const beat = 60 / tempo
    for (const x of items) {
      const db = (RP_SEND[P][x.role] ?? RP_SEND[P][x.part]); if (db == null) continue
      moves.push({ track: x.t.id, part: x.part, kind: 'send', value: { bus: P === 'B' ? 'room' : 'hall', db }, why: P === 'B' ? 'into the one room' : x.part === 'lead' ? 'the front stays dry' : 'further back, a long tail' })
    }
    const room = P === 'B' ? { decay: Math.round(beat * 2.5 * 10) / 10, predelay: Math.round(beat / 16 * 1000) } : P === 'C' ? { decay: Math.round(beat * 5 * 10) / 10, predelay: Math.round(beat / 8 * 1000) } : null
    moves.push({ track: 0, part: 'bus', kind: 'monoLows', value: { hz: P === 'C' ? 80 : P === 'B' ? 100 : 120 }, why: 'the lows in the middle' })

    pictures[P] = { name: pic.name, moves: floor.concat(moves), room, summary: rpSummary(moves, items) }
  }
  return Object.assign({ floor }, pictures)
}

/* what the page says of a picture (the right of the rough mix tab): the balance, the pans, what meets, the room, the bus */
function rpSummary (moves, items) {
  const by = k => moves.filter(m => m.kind === k)
  return {
    gains: by('gain').length, pans: by('pan').filter(m => m.value).length, carves: by('eq').filter(m => /home/.test(m.why)).length,
    ducks: by('duck').length, sends: by('send').length, bus: (by('bus')[0] || {}).value || null, tracks: items.length
  }
}

if (typeof module === 'object' && module.exports) module.exports = { roughPlan, RP_TARGET, RP_PART, RP_PICTURE }
