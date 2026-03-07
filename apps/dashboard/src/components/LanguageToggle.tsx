import { useI18n } from '@/i18n/useI18n'
import { Languages } from 'lucide-react'
import { Button } from './ui/button'
import { SidebarMenuButton } from './ui/sidebar'

interface LanguageToggleProps {
  compact?: boolean
  className?: string
  sidebarStyle?: boolean
}

export function LanguageToggle({ compact = false, className, sidebarStyle = false }: LanguageToggleProps) {
  const { language, toggleLanguage, t } = useI18n()
  const currentLanguageLabel = language === 'zh-CN' ? t('common.chinese') : t('common.english')
  const content = (
    <>
      <Languages className="size-4" />
      {!compact && (
        <span>
          {t('common.language')}: {currentLanguageLabel}
        </span>
      )}
    </>
  )

  if (sidebarStyle) {
    return (
      <SidebarMenuButton
        className={className}
        title={t('common.languageToggle')}
        tooltip={t('common.languageToggle')}
        onClick={() => void toggleLanguage()}
      >
        {content}
      </SidebarMenuButton>
    )
  }

  return (
    <Button
      variant="ghost"
      className={className}
      title={t('common.languageToggle')}
      aria-label={t('common.languageToggle')}
      onClick={() => void toggleLanguage()}
    >
      {content}
    </Button>
  )
}
