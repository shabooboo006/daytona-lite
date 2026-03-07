/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: AGPL-3.0
 */

import LoadingFallback from '@/components/LoadingFallback'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RoutePath } from '@/enums/RoutePath'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/i18n/useI18n'
import React, { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { StandaloneLanguageToggle } from '@/components/StandaloneLanguageToggle'

const apiUrl = (import.meta.env.VITE_BASE_API_URL ?? window.location.origin) + '/api'

const LandingPage: React.FC = () => {
  const { login, isAuthenticated, isLoading } = useAuth()
  const location = useLocation()
  const { t } = useI18n()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (isLoading) {
    return <LoadingFallback />
  }

  const state = location.state as { returnTo?: string } | null
  const returnTo = state?.returnTo || `${RoutePath.DASHBOARD}${location.search}`

  if (isAuthenticated) {
    return <Navigate to={returnTo} replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`${apiUrl}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        setError(t('landing.invalidPassword'))
        return
      }
      const data = await res.json()
      const accessToken = data.token ?? data.access_token
      if (!accessToken) {
        setError(t('landing.missingToken'))
        return
      }
      login(accessToken)
    } catch {
      setError(t('landing.networkError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <StandaloneLanguageToggle />
      <div className="w-full max-w-sm space-y-6 p-8 border border-border rounded-lg shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Daytona Lite</h1>
          <p className="text-sm text-muted-foreground">{t('landing.subtitle')}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">{t('landing.password')}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('landing.passwordPlaceholder')}
              required
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? t('landing.signingIn') : t('common.signIn')}
          </Button>
        </form>
      </div>
    </div>
  )
}

export default LandingPage
