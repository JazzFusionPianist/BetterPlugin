import { useState } from 'react'

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
    <>
      <div className="s-header">
        <div className="s-close" onClick={onClose}>&#8249;</div>
        <span className="s-title">NOTIFICATIONS</span>
      </div>

      <div className="s-body" style={{ paddingTop: 0, paddingLeft: 0, paddingRight: 0 }}>
        <div className="s-section" style={{ marginBottom: 0 }}>

          <div className="s-nav-row notif-setting-row">
            <div className="notif-setting-info">
              <span className="s-row-label">New invite</span>
              <span className="notif-setting-desc">When someone invites you</span>
            </div>
            <button
              className={`notif-toggle${settings.follow ? ' on' : ''}`}
              onClick={() => toggle('follow')}
              aria-label="Toggle invite notifications"
            />
          </div>

          <div className="s-nav-row notif-setting-row">
            <div className="notif-setting-info">
              <span className="s-row-label">New message</span>
              <span className="notif-setting-desc">When someone sends you a chat</span>
            </div>
            <button
              className={`notif-toggle${settings.message ? ' on' : ''}`}
              onClick={() => toggle('message')}
              aria-label="Toggle message notifications"
            />
          </div>

        </div>
      </div>
    </>
  )
}
