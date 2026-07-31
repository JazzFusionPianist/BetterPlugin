import FloatingOrbs from '../FloatingOrbs'
import { useT } from '../../i18n/LanguageContext'
import { LANG_META, type Lang } from '../../i18n/types'

interface Props {
  onClose: () => void
}

export default function LanguagePanel ({ onClose }: Props) {
  const { lang, setLang, t } = useT()

  const pick = (code: Lang) => {
    setLang(code)
    // Stay on the panel so the user can immediately see the localised
    // titles & confirm the change — they back out via the header.
  }

  return (
    <div className="settings-panel">
      <FloatingOrbs count={28} />

      <div
        className="settings-card settings-header-card"
        onClick={onClose}
        role="button"
        tabIndex={0}
      >
        <span className="settings-header-back">‹</span>
        <span className="settings-header-title">{t('language.title')}</span>
      </div>

      <div className="info-stack">
        {LANG_META.map(meta => {
          const active = meta.code === lang
          return (
            <div
              key={meta.code}
              className={`settings-card language-row${active ? ' active' : ''}`}
              onClick={() => pick(meta.code)}
              role="button"
              tabIndex={0}
            >
              <div className="language-row-info">
                <span className="language-row-native">{meta.nativeName}</span>
              </div>
              {active && <span className="language-row-check">✓</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
