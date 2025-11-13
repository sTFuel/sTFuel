import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { readFileSync } from 'fs';
import { join } from 'path';
import express from 'express';
import cors from 'cors';
import { Server } from 'http';
import { resolvers } from './resolvers';
import { config } from '../config/environment';

export class GraphQLServer {
  private server: ApolloServer;
  private app: express.Application;
  private httpServer: Server | null = null;
  private port: number;

  constructor() {
    this.port = config.port;
    this.app = express();
    
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

      // Configure CORS to allow requests from frontend
      // Supports both production (stfuel.com) and localhost for development
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://stfuel.com',
        'http://stfuel.com',
        'https://www.stfuel.com',
        'http://www.stfuel.com',
      ];

      this.app.use(
        '/graphql',
        cors({
          origin: allowedOrigins,
          credentials: true,
          methods: ['GET', 'POST', 'OPTIONS'],
          allowedHeaders: ['Content-Type', 'Authorization'],
        }),
        express.json(),
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
      });
    } catch (error) {
      console.error('Error starting GraphQL server:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
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
