import { useEffect, useRef, useState } from 'react'

/*  The study's hands — the rows under the big print.

    Every parameter is one row: its name at the left, the control at the
    right, a hairline under it. On a number row the hairline IS the
    gauge — it fills, in the print's own ink, as far as the value.
    Drag a number (up or right = more), double-click it to type, ⌥-click
    it to rest. A choice is a hairline segment; on/off is a switch.      */

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

const quant = (v: number, step: number) => {
  const q = Math.round(v / step) * step
  const dec = step >= 1 ? 0 : Math.min(6, Math.ceil(-Math.log10(step)))
  return Number(q.toFixed(dec))
}

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

/* ── one row ─────────────────────────────────────────────────────────── */

export function GaugeRow ({ label, value, min, max, step = 1, bipolar, unit, format, parse, defaultValue, onChange, fine }: {
  label: string
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
}) {
  const text = format ? format(value) : `${quant(value, step)}${unit ? ' ' + unit : ''}`
  const commit = (v: number) => onChange(clamp(quant(v, step), min, max), true)
  const typing = useTypeIn({ text, parse: parse ?? parseLead, commit, reset: () => onChange(defaultValue, true) })
  const drag = useRef<{ x0: number; y0: number; v0: number; last: number; moved: boolean } | null>(null)
  const [live, setLive] = useState(false)
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
  const left = Math.min(f, zero), width = Math.abs(f - zero)
  return (
    <div ref={rowRef} className={`sg-row gauge${live ? ' live' : ''}${typing.editing ? ' typing' : ''}`}
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
      <span className="sg-row-label">{label}</span>
      <span className="sg-row-ctl"><span className="sg-num">{typing.input ?? text}</span></span>
      <i className="sg-rule"><i className="sg-fill" style={{ left: `${left * 100}%`, width: `${width * 100}%` }} /></i>
    </div>
  )
}

export function ChoiceRow ({ label, options, value, onPick, fill }: {
  label: string
  options: string[]
  value: number
  onPick: (i: number) => void
  fill?: boolean              // the cells share the row's width evenly (a keyboard)
}) {
  const asList = !fill && options.length > 8
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    document.addEventListener('pointerdown', close, true)
    return () => document.removeEventListener('pointerdown', close, true)
  }, [open])
  return (
    <div className="sg-row choice" onPointerDown={(e) => e.stopPropagation()}>
      <span className="sg-row-label">{label}</span>
      <span className="sg-row-ctl">
        {asList
          ? (
            <span className={`sg-seg list${open ? ' open' : ''}`}>
              <span className="sg-seg-cell on pick" onPointerDown={(e) => { e.stopPropagation(); setOpen(v => !v) }}>
                {options[value] ?? ''}<span className="sg-pick-arrow">▾</span>
              </span>
              {open && (
                <span className="sg-pick-list" onPointerDown={(e) => e.stopPropagation()}>
                  {options.map((o, i) => (
                    <span key={o} className={`sg-pick-row${i === value ? ' on' : ''}`}
                      onPointerDown={(e) => { e.stopPropagation(); onPick(i); setOpen(false) }}>{o}</span>
                  ))}
                </span>
              )}
            </span>
          )
          : (
            <span className={`sg-seg${fill ? ' fill' : ''}`}>
              {options.map((o, i) => (
                <span key={o} className={`sg-seg-cell${i === value ? ' on' : ''}`}
                  onPointerDown={(e) => { e.stopPropagation(); if (i !== value) onPick(i) }}>{o}</span>
              ))}
            </span>
          )}
      </span>
      <i className="sg-rule" />
    </div>
  )
}

export function SwitchRow ({ items }: { items: Array<{ label: string; on: boolean; set: (on: boolean) => void; quiet?: boolean }> }) {
  if (items.length === 0) return null
  return (
    <div className="sg-row switches" onPointerDown={(e) => e.stopPropagation()}>
      <span className="sg-row-ctl">
        {items.map(it => (
          <span key={it.label} className={`sg-sw-item${it.on ? ' on' : ''}`} onPointerDown={(e) => { e.stopPropagation(); it.set(!it.on) }}>
            <span className="sg-row-label">{it.label}</span>
            <span className={`sg-switch${it.on ? ' on' : ''}${it.quiet ? ' quiet' : ''}`}><i /></span>
          </span>
        ))}
      </span>
      <i className="sg-rule" />
    </div>
  )
}
