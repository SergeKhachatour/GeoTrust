import React, { useState } from 'react';
import './ContractExplorer.css';

interface ContractFunction {
  name: string;
  signature: string;
  parameters?: Array<{
    name: string;
    type: string;
    optional?: boolean;
  }>;
  returns?: string;
}

interface ContractDiscoveryResult {
  success: boolean;
  functions?: ContractFunction[];
  contract_address: string;
  network: string;
  error?: string;
}

interface ContractExplorerProps {
  onContractSelected?: (contractAddress: string, functions: ContractFunction[]) => void;
}

export const ContractExplorer: React.FC<ContractExplorerProps> = ({ onContractSelected }) => {
  const [contractAddress, setContractAddress] = useState('');
  const [network, setNetwork] = useState<'testnet' | 'mainnet'>('testnet');
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryResult, setDiscoveryResult] = useState<ContractDiscoveryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDiscover = async () => {
    if (!contractAddress.trim()) {
      setError('Please enter a contract address');
      return;
    }

    // Validate contract address format (Stellar contract addresses are 56 characters)
    if (contractAddress.trim().length !== 56) {
      setError('Invalid contract address. Stellar contract addresses are 56 characters.');
      return;
    }

    setIsDiscovering(true);
    setError(null);
    setDiscoveryResult(null);

    try {
      const apiUrl = process.env.REACT_APP_GEOLINK_API_URL || 'https://testnet.stellargeolink.com';
      const apiKey = process.env.REACT_APP_GEOLINK_DATA_CONSUMER_KEY || process.env.REACT_APP_GEOLINK_WALLET_PROVIDER_KEY || '';
      
      if (!apiKey) {
        throw new Error('API key not configured. Please set REACT_APP_GEOLINK_DATA_CONSUMER_KEY or REACT_APP_GEOLINK_WALLET_PROVIDER_KEY');
      }

      const response = await fetch(`${apiUrl}/api/contracts/discover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          contract_address: contractAddress.trim(),
          network: network,
        }),
      });

      const data: ContractDiscoveryResult = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      if (data.success && data.functions) {
        setDiscoveryResult(data);
        if (onContractSelected) {
          onContractSelected(data.contract_address, data.functions);
        }
      } else {
        throw new Error(data.error || 'Discovery failed');
      }
    } catch (err: any) {
      console.error('[ContractExplorer] Discovery failed:', err);
      setError(err.message || 'Failed to discover contract functions');
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isDiscovering) {
      handleDiscover();
    }
  };

  return (
    <div className="contract-explorer">
      <div className="contract-explorer-header">
        <h3>Explore Smart Contract</h3>
        <p className="contract-explorer-subtitle">
          Enter a contract address to discover its functions and capabilities
        </p>
      </div>

      <div className="contract-explorer-form">
        <div className="form-group">
          <label htmlFor="contract-address">Contract Address</label>
          <input
            id="contract-address"
            type="text"
            value={contractAddress}
            onChange={(e) => setContractAddress(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="CCU33UEBVE6EVQ5HPAGF55FYNFO3NILVUSLLG74QDJSCO5UTSKYC7P7Q"
            disabled={isDiscovering}
            className="contract-address-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="network">Network</label>
          <select
            id="network"
            value={network}
            onChange={(e) => setNetwork(e.target.value as 'testnet' | 'mainnet')}
            disabled={isDiscovering}
            className="network-select"
          >
            <option value="testnet">Testnet</option>
            <option value="mainnet">Mainnet</option>
          </select>
        </div>

        <button
          onClick={handleDiscover}
          disabled={isDiscovering || !contractAddress.trim()}
          className="primary-button discover-button"
        >
          {isDiscovering ? 'Discovering...' : 'Discover Contract'}
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {discoveryResult && discoveryResult.success && discoveryResult.functions && (
        <div className="discovery-results">
          <h4>Discovered Functions ({discoveryResult.functions.length})</h4>
          <div className="functions-list">
            {discoveryResult.functions.map((func, index) => (
              <div key={index} className="function-card">
                <div className="function-header">
                  <strong className="function-name">{func.name}</strong>
                  {func.returns && (
                    <span className="function-returns">→ {func.returns}</span>
                  )}
                </div>
                {func.signature && (
                  <div className="function-signature">{func.signature}</div>
                )}
                {func.parameters && func.parameters.length > 0 && (
                  <div className="function-parameters">
                    <strong>Parameters:</strong>
                    <ul>
                      {func.parameters.map((param, paramIndex) => (
                        <li key={paramIndex}>
                          <code>{param.name}</code>: {param.type}
                          {param.optional && <span className="optional-badge">optional</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
