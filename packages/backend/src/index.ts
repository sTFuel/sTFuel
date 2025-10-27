import 'reflect-metadata';
import AppDataSource from './database/data-source';
import { BlockScanner } from './scanner/BlockScanner';
import { GraphQLServer } from './graphql/server';
import { config } from './config/environment';
import winston from 'winston';

// Configure logger
const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'stfuel-tracker' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

class Application {
  private blockScanner: BlockScanner;
  private graphqlServer: GraphQLServer;
  private isShuttingDown: boolean = false;

  constructor() {
    this.blockScanner = new BlockScanner();
    this.graphqlServer = new GraphQLServer();
  }

  async start(): Promise<void> {
    try {
      logger.info('Starting Theta Blockchain Event Tracker...');

      // Initialize database connection
      logger.info('Connecting to database...');
      await AppDataSource.initialize();
      logger.info('Database connected successfully');

      // Run migrations
      logger.info('Running database migrations...');
      await AppDataSource.runMigrations();
      logger.info('Database migrations completed');

      // Start GraphQL server
      logger.info('Starting GraphQL server...');
      await this.graphqlServer.start();

      // Start block scanner
      logger.info('Starting block scanner...');
      await this.blockScanner.start();

      logger.info('✅ Application started successfully');
      logger.info(`📊 GraphQL API available at http://localhost:${config.port}`);
      logger.info(`🔍 Scanning Theta blockchain from block ${config.startBlock}`);

      // Setup graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      logger.error('Failed to start application:', error);
      process.exit(1);
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) {
        logger.warn('Shutdown already in progress...');
        return;
      }

      this.isShuttingDown = true;
      logger.info(`Received ${signal}. Starting graceful shutdown...`);

      try {
        // Stop block scanner
        logger.info('Stopping block scanner...');
        await this.blockScanner.stop();

        // Stop GraphQL server
        logger.info('Stopping GraphQL server...');
        await this.graphqlServer.stop();

        // Close database connection
        logger.info('Closing database connection...');
        await AppDataSource.destroy();

        logger.info('✅ Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    // Handle different termination signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      shutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });
  }

  async stop(): Promise<void> {
    logger.info('Stopping application...');
    
    try {
      await this.blockScanner.stop();
      await this.graphqlServer.stop();
      await AppDataSource.destroy();
      logger.info('Application stopped successfully');
    } catch (error) {
      logger.error('Error stopping application:', error);
      throw error;
    }
  }
}

// Start the application
const app = new Application();

// Handle module hot reloading in development
if (typeof module !== 'undefined' && (module as any).hot) {
  (module as any).hot.accept();
  (module as any).hot.dispose(() => {
    app.stop();
  });
}

// Start the application
app.start().catch((error) => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});

export default Application;
