/**
 * Supported UI languages. Keep this list in sync with LANG_META below
 * and with the translation dictionaries in translations.ts.
 *
 * English is the source language — every key is guaranteed to have an
 * 'en' value. Other languages may be partial; missing entries fall
 * back to English at lookup time (see useT()).
 */
export type Lang =
  | 'en'
  | 'ko'
  | 'ja'
  | 'zh'
  | 'es'
  | 'de'
  | 'fr'
  | 'hi'

export interface LangMeta {
  code: Lang
  /** Display name in the language itself (e.g. "한국어" not "Korean"). */
  nativeName: string
  /** Display name in English, for accessibility & search. */
  englishName: string
}

export const LANG_META: LangMeta[] = [
  { code: 'en', nativeName: 'English',     englishName: 'English' },
  { code: 'ko', nativeName: '한국어',       englishName: 'Korean' },
  { code: 'ja', nativeName: '日本語',       englishName: 'Japanese' },
  { code: 'zh', nativeName: '中文 (简体)',  englishName: 'Chinese (Simplified)' },
  { code: 'es', nativeName: 'Español',     englishName: 'Spanish' },
  { code: 'de', nativeName: 'Deutsch',     englishName: 'German' },
  { code: 'fr', nativeName: 'Français',    englishName: 'French' },
  { code: 'hi', nativeName: 'हिन्दी',        englishName: 'Hindi' },
]

export const DEFAULT_LANG: Lang = 'en'
