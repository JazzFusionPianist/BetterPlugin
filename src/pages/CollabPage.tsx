import { useState, useMemo, useRef, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useProfiles } from '../hooks/useProfiles'
import { useMessages } from '../hooks/useMessages'
import { usePresence } from '../hooks/usePresence'
import { useNotifications } from '../hooks/useNotifications'
import FriendsList from '../components/collab/FriendsList'
import ChatView from '../components/collab/ChatView'
import SettingsPanel from '../components/collab/SettingsPanel'
import ProfilePanel from '../components/collab/ProfilePanel'
import type { Profile } from '../types/collab'
import './collab.css'

interface Props {
  user: User
}

interface TooltipInfo {
  profile: Profile
  x: number
  y: number
  arrowX: number
  arrowUp: boolean
}

export default function CollabPage({ user }: Props) {
  if (!supabase) {
    return <div style={{ padding: 20, fontSize: 12, fontFamily: 'sans-serif', color: '#999' }}>Supabase not configured.</div>
  }

  return <CollabPageInner user={user} />
}

function CollabPageInner({ user }: Props) {
  const client = supabase!
  const pluginRef = useRef<HTMLDivElement>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [addFriendOpen, setAddFriendOpen] = useState(false)
  const [addFriendQuery, setAddFriendQuery] = useState('')
  const [notifOpen, setNotifOpen] = useState(false)
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const addFriendInputRef = useRef<HTMLInputElement>(null)

  const [isDark, setIsDark] = useState(() => localStorage.getItem('collab_dark') === 'true')
  const [viewMode, setViewMode] = useState<'gallery' | 'list'>(() =>
    (localStorage.getItem('collab_view') as 'gallery' | 'list') ?? 'gallery'
  )

  const favKey = `collab_favorites_${user.id}`
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(favKey)
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
    } catch {
      return new Set()
    }
  })

  const { profiles, me, loading: profilesLoading, refetch: refetchProfiles } = useProfiles(client, user.id)
  const { messages, loading: messagesLoading, send } = useMessages(client, user.id, selectedId)
  const onlineIds = usePresence(client, user.id)
  const { unread, markSeen } = useNotifications(client, user.id)

  const profilesWithStatus = useMemo(
    () => profiles.map(p => ({ ...p, isOnline: onlineIds.has(p.id) })),
    [profiles, onlineIds]
  )

  const selectedProfile = profilesWithStatus.find(p => p.id === selectedId) ?? null

  const handleToggleFav = (id: string) => {
    setFavorites(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      localStorage.setItem(favKey, JSON.stringify([...next]))
      return next
    })
  }

  const handleToggleDark = () => {
    setIsDark(prev => {
      const next = !prev
      localStorage.setItem('collab_dark', String(next))
      return next
    })
  }

  const handleViewModeChange = (mode: 'gallery' | 'list') => {
    setViewMode(mode)
    localStorage.setItem('collab_view', mode)
  }

  const handleToggleSearch = () => {
    setSearchOpen(prev => {
      if (prev) {
        setSearchQuery('')
      } else {
        setAddFriendOpen(false)
        setAddFriendQuery('')
        setTimeout(() => searchInputRef.current?.focus(), 200)
      }
      return !prev
    })
  }

  const handleToggleAddFriend = () => {
    setAddFriendOpen(prev => {
      if (prev) {
        setAddFriendQuery('')
      } else {
        setSearchOpen(false)
        setSearchQuery('')
        setTimeout(() => addFriendInputRef.current?.focus(), 200)
      }
      return !prev
    })
  }

  const handleToggleSettings = () => {
    setSettingsOpen(prev => !prev)
    if (!settingsOpen) setProfileOpen(false)
  }

  const handleToggleProfile = () => {
    setProfileOpen(prev => !prev)
    if (!profileOpen) setSettingsOpen(false)
  }

  const handleCellHover = (profile: Profile, el: HTMLDivElement) => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    const pluginEl = pluginRef.current
    if (!pluginEl) return
    const pR = pluginEl.getBoundingClientRect()
    const eR = el.getBoundingClientRect()
    const TW = 162, TH = 86
    const relL = eR.left - pR.left
    const relT = eR.top - pR.top
    let left = relL + eR.width / 2 - TW / 2
    let top = relT - TH - 10
    let arrowUp = false
    if (top < 50) {
      top = relT + eR.height + 10
      arrowUp = true
    }
    left = Math.max(8, Math.min(left, 300 - TW - 8))
    const rawArrowX = (relL + eR.width / 2) - left - 6
    const arrowX = Math.max(12, Math.min(rawArrowX, TW - 24))
    setTooltip({ profile, x: left, y: top, arrowX, arrowUp })
  }

  const handleCellLeave = () => {
    hideTimerRef.current = setTimeout(() => setTooltip(null), 180)
  }

  const handleTooltipEnter = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
  }

  const handleTooltipLeave = () => {
    hideTimerRef.current = setTimeout(() => setTooltip(null), 180)
  }

  const handleOpenChat = (id: string) => {
    setTooltip(null)
    setSelectedId(id)
    markSeen(id)
  }

  const handleToggleNotif = () => {
    setNotifOpen(prev => !prev)
  }

  // Close search when entering chat
  useEffect(() => {
    if (selectedId) {
      setSearchOpen(false)
      setSearchQuery('')
      setAddFriendOpen(false)
      setAddFriendQuery('')
      setNotifOpen(false)
    }
  }, [selectedId])

  const pluginClass = [
    'plugin',
    selectedId ? 'chat-open' : '',
    isDark ? 'dark' : '',
    settingsOpen ? 'settings-open' : '',
    profileOpen ? 'profile-open' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={pluginClass} ref={pluginRef}>
      {/* Top bar */}
      <div className="top-bar">
        <span className="app-title">CoOp</span>

        {/* Notification icon */}
        <div
          className={`icon-btn${notifOpen ? ' active' : ''}`}
          onClick={handleToggleNotif}
          title="Notifications"
          style={{ position: 'relative' }}
        >
          <svg viewBox="0 0 16 16" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2a4 4 0 00-4 4v2.5L2.5 11h11L12 8.5V6a4 4 0 00-4-4z" />
            <path d="M6.5 12.5a1.5 1.5 0 003 0" />
          </svg>
          {unread.size > 0 && <span className="notif-dot" />}
        </div>

        {/* Search icon */}
        <div
          className={`icon-btn${searchOpen ? ' active' : ''}`}
          onClick={handleToggleSearch}
          title="Search"
        >
          <svg viewBox="0 0 16 16" strokeWidth="1.5">
            <circle cx="6.5" cy="6.5" r="4" />
            <path d="M10 10l3 3" strokeLinecap="round" />
          </svg>
        </div>

        {/* Add Friend icon */}
        <div
          className={`icon-btn${addFriendOpen ? ' active' : ''}`}
          onClick={handleToggleAddFriend}
          title="Add Friend"
        >
          <svg viewBox="0 0 16 16" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="6" cy="6" r="2.6" />
            <path d="M1.5 13c.7-2.2 2.4-3.2 4.5-3.2s3.8 1 4.5 3.2" />
            <path d="M12.5 8v4M10.5 10h4" />
          </svg>
        </div>

        {/* Profile icon */}
        <div
          className={`icon-btn${profileOpen ? ' active' : ''}`}
          onClick={handleToggleProfile}
          title="Profile"
        >
          <svg viewBox="0 0 16 16" strokeWidth="1.5" fill="none">
            <circle cx="8" cy="6" r="2.6" />
            <path d="M3 13.2c.8-2.4 2.8-3.4 5-3.4s4.2 1 5 3.4" strokeLinecap="round" />
          </svg>
        </div>

        {/* Settings icon */}
        <div
          className={`icon-btn${settingsOpen ? ' active' : ''}`}
          onClick={handleToggleSettings}
          title="Settings"
        >
          <svg viewBox="0 0 16 16" strokeWidth="1.4">
            <circle cx="8" cy="8" r="2" />
            <path d="M8 2v1.2M8 12.8V14M2 8h1.2M12.8 8H14M3.76 3.76l.85.85M11.39 11.39l.85.85M3.76 12.24l.85-.85M11.39 4.61l.85-.85" />
          </svg>
        </div>
      </div>

      {/* Search bar */}
      <div className={`search-bar${searchOpen ? ' open' : ''}`}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--t3)" strokeWidth="1.5" style={{ flexShrink: 0 }}>
          <circle cx="6.5" cy="6.5" r="4" />
          <path d="M10 10l3 3" strokeLinecap="round" />
        </svg>
        <input
          ref={searchInputRef}
          className="search-input"
          type="text"
          placeholder="search friends..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <button
          className={`search-clear${searchQuery ? ' visible' : ''}`}
          onClick={() => setSearchQuery('')}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--t3)" strokeWidth="1.8" strokeLinecap="round">
            <path d="M1 1l8 8M9 1L1 9" />
          </svg>
        </button>
      </div>

      {/* Add Friend bar */}
      <div className={`search-bar${addFriendOpen ? ' open' : ''}`}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--t3)" strokeWidth="1.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
          <circle cx="6" cy="6" r="2.6" />
          <path d="M1.5 13c.7-2.2 2.4-3.2 4.5-3.2s3.8 1 4.5 3.2" />
          <path d="M12.5 8v4M10.5 10h4" />
        </svg>
        <input
          ref={addFriendInputRef}
          className="search-input"
          type="text"
          placeholder="find by display name..."
          value={addFriendQuery}
          onChange={e => setAddFriendQuery(e.target.value)}
        />
        <button
          className={`search-clear${addFriendQuery ? ' visible' : ''}`}
          onClick={() => setAddFriendQuery('')}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--t3)" strokeWidth="1.8" strokeLinecap="round">
            <path d="M1 1l8 8M9 1L1 9" />
          </svg>
        </button>
      </div>

      {/* Notification panel (overlay) */}
      {notifOpen && (
        <div className="notif-panel">
          {unread.size === 0 ? (
            <div className="notif-empty">No new messages</div>
          ) : (
            Array.from(unread.entries()).map(([senderId, msgs]) => {
              const profile = profilesWithStatus.find(p => p.id === senderId)
              const name = profile?.display_name ?? 'Unknown'
              const count = msgs.length
              const preview = count === 1 ? msgs[0]!.content : `${count} new messages`
              return (
                <div
                  key={senderId}
                  className="notif-row"
                  onClick={() => {
                    setNotifOpen(false)
                    handleOpenChat(senderId)
                  }}
                >
                  <div className="av sz32" style={{ background: profile?.avatar_color ?? '#999' }}>
                    {profile?.avatar_url
                      ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      : profile?.initials ?? '?'}
                  </div>
                  <div className="notif-info">
                    <div className="notif-name">{name}</div>
                    <div className="notif-preview">{preview}</div>
                  </div>
                  <div className="notif-count">{count}</div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Sliding content */}
      <div className="content">
        {/* Friends view */}
        <div className="view fview">
          <FriendsList
            profiles={profilesWithStatus}
            favorites={favorites}
            loading={profilesLoading}
            viewMode={viewMode}
            searchQuery={addFriendOpen ? addFriendQuery : searchQuery}
            onSelect={handleOpenChat}
            onToggleFav={handleToggleFav}
            onCellHover={handleCellHover}
            onCellLeave={handleCellLeave}
          />
        </div>

        {/* Chat view */}
        <div className="view cview">
          {selectedProfile && (
            <ChatView
              currentUserId={user.id}
              otherProfile={selectedProfile}
              messages={messages}
              loading={messagesLoading}
              onSend={send}
              onBack={() => setSelectedId(null)}
            />
          )}
        </div>

        {/* Settings view */}
        <div className="view sview">
          <SettingsPanel
            isDark={isDark}
            viewMode={viewMode}
            onToggleDark={handleToggleDark}
            onViewModeChange={handleViewModeChange}
            onClose={() => setSettingsOpen(false)}
          />
        </div>

        {/* Profile view */}
        <div className="view pview">
          <ProfilePanel
            supabase={client}
            user={user}
            me={me}
            onClose={() => setProfileOpen(false)}
            onUpdated={refetchProfiles}
          />
        </div>
      </div>

      {/* Tooltip — outside .content so it's not clipped */}
      {tooltip && (
        <div
          className="tooltip visible"
          style={{ left: tooltip.x, top: tooltip.y }}
          onMouseEnter={handleTooltipEnter}
          onMouseLeave={handleTooltipLeave}
        >
          <div className="tt-row">
            <div className="av sz32" style={{ background: tooltip.profile.avatar_color }}>
              {tooltip.profile.avatar_url
                ? <img src={tooltip.profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : tooltip.profile.initials}
            </div>
            <div className="tt-info">
              <div className="tt-name">{tooltip.profile.display_name}</div>
              <div className="tt-sub">{tooltip.profile.isOnline ? 'online' : 'offline'}</div>
            </div>
          </div>
          <button
            className="tt-btn"
            onClick={() => handleOpenChat(tooltip.profile.id)}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--t1)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            message
          </button>
          <div
            className={`tt-arrow ${tooltip.arrowUp ? 'up' : 'down'}`}
            style={{ left: tooltip.arrowX }}
          />
        </div>
      )}
    </div>
  )
}
