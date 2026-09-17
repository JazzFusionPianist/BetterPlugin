import { useEffect, useRef, useState } from 'react'
import { Bar, Cells, Chevron, Drawer, Keyboard, Lamp, Steps, type Hue, type Tone } from '../../assets/parts/parts'

/*  The study's hands — the rows under the big print.

    Every parameter is one row: its name at the left, the part at the
    right in one 236px column. The parts are drawn in assets/parts; the
    wrappers here only place them and change their state. Each hand has
    a colour (1 blue, 2 green, 3 white, 4 orange, then again).
    Drag a number (up or right = more), double-click it to type, ⌥-click
    it to rest.                                                          */

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const COL = 236

const quant = (v: number, step: number) => {
  const q = Math.round(v / step) * step
  const dec = step >= 1 ? 0 : Math.min(6, Math.ceil(-Math.log10(step)))
  return Number(q.toFixed(dec))
}

const hueVar = (c: Tone) => ({ '--sg-hue': c === 't' ? 'var(--sg-tint)' : `var(--sg-c${c})` } as React.CSSProperties)

/** A number that turns into a caret when double-clicked. */
export function useTypeIn (opts: { text: string; parse: (s: string) => number | null; commit: (v: number) => void; reset?: () => void; className?: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  const open = useRef(false)
  useEffect(() => { if (editing) { const el = ref.current; if (el) { el.focus(); el.select() } } }, [editing])
  const begin = () => { setDraft(opts.text); open.current = true; setEditing(true) }
  const done = (commit: boolean, s: string) => {
    if (!open.current) return
    open.current = false
    if (commit) {
      const t = s.trim()
      if (t === '') opts.reset?.()
      else { const v = opts.parse(t); if (v !== null && Number.isFinite(v)) opts.commit(v) }
    }
    setEditing(false)
  }
  const input = editing ? (
    <input ref={ref} className={`sg-typein${opts.className ? ' ' + opts.className : ''}`} value={draft} spellCheck={false} autoComplete="off"
      style={{ width: `${Math.max(3, draft.length + 1)}ch` }}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') done(true, e.currentTarget.value); else if (e.key === 'Escape') done(false, '') }}
      onBlur={(e) => done(true, e.currentTarget.value)}
      onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} />
  ) : null
  return { editing, begin, input }
}

/** Leading number out of what was typed — "120ms", "+3 st", "−12", "1.5k". */
export function parseLead (s: string): number | null {
  const m = /^\s*([+\-−]?\s*\d*\.?\d+)\s*([a-zA-Z%]*)/.exec(s.replace(/,/g, '.'))
  if (!m) return null
  let v = Number(m[1].replace('−', '-').replace(/\s+/g, ''))
  if (!Number.isFinite(v)) return null
  const unit = m[2].toLowerCase()
  if (unit === 'k' || unit === 'khz') v *= 1000
  return v
}

/** "35 %" → the number in the mono, the unit small after it. */
function Value ({ text }: { text: string }) {
  const m = /^([+\-−]?\d*\.?\d+)(.*)$/.exec(text)
  if (!m) return <>{text}</>
  const unit = m[2].trim()
  return <>{m[1]}{unit ? <span className="sg-unit">{unit}</span> : null}</>
}

/* ── a number: drag it, type into it; the bar beside it is the gauge ── */

export function GaugeRow ({ label, tag, value, min, max, step = 1, bipolar, unit, format, parse, defaultValue, onChange, fine, colour = 3 }: {
  label: string
  tag?: React.ReactNode       // what plays this hand (a rate), shown after the label
  value: number
  min: number
  max: number
  step?: number
  bipolar?: boolean          // the fill grows from the middle, not the left
  unit?: string
  format?: (v: number) => string
  parse?: (s: string) => number | null
  defaultValue: number
  fine?: number              // pixels for the whole range (default 180)
  onChange: (v: number, final: boolean) => void
  colour?: Hue
}) {
  const text = format ? format(value) : `${quant(value, step)}${unit ? ' ' + unit : ''}`
  const commit = (v: number) => onChange(clamp(quant(v, step), min, max), true)
  const typing = useTypeIn({ text, parse: parse ?? parseLead, commit, reset: () => onChange(defaultValue, true) })
  const drag = useRef<{ x0: number; y0: number; v0: number; last: number; moved: boolean } | null>(null)
  const [live, setLive] = useState(false)
  const [hover, setHover] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null)
  // the wheel is ours (React's onWheel is passive — the body would scroll)
  useEffect(() => {
    const el = rowRef.current; if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); e.stopPropagation()
      const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? -e.deltaY : e.deltaX
      const v = clamp(quant(value + d * (max - min) / 1600, step), min, max)
      if (v !== value) onChange(v, true)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [value, min, max, step, onChange])
  const span = max - min
  const f = span > 0 ? clamp((value - min) / span, 0, 1) : 0
  const zero = bipolar ? clamp((0 - min) / span, 0, 1) : 0
  return (
    <div ref={rowRef} className={`sg-row gauge${live ? ' live' : ''}${typing.editing ? ' typing' : ''}`} style={hueVar(colour)}
      onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)}
      onPointerDown={(e) => {
        if (typing.editing) return
        e.stopPropagation()
        if (e.altKey) { onChange(defaultValue, true); return }
        try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* fine */ }
        drag.current = { x0: e.clientX, y0: e.clientY, v0: value, last: value, moved: false }
      }}
      onPointerMove={(e) => {
        const d = drag.current; if (!d) return
        const px = (d.y0 - e.clientY) + (e.clientX - d.x0)
        if (!d.moved && Math.abs(px) < 3) return
        if (!d.moved) { d.moved = true; setLive(true) }
        const v = clamp(quant(d.v0 + px * span / (fine ?? 180), step), min, max)
        if (v !== d.last) { d.last = v; onChange(v, false) }
      }}
      onPointerUp={() => {
        const d = drag.current; drag.current = null
        setLive(false)
        if (d?.moved) onChange(d.last, true)
      }}
      onDoubleClick={(e) => { e.stopPropagation(); if (!typing.editing) typing.begin() }}>
      <span className="sg-row-label">{label}{tag}</span>
      <span className="sg-row-ctl">
        <Bar f={f} zero={zero} hue={colour} live={live} hover={hover} width={COL - 52 - 12} />
        <span className="sg-num">{typing.input ?? <Value text={text} />}</span>
      </span>
    </div>
  )
}

/* ── a choice: cells, steps, the keyboard, or a list, by what it holds ── */

export function ChoiceRow ({ label, options, value, onPick, fill, colour = 1 }: {
  label: string
  options: string[]
  value: number
  onPick: (i: number) => void
  fill?: boolean              // the divisions and the keyboard fill the column
  colour?: Hue
}) {
  const [hover, setHover] = useState(-1)
  const [down, setDown] = useState(-1)
  const [open, setOpen] = useState(false)
  const keys = fill && options.length === 12
  const steps = fill && !keys
  const asList = !fill && options.length > 8
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    document.addEventListener('pointerdown', close, true)
    return () => document.removeEventListener('pointerdown', close, true)
  }, [open])
  const pick = (i: number) => { setDown(-1); if (i !== value) onPick(i) }
  const press = (i: number, e: React.PointerEvent) => { e.stopPropagation(); setDown(i) }
  const leave = () => { setHover(-1); setDown(-1) }
  const hoverOf = (e: React.PointerEvent, n: number, w: number) => {
    const r = (e.currentTarget as SVGElement).getBoundingClientRect()
    setHover(clamp(Math.floor((e.clientX - r.left) / (r.width || w) * n), 0, n - 1))
  }
  return (
    <div className="sg-row choice" style={hueVar(colour)} onPointerDown={(e) => e.stopPropagation()}>
      <span className="sg-row-label">{label}</span>
      <span className="sg-row-ctl">
        {keys && (
          <span onPointerLeave={leave} onPointerUp={() => { if (down >= 0) pick(down) }}>
            <Keyboard names={options.map(s => s.toLowerCase())} value={value} hue={colour} hover={hover} width={COL}
              onKey={(i, e) => { press(i, e); setHover(i) }} />
          </span>
        )}
        {steps && (
          <>
            <span onPointerLeave={leave} onPointerMove={(e) => hoverOf(e, options.length, COL - 64)} onPointerUp={() => { if (down >= 0) pick(down) }}>
              <Steps count={options.length} value={value} hue={colour} hover={hover} width={COL - 52 - 12} onStep={press} />
            </span>
            <span className="sg-num">{options[hover >= 0 ? hover : value]}</span>
          </>
        )}
        {asList && (
          <span className="sg-list">
            {open && (
              <span className="sg-list-drawer" onPointerDown={(e) => e.stopPropagation()} onPointerLeave={() => setHover(-1)}>
                <Drawer options={options} value={value} hue={colour} hover={hover} width={COL}
                  onRow={(i, e) => { e.stopPropagation(); pick(i); setOpen(false) }} />
              </span>
            )}
            <button type="button" className={`sg-key sg-list-key${open ? ' open' : ''}`} style={{ width: COL, justifyContent: 'space-between' }}
              onPointerDown={(e) => { e.stopPropagation(); setOpen(v => !v) }}
              onPointerMove={open ? (e) => {
                const d = (e.currentTarget.previousSibling as HTMLElement | null); if (!d) return
                const r = d.getBoundingClientRect(); const i = Math.floor((e.clientY - r.top - 2) / 16); setHover(i >= 0 && i < options.length ? i : -1)
              } : undefined}>
              <span>{options[value]}</span><Chevron up={open} />
            </button>
          </span>
        )}
        {!keys && !steps && !asList && (
          <span onPointerLeave={leave} onPointerMove={(e) => hoverOf(e, options.length, COL)} onPointerUp={() => { if (down >= 0) pick(down) }}>
            <Cells options={options} value={value} hue={colour} hover={hover} down={down} width={COL} onCell={press} />
          </span>
        )}
      </span>
    </div>
  )
}

/* ── on / off: a lamp beside each word ── */

export function SwitchRow ({ items, colour = 4 }: { items: Array<{ label: string; on: boolean; set: (on: boolean) => void; quiet?: boolean }>; colour?: Hue }) {
  const [hover, setHover] = useState(-1)
  if (items.length === 0) return null
  return (
    <div className="sg-row switches" onPointerDown={(e) => e.stopPropagation()}>
      <span className="sg-row-ctl">
        {items.map((it, i) => (
          <span key={it.label} className={`sg-sw-item${it.on ? ' on' : ''}`}
            onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(-1)}
            onPointerDown={(e) => { e.stopPropagation(); it.set(!it.on) }}>
            <Lamp on={it.on} hover={hover === i} hue={it.quiet ? 3 : colour} />
            <span className="sg-row-label">{it.label}</span>
          </span>
        ))}
      </span>
    </div>
  )
}
