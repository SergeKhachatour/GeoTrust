import React, { useState } from 'react';
import { ContractExplorer } from './ContractExplorer';
import { ExecutionRuleManager } from './ExecutionRuleManager';
import './SmartContractsOverlay.css';

interface SmartContractsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string | null;
}

export const SmartContractsOverlay: React.FC<SmartContractsOverlayProps> = ({
  isOpen,
  onClose,
  walletAddress,
}) => {
  const [activeTab, setActiveTab] = useState<'explorer' | 'rules'>('explorer');

  if (!isOpen) return null;

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="smart-contracts-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="overlay-header">
          <h2>Smart Contracts</h2>
          <button className="overlay-close-button" onClick={onClose}>×</button>
        </div>

        <div className="smart-contracts-tabs">
          <button
            className={`smart-contracts-tab ${activeTab === 'explorer' ? 'active' : ''}`}
            onClick={() => setActiveTab('explorer')}
          >
            Contract Explorer
          </button>
          <button
            className={`smart-contracts-tab ${activeTab === 'rules' ? 'active' : ''}`}
            onClick={() => setActiveTab('rules')}
            disabled={!walletAddress}
          >
            Execution Rules {!walletAddress && '(Requires Wallet)'}
          </button>
        </div>

        <div className="smart-contracts-content">
          {activeTab === 'explorer' && (
            <div className="smart-contracts-tab-content">
              <ContractExplorer />
            </div>
          )}

          {activeTab === 'rules' && walletAddress && (
            <div className="smart-contracts-tab-content">
              <ExecutionRuleManager walletAddress={walletAddress} />
            </div>
          )}

          {activeTab === 'rules' && !walletAddress && (
            <div className="smart-contracts-tab-content">
              <div className="wallet-required-message">
                <p>Please connect your wallet to create and manage execution rules.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
