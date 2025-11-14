'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Magic } from 'magic-sdk';
import { ethers } from 'ethers';

interface User {
  address: string;
  balance: string;
  isConnected: boolean;
}

interface AuthContextType {
  user: User | null;
  magic: Magic | null;
  loginWithWalletConnect: () => Promise<void>;
  loginWithMagic: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  getProvider: () => ethers.Provider | null;
  getSigner: () => Promise<ethers.Signer | null>;
  switchToSupportedNetwork: () => Promise<void>;
  currentChainId: number | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '361');
const THETA_RPC_URL = process.env.NEXT_PUBLIC_THETA_RPC_URL || 'https://eth-rpc-api.thetatoken.org/rpc';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [magic, setMagic] = useState<Magic | null>(null);
  const [currentChainId, setCurrentChainId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize WalletConnect listeners
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const initializeWalletConnect = async () => {
      if (typeof window !== 'undefined') {
        const appkit = (window as any).__REOWN_APPKIT__;
        
        if (appkit) {
          // Immediately check for existing connection when setting up listeners
          try {
            const accounts = await appkit.getAccount();
            if (accounts?.address && accounts.isConnected) {
              setUser({
                address: accounts.address,
                balance: '0',
                isConnected: true,
              });
            }
          } catch (error) {
            console.error('Error checking WalletConnect connection on listener setup:', error);
          }
          
          unsubscribe = appkit.subscribeEvents((event: any) => {
            
            // Handle different event types - the actual event is in event.data.event
            const eventType = event.data?.event;
            
            if (eventType === 'CONNECT_SUCCESS' && appkit.isConnected) {
              // Get the account after connection
              appkit.getAccount().then((accounts: any) => {
                if (accounts?.address) {
                  setUser({
                    address: accounts.address,
                    balance: '0',
                    isConnected: true,
                  });
                  // Force a re-render to ensure UI updates
                  setTimeout(() => {
                    setUser(prev => prev ? { ...prev } : null);
                  }, 100);
                }
              }).catch((error: any) => {
                console.error('Error getting account after connection:', error);
              });
            } else if (eventType === 'DISCONNECT_SUCCESS') {
              console.log('WalletConnect disconnected');
              setUser(null);
            } else if (eventType === 'CONNECT_ERROR') {
              console.error('WalletConnect connection error:', event.data);
            } else if (eventType === 'CHAIN_CHANGED') {
              console.log('Network changed, updating chain ID');
              // Update chain ID when network changes
              getCurrentChainId().then((chainId) => {
                if (chainId && chainId !== 365 && chainId !== 361) {
                  console.log('User switched to unsupported network:', chainId, 'attempting to switch to supported network');
                  switchToSupportedNetwork().catch((error) => {
                    console.error('Failed to switch network automatically:', error);
                  });
                }
              });
            } else {
              console.log('Unhandled WalletConnect event type:', eventType);
            }
          });
        }
      }
    };

    initializeWalletConnect();

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  // Check for existing sessions on mount
  useEffect(() => {
    const checkSessions = async () => {
      try {
        // Check WalletConnect session first
        const appkit = (window as any).__REOWN_APPKIT__;
        if (appkit) {
          console.log('Checking WalletConnect session...');
          const accounts = await appkit.getAccount();
          console.log('WalletConnect accounts:', accounts);
          if (accounts?.address) {
            console.log('Found existing WalletConnect session:', accounts.address);
            setUser({
              address: accounts.address,
              balance: '0',
              isConnected: true,
            });
            setLoading(false);
            return;
          }
        }

        // Check Magic session if WalletConnect is not connected
        const magicKey = process.env.NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY;
        if (magicKey) {
          try {
            const magicInstance = new Magic(magicKey, {
              network: {
                rpcUrl: process.env.NEXT_PUBLIC_THETA_RPC_URL || 'https://eth-rpc-api.thetatoken.org/rpc',
                chainId: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '361'),
              },
            });
            
            const isLoggedIn = await magicInstance.user.isLoggedIn();
            if (isLoggedIn) {
              console.log('Found existing Magic session');
              const magicProvider = magicInstance.rpcProvider;
              const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '361');
              const provider = new ethers.BrowserProvider(magicProvider as any, chainId);
              const signer = await provider.getSigner();
              const address = await signer.getAddress();
              
              setUser({
                address,
                balance: '0',
                isConnected: true,
              });
              setMagic(magicInstance);
            }
          } catch (error) {
            console.error('Error checking Magic session:', error);
          }
        }
      } catch (error) {
        console.error('Error checking session:', error);
      } finally {
        setLoading(false);
      }
    };

    // Add a small delay to ensure WalletConnect is fully initialized
    setTimeout(() => {
      checkSessions();
    }, 100);

    // Also set up a periodic check for WalletConnect reconnection
    const interval = setInterval(async () => {
      const appkit = (window as any).__REOWN_APPKIT__;
      if (appkit && !user?.isConnected) {
        try {
          const accounts = await appkit.getAccount();
          if (accounts?.address && accounts.isConnected) {
            console.log('WalletConnect reconnected on periodic check:', accounts.address);
            setUser({
              address: accounts.address,
              balance: '0',
              isConnected: true,
            });
            clearInterval(interval);
          }
        } catch (error) {
          // Ignore errors in periodic check
        }
      } else if (user?.isConnected) {
        // Stop checking if user is already connected
        clearInterval(interval);
      }
    }, 1000);

    // Clean up interval after 10 seconds
    setTimeout(() => {
      clearInterval(interval);
    }, 10000);

    return () => {
      clearInterval(interval);
    };
  }, [user?.isConnected]);

  const loginWithWalletConnect = async () => {
    try {
      console.log('Connecting with WalletConnect...');
      const appkit = (window as any).__REOWN_APPKIT__;
      if (!appkit) {
        throw new Error('WalletConnect not initialized');
      }

      // Open the connection modal
      await appkit.open();
      console.log('WalletConnect modal opened');
      
      // Add a fallback check for connection status
      // This will check every 500ms for up to 30 seconds
      let checkCount = 0;
      const maxChecks = 60; // 30 seconds
      
      const checkConnection = async () => {
        try {
          const accounts = await appkit.getAccount();
          console.log('Fallback check - WalletConnect accounts:', accounts);
          if (accounts?.address) {
            console.log('Fallback check - WalletConnect connected:', accounts.address);
            setUser({
              address: accounts.address,
              balance: '0',
              isConnected: true,
            });
            return true;
          }
        } catch (error) {
          console.error('Fallback check failed:', error);
        }
        return false;
      };
      
      const interval = setInterval(async () => {
        checkCount++;
        const connected = await checkConnection();
        if (connected || checkCount >= maxChecks) {
          clearInterval(interval);
        }
      }, 500);
      
    } catch (error) {
      console.error('Error connecting with WalletConnect:', error);
      throw error;
    }
  };

  const loginWithMagic = async (email: string) => {
    try {
      // Initialize Magic only when needed
      let magicInstance = magic;
      if (!magicInstance) {
        const magicKey = process.env.NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY;
        if (!magicKey) throw new Error('Magic key not configured');
        
              magicInstance = new Magic(magicKey, {
                network: {
                  rpcUrl: process.env.NEXT_PUBLIC_THETA_RPC_URL || 'https://eth-rpc-api.thetatoken.org/rpc',
                  chainId: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '361'),
                },
              });
        setMagic(magicInstance);
        
        // Wait a bit for Magic to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Use Magic's connectWithUI method instead of loginWithEmailOTP
      const accounts = await magicInstance.wallet.connectWithUI();
      
      if (accounts && accounts.length > 0) {
              // Get the provider and signer to get the address
              const magicProvider = magicInstance.rpcProvider;
              const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '361');
              const provider = new ethers.BrowserProvider(magicProvider as any, chainId);
              const signer = await provider.getSigner();
        const address = await signer.getAddress();
        
        console.log('Magic connected with address:', address);
        
        const userData = {
          address,
          balance: '0',
          isConnected: true,
        };
        
        console.log('Setting Magic user data:', userData);
        setUser(userData);
        
        // Force a re-render by updating a timestamp
        setTimeout(() => {
          setUser(prev => prev ? { ...prev } : null);
        }, 100);
      }
    } catch (error) {
      console.error('Error logging in with Magic:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (magic) {
        await magic.user.logout();
        setMagic(null);
      }
      
      // Disconnect WalletConnect if connected
      const appkit = (window as any).__REOWN_APPKIT__;
      if (appkit) {
        try {
          console.log('Disconnecting WalletConnect...');
          await appkit.disconnect();
          console.log('WalletConnect disconnected successfully');
        } catch (error) {
          console.error('Error disconnecting WalletConnect:', error);
        }
      }
      
      // Clear user state
      setUser(null);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const getProvider = (): ethers.Provider | null => {
    if (!user?.isConnected) return null;
    
    try {
      const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '361');
      if (magic) {
        // Magic provider
        return new ethers.BrowserProvider(magic.rpcProvider as any, chainId);
      } else {
        // For WalletConnect, create a JSON-RPC provider using the RPC URL
        // This ensures contract calls work properly
        const rpcUrl = process.env.NEXT_PUBLIC_THETA_RPC_URL || 'https://eth-rpc-api.thetatoken.org/rpc';
        return new ethers.JsonRpcProvider(rpcUrl, chainId);
      }
    } catch (error) {
      console.error('Error getting provider:', error);
    }
    
    return null;
  };

  const getSigner = async (): Promise<ethers.Signer | null> => {
    if (!user?.isConnected) return null;
    
    try {
      if (magic) {
        // Magic signer
        const provider = getProvider();
        if (provider && 'getSigner' in provider) {
          return await (provider as any).getSigner();
        }
      } else {
        // For WalletConnect, we need to get the signer from the wallet provider
        const appkit = (window as any).__REOWN_APPKIT__;
        if (appkit?.getWalletProvider) {
          const walletProvider = appkit.getWalletProvider();
          const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '361');
          const provider = new ethers.BrowserProvider(walletProvider, chainId);
          return await provider.getSigner();
        }
      }
    } catch (error) {
      console.error('Error getting signer:', error);
    }
    
    return null;
  };

  const switchToSupportedNetwork = async (): Promise<void> => {
    try {
      const appkit = (window as any).__REOWN_APPKIT__;
      if (appkit?.switchChain) {
        // Try to switch to testnet first (preferred for development)
        try {
          await appkit.switchChain({ chainId: CHAIN_ID.toString(16) }); // 365 in hex
          setCurrentChainId(CHAIN_ID);
          return;
        } catch (testnetError) {
          throw new Error('Failed to switch to any supported network');
        }
      } else {
        // Fallback: try to switch using window.ethereum
        if (typeof window !== 'undefined' && window.ethereum) {
          try {
            await (window.ethereum as any).request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: CHAIN_ID.toString(16) }], // 365 in hex
            });
            setCurrentChainId(CHAIN_ID);
            return;
          } catch (testnetError) {
            throw new Error('Failed to switch to any supported network');
          }
        }
      }
    } catch (error: any) {
      console.error('Error switching to supported network:', error);
      throw error;
    }
  };

  // Function to get current chain ID
  const getCurrentChainId = async (): Promise<number | null> => {
    try {
      const provider = getProvider();
      if (provider) {
        const network = await provider.getNetwork();
        const chainId = Number(network.chainId);
        console.log('getCurrentChainId: detected chain ID:', chainId);
        setCurrentChainId(chainId);
        return chainId;
      }
    } catch (error) {
      console.error('Error getting current chain ID:', error);
    }
    return null;
  };

  // Update chain ID when user connects
  useEffect(() => {
    if (user?.isConnected) {
      getCurrentChainId().then((chainId) => {
        // If we're on an unsupported network, try to switch
        if (chainId && chainId !== CHAIN_ID) {
          console.log('User connected to unsupported network:', chainId, 'switching to supported network');
          switchToSupportedNetwork().catch((error) => {
            console.error('Failed to switch network automatically:', error);
          });
        }
      });
    } else {
      setCurrentChainId(null);
    }
  }, [user?.isConnected]);

  const value: AuthContextType = {
    user,
    magic,
    loginWithWalletConnect,
    loginWithMagic,
    logout,
    getProvider,
    getSigner,
    switchToSupportedNetwork,
    currentChainId,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
