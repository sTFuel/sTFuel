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
        "timestamp" TIMESTAMP NOT NULL,
        "address" character varying NOT NULL,
        "args" jsonb,
        "data" text,
        "topics" text array,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_node_manager_events" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for node_manager_events
    await queryRunner.query(`
      CREATE INDEX "IDX_node_manager_events_blockNumber_transactionIndex_logIndex" 
      ON "node_manager_events" ("blockNumber", "transactionIndex", "logIndex")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_node_manager_events_eventName" 
      ON "node_manager_events" ("eventName")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_node_manager_events_address" 
      ON "node_manager_events" ("address")
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
        "timestamp" TIMESTAMP NOT NULL,
        "address" character varying NOT NULL,
        "args" jsonb,
        "data" text,
        "topics" text array,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_stfuel_events" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for stfuel_events
    await queryRunner.query(`
      CREATE INDEX "IDX_stfuel_events_blockNumber_transactionIndex_logIndex" 
      ON "stfuel_events" ("blockNumber", "transactionIndex", "logIndex")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_stfuel_events_eventName" 
      ON "stfuel_events" ("eventName")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_stfuel_events_address" 
      ON "stfuel_events" ("address")
    `);

    // Create hourly_snapshots table
    await queryRunner.query(`
      CREATE TABLE "hourly_snapshots" (
        "id" SERIAL NOT NULL,
        "blockNumber" bigint NOT NULL,
        "snapshotTimestamp" TIMESTAMP NOT NULL,
        "tfuelBackingAmount" numeric(78,0) NOT NULL,
        "tfuelStakedAmount" numeric(78,0) NOT NULL,
        "stfuelTotalSupply" numeric(78,0) NOT NULL,
        "currentHoldersCount" integer NOT NULL,
        "historicalHoldersCount" integer NOT NULL,
        "totalReferralRewards" numeric(78,0) NOT NULL,
        "edgeNodesCount" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hourly_snapshots" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for hourly_snapshots
    await queryRunner.query(`
      CREATE INDEX "IDX_hourly_snapshots_snapshotTimestamp" 
      ON "hourly_snapshots" ("snapshotTimestamp")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_hourly_snapshots_blockNumber" 
      ON "hourly_snapshots" ("blockNumber")
    `);

    // Insert initial sync state
    await queryRunner.query(`
      INSERT INTO "sync_state" ("key", "lastBlockNumber") 
      VALUES ('main', 0)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "hourly_snapshots"`);
    await queryRunner.query(`DROP TABLE "stfuel_events"`);
    await queryRunner.query(`DROP TABLE "node_manager_events"`);
    await queryRunner.query(`DROP TABLE "sync_state"`);
  }
}
