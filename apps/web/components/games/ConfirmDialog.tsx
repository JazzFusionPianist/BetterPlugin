'use client'

/**
 * In-app confirm dialog.
 *
 * JUCE's WKWebView blocks the native window.confirm() / alert(), so any
 * confirm-before-acting flow (game forfeits, etc.) silently no-ops
 * inside the plugin. This renders a small centred dialog that works in
 * both the regular browser and the plugin.
 *
 * Shared by every game's Forfeit button. Mounts only when `open` is
 * true; backdrop click and Cancel both dismiss without confirming.
 */
import {GameButton} from '@orb/core/components/GameButton'
import {useEffect,useState} from 'react'
import { useT } from '@/lib/games/i18n'

interface Props {
  open: boolean
  /** Body text — already-localised string. */
  message: string
  /** Label for the destructive action button (e.g. "Forfeit"). */
  confirmLabel: string
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

export default function ConfirmDialog ({ open, message, confirmLabel, onConfirm, onCancel }: Props) {
  const { t } = useT()
  const [pending,setPending]=useState(false)
  const [failed,setFailed]=useState(false)
  useEffect(()=>{if(open)setFailed(false)},[open])
  const confirm=async()=>{
    if(pending)return
    setPending(true);setFailed(false)
    try {await onConfirm()} catch(error) {console.error('[game.confirm]',error);setFailed(true)}
    finally {setPending(false)}
  }
  if (!open) return null
  return (
    <div
      className="et-confirm-overlay"
      onClick={e => { if (!pending && e.target === e.currentTarget) onCancel() }}
    >
      <div className="et-confirm-modal" role="dialog" aria-label={confirmLabel}>
        <div className="et-confirm-text">{message}</div>
        {failed && <p className="game-action-error" role="alert">{t('game.actionFailed')}</p>}
        <div className="et-confirm-actions">
          <GameButton className="et-confirm-btn et-confirm-cancel" onClick={onCancel} disabled={pending}>
            {t('common.cancel')}
          </GameButton>
          <GameButton className="et-confirm-btn et-confirm-danger" onClick={confirm} disabled={pending}>
            {confirmLabel}
          </GameButton>
        </div>
      </div>
    </div>
  )
}
