'use client';
import { useState, useEffect } from 'react';
import { useQuery } from '@apollo/client/react';
import { useAuth } from '@/contexts/AuthContext';
import { useContract } from '@/hooks/useContract';
import { GET_USER, GET_REDEMPTION_QUEUE } from '@/graphql/queries';
import { formatTFuel, formatTFuelBigInt, formatAddress, formatDate, formatNumber } from '@/lib/formatters';
import { parseTFuel } from '@/lib/formatters';
import TransactionConfirmationModal from '@/components/TransactionConfirmationModal';
import {ethers} from 'ethers';

export default function Wallet() {
  const { user } = useAuth();
  const { 
    getBalance, 
    getOwnedNFTs, 
    getReferralAddress,
    canDirectRedeem,
    setReferralIdToAddress, 
    burn, 
    burnAndRedeemDirect,
    getDirectRedeemFeeBps,
    getPPS,
    getKeeperTipBps,
    getKeeperTipMax,
    claimTFuel,
    loading: contractLoading,
    error: contractError,
    showConfirmation,
    pendingTransaction,
    handleTransactionConfirm,
    handleTransactionCancel,
    isTransactionExecuting
  } = useContract();

  const [normalRedeemAmount, setNormalRedeemAmount] = useState('');
  const [directRedeemAmount, setDirectRedeemAmount] = useState('');
  const [referralAddress, setReferralAddress] = useState('');
  const [selectedNFT, setSelectedNFT] = useState('');
  const [ownedNFTs, setOwnedNFTs] = useState<string[]>([]);
  const [directRedeemFee, setDirectRedeemFee] = useState<number>(0);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [blockchainBalance, setBlockchainBalance] = useState<string>('0');
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [currentReferralAddress, setCurrentReferralAddress] = useState<string>('');
  const [referralAddressLoading, setReferralAddressLoading] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string>('');
  const [maxDirectRedeemAmount, setMaxDirectRedeemAmount] = useState<string>('0');
  const [pps, setPPS] = useState<number>(0);
  const [keeperTipBps, setKeeperTipBps] = useState<number>(5); // Default 0.05%
  const [keeperTipMax, setKeeperTipMax] = useState<string>('0');
  
  // Use transaction execution state from useContract hook
  const redeemLoading = isTransactionExecuting('burn') || isTransactionExecuting('burnAndRedeemDirect');
  const referralLoading = isTransactionExecuting('setReferralIdToAddress');
  const claimLoading = isTransactionExecuting('claimTFuel');
  const [wasRedeeming, setWasRedeeming] = useState(false);
  const [wasSettingReferral, setWasSettingReferral] = useState(false);

  // Clear amounts when transactions complete
  useEffect(() => {
    if (wasRedeeming && !redeemLoading) {
      // Transaction just finished
      setNormalRedeemAmount('');
      setDirectRedeemAmount('');
      setWasRedeeming(false);
    } else if (redeemLoading && !wasRedeeming) {
      // Transaction just started
      setWasRedeeming(true);
    }
  }, [redeemLoading, wasRedeeming]);

  // Clear referral address input when referral transaction completes (for Magic wallet)
  useEffect(() => {
    if (wasSettingReferral && !referralLoading) {
      // Transaction just finished
      setReferralAddress('');
      // Refresh the current referral address after a delay to allow transaction to be indexed
      if (selectedNFT) {
        setTimeout(async () => {
          await fetchReferralAddress(selectedNFT);
        }, 2000);
      }
      setWasSettingReferral(false);
    } else if (referralLoading && !wasSettingReferral) {
      // Transaction just started
      setWasSettingReferral(true);
    }
  }, [referralLoading, wasSettingReferral, selectedNFT]);

  // Always call hooks at the top level, before any conditional returns
  const { data: userData, loading: userLoading, error: userError } = useQuery(GET_USER, {
    variables: { address: user?.address },
    skip: !user?.address,
    fetchPolicy: 'network-only', // Use network-only to ensure fresh data
  });

  const { data: redemptionData, loading: redemptionLoading, error: redemptionError } = useQuery(GET_REDEMPTION_QUEUE, {
    variables: { userAddress: user?.address },
    skip: !user?.address,
    fetchPolicy: 'cache-first',
  });

  // Handle both possible data structures from the backend
  const userInfo = (userData as any)?.user || (userData as any)?.users?.edges?.[0]?.node;
  const redemptionQueue = (redemptionData as any)?.redemptionQueue?.edges?.map((edge: any) => edge.node) || [];

  // Load user's NFTs and fees
  useEffect(() => {
    const loadUserData = async () => {
      if (!user?.address) return;

      try {
        const [nfts, feeBps, pps, tipBps, tipMax] = await Promise.all([
          getOwnedNFTs(user.address),
          getDirectRedeemFeeBps(),
          getPPS(),
          getKeeperTipBps(),
          getKeeperTipMax(),
        ]);

        if (nfts) {
          setOwnedNFTs(nfts);
        } else {
          // NFT contract not configured or no NFTs owned
          setOwnedNFTs([]);
        }
        if (feeBps) {
          setDirectRedeemFee(Number(feeBps));
        }
        if (pps) {
          setPPS(parseFloat(ethers.formatUnits(pps, 18)));
        }
        if (tipBps) {
          setKeeperTipBps(Number(tipBps));
        }
        if (tipMax) {
          setKeeperTipMax(tipMax.toString());
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    loadUserData();
  }, [user?.address, getOwnedNFTs, getDirectRedeemFeeBps, getKeeperTipBps, getKeeperTipMax]);

  // Fetch referral address when NFT is selected
  useEffect(() => {
    if (selectedNFT) {
      fetchReferralAddress(selectedNFT);
    } else {
      setCurrentReferralAddress('');
      setReferralAddress('');
    }
    setCopyFeedback(''); // Clear copy feedback when NFT changes
  }, [selectedNFT, getReferralAddress]);

  const fetchMaxDirectRedeemAmount = async () => {
    try {
      const result = await canDirectRedeem('1');
      if (result && result.length >= 2) {
        let [canRedeem, maxAmount] = result;
        maxAmount = BigInt(maxAmount) * BigInt(10_000-200) / BigInt(10_000);
        setMaxDirectRedeemAmount(maxAmount.toString());
      } else {
        setMaxDirectRedeemAmount('0');
      }
    } catch (error) {
      console.error('Error fetching max direct redeem amount:', error);
      setMaxDirectRedeemAmount('0');
    }
  };

  // Load sTFuel balance from blockchain
  useEffect(() => {
    const loadBlockchainBalance = async () => {
      if (!user?.address) {
        setBlockchainBalance('0');
        return;
      }

      setBalanceLoading(true);
      try {
        const balance = await getBalance(user.address);
        if (balance) {
          setBlockchainBalance(balance.toString());
        }
      } catch (error) {
        console.error('Error loading blockchain balance:', error);
        setBlockchainBalance('0');
      } finally {
        setBalanceLoading(false);
      }
    };

    loadBlockchainBalance();
  }, [user?.address, getBalance]);

  // Load max direct redeem amount
  useEffect(() => {
    fetchMaxDirectRedeemAmount();
  }, [canDirectRedeem]);


  // Redirect if not connected
  if (!user?.isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="bg-card-dark border border-border-dark/50 rounded-xl p-8 max-w-md">
          <h1 className="text-2xl font-bold text-white mb-4">Wallet Required</h1>
          <p className="text-text-secondary-dark mb-6">
            Please connect your wallet to view your sTFuel dashboard.
          </p>
          <button 
            onClick={() => window.location.href = '/'}
            className="w-full bg-tfuel text-white py-2 px-4 rounded-lg font-medium hover:bg-tfuel/80 transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  const fetchReferralAddress = async (tokenId: string) => {
    if (!tokenId) {
      setCurrentReferralAddress('');
      return;
    }

    setReferralAddressLoading(true);
    try {
      const address = await getReferralAddress(tokenId);
      if (address && address !== '0x0000000000000000000000000000000000000000') {
        setCurrentReferralAddress(address);
        setReferralAddress(address); // Pre-fill the input field
      } else {
        setCurrentReferralAddress('');
        setReferralAddress(''); // Clear the input field
      }
    } catch (error) {
      console.error('Error fetching referral address:', error);
      setCurrentReferralAddress('');
      setReferralAddress('');
    } finally {
      setReferralAddressLoading(false);
    }
  };

  const validateRedeemAmount = (amount: string) => {
    if (!amount || parseFloat(amount) <= 0) {
      return { isValid: true, error: '' };
    }

    const amountFloat = parseFloat(amount);
    const balanceFloat = parseFloat(formatTFuelBigInt(blockchainBalance));

    if (amountFloat > balanceFloat) {
      return { 
        isValid: false, 
        error: `Insufficient balance. You have ${formatTFuelBigInt(blockchainBalance)} sTFuel` 
      };
    }

    return { isValid: true, error: '' };
  };

  const handleSetReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNFT || !referralAddress) return;

    setReferralError(null);

    try {
      const result = await setReferralIdToAddress(selectedNFT, referralAddress);
      // Only set success message and clear input if transaction actually completed
      // (For WalletConnect, result will be non-null after transaction completes)
      // (For Magic wallet, result will be null and notification will be shown from handleTransactionConfirm)
      if (result !== null) {
        // Transaction completed (WalletConnect case)
        setReferralAddress('');
        // Refresh the current referral address after a delay to allow transaction to be indexed
        setTimeout(async () => {
          await fetchReferralAddress(selectedNFT);
        }, 2000);
      }
      // For Magic wallet, the notification will be shown from handleTransactionConfirm
      // and we'll handle clearing the input via useEffect watching transactionExecuting
    } catch (error: any) {
      setReferralError(error.message || 'Failed to set referral address');
    }
  };

  const handleMaxNormalRedeem = () => {
    setNormalRedeemAmount(formatTFuelBigInt(blockchainBalance));
  };

  const handleMaxDirectRedeem = () => {
    const maxAmount = formatTFuelBigInt(maxDirectRedeemAmount);
    setDirectRedeemAmount(maxAmount);
  };

  const handleNormalRedeem = async () => {
    if (!normalRedeemAmount || parseFloat(normalRedeemAmount) <= 0) {
      setRedeemError('Please enter a valid amount');
      return;
    }

    const validation = validateRedeemAmount(normalRedeemAmount);
    if (!validation.isValid) {
      setRedeemError(validation.error);
      return;
    }

    setRedeemError(null);

    try {
      const amount = parseTFuel(normalRedeemAmount);
      await burn(amount.toString());
      // Amount will be cleared by useEffect when transaction completes
    } catch (error: any) {
      setRedeemError(error.message || 'Redemption failed');
      setWasRedeeming(false); // Reset if error occurs before execution starts
    }
  };

  const handleDirectRedeem = async () => {
    if (!directRedeemAmount || parseFloat(directRedeemAmount) <= 0) {
      setRedeemError('Please enter a valid amount');
      return;
    }

    const validation = validateRedeemAmount(directRedeemAmount);
    if (!validation.isValid) {
      setRedeemError(validation.error);
      return;
    }

    setRedeemError(null);

    try {
      const amount = parseTFuel(directRedeemAmount);
      const fee = calculateDirectRedeemFee(directRedeemAmount);
      const outputAmount = calculateDirectRedeemOutput(directRedeemAmount);
      await burnAndRedeemDirect(amount.toString(), fee, outputAmount);
      // Amount will be cleared by useEffect when transaction completes
    } catch (error: any) {
      setRedeemError(error.message || 'Redemption failed');
      setWasRedeeming(false); // Reset if error occurs before execution starts
    }
  };

  const calculateDirectRedeemFee = (amount: string) => {
    if (!amount || parseFloat(amount) <= 0) return '0';
    const amountFloat = parseFloat(amount);
    const fee = (amountFloat * directRedeemFee) / 10000;
    return fee.toString();
  };

  const calculateDirectRedeemOutput = (amount: string) => {
    if (!amount || parseFloat(amount) <= 0) return '0';
    const netAmount = parseFloat(amount) * (1 - directRedeemFee / 10000);
    const outputAmount = netAmount * pps;
    return outputAmount.toString();
  };

  const calculateNormalRedeemFee = (amount: string) => {
    if (!amount || parseFloat(amount) <= 0) return '0';
    const tfuelAmount = parseFloat(amount) * pps;
    // Calculate fee (keeper tip)
    let fee = (tfuelAmount * keeperTipBps) / 10000;
    // Cap at keeperTipMax if set
    if (keeperTipMax && parseFloat(keeperTipMax) > 0) {
      const maxTip = parseFloat(keeperTipMax);
      if (fee > maxTip) fee = maxTip;
    }
    const stfuelFee = fee / pps;
    console.log('stfuelFee', stfuelFee);
    return stfuelFee.toString();
  };

  const calculateNormalRedeemOutput = (amount: string) => {
    if (!amount || parseFloat(amount) <= 0) return '0';
    // Convert sTFuel to TFuel
    const tfuelAmount = parseFloat(amount) * pps;
    // Calculate fee
    let fee = (tfuelAmount * keeperTipBps) / 10000;
    // Cap at keeperTipMax if set
    if (keeperTipMax && parseFloat(keeperTipMax) > 0) {
      const maxTip = parseFloat(keeperTipMax);
      if (fee > maxTip) fee = maxTip;
    }
    // Net amount user receives
    const netAmount = tfuelAmount - fee;
    return netAmount.toString();
  };

  // Show loading state while user data is being fetched
  if (userLoading && !userInfo) {
    return (
      <div className="space-y-8">
        <h1 className="text-3xl font-bold text-white">My Wallet</h1>
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2 text-text-secondary-dark">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tfuel-color"></div>
            Loading wallet data...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">My Wallet</h1>
        {user?.address && (
          <p className="text-text-secondary-dark mt-2 font-mono text-sm">
            {formatAddress(user.address)}
          </p>
        )}
      </div>

      {/* User Stats Overview */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-card-dark border border-border-dark/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">sTFuel Balance</h3>
          <div className="text-3xl font-bold text-tfuel-color">
            {balanceLoading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-tfuel-color"></div>
                Loading...
              </div>
            ) : (
              formatNumber(parseFloat(formatTFuelBigInt(blockchainBalance)))
            )}
          </div>
          <p className="text-sm text-text-secondary-dark mt-2">
            Current sTFuel holdings (from blockchain)
          </p>
        </div>
        
        <div className="bg-card-dark border border-border-dark/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Total Deposited</h3>
          <div className="text-3xl font-bold text-white">
            {userLoading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                Loading...
              </div>
            ) : userInfo ? (
              formatNumber(parseFloat(formatTFuelBigInt(userInfo.totalDeposited)))
            ) : (
              '0'
            )}
          </div>
          <p className="text-sm text-text-secondary-dark mt-2">
            Lifetime TFuel deposits
          </p>
        </div>
        
        <div className="bg-card-dark border border-border-dark/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Total Withdrawn</h3>
          <div className="text-3xl font-bold text-white">
            {userLoading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                Loading...
              </div>
            ) : userInfo ? (
              formatNumber(parseFloat(formatTFuelBigInt(userInfo.totalWithdrawn)))
            ) : (
              '0'
            )}
          </div>
          <p className="text-sm text-text-secondary-dark mt-2">
            Lifetime TFuel withdrawals
          </p>
        </div>
        
        <div className="bg-card-dark border border-border-dark/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Total Minted</h3>
          <div className="text-3xl font-bold text-theta">
            {userLoading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-theta"></div>
                Loading...
              </div>
            ) : userInfo ? (
              formatNumber(parseFloat(formatTFuelBigInt(userInfo.totalMinted)))
            ) : (
              '0'
            )}
          </div>
          <p className="text-sm text-text-secondary-dark mt-2">
            Total sTFuel minted
          </p>
        </div>
        
        <div className="bg-card-dark border border-border-dark/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Total Burned</h3>
          <div className="text-3xl font-bold text-red-400">
            {userLoading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-400"></div>
                Loading...
              </div>
            ) : userInfo ? (
              formatNumber(parseFloat(formatTFuelBigInt(userInfo.totalBurned)))
            ) : (
              '0'
            )}
          </div>
          <p className="text-sm text-text-secondary-dark mt-2">
            Total sTFuel burned
          </p>
        </div>
        
        <div className="bg-card-dark border border-border-dark/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Keeper Fees Earned</h3>
          <div className="text-3xl font-bold text-secondary">
            {userLoading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-secondary"></div>
                Loading...
              </div>
            ) : userInfo ? (
              formatNumber(parseFloat(formatTFuelBigInt(userInfo.totalKeeperFeesEarned)))
            ) : (
              '0'
            )}
          </div>
          <p className="text-sm text-text-secondary-dark mt-2">
            Fees earned as keeper in TFuel
          </p>
        </div>
        
        <div className="bg-card-dark border border-border-dark/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Referral Fees Earned</h3>
          <div className="text-3xl font-bold text-theta">
            {userLoading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-theta"></div>
                Loading...
              </div>
            ) : userInfo ? (
              formatNumber(parseFloat(formatTFuelBigInt(userInfo.totalReferralFeesEarned)))
            ) : (
              '0'
            )}
          </div>
          <p className="text-sm text-text-secondary-dark mt-2">
            Fees earned from referrals in sTFuel
          </p>
        </div>
        
        <div className="bg-card-dark border border-border-dark/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Total Fees Paid</h3>
          <div className="text-3xl font-bold text-yellow-400">
            {userLoading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-400"></div>
                Loading...
              </div>
            ) : userInfo ? (
              formatNumber(parseFloat(formatTFuelBigInt((BigInt(userInfo.totalEnteringFeesPaid || '0') + BigInt(userInfo.totalExitFeesPaid || '0')).toString())))
            ) : (
              '0'
            )}
          </div>
          <p className="text-sm text-text-secondary-dark mt-2">
            Entering + Exit fees paid in TFuel
          </p>
        </div>
        
        <div className="bg-card-dark border border-border-dark/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Credits Available</h3>
          <div className="text-3xl font-bold text-white">
            {userLoading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                Loading...
              </div>
            ) : userInfo ? (
              formatNumber(parseFloat(formatTFuelBigInt(userInfo.creditsAvailable)))
            ) : (
              '0'
            )}
          </div>
          <p className="text-sm text-text-secondary-dark mt-2">
            Available credit balance in sTFuel
          </p>
        </div>
      </section>

      {/* Error Handling */}
      {(userError || redemptionError) && (
        <section>
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <h3 className="text-lg font-semibold text-red-400 mb-2">Error Loading Data</h3>
            {userError && (
              <p className="text-red-400 text-sm mb-2">
                User data: {userError.message}
              </p>
            )}
            {redemptionError && (
              <p className="text-red-400 text-sm">
                Redemption data: {redemptionError.message}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Redemption Queue */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-2xl font-bold text-white">Redemption Queue</h2>
          {userInfo && BigInt(userInfo.creditsAvailable || '0') > 0 && (
            <button
              onClick={async () => {
                setRedeemError(null);
                try {
                  await claimTFuel();
                  // Optionally refresh user data after claiming
                } catch (error: any) {
                  setRedeemError(error.message || 'Failed to claim credits');
                }
              }}
              disabled={claimLoading || contractLoading}
              className="bg-theta text-white py-2 px-4 rounded-lg font-medium button-tfuel-color-outline transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap hover:cursor-pointer"
            >
              {claimLoading ? 'Claiming...' : `Claim Credits (${formatNumber(parseFloat(formatTFuelBigInt(userInfo.creditsAvailable)))} TFuel)`}
            </button>
          )}
        </div>
        <div className="bg-card-dark border border-border-dark/50 rounded-xl overflow-hidden">
          {redemptionLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-2 text-text-secondary-dark">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-tfuel-color"></div>
                Loading redemption queue...
              </div>
            </div>
          ) : redemptionQueue.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-secondary-dark text-lg mb-2">No redemption requests</p>
              <p className="text-text-secondary-dark text-sm">
                You don't have any pending or completed redemption requests.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-background-dark">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary-dark uppercase tracking-wider">
                      sTFuel Burned
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary-dark uppercase tracking-wider">
                      TFuel Expected
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary-dark uppercase tracking-wider">
                      Request Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary-dark uppercase tracking-wider">
                      Unlock Block
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary-dark uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-dark/50">
                  {redemptionQueue.map((item: any) => (
                    <tr key={item.id} className="hover:bg-background-dark/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        { formatNumber(parseFloat(formatTFuelBigInt(item.stfuelAmountBurned))) }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        { formatNumber(parseFloat(formatTFuelBigInt(item.tfuelAmountExpected))) }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary-dark">
                        {formatDate(item.requestTimestamp)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary-dark">
                        {item.unlockBlockNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          item.status === 'completed' 
                            ? 'bg-green-500/20 text-green-400'
                            : item.status === 'pending'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Referral Management */}
      <section>
        <h2 className="text-2xl font-bold text-white mb-2">Referral Management</h2>
        <span className="text-text-secondary-dark text-sm">
          Owning an NFT enables you to create your own referral link, and earning <span className="text-secondary-color font-semibold">20% of the fee</span> paid by the minter! <span className="text-theta-color font-semibold">Spread the word and earn!</span>
        </span>
        <div className="bg-card-dark border border-border-dark/50 rounded-xl p-6 mt-4">
          {ownedNFTs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-text-secondary-dark mb-4">You don't own any referral NFTs.</p>
              <a
                href="https://opentheta.io"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 bg-theta text-white rounded-lg font-medium hover:bg-theta/80 transition-colors"
              >
                Get Your Referral NFT
              </a>
            </div>
          ) : (
            <form onSubmit={handleSetReferral} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary-dark mb-2">
                  Select Referral NFT
                </label>
                <select
                  value={selectedNFT}
                  onChange={(e) => setSelectedNFT(e.target.value)}
                  className="w-full px-3 py-2 bg-background-dark border border-border-dark rounded-lg text-white focus:border-tfuel focus:outline-none"
                  required
                >
                  <option value="">Choose an NFT</option>
                  {ownedNFTs.map((tokenId) => (
                    <option key={tokenId} value={tokenId}>
                      NFT #{tokenId}
                    </option>
                  ))}
                </select>
              </div>

              {/* Current Referral Address Display */}
              {selectedNFT && (
                <div className="bg-background-dark/50 border border-border-dark/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-text-secondary-dark">
                      Current Referral Address for NFT #{selectedNFT}:
                    </span>
                    {referralAddressLoading && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-tfuel-color"></div>
                    )}
                  </div>
                  {currentReferralAddress ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-white bg-background-dark px-2 py-1 rounded">
                          {formatAddress(currentReferralAddress)}
                        </span>
                        <span className="text-xs text-green-400">✓ Set</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-text-secondary-dark">Referral Link:</span>
                        <span 
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            try {
                              await navigator.clipboard.writeText(`${window.location.origin}?referralID=${selectedNFT}`);
                              setCopyFeedback('Copied!');
                              setTimeout(() => setCopyFeedback(''), 2000);
                            } catch (err) {
                              setCopyFeedback('Failed to copy');
                              setTimeout(() => setCopyFeedback(''), 2000);
                            }
                          }}
                          className="font-mono text-xs text-tfuel-color bg-background-dark px-2 py-1 rounded flex-1 truncate cursor-pointer hover:bg-background-dark/80 transition-colors hover:cursor-pointer"
                          title="Click to copy"
                        >
                          {window.location.origin}?referralID={selectedNFT}
                        </span>
                        <button
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            try {
                              await navigator.clipboard.writeText(`${window.location.origin}?referralID=${selectedNFT}`);
                              setCopyFeedback('Copied!');
                              setTimeout(() => setCopyFeedback(''), 2000);
                            } catch (err) {
                              setCopyFeedback('Failed to copy');
                              setTimeout(() => setCopyFeedback(''), 2000);
                            }
                          }}
                          className="text-xs text-tfuel px-2 py-1 rounded hover:text-theta-color transition-colors hover:cursor-pointer"
                        >
                          {copyFeedback || 'Copy'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-text-secondary-dark italic">
                      No referral address set
                    </span>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-text-secondary-dark mb-2">
                  Referral Address
                </label>
                <input
                  type="text"
                  value={referralAddress}
                  onChange={(e) => setReferralAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-3 py-2 bg-background-dark border border-border-dark rounded-lg text-white placeholder-text-secondary-dark focus:border-tfuel focus:outline-none"
                  required
                />
              </div>

              {referralError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {referralError}
                </div>
              )}


              <button
                type="submit"
                disabled={referralLoading || !selectedNFT || !referralAddress}
                className="w-full bg-tfuel text-white py-2 px-4 rounded-lg font-medium button-tfuel-color-outline transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:cursor-pointer"
              >
                {referralLoading ? 'Setting...' : 'Set Referral Address'}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Redeem Section */}
      <section>
        <h2 className="text-2xl font-bold text-white mb-6">Redeem sTFuel</h2>
        <span className="text-text-secondary-dark text-sm">
          The current Price Per Share (sTFuel/TFuel) is {pps.toFixed(6)} TFuel.
        </span>
        <span className="text-text-secondary-dark text-sm">
          Important: Keep in mind that the TFuel send by the contract to your wallet does not show in the 
        </span>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Normal Redeem */}
          <div className="bg-card-dark border border-border-dark/50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Normal Redeem</h3>
            <p className="text-text-secondary-dark text-sm mb-4">
              Burn sTFuel and wait 28,800 blocks (~60 hours) for TFuel redemption.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary-dark mb-2">
                  sTFuel Amount
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={normalRedeemAmount}
                    onChange={(e) => setNormalRedeemAmount(e.target.value)}
                    placeholder="0.0"
                    step="0.000001"
                    min="0"
                    className={`flex-1 px-3 py-2 bg-background-dark border rounded-lg text-white placeholder-text-secondary-dark focus:outline-none ${
                      (() => {
                        const validation = validateRedeemAmount(normalRedeemAmount);
                        return !validation.isValid ? 'border-red-500 focus:border-red-500' : 'border-border-dark focus:border-tfuel';
                      })()
                    }`}
                  />
                  <button
                    onClick={handleMaxNormalRedeem}
                    className="px-3 py-2 bg-tfuel/20 text-tfuel text-sm font-medium rounded-lg hover:bg-tfuel/30 transition-colors hover:curser-pointer"
                  >
                    Max
                  </button>
                </div>
                {(() => {
                  const validation = validateRedeemAmount(normalRedeemAmount);
                  return !validation.isValid && (
                    <p className="text-red-400 text-sm mt-1">{validation.error}</p>
                  );
                })()}
              </div>
              
              {normalRedeemAmount && parseFloat(normalRedeemAmount) > 0 && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary-dark">Fee ({keeperTipBps / 100}%)</span>
                    <span className="text-white">{formatNumber(calculateNormalRedeemFee(normalRedeemAmount))} sTFuel</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-text-secondary-dark">You will receive</span>
                    <span className="text-white">{formatTFuel(calculateNormalRedeemOutput(normalRedeemAmount))} TFuel</span>
                  </div>
                </div>
              )}

              <button
                onClick={handleNormalRedeem}
                disabled={redeemLoading || !normalRedeemAmount || !validateRedeemAmount(normalRedeemAmount).isValid}
                className="w-full bg-tfuel text-white py-2 px-4 rounded-lg font-medium button-tfuel-color-outline transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:cursor-pointer"
              >
                {redeemLoading ? 'Redeeming...' : 'Redeem sTFuel'}
              </button>
            </div>
          </div>

          {/* Direct Redeem */}
          <div className="bg-card-dark border border-border-dark/50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Direct Redeem</h3>
            <p className="text-text-secondary-dark text-sm mb-4">
              Get TFuel immediately with a higher fee ({directRedeemFee / 100}%). Currently {formatTFuelBigInt(maxDirectRedeemAmount)} sTFuel can be directly redeemed.
            </p>
            {parseFloat(maxDirectRedeemAmount) === 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-4">
                <p className="text-yellow-400 text-sm">
                  Direct redeem is currently not available. No sTFuel can be directly redeemed at this time.
                </p>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary-dark mb-2">
                  sTFuel Amount
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={directRedeemAmount}
                    onChange={(e) => setDirectRedeemAmount(e.target.value)}
                    placeholder="0.0"
                    step="0.000001"
                    min="0"
                    className={`flex-1 px-3 py-2 bg-background-dark border rounded-lg text-white placeholder-text-secondary-dark focus:outline-none ${
                      (() => {
                        const validation = validateRedeemAmount(directRedeemAmount);
                        return !validation.isValid ? 'border-red-500 focus:border-red-500' : 'border-border-dark focus:border-tfuel';
                      })()
                    }`}
                  />
                  <button
                    onClick={handleMaxDirectRedeem}
                    disabled={parseFloat(maxDirectRedeemAmount) === 0}
                    className="px-3 py-2 bg-theta/20 text-theta text-sm font-medium rounded-lg hover:bg-theta/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:cursor-pointer"
                  >
                    Max
                  </button>
                </div>
                {(() => {
                  const validation = validateRedeemAmount(directRedeemAmount);
                  return !validation.isValid && (
                    <p className="text-red-400 text-sm mt-1">{validation.error}</p>
                  );
                })()}
              </div>
              
              {directRedeemAmount && parseFloat(directRedeemAmount) > 0 && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary-dark">Fee ({directRedeemFee / 100}%)</span>
                    <span className="text-white">{calculateDirectRedeemFee(directRedeemAmount)} sTFuel</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-text-secondary-dark">You will receive</span>
                    <span className="text-white">{formatTFuel(calculateDirectRedeemOutput(directRedeemAmount), 18)} TFuel</span>
                  </div>
                </div>
              )}

              <button
                onClick={handleDirectRedeem}
                disabled={redeemLoading || !directRedeemAmount || !validateRedeemAmount(directRedeemAmount).isValid || parseFloat(maxDirectRedeemAmount) === 0}
                className="w-full bg-theta text-white py-2 px-4 rounded-lg font-medium button-theta-color-outline transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:cursor-pointer"
              >
                {redeemLoading ? 'Redeeming...' : 'Direct Redeem'}
              </button>
            </div>
          </div>
        </div>

        {redeemError && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {redeemError}
          </div>
        )}
      </section>

      {/* Transaction Confirmation Modal */}
      {pendingTransaction && (
        <TransactionConfirmationModal
          isOpen={showConfirmation}
          onClose={handleTransactionCancel}
          onConfirm={handleTransactionConfirm}
          transactionDetails={pendingTransaction}
          loading={contractLoading}
        />
      )}
    </div>
  );
}
