import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateRedemptionQueue1761521118891 implements MigrationInterface {
    name = 'UpdateRedemptionQueue1761521118891'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "redemption_queue" DROP COLUMN "claimBlock"`);
        await queryRunner.query(`ALTER TABLE "redemption_queue" DROP COLUMN "claimTimestamp"`);
        await queryRunner.query(`ALTER TABLE "redemption_queue" DROP COLUMN "tfuelAmountClaimed"`);
        await queryRunner.query(`ALTER TABLE "redemption_queue" ADD "unlockTimestamp" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "redemption_queue" ADD "queueIndex" bigint NOT NULL`);
        await queryRunner.query(`ALTER TABLE "redemption_queue" ADD "creditedBlock" bigint`);
        await queryRunner.query(`ALTER TABLE "redemption_queue" ADD "creditedTimestamp" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "redemption_queue" DROP COLUMN "creditedTimestamp"`);
        await queryRunner.query(`ALTER TABLE "redemption_queue" DROP COLUMN "creditedBlock"`);
        await queryRunner.query(`ALTER TABLE "redemption_queue" DROP COLUMN "queueIndex"`);
        await queryRunner.query(`ALTER TABLE "redemption_queue" DROP COLUMN "unlockTimestamp"`);
        await queryRunner.query(`ALTER TABLE "redemption_queue" ADD "tfuelAmountClaimed" numeric(78,0)`);
        await queryRunner.query(`ALTER TABLE "redemption_queue" ADD "claimTimestamp" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "redemption_queue" ADD "claimBlock" bigint`);
    }

}
