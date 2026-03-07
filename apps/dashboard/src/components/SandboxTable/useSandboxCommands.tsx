/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BulkActionCounts } from '@/lib/utils/sandbox'
import { ArchiveIcon, CheckSquare2Icon, MinusSquareIcon, PlayIcon, SquareIcon, TrashIcon } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { CommandConfig, useRegisterCommands } from '../CommandPalette'

interface UseSandboxCommandsProps {
  writePermitted: boolean
  deletePermitted: boolean
  selectedCount: number
  selectableCount: number
  toggleAllRowsSelected: (selected: boolean) => void
  bulkActionCounts: BulkActionCounts
  onDelete: () => void
  onStart: () => void
  onStop: () => void
  onArchive: () => void
}

export function useSandboxCommands({
  writePermitted,
  deletePermitted,
  selectedCount,
  selectableCount,
  toggleAllRowsSelected,
  bulkActionCounts,
  onDelete,
  onStart,
  onStop,
  onArchive,
}: UseSandboxCommandsProps) {
  const { t } = useTranslation()
  const rootCommands: CommandConfig[] = useMemo(() => {
    const commands: CommandConfig[] = []

    if (selectableCount !== selectedCount) {
      commands.push({
        id: 'select-all-sandboxes',
        label: t('sandboxesModule.commands.selectAll'),
        icon: <CheckSquare2Icon className="w-4 h-4" />,
        onSelect: () => toggleAllRowsSelected(true),
        chainable: true,
      })
    }

    if (selectedCount > 0) {
      commands.push({
        id: 'deselect-all-sandboxes',
        label: t('sandboxesModule.commands.deselectAll'),
        icon: <MinusSquareIcon className="w-4 h-4" />,
        onSelect: () => toggleAllRowsSelected(false),
        chainable: true,
      })
    }

    if (writePermitted && bulkActionCounts.startable > 0) {
      commands.push({
        id: 'start-sandboxes',
        label: t('sandboxesModule.commands.start', { count: bulkActionCounts.startable }),
        icon: <PlayIcon className="w-4 h-4" />,
        onSelect: onStart,
      })
    }

    if (writePermitted && bulkActionCounts.stoppable > 0) {
      commands.push({
        id: 'stop-sandboxes',
        label: t('sandboxesModule.commands.stop', { count: bulkActionCounts.stoppable }),
        icon: <SquareIcon className="w-4 h-4" />,
        onSelect: onStop,
      })
    }

    if (writePermitted && bulkActionCounts.archivable > 0) {
      commands.push({
        id: 'archive-sandboxes',
        label: t('sandboxesModule.commands.archive', { count: bulkActionCounts.archivable }),
        icon: <ArchiveIcon className="w-4 h-4" />,
        onSelect: onArchive,
      })
    }

    if (deletePermitted && bulkActionCounts.deletable > 0) {
      commands.push({
        id: 'delete-sandboxes',
        label: t('sandboxesModule.commands.delete', { count: bulkActionCounts.deletable }),
        icon: <TrashIcon className="w-4 h-4" />,
        onSelect: onDelete,
      })
    }

    return commands
  }, [
    selectedCount,
    selectableCount,
    toggleAllRowsSelected,
    writePermitted,
    deletePermitted,
    bulkActionCounts,
    t,
    onDelete,
    onStart,
    onStop,
    onArchive,
  ])

  useRegisterCommands(rootCommands, {
    groupId: 'sandbox-actions',
    groupLabel: t('sandboxesModule.commands.groupLabel'),
    groupOrder: 0,
  })
}
