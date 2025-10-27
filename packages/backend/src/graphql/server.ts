import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { readFileSync } from 'fs';
import { join } from 'path';
import { resolvers } from './resolvers';
import { config } from '../config/environment';
import { GraphQLScalarType } from 'graphql';

export class GraphQLServer {
  private server: ApolloServer;
  private port: number;

  constructor() {
    this.port = config.port;
    
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
      const { url } = await startStandaloneServer(this.server, {
        listen: { port: this.port },
      });
      
      console.log(`🚀 GraphQL Server ready at ${url}`);
      console.log(`📊 GraphQL Playground available at ${url}`);
    } catch (error) {
      console.error('Error starting GraphQL server:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      await this.server.stop();
      console.log('GraphQL Server stopped');
    } catch (error) {
      console.error('Error stopping GraphQL server:', error);
    }
  }
}

export default GraphQLServer;
