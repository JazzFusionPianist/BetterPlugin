import { useEffect, useState, type CSSProperties } from 'react'
import FxPanel from '../components/collab/FxPanel'
import ResizeGrip from '../components/collab/ResizeGrip'
import { hasJuceBridge } from '../lib/juceBridge'
import { adoptSharedWindowSize, watchSharedWindowSize } from '../lib/pluginWindow'
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
  const cls = ['plugin', 'sounds', 'fx-open', (fill && wide) ? 'screen-wide' : ''].filter(Boolean).join(' ')
  const style = (fill ? { width: '100%', height: '100%' } : {}) as CSSProperties

  return (
    <div className={cls} style={style}>
      <ResizeGrip />
      {/* Same height as the full plugin's toolbar so the print sits where
          the room was composed; the wordmark takes the dimmed-glyph tone. */}
      <div className="top-bar">
        <span className="sounds-mark">orb sounds</span>
      </div>
      <div className="content">
        <div className="view fxview">
          <FxPanel isOpen />
        </div>
      </div>
    </div>
  )
}
