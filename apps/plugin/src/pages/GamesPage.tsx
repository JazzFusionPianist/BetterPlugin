import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { useProfiles } from '../hooks/useProfiles'
import { usePresence } from '../hooks/usePresence'
import { useFollows } from '../hooks/useFollows'
import GameListView, { type GameId } from '../components/collab/GameListView'
import ChessView from '../components/collab/ChessView'
import FallingBlocksView from '../components/collab/FallingBlocksView'
import PinballView from '../components/collab/PinballView'
import OrbMergeView from '../components/collab/OrbMergeView'
import YachtView from '../components/collab/YachtView'
import PokerView from '../components/collab/PokerView'
import EarTrainingView from '../components/collab/EarTrainingView'
import SudokuView from '../components/collab/SudokuView'
import MinesweeperView from '../components/collab/MinesweeperView'
import SolitaireView from '../components/collab/SolitaireView'
import BoardGameView from '../components/collab/BoardGameView'
import ResizeGrip from '../components/collab/ResizeGrip'
import { hasJuceBridge } from '../lib/juceBridge'
import { adoptSharedWindowSize, watchSharedWindowSize } from '../lib/pluginWindow'
import './collab.css'

interface Props { supabase: SupabaseClient; user: User }

type Screen = 'list' | GameId

/** Orb Games — the mini-games room as its own plugin. Loaded with
 *  ?surface=games by the OrbGames JUCE target (also a browser dev
 *  override), after the normal auth flow: multiplayer rooms, invites and
 *  the world scores all hang off the account, so unlike Orb Sounds this
 *  split-out still signs in.
 *
 *  No toolbar, no other rooms: the CD wall IS the plugin. The shell
 *  reuses `.plugin.game-open` + the per-game `gwall-*` wall so every game
 *  darkens the room exactly as it does inside the full Orb. Data wiring
 *  mirrors CollabPage's game block verbatim — useProfiles / usePresence /
 *  useFollows feed the same props into the same views. */
export default function GamesPage({ supabase, user }: Props) {
  const screenPreview = new URLSearchParams(window.location.search).get('screen') === 'large'
  const fill = hasJuceBridge || screenPreview

  // Same window as the other split-outs: a fresh instance adopts the size
  // the last Orb window was dragged to, and every resize here updates it.
  const [wide, setWide] = useState(screenPreview)
  useEffect(() => {
    void adoptSharedWindowSize()
    const stopWatching = watchSharedWindowSize()
    if (screenPreview) return stopWatching
    const apply = () => setWide(window.innerWidth >= 520)
    apply()
    window.addEventListener('resize', apply)
    return () => { stopWatching(); window.removeEventListener('resize', apply) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The user's paper/ink preference from the full Orb rides along (same
  // origin, same localStorage key) so the CD wall matches their room.
  const isDark = localStorage.getItem('collab_dark') === 'true'

  const { profiles, me } = useProfiles(supabase, user.id)
  const onlineIds = usePresence(supabase, user.id)
  const { mutualIds } = useFollows(supabase, user.id)
  const friendProfiles = useMemo(
    () => profiles.filter(p => mutualIds.has(p.id)).map(p => ({ ...p, isOnline: onlineIds.has(p.id) })),
    [profiles, mutualIds, onlineIds],
  )

  const [screen, setScreen] = useState<Screen>('list')
  // Bumped whenever a game is (re)opened so its view mounts fresh and
  // re-reads any pending join_room_id — CollabPage's gameJoinNonce.
  const [joinNonce, setJoinNonce] = useState(0)

  const openGame = async (g: GameId) => {
    try {
      // Solo games — no rooms to resume.
      if (g === 'pinball' || g === 'orb_merge' || g === 'sudoku' || g === 'minesweeper' || g === 'solitaire') return
      const { findActiveGame } = await import('../lib/gameRooms')
      const active = await findActiveGame(supabase, user.id)
      if (active?.gameType === g) sessionStorage.setItem('join_room_id', active.roomId)
    } catch (err) {
      console.error('[selectGame]', err)
    } finally {
      setJoinNonce(n => n + 1)
      setScreen(g)
    }
  }
  const backToList = () => setScreen('list')

  const cls = [
    'plugin', 'games', 'game-open',
    (fill && wide) ? 'screen-wide' : '',
    isDark ? 'dark' : '',
    // Each game darkens the room in its own colour; the `dark` token set
    // rides along so the wordmark and every card invert with the wall.
    screen !== 'list' ? `gwall-${screen} dark` : '',
  ].filter(Boolean).join(' ')
  // (plain-browser preview keeps its fixed 300×500 frame, as CollabPage does)
  const style = (fill ? { width: '100%', height: '100%' } : {}) as CSSProperties

  const common = { supabase, currentUserId: user.id, currentUserProfile: me, onClose: backToList }

  return (
    <div className={cls} style={style}>
      <ResizeGrip />
      {/* Same height as the full plugin's toolbar so the wall sits where
          the room was composed; the wordmark takes the dimmed-glyph tone.
          Sign-out is the one thing an account-bound split-out can't do
          without — bare text, no chrome, same tone. */}
      <div className="top-bar">
        <span className="games-mark">slur games</span>
        <span className="games-signout" role="button" tabIndex={0}
          onClick={() => { void supabase.auth.signOut() }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void supabase.auth.signOut() } }}
        >sign out</span>
      </div>
      <div className="content">
        <div className="view gview">
          {screen === 'list' && (
            <GameListView onSelectGame={(g) => { void openGame(g) }} onClose={() => {}} />
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
          {screen === 'pinball' && (
            <PinballView key={joinNonce} {...common} />
          )}
          {screen === 'yacht' && (
            <YachtView key={joinNonce} {...common} friendProfiles={friendProfiles} onlineIds={onlineIds} />
          )}
          {screen === 'orb_merge' && (
            <OrbMergeView key={joinNonce} {...common} />
          )}
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
