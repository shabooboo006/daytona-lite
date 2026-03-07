/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Button } from '@/components/ui/button'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { Calendar } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
import { useState } from 'react'
import { CalendarIcon, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getIntlLocale } from '@/i18n/init'

interface LastEventFilterProps {
  value: (Date | undefined)[]
  onFilterChange: (value: (Date | undefined)[] | undefined) => void
}

export function LastEventFilterIndicator({ value, onFilterChange }: LastEventFilterProps) {
  const { t } = useTranslation()
  const formatDate = (date: Date) => date.toLocaleDateString(getIntlLocale(), { dateStyle: 'medium' })

  return (
    <div className="flex items-center h-6 gap-0.5 rounded-sm border border-border bg-muted/80 hover:bg-muted/50 text-sm">
      <Popover>
        <PopoverTrigger className="max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground px-2">
          {t('sandboxesModule.filters.lastEvent')}:{' '}
          <span className="text-primary font-medium">
            {value.some((d) => d !== undefined)
              ? `${value
                  .filter((d): d is Date => d !== undefined)
                  .map(formatDate)
                  .join(' - ')}`
              : ''}
          </span>
        </PopoverTrigger>
        <PopoverContent className="p-3 w-auto" align="start">
          <LastEventFilter onFilterChange={onFilterChange} value={value} />
        </PopoverContent>
      </Popover>

      <button className="h-6 w-5 p-0 border-0 hover:text-muted-foreground" onClick={() => onFilterChange(undefined)}>
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

interface LastEventFilterContentProps {
  onFilterChange: (value: (Date | undefined)[] | undefined) => void
  value: (Date | undefined)[]
}

export function LastEventFilter({ onFilterChange, value }: LastEventFilterContentProps) {
  const { t } = useTranslation()
  const [fromDate, setFromDate] = useState<Date | undefined>(value[0])
  const [toDate, setToDate] = useState<Date | undefined>(value[1])
  const formatDate = (date: Date) => date.toLocaleDateString(getIntlLocale(), { dateStyle: 'medium' })

  const handleFromDateSelect = (selectedDate: Date | undefined) => {
    setFromDate(selectedDate)
    const dates = [selectedDate, toDate]
    const hasAnyDate = dates.some((date) => date !== undefined)
    onFilterChange(hasAnyDate ? dates : undefined)
  }

  const handleToDateSelect = (selectedDate: Date | undefined) => {
    setToDate(selectedDate)
    const dates = [fromDate, selectedDate]
    const hasAnyDate = dates.some((date) => date !== undefined)
    onFilterChange(hasAnyDate ? dates : undefined)
  }

  const handleClear = () => {
    setFromDate(undefined)
    setToDate(undefined)
    onFilterChange(undefined)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label>{t('sandboxesModule.filters.lastEvent')}</Label>
        <button className="text-sm text-muted-foreground hover:text-primary px-2" onClick={() => handleClear()}>
          {t('common.clear')}
        </button>
      </div>
      <div className="flex gap-2 items-center">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn('min-w-40', !fromDate && 'text-muted-foreground')}>
              <CalendarIcon className=" h-4 w-4" />
              {fromDate ? formatDate(fromDate) : <span>{t('sandboxesModule.filters.pickDate')}</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={fromDate} onSelect={handleFromDateSelect} initialFocus />
          </PopoverContent>
        </Popover>

        <div className="w-4 flex-shrink-0 h-[1px] bg-border"></div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn('min-w-40', !toDate && 'text-muted-foreground')}>
              <CalendarIcon className=" h-4 w-4" />
              {toDate ? formatDate(toDate) : <span>{t('sandboxesModule.filters.pickDate')}</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={toDate} onSelect={handleToDateSelect} initialFocus />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
