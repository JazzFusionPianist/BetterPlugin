'use client'

/**
 * /listen — one audio file, playable by anyone with the link.
 *
 * No account, no plug-in: the sender copied this URL from a chat bubble
 * or the stems panel, and everything the page needs is in the query
 * string (see lib/listenLink). The file itself is the public R2 object
 * chat already uses, so links live as long as the attachment does —
 * seven days.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { readAudioMeta } from '@/lib/audioPeaks'
import { describePosition, parseListenParams, type ListenParams } from '@/lib/listenLink'
import './listen.css'

const PEAKS_LIMIT_BYTES = 80 * 1024 * 1024  // beyond this, a plain bar — no full decode

const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `${m}:${r.toString().padStart(2, '0')}`
}

function Waveform({ peaks, frac, onSeek }: { peaks: number[] | null; frac: number; onSeek: (f: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const fracAt = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return 0
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
  }
  const bars = peaks ?? Array.from({ length: 160 }, () => 0.35)
  const svg = (
    <svg viewBox={`0 0 ${bars.length} 40`} preserveAspectRatio="none" aria-hidden="true">
      {bars.map((p, i) => {
        const h = Math.max(1.2, p * 38)
        return <rect key={i} x={i + 0.22} y={20 - h / 2} width={0.56} height={h} />
      })}
    </svg>
  )
  return (
    <div
      ref={ref}
      className={`ls-wave${peaks ? '' : ' flat'}`}
      role="slider"
      aria-label="position"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(frac * 100)}
      onPointerDown={e => {
        dragging.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
        onSeek(fracAt(e.clientX))
      }}
      onPointerMove={e => { if (dragging.current) onSeek(fracAt(e.clientX)) }}
      onPointerUp={e => { dragging.current = false; e.currentTarget.releasePointerCapture(e.pointerId) }}
      onPointerCancel={() => { dragging.current = false }}
    >
      <div className="ls-wave-base">{svg}</div>
      <div className="ls-wave-done" style={{ clipPath: `inset(0 ${100 - frac * 100}% 0 0)` }}>{svg}</div>
      <div className="ls-wave-head" style={{ left: `${frac * 100}%` }} />
    </div>
  )
}

export default function ListenPage() {
  const [params, setParams] = useState<ListenParams | null | undefined>(undefined)
  const [peaks, setPeaks] = useState<number[] | null>(null)
  const [gone, setGone] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [cur, setCur] = useState(0)
  const [dur, setDur] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    setParams(parseListenParams(window.location.search))
  }, [])

  // Peaks come from a one-off decode of the file; a missing file (the
  // seven days are up) surfaces here and on the <audio> element alike.
  useEffect(() => {
    if (!params) return
    let alive = true
    void (async () => {
      try {
        const res = await fetch(params.url)
        if (!res.ok) { if (alive) setGone(true); return }
        const size = Number(res.headers.get('content-length') ?? 0)
        if (size > PEAKS_LIMIT_BYTES) return
        const blob = await res.blob()
        const meta = await readAudioMeta(new File([blob], params.name, { type: blob.type }), 160)
        if (alive && meta) {
          setPeaks(meta.peaks)
          setDur(d => d || meta.duration)
        }
      } catch {
        if (alive) setGone(true)
      }
    })()
    return () => { alive = false }
  }, [params])

  const toggle = useCallback(() => {
    const a = audioRef.current
    if (!a) return
    if (a.paused) void a.play().catch(() => {})
    else a.pause()
  }, [])

  const seek = useCallback((f: number) => {
    const a = audioRef.current
    if (!a || !dur) return
    a.currentTime = f * dur
    setCur(a.currentTime)
  }, [dur])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); toggle() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])

  const position = describePosition(params?.position)
  const exact = params?.position?.x === 1

  return (
    <div className="ls-page">
      <header className="ls-top">
        <a className="word" href="/"><span className="mark" />Orb</a>
        <span className="ls-kicker">listen</span>
      </header>

      <main className="ls-stage">
        {params === undefined ? null : params === null ? (
          <div className="ls-plate ls-quiet">
            <p className="ls-note">this link is missing its audio.</p>
          </div>
        ) : gone ? (
          <div className="ls-plate ls-quiet">
            <h1 className="ls-name">{params.name}</h1>
            <p className="ls-note">this file has expired — audio shared in orb lives for seven days.</p>
          </div>
        ) : (
          <div className="ls-plate">
            <audio
              ref={audioRef}
              src={params.url}
              preload="metadata"
              onLoadedMetadata={() => setDur(audioRef.current?.duration ?? 0)}
              onTimeUpdate={() => setCur(audioRef.current?.currentTime ?? 0)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              onError={() => setGone(true)}
            />
            <h1 className="ls-name">{params.name}</h1>
            {params.from && <p className="ls-from">from <i>{params.from}</i></p>}

            <Waveform peaks={peaks} frac={dur ? Math.min(1, cur / dur) : 0} onSeek={seek} />

            <div className="ls-row">
              <button className="ls-play" onClick={toggle} aria-label={playing ? 'pause' : 'play'}>
                {playing
                  ? <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                  : <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M8 5v14l11-7z" /></svg>}
              </button>
              <span className="ls-time">{fmt(cur)} / {fmt(dur)}</span>
              {position && (
                <span className={`ls-pos${exact ? ' exact' : ''}`} title={exact ? 'sample-exact position from the file' : 'position of the playhead when it was sent'}>
                  {position}
                </span>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="ls-foot">
        <span>sent from the daw with <a href="/">orb</a></span>
        <span className="ls-foot-dim">links live seven days</span>
      </footer>
    </div>
  )
}
