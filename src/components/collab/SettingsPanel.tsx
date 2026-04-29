import FloatingOrbs from '../FloatingOrbs'

interface Props {
  onClose: () => void
  onOpenDisplay: () => void
  onOpenInfo: () => void
  onOpenNotifSettings: () => void
  onOpenFindPeople: () => void
  onSignOut: () => void
}

export default function SettingsPanel({ onClose: _onClose, onOpenDisplay, onOpenInfo, onOpenNotifSettings, onOpenFindPeople, onSignOut }: Props) {
  return (
    <div className="settings-panel">
      <FloatingOrbs count={28} />
      <div className="settings-list">
        <div className="settings-card" onClick={onOpenFindPeople} role="button" tabIndex={0}>
          Find people
        </div>
        <div className="settings-card" onClick={onOpenDisplay} role="button" tabIndex={0}>
          Display
        </div>
        <div className="settings-card" onClick={onOpenInfo} role="button" tabIndex={0}>
          User info
        </div>
        <div className="settings-card" onClick={onOpenNotifSettings} role="button" tabIndex={0}>
          Notifications
        </div>
      </div>
      <div className="settings-list settings-list-bottom">
        <div className="settings-card settings-signout" onClick={onSignOut} role="button" tabIndex={0}>
          Sign out
        </div>
      </div>
    </div>
  )
}
