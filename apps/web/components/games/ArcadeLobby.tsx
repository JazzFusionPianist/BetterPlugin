'use client'

import type { ReactNode } from 'react'
import { createContext, useContext } from 'react'
import { useT } from '@/lib/games/i18n'
import type { TKey } from '@/lib/games/translations'
import type { GameId } from './GameListView'

/**
 * The arcade — the wide-screen game lobby. Every game is an arch in its
 * own flat colour with one drawn object standing inside; choosing an arch
 * floods the room with that colour (the wall-* classes in arcade.css).
 *
 * Only the desktop studio and the plugin's large screen turn this on
 * (GamesPanel's `arcade` prop). Phones keep GameListView.
 */

/** True inside an arcade-skinned GamesPanel — lets shared chrome (GameShell)
 *  swap icons for words without every game passing a prop down. */
export const ArcadeContext = createContext(false)
export const useArcade = () => useContext(ArcadeContext)

const PAPER = '#FBFAF7'
const INK = '#1A1917'

interface Arch {
  id: GameId
  nameKey: TKey
  /** The arcade's own short line (not the CD wall's description). */
  subKey: TKey
  /** The arch and the room's wall. */
  wall: string
  object: ReactNode
}

// Objects are drawn in a 120×150 box, standing on its bottom edge.
const ARCHES: Arch[] = [
  {
    id: 'chess', nameKey: 'game.chess', subKey: 'arcade.chess', wall: '#1E9E63',
    object: (
      <>
        <circle cx="60" cy="40" r="23" fill={PAPER} />
        <rect x="36" y="62" width="48" height="10" rx="5" fill={PAPER} />
        <path d="M45 72 C45 104 33 116 28 134 H92 C87 116 75 104 75 72 Z" fill={PAPER} />
        <rect x="18" y="132" width="84" height="18" rx="9" fill={PAPER} />
      </>
    ),
  },
  {
    id: 'falling_blocks', nameKey: 'game.fallingBlocks', subKey: 'arcade.fallingBlocks', wall: '#7B5CFF',
    object: (
      <>
        {[0, 30, 60, 90].map(x => <rect key={x} x={x + 1} y="121" width="28" height="28" rx="6" fill={PAPER} />)}
        <rect x="1" y="91" width="28" height="28" rx="6" fill={PAPER} />
        <rect x="31" y="91" width="28" height="28" rx="6" fill={PAPER} />
        <rect x="91" y="61" width="28" height="28" rx="6" fill={INK} />
        <rect x="91" y="31" width="28" height="28" rx="6" fill={INK} />
        <rect x="61" y="31" width="28" height="28" rx="6" fill={INK} />
      </>
    ),
  },
  {
    id: 'poker', nameKey: 'game.poker', subKey: 'arcade.poker', wall: '#D6402E',
    object: (
      <>
        <rect x="12" y="56" width="62" height="88" rx="9" fill={INK} transform="rotate(-11 43 100)" />
        <g transform="rotate(7 81 100)">
          <rect x="50" y="54" width="62" height="90" rx="9" fill={PAPER} />
          <path transform="translate(81 102) scale(1.15)" fill="#D6402E"
            d="M0 9 C-16 -3 -13 -15 -6 -15 C-2.5 -15 0 -12.5 0 -9.5 C0 -12.5 2.5 -15 6 -15 C13 -15 16 -3 0 9 Z" />
        </g>
      </>
    ),
  },
  {
    id: 'pinball', nameKey: 'game.pinball', subKey: 'arcade.pinball', wall: '#2440FF',
    object: (
      <>
        <path d="M20 48 A40 40 0 0 1 100 48" stroke={PAPER} strokeWidth="7" strokeLinecap="round" fill="none" />
        <circle cx="60" cy="66" r="17" fill={PAPER} />
        <path d="M12 116 L50 136" stroke={INK} strokeWidth="16" strokeLinecap="round" />
        <path d="M108 116 L70 136" stroke={INK} strokeWidth="16" strokeLinecap="round" />
      </>
    ),
  },
  {
    id: 'yacht', nameKey: 'game.yacht', subKey: 'arcade.yacht', wall: '#F5B82E',
    object: (
      <>
        <rect x="4" y="88" width="62" height="62" rx="14" fill={PAPER} />
        {[[20, 104], [50, 104], [35, 119], [20, 134], [50, 134]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="5.5" fill={INK} />)}
        <g transform="rotate(12 87 53)">
          <rect x="56" y="22" width="62" height="62" rx="14" fill={PAPER} />
          {[[72, 38], [87, 53], [102, 68]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="5.5" fill={INK} />)}
        </g>
      </>
    ),
  },
  {
    id: 'orb_merge', nameKey: 'game.orbMerge', subKey: 'arcade.orbMerge', wall: '#F3A3C0',
    object: (
      <>
        <circle cx="40" cy="114" r="36" fill={PAPER} />
        <circle cx="98" cy="128" r="22" fill={INK} />
        <circle cx="86" cy="82" r="12" stroke={PAPER} strokeWidth="5" fill="none" />
        <circle cx="52" cy="34" r="9" fill={PAPER} />
      </>
    ),
  },
  {
    id: 'ear_training', nameKey: 'game.earTraining', subKey: 'arcade.earTraining', wall: '#1A1917',
    object: (
      <>
        <ellipse cx="32" cy="128" rx="18" ry="12" transform="rotate(-20 32 128)" stroke={PAPER} strokeWidth="9" fill="none" />
        <ellipse cx="88" cy="104" rx="18" ry="12" transform="rotate(-20 88 104)" stroke={PAPER} strokeWidth="9" fill="none" />
        <path d="M14 98 C28 58 70 44 104 70" stroke="#F5B82E" strokeWidth="6" strokeLinecap="round" fill="none" />
      </>
    ),
  },
]

interface Props {
  onSelectGame: (game: GameId) => void
  onClose: () => void
}

export default function ArcadeLobby({ onSelectGame, onClose }: Props) {
  const { t } = useT()
  return (
    <div className="arcade">
      <div className="arcade-head">
        <span className="arcade-title">{t('game.games')}</span>
        <button className="arcade-close" onClick={onClose}>{t('common.close')}</button>
      </div>
      <div className="arcade-row">
        {ARCHES.map(a => (
          <button key={a.id} className="arcade-arch" onClick={() => onSelectGame(a.id)}>
            <span className="arcade-door" style={{ background: a.wall }}>
              <svg className="arcade-object" viewBox="0 0 120 150" fill="none" aria-hidden="true">{a.object}</svg>
            </span>
            <span className="arcade-name">{t(a.nameKey)}</span>
            <span className="arcade-sub">{t(a.subKey)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
