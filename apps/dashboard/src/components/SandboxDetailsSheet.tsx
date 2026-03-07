/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { translateLiteralText } from '@/i18n/literalTranslations'
import { formatDuration, formatTimestamp, getRelativeTimeString } from '@/lib/utils'
import { Sandbox, SandboxState } from '@daytonaio/api-client'
import { Archive, Play, Tag, Trash, Wrench, X } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { CopyButton } from './CopyButton'
import { ResourceChip } from './ResourceChip'
import { SandboxState as SandboxStateComponent } from './SandboxTable/SandboxState'
import { TimestampTooltip } from './TimestampTooltip'

interface SandboxDetailsSheetProps {
  sandbox: Sandbox | null
  open: boolean
  onOpenChange: (open: boolean) => void
  sandboxIsLoading: Record<string, boolean>
  handleStart: (id: string) => void
  handleStop: (id: string) => void
  handleDelete: (id: string) => void
  handleArchive: (id: string) => void
  getWebTerminalUrl: (id: string) => Promise<string | null>
  getRegionName: (regionId: string) => string | undefined
  writePermitted: boolean
  deletePermitted: boolean
  handleRecover: (id: string) => void
}

const SandboxDetailsSheet: React.FC<SandboxDetailsSheetProps> = ({
  sandbox,
  open,
  onOpenChange,
  sandboxIsLoading,
  handleStart,
  handleStop,
  handleDelete,
  handleArchive,
  getWebTerminalUrl,
  getRegionName,
  writePermitted,
  deletePermitted,
  handleRecover,
}) => {
  const { t } = useTranslation()
  void getWebTerminalUrl

  if (!sandbox) return null

  const getLastEvent = (sandbox: Sandbox): { date: Date; relativeTimeString: string } => {
    return getRelativeTimeString(sandbox.updatedAt)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-dvw sm:w-[800px] p-0 flex flex-col gap-0 [&>button]:hidden">
        <SheetHeader className="space-y-0 flex flex-row justify-between items-center  p-4 px-5 border-b border-border">
          <SheetTitle className="text-2xl font-medium">{t('sandboxesModule.details.title')}</SheetTitle>
          <div className="flex gap-2 items-center">
            {writePermitted && (
              <>
                {sandbox.state === SandboxState.STARTED && (
                  <Button
                    variant="outline"
                    onClick={() => handleStop(sandbox.id)}
                    disabled={sandboxIsLoading[sandbox.id]}
                  >
                    {t('sandboxesModule.actions.stop')}
                  </Button>
                )}
                {(sandbox.state === SandboxState.STOPPED || sandbox.state === SandboxState.ARCHIVED) &&
                  !sandbox.recoverable && (
                    <Button
                      variant="outline"
                      onClick={() => handleStart(sandbox.id)}
                      disabled={sandboxIsLoading[sandbox.id]}
                    >
                      <Play className="w-4 h-4" />
                      {t('sandboxesModule.actions.start')}
                    </Button>
                  )}
                {sandbox.state === SandboxState.ERROR && sandbox.recoverable && (
                  <Button
                    variant="outline"
                    onClick={() => handleRecover(sandbox.id)}
                    disabled={sandboxIsLoading[sandbox.id]}
                  >
                    <Wrench className="w-4 h-4" />
                    {t('sandboxesModule.actions.recover')}
                  </Button>
                )}
                {/* {(sandbox.state === SandboxState.STOPPED || sandbox.state === SandboxState.ARCHIVED) && (
                  <Button
                    variant="outline"
                    onClick={() => handleFork(sandbox.id)}
                    disabled={sandboxIsLoading[sandbox.id]}
                  >
                    <GitFork className="w-4 h-4" />
                    Fork
                  </Button>
                )}
                {(sandbox.state === SandboxState.STOPPED || sandbox.state === SandboxState.ARCHIVED) && (
                  <Button
                    variant="outline"
                    onClick={() => handleSnapshot(sandbox.id)}
                    disabled={sandboxIsLoading[sandbox.id]}
                  >
                    <Camera className="w-4 h-4" />
                    Snapshot
                  </Button>
                )} */}
                {sandbox.state === SandboxState.STOPPED && (
                  <Button
                    variant="outline"
                    className="w-8 h-8"
                    onClick={() => handleArchive(sandbox.id)}
                    disabled={sandboxIsLoading[sandbox.id]}
                  >
                    <Archive className="w-4 h-4" />
                  </Button>
                )}
              </>
            )}
            {deletePermitted && (
              <Button
                variant="outline"
                className="w-8 h-8"
                onClick={() => handleDelete(sandbox.id)}
                disabled={sandboxIsLoading[sandbox.id]}
              >
                <Trash className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="outline"
              className="w-8 h-8"
              onClick={() => onOpenChange(false)}
              disabled={sandboxIsLoading[sandbox.id]}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </SheetHeader>

        <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
          <TabsContent value="overview" className="flex-1 p-6 space-y-10 overflow-y-auto min-h-0">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm text-muted-foreground">{t('sandboxesModule.headers.name')}</h3>
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{sandbox.name}</p>
                  <CopyButton
                    value={sandbox.name}
                    tooltipText={`${t('common.copy')} ${t('sandboxesModule.headers.name')}`}
                    size="icon-xs"
                  />
                </div>
              </div>
              <div>
                <h3 className="text-sm text-muted-foreground">{t('sandboxesModule.headers.uuid')}</h3>
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{sandbox.id}</p>
                  <CopyButton
                    value={sandbox.id}
                    tooltipText={`${t('common.copy')} ${t('sandboxesModule.headers.uuid')}`}
                    size="icon-xs"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <h3 className="text-sm text-muted-foreground">{t('sandboxesModule.headers.state')}</h3>
                <div className="mt-1 text-sm">
                  <SandboxStateComponent
                    state={sandbox.state}
                    errorReason={sandbox.errorReason}
                    recoverable={sandbox.recoverable}
                  />
                </div>
              </div>
              <div>
                <h3 className="text-sm text-muted-foreground">{t('sandboxesModule.headers.snapshot')}</h3>
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{sandbox.snapshot || '-'}</p>
                  {sandbox.snapshot && (
                    <CopyButton
                      value={sandbox.snapshot}
                      tooltipText={`${t('common.copy')} ${t('sandboxesModule.headers.snapshot')}`}
                      size="icon-xs"
                    />
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-sm text-muted-foreground">{t('sandboxesModule.headers.region')}</h3>
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{getRegionName(sandbox.target) ?? sandbox.target}</p>
                  <CopyButton
                    value={sandbox.target}
                    tooltipText={`${t('common.copy')} ${t('sandboxesModule.headers.region')}`}
                    size="icon-xs"
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <h3 className="text-sm text-muted-foreground">{t('sandboxesModule.headers.lastEvent')}</h3>
                <p className="mt-1 text-sm font-medium">
                  <TimestampTooltip timestamp={sandbox.updatedAt}>
                    {getLastEvent(sandbox).relativeTimeString}
                  </TimestampTooltip>
                </p>
              </div>
              <div>
                <h3 className="text-sm text-muted-foreground">{translateLiteralText('Created at')}</h3>
                <p className="mt-1 text-sm font-medium">
                  <TimestampTooltip timestamp={sandbox.createdAt}>
                    {formatTimestamp(sandbox.createdAt)}
                  </TimestampTooltip>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <h3 className="text-sm text-muted-foreground">{translateLiteralText('Auto-stop')}</h3>
                <p className="mt-1 text-sm font-medium">
                  {sandbox.autoStopInterval ? formatDuration(sandbox.autoStopInterval) : t('common.disabled')}
                </p>
              </div>
              <div>
                <h3 className="text-sm text-muted-foreground">{translateLiteralText('Auto-archive')}</h3>
                <p className="mt-1 text-sm font-medium">
                  {sandbox.autoArchiveInterval ? formatDuration(sandbox.autoArchiveInterval) : t('common.disabled')}
                </p>
              </div>
              <div>
                <h3 className="text-sm text-muted-foreground">{translateLiteralText('Auto-delete')}</h3>
                <p className="mt-1 text-sm font-medium">
                  {sandbox.autoDeleteInterval !== undefined && sandbox.autoDeleteInterval >= 0
                    ? sandbox.autoDeleteInterval === 0
                      ? t('sandboxesModule.details.onStop')
                      : formatDuration(sandbox.autoDeleteInterval)
                    : t('common.disabled')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1">
              <div>
                <h3 className="text-sm text-muted-foreground">{t('sandboxesModule.headers.resources')}</h3>
                <div className="mt-1 text-sm font-medium flex items-center gap-1 flex-wrap">
                  <ResourceChip resource="cpu" value={sandbox.cpu} />
                  <ResourceChip resource="memory" value={sandbox.memory} />
                  <ResourceChip resource="disk" value={sandbox.disk} />
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-medium">{t('sandboxesModule.headers.labels')}</h3>
              <div className="mt-3 space-y-4">
                {Object.entries(sandbox.labels ?? {}).length > 0 ? (
                  Object.entries(sandbox.labels ?? {}).map(([key, value]) => (
                    <div key={key} className="text-sm">
                      <div>{key}</div>
                      <div className="font-medium p-2 bg-muted rounded-md mt-1 border border-border">{value}</div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col border border-border rounded-md items-center justify-center gap-2 text-muted-foreground w-full min-h-40">
                    <Tag className="w-4 h-4" />
                    <span className="text-sm">{t('sandboxesModule.details.noLabels')}</span>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}

export default SandboxDetailsSheet
