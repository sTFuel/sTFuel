'use client';
import { useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { adminApi } from '@/lib/adminApi';
import { useAuth } from '@/contexts/AuthContext';
import { getNodeManagerContract } from '@/contracts/sTFuelContract';
import { formatTFuelBigInt } from '@/lib/formatters';
import type { NodeWithEdgeData } from './NodeList';

interface RewardDistributionResponse {
  type: string;
  body?: {
    beneficiary: string;
    splitBasisPoint: number;
  };
  error?: string;
}

interface NodeDetailModalProps {
  node: NodeWithEdgeData;
  onClose: () => void;
  onUpdated?: () => void;
}

const MANAGER_ROLE_HASH =
  '0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08';

const shortenAddress = (address?: string) => {
  if (!address) return 'N/A';
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const NodeDetailModal = ({ node, onClose, onUpdated }: NodeDetailModalProps) => {
  const { user, getProvider, getSigner } = useAuth();
  const [rewardInfo, setRewardInfo] = useState<{ beneficiary: string; splitBasisPoint: number } | null>(null);
  const [rewardLoading, setRewardLoading] = useState(false);
  const [rewardError, setRewardError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<'start' | 'stop' | 'fee' | 'contract' | null>(null);
  const [hasManagerRole, setHasManagerRole] = useState(false);
  const [checkingRole, setCheckingRole] = useState(false);
  const [feeInput, setFeeInput] = useState('');
  const [beneficiaryInput, setBeneficiaryInput] = useState('');
  const [selectedNodeType, setSelectedNodeType] = useState<number>(1);

  const isRegistered = !!node.edgeNodeData;
  const isActive = node.edgeNodeData?.isActive ?? false;
  const isFaulty = node.edgeNodeData?.isFaulty ?? false;
  const nodeType = node.edgeNodeData?.nodeType ?? 'N/A';
  const isRunning = node.isRunning ?? false;

  const formattedFee = useMemo(() => {
    if (!rewardInfo) return 'Not set';
    return `${(rewardInfo.splitBasisPoint / 100).toFixed(2)}%`;
  }, [rewardInfo]);

  useEffect(() => {
    let isMounted = true;
    const fetchRewardInfo = async () => {
      if (!node.address) {
        setRewardInfo(null);
        setRewardError('Node address unavailable');
        return;
      }

      setRewardLoading(true);
      setRewardError(null);

      try {
        const response = await fetch(
          `https://explorer-api.thetatoken.org/api/rewardDistribution/${node.address}`
        );
        const data = (await response.json()) as RewardDistributionResponse;

        if (!isMounted) return;

        if (data.body?.beneficiary) {
          setRewardInfo({
            beneficiary: `0x${data.body.beneficiary.replace(/^0x/, '')}`,
            splitBasisPoint: data.body.splitBasisPoint,
          });
        } else {
          setRewardInfo(null);
          setRewardError(data.error || 'No reward distribution set');
        }
      } catch (error: any) {
        if (!isMounted) return;
        setRewardInfo(null);
        setRewardError(error.message || 'Failed to load reward data');
      } finally {
        if (isMounted) {
          setRewardLoading(false);
        }
      }
    };

    fetchRewardInfo();
    return () => {
      isMounted = false;
    };
  }, [node.address]);

  useEffect(() => {
    let isMounted = true;
    const checkRole = async () => {
      if (!user?.address) {
        setHasManagerRole(false);
        return;
      }

      setCheckingRole(true);
      try {
        const provider = getProvider();
        if (!provider) {
          setHasManagerRole(false);
          return;
        }

        const contract = getNodeManagerContract(provider);
        const hasRole = await contract.hasRole(MANAGER_ROLE_HASH, user.address);
        if (isMounted) {
          setHasManagerRole(hasRole);
        }
      } catch (error) {
        console.warn('Failed to verify manager role', error);
        if (isMounted) {
          setHasManagerRole(false);
        }
      } finally {
        if (isMounted) {
          setCheckingRole(false);
        }
      }
    };

    checkRole();
    return () => {
      isMounted = false;
    };
  }, [user?.address, getProvider]);

  const handleStartStop = async () => {
    const action = isRunning ? 'stop' : 'start';
    setActionLoading(action);
    try {
      if (isRunning) {
        await adminApi.stopNode(node.id);
        toast.success('Node stop requested');
      } else {
        await adminApi.startNode(node.id);
        toast.success('Node start requested');
      }
      onUpdated?.();
    } catch (error: any) {
      toast.error(error.message || `Failed to ${action} node`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetFee = async () => {
    // Validate inputs
    if (!beneficiaryInput.trim()) {
      toast.error('Beneficiary address is required');
      return;
    }

    // Validate address format (0x followed by 40 hex characters)
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!addressRegex.test(beneficiaryInput.trim())) {
      toast.error('Invalid beneficiary address format');
      return;
    }

    if (!feeInput.trim()) {
      toast.error('Fee is required');
      return;
    }

    const splitFee = parseInt(feeInput, 10);
    if (isNaN(splitFee) || splitFee < 0 || splitFee > 1000) {
      toast.error('Fee must be a number between 0 and 1000 (0-10%)');
      return;
    }

    setActionLoading('fee');
    try {
      const response = await adminApi.setNodeFee(node.id, {
        rewardWallet: beneficiaryInput.trim(),
        splitFee,
      });

      if (response.success) {
        toast.success(
          response.transactionHash?.hash
            ? `Fee updated! Transaction: ${response.transactionHash.hash.slice(0, 10)}...`
            : 'Fee updated successfully!'
        );

        // Clear inputs
        setBeneficiaryInput('');
        setFeeInput('');

        // Refetch reward distribution data
        setRewardLoading(true);
        setRewardError(null);
        try {
          // Wait a bit for the transaction to be processed
          await new Promise((resolve) => setTimeout(resolve, 2000));

          const explorerResponse = await fetch(
            `https://explorer-api.thetatoken.org/api/rewardDistribution/${node.address}`
          );
          const explorerData = (await explorerResponse.json()) as RewardDistributionResponse;

          if (explorerData.body?.beneficiary) {
            setRewardInfo({
              beneficiary: `0x${explorerData.body.beneficiary.replace(/^0x/, '')}`,
              splitBasisPoint: explorerData.body.splitBasisPoint,
            });
            setRewardError(null);
          } else {
            setRewardInfo(null);
            setRewardError(explorerData.error || 'No reward distribution set');
          }
        } catch (error: any) {
          console.warn('Failed to refresh reward distribution:', error);
          // Don't show error toast, just log it
        } finally {
          setRewardLoading(false);
        }
      } else {
        toast.error(response.error || 'Failed to update fee');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update fee');
    } finally {
      setActionLoading(null);
    }
  };

  const handleContractAction = async () => {
    // Check wallet connection
    if (!user?.isConnected || !user?.address) {
      toast.error('Please connect your wallet first');
      return;
    }

    // Verify manager role (should already be checked, but double-check)
    if (!hasManagerRole) {
      toast.error('Your wallet does not have manager role permissions');
      return;
    }

    if (!node.address) {
      toast.error('Node address is required');
      return;
    }

    setActionLoading('contract');
    try {
      const signer = await getSigner();
      if (!signer) {
        toast.error('Failed to get wallet signer');
        return;
      }

      const contract = getNodeManagerContract(signer);

      // Check if node is active - if not active, we can register it (or re-register it)
      if (!isActive) {
        // Register node (or re-register if previously deactivated)
        if (!node.summary) {
          toast.error('Node summary is required to register. Please ensure the node has a valid summary.');
          return;
        }

        // Convert summary to bytes
        // Summary is stored as hex string (e.g., "0x3E245bC5879884750469f4CEe67AF4e5c70C0040...")
        let summaryBytes: Uint8Array;
        try {
          // Ensure summary has 0x prefix
          const summaryHex = node.summary.startsWith('0x') ? node.summary : '0x' + node.summary;
          summaryBytes = ethers.getBytes(summaryHex);
        } catch (error) {
          toast.error('Invalid summary format. Summary must be a valid hex string.');
          return;
        }

        // Validate summary length (must be exactly 261 bytes = 522 hex chars + "0x" = 524 total)
        if (summaryBytes.length !== 261) {
          toast.error(`Invalid summary length. Expected 261 bytes (524 hex characters), got ${summaryBytes.length} bytes.`);
          return;
        }

        // Validate that first 20 bytes match node address
        const addressFromSummary = ethers.getAddress(
          '0x' + Array.from(summaryBytes.slice(0, 20))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
        );
        const nodeAddress = ethers.getAddress(node.address);
        if (addressFromSummary.toLowerCase() !== nodeAddress.toLowerCase()) {
          toast.error('Summary address does not match node address');
          return;
        }

        // Call registerNode
        toast.loading('Registering node...', { id: 'register-node' });
        const tx = await contract.registerNode(nodeAddress, selectedNodeType, summaryBytes);
        toast.loading('Waiting for transaction confirmation...', { id: 'register-node' });
        const receipt = await tx.wait();

        toast.success(
          `Node registered successfully! Transaction: ${receipt.hash.slice(0, 10)}...`,
          { id: 'register-node' }
        );
      } else {
        // Deactivate node
        const nodeAddress = ethers.getAddress(node.address);
        toast.loading('Deactivating node...', { id: 'deactivate-node' });
        const tx = await contract.deactivateNode(nodeAddress);
        toast.loading('Waiting for transaction confirmation...', { id: 'deactivate-node' });
        const receipt = await tx.wait();

        toast.success(
          `Node deactivated successfully! Transaction: ${receipt.hash.slice(0, 10)}...`,
          { id: 'deactivate-node' }
        );
      }

      // Refresh node data
      onUpdated?.();
    } catch (error: any) {
      const errorMessage = error.reason || error.message || 'Transaction failed';
      toast.error(`Failed: ${errorMessage}`, { id: isActive ? 'deactivate-node' : 'register-node' });
      console.error('Contract action error:', error);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-semibold">{node.nodeId}</h3>
            <p className="text-sm text-gray-400">Server: {node.serverIp}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-gray-800 bg-gray-900/60 p-4">
            <h4 className="text-lg font-semibold">Node Info</h4>
            <p className="text-sm text-gray-400">
              Address:{' '}
              <span className="font-mono text-white">
                {node.address || 'N/A'}
              </span>
            </p>
            <p className="text-sm text-gray-400">
              Status:{' '}
              <span className="font-medium text-white">
                {isRegistered ? (isActive ? 'Active' : 'Inactive') : 'N/A'}
              </span>
            </p>
            <p className="text-sm text-gray-400">
              Node Type:{' '}
              <span className="font-medium text-white">{nodeType}</span>
            </p>
            <p className="text-sm text-gray-400">
              Faulty:{' '}
              <span className="font-medium text-white">
                {node.edgeNodeData ? (isFaulty ? 'Yes' : 'No') : 'N/A'}
              </span>
            </p>
            {node.edgeNodeData && (
              <>
                <p className="text-sm text-gray-400">
                  Total Staked:{' '}
                  <span className="font-medium text-white">
                    {formatTFuelBigInt(node.edgeNodeData.totalStaked)}
                  </span>
                </p>
                <p className="text-sm text-gray-400">
                  Last Updated:{' '}
                  <span className="font-medium text-white">
                    {new Date(node.edgeNodeData.updatedAt).toLocaleString()}
                  </span>
                </p>
              </>
            )}
            {node.summary && (
              <div className="text-sm text-gray-400">
                <p className="mb-1">Summary:</p>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-gray-800/70 p-3 text-xs text-white">
                  {node.summary}
                </pre>
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-xl border border-gray-800 bg-gray-900/60 p-4">
            <h4 className="text-lg font-semibold">Reward Distribution</h4>
            {rewardLoading ? (
              <p className="text-sm text-gray-400">Loading reward data...</p>
            ) : rewardInfo ? (
              <>
                <p className="text-sm text-gray-400">
                  Beneficiary:{' '}
                  <span className="font-medium text-white">
                    {shortenAddress(rewardInfo.beneficiary)}
                  </span>
                </p>
                <p className="text-sm text-gray-400">
                  Node Fee:{' '}
                  <span className="font-medium text-white">{formattedFee}</span>
                </p>
              </>
            ) : (
              <p className="text-sm text-red-400">
                {rewardError || 'Reward distribution not set'}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
            <h4 className="mb-4 text-lg font-semibold">Node Controls</h4>
            <button
              onClick={handleStartStop}
              disabled={actionLoading !== null}
              className={`w-full rounded-lg px-4 py-2 font-medium text-white transition disabled:cursor-not-allowed disabled:bg-gray-600 ${
                isRunning
                  ? 'bg-red-600 hover:bg-red-700 cursor-pointer'
                  : 'bg-green-600 hover:bg-green-700 cursor-pointer'
              }`}
            >
              {actionLoading ? 'Processing...' : isRunning ? 'Stop Node' : 'Start Node'}
            </button>
          </div>

          <div className="space-y-3 rounded-xl border border-gray-800 bg-gray-900/60 p-4">
            <h4 className="text-lg font-semibold">Set Node Fee</h4>
            <p className="text-sm text-gray-400">
              Enter beneficiary and fee (basis points). Max 1000 (10%).
            </p>
            <input
              type="text"
              placeholder="Beneficiary address"
              value={beneficiaryInput}
              onChange={(e) => setBeneficiaryInput(e.target.value)}
              className="w-full rounded-lg bg-gray-800 px-3 py-2 text-sm text-white outline-none ring-blue-500 focus:ring"
            />
            <input
              type="number"
              placeholder="Fee (0-1000 bps)"
              min={0}
              max={1000}
              value={feeInput}
              onChange={(e) => setFeeInput(e.target.value)}
              className="w-full rounded-lg bg-gray-800 px-3 py-2 text-sm text-white outline-none ring-blue-500 focus:ring"
            />
            <button
              onClick={handleSetFee}
              disabled={actionLoading === 'fee'}
              className="w-full rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition hover:bg-purple-700 cursor-pointer disabled:cursor-not-allowed disabled:bg-gray-600"
            >
              {actionLoading === 'fee' ? 'Updating...' : 'Update Fee'}
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-gray-800 bg-gray-900/60 p-4">
          <div className="flex flex-col gap-4">
            <div>
              <h4 className="text-lg font-semibold">Contract Actions</h4>
              <p className="text-sm text-gray-400">
                {checkingRole
                  ? 'Checking wallet permissions...'
                  : hasManagerRole
                  ? 'You can perform manager actions for this node.'
                  : 'Connect a wallet with manager role to enable these actions.'}
              </p>
            </div>
            {!isActive && (
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Node Type <span className="text-red-400">*</span>
                </label>
                <select
                  value={selectedNodeType}
                  onChange={(e) => setSelectedNodeType(parseInt(e.target.value, 10))}
                  className="w-full rounded-lg bg-gray-800 px-3 py-2 text-sm text-white outline-none ring-blue-500 focus:ring border border-gray-700"
                  disabled={actionLoading === 'contract'}
                >
                  <option value={1}>Tenk (10,000 TFuel capacity)</option>
                  <option value={2}>Fiftyk (50,000 TFuel capacity)</option>
                  <option value={3}>Hundredk (100,000 TFuel capacity)</option>
                  <option value={4}>TwoHundredk (200,000 TFuel capacity)</option>
                  <option value={5}>FiveHundredk (500,000 TFuel capacity)</option>
                </select>
              </div>
            )}
            <div className="flex flex-col gap-2 md:flex-row">
              <button
                onClick={handleContractAction}
                disabled={!hasManagerRole || actionLoading === 'contract' || (!isActive && !node.summary)}
                className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition hover:bg-emerald-700 cursor-pointer disabled:cursor-not-allowed disabled:bg-gray-600"
              >
                {actionLoading === 'contract'
                  ? 'Processing...'
                  : isActive
                  ? 'Deactivate Node'
                  : 'Add Node to Contract'}
              </button>
            </div>
            {!isActive && !node.summary && (
              <p className="text-xs text-yellow-400">
                ⚠️ Node summary is required to register. Please ensure the node has a valid summary.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
