import type { ReactNode } from 'react'
import { createContext, useContext, useEffect, useRef } from 'react'
import { useT } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/translations'
import type { GameId } from './GameListView'

/**
 * The arcade — the wide-screen game lobby. Every game is an arch in its
 * own flat colour with one drawn object standing inside; choosing an arch
 * floods the room with that colour (the wall-* classes in arcade.css).
 *
 * Only the wide surfaces turn this on (`screen-wide` + `arcade-skin` on
 * the .plugin root: the studio pane, the large window, the wide Slur
 * Games split-out). The 300×500 panel keeps GameListView's CD wall.
 */

/** True inside an arcade-skinned .plugin root — lets shared chrome (GameShell)
 *  swap icons for words without every game passing a prop down. */
export const ArcadeContext = createContext(false)
export const useArcade = () => useContext(ArcadeContext)

const PAPER = '#FBFAF7'
const INK = '#1A1917'

interface Arch {
  id: GameId
  nameKey: TKey
  descKey: TKey
  /** The arch and the room's wall. */
  wall: string
  object: ReactNode
}

// Objects are drawn in a 120×150 box, standing on its bottom edge.
const ARCHES: Arch[] = [
  {
    id: 'chess', nameKey: 'game.chess', descKey: 'game.chessDesc', wall: '#1E9E63',
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
    id: 'falling_blocks', nameKey: 'game.fallingBlocks', descKey: 'game.fallingBlocksDesc', wall: '#7B5CFF',
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
    id: 'poker', nameKey: 'game.poker', descKey: 'game.pokerDesc', wall: '#D6402E',
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
    id: 'pinball', nameKey: 'game.pinball', descKey: 'game.pinballDesc', wall: '#2440FF',
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
    id: 'yacht', nameKey: 'game.yacht', descKey: 'game.yachtDesc', wall: '#F5B82E',
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
    id: 'orb_merge', nameKey: 'game.orbMerge', descKey: 'game.orbMergeDesc', wall: '#F3A3C0',
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
    id: 'ear_training', nameKey: 'game.earTraining', descKey: 'game.earTrainingDesc', wall: '#1A1917',
    object: (
      <>
        <ellipse cx="32" cy="128" rx="18" ry="12" transform="rotate(-20 32 128)" stroke={PAPER} strokeWidth="9" fill="none" />
        <ellipse cx="88" cy="104" rx="18" ry="12" transform="rotate(-20 88 104)" stroke={PAPER} strokeWidth="9" fill="none" />
        <path d="M14 98 C28 58 70 44 104 70" stroke="#F5B82E" strokeWidth="6" strokeLinecap="round" fill="none" />
      </>
    ),
  },
  {
    id: 'sudoku', nameKey: 'game.sudoku', descKey: 'game.sudokuDesc', wall: '#9CC3FF',
    object: (
      <>
        {[0, 1, 2].flatMap(r => [0, 1, 2].map(c => {
          const on = (r === 0 && c === 1) || (r === 2 && c === 0)
          return <rect key={`${r}-${c}`} x={9 + c * 35} y={45 + r * 35} width="32" height="32" rx="7" fill={on ? INK : PAPER} />
        }))}
      </>
    ),
  },
  {
    id: 'minesweeper', nameKey: 'game.minesweeper', descKey: 'game.minesweeperDesc', wall: '#F4873A',
    object: (
      <>
        <rect x="6" y="42" width="52" height="52" rx="11" fill={PAPER} />
        <rect x="62" y="42" width="52" height="52" rx="11" fill={PAPER} />
        <rect x="6" y="98" width="52" height="52" rx="11" fill={PAPER} />
        <circle cx="88" cy="124" r="20" fill={INK} />
        <path d="M32 54 V84 M32 55 L48 62 L32 69" stroke={INK} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>
    ),
  },
  {
    id: 'solitaire', nameKey: 'game.solitaire', descKey: 'game.solitaireDesc', wall: '#17907F',
    object: (
      <>
        <rect x="26" y="34" width="68" height="94" rx="10" fill={INK} />
        <rect x="26" y="45" width="68" height="94" rx="10" fill={PAPER} />
        <rect x="26" y="45" width="68" height="14" rx="7" fill={INK} opacity="0.16" />
        <rect x="26" y="56" width="68" height="94" rx="10" fill={PAPER} />
        <path transform="translate(60 105) scale(1.3)" fill={INK}
          d="M0 -16 C12 -6 15 -1 15 4 C15 9 11 12 7 12 C4 12 2 10 1 8 L3 16 H-3 L-1 8 C-2 10 -4 12 -7 12 C-11 12 -15 9 -15 4 C-15 -1 -12 -6 0 -16 Z" />
      </>
    ),
  },
  {
    id: 'connect4', nameKey: 'game.connect4', descKey: 'game.connect4Desc', wall: '#C4D82E',
    object: (
      <>
        {[[18, 132, PAPER], [46, 132, INK], [74, 132, INK], [102, 132, PAPER], [46, 104, PAPER], [74, 104, INK], [74, 76, PAPER], [74, 34, INK]]
          .map(([x, y, f]) => <circle key={`${x}-${y}`} cx={x as number} cy={y as number} r="12.5" fill={f as string} />)}
      </>
    ),
  },
  {
    id: 'gomoku', nameKey: 'game.gomoku', descKey: 'game.gomokuDesc', wall: '#D9A066',
    object: (
      <>
        {[30, 60, 90].map(v => <path key={`v${v}`} d={`M${v} 44 V150`} stroke={INK} strokeWidth="2" opacity="0.45" />)}
        {[60, 90, 120].map(h => <path key={`h${h}`} d={`M10 ${h} H110`} stroke={INK} strokeWidth="2" opacity="0.45" />)}
        <circle cx="30" cy="120" r="13" fill={INK} />
        <circle cx="60" cy="90" r="13" fill={INK} />
        <circle cx="90" cy="60" r="13" fill={INK} />
        <circle cx="60" cy="120" r="13" fill={PAPER} />
        <circle cx="90" cy="90" r="13" fill={PAPER} />
      </>
    ),
  },
  {
    id: 'reversi', nameKey: 'game.reversi', descKey: 'game.reversiDesc', wall: '#0F5C4D',
    object: (
      <>
        <circle cx="42" cy="112" r="38" fill={PAPER} />
        <circle cx="84" cy="74" r="30" fill={INK} />
        <path d="M84 44 A30 30 0 0 1 84 104 Z" fill={PAPER} />
      </>
    ),
  },
]

interface Props {
  onSelectGame: (game: GameId) => void
  /** Leave the arcade. Omit where there is nowhere to go back to (the
   *  Slur Games split-out). */
  onClose?: () => void
  /** Replaces the word "games" — e.g. "invite sam to…". */
  title?: string
}

export default function ArcadeLobby({ onSelectGame, onClose, title }: Props) {
  const { t } = useT()
  // Thirteen arches overflow most panes. A plain mouse wheel has no
  // horizontal axis, so vertical ticks are turned sideways; trackpads
  // (which report deltaX) are left to scroll natively.
  const rowRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const row = rowRef.current
    if (!row) return
    const onWheel = (e: WheelEvent) => {
      if (e.deltaX !== 0 || e.deltaY === 0) return
      e.preventDefault()
      row.scrollLeft += e.deltaY
    }
    row.addEventListener('wheel', onWheel, { passive: false })
    return () => row.removeEventListener('wheel', onWheel)
  }, [])
  return (
    <div className="arcade">
      <div className="arcade-head">
        <span className="arcade-title">{title ?? t('game.games')}</span>
        {onClose && <button className="arcade-close" onClick={onClose}>{t('common.close')}</button>}
      </div>
      <div className="arcade-row" ref={rowRef}>
        {ARCHES.map(a => (
          <button key={a.id} className="arcade-arch" onClick={() => onSelectGame(a.id)}>
            <span className="arcade-door" style={{ background: a.wall }}>
              <svg className="arcade-object" viewBox="0 0 120 150" fill="none" aria-hidden="true">{a.object}</svg>
            </span>
            <span className="arcade-name">{t(a.nameKey)}</span>
            {/* the catalogue's rule: words are set apart by commas, never dots */}
            <span className="arcade-sub">{t(a.descKey).replace(/\s*[·・]\s*/g, ', ')}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
