'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { formatAddress, formatTFuel, formatNumber } from '@/lib/formatters';
import { useState, useEffect } from 'react';
import WalletModal from '@/components/WalletModal';
import { useContract } from '@/hooks/useContract';

const Header = () => {
  const pathname = usePathname();
  const { user, logout, getProvider } = useAuth();
  const { getBalance } = useContract();
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showBalanceDropdown, setShowBalanceDropdown] = useState(false);
  const [balances, setBalances] = useState({
    tfuel: '0',
    stfuel: '0'
  });
  const [loadingBalances, setLoadingBalances] = useState(false);

  // Debug user state changes
  useEffect(() => {
    console.log('Header: User state changed:', user);
  }, [user]);

  // Debug modal state changes
  useEffect(() => {
    console.log('Header: Modal state changed:', showWalletModal);
  }, [showWalletModal]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showBalanceDropdown) {
        const target = event.target as Element;
        if (!target.closest('.balance-dropdown-container')) {
          setShowBalanceDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showBalanceDropdown]);

  // Fetch balances when dropdown opens
  const fetchBalances = async () => {
    if (!user?.address) return;
    
    setLoadingBalances(true);
    try {
      const provider = getProvider();
      if (!provider) return;

      // Get TFuel balance
      const tfuelBalance = await provider.getBalance(user.address);
      
      // Get sTFuel balance
      const stfuelBalance = await getBalance(user.address);
      
      setBalances({
        tfuel: tfuelBalance.toString(),
        stfuel: stfuelBalance?.toString() || '0'
      });
    } catch (error) {
      console.error('Error fetching balances:', error);
      setBalances({ tfuel: '0', stfuel: '0' });
    } finally {
      setLoadingBalances(false);
    }
  };

  const handleWalletClick = async () => {
    if (showBalanceDropdown) {
      setShowBalanceDropdown(false);
    } else {
      await fetchBalances();
      setShowBalanceDropdown(true);
    }
  };

  const navItems = [
    { href: '/', label: 'Home' },
    { href: '/stats', label: 'Stats' },
    { href: '/whitepaper', label: 'White Paper' },
    ...(user?.isConnected ? [{ href: '/wallet', label: 'My Wallet' }] : []),
  ];

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      <header className="flex items-center justify-between whitespace-nowrap border-theta-bottom py-4">
        <div className="flex items-center gap-10 text-white">
          <Link href="/" className="flex items-center gap-4 hover:opacity-80 transition-opacity">
            <div className="size-8">
              <img 
                src="/sTFuel_Logo_Transparent.png" 
                alt="sTFuel Logo" 
                className="w-full h-full object-contain"
              />
            </div>
            <h2 className="text-white text-xl font-bold">sTFuel</h2>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-base font-medium transition-colors ${
                  isActive(item.href)
                    ? 'text-tfuel-color hover:opacity-80'
                    : 'text-gray-color hover:text-tfuel-color'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        {user?.isConnected ? (
          <div className="flex items-center gap-3">
            <div className="relative balance-dropdown-container">
              <button
                onClick={handleWalletClick}
                className="flex items-center gap-2 px-3 py-2 bg-card-dark border border-border-dark/50 rounded-lg hover:bg-card-dark/80 transition-all duration-200 group relative hover:cursor-pointer"
                title="Click to view balances"
              >
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-white text-sm font-medium">
                  {formatAddress(user.address)}
                </span>
                <svg 
                  className={`w-4 h-4 text-text-secondary-dark group-hover:text-white transition-all duration-200 ${
                    showBalanceDropdown ? 'rotate-180' : ''
                  }`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {/* Balance Dropdown */}
              {showBalanceDropdown && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-background border border-border-dark/50 rounded-lg shadow-xl z-50 overflow-hidden balance-dropdown-enter">
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-text-secondary-dark">TFuel:</span>
                      <div className="flex items-center gap-2">
                        <img 
                          src="/tfuel_token.png" 
                          alt="TFuel" 
                          className="w-4 h-4"
                        />
                        <span className="text-sm font-medium text-white">
                          {loadingBalances ? '...' : formatNumber(parseFloat(formatTFuel(balances.tfuel)))}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-text-secondary-dark">sTFuel:</span>
                      <div className="flex items-center gap-2">
                        <img 
                          src="/sTFuel_Logo_Transparent.png" 
                          alt="sTFuel" 
                          className="w-4 h-4"
                        />
                        <span className="text-sm font-medium text-tfuel-color">
                          {loadingBalances ? '...' : formatNumber(parseFloat(formatTFuel(balances.stfuel)))}
                        </span>
                      </div>
                    </div>
                    
                    <div className="border-t border-border-dark/50 pt-3">
                      <div className="flex justify-between gap-2">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(user.address);
                          }}
                          className="flex-1 text-left text-xs text-text-secondary-dark hover:text-white transition-colors hover:cursor-pointer"
                        >
                          Copy Address
                        </button>
                        <button
                          onClick={logout}
                          className="flex-1 text-right text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-2 justify-end hover:cursor-pointer"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Logout
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowWalletModal(true)}
            className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 button-tfuel-color text-white text-sm font-bold shadow-[0_0_15px_rgba(236,136,53,0.6)] transition-all hover:shadow-[0_0_25px_rgba(236,136,53,0.8)]"
          >
            <span className="truncate">Connect Wallet</span>
          </button>
        )}
      </header>
      
      {showWalletModal && (
        <WalletModal
          onClose={() => setShowWalletModal(false)}
          onConnect={() => setShowWalletModal(false)}
        />
      )}
    </>
  );
};

export default Header;
