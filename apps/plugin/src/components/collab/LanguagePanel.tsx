import { useEffect, useState } from 'react'
import FloatingOrbs from '../FloatingOrbs'
import { useT } from '../../i18n/LanguageContext'
import { LANG_META, type Lang } from '../../i18n/types'

interface Props {
  onClose: () => void
}

// TEMP-DEBUG: live readout of the plugin root's class list plus how many
// times the settings language card was actually tapped. Diagnosing the
// language panel appearing over game-invite joins — REMOVE once solved.
function DebugState () {
  const [txt, setTxt] = useState('')
  useEffect(() => {
    const el = document.querySelector('.plugin')
    if (!el) return
    const left = (sel: string) => {
      const v = document.querySelector(sel)
      if (!v) return 'x'
      const cs = getComputedStyle(v)
      return `${Math.round(v.getBoundingClientRect().left)}/z${cs.zIndex}/${cs.transform === 'none' ? 'NOTF' : 'tf'}`
    }
    const read = () => {
      const centre = document.elementFromPoint(Math.round(window.innerWidth / 2), Math.round(window.innerHeight / 2))
      const topView = centre?.closest('.view')?.className.replace('view', '').trim() ?? 'none'
      setTxt(
        `top:${topView} | lng:${left('.lngview')} g:${left('.gview')} c:${left('.cview')} f:${left('.fview')} w:${window.innerWidth}` +
        ` | [${el.className.replace('plugin', '').trim() || 'no-classes'}] opens:${(window as unknown as { __langOpens?: number }).__langOpens ?? 0}`,
      )
    }
    read()
    const iv = setInterval(read, 500)
    const mo = new MutationObserver(read)
    mo.observe(el, { attributes: true, attributeFilter: ['class'] })
    return () => { clearInterval(iv); mo.disconnect() }
  }, [])
  return <div className="settings-build" style={{ wordBreak: 'break-all', padding: '6px 12px' }}>{txt}</div>
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

      <DebugState />

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
