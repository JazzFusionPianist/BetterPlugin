'use client'

import { useEffect, useState } from 'react'
import SlurMark from './SlurMark'
import { C, FAMILIES, hz, play } from './marks'
import RoomPicture from './RoomPicture'
import PictoNav from './PictoNav'
import WallPicture from './WallPicture'
import '@/app/slur.css'

/* The catalogue. A new program is one more entry: its name, its poster,
   its pitch, what it runs as, and where its installers are published
   (GitHub release tags beginning with `tag`). */
interface Plugin {
  name: string
  poster: 'slur' | 'patch' | 'studio'
  ink: string
  arm: string
  step: number
  formats: string
  tag?: string            // release tag prefix on GitHub
  fallback?: { url: string; version: string }   // the last known installer, used until the API answers
  web?: boolean           // also runs in the browser
  lettered?: boolean      // the whole name is in the hand (slur studio), not "slur" beside set words
}
const PAPER = '#F1ECDF', INK = '#151412', RED = '#D52B1E', BLUE = '#1D4E9E', YELLOW = '#F2C230'
const PLUGINS: Plugin[] = [
  { name: 'slur', poster: 'slur', ink: INK, arm: C.blue, step: 3, formats: 'au vst3 aax', web: true },
  {
    name: 'patch on slur', poster: 'patch', ink: PAPER, arm: RED, step: 5, formats: 'au vst3',
    tag: 'patch-on-slur-',
    fallback: { url: 'https://github.com/JazzFusionPianist/BetterPlugin/releases/download/patch-on-slur-1.0.9/Patch-on-Slur-1.0.9.pkg', version: '1.0.9' },
  },
  { name: 'slur studio', poster: 'studio', ink: PAPER, arm: YELLOW, step: 1, formats: 'mac app', lettered: true },
]
const REPO = 'JazzFusionPianist/BetterPlugin'

interface Release { tag_name: string; draft: boolean; prerelease: boolean; assets: { name: string; browser_download_url: string }[] }

/** The newest published .pkg for each tag prefix. */
function useInstallers () {
  const [found, setFound] = useState<Record<string, { url: string; version: string }>>({})
  useEffect(() => {
    let alive = true
    fetch(`https://api.github.com/repos/${REPO}/releases?per_page=30`)
      .then(r => (r.ok ? r.json() : []))
      .then((rels: Release[]) => {
        if (!alive || !Array.isArray(rels)) return
        const out: Record<string, { url: string; version: string }> = {}
        for (const p of PLUGINS) {
          if (!p.tag) continue
          const rel = rels.find(r => !r.draft && !r.prerelease && r.tag_name.startsWith(p.tag!) && r.assets.some(a => a.name.endsWith('.pkg')))
          const pkg = rel?.assets.find(a => a.name.endsWith('.pkg'))
          if (rel && pkg) out[p.name] = { url: pkg.browser_download_url, version: rel.tag_name.slice(p.tag!.length) }
        }
        setFound(out)
      })
      .catch(() => { /* keep the fallbacks */ })
    return () => { alive = false }
  }, [])
  return found
}

const slug = (name: string) => name.replace(/ /g, '-')

/* a program's poster: a composition of the wall's shapes, the name in the hand at its foot */
function PosterArt ({ kind }: { kind: Plugin['poster'] | 'soon' }) {
  return (
    <svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {kind === 'slur' && <>
        <rect width={300} height={400} fill="#E8E1D0" />
        {[0, 1, 2, 3, 4].map(i => <rect key={i} x={0} y={118 + i * 18} width={300} height={1.5} fill={INK} opacity={.5} />)}
        <path className="mv a" d="M 0 400 L 300 400 L 52 168 Z" fill={YELLOW} />
        <circle className="mv b" cx={214} cy={145} r={19} fill={INK} />
      </>}
      {kind === 'patch' && <>
        <rect width={300} height={400} fill={INK} />
        <rect className="mv c" x={36} y={56} width={172} height={172} fill={RED} />
        {[30, 56, 82].map(r => <circle key={r} cx={208} cy={142} r={r} fill="none" stroke={PAPER} strokeWidth={2.4} />)}
        <rect x={0} y={290} width={300} height={2.4} fill={PAPER} />
        {[30, 270].map(x => <circle key={x} cx={x} cy={291} r={6} fill={INK} stroke={PAPER} strokeWidth={2.4} />)}
      </>}
      {kind === 'studio' && <>
        <rect width={300} height={400} fill={BLUE} />
        <circle className="mv c" cx={150} cy={150} r={104} fill={PAPER} />
        <rect x={0} y={292} width={300} height={14} fill={INK} />
        <circle className="mv b" cx={96} cy={299} r={15} fill={RED} />
        <path d="M 232 240 L 262 292 L 202 292 Z" fill={YELLOW} />
      </>}
      {kind === 'soon' && <>
        <rect x={1} y={1} width={298} height={398} fill="none" stroke={INK} strokeWidth={2} strokeDasharray="6 6" />
        <circle cx={150} cy={180} r={70} fill="none" stroke={INK} strokeWidth={2} strokeDasharray="6 6" />
      </>}
    </svg>
  )
}

function Poster ({ p }: { p: Plugin }) {
  const [pre] = p.name.split('slur').map(x => x.trim())
  return (
    <div className="sl-poster" onClick={() => { play(hz(p.step), 0, 1.8); document.getElementById(slug(p.name))?.scrollIntoView({ behavior: 'smooth' }) }}>
      <PosterArt kind={p.poster} />
      <div className="nm" style={{ color: p.ink }}>
        {pre && !p.lettered && <span>{pre}</span>}
        <SlurMark height={p.lettered ? 52 : 64} ink={p.ink} arm={p.arm} title={p.name} studio={p.lettered} />
      </div>
    </div>
  )
}

export default function Downloads () {
  const found = useInstallers()
  const patch = found['patch on slur'] ?? PLUGINS[1].fallback!
  return (
    <div className="sl">
      <div className="sl-grain" />
      <header className="sl-top static">
        <a className="sl-logo" href="/" aria-label="slur studio"><SlurMark height={40} /><span>studio</span></a>
        <PictoNav here="downloads" />
      </header>

      <main className="sl-page">
        <h1>downloads</h1>
        <div className="sl-shelf">
          {PLUGINS.map(p => {
            const url = (found[p.name] ?? p.fallback)?.url
            return (
              <div className="sl-item" key={p.name}>
                <Poster p={p} />
                <div className="sl-meta">
                  <span className="f">{p.formats}</span>
                  {p.web && <a className="sl-pill line" href="/?door=signin">web</a>}
                  {url ? <a className="sl-pill ink" href={url}>mac</a> : <span className="soon">mac soon</span>}
                </div>
              </div>
            )
          })}
          <div className="sl-item">
            <div className="sl-poster" style={{ cursor: 'default' }}><PosterArt kind="soon" /></div>
            <div className="sl-meta"><span className="soon" style={{ marginLeft: 'auto' }}>soon</span></div>
          </div>
        </div>
      </main>

      <Room id="slur" n={1} shape="tri" name={<SlurMark height={120} arm={YELLOW} />}
        acts={<><a className="sl-pill ink" href="/?door=signin">open in the browser</a><span className="soon">mac soon</span></>}
        rows={SLUR_ROWS} work={<div className="sl-work room"><RoomPicture /></div>} />

      <Room id="patch-on-slur" n={2} shape="sq" dark name={<div className="sl-lede-row"><span>patch on</span><SlurMark height={120} ink={PAPER} arm={RED} /></div>}
        acts={<><a className="sl-pill paper" href={patch.url}>mac</a><span className="soon">{patch.version} au vst3</span></>}
        rows={PATCH_ROWS} work={<div className="sl-work wall"><WallPicture className="sl-wall" /></div>} extra={<Families />} />

      <Room id="slur-studio" n={3} shape="ci" two name={<SlurMark height={104} arm={BLUE} studio />}
        acts={<><a className="sl-pill ink" href="/studio">the whole room</a><span className="soon">mac soon</span></>}
        rows={STUDIO_ROWS} work={<div className="sl-work shot"><img src="/slur/studio/room-bauhaus.jpg" alt="Slur Studio with a song open" /></div>} />

      <div className="sl-foot-row plain">
        <a href="/terms">terms</a><a href="/privacy">privacy</a>
        <a href="mailto:wtsteven123@gmail.com?subject=copyright%20report">copyright</a>
        <span className="r">&copy; 2026 slur studio</span>
      </div>
    </div>
  )
}

/* ── the rooms ──
   One per program: its number painted large, its name in the hand, the work
   hung, and an index of plain facts (a word, then what it is) as its label. */

const SLUR_ROWS: [string, string][] = [
  ['room', 'one per band or per record. chat, stems, calendar and notes in it'],
  ['takes', 'drag a region out of the daw and it lands on its bar. drag it back in, same bar'],
  ['in the studio', 'who has the session open right now, and for how long'],
  ['dates', 'type rehearsal fri 7pm and the whole band has it'],
  ['live', 'go on air from the room. friends watch and talk while you play'],
  ['games', 'chess, sudoku, gomoku and more, for the wait between takes'],
  ['runs in', 'your daw as au, vst3 or aax, and the browser'],
]
const PATCH_ROWS: [string, string][] = [
  ['prints', 'every effect is a print you hang on the wall. its shape tells you its family'],
  ['wires', 'draw a wire to chain prints, split l/r, m/s or into bands, sum them back'],
  ['hands', 'turn a print by hand, or give it to an lfo, a macro or a follower'],
  ['no account', 'open it and play'],
]
const STUDIO_ROWS: [string, string][] = [
  ['tidy', 'every track heard for what it is, named and put in order'],
  ['rubato', 'pins on the sound, pulled along the time'],
  ['doctor', 'the whole song heard at once. what crowds and what pokes out, by its bars'],
  ['rough mix', 'one hearing, three mixes to start from'],
  ['patch', 'patch on slur sits on every track. au and vst3 plug-ins go in the same patch'],
  ['your keys', 'the keys of logic pro, ableton live, cubase or pro tools'],
  ['runs on', 'mac'],
]

function Room ({ id, n, shape, dark, two, name, acts, rows, work, extra }: {
  id: string; n: number; shape: 'tri' | 'sq' | 'ci'; dark?: boolean; two?: boolean
  name: React.ReactNode; acts: React.ReactNode; rows: [string, string][]; work: React.ReactNode; extra?: React.ReactNode
}) {
  return (
    <section id={id} className={`sl-room${dark ? ' dark' : ''}`}>
      {shape === 'tri'
        ? <svg className="sl-room-shape tri" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M 100 0 L 100 100 L 0 100 Z" fill={YELLOW} /></svg>
        : <div className={`sl-room-shape ${shape}`} aria-hidden="true" />}
      <div className="sl-room-head">
        <div className="sl-num" aria-hidden="true">{n}</div>
        <div className="sl-room-name">
          <div className={two ? 'two' : undefined}>{name}</div>
          <div className="sl-room-acts">{acts}</div>
        </div>
      </div>
      <div className="sl-room-body">
        <ol className="sl-index">
          {rows.map(([k, v]) => <li key={k}><b>{k}</b><span>{v}</span></li>)}
        </ol>
        {work}
      </div>
      {extra}
    </section>
  )
}

function Families () {
  return (
    <div className="sl-families">
      {FAMILIES.map(f => (
        <div key={f.name}>
          <svg viewBox="-24 -24 48 48" width="48" height="48" aria-hidden="true"><path d={f.shape} fill={f.c} fillRule="evenodd" /></svg>
          <b>{f.name}</b>
          <span>{f.members}</span>
        </div>
      ))}
    </div>
  )
}
