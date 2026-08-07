'use client'

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '@orb/core'
import { usePortfolio, groupByShelf, type GalleryPhoto, type Release } from '@/lib/usePortfolio'
import { compressImage, uploadAttachment } from '@/lib/upload'

interface Props {
  supabase: SupabaseClient
  currentUserId: string
  owner: Profile & { isOnline?: boolean }
  onClose: () => void
}

export const fmtYear = (r: Release) =>
  r.released_on ? String(new Date(r.released_on + 'T00:00:00').getFullYear()) : new Date(r.created_at).getFullYear().toString()

/** "2026", "2026.3", "2026-03-15", "2026년 3월" → a date, or null. */
export function parseReleaseDate(text: string): string | null {
  const m = text.trim().match(/^(\d{4})(?:[.\-\/년\s]+(\d{1,2}))?(?:[.\-\/월\s]+(\d{1,2}))?/)
  if (!m) return null
  const mo = Math.min(12, Math.max(1, m[2] ? +m[2] : 1))
  const d = Math.min(31, Math.max(1, m[3] ? +m[3] : 1))
  return `${m[1]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).toLowerCase()

/**
 * The artist page — a discography index over a photo gallery, printed
 * like a label's catalogue. Your own page edits in place ("add release",
 * "add photos"); a friend's is the same page, look-only.
 */
export default function PortfolioPage({ supabase, currentUserId, owner, onClose }: Props) {
  const isMine = owner.id === currentUserId
  const { releases, shelves, photos, loading, addRelease, updateRelease, deleteRelease, addPhotos, updatePhoto, deletePhoto } =
    usePortfolio(supabase, owner.id)
  const shelfGroups = groupByShelf(releases, shelves)

  const [openRelease, setOpenRelease] = useState<string | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [openPhoto, setOpenPhoto] = useState<string | null>(null)
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // One player for the whole page.
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playingTrack, setPlayingTrack] = useState<string | null>(null)
  const toggleTrack = (id: string, url: string) => {
    const a = audioRef.current
    if (!a) return
    if (playingTrack === id) { a.pause(); setPlayingTrack(null) }
    else { a.src = url; a.play().catch(() => {}); setPlayingTrack(id) }
  }

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
          const { url } = await uploadAttachment(compressed, currentUserId)
          uploaded.push({ media_url: url })
        } catch (err) { console.error('[portfolio] photo upload', err) }
      }
      if (uploaded.length) await addPhotos(uploaded)
    } finally { setUploadingPhotos(false) }
  }

  const release = releases.find((r) => r.id === openRelease) ?? null
  const photo = photos.find((p) => p.id === openPhoto) ?? null

  return (
    <div className="pfolio">
      <audio ref={audioRef} preload="none" onEnded={() => setPlayingTrack(null)} />

      <header className="pfolio-head">
        <button className="chatt-back" onClick={onClose} aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
      </header>

      <div className="pfolio-scroll">
        {/* ── Masthead ── */}
        <div className="pfolio-mast">
          <div className="pfolio-avatar" style={{ background: owner.avatar_color }}>
            {owner.avatar_url ? <img src={owner.avatar_url} alt="" /> : <span>{owner.initials}</span>}
          </div>
          <h1 className="pfolio-name">{owner.display_name}</h1>
          <div className="pfolio-meta">
            {owner.username ? `@${owner.username}` : ''}
            {owner.member_no != null ? ` · #${String(owner.member_no).padStart(6, '0')}` : ''}
          </div>
        </div>

        {/* ── Discography — one section per shelf ── */}
        {!loading && releases.length === 0 && shelfGroups.length <= 1 && (
          <section className="pfolio-section">
            <div className="pfolio-label-row">
              <h2 className="pfolio-label">discography</h2>
              {isMine && (
                <button className="pfolio-add" onClick={() => setComposerOpen(true)}>+ add release</button>
              )}
            </div>
            <div className="pfolio-empty">{isMine ? 'no releases yet — add your first' : 'no releases yet'}</div>
          </section>
        )}
        {shelfGroups.filter((g) => g.releases.length > 0).map((g) => (
        <section className="pfolio-section" key={g.shelf?.id ?? 'default'}>
          <div className="pfolio-label-row">
            <h2 className="pfolio-label">{g.shelf?.title ?? 'releases'}</h2>
            {isMine && (
              <button className="pfolio-add" onClick={() => setComposerOpen(true)}>+ add release</button>
            )}
          </div>
          <ol className="pfolio-releases">
            {g.releases.map((r, i) => (
              <li key={r.id}>
                <button className="pfolio-release-row" onClick={() => setOpenRelease(r.id)}>
                  <span className="pfolio-release-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="pfolio-cover">
                    {r.cover_url
                      ? <img src={r.cover_url} alt="" loading="lazy" />
                      : <span className="pfolio-cover-blank" aria-hidden="true" />}
                  </span>
                  <span className="pfolio-release-info">
                    <span className="pfolio-release-title">{r.title}</span>
                    <span className="pfolio-release-sub">
                      {fmtYear(r)}{r.tracks.length > 0 ? ` · ${r.tracks.length} track${r.tracks.length === 1 ? '' : 's'}` : ''}
                    </span>
                  </span>
                  <span className="pfolio-release-chev" aria-hidden="true">›</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
        ))}

        {/* ── Gallery ── */}
        <section className="pfolio-section">
          <div className="pfolio-label-row">
            <h2 className="pfolio-label">gallery</h2>
            {isMine && (
              <button className="pfolio-add" onClick={() => photoInputRef.current?.click()} disabled={uploadingPhotos}>
                {uploadingPhotos ? 'uploading…' : '+ add photos'}
              </button>
            )}
          </div>
          <input ref={photoInputRef} type="file" accept="image/*" multiple hidden onChange={onPickPhotos} />
          {!loading && photos.length === 0 && (
            <div className="pfolio-empty">{isMine ? 'no photos yet' : 'nothing here yet'}</div>
          )}
          <div className="pfolio-grid">
            {photos.map((p) => (
              <button key={p.id} className="pfolio-cell" onClick={() => setOpenPhoto(p.id)}>
                <img src={p.media_url} alt={p.caption ?? ''} loading="lazy" />
              </button>
            ))}
          </div>
        </section>

        {owner.username && <div className="pfolio-colophon">@{owner.username}</div>}
      </div>

      {release && (
        <ReleaseSheet
          release={release}
          isMine={isMine}
          playingTrack={playingTrack}
          onToggleTrack={toggleTrack}
          onUpdate={updateRelease}
          onDelete={(id) => { deleteRelease(id); setOpenRelease(null) }}
          onClose={() => setOpenRelease(null)}
        />
      )}

      {composerOpen && (
        <ReleaseComposer
          currentUserId={currentUserId}
          onCreate={async (input) => {
            const ok = await addRelease(input)
            if (ok) setComposerOpen(false)
            return ok
          }}
          onClose={() => setComposerOpen(false)}
        />
      )}

      {photo && (
        <PhotoLightbox
          photo={photo}
          isMine={isMine}
          onCaption={(c) => updatePhoto(photo.id, c)}
          onDelete={() => { deletePhoto(photo.id); setOpenPhoto(null) }}
          onClose={() => setOpenPhoto(null)}
        />
      )}
    </div>
  )
}

/** A release opened — cover, notes, playable tracklist. */
export function ReleaseSheet({ release, isMine, playingTrack, onToggleTrack, onUpdate, onDelete, onClose }: {
  release: Release
  isMine: boolean
  playingTrack: string | null
  onToggleTrack: (id: string, url: string) => void
  onUpdate: (id: string, patch: Partial<Pick<Release, 'title' | 'description' | 'released_on'>>) => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  return createPortal(
    <div className="pfolio-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pfolio-sheet">
        <div className="pfolio-sheet-cover">
          {release.cover_url
            ? <img src={release.cover_url} alt="" />
            : <span className="pfolio-cover-blank big" aria-hidden="true" />}
        </div>
        {isMine ? (
          <input
            className="pfolio-sheet-title"
            defaultValue={release.title}
            maxLength={120}
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v && v !== release.title) onUpdate(release.id, { title: v })
            }}
          />
        ) : (
          <div className="pfolio-sheet-title as-text">{release.title}</div>
        )}
        <div className="pfolio-sheet-year">{fmtYear(release)}</div>

        {(release.description || isMine) && (
          isMine ? (
            <textarea
              className="pfolio-sheet-desc"
              placeholder="liner notes…"
              defaultValue={release.description ?? ''}
              rows={3}
              onBlur={(e) => {
                const v = e.target.value.replace(/\s+$/, '')
                if ((release.description ?? '') !== v) onUpdate(release.id, { description: v || null })
              }}
            />
          ) : (
            <div className="pfolio-sheet-desc as-text">{release.description}</div>
          )
        )}

        {release.tracks.length > 0 && (
          <ol className="pfolio-tracks">
            {release.tracks.map((t, i) => (
              <li key={t.id}>
                <button
                  className={`pfolio-track${playingTrack === t.id ? ' on' : ''}`}
                  onClick={() => onToggleTrack(t.id, t.media_url)}
                >
                  <span className="pfolio-track-num">{i + 1}</span>
                  <span className="pfolio-track-title">{t.title}</span>
                  <span className="pfolio-track-play" aria-hidden="true">
                    {playingTrack === t.id ? (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                    ) : (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}

        <div className="pfolio-sheet-foot">
          {isMine && <button className="pfolio-del" onClick={() => { if (confirm('Delete this release?')) onDelete(release.id) }}>delete release</button>}
          <button className="pfolio-close" onClick={onClose}>close</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** New release — cover, title, date, notes, audio files as the tracklist. */
export function ReleaseComposer({ currentUserId, onCreate, onClose }: {
  currentUserId: string
  onCreate: (input: { title: string; cover_url?: string | null; description?: string | null; released_on?: string | null; tracks: { title: string; media_url: string }[] }) => Promise<boolean>
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [desc, setDesc] = useState('')
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [coverBusy, setCoverBusy] = useState(false)
  const [tracks, setTracks] = useState<{ title: string; media_url: string }[]>([])
  const [trackBusy, setTrackBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const coverRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLInputElement>(null)

  const onPickCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setCoverBusy(true)
    try {
      const compressed = await compressImage(file)
      const { url } = await uploadAttachment(compressed, currentUserId)
      setCoverUrl(url)
    } catch (err) { console.error('[portfolio] cover upload', err) }
    finally { setCoverBusy(false) }
  }

  const onPickAudio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setTrackBusy(true)
    try {
      for (const f of files.slice(0, 20)) {
        try {
          const { url } = await uploadAttachment(f, currentUserId)
          setTracks((prev) => [...prev, { title: f.name.replace(/\.[^.]+$/, ''), media_url: url }])
        } catch (err) { console.error('[portfolio] track upload', err) }
      }
    } finally { setTrackBusy(false) }
  }

  const submit = async () => {
    if (!title.trim() || saving) return
    setSaving(true)
    const ok = await onCreate({
      title: title.trim(),
      cover_url: coverUrl,
      description: desc.trim() || null,
      released_on: date.trim() ? parseReleaseDate(date) : null,
      tracks,
    })
    if (!ok) setSaving(false)
  }

  return createPortal(
    <div className="pfolio-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pfolio-sheet pfolio-composer">
        <div className="pfolio-composer-head">new release</div>

        <button className="pfolio-coverpick" onClick={() => coverRef.current?.click()} disabled={coverBusy}>
          {coverUrl
            ? <img src={coverUrl} alt="" />
            : <span className="pfolio-coverpick-hint">{coverBusy ? 'uploading…' : 'cover art'}</span>}
        </button>
        <input ref={coverRef} type="file" accept="image/*" hidden onChange={onPickCover} />

        <input
          className="pfolio-sheet-title"
          placeholder="release title…"
          value={title}
          maxLength={120}
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="pfolio-datein"
          type="text"
          inputMode="numeric"
          placeholder="released — 2026 or 2026.03.15"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Release date"
        />
        <textarea
          className="pfolio-sheet-desc"
          placeholder="liner notes…"
          value={desc}
          rows={2}
          onChange={(e) => setDesc(e.target.value)}
        />

        {tracks.length > 0 && (
          <ol className="pfolio-tracks composer">
            {tracks.map((t, i) => (
              <li key={i} className="pfolio-track as-row">
                <span className="pfolio-track-num">{i + 1}</span>
                <input
                  className="pfolio-track-edit"
                  value={t.title}
                  maxLength={120}
                  onChange={(e) => setTracks((prev) => prev.map((x, xi) => xi === i ? { ...x, title: e.target.value } : x))}
                />
                <button
                  className="pfolio-track-rm"
                  onClick={() => setTracks((prev) => prev.filter((_, xi) => xi !== i))}
                  aria-label="Remove track"
                >✕</button>
              </li>
            ))}
          </ol>
        )}
        <button className="pfolio-add" onClick={() => audioRef.current?.click()} disabled={trackBusy}>
          {trackBusy ? 'uploading…' : '+ add tracks'}
        </button>
        <input ref={audioRef} type="file" accept="audio/*" multiple hidden onChange={onPickAudio} />

        <div className="pfolio-sheet-foot">
          <button className="pfolio-close" onClick={onClose}>cancel</button>
          <button className="pfolio-publish" onClick={submit} disabled={!title.trim() || saving || coverBusy || trackBusy}>
            {saving ? 'publishing…' : 'publish'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** A gallery photo, full size — caption below, editable on your own page. */
export function PhotoLightbox({ photo, isMine, onCaption, onDelete, onClose }: {
  photo: GalleryPhoto
  isMine: boolean
  onCaption: (caption: string | null) => void
  onDelete: () => void
  onClose: () => void
}) {
  return createPortal(
    <div className="pfolio-overlay dark" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pfolio-lightbox">
        <img src={photo.media_url} alt={photo.caption ?? ''} />
        {isMine ? (
          <input
            className="pfolio-lightbox-cap"
            placeholder="write a caption…"
            defaultValue={photo.caption ?? ''}
            maxLength={500}
            onKeyDown={(e) => { if (e.nativeEvent.isComposing) return; if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            onBlur={(e) => {
              const v = e.target.value.trim()
              if ((photo.caption ?? '') !== v) onCaption(v || null)
            }}
          />
        ) : (
          photo.caption && <div className="pfolio-lightbox-cap as-text">{photo.caption}</div>
        )}
        <div className="pfolio-lightbox-foot">
          <span className="pfolio-lightbox-date">{fmtDate(photo.created_at)}</span>
          {isMine && (
            <button className="pfolio-del" onClick={() => { if (confirm('Delete this photo?')) onDelete() }}>delete</button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
