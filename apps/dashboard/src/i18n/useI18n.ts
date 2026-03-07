import { useTranslation } from 'react-i18next'
import { persistUILanguage, normalizeUILanguage } from './init'
import type { UILanguage } from './types'

export function useI18n() {
  const { t, i18n } = useTranslation()
  const language = normalizeUILanguage(i18n.resolvedLanguage)

  const setLanguage = async (nextLanguage: UILanguage) => {
    await i18n.changeLanguage(nextLanguage)
    persistUILanguage(nextLanguage)
  }

  const toggleLanguage = async () => {
    await setLanguage(language === 'zh-CN' ? 'en' : 'zh-CN')
  }

  return {
    t,
    i18n,
    language,
    setLanguage,
    toggleLanguage,
  }
}
