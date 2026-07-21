'use client'

import { useRef, useState } from 'react'
import type { CanvasItem, CanvasPatch } from '@orb/core'

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
  // Drag bookkeeping. `justDragged` suppresses the click that follows a
  // drag so a reposition doesn't also open the sheet.
  const drag = useRef<{ id: string; sx: number; sy: number; moved: boolean } | null>(null)
  const justDragged = useRef(false)

  const open = items.find((i) => i.id === openId) ?? null

  const onPointerDown = (e: React.PointerEvent, item: CanvasItem) => {
    if (!isMine) return
    drag.current = { id: item.id, sx: e.clientX, sy: e.clientY, moved: false }
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* ignore */ }
  }
  const onPointerMove = (e: React.PointerEvent, item: CanvasItem) => {
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
  const onPointerUp = (e: React.PointerEvent, item: CanvasItem) => {
    const d = drag.current
    drag.current = null
    if (!d || d.id !== item.id || !d.moved) return
    justDragged.current = true
    const el = e.currentTarget as HTMLElement
    const x = parseFloat(el.dataset.x ?? String(item.x))
    const y = parseFloat(el.dataset.y ?? String(item.y))
    onUpdate(item.id, { x, y })
  }

  return (
    <div className="canvas-layer" ref={layerRef}>
      {items.map((item) => (
        <div
          key={item.id}
          className={`polad${isMine ? ' movable' : ''}`}
          style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%`, transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`, zIndex: item.z }}
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
