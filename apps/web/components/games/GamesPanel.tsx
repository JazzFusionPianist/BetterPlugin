'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import { LanguageProvider } from '@/lib/games/i18n'
import type { Profile } from '@/lib/games/types'
import type { GameType } from '@/lib/games/gameRooms'
import GameListView from './GameListView'
import ChessView from './ChessView'
import FallingBlocksView from './FallingBlocksView'
import PokerView from './PokerView'
import EarTrainingView from './EarTrainingView'
import PinballView from './PinballView'
import YachtView from './YachtView'
import OrbPartyView from './OrbPartyView'

export type GameScreen = 'list' | GameType | 'pinball'

interface Props {
  supabase: SupabaseClient
  me: Profile
  friends: (Profile & { isOnline?: boolean })[]
  screen: GameScreen
  onScreenChange: (s: GameScreen) => void
  onClose: () => void
}

/**
 * The games page — a full-screen overlay hosting the plugin's game
 * suite (chess / falling blocks / poker / ear training). The list and
 * every game view are ports of the plugin components; rooms, invites
 * and realtime all ride the same Supabase tables, so a match started
 * in the plugin continues seamlessly here and vice versa.
 */
export default function GamesPanel({ supabase, me, friends, screen, onScreenChange, onClose }: Props) {
  const onlineIds = new Set(friends.filter((f) => f.isOnline).map((f) => f.id))
  return (
    // Each game washes the whole page its own colour (wall-*), fx-room style.
    <div className={`games-panel${screen !== 'list' ? ` wall-${screen}` : ''}`}>
      <LanguageProvider>
        {screen === 'list' && (
          <button className="games-close" onClick={onClose} aria-label="Close games">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        )}
        {screen === 'list' && (
          <GameListView
            inviteContext={null}
            onSelectGame={async (g) => {
              // Pinball is solo — no room to resume.
              if (g !== 'pinball') {
                // Resume an in-flight room of this game if one exists.
                const { findActiveGame } = await import('@/lib/games/gameRooms')
                const active = await findActiveGame(supabase, me.id)
                if (active?.gameType === g) sessionStorage.setItem('join_room_id', active.roomId)
              }
              onScreenChange(g)
            }}
            onClose={onClose}
          />
        )}
        {screen === 'chess' && (
          <ChessView
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
        {screen === 'orb_party' && (
          <OrbPartyView
            supabase={supabase}
            onlineIds={onlineIds}
            currentUserId={me.id}
            currentUserProfile={me}
            friendProfiles={friends}
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
    </div>
  )
}
