import { LanguageToggle } from './LanguageToggle'

export function StandaloneLanguageToggle() {
  return (
    <div className="fixed right-4 top-4 z-50">
      <LanguageToggle className="border border-border bg-background/95 shadow-sm backdrop-blur" />
    </div>
  )
}
