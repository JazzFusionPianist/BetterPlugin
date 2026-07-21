import { useEffect, useRef, useState } from 'react'
import { hasJuceBridge } from '../../lib/juceBridge'
import {
  getMonitor, setMonitor, MONITOR_DEFAULTS, type MonitorState,
} from '../../lib/monitorBridge'
import {
  startMetering, stopMetering, readMeters, resetClip, resetIntegrated,
  getGonio, startDemoSignal, stopDemoSignal,
} from '../../lib/meterDsp'

interface Props {
  isOpen: boolean
}

/* Map a VU value (dB re 0VU) to a needle angle. Scale runs -20..+3 VU
   across -46°..+46°, compressed low like a real VU face. */
function vuAngle (db: number): number {
  const clamped = Math.max(-20, Math.min(3, db))
  const t = (clamped + 20) / 23
  return -46 + Math.pow(t, 0.72) * 92
}

const fmtDb = (v: number, digits = 1) =>
  !isFinite(v) ? '−∞' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(digits)}`

function VUFace ({ side }: { side: 'L' | 'R' }) {
  // Tick marks along the same curve the needle sweeps; only the sparse
  // set gets a printed number so the red zone stays readable.
  const marks = [-20, -10, -7, -5, -3, -1, 0, 1, 2, 3]
  const numbered = new Set([-20, -10, -7, -5, -3, 0, 3])
  return (
    <svg className="mon-vu-svg" viewBox="0 0 132 78" aria-hidden="true">
      {/* red zone arc (0..+3 VU) */}
      <path
        d={describeArc(66, 72, 56, vuAngle(0), vuAngle(3))}
        fill="none" stroke="#D6402E" strokeWidth="2.5" opacity="0.85"
      />
      <path
        d={describeArc(66, 72, 56, vuAngle(-20), vuAngle(0))}
        fill="none" stroke="currentColor" strokeWidth="1" opacity="0.35"
      />
      {marks.map(m => {
        const a = (vuAngle(m) - 90) * Math.PI / 180
        const x1 = 66 + Math.cos(a) * 53, y1 = 72 + Math.sin(a) * 53
        const x2 = 66 + Math.cos(a) * 58, y2 = 72 + Math.sin(a) * 58
        const xt = 66 + Math.cos(a) * 64, yt = 72 + Math.sin(a) * 64
        return (
          <g key={m}>
            <line x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={m >= 0 ? '#D6402E' : 'currentColor'}
              strokeWidth={m === 0 ? 1.6 : 1} opacity={m >= 0 ? 0.9 : 0.55} />
            {numbered.has(m) && (
              <text x={xt} y={yt + 2.5} textAnchor="middle" className="mon-vu-tick"
                fill={m >= 0 ? '#D6402E' : 'currentColor'}>
                {m === 0 ? '0' : Math.abs(m)}
              </text>
            )}
          </g>
        )
      })}
      <text x="66" y="46" textAnchor="middle" className="mon-vu-label">vu</text>
      <text x="10" y="74" className="mon-vu-side">{side.toLowerCase()}</text>
    </svg>
  )
}

function describeArc (cx: number, cy: number, r: number, a1: number, a2: number): string {
  const p = (a: number) => {
    const rad = (a - 90) * Math.PI / 180
    return `${cx + Math.cos(rad) * r} ${cy + Math.sin(rad) * r}`
  }
  return `M ${p(a1)} A ${r} ${r} 0 0 1 ${p(a2)}`
}

export default function MonitorPanel ({ isOpen }: Props) {
  const [mon, setMon] = useState<MonitorState>({ ...MONITOR_DEFAULTS })
  const [demo] = useState(() => !hasJuceBridge)

  const needleL = useRef<SVGLineElement>(null)
  const needleR = useRef<SVGLineElement>(null)
  const ledL = useRef<HTMLSpanElement>(null)
  const ledR = useRef<HTMLSpanElement>(null)
  const peakText = useRef<HTMLSpanElement>(null)
  const lufsM = useRef<HTMLSpanElement>(null)
  const lufsS = useRef<HTMLSpanElement>(null)
  const lufsI = useRef<HTMLSpanElement>(null)
  const corrFill = useRef<HTMLDivElement>(null)
  const corrText = useRef<HTMLSpanElement>(null)
  const gonioCanvas = useRef<HTMLCanvasElement>(null)

  // Load persisted params from the processor once.
  useEffect(() => { void getMonitor().then(setMon) }, [])

  // Metering runs only while the panel is open.
  useEffect(() => {
    if (!isOpen) return
    startMetering()
    if (demo) startDemoSignal()

    let raf = 0
    let lastText = 0
    const dark = document.querySelector('.plugin.dark') !== null

    const tick = (now: number) => {
      const m = readMeters()

      if (needleL.current) needleL.current.setAttribute('transform', `rotate(${vuAngle(m.vuL)} 66 72)`)
      if (needleR.current) needleR.current.setAttribute('transform', `rotate(${vuAngle(m.vuR)} 66 72)`)
      ledL.current?.classList.toggle('on', m.clipL)
      ledR.current?.classList.toggle('on', m.clipR)

      // slower-moving text readouts at ~6fps
      if (now - lastText > 160) {
        lastText = now
        if (peakText.current)
          peakText.current.textContent = `peak ${fmtDb(Math.max(m.peakL, m.peakR))} dBFS`
        if (lufsM.current) lufsM.current.textContent = fmtDb(m.lufsM)
        if (lufsS.current) lufsS.current.textContent = fmtDb(m.lufsS)
        if (lufsI.current) lufsI.current.textContent = fmtDb(m.lufsI)
        if (corrText.current) corrText.current.textContent = m.corr.toFixed(2)
        if (corrFill.current) {
          const pct = (m.corr + 1) / 2 * 100
          corrFill.current.style.left = `${Math.min(50, pct)}%`
          corrFill.current.style.width = `${Math.abs(pct - 50)}%`
          corrFill.current.style.background = m.corr < -0.05 ? '#D6402E' : 'var(--blue)'
        }
      }

      // goniometer
      const canvas = gonioCanvas.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const w = canvas.width, h = canvas.height, half = w / 2
          ctx.fillStyle = dark ? 'rgba(23, 22, 20, 0.28)' : 'rgba(251, 250, 247, 0.28)'
          ctx.fillRect(0, 0, w, h)
          ctx.fillStyle = dark ? 'rgba(240, 238, 233, 0.75)' : 'rgba(26, 25, 23, 0.7)'
          const { data } = getGonio()
          for (let i = 0; i < data.length; i += 2) {
            const l = data[i], r = data[i + 1]
            const x = half + (l - r) * 0.7071 * half * 1.25
            const y = half - (l + r) * 0.7071 * half * 1.25
            if (x >= 0 && x < w && y >= 0 && y < h) ctx.fillRect(x, y, 1.5, 1.5)
          }
        }
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      stopMetering()
      if (demo) stopDemoSignal()
    }
  }, [isOpen, demo])

  const update = (patch: Partial<MonitorState>) => {
    setMon(prev => ({ ...prev, ...patch }))
    setMonitor(patch)
  }

  return (
    <div className="s-body monitor-body">
      {/* ── VU pair ── */}
      <div className="mon-card mon-vu-card">
        <div className="mon-vu-row">
          <div className="mon-vu">
            <VUFace side="L" />
            <svg className="mon-vu-needle-svg" viewBox="0 0 132 78" aria-hidden="true">
              <line ref={needleL} x1="66" y1="72" x2="66" y2="20"
                stroke="currentColor" strokeWidth="1.6" transform="rotate(-46 66 72)" />
              <circle cx="66" cy="72" r="3.5" fill="currentColor" />
            </svg>
            <span ref={ledL} className="mon-clip-led" title="clip L" />
          </div>
          <div className="mon-vu">
            <VUFace side="R" />
            <svg className="mon-vu-needle-svg" viewBox="0 0 132 78" aria-hidden="true">
              <line ref={needleR} x1="66" y1="72" x2="66" y2="20"
                stroke="currentColor" strokeWidth="1.6" transform="rotate(-46 66 72)" />
              <circle cx="66" cy="72" r="3.5" fill="currentColor" />
            </svg>
            <span ref={ledR} className="mon-clip-led" title="clip R" />
          </div>
        </div>
        <div className="mon-vu-foot">
          <span ref={peakText} className="mon-machine">peak −∞ dBFS</span>
          <button className="mon-mini-btn" onClick={resetClip}>reset clip</button>
        </div>
      </div>

      {/* ── Image + loudness ── */}
      <div className="mon-duo">
        <div className="mon-card mon-gonio-card">
          <canvas ref={gonioCanvas} width={104} height={104} className="mon-gonio" />
          <div className="mon-corr-track">
            <span className="mon-corr-zero" />
            <div ref={corrFill} className="mon-corr-fill" />
          </div>
          <div className="mon-corr-foot">
            <span className="mon-machine">−1</span>
            <span className="mon-machine">corr <span ref={corrText}>0.00</span></span>
            <span className="mon-machine">+1</span>
          </div>
        </div>

        <div className="mon-card mon-loud-card">
          <div className="mon-loud-row"><span className="mon-loud-key">m</span><span ref={lufsM} className="mon-loud-val">−∞</span></div>
          <div className="mon-loud-row"><span className="mon-loud-key">s</span><span ref={lufsS} className="mon-loud-val">−∞</span></div>
          <div className="mon-loud-row mon-loud-int"><span className="mon-loud-key">i</span><span ref={lufsI} className="mon-loud-val">−∞</span></div>
          <div className="mon-loud-unit">lufs</div>
          <button className="mon-mini-btn" onClick={resetIntegrated}>reset</button>
        </div>
      </div>

      {/* ── Monitor controls ── */}
      <div className="mon-card mon-ctrl-card">
        <div className="mon-ctrl-row">
          <span className="mon-ctrl-label">fader</span>
          <input
            type="range" min={-60} max={6} step={0.1} value={mon.gainDb}
            className="mon-slider"
            onChange={e => update({ gainDb: Number(e.target.value) })}
            onDoubleClick={() => update({ gainDb: 0 })}
          />
          <span className="mon-ctrl-val">{mon.gainDb <= -59.5 ? '−∞' : `${fmtDb(mon.gainDb)} db`}</span>
        </div>
        <div className="mon-ctrl-row">
          <span className="mon-ctrl-label">balance</span>
          <input
            type="range" min={-100} max={100} step={1} value={Math.round(mon.pan * 100)}
            className="mon-slider"
            onChange={e => update({ pan: Number(e.target.value) / 100 })}
            onDoubleClick={() => update({ pan: 0 })}
          />
          <span className="mon-ctrl-val">
            {mon.pan === 0 ? 'c' : mon.pan < 0 ? `l ${Math.round(-mon.pan * 100)}` : `r ${Math.round(mon.pan * 100)}`}
          </span>
        </div>
        <div className="mon-ctrl-btns">
          <button className={`mon-btn${mon.invL ? ' on' : ''}`} onClick={() => update({ invL: !mon.invL })}>ø l</button>
          <button className={`mon-btn${mon.invR ? ' on' : ''}`} onClick={() => update({ invR: !mon.invR })}>ø r</button>
          <button className={`mon-btn mon-btn-mute${mon.mute ? ' on' : ''}`} onClick={() => update({ mute: !mon.mute })}>mute</button>
        </div>
      </div>

      {demo && (
        <p className="mon-demo-note">demo signal — open inside the plugin to meter the daw.</p>
      )}
    </div>
  )
}
