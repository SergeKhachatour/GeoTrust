import React, { useState, useEffect } from 'react';
import { parseCountriesFromGeoJSON, CountryInfo, validateCountryCode } from '../utils/countryVaultUtils';

interface CountryVaultOperationsProps {
  userPublicKey: string;
  backendUrl?: string;
}

export const CountryVaultOperations: React.FC<CountryVaultOperationsProps> = ({
  userPublicKey,
  backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080'
}) => {
  const [countries, setCountries] = useState<CountryInfo[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>('US');
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'deposit' | 'payment' | 'balance'>('balance');

  // Deposit form state
  const [depositAmount, setDepositAmount] = useState('');
  const [depositAsset, setDepositAsset] = useState('XLM');

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDestination, setPaymentDestination] = useState('');
  const [paymentAsset, setPaymentAsset] = useState('XLM');

  // Load countries
  useEffect(() => {
    const loadCountries = async () => {
      try {
        const loadedCountries = await parseCountriesFromGeoJSON();
        setCountries(loadedCountries);
        if (loadedCountries.length > 0 && !selectedCountry) {
          setSelectedCountry(loadedCountries[0].iso2);
        }
      } catch (error) {
        console.error('[CountryVaultOperations] Error loading countries:', error);
      }
    };
    loadCountries();
  }, []);

  // Load balance when country or asset changes
  useEffect(() => {
    if (selectedCountry && (activeTab === 'balance' || activeTab === 'payment')) {
      loadBalance();
    }
  }, [selectedCountry, depositAsset, paymentAsset, activeTab]);

  const loadBalance = async () => {
    try {
      setLoading(true);
      const asset = activeTab === 'deposit' ? depositAsset : paymentAsset;
      const assetAddress = asset === 'XLM' 
        ? process.env.REACT_APP_NATIVE_XLM_SAC_ADDRESS 
        : asset;

      const response = await fetch(`${backendUrl}/api/smart-wallet/get-balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractId: process.env.REACT_APP_CONTRACT_ID,
          userAddress: userPublicKey,
          countryCode: selectedCountry,
          assetAddress: assetAddress,
          rpcUrl: process.env.REACT_APP_SOROBAN_RPC_URL
        })
      });

      const data = await response.json();
      if (data.success) {
        setBalance(data.balance || 0);
      } else {
        setBalance(0);
      }
    } catch (error) {
      console.error('[CountryVaultOperations] Error loading balance:', error);
      setBalance(0);
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async () => {
    if (!validateCountryCode(selectedCountry)) {
      alert('Invalid country code');
      return;
    }

    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      alert('Invalid amount');
      return;
    }

    try {
      setLoading(true);
      // Note: This is a simplified example. In production, you would:
      // 1. Generate signature payload
      // 2. Authenticate with WebAuthn
      // 3. Call the backend API with all WebAuthn data
      
      alert('Deposit functionality requires WebAuthn authentication. Please use the backend API endpoint with proper WebAuthn flow.');
      
      // After successful deposit, reload balance
      await loadBalance();
    } catch (error: any) {
      alert(`Deposit failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!validateCountryCode(selectedCountry)) {
      alert('Invalid country code');
      return;
    }

    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      alert('Invalid amount');
      return;
    }

    if (!paymentDestination || !paymentDestination.startsWith('G')) {
      alert('Invalid destination address');
      return;
    }

    const amountInStroops = Math.round(parseFloat(paymentAmount) * 10000000);
    if (balance < amountInStroops) {
      alert(`Insufficient balance. Available: ${balance / 10000000} ${paymentAsset}`);
      return;
    }

    try {
      setLoading(true);
      // Note: This is a simplified example. In production, you would:
      // 1. Generate signature payload
      // 2. Authenticate with WebAuthn
      // 3. Call the backend API with all WebAuthn data
      
      alert('Payment functionality requires WebAuthn authentication. Please use the backend API endpoint with proper WebAuthn flow.');
      
      // After successful payment, reload balance
      await loadBalance();
    } catch (error: any) {
      alert(`Payment failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>Country Vault Operations</h2>

      {/* Country Selector */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          Country:
        </label>
        <select
          value={selectedCountry}
          onChange={(e) => setSelectedCountry(e.target.value)}
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '16px',
            border: '1px solid #ccc',
            borderRadius: '4px'
          }}
        >
          {countries.map((country) => (
            <option key={country.iso2} value={country.iso2}>
              {country.iso2} - {country.name}
            </option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #ccc' }}>
        <button
          onClick={() => setActiveTab('balance')}
          style={{
            padding: '10px 20px',
            border: 'none',
            backgroundColor: activeTab === 'balance' ? '#007bff' : 'transparent',
            color: activeTab === 'balance' ? 'white' : '#007bff',
            cursor: 'pointer',
            borderBottom: activeTab === 'balance' ? '2px solid #007bff' : 'none'
          }}
        >
          Balance
        </button>
        <button
          onClick={() => setActiveTab('deposit')}
          style={{
            padding: '10px 20px',
            border: 'none',
            backgroundColor: activeTab === 'deposit' ? '#007bff' : 'transparent',
            color: activeTab === 'deposit' ? 'white' : '#007bff',
            cursor: 'pointer',
            borderBottom: activeTab === 'deposit' ? '2px solid #007bff' : 'none'
          }}
        >
          Deposit
        </button>
        <button
          onClick={() => setActiveTab('payment')}
          style={{
            padding: '10px 20px',
            border: 'none',
            backgroundColor: activeTab === 'payment' ? '#007bff' : 'transparent',
            color: activeTab === 'payment' ? 'white' : '#007bff',
            cursor: 'pointer',
            borderBottom: activeTab === 'payment' ? '2px solid #007bff' : 'none'
          }}
        >
          Payment
        </button>
      </div>

      {/* Balance Tab */}
      {activeTab === 'balance' && (
        <div style={{
          border: '1px solid #ccc',
          borderRadius: '4px',
          padding: '20px'
        }}>
          <h3>Balance for {selectedCountry}</h3>
          {loading ? (
            <div>Loading balance...</div>
          ) : (
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' }}>
                {balance / 10000000} {depositAsset}
              </div>
              <div style={{ color: '#666', fontSize: '14px' }}>
                {balance} stroops
              </div>
              <button
                onClick={loadBalance}
                style={{
                  marginTop: '15px',
                  padding: '8px 16px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Refresh Balance
              </button>
            </div>
          )}
        </div>
      )}

      {/* Deposit Tab */}
      {activeTab === 'deposit' && (
        <div style={{
          border: '1px solid #ccc',
          borderRadius: '4px',
          padding: '20px'
        }}>
          <h3>Deposit to {selectedCountry} Vault</h3>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Amount:</label>
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="10.5"
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
            />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Asset:</label>
            <select
              value={depositAsset}
              onChange={(e) => setDepositAsset(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
            >
              <option value="XLM">XLM</option>
            </select>
          </div>
          <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
            <strong>Current Balance:</strong> {balance / 10000000} {depositAsset}
          </div>
          <button
            onClick={handleDeposit}
            disabled={loading || !depositAmount}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: loading ? '#ccc' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            {loading ? 'Processing...' : 'Deposit'}
          </button>
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
            Note: Deposit requires WebAuthn authentication. See COUNTRY_VAULT_OPERATIONS_GUIDE.md for implementation details.
          </div>
        </div>
      )}

      {/* Payment Tab */}
      {activeTab === 'payment' && (
        <div style={{
          border: '1px solid #ccc',
          borderRadius: '4px',
          padding: '20px'
        }}>
          <h3>Payment from {selectedCountry} Vault</h3>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Destination Address:</label>
            <input
              type="text"
              value={paymentDestination}
              onChange={(e) => setPaymentDestination(e.target.value)}
              placeholder="G..."
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
            />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Amount:</label>
            <input
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="10.5"
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
            />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Asset:</label>
            <select
              value={paymentAsset}
              onChange={(e) => setPaymentAsset(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
            >
              <option value="XLM">XLM</option>
            </select>
          </div>
          <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
            <strong>Available Balance:</strong> {balance / 10000000} {paymentAsset}
          </div>
          <button
            onClick={handlePayment}
            disabled={loading || !paymentAmount || !paymentDestination || balance < (parseFloat(paymentAmount) * 10000000)}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: loading ? '#ccc' : '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            {loading ? 'Processing...' : 'Send Payment'}
          </button>
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
            Note: Payment requires WebAuthn authentication. See COUNTRY_VAULT_OPERATIONS_GUIDE.md for implementation details.
          </div>
        </div>
      )}
    </div>
  );
};
