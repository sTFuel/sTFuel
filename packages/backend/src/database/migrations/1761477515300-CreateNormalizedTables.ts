import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNormalizedTables1761477515300 implements MigrationInterface {
  name = 'CreateNormalizedTables1761477515300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create addresses table
    await queryRunner.query(`
      CREATE TABLE "addresses" (
        "id" SERIAL NOT NULL,
        "address" character varying NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_addresses_address" UNIQUE ("address"),
        CONSTRAINT "PK_addresses" PRIMARY KEY ("id")
      )
    `);

    // Create edge_nodes table
    await queryRunner.query(`
      CREATE TABLE "edge_nodes" (
        "id" SERIAL NOT NULL,
        "addressId" integer NOT NULL,
        "registrationBlock" bigint NOT NULL,
        "registrationTimestamp" TIMESTAMP NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "deactivationBlock" bigint,
        "deactivationTimestamp" TIMESTAMP,
        "isFaulty" boolean NOT NULL DEFAULT false,
        "faultyBlock" bigint,
        "faultyTimestamp" TIMESTAMP,
        "recoveryBlock" bigint,
        "recoveryTimestamp" TIMESTAMP,
        "totalStaked" numeric(78,0) NOT NULL DEFAULT '0',
        "totalUnstaked" numeric(78,0) NOT NULL DEFAULT '0',
        "totalKeeperFeesEarned" numeric(78,0) NOT NULL DEFAULT '0',
        "nodeType" character varying,
        "isLive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_edge_nodes" PRIMARY KEY ("id")
      )
    `);

    // Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" SERIAL NOT NULL,
        "addressId" integer NOT NULL,
        "stfuelBalance" numeric(78,0) NOT NULL DEFAULT '0',
        "totalDeposited" numeric(78,0) NOT NULL DEFAULT '0',
        "totalWithdrawn" numeric(78,0) NOT NULL DEFAULT '0',
        "totalMinted" numeric(78,0) NOT NULL DEFAULT '0',
        "totalBurned" numeric(78,0) NOT NULL DEFAULT '0',
        "totalKeeperFeesEarned" numeric(78,0) NOT NULL DEFAULT '0',
        "totalReferralFeesEarned" numeric(78,0) NOT NULL DEFAULT '0',
        "totalEnteringFeesPaid" numeric(78,0) NOT NULL DEFAULT '0',
        "totalExitFeesPaid" numeric(78,0) NOT NULL DEFAULT '0',
        "creditsAvailable" numeric(78,0) NOT NULL DEFAULT '0',
        "firstActivityBlock" bigint,
        "firstActivityTimestamp" TIMESTAMP,
        "lastActivityBlock" bigint,
        "lastActivityTimestamp" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    // Create redemption_queue table
    await queryRunner.query(`
      CREATE TABLE "redemption_queue" (
        "id" SERIAL NOT NULL,
        "userAddressId" integer NOT NULL,
        "requestBlock" bigint NOT NULL,
        "requestTimestamp" TIMESTAMP NOT NULL,
        "stfuelAmountBurned" numeric(78,0) NOT NULL,
        "tfuelAmountExpected" numeric(78,0) NOT NULL,
        "keepersTipFee" numeric(78,0) NOT NULL,
        "unlockBlockNumber" bigint NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "claimBlock" bigint,
        "claimTimestamp" TIMESTAMP,
        "tfuelAmountClaimed" numeric(78,0),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_redemption_queue" PRIMARY KEY ("id")
      )
    `);

    // Create foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "edge_nodes" 
      ADD CONSTRAINT "FK_edge_nodes_addressId" 
      FOREIGN KEY ("addressId") REFERENCES "addresses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD CONSTRAINT "FK_users_addressId" 
      FOREIGN KEY ("addressId") REFERENCES "addresses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "redemption_queue" 
      ADD CONSTRAINT "FK_redemption_queue_userAddressId" 
      FOREIGN KEY ("userAddressId") REFERENCES "addresses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX "IDX_addresses_address" ON "addresses" ("address")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_edge_nodes_addressId" ON "edge_nodes" ("addressId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_edge_nodes_isActive" ON "edge_nodes" ("isActive")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_edge_nodes_isFaulty" ON "edge_nodes" ("isFaulty")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_users_addressId" ON "users" ("addressId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_redemption_queue_userAddressId" ON "redemption_queue" ("userAddressId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_redemption_queue_status" ON "redemption_queue" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_redemption_queue_unlockBlockNumber" ON "redemption_queue" ("unlockBlockNumber")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.query(`ALTER TABLE "redemption_queue" DROP CONSTRAINT "FK_redemption_queue_userAddressId"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_users_addressId"`);
    await queryRunner.query(`ALTER TABLE "edge_nodes" DROP CONSTRAINT "FK_edge_nodes_addressId"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "redemption_queue"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "edge_nodes"`);
    await queryRunner.query(`DROP TABLE "addresses"`);
  }
}
