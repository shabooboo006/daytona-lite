/*
 * Copyright 2025 Daytona Platforms Inc.
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common'
import { DockerRegistryService } from './docker-registry/services/docker-registry.service'
import { RegistryType } from './docker-registry/enums/registry-type.enum'
import { OrganizationService } from './organization/services/organization.service'
import { UserService } from './user/user.service'
import { ApiKeyService } from './api-key/api-key.service'
import { EventEmitterReadinessWatcher } from '@nestjs/event-emitter'
import { SnapshotService } from './sandbox/services/snapshot.service'
import { SystemRole } from './user/enums/system-role.enum'
import { TypedConfigService } from './config/typed-config.service'
import { SchedulerRegistry } from '@nestjs/schedule'
import { RegionService } from './region/services/region.service'
import { RunnerService } from './sandbox/services/runner.service'
import { RunnerAdapterFactory, RunnerSnapshotInfo } from './sandbox/runner-adapter/runnerAdapter'
import { RegionType } from './region/enums/region-type.enum'
import { RunnerState } from './sandbox/enums/runner-state.enum'
import { DAYTONA_ADMIN_USER_ID } from './auth/admin.constants'
import { Runner } from './sandbox/entities/runner.entity'
import { Configuration as RunnerApiConfiguration, SnapshotsApi } from '@daytonaio/runner-api-client'
import axios from 'axios'
import { Snapshot } from './sandbox/entities/snapshot.entity'
import { SnapshotState } from './sandbox/enums/snapshot-state.enum'
import { AxiosError } from 'axios'
import { SnapshotRunnerState } from './sandbox/enums/snapshot-runner-state.enum'

@Injectable()
export class AppService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(AppService.name)

  constructor(
    private readonly dockerRegistryService: DockerRegistryService,
    private readonly configService: TypedConfigService,
    private readonly userService: UserService,
    private readonly organizationService: OrganizationService,
    private readonly apiKeyService: ApiKeyService,
    private readonly eventEmitterReadinessWatcher: EventEmitterReadinessWatcher,
    private readonly snapshotService: SnapshotService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly regionService: RegionService,
    private readonly runnerService: RunnerService,
    private readonly runnerAdapterFactory: RunnerAdapterFactory,
  ) {}

  async onApplicationShutdown(signal?: string) {
    this.logger.log(`Received shutdown signal: ${signal}. Shutting down gracefully...`)
    await this.stopAllCronJobs()
  }

  async onApplicationBootstrap() {
    if (this.configService.get('disableCronJobs') || this.configService.get('maintananceMode')) {
      await this.stopAllCronJobs()
    }

    await this.eventEmitterReadinessWatcher.waitUntilReady()

    await this.initializeDefaultRegion()
    await this.initializeAdminUser()
    await this.initializeTransientRegistry()
    await this.initializeInternalRegistry()
    await this.initializeBackupRegistry()

    // Default runner init is not awaited because v2 runners depend on the API to be ready
    this.initializeDefaultRunner()
      .then(() => this.initializeDefaultSnapshot())
      .catch((error) => {
        this.logger.error('Error initializing default runner', error)
      })
  }

  private async stopAllCronJobs(): Promise<void> {
    for (const cronName of this.schedulerRegistry.getCronJobs().keys()) {
      this.logger.debug(`Stopping cron job: ${cronName}`)
      this.schedulerRegistry.deleteCronJob(cronName)
    }
  }

  private async initializeDefaultRegion(): Promise<void> {
    const existingRegion = await this.regionService.findOne(this.configService.getOrThrow('defaultRegion.id'))
    if (existingRegion) {
      return
    }

    this.logger.log('Initializing default region...')

    await this.regionService.create(
      {
        id: this.configService.getOrThrow('defaultRegion.id'),
        name: this.configService.getOrThrow('defaultRegion.name'),
        enforceQuotas: this.configService.getOrThrow('defaultRegion.enforceQuotas'),
        regionType: RegionType.SHARED,
      },
      null,
    )

    this.logger.log(`Default region created successfully: ${this.configService.getOrThrow('defaultRegion.name')}`)
  }

  private async initializeDefaultRunner(): Promise<void> {
    if (!this.configService.get('autoRegisterLocalRunner')) {
      this.logger.log('Skipping default runner initialization because auto registration is disabled')
      return
    }

    if (!this.configService.get('defaultRunner.name')) {
      return
    }

    const defaultRegionId = this.configService.getOrThrow('defaultRegion.id')
    const runnerName = this.configService.getOrThrow('defaultRunner.name')
    const runnerVersion = this.configService.getOrThrow('defaultRunner.apiVersion')

    const existingRunners = await this.runnerService.findAllByRegion(defaultRegionId)
    const existingRunner = existingRunners.find((runner) => runner.name === runnerName)
    if (existingRunner) {
      this.logger.log(`Default runner ${runnerName} already exists, waiting for health...`)
      await this.waitForRunnerHealthy(existingRunner.id, runnerVersion, runnerName)
      return
    }

    this.logger.log(`Creating default runner: ${runnerName}`)

    if (runnerVersion === '0') {
      const { runner } = await this.runnerService.create({
        apiUrl: this.configService.getOrThrow('defaultRunner.apiUrl'),
        proxyUrl: this.configService.getOrThrow('defaultRunner.proxyUrl'),
        apiKey: this.configService.getOrThrow('defaultRunner.apiKey'),
        cpu: this.configService.getOrThrow('defaultRunner.cpu'),
        memoryGiB: this.configService.getOrThrow('defaultRunner.memory'),
        diskGiB: this.configService.getOrThrow('defaultRunner.disk'),
        regionId: defaultRegionId,
        domain: this.configService.getOrThrow('defaultRunner.domain'),
        apiVersion: runnerVersion,
        name: runnerName,
      })

      await this.waitForRunnerHealthy(runner.id, runnerVersion, runner.name)
    } else if (runnerVersion === '2') {
      const { runner } = await this.runnerService.create({
        apiKey: this.configService.getOrThrow('defaultRunner.apiKey'),
        regionId: defaultRegionId,
        apiVersion: runnerVersion,
        name: runnerName,
      })

      await this.waitForRunnerHealthy(runner.id, runnerVersion, runner.name)
    }

    this.logger.log(`Default runner ${runnerName} created successfully`)
  }

  private async initializeAdminUser(): Promise<void> {
    if (await this.userService.findOne(DAYTONA_ADMIN_USER_ID)) {
      return
    }

    const user = await this.userService.create({
      id: DAYTONA_ADMIN_USER_ID,
      name: 'Daytona Admin',
      personalOrganizationQuota: {
        totalCpuQuota: this.configService.getOrThrow('admin.totalCpuQuota'),
        totalMemoryQuota: this.configService.getOrThrow('admin.totalMemoryQuota'),
        totalDiskQuota: this.configService.getOrThrow('admin.totalDiskQuota'),
        maxCpuPerSandbox: this.configService.getOrThrow('admin.maxCpuPerSandbox'),
        maxMemoryPerSandbox: this.configService.getOrThrow('admin.maxMemoryPerSandbox'),
        maxDiskPerSandbox: this.configService.getOrThrow('admin.maxDiskPerSandbox'),
        snapshotQuota: this.configService.getOrThrow('admin.snapshotQuota'),
        maxSnapshotSize: this.configService.getOrThrow('admin.maxSnapshotSize'),
        volumeQuota: this.configService.getOrThrow('admin.volumeQuota'),
      },
      personalOrganizationDefaultRegionId: this.configService.getOrThrow('defaultRegion.id'),
      role: SystemRole.ADMIN,
    })
    const personalOrg = await this.organizationService.findPersonal(user.id)
    const { value } = await this.apiKeyService.createApiKey(
      personalOrg.id,
      user.id,
      DAYTONA_ADMIN_USER_ID,
      [],
      undefined,
      this.configService.getOrThrow('admin.apiKey'),
    )
    this.logger.log(
      `
=========================================
=========================================
Admin user created with API key: ${value}
=========================================
=========================================`,
    )
  }

  private async initializeTransientRegistry(): Promise<void> {
    if (!this.configService.get('enableDefaultTransientRegistry')) {
      this.logger.log('Skipping default transient registry initialization')
      return
    }

    const existingRegistry = await this.dockerRegistryService.getAvailableTransientRegistry(
      this.configService.getOrThrow('defaultRegion.id'),
    )
    if (existingRegistry) {
      return
    }

    const registryUrl = this.configService.getOrThrow('transientRegistry.url')
    const registryAdmin = this.configService.getOrThrow('transientRegistry.admin')
    const registryPassword = this.configService.getOrThrow('transientRegistry.password')
    const registryProjectId = this.configService.getOrThrow('transientRegistry.projectId')

    if (!registryUrl || !registryAdmin || !registryPassword || !registryProjectId) {
      this.logger.warn('Registry configuration not found, skipping transient registry setup')
      return
    }

    this.logger.log('Initializing default transient registry...')

    await this.dockerRegistryService.create({
      name: 'Transient Registry',
      url: registryUrl,
      username: registryAdmin,
      password: registryPassword,
      project: registryProjectId,
      registryType: RegistryType.TRANSIENT,
      isDefault: true,
    })

    this.logger.log('Default transient registry initialized successfully')
  }

  private async initializeInternalRegistry(): Promise<void> {
    if (!this.configService.get('enableDefaultInternalRegistry')) {
      this.logger.log('Skipping default internal registry initialization')
      return
    }

    const existingRegistry = await this.dockerRegistryService.getAvailableInternalRegistry(
      this.configService.getOrThrow('defaultRegion.id'),
    )
    if (existingRegistry) {
      return
    }

    const registryUrl = this.configService.getOrThrow('internalRegistry.url')
    const registryAdmin = this.configService.getOrThrow('internalRegistry.admin')
    const registryPassword = this.configService.getOrThrow('internalRegistry.password')
    const registryProjectId = this.configService.getOrThrow('internalRegistry.projectId')

    if (!registryUrl || !registryAdmin || !registryPassword || !registryProjectId) {
      this.logger.warn('Registry configuration not found, skipping internal registry setup')
      return
    }

    this.logger.log('Initializing default internal registry...')

    await this.dockerRegistryService.create({
      name: 'Internal Registry',
      url: registryUrl,
      username: registryAdmin,
      password: registryPassword,
      project: registryProjectId,
      registryType: RegistryType.INTERNAL,
      isDefault: true,
    })

    this.logger.log('Default internal registry initialized successfully')
  }

  private async initializeBackupRegistry(): Promise<void> {
    if (!this.configService.get('enableDefaultBackupRegistry')) {
      this.logger.log('Skipping default backup registry initialization')
      return
    }

    const existingRegistry = await this.dockerRegistryService.getAvailableBackupRegistry(
      this.configService.getOrThrow('defaultRegion.id'),
    )
    if (existingRegistry) {
      return
    }

    const registryUrl = this.configService.getOrThrow('internalRegistry.url')
    const registryAdmin = this.configService.getOrThrow('internalRegistry.admin')
    const registryPassword = this.configService.getOrThrow('internalRegistry.password')
    const registryProjectId = this.configService.getOrThrow('internalRegistry.projectId')

    if (!registryUrl || !registryAdmin || !registryPassword || !registryProjectId) {
      this.logger.warn('Registry configuration not found, skipping backup registry setup')
      return
    }

    this.logger.log('Initializing default backup registry...')

    await this.dockerRegistryService.create(
      {
        name: 'Backup Registry',
        url: registryUrl,
        username: registryAdmin,
        password: registryPassword,
        project: registryProjectId,
        registryType: RegistryType.BACKUP,
        isDefault: true,
      },
      undefined,
      true,
    )

    this.logger.log('Default backup registry initialized successfully')
  }

  private async initializeDefaultSnapshot(): Promise<void> {
    const adminPersonalOrg = await this.organizationService.findPersonal(DAYTONA_ADMIN_USER_ID)
    const defaultSnapshotName = this.configService.getOrThrow('defaultSnapshot')
    const defaultRegionId = adminPersonalOrg.defaultRegionId ?? this.configService.getOrThrow('defaultRegion.id')
    const defaultRunner = await this.waitForDefaultRunnerReady()

    let existingSnapshot: Snapshot | null = null

    try {
      existingSnapshot = await this.snapshotService.getSnapshotByName(defaultSnapshotName, adminPersonalOrg.id)
    } catch {
      existingSnapshot = null
    }

    if (this.configService.get('localImageMode') && !this.configService.get('registryFallbackEnabled')) {
      const localImages = await this.snapshotService.listLocalImages(
        adminPersonalOrg,
        defaultRegionId,
        defaultSnapshotName,
        true,
      )
      const hasLocalImage = localImages.some(
        (image) =>
          image.imageName === defaultSnapshotName ||
          image.repoTags?.includes(defaultSnapshotName) ||
          image.repoDigests?.includes(defaultSnapshotName),
      )

      if (!hasLocalImage) {
        this.logger.warn(
          `Skipping default snapshot initialization for ${defaultSnapshotName}: local image mode is enabled, registry fallback is disabled, and no ready runner in region ${defaultRegionId} currently has the image`,
        )
        return
      }
    }

    if (defaultRunner) {
      const localSnapshotInfo = await this.getLocalRunnerSnapshotInfo(defaultRunner, defaultSnapshotName)
      if (localSnapshotInfo) {
        await this.snapshotService.upsertLocalSnapshot(adminPersonalOrg, {
          name: defaultSnapshotName,
          imageName: defaultSnapshotName,
          ref: defaultSnapshotName,
          initialRunnerId: defaultRunner.id,
          regionId: defaultRegionId,
          size: localSnapshotInfo.sizeGB,
          entrypoint: localSnapshotInfo.entrypoint,
          general: true,
        })
        await this.runnerService.ensureSnapshotRunnerEntry(
          defaultRunner.id,
          defaultSnapshotName,
          SnapshotRunnerState.READY,
        )
        this.logger.log(`Default snapshot ${defaultSnapshotName} is active from local runner image`)
        return
      }
    }

    if (existingSnapshot?.state === SnapshotState.ACTIVE) {
      return
    }

    if (existingSnapshot) {
      await this.snapshotService.resetSnapshotForPull(existingSnapshot.id, defaultSnapshotName, defaultRegionId)
      this.logger.log(`Default snapshot ${defaultSnapshotName} reset for pull reconciliation`)
      return
    }

    await this.snapshotService.createFromPull(
      adminPersonalOrg,
      {
        name: defaultSnapshotName,
        imageName: defaultSnapshotName,
        regionId: defaultRegionId,
      },
      true,
    )

    this.logger.log('Default snapshot created successfully')
  }

  private async waitForRunnerHealthy(runnerId: string, runnerVersion: '0' | '2', runnerName: string): Promise<boolean> {
    this.logger.log(`Waiting for runner ${runnerName} to be healthy...`)

    if (runnerVersion === '0') {
      for (let i = 0; i < 60; i++) {
        try {
          const runner = await this.runnerService.findOneOrFail(runnerId)
          const runnerAdapter = await this.runnerAdapterFactory.create(runner)
          await runnerAdapter.healthCheck()
          this.logger.log(`Runner ${runnerName} is healthy`)
          return true
        } catch {
          // ignore until timeout
        }
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    } else {
      for (let i = 0; i < 60; i++) {
        const { state } = await this.runnerService.findOneFullOrFail(runnerId)
        if (state === RunnerState.READY) {
          this.logger.log(`Runner ${runnerName} is healthy`)
          return true
        }
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    this.logger.log(`Default runner ${runnerName} did not become healthy in time`)
    return false
  }

  private async waitForDefaultRunnerReady(): Promise<Runner | null> {
    const defaultRegionId = this.configService.getOrThrow('defaultRegion.id')
    const defaultRunnerName = this.configService.getOrThrow('defaultRunner.name')

    for (let i = 0; i < 60; i++) {
      const runners = await this.runnerService.findAllByRegion(defaultRegionId)
      const defaultRunner = runners.find((runner) => runner.name === defaultRunnerName)
      if (defaultRunner?.state === RunnerState.READY) {
        return this.runnerService.findOneOrFail(defaultRunner.id)
      }

      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    return null
  }

  private async getLocalRunnerSnapshotInfo(runner: Runner, snapshotName: string): Promise<RunnerSnapshotInfo | null> {
    const candidateUrls = new Set<string>()

    if (runner.apiUrl) {
      candidateUrls.add(runner.apiUrl)
    }

    if (runner.name === this.configService.getOrThrow('defaultRunner.name')) {
      candidateUrls.add(this.configService.getOrThrow('defaultRunner.apiUrl'))
    }

    for (const candidateUrl of candidateUrls) {
      const axiosInstance = axios.create({
        baseURL: candidateUrl,
        headers: {
          Authorization: `Bearer ${runner.apiKey}`,
        },
        timeout: 10_000,
      })

      const config = new RunnerApiConfiguration({
        basePath: candidateUrl,
      })

      const snapshotsApi = new SnapshotsApi(config, undefined, axiosInstance)

      try {
        const response = await snapshotsApi.getSnapshotInfo(snapshotName)

        return {
          name: response.data.name || snapshotName,
          sizeGB: response.data.sizeGB,
          entrypoint: response.data.entrypoint || [],
          cmd: response.data.cmd || [],
          hash: response.data.hash,
        }
      } catch (error) {
        if (error instanceof AxiosError && [404, 422].includes(error.response?.status || 0)) {
          return null
        }

        this.logger.warn(
          `Failed to inspect local snapshot ${snapshotName} on runner ${runner.name} via ${candidateUrl}: ${error}`,
        )
      }
    }

    return null
  }
}
