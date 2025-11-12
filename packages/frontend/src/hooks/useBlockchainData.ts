import { useState, useEffect } from 'react';
import { getBlockchainData, calculateExchangeRateFromBlockchain } from '@/lib/blockchainProvider';

interface BlockchainData {
  totalSupply: string;
  totalStakedTFuel: string;
  netAssetsBackingShares: string;
  usedNodes: number;
  exchangeRate: number;
}

export const useBlockchainData = () => {
  const [data, setData] = useState<BlockchainData>({
    totalSupply: '0',
    totalStakedTFuel: '0',
    netAssetsBackingShares: '0',
    usedNodes: 0,
    exchangeRate: 0.1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('useBlockchainData: Starting to fetch data...');
        const blockchainData = await getBlockchainData();
        console.log('useBlockchainData: Received data:', blockchainData);
        
        const exchangeRate = calculateExchangeRateFromBlockchain(
          blockchainData.netAssetsBackingShares,
          blockchainData.totalSupply
        );
        console.log('useBlockchainData: Calculated exchange rate:', exchangeRate);

        setData({
          ...blockchainData,
          exchangeRate,
        });
        console.log('useBlockchainData: Data set successfully');
      } catch (err: any) {
        console.error('useBlockchainData: Error fetching blockchain data:', err);
        setError(err.message || 'Failed to fetch blockchain data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Poll every 30 seconds
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  return { data, loading, error };
};
