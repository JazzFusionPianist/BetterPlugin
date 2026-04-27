import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useProfiles } from '../hooks/useProfiles'
import { useMessages } from '../hooks/useMessages'
import { usePresence } from '../hooks/usePresence'
import { useNotifications } from '../hooks/useNotifications'
import { useFriendEvents } from '../hooks/useFriendEvents'
import { useFollows } from '../hooks/useFollows'
import { useConversations } from '../hooks/useConversations'
import ChatView from '../components/collab/ChatView'
import ConversationsPanel from '../components/collab/ConversationsPanel'
import FriendsList from '../components/collab/FriendsList'
import SettingsPanel from '../components/collab/SettingsPanel'
import DisplayPanel from '../components/collab/DisplayPanel'
import InformationPanel from '../components/collab/InformationPanel'
import ProfilePanel from '../components/collab/ProfilePanel'
import AddFriendPanel from '../components/collab/AddFriendPanel'
import LivePanel from '../components/collab/LivePanel'
import LiveViewer from '../components/collab/LiveViewer'
import NotificationSettingsPanel, { readNotifSettings } from '../components/collab/NotificationSettingsPanel'
import type { NotifSettings } from '../components/collab/NotificationSettingsPanel'
import type { Profile } from '../types/collab'
import type { VideoSource } from '../types/live'
import { useLive, type LiveSession } from '../hooks/useLive'
import { useMediaSource } from '../hooks/useMediaSource'
import { useLiveBroadcaster } from '../hooks/useLiveBroadcaster'
import { useLiveChat } from '../hooks/useLiveChat'
import './collab.css'

interface Props { user: User }
interface TooltipInfo { profile: Profile; x: number; y: number; arrowX: number; arrowUp: boolean }

export default function CollabPage({ user }: Props) {
  if (!supabase) return <div style={{ padding: 20, fontSize: 12, fontFamily: 'sans-serif', color: '#999' }}>Supabase not configured.</div>
  return <CollabPageInner user={user} />
}

const SWIPE_THRESHOLD = 72

function SwipeRow({ children, onDismiss }: { children: React.ReactNode; onDismiss: () => void }) {
  const [dx, setDx] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const startX   = useRef<number | null>(null)
  const dragging  = useRef(false)   // 실제 스와이프 중인지 (5px 초과 이동)
  const dxRef    = useRef(0)

  const dismiss = useCallback(() => {
    setLeaving(true)
    setTimeout(onDismiss, 220)
  }, [onDismiss])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    startX.current = e.clientX
    dragging.current = false
    dxRef.current = 0
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (startX.current === null) return
    const d = e.clientX - startX.current
    // 5px 이상 움직여야 스와이프로 인식 (작은 떨림으로 클릭 방해 방지)
    if (Math.abs(d) > 5) {
      dragging.current = true
      dxRef.current = d
      setDx(d)
    }
  }
  const onPointerUp = () => {
    startX.current = null
    if (!dragging.current) return   // 탭(클릭)이면 그냥 통과
    dragging.current = false
    if (Math.abs(dxRef.current) > SWIPE_THRESHOLD) dismiss()
    else { setDx(0); dxRef.current = 0 }
  }

  const style: React.CSSProperties = leaving
    ? { transform: `translateX(${dxRef.current >= 0 ? '110%' : '-110%'})`, opacity: 0, transition: 'transform 0.22s ease-in, opacity 0.22s ease-in' }
    : dx !== 0
      ? { transform: `translateX(${dx}px)`, transition: 'none' }
      : { transform: 'translateX(0)', transition: 'transform 0.18s ease-out' }

  return (
    <div className="swipe-row-wrap">
      <div
        className="swipe-row-inner"
        style={{ ...style, userSelect: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {children}
      </div>
      <div className="swipe-hint" style={{ opacity: Math.min(Math.abs(dx) / SWIPE_THRESHOLD, 1) * 0.6 }} />
    </div>
  )
}

function CollabPageInner({ user }: Props) {
  const client = supabase!
  const pluginRef = useRef<HTMLDivElement>(null)

  const [selectedId, setSelectedId]             = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen]         = useState(false)
  const [displayOpen, setDisplayOpen]           = useState(false)
  const [infoOpen, setInfoOpen]                 = useState(false)
  const [notifSettingsOpen, setNotifSettingsOpen] = useState(false)
  const [addFriendOpen, setAddFriendOpen]       = useState(false)
  const [searchOpen, setSearchOpen]             = useState(false)
  const [searchQuery, setSearchQuery]           = useState('')
  const [notifOpen, setNotifOpen]               = useState(false)
  const [convOpen, setConvOpen]                 = useState(false)
  const [liveOpen, setLiveOpen]                 = useState(false)
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null)
  const [tooltip, setTooltip]                   = useState<TooltipInfo | null>(null)
  const [galleryPopup, setGalleryPopup]         = useState<{ profile: Profile; x: number; y: number; below: boolean } | null>(null)
  const hideTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [isDark, setIsDark] = useState(() => localStorage.getItem('collab_dark') === 'true')
  const [wallpaper, setWallpaper] = useState<string | null>(() => localStorage.getItem('collab_wallpaper'))
  const handleSetWallpaper = (url: string | null) => {
    if (url) localStorage.setItem('collab_wallpaper', url)
    else localStorage.removeItem('collab_wallpaper')
    setWallpaper(url)
  }
  const [viewMode, setViewMode] = useState<'default' | 'gallery' | 'list'>(() =>
    (localStorage.getItem('collab_view_v2') as 'default' | 'gallery' | 'list') ?? 'default'
  )
  const [notifSettings, setNotifSettings] = useState<NotifSettings>(readNotifSettings)

  const favKey = `collab_favorites_${user.id}`
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try { const raw = localStorage.getItem(favKey); return raw ? new Set(JSON.parse(raw) as string[]) : new Set() }
    catch { return new Set() }
  })

  const { profiles, me, loading: profilesLoading, refetch: refetchProfiles, updateMyAvatar, updateMe } = useProfiles(client, user.id)

  // Ensure a profile row exists for the current user (in case signup trigger didn't run)
  useEffect(() => {
    if (!profilesLoading && !me) {
      client.from('profiles').upsert({ id: user.id, display_name: user.email?.split('@')[0] ?? 'User' }, { onConflict: 'id', ignoreDuplicates: true })
        .then(() => refetchProfiles())
    }
  }, [profilesLoading, me, client, user.id, user.email, refetchProfiles])

  const { messages, loading: messagesLoading, send } = useMessages(client, user.id, selectedId)
  const onlineIds  = usePresence(client, user.id)
  const { unread, markSeen } = useNotifications(client, user.id)
  const { events: friendEvents, unreadCount: friendEventCount, markAllRead: markFriendEventsRead, dismiss: dismissFriendEvent } = useFriendEvents(client, user.id)
  const { followingIds, followerIds, mutualIds, follow, unfollow } = useFollows(client, user.id)
  const { conversations } = useConversations(client, user.id)
  const { liveSessions, mySession, liveHostIds, startLive, endLive, updateLive } = useLive(client, user.id)
  const { stream: localStream, error: mediaError, startStream, stopStream, replaceSource, listSources, listMicrophones, screenCaptureSupported, requestDevicePermissions } = useMediaSource()
  const sources     = useMemo(() => listSources(),     [listSources])
  const microphones = useMemo(() => listMicrophones(), [listMicrophones])
  const { viewerCount, totalViewers, peakViewers } = useLiveBroadcaster(client, user.id, mySession?.id ?? null, localStream)
  // The viewer keeps its own snapshot of the session it's watching so the
  // LiveViewer stays mounted when the host ends the stream (the row drops
  // out of `liveSessions`). The ended screen needs to render until the
  // viewer clicks Back.
  const [watchingSession, setWatchingSession] = useState<LiveSession | null>(null)
  const watchingSessionId = watchingSession?.id ?? null

  const profilesWithStatus = useMemo(() => profiles.map(p => ({ ...p, isOnline: onlineIds.has(p.id) })), [profiles, onlineIds])
  // 친구 목록 = 서로 팔로우한 유저만
  const friendProfiles  = useMemo(() => profilesWithStatus.filter(p => mutualIds.has(p.id)), [profilesWithStatus, mutualIds])
  const followingProfiles = useMemo(() => profilesWithStatus.filter(p => followingIds.has(p.id)), [profilesWithStatus, followingIds])
  const followerProfiles  = useMemo(() => profilesWithStatus.filter(p => followerIds.has(p.id)), [profilesWithStatus, followerIds])
  const selectedProfile = profilesWithStatus.find(p => p.id === selectedId) ?? null

  // Friend orbit viewing
  const [friendFollowerIds, setFriendFollowerIds] = useState<Set<string>>(new Set())
  const viewingProfile = viewingProfileId ? profilesWithStatus.find(p => p.id === viewingProfileId) ?? null : null
  const viewingFollowerProfiles = useMemo(() => {
    const pool = me ? [...profilesWithStatus, { ...me, isOnline: true }] : profilesWithStatus
    return pool.filter(p => friendFollowerIds.has(p.id))
  }, [profilesWithStatus, friendFollowerIds, me])

  // Watching a friend's live — host is derived from the captured session so
  // the avatar/name stay visible on the ended screen even after the row
  // has been removed from liveSessions.
  const watchingHost = watchingSession
    ? profilesWithStatus.find(p => p.id === watchingSession.host_id) ?? null
    : null

  const handleOpenWatching = useCallback((sessionId: string) => {
    const s = liveSessions.find(x => x.id === sessionId)
    if (s) setWatchingSession(s)
  }, [liveSessions])

  // Live chat — scoped to whichever session we're currently engaged with
  // (our own broadcast or a friend we're watching).
  const chatSessionId = mySession?.id ?? watchingSessionId ?? null
  const chatMe = useMemo(() => me ? {
    id: user.id,
    name: me.display_name || (user.email?.split('@')[0] ?? 'user'),
    color: me.avatar_color || '#4A8FE7',
  } : null, [me, user.id, user.email])
  const { messages: chatMessages, sendMessage: sendChat } = useLiveChat(client, chatSessionId, chatMe)

  const [liveError, setLiveError] = useState<string | null>(null)
  const handleStartLive = useCallback(async (title: string, source: VideoSource, micDeviceId: string | null) => {
    setLiveError(null)
    const ms = await startStream(source, micDeviceId)
    if (!ms) return
    const hasVideo = source.kind !== 'none'
    const hasAudio = ms.getAudioTracks().length > 0
    try {
      // DB column is restricted to the legacy enum — map native-* back to
      // its semantic equivalent for live_sessions storage.
      const videoSource: 'daw' | 'screen' | 'camera' | 'none' =
        source.kind === 'native-window'  ? 'daw'
        : source.kind === 'native-display' ? 'screen'
        : source.kind === 'native-picker'  ? 'daw'
        : source.kind
      await startLive(title, {
        has_video: hasVideo,
        has_audio: hasAudio,
        video_source: videoSource,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setLiveError(`Failed to start live: ${msg}`)
      stopStream() // release the media since we can't broadcast
    }
  }, [startStream, stopStream, startLive])

  const handleEndLive = useCallback(async () => {
    stopStream()
    await endLive()
  }, [stopStream, endLive])

  const handleReplaceSource = useCallback(async (source: VideoSource, micDeviceId: string | null): Promise<VideoSource | null> => {
    const actualSource = await replaceSource(source, micDeviceId)
    if (!actualSource) return null
    // Sync the ACTUAL source (may be reverted on picker cancel) into the DB.
    const hasVideo = actualSource.kind !== 'none'
    const videoSource: LiveSession['video_source'] =
      actualSource.kind === 'native-window'  ? 'daw'
      : actualSource.kind === 'native-display' ? 'screen'
      : actualSource.kind === 'native-picker'  ? 'daw'
      : (actualSource.kind as LiveSession['video_source'])
    await updateLive({ has_video: hasVideo, video_source: videoSource })
    return actualSource
  }, [replaceSource, updateLive])

  // 알림 설정에 따라 보이는 알림 필터링
  const visibleEvents   = notifSettings.follow  ? friendEvents : []
  const visibleUnread   = notifSettings.message ? unread       : new Map()
  // 알림 벨 카운트 (설정에 따라 필터링)
  const bellCount       = (notifSettings.follow ? friendEventCount : 0) + (notifSettings.message ? unread.size : 0)

  const handleToggleFav = (id: string) => {
    setFavorites(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      localStorage.setItem(favKey, JSON.stringify([...next]))
      return next
    })
  }
  const handleToggleDark      = () => setIsDark(prev => { const next = !prev; localStorage.setItem('collab_dark', String(next)); return next })
  const handleViewModeChange  = (mode: 'default' | 'gallery' | 'list') => { setViewMode(mode); localStorage.setItem('collab_view_v2', mode) }

  const handleToggleSearch = () => setSearchOpen(prev => {
    if (prev) { setSearchQuery('') } else {
      setSettingsOpen(false); setDisplayOpen(false); setInfoOpen(false); setNotifSettingsOpen(false)
      setAddFriendOpen(false); setNotifOpen(false); setConvOpen(false)
      setTimeout(() => searchInputRef.current?.focus(), 200)
    }
    return !prev
  })
  const closeSearch = () => { setSearchOpen(false); setSearchQuery('') }
  const handleToggleSettings  = () => setSettingsOpen(prev => {
    if (!prev) { setAddFriendOpen(false); setNotifOpen(false); setConvOpen(false); setDisplayOpen(false); setInfoOpen(false); setNotifSettingsOpen(false); closeSearch() }
    else { setDisplayOpen(false); setInfoOpen(false); setNotifSettingsOpen(false) }
    return !prev
  })
  const closeSettingsPanels = () => { setSettingsOpen(false); setDisplayOpen(false); setInfoOpen(false); setNotifSettingsOpen(false) }
  const handleToggleAddFriend = () => setAddFriendOpen(prev => { if (!prev) { closeSettingsPanels(); setNotifOpen(false); setConvOpen(false); closeSearch() } return !prev })
  const handleToggleNotif     = () => setNotifOpen(prev => { if (!prev) { closeSettingsPanels(); setAddFriendOpen(false); setConvOpen(false); closeSearch(); setTimeout(() => markFriendEventsRead(), 400) } return !prev })
  const handleToggleConv      = () => setConvOpen(prev => { if (!prev) { closeSettingsPanels(); setAddFriendOpen(false); setNotifOpen(false); closeSearch() } return !prev })
  const handleToggleLive      = () => setLiveOpen(prev => {
    if (!prev) {
      closeSettingsPanels(); setAddFriendOpen(false); setNotifOpen(false); setConvOpen(false); closeSearch()
      // Unlock mic labels/IDs so the dropdown is populated when the panel opens
      requestDevicePermissions()
    }
    return !prev
  })

  const handleTooltipEnter = () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current) }
  const handleTooltipLeave = () => { hideTimerRef.current = setTimeout(() => setTooltip(null), 180) }
  const handleOpenChat     = (id: string) => { setTooltip(null); setGalleryPopup(null); setLiveOpen(false); setSelectedId(id); markSeen(id) }

  const handleGalleryCellClick = (profile: Profile, el: HTMLDivElement) => {
    // Toggle off if same profile already open
    if (galleryPopup?.profile.id === profile.id) { setGalleryPopup(null); return }
    const rect = el.getBoundingClientRect()
    const POPUP_W = 160
    const x = Math.max(4, Math.min(rect.left + rect.width / 2 - POPUP_W / 2, window.innerWidth - POPUP_W - 4))
    // Prefer above the cell; fall back to below if not enough space
    const spaceAbove = rect.top - 8
    const below = spaceAbove <= 120
    const y = below ? rect.bottom + 8 : rect.top - 8
    setGalleryPopup({ profile, x, y, below })
  }
  const handleViewProfile  = async (id: string) => {
    const all: string[] = []
    let from = 0
    const PAGE = 1000
    while (true) {
      const { data } = await client.from('follows').select('follower_id').eq('following_id', id).range(from, from + PAGE - 1)
      if (!data || data.length === 0) break
      all.push(...data.map((r: { follower_id: string }) => r.follower_id))
      if (data.length < PAGE) break
      from += PAGE
    }
    setFriendFollowerIds(new Set(all))
    setViewingProfileId(id)
  }

  useEffect(() => { if (selectedId) { setSearchOpen(false); setSearchQuery(''); setNotifOpen(false); setConvOpen(false) } }, [selectedId])

  useEffect(() => {
    if (!galleryPopup) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Element
      if (!target.closest('.gcell') && !target.closest('.gallery-popup')) {
        setGalleryPopup(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [galleryPopup])

  const handleGoHome = () => {
    setSelectedId(null); setViewingProfileId(null)
    setSettingsOpen(false); setDisplayOpen(false); setInfoOpen(false); setNotifSettingsOpen(false)
    setAddFriendOpen(false); setNotifOpen(false); setConvOpen(false); setLiveOpen(false)
    setWatchingSession(null)
    closeSearch()
  }

  const pluginClass = ['plugin',
    selectedId        ? 'chat-open'          : '',
    isDark            ? 'dark'               : '',
    settingsOpen      ? 'settings-open'      : '',
    displayOpen       ? 'display-open'       : '',
    infoOpen          ? 'info-open'          : '',
    notifSettingsOpen ? 'notifsettings-open' : '',
    addFriendOpen     ? 'addfriend-open'     : '',
    convOpen          ? 'conv-open'          : '',
    (liveOpen || !!watchingSession) ? 'live-open' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={pluginClass} ref={pluginRef} style={wallpaper ? { backgroundImage: `url(${wallpaper})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
      <div className="top-bar">
        <span className="app-title" onClick={handleGoHome} style={{ cursor: 'pointer' }}>CoOp</span>

        {/* Notification */}
        <div className={`icon-btn${notifOpen ? ' active' : ''}`} onClick={handleToggleNotif} title="Notifications" style={{ position: 'relative' }}>
          <svg viewBox="0 0 16 16" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2a4 4 0 00-4 4v2.5L2.5 11h11L12 8.5V6a4 4 0 00-4-4z" /><path d="M6.5 12.5a1.5 1.5 0 003 0" />
          </svg>
          {bellCount > 0 && <span className="notif-dot" />}
        </div>

        {/* Chat list */}
        <div className={`icon-btn${convOpen ? ' active' : ''}`} onClick={handleToggleConv} title="Messages">
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 3.5A1.5 1.5 0 013.5 2h9A1.5 1.5 0 0114 3.5v7A1.5 1.5 0 0112.5 12H9.5l-3 2.5c-.3.25-.5.1-.5-.25V12H3.5A1.5 1.5 0 012 10.5v-7z"/>
          </svg>
        </div>

        {/* Search */}
        <div className={`icon-btn${searchOpen ? ' active' : ''}`} onClick={handleToggleSearch} title="Search">
          <svg viewBox="0 0 16 16" strokeWidth="1.5"><circle cx="6.5" cy="6.5" r="4" /><path d="M10 10l3 3" strokeLinecap="round" /></svg>
        </div>

        {/* Add Friend */}
        <div className={`icon-btn${addFriendOpen ? ' active' : ''}`} onClick={handleToggleAddFriend} title="Find People" style={{ position: 'relative' }}>
          <svg viewBox="0 0 16 16" strokeWidth="1.5" fill="none">
            <circle cx="5.5" cy="5.5" r="2.4" /><path d="M1.5 13c.6-2.1 2.4-3 4-3s3.4.9 4 3" strokeLinecap="round" /><path d="M12.5 6v4M10.5 8h4" strokeLinecap="round" />
          </svg>
        </div>

        {/* Live */}
        <div
          className={`icon-btn${liveOpen ? ' active' : ''}${mySession ? ' live-btn-active' : ''}`}
          onClick={handleToggleLive}
          title="Live"
          style={{ position: 'relative', opacity: mySession ? 1 : undefined }}
        >
          <svg viewBox="0 0 16 16" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" stroke={mySession ? '#FF3B30' : 'var(--t1)'}>
            <path d="M3.5 11.5a6 6 0 019 0" /><path d="M1 9a9 9 0 0114 0" />
            <circle cx="8" cy="13.5" r="1" fill={mySession ? '#FF3B30' : 'var(--t1)'} stroke="none" />
          </svg>
          {mySession && <span className="live-btn-dot" />}
        </div>

        {/* Settings */}
        <div className={`icon-btn${settingsOpen ? ' active' : ''}`} onClick={handleToggleSettings} title="Settings">
          <svg viewBox="0 0 16 16" strokeWidth="1.4"><circle cx="8" cy="8" r="2" /><path d="M8 2v1.2M8 12.8V14M2 8h1.2M12.8 8H14M3.76 3.76l.85.85M11.39 11.39l.85.85M3.76 12.24l.85-.85M11.39 4.61l.85-.85" /></svg>
        </div>
      </div>

      {/* Search bar */}
      <div className={`search-bar${searchOpen ? ' open' : ''}`}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--t3)" strokeWidth="1.5" style={{ flexShrink: 0 }}><circle cx="6.5" cy="6.5" r="4" /><path d="M10 10l3 3" strokeLinecap="round" /></svg>
        <input ref={searchInputRef} className="search-input" type="text" placeholder="search friends..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        <button className={`search-clear${searchQuery ? ' visible' : ''}`} onClick={() => setSearchQuery('')}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--t3)" strokeWidth="1.8" strokeLinecap="round"><path d="M1 1l8 8M9 1L1 9" /></svg>
        </button>
      </div>

      {/* Notification panel */}
      {notifOpen && (
        <div className="notif-panel">
          {visibleEvents.length === 0 && visibleUnread.size === 0 && (
            <div className="notif-empty">No notifications</div>
          )}

          {/* Follow 알림 */}
          {visibleEvents.map(ev => (
            <SwipeRow key={ev.id} onDismiss={() => dismissFriendEvent(ev.id)}>
              <div className={`notif-row${ev.read ? '' : ' notif-unread'}`}>
                <div className="av sz32" style={{ background: ev.actor.avatar_color, flexShrink: 0 }}>
                  {ev.actor.avatar_url
                    ? <img src={ev.actor.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    : ev.actor.display_name.slice(0, 2).toUpperCase()}
                </div>
                <div className="notif-info">
                  <div className="notif-name">{ev.actor.display_name}</div>
                  <div className="notif-preview">followed you</div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {!followingIds.has(ev.actor.id) && (
                    <button
                      className="notif-action-btn notif-accept"
                      onClick={async e => { e.stopPropagation(); await follow(ev.actor.id) }}
                      title="Follow back"
                    >
                      Follow
                    </button>
                  )}
                  <button
                    className="notif-action-btn notif-dismiss-btn"
                    onClick={e => { e.stopPropagation(); dismissFriendEvent(ev.id) }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            </SwipeRow>
          ))}

          {/* 읽지 않은 메시지 알림 */}
          {Array.from(visibleUnread.entries()).map(([senderId, msgs]) => {
            const profile = profilesWithStatus.find(p => p.id === senderId)
            const count   = msgs.length
            return (
              <SwipeRow key={senderId} onDismiss={() => markSeen(senderId)}>
                <div className="notif-row notif-unread" onClick={() => { setNotifOpen(false); handleOpenChat(senderId) }}>
                  <div className="av sz32" style={{ background: profile?.avatar_color ?? '#999' }}>
                    {profile?.avatar_url
                      ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      : profile?.initials ?? '?'}
                  </div>
                  <div className="notif-info">
                    <div className="notif-name">{profile?.display_name ?? 'Unknown'}</div>
                    <div className="notif-preview">{count === 1 ? msgs[0]!.content : `${count} new messages`}</div>
                  </div>
                  <div className="notif-count">{count}</div>
                </div>
              </SwipeRow>
            )
          })}
        </div>
      )}

      {/* Sliding content */}
      <div className="content">
        <div className="view fview">
          {viewingProfileId && viewingProfile
            ? <ProfilePanel supabase={client} user={user} me={viewingProfile} followingProfiles={[]} followerProfiles={viewingFollowerProfiles} onClose={() => setViewingProfileId(null)} onUpdated={refetchProfiles} onOpenChat={handleOpenChat} onRemoveFriend={unfollow} favorites={favorites} onToggleFav={handleToggleFav} liveHostIds={liveHostIds} liveSessions={liveSessions} onWatchLive={sessionId => { handleOpenWatching(sessionId); setLiveOpen(true) }} viewOnly />
            : viewMode === 'default'
              ? <ProfilePanel supabase={client} user={user} me={me} followingProfiles={followingProfiles} followerProfiles={followerProfiles} onClose={() => {}} onUpdated={refetchProfiles} onOpenChat={handleOpenChat} onRemoveFriend={unfollow} favorites={favorites} onToggleFav={handleToggleFav} onViewProfile={handleViewProfile} onAvatarUpdated={updateMyAvatar} liveHostIds={liveHostIds} liveSessions={liveSessions} onWatchLive={sessionId => { handleOpenWatching(sessionId); setLiveOpen(true) }} />
              : <FriendsList profiles={friendProfiles} favorites={favorites} loading={profilesLoading} viewMode={viewMode} searchQuery={searchQuery} liveHostIds={liveHostIds} onSelect={handleOpenChat} onToggleFav={handleToggleFav} onGalleryCellClick={handleGalleryCellClick} />
          }
        </div>
        <div className="view cview">
          {selectedProfile && <ChatView supabase={client} currentUserId={user.id} otherProfile={selectedProfile} messages={messages} loading={messagesLoading} onSend={send} onBack={() => setSelectedId(null)} />}
        </div>
        <div className="view sview">
          <SettingsPanel
            onClose={() => { setSettingsOpen(false); setDisplayOpen(false); setInfoOpen(false); setNotifSettingsOpen(false) }}
            onOpenDisplay={() => setDisplayOpen(true)}
            onOpenInfo={() => setInfoOpen(true)}
            onOpenNotifSettings={() => setNotifSettingsOpen(true)}
            onSignOut={() => client.auth.signOut()}
          />
        </div>
        <div className="view dview">
          <DisplayPanel isDark={isDark} viewMode={viewMode} wallpaper={wallpaper} onToggleDark={handleToggleDark} onViewModeChange={handleViewModeChange} onSetWallpaper={handleSetWallpaper} onClose={() => setDisplayOpen(false)} />
        </div>
        <div className="view iview">
          <InformationPanel supabase={client} user={user} me={me} onClose={() => setInfoOpen(false)} onUpdated={refetchProfiles} onNameSaved={(n) => updateMe({ display_name: n, initials: n.split(' ').slice(0,2).map(w => w[0] ?? '').join('').toUpperCase() })} />
        </div>
        <div className="view nsview">
          <NotificationSettingsPanel onClose={() => setNotifSettingsOpen(false)} onSettingsChange={setNotifSettings} />
        </div>
        <div className="view convview">
          <ConversationsPanel
            conversations={conversations}
            profiles={profilesWithStatus}
            favorites={favorites}
            currentUserId={user.id}
            onOpenChat={handleOpenChat}
          />
        </div>
        <div className="view lvview">
          {watchingSession ? (
            <LiveViewer
              supabase={client}
              viewerId={user.id}
              session={watchingSession}
              host={watchingHost}
              currentUserId={user.id}
              chatMessages={chatMessages}
              sessionEnded={!liveSessions.find(s => s.id === watchingSession.id)}
              onSendChat={sendChat}
              onClose={handleGoHome}
            />
          ) : (
            <LivePanel
              isOpen={liveOpen}
              mySession={mySession}
              liveSessions={liveSessions}
              profiles={profilesWithStatus}
              myProfile={me}
              sources={sources}
              microphones={microphones}
              localStream={localStream}
              viewerCount={viewerCount}
              totalViewers={totalViewers}
              peakViewers={peakViewers}
              onReplaceSource={handleReplaceSource}
              mediaError={mediaError || liveError}
              screenCaptureSupported={screenCaptureSupported}
              currentUserId={user.id}
              chatMessages={chatMessages}
              onSendChat={sendChat}
              onStartLive={handleStartLive}
              onEndLive={handleEndLive}
              onWatchLive={(sessionId) => handleOpenWatching(sessionId)}
              onClose={() => setLiveOpen(false)}
            />
          )}
        </div>

        <div className="view afview">
          <AddFriendPanel
            allProfiles={profilesWithStatus}
            followingIds={followingIds}
            followerIds={followerIds}
            mutualIds={mutualIds}
            onFollow={follow}
            onUnfollow={unfollow}
            onClose={() => setAddFriendOpen(false)}
          />
        </div>
      </div>

      {galleryPopup && (
        <div
          className={`orbit-tooltip gallery-popup${galleryPopup.below ? ' below' : ''}`}
          style={{
            position: 'fixed',
            left: galleryPopup.x,
            top: galleryPopup.y,
            transform: galleryPopup.below ? 'none' : 'translateY(-100%)',
            zIndex: 200,
          }}
        >
          <div className="orbit-tt-name-row">
            <div className="orbit-tt-name">{galleryPopup.profile.display_name}</div>
            <button
              className={`orbit-tt-star${favorites.has(galleryPopup.profile.id) ? ' on' : ''}`}
              onClick={() => handleToggleFav(galleryPopup.profile.id)}
            >★</button>
          </div>
          {followingIds.has(galleryPopup.profile.id)
            ? <button className="orbit-tt-btn" onClick={() => { unfollow(galleryPopup.profile.id); setGalleryPopup(null) }}>following</button>
            : <button className="orbit-tt-btn orbit-tt-prof" onClick={() => { follow(galleryPopup.profile.id); setGalleryPopup(null) }}>follow</button>
          }
          <div className="orbit-tt-btn-row">
            <button className="orbit-tt-btn orbit-tt-msg" onClick={() => handleOpenChat(galleryPopup.profile.id)}>message</button>
            <button className="orbit-tt-btn orbit-tt-prof" onClick={() => { setGalleryPopup(null); handleViewProfile(galleryPopup.profile.id) }}>profile</button>
          </div>
          {(() => {
            const liveSession = liveSessions.find(s => s.host_id === galleryPopup.profile.id)
            if (!liveSession) return null
            return (
              <button
                className="orbit-tt-btn orbit-tt-join-live"
                onClick={() => { setGalleryPopup(null); handleOpenWatching(liveSession.id); setLiveOpen(true) }}
              >
                ● Join Live!
              </button>
            )
          })()}
        </div>
      )}

      {tooltip && (
        <div className="tooltip visible" style={{ left: tooltip.x, top: tooltip.y }} onMouseEnter={handleTooltipEnter} onMouseLeave={handleTooltipLeave}>
          <div className="tt-row">
            <div className="av sz32" style={{ background: tooltip.profile.avatar_color }}>
              {tooltip.profile.avatar_url
                ? <img src={tooltip.profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : tooltip.profile.initials}
            </div>
            <div className="tt-info"><div className="tt-name">{tooltip.profile.display_name}</div><div className="tt-sub">{tooltip.profile.isOnline ? 'online' : 'offline'}</div></div>
          </div>
          <button className="tt-btn" onClick={() => handleOpenChat(tooltip.profile.id)}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--t1)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
            message
          </button>
          <div className={`tt-arrow ${tooltip.arrowUp ? 'up' : 'down'}`} style={{ left: tooltip.arrowX }} />
        </div>
      )}
    </div>
  )
}
