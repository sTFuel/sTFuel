import AppDataSource from '../database/data-source';
import { Server } from '../database/entities/Server';
import { EdgeNodeManagerService } from './EdgeNodeManagerService';

export class ServerHealthService {
  private edgeNodeManager: EdgeNodeManagerService;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.edgeNodeManager = new EdgeNodeManagerService();
  }

  async checkServerHealth(serverId: number): Promise<boolean> {
    const serverRepo = AppDataSource.getRepository(Server);
    const server = await serverRepo.findOne({ where: { id: serverId } });

    if (!server) {
      return false;
    }

    const isHealthy = await this.edgeNodeManager.checkServerHealth(server.ipAddress);
    
    if (server.isHealthy !== isHealthy) {
      server.isHealthy = isHealthy;
      await serverRepo.save(server);
    }

    return isHealthy;
  }

  async checkAllServers(): Promise<void> {
    const serverRepo = AppDataSource.getRepository(Server);
    const servers = await serverRepo.find();

    for (const server of servers) {
      try {
        const isHealthy = await this.edgeNodeManager.checkServerHealth(server.ipAddress);
        if (server.isHealthy !== isHealthy) {
          server.isHealthy = isHealthy;
          await serverRepo.save(server);
        }
      } catch (error) {
        console.error(`Error checking health for server ${server.ipAddress}:`, error);
        if (server.isHealthy) {
          server.isHealthy = false;
          await serverRepo.save(server);
        }
      }
    }
  }

  startPeriodicHealthChecks(intervalMinutes: number = 5): void {
    if (this.healthCheckInterval) {
      this.stopPeriodicHealthChecks();
    }

    // Run immediately
    this.checkAllServers();

    // Then run periodically
    this.healthCheckInterval = setInterval(() => {
      this.checkAllServers();
    }, intervalMinutes * 60 * 1000);
  }

  stopPeriodicHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

