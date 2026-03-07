/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SandboxState } from '@daytonaio/api-client'
import { CheckCircle, Circle, AlertTriangle, Timer, Archive } from 'lucide-react'
import { FacetedFilterOption } from './types'
import i18n from '@/i18n/init'

export const SANDBOX_FILTER_STATES: Array<Omit<FacetedFilterOption, 'label'>> = [
  {
    value: SandboxState.STARTED,
    icon: CheckCircle,
  },
  { value: SandboxState.STOPPED, icon: Circle },
  { value: SandboxState.ERROR, icon: AlertTriangle },
  { value: SandboxState.BUILD_FAILED, icon: AlertTriangle },
  { value: SandboxState.STARTING, icon: Timer },
  { value: SandboxState.STOPPING, icon: Timer },
  { value: SandboxState.DESTROYING, icon: Timer },
  { value: SandboxState.ARCHIVED, icon: Archive },
  { value: SandboxState.ARCHIVING, icon: Timer },
]

export function getStateLabel(state?: SandboxState): string {
  if (!state) {
    return i18n.t('sandboxesModule.states.unknown')
  }

  const stateTranslationKey: Record<SandboxState, string> = {
    [SandboxState.STARTED]: 'started',
    [SandboxState.STOPPED]: 'stopped',
    [SandboxState.ERROR]: 'error',
    [SandboxState.BUILD_FAILED]: 'buildFailed',
    [SandboxState.BUILDING_SNAPSHOT]: 'buildingSnapshot',
    [SandboxState.PENDING_BUILD]: 'pendingBuild',
    [SandboxState.RESTORING]: 'restoring',
    [SandboxState.ARCHIVED]: 'archived',
    [SandboxState.CREATING]: 'creating',
    [SandboxState.STARTING]: 'starting',
    [SandboxState.STOPPING]: 'stopping',
    [SandboxState.DESTROYING]: 'destroying',
    [SandboxState.DESTROYED]: 'destroyed',
    [SandboxState.PULLING_SNAPSHOT]: 'pullingSnapshot',
    [SandboxState.UNKNOWN]: 'unknown',
    [SandboxState.ARCHIVING]: 'archiving',
    [SandboxState.RESIZING]: 'resizing',
  }

  return i18n.t(`sandboxesModule.states.${stateTranslationKey[state]}`)
}
