/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class LocalImageDto {
  @ApiProperty({ example: 'ubuntu:22.04' })
  imageName: string

  @ApiPropertyOptional({ type: [String] })
  repoTags?: string[]

  @ApiPropertyOptional({ type: [String] })
  repoDigests?: string[]

  @ApiProperty({ example: 0.13 })
  sizeGB: number

  @ApiPropertyOptional({ type: [String] })
  entrypoint?: string[]

  @ApiPropertyOptional({ type: [String] })
  cmd?: string[]
}

export class AggregatedLocalImageDto extends LocalImageDto {
  @ApiProperty({ type: [String] })
  runnerIds: string[]

  @ApiProperty({ example: 1 })
  runnerCount: number
}
