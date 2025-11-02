import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create sync_state table
    await queryRunner.query(`
      CREATE TABLE "sync_state" (
        "id" SERIAL NOT NULL,
        "key" character varying NOT NULL,
        "lastBlockNumber" bigint NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_sync_state_key" UNIQUE ("key"),
        CONSTRAINT "PK_sync_state" PRIMARY KEY ("id")
      )
    `);

    // Create node_manager_events table
    await queryRunner.query(`
      CREATE TABLE "node_manager_events" (
        "id" SERIAL NOT NULL,
        "eventName" character varying NOT NULL,
        "blockNumber" bigint NOT NULL,
        "transactionHash" character varying NOT NULL,
        "transactionIndex" integer NOT NULL,
        "logIndex" integer NOT NULL,
        "timestamp" integer NOT NULL,
        "address" character varying NOT NULL,
        "args" jsonb,
        "data" text,
        "topics" text array,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_node_manager_events" PRIMARY KEY ("id")
      )
    `);

    // Create stfuel_events table
    await queryRunner.query(`
      CREATE TABLE "stfuel_events" (
        "id" SERIAL NOT NULL,
        "eventName" character varying NOT NULL,
        "blockNumber" bigint NOT NULL,
        "transactionHash" character varying NOT NULL,
        "transactionIndex" integer NOT NULL,
        "logIndex" integer NOT NULL,
        "timestamp" integer NOT NULL,
        "address" character varying NOT NULL,
        "args" jsonb,
        "data" text,
        "topics" text array,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_stfuel_events" PRIMARY KEY ("id")
      )
    `);

    // Create hourly_snapshots table
    await queryRunner.query(`
      CREATE TABLE "hourly_snapshots" (
        "id" SERIAL NOT NULL,
        "blockNumber" bigint NOT NULL,
        "snapshotTimestamp" integer NOT NULL,
        "tfuelBackingAmount" numeric(78,0) NOT NULL,
        "tfuelStakedAmount" numeric(78,0) NOT NULL,
        "stfuelTotalSupply" numeric(78,0) NOT NULL,
        "currentHoldersCount" integer NOT NULL,
        "historicalHoldersCount" integer NOT NULL,
        "totalReferralRewards" numeric(78,0) NOT NULL,
        "edgeNodesCount" integer NOT NULL,
        "totalKeeperTipsPaid" numeric(78,0) NOT NULL DEFAULT '0',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hourly_snapshots" PRIMARY KEY ("id")
      )
    `);

    // Create addresses table
    await queryRunner.query(`
      CREATE TABLE "addresses" (
        "id" SERIAL NOT NULL,
        "address" character varying(42) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_69b31ba33682e27f43b4754126a" UNIQUE ("address"),
        CONSTRAINT "PK_addresses" PRIMARY KEY ("id")
      )
    `);

    // Create edge_nodes table
    await queryRunner.query(`
      CREATE TABLE "edge_nodes" (
        "id" SERIAL NOT NULL,
        "addressId" integer NOT NULL,
        "registrationBlock" bigint NOT NULL,
        "registrationTimestamp" integer NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "deactivationBlock" bigint,
        "deactivationTimestamp" integer,
        "isFaulty" boolean NOT NULL DEFAULT false,
        "faultyBlock" bigint,
        "faultyTimestamp" integer,
        "recoveryBlock" bigint,
        "recoveryTimestamp" integer,
        "totalStaked" numeric(78,0) NOT NULL DEFAULT '0',
        "totalUnstaked" numeric(78,0) NOT NULL DEFAULT '0',
        "unstakeBlock" bigint,
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
        "firstActivityTimestamp" integer,
        "lastActivityBlock" bigint,
        "lastActivityTimestamp" integer,
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
        "requestTimestamp" integer NOT NULL,
        "stfuelAmountBurned" numeric(78,0) NOT NULL,
        "tfuelAmountExpected" numeric(78,0) NOT NULL,
        "keepersTipFee" numeric(78,0) NOT NULL,
        "unlockBlockNumber" bigint NOT NULL,
        "unlockTimestamp" integer,
        "queueIndex" bigint NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "creditedBlock" bigint,
        "creditedTimestamp" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_redemption_queue" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for node_manager_events
    await queryRunner.query(`
      CREATE INDEX "IDX_d8d9569a4eb69b911fa5f8d527" 
      ON "node_manager_events" ("blockNumber", "transactionIndex", "logIndex")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_a0559d14119d8b45fc10772f68" 
      ON "node_manager_events" ("eventName")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_95c8ac856c7e83142b0a2871b5" 
      ON "node_manager_events" ("address")
    `);

    // Create indexes for stfuel_events
    await queryRunner.query(`
      CREATE INDEX "IDX_4d207e8c2c3d98a7ca7a814652" 
      ON "stfuel_events" ("blockNumber", "transactionIndex", "logIndex")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_b25b67e91f2c2d8c0ee0e3d925" 
      ON "stfuel_events" ("eventName")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_1d1a36d350970826b92e5bcbba" 
      ON "stfuel_events" ("address")
    `);

    // Create indexes for hourly_snapshots
    await queryRunner.query(`
      CREATE INDEX "IDX_702202c79fbbab652007657dc5" 
      ON "hourly_snapshots" ("snapshotTimestamp")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_18298cfc71693e63cfe871e79e" 
      ON "hourly_snapshots" ("blockNumber")
    `);

    // Create indexes for addresses
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_69b31ba33682e27f43b4754126" 
      ON "addresses" ("address")
    `);

    // Create indexes for edge_nodes
    await queryRunner.query(`
      CREATE INDEX "IDX_edge_nodes_addressId" ON "edge_nodes" ("addressId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_edge_nodes_isActive" ON "edge_nodes" ("isActive")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_edge_nodes_isFaulty" ON "edge_nodes" ("isFaulty")
    `);

    // Create indexes for users
    await queryRunner.query(`
      CREATE INDEX "IDX_users_addressId" ON "users" ("addressId")
    `);

    // Create indexes for redemption_queue
    await queryRunner.query(`
      CREATE INDEX "IDX_redemption_queue_userAddressId" ON "redemption_queue" ("userAddressId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_redemption_queue_status" ON "redemption_queue" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_redemption_queue_unlockBlockNumber" ON "redemption_queue" ("unlockBlockNumber")
    `);

    // Create unique constraints
    await queryRunner.query(`
      ALTER TABLE "node_manager_events" 
      ADD CONSTRAINT "UQ_471aceff7eb96c4dea32ffd256b" 
      UNIQUE ("blockNumber", "transactionHash", "logIndex")
    `);
    await queryRunner.query(`
      ALTER TABLE "stfuel_events" 
      ADD CONSTRAINT "UQ_badc7ede703ac7f00d0df6adddb" 
      UNIQUE ("blockNumber", "transactionHash", "logIndex")
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

    // Insert initial sync state
    await queryRunner.query(`
      INSERT INTO "sync_state" ("key", "lastBlockNumber") 
      VALUES ('main', 0)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.query(`ALTER TABLE "redemption_queue" DROP CONSTRAINT "FK_redemption_queue_userAddressId"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_users_addressId"`);
    await queryRunner.query(`ALTER TABLE "edge_nodes" DROP CONSTRAINT "FK_edge_nodes_addressId"`);

    // Drop unique constraints
    await queryRunner.query(`ALTER TABLE "stfuel_events" DROP CONSTRAINT "UQ_badc7ede703ac7f00d0df6adddb"`);
    await queryRunner.query(`ALTER TABLE "node_manager_events" DROP CONSTRAINT "UQ_471aceff7eb96c4dea32ffd256b"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "redemption_queue"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "edge_nodes"`);
    await queryRunner.query(`DROP TABLE "addresses"`);
    await queryRunner.query(`DROP TABLE "hourly_snapshots"`);
    await queryRunner.query(`DROP TABLE "stfuel_events"`);
    await queryRunner.query(`DROP TABLE "node_manager_events"`);
    await queryRunner.query(`DROP TABLE "sync_state"`);
  }
}