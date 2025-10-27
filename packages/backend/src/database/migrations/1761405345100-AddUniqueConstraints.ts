import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUniqueConstraints1761405345100 implements MigrationInterface {
    name = 'AddUniqueConstraints1761405345100'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "hourly_snapshots" ALTER COLUMN "totalKeeperTipsPaid" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "node_manager_events" ADD CONSTRAINT "UQ_471aceff7eb96c4dea32ffd256b" UNIQUE ("blockNumber", "transactionHash", "logIndex")`);
        await queryRunner.query(`ALTER TABLE "stfuel_events" ADD CONSTRAINT "UQ_badc7ede703ac7f00d0df6adddb" UNIQUE ("blockNumber", "transactionHash", "logIndex")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "stfuel_events" DROP CONSTRAINT "UQ_badc7ede703ac7f00d0df6adddb"`);
        await queryRunner.query(`ALTER TABLE "node_manager_events" DROP CONSTRAINT "UQ_471aceff7eb96c4dea32ffd256b"`);
        await queryRunner.query(`ALTER TABLE "hourly_snapshots" ALTER COLUMN "totalKeeperTipsPaid" SET DEFAULT '0'`);
    }

}
