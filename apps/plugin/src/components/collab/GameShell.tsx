/**
 * GameShell — shared container for every mini-game.
 *
 * Every game (Chess, Poker, Falling Blocks, Ear Training) shares the same
 * chrome: a header (back / title / controls), a board area with a status
 * overlay (lobby → ready → finished cards), an invite bottom-sheet, and a
 * forfeit confirm dialog. Only the BOARD/CONTENT and the small overlay-card
 * bodies vary per game.
 *
 * A game renders:
 *   <GameShell
 *     title=… onBack=… controls={…resign/forfeit buttons…}
 *     aboveBoard={…opponent row…} board={<MyBoard/>} belowBoard={…my row…}
 *     overlay={status==='playing' ? null : <GameOverlayCard …/>}
 *     invite={{ open, onClose, friends, invitedIds, onInvite, canInvite }}
 *     confirm={{ open, message, confirmLabel, onConfirm, onCancel }}
 *   />
 *
 * The chrome lives here once; adding a new game means writing its board +
 * adapter, not re-building lobby/invite/forfeit/result UI.
 */
import { useState, useMemo, type ReactNode } from 'react'
import type { Profile } from '../../types/collab'
import { useT } from '../../i18n/LanguageContext'
import ConfirmDialog from './ConfirmDialog'

// ── Shared avatar ─────────────────────────────────────────────────────────────
export function GameAvatar ({ profile, size = 28 }: { profile: Profile; size?: number }) {
  if (profile.avatar_url) {
    return (
      <img
        className="game-player-av"
        src={profile.avatar_url}
        alt={profile.display_name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
      />
    )
  }
  return (
    <div
      className="game-player-av"
      style={{
        width: size, height: size, borderRadius: '50%',
        background: profile.avatar_color || '#555',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 700, fontSize: size * 0.4, flexShrink: 0,
      }}
    >
      {profile.initials}
    </div>
  )
}

// ── Overlay card (lobby / ready / finished) ───────────────────────────────────
export function GameOverlayCard ({ emoji, title, children, className }: {
  emoji?: ReactNode
  title?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={`game-finish-card${className ? ' ' + className : ''}`}>

      {emoji != null && <div className="game-finish-emoji">{emoji}</div>}
      {title != null && <div className="game-finish-title">{title}</div>}
      {children}
    </div>
  )
}

// ── Ready / Rematch button + counter ──────────────────────────────────────────
export function GameReadyControl ({ ready, count, onToggle, disabled }: {
  ready: boolean
  /** e.g. "1 / 2" — pass the already-formatted readiness string, or omit. */
  count?: ReactNode
  onToggle: () => void
  disabled?: boolean
}) {
  const { t } = useT()
  return (
    <>
      <button
        className={`game-ready-btn${ready ? ' ready' : ''}`}
        onClick={onToggle}
        disabled={disabled}
      >
        {ready ? t('common.readyCheck') : t('common.ready')}
      </button>
      {count != null && <div className="game-finish-readystate">{count}</div>}
    </>
  )
}

// ── Invite bottom-sheet ───────────────────────────────────────────────────────
interface InviteProps {
  open: boolean
  onClose: () => void
  friends: Profile[]
  /** Friends already invited this lobby session — shows green "Invited". */
  invitedIds: Set<string>
  onInvite: (friendId: string) => void
  /** Returns false to disable a fresh invite (e.g. N-player capacity reached).
   *  Already-invited friends stay clickable so they can be cancelled. */
  canInvite?: (friendId: string) => boolean
}

function GameInviteModal ({ friends, invitedIds, onInvite, onClose, canInvite }: Omit<InviteProps, 'open'>) {
  const { t } = useT()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? friends.filter(f => f.display_name.toLowerCase().includes(q)) : friends
    return [...list].sort((a, b) => {
      const aOn = a.isOnline ? 0 : 1
      const bOn = b.isOnline ? 0 : 1
      if (aOn !== bOn) return aOn - bOn
      return a.display_name.localeCompare(b.display_name)
    })
  }, [friends, query])

  return (
    <div
      className="game-invite-modal-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="game-invite-modal" role="dialog" aria-label={t('game.inviteFriend')}>
        <div className="game-invite-modal-header">
          <span className="game-invite-modal-title">{t('game.inviteFriend')}</span>
          <button className="game-invite-modal-close" onClick={onClose} aria-label="Close invite dialog">×</button>
        </div>
        {friends.length > 0 && (
          <div className="game-invite-search-wrap">
            <svg className="game-invite-search-icon" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="6.8" cy="6.8" r="4.2" /><path d="M10.2 10.2L13 13" strokeLinecap="round" />
            </svg>
            <input
              className="game-invite-search-input"
              type="text"
              placeholder={t('game.searchFriends')}
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
            {query && (
              <button className="game-invite-search-clear" onClick={() => setQuery('')} aria-label="Clear search">×</button>
            )}
          </div>
        )}
        {friends.length === 0 ? (
          <p className="game-invite-empty">{t('game.noFriendsToInvite')}</p>
        ) : filtered.length === 0 ? (
          <p className="game-invite-empty">{t('game.noMatch', { q: query })}</p>
        ) : (
          <div className="game-invite-list">
            {filtered.map(friend => {
              const invited = invitedIds.has(friend.id)
              const disabled = !invited && canInvite ? !canInvite(friend.id) : false
              return (
                <div key={friend.id} className="game-invite-row">
                  <div className="game-invite-av-wrap">
                    <GameAvatar profile={friend} size={36} />
                    {friend.isOnline && <span className="game-invite-online-dot" />}
                  </div>
                  <span className="game-invite-name">{friend.display_name}</span>
                  <button
                    className={`game-invite-do-btn${invited ? ' invited' : ''}`}
                    onClick={() => onInvite(friend.id)}
                    disabled={disabled}
                    title={invited ? t('game.invited') : t('game.invite')}
                  >
                    {invited ? t('game.invited') : t('game.invite')}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Shell ─────────────────────────────────────────────────────────────────────
interface GameShellProps {
  title: string
  onBack: () => void
  /** Header right-side controls (resign / forfeit / draw) — shown when playing. */
  controls?: ReactNode
  /** Content above the board (e.g. opponent row, captured pieces). */
  aboveBoard?: ReactNode
  /** The game board / cards / content. */
  board: ReactNode
  /** Content below the board (e.g. my row, move history). */
  belowBoard?: ReactNode
  /** Card to overlay on the board (lobby/ready/finished). `null` while playing. */
  overlay?: ReactNode | null
  invite?: InviteProps
  confirm?: {
    open: boolean
    message: string
    confirmLabel: string
    onConfirm: () => void
    onCancel: () => void
  }
  /** Any extra game-specific modals (e.g. chess promotion). */
  extraModals?: ReactNode
}

export default function GameShell ({
  title, onBack, controls, aboveBoard, board, belowBoard, overlay, invite, confirm, extraModals,
}: GameShellProps) {
  const { t } = useT()
  return (
    <div className="game-view">
      <div className="game-header">
        <button className="game-back-btn" onClick={onBack} aria-label={t('common.goBack')}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="game-title">{title}</span>
        {controls && <div className="game-controls">{controls}</div>}
      </div>

      <div className="game-area">
        {aboveBoard}
        <div className={`game-board-wrap${overlay ? ' has-overlay' : ''}`}>
          {board}
          {overlay && <div className="game-finish-overlay">{overlay}</div>}
        </div>
        {belowBoard}
      </div>

      {invite?.open && (
        <GameInviteModal
          friends={invite.friends}
          invitedIds={invite.invitedIds}
          onInvite={invite.onInvite}
          onClose={invite.onClose}
          canInvite={invite.canInvite}
        />
      )}

      {confirm && (
        <ConfirmDialog
          open={confirm.open}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          onConfirm={confirm.onConfirm}
          onCancel={confirm.onCancel}
        />
      )}

      {extraModals}
    </div>
  )
}
