import React from 'react';
import { PendingDepositAction } from '../services/geolinkApi';
import './PendingDepositOverlay.css';

interface PendingDepositOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  deposit: PendingDepositAction | null;
  onApprove: (deposit: PendingDepositAction) => Promise<void>;
  onDecline: (deposit: PendingDepositAction) => Promise<void>;
  isProcessing?: boolean;
}

export const PendingDepositOverlay: React.FC<PendingDepositOverlayProps> = ({
  isOpen,
  onClose,
  deposit,
  onApprove,
  onDecline,
  isProcessing = false,
}) => {
  if (!isOpen || !deposit) return null;

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
      if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} remaining`;
      
      const diffHours = Math.floor(diffMins / 60);
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} remaining`;
    } catch {
      return 'Unknown';
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
    <div className="pending-deposit-overlay-backdrop" onClick={onClose}>
      <div className="pending-deposit-overlay-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pending-deposit-overlay-header">
          <h2>Deposit Details</h2>
          <button className="pending-deposit-overlay-close" onClick={onClose}>×</button>
        </div>
        
        <div className="pending-deposit-overlay-body">
          <div className="deposit-detail-section">
            <div className="deposit-detail-row">
              <label>Rule Name:</label>
              <span>{deposit.rule_name || 'Unnamed Rule'}</span>
            </div>
            
            <div className="deposit-detail-row">
              <label>Status:</label>
              <span 
                className="status-badge" 
                style={{ backgroundColor: getStatusColor(deposit.status) }}
              >
                {deposit.status}
              </span>
            </div>
            
            <div className="deposit-detail-row">
              <label>Contract:</label>
              <span>{deposit.contract_name}</span>
            </div>
            
            <div className="deposit-detail-row">
              <label>Function:</label>
              <span>{deposit.function_name}</span>
            </div>
            
            {deposit.parameters.amount && (
              <div className="deposit-detail-row">
                <label>Amount:</label>
                <span className="deposit-amount">
                  {formatAmount(deposit.parameters.amount, deposit.parameters.asset)}
                </span>
              </div>
            )}
            
            {deposit.location && (
              <div className="deposit-detail-row">
                <label>Location:</label>
                <span>
                  {deposit.location.latitude.toFixed(4)}, {deposit.location.longitude.toFixed(4)}
                </span>
              </div>
            )}
            
            <div className="deposit-detail-row">
              <label>Expires:</label>
              <span>{formatExpiration(deposit.expires_at)}</span>
            </div>
            
            <div className="deposit-detail-row">
              <label>Received At:</label>
              <span>{new Date(deposit.received_at).toLocaleString()}</span>
            </div>
          </div>
          
          {Object.keys(deposit.parameters).length > 2 && (
            <div className="deposit-detail-section">
              <h3>Additional Parameters</h3>
              {Object.entries(deposit.parameters)
                .filter(([key]) => key !== 'amount' && key !== 'asset' && key !== 'user_address')
                .map(([key, value]) => (
                  <div key={key} className="deposit-detail-row">
                    <label>{key}:</label>
                    <span>{String(value)}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
        
        {deposit.status === 'pending' && (
          <div className="pending-deposit-overlay-footer">
            <button
              className="secondary-button"
              onClick={() => onDecline(deposit)}
              disabled={isProcessing}
            >
              {isProcessing ? 'Processing...' : 'Decline'}
            </button>
            <button
              className="primary-button"
              onClick={() => onApprove(deposit)}
              disabled={isProcessing}
            >
              {isProcessing ? 'Processing...' : 'Approve'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
