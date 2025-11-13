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

      // CORS handling strategy:
      // - Production: nginx handles CORS (don't add CORS middleware here to avoid duplicates)
      // - Development: Express handles CORS (no nginx in front)
      const isProduction = config.nodeEnv === 'production';
      
      const middleware: any[] = [express.json()];
      
      // Only add CORS middleware in development
      if (!isProduction) {
        middleware.unshift(cors({
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
          allowedHeaders: ['Content-Type', 'Authorization'],
        }));
      }
      
      this.app.use(
        '/graphql',
        ...middleware,
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
