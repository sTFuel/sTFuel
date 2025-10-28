import { Repository } from 'typeorm';
import AppDataSource from '../database/data-source';
import { HourlySnapshot } from '../database/entities/HourlySnapshot';
import { NodeManagerEvent } from '../database/entities/NodeManagerEvent';
import { StfuelEvent } from '../database/entities/StfuelEvent';
import { ContractManager } from '../contracts/contracts';

export class SnapshotService {
  private snapshotRepo: Repository<HourlySnapshot>;
  private nodeManagerEventRepo: Repository<NodeManagerEvent>;
  private stfuelEventRepo: Repository<StfuelEvent>;
  private contractManager: ContractManager;
  private nextSnapshotTime: number | null = null; // Unix timestamp of next snapshot

  constructor() {
    this.snapshotRepo = AppDataSource.getRepository(HourlySnapshot);
    this.nodeManagerEventRepo = AppDataSource.getRepository(NodeManagerEvent);
    this.stfuelEventRepo = AppDataSource.getRepository(StfuelEvent);
    this.contractManager = new ContractManager();
  }

  async checkAndCreateSnapshot(blockNumber: number, blockTimestamp: number): Promise<void> {
    // If we don't have the next snapshot time set, initialize it
    if (this.nextSnapshotTime === null) {
      await this.initializeNextSnapshotTime();
    }

    // Check if it's time for a snapshot
    if (blockTimestamp >= this.nextSnapshotTime!) {
      const blockDate = new Date(blockTimestamp * 1000);
      console.log(`Creating snapshot for block ${blockNumber} at ${blockDate.toISOString()}`);
      
      await this.createSnapshot(blockNumber, blockDate);
      
      // Set next snapshot time to next full hour
      this.setNextSnapshotTime(blockTimestamp);
    } else {
      // Optional: Log every 100 blocks to show efficiency (remove in production)
      if (blockNumber % 100 === 0) {
        const nextSnapshotDate = new Date(this.nextSnapshotTime! * 1000);
        console.log(`Block ${blockNumber}: Next snapshot at ${nextSnapshotDate.toISOString()}`);
      }
    }
  }

  private async initializeNextSnapshotTime(): Promise<void> {
    const lastSnapshot = await this.getLatestSnapshot();
    
    if (lastSnapshot) {
      // If we have a last snapshot, set next snapshot to next full hour from current time
      // This ensures we don't get stuck in the past if the service was restarted
      const currentTime = Math.floor(Date.now() / 1000);
      this.setNextSnapshotTime(currentTime);
      console.log(`Initialized next snapshot time: ${new Date(this.nextSnapshotTime! * 1000).toISOString()}`);
    } else {
      // No snapshots exist yet, create snapshot immediately and set next time
      console.log('No existing snapshots found, will create first snapshot on next block');
      this.nextSnapshotTime = 0; // Will trigger snapshot on next block
    }
  }

  private setNextSnapshotTime(currentTimestamp: number): void {
    const currentDate = new Date(currentTimestamp * 1000);
    
    // Get next full hour
    const nextHour = new Date(currentDate);
    nextHour.setUTCHours(currentDate.getUTCHours() + 1, 0, 0, 0); // Next hour at :00:00
    
    this.nextSnapshotTime = Math.floor(nextHour.getTime() / 1000);
    console.log(`Next snapshot scheduled for: ${nextHour.toISOString()}`);
  }

  private async createSnapshot(blockNumber: number, timestamp: Date): Promise<void> {
    try {
      console.log(`Creating snapshot for block ${blockNumber} at ${timestamp.toISOString()}`);

      // Calculate all metrics from events
      const metrics = await this.calculateMetrics(blockNumber);

      // For TFuel backing amount, check if we're live or use CurrentNetAssets events
      let tfuelBackingAmount: bigint;
      try {
        // Check if we're at the latest block (within 10 blocks of current)
        const latestBlock = await this.contractManager.getProvider().getBlockNumber();
        const isLive = (latestBlock - blockNumber) <= 10;
        
        if (isLive) {
          // Use contract calls for live data
          try {
            tfuelBackingAmount = await this.contractManager.getTfuelBackingAmount(blockNumber, true);
          } catch (error) {
            // Fallback to safe method
            try {
              tfuelBackingAmount = await this.contractManager.getTfuelBackingAmount(blockNumber, false);
            } catch (fallbackError) {
              console.warn(`Both contract methods failed for block ${blockNumber}, using CurrentNetAssets event`);
              tfuelBackingAmount = await this.getTfuelBackingFromCurrentNetAssets(blockNumber);
            }
          }
        } else {
          // Use CurrentNetAssets events for historical data
          tfuelBackingAmount = await this.getTfuelBackingFromCurrentNetAssets(blockNumber);
        }
      } catch (error: any) {
        console.warn(`TFuel backing amount unavailable for block ${blockNumber}:`, error.message);
        tfuelBackingAmount = BigInt(0);
      }

      // Create snapshot
      const snapshot = new HourlySnapshot();
      snapshot.blockNumber = blockNumber.toString();
      snapshot.snapshotTimestamp = timestamp;
      snapshot.tfuelBackingAmount = tfuelBackingAmount.toString();
      snapshot.tfuelStakedAmount = metrics.tfuelStakedAmount.toString();
      snapshot.stfuelTotalSupply = metrics.stfuelTotalSupply.toString();
      snapshot.currentHoldersCount = metrics.currentHoldersCount;
      snapshot.historicalHoldersCount = metrics.historicalHoldersCount;
      snapshot.totalReferralRewards = metrics.totalReferralRewards.toString();
      snapshot.edgeNodesCount = metrics.edgeNodesCount;
      snapshot.totalKeeperTipsPaid = metrics.totalKeeperTipsPaid.toString();

      await this.snapshotRepo.save(snapshot);
      console.log(`Snapshot created for block ${blockNumber}`);

    } catch (error) {
      console.error('Error creating snapshot:', error);
    }
  }

  private async calculateMetrics(blockNumber: number): Promise<{
    tfuelStakedAmount: bigint;
    stfuelTotalSupply: bigint;
    currentHoldersCount: number;
    historicalHoldersCount: number;
    totalReferralRewards: bigint;
    edgeNodesCount: number;
    totalKeeperTipsPaid: bigint;
  }> {
    try {
      // Calculate TFuel staked amount: Σ(TFuelStaked.amount) - Σ(TFuelUnstaked.amount)
      const tfuelStakedAmount = await this.calculateTfuelStakedAmount(blockNumber);

      // Calculate sTFuel total supply: + Minted.sharesOut + ReferralRewarded.rewardShares - BurnQueued.amount - BurnAndDirectRedeemed.amount
      const stfuelTotalSupply = await this.calculateStfuelTotalSupply(blockNumber);

      // Count current holders (addresses with balance > 0)
      const currentHoldersCount = await this.calculateCurrentHolders(blockNumber);

      // Count historical holders (all unique addresses that ever held sTFuel)
      const historicalHoldersCount = await this.calculateHistoricalHolders(blockNumber);

      // Sum referral rewards from ReferralRewarded events
      const totalReferralRewards = await this.calculateTotalReferralRewards(blockNumber);

      // Calculate edge nodes count: COUNT(nodes WHERE stakedTFuel > 0)
      const edgeNodesCount = await this.calculateEdgeNodesCount(blockNumber);

      // Calculate total keeper tips paid: Σ(KeeperPaid.tipPaid)
      const totalKeeperTipsPaid = await this.calculateTotalKeeperTipsPaid(blockNumber);

      return {
        tfuelStakedAmount,
        stfuelTotalSupply,
        currentHoldersCount,
        historicalHoldersCount,
        totalReferralRewards,
        edgeNodesCount,
        totalKeeperTipsPaid,
      };

    } catch (error) {
      console.error('Error calculating metrics:', error);
      return {
        tfuelStakedAmount: BigInt(0),
        stfuelTotalSupply: BigInt(0),
        currentHoldersCount: 0,
        historicalHoldersCount: 0,
        totalReferralRewards: BigInt(0),
        edgeNodesCount: 0,
        totalKeeperTipsPaid: BigInt(0),
      };
    }
  }

  private async calculateCurrentHolders(blockNumber: number): Promise<number> {
    try {
      // Get all Transfer events up to this block
      const transferEvents = await this.stfuelEventRepo
        .createQueryBuilder('event')
        .where('event.eventName = :eventName', { eventName: 'Transfer' })
        .andWhere('CAST(event.blockNumber AS bigint) <= :blockNumber', { blockNumber: blockNumber.toString() })
        .orderBy('CAST(event.blockNumber AS bigint)', 'ASC')
        .addOrderBy('event.logIndex', 'ASC')
        .getMany();

      // Track balances for each address
      const balances: { [address: string]: bigint } = {};

      for (const event of transferEvents) {
        if (event.args && event.args.from && event.args.to && event.args.value) {
          try {
            const from = event.args.from.toString().toLowerCase();
            const to = event.args.to.toString().toLowerCase();
            const value = BigInt(event.args.value);

            // Initialize balances if not exists
            if (!balances[from]) balances[from] = BigInt(0);
            if (!balances[to]) balances[to] = BigInt(0);

            // Update balances
            balances[from] -= value;
            balances[to] += value;
          } catch (error) {
            console.warn('Failed to parse Transfer event args:', event.id, error);
          }
        }
      }

      // Count addresses with positive balance (current holders)
      let currentHoldersCount = 0;
      for (const address in balances) {
        if (balances[address] > BigInt(0)) {
          currentHoldersCount++;
        }
      }

      console.log(`Current holders calculation: ${currentHoldersCount} holders from ${Object.keys(balances).length} total addresses`);
      return currentHoldersCount;
    } catch (error) {
      console.error('Error calculating current holders:', error);
      return 0;
    }
  }

  private async calculateHistoricalHolders(blockNumber: number): Promise<number> {
    try {
      // Get all Transfer events up to this block
      const transferEvents = await this.stfuelEventRepo
        .createQueryBuilder('event')
        .where('event.eventName = :eventName', { eventName: 'Transfer' })
        .andWhere('CAST(event.blockNumber AS bigint) <= :blockNumber', { blockNumber: blockNumber.toString() })
        .getMany();

      // Track all addresses that have ever held tokens
      const historicalAddresses = new Set<string>();

      for (const event of transferEvents) {
        if (event.args && event.args.from && event.args.to) {
          try {
            const from = event.args.from.toString().toLowerCase();
            const to = event.args.to.toString().toLowerCase();

            // Add both sender and receiver to historical holders
            // (excluding zero address for minting/burning)
            if (from !== '0x0000000000000000000000000000000000000000') {
              historicalAddresses.add(from);
            }
            if (to !== '0x0000000000000000000000000000000000000000') {
              historicalAddresses.add(to);
            }
          } catch (error) {
            console.warn('Failed to parse Transfer event args:', event.id, error);
          }
        }
      }

      console.log(`Historical holders calculation: ${historicalAddresses.size} unique addresses`);
      return historicalAddresses.size;
    } catch (error) {
      console.error('Error calculating historical holders:', error);
      return 0;
    }
  }

  // Calculate TFuel staked amount: Σ(TFuelStaked.amount) - Σ(TFuelUnstaked.amount)
  private async calculateTfuelStakedAmount(blockNumber: number): Promise<bigint> {
    try {
      const stakedEvents = await this.nodeManagerEventRepo
        .createQueryBuilder('event')
        .where('event.eventName = :eventName', { eventName: 'TFuelStaked' })
        .andWhere('CAST(event.blockNumber AS bigint) <= :blockNumber', { blockNumber: blockNumber.toString() })
        .getMany();

      const unstakedEvents = await this.nodeManagerEventRepo
        .createQueryBuilder('event')
        .where('event.eventName = :eventName', { eventName: 'TFuelUnstaked' })
        .andWhere('CAST(event.blockNumber AS bigint) <= :blockNumber', { blockNumber: blockNumber.toString() })
        .getMany();

      let totalStaked = BigInt(0);
      
      // Sum all staked amounts
      for (const event of stakedEvents) {
        if (event.args && event.args.amount) {
          try {
            const amount = BigInt(event.args.amount);
            totalStaked += amount;
          } catch (error) {
            console.warn('Failed to parse amount from TFuelStaked event:', event.id, error);
          }
        }
      }

      // Subtract all unstaked amounts
      for (const event of unstakedEvents) {
        if (event.args && event.args.amount) {
          try {
            const amount = BigInt(event.args.amount);
            totalStaked -= amount;
          } catch (error) {
            console.warn('Failed to parse amount from TFuelUnstaked event:', event.id, error);
          }
        }
      }

      return totalStaked;
    } catch (error) {
      console.error('Error calculating TFuel staked amount:', error);
      return BigInt(0);
    }
  }

  // Calculate sTFuel total supply: + Minted.sharesOut + ReferralRewarded.rewardShares - BurnQueued.amount - BurnAndDirectRedeemed.amount
  private async calculateStfuelTotalSupply(blockNumber: number): Promise<bigint> {
    try {
      let totalSupply = BigInt(0);

      // Add Minted.sharesOut
      const mintedEvents = await this.stfuelEventRepo
        .createQueryBuilder('event')
        .where('event.eventName = :eventName', { eventName: 'Minted' })
        .andWhere('CAST(event.blockNumber AS bigint) <= :blockNumber', { blockNumber: blockNumber.toString() })
        .getMany();

      for (const event of mintedEvents) {
        if (event.args && event.args.sharesOut) {
          try {
            const sharesOut = BigInt(event.args.sharesOut);
            totalSupply += sharesOut;
          } catch (error) {
            console.warn('Failed to parse sharesOut from Minted event:', event.id, error);
          }
        }
      }

      // Add ReferralRewarded.rewardShares
      const referralEvents = await this.stfuelEventRepo
        .createQueryBuilder('event')
        .where('event.eventName = :eventName', { eventName: 'ReferralRewarded' })
        .andWhere('CAST(event.blockNumber AS bigint) <= :blockNumber', { blockNumber: blockNumber.toString() })
        .getMany();

      for (const event of referralEvents) {
        if (event.args && event.args.rewardShares) {
          try {
            const rewardShares = BigInt(event.args.rewardShares);
            totalSupply += rewardShares;
          } catch (error) {
            console.warn('Failed to parse rewardShares from ReferralRewarded event:', event.id, error);
          }
        }
      }

      // Subtract BurnQueued.amount
      const burnQueuedEvents = await this.stfuelEventRepo
        .createQueryBuilder('event')
        .where('event.eventName = :eventName', { eventName: 'BurnQueued' })
        .andWhere('CAST(event.blockNumber AS bigint) <= :blockNumber', { blockNumber: blockNumber.toString() })
        .getMany();

      for (const event of burnQueuedEvents) {
        if (event.args && event.args.sharesBurned) {
          try {
            const sharesBurned = BigInt(event.args.sharesBurned);
            totalSupply -= sharesBurned;
          } catch (error) {
            console.warn('Failed to parse sharesBurned from BurnQueued event:', event.id, error);
          }
        }
      }

      // Subtract BurnAndDirectRedeemed.amount
      const burnAndDirectRedeemedEvents = await this.stfuelEventRepo
        .createQueryBuilder('event')
        .where('event.eventName = :eventName', { eventName: 'BurnAndDirectRedeemed' })
        .andWhere('CAST(event.blockNumber AS bigint) <= :blockNumber', { blockNumber: blockNumber.toString() })
        .getMany();

      for (const event of burnAndDirectRedeemedEvents) {
        if (event.args && event.args.sharesBurned) {
          try {
            const sharesBurned = BigInt(event.args.sharesBurned);
            totalSupply -= sharesBurned;
          } catch (error) {
            console.warn('Failed to parse sharesBurned from BurnAndDirectRedeemed event:', event.id, error);
          }
        }
      }

      return totalSupply;
    } catch (error) {
      console.error('Error calculating sTFuel total supply:', error);
      return BigInt(0);
    }
  }

  // Calculate total referral rewards: Σ(ReferralRewarded.rewardShares)
  private async calculateTotalReferralRewards(blockNumber: number): Promise<bigint> {
    try {
      const referralEvents = await this.stfuelEventRepo
        .createQueryBuilder('event')
        .where('event.eventName = :eventName', { eventName: 'ReferralRewarded' })
        .andWhere('CAST(event.blockNumber AS bigint) <= :blockNumber', { blockNumber: blockNumber.toString() })
        .getMany();

      let totalReferralRewards = BigInt(0);
      for (const event of referralEvents) {
        if (event.args && event.args.rewardShares) {
          try {
            const rewardShares = BigInt(event.args.rewardShares);
            totalReferralRewards += rewardShares;
          } catch (error) {
            console.warn('Failed to parse rewardShares from ReferralRewarded event:', event.id, error);
          }
        }
      }

      return totalReferralRewards;
    } catch (error) {
      console.error('Error calculating total referral rewards:', error);
      return BigInt(0);
    }
  }

  // Calculate edge nodes count: COUNT(nodes WHERE stakedTFuel > 0)
  private async calculateEdgeNodesCount(blockNumber: number): Promise<number> {
    try {
      const stakedEvents = await this.nodeManagerEventRepo
        .createQueryBuilder('event')
        .where('event.eventName = :eventName', { eventName: 'TFuelStaked' })
        .andWhere('CAST(event.blockNumber AS bigint) <= :blockNumber', { blockNumber: blockNumber.toString() })
        .getMany();

      const unstakedEvents = await this.nodeManagerEventRepo
        .createQueryBuilder('event')
        .where('event.eventName = :eventName', { eventName: 'TFuelUnstaked' })
        .andWhere('CAST(event.blockNumber AS bigint) <= :blockNumber', { blockNumber: blockNumber.toString() })
        .getMany();

      // Track staked amounts per node
      const nodeStakedAmounts: { [node: string]: bigint } = {};

      // Process staked events
      for (const event of stakedEvents) {
        if (event.args && event.args.node && event.args.amount) {
          try {
            const node = event.args.node.toString();
            const amount = BigInt(event.args.amount);
            nodeStakedAmounts[node] = (nodeStakedAmounts[node] || BigInt(0)) + amount;
          } catch (error) {
            console.warn('Failed to parse node/amount from TFuelStaked event:', event.id, error);
          }
        }
      }

      // Process unstaked events
      for (const event of unstakedEvents) {
        if (event.args && event.args.node && event.args.amount) {
          try {
            const node = event.args.node.toString();
            const amount = BigInt(event.args.amount);
            nodeStakedAmounts[node] = (nodeStakedAmounts[node] || BigInt(0)) - amount;
          } catch (error) {
            console.warn('Failed to parse node/amount from TFuelUnstaked event:', event.id, error);
          }
        }
      }

      // Count nodes with positive staked amount
      let activeNodesCount = 0;
      for (const node in nodeStakedAmounts) {
        if (nodeStakedAmounts[node] > BigInt(0)) {
          activeNodesCount++;
        }
      }

      return activeNodesCount;
    } catch (error) {
      console.error('Error calculating edge nodes count:', error);
      return 0;
    }
  }

  // Calculate total keeper tips paid: Σ(KeeperPaid.tipPaid)
  private async calculateTotalKeeperTipsPaid(blockNumber: number): Promise<bigint> {
    try {
      const keeperPaidEvents = await this.nodeManagerEventRepo
        .createQueryBuilder('event')
        .where('event.eventName = :eventName', { eventName: 'KeeperPaid' })
        .andWhere('CAST(event.blockNumber AS bigint) <= :blockNumber', { blockNumber: blockNumber.toString() })
        .getMany();

      let totalKeeperTipsPaid = BigInt(0);
      for (const event of keeperPaidEvents) {
        if (event.args && event.args.tipPaid) {
          try {
            const tipPaid = BigInt(event.args.tipPaid);
            totalKeeperTipsPaid += tipPaid;
          } catch (error) {
            console.warn('Failed to parse tipPaid from KeeperPaid event:', event.id, error);
          }
        }
      }

      return totalKeeperTipsPaid;
    } catch (error) {
      console.error('Error calculating total keeper tips paid:', error);
      return BigInt(0);
    }
  }


  async getLatestSnapshot(): Promise<HourlySnapshot | null> {
    try {
      return await this.snapshotRepo
        .createQueryBuilder('snapshot')
        .orderBy('snapshot.snapshotTimestamp', 'DESC')
        .getOne();
    } catch (error) {
      console.error('Error getting latest snapshot:', error);
      return null;
    }
  }

  async getSnapshotsInRange(startDate: Date, endDate: Date): Promise<HourlySnapshot[]> {
    try {
      return await this.snapshotRepo
        .createQueryBuilder('snapshot')
        .where('snapshot.snapshotTimestamp >= :startDate', { startDate })
        .andWhere('snapshot.snapshotTimestamp <= :endDate', { endDate })
        .orderBy('snapshot.snapshotTimestamp', 'ASC')
        .getMany();
    } catch (error) {
      console.error('Error getting snapshots in range:', error);
      return [];
    }
  }

  private async getTfuelBackingFromCurrentNetAssets(blockNumber: number): Promise<bigint> {
    try {
      // First try to find CurrentNetAssets event with isExact = true
      const exactEvent = await this.nodeManagerEventRepo
        .createQueryBuilder('event')
        .where('event.eventName = :eventName', { eventName: 'CurrentNetAssets' })
        .andWhere('event.args->>\'isExact\' = :isExact', { isExact: 'true' })
        .andWhere('CAST(event.blockNumber AS bigint) <= :blockNumber', { blockNumber: blockNumber.toString() })
        .orderBy('CAST(event.blockNumber AS bigint)', 'DESC')
        .getOne();

      if (exactEvent && exactEvent.args && exactEvent.args.netAssets) {
        return BigInt(exactEvent.args.netAssets);
      }

      // If no exact event found, try to find latest CurrentNetAssets with isExact = false
      const approximateEvent = await this.nodeManagerEventRepo
        .createQueryBuilder('event')
        .where('event.eventName = :eventName', { eventName: 'CurrentNetAssets' })
        .andWhere('event.args->>\'isExact\' = :isExact', { isExact: 'false' })
        .andWhere('CAST(event.blockNumber AS bigint) <= :blockNumber', { blockNumber: blockNumber.toString() })
        .orderBy('CAST(event.blockNumber AS bigint)', 'DESC')
        .getOne();

      if (approximateEvent && approximateEvent.args && approximateEvent.args.netAssets) {
        return BigInt(approximateEvent.args.netAssets);
      }

      // If no CurrentNetAssets events found, return 0
      console.warn(`No CurrentNetAssets events found for block ${blockNumber}, using 0`);
      return BigInt(0);
    } catch (error) {
      console.error('Error getting TFuel backing from CurrentNetAssets events:', error);
      return BigInt(0);
    }
  }

  getNextSnapshotTime(): Date | null {
    return this.nextSnapshotTime ? new Date(this.nextSnapshotTime * 1000) : null;
  }
}

export default SnapshotService;
