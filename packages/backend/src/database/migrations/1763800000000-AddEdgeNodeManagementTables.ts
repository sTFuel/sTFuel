import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEdgeNodeManagementTables1763800000000 implements MigrationInterface {
  name = 'AddEdgeNodeManagementTables1763800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create servers table
    await queryRunner.query(`
      CREATE TABLE "servers" (
        "id" SERIAL NOT NULL,
        "ipAddress" character varying NOT NULL,
        "isHealthy" boolean NOT NULL DEFAULT false,
        "maxEdgeNodes" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_servers_ipAddress" UNIQUE ("ipAddress"),
        CONSTRAINT "PK_servers" PRIMARY KEY ("id")
      )
    `);

    // Create index on ipAddress
    await queryRunner.query(`CREATE INDEX "IDX_servers_ipAddress" ON "servers" ("ipAddress")`);

    // Create managed_nodes table
    await queryRunner.query(`
      CREATE TABLE "managed_nodes" (
        "id" SERIAL NOT NULL,
        "addressId" integer NOT NULL,
        "serverId" integer NOT NULL,
        "nodeId" character varying NOT NULL,
        "keystore" jsonb,
        "summary" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_managed_nodes_addressId" UNIQUE ("addressId"),
        CONSTRAINT "PK_managed_nodes" PRIMARY KEY ("id")
      )
    `);

    // Create indexes on managed_nodes
    await queryRunner.query(`CREATE INDEX "IDX_managed_nodes_addressId" ON "managed_nodes" ("addressId")`);
    await queryRunner.query(`CREATE INDEX "IDX_managed_nodes_serverId" ON "managed_nodes" ("serverId")`);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "managed_nodes"
      ADD CONSTRAINT "FK_managed_nodes_addressId"
      FOREIGN KEY ("addressId") REFERENCES "addresses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "managed_nodes"
      ADD CONSTRAINT "FK_managed_nodes_serverId"
      FOREIGN KEY ("serverId") REFERENCES "servers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Create admin_users table
    await queryRunner.query(`
      CREATE TABLE "admin_users" (
        "id" SERIAL NOT NULL,
        "username" character varying NOT NULL,
        "passwordHash" character varying NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_admin_users_username" UNIQUE ("username"),
        CONSTRAINT "PK_admin_users" PRIMARY KEY ("id")
      )
    `);

    // Create index on username
    await queryRunner.query(`CREATE INDEX "IDX_admin_users_username" ON "admin_users" ("username")`);

    // Create admin_sessions table
    await queryRunner.query(`
      CREATE TABLE "admin_sessions" (
        "id" SERIAL NOT NULL,
        "adminUserId" integer NOT NULL,
        "sessionToken" character varying NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_admin_sessions_sessionToken" UNIQUE ("sessionToken"),
        CONSTRAINT "PK_admin_sessions" PRIMARY KEY ("id")
      )
    `);

    // Create indexes on admin_sessions
    await queryRunner.query(`CREATE INDEX "IDX_admin_sessions_sessionToken" ON "admin_sessions" ("sessionToken")`);
    await queryRunner.query(`CREATE INDEX "IDX_admin_sessions_adminUserId" ON "admin_sessions" ("adminUserId")`);

    // Add foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "admin_sessions"
      ADD CONSTRAINT "FK_admin_sessions_adminUserId"
      FOREIGN KEY ("adminUserId") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.query(`ALTER TABLE "admin_sessions" DROP CONSTRAINT "FK_admin_sessions_adminUserId"`);
    await queryRunner.query(`ALTER TABLE "managed_nodes" DROP CONSTRAINT "FK_managed_nodes_serverId"`);
    await queryRunner.query(`ALTER TABLE "managed_nodes" DROP CONSTRAINT "FK_managed_nodes_addressId"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "admin_sessions"`);
    await queryRunner.query(`DROP TABLE "admin_users"`);
    await queryRunner.query(`DROP TABLE "managed_nodes"`);
    await queryRunner.query(`DROP TABLE "servers"`);
  }
}

