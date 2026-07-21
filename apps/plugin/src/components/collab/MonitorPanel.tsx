import { useEffect, useRef, useState } from 'react'
import { hasJuceBridge } from '../../lib/juceBridge'
import {
  getMonitor, setMonitor, MONITOR_DEFAULTS, type MonitorState,
} from '../../lib/monitorBridge'
import {
  startMetering, stopMetering, readMeters, resetClip, resetIntegrated,
  getGonio, getStHistory, getStreamInfo, startDemoSignal, stopDemoSignal,
} from '../../lib/meterDsp'

interface Props {
  isOpen: boolean
}

type MeterMode = 'vu' | 'stereo' | 'loud' | 'image'
const MODES: Array<{ id: MeterMode; label: string }> = [
  { id: 'vu', label: 'vu' },
  { id: 'stereo', label: 'peak/rms' },
  { id: 'loud', label: 'loudness' },
  { id: 'image', label: 'image' },
]

/* ── shared formatting ────────────────────────────────────────────────── */

const fmtDb = (v: number, digits = 1) =>
  !isFinite(v) ? '−∞' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(digits)}`

/* ── VU face geometry ─────────────────────────────────────────────────── */

function vuAngle (db: number): number {
  const clamped = Math.max(-20, Math.min(3, db))
  const t = (clamped + 20) / 23
  return -44 + Math.pow(t, 0.72) * 88
}

function describeArc (cx: number, cy: number, r: number, a1: number, a2: number): string {
  const p = (a: number) => {
    const rad = (a - 90) * Math.PI / 180
    return `${cx + Math.cos(rad) * r} ${cy + Math.sin(rad) * r}`
  }
  return `M ${p(a1)} A ${r} ${r} 0 0 1 ${p(a2)}`
}

const VU_MAJOR = [-20, -10, -7, -5, -3, -1, 0, 1, 2, 3]
const VU_NUMBERED = new Set([-20, -10, -7, -5, -3, 0, 3])
const VU_MINOR = [-15, -12, -8.5, -6, -4, -2, -0.5, 0.5, 1.5, 2.5]

function VUFace ({ side }: { side: 'L' | 'R' }) {
  return (
    <svg className="mon-vu-svg" viewBox="0 0 150 74" aria-hidden="true">
      <rect x="1" y="1" width="148" height="72" rx="3.5" className="mon-vu-plate" />
      <path d={describeArc(75, 68, 52, vuAngle(-20), vuAngle(0))}
        fill="none" stroke="#3B382F" strokeWidth="1" opacity="0.55" />
      <path d={describeArc(75, 68, 52, vuAngle(0), vuAngle(3))}
        fill="none" stroke="#C33B27" strokeWidth="2.2" />
      {VU_MINOR.map(m => {
        const a = (vuAngle(m) - 90) * Math.PI / 180
        return (
          <line key={m}
            x1={75 + Math.cos(a) * 50} y1={68 + Math.sin(a) * 50}
            x2={75 + Math.cos(a) * 52.5} y2={68 + Math.sin(a) * 52.5}
            stroke={m >= 0 ? '#C33B27' : '#3B382F'} strokeWidth="0.7" opacity="0.6" />
        )
      })}
      {VU_MAJOR.map(m => {
        const a = (vuAngle(m) - 90) * Math.PI / 180
        const xt = 75 + Math.cos(a) * 59, yt = 68 + Math.sin(a) * 59
        return (
          <g key={m}>
            <line
              x1={75 + Math.cos(a) * 48} y1={68 + Math.sin(a) * 48}
              x2={75 + Math.cos(a) * 53} y2={68 + Math.sin(a) * 53}
              stroke={m >= 0 ? '#C33B27' : '#3B382F'}
              strokeWidth={m === 0 ? 1.6 : 1} opacity={m >= 0 ? 1 : 0.8} />
            {VU_NUMBERED.has(m) && (
              <text x={xt} y={yt + 2.3} textAnchor="middle" className="mon-vu-tick"
                fill={m >= 0 ? '#C33B27' : '#3B382F'}>
                {m === 0 ? '0' : Math.abs(m)}
              </text>
            )}
          </g>
        )
      })}
      <text x="75" y="42" textAnchor="middle" className="mon-vu-label">vu</text>
      <text x="9" y="69" className="mon-vu-side">{side.toLowerCase()}</text>
      <text x="141" y="69" textAnchor="end" className="mon-vu-cal">0vu=−18</text>
    </svg>
  )
}

/* ── Fader taper ──────────────────────────────────────────────────────── */

const TAPER: Array<[number, number]> = [
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
  { db: 6, label: '+6' }, { db: 3 }, { db: 0, label: '0' }, { db: -3 }, { db: -6, label: '6' },
  { db: -9 }, { db: -12, label: '12' }, { db: -16 }, { db: -20, label: '20' }, { db: -25 },
  { db: -30, label: '30' }, { db: -38 }, { db: -45, label: '45' }, { db: -60, label: '∞' },
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
      <div className="mon-fader-scale" aria-hidden="true">
        {FADER_TICKS.map(t => (
          <span key={t.db} className="mon-fader-tick" style={{ top: `${dbToPos(t.db) * 100}%` }}>
            {t.label && <span className="mon-fader-tick-label">{t.label}</span>}
            <span className={`mon-fader-tick-mark${t.label ? ' major' : ''}`} />
          </span>
        ))}
      </div>
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
        <span className="mon-fader-unity" style={{ top: `${dbToPos(0) * 100}%` }} />
        <span className="mon-fader-cap" style={{ top: `${dbToPos(value) * 100}%` }}>
          <span className="mon-fader-cap-line" />
        </span>
      </div>
    </div>
  )
}

/* ── Bar meter scale ──────────────────────────────────────────────────── */

const barPct = (db: number) => Math.max(0, Math.min(100, (db + 60) / 60 * 100))
const BAR_LABELED = [0, -6, -12, -18, -24, -36, -48, -60]
const BAR_FINE = [-3, -9, -15, -21, -30, -42, -54]

/* ── Panel ────────────────────────────────────────────────────────────── */

export default function MonitorPanel ({ isOpen }: Props) {
  const [mon, setMon] = useState<MonitorState>({ ...MONITOR_DEFAULTS })
  const [modeIdx, setModeIdx] = useState(0)
  const [demo] = useState(() => !hasJuceBridge)
  const mode = MODES[modeIdx].id

  const needleL = useRef<SVGLineElement>(null)
  const needleR = useRef<SVGLineElement>(null)
  const ledL = useRef<HTMLSpanElement>(null)
  const ledR = useRef<HTMLSpanElement>(null)
  const barL = useRef<HTMLDivElement>(null)
  const barR = useRef<HTMLDivElement>(null)
  const barHoldL = useRef<HTMLDivElement>(null)
  const barHoldR = useRef<HTMLDivElement>(null)
  const barRmsTextL = useRef<HTMLSpanElement>(null)
  const barRmsTextR = useRef<HTMLSpanElement>(null)
  const barPkTextL = useRef<HTMLSpanElement>(null)
  const barPkTextR = useRef<HTMLSpanElement>(null)
  const statusText = useRef<HTMLSpanElement>(null)
  const streamText = useRef<HTMLSpanElement>(null)
  const lufsM = useRef<HTMLSpanElement>(null)
  const lufsS = useRef<HTMLSpanElement>(null)
  const lufsIBig = useRef<HTMLSpanElement>(null)
  const corrFill = useRef<HTMLDivElement>(null)
  const corrText = useRef<HTMLSpanElement>(null)
  const gonioCanvas = useRef<HTMLCanvasElement>(null)
  const loudCanvas = useRef<HTMLCanvasElement>(null)
  const stripBarL = useRef<HTMLDivElement>(null)
  const stripBarR = useRef<HTMLDivElement>(null)

  useEffect(() => { void getMonitor().then(setMon) }, [])

  useEffect(() => {
    if (!isOpen) return
    startMetering()
    if (demo) startDemoSignal()

    let raf = 0
    let lastText = 0

    const tick = (now: number) => {
      const m = readMeters()

      if (needleL.current) needleL.current.setAttribute('transform', `rotate(${vuAngle(m.vuL)} 75 68)`)
      if (needleR.current) needleR.current.setAttribute('transform', `rotate(${vuAngle(m.vuR)} 75 68)`)
      ledL.current?.classList.toggle('on', m.clipL)
      ledR.current?.classList.toggle('on', m.clipR)

      if (barL.current) barL.current.style.height = `${barPct(m.rmsL)}%`
      if (barR.current) barR.current.style.height = `${barPct(m.rmsR)}%`
      if (barHoldL.current) {
        barHoldL.current.style.bottom = `${barPct(m.holdL)}%`
        barHoldL.current.classList.toggle('hot', m.holdL > -6)
      }
      if (barHoldR.current) {
        barHoldR.current.style.bottom = `${barPct(m.holdR)}%`
        barHoldR.current.classList.toggle('hot', m.holdR > -6)
      }
      if (stripBarL.current) stripBarL.current.style.height = `${barPct(m.rmsL)}%`
      if (stripBarR.current) stripBarR.current.style.height = `${barPct(m.rmsR)}%`

      if (now - lastText > 160) {
        lastText = now
        if (statusText.current)
          statusText.current.textContent = `pk ${fmtDb(Math.max(m.peakL, m.peakR))}`
        if (streamText.current) {
          const info = getStreamInfo()
          streamText.current.textContent = m.active
            ? `${Math.round(info.sr / 1000)}k·${info.ch === 1 ? 'mono' : 'st'}${demo ? '·demo' : ''}`
            : 'no sig'
        }
        if (barRmsTextL.current) barRmsTextL.current.textContent = fmtDb(m.rmsL, 1)
        if (barRmsTextR.current) barRmsTextR.current.textContent = fmtDb(m.rmsR, 1)
        if (barPkTextL.current) barPkTextL.current.textContent = fmtDb(m.holdL, 1)
        if (barPkTextR.current) barPkTextR.current.textContent = fmtDb(m.holdR, 1)
        if (lufsM.current) lufsM.current.textContent = fmtDb(m.lufsM)
        if (lufsS.current) lufsS.current.textContent = fmtDb(m.lufsS)
        if (lufsIBig.current) lufsIBig.current.textContent = fmtDb(m.lufsI)
        if (corrText.current) corrText.current.textContent = m.corr.toFixed(2)
        if (corrFill.current) {
          const pct = (m.corr + 1) / 2 * 100
          corrFill.current.style.left = `${Math.min(50, pct)}%`
          corrFill.current.style.width = `${Math.abs(pct - 50)}%`
          corrFill.current.classList.toggle('hot', m.corr < -0.05)
        }
      }

      const gc = gonioCanvas.current
      if (gc) {
        const ctx = gc.getContext('2d')
        if (ctx) {
          const w = gc.width, h = gc.height, half = w / 2
          ctx.fillStyle = '#22261F'
          ctx.fillRect(0, 0, w, h)
          ctx.strokeStyle = 'rgba(201, 240, 189, 0.18)'
          ctx.lineWidth = 1
          ctx.beginPath(); ctx.arc(half, half, half * 0.86, 0, Math.PI * 2); ctx.stroke()
          ctx.beginPath()
          ctx.moveTo(4, 4); ctx.lineTo(w - 4, h - 4)
          ctx.moveTo(w - 4, 4); ctx.lineTo(4, h - 4)
          ctx.stroke()
          ctx.fillStyle = 'rgba(201, 240, 189, 0.85)'
          const { data } = getGonio()
          for (let i = 0; i < data.length; i += 2) {
            const l = data[i], r = data[i + 1]
            const x = half + (l - r) * 0.7071 * half * 1.2
            const y = half - (l + r) * 0.7071 * half * 1.2
            if (x >= 0 && x < w && y >= 0 && y < h) ctx.fillRect(x, y, 1.4, 1.4)
          }
        }
      }

      const lc = loudCanvas.current
      if (lc) {
        const ctx = lc.getContext('2d')
        if (ctx) {
          const w = lc.width, h = lc.height
          const LO = -36, HI = -6
          const yOf = (v: number) => {
            const c = Math.max(LO, Math.min(HI, v))
            return h - (c - LO) / (HI - LO) * h
          }
          ctx.fillStyle = '#F0EBDC'
          ctx.fillRect(0, 0, w, h)
          ctx.strokeStyle = 'rgba(60, 55, 42, 0.14)'
          ctx.lineWidth = 1
          for (let v = HI; v >= LO; v -= 6) {
            ctx.beginPath(); ctx.moveTo(0, yOf(v)); ctx.lineTo(w, yOf(v)); ctx.stroke()
          }
          for (let x = 0; x <= w; x += Math.round(w / 10)) {
            ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke()
          }
          ctx.strokeStyle = 'rgba(36, 64, 255, 0.5)'
          ctx.setLineDash([3, 3])
          ctx.beginPath(); ctx.moveTo(0, yOf(-14)); ctx.lineTo(w, yOf(-14)); ctx.stroke()
          ctx.setLineDash([])
          const { data, pos } = getStHistory()
          ctx.strokeStyle = 'rgba(195, 59, 39, 0.92)'
          ctx.lineWidth = 1.4
          ctx.beginPath()
          let started = false
          for (let i = 0; i < data.length; i++) {
            const v = data[(pos + i) % data.length]
            if (!isFinite(v)) { started = false; continue }
            const x = i / (data.length - 1) * w
            if (!started) { ctx.moveTo(x, yOf(v)); started = true }
            else ctx.lineTo(x, yOf(v))
          }
          ctx.stroke()
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

  const step = (dir: 1 | -1) =>
    setModeIdx(i => (i + dir + MODES.length) % MODES.length)

  return (
    <div className="s-body monitor-body">
      <div className="mon-rig">
        {/* ── Full-height fader strip (the console's master strip) ── */}
        <div className="mon-fader-strip">
          <span className="mon-screw tl" /><span className="mon-screw tr" />
          <span className="mon-screw bl" /><span className="mon-screw br" />
          <Fader value={mon.gainDb} onChange={db => update({ gainDb: db })} />
          <div className="mon-ledder" aria-hidden="true">
            <div className="mon-ledder-track"><div ref={stripBarL} className="mon-ledder-fill" /></div>
            <div className="mon-ledder-track"><div ref={stripBarR} className="mon-ledder-fill" /></div>
          </div>
        </div>

        {/* ── Right: screen + controls ── */}
        <div className="mon-right">
          <div className="mon-screen">
            <span className="mon-screw tl" /><span className="mon-screw tr" />
            <span className="mon-screw bl" /><span className="mon-screw br" />
            <div className="mon-screen-menu">
              <button className="mon-arrow" onClick={() => step(-1)} aria-label="Previous meter">‹</button>
              <span className="mon-mode-name" role="tab" aria-selected="true">{MODES[modeIdx].label}</span>
              <button className="mon-arrow" onClick={() => step(1)} aria-label="Next meter">›</button>
            </div>

            <div className="mon-screen-view">
              {mode === 'vu' && (
                <div className="mon-vu-stack">
                  {(['L', 'R'] as const).map(side => (
                    <div className="mon-vu" key={side}>
                      <VUFace side={side} />
                      <svg className="mon-vu-needle-svg" viewBox="0 0 150 74" aria-hidden="true">
                        <line ref={side === 'L' ? needleL : needleR} x1="75" y1="68" x2="75" y2="21"
                          stroke="#26241F" strokeWidth="1.6" transform="rotate(-44 75 68)" />
                        <circle cx="75" cy="68" r="3.2" fill="#26241F" />
                      </svg>
                      <span className="mon-vu-glass" aria-hidden="true" />
                      <span ref={side === 'L' ? ledL : ledR} className="mon-clip-led" />
                    </div>
                  ))}
                </div>
              )}

              {mode === 'stereo' && (
                <div className="mon-bars">
                  <div className="mon-bar-wrap">
                    <div className="mon-bar-track">
                      <div ref={barL} className="mon-bar-fill" />
                      <div ref={barHoldL} className="mon-bar-hold" />
                    </div>
                  </div>
                  <div className="mon-bars-scale">
                    {BAR_LABELED.map(v => (
                      <span key={v} className="mon-bars-mark" style={{ bottom: `${barPct(v)}%` }}>
                        <i />{v === -60 ? '∞' : Math.abs(v)}<i />
                      </span>
                    ))}
                    {BAR_FINE.map(v => (
                      <span key={v} className="mon-bars-fine" style={{ bottom: `${barPct(v)}%` }} />
                    ))}
                  </div>
                  <div className="mon-bar-wrap">
                    <div className="mon-bar-track">
                      <div ref={barR} className="mon-bar-fill" />
                      <div ref={barHoldR} className="mon-bar-hold" />
                    </div>
                  </div>
                  <div className="mon-bars-readouts">
                    <div className="mon-bars-ro">
                      <span className="mon-ro-key">l·rms</span><span ref={barRmsTextL} className="mon-ro-val">−∞</span>
                      <span className="mon-ro-key">pk</span><span ref={barPkTextL} className="mon-ro-val">−∞</span>
                    </div>
                    <div className="mon-bars-ro">
                      <span className="mon-ro-key">r·rms</span><span ref={barRmsTextR} className="mon-ro-val">−∞</span>
                      <span className="mon-ro-key">pk</span><span ref={barPkTextR} className="mon-ro-val">−∞</span>
                    </div>
                  </div>
                </div>
              )}

              {mode === 'loud' && (
                <div className="mon-loud">
                  <div className="mon-loud-hero">
                    <span ref={lufsIBig} className="mon-loud-hero-val">−∞</span>
                    <span className="mon-loud-hero-key">int lufs</span>
                  </div>
                  <div className="mon-loud-col">
                    <div className="mon-loud-row"><span className="mon-ro-key">m</span><span ref={lufsM} className="mon-ro-val">−∞</span></div>
                    <div className="mon-loud-row"><span className="mon-ro-key">s</span><span ref={lufsS} className="mon-ro-val">−∞</span></div>
                    <div className="mon-loud-row"><span className="mon-ro-key">tgt</span><span className="mon-ro-val mon-ro-blue">−14.0</span></div>
                  </div>
                  <canvas ref={loudCanvas} width={150} height={74} className="mon-loud-graph" />
                  <div className="mon-loud-axis">
                    <span>60s</span><span>s·lu</span><span>now</span>
                  </div>
                </div>
              )}

              {mode === 'image' && (
                <div className="mon-image">
                  <canvas ref={gonioCanvas} width={108} height={108} className="mon-gonio" />
                  <div className="mon-corr-track">
                    <span className="mon-corr-zero" />
                    <div ref={corrFill} className="mon-corr-fill" />
                  </div>
                  <div className="mon-corr-scale">
                    <span>−1</span><span ref={corrText} className="mon-ro-val">0.00</span><span>+1</span>
                  </div>
                </div>
              )}
            </div>

            <div className="mon-screen-status">
              <span ref={statusText} className="mon-status-ro">pk −∞</span>
              <span ref={streamText} className="mon-status-ro">no sig</span>
              {mode === 'loud'
                ? <button className="mon-scr-btn" onClick={resetIntegrated}>rst</button>
                : <button className="mon-scr-btn" onClick={resetClip}>clr</button>}
            </div>
          </div>

          {/* ── Controls ── */}
          <div className="mon-card mon-ctrls">
            <div className="mon-strip-display">
              {mon.gainDb <= -59.5 ? '−∞' : fmtDb(mon.gainDb)}
              <span className="mon-strip-display-unit">db</span>
            </div>

            <div className="mon-strip-sec">
              <span className="mon-sec-head">
                <span className="mon-sec-label">balance</span>
                <span className="mon-sec-val">
                  {mon.pan === 0 ? 'c' : mon.pan < 0 ? `l${Math.round(-mon.pan * 100)}` : `r${Math.round(mon.pan * 100)}`}
                </span>
              </span>
              <input
                type="range" min={-100} max={100} step={1} value={Math.round(mon.pan * 100)}
                className="mon-slider"
                onChange={e => update({ pan: Number(e.target.value) / 100 })}
                onDoubleClick={() => update({ pan: 0 })}
              />
            </div>

            <div className="mon-strip-sec">
              <span className="mon-sec-head"><span className="mon-sec-label">phase</span></span>
              <div className="mon-ctrl-btns">
                <button className={`mon-btn${mon.invL ? ' on' : ''}`} onClick={() => update({ invL: !mon.invL })}>ø l</button>
                <button className={`mon-btn${mon.invR ? ' on' : ''}`} onClick={() => update({ invR: !mon.invR })}>ø r</button>
              </div>
            </div>

            <button className={`mon-btn mon-btn-mute${mon.mute ? ' on' : ''}`} onClick={() => update({ mute: !mon.mute })}>mute</button>
          </div>
        </div>
      </div>

    </div>
  )
}
