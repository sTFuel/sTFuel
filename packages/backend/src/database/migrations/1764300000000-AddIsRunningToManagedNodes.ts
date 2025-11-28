import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsRunningToManagedNodes1764300000000 implements MigrationInterface {
  name = 'AddIsRunningToManagedNodes1764300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add isRunning column to managed_nodes table
    await queryRunner.query(`
      ALTER TABLE "managed_nodes"
      ADD COLUMN "isRunning" boolean NOT NULL DEFAULT false
    `);

    // Create index on isRunning for query performance
    await queryRunner.query(`CREATE INDEX "IDX_managed_nodes_isRunning" ON "managed_nodes" ("isRunning")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_managed_nodes_isRunning"`);

    // Drop column
    await queryRunner.query(`ALTER TABLE "managed_nodes" DROP COLUMN "isRunning"`);
  }
}

