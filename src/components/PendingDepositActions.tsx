import React, { useState } from 'react';
import { PendingDepositAction } from '../services/geolinkApi';
import { CollapsiblePanel } from '../CollapsiblePanel';
import { PendingDepositOverlay } from './PendingDepositOverlay';
import './PendingDepositActions.css';

interface PendingDepositActionsProps {
  deposits: PendingDepositAction[];
  onApprove: (deposit: PendingDepositAction) => Promise<void>;
  onDecline: (deposit: PendingDepositAction) => Promise<void>;
  walletAddress: string | null;
}

export const PendingDepositActions: React.FC<PendingDepositActionsProps> = ({
  deposits,
  onApprove,
  onDecline,
  walletAddress,
}) => {
  const [selectedDeposit, setSelectedDeposit] = useState<PendingDepositAction | null>(null);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [minimized, setMinimized] = useState(false);

  if (!walletAddress) {
    return null;
  }

  const pendingDeposits = deposits.filter(d => d.status === 'pending' && d.matched_public_key === walletAddress);

  const handleDepositClick = (deposit: PendingDepositAction) => {
    setSelectedDeposit(deposit);
    setIsOverlayOpen(true);
  };

  const handleApprove = async (deposit: PendingDepositAction) => {
    if (processingIds.has(deposit.id)) return;
    
    setProcessingIds(prev => new Set(prev).add(deposit.id));
    try {
      await onApprove(deposit);
      setIsOverlayOpen(false);
      setSelectedDeposit(null);
    } catch (error) {
      console.error('[PendingDepositActions] Failed to approve deposit:', error);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(deposit.id);
        return next;
      });
    }
  };

  const handleDecline = async (deposit: PendingDepositAction) => {
    if (processingIds.has(deposit.id)) return;
    
    setProcessingIds(prev => new Set(prev).add(deposit.id));
    try {
      await onDecline(deposit);
      setIsOverlayOpen(false);
      setSelectedDeposit(null);
    } catch (error) {
      console.error('[PendingDepositActions] Failed to decline deposit:', error);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(deposit.id);
        return next;
      });
    }
  };

  const formatAmount = (amount: string | undefined, asset: string | undefined) => {
    if (!amount || !asset) return 'N/A';
    const numAmount = parseInt(amount, 10);
    const displayAmount = numAmount / 10000000;
    return `${displayAmount.toFixed(7)} ${asset}`;
  };

  const formatExpiration = (expiresAt: string) => {
    try {
      const expires = new Date(expiresAt);
      const now = new Date();
      const diffMs = expires.getTime() - now.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 0) return 'Expired';
      if (diffMins < 60) return `${diffMins}m`;
      
      const diffHours = Math.floor(diffMins / 60);
      return `${diffHours}h`;
    } catch {
      return '?';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#ffc107';
      case 'in_progress':
        return '#007bff';
      case 'completed':
        return '#28a745';
      case 'failed':
        return '#dc3545';
      case 'cancelled':
        return '#6c757d';
      default:
        return '#6c757d';
    }
  };

  return (
    <>
      <CollapsiblePanel
        title={`Pending Deposits (${pendingDeposits.length})`}
        minimized={minimized}
        onToggleMinimize={() => setMinimized(!minimized)}
        className="pending-deposits-panel"
        style={{ marginTop: '8px' }}
      >
        <div className="pending-deposits-list">
          {pendingDeposits.length === 0 ? (
            <div className="no-deposits">No pending deposits</div>
          ) : (
            pendingDeposits.map(deposit => (
              <div
                key={deposit.id}
                className="deposit-list-item"
                onClick={() => handleDepositClick(deposit)}
              >
                <div className="deposit-list-item-header">
                  <div className="deposit-list-item-title">
                    <strong>{deposit.rule_name || deposit.contract_name}</strong>
                    <span 
                      className="status-badge-small" 
                      style={{ backgroundColor: getStatusColor(deposit.status) }}
                    >
                      {deposit.status}
                    </span>
                  </div>
                </div>
                <div className="deposit-list-item-details">
                  <span className="deposit-amount-small">
                    {formatAmount(deposit.parameters.amount, deposit.parameters.asset)}
                  </span>
                  <span className="deposit-expiration">
                    {formatExpiration(deposit.expires_at)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </CollapsiblePanel>

      <PendingDepositOverlay
        isOpen={isOverlayOpen}
        onClose={() => {
          setIsOverlayOpen(false);
          setSelectedDeposit(null);
        }}
        deposit={selectedDeposit}
        onApprove={handleApprove}
        onDecline={handleDecline}
        isProcessing={selectedDeposit ? processingIds.has(selectedDeposit.id) : false}
      />
    </>
  );
};
