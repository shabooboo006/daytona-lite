/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { X } from 'lucide-react'

export interface ResourceFilterValue {
  cpu?: { min?: number; max?: number }
  memory?: { min?: number; max?: number }
  disk?: { min?: number; max?: number }
}

interface ResourceFilterProps {
  value: ResourceFilterValue
  onFilterChange: (value: ResourceFilterValue | undefined) => void
  resourceType?: 'cpu' | 'memory' | 'disk'
}

export function ResourceFilterIndicator({ value, onFilterChange, resourceType }: ResourceFilterProps) {
  const { t } = useTranslation()
  const { title, label } = useMemo(() => {
    const resourceConfig = {
      cpu: { label: 'vCPU', displayLabel: t('sandboxesModule.resourceLabels.cpu') },
      memory: {
        label: t('sandboxesModule.resourceLabels.memoryWithUnit'),
        displayLabel: t('sandboxesModule.resourceLabels.memory'),
      },
      disk: {
        label: t('sandboxesModule.resourceLabels.diskWithUnit'),
        displayLabel: t('sandboxesModule.resourceLabels.disk'),
      },
    } as const

    let title = t('common.all')
    let label = t('sandboxesModule.headers.resources')

    if (resourceType) {
      const resourceValue = value[resourceType]
      if (resourceValue?.min || resourceValue?.max) {
        const config = resourceConfig[resourceType]
        const unit = resourceType === 'cpu' ? 'vCPU' : 'GiB'
        title = `${resourceValue.min ?? t('common.any')} - ${resourceValue.max ?? t('common.any')} ${unit}`
        label = config.displayLabel
      }
    } else {
      const filters: string[] = []
      Object.entries(resourceConfig).forEach(([type, config]) => {
        const resourceValue = value[type as keyof ResourceFilterValue]
        if (resourceValue?.min || resourceValue?.max) {
          const unit = type === 'cpu' ? 'vCPU' : 'GiB'
          filters.push(
            `${config.displayLabel}: ${resourceValue.min ?? t('common.any')}-${resourceValue.max ?? t('common.any')} ${unit}`,
          )
        }
      })
      title = filters.length > 0 ? filters.join('; ') : t('common.all')
    }

    return { title, label }
  }, [t, value, resourceType])

  return (
    <div className="flex items-center h-6 gap-0.5 rounded-sm border border-border bg-muted/80 hover:bg-muted/50 text-sm">
      <Popover>
        <PopoverTrigger className="max-w-[240px] overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground px-2">
          {label}: <span className="text-primary font-medium">{title}</span>
        </PopoverTrigger>

        <PopoverContent className="w-72 p-4" align="start">
          <ResourceFilter value={value} onFilterChange={onFilterChange} resourceType={resourceType} />
        </PopoverContent>
      </Popover>

      <button
        className="h-6 w-5 p-0 border-0 hover:text-muted-foreground"
        onClick={() => {
          if (resourceType) {
            const newFilterValue = { ...value }
            delete newFilterValue[resourceType]
            onFilterChange(Object.keys(newFilterValue).length > 0 ? newFilterValue : undefined)
          } else {
            onFilterChange(undefined)
          }
        }}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

export function ResourceFilter({ value, onFilterChange, resourceType }: ResourceFilterProps) {
  const { t } = useTranslation()
  const resourceConfig = {
    cpu: { label: 'vCPU' as const, displayLabel: 'CPU' },
    memory: {
      label: t('sandboxesModule.resourceLabels.memoryWithUnit'),
      displayLabel: t('sandboxesModule.resourceLabels.memory'),
    },
    disk: {
      label: t('sandboxesModule.resourceLabels.diskWithUnit'),
      displayLabel: t('sandboxesModule.resourceLabels.disk'),
    },
  } as const

  const handleValueChange = (
    resource: keyof ResourceFilterValue,
    field: 'min' | 'max',
    newValue: number | undefined,
  ) => {
    const currentResourceValue = value[resource] || {}
    const updatedResourceValue = { ...currentResourceValue, [field]: newValue }

    if (newValue === undefined && !currentResourceValue.min && !currentResourceValue.max) {
      const newFilterValue = { ...value }
      delete newFilterValue[resource]
      onFilterChange(Object.keys(newFilterValue).length > 0 ? newFilterValue : undefined)
      return
    }

    const newFilterValue = { ...value, [resource]: updatedResourceValue }
    onFilterChange(newFilterValue)
  }

  const handleClear = (resource: keyof ResourceFilterValue) => {
    const newFilterValue = { ...value }
    delete newFilterValue[resource]
    onFilterChange(Object.keys(newFilterValue).length > 0 ? newFilterValue : undefined)
  }

  if (resourceType) {
    const config = resourceConfig[resourceType]
    const currentValues = value[resourceType] || {}

    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label>{config.label}</Label>
          <button
            className="text-sm text-muted-foreground hover:text-primary"
            onClick={() => handleClear(resourceType)}
          >
            {t('common.clear')}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder={t('sandboxesModule.filters.min')}
            min={0}
            value={currentValues.min ?? ''}
            onChange={(e) => {
              const newValue = e.target.value ? Number(e.target.value) : undefined
              handleValueChange(resourceType, 'min', newValue)
            }}
            className="w-full"
          />
          <div className="w-8 h-[1px] bg-border"></div>
          <Input
            type="number"
            placeholder={t('sandboxesModule.filters.max')}
            min={0}
            value={currentValues.max ?? ''}
            onChange={(e) => {
              const newValue = e.target.value ? Number(e.target.value) : undefined
              handleValueChange(resourceType, 'max', newValue)
            }}
            className="w-full"
          />
        </div>
      </div>
    )
  }

  return null
}
