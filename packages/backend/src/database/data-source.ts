import { DataSource } from 'typeorm';
import { join } from 'path';
import { config } from '../config/environment';
import { SyncState } from './entities/SyncState';
import { NodeManagerEvent } from './entities/NodeManagerEvent';
import { StfuelEvent } from './entities/StfuelEvent';
import { HourlySnapshot } from './entities/HourlySnapshot';
import { Address } from './entities/Address';
import { EdgeNode } from './entities/EdgeNode';
import { User } from './entities/User';
import { RedemptionQueue } from './entities/RedemptionQueue';

// Determine migrations path based on whether we're running compiled code or source
// __dirname will be dist/database when running compiled, src/database when using ts-node
const isCompiled = __dirname.includes('dist');
const migrationsPath = isCompiled 
  ? join(__dirname, 'migrations', '*.js')
  : join(__dirname, 'migrations', '*.ts');

const AppDataSource = new DataSource({
  type: 'postgres',
  url: config.databaseUrl,
  entities: [SyncState, NodeManagerEvent, StfuelEvent, HourlySnapshot, Address, EdgeNode, User, RedemptionQueue],
  migrations: [migrationsPath],
  synchronize: false, // Use migrations instead
  logging: config.nodeEnv === 'development',
  extra: {
    // Set timezone to UTC for all database operations
    timezone: 'UTC'
  }
});

export default AppDataSource;
