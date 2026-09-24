'use client'

import { useEffect, useState } from 'react'
import SlurMark from './SlurMark'
import { C, FAMILIES, ellipsePath, hz, play, wholeNotePath } from './marks'
import RoomPicture from './RoomPicture'
import PictoNav from './PictoNav'
import WallPicture from './WallPicture'
import '@/app/slur.css'

/* The catalogue. A new plug-in is one more entry: its name, its ground,
   its note (colour and pitch), what it runs as, and where its installers
   are published (GitHub release tags beginning with `tag`). */
interface Plugin {
  name: string
  ground: string
  note: string
  ink: string
  step: number
  hollow: boolean
  formats: string
  tag?: string            // release tag prefix on GitHub
  fallback?: { url: string; version: string }   // the last known installer, used until the API answers
  web?: boolean           // also runs in the browser
  glow?: boolean
}
const PLUGINS: Plugin[] = [
  { name: 'slur', ground: '#BFE6CB', note: C.green, ink: C.ink, step: 3, hollow: true, formats: 'au vst3 aax', web: true },
  {
    name: 'patch on slur', ground: '#14120F', note: C.orange, ink: C.white, step: 5, hollow: false, formats: 'au vst3', glow: true,
    tag: 'patch-on-slur-',
    fallback: { url: 'https://github.com/JazzFusionPianist/BetterPlugin/releases/download/patch-on-slur-1.0.9/Patch-on-Slur-1.0.9.pkg', version: '1.0.9' },
  },
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

function Tile ({ p }: { p: Plugin }) {
  const y = 130 + 4 * 26 - p.step * 13
  const line = p.ink === C.white ? 'rgba(251,250,247,.16)' : 'rgba(26,25,23,.14)'
  const [pre, post] = p.name.split('slur').map(x => x.trim())
  return (
    <div className="sl-arch-tile" style={{ background: p.ground, cursor: 'pointer' }} onClick={() => { play(hz(p.step), 0, 1.8); document.getElementById(slug(p.name))?.scrollIntoView({ behavior: 'smooth' }) }}>
      <svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        {p.glow && (
          <>
            <defs><radialGradient id={`glow-${p.step}`}><stop offset="0" stopColor={p.note} stopOpacity=".55" /><stop offset="1" stopColor={p.note} stopOpacity="0" /></radialGradient></defs>
            <ellipse cx={150} cy={y} rx={150} ry={170} fill={`url(#glow-${p.step})`} />
          </>
        )}
        {[0, 1, 2, 3, 4].map(k => <line key={k} x1={0} x2={300} y1={130 + k * 26} y2={130 + k * 26} stroke={line} />)}
        <g className="sl-note"><path d={wholeNotePath(150, y, 44, p.hollow)} fill={p.note} fillRule="evenodd" /></g>
      </svg>
      <div className="nm" style={{ color: p.ink }}>
        {pre && <span>{pre}</span>}
        <SlurMark height={52} ink={p.ink} arm={p.note} title={p.name} />
        {post && <span>{post}</span>}
      </div>
    </div>
  )
}

export default function Downloads () {
  const found = useInstallers()
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
                <Tile p={p} />
                <div className="sl-meta">
                  <span className="f">{p.formats}</span>
                  {p.web && <a className="sl-pill line" href="/?door=signin">web</a>}
                  {url ? <a className="sl-pill ink" href={url}>mac</a> : <span className="soon">mac soon</span>}
                </div>
              </div>
            )
          })}
          <div className="sl-item">
            <div className="sl-arch-tile next">
              <svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                {[0, 1, 2, 3, 4].map(k => <line key={k} x1={0} x2={300} y1={130 + k * 26} y2={130 + k * 26} stroke="rgba(26,25,23,.12)" />)}
                <path d={ellipsePath(150, 182, 44, 31, -22)} fill="none" stroke="rgba(26,25,23,.3)" strokeWidth={1.5} strokeDasharray="4 5" />
              </svg>
            </div>
            <div className="sl-meta"><span className="soon">soon</span></div>
          </div>
        </div>
      </main>

      <About id="slur" ground="#BFE6CB" ink={C.ink} picture={<RoomPicture />} lede={<SlurMark height={150} arm={C.green} />}
        rows={SLUR_ROWS} acts={<><a className="sl-pill ink" href="/?door=signin">open in the browser</a><span className="soon">mac soon</span></>} />

      <About id="patch-on-slur" ground="#14120F" ink={C.white} dark picture={<WallPicture className="sl-wall" />}
        lede={<div className="sl-lede-row"><span>patch on</span><SlurMark height={150} ink={C.white} arm={C.orange} /></div>}
        rows={PATCH_ROWS} extra={<Families />}
        acts={(() => { const r = found['patch on slur'] ?? PLUGINS[1].fallback!; return <><a className="sl-pill paper" href={r.url}>mac</a><span className="soon">{r.version} au vst3</span></> })()} />

      <div className="sl-foot-row plain">
        <a href="/terms">terms</a><a href="/privacy">privacy</a>
        <a href="mailto:wtsteven123@gmail.com?subject=copyright%20report">copyright</a>
        <span className="r">&copy; 2026 slur studio</span>
      </div>
    </div>
  )
}

/* ── the introductions ──
   One arch per plug-in: its picture, its name lettered, and an index of
   plain facts (a word, then what it is). No slogans. */

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

function About ({ id, ground, ink, dark, picture, lede, rows, extra, acts }: {
  id: string; ground: string; ink: string; dark?: boolean
  picture: React.ReactNode; lede: React.ReactNode; rows: [string, string][]; extra?: React.ReactNode; acts: React.ReactNode
}) {
  return (
    <section id={id} className={`sl-arch sl-about${dark ? ' dark' : ''}`} style={{ background: ground, color: ink }}>
      <div className="sl-about-pic">{picture}</div>
      <div className="sl-about-body">
        <div className="sl-about-name">
          {lede}
          <div className="sl-about-acts">{acts}</div>
        </div>
        <ol className="sl-index">
          {rows.map(([k, v]) => <li key={k}><b>{k}</b><span>{v}</span></li>)}
        </ol>
      </div>
      {extra}
    </section>
  )
}

/* Patch on Slur's families, each by its plate's silhouette — told apart
   from across the wall, the way the plug-in draws them. */
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
