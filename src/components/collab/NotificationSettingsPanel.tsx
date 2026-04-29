import { useState } from 'react'
import FloatingOrbs from '../FloatingOrbs'

export interface NotifSettings {
  follow: boolean
  message: boolean
}

export function readNotifSettings(): NotifSettings {
  try {
    const raw = localStorage.getItem('coop_notif_settings')
    return raw ? (JSON.parse(raw) as NotifSettings) : { follow: true, message: true }
  } catch {
    return { follow: true, message: true }
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
      </div>
    </div>
  )
}
