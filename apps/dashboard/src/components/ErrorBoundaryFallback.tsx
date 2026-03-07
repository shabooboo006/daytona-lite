/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Dialog, DialogHeader, DialogDescription, DialogTitle, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FallbackProps } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'

export function ErrorBoundaryFallback({ error, resetErrorBoundary }: FallbackProps) {
  const errorDetails = error instanceof Error ? error : null
  const { t } = useTranslation()

  return (
    <Dialog open>
      <DialogContent className="[&>button]:hidden">
        <DialogHeader>
          <DialogTitle>{t('errors.somethingWentWrong')}</DialogTitle>
          <DialogDescription>{t('errors.unexpectedError')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">{t('errors.errorDetails')}</h4>
            <p className="text-red-700 dark:text-red-300 font-mono text-sm break-all">
              {errorDetails?.message || t('errors.unknownError')}
            </p>
          </div>

          {errorDetails?.stack && (
            <details className="bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
              <summary className="cursor-pointer font-semibold text-gray-800 dark:text-gray-200">Stack Trace</summary>
              <pre className="text-xs text-gray-700 dark:text-gray-300 overflow-auto max-h-48 font-mono whitespace-pre-wrap mt-2">
                {errorDetails.stack}
              </pre>
            </details>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => window.location.reload()}>
              {t('errors.reloadPage')}
            </Button>
            <Button variant="outline" onClick={resetErrorBoundary}>
              {t('common.retry')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
