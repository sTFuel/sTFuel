import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Blockchain
  thetaRpcUrls: process.env.THETA_RPC_URLS?.split(',') || [
    // 'https://eth-rpc-api.thetatoken.org/rpc',
    'https://eth-rpc-api-testnet.thetatoken.org/rpc'
  ],
  nodeManagerAddress: process.env.NODE_MANAGER_ADDRESS || '',
  stfuelAddress: process.env.STFUEL_ADDRESS || '',
  startBlock: parseInt(process.env.START_BLOCK || '0'),

  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/stfuel_tracker',

  // Server
  port: parseInt(process.env.PORT || '4000'),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // RPC Configuration
  rpcRetryAttempts: parseInt(process.env.RPC_RETRY_ATTEMPTS || '3'),
  rpcRetryDelay: parseInt(process.env.RPC_RETRY_DELAY || '5000'),
  rpcTimeout: parseInt(process.env.RPC_TIMEOUT || '30000'),
  
  // Block Scanner Configuration
  batchSize: parseInt(process.env.BATCH_SIZE || '10'),
  maxConcurrentBatches: parseInt(process.env.MAX_CONCURRENT_BATCHES || '3'),
  batchDelay: parseInt(process.env.BATCH_DELAY || '100'),

  // Edge Node Management
  edgeNodeManagerApiKey: process.env.EDGE_NODE_MANAGER_API_KEY || '',
  sessionSecret: process.env.SESSION_SECRET || 'change-me-in-production',
  sessionExpiryHours: parseInt(process.env.SESSION_EXPIRY_HOURS || '24'),
};

export default config;
