import React from 'react'
import FloatingOrbs from '../FloatingOrbs'

interface Props {
  onSelectGame: (game: 'chess') => void
  onClose: () => void
}

interface GameCard {
  id: 'chess'
  icon: React.ReactNode
  name: string
  description: string
}

const GAMES: GameCard[] = [
  {
    id: 'chess',
    icon: (
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* King piece silhouette */}
        <rect x="13" y="2" width="6" height="3" rx="1" fill="currentColor" />
        <rect x="15" y="1" width="2" height="5" rx="1" fill="currentColor" />
        <rect x="14" y="5" width="4" height="2" rx="0.5" fill="currentColor" />
        <path
          d="M10 8 Q11 7 16 7 Q21 7 22 8 L24 20 H8 Z"
          fill="currentColor"
        />
        <rect x="7" y="20" width="18" height="3" rx="1" fill="currentColor" />
        <rect x="5" y="23" width="22" height="3" rx="1.5" fill="currentColor" />
      </svg>
    ),
    name: 'Chess',
    description: 'Play vs a friend',
  },
]

export default function GameListView({ onSelectGame }: Props) {
  return (
    <div className="game-list-view">
      <FloatingOrbs count={28} />
      <div className="game-list-scroll">
        {GAMES.map(game => (
          <div
            key={game.id}
            className="game-card"
            onClick={() => onSelectGame(game.id)}
            role="button"
            tabIndex={0}
          >
            <div className="game-card-icon">{game.icon}</div>
            <div className="game-card-info">
              <div className="game-card-name">{game.name}</div>
              <div className="game-card-desc">{game.description}</div>
            </div>
            <span className="game-card-arrow" aria-hidden="true">›</span>
          </div>
        ))}
      </div>
    </div>
  )
}
