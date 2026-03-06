/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ReactNode } from 'react'
import { NotificationSocketContext } from '@/contexts/NotificationSocketContext'

type Props = {
  children: ReactNode
}

export function NotificationSocketProvider(props: Props) {
  return (
    <NotificationSocketContext.Provider value={{ notificationSocket: null }}>
      {props.children}
    </NotificationSocketContext.Provider>
  )
}
