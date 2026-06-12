import { useEffect, useRef, useState } from 'react'
import { subscribePlayhead, captureBarRange, type CaptureHandle, type PlayheadState } from '../../lib/dawCapture'

interface Props {
  /** Receives the captured WAV as a File ready to upload + send. */
  onCaptured: (file: File) => void
  onClose: () => void
}

type Phase = 'setup' | 'capturing' | 'encoding'

/**
 * "Capture from DAW" sheet. Lets the user pick a bar range, then records
 * exactly that range as the DAW plays through it — the plugin equivalent
 * of Logic's "export cycle range". Cross-DAW: gates on the playhead's ppq
 * position (universally reported), never on loop points (which aren't).
 */
export default function DawCapturePanel({ onCaptured, onClose }: Props) {
  const [fromBar, setFromBar] = useState('1')
  const [toBar, setToBar]     = useState('8')
  const [phase, setPhase]     = useState<Phase>('setup')
  const [live, setLive]       = useState<PlayheadState | null>(null)
  const [progressBar, setProgressBar] = useState<number | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const handleRef = useRef<CaptureHandle | null>(null)

  // Live playhead readout — confirms the DAW link + lets the user verify
  // bar numbers against what their DAW shows.
  useEffect(() => {
    const unsub = subscribePlayhead(setLive)
    return () => { unsub() }
  }, [])

  const start = Math.max(1, parseInt(fromBar, 10) || 1)
  const end   = Math.max(start, parseInt(toBar, 10) || start)
  const tnum  = live?.tnum ?? 4
  const tden  = live?.tden ?? 4

  const beginCapture = () => {
    setError(null)
    setPhase('capturing')
    setProgressBar(null)
    handleRef.current = captureBarRange(start, end, {
      tnum, tden,
      onProgress: (bar) => setProgressBar(bar),
      onDone: (wav) => {
        handleRef.current = null
        if (!wav || wav.size <= 44) {
          setError('No audio captured. Make sure the plugin is on a track that plays through bars ' + start + '–' + end + ', then play that range.')
          setPhase('setup')
          return
        }
        setPhase('encoding')
        const name = `DAW bars ${start}-${end}.wav`
        const file = new File([wav], name, { type: 'audio/wav' })
        onCaptured(file)
      },
    })
  }

  const stopEarly = () => { handleRef.current?.stop() }
  const cancel = () => { handleRef.current?.cancel(); handleRef.current = null; onClose() }

  useEffect(() => () => { handleRef.current?.cancel() }, [])

  return (
    <div className="dawcap-overlay" role="dialog" aria-modal="true">
      <div className="dawcap-backdrop" onClick={phase === 'setup' ? onClose : undefined} />
      <div className="dawcap-sheet">
        <div className="dawcap-head">
          <span className="dawcap-title">Capture from DAW</span>
          <button className="dawcap-close" onClick={cancel} aria-label="Close">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 2l8 8M10 2l-8 8" /></svg>
          </button>
        </div>

        {/* Live playhead — DAW link indicator */}
        <div className={`dawcap-live${live?.playing ? ' rolling' : ''}`}>
          <span className="dawcap-live-dot" />
          {live
            ? <span>DAW connected · now at <b>bar {live.bar}</b> · {live.tnum}/{live.tden} · {Math.round(live.bpm)} BPM</span>
            : <span>Play your DAW to detect the playhead…</span>}
        </div>

        {phase === 'setup' && (
          <>
            <div className="dawcap-range">
              <label>
                <span>From bar</span>
                <input type="number" min={1} value={fromBar}
                  onChange={e => setFromBar(e.target.value)} />
              </label>
              <span className="dawcap-arrow">→</span>
              <label>
                <span>To bar</span>
                <input type="number" min={1} value={toBar}
                  onChange={e => setToBar(e.target.value)} />
              </label>
            </div>

            {error && <div className="dawcap-error">{error}</div>}

            <p className="dawcap-hint">
              The plugin records bars {start}–{end} as your DAW plays through them.
              Set a loop/cycle over that range if you like, then hit Capture and play.
            </p>

            <button className="dawcap-cta" onClick={beginCapture}>
              Capture bars {start}–{end}
            </button>
          </>
        )}

        {phase === 'capturing' && (
          <>
            <div className="dawcap-progress">
              <div className="dawcap-progress-spinner" />
              <div className="dawcap-progress-text">
                {progressBar != null
                  ? <>Capturing… <b>bar {progressBar}</b> of {end}</>
                  : <>Waiting for playback to reach bar {start}…</>}
              </div>
            </div>
            <p className="dawcap-hint">Play the range in your DAW. Capture finishes automatically after bar {end}.</p>
            <button className="dawcap-cta dawcap-cta-ghost" onClick={stopEarly}>Stop &amp; use what's captured</button>
          </>
        )}

        {phase === 'encoding' && (
          <div className="dawcap-progress">
            <div className="dawcap-progress-spinner" />
            <div className="dawcap-progress-text">Preparing attachment…</div>
          </div>
        )}
      </div>
    </div>
  )
}
