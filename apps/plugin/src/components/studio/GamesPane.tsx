/**
 * Games, inside the studio. The full plug-in's CD wall and every game
 * view run unchanged inside a `.plugin`-classed host that fills the main
 * pane — collab.css's wall (`gwall-<game>` + the dark token set) darkens
 * just this pane, so a game reads as a stage set into the paper studio.
 *
 * Data wiring is GamesPage's verbatim: the same views, the same props,
 * `joinNonce` remounting a view so it re-reads a pending join_room_id.
 * The pane stays mounted (hidden) while the player answers a chat, so a
 * live room never drops.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '../../types/collab'
import GameListView, { type GameId } from '../collab/GameListView'
import ChessView from '../collab/ChessView'
import FallingBlocksView from '../collab/FallingBlocksView'
import PinballView from '../collab/PinballView'
import OrbMergeView from '../collab/OrbMergeView'
import YachtView from '../collab/YachtView'
import PokerView from '../collab/PokerView'
import EarTrainingView from '../collab/EarTrainingView'
import SudokuView from '../collab/SudokuView'
import MinesweeperView from '../collab/MinesweeperView'
import SolitaireView from '../collab/SolitaireView'
import BoardGameView from '../collab/BoardGameView'
import { useT } from '../../i18n/LanguageContext'
import '../../pages/collab.css'

export type GameScreen = 'list' | GameId

/** Game id → the per-game translation key (the CD wall's own labels). */
export const GAME_NAME_KEY = {
  chess: 'game.chess',
  falling_blocks: 'game.fallingBlocks',
  poker: 'game.poker',
  ear_training: 'game.earTraining',
  pinball: 'game.pinball',
  yacht: 'game.yacht',
  orb_merge: 'game.orbMerge',
  sudoku: 'game.sudoku',
  minesweeper: 'game.minesweeper',
  solitaire: 'game.solitaire',
  connect4: 'game.connect4',
  gomoku: 'game.gomoku',
  reversi: 'game.reversi',
} as const

export const SOLO_GAMES: ReadonlySet<string> = new Set(['pinball', 'orb_merge', 'sudoku', 'minesweeper', 'solitaire'])
export const isGameId = (s: string): s is GameId => s in GAME_NAME_KEY

/** Localised game name for an id the chat may carry (unknown → the id). */
export function useGameName(): (id: string) => string {
  const { t } = useT()
  return useCallback((id: string) => (isGameId(id) ? t(GAME_NAME_KEY[id]) : id.replace(/_/g, ' ')), [t])
}

interface Props {
  supabase: SupabaseClient
  userId: string
  me: Profile | null
  friendProfiles: Profile[]
  onlineIds: Set<string>
  screen: GameScreen
  /** Bumped by the shell whenever a room must be (re)joined on mount. */
  joinNonce: number
  /** Set while the wall is picking a game to INVITE the open chat to. */
  inviteConversationId: string | null
  onSelectGame: (g: GameId) => void
  onBackToList: () => void
  /** Leave the pane — back to whatever the studio showed before. */
  onClose: () => void
  /** Who the invite is for — named in the wall's title while picking. */
  headline?: string
  /** Keep mounted but off the wall (a live room must not drop). */
  hidden?: boolean
}

export default function GamesPane({
  supabase, userId, me, friendProfiles, onlineIds, screen, joinNonce, inviteConversationId,
  onSelectGame, onBackToList, onClose, headline, hidden,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)

  // The CD wall's snap-scroll measures its container on mount; a pane
  // that resizes with the window needs a nudge so spacers re-measure.
  const [, bump] = useState(0)
  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    const ro = new ResizeObserver(() => bump(n => n + 1))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const common = { supabase, currentUserId: userId, currentUserProfile: me, onClose: onBackToList }
  const cls = [
    'wd-games', 'plugin', 'games', 'game-open', 'screen-wide',
    screen !== 'list' ? `gwall-${screen} dark` : '',
  ].filter(Boolean).join(' ')

  return (
    <div ref={hostRef} className={cls} hidden={hidden}>
      {/* The studio line sits over the wall only; a game brings its own
          header (‹ back to the wall), so the bar steps out of its way. */}
      {screen === 'list' && (
        <div className="top-bar wd-games-bar">
          <button className="wd-games-back" onClick={onClose}>‹ studio</button>
          <span className="wd-games-title">
            {inviteConversationId ? `invite ${headline ?? 'them'} to…` : 'games'}
          </span>
        </div>
      )}
      <div className="content">
        <div className="view gview">
          {screen === 'list' && (
            <GameListView
              inviteContext={inviteConversationId ? { conversationId: inviteConversationId } : null}
              onSelectGame={onSelectGame}
              onClose={onClose}
            />
          )}
          {screen === 'chess' && (
            <ChessView key={joinNonce} {...common} friendProfiles={friendProfiles} />
          )}
          {screen === 'falling_blocks' && (
            <FallingBlocksView key={joinNonce} {...common} friendProfiles={friendProfiles} onlineIds={onlineIds} />
          )}
          {screen === 'poker' && (
            <PokerView key={joinNonce} {...common} friendProfiles={friendProfiles} onlineIds={onlineIds} />
          )}
          {screen === 'pinball' && <PinballView key={joinNonce} {...common} />}
          {screen === 'yacht' && (
            <YachtView key={joinNonce} {...common} friendProfiles={friendProfiles} onlineIds={onlineIds} />
          )}
          {screen === 'orb_merge' && <OrbMergeView key={joinNonce} {...common} />}
          {screen === 'ear_training' && (
            <EarTrainingView key={joinNonce} {...common} friendProfiles={friendProfiles}
              pendingInviteRoomId={sessionStorage.getItem('join_room_id')} />
          )}
          {screen === 'sudoku' && <SudokuView key={joinNonce} {...common} />}
          {screen === 'minesweeper' && <MinesweeperView key={joinNonce} {...common} />}
          {screen === 'solitaire' && <SolitaireView key={joinNonce} {...common} />}
          {(screen === 'connect4' || screen === 'gomoku' || screen === 'reversi') && (
            <BoardGameView key={`${screen}-${joinNonce}`} game={screen} {...common} friendProfiles={friendProfiles} />
          )}
        </div>
      </div>
    </div>
  )
}
