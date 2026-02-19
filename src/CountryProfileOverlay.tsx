import React, { useState, useEffect, useMemo } from 'react';
import { ContractClient } from './contract';
import { ReadOnlyContractClient } from './contract-readonly';

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
