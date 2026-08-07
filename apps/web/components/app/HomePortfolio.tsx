'use client'

import { useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '@orb/core'
import { usePortfolio } from '@/lib/usePortfolio'
import { compressImage, uploadAttachment } from '@/lib/upload'
import { ReleaseSheet, ReleaseComposer, PhotoLightbox, fmtYear } from './PortfolioPage'

interface Props {
  supabase: SupabaseClient
  me: Profile
}

/**
 * Your portfolio, living ON the main screen — the discography column
 * bound to the right page edge on desktop (mirroring the programme
 * column on the left), a full booklet page on phones. Rows open the
 * same release sheet / composer / lightbox as the visitor page.
 */
export default function HomePortfolio({ supabase, me }: Props) {
  const { releases, photos, loading, addRelease, moveRelease, updateRelease, deleteRelease, addPhotos, updatePhoto, deletePhoto } =
    usePortfolio(supabase, me.id)

  const [openRelease, setOpenRelease] = useState<string | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [openPhoto, setOpenPhoto] = useState<string | null>(null)
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

  const release = releases.find((r) => r.id === openRelease) ?? null
  const photo = photos.find((p) => p.id === openPhoto) ?? null

  return (
    <div className="home-pfolio">
      <audio ref={audioRef} preload="none" onEnded={() => setPlayingTrack(null)} />

      {/* ── Desktop: the record shelf — covers standing on hairlines,
          bottom-right of the room. Hover lifts a cover and prints its
          caption; ‹ › reorder; the dashed slot adds. ── */}
      <div className="pfolio-shelf-wrap">
        <div className="pfolio-shelf-label">discography</div>
        <div className="pfolio-shelf">
          {releases.map((r, i) => (
            <div key={r.id} className="pfolio-shelf-slot">
              <span className="pfolio-shelf-order">
                <button
                  onClick={() => moveRelease(r.id, 'up')}
                  disabled={i === 0}
                  aria-label="Move earlier"
                >‹</button>
                <button
                  onClick={() => moveRelease(r.id, 'down')}
                  disabled={i === releases.length - 1}
                  aria-label="Move later"
                >›</button>
              </span>
              <button className="pfolio-shelf-cover" onClick={() => setOpenRelease(r.id)} aria-label={r.title}>
                {r.cover_url
                  ? <img src={r.cover_url} alt="" loading="lazy" />
                  : <span className="pfolio-cover-blank" aria-hidden="true" />}
              </button>
              <span className="pfolio-shelf-cap">{r.title} — {fmtYear(r)}</span>
            </div>
          ))}
          <div className="pfolio-shelf-slot">
            <button className="pfolio-shelf-add" onClick={() => setComposerOpen(true)} aria-label="Add release">+</button>
            {releases.length === 0 && (
              <span className="pfolio-shelf-cap always">your first release</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Phones: booklet page 3 — the full list + gallery. ── */}
      <div className="home-pfolio-book">
      <div className="home-pfolio-labelrow">
        <span className="home-pfolio-label">discography</span>
        <button className="pfolio-add" onClick={() => setComposerOpen(true)}>+ release</button>
      </div>
      {!loading && releases.length === 0 && (
        <div className="home-pfolio-empty">your releases live here</div>
      )}
      <ol className="home-pfolio-list">
        {releases.map((r, i) => (
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
              <button
                onClick={() => moveRelease(r.id, 'up')}
                disabled={i === 0}
                aria-label="Move up"
              >▴</button>
              <button
                onClick={() => moveRelease(r.id, 'down')}
                disabled={i === releases.length - 1}
                aria-label="Move down"
              >▾</button>
            </span>
          </li>
        ))}
      </ol>

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

      {composerOpen && (
        <ReleaseComposer
          currentUserId={me.id}
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
          isMine
          onCaption={(c) => updatePhoto(photo.id, c)}
          onDelete={() => { deletePhoto(photo.id); setOpenPhoto(null) }}
          onClose={() => setOpenPhoto(null)}
        />
      )}
    </div>
  )
}
