/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Action, toast } from 'sonner'
import { DaytonaError } from '@/api/errors'
import i18n from '@/i18n/init'

export function handleApiError(error: unknown, message: string, toastAction?: React.ReactNode | Action) {
  const isDaytonaError = error instanceof DaytonaError

  toast.error(message, {
    description: isDaytonaError ? error.message : i18n.t('common.tryAgainOrCheckConsole'),
    action: toastAction,
  })

  if (!isDaytonaError) {
    console.error(message, error)
  }
}
