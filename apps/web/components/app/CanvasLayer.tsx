'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import type { CanvasItem, CanvasPatch } from '@orb/core'
import { strokePath, strokePathScaled, strokesBBox } from '@/lib/strokes'

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

  /** The item's resting transform (what render also sets). */
  const baseTransform = (item: CanvasItem, s: number) =>
    item.kind === 'drawing'
      ? `translate(-50%, -50%) scale(${s})`
      : `translate(-50%, -50%) rotate(${item.rotation}deg) scale(${s})`

  const onPointerDown = (e: React.PointerEvent, item: CanvasItem) => {
    if (!isMine) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* ignore */ }
    // Second finger on the same item → stop dragging, start resizing.
    if (pointers.current.size === 2 && drag.current?.id === item.id) {
      drag.current = null
      pinch.current = { id: item.id, d0: pointerDist(), s0: item.scale ?? 1, live: item.scale ?? 1 }
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
    const rect = layerRef.current?.getBoundingClientRect()
    if (!d || d.id !== item.id || !rect) return
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 5) return
    d.moved = true
    const x = Math.min(0.95, Math.max(0.05, (e.clientX - rect.left) / rect.width))
    const y = Math.min(0.95, Math.max(0.05, (e.clientY - rect.top) / rect.height))
    const el = e.currentTarget as HTMLElement
    el.style.left = `${x * 100}%`
    el.style.top = `${y * 100}%`
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
        if (Math.abs(pz.live - (item.scale ?? 1)) > 0.01) onUpdate(item.id, { scale: pz.live })
      }
      return
    }
    const d = drag.current
    drag.current = null
    if (!d || d.id !== item.id || !d.moved) return
    justDragged.current = true
    const el = e.currentTarget as HTMLElement
    const fx = parseFloat(el.dataset.x ?? String(item.x))
    const fy = parseFloat(el.dataset.y ?? String(item.y))
    onUpdate(item.id, commit ? commit(fx, fy) : { x: fx, y: fy })
  }

  const doodles = items.filter((i) => i.kind === 'drawing' && i.strokes?.length)
  const pinned = items.filter((i) => i.kind !== 'drawing')

  return (
    <div className="canvas-layer" ref={layerRef}>
      {/* Doodles — each drawing is its own movable object. Strokes are
          absolute canvas fractions; item.x/y hold a drag offset from the
          drawn spot (0.5,0.5 = untouched), so old drawings stay put. */}
      {doodles.map((item) => {
        const bb = strokesBBox(item.strokes!)
        const bcx = bb.x + bb.w / 2, bcy = bb.y + bb.h / 2
        const cx = bcx + (item.x - 0.5), cy = bcy + (item.y - 0.5)
        return (
          <div
            key={item.id}
            className={`doodle${isMine ? ' movable' : ''}`}
            style={{ left: `${cx * 100}%`, top: `${cy * 100}%`, width: `${bb.w * 100}%`, height: `${bb.h * 100}%`, zIndex: item.z, transform: baseTransform(item, item.scale ?? 1) }}
            onPointerDown={(e) => onPointerDown(e, item)}
            onPointerMove={(e) => onPointerMove(e, item)}
            onPointerUp={(e) => onPointerUp(e, item, (fx, fy) => ({ x: 0.5 + fx - bcx, y: 0.5 + fy - bcy }))}
            onClick={() => {
              if (justDragged.current) { justDragged.current = false; return }
              setOpenId(item.id)
            }}
            role="button"
            aria-label={item.title || 'Drawing'}
          >
            {/* No viewBox — svg units are pixels of the doodle box. */}
            <svg width="100%" height="100%">
              {dims && (item.strokes ?? []).map((s, i) => (
                <path key={i} d={strokePathScaled(s.p, dims.w, dims.h, bb.x, bb.y, s.r === 1)}
                  fill="none" stroke={s.c} strokeWidth={s.w}
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
      {pinned.map((item) => (
        <div
          key={item.id}
          className={`polad${isMine ? ' movable' : ''}`}
          style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%`, transform: baseTransform(item, item.scale ?? 1), zIndex: item.z }}
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
 *  and (yours only) privacy toggle + delete. */
function PoladSheet({ item, isMine, onUpdate, onDelete, onClose }: {
  item: CanvasItem
  isMine: boolean
  onUpdate: (id: string, patch: CanvasPatch) => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  return (
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
              <button className="polad-del" onClick={() => onDelete(item.id)} aria-label="Remove">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2.5 2.5l9 9M11.5 2.5l-9 9" /></svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
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
