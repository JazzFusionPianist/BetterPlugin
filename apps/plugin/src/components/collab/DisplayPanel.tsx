import FloatingOrbs from '../FloatingOrbs'
import { useT } from '../../i18n/LanguageContext'

interface Props {
  isDark: boolean
  onToggleDark: () => void
  onClose: () => void
}

export default function DisplayPanel({ isDark, onToggleDark, onClose }: Props) {
  const { t } = useT()

  return (
    <div className="settings-panel">
      <FloatingOrbs count={28} />

      <div className="settings-card settings-header-card" onClick={onClose} role="button" tabIndex={0}>
        <span className="settings-header-back">‹</span>
        <span className="settings-header-title">{t('settings.display')}</span>
      </div>

      <div className="display-stack">
        <div className="settings-card settings-row-card" onClick={onToggleDark} role="button" tabIndex={0}>
          <span>{t('display.darkMode')}</span>
          <button
            className={`pill-toggle${isDark ? ' on' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleDark() }}
            tabIndex={-1}
          />
        </div>
      </div>
    </div>
  )
}
