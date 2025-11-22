import { ethers } from 'ethers';
import { Repository, QueryRunner } from 'typeorm';
import { NodeManagerEvent } from '../database/entities/NodeManagerEvent';
import { StfuelEvent } from '../database/entities/StfuelEvent';
import AppDataSource from '../database/data-source';

export class EventProcessor {
  private nodeManagerEventRepo: Repository<NodeManagerEvent>;
  private stfuelEventRepo: Repository<StfuelEvent>;

  constructor() {
    this.nodeManagerEventRepo = AppDataSource.getRepository(NodeManagerEvent);
    this.stfuelEventRepo = AppDataSource.getRepository(StfuelEvent);
  }

  async processNodeManagerEvents(logs: any[], blockTimestamp: number, queryRunner?: QueryRunner): Promise<{ events: Partial<NodeManagerEvent>[], wasNew: boolean }> {
    const events = this.parseNodeManagerEvents(logs, blockTimestamp);
    
    if (events.length > 0) {
      console.log(`Saving ${events.length} NodeManager events to database`);
      
      const manager = queryRunner ? queryRunner.manager : AppDataSource.manager;
      const nodeManagerEventRepo = manager.getRepository(NodeManagerEvent);
      
      // Process events individually to handle multiple events from same transaction
      let savedCount = 0;
      let hasNewEvents = false;
      
      for (const event of events) {
        try {
          // Try to insert the event
          const savedEvent = await nodeManagerEventRepo.save(event);
          savedCount++;
          hasNewEvents = true;
        } catch (duplicateError: any) {
          if (duplicateError.code === '23505') { // Unique constraint violation
            console.log('Event already exists, skipping:', event.transactionHash, event.logIndex);
          } else {
            console.error('Error saving individual NodeManager event:', duplicateError);
            throw duplicateError; // Re-throw non-duplicate errors
          }
        }
      }
      console.log(`Successfully processed ${savedCount} NodeManager events`);
      
      return { events, wasNew: hasNewEvents };
    } else {
      console.log('No NodeManager events to save');
      return { events, wasNew: false };
    }
  }

  parseNodeManagerEvents(logs: any[], blockTimestamp: number): Partial<NodeManagerEvent>[] {
    const events: Partial<NodeManagerEvent>[] = [];

    for (const log of logs) {
      try {
        const event: Partial<NodeManagerEvent> = {
          eventName: this.getEventNameFromTopic(log.topics[0]),
          blockNumber: log.blockNumber.toString(),
          transactionHash: log.transactionHash,
          transactionIndex: log.transactionIndex,
          logIndex: log.index !== undefined ? log.index : 0, // Use 'index' field instead of 'logIndex'
          timestamp: blockTimestamp,
          address: log.address,
          args: this.parseEventArgs(log),
          data: log.data,
          topics: [...(log.topics || [])],
        };

        events.push(event);
      } catch (error) {
        console.error('Error processing NodeManager event:', error);
      }
    }

    // Group events by transaction to show multiple events from same transaction
    const eventsByTransaction = events.reduce((acc, event) => {
      const txHash = event.transactionHash!;
      if (!acc[txHash]) acc[txHash] = [];
      acc[txHash].push(event);
      return acc;
    }, {} as { [key: string]: Partial<NodeManagerEvent>[] });

    // Log transactions with multiple events
    Object.entries(eventsByTransaction).forEach(([txHash, txEvents]) => {
      if (txEvents.length > 1) {
        console.log(`Transaction ${txHash} has ${txEvents.length} events:`, txEvents.map(e => e.eventName));
      }
    });

    return events;
  }

  async processStfuelEvents(logs: any[], blockTimestamp: number, queryRunner?: QueryRunner): Promise<{ events: Partial<StfuelEvent>[], wasNew: boolean }> {
    const events = this.parseStfuelEvents(logs, blockTimestamp);
    
    if (events.length > 0) {
      console.log(`Saving ${events.length} sTFuel events to database`);
      
      const manager = queryRunner ? queryRunner.manager : AppDataSource.manager;
      const stfuelEventRepo = manager.getRepository(StfuelEvent);
      
      // Process events individually to handle multiple events from same transaction
      let savedCount = 0;
      let hasNewEvents = false;
      
      for (const event of events) {
        try {
          // Try to insert the event
          const savedEvent = await stfuelEventRepo.save(event);
          savedCount++;
          hasNewEvents = true;
        } catch (duplicateError: any) {
          if (duplicateError.code === '23505') { // Unique constraint violation
            console.log('Event already exists, skipping:', event.transactionHash, event.logIndex);
          } else {
            console.error('Error saving individual sTFuel event:', duplicateError);
            throw duplicateError; // Re-throw non-duplicate errors
          }
        }
      }
      console.log(`Successfully processed ${savedCount} sTFuel events`);
      
      return { events, wasNew: hasNewEvents };
    } else {
      console.log('No sTFuel events to save');
      return { events, wasNew: false };
    }
  }

  parseStfuelEvents(logs: any[], blockTimestamp: number): Partial<StfuelEvent>[] {
    const events: Partial<StfuelEvent>[] = [];

    for (const log of logs) {
      try {
        const event: Partial<StfuelEvent> = {
          eventName: this.getEventNameFromTopic(log.topics[0]),
          blockNumber: log.blockNumber.toString(),
          transactionHash: log.transactionHash,
          transactionIndex: log.transactionIndex,
          logIndex: log.index !== undefined ? log.index : 0, // Use 'index' field instead of 'logIndex'
          timestamp: blockTimestamp,
          address: log.address,
          args: this.parseEventArgs(log),
          data: log.data,
          topics: [...(log.topics || [])],
        };

        events.push(event);
      } catch (error) {
        console.error('Error processing sTFuel event:', error);
      }
    }

    // Group events by transaction to show multiple events from same transaction
    const eventsByTransaction = events.reduce((acc, event) => {
      const txHash = event.transactionHash!;
      if (!acc[txHash]) acc[txHash] = [];
      acc[txHash].push(event);
      return acc;
    }, {} as { [key: string]: Partial<StfuelEvent>[] });

    // Log transactions with multiple events
    Object.entries(eventsByTransaction).forEach(([txHash, txEvents]) => {
      if (txEvents.length > 1) {
        console.log(`Transaction ${txHash} has ${txEvents.length} events:`, txEvents.map(e => e.eventName));
      }
    });

    return events;
  }

  private getEventNameFromTopic(topic: string): string {
    // Map event signatures to event names - using correct signatures (without 'indexed' keyword)
    const eventSignatures: { [key: string]: string } = {
      // NodeManager events - using correct signatures from ABI
      '0xeccca51a16e74500158d2ea8cffce205829cffe384735736dc16c150ce243eb5': 'CreditAssigned',
      '0xacbe1794969fed84261ede7b63424eee64ec92f8aefe6da2ecf99d0154091ce4': 'CurrentNetAssets',
      '0xb54344fc0832277ff1f17052d8e9b26b3f268ebcabfc855b064713b85a0d86dc': 'FaultyNodeRecovered',
      '0x8fbb781fd29154cbb0085fd02df7b30539533dccaddc9d3af1662a78a82e73b8': 'KeeperCredited',
      '0x8bcf9773f25f37b100bce5d261736c69f39b5b8d58dff6066278d3f23cb9b4d4': 'KeeperTipSurplus',
      '0x85622482a12dc87041ce62f856231dfef31609429d8dffe30a76e8eb1417f5e0': 'MaxNodesPerStakingCallUpdated',
      '0xd9957750e6343405c319eb99a4ec67fa11cfd66969318cbc71aa2d45fa53a349': 'NodeDeactivated',
      '0xaa3361eb68dfad391d6fef472dba74ca7a14bc6810bc68c238dd982502605005': 'NodeMarkedAsFaulty',
      '0x1f63e087b186a95e77f84777db8290b8ac9093ba93592a3c2752d8b789e9c676': 'NodeRegistered',
      '0xa12db082c8757433a332427216c399cade007e9ed31314cd9fcd1a6018ee04b4': 'ParamsUpdated',
      '0xbd79b86ffe0ab8e8776151514217cd7cacd52c909f66475c3af44e129f0b00ff': 'RoleAdminChanged',
      '0x2f8788117e7eff1d82e926ec794901d17c78024a50270940304540a733656f0d': 'RoleGranted',
      '0xf6391f5c32d9c69d2a47ea670b442974b53935d1edc7fd64eb21e047a839171b': 'RoleRevoked',
      '0xc65855a124c36c3f7b2f1ffc73edc418498a00c9aff9db84b49233e05561ad2c': 'StakingPauseChanged',
      '0xfc378c84733251f1a5a3addcc6d0ab7727cc3f390b490a180e3debeeb97e6f40': 'TFuelStaked',
      '0x3af1c2eecca1146d6d85a0ce8c731c85b90c489d9aa48f49d74940e366455353': 'TFuelUnstaked',
      '0x93a97e1a5377ad11518ed03c3036d6368794835506cb55e8de3c5592dfb78b49': 'TNT20Withdrawn',
      
      // sTFuel events - using correct signatures
      '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925': 'Approval',
      '0x2fbf982a41568536ce4b791b753652443c468eb2fe4a27040b7ff13f35f2f78b': 'BurnAndDirectRedeemed',
      '0x9a37903f5718a79582518ef89edadd345e2e86266dbcad704f809fa3724fcf07': 'BurnQueued',
      '0x987d620f307ff6b94d58743cb7a7509f24071586a77759b77c2d4e29f75a2f9a': 'Claimed',
      '0x4a6b3e061b1bf7564c46c1d653e509583d549a5c94d0d8fd67d4b97425a97b7f': 'CreditsClaimed',
      '0x8eb147020b25fd7b80fcdbf6f124df933cb70deef9d21421d3e2c409a82f8800': 'DirectRedeemFeeUpdated',
      '0xd7305c2100875d296d51b558aeed69b9bb3322315f65b9f0a3d588790514f54d': 'MintFeeUpdated',
      '0x5a3358a3d27a5373c0df2604662088d37894d56b7cfd27f315770440f4e0d919': 'Minted',
      '0x62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a258': 'Paused',
      '0x573cec0e9fa88bbe4abd2dad332eed3f254b6d74357c6a8680a6d4b110c219cb': 'ReferralAddressSet',
      '0xb0ff8fecc36351fe07e00d6df11e1c13ccfd7a2a87389960531546952235a589': 'ReferralRewarded',
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef': 'Transfer',
      '0x5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa': 'Unpaused',
    };

    return eventSignatures[topic] || 'Unknown';
  }

  private parseEventArgs(log: any): any {
    try {
      // Start with an empty result object - only add parsed values
      const result: any = {};

      // Get the event name from the first topic
      const eventName = this.getEventNameFromTopic(log.topics[0]);
      
      // Try to extract basic information from topics for indexed parameters
      if (log.topics && log.topics.length > 1) {
        // First topic is the event signature, rest are indexed parameters
        const indexedParams = log.topics.slice(1);
        
        // For common events, try to extract known parameters
        
        switch (eventName) {
          // NodeManager Events
          case 'TFuelStaked':
            if (indexedParams.length >= 1) {
              result.node = indexedParams[0];
              if (log.data && log.data !== '0x') {
                try {
                  const amount = ethers.getBigInt(log.data);
                  result.amount = amount.toString();
                } catch (e) {
                  console.warn('Failed to parse amount from TFuelStaked data:', e);
                }
              }
            }
            break;
            
          case 'TFuelUnstaked':
            if (indexedParams.length >= 1) {
              result.node = indexedParams[0];
              if (log.data && log.data !== '0x') {
                try {
                  const amount = ethers.getBigInt(log.data);
                  result.amount = amount.toString();
                } catch (e) {
                  console.warn('Failed to parse amount from TFuelUnstaked data:', e);
                }
              }
            }
            break;
            
          case 'NodeRegistered':
            if (indexedParams.length >= 1) {
              result.node = indexedParams[0];
              // Extract node type from data field
              if (log.data && log.data !== '0x') {
                try {
                  const nodeTypeValue = ethers.getBigInt(log.data);
                  // Map the numeric value to the NodeType enum
                  const nodeTypeMap: { [key: number]: string } = {
                    0: 'None',
                    1: 'Tenk',
                    2: 'Fiftyk', 
                    3: 'Hundredk',
                    4: 'TwoHundredk',
                    5: 'FiveHundredk'
                  };
                  result.nodeType = nodeTypeMap[Number(nodeTypeValue)] || 'None';
                } catch (e) {
                  console.warn('Failed to parse node type from NodeRegistered data:', e);
                  result.nodeType = 'None';
                }
              }
            }
            break;
            
          case 'NodeDeactivated':
            if (indexedParams.length >= 1) {
              result.node = indexedParams[0];
            }
            break;
            
          case 'CreditAssigned':
            if (indexedParams.length >= 1) {
              result.user = indexedParams[0];
              if (log.data && log.data !== '0x') {
                try {
                  const data = ethers.AbiCoder.defaultAbiCoder().decode(
                    ['uint256', 'uint256'],
                    log.data
                  );
                  // According to ABI: CreditAssigned(address user, uint256 amount, uint256 index)
                  // amount is first in data, index is second
                  result.amount = data[0].toString();
                  result.queueIndex = data[1].toString();
                } catch (e) {
                  console.warn('Failed to parse CreditAssigned data:', e);
                }
              }
            }
            break;
            
          case 'KeeperCredited':
            if (indexedParams.length >= 1) {
              result.keeper = indexedParams[0];
              if (log.data && log.data !== '0x') {
                try {
                  const data = ethers.AbiCoder.defaultAbiCoder().decode(
                    ['uint256', 'uint256'],
                    log.data
                  );
                  result.tipPaid = data[0].toString();
                  result.tipTotalProcessed = data[1].toString();
                } catch (e) {
                  console.warn('Failed to parse KeeperCredited data:', e);
                }
              }
            }
            break;
            
          // sTFuel Events
          case 'Transfer':
            if (indexedParams.length >= 2) {
              result.from = indexedParams[0];
              result.to = indexedParams[1];
              if (log.data && log.data !== '0x') {
                try {
                  const value = ethers.getBigInt(log.data);
                  result.value = value.toString();
                } catch (e) {
                  console.warn('Failed to parse value from Transfer data:', e);
                }
              }
            }
            break;
            
          case 'Minted':
            if (indexedParams.length >= 1) {
              result.user = indexedParams[0];
              if (log.data && log.data !== '0x') {
                try {
                  const data = ethers.AbiCoder.defaultAbiCoder().decode(
                    ['uint256', 'uint256', 'uint256'],
                    log.data
                  );
                  result.tfuelIn = data[0].toString();
                  result.sharesOut = data[1].toString();
                  result.feeTFuel = data[2].toString();
                } catch (e) {
                  console.warn('Failed to parse Minted data:', e);
                }
              }
            }
            break;
            
          case 'BurnQueued':
            if (indexedParams.length >= 1) {
              result.user = indexedParams[0];
              if (log.data && log.data !== '0x') {
                try {
                  const data = ethers.AbiCoder.defaultAbiCoder().decode(
                    ['uint256', 'uint256', 'uint256', 'uint256', 'uint256'],
                    log.data
                  );
                  result.sharesBurned = data[0].toString();
                  result.tfuelOut = data[1].toString();
                  result.readyAt = data[2].toString();
                  result.tip = data[3].toString();
                  result.queueIndex = data[4].toString();
                } catch (e) {
                  console.warn('Failed to parse BurnQueued data:', e);
                }
              }
            }
            break;
            
          case 'BurnAndDirectRedeemed':
            if (indexedParams.length >= 1) {
              result.user = indexedParams[0];
              if (log.data && log.data !== '0x') {
                try {
                  const data = ethers.AbiCoder.defaultAbiCoder().decode(
                    ['uint256', 'uint256', 'uint256'],
                    log.data
                  );
                  result.sharesBurned = data[0].toString();
                  result.tfuelAmount = data[1].toString();
                  result.fee = data[2].toString();
                } catch (e) {
                  console.warn('Failed to parse BurnAndDirectRedeemed data:', e);
                }
              }
            }
            break;
            
          case 'Claimed':
            if (indexedParams.length >= 1) {
              result.user = indexedParams[0];
              if (log.data && log.data !== '0x') {
                try {
                  const data = ethers.AbiCoder.defaultAbiCoder().decode(
                    ['uint256', 'uint256'],
                    log.data
                  );
                  result.amount = data[0].toString();
                  result.unlockTime = data[1].toString();
                } catch (e) {
                  console.warn('Failed to parse Claimed data:', e);
                }
              }
            }
            break;
            
          case 'CreditsClaimed':
            if (indexedParams.length >= 1) {
              result.user = indexedParams[0];
              if (log.data && log.data !== '0x') {
                try {
                  const amount = ethers.getBigInt(log.data);
                  result.amount = amount.toString();
                } catch (e) {
                  console.warn('Failed to parse CreditsClaimed data:', e);
                }
              }
            }
            break;
            
          case 'ReferralRewarded':
            if (indexedParams.length >= 1) {
              result.referrer = indexedParams[0];
              if (log.data && log.data !== '0x') {
                try {
                  const data = ethers.AbiCoder.defaultAbiCoder().decode(
                    ['uint256', 'uint256'],
                    log.data
                  );
                  result.rewardShares = data[0].toString();
                  result.fromReferralId = data[1].toString();
                } catch (e) {
                  console.warn('Failed to parse ReferralRewarded data:', e);
                }
              }
            }
            break;
        }
      } else {
        // Handle events with no indexed parameters (only data field)
        switch (eventName) {
          case 'CurrentNetAssets':
            if (log.data && log.data !== '0x') {
              try {
                const data = ethers.AbiCoder.defaultAbiCoder().decode(
                  ['uint256', 'bool'],
                  log.data
                );
                result.netAssets = data[0].toString();
                result.isExact = data[1];
              } catch (e) {
                console.warn('Failed to parse CurrentNetAssets data:', e);
              }
            }
            break;
        }
      }

      return result;
    } catch (error) {
      console.error('Error parsing event args:', error);
      return {};
    }
  }
}

export default EventProcessor;
