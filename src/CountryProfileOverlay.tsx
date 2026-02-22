import React, { useState, useEffect, useMemo } from 'react';
import { ContractClient } from './contract';
import { ReadOnlyContractClient } from './contract-readonly';
import { extractCountryInfo } from './utils/countryVaultUtils';
import { iso2ToNumeric, iso3ToIso2 } from './countryCodes';
import { PasskeyService } from './services/passkeyService';

interface CountryProfileOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  countryCode: number;
  countryName: string;
  contractClient: ContractClient | null;
  walletAddress: string | null;
  mainAdminAddress: string | null;
  onManageCountry?: (country: { code: number; name: string }) => void;
}

export const CountryProfileOverlay: React.FC<CountryProfileOverlayProps> = ({
  isOpen,
  onClose,
  countryCode,
  countryName,
  contractClient,
  walletAddress,
  mainAdminAddress,
  onManageCountry,
}) => {
  const [countryAdmin, setCountryAdmin] = useState<string | null>(null);
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(false);
  const [isAllowed, setIsAllowed] = useState(false);
  const [isLoadingPolicy, setIsLoadingPolicy] = useState(false);
  const [isMainAdmin, setIsMainAdmin] = useState(false);
  const [isCountryAdmin, setIsCountryAdmin] = useState(false);
  const readOnlyClient = useMemo(() => new ReadOnlyContractClient(), []);
  
  // Country Vault state
  const [countryIso2, setCountryIso2] = useState<string | null>(null);
  const [vaultInfo, setVaultInfo] = useState<any>(null);
  const [vaultBalance, setVaultBalance] = useState<number | null>(null);
  const [isLoadingVault, setIsLoadingVault] = useState(false);
  const [isLoadingVaultBalance, setIsLoadingVaultBalance] = useState(false);
  
  // Deposit state
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [isDepositing, setIsDepositing] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const passkeyService = useMemo(() => {
    try {
      return new PasskeyService();
    } catch (error) {
      console.warn('[CountryProfile] Passkey service not available:', error);
      return null;
    }
  }, []);

  // Check admin status
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!contractClient || !walletAddress) {
        setIsMainAdmin(false);
        setIsCountryAdmin(false);
        return;
      }
      try {
        // Check if main admin
        const isMain = !!(mainAdminAddress && walletAddress === mainAdminAddress);
        setIsMainAdmin(isMain);

        // Check if country admin (use read-only client to avoid Freighter prompts)
        if (!isMain) {
          try {
            const admin = await readOnlyClient.getCountryAdmin(countryCode);
            setCountryAdmin(admin);
            setIsCountryAdmin(admin === walletAddress);
          } catch (error) {
            console.error('[CountryProfile] Failed to load country admin:', error);
            setCountryAdmin(null);
            setIsCountryAdmin(false);
          }
        } else {
          // Load country admin for display (use read-only client)
          try {
            const admin = await readOnlyClient.getCountryAdmin(countryCode);
            setCountryAdmin(admin);
          } catch (error) {
            console.error('[CountryProfile] Failed to load country admin:', error);
            setCountryAdmin(null);
          }
          setIsCountryAdmin(false); // Main admin doesn't need country admin flag
        }
      } finally {
        setIsLoadingAdmin(false);
      }
    };

    if (isOpen) {
      checkAdminStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, countryCode, contractClient, walletAddress, mainAdminAddress]);

  // Load country policy
  useEffect(() => {
    const loadCountryPolicy = async () => {
      if (!contractClient) {
        setIsLoadingPolicy(false);
        return;
      }

      setIsLoadingPolicy(true);
      try {
        const allowed = await readOnlyClient.getCountryAllowed(countryCode);
        setIsAllowed(allowed ?? false);
      } catch (error) {
        console.error('[CountryProfile] Failed to load country policy:', error);
        setIsAllowed(false);
      } finally {
        setIsLoadingPolicy(false);
      }
    };

    if (isOpen) {
      loadCountryPolicy();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, countryCode, contractClient]);
  
  // Load country ISO2 code and vault info
  useEffect(() => {
    const loadCountryVaultInfo = async () => {
      if (!isOpen || !contractClient) {
        return;
      }
      
      try {
        // Load GeoJSON to extract ISO2 code
        const response = await fetch('/countries.geojson');
        if (response.ok) {
          const geojson = await response.json();
          const countryFeature = geojson.features.find((f: any) => {
            let code = f.properties?.ISO_NUMERIC;
            if (code && Number(code) === countryCode) {
              return true;
            }
            const iso2 = f.properties?.ISO2;
            if (iso2) {
              code = iso2ToNumeric(iso2);
              if (code === countryCode) return true;
            }
            const iso3 = f.id || f.properties?.id;
            if (iso3) {
              const iso3Str = typeof iso3 === 'string' ? iso3 : String(iso3);
              const iso2FromIso3 = iso3ToIso2(iso3Str);
              if (iso2FromIso3) {
                code = iso2ToNumeric(iso2FromIso3);
                if (code === countryCode) return true;
              }
            }
            return false;
          });
          
          if (countryFeature) {
            const countryInfo = extractCountryInfo(countryFeature);
            if (countryInfo && countryInfo.iso2) {
              setCountryIso2(countryInfo.iso2);
              
              // Load vault info (use read-only client to avoid wallet prompts)
              setIsLoadingVault(true);
              try {
                // Use read-only client for getCountryInfo to avoid wallet prompts
                const info = await readOnlyClient.getCountryInfo(countryInfo.iso2);
                setVaultInfo(info);
              } catch (error) {
                console.error('[CountryProfile] Failed to load vault info:', error);
                setVaultInfo(null);
              } finally {
                setIsLoadingVault(false);
              }
              
              // Load vault balance if user is logged in
              if (walletAddress && countryInfo.iso2) {
                setIsLoadingVaultBalance(true);
                try {
                  // Use SAC (Stellar Asset Contract) for native XLM
                  // Testnet SAC: CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
                  const assetAddress = process.env.REACT_APP_NATIVE_XLM_SAC_ADDRESS || 
                    'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
                  const contractId = process.env.REACT_APP_CONTRACT_ID;
                  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
                  
                  if (contractId) {
                    const response = await fetch(`${backendUrl}/api/smart-wallet/get-balance`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        contractId: contractId,
                        userAddress: walletAddress,
                        countryCode: countryInfo.iso2,
                        assetAddress: assetAddress,
                        rpcUrl: process.env.REACT_APP_SOROBAN_RPC_URL
                      })
                    });
                    
                    const data = await response.json();
                    if (data.success) {
                      setVaultBalance(data.balance || 0);
                    }
                  }
                } catch (error) {
                  console.error('[CountryProfile] Failed to load vault balance:', error);
                } finally {
                  setIsLoadingVaultBalance(false);
                }
              }
            } else {
              setCountryIso2(null);
            }
          }
        }
      } catch (error) {
        console.error('[CountryProfile] Failed to load country GeoJSON:', error);
      }
    };
    
    loadCountryVaultInfo();
  }, [isOpen, countryCode, contractClient, walletAddress, readOnlyClient]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '500px',
          width: '90vw',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>
            {countryName} (Code: {countryCode})
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '0 8px',
            }}
          >
            ×
          </button>
        </div>

        {/* Country Status */}
        <div style={{ padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>Country Status</h3>
          {isLoadingPolicy ? (
            <div>Loading policy...</div>
          ) : (
            <div>
              <strong>Status:</strong>{' '}
              <span style={{ color: isAllowed ? '#4caf50' : '#d32f2f' }}>
                {isAllowed ? 'Allowed' : 'Denied'}
              </span>
            </div>
          )}
        </div>

        {/* Country Admin */}
        <div style={{ padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>Country Admin</h3>
          {isLoadingAdmin ? (
            <div>Loading admin...</div>
          ) : countryAdmin ? (
            <div>
              <div style={{ fontSize: '14px', wordBreak: 'break-all' }}>
                {countryAdmin}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '14px', color: '#666' }}>
              No country-specific admin assigned. Main admin manages this country.
            </div>
          )}
        </div>

        {/* Country Vault */}
        {countryIso2 && (
          <div style={{ padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '4px', border: '1px solid #ddd' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>Country Vault ({countryIso2})</h3>
            {isLoadingVault ? (
              <div>Loading vault info...</div>
            ) : vaultInfo ? (
              <div>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Registered:</strong>{' '}
                  <span style={{ color: '#28a745', fontWeight: 'bold' }}>Yes</span>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Vault Status:</strong>{' '}
                  <span style={{
                    color: vaultInfo.enabled ? '#28a745' : '#dc3545',
                    fontWeight: 'bold'
                  }}>
                    {vaultInfo.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                {vaultInfo.name && (
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                    Country: {vaultInfo.name}
                  </div>
                )}
                {walletAddress && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #ddd' }}>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>
                      Your Vault Balance:
                    </div>
                    {isLoadingVaultBalance ? (
                      <div style={{ fontSize: '16px', color: '#666' }}>Loading...</div>
                    ) : vaultBalance !== null ? (
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#FFD700' }}>
                        {(vaultBalance / 10000000).toFixed(4)} XLM
                      </div>
                    ) : (
                      <div style={{ fontSize: '14px', color: '#888' }}>
                        No balance
                      </div>
                    )}
                    
                    {vaultInfo.enabled && (
                      <div style={{ marginTop: '12px' }}>
                        {!showDepositForm ? (
                          <button
                            onClick={() => setShowDepositForm(true)}
                            style={{
                              padding: '8px 16px',
                              backgroundColor: '#007bff',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '14px',
                              fontWeight: 'bold'
                            }}
                          >
                            Deposit
                          </button>
                        ) : (
                          <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #ddd' }}>
                            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Deposit to {countryIso2} Vault</h4>
                            <div style={{ marginBottom: '12px' }}>
                              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                                Amount (XLM):
                              </label>
                              <input
                                type="number"
                                step="0.0000001"
                                min="0"
                                value={depositAmount}
                                onChange={(e) => {
                                  setDepositAmount(e.target.value);
                                  setDepositError(null);
                                }}
                                placeholder="10.5"
                                disabled={isDepositing}
                                style={{
                                  width: '100%',
                                  padding: '8px',
                                  fontSize: '14px',
                                  border: '1px solid #ddd',
                                  borderRadius: '4px'
                                }}
                              />
                            </div>
                            {depositError && (
                              <div style={{ 
                                padding: '8px', 
                                backgroundColor: '#fee', 
                                color: '#c33', 
                                borderRadius: '4px', 
                                marginBottom: '12px',
                                fontSize: '12px'
                              }}>
                                {depositError}
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={async () => {
                                  if (!depositAmount || parseFloat(depositAmount) <= 0) {
                                    setDepositError('Please enter a valid amount');
                                    return;
                                  }
                                  
                                  if (!walletAddress || !countryIso2) {
                                    setDepositError('Wallet or country code missing');
                                    return;
                                  }
                                  
                                  if (!passkeyService) {
                                    setDepositError('Passkey service not available. Please set up a passkey first.');
                                    return;
                                  }
                                  
                                  setIsDepositing(true);
                                  setDepositError(null);
                                  
                                  try {
                                    // First, verify the country vault is registered and enabled
                                    if (!vaultInfo) {
                                      throw new Error('Country vault is not registered. Please register it first via the admin panel.');
                                    }
                                    
                                    if (!vaultInfo.enabled) {
                                      throw new Error('Country vault is disabled. Please enable it first via the admin panel.');
                                    }
                                    
                                    // Get stored passkey credential
                                    if (!passkeyService) {
                                      throw new Error('Passkey service not available');
                                    }
                                    
                                    const passkeyData = await passkeyService.getStoredPasskeyData();
                                    if (!passkeyData) {
                                      throw new Error('No passkey found. Please set up a passkey first.');
                                    }
                                    
                                    // Convert amount to stroops
                                    const amountInStroops = Math.round(parseFloat(depositAmount) * 10000000);
                                    
                                    // Get asset address - use SAC (Stellar Asset Contract) for native XLM
                                    // Testnet SAC: CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
                                    // Mainnet SAC: CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC (same for now)
                                    const assetAddress = process.env.REACT_APP_NATIVE_XLM_SAC_ADDRESS || 
                                      'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
                                    
                                    // Create signature payload
                                    const transactionData = {
                                      source: walletAddress,
                                      country_code: countryIso2,
                                      asset: assetAddress,
                                      amount: depositAmount,
                                      timestamp: Date.now(),
                                      operation: 'deposit'
                                    };
                                    const signaturePayload = JSON.stringify(transactionData);
                                    
                                    // Generate WebAuthn challenge
                                    const payloadBytes = new TextEncoder().encode(signaturePayload);
                                    const hashBuffer = await crypto.subtle.digest('SHA-256', payloadBytes);
                                    const challenge = new Uint8Array(hashBuffer).slice(0, 32);
                                    
                                    // Authenticate with passkey using PasskeyService
                                    const authResult = await passkeyService.authenticatePasskey(
                                      passkeyData.id,
                                      challenge
                                    );
                                    
                                    // Extract WebAuthn data from authResult
                                    const signature = authResult.signature;
                                    const authenticatorData = authResult.authenticatorData;
                                    // clientDataJSON from PasskeyService is already base64 encoded
                                    const clientDataJSON = authResult.clientDataJSON;
                                    
                                    // Get passkey public key SPKI (for future verification if needed)
                                    // const passkeyPublicKeySPKI = await passkeyService.getPasskeyPublicKeySPKI(passkeyData.id);
                                    
                                    // Use contract client to deposit (handles wallet signing)
                                    if (!contractClient) {
                                      throw new Error('Contract client not available');
                                    }
                                    
                                    // Call contract deposit method (will prompt wallet for signing)
                                    // The contract will handle token authorization internally
                                    await contractClient.deposit(
                                      walletAddress,
                                      countryIso2,
                                      assetAddress,
                                      amountInStroops,
                                      signaturePayload,
                                      signature,
                                      authenticatorData,
                                      clientDataJSON
                                    );
                                    
                                    // Success!
                                    alert(`Successfully deposited ${depositAmount} XLM to ${countryIso2} vault!`);
                                    setDepositAmount('');
                                    setShowDepositForm(false);
                                    
                                    // Reload balance
                                    setIsLoadingVaultBalance(true);
                                    try {
                                      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
                                      const balanceResponse = await fetch(`${backendUrl}/api/smart-wallet/get-balance`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          contractId: process.env.REACT_APP_CONTRACT_ID,
                                          userAddress: walletAddress,
                                          countryCode: countryIso2,
                                          assetAddress: assetAddress,
                                          rpcUrl: process.env.REACT_APP_SOROBAN_RPC_URL
                                        })
                                      });
                                      const balanceData = await balanceResponse.json();
                                      if (balanceData.success) {
                                        setVaultBalance(balanceData.balance || 0);
                                      }
                                    } catch (error) {
                                      console.error('[CountryProfile] Failed to reload balance:', error);
                                    } finally {
                                      setIsLoadingVaultBalance(false);
                                    }
                                  } catch (error: any) {
                                    console.error('[CountryProfile] Deposit error:', error);
                                    setDepositError(error.message || 'Deposit failed. Please try again.');
                                  } finally {
                                    setIsDepositing(false);
                                  }
                                }}
                                disabled={isDepositing || !depositAmount}
                                style={{
                                  flex: 1,
                                  padding: '8px 16px',
                                  backgroundColor: isDepositing ? '#ccc' : '#28a745',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: isDepositing ? 'not-allowed' : 'pointer',
                                  fontSize: '14px',
                                  fontWeight: 'bold'
                                }}
                              >
                                {isDepositing ? 'Depositing...' : 'Confirm Deposit'}
                              </button>
                              <button
                                onClick={() => {
                                  setShowDepositForm(false);
                                  setDepositAmount('');
                                  setDepositError(null);
                                }}
                                disabled={isDepositing}
                                style={{
                                  padding: '8px 16px',
                                  backgroundColor: '#666',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: isDepositing ? 'not-allowed' : 'pointer',
                                  fontSize: '14px'
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {!walletAddress && (
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '8px', fontStyle: 'italic' }}>
                    Connect wallet to see your balance and make deposits
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: '14px', color: '#666' }}>
                Country vault not registered
              </div>
            )}
          </div>
        )}

        {/* Admin Actions */}
        {(isMainAdmin || isCountryAdmin) && onManageCountry && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #ddd' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>Admin Actions</h3>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  onManageCountry({ code: countryCode, name: countryName });
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#007bff',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Manage Country
              </button>
              {contractClient && (
                <button
                  onClick={async () => {
                    if (!contractClient) return;
                    try {
                      await contractClient.setCountryAllowed(countryCode, !isAllowed);
                      setIsAllowed(!isAllowed);
                      alert(`Country ${isAllowed ? 'denied' : 'allowed'} successfully`);
                    } catch (error: any) {
                      alert(`Failed to update policy: ${error.message}`);
                    }
                  }}
                  disabled={isLoadingPolicy}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: isAllowed ? '#d32f2f' : '#4caf50',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: isLoadingPolicy ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    opacity: isLoadingPolicy ? 0.6 : 1,
                  }}
                >
                  {isLoadingPolicy ? 'Updating...' : (isAllowed ? 'Deny Country' : 'Allow Country')}
                </button>
              )}
            </div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
              {isMainAdmin ? 'You are the main admin.' : 'You are the country admin for this country.'}
            </div>
          </div>
        )}

        {!(isMainAdmin || isCountryAdmin) && (
          <div style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
            This is a public profile. Only admins can modify country settings.
          </div>
        )}
      </div>
    </div>
  );
};
