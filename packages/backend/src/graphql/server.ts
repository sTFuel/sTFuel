import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { readFileSync } from 'fs';
import { join } from 'path';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Server } from 'http';
import { resolvers } from './resolvers';
import { config } from '../config/environment';
import adminRoutes from '../api/adminRoutes';
import { ServerHealthService } from '../services/ServerHealthService';

export class GraphQLServer {
  private server: ApolloServer;
  private app: express.Application;
  private httpServer: Server | null = null;
  private port: number;
  private serverHealthService: ServerHealthService;

  constructor() {
    this.port = config.port;
    this.app = express();
    this.serverHealthService = new ServerHealthService();
    
    // Read GraphQL schema
    const typeDefs = readFileSync(join(__dirname, 'schema.graphql'), 'utf8');

    this.server = new ApolloServer({
      typeDefs,
      resolvers,
      introspection: config.nodeEnv === 'development',
    });
  }

  async start(): Promise<void> {
    try {
      await this.server.start();

      // CORS handling strategy:
      // - Production: nginx handles CORS (don't add CORS middleware here to avoid duplicates)
      // - Development: Express handles CORS (no nginx in front)
      const isProduction = config.nodeEnv === 'production';
      
      // Add cookie parser for session management
      this.app.use(cookieParser());
      
      // Add JSON body parser
      this.app.use(express.json());
      
      // Only add CORS middleware in development
      if (!isProduction) {
        this.app.use(cors({
          origin: [
            'http://localhost:3000',
            'http://localhost:3001',
            'https://stfuel.com',
            'http://stfuel.com',
            'https://www.stfuel.com',
            'http://www.stfuel.com',
          ],
          credentials: true,
          methods: ['GET', 'POST', 'OPTIONS'],
          allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-session'],
        }));
      }
      
      // Admin API routes
      this.app.use('/api/admin', adminRoutes);
      
      // GraphQL endpoint
      this.app.use(
        '/graphql',
        expressMiddleware(this.server, {
          context: async ({ req }) => {
            return { req };
          },
        })
      );

      // Start the Express server
      this.httpServer = this.app.listen(this.port, () => {
        const url = `http://localhost:${this.port}`;
        console.log(`🚀 GraphQL Server ready at ${url}/graphql`);
        console.log(`📊 GraphQL Playground available at ${url}/graphql`);
        console.log(`🔐 Admin API available at ${url}/api/admin`);
      });

      // Start periodic server health checks (every 5 minutes)
      this.serverHealthService.startPeriodicHealthChecks(5);
    } catch (error) {
      console.error('Error starting GraphQL server:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      // Stop health checks
      this.serverHealthService.stopPeriodicHealthChecks();
      
      const server = this.httpServer;
      if (server) {
        await new Promise<void>((resolve) => {
          server.close(() => {
            console.log('HTTP server closed');
            resolve();
          });
        });
      }
      await this.server.stop();
      console.log('GraphQL Server stopped');
    } catch (error) {
      console.error('Error stopping GraphQL server:', error);
    }
  }
}

export default GraphQLServer;
