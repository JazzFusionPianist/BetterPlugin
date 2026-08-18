'use client'

import { useMemo, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '@orb/core'
import { usePortfolio, groupByShelf, spineTint, type Release } from '@/lib/usePortfolio'
import { ReleaseSheet, ReleaseComposer, fmtYear } from './PortfolioPage'

interface Props {
  supabase: SupabaseClient
  owner: Profile
  isMine: boolean
  onClose: () => void
}

/**
 * The discography, opened — every shelf is a horizontal run of vinyl
 * laid face-on and overlapping like records in a crate. Scroll a row
 * sideways to flip through; tap a record and it rises, printing its
 * title and notes above the row. Tap it again to open the release.
 */
export default function DiscographyPanel({ supabase, owner, isMine, onClose }: Props) {
  const { releases, shelves, loading, addRelease, moveRelease, updateRelease, deleteRelease, addShelf, reorderShelf, nameDefaultShelf, renameShelf, deleteShelf } =
    usePortfolio(supabase, owner.id)

  // Slide back out before unmounting — the reverse of the entrance.
  const [closing, setClosing] = useState(false)
  const requestClose = () => {
    if (closing) return
    setClosing(true)
    setTimeout(onClose, 240)
  }

  const [selected, setSelected] = useState<string | null>(null)
  // The last risen record — kept so the caption can animate closed with
  // its text still printed, instead of vanishing mid-collapse.
  const [lastCapId, setLastCapId] = useState<string | null>(null)
  const pick = (id: string) => {
    if (selected === id) { setSelected(null) } else { setSelected(id); setLastCapId(id) }
  }
  const [openRelease, setOpenRelease] = useState<string | null>(null)
  const [composerShelf, setComposerShelf] = useState<string | 'default' | null>(null)
  const [newShelfDraft, setNewShelfDraft] = useState<string | null>(null)

  const groups = useMemo(() => groupByShelf(releases, shelves), [releases, shelves])

  // ── Arrange mode: one shelf at a time spreads its records out and
  // lets them be dragged into a new order (iOS home-screen style).
  const [arranging, setArranging] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragDx, setDragDx] = useState(0)
  const [dragTarget, setDragTarget] = useState<number | null>(null)
  const dragRef = useRef<{ id: string; startX: number; origIdx: number; slot: number } | null>(null)

  const startArrange = (key: string) => {
    setArranging(key)
    setSelected(null)
  }
  const endArrange = () => { setArranging(null); setDragId(null); setDragTarget(null) }

  const onRecPointerDown = (e: React.PointerEvent, id: string, idx: number) => {
    if (!arranging) return
    const el = e.currentTarget as HTMLElement
    try { el.setPointerCapture(e.pointerId) } catch { /* ignore */ }
    // slot = one record's footprint in the spread row (width + gap)
    const slot = el.offsetWidth + 12
    dragRef.current = { id, startX: e.clientX, origIdx: idx, slot }
    setDragId(id)
    setDragDx(0)
    setDragTarget(idx)
  }
  const onRecPointerMove = (e: React.PointerEvent, count: number) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.startX
    setDragDx(dx)
    const target = Math.min(count - 1, Math.max(0, Math.round(d.origIdx + dx / d.slot)))
    setDragTarget(target)
  }
  const onRecPointerUp = (ids: string[]) => {
    const d = dragRef.current
    dragRef.current = null
    if (!d) return
    const target = dragTarget ?? d.origIdx
    setDragId(null)
    setDragDx(0)
    setDragTarget(null)
    if (target !== d.origIdx) {
      const next = [...ids]
      const [moved] = next.splice(d.origIdx, 1)
      next.splice(target, 0, moved!)
      reorderShelf(next)
    }
  }

  /** While dragging, every other record steps aside toward the gap. */
  const arrangeShift = (idx: number): number => {
    const d = dragRef.current
    if (!d || dragTarget === null) return 0
    if (idx === d.origIdx) return 0
    if (d.origIdx < idx && idx <= dragTarget) return -d.slot
    if (dragTarget <= idx && idx < d.origIdx) return d.slot
    return 0
  }

  const submitNewShelf = async () => {
    const t = (newShelfDraft ?? '').trim()
    if (!t) { setNewShelfDraft(null); return }
    const ok = await addShelf(t)
    if (ok) setNewShelfDraft(null)
  }

  const open = releases.find((r) => r.id === openRelease) ?? null

  const caption = (r: Release, idx: number, count: number) => (
    <div className="disco-caption" key={r.id}>
      <div className="disco-caption-title">{r.title}</div>
      <div className="disco-caption-sub">
        {fmtYear(r)}{r.artist ? ` · ${r.artist}` : ''}{r.tracks.length > 0 ? ` · ${r.tracks.length} track${r.tracks.length === 1 ? '' : 's'}` : ''}
      </div>
      {r.description && <div className="disco-caption-note">{r.description}</div>}
      <div className="disco-caption-actions">
        <button className="disco-caption-open" onClick={(e) => { e.stopPropagation(); setOpenRelease(r.id) }}>
          open release
        </button>
        {isMine && (
          <span className="disco-caption-order">
            <button onClick={(e) => { e.stopPropagation(); moveRelease(r.id, 'up') }} disabled={idx === 0} aria-label="Move earlier">‹</button>
            <button onClick={(e) => { e.stopPropagation(); moveRelease(r.id, 'down') }} disabled={idx === count - 1} aria-label="Move later">›</button>
          </span>
        )}
      </div>
    </div>
  )

  return (
    <div className={`disco${closing ? ' closing' : ''}`}>
      <header className="disco-head">
        <button className="chatt-back" onClick={requestClose} aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <span className="disco-head-title">discography</span>
        <span className="disco-head-owner">{owner.display_name}</span>
      </header>

      <div className="disco-scroll">
        {!loading && releases.length === 0 && shelves.length === 0 && (
          <div className="disco-empty">
            {isMine ? 'nothing here yet — add your first release' : 'nothing here yet'}
          </div>
        )}

        {groups.map((g) => {
          const key = g.shelf?.id ?? 'default'
          const sel = g.releases.findIndex((r) => r.id === selected)
          return (
            <section key={key} className="disco-shelf">
              <div className="disco-shelf-head">
                {isMine ? (
                  <input
                    className="disco-shelf-title"
                    defaultValue={g.shelf?.title ?? 'releases'}
                    maxLength={60}
                    onKeyDown={(e) => { if (!e.nativeEvent.isComposing && e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      if (!v) return
                      if (g.shelf) {
                        if (v !== g.shelf.title) renameShelf(g.shelf.id, v)
                      } else if (v !== 'releases') {
                        // naming the unnamed shelf turns it into a real one
                        nameDefaultShelf(v)
                      }
                    }}
                  />
                ) : (
                  <span className="disco-shelf-title as-text">{g.shelf?.title ?? 'releases'}</span>
                )}
                {isMine && (
                  <span className="disco-shelf-tools">
                    {g.releases.length > 1 && (
                      arranging === key ? (
                        <button className="disco-shelf-add" onClick={endArrange}>done</button>
                      ) : (
                        <button className="disco-shelf-arrange" onClick={() => startArrange(key)}>arrange</button>
                      )
                    )}
                    <button className="disco-shelf-add" onClick={() => setComposerShelf(g.shelf?.id ?? 'default')}>+ release</button>
                    {g.shelf && g.releases.length === 0 && (
                      <button className="disco-shelf-rm" onClick={() => deleteShelf(g.shelf!.id)}>remove</button>
                    )}
                  </span>
                )}
              </div>

              {(() => {
                const capIdx = g.releases.findIndex((r) => r.id === lastCapId)
                return (
                  <div className={`disco-capwrap${sel >= 0 ? ' show' : ''}`}>
                    <div className="disco-capclip">
                      {capIdx >= 0 && caption(g.releases[capIdx]!, capIdx, g.releases.length)}
                    </div>
                  </div>
                )
              })()}

              {g.releases.length === 0 ? (
                <div className="disco-row-empty">an empty shelf</div>
              ) : (
                <div
                  className={`disco-row${arranging === key ? ' arranging' : ''}`}
                  role="listbox"
                  aria-label={g.shelf?.title ?? 'releases'}
                >
                  {g.releases.map((r, i) => (
                    <button
                      key={r.id}
                      className={`disco-rec${selected === r.id ? ' up' : ''}${dragId === r.id ? ' dragging' : ''}`}
                      style={{
                        zIndex: dragId === r.id ? 120 : g.releases.length - i,
                        animationDelay: `${Math.min(i, 10) * 55}ms`,
                        transform: arranging === key
                          ? (dragId === r.id ? `translateX(${dragDx}px) scale(1.05)` : `translateX(${arrangeShift(i)}px)`)
                          : undefined,
                      }}
                      onClick={() => { if (!arranging) pick(r.id) }}
                      onPointerDown={(e) => onRecPointerDown(e, r.id, i)}
                      onPointerMove={(e) => onRecPointerMove(e, g.releases.length)}
                      onPointerUp={() => onRecPointerUp(g.releases.map((x) => x.id))}
                      onPointerCancel={() => onRecPointerUp(g.releases.map((x) => x.id))}
                      aria-label={r.title}
                    >
                      <span className="disco-rec-vinyl" aria-hidden="true" />
                      {r.cover_url ? (
                        <img className="disco-rec-label" src={r.cover_url} alt="" loading="lazy" draggable={false} />
                      ) : (
                        <span className="disco-rec-label tint" style={{ background: spineTint(r.title) }} />
                      )}
                      <span className="disco-rec-hole" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
            </section>
          )
        })}

        {isMine && (
          newShelfDraft === null ? (
            <button className="disco-newshelf" onClick={() => setNewShelfDraft('')}>+ new shelf</button>
          ) : (
            <input
              className="disco-newshelf-input"
              placeholder="name this shelf…"
              value={newShelfDraft}
              maxLength={60}
              autoFocus
              onChange={(e) => setNewShelfDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return
                if (e.key === 'Enter') submitNewShelf()
                if (e.key === 'Escape') setNewShelfDraft(null)
              }}
              onBlur={submitNewShelf}
            />
          )
        )}
      </div>

      {open && (
        <ReleaseSheet
          release={open}
          isMine={isMine}
          onUpdate={updateRelease}
          onDelete={(id) => { deleteRelease(id); setOpenRelease(null); setSelected(null) }}
          onClose={() => setOpenRelease(null)}
        />
      )}

      {composerShelf !== null && (
        <ReleaseComposer
          currentUserId={owner.id}
          onCreate={async (input) => {
            const ok = await addRelease({
              ...input,
              shelf_id: composerShelf === 'default' ? null : composerShelf,
            })
            if (ok) setComposerShelf(null)
            return ok
          }}
          onClose={() => setComposerShelf(null)}
        />
      )}
    </div>
  )
}
