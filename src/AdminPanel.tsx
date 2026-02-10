import React, { useState, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import { ContractClient } from './contract';

interface AdminPanelProps {
  contractClient: ContractClient;
  allowedCountries: Set<number>;
  defaultAllowAll: boolean;
  onCountryToggle: () => void;
  map: mapboxgl.Map | null;
}

// Simplified country list - in production, use a complete mapping
const COUNTRY_LIST: Array<{ code: number; name: string; iso2: string }> = [
  { code: 840, name: 'United States', iso2: 'US' },
  { code: 826, name: 'United Kingdom', iso2: 'GB' },
  { code: 124, name: 'Canada', iso2: 'CA' },
  { code: 36, name: 'Australia', iso2: 'AU' },
  { code: 276, name: 'Germany', iso2: 'DE' },
  { code: 250, name: 'France', iso2: 'FR' },
  { code: 392, name: 'Japan', iso2: 'JP' },
  { code: 156, name: 'China', iso2: 'CN' },
  // Add more countries as needed
];

export const AdminPanel: React.FC<AdminPanelProps> = ({
  contractClient,
  allowedCountries,
  defaultAllowAll,
  onCountryToggle,
  map,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const filteredCountries = COUNTRY_LIST.filter((country) =>
    country.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleCountry = async (countryCode: number) => {
    setIsLoading(true);
    try {
      const isAllowed = allowedCountries.has(countryCode);
      await contractClient.setCountryAllowed(countryCode, !isAllowed);
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

  useEffect(() => {
    if (!map) return;

    const handleCountryClick = (e: mapboxgl.MapMouseEvent) => {
      // Get country code from clicked feature
      const features = map.queryRenderedFeatures(e.point, {
        layers: ['countries-fill'],
      });

      if (features.length > 0) {
        const countryCode = features[0].properties?.ISO_NUMERIC;
        if (countryCode) {
          handleToggleCountry(countryCode);
        }
      }
    };

    map.on('click', 'countries-fill', handleCountryClick);
    map.getCanvas().style.cursor = 'pointer';

    return () => {
      map.off('click', 'countries-fill', handleCountryClick);
      map.getCanvas().style.cursor = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, allowedCountries]);

  return (
    <div className="admin-panel">
      <h3>Admin Panel</h3>
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
          const isAllowed = allowedCountries.has(country.code);
          return (
            <div key={country.code} className="country-item">
              <span>{country.name}</span>
              <button
                className={`country-toggle ${isAllowed ? 'allowed' : 'denied'}`}
                onClick={() => handleToggleCountry(country.code)}
                disabled={isLoading}
              >
                {isAllowed ? 'Allowed' : 'Denied'}
              </button>
            </div>
          );
        })}
      </div>
      <p style={{ marginTop: '12px', fontSize: '12px', color: '#666' }}>
        Click on map to toggle countries
      </p>
    </div>
  );
};
