import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateEdgeNodesTable1761559761000 implements MigrationInterface {
  name = 'UpdateEdgeNodesTable1761559761000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add unstakeBlock column to edge_nodes table
    await queryRunner.query(`
      ALTER TABLE "edge_nodes" 
      ADD COLUMN "unstakeBlock" bigint
    `);

    // Remove totalKeeperFeesEarned column from edge_nodes table
    await queryRunner.query(`
      ALTER TABLE "edge_nodes" 
      DROP COLUMN "totalKeeperFeesEarned"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Add back totalKeeperFeesEarned column
    await queryRunner.query(`
      ALTER TABLE "edge_nodes" 
      ADD COLUMN "totalKeeperFeesEarned" numeric(78,0) NOT NULL DEFAULT '0'
    `);

    // Remove unstakeBlock column
    await queryRunner.query(`
      ALTER TABLE "edge_nodes" 
      DROP COLUMN "unstakeBlock"
    `);
  }
}
