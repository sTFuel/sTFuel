import { useState, useEffect } from 'react';
import { useQuery } from '@apollo/client/react';
import { GET_SYNC_STATUS, GET_REDEMPTION_QUEUE_FOR_KEEPER } from '@/graphql/queries';
import { useContract } from './useContract';
import { formatTFuelBigInt } from '@/lib/formatters';

export type ActionType = 'pokeQueue' | 'stakeTFuel' | 'updateUnstakingNodes' | null;

export interface ActionButtonData {
  type: ActionType;
  label: string;
  execute: () => Promise<void>;
  tfuelEarned?: string; // For pokeQueue action
}

export const useActionButton = (): ActionButtonData | null => {
  const {
    getTotalAssetsTFuel,
    getTotalTFuelReserved,
    unstakedNodesLength,
    getKeeperTipMax,
    pokeQueue,
    stakeTFuel,
    updateUnstakingNodes,
  } = useContract();

  const [action, setAction] = useState<ActionButtonData | null>(null);
  const [loading, setLoading] = useState(true);

  // Query sync status
  const { data: syncData, loading: syncLoading } = useQuery(GET_SYNC_STATUS, {
    fetchPolicy: 'network-only',
    pollInterval: 30000, // Poll every 30 seconds
  });

  // Query redemption queue for keeper (status: 'pending')
  const { data: queueData, loading: queueLoading } = useQuery(GET_REDEMPTION_QUEUE_FOR_KEEPER, {
    variables: { first: 1000, status: 'pending' }, // Fetch enough entries - if more than 1000, we might miss some but that's unlikely
    fetchPolicy: 'network-only',
    pollInterval: 30000,
  });

  useEffect(() => {
    const checkActions = async () => {
      setLoading(true);
      try {
        const lastBlockNumber = (syncData as any)?.syncStatus?.lastBlockNumber 
          ? BigInt((syncData as any).syncStatus.lastBlockNumber) 
          : null;

        if (!lastBlockNumber) {
          setAction(null);
          setLoading(false);
          return;
        }

        // Priority 1: Check if queue needs updating
        const redemptionQueue = (queueData as any)?.redemptionQueue?.edges?.map((edge: any) => edge.node) || [];
        const readyQueueEntries = redemptionQueue.filter((entry: any) => {
          // Filter: creditedBlock == null AND unlockBlockNumber < lastBlockNumber
          if (entry.creditedBlock !== null) return false;
          if (!entry.unlockBlockNumber) return false;
          
          const unlockBlockNumber = BigInt(entry.unlockBlockNumber);
          return unlockBlockNumber < lastBlockNumber;
        });

        if (readyQueueEntries.length > 0) {
          // Calculate total keeper tip fee
          const totalTipFee = readyQueueEntries.reduce((sum: bigint, entry: any) => {
            const tipFee = entry.keepersTipFee ? BigInt(entry.keepersTipFee) : BigInt(0);
            return sum + tipFee;
          }, BigInt(0));

          // Get keeper tip max
          const keeperTipMax = await getKeeperTipMax();
          const maxTip = keeperTipMax ? BigInt(keeperTipMax.toString()) : null;

          // Cap at keeperTipMax if it exists
          const cappedTipFee = maxTip && totalTipFee > maxTip ? maxTip : totalTipFee;

          // Pass maxItems - use the number of ready entries or a reasonable max like 100
          const maxItems = readyQueueEntries.length > 100 ? '100' : readyQueueEntries.length.toString();
          
          setAction({
            type: 'pokeQueue',
            label: `Update Queue and Earn ${formatTFuelBigInt(cappedTipFee.toString())} TFuel`,
            execute: async () => {
              await pokeQueue(maxItems);
            },
            tfuelEarned: formatTFuelBigInt(cappedTipFee.toString()),
          });
          setLoading(false);
          return;
        }

        // Priority 2: Check if we can stake TFuel
        // Condition: totalAssetsTFuel > 10000 TFuel + getTotalTFuelReserved()
        const totalAssetsTFuel = await getTotalAssetsTFuel();
        const totalTFuelReserved = await getTotalTFuelReserved();

        if (totalAssetsTFuel && totalTFuelReserved) {
          const assets = BigInt(totalAssetsTFuel.toString());
          const reserved = BigInt(totalTFuelReserved.toString());
          // 10k TFuel in wei (10,000 * 10^18)
          const tenKTFuel = BigInt('10000000000000000000000');
          const minRequired = tenKTFuel + reserved;

          if (assets > minRequired) {
            setAction({
              type: 'stakeTFuel',
              label: 'Stake TFuel',
              execute: async () => {
                await stakeTFuel();
              },
            });
            setLoading(false);
            return;
          }
        }

        // Priority 3: Check if we need to update unstaking nodes
        const unstakedLength = await unstakedNodesLength();
        if (unstakedLength && BigInt(unstakedLength.toString()) > BigInt(0)) {
          setAction({
            type: 'updateUnstakingNodes',
            label: 'Update Unstaking Nodes',
            execute: async () => {
              await updateUnstakingNodes(unstakedLength.toString());
            },
          });
          setLoading(false);
          return;
        }

        // No action needed
        setAction(null);
      } catch (error) {
        console.error('Error checking actions:', error);
        setAction(null);
      } finally {
        setLoading(false);
      }
    };

    if (!syncLoading && !queueLoading) {
      checkActions();
    }
  }, [
    syncData,
    queueData,
    syncLoading,
    queueLoading,
    getTotalAssetsTFuel,
    getTotalTFuelReserved,
    unstakedNodesLength,
    getKeeperTipMax,
    pokeQueue,
    stakeTFuel,
    updateUnstakingNodes,
  ]);

  if (loading || syncLoading || queueLoading) {
    return null; // Don't show button while loading
  }

  return action;
};

