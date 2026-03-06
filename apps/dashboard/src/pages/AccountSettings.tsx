/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: AGPL-3.0
 */

import { PageContent, PageHeader, PageLayout, PageTitle } from '@/components/PageLayout'
import { Card, CardContent } from '@/components/ui/card'
import React from 'react'

const AccountSettings: React.FC = () => {
  return (
    <PageLayout>
      <PageHeader>
        <PageTitle>Account Settings</PageTitle>
      </PageHeader>

      <PageContent>
        <div className="flex flex-col gap-6">
          <Card>
            <CardContent>
              <div className="text-sm">
                <div className="text-sm">
                  <div className="text-muted-foreground">
                    <p className="font-semibold text-foreground">No Additional Account Settings</p>
                    This private deployment enables the available product telemetry by default and does not require
                    end-user privacy consent prompts.
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
