'use client';
import { useState } from 'react';
import { formatTFuel, formatTFuelBigInt } from '@/lib/formatters';

interface TransactionDetails {
  type: 'mint' | 'burn' | 'burnAndRedeemDirect' | 'setReferralIdToAddress' | 'pokeQueue' | 'stakeTFuel' | 'updateUnstakingNodes' | 'claimTFuel';
  amount?: string;
  referralId?: string;
  referralAddress?: string;
  fee?: string;
  outputAmount?: string;
  maxNodes?: string;
  contractAddress: string;
  description: string;
}

interface TransactionConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  transactionDetails: TransactionDetails;
  loading?: boolean;
}

const TransactionConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  transactionDetails,
  loading = false
}: TransactionConfirmationModalProps) => {
  const [isConfirming, setIsConfirming] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Transaction confirmation failed:', error);
    } finally {
      setIsConfirming(false);
    }
  };

  const getTransactionIcon = () => {
    switch (transactionDetails.type) {
      case 'mint':
        return '🪙';
      case 'burn':
        return '🔥';
      case 'burnAndRedeemDirect':
        return '⚡';
      case 'setReferralIdToAddress':
        return '🔗';
      case 'pokeQueue':
        return '🔔';
      case 'stakeTFuel':
        return '📊';
      case 'updateUnstakingNodes':
        return '🔄';
      case 'claimTFuel':
        return '💰';
      default:
        return '📝';
    }
  };

  const getTransactionColor = () => {
    switch (transactionDetails.type) {
      case 'mint':
        return 'text-theta';
      case 'burn':
        return 'text-red-400';
      case 'burnAndRedeemDirect':
        return 'text-yellow-400';
      case 'setReferralIdToAddress':
        return 'text-blue-400';
      case 'pokeQueue':
        return 'text-tfuel-color';
      case 'stakeTFuel':
        return 'text-tfuel-color';
      case 'updateUnstakingNodes':
        return 'text-secondary-color';
      case 'claimTFuel':
        return 'text-green-400';
      default:
        return 'text-white';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card-dark border border-border-dark/50 rounded-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getTransactionIcon()}</span>
            <h2 className="text-xl font-bold text-white">Confirm Transaction</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isConfirming}
            className="text-text-secondary-dark hover:text-white transition-colors disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-background-dark/50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-text-secondary-dark mb-2">Transaction Type</h3>
            <p className={`font-semibold ${getTransactionColor()}`}>
              {transactionDetails.description}
            </p>
          </div>

          {transactionDetails.amount && (
            <div className="bg-background-dark/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-text-secondary-dark mb-2">Payed Amount</h3>
              <p className="text-white font-mono">
                {formatTFuel(transactionDetails.amount)} {transactionDetails.type === 'mint' ? 'TFuel' : 'sTFuel'}
              </p>
            </div>
          )}

          {transactionDetails.referralId && (
            <div className="bg-background-dark/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-text-secondary-dark mb-2">Referral ID</h3>
              <p className="text-white font-mono text-sm">
                {transactionDetails.referralId}
              </p>
            </div>
          )}

          {transactionDetails.referralAddress && (
            <div className="bg-background-dark/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-text-secondary-dark mb-2">Referral Address</h3>
              <p className="text-white font-mono text-sm">
                {transactionDetails.referralAddress}
              </p>
            </div>
          )}

          {transactionDetails.fee && (
            <div className="bg-background-dark/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-text-secondary-dark mb-2">Fee</h3>
              <p className="text-yellow-400 font-mono">
                {formatTFuel(transactionDetails.fee)} TFuel
              </p>
            </div>
          )}

          {transactionDetails.outputAmount && (
            <div className="bg-background-dark/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-text-secondary-dark mb-2">You will receive</h3>
              <p className="text-green-400 font-mono font-semibold">
                {formatTFuelBigInt(transactionDetails.outputAmount)} TFuel
              </p>
            </div>
          )}

          {transactionDetails.maxNodes && (
            <div className="bg-background-dark/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-text-secondary-dark mb-2">Max Nodes</h3>
              <p className="text-white font-mono">
                {transactionDetails.maxNodes}
              </p>
            </div>
          )}

          <div className="bg-background-dark/50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-text-secondary-dark mb-2">Contract Address</h3>
            <p className="text-white font-mono text-sm break-all">
              {transactionDetails.contractAddress}
            </p>
          </div>

        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isConfirming}
            className="flex-1 bg-background-dark text-white py-2 px-4 rounded-lg font-medium button-theta-color transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isConfirming || loading}
            className="flex-1 bg-tfuel text-white py-2 px-4 rounded-lg font-medium button-tfuel-color-outline transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:cursor-pointer"
          >
            {isConfirming ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Confirming...
              </div>
            ) : (
              'Confirm Transaction'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionConfirmationModal;
