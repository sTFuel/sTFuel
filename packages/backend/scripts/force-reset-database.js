const { Client } = require('pg');

// Load environment variables
require('dotenv').config();

async function forceResetDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/stfuel_tracker'
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Drop all tables in the public schema
    console.log('Dropping all tables...');
    await client.query(`
      DO $$ 
      DECLARE 
          r RECORD;
      BEGIN
          -- Drop all tables
          FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
          LOOP
              EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
          END LOOP;
          
          -- Drop all sequences
          FOR r IN (SELECT sequencename FROM pg_sequences WHERE schemaname = 'public') 
          LOOP
              EXECUTE 'DROP SEQUENCE IF EXISTS ' || quote_ident(r.sequencename) || ' CASCADE';
          END LOOP;
          
          -- Drop all enums
          FOR r IN (SELECT typname FROM pg_type WHERE typtype = 'e' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) 
          LOOP
              EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.typname) || ' CASCADE';
          END LOOP;
      END $$;
    `);

    console.log('✅ Database reset completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Run: npm run migration:run');
    console.log('2. Start your blockchain scanner from the beginning');

  } catch (error) {
    console.error('Error resetting database:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

forceResetDatabase();

