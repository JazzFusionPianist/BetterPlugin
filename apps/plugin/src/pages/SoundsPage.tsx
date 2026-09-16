import { useEffect, useRef, useState, type CSSProperties } from 'react'
import FxWall, { shelfLayout } from '../components/collab/FxWall'
import ResizeGrip from '../components/collab/ResizeGrip'
import { hasJuceBridge } from '../lib/juceBridge'
import { adoptSharedWindowSize, watchSharedWindowSize } from '../lib/pluginWindow'
import { callJuceNative, hasJuceNativeFunction } from '../lib/juceBridge'
import './collab.css'

/** Orb Sounds — the one-knob fx chain as its own plugin. No account, no
 *  toolbar: the plugin IS the darkened room, booted straight into it.
 *  Loaded with ?surface=sounds by the OrbSounds JUCE target (also a
 *  browser dev override). The shell reuses the `.plugin.fx-open` room
 *  so every print, wall colour and glow lands exactly as it does inside
 *  the full Orb. */
export default function SoundsPage() {
  const screenPreview = new URLSearchParams(window.location.search).get('screen') === 'large'
  const fill = hasJuceBridge || screenPreview
  // Same window as Orb Chat: a fresh instance adopts the shared size the
  // last Orb window was dragged to, and every resize here updates it.
  // The layout follows the live viewport exactly like CollabPage does.
  const [wide, setWide] = useState(screenPreview)
  useEffect(() => {
    void adoptSharedWindowSize()
    const stopWatching = watchSharedWindowSize()
    if (screenPreview) return stopWatching
    const apply = () => setWide(window.innerWidth >= 520)
    apply()
    window.addEventListener('resize', apply)
    return () => { stopWatching(); window.removeEventListener('resize', apply) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // (plain-browser preview keeps its fixed 300×500 frame, as CollabPage does)
  // The wall measures itself so in/out ports sit on its real edges.
  const contentRef = useRef<HTMLDivElement>(null)
  const [wallSize, setWallSize] = useState({ w: 1120, h: 568 })
  useEffect(() => {
    const el = contentRef.current; if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      const w = Math.max(300, Math.round(r.width))
      setWallSize({ w, h: Math.max(200, Math.round(r.height) - shelfLayout().height) })
    }
    measure()
    const ro = new ResizeObserver(measure); ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // layout diagnostics (plugin only, twice after mount): every box that
  // could leave a strip at the foot of the window
  useEffect(() => {
    if (!hasJuceBridge || !hasJuceNativeFunction('orbLog')) return
    const box = (sel: string) => { const r = document.querySelector(sel)?.getBoundingClientRect(); return r ? `${Math.round(r.top)}-${Math.round(r.bottom)}` : '-' }
    const report = (why: string) => {
      const msg = `${why} inner ${window.innerWidth}x${window.innerHeight} html ${document.documentElement.clientHeight}/${document.documentElement.scrollHeight} body ${document.body.clientHeight} root ${box('#root')} plugin ${box('.plugin')} content ${box('.plugin > .content')} view ${box('.fxview')} frame ${box('.sg-frame')} left ${box('.sg-left')} wall ${box('.sg-wall')} shelf ${box('.sg-shelf')} study ${box('.sg-study')} topbar ${box('.plugin > .top-bar')} pluginDisplay ${getComputedStyle(document.querySelector('.plugin')!).display} pluginH ${getComputedStyle(document.querySelector('.plugin')!).height}`
      void callJuceNative('orbLog', [msg]).catch(() => {})
    }
    const t1 = setTimeout(() => report('t+1s'), 1000), t2 = setTimeout(() => report('t+4s'), 4000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])
  const cls = ['plugin', 'sounds', 'fx-open', (fill && wide) ? 'screen-wide' : ''].filter(Boolean).join(' ')
  const style = (fill ? { width: '100%', height: '100%' } : {}) as CSSProperties

  return (
    <div className={cls} style={style}>
      <ResizeGrip />
      {/* Same height as the full plugin's toolbar so the print sits where
          the room was composed; the wordmark takes the dimmed-glyph tone. */}
      <div className="top-bar" />
      <div className="content" ref={contentRef}>
        <div className="view fxview">
          <FxWall size={wallSize} />
        </div>
      </div>
    </div>
  )
}
