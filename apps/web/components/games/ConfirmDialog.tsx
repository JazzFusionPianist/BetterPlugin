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
import { useT } from '@/lib/games/i18n'

interface Props {
  open: boolean
  /** Body text — already-localised string. */
  message: string
  /** Label for the destructive action button (e.g. "Forfeit"). */
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog ({ open, message, confirmLabel, onConfirm, onCancel }: Props) {
  const { t } = useT()
  if (!open) return null
  return (
    <div
      className="et-confirm-overlay"
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="et-confirm-modal" role="dialog" aria-label={confirmLabel}>
        <div className="et-confirm-text">{message}</div>
        <div className="et-confirm-actions">
          <button className="et-confirm-btn et-confirm-cancel" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button className="et-confirm-btn et-confirm-danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}