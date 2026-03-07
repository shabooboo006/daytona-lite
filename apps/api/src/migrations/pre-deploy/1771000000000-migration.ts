/*
 * Copyright Daytona Platforms Inc.
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MigrationInterface, QueryRunner } from 'typeorm'

export class Migration1771000000000 implements MigrationInterface {
  name = 'Migration1771000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."snapshot_sourcetype_enum" AS ENUM('local_image', 'registry_image', 'build')`,
    )
    await queryRunner.query(
      `CREATE TYPE "public"."snapshot_storagemode_enum" AS ENUM('local_only', 'registry')`,
    )
    await queryRunner.query(
      `ALTER TABLE "snapshot" ADD "sourceType" "public"."snapshot_sourcetype_enum" NOT NULL DEFAULT 'registry_image'`,
    )
    await queryRunner.query(
      `ALTER TABLE "snapshot" ADD "storageMode" "public"."snapshot_storagemode_enum" NOT NULL DEFAULT 'registry'`,
    )
    const buildInfoSnapshotRefColumn = await queryRunner.hasColumn('snapshot', 'buildInfoSnapshotRef')
    const buildInfoIdColumn = await queryRunner.hasColumn('snapshot', 'buildInfoId')

    if (buildInfoSnapshotRefColumn) {
      await queryRunner.query(
        `UPDATE "snapshot" SET "sourceType" = 'build', "storageMode" = 'registry' WHERE "buildInfoSnapshotRef" IS NOT NULL`,
      )
      return
    }

    if (buildInfoIdColumn) {
      await queryRunner.query(
        `UPDATE "snapshot" SET "sourceType" = 'build', "storageMode" = 'registry' WHERE "buildInfoId" IS NOT NULL`,
      )
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "snapshot" DROP COLUMN "storageMode"`)
    await queryRunner.query(`ALTER TABLE "snapshot" DROP COLUMN "sourceType"`)
    await queryRunner.query(`DROP TYPE "public"."snapshot_storagemode_enum"`)
    await queryRunner.query(`DROP TYPE "public"."snapshot_sourcetype_enum"`)
  }
}
