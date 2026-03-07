import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { LocalStorageKey } from '@/enums/LocalStorageKey'
import { getLocalStorageItem, setLocalStorageItem } from '@/lib/local-storage'
import { resources } from './resources'
import { DEFAULT_UI_LANGUAGE, SUPPORTED_UI_LANGUAGES, type UILanguage } from './types'

export function normalizeUILanguage(language?: string | null): UILanguage {
  if (!language) {
    return DEFAULT_UI_LANGUAGE
  }

  if (SUPPORTED_UI_LANGUAGES.includes(language as UILanguage)) {
    return language as UILanguage
  }

  if (language.toLowerCase().startsWith('zh')) {
    return 'zh-CN'
  }

  return 'en'
}

export function getStoredUILanguage(): UILanguage {
  return normalizeUILanguage(getLocalStorageItem(LocalStorageKey.UiLanguage))
}

export function persistUILanguage(language: UILanguage) {
  setLocalStorageItem(LocalStorageKey.UiLanguage, language)
  document.documentElement.lang = language
}

export function getIntlLocale(language = i18n.resolvedLanguage): string {
  return normalizeUILanguage(language)
}

const initialLanguage = getStoredUILanguage()

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: 'en',
  supportedLngs: SUPPORTED_UI_LANGUAGES,
  interpolation: {
    escapeValue: false,
  },
})

persistUILanguage(initialLanguage)

export default i18n
