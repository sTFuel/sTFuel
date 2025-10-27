import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTotalKeeperTipsPaid1761391038839 implements MigrationInterface {
    name = 'AddTotalKeeperTipsPaid1761391038839'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_node_manager_events_blockNumber_transactionIndex_logIndex"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_node_manager_events_eventName"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_node_manager_events_address"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_stfuel_events_blockNumber_transactionIndex_logIndex"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_stfuel_events_eventName"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_stfuel_events_address"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_hourly_snapshots_snapshotTimestamp"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_hourly_snapshots_blockNumber"`);
        await queryRunner.query(`ALTER TABLE "hourly_snapshots" ADD "totalKeeperTipsPaid" numeric(78,0) DEFAULT '0'`);
        await queryRunner.query(`UPDATE "hourly_snapshots" SET "totalKeeperTipsPaid" = '0' WHERE "totalKeeperTipsPaid" IS NULL`);
        await queryRunner.query(`ALTER TABLE "hourly_snapshots" ALTER COLUMN "totalKeeperTipsPaid" SET NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_95c8ac856c7e83142b0a2871b5" ON "node_manager_events" ("address") `);
        await queryRunner.query(`CREATE INDEX "IDX_a0559d14119d8b45fc10772f68" ON "node_manager_events" ("eventName") `);
        await queryRunner.query(`CREATE INDEX "IDX_d8d9569a4eb69b911fa5f8d527" ON "node_manager_events" ("blockNumber", "transactionIndex", "logIndex") `);
        await queryRunner.query(`CREATE INDEX "IDX_1d1a36d350970826b92e5bcbba" ON "stfuel_events" ("address") `);
        await queryRunner.query(`CREATE INDEX "IDX_b25b67e91f2c2d8c0ee0e3d925" ON "stfuel_events" ("eventName") `);
        await queryRunner.query(`CREATE INDEX "IDX_4d207e8c2c3d98a7ca7a814652" ON "stfuel_events" ("blockNumber", "transactionIndex", "logIndex") `);
        await queryRunner.query(`CREATE INDEX "IDX_18298cfc71693e63cfe871e79e" ON "hourly_snapshots" ("blockNumber") `);
        await queryRunner.query(`CREATE INDEX "IDX_702202c79fbbab652007657dc5" ON "hourly_snapshots" ("snapshotTimestamp") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_702202c79fbbab652007657dc5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_18298cfc71693e63cfe871e79e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4d207e8c2c3d98a7ca7a814652"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b25b67e91f2c2d8c0ee0e3d925"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1d1a36d350970826b92e5bcbba"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d8d9569a4eb69b911fa5f8d527"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a0559d14119d8b45fc10772f68"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_95c8ac856c7e83142b0a2871b5"`);
        await queryRunner.query(`ALTER TABLE "hourly_snapshots" DROP COLUMN "totalKeeperTipsPaid"`);
        await queryRunner.query(`CREATE INDEX "IDX_hourly_snapshots_blockNumber" ON "hourly_snapshots" ("blockNumber") `);
        await queryRunner.query(`CREATE INDEX "IDX_hourly_snapshots_snapshotTimestamp" ON "hourly_snapshots" ("snapshotTimestamp") `);
        await queryRunner.query(`CREATE INDEX "IDX_stfuel_events_address" ON "stfuel_events" ("address") `);
        await queryRunner.query(`CREATE INDEX "IDX_stfuel_events_eventName" ON "stfuel_events" ("eventName") `);
        await queryRunner.query(`CREATE INDEX "IDX_stfuel_events_blockNumber_transactionIndex_logIndex" ON "stfuel_events" ("blockNumber", "transactionIndex", "logIndex") `);
        await queryRunner.query(`CREATE INDEX "IDX_node_manager_events_address" ON "node_manager_events" ("address") `);
        await queryRunner.query(`CREATE INDEX "IDX_node_manager_events_eventName" ON "node_manager_events" ("eventName") `);
        await queryRunner.query(`CREATE INDEX "IDX_node_manager_events_blockNumber_transactionIndex_logIndex" ON "node_manager_events" ("blockNumber", "transactionIndex", "logIndex") `);
    }

}
