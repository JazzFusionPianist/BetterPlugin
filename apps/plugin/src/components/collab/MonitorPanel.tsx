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

type MeterMode = 'vu' | 'stereo' | 'loud' | 'image'
const MODES: Array<{ id: MeterMode; label: string }> = [
  { id: 'vu', label: 'vu' },
  { id: 'stereo', label: 'stereo' },
  { id: 'loud', label: 'lufs' },
  { id: 'image', label: 'image' },
]

/* ── VU face ──────────────────────────────────────────────────────────── */

function vuAngle (db: number): number {
  const clamped = Math.max(-20, Math.min(3, db))
  const t = (clamped + 20) / 23
  return -46 + Math.pow(t, 0.72) * 92
}

const fmtDb = (v: number, digits = 1) =>
  !isFinite(v) ? '−∞' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(digits)}`

function describeArc (cx: number, cy: number, r: number, a1: number, a2: number): string {
  const p = (a: number) => {
    const rad = (a - 90) * Math.PI / 180
    return `${cx + Math.cos(rad) * r} ${cy + Math.sin(rad) * r}`
  }
  return `M ${p(a1)} A ${r} ${r} 0 0 1 ${p(a2)}`
}

function VUFace ({ side }: { side: 'L' | 'R' }) {
  const marks = [-20, -10, -7, -5, -3, -1, 0, 1, 2, 3]
  const numbered = new Set([-20, -10, -7, -5, -3, 0, 3])
  return (
    <svg className="mon-vu-svg" viewBox="0 0 132 78" aria-hidden="true">
      <path d={describeArc(66, 72, 56, vuAngle(0), vuAngle(3))}
        fill="none" stroke="#D6402E" strokeWidth="2.5" opacity="0.85" />
      <path d={describeArc(66, 72, 56, vuAngle(-20), vuAngle(0))}
        fill="none" stroke="currentColor" strokeWidth="1" opacity="0.35" />
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

/* ── Fader taper: generous travel around unity, log-ish below ─────────── */

const TAPER: Array<[number, number]> = [   // [dB, position 0(top)..1(bottom)]
  [6, 0], [0, 0.18], [-12, 0.5], [-30, 0.78], [-60, 1],
]

function dbToPos (db: number): number {
  const v = Math.max(-60, Math.min(6, db))
  for (let i = 0; i < TAPER.length - 1; i++) {
    const [d1, p1] = TAPER[i], [d2, p2] = TAPER[i + 1]
    if (v <= d1 && v >= d2)
      return p1 + (d1 - v) / (d1 - d2) * (p2 - p1)
  }
  return 1
}

function posToDb (pos: number): number {
  const p = Math.max(0, Math.min(1, pos))
  for (let i = 0; i < TAPER.length - 1; i++) {
    const [d1, p1] = TAPER[i], [d2, p2] = TAPER[i + 1]
    if (p >= p1 && p <= p2)
      return d1 - (p - p1) / (p2 - p1) * (d1 - d2)
  }
  return -60
}

const FADER_TICKS: Array<{ db: number; label?: string }> = [
  { db: 6, label: '+6' }, { db: 3 }, { db: 0, label: '0' }, { db: -6, label: '6' },
  { db: -12, label: '12' }, { db: -20 }, { db: -30, label: '30' },
  { db: -45 }, { db: -60, label: '∞' },
]

function Fader ({ value, onChange }: { value: number; onChange: (db: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const moveTo = (clientY: number) => {
    const el = trackRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    onChange(Math.round(posToDb((clientY - r.top) / r.height) * 10) / 10)
  }

  return (
    <div className="mon-fader">
      <div
        ref={trackRef}
        className="mon-fader-track"
        onPointerDown={e => {
          dragging.current = true
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
          moveTo(e.clientY)
        }}
        onPointerMove={e => { if (dragging.current) moveTo(e.clientY) }}
        onPointerUp={() => { dragging.current = false }}
        onDoubleClick={() => onChange(0)}
        role="slider"
        aria-label="Monitor fader"
        aria-valuemin={-60} aria-valuemax={6} aria-valuenow={Math.round(value)}
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'ArrowUp') onChange(Math.min(6, value + 1))
          if (e.key === 'ArrowDown') onChange(Math.max(-60, value - 1))
        }}
      >
        <span className="mon-fader-slot" />
        <span className="mon-fader-cap" style={{ top: `${dbToPos(value) * 100}%` }}>
          <span className="mon-fader-cap-line" />
        </span>
      </div>
      <div className="mon-fader-scale" aria-hidden="true">
        {FADER_TICKS.map(t => (
          <span key={t.db} className="mon-fader-tick" style={{ top: `${dbToPos(t.db) * 100}%` }}>
            <span className="mon-fader-tick-mark" />
            {t.label && <span className="mon-fader-tick-label">{t.label}</span>}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ── Stereo bar meter scale (dBFS, linear in dB from -60..0) ──────────── */

const barPct = (db: number) => Math.max(0, Math.min(100, (db + 60) / 60 * 100))
const BAR_MARKS = [0, -6, -12, -24, -40, -60]

/* ── Panel ────────────────────────────────────────────────────────────── */

export default function MonitorPanel ({ isOpen }: Props) {
  const [mon, setMon] = useState<MonitorState>({ ...MONITOR_DEFAULTS })
  const [mode, setMode] = useState<MeterMode>('vu')
  const [demo] = useState(() => !hasJuceBridge)

  const needleL = useRef<SVGLineElement>(null)
  const needleR = useRef<SVGLineElement>(null)
  const ledL = useRef<HTMLSpanElement>(null)
  const ledR = useRef<HTMLSpanElement>(null)
  const barL = useRef<HTMLDivElement>(null)
  const barR = useRef<HTMLDivElement>(null)
  const barHoldL = useRef<HTMLDivElement>(null)
  const barHoldR = useRef<HTMLDivElement>(null)
  const barTextL = useRef<HTMLSpanElement>(null)
  const barTextR = useRef<HTMLSpanElement>(null)
  const peakText = useRef<HTMLSpanElement>(null)
  const lufsM = useRef<HTMLSpanElement>(null)
  const lufsS = useRef<HTMLSpanElement>(null)
  const lufsI = useRef<HTMLSpanElement>(null)
  const lufsIBig = useRef<HTMLSpanElement>(null)
  const corrFill = useRef<HTMLDivElement>(null)
  const corrText = useRef<HTMLSpanElement>(null)
  const gonioCanvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => { void getMonitor().then(setMon) }, [])

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

      if (barL.current) barL.current.style.height = `${barPct(m.rmsL)}%`
      if (barR.current) barR.current.style.height = `${barPct(m.rmsR)}%`
      if (barHoldL.current) {
        barHoldL.current.style.bottom = `${barPct(m.holdL)}%`
        barHoldL.current.style.background = m.holdL > -6 ? '#D6402E' : 'var(--blue)'
      }
      if (barHoldR.current) {
        barHoldR.current.style.bottom = `${barPct(m.holdR)}%`
        barHoldR.current.style.background = m.holdR > -6 ? '#D6402E' : 'var(--blue)'
      }

      if (now - lastText > 160) {
        lastText = now
        if (peakText.current)
          peakText.current.textContent = `peak ${fmtDb(Math.max(m.peakL, m.peakR))} dbfs`
        if (barTextL.current) barTextL.current.textContent = fmtDb(m.rmsL, 0)
        if (barTextR.current) barTextR.current.textContent = fmtDb(m.rmsR, 0)
        if (lufsM.current) lufsM.current.textContent = fmtDb(m.lufsM)
        if (lufsS.current) lufsS.current.textContent = fmtDb(m.lufsS)
        if (lufsI.current) lufsI.current.textContent = fmtDb(m.lufsI)
        if (lufsIBig.current) lufsIBig.current.textContent = fmtDb(m.lufsI)
        if (corrText.current) corrText.current.textContent = m.corr.toFixed(2)
        if (corrFill.current) {
          const pct = (m.corr + 1) / 2 * 100
          corrFill.current.style.left = `${Math.min(50, pct)}%`
          corrFill.current.style.width = `${Math.abs(pct - 50)}%`
          corrFill.current.style.background = m.corr < -0.05 ? '#D6402E' : 'var(--blue)'
        }
      }

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
  }, [isOpen, demo, mode])

  const update = (patch: Partial<MonitorState>) => {
    setMon(prev => ({ ...prev, ...patch }))
    setMonitor(patch)
  }

  return (
    <div className="s-body monitor-body">
      {/* ── The screen: one panel, switchable meters ── */}
      <div className="mon-card mon-screen">
        <div className="mon-modes" role="tablist">
          {MODES.map(m => (
            <button
              key={m.id}
              role="tab"
              aria-selected={mode === m.id}
              className={`mon-mode${mode === m.id ? ' active' : ''}`}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="mon-screen-view">
          {mode === 'vu' && (
            <div className="mon-vu-row">
              {(['L', 'R'] as const).map(side => (
                <div className="mon-vu" key={side}>
                  <VUFace side={side} />
                  <svg className="mon-vu-needle-svg" viewBox="0 0 132 78" aria-hidden="true">
                    <line ref={side === 'L' ? needleL : needleR} x1="66" y1="72" x2="66" y2="20"
                      stroke="currentColor" strokeWidth="1.6" transform="rotate(-46 66 72)" />
                    <circle cx="66" cy="72" r="3.5" fill="currentColor" />
                  </svg>
                  <span ref={side === 'L' ? ledL : ledR} className="mon-clip-led" />
                </div>
              ))}
            </div>
          )}

          {mode === 'stereo' && (
            <div className="mon-bars">
              <div className="mon-bars-scale">
                {BAR_MARKS.map(m => (
                  <span key={m} className="mon-bars-mark" style={{ bottom: `${barPct(m)}%` }}>
                    {m === -60 ? '∞' : Math.abs(m)}
                  </span>
                ))}
              </div>
              {(['L', 'R'] as const).map(side => (
                <div className="mon-bar-col" key={side}>
                  <div className="mon-bar-track">
                    <div ref={side === 'L' ? barL : barR} className="mon-bar-fill" />
                    <div ref={side === 'L' ? barHoldL : barHoldR} className="mon-bar-hold" />
                  </div>
                  <span className="mon-bar-side">{side.toLowerCase()}</span>
                  <span ref={side === 'L' ? barTextL : barTextR} className="mon-bar-db">−∞</span>
                </div>
              ))}
            </div>
          )}

          {mode === 'loud' && (
            <div className="mon-loud">
              <div className="mon-loud-hero">
                <span ref={lufsIBig} className="mon-loud-hero-val">−∞</span>
                <span className="mon-loud-hero-key">integrated lufs</span>
              </div>
              <div className="mon-loud-side">
                <div className="mon-loud-row"><span className="mon-loud-key">momentary</span><span ref={lufsM} className="mon-loud-val">−∞</span></div>
                <div className="mon-loud-row"><span className="mon-loud-key">short-term</span><span ref={lufsS} className="mon-loud-val">−∞</span></div>
                <div className="mon-loud-row"><span className="mon-loud-key">integrated</span><span ref={lufsI} className="mon-loud-val">−∞</span></div>
              </div>
            </div>
          )}

          {mode === 'image' && (
            <div className="mon-image">
              <canvas ref={gonioCanvas} width={120} height={120} className="mon-gonio" />
              <div className="mon-image-side">
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
            </div>
          )}
        </div>

        <div className="mon-vu-foot">
          <span ref={peakText} className="mon-machine">peak −∞ dbfs</span>
          {mode === 'loud'
            ? <button className="mon-mini-btn" onClick={resetIntegrated}>reset lufs</button>
            : <button className="mon-mini-btn" onClick={resetClip}>reset clip</button>}
        </div>
      </div>

      {/* ── Monitor strip: the fader ── */}
      <div className="mon-card mon-strip">
        <Fader value={mon.gainDb} onChange={db => update({ gainDb: db })} />
        <div className="mon-strip-side">
          <div className="mon-strip-readout">
            {mon.gainDb <= -59.5 ? '−∞' : `${fmtDb(mon.gainDb)} db`}
          </div>
          <div className="mon-strip-ctrl">
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
          </div>
          <button className={`mon-btn mon-btn-mute${mon.mute ? ' on' : ''}`} onClick={() => update({ mute: !mon.mute })}>mute</button>
        </div>
      </div>

      {demo && (
        <p className="mon-demo-note">demo signal — open inside the plugin to meter the daw.</p>
      )}
    </div>
  )
}
