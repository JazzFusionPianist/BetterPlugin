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
  t: (key: TKey) => string
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

  const t = useCallback((key: TKey) => lookup(key, lang), [lang])

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
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
