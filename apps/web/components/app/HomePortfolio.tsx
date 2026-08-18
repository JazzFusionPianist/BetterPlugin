'use client'

import { useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '@orb/core'
import { usePortfolio } from '@/lib/usePortfolio'
import { compressImage, uploadAttachment } from '@/lib/upload'
import { ReleaseSheet, PhotoLightbox } from './PortfolioPage'

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
  const { releases, photos, loading, updateRelease, deleteRelease, addPhotos, updatePhoto, deletePhoto } =
    usePortfolio(supabase, me.id)

  const [openRelease, setOpenRelease] = useState<string | null>(null)
  const [openPhoto, setOpenPhoto] = useState<string | null>(null)
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

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
      {/* ── Phones: booklet page 3 — shelves as sections + gallery. ── */}
      <div className="home-pfolio-book">
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
          onUpdate={updateRelease}
          onDelete={(id) => { deleteRelease(id); setOpenRelease(null) }}
          onClose={() => setOpenRelease(null)}
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
