import { ethers } from 'ethers';
import stfuelAbi from '@/contracts/stfuel.abi.json';
import nodeManagerAbi from '@/contracts/nodeManager.abi.json';

// Contract addresses
const STFUEL_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_STFUEL_CONTRACT_ADDRESS || '0x51900b0f79dc8141c02ead7647bc43e8e10406a3';
const NODE_MANAGER_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_NODE_MANAGER_CONTRACT_ADDRESS || '0xedcc06ab18b9bd5b88af451f1bf86f6cf375d0b9';
const REFERRAL_NFT_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_REFERRAL_NFT_CONTRACT_ADDRESS || '';
const RPC_URL = process.env.NEXT_PUBLIC_THETA_RPC_URL || 'https://eth-rpc-api-testnet.thetatoken.org/rpc';

// Create a JSON RPC provider
const provider = new ethers.JsonRpcProvider(RPC_URL);

// ERC721 ABI for referral NFT
const erc721Abi = [
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
];

// Contract instances
export const stfuelContract = new ethers.Contract(STFUEL_CONTRACT_ADDRESS, stfuelAbi, provider);
export const nodeManagerContract = new ethers.Contract(NODE_MANAGER_CONTRACT_ADDRESS, nodeManagerAbi, provider);
export const referralNFTContract = REFERRAL_NFT_CONTRACT_ADDRESS 
  ? new ethers.Contract(REFERRAL_NFT_CONTRACT_ADDRESS, erc721Abi, provider)
  : null;

// Blockchain data functions
export const getBlockchainData = async () => {
  try {
    
    const [
      totalSupply,
      totalStakedTFuel,
      netAssetsBackingShares,
      usedNodes,
    ] = await Promise.all([
      stfuelContract.totalSupply(),
      nodeManagerContract.totalStakedTFuel(),
      nodeManagerContract.getNetAssetsBackingShares(),
      nodeManagerContract.usedNodes(),
    ]);

    console.log('Blockchain data fetched successfully:', {
      totalSupply: totalSupply.toString(),
      totalStakedTFuel: totalStakedTFuel.toString(),
      netAssetsBackingShares: netAssetsBackingShares.toString(),
      usedNodes: Number(usedNodes)
    });

    return {
      totalSupply: totalSupply.toString(),
      totalStakedTFuel: totalStakedTFuel.toString(),
      netAssetsBackingShares: netAssetsBackingShares.toString(),
      usedNodes: Number(usedNodes)
    };
  } catch (error: any) {
    console.error('Error fetching blockchain data:', error);
    console.error('Error details:', {
      message: error?.message || 'Unknown error',
      code: error?.code || 'Unknown code',
      reason: error?.reason || 'Unknown reason'
    });
    
    // Return zero values when contracts are not available
    return {
      totalSupply: '0',
      totalStakedTFuel: '0',
      netAssetsBackingShares: '0',
      usedNodes: 0
    };
  }
};

// Calculate exchange rate from blockchain data
export const calculateExchangeRateFromBlockchain = (netAssetsBackingShares: string, totalSupply: string): number => {
  const backing = BigInt(netAssetsBackingShares);
  const supply = BigInt(totalSupply);
  
  if (supply === BigInt(0)) return 0;
  
  // Calculate 1 sTFuel = X TFuel
  const rate = (backing * BigInt(10 ** 18)) / supply;
  return parseFloat(ethers.formatEther(rate));
};
