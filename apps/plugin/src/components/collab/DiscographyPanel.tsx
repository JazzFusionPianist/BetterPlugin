import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '../../types/collab'
import './discography.css'

/**
 * The discography crate, plugin-scale — a port of the app's panel sized
 * for the 300×500 window. Same Supabase tables, so releases added in
 * the app appear here and vice versa. Records are 104px, captions fold
 * open above the row, and a risen record's label turns while it's up.
 */

interface Shelf {
  id: string
  user_id: string
  title: string
  position: number
  created_at: string
}

interface ReleaseTrack {
  id: string
  release_id: string
  idx: number
  title: string
  /** Tracks are metadata-only (the sleeve's tracklist); kept for a
   *  possible future streaming feature. */
  media_url: string | null
}

interface Release {
  id: string
  user_id: string
  title: string
  cover_url: string | null
  artist: string | null
  description: string | null
  released_on: string | null
  shelf_id: string | null
  position: number
  created_at: string
  tracks: ReleaseTrack[]
}

const fmtYear = (r: Release) =>
  r.released_on ? String(new Date(r.released_on + 'T00:00:00').getFullYear()) : new Date(r.created_at).getFullYear().toString()

/** "2026", "2026.3", "2026-03-15", "2026년 3월" → a date, or null. */
function parseReleaseDate(text: string): string | null {
  const m = text.trim().match(/^(\d{4})(?:[.\-/년\s]+(\d{1,2}))?(?:[.\-/월\s]+(\d{1,2}))?/)
  if (!m) return null
  const mo = Math.min(12, Math.max(1, m[2] ? +m[2] : 1))
  const d = Math.min(31, Math.max(1, m[3] ? +m[3] : 1))
  return `${m[1]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const TINTS = ['#1A1917', '#2440FF', '#B8552F', '#4C5B3F', '#8B7355', '#5B4C6E']
const tintFor = (title: string) =>
  TINTS[[...title].reduce((a, c) => a + c.charCodeAt(0), 0) % TINTS.length]

/** Same R2 presign flow the chat uses; no progress UI needed here. */
async function uploadToR2(file: File, userId: string): Promise<string | null> {
  try {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const contentType = file.type || 'application/octet-stream'
    const res = await fetch('/api/r2-upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ext, contentType, userId }),
    })
    if (!res.ok) return null
    const { uploadUrl, publicUrl } = await res.json() as { uploadUrl: string; publicUrl: string }
    const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file })
    return put.ok ? publicUrl : null
  } catch (err) {
    console.error('[discography] upload', err)
    return null
  }
}

interface Props {
  supabase: SupabaseClient
  owner: Profile
  isMine: boolean
  onClose: () => void
}

export default function DiscographyPanel({ supabase, owner, isMine, onClose }: Props) {
  // Slide back out before unmounting — the reverse of the entrance.
  const [closing, setClosing] = useState(false)
  const requestClose = () => {
    if (closing) return
    setClosing(true)
    setTimeout(onClose, 230)
  }

  const [releases, setReleases] = useState<Release[]>([])
  const [shelves, setShelves] = useState<Shelf[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    const [rel, tr, sh] = await Promise.all([
      supabase.from('releases').select('*').eq('user_id', owner.id)
        .order('position', { ascending: true })
        .order('created_at', { ascending: false }),
      supabase.from('release_tracks')
        .select('*, releases!inner(user_id)')
        .eq('releases.user_id', owner.id)
        .order('idx', { ascending: true }),
      supabase.from('shelves').select('*').eq('user_id', owner.id)
        .order('position', { ascending: true }),
    ])
    if (!rel.error && rel.data) {
      const byRelease = new Map<string, ReleaseTrack[]>()
      for (const t of ((tr.data ?? []) as unknown as ReleaseTrack[])) {
        const arr = byRelease.get(t.release_id) ?? []
        arr.push(t)
        byRelease.set(t.release_id, arr)
      }
      setReleases((rel.data as Omit<Release, 'tracks'>[]).map((r) => ({ ...r, tracks: byRelease.get(r.id) ?? [] })))
    }
    if (!sh.error && sh.data) setShelves(sh.data as Shelf[])
    setLoading(false)
  }, [supabase, owner.id])

  useEffect(() => { refetch() }, [refetch])

  const groups = useMemo(() => {
    const out: { shelf: Shelf | null; releases: Release[] }[] = []
    const loose = releases.filter((r) => !r.shelf_id)
    if (loose.length > 0 || shelves.length === 0) out.push({ shelf: null, releases: loose })
    for (const s of shelves) out.push({ shelf: s, releases: releases.filter((r) => r.shelf_id === s.id) })
    return out
  }, [releases, shelves])

  const [selected, setSelected] = useState<string | null>(null)
  const [lastCapId, setLastCapId] = useState<string | null>(null)
  const [openRelease, setOpenRelease] = useState<string | null>(null)
  const [composerShelf, setComposerShelf] = useState<string | 'default' | null>(null)

  const pick = (id: string) => {
    if (selected === id) setSelected(null)
    else { setSelected(id); setLastCapId(id) }
  }

  const open = releases.find((r) => r.id === openRelease) ?? null

  const moveRelease = async (id: string, dir: 'up' | 'down') => {
    const me = releases.find((r) => r.id === id)
    if (!me) return
    const group = releases.filter((r) => (r.shelf_id ?? null) === (me.shelf_id ?? null))
    const gIdx = group.findIndex((r) => r.id === id)
    const other = group[gIdx + (dir === 'up' ? -1 : 1)]
    if (!other) return
    await Promise.all([
      supabase.from('releases').update({ position: other.position }).eq('id', me.id),
      supabase.from('releases').update({ position: me.position }).eq('id', other.id),
    ])
    await refetch()
  }

  return (
    <div className={`pdisco${closing ? ' closing' : ''}`}>
      <header className="pdisco-head">
        <button className="pdisco-back" onClick={requestClose} aria-label="Back">‹</button>
        <span className="pdisco-title">discography</span>
        <span className="pdisco-owner">{owner.display_name}</span>
      </header>

      <div className="pdisco-scroll">
        {!loading && releases.length === 0 && shelves.length === 0 && (
          <div className="pdisco-empty">
            {isMine ? 'nothing here yet — add your first release' : 'nothing here yet'}
          </div>
        )}

        {groups.map((g) => {
          const key = g.shelf?.id ?? 'default'
          const sel = g.releases.findIndex((r) => r.id === selected)
          const capIdx = g.releases.findIndex((r) => r.id === lastCapId)
          return (
            <section key={key} className="pdisco-shelf">
              <div className="pdisco-shelf-head">
                <span className="pdisco-shelf-title">{g.shelf?.title ?? 'releases'}</span>
                {isMine && (
                  <button className="pdisco-add" onClick={() => setComposerShelf(g.shelf?.id ?? 'default')}>+ release</button>
                )}
              </div>

              <div className={`pdisco-capwrap${sel >= 0 ? ' show' : ''}`}>
                <div className="pdisco-capclip">
                  {capIdx >= 0 && (() => {
                    const r = g.releases[capIdx]!
                    return (
                      <div className="pdisco-caption" key={r.id}>
                        <div className="pdisco-caption-title">{r.title}</div>
                        <div className="pdisco-caption-sub">
                          {fmtYear(r)}{r.artist ? ` · ${r.artist}` : ''}{r.tracks.length > 0 ? ` · ${r.tracks.length}` : ''}
                        </div>
                        <div className="pdisco-caption-actions">
                          <button className="pdisco-open" onClick={(e) => { e.stopPropagation(); setOpenRelease(r.id) }}>open</button>
                          {isMine && (
                            <span className="pdisco-order">
                              <button onClick={(e) => { e.stopPropagation(); moveRelease(r.id, 'up') }} disabled={capIdx === 0}>‹</button>
                              <button onClick={(e) => { e.stopPropagation(); moveRelease(r.id, 'down') }} disabled={capIdx === g.releases.length - 1}>›</button>
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>

              {g.releases.length === 0 ? (
                <div className="pdisco-row-empty">an empty shelf</div>
              ) : (
                <div className="pdisco-row">
                  {g.releases.map((r, i) => (
                    <button
                      key={r.id}
                      className={`pdisco-rec${selected === r.id ? ' up' : ''}`}
                      style={{ zIndex: g.releases.length - i, animationDelay: `${Math.min(i, 10) * 55}ms` }}
                      onClick={() => pick(r.id)}
                      aria-label={r.title}
                    >
                      <span className="pdisco-rec-vinyl" aria-hidden="true" />
                      {r.cover_url ? (
                        <img className="pdisco-rec-label" src={r.cover_url} alt="" loading="lazy" draggable={false} />
                      ) : (
                        <span className="pdisco-rec-label tint" style={{ background: tintFor(r.title) }} />
                      )}
                      <span className="pdisco-rec-hole" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </div>

      {open && (
        <ReleaseSheet
          release={open}
          onClose={() => setOpenRelease(null)}
        />
      )}

      {composerShelf !== null && isMine && (
        <ReleaseComposer
          userId={owner.id}
          onCreate={async (input) => {
            const nextPos = releases.reduce((m, r) => Math.max(m, r.position + 1), 0)
            const { data, error } = await supabase.from('releases').insert({
              user_id: owner.id,
              title: input.title,
              cover_url: input.cover_url,
              artist: input.artist,
              description: input.description,
              released_on: input.released_on,
              shelf_id: composerShelf === 'default' ? null : composerShelf,
              position: nextPos,
            }).select('id').single()
            if (error || !data) { console.error('[discography] add', error); return false }
            if (input.tracks.length > 0) {
              await supabase.from('release_tracks').insert(
                input.tracks.map((t, i) => ({ release_id: data.id, idx: i, title: t.title })),
              )
            }
            await refetch()
            setComposerShelf(null)
            return true
          }}
          onClose={() => setComposerShelf(null)}
        />
      )}
    </div>
  )
}

/** A release opened — cover, notes, the sleeve's tracklist (view-only). */
function ReleaseSheet({ release, onClose }: {
  release: Release
  onClose: () => void
}) {
  return (
    <div className="pdisco-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pdisco-sheet">
        {release.cover_url && (
          <div className="pdisco-sheet-cover"><img src={release.cover_url} alt="" /></div>
        )}
        <div className="pdisco-sheet-title">{release.title}</div>
        <div className="pdisco-sheet-sub">
          {fmtYear(release)}{release.artist ? ` · ${release.artist}` : ''}
        </div>
        {release.description && <div className="pdisco-sheet-desc">{release.description}</div>}
        {release.tracks.length > 0 && (
          <ol className="pdisco-tracks">
            {release.tracks.map((t, i) => (
              <li key={t.id}>
                <span className="pdisco-track as-text">
                  <span className="pdisco-track-num">{i + 1}</span>
                  <span className="pdisco-track-title">{t.title}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
        <button className="pdisco-close" onClick={onClose}>close</button>
      </div>
    </div>
  )
}

/** New release — cover, title, artist, typed date, notes, and a typed
 *  tracklist. Tracks are metadata only (no audio upload). */
function ReleaseComposer({ userId, onCreate, onClose }: {
  userId: string
  onCreate: (input: { title: string; cover_url: string | null; artist: string | null; description: string | null; released_on: string | null; tracks: { title: string }[] }) => Promise<boolean>
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [date, setDate] = useState('')
  const [desc, setDesc] = useState('')
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [tracks, setTracks] = useState<{ title: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const coverRef = useRef<HTMLInputElement>(null)

  const onPickCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    const url = await uploadToR2(file, userId)
    if (url) setCoverUrl(url)
    setBusy(false)
  }
  const submit = async () => {
    if (!title.trim() || saving || busy) return
    setSaving(true)
    const ok = await onCreate({
      title: title.trim(),
      cover_url: coverUrl,
      artist: artist.trim() || null,
      description: desc.trim() || null,
      released_on: date.trim() ? parseReleaseDate(date) : null,
      tracks: tracks.map((t) => ({ title: t.title.trim() })).filter((t) => t.title),
    })
    if (!ok) setSaving(false)
  }

  return (
    <div className="pdisco-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pdisco-sheet">
        <div className="pdisco-composer-head">new release</div>
        <button className="pdisco-coverpick" onClick={() => coverRef.current?.click()} disabled={busy}>
          {coverUrl ? <img src={coverUrl} alt="" /> : <span>{busy ? 'uploading…' : 'cover art'}</span>}
        </button>
        <input ref={coverRef} type="file" accept="image/*" hidden onChange={onPickCover} />
        <input className="pdisco-in title" placeholder="release title…" value={title} maxLength={120} autoFocus onChange={(e) => setTitle(e.target.value)} />
        <input className="pdisco-in" placeholder="artist…" value={artist} maxLength={120} onChange={(e) => setArtist(e.target.value)} />
        <input className="pdisco-in" placeholder="released — 2026 or 2026.03.15" value={date} onChange={(e) => setDate(e.target.value)} />
        <textarea className="pdisco-in notes" placeholder="liner notes…" value={desc} rows={2} onChange={(e) => setDesc(e.target.value)} />
        {tracks.length > 0 && (
          <ol className="pdisco-tracks composer">
            {tracks.map((t, i) => (
              <li key={i} className="pdisco-track as-row">
                <span className="pdisco-track-num">{i + 1}</span>
                <input
                  className="pdisco-track-edit"
                  placeholder="track title…"
                  value={t.title}
                  maxLength={120}
                  autoFocus={i === tracks.length - 1 && !t.title}
                  onChange={(e) => setTracks((prev) => prev.map((x, xi) => xi === i ? { ...x, title: e.target.value } : x))}
                />
                <button className="pdisco-track-rm" onClick={() => setTracks((prev) => prev.filter((_, xi) => xi !== i))}>✕</button>
              </li>
            ))}
          </ol>
        )}
        <button className="pdisco-add" onClick={() => setTracks((prev) => [...prev, { title: '' }])}>
          + add track
        </button>
        <div className="pdisco-composer-foot">
          <button className="pdisco-close" onClick={onClose}>cancel</button>
          <button className="pdisco-publish" onClick={submit} disabled={!title.trim() || saving || busy}>
            {saving ? 'publishing…' : 'publish'}
          </button>
        </div>
      </div>
    </div>
  )
}
