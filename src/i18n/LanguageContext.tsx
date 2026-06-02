import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { DEFAULT_LANG, type Lang } from './types'
import { lookup, type TKey } from './translations'

const STORAGE_KEY = 'coop_lang'

/**
 * Language preference is stored in localStorage. We read it once on mount;
 * other tabs (if any) would not auto-sync but the plugin only has one
 * WebView so that's fine.
 */
function readStoredLang (): Lang {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'en' || raw === 'ko' || raw === 'ja' || raw === 'zh'
        || raw === 'es' || raw === 'de' || raw === 'fr' || raw === 'hi') {
      return raw
    }
  } catch {/* localStorage unavailable */}
  return DEFAULT_LANG
}

interface LanguageContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  /** `t('key')` or `t('key', { name: 'Alice' })`. `{placeholder}` tokens
   *  in the dictionary string are replaced by the corresponding param. */
  t: (key: TKey, params?: Record<string, string | number>) => string
  /** Localised label with the English form in parentheses when the
   *  active language isn't English — e.g. "언어 (Language)". In English
   *  mode this collapses to just the English string. Used for the
   *  Settings menu so a user who switched to a non-English language can
   *  still recognise the original control name. */
  tWithEn: (key: TKey) => string
}

/** Apply `{name}` style interpolation. Plain string replace — no escape
 *  syntax — because translations are author-controlled, not user input. */
function interpolate (template: string, params: Record<string, string | number>): string {
  let out = template
  for (const [k, v] of Object.entries(params)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
  }
  return out
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider ({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => readStoredLang())

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch {/* ignore */}
  }, [])

  // Reflect on <html lang="..."> so the WebView / accessibility tooling
  // gets the right hint (helps Safari hyphenation, screen readers, etc.).
  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = lang
  }, [lang])

  const t = useCallback((key: TKey, params?: Record<string, string | number>) => {
    const raw = lookup(key, lang)
    return params ? interpolate(raw, params) : raw
  }, [lang])
  const tWithEn = useCallback((key: TKey) => {
    const localised = lookup(key, lang)
    const english   = lookup(key, 'en')
    if (lang === 'en' || localised === english) return english
    return `${localised} (${english})`
  }, [lang])

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, tWithEn }}>
      {children}
    </LanguageContext.Provider>
  )
}

/**
 * useT — primary i18n hook. Returns a (key) => string translator that
 * re-renders consumers when the language changes. Throws if used outside
 * the LanguageProvider — that's a programming error.
 */
export function useT () {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useT must be used inside <LanguageProvider>')
  return ctx
}
