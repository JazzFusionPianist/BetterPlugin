import { useState } from 'react'
import { useT } from '../../i18n/LanguageContext'
import type { FollowAlert } from '../../hooks/useFollowAlerts'

interface Props {
  alerts: FollowAlert[]
  followingIds: Set<string>
  onFollowBack: (id: string) => Promise<void>
  onDismiss: (id: string) => void
}

const VISIBLE = 3

/**
 * "{name} follows you" cards under the toolbar — the plugin twin of the
 * app's FollowAlerts. Same data (unread notifications), same one-tap
 * follow back; strings ride the plugin's i18n, colours ride the token
 * set so dark mode and the game rooms invert the cards for free.
 */
export default function FollowAlerts({ alerts, followingIds, onFollowBack, onDismiss }: Props) {
  const { t } = useT()
  const [busy, setBusy] = useState<Set<string>>(new Set())
  if (alerts.length === 0) return null

  const followBack = async (alert: FollowAlert) => {
    if (busy.has(alert.id)) return
    setBusy((prev) => new Set([...prev, alert.id]))
    try {
      await onFollowBack(alert.actorId)
      onDismiss(alert.id)
    } catch (err) {
      console.error('[followBack]', err)
    } finally {
      setBusy((prev) => { const n = new Set(prev); n.delete(alert.id); return n })
    }
  }

  // The sentence is a template ('{name} follows you' / '{name}님이
  // 팔로우했어요') so languages place the name where their grammar
  // wants it; the name itself renders in the serif voice.
  const [pre, post] = t('notif.followsYou').split('{name}')

  return (
    <div className="fnotif-stack">
      {alerts.slice(0, VISIBLE).map((a) => {
        const name = a.actor?.display_name || '?'
        const mutual = followingIds.has(a.actorId)
        return (
          <div className="fnotif" key={a.id}>
            <span className="fnotif-orb" style={{ background: a.actor?.avatar_color || 'var(--blue)' }}>
              {a.actor?.avatar_url
                ? <img src={a.actor.avatar_url} alt="" />
                : (a.actor?.initials || '?')}
            </span>
            <span className="fnotif-text">
              {pre}<span className="fnotif-name">{name}</span>{post}
            </span>
            {mutual ? (
              <span className="fnotif-mutual">{t('notif.mutual')}</span>
            ) : (
              <button
                className="fnotif-back"
                disabled={busy.has(a.id)}
                onClick={() => followBack(a)}
              >
                {t('notif.followBack')}
              </button>
            )}
            <button className="fnotif-x" onClick={() => onDismiss(a.id)} aria-label={t('common.close')}>
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M1 1l8 8M9 1L1 9" /></svg>
            </button>
          </div>
        )
      })}
      {alerts.length > VISIBLE && (
        <div className="fnotif-more">+{alerts.length - VISIBLE}</div>
      )}
    </div>
  )
}
