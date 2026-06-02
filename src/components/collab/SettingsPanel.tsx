import FloatingOrbs from '../FloatingOrbs'
import { useT } from '../../i18n/LanguageContext'

interface Props {
  onClose: () => void
  onOpenDisplay: () => void
  onOpenInfo: () => void
  onOpenNotifSettings: () => void
  onOpenLanguage: () => void
  onOpenFindPeople: () => void
  onSignOut: () => void
}

export default function SettingsPanel({
  onClose: _onClose,
  onOpenDisplay,
  onOpenInfo,
  onOpenNotifSettings,
  onOpenLanguage,
  onOpenFindPeople,
  onSignOut,
}: Props) {
  const { tWithEn } = useT()
  return (
    <div className="settings-panel">
      <FloatingOrbs count={28} />
      <div className="settings-list">
        <div className="settings-card" onClick={onOpenFindPeople} role="button" tabIndex={0}>
          {tWithEn('settings.findPeople')}
        </div>
        <div className="settings-card" onClick={onOpenDisplay} role="button" tabIndex={0}>
          {tWithEn('settings.display')}
        </div>
        <div className="settings-card" onClick={onOpenInfo} role="button" tabIndex={0}>
          {tWithEn('settings.userInfo')}
        </div>
        <div className="settings-card" onClick={onOpenNotifSettings} role="button" tabIndex={0}>
          {tWithEn('settings.notifications')}
        </div>
        <div className="settings-card" onClick={onOpenLanguage} role="button" tabIndex={0}>
          {tWithEn('settings.language')}
        </div>
      </div>
      <div className="settings-list settings-list-bottom">
        <div className="settings-card settings-signout" onClick={onSignOut} role="button" tabIndex={0}>
          {tWithEn('settings.signOut')}
        </div>
      </div>
    </div>
  )
}
