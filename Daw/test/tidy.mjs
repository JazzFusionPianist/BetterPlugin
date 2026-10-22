// node test/tidy.mjs — the session tidied (tidy.js): tracks called audio 1 to audio 8 are heard (yamnet.js, in a worker, the
// model ./yamnet.sh makes in ui/yamnet) and named for what they are; a name of one's own is kept and what it is only
// remembered; the tracks stand drums, bass, guitars, keys, voices; all of it is one step back; the command line finds a
// track by what it was heard to be. The page is served over http here (a worker, and fetch, want it).
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { open, PAGE } from './cdp.mjs'
const UI = join(dirname(fileURLToPath(import.meta.url)), '..', 'ui')
if (!existsSync(join(UI, 'yamnet', 'model.bin'))) { console.log('no ui/yamnet: ./yamnet.sh makes it'); process.exit(0) }
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' }
const server = createServer(async (req, res) => { if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return } const p = join(UI, decodeURIComponent(req.url.split('?')[0])); try { if (!p.startsWith(UI) || !(await stat(p)).isFile()) throw 0; res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); res.end(await readFile(p)) } catch (e) { res.writeHead(404); res.end() } })
await new Promise(r => server.listen(0, '127.0.0.1', r))
const b = await open(PAGE, { width: 1440, height: 900, dsf: 1 })
await b.send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/index.html` }); await b.sleep(1500)
const out = [], bad = []
const ok = (name, cond, extra) => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`); if (!cond) bad.push(name) }
const ev = b.ev
await ev(`if (typeof START !== 'undefined') START.on = false; flush(); return 1`)
const names0 = await ev(`return S.tracks.map(t => t.name)`)
/* words first: the demo's own names say what each is */
ok('by words: a name, a file\'s name', await ev(`return tidyByWords('Kick In') === 'kick' && tidyByWords('BASS_DI_01.wav') === 'bass' && tidyByWords('Lead Vox comp') === 'vox' && tidyByWords('보컬 더블') === 'vox' && tidyByWords('Gtr L') === 'gtr' && tidyByWords('Audio 19') === null`))
ok('a name that says nothing, and one that does', await ev(`return tidyBare('Audio 19') && tidyBare('inst 3') && tidyBare('오디오 2') && tidyBare('Track 12.1') && !tidyBare('jay') && !tidyBare('bass')`))
/* the demo's tracks called audio 1 to 8, the sixth called by a name of its own, then tidied */
await ev(`S.tracks.filter(t => t.kind === 'audio').forEach((t, i) => { t.name = i === 5 ? 'jay' : 'Audio ' + (i + 1) }); repaint(); flush(); return 1`)
const order0 = await ev(`return S.tracks.map(t => t.id)`)
const r = await ev(`return await tidyTracks()`)
console.log('found:', JSON.stringify(r && r.found.map(f => `${f.name} = ${f.what} by ${f.by}${f.heard ? ' (' + f.heard.map(h => h[0] + ' ' + h[1].toFixed(2)).join(', ') + ') low ' + (f.low || 0).toFixed(2) + ' high ' + (f.high || 0).toFixed(2) : ''}`)))
ok('heard: most of the eight known by their sound', r && r.known >= 5, r && [r.known, r.left])
ok('…named for it, where the name said nothing; a name of one\'s own kept', await ev(`return S.tracks.some(t => t.name === 'jay') && S.tracks.filter(t => /^audio \\d/i.test(t.name)).length <= ${8 - 5}`), await ev(`return S.tracks.map(t => t.name)`))
ok('…what each is remembered, and its family', await ev(`return S.tracks.filter(t => t.what).every(t => t.tone === TIDY_FAM(t.what))`))
ok('…in the order a session is read in', await ev(`const rk = t => { const i = TIDY_ORDER.indexOf(t.what); return i < 0 ? 999 : i }, ts = S.tracks.filter(t => t.kind === 'audio'); return ts.every((t, i) => !i || rk(ts[i - 1]) <= rk(t))`), await ev(`return S.tracks.map(t => t.name + ':' + (t.what || '-'))`))
{ const jay = await ev(`const t = S.tracks.find(x => x.name === 'jay'); return t ? t.what : null`)
  if (jay) ok(`the command line finds jay by what it is (${jay})`, await ev(`return sayTracks([${JSON.stringify(jay)}]).some(t => t.name === 'jay')`)) }
ok('what it is is kept with the song', await ev(`return KEEP_T.includes('what')`))
await b.shot('tidy.png')
/* one step back */
await ev(`undoEdit(); flush(); return 1`)
ok('one step back: every name and place as it was', JSON.stringify(await ev(`return S.tracks.map(t => t.id)`)) === JSON.stringify(order0) && (await ev(`return S.tracks.filter(t => t.kind === 'audio').map(t => t.name)`)).every(n => /^Audio \d$|^jay$/.test(n)), await ev(`return S.tracks.map(t => t.name)`))
ok('said: tidy the tracks', await ev(`S.tracks.filter(t => t.kind === 'audio').forEach((t, i) => { t.name = 'Audio ' + (i + 1) }); await runCommand('트랙 정리해줘'); return /known/.test(S.last && S.last.say || '')`), await ev(`return S.last`))
ok('no errors on the page', !b.errors.length, b.errors.slice(0, 3))
console.log(out.join('\n'))
console.log(bad.length ? `\n${bad.length} failed` : '\nall passed')
await b.close(); server.close()
process.exit(bad.length ? 1 : 0)
