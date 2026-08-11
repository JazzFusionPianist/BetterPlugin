'use client'

/**
 * Open call — the public demo stream, read like a gallery's open-call
 * wall: a numbered index of fresh tracks from everyone, each unfolding
 * into an etched waveform you can scrub, with timestamped comments
 * ("1:24 this part") pinned along it. App/web only, by design — the
 * plugin stays the studio; this is the square outside.
 */

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '@orb/core'
import { useFollows } from '@orb/core'
import { useOpenCall, type DemoTrack, type TrackComment, type TrackAuthor } from '@/lib/useOpenCall'
import { readAudioMeta, type AudioMeta } from '@/lib/audioPeaks'

const fmtDur = (s: number | null | undefined) => {
  if (s == null || !isFinite(s)) return '–:––'
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

/** "now · 4m · 3h · 2d", then the catalogue date. */
const ago = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toLowerCase()
}

const FLAT = Array.from({ length: 120 }, () => 0.5)

/* ── Waveform — the etching. Fills only (no strokes), so the
   non-uniform viewBox stretch is safe on Safari. ─────────────────── */
function Waveform({ peaks, frac, marks, onSeek }: {
  peaks: number[] | null
  frac: number            // played fraction 0..1
  marks: number[]         // comment positions, fractions 0..1
  onSeek: (frac: number) => void
}) {
  const ref = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)
  // Several waveforms render at once (rows + composer preview) — the
  // clip id must be unique per instance or they clip each other.
  const clipId = `ocwp-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const p = peaks && peaks.length > 4 ? peaks : FLAT
  const N = p.length
  const flat = !(peaks && peaks.length > 4)

  const seekAt = (clientX: number) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    onSeek(Math.min(1, Math.max(0, (clientX - r.left) / r.width)))
  }

  const bars = (fill: string, opacity: number) => p.map((v, i) => {
    const h = flat ? 8 : 5 + v * 87
    return <rect key={i} x={i + 0.18} y={(100 - h) / 2} width={0.64} height={h} fill={fill} opacity={opacity} />
  })

  return (
    <svg
      ref={ref}
      className="ocall-wave"
      viewBox={`0 0 ${N} 100`}
      preserveAspectRatio="none"
      onPointerDown={(e) => {
        dragging.current = true
        try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* synthetic */ }
        seekAt(e.clientX)
      }}
      onPointerMove={(e) => { if (dragging.current) seekAt(e.clientX) }}
      onPointerUp={() => { dragging.current = false }}
      onPointerCancel={() => { dragging.current = false }}
    >
      <defs>
        <clipPath id={clipId}><rect x={0} y={0} width={frac * N} height={100} /></clipPath>
      </defs>
      <g>{bars('#1A1917', 0.16)}</g>
      <g clipPath={`url(#${clipId})`}>{bars('#2440FF', 0.9)}</g>
      {marks.map((m, i) => (
        <rect key={`m${i}`} x={m * N - 0.3} y={92} width={0.6} height={8} fill="#2440FF" />
      ))}
    </svg>
  )
}

/* ── Byline — tiny author card: dot avatar + serif name + @handle ── */
function Byline({ a }: { a: TrackAuthor | null }) {
  if (!a) return <span className="ocall-by-name">someone</span>
  return (
    <span className="ocall-by">
      <span className="ocall-by-av" style={{ background: a.avatar_color }}>
        {a.avatar_url ? <img src={a.avatar_url} alt="" /> : <span>{a.initials.slice(0, 1)}</span>}
      </span>
      <span className="ocall-by-name">{a.display_name}</span>
      {a.username && <span className="ocall-by-user">@{a.username}</span>}
    </span>
  )
}

/** Two-tap delete word — "delete" → "sure?" (never an ✕). */
function DeleteWord({ onConfirm }: { onConfirm: () => void }) {
  const [arming, setArming] = useState(false)
  useEffect(() => {
    if (!arming) return
    const t = setTimeout(() => setArming(false), 2600)
    return () => clearTimeout(t)
  }, [arming])
  return (
    <button
      className={`ocall-delword${arming ? ' arming' : ''}`}
      onClick={() => { if (arming) onConfirm(); else setArming(true) }}
    >
      {arming ? 'sure?' : 'delete'}
    </button>
  )
}

export default function OpenCallPanel({ supabase, me, onClose }: {
  supabase: SupabaseClient
  me: Profile
  onClose: () => void
}) {
  const {
    tracks, loading, post, deleteTrack, bumpPlays,
    fetchComments, addComment, deleteComment,
  } = useOpenCall(supabase, me.id)
  const { followingIds, follow } = useFollows(supabase, me.id)

  const [openId, setOpenId] = useState<string | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [commentsById, setCommentsById] = useState<Map<string, TrackComment[]>>(new Map())

  // ── One audio element for the whole panel ────────────────────────
  const audioRef = useRef<HTMLAudioElement>(null)
  const pendingSeekRef = useRef<number | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [cur, setCur] = useState(0)
  const [dur, setDur] = useState(0)

  const start = (t: DemoTrack, at = 0) => {
    const a = audioRef.current
    if (!a) return
    if (activeId !== t.id) {
      setActiveId(t.id); setCur(at); setDur(t.duration ?? 0)
      a.src = t.audio_url
      pendingSeekRef.current = at > 0 ? at : null
      bumpPlays(t.id)
    } else {
      a.currentTime = at
      setCur(at)
    }
    a.play().then(() => setPlaying(true)).catch(() => {})
  }
  const toggle = (t: DemoTrack) => {
    const a = audioRef.current
    if (!a) return
    if (activeId !== t.id) { start(t); return }
    if (playing) { a.pause(); setPlaying(false) }
    else { a.play().then(() => setPlaying(true)).catch(() => {}) }
  }
  const seekTo = (t: DemoTrack, frac: number) => {
    const d = activeId === t.id ? (dur || t.duration || 0) : (t.duration || 0)
    if (activeId === t.id) {
      const a = audioRef.current
      if (!a || !d) return
      a.currentTime = frac * d
      setCur(frac * d)
    } else {
      start(t, frac * d)
    }
  }

  const unfold = async (t: DemoTrack) => {
    if (openId === t.id) { setOpenId(null); return }
    setOpenId(t.id)
    if (!commentsById.has(t.id)) {
      const list = await fetchComments(t.id)
      setCommentsById((prev) => new Map(prev).set(t.id, list))
    }
  }

  // The panel behaves like every full-screen page: portal to body so no
  // transformed ancestor (home zoom, centre block) can trap it.
  return createPortal(
    <div className="ocall">
      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={() => setCur(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => {
          const a = audioRef.current
          if (!a) return
          setDur(a.duration ?? 0)
          if (pendingSeekRef.current != null) {
            a.currentTime = pendingSeekRef.current
            setCur(pendingSeekRef.current)
            pendingSeekRef.current = null
          }
        }}
        onEnded={() => { setPlaying(false); setCur(0) }}
      />

      <header className="ocall-head">
        <button className="ocall-back" onClick={onClose} aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <div className="ocall-masthead">
          <h1>open call</h1>
          <span className="ocall-sub">demos &amp; sketches from everyone · fresh first</span>
        </div>
        <button className="ocall-post-btn" onClick={() => setComposerOpen(true)}>post a demo</button>
      </header>

      <div className="ocall-scroll">
        {loading && <div className="ocall-empty">…</div>}
        {!loading && tracks.length === 0 && (
          <div className="ocall-empty">nothing pinned yet — post the first demo</div>
        )}

        <ol className="ocall-list">
          {tracks.map((t) => {
            const open = openId === t.id
            const active = activeId === t.id
            const d = (active && dur) || t.duration || 0
            const frac = active && d ? Math.min(1, cur / d) : 0
            const comments = commentsById.get(t.id) ?? []
            const marks = d
              ? comments.filter((c) => c.at_seconds != null).map((c) => Math.min(1, c.at_seconds! / d))
              : []
            const mine = t.user_id === me.id
            const canFollow = !mine && !!t.author && !followingIds.has(t.user_id)
            return (
              <li key={t.id} className={`ocall-row${open ? ' open' : ''}${active && playing ? ' playing' : ''}`}>
                <button className="ocall-row-head" onClick={() => unfold(t)}>
                  <span className="ocall-row-title">{t.title}</span>
                  <span className="ocall-row-meta">
                    <span className="ocall-row-by">{t.author ? `@${t.author.username || t.author.display_name}` : '—'}</span>
                    <span className="ocall-row-dur">{fmtDur(t.duration)}</span>
                    <span className="ocall-row-when">{ago(t.created_at)}</span>
                  </span>
                </button>

                {open && (
                  <div className="ocall-fold">
                    <Waveform peaks={t.peaks} frac={frac} marks={marks} onSeek={(f) => seekTo(t, f)} />

                    <div className="ocall-ctl">
                      <button className="ocall-play" onClick={() => toggle(t)} aria-label={active && playing ? 'Pause' : 'Play'}>
                        {active && playing
                          ? <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                          : <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M8 5v14l11-7z" /></svg>}
                      </button>
                      <span className="ocall-time">{fmtDur(active ? cur : 0)} / {fmtDur(d || null)}</span>
                      <span className="ocall-plays">{t.plays === 1 ? '1 play' : `${t.plays} plays`}</span>
                      <span className="ocall-ctl-spring" />
                      {canFollow && (
                        <button className="ocall-follow" onClick={() => { follow(t.user_id).catch(() => {}) }}>follow</button>
                      )}
                      {mine && <DeleteWord onConfirm={() => { if (activeId === t.id) { audioRef.current?.pause(); setPlaying(false); setActiveId(null) } deleteTrack(t.id).catch(() => {}) }} />}
                    </div>

                    <div className="ocall-byline"><Byline a={t.author} /></div>
                    {t.caption && <p className="ocall-caption">{t.caption}</p>}

                    <Comments
                      track={t}
                      me={me}
                      comments={comments}
                      playheadAt={active ? cur : null}
                      onSeek={(sec) => { const dd = d || 1; seekTo(t, Math.min(1, sec / dd)) }}
                      onAdd={async (body, at) => {
                        const c = await addComment(t.id, body, at)
                        if (c) setCommentsById((prev) => {
                          const m = new Map(prev)
                          m.set(t.id, [...(m.get(t.id) ?? []), c])
                          return m
                        })
                      }}
                      onDelete={(id) => {
                        setCommentsById((prev) => {
                          const m = new Map(prev)
                          m.set(t.id, (m.get(t.id) ?? []).filter((c) => c.id !== id))
                          return m
                        })
                        deleteComment(id).catch(() => {})
                      }}
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      </div>

      {composerOpen && (
        <Composer
          onClose={() => setComposerOpen(false)}
          onPost={async (file, title, caption, meta, onProgress) => {
            await post(file, title, caption, onProgress, meta)
            setComposerOpen(false)
          }}
        />
      )}
    </div>,
    document.body,
  )
}

/* ── Comments — the conversation under a track ─────────────────────── */
function Comments({ track, me, comments, playheadAt, onSeek, onAdd, onDelete }: {
  track: DemoTrack
  me: Profile
  comments: TrackComment[]
  /** Current playhead in seconds when this track is loaded, else null. */
  playheadAt: number | null
  onSeek: (sec: number) => void
  onAdd: (body: string, at: number | null) => Promise<void>
  onDelete: (id: string) => void
}) {
  const [text, setText] = useState('')
  const [stamp, setStamp] = useState(false)   // pin the comment to the playhead
  const [busy, setBusy] = useState(false)
  const stampAt = playheadAt != null && playheadAt > 0.5 ? playheadAt : null

  const submit = async () => {
    const body = text.trim()
    if (!body || busy) return
    setBusy(true)
    try {
      await onAdd(body, stamp ? stampAt : null)
      setText(''); setStamp(false)
    } finally { setBusy(false) }
  }

  return (
    <div className="ocall-comments">
      {comments.map((c) => (
        <div key={c.id} className="ocall-comment">
          {c.at_seconds != null && (
            <button className="ocall-cstamp" onClick={() => onSeek(c.at_seconds!)}>{fmtDur(c.at_seconds)}</button>
          )}
          <span className="ocall-cname">{c.author?.display_name ?? 'someone'}</span>
          <span className="ocall-cbody">{c.body}</span>
          <span className="ocall-cwhen">{ago(c.created_at)}</span>
          {(c.user_id === me.id || track.user_id === me.id) && (
            <DeleteWord onConfirm={() => onDelete(c.id)} />
          )}
        </div>
      ))}

      <div className="ocall-cbar">
        {stampAt != null && (
          <button
            className={`ocall-cstamp-toggle${stamp ? ' on' : ''}`}
            onClick={() => setStamp((s) => !s)}
            title="Pin this comment to the playhead"
          >
            @ {fmtDur(stampAt)}
          </button>
        )}
        <input
          value={text}
          placeholder="say something…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return
            if (e.key === 'Enter') { e.preventDefault(); submit() }
          }}
        />
        {text.trim() && (
          <button className="ocall-csend" onClick={submit} disabled={busy}>post</button>
        )}
      </div>
    </div>
  )
}

/* ── Composer — pick a bounce, name it, pin it up ──────────────────── */
function Composer({ onClose, onPost }: {
  onClose: () => void
  onPost: (
    file: File, title: string, caption: string,
    meta: AudioMeta | null, onProgress: (r: number) => void,
  ) => Promise<void>
}) {
  const MAX_MB = 100
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [meta, setMeta] = useState<AudioMeta | null>(null)
  const [reading, setReading] = useState(false)
  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [err, setErr] = useState<string | null>(null)

  const pick = async (f: File) => {
    if (f.size > MAX_MB * 1024 * 1024) { setErr(`too large — keep demos under ${MAX_MB}mb`); return }
    setErr(null)
    setFile(f)
    if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ''))
    setReading(true)
    setMeta(await readAudioMeta(f))
    setReading(false)
  }

  const submit = async () => {
    if (!file || !title.trim() || busy) return
    setBusy(true); setErr(null)
    try {
      await onPost(file, title, caption, meta, setProgress)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'upload failed')
      setBusy(false)
    }
  }

  return (
    <div className="ocall-compose-overlay" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <div className="ocall-compose">
        <span className="evsheet-kicker">open call</span>
        <h2 className="ocall-compose-h">post a demo</h2>

        <input
          ref={fileRef} type="file" accept="audio/*" hidden
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) pick(f) }}
        />

        {!file ? (
          <button className="ocall-pick" onClick={() => fileRef.current?.click()}>choose audio…</button>
        ) : (
          <button className="ocall-picked" onClick={() => fileRef.current?.click()}>
            <span className="ocall-picked-name">{file.name}</span>
            <span className="ocall-picked-dur">{reading ? 'reading…' : fmtDur(meta?.duration ?? null)}</span>
          </button>
        )}

        {file && meta?.peaks && (
          <div className="ocall-compose-wavebox">
            <Waveform peaks={meta.peaks} frac={0} marks={[]} onSeek={() => {}} />
          </div>
        )}

        <input
          className="ocall-compose-title"
          value={title}
          placeholder="title"
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="ocall-compose-caption"
          value={caption}
          placeholder="one line about it (optional)"
          maxLength={500}
          onChange={(e) => setCaption(e.target.value)}
        />

        {err && <div className="ocall-compose-err">{err}</div>}
        {busy && (
          <div className="ocall-compose-prog"><div style={{ width: `${Math.round(progress * 100)}%` }} /></div>
        )}

        <div className="ocall-compose-foot">
          <button className="ocall-compose-cancel" onClick={onClose} disabled={busy}>cancel</button>
          <button className="ocall-compose-post" onClick={submit} disabled={!file || !title.trim() || busy}>
            {busy ? 'posting…' : 'post'}
          </button>
        </div>
      </div>
    </div>
  )
}
