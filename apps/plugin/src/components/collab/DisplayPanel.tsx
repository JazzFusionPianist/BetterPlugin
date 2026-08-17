import { useEffect, useMemo, useState } from 'react'
import FloatingOrbs from '../FloatingOrbs'
import { useT } from '../../i18n/LanguageContext'
import type { ScreenSize } from '../../lib/pluginWindow'
import { WEB_UI_FONT_OPTIONS, getLocalFontFamily, type UiFont } from '../../lib/uiFonts'
import { callJuceNative, hasJuceBridge, hasJuceNativeFunction } from '../../lib/juceBridge'

const SCREEN_OPTIONS: ScreenSize[] = ['small', 'large']

type LocalFontEntry = { family: string }
type LocalFontWindow = Window & {
  queryLocalFonts?: () => Promise<LocalFontEntry[]>
}

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
  const [localFonts, setLocalFonts] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    const applyFamilies = (families: string[]) => {
      if (cancelled) return
      setLocalFonts([...new Set(families.filter(Boolean))].sort((a, b) => a.localeCompare(b)))
    }

    if (hasJuceBridge && hasJuceNativeFunction('listLocalFonts')) {
      callJuceNative('listLocalFonts', [], 5000)
        .then((json) => {
          const parsed = JSON.parse(json) as unknown
          applyFamilies(Array.isArray(parsed) ? parsed.filter((font): font is string => typeof font === 'string') : [])
        })
        .catch(() => applyFamilies([]))
    } else {
      const queryLocalFonts = (window as LocalFontWindow).queryLocalFonts
      if (!queryLocalFonts) return
      queryLocalFonts()
        .then((fonts) => applyFamilies(fonts.map((font) => font.family)))
        .catch(() => applyFamilies([]))
    }

    return () => { cancelled = true }
  }, [])

  const selectedLocalFont = getLocalFontFamily(uiFont)
  const localFontOptions = useMemo(() => {
    if (!selectedLocalFont || localFonts.includes(selectedLocalFont)) return localFonts
    return [selectedLocalFont, ...localFonts]
  }, [localFonts, selectedLocalFont])

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
            <optgroup label={t('display.font.group.default')}>
              {WEB_UI_FONT_OPTIONS.map((font) => (
                <option
                  key={font}
                  value={font}
                >
                  {t(`display.font.${font}`)}
                </option>
              ))}
            </optgroup>
            {localFontOptions.length > 0 && (
              <optgroup label={t('display.font.group.local')}>
                {localFontOptions.map((font) => (
                  <option
                    key={font}
                    value={`local:${font}`}
                  >
                    {font}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      </div>
    </div>
  )
}
