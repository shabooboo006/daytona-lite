/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog'
import i18n from '@/i18n/init'

export enum BulkAction {
  Delete = 'delete',
  Start = 'start',
  Stop = 'stop',
  Archive = 'archive',
}

interface BulkActionData {
  title: string
  description: string
  buttonLabel: string
  buttonVariant?: 'destructive'
}

function getBulkActionData(action: BulkAction, count: number): BulkActionData {
  const countText = i18n.t('sandboxesModule.bulk.selectionTarget', { count })

  switch (action) {
    case BulkAction.Delete:
      return {
        title: i18n.t('sandboxesModule.bulk.deleteTitle'),
        description: i18n.t('sandboxesModule.bulk.deleteDescription', { target: countText }),
        buttonLabel: i18n.t('sandboxesModule.actions.delete'),
        buttonVariant: 'destructive',
      }
    case BulkAction.Start:
      return {
        title: i18n.t('sandboxesModule.bulk.startTitle'),
        description: i18n.t('sandboxesModule.bulk.startDescription', { target: countText }),
        buttonLabel: i18n.t('sandboxesModule.actions.start'),
      }
    case BulkAction.Stop:
      return {
        title: i18n.t('sandboxesModule.bulk.stopTitle'),
        description: i18n.t('sandboxesModule.bulk.stopDescription', { target: countText }),
        buttonLabel: i18n.t('sandboxesModule.actions.stop'),
      }
    case BulkAction.Archive:
      return {
        title: i18n.t('sandboxesModule.bulk.archiveTitle'),
        description: i18n.t('sandboxesModule.bulk.archiveDescription', { target: countText }),
        buttonLabel: i18n.t('sandboxesModule.actions.archive'),
      }
  }
}

interface BulkActionAlertDialogProps {
  action: BulkAction | null
  count: number
  onConfirm: () => void
  onCancel: () => void
}

export function BulkActionAlertDialog({ action, count, onConfirm, onCancel }: BulkActionAlertDialogProps) {
  const data = action ? getBulkActionData(action, count) : null

  if (!data) return null

  return (
    <AlertDialog open={action !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <>
          <AlertDialogHeader>
            <AlertDialogTitle>{data.title}</AlertDialogTitle>
            <AlertDialogDescription>{data.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirm} variant={data.buttonVariant}>
              {data.buttonLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </>
      </AlertDialogContent>
    </AlertDialog>
  )
}
