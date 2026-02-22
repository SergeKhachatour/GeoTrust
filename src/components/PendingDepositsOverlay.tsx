import React from 'react';
import { PendingDepositActions } from './PendingDepositActions';
import { PendingDepositAction } from '../services/geolinkApi';
import './PendingDepositsOverlay.css';

interface PendingDepositsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  deposits: PendingDepositAction[];
  onApprove: (deposit: PendingDepositAction) => Promise<void>;
  onDecline: (deposit: PendingDepositAction) => Promise<void>;
  walletAddress: string | null;
}

export const PendingDepositsOverlay: React.FC<PendingDepositsOverlayProps> = ({
  isOpen,
  onClose,
  deposits,
  onApprove,
  onDecline,
  walletAddress,
}) => {
  if (!isOpen || !walletAddress) return null;

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="pending-deposits-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="overlay-header">
          <h2>Pending Deposits</h2>
          <button className="overlay-close-button" onClick={onClose}>×</button>
        </div>
        <div className="pending-deposits-overlay-content">
          <PendingDepositActions
            deposits={deposits}
            onApprove={onApprove}
            onDecline={onDecline}
            walletAddress={walletAddress}
          />
        </div>
      </div>
    </div>
  );
};
