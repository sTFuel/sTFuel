'use client';
import { createAppKit } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { theta as thetaNetwork, thetaTestnet as thetaTestnetNetwork } from '@reown/appkit/networks';

// Initialize at module scope (client-only)
if (typeof window !== 'undefined' && !(window as any).__REOWN_APPKIT_INITIALIZED__) {
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
        'eip155:361': 'https://eth-rpc-api.thetatoken.org/rpc',
        'eip155:365': 'https://eth-rpc-api-testnet.thetatoken.org/rpc'
      },
      defaultChain: 'eip155:' + (process.env.NEXT_PUBLIC_CHAIN_ID || '365'), // Use testnet (365) as default
    },
  });
  (window as any).__REOWN_APPKIT__ = appkit;
  (window as any).__REOWN_APPKIT_INITIALIZED__ = true;
}

export const ReownProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;
