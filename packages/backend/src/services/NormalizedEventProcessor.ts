import { Repository, QueryRunner } from 'typeorm';
import AppDataSource from '../database/data-source';
import { Address } from '../database/entities/Address';
import { EdgeNode, NodeType } from '../database/entities/EdgeNode';
import { User } from '../database/entities/User';
import { RedemptionQueue, RedemptionStatus } from '../database/entities/RedemptionQueue';
import { NodeManagerEvent } from '../database/entities/NodeManagerEvent';
import { StfuelEvent } from '../database/entities/StfuelEvent';

export class NormalizedEventProcessor {
  private addressRepo: Repository<Address>;
  private edgeNodeRepo: Repository<EdgeNode>;
  private userRepo: Repository<User>;
  private redemptionQueueRepo: Repository<RedemptionQueue>;

  constructor() {
    this.addressRepo = AppDataSource.getRepository(Address);
    this.edgeNodeRepo = AppDataSource.getRepository(EdgeNode);
    this.userRepo = AppDataSource.getRepository(User);
    this.redemptionQueueRepo = AppDataSource.getRepository(RedemptionQueue);
  }

  /**
   * Get or create an address record
   */
  private async getOrCreateAddress(address: string, queryRunner?: QueryRunner): Promise<Address> {
    const manager = queryRunner ? queryRunner.manager : AppDataSource.manager;
    const addressRepo = manager.getRepository(Address);
    
    let addressRecord = await addressRepo.findOne({ where: { address } });
    
    if (!addressRecord) {
      addressRecord = addressRepo.create({ address });
      addressRecord = await addressRepo.save(addressRecord);
    }
    
    return addressRecord;
  }

  /**
   * Process NodeManager events
   */
  async processNodeManagerEvent(event: NodeManagerEvent, queryRunner?: QueryRunner): Promise<void> {
    try {
      switch (event.eventName) {
        case 'NodeRegistered':
          await this.processNodeRegistered(event, queryRunner);
          break;
        case 'NodeDeactivated':
          await this.processNodeDeactivated(event, queryRunner);
          break;
        case 'NodeMarkedAsFaulty':
          await this.processNodeMarkedAsFaulty(event, queryRunner);
          break;
        case 'FaultyNodeRecovered':
          await this.processFaultyNodeRecovered(event, queryRunner);
          break;
        case 'TFuelStaked':
          await this.processTFuelStaked(event, queryRunner);
          break;
        case 'TFuelUnstaked':
          await this.processTFuelUnstaked(event, queryRunner);
          break;
        case 'KeeperPaid':
          await this.processKeeperPaid(event, queryRunner);
          break;
        case 'CreditAssigned':
          await this.processCreditAssigned(event, queryRunner);
          break;
        case 'KeeperCredited':
          await this.processKeeperCredited(event, queryRunner);
          break;
        default:
          // Skip unknown events
          break;
      }
    } catch (error) {
      console.error(`Error processing NodeManager event ${event.eventName}:`, error);
    }
  }

  /**
   * Process sTFuel events
   */
  async processStfuelEvent(event: StfuelEvent, queryRunner?: QueryRunner): Promise<void> {
    try {
      switch (event.eventName) {
        case 'Transfer':
          await this.processTransfer(event, queryRunner);
          break;
        case 'Minted':
          await this.processMinted(event, queryRunner);
          break;
        case 'BurnQueued':
          await this.processBurnQueued(event, queryRunner);
          break;
        case 'ReferralRewarded':
          await this.processReferralRewarded(event, queryRunner);
          break;
        case 'BurnAndDirectRedeemed':
          await this.processBurnAndDirectRedeemed(event, queryRunner);
          break;
        case 'Claimed':
          await this.processClaimed(event, queryRunner);
          break;
        case 'CreditsClaimed':
          await this.processCreditsClaimed(event, queryRunner);
          break;
        case 'ReferralAddressSet':
          await this.processReferralAddressSet(event, queryRunner);
          break;
        default:
          // Skip unknown events
          break;
      }
    } catch (error) {
      console.error(`Error processing sTFuel event ${event.eventName}:`, error);
    }
  }

  // NodeManager Event Handlers

  private async processNodeRegistered(event: NodeManagerEvent, queryRunner?: QueryRunner): Promise<void> {
    const nodeAddress = event.args?.node;
    if (!nodeAddress) return;

    const addressRecord = await this.getOrCreateAddress(nodeAddress, queryRunner);
    
    const manager = queryRunner ? queryRunner.manager : AppDataSource.manager;
    const edgeNodeRepo = manager.getRepository(EdgeNode);
    
    // Check if edge node already exists
    const existingNode = await edgeNodeRepo.findOne({ 
      where: { addressId: addressRecord.id } 
    });
    
    if (!existingNode) {
      const edgeNode = edgeNodeRepo.create({
        addressId: addressRecord.id,
        registrationBlock: event.blockNumber,
        registrationTimestamp: event.timestamp,
        isActive: true,
        isFaulty: false,
        isLive: true,
        totalStaked: '0',
        totalUnstaked: '0',
        unstakeBlock: null,
        nodeType: event.args?.nodeType as any || null
      });
      
      await edgeNodeRepo.save(edgeNode);
      console.log(`Created EdgeNode for address ${nodeAddress} with type ${event.args?.nodeType || 'None'}`);
    } else {
      // Update existing node with new registration info
      existingNode.registrationBlock = event.blockNumber;
      existingNode.registrationTimestamp = event.timestamp;
      existingNode.isActive = true;
      existingNode.isFaulty = false;
      existingNode.isLive = true;
      existingNode.nodeType = event.args?.nodeType as any || existingNode.nodeType;
      
      await edgeNodeRepo.save(existingNode);
      console.log(`Updated EdgeNode for address ${nodeAddress} with type ${event.args?.nodeType || 'None'}`);
    }
  }

  private async processNodeDeactivated(event: NodeManagerEvent, queryRunner?: QueryRunner): Promise<void> {
    const nodeAddress = event.args?.node;
    if (!nodeAddress) return;

    const addressRecord = await this.getOrCreateAddress(nodeAddress, queryRunner);
    
    const manager = queryRunner ? queryRunner.manager : AppDataSource.manager;
    const edgeNodeRepo = manager.getRepository(EdgeNode);
    
    const edgeNode = await edgeNodeRepo.findOne({ 
      where: { addressId: addressRecord.id } 
    });
    
    if (edgeNode) {
      edgeNode.isActive = false;
      edgeNode.deactivationBlock = event.blockNumber;
      edgeNode.deactivationTimestamp = event.timestamp;
      await edgeNodeRepo.save(edgeNode);
    }
  }

  private async processNodeMarkedAsFaulty(event: NodeManagerEvent, queryRunner?: QueryRunner): Promise<void> {
    const nodeAddress = event.args?.node;
    if (!nodeAddress) return;

    const addressRecord = await this.getOrCreateAddress(nodeAddress, queryRunner);
    
    const manager = queryRunner ? queryRunner.manager : AppDataSource.manager;
    const edgeNodeRepo = manager.getRepository(EdgeNode);
    
    const edgeNode = await edgeNodeRepo.findOne({ 
      where: { addressId: addressRecord.id } 
    });
    
    if (edgeNode) {
      edgeNode.isFaulty = true;
      edgeNode.faultyBlock = event.blockNumber;
      edgeNode.faultyTimestamp = event.timestamp;
      await edgeNodeRepo.save(edgeNode);
    }
  }

  private async processFaultyNodeRecovered(event: NodeManagerEvent, queryRunner?: QueryRunner): Promise<void> {
    const nodeAddress = event.args?.node;
    if (!nodeAddress) return;

    const addressRecord = await this.getOrCreateAddress(nodeAddress, queryRunner);
    
    const manager = queryRunner ? queryRunner.manager : AppDataSource.manager;
    const edgeNodeRepo = manager.getRepository(EdgeNode);
    
    const edgeNode = await edgeNodeRepo.findOne({ 
      where: { addressId: addressRecord.id } 
    });
    
    if (edgeNode) {
      edgeNode.isFaulty = false;
      edgeNode.recoveryBlock = event.blockNumber;
      edgeNode.recoveryTimestamp = event.timestamp;
      await edgeNodeRepo.save(edgeNode);
    }
  }

  private async processTFuelStaked(event: NodeManagerEvent, queryRunner?: QueryRunner): Promise<void> {
    const nodeAddress = event.args?.node;
    const amount = event.args?.amount;
    if (!nodeAddress || !amount) return;

    const addressRecord = await this.getOrCreateAddress(nodeAddress, queryRunner);
    
    const manager = queryRunner ? queryRunner.manager : AppDataSource.manager;
    const edgeNodeRepo = manager.getRepository(EdgeNode);
    
    const edgeNode = await edgeNodeRepo.findOne({ 
      where: { addressId: addressRecord.id } 
    });
    
    if (edgeNode) {
      const currentTotal = BigInt(edgeNode.totalStaked);
      const newAmount = BigInt(amount);
      edgeNode.totalStaked = (currentTotal + newAmount).toString();
      edgeNode.unstakeBlock = null; // Clear unstake block when staking
      await edgeNodeRepo.save(edgeNode);
    }
  }

  private async processTFuelUnstaked(event: NodeManagerEvent, queryRunner?: QueryRunner): Promise<void> {
    const nodeAddress = event.args?.node;
    const amount = event.args?.amount;
    if (!nodeAddress || !amount) return;

    const addressRecord = await this.getOrCreateAddress(nodeAddress, queryRunner);
    
    const manager = queryRunner ? queryRunner.manager : AppDataSource.manager;
    const edgeNodeRepo = manager.getRepository(EdgeNode);
    
    const edgeNode = await edgeNodeRepo.findOne({ 
      where: { addressId: addressRecord.id } 
    });
    
    if (edgeNode) {
      const currentTotal = BigInt(edgeNode.totalUnstaked);
      const newAmount = BigInt(amount);
      edgeNode.totalUnstaked = (currentTotal + newAmount).toString();
      edgeNode.unstakeBlock = (BigInt(event.blockNumber) + BigInt(28800)).toString();
      await edgeNodeRepo.save(edgeNode);
    }
  }

  private async processKeeperPaid(event: NodeManagerEvent, queryRunner?: QueryRunner): Promise<void> {
    const keeperAddress = event.args?.keeper;
    const tipPaid = event.args?.tipPaid;
    if (!keeperAddress || !tipPaid) return;

    const addressRecord = await this.getOrCreateAddress(keeperAddress, queryRunner);
    
    const manager = queryRunner ? queryRunner.manager : AppDataSource.manager;
    const userRepo = manager.getRepository(User);
    
    // Note: Edge nodes no longer track keeper fees earned in the edge_nodes table

    // Also update user if keeper is a user
    const user = await userRepo.findOne({ 
      where: { addressId: addressRecord.id } 
    });
    
    if (user) {
      const currentTotal = BigInt(user.totalKeeperFeesEarned);
      const newAmount = BigInt(tipPaid);
      user.totalKeeperFeesEarned = (currentTotal + newAmount).toString();
      await userRepo.save(user);
    }
  }

  private async processCreditAssigned(event: NodeManagerEvent, queryRunner?: QueryRunner): Promise<void> {
    const userAddress = event.args?.user;
    const queueIndex = event.args?.queueIndex;
    const amount = event.args?.amount;
    if (!userAddress || !queueIndex || !amount) return;

    const addressRecord = await this.getOrCreateAddress(userAddress, queryRunner);
    
    const manager = queryRunner ? queryRunner.manager : AppDataSource.manager;
    const redemptionQueueRepo = manager.getRepository(RedemptionQueue);
    
    // Find redemption queue entry by queueIndex
    const redemption = await redemptionQueueRepo.findOne({
      where: {
        userAddressId: addressRecord.id,
        queueIndex: queueIndex,
        status: RedemptionStatus.PENDING
      }
    });

    if (redemption) {
      // Check if unlock block has passed
      if (BigInt(event.blockNumber) >= BigInt(redemption.unlockBlockNumber)) {
        redemption.status = RedemptionStatus.CREDITED;
        redemption.creditedBlock = event.blockNumber;
        redemption.creditedTimestamp = event.timestamp;
        await redemptionQueueRepo.save(redemption);
        
        console.log(`Marked redemption ${redemption.id} as credited for user ${userAddress}`);
      }
    }
  }

  private async processKeeperCredited(event: NodeManagerEvent, queryRunner?: QueryRunner): Promise<void> {
    const keeperAddress = event.args?.keeper;
    const tipPaid = event.args?.tipPaid;
    if (!keeperAddress || !tipPaid) return;

    const addressRecord = await this.getOrCreateAddress(keeperAddress, queryRunner);

    const manager = queryRunner ? queryRunner.manager : AppDataSource.manager;
    const userRepo = manager.getRepository(User);

    // Also update user if keeper is a user
    const user = await userRepo.findOne({ 
      where: { addressId: addressRecord.id } 
    });
    
    if (user) {
      const currentTotal = BigInt(user.totalKeeperFeesEarned);
      const newAmount = BigInt(tipPaid);
      user.totalKeeperFeesEarned = (currentTotal + newAmount).toString();
      await userRepo.save(user);
    }
  }

  // sTFuel Event Handlers

  private async processTransfer(event: StfuelEvent, queryRunner?: QueryRunner): Promise<void> {
    const fromAddress = event.args?.from;
    const toAddress = event.args?.to;
    const value = event.args?.value;
    if (!fromAddress || !toAddress || !value) return;

    const fromAddressRecord = await this.getOrCreateAddress(fromAddress, queryRunner);
    const toAddressRecord = await this.getOrCreateAddress(toAddress, queryRunner);
    const transferAmount = BigInt(value);

    const manager = queryRunner ? queryRunner.manager : AppDataSource.manager;
    const userRepo = manager.getRepository(User);

    // Update sender balance (if not zero address)
    if (fromAddress !== '0x0000000000000000000000000000000000000000') {
      let fromUser = await userRepo.findOne({ 
        where: { addressId: fromAddressRecord.id } 
      });
      
      if (!fromUser) {
        // Create user if they don't exist
        fromUser = userRepo.create({
          addressId: fromAddressRecord.id,
          stfuelBalance: '0',
          totalDeposited: '0',
          totalWithdrawn: '0',
          totalMinted: '0',
          totalBurned: '0',
          totalKeeperFeesEarned: '0',
          totalReferralFeesEarned: '0',
          totalEnteringFeesPaid: '0',
          totalExitFeesPaid: '0',
          creditsAvailable: '0',
          firstActivityBlock: event.blockNumber,
          firstActivityTimestamp: event.timestamp
        });
      }
      
      const currentBalance = BigInt(fromUser.stfuelBalance);
      fromUser.stfuelBalance = (currentBalance - transferAmount).toString();
      fromUser.lastActivityBlock = event.blockNumber;
      fromUser.lastActivityTimestamp = event.timestamp;
      await userRepo.save(fromUser);
    }

    // Update receiver balance (if not zero address)
    if (toAddress !== '0x0000000000000000000000000000000000000000') {
      let toUser = await userRepo.findOne({ 
        where: { addressId: toAddressRecord.id } 
      });
      
      if (!toUser) {
        // Create user if they don't exist
        toUser = userRepo.create({
          addressId: toAddressRecord.id,
          stfuelBalance: '0',
          totalDeposited: '0',
          totalWithdrawn: '0',
          totalMinted: '0',
          totalBurned: '0',
          totalKeeperFeesEarned: '0',
          totalReferralFeesEarned: '0',
          totalEnteringFeesPaid: '0',
          totalExitFeesPaid: '0',
          creditsAvailable: '0',
          firstActivityBlock: event.blockNumber,
          firstActivityTimestamp: event.timestamp
        });
      }
      
      const currentBalance = BigInt(toUser.stfuelBalance);
      toUser.stfuelBalance = (currentBalance + transferAmount).toString();
      toUser.lastActivityBlock = event.blockNumber;
      toUser.lastActivityTimestamp = event.timestamp;
      await userRepo.save(toUser);
    }
  }

  private async processMinted(event: StfuelEvent, queryRunner?: QueryRunner): Promise<void> {
    const userAddress = event.args?.user;
    const tfuelIn = event.args?.tfuelIn;
    const sharesOut = event.args?.sharesOut;
    const feeShares = event.args?.feeShares;
    if (!userAddress || !tfuelIn || !sharesOut || !feeShares) return;

    const addressRecord = await this.getOrCreateAddress(userAddress, queryRunner);
    
    const manager = queryRunner ? queryRunner.manager : AppDataSource.manager;
    const userRepo = manager.getRepository(User);
    
    let user = await userRepo.findOne({ 
      where: { addressId: addressRecord.id } 
    });
    
    if (!user) {
      user = userRepo.create({
        addressId: addressRecord.id,
        stfuelBalance: '0',
        totalDeposited: '0',
        totalWithdrawn: '0',
        totalMinted: '0',
        totalBurned: '0',
        totalKeeperFeesEarned: '0',
        totalReferralFeesEarned: '0',
        totalEnteringFeesPaid: '0',
        totalExitFeesPaid: '0',
        creditsAvailable: '0',
        firstActivityBlock: event.blockNumber,
        firstActivityTimestamp: event.timestamp
      });
    }

    // Update user stats
    const currentDeposited = BigInt(user.totalDeposited);
    const currentMinted = BigInt(user.totalMinted);
    const currentFees = BigInt(user.totalEnteringFeesPaid);
    
    user.totalDeposited = (currentDeposited + BigInt(tfuelIn)).toString(); // TFuel amounts
    user.totalMinted = (currentMinted + BigInt(sharesOut)).toString(); // sTFuel amounts
    user.totalEnteringFeesPaid = (currentFees + BigInt(feeShares)).toString();
    // Note: stfuelBalance is updated via Transfer events, not here to avoid double counting
    user.lastActivityBlock = event.blockNumber;
    user.lastActivityTimestamp = event.timestamp;
    
    await userRepo.save(user);
  }

  private async processBurnQueued(event: StfuelEvent, queryRunner?: QueryRunner): Promise<void> {
    const userAddress = event.args?.user;
    const sharesBurned = event.args?.sharesBurned;
    const tfuelOut = event.args?.tfuelOut;
    const tip = event.args?.tip;
    const queueIndex = event.args?.queueIndex;
    if (!userAddress || !sharesBurned || !tfuelOut || !tip || !queueIndex) return;

    const addressRecord = await this.getOrCreateAddress(userAddress, queryRunner);
    
    const manager = queryRunner ? queryRunner.manager : AppDataSource.manager;
    const redemptionQueueRepo = manager.getRepository(RedemptionQueue);
    const userRepo = manager.getRepository(User);
    
    // Calculate unlock block number (requestBlock + 28800)
    const unlockBlockNumber = (BigInt(event.blockNumber) + BigInt(28800)).toString();
    
    // Create redemption queue entry
    const redemptionEntry = redemptionQueueRepo.create({
      userAddressId: addressRecord.id,
      requestBlock: event.blockNumber,
      requestTimestamp: event.timestamp,
      stfuelAmountBurned: sharesBurned,
      tfuelAmountExpected: tfuelOut,
      keepersTipFee: tip,
      unlockBlockNumber: unlockBlockNumber,
      queueIndex: queueIndex,
      status: RedemptionStatus.PENDING
    });
    
    await redemptionQueueRepo.save(redemptionEntry);

    // Update user stats
    const user = await userRepo.findOne({ 
      where: { addressId: addressRecord.id } 
    });
    
    if (user) {
      const currentBurned = BigInt(user.totalBurned);
      const currentExitFees = BigInt(user.totalExitFeesPaid);
      
      user.totalBurned = (currentBurned + BigInt(sharesBurned)).toString(); // sTFuel amounts
      user.totalExitFeesPaid = (currentExitFees + BigInt(tip)).toString();
      // Note: stfuelBalance is updated via Transfer event to zero address, not here to avoid double counting
      user.lastActivityBlock = event.blockNumber;
      user.lastActivityTimestamp = event.timestamp;
      
      await userRepo.save(user);
    }
  }

  private async processReferralRewarded(event: StfuelEvent, queryRunner?: QueryRunner): Promise<void> {
    const referrerAddress = event.args?.referrer;
    const rewardShares = event.args?.rewardShares;
    if (!referrerAddress || !rewardShares) return;

    const addressRecord = await this.getOrCreateAddress(referrerAddress, queryRunner);
    
    const manager = queryRunner ? queryRunner.manager : AppDataSource.manager;
    const userRepo = manager.getRepository(User);
    
    const user = await userRepo.findOne({ 
      where: { addressId: addressRecord.id } 
    });
    
    if (user) {
      const currentRewards = BigInt(user.totalReferralFeesEarned);
      const newReward = BigInt(rewardShares);
      user.totalReferralFeesEarned = (currentRewards + newReward).toString();
      await userRepo.save(user);
    }
  }

  private async processBurnAndDirectRedeemed(event: StfuelEvent, queryRunner?: QueryRunner): Promise<void> {
    const userAddress = event.args?.user;
    const sharesBurned = event.args?.sharesBurned;
    const tfuelAmount = event.args?.tfuelAmount;
    const fee = event.args?.fee;
    if (!userAddress || !sharesBurned || !tfuelAmount || !fee) return;

    const addressRecord = await this.getOrCreateAddress(userAddress, queryRunner);
    
    const manager = queryRunner ? queryRunner.manager : AppDataSource.manager;
    const userRepo = manager.getRepository(User);
    
    const user = await userRepo.findOne({ 
      where: { addressId: addressRecord.id } 
    });
    
    if (user) {
      const currentBurned = BigInt(user.totalBurned);
      const currentFees = BigInt(user.totalExitFeesPaid);
      const currentWithdrawn = BigInt(user.totalWithdrawn);
      
      user.totalBurned = (currentBurned + BigInt(sharesBurned)).toString(); // sTFuel amounts
      user.totalExitFeesPaid = (currentFees + BigInt(fee)).toString();
      user.totalWithdrawn = (currentWithdrawn + BigInt(tfuelAmount)).toString(); // TFuel amounts
      // Note: stfuelBalance is updated via Transfer event to zero address, not here to avoid double counting
      user.lastActivityBlock = event.blockNumber;
      user.lastActivityTimestamp = event.timestamp;
      
      await userRepo.save(user);
    }
  }

  private async processClaimed(event: StfuelEvent, queryRunner?: QueryRunner): Promise<void> {
    const userAddress = event.args?.user;
    const amount = event.args?.amount;
    if (!userAddress || !amount) return;

    const addressRecord = await this.getOrCreateAddress(userAddress, queryRunner);
    
    const manager = queryRunner ? queryRunner.manager : AppDataSource.manager;
    const userRepo = manager.getRepository(User);
    
    const user = await userRepo.findOne({ 
      where: { addressId: addressRecord.id } 
    });
    
    if (user) {
      const currentWithdrawn = BigInt(user.totalWithdrawn);
      user.totalWithdrawn = (currentWithdrawn + BigInt(amount)).toString(); // TFuel amounts
      user.lastActivityBlock = event.blockNumber;
      user.lastActivityTimestamp = event.timestamp;
      await userRepo.save(user);
    }
  }

  private async processCreditsClaimed(event: StfuelEvent, queryRunner?: QueryRunner): Promise<void> {
    const userAddress = event.args?.user;
    const amount = event.args?.amount;
    if (!userAddress || !amount) return;

    const addressRecord = await this.getOrCreateAddress(userAddress, queryRunner);
    
    const manager = queryRunner ? queryRunner.manager : AppDataSource.manager;
    const userRepo = manager.getRepository(User);
    
    const user = await userRepo.findOne({ 
      where: { addressId: addressRecord.id } 
    });
    
    if (user) {
      const currentCredits = BigInt(user.creditsAvailable);
      const currentWithdrawn = BigInt(user.totalWithdrawn);
      
      user.creditsAvailable = (currentCredits - BigInt(amount)).toString();
      user.totalWithdrawn = (currentWithdrawn + BigInt(amount)).toString(); // TFuel amounts
      user.lastActivityBlock = event.blockNumber;
      user.lastActivityTimestamp = event.timestamp;
      await userRepo.save(user);
    }
  }

  private async processReferralAddressSet(event: StfuelEvent, queryRunner?: QueryRunner): Promise<void> {
    // This is optional enhancement - for now we just log it
    console.log(`Referral address set event processed for block ${event.blockNumber}`);
  }
}

export default NormalizedEventProcessor;
