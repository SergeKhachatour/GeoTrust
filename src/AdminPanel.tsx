import React, { useState, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import { ContractClient } from './contract';
import { ReadOnlyContractClient } from './contract-readonly';
import { iso2ToNumeric, iso3ToIso2 } from './countryCodes';
import { CountryManagementOverlay } from './CountryManagementOverlay';

interface AdminPanelProps {
  contractClient: ContractClient;
  allowedCountries: Set<number>;
  defaultAllowAll: boolean;
  onCountryToggle: () => void;
  map: mapboxgl.Map | null;
  minimized?: boolean;
  onToggleMinimize?: () => void;
  onAdminChanged?: () => void;
  walletAddress?: string | null; // Current wallet address to check if user is main admin
  mainAdminAddress?: string | null; // Main admin address from contract
  onManageCountry?: (country: { code: number; name: string }) => void; // Callback to open country management overlay
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  contractClient,
  allowedCountries,
  defaultAllowAll,
  onCountryToggle,
  map,
  minimized = false,
  onToggleMinimize,
  onAdminChanged,
  walletAddress,
  mainAdminAddress,
  onManageCountry,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [countryList, setCountryList] = useState<Array<{ code: number; name: string; iso2: string }>>([]);
  const [showChangeAdminOverlay, setShowChangeAdminOverlay] = useState(false);
  const [newAdminAddress, setNewAdminAddress] = useState('');
  const [isChangingAdmin, setIsChangingAdmin] = useState(false);
  const [countryAdmins, setCountryAdmins] = useState<Map<number, string>>(new Map());
  const [selectedCountryForAdmin, setSelectedCountryForAdmin] = useState<number | null>(null);
  const [showCountryAdminOverlay, setShowCountryAdminOverlay] = useState(false);
  const [newCountryAdminAddress, setNewCountryAdminAddress] = useState('');
  const [isSettingCountryAdmin, setIsSettingCountryAdmin] = useState(false);
  const [showCountryManagement, setShowCountryManagement] = useState(false);
  const [selectedCountryForManagement, setSelectedCountryForManagement] = useState<{ code: number; name: string } | null>(null);
  
  // Check if current user is main admin
  const isMainAdmin: boolean = !!(walletAddress && mainAdminAddress && walletAddress === mainAdminAddress);
  
  // Check if user is country admin for a specific country
  const isCountryAdminFor = (countryCode: number): boolean => {
    const admin = countryAdmins.get(countryCode);
    return admin === walletAddress;
  };
  
  // Handle opening country management overlay
  const handleManageCountry = async (country: { code: number; name: string }) => {
    // Load country admin if not already loaded
    if (!countryAdmins.has(country.code)) {
      await loadCountryAdmin(country.code);
    }
    // Use callback if provided, otherwise use local state (for backward compatibility)
    if (onManageCountry) {
      onManageCountry(country);
    } else {
      setSelectedCountryForManagement(country);
      setShowCountryManagement(true);
    }
  };

  // Load country admin for a specific country (on-demand)
  const loadCountryAdmin = async (countryCode: number) => {
    if (!isMainAdmin) return;
    
    try {
      // Use read-only client to avoid Freighter prompts
      const readOnlyClient = new ReadOnlyContractClient();
      const admin = await readOnlyClient.getCountryAdmin(countryCode);
      if (admin) {
        const newAdmins = new Map(countryAdmins);
        newAdmins.set(countryCode, admin);
        setCountryAdmins(newAdmins);
      } else {
        // Remove from map if no admin
        const newAdmins = new Map(countryAdmins);
        newAdmins.delete(countryCode);
        setCountryAdmins(newAdmins);
      }
    } catch (error) {
      console.debug(`[AdminPanel] No admin for country ${countryCode}`);
    }
  };

  // Load countries from GeoJSON file
  useEffect(() => {
    const loadCountries = async () => {
      try {
        const response = await fetch('/countries.geojson');
        if (response.ok) {
          const geojson = await response.json();
          if (geojson.features) {
            const countries = geojson.features
              .map((feature: any) => {
                // Try ISO_NUMERIC first, then convert from ISO2/ISO3
                let code = feature.properties?.ISO_NUMERIC;
                const name = feature.properties?.name || feature.properties?.NAME;
                // Check both properties.id and feature-level id (which is ISO3)
                const iso3 = feature.id || feature.properties?.id;
                const iso2 = feature.properties?.ISO2;
                
                // If no ISO_NUMERIC, try to convert from ISO2 or ISO3
                if (!code) {
                  if (iso2) {
                    code = iso2ToNumeric(iso2);
                  } else if (iso3) {
                    // Convert ISO3 to ISO2 first, then to numeric
                    const iso2FromIso3 = iso3ToIso2(iso3);
                    if (iso2FromIso3) {
                      code = iso2ToNumeric(iso2FromIso3);
                    }
                  }
                }
                
                if (code && name) {
                  return { code: Number(code), name: String(name), iso2: String(iso2 || iso3ToIso2(iso3) || '') };
                }
                return null;
              })
              .filter((c: any) => c !== null)
              .sort((a: any, b: any) => a.name.localeCompare(b.name));
            setCountryList(countries);
            console.log('[AdminPanel] Loaded', countries.length, 'countries from GeoJSON');
          }
        } else {
          console.warn('[AdminPanel] Failed to load countries.geojson');
        }
      } catch (error) {
        console.error('[AdminPanel] Error loading countries:', error);
      }
    };
    loadCountries();
  }, []);

  const filteredCountries = countryList.filter((country) =>
    country.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Determine if a country is currently allowed based on the policy
  const isCountryAllowed = (countryCode: number): boolean => {
    if (defaultAllowAll) {
      // If default is allow all, allowedCountries acts as a denylist
      // Country is allowed if it's NOT in the denylist
      return !allowedCountries.has(countryCode);
    } else {
      // If default is deny all, allowedCountries acts as an allowlist
      // Country is allowed if it IS in the allowlist
      return allowedCountries.has(countryCode);
    }
  };

  const handleToggleCountry = async (countryCode: number) => {
    setIsLoading(true);
    try {
      const currentlyAllowed = isCountryAllowed(countryCode);
      // Toggle: if currently allowed, deny it; if currently denied, allow it
      await contractClient.setCountryAllowed(countryCode, !currentlyAllowed);
      onCountryToggle();
    } catch (error) {
      console.error('Failed to toggle country:', error);
      alert('Failed to update country policy');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleDefaultPolicy = async () => {
    setIsLoading(true);
    try {
      await contractClient.setDefaultAllowAll(!defaultAllowAll);
      onCountryToggle();
    } catch (error) {
      console.error('Failed to update default policy:', error);
      alert('Failed to update default policy');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeAdmin = async () => {
    if (!newAdminAddress || newAdminAddress.length !== 56 || !newAdminAddress.startsWith('G')) {
      alert('Please enter a valid Stellar address (56 characters, starting with G)');
      return;
    }

    const confirmMessage = `Are you sure you want to transfer admin rights to:\n${newAdminAddress}\n\nThis will remove your admin privileges and you will be logged out.`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsChangingAdmin(true);
    try {
      await contractClient.setAdmin(newAdminAddress);
      alert('Admin successfully changed! You will lose admin access.');
      setShowChangeAdminOverlay(false);
      setNewAdminAddress('');
      // Notify parent to re-check admin status
      if (onAdminChanged) {
        onAdminChanged();
      }
    } catch (error: any) {
      console.error('Failed to change admin:', error);
      alert(`Failed to change admin: ${error.message || error}`);
    } finally {
      setIsChangingAdmin(false);
    }
  };

  const handleSetCountryAdmin = async (countryCode: number) => {
    setSelectedCountryForAdmin(countryCode);
    // Load current admin for this country if not already loaded
    if (!countryAdmins.has(countryCode)) {
      await loadCountryAdmin(countryCode);
    }
    setShowCountryAdminOverlay(true);
    // Pre-fill with existing admin if any
    const existingAdmin = countryAdmins.get(countryCode);
    setNewCountryAdminAddress(existingAdmin || '');
  };

  const handleSaveCountryAdmin = async () => {
    if (!selectedCountryForAdmin) return;
    
    if (!newCountryAdminAddress || newCountryAdminAddress.length !== 56 || !newCountryAdminAddress.startsWith('G')) {
      alert('Please enter a valid Stellar address (56 characters, starting with G)');
      return;
    }

    setIsSettingCountryAdmin(true);
    try {
      if (newCountryAdminAddress.trim() === '') {
        // Remove country admin
        await contractClient.removeCountryAdmin(selectedCountryForAdmin);
        const newAdmins = new Map(countryAdmins);
        newAdmins.delete(selectedCountryForAdmin);
        setCountryAdmins(newAdmins);
        alert('Country admin removed successfully');
        // Refresh to confirm removal
        await loadCountryAdmin(selectedCountryForAdmin);
      } else {
        // Set country admin
        await contractClient.setCountryAdmin(selectedCountryForAdmin, newCountryAdminAddress);
        const newAdmins = new Map(countryAdmins);
        newAdmins.set(selectedCountryForAdmin, newCountryAdminAddress);
        setCountryAdmins(newAdmins);
        alert('Country admin set successfully');
        // Refresh country admin to ensure it's up to date
        await loadCountryAdmin(selectedCountryForAdmin);
      }
      setShowCountryAdminOverlay(false);
      setNewCountryAdminAddress('');
      setSelectedCountryForAdmin(null);
    } catch (error: any) {
      console.error('Failed to set country admin:', error);
      alert(`Failed to set country admin: ${error.message || error}`);
    } finally {
      setIsSettingCountryAdmin(false);
    }
  };

  const getCountryAdmin = (countryCode: number): string | null => {
    return countryAdmins.get(countryCode) || null;
  };

  // Country click handling is now done in App.tsx
  // Removed local click handler to avoid conflicts

  return (
    <div className="admin-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: minimized ? '0' : '12px', gap: '8px' }}>
        <h3 style={{ margin: 0, flex: 1, whiteSpace: 'nowrap' }}>Admin Panel</h3>
        {onToggleMinimize && (
          <button 
            className="icon-button" 
            onClick={onToggleMinimize} 
            title={minimized ? 'Expand' : 'Minimize'}
            style={{ fontSize: '10px', padding: '1px 3px', width: '18px', height: '18px', flexShrink: 0 }}
          >
            {minimized ? '▼' : '▲'}
          </button>
        )}
      </div>
      {!minimized && (
        <>
      <div style={{ marginBottom: '12px' }}>
        <label>
          <input
            type="checkbox"
            checked={defaultAllowAll}
            onChange={handleToggleDefaultPolicy}
            disabled={isLoading}
          />
          Default: Allow All Countries
        </label>
      </div>
      <input
        type="text"
        placeholder="Search country..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        disabled={isLoading}
      />
      <div className="country-list">
        {filteredCountries.map((country) => {
          const isAllowed = isCountryAllowed(country.code);
          const countryAdmin = getCountryAdmin(country.code);
          const hasCountryAdmin = countryAdmin !== null;
          return (
            <div key={country.code} className="country-item" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span style={{ flex: 1 }}>{country.name}</span>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <button
                    className="primary-button"
                    onClick={() => handleManageCountry(country)}
                    disabled={isLoading}
                    style={{
                      fontSize: '11px',
                      padding: '4px 8px',
                      backgroundColor: '#2196f3',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                    }}
                    title="Manage Country"
                  >
                    Manage
                  </button>
                  <button
                    className={`country-toggle ${isAllowed ? 'allowed' : 'denied'}`}
                    onClick={() => handleToggleCountry(country.code)}
                    disabled={isLoading}
                    style={{ marginLeft: '4px' }}
                  >
                    {isAllowed ? 'Allowed' : 'Denied'}
                  </button>
                </div>
              </div>
              {isMainAdmin && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#666', marginTop: '2px', padding: '2px 0' }}>
                  <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {hasCountryAdmin && (
                      <span style={{ 
                        display: 'inline-block',
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: '#4caf50',
                        flexShrink: 0
                      }} title="Has country admin" />
                    )}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {hasCountryAdmin ? (
                        <>Admin: {countryAdmin.substring(0, 8)}...{countryAdmin.substring(48)}</>
                      ) : (
                        <>No country admin (uses main admin)</>
                      )}
                    </span>
                  </div>
                  <button
                    onClick={() => handleSetCountryAdmin(country.code)}
                    disabled={isLoading}
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      marginLeft: '4px',
                      backgroundColor: hasCountryAdmin ? '#ff9800' : '#4caf50',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                    title={hasCountryAdmin ? 'Change/Remove Country Admin' : 'Set Country Admin'}
                  >
                    {hasCountryAdmin ? 'Edit' : 'Set Admin'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p style={{ marginTop: '12px', fontSize: '12px', color: '#666' }}>
        Click on map to toggle countries
      </p>
      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #eee' }}>
        <button
          className="primary-button"
          onClick={() => setShowChangeAdminOverlay(true)}
          disabled={isLoading}
          style={{ 
            width: '100%', 
            backgroundColor: '#d32f2f', 
            color: '#fff',
            fontSize: '12px',
            padding: '8px 16px'
          }}
        >
          Transfer Admin Rights
        </button>
        <p style={{ marginTop: '8px', fontSize: '11px', color: '#999', textAlign: 'center' }}>
          ⚠️ This will remove your admin access
        </p>
      </div>
        </>
      )}

      {/* Country Admin Overlay */}
      {showCountryAdminOverlay && selectedCountryForAdmin !== null && (
        <div 
          className="marker-popup-overlay" 
          onClick={() => !isSettingCountryAdmin && setShowCountryAdminOverlay(false)}
          style={{ zIndex: 3000 }}
        >
          <div className="marker-popup" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <button 
              className="marker-popup-close" 
              onClick={() => !isSettingCountryAdmin && setShowCountryAdminOverlay(false)}
              disabled={isSettingCountryAdmin}
            >
              ×
            </button>
            <h3>Set Country Admin</h3>
            <div className="marker-popup-content">
              <div className="marker-popup-field">
                <label>Country:</label>
                <span style={{ fontWeight: 'bold' }}>
                  {countryList.find(c => c.code === selectedCountryForAdmin)?.name || `Country ${selectedCountryForAdmin}`}
                </span>
              </div>
              <div className="marker-popup-field">
                <label>Country Admin Address:</label>
                <input
                  type="text"
                  value={newCountryAdminAddress}
                  onChange={(e) => setNewCountryAdminAddress(e.target.value)}
                  placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX (leave empty to remove)"
                  disabled={isSettingCountryAdmin}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '12px',
                    fontFamily: 'Courier New, monospace',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    marginTop: '4px'
                  }}
                />
                <small style={{ color: '#666', fontSize: '10px', marginTop: '4px', display: 'block' }}>
                  Enter the Stellar address (56 characters, starting with G) of the country admin.
                  <br />
                  Leave empty to remove the country admin (reverts to main admin).
                </small>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button
                  className="primary-button"
                  onClick={handleSaveCountryAdmin}
                  disabled={isSettingCountryAdmin || (newCountryAdminAddress.trim() !== '' && (newCountryAdminAddress.length !== 56 || !newCountryAdminAddress.startsWith('G')))}
                  style={{ 
                    flex: 1,
                    backgroundColor: newCountryAdminAddress.trim() ? '#4caf50' : '#ff9800',
                    color: '#fff'
                  }}
                >
                  {isSettingCountryAdmin ? 'Saving...' : (newCountryAdminAddress.trim() ? 'Set Admin' : 'Remove Admin')}
                </button>
                <button
                  className="primary-button"
                  onClick={() => {
                    setShowCountryAdminOverlay(false);
                    setNewCountryAdminAddress('');
                    setSelectedCountryForAdmin(null);
                  }}
                  disabled={isSettingCountryAdmin}
                  style={{ 
                    flex: 1,
                    backgroundColor: '#666',
                    color: '#fff'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Admin Overlay */}
      {showChangeAdminOverlay && (
        <div 
          className="marker-popup-overlay" 
          onClick={() => !isChangingAdmin && setShowChangeAdminOverlay(false)}
          style={{ zIndex: 3000 }}
        >
          <div className="marker-popup" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <button 
              className="marker-popup-close" 
              onClick={() => !isChangingAdmin && setShowChangeAdminOverlay(false)}
              disabled={isChangingAdmin}
            >
              ×
            </button>
            <h3>Transfer Admin Rights</h3>
            <div className="marker-popup-content">
              <div className="marker-popup-field">
                <label>Warning:</label>
                <span style={{ color: '#d32f2f', fontSize: '14px' }}>
                  Transferring admin rights will remove your admin access. You will need to reconnect with the new admin account to regain access.
                </span>
              </div>
              <div className="marker-popup-field">
                <label>New Admin Address:</label>
                <input
                  type="text"
                  value={newAdminAddress}
                  onChange={(e) => setNewAdminAddress(e.target.value)}
                  placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                  disabled={isChangingAdmin}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '12px',
                    fontFamily: 'Courier New, monospace',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    marginTop: '4px'
                  }}
                />
                <small style={{ color: '#666', fontSize: '10px', marginTop: '4px', display: 'block' }}>
                  Enter the Stellar address (56 characters, starting with G) of the new admin
                </small>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button
                  className="primary-button"
                  onClick={handleChangeAdmin}
                  disabled={isChangingAdmin || !newAdminAddress}
                  style={{ 
                    flex: 1,
                    backgroundColor: '#d32f2f',
                    color: '#fff'
                  }}
                >
                  {isChangingAdmin ? 'Transferring...' : 'Confirm Transfer'}
                </button>
                <button
                  className="primary-button"
                  onClick={() => setShowChangeAdminOverlay(false)}
                  disabled={isChangingAdmin}
                  style={{ 
                    flex: 1,
                    backgroundColor: '#666',
                    color: '#fff'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Country Management Overlay - Only render if callback not provided (backward compatibility) */}
      {!onManageCountry && showCountryManagement && selectedCountryForManagement && (
        <CountryManagementOverlay
          isOpen={showCountryManagement}
          onClose={() => {
            setShowCountryManagement(false);
            setSelectedCountryForManagement(null);
          }}
          countryCode={selectedCountryForManagement.code}
          countryName={selectedCountryForManagement.name}
          contractClient={contractClient}
          walletAddress={walletAddress || null}
          mainAdminAddress={mainAdminAddress || null}
          isMainAdmin={isMainAdmin}
          map={map}
        />
      )}
    </div>
  );
};
