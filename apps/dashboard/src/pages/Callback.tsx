/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { StandaloneLanguageToggle } from '@/components/StandaloneLanguageToggle'

const Callback = () => {
  const { isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/')
    }
  }, [isLoading, isAuthenticated, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <StandaloneLanguageToggle />
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">{t('callback.completingAuth')}</p>
      </div>
    </div>
  )
}

export default Callback
