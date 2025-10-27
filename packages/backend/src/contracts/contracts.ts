import { ethers } from 'ethers';
import { config } from '../config/environment';
import nodeManagerAbi from './nodeManager.abi.json';
import stfuelAbi from './stfuel.abi.json';

export class ContractManager {
  private provider: ethers.JsonRpcProvider;
  private nodeManagerContract: ethers.Contract;
  private stfuelContract: ethers.Contract;
  private currentRpcIndex: number = 0;

  constructor() {
    this.provider = this.createProvider();
    
    // Allow empty addresses for testing - contracts will be created but won't be used
    if (!config.nodeManagerAddress) {
      console.warn('NODE_MANAGER_ADDRESS not set - NodeManager events will not be tracked');
    }
    
    if (!config.stfuelAddress) {
      console.warn('STFUEL_ADDRESS not set - sTFuel events will not be tracked');
    }

    // Create contracts only if addresses are provided
    if (config.nodeManagerAddress) {
      this.nodeManagerContract = new ethers.Contract(
        config.nodeManagerAddress,
        nodeManagerAbi,
        this.provider
      );
    } else {
      // Create a dummy contract for testing
      this.nodeManagerContract = new ethers.Contract(
        '0x0000000000000000000000000000000000000000',
        nodeManagerAbi,
        this.provider
      );
    }

    if (config.stfuelAddress) {
      this.stfuelContract = new ethers.Contract(
        config.stfuelAddress,
        stfuelAbi,
        this.provider
      );
    } else {
      // Create a dummy contract for testing
      this.stfuelContract = new ethers.Contract(
        '0x0000000000000000000000000000000000000000',
        stfuelAbi,
        this.provider
      );
    }
  }

  private createProvider(): ethers.JsonRpcProvider {
    const rpcUrl = config.thetaRpcUrls[this.currentRpcIndex];
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Set timeout
    provider._getConnection().timeout = config.rpcTimeout;
    
    return provider;
  }

  private async switchToNextRpc(): Promise<void> {
    this.currentRpcIndex = (this.currentRpcIndex + 1) % config.thetaRpcUrls.length;
    console.log(`Switching to RPC: ${config.thetaRpcUrls[this.currentRpcIndex]}`);
    
    this.provider = this.createProvider();
    
    // Recreate contracts with new provider
    if (config.nodeManagerAddress) {
      this.nodeManagerContract = new ethers.Contract(
        config.nodeManagerAddress,
        nodeManagerAbi,
        this.provider
      );
    } else {
      this.nodeManagerContract = new ethers.Contract(
        '0x0000000000000000000000000000000000000000',
        nodeManagerAbi,
        this.provider
      );
    }

    if (config.stfuelAddress) {
      this.stfuelContract = new ethers.Contract(
        config.stfuelAddress,
        stfuelAbi,
        this.provider
      );
    } else {
      this.stfuelContract = new ethers.Contract(
        '0x0000000000000000000000000000000000000000',
        stfuelAbi,
        this.provider
      );
    }
  }

  private async retryWithFallback<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < config.rpcRetryAttempts; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        console.warn(`${operationName} failed on attempt ${attempt + 1}:`, error.message);
        
        if (attempt < config.rpcRetryAttempts - 1) {
          // Switch to next RPC if available
          if (config.thetaRpcUrls.length > 1) {
            await this.switchToNextRpc();
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, config.rpcRetryDelay));
        }
      }
    }
    
    throw new Error(`${operationName} failed after ${config.rpcRetryAttempts} attempts. Last error: ${lastError?.message}`);
  }

  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  getNodeManagerContract(): ethers.Contract {
    return this.nodeManagerContract;
  }

  getStfuelContract(): ethers.Contract {
    return this.stfuelContract;
  }

  // Helper method to get contract state for snapshots
  async getContractState(blockNumber?: number): Promise<{
    stfuelTotalSupply: bigint;
    tfuelBackingAmount: bigint;
    tfuelStakedAmount: bigint;
  }> {
    const blockTag = blockNumber ? blockNumber : 'latest';
    
    return this.retryWithFallback(async () => {
      // Get sTFuel total supply
      const stfuelTotalSupply = await this.stfuelContract.totalSupply({ blockTag });
      
      // Get TFuel backing amount (this would need to be implemented based on contract logic)
      // For now, we'll assume it's the same as total supply or needs to be calculated differently
      const tfuelBackingAmount = stfuelTotalSupply;
      
      // Get TFuel staked amount (this would need to be calculated from staking events or contract state)
      // For now, we'll return 0 and calculate from events
      const tfuelStakedAmount = BigInt(0);

      return {
        stfuelTotalSupply,
        tfuelBackingAmount,
        tfuelStakedAmount,
      };
    }, 'getContractState');
  }

  // Get TFuel backing amount - only for live data, 0 for historical
  async getTfuelBackingAmount(blockNumber?: number, isLive: boolean = false): Promise<bigint> {
    if (!isLive || !blockNumber) {
      // For historical data, we can't get this information
      return BigInt(0);
    }
    
    const blockTag = blockNumber ? blockNumber : 'latest';
    
    return this.retryWithFallback(async () => {
      try {
        // Try the primary method first
        return await this.nodeManagerContract.getNetAssetsBackingShares({ blockTag });
      } catch (error: any) {
        // If it fails (e.g., out of gas), fallback to the safe method
        console.warn('getNetAssetsBackingShares failed, using fallback:', error.message);
        const safeResult = await this.nodeManagerContract.getNetAssetsBackingSharesSafe({ blockTag });
        return safeResult.netAssets;
      }
    }, 'getTfuelBackingAmount');
  }
}

export default ContractManager;
