'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CanvasItem, CanvasPatch } from '@orb/core'
import { strokePath, strokePathScaled, strokesBBox } from '@/lib/strokes'
import { WALL_REF_W, wallSheet } from '@/lib/wall'

interface Props {
  items: CanvasItem[]
  isMine: boolean
  onUpdate: (id: string, patch: CanvasPatch) => void
  onDelete: (id: string) => void
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })

/**
 * The wall: photos pinned to the home page like polaroids, drifting orbs
 * passing behind them. Your own can be dragged to rearrange and tapped to
 * open a detail card; a friend's are look-only.
 */
export default function CanvasLayer({ items, isMine, onUpdate, onDelete }: Props) {
  const layerRef = useRef<HTMLDivElement>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  // Layer pixel size — doodle strokes render in raw pixels (Safari's
  // vector-effect:non-scaling-stroke is unreliable under non-uniform
  // viewBox scaling, so we never rely on it here). Measured from LAYOUT
  // (offsetWidth), not getBoundingClientRect — the home zoom wraps this
  // layer in a CSS scale and visual measurements would double-scale ink.
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)
  useLayoutEffect(() => {
    const el = layerRef.current
    if (!el) return
    const measure = () => {
      if (el.offsetWidth > 0) setDims({ w: el.offsetWidth, h: el.offsetHeight })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // Drag bookkeeping. `justDragged` suppresses the click that follows a
  // drag so a reposition doesn't also open the sheet.
  const drag = useRef<{ id: string; sx: number; sy: number; moved: boolean } | null>(null)
  const justDragged = useRef(false)
  // Two fingers on one item = pinch-resize it (yours only).
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinch = useRef<{ id: string; d0: number; s0: number; live: number } | null>(null)

  const pointerDist = () => {
    const pts = [...pointers.current.values()]
    return pts.length < 2 ? 0 : Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y)
  }

  const open = items.find((i) => i.id === openId) ?? null

  // The page: portrait screens read the 2:3 sheet via x/y/scale, wide
  // screens read the 3:2 sheet via lx/ly/lscale (falling back to the
  // portrait values until arranged there).
  const sheet = dims ? wallSheet(dims.w, dims.h) : null
  // Polaroid layout size and stroke widths are in reference px; K makes
  // them grow with the sheet so the picture scales as one object.
  const K = sheet ? sheet.unit / WALL_REF_W : 1

  const ix = (item: CanvasItem) => (sheet?.land ? item.lx ?? item.x : item.x)
  const iy = (item: CanvasItem) => (sheet?.land ? item.ly ?? item.y : item.y)
  const iscale = (item: CanvasItem) => (sheet?.land ? item.lscale ?? item.scale ?? 1 : item.scale ?? 1)
  const posPatch = (fx: number, fy: number): CanvasPatch =>
    sheet?.land ? { lx: fx, ly: fy } : { x: fx, y: fy }
  const scalePatch = (s: number): CanvasPatch =>
    sheet?.land ? { lscale: s } : { scale: s }

  /** The item's resting transform (what render also sets). Doodle boxes
   *  already scale with the sheet, so only polaroids need K here. */
  const baseTransform = (item: CanvasItem, s: number) =>
    item.kind === 'drawing'
      ? `translate(-50%, -50%) scale(${s})`
      : `translate(-50%, -50%) rotate(${item.rotation}deg) scale(${s * K})`

  const onPointerDown = (e: React.PointerEvent, item: CanvasItem) => {
    if (!isMine) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* ignore */ }
    // Second finger on the same item → stop dragging, start resizing.
    if (pointers.current.size === 2 && drag.current?.id === item.id) {
      drag.current = null
      pinch.current = { id: item.id, d0: pointerDist(), s0: iscale(item), live: iscale(item) }
      return
    }
    if (pointers.current.size === 1) {
      drag.current = { id: item.id, sx: e.clientX, sy: e.clientY, moved: false }
    }
  }
  const onPointerMove = (e: React.PointerEvent, item: CanvasItem) => {
    if (pointers.current.has(e.pointerId)) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    }
    const pz = pinch.current
    if (pz && pz.id === item.id && pointers.current.size >= 2 && pz.d0 > 0) {
      pz.live = Math.min(3, Math.max(0.35, pz.s0 * (pointerDist() / pz.d0)))
      ;(e.currentTarget as HTMLElement).style.transform = baseTransform(item, pz.live)
      return
    }
    const d = drag.current
    const layer = layerRef.current
    const rect = layer?.getBoundingClientRect()
    if (!d || d.id !== item.id || !layer || !rect || !sheet) return
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 5) return
    d.moved = true
    // Client → layout px (divide out the home zoom) → sheet fraction.
    const k = rect.width / (layer.offsetWidth || 1)
    const px = (e.clientX - rect.left) / k
    const py = (e.clientY - rect.top) / k
    const x = Math.min(0.97, Math.max(0.03, (px - sheet.x) / sheet.w))
    const y = Math.min(0.97, Math.max(0.03, (py - sheet.y) / sheet.h))
    const el = e.currentTarget as HTMLElement
    el.style.left = `${sheet.x + x * sheet.w}px`
    el.style.top = `${sheet.y + y * sheet.h}px`
    el.dataset.x = String(x); el.dataset.y = String(y)
  }
  /** Shared drag finish — `commit` maps the dropped centre (canvas
   *  fractions) to whatever the item kind stores in x/y. */
  const onPointerUp = (e: React.PointerEvent, item: CanvasItem, commit?: (fx: number, fy: number) => CanvasPatch) => {
    pointers.current.delete(e.pointerId)
    const pz = pinch.current
    if (pz && pz.id === item.id) {
      // Resize commits when the second-to-last finger lifts.
      if (pointers.current.size < 2) {
        pinch.current = null
        justDragged.current = true
        if (Math.abs(pz.live - iscale(item)) > 0.01) onUpdate(item.id, scalePatch(pz.live))
      }
      return
    }
    const d = drag.current
    drag.current = null
    if (!d || d.id !== item.id || !d.moved) return
    justDragged.current = true
    const el = e.currentTarget as HTMLElement
    const fx = parseFloat(el.dataset.x ?? String(ix(item)))
    const fy = parseFloat(el.dataset.y ?? String(iy(item)))
    onUpdate(item.id, commit ? commit(fx, fy) : posPatch(fx, fy))
  }

  const doodles = items.filter((i) => i.kind === 'drawing' && i.strokes?.length)
  const pinned = items.filter((i) => i.kind !== 'drawing')

  return (
    <div className="canvas-layer" ref={layerRef}>
      {/* Doodles — each drawing is its own movable object. Stroke points
          live in unit-space centred on the doodle's own bbox centre, and
          item x/y (or lx/ly) anchor that centre on the sheet — same
          moving parts as a polaroid. */}
      {sheet && doodles.map((item) => {
        const bb = strokesBBox(item.strokes!)
        return (
          <div
            key={item.id}
            className={`doodle${isMine ? ' movable' : ''}`}
            style={{ left: sheet.x + ix(item) * sheet.w, top: sheet.y + iy(item) * sheet.h, width: bb.w * sheet.unit, height: bb.h * sheet.unit, zIndex: item.z, transform: baseTransform(item, iscale(item)) }}
            onPointerDown={(e) => onPointerDown(e, item)}
            onPointerMove={(e) => onPointerMove(e, item)}
            onPointerUp={(e) => onPointerUp(e, item)}
            onClick={() => {
              if (justDragged.current) { justDragged.current = false; return }
              setOpenId(item.id)
            }}
            role="button"
            aria-label={item.title || 'Drawing'}
          >
            {/* No viewBox — svg units are pixels of the doodle box. */}
            <svg width="100%" height="100%">
              {(item.strokes ?? []).map((s, i) => (
                <path key={i} d={strokePathScaled(s.p, sheet.unit, sheet.unit, bb.x, bb.y, s.r === 1)}
                  fill="none" stroke={s.c} strokeWidth={s.w * K}
                  strokeLinecap="round" strokeLinejoin="round"
                  opacity={s.o ?? 0.9} pointerEvents="none" />
              ))}
            </svg>
            {item.visibility === 'private' && (
              <span className="polad-lock doodle-lock" aria-label="Private">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="11" width="15" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
              </span>
            )}
          </div>
        )
      })}
      {sheet && pinned.map((item) => (
        <div
          key={item.id}
          className={`polad${isMine ? ' movable' : ''}`}
          style={{ left: sheet.x + ix(item) * sheet.w, top: sheet.y + iy(item) * sheet.h, transform: baseTransform(item, iscale(item)), zIndex: item.z }}
          onPointerDown={(e) => onPointerDown(e, item)}
          onPointerMove={(e) => onPointerMove(e, item)}
          onPointerUp={(e) => onPointerUp(e, item)}
          onClick={() => {
            if (justDragged.current) { justDragged.current = false; return }
            setOpenId(item.id)
          }}
          role="button"
          aria-label={item.title || 'Photo'}
        >
          <div className="polad-photo">
            {item.media_url && <img src={item.media_url} alt={item.title || ''} draggable={false} />}
            {item.visibility === 'private' && (
              <span className="polad-lock" aria-label="Private">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="11" width="15" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
              </span>
            )}
          </div>
          <div className="polad-cap">{item.title || <span className="polad-cap-empty">{fmtDate(item.taken_at || item.created_at)}</span>}</div>
        </div>
      ))}

      {open && (
        <PoladSheet
          key={open.id}
          item={open}
          isMine={isMine}
          onUpdate={onUpdate}
          onDelete={(id) => { onDelete(id); setOpenId(null) }}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  )
}

/** Tap a polaroid → its detail card: full photo, title, caption, date,
 *  and (yours only) privacy toggle + delete. Portalled to <body> — the
 *  layer lives inside the transformed .home-zoom wrapper, which traps
 *  position:fixed and stacks under the home-centre block otherwise. */
function PoladSheet({ item, isMine, onUpdate, onDelete, onClose }: {
  item: CanvasItem
  isMine: boolean
  onUpdate: (id: string, patch: CanvasPatch) => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  // Deleting is written out, never an icon that could read as "close":
  // first tap asks, second tap acts.
  const [sure, setSure] = useState(false)
  return createPortal(
    <div className="polad-sheet-overlay" onClick={onClose}>
      <div className="polad-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="polad-sheet-photo">
          {item.media_url && <img src={item.media_url} alt={item.title || ''} />}
          {item.kind === 'drawing' && item.strokes?.length ? (
            <DoodlePreview strokes={item.strokes} />
          ) : null}
        </div>

        {isMine ? (
          <input
            className="polad-sheet-title"
            placeholder="add a title…"
            defaultValue={item.title ?? ''}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            onBlur={(e) => {
              const v = e.target.value.trim()
              if ((item.title ?? '') !== v) onUpdate(item.id, { title: v || null })
            }}
          />
        ) : (
          item.title && <div className="polad-sheet-title polad-ro">{item.title}</div>
        )}

        {isMine ? (
          <textarea
            className="polad-sheet-caption"
            placeholder="write about this moment…"
            defaultValue={item.caption ?? ''}
            rows={2}
            onBlur={(e) => {
              const v = e.target.value.replace(/\s+$/, '')
              if ((item.caption ?? '') !== v) onUpdate(item.id, { caption: v || null })
            }}
          />
        ) : (
          item.caption && <div className="polad-sheet-caption polad-ro">{item.caption}</div>
        )}

        <div className="polad-sheet-foot">
          <span className="polad-sheet-date">{fmtDate(item.taken_at || item.created_at)}</span>
          {isMine && (
            <div className="polad-sheet-actions">
              <button
                className={`polad-vis${item.visibility === 'private' ? ' private' : ''}`}
                onClick={() => onUpdate(item.id, { visibility: item.visibility === 'private' ? 'friends' : 'private' })}
              >
                {item.visibility === 'private' ? 'private' : 'friends'}
              </button>
              <button
                className={`polad-del${sure ? ' sure' : ''}`}
                onClick={() => (sure ? onDelete(item.id) : setSure(true))}
              >
                {sure ? 'sure?' : 'delete'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** The doodle rendered in its detail card — fit to its own box. */
function DoodlePreview({ strokes }: { strokes: NonNullable<CanvasItem['strokes']> }) {
  const bb = strokesBBox(strokes)
  return (
    <svg viewBox={`${bb.x} ${bb.y} ${bb.w} ${bb.h}`} className="polad-sheet-doodle">
      {strokes.map((s, i) => (
        <path key={i} d={strokePath(s.p, s.r === 1)} fill="none" stroke={s.c} strokeWidth={s.w}
          strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" opacity={s.o ?? 0.9} />
      ))}
    </svg>
  )
}
