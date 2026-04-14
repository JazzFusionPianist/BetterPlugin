import { useRef, useState, useEffect, useLayoutEffect, useMemo, useCallback } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Profile } from '../../types/collab'
import type { LiveSession } from '../../hooks/useLive'
import { getInitials } from '../../types/collab'
import { useTracks } from '../../hooks/useTracks'

interface Props {
  supabase: SupabaseClient
  user: User
  me: Profile | null
  followingProfiles: Profile[]
  followerProfiles: Profile[]
  onClose: () => void
  onUpdated: () => void
  onOpenChat: (id: string) => void
  onRemoveFriend: (id: string) => Promise<void>
  favorites: Set<string>
  onToggleFav: (id: string) => void
  onViewProfile?: (id: string) => void
  onAvatarUpdated?: (url: string) => void
  viewOnly?: boolean
  liveHostIds?: Set<string>
  liveSessions?: LiveSession[]
  onWatchLive?: (sessionId: string) => void
}

interface Orb {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  frozen: boolean
  el: HTMLDivElement | null
  tx?: number
  ty?: number
}

const SELF_RADIUS = 38

export default function ProfilePanel({ supabase, user, me, followingProfiles, followerProfiles, onClose, onUpdated, onOpenChat, onRemoveFriend, favorites, onToggleFav, onViewProfile, onAvatarUpdated, viewOnly, liveHostIds, liveSessions, onWatchLive }: Props) {
  const [mode, setMode] = useState<'main' | 'party'>(viewOnly ? 'party' : 'main')
  useEffect(() => { if (viewOnly) setMode('party') }, [viewOnly])
  const fileRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const orbsRef = useRef<Orb[]>([])
  const sizeRef = useRef({ w: 300, h: 480 })
  const [, forceRender] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number; below: boolean } | null>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wallBounceRef = useRef(true)
  const enterFromOutsideRef = useRef(false)
  const prevModeRef = useRef(mode)
  const speedFactorRef = useRef(1)
  const exclusionPadRef = useRef(6)
  const [scrolledUp, setScrolledUp] = useState(false)
  const [statList, setStatList] = useState<'members' | 'following' | null>(null)
  const lastListRef = useRef<'members' | 'following'>('members')

  useEffect(() => { if (statList) lastListRef.current = statList }, [statList])

  useEffect(() => { if (!scrolledUp) { setStatList(null); setTrackPanel(false) } }, [scrolledUp])
  useEffect(() => { setStatList(null); setTrackPanel(false) }, [mode])

  // --- Track upload state ---
  const { tracks, addTrack } = useTracks(supabase, user.id)
  const audioInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const trackAudioRef = useRef<HTMLAudioElement>(null)
  const [pendingAudioFiles, setPendingAudioFiles] = useState<File[]>([])
  const [trackPanel, setTrackPanel] = useState(false)
  const [trackMeta, setTrackMeta] = useState({ title: '', artist: '', version: '', date: '', description: '' })
  const [trackCoverFile, setTrackCoverFile] = useState<File | null>(null)
  const [trackCoverPreview, setTrackCoverPreview] = useState<string | null>(null)
  const [trackSaving, setTrackSaving] = useState(false)
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null)

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setPendingAudioFiles(Array.from(files))
    setTrackMeta({ title: files[0].name.replace(/\.[^.]+$/, ''), artist: '', version: '1', date: '', description: '' })
    setTrackCoverFile(null)
    setTrackCoverPreview(null)
    setTrackPanel(true)
    if (audioInputRef.current) audioInputRef.current.value = ''
  }

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setTrackCoverFile(file)
    const url = URL.createObjectURL(file)
    setTrackCoverPreview(url)
    if (coverInputRef.current) coverInputRef.current.value = ''
  }

  const handleTrackSave = useCallback(async () => {
    if (!pendingAudioFiles.length || !trackMeta.title) return
    setTrackSaving(true)
    try {
      for (const audioFile of pendingAudioFiles) {
        await addTrack(audioFile, trackMeta, trackCoverFile || undefined)
      }
    } catch (err: any) {
      console.error('Track upload failed:', err)
      showMsg('Upload failed: ' + (err?.message || 'unknown error'))
    }
    setTrackPanel(false)
    setPendingAudioFiles([])
    setTrackSaving(false)
  }, [pendingAudioFiles, trackMeta, trackCoverFile, addTrack])

  const handleTrackPlay = (track: typeof tracks[0]) => {
    const audio = trackAudioRef.current
    if (!audio) return
    if (playingTrackId === track.id) {
      audio.pause()
      setPlayingTrackId(null)
    } else {
      audio.src = track.audio_url
      audio.play()
      setPlayingTrackId(track.id)
    }
  }

  const handleWheel = (e: React.WheelEvent) => {
    if (mode !== 'party') return
    if (statList || trackPanel) return
    if (e.deltaY < 0) setScrolledUp(true)
    else if (e.deltaY > 0) setScrolledUp(false)
  }

  const displayProfiles = useMemo(
    () => mode === 'main' ? followingProfiles.filter(p => p.isOnline) : followerProfiles,
    [mode, followingProfiles, followerProfiles]
  )
  const [renderProfiles, setRenderProfiles] = useState<Profile[]>(displayProfiles)
  const [transitionTick, setTransitionTick] = useState(0)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    if (prevModeRef.current === mode) {
      setRenderProfiles(displayProfiles)
      return
    }
    prevModeRef.current = mode
    setExiting(true)
    const t = setTimeout(() => {
      setExiting(false)
      setRenderProfiles(displayProfiles)
      setTransitionTick(v => v + 1)
    }, 400)
    return () => clearTimeout(t)
  }, [mode, displayProfiles])

  const showMsg = (m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(null), 2400)
  }

  const handlePickFile = () => fileRef.current?.click()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { showMsg('max 5MB'); return }
    setUploading(true)
    const ext = file.name.split('.').pop() || 'png'
    const path = `${user.id}/avatar-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (upErr) { setUploading(false); showMsg('upload failed: ' + upErr.message); return }
    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
    const { error: dbErr } = await supabase
      .from('profiles').update({ avatar_url: pub.publicUrl }).eq('id', user.id)
    setUploading(false)
    if (dbErr) showMsg('db update failed: ' + dbErr.message)
    else { onAvatarUpdated?.(pub.publicUrl); showMsg('photo updated'); onUpdated() }
    if (fileRef.current) fileRef.current.value = ''
  }

  const displayName = me?.display_name ?? ''
  const initials = me?.initials ?? getInitials(displayName || 'Unknown')
  const color = me?.avatar_color ?? '#4A8FE7'
  const photo = me?.avatar_url

  // Initialize orbs whenever display list changes
  useLayoutEffect(() => {
    const c = containerRef.current
    if (!c) return
    const rect = c.getBoundingClientRect()
    const W = rect.width
    const H = rect.height
    sizeRef.current = { w: W, h: H }

    const N = renderProfiles.length
    if (N === 0) {
      orbsRef.current = []
      wallBounceRef.current = true
      enterFromOutsideRef.current = false
      forceRender(v => v + 1)
      return
    }

    const cx = W / 2
    const cy = H / 2
    const reservedBottom = 4
    const usable = Math.max(1, (W * (H - reservedBottom) - Math.PI * SELF_RADIUS * SELF_RADIUS) * 0.22)
    const rRaw = Math.sqrt(usable / (N * Math.PI))
    const baseR = Math.max(4, Math.min(14, rRaw))
    const favR = Math.max(baseR * 1.4, baseR + 5)
    const exclusionPad = Math.max(18, 48 - Math.sqrt(N) * 1.5)
    const speedFactor = Math.max(0.15, 1 - Math.log10(Math.max(1, N)) * 0.35)
    speedFactorRef.current = speedFactor
    exclusionPadRef.current = exclusionPad

    const orbs: Orb[] = []
    for (let i = 0; i < N; i++) {
      const r = favorites.has(renderProfiles[i]!.id) ? favR : baseR
      const rMin = SELF_RADIUS + r + exclusionPad + 4
      // Uniform rectangle sampling with guaranteed rejection inside the self exclusion
      let x = 0, y = 0
      for (let attempt = 0; attempt < 500; attempt++) {
        x = r + Math.random() * (W - 2 * r)
        y = r + Math.random() * (H - reservedBottom - 2 * r)
        if (Math.hypot(x - cx, y - cy) >= rMin) break
      }
      const angle = Math.random() * Math.PI * 2
      const speed = (0.06 + Math.random() * 0.08) * speedFactor
      orbs.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r, frozen: false, el: null })
    }
    wallBounceRef.current = true
    orbsRef.current = orbs
    setHoveredIdx(null)
    setTooltipPos(null)
    forceRender(v => v + 1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderProfiles.map(p => p.id).join('|'), Array.from(favorites).sort().join('|'), transitionTick])

  // Animation loop
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const orbs = orbsRef.current
      const { w: W, h: H } = sizeRef.current
      const cx = W / 2, cy = H / 2
      const reservedBottom = 4

      const transitioning = !wallBounceRef.current
      const sf = speedFactorRef.current
      for (const o of orbs) {
        if (o.frozen) continue
        if (!transitioning) {
          o.vx += (Math.random() - 0.5) * 0.012 * sf
          o.vy += (Math.random() - 0.5) * 0.012 * sf
        }
        const sp = Math.hypot(o.vx, o.vy)
        const maxSp = transitioning ? 8 : 0.18 * sf
        const minSp = transitioning ? 0 : 0.06 * sf
        if (sp > maxSp) { o.vx = o.vx / sp * maxSp; o.vy = o.vy / sp * maxSp }
        else if (sp < minSp && sp > 0) { o.vx = o.vx / sp * minSp; o.vy = o.vy / sp * minSp }
        o.x += o.vx
        o.y += o.vy
      }

      if (wallBounceRef.current) {
        for (const o of orbs) {
          if (o.x < o.r) { o.x = o.r; o.vx = Math.abs(o.vx) }
          if (o.x > W - o.r) { o.x = W - o.r; o.vx = -Math.abs(o.vx) }
          if (o.y < o.r) { o.y = o.r; o.vy = Math.abs(o.vy) }
          if (o.y > H - reservedBottom - o.r) { o.y = H - reservedBottom - o.r; o.vy = -Math.abs(o.vy) }
        }
      }

      for (const o of orbs) {
        const dx = o.x - cx, dy = o.y - cy
        const d = Math.hypot(dx, dy) || 0.001
        const min = SELF_RADIUS + o.r + exclusionPadRef.current
        if (d < min) {
          const nx = dx / d, ny = dy / d
          o.x = cx + nx * min
          o.y = cy + ny * min
          const dot = o.vx * nx + o.vy * ny
          if (dot < 0) {
            o.vx -= 2 * dot * nx
            o.vy -= 2 * dot * ny
          }
        }
      }

      for (const o of orbs) {
        if (o.el) o.el.style.transform = `translate(${o.x - o.r}px, ${o.y - o.r}px)`
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const handleOrbEnter = (idx: number) => {
    if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null }
    const orb = orbsRef.current[idx]
    if (!orb) return
    orb.frozen = true
    setHoveredIdx(idx)
    const W = sizeRef.current.w
    const halfTT = 70
    const clampedX = Math.max(halfTT + 4, Math.min(W - halfTT - 4, orb.x))
    const tooltipH = 80
    const below = orb.y - orb.r < tooltipH
    setTooltipPos({ x: clampedX, y: below ? orb.y + orb.r : orb.y - orb.r, below })
  }

  const handleOrbLeave = (idx: number) => {
    hoverTimerRef.current = setTimeout(() => {
      const orb = orbsRef.current[idx]
      if (orb) {
        const angle = Math.random() * Math.PI * 2
        const speed = 0.3
        orb.vx = Math.cos(angle) * speed
        orb.vy = Math.sin(angle) * speed
        orb.frozen = false
      }
      setHoveredIdx(null)
      setTooltipPos(null)
    }, 200)
  }

  const handleTooltipEnter = () => {
    if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null }
  }

  const handleUnfollow = async (id: string) => {
    await onRemoveFriend(id)
    setHoveredIdx(null)
    setTooltipPos(null)
  }

  const hoveredProfile = hoveredIdx !== null ? renderProfiles[hoveredIdx] : null

  return (
    <>
      <div className="s-body profile-orbit-body">
        <div className={`profile-orbit${scrolledUp && mode === 'party' ? ' orbit-scrolled' : ''}`} ref={containerRef} onWheel={handleWheel}>
          {viewOnly ? (
            <button className="orbit-mode-toggle-btn" onClick={onClose}>
              ← back
            </button>
          ) : (
            <button
              className="orbit-mode-toggle-btn"
              onClick={() => setMode(m => m === 'main' ? 'party' : 'main')}
            >
              {mode}
            </button>
          )}
          <div className={`orbit-orbs-layer${scrolledUp && mode === 'party' ? ' orbit-orbs-hidden' : ''}`}>
          {renderProfiles.map((p, i) => {
            const orb = orbsRef.current[i]
            const r = orb?.r ?? 14
            return (
              <div
                key={`${mode}-${p.id}`}
                className={`orbit-orb${p.isOnline ? '' : ' offline'}${exiting ? ' fading-out' : ''}`}
                ref={(el) => { if (orbsRef.current[i]) orbsRef.current[i]!.el = el }}
                style={{
                  width: r * 2,
                  height: r * 2,
                  background: p.avatar_color,
                  fontSize: Math.max(8, r * 0.55),
                  cursor: 'pointer',
                }}
                onMouseEnter={() => handleOrbEnter(i)}
                onMouseLeave={() => handleOrbLeave(i)}
                onClick={() => onOpenChat(p.id)}
              >
                {p.avatar_url && <img src={p.avatar_url} alt="" />}
                {liveHostIds?.has(p.id)
                  ? <div className="orbit-orb-livedot" />
                  : p.isOnline && <div className="orbit-orb-dot" />}
                {favorites.has(p.id) && <div className="orbit-orb-fav">★</div>}
              </div>
            )
          })}
          </div>

          <button
            className="profile-av-btn orbit-self"
            onClick={viewOnly ? undefined : handlePickFile}
            disabled={uploading || viewOnly}
            title={viewOnly ? displayName : 'Change photo'}
            style={{ width: SELF_RADIUS * 2, height: SELF_RADIUS * 2, cursor: viewOnly ? 'default' : undefined }}
          >
            <div className="av profile-av" style={{ background: color, width: SELF_RADIUS * 2, height: SELF_RADIUS * 2 }}>
              {photo ? <img src={photo} alt="avatar" /> : <span>{initials}</span>}
            </div>
            {viewOnly ? null : (
              <div className="profile-av-overlay">
                {uploading ? '...' : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                )}
              </div>
            )}
          </button>

          {hoveredProfile && tooltipPos && (
            <div
              className={`orbit-tooltip${tooltipPos.below ? ' below' : ''}`}
              style={{ left: tooltipPos.x, top: tooltipPos.y }}
              onMouseEnter={handleTooltipEnter}
              onMouseLeave={() => hoveredIdx !== null && handleOrbLeave(hoveredIdx)}
            >
              <div className="orbit-tt-name-row">
                <div className="orbit-tt-name">{hoveredProfile.display_name}</div>
                <button
                  className={`orbit-tt-star${favorites.has(hoveredProfile.id) ? ' on' : ''}`}
                  onClick={() => onToggleFav(hoveredProfile.id)}
                  title={favorites.has(hoveredProfile.id) ? 'Unfavorite' : 'Favorite'}
                >
                  ★
                </button>
              </div>
              <button className="orbit-tt-btn" onClick={() => handleUnfollow(hoveredProfile.id)}>following</button>
              <div className="orbit-tt-btn-row">
                <button className="orbit-tt-btn orbit-tt-msg" onClick={() => onOpenChat(hoveredProfile.id)}>message</button>
                {onViewProfile && <button className="orbit-tt-btn orbit-tt-prof" onClick={() => onViewProfile(hoveredProfile.id)}>profile</button>}
              </div>
              {(() => {
                if (!liveHostIds?.has(hoveredProfile.id)) return null
                const session = liveSessions?.find(s => s.host_id === hoveredProfile.id)
                if (!session || !onWatchLive) return null
                return (
                  <button
                    className="orbit-tt-btn orbit-tt-join-live"
                    onClick={() => onWatchLive(session.id)}
                  >
                    ● Join Live!
                  </button>
                )
              })()}
            </div>
          )}

          <div className="orbit-bottom">
            <div className="orbit-name">{displayName}</div>
          </div>

          {scrolledUp && mode === 'party' && (
            <>
              <div className="orbit-stats">
                <div
                  className={`orbit-stat${statList === 'members' ? ' active' : ''}`}
                  onClick={() => setStatList(s => s === 'members' ? null : 'members')}
                >
                  <span className="orbit-stat-count">{followerProfiles.length}</span>
                  <span className="orbit-stat-label">members</span>
                </div>
                <div
                  className={`orbit-stat${statList === 'following' ? ' active' : ''}`}
                  onClick={() => setStatList(s => s === 'following' ? null : 'following')}
                >
                  <span className="orbit-stat-count">{followingProfiles.length}</span>
                  <span className="orbit-stat-label">following</span>
                </div>
              </div>
              <div className={`orbit-stat-list${statList ? ' open' : ''}`}>
                {(statList === 'members' ? followerProfiles
                  : statList === 'following' ? followingProfiles
                  : lastListRef.current === 'members' ? followerProfiles
                  : followingProfiles
                ).map(p => (
                  <div key={p.id} className="orbit-stat-row" onClick={() => onOpenChat(p.id)}>
                    <div className="orbit-stat-av" style={{ background: p.avatar_color }}>
                      {p.avatar_url ? <img src={p.avatar_url} alt="" /> : <span>{p.initials}</span>}
                      {p.isOnline && <div className="orbit-stat-online" />}
                    </div>
                    <span className="orbit-stat-row-name">{p.display_name}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* --- Upload circle / Track display --- */}
          {scrolledUp && mode === 'party' && !statList && (
            <div className="orbit-track-area">
              {tracks.length === 0 ? (
                <div className="orbit-upload-circle" onClick={() => audioInputRef.current?.click()}>
                  <span className="orbit-upload-plus">+</span>
                </div>
              ) : (
                <div className="orbit-track-list">
                  {tracks.map(t => (
                    <div key={t.id} className="orbit-track-item" onClick={() => handleTrackPlay(t)}>
                      <div className={`orbit-track-cover${t.cover_url ? '' : ' orbit-track-cover-default'}`}>
                        {t.cover_url && <img src={t.cover_url} alt={t.title} />}
                      </div>
                      {playingTrackId === t.id && <div className="orbit-track-playing">▶</div>}
                      <div className="orbit-track-title">{t.title}</div>
                    </div>
                  ))}
                  <div className="orbit-upload-circle small" onClick={() => audioInputRef.current?.click()}>
                    <span className="orbit-upload-plus">+</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* --- Track metadata panel --- */}
          {trackPanel && (
            <div className="orbit-track-panel">
              <div className="orbit-track-panel-top">
                <div className="orbit-track-cover-pick" onClick={() => coverInputRef.current?.click()}>
                  {trackCoverPreview ? (
                    <img src={trackCoverPreview} alt="cover" />
                  ) : (
                    <span>+</span>
                  )}
                </div>
                <div className="orbit-track-fields">
                  <input
                    className="orbit-track-input orbit-track-title"
                    placeholder="Title"
                    value={trackMeta.title}
                    onChange={e => setTrackMeta(m => ({ ...m, title: e.target.value }))}
                  />
                  <input
                    className="orbit-track-input"
                    placeholder="Artist"
                    value={trackMeta.artist}
                    onChange={e => setTrackMeta(m => ({ ...m, artist: e.target.value }))}
                  />
                  <select
                    className="orbit-track-select"
                    value={trackMeta.version}
                    onChange={e => setTrackMeta(m => ({ ...m, version: e.target.value }))}
                  >
                    {Array.from({ length: 20 }, (_, i) => (
                      <option key={i + 1} value={String(i + 1)}>v{i + 1}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="orbit-track-btns">
                <button className="orbit-track-btn cancel" onClick={() => { setTrackPanel(false); setPendingAudioFiles([]) }}>Cancel</button>
                <button className="orbit-track-btn save" onClick={handleTrackSave} disabled={trackSaving || !trackMeta.title}>
                  {trackSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          )}

          <audio ref={trackAudioRef} onEnded={() => setPlayingTrackId(null)} />
          <input ref={audioInputRef} type="file" accept="audio/*" multiple style={{ display: 'none' }} onChange={handleAudioSelect} />
          <input ref={coverInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCoverSelect} />

        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {msg && <div className="profile-msg">{msg}</div>}
      </div>
    </>
  )
}
