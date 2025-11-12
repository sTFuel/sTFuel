'use client';
import { useState, useEffect } from 'react';
import { useActionButton } from '@/hooks/useActionButton';
import { useContract } from '@/hooks/useContract';
import { useAuth } from '@/contexts/AuthContext';

export default function FloatingActionButton() {
  const action = useActionButton();
  const { loading } = useContract();
  const { user } = useAuth();
  const [showTooltip, setShowTooltip] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth > 1400);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  if (!action || !isLargeScreen) {
    return null;
  }

  const isConnected = user?.isConnected ?? false;
  const isDisabled = loading || !isConnected || isExecuting;

  const handleClick = async () => {
    if (!isConnected || isExecuting) return;
    
    setIsExecuting(true);
    try {
      await action.execute();
    } catch (error) {
      console.error('Action execution failed:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed top-20 right-4 z-50">
      <div
        className="relative"
        onMouseEnter={() => isDisabled && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <button
          onClick={handleClick}
          disabled={isDisabled}
          className={`
            group relative px-2 py-3 bg-[rgb(236,136,53)]
            text-white rounded-xl font-semibold shadow-xl
            hover:bg-[rgba(236,136,53,0.5)]
            transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
            disabled:hover:bg-[rgb(236,136,53)]
            flex items-center
            border border-[rgba(236,136,53,0.3)]
            hover:border-[rgba(255,180,100,0.5)]
            hover:shadow-2xl hover:shadow-[rgba(236,136,53,0.2)]
            active:scale-95
            ${isDisabled ? '' : 'cursor-pointer'}
          `}
          style={{ 
            maxWidth: '200px',
            wordBreak: 'break-word',
            whiteSpace: 'normal',
            textAlign: 'left',
            minWidth: '200px',
          }}
        >
          {(loading || isExecuting) ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              <span className="text-sm">Processing...</span>
            </>
          ) : (
            <>
              <span className="text-sm leading-tight">{action.label}</span>
            </>
          )}
        </button>
        
        {showTooltip && !isConnected && (
          <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-background-dark border border-border-dark/50 rounded-lg shadow-xl text-sm text-white whitespace-nowrap z-10">
            Connect Wallet to execute
            <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-background-dark"></div>
          </div>
        )}
      </div>
    </div>
  );
}

