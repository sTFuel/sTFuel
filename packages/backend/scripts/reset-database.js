const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

async function resetDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/stfuel_tracker'
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Get list of all tables
    const tablesResult = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename NOT LIKE 'pg_%'
      AND tablename != 'migrations'
    `);
    
    const tables = tablesResult.rows.map(row => row.tablename);
    console.log('Found tables:', tables);

    if (tables.length === 0) {
      console.log('No tables found to drop');
      return;
    }

    // Drop all tables with CASCADE to handle foreign key constraints
    console.log('\nDropping all tables...');
    for (const table of tables) {
      try {
        await client.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
        console.log(`✓ Dropped table: ${table}`);
      } catch (error) {
        console.error(`✗ Failed to drop table ${table}:`, error.message);
      }
    }

    // Drop the migrations table as well
    try {
      await client.query('DROP TABLE IF EXISTS migrations CASCADE');
      console.log('✓ Dropped migrations table');
    } catch (error) {
      console.error('✗ Failed to drop migrations table:', error.message);
    }

    // Drop any sequences that might be left
    const sequencesResult = await client.query(`
      SELECT sequencename 
      FROM pg_sequences 
      WHERE schemaname = 'public'
    `);
    
    for (const seq of sequencesResult.rows) {
      try {
        await client.query(`DROP SEQUENCE IF EXISTS "${seq.sequencename}" CASCADE`);
        console.log(`✓ Dropped sequence: ${seq.sequencename}`);
      } catch (error) {
        console.error(`✗ Failed to drop sequence ${seq.sequencename}:`, error.message);
      }
    }

    // Drop any enums that might be left
    const enumsResult = await client.query(`
      SELECT typname 
      FROM pg_type 
      WHERE typtype = 'e' 
      AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    `);
    
    for (const enumType of enumsResult.rows) {
      try {
        await client.query(`DROP TYPE IF EXISTS "${enumType.typname}" CASCADE`);
        console.log(`✓ Dropped enum: ${enumType.typname}`);
      } catch (error) {
        console.error(`✗ Failed to drop enum ${enumType.typname}:`, error.message);
      }
    }

    console.log('\n✅ Database reset completed successfully!');
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

// Add confirmation prompt
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('⚠️  This will DELETE ALL DATA in your database. Are you sure? (type "yes" to confirm): ', (answer) => {
  if (answer.toLowerCase() === 'yes') {
    resetDatabase();
  } else {
    console.log('Operation cancelled.');
  }
  rl.close();
});
