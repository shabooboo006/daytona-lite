/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: AGPL-3.0
 */

import { cn } from '@/lib/utils'
import {
  ArrowUpDown,
  Calendar,
  Camera,
  Check,
  Columns,
  Cpu,
  Globe,
  HardDrive,
  ListFilter,
  MemoryStick,
  RefreshCw,
  Square,
  Tag,
} from 'lucide-react'
import * as React from 'react'
import { DebouncedInput } from '../DebouncedInput'
import { TableColumnVisibilityToggle } from '../TableColumnVisibilityToggle'
import { Button } from '../ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandInputButton,
  CommandItem,
  CommandList,
} from '../ui/command'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { LabelFilter, LabelFilterIndicator } from './filters/LabelFilter'
import { LastEventFilter, LastEventFilterIndicator } from './filters/LastEventFilter'
import { RegionFilter, RegionFilterIndicator } from './filters/RegionFilter'
import { ResourceFilter, ResourceFilterIndicator, ResourceFilterValue } from './filters/ResourceFilter'
import { SnapshotFilter, SnapshotFilterIndicator } from './filters/SnapshotFilter'
import { StateFilter, StateFilterIndicator } from './filters/StateFilter'
import { SandboxTableHeaderProps } from './types'
import { useTranslation } from 'react-i18next'

export function SandboxTableHeader({
  table,
  regionOptions,
  regionsDataIsLoading,
  snapshots,
  snapshotsDataIsLoading,
  snapshotsDataHasMore,
  onChangeSnapshotSearchValue,
  onRefresh,
  isRefreshing = false,
}: SandboxTableHeaderProps) {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(false)
  const currentSort = table.getState().sorting[0]?.id || ''

  const resourceFilters = [
    { type: 'cpu' as const, label: 'CPU', icon: Cpu },
    { type: 'memory' as const, label: t('sandboxesModule.resourceLabels.memory'), icon: MemoryStick },
    { type: 'disk' as const, label: t('sandboxesModule.resourceLabels.disk'), icon: HardDrive },
  ]

  const sortableColumns = [
    { id: 'name', label: t('sandboxesModule.headers.name') },
    { id: 'state', label: t('sandboxesModule.headers.state') },
    { id: 'snapshot', label: t('sandboxesModule.headers.snapshot') },
    { id: 'region', label: t('sandboxesModule.headers.region') },
    { id: 'lastEvent', label: t('sandboxesModule.headers.lastEvent') },
  ]

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="flex flex-wrap gap-2 items-center">
        <DebouncedInput
          value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
          onChange={(value) => table.getColumn('name')?.setFilterValue(value)}
          placeholder={t('sandboxesModule.table.searchPlaceholder')}
          className="w-[240px]"
        />

        <Button variant="outline" onClick={onRefresh} disabled={isRefreshing} className="flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {t('sandboxesModule.table.refresh')}
        </Button>

        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Columns className="w-4 h-4" />
              {t('sandboxesModule.table.view')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px] p-0">
            <TableColumnVisibilityToggle
              columns={table.getAllColumns().filter((column) => ['name', 'id', 'labels'].includes(column.id))}
              getColumnLabel={(id: string) => {
                switch (id) {
                  case 'name':
                    return t('sandboxesModule.headers.name')
                  case 'id':
                    return t('sandboxesModule.headers.uuid')
                  case 'labels':
                    return t('sandboxesModule.headers.labels')
                  default:
                    return id
                }
              }}
            />
          </DropdownMenuContent>
        </DropdownMenu>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" aria-expanded={open} className="justify-between">
              {currentSort ? (
                <div className="flex items-center gap-2">
                  <div className="text-muted-foreground font-normal">
                    {t('sandboxesModule.table.sortedBy')}{' '}
                    <span className="font-medium text-primary">
                      {sortableColumns.find((column) => column.id === currentSort)?.label}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="w-4 h-4" />
                  <span>{t('sandboxesModule.table.sort')}</span>
                </div>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[240px] p-0" align="start">
            <Command>
              <CommandInput placeholder={t('sandboxesModule.table.searchColumns')}>
                <CommandInputButton
                  aria-expanded={open}
                  className="justify-between"
                  onClick={() => {
                    table.resetSorting()
                    setOpen(false)
                  }}
                >
                  {t('sandboxesModule.table.reset')}
                </CommandInputButton>
              </CommandInput>
              <CommandList>
                <CommandEmpty>{t('sandboxesModule.table.noColumnFound')}</CommandEmpty>
                <CommandGroup>
                  {sortableColumns.map((column) => (
                    <CommandItem
                      key={column.id}
                      value={column.id}
                      onSelect={(currentValue) => {
                        const col = table.getColumn(currentValue)
                        if (col) {
                          col.toggleSorting(false)
                        }
                        setOpen(false)
                      }}
                    >
                      <Check className={cn('mr-2 h-4 w-4', currentSort === column.id ? 'opacity-100' : 'opacity-0')} />
                      {column.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <ListFilter className="w-4 h-4" />
              {t('sandboxesModule.table.filter')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className=" w-40" align="start">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Square className="w-4 h-4" />
                {t('sandboxesModule.headers.state')}
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="p-0 w-64">
                  <StateFilter
                    value={(table.getColumn('state')?.getFilterValue() as string[]) || []}
                    onFilterChange={(value) => table.getColumn('state')?.setFilterValue(value)}
                  />
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Camera className="w-4 h-4" />
                {t('sandboxesModule.headers.snapshot')}
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="p-0 w-64">
                  <SnapshotFilter
                    value={(table.getColumn('snapshot')?.getFilterValue() as string[]) || []}
                    onFilterChange={(value) => table.getColumn('snapshot')?.setFilterValue(value)}
                    snapshots={snapshots}
                    isLoading={snapshotsDataIsLoading}
                    hasMore={snapshotsDataHasMore}
                    onChangeSnapshotSearchValue={onChangeSnapshotSearchValue}
                  />
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Globe className="w-4 h-4" />
                {t('sandboxesModule.headers.region')}
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="p-0 w-64">
                  <RegionFilter
                    value={(table.getColumn('region')?.getFilterValue() as string[]) || []}
                    onFilterChange={(value) => table.getColumn('region')?.setFilterValue(value)}
                    options={regionOptions}
                    isLoading={regionsDataIsLoading}
                  />
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
            {resourceFilters.map(({ type, label, icon: Icon }) => (
              <DropdownMenuSub key={type}>
                <DropdownMenuSubTrigger>
                  <Icon className="w-4 h-4" />
                  {label}
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="p-3 w-64">
                    <ResourceFilter
                      value={(table.getColumn('resources')?.getFilterValue() as ResourceFilterValue) || {}}
                      onFilterChange={(value) => table.getColumn('resources')?.setFilterValue(value)}
                      resourceType={type}
                    />
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            ))}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Tag className="w-4 h-4" />
                {t('sandboxesModule.headers.labels')}
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="p-0 w-64">
                  <LabelFilter
                    value={(table.getColumn('labels')?.getFilterValue() as string[]) || []}
                    onFilterChange={(value) => table.getColumn('labels')?.setFilterValue(value)}
                  />
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Calendar className="w-4 h-4" />
                {t('sandboxesModule.headers.lastEvent')}
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="p-3 w-92">
                  <LastEventFilter
                    onFilterChange={(value) => table.getColumn('lastEvent')?.setFilterValue(value)}
                    value={(table.getColumn('lastEvent')?.getFilterValue() as Date[]) || []}
                  />
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-1 gap-1 overflow-x-auto scrollbar-hide h-8 items-center">
        {(table.getColumn('state')?.getFilterValue() as string[])?.length > 0 && (
          <StateFilterIndicator
            value={(table.getColumn('state')?.getFilterValue() as string[]) || []}
            onFilterChange={(value) => table.getColumn('state')?.setFilterValue(value)}
          />
        )}

        {(table.getColumn('snapshot')?.getFilterValue() as string[])?.length > 0 && (
          <SnapshotFilterIndicator
            value={(table.getColumn('snapshot')?.getFilterValue() as string[]) || []}
            onFilterChange={(value) => table.getColumn('snapshot')?.setFilterValue(value)}
            snapshots={snapshots}
            isLoading={snapshotsDataIsLoading}
            hasMore={snapshotsDataHasMore}
            onChangeSnapshotSearchValue={onChangeSnapshotSearchValue}
          />
        )}

        {(table.getColumn('region')?.getFilterValue() as string[])?.length > 0 && (
          <RegionFilterIndicator
            value={(table.getColumn('region')?.getFilterValue() as string[]) || []}
            onFilterChange={(value) => table.getColumn('region')?.setFilterValue(value)}
            options={regionOptions}
            isLoading={regionsDataIsLoading}
          />
        )}

        {resourceFilters.map(({ type }) => {
          const resourceValue = (table.getColumn('resources')?.getFilterValue() as ResourceFilterValue)?.[type]
          return resourceValue ? (
            <ResourceFilterIndicator
              key={type}
              value={table.getColumn('resources')?.getFilterValue() as ResourceFilterValue}
              onFilterChange={(value) => table.getColumn('resources')?.setFilterValue(value)}
              resourceType={type}
            />
          ) : null
        })}

        {(table.getColumn('labels')?.getFilterValue() as string[])?.length > 0 && (
          <LabelFilterIndicator
            value={(table.getColumn('labels')?.getFilterValue() as string[]) || []}
            onFilterChange={(value) => table.getColumn('labels')?.setFilterValue(value)}
          />
        )}

        {(table.getColumn('lastEvent')?.getFilterValue() as Date[])?.length > 0 && (
          <LastEventFilterIndicator
            value={(table.getColumn('lastEvent')?.getFilterValue() as Date[]) || []}
            onFilterChange={(value) => table.getColumn('lastEvent')?.setFilterValue(value)}
          />
        )}
      </div>
    </div>
  )
}
