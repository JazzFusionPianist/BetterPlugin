import FloatingOrbs from '../FloatingOrbs'
import { useT } from '../../i18n/LanguageContext'
import type { ScreenSize } from '../../lib/pluginWindow'

const SCREEN_OPTIONS: ScreenSize[] = ['small', 'medium', 'large']

interface Props {
  isDark: boolean
  screenSize: ScreenSize
  onToggleDark: () => void
  onScreenSizeChange: (size: ScreenSize) => void
  onClose: () => void
}

export default function DisplayPanel({ isDark, screenSize, onToggleDark, onScreenSizeChange, onClose }: Props) {
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

        <div className="settings-card display-size-card">
          <span className="display-size-label">{t('display.screenSize')}</span>
          <div className="seg">
            {SCREEN_OPTIONS.map((size) => (
              <button
                key={size}
                className={`seg-opt${screenSize === size ? ' active' : ''}`}
                onClick={() => onScreenSizeChange(size)}
              >
                {t(`display.size.${size}`)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
