import { ethers } from 'ethers';
import stfuelAbi from './stfuel.abi.json';
import nodeManagerAbi from './nodeManager.abi.json';

export const STFUEL_ABI = stfuelAbi;
export const NODE_MANAGER_ABI = nodeManagerAbi;

export const getContractAddresses = () => ({
  stfuel: process.env.NEXT_PUBLIC_STFUEL_CONTRACT_ADDRESS || '',
  nodeManager: process.env.NEXT_PUBLIC_NODE_MANAGER_CONTRACT_ADDRESS || '',
  referralNFT: process.env.NEXT_PUBLIC_REFERRAL_NFT_CONTRACT_ADDRESS || '',
});

export const getStfuelContract = (provider: ethers.Provider | ethers.Signer) => {
  const addresses = getContractAddresses();
  if (!addresses.stfuel) throw new Error('sTFuel contract address not configured');
  return new ethers.Contract(addresses.stfuel, STFUEL_ABI, provider);
};

export const getNodeManagerContract = (provider: ethers.Provider | ethers.Signer) => {
  const addresses = getContractAddresses();
  if (!addresses.nodeManager) throw new Error('NodeManager contract address not configured');
  return new ethers.Contract(addresses.nodeManager, NODE_MANAGER_ABI, provider);
};

export const getReferralNFTContract = (provider: ethers.Provider | ethers.Signer) => {
  const addresses = getContractAddresses();
  if (!addresses.referralNFT) throw new Error('Referral NFT contract address not configured');
  // Assuming ERC721 ABI for referral NFT
  const erc721Abi = [
    'function balanceOf(address owner) view returns (uint256)',
    'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
    'function ownerOf(uint256 tokenId) view returns (address)',
  ];
  return new ethers.Contract(addresses.referralNFT, erc721Abi, provider);
};

// Contract interaction functions
export const contractFunctions = {
  // sTFuel contract functions
  async mint(contract: ethers.Contract, signer: ethers.Signer, amount: string) {
    return contract.mint({ value: amount });
  },

  async mintWithReferral(contract: ethers.Contract, signer: ethers.Signer, referralId: string, amount: string) {
    return contract.mintWithReferral(referralId, { value: amount });
  },

  async burn(contract: ethers.Contract, signer: ethers.Signer, amount: string) {
    return contract.burn(amount);
  },

  async burnAndRedeemDirect(contract: ethers.Contract, signer: ethers.Signer, amount: string) {
    return contract.burnAndRedeemDirect(amount);
  },

  async balanceOf(contract: ethers.Contract, address: string) {
    return contract.balanceOf(address);
  },

  async totalSupply(contract: ethers.Contract) {
    return contract.totalSupply();
  },

  async totalAssetsTFuel(contract: ethers.Contract) {
    return contract.totalAssetsTFuel();
  },

  async pps(contract: ethers.Contract) {
    return contract.pps();
  },

  async mintFeeBps(contract: ethers.Contract) {
    return contract.mintFeeBps();
  },

  async directRedeemFeeBps(contract: ethers.Contract) {
    return contract.directRedeemFeeBps();
  },

  async setReferralIdToAddress(contract: ethers.Contract, signer: ethers.Signer, tokenId: string, wallet: string) {
    return contract.setReferralIdToAddress(tokenId, wallet);
  },

  async getReferralAddress(contract: ethers.Contract, tokenId: string) {
    return contract.referralIdToAddress(tokenId);
  },

  async canDirectRedeem(contract: ethers.Contract, amount: string) {
    return contract.canDirectRedeem(amount);
  },

  async pokeQueue(contract: ethers.Contract, signer: ethers.Signer, maxItems: string) {
    return contract.pokeQueue(maxItems);
  },

  async claimTFuel(contract: ethers.Contract, signer: ethers.Signer) {
    return contract.claimTFuel();
  },

  // NodeManager contract functions
  async getNetAssetsBackingShares(contract: ethers.Contract) {
    return contract.getNetAssetsBackingShares();
  },

  async getNetAssetsBackingSharesSafe(contract: ethers.Contract) {
    return contract.getNetAssetsBackingSharesSafe();
  },

  async getTotalTFuelReserved(contract: ethers.Contract) {
    return contract.getTotalTFuelReserved();
  },

  async unstakedNodesLength(contract: ethers.Contract) {
    return contract.unstakedNodesLength();
  },

  async updateUnstakingNodes(contract: ethers.Contract, signer: ethers.Signer, maxNodes: string) {
    return contract.updateUnstakingNodes(maxNodes);
  },

  async keeperTipMax(contract: ethers.Contract) {
    return contract.keeperTipMax();
  },

  async keeperTipBps(contract: ethers.Contract) {
    return contract.keeperTipBps();
  },

  async stakeTFuel(contract: ethers.Contract, signer: ethers.Signer) {
    return contract.stakeTFuel();
  },

  // Referral NFT functions
  async getOwnedNFTs(nftContract: ethers.Contract, owner: string) {
    try {
      const balance = await nftContract.balanceOf(owner);
      const tokenIds = [];
      
      for (let i = 0; i < balance; i++) {
        const tokenId = await nftContract.tokenOfOwnerByIndex(owner, i);
        tokenIds.push(tokenId.toString());
      }
      
      return tokenIds;
    } catch (error: any) {
      console.error('Error fetching owned NFTs:', error);
      // Return empty array if there's an error (e.g., contract not deployed, wrong network, etc.)
      return [];
    }
  },
};
