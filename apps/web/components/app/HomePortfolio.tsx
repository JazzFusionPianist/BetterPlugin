'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '@orb/core'
import { usePortfolio, groupByShelf, spineTint } from '@/lib/usePortfolio'
import { sampleCoverColor } from '@/lib/coverColor'
import { compressImage, uploadAttachment } from '@/lib/upload'
import { ReleaseSheet, ReleaseComposer, PhotoLightbox, fmtYear } from './PortfolioPage'

interface Props {
  supabase: SupabaseClient
  me: Profile
}

/**
 * Your discography ON the main screen — real shelves. Each shelf is a
 * category you name ("mixed and mastered"); releases sit in it edge-on
 * like LPs, spines only. Clicking a shelf opens its panel: artwork,
 * notes, tracks, reordering, and "+ add release" scoped to that shelf.
 */
export default function HomePortfolio({ supabase, me }: Props) {
  const { releases, shelves, photos, loading, addRelease, moveRelease, updateRelease, deleteRelease, addShelf, renameShelf, deleteShelf, addPhotos, updatePhoto, deletePhoto } =
    usePortfolio(supabase, me.id)

  // 'default' = the unnamed shelf; otherwise a shelf id.
  const [openShelf, setOpenShelf] = useState<string | null>(null)
  const [openRelease, setOpenRelease] = useState<string | null>(null)
  const [composerShelf, setComposerShelf] = useState<string | 'default' | null>(null)
  const [openPhoto, setOpenPhoto] = useState<string | null>(null)
  const [newShelfDraft, setNewShelfDraft] = useState<string | null>(null)
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const audioRef = useRef<HTMLAudioElement>(null)
  const [playingTrack, setPlayingTrack] = useState<string | null>(null)
  const toggleTrack = (id: string, url: string) => {
    const a = audioRef.current
    if (!a) return
    if (playingTrack === id) { a.pause(); setPlayingTrack(null) }
    else { a.src = url; a.play().catch(() => {}); setPlayingTrack(id) }
  }

  const groups = useMemo(() => groupByShelf(releases, shelves), [releases, shelves])

  // Each record's across-the-room colour — the cover's average, sampled
  // once; releases without readable art fall back to their title tint.
  const [coverColors, setCoverColors] = useState<Record<string, string>>({})
  useEffect(() => {
    let cancelled = false
    for (const r of releases) {
      if (!r.cover_url || coverColors[r.id]) continue
      sampleCoverColor(r.cover_url).then((c) => {
        if (!cancelled && c) setCoverColors((prev) => (prev[r.id] ? prev : { ...prev, [r.id]: c }))
      })
    }
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [releases])

  /** Sleeve thickness follows the record — more tracks, fatter spine. */
  const spineWidth = (tracks: number) => 10 + Math.min(8, Math.max(1, tracks)) * 0.9

  const onPickPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setUploadingPhotos(true)
    try {
      const uploaded: { media_url: string }[] = []
      for (const f of files.slice(0, 12)) {
        try {
          const compressed = await compressImage(f)
          const { url } = await uploadAttachment(compressed, me.id)
          uploaded.push({ media_url: url })
        } catch (err) { console.error('[portfolio] photo upload', err) }
      }
      if (uploaded.length) await addPhotos(uploaded)
    } finally { setUploadingPhotos(false) }
  }

  const submitNewShelf = async () => {
    const t = (newShelfDraft ?? '').trim()
    if (!t) { setNewShelfDraft(null); return }
    const ok = await addShelf(t)
    if (ok) setNewShelfDraft(null)
  }

  const release = releases.find((r) => r.id === openRelease) ?? null
  const photo = photos.find((p) => p.id === openPhoto) ?? null
  const panelGroup = openShelf === null ? null
    : groups.find((g) => (g.shelf?.id ?? 'default') === openShelf) ?? null

  return (
    <div className="home-pfolio">
      <audio ref={audioRef} preload="none" onEnded={() => setPlayingTrack(null)} />

      {/* ── Desktop: the shelves — LPs edge-on, spines only. ── */}
      <div className="pfolio-shelf-wrap">
        <div className="pfolio-shelf-label">discography</div>
        {groups.map((g) => {
          const key = g.shelf?.id ?? 'default'
          return (
            <button key={key} className="pfolio-shelfrow" onClick={() => setOpenShelf(key)}>
              <span className="pfolio-shelfunit">
                <span className="pfolio-spines">
                  {g.releases.length === 0 && <span className="pfolio-spine ghost" />}
                  {g.releases.map((r) => (
                    <span
                      key={r.id}
                      className="pfolio-spine"
                      style={{
                        backgroundColor: coverColors[r.id] ?? spineTint(r.title),
                        width: spineWidth(r.tracks.length),
                      }}
                      title={r.title}
                    />
                  ))}
                </span>
                <span className="pfolio-shelfboard" aria-hidden="true" />
              </span>
              <span className="pfolio-shelfcap">
                <span className="pfolio-shelfcap-title">{g.shelf?.title ?? 'releases'}</span>
                <span className="pfolio-shelfcap-count">· {g.releases.length}</span>
              </span>
            </button>
          )
        })}
        {newShelfDraft === null ? (
          <button className="pfolio-newshelf" onClick={() => setNewShelfDraft('')}>+ new shelf</button>
        ) : (
          <input
            className="pfolio-newshelf-input"
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
        )}
      </div>

      {/* ── Phones: booklet page 3 — shelves as sections + gallery. ── */}
      <div className="home-pfolio-book">
        {groups.map((g) => {
          const key = g.shelf?.id ?? 'default'
          return (
            <div key={key}>
              <div className="home-pfolio-labelrow">
                <span className="home-pfolio-label">{g.shelf?.title ?? 'releases'}</span>
                <button className="pfolio-add" onClick={() => setComposerShelf(g.shelf?.id ?? 'default')}>+ release</button>
              </div>
              {g.releases.length === 0 && (
                <div className="home-pfolio-empty">{loading ? '…' : 'empty shelf'}</div>
              )}
              <ol className="home-pfolio-list">
                {g.releases.map((r, i) => (
                  <li key={r.id} className="home-pfolio-item">
                    <button className="home-pfolio-row" onClick={() => setOpenRelease(r.id)}>
                      <span className="home-pfolio-num">{String(i + 1).padStart(2, '0')}</span>
                      <span className="home-pfolio-cover">
                        {r.cover_url
                          ? <img src={r.cover_url} alt="" loading="lazy" />
                          : <span className="pfolio-cover-blank" aria-hidden="true" />}
                      </span>
                      <span className="home-pfolio-info">
                        <span className="home-pfolio-title">{r.title}</span>
                        <span className="home-pfolio-sub">
                          {fmtYear(r)}{r.tracks.length > 0 ? ` · ${r.tracks.length}` : ''}
                        </span>
                      </span>
                    </button>
                    <span className="home-pfolio-order">
                      <button onClick={() => moveRelease(r.id, 'up')} disabled={i === 0} aria-label="Move up">▴</button>
                      <button onClick={() => moveRelease(r.id, 'down')} disabled={i === g.releases.length - 1} aria-label="Move down">▾</button>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )
        })}
        {newShelfDraft === null ? (
          <button className="pfolio-newshelf book" onClick={() => setNewShelfDraft('')}>+ new shelf</button>
        ) : (
          <input
            className="pfolio-newshelf-input book"
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
        )}

        <div className="home-pfolio-labelrow gallery">
          <span className="home-pfolio-label">gallery</span>
          <button className="pfolio-add" onClick={() => photoInputRef.current?.click()} disabled={uploadingPhotos}>
            {uploadingPhotos ? 'uploading…' : '+ photos'}
          </button>
        </div>
        <input ref={photoInputRef} type="file" accept="image/*" multiple hidden onChange={onPickPhotos} />
        {!loading && photos.length === 0 && (
          <div className="home-pfolio-empty">and your photos here</div>
        )}
        <div className="home-pfolio-grid">
          {photos.slice(0, 6).map((p, i) => (
            <button key={p.id} className="pfolio-cell" onClick={() => setOpenPhoto(p.id)}>
              <img src={p.media_url} alt={p.caption ?? ''} loading="lazy" />
              {i === 5 && photos.length > 6 && (
                <span className="home-pfolio-more">+{photos.length - 6}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── The shelf, taken down and opened — artwork and notes. ── */}
      {panelGroup && createPortal(
        <div className="pfolio-overlay" onClick={(e) => { if (e.target === e.currentTarget) setOpenShelf(null) }}>
          <div className="pfolio-sheet pfolio-shelfpanel">
            <div className="pfolio-shelfpanel-head">
              {panelGroup.shelf ? (
                <span className="pfolio-shelfpanel-titlewrap">
                <input
                  className="pfolio-shelfpanel-title"
                  defaultValue={panelGroup.shelf.title}
                  maxLength={60}
                  onKeyDown={(e) => { if (!e.nativeEvent.isComposing && e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                  onBlur={(e) => {
                    const v = e.target.value.trim()
                    if (v && v !== panelGroup.shelf!.title) renameShelf(panelGroup.shelf!.id, v)
                  }}
                />
                <svg className="pfolio-shelfpanel-pen" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2l2 2-8 8H4v-2l8-8z" /></svg>
                </span>
              ) : (
                <div className="pfolio-shelfpanel-title as-text">releases</div>
              )}
              <span className="pfolio-shelfpanel-count">
                {panelGroup.releases.length} release{panelGroup.releases.length === 1 ? '' : 's'}
              </span>
            </div>

            {panelGroup.releases.length === 0 && (
              <div className="pfolio-empty">an empty shelf — add the first record</div>
            )}
            <div className="pfolio-shelfpanel-grid">
              {panelGroup.releases.map((r, i) => (
                <div key={r.id} className="pfolio-shelfpanel-item">
                  <span className="pfolio-shelfpanel-order">
                    <button onClick={() => moveRelease(r.id, 'up')} disabled={i === 0} aria-label="Move earlier">‹</button>
                    <button onClick={() => moveRelease(r.id, 'down')} disabled={i === panelGroup.releases.length - 1} aria-label="Move later">›</button>
                  </span>
                  <button className="pfolio-shelfpanel-cover" onClick={() => setOpenRelease(r.id)}>
                    {r.cover_url
                      ? <img src={r.cover_url} alt="" loading="lazy" />
                      : <span className="pfolio-cover-blank" aria-hidden="true" />}
                  </button>
                  <div className="pfolio-shelfpanel-item-title">{r.title}</div>
                  <div className="pfolio-shelfpanel-item-sub">
                    {fmtYear(r)}{r.tracks.length > 0 ? ` · ${r.tracks.length} track${r.tracks.length === 1 ? '' : 's'}` : ''}
                  </div>
                  {r.description && <div className="pfolio-shelfpanel-item-note">{r.description}</div>}
                </div>
              ))}
            </div>

            <div className="pfolio-sheet-foot">
              {panelGroup.shelf ? (
                <button
                  className="pfolio-del"
                  onClick={() => {
                    if (confirm('Remove this shelf? Its releases move to the unnamed shelf.')) {
                      deleteShelf(panelGroup.shelf!.id)
                      setOpenShelf(null)
                    }
                  }}
                >remove shelf</button>
              ) : <span />}
              <div className="pfolio-shelfpanel-actions">
                <button className="pfolio-add" onClick={() => setComposerShelf(panelGroup.shelf?.id ?? 'default')}>+ add release</button>
                <button className="pfolio-close" onClick={() => setOpenShelf(null)}>close</button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {release && (
        <ReleaseSheet
          release={release}
          isMine
          playingTrack={playingTrack}
          onToggleTrack={toggleTrack}
          onUpdate={updateRelease}
          onDelete={(id) => { deleteRelease(id); setOpenRelease(null) }}
          onClose={() => setOpenRelease(null)}
        />
      )}

      {composerShelf !== null && (
        <ReleaseComposer
          currentUserId={me.id}
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

      {photo && (
        <PhotoLightbox
          photo={photo}
          isMine
          onCaption={(c) => updatePhoto(photo.id, c)}
          onDelete={() => { deletePhoto(photo.id); setOpenPhoto(null) }}
          onClose={() => setOpenPhoto(null)}
        />
      )}
    </div>
  )
}
