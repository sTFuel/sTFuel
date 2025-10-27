import { DataSource } from 'typeorm';
import { config } from '../config/environment';
import { SyncState } from './entities/SyncState';
import { NodeManagerEvent } from './entities/NodeManagerEvent';
import { StfuelEvent } from './entities/StfuelEvent';
import { HourlySnapshot } from './entities/HourlySnapshot';
import { Address } from './entities/Address';
import { EdgeNode } from './entities/EdgeNode';
import { User } from './entities/User';
import { RedemptionQueue } from './entities/RedemptionQueue';

const AppDataSource = new DataSource({
  type: 'postgres',
  url: config.databaseUrl,
  entities: [SyncState, NodeManagerEvent, StfuelEvent, HourlySnapshot, Address, EdgeNode, User, RedemptionQueue],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false, // Use migrations instead
  logging: config.nodeEnv === 'development',
});

export default AppDataSource;
