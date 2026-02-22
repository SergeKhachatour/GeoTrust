import React, { useState, useEffect } from 'react';
import { ContractClient } from '../contract';
import { parseCountriesFromGeoJSON, CountryInfo, validateCountryCode } from '../utils/countryVaultUtils';

interface CountryVaultAdminProps {
  contractClient: ContractClient;
  walletAddress: string;
}

export const CountryVaultAdmin: React.FC<CountryVaultAdminProps> = ({
  contractClient,
  walletAddress
}) => {
  const [countries, setCountries] = useState<CountryInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<CountryInfo | null>(null);
  const [countryInfo, setCountryInfo] = useState<any>(null);
  const [registering, setRegistering] = useState(false);
  const [enabling, setEnabling] = useState(false);

  // Load countries from GeoJSON
  useEffect(() => {
    const loadCountries = async () => {
      try {
        setLoading(true);
        const loadedCountries = await parseCountriesFromGeoJSON();
        setCountries(loadedCountries);
        console.log('[CountryVaultAdmin] Loaded', loadedCountries.length, 'countries');
      } catch (error) {
        console.error('[CountryVaultAdmin] Error loading countries:', error);
        alert('Failed to load countries from GeoJSON');
      } finally {
        setLoading(false);
      }
    };
    loadCountries();
  }, []);

  // Load country info when selected
  useEffect(() => {
    if (selectedCountry) {
      loadCountryInfo(selectedCountry.iso2);
    }
  }, [selectedCountry]);

  const loadCountryInfo = async (countryCode: string) => {
    try {
      const info = await contractClient.getCountryInfo(countryCode);
      setCountryInfo(info);
    } catch (error) {
      console.error('[CountryVaultAdmin] Error loading country info:', error);
      setCountryInfo(null);
    }
  };

  const handleRegisterCountry = async (country: CountryInfo) => {
    if (!validateCountryCode(country.iso2)) {
      alert('Invalid country code format');
      return;
    }

    try {
      setRegistering(true);
      await contractClient.registerCountry(country.iso2, country.name, walletAddress);
      alert(`Successfully registered ${country.iso2} (${country.name})`);
      await loadCountryInfo(country.iso2);
    } catch (error: any) {
      console.error('[CountryVaultAdmin] Error registering country:', error);
      if (error.message?.includes('already registered')) {
        alert(`Country ${country.iso2} is already registered`);
      } else {
        alert(`Failed to register country: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleToggleEnabled = async (countryCode: string, currentEnabled: boolean) => {
    try {
      setEnabling(true);
      await contractClient.setCountryEnabled(countryCode, !currentEnabled, walletAddress);
      alert(`Successfully ${!currentEnabled ? 'enabled' : 'disabled'} ${countryCode}`);
      await loadCountryInfo(countryCode);
    } catch (error: any) {
      console.error('[CountryVaultAdmin] Error toggling country:', error);
      alert(`Failed to toggle country: ${error.message || 'Unknown error'}`);
    } finally {
      setEnabling(false);
    }
  };

  const filteredCountries = countries.filter((country) =>
    country.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    country.iso2.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2>Country Vault Administration</h2>
      <p>Register and manage countries for the country vault system.</p>

      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Search countries by name or ISO code..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '16px',
            border: '1px solid #ccc',
            borderRadius: '4px'
          }}
        />
      </div>

      {loading ? (
        <div>Loading countries...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Country List */}
          <div>
            <h3>Available Countries ({filteredCountries.length})</h3>
            <div style={{
              maxHeight: '600px',
              overflowY: 'auto',
              border: '1px solid #ccc',
              borderRadius: '4px',
              padding: '10px'
            }}>
              {filteredCountries.map((country) => (
                <div
                  key={country.iso2}
                  onClick={() => setSelectedCountry(country)}
                  style={{
                    padding: '10px',
                    marginBottom: '5px',
                    border: selectedCountry?.iso2 === country.iso2 ? '2px solid #007bff' : '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    backgroundColor: selectedCountry?.iso2 === country.iso2 ? '#e7f3ff' : 'white'
                  }}
                >
                  <div style={{ fontWeight: 'bold' }}>{country.iso2}</div>
                  <div style={{ fontSize: '14px', color: '#666' }}>{country.name}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Country Details */}
          <div>
            <h3>Country Details</h3>
            {selectedCountry ? (
              <div style={{
                border: '1px solid #ccc',
                borderRadius: '4px',
                padding: '20px'
              }}>
                <div style={{ marginBottom: '15px' }}>
                  <strong>ISO Code:</strong> {selectedCountry.iso2}
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <strong>Name:</strong> {selectedCountry.name}
                </div>
                {countryInfo ? (
                  <div>
                    <div style={{ marginBottom: '10px' }}>
                      <strong>Status:</strong>{' '}
                      <span style={{
                        color: countryInfo.enabled ? 'green' : 'red',
                        fontWeight: 'bold'
                      }}>
                        {countryInfo.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <strong>Registered:</strong> {new Date(countryInfo.created_at * 1000).toLocaleString()}
                    </div>
                    <div style={{ marginTop: '20px' }}>
                      <button
                        onClick={() => handleToggleEnabled(selectedCountry.iso2, countryInfo.enabled)}
                        disabled={enabling}
                        style={{
                          padding: '10px 20px',
                          backgroundColor: countryInfo.enabled ? '#dc3545' : '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          marginRight: '10px'
                        }}
                      >
                        {enabling ? 'Processing...' : (countryInfo.enabled ? 'Disable' : 'Enable')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ marginBottom: '15px', color: '#666' }}>
                      Country not registered in contract
                    </div>
                    <button
                      onClick={() => handleRegisterCountry(selectedCountry)}
                      disabled={registering}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      {registering ? 'Registering...' : 'Register Country'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                border: '1px solid #ccc',
                borderRadius: '4px',
                padding: '20px',
                color: '#666',
                textAlign: 'center'
              }}>
                Select a country to view details
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
