import FloatingOrbs from '../FloatingOrbs'
import { useT } from '../../i18n/LanguageContext'
import { openExternalUrl } from '../../lib/linkify'

interface Props {
  onClose: () => void
  onOpenDisplay: () => void
  onOpenInfo: () => void
  onOpenLanguage: () => void
  onOpenFindPeople: () => void
  onSignOut: () => void
}

export default function SettingsPanel({
  onClose: _onClose,
  onOpenDisplay,
  onOpenInfo,
  onOpenLanguage,
  onOpenFindPeople,
  onSignOut,
}: Props) {
  const { t, tWithEn } = useT()
  return (
    <div className="settings-panel">
      <FloatingOrbs count={28} />
      <div className="settings-list">
        <div className="settings-card" onClick={onOpenFindPeople} role="button" tabIndex={0}>
          {t('settings.findPeople')}
        </div>
        <div className="settings-card" onClick={onOpenDisplay} role="button" tabIndex={0}>
          {t('settings.display')}
        </div>
        <div className="settings-card" onClick={onOpenInfo} role="button" tabIndex={0}>
          {t('settings.userInfo')}
        </div>
        {/* Language is the only row that shows the English form in
            parens — that lets a user who's accidentally switched into
            a language they can't read still find their way back. */}
        <div className="settings-card" onClick={onOpenLanguage} role="button" tabIndex={0}>
          {tWithEn('settings.language')}
        </div>
      </div>
      <div className="settings-list settings-list-bottom">
        <div className="settings-card settings-signout" onClick={onSignOut} role="button" tabIndex={0}>
          {t('settings.signOut')}
        </div>
        <div className="settings-legal">
          <a href="https://orb-app-liard.vercel.app/terms" onClick={e => { e.preventDefault(); void openExternalUrl('https://orb-app-liard.vercel.app/terms') }}>terms</a>
          <span>·</span>
          <a href="https://orb-app-liard.vercel.app/privacy" onClick={e => { e.preventDefault(); void openExternalUrl('https://orb-app-liard.vercel.app/privacy') }}>privacy</a>
        </div>
        {/* Which bundle is this instance actually running? Ends the
            "did the deploy reach the plugin?" guessing game. */}
        <div className="settings-build">build {__BUILD_ID__}</div>
      </div>
    </div>
  )
}
