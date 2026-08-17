import FloatingOrbs from '../FloatingOrbs'
import { useT } from '../../i18n/LanguageContext'
import type { ScreenSize } from '../../lib/pluginWindow'

const SCREEN_OPTIONS: ScreenSize[] = ['small', 'large']
const FONT_OPTIONS = [
  'editorial',
  'instrument',
  'system',
  'rounded',
  'compact',
  'mono',
  'serif',
  'didot',
  'georgia',
  'avenir',
  'helvetica',
  'futura',
  'gill',
  'palatino',
  'courier',
  'menlo',
  'korean-sans',
  'korean-serif',
] as const
export type UiFont = typeof FONT_OPTIONS[number]

interface Props {
  isDark: boolean
  screenSize: ScreenSize
  uiFont: UiFont
  onToggleDark: () => void
  onScreenSizeChange: (size: ScreenSize) => void
  onFontChange: (font: UiFont) => void
  onClose: () => void
}

export default function DisplayPanel({ isDark, screenSize, uiFont, onToggleDark, onScreenSizeChange, onFontChange, onClose }: Props) {
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

        <div className="settings-card display-font-card">
          <span className="display-size-label">{t('display.font')}</span>
          <select
            className="display-font-select"
            value={uiFont}
            onChange={(event) => onFontChange(event.target.value as UiFont)}
          >
            {FONT_OPTIONS.map((font) => (
              <option
                key={font}
                value={font}
              >
                {t(`display.font.${font}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
