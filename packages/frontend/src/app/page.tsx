'use client';
import { useState, useEffect } from 'react';
import { useQuery } from '@apollo/client/react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useContract } from '@/hooks/useContract';
import { useAPR } from '@/hooks/useAPR';
import { useBlockchainData } from '@/hooks/useBlockchainData';
import StatsCard from '@/components/StatsCard';
import TransactionConfirmationModal from '@/components/TransactionConfirmationModal';
import { formatTFuel, formatNumber, calculateExchangeRate, parseTFuel } from '@/lib/formatters';

export default function Home() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { 
    mint, 
    getPPS, 
    getMintFeeBps,
    showConfirmation,
    pendingTransaction,
    handleTransactionConfirm,
    handleTransactionCancel,
    isTransactionExecuting
  } = useContract();
  const { apr, loading: aprLoading, dataPoints, timeRange } = useAPR();
  const { data: blockchainData, loading: blockchainLoading } = useBlockchainData();
  
  const [tfuelAmount, setTfuelAmount] = useState('');
  const [mintError, setMintError] = useState<string | null>(null);
  
  // Use transaction execution state from useContract hook
  const mintLoading = isTransactionExecuting('mint');
  const [mintFeeBps, setMintFeeBps] = useState<number>(20); // Default 0.2%
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [wasMinting, setWasMinting] = useState(false);

  // Get referral ID from URL
  const referralId = searchParams.get('referralID');

  // Clear amount when mint transaction completes
  useEffect(() => {
    if (wasMinting && !mintLoading) {
      // Transaction just finished
      setTfuelAmount('');
      setWasMinting(false);
    } else if (mintLoading && !wasMinting) {
      // Transaction just started
      setWasMinting(true);
    }
  }, [mintLoading, wasMinting]);

  // Update exchange rate from blockchain data
  useEffect(() => {
    if (blockchainData.exchangeRate > 0) {
      setExchangeRate(blockchainData.exchangeRate);
    }
  }, [blockchainData.exchangeRate]);
  

  // Load contract data for fees
  useEffect(() => {
    const loadContractData = async () => {
      try {
        const feeBps = await getMintFeeBps();
        if (feeBps) {
          setMintFeeBps(Number(feeBps));
        }
      } catch (error) {
        console.error('Error loading contract data:', error);
      }
    };

    loadContractData();
  }, []);

  const handleMint = async () => {
    if (!user?.isConnected) {
      setMintError('Please connect your wallet first');
      return;
    }

    if (!tfuelAmount || parseFloat(tfuelAmount) <= 0) {
      setMintError('Please enter a valid TFuel amount');
      return;
    }

    setMintError(null);

    try {
      const amount = parseTFuel(tfuelAmount);
      await mint(amount.toString(), referralId || undefined);
      // Amount will be cleared by useEffect when transaction completes
    } catch (error: any) {
      setMintError(error.message || 'Minting failed');
      setWasMinting(false); // Reset if error occurs before execution starts
    }
  };

  const calculateFee = () => {
    if (!tfuelAmount || parseFloat(tfuelAmount) <= 0) return '0';
    const amount = parseFloat(tfuelAmount);
    const fee = (amount * mintFeeBps) / 10000;
    return formatTFuel(fee.toString(), 0);
  };

  const calculateStfuelOutput = () => {
    if (!tfuelAmount || parseFloat(tfuelAmount) <= 0) return '0';
    const amount = parseFloat(tfuelAmount);
    const fee = (amount * mintFeeBps) / 10000;
    const netAmount = amount - fee;
    const stfuelAmount = netAmount / exchangeRate;
    return formatTFuel(stfuelAmount.toString());
  };

  // Calculate staking percentage
  const stakingPercentage = blockchainData.totalStakedTFuel !== '0' && blockchainData.netAssetsBackingShares !== '0' 
    ? ((parseFloat(blockchainData.totalStakedTFuel) / parseFloat(blockchainData.netAssetsBackingShares)) * 100).toFixed(1)
    : '0';

  return (
    <div className="flex flex-col gap-12">
      {/* Hero Section */}
      <section className="text-center">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-white text-4xl font-black leading-tight tracking-tighter md:text-5xl">
            The Liquid Staking Solution for <span className="text-tfuel-color">TFuel</span>
          </h1>
          <h2 className="text-text-secondary-dark text-base font-normal leading-normal max-w-2xl md:text-lg text-gray-color">
            Instantly mint sTFuel by staking your TFuel, earning rewards while maintaining liquidity in the <span className="text-theta text-theta-color">Theta</span> ecosystem.
          </h2>
        </div>
      </section>

      {/* Stats Section */}
      <section>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
            label="Total sTFuel Supply"
            value={blockchainLoading ? 'Loading...' : formatNumber(parseFloat(formatTFuel(blockchainData.totalSupply)))}
            color="white"
          />
          <StatsCard
            label="Total TFuel Backing"
            value={blockchainLoading ? 'Loading...' : formatNumber(parseFloat(formatTFuel(blockchainData.netAssetsBackingShares)))}
            color="tfuel"
          />
          <StatsCard
            label="TFuel Staked %"
            value={blockchainLoading ? 'Loading...' : `${stakingPercentage}%`}
            color="theta"
          />
          <StatsCard
            label="Approx. APR"
            value={aprLoading ? 'Loading...' : `${formatNumber(apr)}%`}
            color="secondary"
          />
        </div>
      </section>

      {/* Current Rate and Why Buy Section */}
      <section className="flex flex-col items-center gap-6">
        <div className="rounded-xl border border-border-dark/50 bg-card-dark px-6 py-3">
          <div className="flex items-center justify-center gap-3 text-white text-lg font-medium tracking-wide">
            <span>Current Rate:</span>
            <div className="flex items-center gap-2">
              <img 
                src="/sTFuel_Logo_Transparent.png" 
                alt="sTFuel Logo" 
                className="w-6 h-6 object-contain"
              />
              <span>1 =</span>
              <img 
                src="/tfuel_token.png" 
                alt="TFuel Token" 
                className="w-6 h-6 object-contain"
              />
              <span className="text-tfuel-color">
                {blockchainLoading ? 'Loading...' : exchangeRate.toFixed(6)}
              </span>
            </div>
          </div>
        </div>
        <a
          href="/whitepaper"
          className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 button-tfuel-color text-white text-base font-bold shadow-[0_0_15px_rgba(236,136,53,0.6)] transition-all hover:shadow-[0_0_25px_rgba(236,136,53,0.8)]"
        >
          <span className="truncate">Why Buy sTFuel</span>
        </a>
      </section>

      {/* Mint Section */}
      <section>
        <div className="mx-auto max-w-lg rounded-xl border border-border-dark/50 bg-card-dark p-6 sm:p-8">
          <div className="flex flex-col gap-6">
            <h2 className="text-white text-2xl font-bold tracking-tight">
              Mint New <span className="text-tfuel-color">sTFuel</span>
              {referralId && (
                <span className="block text-sm text-theta font-normal mt-1">
                  Referral ID: {referralId}
                </span>
              )}
            </h2>
            
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-text-secondary-dark" htmlFor="tfuel-amount">
                  Enter TFuel Amount
                </label>
                <div className="relative">
                  <input
                    className="w-full rounded-lg border-2 border-border-dark bg-background-dark p-3 text-lg text-white placeholder-text-secondary-dark focus:border-tfuel focus:ring-tfuel"
                    id="tfuel-amount"
                    placeholder="0.0 TFUEL"
                    type="number"
                    value={tfuelAmount}
                    onChange={(e) => setTfuelAmount(e.target.value)}
                    step="0.01"
                    min="0"
                  />
                  <img 
                    src="/tfuel_token.png" 
                    alt="TFuel Token" 
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 object-contain mr-4"
                  />
                </div>
              </div>
              
              <div className="flex justify-between rounded-lg bg-background-dark p-3">
                <span className="text-text-secondary-dark">Fee ({mintFeeBps / 100}%)</span>
                <span className="font-medium text-white">{calculateFee()} TFuel</span>
              </div>
              
              <div className="flex justify-between rounded-lg bg-background-dark p-3">
                <span className="text-text-secondary-dark">You will receive</span>
                <span className="font-bold text-white">{calculateStfuelOutput()} sTFuel</span>
              </div>
            </div>

            {mintError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {mintError}
              </div>
            )}

            <button
              onClick={handleMint}
              disabled={mintLoading || !user?.isConnected}
              className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-5 button-tfuel-color-outline text-base font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="truncate">
                {mintLoading ? 'Minting...' : user?.isConnected ? 'Mint sTFuel' : 'Connect Wallet to Mint'}
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* ThetaSwap Section */}
      <section className="text-center">
        <div className="flex flex-col items-center gap-4">
          <p className="text-text-secondary-dark text-gray-color">Or, get sTFuel on the open market.</p>
          <button
            className="group flex min-w-[84px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg h-12 px-6 border-2 button-theta-color text-base font-bold transition-colors hover:bg-theta hover:text-white"
            onClick={() => window.open('https://thetaswap.org', '_blank')}
            type="button"
          >
            <span className="truncate">Buy sTFuel on ThetaSwap</span>
            <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">
              arrow_forward
            </span>
          </button>
        </div>
      </section>

      {/* Transaction Confirmation Modal */}
      {pendingTransaction && (
        <TransactionConfirmationModal
          isOpen={showConfirmation}
          onClose={handleTransactionCancel}
          onConfirm={handleTransactionConfirm}
          transactionDetails={pendingTransaction}
          loading={mintLoading || isTransactionExecuting('mint')}
        />
      )}
    </div>
  );
}