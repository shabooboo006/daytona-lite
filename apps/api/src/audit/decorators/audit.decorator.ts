/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SetMetadata } from '@nestjs/common'
import { Request } from 'express'
import { AuditAction } from '../enums/audit-action.enum'
import { AuditTarget } from '../enums/audit-target.enum'

type RouteRequest<T = unknown> = Omit<Request<Record<string, string>>, 'body'> & { body: T }

export type TypedRequest<T> = RouteRequest<T>

export const MASKED_AUDIT_VALUE = '********'

export interface AuditContext {
  action: AuditAction
  targetType?: AuditTarget
  targetIdFromRequest?: (req: RouteRequest) => string | null | undefined
  targetIdFromResult?: (result: any) => string | null | undefined
  requestMetadata?: Record<string, (req: RouteRequest) => any>
}

export const AUDIT_CONTEXT_KEY = 'audit_context'

export const Audit = (context: AuditContext) => SetMetadata(AUDIT_CONTEXT_KEY, context)
