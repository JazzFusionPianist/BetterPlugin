import { useState } from 'react'
import FloatingOrbs from '../FloatingOrbs'

export interface NotifSettings {
  follow: boolean
  message: boolean
  /** Play a short chime when it becomes your turn in chess / poker,
   *  even while the plugin window is closed. */
  gameTurn: boolean
}

const DEFAULT_NOTIF_SETTINGS: NotifSettings = {
  follow: true,
  message: true,
  gameTurn: true,
}

export function readNotifSettings(): NotifSettings {
  try {
    const raw = localStorage.getItem('coop_notif_settings')
    if (!raw) return { ...DEFAULT_NOTIF_SETTINGS }
    // Merge over defaults so newly-introduced keys (e.g. gameTurn) have
    // a sensible value for users with old localStorage entries.
    return { ...DEFAULT_NOTIF_SETTINGS, ...(JSON.parse(raw) as Partial<NotifSettings>) }
  } catch {
    return { ...DEFAULT_NOTIF_SETTINGS }
  }
}

interface Props {
  onClose: () => void
  onSettingsChange: (s: NotifSettings) => void
}

export default function NotificationSettingsPanel({ onClose, onSettingsChange }: Props) {
  const [settings, setSettings] = useState<NotifSettings>(readNotifSettings)

  const toggle = (key: keyof NotifSettings) => {
    setSettings(prev => {
      const next = { ...prev, [key]: !prev[key] }
      localStorage.setItem('coop_notif_settings', JSON.stringify(next))
      onSettingsChange(next)
      return next
    })
  }

  return (
    <div className="settings-panel">
      <FloatingOrbs count={28} />

      <div className="settings-card settings-header-card" onClick={onClose} role="button" tabIndex={0}>
        <span className="settings-header-back">‹</span>
        <span className="settings-header-title">Notifications</span>
      </div>

      <div className="info-stack">
        <div
          className="settings-card notif-setting-card"
          onClick={() => toggle('follow')}
          role="button"
          tabIndex={0}
        >
          <div className="notif-setting-info">
            <span className="notif-setting-name">New follower</span>
            <span className="notif-setting-desc">When someone follows you</span>
          </div>
          <button
            className={`pill-toggle${settings.follow ? ' on' : ''}`}
            onClick={(e) => { e.stopPropagation(); toggle('follow') }}
            tabIndex={-1}
          />
        </div>

        <div
          className="settings-card notif-setting-card"
          onClick={() => toggle('message')}
          role="button"
          tabIndex={0}
        >
          <div className="notif-setting-info">
            <span className="notif-setting-name">New message</span>
            <span className="notif-setting-desc">When someone sends you a chat</span>
          </div>
          <button
            className={`pill-toggle${settings.message ? ' on' : ''}`}
            onClick={(e) => { e.stopPropagation(); toggle('message') }}
            tabIndex={-1}
          />
        </div>

        <div
          className="settings-card notif-setting-card"
          onClick={() => toggle('gameTurn')}
          role="button"
          tabIndex={0}
        >
          <div className="notif-setting-info">
            <span className="notif-setting-name">Your turn (games)</span>
            <span className="notif-setting-desc">Chime when it's your move in chess or poker</span>
          </div>
          <button
            className={`pill-toggle${settings.gameTurn ? ' on' : ''}`}
            onClick={(e) => { e.stopPropagation(); toggle('gameTurn') }}
            tabIndex={-1}
          />
        </div>
      </div>
    </div>
  )
}
