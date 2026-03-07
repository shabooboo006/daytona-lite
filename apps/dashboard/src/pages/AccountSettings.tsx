/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: AGPL-3.0
 */

import { PageContent, PageHeader, PageLayout, PageTitle } from '@/components/PageLayout'
import { Card, CardContent } from '@/components/ui/card'
import React from 'react'
import { useTranslation } from 'react-i18next'

const AccountSettings: React.FC = () => {
  const { t } = useTranslation()

  return (
    <PageLayout>
      <PageHeader>
        <PageTitle>{t('pages.accountSettings')}</PageTitle>
      </PageHeader>

      <PageContent>
        <div className="flex flex-col gap-6">
          <Card>
            <CardContent>
              <div className="text-sm">
                <div className="text-sm">
                  <div className="text-muted-foreground">
                    <p className="font-semibold text-foreground">{t('accountSettings.emptyTitle')}</p>
                    {t('accountSettings.emptyDescription')}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageContent>
    </PageLayout>
  )
}

export default AccountSettings
