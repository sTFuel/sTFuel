'use client';
import { createAppKit } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { theta as thetaNetwork, thetaTestnet as thetaTestnetNetwork } from '@reown/appkit/networks';

// Initialize at module scope (client-only)
if (typeof window !== 'undefined' && !(window as any).__REOWN_APPKIT_INITIALIZED__) {
  // Get chain ID and RPC URL from environment variables, defaulting to mainnet
  // Normalize chainId to string and handle both string and number values
  const chainIdEnv = process.env.NEXT_PUBLIC_CHAIN_ID;
  const chainId = chainIdEnv ? String(chainIdEnv).trim() : '361';
  const isTestnet = chainId === '365';
  
  const rpcUrl = process.env.NEXT_PUBLIC_THETA_RPC_URL || 
    (isTestnet ? 'https://eth-rpc-api-testnet.thetatoken.org/rpc' : 'https://eth-rpc-api.thetatoken.org/rpc');
  
  // Log for debugging (remove in production if needed)
  console.log('[ReownProvider] Initializing with chainId:', chainId, 'isTestnet:', isTestnet);
  
  const appkit = createAppKit({
    adapters: [new EthersAdapter()],
    networks: [thetaNetwork, thetaTestnetNetwork],
    projectId: process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || '',
    metadata: {
      name: 'sTFuel - Liquid Staking for TFuel',
      description: 'The Liquid Staking Solution for TFuel',
      url: window.location.origin,
      icons: ['/sTFuel_Logo_Transparent.png'],
    },
    features: {
      analytics: true,
      swaps: false,
      onramp: false,
      email: false,
    },
    universalProviderConfigOverride: {
      rpcMap: { 
        'eip155:361': isTestnet ? 'https://eth-rpc-api.thetatoken.org/rpc' : rpcUrl,
        'eip155:365': isTestnet ? rpcUrl : 'https://eth-rpc-api-testnet.thetatoken.org/rpc'
      },
      defaultChain: `eip155:${chainId}`, // Use environment variable or default to mainnet (361)
    },
  });
  (window as any).__REOWN_APPKIT__ = appkit;
  (window as any).__REOWN_APPKIT_INITIALIZED__ = true;
}

export const ReownProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;
