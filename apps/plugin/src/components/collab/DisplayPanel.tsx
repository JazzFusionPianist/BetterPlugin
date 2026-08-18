import { useEffect, useMemo, useRef, useState } from 'react'
import FloatingOrbs from '../FloatingOrbs'
import { useT } from '../../i18n/LanguageContext'
import type { ScreenSize } from '../../lib/pluginWindow'
import { WEB_UI_FONT_OPTIONS, UI_FONT_SIZE_OPTIONS, getLocalFontFamily, isWebUiFont, type UiFont, type UiFontSize } from '../../lib/uiFonts'
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
  uiFontSize: UiFontSize
  onToggleDark: () => void
  onScreenSizeChange: (size: ScreenSize) => void
  onFontChange: (font: UiFont) => void
  onFontSizeChange: (size: UiFontSize) => void
  onClose: () => void
}

export default function DisplayPanel({ isDark, screenSize, uiFont, uiFontSize, onToggleDark, onScreenSizeChange, onFontChange, onFontSizeChange, onClose }: Props) {
  const { t } = useT()
  const [localFonts, setLocalFonts] = useState<string[]>([])
  const [fontMenuOpen, setFontMenuOpen] = useState(false)
  const fontPickerRef = useRef<HTMLDivElement>(null)

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
  const selectedFontLabel = selectedLocalFont ?? (isWebUiFont(uiFont) ? t(`display.font.${uiFont}`) : uiFont)

  useEffect(() => {
    if (!fontMenuOpen) return
    const close = (event: MouseEvent) => {
      if (!fontPickerRef.current?.contains(event.target as Node)) setFontMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [fontMenuOpen])

  const selectFont = (font: UiFont) => {
    onFontChange(font)
    setFontMenuOpen(false)
  }

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
          <div className="display-font-picker" ref={fontPickerRef}>
            <button
              className="display-font-select"
              type="button"
              aria-haspopup="listbox"
              aria-expanded={fontMenuOpen}
              onClick={() => setFontMenuOpen(open => !open)}
            >
              <span>{selectedFontLabel}</span>
              <span className="display-font-chevron">⌄</span>
            </button>
            {fontMenuOpen && (
              <div className="display-font-menu" role="listbox" aria-label={t('display.font')}>
                <div className="display-font-group">{t('display.font.group.default')}</div>
                {WEB_UI_FONT_OPTIONS.map((font) => (
                  <button
                    key={font}
                    className={`display-font-option${uiFont === font ? ' active' : ''}`}
                    type="button"
                    role="option"
                    aria-selected={uiFont === font}
                    onClick={() => selectFont(font)}
                  >
                    {t(`display.font.${font}`)}
                  </button>
                ))}
                {localFontOptions.length > 0 && (
                  <>
                    <div className="display-font-group">{t('display.font.group.local')}</div>
                    {localFontOptions.map((font) => {
                      const value = `local:${font}` as UiFont
                      return (
                        <button
                          key={font}
                          className={`display-font-option${uiFont === value ? ' active' : ''}`}
                          type="button"
                          role="option"
                          aria-selected={uiFont === value}
                          onClick={() => selectFont(value)}
                        >
                          {font}
                        </button>
                      )
                    })}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="settings-card display-size-card">
          <span className="display-size-label">{t('display.fontSize')}</span>
          <div className="seg">
            {UI_FONT_SIZE_OPTIONS.map((size) => (
              <button
                key={size}
                className={`seg-opt${uiFontSize === size ? ' active' : ''}`}
                onClick={() => onFontSizeChange(size)}
              >
                {t(`display.fontSize.${size}`)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
