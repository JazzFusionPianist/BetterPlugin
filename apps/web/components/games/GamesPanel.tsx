'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import {useEffect, useRef} from 'react'
import {GameSurface, useGameViewport} from '@orb/core/hooks/useGameSurface'
import { LanguageProvider } from '@/lib/games/i18n'
import type { Profile } from '@/lib/games/types'
import type { GameType } from '@/lib/games/gameRooms'
import GameListView from './GameListView'
import ArcadeLobby, { ArcadeContext } from './ArcadeLobby'
import ChessView from './ChessView'
import FallingBlocksView from './FallingBlocksView'
import PokerView from './PokerView'
import EarTrainingView from './EarTrainingView'
import PinballView from './PinballView'
import OrbMergeView from './OrbMergeView'
import YachtView from './YachtView'

export type GameScreen = 'list' | GameType | 'pinball' | 'orb_merge'

interface Props {
  supabase: SupabaseClient
  me: Profile
  friends: (Profile & { isOnline?: boolean })[]
  screen: GameScreen
  onScreenChange: (s: GameScreen) => void
  onClose: () => void
  /** Wide screens (the desktop studio): the arcade lobby and colour rooms. */
  arcade?: boolean
  visible?: boolean
}

/**
 * The games page — a full-screen overlay hosting the plugin's game
 * suite (chess / falling blocks / poker / ear training). The list and
 * every game view are ports of the plugin components; rooms, invites
 * and realtime all ride the same Supabase tables, so a match started
 * in the plugin continues seamlessly here and vice versa.
 */
export default function GamesPanel({ supabase, me, friends, screen, onScreenChange, onClose, arcade: requestedArcade = false, visible = true }: Props) {
  const {ref, spacious} = useGameViewport()
  const arcade = requestedArcade && (screen === 'list' || spacious)
  const selection = useRef(0)
  useEffect(() => {
    if (!visible) selection.current++
    return () => { selection.current++ }
  }, [visible,screen])
  const onlineIds = new Set(friends.filter((f) => f.isOnline).map((f) => f.id))
  // Pinball is solo — no room to resume. Otherwise pick up an in-flight
  // room of the chosen game if one exists.
  const selectGame = async (g: GameScreen) => {
    const request = ++selection.current
    if (request === selection.current) {
      sessionStorage.removeItem('join_room_id')
      onScreenChange(g)
    }
  }
  return (
    // Each game washes the whole page its own colour (wall-*), fx-room style.
    <div ref={ref} className={`games-panel${arcade ? ' arcade-skin' : ''}${screen !== 'list' ? ` wall-${screen}` : ''}`}>
      <GameSurface visible={visible}>
      <ArcadeContext.Provider value={arcade}>
      <LanguageProvider>
        {screen === 'list' && arcade && <ArcadeLobby onSelectGame={selectGame} onClose={onClose} />}
        {screen === 'list' && !arcade && (
          <button className="games-close" onClick={onClose} aria-label="Close games">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        )}
        {screen === 'list' && !arcade && (
          <GameListView inviteContext={null} onSelectGame={selectGame} onClose={onClose} />
        )}
        {(screen === 'chess' || screen === 'chess_3d') && (
          <ChessView variant={screen === 'chess_3d' ? '3d' : '2d'}
            supabase={supabase}
            currentUserId={me.id}
            currentUserProfile={me}
            friendProfiles={friends}
            onClose={() => onScreenChange('list')}
          />
        )}
        {screen === 'falling_blocks' && (
          <FallingBlocksView
            supabase={supabase}
            onlineIds={onlineIds}
            currentUserId={me.id}
            currentUserProfile={me}
            friendProfiles={friends}
            onClose={() => onScreenChange('list')}
          />
        )}
        {screen === 'poker' && (
          <PokerView
            supabase={supabase}
            onlineIds={onlineIds}
            currentUserId={me.id}
            currentUserProfile={me}
            friendProfiles={friends}
            onClose={() => onScreenChange('list')}
          />
        )}
        {screen === 'pinball' && (
          <PinballView
            supabase={supabase}
            currentUserId={me.id}
            currentUserProfile={me}
            onClose={() => onScreenChange('list')}
          />
        )}
        {screen === 'yacht' && (
          <YachtView
            supabase={supabase}
            onlineIds={onlineIds}
            currentUserId={me.id}
            currentUserProfile={me}
            friendProfiles={friends}
            onClose={() => onScreenChange('list')}
          />
        )}
        {screen === 'orb_merge' && (
          <OrbMergeView
            supabase={supabase}
            currentUserId={me.id}
            currentUserProfile={me}
            onClose={() => onScreenChange('list')}
          />
        )}
        {screen === 'ear_training' && (
          <EarTrainingView
            supabase={supabase}
            currentUserId={me.id}
            currentUserProfile={me}
            friendProfiles={friends}
            onClose={() => onScreenChange('list')}
            pendingInviteRoomId={typeof window !== 'undefined' ? sessionStorage.getItem('join_room_id') : null}
          />
        )}
      </LanguageProvider>
      </ArcadeContext.Provider>
      </GameSurface>
    </div>
  )
}
