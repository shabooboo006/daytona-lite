/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Table } from '@tanstack/react-table'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Button } from './ui/button'
import { PAGE_SIZE_OPTIONS } from '../constants/Pagination'
import { useTranslation } from 'react-i18next'

interface PaginationProps<TData> {
  table: Table<TData>
  selectionEnabled?: boolean
  className?: string
  entityName?: string
  totalItems?: number
}

export function Pagination<TData>({
  table,
  selectionEnabled,
  className,
  entityName,
  totalItems,
}: PaginationProps<TData>) {
  const { t } = useTranslation()

  return (
    <div className={`flex flex-col sm:flex-row gap-2 sm:items-center justify-between w-full ${className}`}>
      <div className="flex items-center gap-4">
        <Select
          value={`${table.getState().pagination.pageSize}`}
          onValueChange={(value) => {
            table.setPageSize(Number(value))
          }}
        >
          <SelectTrigger className="h-8 w-[164px]">
            <SelectValue placeholder={t('pagination.perPage', { count: table.getState().pagination.pageSize })} />
          </SelectTrigger>
          <SelectContent side="top">
            {PAGE_SIZE_OPTIONS.map((pageSize) => (
              <SelectItem key={pageSize} value={`${pageSize}`}>
                {t('pagination.perPage', { count: pageSize })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectionEnabled ? (
          <div className="flex-1 text-sm text-muted-foreground">
            {t('pagination.selectedSummary', {
              selected: table.getFilteredSelectedRowModel().rows.length,
              total: totalItems ?? table.getFilteredRowModel().rows.length,
            })}
          </div>
        ) : (
          <div className="flex-1 text-sm text-muted-foreground">
            {t('pagination.totalSummary', { total: totalItems ?? table.getFilteredRowModel().rows.length })}
            {entityName ? ` ${entityName}` : ''}
          </div>
        )}
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-end text-sm font-medium text-muted-foreground">
          {t('pagination.pageStatus', {
            page: table.getState().pagination.pageIndex + 1,
            totalPages: table.getPageCount() || 1,
          })}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">Go to first page</span>
            <ChevronsLeft />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">Go to previous page</span>
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">Go to next page</span>
            <ChevronRight />
          </Button>
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">Go to last page</span>
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
