'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface WalletModalProps {
  onClose: () => void;
  onConnect: () => void;
}

const WalletModal = ({ onClose, onConnect }: WalletModalProps) => {
  const { user, loginWithWalletConnect, loginWithMagic } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<'walletconnect' | 'magic' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Close modal when user connects
  useEffect(() => {
    console.log('WalletModal: User state changed:', user);
    if (user?.isConnected && user?.address) {
      console.log('WalletModal: User connected with address, closing modal');
      onConnect();
    }
  }, [user?.isConnected, user?.address, onConnect]);

  // Force close modal when user connects (backup mechanism)
  useEffect(() => {
    if (user?.isConnected && user?.address) {
      console.log('WalletModal: Force closing modal due to user connection');
      // Use a small delay to ensure state is fully updated
      setTimeout(() => {
        onConnect();
      }, 100);
    }
  }, [user?.isConnected, user?.address, onConnect]);

  // Also close modal when loading completes and user is connected
  useEffect(() => {
    if (!loading && user?.isConnected && user?.address) {
      console.log('WalletModal: Loading completed and user connected, closing modal');
      onConnect();
    }
  }, [loading, user?.isConnected, user?.address, onConnect]);

  const handleWalletConnect = async () => {
    setLoading(true);
    setLoadingType('walletconnect');
    setError(null);
    try {
      console.log('Attempting WalletConnect connection...');
      console.log('Current user state before connection:', user);
      await loginWithWalletConnect();
      console.log('WalletConnect connection initiated');
      
      // Add multiple timeout checks to close modal
      const checkAndClose = () => {
        console.log('Checking if modal should close - user:', user);
        if (user?.isConnected && user?.address) {
          console.log('WalletModal: User connected with address, closing modal');
          onConnect();
          return true;
        }
        return false;
      };

      // Check immediately
      if (checkAndClose()) return;

      // Check after 500ms
      setTimeout(() => {
        console.log('500ms check - user:', user);
        if (checkAndClose()) return;
      }, 500);

      // Check after 1 second
      setTimeout(() => {
        console.log('1s check - user:', user);
        if (checkAndClose()) return;
      }, 1000);

      // Check after 2 seconds
      setTimeout(() => {
        console.log('2s check - user:', user);
        if (checkAndClose()) return;
      }, 2000);

      // Final check after 5 seconds
      setTimeout(() => {
        console.log('5s final check - user:', user);
        checkAndClose();
      }, 5000);
    } catch (err: any) {
      console.error('WalletConnect connection error:', err);
      setError(err.message || 'Failed to connect with WalletConnect');
    } finally {
      setLoading(false);
      setLoadingType(null);
    }
  };

  const handleMagicLogin = async () => {
    setLoading(true);
    setLoadingType('magic');
    setError(null);
    try {
      console.log('Attempting Magic connection...');
      await loginWithMagic(''); // No email needed for connectWithUI
      console.log('Magic connection initiated');
      
      // Add multiple timeout checks to close modal
      const checkAndClose = () => {
        if (user?.isConnected && user?.address) {
          console.log('WalletModal: User connected with address, closing modal');
          onConnect();
          return true;
        }
        return false;
      };

      // Check immediately
      if (checkAndClose()) return;

      // Check after 500ms
      setTimeout(() => {
        if (checkAndClose()) return;
      }, 500);

      // Check after 1 second
      setTimeout(() => {
        if (checkAndClose()) return;
      }, 1000);

      // Final check after 3 seconds
      setTimeout(() => {
        checkAndClose();
      }, 3000);
    } catch (err: any) {
      console.error('Magic connection error:', err);
      setError(err.message || 'Failed to connect with Magic Link');
    } finally {
      setLoading(false);
      setLoadingType(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card-dark border border-border-dark/50 rounded-xl p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Connect Wallet</h2>
          <button
            onClick={onClose}
            className="text-text-secondary-dark hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleWalletConnect}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 p-4 bg-tfuel/10 border rounded-lg font-medium hover:bg-tfuel/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingType === 'walletconnect' ? (
              <div className="w-5 h-5 border-2 border-tfuel border-t-transparent rounded-full animate-spin" />
            ) : (
              <img 
                src="/walletConnect.png" 
                alt="WalletConnect" 
                className="w-5 h-5"
              />
            )}
            <span>WalletConnect</span>
          </button>

          <button
            onClick={handleMagicLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 p-4 bg-theta/10 border border-theta/20 rounded-lg text-theta font-medium hover:bg-theta/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingType === 'magic' ? (
              <div className="w-5 h-5 border-2 border-theta border-t-transparent rounded-full animate-spin" />
            ) : (
              <img 
                src="/MagicLogo.png" 
                alt="Magic" 
                className="w-5 h-5"
              />
            )}
            <span>Magic Link</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default WalletModal;
