/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: AGPL-3.0
 */

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import i18n, { getIntlLocale } from '@/i18n/init'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getRelativeTimeString(
  timestamp: string | Date | undefined | null,
  fallback = '-',
): { date: Date; relativeTimeString: string } {
  if (!timestamp) {
    return { date: new Date(), relativeTimeString: fallback }
  }

  try {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    const isFuture = diffInMinutes < 0
    const absDiffInMinutes = Math.abs(diffInMinutes)

    if (absDiffInMinutes < 1)
      return {
        date,
        relativeTimeString: isFuture ? i18n.t('time.shortly') : i18n.t('time.justNow'),
      }

    if (absDiffInMinutes < 60) {
      return {
        date,
        relativeTimeString: isFuture
          ? i18n.t('time.minuteIn', { count: absDiffInMinutes })
          : i18n.t('time.minuteAgo', { count: absDiffInMinutes }),
      }
    }

    const hours = Math.floor(absDiffInMinutes / 60)
    if (hours < 24) {
      return {
        date,
        relativeTimeString: isFuture
          ? i18n.t('time.hourIn', { count: hours })
          : i18n.t('time.hourAgo', { count: hours }),
      }
    }

    const days = Math.floor(hours / 24)
    if (days < 365) {
      return {
        date,
        relativeTimeString: isFuture ? i18n.t('time.dayIn', { count: days }) : i18n.t('time.dayAgo', { count: days }),
      }
    }

    const years = Math.floor(days / 365)
    return {
      date,
      relativeTimeString: isFuture ? i18n.t('time.yearIn', { count: years }) : i18n.t('time.yearAgo', { count: years }),
    }
  } catch {
    return { date: new Date(), relativeTimeString: fallback }
  }
}

export function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function getMaskedToken(token: string) {
  return `${token.substring(0, 3)}********************${token.slice(-3)}`
}

export function formatDuration(minutes: number): string {
  minutes = Math.abs(minutes)

  if (minutes < 60) {
    return i18n.t('time.duration.minute', { count: Math.floor(minutes) })
  }

  const hours = minutes / 60
  if (hours < 24) {
    return i18n.t('time.duration.hour', { count: Math.floor(hours) })
  }

  const days = hours / 24
  if (days < 365) {
    return i18n.t('time.duration.day', { count: Math.floor(days) })
  }

  const years = days / 365
  return i18n.t('time.duration.year', { count: Math.floor(years) })
}

export function pluralize(
  count: number,
  singular: string,
  plural: string,
  translationKey?: string,
  interpolation?: Record<string, unknown>,
): string {
  if (translationKey) {
    return i18n.t(translationKey, { count, ...interpolation })
  }

  return count === 1 ? `${count} ${singular}` : `${count} ${plural}`
}

export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

export function formatTimestamp(timestamp: string | Date | undefined | null): string {
  if (!timestamp) {
    return '-'
  }

  return new Date(timestamp).toLocaleString(getIntlLocale())
}

export function formatAmount(amount: number): string {
  return Intl.NumberFormat(getIntlLocale(), {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format((amount ?? 0) / 100)
}

export function findLast<T>(arr: T[], predicate: (item: T, index: number, array: T[]) => boolean): T | undefined {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i], i, arr)) {
      return arr[i]
    }
  }

  return undefined
}

export function getRegionFullDisplayName(region: { id: string; name: string; organizationId?: string | null }): string {
  return `${region.name}${region.organizationId && region.name !== region.id ? ` (${region.id})` : ''}`
}

export function getMetaKey(): string {
  return window.navigator.userAgent.includes('Mac') ? '⌘' : 'Ctrl'
}
