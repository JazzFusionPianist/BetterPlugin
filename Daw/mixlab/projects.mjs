// node mixlab/projects.mjs [--wait] — his whole Logic projects, as he lays them out on his drive (2026-10-23): one folder a
// song under /Volumes/창고/10s Rough Mix Project, holding the .logicx, its Audio Files (beside it or in the bundle's Media),
// a Bounces folder with his last monitor in it, and sometimes the stems the artist sent; and, read where they stand, the
// mixes among his finished work (a1. WORKS/1 COMPLETED: an EP is a folder of songs, a Bounces holds every monitor he made,
// a folder may hold the mix and its teaser or live edit). Which roots, and which songs are left out (read already
// elsewhere), is in mixlab/out/project-roots.json: out/, as it names his clients' songs. For each: which file is the mix,
// which ProjectData was saved nearest the bounce (the settings he bounced with), the project's own rate, tempo and the
// sounds it uses, and which tracks run the whole song (those hear-mix.mjs can take as they are; the rest sit at places
// only ProjectData knows). He keeps adding songs while this runs: a folder still growing is left for the next look.
// --wait: look every three minutes at the roots he adds to; when new or changed folders have stopped growing and nothing
// else is being copied, index them and end (a watcher starts it again). Nothing is written on his drive.
// Out: mixlab/out/projects.json; mixlab/out/projects.list (the .logicx paths, one a line, for logic-use.mjs); and for each
// song mixlab/out/songs/<artist, title>/, the mix and a tracks/ folder of what lines up with it, all links to his drive,
// so that `node mixlab/hear-mix.mjs "mixlab/out/songs/<artist, title>"` takes it as it is.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync, openSync, readSync, closeSync, rmSync, symlinkSync } from 'node:fs'
import { join, dirname, basename, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url)), OUT = join(here, 'out'), JSONF = join(OUT, 'projects.json'), SONGS = join(OUT, 'songs')
mkdirSync(OUT, { recursive: true })
/* a root: every folder in it a song; or, with take, only the folders whose names match it (and not drop), each walked for
   the projects in it. watch: false, read once (he adds to it no more). skip: songs by their "artist, title" */
const ROOTS = process.env.MIXLAB_PROJECTS ? [{ root: process.env.MIXLAB_PROJECTS }]
  : (() => { try { return JSON.parse(readFileSync(join(OUT, 'project-roots.json'), 'utf8')).roots } catch { return [{ root: '/Volumes/창고/10s Rough Mix Project' }] } })()
const nfc = x => x.normalize('NFC')
const norm = x => nfc(x).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const titleOf = song => norm(song.split(',').slice(1).join(',') || song)
const SOUND = /\.(wav|aif|aiff|mp3|m4a|caf)$/i
const ls = dir => { try { return readdirSync(dir).filter(x => !x.startsWith('.')) } catch { return [] } }
const isDir = p => { try { return statSync(p).isDirectory() } catch { return false } }

/* a folder's weight: bytes and files, everything under it (the bundle too) */
function weigh (dir) {
  let bytes = 0, files = 0
  const walk = d => { for (const x of ls(d)) { const p = join(d, x); let s; try { s = statSync(p) } catch { continue } if (s.isDirectory()) walk(p); else { bytes += s.size; files++ } } }
  walk(dir); return { bytes, files }
}

/* a sound's rate, sides and length, from its header (wav, aiff); anything else as the Mac reads it */
function hear (file) {
  try {
    const fd = openSync(file, 'r'), size = statSync(file).size, h = Buffer.alloc(12); readSync(fd, h, 0, 12, 0)
    const id = h.toString('latin1', 0, 4), form = h.toString('latin1', 8, 12)
    if (id === 'RIFF' && form === 'WAVE') {
      let at = 12, fmt = null; const ch = Buffer.alloc(8)
      while (at + 8 <= size) {
        readSync(fd, ch, 0, 8, at); const cid = ch.toString('latin1', 0, 4), len = ch.readUInt32LE(4)
        if (cid === 'fmt ') { const b = Buffer.alloc(16); readSync(fd, b, 0, 16, at + 8); fmt = { chans: b.readUInt16LE(2), rate: b.readUInt32LE(4), align: b.readUInt16LE(12), bits: b.readUInt16LE(14) } }
        if (cid === 'data' && fmt) { closeSync(fd); return { rate: fmt.rate, chans: fmt.chans, bits: fmt.bits, secs: +(Math.min(len, size - at - 8) / fmt.align / fmt.rate).toFixed(2) } }
        at += 8 + len + (len & 1)
      }
      closeSync(fd); return null
    }
    if (id === 'FORM' && (form === 'AIFF' || form === 'AIFC')) {
      let at = 12; const ch = Buffer.alloc(8)
      while (at + 8 <= size) {
        readSync(fd, ch, 0, 8, at); const cid = ch.toString('latin1', 0, 4), len = ch.readUInt32BE(4)
        if (cid === 'COMM') {
          const b = Buffer.alloc(18); readSync(fd, b, 0, 18, at + 8); closeSync(fd)
          const chans = b.readUInt16BE(0), frames = b.readUInt32BE(2), bits = b.readUInt16BE(6)
          const e = b.readUInt16BE(8) & 0x7fff, m = b.readUInt32BE(10) * 2 ** 32 + b.readUInt32BE(14), rate = Math.round(m * 2 ** (e - 16383 - 63))      // (an 80-bit float)
          return { rate, chans, bits, secs: +(frames / rate).toFixed(2) }
        }
        at += 8 + len + (len & 1)
      }
      closeSync(fd); return null
    }
    closeSync(fd)
    const t = execFileSync('afinfo', [file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    const f = /(\d+) ch,\s+(\d+) Hz,\s+([^\s(]+)/.exec(t), d = /estimated duration: ([\d.]+)/.exec(t)
    return f ? { rate: +f[2], chans: +f[1], kind: f[3].replace(/^\./, ''), secs: d ? +(+d[1]).toFixed(2) : null } : null
  } catch { return null }
}

/* the mix in Bounces: his names say which (MON4, MIX, Monitor, MAST; ** the one sent; never a tune monitor), the latest first */
const mixScore = n => { n = nfc(n).toLowerCase(); let v = 0
  if (/mon\s*\d|monitor|mix|mast/.test(n)) v += 10; v += (n.match(/\*/g) || []).length; if (/tune/.test(n)) v -= 100; return v }
/* a bounce, by its name: the monitor his names number (MON4, Monitor #2) and its stars (** a later take of it), a master
   ([mast], 가마스터), or what is not the mix (an instrumental, a click, one part alone, a teaser, an A-B) */
const NOTMIXED = /\((ar|inst)\)|\b(inst|instrumental|click|only|no\s+(gtr|guitar|bass|drums?|vox|vocal|piano|keys|synth)|mtr|guide|a-b|teaser|tune|length|acapella|a\s?cappella|mr|sped|slowed)\b|[[(][^\])]*\b(choir|vox|vocals?|delay|verb|reverb|fx|drums?|bass|gtr|guitar|piano|keys|synth|strings?|perc|stems?)\b[^\])]*[\])]/i
const bounceOf = n => { const m = /(?:^|[^a-z])mon\s*(\d+)|monitor\s*#?\s*(\d+)/i.exec(n)      // (MIX_MON1 too: "_" is no edge to \b)
  return { mon: m ? +(m[1] || m[2]) : null, stars: (n.match(/\*/g) || []).length, mast: /(?:^|[^a-z])mast(?:er(?:ed)?)?(?![a-z])|가마스터/i.test(n), other: NOTMIXED.test(n) } }
/* his last monitor of the mix: of the numbered monitors that are the whole mix, the latest made; a master of it is not it.
   Without numbers: one his names mark as a mix, else one named for the song (not a track bounced beside it: kick.wav) */
function pickMix (all, title) {
  if (all.length === 1) return all[0]
  const latest = xs => xs.sort((a, b) => b.t - a.t)[0], named = x => title && norm(x.name).includes(title)
  return latest(all.filter(x => x.mon != null && !x.other && !x.mast)) || latest(all.filter(x => x.mon != null && !x.other))
    || latest(all.filter(x => mixScore(x.name) >= 10 && !x.other && !x.mast)) || latest(all.filter(x => named(x) && !x.other && !x.mast))
    || latest(all.filter(x => mixScore(x.name) >= 10 && !x.other)) || latest(all.filter(x => named(x) && !x.other)) || latest(all.filter(x => !x.other)) || latest(all)
}

/* a folder of sounds: how many, at which rates, how many run near the whole song */
function sounds (dir, secs) {
  const all = []
  const walk = (d, depth) => { for (const x of ls(d)) { const p = join(d, x); if (isDir(p)) { if (depth < 2) walk(p, depth + 1) } else if (SOUND.test(x)) all.push(p) } }
  walk(dir, 0)
  const rates = {}, whole = []
  for (const p of all) {
    const a = hear(p); if (!a) continue
    rates[a.rate] = (rates[a.rate] || 0) + 1
    if (secs && a.secs >= secs * .85 && a.secs <= secs * 1.1) whole.push(nfc(p.slice(dir.length + 1)))
  }
  return { dir: nfc(dir), files: all.length, rates, whole: whole.length, wholeFiles: whole }
}

/* where a sound is first and last heard (above −60 dBFS), read in from each end; wav and aiff, pcm or float */
function sounding (file) {
  let fd
  try {
    fd = openSync(file, 'r'); const size = statSync(file).size, h = Buffer.alloc(12); readSync(fd, h, 0, 12, 0)
    const aiff = h.toString('latin1', 0, 4) === 'FORM'
    if (!aiff && h.toString('latin1', 0, 4) !== 'RIFF') return null
    const ch = Buffer.alloc(8); let at = 12, f = null, data = null
    while (at + 8 <= size && !data) {
      readSync(fd, ch, 0, 8, at); const id = ch.toString('latin1', 0, 4), len = aiff ? ch.readUInt32BE(4) : ch.readUInt32LE(4)
      if (id === 'fmt ') { const b = Buffer.alloc(26); readSync(fd, b, 0, 26, at + 8); f = { tag: b.readUInt16LE(0), chans: b.readUInt16LE(2), rate: b.readUInt32LE(4), bits: b.readUInt16LE(14), le: true }; if (f.tag === 0xFFFE) f.tag = b.readUInt16LE(24) }
      if (id === 'COMM') {
        const b = Buffer.alloc(22); readSync(fd, b, 0, 22, at + 8); const comp = len >= 22 ? b.toString('latin1', 18, 22) : 'NONE'
        if (!/^(NONE|sowt|fl32|FL32)$/.test(comp)) return null
        const e = b.readUInt16BE(8) & 0x7fff, m = b.readUInt32BE(10) * 2 ** 32 + b.readUInt32BE(14)
        f = { tag: /fl32/i.test(comp) ? 3 : 1, chans: b.readUInt16BE(0), rate: Math.round(m * 2 ** (e - 16383 - 63)), bits: b.readUInt16BE(6), le: comp === 'sowt' }
      }
      if (id === 'data') data = { at: at + 8, len: Math.min(len, size - at - 8) }
      if (id === 'SSND') { const b = Buffer.alloc(4); readSync(fd, b, 0, 4, at + 8); const off = b.readUInt32BE(0); data = { at: at + 16 + off, len: Math.min(len - 8 - off, size - at - 16 - off) } }
      at += 8 + len + (len & 1)
    }
    if (!f || !data || !f.rate || !f.chans) return null
    const bps = f.bits >> 3, frame = bps * f.chans, frames = Math.floor(data.len / frame), TH = .001
    const val = f.tag === 3 ? (b, o) => f.le ? b.readFloatLE(o) : b.readFloatBE(o)
      : bps === 2 ? (b, o) => (f.le ? b.readInt16LE(o) : b.readInt16BE(o)) / 32768
      : bps === 3 ? (b, o) => ((f.le ? (b[o] | b[o + 1] << 8 | b[o + 2] << 16) : (b[o] << 16 | b[o + 1] << 8 | b[o + 2])) << 8 >> 8) / 8388608
      : bps === 4 ? (b, o) => (f.le ? b.readInt32LE(o) : b.readInt32BE(o)) / 2147483648
      : bps === 1 ? (b, o) => (b[o] - 128) / 128 : null
    if (!val) return null
    const CH = frame * 32768, buf = Buffer.alloc(CH)
    const scan = back => {
      for (let k = 0; k * 32768 < frames; k++) {
        const n = Math.min(32768, frames - k * 32768), from = back ? frames - k * 32768 - n : k * 32768
        readSync(fd, buf, 0, n * frame, data.at + from * frame)
        for (let j = 0; j < n; j++) { const i = back ? n - 1 - j : j; for (let c = 0; c < f.chans; c++) if (Math.abs(val(buf, i * frame + c * bps)) > TH) return from + i }
      }
      return -1
    }
    const first = scan(false), last = first < 0 ? -1 : scan(true)
    return { rate: f.rate, secs: +(frames / f.rate).toFixed(2), first: first < 0 ? -1 : +(first / f.rate).toFixed(2), last: last < 0 ? -1 : +(last / f.rate).toFixed(2) }
  } catch { return null } finally { if (fd !== undefined) try { closeSync(fd) } catch {} }
}

/* the tracks hear-mix is given: what the project uses (MetaData's AudioFiles), one copy a name (at the project's rate),
   and of those only what lines up with the mix — a file that starts in silence (an export from the song's start) or
   runs the whole song. One that sounds at once and stops short may be a region cut where it plays: left for ProjectData */
function pickSet (pool, mix, rate, used, prev) {
  const cache = new Map((prev && prev.set ? [...prev.set.tracks, ...prev.set.left] : []).filter(x => x.key && x.heard).map(x => [x.file + '|' + x.key, x.heard]))
  const groups = new Map(); let unused = 0, copies = 0
  for (const p of pool) {
    const name = nfc(basename(p)); if (used.size && !used.has(name)) { unused++; continue }
    const s = statSync(p), key = `${s.size}@${s.mtimeMs}`, file = nfc(p), heard = cache.get(file + '|' + key) || sounding(p)
    if (!groups.has(name)) groups.set(name, [])
    groups.get(name).push({ name, file, raw: p, key, heard })
  }
  const tracks = [], left = []
  for (const g of groups.values()) {
    const t = g.find(x => x.heard && x.heard.rate === rate) || g.find(x => x.heard) || g[0]; copies += g.length - 1
    const h = t.heard, why = !h ? 'not a wav or aiff that can be read'
      : h.first < 0 ? 'silent'
      : h.secs < 10 ? 'a slice under 10 s'
      : mix && mix.secs && h.secs > mix.secs * 1.15 ? 'longer than the mix: a take, not an export'
      : h.first >= 1 || (mix && mix.secs && h.secs >= mix.secs * .85) ? null
      : 'sounds at once and stops short: may be a region cut where it plays'
    ;(why ? left : tracks).push(why ? { ...t, why } : t)
  }
  const strip = x => ({ name: x.name, file: x.file, key: x.key, heard: x.heard, ...(x.why ? { why: x.why } : {}) })
  return { set: { tracks: tracks.map(strip), left: left.map(strip), unused, copies }, raw: tracks.map(x => [x.name, x.raw]) }
}

/* his folder's name as the score board names a song, "artist, title": "2605 ARTIST [TITLE] MIX", "250305 ARTIST -
   TITLE_MIX", "[ARTIST] TITLE LIVE MIX", "ARTIST LIVE [TITLE] ARR:MIX". A live version or a remix is a
   song of its own, so what is said outside the brackets stays (LIVE, (Remix 3)); a song in an EP takes the EP's artist */
const TAGS = /(^|\s)(ARR:MIX|ARR|MIX(\s*\d+)?|MAST(ER)?|STEMS?)(?=\s|$)/gi
const tidyName = x => x.replace(/\[\d+\]/g, ' ').replace(TAGS, ' ').replace(/\s+/g, ' ').trim()
function nameParts (raw, inEP) {
  let s = raw.replace(/^\d{4,6}\s+/, '').replace(/^\d{2}[A-Z]{3}\d{1,2}\s+/i, '').replace(/^\d+\.\s*/, '').trim(), artist = '', title = s, rest = '', live = false, m
  if ((m = /^\[([^\]]+)\]\s*(.+)$/.exec(s))) { artist = m[1]; title = m[2]; if (/\s+LIVE\b/i.test(tidyName(title))) { live = true; title = title.replace(/\s+LIVE\b/i, '') } }
  else if ((m = /^(.*?)\[([^\]]+)\](.*)$/.exec(s)) && tidyName(m[2])) { artist = m[1]; title = m[2]; rest = m[3] }
  else if (!inEP && ((m = /^(.+?)\s+-\s+(.+)$/.exec(s)) || (m = /^([^,]+),\s*(.+)$/.exec(s.replace(/\s*\[[^\]]*\]\s*$/, ''))))) { artist = m[1]; title = m[2] }      // (in an EP, "intro - title" is one title)
  title = title.replace(/[_\s]+(arr|mix|mast(er)?)\b.*$/i, '')
  if (/\bLIVE\b/i.test(artist)) { live = true; artist = artist.replace(/\bLIVE\b/i, ' ') }
  if (/\bLIVE\b/i.test(rest)) { live = true; rest = rest.replace(/\bLIVE\b/i, ' ') }
  return { artist: tidyName(artist.replace(/\bEP\b.*$/i, '')), title: tidyName(title), rest: tidyName(rest), live }
}
function songName (folder, top) {
  const a = nameParts(folder, !!top), t = top ? nameParts(top) : null
  const artist = a.artist || (t && t.artist) || '', live = a.live || (t && t.live)
  const title = a.title + (a.rest ? ' ' + a.rest : '') + (live && !/\blive\b/i.test(a.title + a.rest) ? ' (LIVE)' : '')
  return (artist ? `${artist}, ${title}` : title).replace(/[/:]/g, '-')
}

function plist (file) { try { return JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })) } catch { return null } }
const when = t => new Date(t).toISOString()

/* a folder holding a .logicx of its own */
const hasProject = d => ls(d).some(x => x.endsWith('.logicx'))
/* which .logicx made the mix, when a folder holds several (the mix and its teaser, a live edit, a second version): not
   one named for another use, and of the rest the one saved nearest the bounce (its own save or a backup of it) */
const NOTMIX = /teaser|stem|intro|length|선공개|practice|추가|guide|vox dry/i
function savesOf (b) {
  return ls(join(b, 'Alternatives')).filter(a => existsSync(join(b, 'Alternatives', a, 'ProjectData'))).flatMap(a => {
    const alt = join(b, 'Alternatives', a), cur = join(alt, 'ProjectData')
    return [{ a, file: cur, t: statSync(cur).mtimeMs, current: true }, ...ls(join(alt, 'Project File Backups')).map(n => join(alt, 'Project File Backups', n, 'ProjectData')).filter(existsSync).map(f => ({ a, file: f, t: statSync(f).mtimeMs }))]
  })
}

function index (dir, top) {
  const name = nfc(basename(dir)), inside = ls(dir), notes = [], topName = top && top !== dir ? nfc(basename(top)) : null
  const bundle = inside.filter(x => x.endsWith('.logicx')).map(x => join(dir, x))
  if (!bundle.length) notes.push('no .logicx in the folder')

  /* the mix, and every bounce beside it in the order made */
  const bdir = inside.find(x => /^bounces?$/i.test(x)), cand = (bdir ? ls(join(dir, bdir)).map(x => join(dir, bdir, x)) : []).filter(p => SOUND.test(p) && !isDir(p))
  if (!bdir) notes.push('no Bounces folder')
  const all = cand.map(p => ({ p, name: nfc(basename(p)), t: statSync(p).mtimeMs, ...bounceOf(nfc(basename(p))) }))
  const chosen = all.length ? pickMix(all, titleOf(songOf(dir, top))) : null
  const mixes = all.sort((x, y) => x.t - y.t).map(x => ({ file: nfc(x.p), made: when(x.t), ...hear(x.p), mon: x.mon, stars: x.stars, ...(x.mast ? { mast: true } : {}), ...(x.other ? { other: true } : {}), ...(x === chosen ? { pick: true } : {}) }))
  let mix = null
  if (chosen) { mix = { file: nfc(chosen.p), made: when(chosen.t), ...hear(chosen.p) } }
  else if (bdir) notes.push('Bounces is empty')
  if (all.length > 1) notes.push(`${all.length} files in Bounces: ${chosen.name} taken (his last monitor of the mix)`)
  if (chosen && chosen.mast && all.length > 1) notes.push('the mix taken is a master: no monitor of the mix before mastering is kept')
  const later = chosen && all.filter(x => x.mast && x.t > chosen.t)
  if (later && later.length) notes.push(`a master after it: ${later[later.length - 1].name}`)

  /* the project: the .logicx that made the mix, its ProjectData, and the save nearest each side of the bounce */
  let logic = null, meta = {}
  const mt = mix && Date.parse(mix.made)
  const bundles = bundle.map(b => ({ b, saves: savesOf(b) })).filter(x => x.saves.length)
  const fit = bundles.filter(x => !NOTMIX.test(basename(x.b))), pool0 = fit.length ? fit : bundles
  const gap = x => mt ? Math.min(...x.saves.map(s => Math.abs(s.t - mt))) : -Math.max(...x.saves.map(s => s.t))
  const pickB = pool0.sort((x, y) => gap(x) - gap(y))[0]
  if (pickB) {
    const near = mt ? pickB.saves.slice().sort((x, y) => Math.abs(x.t - mt) - Math.abs(y.t - mt))[0] : pickB.saves.find(s => s.current)
    const altName = near.a, alt = join(pickB.b, 'Alternatives', altName), cur = pickB.saves.find(s => s.a === altName && s.current)
    meta = plist(join(alt, 'MetaData.plist')) || {}; const info = plist(join(pickB.b, 'Resources', 'ProjectInformation.plist')) || {}
    const saves = pickB.saves.filter(s => s.a === altName).sort((a, b) => a.t - b.t)
    const before = mt ? saves.filter(s => s.t <= mt).pop() : null, after = mt ? saves.find(s => s.t > mt) : null
    logic = {
      project: nfc(pickB.b), alternative: (info.VariantNames || {})[String(+altName)] || altName, alternatives: new Set(pickB.saves.map(s => s.a)).size,
      data: nfc(cur.file), saved: when(cur.t), from: info.LastSavedFrom || null,
      rate: meta.SampleRate || null, bpm: meta.BeatsPerMinute || null, key: meta.SongKey ? `${meta.SongKey} ${meta.SongGenderKey || ''}`.trim() : null,
      signature: meta.SongSignatureNumerator ? `${meta.SongSignatureNumerator}/${meta.SongSignatureDenominator}` : null, tracks: meta.NumberOfTracks ?? null,
      uses: (meta.AudioFiles || []).length, unused: (meta.UnusedAudioFiles || []).length,
      beforeBounce: before ? { data: nfc(before.file), saved: when(before.t) } : null, afterBounce: after ? { data: nfc(after.file), saved: when(after.t) } : null
    }
    if (bundles.length > 1) notes.push(`${bundles.length} .logicx in the folder: ${basename(pickB.b)} taken (${fit.length < bundles.length ? 'not a teaser, stem or intro; ' : ''}saved nearest the bounce)`)
    if (logic.alternatives > 1) notes.push(`${logic.alternatives} alternatives: ${logic.alternative} taken (saved nearest the bounce)`)
    if (mt && cur.t > mt + 3600e3) notes.push(`project saved ${((cur.t - mt) / 864e5).toFixed(1)} days after the bounce: settings may have moved since; ` + (before ? 'the save just before the bounce is beforeBounce' : 'no save from before the bounce is kept (Logic keeps ten); afterBounce is the nearest'))
    if (mix && logic.rate && mix.rate && mix.rate !== logic.rate) notes.push(`mix at ${mix.rate / 1000}k, project at ${logic.rate / 1000}k`)
  } else if (bundle.length) notes.push('no ProjectData in the bundle')

  /* the tracks: Audio Files beside the project or inside it, and any folder of stems (not another song's folder) */
  const secs = mix && mix.secs
  const audioDirs = [join(dir, 'Audio Files'), ...bundle.map(b => join(b, 'Media', 'Audio Files'))].filter(p => isDir(p) && ls(p).length)
  const audio = audioDirs.map(d => sounds(d, secs))
  const songDir = d => { if (hasProject(d)) return true; return ls(d).some(x => isDir(join(d, x)) && !x.endsWith('.logicx') && hasProject(join(d, x))) }
  const stems = inside.filter(x => !x.endsWith('.logicx') && !/^(bounces?|audio files)$/i.test(x) && isDir(join(dir, x)) && !songDir(join(dir, x))).map(x => sounds(join(dir, x), secs)).filter(s => s.files)
  const wholeAll = [...audio, ...stems].reduce((n, s) => n + s.whole, 0)
  if (mix && !wholeAll) notes.push('no track runs the whole song: hear-mix needs the regions placed as ProjectData has them')
  const trackRates = new Set([...audio, ...stems].flatMap(s => Object.keys(s.rates).map(Number)))
  if (mix && mix.rate && trackRates.size && !trackRates.has(mix.rate)) notes.push(`tracks at ${[...trackRates].map(r => r / 1000 + 'k').join(', ')}, mix at ${mix.rate / 1000}k`)

  /* what hear-mix is given */
  const pool = []
  const walk = (d, depth) => { for (const x of ls(d)) { const p = join(d, x); if (isDir(p)) { if (depth < 2) walk(p, depth + 1) } else if (SOUND.test(x)) pool.push(p) } }
  for (const d of [...audioDirs, ...stems.map(s => join(dir, basename(s.dir)))]) walk(d, 0)
  const used = new Set((meta.AudioFiles || []).map(f => nfc(basename(f))))
  const { set, raw } = pickSet(pool, mix, logic && logic.rate, used, known.get(nfc(dir)))
  const song = songOf(dir, top)
  if (mix && set.tracks.length) {
    const at = join(SONGS, song); rmSync(at, { recursive: true, force: true }); mkdirSync(join(at, 'tracks'), { recursive: true })      // (links only: their sounds stay where they are)
    symlinkSync(chosen.p, join(at, 'mix' + extname(chosen.p).toLowerCase()))      // (hear-mix takes a name with "mix" in it for the mix; his own name is in projects.json)
    for (const [n, p] of raw) symlinkSync(p, join(at, 'tracks', n))
  }
  if (existsSync(join(OUT, song + '.json')) && !(known.get(nfc(dir)) || {}).song) notes.push(`out/${song}.json is already there: a hear-mix run on out/songs/${song} writes over it`)

  return { folder: name, path: nfc(dir), ...(topName ? { in: topName } : {}), song, songDir: mix && set.tracks.length ? nfc(join(SONGS, song)) : null, mix, mixes, logic, audio, stems, set, ...weigh(dir), notes }
}
/* a song's name: its folder's, or in an EP its own folder's (or, a song kept at the EP's top, its .logicx's) with the EP's artist */
function songOf (dir, top) {
  const n = nfc(basename(dir))
  if (!top || top === dir) {
    if (!/\bEP\b/.test(n)) return songName(n)
    const b = ls(dir).find(x => x.endsWith('.logicx')); return songName(b ? nfc(basename(b, '.logicx')) : n, n)
  }
  return songName(n, nfc(basename(top)))
}

/* the project folders of a root: each folder in it; or, with take, in each folder it picks, the one holding a .logicx, or
   (an EP, or a song kept a level down) those a few levels in — not one inside another project's folder (a part of that song) */
function projectsOf (r) {
  const tops = ls(r.root).map(x => join(r.root, x)).filter(isDir)
  if (!r.take) return tops.map(d => ({ dir: d, top: null }))
  const take = new RegExp(r.take, 'i'), drop = r.drop ? new RegExp(r.drop, 'i') : null, out = []
  for (const t of tops.filter(d => take.test(nfc(basename(d))) && !(drop && drop.test(nfc(basename(d)))))) {
    const ep = /\bEP\b/.test(nfc(basename(t)))
    const walk = (d, depth) => {
      const own = hasProject(d)
      if (own) out.push({ dir: d, top: t })
      if (own && !(depth === 0 && ep)) return
      if (depth < 3) for (const x of ls(d)) { const p = join(d, x); if (isDir(p) && !x.endsWith('.logicx') && !/^(bounces?|audio files|samples)$/i.test(x)) walk(p, depth + 1) }
    }
    walk(t, 0)
  }
  return out
}

const before = existsSync(JSONF) ? JSON.parse(readFileSync(JSONF, 'utf8')) : { projects: [] }
const known = new Map(before.projects.map(p => [p.path, p]))
/* songs read already, by title: what hear-mix has written in out/ (his first folder of songs, and these roots' own) */
const readTitles = new Set(readdirSync(OUT).filter(f => /\.json$/.test(f) && f.includes(', ') && !/\.(logic|test)\.json$/.test(f)).map(f => titleOf(f.replace(/\.json$/, ''))))

/* every root read: a song once (the first root it is found in), what is left out and why */
function gather () {
  const projects = [], skipped = [], names = new Set()
  for (const r of ROOTS) {
    if (!isDir(r.root)) { console.log('not there: ' + r.root); projects.push(...before.projects.filter(p => p.root === nfc(r.root) || (!p.root && p.path.startsWith(nfc(r.root))))); continue }      // (a drive away: what was read of it stays)
    const skip = new Set((r.skip || []).map(norm))
    for (const { dir, top } of projectsOf(r)) {
      const song = songOf(dir, top)
      const why = r.take && top !== dir && /\bstems?\b|vox dry|추가/i.test(nfc(basename(dir))) ? 'a project for stems or one part, not the mix' : names.has(song) ? 'the same song in another folder' : skip.has(norm(song)) ? 'on the skip list' : r.skipRead && readTitles.has(titleOf(song)) ? 'read already (out/ has a song of this title)' : null
      if (why) { skipped.push({ folder: nfc(dir), song, why }); continue }
      const p = index(dir, top)
      if (!p.mix && r.take) { skipped.push({ folder: p.path, song, why: 'nothing bounced in its Bounces' }); continue }
      names.add(song); projects.push({ ...p, root: nfc(r.root) })
      if (r.take) console.log(`  ${song}: ${p.set.tracks.length} tracks, ${p.mixes.length} bounces`)
    }
  }
  return { projects, skipped }
}
function write (projects, skipped) {
  writeFileSync(JSONF, JSON.stringify({ made: new Date().toISOString(), roots: ROOTS.map(r => nfc(r.root)), projects, skipped }, null, 1))
  writeFileSync(join(OUT, 'projects.list'), projects.filter(p => p.logic).map(p => p.logic.project).join('\n') + '\n')
}
function report (projects, changed) {
  for (const p of projects) {
    const mark = changed.has(p.path) ? (known.has(p.path) ? 'changed' : 'new') : ''
    const m = p.mix ? `${basename(p.mix.file)} (${p.mix.rate / 1000}k, ${p.mix.secs}s)` : '(no mix)'
    const tr = [...p.audio, ...p.stems].map(s => `${basename(s.dir)} ${s.whole}/${s.files} whole`).join('; ')
    console.log(`${mark.padEnd(8)}${p.in ? p.in + ' / ' : ''}${p.folder}\n        mix ${m}\n        ${p.logic ? `${basename(p.logic.project)}: ${p.logic.rate / 1000}k, ${p.logic.bpm} bpm, ${p.logic.tracks} tracks, saved ${p.logic.saved.slice(0, 10)}` : '(no project)'}\n        ${tr || '(no tracks)'}`)
    if (p.set) console.log(`        → out/songs/${p.song}: ${p.set.tracks.length} tracks; left out ${p.set.left.length} (${[...new Set(p.set.left.map(x => x.why))].join('; ') || '—'}), ${p.set.unused} unused, ${p.set.copies} copies`)
    for (const n of p.notes) console.log('        · ' + n)
  }
}

if (!process.argv.includes('--wait')) {
  const { projects, skipped } = gather()
  const changed = new Set(projects.filter(p => { const k = known.get(p.path); return !k || k.bytes !== p.bytes || k.files !== p.files }).map(p => p.path))
  write(projects, skipped); report(projects, changed)
  for (const x of skipped) console.log(`skipped ${x.song}: ${x.why}`)
  const songs = new Set(projects.map(p => p.songDir && p.song).filter(Boolean))
  for (const d of ls(SONGS)) if (!songs.has(nfc(d))) { rmSync(join(SONGS, d), { recursive: true, force: true }); console.log('unlinked out/songs/' + d) }      // (a song no longer taken: its links go)
  const gone = [...known.keys()].filter(k => !projects.some(p => p.path === k))
  for (const g of gone) console.log('gone    ' + basename(g))
  console.log(`\n${projects.length} projects, ${changed.size} new or changed, ${skipped.length} skipped, ${gone.length} gone → ${JSONF}`)
} else {
  /* the watch, over the roots he adds to (each folder in them a song): a folder counts once two looks in a row find it the
     same; it ends when something settled differs from the index and nothing is moving; the rest is kept as read */
  const EVERY = +(process.env.MIXLAB_EVERY || 180) * 1000, sleep = ms => new Promise(r => setTimeout(r, ms))
  const watched = ROOTS.filter(r => !r.take && r.watch !== false)
  let last = new Map()
  for (;;) {
    const away = watched.find(r => !isDir(r.root)); if (away) { console.log('drive gone: ' + away.root); process.exit(2) }
    const raw = new Map(watched.flatMap(r => ls(r.root).map(x => join(r.root, x)).filter(isDir).map(d => [nfc(d), { d, r }])))
    const now = new Map([...raw].map(([k, v]) => [k, weigh(v.d)]))
    const moving = [...now].filter(([k, w]) => { const l = last.get(k); return !l || l.bytes !== w.bytes || l.files !== w.files }).map(([k]) => k)
    const differs = [...now].filter(([k, w]) => { const i = known.get(k); return !i || i.bytes !== w.bytes || i.files !== w.files }).map(([k]) => k)
    const mine = p => watched.some(r => p.root ? p.root === nfc(r.root) : p.path.startsWith(nfc(r.root)))
    const gone = before.projects.filter(p => mine(p) && !now.has(p.path))
    if (last.size && !moving.length && (differs.length || gone.length)) {
      const fresh = differs.map(k => ({ ...index(raw.get(k).d, null), root: nfc(raw.get(k).r.root) }))
      const projects = before.projects.filter(p => !gone.includes(p) && !differs.includes(p.path)).concat(fresh)
      for (const g of gone) if (g.song) rmSync(join(SONGS, g.song), { recursive: true, force: true })
      write(projects, before.skipped || []); report(fresh, new Set(differs))
      for (const g of gone) console.log('gone    ' + g.folder)
      console.log(`\n${projects.length} projects, ${differs.length} new or changed, ${gone.length} gone → ${JSONF}`)
      process.exit(0)
    }
    last = now; await sleep(EVERY)
  }
}
