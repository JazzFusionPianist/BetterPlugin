import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useProfiles } from '../hooks/useProfiles'
import { useMessages } from '../hooks/useMessages'
import { usePresence } from '../hooks/usePresence'
import { useConversationNotifications } from '../hooks/useConversationNotifications'
import { useConversationReads } from '../hooks/useConversationReads'
import { getOrCreateDmConversation, createGroupConversation } from '../lib/conversations'
import { useFollows } from '../hooks/useFollows'
import { useFollowAlerts } from '../hooks/useFollowAlerts'
import { useConversations } from '../hooks/useConversations'
import ChatView from '../components/collab/ChatView'
import ConversationsPanel from '../components/collab/ConversationsPanel'
import NewGroupPanel from '../components/collab/NewGroupPanel'
import ChatSettingsPanel from '../components/collab/ChatSettingsPanel'
import FriendsList from '../components/collab/FriendsList'
import SettingsPanel from '../components/collab/SettingsPanel'
import DisplayPanel from '../components/collab/DisplayPanel'
import InformationPanel from '../components/collab/InformationPanel'
import ProfilePanel from '../components/collab/ProfilePanel'
import AddFriendPanel from '../components/collab/AddFriendPanel'
import LivePanel from '../components/collab/LivePanel'
import FxPanel from '../components/collab/FxPanel'
import FollowAlerts from '../components/collab/FollowAlerts'
import LiveViewer from '../components/collab/LiveViewer'
import LanguagePanel from '../components/collab/LanguagePanel'
import GameListView from '../components/collab/GameListView'
import ChessView from '../components/collab/ChessView'
import HoverTooltip from '../components/collab/HoverTooltip'
import FallingBlocksView from '../components/collab/FallingBlocksView'
import PinballView from '../components/collab/PinballView'
import YachtView from '../components/collab/YachtView'
import PokerView from '../components/collab/PokerView'
import EarTrainingView from '../components/collab/EarTrainingView'
import type { Profile, Message, ChatTarget } from '../types/collab'
import type { VideoSource } from '../types/live'
import { useLive, type LiveSession } from '../hooks/useLive'
import { useMediaSource } from '../hooks/useMediaSource'
import { useLiveBroadcaster } from '../hooks/useLiveBroadcaster'
import { useLiveChat } from '../hooks/useLiveChat'
import { applyScreenSize, type ScreenSize } from '../lib/pluginWindow'
import { hasJuceBridge } from '../lib/juceBridge'
import ResizeGrip from '../components/collab/ResizeGrip'
import './collab.css'

interface Props { user: User }
interface TooltipInfo { profile: Profile; x: number; y: number; arrowX: number; arrowUp: boolean }

/** Average a set of #RRGGBB strings into a single hex. Used for group
 *  constellation tint — visually unifies a member set without picking
 *  any single member as "the" color. */
function mixHexColors(hexes: string[]): string {
  if (hexes.length === 0) return '#4A8FE7'
  let r = 0, g = 0, b = 0
  for (const h of hexes) {
    const m = /^#?([0-9a-f]{6})$/i.exec(h.trim())
    if (!m) continue
    const v = parseInt(m[1]!, 16)
    r += (v >> 16) & 0xff
    g += (v >> 8) & 0xff
    b += v & 0xff
  }
  const n = hexes.length
  const to2 = (x: number) => Math.round(x / n).toString(16).padStart(2, '0')
  return `#${to2(r)}${to2(g)}${to2(b)}`
}

export default function CollabPage({ user }: Props) {
  if (!supabase) return <div style={{ padding: 20, fontSize: 12, color: '#999' }}>Supabase not configured.</div>
  return <CollabPageInner user={user} />
}

function CollabPageInner({ user }: Props) {
  const client = supabase!
  const pluginRef = useRef<HTMLDivElement>(null)

  // Mutually exclusive — a chat is either a DM (selectedId = friend id)
  // or a group (selectedGroupConvId = conversation id). Opening one
  // clears the other.
  const [selectedId, setSelectedId]                       = useState<string | null>(null)
  const [selectedGroupConvId, setSelectedGroupConvId]     = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen]         = useState(false)
  const [displayOpen, setDisplayOpen]           = useState(false)
  const [infoOpen, setInfoOpen]                 = useState(false)
  const [languageOpen, setLanguageOpen]         = useState(false)
  const [addFriendOpen, setAddFriendOpen]       = useState(false)
  const [searchOpen, setSearchOpen]             = useState(false)
  const [searchQuery, setSearchQuery]           = useState('')
  const [convOpen, setConvOpen]                 = useState(false)
  const [newGroupOpen, setNewGroupOpen]         = useState(false)
  const [chatSettingsOpen, setChatSettingsOpen] = useState(false)
  const [liveOpen, setLiveOpen]                 = useState(false)
  // Bumped when a chat game invite is accepted → remounts the game view
  // so its mount-time join_room_id consumption actually runs (see
  // handleJoinGameInvite).
  const [gameJoinNonce, setGameJoinNonce]       = useState(0)
  const [fxOpen, setFxOpen]                     = useState(false)
  // Lingers ~1.4s after the fx room closes so the wall colour, toolbar and
  // incoming panels all fade back together instead of snapping.
  const [fxClosing, setFxClosing]               = useState(false)
  const fxWasOpen = useRef(false)
  useEffect(() => {
    if (fxOpen) { fxWasOpen.current = true; setFxClosing(false); return }
    if (!fxWasOpen.current) return
    setFxClosing(true)
    const t = setTimeout(() => setFxClosing(false), 1450)
    return () => clearTimeout(t)
  }, [fxOpen])
  const [gameOpen, setGameOpen]                 = useState(false)
  const [gameScreen, setGameScreen]             = useState<'list' | 'chess' | 'falling_blocks' | 'poker' | 'ear_training' | 'pinball' | 'yacht'>('list')
  // True while the user is using the GameList specifically to invite
  // people in the chat they just left open. Cleared when they pick a
  // game (we create the room + send the invite bubble) or close the
  // game panel. Stores the conversation id so we send the invite into
  // the right place even if the user navigates between chats.
  const [chatGameInvite, setChatGameInvite] = useState<{ conversationId: string } | null>(null)
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null)
  const [tooltip, setTooltip]                   = useState<TooltipInfo | null>(null)
  const [galleryPopup, setGalleryPopup]         = useState<{ profile: Profile; x: number; y: number; below: boolean } | null>(null)
  const hideTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [isDark, setIsDark] = useState(() => localStorage.getItem('collab_dark') === 'true')
  // Dev override: ?screen=large lets us preview the larger layout
  // in a plain browser (no JUCE bridge). Never present in production URLs.
  const screenPreview = (() => {
    const p = new URLSearchParams(window.location.search).get('screen')
    return p === 'large' ? (p as ScreenSize) : null
  })()
  const [screenSize, setScreenSize] = useState<ScreenSize>(() => {
    if (screenPreview) return screenPreview
    const s = localStorage.getItem('collab_screen_size')
    if (s === 'medium') {
      localStorage.setItem('collab_screen_size', 'large')
      return 'large'
    }
    return s === 'large' ? s : 'small'
  })
  // viewMode is locked to 'default' — gallery/list views are no longer exposed.
  const viewMode: 'default' | 'gallery' | 'list' = 'default'

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

  // Build the active chat target — DM or group, mutually exclusive.
  const chatTarget: ChatTarget | null = useMemo(() => {
    if (selectedId) return { kind: 'dm', otherUserId: selectedId }
    if (selectedGroupConvId) return { kind: 'group', conversationId: selectedGroupConvId }
    return null
  }, [selectedId, selectedGroupConvId])
  const { messages, loading: messagesLoading, send, conversationId: activeConvId } = useMessages(client, user.id, chatTarget)
  // Read receipts for whichever chat is open. The hook handles nulls
  // (no chat open) and resubscribes whenever the conv id changes.
  const conversationReads = useConversationReads(client, activeConvId, user.id)
  const onlineIds  = usePresence(client, user.id)
  // Click handler for an in-chat game invite bubble's "Join Game"
  // button. Atomically takes a seat if available and routes the user
  // into the lobby. A stale room whose host has gone offline is treated
  // as expired, even if the current user's id is still on the room row.
  const handleJoinGameInvite = useCallback(async (gameType: string, roomId: string) => {
    const { joinGameRoom } = await import('../lib/gameRooms')
    const type = gameType as 'chess' | 'falling_blocks' | 'poker' | 'ear_training'
    const result = await joinGameRoom(client, type, roomId, user.id, { onlineIds })
    if (result === 'joined' || result === 'already-in') {
      sessionStorage.setItem('join_room_id', roomId)
      // The game views consume join_room_id in their MOUNT effect — but a
      // view stays mounted after the panel closes (gameScreen keeps its
      // value), so a second invite would land on a stale view that never
      // re-reads the pending room. Bump the key to force a fresh mount.
      setGameJoinNonce((n) => n + 1)
      // Clear every other panel, exactly like the games toolbar button —
      // the settings sub-panels (display/info/language, z 30-32) overlay
      // the game view (z 22) by design, so any of them left open would
      // greet the player instead of the lobby.
      setSettingsOpen(false); setDisplayOpen(false); setInfoOpen(false); setLanguageOpen(false)
      setAddFriendOpen(false); setConvOpen(false); setLiveOpen(false); setFxOpen(false)
      setGameScreen(type)
      setGameOpen(true)
    }
    return result
  }, [client, onlineIds, user.id])
  // Conversation-keyed notifications. The Phase-2 UI (ProfilePanel) is
  // still friend-keyed, so we adapt below via the DM conversations list.
  const { unread: convUnread, lastMessages: convLastMessages, markSeen: markConvSeen } = useConversationNotifications(client, user.id)
  const { followingIds, followerIds, mutualIds, follow, unfollow } = useFollows(client, user.id)
  const { alerts: followAlerts, dismiss: dismissFollowAlert } = useFollowAlerts(client, user.id)
  const { conversations, groupConversations } = useConversations(client, user.id)

  // The calendar lives INSIDE chats now (2026-08-10) — ChatView mounts
  // the hooks itself; this page only supplies conversation ids and the
  // group-title map for shared-event tags.
  const groupTitleById = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of groupConversations) m.set(g.conversationId, g.title || 'Group')
    return m
  }, [groupConversations])

  // ── conv-keyed → friend-keyed adapters ──────────────────────────────────
  // ProfilePanel renders friend-orb-anchored cues, so we translate
  // `convUnread` / `convLastMessages` through the DM partner mapping.
  // A brand-new unread (from a sender we've never DM'd) shows up in
  // `convUnread` immediately but takes one `useConversations` refetch
  // tick to surface here — acceptable (sub-second).
  const friendUnread = useMemo(() => {
    const out = new Map<string, number>()
    for (const conv of conversations) {
      const n = convUnread.get(conv.conversationId) ?? 0
      if (n > 0) out.set(conv.partnerId, n)
    }
    return out
  }, [conversations, convUnread])

  const friendLastMessages = useMemo(() => {
    const out = new Map<string, Message>()
    for (const conv of conversations) {
      const m = convLastMessages.get(conv.conversationId)
      if (m) out.set(conv.partnerId, m)
    }
    return out
  }, [conversations, convLastMessages])

  // Group-keyed mirrors — straight pass-through filtered to groups,
  // since convUnread/convLastMessages are already conversation-keyed.
  const groupUnread = useMemo(() => {
    const out = new Map<string, number>()
    for (const gc of groupConversations) {
      const n = convUnread.get(gc.conversationId) ?? 0
      if (n > 0) out.set(gc.conversationId, n)
    }
    return out
  }, [groupConversations, convUnread])

  const groupLastMessages = useMemo(() => {
    const out = new Map<string, Message>()
    for (const gc of groupConversations) {
      const m = convLastMessages.get(gc.conversationId)
      if (m) out.set(gc.conversationId, m)
    }
    return out
  }, [groupConversations, convLastMessages])

  // markFriendSeen: clear by friend id. Fast-path through the cached
  // conversations list; falls back to resolving the DM if the user
  // opens a thread that hasn't been in the list yet (first contact).
  const markFriendSeen = useCallback(async (friendId: string) => {
    const conv = conversations.find(c => c.partnerId === friendId)
    if (conv) { markConvSeen(conv.conversationId); return }
    try {
      const cid = await getOrCreateDmConversation(client, user.id, friendId)
      markConvSeen(cid)
    } catch (err) {
      console.error('[markFriendSeen]', err)
    }
  }, [conversations, markConvSeen, client, user.id])

  const { liveSessions, mySession, liveHostIds, liveSessionByHost, startLive, endLive, updateLive } = useLive(client, user.id)
  // Derived: hostId → broadcast title, for the FriendsList sub-line.
  const liveTitleByHost = useMemo(() => {
    const m = new Map<string, string>()
    liveSessionByHost.forEach((s, host) => { if (s.title) m.set(host, s.title) })
    return m
  }, [liveSessionByHost])
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

  // Group-orb pool — join GroupConversation rows to profile data so the
  // constellation can render member mini-orbs. Members whose profile
  // hasn't loaded yet are dropped silently rather than rendered as
  // blanks (avoids "ghost stars" in the constellation on first paint).
  const groupOrbs = useMemo(() => {
    const byId = new Map(profilesWithStatus.map(p => [p.id, p]))
    if (me && !byId.has(me.id)) byId.set(me.id, { ...me, isOnline: true })
    return groupConversations.map(gc => {
      const members = gc.memberIds
        .map(mid => byId.get(mid))
        .filter((p): p is Profile => !!p)
      return {
        conversationId: gc.conversationId,
        title: gc.title,
        members,
        memberCount: gc.memberIds.length,
      }
    })
  }, [groupConversations, profilesWithStatus, me])

  // Resolve a group's display color = average of member avatar_colors.
  // Used for the chat header backsplash so the same vibe persists
  // from orb → header.
  const groupColorByConv = useMemo(() => {
    const out = new Map<string, string>()
    for (const g of groupOrbs) out.set(g.conversationId, mixHexColors(g.members.map(m => m.avatar_color)))
    return out
  }, [groupOrbs])

  const selectedGroup = selectedGroupConvId
    ? groupOrbs.find(g => g.conversationId === selectedGroupConvId) ?? null
    : null
  // 친구 목록 = 서로 팔로우한 유저만
  const friendProfiles  = useMemo(() => profilesWithStatus.filter(p => mutualIds.has(p.id)), [profilesWithStatus, mutualIds])
  const followingProfiles = useMemo(() => profilesWithStatus.filter(p => followingIds.has(p.id)), [profilesWithStatus, followingIds])
  const followerProfiles  = useMemo(() => profilesWithStatus.filter(p => followerIds.has(p.id)), [profilesWithStatus, followerIds])

  // Anyone with pending unread messages MUST appear as an orb in the
  // backdrop — otherwise the notification visuals have nothing to
  // attach to and the user can't see them. Union with followers
  // (dedup by id) so the orb pool covers both "members of your
  // orbit" and "people pinging you right now". Profiles that
  // haven't loaded yet are dropped silently.
  const orbPool = useMemo(() => {
    const byId = new Map(followerProfiles.map(p => [p.id, p] as const))
    for (const fid of friendUnread.keys()) {
      if (!byId.has(fid)) {
        const p = profilesWithStatus.find(x => x.id === fid)
        if (p) byId.set(fid, p)
      }
    }
    return Array.from(byId.values())
  }, [followerProfiles, friendUnread, profilesWithStatus])
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

  // Keep watchingSession in sync with liveSessions
  useEffect(() => {
    if (!watchingSession) return
    const fresh = liveSessions.find(s => s.id === watchingSession.id)
    if (!fresh) {
      console.log('[CollabPage] watching session not in liveSessions:', watchingSession.id)
      return
    }
    if (fresh.has_video === watchingSession.has_video
      && fresh.has_audio === watchingSession.has_audio
      && fresh.video_source === watchingSession.video_source
      && fresh.title === watchingSession.title) return
    console.log('[CollabPage] updating watchingSession:', {
      old: { has_video: watchingSession.has_video, video_source: watchingSession.video_source },
      new: { has_video: fresh.has_video, video_source: fresh.video_source },
    })
    setWatchingSession(fresh)
  }, [liveSessions, watchingSession])

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


  const handleToggleFav = (id: string) => {
    setFavorites(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      localStorage.setItem(favKey, JSON.stringify([...next]))
      return next
    })
  }
  const handleToggleDark      = () => setIsDark(prev => { const next = !prev; localStorage.setItem('collab_dark', String(next)); return next })
  const handleScreenSize = (size: ScreenSize) => {
    setScreenSize(size)
    localStorage.setItem('collab_screen_size', size)
    applyScreenSize(size)
  }
  // The window is freely resizable now (corner drag) and JUCE itself
  // persists/restores the editor size — so we no longer snap back to a
  // preset on load. Instead, the LAYOUT follows the live viewport:
  // under 520px the compact layout, at 520px+ the wide one. The
  // ?screen=large dev override keeps its layout regardless.
  useEffect(() => {
    if (screenPreview) return
    const apply = () => setScreenSize(window.innerWidth >= 520 ? 'large' : 'small')
    apply()
    window.addEventListener('resize', apply)
    return () => window.removeEventListener('resize', apply)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Search/AddFriend toggles kept for re-introduction; redesign removed
  // their trigger buttons from the toolbar but the panels are still wired up.
  const _handleToggleSearch = () => setSearchOpen(prev => {
    if (prev) { setSearchQuery('') } else {
      setSettingsOpen(false); setDisplayOpen(false); setInfoOpen(false)
      setAddFriendOpen(false); setConvOpen(false)
      setTimeout(() => searchInputRef.current?.focus(), 200)
    }
    return !prev
  })
  void _handleToggleSearch
  const closeSearch = () => { setSearchOpen(false); setSearchQuery('') }
  const handleToggleSettings  = () => setSettingsOpen(prev => {
    // Settings overlays on top of whatever you were viewing (messages/live/
    // game stay open underneath) and renders above them via z-index, so
    // closing Settings returns you exactly where you were. The in-Settings
    // sub-panels (display/info/language/find-people) and search are reset
    // on BOTH edges — leaving any of them open past a gear-close strands
    // an invisible overlay above the next screen (the language-panel bug,
    // and again with find-people).
    if (!prev) { setDisplayOpen(false); setInfoOpen(false); setLanguageOpen(false); setAddFriendOpen(false); setFxOpen(false); closeSearch() }
    else { setDisplayOpen(false); setInfoOpen(false); setLanguageOpen(false); setAddFriendOpen(false) }
    return !prev
  })
  // Called by every "open a main panel" handler (messages/live/games/
  // add-friend/chat). Settings (z-index 30) intentionally overlays instead,
  // so it does NOT go through here.
  const closeSettingsPanels = () => { setSettingsOpen(false); setDisplayOpen(false); setInfoOpen(false); setLanguageOpen(false) }
  const _handleToggleAddFriend = () => setAddFriendOpen(prev => { if (!prev) { closeSettingsPanels(); setConvOpen(false); setLiveOpen(false); setGameOpen(false); setFxOpen(false); closeSearch() } return !prev })
  void _handleToggleAddFriend
  const handleToggleConv      = () => setConvOpen(prev => {
    if (!prev) { closeSettingsPanels(); setAddFriendOpen(false); setLiveOpen(false); setGameOpen(false); setFxOpen(false); closeSearch() }
    else { setNewGroupOpen(false) }   // closing the tab resets the new-group flow
    return !prev
  })
  const handleToggleFx        = () => setFxOpen(prev => {
    if (!prev) {
      closeSettingsPanels(); setAddFriendOpen(false); setConvOpen(false)
      setLiveOpen(false); setGameOpen(false); closeSearch()
    }
    return !prev
  })
  const handleToggleLive      = () => setLiveOpen(prev => {
    if (!prev) {
      closeSettingsPanels(); setAddFriendOpen(false); setConvOpen(false); setGameOpen(false); setFxOpen(false); closeSearch()
      // Unlock mic labels/IDs so the dropdown is populated when the panel opens
      requestDevicePermissions()
    }
    return !prev
  })

  const handleTooltipEnter = () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current) }
  const handleTooltipLeave = () => { hideTimerRef.current = setTimeout(() => setTooltip(null), 180) }
  // The chat view (.cview) sits at the bottom of the overlay z-stack, so
  // ANY open panel (settings/display/info/language/add-friend/messages/
  // live/game) would cover it. Close them all before showing a chat so
  // the chat is never opened behind a panel.
  const closeAllOverlays = () => {
    closeSettingsPanels()
    setAddFriendOpen(false); setConvOpen(false); setLiveOpen(false); setFxOpen(false)
    setGameOpen(false); setNewGroupOpen(false); closeSearch()
    setTooltip(null); setGalleryPopup(null)
  }

  const handleOpenChat     = (id: string) => {
    closeAllOverlays()
    setSelectedGroupConvId(null)   // mutual exclusion with group chats
    setSelectedId(id)
    markFriendSeen(id)  // clears the orb pulse for that friend
  }

  const handleOpenGroupChat = (convId: string) => {
    closeAllOverlays()
    setSelectedId(null)            // mutual exclusion with DM chats
    setSelectedGroupConvId(convId)
    markConvSeen(convId)           // clears the constellation pulse
  }

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

  useEffect(() => {
    if (selectedId || selectedGroupConvId) { setSearchOpen(false); setSearchQuery(''); setConvOpen(false) }
  }, [selectedId, selectedGroupConvId])

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
    setSelectedId(null); setSelectedGroupConvId(null); setViewingProfileId(null)
    setSettingsOpen(false); setDisplayOpen(false); setInfoOpen(false)
    setAddFriendOpen(false); setConvOpen(false); setLiveOpen(false); setFxOpen(false)
    setGameOpen(false); setGameScreen('list')
    setWatchingSession(null)
    closeSearch()
  }

  const pluginClass = ['plugin',
    (selectedId || selectedGroupConvId) ? 'chat-open' : '',
    isDark            ? 'dark'               : '',
    // Grow the shell to fill the resized host window. Gated on the JUCE bridge
    // so the browser preview keeps its fixed 300×500 frame — unless the
    // ?screen= dev override is set, which forces it on in the browser too.
    // 'large' emits `screen-wide` (one full-width pane; the mini-games' own
    // screen-large rules stay dormant there).
    ((hasJuceBridge || screenPreview) && screenSize !== 'small')
      ? (screenSize === 'large' ? 'screen-wide' : `screen-${screenSize}`) : '',
    settingsOpen      ? 'settings-open'      : '',
    displayOpen       ? 'display-open'       : '',
    infoOpen          ? 'info-open'          : '',
    languageOpen      ? 'language-open'      : '',
    addFriendOpen     ? 'addfriend-open'     : '',
    convOpen          ? 'conv-open'          : '',
    (liveOpen || !!watchingSession) ? 'live-open' : '',
    fxOpen            ? 'fx-open'            : '',
    fxClosing         ? 'fx-closing'         : '',
    gameOpen          ? 'game-open'          : '',
    // Each game darkens the room in its own colour, fx-room style. The
    // `dark` token set rides along so every surface (chat included)
    // inverts with the wall.
    gameOpen && gameScreen !== 'list' ? `gwall-${gameScreen} dark` : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={pluginClass}
      ref={pluginRef}
      // With the freely-resizable window the shell must always fill it —
      // the fixed 300×500 frame is only for plain-browser previews.
      style={(hasJuceBridge || screenPreview) ? { width: '100vw', height: '100vh' } : undefined}
    >
      <ResizeGrip />
      <div className="top-bar">
        {/* Chat list */}
        <div className={`icon-btn${convOpen ? ' active' : ''}`} onClick={handleToggleConv} title="Messages">
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 3.5A1.5 1.5 0 013.5 2h9A1.5 1.5 0 0114 3.5v7A1.5 1.5 0 0112.5 12H9.5l-3 2.5c-.3.25-.5.1-.5-.25V12H3.5A1.5 1.5 0 012 10.5v-7z"/>
          </svg>
        </div>

        {/* One-knob FX */}
        <div
          className={`icon-btn${fxOpen ? ' active' : ''}`}
          onClick={handleToggleFx}
          title="FX"
        >
          <svg viewBox="0 0 16 16" fill="none" strokeWidth="1.3" stroke="currentColor" strokeLinecap="round">
            <circle cx="8" cy="8" r="5.6" />
            <path d="M8 8L4.9 4.9" strokeWidth="1.5" />
            <path d="M3.4 12.6l1 -1M12.6 12.6l-1 -1M12.6 3.4l-1 1" strokeWidth="1" />
          </svg>
        </div>

        {/* Live */}
        <div
          className={`icon-btn${liveOpen ? ' active' : ''}${mySession ? ' live-btn-active' : ''}`}
          onClick={handleToggleLive}
          title="Live"
        >
          <svg viewBox="0 0 16 16" fill="none" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" stroke={mySession ? '#FF3B30' : 'currentColor'}>
            <path d="M5.7 5.7a3.3 3.3 0 000 4.6" />
            <path d="M10.3 5.7a3.3 3.3 0 010 4.6" />
            <path d="M3.3 3.3a6.7 6.7 0 000 9.4" />
            <path d="M12.7 3.3a6.7 6.7 0 010 9.4" />
            <circle cx="8" cy="8" r="1.4" fill={mySession ? '#FF3B30' : 'currentColor'} stroke="none" />
          </svg>
          {mySession && <span className="live-btn-dot" />}
        </div>

        {/* Mini Games */}
        <div
          className={`icon-btn${gameOpen ? ' active' : ''}`}
          onClick={async () => {
            const next = !gameOpen
            if (next) {
              closeSettingsPanels(); setAddFriendOpen(false); setConvOpen(false); setLiveOpen(false); setFxOpen(false); closeSearch()
              // If the user is currently in a chat, opening the games
              // panel from here means "I want to invite the people in
              // this chat to play". Remember the conversation id —
              // GameListView reads it to switch into invite mode.
              setChatGameInvite(activeConvId ? { conversationId: activeConvId } : null)
              setGameOpen(true)
              setGameScreen('list')
            } else {
              setChatGameInvite(null)
              setGameOpen(false)
            }
          }}
          title="Games"
        >
          <svg viewBox="0 0 16 16" strokeWidth="1.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1.5" y="4.5" width="13" height="8" rx="2" />
            <path d="M5.5 8.5h2M6.5 7.5v2" />
            <circle cx="10.5" cy="8" r=".6" fill="currentColor" stroke="none" />
            <circle cx="12" cy="9.5" r=".6" fill="currentColor" stroke="none" />
          </svg>
        </div>

        {/* Settings */}
        <div className={`icon-btn${settingsOpen ? ' active' : ''}`} onClick={handleToggleSettings} title="Settings">
          <svg viewBox="0 0 16 16" fill="none" strokeWidth="1.2" stroke="currentColor" strokeLinejoin="round" strokeLinecap="round">
            <path d="M8 1.6l.9 1.6 1.8-.4.5 1.8 1.7.7-.5 1.8 1.3 1.3-1.3 1.3.5 1.8-1.7.7-.5 1.8-1.8-.4L8 14.4l-.9-1.6-1.8.4-.5-1.8-1.7-.7.5-1.8L2.3 7.6l1.3-1.3-.5-1.8 1.7-.7.5-1.8 1.8.4z" />
            <circle cx="8" cy="8" r="2" />
          </svg>
        </div>
      </div>

      {/* Follow alerts — under the toolbar, above every sliding view */}
      <FollowAlerts
        alerts={followAlerts}
        followingIds={followingIds}
        onFollowBack={follow}
        onDismiss={dismissFollowAlert}
      />

      {/* Search bar */}
      <div className={`search-bar${searchOpen ? ' open' : ''}`}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--t3)" strokeWidth="1.5" style={{ flexShrink: 0 }}><circle cx="6.5" cy="6.5" r="4" /><path d="M10 10l3 3" strokeLinecap="round" /></svg>
        <input ref={searchInputRef} className="search-input" type="text" placeholder="search friends..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        <button className={`search-clear${searchQuery ? ' visible' : ''}`} onClick={() => setSearchQuery('')}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--t3)" strokeWidth="1.8" strokeLinecap="round"><path d="M1 1l8 8M9 1L1 9" /></svg>
        </button>
      </div>

      {/* Sliding content */}
      <div className="content">
        <div className="view fview">
          {viewingProfileId && viewingProfile
            ? <ProfilePanel key={`view-${viewingProfileId}`} supabase={client} user={user} me={viewingProfile} followingProfiles={[]} followerProfiles={viewingFollowerProfiles} onClose={() => setViewingProfileId(null)} onUpdated={refetchProfiles} onOpenChat={handleOpenChat} onRemoveFriend={unfollow} favorites={favorites} onToggleFav={handleToggleFav} onViewProfile={handleViewProfile} liveHostIds={liveHostIds} liveSessions={liveSessions} onWatchLive={sessionId => { handleOpenWatching(sessionId); setLiveOpen(true) }} friendUnread={friendUnread} friendLastMessages={friendLastMessages} viewOnly />
            : viewMode === 'default'
              ? <ProfilePanel key="self" supabase={client} user={user} me={me} followingProfiles={followingProfiles} followerProfiles={followerProfiles} orbProfiles={orbPool} onClose={() => {}} onUpdated={refetchProfiles} onOpenChat={handleOpenChat} onRemoveFriend={unfollow} favorites={favorites} onToggleFav={handleToggleFav} onViewProfile={handleViewProfile} onAvatarUpdated={updateMyAvatar} liveHostIds={liveHostIds} liveSessions={liveSessions} onWatchLive={sessionId => { handleOpenWatching(sessionId); setLiveOpen(true) }} friendUnread={friendUnread} friendLastMessages={friendLastMessages} groupOrbs={groupOrbs} groupUnread={groupUnread} groupLastMessages={groupLastMessages} onOpenGroupChat={handleOpenGroupChat} />
              : <FriendsList profiles={friendProfiles} favorites={favorites} loading={profilesLoading} viewMode={viewMode} searchQuery={searchQuery} liveHostIds={liveHostIds} liveTitleByHost={liveTitleByHost} onSelect={handleOpenChat} onToggleFav={handleToggleFav} onGalleryCellClick={handleGalleryCellClick} />
          }
        </div>
        <div className="view cview">
          {selectedProfile && <ChatView
            supabase={client}
            currentUserId={user.id}
            otherProfile={selectedProfile}
            messages={messages}
            loading={messagesLoading}
            otherIsLive={liveHostIds.has(selectedProfile.id)}
            otherLiveTitle={liveSessionByHost.get(selectedProfile.id)?.title}
            onJoinLive={() => {
              const sid = liveSessionByHost.get(selectedProfile.id)?.id
              if (sid) { handleOpenWatching(sid); setLiveOpen(true) }
            }}
            reads={conversationReads}
            onOpenSettings={() => setChatSettingsOpen(true)}
            onSend={send}
            onJoinGameInvite={handleJoinGameInvite}
            conversationId={activeConvId}
            groupTitleById={groupTitleById}
            onBack={() => { setChatSettingsOpen(false); setSelectedId(null) }}
          />}
          {selectedGroup && (
            <ChatView
              supabase={client}
              currentUserId={user.id}
              groupHeader={{
                title: selectedGroup.title,
                color: groupColorByConv.get(selectedGroup.conversationId) ?? '#4A8FE7',
                memberCount: selectedGroup.memberCount,
              }}
              groupMembers={selectedGroup.members.filter(m => m.id !== user.id)}
              messages={messages}
              loading={messagesLoading}
              reads={conversationReads}
              onOpenSettings={() => setChatSettingsOpen(true)}
              onSend={send}
              onJoinGameInvite={handleJoinGameInvite}
              conversationId={selectedGroupConvId}
              groupTitleById={groupTitleById}
              onBack={() => { setChatSettingsOpen(false); setSelectedGroupConvId(null) }}
            />
          )}
          {/* ChatSettingsPanel covers both DM and group. We mount when
              either side of the chat target is active AND the user has
              tapped the header to open settings. For DM mode we also
              wait for `activeConvId` so the panel always has the
              conversation_id to operate on. */}
          {chatSettingsOpen && (selectedGroup || (selectedProfile && activeConvId)) && (
            <ChatSettingsPanel
              supabase={client}
              currentUserId={user.id}
              chatKind={selectedGroup ? 'group' : 'dm'}
              conversationId={(selectedGroup?.conversationId ?? activeConvId)!}
              initialTitle={selectedGroup?.title ?? ''}
              initialMemberCount={selectedGroup?.memberCount ?? 2}
              friendProfiles={friendProfiles}
              profileLookup={(id) => {
                // `profiles` from useProfiles is filtered to exclude self,
                // so fall back to `me` for the current user — otherwise
                // the current user vanishes from the roster.
                if (id === user.id && me) return { ...me, isOnline: true }
                return profilesWithStatus.find(p => p.id === id) ?? null
              }}
              onPromoteToGroup={selectedProfile ? async (title, extraMemberIds) => {
                try {
                  // Auto-include the DM partner alongside whoever the
                  // user picked. createGroupConversation dedupes and
                  // appends self as admin.
                  const memberIds = [selectedProfile.id, ...extraMemberIds]
                  const newConvId = await createGroupConversation(client, user.id, title, memberIds)
                  setChatSettingsOpen(false)
                  handleOpenGroupChat(newConvId)
                  return newConvId
                } catch (err) {
                  console.error('[promoteToGroup]', err)
                  return null
                }
              } : undefined}
              onClose={() => setChatSettingsOpen(false)}
              onLeft={() => {
                setChatSettingsOpen(false)
                if (selectedGroup) setSelectedGroupConvId(null)
                else                setSelectedId(null)
              }}
            />
          )}
        </div>
        <div className="view sview">
          <SettingsPanel
            onClose={() => { setSettingsOpen(false); setDisplayOpen(false); setInfoOpen(false); setLanguageOpen(false); setAddFriendOpen(false) }}
            onOpenDisplay={() => setDisplayOpen(true)}
            onOpenInfo={() => setInfoOpen(true)}
            onOpenLanguage={() => setLanguageOpen(true)}
            onOpenFindPeople={() => setAddFriendOpen(true)}
            onSignOut={() => client.auth.signOut()}
          />
        </div>
        <div className="view dview">
          <DisplayPanel isDark={isDark} screenSize={screenSize} onToggleDark={handleToggleDark} onScreenSizeChange={handleScreenSize} onClose={() => setDisplayOpen(false)} />
        </div>
        <div className="view iview">
          <InformationPanel supabase={client} user={user} me={me} onClose={() => setInfoOpen(false)} onUpdated={refetchProfiles} onNameSaved={(n) => updateMe({ display_name: n, initials: n.split(' ').slice(0,2).map(w => w[0] ?? '').join('').toUpperCase() })} />
        </div>
        <div className="view lngview">
          <LanguagePanel onClose={() => setLanguageOpen(false)} />
        </div>
        <div className="view convview">
          {newGroupOpen ? (
            <NewGroupPanel
              friendProfiles={friendProfiles}
              onClose={() => setNewGroupOpen(false)}
              onCreate={async (title, memberIds) => {
                try {
                  const convId = await createGroupConversation(client, user.id, title, memberIds)
                  // Drop the user into the new group chat immediately.
                  // useConversations refetches on the conversation_members
                  // INSERT, so the group orb will surface in the backdrop
                  // a tick later — but we don't need to wait for that to
                  // route, since we already have the conversationId.
                  setNewGroupOpen(false)
                  setConvOpen(false)
                  handleOpenGroupChat(convId)
                  return convId
                } catch (err) {
                  console.error('[createGroupConversation]', err)
                  return null
                }
              }}
            />
          ) : (
            <ConversationsPanel
              conversations={conversations}
              groupConversations={groupConversations}
              profiles={profilesWithStatus}
              favorites={favorites}
              currentUserId={user.id}
              onOpenChat={handleOpenChat}
              onOpenGroupChat={handleOpenGroupChat}
              onNewGroup={() => setNewGroupOpen(true)}
            />
          )}
        </div>
        <div className="view fxview">
          {fxOpen && <FxPanel isOpen={fxOpen} />}
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

        {/* Game view */}
        <div className="view gview">
          {gameScreen === 'list' && (
            <GameListView
              inviteContext={chatGameInvite}
              onSelectGame={async (g) => {
                // Everything async here (dynamic chunk load, room lookup,
                // room create, invite send) runs BEFORE the screen switch,
                // so any rejection used to leave the tap doing nothing at
                // all — a dead-looking game button. The finally guarantees
                // the game opens no matter what; the async work is only
                // resume/invite sugar on top.
                try {
                  // Pinball is solo — no rooms, no invites.
                  if (g === 'pinball') return
                  if (!chatGameInvite) {
                    // Normal path — user picked a game to play / browse.
                    const { findActiveGame } = await import('../lib/gameRooms')
                    const active = await findActiveGame(client, user.id)
                    if (active?.gameType === g) {
                      sessionStorage.setItem('join_room_id', active.roomId)
                    }
                  } else {
                    // Invite path — create the room, post the invite bubble
                    // into the chat, then drop the user into the lobby.
                    const { createGameRoom } = await import('../lib/gameRooms')
                    const roomId = await createGameRoom(client, g, user.id)
                    if (roomId) {
                      await send('', { url: roomId, type: 'game_invite', name: g })
                      sessionStorage.setItem('join_room_id', roomId)
                    }
                  }
                } catch (err) {
                  console.error('[selectGame]', err)
                } finally {
                  setChatGameInvite(null)
                  setGameScreen(g)
                }
              }}
              onClose={() => { setGameOpen(false); setChatGameInvite(null) }}
            />
          )}
          {gameScreen === 'chess' && (
            <ChessView
              key={gameJoinNonce}
              supabase={client}
              currentUserId={user.id}
              currentUserProfile={me}
              friendProfiles={friendProfiles}
              onClose={() => setGameScreen('list')}
            />
          )}
          {gameScreen === 'falling_blocks' && (
            <FallingBlocksView
              key={gameJoinNonce}
              supabase={client}
              currentUserId={user.id}
              currentUserProfile={me}
              friendProfiles={friendProfiles}
              onlineIds={onlineIds}
              onClose={() => setGameScreen('list')}
            />
          )}
          {gameScreen === 'poker' && (
            <PokerView
              key={gameJoinNonce}
              supabase={client}
              currentUserId={user.id}
              currentUserProfile={me}
              friendProfiles={friendProfiles}
              onlineIds={onlineIds}
              onClose={() => setGameScreen('list')}
            />
          )}
          {gameScreen === 'pinball' && (
            <PinballView
              key={gameJoinNonce}
              supabase={client}
              currentUserId={user.id}
              currentUserProfile={me}
              onClose={() => setGameScreen('list')}
            />
          )}
          {gameScreen === 'yacht' && (
            <YachtView
              key={gameJoinNonce}
              supabase={client}
              currentUserId={user.id}
              currentUserProfile={me}
              friendProfiles={friendProfiles}
              onlineIds={onlineIds}
              onClose={() => setGameScreen('list')}
            />
          )}
          {gameScreen === 'ear_training' && (
            <EarTrainingView
              key={gameJoinNonce}
              supabase={client}
              currentUserId={user.id}
              currentUserProfile={me}
              friendProfiles={friendProfiles}
              onClose={() => setGameScreen('list')}
              pendingInviteRoomId={sessionStorage.getItem('join_room_id')}
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
        <HoverTooltip
          supabase={client}
          profile={tooltip.profile}
          x={tooltip.x}
          y={tooltip.y}
          arrowX={tooltip.arrowX}
          arrowUp={tooltip.arrowUp}
          isMutual={mutualIds.has(tooltip.profile.id)}
          isFollowing={followingIds.has(tooltip.profile.id)}
          isFollower={followerIds.has(tooltip.profile.id)}
          onMessage={() => { setTooltip(null); handleOpenChat(tooltip.profile.id) }}
          onViewProfile={() => { setTooltip(null); handleViewProfile(tooltip.profile.id) }}
          onMouseEnter={handleTooltipEnter}
          onMouseLeave={handleTooltipLeave}
        />
      )}
    </div>
  )
}
