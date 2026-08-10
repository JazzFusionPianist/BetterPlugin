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
  const { releases, shelves, loading, addRelease, moveRelease, updateRelease, deleteRelease, addShelf, renameShelf, deleteShelf } =
    usePortfolio(supabase, owner.id)

  const [selected, setSelected] = useState<string | null>(null)
  const [openRelease, setOpenRelease] = useState<string | null>(null)
  const [composerShelf, setComposerShelf] = useState<string | 'default' | null>(null)
  const [newShelfDraft, setNewShelfDraft] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement>(null)
  const [playingTrack, setPlayingTrack] = useState<string | null>(null)
  const toggleTrack = (id: string, url: string) => {
    const a = audioRef.current
    if (!a) return
    if (playingTrack === id) { a.pause(); setPlayingTrack(null) }
    else { a.src = url; a.play().catch(() => {}); setPlayingTrack(id) }
  }

  const groups = useMemo(() => groupByShelf(releases, shelves), [releases, shelves])

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
        {fmtYear(r)}{r.tracks.length > 0 ? ` · ${r.tracks.length} track${r.tracks.length === 1 ? '' : 's'}` : ''}
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
    <div className="disco">
      <audio ref={audioRef} preload="none" onEnded={() => setPlayingTrack(null)} />

      <header className="disco-head">
        <button className="chatt-back" onClick={onClose} aria-label="Back">
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
                {isMine && g.shelf ? (
                  <input
                    className="disco-shelf-title"
                    defaultValue={g.shelf.title}
                    maxLength={60}
                    onKeyDown={(e) => { if (!e.nativeEvent.isComposing && e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      if (v && v !== g.shelf!.title) renameShelf(g.shelf!.id, v)
                    }}
                  />
                ) : (
                  <span className="disco-shelf-title as-text">{g.shelf?.title ?? 'releases'}</span>
                )}
                {isMine && (
                  <span className="disco-shelf-tools">
                    <button className="disco-shelf-add" onClick={() => setComposerShelf(g.shelf?.id ?? 'default')}>+ release</button>
                    {g.shelf && g.releases.length === 0 && (
                      <button className="disco-shelf-rm" onClick={() => deleteShelf(g.shelf!.id)}>remove</button>
                    )}
                  </span>
                )}
              </div>

              {sel >= 0 && caption(g.releases[sel]!, sel, g.releases.length)}

              {g.releases.length === 0 ? (
                <div className="disco-row-empty">an empty shelf</div>
              ) : (
                <div className="disco-row" role="listbox" aria-label={g.shelf?.title ?? 'releases'}>
                  {g.releases.map((r, i) => (
                    <button
                      key={r.id}
                      className={`disco-rec${selected === r.id ? ' up' : ''}`}
                      style={{ zIndex: g.releases.length - i, animationDelay: `${Math.min(i, 10) * 55}ms` }}
                      onClick={() => setSelected(selected === r.id ? null : r.id)}
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
          playingTrack={playingTrack}
          onToggleTrack={toggleTrack}
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
