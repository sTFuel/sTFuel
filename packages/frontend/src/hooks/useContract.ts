import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getStfuelContract, getNodeManagerContract, getReferralNFTContract, contractFunctions, getContractAddresses } from '@/contracts/sTFuelContract';
import { stfuelContract, nodeManagerContract, referralNFTContract } from '@/lib/blockchainProvider';
import { formatTFuel, getExplorerUrl } from '@/lib/formatters';

export const useContract = () => {
  const { user, getProvider, getSigner, currentChainId, magic } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [transactionExecuting, setTransactionExecuting] = useState<'mint' | 'burn' | 'burnAndRedeemDirect' | 'setReferralIdToAddress' | 'pokeQueue' | 'stakeTFuel' | 'updateUnstakingNodes' | 'claimTFuel' | null>(null);
  const [pendingTransaction, setPendingTransaction] = useState<{
    type: 'mint' | 'burn' | 'burnAndRedeemDirect' | 'setReferralIdToAddress' | 'pokeQueue' | 'stakeTFuel' | 'updateUnstakingNodes' | 'claimTFuel';
    amount?: string;
    referralId?: string;
    referralAddress?: string;
    fee?: string;
    outputAmount?: string;
    maxNodes?: string;
    contractAddress: string;
    description: string;
    executeFunction: () => Promise<any>;
  } | null>(null);

  // Helper function to parse Minted event from transaction receipt
  const parseMintedEvent = useCallback(async (txReceipt: any, contractAddress: string): Promise<string | null> => {
    try {
      const provider = getProvider();
      if (!provider) {
        return null;
      }
      
      const contract = getStfuelContract(provider);
      const mintedEvent = contract.interface.getEvent('Minted');
      if (!mintedEvent) {
        return null;
      }
      
      const mintedEventTopic = mintedEvent.topicHash;
      
      // Find the Minted event log
      const mintedLog = txReceipt.logs.find((log: any) => 
        log.address.toLowerCase() === contractAddress.toLowerCase() &&
        log.topics && log.topics[0] === mintedEventTopic
      );

      if (mintedLog) {
        // Parse the log using the contract interface
        const parsedLog = contract.interface.parseLog({
          topics: mintedLog.topics,
          data: mintedLog.data
        });

        if (parsedLog && parsedLog.args) {
          // sharesOut is the third argument (index 2) in the Minted event: user, tfuelIn, sharesOut, feeShares
          const sharesOut = parsedLog.args[2]; // sharesOut
          return sharesOut.toString();
        }
      }
    } catch (error) {
      console.warn('Failed to parse Minted event:', error);
    }
    return null;
  }, [getProvider]);

  // Helper function to generate success notification message
  const getSuccessMessage = useCallback((
    type: 'mint' | 'burn' | 'burnAndRedeemDirect' | 'setReferralIdToAddress' | 'pokeQueue' | 'stakeTFuel' | 'updateUnstakingNodes' | 'claimTFuel',
    amount?: string,
    tfuelAmount?: string
  ): string => {
    switch (type) {
      case 'mint':
        if (amount) {
          return `${formatTFuel(amount)} sTFuel have been minted`;
        } else if (tfuelAmount) {
          return `sTFuel have been minted with ${formatTFuel(tfuelAmount)} TFuel`;
        }
        return 'sTFuel have been minted';
      case 'burn':
        return amount ? `${formatTFuel(amount)} sTFuel have been burned` : 'sTFuel have been burned';
      case 'burnAndRedeemDirect':
        return amount ? `${formatTFuel(amount)} sTFuel have been redeemed directly` : 'sTFuel have been redeemed directly';
      case 'setReferralIdToAddress':
        return 'Referral address has been set';
      case 'pokeQueue':
        return 'Withdrawal queue has been updated';
      case 'stakeTFuel':
        return 'TFuel has been staked';
      case 'updateUnstakingNodes':
        return 'Unstaking nodes have been updated';
      case 'claimTFuel':
        return 'TFuel credits have been claimed';
      default:
        return 'Transaction completed successfully';
    }
  }, []);

  // Helper function to generate error notification message
  const getErrorMessage = useCallback((
    type: 'mint' | 'burn' | 'burnAndRedeemDirect' | 'setReferralIdToAddress' | 'pokeQueue' | 'stakeTFuel' | 'updateUnstakingNodes' | 'claimTFuel'
  ): string => {
    switch (type) {
      case 'mint':
        return 'Failed to mint sTFuel';
      case 'burn':
        return 'Failed to redeem sTFuel';
      case 'burnAndRedeemDirect':
        return 'Failed to redeem sTFuel directly';
      case 'setReferralIdToAddress':
        return 'Failed to set referral address';
      case 'pokeQueue':
        return 'Failed to update withdrawal queue';
      case 'stakeTFuel':
        return 'Failed to stake TFuel';
      case 'updateUnstakingNodes':
        return 'Failed to update unstaking nodes';
      case 'claimTFuel':
        return 'Failed to claim TFuel credits';
      default:
        return 'Transaction failed';
    }
  }, []);

  const executeContractFunction = useCallback(async <T>(
    contractFunction: () => Promise<T>,
    operationName: string,
    transactionType?: 'mint' | 'burn' | 'burnAndRedeemDirect' | 'setReferralIdToAddress' | 'pokeQueue' | 'stakeTFuel' | 'updateUnstakingNodes' | 'claimTFuel',
    transactionDetails?: {
      amount?: string;
      referralId?: string;
      referralAddress?: string;
      fee?: string;
      outputAmount?: string;
      maxNodes?: string;
    }
  ): Promise<T | null> => {
    setLoading(true);
    setError(null);
    if (transactionType) {
      setTransactionExecuting(transactionType);
    }
    
    try {
      const result = await contractFunction();
      
      // If result is a transaction response, wait for it to be mined
      if (result && typeof result === 'object' && 'wait' in result) {
        try {
          const txResponse = result as any;
          const txHash = txResponse.hash;
          
          // Wait for transaction to be mined
          const txReceipt = await txResponse.wait();
          
          // Show success notification with transaction link
          if (transactionType) {
            let message: string;
            
            // For mint transactions, try to get the actual sTFuel amount from the event
            if (transactionType === 'mint') {
              const addresses = getContractAddresses();
              const stfuelAmount = await parseMintedEvent(txReceipt, addresses.stfuel);
              if (stfuelAmount) {
                message = getSuccessMessage(transactionType, stfuelAmount);
              } else {
                // Fallback to showing TFuel amount if we can't parse the event
                message = getSuccessMessage(transactionType, undefined, transactionDetails?.amount);
              }
            } else {
              message = getSuccessMessage(transactionType, transactionDetails?.amount);
            }
            
            const explorerUrl = getExplorerUrl(txHash, currentChainId);
            
            toast.success(
              (t) => React.createElement(
                'div',
                null,
                React.createElement('div', null, message),
                explorerUrl && React.createElement(
                  'a',
                  {
                    href: explorerUrl,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                    className: 'text-sm underline mt-1 block',
                    onClick: (e: React.MouseEvent) => {
                      e.stopPropagation();
                      toast.dismiss(t.id);
                    }
                  },
                  'View Transaction'
                )
              ),
              {
                duration: 5000,
              }
            );
          }
        } catch (waitError: any) {
          // Transaction might have been reverted, but we still got a response
          console.warn('Transaction wait failed (might be reverted):', waitError);
          if (transactionType) {
            toast.error(getErrorMessage(transactionType), {
              duration: 5000,
            });
          }
        }
      }
      
      return result;
    } catch (err: any) {
      console.error(`${operationName} failed:`, err);
      const errorMessage = err.message || `${operationName} failed`;
      setError(errorMessage);
      
      // Show error notification
      if (transactionType) {
        toast.error(getErrorMessage(transactionType), {
          duration: 5000,
        });
      } else {
        toast.error(errorMessage, {
          duration: 5000,
        });
      }
      
      return null;
    } finally {
      // Clear executing state after transaction completes
      if (transactionType) {
        setTransactionExecuting(null);
      }
      setLoading(false);
    }
  }, [currentChainId, getSuccessMessage, getErrorMessage, parseMintedEvent]);

  const showTransactionConfirmation = useCallback(async (
    transactionDetails: {
      type: 'mint' | 'burn' | 'burnAndRedeemDirect' | 'setReferralIdToAddress' | 'pokeQueue' | 'stakeTFuel' | 'updateUnstakingNodes' | 'claimTFuel';
      amount?: string;
      referralId?: string;
      referralAddress?: string;
      fee?: string;
      outputAmount?: string;
      maxNodes?: string;
      contractAddress: string;
      description: string;
    },
    executeFunction: () => Promise<any>
  ) => {
    setPendingTransaction({
      ...transactionDetails,
      executeFunction
    });
    setShowConfirmation(true);
  }, []);

  const handleTransactionConfirm = useCallback(async () => {
    if (!pendingTransaction) return;
    
    try {
      // Set the transaction as executing
      setTransactionExecuting(pendingTransaction.type);
      setLoading(true);
      setError(null);
      
      // Execute the transaction
      const result = await pendingTransaction.executeFunction();
      
      // If result is a transaction response, wait for it to be mined
      if (result && typeof result === 'object' && 'wait' in result) {
        try {
          const txResponse = result as any;
          const txHash = txResponse.hash;
          
          // Wait for transaction to be mined
          const txReceipt = await txResponse.wait();
          
          // Show success notification with transaction link
          let message: string;
          
          // For mint transactions, try to get the actual sTFuel amount from the event
          if (pendingTransaction.type === 'mint') {
            const addresses = getContractAddresses();
            const stfuelAmount = await parseMintedEvent(txReceipt, addresses.stfuel);
            if (stfuelAmount) {
              message = getSuccessMessage(pendingTransaction.type, stfuelAmount);
            } else {
              // Fallback to showing TFuel amount if we can't parse the event
              message = getSuccessMessage(pendingTransaction.type, undefined, pendingTransaction.amount);
            }
          } else {
            message = getSuccessMessage(pendingTransaction.type, pendingTransaction.amount);
          }
          
          const explorerUrl = getExplorerUrl(txHash, currentChainId);
          
          toast.success(
            (t) => React.createElement(
              'div',
              null,
              React.createElement('div', null, message),
              explorerUrl && React.createElement(
                'a',
                {
                  href: explorerUrl,
                  target: '_blank',
                  rel: 'noopener noreferrer',
                  className: 'text-sm underline mt-1 block',
                  onClick: (e: React.MouseEvent) => {
                    e.stopPropagation();
                    toast.dismiss(t.id);
                  }
                },
                'View Transaction'
              )
            ),
            {
              duration: 5000,
            }
          );
        } catch (waitError: any) {
          // Transaction might have been reverted, but we still got a response
          console.warn('Transaction wait failed (might be reverted):', waitError);
          toast.error(getErrorMessage(pendingTransaction.type), {
            duration: 5000,
          });
        }
      }
      
      // Close the modal
      setShowConfirmation(false);
      setPendingTransaction(null);
    } catch (error: any) {
      console.error('Transaction execution failed:', error);
      const errorMessage = error.message || 'Transaction execution failed';
      setError(errorMessage);
      
      // Show error notification
      toast.error(getErrorMessage(pendingTransaction.type), {
        duration: 5000,
      });
      
      throw error;
    } finally {
      // Clear the executing state after transaction completes
      setTransactionExecuting(null);
      setLoading(false);
    }
  }, [pendingTransaction, currentChainId, getSuccessMessage, getErrorMessage, parseMintedEvent]);

  const handleTransactionCancel = useCallback(() => {
    setShowConfirmation(false);
    setPendingTransaction(null);
    // Don't clear transactionExecuting here - it should only be cleared after execution completes
  }, []);

  const getContractInstances = useCallback(async () => {
    const provider = getProvider();
    const signer = await getSigner();
    
    if (!provider) {
      return null;
    }

    return {
      stfuelContract: getStfuelContract(signer || provider),
      nodeManagerContract: getNodeManagerContract(signer || provider),
      referralNFTContract: getReferralNFTContract(signer || provider),
      provider,
      signer,
    };
  }, [getProvider, getSigner]);

  // Contract read functions - use static RPC provider for better performance
  const readContract = useCallback(async <T>(
    readFunction: (contract: any) => Promise<T>,
    contractType: 'stfuel' | 'nodeManager' | 'referralNFT' = 'stfuel'
  ): Promise<T | null> => {
    return executeContractFunction(async () => {
      let contract;
      switch (contractType) {
        case 'stfuel':
          contract = stfuelContract;
          break;
        case 'nodeManager':
          contract = nodeManagerContract;
          break;
        case 'referralNFT':
          if (!referralNFTContract) {
            console.warn('Referral NFT contract not configured - returning null');
            return null;
          }
          contract = referralNFTContract;
          break;
        default:
          throw new Error('Invalid contract type');
      }

      // Don't call the function if contract is null
      if (!contract) {
        return null;
      }

      return await readFunction(contract);
    }, `Read ${contractType} contract`);
  }, [executeContractFunction, getContractInstances]);

  // Contract write functions
  const writeContract = useCallback(async <T>(
    writeFunction: (contract: any, signer: ethers.Signer) => Promise<T>,
    contractType: 'stfuel' | 'nodeManager' | 'referralNFT' = 'stfuel',
    transactionDetails?: {
      type: 'mint' | 'burn' | 'burnAndRedeemDirect' | 'setReferralIdToAddress' | 'pokeQueue' | 'stakeTFuel' | 'updateUnstakingNodes' | 'claimTFuel';
      amount?: string;
      referralId?: string;
      referralAddress?: string;
      fee?: string;
      outputAmount?: string;
      maxNodes?: string;
      description: string;
    }
  ): Promise<T | null> => {
    if (!user?.isConnected) {
      setError('Wallet not connected');
      return null;
    }

    const executeTransaction = async () => {
      // Check if we're on a supported network
      if (currentChainId && currentChainId !== 365 && currentChainId !== 361) {
        throw new Error(`Unsupported network detected (${currentChainId}). Please switch to Theta Testnet (365) or Theta Mainnet (361).`);
      }

      const contractInstances = await getContractInstances();
      
      if (!contractInstances) {
        throw new Error('No provider available');
      }
      
      const { stfuelContract, nodeManagerContract, referralNFTContract, signer } = contractInstances;
      
      if (!signer) {
        throw new Error('No signer available');
      }

      let contract;
      switch (contractType) {
        case 'stfuel':
          contract = stfuelContract;
          break;
        case 'nodeManager':
          contract = nodeManagerContract;
          break;
        case 'referralNFT':
          contract = referralNFTContract;
          break;
        default:
          throw new Error('Invalid contract type');
      }

      return await writeFunction(contract, signer);
    };

    // If Magic wallet and transaction details provided, show confirmation
    if (magic && transactionDetails) {
      const addresses = getContractAddresses();
      const contractAddress = addresses[contractType] || '';
      
      await showTransactionConfirmation({
        ...transactionDetails,
        contractAddress,
      }, executeTransaction);
      
      return null; // Transaction will be executed after confirmation
    }

    // For WalletConnect or when no transaction details, execute directly
    return executeContractFunction(
      executeTransaction,
      `Write ${contractType} contract`,
      transactionDetails?.type,
      transactionDetails
    );
  }, [executeContractFunction, getContractInstances, user?.isConnected, currentChainId, magic, showTransactionConfirmation]);

  // Specific contract functions
  const mint = useCallback(async (amount: string, referralId?: string) => {
    return writeContract(async (contract, signer) => {
      if (!user?.address) {
        throw new Error('User address not available');
      }
      if (referralId) {
        return contractFunctions.mintWithReferral(contract, signer, referralId, amount);
      } else {
        return contractFunctions.mint(contract, signer, amount);
      }
    }, 'stfuel', {
      type: 'mint',
      amount,
      referralId,
      description: referralId ? `Mint sTFuel with Referral ID ${referralId}` : 'Mint sTFuel'
    });
  }, [writeContract, user?.address]);

  const burn = useCallback(async (amount: string) => {
    return writeContract(async (contract, signer) => {
      return contractFunctions.burn(contract, signer, amount);
    }, 'stfuel', {
      type: 'burn',
      amount,
      description: 'Burn sTFuel (Normal Redeem)'
    });
  }, [writeContract]);

  const burnAndRedeemDirect = useCallback(async (amount: string, fee?: string, outputAmount?: string) => {
    return writeContract(async (contract, signer) => {
      return contractFunctions.burnAndRedeemDirect(contract, signer, amount);
    }, 'stfuel', {
      type: 'burnAndRedeemDirect',
      amount,
      fee,
      outputAmount,
      description: 'Burn sTFuel and Redeem Directly'
    });
  }, [writeContract]);

  const setReferralIdToAddress = useCallback(async (tokenId: string, wallet: string) => {
    return writeContract(async (contract, signer) => {
      return contractFunctions.setReferralIdToAddress(contract, signer, tokenId, wallet);
    }, 'stfuel', {
      type: 'setReferralIdToAddress',
      referralId: tokenId,
      referralAddress: wallet,
      description: 'Set Referral Address'
    });
  }, [writeContract]);

  const getBalance = useCallback(async (address: string) => {
    return readContract(async (contract) => {
      return contractFunctions.balanceOf(contract, address);
    }, 'stfuel');
  }, [readContract]);

  const getTotalSupply = useCallback(async () => {
    return readContract(async (contract) => {
      return contractFunctions.totalSupply(contract);
    }, 'stfuel');
  }, [readContract]);

  const getTotalAssetsTFuel = useCallback(async () => {
    return readContract(async (contract) => {
      return contractFunctions.totalAssetsTFuel(contract);
    }, 'stfuel');
  }, [readContract]);

  const getPPS = useCallback(async () => {
    return readContract(async (contract) => {
      return contractFunctions.pps(contract);
    }, 'stfuel');
  }, [readContract]);

  const getMintFeeBps = useCallback(async () => {
    return readContract(async (contract) => {
      return contractFunctions.mintFeeBps(contract);
    }, 'stfuel');
  }, [readContract]);

  const getDirectRedeemFeeBps = useCallback(async () => {
    return readContract(async (contract) => {
      return contractFunctions.directRedeemFeeBps(contract);
    }, 'stfuel');
  }, [readContract]);

  const getOwnedNFTs = useCallback(async (owner: string) => {
    const result = await readContract(async (contract) => {
      return contractFunctions.getOwnedNFTs(contract, owner);
    }, 'referralNFT');
    
    return result || [];
  }, [readContract]);

  const getReferralAddress = useCallback(async (tokenId: string) => {
    return readContract(async (contract) => {
      return contractFunctions.getReferralAddress(contract, tokenId);
    }, 'stfuel');
  }, [readContract]);

  const canDirectRedeem = useCallback(async (amount: string) => {
    return readContract(async (contract) => {
      return contractFunctions.canDirectRedeem(contract, amount);
    }, 'stfuel');
  }, [readContract]);

  const getNetAssetsBackingShares = useCallback(async () => {
    return readContract(async (contract) => {
      return contractFunctions.getNetAssetsBackingShares(contract);
    }, 'nodeManager');
  }, [readContract]);

  const pokeQueue = useCallback(async (maxItems: string) => {
    return writeContract(async (contract, signer) => {
      return contractFunctions.pokeQueue(contract, signer, maxItems);
    }, 'stfuel', {
      type: 'pokeQueue',
      description: 'Update Withdrawal Queue'
    });
  }, [writeContract]);

  const getTotalTFuelReserved = useCallback(async () => {
    return readContract(async (contract) => {
      return contractFunctions.getTotalTFuelReserved(contract);
    }, 'nodeManager');
  }, [readContract]);

  const unstakedNodesLength = useCallback(async () => {
    return readContract(async (contract) => {
      return contractFunctions.unstakedNodesLength(contract);
    }, 'nodeManager');
  }, [readContract]);

  const updateUnstakingNodes = useCallback(async (maxNodes: string) => {
    return writeContract(async (contract, signer) => {
      return contractFunctions.updateUnstakingNodes(contract, signer, maxNodes);
    }, 'nodeManager', {
      type: 'updateUnstakingNodes',
      maxNodes,
      description: 'Update Unstaking Nodes'
    });
  }, [writeContract]);

  const getKeeperTipMax = useCallback(async () => {
    return readContract(async (contract) => {
      return contractFunctions.keeperTipMax(contract);
    }, 'nodeManager');
  }, [readContract]);

  const getKeeperTipBps = useCallback(async () => {
    return readContract(async (contract) => {
      return contractFunctions.keeperTipBps(contract);
    }, 'nodeManager');
  }, [readContract]);

  const stakeTFuel = useCallback(async () => {
    return writeContract(async (contract, signer) => {
      return contractFunctions.stakeTFuel(contract, signer);
    }, 'nodeManager', {
      type: 'stakeTFuel',
      description: 'Stake TFuel'
    });
  }, [writeContract]);

  const claimTFuel = useCallback(async () => {
    return writeContract(async (contract, signer) => {
      return contractFunctions.claimTFuel(contract, signer);
    }, 'stfuel', {
      type: 'claimTFuel',
      description: 'Claim TFuel Credits'
    });
  }, [writeContract]);

  // Helper function to check if a specific transaction type is executing
  const isTransactionExecuting = useCallback((type: 'mint' | 'burn' | 'burnAndRedeemDirect' | 'setReferralIdToAddress' | 'pokeQueue' | 'stakeTFuel' | 'updateUnstakingNodes' | 'claimTFuel') => {
    return transactionExecuting === type;
  }, [transactionExecuting]);

  return {
    loading,
    error,
    transactionExecuting,
    isTransactionExecuting,
    readContract,
    writeContract,
    mint,
    burn,
    burnAndRedeemDirect,
    setReferralIdToAddress,
    getBalance,
    getTotalSupply,
    getTotalAssetsTFuel,
    getPPS,
    getMintFeeBps,
    getDirectRedeemFeeBps,
    getOwnedNFTs,
    getReferralAddress,
    canDirectRedeem,
    getNetAssetsBackingShares,
    pokeQueue,
    getTotalTFuelReserved,
    unstakedNodesLength,
    updateUnstakingNodes,
    getKeeperTipMax,
    getKeeperTipBps,
    stakeTFuel,
    claimTFuel,
    // Confirmation modal
    showConfirmation,
    pendingTransaction,
    handleTransactionConfirm,
    handleTransactionCancel,
  };
};
