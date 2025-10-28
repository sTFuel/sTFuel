import { ethers } from 'ethers';
import { Repository, QueryRunner } from 'typeorm';
import AppDataSource from '../database/data-source';
import { SyncState } from '../database/entities/SyncState';
import { ContractManager } from '../contracts/contracts';
import { EventProcessor } from './EventProcessor';
import { SnapshotService } from '../services/SnapshotService';
import NormalizedEventProcessor from '../services/NormalizedEventProcessor';
import { config } from '../config/environment';

export class BlockScanner {
  private provider: ethers.JsonRpcProvider;
  private nodeManagerContract: ethers.Contract;
  private stfuelContract: ethers.Contract;
  private syncStateRepo: Repository<SyncState>;
  private eventProcessor: EventProcessor;
  private normalizedEventProcessor: NormalizedEventProcessor;
  private snapshotService: SnapshotService;
  private isRunning: boolean = false;
  private currentBlockNumber: number = 0;

  constructor() {
    const contractManager = new ContractManager();
    this.provider = contractManager.getProvider();
    this.nodeManagerContract = contractManager.getNodeManagerContract();
    this.stfuelContract = contractManager.getStfuelContract();
    this.syncStateRepo = AppDataSource.getRepository(SyncState);
    this.eventProcessor = new EventProcessor();
    this.normalizedEventProcessor = new NormalizedEventProcessor();
    this.snapshotService = new SnapshotService();
  }

  async start(): Promise<void> {
    console.log('Starting block scanner...');
    this.isRunning = true;

    // Initialize from last synced block or start block
    await this.initializeSyncState();

    // Start scanning loop
    this.scanLoop();
  }

  async stop(): Promise<void> {
    console.log('Stopping block scanner...');
    this.isRunning = false;
    
    // Save current block state
    if (this.currentBlockNumber > 0) {
      await this.updateSyncState(this.currentBlockNumber);
    }
  }

  private async initializeSyncState(): Promise<void> {
    try {
      const syncState = await this.syncStateRepo.findOne({ where: { key: 'main' } });
      
      if (syncState) {
        this.currentBlockNumber = parseInt(syncState.lastBlockNumber) + 1;
        console.log(`Resuming from block ${this.currentBlockNumber}`);
      } else {
        this.currentBlockNumber = config.startBlock;
        console.log(`Starting from block ${this.currentBlockNumber}`);
      }
    } catch (error) {
      console.error('Error initializing sync state:', error);
      this.currentBlockNumber = config.startBlock;
    }
  }

  private async scanLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        const latestBlock = await this.getLatestBlockWithRetry();
        
        if (this.currentBlockNumber <= latestBlock) {
          await this.scanBlock(this.currentBlockNumber);
          this.currentBlockNumber++;
          
          // Update sync state every 10 blocks
          if (this.currentBlockNumber % 10 === 0) {
            await this.updateSyncState(this.currentBlockNumber - 1);
          }
        } else {
          // Wait for new blocks
          await this.sleep(5000); // 5 seconds
        }
      } catch (error) {
        console.error('Error in scan loop:', error);
        await this.sleep(10000); // Wait 10 seconds before retrying
      }
    }
  }

  private async getLatestBlockWithRetry(): Promise<number> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.provider.getBlockNumber();
      } catch (error: any) {
        lastError = error;
        console.warn(`Failed to get latest block (attempt ${attempt + 1}):`, error.message);
        
        if (attempt < 2) {
          await this.sleep(5000); // Wait 5 seconds before retry
        }
      }
    }
    
    throw new Error(`Failed to get latest block after 3 attempts. Last error: ${lastError?.message}`);
  }

  private async scanBlock(blockNumber: number): Promise<void> {
    try {
      console.log(`Scanning block ${blockNumber}`);
      
      const block = await this.getBlockWithRetry(blockNumber);
      if (!block) {
        console.warn(`Block ${blockNumber} not found`);
        return;
      }

      // Get logs for the block
      const logs = await this.getLogsWithRetry(blockNumber);

      // Filter logs for our contracts
      const nodeManagerAddress = this.nodeManagerContract.target?.toString().toLowerCase();
      const stfuelAddress = this.stfuelContract.target?.toString().toLowerCase();
      
      if (logs.length > 0) {
        console.log(`Total logs in block: ${logs.length}`);
      }

      const nodeManagerLogs = logs.filter((log: any) => 
        log.address.toLowerCase() === nodeManagerAddress
      );

      const stfuelLogs = logs.filter((log: any) => 
        log.address.toLowerCase() === stfuelAddress
      );

      // Check if we need to create a snapshot (based on block timestamp) - ALWAYS check, regardless of events
      await this.snapshotService.checkAndCreateSnapshot(blockNumber, block.timestamp);

      // Skip event processing if no relevant events found
      if (nodeManagerLogs.length === 0 && stfuelLogs.length === 0) {
        return;
      }

      // Process events within a database transaction
      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // Parse and save events to database
        let nodeManagerResult: { events: any[], wasNew: boolean } = { events: [], wasNew: false };
        let stfuelResult: { events: any[], wasNew: boolean } = { events: [], wasNew: false };

        if (nodeManagerLogs.length > 0) {
          nodeManagerResult = await this.eventProcessor.processNodeManagerEvents(nodeManagerLogs, queryRunner);
          console.log(`Processed ${nodeManagerLogs.length} NodeManager events`);
        }

        if (stfuelLogs.length > 0) {
          stfuelResult = await this.eventProcessor.processStfuelEvents(stfuelLogs, queryRunner);
          console.log(`Processed ${stfuelLogs.length} sTFuel events`);
        }

        // Only process normalized events if we have new events (not duplicates)
        if (nodeManagerResult.wasNew || stfuelResult.wasNew) {
          await this.processNormalizedEvents(nodeManagerResult.events, stfuelResult.events, blockNumber, queryRunner);
          console.log(`Processed normalized events for block ${blockNumber}`);
        } else {
          console.log(`Block ${blockNumber} already processed, skipping normalized event processing`);
        }

        // Commit the transaction
        await queryRunner.commitTransaction();
      } catch (error) {
        // Rollback the transaction on error
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        // Release the query runner
        await queryRunner.release();
      }

    } catch (error) {
      console.error(`Error scanning block ${blockNumber}:`, error);
      throw error;
    }
  }

  private async getBlockWithRetry(blockNumber: number): Promise<any> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.provider.getBlock(blockNumber, true);
      } catch (error: any) {
        lastError = error;
        console.warn(`Failed to get block ${blockNumber} (attempt ${attempt + 1}):`, error.message);
        
        if (attempt < 2) {
          await this.sleep(2000); // Wait 2 seconds before retry
        }
      }
    }
    
    throw new Error(`Failed to get block ${blockNumber} after 3 attempts. Last error: ${lastError?.message}`);
  }

  private async getLogsWithRetry(blockNumber: number): Promise<any[]> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.provider.getLogs({
          fromBlock: blockNumber,
          toBlock: blockNumber,
        });
      } catch (error: any) {
        lastError = error;
        console.warn(`Failed to get logs for block ${blockNumber} (attempt ${attempt + 1}):`, error.message);
        
        if (attempt < 2) {
          await this.sleep(2000); // Wait 2 seconds before retry
        }
      }
    }
    
    throw new Error(`Failed to get logs for block ${blockNumber} after 3 attempts. Last error: ${lastError?.message}`);
  }

  private async updateSyncState(blockNumber: number): Promise<void> {
    try {
      await this.syncStateRepo.upsert(
        {
          key: 'main',
          lastBlockNumber: blockNumber.toString(),
        },
        ['key']
      );
      console.log(`Updated sync state to block ${blockNumber}`);
    } catch (error) {
      console.error('Error updating sync state:', error);
    }
  }

  private async processNormalizedEvents(nodeManagerEvents: any[], stfuelEvents: any[], blockNumber: number, queryRunner?: QueryRunner): Promise<void> {
    try {
      // Process NodeManager events directly from parsed events
      for (const event of nodeManagerEvents) {
        try {
          await this.normalizedEventProcessor.processNodeManagerEvent(event, queryRunner);
        } catch (error) {
          console.error(`Error processing normalized NodeManager event:`, error);
          // Continue processing other events
        }
      }

      // Process sTFuel events directly from parsed events
      for (const event of stfuelEvents) {
        try {
          await this.normalizedEventProcessor.processStfuelEvent(event, queryRunner);
        } catch (error) {
          console.error(`Error processing normalized sTFuel event:`, error);
          // Continue processing other events
        }
      }

      if (nodeManagerEvents.length > 0 || stfuelEvents.length > 0) {
        console.log(`Processed ${nodeManagerEvents.length} normalized NodeManager events and ${stfuelEvents.length} normalized sTFuel events for block ${blockNumber}`);
      }
    } catch (error) {
      console.error(`Error processing normalized events for block ${blockNumber}:`, error);
      // Don't throw - we want to continue scanning even if normalized processing fails
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getCurrentBlockNumber(): number {
    return this.currentBlockNumber;
  }

  isScannerRunning(): boolean {
    return this.isRunning;
  }
}

export default BlockScanner;
