import type { CSSProperties } from 'react'
import FxPanel from '../components/collab/FxPanel'
import ResizeGrip from '../components/collab/ResizeGrip'
import { hasJuceBridge } from '../lib/juceBridge'
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
  const cls = ['plugin', 'sounds', 'fx-open', screenPreview ? 'screen-wide' : ''].filter(Boolean).join(' ')
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
