import React, { useState } from 'react';
import { PendingDepositAction } from '../services/geolinkApi';
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
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  if (!walletAddress || deposits.length === 0) {
    return null;
  }

  const handleApprove = async (deposit: PendingDepositAction) => {
    if (processingIds.has(deposit.id)) return;
    
    setProcessingIds(prev => new Set(prev).add(deposit.id));
    try {
      await onApprove(deposit);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#ffc107'; // Gold
      case 'in_progress':
        return '#007bff'; // Blue
      case 'completed':
        return '#28a745'; // Green
      case 'failed':
        return '#dc3545'; // Red
      case 'cancelled':
        return '#6c757d'; // Gray
      default:
        return '#6c757d';
    }
  };

  const formatAmount = (amount: string | undefined, asset: string | undefined) => {
    if (!amount || !asset) return 'N/A';
    // Convert from stroops (1 XLM = 10,000,000 stroops)
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
      if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} remaining`;
      
      const diffHours = Math.floor(diffMins / 60);
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} remaining`;
    } catch {
      return 'Unknown';
    }
  };

  return (
    <div className="pending-deposit-actions">
      <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#FFD700' }}>
        Pending Deposits ({deposits.filter(d => d.status === 'pending').length})
      </h3>
      <div className="deposit-list">
        {deposits
          .filter(deposit => deposit.matched_public_key === walletAddress)
          .map(deposit => (
            <div key={deposit.id} className="deposit-card">
              <div className="deposit-header">
                <div className="deposit-title">
                  <strong>{deposit.rule_name || deposit.contract_name}</strong>
                  <span 
                    className="status-badge" 
                    style={{ backgroundColor: getStatusColor(deposit.status) }}
                  >
                    {deposit.status}
                  </span>
                </div>
              </div>
              
              <div className="deposit-details">
                <div className="deposit-field">
                  <label>Contract:</label>
                  <span>{deposit.contract_name}</span>
                </div>
                
                {deposit.parameters.amount && (
                  <div className="deposit-field">
                    <label>Amount:</label>
                    <span className="deposit-amount">
                      {formatAmount(deposit.parameters.amount, deposit.parameters.asset)}
                    </span>
                  </div>
                )}
                
                {deposit.location && (
                  <div className="deposit-field">
                    <label>Location:</label>
                    <span>
                      {deposit.location.latitude.toFixed(4)}, {deposit.location.longitude.toFixed(4)}
                    </span>
                  </div>
                )}
                
                <div className="deposit-field">
                  <label>Expires:</label>
                  <span>{formatExpiration(deposit.expires_at)}</span>
                </div>
              </div>
              
              {deposit.status === 'pending' && (
                <div className="deposit-actions">
                  <button
                    className="deposit-button decline"
                    onClick={() => handleDecline(deposit)}
                    disabled={processingIds.has(deposit.id)}
                  >
                    {processingIds.has(deposit.id) ? 'Processing...' : 'Decline'}
                  </button>
                  <button
                    className="deposit-button approve"
                    onClick={() => handleApprove(deposit)}
                    disabled={processingIds.has(deposit.id)}
                  >
                    {processingIds.has(deposit.id) ? 'Processing...' : 'Approve'}
                  </button>
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
};
